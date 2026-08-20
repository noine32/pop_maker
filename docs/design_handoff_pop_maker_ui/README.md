# 引き継ぎ仕様書：商品ポップメーカー UI 再設計

## 概要

既存の商品ポップメーカー（`noine32/pop_maker`、ブランチ `claude/product-popup-tool-v6r815`）の画面構成を、店舗スタッフ向けに使いやすく再設計したもの。機能は削らず、配置と情報の出し方だけを変える。

**現行の課題**（設計の出発点）
- 左パネルに「1. 内容を入力」〜「8. デザインの保存」の8セクションが縦積みで、目的の設定に到達するまでスクロールが長い
- 上部バーにボタンが9個並び、主要操作（印刷）と補助操作（dpi・データ保存）が同じ重みで並列
- プレビューが3カラムの右端で、最も見たいものが最も狭い
- 「保存済みデザインを呼び出して文字だけ差し替える」という最頻の使い方が、8番目の折りたたみの中に埋まっている

**再設計の方針**
- 保存済みデザインの呼び出しを画面最上段に常設し、最頻の使い方を第一手にする
- 編集パネルを「文字を入れる」「デザインを作る」の2タブに分割。既定は「文字を入れる」
- プレビューを最大面に置き、実寸表示と面付けプレビューをトグルで切り替える
- 上部バーは「印刷する」を主ボタンに、dpi・データ入出力・リセットは「その他 ▾」に格納

## デザインファイルについて

このフォルダに入っている `.dc.html` は **HTML で作られたデザイン参照物**であり、そのまま組み込む production コードではない。ボタンや入力欄は見た目のみで、canvas 描画・PNG 書き出し・印刷・localStorage への保存はすべて未実装。

実装のタスクは、**このデザインを既存コードベース（バニラ JS + canvas、`assets/js/*.js` のモジュール構成）の中で作り直すこと**。既存の `POPFonts` / `POPPresets` / 描画ロジック / 保存ロジックはそのまま使い、画面構成と DOM 構造だけを差し替える。デザインファイルの CSS を丸ごとコピーする必要はない（インラインスタイルで書かれているため、既存の `assets/css/style.css` の書き方に合わせて移し替えるほうがよい）。

含まれるファイル:
- `改良案.dc.html` — 再設計案（実装ターゲット）
- `現状UI再現.dc.html` — 現行 UI をコードから再現したもの。差分の確認用。実装対象ではない

## 忠実度

**高忠実度（hifi）**。色・タイポグラフィ・余白・角丸はすべて確定値。下記「デザイントークン」の値どおりに実装してよい。ただし既存の `style.css` に同等の値がすでにある場合は既存の変数を優先する。

## 画面構成

単一画面。上から4層。

```
┌─────────────────────────────────────────────────────────┐
│ ヘッダー（高さ 約56px）                                    │
├─────────────────────────────────────────────────────────┤
│ 「その他 ▾」展開時のバー（既定は非表示）                     │
├─────────────────────────────────────────────────────────┤
│ 保存済みデザインの棚（高さ 約72px、横スクロール）             │
├────────────┬──────────────────┬────────────────────────┤
│ ポップ一覧   │ 編集パネル（2タブ）  │ プレビュー               │
│ 236px 固定  │ 380〜420px        │ 残り全部（1fr）           │
└────────────┴──────────────────┴────────────────────────┘
```

CSS: `main { display: grid; grid-template-columns: 236px minmax(380px, 420px) 1fr; }`
想定幅は 1280px 以上。1024px 付近では編集パネルを 380px まで詰め、プレビューをスクロールさせる。

---

### 1. ヘッダー

`display:flex; align-items:center; gap:20px; padding:10px 20px; background:#fff; border-bottom:1px solid #d7dbe0`

**左：タイトル**
「商品ポップメーカー」 / 15px / 700 / `letter-spacing:.02em` / `white-space:nowrap`

