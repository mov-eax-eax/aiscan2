/* The riser. This is the part the previous attempt got wrong: it was modelled
   as a stack of closed cross-sections, which can only ever produce a solid
   slab. Renders confirmed it - a plank with a plate bolted on. A modern
   machined riser is not a slab with decoration; the windows ARE the structure,
   and the metal between them is a lattice of bars.

   So this file never builds a closed solid. It builds:

     1. profiles  - where the metal is, as back/front edge offsets per height
     2. bars      - the horizontal band of metal between two stations
     3. windows   - whatever is left over, which is nothing at all

   Each bar is extruded with a barrelled cross-section whose depth depends on
   how far the surface sits from the spine, which is what gives a machined
   riser its soft bulge from the front and a crisp thin rim in profile.

   Reference: Wiawis ATF-X (refs/wiawis_atfx_1.png, refs/wiawis_atfx_2.png).
   Local units: mm. Riser spans y = -317.5 .. +317.5 (25 inches). */
import * as THREE from '../../vendor/three.module.js';
import { MAT } from './mats.js';
import { clamp, lerp, group, mesh, screw } from './prims.js';

export const RISER_H = 635;          /* 25 inch riser */
const H2 = RISER_H / 2;

/* ------------------------------------------------------------- profiles --- */

/* Station list: s = 0 at the bottom of the riser, 1 at the top.
   back  = edge on the archer's side (+X, where the string is)
   front = edge away from the archer (-X, where the stabiliser goes)
   spine = lateral centre of the metal, so the body can lean

   The sigmoid is the whole visual signature of a modern target riser: a long
   sight window carved in at the top, a deep waist at the grip, and the body
   flaring back out into both limb pockets. */
const STATIONS = [
  /* s      back   front  spine */
  [0.000,   45,   -48,   -4],
  [0.045,   52,   -54,   -4],
  [0.110,   48,   -51,   -3],
  [0.190,   46,   -50,   -3],
  [0.250,   42,   -45,   -2],
  [0.300,   36,   -40,   -2],
  [0.335,   29,   -31,   -1],
  [0.380,   21,   -23,    0],
  [0.440,   18,   -21,    0],
  [0.520,   18,   -21,    0],
  [0.580,   19,   -23,    0],
  [0.640,   22,   -27,    1],
  [0.700,   26,   -34,    1],
  [0.760,   30,   -42,    1],
  [0.800,   33,   -50,    1],
  [0.860,   31,   -55,    1],
  [0.910,   25,   -56,    1],
  [0.950,   20,   -57,    1],
  [1.000,   24,   -56,    0],
];

function sample(stations, col, s) {
  if (s <= stations[0][0]) return stations[0][col];
  const last = stations[stations.length - 1];
  if (s >= last[0]) return last[col];
  let i = 0;
  while (i < stations.length - 2 && stations[i + 1][0] < s) i++;
  const a = stations[i], b = stations[i + 1];
  let t = (s - a[0]) / (b[0] - a[0]);
  t = t * t * (3 - 2 * t);                       /* smoothstep: no kinks */
  return lerp(a[col], b[col], t);
}

export const yAt = (s) => -H2 + s * RISER_H;
export const backAt = (s) => sample(STATIONS, 1, s);
export const frontAt = (s) => sample(STATIONS, 2, s);
export const spineAt = (s) => sample(STATIONS, 3, s);

/* Cross-section depth in Z. The web near the spine is the deepest part; the
   rim stays thin and crisp. A box section does the opposite, and that is why
   slab risers look dead in profile. */
const DEPTH_RIM = 11.0;
const DEPTH_WEB = 21.0;
const depthAt = (rel) => {
  const k = clamp(Math.abs(rel), 0, 1);
  return DEPTH_WEB - (DEPTH_WEB - DEPTH_RIM) * Math.pow(k, 1.35);
};

function sectionAt(s) {
  const sp = spineAt(s);
  const b = backAt(s), f = frontAt(s);
  return { cx: sp + (b + f) / 2, hw: (b - f) / 2 };
}

/* --------------------------------------------------------------- bars ---- */

const BAR_T = 15;      /* nominal bar thickness, mm */

/* Each entry is a band of metal. Between consecutive bands there is nothing,
   and that absence is a window. */
