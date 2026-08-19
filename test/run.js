/* ===========================================================
   最小テストランナー（依存ライブラリなし・Node組み込みのみ）
   実ソース(text.js / app.js / renderer.js)から対象関数を読み込んで検証する。
   実行: node test/run.js  （または npm test）
   =========================================================== */
/* eslint-disable no-eval */
var fs = require('fs');
var path = require('path');
var assert = require('assert');

var ROOT = path.join(__dirname, '..');
function read(f) { return fs.readFileSync(path.join(ROOT, f), 'utf8'); }

/* --- POPText（純粋・DOM非依存）をそのまま読み込む --- */
eval(read('assets/js/text.js'));            // defines POPText

/* --- POPImposition（純粋・DOM非依存）をそのまま読み込む --- */
eval(read('assets/js/imposition.js'));      // defines POPImposition

/* --- POPPresets（純粋・DOM非依存）をそのまま読み込む --- */
eval(read('assets/js/presets.js'));         // defines POPPresets

/* --- POPDoc（純粋・DOM非依存）をそのまま読み込む --- */
eval(read('assets/js/doc.js'));             // defines POPDoc

/* --- POPSheetView（描画は canvas 依存だが、幾何の純関数だけテストする） --- */
eval(read('assets/js/sheet-view.js'));      // defines POPSheetView

/* --- app.js から parseValue を抽出して読み込む --- */
var appSrc = read('assets/js/app.js');
var pvMatch = appSrc.match(/function parseValue\(el\) \{[\s\S]*?\n  \}/);
if (!pvMatch) throw new Error('parseValue をソースから抽出できませんでした');
eval(pvMatch[0]);                           // defines parseValue

/* --- renderer.js から ptPx を抽出して読み込む（PT_TO_MM を用意） --- */
var PT_TO_MM = 25.4 / 72;
var rSrc = read('assets/js/renderer.js');
var ptMatch = rSrc.match(/function ptPx\(pt, pxPerMm, scale\) \{[\s\S]*?\n  \}/);
if (!ptMatch) throw new Error('ptPx をソースから抽出できませんでした');
eval(ptMatch[0]);                           // defines ptPx

/* --- app.js から applyCardSizeChange を抽出して読み込む ----------------
   「比例させない」チェックOFF区間で doc.scale を書き換えない、という
   可逆性の要である分岐そのものを実ソースから検証するため、他の純関数と
   同じ「正規表現で切り出して eval」の手法で取り込む。
   自由変数（document/doc/lastCardSize/cardSizeMm/setStatus）は
   呼び出し側のテストコードで用意する（下記 callApplyCardSizeChange）。 */
var acscMatch = appSrc.match(/function applyCardSizeChange\(\) \{[\s\S]*?\n  \}/);
if (!acscMatch) throw new Error('applyCardSizeChange をソースから抽出できませんでした');
eval(acscMatch[0]);                          // defines applyCardSizeChange
var doc, lastCardSize, document, setStatus;  // applyCardSizeChange が参照する自由変数
function cardSizeMm() { return POPPresets.cardSize(doc.card); }
/** scaleWithCard=チェックボックスの状態。doc.card を書き換えてから呼ぶ。 */
function callApplyCardSizeChange(scaleWithCard) {
  document = { getElementById: function () { return { checked: scaleWithCard }; } };
  setStatus = function () {};
  applyCardSizeChange();
}

/* --- ハーネス --- */
var pass = 0, fail = 0;
function test(name, fn) {
  try { fn(); pass++; console.log('  ok  ' + name); }
  catch (e) { fail++; console.log('FAIL  ' + name + '\n      ' + e.message); }
}

/* wrap 用のモック ctx（幅 = コードポイント数 * 10px） */
function mockCtx() {
  return { font: '', measureText: function (s) { return { width: Array.from(String(s)).length * 10 }; } };
}
/* 孤立サロゲート（壊れた文字）が含まれるか */
function hasLoneSurrogate(s) {
  for (var i = 0; i < s.length; i++) {
    var c = s.charCodeAt(i);
    if (c >= 0xD800 && c <= 0xDBFF) {
      var n = s.charCodeAt(i + 1);
      if (!(n >= 0xDC00 && n <= 0xDFFF)) return true;
      i++;
    } else if (c >= 0xDC00 && c <= 0xDFFF) { return true; }
  }
  return false;
}

/* ---------- formatNumber ---------- */
test('formatNumber: 3桁区切り', function () { assert.strictEqual(POPText.formatNumber('1280'), '1,280'); });
test('formatNumber: 既存カンマを整形しなおす', function () { assert.strictEqual(POPText.formatNumber('1,280'), '1,280'); });
test('formatNumber: 小数を保持', function () { assert.strictEqual(POPText.formatNumber('1234.5'), '1,234.5'); });
test('formatNumber: 非数値はそのまま', function () { assert.strictEqual(POPText.formatNumber('時価'), '時価'); });
test('formatNumber: 空文字は空', function () { assert.strictEqual(POPText.formatNumber(''), ''); });

/* ---------- ptPx ---------- */
test('ptPx: 不正な数値でも有限値', function () { assert.ok(isFinite(ptPx('abc', 96 / 25.4, 1))); });
test('ptPx: 72pt @72dpi = 72px', function () { assert.ok(Math.abs(ptPx(72, 72 / 25.4, 1) - 72) < 1e-6); });

