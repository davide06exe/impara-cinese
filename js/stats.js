/* Pagina Statistiche: giuste / sbagliate / arrese, serie di giorni, livelli, voci difficili. */
(function (root) {
  'use strict';
  const CN = root.CN = root.CN || {};
  const NS = 'http://www.w3.org/2000/svg';

  const MODE_LABEL = { listen: 'Ascolto', flash: 'Flashcard', pezzi: 'Pezzi' };
  const TYPE_LABEL = { char: 'Caratteri', particle: 'Particelle', word: 'Parole', piece: 'Pezzi (solo componenti)' };
  const PIECE_Q_LABEL = {
    sound: 'Suono', sense: 'Significato', compose: 'Composizione',
    build: 'Costruzione', pmean: 'Pezzo → significato', pfind: 'Significato → pezzo'
  };
  const LEVELS = ['Nuove', 'Da rivedere', 'In corso', 'Buone', 'Solide', 'Padroneggiate'];

  function svg(tag, attrs) {
    const el = document.createElementNS(NS, tag);
    Object.keys(attrs || {}).forEach(function (k) { el.setAttribute(k, attrs[k]); });
    for (let i = 2; i < arguments.length; i++) if (arguments[i]) el.appendChild(arguments[i]);
    return el;
  }

  function stackBar(t, label) {
    const h = CN.u.h;
    const n = t.r + t.w + t.g;
    const seg = function (cls, v, name) {
      return v ? h('span', { class: 'seg ' + cls, style: 'flex:' + v, title: v + ' ' + name }) : null;
    };
    return h('div', { class: 'sbar-row' },
      h('div', { class: 'sbar-label' }, label),
      h('div', { class: 'sbar', role: 'img', 'aria-label': label + ': ' + t.r + ' giuste, ' + t.w + ' sbagliate, ' + t.g + ' arrese' },
        n ? [seg('seg-r', t.r, 'giuste'), seg('seg-w', t.w, 'sbagliate'), seg('seg-g', t.g, 'arrese')] : h('span', { class: 'seg seg-0', style: 'flex:1' })),
      h('div', { class: 'sbar-num' }, n ? CN.u.pct(t.r, n) + '%' : '–',
        h('span', { class: 'sbar-sub' }, n ? t.r + ' / ' + t.w + ' / ' + t.g : 'nessuna risposta')));
  }

  function chart(days) {
    const W = 640, H = 190, padL = 28, padB = 30, padT = 12;
    const max = Math.max(5, Math.max.apply(null, days.map(function (d) { return d.r + d.w + d.g; })));
    const bw = (W - padL) / days.length;
    const y = function (v) { return padT + (H - padT - padB) * (1 - v / max); };
    const root_ = svg('svg', { viewBox: '0 0 ' + W + ' ' + H, class: 'chart', role: 'img',
      'aria-label': 'Risposte degli ultimi ' + days.length + ' giorni' });
    [0, Math.round(max / 2), max].forEach(function (v) {
      root_.appendChild(svg('line', { x1: padL, x2: W, y1: y(v), y2: y(v), class: 'grid' }));
      const t = svg('text', { x: padL - 6, y: y(v) + 4, class: 'axis', 'text-anchor': 'end' });
      t.textContent = v;
      root_.appendChild(t);
    });
    days.forEach(function (d, i) {
      const x = padL + i * bw + bw * 0.18;
      const w = bw * 0.64;
      let base = H - padB;
      [['r', 'bar-r', 'giuste'], ['w', 'bar-w', 'sbagliate'], ['g', 'bar-g', 'arrese']].forEach(function (s) {
        const v = d[s[0]];
        if (!v) return;
        const hgt = (H - padT - padB) * (v / max);
        const r = svg('rect', { x: x, y: base - hgt, width: w, height: hgt, class: s[1] });
        r.appendChild(svg('title', {})).textContent = d.date.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' }) + ': ' + v + ' ' + s[2];
        root_.appendChild(r);
        base -= hgt;
      });
      const lab = svg('text', { x: x + w / 2, y: H - 10, class: 'axis', 'text-anchor': 'middle' });
      lab.textContent = d.date.getDate();
      root_.appendChild(lab);
    });
    return root_;
  }

  function render(host) {
    const h = CN.u.h, icon = CN.u.icon;
    const store = CN.store;
    const data = CN.data;
    const byId = {};
    data.entries.forEach(function (e) { byId[e.id] = e; });
    const st = store.all();
    const total = store.totals();
    const todayN = store.today().n;
    const goal = store.settings().dailyGoal;

    const view = h('div', { class: 'stats' });
    host.appendChild(view);
    view.append(h('div', { class: 'p-head' }, h('h1', { class: 'p-title' }, icon('chart', 22), 'Statistiche')));

    if (!total.n) {
      view.append(h('section', { class: 'sheet empty' },
        h('p', null, 'Ancora nessuna risposta. Le statistiche compaiono appena fai il primo esercizio.'),
        h('div', { class: 'actions' },
          h('a', { class: 'btn btn-primary', href: '#/ascolto' }, 'Inizia con l’ascolto'),
          h('a', { class: 'btn btn-ghost', href: '#/flashcard' }, 'Oppure le flashcard'))));
      view.append(dataTools());
      return { destroy: function () { view.remove(); } };
    }

    /* --- riepilogo --- */
    const streak = store.streak();
    view.append(h('section', { class: 'sheet' },
      h('div', { class: 'big-stats' },
        bigStat(total.r, 'giuste', 'r'), bigStat(total.w, 'sbagliate', 'w'), bigStat(total.g, 'arrese', 'g'),
        bigStat(CN.u.pct(total.r, total.n) + '%', 'giuste al primo colpo', 'n')),
      h('div', { class: 'today' },
        h('div', { class: 'today-text' },
          icon('flame', 18),
          h('span', null, streak ? streak + (streak === 1 ? ' giorno di fila' : ' giorni di fila') : 'Nessuna serie in corso'),
          h('span', { class: 'muted' }, ' · record ' + store.bestStreak())),
        goal ? h('div', { class: 'goal' },
          h('div', { class: 'goal-text' }, 'Oggi ' + todayN + ' su ' + goal + ' risposte'),
          h('div', { class: 'p-progress', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': goal, 'aria-valuenow': Math.min(todayN, goal) },
            h('span', { style: 'width:' + Math.min(100, CN.u.pct(todayN, goal)) + '%' }))) : null)));

    /* --- modalità --- */
    const modes = h('div', { class: 'sbars' }, ['listen', 'flash', 'pezzi'].map(function (m) { return stackBar(store.totals(m), MODE_LABEL[m]); }));
    view.append(section('Per esercizio', 'Giuste / sbagliate / arrese, sul totale delle risposte.', modes));

    /* --- ultimi 14 giorni --- */
    const days = store.lastDays(14);
    view.append(section('Ultimi 14 giorni', 'Risposte al giorno.',
      h('div', { class: 'chart-wrap' }, chart(days),
        h('div', { class: 'legend' },
          h('span', null, h('i', { class: 'dot dot-r' }), 'giuste'),
          h('span', null, h('i', { class: 'dot dot-w' }), 'sbagliate'),
          h('span', null, h('i', { class: 'dot dot-g' }), 'arrese')))));

    /* --- per categoria --- */
    const cat = {}, pq = {};
    const hard = [];
    Object.keys(st.items).forEach(function (k) {
      const i = k.indexOf('|');
      const mode = k.slice(0, i), key = k.slice(i + 1), it = st.items[k];
      if (mode === 'pezzi') {
        const t = key.split(':')[0];
        const b = pq[t] || (pq[t] = { r: 0, w: 0, g: 0 });
        b.r += it.r || 0; b.w += it.w || 0; b.g += it.g || 0;
      } else {
        const e = byId[key];
        if (!e) return;
        const b = cat[e.type] || (cat[e.type] = { r: 0, w: 0, g: 0 });
        b.r += it.r || 0; b.w += it.w || 0; b.g += it.g || 0;
      }
    });
    // voci difficili: somma Ascolto + Flashcard
    const perEntry = {};
    ['listen', 'flash'].forEach(function (m) {
      Object.keys(byId).forEach(function (id) {
        const it = st.items[m + '|' + id];
        if (!it) return;
        const b = perEntry[id] || (perEntry[id] = { r: 0, w: 0, g: 0 });
        b.r += it.r || 0; b.w += it.w || 0; b.g += it.g || 0;
      });
    });
    Object.keys(perEntry).forEach(function (id) {
      const b = perEntry[id], n = b.r + b.w + b.g;
      if (n >= 2 && (b.w + b.g) / n >= 0.5) hard.push({ e: byId[id], b: b, n: n, ratio: (b.w + b.g) / n });
    });
    hard.sort(function (a, b) { return b.ratio - a.ratio || b.n - a.n; });

    const catKeys = Object.keys(TYPE_LABEL).filter(function (k) { return cat[k]; });
    if (catKeys.length) {
      view.append(section('Per categoria', 'Ascolto e Flashcard insieme.',
        h('div', { class: 'sbars' }, catKeys.map(function (k) { return stackBar(cat[k], TYPE_LABEL[k]); }))));
    }
    const pqKeys = Object.keys(PIECE_Q_LABEL).filter(function (k) { return pq[k]; });
    if (pqKeys.length) {
      view.append(section('Pezzi: per tipo di domanda', null,
        h('div', { class: 'sbars' }, pqKeys.map(function (k) { return stackBar(pq[k], PIECE_Q_LABEL[k]); }))));
    }

    /* --- livelli --- */
    const lvBars = ['flash', 'listen'].map(function (m) {
      const counts = [0, 0, 0, 0, 0, 0];
      data.entries.forEach(function (e) {
        if (m === 'listen' && !e.speak) return;
        const it = st.items[m + '|' + e.id];
        counts[it ? it.box : 0]++;
      });
      const nAll = counts.reduce(function (a, b) { return a + b; }, 0);
      return h('div', { class: 'sbar-row' },
        h('div', { class: 'sbar-label' }, MODE_LABEL[m]),
        h('div', { class: 'sbar', role: 'img', 'aria-label': MODE_LABEL[m] + ': ' + counts.map(function (c, i) { return c + ' ' + LEVELS[i].toLowerCase(); }).join(', ') },
          counts.map(function (c, i) { return c ? h('span', { class: 'seg lv lv-' + i, style: 'flex:' + c, title: c + ' ' + LEVELS[i].toLowerCase() }) : null; })),
        h('div', { class: 'sbar-num' }, counts[5] + counts[4], h('span', { class: 'sbar-sub' }, 'solide su ' + nAll)));
    });
    view.append(section('Livelli di ripasso', 'Ogni risposta giusta al primo colpo fa salire di livello, un errore o una resa riporta a «Da rivedere». Le voci in basso escono più spesso.',
      h('div', { class: 'sbars' }, lvBars,
        h('div', { class: 'legend' }, LEVELS.map(function (l, i) { return h('span', null, h('i', { class: 'dot lv lv-' + i }), l); })))));

    /* --- da ripassare --- */
    if (hard.length) {
      const top = hard.slice(0, 8);
      view.append(section('Da ripassare', 'Le voci in cui sbagli o ti arrendi più spesso (almeno due tentativi).',
        h('ul', { class: 'hard' }, top.map(function (x) {
          return h('li', null,
            h('span', { class: 'hz hard-hz' }, x.e.hanzi),
            h('span', { class: 'hard-main' }, h('strong', null, x.e.pinyin), ' ', x.e.meaning),
            h('span', { class: 'hard-n' }, x.b.w + ' sbagliate, ' + x.b.g + ' arrese su ' + x.n));
        })),
        h('div', { class: 'actions' },
          h('button', { class: 'btn btn-primary', type: 'button', onClick: function () {
            CN.practice.setOverride('flash', hard.slice(0, 20).map(function (x) { return x.e.id; }));
            root.location.hash = '#/flashcard';
          } }, 'Ripassa queste con le flashcard (' + Math.min(20, hard.length) + ')'))));
    }

    view.append(dataTools());
    return { destroy: function () { view.remove(); } };

    function bigStat(value, label, cls) {
      return h('div', { class: 'big big-' + cls }, h('div', { class: 'big-n' }, value), h('div', { class: 'big-l' }, label));
    }
    function section(title, sub, body) {
      return h('section', { class: 'sheet' }, h('h2', null, title), sub ? h('p', { class: 'sub' }, sub) : null, Array.prototype.slice.call(arguments, 2));
    }
  }

  function dataTools() {
    const h = CN.u.h, icon = CN.u.icon;
    const file = h('input', { type: 'file', accept: 'application/json,.json', class: 'sr-only', id: 'import-file', onChange: function (ev) {
      const f = ev.target.files[0];
      if (!f) return;
      const rd = new FileReader();
      rd.onload = function () {
        try {
          if (!root.confirm('Importare i progressi da questo file? Sostituisce quelli attuali di questo browser.')) return;
          CN.store.importData(JSON.parse(rd.result));
          CN.u.toast('Progressi importati.');
          CN.app.refresh();
        } catch (e) { CN.u.toast('File non valido.'); }
      };
      rd.readAsText(f);
      ev.target.value = '';
    } });
    return h('section', { class: 'sheet' },
      h('h2', null, 'I tuoi dati'),
      h('p', { class: 'sub' }, 'I progressi stanno solo in questo browser. Esportali per fare una copia o per portarli su un altro dispositivo.'),
      h('div', { class: 'actions' },
        h('button', { class: 'btn btn-ghost', type: 'button', onClick: function () {
          const blob = new Blob([JSON.stringify(CN.store.exportData(), null, 1)], { type: 'application/json' });
          const a = document.createElement('a');
          a.href = URL.createObjectURL(blob);
          a.download = 'impara-cinese-progressi-' + CN.store.dateKey() + '.json';
          document.body.appendChild(a); a.click(); a.remove();
          setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
        } }, icon('download', 16), ' Esporta'),
        h('label', { class: 'btn btn-ghost', for: 'import-file' }, icon('upload', 16), ' Importa'),
        file,
        h('button', { class: 'btn btn-danger', type: 'button', onClick: function () {
          if (root.confirm('Azzerare tutte le statistiche? Le impostazioni restano. Non si può annullare.')) {
            CN.store.resetStats(); CN.u.toast('Statistiche azzerate.'); CN.app.refresh();
          }
        } }, 'Azzera statistiche')));
  }

  CN.stats = { mount: render, dataTools: dataTools };
})(window);
