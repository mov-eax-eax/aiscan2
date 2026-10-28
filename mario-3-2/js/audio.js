/* =========================================================================
   MARIO 3-2 — audio.js (AUDIO)
   Procedural WebAudio: all SFX + stepped underwater / title / clear music.
   No files, no imports, no network — only OscillatorNode, generated noise
   buffers, BiquadFilter, GainNode, StereoPanner and one simple feedback delay.

   PUBLIC API (main.js / player / entities call only these):
     new M32.Audio()            lazy AudioContext, created on first unlock()
     audio.unlock()             resume on a user gesture; safe to call often
     audio.play(name, opts)     fire-and-forget SFX, opts {vol,pitch,pan,dur}
     audio.music(state)         'title' | 'underwater' | 'clear' | 'none'
     audio.setMuted(bool)       master fade to silence (M key)
     audio.tick(dt)             once per fixed step; drives the sequencer
     audio.muted                getter: current mute flag

   SWIM BED CONVENTION (documented for player/entities):
     play('swimLoop', {loop:true})  -> start the filtered-noise water bed
     play('swimLoop', {loop:false}) -> stop it
     music('underwater') arms it automatically; every other music() state
     disarms it and clears any manual override. Its gain follows player speed
     (vx/vy, vel, velocity or body.vx/vy), so it swells while swimming.

   SEQUENCER: each track is a step list on an 8th-note grid. Every tick we
   schedule all steps whose AudioContext timestamp is < now + LOOKAHEAD
   (0.15 s), then advance a per-track cursor. The clock is ctx.currentTime,
   never accumulated dt, so tempo cannot drift. If currentTime jumps > 0.5 s
   (paused tab / debug fast-forward) the cursor re-anchors: no storms.

   MIXER: master 0.5 -> DynamicsCompressor (soft limiter) -> destination,
   with sfxBus 1.0 and musicBus 0.5 underneath, plus a per-track delay send.
   Everything is guarded: an unavailable / suspended context is a no-op,
   never an exception into the game loop.
   ========================================================================= */
