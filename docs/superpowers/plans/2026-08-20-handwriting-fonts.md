# 手書きフォント追加と Web フォント遅延ロード Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 商用利用可（SIL OFL 1.1）の手書き系フォント 11 種を追加し、選択欄を系統別に整理し、Web フォントを遅延ロードに変えて初回ロードの 471KB を 0 にする。

**Architecture:** `assets/js/fonts.js` の `LIST` に `group` と `weights` を持たせて 23 種へ拡張する。Web フォント読み込みの単一の入口である `ensureFont()` の内側に `<link>` の動的注入を足すことで、呼び出し側（`app.js` / `export-tool.js`）を一切変えずに遅延ロード化する。`panels-ui.js` は用紙選択と同じ optgroup 生成に揃え、`presets.js` のテンプレートを 6→9 に増やす。

**Tech Stack:** 依存ライブラリなしの素の HTML/CSS/JS（ES5 系の書き方・`var` と関数式）。テストは Node 組み込みのみの自作ランナー（`node test/run.js`）。

## Global Constraints

- 設計書は `docs/superpowers/specs/2026-08-20-handwriting-fonts-design.md`。矛盾したら設計書が正。
- **既存フォントの `id` を変更しない**（保存済みデザイン・JSON の互換性が壊れるため）。
- **`state` に入れる weight は `400` / `700` / `900` のみ**。太さの選択欄にこの 3 つしか option が無く、それ以外を入れると次の操作で黙って 400 に戻る。
- `fonts.js` は**トップレベルで `document` に触れない**（`test/run.js` が `eval` で読み込むため）。DOM 参照は関数の内側だけ。
- 既存コードのスタイルに合わせる: `var` 宣言、IIFE、`'use strict'`、日本語コメントで「なぜ」を書く。
- `assets/css/style.css` と `assets/js/renderer.js` は**変更しない**。
- コミットメッセージは `<type>: <説明>` 形式（`feat` / `fix` / `refactor` / `docs` / `test`）。

---

## File Structure

| ファイル | 責務 | 本計画での変更 |
| --- | --- | --- |
| `assets/js/fonts.js` | フォント定義と Web フォント読み込み | `LIST` 拡張（Task 1）・遅延ロード（Task 2） |
| `assets/js/panels-ui.js` | 操作パネルの HTML 組み立て | `fontOptions()` を optgroup 化（Task 3） |
| `assets/js/presets.js` | 用紙・テンプレート・初期値 | `TEMPLATES` を 9 種へ（Task 4） |
| `index.html` | 画面と読み込み | 静的 `<link id="webfont-link">` 削除（Task 2） |
| `test/run.js` | 自作テストランナー | 各 Task でテスト追加 |
| `README.md` | 利用者向け説明 | 種類数の更新（Task 5） |

---

### Task 1: フォント定義を 23 種へ拡張し、系統(`group`)を持たせる

**Files:**
- Modify: `assets/js/fonts.js:1-33`（`LIST` 定義と返り値）
- Test: `test/run.js`（`POPText` の eval の直後にモジュール読み込みを追加し、末尾の `console.log` の前にテストを追加）

**Interfaces:**
- Produces:
  - `POPFonts.LIST`: `Array<{ id: string, group: string, label: string, stack: string, web: string|null, weights?: number[] }>` 23 要素
  - `POPFonts.byId`: `{ [id: string]: FontEntry }`
  - `group` の値は次の 7 種のみ: `'標準（このPCのフォント）'` `'ゴシック体'` `'明朝体'` `'丸ゴシック'` `'手書き'` `'筆・和レトロ'` `'かわいい・ポップ'`
  - `weights` は Google Fonts に要求するウェイト。省略＝単一ウェイト（400）。

**なぜ `weights` を既存フォントにも足すのか:** 現在の静的 `<link>` は `Noto Sans JP:wght@400;700;900` のように複数ウェイトを要求している。Task 2 で `<link>` を消すとき、`weights` が無いと 400 しか読まれず、太字・極太が実体のない合成太字に劣化する。**これは見逃しやすい退行なので、Task 1 でテストとして固定する。**

- [ ] **Step 1: 失敗するテストを書く**

`test/run.js` の `eval(read('assets/js/text.js'));` の直後に次を追加:

```js
/* --- POPFonts（LIST と cssUrl は DOM 非依存） --- */
eval(read('assets/js/fonts.js'));           // defines POPFonts
```

