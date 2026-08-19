/* ===========================================================
   用紙サイズ・テンプレート・初期値
   =========================================================== */
var POPPresets = (function () {
  'use strict';

  /* 用紙サイズ（mm・縦向きの値）。A判/B判はいずれも日本のJIS規格寸法。
     ISO B系列（B5=176×250 等）とは別物なので、B判ラベルに「JIS」を併記する。 */
  var PAPERS = [
    { id: 'a3',      label: 'A3（297×420mm）',          w: 297, h: 420, group: 'JIS A判' },
    { id: 'a4',      label: 'A4（210×297mm）',          w: 210, h: 297, group: 'JIS A判' },
    { id: 'a5',      label: 'A5（148×210mm）',          w: 148, h: 210, group: 'JIS A判' },
    { id: 'a6',      label: 'A6（105×148mm）',          w: 105, h: 148, group: 'JIS A判' },
    { id: 'a7',      label: 'A7（74×105mm）',           w: 74,  h: 105, group: 'JIS A判' },
    { id: 'a8',      label: 'A8（52×74mm）',            w: 52,  h: 74,  group: 'JIS A判' },
    { id: 'b4',      label: 'B4・JIS（257×364mm）',      w: 257, h: 364, group: 'JIS B判' },
    { id: 'b5',      label: 'B5・JIS（182×257mm）',      w: 182, h: 257, group: 'JIS B判' },
    { id: 'b6',      label: 'B6・JIS（128×182mm）',      w: 128, h: 182, group: 'JIS B判' },
    { id: 'b7',      label: 'B7・JIS（91×128mm）',       w: 91,  h: 128, group: 'JIS B判' },
    { id: 'b8',      label: 'B8・JIS（64×91mm）',        w: 64,  h: 91,  group: 'JIS B判' },
    { id: 'hagaki',  label: 'はがき（100×148mm）',      w: 100, h: 148, group: 'その他定型' },
    { id: 'meishi',  label: '名刺（91×55mm）',          w: 91,  h: 55,  group: 'その他定型' },
    { id: 'square',  label: '正方形（100×100mm）',      w: 100, h: 100, group: 'その他定型' },
    { id: 'strip',   label: '短冊（210×74mm）',         w: 210, h: 74,  group: 'その他定型' },
    { id: 'custom',  label: 'カスタムサイズ',            w: 150, h: 100, group: 'カスタム' }
  ];

  var papersById = {};
  PAPERS.forEach(function (p) { papersById[p.id] = p; });

  /** 現在の設定から実際の用紙サイズ（mm）を返す */
  function paperSize(state) {
    var p = papersById[state.paper.id] || papersById.a4;
    var w = p.id === 'custom' ? Number(state.paper.customW) || 150 : p.w;
    var h = p.id === 'custom' ? Number(state.paper.customH) || 100 : p.h;
    if (state.paper.orientation === 'landscape') { var t = w; w = h; h = t; }
    return { w: w, h: h };
  }

  /* ---------- テンプレート ----------
     文章（text）は変更せず、見た目に関わる部分だけを差し替える */
  var TEMPLATES = [
    {
      id: 'simple', name: 'シンプル', swatchBg: '#ffffff', swatchFg: '#222222',
      apply: {
        design: { bg: '#ffffff', accent: '#333333', band: 'none',
                  border: { style: 'solid', width: 1.2, color: '#333333' } },
        layout: { align: 'center', valign: 'center', divider: true, padding: 14, gap: 8 },
        catch: { font: 'sans', weight: 700, color: '#666666', size: 20 },
        name:  { font: 'sans', weight: 700, color: '#111111', size: 64 },
        price: { font: 'sans', weight: 900, color: '#111111', size: 110 },
        desc:  { font: 'sans', weight: 400, color: '#333333', size: 18 },
        note:  { font: 'sans', weight: 400, color: '#777777', size: 12 },
        badge: { bg: '#333333', color: '#ffffff' }
      }
    },
    {
      id: 'sale', name: 'セール', swatchBg: '#e60012', swatchFg: '#ffff00',
      apply: {
        design: { bg: '#ffffff', accent: '#e60012', band: 'top',
                  border: { style: 'solid', width: 3, color: '#e60012' } },
        layout: { align: 'center', valign: 'center', divider: false, padding: 12, gap: 10 },
        catch: { font: 'dela', weight: 400, color: '#ffffff', size: 30 },
        name:  { font: 'notosans', weight: 900, color: '#111111', size: 62 },
        price: { font: 'dela', weight: 400, color: '#e60012', size: 130 },
        desc:  { font: 'notosans', weight: 400, color: '#333333', size: 18 },
        note:  { font: 'notosans', weight: 400, color: '#777777', size: 12 },
        badge: { bg: '#ffe100', color: '#e60012', style: 'ribbon' }
      }
    },
    {
      id: 'pop', name: 'ポップ', swatchBg: '#ffe100', swatchFg: '#ff6a00',
      apply: {
        design: { bg: '#fff9e0', accent: '#ff8a00', band: 'behindName',
                  border: { style: 'round', width: 4, color: '#ff8a00' } },
        layout: { align: 'center', valign: 'center', divider: false, padding: 12, gap: 9 },
        catch: { font: 'rocknroll', weight: 400, color: '#ff5a00', size: 24 },
        name:  { font: 'rocknroll', weight: 400, color: '#ffffff', size: 60 },
        price: { font: 'rounded', weight: 800, color: '#ff5a00', size: 120 },
        desc:  { font: 'rounded', weight: 400, color: '#5a4a2a', size: 18 },
        note:  { font: 'rounded', weight: 400, color: '#8a7a5a', size: 12 },
        badge: { bg: '#ff5a00', color: '#ffffff', style: 'circle' }
      }
    },
    {
      id: 'natural', name: 'ナチュラル', swatchBg: '#efe7d8', swatchFg: '#5c4a33',
      apply: {
        design: { bg: '#f6f1e7', accent: '#7a6a52', band: 'none',
                  border: { style: 'double', width: 1.2, color: '#a89679' } },
        layout: { align: 'center', valign: 'center', divider: true, padding: 18, gap: 9 },
        catch: { font: 'kaisei', weight: 400, color: '#8a7355', size: 20 },
        name:  { font: 'serif', weight: 700, color: '#3d3223', size: 54 },
        price: { font: 'serif', weight: 700, color: '#3d3223', size: 92 },
        desc:  { font: 'serif', weight: 400, color: '#5c4a33', size: 17 },
        note:  { font: 'serif', weight: 400, color: '#8a7355', size: 12 },
        badge: { bg: '#7a6a52', color: '#f6f1e7', style: 'chip' }
      }
    },
    {
      id: 'handwrite', name: '手書き風', swatchBg: '#ffffff', swatchFg: '#2b6cb0',
      apply: {
        design: { bg: '#fffdf7', accent: '#2b6cb0', band: 'none',
                  border: { style: 'dashed', width: 2, color: '#2b6cb0' } },
        layout: { align: 'center', valign: 'center', divider: false, padding: 14, gap: 9 },
        catch: { font: 'yusei', weight: 400, color: '#e0533d', size: 24 },
        name:  { font: 'yusei', weight: 400, color: '#243b53', size: 58 },
        price: { font: 'yusei', weight: 400, color: '#2b6cb0', size: 118 },
        desc:  { font: 'yusei', weight: 400, color: '#334e68', size: 18 },
        note:  { font: 'yusei', weight: 400, color: '#829ab1', size: 12 },
        badge: { bg: '#e0533d', color: '#ffffff', style: 'chip' }
      }
    },
    {
      id: 'dark', name: 'ダーク', swatchBg: '#1f2933', swatchFg: '#f0b429',
      apply: {
        design: { bg: '#1f2933', accent: '#f0b429', band: 'none',
                  border: { style: 'solid', width: 1.6, color: '#f0b429' } },
        layout: { align: 'center', valign: 'center', divider: true, padding: 14, gap: 8 },
        catch: { font: 'notosans', weight: 700, color: '#f0b429', size: 20 },
        name:  { font: 'notosans', weight: 900, color: '#ffffff', size: 60 },
        price: { font: 'notosans', weight: 900, color: '#f0b429', size: 118 },
        desc:  { font: 'notosans', weight: 400, color: '#cbd2d9', size: 18 },
        note:  { font: 'notosans', weight: 400, color: '#9aa5b1', size: 12 },
        badge: { bg: '#f0b429', color: '#1f2933', style: 'chip' }
      }
    }
  ];

  var templatesById = {};
  TEMPLATES.forEach(function (t) { templatesById[t.id] = t; });

  /* ---------- 初期状態 ---------- */
  function defaultState() {
    return {
      version: 1,
      template: 'simple',
      paper: { id: 'a4', orientation: 'portrait', customW: 150, customH: 100 },

      catch: { text: '', font: 'sans', size: 20, weight: 700, color: '#666666', lineHeight: 1.3 },
      name:  { text: '', font: 'sans', size: 64, weight: 700, color: '#111111', lineHeight: 1.25 },
      price: {
        value: '', prefix: '¥', suffix: '円', unit: '', taxNote: '税込',
        font: 'sans', size: 110, weight: 900, color: '#111111',
        strike: { enabled: false, value: '' },
        comma: true
      },
      desc:  { text: '', font: 'sans', size: 18, weight: 400, color: '#333333', lineHeight: 1.6 },
      note:  { text: '', font: 'sans', size: 12, weight: 400, color: '#777777', lineHeight: 1.4 },

      badge: { enabled: false, text: 'おすすめ', style: 'chip', bg: '#333333', color: '#ffffff', size: 24 },

      /* 商品画像/ロゴ（src が空 = 画像なし）。位置・幅は mm、高さは wMm/aspect */
      image: { src: '', xMm: 0, yMm: 0, wMm: 0, aspect: 1, opacity: 1, layer: 'back' },

      design: {
        bg: '#ffffff', accent: '#333333', band: 'none',
        border: { style: 'solid', width: 1.2, color: '#333333' }
      },

      layout: {
        align: 'center', valign: 'center', padding: 14, gap: 7,
        divider: true, autoFit: true
      }
    };
  }

  /* 初回表示用のサンプル文言 */
  function sampleState() {
    var s = defaultState();
    s.catch.text = '本日のおすすめ';
    s.name.text = '北海道産 生クリーム大福';
    s.price.value = '298';
    s.desc.text = '北海道産の生クリームをたっぷり使用。\nなめらかな口どけをお楽しみください。';
    s.note.text = '※数量限定・なくなり次第終了';
    return s;
  }

  /* ===========================================================
     カードサイズ（ポップ1枚の大きさ）
     カードは orientation を持たない。幅と高さの数値がそのまま寸法（設計 §4.1）。
     向き切替を用意すると「縦横比の反転で文字が縮む」経路ができてしまうため。
     =========================================================== */
  var CARD_SIZES = [
    { id: 'c44x67', label: '44×67mm',           w: 44,  h: 67 },
    { id: 'meishi', label: '名刺（91×55mm）',    w: 91,  h: 55 },
    { id: 'a8',     label: 'A8（52×74mm）',      w: 52,  h: 74 },
    { id: 'a7',     label: 'A7（74×105mm）',     w: 74,  h: 105 },
    { id: 'b8',     label: 'B8・JIS（64×91mm）', w: 64,  h: 91 },
    { id: 'sq50',   label: '正方形（50×50mm）',  w: 50,  h: 50 },
    { id: 'custom', label: 'カスタム（mm指定）', w: 44,  h: 67 }
  ];

  var cardSizesById = {};
  CARD_SIZES.forEach(function (c) { cardSizesById[c.id] = c; });

  var CARD_MIN_MM = 10;

  /* 数値化。null / undefined / 空文字 / NaN はすべて「未指定」とみなして既定値へ落とす。
     Number(null) や Number('') は 0 になるため、isFinite だけでは弾けない。 */
  function num(v, fallback) {
    if (v === null || v === undefined || v === '') return fallback;
    var n = Number(v);
    return isFinite(n) ? n : fallback;
  }

  function r1(n) { return Math.round(n * 10) / 10; }

  /** カードの実寸（mm）。id が custom のときだけ customW/H を見る。 */
  function cardSize(card) {
    card = card || {};
    var p = cardSizesById[card.id] || cardSizesById.c44x67;
    if (p.id === 'custom') {
      return {
        w: Math.max(CARD_MIN_MM, num(card.customW, 44)),
        h: Math.max(CARD_MIN_MM, num(card.customH, 67))
      };
    }
    return { w: p.w, h: p.h };
  }

  /** シートの実寸（mm）。用紙は向き（縦/横）を持つ。 */
  function sheetSize(sheet) {
    sheet = sheet || {};
    var p = papersById[sheet.id] || papersById.a4;
    var w = p.id === 'custom' ? num(sheet.customW, 210) : p.w;
    var h = p.id === 'custom' ? num(sheet.customH, 297) : p.h;
    if (sheet.orientation === 'landscape') { var t = w; w = h; h = t; }
    return { w: w, h: h };
  }

  /** 安全余白を引いたシート内寸＝カードが入る最大の大きさ */
  function sheetInner(sheet) {
    var s = sheetSize(sheet);
    /* 安全余白の入力範囲は 0〜30mm（UI の input と同じ範囲に丸める） */
    var m = Math.max(0, Math.min(30, num(sheet && sheet.margin, 5)));
    return { w: Math.max(0, s.w - m * 2), h: Math.max(0, s.h - m * 2) };
  }

  /** カスタムカードの入力値を 10mm〜シート内寸へ丸める */
  function clampCustomCard(card, sheet) {
    var inner = sheetInner(sheet);
    var maxW = Math.max(CARD_MIN_MM, inner.w);
    var maxH = Math.max(CARD_MIN_MM, inner.h);
    return {
      customW: r1(Math.max(CARD_MIN_MM, Math.min(num(card && card.customW, 44), maxW))),
      customH: r1(Math.max(CARD_MIN_MM, Math.min(num(card && card.customH, 67), maxH)))
    };
  }

  /* ---------- 比例スケール ----------
     テンプレートの数値は A4(210×297) を前提に作られているため、44×67mm の
     カードにそのまま乗せると余白だけで潰れる。係数を値へ焼き込む方式にして、
     適用後にユーザーが個別の数値を手で直せるようにする。 */

  /** 旧寸法→新寸法の係数。縦横の入れ替えだけなら 1（面積が同じなのに縮めない）。 */
  function scaleFor(oldW, oldH, newW, newH) {
    if (oldW === newH && oldH === newW) return 1;
    return Math.min(newW / oldW, newH / oldH);
  }

  /** 基準サイズからの目標倍率と、適用済み倍率との差分を返す。
      「前回からの比率」を毎回掛けると、縮めてから戻しても scaleFor が 1 を返すため
      文字が小さいまま戻らない（利用者の「文字を勝手に縮めるな」に反する）。
      基準からの目標倍率で管理し、その差分だけを掛けることで行き来しても元に戻る。 */
  function scaleStep(scale, newW, newH) {
    var s = scale || {};
    var baseW = num(s.baseW, newW);
    var baseH = num(s.baseH, newH);
    var applied = num(s.applied, 1);
    if (!(applied > 0)) applied = 1;
    var target = scaleFor(baseW, baseH, newW, newH);
    var delta = target / applied;
    if (!isFinite(delta) || !(delta > 0)) delta = 1;
    return { delta: delta, target: target };
  }

  /** 比例計算の基準。baseW×baseH のときに applied=1（＝そのままの値）になる。 */
  function defaultScale(w, h) {
    return { baseW: w, baseH: h, applied: 1 };
  }

  var SCALE_TEXT_KEYS = ['catch', 'name', 'price', 'desc', 'note'];

  /** 対象キーが「実在するときだけ」スケールする。
      テンプレートの差分オブジェクト（一部のキーしか持たない）にも安全に使えるようにするため、
      未指定のキーを新たに作らない。 */
  function scaleProp(obj, key, scale, min) {
    if (!obj || obj[key] === undefined || obj[key] === null) return;
    var n = Number(obj[key]);
    if (!isFinite(n)) return;
    obj[key] = Math.max(min, r1(n * scale));
  }

  /* 下限を低くしてあるのは、下限に張り付いた値を元のサイズへ戻すときに
     大きな倍率が掛かって元より大きくなってしまうのを避けるため
     （実測: 注記12pt が 10mm カードで 4pt に張り付き、44mm へ戻すと 17.6pt になった）。
     文字や線が消える心配は不要で、描画側に安全弁がある
     （renderer.js の ptPx が最低1px、drawBorder が最低0.5px を保証）。 */
  /** カードの pt・余白・画像を破壊的にスケールする。sizeMm は新しいカード寸法。 */
  function scaleCard(card, scale, sizeMm) {
    if (!card || !isFinite(scale) || scale === 1) return card;

    SCALE_TEXT_KEYS.forEach(function (k) { scaleProp(card[k], 'size', scale, 1); });
    scaleProp(card.badge, 'size', scale, 1);

    scaleProp(card.layout, 'padding', scale, 0);
    scaleProp(card.layout, 'gap', scale, 0);

    /* 枠線も比例させる。不変にすると小さいカードで相対的に太くなりすぎるため。 */
    if (card.design) scaleProp(card.design.border, 'width', scale, 0.05);

    if (card.image && card.image.src) {
      scaleProp(card.image, 'wMm', scale, 10);
      card.image.xMm = r1(num(card.image.xMm, 0) * scale);
      card.image.yMm = r1(num(card.image.yMm, 0) * scale);
      if (sizeMm) clampImage(card.image, sizeMm);
    }
    return card;
  }

  /* ---------- 画像の配置クランプ（旧 app.js から移設） ----------
     ブリード（端の外へ少しはみ出す）は許容しつつ、各辺に最低 keep mm は
     カード内へ残す＝掴めなくなって復帰できない状態を防ぐ。 */
  function clampImage(im, sizeMm) {
    if (!im || !im.src) return im;
    im.wMm = Math.max(10, Math.min(600, num(im.wMm, 10)));
    var hMm = im.wMm / (num(im.aspect, 1) || 1);
    var keep = Math.min(20, im.wMm, hMm);
    im.xMm = Math.max(keep - im.wMm, Math.min(sizeMm.w - keep, num(im.xMm, 0)));
    im.yMm = Math.max(keep - hMm, Math.min(sizeMm.h - keep, num(im.yMm, 0)));
    return im;
  }

  /** 画像取り込み時の最大辺(px)。カード長辺 × 12px/mm ≒ 300dpi。
      小さいカードで 2000px を持つのは保存容量の無駄なので連動させる。 */
  function imageMaxSide(sizeMm) {
    var px = Math.round(Math.max(sizeMm.w, sizeMm.h) * 12);
    return Math.max(800, Math.min(2000, px));
  }

  /* ---------- 既定値 ---------- */
  /** カード1枚ぶんの既定状態。用紙(paper)は持たない＝大きさは doc.card 側（設計 §4.1）。 */
  function defaultCardState() {
    var s = defaultState();
    delete s.paper;
    return s;
  }

  function defaultCard() {
    return { id: 'c44x67', customW: 44, customH: 67 };
  }

  function defaultSheet() {
    return {
      id: 'a4', orientation: 'portrait', customW: 210, customH: 297,
      margin: 5, gap: 0, allowRotate: true, center: true, cutLine: true
    };
  }

  return {
    PAPERS: PAPERS,
    papersById: papersById,
    paperSize: paperSize,
    TEMPLATES: TEMPLATES,
    templatesById: templatesById,
    defaultState: defaultState,
    defaultCardState: defaultCardState,
    sampleState: sampleState,

    CARD_SIZES: CARD_SIZES,
    cardSizesById: cardSizesById,
    CARD_MIN_MM: CARD_MIN_MM,
    cardSize: cardSize,
    sheetSize: sheetSize,
    sheetInner: sheetInner,
    clampCustomCard: clampCustomCard,
    scaleFor: scaleFor,
    scaleStep: scaleStep,
    defaultScale: defaultScale,
    scaleCard: scaleCard,
    clampImage: clampImage,
    imageMaxSide: imageMaxSide,
    defaultCard: defaultCard,
    defaultSheet: defaultSheet
  };
})();
