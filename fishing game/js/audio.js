/*
 * ABYSS ANGLER - procedural WebAudio sound kit (js/audio.js)
 * Exposes window.AudioKit. Classic script: no ES modules, no imports, no samples,
 * no network. Everything is synthesised from oscillators and gently filtered noise.
 *
 * The mix is deliberately warm and quiet: consonant pads, soft plucks, low-passed
 * water/thunder. Noise is only used as a quiet texture, never as a lead voice.
 */
(function () {
  'use strict';

  var MASTER = 0.35;        // overall level (kept low; the game is meant to be calm)
  var MAX_VOICES = 8;
  var XFADE = 1.4;
  var REEL_MIN = 0.14;      // fewer ticks: a slow click, not a machine-gun buzz
  var AMBIENCE = false;     // background pads are OFF by default (they read as a hum/buzz)
  var ALARM_MIN = 1.0;
  var THEMES = { day: true, reef: true, trench: true, night: true, storm: true };

  var ctx = null;
  var master = null;
  var ambientBus = null;
  var sfxBus = null;
  var noiseBuf = null;
  var surfBuf = null;
  var muted = false;
  var themeReq = null;
  var activeTheme = null;
  var bed = null;
  var voices = [];
  var lastReelAt = -1;
  var lastAlarmAt = -1;

  /* ------------------------------------------------------------------ *
   * utilities
   * ------------------------------------------------------------------ */
  function ready() {
    return !!(ctx && ctx.state !== 'closed');
  }
  function clamp(v, lo, hi) {
    v = Number(v);
    if (!isFinite(v)) return lo;
    return v < lo ? lo : (v > hi ? hi : v);
  }
  function when() {
    return ctx.currentTime + 0.005;
  }
  function takeVoice(dur) {
    if (!ready()) return false;
    var t = ctx.currentTime;
    var alive = [];
    for (var i = 0; i < voices.length; i++) {
      if (voices[i] > t + 0.01) alive.push(voices[i]);
    }
    voices = alive;
    if (voices.length >= MAX_VOICES) return false;
    voices.push(t + Math.max(0.04, dur));
    return true;
  }
  function oneShot(dur) {
    return !!(noiseBuf && ready() && takeVoice(dur));
  }

  /* ------------------------------------------------------------------ *
   * one-shot voices (oscillator plucks and soft filtered noise)
   * ------------------------------------------------------------------ */
  function tone(at, type, f0, f1, dur, peak, cutoff, dest) {
    try {
      var o = ctx.createOscillator();
      o.type = type;
      o.frequency.setValueAtTime(Math.max(20, f0), at);
      if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), at + dur);
      var g = ctx.createGain();
      var attack = Math.min(0.02, Math.max(0.004, dur * 0.18));
      g.gain.setValueAtTime(0.0001, at);
      g.gain.linearRampToValueAtTime(Math.max(0.0002, peak), at + attack);
      g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
      if (cutoff) {
        var f = ctx.createBiquadFilter();
        f.type = 'lowpass';
        f.frequency.value = cutoff;
        f.Q.value = 0.4;
        o.connect(f);
        f.connect(g);
      } else {
        o.connect(g);
      }
      g.connect(dest || sfxBus);
      o.start(at);
      o.stop(at + dur + 0.04);
    } catch (e) {}
  }

  // Soft filtered noise: low-pass keeps it watery / breathy rather than hissy.
  function noise(at, dur, peak, type, f0, f1, q, dest) {
    try {
      if (!noiseBuf) return;
      var s = ctx.createBufferSource();
      s.buffer = noiseBuf;
      s.loop = true;
      var f = ctx.createBiquadFilter();
      f.type = type || 'lowpass';
      f.Q.value = q || 0.6;
      f.frequency.setValueAtTime(Math.max(40, f0), at);
      if (f1 && f1 !== f0) f.frequency.exponentialRampToValueAtTime(Math.max(40, f1), at + dur);
      var g = ctx.createGain();
      var attack = Math.min(0.03, Math.max(0.004, dur * 0.2));
      g.gain.setValueAtTime(0.0001, at);
      g.gain.linearRampToValueAtTime(Math.max(0.0002, peak), at + attack);
      g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
      s.connect(f);
      f.connect(g);
      g.connect(dest || sfxBus);
      s.start(at);
      s.stop(at + dur + 0.04);
    } catch (e) {}
  }

  /* ------------------------------------------------------------------ *
   * ambient bed helpers
   * ------------------------------------------------------------------ */
  function addPad(b, padBus, type, freq, gain, cutoff) {
    var o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    o.detune.value = (Math.random() - 0.5) * 4;
    var g = ctx.createGain();
    g.gain.value = gain;
    var f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = cutoff;
    f.Q.value = 0.35;
    o.connect(g);
    g.connect(f);
    f.connect(padBus);
    o.start();
    b.nodes.push(o, g, f);
  }

  function addSwell(b, padBus, rate, depth) {
    var o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.value = rate;
    var g = ctx.createGain();
    g.gain.value = depth;
    o.connect(g);
    g.connect(padBus.gain);
    o.start();
    b.nodes.push(o, g);
  }

  function addNoiseBed(b, gainValue, type, freq, q) {
    if (!noiseBuf) return;
    var s = ctx.createBufferSource();
    s.buffer = noiseBuf;
    s.loop = true;
    var f = ctx.createBiquadFilter();
    f.type = type || 'lowpass';
    f.frequency.value = freq;
    f.Q.value = q || 0.6;
    var g = ctx.createGain();
    g.gain.value = gainValue;
    s.connect(f);
    f.connect(g);
    g.connect(b.gain);
    s.start();
    b.nodes.push(s, f, g);
  }

  /* ------------------------------------------------------------------ *
   * themes - warm consonant chords, no harsh low end
   * ------------------------------------------------------------------ */
  function buildDay(b, padBus) {
    addPad(b, padBus, 'sine', 110, 0.050, 900);
    addPad(b, padBus, 'sine', 164.81, 0.032, 900);
    addPad(b, padBus, 'triangle', 220, 0.026, 800);
    addPad(b, padBus, 'sine', 277.18, 0.016, 900);
    addSwell(b, padBus, 0.055, 0.10);
    addNoiseBed(b, 0.007, 'lowpass', 480, 0.5);
  }

  function buildReef(b, padBus) {
    addPad(b, padBus, 'sine', 261.63, 0.034, 2200);
    addPad(b, padBus, 'sine', 329.63, 0.026, 2200);
    addPad(b, padBus, 'triangle', 392.00, 0.021, 2000);
    addPad(b, padBus, 'sine', 587.33, 0.010, 2400);
    addPad(b, padBus, 'sine', 1174.66, 0.004, 3000);
    addSwell(b, padBus, 0.07, 0.12);
    addNoiseBed(b, 0.005, 'lowpass', 800, 0.5);
  }

  function buildTrench(b, padBus) {
    addPad(b, padBus, 'sine', 73.42, 0.052, 280);
    addPad(b, padBus, 'sine', 110.00, 0.036, 300);
    addPad(b, padBus, 'triangle', 146.83, 0.018, 320);
    addSwell(b, padBus, 0.045, 0.09);
    addNoiseBed(b, 0.004, 'lowpass', 180, 0.5);
  }

  function buildNight(b, padBus) {
    addPad(b, padBus, 'sine', 110.00, 0.046, 600);
    addPad(b, padBus, 'sine', 130.81, 0.022, 600);
    addPad(b, padBus, 'triangle', 164.81, 0.026, 700);
    addPad(b, padBus, 'sine', 880.00, 0.0035, 1600);
    addSwell(b, padBus, 0.06, 0.10);
    addNoiseBed(b, 0.003, 'lowpass', 520, 0.5);
  }

  function buildStorm(b, padBus) {
    addPad(b, padBus, 'sine', 73.42, 0.048, 220);
    addPad(b, padBus, 'sine', 110.00, 0.034, 240);
    addPad(b, padBus, 'triangle', 146.83, 0.018, 260);
    addSwell(b, padBus, 0.05, 0.13);
    addNoiseBed(b, 0.012, 'bandpass', 500, 0.55);
  }

  // Background atmosphere: filtered surf only, no sustained pitch or low drone.
  function buildSurf(theme) {
    var b = { theme: theme, gain: ctx.createGain(), nodes: [] };
    var t = ctx.currentTime;
    b.gain.gain.setValueAtTime(0.0001, t);
    b.gain.connect(ambientBus);
    b.gain.gain.exponentialRampToValueAtTime(1, t + XFADE);
    var cut = { day: 700, reef: 1000, trench: 430, night: 560, storm: 820 }[theme] || 700;
    var s = ctx.createBufferSource();
    s.buffer = surfBuf || noiseBuf;
    s.loop = true;
    var bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = cut;
    bp.Q.value = 0.35;
    var lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 1900;
    lp.Q.value = 0.3;
    var g = ctx.createGain();
    g.gain.value = 0.16;
    s.connect(bp);
    bp.connect(lp);
    lp.connect(g);
    g.connect(b.gain);
    s.start();
    var swell = ctx.createOscillator();
    swell.type = 'sine';
    swell.frequency.value = 0.075;
    var swellGain = ctx.createGain();
    swellGain.gain.value = 0.045;
    swell.connect(swellGain);
    swellGain.connect(g.gain);
    swell.start();
    var drift = ctx.createOscillator();
    drift.type = 'sine';
    drift.frequency.value = 0.045;
    var driftGain = ctx.createGain();
    driftGain.gain.value = 130;
    drift.connect(driftGain);
    driftGain.connect(bp.frequency);
    drift.start();
    b.nodes.push(s, bp, lp, g, swell, swellGain, drift, driftGain);
    return b;
  }

  function buildBed(theme) {
    return buildSurf(theme);
  }

  function buildSurfNoise() {
    // 4 s of noise faded to silence at both ends, so the loop swells instead of clicking.
    var len = Math.floor(ctx.sampleRate * 4);
    surfBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    var d = surfBuf.getChannelData(0);
    for (var i = 0; i < len; i++) {
      var env = Math.sin((Math.PI * i) / len);
      d[i] = (Math.random() * 2 - 1) * env;
    }
  }

  function teardownBed(b) {
    if (!b) return;
    for (var i = 0; i < b.nodes.length; i++) {
      var n = b.nodes[i];
      try { if (typeof n.stop === 'function') n.stop(); } catch (e) {}
      try { if (typeof n.disconnect === 'function') n.disconnect(); } catch (e) {}
    }
    b.nodes = [];
    try { b.gain.disconnect(); } catch (e) {}
  }

  function fadeOutBed(old) {
    try {
      var g = old.gain.gain;
      var t = ctx.currentTime;
      g.cancelScheduledValues(t);
      g.setValueAtTime(Math.max(0.0001, g.value), t);
      g.exponentialRampToValueAtTime(0.0001, t + XFADE);
    } catch (e) {}
    setTimeout(function () { teardownBed(old); }, (XFADE + 0.3) * 1000);
  }

  /* ------------------------------------------------------------------ *
   * lifecycle
   * ------------------------------------------------------------------ */
  function buildNoise() {
    var len = Math.floor(ctx.sampleRate * 2);
    noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    var d = noiseBuf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }

  function init() {
    try {
      if (ctx && ctx.state !== 'closed') { resume(); return; }
      if (bed) { teardownBed(bed); bed = null; }
      activeTheme = null;
      voices = [];
      lastReelAt = -1;
      lastAlarmAt = -1;

      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctx = new AC();

      master = ctx.createGain();
      master.gain.value = muted ? 0.0001 : MASTER;

      var hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 32;
      var lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 9500;

      var comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -20;
      comp.knee.value = 18;
      comp.ratio.value = 2;
      comp.attack.value = 0.006;
      comp.release.value = 0.3;

      var limiter = ctx.createDynamicsCompressor();
      limiter.threshold.value = -6;
      limiter.knee.value = 0;
      limiter.ratio.value = 20;
      limiter.attack.value = 0.002;
      limiter.release.value = 0.12;

      master.connect(hp);
      hp.connect(lp);
      lp.connect(comp);
      comp.connect(limiter);
      limiter.connect(ctx.destination);

      ambientBus = ctx.createGain();
      ambientBus.gain.value = AMBIENCE ? 0.6 : 0.0;
      ambientBus.connect(master);

      sfxBus = ctx.createGain();
      sfxBus.gain.value = 3.8;
      sfxBus.connect(master);

      buildNoise();
      buildSurfNoise();
      resume();

      if (themeReq) {
        var requested = themeReq;
        themeReq = null;
        setTheme(requested);
      }
    } catch (e) {
      ctx = null;
      master = null;
      sfxBus = null;
      ambientBus = null;
      bed = null;
      voices = [];
    }
  }

  function resume() {
    try {
      if (!ctx) return;
      if (ctx.state !== 'running' && ctx.state !== 'closed' && ctx.resume) {
        var p = ctx.resume();
        if (p && typeof p.catch === 'function') p.catch(function () {});
      }
    } catch (e) {}
  }

  function applyMute() {
    try {
      if (!master || !ready()) return;
      var g = master.gain;
      var t = ctx.currentTime;
      g.cancelScheduledValues(t);
      g.setValueAtTime(Math.max(0.0001, g.value), t);
      g.linearRampToValueAtTime(muted ? 0.0001 : MASTER, t + 0.15);
    } catch (e) {}
  }

  function setMuted(v) {
    muted = !!v;
    applyMute();
  }
  function isMuted() { return muted; }

  function setTheme(theme) {
    try {
      if (typeof theme !== 'string') return;
      theme = theme.toLowerCase();
      if (!THEMES[theme]) return;
      if (!ready()) { themeReq = theme; return; }
      if (!AMBIENCE) {
        themeReq = null;
        activeTheme = theme;
        var silent = bed;
        bed = null;
        if (silent) fadeOutBed(silent);
        return;
      }
      if (activeTheme === theme && bed) return;
      themeReq = null;
      var old = bed;
      bed = null;
      if (old) fadeOutBed(old);
      bed = buildBed(theme);
      activeTheme = theme;
    } catch (e) {}
  }

  function stopAmbient() {
    try {
      themeReq = null;
      activeTheme = null;
      var old = bed;
      bed = null;
      if (old) fadeOutBed(old);
    } catch (e) {}
  }

  function setAmbientEnabled(on) {
    try {
      AMBIENCE = !!on;
      if (ambientBus) ambientBus.gain.value = AMBIENCE ? 0.6 : 0.0;
      if (!AMBIENCE) { stopAmbient(); return; }
      setTheme(activeTheme || themeReq || 'day');
    } catch (e) {}
  }

  function isAmbientEnabled() {
    return AMBIENCE;
  }

  function ambientState() {
    return { enabled: AMBIENCE, theme: activeTheme, bed: !!bed };
  }

  /* ------------------------------------------------------------------ *
   * one-shots - tonal first, noise only as a soft texture
   * ------------------------------------------------------------------ */
  function ui() {
    if (!oneShot(0.12)) return;
    var t = when();
    tone(t, 'sine', 1046.5, 1046.5, 0.09, 0.032, 0);
    tone(t + 0.012, 'sine', 1568.0, 1568.0, 0.08, 0.014, 0);
  }

  function purchase() {
    if (!oneShot(0.5)) return;
    var t = when();
    var notes = [523.25, 659.25, 783.99, 1046.5];
    for (var i = 0; i < notes.length; i++) {
      tone(t + i * 0.075, 'triangle', notes[i], notes[i], 0.24, 0.032, 2400);
    }
  }

  function cast() {
    if (!oneShot(0.5)) return;
    var t = when();
    noise(t, 0.3, 0.016, 'lowpass', 1100, 380, 0.5);
    tone(t, 'sine', 210, 96, 0.28, 0.028, 900);
  }

  function splash(strength) {
    var s = clamp(strength == null ? 0.6 : strength, 0, 1);
    if (!oneShot(0.55)) return;
    var t = when();
    noise(t, 0.32, 0.035 + 0.045 * s, 'lowpass', 1100, 260, 0.6);
    tone(t, 'sine', 110 + 30 * s, 54, 0.3, 0.032 + 0.025 * s, 600);
    noise(t + 0.02, 0.09, 0.008 + 0.014 * s, 'bandpass', 1800, 1200, 1.0);
  }

  function bite() {
    if (!oneShot(0.3)) return;
    var t = when();
    tone(t, 'sine', 392.0, 392.0, 0.14, 0.040, 1600);
    tone(t + 0.1, 'sine', 523.25, 523.25, 0.16, 0.034, 1600);
  }

  function strike() {
    if (!oneShot(0.3)) return;
    var t = when();
    tone(t, 'sine', 200, 105, 0.14, 0.050, 700);
    noise(t, 0.08, 0.012, 'lowpass', 800, 500, 0.7);
  }

  function miss() {
    if (!oneShot(0.3)) return;
    var t = when();
    tone(t, 'sine', 233.08, 196.0, 0.22, 0.035, 900);
    tone(t + 0.04, 'triangle', 174.61, 130.81, 0.25, 0.020, 800);
  }

  function reel(intensity) {
    if (!ready()) return;
    var t = ctx.currentTime;
    if (t - lastReelAt < REEL_MIN) return;
    lastReelAt = t;
    var i = clamp(intensity == null ? 0.5 : intensity, 0, 1);
    if (!takeVoice(0.05)) return;
    var at = t + 0.002;
    tone(at, 'sine', 1300 + 250 * i, 1280 + 250 * i, 0.03, 0.016 + 0.012 * i, 3000);
    noise(at, 0.02, 0.004 + 0.003 * i, 'lowpass', 1800, 1200, 0.6);
  }

  function surge() {
    if (!oneShot(0.6)) return;
    var t = when();
    tone(t, 'triangle', 98, 196, 0.45, 0.030, 650);
    tone(t + 0.02, 'sine', 196, 392, 0.38, 0.012, 900);
    noise(t, 0.4, 0.010, 'lowpass', 500, 900, 0.6);
  }

  function snap() {
    if (!oneShot(0.3)) return;
    var t = when();
    noise(t, 0.05, 0.040, 'bandpass', 2200, 1300, 0.9);
    tone(t, 'sine', 1200, 180, 0.16, 0.030, 2200);
    tone(t + 0.01, 'sine', 120, 70, 0.18, 0.030, 400);
  }

  function catchFish(rarity) {
    var order = { common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 4 };
    var key = String(rarity == null ? 'common' : rarity).toLowerCase();
    var idx = typeof order[key] === 'number' ? order[key] : 0;
    var notes = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5, 1174.66];
    var count = 3 + idx;
    var step = 0.10 - idx * 0.004;
    var dur = count * step + (idx >= 2 ? 1.0 : 0.5);
    if (!oneShot(dur + 0.2)) return;
    var t = when();
    for (var k = 0; k < count; k++) {
      var f = notes[k];
      tone(t + k * step, 'triangle', f, f, 0.30 + idx * 0.04, 0.032, 2800);
      tone(t + k * step, 'sine', f * 2, f * 2, 0.18, 0.008, 3200);
    }
    if (idx >= 2) {
      var ch = t + count * step;
      var chord = [notes[0], notes[2], notes[4]];
      for (var c = 0; c < chord.length; c++) {
        tone(ch, 'triangle', chord[c], chord[c], 0.9 + idx * 0.08, 0.022, 2200);
      }
      tone(ch, 'sine', notes[0] / 2, notes[0] / 2, 0.8, 0.026, 800);
    }
  }

  function levelComplete() {
    if (!oneShot(2.6)) return;
    var t = when();
    var seq = [523.25, 659.25, 783.99, 1046.5];
    for (var i = 0; i < seq.length; i++) {
      tone(t + i * 0.11, 'triangle', seq[i], seq[i], 0.28, 0.036, 3000);
    }
    var ch = t + 0.5;
    var chord = [261.63, 329.63, 392.0, 523.25, 659.25, 783.99];
    for (var k = 0; k < chord.length; k++) {
      tone(ch, 'triangle', chord[k], chord[k], 1.6, k < 2 ? 0.028 : 0.018, 2400);
    }
    tone(ch, 'sine', 130.81, 130.81, 1.5, 0.032, 600);
  }

  function tensionAlarm() {
    if (!ready()) return;
    var t = ctx.currentTime;
    if (t - lastAlarmAt < ALARM_MIN) return;
    lastAlarmAt = t;
    if (!takeVoice(0.4)) return;
    var at = t + 0.003;
    tone(at, 'triangle', 740, 690, 0.26, 0.020, 1800);
    tone(at + 0.02, 'sine', 1108, 1046, 0.22, 0.010, 2200);
  }

  function thunder() {
    if (!oneShot(2.8)) return;
    var t = when();
    noise(t, 2.2, 0.060, 'lowpass', 320, 70, 0.5);
    tone(t + 0.02, 'sine', 52, 34, 1.8, 0.040, 300);
  }

  /* ------------------------------------------------------------------ *
   * public API
   * ------------------------------------------------------------------ */
  window.AudioKit = {
    init: init,
    resume: resume,
    setMuted: setMuted,
    isMuted: isMuted,
    setTheme: setTheme,
    stopAmbient: stopAmbient,
    setAmbientEnabled: setAmbientEnabled,
    isAmbientEnabled: isAmbientEnabled,
    ambientState: ambientState,
    ui: ui,
    purchase: purchase,
    cast: cast,
    splash: splash,
    bite: bite,
    strike: strike,
    miss: miss,
    reel: reel,
    surge: surge,
    snap: snap,
    catchFish: catchFish,
    levelComplete: levelComplete,
    tensionAlarm: tensionAlarm,
    thunder: thunder
  };
})();
