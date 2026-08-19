/* ===========================================================
   出力（PNG保存・印刷）
   ドキュメントを受け取って画像とプリンタへ流すだけの層。
   状態は持たず、app.js から渡されたアクセサ経由で現在の状態を読む。
   =========================================================== */
var POPExport = (function () {
  'use strict';

  var cfg = null;   /* { getDoc, getCard, getCardSize, getPageIndex, setStatus } */

  /* 出力中フラグ。連打で iframe と blob 生成の流れが並行するのを防ぐ。
     何らかの経路で解除されなかったときに永久に押せなくならないよう、
     60秒で自動的に解除する保険を付ける。 */
  var busy = false;
  var busyTimer = null;

  function setBusy(v) {
    busy = v;
    if (busyTimer) { clearTimeout(busyTimer); busyTimer = null; }
    if (v) busyTimer = setTimeout(function () { busy = false; busyTimer = null; }, 60000);
  }

  var PRINT_DPI = 300;
  var MULTI_DOWNLOAD_INTERVAL_MS = 800;
  var PAGES_CONFIRM_THRESHOLD = 10;

  function safeFileName() {
    var card = cfg.getCard();
    var base = String((card.name && card.name.text) || 'pop')
      .replace(/[\\/:*?"<>|\s\n]+/g, '_').slice(0, 40);
    return (base || 'pop');
  }

  /* 全カードで使っているフォント（Webフォントの読み込み待ちに使う） */
  function allUsedFonts() {
    var out = [];
    cfg.getDoc().cards.forEach(function (c) {
      POPRenderer.usedFonts(c).forEach(function (f) { out.push(f); });
    });
    return out;
  }

  /* canvas を PNG として保存する（toBlob → dataURL のフォールバックつき） */
  function saveCanvas(cv, filename, done) {
    var finish = function (blob) {
      POPStorage.download(blob, filename);
      if (done) done(); else { cfg.setStatus('PNGを保存しました', true); setBusy(false); }
    };
    var fail = function () {
      cfg.setStatus('画像を作成できませんでした。解像度を下げるか用紙を小さくしてお試しください', true);
      setBusy(false);
    };
    var viaDataUrl = function () {
      try {
        var data = cv.toDataURL('image/png').split(',')[1];
        if (!data) { fail(); return; }
        var bin = atob(data), arr = new Uint8Array(bin.length);
        for (var i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
        finish(new Blob([arr], { type: 'image/png' }));
      } catch (e) { fail(); }
    };
    if (cv.toBlob) {
      /* 大きい用紙×高dpi では canvas 面積上限で b が null になり得る＝
         握り潰さず dataURL にフォールバックし、それも駄目なら失敗を通知する */
      cv.toBlob(function (b) { if (b) finish(b); else viaDataUrl(); }, 'image/png');
    } else {
      viaDataUrl();
    }
  }

  /* ---------- PNG 保存 ---------- */
  function png() {
    if (busy) return;
    setBusy(true);
    var doc = cfg.getDoc();
    var dpi = Number(document.getElementById('export-dpi').value) || PRINT_DPI;
    var target = document.getElementById('export-target').value;
    var allPages = document.getElementById('export-allpages').checked;

    if (target === 'card') {
      var card = cfg.getCard();
      cfg.setStatus('画像を作成中…');
      POPFonts.ensureAll(POPRenderer.usedFonts(card)).then(function () {
        POPImageTool.waitForCard(card, function (assets) {
          saveCanvas(POPRenderer.renderToCanvas(card, dpi, assets, cfg.getCardSize()),
                     safeFileName() + '_' + dpi + 'dpi.png');
        });
      });
      return;
    }

    var pages = POPSheetView.pagesOf(doc);
    if (pages <= 0) { cfg.setStatus('カードがシートより大きいため書き出せません', true); setBusy(false); return; }

    cfg.setStatus('画像を作成中…');
    POPFonts.ensureAll(allUsedFonts()).then(function () {
      POPImageTool.waitForCards(doc.cards, function (assetsList) {
        var targets = [];
        if (allPages) { for (var i = 0; i < pages; i++) targets.push(i); }
        else { targets.push(Math.max(0, Math.min(cfg.getPageIndex(), pages - 1))); }

        if (targets.length > 1) {
          cfg.setStatus('全' + targets.length + 'ページを保存します。ブラウザが' +
                        '複数ダウンロードの許可を求めることがあります');
        }
        /* 連続ダウンロードはブラウザに抑止されやすいので間隔を空けて1枚ずつ出す */
        var step = function (k) {
          if (k >= targets.length) { cfg.setStatus('PNGを保存しました', true); setBusy(false); return; }
          var p = targets[k];
          saveCanvas(POPSheetView.renderSheetToCanvas(doc, p, dpi, assetsList),
                     safeFileName() + '_sheet' + (p + 1) + '_' + dpi + 'dpi.png',
                     function () {
                       setTimeout(function () { step(k + 1); }, MULTI_DOWNLOAD_INTERVAL_MS);
                     });
        };
        step(0);
      });
    });
  }

  /* ---------- 印刷 ----------
     面付けされたシートを全ページ、1回のダイアログで出す。
     data URL は base64 で約1.33倍に膨らみ多ページで不利なので blob URL を使い、
     ページ canvas は1枚ずつ作って参照を捨てる。 */
  function printSheets() {
    if (busy) return;
    setBusy(true);
    var doc = cfg.getDoc();
    var pages = POPSheetView.pagesOf(doc);
    if (pages <= 0) { cfg.setStatus('カードがシートより大きいため印刷できません', true); setBusy(false); return; }
    if (pages > PAGES_CONFIRM_THRESHOLD &&
        !window.confirm(pages + 'ページを印刷します。時間とメモリを消費しますが続けますか？')) {
      setBusy(false);
      return;
    }

    cfg.setStatus('印刷を準備中…');
    POPFonts.ensureAll(allUsedFonts()).then(function () {
      POPImageTool.waitForCards(doc.cards, function (assetsList) {
        var sheet = POPPresets.sheetSize(doc.sheet);
        var urls = [];

        var makePage = function (i, done) {
          var cv = POPSheetView.renderSheetToCanvas(doc, i, PRINT_DPI, assetsList);
          var push = function (url) { urls.push(url); done(); };
          if (cv.toBlob) {
            cv.toBlob(function (b) {
              push(b ? URL.createObjectURL(b) : cv.toDataURL('image/png'));
            }, 'image/png');
          } else {
            push(cv.toDataURL('image/png'));
          }
        };

        var next = function (i) {
          if (i >= pages) { openPrintFrame(sheet, urls); return; }
          makePage(i, function () { next(i + 1); });
        };
        next(0);
      });
    });
  }

  function openPrintFrame(sheet, urls) {
    var frame = document.createElement('iframe');
    frame.setAttribute('aria-hidden', 'true');
    frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
    document.body.appendChild(frame);

    var imgs = urls.map(function (u, i) {
      return '<img class="page" id="p' + i + '" alt="">';
    }).join('');

    var d = frame.contentWindow.document;
    d.open();
    d.write(
      '<!DOCTYPE html><html><head><meta charset="utf-8"><title>' + safeFileName() + '</title><style>' +
      '@page{size:' + sheet.w + 'mm ' + sheet.h + 'mm;margin:0}' +
      'html,body{margin:0;padding:0}' +
      'img.page{width:' + sheet.w + 'mm;height:' + sheet.h + 'mm;display:block;page-break-after:always}' +
      'img.page:last-child{page-break-after:auto}' +
      '</style></head><body>' + imgs + '</body></html>'
    );
    d.close();

    var remaining = urls.length;
    var cleanup = function () {
      urls.forEach(function (u) {
        if (u.indexOf('blob:') === 0) { try { URL.revokeObjectURL(u); } catch (e) { /* noop */ } }
      });
      if (frame.parentNode) frame.parentNode.removeChild(frame);
    };
    var go = function () {
      try {
        frame.contentWindow.focus();
        frame.contentWindow.print();
        cfg.setStatus('印刷ダイアログを開きました（全' + urls.length + 'ページ）', true);
      } catch (e) {
        cfg.setStatus('印刷を開始できませんでした', true);
      }
      setBusy(false);
      setTimeout(cleanup, 2000);
    };

    urls.forEach(function (u, i) {
      var im = d.getElementById('p' + i);
      var done = function () { remaining--; if (remaining === 0) go(); };
      im.onload = done;
      im.onerror = done;
      im.src = u;
    });
  }

  function init(o) {
    cfg = o;
    document.getElementById('btn-png').addEventListener('click', png);
    document.getElementById('btn-print').addEventListener('click', printSheets);
    document.getElementById('export-target').addEventListener('change', function (ev) {
      document.getElementById('export-allpages-wrap').hidden = ev.target.value !== 'sheet';
    });
  }

  return {
    init: init,
    png: png,
    print: printSheets,
    safeFileName: safeFileName
  };
})();