/* ---------- mergeDeep ---------- */
test('mergeDeep: null で既定オブジェクトを潰さない', function () {
  var b = { design: { bg: '#000' } };
  POPDoc.mergeDeep(b, { design: null });
  assert.strictEqual(b.design.bg, '#000');
});
test('mergeDeep: プロトタイプ汚染を防ぐ', function () {
  POPDoc.mergeDeep({ name: { text: '' } }, JSON.parse('{"__proto__":{"polluted":1}}'));
  assert.strictEqual(({}).polluted, undefined);
});
test('mergeDeep: 通常の深いマージ（未指定の既定は維持）', function () {
  var b = { name: { text: '', size: 10 }, price: { value: '' } };
  POPDoc.mergeDeep(b, { name: { text: 'x' }, price: { value: '980' } });
  assert.strictEqual(b.name.text, 'x');
  assert.strictEqual(b.name.size, 10);
  assert.strictEqual(b.price.value, '980');
});
test('mergeDeep: オブジェクト枠をスカラーで潰さない', function () {
  var b = { badge: { text: 'a' } };
  POPDoc.mergeDeep(b, { badge: true });
  assert.strictEqual(typeof b.badge, 'object');
});

/* ---------- parseValue（空欄→min クランプ・範囲クランプ） ---------- */
test('parseValue: 空欄は min へ（size=0 で潰れない）', function () {
  assert.strictEqual(parseValue({ type: 'number', value: '', min: '10', max: '300' }), 10);
});
test('parseValue: min 未満はクランプ', function () {
  assert.strictEqual(parseValue({ type: 'number', value: '5', min: '10', max: '300' }), 10);
});
test('parseValue: max 超はクランプ', function () {
  assert.strictEqual(parseValue({ type: 'range', value: '500', min: '10', max: '300' }), 300);
});
test('parseValue: 範囲内はそのまま', function () {
  assert.strictEqual(parseValue({ type: 'number', value: '48', min: '10', max: '300' }), 48);
});
test('parseValue: checkbox は真偽', function () {
  assert.strictEqual(parseValue({ type: 'checkbox', checked: true }), true);
});
test('parseValue: weight の SELECT は数値', function () {
  assert.strictEqual(parseValue({ tagName: 'SELECT', type: 'select-one', value: '700' }), 700);
});
test('parseValue: テキストはそのまま', function () {
  assert.strictEqual(parseValue({ type: 'text', value: '時価' }), '時価');
});

/* ---------- POPImposition（面付け計算） ---------- */
function lay(o) {
  return POPImposition.computeLayout({
    sheetW: o.sheetW, sheetH: o.sheetH,
    cardW: o.cardW, cardH: o.cardH,
    margin: o.margin, gap: o.gap || 0,
    allowRotate: o.allowRotate !== false,
    center: o.center !== false
  });
}

test('面付け: A4・44×67・余白5mm → 4列×4段=16枚・回転なし', function () {
  var L = lay({ sheetW: 210, sheetH: 297, cardW: 44, cardH: 67, margin: 5 });
  assert.strictEqual(L.cols, 4);
  assert.strictEqual(L.rows, 4);
  assert.strictEqual(L.perPage, 16);
  assert.strictEqual(L.rotate, false);
});
test('面付け: A4・44×67・余白0mm → 3列×6段=18枚・回転あり', function () {
  var L = lay({ sheetW: 210, sheetH: 297, cardW: 44, cardH: 67, margin: 0 });
  assert.strictEqual(L.cols, 3);
  assert.strictEqual(L.rows, 6);
  assert.strictEqual(L.perPage, 18);
  assert.strictEqual(L.rotate, true);
});
test('面付け: A5・44×67・余白5mm → 2列×4段=8枚・回転あり', function () {
  var L = lay({ sheetW: 148, sheetH: 210, cardW: 44, cardH: 67, margin: 5 });
  assert.strictEqual(L.perPage, 8);
  assert.strictEqual(L.rotate, true);
});
test('面付け: 同数なら回転しない（A3・余白5mm → 36枚）', function () {
  var L = lay({ sheetW: 297, sheetH: 420, cardW: 44, cardH: 67, margin: 5 });
  assert.strictEqual(L.perPage, 36);
  assert.strictEqual(L.rotate, false);
});
test('面付け: 間隔2mm・A4・余白5mm → 16枚', function () {
  var L = lay({ sheetW: 210, sheetH: 297, cardW: 44, cardH: 67, margin: 5, gap: 2 });
  assert.strictEqual(L.cols, 4);
  assert.strictEqual(L.rows, 4);
  assert.strictEqual(L.perPage, 16);
});
test('面付け: allowRotate=false なら回転しない', function () {
  var L = lay({ sheetW: 210, sheetH: 297, cardW: 44, cardH: 67, margin: 0, allowRotate: false });
  assert.strictEqual(L.rotate, false);
  assert.strictEqual(L.perPage, 16);
});
test('面付け: カードがシートより大きいと perPage=0', function () {
  var L = lay({ sheetW: 148, sheetH: 210, cardW: 200, cardH: 300, margin: 5 });
  assert.strictEqual(L.perPage, 0);
  assert.strictEqual(POPImposition.pageCount(5, L.perPage), 0);
});
test('面付け: 中央寄せの原点（A4・余白5mm・16枚）', function () {
  var L = lay({ sheetW: 210, sheetH: 297, cardW: 44, cardH: 67, margin: 5 });
  /* 内寸200×287、使用176×268 → 原点 = 5 + (200-176)/2 = 17 / 5 + (287-268)/2 = 14.5 */
  assert.ok(Math.abs(L.originX - 17) < 1e-9, 'originX=' + L.originX);
  assert.ok(Math.abs(L.originY - 14.5) < 1e-9, 'originY=' + L.originY);
});
test('面付け: center=false なら原点は余白そのもの', function () {
  var L = lay({ sheetW: 210, sheetH: 297, cardW: 44, cardH: 67, margin: 5, center: false });
  assert.strictEqual(L.originX, 5);
  assert.strictEqual(L.originY, 5);
});
test('面付け: cellRect の列・行送り（間隔2mm）', function () {
  var L = lay({ sheetW: 210, sheetH: 297, cardW: 44, cardH: 67, margin: 5, gap: 2, center: false });
  var r0 = POPImposition.cellRect(L, 0);
  var r1 = POPImposition.cellRect(L, 1);
  var r4 = POPImposition.cellRect(L, 4);
  assert.strictEqual(r0.x, 5);
  assert.strictEqual(r0.y, 5);
  assert.ok(Math.abs(r1.x - (5 + 44 + 2)) < 1e-9, 'r1.x=' + r1.x);
  assert.strictEqual(r1.y, r0.y);
  assert.strictEqual(r4.x, r0.x);
  assert.ok(Math.abs(r4.y - (5 + 67 + 2)) < 1e-9, 'r4.y=' + r4.y);
});
test('面付け: 回転時のセル外形は幅と高さが入れ替わる', function () {
  var L = lay({ sheetW: 210, sheetH: 297, cardW: 44, cardH: 67, margin: 0 });
  assert.strictEqual(L.rotate, true);
  assert.strictEqual(L.cellW, 67);
  assert.strictEqual(L.cellH, 44);
});
test('pageCount: 16枚/ページ', function () {
  assert.strictEqual(POPImposition.pageCount(1, 16), 1);
  assert.strictEqual(POPImposition.pageCount(16, 16), 1);
  assert.strictEqual(POPImposition.pageCount(17, 16), 2);
  assert.strictEqual(POPImposition.pageCount(40, 16), 3);
  assert.strictEqual(POPImposition.pageCount(0, 16), 1);
  assert.strictEqual(POPImposition.pageCount(5, 0), 0);
});

