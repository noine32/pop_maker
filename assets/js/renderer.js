/* ===========================================================
   ポップの描画エンジン
   画面プレビューも書き出し(PNG/印刷)も、この1つの関数で描く。
   pxPerMm を変えるだけで解像度が変わる（プレビュー約3px/mm、印刷 300dpi=11.81px/mm）。
   =========================================================== */
var POPRenderer = (function () {
  'use strict';

  var PT_TO_MM = 25.4 / 72;

  /* pt → px（不正な数値サイズでも文字が消えないよう既定12ptに丸める） */
  function ptPx(pt, pxPerMm, scale) {
    var n = Number(pt);
    if (!isFinite(n)) n = 12;
    return Math.max(1, n * PT_TO_MM * pxPerMm * (scale || 1));
  }

  /* 角丸パス（ctx.roundRect が無い環境向けの実装） */
  function roundRectPath(ctx, x, y, w, h, r) {
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r);
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h);
    ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
  }

  /* 揃え位置に応じた描画基準X */
  function alignX(align, x0, innerW) {
    if (align === 'left') return x0;
    if (align === 'right') return x0 + innerW;
    return x0 + innerW / 2;
  }

  /* --------------------------------------------------------
     テキストブロック（キャッチ / 商品名 / 説明 / 注記）
     -------------------------------------------------------- */
  function makeTextBlock(ctx, cfg, innerW, x0, align, pxPerMm, fs, opts) {
    var text = String(cfg.text || '').trim();
    if (!text) return null;
    opts = opts || {};

    var sizePx = ptPx(cfg.size, pxPerMm, fs);
    var font = POPFonts.cssFont(cfg.font, cfg.weight, sizePx);
    ctx.font = font;

    var padX = opts.boxPad ? sizePx * 0.35 : 0;
    var lines = POPText.wrap(ctx, text, innerW - padX * 2);
    var lh = sizePx * (Number(cfg.lineHeight) || 1.3);
    var textW = POPText.maxLineWidth(ctx, lines);
    var padY = opts.boxPad ? sizePx * 0.22 : 0;

    return {
      h: lines.length * lh + padY * 2,
      w: textW + padX * 2,
      draw: function (y) {
        if (opts.boxPad) {
          var bw = Math.min(innerW, textW + padX * 2);
          var bx = align === 'left' ? x0 : (align === 'right' ? x0 + innerW - bw : x0 + (innerW - bw) / 2);
          ctx.fillStyle = opts.boxColor || '#000000';
          roundRectPath(ctx, bx, y, bw, lines.length * lh + padY * 2, sizePx * 0.2);
          ctx.fill();
        }
        ctx.font = font;
        ctx.fillStyle = cfg.color;
        ctx.textAlign = align === 'left' ? 'left' : (align === 'right' ? 'right' : 'center');
        ctx.textBaseline = 'middle';
        var ax = alignX(align, x0, innerW);
        for (var i = 0; i < lines.length; i++) {
          ctx.fillText(lines[i], ax, y + padY + lh * i + lh / 2);
        }
      }
    };
  }

  /* --------------------------------------------------------
     価格ブロック
     ¥ 1,280 円（税込）/ 100g  ＋ 参考価格の打ち消し線
     -------------------------------------------------------- */
  function makePriceBlock(ctx, state, innerW, x0, align, pxPerMm, fs) {
    var p = state.price;
    var main = p.comma === false ? String(p.value || '').trim() : POPText.formatNumber(p.value);
    var hasStrike = p.strike && p.strike.enabled && String(p.strike.value || '').trim() !== '';
    if (!main && !hasStrike) return null;

    var mainPx = ptPx(p.size, pxPerMm, fs);
    var subPx = mainPx * 0.42;   /* ¥ と 円 */
    var notePx = mainPx * 0.26;  /* （税込）や単位 */

    var noteText = '';
    if (p.taxNote) noteText += '（' + p.taxNote + '）';
    if (p.unit) noteText += (noteText ? ' ' : '') + p.unit;

    function segs(k) {
      var list = [];
      var mFont = POPFonts.cssFont(p.font, p.weight, mainPx * k);
      var sFont = POPFonts.cssFont(p.font, p.weight, subPx * k);
      var nFont = POPFonts.cssFont(p.font, 400, notePx * k);
      if (main && p.prefix) list.push({ t: p.prefix, font: sFont, size: subPx * k, gap: subPx * k * 0.08 });
      if (main) list.push({ t: main, font: mFont, size: mainPx * k, gap: subPx * k * 0.06 });
      if (main && p.suffix) list.push({ t: p.suffix, font: sFont, size: subPx * k, gap: notePx * k * 0.3 });
      if (main && noteText) list.push({ t: noteText, font: nFont, size: notePx * k, gap: 0 });
      var total = 0;
      list.forEach(function (s, i) {
        ctx.font = s.font;
        s.w = ctx.measureText(s.t).width;
        total += s.w + (i < list.length - 1 ? s.gap : 0);
      });
      return { list: list, total: total };
    }

    /* 横幅に収まらなければ価格まわりだけ縮める */
    var k = 1;
    var built = segs(k);
    if (built.total > innerW && built.total > 0) {
      k = innerW / built.total;
      built = segs(k);
    }

    /* 高さは実際の文字の上下端から求める（数字は大きいので見た目に効く）。
       actualBoundingBox は現在の textBaseline を基準に測るため、
       描画時と同じ 'alphabetic' に揃えてから測る（そろえないと帯つきテンプレで
       直前の 'middle' が残り、上端を半分しか確保できず商品名に重なる）。 */
    var asc = mainPx * k * 0.72, dsc = mainPx * k * 0.06;
    if (main) {
      ctx.textBaseline = 'alphabetic';
      ctx.font = POPFonts.cssFont(p.font, p.weight, mainPx * k);
      var m = ctx.measureText(main);
      if (m.actualBoundingBoxAscent) asc = m.actualBoundingBoxAscent;
      if (m.actualBoundingBoxDescent) dsc = m.actualBoundingBoxDescent;
    }
    var rowH = main ? asc + dsc : 0;

    /* 参考価格（打ち消し線） */
    var strikePx = mainPx * k * 0.3;
    var strikeText = hasStrike
      ? (p.prefix || '') + POPText.formatNumber(p.strike.value) + (p.suffix || '')
      : '';
    var strikeFont = POPFonts.cssFont(p.font, 400, strikePx);
    var strikeW = 0;
    if (hasStrike) { ctx.font = strikeFont; strikeW = ctx.measureText(strikeText).width; }
    var strikeH = hasStrike ? strikePx * 1.35 : 0;

    return {
      h: strikeH + rowH,
      w: Math.max(built.total, strikeW),
      draw: function (y) {
        ctx.textBaseline = 'alphabetic';
        ctx.textAlign = 'left';

        if (hasStrike) {
          var sx = align === 'left' ? x0
            : (align === 'right' ? x0 + innerW - strikeW : x0 + (innerW - strikeW) / 2);
          ctx.font = strikeFont;
          ctx.fillStyle = p.color;
          ctx.globalAlpha = 0.75;
          ctx.fillText(strikeText, sx, y + strikePx);
          ctx.globalAlpha = 1;
          ctx.strokeStyle = p.color;
          ctx.lineWidth = Math.max(1, strikePx * 0.07);
          ctx.setLineDash([]);
          ctx.beginPath();
          ctx.moveTo(sx, y + strikePx * 0.72);
          ctx.lineTo(sx + strikeW, y + strikePx * 0.72);
          ctx.stroke();
        }

        if (!main) return;
        var cx = align === 'left' ? x0
          : (align === 'right' ? x0 + innerW - built.total : x0 + (innerW - built.total) / 2);
        var baseline = y + strikeH + asc;
        ctx.fillStyle = p.color;
        built.list.forEach(function (s) {
          ctx.font = s.font;
          ctx.fillText(s.t, cx, baseline);
          cx += s.w + s.gap;
        });
      }
    };
  }

  /* --------------------------------------------------------
     区切り線
     -------------------------------------------------------- */
  function makeDivider(state, innerW, x0, align, pxPerMm, fs) {
    var h = Math.max(1, 1.2 * pxPerMm * (fs || 1));
    var w = innerW * 0.5;
    return {
      h: h,
      w: w,
      draw: function (y, ctx2) {
        var c = ctx2;
        var dx = align === 'left' ? x0 : (align === 'right' ? x0 + innerW - w : x0 + (innerW - w) / 2);
        c.setLineDash([]);
        c.strokeStyle = state.design.accent;
        c.lineWidth = h;
        c.beginPath();
        c.moveTo(dx, y + h / 2);
        c.lineTo(dx + w, y + h / 2);
        c.stroke();
      }
    };
  }

  /* --------------------------------------------------------
     バッジ（角丸タグ／リボン／丸印）
     -------------------------------------------------------- */
  function makeBadgeChip(ctx, state, innerW, x0, align, pxPerMm, fs) {
    var b = state.badge;
    if (!b.enabled || b.style !== 'chip' || !String(b.text || '').trim()) return null;
    var sizePx = ptPx(b.size, pxPerMm, fs);
    var font = POPFonts.cssFont('sans', 700, sizePx);
    ctx.font = font;
    var tw = ctx.measureText(b.text).width;
    var padX = sizePx * 0.6, padY = sizePx * 0.28;
    var w = Math.min(innerW, tw + padX * 2);
    var h = sizePx * 1.05 + padY * 2;
    return {
      h: h,
      w: w,
      draw: function (y) {
        var bx = align === 'left' ? x0 : (align === 'right' ? x0 + innerW - w : x0 + (innerW - w) / 2);
        ctx.fillStyle = b.bg;
        roundRectPath(ctx, bx, y, w, h, h / 2);
        ctx.fill();
        ctx.font = font;
        ctx.fillStyle = b.color;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(b.text, bx + w / 2, y + h / 2);
      }
    };
  }

  function drawBadgeOverlay(ctx, state, W, H, pxPerMm) {
    var b = state.badge;
    var text = String(b.text || '').trim();
    if (!b.enabled || !text) return;
    var sizePx = ptPx(b.size, pxPerMm, 1);

    if (b.style === 'ribbon') {
      var band = sizePx * 2.0;
      var len = Math.min(W, H) * 0.75;
      ctx.save();
      ctx.translate(W, 0);
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = b.bg;
      ctx.fillRect(-len / 2, -band * 0.2, len, band * 0.8);
      ctx.font = POPFonts.cssFont('sans', 700, sizePx);
      ctx.fillStyle = b.color;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, 0, -band * 0.2 + band * 0.4);
      ctx.restore();
    } else if (b.style === 'circle') {
      ctx.font = POPFonts.cssFont('sans', 700, sizePx);
      var tw = ctx.measureText(text).width;
      var r = Math.max(tw / 2 + sizePx * 0.55, sizePx * 1.1);
      var cx = W - r - pxPerMm * 6;
      var cy = r + pxPerMm * 6;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fillStyle = b.bg;
      ctx.fill();
      ctx.fillStyle = b.color;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, cx, cy);
    }
  }

  /* --------------------------------------------------------
     枠線
     -------------------------------------------------------- */
  function drawBorder(ctx, state, W, H, pxPerMm) {
    var bd = state.design.border;
    if (!bd || bd.style === 'none') return;
    var lw = Math.max(0.5, Number(bd.width) * pxPerMm);
    var inset = Math.max(state.layout.padding * pxPerMm * 0.45, lw);
    var x = inset, y = inset, w = W - inset * 2, h = H - inset * 2;
    if (w <= 0 || h <= 0) return;

    ctx.save();
    ctx.strokeStyle = bd.color;
    ctx.lineWidth = lw;
    ctx.setLineDash(bd.style === 'dashed' ? [lw * 3, lw * 2] : []);

    if (bd.style === 'round') {
      roundRectPath(ctx, x, y, w, h, Math.min(w, h) * 0.06);
      ctx.stroke();
    } else if (bd.style === 'double') {
      ctx.strokeRect(x, y, w, h);
      var g = lw * 3;
      if (w - g * 2 > 0 && h - g * 2 > 0) {
        ctx.lineWidth = Math.max(0.5, lw * 0.6);
        ctx.strokeRect(x + g, y + g, w - g * 2, h - g * 2);
      }
    } else {
      ctx.strokeRect(x, y, w, h);
    }
    ctx.restore();
  }

  /* --------------------------------------------------------
     本体
     -------------------------------------------------------- */
  function draw(ctx, state, pxPerMm) {
    var size = POPPresets.paperSize(state);
    var W = size.w * pxPerMm;
    var H = size.h * pxPerMm;

    ctx.save();
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = state.design.bg || '#ffffff';
    ctx.fillRect(0, 0, W, H);

    var pad = state.layout.padding * pxPerMm;
    var x0 = pad;
    var innerW = Math.max(10, W - pad * 2);
    var align = state.layout.align;

    /* --- 上部の帯（キャッチコピーを帯の中に入れる） --- */
    var bandBlock = null;
    var topOffset = 0;
    var useBand = state.design.band === 'top' && String(state.catch.text || '').trim() !== '';
    if (useBand) {
      bandBlock = makeTextBlock(ctx, state.catch, innerW, x0, align, pxPerMm, 1);
      if (bandBlock) {
        var bandPadY = ptPx(state.catch.size, pxPerMm, 1) * 0.45;
        var bandH = bandBlock.h + bandPadY * 2;
        ctx.fillStyle = state.design.accent;
        ctx.fillRect(0, 0, W, bandH);
        bandBlock.draw(bandPadY);
        topOffset = bandH;
      }
    }

    /* --- 中身のブロックを組み立てる（自動縮小のため複数回試す） --- */
    var contentTop = topOffset + (topOffset > 0 ? pad * 0.6 : pad);
    var availH = Math.max(10, H - contentTop - pad);
    var gapBase = state.layout.gap * pxPerMm;

    function build(fs) {
      var blocks = [];
      var chip = makeBadgeChip(ctx, state, innerW, x0, align, pxPerMm, fs);
      if (chip) blocks.push(chip);
      if (!useBand) {
        var c = makeTextBlock(ctx, state.catch, innerW, x0, align, pxPerMm, fs);
        if (c) blocks.push(c);
      }
      var nameOpts = state.design.band === 'behindName'
        ? { boxPad: true, boxColor: state.design.accent } : null;
      var n = makeTextBlock(ctx, state.name, innerW, x0, align, pxPerMm, fs, nameOpts);
      if (n) blocks.push(n);

      var pr = makePriceBlock(ctx, state, innerW, x0, align, pxPerMm, fs);
      if (state.layout.divider && n && pr) blocks.push(makeDivider(state, innerW, x0, align, pxPerMm, fs));
      if (pr) blocks.push(pr);

      var d = makeTextBlock(ctx, state.desc, innerW, x0, align, pxPerMm, fs);
      if (d) blocks.push(d);
      var nt = makeTextBlock(ctx, state.note, innerW, x0, align, pxPerMm, fs);
      if (nt) blocks.push(nt);

      var gap = gapBase * fs;
      var total = 0;
      blocks.forEach(function (b) { total += b.h; });
      total += gap * Math.max(0, blocks.length - 1);
      return { blocks: blocks, total: total, gap: gap };
    }

    /* 自動縮小：折り返し行数が変わるため単純な比例計算では合わない。
       「収まる最大の倍率」を二分探索で求める。 */
    var fs = 1;
    var layout = build(fs);
    if (state.layout.autoFit && layout.total > availH) {
      var lo = 0.1, hi = 1;
      for (var i = 0; i < 11; i++) {
        var mid = (lo + hi) / 2;
        if (build(mid).total <= availH) lo = mid; else hi = mid;
      }
      fs = lo;
      layout = build(fs);
    }

    /* --- 縦位置 --- */
    var y = contentTop;
    var extraGap = 0;
    if (layout.total < availH) {
      if (state.layout.valign === 'center') y = contentTop + (availH - layout.total) / 2;
      else if (state.layout.valign === 'space' && layout.blocks.length > 1) {
        extraGap = (availH - layout.total) / (layout.blocks.length - 1);
      }
    }

    layout.blocks.forEach(function (b, i) {
      b.draw(y, ctx);
      y += b.h + layout.gap + extraGap;
      if (i === layout.blocks.length - 1) { /* 最後はギャップ不要 */ }
    });

    drawBorder(ctx, state, W, H, pxPerMm);
    drawBadgeOverlay(ctx, state, W, H, pxPerMm);
    ctx.restore();

    return { w: W, h: H, fontScale: fs, overflow: layout.total > availH };
  }

  /** 指定解像度でオフスクリーンに描画して canvas を返す */
  function renderToCanvas(state, dpi) {
    var pxPerMm = dpi / 25.4;
    var size = POPPresets.paperSize(state);
    var cv = document.createElement('canvas');
    cv.width = Math.round(size.w * pxPerMm);
    cv.height = Math.round(size.h * pxPerMm);
    var ctx = cv.getContext('2d');
    draw(ctx, state, pxPerMm);
    return cv;
  }

  /** 状態の中で使っているフォント一覧（Webフォント読み込み用） */
  function usedFonts(state) {
    return ['catch', 'name', 'price', 'desc', 'note'].map(function (k) {
      return { font: state[k].font, weight: state[k].weight };
    });
  }

  return {
    draw: draw,
    renderToCanvas: renderToCanvas,
    usedFonts: usedFonts,
    ptPx: ptPx,
    PT_TO_MM: PT_TO_MM
  };
})();
