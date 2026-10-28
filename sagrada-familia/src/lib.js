// Sagrada Família — shared geometry, material and procedural-texture library.
// Every builder imports from here. The goal is that no builder needs an external
// asset: all stone, glass, mosaic and timber is generated in code.
//
// Conventions:
//   * All lengths are metres.
//   * Geometry helpers return BufferGeometry positioned in world-ish local space.
//   * Merge static geometry aggressively; use instancing for repeats.
//   * Collider format is documented at the bottom of this file.

import * as THREE from 'three';
import { mergeGeometries } from '../vendor/BufferGeometryUtils.js';

export { THREE, mergeGeometries };

// ---------------------------------------------------------------------------
// Randomness
// ---------------------------------------------------------------------------

export function rng(seed = 1) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const rand = (r, a = 0, b = 1) => a + (b - a) * r();
export const randInt = (r, a, b) => Math.floor(rand(r, a, b + 1));
export const pick = (r, arr) => arr[Math.floor(r() * arr.length) % arr.length];
export const chance = (r, p) => r() < p;
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smoothstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

// ---------------------------------------------------------------------------
// Procedural textures (canvas based, generated once, cached)
// ---------------------------------------------------------------------------

const texCache = new Map();

function canvas2d(size) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  return { c, g: c.getContext('2d') };
}

function toTexture(c, { srgb = true, repeat = 2, aniso = 8 } = {}) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.anisotropy = Math.min(aniso, 8);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.needsUpdate = true;
  return t;
}

function hexStr(hex) {
  return `#${hex.toString(16).padStart(6, '0')}`;
}

/** Mottled, weathered limestone. Neutral-ish so material color can tint it. */
export function stoneTexture({ size = 256, seed = 7, base = 0xcfc6b6, repeat = 2 } = {}) {
  const key = `stone:${size}:${seed}:${base}:${repeat}`;
  if (texCache.has(key)) return texCache.get(key);
  const { c, g } = canvas2d(size);
  const r = rng(seed);
  const baseC = new THREE.Color(base);
  g.fillStyle = hexStr(base);
  g.fillRect(0, 0, size, size);

  // broad mottling
  for (let i = 0; i < 520; i++) {
    const x = r() * size;
    const y = r() * size;
    const rad = rand(r, 2, 26);
    const v = rand(r, -0.09, 0.1);
    const col = baseC.clone().offsetHSL(rand(r, -0.02, 0.02), rand(r, -0.03, 0.03), v);
    g.globalAlpha = rand(r, 0.03, 0.16);
    g.fillStyle = hexStr(col.getHex());
    g.beginPath();
    g.ellipse(x, y, rad, rad * rand(r, 0.35, 1), rand(r, 0, Math.PI), 0, Math.PI * 2);
    g.fill();
  }
  // fine grain
  g.globalAlpha = 1;
  for (let i = 0; i < size * 10; i++) {
    const x = r() * size;
    const y = r() * size;
    const v = r();
    g.fillStyle = v > 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(40,30,20,0.055)';
    g.fillRect(x, y, rand(r, 0.6, 1.8), rand(r, 0.6, 1.8));
  }
  // hairline cracks / bedding
  for (let i = 0; i < 26; i++) {
    g.strokeStyle = `rgba(50,38,26,${rand(r, 0.04, 0.12).toFixed(3)})`;
    g.lineWidth = rand(r, 0.4, 1.1);
    let x = r() * size;
    let y = r() * size;
    g.beginPath();
    g.moveTo(x, y);
    for (let k = 0; k < 6; k++) {
      x += rand(r, -18, 18);
      y += rand(r, -14, 14);
      g.lineTo(x, y);
    }
    g.stroke();
  }
  // a few pale veins
  for (let i = 0; i < 14; i++) {
    g.strokeStyle = `rgba(255,248,230,${rand(r, 0.03, 0.08).toFixed(3)})`;
    g.lineWidth = rand(r, 0.6, 1.6);
    let x = r() * size;
    let y = r() * size;
    g.beginPath();
    g.moveTo(x, y);
    for (let k = 0; k < 5; k++) {
      x += rand(r, -22, 22);
      y += rand(r, -10, 10);
      g.lineTo(x, y);
    }
    g.stroke();
  }
  const tex = toTexture(c, { repeat });
  texCache.set(key, tex);
  return tex;
}

/** Grayscale grain used as bumpMap. */
export function stoneBumpTexture({ size = 256, seed = 21, repeat = 2 } = {}) {
  const key = `bump:${size}:${seed}:${repeat}`;
  if (texCache.has(key)) return texCache.get(key);
  const { c, g } = canvas2d(size);
  const r = rng(seed);
  g.fillStyle = '#808080';
  g.fillRect(0, 0, size, size);
  for (let i = 0; i < 900; i++) {
    const v = randInt(r, 70, 190);
    g.fillStyle = `rgba(${v},${v},${v},${rand(r, 0.08, 0.3).toFixed(2)})`;
    const rad = rand(r, 1, 8);
    g.beginPath();
    g.ellipse(r() * size, r() * size, rad, rad * rand(r, 0.4, 1), r() * Math.PI, 0, Math.PI * 2);
    g.fill();
  }
  for (let i = 0; i < size * 6; i++) {
    const v = randInt(r, 90, 180);
    g.fillStyle = `rgba(${v},${v},${v},0.25)`;
    g.fillRect(r() * size, r() * size, 1, 1);
  }
  const tex = toTexture(c, { srgb: false, repeat });
  texCache.set(key, tex);
  return tex;
}

/** Glazed ceramic roof tiles, green/verdigris. */
export function roofTexture({ size = 256, seed = 31, repeat = 6 } = {}) {
  const key = `roof:${size}:${seed}:${repeat}`;
  if (texCache.has(key)) return texCache.get(key);
  const { c, g } = canvas2d(size);
  const r = rng(seed);
  g.fillStyle = '#3f5a51';
  g.fillRect(0, 0, size, size);
  const rows = 8;
  const cols = 8;
  const h = size / rows;
  const w = size / cols;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const v = rand(r, -0.06, 0.09);
      const col = new THREE.Color(0x4a6b5e).offsetHSL(rand(r, -0.015, 0.015), rand(r, -0.05, 0.05), v);
      g.fillStyle = hexStr(col.getHex());
      const px = x * w + (y % 2 ? w / 2 : 0);
      g.beginPath();
      g.moveTo(px, y * h + h * 0.08);
      g.quadraticCurveTo(px + w / 2, y * h - h * 0.18, px + w, y * h + h * 0.08);
      g.lineTo(px + w, y * h + h * 0.92);
      g.quadraticCurveTo(px + w / 2, y * h + h * 1.1, px, y * h + h * 0.92);
      g.closePath();
      g.fill();
      g.strokeStyle = 'rgba(15,25,22,0.5)';
      g.lineWidth = 1;
      g.stroke();
    }
  }
  for (let i = 0; i < 300; i++) {
    g.fillStyle = `rgba(190,210,190,${rand(r, 0.01, 0.06).toFixed(3)})`;
    g.fillRect(r() * size, r() * size, rand(r, 1, 3), rand(r, 1, 3));
  }
  const tex = toTexture(c, { repeat });
  texCache.set(key, tex);
  return tex;
}

