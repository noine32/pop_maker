# 複数ポップの一括作成と面付け印刷 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 1ポップ=1用紙だった商品ポップメーカーを「カード（既定44×67mm）＋シート（A4等）」の2層構造に変え、内容の異なるカードを複数枚まとめて作り、シートへ自動で面付けして余白を最小化して印刷できるようにする。

**Architecture:** 既存の描画関数 `POPRenderer.draw()` は「原点(0,0)にカード1枚を描く」まま変えず、新しいシート合成層が `ctx.translate()`（必要なら `rotate()`）してからカード数ぶん呼び出す。状態は `doc = { card, sheet, cards[], activeIndex }` に包み、`state` は「選択中カードへの参照」として残すことで既存の編集パネル・イベント配線をそのまま活かす。面付け計算は DOM 非依存の純関数に切り出して Node でテストする。

**Tech Stack:** 依存ライブラリなしの素の HTML / CSS / JavaScript（ES5 相当・`var` と IIFE）。ES Modules は使わず `<script>` 直読み。テストは Node 組み込みのみ（`node test/run.js`）。

**元となる仕様書:** `docs/superpowers/specs/2026-08-18-multi-card-imposition-design.md`

## Global Constraints

- **依存ライブラリを追加しない。** ビルド工程も追加しない。`index.html` をダブルクリック（`file://`）して動くこと。
- **ES Modules を使わない。** 各ファイルは `var POPXxx = (function () { 'use strict'; ... })();` の IIFE でグローバルを1つ公開する（既存 `POPText` / `POPPresets` / `POPRenderer` / `POPStorage` と同じ形）。
- **ES5 相当の構文で書く。** `var` を使い、アロー関数・`let`/`const`・テンプレートリテラル・`class` を使わない（既存コードの流儀に合わせる）。
- **1ファイル 800 行以内。** 超えそうなら責務で分割する。
- **コメントは日本語。** 既存ファイルと同じく「なぜそうしているか」を書く。
- **プレビューと書き出しは同じ描画関数を使う。** `pxPerMm` を変えるだけで解像度が変わる構造を壊さない。
- **カードには `orientation` を持たせない。** 幅と高さの数値がそのまま寸法（仕様 §4.1）。縦横比の反転で文字が縮む経路を作らない。
- **面付けの回転はカードの中身に影響させない。** 文字サイズ・余白は変えない。
- **カードサイズの既定は 44×67mm。** シートの既定は A4・安全余白 5mm・間隔 0mm・自動回転あり・中央寄せあり・カット線あり。
- **カード枚数の上限は 100。** 最後の 1 枚は削除できない。
- 既存テスト（`formatNumber` / `ptPx` / `mergeDeep` / `parseValue` / `POPText.wrap`）は 1 件も壊さない。
- コミットメッセージは `<type>: <説明>` 形式（`feat` / `fix` / `refactor` / `docs` / `test` / `chore`）。日本語で書く。

## 作業ブランチ

すでに `feat/multi-card-imposition` を作成済み（仕様書のコミット `83962be` が入っている）。このブランチで作業する。

## File Structure

| ファイル | 責務 | 状態 |
| --- | --- | --- |
| `assets/js/imposition.js` | 面付け計算だけ。DOM 非依存の純関数（`fit` / `computeLayout` / `cellRect` / `pageCount`） | 新規 |
| `assets/js/doc.js` | ドキュメント操作（既定値・v1移行・正規化・カードの追加/複製/削除/移動・全カードへデザイン適用） | 新規 |
| `assets/js/sheet-view.js` | シート合成描画（`drawSheet` / `renderSheetToCanvas`）とセルのヒットテスト | 新規 |
| `assets/js/cards-ui.js` | カード一覧の DOM 構築とイベント（サムネイル・キーボード・並べ替え） | 新規 |
| `assets/js/image-tool.js` | 商品画像の操作（ドラッグ・リサイズ・取り込み・読み込みキャッシュ） | 新規（`app.js` から移設） |
| `assets/js/preset-ui.js` | 「名前を付けて保存」したデザインの一覧と操作 | 新規（`app.js` から移設） |
| `assets/js/export-tool.js` | 出力（面付けシートの印刷・PNG保存） | 新規（`app.js` から移設・Task 9） |
| `assets/js/presets.js` | カードサイズ表・寸法解決・比例スケール・画像クランプ・既定ドキュメント | 変更 |
| `assets/js/renderer.js` | カード1枚の描画。`draw()` に寸法引数 `sizeMm` を追加するだけ | 変更 |
| `assets/js/storage.js` | 自動保存キーを v2 に変更 | 変更 |
| `assets/js/app.js` | パネル・イベント配線・出力。カード一覧は `cards-ui.js` へ移譲 | 変更 |
| `index.html` | カード一覧・プレビュータブ・カード/シート設定の markup を追加 | 変更 |
| `assets/css/style.css` | 上記のスタイル | 変更 |
| `test/run.js` | 面付け・寸法解決・スケール・移行のテストを追加 | 変更 |

`index.html` の読み込み順は
`fonts → text → presets → imposition → renderer → sheet-view → doc → storage → image-tool → preset-ui → export-tool → cards-ui → app`。

`app.js` は現在 798 行あり、Global Constraints の 800 行に既に達している。Task 6 の時点で
超えてしまうため、**Task 6 で画像操作とプリセットUIを切り出して減量してから**機能を足す。

---

## Task 1: 面付け計算モジュール

シート上にカードが何枚・何列何段で並ぶか、回転させた方が多く入るかを求める純関数を作る。DOM に触れないので Node からそのままテストできる。

**Files:**
- Create: `assets/js/imposition.js`
- Modify: `test/run.js`（新しいテストを追記）
- Modify: `index.html`（`<script>` を1行追加）

**Interfaces:**
- Consumes: なし（このモジュールは何にも依存しない）
- Produces:
  - `POPImposition.fit(innerW, innerH, w, h, gap) -> { cols:number, rows:number, count:number }`
  - `POPImposition.computeLayout({ sheetW, sheetH, cardW, cardH, margin, gap, allowRotate, center }) -> { cols, rows, perPage, rotate, cellW, cellH, gap, usedW, usedH, originX, originY }`（すべて number、`rotate` のみ boolean。単位は mm）
  - `POPImposition.cellRect(layout, i) -> { x, y, w, h }`（mm・シート左上が原点。`layout.perPage > 0` のときだけ呼ぶこと）
  - `POPImposition.pageCount(n, perPage) -> number`（`perPage <= 0` なら 0）

- [ ] **Step 1: 失敗するテストを書く**

`test/run.js` の `/* ---------- POPText.wrap ---------- */` の**直前**に、以下を挿入する。

```javascript
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
```

同じファイルの `eval(read('assets/js/text.js'));` の**直後**に、モジュールの読み込みを追加する。

```javascript
/* --- POPImposition（純粋・DOM非依存）をそのまま読み込む --- */
eval(read('assets/js/imposition.js'));      // defines POPImposition
```

- [ ] **Step 2: テストが失敗することを確認する**

Run: `node test/run.js`
Expected: `Error: ENOENT: no such file or directory, open '...assets/js/imposition.js'` で異常終了する（まだファイルが無いため）。

- [ ] **Step 3: `assets/js/imposition.js` を作る**

```javascript
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
```

- [ ] **Step 4: テストが通ることを確認する**

Run: `node test/run.js`
Expected: 末尾が `34 passed, 0 failed`（既存 22 件 ＋ 新規 12 件）。1件でも FAIL があれば実装を直す。

- [ ] **Step 5: `index.html` に読み込みを追加する**

`index.html` の末尾にある `<script>` 群のうち、`presets.js` の**次の行**に追加する。

```html
<script src="assets/js/imposition.js"></script>
```

- [ ] **Step 6: コミット**

```bash
git add assets/js/imposition.js test/run.js index.html
git commit -m "feat: 面付け計算モジュールを追加

シート上にカードを何列何段並べられるか、90°回転させた方が多く入るかを
求める純関数。同数なら回転しない（向きが揃っている方が切りやすい）。
DOM非依存なので Node のテストから直接検証する。"
```

---

## Task 2: カードサイズ・寸法解決・比例スケール（presets.js）

カードサイズ表を足し、カード／シートの寸法解決を分ける。テンプレートの A4 前提値を小さなカードへ持ち込むための比例スケールと、画像のクランプをここへ集約する。

**Files:**
- Modify: `assets/js/presets.js`（末尾の `return {...}` の直前に追記し、`return` に公開を足す）
- Modify: `test/run.js`

**Interfaces:**
- Consumes: なし
- Produces:
  - `POPPresets.CARD_SIZES` — `[{ id, label, w, h }]`
  - `POPPresets.cardSize(card) -> { w, h }`（`card = { id, customW, customH }`。**`orientation` は見ない**）
  - `POPPresets.sheetSize(sheet) -> { w, h }`（`sheet = { id, orientation, customW, customH }`）
  - `POPPresets.sheetInner(sheet) -> { w, h }`（安全余白を引いた内寸）
  - `POPPresets.clampCustomCard(card, sheet) -> { customW, customH }`
  - `POPPresets.scaleFor(oldW, oldH, newW, newH) -> number`
  - `POPPresets.scaleCard(cardState, scale, sizeMm) -> cardState`（破壊的に書き換えて同じ参照を返す）
  - `POPPresets.clampImage(image, sizeMm) -> image`（破壊的）
  - `POPPresets.imageMaxSide(sizeMm) -> number`（取り込み時の最大辺 px）
  - `POPPresets.defaultCard() -> { id:'c44x67', customW:44, customH:67 }`
  - `POPPresets.defaultSheet() -> { id:'a4', orientation:'portrait', customW:210, customH:297, margin:5, gap:0, allowRotate:true, center:true, cutLine:true }`

- [ ] **Step 1: 失敗するテストを書く**

`test/run.js` の Task 1 で足したブロックの**直後**に挿入する。

```javascript
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
test('scaleCard: 文字は4pt・枠線は0.3mm を下回らない', function () {
  var c = POPPresets.defaultCardState();
  c.name.size = 10; c.design.border.width = 1.2;
  POPPresets.scaleCard(c, 0.05, { w: 20, h: 20 });
  assert.strictEqual(c.name.size, 4);
  assert.strictEqual(c.design.border.width, 0.3);
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
```

- [ ] **Step 2: テストが失敗することを確認する**

Run: `node test/run.js`
Expected: `POPPresets.cardSize is not a function` などで新規テストが FAIL する（既存 35 件は ok のまま）。
※ `test/run.js` はまだ `presets.js` を読み込んでいないため、Step 3 で読み込みも足す。

- [ ] **Step 3: `test/run.js` に presets.js の読み込みを足す**

`eval(read('assets/js/imposition.js'));` の**直後**に追加する。

```javascript
/* --- POPPresets（純粋・DOM非依存）をそのまま読み込む --- */
eval(read('assets/js/presets.js'));         // defines POPPresets
```

- [ ] **Step 4: `assets/js/presets.js` に実装を足す**

**既存の `defaultState()` と `sampleState()` は一切変更しない。** Task 6 まで `app.js` が
`state.paper` を使い続けるため、ここで `paper` を消すと画面が壊れて「各タスクの終わりに動く」
という原則を破ってしまう。カード用の既定値は `paper` を落とした派生として足す。

`return {` の**直前**に以下をすべて追加する。

```javascript
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

  function num(v, fallback) {
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

  /** カードの pt・余白・画像を破壊的にスケールする。sizeMm は新しいカード寸法。 */
  function scaleCard(card, scale, sizeMm) {
    if (!card || !isFinite(scale) || scale === 1) return card;

    SCALE_TEXT_KEYS.forEach(function (k) { scaleProp(card[k], 'size', scale, 4); });
    scaleProp(card.badge, 'size', scale, 4);

    scaleProp(card.layout, 'padding', scale, 0);
    scaleProp(card.layout, 'gap', scale, 0);

    /* 枠線も比例させる。不変にすると小さいカードで相対的に太くなりすぎるため。
       細くなりすぎる側は 0.3mm（300dpiで約3.5px＝印刷で視認できる）で止める。 */
    if (card.design) scaleProp(card.design.border, 'width', scale, 0.3);

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
```

最後に `return { ... }` を次で置き換える。

```javascript
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
    scaleCard: scaleCard,
    clampImage: clampImage,
    imageMaxSide: imageMaxSide,
    defaultCard: defaultCard,
    defaultSheet: defaultSheet
  };
```

- [ ] **Step 5: テストが通ることを確認する**

Run: `node test/run.js`
Expected: `50 passed, 0 failed`（既存 22 ＋ Task1 12 ＋ Task2 16）。

- [ ] **Step 6: コミット**

```bash
git add assets/js/presets.js test/run.js
git commit -m "feat: カードサイズと比例スケールを presets に追加

カード(44×67mm既定)とシート(A4等)で寸法解決を分ける。カードは
orientation を持たない＝縦横比の反転で文字が縮む経路を作らない。
テンプレートのA4前提値をカードサイズへ焼き込む scaleCard と、
画像クランプ・取り込み解像度の算出を集約した。"
```

---

## Task 3: ドキュメント構造と v1 移行（doc.js）

カード配列を持つドキュメントを定義し、旧データの読み込み・正規化・カード操作を1か所にまとめる。ここも DOM 非依存にしてテストする。

