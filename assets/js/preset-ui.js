/* ===========================================================
   保存済みデザインの棚（画面最上段）
   保存されるのは「見た目」だけ（テンプレート・色・フォント・枠線・大きさ）。
   文章は含めないので、棚のデザインを当てても入力した文字は消えない。
   =========================================================== */
var POPPresetUI = (function () {
  'use strict';

  var cfg = null;          /* { getCard, getCardPreset, applyCard, setStatus } */
  var selectedName = null; /* 棚で選択中のデザイン名（選択リングの表示用） */

  function esc(s) {
    return String(s === undefined || s === null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /** 棚のカードに出す説明（テンプレート名＋大きさ）。大きさは保存時のもの。 */
  function metaLabel(p) {
    var t = p.state && POPPresets.templatesById[p.state.template];
    var parts = [t ? t.name : 'カスタム'];
    if (p.card) {
      var size = POPPresets.cardSize(p.card);
      parts.push(size.w + '×' + size.h + 'mm');
    }
    return parts.join('・');
  }

  /** ミニプレビューの色。保存時の背景色とアクセント色をそのまま使う。 */
  function swatch(p) {
    var d = (p.state && p.state.design) || {};
    return { bg: d.bg || '#ffffff', fg: d.accent || '#333333' };
  }

  function render() {
    var ul = document.getElementById('preset-list');
    var arr = POPStorage.listPresets();
    if (!arr.length) {
      ul.innerHTML = '<li class="shelf__empty">まだ保存されたデザインはありません。' +
        '「デザインを作る」タブで見た目を決めて、ここに保存できます。</li>';
      return;
    }
    ul.innerHTML = arr.map(function (p) {
      var n = esc(p.name);
      var c = swatch(p);
      return '<li class="shelf__item' + (p.name === selectedName ? ' is-active' : '') + '">' +
        '<button type="button" class="shelf__card" data-preset-load="' + n + '"' +
        ' title="「' + n + '」の見た目を今のポップに当てる">' +
        '<span class="shelf__swatch" style="background:' + esc(c.bg) + ';color:' + esc(c.fg) + '">￥</span>' +
        '<span class="shelf__labels">' +
        '<span class="shelf__name">' + n + '</span>' +
        '<span class="shelf__meta">' + esc(metaLabel(p)) + '</span>' +
        '</span></button>' +
        '<button type="button" class="shelf__del" data-preset-del="' + n + '"' +
        ' aria-label="「' + n + '」を削除" title="削除">×</button>' +
        '</li>';
    }).join('');
  }

  /* 保存。名前は入力してもらう（同じ名前なら上書き）。 */
  function save() {
    var card = cfg.getCard();
    /* 改行・連続空白を1つに正規化（HTML属性値の空白正規化で読込/削除がズレるのを防ぐ） */
    var fallback = String(card.name.text || '').replace(/\s+/g, ' ').trim().slice(0, 20);
    var input = window.prompt('この見た目に名前を付けて保存します', fallback || '無題');
    if (input === null) return;                       /* キャンセル */
    var name = String(input).replace(/\s+/g, ' ').trim() || fallback || '無題';

    POPStorage.savePreset(name, POPDoc.designOf(card), cfg.getCardPreset());
    selectedName = name;
    render();
    cfg.setStatus('「' + name + '」を保存しました', true);
  }

  function bind() {
    document.getElementById('btn-preset-save').addEventListener('click', save);

    document.getElementById('preset-list').addEventListener('click', function (ev) {
      var loadBtn = ev.target.closest('[data-preset-load]');
      var delBtn = ev.target.closest('[data-preset-del]');

      if (delBtn) {
        var delName = delBtn.getAttribute('data-preset-del');
        if (!window.confirm('「' + delName + '」を削除します。よろしいですか？')) return;
        POPStorage.deletePreset(delName);
        if (selectedName === delName) selectedName = null;
        render();
        cfg.setStatus('「' + delName + '」を削除しました', true);
        return;
      }

      if (loadBtn) {
        var name = loadBtn.getAttribute('data-preset-load');
        var found = POPStorage.listPresets().filter(function (p) { return p.name === name; })[0];
        if (!found) return;
        selectedName = name;
        render();
        cfg.applyCard(found.state, found.card);
        cfg.setStatus('「' + name + '」の見た目を当てました（文字はそのままです）', true);
      }
    });
  }

  function init(o) { cfg = o; bind(); render(); }

  return { init: init, render: render };
})();
