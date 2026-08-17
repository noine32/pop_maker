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

/* --- app.js から mergeDeep を抽出して読み込む --- */
var appSrc = read('assets/js/app.js');
var mdMatch = appSrc.match(/function mergeDeep\(base, patch\) \{[\s\S]*?\n  \}/);
if (!mdMatch) throw new Error('mergeDeep をソースから抽出できませんでした');
eval(mdMatch[0]);                           // defines mergeDeep

/* --- app.js から parseValue を抽出して読み込む --- */
var pvMatch = appSrc.match(/function parseValue\(el\) \{[\s\S]*?\n  \}/);
if (!pvMatch) throw new Error('parseValue をソースから抽出できませんでした');
eval(pvMatch[0]);                           // defines parseValue

/* --- renderer.js から ptPx を抽出して読み込む（PT_TO_MM を用意） --- */
var PT_TO_MM = 25.4 / 72;
var rSrc = read('assets/js/renderer.js');
var ptMatch = rSrc.match(/function ptPx\(pt, pxPerMm, scale\) \{[\s\S]*?\n  \}/);
if (!ptMatch) throw new Error('ptPx をソースから抽出できませんでした');
eval(ptMatch[0]);                           // defines ptPx

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
  mergeDeep(b, { design: null });
  assert.strictEqual(b.design.bg, '#000');
});
test('mergeDeep: プロトタイプ汚染を防ぐ', function () {
  mergeDeep({ name: { text: '' } }, JSON.parse('{"__proto__":{"polluted":1}}'));
  assert.strictEqual(({}).polluted, undefined);
});
test('mergeDeep: 通常の深いマージ（未指定の既定は維持）', function () {
  var b = { name: { text: '', size: 10 }, price: { value: '' } };
  mergeDeep(b, { name: { text: 'x' }, price: { value: '980' } });
  assert.strictEqual(b.name.text, 'x');
  assert.strictEqual(b.name.size, 10);
  assert.strictEqual(b.price.value, '980');
});
test('mergeDeep: オブジェクト枠をスカラーで潰さない', function () {
  var b = { badge: { text: 'a' } };
  mergeDeep(b, { badge: true });
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