**Files:**
- Create: `assets/js/doc.js`
- Modify: `test/run.js`
- Modify: `index.html`

**Interfaces:**
- Consumes: `POPPresets.defaultCardState()` / `defaultCard()` / `defaultSheet()` / `paperSize()` / `sampleState()`
- Produces:
  - `POPDoc.MAX_CARDS` — `100`
  - `POPDoc.defaultDoc() -> doc`
  - `POPDoc.sampleDoc() -> doc`（初回起動用。サンプル文言入りのカード1枚）
  - `POPDoc.migrate(data) -> doc | null`（`null` は復元できないデータ）
  - `POPDoc.normalize(doc) -> doc`（破壊的。`activeIndex` の丸め・欠損補完・上限切り詰め）
  - `POPDoc.activeCard(doc) -> cardState`
  - `POPDoc.addCard(doc, cardState) -> number`（追加された位置。上限超過なら `-1`）
  - `POPDoc.duplicateCard(doc, index) -> number`
  - `POPDoc.removeCard(doc, index) -> boolean`（最後の1枚なら `false`）
  - `POPDoc.moveCard(doc, from, to) -> boolean`
  - `POPDoc.applyDesignToAll(doc, index) -> number`（上書きしたカード枚数）

`doc` の形（仕様 §4）:

```javascript
{
  version: 2,
  activeIndex: 0,
  card:  { id: 'c44x67', customW: 44, customH: 67 },
  sheet: { id:'a4', orientation:'portrait', customW:210, customH:297,
           margin:5, gap:0, allowRotate:true, center:true, cutLine:true },
  cards: [ cardState, ... ]
}
```

- [ ] **Step 1: 失敗するテストを書く**

`test/run.js` の Task 2 のブロックの直後に挿入する。

```javascript
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
```

- [ ] **Step 2: テストが失敗することを確認する**

Run: `node test/run.js`
Expected: `ENOENT ... assets/js/doc.js` で異常終了する。

- [ ] **Step 3: `test/run.js` に doc.js の読み込みを足す**

`eval(read('assets/js/presets.js'));` の**直後**に追加する。

```javascript
/* --- POPDoc（純粋・DOM非依存）をそのまま読み込む --- */
eval(read('assets/js/doc.js'));             // defines POPDoc
```

- [ ] **Step 4: `assets/js/doc.js` を作る**

```javascript
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
     app.js の mergeDeep と同じ規則。プロトタイプ汚染も同様に防ぐ。 */
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
      同じカードを選び続けるようにする。
      配列を変異させた後の添字で参照を取り直すと別のカードを指してしまうため、
      変異前に参照を控えてから indexOf で位置を引き直す。 */
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
```

- [ ] **Step 5: テストが通ることを確認する**

Run: `node test/run.js`
Expected: `69 passed, 0 failed`（既存 22 ＋ 12 ＋ 16 ＋ 19）。

- [ ] **Step 6: `index.html` に読み込みを追加する**

`renderer.js` の**次の行**に追加する（`sheet-view.js` は Task 5 で足すのでまだ書かない）。

```html
<script src="assets/js/doc.js"></script>
```

- [ ] **Step 7: コミット**

```bash
git add assets/js/doc.js test/run.js index.html
git commit -m "feat: カード集ドキュメントと v1 移行を追加

doc = { card, sheet, cards[], activeIndex } を定義し、カードの
追加/複製/削除/並べ替えと全カードへのデザイン適用をまとめた。
v1（単品）はカードとシートを同寸にして移行するため、どの用紙で
作ったデータも1ページ1枚＝従来と同じ印刷結果になる。"
```

---

## Task 4: renderer に寸法引数を通す

`POPRenderer.draw()` が用紙寸法を `state.paper` から自作するのをやめ、呼び出し側から mm で受け取るようにする。これでシート合成側が「このセルはこの大きさ」と指定できるようになる。

**Files:**
- Modify: `assets/js/renderer.js`

**Interfaces:**
- Consumes: なし（既存の `POPPresets.paperSize` を後方互換のためだけに残す）
- Produces:
  - `POPRenderer.draw(ctx, cardState, pxPerMm, assets, sizeMm) -> { w, h, fontScale, overflow }`
    （`sizeMm = { w, h }`。省略時は `cardState.paper` から解決し、それも無ければ A4）
  - `POPRenderer.renderToCanvas(cardState, dpi, assets, sizeMm) -> HTMLCanvasElement`

- [ ] **Step 1: `draw()` の寸法取得を差し替える**

`assets/js/renderer.js` の `function draw(ctx, state, pxPerMm, assets) {` から始まる5行を、次で置き換える。

```javascript
  /* sizeMm はカード1枚の大きさ(mm)。省略時は旧データ(state.paper)から解決する。 */
  function draw(ctx, state, pxPerMm, assets, sizeMm) {
    assets = assets || {};
    var photo = assets.image || null;
    var imgLayer = (state.image && state.image.layer) || 'back';
    var size = sizeMm || (state.paper ? POPPresets.paperSize(state) : { w: 210, h: 297 });
```

- [ ] **Step 2: `renderToCanvas()` に寸法を通す**

同ファイル末尾の `renderToCanvas` を次で置き換える。

```javascript
  /** 指定解像度でオフスクリーンに描画して canvas を返す（assets.image で写真も描画） */
  function renderToCanvas(state, dpi, assets, sizeMm) {
    var pxPerMm = dpi / 25.4;
    var size = sizeMm || (state.paper ? POPPresets.paperSize(state) : { w: 210, h: 297 });
    var cv = document.createElement('canvas');
    cv.width = Math.round(size.w * pxPerMm);
    cv.height = Math.round(size.h * pxPerMm);
    var ctx = cv.getContext('2d');
    draw(ctx, state, pxPerMm, assets, size);
    return cv;
  }
```

- [ ] **Step 3: 既存テストが壊れていないことを確認する**

Run: `node test/run.js`
Expected: `69 passed, 0 failed`（Task 3 と同じ件数のまま。renderer の `ptPx` 抽出が壊れていないことの確認）。

- [ ] **Step 4: ブラウザで従来どおり表示されることを確認する**

`index.html` をブラウザで開く。canvas 描画は Node で検証できないため、ここは目視で確かめる（仕様 §12）。

1. プレビューにサンプルのポップ（「北海道産 生クリーム大福 ¥298」）が従来どおり表示される
2. 用紙サイズを A4 → A6 に変えるとプレビューの縦横比が変わる
3. テンプレートを「セール」に切り替えると赤い枠のデザインになる
4. 「PNG保存」で画像が保存でき、開くと画面と同じ絵になっている

いずれかが崩れていれば `sizeMm` の受け渡しを見直す。

- [ ] **Step 5: コミット**

```bash
git add assets/js/renderer.js
git commit -m "refactor: draw に寸法引数 sizeMm を追加

用紙寸法を state から自作するのをやめ、呼び出し側から mm で受け取る。
シート合成側が「このセルはこの大きさ」と指定できるようにするための下準備。
省略時は従来どおり state.paper から解決するので既存の呼び出しは無変更で動く。"
```

---

## Task 5: シート合成描画（sheet-view.js）

シート1ページぶんの canvas に、面付けの各セルへカードを描き込む。回転が必要なセルは座標系を回してから既存の `draw()` を呼ぶだけで、カードの中身には一切触らない。

**Files:**
- Create: `assets/js/sheet-view.js`
- Modify: `test/run.js`
- Modify: `index.html`

**Interfaces:**
- Consumes: `POPImposition.computeLayout` / `cellRect` / `pageCount`、`POPPresets.cardSize` / `sheetSize`、`POPRenderer.draw`
- Produces:
  - `POPSheetView.layoutOf(doc) -> layout`（`POPImposition.computeLayout` の結果）
  - `POPSheetView.pagesOf(doc) -> number`
  - `POPSheetView.cardIndexesOnPage(doc, pageIndex) -> number[]`（そのページに載るカードの添字）
  - `POPSheetView.cellTransform(layout, i) -> { tx, ty, rot }`（mm。`rot` は 0 か `Math.PI/2`）
  - `POPSheetView.drawSheet(ctx, doc, pageIndex, pxPerMm, assetsByCard, opts)`
    （`assetsByCard` はカードと同じ添字の `[{ image }]`。`opts.highlightIndex` はプレビュー専用）
  - `POPSheetView.hitTest(doc, pageIndex, mm) -> number`（そのmm座標にあるカードの添字。無ければ `-1`）
  - `POPSheetView.renderSheetToCanvas(doc, pageIndex, dpi, assetsByCard) -> HTMLCanvasElement`

- [ ] **Step 1: 失敗するテストを書く**

`test/run.js` の Task 3 のブロックの直後に挿入する。

```javascript
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
```

- [ ] **Step 2: テストが失敗することを確認する**

Run: `node test/run.js`
Expected: `ENOENT ... assets/js/sheet-view.js` で異常終了する。

- [ ] **Step 3: `test/run.js` に sheet-view.js の読み込みを足す**

`eval(read('assets/js/doc.js'));` の**直後**に追加する。

```javascript
/* --- POPSheetView（描画は canvas 依存だが、幾何の純関数だけテストする） --- */
eval(read('assets/js/sheet-view.js'));      // defines POPSheetView
```

> `sheet-view.js` は読み込み時点では `document` に触れないため Node でも eval できる
> （`document.createElement` を使うのは `renderSheetToCanvas` の中だけ）。

- [ ] **Step 4: `assets/js/sheet-view.js` を作る**

```javascript
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

  /** pageIndex ページに載るカードの添字の配列 */
  function cardIndexesOnPage(doc, pageIndex) {
    var L = layoutOf(doc);
    if (!(L.perPage > 0)) return [];
    var start = pageIndex * L.perPage;
    var out = [];
    for (var i = start; i < Math.min(start + L.perPage, doc.cards.length); i++) out.push(i);
    return out;
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
    var idxs = cardIndexesOnPage(doc, pageIndex);
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

    var idxs = cardIndexesOnPage(doc, pageIndex);
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
```

- [ ] **Step 5: テストが通ることを確認する**

Run: `node test/run.js`
Expected: `76 passed, 0 failed`（Task 3 の 69 ＋ 新規 7）。

- [ ] **Step 6: `index.html` に読み込みを追加する**

`renderer.js` の次の行（`doc.js` の**前**）に追加する。最終的な並びは
`... renderer.js → sheet-view.js → doc.js → storage.js ...` になる。

```html
<script src="assets/js/sheet-view.js"></script>
```

- [ ] **Step 7: コミット**

```bash
git add assets/js/sheet-view.js test/run.js index.html
git commit -m "feat: シート合成描画を追加

面付けの各セルへ座標系を移して既存の draw() を呼ぶだけの層。
回転が必要なセルはセル右上へ寄せて90°回すので、カードの中身
（文字サイズ・余白）には一切影響しない。カット線と選択強調も
ここで重ね描きする（強調はプレビュー専用）。"
```

---

## Task 6: app.js をドキュメント構造へ移行し、画像操作を切り出す

画面はまだカード1枚しか出さないが、内部状態を `doc` に切り替える。`state` は「選択中カードへの参照」として残すので、既存の編集パネル・イベント配線はほぼそのまま動く。

あわせて `app.js` を減量する。現在 798 行あり、Global Constraints の「1ファイル800行以内」に既に達している。以降のタスクで約250行増えるため、**先に責務で切り出しておく**。切り出す2つは、いずれもドキュメント構造とは独立した責務で、このタスクで触る範囲と重なっているため今が最も安全なタイミング。

- 画像のドラッグ操作・取り込み・読み込みキャッシュ → `image-tool.js`（約200行）
- 「名前を付けて保存」の一覧と操作 → `preset-ui.js`（約80行）

**Files:**
- Create: `assets/js/image-tool.js`
- Create: `assets/js/preset-ui.js`
- Modify: `assets/js/app.js`
- Modify: `assets/js/storage.js`
- Modify: `index.html`

**Interfaces:**
- Consumes: `POPDoc.*`、`POPPresets.cardSize` / `clampImage` / `imageMaxSide` / `defaultCardState`
- Produces:
  - `POPImageTool.init({ canvas, ctx, getCard, getCardSize, onChange, setStatus })`
  - `POPImageTool.ensure(src, cb)` — 画像を読み込んでキャッシュ（`cb(HTMLImageElement|null)`）
  - `POPImageTool.isLoaded(src) -> boolean` — 読み込み済みか（再描画の無限ループを防ぐガード用）
  - `POPImageTool.assetsFor(cardState) -> { image }`
  - `POPImageTool.assetsForCards(cards) -> [{ image }]`
  - `POPImageTool.waitForCard(cardState, cb)` / `POPImageTool.waitForCards(cards, cb)`
  - `POPImageTool.drawHandles()` — プレビューに選択枠と四隅ハンドルを重ね描き
  - `POPImageTool.setEnabled(bool)` — シート表示中は操作を止める
  - `POPImageTool.clamp()` / `POPImageTool.importFile(file)` / `POPImageTool.clear()`
  - `POPPresetUI.init({ getCard, applyCard, setStatus })` / `POPPresetUI.render()`
  - `app.js` 内部（Task 7 以降が使う）: `doc` / `state` / `cardSizeMm()` / `selectCard(i)` /
    `refreshAll()` / `assetsByCard()`

