# 設計: 商用利用可の手書きフォント追加と Web フォントの遅延ロード

- 日付: 2026-08-20
- 対象: 商品ポップメーカー（依存ライブラリなしの素の HTML/CSS/JS・canvas 描画）
- 状態: 承認済み（実装前）
- 関連: `2026-08-17-image-and-jis-paper-design.md` / `2026-08-18-multi-card-imposition-design.md`

## 1. 背景と目的

現状 `assets/js/fonts.js` の `LIST` は 12 種だが、**手書き系は `Yusei Magic` 1 種しかない**。
テンプレート「手書き風」も全項目が `yusei` で、手書きの表情を選ぶ余地がない。

目的は次の 3 点。

1. **商用利用できる手書き系フォントを 11 種追加**し、系統（手書き／筆・和レトロ／かわいい）を選べるようにする。
2. フォントが 23 種になるため、**選択欄を系統別にグループ化**して選びやすさを保つ。
3. 追加によって初回ロードが重くならないよう、**Web フォントを遅延ロード**に変える。
   これは追加分の対策であると同時に、**現状すでにある初回 471KB の重さも解消**する。

## 2. 事前調査（実測・2026-08-20）

判断の根拠は推測ではなく実測による。

| 調べたこと | 方法 | 結果 |
| --- | --- | --- |
| 日本語が使える Google Fonts の全ファミリー | `https://fonts.google.com/metadata/fonts` を取得し `subsets` に `japanese` を含むものを抽出 | 68 ファミリー |
| ライセンス | `raw.githubusercontent.com/google/fonts/main/ofl/<dir>/OFL.txt` の実在を HTTP で確認 | 採用候補は**全て SIL OFL 1.1** |
| 漢字カバー率 | 各ファミリーの `css2` を取得し `unicode-range` を解析。`鰤(U+9C24) 苺(U+82FA) 檸(U+6AAC) 蕎(U+854E)` の有無を判定 | 下記 |
| 実際の見え方 | `text=` 動的サブセットで woff2 を取得し埋め込んだ見本シートをヘッドレス Chrome で描画 | 12 種すべて豆腐なしを目視確認 |

### 2.1 漢字カバー率で落とした候補

`@font-face` の分割数が 114 以上のファミリーは常用外漢字まで持つが、
`Kapakana`(28) / `Tsukimi Rounded`(38) / `Darumadrop One`(54) / `Slackside One`(54) /
`Cherry Bomb One`(57) は **鰤・苺・檸 を持たない**。
店頭 POP は魚介・果物・和菓子など常用外漢字が日常的に出るため、
これらは「見た目は手書きらしいが実用にならない」と判断し**採用しない**。

### 2.2 見本から分かった注意点

- `Yuji Syuku` / `Yuji Boku` / `Yuji Mai` / `Yomogi` / `New Tegomin` は**数字が細く**、
  POP の主役である価格には視認性が不足する。とくに `Yuji Boku` は `¥1,280` が `Y7,280` に見える。
  → **テンプレートでは価格にこれらを割り当てない**（利用者が手で選ぶのは自由）。
- `Mochiy Pop One` / `Potta One` は数字が太く強い。手書きというより「太いポップ体」。
- `Zen Kurenaido` / `Klee One` は本文の可読性と手書き感のバランスが最良。

## 3. 非目標（YAGNI）

- フォントファイルのリポジトリ同梱（オフライン対応）。日本語 11 種で数十 MB になり、
  サブセット化のビルド工程が必要になる。「`index.html` を開くだけ」の手軽さを壊すため採らない。
- 選択欄でのフォントプレビュー表示（各 option を実際の書体で見せる）。
  全フォントの先読みが必要になり、遅延ロードと矛盾する。
- 縦書き・袋文字・縁取りなどの装飾。今回の範囲外。
- 手書き系以外のフォント追加。

## 4. 追加するフォント（11 種）

`assets/js/fonts.js` の `LIST` に追加する。すべて SIL OFL 1.1。

