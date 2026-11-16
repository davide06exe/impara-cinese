/* Ascolto (senti la parola, scrivi il pinyin) e Flashcard (vedi il carattere, scrivi pinyin e significato).
 * Un solo motore per entrambe: cambia solo cosa si vede e quali campi ci sono. */
(function (root) {
  'use strict';
  const CN = root.CN = root.CN || {};
  const M = CN.match;
  const overrides = {};
  const LABEL = { char: 'Carattere', particle: 'Particella', word: 'Parola', piece: 'Pezzo' };

  function insertAt(input, text) {
    const s = input.selectionStart == null ? input.value.length : input.selectionStart;
    const e = input.selectionEnd == null ? s : input.selectionEnd;
    input.value = input.value.slice(0, s) + text + input.value.slice(e);
    const p = s + text.length;
    input.focus();
    input.setSelectionRange(p, p);
  }

  /** Tastiera pinyin: vocali con i quattro toni, da toccare per inserirle. */
  function pinyinKeys(getInput) {
    const h = CN.u.h;
    const rows = ['a', 'e', 'i', 'o', 'u', 'ü'].map(function (v) {
      return h('div', { class: 'key-row' },
        [v].concat(CN.match.MARKS[v]).map(function (ch) {
          return h('button', {
            type: 'button', class: 'key', 'aria-label': ch,
            onMousedown: function (ev) { ev.preventDefault(); },
            onClick: function () { const i = getInput(); if (i && !i.readOnly) insertAt(i, ch); }
          }, ch);
        }));
    });
    return h('details', { class: 'keys' },
      h('summary', null, CN.u.icon('keyboard', 18), ' Tastiera pinyin'),
      h('div', { class: 'keys-body' }, rows),
      h('p', { class: 'hint' }, 'Puoi anche scrivere i toni con i numeri: ni3hao3 diventa nǐhǎo, e v vale ü (nv3 = nǚ).'));
  }

  function mount(host, mode) {
    const h = CN.u.h, icon = CN.u.icon;
    const store = CN.store;
    const data = CN.data;
    const isListen = mode === 'listen';
    const byId = {};
    data.entries.forEach(function (e) { byId[e.id] = e; });
    const override = overrides[mode] || null;
    overrides[mode] = null;

    const view = h('div', { class: 'practice' });
    host.appendChild(view);

    let sess = { n: 0, r: 0, w: 0, g: 0, wrong: [] };
    let q = null;
    let recent = [];
    let strokeCtrl = null;
    let dead = false;
    let pool = [];
    let restrict = override; // ids da ripassare (sessione "solo errori")

    /* ---------- pool e scelta della prossima voce ---------- */
    function buildPool() {
      let list;
      if (restrict) list = restrict.map(function (id) { return byId[id]; }).filter(Boolean);
      else {
        const f = store.settings().filters;
        list = data.entries.filter(function (e) {
          return !f.length || e.tags.some(function (t) { return f.indexOf(t) >= 0; });
        });
      }
      return isListen ? list.filter(function (e) { return e.speak; }) : list;
    }
    function pickNext() {
      const keep = Math.min(4, Math.floor(pool.length / 2));
      const bad = recent.slice(-keep);
      const cand = pool.filter(function (e) { return bad.indexOf(e.id) < 0; });
      const list = cand.length ? cand : pool;
      return store.settings().smart
        ? CN.u.pickWeighted(list, function (e) { return store.weight(mode, e.id); })
        : CN.u.pick(list);
    }

    function cellSize(n) {
      const avail = Math.min(560, root.innerWidth - 72);
      return Math.max(64, Math.min(170, Math.floor((avail - (n - 1) * 8) / n)));
    }
    function staticCells(el, text) {
      const chars = Array.from(text);
      const size = cellSize(chars.length);
      el.textContent = '';
      el.className = 'stroke-host';
      chars.forEach(function (ch) {
        el.appendChild(h('div', {
          class: 'stroke-cell static-hanzi',
          style: 'width:' + size + 'px;height:' + size + 'px;font-size:' + Math.round(size * 0.78) + 'px'
        }, ch));
      });
    }
    function stopStrokes() { if (strokeCtrl) { strokeCtrl.destroy(); strokeCtrl = null; } }

    /* ---------- flusso ---------- */
    function next() {
      if (dead) return;
      pool = buildPool();
      const limit = store.settings().session;
      if (!pool.length) return renderEmpty();
      if (limit && sess.n >= limit) return renderSummary();
      const e = pickNext();
      recent.push(e.id);
      q = { entry: e, fields: [], done: false, outcome: null };
      renderQuestion();
    }
    function restart(onlyIds) {
      sess = { n: 0, r: 0, w: 0, g: 0, wrong: [] };
      recent = [];
      restrict = onlyIds || null;
      next();
    }

    function head() {
      const limit = store.settings().session;
      const title = isListen ? 'Ascolto' : 'Flashcard';
      return h('div', { class: 'p-head' },
        h('h1', { class: 'p-title' }, icon(isListen ? 'ear' : 'cards', 22), title),
        h('div', { class: 'p-counters', 'aria-label': 'Risultati della sessione' },
          h('span', { class: 'cnt cnt-r', title: 'Giuste' }, icon('check', 16), ' ', sess.r),
          h('span', { class: 'cnt cnt-w', title: 'Sbagliate' }, icon('cross', 16), ' ', sess.w),
          h('span', { class: 'cnt cnt-g', title: 'Arrese' }, icon('flag', 16), ' ', sess.g),
          limit ? h('span', { class: 'cnt cnt-n' }, Math.min(sess.n + (q && !q.done ? 1 : 0), limit) + '/' + limit) : h('span', { class: 'cnt cnt-n' }, sess.n)),
        limit ? h('div', { class: 'p-progress', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': limit, 'aria-valuenow': sess.n },
          h('span', { style: 'width:' + CN.u.pct(sess.n, limit) + '%' })) : null);
    }

    function renderEmpty() {
      stopStrokes();
      CN.u.clear(view);
      view.append(head(), h('section', { class: 'sheet empty' },
        h('p', null, restrict ? 'Non ci sono voci da ripassare.' : (isListen ? 'Con i filtri attuali non ci sono parole da ascoltare.' : 'Con i filtri attuali non ci sono voci.')),
        h('div', { class: 'actions' },
          h('button', { class: 'btn btn-primary', type: 'button', onClick: function () { CN.app.openSettings(); } }, 'Apri i filtri'),
          restrict ? h('button', { class: 'btn btn-ghost', type: 'button', onClick: function () { restart(null); } }, 'Torna a tutte le voci') : null)));
    }

    function renderSummary() {
      stopStrokes();
      CN.u.clear(view);
      const acc = CN.u.pct(sess.r, sess.n);
      view.append(h('section', { class: 'sheet summary' },
        h('h1', { class: 'p-title' }, icon('check', 22), 'Sessione finita'),
        h('p', { class: 'sum-big' }, acc + '% giuste al primo tentativo'),
        h('p', { class: 'sum-line' }, sess.r + ' giuste, ' + sess.w + ' sbagliate, ' + sess.g + ' arrese su ' + sess.n + ' domande.'),
        h('div', { class: 'actions' },
          h('button', { class: 'btn btn-primary', type: 'button', onClick: function () { restart(null); } }, 'Nuova sessione'),
          sess.wrong.length ? h('button', { class: 'btn btn-ghost', type: 'button', onClick: function () { restart(sess.wrong.slice()); } }, 'Ripassa gli errori (' + sess.wrong.length + ')') : null,
          h('a', { class: 'btn btn-quiet', href: '#/statistiche' }, 'Vedi le statistiche'))));
    }

    /* ---------- domanda ---------- */
    function renderQuestion() {
      stopStrokes();
      CN.u.clear(view);
      const e = q.entry;
      const defs = isListen
        ? [{ id: 'pinyin', kind: 'pinyin', label: 'Pinyin', ph: 'Scrivi il pinyin (es. nǐhǎo o ni3hao3)' }]
        : [{ id: 'pinyin', kind: 'pinyin', label: 'Pinyin', ph: 'Es. nǐhǎo o ni3hao3' },
           { id: 'meaning', kind: 'meaning', label: 'Significato', ph: 'Che cosa significa?' }];

      q.fields = defs.map(function (d) {
        const input = h('input', {
          class: 'inp' + (d.kind === 'pinyin' ? ' inp-pinyin' : ''), type: 'text', id: 'f-' + d.id, name: d.id,
          autocomplete: 'off', autocapitalize: 'none', autocorrect: 'off', spellcheck: 'false',
          placeholder: d.ph, enterkeyhint: 'done'
        });
        const ico = h('span', { class: 'f-ico', 'aria-hidden': 'true' });
        const msg = h('div', { class: 'f-msg', 'aria-live': 'polite' });
        const row = h('div', { class: 'field' },
          h('label', { for: 'f-' + d.id }, d.label),
          h('div', { class: 'inp-wrap' }, input, ico), msg);
        input.addEventListener('keydown', function (ev) {
          if (ev.key === 'Enter' && !ev.isComposing) { ev.preventDefault(); if (q.done) next(); else check(); }
        });
        input.addEventListener('input', function () {
          if (f.state === 'bad') { f.state = 'idle'; row.className = 'field'; ico.textContent = ''; msg.textContent = ''; }
        });
        const f = { def: d, input: input, ico: ico, msg: msg, row: row, state: 'idle', bad: 0, overridden: false };
        return f;
      });

      const stage = h('div', { class: 'stage' });
      if (isListen) {
        stage.append(
          h('button', { class: 'play-big', type: 'button', 'aria-label': 'Ascolta la parola', onClick: function () { say(false); } }, icon('speaker', 44)),
          h('div', { class: 'play-row' },
            h('button', { class: 'btn btn-small btn-ghost', type: 'button', onClick: function () { say(false); } }, icon('speaker', 16), ' Riascolta'),
            h('button', { class: 'btn btn-small btn-ghost', type: 'button', onClick: function () { say(true); } }, icon('turtle', 16), ' Più lento')));
      } else {
        const cells = h('div', { class: 'stroke-host', 'data-role': 'cells' });
        staticCells(cells, e.hanzi);
        stage.append(cells);
      }

      const hint = h('div', { class: 'f-hint', 'aria-live': 'polite' });
      const form = h('form', { class: 'fields', novalidate: true, onSubmit: function (ev) { ev.preventDefault(); if (q.done) next(); else check(); } },
        q.fields.map(function (f) { return f.row; }),
        h('label', { class: 'switch small' },
          h('input', { type: 'checkbox', checked: store.settings().ignoreTones ? true : null, onChange: function (ev) { store.set('ignoreTones', ev.target.checked); } }),
          h('span', null, 'Ignora i toni')),
        hint,
        pinyinKeys(function () { return q.fields[0].input; }));
      q.hint = hint;
      q.form = form;

      const actions = h('div', { class: 'actions', 'data-role': 'actions' });
      q.actions = actions;
      q.stage = stage;

      const sheet = h('section', { class: 'sheet' },
        h('div', { class: 'sheet-top' },
          h('span', { class: 'chip' }, isListen ? 'Ascolta e scrivi' : LABEL[e.type] || 'Voce'),
          isListen ? null : (e.tags.indexOf('memo') >= 0 ? h('span', { class: 'chip chip-memo' }, 'Da imparare a memoria') : null)),
        stage, form, actions);
      q.sheet = sheet;

      const sp = CN.speech.status();
      const voiceNote = isListen && !sp.hasChinese ? h('div', { class: 'p-note', role: 'note' },
        h('strong', null, 'Nessuna voce cinese trovata. '),
        'Prova con Microsoft Edge, che ha voci cinesi online già pronte. In alternativa installa la lingua Cinese (semplificato) con la sintesi vocale da Impostazioni › Ora e lingua.') : null;

      [head(), voiceNote, sheet].forEach(function (x) { if (x) view.append(x); });
      renderActions();
      if (isListen) setTimeout(function () { if (!dead && q && !q.done) { say(false, true); } }, 250);
      q.fields[0].input.focus({ preventScroll: true });
    }

    function renderActions() {
      CN.u.clear(q.actions);
      if (q.done) {
        const btn = h('button', { class: 'btn btn-primary', type: 'button', onClick: next }, 'Avanti ', icon('arrow', 18));
        q.actions.append(btn,
          h('button', { class: 'btn btn-quiet', type: 'button', onClick: renderSummary }, 'Termina'));
        btn.focus();
      } else {
        q.actions.append(
          h('button', { class: 'btn btn-primary', type: 'button', onClick: check }, 'Verifica'),
          h('button', { class: 'btn btn-ghost', type: 'button', onClick: giveUp }, icon('flag', 16), ' Arrenditi'));
      }
    }

    function say(slow, quiet) { CN.speech.speak(q.entry.hanzi, { slow: slow }).then(function (ok) { if (!ok && !quiet && !CN.speech.status().hasChinese) CN.u.toast('Nessuna voce cinese disponibile su questo dispositivo.'); }); }

    /* ---------- verifica ---------- */
    function setState(f, state) {
      f.state = state;
      f.row.className = 'field' + (state === 'ok' ? ' ok' : state === 'bad' ? ' bad' : state === 'shown' ? ' shown' : '');
      f.ico.textContent = state === 'ok' ? '✓' : state === 'bad' ? '✗' : state === 'shown' ? '⚑' : '';
      f.input.readOnly = state === 'ok' || state === 'shown';
      f.input.setAttribute('aria-invalid', state === 'bad' ? 'true' : 'false');
    }

    function evalField(f) {
      const e = q.entry;
      const value = f.input.value;
      CN.u.clear(f.msg);
      if (f.def.kind === 'pinyin') {
        const res = M.checkPinyin(value, e.pinyin, { ignoreTones: store.settings().ignoreTones, sandhi: true, alts: e.altPinyin });
        if (res.status === 'correct') {
          setState(f, 'ok');
          if (res.exact === false) f.msg.append('Con i toni: ' + e.pinyin);
        } else {
          f.bad++;
          setState(f, 'bad');
          if (res.status === 'toneOnly') {
            f.msg.append('Le lettere ci sono, ma i toni no. Controlla ogni sillaba.');
          } else {
            const diff = M.compareSyllables(value, e.pinyin);
            if (diff && diff.some(function (s) { return s.state !== 'wrong'; })) {
              f.msg.append('Sillabe: ', h('span', { class: 'syls' }, diff.map(function (s) {
                return h('span', { class: 'syl syl-' + s.state },
                  s.state === 'ok' ? s.got + ' ✓' : s.state === 'tone' ? s.got + ' (tono?)' : s.got + ' ✗');
              })));
            } else if (diff) f.msg.append('Nessuna sillaba corrisponde.');
            else f.msg.append('Non è questo. Conta le sillabe e riprova.');
          }
        }
      } else {
        const res = M.checkMeaning(value, e.answers, store.synonyms(e.id));
        if (res.status === 'correct') setState(f, 'ok');
        else {
          f.bad++;
          setState(f, 'bad');
          f.msg.append(res.partial ? 'Una parte è giusta, ma non tutto. ' : 'Non corrisponde. ',
            h('button', {
              type: 'button', class: 'linklike',
              onClick: function () { overrideMeaning(f); }
            }, 'Era giusto lo stesso'));
        }
      }
    }

    function anyWrong() {
      return q.fields.some(function (f) { return f.bad > 0 && !f.overridden; });
    }

    function check() {
      if (q.done) return;
      const open = q.fields.filter(function (f) { return f.state !== 'ok'; });
      const empty = open.filter(function (f) { return !f.input.value.trim(); });
      if (empty.length) {
        empty[0].input.focus();
        q.hint.textContent = empty.length === open.length && q.fields.length === open.length
          ? 'Scrivi la risposta, oppure arrenditi.' : 'Manca ancora un campo.';
        return;
      }
      q.hint.textContent = '';
      open.forEach(evalField);
      if (q.fields.every(function (f) { return f.state === 'ok'; })) resolve(anyWrong() ? 'w' : 'r');
      else {
        const bad = q.fields.filter(function (f) { return f.state === 'bad'; })[0];
        if (bad) { bad.input.focus(); bad.input.select(); }
      }
    }

    function overrideMeaning(f) {
      if (q.done) return;
      store.addSynonym(q.entry.id, f.input.value);
      f.overridden = true;
      CN.u.clear(f.msg);
      setState(f, 'ok');
      CN.u.toast('Ricorderò la tua risposta come corretta.');
      if (q.fields.every(function (x) { return x.state === 'ok'; })) resolve(anyWrong() ? 'w' : 'r');
    }

    function giveUp() {
      if (q.done) return;
      q.fields.forEach(function (f) {
        if (f.state === 'ok') return;
        f.input.value = f.def.kind === 'pinyin' ? q.entry.pinyin : q.entry.meaning;
        CN.u.clear(f.msg);
        setState(f, 'shown');
      });
      resolve('g');
    }

    /* ---------- risultato ---------- */
    function resolve(outcome) {
      if (q.done) return;
      q.done = true;
      q.outcome = outcome;
      const e = q.entry;
      store.record(mode, e.id, outcome);
      sess.n++; sess[outcome]++;
      if (outcome !== 'r' && sess.wrong.indexOf(e.id) < 0) sess.wrong.push(e.id);

      const text = {
        r: ['Giusto al primo tentativo.', 'banner-r', 'check'],
        w: ['Ci sei arrivato, ma non al primo tentativo: conta come sbagliata.', 'banner-w', 'cross'],
        g: ['Ti sei arreso: ecco la risposta.', 'banner-g', 'flag']
      }[outcome];
      const banner = h('div', { class: 'banner ' + text[1], role: 'status' }, icon(text[2], 20), text[0]);

      const sandhi = M.sandhiVariants(e.pinyin);
      const reveal = h('div', { class: 'reveal' },
        h('div', { class: 'rv-line' },
          h('span', { class: 'rv-pinyin' }, e.pinyin),
          e.altPinyin && e.altPinyin.length ? h('span', { class: 'rv-alt' }, '(anche ' + e.altPinyin.join(', ') + ')') : null,
          h('button', { class: 'btn btn-small btn-ghost', type: 'button', onClick: function () { say(false); } }, icon('speaker', 16), ' Ascolta'),
          h('button', { class: 'btn btn-small btn-ghost', type: 'button', onClick: function () { say(true); } }, icon('turtle', 16), ' Lento')),
        h('p', { class: 'rv-meaning' }, e.meaning),
        e.note ? h('p', { class: 'rv-note' }, 'Nota: ' + e.note) : null,
        sandhi.length ? h('p', { class: 'rv-note' }, 'Due toni 3 di fila: nel parlato il primo suona come tono 2 (' + sandhi[0] + '). Accetto entrambe le forme.') : null,
        e.group ? h('p', { class: 'rv-note' }, 'Gruppo: ' + e.group) : null);

      q.sheet.insertBefore(banner, q.form);
      q.sheet.insertBefore(reveal, q.actions);

      // Il carattere prende vita: i tratti si disegnano uno dopo l'altro (se l'interruttore è attivo).
      const stage = q.stage;
      CN.u.clear(stage);
      const cells = h('div', { class: 'stroke-host' });
      stage.append(cells);
      const size = cellSize(Array.from(e.hanzi).length);
      strokeCtrl = CN.strokes.mount(cells, e.hanzi, { animate: true, size: size });
      const ctrlNow = strokeCtrl;
      ctrlNow.ready.then(function (ok) {
        if (!ok || dead || strokeCtrl !== ctrlNow) return;
        stage.append(h('div', { class: 'play-row' },
          h('button', { class: 'btn btn-small btn-ghost', type: 'button', onClick: function () { ctrlNow.replay(); } }, icon('brush', 16), ' Rivedi i tratti'),
          h('button', { class: 'btn btn-small btn-ghost', type: 'button', onClick: function () { ctrlNow.quiz(); } }, 'Prova a scrivere')));
      });

      q.fields.forEach(function (f) { f.input.readOnly = true; });
      if (!isListen && store.settings().autoSpeak) setTimeout(function () { if (!dead && q.entry === e) say(false, true); }, 200);
      renderActions();
      const c = view.querySelector('.p-counters');
      if (c) c.replaceWith(head().querySelector('.p-counters'));
      const pr = view.querySelector('.p-progress');
      const limit = store.settings().session;
      if (pr && limit) pr.firstChild.style.width = CN.u.pct(sess.n, limit) + '%';
    }

    next();

    return {
      destroy: function () { dead = true; stopStrokes(); CN.speech.stop(); CN.u.clear(view); view.remove(); }
    };
  }

  CN.practice = {
    mount: mount,
    setOverride: function (mode, ids) { overrides[mode] = ids; }
  };
})(window);