/** Trencadís mosaic: broken ceramic shards. */
export function mosaicTexture({ size = 256, seed = 41, colors = [0x2f5f9e, 0xd9b25e, 0x9a2d33, 0x48a88e, 0xe6ddca], repeat = 2 } = {}) {
  const key = `mosaic:${size}:${seed}:${colors.join(',')}:${repeat}`;
  if (texCache.has(key)) return texCache.get(key);
  const { c, g } = canvas2d(size);
  const r = rng(seed);
  g.fillStyle = '#b9ad97';
  g.fillRect(0, 0, size, size);
  for (let i = 0; i < 2400; i++) {
    const col = new THREE.Color(pick(r, colors)).offsetHSL(rand(r, -0.03, 0.03), rand(r, -0.1, 0.1), rand(r, -0.1, 0.12));
    g.fillStyle = hexStr(col.getHex());
    const x = r() * size;
    const y = r() * size;
    const s = rand(r, 2, 9);
    g.beginPath();
    if (r() < 0.5) {
      g.moveTo(x, y);
      g.lineTo(x + s, y + rand(r, -2, 2));
      g.lineTo(x + rand(r, -2, 2), y + s);
    } else {
      g.rect(x, y, s, s * rand(r, 0.4, 1));
    }
    g.closePath();
    g.fill();
  }
  const tex = toTexture(c, { repeat });
  texCache.set(key, tex);
  return tex;
}

/** Stained-glass sheet texture: used behind tracery where geometry is too fine. */
export function glassTexture({ size = 256, seed = 51, warm = false, repeat = 1 } = {}) {
  const key = `glass:${size}:${seed}:${warm}:${repeat}`;
  if (texCache.has(key)) return texCache.get(key);
  const { c, g } = canvas2d(size);
  const r = rng(seed);
  const palette = warm
    ? [0x9a2d33, 0xd0832f, 0xb0472e, 0xe0a94a, 0x6b2d62, 0x8f1e2c]
    : [0x2f5fa8, 0x2b7f9e, 0x48a88e, 0x1f4f7a, 0x63b7b1, 0x235c74];
  g.fillStyle = '#223';
  g.fillRect(0, 0, size, size);
  const cols = 6;
  const rows = 10;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      g.fillStyle = hexStr(pick(r, palette));
      const px = x * (size / cols);
      const py = y * (size / rows);
      g.fillRect(px + 2, py + 2, size / cols - 4, size / rows - 4);
      g.fillStyle = `rgba(255,255,255,${rand(r, 0.02, 0.15).toFixed(2)})`;
      g.fillRect(px + 4, py + 4, size / cols - 8, rand(r, 2, 7));
    }
  }
  g.strokeStyle = 'rgba(20,20,24,0.85)';
  g.lineWidth = 3;
  for (let y = 0; y <= rows; y++) {
    g.beginPath();
    g.moveTo(0, y * (size / rows));
    g.lineTo(size, y * (size / rows));
    g.stroke();
  }
  for (let x = 0; x <= cols; x++) {
    g.beginPath();
    g.moveTo(x * (size / cols), 0);
    g.lineTo(x * (size / cols), size);
    g.stroke();
  }
  const tex = toTexture(c, { repeat });
  texCache.set(key, tex);
  return tex;
}

/** Text texture for carved inscriptions and labels. */
export function textTexture(text, {
  font = '600 56px Georgia, "Times New Roman", serif',
  color = '#f2e6c8',
  bg = null,
  pad = 18,
  letterSpacing = 0,
  width = null,
} = {}) {
  const c = document.createElement('canvas');
  const g = c.getContext('2d');
  g.font = font;
  const metrics = g.measureText(text);
  const w = Math.ceil(width || metrics.width + pad * 2);
  const h = 128;
  c.width = w;
  c.height = h;
  const g2 = c.getContext('2d');
  g2.clearRect(0, 0, w, h);
  if (bg) {
    g2.fillStyle = bg;
    g2.fillRect(0, 0, w, h);
  }
  g2.font = font;
  g2.fillStyle = color;
  g2.textAlign = 'center';
  g2.textBaseline = 'middle';
  if (letterSpacing) {
    // Manual letter spacing
    const chars = [...text];
    const widths = chars.map((ch) => g2.measureText(ch).width + letterSpacing);
    const total = widths.reduce((a, b) => a + b, 0) - letterSpacing;
    let x = w / 2 - total / 2;
    for (let i = 0; i < chars.length; i++) {
      g2.fillText(chars[i], x + widths[i] / 2, h / 2);
      x += widths[i];
    }
  } else {
    g2.fillText(text, w / 2, h / 2);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

export function textSprite(text, opts = {}) {
  const tex = textTexture(text, opts);
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, opacity: opts.opacity ?? 1 });
  const spr = new THREE.Sprite(mat);
  const scale = opts.scale ?? 2;
  spr.scale.set(scale * (tex.image.width / tex.image.height), scale, 1);
  return spr;
}

// ---------------------------------------------------------------------------
// Materials (cached)
// ---------------------------------------------------------------------------

const matCache = new Map();

export function stoneMat(color, {
  roughness = 0.9,
  metalness = 0.02,
  flat = false,
  texture = true,
  bumpScale = 0.32,
  repeat = 2,
  emissive = 0x000000,
  emissiveIntensity = 0,
} = {}) {
  const key = `stone:${color}:${roughness}:${metalness}:${flat}:${texture}:${bumpScale}:${repeat}:${emissive}:${emissiveIntensity}`;
  if (matCache.has(key)) return matCache.get(key);
  const m = new THREE.MeshStandardMaterial({
    color,
    roughness,
    metalness,
    flatShading: flat,
  });
  if (texture) {
    m.map = stoneTexture({ repeat });
    m.bumpMap = stoneBumpTexture({ repeat });
    m.bumpScale = bumpScale;
  }
  if (emissive) {
    m.emissive = new THREE.Color(emissive);
    m.emissiveIntensity = emissiveIntensity;
  }
  matCache.set(key, m);
  return m;
}

export const basaltMat = () => stoneMat(0x6d6a64, { roughness: 0.72, repeat: 1.5 });
export const porphyryMat = () => stoneMat(0x793d35, { roughness: 0.66, repeat: 1.2, bumpScale: 0.2 });
export const interiorStoneMat = () => stoneMat(0xd9c9ac, { roughness: 0.86, repeat: 2.4 });
export const plasterMat = () => stoneMat(0xe3d7c2, { roughness: 0.95, repeat: 3, bumpScale: 0.12 });
export const marbleMat = () => stoneMat(0xe6ddca, { roughness: 0.42, repeat: 1.5, bumpScale: 0.08 });

export function metalMat(color = 0x6b583c, { roughness = 0.42, metalness = 0.72, emissive = 0x000000, emissiveIntensity = 0 } = {}) {
  const key = `metal:${color}:${roughness}:${metalness}:${emissive}:${emissiveIntensity}`;
  if (matCache.has(key)) return matCache.get(key);
  const m = new THREE.MeshStandardMaterial({ color, roughness, metalness, emissive: new THREE.Color(emissive), emissiveIntensity });
  matCache.set(key, m);
  return m;
}
export const goldMat = () => metalMat(0xd9b25e, { roughness: 0.3, metalness: 0.68, emissive: 0x4a3410, emissiveIntensity: 0.22 });
export const brightGoldMat = () => metalMat(0xf0d27a, { roughness: 0.24, metalness: 0.72, emissive: 0x6a4f1a, emissiveIntensity: 0.3 });
export const bronzeMat = () => metalMat(0x6b583c, { roughness: 0.5, metalness: 0.6 });
export const bellMat = () => metalMat(0x7d6440, { roughness: 0.4, metalness: 0.64 });
export const ironMat = () => metalMat(0x3d3a35, { roughness: 0.62, metalness: 0.42 });

export function roofMat() {
  const key = 'roofmat';
  if (matCache.has(key)) return matCache.get(key);
  const m = new THREE.MeshStandardMaterial({
    color: 0x8ca99a,
    map: roofTexture({ repeat: 5 }),
    roughness: 0.34,
    metalness: 0.24,
  });
  matCache.set(key, m);
  return m;
}

