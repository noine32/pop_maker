/* ===========================================================
   面付け計算（DOM非依存の純関数のみ）
   シート上にカードを格子状に何枚並べられるかを求める。
   単位はすべて mm。Node のテストから直接読み込める。
   =========================================================== */
var POPImposition = (function () {
  'use strict';

  function num(v, fallback) {
    var n = Number(v);
    return isFinite(n) ? n : fallback;
  }

  /* 1方向ぶんの詰め込み数。n枚並べると隙間は (n-1) 個なので
     (内寸 + gap) / (辺 + gap) の整数部が入る枚数になる。 */
  function fit(innerW, innerH, w, h, gap) {
    if (w <= 0 || h <= 0 || innerW < w || innerH < h) {
      return { cols: 0, rows: 0, count: 0 };
    }
    var cols = Math.floor((innerW + gap) / (w + gap));
    var rows = Math.floor((innerH + gap) / (h + gap));
    return { cols: cols, rows: rows, count: cols * rows };
  }

  /* 縦置き・横置き（90°回転）の両方を試し、多く入る方を採る。
     同数なら回転しない＝カードの向きが揃っている方が切りやすいため。 */
  function computeLayout(o) {
    o = o || {};
    var sheetW = num(o.sheetW, 0);
    var sheetH = num(o.sheetH, 0);
    var cardW = num(o.cardW, 0);
    var cardH = num(o.cardH, 0);
    var margin = Math.max(0, num(o.margin, 0));
    var gap = Math.max(0, num(o.gap, 0));
    var center = o.center !== false;

    var innerW = sheetW - margin * 2;
    var innerH = sheetH - margin * 2;

    var a = fit(innerW, innerH, cardW, cardH, gap);
    var b = o.allowRotate ? fit(innerW, innerH, cardH, cardW, gap)
                          : { cols: 0, rows: 0, count: 0 };
    var rotate = b.count > a.count;
    var r = rotate ? b : a;

    /* シート座標での1セルの外形。回転時は幅と高さが入れ替わる。 */
    var cellW = rotate ? cardH : cardW;
    var cellH = rotate ? cardW : cardH;
    var usedW = r.cols * cellW + Math.max(0, r.cols - 1) * gap;
    var usedH = r.rows * cellH + Math.max(0, r.rows - 1) * gap;

    return {
      cols: r.cols, rows: r.rows, perPage: r.count, rotate: rotate,
      cellW: cellW, cellH: cellH, gap: gap,
      usedW: usedW, usedH: usedH,
      /* 余った分だけブロックごと中央へ寄せる（枚数は変わらず見栄えだけ改善） */
      originX: margin + (center ? Math.max(0, innerW - usedW) / 2 : 0),
      originY: margin + (center ? Math.max(0, innerH - usedH) / 2 : 0)
    };
  }

  /* ページ内 index → セル矩形（mm・シート左上が原点）。
     layout.perPage が 0 のときは呼ばないこと（cols=0 で 0 除算になる）。 */
  function cellRect(layout, i) {
    var col = i % layout.cols;
    var row = Math.floor(i / layout.cols);
    return {
      x: layout.originX + col * (layout.cellW + layout.gap),
      y: layout.originY + row * (layout.cellH + layout.gap),
      w: layout.cellW,
      h: layout.cellH
    };
  }

  /* カード n 枚が何ページになるか。0枚でも1ページ（空のシート）を返す。 */
  function pageCount(n, perPage) {
    if (!(perPage > 0)) return 0;
    return Math.max(1, Math.ceil(num(n, 0) / perPage));
  }

  return {
    fit: fit,
    computeLayout: computeLayout,
    cellRect: cellRect,
    pageCount: pageCount
  };
})();
