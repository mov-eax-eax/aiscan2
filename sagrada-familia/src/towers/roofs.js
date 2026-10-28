// Roofscape: the glazed green "dragon-back" roofs that tie the towers to the
// shell.
//
//   * nave gable roof   ridge along Z at y=51.5, eaves at x=+/-15 (y=45)
//   * transept gable    ridge along X at y=51.5, eaves at z=+/-15
//   * apse roof         half-cone over the seven radial chapels
//   * gable sealing walls at the four roof ends (behind the façade planes)
//   * ridge crests, eave parapets with pinnacle clusters, dormers
//
// Only roofs and roof furniture are built here — no walls, no façades.

import { DIM } from '../config.js';
import {
  THREE,
  xform,
  boxGeo,
  scaleUV,
  matrixAt,
  shapeGeo,
  pinnacleGeo,
  sphereGeo,
  coneGeo,
  mergeGeos,
  rng,
  rand,
} from '../lib.js';
import { crestProto, windowUnit, simplePinnacleGeo } from './common.js';

const NAVE = { halfSpan: DIM.naveWallX, ridgeY: DIM.roofRidgeY, eaveY: DIM.roofSpringY, overhang: DIM.roofOverhang };
const CROSS = { halfSpan: DIM.transeptHalfWidth, ridgeY: DIM.roofRidgeY, eaveY: DIM.roofSpringY, overhang: DIM.roofOverhang };

/**
 * Local gable roof parts: ridge along Z at x=0. Returns geometries in local
 * space with absolute heights (ridge at y=ridgeY). The roof always projects
 * `overhang` beyond the eaves; along the ridge it is cut off flush at `len` so
 * it can be tucked into the façade walls without poking through them.
 */
function gableParts({ halfSpan, ridgeY, eaveY, len, overhang, thickness = 0.45 }) {
  const halfRun = halfSpan + overhang;
  const drop = ((ridgeY - eaveY) * halfRun) / halfSpan;
  const ang = Math.atan2(drop, halfRun);
  const slopeLen = Math.hypot(halfRun, drop);
  const eaveOutY = ridgeY - drop;
  const slabs = [];
  for (const s of [-1, 1]) {
    const g = new THREE.BoxGeometry(slopeLen, thickness, len);
    scaleUV(g, Math.max(1, slopeLen / 3.4), Math.max(1, len / 3.4));
    const cx = s * (halfRun / 2) + s * (thickness / 2) * (drop / slopeLen);
    const cy = ridgeY - drop / 2 + (thickness / 2) * (halfRun / slopeLen);
    xform(g, { rz: -s * ang, x: cx, y: cy });
    slabs.push(g);
  }
  // ridge cap
  const ridge = boxGeo(0.95, 0.55, len, 0, ridgeY + 0.16, 0);
  // eave fascias (double curvature fascia boards along both eaves)
  const fascias = [];
  for (const s of [-1, 1]) {
    fascias.push(boxGeo(0.5, 0.85, len, s * halfRun, eaveOutY - 0.28, 0));
  }
  return { slabs, ridge, fascias, halfRun, drop, ang, slopeLen, eaveOutY };
}

function placeAll(geos, { rotY = 0, x = 0, z = 0 } = {}) {
  for (const g of geos) {
    if (rotY) g.rotateY(rotY);
    g.translate(x, 0, z);
  }
  return geos;
}

