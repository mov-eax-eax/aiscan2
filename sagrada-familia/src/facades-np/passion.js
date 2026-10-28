// Passion façade (west transept end wall, x = -31.6..-30, z = -24..24).
//
// Josep Maria Subirachs' stern, angular counterpoint to the Nativity: stripped
// stone planes, hard shadows, hollow-eyed figures. Via Crucis scenes, a great
// circular oculus with radiating stone rays, inscriptions and angular pinnacles.
//
// Local coordinates (u, y, w): u along the wall, y up, w outward. The parent
// group sits at x = -30.8, rotated -90° about Y, so world = (-30.8 - w, y, u).

import * as K from './kit.js';
import { DIM, PALETTE } from '../config.js';
import { boxCollider, circleCollider, hotspot } from '../lib.js';

const WALL_W = DIM.facadeHalfWidth * 2;
const WALL_TOP = 45;
const WALL_D = 1.6;
const FACE = 0.8;
const X0 = -30.8; // world x of the wall centre plane
const WX = (w) => X0 - w; // local w -> world x on this façade

const GLASS = [0x2f5fa8, 0x8f9ea8, 0x3e8c7b, 0xe0a13a, 0x59636b, 0x2b7f9e, 0xb0472e];

const DOORS = DIM.doors.passion.map((d) => ({
  id: d.id,
  u: d.coord, // local u = worldZ on this façade
  w: d.w,
  h: d.h,
  spring: 0.6,
  pinch: 0.72,
  central: d.w > 7,
}));

const ringSpec = (d) =>
  d.central
    ? { count: 3, band: 0.6, step: 0.48, depth: 0.52 }
    : { count: 3, band: 0.46, step: 0.4, depth: 0.46 };

const outerFrontOf = (d) => {
  const s = ringSpec(d);
  return FACE + (s.count - 1) * s.step + s.depth;
};

// ---------------------------------------------------------------------------
// Portal
// ---------------------------------------------------------------------------

function buildPortal(B, r, d, colliders) {
  const spec = ringSpec(d);
  const { u, w: dw, h: dh, spring, pinch } = d;

  B.reveal.push(K.revealLiningGeo(dw, dh, { spring, pinch, band: 0.14, depth: 1.62 }));

  // inner face: a plain heavy frame so the door reads from inside the transept
  const innerRing = K.archRingG({
    w: dw - 0.08,
    h: dh - 0.08,
    band: 0.4,
    depth: 0.34,
    spring,
    pinch,
    baseExtend: 0.4,
  });
  innerRing.translate(u, 0, -0.94);
  B.stoneDark.push(innerRing);
  B.flatDark.push(K.boxGeo(dw + 0.9, 0.22, 0.4, u, 0.11, -1.0));

  // threshold: a hard step
  B.stoneDark.push(K.boxGeo(dw + 0.2, 0.16, 1.9, u, 0.08, 0.05));
  B.reveal.push(K.boxGeo(dw - 0.4, 0.04, 1.6, u, 0.17, 0.12));

  // angular tympanum high in the porch
  buildTympanum(B, r, d);

  // stepped angular arch orders
  let iw = dw;
  let ih = dh;
  for (let i = 0; i < spec.count; i++) {
    const front = FACE + i * spec.step + spec.depth;
    const ring = K.archRingG({
      w: iw,
      h: ih,
      band: spec.band,
      depth: spec.depth,
      spring,
      pinch,
      baseExtend: 1.0,
      curveSegments: 4,
    });
    ring.translate(u, 0, front - spec.depth / 2);
    const tint = ['stone', 'flatDark', 'stoneLight'][i % 3];
    B[tint].push(ring);

    // hard forward lip
    const lip = K.archRingG({
      w: iw + 0.02,
      h: ih + 0.02,
      band: spec.band * 0.2,
      depth: 0.16,
      spring,
      pinch,
      baseExtend: 1.0,
      curveSegments: 4,
    });
    lip.translate(u, 0, front + 0.04);
    B.stoneLight.push(lip);

    // square block jambs marking the orders (Subirachs' angular rhythm)
    if (i < spec.count - 1) {
      for (const sgn of [-1, 1]) {
        const ju = u + sgn * (iw / 2 + spec.band * 0.52);
        B.flat.push(K.boxGeo(spec.band * 0.86, dh * spring * 0.94, spec.depth * 0.72, ju, (dh * spring * 0.94) / 2, front - spec.depth / 2));
      }
    }
    iw += spec.band * 2;
    ih += spec.band;
  }

  // heavy angular hood over the outermost order
  const outerFront = outerFrontOf(d);
  const hood = K.archRingG({
    w: iw - spec.band * 2 + 0.06,
    h: ih - spec.band + 0.04,
    band: 0.34,
    depth: 0.26,
    spring,
    pinch,
    baseExtend: 1.0,
    curveSegments: 4,
  });
  hood.translate(u, 0, outerFront + 0.25);
  B.flatDark.push(hood);

  // flanking pilasters
  const pilU = dw / 2 + (d.central ? 1.6 : 1.45);
  const pilH = d.central ? 44 : 30;
  for (const sgn of [-1, 1]) {
    const pu = u + sgn * pilU;
    B.flat.push(K.boxGeo(1.2, pilH, 1.15, pu, pilH / 2, FACE + 0.55));
    // vertical grooves
    for (const g of [-0.34, 0, 0.34]) {
      B.flatDark.push(K.boxGeo(0.11, pilH - 1.6, 0.08, pu + g, pilH / 2, FACE + 1.14));
    }
    // capital: stepped blocks
    B.flatLight.push(K.boxGeo(1.55, 0.32, 1.4, pu, pilH + 0.1, FACE + 0.62));
    B.flat.push(K.boxGeo(1.35, 0.5, 1.2, pu, pilH + 0.5, FACE + 0.58));
    B.flatDark.push(K.boxGeo(1.7, 0.2, 1.5, pu, pilH + 0.82, FACE + 0.64));
    // base
    B.flatDark.push(K.boxGeo(1.6, 0.5, 1.4, pu, 0.25, FACE + 0.6));
    colliders.push(circleCollider(WX(FACE + 0.6), u + sgn * pilU, 0.78, { y0: 0, y1: 3.4 }));
  }
}

