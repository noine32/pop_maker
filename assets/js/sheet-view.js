/* ===========================================================
   シート合成（面付けされた1ページぶんの描画）
   カード1枚の描画は POPRenderer.draw に任せ、ここは座標系を動かすだけ。
   回転は「置き方」を変えるだけでカードの中身には一切影響しない。
   =========================================================== */
var POPSheetView = (function () {
  'use strict';

  var CUT_LINE_MM = 0.2;
  var CUT_LINE_COLOR = '#b0b0b0';

  function layoutOf(doc) {
    var card = POPPresets.cardSize(doc.card);
    var sheet = POPPresets.sheetSize(doc.sheet);
    return POPImposition.computeLayout({
      sheetW: sheet.w, sheetH: sheet.h,
      cardW: card.w, cardH: card.h,
      margin: doc.sheet.margin, gap: doc.sheet.gap,
      allowRotate: doc.sheet.allowRotate !== false,
      center: doc.sheet.center !== false
    });
  }

  function pagesOf(doc) {
    return POPImposition.pageCount(doc.cards.length, layoutOf(doc).perPage);
  }

  /* 内部用: 計算済みの layout を受け取る版。公開版はこれを包むだけにして
     1回の呼び出しで computeLayout が何度も走らないようにする。 */
  function indexesOnPage(doc, pageIndex, layout) {
    if (!(layout.perPage > 0)) return [];
    var start = pageIndex * layout.perPage;
    var out = [];
    for (var i = start; i < Math.min(start + layout.perPage, doc.cards.length); i++) out.push(i);
    return out;
  }

  /** pageIndex ページに載るカードの添字の配列 */
  function cardIndexesOnPage(doc, pageIndex) {
    return indexesOnPage(doc, pageIndex, layoutOf(doc));
  }

  /** ページ内 index のセルへ移す変換（mm）。rot は 0 か 90°。 */
  function cellTransform(layout, i) {
    var r = POPImposition.cellRect(layout, i);
    if (!layout.rotate) return { tx: r.x, ty: r.y, rot: 0 };
    /* 90°回すとローカル +x がシートの下、+y がシートの左を向く。
       カードの w×h をセルの h×w に収めるため原点をセルの右上に置く。 */
    return { tx: r.x + r.w, ty: r.y, rot: Math.PI / 2 };
  }

  /** mm 座標にあるカードの添字（無ければ -1） */
  function hitTest(doc, pageIndex, mm) {
    var L = layoutOf(doc);
    if (!(L.perPage > 0)) return -1;
    var idxs = indexesOnPage(doc, pageIndex, L);
    for (var k = 0; k < idxs.length; k++) {
      var r = POPImposition.cellRect(L, k);
      if (mm.x >= r.x && mm.x <= r.x + r.w && mm.y >= r.y && mm.y <= r.y + r.h) return idxs[k];
    }
    return -1;
  }

  /* カット線。そのページに実際に載っているカードのぶんだけ引く。
     グリッド全体（perPage）ぶん引くと、最終ページの余った部分にまで
     格子が印刷されてしまうため。
     gap=0 のときは隣接カードが境界を共有し同じ線を2回なぞることになるが、
     不透明な細線なので見た目は変わらない（空セルに線を出さない方を優先する）。 */
  function drawCutLines(ctx, layout, count, pxPerMm) {
    if (!(count > 0)) return;
    ctx.save();
    ctx.strokeStyle = CUT_LINE_COLOR;
    ctx.lineWidth = Math.max(1, CUT_LINE_MM * pxPerMm);
    ctx.beginPath();
    for (var i = 0; i < count; i++) {
      var r = POPImposition.cellRect(layout, i);
      ctx.rect(r.x * pxPerMm, r.y * pxPerMm, r.w * pxPerMm, r.h * pxPerMm);
    }
    ctx.stroke();
    ctx.restore();
  }

  /**
   * シート1ページを描く。
   * @param {Array} assetsByCard カードと同じ添字の [{ image: HTMLImageElement|null }]
   * @param {Object} opts { highlightIndex, highlightColor } プレビュー専用。書き出しでは渡さない。
   */
  function drawSheet(ctx, doc, pageIndex, pxPerMm, assetsByCard, opts) {
    opts = opts || {};
    var sheet = POPPresets.sheetSize(doc.sheet);
    var card = POPPresets.cardSize(doc.card);
    var W = sheet.w * pxPerMm, H = sheet.h * pxPerMm;

    /* 下地。カード側も背景を塗るが、セル境界の継ぎ目が非整数pxに落ちたときの
       隙間をここで埋めておく。 */
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, H);
    ctx.restore();

    var L = layoutOf(doc);
    if (!(L.perPage > 0)) return { layout: L, drawn: 0 };

    var idxs = indexesOnPage(doc, pageIndex, L);
    idxs.forEach(function (cardIndex, k) {
      var t = cellTransform(L, k);
      ctx.save();
      ctx.translate(t.tx * pxPerMm, t.ty * pxPerMm);
      if (t.rot) ctx.rotate(t.rot);
      var assets = (assetsByCard && assetsByCard[cardIndex]) || { image: null };
      POPRenderer.draw(ctx, doc.cards[cardIndex], pxPerMm, assets, card);
      ctx.restore();
    });

    if (doc.sheet.cutLine) drawCutLines(ctx, L, idxs.length, pxPerMm);

    /* 選択中カードの強調（プレビューのみ・書き出しには出さない） */
    if (opts.highlightIndex !== undefined && opts.highlightIndex !== null) {
      var pos = idxs.indexOf(opts.highlightIndex);
      if (pos >= 0) {
        var r = POPImposition.cellRect(L, pos);
        ctx.save();
        ctx.strokeStyle = opts.highlightColor || '#2b6cb0';
        ctx.lineWidth = Math.max(2, 0.6 * pxPerMm);
        ctx.strokeRect(r.x * pxPerMm, r.y * pxPerMm, r.w * pxPerMm, r.h * pxPerMm);
        ctx.restore();
      }
    }
    return { layout: L, drawn: idxs.length };
  }

  /** 指定解像度でシート1ページをオフスクリーンに描く */
  function renderSheetToCanvas(doc, pageIndex, dpi, assetsByCard) {
    var pxPerMm = dpi / 25.4;
    var sheet = POPPresets.sheetSize(doc.sheet);
    var cv = document.createElement('canvas');
    cv.width = Math.round(sheet.w * pxPerMm);
    cv.height = Math.round(sheet.h * pxPerMm);
    drawSheet(cv.getContext('2d'), doc, pageIndex, pxPerMm, assetsByCard, {});
    return cv;
  }

  return {
    layoutOf: layoutOf,
    pagesOf: pagesOf,
    cardIndexesOnPage: cardIndexesOnPage,
    cellTransform: cellTransform,
    hitTest: hitTest,
    drawSheet: drawSheet,
    renderSheetToCanvas: renderSheetToCanvas
  };
})();