export function mosaicMat(colors) {
  const key = `mosaicmat:${colors ? colors.join(',') : 'default'}`;
  if (matCache.has(key)) return matCache.get(key);
  const m = new THREE.MeshStandardMaterial({
    map: mosaicTexture({ colors: colors || undefined, repeat: 2 }),
    roughness: 0.34,
    metalness: 0.18,
  });
  matCache.set(key, m);
  return m;
}

export function woodMat() {
  return stoneMat(0x5e4028, { roughness: 0.72, repeat: 2, bumpScale: 0.15, texture: true });
}

export const glassMaterial = new THREE.MeshBasicMaterial({
  vertexColors: true,
  transparent: true,
  opacity: 0.92,
  side: THREE.DoubleSide,
  toneMapped: true,
});
// Updated by the day/night system (0.55 grey by day, bright at night).
glassMaterial.userData.dayColor = new THREE.Color(0.72, 0.75, 0.8);
glassMaterial.userData.nightColor = new THREE.Color(1.35, 1.32, 1.25);
glassMaterial.color.copy(glassMaterial.userData.dayColor);

export function candleFlameMat() {
  const key = 'flame';
  if (matCache.has(key)) return matCache.get(key);
  const m = new THREE.MeshBasicMaterial({ color: 0xffbf66, transparent: true, opacity: 0.95 });
  matCache.set(key, m);
  return m;
}

// ---------------------------------------------------------------------------
// Geometry primitives and transforms
// ---------------------------------------------------------------------------

const _m4 = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _v = new THREE.Vector3();
const _v2 = new THREE.Vector3();

export function xform(geo, { x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1, order = 'XYZ' } = {}) {
  if (sx !== 1 || sy !== 1 || sz !== 1) {
    _m4.makeScale(sx, sy, sz);
    geo.applyMatrix4(_m4);
  }
  if (rx || ry || rz) {
    _e.set(rx, ry, rz, order);
    _q.setFromEuler(_e);
    _m4.makeRotationFromQuaternion(_q);
    geo.applyMatrix4(_m4);
  }
  if (x || y || z) geo.translate(x, y, z);
  return geo;
}

export function cloneX(geo, opts) {
  return xform(geo.clone(), opts);
}

export function boxGeo(w, h, d, x = 0, y = 0, z = 0, ry = 0) {
  return xform(new THREE.BoxGeometry(w, h, d), { x, y, z, ry });
}

export function cylGeo(rTop, rBottom, h, seg = 8, x = 0, y = 0, z = 0, ry = 0) {
  return xform(new THREE.CylinderGeometry(rTop, rBottom, h, seg), { x, y, z, ry });
}

export function sphereGeo(r, seg = 10, x = 0, y = 0, z = 0) {
  return xform(new THREE.SphereGeometry(r, seg, Math.max(6, seg >> 1)), { x, y, z });
}

export function coneGeo(r, h, seg = 8, x = 0, y = 0, z = 0, ry = 0) {
  return xform(new THREE.ConeGeometry(r, h, seg), { x, y, z, ry });
}

export function torusGeo(r, tube, seg = 24, tubeSeg = 6) {
  return new THREE.TorusGeometry(r, tube, tubeSeg, seg);
}

/** Cylinder between two points. r0 is radius at a, r1 at b. */
export function limbGeo(a, b, r0, r1 = r0, seg = 6) {
  const start = new THREE.Vector3(...a);
  const end = new THREE.Vector3(...b);
  const dir = new THREE.Vector3().subVectors(end, start);
  const len = dir.length();
  if (len < 1e-5) return new THREE.BufferGeometry();
  const geo = new THREE.CylinderGeometry(r1, r0, len, seg, 1, false);
  const mid = start.clone().add(end).multiplyScalar(0.5);
  geo.translate(0, len / 2, 0);
  const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  geo.applyQuaternion(quat);
  geo.translate(mid.x, mid.y, mid.z);
  return geo;
}

/** Pointed-arch outline. Width w, total height h, springing at spring*h. */
export function archShape(w, h, spring = 0.52) {
  const s = new THREE.Shape();
  const hw = w / 2;
  const springY = h * spring;
  s.moveTo(-hw, 0);
  s.lineTo(hw, 0);
  s.lineTo(hw, springY);
  s.quadraticCurveTo(hw * 0.92, h * 0.93, 0, h);
  s.quadraticCurveTo(-hw * 0.92, h * 0.93, -hw, springY);
  s.lineTo(-hw, 0);
  return s;
}

export function archPath(w, h, spring = 0.52, x0 = 0, y0 = 0) {
  const p = new THREE.Path();
  const hw = w / 2;
  const springY = y0 + h * spring;
  p.moveTo(x0 - hw, y0);
  p.lineTo(x0 - hw, springY);
  p.quadraticCurveTo(x0 - hw * 0.92, y0 + h * 0.93, x0, y0 + h);
  p.quadraticCurveTo(x0 + hw * 0.92, y0 + h * 0.93, x0 + hw, springY);
  p.lineTo(x0 + hw, y0);
  p.lineTo(x0 - hw, y0);
  return p;
}

export function rectPath(w, h, x0 = 0, y0 = 0) {
  const p = new THREE.Path();
  p.moveTo(x0 - w / 2, y0);
  p.lineTo(x0 - w / 2, y0 + h);
  p.lineTo(x0 + w / 2, y0 + h);
  p.lineTo(x0 + w / 2, y0);
  p.lineTo(x0 - w / 2, y0);
  return p;
}

/** Solid arch panel (door leaf / tympanum), from y=0 to h, thickness t. */
export function archPanelGeo(w, h, t = 0.25, { x = 0, y = 0, z = 0, ry = 0, spring = 0.52 } = {}) {
  const shape = archShape(w, h, spring);
  const geo = new THREE.ExtrudeGeometry(shape, { depth: t, bevelEnabled: false, curveSegments: 8 });
  geo.translate(0, 0, -t / 2);
  return xform(geo, { x, y, z, ry });
}

/**
 * A wall panel (in local XY, thickness along +Z) pierced by arched or
 * rectangular openings. Openings: { x, w, h, y0 = -0.999, arch = true }.
 * The wall extends from y = -1 to `height` so doorway holes can reach the
 * ground without touching the outer contour.
 */
export function wallWithOpeningsGeo({
  width,
  height,
  depth = 1,
  openings = [],
  baseExtend = 1.0,
  curveSegments = 8,
} = {}) {
  const shape = new THREE.Shape();
  shape.moveTo(-width / 2, -baseExtend);
  shape.lineTo(width / 2, -baseExtend);
  shape.lineTo(width / 2, height);
  shape.lineTo(-width / 2, height);
  shape.closePath();
  for (const o of openings) {
    const y0 = o.y0 ?? -baseExtend + 0.002;
    const w = o.w;
    const h = o.h + (y0 + baseExtend); // h measured from y0 upward
    const p = new THREE.Path();
    const hw = w / 2;
    const bow = o.bow ?? 0.52;
    if (o.rect) {
      p.moveTo(o.x - hw, y0);
      p.lineTo(o.x - hw, y0 + o.h);
      p.lineTo(o.x + hw, y0 + o.h);
      p.lineTo(o.x + hw, y0);
      p.lineTo(o.x - hw, y0);
    } else {
      const springY = y0 + o.h * bow;
      p.moveTo(o.x - hw, y0);
      p.lineTo(o.x - hw, springY);
      p.quadraticCurveTo(o.x - hw * (o.pinch ?? 0.92), y0 + o.h * 0.93, o.x, y0 + o.h);
      p.quadraticCurveTo(o.x + hw * (o.pinch ?? 0.92), y0 + o.h * 0.93, o.x + hw, springY);
      p.lineTo(o.x + hw, y0);
      p.lineTo(o.x - hw, y0);
    }
    shape.holes.push(p);
  }
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: false,
    curveSegments,
  });
  geo.translate(0, 0, -depth / 2);
  return geo;
}

