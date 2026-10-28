// Walk / fly camera controller: pointer-lock mouse look with a drag fallback,
// WASD movement, sprint, jump with gravity, ground raycast, and sliding
// circle collision against the merged builder colliders.

import { THREE } from '../lib.js';
import { resolveCollisions, clampToRadius } from './collide.js';
import { clamp, damp, easeInOutCubic, isTypingTarget } from './util.js';

const DOWN = new THREE.Vector3(0, -1, 0);
const WALK_SPEED = 4.6;
const RUN_SPEED = 9.0;
const WALK_ACCEL = 13;
const GRAVITY = 21;
const JUMP_V = 6.1;
const FLY_SPEED = 15;
const FLY_BOOST = 3.7;
const FLY_ACCEL = 8.5;
const FLY_SPEED_MIN = 0.5;
const FLY_SPEED_MAX = 5;
const PITCH_LIMIT = 1.44;
const LOOK_MOUSE = 0.00225;
const LOOK_DRAG = 0.0026;
const LOOK_TOUCH = 0.0032;

/**
 * Vertical fly input for one frame. Pure function so it can be unit-tested.
 * Mapping (kept consistent with the HUD hints and the Help card):
 *   Space or E   → rise   (E defers to "read the label" when a hotspot is active)
 *   Ctrl or Q    → descend
 *   touch axis   → analogue -1..1
 * Returns a clamped value in [-1, 1].
 */
export function flyVerticalInput({ keys, touchVertical = 0, hotspotActive = false }) {
  let iy = Number.isFinite(touchVertical) ? touchVertical : 0;
  const rise = keys.has('Space') || (keys.has('KeyE') && !hotspotActive);
  const fall = keys.has('ControlLeft') || keys.has('ControlRight') || keys.has('KeyQ');
  if (rise) iy += 1;
  if (fall) iy -= 1;
  return clamp(iy, -1, 1);
}