さらに、末尾の `console.log('\n' + pass + ...)` の直前に次を追加:

```js
/* ---------- フォント定義 ---------- */
var FONT_GROUPS = ['標準（このPCのフォント）', 'ゴシック体', '明朝体', '丸ゴシック',
                   '手書き', '筆・和レトロ', 'かわいい・ポップ'];

test('fonts: id が一意', function () {
  var seen = {};
  POPFonts.LIST.forEach(function (f) {
    assert.ok(!seen[f.id], 'id が重複: ' + f.id);
    seen[f.id] = true;
  });
  assert.strictEqual(POPFonts.LIST.length, 23);
});

test('fonts: 全エントリに既知の group がある', function () {
  POPFonts.LIST.forEach(function (f) {
    assert.ok(FONT_GROUPS.indexOf(f.group) >= 0, '未知の group: ' + f.id + ' / ' + f.group);
  });
});

test('fonts: LIST 内で同じ group が連続している', function () {
  /* 連続していないと optgroup が同名で分断されるため */
  var seenGroups = [];
  var prev = null;
  POPFonts.LIST.forEach(function (f) {
    if (f.group !== prev) {
      assert.ok(seenGroups.indexOf(f.group) < 0, 'group が分断: ' + f.group);
      seenGroups.push(f.group);
      prev = f.group;
    }
  });
});

test('fonts: web フォントの stack に自身の family 名が含まれる', function () {
  POPFonts.LIST.forEach(function (f) {
    if (!f.web) return;
    assert.ok(f.stack.indexOf('"' + f.web + '"') === 0,
      'stack の先頭が自身の family でない: ' + f.id);
  });
});

test('fonts: 既存 web フォントの weights が旧 <link> と一致する', function () {
  /* 静的 <link> を消したあとも太字・極太が実体のあるウェイトで出ることを守る */
  var expected = {
    notosans:  [400, 700, 900],
    notoserif: [400, 700, 900],
    rounded:   [400, 700, 800],
    kaisei:    [400, 700]
  };
  Object.keys(expected).forEach(function (id) {
    assert.deepStrictEqual(POPFonts.byId[id].weights, expected[id], 'weights 不一致: ' + id);
  });
  /* 単一ウェイトのものは weights を持たない */
  ['kosugimaru', 'dela', 'rocknroll', 'yusei', 'stick'].forEach(function (id) {
    assert.strictEqual(POPFonts.byId[id].weights, undefined, 'weights 不要: ' + id);
  });
});

test('fonts: 追加した手書き系11種が存在する', function () {
  ['kurenaido', 'klee', 'yomogi', 'yujisyuku', 'yujiboku', 'yujimai',
   'tegomin', 'kiwimaru', 'hachimaru', 'mochiy', 'potta'].forEach(function (id) {
    var f = POPFonts.byId[id];
    assert.ok(f, '未定義: ' + id);
    assert.ok(f.web, 'web フォントとして定義されていない: ' + id);
  });
});
```

- [ ] **Step 2: テストが失敗することを確認する**

Run: `npm test`
Expected: FAIL。`fonts: id が一意` が `Expected values to be strictly equal: 12 !== 23` で落ち、`group` 系のテストも `未知の group: sans / undefined` で落ちる。

- [ ] **Step 3: `LIST` を差し替える**

`assets/js/fonts.js` の `var LIST = [ ... ];` を丸ごと次に置き換える（`SANS` / `SERIF` / `MARU` の定義はそのまま残す）:

