/* ===========================================================
   画面の組み立てとイベント処理
   =========================================================== */
(function () {
  'use strict';

  /* ---------- 状態 ---------- */
  /* ドキュメント（ポップ集）と、選択中ポップへの参照。
     state を参照のまま残すことで、既存の編集パネル・イベント配線が
     そのまま「選択中のポップ」に効く。 */
  var doc = POPDoc.sampleDoc();
  var state = POPDoc.activeCard(doc);
  var autosaveWarned = false;

  /* 画面まわりだけの状態（保存しない） */
  var activeTab = 'text';                 /* 編集パネル: 'text' | 'look' */
  var paneScroll = { text: 0, look: 0 };  /* タブごとのスクロール位置 */

  function cardSizeMm() { return POPPresets.cardSize(doc.card); }

  /** カードごとの画像アセット（今読み込めているぶんだけ） */
  function assetsByCard() { return POPImageTool.assetsForCards(doc.cards); }

  function selectCard(index) {
    doc.activeIndex = Math.max(0, Math.min(index, doc.cards.length - 1));
    state = POPDoc.activeCard(doc);
    refreshAll(true, true);
  }

  /* 棚の「保存済みデザイン」を選択中ポップへ当てる。
     写すのは見た目だけ（テンプレート・色・フォント・枠線・配置）で、
     商品名・価格・説明・画像には触らない。文字を入れたまま見た目だけ
     着せ替えるのが、この道具のいちばん多い使い方のため。
     @param {Object} cardState 保存された1枚ぶんの状態
     @param {Object} [presetCard] 保存時のポップの大きさ（あれば先に合わせる） */
  function applyCardState(cardState, presetCard) {
    if (!cardState) return;

    /* 大きさが分かるなら先に合わせる。デザインの pt はその大きさで
       作られているので、順序を逆にすると文字だけ二重に比例してしまう。 */
    if (presetCard) {
      var nextCard = POPDoc.mergeDeep(POPPresets.defaultCard(),
                                      JSON.parse(JSON.stringify(presetCard)));
      if (nextCard.id !== doc.card.id ||
          Number(nextCard.customW) !== Number(doc.card.customW) ||
          Number(nextCard.customH) !== Number(doc.card.customH)) {
        doc.card = nextCard;
        applyCardSizeChange();
      }
    }

    var src = cardState;
    /* 改修前に保存されたデザインは用紙(paper)を持ち、その用紙前提の pt で
       保存されている。そのまま 44×67mm のポップへ乗せると文字が巨大になり
       自動縮小で潰れるため、保存当時の寸法から現在の大きさへ比例させる。
       paper を持たない＝改修後に保存されたものは、既にポップ基準なので触らない。 */
    if (cardState.paper) {
      src = POPDoc.mergeDeep(POPPresets.defaultCardState(),
                             JSON.parse(JSON.stringify(cardState)));
      var legacyPaper = src.paper;
      delete src.paper;
      var from = POPPresets.paperSize({ paper: legacyPaper });
      var size = cardSizeMm();
      POPPresets.scaleCard(src, POPPresets.scaleFor(from.w, from.h, size.w, size.h), size);
    }

    POPDoc.applyDesignTo(state, src);
    POPImageTool.clamp();
    refreshAll(true);
  }

  /* 画面全体を現在の doc に合わせ直す。
     forceSync は「編集中の入力欄も書き換える」指定。選択中のポップが
     入れ替わったときだけ使う（下の syncUI の注記を参照）。 */
  function refreshAll(immediate, forceSync) {
    syncUI(forceSync);
    requestRender();
    if (immediate) POPCardsUI.refreshNow();
    else POPCardsUI.refresh();
  }

  var canvas = document.getElementById('canvas');
  var ctx = canvas.getContext('2d');
  var stage = document.getElementById('preview-stage');
  var metaEl = document.getElementById('preview-meta');
  var summaryEl = document.getElementById('print-summary');
  var statusEl = document.getElementById('status');
  var saveStateEl = document.getElementById('save-state');

  /* ---------- オブジェクトのパス操作 ---------- */
  function getPath(obj, path) {
    var keys = path.split('.');
    var cur = obj;
    for (var i = 0; i < keys.length; i++) {
      if (cur === null || cur === undefined) return undefined;
      cur = cur[keys[i]];
    }
    return cur;
  }

  function setPath(obj, path, value) {
    var keys = path.split('.');
    var cur = obj;
    for (var i = 0; i < keys.length - 1; i++) {
      if (typeof cur[keys[i]] !== 'object' || cur[keys[i]] === null) cur[keys[i]] = {};
      cur = cur[keys[i]];
    }
    cur[keys[keys.length - 1]] = value;
  }

  /* ---------- 入力欄 ⇔ 状態 ---------- */
  function parseValue(el) {
    if (el.type === 'checkbox') return el.checked;
    if (el.type === 'range' || el.type === 'number') {
      /* 空欄・不正はそのフィールドの min（無ければ0）へ。size=0 で文字が潰れるのを防ぐ。
         min/max があれば範囲内へクランプする。 */
      var min = el.min !== '' ? Number(el.min) : null;
      var max = el.max !== '' ? Number(el.max) : null;
      if (el.value === '' || isNaN(Number(el.value))) {
        return (min !== null && !isNaN(min)) ? min : 0;
      }
      var n = Number(el.value);
      if (min !== null && !isNaN(min) && n < min) n = min;
      if (max !== null && !isNaN(max) && n > max) n = max;
      return n;
    }
    if (el.tagName === 'SELECT' && /^(400|700|900)$/.test(el.value)) return Number(el.value);
    return el.value;
  }

  /* 入力欄へ状態を書き戻す。
     打っている最中の欄は上書きしない（変換中の文字やカーソル位置が飛ぶため）。
     ただし選択中のポップが入れ替わったときは話が別で、そこを飛ばすと
     「一覧では2枚目を選んでいるのに商品名欄は1枚目のまま」という食い違いが
     残る。切替時は force を立てて必ず書き戻す。 */
  function syncUI(force) {
    var inputs = document.querySelectorAll('[data-path]');
    for (var i = 0; i < inputs.length; i++) {
      var el = inputs[i];
      if (!force && el === document.activeElement &&
          (el.type === 'text' || el.type === 'number' || el.tagName === 'TEXTAREA')) continue;
      var v = getPath(state, el.getAttribute('data-path'));
      if (el.type === 'checkbox') el.checked = !!v;
      else el.value = (v === undefined || v === null) ? '' : v;
    }

    var outs = document.querySelectorAll('[data-out]');
    for (var j = 0; j < outs.length; j++) {
      var val = getPath(state, outs[j].getAttribute('data-out'));
      outs[j].textContent = (typeof val === 'number') ? String(Math.round(val * 100) / 100) : String(val || '');
    }

    /* ポップ/紙の設定は doc 側にあるので data-doc-path で別に同期する */
    var docInputs = document.querySelectorAll('[data-doc-path]');
    for (var d = 0; d < docInputs.length; d++) {
      var de = docInputs[d];
      if (!force && de === document.activeElement &&
          (de.type === 'text' || de.type === 'number')) continue;
      var dv = getPath(doc, de.getAttribute('data-doc-path'));
      if (de.type === 'checkbox') de.checked = !!dv;
      else de.value = (dv === undefined || dv === null) ? '' : dv;
    }

    var cardCustom = document.getElementById('card-custom-size');
    if (cardCustom) cardCustom.hidden = doc.card.id !== 'custom';
    var sheetCustom = document.getElementById('custom-size');
    if (sheetCustom) sheetCustom.hidden = doc.sheet.id !== 'custom';

    var imgCtl = document.getElementById('image-controls');
    if (imgCtl) imgCtl.hidden = !(state.image && state.image.src);

    /* 使うときだけ出す欄。常に出しておくと「入れる必要があるのか」を
       毎回考えさせることになるため、チェックが入るまで隠す。 */
    var strike = document.getElementById('price-strike-value');
    if (strike) strike.hidden = !(state.price && state.price.strike && state.price.strike.enabled);
    var badgeFields = document.getElementById('badge-fields');
    if (badgeFields) badgeFields.hidden = !(state.badge && state.badge.enabled);

    /* 価格入力の前後に出る記号は「細かい表記」の設定の見本 */
    var prefixView = document.getElementById('price-prefix-view');
    if (prefixView) prefixView.textContent = (state.price && state.price.prefix) || '';
    var suffixView = document.getElementById('price-suffix-view');
    if (suffixView) suffixView.textContent = (state.price && state.price.suffix) || '';

    var tpl = document.querySelectorAll('[data-template]');
    for (var t = 0; t < tpl.length; t++) {
      tpl[t].classList.toggle('is-active', tpl[t].getAttribute('data-template') === state.template);
    }
  }

  /* ---------- 描画 ---------- */
  /* カードサイズの変更前の値。比例スケールの係数を出すために保持する。 */
  var lastCardSize = null;

  /* プレビューの表示モードとページ */
  var previewMode = 'card';   /* 'card' | 'sheet' */
  var pageIndex = 0;

  var rafId = null;
  var ensured = {};

  function requestRender() {
    if (rafId) return;
    rafId = requestAnimationFrame(function () {
      rafId = null;
      render();
    });
  }

  function render() {
    var size = previewMode === 'sheet' ? POPPresets.sheetSize(doc.sheet) : cardSizeMm();
    var stageW = Math.max(120, stage.clientWidth - 44);
    var stageH = Math.max(220, stage.clientHeight - 44);
    var dispW = Math.min(stageW, stageH * (size.w / size.h));
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

    scheduleSave();
  }

  /* 画像が未ロードなら読み込んでから描き直す。
     ポップ表示は選択中のポップだけ、紙の表示は「そのページに載る全ポップ」を対象にする。
     紙の表示で選択中しか見ないと、一度も選択していないポップの画像が
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
      if (!src || POPImageTool.isSettled(src)) return;
      POPImageTool.ensure(src, function () { refreshAll(); });
    });
  }

  function clampPageIndex() {
    var pages = POPSheetView.pagesOf(doc);
    pageIndex = Math.max(0, Math.min(pageIndex, Math.max(0, pages - 1)));
  }

  /** 用紙の短い呼び名（「A4 縦」）。説明文が長くなりすぎないように寸法は外す。 */
  function paperName() {
    var p = POPPresets.papersById[doc.sheet.id] || POPPresets.papersById.a4;
    var base = String(p.label).split('（')[0];
    return base + (doc.sheet.orientation === 'landscape' ? ' 横' : ' 縦');
  }

  /* メタ表示・面付けの要約・警告・ページ送り・読み上げ用ラベルをまとめて更新する */
  function updateMeta(result) {
    var card = cardSizeMm();
    var sheet = POPPresets.sheetSize(doc.sheet);
    var L = POPSheetView.layoutOf(doc);
    var pages = POPSheetView.pagesOf(doc);

    metaEl.textContent = 'ポップ ' + card.w + '×' + card.h + 'mm ／ 紙 ' + paperName() +
      '（' + sheet.w + '×' + sheet.h + 'mm）';

    /* 「何枚が何ページに刷られるか」は印刷前にいちばん知りたいことなので、
       プレビューの下に常に出しておく。 */
    summaryEl.textContent = L.perPage > 0
      ? paperName() + ' 1枚に' + L.perPage + '枚ぶん並びます' +
        (L.rotate ? '（90°回転）' : '') +
        '（' + doc.cards.length + '枚を印刷 → ' + pages + 'ページ）'
      : 'ポップが紙に入りません';

    var pager = document.getElementById('preview-pager');
    pager.hidden = !(previewMode === 'sheet' && pages > 1);
    document.getElementById('page-label').textContent = (pageIndex + 1) + ' / ' + Math.max(1, pages);
    document.getElementById('btn-page-prev').disabled = pageIndex <= 0;
    document.getElementById('btn-page-next').disabled = pageIndex >= pages - 1;

    canvas.setAttribute('aria-label', previewMode === 'sheet'
      ? '印刷される紙のプレビュー：' + doc.cards.length + '枚のポップを' + pages + 'ページに面付け'
      : '商品ポップのプレビュー：商品名「' +
        (String(state.name.text || '').trim() || '未入力') +
        '」／価格 ' + (String(state.price.value || '').trim() || '未入力'));

    /* 警告は「配置できない」→「余白0mm」の順に強い方を出す */
    if (L.perPage === 0) {
      setStatus('ポップが紙より大きいため配置できません。ポップを小さくするか紙を大きくしてください');
    } else if (Number(doc.sheet.margin) === 0) {
      setStatus('余白0mmです。フチなし印刷に対応したプリンタ以外では端のポップが欠けます');
    } else if (previewMode === 'card' && result.overflow) {
      setStatus('内容がポップに収まりきりません。文字サイズを下げてください');
    } else if (previewMode === 'card' && result.fontScale < 0.999) {
      setStatus('自動縮小中（' + Math.round(result.fontScale * 100) + '%）');
    } else if (!statusSticky) {
      setStatus('');
    }

    /* 印刷できるかどうかで「印刷する」（2か所）と手順3の見え方を切り替える */
    var printable = L.perPage > 0;
    var printButtons = document.querySelectorAll('[data-print]');
    for (var i = 0; i < printButtons.length; i++) printButtons[i].disabled = !printable;
    var step3 = document.getElementById('step-print');
    if (step3) step3.classList.toggle('is-current', printable);
  }

  /* 使用中のWebフォントが未読み込みなら読み込んでから描き直す。
     紙の表示ではそのページに載る全ポップぶんを集める。選択中だけ見ると、
     一度も選んでいないポップが代替書体のまま描かれ、プレビューと印刷結果が食い違うため。 */
  function ensureFontsThenRerender() {
    var specs = [];
    if (previewMode === 'sheet') {
      POPSheetView.cardIndexesOnPage(doc, pageIndex).forEach(function (i) {
        POPRenderer.usedFonts(doc.cards[i]).forEach(function (s) { specs.push(s); });
      });
    } else {
      specs = POPRenderer.usedFonts(state);
    }
    var pending = specs.filter(function (s) {
      var f = POPFonts.byId[s.font];
      if (!f || !f.web) return false;
      return !ensured[s.font + '|' + s.weight];
    });
    if (!pending.length) return;
    pending.forEach(function (s) { ensured[s.font + '|' + s.weight] = true; });
    POPFonts.ensureAll(pending).then(function () { refreshAll(); });
  }

  /* 自動保存の予約。ポップが増えると doc の JSON 化が重くなるため、
     毎フレーム保存せず 500ms にまとめる。 */
  var saveTimer = null;

  function setSaveState(text, warn) {
    if (!saveStateEl) return;
    saveStateEl.textContent = text;
    saveStateEl.classList.toggle('is-warn', !!warn);
  }

  function scheduleSave() {
    if (saveTimer) return;
    saveTimer = setTimeout(function () {
      saveTimer = null;
      var saved = POPStorage.saveAuto(doc);
      if (saved) { setSaveState('自動保存済み'); return; }
      setSaveState('自動保存できません', true);
      if (!autosaveWarned) {
        autosaveWarned = true;
        var imgCount = doc.cards.filter(function (c) { return c.image && c.image.src; }).length;
        setStatus('ポップ' + doc.cards.length + '枚・画像' + imgCount +
                  '点のため自動保存できません。「その他」の「データを書き出す」で保存できます', true);
      }
    }, 500);
  }

  var statusTimer = null;
  var statusSticky = false;   /* 一時メッセージの表示中。描画のたびに消さないための印 */

  function setStatus(msg, temporary) {
    statusEl.textContent = msg;
    if (statusTimer) { clearTimeout(statusTimer); statusTimer = null; }
    statusSticky = !!(msg && temporary);
    if (statusSticky) {
      statusTimer = setTimeout(function () {
        statusTimer = null;
        statusSticky = false;
        statusEl.textContent = '';
      }, 2500);
    }
  }

  /* ---------- テンプレート適用 ----------
     テンプレの数値は A4(210×297) 前提。ポップの大きさへ焼き込んでから重ねる。 */
  function applyTemplate(id) {
    var t = POPPresets.templatesById[id];
    if (!t) return;
    var size = cardSizeMm();
    var patch = JSON.parse(JSON.stringify(t.apply));
    POPPresets.scaleCard(patch, POPPresets.scaleFor(210, 297, size.w, size.h), size);
    state.template = id;
    POPDoc.mergeDeep(state, patch);
    refreshAll(true);
  }

  /* カードの大きさが変わったら、全カードの文字・余白を比例させる。
     基準サイズからの目標倍率で管理し、適用済みとの差分だけを掛けるので、
     大きさを行き来しても文字は元に戻る（縮みっぱなしにならない）。
     縦横が入れ替わっただけのときは scaleFor が 1 を返すので縮まない（設計 §4.1）。 */
  function applyCardSizeChange() {
    var next = cardSizeMm();
    if (!lastCardSize) { lastCardSize = next; return; }
    if (next.w === lastCardSize.w && next.h === lastCardSize.h) return;

    if (document.getElementById('scale-with-card').checked) {
      var step = POPPresets.scaleStep(doc.scale, next.w, next.h);
      if (Math.abs(step.delta - 1) > 1e-9) {
        doc.cards.forEach(function (c) { POPPresets.scaleCard(c, step.delta, next); });
        setStatus('ポップの大きさに合わせて文字と余白を調整しました', true);
      }
      doc.scale.applied = step.target;
    } else {
      /* 比例させない指定のときは doc.scale を書き換えない。
         値を変えていないのに基準だけ置き直すと、チェックを戻して元のサイズへ
         戻したときに倍率が 1 にならず、文字が元より大きくなってしまうため
         （実測: 44×67 → OFFで30×50 → ONで44×67 に戻すと 64pt が 85.8pt になった）。
         基準は最後に比例させた時点のものを持ち越す。 */
      doc.cards.forEach(function (c) { POPPresets.clampImage(c.image, next); });
    }
    lastCardSize = next;
  }

  /* ---------- 編集パネルのタブ ----------
     切り替えでスクロール位置を失うと、長い「デザインを作る」タブを
     行き来するたびに探し直しになるので、タブごとに位置を覚えておく。 */
  function selectPane(key, focus) {
    if (key !== 'text' && key !== 'look') return;
    var cur = document.getElementById('pane-' + activeTab);
    if (cur) paneScroll[activeTab] = cur.scrollTop;
    activeTab = key;

    var tabs = document.querySelectorAll('.paneltab');
    for (var i = 0; i < tabs.length; i++) {
      var on = tabs[i].getAttribute('data-paneltab') === key;
      tabs[i].classList.toggle('is-active', on);
      tabs[i].setAttribute('aria-selected', on ? 'true' : 'false');
      tabs[i].tabIndex = on ? 0 : -1;
      if (on && focus) tabs[i].focus();
    }

    var panes = document.querySelectorAll('.pane');
    for (var j = 0; j < panes.length; j++) {
      var on2 = panes[j].getAttribute('data-pane') === key;
      panes[j].hidden = !on2;
      panes[j].classList.toggle('is-active', on2);
    }

    var next = document.getElementById('pane-' + key);
    if (next) next.scrollTop = paneScroll[key] || 0;
  }

  /** 「文字を入れる」タブを開いて商品名にカーソルを置く（追加・複製の直後に使う） */
  function focusNameInput() {
    selectPane('text');
    var el = document.querySelector('[data-path="name.text"]');
    if (!el) return;
    el.focus();
    if (el.setSelectionRange) {
      var n = String(el.value || '').length;
      try { el.setSelectionRange(n, n); } catch (e) { /* 型によっては使えない */ }
    }
  }

  /** プレビューの表示を切り替える（ボタンからも印刷の直前からも呼ぶ） */
  function switchPreview(mode) {
    if (mode !== 'card' && mode !== 'sheet') return;
    previewMode = mode;
    var tabs = document.querySelectorAll('.viewtoggle__btn');
    for (var i = 0; i < tabs.length; i++) {
      var on = tabs[i].getAttribute('data-preview') === mode;
      tabs[i].classList.toggle('is-active', on);
      tabs[i].setAttribute('aria-selected', on ? 'true' : 'false');
    }
    /* 紙の表示中は画像の操作を止める */
    POPImageTool.setEnabled(mode === 'card');
    requestRender();
  }

  /* ---------- イベント ---------- */
  function bindEvents() {
    /* 入力欄 → 状態 */
    document.addEventListener('input', onFieldChange);
    document.addEventListener('change', onFieldChange);

    function onFieldChange(ev) {
      var el = ev.target;
      if (!el || !el.getAttribute) return;

      var docPath = el.getAttribute('data-doc-path');
      if (docPath) {
        /* 数値入力は「入力中」に丸めも比例スケールも走らせない。
           「150」と打つ途中の「1」が最小値へ丸められ、その値を基準に
           ポップが切り詰められて全ポップの文字が縮み、続けて打っても
           scaleFor が 1 を返すため元に戻らなくなるため
           （利用者の「文字を勝手に縮めるな」に反する）。
           確定（change）を待って、そこで一度だけ整える。 */
        if (ev.type === 'input' && (el.type === 'number' || el.type === 'range')) {
          if (el.value === '') return;              /* 空欄は未確定として無視する */
          setPath(doc, docPath, parseValue(el));
          refreshAll();
          return;
        }
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

    /* ポップ/紙の設定が変わったときの後処理 */
    function onDocChange(docPath) {
      doc.sheet.margin = Math.max(0, Math.min(30, Number(doc.sheet.margin) || 0));
      doc.sheet.gap = Math.max(0, Math.min(20, Number(doc.sheet.gap) || 0));

      /* 丸めるのはポップの mm 欄を直接いじったときだけ。
         用紙や余白を変えたときにポップの寸法まで黙って書き換えると、
         利用者が指定した大きさが失われる（設計 §4「カードサイズを黙って
         書き換えるのはカスタム入力時のみ」）。入らない場合は updateMeta が
         「ポップが紙より大きいため配置できません」と警告する。 */
      if ((docPath === 'card.customW' || docPath === 'card.customH') && doc.card.id === 'custom') {
        var c = POPPresets.clampCustomCard(doc.card, doc.sheet);
        doc.card.customW = c.customW;
        doc.card.customH = c.customH;
      }
      applyCardSizeChange();
      refreshAll(true);
    }

    /* 編集パネルのタブ（クリック＋キーボード：←→ Home End） */
    var paneTabs = document.querySelector('.paneltabs');
    paneTabs.addEventListener('click', function (ev) {
      var btn = ev.target.closest('[data-paneltab]');
      if (btn) selectPane(btn.getAttribute('data-paneltab'), false);
    });
    paneTabs.addEventListener('keydown', function (ev) {
      if (ev.key !== 'ArrowLeft' && ev.key !== 'ArrowRight' && ev.key !== 'Home' && ev.key !== 'End') return;
      ev.preventDefault();
      selectPane(ev.key === 'ArrowLeft' || ev.key === 'End'
        ? (activeTab === 'look' ? 'text' : 'look')
        : (activeTab === 'text' ? 'look' : 'text'), true);
    });

    /* 文字設定の対象切替（クリック＋キーボード：←→ Home End） */
    var tablist = document.getElementById('text-tabs');
    tablist.addEventListener('click', function (ev) {
      var btn = ev.target.closest('[data-tab]');
      if (btn) POPPanelsUI.selectTab(btn.getAttribute('data-tab'), false);
    });
    tablist.addEventListener('keydown', function (ev) {
      if (ev.key !== 'ArrowLeft' && ev.key !== 'ArrowRight' && ev.key !== 'Home' && ev.key !== 'End') return;
      var tabs = tablist.querySelectorAll('.seg__btn');
      var n = tabs.length, cur = 0;
      for (var i = 0; i < n; i++) { if (tabs[i].getAttribute('aria-selected') === 'true') { cur = i; break; } }
      var next = cur;
      if (ev.key === 'ArrowLeft') next = (cur - 1 + n) % n;
      else if (ev.key === 'ArrowRight') next = (cur + 1) % n;
      else if (ev.key === 'Home') next = 0;
      else if (ev.key === 'End') next = n - 1;
      ev.preventDefault();
      POPPanelsUI.selectTab(tabs[next].getAttribute('data-tab'), true);
    });

    /* 「その他」バーの開閉 */
    var moreBtn = document.getElementById('btn-more');
    moreBtn.addEventListener('click', function () {
      var bar = document.getElementById('more-bar');
      var open = bar.hidden;
      bar.hidden = !open;
      moreBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
      moreBtn.textContent = open ? 'その他 ▴' : 'その他 ▾';
    });

    /* テンプレート */
    document.getElementById('template-list').addEventListener('click', function (ev) {
      var btn = ev.target.closest('[data-template]');
      if (btn) applyTemplate(btn.getAttribute('data-template'));
    });

    document.getElementById('btn-apply-design').addEventListener('click', function () {
      var n = doc.cards.length - 1;
      if (n <= 0) { setStatus('ポップが1枚のため適用先がありません', true); return; }
      if (!window.confirm(n + '枚のポップの見た目を上書きします。よろしいですか？\n' +
                          '（商品名・価格・説明・画像は変わりません）')) return;
      var applied = POPDoc.applyDesignToAll(doc, doc.activeIndex);
      refreshAll(true);
      setStatus(applied + '枚のポップに見た目を適用しました', true);
    });

    /* 「複製して続ける」＝文字を残したまま次のポップへ */
    document.getElementById('btn-dup-continue').addEventListener('click', function () {
      if (POPDoc.duplicateCard(doc, doc.activeIndex) < 0) {
        setStatus('ポップは' + POPDoc.MAX_CARDS + '枚までです', true);
        return;
      }
      state = POPDoc.activeCard(doc);
      refreshAll(true, true);
      focusNameInput();
      setStatus('複製しました。商品名を書き換えてください', true);
    });

    /* フォントの一括適用・全体サイズ調整 */
    document.addEventListener('click', function (ev) {
      var el = ev.target.closest ? ev.target.closest('[data-apply-font],[data-scale-all]') : null;
      if (!el) return;

      if (el.hasAttribute('data-apply-font')) {
        var src = el.getAttribute('data-apply-font');
        var font = state[src].font;
        POPPanelsUI.TEXT_FIELDS.forEach(function (f) { state[f.key].font = font; });
        setStatus('フォントをすべての項目に適用しました', true);
      } else {
        var k = Number(el.getAttribute('data-scale-all'));
        POPPanelsUI.TEXT_FIELDS.forEach(function (f) {
          var v = Math.round(state[f.key].size * k);
          state[f.key].size = Math.min(f.max, Math.max(f.min, v));
        });
        state.badge.size = Math.min(80, Math.max(8, Math.round(state.badge.size * k)));
      }
      syncUI();
      requestRender();
    });

    /* 画像：追加・削除・ファイル選択 */
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

    document.getElementById('btn-save-json').addEventListener('click', function () {
      POPStorage.exportJson(doc, POPExport.safeFileName() + '.json');
      setStatus('データを書き出しました', true);
    });

    document.getElementById('btn-load-json').addEventListener('click', function () {
      document.getElementById('file-json').click();
    });

    document.getElementById('file-json').addEventListener('change', function (ev) {
      var file = ev.target.files && ev.target.files[0];
      if (!file) return;
      POPStorage.readJsonFile(file).then(function (data) {
        var loaded = POPDoc.migrate(data);
        if (!loaded) { setStatus('読み込めるデータではありません', true); return; }
        doc = loaded;
        state = POPDoc.activeCard(doc);
        lastCardSize = cardSizeMm();
        autosaveWarned = false;
        refreshAll(true, true);
        setStatus('データを読み込みました', true);
      }).catch(function (e) {
        setStatus(e.message, true);
      });
      ev.target.value = '';
    });

    document.getElementById('btn-reset').addEventListener('click', function () {
      if (!confirm('入力内容をすべて初期状態に戻します。よろしいですか？')) return;
      doc = POPDoc.defaultDoc();
      state = POPDoc.activeCard(doc);
      lastCardSize = cardSizeMm();
      POPStorage.clearAuto();
      autosaveWarned = false;
      refreshAll(true, true);
      setStatus('リセットしました', true);
    });

    /* リサイズで再描画 */
    var resizeTimer = null;
    window.addEventListener('resize', function () {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(requestRender, 120);
    });

    /* プレビュー面の大きさは窓の大きさ以外でも変わる（「その他」バーの開閉、
       棚の増減、確認バーの折り返しなど）。window の resize だけを見ていると
       そのとき描いたままの canvas がはみ出して切れるので、面そのものを監視する。
       監視対象は canvas を含む stage ではなく親の .preview にする。stage を見ると
       スクロールバーの出入りで幅が揺れ、描き直しが止まらなくなるため。 */
    if (window.ResizeObserver) {
      var lastBox = { w: 0, h: 0 };
      var ro = new ResizeObserver(function (entries) {
        var r = entries[0].contentRect;
        var w = Math.round(r.width), h = Math.round(r.height);
        if (Math.abs(w - lastBox.w) < 2 && Math.abs(h - lastBox.h) < 2) return;
        lastBox.w = w; lastBox.h = h;
        requestRender();
      });
      ro.observe(document.querySelector('.preview'));
    }

    /* プレビューの表示切替（ポップ1枚／印刷される紙） */
    document.querySelector('.viewtoggle').addEventListener('click', function (ev) {
      var btn = ev.target.closest ? ev.target.closest('[data-preview]') : null;
      if (btn) switchPreview(btn.getAttribute('data-preview'));
    });

    document.getElementById('btn-page-prev').addEventListener('click', function () {
      pageIndex = Math.max(0, pageIndex - 1);
      requestRender();
    });
    document.getElementById('btn-page-next').addEventListener('click', function () {
      pageIndex = Math.min(POPSheetView.pagesOf(doc) - 1, pageIndex + 1);
      requestRender();
    });

    /* 紙の表示でポップをクリックすると、そのポップを選択する */
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

    /* Webフォント読み込み完了で描き直す */
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () { refreshAll(); });
    }

    /* タブを裏に回すと requestAnimationFrame が止まり、保存の予約も走らない。
       そのまま閉じると直前の編集が失われるので、隠れる/離脱する時点で即保存する。
       beforeunload はモバイルで発火しないことがあるため pagehide を使う。 */
    function flushSave() {
      if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
      POPStorage.saveAuto(doc);
    }
    window.addEventListener('pagehide', flushSave);
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'hidden') flushSave();
    });
  }

  /* ---------- 起動 ---------- */
  function init() {
    POPPanelsUI.build();

    /* ①新形式 → ②旧形式（単品）を移行 → ③サンプル の順に復元する */
    var restored = POPDoc.migrate(POPStorage.loadAuto());
    if (!restored) restored = POPDoc.migrate(POPStorage.loadLegacyAuto());
    doc = restored || POPDoc.sampleDoc();
    state = POPDoc.activeCard(doc);
    lastCardSize = cardSizeMm();

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
      getCardPreset: function () { return JSON.parse(JSON.stringify(doc.card)); },
      applyCard: applyCardState,
      setStatus: setStatus
    });

    POPExport.init({
      getDoc: function () { return doc; },
      getCard: function () { return state; },
      getCardSize: cardSizeMm,
      getPageIndex: function () { return pageIndex; },
      setStatus: setStatus,
      onBeforePrint: function () { switchPreview('sheet'); }
    });

    POPCardsUI.init({
      root: document.getElementById('card-list'),
      getDoc: function () { return doc; },
      getAssets: assetsByCard,
      onSelect: selectCard,
      onAdd: function () {
        var size = cardSizeMm();
        var c = POPPresets.defaultCardState();
        /* defaultCardState は A4 前提の pt を持つのでポップの大きさへ合わせる */
        POPPresets.scaleCard(c, POPPresets.scaleFor(210, 297, size.w, size.h), size);
        if (POPDoc.addCard(doc, c) < 0) {
          setStatus('ポップは' + POPDoc.MAX_CARDS + '枚までです', true);
          return;
        }
        state = POPDoc.activeCard(doc);
        refreshAll(true, true);
        focusNameInput();
        setStatus('ポップを追加しました', true);
      },
      onDuplicate: function () {
        if (POPDoc.duplicateCard(doc, doc.activeIndex) < 0) {
          setStatus('ポップは' + POPDoc.MAX_CARDS + '枚までです', true);
          return;
        }
        state = POPDoc.activeCard(doc);
        refreshAll(true, true);
        setStatus('ポップを複製しました', true);
      },
      onRemove: function () {
        if (!POPDoc.removeCard(doc, doc.activeIndex)) {
          setStatus('最後の1枚は削除できません', true);
          return;
        }
        state = POPDoc.activeCard(doc);
        refreshAll(true, true);
        setStatus('ポップを削除しました', true);
      },
      onMove: function (from, to) {
        POPDoc.moveCard(doc, from, to);
        state = POPDoc.activeCard(doc);
        refreshAll(true, true);
      }
    });

    bindEvents();
    selectPane('text');
    syncUI();
    requestRender();

    if (!POPStorage.available) {
      setSaveState('自動保存が使えません', true);
      setStatus('このブラウザでは自動保存が使えません（プライベートモードの可能性）');
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
