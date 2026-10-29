import * as THREE from 'three';
import { clamp, lerp, smoothstep } from './rng.js';

/* ------------------------------------------------------------------ *
 * Time-of-day engine. One scalar (hours, 0..24) drives sun position,
 * sky gradient, cloud lighting, fog, exposure and every artificial
 * light in the scene, so the whole frame stays colour-consistent.
 * ------------------------------------------------------------------ */

export const SUNRISE = 6.05, SUNSET = 21.55;        // Paris, late June
export const DAY_LENGTH = SUNSET - SUNRISE;

// key: hour, value: palette entry. Colours are authored in sRGB hex.
const KEYS = [
  { h: 0.0,  zenith: 0x04070f, horizon: 0x0a1226, sun: 0x2c3a5c, ground: 0x05070c, cloud: 0x141d33, amb: 0x0b1226, ambI: 0.22, sunI: 0.05, exp: 1.5, star: 1.0, moon: 0.35 },
  { h: 4.6,  zenith: 0x060c1c, horizon: 0x121e3c, sun: 0x3a4a70, ground: 0x070a12, cloud: 0x1b2540, amb: 0x111a33, ambI: 0.26, sunI: 0.06, exp: 1.42, star: 0.85, moon: 0.30 },
  { h: 5.8,  zenith: 0x18325e, horizon: 0x6b5a72, sun: 0x8a6a70, ground: 0x141726, cloud: 0x3b3a55, amb: 0x2a2f4d, ambI: 0.45, sunI: 0.22, exp: 1.15, star: 0.35, moon: 0.16 },
  { h: 6.6,  zenith: 0x2f5793, horizon: 0xd98b57, sun: 0xff9d55, ground: 0x2b2622, cloud: 0x8b6a72, amb: 0x4a4a63, ambI: 0.85, sunI: 1.35, exp: 0.88, star: 0.02, moon: 0.05 },
  { h: 8.5,  zenith: 0x3570b6, horizon: 0xc6d9e6, sun: 0xffe9c8, ground: 0x55503f, cloud: 0xf0f0f4, amb: 0xb6c0c2, ambI: 1.3, sunI: 2.6, exp: 0.60, star: 0.0, moon: 0.0 },
  { h: 13.0, zenith: 0x2f6ec4, horizon: 0xcfe0ec, sun: 0xfff4dc, ground: 0x5b5541, cloud: 0xffffff, amb: 0xc2c6c4, ambI: 1.5, sunI: 3.0, exp: 0.56, star: 0.0, moon: 0.0 },
  { h: 17.5, zenith: 0x2f6cb4, horizon: 0xcedae2, sun: 0xffeecb, ground: 0x585240, cloud: 0xf8f4ee, amb: 0xb8bec0, ambI: 1.4, sunI: 2.8, exp: 0.57, star: 0.0, moon: 0.0 },
  { h: 20.2, zenith: 0x2b5b9c, horizon: 0xd8b48a, sun: 0xffd9a0, ground: 0x46403a, cloud: 0xf2ddc4, amb: 0x8fa0b4, ambI: 1.05, sunI: 1.85, exp: 0.72, star: 0.0, moon: 0.0 },
  { h: 21.2, zenith: 0x27497f, horizon: 0xf0a05e, sun: 0xffb066, ground: 0x3b322c, cloud: 0xe8b184, amb: 0x6a6f86, ambI: 0.80, sunI: 1.35, exp: 0.85, star: 0.0, moon: 0.0 },
  { h: 21.9, zenith: 0x1c3566, horizon: 0xf2764a, sun: 0xff7a3c, ground: 0x2c2523, cloud: 0xc98a6e, amb: 0x4a4c66, ambI: 0.62, sunI: 0.95, exp: 0.98, star: 0.05, moon: 0.04 },
  { h: 22.6, zenith: 0x122a55, horizon: 0x9a5570, sun: 0xc25a4a, ground: 0x1c1a22, cloud: 0x6a5878, amb: 0x2e3350, ambI: 0.46, sunI: 0.40, exp: 1.12, star: 0.30, moon: 0.12 },
  { h: 23.3, zenith: 0x081026, horizon: 0x2a2a52, sun: 0x544a70, ground: 0x0c0f1a, cloud: 0x2a3050, amb: 0x161e38, ambI: 0.30, sunI: 0.12, exp: 1.32, star: 0.72, moon: 0.25 },
  { h: 24.0, zenith: 0x04070f, horizon: 0x0a1226, sun: 0x2c3a5c, ground: 0x05070c, cloud: 0x141d33, amb: 0x0b1226, ambI: 0.22, sunI: 0.05, exp: 1.5, star: 1.0, moon: 0.35 },
];