```js
  /* group は選択欄の optgroup にそのまま出る。LIST の並び順が画面の並び順で、
     同じ group は必ず連続させること（分断すると optgroup が二重に出る）。
     weights は Google Fonts に要求するウェイト。省略＝単一ウェイト(400)。
     fallback（stack の 2 番目以降）は、ネット不通時に性格の近い書体で代替するために選ぶ。 */
  var LIST = [
    /* 標準（このPCのフォント） */
    { id: 'sans',       group: '標準（このPCのフォント）', label: 'ゴシック体（標準）', stack: SANS,  web: null },
    { id: 'serif',      group: '標準（このPCのフォント）', label: '明朝体',             stack: SERIF, web: null },
    { id: 'maru',       group: '標準（このPCのフォント）', label: '丸ゴシック体',       stack: MARU,  web: null },

    /* ゴシック体 */
    { id: 'notosans',   group: 'ゴシック体', label: 'Noto Sans JP（Web）',        stack: '"Noto Sans JP",' + SANS,      web: 'Noto Sans JP',      weights: [400, 700, 900] },
    { id: 'stick',      group: 'ゴシック体', label: 'Stick（角ゴ細・Web）',       stack: '"Stick",' + SANS,             web: 'Stick' },
    { id: 'dela',       group: 'ゴシック体', label: 'Dela Gothic One（極太・Web）', stack: '"Dela Gothic One",' + SANS, web: 'Dela Gothic One' },

    /* 明朝体 */
    { id: 'notoserif',  group: '明朝体', label: 'Noto Serif JP（Web）',           stack: '"Noto Serif JP",' + SERIF,    web: 'Noto Serif JP',     weights: [400, 700, 900] },
    { id: 'kaisei',     group: '明朝体', label: 'Kaisei Decol（やわらか明朝・Web）', stack: '"Kaisei Decol",' + SERIF,  web: 'Kaisei Decol',      weights: [400, 700] },

    /* 丸ゴシック */
    { id: 'rounded',    group: '丸ゴシック', label: 'M PLUS Rounded 1c（丸・Web）', stack: '"M PLUS Rounded 1c",' + MARU, web: 'M PLUS Rounded 1c', weights: [400, 700, 800] },
    { id: 'kosugimaru', group: '丸ゴシック', label: '小杉丸ゴシック（Web）',        stack: '"Kosugi Maru",' + MARU,       web: 'Kosugi Maru' },
    { id: 'rocknroll',  group: '丸ゴシック', label: 'RocknRoll One（ポップ・Web）', stack: '"RocknRoll One",' + MARU,     web: 'RocknRoll One' },

    /* 手書き */
    { id: 'yusei',      group: '手書き', label: 'Yusei Magic（手書き風・Web）',    stack: '"Yusei Magic",' + SANS,       web: 'Yusei Magic' },
    { id: 'kurenaido',  group: '手書き', label: 'Zen Kurenaido（鉛筆風・Web）',    stack: '"Zen Kurenaido",' + SANS,     web: 'Zen Kurenaido' },
    { id: 'klee',       group: '手書き', label: 'Klee One（硬筆・Web）',           stack: '"Klee One",' + SERIF,         web: 'Klee One',          weights: [400, 600] },
    { id: 'yomogi',     group: '手書き', label: 'Yomogi（ゆるカジュアル・Web）',   stack: '"Yomogi",' + SANS,            web: 'Yomogi' },

    /* 筆・和レトロ */
    { id: 'yujisyuku',  group: '筆・和レトロ', label: 'Yuji Syuku（筆・楷書・Web）',   stack: '"Yuji Syuku",' + SERIF,   web: 'Yuji Syuku' },
    { id: 'yujiboku',   group: '筆・和レトロ', label: 'Yuji Boku（筆・素朴・Web）',    stack: '"Yuji Boku",' + SERIF,    web: 'Yuji Boku' },
    { id: 'yujimai',    group: '筆・和レトロ', label: 'Yuji Mai（筆・流麗・Web）',     stack: '"Yuji Mai",' + SERIF,     web: 'Yuji Mai' },
    { id: 'tegomin',    group: '筆・和レトロ', label: 'New Tegomin（手書き明朝・Web）', stack: '"New Tegomin",' + SERIF, web: 'New Tegomin' },
    { id: 'kiwimaru',   group: '筆・和レトロ', label: 'Kiwi Maru（丸明朝・Web）',      stack: '"Kiwi Maru",' + SERIF,    web: 'Kiwi Maru',         weights: [400, 500] },

    /* かわいい・ポップ */
    { id: 'hachimaru',  group: 'かわいい・ポップ', label: 'Hachi Maru Pop（丸文字・Web）',    stack: '"Hachi Maru Pop",' + MARU, web: 'Hachi Maru Pop' },
    { id: 'mochiy',     group: 'かわいい・ポップ', label: 'Mochiy Pop One（太丸ポップ・Web）', stack: '"Mochiy Pop One",' + MARU, web: 'Mochiy Pop One' },
    { id: 'potta',      group: 'かわいい・ポップ', label: 'Potta One（太マーカー・Web）',      stack: '"Potta One",' + MARU,      web: 'Potta One' }
  ];
```

