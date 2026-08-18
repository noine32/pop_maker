/* ===========================================================
   商品画像/ロゴの操作
   プレビュー上のドラッグ移動・四隅リサイズ、ファイル取り込み、
   読み込みキャッシュ（カード横断で src をキーに共有）。
   状態は持たず、app.js から渡されたアクセサ経由で選択中カードを触る。
   =========================================================== */
var POPImageTool = (function () {
  'use strict';

  var cfg = null;         /* { canvas, ctx, getCard, getCardSize, onChange, setStatus } */
  var cache = {};         /* src -> HTMLImageElement */
  var loading = {};
  var drag = null;
  var enabled = true;

  /* ---------- 読み込みキャッシュ ---------- */
  function ensure(src, cb) {
    if (!src) { if (cb) cb(null); return; }
    if (cache[src]) { if (cb) cb(cache[src]); return; }
    if (loading[src]) return;      /* 二重ロード防止（onload 完了時に再描画される） */
    loading[src] = true;
    var im = new Image();
    im.onload = function () { cache[src] = im; delete loading[src]; if (cb) cb(im); };
    im.onerror = function () { delete loading[src]; if (cb) cb(null); };
    im.src = src;
  }

  /** 今読み込めているぶんだけを返す（待たない） */
  function assetsFor(card) {
    var src = card && card.image && card.image.src;
    return { image: src ? (cache[src] || null) : null };
  }

  function assetsForCards(cards) {
    return cards.map(function (c) { return assetsFor(c); });
  }

  /** 選択中カードの画像を読み込んでから cb（書き出し用） */
  function waitForCard(card, cb) {
    var src = card && card.image && card.image.src;
    if (!src) { cb({ image: null }); return; }
    ensure(src, function (img) { cb({ image: img }); });
  }

  /** 全カードの画像を読み込んでから cb。読み込めなかったものは null のまま進む。 */
  function waitForCards(cards, cb) {
    var srcs = [];
    cards.forEach(function (c) {
      var s = c.image && c.image.src;
      if (s && srcs.indexOf(s) < 0) srcs.push(s);
    });
    if (!srcs.length) { cb(assetsForCards(cards)); return; }
    var remaining = srcs.length;
    srcs.forEach(function (s) {
      ensure(s, function () {
        remaining--;
        if (remaining === 0) cb(assetsForCards(cards));
      });
    });
  }

  /* ---------- 配置のクランプ ---------- */
  function clamp() {
    POPPresets.clampImage(cfg.getCard().image, cfg.getCardSize());
  }

  /* ---------- プレビュー上の操作 ---------- */
  /** シート表示中など、画像操作をさせたくないときに false にする */
  function setEnabled(v) {
    enabled = !!v;
    if (!enabled) cfg.canvas.style.cursor = 'default';
  }

  /* 現在の状態から画像の矩形（プレビュー canvas のバッキングpx）を得る */
  function rectPx() {
    var im = cfg.getCard().image;
    var size = cfg.getCardSize();
    var s = cfg.canvas.width / size.w;              /* バッキングpx / mm */
    var w = im.wMm * s;
    var h = (im.wMm / (im.aspect || 1)) * s;
    return { x: (im.xMm || 0) * s, y: (im.yMm || 0) * s, w: w, h: h, s: s };
  }

  /* 選択枠＋四隅ハンドルをプレビューに重ね描き（書き出しには出さない） */
  function drawHandles() {
    if (!enabled) return;
    var im = cfg.getCard().image;
    if (!im || !im.src || !(im.wMm > 0)) return;
    var ctx = cfg.ctx;
    var r = rectPx();
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.strokeStyle = '#2b6cb0';
    ctx.lineWidth = Math.max(1, r.s * 0.4);
    ctx.setLineDash([r.s * 1.6, r.s * 1.2]);
    ctx.strokeRect(r.x, r.y, r.w, r.h);
    ctx.setLineDash([]);
    var hs = Math.max(7, r.s * 3);                  /* ハンドル一辺（バッキングpx） */
    [[r.x, r.y], [r.x + r.w, r.y], [r.x, r.y + r.h], [r.x + r.w, r.y + r.h]].forEach(function (c) {
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.rect(c[0] - hs / 2, c[1] - hs / 2, hs, hs);
      ctx.fill();
      ctx.stroke();
    });
    ctx.restore();
  }

  /* ポインタ座標 → mm（カード左上基準） */
  function eventToMm(ev) {
    var rect = cfg.canvas.getBoundingClientRect();
    var size = cfg.getCardSize();
    return {
      x: (ev.clientX - rect.left) / rect.width * size.w,
      y: (ev.clientY - rect.top) / rect.height * size.h
    };
  }

  /* mm 座標が画像のどこに当たるか（四隅ハンドル / 内部 / 外） */
  function hitTest(mm) {
    var im = cfg.getCard().image;
    if (!im || !im.src || !(im.wMm > 0)) return null;
    var hMm = im.wMm / (im.aspect || 1);
    var size = cfg.getCardSize();
    var tol = Math.max(size.w, size.h) * 0.035 + 2;     /* 指でも掴める余裕 */
    var corners = {
      tl: [im.xMm, im.yMm], tr: [im.xMm + im.wMm, im.yMm],
      bl: [im.xMm, im.yMm + hMm], br: [im.xMm + im.wMm, im.yMm + hMm]
    };
    for (var key in corners) {
      if (Math.abs(mm.x - corners[key][0]) < tol && Math.abs(mm.y - corners[key][1]) < tol) {
        return { type: 'corner', corner: key };
      }
    }
    if (mm.x >= im.xMm && mm.x <= im.xMm + im.wMm && mm.y >= im.yMm && mm.y <= im.yMm + hMm) {
      return { type: 'inside' };
    }
    return null;
  }

  function onPointerDown(ev) {
    if (!enabled) return;
    var mm = eventToMm(ev);
    var hit = hitTest(mm);
    if (!hit) return;
    ev.preventDefault();
    try { cfg.canvas.setPointerCapture(ev.pointerId); } catch (e) { /* noop */ }
    var im = cfg.getCard().image;
    if (hit.type === 'corner') {
      var hMm = im.wMm / (im.aspect || 1);
      var left = hit.corner.indexOf('l') >= 0, top = hit.corner.indexOf('t') >= 0;
      /* 反対側の角を固定点（anchor）にしてアスペクト維持リサイズ */
      drag = { mode: 'resize', left: left, top: top,
               anchor: { x: left ? im.xMm + im.wMm : im.xMm, y: top ? im.yMm + hMm : im.yMm } };
    } else {
      drag = { mode: 'move', dx: mm.x - im.xMm, dy: mm.y - im.yMm };
    }
  }

  function onPointerMove(ev) {
    if (!enabled) return;
    if (!drag) { updateCursor(ev); return; }
    ev.preventDefault();
    var im = cfg.getCard().image, mm = eventToMm(ev);
    if (drag.mode === 'move') {
      im.xMm = mm.x - drag.dx;
      im.yMm = mm.y - drag.dy;
    } else {
      var dxMm = Math.abs(mm.x - drag.anchor.x);
      var dyMm = Math.abs(mm.y - drag.anchor.y);
      var newW = Math.max(10, Math.min(600, Math.max(dxMm, dyMm * (im.aspect || 1))));
      var newH = newW / (im.aspect || 1);
      im.wMm = newW;
      im.xMm = drag.left ? drag.anchor.x - newW : drag.anchor.x;
      im.yMm = drag.top ? drag.anchor.y - newH : drag.anchor.y;
    }
    clamp();
    cfg.onChange();
  }

  function endDrag(ev) {
    if (!drag) return;
    drag = null;
    try { cfg.canvas.releasePointerCapture(ev.pointerId); } catch (e) { /* noop */ }
    cfg.onChange();
  }

  function updateCursor(ev) {
    if (!enabled) { cfg.canvas.style.cursor = 'default'; return; }
    var hit = hitTest(eventToMm(ev));
    cfg.canvas.style.cursor = !hit ? 'default'
      : (hit.type === 'corner'
          ? (hit.corner === 'tl' || hit.corner === 'br' ? 'nwse-resize' : 'nesw-resize')
          : 'move');
  }

  /* ---------- 取り込み ----------
     カードの大きさに必要な解像度まで落として保存容量を抑える。 */
  function importFile(file) {
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      var im = new Image();
      im.onload = function () {
        var size = cfg.getCardSize();
        var maxSide = POPPresets.imageMaxSide(size);
        var sc = Math.min(1, maxSide / Math.max(im.naturalWidth, im.naturalHeight));
        var cw = Math.max(1, Math.round(im.naturalWidth * sc));
        var ch = Math.max(1, Math.round(im.naturalHeight * sc));
        var c = document.createElement('canvas');
        c.width = cw; c.height = ch;
        c.getContext('2d').drawImage(im, 0, 0, cw, ch);
        var isPng = /image\/png/i.test(file.type || '');
        var dataUrl;
        try { dataUrl = isPng ? c.toDataURL('image/png') : c.toDataURL('image/jpeg', 0.9); }
        catch (e) { cfg.setStatus('画像を読み込めませんでした', true); return; }
        var aspect = cw / ch;
        var wMm = Math.round(size.w * 0.6);
        cfg.getCard().image = {
          src: dataUrl, aspect: aspect, wMm: wMm,
          xMm: Math.round((size.w - wMm) / 2),
          yMm: Math.round((size.h - wMm / aspect) / 2),
          opacity: 1, layer: 'back'
        };
        ensure(dataUrl, function () { cfg.onChange(); });
        cfg.setStatus('画像を追加しました', true);
      };
      im.onerror = function () { cfg.setStatus('画像を読み込めませんでした', true); };
      im.src = String(reader.result);
    };
    reader.onerror = function () { cfg.setStatus('ファイルを読めませんでした', true); };
    reader.readAsDataURL(file);
  }

  function clear() {
    cfg.getCard().image = POPPresets.defaultCardState().image;
    cfg.canvas.style.cursor = 'default';
    cfg.onChange();
    cfg.setStatus('画像を削除しました', true);
  }

  function init(o) {
    cfg = o;
    o.canvas.addEventListener('pointerdown', onPointerDown);
    o.canvas.addEventListener('pointermove', onPointerMove);
    o.canvas.addEventListener('pointerup', endDrag);
    o.canvas.addEventListener('pointercancel', endDrag);
  }

  return {
    init: init,
    ensure: ensure,
    assetsFor: assetsFor,
    assetsForCards: assetsForCards,
    waitForCard: waitForCard,
    waitForCards: waitForCards,
    clamp: clamp,
    setEnabled: setEnabled,
    drawHandles: drawHandles,
    importFile: importFile,
    clear: clear
  };
})();