/* ---------- POPPresets（寸法解決・スケール） ---------- */
test('cardSize: プリセットはそのままの寸法（orientation を見ない）', function () {
  assert.deepStrictEqual(POPPresets.cardSize({ id: 'c44x67' }), { w: 44, h: 67 });
  assert.deepStrictEqual(POPPresets.cardSize({ id: 'meishi' }), { w: 91, h: 55 });
  assert.deepStrictEqual(
    POPPresets.cardSize({ id: 'c44x67', orientation: 'landscape' }), { w: 44, h: 67 });
});
test('cardSize: custom のときだけ customW/H を使う', function () {
  assert.deepStrictEqual(
    POPPresets.cardSize({ id: 'custom', customW: 30, customH: 40 }), { w: 30, h: 40 });
  assert.deepStrictEqual(
    POPPresets.cardSize({ id: 'c44x67', customW: 30, customH: 40 }), { w: 44, h: 67 });
});
test('cardSize: 不正値・未知のidは既定44×67', function () {
  assert.deepStrictEqual(POPPresets.cardSize({ id: 'zzz' }), { w: 44, h: 67 });
  assert.deepStrictEqual(POPPresets.cardSize(), { w: 44, h: 67 });
  assert.deepStrictEqual(
    POPPresets.cardSize({ id: 'custom', customW: 'abc', customH: null }), { w: 44, h: 67 });
});
test('cardSize: 67×44mm（横）のプリセットがある', function () {
  assert.deepStrictEqual(POPPresets.cardSize({ id: 'c67x44' }), { w: 67, h: 44 });
  /* 縦横が入れ替わっただけなので、両者の間を行き来しても文字は縮まない */
  assert.strictEqual(POPPresets.scaleFor(44, 67, 67, 44), 1);
});
test('CARD_SIZES: 既定は 44×67mm のまま', function () {
  assert.strictEqual(POPPresets.CARD_SIZES[0].id, 'c44x67');
  assert.deepStrictEqual(POPPresets.cardSize(POPPresets.defaultCard()), { w: 44, h: 67 });
});
test('sheetSize: landscape で幅と高さが入れ替わる', function () {
  assert.deepStrictEqual(POPPresets.sheetSize({ id: 'a4' }), { w: 210, h: 297 });
  assert.deepStrictEqual(
    POPPresets.sheetSize({ id: 'a4', orientation: 'landscape' }), { w: 297, h: 210 });
});
test('sheetInner: 安全余白を両側から引く', function () {
  assert.deepStrictEqual(POPPresets.sheetInner({ id: 'a4', margin: 5 }), { w: 200, h: 287 });
  assert.deepStrictEqual(POPPresets.sheetInner({ id: 'a4', margin: 0 }), { w: 210, h: 297 });
});
test('clampCustomCard: 10mm下限とシート内寸上限', function () {
  var sheet = { id: 'a4', margin: 5 };
  assert.deepStrictEqual(
    POPPresets.clampCustomCard({ customW: 3, customH: 5 }, sheet), { customW: 10, customH: 10 });
  assert.deepStrictEqual(
    POPPresets.clampCustomCard({ customW: 999, customH: 999 }, sheet), { customW: 200, customH: 287 });
  assert.deepStrictEqual(
    POPPresets.clampCustomCard({ customW: 44, customH: 67 }, sheet), { customW: 44, customH: 67 });
});
test('scaleFor: 縦横の入れ替えだけなら係数1（縮めない）', function () {
  assert.strictEqual(POPPresets.scaleFor(44, 67, 67, 44), 1);
  assert.strictEqual(POPPresets.scaleFor(67, 44, 44, 67), 1);
});
test('scaleFor: それ以外は min（はみ出さない側）', function () {
  assert.strictEqual(POPPresets.scaleFor(100, 100, 50, 50), 0.5);
  assert.strictEqual(POPPresets.scaleFor(100, 200, 50, 50), 0.25);
  assert.strictEqual(POPPresets.scaleFor(44, 67, 44, 67), 1);
});
test('scaleCard: pt と余白が比例し、下限でクランプされる', function () {
  var c = POPPresets.defaultCardState();
  c.name.size = 64; c.price.size = 110; c.layout.padding = 14; c.layout.gap = 7;
  c.design.border.width = 1.2;
  POPPresets.scaleCard(c, 0.5, { w: 105, h: 148 });
  assert.strictEqual(c.name.size, 32);
  assert.strictEqual(c.price.size, 55);
  assert.strictEqual(c.layout.padding, 7);
  assert.strictEqual(c.layout.gap, 3.5);
  assert.strictEqual(c.design.border.width, 0.6);
});
test('scaleCard: 文字は1pt・枠線は0.05mm を下回らない', function () {
  /* 下限を 4pt/0.3mm から 1pt/0.05mm へ引き下げた（下限に張り付いた値が
     元のサイズへ戻るとき膨らむのを防ぐため。描画側の安全弁は renderer.js 参照）。 */
  var c = POPPresets.defaultCardState();
  c.name.size = 10; c.design.border.width = 1.2;
  POPPresets.scaleCard(c, 0.01, { w: 20, h: 20 });
  assert.strictEqual(c.name.size, 1);
  assert.strictEqual(c.design.border.width, 0.05);
});
test('scaleCard: 行間・色・文章は変えない', function () {
  var c = POPPresets.defaultCardState();
  c.name.text = 'ポップ'; c.name.lineHeight = 1.25; c.name.color = '#111111';
  POPPresets.scaleCard(c, 0.3, { w: 44, h: 67 });
  assert.strictEqual(c.name.text, 'ポップ');
  assert.strictEqual(c.name.lineHeight, 1.25);
  assert.strictEqual(c.name.color, '#111111');
});
test('scaleCard: 係数1なら何も変わらない', function () {
  var c = POPPresets.defaultCardState();
  c.name.size = 64;
  POPPresets.scaleCard(c, 1, { w: 44, h: 67 });
  assert.strictEqual(c.name.size, 64);
});
test('scaleCard: 差分オブジェクトに未指定のキーを作らない（テンプレ用）', function () {
  /* テンプレートの apply は一部のキーしか持たない。ここで size を勝手に
     生やすと、ユーザーが設定した値をテンプレ適用が上書きしてしまう。 */
  var patch = {
    design: { bg: '#fff', border: { style: 'solid', width: 3, color: '#e60012' } },
    layout: { align: 'center', padding: 12, gap: 10 },
    badge: { bg: '#ffe100', color: '#e60012', style: 'ribbon' },
    name: { font: 'sans', weight: 900, color: '#111', size: 62 }
  };
  POPPresets.scaleCard(patch, 0.5, { w: 105, h: 148 });
  assert.strictEqual(patch.badge.size, undefined);
  assert.strictEqual(patch.catch, undefined);
  assert.strictEqual(patch.name.size, 31);
  assert.strictEqual(patch.layout.padding, 6);
  assert.strictEqual(patch.design.border.width, 1.5);
  assert.strictEqual(patch.layout.align, 'center');
});
test('clampImage: ブリードは許すが最低20mmはカード内に残す', function () {
  var im = { src: 'x', wMm: 30, aspect: 1, xMm: 999, yMm: -999 };
  POPPresets.clampImage(im, { w: 44, h: 67 });
  assert.strictEqual(im.xMm, 44 - 20);
  assert.strictEqual(im.yMm, 20 - 30);
});
test('clampImage: 幅は10〜600mm', function () {
  var im = { src: 'x', wMm: 5, aspect: 1, xMm: 0, yMm: 0 };
  POPPresets.clampImage(im, { w: 44, h: 67 });
  assert.strictEqual(im.wMm, 10);
});
test('imageMaxSide: カード長辺×12px、800〜2000で頭打ち', function () {
  assert.strictEqual(POPPresets.imageMaxSide({ w: 44, h: 67 }), 804);
  assert.strictEqual(POPPresets.imageMaxSide({ w: 20, h: 20 }), 800);
  assert.strictEqual(POPPresets.imageMaxSide({ w: 210, h: 297 }), 2000);
});