**中央：ステップ表示**
`1 保存済みから選ぶ → 2 文字を入れる → 3 印刷する`
- コンテナ `display:flex; gap:10px; font-size:12px; white-space:nowrap; overflow:hidden`
- 各ステップ `display:flex; align-items:center; gap:6px`
- 番号の丸：18×18px / `border-radius:50%` / font-size 11px。**現在地**は `background:#0b6bcb; color:#fff`、ラベルは `color:#1f2328; font-weight:700`。**未到達**は `background:#e3e6ea; color:#616a75`、ラベルは `color:#616a75; font-weight:400`
- 区切りの `→` は `color:#b6bcc4`
- モックでは 1・2 が現在地、3 が未到達。**実装では「印刷する」を押した後に 3 を現在地にする程度でよい**（厳密な進行管理は不要。現在地の判定を作り込むより、ステップ 1・2 を常に有効、3 を印刷可能かどうかで切り替えるのが妥当）

**ステップ 1「保存済みから選ぶ」は棚（第3層）を指し、ステップ 2「文字を入れる」は編集パネルの左タブを指す。** ステップのラベルとタブのラベルが同じ語にならないよう「デザインを作る」タブと語を分けている。ここを崩さないこと（現行の「デザインを選ぶ」が棚とテンプレート一覧の両方に見えて混乱するのを避けるための命名）。

**右：操作ボタン群**（`margin-left:auto; gap:8px; flex-shrink:0`、各要素 `white-space:nowrap`）
| 要素 | スタイル | 動作 |
| --- | --- | --- |
| 「自動保存済み」 | 12px / `#616a75` | 保存状態の表示。保存直後は「自動保存しました」等に切り替え |
| 「その他 ▾」 | 13px / 600 / `#3d444d` / `border:1px solid #d7dbe0` / `border-radius:8px` / `padding:8px 12px` / hover `background:#f4f5f7` | 第2層をトグル |
| 「画像で保存」 | 13px / 600 / `#1f2328` / 白背景 / `border:1px solid #d7dbe0` / `padding:8px 14px` / hover `background:#f4f5f7; border-color:#0b6bcb` | 現行の PNG 保存 |
| 「印刷する」 | **15px / 700 / `#fff` / `background:#0b6bcb` / `padding:8px 22px`** / hover `background:#0a5aab` | `window.print()` |

### 2. 「その他 ▾」展開バー

既定は非表示。`display:flex; justify-content:flex-end; gap:8px; padding:10px 20px; background:#f7f8fa; border-bottom:1px solid #d7dbe0`

ボタン4つ（すべて 13px / 600 / `#3d444d` / 白 / `border:1px solid #d7dbe0` / `border-radius:8px` / `padding:6px 12px`。最後の1つは `color:#616a75`）:
1. データを書き出す（.json）
2. データを読み込む
3. 解像度：300dpi（印刷推奨） — 押すと 150 / 300 / 600 dpi を選ぶ。現行の select をここに寄せる
4. すべてリセット — 破壊的操作。確認ダイアログを出す

現行の「PNGの対象（シート／選択中のカードのみ）」と「全ページを保存する」チェックボックスもここに置く（モックでは省略）。

### 3. 保存済みデザインの棚

`display:flex; align-items:center; gap:14px; padding:10px 20px; background:#fff; border-bottom:1px solid #d7dbe0`

- 見出し「保存済みデザイン」 12px / 700 / `#616a75` / `white-space:nowrap`
- カード列 `display:flex; gap:8px; overflow-x:auto; flex:1; padding:2px`
- 各カード（`<button>`）:
  - `display:flex; align-items:center; gap:8px; background:#fff; border-radius:10px; padding:5px 12px 5px 6px; white-space:nowrap`
  - 枠線：未選択 `1px solid #d7dbe0`、**選択中 `1px solid #0b6bcb` + `box-shadow:0 0 0 3px #e7f0fb`**
  - 左のミニプレビュー：26×40px / `border:1px solid #e2e8f0` / 背景＝そのデザインの背景色 / 文字色＝アクセント色 / 中身は「￥」9px/800
  - 右：デザイン名（13px / 700 / `#1f2328`）と説明（11px / `#616a75`、テンプレート名＋サイズ、例「シンプル・44×67mm」）を縦積み、`line-height:1.35`