// ---------------------------------------------------------------------------
// Angular tympanum (dark panel deep inside the porch)
// ---------------------------------------------------------------------------

function buildTympanum(B, r, d) {
  const { u, w: dw, h: dh, spring } = d;
  const baseY = d.central ? 14.0 : 9.6;
  const panelH = dh - baseY + 4.0;
  B.reveal.push(K.archPanelGeo(dw - 0.24, panelH, 0.5, { x: u, y: baseY, z: -0.2, spring }));
  // ledge
  B.flatLight.push(K.boxGeo(dw + 0.1, 0.36, 0.75, u, baseY + 0.1, 0.16));
  B.flatDark.push(K.boxGeo(dw + 0.02, 0.12, 0.5, u, baseY - 0.06, 0.2));

  if (d.central) {
    // a stark angular crucifix and two witnesses
    const cross = K.mergeGeos([
      K.boxGeo(0.24, 3.2, 0.24, 0, 1.6, 0),
      K.boxGeo(1.6, 0.24, 0.24, 0, 2.2, 0),
      K.boxGeo(0.5, 0.18, 0.3, 0, 0.1, 0.02, Math.PI / 4),
    ]);
    cross.translate(u, baseY + 0.35, 0.32);
    B.flatLight.push(cross);
    for (const sgn of [-1, 1]) {
      B.flat.push(
        K.xform(K.angularFigure({ height: 1.55, pose: 'pray', seed: 300 + sgn }), {
          ry: -sgn * 0.4,
          x: u + sgn * 2.3,
          y: baseY + 0.28,
          z: 0.34,
        })
      );
    }
    B.texts.push({
      text: 'ECCE HOMO',
      u,
      y: baseY + 4.0,
      w: 0.28,
      size: 2.1,
      maxH: 0.65,
      color: '#cfc8ba',
      letterSpacing: 4,
    });
  } else {
    // one angular figure and an empty frame, like a station of the cross
    B.flat.push(
      K.xform(K.angularFigure({ height: 1.75, pose: 'hold', seed: 320 + Math.round(u) }), {
        ry: Math.sign(u) * 0.3,
        x: u,
        y: baseY + 0.28,
        z: 0.34,
      })
    );
    B.flatDark.push(K.boxGeo(1.9, 0.16, 0.18, u, baseY + 2.4, 0.3));
    B.flatDark.push(K.boxGeo(0.16, 1.5, 0.18, u - 0.9, baseY + 1.75, 0.3));
    B.flatDark.push(K.boxGeo(0.16, 1.5, 0.18, u + 0.9, baseY + 1.75, 0.3));
  }
}

// ---------------------------------------------------------------------------
// Angular canopy above a side portal
// ---------------------------------------------------------------------------

function buildSideCanopy(B, r, d) {
  const { u } = d;
  const y = 15.05;
  B.flat.push(K.boxGeo(9.0, 0.5, 1.05, u, y, FACE + 0.52));
  B.stoneLight.push(K.boxGeo(8.6, 0.18, 0.7, u, y + 0.34, FACE + 0.42));
  // angular brackets wedged between the wall and the canopy
  for (let i = 0; i < 4; i++) {
    const su = u - 3.3 + i * 2.2;
    B.flatDark.push(K.boxGeo(0.28, 0.8, 1.0, su, y - 0.55, FACE + 0.5));
    B.flatDark.push(
      K.xform(new K.THREE.ConeGeometry(0.2, 0.72, 4), { ry: Math.PI / 4, x: su, y: y - 0.95, z: FACE + 0.35 })
    );
  }
  // shadow slit above the portal arch
  B.reveal.push(K.boxGeo(8.4, 0.12, 0.08, u, y - 0.28, FACE + 0.04));
}

// ---------------------------------------------------------------------------
// Angular niche with a single Subirachs-style figure
// ---------------------------------------------------------------------------

