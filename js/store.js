/* Impostazioni e statistiche, salvate nel browser (localStorage). */
(function (root) {
  'use strict';
  const CN = root.CN = root.CN || {};
  const KEY = 'impara-cinese:v1';

  const DEFAULTS = {
    theme: 'auto',            // 'auto' | 'light' | 'dark'
    strokes: true,            // animazione dell'ordine dei tratti
    ignoreTones: false,       // nell'ascolto/flashcard: accetta il pinyin senza toni
    smart: true,              // ripasso intelligente (Leitner)
    session: 10,              // domande per sessione (0 = senza fine)
    dailyGoal: 20,            // risposte al giorno
    autoSpeak: true,          // flashcard: pronuncia dopo la risposta
    rate: 0.85,               // velocità della voce
    voiceURI: '',
    filters: [],              // tag scelti per Ascolto e Flashcard (vuoto = tutto)
    pieceTypes: ['sound', 'sense', 'compose', 'build', 'pmean', 'pfind']
  };

  let memoryOnly = false;
  const listeners = [];

  function blank() {
    return { v: 1, settings: Object.assign({}, DEFAULTS), items: {}, days: {}, modes: {}, synonyms: {} };
  }
  function obj(x) { return x && typeof x === 'object' && !Array.isArray(x) ? x : {}; }
  function normalize(d) {
    d = obj(d);
    const b = blank();
    return {
      v: 1,
      settings: Object.assign(b.settings, obj(d.settings)),
      items: obj(d.items), days: obj(d.days), modes: obj(d.modes), synonyms: obj(d.synonyms)
    };
  }
  function load() {
    try {
      const raw = root.localStorage.getItem(KEY);
      return raw ? normalize(JSON.parse(raw)) : blank();
    } catch (e) { memoryOnly = true; return blank(); }
  }

  let state = load();

  function emit(kind) { listeners.forEach(function (fn) { try { fn(kind); } catch (e) { console.error(e); } }); }
  function save(kind) {
    try { root.localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { memoryOnly = true; }
    emit(kind);
  }

  /* ---------- date ---------- */
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function dateKey(d) {
    d = d || new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }
  function addDays(d, n) { return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n); }
  function dayTotal(x) { return x ? (x.r || 0) + (x.w || 0) + (x.g || 0) : 0; }

  /* ---------- impostazioni ---------- */
  function settings() { return state.settings; }
  function set(name, value) {
    state.settings[name] = value;
    save('settings');
  }

  /* ---------- risposte ---------- */
  /** outcome: 'r' giusta, 'w' sbagliata, 'g' arresa */
  function record(mode, key, outcome) {
    const k = mode + '|' + key;
    const it = state.items[k] || { r: 0, w: 0, g: 0, box: 0, last: 0 };
    it[outcome] = (it[outcome] || 0) + 1;
    it.last = Date.now();
    it.box = outcome === 'r' ? Math.min(5, Math.max(it.box, 1) + 1) : 1;
    state.items[k] = it;
    const m = state.modes[mode] || (state.modes[mode] = { r: 0, w: 0, g: 0 });
    m[outcome] = (m[outcome] || 0) + 1;
    const dk = dateKey();
    const day = state.days[dk] || (state.days[dk] = { r: 0, w: 0, g: 0 });
    day[outcome] = (day[outcome] || 0) + 1;
    save('data');
    return it;
  }
  function item(mode, key) { return state.items[mode + '|' + key] || null; }

  /** Peso per il ripasso intelligente: più basso il livello, più spesso esce. */
  function weight(mode, key) {
    const it = item(mode, key);
    if (!it) return 6;
    const byBox = [6, 8, 5, 3, 1.5, 0.7][it.box] || 1;
    const recent = Date.now() - it.last < 10 * 60 * 1000 ? 0.2 : 1;
    return byBox * recent;
  }

  function totals(mode) {
    const t = { r: 0, w: 0, g: 0 };
    const src = mode ? [state.modes[mode]] : Object.keys(state.modes).map(function (k) { return state.modes[k]; });
    src.forEach(function (m) { if (m) { t.r += m.r || 0; t.w += m.w || 0; t.g += m.g || 0; } });
    t.n = t.r + t.w + t.g;
    return t;
  }

  function today() {
    const d = state.days[dateKey()] || { r: 0, w: 0, g: 0 };
    return { r: d.r || 0, w: d.w || 0, g: d.g || 0, n: dayTotal(d) };
  }

  /** Ultimi n giorni, dal più vecchio a oggi. */
  function lastDays(n) {
    const out = [];
    const now = new Date();
    for (let i = n - 1; i >= 0; i--) {
      const d = addDays(now, -i);
      const x = state.days[dateKey(d)] || {};
      out.push({ date: d, r: x.r || 0, w: x.w || 0, g: x.g || 0 });
    }
    return out;
  }

  function streak() {
    let d = new Date();
    if (!dayTotal(state.days[dateKey(d)])) d = addDays(d, -1);
    let n = 0;
    while (dayTotal(state.days[dateKey(d)]) > 0) { n++; d = addDays(d, -1); }
    return n;
  }
  function bestStreak() {
    const keys = Object.keys(state.days).filter(function (k) { return dayTotal(state.days[k]) > 0; }).sort();
    let best = 0, run = 0, prev = null;
    keys.forEach(function (k) {
      const p = k.split('-').map(Number);
      const d = new Date(p[0], p[1] - 1, p[2]);
      run = prev && dateKey(addDays(prev, 1)) === k ? run + 1 : 1;
      best = Math.max(best, run);
      prev = d;
    });
    return best;
  }

  /* ---------- sinonimi aggiunti da te ---------- */
  function synonyms(entryId) { return state.synonyms[entryId] || []; }
  function addSynonym(entryId, text) {
    const t = String(text).trim();
    if (!t) return;
    const list = state.synonyms[entryId] || (state.synonyms[entryId] = []);
    if (list.indexOf(t) < 0) list.push(t);
    save('data');
  }

  /* ---------- esporta / importa / azzera ---------- */
  function exportData() { return JSON.parse(JSON.stringify(state)); }
  function importData(d) {
    if (!d || typeof d !== 'object' || !d.items || !d.settings) throw new Error('File non valido');
    state = normalize(d);
    save('settings');
    emit('data');
  }
  function resetStats() {
    state.items = {}; state.days = {}; state.modes = {};
    save('data');
  }

  CN.store = {
    settings: settings, set: set, record: record, item: item, weight: weight,
    totals: totals, today: today, lastDays: lastDays, streak: streak, bestStreak: bestStreak,
    synonyms: synonyms, addSynonym: addSynonym,
    exportData: exportData, importData: importData, resetStats: resetStats,
    all: function () { return state; },
    onChange: function (fn) {
      listeners.push(fn);
      return function () { const i = listeners.indexOf(fn); if (i >= 0) listeners.splice(i, 1); };
    },
    isMemoryOnly: function () { return memoryOnly; },
    dateKey: dateKey,
    DEFAULTS: DEFAULTS
  };
})(window);
