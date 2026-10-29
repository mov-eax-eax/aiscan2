/**
 * tower.js — the model.
 *
 * Built in the order the eye reads it, with the VOIDS enforced as facts:
 *   ground → 115.73 m   FOUR ISOLATED UPRIGHTS. Nothing spans between them except
 *                       the two belts and the four decorative arches.
 *   above 115.73 m      ONE HOLLOW CAISSON.
 *
 * The lattice is real geometry, coarsely pitched — four corner chords per leg
 * swept as continuous members, plus an X per panel per face. That is the "basics":
 * enough to read as ironwork without ten thousand members.
 */

import * as THREE from 'three';
import { sweptSquare } from '../geom/tube.js';
import * as P from '../geom/profile.js';

const O = P.OFFICIAL;

/* paint-degrade swatches (SETE-derived; no official RAL/hex exists) */
const PAINT = { base: 0x7d5b42, mid: 0x8d6a4b, top: 0xa07d54 };
function paintAt(y) {
  const t = Math.min(1, Math.max(0, y / O.ironTop));
  const c = new THREE.Color();
  if (t < 0.5) c.copy(new THREE.Color(PAINT.base)).lerp(new THREE.Color(PAINT.mid), t / 0.5);
  else c.copy(new THREE.Color(PAINT.mid)).lerp(new THREE.Color(PAINT.top), (t - 0.5) / 0.5);
  return c;
}

function beamMatrix(m, a, b, w, t) {
  const dir = new THREE.Vector3().subVectors(b, a);
  const len = dir.length();
  if (len < 1e-4) return null;
  dir.multiplyScalar(1 / len);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
  const mid = new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5);
  return m.compose(mid, q, new THREE.Vector3(w, len, t));
}