function addAngularNiche(B, { u, y, w, width = 1.8, height = 3.2, seed = 1 }) {
  const r = K.rng(seed);
  B.reveal.push(K.boxGeo(width - 0.36, height - 0.34, 0.18, u, y + height / 2, w + 0.11));
  B.flat.push(K.boxGeo(width, 0.32, 0.55, u, y + height - 0.16, w + 0.3));
  B.flat.push(K.boxGeo(width, 0.28, 0.5, u, y + 0.14, w + 0.28));
  B.flat.push(K.boxGeo(0.3, height, 0.5, u - width / 2 + 0.15, y + height / 2, w + 0.28));
  B.flat.push(K.boxGeo(0.3, height, 0.5, u + width / 2 - 0.15, y + height / 2, w + 0.28));
  B.flatDark.push(K.boxGeo(width - 0.32, 0.18, 0.45, u, y + 0.3, w + 0.3));
  const g = K.angularFigure({
    height: height * 0.66,
    pose: K.pick(r, ['stand', 'cross', 'pray', 'hold']),
    hood: K.chance(r, 0.5),
    seed,
  });
  K.xform(g, { ry: seed % 2 ? -0.24 : 0.24, x: u, y: y + 0.44, z: w + 0.46 });
  B.flatLight.push(g);
}

// ---------------------------------------------------------------------------
// The great oculus
// ---------------------------------------------------------------------------

function buildOculus(B, r) {
  const ocR = DIM.roseWindows.passion.r; // 6
  const ocY = DIM.roseWindows.passion.y; // 30

  B.reveal.push(K.discGeo(ocR + 0.25, 0.18, 48).translate(0, ocY, FACE + 0.07));

  // a full rose of coloured glass, ringed by Subirachs' angular stone crown
  const oc = K.roseWindowParts({ radius: ocR, colors: GLASS, seed: 471, petals: 20 });
  K.brightenColors(oc.glass, 1.5);
  K.xform(oc.stone, { x: 0, y: ocY, z: FACE + 0.14 });
  B.stoneLight.push(oc.stone);
  K.xform(oc.glass, { x: 0, y: ocY, z: FACE + 0.27 });
  B.glass.push({ geo: oc.glass, colored: true });

  // stone tracery / leadwork laid over the glass so it reads rich, not flat
  for (const rr of [ocR * 0.42, ocR * 0.72]) {
    const ring = K.circleRingGeo(rr + 0.07, rr - 0.07, 0.12, 48);
    ring.translate(0, ocY, FACE + 0.44);
    B.stoneLight.push(ring);
  }
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 + 0.26;
    const bar = K.boxGeo(ocR * 0.9, 0.085, 0.1);
    K.xform(bar, { rz: a, x: Math.cos(a) * ocR * 0.45, y: ocY + Math.sin(a) * ocR * 0.45, z: FACE + 0.44 });
    B.stoneLight.push(bar);
  }
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    const rr = ocR * 0.575;
    B.stoneDark.push(K.sphereGeo(0.085, 6, Math.cos(a) * rr, ocY + Math.sin(a) * rr, FACE + 0.48));
  }

  // angular crown: two rings of wedge blocks + long rays
  K.addRadialWedges(B, 'flatLight', {
    u: 0,
    y: ocY,
    w: FACE + 0.575,
    r0: ocR + 0.12,
    r1: ocR + 1.5,
    count: 18,
    width: 0.78,
    depth: 1.15,
    phase: 0,
    seed: 480,
    jitter: 0.22,
  });
  K.addRadialWedges(B, 'flatDark', {
    u: 0,
    y: ocY,
    w: FACE + 0.72,
    r0: ocR + 1.45,
    r1: ocR + 2.55,
    count: 14,
    width: 0.95,
    depth: 1.45,
    phase: 0.22,
    seed: 481,
    jitter: 0.18,
  });
  // long rays
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 + 0.13;
    const len = 0.9 + (i % 3) * 0.28;
    const g = K.boxGeo(len, 0.26, 0.7);
    K.xform(g, {
      rz: a,
      x: Math.cos(a) * (ocR + 2.5 + len / 2),
      y: ocY + Math.sin(a) * (ocR + 2.5 + len / 2),
      z: FACE + 1.35,
    });
    B.flatLight.push(g);
  }
  // shadow ring behind the rays
  void 0;

  // hard projecting cornice beneath the oculus crown
  B.flat.push(K.boxGeo(13.4, 0.5, 0.9, 0, 22.2, FACE + 0.47));
  B.flatLight.push(K.boxGeo(12.9, 0.16, 0.6, 0, 22.5, FACE + 0.4));
  B.flatDark.push(K.boxGeo(13.6, 0.14, 0.5, 0, 21.95, FACE + 0.48));

  // inscription above (clear of the crown)
  B.texts.push({
    text: 'VELUM TEMPLI SCISSUM EST',
    u: 0,
    y: ocY + 9.35,
    w: FACE + 0.04,
    size: 10,
    maxH: 0.85,
    color: '#3c3a35',
    letterSpacing: 3,
  });
}

// ---------------------------------------------------------------------------
// Scene kit (Via Crucis)
// ---------------------------------------------------------------------------

function angularCrucifix(B, { u, y, w, h = 3.4, key = 'flatLight' }) {
  const g = K.mergeGeos([
    K.boxGeo(0.22, h, 0.22, 0, h / 2, 0),
    K.boxGeo(h * 0.5, 0.22, 0.22, 0, h * 0.7, 0),
  ]);
  g.translate(u, y, w);
  B[key].push(g);
}