- 右端「＋ 今の見た目を保存」 12px / 600 / `#0b6bcb` / `border:1px solid #bcd4ee` / hover `background:#e7f0fb` / `white-space:nowrap`
  - 押すと名前入力（現行の「名前を付けて保存」と同じ localStorage の保存先を使う）

**この棚は現行の「8. デザインの保存」セクションを画面最上段に引き上げたもの。** 保存されるのは見た目（テンプレート・色・フォント・枠線・サイズ）のみで、文章は含めない。クリックすると現在選択中のポップに見た目だけを適用する（文章はそのまま残る）。

棚が空のとき（初回起動）は「まだ保存されたデザインはありません。『デザインを作る』タブで見た目を決めて、ここに保存できます。」を `#7c8590` / 12px で表示する。

棚の表示自体を隠せるようにしてある（`showShelf` フラグ）。保存済みが1件もないユーザーには邪魔になるため。

### 4. 左カラム：ポップ一覧（236px 固定）

`background:#f7f8fa; border-right:1px solid #d7dbe0; display:flex; flex-direction:column; gap:8px; padding:14px 12px`

- 見出し「ポップ一覧」13px/700 ＋ 枚数「3枚」11px/`#616a75`
- リスト `display:flex; flex-direction:column; gap:6px; overflow-y:auto; flex:1`
- 各項目（`<li>`、`grid-template-columns:40px 1fr; gap:10px; padding:8px; border-radius:10px; cursor:pointer`）
  - 未選択 `background:#fff; border:1px solid #e3e6ea`、**選択中 `background:#e7f0fb; border:1px solid #0b6bcb`**
  - サムネイル：**40×61px**（44×67mm の比率）/ `border:1px solid #e2e8f0` / 白背景。中身は商品名の先頭数文字（5px / `#616a75`）と価格（11px / 900 / `#111`）。**実装では canvas の縮小描画に置き換えること**（現行の `cards-ui.js` が持つサムネイル生成をそのまま使う。現行は 34×52px なので拡大する）
  - 右：商品名（13px / 600 / 1行省略 `text-overflow:ellipsis`）と価格（12px / `#475569`）
  - **現行にあった連番の表示（`1` `2` `3`）は削除した。** サムネイルと商品名で識別でき、番号は面付け順と混同されるため
- 下部ボタン
  - 「＋ ポップを追加」 幅いっぱい / 13px / 700 / `#0b6bcb` / `border:1px solid #bcd4ee` / `padding:9px 10px` / hover `background:#e7f0fb`
  - 「複製」「削除」 横並び `gap:6px` / 各 `flex:1` / 12px / 600 / 白 / `border:1px solid #d7dbe0` / `padding:7px 8px`。削除は `color:#616a75`
  - 説明文「ドラッグ、または ↑↓ キーで並べ替えできます」 11px / `#7c8590`
- 現行のキーボード操作（↑↓ で選択、Alt+↑↓ で並べ替え、ドラッグ並べ替え）はすべて維持

### 5. 中央カラム：編集パネル（380〜420px）

`background:#fff; border-right:1px solid #d7dbe0; display:flex; flex-direction:column`

**タブ**（`display:flex; gap:4px; padding:10px 14px 0; border-bottom:1px solid #d7dbe0`）
- 各タブ 14px / 700 / `padding:9px 16px` / `border:none` / `background:transparent`
- **選択中** `border-bottom:3px solid #0b6bcb; color:#0b6bcb`、未選択 `border-bottom:3px solid transparent; color:#616a75`
- 既定は「文字を入れる」

中身は `flex:1; overflow-y:auto; padding:16px 16px 40px`。**タブ切り替えでスクロール位置をリセットしないこと。**

#### タブA「文字を入れる」（既定）

現行「1. 内容を入力」の項目を、必要度の順に並べ替えたもの。`display:flex; flex-direction:column; gap:16px`

