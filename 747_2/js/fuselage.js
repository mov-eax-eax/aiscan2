// js/fuselage.js — Boeing 747-8 fuselage: 76.3 m analytic double-bubble loft with the
// stretched upper deck, dense cabin windows, five main-deck doors and cockpit glazing.
import * as THREE from '../lib/three.module.min.js';
import { clamp, lerp, smoothstep, loft, TAU, roundedSlab, surfaceBasis } from './util.js';

export const FUSE = {
  noseX: 38.15, tailX: -38.15, R: 3.25, noseLen: 8.70,
  coneStartX: -25.20, humpMax: 1.95, exp: 2.04,
  deckY: 0.82, upperY: 3.66, fairingAmp: 0.50,
};
FUSE.len = FUSE.noseX - FUSE.tailX;

export const vOfX = (x) => clamp((FUSE.noseX - x) / FUSE.len, 0, 1);

// ---- doors (5 per side on the main deck, one on the upper deck) -----------------
export const MAIN_DOOR_X = [29.60, 19.20, 3.00, -12.20, -24.60];
export const UPPER_DOOR_X = 27.80;
export const CARGO_DOORS = [
  { id: 'forward', x: 23.20, side: 'S', w: 2.95, h: 1.80, yc: -2.06 },
  { id: 'aft', x: -9.80, side: 'S', w: 2.95, h: 1.80, yc: -2.06 },
  { id: 'bulk', x: -28.60, side: 'S', w: 1.70, h: 1.28, yc: -1.72 },
];

// ---- cabin windows: 20-inch pitch, broken at every door ------------------------
const near = (x, centres, r) => centres.some((c) => Math.abs(x - c) < r);
export const WINDOW_X = [];
for (let x = 28.30; x > -27.70; x -= 0.515) {
  if (!near(x, MAIN_DOOR_X, 0.95)) WINDOW_X.push(+x.toFixed(3));
}
export const UPPER_WINDOW_X = [];
for (let x = 27.30; x > 0.80; x -= 0.92) {
  if (Math.abs(x - UPPER_DOOR_X) > 1.15) UPPER_WINDOW_X.push(+x.toFixed(3));
}

// ---- longitudinal section ------------------------------------------------------
export function fuseProfile(x) {
  const { noseX, R, noseLen, coneStartX, tailX, humpMax } = FUSE;
  let ax = R, ayT = R, ayB = R, cy = 0;
  if (x > noseX - noseLen) {
    const u = clamp((x - (noseX - noseLen)) / noseLen, 0, 1);
    const f = Math.pow(Math.max(0, 1 - Math.pow(u, 2.25)), 0.62);
    ax = R * f;
    ayT = R * f * (1 - 0.05 * u * u);
    ayB = R * Math.pow(f, 1.16);
    cy = -0.24 * Math.pow(u, 2.1);
  } else if (x < coneStartX) {
    const v = clamp((x - tailX) / (coneStartX - tailX), 0, 1);
    ax = 0.30 + (R - 0.30) * Math.pow(v, 1.03);
    ayT = R * (0.17 + 0.83 * Math.pow(v, 0.86));
    ayB = R * (0.17 + 0.83 * Math.pow(v, 1.58));
    cy = 2.05 * Math.pow(1 - v, 1.72);
  }

  // The upper-deck lobe is carried all the way into the nose (the flight deck is
  // cut into its front); it only blends away in the last two metres of the radome.
  const forward = smoothstep(38.05, 35.10, x);
  const aft = smoothstep(-8.4, -2.0, x);
  const hump = humpMax * forward * aft;
  return { ax, ayT, ayB, cy, hump };
}

// Wing/body fairing: the belly grows a smooth teardrop around the wing carry-through.
export function fairingBulge(x, theta) {
  const s = Math.sin(theta);
  const amp = FUSE.fairingAmp * Math.exp(-Math.pow((x + 0.8) / 10.4, 2));
  return amp * Math.pow(Math.max(0, -s), 1.35) * (0.55 + 0.45 * Math.exp(-Math.pow(x / 16, 2)));
}