export function createControls({ camera, dom, DIM, prepared, walkables, callbacks = {}, isCoarse = false }) {
  const EYE = DIM.eyeHeight ?? 1.72;
  const PLAYER_R = DIM.playerRadius ?? 0.42;
  const PLAYER_H = 1.7;
  const CLAMP = DIM.playerClamp ?? 128;

  let mode = 'walk';
  let enabled = false;
  let disposed = false;

  let yaw = 0;
  let pitch = 0;
  let roll = 0;

  const keys = new Set();
  const walk = {
    feet: new THREE.Vector3(0, 0, 60),
    vel: new THREE.Vector3(),
    vy: 0,
    onGround: true,
    bobPhase: 0,
    bobY: 0,
    sway: 0,
    stepDist: 0,
    lastSurface: 'plaza',
  };
  const fly = { pos: new THREE.Vector3(0, 30, 100), vel: new THREE.Vector3() };
  // Free-fly speed multiplier, adjusted with the mouse wheel or touch.
  let flySpeedScale = 1;
  const touch = { x: 0, y: 0, vertical: 0, run: false };

  let jumpQueued = 0;
  let jumpHeld = false;

  // Pointer / drag handling
  let locked = false;
  let lockPending = false;
  let lockFailed = false;
  let drag = null;
  let lockFailureNotified = false;

  const raycaster = new THREE.Raycaster();
  const rayOrigin = new THREE.Vector3();
  const camDir = new THREE.Vector3();
  const camRight = new THREE.Vector3();
  const tmpVec = new THREE.Vector3();
  const tmpVec2 = new THREE.Vector3();
  let groundCache = { x: NaN, z: NaN, y: 0, frame: 0 };
  let frameCounter = 0;

  // ------------------------------------------------------------------ helpers

  function canLock() {
    if (disposed || isCoarse || lockFailed) return false;
    // Automation runs (Playwright et al.) request pointer lock from synthetic
    // clicks that headless Chrome cannot grant; stay on the drag-look fallback
    // so QA never produces pointerlockerror noise.
    if (navigator.webdriver) return false;
    if (typeof dom.requestPointerLock !== 'function') return false;
    if (callbacks.canLock && !callbacks.canLock()) return false;
    return true;
  }

  function requestLock() {
    if (!canLock() || locked) return false;
    lockPending = true;
    try {
      const result = dom.requestPointerLock({ unadjustedMovement: false });
      if (result && typeof result.catch === 'function') result.catch(() => notifyLockFailure());
    } catch (e) {
      try {
        dom.requestPointerLock();
      } catch (e2) {
        notifyLockFailure();
      }
    }
    setTimeout(() => {
      lockPending = false;
    }, 700);
    return true;
  }

  function notifyLockFailure() {
    lockFailed = true;
    lockPending = false;
    if (!lockFailureNotified) {
      lockFailureNotified = true;
      if (callbacks.onLockFailure) callbacks.onLockFailure();
    }
  }

  function lookAtPoint(from, target) {
    const dx = target.x - from.x;
    const dy = target.y - from.y;
    const dz = target.z - from.z;
    const horiz = Math.hypot(dx, dz);
    if (horiz < 1e-5 && Math.abs(dy) < 1e-5) return;
    yaw = Math.atan2(-dx, -dz);
    pitch = clamp(Math.atan2(dy, horiz), -PITCH_LIMIT, PITCH_LIMIT);
  }

  function readPoint(value) {
    if (!value) return null;
    if (Array.isArray(value)) return { x: value[0], y: value[1], z: value[2] };
    if (typeof value === 'object' && Number.isFinite(Number(value.x))) {
      return { x: Number(value.x), y: Number(value.y), z: Number(value.z) };
    }
    return null;
  }

  function groundHeight(x, z, fromY) {
    if (!walkables || walkables.length === 0) return 0;
    // One raycast per frame at most — cache the answer for the same spot.
    if (groundCache.frame === frameCounter && Math.abs(x - groundCache.x) < 1e-4 && Math.abs(z - groundCache.z) < 1e-4) {
      return groundCache.y;
    }
    let y = 0;
    try {
      raycaster.set(rayOrigin.set(x, fromY, z), DOWN);
      raycaster.far = 400;
      raycaster.near = 0;
      const hits = raycaster.intersectObjects(walkables, true);
      y = null;
      for (let i = 0; i < hits.length; i++) {
        const hit = hits[i];
        if (!hit || !hit.point) continue;
        if (hit.point.y <= fromY + 0.02) {
          y = hit.point.y;
          break;
        }
      }
      if (y === null) y = 0;
    } catch (e) {
      y = 0;
    }
    groundCache = { x, z, y, frame: frameCounter };
    return y;
  }

  function surfaceAt(x, z) {
    if (callbacks.surfaceAt) {
      try {
        return callbacks.surfaceAt(x, z);
      } catch (e) {
        /* ignore */
      }
    }
    return 'stone';
  }

  // ------------------------------------------------------------------- input

  function onKeyDown(e) {
    if (disposed) return;
    if (isTypingTarget(e.target)) return;
    if (e.ctrlKey || e.metaKey || e.altKey) {
      // Allow ctrl as a fly descend key only without modifiers forming shortcuts.
      if (e.code === 'ControlLeft' || e.code === 'ControlRight') {
        keys.add(e.code);
      }
      return;
    }
    const code = e.code;
    if (code === 'KeyR' && mode === 'fly') {
      resetFlyView();
      if (callbacks.onFlyReset) callbacks.onFlyReset();
      e.preventDefault();
      return;
    }
    if (
      code === 'KeyW' ||
      code === 'KeyA' ||
      code === 'KeyS' ||
      code === 'KeyD' ||
      code === 'KeyQ' ||
      code === 'KeyE' ||
      code === 'ArrowUp' ||
      code === 'ArrowDown' ||
      code === 'ArrowLeft' ||
      code === 'ArrowRight' ||
      code === 'ShiftLeft' ||
      code === 'ShiftRight' ||
      code === 'ControlLeft' ||
      code === 'ControlRight'
    ) {
      keys.add(code);
      if (code === 'ArrowUp' || code === 'ArrowDown' || code === 'ArrowLeft' || code === 'ArrowRight') {
        e.preventDefault();
      }
    }
    if (code === 'Space') {
      // Space is only a movement key while the walker/flyer is in control; at
      // the splash or behind a dialog it belongs to the focused button.
      if (!enabled) return;
      if (e.target && e.target.tagName === 'BUTTON') {
        e.preventDefault();
        if (e.target.blur) e.target.blur();
      }
      if (!e.repeat) {
        jumpQueued = 0.24;
        jumpHeld = true;
      }
      // Fly mode reads Space as "rise"; walk mode ignores the key and uses the
      // queued jump instead, so holding Space cannot bunny-hop.
      keys.add('Space');
      e.preventDefault();
    }
  }

  function onKeyUp(e) {
    keys.delete(e.code);
    if (e.code === 'Space') jumpHeld = false;
  }

  function onBlur() {
    keys.clear();
    drag = null;
    jumpHeld = false;
  }

  // Free-fly extra controls: wheel adjusts speed, R resets to a clean overview.
  function onWheel(e) {
    if (disposed || !enabled || mode !== 'fly') return;
    if (e.target !== dom && document.pointerLockElement !== dom) return;
    e.preventDefault();
    const step = e.deltaY < 0 ? 1.16 : 1 / 1.16;
    flySpeedScale = clamp(flySpeedScale * step, FLY_SPEED_MIN, FLY_SPEED_MAX);
    if (callbacks.onFlySpeed) callbacks.onFlySpeed(flySpeedScale);
  }

  function resetFlyView() {
    if (mode !== 'fly') return false;
    fly.pos.set(0, 86, 176);
    fly.vel.set(0, 0, 0);
    yaw = 0;
    pitch = -0.26;
    drag = null;
    applyCamera();
    return true;
  }

  function onPointerDown(e) {
    if (disposed) return;
    if (!enabled) return;
    // Only primary mouse button, or any touch/pen.
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (locked) return;
    drag = {
      id: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      sx: e.clientX,
      sy: e.clientY,
      moved: false,
      type: e.pointerType || 'mouse',
      touch: e.pointerType === 'touch' || isCoarse,
    };
    if (drag.touch) {
      // Touch look drag: any point on the canvas; do not steal the gesture
      // from the joystick, which lives in the UI layer and captures its own.
      try {
        dom.setPointerCapture(e.pointerId);
      } catch (err) {
        /* ignore */
      }
    }
  }

  function onPointerMove(e) {
    if (disposed) return;
    if (locked) {
      const mx = e.movementX || 0;
      const my = e.movementY || 0;
      if (mx || my) {
        yaw -= mx * LOOK_MOUSE;
        pitch = clamp(pitch - my * LOOK_MOUSE, -PITCH_LIMIT, PITCH_LIMIT);
      }
      return;
    }
    if (!drag || drag.id !== e.pointerId) return;
    const dx = e.clientX - drag.x;
    const dy = e.clientY - drag.y;
    if (!drag.moved && Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) > (drag.touch ? 5 : 4)) {
      drag.moved = true;
    }
    if (drag.moved) {
      const sens = drag.touch ? LOOK_TOUCH : LOOK_DRAG;
      yaw -= dx * sens;
      pitch = clamp(pitch - dy * sens, -PITCH_LIMIT, PITCH_LIMIT);
      drag.x = e.clientX;
      drag.y = e.clientY;
    }
  }

  function onPointerUp(e) {
    if (disposed) return;
    if (drag && drag.id === e.pointerId) {
      const wasDrag = drag.moved;
      const wasMouse = drag.type === 'mouse';
      drag = null;
      try {
        if (dom.hasPointerCapture && dom.hasPointerCapture(e.pointerId)) dom.releasePointerCapture(e.pointerId);
      } catch (err) {
        /* ignore */
      }
      if (wasMouse && !wasDrag && !locked && enabled && canLock()) requestLock();
    }
  }

  function onPointerLockChange() {
    const now = document.pointerLockElement === dom;
    if (now === locked) return;
    locked = now;
    lockPending = false;
    if (now) lockFailed = false;
    if (callbacks.onLockChange) callbacks.onLockChange(locked);
  }

  function onPointerLockError() {
    notifyLockFailure();
  }

  function onContextMenu(e) {
    if (locked) e.preventDefault();
  }

  // ------------------------------------------------------------------- update

  function inputAxis() {
    let ix = 0;
    let iz = 0;
    if (enabled) {
      if (keys.has('KeyW') || keys.has('ArrowUp')) iz += 1;
      if (keys.has('KeyS') || keys.has('ArrowDown')) iz -= 1;
      if (keys.has('KeyD') || keys.has('ArrowRight')) ix += 1;
      if (keys.has('KeyA') || keys.has('ArrowLeft')) ix -= 1;
      ix += touch.x;
      iz -= touch.y;
    }
    const m = Math.hypot(ix, iz);
    if (m > 1) {
      ix /= m;
      iz /= m;
    }
    return { x: ix, z: iz };
  }

  function isRunning() {
    return keys.has('ShiftLeft') || keys.has('ShiftRight') || touch.run;
  }

  function updateWalk(dt) {
    frameCounter++;
    if (jumpQueued > 0) jumpQueued = Math.max(0, jumpQueued - dt);

    const axis = inputAxis();
    const running = isRunning();
    const speed = running ? RUN_SPEED : WALK_SPEED;
    const sin = Math.sin(yaw);
    const cos = Math.cos(yaw);
    const targetX = (-sin * axis.z + cos * axis.x) * speed;
    const targetZ = (-cos * axis.z - sin * axis.x) * speed;
    walk.vel.x = damp(walk.vel.x, targetX, WALK_ACCEL, dt);
    walk.vel.z = damp(walk.vel.z, targetZ, WALK_ACCEL, dt);
    if (!axis.x && !axis.z && Math.hypot(walk.vel.x, walk.vel.z) < 0.015) {
      walk.vel.x = 0;
      walk.vel.z = 0;
    }

    const prevX = walk.feet.x;
    const prevZ = walk.feet.z;
    walk.feet.x += walk.vel.x * dt;
    walk.feet.z += walk.vel.z * dt;
    resolveCollisions(walk.feet, PLAYER_R, prepared, walk.feet.y, PLAYER_H);
    clampToRadius(walk.feet, CLAMP);

    let gy = groundHeight(walk.feet.x, walk.feet.z, walk.feet.y + 2.4);

    // A cliff without a collider is a wall, not a staircase: refuse to climb
    // more than a tall step in one frame.
    if (walk.onGround && gy > walk.feet.y + 0.65) {
      walk.feet.x = prevX;
      walk.feet.z = prevZ;
      gy = groundHeight(walk.feet.x, walk.feet.z, walk.feet.y + 2.4);
    }

    if (walk.onGround) {
      if (gy > walk.feet.y - 1.25) {
        walk.feet.y = gy;
        walk.vy = 0;
      } else {
        walk.onGround = false;
      }
    }
    if (walk.onGround && jumpQueued > 0) {
      walk.vy = JUMP_V;
      walk.onGround = false;
      jumpQueued = 0;
    }
    if (!walk.onGround) {
      walk.vy -= GRAVITY * dt;
      walk.feet.y += walk.vy * dt;
      if (walk.feet.y <= gy) {
        if (walk.vy < -6) {
          // Landing: a soft dip, no sound spam.
          walk.bobY -= 0.02;
        }
        walk.feet.y = gy;
        walk.vy = 0;
        walk.onGround = true;
      }
    }

    // Head bob and footsteps, driven by actual ground speed.
    const horiz = Math.hypot(walk.vel.x, walk.vel.z);
    const stride = clamp(horiz / RUN_SPEED, 0, 1) * (walk.onGround ? 1 : 0);
    walk.bobPhase += horiz * dt * 1.4;
    const targetBob = Math.sin(walk.bobPhase * 2) * 0.034 * stride;
    const targetSway = Math.cos(walk.bobPhase) * 0.022 * stride;
    walk.bobY = damp(walk.bobY, targetBob, 9, dt);
    walk.sway = damp(walk.sway, targetSway, 9, dt);
    roll = damp(roll, Math.sin(walk.bobPhase) * 0.0045 * stride, 8, dt);

    if (horiz > 0.45 && walk.onGround) {
      walk.stepDist += horiz * dt;
      // Long strides at the brisk model scale; ties the footstep rate to speed.
      const stepLen = Math.max(1.05, Math.min(2.6, horiz * 0.33));
      if (walk.stepDist >= stepLen) {
        walk.stepDist = 0;
        walk.lastSurface = surfaceAt(walk.feet.x, walk.feet.z);
        if (callbacks.onFootstep) callbacks.onFootstep(walk.lastSurface);
      }
    } else {
      walk.stepDist = Math.min(walk.stepDist, 0.2);
    }
  }

  function updateFly(dt) {
    let ix = 0;
    let iz = 0;
    let iy = 0;
    if (enabled) {
      if (keys.has('KeyW') || keys.has('ArrowUp')) iz += 1;
      if (keys.has('KeyS') || keys.has('ArrowDown')) iz -= 1;
      if (keys.has('KeyD') || keys.has('ArrowRight')) ix += 1;
      if (keys.has('KeyA') || keys.has('ArrowLeft')) ix -= 1;
      ix += touch.x;
      iz -= touch.y;
      let reading = false;
      if (callbacks.hotspotActive) {
        try {
          reading = !!callbacks.hotspotActive();
        } catch (e) {
          reading = false;
        }
      }
      iy = flyVerticalInput({ keys, touchVertical: touch.vertical, hotspotActive: reading });
    }
    const mag = Math.hypot(ix, iz);
    if (mag > 1) {
      ix /= mag;
      iz /= mag;
    }

    const sin = Math.sin(yaw);
    const cos = Math.cos(yaw);
    const cp = Math.cos(pitch);
    const sp = Math.sin(pitch);
    const speed = FLY_SPEED * flySpeedScale * (isRunning() ? FLY_BOOST : 1);
    const targetX = (-sin * cp * iz + cos * ix) * speed;
    const targetY = (sp * iz + iy) * speed;
    const targetZ = (-cos * cp * iz - sin * ix) * speed;
    fly.vel.x = damp(fly.vel.x, targetX, FLY_ACCEL, dt);
    fly.vel.y = damp(fly.vel.y, targetY, FLY_ACCEL, dt);
    fly.vel.z = damp(fly.vel.z, targetZ, FLY_ACCEL, dt);
    if (!ix && !iz && !iy && fly.vel.lengthSq() < 0.02) fly.vel.set(0, 0, 0);

    fly.pos.addScaledVector(fly.vel, dt);
    clampToRadius(fly.pos, 418);
    fly.pos.y = clamp(fly.pos.y, 0.9, 470);
  }

  function applyCamera() {
    camera.rotation.order = 'YXZ';
    if (mode === 'walk') {
      camRight.set(Math.cos(yaw), 0, -Math.sin(yaw));
      camera.position.set(
        walk.feet.x + camRight.x * walk.sway,
        walk.feet.y + EYE + walk.bobY,
        walk.feet.z + camRight.z * walk.sway
      );
    } else {
      camera.position.copy(fly.pos);
    }
    camera.rotation.x = pitch;
    camera.rotation.y = yaw;
    camera.rotation.z = mode === 'walk' ? roll : 0;
  }

  function applyPose(pos, look) {
    if (!pos) return;
    if (mode === 'walk') {
      walk.feet.set(pos.x, pos.y - EYE, pos.z);
      walk.vel.set(0, 0, 0);
      walk.vy = 0;
      walk.onGround = true;
      walk.bobY = 0;
      walk.sway = 0;
      walk.bobPhase = 0;
      walk.stepDist = 0;
      if (look) lookAtPoint(pos, look);
      camera.position.set(pos.x, pos.y, pos.z);
    } else {
      fly.pos.set(pos.x, pos.y, pos.z);
      fly.vel.set(0, 0, 0);
      if (look) lookAtPoint(pos, look);
      camera.position.copy(fly.pos);
    }
    camera.rotation.order = 'YXZ';
    camera.rotation.x = pitch;
    camera.rotation.y = yaw;
    camera.rotation.z = 0;
  }

  function setPose(posValue, lookValue) {
    const pos = readPoint(posValue);
    if (!pos) return;
    const look = readPoint(lookValue);
    applyPose(pos, look);
  }

  function lookToward(targetValue) {
    const target = readPoint(targetValue);
    if (!target) return;
    lookAtPoint(camera.position, target);
    applyCamera();
  }

  function setMode(next) {
    if (next !== 'walk' && next !== 'fly') return;
    if (next === mode) return;
    if (next === 'fly') {
      fly.pos.copy(camera.position);
      if (mode === 'walk') fly.pos.y = walk.feet.y + EYE;
      fly.vel.set(0, 0, 0);
    } else {
      walk.feet.set(camera.position.x, camera.position.y - EYE, camera.position.z);
      walk.vel.set(0, 0, 0);
      walk.vy = 0;
      walk.onGround = false;
      walk.bobY = 0;
      walk.sway = 0;
      roll = 0;
    }
    mode = next;
    keys.clear();
    drag = null;
    jumpQueued = 0;
  }

  function setEnabled(value) {
    enabled = !!value;
    if (!enabled) {
      keys.clear();
      drag = null;
      touch.x = 0;
      touch.y = 0;
      touch.vertical = 0;
      touch.run = false;
    }
  }

  function setYawPitch(nextYaw, nextPitch) {
    if (Number.isFinite(nextYaw)) yaw = nextYaw;
    if (Number.isFinite(nextPitch)) pitch = clamp(nextPitch, -PITCH_LIMIT, PITCH_LIMIT);
  }

  function getForward(out = new THREE.Vector3()) {
    const cp = Math.cos(pitch);
    return out.set(-Math.sin(yaw) * cp, Math.sin(pitch), -Math.cos(yaw) * cp).normalize();
  }

  function getEye(out = new THREE.Vector3()) {
    return out.copy(camera.position);
  }

  function getInfo() {
    return {
      mode,
      yaw,
      pitch,
      locked,
      pos: { x: camera.position.x, y: camera.position.y, z: camera.position.z },
      feet: { x: walk.feet.x, y: walk.feet.y, z: walk.feet.z },
      onGround: walk.onGround,
      eyeHeight: EYE,
    };
  }

  function setTouchMove(x, y) {
    touch.x = clamp(Number(x) || 0, -1, 1);
    touch.y = clamp(Number(y) || 0, -1, 1);
  }

  function setTouchVertical(v) {
    touch.vertical = clamp(Number(v) || 0, -1, 1);
  }

  function setTouchRun(v) {
    touch.run = !!v;
  }

  function update(dt) {
    if (mode === 'walk') updateWalk(dt);
    else updateFly(dt);
    applyCamera();
  }

  // ------------------------------------------------------------------- wiring

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  document.addEventListener('visibilitychange', onBlur);
  dom.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);
  window.addEventListener('pointercancel', onPointerUp);
  dom.addEventListener('wheel', onWheel, { passive: false });
  dom.addEventListener('contextmenu', onContextMenu);
  document.addEventListener('pointerlockchange', onPointerLockChange);
  document.addEventListener('pointerlockerror', onPointerLockError);

  function dispose() {
    disposed = true;
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    window.removeEventListener('blur', onBlur);
    document.removeEventListener('visibilitychange', onBlur);
    dom.removeEventListener('pointerdown', onPointerDown);
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
    window.removeEventListener('pointercancel', onPointerUp);
    dom.removeEventListener('wheel', onWheel);
    dom.removeEventListener('contextmenu', onContextMenu);
    document.removeEventListener('pointerlockchange', onPointerLockChange);
    document.removeEventListener('pointerlockerror', onPointerLockError);
    try {
      if (locked) document.exitPointerLock();
    } catch (e) {
      /* ignore */
    }
  }

  return {
    update,
    setMode,
    setEnabled,
    setPose,
    lookToward,
    applyCamera,
    getForward,
    getEye,
    getInfo,
    setTouchMove,
    setTouchVertical,
    setTouchRun,
    requestLock,
    isLocked: () => locked,
    isEnabled: () => enabled,
    isFly: () => mode === 'fly',
    getMode: () => mode,
    getYawPitch: () => ({ yaw, pitch }),
    setYawPitch,
    getWalkState: () => walk,
    getFlyState: () => fly,
    getFlySpeed: () => flySpeedScale,
    setFlySpeed(v) {
      flySpeedScale = clamp(Number(v) || 1, FLY_SPEED_MIN, FLY_SPEED_MAX);
      return flySpeedScale;
    },
    resetFlyView,
    getFootPosition: () => camera.position,
    exitLock() {
      try {
        if (document.pointerLockElement) document.exitPointerLock();
      } catch (e) {
        /* ignore */
      }
    },
    dispose,
  };
}