/** Nested archivolt ring around a portal. Local XY, depth along Z. */
export function archRingGeo({ w, h, band = 1.2, depth = 0.8, spring = 0.52, baseExtend = 0.9 } = {}) {
  // Outer contour starts below the floor so the inner opening (which reaches
  // the floor) is fully enclosed — otherwise triangulation fails.
  const hw = (w + band * 2) / 2;
  const outer = new THREE.Shape();
  const springY = h * spring;
  outer.moveTo(-hw, -baseExtend);
  outer.lineTo(hw, -baseExtend);
  outer.lineTo(hw, springY);
  outer.quadraticCurveTo(hw * 0.92, h * 0.93, 0, h + band);
  outer.quadraticCurveTo(-hw * 0.92, h * 0.93, -hw, springY);
  outer.lineTo(-hw, -baseExtend);
  const hole = archPath(w, h, spring);
  outer.holes.push(hole);
  const geo = new THREE.ExtrudeGeometry(outer, { depth, bevelEnabled: false, curveSegments: 10 });
  geo.translate(0, 0, -depth / 2);
  return geo;
}

/** Extruded shape from a list of [x,y] points. */
export function shapeGeo(points, depth = 0.3, holes = []) {
  const s = new THREE.Shape();
  s.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) s.lineTo(points[i][0], points[i][1]);
  s.closePath();
  for (const hole of holes) {
    const p = new THREE.Path();
    p.moveTo(hole[0][0], hole[0][1]);
    for (let i = 1; i < hole.length; i++) p.lineTo(hole[i][0], hole[i][1]);
    p.closePath();
    s.holes.push(p);
  }
  const geo = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false, curveSegments: 6 });
  geo.translate(0, 0, -depth / 2);
  return geo;
}

/** Tube through points (array of [x,y,z]). */
export function tubeGeo(points, radius = 0.2, { tubularSegments = 48, radialSegments = 6, closed = false, curveType = 'catmullrom' } = {}) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)), closed, curveType, 0.35);
  return new THREE.TubeGeometry(curve, tubularSegments, radius, radialSegments, closed);
}

export function latheGeo(profile, seg = 12, x = 0, y = 0, z = 0) {
  const pts = profile.map(([r, h]) => new THREE.Vector2(Math.max(0.0001, r), h));
  const geo = new THREE.LatheGeometry(pts, seg);
  return xform(geo, { x, y, z });
}

// ---------------------------------------------------------------------------
// Merging and instancing
// ---------------------------------------------------------------------------

function cleanGeo(geo) {
  let g = geo.index ? geo.toNonIndexed() : geo.clone();
  if (!g.attributes.position) return null;
  if (!g.attributes.normal) g.computeVertexNormals();
  if (!g.attributes.uv) {
    const n = g.attributes.position.count;
    g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
  }
  // Keep only the attributes every helper produces, so merging is reliable.
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', g.attributes.position.clone());
  out.setAttribute('normal', g.attributes.normal.clone());
  out.setAttribute('uv', g.attributes.uv.clone());
  if (g.attributes.color) out.setAttribute('color', g.attributes.color.clone());
  out.boundingBox = g.boundingBox;
  out.boundingSphere = g.boundingSphere;
  return out;
}

/** Merge many geometries into one; skips empty geometries. */
export function mergeGeos(geos) {
  const list = [];
  for (const g of geos) {
    if (!g) continue;
    const c = cleanGeo(g);
    if (c && c.attributes.position.count > 0) list.push(c);
  }
  if (list.length === 0) return null;
  if (list.length === 1) return list[0];
  const hasColor = list.every((g) => g.attributes.color);
  if (!hasColor) for (const g of list) g.deleteAttribute('color');
  try {
    return mergeGeometries(list, false);
  } catch (e) {
    console.warn('mergeGeos failed, falling back to largest geometry', e);
    return list[0];
  }
}

/** Merge geometries and attach as one mesh to parent. */
export function addMerged(parent, geos, material, { castShadow = true, receiveShadow = true, name = '' } = {}) {
  const g = mergeGeos(geos);
  if (!g) return null;
  const mesh = new THREE.Mesh(g, material);
  mesh.castShadow = castShadow;
  mesh.receiveShadow = receiveShadow;
  mesh.name = name;
  parent.add(mesh);
  return mesh;
}

/** Bake a color attribute into a geometry (for vertex-coloured glass). */
export function colorize(geo, color) {
  const g = geo.index ? geo.toNonIndexed() : geo.clone();
  if (!g.attributes.normal) g.computeVertexNormals();
  if (!g.attributes.uv) {
    const n = g.attributes.position.count;
    g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
  }
  const c = new THREE.Color(color);
  const n = g.attributes.position.count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    arr[i * 3] = c.r;
    arr[i * 3 + 1] = c.g;
    arr[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return g;
}

/** Merge {geo, color} parts into a single vertex-coloured geometry. */
export function mergeColored(parts) {
  const geos = [];
  for (const p of parts) {
    if (!p || !p.geo) continue;
    geos.push(colorize(p.geo, p.color));
  }
  return mergeGeos(geos);
}

export function instancedMesh(geo, material, matrices, { castShadow = true, receiveShadow = true } = {}) {
  if (!matrices.length) return null;
  const mesh = new THREE.InstancedMesh(geo, material, matrices.length);
  for (let i = 0; i < matrices.length; i++) mesh.setMatrixAt(i, matrices[i]);
  mesh.instanceMatrix.needsUpdate = true;
  mesh.castShadow = castShadow;
  mesh.receiveShadow = receiveShadow;
  mesh.frustumCulled = false;
  return mesh;
}

export function matrixAt(x, y, z, { rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1, order = 'XYZ' } = {}) {
  const m = new THREE.Matrix4();
  m.compose(
    new THREE.Vector3(x, y, z),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, order)),
    new THREE.Vector3(sx, sy, sz)
  );
  return m;
}

export function matricesFrom(list, fn) {
  return list.map((item, i) => {
    const p = fn(item, i);
    return matrixAt(p.x, p.y, p.z, p);
  });
}

// ---------------------------------------------------------------------------
// Architectural sub-assemblies
// ---------------------------------------------------------------------------

/** A simple pinnacle: plinth, ribbed tapering shaft, cornice, spire, finial. */
export function pinnacleGeo({
  base = 1.2,
  height = 8,
  tiers = 2,
  finial = 0.26,
  seg = 4,
  seed = 3,
} = {}) {
  const r = rng(seed);
  const parts = [];
  parts.push(boxGeo(base, base * 0.35, base, 0, base * 0.175, 0));
  let y = base * 0.35;
  const segH = (height - y) / tiers;
  let w = base;
  for (let i = 0; i < tiers; i++) {
    const h = segH * (i === tiers - 1 ? 1.35 : 1);
    parts.push(xform(new THREE.CylinderGeometry(w * 0.22, w * 0.46, h, seg), { y: y + h / 2, ry: Math.PI / 4 }));
    y += h;
    w *= 0.72;
    if (i < tiers - 1) {
      parts.push(boxGeo(w * 1.4, 0.16, w * 1.4, 0, y, 0, Math.PI / 4));
      // corner crockets
      for (let k = 0; k < 4; k++) {
        const a = (k / 4) * Math.PI * 2 + Math.PI / 4;
        parts.push(coneGeo(w * 0.12, 0.55, 4, Math.cos(a) * w * 0.55, y + 0.3, Math.sin(a) * w * 0.55));
      }
    }
  }
  parts.push(coneGeo(w * 0.2, height * 0.14, seg, 0, y + height * 0.07, 0, Math.PI / 4));
  parts.push(sphereGeo(finial, 8, 0, y + height * 0.16 + finial * 0.4, 0));
  parts.push(coneGeo(finial * 0.38, finial * 1.1, 4, 0, y + height * 0.16 + finial * 1.35, 0, Math.PI / 4));
  return mergeGeos(parts);
}