(function () {
  'use strict';
  window.M32 = window.M32 || {};
  const M = window.M32;

  const MASTER_LEVEL = 0.5, MUSIC_BUS = 0.5, SFX_BUS = 1.0;
  const LOOKAHEAD = 0.15, XFADE = 0.8, RETIRE_AFTER = XFADE + 0.1;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

  /* ---------------------------------------------------------------- pitch */
  function hz(m) { return 440 * Math.pow(2, (m - 69) / 12); } // midi -> Hz
  function rand01(n) { // deterministic 0..1 hash (falls back if core missing)
    if (M.hash01) return M.hash01(n);
    const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return s - Math.floor(s);
  }

  /* ====================================================================== */
  /* NOTE TABLES — MIDI numbers; hz() converts at use time.                 */
  /* ====================================================================== */

  // UNDERWATER — D minor / Dorian, i - VI - III - VII, 8 bars (2 bars each).
  // Pad triads sit around D4..F4, the arpeggio climbs two octaves above them,
  // the bass stays at D2..C3 so it never collides with the pad.
  const UW_CHORDS = [
    { bass: 38, pad: [50, 53, 57], arp: [62, 65, 69, 74, 77, 81] }, // Dm
    { bass: 46, pad: [58, 62, 65], arp: [58, 62, 65, 70, 74, 77] }, // Bb
    { bass: 41, pad: [53, 57, 60], arp: [65, 69, 72, 77, 81, 84] }, // F
    { bass: 48, pad: [60, 64, 67], arp: [60, 64, 67, 72, 76, 79] }, // C
  ];
  // 8th-note arpeggio patterns, -1 = breathe. A/B alternate every bar so the
  // 8-bar loop varies a little without ever being random.
  const UW_PAT_A = [0, 1, 2, 3, 4, 3, 2, -1];
  const UW_PAT_B = [0, 2, 4, 5, 4, 2, 1, -1];
  // TITLE — sparse, dreamy: one slow pad per bar, a few long plucked notes.
  const TITLE_CHORDS = [
    [50, 53, 57], [58, 62, 65], [53, 57, 60], [60, 64, 67], // Dm Bb F C
    [50, 53, 57], [58, 62, 65], [55, 58, 62], [57, 61, 64], // Dm Bb Gm A
  ];
  // CLEAR — upbeat C-major fanfare loop: one chord + one melody bar each.
  const CLEAR_CHORDS = [
    { c: [60, 64, 67], r: 48 }, { c: [65, 69, 72], r: 41 }, // C, F
    { c: [67, 71, 74], r: 43 }, { c: [60, 64, 67], r: 48 }, // G, C
  ];
  const CLEAR_MEL = [
    [79, 84, 88, 91, 88, 84, 79, 76], [77, 81, 84, 89, 84, 81, 77, 72],
    [79, 83, 86, 91, 86, 83, 79, 74], [84, 88, 91, 88, 84, 79, 76, 72],
  ];

  /* ====================================================================== */
  /* TRACKS — { stepDur, steps, level, send, schedule(a, track, step, t) }  */
  /* `t` is an absolute AudioContext timestamp in seconds.                  */
  /* ====================================================================== */
  const TRACKS = {
    underwater: {
      name: 'underwater', bpm: 96, steps: 64, stepDur: 60 / 96 / 2, // 0.3125 s
      level: 0.8, send: 0.1,
      schedule(a, tr, i, t) {
        const barDur = tr.def.stepDur * 8;
        const bar = (i >> 3) & 7;           // chord changes every 2 bars
        const s = i & 7;                    // eighth-note position in the bar
        const ch = UW_CHORDS[bar >> 1];
        if (s === 0) {
          a._pad(tr.gain, t, ch.pad, barDur * 1.04, 0.048, 0); // slow-attack chord
          a._bass(tr.gain, t, ch.bass, 0.1, 0.55, 0);          // beat 1
        }
        if (s === 4) a._bass(tr.gain, t, ch.bass, 0.075, 0.42, 0); // beat 3
        const idx = (bar % 2 === 0 ? UW_PAT_A : UW_PAT_B)[s];
        if (idx >= 0) a._pluck(tr.gain, t, ch.arp[idx], 0.058, s % 2 ? 0.26 : -0.26, 0.5);
        if (i % 13 === 7) { // occasional high bubble sparkle, very quiet
          const n = 86 + Math.floor(rand01(i * 5.1) * 8);
          a._tone(t, { type: 'sine', f0: hz(n), f1: hz(n) * 1.55, dur: 0.09, vol: 0.02,
            atk: 0.002, pan: (rand01(i * 2.7) - 0.5) * 0.9, bus: tr.gain });
        }
      },
    },
    title: {
      name: 'title', bpm: 72, steps: 64, stepDur: 60 / 72 / 2, // 0.4167 s
      level: 0.65, send: 0.3, // lots of echo: dreamy
      schedule(a, tr, i, t) {
        const barDur = tr.def.stepDur * 8, bar = (i >> 3) & 7, s = i & 7;
        const chord = TITLE_CHORDS[bar];
        if (s === 0) a._pad(tr.gain, t, chord, barDur * 1.15, 0.05, 0); // long swell
        // sparse music-box notes: beat 1, the "and" of 2, sometimes beat 3
        if (s === 0 || s === 3 || (s === 6 && (bar & 1))) {
          const n = chord[(i * 5 + 1) % 3] + 12;
          a._pluck(tr.gain, t + 0.01, n, 0.05, s % 2 ? 0.3 : -0.3, 1.5);
        }
      },
    },
    clear: {
      name: 'clear', bpm: 132, steps: 32, stepDur: 60 / 132 / 2, // 0.2273 s
      level: 0.85, send: 0.12,
      schedule(a, tr, i, t) {
        const bar = (i >> 3) & 3, s = i & 7, ch = CLEAR_CHORDS[bar];
        if (s === 0 || s === 4) {
          a._stab(tr.gain, t, ch.c, 0.032, 0.18); // brass chord
          a._bass(tr.gain, t, ch.r, 0.08, 0.2, 0); // C3/F2/G2 roots
          a._tone(t, { type: 'sine', f0: 120, f1: 48, dur: 0.12, vol: 0.07, atk: 0.003, bus: tr.gain }); // kick
        }
        if (s & 1) a._hat(tr.gain, t, 0.012, s % 4 === 1 ? -0.2 : 0.2); // offbeat hat
        const m = CLEAR_MEL[bar][s];
        if (m >= 0) a._lead(tr.gain, t, m, 0.05, 0.17, s & 1 ? 0.24 : -0.24);
      },
    },
  };

  /* ====================================================================== */
  /* M32.Audio                                                              */
  /* ====================================================================== */
  M32.Audio = class Audio {
    constructor() {
      this._ctx = null; this._failed = false; this._unlocked = false;
      this._muted = false; this._master = null; this._sfxBus = null;
      this._musicBus = null; this._limiter = null; this._delayIn = null;
      this._noiseBuf = null; this._hasPan = false;
      this._tracks = [];              // live + fading-out track records
      this._current = null;           // track currently receiving new steps
      this._wantedMusic = 'none';     // remembered while locked, applied on unlock
      this._lastNow = -1;             // previous ctx.currentTime, for the jump clamp
      this._sfxLog = [];              // end timestamps for the active-voice cap
      this._lastSFX = Object.create(null); // per-name cooldowns
      this._swim = null;              // water-bed nodes
      this._swimAuto = false;         // driven by music('underwater')
      this._swimForced = null;        // manual play('swimLoop') override
      this._swimTarget = 0.0001;
      M32.Audio.instance = this;      // main.js also sets this; core.js needs it early
    }

    /* ------------------------------------------------------------- public */

    /** Resume the context from a user gesture. Safe to call every frame. */
    unlock() {
      if (this._failed) return;
      if (this._unlocked) { this._resume(); return; }
      if (!this._ensure()) return;
      this._unlocked = true;
      this._resume();
      if (this._wantedMusic !== 'none' && !this._current) {
        try { this._switchMusic(this._wantedMusic); } catch (e) { /* no-op */ }
      }
    }

    /** Fire-and-forget SFX. opts: {vol, pitch, pan, dur}. */
    play(name, opts) {
      if (!this._ready()) return;
      try {
        opts = opts || {};
        if (name === 'swimLoop') { this._setSwimLoop(opts); return; }
        const build = SFX[name];
        if (!build) return;
        const now = this._ctx.currentTime;
        const gap = SFX_GAP[name] || 0;
        const last = this._lastSFX[name];
        if (gap > 0 && last != null && now - last < gap) return; // spam guard
        for (let i = this._sfxLog.length - 1; i >= 0; i--) { // prune finished starts
          if (this._sfxLog[i] <= now) this._sfxLog.splice(i, 1);
        }
        if (this._sfxLog.length >= (IMPORTANT[name] ? 32 : 18)) return;
        const c = {
          p: clamp(opts.pitch == null ? 1 : opts.pitch, 0.25, 4), // pitch multiplier
          v: clamp(opts.vol == null ? 1 : opts.vol, 0, 2.5),      // volume multiplier
          pan: opts.pan == null ? null : clamp(opts.pan, -1, 1),
          dur: opts.dur == null ? null : Math.max(0.02, opts.dur),
        };
        const ret = build(this, now + 0.004, c);
        this._lastSFX[name] = now;
        this._sfxLog.push(now + Math.max(0.05, ret || 0.4));
      } catch (e) { /* audio must never break the game */ }
    }

    /** Crossfade to a music state. 'none' fades everything out. */
    music(state) {
      if (!state) state = 'none';
      if (state !== 'none' && !TRACKS[state]) return;
      this._wantedMusic = state;
      this._swimForced = null; // music() owns the swim bed again
      this._swimAuto = state === 'underwater';
      if (!this._ready()) return; // applied by unlock()
      try { this._switchMusic(state); } catch (e) { /* no-op */ }
    }

    /** Fade the master to silence (true) or back to 0.5 (false). */
    setMuted(v) {
      this._muted = !!v;
      if (!this._ctx || !this._master) return;
      try {
        const now = this._ctx.currentTime, g = this._master.gain;
        g.cancelScheduledValues(now);
        g.setTargetAtTime(this._muted ? 0.0001 : MASTER_LEVEL, now, 0.025);
      } catch (e) { /* no-op */ }
    }

    get muted() { return this._muted; }

    /** Once per fixed gameplay step; schedules sequencer steps. */
    tick(dt) {
      if (!this._ready()) return;
      try {
        const now = this._ctx.currentTime;
        // Paused tab / fast-forward: re-anchor instead of scheduling the
        // whole missed backlog in one burst.
        if (this._lastNow >= 0 && now - this._lastNow > 0.5 && this._current) {
          this._current.nextTime = now + 0.05;
        }
        this._lastNow = now;
        this._cleanupTracks(now);
        this._schedule(now);
        this._updateSwimBed(now);
      } catch (e) { /* no-op */ }
    }

    /* ------------------------------------------------------- audio graph */

    _ready() { return !!(this._unlocked && this._ctx && !this._failed); }

    /** Lazily create AudioContext + mixer. @returns {boolean} */
    _ensure() {
      if (this._ctx) return true;
      if (this._failed) return false;
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) { this._failed = true; return false; }
      let ctx = null;
      try { ctx = new AC({ latencyHint: 'interactive' }); }
      catch (e) {
        try { ctx = new AC(); } catch (e2) { this._failed = true; return false; }
      }
      try { this._ctx = ctx; this._buildGraph(ctx); }
      catch (e) { this._ctx = null; this._failed = true; return false; }
      return true;
    }

    _buildGraph(ctx) {
      // master -> soft limiter -> speakers
      this._master = ctx.createGain();
      this._master.gain.value = this._muted ? 0.0001 : MASTER_LEVEL;
      this._limiter = ctx.createDynamicsCompressor();
      this._limiter.threshold.value = -10; this._limiter.knee.value = 8;
      this._limiter.ratio.value = 8; this._limiter.attack.value = 0.003;
      this._limiter.release.value = 0.18;
      this._master.connect(this._limiter);
      this._limiter.connect(ctx.destination);
      // separate SFX / music buses under the master
      this._sfxBus = ctx.createGain();
      this._sfxBus.gain.value = SFX_BUS;
      this._sfxBus.connect(this._master);
      this._musicBus = ctx.createGain();
      this._musicBus.gain.value = MUSIC_BUS;
      this._musicBus.connect(this._master);
      // simple feedback delay ("air" of the underwater / title stages)
      this._delayIn = ctx.createGain();
      const dly = ctx.createDelay(0.6), lp = ctx.createBiquadFilter();
      dly.delayTime.value = 0.31; lp.type = 'lowpass'; lp.frequency.value = 2200;
      const wet = ctx.createGain(), fb = ctx.createGain();
      wet.gain.value = 0.4; fb.gain.value = 0.32;
      this._delayIn.connect(dly); dly.connect(lp); lp.connect(wet);
      wet.connect(this._master); lp.connect(fb); fb.connect(dly);
      // one reusable 2 s white-noise buffer for every noise-based SFX
      const n = Math.max(1, Math.floor(ctx.sampleRate * 2));
      this._noiseBuf = ctx.createBuffer(1, n, ctx.sampleRate);
      const data = this._noiseBuf.getChannelData(0);
      for (let i = 0; i < n; i++) data[i] = Math.random() * 2 - 1;
      this._hasPan = typeof ctx.createStereoPanner === 'function';
    }

    _resume() {
      const ctx = this._ctx;
      if (!ctx) return;
      if (ctx.state === 'suspended' || ctx.state === 'interrupted') {
        try {
          const p = ctx.resume();
          if (p && p.catch) p.catch(() => {});
        } catch (e) { /* no-op */ }
      }
    }

    /** Connect src to dest with an optional StereoPanner. */
    _out(src, pan, dest) {
      const ctx = this._ctx;
      dest = dest || this._sfxBus;
      if (!ctx || !dest) return;
      if (pan != null && this._hasPan && Math.abs(pan) > 0.001) {
        const p = ctx.createStereoPanner();
        p.pan.value = clamp(pan, -1, 1);
        src.connect(p); p.connect(dest);
        return;
      }
      src.connect(dest);
    }

    /* -------------------------------------------------------- instruments */

    /** Oscillator one-shot, attack -> (hold) -> decay.
     *  o: {type,f0,f1,dur,vol,atk,hold,detune,pan,bus,ff,ff1,Q,ftype}
     *  @returns {number} duration */
    _tone(t, o) {
      const ctx = this._ctx;
      if (!ctx) return 0;
      const t0 = Math.max(t, ctx.currentTime);
      const dur = Math.max(0.025, o.dur || 0.15);
      const atk = Math.min(o.atk == null ? 0.006 : o.atk, dur * 0.45);
      const vol = Math.max(0.0002, o.vol == null ? 0.1 : o.vol);
      try {
        const osc = ctx.createOscillator();
        osc.type = o.type || 'sine';
        const f0 = Math.max(8, o.f0 || 440);
        osc.frequency.setValueAtTime(f0, t0);
        if (o.f1 && o.f1 !== f0) {
          osc.frequency.exponentialRampToValueAtTime(Math.max(8, o.f1), t0 + dur);
        }
        if (o.detune) osc.detune.value = o.detune;
        let node = osc;
        if (o.ff) { // optional static/ramping lowpass
          const f = ctx.createBiquadFilter();
          f.type = o.ftype || 'lowpass';
          f.frequency.setValueAtTime(Math.max(20, o.ff), t0);
          if (o.ff1) f.frequency.exponentialRampToValueAtTime(Math.max(20, o.ff1), t0 + dur);
          f.Q.value = o.Q == null ? 0.7 : o.Q;
          osc.connect(f); node = f;
        }
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.linearRampToValueAtTime(vol, t0 + atk);
        if (o.hold) { // pad shape: sustain before the release
          g.gain.setValueAtTime(vol, Math.max(t0 + atk + 0.005, t0 + dur * o.hold));
        }
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
        node.connect(g);
        this._out(g, o.pan, o.bus || this._sfxBus);
        osc.start(t0); osc.stop(t0 + dur + 0.04);
        return dur;
      } catch (e) { return 0; }
    }

    /** Filtered-noise one-shot (whooshes, thumps, splashes, hats).
     *  o: {dur,vol,atk,pan,bus,filterType,f0,f1,Q} */
    _noise(t, o) {
      const ctx = this._ctx;
      if (!ctx || !this._noiseBuf) return 0;
      const t0 = Math.max(t, ctx.currentTime);
      const dur = Math.max(0.02, o.dur || 0.12);
      const atk = Math.min(o.atk == null ? 0.004 : o.atk, dur * 0.5);
      const vol = Math.max(0.0002, o.vol == null ? 0.08 : o.vol);
      try {
        const src = ctx.createBufferSource();
        src.buffer = this._noiseBuf; src.loop = true;
        const off = Math.random() * Math.max(0, this._noiseBuf.duration - dur - 0.02);
        const f = ctx.createBiquadFilter();
        f.type = o.filterType || 'bandpass';
        f.frequency.setValueAtTime(Math.max(20, o.f0 || 800), t0);
        if (o.f1) f.frequency.exponentialRampToValueAtTime(Math.max(20, o.f1), t0 + dur);
        f.Q.value = o.Q == null ? 1 : o.Q;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.linearRampToValueAtTime(vol, t0 + atk);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
        src.connect(f); f.connect(g);
        this._out(g, o.pan, o.bus || this._sfxBus);
        src.start(t0, off); src.stop(t0 + dur + 0.03);
        return dur;
      } catch (e) { return 0; }
    }

    // --- music voices; `bus` is always a track gain node -------------------

    /** Slow-attack pad chord (triangle + sines through a lowpass). */
    _pad(bus, t, notes, dur, vol, pan) {
      for (let i = 0; i < notes.length; i++) {
        this._tone(t, { type: i === 0 ? 'triangle' : 'sine', f0: hz(notes[i]), dur, vol,
          atk: Math.min(0.7, dur * 0.3), hold: 0.6, ff: 1500 + i * 260, Q: 0.7,
          pan: pan + (i - (notes.length - 1) / 2) * 0.14, bus });
      }
    }

    /** Plucked music-box note with ±3 % random detune for life. */
    _pluck(bus, t, note, vol, pan, dur) {
      dur = dur || 0.5;
      const det = 1 + (rand01(note * 12.9 + t * 3.7) - 0.5) * 0.06;
      this._tone(t, { type: 'triangle', f0: hz(note) * det, dur, vol, atk: 0.005,
        ff: Math.min(5200, hz(note) * 7), Q: 0.7, pan, bus });
      this._tone(t, { type: 'sine', f0: hz(note + 12) * det, dur: dur * 0.55,
        vol: vol * 0.3, atk: 0.004, pan, bus });
    }

    /** Soft bass pulse (triangle, plus a sub sine when it stays audible). */
    _bass(bus, t, note, vol, dur, pan) {
      this._tone(t, { type: 'triangle', f0: hz(note), dur, vol, atk: 0.01, ff: 460, Q: 0.8, pan, bus });
      // skip sub-octaves below ~40 Hz: inaudible, but they eat headroom
      if (note - 12 >= 28) {
        this._tone(t, { type: 'sine', f0: hz(note - 12), dur, vol: vol * 0.45, atk: 0.015, pan, bus });
      }
    }

    /** Short brass-ish chord stab. */
    _stab(bus, t, notes, vol, dur) {
      for (let i = 0; i < notes.length; i++) {
        this._tone(t, { type: 'square', f0: hz(notes[i]), dur, vol, atk: 0.006,
          ff: 2600, Q: 0.8, pan: (i - 1) * 0.18, bus });
      }
    }

    /** Bright square lead (clear fanfare). */
    _lead(bus, t, note, vol, dur, pan) {
      this._tone(t, { type: 'square', f0: hz(note), dur, vol, atk: 0.004, ff: 4200, Q: 0.7, pan, bus });
      this._tone(t, { type: 'triangle', f0: hz(note - 12), dur, vol: vol * 0.35, atk: 0.004, pan, bus });
    }

    /** Tiny highpassed noise hat. */
    _hat(bus, t, vol, pan) {
      this._noise(t, { dur: 0.03, vol, atk: 0.001, filterType: 'highpass', f0: 6500, Q: 0.7, pan, bus });
    }

    /* ---------------------------------------------------------- swim bed */

    /** Start the continuous underwater water bed (only once). */
    _ensureSwimBed() {
      if (this._swim || !this._ctx || !this._noiseBuf) return;
      const ctx = this._ctx;
      try {
        const src = ctx.createBufferSource();
        src.buffer = this._noiseBuf; src.loop = true;
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass'; lp.frequency.value = 420; lp.Q.value = 0.7;
        const hp = ctx.createBiquadFilter();
        hp.type = 'highpass'; hp.frequency.value = 110;
        const g = ctx.createGain(); g.gain.value = 0.0001;
        src.connect(lp); lp.connect(hp); hp.connect(g);
        g.connect(this._sfxBus); // ambience lives on the SFX bus, under music
        let lfo = null, lfoGain = null; // slow drift, never a static hiss
        try {
          lfo = ctx.createOscillator(); lfo.frequency.value = 0.19;
          lfoGain = ctx.createGain(); lfoGain.gain.value = 110;
          lfo.connect(lfoGain); lfoGain.connect(lp.frequency); lfo.start();
        } catch (e) { lfo = null; }
        src.start();
        this._swim = { src, lp, hp, g, lfo, lfoGain };
        this._swimTarget = 0.0001;
      } catch (e) { this._swim = null; }
    }

    /** play('swimLoop', {loop}) */
    _setSwimLoop(opts) {
      const on = !(opts && opts.loop === false);
      this._swimForced = on;
      if (on) this._ensureSwimBed();
    }

    _playerSpeed(p) {
      if (!p) return 0;
      let vx = 0, vy = 0;
      if (typeof p.vx === 'number') vx = p.vx;
      else if (p.vel && typeof p.vel.x === 'number') vx = p.vel.x;
      else if (p.velocity && typeof p.velocity.x === 'number') vx = p.velocity.x;
      else if (p.body && typeof p.body.vx === 'number') vx = p.body.vx;
      if (typeof p.vy === 'number') vy = p.vy;
      else if (p.vel && typeof p.vel.y === 'number') vy = p.vel.y;
      else if (p.velocity && typeof p.velocity.y === 'number') vy = p.velocity.y;
      else if (p.body && typeof p.body.vy === 'number') vy = p.body.vy;
      if (vx === 0 && vy === 0 && typeof p.speed === 'number') return Math.abs(p.speed);
      return Math.hypot(vx, vy);
    }

    _updateSwimBed(now) {
      const on = this._swimForced !== null ? this._swimForced : this._swimAuto;
      if (!on) { if (this._swim) this._setSwimGain(0.0001, now); return; }
      this._ensureSwimBed();
      if (!this._swim) return;
      let speed = 0, inWater = true;
      try {
        const G = M.Game, pl = G && G.player;
        if (pl) speed = this._playerSpeed(pl);
        if (G && G.level3d && G.level3d.inWater && pl) {
          inWater = !!G.level3d.inWater(pl.x, (pl.y || 0) + 14);
        }
      } catch (e) { inWater = true; }
      const norm = clamp(speed / 420, 0, 1); // 0..1 swimming effort
      this._setSwimGain((inWater ? 0.05 : 0.012) * (0.35 + 0.9 * norm), now);
    }

    _setSwimGain(target, now) {
      if (!this._swim) return;
      target = Math.max(0.0001, target);
      if (Math.abs(target - this._swimTarget) < 0.004) return; // avoid automation spam
      this._swimTarget = target;
      try { this._swim.g.gain.setTargetAtTime(target, now, 0.12); } catch (e) { /* no-op */ }
    }

    /* ------------------------------------------------------ music engine */

    _switchMusic(state) {
      const ctx = this._ctx;
      if (!ctx) return;
      const now = ctx.currentTime;
      if (this._current && this._current.name === state && this._current.retireAt === Infinity) return;
      // fade out anything still sounding (current + any previous fade)
      for (let i = 0; i < this._tracks.length; i++) {
        const tr = this._tracks[i];
        if (tr.retireAt <= now) continue;
        tr.retireAt = now + RETIRE_AFTER;
        const g = tr.gain.gain;
        try {
          g.cancelScheduledValues(now);
          if (g.cancelAndHoldAtTime) g.cancelAndHoldAtTime(now);
          else g.setValueAtTime(Math.max(g.value, 0.0001), now);
          g.exponentialRampToValueAtTime(0.0001, now + XFADE);
        } catch (e) { /* no-op */ }
      }
      this._current = null;
      if (state === 'none') return;
      const def = TRACKS[state];
      if (!def) return;
      this._current = this._createTrack(def, now);
      this._tracks.push(this._current);
    }

    _createTrack(def, now) {
      const ctx = this._ctx, gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(def.level, now + XFADE); // fade in
      gain.connect(this._musicBus);
      if (def.send > 0 && this._delayIn) { // per-track echo send
        const send = ctx.createGain();
        send.gain.value = def.send;
        gain.connect(send); send.connect(this._delayIn);
      }
      return { name: def.name, def, gain, step: 0,
        nextTime: now + 0.08, retireAt: Infinity }; // 0.08 s head start
    }

    _cleanupTracks(now) {
      for (let i = this._tracks.length - 1; i >= 0; i--) {
        const tr = this._tracks[i];
        if (tr.retireAt <= now) {
          try { tr.gain.disconnect(); } catch (e) { /* no-op */ }
          this._tracks.splice(i, 1);
        }
      }
    }

    /** Schedule every step inside the lookahead window. Steps derive from
     *  ctx.currentTime, never accumulated dt, so tempo cannot drift. */
    _schedule(now) {
      const tr = this._current;
      if (!tr) return;
      const def = tr.def;
      let guard = 0;
      while (tr.nextTime < now + LOOKAHEAD && guard < 64) {
        try { def.schedule(this, tr, tr.step, tr.nextTime); }
        catch (e) { /* a bad step must not kill the loop */ }
        tr.step = (tr.step + 1) % def.steps;
        tr.nextTime += def.stepDur;
        guard++;
      }
      if (tr.nextTime < now - 0.25) tr.nextTime = now + 0.03; // fell far behind
    }
  };

  /* ====================================================================== */
  /* SFX BUILDERS — all synthesized from scratch.                           */
  /* (audio, t, c) -> duration; c = {p: pitch mult, v: volume mult, pan, dur} */
  /* One-shots honour c.dur; jingles keep their own note timing.            */
  /* ====================================================================== */
  const SFX = {
    // short ascending square blip
    jump(a, t, c) {
      const d = c.dur || 0.12;
      a._tone(t, { type: 'square', f0: 300 * c.p, f1: 680 * c.p, dur: d, vol: 0.1 * c.v, atk: 0.005, ff: 2600 * c.p, Q: 0.8, pan: c.pan });
      a._tone(t + 0.01, { type: 'triangle', f0: 600 * c.p, f1: 1360 * c.p, dur: d * 0.8, vol: 0.045 * c.v, atk: 0.004, pan: c.pan });
      return d + 0.04;
    },
    // soft water whoosh + low sine plop
    stroke(a, t, c) {
      const d = c.dur || 0.18;
      a._noise(t, { dur: d, vol: 0.07 * c.v, filterType: 'bandpass', f0: 380 * c.p, f1: 1700 * c.p, Q: 1.3, pan: c.pan });
      a._tone(t + 0.01, { type: 'sine', f0: 180 * c.p, f1: 80 * c.p, dur: d * 0.8, vol: 0.075 * c.v, atk: 0.006, pan: c.pan });
      a._tone(t + d * 0.5, { type: 'sine', f0: 700 * c.p, f1: 1100 * c.p, dur: 0.05, vol: 0.022 * c.v, atk: 0.002, pan: c.pan });
      return d + 0.06;
    },
    // bigger splash whoosh (surface breach / pipe exit)
    surface(a, t, c) {
      const d = c.dur || 0.34;
      a._noise(t, { dur: d, vol: 0.13 * c.v, filterType: 'lowpass', f0: 2800 * c.p, f1: 480 * c.p, Q: 0.9, pan: c.pan });
      a._noise(t, { dur: d * 0.6, vol: 0.05 * c.v, filterType: 'highpass', f0: 1300 * c.p, f1: 600 * c.p, Q: 0.7, pan: c.pan });
      a._tone(t, { type: 'sine', f0: 240 * c.p, f1: 60 * c.p, dur: d * 0.9, vol: 0.09 * c.v, atk: 0.006, pan: c.pan });
      return d + 0.05;
    },
    // classic two-note coin: B5 -> E6
    coin(a, t, c) {
      a._tone(t, { type: 'square', f0: 988 * c.p, dur: 0.06, vol: 0.075 * c.v, atk: 0.002, ff: 4200 * c.p, pan: c.pan });
      a._tone(t + 0.055, { type: 'square', f0: 1319 * c.p, dur: 0.1, vol: 0.085 * c.v, atk: 0.002, ff: 4600 * c.p, pan: c.pan });
      return 0.16;
    },
    // short descending thump + noise
    stomp(a, t, c) {
      a._tone(t, { type: 'triangle', f0: 190 * c.p, f1: 60 * c.p, dur: 0.1, vol: 0.13 * c.v, atk: 0.003, pan: c.pan });
      a._noise(t, { dur: 0.08, vol: 0.07 * c.v, filterType: 'lowpass', f0: 900 * c.p, f1: 220 * c.p, Q: 0.8, pan: c.pan });
      return 0.13;
    },
    // blooper squish: lowpassed noise burst
    squish(a, t, c) {
      a._noise(t, { dur: 0.16, vol: 0.1 * c.v, filterType: 'bandpass', f0: 900 * c.p, f1: 260 * c.p, Q: 2.4, pan: c.pan });
      a._tone(t, { type: 'sine', f0: 140 * c.p, f1: 55 * c.p, dur: 0.13, vol: 0.07 * c.v, pan: c.pan });
      return 0.18;
    },
    // ? block bump: short woody thunk
    block(a, t, c) {
      a._tone(t, { type: 'square', f0: 210 * c.p, f1: 130 * c.p, dur: 0.07, vol: 0.08 * c.v, ff: 1700 * c.p, Q: 1, pan: c.pan });
      a._noise(t, { dur: 0.05, vol: 0.055 * c.v, filterType: 'bandpass', f0: 1100 * c.p, Q: 2.8, pan: c.pan });
      a._tone(t, { type: 'triangle', f0: 105 * c.p, f1: 70 * c.p, dur: 0.09, vol: 0.07 * c.v, pan: c.pan });
      return 0.11;
    },
    // ascending major arpeggio
    powerup(a, t, c) {
      const seq = [[0, 72, 0.14], [0.07, 76, 0.14], [0.14, 79, 0.14], [0.22, 84, 0.18], [0.32, 88, 0.26]];
      for (let i = 0; i < seq.length; i++) {
        a._tone(t + seq[i][0], { type: 'square', f0: hz(seq[i][1]) * c.p, dur: seq[i][2], vol: 0.07 * c.v, atk: 0.004, ff: 3600, Q: 0.7, pan: c.pan });
      }
      return 0.6;
    },
    // the four-note 1-Up jingle
    oneup(a, t, c) {
      const seq = [[0, 76, 0.16], [0.11, 79, 0.16], [0.23, 88, 0.2], [0.36, 84, 0.36]];
      for (let i = 0; i < seq.length; i++) {
        a._tone(t + seq[i][0], { type: 'square', f0: hz(seq[i][1]) * c.p, dur: seq[i][2], vol: 0.075 * c.v, atk: 0.004, ff: 3800, Q: 0.7, pan: c.pan });
        a._tone(t + seq[i][0], { type: 'triangle', f0: hz(seq[i][1] + 12) * c.p, dur: seq[i][2] * 0.7, vol: 0.025 * c.v, atk: 0.004, pan: c.pan });
      }
      return 0.75;
    },
    // descending sawtooth buzz
    damage(a, t, c) {
      a._tone(t, { type: 'sawtooth', f0: 430 * c.p, f1: 95 * c.p, dur: 0.3, vol: 0.09 * c.v, atk: 0.004, ff: 1700 * c.p, ff1: 420 * c.p, Q: 1.2, pan: c.pan });
      a._tone(t, { type: 'square', f0: 215 * c.p, f1: 52 * c.p, dur: 0.28, vol: 0.05 * c.v, atk: 0.004, pan: c.pan });
      return 0.33;
    },
    // classic death jingle: fast chromatic run down, then a low note
    die(a, t, c) {
      const run = [84, 82, 81, 79, 78, 76, 74, 73, 71, 69, 67];
      for (let k = 0; k < run.length; k++) {
        a._tone(t + k * 0.085, { type: 'square', f0: hz(run[k]) * c.p, dur: 0.11, vol: 0.06 * c.v, atk: 0.003, ff: 2600, Q: 0.7, pan: c.pan });
      }
      a._tone(t + 0.95, { type: 'triangle', f0: hz(43) * c.p, f1: hz(36) * c.p, dur: 0.3, vol: 0.09 * c.v, atk: 0.006, pan: c.pan }); // low G2 -> C2
      return 1.28;
    },
    // level-clear fanfare (~2.5 s; music('clear') is a separate loop)
    clear(a, t, c) {
      const mel = [
        [0, 72, 0.14], [0.15, 76, 0.14], [0.3, 79, 0.14], [0.46, 84, 0.26],
        [0.76, 77, 0.14], [0.91, 81, 0.14], [1.06, 84, 0.16],
        [1.24, 79, 0.14], [1.39, 83, 0.14], [1.54, 86, 0.18], [1.76, 84, 0.26],
      ];
      for (let i = 0; i < mel.length; i++) {
        a._tone(t + mel[i][0], { type: 'square', f0: hz(mel[i][1]) * c.p, dur: mel[i][2], vol: 0.06 * c.v, atk: 0.004, ff: 4200, Q: 0.7, pan: c.pan });
      }
      const chord = [72, 76, 79, 84]; // final C major chord, held to the end
      for (let i = 0; i < chord.length; i++) {
        a._tone(t + 2.0, { type: 'square', f0: hz(chord[i]) * c.p, dur: 0.5, vol: 0.04 * c.v, atk: 0.008, ff: 3200, Q: 0.7, pan: c.pan });
      }
      a._tone(t + 2.0, { type: 'triangle', f0: hz(48) * c.p, dur: 0.5, vol: 0.07 * c.v, atk: 0.008, pan: c.pan });
      return 2.55;
    },
    // tiny bubble pop
    bubble(a, t, c) {
      a._tone(t, { type: 'sine', f0: 700 * c.p, f1: 1650 * c.p, dur: 0.055, vol: 0.045 * c.v, atk: 0.002, pan: c.pan });
      a._tone(t + 0.015, { type: 'sine', f0: 1400 * c.p, f1: 650 * c.p, dur: 0.05, vol: 0.03 * c.v, atk: 0.002, pan: c.pan });
      return 0.08;
    },
    // electric zigzag buzz for jellyfish: FM square + crackle noise, quiet
    jelectro(a, t, c) {
      const ctx = a._ctx;
      if (!ctx) return 0;
      const t0 = Math.max(t, ctx.currentTime), dur = 0.22, vol = 0.045 * c.v;
      try {
        const car = ctx.createOscillator();
        car.type = 'square'; car.frequency.value = 85 * c.p;
        const mod = ctx.createOscillator();
        mod.type = 'sine'; mod.frequency.value = 34;
        const mg = ctx.createGain(); mg.gain.value = 65 * c.p;
        mod.connect(mg); mg.connect(car.frequency);
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass'; lp.frequency.value = 1300 * c.p; lp.Q.value = 2;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t0);
        for (let k = 0; k < 4; k++) { // four little stutters -> electric sizzle
          const tt = t0 + k * 0.05;
          g.gain.linearRampToValueAtTime(vol, tt + 0.008);
          g.gain.linearRampToValueAtTime(vol * 0.15, tt + 0.04);
        }
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
        car.connect(lp); lp.connect(g); a._out(g, c.pan, a._sfxBus);
        car.start(t0); mod.start(t0);
        car.stop(t0 + dur + 0.03); mod.stop(t0 + dur + 0.03);
      } catch (e) { return 0; }
      a._noise(t0, { dur: 0.16, vol: 0.03 * c.v, filterType: 'bandpass', f0: 2400 * c.p, f1: 1800 * c.p, Q: 6, pan: c.pan });
      return dur + 0.04;
    },
    // low ominous hit / rumble
    boss(a, t, c) {
      a._tone(t, { type: 'sine', f0: 58 * c.p, f1: 26 * c.p, dur: 0.9, vol: 0.2 * c.v, atk: 0.01, pan: c.pan });
      a._tone(t + 0.18, { type: 'sine', f0: 44 * c.p, f1: 22 * c.p, dur: 0.65, vol: 0.14 * c.v, atk: 0.01, pan: c.pan });
      a._noise(t, { dur: 0.8, vol: 0.1 * c.v, filterType: 'lowpass', f0: 150 * c.p, f1: 55 * c.p, Q: 1.1, pan: c.pan });
      return 0.95;
    },
    // short UI blip (pause)
    pause(a, t, c) {
      a._tone(t, { type: 'square', f0: 700 * c.p, dur: 0.05, vol: 0.045 * c.v, atk: 0.002, pan: c.pan });
      a._tone(t + 0.06, { type: 'square', f0: 1000 * c.p, dur: 0.06, vol: 0.04 * c.v, atk: 0.002, pan: c.pan });
      return 0.13;
    },
    // warning tick (timer low)
    timer(a, t, c) {
      a._tone(t, { type: 'square', f0: 1250 * c.p, dur: 0.045, vol: 0.05 * c.v, atk: 0.002, pan: c.pan });
      a._tone(t + 0.11, { type: 'square', f0: 1250 * c.p, dur: 0.045, vol: 0.034 * c.v, atk: 0.002, pan: c.pan });
      return 0.18;
    },
  };

  // minimum seconds between two calls of the same SFX (spam guards).
  // coin/bubble are below one 60 Hz frame so rapid pickup runs still sound.
  // The event-driven sounds also collapse accidental same-frame duplicates
  // (e.g. a module playing 'damage' directly and main.js playing it again).
  const SFX_GAP = {
    jelectro: 0.3, bubble: 0.012, coin: 0.012, block: 0.03, timer: 0.2,
    stomp: 0.03, damage: 0.06, oneup: 0.07, boss: 0.06, powerup: 0.06,
  };
  // rare, dramatic sounds are allowed past the normal voice cap
  const IMPORTANT = { die: true, clear: true, oneup: true, powerup: true, damage: true, boss: true };
})();
