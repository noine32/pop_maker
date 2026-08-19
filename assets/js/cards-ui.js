/* ===========================================================
   カード一覧 UI（サムネイル・選択・並べ替え）
   状態は持たず、app.js から渡されたコールバックを呼ぶだけ。
   =========================================================== */
var POPCardsUI = (function () {
  'use strict';

  var opts = null;
  var listEl = null;
  var timer = null;
  var dragFrom = -1;

  var THUMB_W = 34;          /* CSS の .cardrow__thumb と合わせる */
  var REBUILD_DEBOUNCE_MS = 200;

  function esc(s) {
    return String(s === undefined || s === null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function rowLabel(card) {
    var name = String((card.name && card.name.text) || '').split('\n')[0].trim();
    var price = String((card.price && card.price.value) || '').trim();
    return {
      name: name || '（無題）',
      price: price ? (card.price.prefix || '') + price : ''
    };
  }

  function build() {
    var doc = opts.getDoc();
    listEl.innerHTML = doc.cards.map(function (c, i) {
      var l = rowLabel(c);
      return '<li class="cardrow' + (i === doc.activeIndex ? ' is-active' : '') + '"' +
        ' role="option" aria-selected="' + (i === doc.activeIndex) + '"' +
        ' data-index="' + i + '" draggable="true" title="' + esc(l.name) + '">' +
        '<canvas class="cardrow__thumb" width="1" height="1" aria-hidden="true"></canvas>' +
        '<span class="cardrow__no">' + (i + 1) + '</span>' +
        '<span class="cardrow__name">' + esc(l.name) + '</span>' +
        '<span class="cardrow__price">' + esc(l.price) + '</span>' +
        '</li>';
    }).join('');
    drawThumbs();
    scrollActiveIntoView();
  }

  /* サムネイルは「今読み込めている」フォント・画像だけで描く（待たない）。
     ロードが済めば app.js 側の再描画から refresh() が呼ばれて描き直る。 */
  function drawThumbs() {
    var doc = opts.getDoc();
    var size = POPPresets.cardSize(doc.card);
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var pxPerMm = (THUMB_W * dpr) / size.w;
    var canvases = listEl.querySelectorAll('.cardrow__thumb');
    var assetsAll = opts.getAssets ? opts.getAssets() : [];
    for (var i = 0; i < canvases.length; i++) {
      var cv = canvases[i];
      cv.width = Math.max(1, Math.round(THUMB_W * dpr));
      cv.height = Math.max(1, Math.round(size.h * pxPerMm));
      cv.style.height = Math.round(size.h * (THUMB_W / size.w)) + 'px';
      var assets = assetsAll[i] || { image: null };
      try {
        POPRenderer.draw(cv.getContext('2d'), doc.cards[i], pxPerMm, assets, size);
      } catch (e) { /* サムネイルの失敗で画面を止めない */ }
    }
  }

  function scrollActiveIntoView() {
    var el = listEl.querySelector('.cardrow.is-active');
    if (el && el.scrollIntoView) el.scrollIntoView({ block: 'nearest' });
  }

  function indexFromEvent(ev) {
    var row = ev.target && ev.target.closest ? ev.target.closest('.cardrow') : null;
    return row ? Number(row.getAttribute('data-index')) : -1;
  }

  function bind() {
    listEl.addEventListener('click', function (ev) {
      var i = indexFromEvent(ev);
      if (i >= 0) opts.onSelect(i);
    });

    listEl.addEventListener('keydown', function (ev) {
      var doc = opts.getDoc();
      var cur = doc.activeIndex;
      if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') {
        var next = ev.key === 'ArrowDown'
          ? Math.min(cur + 1, doc.cards.length - 1)
          : Math.max(cur - 1, 0);
        ev.preventDefault();
        if (ev.altKey) { if (next !== cur) opts.onMove(cur, next); }
        else if (next !== cur) opts.onSelect(next);
      } else if (ev.key === 'Home') {
        ev.preventDefault(); opts.onSelect(0);
      } else if (ev.key === 'End') {
        ev.preventDefault(); opts.onSelect(doc.cards.length - 1);
      }
    });

    /* ドラッグ＆ドロップの並べ替え（キーボード操作も上で用意済み） */
    listEl.addEventListener('dragstart', function (ev) {
      dragFrom = indexFromEvent(ev);
      if (dragFrom < 0) return;
      try { ev.dataTransfer.setData('text/plain', String(dragFrom)); } catch (e) { /* noop */ }
      ev.dataTransfer.effectAllowed = 'move';
    });
    listEl.addEventListener('dragover', function (ev) {
      if (dragFrom < 0) return;
      ev.preventDefault();
      ev.dataTransfer.dropEffect = 'move';
      var rows = listEl.querySelectorAll('.cardrow');
      for (var i = 0; i < rows.length; i++) rows[i].classList.remove('is-dragover');
      var row = ev.target && ev.target.closest ? ev.target.closest('.cardrow') : null;
      if (row) row.classList.add('is-dragover');
    });
    listEl.addEventListener('drop', function (ev) {
      ev.preventDefault();
      var to = indexFromEvent(ev);
      if (dragFrom >= 0 && to >= 0 && dragFrom !== to) opts.onMove(dragFrom, to);
      dragFrom = -1;
    });
    listEl.addEventListener('dragend', function () {
      dragFrom = -1;
      var rows = listEl.querySelectorAll('.cardrow');
      for (var i = 0; i < rows.length; i++) rows[i].classList.remove('is-dragover');
    });

    document.getElementById('btn-card-add').addEventListener('click', function () { opts.onAdd(); });
    document.getElementById('btn-card-dup').addEventListener('click', function () { opts.onDuplicate(); });
    document.getElementById('btn-card-del').addEventListener('click', function () { opts.onRemove(); });
  }

  function updateOps() {
    var doc = opts.getDoc();
    var full = doc.cards.length >= POPDoc.MAX_CARDS;
    document.getElementById('btn-card-add').disabled = full;
    document.getElementById('btn-card-dup').disabled = full;
    document.getElementById('btn-card-del').disabled = doc.cards.length <= 1;
  }

  function refreshNow() { build(); updateOps(); }

  /* 選択中カードの行だけを更新する軽い版。文字を打つたびに全カードを
     描き直すと重いので、内容が変わったカード1枚だけを描き替える。 */
  function refreshActive() {
    var doc = opts.getDoc();
    var row = listEl.querySelector('.cardrow[data-index="' + doc.activeIndex + '"]');
    if (!row) { refreshNow(); return; }

    var card = doc.cards[doc.activeIndex];
    var l = rowLabel(card);
    var nameEl = row.querySelector('.cardrow__name');
    var priceEl = row.querySelector('.cardrow__price');
    if (nameEl) { nameEl.textContent = l.name; row.setAttribute('title', l.name); }
    if (priceEl) priceEl.textContent = l.price;

    var cv = row.querySelector('.cardrow__thumb');
    if (!cv) return;
    var size = POPPresets.cardSize(doc.card);
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var pxPerMm = (THUMB_W * dpr) / size.w;
    cv.width = Math.max(1, Math.round(THUMB_W * dpr));
    cv.height = Math.max(1, Math.round(size.h * pxPerMm));
    cv.style.height = Math.round(size.h * (THUMB_W / size.w)) + 'px';
    var assets = opts.getAssets ? (opts.getAssets()[doc.activeIndex] || { image: null }) : { image: null };
    try {
      POPRenderer.draw(cv.getContext('2d'), card, pxPerMm, assets, size);
    } catch (e) { /* サムネイルの失敗で画面を止めない */ }
  }

  /* 文字入力のたびに全カードを描き直すと重いので間引く */
  function refresh() {
    if (timer) return;
    timer = setTimeout(function () { timer = null; refreshActive(); }, REBUILD_DEBOUNCE_MS);
  }

  function init(o) {
    opts = o;
    listEl = o.root;
    bind();
    refreshNow();
  }

  return { init: init, refresh: refresh, refreshNow: refreshNow, refreshActive: refreshActive };
})();