export function buildTower() {
  const group = new THREE.Group();
  group.name = 'EiffelTower';

  const buckets = {};
  const push = (k, a, b, w, t) => (buckets[k] ||= []).push({ a: a.clone(), b: b.clone(), w, t });
  const slabs = [];
  const slab = (kind, x, y, z, w, h, d) => slabs.push({ kind, x, y, z, w, h, d });
  const sweptGeos = [];

  const D1 = P.DECKS[0], D2 = P.DECKS[1], D3 = P.DECKS[2];

  /* ---------------- masonry ---------------- */
  const footC = O.baseOuter / 2 - O.pierWidth / 2;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    slab('stone', sx * footC, 2.2, sz * footC, O.pierWidth, 4.4, O.pierWidth);
  }

  /* ---------------- legs: four isolated uprights, ground → L2 ---------------- */
  const legLevels = [];
  for (let y = 4.6; y < O.L1; y += 6.6) legLevels.push(y);
  legLevels.push(O.L1);
  for (let y = O.L1 + 8; y < O.L2; y += 9.5) legLevels.push(y);
  legLevels.push(O.L2);

  const CH = 0.877;      // chord box — CONSTANT outer. Never a tapering strut.
  const DIAG = 0.34;
  const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]];

  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const node = (ix, iz, y) => {
      const w = P.legWidth(y), c = P.legCentreHalf(y);
      return new THREE.Vector3(sx * c + ix * w / 2, y, sz * c + iz * w / 2);
    };
    // four corner chords, each ONE continuous swept member
    corners.forEach(([ix, iz]) => {
      for (let i = 0; i < legLevels.length - 1; i++) {
        push('chord', node(ix, iz, legLevels[i]), node(ix, iz, legLevels[i + 1]), CH, CH);
      }
    });

    for (let i = 0; i < legLevels.length - 1; i++) {
      const y0 = legLevels[i], y1 = legLevels[i + 1];
      for (let k = 0; k < 4; k++) {
        const [a0, a1] = corners[k], [b0, b1] = corners[(k + 1) % 4];
        const A0 = node(a0, a1, y0), B0 = node(b0, b1, y0);
        const A1 = node(a0, a1, y1), B1 = node(b0, b1, y1);
        push('diag', A0, B1, DIAG, DIAG * 0.7);
        push('diag', B0, A1, DIAG, DIAG * 0.7);
        push('horiz', A0, B0, 0.42, 0.42);
      }
    }
  }

  /* -------- the two belts: the ONLY members crossing the void -------- */
  [[D1, 7.53], [D2, 4.90]].forEach(([d, depth]) => {
    const h = d.half;
    for (const axis of ['x', 'z']) for (const sgn of [-1, 1]) {
      const a = axis === 'x' ? new THREE.Vector3(-h, d.y - depth / 2, sgn * h)
                             : new THREE.Vector3(sgn * h, d.y - depth / 2, -h);
      const b = axis === 'x' ? new THREE.Vector3(h, d.y - depth / 2, sgn * h)
                             : new THREE.Vector3(sgn * h, d.y - depth / 2, h);
      push('belt', a, b, 1.5, depth);
      // vertical web bars along the girder, so it reads as structure not a plate
      for (let k = 0.06; k <= 0.94; k += 0.11) {
        const p = new THREE.Vector3().lerpVectors(a, b, k);
        push('belt', p.clone(), p.clone().setY(d.y + depth / 2), 0.45, 0.45);
      }
    }
    // the deck slab closes the plan at that level
    slab('deck', 0, d.y - 1.0, 0, d.half * 2, 2.0, d.half * 2);
  });

  /* -------- the hollow caisson, L2 → L3 -------- */
  const shaftLevels = [];
  for (let y = O.L2; y < O.L3; y += 9.5) shaftLevels.push(y);
  shaftLevels.push(O.L3);
  const sgns = corners;
  const sNode = (ix, iz, y) => new THREE.Vector3(ix * P.shaftHalf(y), y, iz * P.shaftHalf(y));
  sgns.forEach(([ix, iz]) => {
    for (let i = 0; i < shaftLevels.length - 1; i++) {
      push('chord', sNode(ix, iz, shaftLevels[i]), sNode(ix, iz, shaftLevels[i + 1]), 0.62, 0.62);
    }
  });

  for (let i = 0; i < shaftLevels.length - 1; i++) {
    const y0 = shaftLevels[i], y1 = shaftLevels[i + 1];
    for (let k = 0; k < 4; k++) {
      const [a0, a1] = sgns[k], [b0, b1] = sgns[(k + 1) % 4];
      const A0 = sNode(a0, a1, y0), B0 = sNode(b0, b1, y0);
      const A1 = sNode(a0, a1, y1), B1 = sNode(b0, b1, y1);
      push('diag', A0, B1, 0.30, 0.22);
      push('diag', B0, A1, 0.30, 0.22);
      push('horiz', A0, B0, 0.34, 0.34);
      const M0 = new THREE.Vector3().addVectors(A0, B0).multiplyScalar(0.5);
      const M1 = new THREE.Vector3().addVectors(A1, B1).multiplyScalar(0.5);
      push('horiz', M0, M1, 0.34, 0.34);      // mid-face mullion
    }
  }

  /* -------- third platform, campanile, antenna -------- */
  slab('deck', 0, D3.y - 0.8, 0, D3.half * 2, 1.6, D3.half * 2);
  const camp = [];
  for (let y = D3.y; y <= O.ironTop; y += 2.4) camp.push(y);
  for (let i = 0; i < camp.length - 1; i++) {
    const w = Math.max(0.6, P.shaftHalf(camp[i]) * 1.2);
    push('chord', new THREE.Vector3(0, camp[i], 0), new THREE.Vector3(0, camp[i + 1], 0), w, w);
  }

  const ant = [];
  for (let y = O.ironTop; y <= O.height; y += 3) ant.push(y);
  for (let i = 0; i < ant.length - 1; i++) {
    const w = Math.max(0.24, P.profileHalf(ant[i]) * 1.8);
    push('chord', new THREE.Vector3(0, ant[i], 0), new THREE.Vector3(0, ant[i + 1], 0), w, w);
  }

  /* -------- the four decorative arches — the ONLY allowed void-crossers -------- */
  const archPts = P.ARCH.points(56);
  const zc = P.legCentreHalf(P.ARCH.springingY);
  for (const [axis, sgn] of [['z', 1], ['x', 1], ['z', -1], ['x', -1]]) {
    for (const depth of [0, 2.2]) {                       // doubled in depth
      const pts = archPts.map(p => axis === 'z'
        ? new THREE.Vector3(p.x, p.y, sgn * (zc - depth))
        : new THREE.Vector3(sgn * (zc - depth), p.y, p.x));
      for (let i = 0; i < pts.length - 1; i++) {
        push('arch', pts[i], pts[i + 1], depth === 0 ? 0.62 : 0.50, 0.62);
      }
      if (depth === 0) {
        for (let i = 8; i < pts.length - 8; i += 10) {
          const p = pts[i];
          const top = axis === 'z'
            ? new THREE.Vector3(p.x, O.L1 - 7.6, sgn * P.legCentreHalf(O.L1))
            : new THREE.Vector3(sgn * P.legCentreHalf(O.L1), O.L1 - 7.6, p.z);
          push('diag', p, top, 0.28, 0.22);
        }
      }
    }
  }

  /* ---------------- materials ---------------- */
  const matIron = new THREE.MeshStandardMaterial({
    color: 0xffffff, roughness: 0.66, metalness: 0.22, emissive: 0xff9d45, emissiveIntensity: 0
  });
  const matSwept = new THREE.MeshStandardMaterial({
    vertexColors: true, roughness: 0.62, metalness: 0.24, emissive: 0xffa02a, emissiveIntensity: 0
  });
  const matStone = new THREE.MeshStandardMaterial({ color: 0xcfc2a9, roughness: 0.86, metalness: 0.03 });
  const matDeck = new THREE.MeshStandardMaterial({
    color: 0xffffff, roughness: 0.70, metalness: 0.20, emissive: 0xff861c, emissiveIntensity: 0
  });

  /* ---------------- realise ---------------- */
  const unitBox = new THREE.BoxGeometry(1, 1, 1);
  const m = new THREE.Matrix4();
  const col = new THREE.Color();
  let memberCount = 0;

  for (const [name, list] of Object.entries(buckets)) {
    const im = new THREE.InstancedMesh(unitBox, matIron, list.length);
    im.name = 'members:' + name;
    im.castShadow = (name === 'belt' || name === 'arch');
    im.receiveShadow = true;
    list.forEach((r, i) => {
      beamMatrix(m, r.a, r.b, r.w, r.t);
      im.setMatrixAt(i, m);
      const shade = name === 'diag' ? 1.06 : name === 'horiz' ? 0.93 : name === 'belt' ? 0.86 : 1.0;
      im.setColorAt(i, paintAt((r.a.y + r.b.y) / 2).multiplyScalar(shade));
    });
    im.instanceMatrix.needsUpdate = true;
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
    group.add(im);
    memberCount += list.length;
  }

  // swept members: bake the paint degrade into vertex colours
  sweptGeos.forEach(geo => {
    const pos = geo.attributes.position;
    const cols = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      const c = paintAt(pos.getY(i));
      cols[i * 3] = c.r; cols[i * 3 + 1] = c.g; cols[i * 3 + 2] = c.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    const mesh = new THREE.Mesh(geo, matSwept);
    mesh.receiveShadow = true;
    group.add(mesh);
    memberCount += 1;
  });

  const mkSlabs = (arr, material, name, shaded) => {
    if (!arr.length) return;
    const im = new THREE.InstancedMesh(unitBox, material, arr.length);
    im.name = name; im.castShadow = true; im.receiveShadow = true;
    arr.forEach((s, i) => {
      m.compose(new THREE.Vector3(s.x, s.y, s.z), new THREE.Quaternion(), new THREE.Vector3(s.w, s.h, s.d));
      im.setMatrixAt(i, m);
      if (shaded) im.setColorAt(i, paintAt(s.y).multiplyScalar(0.60));
    });
    im.instanceMatrix.needsUpdate = true;
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
    group.add(im);
    memberCount += arr.length;
  };
  mkSlabs(slabs.filter(s => s.kind === 'stone'), matStone, 'foundations', false);
  mkSlabs(slabs.filter(s => s.kind === 'deck'), matDeck, 'decks', true);

  group.userData.memberCount = memberCount;
  group.userData.buckets = buckets;
  group.userData.materials = [matIron, matSwept, matStone, matDeck];
  return group;
}
