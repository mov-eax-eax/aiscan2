// js/fuselage.js — 747 fuselage: analytic section loft, cabin windows, port/starboard features.
import * as THREE from '../lib/three.module.min.js';
import { clamp, lerp, smoothstep, loft, TAU, roundedSlab, surfaceBasis } from './util.js';

export const FUSE = {
  noseX: 35.33, tailX: -35.33, R: 3.25, noseLen: 7.5, coneStartX: -20.0,
  humpMax: 1.78, exp: 2.1, deckY: 2.28, upperY: 3.98, fairingAmp: 0.80,
};
FUSE.len = FUSE.noseX - FUSE.tailX;

export const vOfX = (x) => clamp((FUSE.noseX - x) / FUSE.len, 0, 1);
export const xOfV = (v) => FUSE.noseX - v * FUSE.len;

// Cabin window line: 44 windows per side, 1.256 m pitch (real 747-400 spacing).
export const WINDOW_X = Array.from({ length: 44 }, (_, i) => 24.0 - i * (54.0 / 43));
export const UPPER_WINDOW_X = [26.4, 25.5, 24.6];
export const MAIN_DOOR_X = [25.4, 17.6, 1.6, -13.4, -24.6];
export const UPPER_DOOR_X = 27.3;
export const CARGO_DOORS = [
  { id: 'forward', x: 20.4, side: 'S', w: 2.75, h: 1.70, yc: -1.45 },
  { id: 'aft', x: -12.6, side: 'P', w: 2.75, h: 1.70, yc: -1.45 },
  { id: 'bulk', x: -27.0, side: 'S', w: 1.75, h: 1.25, yc: -1.20 },
];

export function fuseProfile(x) {
  const { noseX, R, noseLen, coneStartX, tailX, humpMax } = FUSE;
  let ax = R, ayT = R, ayB = R, cy = 0;
  if (x > noseX - noseLen) {
    const u = clamp((x - (noseX - noseLen)) / noseLen, 0, 1);
    const f = Math.pow(Math.max(0, 1 - Math.pow(u, 2.0)), 0.72);
    ax = R * Math.pow(f, 0.90);
    ayT = R * Math.pow(f, 0.82);
    ayB = R * Math.pow(f, 1.22);
    cy = 0.42 * u * u;
  } else if (x < coneStartX) {
    const v = clamp((x - tailX) / (coneStartX - tailX), 0, 1);
    ax = 0.34 + (R - 0.34) * Math.pow(v, 1.02);
    ayT = R * (0.16 + 0.84 * Math.pow(v, 0.88));
    ayB = R * (0.16 + 0.84 * Math.pow(v, 1.55));
    cy = 1.90 * Math.pow(1 - v, 1.75);
  }
  const hump = humpMax * smoothstep(28.9, 26.7, x) * smoothstep(3.6, 8.2, x);
  return { ax, ayT, ayB, cy, hump };
}

// Wing/body fairing: a smooth widening of the lower fuselage around the wing root.
export function fairingBulge(x, theta) {
  const s = Math.abs(Math.sin(theta));
  const amp = FUSE.fairingAmp * Math.exp(-Math.pow((x + 1.5) / 8.5, 2));
  return amp * Math.pow(Math.max(0, 1 - s), 0.75);
}

export function fusePoint(x, theta, out = new THREE.Vector3()) {
  const p = fuseProfile(x);
  const e = 2 / FUSE.exp;
  const c = Math.cos(theta), s = Math.sin(theta);
  const rz = Math.pow(Math.abs(c), e) * (c < 0 ? -1 : 1);
  const ry = Math.pow(Math.abs(s), e) * (s < 0 ? -1 : 1);
  const z = (p.ax + fairingBulge(x, theta)) * rz;
  const y = p.cy + (s >= 0 ? p.ayT : p.ayB) * ry + p.hump * Math.pow(0.5 + 0.5 * s, 2);
  return out.set(x, y, z);
}

export function fuseNormalAt(x, theta, out = new THREE.Vector3()) {
  const dt = 0.02, dx = 0.06;
  const a = fusePoint(x, theta - dt), b = fusePoint(x, theta + dt);
  const c = fusePoint(x - dx, theta), d = fusePoint(x + dx, theta);
  const t1 = new THREE.Vector3().subVectors(b, a);
  const t2 = new THREE.Vector3().subVectors(d, c);
  out.crossVectors(t1, t2).normalize();
  const p = fusePoint(x, theta), prof = fuseProfile(x);
  if (out.dot(new THREE.Vector3(0, p.y - prof.cy, p.z)) < 0) out.negate();
  return out;
}

export function fuseSurface(x, theta) {
  return { point: fusePoint(x, theta), normal: fuseNormalAt(x, theta) };
}

// Solve for the circumferential angle whose section point sits at height y.
export function thetaForY(x, y, starboard = true) {
  let lo = starboard ? 0 : Math.PI / 2, hi = starboard ? Math.PI / 2 : Math.PI;
  for (let i = 0; i < 44; i++) {
    const m = (lo + hi) / 2, py = fusePoint(x, m).y;
    if (starboard ? py < y : py > y) lo = m; else hi = m;
  }
  return (lo + hi) / 2;
}