test('scaleStep: 基準からの目標倍率と差分を返す', function () {
  var sc = POPPresets.defaultScale(44, 67);
  var a = POPPresets.scaleStep(sc, 30, 67);
  assert.ok(Math.abs(a.target - 30 / 44) < 1e-9, 'target=' + a.target);
  assert.ok(Math.abs(a.delta - 30 / 44) < 1e-9, 'delta=' + a.delta);
});
test('scaleStep: 元のサイズへ戻すと差分が逆数になる（可逆）', function () {
  var sc = POPPresets.defaultScale(44, 67);
  sc.applied = POPPresets.scaleStep(sc, 30, 67).target;
  var back = POPPresets.scaleStep(sc, 44, 67);
  assert.strictEqual(back.target, 1);
  assert.ok(Math.abs(back.delta - 44 / 30) < 1e-9, 'delta=' + back.delta);
});
test('scaleStep: applied が不正でも 1 として扱う', function () {
  var sc = { baseW: 44, baseH: 67, applied: 0 };
  assert.ok(isFinite(POPPresets.scaleStep(sc, 30, 67).delta));
  var sc2 = { baseW: 44, baseH: 67, applied: 'x' };
  assert.ok(isFinite(POPPresets.scaleStep(sc2, 30, 67).delta));
});
test('カードサイズを行き来しても文字が元の大きさに戻る', function () {
  var c = POPPresets.defaultCardState();
  c.name.size = 64;
  c.layout.padding = 14;
  var sc = POPPresets.defaultScale(44, 67);

  var down = POPPresets.scaleStep(sc, 30, 67);
  POPPresets.scaleCard(c, down.delta, { w: 30, h: 67 });
  sc.applied = down.target;
  assert.ok(c.name.size < 64, '縮んでいること: ' + c.name.size);

  var up = POPPresets.scaleStep(sc, 44, 67);
  POPPresets.scaleCard(c, up.delta, { w: 44, h: 67 });
  sc.applied = up.target;
  /* 0.1pt / 0.1mm 単位の丸めぶんだけ誤差が出るので許容幅を持たせる */
  assert.ok(Math.abs(c.name.size - 64) < 0.5, 'name.size=' + c.name.size);
  assert.ok(Math.abs(c.layout.padding - 14) < 0.5, 'padding=' + c.layout.padding);
});
test('小刻みに縮めてから戻しても積み重ならない', function () {
  var c = POPPresets.defaultCardState();
  c.name.size = 64;
  var sc = POPPresets.defaultScale(44, 67);
  /* 矢印キーで 44 → 40 → 36 → 32 と下げてから 44 へ戻す操作を模す */
  [40, 36, 32].forEach(function (w) {
    var st = POPPresets.scaleStep(sc, w, 67);
    POPPresets.scaleCard(c, st.delta, { w: w, h: 67 });
    sc.applied = st.target;
  });
  var back = POPPresets.scaleStep(sc, 44, 67);
  POPPresets.scaleCard(c, back.delta, { w: 44, h: 67 });
  sc.applied = back.target;
  assert.ok(Math.abs(c.name.size - 64) < 0.5, 'name.size=' + c.name.size);
});
test('極端に縮めてから戻しても、小さい項目が元より大きくならない', function () {
  var c = POPPresets.defaultCardState();
  var sc = POPPresets.defaultScale(44, 67);
  var note0 = c.note.size, border0 = c.design.border.width;
  [20, 10, 44].forEach(function (w) {
    var st = POPPresets.scaleStep(sc, w, 67);
    POPPresets.scaleCard(c, st.delta, { w: w, h: 67 });
    sc.applied = st.target;
  });
  /* 下限に張り付いた値が戻すときに大きな倍率を掛けられ、元より大きくなっていた。
     border.width の許容誤差は 0.1mm 単位の丸め(r1)が3段を経て蓄積するぶんを見込んで
     0.15 とする（実測: 3段の往復で 1.2mm→1.3mm、丸めのみの誤差で floor には未到達）。 */
  assert.ok(Math.abs(c.note.size - note0) < 0.5, 'note.size=' + c.note.size + ' (元 ' + note0 + ')');
  assert.ok(Math.abs(c.design.border.width - border0) < 0.15,
            'border.width=' + c.design.border.width + ' (元 ' + border0 + ')');
  assert.ok(Math.abs(c.name.size - 64) < 0.5, 'name.size=' + c.name.size);
});
test('比例させない区間を挟んでも、元のサイズに戻せば文字は元のまま', function () {
  var c = POPPresets.defaultCardState();
  var sc = POPPresets.defaultScale(44, 67);
  var size0 = c.name.size;
  /* 「文字とレイアウトも比例させる」を外して 30×50 へ変えた＝値も基準も触らない */
  /* そのあとチェックを入れて 44×67 へ戻す */
  var st = POPPresets.scaleStep(sc, 44, 67);
  POPPresets.scaleCard(c, st.delta, { w: 44, h: 67 });
  sc.applied = st.target;
  assert.strictEqual(st.target, 1);
  assert.ok(Math.abs(c.name.size - size0) < 0.01, 'name.size=' + c.name.size);
});
test('applyCardSizeChange（実ソース）: OFF区間を挟んでも元のサイズへ戻せば文字は膨らまない', function () {
  /* 上のテストは POPPresets の基準計算だけを検証しており、実際にバグがあった
     app.js の分岐（チェックOFF時に doc.scale を置き直していた箇所）は通っていない。
     ここでは app.js から実際の applyCardSizeChange を抽出して直接呼び、
     「OFF のまま30×50へ→ONで44×67へ戻す」という実測の再現手順そのものを検証する。 */
  var card = POPPresets.defaultCardState();
  card.name.size = 64;
  doc = {
    card: { id: 'custom', customW: 44, customH: 67 },
    scale: POPPresets.defaultScale(44, 67),
    cards: [card]
  };
  lastCardSize = null;
  callApplyCardSizeChange(true);                              /* 初回は基準記録のみ */
  doc.card = { id: 'custom', customW: 30, customH: 50 };
  callApplyCardSizeChange(false);                              /* OFF: 30×50 へ（値据え置き） */
  doc.card = { id: 'custom', customW: 44, customH: 67 };
  callApplyCardSizeChange(true);                               /* ON: 44×67 へ戻す */
  assert.ok(Math.abs(card.name.size - 64) < 0.5, 'name.size=' + card.name.size);
});