- [ ] **Step 4: テストが通ることを確認する**

Run: `npm test`
Expected: PASS。`0 failed` で終わること。

- [ ] **Step 5: コミット**

```bash
git add assets/js/fonts.js test/run.js
git commit -m "feat: 商用利用可の手書き系フォント11種を追加し系統別に整理"
```

---

### Task 2: Web フォントを遅延ロードにする

**Files:**
- Modify: `assets/js/fonts.js`（`ensureFont` の直前に `cssUrl` / `loadFamilyCss` を追加、`ensureFont` を改修、返り値に `cssUrl` を追加）
- Modify: `index.html:10-11`（静的 `<link id="webfont-link">` を削除）
- Test: `test/run.js`（Task 1 で足したフォント定義テストの直後）

**Interfaces:**
- Consumes: Task 1 の `POPFonts.LIST` / `byId`（`web`・`weights`）
- Produces:
  - `POPFonts.cssUrl(f)` → `string`。`f` は `LIST` の要素。純関数。
  - `ensureFont(id, weight)` → `Promise<boolean>`（**シグネチャは変更なし**。`app.js` / `export-tool.js` は無変更）

- [ ] **Step 1: 失敗するテストを書く**

`test/run.js` の Task 1 で追加したテスト群の直後に追加:

```js
test('cssUrl: 単一ウェイトは wght を付けない', function () {
  assert.strictEqual(
    POPFonts.cssUrl(POPFonts.byId.kurenaido),
    'https://fonts.googleapis.com/css2?family=Zen+Kurenaido&display=swap');
});

test('cssUrl: 複数ウェイトは wght@ で列挙する', function () {
  assert.strictEqual(
    POPFonts.cssUrl(POPFonts.byId.notosans),
    'https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;700;900&display=swap');
});

test('cssUrl: 空白は + に置換される（複数語の family）', function () {
  assert.strictEqual(
    POPFonts.cssUrl(POPFonts.byId.hachimaru),
    'https://fonts.googleapis.com/css2?family=Hachi+Maru+Pop&display=swap');
});

test('cssUrl: 全 web フォントで https の css2 URL になる', function () {
  POPFonts.LIST.forEach(function (f) {
    if (!f.web) return;
    var u = POPFonts.cssUrl(f);
    assert.ok(u.indexOf('https://fonts.googleapis.com/css2?family=') === 0, 'URL 不正: ' + f.id);
    assert.ok(u.indexOf(' ') < 0, 'URL に空白: ' + f.id);
    assert.ok(u.indexOf('&display=swap') > 0, 'display=swap が無い: ' + f.id);
  });
});
```

- [ ] **Step 2: テストが失敗することを確認する**

Run: `npm test`
Expected: FAIL。`TypeError: POPFonts.cssUrl is not a function`。

- [ ] **Step 3: `fonts.js` に遅延ロードを実装する**

`assets/js/fonts.js` の `function ensureFont(...)` の**直前**に次を挿入する:

```js
  /* ---------- Webフォントの遅延ロード ----------
     全フォントの CSS を起動時に読むと、日本語フォントは1ファミリーあたり
     約120個の @font-face 宣言があるため CSS だけで数百KBに達する。
     実際に選ばれたファミリーの CSS だけを、選ばれた時に読む。 */

  /** Google Fonts の CSS URL を組み立てる（純関数） */
  function cssUrl(f) {
    var q = 'family=' + f.web.replace(/ /g, '+');
    if (f.weights && f.weights.length) q += ':wght@' + f.weights.join(';');
    return 'https://fonts.googleapis.com/css2?' + q + '&display=swap';
  }

  /* 回線が無応答のまま返らないと、印刷やPNG書き出しが待ち続けて固まる。
     成否が分からないまま一定時間で打ち切る。 */
  var CSS_TIMEOUT_MS = 8000;
  var cssLoaded = {};        /* family -> Promise<boolean>（注入は1回だけ） */

  /** ファミリーの CSS を <link> で注入する。成否によらず必ず resolve する */
  function loadFamilyCss(f) {
    if (cssLoaded[f.web]) return cssLoaded[f.web];
    cssLoaded[f.web] = new Promise(function (resolve) {
      var done = false;
      function finish(ok) { if (!done) { done = true; resolve(ok); } }
      var link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = cssUrl(f);
      link.onload = function () { finish(true); };
      link.onerror = function () { finish(false); };   /* オフラインでも描画は止めない */
      document.head.appendChild(link);
      setTimeout(function () { finish(false); }, CSS_TIMEOUT_MS);
    });
    return cssLoaded[f.web];
  }
```