入力欄の共通スタイル：`background:#fff; border:1px solid #c9ced5; border-radius:8px; padding:9px 11px` / focus 時 `outline:2px solid #0b6bcb; outline-offset:1px; border-color:#0b6bcb`
ラベルの共通スタイル：13px / 700 / `#1f2328`。「必須」バッジは 10px / 700 / `#fff` / `background:#c0392b` / `border-radius:3px` / `padding:1px 5px`

順番と仕様:

1. **商品名**（必須バッジ） — `<textarea rows="2">` / **font-size 15px** / `line-height:1.5` / `resize:vertical`
2. **価格**（必須バッジ） — 横1行の組み合わせ:
   - 「¥」18px / 700 / `#616a75`（記号のプレビュー。下の「通貨記号」設定に連動）
   - 数値入力 `flex:1` / **font-size 22px / font-weight 700** / `inputmode="decimal"`
   - 「円」15px / `#616a75`
   - 税表記 `<select>` 13px（税込 / 税抜 / 本体価格 / 税込価格 / 表示しない）
   - 下にチェックボックス「通常価格を打ち消し線で併記する」12.5px / `#3d444d`。**チェック時のみ**参考価格の入力欄を出す（現行は常時表示だった）
3. **キャッチコピー** — 1行入力 / 15px。ラベル横に補助「商品名の上に小さく入ります」11px / 400 / `#7c8590`
4. **説明文** — `<textarea rows="3">` / 15px
5. **注記・店名** — 1行入力 / 14px
6. **折りたたみ「細かい表記（通貨記号・単位・バッジ）」**（既定は閉）
   - `<details>` / `border:1px solid #e3e6ea; border-radius:10px; background:#f7f8fa`
   - summary `padding:11px 14px` / 13px / 700 / `#3d444d`、先頭に `▸`（開くと `▾`）`color:#7c8590`
   - 中身：通貨記号 / 単位 / 補足 を `grid-template-columns:1fr 1fr 1fr; gap:10px`、下にチェックボックス「バッジ（NEW・おすすめ など）を表示する」。チェック時にバッジ文字とスタイル（角丸タグ／リボン／丸印）の入力を出す
7. **次への誘導ボックス**
   - `padding:12px 14px; background:#f2f7fd; border:1px solid #cfe0f4; border-radius:10px`
   - 「この文字を入れたまま、次のポップを作りますか？」12.5px / `#3d444d`
   - 右に「複製して続ける」ボタン 12.5px / 700 / `#0b6bcb` / `border:1px solid #bcd4ee`。押すと現在のポップを複製し、複製先を選択状態にして商品名にフォーカスする

**入力は現行どおりリアルタイムでプレビューに反映する。**

#### タブB「デザインを作る」

`display:flex; flex-direction:column; gap:14px`

1. **テンプレート**（折りたたみなし、常時表示）
   - 見出し「テンプレート」13px / 700
   - `display:grid; grid-template-columns:repeat(3,1fr); gap:8px` の9マス
   - 各マス（`<button>`）：`border-radius:10px; overflow:hidden; text-align:center`。枠線は未選択 `2px solid #e3e6ea`、**選択中 `2px solid #0b6bcb`**
     - 上：高さ 44px、そのテンプレートの背景色に文字色で「￥298」15px / 800
     - 下：テンプレート名 11px / `#3d444d` / `padding:5px 2px` / `border-top:1px solid #e3e6ea`
   - 下に「この見た目をすべてのポップに適用」12px / 600 / 白 / `border:1px solid #d7dbe0`
   - テンプレート9種の値は既存 `assets/js/presets.js` から取る。マスの色に使う値（背景色・アクセント色）:

     | ID | 名前 | 背景 | アクセント |
     | --- | --- | --- | --- |
     | simple | シンプル | `#ffffff` | `#222222` |
     | sale | セール | `#e60012` | `#ffff00` |
     | pop | ポップ | `#ffe100` | `#ff6a00` |
     | natural | ナチュラル | `#efe7d8` | `#5c4a33` |
     | handwrite | 手書き風 | `#ffffff` | `#2b6cb0` |
     | cute | かわいい | `#fff0f5` | `#e05a8a` |
     | japanese | 和風 | `#f7f3e8` | `#7b2d26` |
     | retro | レトロ | `#f3efe3` | `#4a6741` |
     | dark | ダーク | `#1f2933` | `#f0b429` |

