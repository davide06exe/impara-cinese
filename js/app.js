/* Pagina principale: percorsi (#/...), interruttori tema e tratti, impostazioni, catalogo. */
(function (root) {
  'use strict';
  const CN = root.CN = root.CN || {};
  const h = CN.u.h, icon = CN.u.icon;
  const store = CN.store;

  const ROUTES = [
    { id: 'home', path: '', label: 'Home', ico: 'home' },
    { id: 'listen', path: 'ascolto', label: 'Ascolto', ico: 'ear' },
    { id: 'flash', path: 'flashcard', label: 'Flashcard', ico: 'cards' },
    { id: 'pezzi', path: 'pezzi', label: 'Pezzi', ico: 'pieces' },
    { id: 'catalogo', path: 'catalogo', label: 'Catalogo', ico: 'book' },
    { id: 'stats', path: 'statistiche', label: 'Statistiche', ico: 'chart' }
  ];
  const TAGS = [
    ['char', 'Caratteri'], ['particle', 'Particelle'], ['word', 'Parole'], ['piece', 'Pezzi'], ['memo', 'Da imparare a memoria']
  ];

  let current = null;
  const mainEl = function () { return document.getElementById('main'); };

  /* ---------- tema ---------- */
  const mq = root.matchMedia ? root.matchMedia('(prefers-color-scheme: dark)') : null;
  function effectiveTheme() {
    const t = store.settings().theme;
    if (t === 'light' || t === 'dark') return t;
    return mq && mq.matches ? 'dark' : 'light';
  }
  function applyTheme() {
    const t = store.settings().theme;
    document.documentElement.setAttribute('data-theme', t === 'auto' ? (effectiveTheme()) : t);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', effectiveTheme() === 'dark' ? '#10161d' : '#e6ebef');
  }

  /* ---------- barra in alto ---------- */
  function buildChrome() {
    const nav = document.getElementById('nav');
    ROUTES.forEach(function (r) {
      nav.append(h('a', { href: '#/' + r.path, 'data-route': r.id }, icon(r.ico, 22), h('span', null, r.label)));
    });
    const tools = document.getElementById('tools');

    const strokesBtn = h('button', {
      type: 'button', class: 'tool', id: 'btn-strokes', 'aria-pressed': 'false',
      title: 'Ordine dei tratti: animazione del carattere quando vedi la risposta',
      onClick: function () { store.set('strokes', !store.settings().strokes); syncTools(); }
    }, icon('brush', 20), h('span', { class: 'tool-label' }, 'Tratti'), h('span', { class: 'tool-state' }));

    const themeBtn = h('button', {
      type: 'button', class: 'tool', id: 'btn-theme', 'aria-pressed': 'false',
      title: 'Tema scuro',
      onClick: function () { store.set('theme', effectiveTheme() === 'dark' ? 'light' : 'dark'); applyTheme(); syncTools(); }
    }, h('span', { class: 'ico-sun' }, icon('sun', 20)), h('span', { class: 'ico-moon' }, icon('moon', 20)), h('span', { class: 'tool-label' }, 'Scuro'), h('span', { class: 'tool-state' }));

    const setBtn = h('button', { type: 'button', class: 'tool', 'aria-label': 'Impostazioni', title: 'Impostazioni', onClick: openSettings }, icon('gear', 20));
    tools.append(strokesBtn, themeBtn, setBtn);
    syncTools();
  }
  function syncTools() {
    const s = store.settings();
    const sb = document.getElementById('btn-strokes');
    const tb = document.getElementById('btn-theme');
    if (sb) { sb.setAttribute('aria-pressed', s.strokes ? 'true' : 'false'); sb.querySelector('.tool-state').textContent = s.strokes ? 'on' : 'off'; }
    if (tb) {
      const dark = effectiveTheme() === 'dark';
      tb.setAttribute('aria-pressed', dark ? 'true' : 'false');
      tb.querySelector('.tool-state').textContent = dark ? 'on' : 'off';
    }
  }

  /* ---------- percorsi ---------- */
  function routeFromHash() {
    const p = (root.location.hash || '').replace(/^#\/?/, '').split('?')[0];
    return ROUTES.filter(function (r) { return r.path === p; })[0] || ROUTES[0];
  }

  function show() {
    const r = routeFromHash();
    if (current && current.destroy) current.destroy();
    current = null;
    CN.speech.stop();
    const main = mainEl();
    CN.u.clear(main);
    Array.prototype.forEach.call(document.querySelectorAll('#nav a'), function (a) {
      if (a.getAttribute('data-route') === r.id) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    document.title = (r.id === 'home' ? 'Impara il cinese' : r.label + ' · Impara il cinese');
    try {
      if (r.id === 'home') current = home(main);
      else if (r.id === 'listen') current = CN.practice.mount(main, 'listen');
      else if (r.id === 'flash') current = CN.practice.mount(main, 'flash');
      else if (r.id === 'pezzi') current = CN.pieces.mount(main);
      else if (r.id === 'catalogo') current = catalog(main);
      else if (r.id === 'stats') current = CN.stats.mount(main);
    } catch (e) {
      console.error(e);
      main.append(h('section', { class: 'sheet' }, h('p', null, 'Qualcosa è andato storto in questa pagina: ' + e.message)));
    }
    root.scrollTo(0, 0);
  }

  /* ---------- home ---------- */
  function home(host) {
    const wrap = h('div', { class: 'home' });
    host.append(wrap);
    const t = store.totals();
    const today = store.today();
    const goal = store.settings().dailyGoal;
    const streak = store.streak();
    const voice = CN.speech.status();

    const tiles = [
      { href: '#/ascolto', ico: 'ear', title: 'Ascolto', text: 'Senti la parola e scrivi il pinyin. Se non lo sai, ti arrendi e il sito completa per te.', stat: store.totals('listen') },
      { href: '#/flashcard', ico: 'cards', title: 'Flashcard', text: 'Vedi il carattere, scrivi pinyin e significato.', stat: store.totals('flash') },
      { href: '#/pezzi', ico: 'pieces', title: 'Pezzi', text: 'Quale pezzo dà il suono? Quale il significato? Come si compone un carattere?', stat: store.totals('pezzi') }
    ];

    CN.u.appendAll(wrap, [
      h('section', { class: 'hero' },
        h('div', null,
          h('h1', null, 'Impara il cinese'),
          h('p', { class: 'hero-sub' }, 'Il tuo catalogo, trasformato in esercizi: ' + CN.data.entries.length + ' voci, ' + CN.data.compounds.length + ' caratteri composti.')),
        h('div', { class: 'hero-cells', 'aria-hidden': 'true' },
          ['学', '中', '文'].map(function (c) { return h('div', { class: 'stroke-cell static-hanzi', style: 'width:76px;height:76px;font-size:58px' }, c); }))),
      h('div', { class: 'tiles' }, tiles.map(function (x) {
        const n = x.stat.n;
        return h('a', { class: 'tile', href: x.href },
          h('span', { class: 'tile-ico' }, icon(x.ico, 28)),
          h('span', { class: 'tile-title' }, x.title),
          h('span', { class: 'tile-text' }, x.text),
          h('span', { class: 'tile-stat' }, n ? CN.u.pct(x.stat.r, n) + '% giuste su ' + n : 'Non ancora provato'));
      })),
      h('section', { class: 'sheet strip' },
        h('div', { class: 'strip-item' }, icon('flame', 20), h('div', null, h('strong', null, streak), ' ', streak === 1 ? 'giorno di fila' : 'giorni di fila')),
        goal ? h('div', { class: 'strip-item grow' },
          h('div', null, h('strong', null, today.n), ' su ' + goal + ' risposte oggi'),
          h('div', { class: 'p-progress' }, h('span', { style: 'width:' + Math.min(100, CN.u.pct(today.n, goal)) + '%' }))) : null,
        h('a', { class: 'btn btn-quiet', href: '#/statistiche' }, 'Statistiche')),
      voice.supported && !voice.hasChinese ? h('div', { class: 'p-note', role: 'note' },
        h('strong', null, 'Voce cinese non trovata. '),
        'L’ascolto ha bisogno di una voce cinese: con Microsoft Edge ce ne sono già di pronte, oppure installa la lingua Cinese (semplificato) con la sintesi vocale.') : null,
      store.isMemoryOnly() ? h('div', { class: 'p-note', role: 'note' }, h('strong', null, 'Salvataggio non disponibile. '), 'Il browser non permette di salvare i dati: i progressi si perdono quando chiudi la pagina.') : null]);
    return { destroy: function () { wrap.remove(); } };
  }

  /* ---------- catalogo ---------- */
  function catalog(host) {
    const wrap = h('div', { class: 'catalog' });
    host.append(wrap);
    let query = '';
    let tag = '';
    const list = h('div', { class: 'cat-grid' });
    const count = h('p', { class: 'sub', 'aria-live': 'polite' });

    const input = h('input', { class: 'inp', type: 'search', placeholder: 'Cerca: carattere, pinyin o italiano', 'aria-label': 'Cerca nel catalogo', autocomplete: 'off', spellcheck: 'false',
      onInput: function (ev) { query = ev.target.value; draw(); } });
    const chips = h('div', { class: 'chips' });
    function chipBtn(id, label) {
      return h('button', { type: 'button', class: 'chip-toggle', 'aria-pressed': tag === id ? 'true' : 'false',
        onClick: function () { tag = id; drawChips(); draw(); } }, label);
    }
    function drawChips() {
      CN.u.clear(chips);
      chips.append(chipBtn('', 'Tutto'));
      TAGS.forEach(function (t) { chips.append(chipBtn(t[0], t[1])); });
      CN.data.groups.forEach(function (g) { chips.append(chipBtn('word:' + g, g)); });
    }
    function matches(e) {
      if (tag && e.tags.indexOf(tag) < 0) return false;
      const q = query.trim();
      if (!q) return true;
      const ql = q.toLowerCase();
      const pin = CN.match.stripTones(e.pinyin).replace(/\s+/g, '').toLowerCase();
      const num = CN.match.stripTones(CN.match.numbersToMarks(q)).replace(/\s+/g, '').toLowerCase();
      return e.hanzi.indexOf(q) >= 0 || pin.indexOf(num) >= 0 || CN.match.normMeaning(e.meaning).indexOf(CN.match.normMeaning(q)) >= 0 ||
        e.meaning.toLowerCase().indexOf(ql) >= 0;
    }
    function draw() {
      CN.u.clear(list);
      const items = CN.data.entries.filter(matches);
      count.textContent = items.length + (items.length === 1 ? ' voce' : ' voci');
      if (!items.length) list.append(h('p', { class: 'empty-note' }, 'Nessuna voce trovata. Prova con meno lettere o senza toni.'));
      items.forEach(function (e) {
        const it = store.item('flash', e.id), li = store.item('listen', e.id);
        const seen = (it ? it.r + it.w + it.g : 0) + (li ? li.r + li.w + li.g : 0);
        list.append(h('button', { type: 'button', class: 'cat-item', onClick: function () { openEntry(e); } },
          h('span', { class: 'hz cat-hz' }, e.hanzi),
          h('span', { class: 'cat-text' }, h('span', { class: 'cat-py' }, e.pinyin), h('span', { class: 'cat-mean' }, e.meaning)),
          seen ? h('span', { class: 'cat-seen', title: 'Risposte date' }, seen) : null));
      });
    }
    wrap.append(h('div', { class: 'p-head' }, h('h1', { class: 'p-title' }, icon('book', 22), 'Catalogo')),
      h('div', { class: 'cat-tools' }, h('div', { class: 'search' }, icon('search', 18), input), chips), count, list);
    drawChips(); draw();
    return { destroy: function () { wrap.remove(); } };
  }

  function openEntry(e) {
    const dlg = document.getElementById('detail');
    CN.u.clear(dlg);
    const host = h('div', { class: 'stroke-host' });
    const size = Math.max(64, Math.min(150, Math.floor((Math.min(420, root.innerWidth - 80) - (Array.from(e.hanzi).length - 1) * 8) / Array.from(e.hanzi).length)));
    let ctrl = null;
    const strokeTools = h('div', { class: 'play-row' });
    const statLine = function (mode, label) {
      const it = store.item(mode, e.id);
      return it ? h('li', null, h('strong', null, label + ': '), it.r + ' giuste, ' + it.w + ' sbagliate, ' + it.g + ' arrese · livello ' + it.box + '/5') : null;
    };
    const comp = CN.data.compounds.filter(function (c) { return c.hanzi === e.hanzi; })[0];
    dlg.append(h('div', { class: 'dlg-body' },
      h('div', { class: 'dlg-head' }, h('h2', null, e.hanzi + ' ' + e.pinyin), h('button', { type: 'button', class: 'btn btn-quiet', onClick: function () { dlg.close(); } }, 'Chiudi')),
      h('div', { class: 'stage' }, host, strokeTools),
      h('div', { class: 'play-row' },
        h('button', { class: 'btn btn-small btn-primary', type: 'button', onClick: function () { CN.speech.speak(e.hanzi, {}); } }, icon('speaker', 16), ' Ascolta'),
        h('button', { class: 'btn btn-small btn-ghost', type: 'button', onClick: function () { CN.speech.speak(e.hanzi, { slow: true }); } }, icon('turtle', 16), ' Lento')),
      h('p', { class: 'rv-meaning' }, e.meaning),
      e.note ? h('p', { class: 'rv-note' }, 'Nota: ' + e.note) : null,
      e.group ? h('p', { class: 'rv-note' }, 'Gruppo: ' + e.group) : null,
      comp ? h('p', { class: 'rv-note' }, 'Composto da: ' + comp.parts.map(function (p) { return p.hanzi + (p.pinyin ? ' ' + p.pinyin : ''); }).join(' + ')) : null,
      h('ul', { class: 'dlg-stats' }, statLine('flash', 'Flashcard'), statLine('listen', 'Ascolto'))));
    dlg.onclose = function () { if (ctrl) ctrl.destroy(); CN.speech.stop(); };
    dlg.showModal();
    ctrl = CN.strokes.mount(host, e.hanzi, { animate: true, size: size });
    ctrl.ready.then(function (ok) {
      if (!ok) return;
      strokeTools.append(
        h('button', { class: 'btn btn-small btn-ghost', type: 'button', onClick: function () { ctrl.replay(); } }, icon('brush', 16), ' Rivedi i tratti'),
        h('button', { class: 'btn btn-small btn-ghost', type: 'button', onClick: function () { ctrl.quiz(); } }, 'Prova a scrivere'));
    });
  }

  /* ---------- impostazioni ---------- */
  let settingsBefore = '';
  function snapshot() {
    const s = store.settings();
    return JSON.stringify([s.filters, s.session, s.ignoreTones, s.pieceTypes]);
  }
  function openSettings() {
    const dlg = document.getElementById('settings');
    CN.u.clear(dlg);
    settingsBefore = snapshot();
    const s = store.settings();
    const sp = CN.speech.status();

    function toggle(label, key, hint) {
      return h('label', { class: 'switch row' },
        h('input', { type: 'checkbox', checked: s[key] ? true : null, onChange: function (ev) { store.set(key, ev.target.checked); } }),
        h('span', null, label, hint ? h('small', null, hint) : null));
    }
    function select(label, key, options, numeric) {
      return h('label', { class: 'row sel' }, h('span', null, label),
        h('select', { class: 'inp', onChange: function (ev) { store.set(key, numeric ? Number(ev.target.value) : ev.target.value); } },
          options.map(function (o) { return h('option', { value: o[0], selected: String(s[key]) === String(o[0]) ? true : null }, o[1]); })));
    }
    const voices = CN.speech.voices();
    const voiceSel = h('select', { class: 'inp', 'aria-label': 'Voce', onChange: function (ev) { store.set('voiceURI', ev.target.value); } },
      h('option', { value: '' }, voices.length ? 'Automatica (la migliore trovata)' : 'Nessuna voce cinese trovata'),
      voices.map(function (v) { return h('option', { value: v.voiceURI, selected: s.voiceURI === v.voiceURI ? true : null }, v.name + ' (' + v.lang + ')'); }));

    const tagBtns = h('div', { class: 'chips' });
    function drawTags() {
      CN.u.clear(tagBtns);
      const f = store.settings().filters;
      const all = TAGS.concat(CN.data.groups.map(function (g) { return ['word:' + g, 'Parole: ' + g]; }));
      all.forEach(function (t) {
        const on = f.indexOf(t[0]) >= 0;
        tagBtns.append(h('button', { type: 'button', class: 'chip-toggle', 'aria-pressed': on ? 'true' : 'false', onClick: function () {
          const cur = store.settings().filters.slice();
          const i = cur.indexOf(t[0]);
          if (i >= 0) cur.splice(i, 1); else cur.push(t[0]);
          store.set('filters', cur); drawTags(); updateCount();
        } }, t[1]));
      });
    }
    const countEl = h('p', { class: 'sub', 'aria-live': 'polite' });
    function updateCount() {
      const f = store.settings().filters;
      const n = CN.data.entries.filter(function (e) { return !f.length || e.tags.some(function (t) { return f.indexOf(t) >= 0; }); }).length;
      countEl.textContent = (f.length ? 'Filtri attivi: ' : 'Nessun filtro: ') + n + ' voci negli esercizi (in Ascolto solo quelle pronunciabili).';
    }

    dlg.append(h('div', { class: 'dlg-body' },
      h('div', { class: 'dlg-head' }, h('h2', null, 'Impostazioni'), h('button', { type: 'button', class: 'btn btn-quiet', onClick: function () { dlg.close(); } }, 'Chiudi')),
      h('section', null, h('h3', null, 'Esercizi'),
        toggle('Ignora i toni nel pinyin', 'ignoreTones', 'Accetta «nihao» al posto di «nǐhǎo».'),
        toggle('Ripasso intelligente', 'smart', 'Le voci che sbagli di più escono più spesso.'),
        toggle('Pronuncia dopo la risposta nelle flashcard', 'autoSpeak'),
        select('Domande per sessione', 'session', [[5, '5'], [10, '10'], [20, '20'], [30, '30'], [0, 'Senza fine']], true),
        select('Obiettivo giornaliero', 'dailyGoal', [[0, 'Nessuno'], [10, '10 risposte'], [20, '20 risposte'], [30, '30 risposte'], [50, '50 risposte']], true)),
      h('section', null, h('h3', null, 'Voce'),
        sp.supported ? null : h('p', { class: 'sub' }, 'Questo browser non supporta la sintesi vocale.'),
        h('label', { class: 'row sel' }, h('span', null, 'Voce cinese'), voiceSel),
        h('label', { class: 'row sel' }, h('span', null, 'Velocità'),
          h('input', { type: 'range', min: '0.5', max: '1.2', step: '0.05', value: String(s.rate), 'aria-label': 'Velocità della voce', onChange: function (ev) { store.set('rate', Number(ev.target.value)); } })),
        h('button', { type: 'button', class: 'btn btn-small btn-ghost', onClick: function () { CN.speech.speak('你好，我说中文', {}); } }, icon('speaker', 16), ' Prova la voce')),
      h('section', null, h('h3', null, 'Cosa studiare'),
        h('p', { class: 'sub' }, 'Vale per Ascolto e Flashcard. Se non scegli nulla, c’è tutto.'),
        tagBtns, countEl,
        h('button', { type: 'button', class: 'btn btn-small btn-quiet', onClick: function () { store.set('filters', []); drawTags(); updateCount(); } }, 'Togli i filtri')),
      h('section', null, CN.stats.dataTools())));
    drawTags(); updateCount();
    dlg.showModal();
  }

  /* ---------- avvio ---------- */
  function refresh() { show(); }

  function init() {
    applyTheme();
    if (mq && mq.addEventListener) mq.addEventListener('change', function () { applyTheme(); syncTools(); });
    buildChrome();
    root.addEventListener('hashchange', show);
    ['settings', 'detail'].forEach(function (id) {
      const d = document.getElementById(id);
      d.addEventListener('click', function (ev) { if (ev.target === d) d.close(); });
    });
    document.getElementById('settings').addEventListener('close', function () {
      syncTools();
      if (snapshot() !== settingsBefore) show(); // riparte solo se è cambiato qualcosa che conta
    });
    show();
  }

  CN.app = { init: init, openSettings: openSettings, refresh: refresh };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})(window);
