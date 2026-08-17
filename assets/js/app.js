/* ===========================================================
   画面の組み立てとイベント処理
   =========================================================== */
(function () {
  'use strict';

  /* ---------- 状態 ---------- */
  var state = POPPresets.sampleState();

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
      parts.push('<div class="tabpanel' + (idx === 0 ? ' is-active' : '') + '" data-panel="' + k + '">');

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
      var n = Number(el.value);
      return isNaN(n) ? 0 : n;
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

    document.getElementById('custom-size').hidden = state.paper.id !== 'custom';

    var imgCtl = document.getElementById('image-controls');
    if (imgCtl) imgCtl.hidden = !(state.image && state.image.src);

    var tpl = document.querySelectorAll('[data-template]');
    for (var t = 0; t < tpl.length; t++) {
      tpl[t].classList.toggle('is-active', tpl[t].getAttribute('data-template') === state.template);
    }
  }

  /* ---------- 画像（読み込みキャッシュ・フォントと同じ遅延ロード方式） ---------- */
  var imgCache = {};
  var imgLoading = {};
  var autosaveWarned = false;

  function ensureImage(src, cb) {
    if (!src) { if (cb) cb(null); return; }
    if (imgCache[src]) { if (cb) cb(imgCache[src]); return; }
    if (imgLoading[src]) return;      /* 二重ロード防止（onload 完了時に再描画される） */
    imgLoading[src] = true;
    var im = new Image();
    im.onload = function () { imgCache[src] = im; delete imgLoading[src]; if (cb) cb(im); };
    im.onerror = function () { delete imgLoading[src]; if (cb) cb(null); };
    im.src = src;
  }

  /* 書き出し用：画像が読み込めてから assets を渡す */
  function withAssets(cb) {
    var src = state.image && state.image.src;
    if (!src) { cb({ image: null }); return; }
    ensureImage(src, function (img) { cb({ image: img }); });
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
    var size = POPPresets.paperSize(state);
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
    var assets = { image: (state.image && state.image.src) ? (imgCache[state.image.src] || null) : null };
    var result = POPRenderer.draw(ctx, state, canvas.width / size.w, assets);
    drawImageHandles(size);   /* 画像の選択枠＋四隅ハンドル（プレビューのみ・書き出しには出ない） */

    var paper = POPPresets.papersById[state.paper.id];
    metaEl.textContent = (paper ? paper.label.replace(/（.*/, '') : '') +
      ' / ' + size.w + '×' + size.h + 'mm / ' +
      (state.paper.orientation === 'landscape' ? '横' : '縦');

    if (result.overflow) setStatus('内容が用紙に収まりきりません。文字サイズを下げてください。');
    else if (result.fontScale < 0.999) setStatus('自動縮小中（' + Math.round(result.fontScale * 100) + '%）');
    else setStatus('');

    ensureImageThenRerender();
    ensureFontsThenRerender();

    var saved = POPStorage.saveAuto(state);
    if (!saved && state.image && state.image.src && !autosaveWarned) {
      autosaveWarned = true;
      setStatus('画像が大きく自動保存できません。「データ保存」で書き出せます', true);
    }
  }

  /* 画像が未ロードなら読み込んでから描き直す */
  function ensureImageThenRerender() {
    var src = state.image && state.image.src;
    if (!src || imgCache[src]) return;
    ensureImage(src, function () { requestRender(); });
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
     withAssets(function (assets) {
      var cv = POPRenderer.renderToCanvas(state, dpi, assets);
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
     withAssets(function (assets) {
      var size = POPPresets.paperSize(state);
      var url = POPRenderer.renderToCanvas(state, 300, assets).toDataURL('image/png');

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

  /* ---------- 画像の配置・操作（プレビュー上でドラッグ移動／四隅リサイズ） ---------- */
  /* 現在の状態から画像の矩形（プレビュー canvas のバッキングpx）を得る */
  function imgRectPx(size) {
    var im = state.image;
    var s = canvas.width / size.w;                 /* バッキングpx / mm */
    var w = im.wMm * s;
    var h = (im.wMm / (im.aspect || 1)) * s;
    return { x: (im.xMm || 0) * s, y: (im.yMm || 0) * s, w: w, h: h, s: s };
  }

  /* 選択枠＋四隅ハンドルをプレビューに重ね描き（書き出しには出さない） */
  function drawImageHandles(size) {
    var im = state.image;
    if (!im || !im.src || !(im.wMm > 0)) return;
    var r = imgRectPx(size);
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

  /* ポインタ座標 → mm（用紙左上基準） */
  function eventToMm(ev) {
    var rect = canvas.getBoundingClientRect();
    var size = POPPresets.paperSize(state);
    return {
      x: (ev.clientX - rect.left) / rect.width * size.w,
      y: (ev.clientY - rect.top) / rect.height * size.h
    };
  }

  /* mm 座標が画像のどこに当たるか（四隅ハンドル / 内部 / 外） */
  function imageHitTest(mm) {
    var im = state.image;
    if (!im || !im.src || !(im.wMm > 0)) return null;
    var hMm = im.wMm / (im.aspect || 1);
    var size = POPPresets.paperSize(state);
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

  var imgDrag = null;

  function onImagePointerDown(ev) {
    var mm = eventToMm(ev);
    var hit = imageHitTest(mm);
    if (!hit) return;
    ev.preventDefault();
    try { canvas.setPointerCapture(ev.pointerId); } catch (e) { /* noop */ }
    var im = state.image;
    if (hit.type === 'corner') {
      var hMm = im.wMm / (im.aspect || 1);
      var left = hit.corner.indexOf('l') >= 0, top = hit.corner.indexOf('t') >= 0;
      /* 反対側の角を固定点（anchor）にしてアスペクト維持リサイズ */
      imgDrag = { mode: 'resize', left: left, top: top,
                  anchor: { x: left ? im.xMm + im.wMm : im.xMm, y: top ? im.yMm + hMm : im.yMm } };
    } else {
      imgDrag = { mode: 'move', dx: mm.x - im.xMm, dy: mm.y - im.yMm };
    }
  }

  function onImagePointerMove(ev) {
    if (!imgDrag) { updateImageCursor(ev); return; }
    ev.preventDefault();
    var im = state.image, mm = eventToMm(ev);
    if (imgDrag.mode === 'move') {
      im.xMm = mm.x - imgDrag.dx;
      im.yMm = mm.y - imgDrag.dy;
    } else {
      var dxMm = Math.abs(mm.x - imgDrag.anchor.x);
      var dyMm = Math.abs(mm.y - imgDrag.anchor.y);
      var newW = Math.max(10, Math.max(dxMm, dyMm * (im.aspect || 1)));
      var newH = newW / (im.aspect || 1);
      im.wMm = newW;
      im.xMm = imgDrag.left ? imgDrag.anchor.x - newW : imgDrag.anchor.x;
      im.yMm = imgDrag.top ? imgDrag.anchor.y - newH : imgDrag.anchor.y;
    }
    syncUI();
    requestRender();
  }

  function endImageDrag(ev) {
    if (!imgDrag) return;
    imgDrag = null;
    try { canvas.releasePointerCapture(ev.pointerId); } catch (e) { /* noop */ }
    requestRender();
  }

  function updateImageCursor(ev) {
    var hit = imageHitTest(eventToMm(ev));
    canvas.style.cursor = !hit ? 'default'
      : (hit.type === 'corner'
          ? (hit.corner === 'tl' || hit.corner === 'br' ? 'nwse-resize' : 'nesw-resize')
          : 'move');
  }

  /* 画像ファイルを取り込む（長辺2000pxに縮小して保存容量を抑える） */
  function importImageFile(file) {
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      var im = new Image();
      im.onload = function () {
        var maxSide = 2000;
        var sc = Math.min(1, maxSide / Math.max(im.naturalWidth, im.naturalHeight));
        var cw = Math.max(1, Math.round(im.naturalWidth * sc));
        var ch = Math.max(1, Math.round(im.naturalHeight * sc));
        var c = document.createElement('canvas');
        c.width = cw; c.height = ch;
        c.getContext('2d').drawImage(im, 0, 0, cw, ch);
        var isPng = /image\/png/i.test(file.type || '');
        var dataUrl;
        try { dataUrl = isPng ? c.toDataURL('image/png') : c.toDataURL('image/jpeg', 0.9); }
        catch (e) { setStatus('画像を読み込めませんでした', true); return; }
        var aspect = cw / ch;
        var size = POPPresets.paperSize(state);
        var wMm = Math.round(size.w * 0.6);
        state.image = {
          src: dataUrl, aspect: aspect, wMm: wMm,
          xMm: Math.round((size.w - wMm) / 2),
          yMm: Math.round((size.h - wMm / aspect) / 2),
          opacity: 1, layer: 'back'
        };
        autosaveWarned = false;
        ensureImage(dataUrl, function () { syncUI(); requestRender(); });
        setStatus('画像を追加しました', true);
      };
      im.onerror = function () { setStatus('画像を読み込めませんでした', true); };
      im.src = String(reader.result);
    };
    reader.onerror = function () { setStatus('ファイルを読めませんでした', true); };
    reader.readAsDataURL(file);
  }

  /* ---------- 保存済みデザイン ---------- */
  function renderPresetList() {
    var ul = document.getElementById('preset-list');
    var arr = POPStorage.listPresets();
    if (!arr.length) {
      ul.innerHTML = '<li class="presets__empty">保存されたデザインはありません</li>';
      return;
    }
    ul.innerHTML = arr.map(function (p) {
      var n = String(p.name).replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
      return '<li><span title="' + n + '">' + n + '</span>' +
        '<button type="button" class="btn btn--sm" data-preset-load="' + n + '">読込</button>' +
        '<button type="button" class="btn btn--sm btn--ghost" data-preset-del="' + n + '">削除</button></li>';
    }).join('');
  }

  /* ---------- イベント ---------- */
  function bindEvents() {
    /* 入力欄 → 状態 */
    document.addEventListener('input', onFieldChange);
    document.addEventListener('change', onFieldChange);

    function onFieldChange(ev) {
      var el = ev.target;
      if (!el || !el.getAttribute) return;
      var path = el.getAttribute('data-path');
      if (!path) return;
      setPath(state, path, parseValue(el));
      syncUI();
      requestRender();
    }

    /* タブ切り替え */
    document.getElementById('text-tabs').addEventListener('click', function (ev) {
      var btn = ev.target.closest('[data-tab]');
      if (!btn) return;
      var key = btn.getAttribute('data-tab');
      this.querySelectorAll('.tab').forEach(function (t) {
        t.classList.toggle('is-active', t === btn);
      });
      document.querySelectorAll('.tabpanel').forEach(function (p) {
        p.classList.toggle('is-active', p.getAttribute('data-panel') === key);
      });
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
      importImageFile(file);
      ev.target.value = '';
    });
    document.getElementById('btn-image-del').addEventListener('click', function () {
      state.image = POPPresets.defaultState().image;
      autosaveWarned = false;
      canvas.style.cursor = 'default';
      syncUI();
      requestRender();
      setStatus('画像を削除しました', true);
    });

    /* 画像：プレビュー上でドラッグ移動／四隅リサイズ（マウス・タッチ共通） */
    canvas.addEventListener('pointerdown', onImagePointerDown);
    canvas.addEventListener('pointermove', onImagePointerMove);
    canvas.addEventListener('pointerup', endImageDrag);
    canvas.addEventListener('pointercancel', endImageDrag);

    /* 書き出し */
    document.getElementById('btn-png').addEventListener('click', exportPng);
    document.getElementById('btn-print').addEventListener('click', printPop);

    document.getElementById('btn-save-json').addEventListener('click', function () {
      POPStorage.exportJson(state, safeFileName() + '.json');
      setStatus('データを保存しました', true);
    });

    document.getElementById('btn-load-json').addEventListener('click', function () {
      document.getElementById('file-json').click();
    });

    document.getElementById('file-json').addEventListener('change', function (ev) {
      var file = ev.target.files && ev.target.files[0];
      if (!file) return;
      POPStorage.readJsonFile(file).then(function (data) {
        state = mergeDeep(POPPresets.defaultState(), data);
        syncUI();
        requestRender();
        setStatus('データを読み込みました', true);
      }).catch(function (e) {
        setStatus(e.message, true);
      });
      ev.target.value = '';
    });

    document.getElementById('btn-reset').addEventListener('click', function () {
      if (!confirm('入力内容をすべて初期状態に戻します。よろしいですか？')) return;
      state = POPPresets.sampleState();
      POPStorage.clearAuto();
      syncUI();
      requestRender();
      setStatus('リセットしました', true);
    });

    /* 名前を付けて保存 */
    document.getElementById('btn-preset-save').addEventListener('click', function () {
      var input = document.getElementById('preset-name');
      /* 改行・連続空白を1つに正規化（HTML属性値の空白正規化で読込/削除がズレるのを防ぐ） */
      var fallback = String(state.name.text || '').replace(/\s+/g, ' ').trim().slice(0, 20);
      var name = input.value.replace(/\s+/g, ' ').trim() || fallback || '無題';
      POPStorage.savePreset(name, JSON.parse(JSON.stringify(state)));
      input.value = '';
      renderPresetList();
      setStatus('「' + name + '」を保存しました', true);
    });

    document.getElementById('preset-list').addEventListener('click', function (ev) {
      var loadBtn = ev.target.closest('[data-preset-load]');
      var delBtn = ev.target.closest('[data-preset-del]');
      if (loadBtn) {
        var name = loadBtn.getAttribute('data-preset-load');
        var found = POPStorage.listPresets().filter(function (p) { return p.name === name; })[0];
        if (found) {
          state = mergeDeep(POPPresets.defaultState(), found.state);
          syncUI();
          requestRender();
          setStatus('「' + name + '」を読み込みました', true);
        }
      } else if (delBtn) {
        POPStorage.deletePreset(delBtn.getAttribute('data-preset-del'));
        renderPresetList();
      }
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

    var saved = POPStorage.loadAuto();
    if (saved) state = mergeDeep(POPPresets.defaultState(), saved);

    bindEvents();
    renderPresetList();
    syncUI();
    requestRender();

    if (!POPStorage.available) {
      setStatus('このブラウザでは自動保存が使えません（プライベートモードの可能性）');
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