2. **折りたたみ「文字（フォント・サイズ・色）」**（既定は**開**）
   - 上部に対象切替のセグメント：`display:flex; gap:2px; background:#e8eaee; border-radius:8px; padding:3px`。5ボタン（商品名 / キャッチ / 価格 / 説明文 / 注記）各 `flex:1` / 12px / 700 / `border-radius:6px` / `padding:7px 4px`。**選択中 `background:#fff; color:#0b6bcb`**、未選択 `background:transparent; color:#616a75`
   - 「〈対象〉のフォント」 `<select>`。ラベル横に「全23種／系統別」11px/400
   - **フォント一覧は既存 `assets/js/fonts.js` の `POPFonts.LIST` をそのまま使う。`<optgroup>` は系統別に7グループ**：標準（このPCのフォント）／ゴシック体／明朝体／丸ゴシック／手書き／筆・和レトロ／かわいい・ポップ。Web フォントには「（Web）」を付記する
   - 「このフォントを他の項目にも適用」ボタン 12px / 600
   - 文字サイズ：`<input type="range" min=10 max=300>` ＋ 数値入力（幅 78px）の組み合わせ。ラベルに現在値 `<output>` を 700 / `font-variant-numeric:tabular-nums` で表示、単位 pt
   - 太さ（標準 / 太字 / 極太）と文字色（`<input type="color">` 高さ 34px）を `grid-template-columns:1fr 1fr`
   - 行間：range `min=1 max=2.6 step=.05`、現在値を `<output>` 表示
   - 最下部に「全体を [小さく −][大きく ＋]」と、右端に「自動で縮小」チェックボックス（用紙からはみ出すときの自動縮小。既定 on）
   - range はすべて `accent-color:#0b6bcb; height:22px`

3. **折りたたみ「配置・枠線・背景色」**（既定は閉）
   - `grid-template-columns:1fr 1fr; gap:10px` で：文字揃え（中央 / 左 / 右）、縦の配置（中央 / 上寄せ / 上下いっぱい）、背景色（color）、アクセント色（color）
   - `grid-template-columns:1fr 1fr 1fr` で：枠線（なし / 実線 / 二重線 / 破線 / 角丸）、太さ mm（number step .1）、枠線の色（color）
   - 現行にあった「余白 mm」「要素の間隔 mm」「商品名と価格の間に区切り線」「ヘッダー帯」もここに置く（モックでは省略）

4. **折りたたみ「ポップの大きさ・印刷する紙」**（既定は閉）
   - ポップの大きさ `<select>`：44×67mm（縦）／67×44mm（横）／名刺（91×55mm）／A8（52×74mm）／A7（74×105mm）／B8・JIS（64×91mm）／正方形（50×50mm）／カスタム（mm指定）
   - 幅 mm・高さ mm の number 入力（`min=10 max=1000 step=.5`）
   - チェックボックス「文字とレイアウトも比例させる」（既定 on）
   - `<hr style="border-top:1px solid #e3e6ea">` で区切り
   - 印刷する紙 `<select>`：`<optgroup>` で JIS A判（A3〜A8）／ JIS B判（B4〜B8）／その他定型（はがき・名刺・正方形100×100・短冊210×74）／カスタム
   - 向き（縦 / 横）、安全余白 mm（`min=0 max=30 step=.5`、既定 5）、ポップの間隔 mm（`min=0 max=20 step=.5`、既定 0）
   - チェックボックス3つ（すべて既定 on）：「90°回して枚数が増えるなら回す」／「紙の中央に寄せる」／「カット線を入れる」
   - 注意文「安全余白を 0mm にすると枚数は増えますが、フチなし印刷に対応したプリンタ以外では端が欠けます。」11px / `#7c8590`
   - **現行の「3. カードの大きさ」と「4. 印刷シート」を1つにまとめたもの。** 両方を触らないと面付けが決まらないため

