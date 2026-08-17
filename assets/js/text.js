/* ===========================================================
   日本語テキストの折り返し（禁則処理つき）
   canvas には自動改行が無いため自前で実装する。
   - 日本語は1文字ずつ、英数字は単語単位で折り返す
   - 行頭禁則（、。」など）／行末禁則（「（など）を考慮する
   =========================================================== */
var POPText = (function () {
  'use strict';

  /* 行頭に来てはいけない文字 */
  var NO_LINE_START = '、。，．・：；？！?!ー〜～’”）〕］｝〉》」』】]})）,.:;％%‰℃ゝゞ々ぁぃぅぇぉっゃゅょゎァィゥェォッャュョヮヵヶ';
  /* 行末に来てはいけない文字 */
  var NO_LINE_END = '（〔［｛〈《「『【([{‘“¥＄＃￥$#';

  function isNoStart(ch) { return NO_LINE_START.indexOf(ch) >= 0; }
  function isNoEnd(ch) { return NO_LINE_END.indexOf(ch) >= 0; }

  /* 英数字・記号（単語としてまとめたい文字） */
  function isWordChar(ch) {
    return /[0-9A-Za-z_'\-+/&@.]/.test(ch);
  }

  /**
   * 1行分の文字列をトークン（分割の最小単位）に分ける。
   * 連続する英数字はひとかたまり、日本語は1文字ずつ。半角スペースは区切りとして保持。
   */
  function tokenize(line) {
    var tokens = [];
    var buf = '';
    for (var i = 0; i < line.length; i++) {
      var ch = line[i];
      if (isWordChar(ch)) {
        buf += ch;
      } else {
        if (buf) { tokens.push(buf); buf = ''; }
        tokens.push(ch);
      }
    }
    if (buf) tokens.push(buf);
    return tokens;
  }

  /* 文字列をコードポイント単位（サロゲートペア対応）で maxWidth に収まる
     チャンク列へ強制分割する最終手段。禁則は考慮しない。 */
  function hardSplit(ctx, s, maxWidth) {
    var chars = Array.from(s);
    var chunks = [];
    var cur = '';
    for (var i = 0; i < chars.length; i++) {
      if (cur !== '' && ctx.measureText(cur + chars[i]).width > maxWidth) {
        chunks.push(cur);
        cur = chars[i];
      } else {
        cur += chars[i];
      }
    }
    if (cur !== '') chunks.push(cur);
    return chunks.length ? chunks : [s];
  }

  /* 確定行を push。幅超過なら hardSplit してから push（行頭・行末どちらの
     長い連続文字列でも用紙外にはみ出さない）。 */
  function pushLine(out, ctx, s, maxWidth) {
    if (s === '' || maxWidth <= 0 || ctx.measureText(s).width <= maxWidth) {
      out.push(s);
      return;
    }
    var chunks = hardSplit(ctx, s, maxWidth);
    for (var i = 0; i < chunks.length; i++) out.push(chunks[i]);
  }

  /**
   * テキストを maxWidth に収まるように折り返す。
   * @param {CanvasRenderingContext2D} ctx  fontを設定済みのコンテキスト
   * @param {string} text  改行(\n)を含んでよい
   * @param {number} maxWidth  px
   * @returns {string[]} 行の配列
   */
  function wrap(ctx, text, maxWidth) {
    var out = [];
    if (text === null || text === undefined) return out;
    var paragraphs = String(text).replace(/\r\n?/g, '\n').split('\n');

    paragraphs.forEach(function (para) {
      if (para === '') { out.push(''); return; }
      if (maxWidth <= 0) { out.push(para); return; }

      var tokens = tokenize(para);
      var line = '';

      for (var i = 0; i < tokens.length; i++) {
        var t = tokens[i];

        if (line === '' || ctx.measureText(line + t).width <= maxWidth) {
          line += t;
          continue;
        }

        /* ここで改行が必要 */
        var head = line;
        var moved = '';

        /* 行末禁則：行末の「(」などは次の行へ送る */
        while (head.length > 1 && isNoEnd(head[head.length - 1])) {
          moved = head[head.length - 1] + moved;
          head = head.slice(0, -1);
        }

        /* 行頭禁則：次行の先頭が「、」などになるならぶら下げる */
        if (moved === '' && t.length === 1 && isNoStart(t)) {
          pushLine(out, ctx, head + t, maxWidth);
          line = '';
          continue;
        }

        pushLine(out, ctx, head, maxWidth);
        line = moved + t;

        /* 1トークンだけで幅を超える場合は強制的に分割し、最後のチャンクだけ
           次行として引き継ぐ（サロゲートペア対応の hardSplit を使用）。 */
        if (ctx.measureText(line).width > maxWidth && Array.from(line).length > 1) {
          var chunks = hardSplit(ctx, line, maxWidth);
          for (var c = 0; c < chunks.length - 1; c++) out.push(chunks[c]);
          line = chunks[chunks.length - 1];
        }
      }
      pushLine(out, ctx, line, maxWidth);
    });

    return out;
  }

  /** 行の中で最も長い幅を返す */
  function maxLineWidth(ctx, lines) {
    var w = 0;
    for (var i = 0; i < lines.length; i++) {
      var m = ctx.measureText(lines[i]).width;
      if (m > w) w = m;
    }
    return w;
  }

  /** 数値を3桁区切りにする。数値以外はそのまま返す */
  function formatNumber(value) {
    var s = String(value === null || value === undefined ? '' : value).trim();
    if (s === '') return '';
    /* すでに区切られている場合も一度外して整形しなおす */
    var plain = s.replace(/,/g, '');
    if (!/^\d+(\.\d+)?$/.test(plain)) return s;
    var parts = plain.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return parts.join('.');
  }

  return {
    wrap: wrap,
    maxLineWidth: maxLineWidth,
    formatNumber: formatNumber,
    isNoStart: isNoStart,
    isNoEnd: isNoEnd
  };
})();