export function fusePoint(x, theta, out = new THREE.Vector3()) {
  const p = fuseProfile(x);
  const e = 2 / FUSE.exp;
  const c = Math.cos(theta), s = Math.sin(theta);
  const rz = Math.pow(Math.abs(c), e) * (c < 0 ? -1 : 1);
  const ry = Math.pow(Math.abs(s), e) * (s < 0 ? -1 : 1);
  const z = (p.ax + fairingBulge(x, theta) * 0.75) * rz;
  const y = p.cy + (s >= 0 ? p.ayT : p.ayB) * ry + p.hump * Math.pow(0.5 + 0.5 * s, 2.15);
  return out.set(x, y, z);
}

export function fuseNormalAt(x, theta, out = new THREE.Vector3()) {
  const dt = 0.02, dx = 0.05;
  const a = fusePoint(x, theta - dt), b = fusePoint(x, theta + dt);
  const c = fusePoint(x - dx, theta), d = fusePoint(x + dx, theta);
  const t1 = new THREE.Vector3().subVectors(b, a);
  const t2 = new THREE.Vector3().subVectors(d, c);
  out.crossVectors(t1, t2).normalize();
  const p = fusePoint(x, theta), prof = fuseProfile(x);
  if (out.dot(new THREE.Vector3(0, p.y - prof.cy, p.z)) < 0) out.negate();
  return out;
}

// Solve the circumferential angle for a height on one side (supports negative y).
function thetaForAbsY(x, yAbs) {
  let lo = 0, hi = Math.PI / 2;
  for (let i = 0; i < 46; i++) {
    const m = (lo + hi) / 2;
    if (fusePoint(x, m).y < yAbs) lo = m; else hi = m;
  }
  return (lo + hi) / 2;
}
export function thetaForY(x, y, starboard = true) {
  const a = thetaForAbsY(x, Math.abs(y));
  const t = y >= 0 ? a : -a;
  return starboard ? t : Math.PI - t;
}

export function fuseSurface(x, theta) {
  return { point: fusePoint(x, theta), normal: fuseNormalAt(x, theta) };
}

// A curved rectangular patch of skin offset along its normal (decals, glazing).
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

// ---- skin loft -----------------------------------------------------------------
function stationXs() {
  const xs = [];
  const noseEnd = FUSE.noseX - FUSE.noseLen;
  for (let i = 0; i <= 30; i++) {
    const t = i / 30;
    xs.push(lerp(FUSE.noseX - 0.05, noseEnd, 0.5 - 0.5 * Math.cos(t * Math.PI)));
  }
  for (let x = noseEnd - 1.0; x > FUSE.coneStartX; x -= 1.0) xs.push(x);
  for (let i = 0; i <= 30; i++) {
    const t = i / 30;
    xs.push(lerp(FUSE.coneStartX, FUSE.tailX + 0.10, 0.5 - 0.5 * Math.cos(t * Math.PI)));
  }
  return xs;
}

