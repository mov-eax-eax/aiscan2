import * as THREE from 'three';
import { BeamBatch, loftColumn, panelLevels, clamp } from './lib.js';

const QUADS = [[1, 1], [1, -1], [-1, 1], [-1, -1]];

const corner = (r, k) => {
  const x = k === 0 || k === 3 ? r.x0 : r.x1;
  const z = k === 0 || k === 1 ? r.z0 : r.z1;
  return [x, r.y, z];
};
const FACE_N = [[0, 0, -1], [1, 0, 0], [0, 0, 1], [-1, 0, 0]];

/* The leg is the strip between the outer envelope and the void. Where the
 * void reaches zero the four strips tile the whole square and the legs have
 * become one box - the same rule serves both profiles. */
function legRect(P, sx, sz, y) {
  const w = P.halfWidth(y);
  const v = Math.min(P.voidHalf(y), Math.max(0, w - 0.9));
  return {
    y,
    x0: sx > 0 ? v : -w, x1: sx > 0 ? w : -v,
    z0: sz > 0 ? v : -w, z1: sz > 0 ? w : -v,
  };
}
const fullRect = (P, y) => {
  const w = P.halfWidth(y);
  return { y, x0: -w, x1: w, z0: -w, z1: w };
};

const sizesFor = (face) => ({
  post: clamp(0.105 * face, 0.26, 1.00),
  belt: clamp(0.078 * face, 0.20, 0.80),
  diag: clamp(0.062 * face, 0.17, 0.65),
});

function addLattice(batch, rectAt, levels) {
  for (let i = 0; i < levels.length - 1; i++) {
    const A = rectAt(levels[i]), B = rectAt(levels[i + 1]);
    const s = sizesFor(Math.abs(A.x1 - A.x0));
    for (let k = 0; k < 4; k++) {
      const a = corner(A, k), b = corner(B, k);
      batch.add(a[0], a[1], a[2], b[0], b[1], b[2], s.post, s.post);
    }
    for (let k = 0; k < 4; k++) {
      const k2 = (k + 1) % 4;
      const d1 = corner(A, k), e1 = corner(B, k2);
      const d2 = corner(A, k2), e2 = corner(B, k);
      batch.add(d1[0], d1[1], d1[2], e1[0], e1[1], e1[2], s.diag, s.diag);
      batch.add(d2[0], d2[1], d2[2], e2[0], e2[1], e2[2], s.diag, s.diag);
    }
  }
  for (const y of levels) {
    const R = rectAt(y);
    const s = sizesFor(Math.abs(R.x1 - R.x0));
    for (let k = 0; k < 4; k++) {
      const a = corner(R, k), b = corner(R, (k + 1) % 4);
      batch.add(a[0], a[1], a[2], b[0], b[1], b[2], s.belt, s.belt);
    }
  }
}

/** Perimeter railing on a deck - the floors read as bare tables without it. */
function addRailing(batch, half, y, h) {
  const r = 0.085;
  const top = y + h;
  for (const s of [1, -1]) {
    batch.add(-half, top, s * half, half, top, s * half, r, r);
    batch.add(s * half, top, -half, s * half, top, half, r, r);
  }
  const n = Math.max(3, Math.round((2 * half) / clamp(half * 0.30, 0.8, 3.2)));
  for (let i = 0; i <= n; i++) {
    const t = -half + (2 * half) * i / n;
    batch.add(t, y, -half, t, top, -half, r, r);
    batch.add(t, y, half, t, top, half, r, r);
    batch.add(-half, y, t, -half, top, t, r, r);
    batch.add(half, y, t, half, top, t, r, r);
  }
}

/** The sheet numbers every panel; use those elevations when we have them. */
function levelsFor(P, y0, y1, n, ratio) {
  if (P.belts) {
    const out = [y0];
    for (const b of P.belts) if (b > y0 + 0.5 && b < y1 - 0.5) out.push(b);
    out.push(y1);
    return out;
  }
  return panelLevels(y0, y1, n, ratio);
}