5. **折りたたみ「画像（写真・ロゴ）」**（既定は閉）
   - 「画像を選ぶ」13px / 700 / `#fff` / `background:#0b6bcb` と「削除」13px / 600 / `#616a75` / 白

### 6. 右カラム：プレビュー（1fr）

`display:flex; flex-direction:column; padding:14px 20px 20px; gap:10px; min-width:0`

**上段：表示切替**
- ピル型トグル `display:flex; gap:4px; background:#e2e5e9; border-radius:999px; padding:3px`
  - 「ポップ1枚」「印刷される紙」各 `border-radius:999px; padding:6px 18px` / 12.5px / 700 / `white-space:nowrap`
  - **選択中 `background:#0b6bcb; color:#fff`**、未選択 `background:transparent; color:#475569`
- 右端に情報「ポップ 44×67mm ／ A4 縦 ／ 実寸表示」12px / `#616a75`

**中段：プレビュー面**（`flex:1`）
- 市松模様の背景（透過を示す）:
  ```css
  background-image:
    linear-gradient(45deg,#e5e7ea 25%,transparent 25%,transparent 75%,#e5e7ea 75%),
    linear-gradient(45deg,#e5e7ea 25%,transparent 25%,transparent 75%,#e5e7ea 75%);
  background-size:20px 20px;
  background-position:0 0,10px 10px;
  background-color:#f5f6f8;
  border:1px solid #d7dbe0; border-radius:12px; padding:20px;
  display:flex; align-items:center; justify-content:center; overflow:auto;
  ```
- **「ポップ1枚」表示**：ポップ1枚を実寸で。モックでは 396×603px（44×67mm を約 9px/mm で表示）。影 `0 2px 6px rgba(0,0,0,.12), 0 14px 34px rgba(0,0,0,.14)`。**実装では現行の canvas をそのまま置く**
- **「印刷される紙」表示**：用紙全体と面付け結果。モックでは 378×535px（A4 の比率）に `padding:9px`（安全余白）、`grid-template-columns:repeat(4,1fr); grid-template-rows:repeat(4,1fr)` の16マス。各マスは `border:1px dashed #cfd4da`（カット線）。ポップが割り当てられたマスだけ内容を描き、余りは空
- **現行のプレビュー（378×576px の DOM 再現）より一回り大きくした。** 実寸に近づけるため

**下段：印刷の確認バー**
- `padding:11px 14px; background:#fff; border:1px solid #d7dbe0; border-radius:10px; display:flex; align-items:center; gap:12px`
- 面付けの要約「A4 1枚に16枚ぶん並びます（3枚を印刷 → 1ページ）」13px / `#3d444d`
- 注意「プリンタ設定は『実際のサイズ（100%）』を選んでください」12px / `#7c8590`
- 右端に「印刷する」ボタン（ヘッダーと同色、14px / 700 / `padding:8px 20px`）

**この確認バーは新規追加。** 「何枚が何ページに刷られるか」が印刷前にわからないという問題への対応。

## インタラクション・挙動

| 操作 | 挙動 |
| --- | --- |
| 棚のデザインをクリック | 選択中のポップに見た目（テンプレート・色・フォント・枠線・サイズ）を適用。文章は変更しない。棚のカードに選択リング |
| 「＋ 今の見た目を保存」 | 名前入力 → localStorage に保存 → 棚の末尾に追加 |
| ポップ一覧の項目クリック | 選択を移す。編集パネルの内容が切り替わる。プレビューも切り替わる |
| ポップ一覧 ↑↓ キー | 選択の上下移動 |
| ポップ一覧 Alt+↑↓ / ドラッグ | 並べ替え（面付け順に反映） |
| 「＋ ポップを追加」 | 空のポップを末尾に追加し、選択して商品名にフォーカス |
| 「複製して続ける」 | 現在のポップを複製し、複製先を選択して商品名にフォーカス（文字は残る） |
| タブ切替 | 表示のみ切り替え。**各タブのスクロール位置を保持する** |
| 「その他 ▾」 | 第2層バーの開閉 |
| 「すべてリセット」 | **確認ダイアログを出す**（現行同様） |
| 「印刷する」 | `window.print()`。押す前にプレビューが「印刷される紙」表示に切り替わると親切 |
| 「画像で保存」 | 現行の PNG 書き出し（dpi は「その他」の設定に従う） |
| 入力（すべて） | リアルタイムでプレビュー反映、自動保存（現行どおり） |
| 「通常価格を打ち消し線で併記する」 | チェック時のみ参考価格入力欄を表示 |
| 「バッジを表示する」 | チェック時のみバッジ文字・スタイル入力を表示 |