function addScene(B, r, { u, y, width, height, kind, seed }) {
  const frame = K.addSceneFrame(B, { u, y, w: FACE, width, height, depth: 0.82, key: 'stone' });
  const fy = frame.floorY;
  const cw = FACE + 0.5;

  if (kind === 'flagellation') {
    // the column and the bound Christ
    B.flatLight.push(K.cylGeo(0.2, 0.28, 2.1, 4, u + 0.75, fy + 1.05, cw + 0.1));
    B.flatDark.push(K.boxGeo(0.7, 0.2, 0.7, u + 0.75, fy + 0.1, cw + 0.1));
    B.flat.push(
      K.xform(K.angularFigure({ height: 2.1, pose: 'cross', seed }), { ry: 0.45, x: u - 0.5, y: fy, z: cw + 0.15 })
    );
    B.flatLight.push(
      K.xform(K.angularFigure({ height: 2.0, pose: 'stand', helmet: true, spear: true, seed: seed + 1 }), {
        ry: -0.4,
        x: u + 1.85,
        y: fy,
        z: cw + 0.2,
      })
    );
  } else if (kind === 'crown') {
    B.flat.push(
      K.xform(K.angularFigure({ height: 2.35, pose: 'kneel', seed }), { ry: -0.25, x: u - 0.2, y: fy, z: cw + 0.15 })
    );
    K.addThornCrown(B, { u: u - 0.2, y: fy + 1.5, w: cw + 0.25, radius: 0.6, seed: seed + 2 });
    for (const sgn of [-1, 1]) {
      B.flatLight.push(
        K.xform(K.angularFigure({ height: 2.0, pose: 'stand', helmet: true, spear: sgn > 0, seed: seed + 10 + sgn }), {
          ry: -sgn * 0.35,
          x: u + sgn * 1.75,
          y: fy,
          z: cw + 0.2,
        })
      );
    }
  } else if (kind === 'denial') {
    B.flat.push(
      K.xform(K.angularFigure({ height: 2.1, pose: 'stand', seed }), { ry: 0.3, x: u - 0.75, y: fy, z: cw + 0.1 })
    );
    B.flatLight.push(
      K.xform(K.angularFigure({ height: 1.85, pose: 'hold', hood: true, seed: seed + 1 }), {
        ry: -0.35,
        x: u + 0.95,
        y: fy,
        z: cw + 0.15,
      })
    );
    B.stoneDark.push(K.boxGeo(0.7, 0.55, 0.6, u + 1.9, fy + 0.27, cw + 0.1));
    K.addRooster(B, { u: u + 1.9, y: fy + 0.55, w: cw + 0.12, s: 0.8, seed: seed + 3 });
  } else if (kind === 'veil') {
    K.addVeilRelief(B, { u: u + 0.85, y: fy, w: cw - 0.1, width: 2.5, height: 3.5 });
    B.flat.push(
      K.xform(K.angularFigure({ height: 2.05, pose: 'hold', seed }), { ry: 0.35, x: u - 1.25, y: fy, z: cw + 0.15 })
    );
    B.flatLight.push(
      K.xform(K.angularFigure({ height: 2.05, pose: 'stand', helmet: true, spear: true, seed: seed + 1 }), {
        ry: -0.3,
        x: u + 2.35,
        y: fy,
        z: cw + 0.2,
      })
    );
  } else if (kind === 'resurrection') {
    // the empty tomb slab and the rising figure
    B.flatDark.push(K.boxGeo(width * 0.55, 0.55, 1.1, u - width * 0.18, fy + 0.27, cw + 0.2));
    B.reveal.push(K.boxGeo(width * 0.36, 0.36, 0.4, u - width * 0.18, fy + 0.36, cw + 0.5));
    B.flat.push(
      K.xform(K.angularFigure({ height: 2.5, pose: 'armsUp', seed }), { ry: 0.1, x: u + width * 0.18, y: fy, z: cw + 0.2 })
    );
    for (const sgn of [-1, 1]) {
      B.flatLight.push(
        K.xform(K.angularFigure({ height: 1.5, pose: 'kneel', seed: seed + 4 + sgn }), {
          ry: sgn * 0.3,
          x: u + width * 0.18 + sgn * 1.35,
          y: fy,
          z: cw + 0.5,
        })
      );
    }
  } else if (kind === 'soldiers') {
    for (const sgn of [-1, 1]) {
      B.flatLight.push(
        K.xform(K.angularFigure({ height: 1.95, pose: 'stand', helmet: true, spear: true, seed: seed + sgn }), {
          ry: -sgn * 0.25,
          x: u + sgn * 1.05,
          y: fy,
          z: cw + 0.2,
        })
      );
    }
    angularCrucifix(B, { u, y: fy, w: cw + 0.35, h: 3.0, key: 'flatDark' });
  }
}

// ---------------------------------------------------------------------------
// Empty tomb at ground level
// ---------------------------------------------------------------------------

