/* Controllo delle risposte: pinyin (toni con segni o numeri) e significato italiano.
 * Funziona sia nel browser (window.CN.match) sia in Node (require) per i test. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else { root.CN = root.CN || {}; root.CN.match = factory(); }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const MARKS = {
    a: ['ā', 'á', 'ǎ', 'à'],
    e: ['ē', 'é', 'ě', 'è'],
    i: ['ī', 'í', 'ǐ', 'ì'],
    o: ['ō', 'ó', 'ǒ', 'ò'],
    u: ['ū', 'ú', 'ǔ', 'ù'],
    'ü': ['ǖ', 'ǘ', 'ǚ', 'ǜ']
  };
  const REV = {};
  Object.keys(MARKS).forEach(function (base) {
    MARKS[base].forEach(function (ch, i) { REV[ch] = { base: base, tone: i + 1 }; });
  });
  const V = 'aeiouüāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ';
  const SYL = new RegExp(
    '(?:zh|ch|sh|[bpmfdtnlgkhjqxrzcsyw])?[' + V + ']+' +
    '(?:ng(?![' + V + '])|n(?![' + V + '])|r(?![' + V + ']))?', 'y');

  /* ---------- pinyin ---------- */

  function markIndex(s) {
    const a = s.indexOf('a'); if (a >= 0) return a;
    const e = s.indexOf('e'); if (e >= 0) return e;
    const ou = s.indexOf('ou'); if (ou >= 0) return ou;
    let idx = -1;
    for (let i = 0; i < s.length; i++) if ('aeiouü'.indexOf(s[i]) >= 0) idx = i;
    return idx;
  }

  /** applyTone('hao', 3) -> 'hǎo'. Toni 0 e 5 = neutro (nessun segno). */
  function applyTone(syl, tone) {
    syl = syl.replace(/u:/g, 'ü').replace(/v/g, 'ü');
    if (tone < 1 || tone > 4) return syl;
    const i = markIndex(syl);
    if (i < 0) return syl;
    return syl.slice(0, i) + MARKS[syl[i]][tone - 1] + syl.slice(i + 1);
  }

  /** 'ni3hao3' -> 'nǐhǎo' (anche nv3 -> nǚ, lu:4 -> lǜ). */
  function numbersToMarks(s) {
    return String(s).toLowerCase().replace(/([a-zü:]+)([0-5])/g, function (m, letters, d) {
      return applyTone(letters, +d);
    });
  }

  /** Minuscolo, NFC, senza spazi né punteggiatura. 'v' = 'ü'. */
  function clean(s) {
    return String(s).normalize('NFC').toLowerCase()
      .replace(/u:/g, 'ü').replace(/v/g, 'ü')
      .replace(/[\s'’`´\-·.,;:!?]/g, '');
  }

  function stripTones(s) {
    return String(s).normalize('NFD').replace(/[\u0300\u0301\u0304\u030c]/g, '').normalize('NFC');
  }

  function prepare(input) { return clean(numbersToMarks(input)); }

  /** Divide il pinyin in sillabe: [{text, base, tone}] oppure null se non è pinyin valido. */
  function parseSyllables(pinyin) {
    const out = [];
    const tokens = String(pinyin).normalize('NFC').toLowerCase().split(/[\s'’]+/).filter(Boolean);
    for (const token of tokens) {
      let pos = 0;
      while (pos < token.length) {
        SYL.lastIndex = pos;
        const m = SYL.exec(token);
        if (!m || m.index !== pos) return null;
        let base = '', tone = 0;
        for (const ch of m[0]) {
          const r = REV[ch];
          if (r) { base += r.base; tone = r.tone; } else base += ch;
        }
        out.push({ text: m[0], base: base, tone: tone });
        pos = SYL.lastIndex;
      }
    }
    return out;
  }

  function formatSyllables(sylls) {
    return sylls.map(function (s) { return applyTone(s.base, s.tone); }).join('');
  }

  /** Due toni 3 di fila: il primo si pronuncia come tono 2 (nǐhǎo -> níhǎo). */
  function sandhiVariants(pinyin) {
    const s = parseSyllables(pinyin);
    if (!s) return [];
    const idx = [];
    for (let i = 0; i < s.length - 1; i++) if (s[i].tone === 3 && s[i + 1].tone === 3) idx.push(i);
    if (!idx.length) return [];
    const res = [];
    for (let mask = 1; mask < (1 << idx.length); mask++) {
      const copy = s.map(function (x) { return { text: x.text, base: x.base, tone: x.tone }; });
      idx.forEach(function (pos, k) { if (mask & (1 << k)) copy[pos].tone = 2; });
      const str = formatSyllables(copy);
      if (res.indexOf(str) < 0) res.push(str);
    }
    return res;
  }

  const loose = function (s) { return stripTones(s).replace(/ü/g, 'u'); };

  /**
   * checkPinyin('ni3hao3', 'nǐhǎo', {ignoreTones, sandhi, alts})
   * -> {status: 'correct' | 'toneOnly' | 'wrong' | 'empty'}
   */
  function checkPinyin(input, answer, opts) {
    opts = opts || {};
    const user = prepare(input);
    if (!user) return { status: 'empty' };
    const answers = [answer].concat(opts.alts || []);
    const targets = [];
    answers.forEach(function (a) {
      targets.push(clean(a));
      if (opts.sandhi) sandhiVariants(a).forEach(function (v) { targets.push(clean(v)); });
    });
    if (targets.indexOf(user) >= 0) return { status: 'correct', exact: true };
    const u = loose(user);
    const sameLetters = targets.some(function (t) { return loose(t) === u; });
    if (sameLetters) {
      return opts.ignoreTones ? { status: 'correct', exact: false } : { status: 'toneOnly' };
    }
    return { status: 'wrong' };
  }

  /** Confronto sillaba per sillaba, per dare un indizio: ok / tone / wrong. */
  function compareSyllables(input, answer) {
    const u = parseSyllables(prepare(input));
    const a = parseSyllables(clean(answer));
    if (!u || !a || u.length !== a.length) return null;
    return a.map(function (s, i) {
      const g = u[i];
      return {
        expected: s.text,
        got: g.text,
        state: g.text === s.text ? 'ok' : (g.base === s.base ? 'tone' : 'wrong')
      };
    });
  }

  /* ---------- significato ---------- */

  function normMeaning(s) {
    s = String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    s = s.replace(/[’‘`´]/g, "'").replace(/[.!?¿¡"“”«»()]/g, ' ');
    s = s.replace(/\s+/g, ' ').trim();
    s = s.replace(/^(il|lo|la|i|gli|le|un|uno|una)\s+/, '').replace(/^(l|un)'\s*/, '');
    return s.trim();
  }

  /** Distanza di Damerau-Levenshtein (scambi di lettere contano 1). */
  function distance(a, b) {
    const m = a.length, n = b.length;
    const d = [];
    for (let i = 0; i <= m; i++) { d.push(new Array(n + 1).fill(0)); d[i][0] = i; }
    for (let j = 0; j <= n; j++) d[0][j] = j;
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
        if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
          d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
        }
      }
    }
    return d[m][n];
  }

  function within(s, t) {
    if (s === t) return true;
    const L = t.length;
    const max = L <= 4 ? 0 : (L <= 8 ? 1 : 2);
    return max > 0 && distance(s, t) <= max;
  }

  function matchesAny(s, list) {
    return list.some(function (t) { return within(s, t); });
  }

  /**
   * checkMeaning('persona', ['persona', 'essere umano'])
   * -> {status: 'correct' | 'wrong' | 'empty', matched, partial}
   * Se scrivi più significati ("scrittura, lingua") devono essere tutti giusti.
   */
  function checkMeaning(input, answers, extra) {
    const accepted = (answers || []).concat(extra || []).map(normMeaning).filter(Boolean);
    const whole = normMeaning(input);
    if (!whole) return { status: 'empty' };
    if (matchesAny(whole, accepted)) return { status: 'correct', matched: [whole] };
    const parts = String(input).split(/[,;/]+|\s+(?:o|e)\s+/i).map(normMeaning).filter(Boolean);
    if (parts.length > 1) {
      const ok = parts.filter(function (p) { return matchesAny(p, accepted); });
      if (ok.length === parts.length) return { status: 'correct', matched: ok };
      return { status: 'wrong', partial: ok.length };
    }
    return { status: 'wrong', partial: 0 };
  }

  return {
    MARKS: MARKS,
    applyTone: applyTone,
    numbersToMarks: numbersToMarks,
    clean: clean,
    prepare: prepare,
    stripTones: stripTones,
    parseSyllables: parseSyllables,
    formatSyllables: formatSyllables,
    sandhiVariants: sandhiVariants,
    checkPinyin: checkPinyin,
    compareSyllables: compareSyllables,
    normMeaning: normMeaning,
    distance: distance,
    checkMeaning: checkMeaning
  };
});
