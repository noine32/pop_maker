/* ===========================================================
   保存まわり（localStorage / JSONファイル）
   =========================================================== */
var POPStorage = (function () {
  'use strict';

  var AUTO_KEY = 'popmaker.autosave.v1';
  var PRESET_KEY = 'popmaker.presets.v1';

  function available() {
    try {
      var k = '__popmaker_test__';
      localStorage.setItem(k, '1');
      localStorage.removeItem(k);
      return true;
    } catch (e) { return false; }
  }

  var ok = available();

  /** @returns {boolean} 保存できたら true（容量超過などで失敗すると false） */
  function saveAuto(state) {
    if (!ok) return false;
    try { localStorage.setItem(AUTO_KEY, JSON.stringify(state)); return true; }
    catch (e) { return false; /* 容量超過（大きな画像など）は握り潰す */ }
  }

  function loadAuto() {
    if (!ok) return null;
    try {
      var raw = localStorage.getItem(AUTO_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  function clearAuto() {
    if (!ok) return;
    try { localStorage.removeItem(AUTO_KEY); } catch (e) { /* noop */ }
  }

  function listPresets() {
    if (!ok) return [];
    try {
      var raw = localStorage.getItem(PRESET_KEY);
      var arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch (e) { return []; }
  }

  function savePreset(name, state) {
    if (!ok) return listPresets();
    var arr = listPresets().filter(function (p) { return p.name !== name; });
    arr.unshift({ name: name, savedAt: new Date().toISOString(), state: state });
    arr = arr.slice(0, 30);
    try { localStorage.setItem(PRESET_KEY, JSON.stringify(arr)); } catch (e) { /* noop */ }
    return arr;
  }

  function deletePreset(name) {
    if (!ok) return [];
    var arr = listPresets().filter(function (p) { return p.name !== name; });
    try { localStorage.setItem(PRESET_KEY, JSON.stringify(arr)); } catch (e) { /* noop */ }
    return arr;
  }

  /** ファイルとしてダウンロード */
  function download(blob, filename) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  function exportJson(state, filename) {
    download(new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' }), filename);
  }

  function readJsonFile(file) {
    return new Promise(function (resolve, reject) {
      var r = new FileReader();
      r.onload = function () {
        try { resolve(JSON.parse(String(r.result))); }
        catch (e) { reject(new Error('JSONの読み込みに失敗しました')); }
      };
      r.onerror = function () { reject(new Error('ファイルを読めませんでした')); };
      r.readAsText(file);
    });
  }

  return {
    available: ok,
    saveAuto: saveAuto,
    loadAuto: loadAuto,
    clearAuto: clearAuto,
    listPresets: listPresets,
    savePreset: savePreset,
    deletePreset: deletePreset,
    download: download,
    exportJson: exportJson,
    readJsonFile: readJsonFile
  };
})();