export function fuselageGeometry(radial = 52) {
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

// ---- windows and glazing -------------------------------------------------------
function windowGrid(mats, xs, y, w, h, tag) {
  const items = [];
  for (const x of xs) {
    for (const side of [1, -1]) {
      const th = thetaForY(x, y, side > 0);
      const p = fusePoint(x, th), n = fuseNormalAt(x, th);
      items.push({ x, th, side, p, n });
    }
  }
  // frame ring (extruded rounded rectangle with a hole so the glass sits inside it)
  const shape = new THREE.Shape();
  const hw = w / 2, hh = h / 2, r = Math.min(hw, hh) * 0.42;
  shape.moveTo(-hw + r, -hh);
  shape.lineTo(hw - r, -hh); shape.quadraticCurveTo(hw, -hh, hw, -hh + r);
  shape.lineTo(hw, hh - r); shape.quadraticCurveTo(hw, hh, hw - r, hh);
  shape.lineTo(-hw + r, hh); shape.quadraticCurveTo(-hw, hh, -hw, hh - r);
  shape.lineTo(-hw, -hh + r); shape.quadraticCurveTo(-hw, -hh, -hw + r, -hh);
  const hole = new THREE.Path();
  const iw = hw * 0.72, ih = hh * 0.70, ir = Math.min(iw, ih) * 0.40;
  hole.moveTo(-iw + ir, -ih);
  hole.lineTo(iw - ir, -ih); hole.quadraticCurveTo(iw, -ih, iw, -ih + ir);
  hole.lineTo(iw, ih - ir); hole.quadraticCurveTo(iw, ih, iw - ir, ih);
  hole.lineTo(-iw + ir, ih); hole.quadraticCurveTo(-iw, ih, -iw, ih - ir);
  hole.lineTo(-iw, -ih + ir); hole.quadraticCurveTo(-iw, -ih, -iw + ir, -ih);
  shape.holes.push(hole);
  const frameGeo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.035, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.006, bevelSegments: 1, curveSegments: 4,
  });
  frameGeo.translate(0, 0, -0.02);
  const glassGeo = roundedSlab(w * 0.64, h * 0.67, 0.02, 0.05, 0.004, 4);

  const frameMesh = new THREE.InstancedMesh(frameGeo, mats.windowFrame, items.length);
  const glassMesh = new THREE.InstancedMesh(glassGeo, mats.glassWindow, items.length);
  frameMesh.name = tag + '-frames';
  glassMesh.name = tag;
  const m = new THREE.Matrix4();
  items.forEach((it, i) => {
    const basis = surfaceBasis(it.p.clone().addScaledVector(it.n, -0.006), it.n, new THREE.Vector3(1, 0, 0));
    m.copy(basis);
    frameMesh.setMatrixAt(i, m);
    m.copy(surfaceBasis(it.p.clone().addScaledVector(it.n, 0.012), it.n, new THREE.Vector3(1, 0, 0)));
    glassMesh.setMatrixAt(i, m);
  });
  frameMesh.instanceMatrix.needsUpdate = true;
  glassMesh.instanceMatrix.needsUpdate = true;
  return [frameMesh, glassMesh];
}

function cockpitGlazing(mats) {
  const out = new THREE.Group();
  out.name = 'flight-deck';
  // panes are curved skin patches: [x0, x1, theta0, theta1] on starboard, mirrored for port
  const D = Math.PI / 180;
  // two broad glazing bands per side (forward windscreen + wrap-around side window),
  // divided by raised silver frames so the flight deck reads as a proper 747 visor
  const panes = [
    [33.85, 35.72, 42 * D, 80 * D],
    [32.15, 34.02, 18 * D, 46 * D],
  ];
  for (const side of [1, -1]) {
    for (const [x0, x1, a0, a1] of panes) {
      const t0 = side > 0 ? a0 : Math.PI - a1;
      const t1 = side > 0 ? a1 : Math.PI - a0;
      const frame = new THREE.Mesh(skinPatch(x0 - 0.045, x1 + 0.045, t0 - 0.010, t1 + 0.010, 12, 12, 0.018), mats.frameDark);
      frame.name = 'cockpit-frame';
      out.add(frame);
      const glass = new THREE.Mesh(skinPatch(x0, x1, t0, t1, 12, 12, 0.028), mats.cockpitGlass);
      glass.name = 'cockpit-glass';
      out.add(glass);
    }
    // radial frame dividers between the windscreen and side panes
    for (const [xx, a0, a1] of [[34.25, 20 * D, 79 * D], [33.20, 19 * D, 58 * D]]) {
      const t0 = side > 0 ? a0 : Math.PI - a1;
      const t1 = side > 0 ? a1 : Math.PI - a0;
      const bar = new THREE.Mesh(skinPatch(xx - 0.035, xx + 0.035, t0, t1, 12, 2, 0.034), mats.windowFrame);
      bar.name = 'cockpit-divider';
      out.add(bar);
    }
  }
  return out;
}

export function buildFuselage(mats) {
  const g = new THREE.Group();
  g.name = 'fuselage';
  const skin = new THREE.Mesh(fuselageGeometry(52), mats.skin);
  skin.name = 'fuselage-skin';
  skin.castShadow = true; skin.receiveShadow = true;
  g.add(skin);

  g.add(...windowGrid(mats, WINDOW_X, FUSE.deckY, 0.30, 0.42, 'main-windows'));
  g.add(...windowGrid(mats, UPPER_WINDOW_X, FUSE.upperY, 0.29, 0.40, 'upper-windows'));
  g.add(cockpitGlazing(mats));
  return g;
}
