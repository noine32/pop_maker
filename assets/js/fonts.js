/* ===========================================================
   フォント定義
   - system : OSに入っているフォントを使う（オフラインでも確実）
   - web    : Google Fonts を読み込む（ネット接続時のみ／未取得ならfallback）
   canvas の fillText で使うため、実際に描画する前に document.fonts.load()
   で読み込みを待つ必要がある（loadFonts / ensureFont を参照）。
   =========================================================== */
var POPFonts = (function () {
  'use strict';

  var SANS = '"Hiragino Kaku Gothic ProN","Hiragino Sans","Yu Gothic","YuGothic","Meiryo","MS PGothic",sans-serif';
  var SERIF = '"Hiragino Mincho ProN","Yu Mincho","YuMincho","MS PMincho","Noto Serif JP",serif';
  var MARU = '"Hiragino Maru Gothic ProN","Kosugi Maru","M PLUS Rounded 1c",' + SANS;

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
    { id: 'notosans',   group: 'ゴシック体', label: 'Noto Sans JP（Web）',          stack: '"Noto Sans JP",' + SANS,       web: 'Noto Sans JP',      weights: [400, 700, 900] },
    { id: 'stick',      group: 'ゴシック体', label: 'Stick（角ゴ細・Web）',         stack: '"Stick",' + SANS,              web: 'Stick' },
    { id: 'dela',       group: 'ゴシック体', label: 'Dela Gothic One（極太・Web）', stack: '"Dela Gothic One",' + SANS,    web: 'Dela Gothic One' },

    /* 明朝体 */
    { id: 'notoserif',  group: '明朝体', label: 'Noto Serif JP（Web）',              stack: '"Noto Serif JP",' + SERIF,   web: 'Noto Serif JP',     weights: [400, 700, 900] },
    { id: 'kaisei',     group: '明朝体', label: 'Kaisei Decol（やわらか明朝・Web）', stack: '"Kaisei Decol",' + SERIF,    web: 'Kaisei Decol',      weights: [400, 700] },

    /* 丸ゴシック */
    { id: 'rounded',    group: '丸ゴシック', label: 'M PLUS Rounded 1c（丸・Web）', stack: '"M PLUS Rounded 1c",' + MARU, web: 'M PLUS Rounded 1c', weights: [400, 700, 900] },
    { id: 'kosugimaru', group: '丸ゴシック', label: '小杉丸ゴシック（Web）',         stack: '"Kosugi Maru",' + MARU,       web: 'Kosugi Maru' },
    { id: 'rocknroll',  group: '丸ゴシック', label: 'RocknRoll One（ポップ・Web）',  stack: '"RocknRoll One",' + MARU,     web: 'RocknRoll One' },

    /* 手書き */
    { id: 'yusei',      group: '手書き', label: 'Yusei Magic（手書き風・Web）',   stack: '"Yusei Magic",' + SANS,    web: 'Yusei Magic' },
    { id: 'kurenaido',  group: '手書き', label: 'Zen Kurenaido（鉛筆風・Web）',   stack: '"Zen Kurenaido",' + SANS,  web: 'Zen Kurenaido' },
    { id: 'klee',       group: '手書き', label: 'Klee One（硬筆・Web）',          stack: '"Klee One",' + SERIF,      web: 'Klee One',      weights: [400, 600] },
    { id: 'yomogi',     group: '手書き', label: 'Yomogi（ゆるカジュアル・Web）',  stack: '"Yomogi",' + SANS,         web: 'Yomogi' },

    /* 筆・和レトロ */
    { id: 'yujisyuku',  group: '筆・和レトロ', label: 'Yuji Syuku（筆・楷書・Web）',    stack: '"Yuji Syuku",' + SERIF,  web: 'Yuji Syuku' },
    { id: 'yujiboku',   group: '筆・和レトロ', label: 'Yuji Boku（筆・素朴・Web）',     stack: '"Yuji Boku",' + SERIF,   web: 'Yuji Boku' },
    { id: 'yujimai',    group: '筆・和レトロ', label: 'Yuji Mai（筆・流麗・Web）',      stack: '"Yuji Mai",' + SERIF,    web: 'Yuji Mai' },
    { id: 'tegomin',    group: '筆・和レトロ', label: 'New Tegomin（手書き明朝・Web）', stack: '"New Tegomin",' + SERIF, web: 'New Tegomin' },
    { id: 'kiwimaru',   group: '筆・和レトロ', label: 'Kiwi Maru（丸明朝・Web）',       stack: '"Kiwi Maru",' + SERIF,   web: 'Kiwi Maru',   weights: [400, 500] },

    /* かわいい・ポップ */
    { id: 'hachimaru',  group: 'かわいい・ポップ', label: 'Hachi Maru Pop（丸文字・Web）',     stack: '"Hachi Maru Pop",' + MARU, web: 'Hachi Maru Pop' },
    { id: 'mochiy',     group: 'かわいい・ポップ', label: 'Mochiy Pop One（太丸ポップ・Web）', stack: '"Mochiy Pop One",' + MARU, web: 'Mochiy Pop One' },
    { id: 'potta',      group: 'かわいい・ポップ', label: 'Potta One（太マーカー・Web）',      stack: '"Potta One",' + MARU,      web: 'Potta One' }
  ];

  var byId = {};
  LIST.forEach(function (f) { byId[f.id] = f; });

  /** フォントIDから CSS の font-family 文字列を得る */
  function stack(id) {
    return (byId[id] || LIST[0]).stack;
  }

  /** canvas の ctx.font 用の文字列を組み立てる */
  function cssFont(id, weight, sizePx) {
    return String(weight || 400) + ' ' + Math.max(1, sizePx) + 'px ' + stack(id);
  }

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

  /** 状態で使われている全フォントを読み込む */
  function ensureAll(specs) {
    return Promise.all(specs.map(function (s) { return ensureFont(s.font, s.weight); }))
      .then(function (r) { return r.some(Boolean); });
  }

  return { LIST: LIST, byId: byId, stack: stack, cssFont: cssFont,
           cssUrl: cssUrl, ensureFont: ensureFont, ensureAll: ensureAll };
})();