**バリデーション**：商品名と価格が必須。空のまま印刷しようとしたら、該当のポップを選択して該当入力欄をフォーカス＋赤枠にする。現行にバリデーションがないなら、無理に追加せず「必須」バッジの表示だけでもよい。

**アニメーション**：ホバーの色変化のみ（transition 120ms ease 程度）。`<details>` の開閉はブラウザ既定。それ以上の演出は不要。

**レスポンシブ**：PC（大画面）とノートPC（13〜14型）が対象。**スマホ・タブレット対応は今回のスコープ外。** 1280px 未満では上部バーのステップ表示が溢れるので `overflow:hidden` で切り、必要ならステップ表示を隠す。

## 状態

現行の状態管理をそのまま使う。UI 側で新たに必要なのは次のみ:

| 状態 | 初期値 | 用途 |
| --- | --- | --- |
| `activeTab` | `'text'` | 編集パネルのタブ（`'text'` / `'look'`） |
| `previewMode` | `'card'` | プレビュー表示（`'card'` / `'sheet'`） |
| `moreOpen` | `false` | 「その他 ▾」バーの開閉 |
| `activeTextTarget` | `'name'` | 文字設定の対象（商品名 / キャッチ / 価格 / 説明文 / 注記） |
| `selectedDesignId` | `null` | 棚で選択中のデザイン。棚のリング表示用 |
| `showShelf` | `true` | 棚の表示・非表示 |

既存の `selectedCardIndex`、カード配列、テンプレート、用紙設定、フォント設定はそのまま。

## デザイントークン

**色**
| 用途 | 値 |
| --- | --- |
| アクセント（主） | `#0b6bcb` |
| アクセント hover | `#0a5aab` |
| アクセント淡（選択背景） | `#e7f0fb` |
| アクセント枠（淡） | `#bcd4ee` |
| 情報ボックス背景 | `#f2f7fd` / 枠 `#cfe0f4` |
| 本文 | `#1f2328` |
| 副次テキスト | `#3d444d` |
| ラベル・補助 | `#616a75` |
| 薄い補助テキスト | `#7c8590` |
| 一覧の副次テキスト | `#475569` |
| 枠線（主） | `#d7dbe0` |
| 枠線（入力欄） | `#c9ced5` |
| 枠線（淡・折りたたみ） | `#e3e6ea` |
| 背景（ページ） | `#eceef1` |
| 背景（面） | `#fff` |
| 背景（副次面・折りたたみ） | `#f7f8fa` |
| 背景（セグメント track） | `#e8eaee` / ピル track `#e2e5e9` |
| 必須バッジ | `#c0392b` |
| 未到達ステップ | `#e3e6ea` / 文字 `#616a75` |
| 矢印 | `#b6bcc4` |

**タイポグラフィ**
- フォントスタック（UI）：`"Hiragino Kaku Gothic ProN","Hiragino Sans","Yu Gothic","Meiryo","Noto Sans JP",system-ui,-apple-system,sans-serif`
- 基準 14px / `line-height:1.6`
- スケール：22px(700) 価格入力 / 15px(700) 主ボタン・商品名入力 / 15px(700) タイトル / 14px(700) タブ / 13px(700) セクション見出し・ラベル / 13px(600) 副ボタン / 12.5px チェックボックス / 12px(600) 小ラベル / 11px 補助 / 5〜9px サムネイル内