/** Twelve-pointed star (Star of Bethlehem), lying in the XY plane. */
export function starGeo(points = 12, outer = 5, inner = 1.5, depth = 0.5) {
  const s = new THREE.Shape();
  for (let i = 0; i < points * 2; i++) {
    const a = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2;
    const rad = i % 2 === 0 ? outer : inner;
    const x = Math.cos(a) * rad;
    const y = Math.sin(a) * rad;
    if (i === 0) s.moveTo(x, y);
    else s.lineTo(x, y);
  }
  s.closePath();
  const geo = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelThickness: depth * 0.35, bevelSize: outer * 0.04, bevelSegments: 1 });
  geo.translate(0, 0, -depth / 2);
  return geo;
}

/** Four-armed cross with trefoil-ish ends and a small crown. */
export function crossGeo({ arm = 8, thickness = 0.75, depth = 0.6 } = {}) {
  const parts = [];
  parts.push(boxGeo(thickness * 1.15, arm * 2, depth, 0, 0, 0));
  parts.push(boxGeo(arm * 2, thickness * 1.15, depth, 0, arm * 0.12, 0));
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    const x = Math.cos(a) * arm;
    const y = Math.sin(a) * arm + arm * 0.12;
    parts.push(sphereGeo(thickness * 0.55, 8, x, y, 0));
    parts.push(coneGeo(thickness * 0.34, thickness * 1.7, 4, x, y + thickness * 0.8, 0));
  }
  parts.push(coneGeo(arm * 0.22, arm * 0.35, 8, 0, -arm * 0.62, 0, 0));
  return mergeGeos(parts);
}

/** Bell: flared lathe body plus clapper. Returns a Group so it can be animated. */
export function bellGroup({ radius = 1.1, height = 2.6 } = {}) {
  const g = new THREE.Group();
  const body = latheGeo(
    [
      [radius * 0.22, 0],
      [radius * 0.55, height * 0.06],
      [radius * 0.82, height * 0.38],
      [radius * 0.9, height * 0.7],
      [radius, height * 0.98],
      [radius * 1.02, height],
    ],
    14
  );
  const mat = bellMat();
  const bell = new THREE.Mesh(body, mat);
  bell.castShadow = true;
  bell.receiveShadow = true;
  g.add(bell);
  const clapper = new THREE.Mesh(sphereGeo(radius * 0.2, 8), mat);
  clapper.position.y = height * 0.18;
  g.add(clapper);
  const yoke = new THREE.Mesh(boxGeo(radius * 2.2, 0.28, 0.34, 0, height + 0.05, 0), woodMat());
  yoke.castShadow = true;
  g.add(yoke);
  return g;
}

/** Spiral stair around a central newel, useful inside towers. */
export function spiralStairGeo({ radius = 1.35, turns = 4, height = 12, steps = 48, stepThickness = 0.16 } = {}) {
  const parts = [];
  const inner = 0.2;
  const stepAngle = (turns * Math.PI * 2) / steps;
  // central newel
  parts.push(cylGeo(0.17, 0.22, height + 0.5, 10, 0, (height + 0.5) / 2, 0));
  // wedge-shaped treads, each rotated progressively and raised by one riser
  for (let i = 0; i < steps; i++) {
    const a0 = i * stepAngle;
    const a1 = a0 + stepAngle * 1.04;
    const y = (i / steps) * height;
    const pts = [];
    const segs = 4;
    for (let k = 0; k <= segs; k++) {
      const a = a0 + ((a1 - a0) * k) / segs;
      pts.push([Math.cos(a) * radius, Math.sin(a) * radius]);
    }
    pts.push([Math.cos(a1) * inner, Math.sin(a1) * inner]);
    pts.push([Math.cos(a0) * inner, Math.sin(a0) * inner]);
    const tread = shapeGeo(pts, stepThickness, []);
    // shapeGeo is in XY with depth along Z: lay it flat, then rotate to the step angle
    xform(tread, { rx: -Math.PI / 2, y: y, ry: 0 });
    parts.push(tread);
    // riser
    parts.push(boxGeo(0.08, stepThickness * 1.2, radius - inner, 0, y - stepThickness, 0));
  }
  // curved outer handrail, rising with the stair
  const railPts = [];
  const n = 80;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const a = t * turns * Math.PI * 2;
    railPts.push([Math.cos(a) * (radius - 0.08), t * height + 1.0, Math.sin(a) * (radius - 0.08)]);
  }
  parts.push(tubeGeo(railPts, 0.045, { tubularSegments: 120, radialSegments: 5 }));
  // newel cap
  parts.push(sphereGeo(0.28, 8, 0, height + 0.55, 0));
  return mergeGeos(parts);
}

// ---------------------------------------------------------------------------
// Sculpture kit (all one stone material; vertex colour can vary via material)
// ---------------------------------------------------------------------------

function featherGeo(len, width, depth = 0.05) {
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.quadraticCurveTo(width * 0.55, len * 0.35, 0, len);
  s.quadraticCurveTo(-width * 0.55, len * 0.35, 0, 0);
  const geo = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false, curveSegments: 5 });
  geo.translate(0, 0, -depth / 2);
  return geo;
}

/**
 * Robed human figure, feet at y=0, roughly `height` metres tall.
 * pose: 'stand' | 'armsUp' | 'pray' | 'hold' | 'kneel' | 'seated' | 'cross'
 * kind: 'human' | 'angel'
 */
