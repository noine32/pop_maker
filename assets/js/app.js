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
    document.getElementById('paper-select').innerHTML = POPPresets.PAPERS.map(function (p) {
      return '<option value="' + p.id + '">' + p.label + '</option>';
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
    var result = POPRenderer.draw(ctx, state, canvas.width / size.w);

    var paper = POPPresets.papersById[state.paper.id];
    metaEl.textContent = (paper ? paper.label.replace(/（.*/, '') : '') +
      ' / ' + size.w + '×' + size.h + 'mm / ' +
      (state.paper.orientation === 'landscape' ? '横' : '縦');

    if (result.overflow) setStatus('内容が用紙に収まりきりません。文字サイズを下げてください。');
    else if (result.fontScale < 0.999) setStatus('自動縮小中（' + Math.round(result.fontScale * 100) + '%）');
    else setStatus('');

    ensureFontsThenRerender();
    POPStorage.saveAuto(state);
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
    /* 描画前にフォントの読み込みを待つ */
    POPFonts.ensureAll(POPRenderer.usedFonts(state)).then(function () {
      var cv = POPRenderer.renderToCanvas(state, dpi);
      var done = function (blob) {
        POPStorage.download(blob, safeFileName() + '_' + dpi + 'dpi.png');
        setStatus('PNGを保存しました', true);
      };
      if (cv.toBlob) cv.toBlob(function (b) { if (b) done(b); }, 'image/png');
      else {
        var data = cv.toDataURL('image/png').split(',')[1];
        var bin = atob(data), arr = new Uint8Array(bin.length);
        for (var i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
        done(new Blob([arr], { type: 'image/png' }));
      }
    });
  }

  function printPop() {
    setStatus('印刷を準備中…');
    POPFonts.ensureAll(POPRenderer.usedFonts(state)).then(function () {
      var size = POPPresets.paperSize(state);
      var url = POPRenderer.renderToCanvas(state, 300).toDataURL('image/png');

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