/* ---------- POPDoc（ドキュメント操作・移行） ---------- */
test('defaultDoc: カード1枚・44×67mm・A4シート', function () {
  var d = POPDoc.defaultDoc();
  assert.strictEqual(d.version, 2);
  assert.strictEqual(d.cards.length, 1);
  assert.strictEqual(d.activeIndex, 0);
  assert.deepStrictEqual(POPPresets.cardSize(d.card), { w: 44, h: 67 });
  assert.strictEqual(d.sheet.id, 'a4');
  assert.strictEqual(d.sheet.margin, 5);
});
test('defaultDoc: 比例計算の基準を持つ', function () {
  var d = POPDoc.defaultDoc();
  assert.strictEqual(d.scale.baseW, 44);
  assert.strictEqual(d.scale.baseH, 67);
  assert.strictEqual(d.scale.applied, 1);
});
test('normalize: scale が無い古いデータでも補われる', function () {
  var d = POPDoc.defaultDoc();
  delete d.scale;
  POPDoc.normalize(d);
  assert.strictEqual(d.scale.applied, 1);
  assert.strictEqual(d.scale.baseW, 44);
});
test('normalize: 基準が壊れていても現在のカードサイズで補われる', function () {
  var d = POPDoc.defaultDoc();
  d.scale = { baseW: 0, baseH: -5, applied: 1 };
  POPDoc.normalize(d);
  assert.strictEqual(d.scale.baseW, 44);
  assert.strictEqual(d.scale.baseH, 67);
  assert.ok(isFinite(POPPresets.scaleStep(d.scale, 30, 67).target));
});
test('migrate: v1（A4の単品）→ カード1枚・シートもA4・余白0', function () {
  var v1 = POPPresets.sampleState();
  v1.paper = { id: 'a4', orientation: 'portrait', customW: 150, customH: 100 };
  var d = POPDoc.migrate(v1);
  assert.strictEqual(d.version, 2);
  assert.strictEqual(d.cards.length, 1);
  assert.deepStrictEqual(POPPresets.cardSize(d.card), { w: 210, h: 297 });
  assert.deepStrictEqual(POPPresets.sheetSize(d.sheet), { w: 210, h: 297 });
  assert.strictEqual(d.sheet.margin, 0);
  assert.strictEqual(d.sheet.cutLine, false);
  assert.strictEqual(d.cards[0].paper, undefined);
  assert.strictEqual(d.cards[0].name.text, v1.name.text);
});
test('migrate: v1（A5横）でもカードとシートが同寸になる', function () {
  var v1 = POPPresets.sampleState();
  v1.paper = { id: 'a5', orientation: 'landscape', customW: 150, customH: 100 };
  var d = POPDoc.migrate(v1);
  assert.deepStrictEqual(POPPresets.cardSize(d.card), { w: 210, h: 148 });
  assert.deepStrictEqual(POPPresets.sheetSize(d.sheet), { w: 210, h: 148 });
  /* 1ページに1枚＝従来と同じ印刷結果 */
  var L = POPImposition.computeLayout({
    sheetW: 210, sheetH: 148, cardW: 210, cardH: 148,
    margin: 0, gap: 0, allowRotate: true, center: true
  });
  assert.strictEqual(L.perPage, 1);
});
test('migrate: v1 は旧用紙の寸法が比例計算の基準になる', function () {
  var v1 = POPPresets.sampleState();
  v1.paper = { id: 'a5', orientation: 'portrait', customW: 150, customH: 100 };
  var d = POPDoc.migrate(v1);
  assert.strictEqual(d.scale.baseW, 148);
  assert.strictEqual(d.scale.baseH, 210);
  assert.strictEqual(d.scale.applied, 1);
});
test('migrate: v2 はそのまま（冪等）', function () {
  var d1 = POPDoc.defaultDoc();
  d1.cards[0].name.text = 'テスト';
  var d2 = POPDoc.migrate(JSON.parse(JSON.stringify(d1)));
  assert.strictEqual(d2.cards.length, 1);
  assert.strictEqual(d2.cards[0].name.text, 'テスト');
  assert.strictEqual(POPDoc.migrate(d2).cards[0].name.text, 'テスト');
});
test('migrate: 壊れたデータは null', function () {
  assert.strictEqual(POPDoc.migrate(null), null);
  assert.strictEqual(POPDoc.migrate('abc'), null);
  assert.strictEqual(POPDoc.migrate(123), null);
});
test('normalize: activeIndex を範囲内へ丸める', function () {
  var d = POPDoc.defaultDoc();
  d.cards.push(POPPresets.defaultCardState());
  d.activeIndex = 99;
  POPDoc.normalize(d);
  assert.strictEqual(d.activeIndex, 1);
  d.activeIndex = -5;
  POPDoc.normalize(d);
  assert.strictEqual(d.activeIndex, 0);
  d.activeIndex = 'x';
  POPDoc.normalize(d);
  assert.strictEqual(d.activeIndex, 0);
});
test('normalize: cards が空・非配列なら1枚補う', function () {
  var d = POPDoc.defaultDoc();
  d.cards = [];
  POPDoc.normalize(d);
  assert.strictEqual(d.cards.length, 1);
  d.cards = null;
  POPDoc.normalize(d);
  assert.strictEqual(d.cards.length, 1);
});
test('normalize: 上限100枚で切り詰める', function () {
  var d = POPDoc.defaultDoc();
  for (var i = 0; i < 150; i++) d.cards.push(POPPresets.defaultCardState());
  POPDoc.normalize(d);
  assert.strictEqual(d.cards.length, 100);
});
test('normalize: margin/gap をクランプする', function () {
  var d = POPDoc.defaultDoc();
  d.sheet.margin = 99; d.sheet.gap = -3;
  POPDoc.normalize(d);
  assert.strictEqual(d.sheet.margin, 30);
  assert.strictEqual(d.sheet.gap, 0);
});
test('normalize: カードの欠損キーを既定で補う', function () {
  var d = POPDoc.defaultDoc();
  d.cards = [{ name: { text: 'のみ' } }];
  POPDoc.normalize(d);
  assert.strictEqual(d.cards[0].name.text, 'のみ');
  assert.strictEqual(d.cards[0].price.prefix, '¥');
  assert.strictEqual(d.cards[0].layout.padding, 14);
});
test('addCard: 追加した位置を返し、選択が移る', function () {
  var d = POPDoc.defaultDoc();
  var i = POPDoc.addCard(d, POPPresets.defaultCardState());
  assert.strictEqual(i, 1);
  assert.strictEqual(d.cards.length, 2);
  assert.strictEqual(d.activeIndex, 1);
});
test('addCard: 100枚を超えたら -1 を返し増えない', function () {
  var d = POPDoc.defaultDoc();
  while (d.cards.length < 100) d.cards.push(POPPresets.defaultCardState());
  assert.strictEqual(POPDoc.addCard(d, POPPresets.defaultCardState()), -1);
  assert.strictEqual(d.cards.length, 100);
});
test('duplicateCard: 直後に複製が入り、元と独立している', function () {
  var d = POPDoc.defaultDoc();
  d.cards[0].name.text = '元';
  var i = POPDoc.duplicateCard(d, 0);
  assert.strictEqual(i, 1);
  assert.strictEqual(d.cards[1].name.text, '元');
  d.cards[1].name.text = '複製';
  assert.strictEqual(d.cards[0].name.text, '元');
});
test('removeCard: 最後の1枚は消せない', function () {
  var d = POPDoc.defaultDoc();
  assert.strictEqual(POPDoc.removeCard(d, 0), false);
  assert.strictEqual(d.cards.length, 1);
});
test('removeCard: 削除後は同じ位置（末尾なら新しい末尾）を選ぶ', function () {
  var d = POPDoc.defaultDoc();
  POPDoc.addCard(d, POPPresets.defaultCardState());
  POPDoc.addCard(d, POPPresets.defaultCardState());
  d.activeIndex = 1;
  assert.strictEqual(POPDoc.removeCard(d, 1), true);
  assert.strictEqual(d.cards.length, 2);
  assert.strictEqual(d.activeIndex, 1);
  assert.strictEqual(POPDoc.removeCard(d, 1), true);
  assert.strictEqual(d.activeIndex, 0);
});
test('moveCard: 並べ替えても選択中のカードが追従する', function () {
  var d = POPDoc.defaultDoc();
  d.cards[0].name.text = 'A';
  POPDoc.addCard(d, POPPresets.defaultCardState());
  d.cards[1].name.text = 'B';
  POPDoc.addCard(d, POPPresets.defaultCardState());
  d.cards[2].name.text = 'C';
  d.activeIndex = 0;
  assert.strictEqual(POPDoc.moveCard(d, 0, 2), true);
  assert.deepStrictEqual(d.cards.map(function (c) { return c.name.text; }), ['B', 'C', 'A']);
  assert.strictEqual(d.activeIndex, 2);
});
test('moveCard: 選択中でないカードを動かしても選択は元のカードを追い続ける', function () {
  var d = POPDoc.defaultDoc();
  d.cards[0].name.text = 'A';
  POPDoc.addCard(d, POPPresets.defaultCardState());
  d.cards[1].name.text = 'B';
  POPDoc.addCard(d, POPPresets.defaultCardState());
  d.cards[2].name.text = 'C';
  d.activeIndex = 2;                      /* C を選択中 */
  POPDoc.moveCard(d, 0, 2);               /* A を末尾へ。C は動かしていない */
  assert.deepStrictEqual(d.cards.map(function (c) { return c.name.text; }), ['B', 'C', 'A']);
  assert.strictEqual(d.cards[d.activeIndex].name.text, 'C');
  assert.strictEqual(d.activeIndex, 1);
});
test('sampleDoc: カード1枚・44×67mm・テンプレの文字サイズが縮んでいる', function () {
  var d = POPDoc.sampleDoc();
  assert.strictEqual(d.cards.length, 1);
  assert.deepStrictEqual(POPPresets.cardSize(d.card), { w: 44, h: 67 });
  assert.strictEqual(d.cards[0].paper, undefined);
  /* A4前提の 64pt がそのまま乗ると 44mm 幅で潰れるため、比例縮小されていること */
  assert.ok(d.cards[0].name.size < 64, 'name.size=' + d.cards[0].name.size);
  assert.ok(d.cards[0].name.size >= 4);
  assert.ok(d.cards[0].layout.padding < 14, 'padding=' + d.cards[0].layout.padding);
  assert.ok(String(d.cards[0].name.text).length > 0, 'サンプル文言が入っていること');
});
test('applyDesignToAll: 見た目だけ配り、文章と画像は触らない', function () {
  var d = POPDoc.defaultDoc();
  POPDoc.addCard(d, POPPresets.defaultCardState());
  d.cards[0].design.bg = '#ff0000';
  d.cards[0].name.size = 20;
  d.cards[0].name.text = 'もと';
  d.cards[1].name.text = 'さき';
  d.cards[1].price.value = '980';
  d.cards[1].image = { src: 'data:x', xMm: 1, yMm: 2, wMm: 3, aspect: 1, opacity: 1, layer: 'back' };
  var n = POPDoc.applyDesignToAll(d, 0);
  assert.strictEqual(n, 1);
  assert.strictEqual(d.cards[1].design.bg, '#ff0000');
  assert.strictEqual(d.cards[1].name.size, 20);
  assert.strictEqual(d.cards[1].name.text, 'さき');
  assert.strictEqual(d.cards[1].price.value, '980');
  assert.strictEqual(d.cards[1].image.src, 'data:x');
});