- [ ] **Step 1: `storage.js` の自動保存キーを v2 にする**

`assets/js/storage.js` の `var AUTO_KEY = 'popmaker.autosave.v1';` を次で置き換える。

```javascript
  var AUTO_KEY = 'popmaker.doc.v2';
  var LEGACY_AUTO_KEY = 'popmaker.autosave.v1';   /* 旧「単品」形式。読むだけで消さない */
```

`loadAuto` の**直後**に追加する。

```javascript
  /** 旧形式（単品 state）の自動保存を読む。移行のためだけに使う。 */
  function loadLegacyAuto() {
    if (!ok) return null;
    try {
      var raw = localStorage.getItem(LEGACY_AUTO_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }
```

`return {` の中の `loadAuto: loadAuto,` の次の行に追加する。

```javascript
    loadLegacyAuto: loadLegacyAuto,
```

- [ ] **Step 2: `assets/js/image-tool.js` を作る**

`app.js` から次の関数・変数を**そのまま移設**する。移設元は削除する（Step 4）。

移設対象: `imgCache` / `imgLoading` / `ensureImage` / `withAssets` / `imgRectPx` /
`drawImageHandles` / `eventToMm` / `imageHitTest` / `imgDrag` / `onImagePointerDown` /
`onImagePointerMove` / `endImageDrag` / `updateImageCursor` / `importImageFile`

移設にあたっての書き換えは次の3点だけで、**ロジックは変えない**。

1. `state` → `cfg.getCard()`
2. `POPPresets.paperSize(state)` → `cfg.getCardSize()`
3. `syncUI(); requestRender();` → `cfg.onChange();`、`setStatus(...)` → `cfg.setStatus(...)`

```javascript
/* ===========================================================
   商品画像/ロゴの操作
   プレビュー上のドラッグ移動・四隅リサイズ、ファイル取り込み、
   読み込みキャッシュ（カード横断で src をキーに共有）。
   状態は持たず、app.js から渡されたアクセサ経由で選択中カードを触る。
   =========================================================== */
var POPImageTool = (function () {
  'use strict';

  var cfg = null;         /* { canvas, ctx, getCard, getCardSize, onChange, setStatus } */
  var cache = {};         /* src -> HTMLImageElement */
  var loading = {};
  var drag = null;
  var enabled = true;

  /* ---------- 読み込みキャッシュ ---------- */
  function ensure(src, cb) {
    if (!src) { if (cb) cb(null); return; }
    if (cache[src]) { if (cb) cb(cache[src]); return; }
    if (loading[src]) return;      /* 二重ロード防止（onload 完了時に再描画される） */
    loading[src] = true;
    var im = new Image();
    im.onload = function () { cache[src] = im; delete loading[src]; if (cb) cb(im); };
    im.onerror = function () { delete loading[src]; if (cb) cb(null); };
    im.src = src;
  }

  /** 今読み込めているぶんだけを返す（待たない） */
  function assetsFor(card) {
    var src = card && card.image && card.image.src;
    return { image: src ? (cache[src] || null) : null };
  }

  function assetsForCards(cards) {
    return cards.map(function (c) { return assetsFor(c); });
  }

  /** 選択中カードの画像を読み込んでから cb（書き出し用） */
  function waitForCard(card, cb) {
    var src = card && card.image && card.image.src;
    if (!src) { cb({ image: null }); return; }
    ensure(src, function (img) { cb({ image: img }); });
  }

  /** 全カードの画像を読み込んでから cb。読み込めなかったものは null のまま進む。 */
  function waitForCards(cards, cb) {
    var srcs = [];
    cards.forEach(function (c) {
      var s = c.image && c.image.src;
      if (s && srcs.indexOf(s) < 0) srcs.push(s);
    });
    if (!srcs.length) { cb(assetsForCards(cards)); return; }
    var remaining = srcs.length;
    srcs.forEach(function (s) {
      ensure(s, function () {
        remaining--;
        if (remaining === 0) cb(assetsForCards(cards));
      });
    });
  }

  /* ---------- 配置のクランプ ---------- */
  function clamp() {
    POPPresets.clampImage(cfg.getCard().image, cfg.getCardSize());
  }

  /* ---------- プレビュー上の操作 ---------- */
  /** シート表示中など、画像操作をさせたくないときに false にする */
  function setEnabled(v) {
    enabled = !!v;
    if (!enabled) cfg.canvas.style.cursor = 'default';
  }

  /* 現在の状態から画像の矩形（プレビュー canvas のバッキングpx）を得る */
  function rectPx() {
    var im = cfg.getCard().image;
    var size = cfg.getCardSize();
    var s = cfg.canvas.width / size.w;              /* バッキングpx / mm */
    var w = im.wMm * s;
    var h = (im.wMm / (im.aspect || 1)) * s;
    return { x: (im.xMm || 0) * s, y: (im.yMm || 0) * s, w: w, h: h, s: s };
  }

  /* 選択枠＋四隅ハンドルをプレビューに重ね描き（書き出しには出さない） */
  function drawHandles() {
    if (!enabled) return;
    var im = cfg.getCard().image;
    if (!im || !im.src || !(im.wMm > 0)) return;
    var ctx = cfg.ctx;
    var r = rectPx();
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.strokeStyle = '#2b6cb0';
    ctx.lineWidth = Math.max(1, r.s * 0.4);
    ctx.setLineDash([r.s * 1.6, r.s * 1.2]);
    ctx.strokeRect(r.x, r.y, r.w, r.h);
    ctx.setLineDash([]);
    var hs = Math.max(7, r.s * 3);                  /* ハンドル一辺（バッキングpx） */
    [[r.x, r.y], [r.x + r.w, r.y], [r.x, r.y + r.h], [r.x + r.w, r.y + r.h]].forEach(function (c) {
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.rect(c[0] - hs / 2, c[1] - hs / 2, hs, hs);
      ctx.fill();
      ctx.stroke();
    });
    ctx.restore();
  }

  /* ポインタ座標 → mm（カード左上基準） */
  function eventToMm(ev) {
    var rect = cfg.canvas.getBoundingClientRect();
    var size = cfg.getCardSize();
    return {
      x: (ev.clientX - rect.left) / rect.width * size.w,
      y: (ev.clientY - rect.top) / rect.height * size.h
    };
  }

  /* mm 座標が画像のどこに当たるか（四隅ハンドル / 内部 / 外） */
  function hitTest(mm) {
    var im = cfg.getCard().image;
    if (!im || !im.src || !(im.wMm > 0)) return null;
    var hMm = im.wMm / (im.aspect || 1);
    var size = cfg.getCardSize();
    var tol = Math.max(size.w, size.h) * 0.035 + 2;     /* 指でも掴める余裕 */
    var corners = {
      tl: [im.xMm, im.yMm], tr: [im.xMm + im.wMm, im.yMm],
      bl: [im.xMm, im.yMm + hMm], br: [im.xMm + im.wMm, im.yMm + hMm]
    };
    for (var key in corners) {
      if (Math.abs(mm.x - corners[key][0]) < tol && Math.abs(mm.y - corners[key][1]) < tol) {
        return { type: 'corner', corner: key };
      }
    }
    if (mm.x >= im.xMm && mm.x <= im.xMm + im.wMm && mm.y >= im.yMm && mm.y <= im.yMm + hMm) {
      return { type: 'inside' };
    }
    return null;
  }

  function onPointerDown(ev) {
    if (!enabled) return;
    var mm = eventToMm(ev);
    var hit = hitTest(mm);
    if (!hit) return;
    ev.preventDefault();
    try { cfg.canvas.setPointerCapture(ev.pointerId); } catch (e) { /* noop */ }
    var im = cfg.getCard().image;
    if (hit.type === 'corner') {
      var hMm = im.wMm / (im.aspect || 1);
      var left = hit.corner.indexOf('l') >= 0, top = hit.corner.indexOf('t') >= 0;
      /* 反対側の角を固定点（anchor）にしてアスペクト維持リサイズ */
      drag = { mode: 'resize', left: left, top: top,
               anchor: { x: left ? im.xMm + im.wMm : im.xMm, y: top ? im.yMm + hMm : im.yMm } };
    } else {
      drag = { mode: 'move', dx: mm.x - im.xMm, dy: mm.y - im.yMm };
    }
  }

  function onPointerMove(ev) {
    if (!enabled) return;
    if (!drag) { updateCursor(ev); return; }
    ev.preventDefault();
    var im = cfg.getCard().image, mm = eventToMm(ev);
    if (drag.mode === 'move') {
      im.xMm = mm.x - drag.dx;
      im.yMm = mm.y - drag.dy;
    } else {
      var dxMm = Math.abs(mm.x - drag.anchor.x);
      var dyMm = Math.abs(mm.y - drag.anchor.y);
      var newW = Math.max(10, Math.min(600, Math.max(dxMm, dyMm * (im.aspect || 1))));
      var newH = newW / (im.aspect || 1);
      im.wMm = newW;
      im.xMm = drag.left ? drag.anchor.x - newW : drag.anchor.x;
      im.yMm = drag.top ? drag.anchor.y - newH : drag.anchor.y;
    }
    clamp();
    cfg.onChange();
  }

  function endDrag(ev) {
    if (!drag) return;
    drag = null;
    try { cfg.canvas.releasePointerCapture(ev.pointerId); } catch (e) { /* noop */ }
    cfg.onChange();
  }

  function updateCursor(ev) {
    if (!enabled) { cfg.canvas.style.cursor = 'default'; return; }
    var hit = hitTest(eventToMm(ev));
    cfg.canvas.style.cursor = !hit ? 'default'
      : (hit.type === 'corner'
          ? (hit.corner === 'tl' || hit.corner === 'br' ? 'nwse-resize' : 'nesw-resize')
          : 'move');
  }

  /* ---------- 取り込み ----------
     カードの大きさに必要な解像度まで落として保存容量を抑える。 */
  function importFile(file) {
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      var im = new Image();
      im.onload = function () {
        var size = cfg.getCardSize();
        var maxSide = POPPresets.imageMaxSide(size);
        var sc = Math.min(1, maxSide / Math.max(im.naturalWidth, im.naturalHeight));
        var cw = Math.max(1, Math.round(im.naturalWidth * sc));
        var ch = Math.max(1, Math.round(im.naturalHeight * sc));
        var c = document.createElement('canvas');
        c.width = cw; c.height = ch;
        c.getContext('2d').drawImage(im, 0, 0, cw, ch);
        var isPng = /image\/png/i.test(file.type || '');
        var dataUrl;
        try { dataUrl = isPng ? c.toDataURL('image/png') : c.toDataURL('image/jpeg', 0.9); }
        catch (e) { cfg.setStatus('画像を読み込めませんでした', true); return; }
        var aspect = cw / ch;
        var wMm = Math.round(size.w * 0.6);
        cfg.getCard().image = {
          src: dataUrl, aspect: aspect, wMm: wMm,
          xMm: Math.round((size.w - wMm) / 2),
          yMm: Math.round((size.h - wMm / aspect) / 2),
          opacity: 1, layer: 'back'
        };
        ensure(dataUrl, function () { cfg.onChange(); });
        cfg.setStatus('画像を追加しました', true);
      };
      im.onerror = function () { cfg.setStatus('画像を読み込めませんでした', true); };
      im.src = String(reader.result);
    };
    reader.onerror = function () { cfg.setStatus('ファイルを読めませんでした', true); };
    reader.readAsDataURL(file);
  }

  function clear() {
    cfg.getCard().image = POPPresets.defaultCardState().image;
    cfg.canvas.style.cursor = 'default';
    cfg.onChange();
    cfg.setStatus('画像を削除しました', true);
  }

  function init(o) {
    cfg = o;
    o.canvas.addEventListener('pointerdown', onPointerDown);
    o.canvas.addEventListener('pointermove', onPointerMove);
    o.canvas.addEventListener('pointerup', endDrag);
    o.canvas.addEventListener('pointercancel', endDrag);
  }

  return {
    init: init,
    ensure: ensure,
    assetsFor: assetsFor,
    assetsForCards: assetsForCards,
    waitForCard: waitForCard,
    waitForCards: waitForCards,
    clamp: clamp,
    setEnabled: setEnabled,
    drawHandles: drawHandles,
    importFile: importFile,
    clear: clear
  };
})();
```

- [ ] **Step 3: `assets/js/preset-ui.js` を作る**

`app.js` から `renderPresetList` と、`btn-preset-save` / `preset-list` のクリックハンドラを移設する。
プリセットは従来どおり**1カードぶんのデザイン**として扱う（読込＝選択中カードへ適用）。

```javascript
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
```

- [ ] **Step 4: `app.js` から移設分を削除する**

`app.js` から次を**削除**する（Step 2・3 で移設済み）。

- `var imgCache = {}; var imgLoading = {};` と `ensureImage` / `withAssets`
- `imgRectPx` / `drawImageHandles` / `eventToMm` / `imageHitTest` / `var imgDrag = null;` /
  `onImagePointerDown` / `clampImage` / `onImagePointerMove` / `endImageDrag` /
  `updateImageCursor` / `importImageFile`
- `renderPresetList`
- `bindEvents()` の中の `canvas.addEventListener('pointerdown'...)` 〜 `'pointercancel'` の4行
- `bindEvents()` の中の `btn-preset-save` と `preset-list` のクリックハンドラ

