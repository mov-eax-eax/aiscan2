// Procedural ambience for the Sagrada Família experience. No audio files.
//
// Sound only starts after a user gesture (browser policy). Everything is
// wrapped so an unavailable / blocked AudioContext fails silently.
//
// Layers:
//   wind      filtered noise bed, slowly gusting with altitude
//   city      distant low rumble
//   bells     sparse synthesised church-bell tolls from somewhere in the city
//   reverb    generated impulse response, faded in when the listener is inside
//   footsteps short filtered noise taps, stone vs plaza, synced to the walker

import { storageGet, storageSet } from './util.js';

const MUTE_KEY = 'sagrada.soundMuted';

export function createAudio() {
  let ctx = null;
  let master = null;
  let started = false;
  let disposed = false;
  let failed = false;

  let windGain = null;
  let windFilter = null;
  let windSource = null;
  let cityGain = null;
  let citySource = null;
  let ambientBus = null;
  let dryGain = null;
  let reverbSend = null;
  let wetGain = null;
  let convolver = null;
  let footBus = null;
  let bellBus = null;

  let noiseBuffer = null;
  let stepBuffer = null;
  let bellTimer = 0;

  let muted = storageGet(MUTE_KEY, '0') === '1';
  let interior = 0;
  let targetInterior = 0;
  let lastMix = -1;
  let lastAltitude = 0;

  const partials = [1, 2.0, 2.98, 4.16, 5.43, 6.79, 8.21];

  function noiseBufferOf(seconds, brown) {
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const data = buf.getChannelData(ch);
      let last = 0;
      for (let i = 0; i < len; i++) {
        const white = Math.random() * 2 - 1;
        if (brown) {
          last = (last + 0.02 * white) / 1.02;
          data[i] = last * 3.2;
        } else {
          data[i] = white * 0.5;
        }
      }
      // Soften the loop seam.
      const fade = Math.min(2048, len >> 3);
      for (let i = 0; i < fade; i++) {
        const k = i / fade;
        data[i] *= k;
        data[len - 1 - i] *= k;
      }
    }
    return buf;
  }

  function impulseBuffer(seconds, decay) {
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const data = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) {
        const env = Math.pow(1 - i / len, decay);
        data[i] = (Math.random() * 2 - 1) * env;
      }
    }
    return buf;
  }

  function loopNoise(buffer) {
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    src.start(0);
    return src;
  }

  function buildGraph() {
    master = ctx.createGain();
    master.gain.value = 0;
    master.connect(ctx.destination);

    // A gentle limiter so bells never clip the ambience.
    let tail = master;
    try {
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -16;
      comp.knee.value = 18;
      comp.ratio.value = 3;
      comp.attack.value = 0.02;
      comp.release.value = 0.3;
      comp.connect(master);
      tail = comp;
    } catch (e) {
      /* ignore */
    }

    convolver = ctx.createConvolver();
    convolver.buffer = impulseBuffer(2.9, 2.4);
    convolver.normalize = true;
    wetGain = ctx.createGain();
    wetGain.gain.value = 0.12;
    convolver.connect(wetGain);
    wetGain.connect(tail);

    reverbSend = ctx.createGain();
    reverbSend.gain.value = 0.7;
    reverbSend.connect(convolver);

    dryGain = ctx.createGain();
    dryGain.gain.value = 0.9;
    dryGain.connect(tail);

    ambientBus = ctx.createGain();
    ambientBus.gain.value = 1;
    ambientBus.connect(dryGain);
    const ambSend = ctx.createGain();
    ambSend.gain.value = 0.35;
    ambientBus.connect(ambSend);
    ambSend.connect(reverbSend);

    noiseBuffer = noiseBufferOf(4.2, false);
    stepBuffer = noiseBufferOf(0.2, false);

    // --- wind -----------------------------------------------------------------
    windSource = loopNoise(noiseBuffer);
    windFilter = ctx.createBiquadFilter();
    windFilter.type = 'lowpass';
    windFilter.frequency.value = 420;
    windFilter.Q.value = 0.4;
    windGain = ctx.createGain();
    windGain.gain.value = 0.075;
    windSource.connect(windFilter);
    windFilter.connect(windGain);
    windGain.connect(ambientBus);
    try {
      const gust = ctx.createOscillator();
      gust.type = 'sine';
      gust.frequency.value = 0.055;
      const gustDepth = ctx.createGain();
      gustDepth.gain.value = 190;
      gust.connect(gustDepth);
      gustDepth.connect(windFilter.frequency);
      gust.start(0);
      const gustAmp = ctx.createOscillator();
      gustAmp.type = 'sine';
      gustAmp.frequency.value = 0.037;
      const gustAmpDepth = ctx.createGain();
      gustAmpDepth.gain.value = 0.022;
      gustAmp.connect(gustAmpDepth);
      gustAmpDepth.connect(windGain.gain);
      gustAmp.start(0);
    } catch (e) {
      /* ignore */
    }

    // --- distant city ---------------------------------------------------------
    citySource = loopNoise(noiseBuffer);
    const cityFilter = ctx.createBiquadFilter();
    cityFilter.type = 'lowpass';
    cityFilter.frequency.value = 150;
    cityFilter.Q.value = 0.7;
    cityGain = ctx.createGain();
    cityGain.gain.value = 0.05;
    citySource.connect(cityFilter);
    cityFilter.connect(cityGain);
    cityGain.connect(ambientBus);

    // --- bell bus -------------------------------------------------------------
    bellBus = ctx.createGain();
    bellBus.gain.value = 1;
    bellBus.connect(dryGain);
    const bellSend = ctx.createGain();
    bellSend.gain.value = 0.9;
    bellBus.connect(bellSend);
    bellSend.connect(reverbSend);

    // --- footsteps ------------------------------------------------------------
    footBus = ctx.createGain();
    footBus.gain.value = 1;
    footBus.connect(dryGain);
    const stepSend = ctx.createGain();
    stepSend.gain.value = 0.5;
    footBus.connect(stepSend);
    stepSend.connect(reverbSend);
  }

  function applyMix(force) {
    if (!ctx || !started) return;
    const t = ctx.currentTime;
    const ni = targetInterior;
    if (!force && Math.abs(ni - lastMix) < 0.01) return;
    lastMix = ni;
    const dry = 0.94 - ni * 0.34;
    const wet = 0.12 + ni * 0.85;
    const windBase = 0.075 * (1 + Math.min(1, lastAltitude / 130) * 0.85) * (1 - ni * 0.55);
    const cityBase = 0.05 * (1 - ni * 0.6);
    try {
      dryGain.gain.setTargetAtTime(dry, t, 0.6);
      wetGain.gain.setTargetAtTime(wet, t, 0.6);
      windGain.gain.setTargetAtTime(windBase, t, 1.4);
      cityGain.gain.setTargetAtTime(cityBase, t, 1.4);
      windFilter.frequency.setTargetAtTime(420 + ni * 90, t, 1.4);
    } catch (e) {
      /* ignore */
    }
  }

  function scheduleBell() {
    if (bellTimer) clearTimeout(bellTimer);
    if (disposed) return;
    const wait = 24000 + Math.random() * 46000;
    bellTimer = setTimeout(() => {
      bellTimer = 0;
      if (disposed) return;
      if (!muted && ctx && ctx.state === 'running' && !document.hidden) toll();
      scheduleBell();
    }, wait);
    if (bellTimer && typeof bellTimer.unref === 'function') bellTimer.unref();
  }

  function toll() {
    if (!ctx || !started) return;
    try {
      const t0 = ctx.currentTime + 0.08;
      const inside = interior > 0.5;
      const base = 168 * (0.94 + Math.random() * 0.12);
      const dur = 5.5 + Math.random() * 2.5;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = inside ? 950 : 2300;
      lp.Q.value = 0.3;
      const out = ctx.createGain();
      out.gain.value = inside ? 0.05 : 0.085;
      let node = lp;
      if (ctx.createStereoPanner) {
        const pan = ctx.createStereoPanner();
        pan.pan.value = (Math.random() * 2 - 1) * 0.65;
        lp.connect(pan);
        node = pan;
      }
      node.connect(out);
      out.connect(bellBus);
      for (let i = 0; i < partials.length; i++) {
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        const detune = 1 + (Math.random() * 2 - 1) * 0.003;
        osc.frequency.value = base * partials[i] * detune;
        const g = ctx.createGain();
        const peak = [0.5, 0.26, 0.17, 0.11, 0.075, 0.05, 0.032][i];
        const life = dur * (1 - i * 0.075);
        const atk = i === 0 ? 0.012 : 0.02;
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.exponentialRampToValueAtTime(peak, t0 + atk);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + life);
        osc.connect(g);
        g.connect(lp);
        osc.start(t0);
        osc.stop(t0 + dur + 0.6);
      }
      // Metallic strike transient.
      const strike = ctx.createBufferSource();
      strike.buffer = stepBuffer;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 2600;
      bp.Q.value = 1.2;
      const sg = ctx.createGain();
      sg.gain.setValueAtTime(0.05, t0);
      sg.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.5);
      strike.connect(bp);
      bp.connect(sg);
      sg.connect(out);
      strike.start(t0);
      strike.stop(t0 + 0.6);
    } catch (e) {
      /* ignore */
    }
  }

  function applyMaster() {
    if (!ctx || !master) return;
    try {
      // Suspended contexts ignore scheduled ramps; resume first where possible.
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      master.gain.setTargetAtTime(muted ? 0 : 0.55, ctx.currentTime, 0.35);
    } catch (e) {
      /* ignore */
    }
  }

  function ensure() {
    if (started || failed || disposed) return started;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) {
        failed = true;
        return false;
      }
      ctx = new AC();
      buildGraph();
      started = true;
      try {
        if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      } catch (e) {
        /* ignore */
      }
      applyMaster();
      scheduleBell();
      applyMix(true);
    } catch (e) {
      failed = true;
      started = false;
      ctx = null;
    }
    return started;
  }

  function footstep(surface) {
    if (!started || !ctx || ctx.state !== 'running' || muted) return;
    try {
      const t0 = ctx.currentTime;
      const src = ctx.createBufferSource();
      src.buffer = stepBuffer;
      src.playbackRate.value = 0.85 + Math.random() * 0.4;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = surface === 'stone' ? 860 + Math.random() * 260 : 520 + Math.random() * 180;
      bp.Q.value = surface === 'stone' ? 1.15 : 0.85;
      const g = ctx.createGain();
      const peak = surface === 'stone' ? 0.045 : 0.07;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(peak + Math.random() * 0.012, t0 + 0.007);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + (surface === 'stone' ? 0.17 : 0.12));
      src.connect(bp);
      bp.connect(g);
      g.connect(footBus);
      src.start(t0);
      src.stop(t0 + 0.22);
    } catch (e) {
      /* ignore */
    }
  }

  function setMuted(value) {
    muted = !!value;
    storageSet(MUTE_KEY, muted ? '1' : '0');
    applyMaster();
    if (!muted) ensure();
    return muted;
  }

  function toggleMuted() {
    return setMuted(!muted);
  }

  function update(dt, info) {
    if (!started || !ctx) return;
    let altitudeChanged = false;
    if (info) {
      targetInterior = info.interior ? 1 : 0;
      if (typeof info.altitude === 'number' && Math.abs(info.altitude - lastAltitude) > 6) {
        lastAltitude = info.altitude;
        altitudeChanged = true;
      }
    }
    interior += (targetInterior - interior) * Math.min(1, dt * 1.6);
    applyMix(altitudeChanged);
  }

  function suspend() {
    try {
      if (ctx && ctx.state === 'running') ctx.suspend().catch(() => {});
    } catch (e) {
      /* ignore */
    }
  }

  function resume() {
    try {
      if (ctx && ctx.state === 'suspended' && !muted) ctx.resume().catch(() => {});
    } catch (e) {
      /* ignore */
    }
  }

  function dispose() {
    disposed = true;
    if (bellTimer) clearTimeout(bellTimer);
    bellTimer = 0;
    try {
      windSource && windSource.stop();
      citySource && citySource.stop();
    } catch (e) {
      /* ignore */
    }
    try {
      if (ctx) ctx.close().catch(() => {});
    } catch (e) {
      /* ignore */
    }
    ctx = null;
    started = false;
  }

  return {
    ensure,
    update,
    footstep,
    toll,
    setMuted,
    toggleMuted,
    isMuted: () => muted,
    isStarted: () => started,
    suspend,
    resume,
    dispose,
  };
}