続いて `ensureFont` の本体を次に置き換える:

```js
  /**
   * 指定フォント（Webフォント）が canvas で使えるよう読み込む。
   * CSS をまだ注入していなければ先に注入し、その onload を待ってから
   * document.fonts.load() を呼ぶ。先に呼ぶと @font-face が未登録で空振りする。
   * すでに読み込み済みなら即 resolve。失敗しても resolve（fallback表示になる）。
   */
  function ensureFont(id, weight) {
    var f = byId[id];
    if (!f || !f.web) return Promise.resolve(false);
    return loadFamilyCss(f).then(function () {
      if (!document.fonts || !document.fonts.load) return false;
      var spec = String(weight || 400) + ' 32px "' + f.web + '"';
      return document.fonts.load(spec, 'あア亜0Aa')
        .then(function (list) { return list && list.length > 0; })
        .catch(function () { return false; });
    });
  }
```

最後に、末尾の返り値に `cssUrl` を足す:

```js
  return { LIST: LIST, byId: byId, stack: stack, cssFont: cssFont,
           cssUrl: cssUrl, ensureFont: ensureFont, ensureAll: ensureAll };
```

- [ ] **Step 4: テストが通ることを確認する**

Run: `npm test`
Expected: PASS。`0 failed`。

- [ ] **Step 5: `index.html` から静的 `<link>` を削除する**

`index.html` の 10〜11 行目（`<link id="webfont-link" ...>` の 2 行）を削除する。
**`preconnect` の 8〜9 行目は残す**（初めてフォントを選んだ時の接続確立を先回りできるため）。
削除後、8〜11 行目は次のようになる:

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="assets/css/style.css">
</head>
```

- [ ] **Step 6: `webfont-link` の参照が残っていないことを確認する**

Run: `grep -rn "webfont-link" index.html assets test`
Expected: 出力なし（終了コード 1）。

- [ ] **Step 7: コミット**

```bash
git add assets/js/fonts.js index.html test/run.js
git commit -m "perf: Webフォントを選択時の遅延ロードにして初回471KBを解消"
```

---

### Task 3: フォント選択欄を系統別の optgroup にする

**Files:**
- Modify: `assets/js/panels-ui.js:17-21`（`fontOptions()`）

**Interfaces:**
- Consumes: Task 1 の `POPFonts.LIST`（`group` / `id` / `label`）
- Produces: `fontOptions()` → `string`（`<optgroup>` を含む HTML）。呼び出し側 `buildTextPanels()` は無変更。

`panels-ui.js` は DOM を組み立てるだけで `test/run.js` から eval できない（トップレベルではないが `document` 依存の関数が多い）。ここは**既存の `buildPaperOptions()` と同じ実装パターンに揃える**ことで正しさを担保し、検証は Task 5 の手動確認で行う。Task 1 の「group が連続している」テストが、optgroup が分断されないことを保証している。

- [ ] **Step 1: `fontOptions()` を書き換える**

`assets/js/panels-ui.js` の次の関数を:

```js
  function fontOptions() {
    return POPFonts.LIST.map(function (f) {
      return '<option value="' + f.id + '">' + f.label + '</option>';
    }).join('');
  }
```

次に置き換える（`buildPaperOptions()` と同じ「順序を保った optgroup 生成」）:

```js
  /* フォントが23種あるため系統ごとに optgroup でまとめる。
     並び順は POPFonts.LIST の出現順（用紙選択の buildPaperOptions と同じ方式）。 */
  function fontOptions() {
    var groups = {}, order = [];
    POPFonts.LIST.forEach(function (f) {
      var g = f.group || 'その他';
      if (!groups[g]) { groups[g] = []; order.push(g); }
      groups[g].push(f);
    });
    return order.map(function (g) {
      var opts = groups[g].map(function (f) {
        return '<option value="' + f.id + '">' + f.label + '</option>';
      }).join('');
      return '<optgroup label="' + g + '">' + opts + '</optgroup>';
    }).join('');
  }
