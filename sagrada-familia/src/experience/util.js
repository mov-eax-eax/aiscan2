// Small shared helpers for the experience layer. No DOM, no THREE.

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const invLerp = (a, b, v) => (b === a ? 0 : (v - a) / (b - a));

export const smoothstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

export const easeInOutCubic = (t) => {
  t = clamp(t, 0, 1);
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
};

export const easeOutCubic = (t) => {
  t = clamp(t, 0, 1);
  return 1 - Math.pow(1 - t, 3);
};

export const easeInOutQuad = (t) => {
  t = clamp(t, 0, 1);
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
};

/** Frame-rate independent exponential approach. */
export function damp(current, target, lambda, dt) {
  return lerp(current, target, 1 - Math.exp(-lambda * dt));
}

export function wrapAngle(a) {
  const two = Math.PI * 2;
  return ((a % two) + two) % two;
}

/** `HH:MM` from an hour in [0,24). */
export function formatClock(hours) {
  const total = Math.round((((hours % 24) + 24) % 24) * 60) % 1440;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Human phase of day used beside the clock. */
export function periodOfDay(hours) {
  const h = ((hours % 24) + 24) % 24;
  if (h < 4.6) return { label: 'Night', key: 'night' };
  if (h < 6.8) return { label: 'Dawn', key: 'dawn' };
  if (h < 11.2) return { label: 'Morning', key: 'morning' };
  if (h < 14.2) return { label: 'Midday', key: 'midday' };
  if (h < 17.4) return { label: 'Afternoon', key: 'afternoon' };
  if (h < 20.2) return { label: 'Dusk', key: 'dusk' };
  return { label: 'Night', key: 'night' };
}

export function isNightHour(hours) {
  const h = ((hours % 24) + 24) % 24;
  return h >= 19.2 || h < 6.4;
}

/** True when the keyboard event target would consume text. */
export function isTypingTarget(el) {
  if (!el || el.nodeType !== 1) return false;
  const tag = el.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (el.isContentEditable) return true;
  return false;
}

export function toFixedList(arr, n = 3) {
  return Array.from(arr).map((v) => (Math.round(v * 10) / 10).toFixed(n === 2 ? 2 : 1));
}

/** Pointer type helpers. */
export function isCoarsePointer() {
  try {
    if (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) return true;
  } catch (e) {
    /* ignore */
  }
  // Touch-capable small screens (phones/tablets in portrait) should get the
  // touch interface even when the coarse-pointer media query is unavailable.
  return (navigator.maxTouchPoints || 0) > 0 && Math.min(window.innerWidth, window.innerHeight) < 900;
}

/** Read world position from a hotspot's position (array or Vector3-like). */
export function readVec3(value) {
  if (!value) return null;
  if (Array.isArray(value)) return { x: value[0], y: value[1], z: value[2] };
  if (typeof value.x === 'number') return { x: value.x, y: value.y, z: value.z };
  return null;
}

/** localStorage is not always available (private mode, sandboxed iframes). */
export function storageGet(key, fallback = null) {
  try {
    const v = window.localStorage.getItem(key);
    return v === null ? fallback : v;
  } catch (e) {
    return fallback;
  }
}

export function storageSet(key, value) {
  try {
    window.localStorage.setItem(key, String(value));
  } catch (e) {
    /* ignore */
  }
}