/* ---- the solid-band legs of the sketch ---------------------------------- */
function addLegRibs(batch, P, sx, sz, ya, yb, size) {
  const A = legRect(P, sx, sz, ya), B = legRect(P, sx, sz, yb);
  const o = size * 0.5;
  for (let k = 0; k < 4; k++) {
    const k2 = (k + 1) % 4;
    const n = FACE_N[k];
    const a1 = corner(A, k), a2 = corner(A, k2), b1 = corner(B, k), b2 = corner(B, k2);
    const off = (p) => [p[0] + n[0] * o, p[1], p[2] + n[2] * o];
    const p1 = off(a1), p2 = off(a2), p3 = off(b2), p4 = off(b1);
    batch.add(p1[0], p1[1], p1[2], p3[0], p3[1], p3[2], size, size);
    batch.add(p2[0], p2[1], p2[2], p4[0], p4[1], p4[2], size, size);
  }
}
function collar(P, sx, sz, y, h, grow) {
  const mk = (yy) => {
    const r = legRect(P, sx, sz, yy);
    return { y: yy, x0: r.x0 - grow, x1: r.x1 + grow, z0: r.z0 - grow, z1: r.z1 + grow };
  };
  return loftColumn([mk(y - h * 0.5), mk(y + h * 0.5)]);
}

