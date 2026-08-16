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

  var LIST = [
    { id: 'sans',       label: 'ゴシック体（標準）',        stack: SANS,  web: null },
    { id: 'serif',      label: '明朝体',                    stack: SERIF, web: null },
    { id: 'maru',       label: '丸ゴシック体',              stack: MARU,  web: null },
    { id: 'notosans',   label: 'Noto Sans JP（Web）',       stack: '"Noto Sans JP",' + SANS,        web: 'Noto Sans JP' },
    { id: 'notoserif',  label: 'Noto Serif JP（Web）',      stack: '"Noto Serif JP",' + SERIF,      web: 'Noto Serif JP' },
    { id: 'rounded',    label: 'M PLUS Rounded 1c（丸・Web）', stack: '"M PLUS Rounded 1c",' + MARU, web: 'M PLUS Rounded 1c' },
    { id: 'kosugimaru', label: '小杉丸ゴシック（Web）',     stack: '"Kosugi Maru",' + MARU,         web: 'Kosugi Maru' },
    { id: 'dela',       label: 'Dela Gothic One（極太・Web）', stack: '"Dela Gothic One",' + SANS,  web: 'Dela Gothic One' },
    { id: 'rocknroll',  label: 'RocknRoll One（ポップ・Web）', stack: '"RocknRoll One",' + MARU,    web: 'RocknRoll One' },
    { id: 'yusei',      label: 'Yusei Magic（手書き風・Web）', stack: '"Yusei Magic",' + SANS,      web: 'Yusei Magic' },
    { id: 'kaisei',     label: 'Kaisei Decol（やわらか明朝・Web）', stack: '"Kaisei Decol",' + SERIF, web: 'Kaisei Decol' },
    { id: 'stick',      label: 'Stick（角ゴ細・Web）',      stack: '"Stick",' + SANS,               web: 'Stick' }
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

  /**
   * 指定フォント（Webフォント）が canvas で使えるよう読み込む。
   * すでに読み込み済みなら即 resolve。失敗しても resolve（fallback表示になる）。
   */
  function ensureFont(id, weight) {
    var f = byId[id];
    if (!f || !f.web || !document.fonts || !document.fonts.load) return Promise.resolve(false);
    var spec = String(weight || 400) + ' 32px "' + f.web + '"';
    return document.fonts.load(spec, 'あア亜0Aa')
      .then(function (list) { return list && list.length > 0; })
      .catch(function () { return false; });
  }

  /** 状態で使われている全フォントを読み込む */
  function ensureAll(specs) {
    return Promise.all(specs.map(function (s) { return ensureFont(s.font, s.weight); }))
      .then(function (r) { return r.some(Boolean); });
  }

  return { LIST: LIST, byId: byId, stack: stack, cssFont: cssFont, ensureFont: ensureFont, ensureAll: ensureAll };
})();