export function figureGeo({
  height = 1.8,
  pose = 'stand',
  kind = 'human',
  hood = false,
  halo = false,
  wings = false,
  seed = 1,
} = {}) {
  const r = rng(seed);
  const s = height / 1.8;
  const parts = [];
  const kneel = pose === 'kneel' || pose === 'seated';
  const bodyScaleY = kneel ? 0.66 : 1;

  const profile = [
    [0.001, 0],
    [0.31, 0],
    [0.33, 0.05],
    [0.3, 0.22],
    [0.24, 0.55],
    [0.23, 0.82],
    [0.27, 1.02],
    [0.3, 1.16],
    [0.24, 1.28],
    [0.17, 1.36],
    [0.001, 1.38],
  ].map(([x, y]) => [x * s, y * s * bodyScaleY]);
  const robe = new THREE.LatheGeometry(profile.map(([x, y]) => new THREE.Vector2(Math.max(0.001, x), y)), 12);
  parts.push(robe);

  // robe folds
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + rand(r, -0.2, 0.2);
    const x = Math.cos(a) * 0.24 * s;
    const z = Math.sin(a) * 0.24 * s;
    parts.push(limbGeo([x * 0.6, 0.1 * s, z * 0.6], [x, 0.68 * s * bodyScaleY, z], 0.035 * s, 0.012 * s, 4));
  }

  const shoulderY = 1.27 * s * bodyScaleY;
  const headY = 1.5 * s * bodyScaleY;
  // torso/shoulders
  parts.push(xform(new THREE.SphereGeometry(0.24 * s, 10, 6), { y: 1.22 * s * bodyScaleY, sx: 1, sy: 0.75, sz: 0.8 }));
  // neck
  parts.push(cylGeo(0.075 * s, 0.09 * s, 0.12 * s, 7, 0, 1.36 * s * bodyScaleY, 0));
  // head
  parts.push(xform(new THREE.IcosahedronGeometry(0.135 * s, 1), { y: headY, sx: 0.9, sy: 1.06, sz: 0.92 }));
  // nose/brow / beard / hair
  parts.push(coneGeo(0.035 * s, 0.1 * s, 4, 0, headY - 0.02 * s, 0.13 * s, 0));
  parts.push(xform(new THREE.SphereGeometry(0.12 * s, 8, 5), { y: headY - 0.1 * s, z: 0.015 * s, sx: 0.9, sy: 0.8, sz: 0.75 }));
  parts.push(xform(new THREE.SphereGeometry(0.145 * s, 8, 5), { y: headY + 0.055 * s, z: -0.02 * s, sx: 1, sy: 0.68, sz: 1 }));

  if (hood) {
    parts.push(xform(new THREE.SphereGeometry(0.17 * s, 8, 6), { y: headY + 0.02 * s, z: -0.05 * s, sy: 1.1 }));
    // shoulder cape
    parts.push(xform(new THREE.CylinderGeometry(0.28 * s, 0.42 * s, 0.55 * s, 10, 1, true), { y: 1.12 * s * bodyScaleY }));
  }

  // arms
  const armR = 0.055 * s;
  const handRad = 0.06 * s;
  const shL = [-0.24 * s, shoulderY, 0.01];
  const shR = [0.24 * s, shoulderY, 0.01];
  let handL;
  let handR;
  if (pose === 'armsUp') {
    handL = [-0.46 * s, 1.86 * s, 0.02];
    handR = [0.46 * s, 1.86 * s, 0.02];
  } else if (pose === 'pray') {
    handL = [-0.045 * s, 1.24 * s * bodyScaleY, 0.3 * s];
    handR = [0.045 * s, 1.24 * s * bodyScaleY, 0.3 * s];
  } else if (pose === 'hold') {
    handL = [-0.08 * s, 1.02 * s, 0.3 * s];
    handR = [0.08 * s, 1.02 * s, 0.3 * s];
  } else if (pose === 'cross') {
    handL = [-0.4 * s, 1.34 * s, 0.05 * s];
    handR = [0.4 * s, 1.34 * s, 0.05 * s];
  } else if (kneel) {
    handL = [-0.2 * s, 0.95 * s, 0.22 * s];
    handR = [0.2 * s, 0.95 * s, 0.22 * s];
  } else {
    handL = [-0.27 * s, 0.95 * s, 0.13 * s];
    handR = [0.27 * s, 0.95 * s, 0.13 * s];
  }
  // elbows slightly out
  const elbowL = [shL[0] * 1.25, shoulderY - 0.24 * s, 0.04];
  const elbowR = [shR[0] * 1.25, shoulderY - 0.24 * s, 0.04];
  parts.push(limbGeo(shL, elbowL, armR * 1.1, armR, 5));
  parts.push(limbGeo(elbowL, handL, armR, armR * 0.8, 5));
  parts.push(limbGeo(shR, elbowR, armR * 1.1, armR, 5));
  parts.push(limbGeo(elbowR, handR, armR, armR * 0.8, 5));
  parts.push(sphereGeo(handRad * 1.1, 6, ...handL));
  parts.push(sphereGeo(handRad * 1.1, 6, ...handR));

  if (halo) {
    const ring = torusGeo(0.22 * s, 0.018 * s, 20, 5);
    parts.push(xform(ring, { y: headY + 0.15 * s, z: -0.09 * s }));
  }

  if (wings || kind === 'angel') {
    for (const dir of [-1, 1]) {
      for (let i = 0; i < 4; i++) {
        const len = (0.85 - i * 0.12) * s;
        const f = featherGeo(len, (0.22 - i * 0.02) * s, 0.035 * s);
        xform(f, {
          x: dir * (0.16 + i * 0.07) * s,
          y: 1.26 * s - i * 0.06 * s,
          z: -0.14 * s,
          rz: dir * (0.55 + i * 0.18),
          rx: 0.18,
        });
        parts.push(f);
      }
    }
  }

  if (kneel) {
    // lower the head and spread the robe a little
    const g = mergeGeos(parts);
    return xform(g, { y: 0, sx: 1.08, sy: 1, sz: 1.08 });
  }
  return mergeGeos(parts);
}

/** Simplified quadruped (ox, donkey, lamb, lion). */
export function animalGeo({ kind = 'ox', length = 1.6, height = 1.1, seed = 1 } = {}) {
  const r = rng(seed);
  const parts = [];
  const bodyH = height * 0.55;
  const bodyL = length;
  parts.push(xform(new THREE.CapsuleGeometry(bodyH * 0.36, bodyL * 0.55, 4, 8), { y: bodyH * 1.55, rz: Math.PI / 2 }));
  const legH = bodyH * 1.25;
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      parts.push(limbGeo([sx * bodyL * 0.3, bodyH * 1.3, sz * bodyH * 0.3], [sx * bodyL * 0.33, 0, sz * bodyH * 0.36], 0.09, 0.07, 5));
    }
  }
  // neck + head
  const headY = height * 0.95;
  parts.push(limbGeo([bodyL * 0.4, bodyH * 1.6, 0], [bodyL * 0.62, headY, 0], 0.14, 0.1, 6));
  parts.push(xform(new THREE.CapsuleGeometry(0.16, 0.3, 4, 7), { x: bodyL * 0.68, y: headY, rz: Math.PI / 2, ry: 0.2 }));
  if (kind === 'ox' || kind === 'lamb') {
    for (const s of [-1, 1]) {
      parts.push(coneGeo(0.06, 0.32, 4, bodyL * 0.65, headY + 0.14, s * 0.14, s * 0.35));
    }
  }
  if (kind === 'lion') {
    parts.push(xform(new THREE.IcosahedronGeometry(0.28, 0), { x: bodyL * 0.67, y: headY, sx: 1, sy: 1, sz: 0.65 }));
    // mane
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      parts.push(coneGeo(0.08, 0.28, 4, bodyL * 0.67 + Math.cos(a) * 0.22, headY + Math.sin(a) * 0.22, -0.12, a));
    }
  }
  if (kind === 'eagle') {
    // eagle is handled as a bird
    return birdGeo({ size: height * 0.7, wings: true, seed });
  }
  // tail
  parts.push(limbGeo([-bodyL * 0.45, bodyH * 1.7, 0], [-bodyL * 0.58, bodyH * 1.2, rand(r, -0.1, 0.1)], 0.04, 0.02, 4));
  return mergeGeos(parts);
}

/** Bird with optional spread wings. */
export function birdGeo({ size = 0.5, wings = true, seed = 1 } = {}) {
  const r = rng(seed);
  const parts = [];
  parts.push(xform(new THREE.SphereGeometry(size * 0.2, 8, 6), { sy: 0.8, sz: 1.5 }));
  parts.push(xform(new THREE.SphereGeometry(size * 0.12, 7, 5), { y: size * 0.16, z: size * 0.28 }));
  parts.push(coneGeo(size * 0.035, size * 0.12, 4, 0, size * 0.15, size * 0.43, 0));
  if (wings) {
    for (const dir of [-1, 1]) {
      const w = featherGeo(size * 0.55, size * 0.24, size * 0.035);
      xform(w, { x: dir * size * 0.22, y: size * 0.02, z: -size * 0.06, rz: dir * (Math.PI / 2 - 0.35), rx: -0.12 });
      parts.push(w);
    }
  }
  parts.push(coneGeo(size * 0.06, size * 0.28, 4, 0, -size * 0.015, -size * 0.28, 0));
  return mergeGeos(parts);
}

