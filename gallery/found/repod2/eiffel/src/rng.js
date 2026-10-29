// Deterministic PRNG + small math helpers shared by every generator.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class Rng {
  constructor(seed = 1337) { this._n = mulberry32(seed); }
  next() { return this._n(); }
  range(a, b) { return a + (b - a) * this._n(); }
  int(a, b) { return Math.floor(this.range(a, b + 1)); }
  pick(arr) { return arr[Math.min(arr.length - 1, Math.floor(this._n() * arr.length))]; }
  chance(p) { return this._n() < p; }
  // Box-Muller, one sample per call (cheap enough at build time)
  gauss(mu = 0, sigma = 1) {
    const u = Math.max(1e-9, this._n()), v = this._n();
    return mu + sigma * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }
  sign() { return this._n() < 0.5 ? -1 : 1; }
}

export const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smoothstep = (e0, e1, x) => {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
};