| id | family (`web`) | label | group | `weights` | fallback |
| --- | --- | --- | --- | --- | --- |
| `kurenaido` | Zen Kurenaido | Zen Kurenaido（鉛筆風・Web） | 手書き | — | `SANS` |
| `klee` | Klee One | Klee One（硬筆・Web） | 手書き | `[400, 600]` | `SERIF` |
| `yomogi` | Yomogi | Yomogi（ゆるカジュアル・Web） | 手書き | — | `SANS` |
| `yujisyuku` | Yuji Syuku | Yuji Syuku（筆・楷書・Web） | 筆・和レトロ | — | `SERIF` |
| `yujiboku` | Yuji Boku | Yuji Boku（筆・素朴・Web） | 筆・和レトロ | — | `SERIF` |
| `yujimai` | Yuji Mai | Yuji Mai（筆・流麗・Web） | 筆・和レトロ | — | `SERIF` |
| `tegomin` | New Tegomin | New Tegomin（手書き明朝・Web） | 筆・和レトロ | — | `SERIF` |
| `kiwimaru` | Kiwi Maru | Kiwi Maru（丸明朝・Web） | 筆・和レトロ | `[400, 500]` | `SERIF` |
| `hachimaru` | Hachi Maru Pop | Hachi Maru Pop（丸文字・Web） | かわいい・ポップ | — | `MARU` |
| `mochiy` | Mochiy Pop One | Mochiy Pop One（太丸ポップ・Web） | かわいい・ポップ | — | `MARU` |
| `potta` | Potta One | Potta One（太マーカー・Web） | かわいい・ポップ | — | `MARU` |

`stack` は既存の書き方に合わせ `'"<family>",' + <fallback>` とする（`SANS` / `SERIF` / `MARU` は
`fonts.js` 冒頭で定義済みの定数）。ネットが無いときはこのフォールバックで描かれるので、
**書体の性格が近い側**を選ぶ（筆・明朝寄りは `SERIF`、丸ポップ系は `MARU`）。
`weights` が `—` の行は単一ウェイト（400）のため CSS で weight を指定しない。

### 4.1 weight の扱い

アプリの太さは 標準=400 / 太字=700 / 極太=900 の 3 段だが、追加フォントの大半は 400 のみ。
これは既存の `Kosugi Maru` などと同じ状況で、ブラウザの合成太字が使われる。**現状の挙動を変えない。**
`Klee One`(400/600) と `Kiwi Maru`(400/500) だけは実体のある weight を CSS で要求し、
太字指定時にブラウザが 600 / 500 の実体を使えるようにする（合成太字より字形が崩れない）。

**制約**: 太さの選択欄（`panels-ui.js`）の option は `400` / `700` / `900` の 3 つだけである。
`weights` に `600` や `500` を持つフォントでも、**`state` に入れてよい weight は 400/700/900 に限る**。
それ以外を入れるとテンプレート適用後に選択欄が該当なしになり、次の操作で値が黙って 400 に戻る。
テンプレート定義（§7）はこの制約に従う。

## 5. 選択欄のグループ化

`LIST` の各要素に `group` を追加し、`panels-ui.js` の `fontOptions()` を
既存の `buildPaperOptions()` と同じ「順序を保った optgroup 生成」に揃える。
グループの並び順は `LIST` の出現順とする（用紙選択と同じ方式＝新しい概念を持ち込まない）。

| group | 含まれる id |
| --- | --- |
| 標準（この PC のフォント） | `sans` `serif` `maru` |
| ゴシック体 | `notosans` `stick` `dela` |
| 明朝体 | `notoserif` `kaisei` |
| 丸ゴシック | `rounded` `kosugimaru` `rocknroll` |
| 手書き | `yusei` `kurenaido` `klee` `yomogi` |
| 筆・和レトロ | `yujisyuku` `yujiboku` `yujimai` `tegomin` `kiwimaru` |
| かわいい・ポップ | `hachimaru` `mochiy` `potta` |

`LIST` の並び順自体をこの表の順に並べ替える。既存フォントの **id は変えない**ため、
保存済みデザイン・JSON の互換性は保たれる。