/* ---------- POPSheetView（セル配置の幾何） ---------- */
function docFor(cardW, cardH, sheetId, margin) {
  var d = POPDoc.defaultDoc();
  d.card = { id: 'custom', customW: cardW, customH: cardH };
  d.sheet.id = sheetId;
  d.sheet.margin = margin;
  return d;
}

test('sheetView: A4・44×67・余白5mm のページ数', function () {
  var d = docFor(44, 67, 'a4', 5);
  while (d.cards.length < 40) d.cards.push(POPPresets.defaultCardState());
  assert.strictEqual(POPSheetView.layoutOf(d).perPage, 16);
  assert.strictEqual(POPSheetView.pagesOf(d), 3);
});
test('sheetView: ページごとのカード添字', function () {
  var d = docFor(44, 67, 'a4', 5);
  while (d.cards.length < 20) d.cards.push(POPPresets.defaultCardState());
  assert.deepStrictEqual(POPSheetView.cardIndexesOnPage(d, 0).length, 16);
  assert.deepStrictEqual(POPSheetView.cardIndexesOnPage(d, 1), [16, 17, 18, 19]);
  assert.deepStrictEqual(POPSheetView.cardIndexesOnPage(d, 2), []);
});
test('cellTransform: 回転なしはセル左上へ平行移動するだけ', function () {
  var d = docFor(44, 67, 'a4', 5);
  var L = POPSheetView.layoutOf(d);
  var t = POPSheetView.cellTransform(L, 0);
  assert.strictEqual(t.rot, 0);
  assert.ok(Math.abs(t.tx - 17) < 1e-9, 'tx=' + t.tx);
  assert.ok(Math.abs(t.ty - 14.5) < 1e-9, 'ty=' + t.ty);
});
test('cellTransform: 回転ありはセル右上へ寄せて90°回す', function () {
  var d = docFor(44, 67, 'a4', 0);
  var L = POPSheetView.layoutOf(d);
  assert.strictEqual(L.rotate, true);
  var t = POPSheetView.cellTransform(L, 0);
  assert.ok(Math.abs(t.rot - Math.PI / 2) < 1e-12);
  /* セル外形は 67×44。回転後にローカル+xが下・+yが左を向くので、
     原点はセルの右上（x + cellW）に置く。 */
  var r = POPImposition.cellRect(L, 0);
  assert.ok(Math.abs(t.tx - (r.x + r.w)) < 1e-9, 'tx=' + t.tx);
  assert.ok(Math.abs(t.ty - r.y) < 1e-9, 'ty=' + t.ty);
});
test('hitTest: セル内の座標からカード添字が引ける', function () {
  var d = docFor(44, 67, 'a4', 5);
  while (d.cards.length < 16) d.cards.push(POPPresets.defaultCardState());
  /* 1枚目の中心 = (17+22, 14.5+33.5) */
  assert.strictEqual(POPSheetView.hitTest(d, 0, { x: 39, y: 48 }), 0);
  /* 2枚目の中心 = (17+44+22, 14.5+33.5) */
  assert.strictEqual(POPSheetView.hitTest(d, 0, { x: 83, y: 48 }), 1);
  /* 余白の上 */
  assert.strictEqual(POPSheetView.hitTest(d, 0, { x: 2, y: 2 }), -1);
});
test('hitTest: カード数より後ろの空きセルは -1', function () {
  var d = docFor(44, 67, 'a4', 5);
  assert.strictEqual(d.cards.length, 1);
  assert.strictEqual(POPSheetView.hitTest(d, 0, { x: 83, y: 48 }), -1);
});
test('sheetView: カードがシートより大きいときは各関数が安全に抜ける', function () {
  var d = POPDoc.defaultDoc();
  d.card = { id: 'custom', customW: 400, customH: 500 };   /* A4 に入らない大きさ */
  var L = POPSheetView.layoutOf(d);
  assert.strictEqual(L.perPage, 0);
  assert.strictEqual(POPSheetView.pagesOf(d), 0);
  assert.deepStrictEqual(POPSheetView.cardIndexesOnPage(d, 0), []);
  assert.strictEqual(POPSheetView.hitTest(d, 0, { x: 10, y: 10 }), -1);
});