const BARS = [
  [0.000, 0.275, 'rim'],     /* lower pocket block and the foot of the window */
  [0.275, 0.325, 'rib'],
  [0.325, 0.395, 'rib'],
  [0.395, 0.470, 'rib'],
  [0.470, 0.545, 'rib'],
  [0.545, 0.615, 'rib'],
  [0.615, 0.672, 'rib'],
  [0.672, 0.725, 'rib'],
  [0.725, 0.775, 'rib'],
  [0.775, 0.815, 'rib'],
  [0.815, 1.000, 'rim'],     /* upper pocket block and sight-window surround */
];

/* Vertical dividers inside the window field: [s0, s1, xFrac]. xFrac = 0 puts
   the divider hard against the front edge, 1 hard against the back edge.
   Alternating front/back is what makes the ATF-X read as a truss rather than
   a ladder. */
const DIVIDERS = [
  [0.285, 0.380, 0.60], [0.305, 0.420, 0.22],
  [0.405, 0.468, 0.70], [0.400, 0.525, 0.26],
  [0.500, 0.560, 0.76], [0.480, 0.605, 0.20],
  [0.560, 0.640, 0.32], [0.600, 0.700, 0.72],
  [0.680, 0.760, 0.24],
];

/* ------------------------------------------------------------ extrusion -- */