`var autosaveWarned = false;` は `app.js` に残す。

- [ ] **Step 5: `app.js` の状態をドキュメントに差し替える**

`var state = POPPresets.sampleState();` を次で置き換える。

```javascript
  /* ドキュメント（カード集）と、選択中カードへの参照。
     state を参照のまま残すことで、既存の編集パネル・イベント配線が
     そのまま「選択中のカード」に効く。 */
  var doc = POPDoc.sampleDoc();
  var state = POPDoc.activeCard(doc);
  var autosaveWarned = false;

  function cardSizeMm() { return POPPresets.cardSize(doc.card); }

  /** カードごとの画像アセット（今読み込めているぶんだけ） */
  function assetsByCard() { return POPImageTool.assetsForCards(doc.cards); }

  function selectCard(index) {
    doc.activeIndex = Math.max(0, Math.min(index, doc.cards.length - 1));
    state = POPDoc.activeCard(doc);
    refreshAll();
  }

  /** 読み込んだ1カードぶんのデザインを選択中カードへ適用する（プリセット読込用） */
  function applyCardState(cardState) {
    var base = POPPresets.defaultCardState();
    POPDoc.mergeDeep(base, cardState);
    delete base.paper;                 /* 旧プリセットは paper を持つ場合がある */
    doc.cards[doc.activeIndex] = base;
    state = POPDoc.activeCard(doc);
    POPImageTool.clamp();
    refreshAll();
  }

  /* 画面全体を現在の doc に合わせ直す。Task 7 でカード一覧の更新が加わる。 */
  function refreshAll() {
    syncUI();
    requestRender();
  }
```

- [ ] **Step 6: 用紙寸法の参照をカード寸法に置き換える**

`render()` の冒頭 `var size = POPPresets.paperSize(state);` を次にする。

```javascript
    var size = cardSizeMm();
```

`render()` の描画呼び出しとハンドル描画を次にする。

```javascript
    var assets = POPImageTool.assetsFor(state);
    var result = POPRenderer.draw(ctx, state, canvas.width / size.w, assets, size);
    POPImageTool.drawHandles();   /* 画像の選択枠＋四隅ハンドル（プレビューのみ） */
```

`render()` のメタ表示（`var paper = POPPresets.papersById[state.paper.id];` から
`(state.paper.orientation === 'landscape' ? '横' : '縦');` までの4行）を次で置き換える。

```javascript
    var sheet = POPPresets.sheetSize(doc.sheet);
    var L = POPSheetView.layoutOf(doc);
    var pages = POPSheetView.pagesOf(doc);
    metaEl.textContent =
      'カード ' + size.w + '×' + size.h + 'mm / ' +
      (L.perPage > 0 ? sheet.w + '×' + sheet.h + 'mm に ' + L.perPage + '枚' : '配置できません') +
      ' / カード' + doc.cards.length + '枚・全' + pages + 'ページ';
```

`render()` の `ensureImageThenRerender()` を次で置き換える。

```javascript
  /* 画像が未ロードなら読み込んでから描き直す。
     「読み込み済みなら何もしない」ガードは必須。POPImageTool.ensure は
     キャッシュヒット時にコールバックを同期で呼ぶため、これが無いと
     render → ensure → requestRender → render … と毎フレーム回り続け、
     自動保存（localStorage 書き込み）も毎フレーム走ってしまう。 */
  function ensureImageThenRerender() {
    var src = state.image && state.image.src;
    if (!src || POPImageTool.isLoaded(src)) return;
    POPImageTool.ensure(src, function () { requestRender(); });
  }
```

`image-tool.js` 側には読み込み済み判定を用意する（`assetsFor` の直前）。

```javascript
  /** src が読み込み済みか。呼び出し側が「もう読み込んであるなら再描画しない」と
      判断するために使う（ensure はキャッシュヒット時にコールバックを同期で呼ぶため、
      無条件に再描画を要求すると無限ループになる）。 */
  function isLoaded(src) {
    return !!(src && cache[src]);
  }
```

`render()` の自動保存を doc にする。

```javascript
    var saved = POPStorage.saveAuto(doc);
    if (!saved && !autosaveWarned) {
      autosaveWarned = true;
      var imgCount = doc.cards.filter(function (c) { return c.image && c.image.src; }).length;
      setStatus('カード' + doc.cards.length + '枚・画像' + imgCount +
                '点のため自動保存できません。「データ保存」で書き出せます', true);
    }
```

- [ ] **Step 7: 書き出しをカード寸法対応にする**

`exportPng()` の `POPRenderer.renderToCanvas(state, dpi, assets)` を次にする。

```javascript
      var cv = POPRenderer.renderToCanvas(state, dpi, assets, cardSizeMm());
```

`exportPng()` と `printPop()` の `withAssets(function (assets) {` を次にする（2か所）。

```javascript
     POPImageTool.waitForCard(state, function (assets) {
```

`printPop()` の `var size = POPPresets.paperSize(state);` を次にする。

```javascript
      var size = cardSizeMm();
```

`printPop()` の `POPRenderer.renderToCanvas(state, 300, assets).toDataURL('image/png')` を次にする。

```javascript
      var url = POPRenderer.renderToCanvas(state, 300, assets, size).toDataURL('image/png');
```

> このタスクの印刷はまだ「カード1枚」のまま。シート単位への切り替えは Task 9。

- [ ] **Step 8: `syncUI()` をドキュメント対応にする**

`syncUI()` の中の `document.getElementById('custom-size').hidden = state.paper.id !== 'custom';` を次で置き換える。

```javascript
    /* カード/シートの設定は doc 側にあるので data-doc-path で別に同期する */
    var docInputs = document.querySelectorAll('[data-doc-path]');
    for (var d = 0; d < docInputs.length; d++) {
      var de = docInputs[d];
      if (de === document.activeElement &&
          (de.type === 'text' || de.type === 'number')) continue;
      var dv = getPath(doc, de.getAttribute('data-doc-path'));
      if (de.type === 'checkbox') de.checked = !!dv;
      else de.value = (dv === undefined || dv === null) ? '' : dv;
    }

    var cardCustom = document.getElementById('card-custom-size');
    if (cardCustom) cardCustom.hidden = doc.card.id !== 'custom';
    var sheetCustom = document.getElementById('custom-size');
    if (sheetCustom) sheetCustom.hidden = doc.sheet.id !== 'custom';
```

- [ ] **Step 9: 入力ハンドラを doc 対応にする**

`bindEvents()` の中の `function onFieldChange(ev) { ... }` を次で置き換える。

```javascript
    function onFieldChange(ev) {
      var el = ev.target;
      if (!el || !el.getAttribute) return;

      var docPath = el.getAttribute('data-doc-path');
      if (docPath) {
        setPath(doc, docPath, parseValue(el));
        onDocChange(docPath);
        return;
      }

      var path = el.getAttribute('data-path');
      if (!path) return;
      setPath(state, path, parseValue(el));
      if (path.indexOf('image.') === 0) POPImageTool.clamp();  /* 幅・X・Y の直接入力もクランプ */
      refreshAll();
    }

    /* カード/シート設定が変わったときの後処理。Task 10 で比例スケールが加わる。 */
    function onDocChange(docPath) {
      doc.sheet.margin = Math.max(0, Math.min(30, Number(doc.sheet.margin) || 0));
      doc.sheet.gap = Math.max(0, Math.min(20, Number(doc.sheet.gap) || 0));
      if (docPath.indexOf('card.') === 0 && doc.card.id === 'custom') {
        var c = POPPresets.clampCustomCard(doc.card, doc.sheet);
        doc.card.customW = c.customW;
        doc.card.customH = c.customH;
      }
      POPImageTool.clamp();
      refreshAll();
    }
```

`bindEvents()` の画像ボタンのハンドラを次で置き換える。

```javascript
    document.getElementById('btn-image-add').addEventListener('click', function () {
      document.getElementById('file-image').click();
    });
    document.getElementById('file-image').addEventListener('change', function (ev) {
      var file = ev.target.files && ev.target.files[0];
      autosaveWarned = false;
      POPImageTool.importFile(file);
      ev.target.value = '';
    });
    document.getElementById('btn-image-del').addEventListener('click', function () {
      autosaveWarned = false;
      POPImageTool.clear();
    });
```

- [ ] **Step 10: JSON 保存／読込・リセットを doc にする**

`btn-save-json` のハンドラの `POPStorage.exportJson(state, ...)` を `POPStorage.exportJson(doc, ...)` にする。

`file-json` の `change` ハンドラの `.then(function (data) { ... })` の中身を次で置き換える。

```javascript
        var loaded = POPDoc.migrate(data);
        if (!loaded) { setStatus('読み込めるデータではありません', true); return; }
        doc = loaded;
        state = POPDoc.activeCard(doc);
        autosaveWarned = false;
        refreshAll();
        setStatus('データを読み込みました', true);
```

`btn-reset` のハンドラの中身を次で置き換える。

```javascript
      if (!confirm('入力内容をすべて初期状態に戻します。よろしいですか？')) return;
      doc = POPDoc.defaultDoc();
      state = POPDoc.activeCard(doc);
      POPStorage.clearAuto();
      autosaveWarned = false;
      refreshAll();
      setStatus('リセットしました', true);
```

- [ ] **Step 11: `init()` を移行対応にし、切り出したモジュールを初期化する**

`init()` の `var saved = POPStorage.loadAuto();` と次の行を、次で置き換える。

```javascript
    /* ①新形式 → ②旧形式（単品）を移行 → ③サンプル の順に復元する */
    var restored = POPDoc.migrate(POPStorage.loadAuto());
    if (!restored) restored = POPDoc.migrate(POPStorage.loadLegacyAuto());
    doc = restored || POPDoc.sampleDoc();
    state = POPDoc.activeCard(doc);

    POPImageTool.init({
      canvas: canvas,
      ctx: ctx,
      getCard: function () { return state; },
      getCardSize: cardSizeMm,
      onChange: function () { refreshAll(); },
      setStatus: setStatus
    });
    POPPresetUI.init({
      getCard: function () { return state; },
      applyCard: applyCardState,
      setStatus: setStatus
    });
```

`init()` の `renderPresetList();` の行を削除する（`POPPresetUI.init` が最初の描画をする）。

- [ ] **Step 12: `index.html` に読み込みを追加する**

`storage.js` の次の行に2行追加する。最終的な並びは
`... sheet-view.js → doc.js → storage.js → image-tool.js → preset-ui.js → app.js`。

```html
<script src="assets/js/image-tool.js"></script>
<script src="assets/js/preset-ui.js"></script>
```

- [ ] **Step 13: 残った旧参照と行数を確認する**

Run: `grep -n "state.paper\|paperSize(state)\|POPPresets.defaultState()\|imgCache\|renderPresetList\|importImageFile" assets/js/app.js`
Expected: 1件も出ない。

Run: `wc -l assets/js/app.js assets/js/image-tool.js assets/js/preset-ui.js`
Expected: `app.js` が **700行未満**、他の2つも 800行未満。

- [ ] **Step 14: テストとブラウザで確認する**

Run: `node test/run.js`
Expected: `76 passed, 0 failed`（`mergeDeep` / `parseValue` の抽出が壊れていないことの確認）。

> `test/run.js` は `app.js` から正規表現で `mergeDeep` と `parseValue` を抜き出している。
> この2関数は `app.js` に残すこと（移設すると抽出が失敗してテストが落ちる）。

ブラウザで `index.html` を開いて確認する。

1. **44×67mm のポップが1枚**表示される（従来の A4 ではなくなっている）
2. 文字を入力するとプレビューに反映される
3. 画像を追加でき、ドラッグで動かせる／四隅でリサイズできる／削除できる
4. 「名前を付けて保存」でデザインを保存でき、一覧から読込・削除ができる
5. 「データ保存」で JSON が落ち、「データ読込」で復元できる
6. 「リセット」で初期状態に戻る
7. **旧データの移行**: DevTools のコンソールで次を実行してからリロードし、
   A5 サイズのカードが1枚復元されること（＝従来と同じ見た目）を確認する。

```javascript
localStorage.removeItem('popmaker.doc.v2');
localStorage.setItem('popmaker.autosave.v1', JSON.stringify({
  version: 1, template: 'simple',
  paper: { id: 'a5', orientation: 'portrait', customW: 150, customH: 100 },
  name: { text: '移行テスト', font: 'sans', size: 64, weight: 700, color: '#111', lineHeight: 1.25 },
  price: { value: '500', prefix: '¥', suffix: '円', unit: '', taxNote: '税込',
           font: 'sans', size: 110, weight: 900, color: '#111',
           strike: { enabled: false, value: '' }, comma: true }
}));
```

期待: リロード後に「移行テスト ¥500」が **148×210mm のカード1枚**として表示され、
メタ表示が「カード 148×210mm / 148×210mm に 1枚 / カード1枚・全1ページ」になる。

- [ ] **Step 15: コミット**

