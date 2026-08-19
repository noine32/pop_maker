/* ===========================================================
   ドキュメント（カード集）の操作と旧データの移行
   doc = { version, activeIndex, card, sheet, cards[] }
   DOM に触れないので Node のテストから直接読み込める。
   =========================================================== */
var POPDoc = (function () {
  'use strict';

  var MAX_CARDS = 100;

  function num(v, fallback) {
    var n = Number(v);
    return isFinite(n) ? n : fallback;
  }

  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }

  /* 既定値へ読み込んだ値を重ねる（欠けたキーがあっても壊れないように）。
     プロトタイプ汚染対策：JSON.parse は __proto__ を列挙可能キーとして作るため、
     base["__proto__"](=Object.prototype)への書き込みを防ぐ。 */
  function mergeDeep(base, patch) {
    if (!patch || typeof patch !== 'object') return base;
    Object.keys(patch).forEach(function (k) {
      if (k === '__proto__' || k === 'constructor' || k === 'prototype') return;
      var v = patch[k];
      var baseIsObj = base[k] && typeof base[k] === 'object' && !Array.isArray(base[k]);
      var vIsObj = v && typeof v === 'object' && !Array.isArray(v);
      if (vIsObj && baseIsObj) mergeDeep(base[k], v);
      else if (baseIsObj) return;
      else if (v !== undefined && v !== null) base[k] = v;
    });
    return base;
  }

  /* ---------- 既定値 ---------- */
  function defaultDoc() {
    return {
      version: 2,
      activeIndex: 0,
      card: POPPresets.defaultCard(),
      scale: POPPresets.defaultScale(44, 67),
      sheet: POPPresets.defaultSheet(),
      cards: [POPPresets.defaultCardState()]
    };
  }

  /* 初回起動用。サンプル文言入りのカード1枚。カードは 44×67mm なので
     テンプレートのA4前提値を焼き込んでから渡す。 */
  function sampleDoc() {
    var d = defaultDoc();
    var size = POPPresets.cardSize(d.card);
    var c = POPPresets.sampleState();
    delete c.paper;
    POPPresets.scaleCard(c, POPPresets.scaleFor(210, 297, size.w, size.h), size);
    d.cards = [c];
    return d;
  }

  /* ---------- 移行 ---------- */
  /** 保存データを v2 の doc にする。復元できない場合は null。 */
  function migrate(data) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) return null;

    if (data.version === 2 && Array.isArray(data.cards)) return normalize(data);

    /* v1 = 単品 state（paper を持つ）。カードとシートを同寸にすることで、
       どの用紙で作ったデータでも「1ページに1枚」＝従来と同じ印刷結果になる。 */
    var v1 = clone(data);
    var paper = v1.paper || { id: 'a4', orientation: 'portrait' };
    var size = POPPresets.paperSize({ paper: paper });
    delete v1.paper;

    var doc = {
      version: 2,
      activeIndex: 0,
      card: { id: 'custom', customW: size.w, customH: size.h },
      scale: POPPresets.defaultScale(size.w, size.h),
      sheet: {
        id: paper.id === 'custom' ? 'custom' : paper.id,
        orientation: paper.orientation === 'landscape' ? 'landscape' : 'portrait',
        customW: num(paper.customW, size.w),
        customH: num(paper.customH, size.h),
        margin: 0, gap: 0, allowRotate: false, center: true, cutLine: false
      },
      cards: [v1]
    };
    return normalize(doc);
  }

  /** 読み込んだ doc を安全な形に整える（破壊的） */
  function normalize(doc) {
    if (!doc || typeof doc !== 'object') return defaultDoc();

    doc.version = 2;
    doc.card = mergeDeep(POPPresets.defaultCard(), doc.card);
    doc.sheet = mergeDeep(POPPresets.defaultSheet(), doc.sheet);
    doc.sheet.margin = clamp(num(doc.sheet.margin, 5), 0, 30);
    doc.sheet.gap = clamp(num(doc.sheet.gap, 0), 0, 20);

    /* 比例計算の基準。古い保存データには無いので、現在のカードサイズを基準として補う。 */
    var cardMm = POPPresets.cardSize(doc.card);
    doc.scale = mergeDeep(POPPresets.defaultScale(cardMm.w, cardMm.h), doc.scale);
    if (!(Number(doc.scale.applied) > 0)) doc.scale.applied = 1;

    if (!Array.isArray(doc.cards) || !doc.cards.length) {
      doc.cards = [POPPresets.defaultCardState()];
    }
    if (doc.cards.length > MAX_CARDS) doc.cards = doc.cards.slice(0, MAX_CARDS);

    doc.cards = doc.cards.map(function (c) {
      var base = POPPresets.defaultCardState();
      mergeDeep(base, c);
      delete base.paper;
      return base;
    });

    doc.activeIndex = clamp(Math.floor(num(doc.activeIndex, 0)), 0, doc.cards.length - 1);
    return doc;
  }

  /* ---------- カード操作 ---------- */
  function activeCard(doc) { return doc.cards[doc.activeIndex]; }

  /** 末尾に追加して選択を移す。上限超過なら -1。 */
  function addCard(doc, cardState) {
    if (doc.cards.length >= MAX_CARDS) return -1;
    doc.cards.push(cardState);
    doc.activeIndex = doc.cards.length - 1;
    return doc.activeIndex;
  }

  /** index のカードを直後へ複製して選択を移す。上限超過なら -1。 */
  function duplicateCard(doc, index) {
    if (doc.cards.length >= MAX_CARDS) return -1;
    if (index < 0 || index >= doc.cards.length) return -1;
    doc.cards.splice(index + 1, 0, clone(doc.cards[index]));
    doc.activeIndex = index + 1;
    return doc.activeIndex;
  }

  /** 削除。最後の1枚は消せない（false を返す）。 */
  function removeCard(doc, index) {
    if (doc.cards.length <= 1) return false;
    if (index < 0 || index >= doc.cards.length) return false;
    doc.cards.splice(index, 1);
    doc.activeIndex = clamp(doc.activeIndex > index ? doc.activeIndex - 1 : doc.activeIndex,
                            0, doc.cards.length - 1);
    if (doc.activeIndex >= doc.cards.length) doc.activeIndex = doc.cards.length - 1;
    return true;
  }

  /** 並べ替え。動かしたカードも、動かしていない選択中カードも、
      同じカードを選び続けるようにする（配列を変えた後に参照から位置を引き直す）。 */
  function moveCard(doc, from, to) {
    var n = doc.cards.length;
    if (from < 0 || from >= n || to < 0 || to >= n || from === to) return false;
    var active = doc.cards[doc.activeIndex];   /* 変異前に参照を控える */
    var item = doc.cards.splice(from, 1)[0];
    doc.cards.splice(to, 0, item);
    doc.activeIndex = clamp(doc.cards.indexOf(active), 0, doc.cards.length - 1);
    return true;
  }

  /* ---------- 全カードへデザインを適用 ----------
     見た目に関わるキーだけを配る。文章・価格・バッジ文言・画像は
     カードごとに違うので触らない（設計 §8）。 */
  var DESIGN_TEXT_KEYS = ['catch', 'name', 'price', 'desc', 'note'];
  var DESIGN_TEXT_PROPS = ['font', 'size', 'weight', 'color', 'lineHeight'];
  var DESIGN_BADGE_PROPS = ['enabled', 'style', 'bg', 'color', 'size'];

  /** @returns {number} 上書きしたカード枚数（自分自身を除く） */
  function applyDesignToAll(doc, index) {
    var src = doc.cards[index];
    if (!src) return 0;
    var count = 0;
    doc.cards.forEach(function (dst, i) {
      if (i === index) return;
      dst.template = src.template;
      dst.design = clone(src.design);
      dst.layout = clone(src.layout);
      DESIGN_TEXT_KEYS.forEach(function (k) {
        if (!src[k] || !dst[k]) return;
        DESIGN_TEXT_PROPS.forEach(function (p) {
          if (src[k][p] !== undefined) dst[k][p] = src[k][p];
        });
      });
      if (src.badge && dst.badge) {
        DESIGN_BADGE_PROPS.forEach(function (p) {
          if (src.badge[p] !== undefined) dst.badge[p] = src.badge[p];
        });
      }
      count++;
    });
    return count;
  }

  return {
    MAX_CARDS: MAX_CARDS,
    mergeDeep: mergeDeep,
    defaultDoc: defaultDoc,
    sampleDoc: sampleDoc,
    migrate: migrate,
    normalize: normalize,
    activeCard: activeCard,
    addCard: addCard,
    duplicateCard: duplicateCard,
    removeCard: removeCard,
    moveCard: moveCard,
    applyDesignToAll: applyDesignToAll
  };
})();