const _cA = new THREE.Color(), _cB = new THREE.Color();

function mixKeys(h) {
  let i = 0;
  while (i < KEYS.length - 2 && h > KEYS[i + 1].h) i++;
  const a = KEYS[i], b = KEYS[i + 1];
  const t = clamp((h - a.h) / (b.h - a.h), 0, 1);
  const e = t * t * (3 - 2 * t);
  const out = {};
  for (const k of ['zenith', 'horizon', 'sun', 'ground', 'cloud', 'amb']) {
    _cA.setHex(a[k]); _cB.setHex(b[k]);
    out[k] = _cA.clone().lerp(_cB, e);
  }
  for (const k of ['ambI', 'sunI', 'exp', 'star', 'moon']) out[k] = lerp(a[k], b[k], e);
  return out;
}

export class TimeOfDay {
  constructor(hour = 19.4) {
    this.hour = hour;
    this.sunDir = new THREE.Vector3();
    this.moonDir = new THREE.Vector3();
    this.pal = mixKeys(hour);
    this.set(hour);
  }
  /** sun elevation in degrees for the given hour (simple solar path) */
  elevation(h) {
    const t = (h - SUNRISE) / DAY_LENGTH;     // 0 at sunrise, 1 at sunset
    if (t < -0.28 || t > 1.28) return -30;
    const maxEl = 64;                          // Paris, June solstice, solar noon
    return maxEl * Math.sin(Math.PI * clamp(t, -0.2, 1.2)) - 1.6;
  }
  set(hour) {
    this.hour = ((hour % 24) + 24) % 24;
    this.pal = mixKeys(this.hour);
    const t = (this.hour - SUNRISE) / DAY_LENGTH;
    const el = this.elevation(this.hour) * Math.PI / 180;
    const az = lerp(-118, 118, clamp(t, -0.25, 1.25)) * Math.PI / 180;
    this.sunDir.set(Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az)).normalize();
    // the moon mirrors the sun's path, offset by half a day
    const tm = ((this.hour + 12) % 24 - SUNRISE) / DAY_LENGTH;
    const elm = Math.max(-0.35, Math.sin(Math.PI * clamp(tm, -0.2, 1.2))) * 46 * Math.PI / 180;
    const azm = lerp(-118, 118, clamp(tm, -0.25, 1.25)) * Math.PI / 180;
    this.moonDir.set(Math.cos(elm) * Math.sin(azm), Math.sin(elm), Math.cos(elm) * Math.cos(azm)).normalize();
    this.sunElevation = this.elevation(this.hour);
    const p = this.pal;
    this.isNight = this.sunElevation < -6;
    this.isGolden = this.sunElevation > -2 && this.sunElevation < 12;
    this.lightsOn = this.sunElevation < 3.5;   // tower + windows switch on at dusk
    this.starAlpha = p.star * clamp(smoothstep(4, -8, this.sunElevation), 0, 1);
    this.windowLit = clamp(smoothstep(4, -4, this.sunElevation), 0, 1) * (0.55 + 0.45 * (1 - p.star));
    return this;
  }
  /** interpolate between two hours, for the cinematic sweep */
  static blend(a, b, t) { return new TimeOfDay(lerp(a, b, t)); }
}