```bash
git add assets/js/app.js assets/js/image-tool.js assets/js/preset-ui.js assets/js/storage.js index.html
git commit -m "refactor: 状態をカード集ドキュメントへ移行し app.js を分割

state を doc.cards[activeIndex] への参照として残すことで、既存の
編集パネルとイベント配線をそのまま選択中カードに効かせる。
用紙寸法の参照はすべてカード寸法に置き換え、自動保存キーを v2 化。
旧形式は起動時に読み替えるので既存データはそのまま開ける。

app.js が800行の上限に達していたため、画像操作を image-tool.js、
デザインのプリセット一覧を preset-ui.js へ責務ごと切り出した。
移設した処理のロジックは変えていない。"
```

---

## Task 7: カード一覧 UI（cards-ui.js）

左に「カード一覧」を置き、カードの追加・複製・削除・選択・並べ替えをできるようにする。ここが「異なるポップを複数枚作る」の入口になる。

**Files:**
- Create: `assets/js/cards-ui.js`
- Modify: `index.html`
- Modify: `assets/css/style.css`
- Modify: `assets/js/app.js`

**Interfaces:**
- Consumes: `POPRenderer.draw`、`POPPresets.cardSize`
- Produces:
  - `POPCardsUI.init({ root, getDoc, getAssets, onSelect, onAdd, onDuplicate, onRemove, onMove })`
  - `POPCardsUI.refresh()` — 一覧を組み直す（200ms の debounce つき）
  - `POPCardsUI.refreshNow()` — 即時に組み直す（カード増減・選択変更のとき）

- [ ] **Step 1: `index.html` にカード一覧を追加する**

`<main>` の中、操作パネル（`<div class="panel">` など既存の左カラム）の**直前**に挿入する。
既存のレイアウトが2カラムなら、この節を左端に置いて3カラムにする。

```html
<section class="cards" aria-labelledby="cards-title">
  <h2 class="cards__title" id="cards-title">カード</h2>
  <ul class="cards__list" id="card-list" role="listbox" aria-label="カード一覧" tabindex="0"></ul>
  <div class="cards__ops">
    <button type="button" class="btn btn--sm" id="btn-card-add">＋ 追加</button>
    <button type="button" class="btn btn--sm" id="btn-card-dup">複製</button>
    <button type="button" class="btn btn--sm btn--ghost" id="btn-card-del">削除</button>
  </div>
  <p class="cards__hint">↑↓ で選択／Alt＋↑↓ で並べ替え／ドラッグでも並べ替えできます</p>
</section>
```

`<script src="assets/js/storage.js"></script>` の**次の行**に追加する。

```html
<script src="assets/js/cards-ui.js"></script>
```

- [ ] **Step 2: `assets/css/style.css` にスタイルを追加する**

ファイル末尾に追加する。

```css
/* ---------- カード一覧 ---------- */
.cards { display: flex; flex-direction: column; gap: 8px; min-width: 190px; max-width: 230px; }
.cards__title { font-size: 13px; font-weight: 700; margin: 0; }
.cards__list {
  list-style: none; margin: 0; padding: 4px;
  overflow-y: auto; max-height: calc(100vh - 260px);
  border: 1px solid #d8dde3; border-radius: 8px; background: #fff;
}
.cards__list:focus-visible { outline: 2px solid #2b6cb0; outline-offset: 1px; }
.cardrow {
  display: grid; grid-template-columns: 34px 1.6em 1fr auto; align-items: center; gap: 6px;
  padding: 5px 6px; border-radius: 6px; cursor: pointer; font-size: 12px;
}
.cardrow + .cardrow { margin-top: 2px; }
.cardrow:hover { background: #f1f5f9; }
.cardrow.is-active { background: #e3edf9; outline: 1px solid #2b6cb0; }
.cardrow.is-dragover { outline: 2px dashed #2b6cb0; }
.cardrow__thumb { width: 34px; height: auto; display: block; border: 1px solid #e2e8f0; background: #fff; }
.cardrow__no { color: #94a3b8; text-align: right; }
.cardrow__name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cardrow__price { color: #475569; white-space: nowrap; }
.cards__ops { display: flex; gap: 4px; }
.cards__ops .btn { flex: 1; }
.cards__hint { font-size: 11px; color: #64748b; margin: 0; line-height: 1.5; }
```

- [ ] **Step 3: `assets/js/cards-ui.js` を作る**

```javascript
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
    for (var i = 0; i < canvases.length; i++) {
      var cv = canvases[i];
      cv.width = Math.max(1, Math.round(THUMB_W * dpr));
      cv.height = Math.max(1, Math.round(size.h * pxPerMm));
      cv.style.height = Math.round(size.h * (THUMB_W / size.w)) + 'px';
      var assets = opts.getAssets ? (opts.getAssets()[i] || { image: null }) : { image: null };
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

  /* 文字入力のたびに全カードを描き直すと重いので間引く */
  function refresh() {
    if (timer) return;
    timer = setTimeout(function () { timer = null; refreshNow(); }, REBUILD_DEBOUNCE_MS);
  }

  function init(o) {
    opts = o;
    listEl = o.root;
    bind();
    refreshNow();
  }

  return { init: init, refresh: refresh, refreshNow: refreshNow };
})();
```

- [ ] **Step 4: `app.js` から一覧を配線する**

`refreshAll()` を次で置き換える。

```javascript
  /* 画面全体を現在の doc に合わせ直す */
  function refreshAll(immediate) {
    syncUI();
    requestRender();
    if (immediate) POPCardsUI.refreshNow();
    else POPCardsUI.refresh();
  }
```

`selectCard` の `refreshAll();` を `refreshAll(true);` にする。

`app.js` の `init()` の `bindEvents();` の**直前**に追加する。

```javascript
    POPCardsUI.init({
      root: document.getElementById('card-list'),
      getDoc: function () { return doc; },
      getAssets: assetsByCard,
      onSelect: selectCard,
      onAdd: function () {
        var size = cardSizeMm();
        var c = POPPresets.defaultCardState();
        /* defaultCardState は A4 前提の pt を持つのでカードサイズへ合わせる */
        POPPresets.scaleCard(c, POPPresets.scaleFor(210, 297, size.w, size.h), size);
        if (POPDoc.addCard(doc, c) < 0) {
          setStatus('カードは' + POPDoc.MAX_CARDS + '枚までです', true);
          return;
        }
        state = POPDoc.activeCard(doc);
        refreshAll(true);
        setStatus('カードを追加しました', true);
      },
      onDuplicate: function () {
        if (POPDoc.duplicateCard(doc, doc.activeIndex) < 0) {
          setStatus('カードは' + POPDoc.MAX_CARDS + '枚までです', true);
          return;
        }
        state = POPDoc.activeCard(doc);
        refreshAll(true);
        setStatus('カードを複製しました', true);
      },
      onRemove: function () {
        if (!POPDoc.removeCard(doc, doc.activeIndex)) {
          setStatus('最後の1枚は削除できません', true);
          return;
        }
        state = POPDoc.activeCard(doc);
        refreshAll(true);
        setStatus('カードを削除しました', true);
      },
      onMove: function (from, to) {
        POPDoc.moveCard(doc, from, to);
        state = POPDoc.activeCard(doc);
        refreshAll(true);
      }
    });
```

- [ ] **Step 5: ブラウザで確認する**

`index.html` を開いて確認する。

1. 左に「カード」一覧が出て、1件目にサンプルのサムネイルが出ている
2. 「＋ 追加」で空のカードが増え、選択が新しいカードへ移る。**文字サイズが極端に大きくない**
   （44×67mm に合わせて縮小されている）
3. 商品名を入れると一覧の名前とサムネイルが（少し遅れて）更新される
4. 「複製」で内容ごとコピーされ、片方を編集してももう片方は変わらない
5. 一覧をクリックで選択が切り替わり、編集パネルの内容も入れ替わる
6. 一覧にフォーカスを当てて `↓`/`↑` で選択が動く。`Alt`＋`↓` で順番が入れ替わる
7. 行をドラッグして別の行に落とすと並び替わる
8. カードが1枚のとき「削除」ボタンが押せない
9. リロードしても枚数と内容が復元される

- [ ] **Step 6: コミット**

```bash
git add assets/js/cards-ui.js index.html assets/css/style.css assets/js/app.js
git commit -m "feat: カード一覧UIを追加

サムネイル付きの一覧から追加/複製/削除/選択/並べ替えができる。
並べ替えはドラッグとキーボード(Alt+↑↓)の両方を用意した。
追加したカードはカードサイズに合わせて文字サイズを縮めてから入れる。
サムネイルの再構築は200msで間引く。"
```

---

## Task 8: シートタブ（面付けプレビュー）

プレビューを「カード」「シート」のタブ切替にして、実際の並びと枚数を目で確認できるようにする。

**Files:**
- Modify: `index.html`
- Modify: `assets/css/style.css`
- Modify: `assets/js/app.js`
- Modify: `assets/js/cards-ui.js`（Task 7 のレビューで出たサムネイル更新漏れと O(n²) の解消）

**Interfaces:**
- Consumes: `POPSheetView.drawSheet` / `layoutOf` / `pagesOf` / `hitTest` / `cardIndexesOnPage`
- Produces（`app.js` 内部）: `previewMode`（`'card'` / `'sheet'`）、`pageIndex`、`assetsByCard()`

> **仕様からの意図的な簡略化**: 設計 §8 では「シートタブでドラッグして並べ替え」も挙げていたが、
> canvas 上のドラッグは既存の画像移動と操作が競合する。並べ替えはカード一覧（ドラッグ＋キーボード）
> で完結しているため、シートタブは**クリックでの選択のみ**とする。

- [ ] **Step 1: `index.html` にタブとページ送りを追加する**

プレビュー領域（`#preview-stage`）の**直前**に挿入する。

```html
<div class="preview-tabs" role="tablist" aria-label="プレビューの表示">
  <button type="button" class="ptab is-active" id="ptab-card"
          role="tab" aria-selected="true" data-preview="card">カード</button>
  <button type="button" class="ptab" id="ptab-sheet"
          role="tab" aria-selected="false" data-preview="sheet">シート</button>
  <span class="preview-pager" id="preview-pager" hidden>
    <button type="button" class="btn btn--sm" id="btn-page-prev" aria-label="前のページ">◀</button>
    <span id="page-label">1 / 1</span>
    <button type="button" class="btn btn--sm" id="btn-page-next" aria-label="次のページ">▶</button>
  </span>
</div>
```

- [ ] **Step 2: `assets/css/style.css` にスタイルを追加する**

```css
/* ---------- プレビュータブ ---------- */
.preview-tabs { display: flex; align-items: center; gap: 6px; margin-bottom: 8px; }
.ptab {
  border: 1px solid #d8dde3; background: #fff; border-radius: 999px;
  padding: 4px 14px; font-size: 12px; cursor: pointer; color: #475569;
}
.ptab.is-active { background: #2b6cb0; border-color: #2b6cb0; color: #fff; font-weight: 700; }
.preview-pager { margin-left: auto; display: flex; align-items: center; gap: 6px; font-size: 12px; }
```

- [ ] **Step 3: `app.js` の描画をモード分岐にする**

`var rafId = null;` の**直前**に追加する。

```javascript
  /* プレビューの表示モードとページ */
  var previewMode = 'card';   /* 'card' | 'sheet' */
  var pageIndex = 0;
```

`function render() {` の中身を、次で置き換える（メタ表示・自動保存・遅延ロードは共通のまま残す）。