function buildEmptyTomb(B, r, colliders) {
  const u = 18.5;
  const w0 = FACE + 0.1;
  B.stoneLight.push(K.boxGeo(3.4, 0.32, 2.2, u, 0.16, w0 + 0.9));
  B.flat.push(K.boxGeo(2.6, 1.25, 1.6, u, 0.94, w0 + 0.85));
  B.flatLight.push(K.boxGeo(2.9, 0.22, 1.85, u, 1.62, w0 + 0.85));
  // dark rectangular mouth
  B.reveal.push(K.boxGeo(1.5, 0.9, 0.14, u - 0.1, 0.9, w0 + 1.68));
  // rolled stone
  const rolled = new K.THREE.CylinderGeometry(0.78, 0.78, 0.5, 12);
  rolled.rotateX(Math.PI / 2);
  rolled.rotateY(Math.PI / 2);
  rolled.translate(u - 1.5, 0.82, w0 + 1.75);
  B.flatLight.push(rolled);
  B.flatDark.push(K.cylGeo(0.3, 0.36, 0.2, 8, u - 1.5, 0.2, w0 + 1.75));
  // two angular witnesses
  B.flat.push(K.xform(K.angularFigure({ height: 1.9, pose: 'pray', seed: 610 }), { ry: -0.5, x: u + 1.3, y: 0.32, z: w0 + 1.2 }));
  B.flatLight.push(
    K.xform(K.angularFigure({ height: 1.7, pose: 'kneel', hood: true, seed: 611 }), { ry: 0.4, x: u + 2.4, y: 0.32, z: w0 + 1.1 })
  );
  B.flatDark.push(K.boxGeo(0.5, 0.6, 0.35, u + 3.0, 0.62, w0 + 1.0));
  colliders.push(boxCollider(WX(1.8), u, 1.25, 1.35, { y0: 0, y1: 2.2 }));
  colliders.push(circleCollider(WX(2.0), u + 1.4, 0.7, { y0: 0, y1: 2.4 }));
  colliders.push(circleCollider(WX(2.0), u + 2.5, 0.6, { y0: 0, y1: 2.2 }));
}

// ---------------------------------------------------------------------------
// Pilasters, ribs, upper fields
// ---------------------------------------------------------------------------