## 6. Web フォントの遅延ロード

### 6.1 現状と問題

`index.html` の `<link id="webfont-link">` が 9 ファミリーぶんの CSS を起動時に読む。
実測で **471KB（br 圧縮後）**。11 種足すと **849KB** になる。
実フォント本体は使う文字ぶんしか落ちないので、この 849KB は「使わないフォントの定義」も含む純粋な無駄。

### 6.2 設計

**`fonts.js` が Web フォント読み込みの単一の入口である**という現状の性質を保ったまま、
`ensureFont()` の内側に「CSS の動的注入」を足す。呼び出し側（`app.js` / `export-tool.js`）は変更不要。

```js
/* 純関数。テスト対象。 */
function cssUrl(f) {
  var q = 'family=' + f.web.replace(/ /g, '+');
  if (f.weights && f.weights.length) q += ':wght@' + f.weights.join(';');
  return 'https://fonts.googleapis.com/css2?' + q + '&display=swap';
}

/* ファミリー単位で1回だけ <link> を注入し、その Promise を使い回す。
   成否によらず必ず解決する（reject しない）＝描画を止めないため。 */
var CSS_TIMEOUT_MS = 8000;
var cssLoaded = {};          /* family -> Promise<boolean> */

function loadFamilyCss(f) {
  if (cssLoaded[f.web]) return cssLoaded[f.web];
  cssLoaded[f.web] = new Promise(function (resolve) {
    var done = false;
    function finish(ok) { if (!done) { done = true; resolve(ok); } }
    var link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = cssUrl(f);
    link.onload = function () { finish(true); };
    link.onerror = function () { finish(false); };
    document.head.appendChild(link);
    setTimeout(function () { finish(false); }, CSS_TIMEOUT_MS);
  });
  return cssLoaded[f.web];
}
```

`ensureFont()` は `loadFamilyCss(f)` を待ってから、これまで通り
`document.fonts.load(spec, 'あア亜0Aa')` を呼ぶ。CSS 注入に失敗していた場合も
`document.fonts.load()` は解決する（該当 `@font-face` が無いだけ）ので、
既存の「失敗しても resolve する」性質はそのまま保たれる。

- `link.onload` を待ってから `document.fonts.load()` を呼ぶ。
  先に呼ぶと `@font-face` が未登録で、読み込んだつもりの空振りになるため。
- `link.onerror` は `false` で解決する（**reject しない**）。オフラインでも描画は止めない。
- **8 秒のタイムアウト**を置き、`onload` も `onerror` も来ない場合に `false` で解決する。
  印刷・PNG 書き出しは `ensureAll()` の完了を待つ設計なので、ここが返らないと操作が固まる。
- 一度注入した `<link>` は再利用する（`cssLoaded` にキャッシュ）。`app.js` 側の `ensured` キャッシュとは
  役割が違う（あちらは weight 単位の再描画抑止、こちらはファミリー単位の CSS 注入抑止）。

### 6.3 `index.html` の変更

- `<link id="webfont-link" ...>` を**削除**する。
- `preconnect` の 2 行は**残す**。初めてフォントを選んだ時の接続確立を先回りできるため。

### 6.4 効果と副作用

| | 現状 | 変更後 |
| --- | --- | --- |
| 初回起動で読む CSS | 471KB | 0 |
| フォントを 1 種選んだとき | 0（済） | 約 28KB |
| 保存データ読込・テンプレ適用 | 済 | 必要なファミリーだけ都度 |

副作用として、**フォントを選んだ直後に一瞬フォールバック表示が出てから切り替わる**。
これは現状も「CSS 読み込み中」に起きていた現象が、タイミングだけ後ろにずれるもの。
`display=swap` を維持し、`ensureFont()` 完了後に `refreshAll()` で描き直す既存の流れで吸収する。

## 7. テンプレート（6 → 9）

`presets.js` の `TEMPLATES` を変更する。**価格には §2.2 で細いと判定したフォントを使わない。**

### 7.1 既存「手書き風」の改良