export function buildTower(P) {
  const group = new THREE.Group();
  const iron = new THREE.MeshStandardMaterial({ color: 0xb28a46, metalness: 0.45, roughness: 0.46, envMapIntensity: 0.8 });
  const deck = new THREE.MeshStandardMaterial({ color: 0x8a6a34, metalness: 0.45, roughness: 0.50, envMapIntensity: 0.75 });
  const rib = new THREE.MeshStandardMaterial({ color: 0x6a4526, metalness: 0.45, roughness: 0.55, envMapIntensity: 0.6 });
  const stone = new THREE.MeshStandardMaterial({ color: 0x9c9484, metalness: 0.0, roughness: 0.88 });

  const solid = [], collars = [], blocks = [];
  const beams = new BeamBatch();

  const p0 = P.platforms[0];
  const p1 = P.platforms[1];
  const legTop = p0[0], midA = p0[1], midB = p1[0];

  if (P.style === 'solid') {
    const legLevels = [-0.6];
    for (let y = 0; y <= legTop + 1e-6; y += 0.5) legLevels.push(Math.min(y, legTop));
    for (const [sx, sz] of QUADS) solid.push(loftColumn(legLevels.map((y) => legRect(P, sx, sz, y))));
    const legPanels = levelsFor(P, 0, legTop, P.panels.leg, 1);
    for (let i = 1; i < legPanels.length - 1; i++) {
      for (const [sx, sz] of QUADS) collars.push(collar(P, sx, sz, legPanels[i], 0.42, 0.15));
    }
    for (let i = 0; i < legPanels.length - 1; i++) {
      for (const [sx, sz] of QUADS) addLegRibs(beams, P, sx, sz, legPanels[i] + (i === 0 ? 0.6 : 0), legPanels[i + 1], 0.42);
    }

    const midLevels = [];
    for (let y = midA; y <= midB + 1e-6; y += 0.5) midLevels.push(Math.min(y, midB));
    for (const [sx, sz] of QUADS) solid.push(loftColumn(midLevels.map((y) => legRect(P, sx, sz, y))));
    const midPanels = levelsFor(P, midA, midB, P.panels.mid, 1);
    for (let i = 1; i < midPanels.length - 1; i++) {
      for (const [sx, sz] of QUADS) collars.push(collar(P, sx, sz, midPanels[i], 0.38, 0.12));
    }
    for (let i = 0; i < midPanels.length - 1; i++) {
      for (const [sx, sz] of QUADS) addLegRibs(beams, P, sx, sz, midPanels[i], midPanels[i + 1], 0.34);
    }
  } else {
    for (const [sx, sz] of QUADS) {
      addLattice(beams, (y) => legRect(P, sx, sz, y), levelsFor(P, 0, legTop, P.panels.leg, 1));
      addLattice(beams, (y) => legRect(P, sx, sz, y), levelsFor(P, midA, midB, P.panels.mid, 1));
    }
  }

  /* ---- the shafts above the second floor ---- */
  addLattice(beams, (y) => fullRect(P, y), levelsFor(P, P.shaft[0], P.shaft[1], P.panels.shaft, 0.955));

  if (P.midDeck) {
    const w = P.halfWidth(P.midDeck) + 0.55;
    const g = new THREE.BoxGeometry(2 * w, 0.55, 2 * w);
    const m = new THREE.Mesh(g, deck);
    m.position.y = P.midDeck;
    m.name = 'deck';
    blocks.push(m);
  }

  /* ---- floor slabs: a deep girder carrying a thin overhanging plate ---- */
  for (const [y0, y1, dw] of P.platforms) {
    const h = y1 - y0;
    const plateH = Math.min(0.72, h * 0.26);
    const girderH = h - plateH;
    const m1 = new THREE.Mesh(new THREE.BoxGeometry(2 * dw - 0.8, girderH, 2 * dw - 0.8), deck);
    m1.position.y = y0 + girderH * 0.5;
    const m2 = new THREE.Mesh(new THREE.BoxGeometry(2 * dw, plateH, 2 * dw), deck);
    m2.position.y = y1 - plateH * 0.5;
    m1.name = m2.name = 'deck';
    blocks.push(m1, m2);
    addRailing(beams, dw - 0.22, y1, Math.max(0.42, dw * 0.055));
  }

  /* ---- campanile, spire, mast ---- */
  const ringRange = (a, b, step, minW) => {
    const out = [];
    for (let y = a; y <= b + 1e-6; y += step) {
      const yy = Math.min(y, b);
      const w = Math.max(P.halfWidth(yy), minW);
      out.push({ y: yy, x0: -w, x1: w, z0: -w, z1: w });
    }
    return out;
  };
  solid.push(loftColumn(ringRange(P.campanile[0], P.campanile[1], 0.4, 0.35)));
  solid.push(loftColumn(ringRange(P.spire[0], P.spire[1], 0.4, 0.10)));
  if (P.antenna) {
    const mast = new THREE.Mesh(
      new THREE.CylinderGeometry(0.10, 0.22, P.antenna[1] - P.antenna[0], 8),
      deck);
    mast.position.y = (P.antenna[0] + P.antenna[1]) * 0.5;
    mast.name = 'deck';
    blocks.push(mast);
  }

  /* ---- masonry plinths ---- */
  if (P.plinths) {
    for (const [sx, sz] of QUADS) {
      const r0 = legRect(P, sx, sz, 0);
      const g = 0.42;
      const lo = { y: -0.6, x0: r0.x0 - g, x1: r0.x1 + g, z0: r0.z0 - g, z1: r0.z1 + g };
      const hi = { y: 1.35, x0: r0.x0 - g * 0.7, x1: r0.x1 + g * 0.7, z0: r0.z0 - g * 0.7, z1: r0.z1 + g * 0.7 };
      const m = new THREE.Mesh(loftColumn([lo, hi]), stone);
      m.name = 'stone';
      blocks.push(m);
    }
  }

  const mat = (geo, m, name) => {
    const mesh = new THREE.Mesh(geo, m);
    mesh.name = name;
    mesh.castShadow = true; mesh.receiveShadow = true;
    group.add(mesh);
    return mesh;
  };
  solid.forEach((g) => mat(g, iron, 'solid'));
  collars.forEach((g) => mat(g, rib, 'collar'));
  for (const m of blocks) { m.castShadow = true; m.receiveShadow = true; group.add(m); }

  const beamsMesh = beams.build();
  beamsMesh.name = 'ribs';
  beamsMesh.material = rib;
  beamsMesh.castShadow = true;
  beamsMesh.receiveShadow = true;
  group.add(beamsMesh);

  return { group, members: beams.count, profile: P.id };
}