function buildFields(B, r, colliders) {
  const THREEW = K.THREE;
  // outer pilasters
  for (const pu of [-16.7, 16.7]) {
    B.flat.push(K.boxGeo(1.0, 30, 0.9, pu, 15, FACE + 0.45));
    B.flatDark.push(K.boxGeo(1.2, 0.24, 1.0, pu, 30.1, FACE + 0.5));
    B.flatLight.push(K.boxGeo(1.3, 0.42, 1.1, pu, 30.5, FACE + 0.52));
  }
  // upper pilasters
  for (const pu of [-15, 15]) {
    B.flat.push(K.boxGeo(0.9, 12.2, 0.75, pu, 38.0, FACE + 0.38));
    B.flatDark.push(K.boxGeo(1.1, 0.3, 0.9, pu, 44.3, FACE + 0.44));
  }
  // thin vertical ribs of stripped stone
  for (const [ru, y0, y1, n] of [
    [-20.8, 0, 20, 3],
    [20.8, 0, 20, 3],
    [-9.3, 0, 17, 2],
    [9.3, 0, 17, 2],
    [-20.6, 34, 43, 2],
    [20.6, 34, 43, 2],
  ]) {
    for (let i = 0; i < n; i++) {
      const uu = ru + (i - (n - 1) / 2) * 0.42;
      B.flatLight.push(K.boxGeo(0.12, y1 - y0, 0.16, uu, (y0 + y1) / 2, FACE + 0.12));
      B.stoneDark.push(K.boxGeo(0.22, y1 - y0, 0.1, uu + 0.2, (y0 + y1) / 2, FACE + 0.14));
    }
  }

  // hollow planes: slotted angular screens, flush with the wall
  K.addScreenedFin(B, 'flat', { u: -19.9, y: 21.5, w: FACE + 0.01, width: 3.0, height: 12, depth: 0.3, slots: 3, seed: 2 });
  K.addScreenedFin(B, 'flat', { u: 19.9, y: 21.5, w: FACE + 0.01, width: 3.0, height: 12, depth: 0.3, slots: 3, seed: 5 });

  // stripped vertical blades — the façade as sheer planes, not a Gothic wall
  for (const sgn of [-1, 1]) {
    K.addBlade(B, 'flat', { u: sgn * 7.7, y: 0, w: FACE, width: 0.9, height: 44, depth: 1.1 });
    colliders.push(boxCollider(WX(FACE + 0.55), sgn * 7.7, 0.55, 0.45, { y0: 0, y1: 44 }));
    K.addBlade(B, 'flatDark', { u: sgn * 9.0, y: 16.2, w: FACE, width: 1.15, height: 27, depth: 0.95 });
    B.reveal.push(K.boxGeo(0.26, 41, 0.12, sgn * 8.3, 20.5, FACE + 0.05));
    // deep angular hollows high on the flanks
    K.addHollowRecess(B, { u: sgn * 11.0, y: 33.8, w: FACE, width: 2.2, height: 5.2 });
    // severe angular figures in shallow frames above the outer pilasters
    addAngularNiche(B, { u: sgn * 17.6, y: 31.6, w: FACE, width: 1.8, height: 3.6, seed: 2700 + sgn });
    // lower figure niche and an upper blade filling the outer bay
    addAngularNiche(B, { u: sgn * 17.9, y: 18.2, w: FACE, width: 1.6, height: 3.4, seed: 2900 + sgn });
    K.addBlade(B, 'flat', { u: sgn * 17.5, y: 34.5, w: FACE, width: 0.8, height: 8.5, depth: 0.7 });
    // inscriptions of the Via Crucis on the wall
    B.texts.push({
      text: sgn > 0 ? 'STABAT MATER DOLOROSA' : 'VIA DOLOROSA',
      u: sgn * 12.5,
      y: 26.8,
      w: FACE + 0.04,
      size: 4.6,
      maxH: 0.46,
      color: '#2f3338',
      letterSpacing: 2,
    });
  }

  // stark wedge "clouds" near the top, keyed into the wall
  for (let i = 0; i < 10; i++) {
    const su = (i % 2 === 0 ? -1 : 1) * K.rand(r, 7.0, 12.5);
    const sy = K.rand(r, 41.2, 43.8);
    const depth = K.rand(r, 0.5, 1.2);
    const g = K.boxGeo(K.rand(r, 0.9, 2.2), K.rand(r, 0.3, 0.7), depth);
    K.xform(g, { rz: K.rand(r, -0.35, 0.35), x: su, y: sy, z: FACE + depth / 2 - 0.12 });
    B.flatLight.push(g);
  }

  // angular figure niches in the outer bays, readable at walking distance
  for (const [nu, ny, nseed] of [
    [-18.9, 2.8, 1699],
    [18.9, 2.8, 1700],
    [-18.9, 8.4, 1701],
    [-18.9, 12.9, 1702],
    [18.9, 8.4, 1703],
    [18.9, 12.9, 1704],
  ]) {
    addAngularNiche(B, { u: nu, y: ny, w: FACE, width: 1.8, height: 3.4, seed: nseed });
  }
  // two more high on the outer fields, above the ribs
  for (const [nu, ny, nseed] of [
    [-19.4, 35.2, 1705],
    [19.4, 35.2, 1706],
  ]) {
    addAngularNiche(B, { u: nu, y: ny, w: FACE, width: 1.8, height: 3.4, seed: nseed });
  }
  // flanking figures beside the great window
  for (const [nu, ny, nseed] of [
    [-11.5, 28.4, 1707],
    [11.5, 28.4, 1708],
  ]) {
    addAngularNiche(B, { u: nu, y: ny, w: FACE, width: 1.9, height: 3.8, seed: nseed });
  }
  // severe figures high on the outer flanks above the pilasters
  for (const [nu, ny, nseed] of [
    [-17.9, 40.0, 1709],
    [17.9, 40.0, 1710],
  ]) {
    addAngularNiche(B, { u: nu, y: ny, w: FACE, width: 1.8, height: 3.2, seed: nseed });
  }

  // grey mosaic accents (sparingly)
  const band = new THREEW.PlaneGeometry(WALL_W - 3, 0.5);
  K.scaleUV(band, (WALL_W - 3) / 2, 0.5 / 2);
  band.translate(0, 43.35, FACE + 0.035);
  B.mosaic.push(band);

  // corner buttresses, angular
  for (const sgn of [-1, 1]) {
    const bu = sgn * 23.3;
    B.flat.push(K.boxGeo(1.6, 45.0, 1.15, bu, 22.5, FACE + 0.47));
    B.flatDark.push(K.boxGeo(1.9, 1.3, 1.4, bu, 0.65, FACE + 0.55));
    for (let i = 0; i < 5; i++) {
      B.flatLight.push(K.boxGeo(1.75, 0.3, 1.3, bu, 8.5 + i * 7.5, FACE + 0.5));
      B.flat.push(
        K.xform(new K.THREE.ConeGeometry(0.18, 0.6, 4), {
          ry: Math.PI / 4,
          x: bu,
          y: 9.1 + i * 7.5,
          z: FACE + 1.12,
        })
      );
    }
    const p = K.angularPinnacle({ base: 1.5, height: 8.0, seed: 720 + sgn });
    p.translate(bu, 46.1, FACE + 0.65);
    B.flatLight.push(p);
    B.flatDark.push(K.boxGeo(0.4, 0.5, 0.4, bu, 54.6, FACE + 0.65));
  }
}

// ---------------------------------------------------------------------------
// Cornice, parapet, gable
// ---------------------------------------------------------------------------