```javascript
  function render() {
    var size = previewMode === 'sheet' ? POPPresets.sheetSize(doc.sheet) : cardSizeMm();
    var stageW = Math.max(120, stage.clientWidth - 44);
    var maxH = Math.max(260, window.innerHeight - 230);
    var dispW = Math.min(stageW, maxH * (size.w / size.h), 660);
    var dispH = dispW * (size.h / size.w);
    var dpr = Math.min(window.devicePixelRatio || 1, 2.5);

    canvas.style.width = dispW + 'px';
    canvas.style.height = dispH + 'px';
    canvas.width = Math.round(dispW * dpr);
    canvas.height = Math.round(dispH * dpr);

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    var pxPerMm = canvas.width / size.w;
    var result = { fontScale: 1, overflow: false };

    if (previewMode === 'sheet') {
      clampPageIndex();
      POPSheetView.drawSheet(ctx, doc, pageIndex, pxPerMm, assetsByCard(),
                             { highlightIndex: doc.activeIndex });
    } else {
      result = POPRenderer.draw(ctx, state, pxPerMm, POPImageTool.assetsFor(state), size);
      POPImageTool.drawHandles();   /* 画像の選択枠＋四隅ハンドル（プレビューのみ） */
    }

    updateMeta(result);
    ensureImagesThenRerender();
    ensureFontsThenRerender();

    var saved = POPStorage.saveAuto(doc);
    if (!saved && !autosaveWarned) {
      autosaveWarned = true;
      var imgCount = doc.cards.filter(function (c) { return c.image && c.image.src; }).length;
      setStatus('カード' + doc.cards.length + '枚・画像' + imgCount +
                '点のため自動保存できません。「データ保存」で書き出せます', true);
    }
  }

  /* 画像が未ロードなら読み込んでから描き直す。
     カードタブは選択中カードだけ、シートタブは「そのページに載る全カード」を対象にする。
     シートタブで選択中カードしか見ないと、一度も選択していないカードの画像が
     永久に読み込まれず、面付けプレビューで絵が出ないままになる。
     読み込み済みを弾くガードは必須（POPImageTool.ensure はキャッシュヒット時に
     コールバックを同期で呼ぶため、無条件に再描画を要求すると毎フレーム回り続ける）。 */
  function ensureImagesThenRerender() {
    var targets;
    if (previewMode === 'sheet') {
      targets = POPSheetView.cardIndexesOnPage(doc, pageIndex).map(function (i) {
        return doc.cards[i];
      });
    } else {
      targets = [state];
    }
    targets.forEach(function (c) {
      var src = c && c.image && c.image.src;
      if (!src || POPImageTool.isLoaded(src)) return;
      POPImageTool.ensure(src, function () { requestRender(); });
    });
  }

  function clampPageIndex() {
    var pages = POPSheetView.pagesOf(doc);
    pageIndex = Math.max(0, Math.min(pageIndex, Math.max(0, pages - 1)));
  }

  /* メタ表示・警告・ページ送り・読み上げ用ラベルをまとめて更新する */
  function updateMeta(result) {
    var card = cardSizeMm();
    var sheet = POPPresets.sheetSize(doc.sheet);
    var L = POPSheetView.layoutOf(doc);
    var pages = POPSheetView.pagesOf(doc);

    metaEl.textContent =
      'カード ' + card.w + '×' + card.h + 'mm / ' +
      (L.perPage > 0
        ? sheet.w + '×' + sheet.h + 'mm に ' + L.perPage + '枚' +
          (L.rotate ? '（90°回転）' : '')
        : '配置できません') +
      ' / カード' + doc.cards.length + '枚・全' + pages + 'ページ';

    var pager = document.getElementById('preview-pager');
    pager.hidden = !(previewMode === 'sheet' && pages > 1);
    document.getElementById('page-label').textContent = (pageIndex + 1) + ' / ' + Math.max(1, pages);
    document.getElementById('btn-page-prev').disabled = pageIndex <= 0;
    document.getElementById('btn-page-next').disabled = pageIndex >= pages - 1;

    canvas.setAttribute('aria-label', previewMode === 'sheet'
      ? 'シートのプレビュー：' + doc.cards.length + '枚のカードを' + pages + 'ページに面付け'
      : '商品ポップのプレビュー：商品名「' +
        (String(state.name.text || '').trim() || '未入力') +
        '」／価格 ' + (String(state.price.value || '').trim() || '未入力'));

    /* 警告は「配置できない」→「余白0mm」の順に強い方を出す */
    if (L.perPage === 0) {
      setStatus('カードがシートより大きいため配置できません。カードを小さくするか用紙を大きくしてください');
    } else if (Number(doc.sheet.margin) === 0) {
      setStatus('余白0mmです。フチなし印刷に対応したプリンタ以外では端のカードが欠けます');
    } else if (previewMode === 'card' && result.overflow) {
      setStatus('内容がカードに収まりきりません。文字サイズを下げてください');
    } else if (previewMode === 'card' && result.fontScale < 0.999) {
      setStatus('自動縮小中（' + Math.round(result.fontScale * 100) + '%）');
    } else {
      setStatus('');
    }

    var printable = L.perPage > 0;
    document.getElementById('btn-print').disabled = !printable;
  }
```

`render()` の下にあった旧メタ表示・`aria-label`・`setStatus` のコードは削除する
（`updateMeta` に移した）。Task 6 で作った `ensureImageThenRerender()` は
`ensureImagesThenRerender()` に置き換える（シートタブではそのページの全カードの画像が要るため）。

- [ ] **Step 3b: 読み込み完了時に一覧サムネイルも更新する（Task 7 のレビュー指摘）**

Webフォントや画像の読み込みが終わったとき、これまでは `requestRender()` だけを呼んでいたため
**プレビューは新しくなるのにカード一覧のサムネイルが古いまま**残っていた（次に何か入力するまで直らない）。
読み込み完了の3か所を `refreshAll()` に変える。`refreshAll()` は一覧の更新を 200ms 間引きで行うので
連続呼び出しでも重くならない。

`ensureImagesThenRerender()` の中:

```javascript
      if (!src || POPImageTool.isLoaded(src)) return;
      POPImageTool.ensure(src, function () { refreshAll(); });
```

`ensureFontsThenRerender()` の末尾:

```javascript
    POPFonts.ensureAll(pending).then(function () { refreshAll(); });
```

`bindEvents()` の末尾にある `document.fonts.ready` のブロック:

```javascript
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () { refreshAll(); });
    }
```

あわせて `assets/js/cards-ui.js` の `drawThumbs()` で、`opts.getAssets()` を
**ループの外で1回だけ呼ぶ**ように直す（現在はカードごとに呼んでおり、その中で全カードを
`map` するためカード100枚で1万回の内部処理になる）。

```javascript
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
```

- [ ] **Step 4: タブとページ送り・シート上のクリック選択を配線する**

`bindEvents()` の末尾（`document.fonts` のブロックの直前）に追加する。

```javascript
    /* プレビューのタブ切替 */
    document.querySelector('.preview-tabs').addEventListener('click', function (ev) {
      var btn = ev.target.closest ? ev.target.closest('[data-preview]') : null;
      if (!btn) return;
      previewMode = btn.getAttribute('data-preview');
      var tabs = document.querySelectorAll('.ptab');
      for (var i = 0; i < tabs.length; i++) {
        var on = tabs[i] === btn;
        tabs[i].classList.toggle('is-active', on);
        tabs[i].setAttribute('aria-selected', on ? 'true' : 'false');
      }
      /* シート表示中は画像の操作を止める */
      POPImageTool.setEnabled(previewMode === 'card');
      requestRender();
    });

    document.getElementById('btn-page-prev').addEventListener('click', function () {
      pageIndex = Math.max(0, pageIndex - 1);
      requestRender();
    });
    document.getElementById('btn-page-next').addEventListener('click', function () {
      pageIndex = Math.min(POPSheetView.pagesOf(doc) - 1, pageIndex + 1);
      requestRender();
    });

    /* シート上でカードをクリックすると、そのカードを選択する */
    canvas.addEventListener('click', function (ev) {
      if (previewMode !== 'sheet') return;
      var rect = canvas.getBoundingClientRect();
      var sheet = POPPresets.sheetSize(doc.sheet);
      var mm = {
        x: (ev.clientX - rect.left) / rect.width * sheet.w,
        y: (ev.clientY - rect.top) / rect.height * sheet.h
      };
      var i = POPSheetView.hitTest(doc, pageIndex, mm);
      if (i >= 0) selectCard(i);
    });
```

画像操作の抑止は `POPImageTool.setEnabled()` が担うので、`app.js` 側に個別のガードは足さない
（`image-tool.js` の `onPointerDown` / `updateCursor` / `drawHandles` が `enabled` を見ている）。

- [ ] **Step 5: ブラウザで確認する**

1. 「シート」タブを押すと A4 の用紙にカードが並んで表示される
2. カードを16枚まで増やすと **4列×4段** に埋まる。17枚目でページ送りが出て「1 / 2」になる
3. カード同士の境界にうすいカット線が入っている
4. 選択中のカードが青い枠で強調される。シート上の別のカードをクリックすると選択が移り、
   「カード」タブに戻るとそのカードが編集対象になっている
5. シート表示中に canvas をドラッグしても画像が動かない
6. 用紙の余白を 0mm にすると **3列×6段=18枚**（90°回転）に変わり、
   「余白0mmです…」の警告が出る
7. カードサイズをシートより大きくすると「配置できません」と出て印刷ボタンが押せなくなる

- [ ] **Step 6: コミット**

```bash
git add index.html assets/css/style.css assets/js/app.js
git commit -m "feat: シートタブ（面付けプレビュー）を追加

プレビューをカード/シートのタブ切替にし、実際の並びと枚数・
ページ数を確認できるようにした。シート上のクリックでカードを
選択できる。余白0mmや配置不能のときは警告を出し、印刷ボタンを
無効化する。並べ替えはカード一覧側に集約した。"
```

---

## Task 9: 印刷と PNG 保存をシート単位にする

印刷を「面付けされたシートを全ページ」に変える。ここまでで **44×67mm を A4 に 16 枚並べて印刷**できるようになる。

**Files:**
- Create: `assets/js/export-tool.js`
- Modify: `index.html`
- Modify: `assets/js/app.js`

**Interfaces:**
- Consumes: `POPSheetView.renderSheetToCanvas` / `pagesOf`、`POPImageTool.waitForCard` / `waitForCards`、
  `POPFonts.ensureAll`、`POPRenderer.usedFonts` / `renderToCanvas`、`POPStorage.download`
- Produces:
  - `POPExport.init({ getDoc, getCard, getCardSize, getPageIndex, setStatus, fileName })`
  - `POPExport.png()` — 「PNGの対象」の選択に従って書き出す
  - `POPExport.print()` — 面付けされたシートを全ページ印刷する

### なぜ新しいファイルへ出すか

`app.js` は現在 **781 行**で、Global Constraints の 800 行にほぼ達している。このタスクは
印刷とPNG書き出しを大きく作り替える（ページごとの生成・blob URL・複数ページの待ち合わせ）ため、
`app.js` に書くと確実に上限を超える。出力は「ドキュメントを受け取って画像とプリンタへ流す」
という独立した責務なので、`export-tool.js` として切り出す。

既存の `exportPng` / `printPop` / `safeFileName` は `app.js` から**削除**し、ボタンのハンドラは
`POPExport.png` / `POPExport.print` を呼ぶだけにする。これで `app.js` は約 700 行に戻る。

- [ ] **Step 1: `index.html` に書き出し対象の選択を追加する**

「PNG保存」ボタンの**直前**に挿入する。

```html
<label class="field field--inline">
  <span>PNGの対象</span>
  <select id="export-target">
    <option value="sheet">シート（面付け済み）</option>
    <option value="card">選択中のカードのみ</option>
  </select>
</label>
<label class="field field--inline" id="export-allpages-wrap">
  <input type="checkbox" id="export-allpages">
  <span>全ページを保存する</span>
</label>
```

- [ ] **Step 2: `assets/js/export-tool.js` を作る**

`app.js` にある `safeFileName` / `exportPng` / `printPop` をここへ移し、シート対応に作り替える。