/** Cypress tree (Nativity façade's Tree of Life). */
export function cypressGeo({ height = 12, radius = 1.4, seed = 9 } = {}) {
  const r = rng(seed);
  const parts = [];
  parts.push(cylGeo(0.16, 0.34, height * 0.35, 8, 0, height * 0.175, 0));
  for (let i = 0; i < 9; i++) {
    const t = i / 9;
    const y = height * (0.22 + t * 0.72);
    const rad = radius * (1 - t) * 0.9 + 0.18;
    const off = radius * 0.12 * (1 - t);
    parts.push(xform(new THREE.IcosahedronGeometry(rad, 1), {
      x: rand(r, -off, off),
      y,
      z: rand(r, -off, off),
      sy: 1.15,
      sz: 0.9,
    }));
  }
  parts.push(coneGeo(radius * 0.25, height * 0.16, 8, 0, height * 0.98, 0));
  return mergeGeos(parts);
}

/** Pinnacle cluster used on parapets. */
export function pinnacleClusterGeo({ count = 3, base = 0.8, height = 6, seed = 1 } = {}) {
  const parts = [];
  const r = rng(seed);
  for (let i = 0; i < count; i++) {
    const h = height * rand(r, 0.72, 1.12);
    const p = pinnacleGeo({ base: base * rand(r, 0.8, 1.05), height: h, tiers: 2, seed: seed + i * 13 });
    xform(p, { x: (i - (count - 1) / 2) * base * 1.55 });
    parts.push(p);
  }
  return mergeGeos(parts);
}

// ---------------------------------------------------------------------------
// Windows (stone tracery + vertex-coloured glass)
// ---------------------------------------------------------------------------

/**
 * Rose window parts. Returns { stone, glass } where stone is geometry and
 * glass is a vertex-coloured geometry ready for glassMaterial. Local XY plane,
 * facing +Z, centred at origin.
 */
export function roseWindowParts({ radius = 5, colors = [0x8f1e2c], seed = 1, petals = 12 } = {}) {
  const r = rng(seed);
  const stone = [];
  const glass = [];
  const col = (i, lightShift = 0) => {
    const c = new THREE.Color(colors[i % colors.length]);
    c.offsetHSL(rand(r, -0.012, 0.012), rand(r, -0.06, 0.06), lightShift + rand(r, -0.07, 0.07));
    return c.getHex();
  };
  // outer ring with a chamfered profile feel
  const ring = new THREE.Shape();
  ring.absarc(0, 0, radius, 0, Math.PI * 2, false);
  const ringHole = new THREE.Path();
  ringHole.absarc(0, 0, radius * 0.9, 0, Math.PI * 2, true);
  ring.holes.push(ringHole);
  const ringGeo = new THREE.ExtrudeGeometry(ring, { depth: 0.55, bevelEnabled: true, bevelSize: radius * 0.012, bevelThickness: 0.05, bevelSegments: 1, curveSegments: 32 });
  ringGeo.translate(0, 0, -0.28);
  stone.push(ringGeo);
  // hub
  const hub = new THREE.Shape();
  hub.absarc(0, 0, radius * 0.15, 0, Math.PI * 2, false);
  stone.push(new THREE.ExtrudeGeometry(hub, { depth: 0.7, bevelEnabled: false, curveSegments: 20 }));
  // spokes + rim oculi + small crockets
  for (let i = 0; i < petals; i++) {
    const a = (i / petals) * Math.PI * 2;
    const len = radius * 0.8;
    const sp = boxGeo(0.1, len, 0.32, Math.cos(a + Math.PI / 2) * len / 2, Math.sin(a + Math.PI / 2) * len / 2, 0);
    xform(sp, { rz: a });
    stone.push(sp);
    const cx = Math.cos(a) * radius * 0.8;
    const cy = Math.sin(a) * radius * 0.8;
    const c = new THREE.TorusGeometry(radius * 0.055, radius * 0.011, 4, 14);
    c.translate(cx, cy, 0);
    stone.push(c);
    // tiny trefoil above the rim circle
    for (let k = -1; k <= 1; k++) {
      const aa = a + k * 0.035;
      stone.push(sphereGeo(radius * 0.014, 5, Math.cos(aa) * radius * 0.94, Math.sin(aa) * radius * 0.94, 0));
    }
  }
  // outer ring of small circular openings between spokes
  for (let i = 0; i < petals; i++) {
    const a = ((i + 0.5) / petals) * Math.PI * 2;
    const cx = Math.cos(a) * radius * 0.86;
    const cy = Math.sin(a) * radius * 0.86;
    const c = new THREE.TorusGeometry(radius * 0.032, radius * 0.008, 4, 10);
    c.translate(cx, cy, 0);
    stone.push(c);
  }

  // glass: many small leaded shards, in 3 radial bands x 2 angular subdivisions per petal
  const inner = radius * 0.16;
  const outer = radius * 0.895;
  const rings = [
    [inner, radius * 0.42],
    [radius * 0.42, radius * 0.66],
    [radius * 0.66, outer],
  ];
  for (let p = 0; p < petals; p++) {
    const base0 = (p / petals) * Math.PI * 2;
    const base1 = ((p + 1) / petals) * Math.PI * 2;
    for (let band = 0; band < rings.length; band++) {
      const [r0, r1] = rings[band];
      const sub = band === 0 ? 1 : 2;
      for (let s = 0; s < sub; s++) {
        const a0 = base0 + ((base1 - base0) * s) / sub + 0.012;
        const a1 = base0 + ((base1 - base0) * (s + 1)) / sub - 0.012;
        const mid = (a0 + a1) / 2;
        const pts = [];
        const segs = 2;
        for (let k = 0; k <= segs; k++) {
          const a = a0 + ((a1 - a0) * k) / segs;
          pts.push([Math.cos(a) * r1, Math.sin(a) * r1]);
        }
        for (let k = segs; k >= 0; k--) {
          const a = a0 + ((a1 - a0) * k) / segs;
          pts.push([Math.cos(a) * r0, Math.sin(a) * r0]);
        }
        const colorIndex = (p + band * 3 + (s === 1 ? 2 : 0)) % colors.length;
        glass.push({ geo: shapeGeo(pts, 0.05), color: col(colorIndex, band === 1 ? 0.03 : 0) });
        // emerald/amber accent shards in the middle band
        if (band === 1 && r() < 0.35) {
          const pts2 = [];
          for (let k = 0; k <= segs; k++) {
            const a = a0 + ((a1 - a0) * k) / segs;
            pts2.push([Math.cos(a) * (r1 - 0.15), Math.sin(a) * (r1 - 0.15)]);
          }
          for (let k = segs; k >= 0; k--) {
            const a = a0 + ((a1 - a0) * k) / segs;
            pts2.push([Math.cos(a) * (r0 + (r1 - r0) * 0.45), Math.sin(a) * (r0 + (r1 - r0) * 0.45)]);
          }
          glass.push({ geo: shapeGeo(pts2, 0.045), color: col(colorIndex + 3, 0.08) });
        }
      }
    }
  }
  return { stone: mergeGeos(stone), glass: mergeColored(glass) };
}

/**
 * Lancet window parts. Local XY plane facing +Z, sill at y=0.
 * Returns { stone, glass } (glass is merged vertex-coloured).
 */