function buildCrown(B, r) {
  B.flat.push(K.boxGeo(WALL_W + 0.6, 0.62, 1.5, 0, 44.62, FACE + 0.25));
  B.flatLight.push(K.boxGeo(WALL_W + 0.2, 0.22, 1.0, 0, 44.28, FACE + 0.32));
  B.flatDark.push(K.boxGeo(WALL_W + 0.1, 0.18, 0.6, 0, 44.95, FACE + 0.4));
  for (let i = 0; i < 13; i++) {
    const cu = -24 + i * 4;
    B.flat.push(
      K.xform(new K.THREE.ConeGeometry(0.32, 0.9, 4), { ry: Math.PI / 4, x: cu, y: 44.0, z: FACE + 0.35 })
    );
  }

  // parapet with angular posts
  B.flat.push(K.boxGeo(WALL_W, 1.15, 0.85, 0, 45.55, FACE + 0.42));
  for (let i = 0; i < 17; i++) {
    const pu = -22.5 + i * 2.8;
    B.flatLight.push(K.boxGeo(0.5, 1.05, 0.6, pu, 45.5, FACE + 1.0));
    B.flatDark.push(K.boxGeo(0.32, 0.28, 0.4, pu, 46.15, FACE + 1.0));
  }

  // angular pinnacles
  const pinnacles = [
    [-22.9, 7.0],
    [-17.1, 6.0],
    [-11.9, 6.4],
    [11.9, 6.4],
    [17.1, 6.0],
    [22.9, 7.0],
  ];
  for (let i = 0; i < pinnacles.length; i++) {
    const [pu, h] = pinnacles[i];
    const p = K.angularPinnacle({ base: 1.6, height: h, seed: 1000 + i * 9 });
    p.translate(pu, 46.15, FACE + 0.75);
    B.flatLight.push(p);
    B.stoneDark.push(K.sphereGeo(0.24, 6, pu, 46.15 + h + 0.3, FACE + 0.75));
  }

  // gable: hard triangle
  const gableH = 11;
  const gablePts = [
    [-11.6, 0],
    [-11.6, 1.0],
    [-8.0, 4.7],
    [-4.2, 8.2],
    [0, gableH],
    [4.2, 8.2],
    [8.0, 4.7],
    [11.6, 1.0],
    [11.6, 0],
  ];
  K.addGable(B, 'stoneLight', { u: 0, y: WALL_TOP, w: FACE, width: 23.2, height: gableH, depth: 1.4, pts: gablePts });
  const gz = FACE + 1.4 + 0.05;
  // crockets: angular blocks
  for (let i = 1; i < gablePts.length - 1; i++) {
    const [x0, y0] = gablePts[i];
    const [x1, y1] = gablePts[i + 1];
    const mx = (x0 + x1) / 2;
    const my = WALL_TOP + (y0 + y1) / 2;
    B.flatLight.push(
      K.xform(K.boxGeo(0.42, 0.42, 0.42), { rz: Math.PI / 4, x: mx, y: my, z: gz })
    );
  }
  // large angular cross relief on the gable face
  const cross = K.mergeGeos([
    K.boxGeo(0.4, 7.4, 0.28, 0, 3.7, 0),
    K.boxGeo(4.4, 0.4, 0.28, 0, 5.1, 0),
  ]);
  cross.translate(0, WALL_TOP + 2.6, gz + 0.02);
  B.flatDark.push(cross);

  // stripped angular grooves + carved bosses over the gable field
  for (let i = 0; i < 5; i++) {
    const gy = WALL_TOP + 1.55 + i * 1.65;
    const half = Math.max(1.1, 10.4 - i * 2.0);
    for (const sgn of [-1, 1]) {
      B.reveal.push(K.boxGeo(half * 0.62, 0.16, 0.1, sgn * half * 0.55, gy, gz + 0.04));
    }
  }
  for (let i = 0; i < 6; i++) {
    const a = Math.PI + (i / 5) * Math.PI;
    B.flatLight.push(K.sphereGeo(0.22, 6, Math.cos(a) * 7.4, WALL_TOP + 5.6 + Math.sin(a) * 3.6, gz + 0.07));
  }
  // sharp wedges at the gable springing
  for (const sgn of [-1, 1]) {
    B.flat.push(
      K.xform(new K.THREE.ConeGeometry(0.5, 2.6, 4), { ry: Math.PI / 4, rz: sgn * 0.5, x: sgn * 9.6, y: WALL_TOP + 1.3, z: gz + 0.1 })
    );
    B.reveal.push(K.boxGeo(2.4, 0.18, 0.12, sgn * 6.4, WALL_TOP + 0.55, gz + 0.03));
  }
  // finial cross at the apex
  const apex = K.crossGeo({ arm: 1.15, thickness: 0.22, depth: 0.24 });
  apex.translate(0, WALL_TOP + gableH + 1.5, FACE + 0.75);
  B.stoneLight.push(apex);
  B.flatDark.push(K.boxGeo(0.5, 1.2, 0.5, 0, WALL_TOP + gableH + 0.5, FACE + 0.75));

  B.texts.push({
    text: 'VIA CRUCIS',
    u: 0,
    y: WALL_TOP + 1.1,
    w: gz + 0.01,
    size: 5.2,
    maxH: 0.8,
    color: '#3d3a33',
    letterSpacing: 6,
  });
  B.texts.push({
    text: 'MORS UBI EST VICTORIA TUA',
    u: 0,
    y: 44.62,
    w: FACE + 1.02,
    size: 9.4,
    maxH: 0.55,
    color: '#3d3a33',
    letterSpacing: 3,
  });
}

// ---------------------------------------------------------------------------
// Ground-level angular foreground
// ---------------------------------------------------------------------------