```

- [ ] **Step 2: 既存テストが壊れていないことを確認する**

Run: `npm test`
Expected: PASS。`0 failed`。

- [ ] **Step 3: コミット**

```bash
git add assets/js/panels-ui.js
git commit -m "feat: フォント選択欄を系統別のoptgroupにまとめる"
```

---

### Task 4: テンプレートを 9 種にする

**Files:**
- Modify: `assets/js/presets.js:42-127`（`TEMPLATES` 配列）
- Test: `test/run.js`（Task 2 で足した `cssUrl` テストの直後）

**Interfaces:**
- Consumes: Task 1 の `POPFonts.byId`
- Produces: `POPPresets.TEMPLATES` 9 要素。各要素は既存と同じ `{ id, name, swatchBg, swatchFg, apply }` 構造。

- [ ] **Step 1: 失敗するテストを書く**

`test/run.js` の `cssUrl` テストの直後に追加:

```js
/* ---------- テンプレート ---------- */
var TEXT_KEYS = ['catch', 'name', 'price', 'desc', 'note'];

test('templates: 9種あり id が一意', function () {
  assert.strictEqual(POPPresets.TEMPLATES.length, 9);
  var seen = {};
  POPPresets.TEMPLATES.forEach(function (t) {
    assert.ok(!seen[t.id], 'id が重複: ' + t.id);
    seen[t.id] = true;
  });
});

test('templates: 参照する font id が全て実在する', function () {
  POPPresets.TEMPLATES.forEach(function (t) {
    TEXT_KEYS.forEach(function (k) {
      var id = t.apply[k].font;
      assert.ok(POPFonts.byId[id], t.id + '.' + k + ' が未定義フォントを参照: ' + id);
    });
  });
});

test('templates: weight は 400/700/900 のみ', function () {
  /* 太さの選択欄の option が この3つしか無く、他を入れると
     次の操作で黙って 400 に戻るため */
  POPPresets.TEMPLATES.forEach(function (t) {
    TEXT_KEYS.forEach(function (k) {
      var w = t.apply[k].weight;
      assert.ok([400, 700, 900].indexOf(w) >= 0,
        t.id + '.' + k + ' の weight が不正: ' + w);
    });
  });
});

test('templates: 追加3種と改良した手書き風が期待どおり', function () {
  var byId = {};
  POPPresets.TEMPLATES.forEach(function (t) { byId[t.id] = t; });
  ['cute', 'japanese', 'retro'].forEach(function (id) {
    assert.ok(byId[id], '未定義のテンプレート: ' + id);
  });
  /* 手書き風の商品名は Zen Kurenaido、価格は視認性優先で Yusei Magic のまま */
  assert.strictEqual(byId.handwrite.apply.name.font, 'kurenaido');
  assert.strictEqual(byId.handwrite.apply.price.font, 'yusei');
});
```

- [ ] **Step 2: テストが失敗することを確認する**

Run: `npm test`
Expected: FAIL。`Expected values to be strictly equal: 6 !== 9` と `未定義のテンプレート: cute`。

- [ ] **Step 3: `handwrite` テンプレートを改良する**

`assets/js/presets.js` の `id: 'handwrite'` の `apply` 内、`catch` / `name` / `desc` / `note` の `font` を
`'yusei'` から `'kurenaido'` に変更する。**`price` は `'yusei'` のまま残す**（Zen Kurenaido の数字は細く、価格の視認性が落ちるため）。変更後は次のとおり:

```js
        catch: { font: 'kurenaido', weight: 400, color: '#e0533d', size: 24 },
        name:  { font: 'kurenaido', weight: 400, color: '#243b53', size: 58 },
        price: { font: 'yusei',     weight: 400, color: '#2b6cb0', size: 118 },
        desc:  { font: 'kurenaido', weight: 400, color: '#334e68', size: 18 },
        note:  { font: 'kurenaido', weight: 400, color: '#829ab1', size: 12 },
