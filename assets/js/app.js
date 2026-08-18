/* ===========================================================
   画面の組み立てとイベント処理
   =========================================================== */
(function () {
  'use strict';

  /* ---------- 状態 ---------- */
  /* ドキュメント（カード集）と、選択中カードへの参照。
     state を参照のまま残すことで、既存の編集パネル・イベント配線が
     そのまま「選択中のカード」に効く。 */
  var doc = POPDoc.sampleDoc();
  var state = POPDoc.activeCard(doc);
  var autosaveWarned = false;

  function cardSizeMm() { return POPPresets.cardSize(doc.card); }

  /** カードごとの画像アセット（今読み込めているぶんだけ） */
  function assetsByCard() { return POPImageTool.assetsForCards(doc.cards); }

  function selectCard(index) {
    doc.activeIndex = Math.max(0, Math.min(index, doc.cards.length - 1));
    state = POPDoc.activeCard(doc);
    refreshAll();
  }

  /** 読み込んだ1カードぶんのデザインを選択中カードへ適用する（プリセット読込用） */
  function applyCardState(cardState) {
    var base = POPPresets.defaultCardState();
    POPDoc.mergeDeep(base, cardState);
    delete base.paper;                 /* 旧プリセットは paper を持つ場合がある */
    doc.cards[doc.activeIndex] = base;
    state = POPDoc.activeCard(doc);
    POPImageTool.clamp();
    refreshAll();
  }

  /* 画面全体を現在の doc に合わせ直す。Task 7 でカード一覧の更新が加わる。 */
  function refreshAll() {
    syncUI();
    requestRender();
  }

  var canvas = document.getElementById('canvas');
  var ctx = canvas.getContext('2d');
  var stage = document.getElementById('preview-stage');
  var metaEl = document.getElementById('preview-meta');
  var statusEl = document.getElementById('status');

  /* ---------- オブジェクトのパス操作 ---------- */
  function getPath(obj, path) {
    var keys = path.split('.');
    var cur = obj;
    for (var i = 0; i < keys.length; i++) {
      if (cur === null || cur === undefined) return undefined;
      cur = cur[keys[i]];
    }
    return cur;
  }

  function setPath(obj, path, value) {
    var keys = path.split('.');
    var cur = obj;
    for (var i = 0; i < keys.length - 1; i++) {
      if (typeof cur[keys[i]] !== 'object' || cur[keys[i]] === null) cur[keys[i]] = {};
      cur = cur[keys[i]];
    }
    cur[keys[keys.length - 1]] = value;
  }

  /* 既定値に読み込んだデータを重ねる（項目が欠けていても壊れないように）。
     不正な JSON（セクションが null / 型違いのスカラー）でも既定オブジェクトを
     壊さない＝以後の描画クラッシュ・操作不能を防ぐ。 */
  function mergeDeep(base, patch) {
    if (!patch || typeof patch !== 'object') return base;
    Object.keys(patch).forEach(function (k) {
      /* プロトタイプ汚染対策：JSON.parse は __proto__ を列挙可能キーとして作るため、
         base["__proto__"](=Object.prototype)への書き込みを防ぐ。 */
      if (k === '__proto__' || k === 'constructor' || k === 'prototype') return;
      var v = patch[k];
      var baseIsObj = base[k] && typeof base[k] === 'object' && !Array.isArray(base[k]);
      var vIsObj = v && typeof v === 'object' && !Array.isArray(v);
      if (vIsObj && baseIsObj) {
        mergeDeep(base[k], v);
      } else if (baseIsObj) {
        /* 既定がオブジェクトの枠は null・スカラーで上書きしない（既定を維持） */
        return;
      } else if (v !== undefined && v !== null) {
        base[k] = v;
      }
    });
    return base;
  }

  /* ---------- 文字設定パネルの生成 ---------- */
  var TEXT_FIELDS = [
    { key: 'name',  label: '商品名',        min: 10, max: 300, lh: true },
    { key: 'catch', label: 'キャッチコピー', min: 8,  max: 150, lh: true },
    { key: 'price', label: '価格',          min: 12, max: 400, lh: false, isPrice: true },
    { key: 'desc',  label: '説明文',        min: 6,  max: 120, lh: true },
    { key: 'note',  label: '注記・店名',    min: 6,  max: 80,  lh: true }
  ];

  function fontOptions() {
    return POPFonts.LIST.map(function (f) {
      return '<option value="' + f.id + '">' + f.label + '</option>';
    }).join('');
  }

  function buildTextPanels() {
    var html = TEXT_FIELDS.map(function (f, idx) {
      var k = f.key;
      var parts = [];
      parts.push('<div class="tabpanel' + (idx === 0 ? ' is-active' : '') +
        '" id="panel-' + k + '" role="tabpanel" aria-labelledby="tab-' + k + '" tabindex="0" data-panel="' + k + '">');

      parts.push(
        '<label class="field"><span class="field__label">' + f.label + 'のフォント</span>' +
        '<select class="control" data-path="' + k + '.font">' + fontOptions() + '</select></label>' +
        '<div class="btnrow"><button type="button" class="btn btn--sm" data-apply-font="' + k + '">' +
        'このフォントを他の項目にも適用</button></div>'
      );

      parts.push(
        '<label class="field"><span class="field__label">文字サイズ ' +
        '<output class="field__out" data-out="' + k + '.size"></output> pt</span>' +
        '<div class="btnrow">' +
        '<input type="range" class="control control--range" min="' + f.min + '" max="' + f.max + '" step="1" data-path="' + k + '.size">' +
        '<input type="number" class="control" style="max-width:82px" min="' + f.min + '" max="' + f.max + '" step="1" data-path="' + k + '.size">' +
        '</div></label>'
      );

      parts.push(
        '<div class="grid grid--2">' +
        '<label class="field"><span class="field__label">文字の太さ</span>' +
        '<select class="control" data-path="' + k + '.weight">' +
        '<option value="400">標準</option><option value="700">太字</option><option value="900">極太</option>' +
        '</select></label>' +
        '<label class="field"><span class="field__label">文字色</span>' +
        '<input type="color" class="control control--color" data-path="' + k + '.color"></label>' +
        '</div>'
      );

      if (f.lh) {
        parts.push(
          '<label class="field"><span class="field__label">行間 ' +
          '<output class="field__out" data-out="' + k + '.lineHeight"></output></span>' +
          '<input type="range" class="control control--range" min="1" max="2.6" step="0.05" data-path="' + k + '.lineHeight"></label>'
        );
      }

      if (f.isPrice) {
        parts.push(
          '<label class="check"><input type="checkbox" data-path="price.comma">' +
          '<span>3桁ごとにカンマを入れる（1,280）</span></label>' +
          '<p class="field__hint">「¥」「円」「（税込）」は価格の文字サイズに連動して自動調整されます。</p>'
        );
      }

      parts.push('</div>');
      return parts.join('');
    }).join('');

    document.getElementById('text-panels').innerHTML = html;
  }

  /* タブ選択（クラス・aria-selected・roving tabindex を同期。focus指定でフォーカス移動） */
  function selectTab(key, focus) {
    var tabs = document.querySelectorAll('#text-tabs .tab');
    for (var i = 0; i < tabs.length; i++) {
      var t = tabs[i], on = t.getAttribute('data-tab') === key;
      t.classList.toggle('is-active', on);
      t.setAttribute('aria-selected', on ? 'true' : 'false');
      t.tabIndex = on ? 0 : -1;
      if (on && focus) t.focus();
    }
    var panels = document.querySelectorAll('.tabpanel');
    for (var j = 0; j < panels.length; j++) {
      panels[j].classList.toggle('is-active', panels[j].getAttribute('data-panel') === key);
    }
  }

  /* ---------- 用紙・テンプレートの生成 ---------- */
  function buildPaperOptions() {
    var groups = {}, order = [];
    POPPresets.PAPERS.forEach(function (p) {
      var g = p.group || 'その他';
      if (!groups[g]) { groups[g] = []; order.push(g); }
      groups[g].push(p);
    });
    document.getElementById('paper-select').innerHTML = order.map(function (g) {
      var opts = groups[g].map(function (p) {
        return '<option value="' + p.id + '">' + p.label + '</option>';
      }).join('');
      return '<optgroup label="' + g + '">' + opts + '</optgroup>';
    }).join('');
  }

  function buildTemplates() {
    document.getElementById('template-list').innerHTML = POPPresets.TEMPLATES.map(function (t) {
      return '<button type="button" class="template" data-template="' + t.id + '">' +
        '<span class="template__swatch" style="background:' + t.swatchBg + ';color:' + t.swatchFg + '">￥298</span>' +
        '<span class="template__name">' + t.name + '</span></button>';
    }).join('');
  }

  /* ---------- 入力欄 ⇔ 状態 ---------- */
  function parseValue(el) {
    if (el.type === 'checkbox') return el.checked;
    if (el.type === 'range' || el.type === 'number') {
      /* 空欄・不正はそのフィールドの min（無ければ0）へ。size=0 で文字が潰れるのを防ぐ。
         min/max があれば範囲内へクランプする。 */
      var min = el.min !== '' ? Number(el.min) : null;
      var max = el.max !== '' ? Number(el.max) : null;
      if (el.value === '' || isNaN(Number(el.value))) {
        return (min !== null && !isNaN(min)) ? min : 0;
      }
      var n = Number(el.value);
      if (min !== null && !isNaN(min) && n < min) n = min;
      if (max !== null && !isNaN(max) && n > max) n = max;
      return n;
    }
    if (el.tagName === 'SELECT' && /^(400|700|900)$/.test(el.value)) return Number(el.value);
    return el.value;
  }

  function syncUI() {
    var inputs = document.querySelectorAll('[data-path]');
    for (var i = 0; i < inputs.length; i++) {
      var el = inputs[i];
      if (el === document.activeElement &&
          (el.type === 'text' || el.type === 'number' || el.tagName === 'TEXTAREA')) continue;
      var v = getPath(state, el.getAttribute('data-path'));
      if (el.type === 'checkbox') el.checked = !!v;
      else el.value = (v === undefined || v === null) ? '' : v;
    }

    var outs = document.querySelectorAll('[data-out]');
    for (var j = 0; j < outs.length; j++) {
      var val = getPath(state, outs[j].getAttribute('data-out'));
      outs[j].textContent = (typeof val === 'number') ? String(Math.round(val * 100) / 100) : String(val || '');
    }

    /* カード/シートの設定は doc 側にあるので data-doc-path で別に同期する */
    var docInputs = document.querySelectorAll('[data-doc-path]');
    for (var d = 0; d < docInputs.length; d++) {
      var de = docInputs[d];
      if (de === document.activeElement &&
          (de.type === 'text' || de.type === 'number')) continue;
      var dv = getPath(doc, de.getAttribute('data-doc-path'));
      if (de.type === 'checkbox') de.checked = !!dv;
      else de.value = (dv === undefined || dv === null) ? '' : dv;
    }

    var cardCustom = document.getElementById('card-custom-size');
    if (cardCustom) cardCustom.hidden = doc.card.id !== 'custom';
    var sheetCustom = document.getElementById('custom-size');
    if (sheetCustom) sheetCustom.hidden = doc.sheet.id !== 'custom';

    var imgCtl = document.getElementById('image-controls');
    if (imgCtl) imgCtl.hidden = !(state.image && state.image.src);

    var tpl = document.querySelectorAll('[data-template]');
    for (var t = 0; t < tpl.length; t++) {
      tpl[t].classList.toggle('is-active', tpl[t].getAttribute('data-template') === state.template);
    }
  }

  /* ---------- 描画 ---------- */
  var rafId = null;
  var ensured = {};

  function requestRender() {
    if (rafId) return;
    rafId = requestAnimationFrame(function () {
      rafId = null;
      render();
    });
  }

  function render() {
    var size = cardSizeMm();
    var stageW = Math.max(120, stage.clientWidth - 44);
    var maxH = Math.max(260, window.innerHeight - 230);
    var dispW = Math.min(stageW, maxH * (size.w / size.h), 660);
    var dispH = dispW * (size.h / size.w);
    var dpr = Math.min(window.devicePixelRatio || 1, 2.5);

    canvas.style.width = dispW + 'px';
    canvas.style.height = dispH + 'px';
    canvas.width = Math.round(dispW * dpr);
    canvas.height = Math.round(dispH * dpr);

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    var assets = POPImageTool.assetsFor(state);
    var result = POPRenderer.draw(ctx, state, canvas.width / size.w, assets, size);
    POPImageTool.drawHandles();   /* 画像の選択枠＋四隅ハンドル（プレビューのみ） */

    var sheet = POPPresets.sheetSize(doc.sheet);
    var L = POPSheetView.layoutOf(doc);
    var pages = POPSheetView.pagesOf(doc);
    metaEl.textContent =
      'カード ' + size.w + '×' + size.h + 'mm / ' +
      (L.perPage > 0 ? sheet.w + '×' + sheet.h + 'mm に ' + L.perPage + '枚' : '配置できません') +
      ' / カード' + doc.cards.length + '枚・全' + pages + 'ページ';

    /* スクリーンリーダー向けに現在の内容を要約 */
    canvas.setAttribute('aria-label',
      '商品ポップのプレビュー：商品名「' + (String(state.name.text || '').trim() || '未入力') +
      '」／価格 ' + (String(state.price.value || '').trim() || '未入力'));

    if (result.overflow) setStatus('内容が用紙に収まりきりません。文字サイズを下げてください。');
    else if (result.fontScale < 0.999) setStatus('自動縮小中（' + Math.round(result.fontScale * 100) + '%）');
    else setStatus('');

    ensureImageThenRerender();
    ensureFontsThenRerender();

    var saved = POPStorage.saveAuto(doc);
    if (!saved && !autosaveWarned) {
      autosaveWarned = true;
      var imgCount = doc.cards.filter(function (c) { return c.image && c.image.src; }).length;
      setStatus('カード' + doc.cards.length + '枚・画像' + imgCount +
                '点のため自動保存できません。「データ保存」で書き出せます', true);
    }
  }

  /* 画像が未ロードなら読み込んでから描き直す */
  function ensureImageThenRerender() {
    var src = state.image && state.image.src;
    if (!src) return;
    POPImageTool.ensure(src, function () { requestRender(); });
  }

  /* 使用中のWebフォントが未読み込みなら読み込んでから描き直す */
  function ensureFontsThenRerender() {
    var specs = POPRenderer.usedFonts(state);
    var pending = specs.filter(function (s) {
      var f = POPFonts.byId[s.font];
      if (!f || !f.web) return false;
      return !ensured[s.font + '|' + s.weight];
    });
    if (!pending.length) return;
    pending.forEach(function (s) { ensured[s.font + '|' + s.weight] = true; });
    POPFonts.ensureAll(pending).then(function () { requestRender(); });
  }

  var statusTimer = null;
  function setStatus(msg, temporary) {
    statusEl.textContent = msg;
    if (statusTimer) { clearTimeout(statusTimer); statusTimer = null; }
    if (msg && temporary) statusTimer = setTimeout(function () { statusEl.textContent = ''; }, 2500);
  }

  /* ---------- テンプレート適用 ---------- */
  function applyTemplate(id) {
    var t = POPPresets.templatesById[id];
    if (!t) return;
    state.template = id;
    mergeDeep(state, JSON.parse(JSON.stringify(t.apply)));
    syncUI();
    requestRender();
  }

  /* ---------- 出力 ---------- */
  function safeFileName() {
    var base = String(state.name.text || 'pop').replace(/[\\/:*?"<>|\s\n]+/g, '_').slice(0, 40);
    return (base || 'pop');
  }

  function exportPng() {
    var dpi = Number(document.getElementById('export-dpi').value) || 300;
    setStatus('画像を作成中…');
    /* 描画前にフォント・画像の読み込みを待つ */
    POPFonts.ensureAll(POPRenderer.usedFonts(state)).then(function () {
     POPImageTool.waitForCard(state, function (assets) {
      var cv = POPRenderer.renderToCanvas(state, dpi, assets, cardSizeMm());
      var done = function (blob) {
        POPStorage.download(blob, safeFileName() + '_' + dpi + 'dpi.png');
        setStatus('PNGを保存しました', true);
      };
      var fail = function () {
        setStatus('画像を作成できませんでした。解像度を下げるか用紙を小さくしてお試しください', true);
      };
      /* dataURL 経由の書き出し（toBlob 非対応 or null 時のフォールバック） */
      var viaDataUrl = function () {
        try {
          var data = cv.toDataURL('image/png').split(',')[1];
          if (!data) { fail(); return; }
          var bin = atob(data), arr = new Uint8Array(bin.length);
          for (var i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
          done(new Blob([arr], { type: 'image/png' }));
        } catch (e) { fail(); }
      };
      if (cv.toBlob) {
        /* 大きい用紙×高dpi では canvas 面積上限で b が null になり得る＝
           握り潰さず dataURL にフォールバックし、それも駄目なら失敗を通知する */
        cv.toBlob(function (b) { if (b) done(b); else viaDataUrl(); }, 'image/png');
      } else {
        viaDataUrl();
      }
     });
    });
  }

  function printPop() {
    setStatus('印刷を準備中…');
    POPFonts.ensureAll(POPRenderer.usedFonts(state)).then(function () {
     POPImageTool.waitForCard(state, function (assets) {
      var size = cardSizeMm();
      var url = POPRenderer.renderToCanvas(state, 300, assets, size).toDataURL('image/png');

      var frame = document.createElement('iframe');
      frame.setAttribute('aria-hidden', 'true');
      frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
      document.body.appendChild(frame);

      var doc = frame.contentWindow.document;
      doc.open();
      doc.write(
        '<!DOCTYPE html><html><head><meta charset="utf-8"><title>' + safeFileName() + '</title><style>' +
        '@page{size:' + size.w + 'mm ' + size.h + 'mm;margin:0}' +
        'html,body{margin:0;padding:0}' +
        'img{width:' + size.w + 'mm;height:' + size.h + 'mm;display:block}' +
        '</style></head><body><img id="pop" alt=""></body></html>'
      );
      doc.close();

      var img = doc.getElementById('pop');
      var go = function () {
        try {
          frame.contentWindow.focus();
          frame.contentWindow.print();
          setStatus('印刷ダイアログを開きました', true);
        } catch (e) {
          setStatus('印刷を開始できませんでした', true);
        }
        setTimeout(function () {
          if (frame.parentNode) frame.parentNode.removeChild(frame);
        }, 1500);
      };
      img.onload = go;
      img.onerror = go;
      img.src = url;
     });
    });
  }

  /* ---------- イベント ---------- */
  function bindEvents() {
    /* 入力欄 → 状態 */
    document.addEventListener('input', onFieldChange);
    document.addEventListener('change', onFieldChange);

    function onFieldChange(ev) {
      var el = ev.target;
      if (!el || !el.getAttribute) return;

      var docPath = el.getAttribute('data-doc-path');
      if (docPath) {
        setPath(doc, docPath, parseValue(el));
        onDocChange(docPath);
        return;
      }

      var path = el.getAttribute('data-path');
      if (!path) return;
      setPath(state, path, parseValue(el));
      if (path.indexOf('image.') === 0) POPImageTool.clamp();  /* 幅・X・Y の直接入力もクランプ */
      refreshAll();
    }

    /* カード/シート設定が変わったときの後処理。Task 10 で比例スケールが加わる。 */
    function onDocChange(docPath) {
      doc.sheet.margin = Math.max(0, Math.min(30, Number(doc.sheet.margin) || 0));
      doc.sheet.gap = Math.max(0, Math.min(20, Number(doc.sheet.gap) || 0));
      if (docPath.indexOf('card.') === 0 && doc.card.id === 'custom') {
        var c = POPPresets.clampCustomCard(doc.card, doc.sheet);
        doc.card.customW = c.customW;
        doc.card.customH = c.customH;
      }
      POPImageTool.clamp();
      refreshAll();
    }

    /* タブ切り替え（クリック＋キーボード：←→ Home End） */
    var tablist = document.getElementById('text-tabs');
    tablist.addEventListener('click', function (ev) {
      var btn = ev.target.closest('[data-tab]');
      if (btn) selectTab(btn.getAttribute('data-tab'), false);
    });
    tablist.addEventListener('keydown', function (ev) {
      if (ev.key !== 'ArrowLeft' && ev.key !== 'ArrowRight' && ev.key !== 'Home' && ev.key !== 'End') return;
      var tabs = tablist.querySelectorAll('.tab');
      var n = tabs.length, cur = 0;
      for (var i = 0; i < n; i++) { if (tabs[i].getAttribute('aria-selected') === 'true') { cur = i; break; } }
      var next = cur;
      if (ev.key === 'ArrowLeft') next = (cur - 1 + n) % n;
      else if (ev.key === 'ArrowRight') next = (cur + 1) % n;
      else if (ev.key === 'Home') next = 0;
      else if (ev.key === 'End') next = n - 1;
      ev.preventDefault();
      selectTab(tabs[next].getAttribute('data-tab'), true);
    });

    /* テンプレート */
    document.getElementById('template-list').addEventListener('click', function (ev) {
      var btn = ev.target.closest('[data-template]');
      if (btn) applyTemplate(btn.getAttribute('data-template'));
    });

    /* フォントの一括適用・全体サイズ調整 */
    document.addEventListener('click', function (ev) {
      var el = ev.target.closest ? ev.target.closest('[data-apply-font],[data-scale-all]') : null;
      if (!el) return;

      if (el.hasAttribute('data-apply-font')) {
        var src = el.getAttribute('data-apply-font');
        var font = state[src].font;
        TEXT_FIELDS.forEach(function (f) { state[f.key].font = font; });
        setStatus('フォントをすべての項目に適用しました', true);
      } else {
        var k = Number(el.getAttribute('data-scale-all'));
        TEXT_FIELDS.forEach(function (f) {
          var v = Math.round(state[f.key].size * k);
          state[f.key].size = Math.min(f.max, Math.max(f.min, v));
        });
        state.badge.size = Math.min(80, Math.max(8, Math.round(state.badge.size * k)));
      }
      syncUI();
      requestRender();
    });

    /* 画像：追加・削除・ファイル選択 */
    document.getElementById('btn-image-add').addEventListener('click', function () {
      document.getElementById('file-image').click();
    });
    document.getElementById('file-image').addEventListener('change', function (ev) {
      var file = ev.target.files && ev.target.files[0];
      autosaveWarned = false;
      POPImageTool.importFile(file);
      ev.target.value = '';
    });
    document.getElementById('btn-image-del').addEventListener('click', function () {
      autosaveWarned = false;
      POPImageTool.clear();
    });

    /* 書き出し */
    document.getElementById('btn-png').addEventListener('click', exportPng);
    document.getElementById('btn-print').addEventListener('click', printPop);

    document.getElementById('btn-save-json').addEventListener('click', function () {
      POPStorage.exportJson(doc, safeFileName() + '.json');
      setStatus('データを保存しました', true);
    });

    document.getElementById('btn-load-json').addEventListener('click', function () {
      document.getElementById('file-json').click();
    });

    document.getElementById('file-json').addEventListener('change', function (ev) {
      var file = ev.target.files && ev.target.files[0];
      if (!file) return;
      POPStorage.readJsonFile(file).then(function (data) {
        var loaded = POPDoc.migrate(data);
        if (!loaded) { setStatus('読み込めるデータではありません', true); return; }
        doc = loaded;
        state = POPDoc.activeCard(doc);
        autosaveWarned = false;
        refreshAll();
        setStatus('データを読み込みました', true);
      }).catch(function (e) {
        setStatus(e.message, true);
      });
      ev.target.value = '';
    });

    document.getElementById('btn-reset').addEventListener('click', function () {
      if (!confirm('入力内容をすべて初期状態に戻します。よろしいですか？')) return;
      doc = POPDoc.defaultDoc();
      state = POPDoc.activeCard(doc);
      POPStorage.clearAuto();
      autosaveWarned = false;
      refreshAll();
      setStatus('リセットしました', true);
    });

    /* リサイズで再描画 */
    var resizeTimer = null;
    window.addEventListener('resize', function () {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(requestRender, 120);
    });

    /* Webフォント読み込み完了で描き直す */
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () { requestRender(); });
    }
  }

  /* ---------- 起動 ---------- */
  function init() {
    buildTextPanels();
    buildPaperOptions();
    buildTemplates();

    /* ①新形式 → ②旧形式（単品）を移行 → ③サンプル の順に復元する */
    var restored = POPDoc.migrate(POPStorage.loadAuto());
    if (!restored) restored = POPDoc.migrate(POPStorage.loadLegacyAuto());
    doc = restored || POPDoc.sampleDoc();
    state = POPDoc.activeCard(doc);

    POPImageTool.init({
      canvas: canvas,
      ctx: ctx,
      getCard: function () { return state; },
      getCardSize: cardSizeMm,
      onChange: function () { refreshAll(); },
      setStatus: setStatus
    });
    POPPresetUI.init({
      getCard: function () { return state; },
      applyCard: applyCardState,
      setStatus: setStatus
    });

    bindEvents();
    syncUI();
    requestRender();

    if (!POPStorage.available) {
      setStatus('このブラウザでは自動保存が使えません（プライベートモードの可能性）');
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