export function buildRoofs(b, mats) {
  const crest = crestProto({ h: 1.75 });
  const pinn = simplePinnacleGeo({ base: 0.6, height: 3.6 });
  const r = rng(4242);

  // ------------------------------------------------------------------ nave
  const naveZ0 = -46.9;
  const naveZ1 = 46.2;
  const naveLen = naveZ1 - naveZ0;
  const nave = gableParts({
    halfSpan: NAVE.halfSpan,
    ridgeY: NAVE.ridgeY,
    eaveY: NAVE.eaveY,
    len: naveLen,
    overhang: NAVE.overhang,
  });
  placeAll([...nave.slabs], { z: (naveZ0 + naveZ1) / 2 });
  placeAll([nave.ridge, ...nave.fascias], { z: (naveZ0 + naveZ1) / 2 });
  for (const g of [...nave.slabs, nave.ridge, ...nave.fascias]) b.add('roof', g);
  // tile battens: thin raised courses across the slopes break up the plane
  for (const s of [-1, 1]) {
    for (let i = 1; i <= 9; i++) {
      const u = i / 10;
      const g = boxGeo(0.55, 0.17, naveLen - 1.4);
      xform(g, {
        rz: -s * nave.ang,
        x: s * nave.halfRun * u,
        y: NAVE.ridgeY - nave.drop * u + 0.07,
        z: (naveZ0 + naveZ1) / 2,
      });
      b.add('roofEdge', g);
    }
  }
  // verge boards along the nave gable ends
  for (const zEnd of [naveZ0 + 0.4, naveZ1 - 0.4]) {
    for (const s of [-1, 1]) {
      const g = boxGeo(nave.slopeLen - 0.7, 0.3, 0.55);
      xform(g, {
        rz: -s * nave.ang,
        x: (s * nave.halfRun) / 2,
        y: (NAVE.ridgeY + nave.eaveOutY) / 2 + 0.1,
        z: zEnd,
      });
      b.add('trim', g);
    }
  }
  // ridge crest, interrupted by the tower of Jesus
  for (let z = naveZ0 + 1.6; z < naveZ1 - 1.2; z += 2.1) {
    if (Math.abs(z) < 9.6) continue;
    b.instance(
      'crest',
      crest,
      mats.trim,
      matrixAt(0, NAVE.ridgeY + 0.34, z, { ry: rand(r, -0.18, 0.18), sy: rand(r, 0.9, 1.15) }),
      { castShadow: false }
    );
  }

  // -------------------------------------------------------------- transept
  const crossX0 = -30.8;
  const crossX1 = 30.8;
  const crossLen = crossX1 - crossX0;
  const cross = gableParts({
    halfSpan: CROSS.halfSpan,
    ridgeY: CROSS.ridgeY,
    eaveY: CROSS.eaveY,
    len: crossLen,
    overhang: CROSS.overhang,
  });
  for (const g of [...cross.slabs, cross.ridge, ...cross.fascias]) {
    g.rotateY(Math.PI / 2);
    b.add('roof', g);
  }
  // tile battens on the transept slopes
  for (const s of [-1, 1]) {
    for (let i = 1; i <= 9; i++) {
      const u = i / 10;
      const g = boxGeo(0.55, 0.17, crossLen - 1.4);
      xform(g, { rz: -s * cross.ang, x: s * cross.halfRun * u, y: CROSS.ridgeY - cross.drop * u + 0.07 });
      g.rotateY(Math.PI / 2);
      b.add('roofEdge', g);
    }
  }
  // verge boards along the transept gable ends
  for (const xEnd of [crossX0 + 0.4, crossX1 - 0.4]) {
    for (const s of [-1, 1]) {
      const g = boxGeo(cross.slopeLen - 0.7, 0.3, 0.55);
      xform(g, { rz: -s * cross.ang, x: (s * cross.halfRun) / 2, y: (CROSS.ridgeY + cross.eaveOutY) / 2 + 0.1 });
      g.rotateY(Math.PI / 2);
      g.translate(xEnd, 0, 0);
      b.add('trim', g);
    }
  }
  for (let x = crossX0 + 1.6; x < crossX1 - 1.2; x += 2.1) {
    if (Math.abs(x) < 9.6) continue;
    b.instance(
      'crest',
      crest,
      mats.trim,
      matrixAt(x, CROSS.ridgeY + 0.34, 0, { ry: Math.PI / 2 + rand(r, -0.18, 0.18), sy: rand(r, 0.9, 1.15) }),
      { castShadow: false }
    );
  }

  // ----------------------------------------------------- gable sealing walls
  // These sit just inside the façade planes and close the triangular gap
  // between the roof ends and the shell below. The apse end has no façade,
  // so its wall is a proper visible crossing gable.
  const gablePoints = (eaveHalf) => [
    [-eaveHalf, 41.8],
    [eaveHalf, 41.8],
    [eaveHalf, 44.8],
    [0, 51.3],
    [-eaveHalf, 44.8],
  ];
  const gableDepth = 1.1;
  const walls = [
    // north / apse end
    { p: gablePoints(16.0), ry: 0, x: 0, z: -45.55 },
    // south / Glory end (inside the Glory façade plane)
    { p: gablePoints(16.0), ry: 0, x: 0, z: 44.35 },
    // east / Nativity end
    { p: gablePoints(16.0), ry: Math.PI / 2, x: 29.3, z: 0 },
    // west / Passion end
    { p: gablePoints(16.0), ry: -Math.PI / 2, x: -29.3, z: 0 },
  ];
  for (const w of walls) {
    const g = shapeGeo(w.p, gableDepth);
    xform(g, { ry: w.ry, x: w.x, z: w.z });
    b.add('roofWall', g);
  }
  // blind oculus in each sealing gable (stone ring + dark glazing)
  const oculi = [
    { x: 0, z: -45.55, nx: 0, nz: -1 },
    { x: 0, z: 44.35, nx: 0, nz: 1 },
    { x: 29.3, z: 0, nx: 1, nz: 0 },
    { x: -29.3, z: 0, nx: -1, nz: 0 },
  ];
  const oculusRing = new THREE.TorusGeometry(1.8, 0.2, 6, 18);
  for (const o of oculi) {
    const ry = Math.atan2(o.nx, o.nz);
    const px = o.x + o.nx * (gableDepth / 2 + 0.06);
    const pz = o.z + o.nz * (gableDepth / 2 + 0.06);
    const ring = oculusRing.clone();
    xform(ring, { ry, x: px, y: 47.2, z: pz });
    b.add('trim', ring);
    const disc = new THREE.CircleGeometry(1.62, 20);
    xform(disc, { ry, x: px, y: 47.2, z: pz });
    b.add('glass', disc);
    // blind lancet panels flanking the oculus, so the gable is not a blank wall
    const tx = o.nz;
    const tz = -o.nx;
    for (const off of [-4.4, 4.4]) {
      const panel = boxGeo(0.9, 5.6, 0.2);
      xform(panel, {
        ry,
        x: o.x + tx * off + o.nx * (gableDepth / 2 + 0.03),
        y: 46.4,
        z: o.z + tz * off + o.nz * (gableDepth / 2 + 0.03),
      });
      b.add('trim', panel);
    }
  }

  // -------------------------------------------------------------- apse roof
  // Half-cone over the seven radial chapels (their walls stop at y=40). The
  // Virgin tower rises through it. The cone is kept below baseY (45) at the
  // tower's position so the tower is not swallowed by the roof.
  const apseCz = DIM.apseCenterZ;
  const apseProfile = [
    [22.9, 39.9],
    [19.0, 41.4],
    [14.0, 42.6],
    [8.0, 43.7],
    [0.2, 44.4],
  ].map(([rad, y]) => new THREE.Vector2(rad, y));
  const apseCone = new THREE.LatheGeometry(apseProfile, 34, Math.PI / 2, Math.PI);
  apseCone.translate(0, 0, apseCz);
  b.add('roofDouble', apseCone);
  // outer rim fascia
  const apseRim = new THREE.CylinderGeometry(
    DIM.apseOuterRadius + 0.4,
    DIM.apseOuterRadius + 0.4,
    2.1,
    36,
    1,
    true,
    Math.PI / 2,
    Math.PI
  );
  apseRim.translate(0, 38.85, apseCz);
  b.add('roofEdge', apseRim);
  // rim cornice band + pinnacle clusters around the apse rim
  const rimBand = new THREE.CylinderGeometry(
    DIM.apseOuterRadius + 0.75,
    DIM.apseOuterRadius + 0.75,
    0.4,
    36,
    1,
    true,
    Math.PI / 2,
    Math.PI
  );
  rimBand.translate(0, 39.95, apseCz);
  b.add('roofEdge', rimBand);
  const apsePinn = simplePinnacleGeo({ base: 0.7, height: 4.4 });
  for (let i = 0; i <= 12; i++) {
    const a = Math.PI / 2 + (i / 12) * Math.PI;
    const px = Math.sin(a) * (DIM.apseOuterRadius + 0.55);
    const pz = Math.cos(a) * (DIM.apseOuterRadius + 0.55) + apseCz;
    const m = matrixAt(px, 39.9, pz, { ry: a });
    b.instance('roofPinnacle', apsePinn, mats.trim, m, { castShadow: true });
  }

  // ------------------------------------------------------------- dormers
  // small gabled lucarnes on the nave slopes
  const dormerZ = [-36, -24, 24, 36];
  for (const z of dormerZ) {
    for (const s of [-1, 1]) {
      const x = s * 11.0;
      const roofY = NAVE.eaveY + ((NAVE.halfSpan - 11.0) / NAVE.halfSpan) * (NAVE.ridgeY - NAVE.eaveY);
      addDormer(b, mats, { x, y: roofY - 0.95, z, ry: s > 0 ? Math.PI / 2 : -Math.PI / 2 });
    }
  }
  // and on the transept slopes
  for (const x of [-21, 21]) {
    for (const s of [-1, 1]) {
      const z = s * 11.0;
      const roofY = CROSS.eaveY + ((CROSS.halfSpan - 11.0) / CROSS.halfSpan) * (CROSS.ridgeY - CROSS.eaveY);
      addDormer(b, mats, { x, y: roofY - 0.95, z, ry: s > 0 ? 0 : Math.PI });
    }
  }
  // two small stone ridge lanterns on the transept ridge
  for (const x of [-24, 24]) addRidgeLantern(b, mats, x, 0);

  // ------------------------------------------------------------ parapets
  addParapets(b, mats, pinn);

  // --------------------------------------------- ridge-end pinnacle clusters
  const endPinn = simplePinnacleGeo({ base: 0.85, height: 5.6 });
  for (const sx of [-1, 1]) {
    for (const off of [-1.1, 0, 1.1]) {
      b.instance(
        'roofPinnacleBig',
        endPinn,
        mats.trim,
        matrixAt(sx * 29.6, NAVE.ridgeY + 0.4, off, { ry: Math.PI / 4 }),
        { castShadow: true }
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Dormers
// ---------------------------------------------------------------------------

const DORMER_WIN = windowUnit({ w: 1.1, h: 1.35, band: 0.16, depth: 0.24, mullion: true });
const DORMER_FINIAL = mergeGeos([
  sphereGeo(0.15, 8, 0, 0.18, 0),
  coneGeo(0.09, 0.42, 4, 0, 0.5, 0),
]);

function addDormer(b, mats, { x, y, z, ry }) {
  const stone = [];
  // stone body, sunk into the slope
  stone.push(boxGeo(2.0, 2.0, 1.6, 0, 0.35, 0));
  // gable face
  stone.push(
    shapeGeo(
      [
        [-1.05, 0],
        [1.05, 0],
        [1.05, 1.15],
        [0, 1.72],
        [-1.05, 1.15],
      ],
      0.3
    ).translate(0, 1.3, 0.72)
  );
  // sill band
  stone.push(boxGeo(2.35, 0.18, 0.42, 0, 1.24, 0.78));
  for (const g of stone) xform(g, { ry, x, z });
  for (const g of stone) g.translate(0, y, 0);
  b.addAll('roofWall', stone);
  // little roof over the dormer
  for (const s of [-1, 1]) {
    const g = boxGeo(1.45, 0.14, 2.0);
    xform(g, { rz: -s * 0.6, x: s * 0.55, y: 3.2, z: 0 });
    xform(g, { ry, x, z });
    g.translate(0, y, 0);
    b.add('roof', g);
  }
  // window in the gable face
  const local = (lx, ly, lz) => ({
    x: x + lx * Math.cos(ry) + lz * Math.sin(ry),
    z: z - lx * Math.sin(ry) + lz * Math.cos(ry),
    y: y + ly,
  });
  const p = local(0, 1.42, 0.92);
  b.instance('winDormerStone', DORMER_WIN.stone, mats.trim, matrixAt(p.x, p.y, p.z, { ry }), {
    castShadow: false,
  });
  b.instance('winDormerGlass', DORMER_WIN.glass, mats.glass, matrixAt(p.x, p.y, p.z, { ry }));
  const f = local(0, 3.5, 0);
  b.instance('dormerFinial', DORMER_FINIAL, mats.trim, matrixAt(f.x, f.y, f.z, {}));
}

// ---------------------------------------------------------------------------
// Ridge lanterns
// ---------------------------------------------------------------------------

/** Small octagonal ridge lantern: stone drum, dark openings, tiled cap, gold ball. */
function addRidgeLantern(b, mats, x, z) {
  const y0 = DIM.roofRidgeY + 0.45;
  const oct = (rb, rt, h, y) => {
    const g = new THREE.CylinderGeometry(rt, rb, h, 8, 1, false);
    g.rotateY(-Math.PI / 8);
    g.translate(x, y + h / 2, z);
    const flat = g.toNonIndexed();
    flat.computeVertexNormals();
    return flat;
  };
  b.add('roofWall', oct(1.15, 1.05, 1.9, y0));
  b.add('trim', oct(1.35, 1.35, 0.22, y0 + 1.9));
  // dark openings on the four cardinal faces
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2;
    const faceR = 1.11 * Math.cos(Math.PI / 8);
    const g = boxGeo(0.62, 1.15, 0.12, x + Math.sin(a) * (faceR + 0.02), y0 + 0.95, z + Math.cos(a) * (faceR + 0.02), a);
    b.add('glass', g);
  }
  // tiled conical cap
  const cap = new THREE.ConeGeometry(1.5, 1.7, 8);
  cap.rotateY(-Math.PI / 8);
  cap.translate(x, y0 + 2.9, z);
  b.add('roofDouble', cap);
  // gold finial
  b.add('gold', sphereGeo(0.28, 8, x, y0 + 3.95, z));
  b.add('gold', coneGeo(0.1, 0.5, 4, x, y0 + 4.35, z));
}

// ---------------------------------------------------------------------------
// Parapets
// ---------------------------------------------------------------------------

function addParapets(b, mats, pinn) {
  const y0 = DIM.roofSpringY - 0.65; // embedded into the roof slab
  const h = 1.15;
  const t = 0.42;
  const addSeg = (axis, s, from, to) => {
    const len = to - from;
    if (len <= 0.5) return;
    const mid = (from + to) / 2;
    if (axis === 'x') {
      b.add('roofWall', boxGeo(t, h, len, s * 16.05, y0 + h / 2, mid));
      b.add('trimLight', boxGeo(t + 0.24, 0.16, len, s * 16.05, y0 + h + 0.08, mid));
    } else {
      b.add('roofWall', boxGeo(len, h, t, mid, y0 + h / 2, s * 16.05));
      b.add('trimLight', boxGeo(len, 0.16, t + 0.24, mid, y0 + h + 0.08, s * 16.05));
    }
    const n = Math.max(1, Math.round(len / 7.5));
    for (let i = 0; i <= n; i++) {
      const d = from + (i / n) * len;
      const px = axis === 'x' ? s * 16.05 : d;
      const pz = axis === 'x' ? d : s * 16.05;
      b.instance('roofPinnacle', pinn, mats.trim, matrixAt(px, y0 + h + 0.12, pz, { ry: Math.PI / 4 }), {
        castShadow: true,
      });
    }
  };
  // nave parapets, split at the transept
  for (const s of [-1, 1]) {
    addSeg('x', s, -46.6, -16.6);
    addSeg('x', s, 16.6, 46.0);
  }
  // transept parapets
  for (const s of [-1, 1]) {
    addSeg('z', s, -30.6, -16.6);
    addSeg('z', s, 16.6, 30.6);
  }
}
