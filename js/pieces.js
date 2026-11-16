/* Modalità Pezzi: riconoscere i componenti dei caratteri (significato + suono).
 * Risposta a scelta multipla; si può sempre scegliere «Mi arrendo». */
(function (root) {
  'use strict';
  const CN = root.CN = root.CN || {};

  const TYPES = [
    { id: 'sound', label: 'Suono', desc: 'Quale pezzo dà il suono al carattere' },
    { id: 'sense', label: 'Significato', desc: 'Quale pezzo dà il significato al carattere' },
    { id: 'compose', label: 'Composizione', desc: 'Con quali pezzi si scrive il carattere' },
    { id: 'build', label: 'Costruzione', desc: 'Quale carattere nasce unendo i pezzi' },
    { id: 'pmean', label: 'Pezzo → significato', desc: 'Che cosa significa un pezzo' },
    { id: 'pfind', label: 'Significato → pezzo', desc: 'Quale pezzo ha un certo significato' }
  ];
  const PROMPT = {
    sound: 'Quale pezzo dà il suono a questo carattere?',
    sense: 'Quale pezzo dà il significato a questo carattere?',
    compose: 'Con quali pezzi si scrive questo carattere?',
    build: 'Quale carattere nasce unendo questi pezzi?',
    pmean: 'Che cosa significa questo pezzo?',
    pfind: 'Quale pezzo significa questo?'
  };

  function mount(host, opts) {
    const h = CN.u.h, icon = CN.u.icon;
    const store = CN.store;
    const data = CN.data;

    const comps = data.compounds;
    const phon = comps.filter(function (c) { return c.kind === 'phonetic'; });
    const pieceEntries = data.entries.filter(function (e) { return e.tags.indexOf('piece') >= 0; });
    const pieceHanzi = pieceEntries.map(function (e) { return e.hanzi; });
    const pieceByHanzi = {};
    pieceEntries.forEach(function (e) { pieceByHanzi[e.hanzi] = e; });

    const soundPool = [];
    phon.forEach(function (c) {
      const s = c.parts[1];
      if (!soundPool.some(function (x) { return x.hanzi === s.hanzi; })) soundPool.push(s);
    });
    const sensePool = [];
    phon.forEach(function (c) { if (sensePool.indexOf(c.parts[0].hanzi) < 0) sensePool.push(c.parts[0].hanzi); });
    pieceHanzi.forEach(function (x) { if (sensePool.indexOf(x) < 0) sensePool.push(x); });

    const itemsFor = {
      sound: phon, sense: phon, compose: comps, build: comps, pmean: pieceEntries, pfind: pieceEntries
    };

    const view = h('div', { class: 'practice' });
    host.appendChild(view);
    let sess = { n: 0, r: 0, w: 0, g: 0 };
    let q = null;
    let recent = [];
    let strokeCtrl = null;
    let dead = false;

    function enabledTypes() {
      const t = store.settings().pieceTypes.filter(function (x) { return TYPES.some(function (y) { return y.id === x; }); });
      return t.length ? t : TYPES.map(function (x) { return x.id; });
    }

    function sample(list, n, ok) {
      return CN.u.shuffle(list.filter(ok || function () { return true; })).slice(0, n);
    }
    function meaningChunks(e) { return e.meaning.split(',').map(function (s) { return s.trim(); }); }
    function sharesMeaning(a, b) {
      const x = meaningChunks(a);
      return meaningChunks(b).some(function (m) { return x.indexOf(m) >= 0; });
    }

    /* ---------- creazione della domanda ---------- */
    function composeDistractors(c) {
      const correct = c.parts.map(function (p) { return p.hanzi; }).join(' + ');
      const seen = [correct], out = [];
      let tries = 0;
      while (out.length < 3 && tries++ < 80) {
        let parts = c.parts.map(function (p) { return p.hanzi; });
        if (c.kind === 'phonetic') {
          const m = tries % 3;
          if (m === 0 || m === 2) parts[0] = CN.u.pick(sensePool.filter(function (s) { return s !== c.parts[0].hanzi; }));
          if (m === 1 || m === 2) parts[1] = CN.u.pick(soundPool.filter(function (s) { return s.hanzi !== c.parts[1].hanzi; })).hanzi;
        } else {
          const i = Math.floor(Math.random() * parts.length);
          parts[i] = CN.u.pick(pieceHanzi.filter(function (x) { return x !== c.parts[i].hanzi; }));
        }
        const s = parts.join(' + ');
        if (seen.indexOf(s) < 0) { seen.push(s); out.push(s); }
      }
      return { correct: correct, wrong: out };
    }

    function makeQuestion(type, item) {
      const key = type + ':' + item.id;
      let correct, wrong, kind = 'hanzi', subject = null, subline = '', result = null, partsRow = null, meaningCard = null;

      if (type === 'sound') {
        correct = item.parts[1].hanzi;
        wrong = sample(soundPool, 3, function (s) { return s.hanzi !== correct; }).map(function (s) { return s.hanzi; });
        subject = item.hanzi; subline = item.pinyin; result = item;
      } else if (type === 'sense') {
        correct = item.parts[0].hanzi;
        wrong = sample(sensePool, 3, function (s) { return s !== correct; });
        subject = item.hanzi; subline = item.pinyin; result = item;
      } else if (type === 'compose') {
        const d = composeDistractors(item);
        correct = d.correct; wrong = d.wrong; kind = 'parts';
        subject = item.hanzi; subline = item.pinyin + (item.meaning ? ' · ' + item.meaning : ''); result = item;
      } else if (type === 'build') {
        correct = item.hanzi;
        const same = comps.filter(function (c) { return c.id !== item.id && c.kind === item.kind; });
        const pool = same.length >= 3 ? same : comps.filter(function (c) { return c.id !== item.id; });
        wrong = sample(pool, 3).map(function (c) { return c.hanzi; });
        partsRow = item.parts.map(function (p) { return p.hanzi; });
        result = item;
      } else if (type === 'pmean') {
        correct = item.meaning; kind = 'text';
        wrong = sample(pieceEntries, 3, function (e) { return e.id !== item.id && !sharesMeaning(item, e); })
          .map(function (e) { return e.meaning; });
        subject = item.hanzi; subline = item.pinyin; result = item;
      } else { // pfind
        correct = item.hanzi;
        wrong = sample(pieceEntries, 3, function (e) { return e.id !== item.id && !sharesMeaning(item, e); })
          .map(function (e) { return e.hanzi; });
        meaningCard = item.meaning; result = item;
      }
      const options = CN.u.shuffle([correct].concat(wrong)).map(function (v) { return { id: v, label: v }; });
      return {
        type: type, item: item, key: key, kind: kind, options: options, correct: correct,
        subject: subject, subline: subline, partsRow: partsRow, meaningCard: meaningCard, result: result,
        done: false, outcome: null, chosen: null
      };
    }

    function pickQuestion() {
      const cands = [];
      enabledTypes().forEach(function (t) {
        itemsFor[t].forEach(function (it) { cands.push({ type: t, item: it, key: t + ':' + it.id }); });
      });
      const keep = Math.min(6, Math.floor(cands.length / 2));
      const bad = recent.slice(-keep);
      const list = cands.filter(function (c) { return bad.indexOf(c.key) < 0; });
      const use = list.length ? list : cands;
      const c = store.settings().smart
        ? CN.u.pickWeighted(use, function (x) { return store.weight('pezzi', x.key); })
        : CN.u.pick(use);
      recent.push(c.key);
      return makeQuestion(c.type, c.item);
    }

    /* ---------- vista ---------- */
    function stopStrokes() { if (strokeCtrl) { strokeCtrl.destroy(); strokeCtrl = null; } }

    function cell(ch, size) {
      return h('div', {
        class: 'stroke-cell static-hanzi',
        style: 'width:' + size + 'px;height:' + size + 'px;font-size:' + Math.round(size * 0.78) + 'px'
      }, ch);
    }

    function head() {
      const limit = store.settings().session;
      return h('div', { class: 'p-head' },
        h('h1', { class: 'p-title' }, icon('pieces', 22), 'Pezzi'),
        h('div', { class: 'p-counters', 'aria-label': 'Risultati della sessione' },
          h('span', { class: 'cnt cnt-r', title: 'Giuste' }, icon('check', 16), ' ', sess.r),
          h('span', { class: 'cnt cnt-w', title: 'Sbagliate' }, icon('cross', 16), ' ', sess.w),
          h('span', { class: 'cnt cnt-g', title: 'Arrese' }, icon('flag', 16), ' ', sess.g),
          h('span', { class: 'cnt cnt-n' }, limit ? Math.min(sess.n + (q && !q.done ? 1 : 0), limit) + '/' + limit : sess.n)),
        limit ? h('div', { class: 'p-progress', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': limit, 'aria-valuenow': sess.n },
          h('span', { style: 'width:' + CN.u.pct(sess.n, limit) + '%' })) : null);
    }

    function typeChips() {
      const on = enabledTypes();
      const row = h('div', { class: 'chips' }, TYPES.map(function (t) {
        const active = on.indexOf(t.id) >= 0;
        return h('button', {
          type: 'button', class: 'chip-toggle', 'aria-pressed': active ? 'true' : 'false', title: t.desc,
          onClick: function () {
            let cur = enabledTypes();
            if (cur.indexOf(t.id) >= 0) { if (cur.length === 1) { CN.u.toast('Tieni almeno un tipo di domanda.'); return; } cur = cur.filter(function (x) { return x !== t.id; }); }
            else cur = cur.concat([t.id]);
            store.set('pieceTypes', cur);
            if (!q || q.done) next(); else { recent = []; next(); }
          }
        }, t.label);
      }));
      return h('details', { class: 'keys types' },
        h('summary', null, 'Tipi di domanda (' + on.length + ' su ' + TYPES.length + ')'), row);
    }

    function renderSummary() {
      stopStrokes();
      CN.u.clear(view);
      view.append(h('section', { class: 'sheet summary' },
        h('h1', { class: 'p-title' }, icon('check', 22), 'Sessione finita'),
        h('p', { class: 'sum-big' }, CN.u.pct(sess.r, sess.n) + '% giuste'),
        h('p', { class: 'sum-line' }, sess.r + ' giuste, ' + sess.w + ' sbagliate, ' + sess.g + ' arrese su ' + sess.n + ' domande.'),
        h('div', { class: 'actions' },
          h('button', { class: 'btn btn-primary', type: 'button', onClick: function () { sess = { n: 0, r: 0, w: 0, g: 0 }; recent = []; next(); } }, 'Nuova sessione'),
          h('a', { class: 'btn btn-quiet', href: '#/statistiche' }, 'Vedi le statistiche'))));
    }

    function next() {
      if (dead) return;
      const limit = store.settings().session;
      if (limit && sess.n >= limit) return renderSummary();
      q = pickQuestion();
      render();
    }

    function render() {
      stopStrokes();
      CN.u.clear(view);
      const avail = Math.min(560, root.innerWidth - 72);
      const stage = h('div', { class: 'stage stage-pieces' });
      if (q.partsRow) {
        const n = q.partsRow.length;
        const size = Math.max(64, Math.min(120, Math.floor((avail - (n - 1) * 30) / n)));
        const row = h('div', { class: 'compose-row' });
        q.partsRow.forEach(function (p, i) {
          if (i) row.append(h('span', { class: 'plus', 'aria-hidden': 'true' }, '+'));
          row.append(cell(p, size));
        });
        stage.append(row);
      } else if (q.meaningCard) {
        stage.append(h('div', { class: 'meaning-card' }, q.meaningCard));
      } else {
        const host2 = h('div', { class: 'stroke-host' });
        host2.append(cell(q.subject, Math.min(150, avail)));
        stage.append(host2, h('p', { class: 'stage-line' }, q.subline));
      }
      q.stage = stage;

      const opts = h('div', { class: 'opts', role: 'group', 'aria-label': 'Risposte' },
        q.options.map(function (o, i) {
          return h('button', {
            type: 'button', class: 'opt' + (q.kind === 'text' ? ' opt-text' : ''), 'data-id': o.id,
            onClick: function () { choose(o.id); }
          }, h('span', { class: 'opt-key' }, i + 1), h('span', { class: 'opt-label' + (q.kind === 'text' ? '' : ' hz') }, o.label), h('span', { class: 'opt-mark', 'aria-hidden': 'true' }));
        }));
      q.opts = opts;
      q.actions = h('div', { class: 'actions' });

      q.sheet = h('section', { class: 'sheet' },
        h('div', { class: 'sheet-top' }, h('span', { class: 'chip' }, TYPES.filter(function (t) { return t.id === q.type; })[0].label)),
        stage,
        h('p', { class: 'q-prompt' }, PROMPT[q.type]),
        opts, q.actions);
      view.append(head(), typeChips(), q.sheet);
      renderActions();
    }

    function renderActions() {
      CN.u.clear(q.actions);
      if (q.done) {
        const b = h('button', { class: 'btn btn-primary', type: 'button', onClick: next }, 'Avanti ', icon('arrow', 18));
        q.actions.append(b, h('button', { class: 'btn btn-quiet', type: 'button', onClick: renderSummary }, 'Termina'));
        b.focus();
      } else {
        q.actions.append(h('button', { class: 'btn btn-ghost', type: 'button', onClick: giveUp }, icon('flag', 16), ' Mi arrendo'));
      }
    }

    function choose(id) {
      if (q.done) return;
      q.chosen = id;
      resolve(id === q.correct ? 'r' : 'w');
    }
    function giveUp() { if (!q.done) resolve('g'); }

    function decomp(c) {
      const wrap = h('div', { class: 'decomp' });
      c.parts.forEach(function (p, i) {
        if (i) wrap.append(h('span', { class: 'plus', 'aria-hidden': 'true' }, '+'));
        wrap.append(h('span', { class: 'ptag' },
          h('span', { class: 'hz' }, p.hanzi), ' ',
          h('span', { class: 'ptag-py' }, p.pinyin || ''),
          p.role ? h('span', { class: 'ptag-role' }, p.role === 'sense' ? 'significato' : 'suono') : null));
      });
      wrap.append(h('span', { class: 'plus', 'aria-hidden': 'true' }, '='),
        h('span', { class: 'ptag ptag-result' }, h('span', { class: 'hz' }, c.hanzi), ' ', h('span', { class: 'ptag-py' }, c.pinyin)));
      return wrap;
    }

    function resolve(outcome) {
      q.done = true; q.outcome = outcome;
      store.record('pezzi', q.key, outcome);
      sess.n++; sess[outcome]++;

      Array.prototype.forEach.call(q.opts.querySelectorAll('.opt'), function (b) {
        const id = b.getAttribute('data-id');
        b.disabled = true;
        if (id === q.correct) { b.classList.add(outcome === 'g' ? 'opt-shown' : 'opt-correct'); b.querySelector('.opt-mark').textContent = outcome === 'g' ? '⚑' : '✓'; }
        else if (id === q.chosen) { b.classList.add('opt-wrong'); b.querySelector('.opt-mark').textContent = '✗'; }
      });

      const text = {
        r: ['Giusto.', 'banner-r', 'check'],
        w: ['Non è questa: la risposta giusta è evidenziata.', 'banner-w', 'cross'],
        g: ['Ti sei arreso: la risposta giusta è evidenziata.', 'banner-g', 'flag']
      }[outcome];
      const banner = h('div', { class: 'banner ' + text[1], role: 'status' }, icon(text[2], 20), text[0]);

      const r = q.result;
      const isComp = q.type !== 'pmean' && q.type !== 'pfind';
      const reveal = h('div', { class: 'reveal' },
        isComp ? decomp(r) : h('div', { class: 'rv-line' }, h('span', { class: 'hz big-inline' }, r.hanzi), h('span', { class: 'rv-pinyin' }, r.pinyin)),
        r.meaning ? h('p', { class: 'rv-meaning' }, r.meaning) : null,
        !isComp && r.note ? h('p', { class: 'rv-note' }, 'Nota: ' + r.note) : null);
      q.sheet.insertBefore(banner, q.stage);
      q.sheet.insertBefore(reveal, q.actions);

      // Anima il carattere (o il pezzo) risultante.
      const target = q.result.hanzi;
      CN.u.clear(q.stage);
      const cells = h('div', { class: 'stroke-host' });
      q.stage.append(cells);
      strokeCtrl = CN.strokes.mount(cells, target, { animate: true, size: Math.min(130, Math.min(560, root.innerWidth - 72)) });
      const ctrlNow = strokeCtrl, stageNow = q.stage;
      ctrlNow.ready.then(function (ok) {
        if (!ok || dead || strokeCtrl !== ctrlNow) return;
        stageNow.append(h('div', { class: 'play-row' },
          h('button', { class: 'btn btn-small btn-ghost', type: 'button', onClick: function () { ctrlNow.replay(); } }, icon('brush', 16), ' Rivedi i tratti')));
      });

      renderActions();
      const c = view.querySelector('.p-counters');
      if (c) c.replaceWith(head().querySelector('.p-counters'));
      const pr = view.querySelector('.p-progress');
      const limit = store.settings().session;
      if (pr && limit) pr.firstChild.style.width = CN.u.pct(sess.n, limit) + '%';
    }

    function onKey(ev) {
      if (dead || !q || ev.ctrlKey || ev.metaKey || ev.altKey) return;
      if (/^[1-4]$/.test(ev.key) && !q.done) {
        const o = q.options[+ev.key - 1];
        if (o) { ev.preventDefault(); choose(o.id); }
      }
    }
    document.addEventListener('keydown', onKey);

    next();

    return {
      destroy: function () {
        dead = true; stopStrokes();
        document.removeEventListener('keydown', onKey);
        CN.u.clear(view); view.remove();
      }
    };
  }

  CN.pieces = { mount: mount, TYPES: TYPES };
})(window);