```javascript
/* ===========================================================
   出力（PNG保存・印刷）
   ドキュメントを受け取って画像とプリンタへ流すだけの層。
   状態は持たず、app.js から渡されたアクセサ経由で現在の状態を読む。
   =========================================================== */
var POPExport = (function () {
  'use strict';

  var cfg = null;   /* { getDoc, getCard, getCardSize, getPageIndex, setStatus } */

  var PRINT_DPI = 300;
  var MULTI_DOWNLOAD_INTERVAL_MS = 800;
  var PAGES_CONFIRM_THRESHOLD = 10;

  function safeFileName() {
    var card = cfg.getCard();
    var base = String((card.name && card.name.text) || 'pop')
      .replace(/[\\/:*?"<>|\s\n]+/g, '_').slice(0, 40);
    return (base || 'pop');
  }

  /* 全カードで使っているフォント（Webフォントの読み込み待ちに使う） */
  function allUsedFonts() {
    var out = [];
    cfg.getDoc().cards.forEach(function (c) {
      POPRenderer.usedFonts(c).forEach(function (f) { out.push(f); });
    });
    return out;
  }

  /* canvas を PNG として保存する（toBlob → dataURL のフォールバックつき） */
  function saveCanvas(cv, filename, done) {
    var finish = function (blob) {
      POPStorage.download(blob, filename);
      if (done) done(); else cfg.setStatus('PNGを保存しました', true);
    };
    var fail = function () {
      cfg.setStatus('画像を作成できませんでした。解像度を下げるか用紙を小さくしてお試しください', true);
    };
    var viaDataUrl = function () {
      try {
        var data = cv.toDataURL('image/png').split(',')[1];
        if (!data) { fail(); return; }
        var bin = atob(data), arr = new Uint8Array(bin.length);
        for (var i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
        finish(new Blob([arr], { type: 'image/png' }));
      } catch (e) { fail(); }
    };
    if (cv.toBlob) {
      /* 大きい用紙×高dpi では canvas 面積上限で b が null になり得る＝
         握り潰さず dataURL にフォールバックし、それも駄目なら失敗を通知する */
      cv.toBlob(function (b) { if (b) finish(b); else viaDataUrl(); }, 'image/png');
    } else {
      viaDataUrl();
    }
  }

  /* ---------- PNG 保存 ---------- */
  function png() {
    var doc = cfg.getDoc();
    var dpi = Number(document.getElementById('export-dpi').value) || PRINT_DPI;
    var target = document.getElementById('export-target').value;
    var allPages = document.getElementById('export-allpages').checked;

    if (target === 'card') {
      var card = cfg.getCard();
      cfg.setStatus('画像を作成中…');
      POPFonts.ensureAll(POPRenderer.usedFonts(card)).then(function () {
        POPImageTool.waitForCard(card, function (assets) {
          saveCanvas(POPRenderer.renderToCanvas(card, dpi, assets, cfg.getCardSize()),
                     safeFileName() + '_' + dpi + 'dpi.png');
        });
      });
      return;
    }

    var pages = POPSheetView.pagesOf(doc);
    if (pages <= 0) { cfg.setStatus('カードがシートより大きいため書き出せません', true); return; }

    cfg.setStatus('画像を作成中…');
    POPFonts.ensureAll(allUsedFonts()).then(function () {
      POPImageTool.waitForCards(doc.cards, function (assetsList) {
        var targets = [];
        if (allPages) { for (var i = 0; i < pages; i++) targets.push(i); }
        else { targets.push(Math.max(0, Math.min(cfg.getPageIndex(), pages - 1))); }

        if (targets.length > 1) {
          cfg.setStatus('全' + targets.length + 'ページを保存します。ブラウザが' +
                        '複数ダウンロードの許可を求めることがあります');
        }
        /* 連続ダウンロードはブラウザに抑止されやすいので間隔を空けて1枚ずつ出す */
        var step = function (k) {
          if (k >= targets.length) { cfg.setStatus('PNGを保存しました', true); return; }
          var p = targets[k];
          saveCanvas(POPSheetView.renderSheetToCanvas(doc, p, dpi, assetsList),
                     safeFileName() + '_sheet' + (p + 1) + '_' + dpi + 'dpi.png',
                     function () {
                       setTimeout(function () { step(k + 1); }, MULTI_DOWNLOAD_INTERVAL_MS);
                     });
        };
        step(0);
      });
    });
  }

  /* ---------- 印刷 ----------
     面付けされたシートを全ページ、1回のダイアログで出す。
     data URL は base64 で約1.33倍に膨らみ多ページで不利なので blob URL を使い、
     ページ canvas は1枚ずつ作って参照を捨てる。 */
  function printSheets() {
    var doc = cfg.getDoc();
    var pages = POPSheetView.pagesOf(doc);
    if (pages <= 0) { cfg.setStatus('カードがシートより大きいため印刷できません', true); return; }
    if (pages > PAGES_CONFIRM_THRESHOLD &&
        !window.confirm(pages + 'ページを印刷します。時間とメモリを消費しますが続けますか？')) {
      return;
    }

    cfg.setStatus('印刷を準備中…');
    POPFonts.ensureAll(allUsedFonts()).then(function () {
      POPImageTool.waitForCards(doc.cards, function (assetsList) {
        var sheet = POPPresets.sheetSize(doc.sheet);
        var urls = [];

        var makePage = function (i, done) {
          var cv = POPSheetView.renderSheetToCanvas(doc, i, PRINT_DPI, assetsList);
          var push = function (url) { urls.push(url); done(); };
          if (cv.toBlob) {
            cv.toBlob(function (b) {
              push(b ? URL.createObjectURL(b) : cv.toDataURL('image/png'));
            }, 'image/png');
          } else {
            push(cv.toDataURL('image/png'));
          }
        };

        var next = function (i) {
          if (i >= pages) { openPrintFrame(sheet, urls); return; }
          makePage(i, function () { next(i + 1); });
        };
        next(0);
      });
    });
  }

  function openPrintFrame(sheet, urls) {
    var frame = document.createElement('iframe');
    frame.setAttribute('aria-hidden', 'true');
    frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
    document.body.appendChild(frame);

    var imgs = urls.map(function (u, i) {
      return '<img class="page" id="p' + i + '" alt="">';
    }).join('');

    var d = frame.contentWindow.document;
    d.open();
    d.write(
      '<!DOCTYPE html><html><head><meta charset="utf-8"><title>' + safeFileName() + '</title><style>' +
      '@page{size:' + sheet.w + 'mm ' + sheet.h + 'mm;margin:0}' +
      'html,body{margin:0;padding:0}' +
      'img.page{width:' + sheet.w + 'mm;height:' + sheet.h + 'mm;display:block;page-break-after:always}' +
      'img.page:last-child{page-break-after:auto}' +
      '</style></head><body>' + imgs + '</body></html>'
    );
    d.close();

    var remaining = urls.length;
    var cleanup = function () {
      urls.forEach(function (u) {
        if (u.indexOf('blob:') === 0) { try { URL.revokeObjectURL(u); } catch (e) { /* noop */ } }
      });
      if (frame.parentNode) frame.parentNode.removeChild(frame);
    };
    var go = function () {
      try {
        frame.contentWindow.focus();
        frame.contentWindow.print();
        cfg.setStatus('印刷ダイアログを開きました（全' + urls.length + 'ページ）', true);
      } catch (e) {
        cfg.setStatus('印刷を開始できませんでした', true);
      }
      setTimeout(cleanup, 2000);
    };

    urls.forEach(function (u, i) {
      var im = d.getElementById('p' + i);
      var done = function () { remaining--; if (remaining === 0) go(); };
      im.onload = done;
      im.onerror = done;
      im.src = u;
    });
  }

  function init(o) {
    cfg = o;
    document.getElementById('btn-png').addEventListener('click', png);
    document.getElementById('btn-print').addEventListener('click', printSheets);
    document.getElementById('export-target').addEventListener('change', function (ev) {
      document.getElementById('export-allpages-wrap').hidden = ev.target.value !== 'sheet';
    });
  }

  return {
    init: init,
    png: png,
    print: printSheets,
    safeFileName: safeFileName
  };
})();
```

- [ ] **Step 3: `app.js` から出力処理を削除して委譲する**

`app.js` から次を**削除**する（Step 2 で移設済み）。

- `function safeFileName() { ... }`
- `function exportPng() { ... }`
- `function printPop() { ... }`
- `bindEvents()` の中の `document.getElementById('btn-png').addEventListener('click', exportPng);` と
  `document.getElementById('btn-print').addEventListener('click', printPop);` の2行

`init()` の中、`POPPresetUI.init(...)` の**次**に追加する。

```javascript
    POPExport.init({
      getDoc: function () { return doc; },
      getCard: function () { return state; },
      getCardSize: cardSizeMm,
      getPageIndex: function () { return pageIndex; },
      setStatus: setStatus
    });
```

`btn-save-json` のハンドラが `safeFileName()` を使っているので、`POPExport.safeFileName()` に置き換える。

```javascript
      POPStorage.exportJson(doc, POPExport.safeFileName() + '.json');
```

`updateMeta()` の中にある印刷ボタンの有効・無効の切り替え
（`document.getElementById('btn-print').disabled = !printable;`）は **`app.js` に残す**
（画面状態の反映であり出力処理ではないため）。

- [ ] **Step 3b: 画面の直接印刷でUIが写り込まないようにする（Task 8 のレビュー指摘）**

`assets/css/style.css` の `@media print` ブロックに、プレビューのタブとページ送りを隠す指定を足す。
本来の印刷は隠し iframe に別ドキュメントを書き出すのでこの CSS の影響を受けないが、
利用者が主画面で直接 Ctrl+P したときにタブやページ送りのボタンが紙に写り込むため。
既存の `.preview__bar` / `.preview__note` の扱いに合わせること。

```css
  .preview-tabs, .preview-pager { display: none; }
```

- [ ] **Step 4: `index.html` に読み込みを追加する**

`preset-ui.js` の**次の行**に追加する。

```html
<script src="assets/js/export-tool.js"></script>
```

- [ ] **Step 5: 検証する**

Run: `node test/run.js`
Expected: `76 passed, 0 failed`

Run: `node --check assets/js/export-tool.js && node --check assets/js/app.js && echo SYNTAX_OK`
Expected: `SYNTAX_OK`

Run: `wc -l assets/js/app.js assets/js/export-tool.js`
Expected: `app.js` が **720 行未満**（出力処理を出した分だけ減っていること）

Run: `grep -n "safeFileName\|exportPng\|printPop" assets/js/app.js`
Expected: `POPExport.safeFileName()` の1件だけ

Run: `grep -o "getElementById('[a-z-]*')" assets/js/export-tool.js | sort -u`
→ 出てきた ID が**すべて `index.html` に存在する**ことを確認する（片方にしか無い ID は実行時エラーになる）。

- [ ] **Step 6: ブラウザで確認する（人間が実施）**

このステップは実装者ではなく人間が行う。確認項目:

1. カードを 20 枚にして「印刷」を押すと、プレビューが **2 ページ**になり、
   1 ページ目に 16 枚・2 ページ目に 4 枚が並んでいる
2. プリンタ設定で「実際のサイズ（100%）」にして A4 に印刷し、**定規でカードを測ると 44×67mm**
3. 「PNGの対象＝シート」で保存すると、現在のページ 1 枚が `..._sheet1_300dpi.png` で落ちる
4. 「全ページを保存する」にチェックを入れると 2 枚落ちる（ブラウザの確認が出たら許可する）
5. 「PNGの対象＝選択中のカードのみ」にすると 44×67mm 1 枚だけの PNG が落ちる
6. 画像付きのカードを混ぜても、シート PNG に画像が出ている
7. **印刷結果に選択中カードの青い枠が出ていない**

- [ ] **Step 7: コミット**

```bash
git add assets/js/export-tool.js assets/js/app.js index.html
git commit -m "feat: 印刷とPNG保存をシート単位にする

面付けされたシートを全ページ、1回の印刷ダイアログで出す。ページ画像は
blob URL で渡し1枚ずつ生成して参照を捨てる（data URL は base64 で
約1.33倍に膨らみ多ページで不利なため）。PNGは「シート/選択中カード」を
選べ、既定は現在のページ1枚。全ページ保存は連続ダウンロードの抑止を
避けるため800ms間隔にした。

app.js が800行の上限に迫っていたため、出力処理は export-tool.js として
切り出した。"
```

---

## Task 10: カード／シート設定 UI と比例スケール

「カードの大きさ」と「印刷シート」を別々の設定にし、カードサイズを変えたときに文字と余白が比例するようにする。テンプレート適用時のスケールと「全カードへ適用」もここで入れる。

**Files:**
- Modify: `index.html`
- Modify: `assets/js/app.js`
- Modify: `assets/css/style.css`

**Interfaces:**
- Consumes: `POPPresets.CARD_SIZES` / `scaleFor` / `scaleCard` / `clampCustomCard`、`POPDoc.applyDesignToAll`
- Produces: なし（画面の動作のみ）

- [ ] **Step 1: `index.html` の用紙セクションを差し替える**

既存の「用紙サイズ」まわり（`#paper-select`・`#custom-size`・向きの `<select>` を含むセクション）を、次の**2つのセクション**で置き換える。既存の `data-path="paper.*"` は 1 つも残さないこと。

```html
<section class="section">
  <h2 class="section__title">カードの大きさ</h2>
  <label class="field">
    <span>プリセット</span>
    <select id="card-select" data-doc-path="card.id"></select>
  </label>
  <div class="field-row" id="card-custom-size" hidden>
    <label class="field">
      <span>幅(mm)</span>
      <input type="number" min="10" max="1000" step="0.5" data-doc-path="card.customW">
    </label>
    <label class="field">
      <span>高さ(mm)</span>
      <input type="number" min="10" max="1000" step="0.5" data-doc-path="card.customH">
    </label>
  </div>
  <label class="field field--inline">
    <input type="checkbox" id="scale-with-card" checked>
    <span>文字とレイアウトも比例させる</span>
  </label>
  <p class="hint">サイズ変更は元の値を書き換えます。元に戻したいときはテンプレートを選び直してください。</p>
</section>

<section class="section">
  <h2 class="section__title">印刷シート</h2>
  <label class="field">
    <span>用紙</span>
    <select id="paper-select" data-doc-path="sheet.id"></select>
  </label>
  <label class="field">
    <span>向き</span>
    <select data-doc-path="sheet.orientation">
      <option value="portrait">縦</option>
      <option value="landscape">横</option>
    </select>
  </label>
  <div class="field-row" id="custom-size" hidden>
    <label class="field">
      <span>幅(mm)</span>
      <input type="number" min="20" max="1000" data-doc-path="sheet.customW">
    </label>
    <label class="field">
      <span>高さ(mm)</span>
      <input type="number" min="20" max="1000" data-doc-path="sheet.customH">
    </label>
  </div>
  <div class="field-row">
    <label class="field">
      <span>安全余白(mm)</span>
      <input type="number" min="0" max="30" step="0.5" data-doc-path="sheet.margin">
    </label>
    <label class="field">
      <span>カード間隔(mm)</span>
      <input type="number" min="0" max="20" step="0.5" data-doc-path="sheet.gap">
    </label>
  </div>
  <label class="field field--inline">
    <input type="checkbox" data-doc-path="sheet.allowRotate">
    <span>90°回して枚数が増えるなら回す</span>
  </label>
  <label class="field field--inline">
    <input type="checkbox" data-doc-path="sheet.center">
    <span>用紙の中央に寄せる</span>
  </label>
  <label class="field field--inline">
    <input type="checkbox" data-doc-path="sheet.cutLine">
    <span>カット線を入れる</span>
  </label>
  <p class="hint">安全余白を 0mm にすると枚数は増えますが、フチなし印刷に対応したプリンタ以外では端が欠けます。</p>
</section>
```

テンプレート一覧（`#template-list`）の**直後**に、一括適用ボタンを追加する。

```html
<button type="button" class="btn btn--sm" id="btn-apply-design">このデザインを全カードに適用</button>
```

- [ ] **Step 2: `assets/css/style.css` に補助スタイルを追加する**

```css
.hint { font-size: 11px; color: #64748b; margin: 4px 0 0; line-height: 1.5; }
.field-row { display: flex; gap: 8px; }
.field-row .field { flex: 1; }
```

- [ ] **Step 3: カードサイズの選択肢を作る**

`app.js` の `buildPaperOptions()` の**直後**に追加する。

