/* Piccole utilità condivise: costruzione del DOM, casualità, icone. */
(function (root) {
  'use strict';
  const CN = root.CN = root.CN || {};

  /** h('div', {class:'x', onClick: fn}, figli...) */
  function h(tag, attrs) {
    const el = document.createElement(tag);
    const a = attrs || {};
    Object.keys(a).forEach(function (k) {
      const v = a[k];
      if (v === null || v === undefined || v === false) return;
      if (k === 'class') el.className = v;
      else if (k === 'dataset') Object.assign(el.dataset, v);
      else if (k.indexOf('on') === 0 && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
      else if (v === true) el.setAttribute(k, '');
      else el.setAttribute(k, v);
    });
    for (let i = 2; i < arguments.length; i++) append(el, arguments[i]);
    return el;
  }
  function append(el, kid) {
    if (kid === null || kid === undefined || kid === false) return;
    if (Array.isArray(kid)) { kid.forEach(function (k) { append(el, k); }); return; }
    el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  }
  function appendAll(el, items) { items.forEach(function (x) { if (x) el.append(x); }); return el; }
  function clear(el) { while (el.firstChild) el.removeChild(el.firstChild); return el; }

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  function pickWeighted(list, weightFn) {
    let total = 0;
    const w = list.map(function (x) { const v = Math.max(0, weightFn(x)); total += v; return v; });
    if (total <= 0) return pick(list);
    let r = Math.random() * total;
    for (let i = 0; i < list.length; i++) { r -= w[i]; if (r <= 0) return list[i]; }
    return list[list.length - 1];
  }

  const ICONS = {
    home: '<path d="M3 11.5 12 4l9 7.5M5.5 10v9.5h13V10"/>',
    ear: '<path d="M6 9a6 6 0 0 1 12 0c0 3-2 4-3 6-.8 1.600-.5 3.500-2.500 3.500-1.500 0-2.500-1-2.500-2.500"/><path d="M9 9a3 3 0 0 1 6 0c0 1.500-1 2-1.500 3"/>',
    cards: '<rect x="3" y="6" width="14" height="12" rx="2"/><path d="M7 3.500h12a2 2 0 0 1 2 2V15"/>',
    pieces: '<path d="M4 4h7v7H4zM13 13h7v7h-7z"/><path d="M13 4h7v7h-7zM4 13h7v7H4z" opacity=".45"/>',
    book: '<path d="M4 5.500A2.500 2.500 0 0 1 6.500 3H20v15H6.500A2.500 2.500 0 0 0 4 20.500zM4 20.500A2.500 2.500 0 0 0 6.500 23H20"/>',
    chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.500v2M12 19.500v2M2.500 12h2M19.500 12h2M5.200 5.200l1.400 1.400M17.400 17.400l1.400 1.400M18.800 5.200l-1.400 1.400M6.600 17.400l-1.400 1.400"/>',
    moon: '<path d="M20 14.500A8.500 8.500 0 0 1 9.500 4 8.500 8.500 0 1 0 20 14.500z"/>',
    brush: '<path d="M4 20c3 0 5-1 5-3.500a2.500 2.500 0 0 0-5 0c0 1.500-1 2.500-1 3.500zM8.500 15.500 19.500 4.500a1.800 1.800 0 0 1 2.500 2.500L11 18"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M19.400 15a1.700 1.700 0 0 0 .3 1.800l.1.1a2 2 0 1 1-2.800 2.800l-.1-.1a1.700 1.700 0 0 0-1.800-.3 1.700 1.700 0 0 0-1 1.500V21a2 2 0 1 1-4 0v-.1a1.700 1.700 0 0 0-1.100-1.500 1.700 1.700 0 0 0-1.800.3l-.1.1a2 2 0 1 1-2.800-2.800l.1-.1a1.700 1.700 0 0 0 .3-1.800 1.700 1.700 0 0 0-1.500-1H3a2 2 0 1 1 0-4h.1a1.700 1.700 0 0 0 1.500-1.100 1.700 1.700 0 0 0-.3-1.800l-.1-.1a2 2 0 1 1 2.800-2.800l.1.1a1.700 1.700 0 0 0 1.800.3H9a1.700 1.700 0 0 0 1-1.500V3a2 2 0 1 1 4 0v.1a1.700 1.700 0 0 0 1 1.500 1.700 1.700 0 0 0 1.800-.3l.1-.1a2 2 0 1 1 2.800 2.800l-.1.1a1.700 1.700 0 0 0-.3 1.800V9a1.700 1.700 0 0 0 1.500 1H21a2 2 0 1 1 0 4h-.1a1.700 1.700 0 0 0-1.500 1z"/>',
    speaker: '<path d="M4 9.500v5h4l5 4v-13l-5 4zM16.500 8.500a5 5 0 0 1 0 7M19 6a8.500 8.500 0 0 1 0 12"/>',
    turtle: '<path d="M3 15c0-4 3-7 7.500-7S18 11 18 15zM18 13c1.500-1 3-.5 3.500.8M6 15v2.500M14 15v2.500"/>',
    flame: '<path d="M12 3c1 3.500 5 5.500 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 .3 1.500 1 2 2 2 0-3-1-5 1-8z"/>',
    check: '<path d="m5 12.500 4.500 4.500L19 7.500"/>',
    cross: '<path d="M6 6l12 12M18 6 6 18"/>',
    flag: '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    search: '<circle cx="11" cy="11" r="6.500"/><path d="m16 16 5 5"/>',
    download: '<path d="M12 4v11M7 11l5 5 5-5M5 20h14"/>',
    upload: '<path d="M12 16V5M7 9l5-5 5 5M5 20h14"/>',
    keyboard: '<rect x="2.500" y="6" width="19" height="12" rx="2"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10"/>'
  };
  function icon(name, size) {
    const s = document.createElement('span');
    s.className = 'ico';
    s.setAttribute('aria-hidden', 'true');
    const px = size || 20;
    s.innerHTML = '<svg viewBox="0 0 24 24" width="' + px + '" height="' + px +
      '" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
      (ICONS[name] || '') + '</svg>';
    return s;
  }

  function toast(msg) {
    const t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { t.classList.remove('show'); }, 2600);
  }

  function pct(n, d) { return d ? Math.round((n / d) * 100) : 0; }

  function reducedMotion() {
    return !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  CN.u = { h: h, appendAll: appendAll, clear: clear, shuffle: shuffle, pick: pick, pickWeighted: pickWeighted, icon: icon, toast: toast, pct: pct, reducedMotion: reducedMotion };
})(window);
