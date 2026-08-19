/* ===========================================================
   操作パネルの組み立て（文字設定タブ・用紙/カードの選択肢・テンプレート一覧）
   状態は持たず、DOM を組み立てるだけの層。
   =========================================================== */
var POPPanelsUI = (function () {
  'use strict';

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

  function buildCardOptions() {
    document.getElementById('card-select').innerHTML =
      POPPresets.CARD_SIZES.map(function (c) {
        return '<option value="' + c.id + '">' + c.label + '</option>';
      }).join('');
  }

  function buildTemplates() {
    document.getElementById('template-list').innerHTML = POPPresets.TEMPLATES.map(function (t) {
      return '<button type="button" class="template" data-template="' + t.id + '">' +
        '<span class="template__swatch" style="background:' + t.swatchBg + ';color:' + t.swatchFg + '">￥298</span>' +
        '<span class="template__name">' + t.name + '</span></button>';
    }).join('');
  }

  /** 起動時に一度だけ呼び、パネルを組み立てる */
  function build() {
    buildTextPanels();
    buildPaperOptions();
    buildCardOptions();
    buildTemplates();
  }

  return {
    TEXT_FIELDS: TEXT_FIELDS,
    build: build,
    selectTab: selectTab
  };
})();