```

- [ ] **Step 4: テンプレートを 3 種追加する**

`id: 'handwrite'` のオブジェクトの**直後**（`id: 'dark'` の直前）に、次の 3 つを順に挿入する:

```js
    {
      id: 'cute', name: 'かわいい', swatchBg: '#fff0f5', swatchFg: '#e05a8a',
      apply: {
        design: { bg: '#fff0f5', accent: '#e05a8a', band: 'none',
                  border: { style: 'round', width: 3, color: '#f2a0c0' } },
        layout: { align: 'center', valign: 'center', divider: false, padding: 13, gap: 9 },
        catch: { font: 'hachimaru', weight: 400, color: '#e05a8a', size: 22 },
        name:  { font: 'hachimaru', weight: 400, color: '#5b3145', size: 54 },
        /* 価格だけ太い書体にする。丸文字は数字が細く、遠目で読めないため */
        price: { font: 'mochiy',    weight: 400, color: '#e05a8a', size: 116 },
        desc:  { font: 'hachimaru', weight: 400, color: '#6b4a58', size: 17 },
        note:  { font: 'hachimaru', weight: 400, color: '#a98a97', size: 12 },
        badge: { bg: '#e05a8a', color: '#ffffff', style: 'circle' }
      }
    },
    {
      id: 'japanese', name: '和風', swatchBg: '#f7f3e8', swatchFg: '#7b2d26',
      apply: {
        design: { bg: '#f7f3e8', accent: '#7b2d26', band: 'none',
                  border: { style: 'solid', width: 1.6, color: '#7b2d26' } },
        layout: { align: 'center', valign: 'center', divider: true, padding: 16, gap: 9 },
        catch: { font: 'yujisyuku', weight: 400, color: '#7b2d26', size: 22 },
        name:  { font: 'yujisyuku', weight: 400, color: '#2f2a24', size: 56 },
        /* 筆書きの数字は細すぎて価格に向かないので、硬筆の太字にする */
        price: { font: 'klee',      weight: 700, color: '#7b2d26', size: 112 },
        desc:  { font: 'yujisyuku', weight: 400, color: '#4a4239', size: 18 },
        note:  { font: 'yujisyuku', weight: 400, color: '#8a7f6e', size: 12 },
        badge: { bg: '#7b2d26', color: '#f7f3e8', style: 'chip' }
      }
    },
    {
      id: 'retro', name: 'レトロ', swatchBg: '#f3efe3', swatchFg: '#4a6741',
      apply: {
        design: { bg: '#f3efe3', accent: '#4a6741', band: 'none',
                  border: { style: 'double', width: 1.4, color: '#4a6741' } },
        layout: { align: 'center', valign: 'center', divider: true, padding: 16, gap: 8 },
        catch: { font: 'tegomin',  weight: 400, color: '#8a5a2b', size: 21 },
        name:  { font: 'tegomin',  weight: 400, color: '#33301f', size: 54 },
        price: { font: 'kiwimaru', weight: 700, color: '#4a6741', size: 110 },
        desc:  { font: 'kiwimaru', weight: 400, color: '#4f4a3a', size: 17 },
        note:  { font: 'kiwimaru', weight: 400, color: '#8a8470', size: 12 },
        badge: { bg: '#4a6741', color: '#f3efe3', style: 'chip' }
      }
    },
