/* ===========================================================
   「名前を付けて保存」したデザインの一覧と操作
   プリセットは 1 カードぶんのデザイン。読込は選択中カードへ適用する。
   =========================================================== */
var POPPresetUI = (function () {
  'use strict';

  var cfg = null;         /* { getCard, applyCard, setStatus } */

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function render() {
    var ul = document.getElementById('preset-list');
    var arr = POPStorage.listPresets();
    if (!arr.length) {
      ul.innerHTML = '<li class="presets__empty">保存されたデザインはありません</li>';
      return;
    }
    ul.innerHTML = arr.map(function (p) {
      var n = esc(p.name);
      return '<li><span title="' + n + '">' + n + '</span>' +
        '<button type="button" class="btn btn--sm" data-preset-load="' + n + '">読込</button>' +
        '<button type="button" class="btn btn--sm btn--ghost" data-preset-del="' + n + '">削除</button></li>';
    }).join('');
  }

  function bind() {
    document.getElementById('btn-preset-save').addEventListener('click', function () {
      var input = document.getElementById('preset-name');
      var card = cfg.getCard();
      /* 改行・連続空白を1つに正規化（HTML属性値の空白正規化で読込/削除がズレるのを防ぐ） */
      var fallback = String(card.name.text || '').replace(/\s+/g, ' ').trim().slice(0, 20);
      var name = input.value.replace(/\s+/g, ' ').trim() || fallback || '無題';
      POPStorage.savePreset(name, JSON.parse(JSON.stringify(card)));
      input.value = '';
      render();
      cfg.setStatus('「' + name + '」を保存しました', true);
    });

    document.getElementById('preset-list').addEventListener('click', function (ev) {
      var loadBtn = ev.target.closest('[data-preset-load]');
      var delBtn = ev.target.closest('[data-preset-del]');
      if (loadBtn) {
        var name = loadBtn.getAttribute('data-preset-load');
        var found = POPStorage.listPresets().filter(function (p) { return p.name === name; })[0];
        if (found) {
          cfg.applyCard(found.state);
          cfg.setStatus('「' + name + '」を読み込みました', true);
        }
      } else if (delBtn) {
        POPStorage.deletePreset(delBtn.getAttribute('data-preset-del'));
        render();
      }
    });
  }

  function init(o) { cfg = o; bind(); render(); }

  return { init: init, render: render };
})();
