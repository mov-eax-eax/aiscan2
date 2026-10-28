// js/util.js — geometry + procedural texture helpers for the 747 model.
// Pure maths / geometry helpers (no DOM) plus canvas texture utilities (browser only).
import * as THREE from '../lib/three.module.min.js';

export const DEG = Math.PI / 180;
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const invLerp = (a, b, v) => (Math.abs(b - a) < 1e-12 ? 0 : (v - a) / (b - a));
export const smoothstep = (e0, e1, x) => { const t = clamp(invLerp(e0, e1, x), 0, 1); return t * t * (3 - 2 * t); };
export const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
export const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
export const TAU = Math.PI * 2;

// Piecewise-linear sampler over a table of rows sorted by rows[i][key].
export function sampleRow(rows, key, v) {
  if (v <= rows[0][key]) return { ...rows[0] };
  const last = rows[rows.length - 1];
  if (v >= last[key]) return { ...last };
  for (let i = 0; i < rows.length - 1; i++) {
    const a = rows[i], b = rows[i + 1];
    if (v >= a[key] && v <= b[key]) {
      const t = invLerp(a[key], b[key], v), o = {};
      for (const k in a) o[k] = typeof a[k] === 'number' && typeof b[k] === 'number' ? lerp(a[k], b[k], t) : a[k];
      return o;
    }
  }
  return { ...last };
}

// Ordered list of segments+1 chord fractions, cosine spaced (dense at both edges).
export function cosineSpacing(segments, from = 0, to = 1) {
  const out = [];
  for (let i = 0; i <= segments; i++) out.push(from + (to - from) * (0.5 - 0.5 * Math.cos((i / segments) * Math.PI)));
  return out;
}

// Loft a set of equal-length rings (arrays of Vector3) into a BufferGeometry.
// closed=true wraps each ring back on itself; a duplicated seam column keeps UVs sane.
export function loft(rings, { closed = true, capStart = false, capEnd = false, flipNormals = false } = {}) {
  const R = closed ? rings.map((r) => [...r, r[0].clone()]) : rings;
  const rows = R.length, cols = R[0].length;
  const pos = [], uv = [], idx = [];
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      const p = R[i][j];
      pos.push(p.x, p.y, p.z);
      uv.push(cols > 1 ? j / (cols - 1) : 0, rows > 1 ? i / (rows - 1) : 0);
    }
  }
  for (let i = 0; i < rows - 1; i++) {
    for (let j = 0; j < cols - 1; j++) {
      const a = i * cols + j, b = a + 1, c = (i + 1) * cols + j + 1, d = (i + 1) * cols + j;
      if (flipNormals) idx.push(a, c, b, a, d, c); else idx.push(a, b, c, a, c, d);
    }
  }
  const addCap = (ringIdx, flip) => {
    const base = pos.length / 3;
    let cx = 0, cy = 0, cz = 0;
    for (const p of R[ringIdx]) { cx += p.x; cy += p.y; cz += p.z; }
    const n = R[ringIdx].length;
    pos.push(cx / n, cy / n, cz / n);
    uv.push(0.5, ringIdx === 0 ? 0 : 1);
    for (let j = 0; j < n - 1; j++) {
      const a = ringIdx * cols + j, b = ringIdx * cols + j + 1;
      if (flip) idx.push(base, b, a); else idx.push(base, a, b);
    }
  };
  if (capStart) addCap(0, true);
  if (capEnd) addCap(rows - 1, false);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// Revolve a 2D profile [{r,y}...] around the Y axis; a closed profile makes a shell.
export function revolve(profile, segments = 48, axis = 'y') {
  const pts = profile.map((p) => new THREE.Vector2(Math.max(1e-4, p.r), p.y));
  const g = new THREE.LatheGeometry(pts, segments);
  if (axis === 'x') g.rotateZ(-Math.PI / 2);
  if (axis === 'z') g.rotateX(Math.PI / 2);
  return g;
}