```

結果として `TEMPLATES` の並びは `simple` `sale` `pop` `natural` `handwrite` `cute` `japanese` `retro` `dark` の 9 種になる。
`.templates` は `repeat(3, 1fr)` の 3 列グリッドなので 3 行に収まる。**CSS 変更は不要。**

- [ ] **Step 5: テストが通ることを確認する**

Run: `npm test`
Expected: PASS。`0 failed`。

- [ ] **Step 6: コミット**

```bash
git add assets/js/presets.js test/run.js
git commit -m "feat: 和風・かわいい・レトロのテンプレートを追加し手書き風を改良"
```

---

### Task 5: README を更新し、ブラウザで実挙動を確認する

**Files:**
- Modify: `README.md:32`, `README.md:46`, `README.md:64-65`

**Interfaces:**
- Consumes: Task 1〜4 の成果すべて

- [ ] **Step 1: README の記述を実体に合わせる**

`README.md:32` を:

```markdown
- 日本語フォント12種（ゴシック体・明朝体・丸ゴシック体＋Google Fonts の日本語フォント9種）
```

次に置き換える:

```markdown
- 日本語フォント23種（お使いのPCのゴシック体・明朝体・丸ゴシック体＋Google Fonts の日本語フォント20種）
- フォントは系統別（ゴシック体／明朝体／丸ゴシック／手書き／筆・和レトロ／かわいい・ポップ）に分かれています
- 手書き系は8種（Zen Kurenaido・Klee One・Yomogi・Yusei Magic ほか）、筆・和レトロ系5種、かわいい系3種
```

`README.md:46` を:

```markdown
- テンプレート6種：シンプル／セール／ポップ／ナチュラル／手書き風／ダーク
```

次に置き換える:

```markdown
- テンプレート9種：シンプル／セール／ポップ／ナチュラル／手書き風／かわいい／和風／レトロ／ダーク
```

`README.md:64-65` を:

```markdown
> Google Fonts の日本語フォント（Noto Sans JP、Dela Gothic One など）を使う場合はインターネット接続が必要です。
> オフラインのときは自動的にお使いのパソコンのフォントで表示されます（レイアウトは崩れません）。
```

次に置き換える:

```markdown
> Google Fonts の日本語フォント（Noto Sans JP、Zen Kurenaido など）を使う場合はインターネット接続が必要です。
> フォントは**選んだときに初めて読み込まれる**ので、起動は軽いままです。
> オフラインのときは自動的にお使いのパソコンのフォントで表示されます（レイアウトは崩れません）。
```

- [ ] **Step 2: 数がソースと合っているか機械的に確認する**

Run:
```bash
node -e "var fs=require('fs');eval(fs.readFileSync('assets/js/fonts.js','utf8'));eval(fs.readFileSync('assets/js/presets.js','utf8'));console.log('fonts',POPFonts.LIST.length,'web',POPFonts.LIST.filter(function(f){return f.web;}).length,'templates',POPPresets.TEMPLATES.length);"
```
Expected: `fonts 23 web 20 templates 9`

- [ ] **Step 3: 全テストを実行する**

Run: `npm test`
Expected: PASS。`0 failed`。

- [ ] **Step 4: ブラウザで手動確認する**

`index.html` をブラウザで開き、DevTools を開いた状態で次を順に確認する:

1. **起動直後**の Network タブに `fonts.googleapis.com` へのリクエストが**無い**こと。
2. 商品名のフォント欄が **7 つの optgroup** に分かれていること。
3. 「手書き」から `Zen Kurenaido` を選ぶと、その時点で `fonts.googleapis.com` へのリクエストが **1 本だけ**発生し、プレビューが切り替わること。
4. 同じフォントを説明文にも選んでも、**リクエストが増えない**こと。
5. テンプレート「かわいい」「和風」「レトロ」を順に当て、**豆腐（□）が出ない**こと。商品名を `鰤 苺 檸檬 蕎麦` に変えても豆腐が出ないこと。
6. テンプレートを当てた直後に「文字の太さ」欄が空欄にならないこと（400/700/900 のいずれかが選択されている）。
7. 「PNG保存（300dpi）」で書き出した画像が、フォールバックでなく選んだ手書きフォントで描かれていること。
8. DevTools の Network を **Offline** にしてフォントを選び、操作が固まらず 8 秒以内にフォールバック表示のまま操作を続けられること。

- [ ] **Step 5: コミット**

```bash
git add README.md
git commit -m "docs: フォント23種・テンプレート9種・遅延ロードに合わせてREADMEを更新"
```

---

## Self-Review

**1. Spec coverage**

| 設計書の節 | 対応 Task |
| --- | --- |
| §4 追加フォント 11 種 | Task 1 |
| §4.1 weight の扱いと 400/700/900 制約 | Task 1（`weights`）・Task 4（テンプレの weight テスト） |
| §5 選択欄のグループ化 | Task 1（`group`）・Task 3（optgroup 生成） |
| §6 遅延ロード（`cssUrl` / `loadFamilyCss` / タイムアウト） | Task 2 |
| §6.3 `index.html` の変更 | Task 2 Step 5 |
| §7 テンプレート 6→9 | Task 4 |
| §8 テスト | Task 1・2・4 に分散 |
| §9 手動確認 | Task 5 Step 4 |
| §10 影響範囲（README 含む） | Task 5 |

**2. Placeholder scan:** なし。全ステップに実コード・実コマンド・期待出力を記載済み。

**3. Type consistency:** `cssUrl(f)` は Task 2 で定義し Task 2 のテストでのみ使用。`group` / `weights` は Task 1 で定義し Task 2（`cssUrl`）・Task 3（optgroup）で消費。フォント id（`kurenaido` / `klee` / `mochiy` など）は Task 1 の定義と Task 4 のテンプレート参照で一致。テンプレート id（`cute` / `japanese` / `retro`）は Task 4 の実装とテストで一致。
