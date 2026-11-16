/* Pronuncia con la voce del browser (Web Speech API). Nessun file audio. */
(function (root) {
  'use strict';
  const CN = root.CN = root.CN || {};
  const synth = root.speechSynthesis;
  const supported = !!synth && typeof root.SpeechSynthesisUtterance === 'function';
  let voices = [];
  const listeners = [];

  function refresh() {
    if (!supported) return;
    voices = synth.getVoices() || [];
    listeners.forEach(function (fn) { fn(); });
  }
  if (supported) {
    refresh();
    if (synth.addEventListener) synth.addEventListener('voiceschanged', refresh);
    else synth.onvoiceschanged = refresh;
  }

  /** Solo mandarino: esclude cantonese (zh-HK, yue). */
  function chineseVoices() {
    return voices.filter(function (v) {
      return /^(zh|cmn)/i.test(v.lang) && !/HK|yue|cantonese|粤/i.test(v.lang + ' ' + v.name);
    });
  }

  function chooseVoice() {
    const list = chineseVoices();
    if (!list.length) return null;
    const saved = CN.store.settings().voiceURI;
    const found = saved && list.filter(function (v) { return v.voiceURI === saved; })[0];
    if (found) return found;
    const rank = function (v) {
      let s = 0;
      if (/^zh[-_]CN/i.test(v.lang)) s += 4;
      if (/natural|online/i.test(v.name)) s += 3;
      if (/xiaoxiao|yunxi|huihui|google/i.test(v.name)) s += 1;
      return s;
    };
    return list.slice().sort(function (a, b) { return rank(b) - rank(a); })[0];
  }

  function status() {
    return { supported: supported, hasChinese: chineseVoices().length > 0, count: chineseVoices().length };
  }

  /** Legge `text`. Risolve true a fine lettura, false se non è possibile. */
  function speak(text, opts) {
    opts = opts || {};
    return new Promise(function (resolve) {
      const voice = chooseVoice();
      if (!supported || !voice) { resolve(false); return; }
      try { synth.cancel(); } catch (e) { /* niente */ }
      const u = new root.SpeechSynthesisUtterance(text);
      u.voice = voice;
      u.lang = voice.lang;
      u.rate = opts.slow ? 0.55 : (CN.store.settings().rate || 0.85);
      u.onend = function () { resolve(true); };
      u.onerror = function () { resolve(false); };
      synth.speak(u);
    });
  }

  function stop() { if (supported) { try { synth.cancel(); } catch (e) { /* niente */ } } }

  CN.speech = {
    speak: speak, stop: stop, status: status, voices: chineseVoices,
    onVoices: function (fn) { listeners.push(fn); }
  };
})(window);
