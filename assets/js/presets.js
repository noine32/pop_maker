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
    { id: 'meishi',  label: '名刺（91×55mm）',          w: 55,  h: 91,  group: 'その他定型' },
    { id: 'square',  label: '正方形（100×100mm）',      w: 100, h: 100, group: 'その他定型' },
    { id: 'strip',   label: '短冊（210×74mm）',         w: 74,  h: 210, group: 'その他定型' },
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

  return {
    PAPERS: PAPERS,
    papersById: papersById,
    paperSize: paperSize,
    TEMPLATES: TEMPLATES,
    templatesById: templatesById,
    defaultState: defaultState,
    sampleState: sampleState
  };
})();