function buildForeground(B, r, colliders) {
  // two angular soldiers with helmets and spears flanking the main portal
  for (const sgn of [-1, 1]) {
    const u = sgn * 6.95;
    B.flatDark.push(K.boxGeo(0.95, 0.8, 0.95, u, 0.4, FACE + 0.42));
    B.flatLight.push(K.boxGeo(0.78, 0.12, 0.78, u, 0.86, FACE + 0.42));
    B.flat.push(
      K.xform(K.angularFigure({ height: 2.15, pose: 'stand', helmet: true, spear: true, shield: true, seed: 700 + sgn }), {
        ry: -sgn * 0.18,
        x: u,
        y: 0.92,
        z: FACE + 0.45,
      })
    );
    colliders.push(circleCollider(WX(FACE + 0.45), u, 0.62, { y0: 0, y1: 3.5 }));
  }

  // flagellation / crown scenes above the side portals
  addScene(B, r, { u: 12.5, y: 16.4, width: 5.4, height: 3.6, kind: 'flagellation', seed: 820 });
  addScene(B, r, { u: -12.5, y: 16.4, width: 5.4, height: 3.6, kind: 'crown', seed: 840 });
  // denial of Peter and Veronica's veil above those
  addScene(B, r, { u: 12.5, y: 21.4, width: 5.4, height: 4.4, kind: 'denial', seed: 860 });
  addScene(B, r, { u: -12.5, y: 21.4, width: 5.4, height: 4.4, kind: 'veil', seed: 880 });
  // Resurrection above the oculus
  addScene(B, r, { u: 0, y: 39.95, width: 6.2, height: 4.2, kind: 'resurrection', seed: 900 });

  buildEmptyTomb(B, r, colliders);
}

// ---------------------------------------------------------------------------
// Hotspots
// ---------------------------------------------------------------------------

function passionHotspots() {
  return [
    hotspot(
      'passion',
      'Passion Façade',
      'Josep Maria Subirachs answered Gaudí’s organic abundance with angular, hollow-eyed figures. The west face is stripped to bare planes and hard shadows: the scourging, the crown of thorns, Peter’s denial, Veronica’s veil. It is meant to feel severe — the human drama of the last days, not the joy of birth.',
      [-37.8, 8.5, 0],
      { kicker: 'The west face · Subirachs', radius: 16 }
    ),
    hotspot(
      'subirachs',
      'Subirachs’ Figures',
      'The sculptor carved the Stations of the Cross in a deliberately modern, almost cubist language: bodies as blocks, faces as masks, drapery as folded planes. Look for the soldier’s helmet, the rooster of Peter’s denial and the veil of Veronica holding the imprint of a face. The contrast with the Nativity opposite is one of the great arguments in modern sacred art.',
      [-33.9, 5.5, 0],
      { kicker: 'Via Crucis · the Passion', radius: 11 }
    ),
    hotspot(
      'passion-oculus',
      'The Passion Oculus',
      'A great circular window sits at the heart of the west façade, framed by radiating stone rays that throw long shadows in the afternoon light. Its coloured glass answers the Nativity’s rose window across the transept. Around it the empty tomb and the Resurrection close the story told by the scenes below.',
      [-34.6, 15, 0],
      { kicker: 'Light · stone rays · the empty tomb', radius: 16 }
    ),
    hotspot(
      'via-crucis',
      'The Via Crucis',
      'Four relief panels climb the flanking bays: the flagellation at the column, the crowning with thorns, the denial in the courtyard and Veronica’s veil. Each is set in a hard rectangular frame like a station on the road to Calvary, the figures carved as prisms so the Catalan sun draws them in black and white.',
      [-34.6, 12, 12.5],
      { kicker: 'Passion Façade · the stations', radius: 12 }
    ),
  ];
}

// ---------------------------------------------------------------------------
// Colliders
// ---------------------------------------------------------------------------

function passionColliders(extra) {
  const C = [];
  const segs = [
    [-24, -15.25],
    [-9.75, -4.5],
    [4.5, 9.75],
    [15.25, 24],
  ];
  for (const [a, b] of segs) {
    C.push(boxCollider(X0, (a + b) / 2, 0.82, (b - a) / 2, { y0: 0, y1: 46 }));
  }
  C.push(...extra);
  return C;
}

// ---------------------------------------------------------------------------
// Build
// ---------------------------------------------------------------------------

export function buildPassion() {
  const group = new K.THREE.Group();
  group.name = 'passion-facade';
  group.position.set(X0, 0, 0);
  group.rotation.y = -Math.PI / 2;

  const B = K.makeBuckets();
  const M = K.passionMaterials();
  const r = K.rng(1987);
  const extraColliders = [];

  B.stone.push(
    K.wallWithOpeningsGeo({
      width: WALL_W,
      height: WALL_TOP,
      depth: WALL_D,
      openings: DOORS.map((d) => ({ x: d.u, w: d.w, h: d.h, bow: d.spring, pinch: d.pinch })),
      curveSegments: 8,
    })
  );

  // hard plinth segments between the portals
  const piers = [
    [-24, -15.9],
    [-9.4, -4.7],
    [4.7, 9.4],
    [15.9, 24],
  ];
  for (const [a, b] of piers) {
    B.flatDark.push(K.boxGeo(b - a, 1.1, 0.6, (a + b) / 2, 0.55, FACE + 0.16));
    B.flatLight.push(K.boxGeo(b - a - 0.35, 0.16, 0.5, (a + b) / 2, 1.16, FACE + 0.22));
  }

  for (const d of DOORS) {
    buildPortal(B, r, d, extraColliders);
    if (!d.central) buildSideCanopy(B, r, d);
  }

  buildOculus(B, r);
  buildFields(B, r, extraColliders);
  buildCrown(B, r);
  buildForeground(B, r, extraColliders);

  K.finishFacade(group, B, M);

  return {
    group,
    colliders: passionColliders(extraColliders),
    hotspots: passionHotspots(),
  };
}