function buildBar(s0, s1, kind, { name }) {
  const STEPS = 12;
  const pos = [], idx = [];
  const rows = [];
  const edgeCut = kind === 'rim' ? 3.0 : 5.0;

  for (let i = 0; i <= STEPS; i++) {
    const s = lerp(s0, s1, i / STEPS);
    const { cx, hw } = sectionAt(s);
    const y = yAt(s);
    const dOut = depthAt(hw);
    const c = clamp(edgeCut, 0, hw * 0.35);
    const backX = cx + hw - c, frontX = cx - hw + c;
    rows.push([
      [backX, y, +dOut], [backX, y, -dOut],
      [frontX, y, -dOut], [frontX, y, +dOut],
    ]);
  }

  /* four corner rails: the thin rim seen edge-on in a side view */
  for (const [a, b] of [[0, 1], [1, 2], [2, 3], [3, 0]]) {
    const base = pos.length / 3;
    for (let i = 0; i < rows.length; i++) {
      const p = rows[i][a], q = rows[i][b];
      pos.push(p[0], p[1], p[2], q[0], q[1], q[2]);
    }
    for (let i = 0; i < rows.length - 1; i++) {
      const A = base + i * 2, B = A + 1, C = A + 2, D = A + 3;
      idx.push(A, C, B, B, C, D);
    }
  }

  /* the two bearing faces of the bar - the walls of the windows */
  for (const xi of [0, 2]) {
    const base = pos.length / 3;
    for (let i = 0; i < rows.length; i++) {
      const p = rows[i][xi];
      pos.push(p[0], p[1], p[2], p[0], p[1], p[2]);
    }
    for (let i = 0; i < rows.length - 1; i++) {
      const A = base + i * 2, B = A + 1, C = A + 2, D = A + 3;
      idx.push(A, C, B, B, C, D);
    }
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return mesh(g, MAT.riserOuter, name);
}

/* A vertical divider: a short bar leaning to follow the flare of the body. */
function buildDivider(s0, s1, xFrac, { name }) {
  const a = sectionAt(s0), b = sectionAt(s1);
  const x0 = a.cx - a.hw + xFrac * 2 * a.hw;
  const x1 = b.cx - b.hw + xFrac * 2 * b.hw;
  const y0 = yAt(s0), y1 = yAt(s1);
  const h = Math.abs(y1 - y0);
  const lean = Math.atan2(x1 - x0, y1 - y0);
  const g = new THREE.BoxGeometry(11.0, h + BAR_T, 16.5);
  g.rotateZ(-lean);
  g.translate((x0 + x1) / 2, (y0 + y1) / 2, 0);
  return mesh(g, MAT.riserOuter, name);
}

/* ------------------------------------------------------------- assembly -- */

export function buildRiser() {
  const g = group('riser');

  const body = group('riser-body');
  BARS.forEach(([s0, s1, kind], i) =>
    body.add(buildBar(s0, s1, kind, { name: `riser-${kind}-${i}` })));
  DIVIDERS.forEach(([s0, s1, xf], i) =>
    body.add(buildDivider(s0, s1, xf, { name: `riser-divider-${i}` })));
  g.add(body);

  /* ---- limb pockets: the fittings the limbs bolt into ---- */
  for (const [sign, tag] of [[1, 'upper'], [-1, 'lower']]) {
    const { cx } = sectionAt(sign > 0 ? 1.0 : 0.0);
    const y = sign * (H2 - 4);
    const p = mesh(new THREE.BoxGeometry(76, 44, 30), MAT.black, `riser-pocket-${tag}`);
    p.position.set(cx, y - sign * 12, 0);
    g.add(p);
    /* ILF dovetail: two jaws with a gap, so the limb butt reads as captured */
    for (const zs of [-1, 1]) {
      const jaw = mesh(new THREE.BoxGeometry(76, 34, 7.5), MAT.black,
        `riser-pocket-${tag}-jaw-${zs > 0 ? 'f' : 'n'}`);
      jaw.position.set(cx, y - sign * 18, zs * 9.5);
      g.add(jaw);
    }
    const tb = mesh(new THREE.CylinderGeometry(5.2, 5.2, 30, 16), MAT.steel, `riser-tillerbolt-${tag}`);
    tb.position.set(cx + 27, y - sign * 22, 0);
    g.add(tb);
  }

  /* ---- stabiliser bushings on the front face ---- */
  const bush = (s, name, r = 8.5) => {
    const { cx, hw } = sectionAt(s);
    const b = mesh(new THREE.CylinderGeometry(r, r, 13, 20), MAT.black, name);
    b.rotation.z = Math.PI / 2;
    b.position.set(cx - hw - 2, yAt(s), 0);
    return b;
  };
  g.add(bush(0.62, 'riser-bushing-main'));
  g.add(bush(0.44, 'riser-bushing-lower', 7.5));
  g.add(bush(0.30, 'riser-bushing-low', 6.5));

  /* ---- sight rail: the dovetail bar the sight block clamps onto ---- */
  const sw = sectionAt(0.86);
  const rail = mesh(new THREE.BoxGeometry(10, 200, 20), MAT.black, 'riser-sight-rail');
  rail.position.set(sw.cx + sw.hw - 5, yAt(0.86) - 10, 0);
  g.add(rail);

  /* ---- grip: a sculpted pinch in the body, not a plate bolted on ---- */
  const gs = new THREE.Shape();
  gs.moveTo(-14, -80);
  gs.bezierCurveTo(-28, -52, -31, -18, -25, 12);
  gs.bezierCurveTo(-21, 34, -17, 50, -11, 64);
  gs.lineTo(9, 60);
  gs.bezierCurveTo(5, 42, 3, 20, 3, 0);
  gs.bezierCurveTo(3, -22, 7, -52, 15, -78);
  gs.closePath();
  const gripGeo = new THREE.ExtrudeGeometry(gs, {
    depth: 34, bevelEnabled: true, bevelThickness: 5, bevelSize: 4.5,
    bevelSegments: 3, curveSegments: 12,
  });
  gripGeo.translate(0, 0, -17);
  const grip = mesh(gripGeo, MAT.black, 'riser-grip');
  grip.position.set(-3, -40, 0);
  g.add(grip);

  for (const zs of [-1, 1]) {
    const plate = mesh(new THREE.BoxGeometry(44, 94, 5), MAT.limbEdge,
      `riser-gripside-${zs > 0 ? 'f' : 'n'}`);
    plate.position.set(-5, -40, zs * 20.5);
    g.add(plate);
  }
  for (const zs of [-1, 1]) {
    for (const yo of [-24, 24]) {
      const sc = mesh(screw(2.4, 4), MAT.steel, `riser-gripscrew-${zs > 0 ? 'f' : 'n'}-${yo > 0 ? 'u' : 'l'}`);
      sc.position.set(-5, -40 + yo, zs * 23.4);
      g.add(sc);
    }
  }

  /* ---- arrow shelf ---- */
  const shelf = mesh(new THREE.BoxGeometry(32, 9, 26), MAT.black, 'riser-shelf');
  shelf.position.set(7, -7, 0);
  g.add(shelf);

  /* ---- clicker plate and plunger boss ---- */
  const cp = mesh(new THREE.BoxGeometry(6, 58, 22), MAT.black, 'riser-clickerplate');
  cp.position.set(backAt(0.60) + 3, yAt(0.60) + 2, 0);
  g.add(cp);

  const pg = sectionAt(0.575);
  const boss = mesh(new THREE.CylinderGeometry(6.5, 6.5, 16, 16), MAT.black, 'riser-plungerboss');
  boss.rotation.z = Math.PI / 2;
  boss.position.set(pg.cx + pg.hw - 4, yAt(0.575), 0);
  g.add(boss);

  return g;
}