```javascript
  function buildCardOptions() {
    document.getElementById('card-select').innerHTML =
      POPPresets.CARD_SIZES.map(function (c) {
        return '<option value="' + c.id + '">' + c.label + '</option>';
      }).join('');
  }
```

`init()` の `buildPaperOptions();` の次の行に `buildCardOptions();` を足す。

- [ ] **Step 4: カードサイズ変更時のスケールを入れる**

`var previewMode = 'card';` の**直前**に追加する。

```javascript
  /* カードサイズの変更前の値。比例スケールの係数を出すために保持する。 */
  var lastCardSize = null;
```

`init()` の `state = POPDoc.activeCard(doc);` の次の行に追加する。

```javascript
    lastCardSize = cardSizeMm();
```

`bindEvents()` の `onDocChange` を次で置き換える。

```javascript
    /* カード/シート設定が変わったときの後処理 */
    function onDocChange(docPath) {
      doc.sheet.margin = Math.max(0, Math.min(30, Number(doc.sheet.margin) || 0));
      doc.sheet.gap = Math.max(0, Math.min(20, Number(doc.sheet.gap) || 0));

      /* カスタムカードはシート内寸へ丸める。プリセットは丸めず警告だけ（設計 §4）。 */
      if (doc.card.id === 'custom') {
        var c = POPPresets.clampCustomCard(doc.card, doc.sheet);
        doc.card.customW = c.customW;
        doc.card.customH = c.customH;
      }
      applyCardSizeChange();
      refreshAll(true);
    }
```

`bindEvents()` の外（`applyTemplate` の隣）に追加する。

```javascript
  /* カードの大きさが変わったら、全カードの文字・余白を比例させる。
     縦横が入れ替わっただけのときは scaleFor が 1 を返すので縮まない（設計 §4.1）。 */
  function applyCardSizeChange() {
    var next = cardSizeMm();
    if (!lastCardSize) { lastCardSize = next; return; }
    if (next.w === lastCardSize.w && next.h === lastCardSize.h) return;

    if (document.getElementById('scale-with-card').checked) {
      var s = POPPresets.scaleFor(lastCardSize.w, lastCardSize.h, next.w, next.h);
      doc.cards.forEach(function (c) { POPPresets.scaleCard(c, s, next); });
      if (s !== 1) setStatus('カードの大きさに合わせて文字と余白を調整しました', true);
    } else {
      doc.cards.forEach(function (c) { POPPresets.clampImage(c.image, next); });
    }
    lastCardSize = next;
  }
```

- [ ] **Step 5: テンプレート適用にスケールを入れる**

`function applyTemplate(id) { ... }` を**関数まるごと**次で置き換える。

```javascript
  /* ---------- テンプレート適用 ----------
     テンプレの数値は A4(210×297) 前提。カードサイズへ焼き込んでから重ねる。 */
  function applyTemplate(id) {
    var t = POPPresets.templatesById[id];
    if (!t) return;
    var size = cardSizeMm();
    var patch = JSON.parse(JSON.stringify(t.apply));
    POPPresets.scaleCard(patch, POPPresets.scaleFor(210, 297, size.w, size.h), size);
    state.template = id;
    mergeDeep(state, patch);
    refreshAll(true);
  }
```

- [ ] **Step 6: 「全カードに適用」を配線する**

`bindEvents()` の中に追加する。

```javascript
    document.getElementById('btn-apply-design').addEventListener('click', function () {
      var n = doc.cards.length - 1;
      if (n <= 0) { setStatus('カードが1枚のため適用先がありません', true); return; }
      if (!window.confirm(n + '枚のカードのデザインを上書きします。よろしいですか？\n' +
                          '（商品名・価格・説明・画像は変わりません）')) return;
      var applied = POPDoc.applyDesignToAll(doc, doc.activeIndex);
      refreshAll(true);
      setStatus(applied + '枚のカードにデザインを適用しました', true);
    });
```

- [ ] **Step 7: `#status` を読み上げ対象にする**

`index.html` の `id="status"` を持つ要素に属性を足す（既に付いていれば変更不要）。

```html
<p id="status" class="status" role="status" aria-live="polite"></p>
```

- [ ] **Step 8: ブラウザで確認する**

1. 「カードの大きさ」で **44×67mm** が選ばれている。「カスタム」にすると幅・高さの入力欄が出る
2. カスタムで幅に `999` を入れると **シート内寸（A4・余白5mmなら200）に丸められる**
3. カスタムで `10` 未満を入れると 10 に丸められる
4. 44×67 → A7(74×105) に変えると、文字と余白が**大きくなる**（潰れない）
5. 「文字とレイアウトも比例させる」のチェックを外して変えると、文字サイズが**そのまま**になる
6. カスタムで 44×67 → 67×44 に手入力で入れ替えると、**文字サイズが変わらない**
7. テンプレート「セール」を押すと、44×67mm でも**枠と文字が収まった状態**で適用される
   （A4 用の 130pt がそのまま乗って潰れない）
8. カードを3枚作って別々の色にし、「このデザインを全カードに適用」を押すと、
   確認ダイアログのあと**色だけ揃い、商品名と価格は各カードのまま**
9. 用紙を A5 にすると枚数表示が 8 枚に変わる。余白 0mm で 9 枚になる
10. 「カット線を入れる」を外すと線が消える

- [ ] **Step 9: コミット**

```bash
git add index.html assets/js/app.js assets/css/style.css
git commit -m "feat: カード/シート設定と比例スケールを追加

カードの大きさ（44×67mm既定・任意mm）と印刷シートを別の設定に分け、
カードサイズやテンプレートを変えたときに文字・余白・枠線を比例させる。
縦横の入れ替えだけなら係数1＝縮まない。カスタムはシート内寸へ丸め、
プリセットは丸めずに警告だけ出す。全カードへのデザイン一括適用も追加。"
```

---

## Task 11: ドキュメント更新と総仕上げ

README を実態に合わせ、仕様書の受け入れ基準を1件ずつ確認する。

**Files:**
- Modify: `README.md`
- Modify: `docs/superpowers/specs/2026-08-18-multi-card-imposition-design.md`（受け入れ基準にチェック）

- [ ] **Step 1: `README.md` を更新する**

「できること」の冒頭に節を足す。

```markdown
### 複数のポップをまとめて作る・まとめて印刷する
- **カード一覧**で、内容の違うポップを1つのファイルにまとめて作れます（最大100枚）
- **カードの大きさは任意の mm**（既定 44×67mm）。プリセット（名刺・A7・A8・B8・正方形）も選べます
- 印刷すると**用紙へ自動で面付け**され、余白が最小になるように並びます
  （A4・安全余白5mm なら 44×67mm が **16枚**、余白0mm なら 90°回転して **18枚**）
- 入り切らない分は**自動で次のページ**になり、1回の印刷ダイアログでまとめて刷れます
- カード同士の境界に**カット線**が入るので切り分けやすくなっています
```

「レイアウト・デザイン」の用紙サイズの行を次に差し替える。

```markdown
- 印刷シート：**JIS A判（A3〜A8）／JIS B判（B4〜B8）** ＋ はがき／名刺／正方形／短冊／カスタム（mm指定）、縦横切替（B判はJIS寸法。ISO Bとは別）
- 安全余白（既定5mm）・カード間隔・90°自動回転・中央寄せ・カット線を設定できます
```

「印刷のコツ」に追記する。

```markdown
- 家庭用プリンタは用紙の端 5mm 前後が印字できません。既定の「安全余白 5mm」のままなら端のカードが欠けません
- 余白 0mm は枚数が増えますが、フチなし印刷に対応したプリンタでのみお使いください
```

「ファイル構成」を次に差し替える。

```markdown
index.html              画面（カード一覧・操作パネル・プレビュー）
assets/css/style.css    操作画面のスタイル
assets/js/
  fonts.js              フォント定義とWebフォントの読み込み
  text.js               日本語の折り返し（禁則処理）・数値の3桁区切り
  presets.js            カードサイズ・用紙・テンプレート・比例スケール
  imposition.js         面付け計算（何列何段・回転の要否・ページ数）
  renderer.js           カード1枚の描画エンジン（プレビューと書き出しで共通）
  sheet-view.js         面付けされたシートの合成描画
  doc.js                カード集の操作と旧データの移行
  storage.js            自動保存・プリセット・ファイル入出力
  cards-ui.js           カード一覧の表示と操作
  app.js                画面の組み立てとイベント処理
```

「テスト」節に追記する。

```markdown
面付け計算・寸法解決・比例スケール・旧データ移行も検証します。
canvas 描画と印刷はブラウザでの目視確認になります。
```

- [ ] **Step 2: 仕様書の受け入れ基準を1件ずつ確認する**

`docs/superpowers/specs/2026-08-18-multi-card-imposition-design.md` の §14 を開き、
**作品ライブラリに関する3件を除く**すべてをブラウザで確認して `- [x]` に変える。

確認する項目:
- カードの追加・複製・削除・並べ替えができ、各カードの内容が独立している
- カードサイズを 44×67mm と任意の mm に設定でき、シート内寸を超える入力はクランプされる
- A4・余白5mm で 16枚、0mm で 18枚が配置され、画面の枚数表示と一致する
- カード数が1ページを超えると自動で複数ページになり、印刷でページが分かれる
- 印刷結果が原寸で出る（**定規で 44×67mm を実測**）
- カット線が隣接カードの境界に1本だけ入る
- 「全カードに適用」で見た目だけ揃い、商品名・価格・画像は変わらない
- PNG を「シート」「選択中カードのみ」の両方で保存できる
- v1 の JSON／自動保存を読み込むとカード1枚として復元され、A5 など非A4 でも従来と同じ印刷結果になる
- カードサイズ変更時に文字・余白が比例し、44×67mm で初期表示が破綻しない
- **面付けで回転が起きてもカードの文字サイズ・余白がまったく変わらない**
- `node test/run.js` が全件通る

作品ライブラリの3件（自動記録・改名/複製/削除・IndexedDB フォールバック）は
**この計画の範囲外**なので `- [ ]` のまま残し、§14 の見出し直下に一行足す。

```markdown
> 作品ライブラリ（§9.3・§9.4）に関する項目は別計画で実装する。
```

- [ ] **Step 3: 最終確認**

Run: `node test/run.js`
Expected: `76 passed, 0 failed`

Run: `grep -rn "state.paper\|POPPresets.paperSize(state)" assets/js/app.js`
Expected: 何も出ない

Run: `wc -l assets/js/*.js`
Expected: どのファイルも 800 行以下

- [ ] **Step 4: コミット**

```bash
git add README.md docs/superpowers/specs/2026-08-18-multi-card-imposition-design.md
git commit -m "docs: 複数カードと面付け印刷に合わせて README を更新

カード一覧・任意カードサイズ・自動面付け・カット線・安全余白を
できることに追加し、ファイル構成を現状に合わせた。仕様書の
受け入れ基準のうち本計画の範囲を確認済みにした。"
```

---

## この計画の範囲外（次の計画で実装する）

仕様書 §9.3・§9.4 の**作品ライブラリと保存層**は別計画にする。理由は次の2点。

1. この計画だけで「44×67mm のポップを複数作って A4 に 16 枚印刷する」が完成し、
   実際に使って確かめられる状態になる。
2. 保存層は `file://` で IndexedDB が使えるかどうかの実測（仕様 §11 段階0）が先に必要で、
   その結果によって作りが変わる。

次の計画で扱う範囲:

- `store.js`（IndexedDB → `localStorage` → なし のフォールバック）
- 作品ライブラリ（ドキュメント丸ごとの名前付き保存・一覧・改名・複製・削除）
- 印刷／PNG 保存時の自動記録
- 画像解像度のカードサイズ連動を取り込み時に適用（`imageMaxSide` は本計画で用意済み）
- 旧 `localStorage` から新ストアへの複写

## Self-Review 記録

**1. 仕様カバレッジ** — §4 データモデル → Task 2・3／§4.1 向き切替の廃止 → Task 2・10／
§5 面付け計算 → Task 1／§6 描画 → Task 4・5／§7 比例スケール → Task 2・10／
§8 画面 → Task 7・8・10／§9.1 印刷・§9.2 PNG → Task 9／§9.3・§9.4 作品ライブラリ → **別計画**／
§9.5 JSON → Task 6／§10 移行 → Task 3・6／§11 ファイル構成 → 全体／§12 テスト → Task 1・2・3・5。

**2. プレースホルダ走査** — 「TBD」「あとで」「適切に処理する」の類は無し。各ステップに実コードを載せた。

**3. 型・名前の整合** — `cardSizeMm()`／`POPPresets.cardSize()`／`POPSheetView.layoutOf()` の
命名を全タスクで統一。`refreshAll(immediate)` は Task 6 で 0 引数版を作り Task 7 で引数版に
差し替えるため、Task 7 のステップに置き換えを明記した。`assetsByCard()` は Task 8 で定義し
Task 7・9 から使うため、Task 7 では同等の関数をインラインで渡している（Task 8 適用後は
`getAssets: assetsByCard` に簡約してよい）。

**4. 各タスク終了時に動くか** — Task 1〜5 は既存画面に影響しない追加のみ。Task 2 で
`defaultState()` を変更しないのはこのため。Task 6 で `doc` に切り替わり、以降は各タスクの
終わりにブラウザ確認手順を置いた。