/* ---------- POPText.wrap ---------- */
test('wrap: 長い連続語が全行 maxWidth 以内', function () {
  var ctx = mockCtx();
  var lines = POPText.wrap(ctx, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 30);
  lines.forEach(function (l) { assert.ok(ctx.measureText(l).width <= 30, '幅超過: ' + l); });
  assert.strictEqual(lines.join(''), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ');
});
test('wrap: 行頭に来た長い語も分割される', function () {
  var ctx = mockCtx();
  var lines = POPText.wrap(ctx, 'WWWWWWWWWWWWWW xyz', 30);
  lines.forEach(function (l) { assert.ok(ctx.measureText(l).width <= 30, '幅超過: ' + l); });
});
test('wrap: サロゲートペア（絵文字）を壊さない', function () {
  var ctx = mockCtx();
  var text = '😀😀😀😀😀';
  var lines = POPText.wrap(ctx, text, 25);
  lines.forEach(function (l) { assert.ok(!hasLoneSurrogate(l), '壊れた文字: ' + JSON.stringify(l)); });
  assert.strictEqual(lines.join(''), text);
});
test('wrap: 改行を段落として保持', function () {
  var ctx = mockCtx();
  assert.deepStrictEqual(POPText.wrap(ctx, 'あ\nい', 100), ['あ', 'い']);
});

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
