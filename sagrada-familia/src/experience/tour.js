// Guided tour: eased travel between authored TOUR stops, then a slow dwell
// with a whisper of drift while the caption is read.

import { THREE } from '../lib.js';
import { isClear, resolveCollisions, clampToRadius } from './collide.js';
import { clamp, easeInOutCubic, smoothstep } from './util.js';

const UP = new THREE.Vector3(0, 1, 0);

export function createTour({ camera, TOUR, prepared, callbacks = {}, playerClamp = 128 }) {
  const stops = (Array.isArray(TOUR) ? TOUR : [])
    .filter((s) => s && Array.isArray(s.pos) && s.pos.length >= 3 && Array.isArray(s.target))
    .map((s) => {
      const safe = safePosition(s.pos);
      return {
        ...s,
        posVec: safe,
        targetVec: new THREE.Vector3(s.target[0], s.target[1], s.target[2]),
        dwellDur: 11.4 + clamp(((s.body || '').length || 0) / 130, 0, 2.6),
        driftSeed: (s.id ? s.id.length * 0.77 : 0) + (s.title ? s.title.length * 0.31 : 0),
      };
    });

  const baseFov = camera.isPerspectiveCamera ? camera.fov : 58;
  let fromFov = baseFov;
  let toFov = baseFov;

  let phase = 'idle'; // idle | travel | dwell
  let index = 0;
  let paused = false;
  let travelT = 0;
  let travelDur = 1;
  let dwellT = 0;
  let dwellClock = 0;
  let lift = 0;
  let fromPos = new THREE.Vector3();
  let fromLook = new THREE.Vector3();
  let arcCtrl = new THREE.Vector3();
  let activeStop = null;
  let lastStopFired = -1;

  const tmpPos = new THREE.Vector3();
  const tmpLook = new THREE.Vector3();
  const fwd = new THREE.Vector3();
  const right = new THREE.Vector3();
  const up = new THREE.Vector3();

  function safePosition(raw) {
    const p = new THREE.Vector3(Number(raw[0]) || 0, Number(raw[1]) || 0, Number(raw[2]) || 0);
    const feetY = Math.max(0, p.y - 1.72);
    // Authored aerial viewpoints are well clear of the fabric; do not nudge them
    // against wall colliders whose vertical bounds may be conservative.
    if (p.y >= 50) {
      clampToRadius(p, playerClamp - 1);
      return p;
    }
    if (prepared && prepared.length) {
      if (!isClear(p.x, p.z, 1.05, prepared, feetY)) {
        // Try radial escape from the centre of the building first.
        let dx = p.x;
        let dz = p.z;
        let len = Math.hypot(dx, dz);
        if (len < 0.5) {
          dx = 0;
          dz = 1;
          len = 1;
        }
        dx /= len;
        dz /= len;
        let found = false;
        for (let step = 1; step <= 20; step++) {
          const nx = p.x + dx * step;
          const nz = p.z + dz * step;
          if (isClear(nx, nz, 0.9, prepared, feetY)) {
            p.x = nx;
            p.z = nz;
            found = true;
            break;
          }
        }
        if (!found) {
          for (let pass = 0; pass < 5; pass++) {
            resolveCollisions(p, 1.2, prepared, feetY, 1.72);
          }
        }
      }
    }
    clampToRadius(p, playerClamp - 1);
    if (p.y < 1.6) p.y = 1.6;
    return p;
  }

  function easeTravel(u) {
    return easeInOutCubic(clamp(u, 0, 1));
  }

  function applyFov(value) {
    if (!camera.isPerspectiveCamera) return;
    const v = Number.isFinite(value) ? value : baseFov;
    if (camera.fov !== v) {
      camera.fov = v;
      camera.updateProjectionMatrix();
    }
  }

  function restoreBaseFov() {
    applyFov(baseFov);
  }

  function beginTravel(target, fromCamera = true) {
    if (stops.length === 0) return;
    target = clamp(target, 0, stops.length - 1);
    const stop = stops[target];
    index = target;
    if (fromCamera) {
      fromPos.copy(camera.position);
      camera.getWorldDirection(fwd);
      fromLook.copy(camera.position).addScaledVector(fwd, 40);
    }
    tmpPos.copy(stop.posVec);
    const dist = fromPos.distanceTo(tmpPos);
    const exterior = Math.max(fromPos.y, tmpPos.y) > 9.5 || dist > 34;
    lift = exterior ? Math.min(30, dist * 0.24) : Math.min(2.2, dist * 0.05);
    arcCtrl.copy(fromPos).add(tmpPos).multiplyScalar(0.5);
    arcCtrl.y += lift * 2;
    travelDur = clamp(2.1 + dist * 0.021, 2.1, 5.8);
    travelT = 0;
    phase = 'travel';
    paused = false;
    dwellClock = 0;
    fromFov = camera.isPerspectiveCamera ? camera.fov : baseFov;
    toFov = Number.isFinite(stop.fov) ? stop.fov : baseFov;
    if (callbacks.onPause) callbacks.onPause(false);
    activeStop = stop;
    if (callbacks.onTravelStart) callbacks.onTravelStart(stop, index, stops.length);
  }

  function enterStop() {
    if (!activeStop) return;
    applyFov(toFov);
    phase = 'dwell';
    dwellT = 0;
    dwellClock = 0;
    paused = false;
    if (callbacks.onStop) callbacks.onStop(activeStop, index, stops.length);
    lastStopFired = index;
  }

  function placeAtStop(stop) {
    camera.position.copy(stop.posVec);
    camera.lookAt(stop.targetVec);
    applyFov(Number.isFinite(stop.fov) ? stop.fov : baseFov);
  }

  function start(target = 0, { instant = false } = {}) {
    if (stops.length === 0) return false;
    index = clamp(target, 0, stops.length - 1);
    activeStop = stops[index];
    paused = false;
    dwellT = 0;
    dwellClock = 0;
    if (instant) {
      placeAtStop(activeStop);
      phase = 'dwell';
      if (callbacks.onStop) callbacks.onStop(activeStop, index, stops.length);
      lastStopFired = index;
    } else {
      beginTravel(index);
    }
    return true;
  }

  function next() {
    if (phase === 'idle') return;
    if (phase === 'travel' && index < stops.length - 1) {
      // Already moving: retarget to the following stop.
      beginTravel(index + 1);
      return;
    }
    if (index >= stops.length - 1) {
      finish();
      return;
    }
    paused = false;
    if (callbacks.onPause) callbacks.onPause(false);
    beginTravel(index + 1);
  }

  function prev() {
    if (phase === 'idle') return;
    const target = index > 0 ? index - 1 : 0;
    if (phase === 'travel' && target === index) return;
    paused = false;
    if (callbacks.onPause) callbacks.onPause(false);
    beginTravel(target);
  }

  function finish() {
    phase = 'idle';
    restoreBaseFov();
    if (callbacks.onFinish) callbacks.onFinish();
  }

  function exit() {
    if (phase === 'idle') return;
    phase = 'idle';
    restoreBaseFov();
    if (callbacks.onExit) callbacks.onExit();
  }

  function setPaused(value) {
    if (phase === 'idle') {
      paused = false;
    } else {
      paused = !!value;
    }
    if (callbacks.onPause) callbacks.onPause(paused);
  }

  function togglePause() {
    setPaused(!paused);
    return paused;
  }

  function update(dt) {
    if (phase === 'idle' || !activeStop) return;
    if (phase === 'travel') {
      if (!paused) travelT += dt;
      const u = clamp(travelT / travelDur, 0, 1);
      const e = easeTravel(u);
      const inv = 1 - e;
      tmpPos.set(0, 0, 0);
      tmpPos.addScaledVector(fromPos, inv * inv);
      tmpPos.addScaledVector(arcCtrl, 2 * inv * e);
      tmpPos.addScaledVector(activeStop.posVec, e * e);
      // Look leads the movement slightly so the turn feels intentional.
      const lu = easeInOutCubic(clamp(u * 1.28, 0, 1));
      tmpLook.lerpVectors(fromLook, activeStop.targetVec, lu);
      camera.position.copy(tmpPos);
      camera.lookAt(tmpLook);
      if (camera.isPerspectiveCamera && fromFov !== toFov) {
        applyFov(fromFov + (toFov - fromFov) * e);
      }
      if (u >= 1) {
        camera.position.copy(activeStop.posVec);
        camera.lookAt(activeStop.targetVec);
        enterStop();
      }
      return;
    }

    // Dwell — pause freezes both the read timer and the camera drift.
    if (!paused) {
      dwellClock += dt;
      dwellT += dt;
    }
    const stop = activeStop;
    fwd.subVectors(stop.targetVec, stop.posVec);
    if (fwd.lengthSq() < 1e-4) fwd.set(0, 0, -1);
    fwd.normalize();
    right.crossVectors(fwd, UP);
    if (right.lengthSq() < 1e-4) right.set(1, 0, 0);
    right.normalize();
    up.crossVectors(right, fwd).normalize();

    const walkHold = stop.mode === 'walk';
    const amp = walkHold ? 0.26 : 0.95;
    const ramp = smoothstep(0, 2.6, dwellClock);
    const seed = stop.driftSeed || 0;
    const sway = Math.sin(dwellClock * 0.15 + seed) * amp * ramp;
    const rise = Math.sin(dwellClock * 0.1 + seed * 1.7) * amp * 0.34 * ramp;
    tmpPos.copy(stop.posVec).addScaledVector(right, sway).addScaledVector(up, rise);
    tmpLook
      .copy(stop.targetVec)
      .addScaledVector(right, Math.sin(dwellClock * 0.115 + seed + 1.3) * amp * 1.7 * ramp)
      .addScaledVector(up, Math.sin(dwellClock * 0.085 + seed + 0.4) * amp * 0.9 * ramp);
    camera.position.copy(tmpPos);
    camera.lookAt(tmpLook);

    if (!paused && dwellT >= stop.dwellDur) {
      if (index >= stops.length - 1) finish();
      else beginTravel(index + 1);
    }
  }

  function getState() {
    const progress = phase === 'dwell' && activeStop ? clamp(dwellT / activeStop.dwellDur, 0, 1) : 0;
    return {
      active: phase !== 'idle',
      phase,
      index,
      total: stops.length,
      stop: activeStop,
      paused,
      progress,
      travel: phase === 'travel' ? clamp(travelT / travelDur, 0, 1) : phase === 'dwell' ? 1 : 0,
      dwellElapsed: dwellT,
      dwellDuration: activeStop ? activeStop.dwellDur : 0,
      lift,
      lastStopFired,
    };
  }

  return {
    stops,
    start,
    next,
    prev,
    exit,
    finish,
    update,
    setPaused,
    togglePause,
    getState,
    isActive: () => phase !== 'idle',
    getIndex: () => index,
    getStop: () => activeStop,
  };
}