// A rectangular patch of skin, offset along the surface normal (decals, glass, plates).
export function skinPatch(x0, x1, th0, th1, nu = 8, nv = 8, offset = 0.012) {
  const rings = [];
  for (let i = 0; i <= nu; i++) {
    const x = lerp(x0, x1, i / nu), ring = [];
    for (let j = 0; j <= nv; j++) {
      const th = lerp(th0, th1, j / nv);
      const p = fusePoint(x, th), n = fuseNormalAt(x, th);
      ring.push(p.addScaledVector(n, offset));
    }
    rings.push(ring);
  }
  const g = loft(rings, { closed: false });
  const pos = g.attributes.position, uv = g.attributes.uv, nor = g.attributes.normal;
  for (let i = 0; i <= nu; i++) {
    for (let j = 0; j <= nv; j++) {
      const k = i * (nv + 1) + j;
      const x = lerp(x0, x1, i / nu), th = lerp(th0, th1, j / nv);
      const n = fuseNormalAt(x, th);
      nor.setXYZ(k, n.x, n.y, n.z);
      uv.setXY(k, i / nu, j / nv);
    }
  }
  pos.needsUpdate = true; uv.needsUpdate = true; nor.needsUpdate = true;
  return g;
}

// Radial profile of the fuselage used to loft the skin.
function stationXs() {
  const xs = [];
  const noseEnd = FUSE.noseX - FUSE.noseLen;
  for (let i = 0; i <= 26; i++) {
    const t = i / 26;
    xs.push(lerp(FUSE.noseX - 0.06, noseEnd, 0.5 - 0.5 * Math.cos(t * Math.PI)));
  }
  for (let x = noseEnd - 1.1; x > FUSE.coneStartX; x -= 1.1) xs.push(x);
  for (let i = 0; i <= 28; i++) {
    const t = i / 28;
    xs.push(lerp(FUSE.coneStartX, FUSE.tailX + 0.12, 0.5 - 0.5 * Math.cos(t * Math.PI)));
  }
  return xs;
}

export function fuselageGeometry(radial = 48) {
  const xs = stationXs();
  const rings = xs.map((x) => {
    const ring = [];
    for (let j = 0; j < radial; j++) ring.push(fusePoint(x, (j / radial) * TAU));
    return ring;
  });
  const g = loft(rings, { closed: true, capStart: true, capEnd: true });
  const pos = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < pos.count; i++) uv.setY(i, vOfX(pos.getX(i)));
  uv.needsUpdate = true;
  g.computeBoundingSphere();
  return g;
}

function windowInstances(glass) {
  const items = [];
  for (const x of WINDOW_X) {
    for (const side of [1, -1]) {
      const th = side > 0 ? thetaForY(x, FUSE.deckY, true) : thetaForY(x, FUSE.deckY, false);
      items.push({ x, th, side, w: 0.28, h: 0.40 });
    }
  }
  for (const x of UPPER_WINDOW_X) {
    for (const side of [1, -1]) {
      const th = side > 0 ? thetaForY(x, FUSE.upperY, true) : thetaForY(x, FUSE.upperY, false);
      items.push({ x, th, side, w: 0.30, h: 0.42 });
    }
  }
  const geo = roundedSlab(0.29, 0.42, 0.03, 0.055, 0.007, 5);
  const mesh = new THREE.InstancedMesh(geo, glass, items.length);
  mesh.name = 'cabin-windows';
  const m = new THREE.Matrix4();
  items.forEach((it, i) => {
    const p = fusePoint(it.x, it.th), n = fuseNormalAt(it.x, it.th);
    const centre = p.clone().addScaledVector(n, -0.009);
    m.copy(surfaceBasis(centre, n, new THREE.Vector3(1, 0, 0)));
    mesh.setMatrixAt(i, m);
  });
  mesh.instanceMatrix.needsUpdate = true;
  return mesh;
}

export function buildFuselage(mats) {
  const g = new THREE.Group();
  g.name = 'fuselage';
  const skin = new THREE.Mesh(fuselageGeometry(48), mats.skin);
  skin.name = 'fuselage-skin';
  skin.castShadow = true; skin.receiveShadow = true;
  g.add(skin);
  g.add(windowInstances(mats.glassWindow));

  // Flight-deck glazing: two forward panes per side wrapping the crown, plus side panes.
  const glass = [];
  for (const s of [1, -1]) {
    const base = s > 0 ? 0 : Math.PI;
    const dir = s > 0 ? 1 : -1;
    glass.push([30.95, 32.55, base + dir * 1.00, base + dir * 1.44]);  // front pane
    glass.push([30.05, 31.70, base + dir * 0.66, base + dir * 1.06]);  // quarter pane
    glass.push([28.80, 30.35, base + dir * 0.38, base + dir * 0.72]);  // side pane
    glass.push([27.60, 29.05, base + dir * 0.34, base + dir * 0.64]);  // aft side pane
  }
  for (const [x0, x1, a0, a1] of glass) {
    const m = new THREE.Mesh(skinPatch(x0, x1, a0, a1, 6, 6, 0.012), mats.cockpitGlass);
    m.name = 'cockpit-glass';
    g.add(m);
  }
  return g;
}
