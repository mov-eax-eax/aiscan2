// ============================================================
// deck.js - the exact silhouette and curved surface of the shell
// All dimensions in centimetres, matching the real 160 x 106 x 66 mm body.
// ============================================================
import * as THREE from 'three';
import { CubicSpline1D, clamp, smoothstep, sampleRoundedRect2D, surfaceNormal, quaternionForNormal } from './lib.js';

export const HALF_WIDTH = 7.0;
export const CAP_RADIUS = 1.0;
export const TOTAL_HALF_WIDTH = HALF_WIDTH + CAP_RADIUS;
export const BODY_TOP = 3.58;
export const BODY_BOTTOM = -6.18;

const top = new CubicSpline1D([
  [0.0, 3.58],
  [1.4, 3.56],
  [2.6, 3.46],
  [3.6, 3.24],
  [4.5, 2.92],
  [5.35, 2.45],
  [6.2, 1.90],
  [6.9, 1.35],
  [7.55, 0.68],
]);
const bottom = new CubicSpline1D([
  [0.0, -2.42],
  [1.4, -2.46],
  [2.5, -2.65],
  [3.2, -3.15],
  [3.8, -3.90],
  [4.4, -4.80],
  [5.0, -5.55],
  [5.6, -6.05],
  [6.2, -6.18],
  [6.75, -5.98],
  [7.2, -5.35],
  [7.55, -4.55],
]);
const front = new CubicSpline1D([
  [0.0, 3.12],
  [1.5, 3.10],
  [2.7, 3.02],
  [3.8, 2.88],
  [4.8, 2.68],
  [5.7, 2.42],
  [6.5, 2.12],
  [7.1, 1.82],
  [7.55, 1.55],
]);
const back = new CubicSpline1D([
  [0.0, -1.55],
  [1.7, -1.55],
  [3.0, -1.62],
  [4.2, -1.74],
  [5.2, -1.92],
  [6.2, -2.16],
  [6.9, -2.38],
  [7.55, -2.60],
]);

export function sectionAt(x) {
  const ax = Math.min(Math.abs(x), HALF_WIDTH);
  const yT = top.eval(ax);
  const yB = bottom.eval(ax);
  const zF = front.eval(ax);
  const zB = back.eval(ax);
  const yc = (yT + yB) * 0.5;
  const hy = (yT - yB) * 0.5;
  const zc = (zF + zB) * 0.5;
  const hz = (zF - zB) * 0.5;
  const corner = 0.66 + 0.34 * smoothstep(4.2, 7.0, ax);
  return { ax, yT, yB, yc, hy, zF, zB, zc, hz, corner };
}

export function deckShift(ax, ly, hy) {
  const tilt = -0.105 * (ly / hy);
  const grip = -0.44 * smoothstep(3.4, 7.0, ax) * (ly / hy);
  const dome = 0.055 * (1 - Math.pow(ax / HALF_WIDTH, 2)) * (1 - Math.pow(ly / hy, 2));
  return tilt + grip + dome;
}

export function surfaceZ(x, y, face = 1) {
  const s = sectionAt(x);
  const ly = clamp(y - s.yc, -s.hy, s.hy);
  const edge = s.hy - Math.abs(ly);
  const r = Math.min(s.corner, s.hy * 0.95, s.hz * 0.95);
  let base;
  if (edge >= r) base = face > 0 ? s.zF : s.zB;
  else {
    const k = r - Math.sqrt(Math.max(0, r * r - (r - edge) * (r - edge)));
    base = face > 0 ? s.zF - k : s.zB + k;
  }
  return base + deckShift(s.ax, ly, s.hy);
}

export function surfaceNormalAt(x, y, face = 1) {
  return surfaceNormal(surfaceZ, x, y, 0.025, face);
}

export function placeOnSurface(obj, x, y, offset = 0, face = 1, extraRot = 0) {
  const n = surfaceNormalAt(x, y, face);
  obj.position.set(x + n.x * offset, y + n.y * offset, surfaceZ(x, y, face) + n.z * offset);
  const q = quaternionForNormal(n);
  if (extraRot) q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), extraRot));
  obj.quaternion.copy(q);
  return obj;
}

function sectionOutline(s, segments = 152) {
  const arcSegments = 20;
  const lineSegments = 12;
  return sampleRoundedRect2D(s.hy, s.hz, s.corner, arcSegments, lineSegments);
}

export function buildShellGeometry() {
  const stations = 280;
  const m = sectionOutline(sectionAt(0)).length;
  const positions = [];
  const uvs = [];
  const indices = [];
  const total = 2 * TOTAL_HALF_WIDTH;

  for (let i = 0; i <= stations; i++) {
    const x = -TOTAL_HALF_WIDTH + (i / stations) * total;
    const ax = Math.abs(x);
    const baseX = Math.min(ax, HALF_WIDTH);
    const s = sectionAt(baseX);
    const outside = Math.max(0, ax - HALF_WIDTH);
    const u = outside / CAP_RADIUS;
    const capScale = u <= 0 ? 1 : Math.sqrt(Math.max(0, 1 - u * u));
    const ring = sectionOutline(s);
    for (let j = 0; j < m; j++) {
      const p = ring[j];
      const ly = p.x * capScale;
      const lz = p.y * capScale;
      const y = s.yc + ly;
      const z = s.zc + lz + deckShift(s.ax, p.x, s.hy) * capScale;
      positions.push(x, y, z);
      uvs.push((x + TOTAL_HALF_WIDTH) / total, j / m);
    }
  }
  for (let i = 0; i < stations; i++) {
    for (let j = 0; j < m; j++) {
      const j2 = (j + 1) % m;
      const a = i * m + j;
      const b = (i + 1) * m + j;
      const c = i * m + j2;
      const d = (i + 1) * m + j2;
      indices.push(a, b, d, a, d, c);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

export const DIMENSIONS = { width: 16.0, height: 10.6, depth: 6.6, weight: 280 };