**余白**
4 / 6 / 8 / 10 / 12 / 14 / 16 / 20 px

**角丸**
6px（セグメント内ボタン）／8px（入力欄・ボタン）／10px（カード・折りたたみ・一覧項目）／12px（プレビュー面）／999px（ピルトグル）／50%（ステップ番号）

**影**
- 用紙・ポップ `0 2px 6px rgba(0,0,0,.12), 0 14px 34px rgba(0,0,0,.14)`
- 選択リング（棚） `0 0 0 3px #e7f0fb`
- それ以外に影は使わない

**フォーカス**
入力欄 `outline:2px solid #0b6bcb; outline-offset:1px; border-color:#0b6bcb`。キーボード操作を潰さないこと。

## アセット

画像・アイコンは一切使っていない。記号は文字（`→` `▸` `▾` `＋` `−` `¥` `￥`）のみ。既存の Google Fonts 読み込み（`fonts.js`）はそのまま。

## 現行からの変更点まとめ

**構造**
- 8つの縦積みセクション → 2タブ ＋ タブ内の折りたたみ4つ
- 「3. カードの大きさ」と「4. 印刷シート」を1セクションに統合
- 「8. デザインの保存」を画面最上段の棚に昇格
- 上部バーの9ボタン → 主要3つ ＋ 「その他 ▾」に4つ格納
- 3カラムの比率変更（プレビューを最大に）

**新規**
- ステップ表示（1 保存済みから選ぶ → 2 文字を入れる → 3 印刷する）
- プレビュー下の印刷確認バー（面付け枚数・ページ数・プリンタ設定の注意）
- 「複製して続ける」の誘導ボックス
- 「印刷される紙」プレビュー（用紙全体の面付け表示）

**削除**
- ポップ一覧の連番表示
- セクション番号（1.〜8.）

**条件表示に変更**（現行は常時表示）
- 参考価格の入力欄 → 「打ち消し線で併記する」チェック時のみ
- バッジ文字・スタイル → 「バッジを表示する」チェック時のみ

**用語の変更**
| 現行 | 変更後 | 理由 |
| --- | --- | --- |
| カード | ポップ | 作っている物の名前に合わせる |
| シート | 印刷される紙 | 業界用語を避ける |
| PNG保存 | 画像で保存 | 拡張子を知らなくてもわかる |
| データ保存 / データ読込 | データを書き出す（.json）/ データを読み込む | 自動保存と混同されるため区別を明示 |
| 印刷 | 印刷する | 主ボタンとして動作を明示 |

**維持（削らないこと）**
- テンプレート9種
- フォント23種の系統別指定と、項目ごと（商品名・キャッチ・価格・説明文・注記）の個別設定
- 用紙プリセット（A判・B判・その他定型・カスタム）
- 面付け計算（90°回転・中央寄せ・カット線・安全余白・間隔）
- PNG 書き出しの dpi 指定（150 / 300 / 600）
- 自動保存、名前を付けて保存、データの書き出し・読み込み
- キーボード操作とドラッグ並べ替え
- 用紙からはみ出すときの自動縮小

## ファイル

- `改良案.dc.html` — 再設計案。実装ターゲット
- `現状UI再現.dc.html` — 現行 UI の再現。差分確認用

どちらも単一 HTML ファイルで、ブラウザで直接開ける。スタイルはすべてインライン。

**参照元リポジトリ**：`noine32/pop_maker` / ブランチ `claude/product-popup-tool-v6r815`

| 読むべきファイル | 用途 |
| --- | --- |
| `index.html` | 現行の DOM 構造。差し替え対象 |
| `assets/css/style.css` | 現行のスタイル。既存の変数・命名に合わせる |
| `assets/js/panels-ui.js` | 現行の操作パネル生成。再構成の主対象 |
| `assets/js/cards-ui.js` | カード一覧・サムネイル生成・キーボード操作 |
| `assets/js/presets.js` | テンプレート9種・用紙・カードサイズのプリセット |
| `assets/js/fonts.js` | フォント23種の定義（`POPFonts.LIST`） |