// Rounded rectangle shape centred on the origin.
export function roundedRectShape(w, h, r) {
  const s = new THREE.Shape();
  const x = -w / 2, y = -h / 2;
  r = Math.min(r, Math.min(w, h) / 2 - 1e-4);
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

// Extruded rounded slab: width w (x), height h (y), depth d (z), bevelled edges.
export function roundedSlab(w, h, d, r = 0.04, bevel = 0.012, curveSegments = 6) {
  const g = new THREE.ExtrudeGeometry(roundedRectShape(w, h, r), {
    depth: Math.max(1e-3, d - 2 * bevel), bevelEnabled: bevel > 0, bevelThickness: bevel,
    bevelSize: bevel, bevelSegments: 2, curveSegments,
  });
  g.translate(0, 0, -(d - 2 * bevel) / 2);
  return g;
}

// Simple tapered cylinder between two points.
export function strut(a, b, r0, r1, segments = 12) {
  const dir = new THREE.Vector3().subVectors(b, a);
  const len = dir.length();
  const g = new THREE.CylinderGeometry(r1, r0, len, segments, 1, false);
  g.translate(0, len / 2, 0);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
  const m = new THREE.Matrix4().compose(a.clone(), q, new THREE.Vector3(1, 1, 1));
  g.applyMatrix4(m);
  return g;
}

// Aircraft tire: revolved carcass with shoulders and rim.
export function tire(outerR = 0.62, width = 0.44, rimR = 0.27) {
  const hw = width / 2, shoulder = 0.06;
  const prof = [
    { r: rimR, y: -hw }, { r: outerR - shoulder, y: -hw },
    { r: outerR, y: -hw + shoulder }, { r: outerR, y: hw - shoulder },
    { r: outerR - shoulder, y: hw }, { r: rimR, y: hw },
  ];
  return revolve(prof, 32, 'z');
}

// ------------------------------------------------------------------ noise
function hash2(x, y, seed) {
  let h = (x | 0) * 374761393 + (y | 0) * 668265263 + (seed | 0) * 144665;
  h = (h ^ (h >> 13)) * 1274126177;
  h = h ^ (h >> 16);
  return (h >>> 0) / 4294967295;
}
export function valueNoise(x, y, seed = 0) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi, seed), b = hash2(xi + 1, yi, seed);
  const c = hash2(xi, yi + 1, seed), d = hash2(xi + 1, yi + 1, seed);
  return lerp(lerp(a, b, u), lerp(c, d, u), v);
}
export function fbm(x, y, octaves = 4, seed = 0) {
  let s = 0, amp = 0.5, f = 1;
  for (let i = 0; i < octaves; i++) { s += amp * valueNoise(x * f, y * f, seed + i * 17); f *= 2; amp *= 0.5; }
  return s;
}

// ------------------------------------------------------------------ canvas helpers
export function makeCanvas(w, h, readFrequently = false) {
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d', readFrequently ? { willReadFrequently: true } : undefined);
  return { canvas, ctx, w, h };
}

export function canvasTexture(canvas, { repeat = [1, 1], srgb = false, aniso = 8, flipY = true } = {}) {
  const t = new THREE.CanvasTexture(canvas);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat[0], repeat[1]);
  t.anisotropy = aniso;
  t.flipY = flipY;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.needsUpdate = true;
  return t;
}

