/* Ordine dei tratti con Hanzi Writer (https://hanziwriter.org), caricato solo se serve.
 * Se la libreria o i dati del carattere non si caricano, mostra il carattere fermo. */
(function (root) {
  'use strict';
  const CN = root.CN = root.CN || {};
  const LIB = 'https://cdn.jsdelivr.net/npm/hanzi-writer@3/dist/hanzi-writer.min.js';
  let loading = null;

  function load() {
    if (root.HanziWriter) return Promise.resolve(true);
    if (loading) return loading;
    loading = new Promise(function (resolve) {
      const s = document.createElement('script');
      s.src = LIB;
      s.async = true;
      s.onload = function () { resolve(!!root.HanziWriter); };
      s.onerror = function () { loading = null; resolve(false); };
      document.head.appendChild(s);
      setTimeout(function () { resolve(!!root.HanziWriter); }, 8000);
    });
    return loading;
  }

  function cssVar(name, fallback) {
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v || fallback;
  }

  function isHan(ch) { return /[㐀-鿿]/.test(ch); }

  /**
   * Mostra `text` dentro `host`. Con le animazioni attive disegna i tratti uno dopo l'altro.
   * opts: { animate: bool, size: px per carattere }
   * Restituisce {replay(), quiz(), destroy(), animated}
   */
  function mount(host, text, opts) {
    opts = opts || {};
    const chars = Array.from(text);
    const size = opts.size || 150;
    host.textContent = '';
    host.classList.add('stroke-host');
    const writers = [];
    let dead = false;

    function fallback(el, ch) {
      el.textContent = ch;
      el.classList.add('static-hanzi');
      el.style.fontSize = Math.round(size * 0.78) + 'px';
      el.style.width = size + 'px';
      el.style.height = size + 'px';
    }

    const cells = chars.map(function (ch) {
      const cell = document.createElement('div');
      cell.className = 'stroke-cell';
      cell.style.width = size + 'px';
      cell.style.height = size + 'px';
      host.appendChild(cell);
      return cell;
    });

    const ctrl = {
      animated: false,
      ready: Promise.resolve(false),
      replay: function () {},
      quiz: function () {},
      destroy: function () { dead = true; host.textContent = ''; }
    };

    const enabled = CN.store.settings().strokes;
    if (!enabled) {
      chars.forEach(function (ch, i) { fallback(cells[i], ch); });
      return ctrl;
    }
    // Finché la libreria arriva, mostra i caratteri fermi.
    chars.forEach(function (ch, i) { fallback(cells[i], ch); });

    ctrl.ready = load().then(function (ok) {
      if (dead || !ok) return false;
      const ink = cssVar('--ink', '#16212c');
      const faint = cssVar('--line', '#c9d1d8');
      const brand = cssVar('--brand', '#1d3f72');
      let pending = chars.length;
      chars.forEach(function (ch, i) {
        if (!isHan(ch)) return;
        const cell = cells[i];
        cell.textContent = '';
        cell.className = 'stroke-cell';
        cell.style.fontSize = '';
        let w;
        try {
          w = root.HanziWriter.create(cell, ch, {
            width: size, height: size, padding: 6,
            showOutline: true, showCharacter: false,
            strokeColor: ink, outlineColor: faint, radicalColor: brand, drawingColor: brand,
            strokeAnimationSpeed: 1, delayBetweenStrokes: 220,
            onLoadCharDataError: function () { cell.textContent = ''; fallback(cell, ch); }
          });
        } catch (e) { fallback(cell, ch); return; }
        writers[i] = w;
        pending--;
      });
      ctrl.animated = writers.some(Boolean);
      if (!ctrl.animated) return false;

      function play() {
        if (dead) return;
        if (CN.u.reducedMotion()) {
          writers.forEach(function (w) { if (w) w.showCharacter(); });
          return;
        }
        let chain = Promise.resolve();
        writers.forEach(function (w) {
          if (!w) return;
          chain = chain.then(function () {
            if (dead) return null;
            return new Promise(function (res) {
              try { w.hideCharacter(); w.animateCharacter({ onComplete: res }); } catch (e) { res(); }
            });
          });
        });
      }
      ctrl.replay = play;
      ctrl.quiz = function () {
        writers.forEach(function (w) { if (w) { try { w.hideCharacter(); w.quiz(); } catch (e) { /* niente */ } } });
      };
      if (opts.animate !== false) play();
      else writers.forEach(function (w) { if (w) w.showCharacter(); });
      return true;
    });
    return ctrl;
  }

  CN.strokes = { mount: mount, load: load };
})(window);