export function lancetWindowParts({ w = 3.6, h = 12, colors = [0x2f5fa8], seed = 1, bands = 3 } = {}) {
  const r = rng(seed);
  const stone = [];
  // frame ring
  const frame = archRingGeo({ w, h, band: 0.32, depth: 0.4, spring: 0.55 });
  stone.push(frame);
  // mullions
  for (let i = 1; i < bands; i++) {
    const x = -w / 2 + (w * i) / bands;
    stone.push(boxGeo(0.1, h * 0.9, 0.18, x, h * 0.45, 0));
  }
  // transoms
  for (let i = 1; i < 3; i++) {
    stone.push(boxGeo(w * 0.92, 0.11, 0.18, 0, h * (0.22 + i * 0.2), 0));
  }
  // glass: subdivided into shards
  const glass = [];
  const n = 9;
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n;
    const y = h * 0.06 + t * h * 0.76;
    const width = w * (0.82 - 0.35 * t * t);
    const x = rand(r, -0.08, 0.08) * w;
    const geo = boxGeo(width, (h * 0.76) / n * 0.92, 0.05, x, y, 0);
    glass.push({ geo, color: colors[i % colors.length] });
  }
  // top petal
  const top = archShape(w * 0.7, h * 0.2, 0.5);
  const topGeo = new THREE.ShapeGeometry(top, 8);
  topGeo.translate(0, h * 0.8, 0);
  glass.push({ geo: topGeo, color: colors[(n + 1) % colors.length] });
  return { stone: mergeGeos(stone), glass: mergeColored(glass) };
}

/** Circular oculus (stone rim + glass disc). */
export function oculusParts({ radius = 2, colors = [0x2f5fa8], seed = 1 } = {}) {
  const stone = [];
  const rim = new THREE.Shape();
  rim.absarc(0, 0, radius, 0, Math.PI * 2, false);
  const h = new THREE.Path();
  h.absarc(0, 0, radius * 0.85, 0, Math.PI * 2, true);
  rim.holes.push(h);
  stone.push(new THREE.ExtrudeGeometry(rim, { depth: 0.45, bevelEnabled: false, curveSegments: 24 }));
  // cross mullions
  stone.push(boxGeo(radius * 1.7, 0.12, 0.25));
  stone.push(boxGeo(0.12, radius * 1.7, 0.25));
  const glass = [];
  const r = rng(seed);
  for (let i = 0; i < 8; i++) {
    const a0 = (i / 8) * Math.PI * 2;
    const a1 = ((i + 1) / 8) * Math.PI * 2;
    const pts = [
      [Math.cos(a0) * radius * 0.84, Math.sin(a0) * radius * 0.84],
      [Math.cos(a1) * radius * 0.84, Math.sin(a1) * radius * 0.84],
      [0, 0],
    ];
    glass.push({ geo: shapeGeo(pts, 0.05), color: colors[(i + Math.floor(r() * 2)) % colors.length] });
  }
  return { stone: mergeGeos(stone), glass: mergeColored(glass) };
}

// ---------------------------------------------------------------------------
// Tree columns (the interior forest)
// ---------------------------------------------------------------------------

/**
 * A branching tree column. Returns a merged geometry, feet at y=0.
 * Two intertwined helices around a core, branching into `branches` arms.
 */
export function treeColumnGeo({
  height = 33,
  branchY = 17.5,
  branches = 4,
  radius = 0.9,
  spreadX = 3.6,
  spreadZ = 2.4,
  seed = 1,
  leanX = 0,
  leanZ = 0,
  topY = 45,
} = {}) {
  const r = rng(seed);
  const parts = [];
  const baseY = 0;
  // central core, slightly tapered
  parts.push(cylGeo(radius * 0.55, radius * 0.95, branchY, 12, leanX * 0.2, branchY / 2, leanZ * 0.2));
  // two intertwined helices
  for (let s = 0; s < 2; s++) {
    const pts = [];
    const turns = 1.8;
    const n = 26;
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const a = t * turns * Math.PI * 2 + s * Math.PI;
      const rad = radius * (1.05 - 0.28 * t);
      pts.push([
        Math.cos(a) * rad + leanX * t * 0.2,
        baseY + t * branchY,
        Math.sin(a) * rad + leanZ * t * 0.2,
      ]);
    }
    parts.push(tubeGeo(pts, radius * 0.32, { tubularSegments: 48, radialSegments: 6 }));
  }
  // capital where branches spring
  parts.push(xform(new THREE.SphereGeometry(radius * 1.35, 12, 8), { y: branchY, sy: 0.55 }));
  // branches: catenary curves reaching outward and up to the vault
  for (let b = 0; b < branches; b++) {
    const a = (b / branches) * Math.PI * 2 + rand(r, -0.12, 0.12);
    const endX = Math.cos(a) * spreadX + leanX;
    const endZ = Math.sin(a) * spreadZ + leanZ;
    const endY = topY - rand(r, 0, 3);
    const mid = [
      Math.cos(a) * spreadX * 0.55 + leanX,
      branchY + (endY - branchY) * 0.38,
      Math.sin(a) * spreadZ * 0.55 + leanZ,
    ];
    const pts = [
      [leanX, branchY, leanZ],
      [Math.cos(a) * 0.9, branchY + 2.2, Math.sin(a) * 0.9],
      mid,
      [Math.cos(a) * spreadX * 0.7, branchY + (endY - branchY) * 0.72, Math.sin(a) * spreadZ * 0.7],
      [endX, endY, endZ],
    ];
    parts.push(tubeGeo(pts, radius * 0.24, { tubularSegments: 30, radialSegments: 6 }));
    // fork
    const forkA = a + 0.45;
    const forkEnd = [Math.cos(forkA) * (spreadX + 1.2), endY + 1.5, Math.sin(forkA) * (spreadZ + 1.2)];
    parts.push(tubeGeo([
      [Math.cos(a) * spreadX * 0.62, branchY + (endY - branchY) * 0.72, Math.sin(a) * spreadZ * 0.62],
      forkEnd,
    ], radius * 0.13, { tubularSegments: 12, radialSegments: 5 }));
  }
  return mergeGeos(parts);
}

// ---------------------------------------------------------------------------
// Colliders and hotspots
// ---------------------------------------------------------------------------

/**
 * Collider contract used by experience.js:
 *  box:    { type:'box', x, z, hw, hd, y0, y1, ry }
 *  circle: { type:'circle', x, z, r, y0, y1 }
 * All are centred in XZ; y0/y1 are the vertical extent that blocks movement.
 */
export function boxCollider(x, z, hw, hd, { y0 = 0, y1 = 200, ry = 0 } = {}) {
  return { type: 'box', x, z, hw, hd, y0, y1, ry };
}
export function circleCollider(x, z, r, { y0 = 0, y1 = 200 } = {}) {
  return { type: 'circle', x, z, r, y0, y1 };
}

/**
 * Hotspot contract:
 * { id, title, kicker?, body, position:[x,y,z], radius=12 }
 */
export function hotspot(id, title, body, position, { kicker = '', radius = 14 } = {}) {
  return { id, title, kicker, body, position, radius };
}

// ---------------------------------------------------------------------------
// Misc
// ---------------------------------------------------------------------------

/** Distance from point to segment (used by builders for layout checks). */
export function segDist(p, a, b) {
  const [px, py] = p;
  const [ax, ay] = a;
  const [bx, by] = b;
  const dx = bx - ax;
  const dy = by - ay;
  const t = clamp(((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1), 0, 1);
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/** UV-scale a geometry so tiled textures keep a roughly constant density. */
export function scaleUV(geo, su = 1, sv = 1) {
  const uv = geo.attributes.uv;
  if (!uv) return geo;
  for (let i = 0; i < uv.count; i++) {
    uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv);
  }
  uv.needsUpdate = true;
  return geo;
}

export function setShadows(obj, cast = true, receive = true) {
  obj.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = cast;
      o.receiveShadow = receive;
    }
  });
}

export function group(name = '') {
  const g = new THREE.Group();
  g.name = name;
  return g;
}