// Sobel-derive a tangent-space normal map from a greyscale height canvas.
export function normalMapFromHeight(heightCanvas, strength = 2.2) {
  const w = heightCanvas.width, h = heightCanvas.height;
  const src = heightCanvas.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, w, h).data;
  const { canvas, ctx } = makeCanvas(w, h);
  const img = ctx.createImageData(w, h), d = img.data;
  const H = (x, y) => { x = (x + w) % w; y = (y + h) % h; return src[(y * w + x) * 4] / 255; };
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = (H(x - 1, y) - H(x + 1, y)) * strength;
      const dy = (H(x, y - 1) - H(x, y + 1)) * strength;
      const l = Math.hypot(dx, dy, 1);
      const i = (y * w + x) * 4;
      d[i] = (dx / l * 0.5 + 0.5) * 255;
      d[i + 1] = (dy / l * 0.5 + 0.5) * 255;
      d[i + 2] = (1 / l * 0.5 + 0.5) * 255;
      d[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

// Soft radial glow sprite for position lights and strobes.
export function glowSprite(color, size = 1.2, softness = 0.18) {
  const { canvas, ctx } = makeCanvas(128, 128);
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(softness, color);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 128);
  const mat = new THREE.SpriteMaterial({
    map: canvasTexture(canvas, { srgb: true, flipY: false }), blending: THREE.AdditiveBlending,
    depthWrite: false, transparent: true, opacity: 1,
  });
  const s = new THREE.Sprite(mat);
  s.scale.set(size, size, size);
  return s;
}

// Oriented thin plane whose +Z face points along the supplied normal.
export function orientedPlane(w, h, position, normal, mat) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  const n = normal.clone().normalize();
  m.quaternion.copy(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), n));
  m.position.copy(position).addScaledVector(n, 0.004);
  return m;
}

// Text / livery decal plane (the canvas is painted by the caller).
export function decalPlane(canvas, w, h, opts = {}) {
  const tex = canvasTexture(canvas, { srgb: true, aniso: 8 });
  const mat = new THREE.MeshPhysicalMaterial({
    map: tex, transparent: true, roughness: 0.28, metalness: 0.05, clearcoat: 0.8,
    clearcoatRoughness: 0.12, depthWrite: false, ...opts,
  });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  m.renderOrder = 2;
  return m;
}

export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

// Build a right-handed basis at a surface point: x=forward hint, y=up, z=normal.
export function surfaceBasis(position, normal, forwardHint = new THREE.Vector3(1, 0, 0)) {
  const n = normal.clone().normalize();
  const f = forwardHint.clone().projectOnPlane(n).normalize();
  const u = new THREE.Vector3().crossVectors(n, f).normalize();
  return new THREE.Matrix4().makeBasis(f, u, n).setPosition(position);
}

// Mirror a geometry across the X-Y plane, flipping winding so normals stay outward.
export function mirrorZ(geo) {
  const g = geo.clone();
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) p.setZ(i, -p.getZ(i));
  p.needsUpdate = true;
  const idx = g.index;
  if (idx) {
    const a = idx.array;
    for (let i = 0; i < a.length; i += 3) { const t = a[i + 1]; a[i + 1] = a[i + 2]; a[i + 2] = t; }
    idx.needsUpdate = true;
  }
  g.computeVertexNormals();
  g.computeBoundingSphere();
  return g;
}

// Merge a list of {geometry, matrix} into one geometry (position + normal + uv).
export function mergeParts(parts) {
  const pos = [], nor = [], uv = [], idx = [];
  for (const part of parts) {
    const g = part.matrix ? part.geometry.clone().applyMatrix4(part.matrix) : part.geometry;
    const base = pos.length / 3;
    const p = g.attributes.position, n = g.attributes.normal, u = g.attributes.uv;
    for (let i = 0; i < p.count; i++) {
      pos.push(p.getX(i), p.getY(i), p.getZ(i));
      if (n) nor.push(n.getX(i), n.getY(i), n.getZ(i)); else nor.push(0, 1, 0);
      if (u) uv.push(u.getX(i), u.getY(i)); else uv.push(0, 0);
    }
    const gi = g.index;
    if (gi) for (let i = 0; i < gi.count; i++) idx.push(base + gi.getX(i));
    else for (let i = 0; i < p.count; i++) idx.push(base + i);
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  out.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  out.setIndex(idx);
  return out;
}