商品名・キャッチ・説明・注記を `kurenaido` に変更し、**価格は `yusei` のまま**残す
（Zen Kurenaido の数字は細く、価格の視認性が落ちるため）。色・枠線は変更しない。

### 7.2 追加する 3 種

| id | name | swatch | 主なフォント（weight は 400/700/900 のみ・§4.1） |
| --- | --- | --- | --- |
| `japanese` | 和風 | bg `#f7f3e8` / fg `#7b2d26` | キャッチ・商品名・説明・注記 `yujisyuku`(400)、価格 `klee`(700) |
| `cute` | かわいい | bg `#fff0f5` / fg `#e05a8a` | キャッチ・商品名・説明・注記 `hachimaru`(400)、価格 `mochiy`(400) |
| `retro` | レトロ | bg `#f3efe3` / fg `#4a6741` | キャッチ・商品名 `tegomin`(400)、説明・注記 `kiwimaru`(400)、価格 `kiwimaru`(700) |

価格に `klee`(700) / `kiwimaru`(700) を使うのは、CSS で 600 / 500 の実体を要求しているため
ブラウザがそれを選び、素の 400 より太く出るからである（§4.1）。

並び順は `simple` `sale` `pop` `natural` `handwrite` `cute` `japanese` `retro` `dark` とし、
系統が近いものを隣に置く。`dark` は最後に残す。

CSS の `.templates` は `repeat(3, 1fr)` なので、9 個は 3 行にきれいに収まる。**CSS 変更なし。**

## 8. テスト（`test/run.js` に追加）

`fonts.js` は現状 DOM に触れるのが関数の内側だけなので、他の純粋モジュールと同じく
`eval(read('assets/js/fonts.js'))` で読み込める。遅延ロード実装後も
トップレベルで `document` に触れないことを制約として守る。

| テスト | 目的 |
| --- | --- |
| フォント id が一意 | コピペによる重複の検知 |
| 全エントリに既知の `group` がある | グループ化の取りこぼし検知 |
| `web` を持つエントリは `stack` に自身の family 名を含む | 定義の食い違い検知 |
| `cssUrl()` が正しい URL を返す（weight 指定あり／なし） | 遅延ロードの心臓部の検証 |
| **全テンプレートの font id が `POPFonts.byId` に実在する** | 現在ノーガード。9 種に増えるため必須 |
| **全テンプレートの weight が 400/700/900 のいずれか** | §4.1 の制約違反（選択欄と食い違い値が黙って戻る）の検知 |
| `LIST` の並び順で group が連続している | optgroup が分断されないことの保証 |

## 9. 手動確認（実装後）

1. 起動直後の DevTools Network に `fonts.googleapis.com` へのリクエストが**無い**こと。
2. 手書き系フォントを選ぶと、その時点で 1 リクエストだけ発生し、プレビューが切り替わること。
3. 同じフォントを他項目にも適用しても、リクエストが増えないこと。
4. 追加 9 テンプレートを順に当て、豆腐（□）が出ないこと。
5. 300dpi PNG 書き出しと印刷プレビューで、選んだ手書きフォントが**フォールバックでなく**反映されること。
6. オフライン（DevTools の Offline）でフォントを選んでも、操作が固まらずフォールバック表示になること。

## 10. 影響範囲

| ファイル | 変更 |
| --- | --- |
| `assets/js/fonts.js` | `LIST` に 11 種追加・`group`/`weights` 追加・`cssUrl()`/`loadFamilyCss()` 新設・`ensureFont()` 改修 |
| `assets/js/panels-ui.js` | `fontOptions()` を optgroup 生成に変更 |
| `assets/js/presets.js` | `TEMPLATES` の `handwrite` 改良＋3 種追加・並び替え |
| `index.html` | 静的 `<link id="webfont-link">` を削除（preconnect は残す） |
| `test/run.js` | §8 のテストを追加 |
| `README.md` | フォント種類数（12→23）とテンプレート数（6→9）の記述を更新 |

`assets/css/*.css` と `renderer.js` は**変更しない**。
