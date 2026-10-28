// Nativity façade (east transept end wall, x = 30..31.6, z = -24..24).
//
// Gaudí's organic masterpiece: three deep portals (Faith, Hope, Charity) framed
// by stacked archivolts full of small figures, carved tympana, the Tree of Life
// cypress with white doves, pelican, animals, angels, saints and inscriptions.
//
// All local coordinates are (u, y, w): u along the wall, y up, w outward from the
// wall centre plane. The parent group is at x = 30.8, rotated +90° about Y, so
// world = (30.8 + w, y, -u).

import * as K from './kit.js';
import { DIM, PALETTE } from '../config.js';
import { boxCollider, circleCollider, hotspot } from '../lib.js';

const WALL_W = DIM.facadeHalfWidth * 2; // 48
const WALL_TOP = 45;
const WALL_D = 1.6;
const FACE = 0.8; // outer wall face, local w
const X0 = 30.8; // world x of the wall centre plane

const DOORS = DIM.doors.nativity.map((d) => ({
  id: d.id,
  u: -d.coord, // local u = -worldZ on this façade
  w: d.w,
  h: d.h,
  spring: 0.62, // high springing -> rounder, parabolic head
  pinch: 0.8,
  central: d.w > 7,
}));

const ringSpec = (d) =>
  d.central
    ? { count: 6, band: 0.42, step: 0.38, depth: 0.54 }
    : { count: 5, band: 0.32, step: 0.3, depth: 0.42 };

const outerFrontOf = (d) => {
  const s = ringSpec(d);
  return FACE + (s.count - 1) * s.step + s.depth;
};

// ---------------------------------------------------------------------------
// Portal: reveal, tympanum, archivolt funnel, jamb columns and statues
// ---------------------------------------------------------------------------

function buildPortal(B, r, d, colliders) {
  const spec = ringSpec(d);
  const { u, w: dw, h: dh, spring, pinch } = d;

  // dark reveal lining through the full wall thickness
  B.reveal.push(K.revealLiningGeo(dw, dh, { spring, pinch, band: 0.17, depth: 1.64 }));

  // inner-face moulding so the doorway reads from inside the transept
  const innerRing = K.archRingG({
    w: dw - 0.06,
    h: dh - 0.06,
    band: 0.36,
    depth: 0.3,
    spring,
    pinch,
    baseExtend: 0.4,
  });
  innerRing.translate(u, 0, -0.93);
  B.stoneDark.push(innerRing);
  B.stoneLight.push(K.boxGeo(dw + 0.7, 0.18, 0.36, u, 0.09, -1.0));

  // threshold
  B.stoneDark.push(K.boxGeo(dw + 0.24, 0.14, 2.0, u, 0.07, 0.1));
  B.reveal.push(K.boxGeo(dw - 0.3, 0.035, 1.7, u, 0.15, 0.16));

  // carved tympanum inside the upper part of the portal
  buildTympanum(B, r, d);

  // stacked archivolt funnels, stepping outward and widening
  let iw = dw;
  let ih = dh;
  for (let i = 0; i < spec.count; i++) {
    const front = FACE + i * spec.step + spec.depth;
    const centerW = front - spec.depth / 2;
    const ring = K.archRingG({
      w: iw,
      h: ih,
      band: spec.band,
      depth: spec.depth,
      spring,
      pinch,
      baseExtend: 1.0,
      curveSegments: 12,
    });
    ring.translate(u, 0, centerW);
    const tint = ['stone', 'stoneLight', 'stoneWarm', 'stoneDark', 'stoneLight', 'stone'][i % 6];
    B[tint].push(ring);

    // dark throat lining so the funnel reads as a cave, not a flat frame
    const throat = K.archRingG({
      w: iw - 0.03,
      h: ih - 0.03,
      band: 0.1,
      depth: Math.max(0.12, spec.depth - 0.2),
      spring,
      pinch,
      baseExtend: 1.0,
      curveSegments: 12,
    });
    throat.translate(u, 0, centerW - 0.05);
    B.stoneDark.push(throat);

    // highlighting lip at the inner rim of the step
    const lip = K.archRingG({
      w: iw + 0.02,
      h: ih + 0.02,
      band: spec.band * 0.16,
      depth: 0.12,
      spring,
      pinch,
      baseExtend: 1.0,
      curveSegments: 12,
    });
    lip.translate(u, 0, front + 0.03);
    B.stoneLight.push(lip);

    // thin shadow groove where the next step rises (flush, not a protruding ridge)
    const corner = K.archRingG({
      w: iw + spec.band * 2 - 0.07,
      h: ih + spec.band - 0.03,
      band: 0.055,
      depth: 0.05,
      spring,
      pinch,
      baseExtend: 1.0,
      curveSegments: 12,
    });
    corner.translate(u, 0, front + 0.005);
    B.reveal.push(corner);

    // figures standing on selected archivolt steps
    if (i >= 1 && i <= (d.central ? 3 : 2)) {
      K.addRingFigures(B, 'stoneLight', {
        u,
        y: 0,
        wFront: front + 0.02,
        ringW: iw,
        ringH: ih,
        band: spec.band,
        spring,
        pinch,
        count: d.central ? 3 + i : 2 + i,
        hMin: d.central ? 1.05 : 0.9,
        hMax: d.central ? 1.4 : 1.15,
        seed: 910 + i * 37 + Math.round(d.u * 5) + 1000,
      });
    }
    // pearl beading along the step lip
    const pearls = K.archSamples({
      w: iw + spec.band,
      h: ih + spec.band * 0.5,
      spring,
      pinch,
      count: d.central ? 9 : 7,
      tMin: 0.08,
      tMax: 0.92,
    });
    for (const p of pearls) {
      B.stoneLight.push(K.sphereGeo(0.085, 6, u + p.x, p.y, front + 0.06));
    }

    // hanging vines on the lower steps — the portal grows out of the wall
    if (i <= 1) {
      for (const sgn of [-1, 1]) {
        K.addVine(B, 'stoneWarm', {
          u: u + sgn * (iw / 2 + spec.band * 0.1),
          y0: 0.8,
          y1: ih * spring * 0.8,
          w: front + 0.1,
          sway: 0.3,
          seed: 1810 + i * 17 + sgn + Math.round(u),
          leaves: 14,
          radius: 0.07,
          leafScale: 1.4,
        });
        K.addGrapes(B, 'stoneWarm', {
          u: u + sgn * (iw / 2 + spec.band * 0.55),
          y: ih * spring * 0.42,
          w: front + 0.14,
          scale: 0.9,
          seed: 1830 + i * 11 + sgn,
        });
      }
    }

    iw += spec.band * 2;
    ih += spec.band;
  }

  // outer portal frame: twisted columns + jamb statues
  const outerFront = outerFrontOf(d);
  const colU = dw / 2 + (d.central ? 1.42 : 0.78);
  const colW = outerFront + (d.central ? 0.35 : 0.28);
  const colH = dh * spring + (d.central ? 1.7 : 1.1);
  for (const sgn of [-1, 1]) {
    K.addTwistedColumn(B, {
      u: u + sgn * colU,
      y: 0,
      w: colW,
      height: colH,
      radius: d.central ? 0.32 : 0.26,
      seed: 70 + sgn * 13 + Math.round(d.u),
    });
    colliders.push(circleCollider(X0 + colW, -(u + sgn * colU), 0.58, { y0: 0, y1: colH }));
  }
  const figU = dw / 2 + (d.central ? 2.32 : 1.55);
  const figW = outerFront + 0.43;
  for (const sgn of [-1, 1]) {
    const kind = K.chance(r, d.central ? 0.65 : 0.4) ? 'angel' : 'human';
    K.addFigureOnPedestal(B, {
      u: u + sgn * figU,
      y: 0,
      w: figW,
      height: d.central ? K.rand(r, 2.0, 2.35) : K.rand(r, 1.7, 1.95),
      pose: K.pick(r, ['stand', 'armsUp', 'hold', 'cross', 'pray']),
      kind,
      wings: kind === 'angel',
      halo: K.chance(r, 0.55),
      seed: 500 + sgn * 29 + Math.round(d.u * 3),
      pedestal: 0.78,
      ry: sgn * 0.16,
    });
    colliders.push(circleCollider(X0 + figW, -(u + sgn * figU), 0.62, { y0: 0, y1: 3.4 }));
  }

  // carved hood over the outermost step
  const hood = K.archRingG({
    w: iw - spec.band * 2 + 0.08,
    h: ih - spec.band + 0.06,
    band: 0.3,
    depth: 0.2,
    spring,
    pinch,
    baseExtend: 1.0,
  });
  hood.translate(u, 0, outerFront + 0.22);
  B.stoneDark.push(hood);

  // small relief figures climbing the outer jambs, legible from the ground
  const jambHalf = dw / 2 + spec.count * spec.band - 0.24;
  const jambFront = outerFront + 0.02;
  const jambYs = d.central ? [4.2, 5.7, 7.2] : [3.5, 4.7, 5.9];
  for (const sgn of [-1, 1]) {
    for (let i = 0; i < jambYs.length; i++) {
      const jy = jambYs[i];
      const ju = u + sgn * jambHalf;
      K.addCorbel(B, 'stoneLight', { u: ju, y: jy - 0.04, w: jambFront - 0.06, size: 0.24 });
      B.stoneLight.push(
        K.xform(
          K.figureGeo({
            height: K.rand(r, 0.8, 1.0),
            pose: K.pick(r, ['stand', 'pray', 'hold', 'cross']),
            halo: K.chance(r, 0.35),
            seed: 1700 + i * 7 + sgn + Math.round(u),
          }),
          { ry: -sgn * 0.2, x: ju, y: jy, z: jambFront + 0.02 }
        )
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Carved tympanum inside the portal
// ---------------------------------------------------------------------------

function buildTympanum(B, r, d) {
  const { u, w: dw, h: dh, spring } = d;
  const baseY = d.central ? 12.8 : 9.0;
  const panelH = dh - baseY + 4.0; // top is deliberately buried in the wall
  B.stoneWarm.push(K.archPanelGeo(dw - 0.22, panelH, 0.5, { x: u, y: baseY, z: -0.18, spring }));

  // projecting sculpture ledge
  B.stoneLight.push(K.boxGeo(dw + 0.1, 0.34, 0.8, u, baseY + 0.07, 0.18));
  B.stoneDark.push(K.boxGeo(dw + 0.02, 0.1, 0.5, u, baseY - 0.05, 0.22));

  // small canopy above the scene, inside the porch
  K.addCorbelRow(B, 'stoneLight', {
    u0: u - dw / 2 + 0.55,
    u1: u + dw / 2 - 0.55,
    y: baseY + (d.central ? 3.3 : 2.55),
    w: 0.02,
    step: 1.1,
    size: 0.3,
  });

  const y = baseY + 0.3;
  const zw = 0.42;

  if (d.central) {
    // ---- The Nativity: Holy Family, ox, donkey, shepherds, Magi, star ------
    B.stoneDark.push(K.boxGeo(0.9, 0.42, 0.6, u, y + 0.21, zw));
    B.stoneLight.push(K.boxGeo(0.72, 0.16, 0.5, u, y + 0.46, zw));
    B.white.push(K.sphereGeo(0.16, 8, u, y + 0.56, zw + 0.04));
    B.white.push(K.boxGeo(0.3, 0.12, 0.42, u, y + 0.5, zw + 0.02));

    B.stoneLight.push(
      K.xform(K.figureGeo({ height: 1.55, pose: 'kneel', halo: true, seed: 12 }), {
        ry: 0.45,
        x: u - 0.85,
        y,
        z: zw + 0.06,
      })
    );
    B.stoneLight.push(
      K.xform(K.figureGeo({ height: 1.9, pose: 'hold', seed: 13 }), { ry: -0.3, x: u + 1.15, y, z: zw + 0.08 })
    );
    B.stoneWarm.push(
      K.xform(K.animalGeo({ kind: 'ox', length: 1.6, height: 1.05, seed: 14 }), { x: u - 2.9, y, z: zw - 0.08 })
    );
    B.stoneWarm.push(
      K.xform(K.animalGeo({ kind: 'donkey', length: 1.45, height: 1.0, seed: 15 }), {
        x: u + 2.95,
        y,
        z: zw - 0.08,
        ry: Math.PI,
      })
    );
    B.stoneLight.push(
      K.xform(K.figureGeo({ height: 1.35, pose: 'pray', seed: 16 }), { ry: 0.4, x: u - 3.7, y, z: zw + 0.2 })
    );
    B.stoneLight.push(
      K.xform(K.figureGeo({ height: 1.3, pose: 'armsUp', kind: 'angel', wings: true, halo: true, seed: 17 }), {
        ry: -0.45,
        x: u + 3.65,
        y,
        z: zw + 0.2,
      })
    );
    // shepherds / Magi on the outer part of the ledge
    for (let i = 0; i < 3; i++) {
      const su = u + (i - 1) * 1.3 + K.rand(r, -0.2, 0.2);
      B.stoneLight.push(
        K.xform(
          K.figureGeo({ height: K.rand(r, 1.1, 1.35), pose: K.pick(r, ['stand', 'hold']), seed: 30 + i }),
          { ry: K.rand(r, -0.3, 0.3), x: su, y: y + 0.02, z: zw + 0.56 }
        )
      );
      if (i < 2) B.gold.push(K.coneGeo(0.1, 0.16, 5, su, y + 1.36, zw + 0.56, 0));
    }
    // Star of Bethlehem
    K.addStar(B, 'gold', { u, y: baseY + 4.15, w: 0.4, r: 0.62, points: 8 });
    K.addStar(B, 'gold', { u: u - 1.5, y: baseY + 3.6, w: 0.32, r: 0.22, points: 4 });
    K.addStar(B, 'gold', { u: u + 1.6, y: baseY + 3.7, w: 0.32, r: 0.24, points: 4 });
    K.addCloud(B, 'stoneLight', { u: u - 2.1, y: baseY + 3.55, w: 0.34, scale: 0.65, seed: 44, count: 5 });
    K.addCloud(B, 'stoneLight', { u: u + 2.2, y: baseY + 3.5, w: 0.34, scale: 0.6, seed: 45, count: 5 });
    K.addCloud(B, 'stoneLight', { u: u - 1.1, y: baseY + 1.5, w: 0.36, scale: 0.5, seed: 48, count: 4 });
    K.addCloud(B, 'stoneLight', { u: u + 1.4, y: baseY + 1.35, w: 0.36, scale: 0.46, seed: 49, count: 4 });
    K.addCloud(B, 'stoneLight', { u: u + 0.1, y: baseY + 5.55, w: 0.34, scale: 0.62, seed: 50, count: 5 });
    // choirs of small angels filling the tympanum field
    for (const [au, ay, aseed] of [
      [-2.6, 2.9, 51],
      [2.5, 2.9, 52],
      [-1.3, 4.5, 53],
      [1.5, 4.6, 54],
    ]) {
      B.stoneLight.push(
        K.xform(
          K.figureGeo({
            height: 1.05,
            pose: K.pick(r, ['armsUp', 'pray', 'hold']),
            kind: 'angel',
            wings: true,
            halo: true,
            seed: aseed,
          }),
          { ry: K.rand(r, -0.3, 0.3), x: u + au, y: baseY + ay, z: 0.36 }
        )
      );
    }
    // vines climbing the tympanum's inner edges
    K.addVine(B, 'stoneWarm', {
      u: u - 3.55,
      y0: baseY + 0.5,
      y1: baseY + 4.9,
      w: 0.32,
      sway: 0.22,
      seed: 55,
      leaves: 10,
      radius: 0.06,
      leafScale: 0.9,
    });
    K.addVine(B, 'stoneWarm', {
      u: u + 3.5,
      y0: baseY + 0.5,
      y1: baseY + 4.7,
      w: 0.32,
      sway: 0.2,
      seed: 56,
      leaves: 10,
      radius: 0.06,
      leafScale: 0.9,
    });
    K.addLizard(B, { u: u + 0.55, y: y + 0.02, w: zw + 0.3, s: 1.0, seed: 46 });
    K.addSnail(B, { u: u - 0.7, y: y + 0.02, w: zw + 0.24, s: 0.9, seed: 47 });
  } else {
    // ---- Hope (anchor) and Faith (cross) ------------------------------------
    const isHope = d.id === 'hope';
    B.stoneLight.push(
      K.xform(K.figureGeo({ height: 2.0, pose: isHope ? 'hold' : 'cross', halo: true, seed: isHope ? 61 : 62 }), {
        ry: isHope ? 0.25 : -0.2,
        x: u - 0.75,
        y,
        z: zw,
      })
    );
    B.stoneLight.push(
      K.xform(K.figureGeo({ height: 1.6, pose: 'pray', kind: 'angel', wings: true, halo: true, seed: 63 }), {
        ry: 0.3,
        x: u + 1.25,
        y,
        z: zw + 0.1,
      })
    );
    if (isHope) {
      const anchor = [];
      anchor.push(K.boxGeo(0.13, 1.6, 0.14, 0, 0.8, 0));
      anchor.push(K.boxGeo(0.72, 0.12, 0.14, 0, 1.45, 0));
      const arc = [];
      for (let i = 0; i <= 12; i++) {
        const a = Math.PI * (0.15 + (0.7 * i) / 12);
        arc.push([Math.cos(a) * 0.55, 0.2 + Math.sin(a) * 0.55, 0]);
      }
      anchor.push(K.tubeGeo(arc, 0.055, { tubularSegments: 20, radialSegments: 4 }));
      const g = K.mergeGeos(anchor);
      K.xform(g, { x: u + 1.4, y: y + 0.5, z: zw + 0.55 });
      B.stoneLight.push(g);
    } else {
      const c = K.crossGeo({ arm: 0.85, thickness: 0.14, depth: 0.16 });
      c.translate(u + 1.4, y + 1.5, zw + 0.55);
      B.stoneLight.push(c);
    }
    K.addCloud(B, 'stoneLight', { u: u - 1.7, y: baseY + 2.35, w: 0.3, scale: 0.45, seed: 64 });
    K.addCloud(B, 'stoneLight', { u: u + 2.1, y: baseY + 2.45, w: 0.3, scale: 0.42, seed: 65 });
    K.addStar(B, 'stoneLight', { u, y: baseY + 2.75, w: 0.34, r: 0.26, points: 8 });
  }
}

// ---------------------------------------------------------------------------
// Canopy gable above each portal
// ---------------------------------------------------------------------------

function buildCanopyGable(B, r, d) {
  const { u } = d;
  const baseY = d.central ? 20.75 : 14.78;
  const width = d.central ? 15.0 : 9.4;
  const height = d.central ? 1.85 : 2.0;
  const depth = 1.15;

  // cornice slab resting on the wall, with corbels
  B.stone.push(K.boxGeo(width + 0.5, 0.4, 0.9, u, baseY - 0.22, FACE + 0.35));
  B.stoneLight.push(K.boxGeo(width + 0.2, 0.16, 0.55, u, baseY + 0.02, FACE + 0.22));
  K.addCorbelRow(B, 'stoneLight', {
    u0: u - width / 2 + 0.6,
    u1: u + width / 2 - 0.6,
    y: baseY - 0.4,
    w: FACE,
    step: 1.3,
    size: 0.34,
  });

  const gable = K.addGable(B, 'stoneLight', { u, y: baseY + 0.12, w: FACE, width, height, depth });
  const zf = FACE + depth + 0.05; // just in front of the gable face
  const { pts } = gable;
  for (let i = 1; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i];
    const [x1, y1] = pts[i + 1];
    const mx = u + (x0 + x1) / 2;
    const my = baseY + 0.12 + (y0 + y1) / 2;
    B.stoneLight.push(K.coneGeo(0.1, 0.34, 4, mx, my, zf, Math.PI / 4));
    B.stoneLight.push(K.sphereGeo(0.075, 6, mx, my + 0.2, zf));
  }
  // finial at the apex
  B.stoneDark.push(K.coneGeo(0.16, 0.4, 4, u, baseY + height + 0.2, zf - 0.05, Math.PI / 4));

  // relief on the gable face
  if (d.central) {
    K.addCloud(B, 'stoneLight', { u: u - 1.5, y: baseY + 0.85, w: zf, scale: 0.34, seed: 88 });
    K.addCloud(B, 'stoneLight', { u: u + 1.5, y: baseY + 0.85, w: zf, scale: 0.32, seed: 89 });
    K.addDove(B, 'white', { u, y: baseY + 0.95, w: zf + 0.05, size: 0.52, seed: 90, rz: 0.2 });
    K.addStar(B, 'gold', { u, y: baseY + 1.6, w: zf, r: 0.2, points: 8 });
  } else {
    K.addStar(B, 'stoneLight', { u, y: baseY + 1.2, w: zf, r: 0.32, points: 8 });
    K.addCloud(B, 'stoneLight', { u: u - 1.9, y: baseY + 0.8, w: zf, scale: 0.3, seed: 91 });
    K.addCloud(B, 'stoneLight', { u: u + 1.9, y: baseY + 0.8, w: zf, scale: 0.3, seed: 92 });
  }

  B.texts.push({
    text: d.central ? 'PORTA CHARITATIS' : d.id === 'hope' ? 'SPES' : 'FIDES',
    u,
    y: baseY + 0.92,
    w: zf + 0.08,
    size: d.central ? 5.4 : 1.9,
    maxH: d.central ? 0.72 : 0.85,
    color: '#4c3b26',
    letterSpacing: d.central ? 4 : 6,
  });
}

// ---------------------------------------------------------------------------
// Central upper façade: rose window, inscription, gable, Tree of Life
// ---------------------------------------------------------------------------

function buildCentralUpper(B, r) {
  // ---- rose window ---------------------------------------------------------
  const roseR = DIM.roseWindows.nativity.r;
  const roseY = DIM.roseWindows.nativity.y;
  B.reveal.push(K.discGeo(roseR + 0.15, 0.14, 44).translate(0, roseY, FACE + 0.06));
  const surround = K.circleRingGeo(roseR + 1.75, roseR, 0.62, 56);
  surround.translate(0, roseY, FACE + 0.33);
  B.stoneLight.push(surround);
  const outerLip = K.circleRingGeo(roseR + 1.95, roseR + 1.72, 0.2, 56);
  outerLip.translate(0, roseY, FACE + 0.45);
  B.stoneDark.push(outerLip);
  const rose = K.roseWindowParts({ radius: roseR, colors: PALETTE.glassRose, seed: 77, petals: 16 });
  K.xform(rose.stone, { x: 0, y: roseY, z: FACE + 0.08 });
  B.stoneLight.push(rose.stone);
  K.xform(rose.glass, { x: 0, y: roseY, z: FACE + 0.2 });
  B.glass.push({ geo: rose.glass, colored: true });

  // clouds and little angels around the rose
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + 0.31;
    const rr = roseR + 2.3;
    K.addCloud(B, 'stoneLight', {
      u: Math.cos(a) * rr,
      y: roseY + Math.sin(a) * rr,
      w: FACE + 0.34,
      scale: 0.5,
      seed: 200 + i,
      count: 4,
    });
  }
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
    const rr = roseR + 2.15;
    B.stoneLight.push(
      K.xform(
        K.figureGeo({
          height: 1.05,
          pose: K.pick(r, ['pray', 'hold', 'armsUp']),
          kind: 'angel',
          wings: true,
          halo: true,
          seed: 260 + i,
        }),
        { ry: -a + Math.PI / 2, x: Math.cos(a) * rr, y: roseY + Math.sin(a) * rr + 0.35, z: FACE + 0.42 }
      )
    );
  }

  // ---- inscriptions --------------------------------------------------------
  B.texts.push({
    text: 'HODIE NATUS EST VOBIS SALVATOR',
    u: 0,
    y: 37.3,
    w: FACE + 0.05,
    size: 13,
    maxH: 1.1,
    color: '#4a3a26',
    letterSpacing: 3,
  });
  B.stoneLight.push(K.boxGeo(11.4, 0.12, 0.24, 0, 36.45, FACE + 0.12));
  B.stoneLight.push(K.boxGeo(11.4, 0.12, 0.24, 0, 38.15, FACE + 0.12));
  B.texts.push({
    text: 'GLORIA IN EXCELSIS DEO',
    u: 0,
    y: 38.9,
    w: FACE + 0.06,
    size: 9.2,
    maxH: 0.82,
    color: '#4a3a26',
    letterSpacing: 3,
  });

  // ---- niche saints on the upper fields -----------------------------------
  for (const [nu, ny, hood, seed] of [
    [-7.5, 35.6, false, 301],
    [7.5, 35.6, false, 302],
    [-12.0, 36.2, true, 303],
    [12.0, 36.2, true, 304],
    [-19.6, 36.2, true, 305],
    [19.6, 36.2, true, 306],
  ]) {
    K.addNiche(B, 'stoneLight', { u: nu, y: ny, w: FACE, width: 1.45, height: 2.75, figure: true, hood, seed });
  }

  // ---- central gable, crockets and the Tree of Life ------------------------
  const gableBaseY = WALL_TOP;
  const gableH = 10.6;
  const gablePts = [
    [-11.2, 0],
    [-9.7, 2.1],
    [-6.7, 5.5],
    [-3.3, 8.9],
    [0, gableH],
    [3.3, 8.9],
    [6.7, 5.5],
    [9.7, 2.1],
    [11.2, 0],
  ];
  K.addGable(B, 'stoneLight', {
    u: 0,
    y: gableBaseY,
    w: FACE,
    width: 22.4,
    height: gableH,
    depth: 1.7,
    pts: gablePts,
  });
  const gz = FACE + 1.7 + 0.05; // 2.55, just in front of the gable face
  for (let i = 1; i < gablePts.length - 1; i++) {
    const [x0, y0] = gablePts[i];
    const [x1, y1] = gablePts[i + 1];
    const mx = (x0 + x1) / 2;
    const my = gableBaseY + (y0 + y1) / 2;
    B.stoneLight.push(K.coneGeo(0.11, 0.38, 4, mx, my, gz, Math.PI / 4));
    B.stoneLight.push(K.sphereGeo(0.075, 6, mx, my + 0.22, gz));
  }
  // pinnacles flanking the gable, standing on the parapet
  for (const sgn of [-1, 1]) {
    const p = K.pinnacleGeo({ base: 1.15, height: 6.2, tiers: 2, seed: 410 + sgn });
    p.translate(sgn * 11.9, 46.2, FACE + 0.7);
    B.stoneLight.push(p);
    B.stoneDark.push(K.sphereGeo(0.28, 8, sgn * 11.9, 52.9, FACE + 0.7));
  }
  // two angels standing on the gable face, flanking the Tree of Life
  for (const sgn of [-1, 1]) {
    B.stoneLight.push(
      K.xform(K.figureGeo({ height: 2.0, pose: 'armsUp', kind: 'angel', wings: true, halo: true, seed: 420 + sgn }), {
        ry: -sgn * 0.2,
        x: sgn * 5.9,
        y: gableBaseY + 4.3,
        z: gz + 0.05,
      })
    );
    B.stoneDark.push(K.boxGeo(1.5, 0.3, 0.5, sgn * 5.9, gableBaseY + 4.22, gz + 0.02));
  }

  // shallow carved panel in the gable: warm stone field, dark frame
  const gBack = K.archPanelGeo(6.4, 7.6, 0.16, { x: 0, y: gableBaseY + 1.35, z: gz + 0.07, spring: 0.62 });
  B.stoneWarm.push(gBack);
  const gFrame = K.archRingG({
    w: 6.4,
    h: 7.6,
    band: 0.24,
    depth: 0.26,
    spring: 0.62,
    pinch: 0.86,
    baseExtend: 0.1,
  });
  gFrame.translate(0, gableBaseY + 1.35, gz + 0.13);
  B.stoneDark.push(gFrame);
  for (let i = 0; i < 5; i++) {
    K.addCloud(B, 'stoneLight', {
      u: -1.9 + i * 0.95,
      y: gableBaseY + 2.4 + (i % 2) * 0.35,
      w: gz + 0.14,
      scale: 0.38,
      seed: 500 + i,
      count: 4,
    });
  }
  K.addDove(B, 'white', { u: 0, y: gableBaseY + 4.4, w: gz + 0.18, size: 0.8, seed: 511, rz: 0.15 });

  // ---- The Tree of Life: one continuous sculptural vertical ---------------
  // A trunk springs from the portal canopy, splits into two great branches that
  // frame the rose window, and meets again to carry the cypress, its doves and
  // the pelican up to the cross.
  const treeW = FACE + 1.0;
  B.stoneWarm.push(
    K.tubeGeo(
      [
        [0, 22.9, treeW - 0.08],
        [-0.4, 23.7, treeW - 0.04],
        [0.28, 24.5, treeW + 0.01],
        [0, 25.2, treeW + 0.04],
      ],
      0.3,
      { tubularSegments: 18, radialSegments: 6 }
    )
  );
  const treeBranch = (mirror) => {
    const pts = [
      [0, 25.2, treeW],
      [mirror * 1.1, 25.0, treeW + 0.02],
      [mirror * 2.7, 25.4, treeW + 0.04],
      [mirror * 4.5, 26.5, treeW + 0.06],
      [mirror * 5.9, 28.3, treeW + 0.08],
      [mirror * 6.8, 30.6, treeW + 0.1],
      [mirror * 6.6, 33.2, treeW + 0.1],
      [mirror * 5.5, 35.8, treeW + 0.08],
      [mirror * 3.9, 38.4, treeW + 0.06],
      [mirror * 2.0, 40.8, treeW + 0.04],
      [0, 42.7, treeW + 0.02],
    ];
    B.stoneWarm.push(K.tubeGeo(pts, 0.2, { tubularSegments: 44, radialSegments: 5 }));
    for (let i = 2; i < pts.length - 1; i++) {
      const [bu, by, bw] = pts[i];
      K.addFoliage(B, 'foliage', {
        u: bu,
        y: by,
        w: bw + 0.06,
        scale: 0.3 + (i % 2) * 0.08,
        seed: 1900 + i * 13 + mirror,
        count: 7,
      });
      K.addFoliage(B, 'foliage', {
        u: bu + mirror * 0.34,
        y: by + 0.32,
        w: bw + 0.14,
        scale: 0.22,
        seed: 1930 + i * 7 + mirror,
        count: 5,
      });
      // small twigs
      B.stoneWarm.push(
        K.tubeGeo(
          [
            [bu, by, bw],
            [bu + mirror * 0.7, by + 0.5, bw + 0.08],
            [bu + mirror * 1.0, by + 1.15, bw + 0.12],
          ],
          0.055,
          { tubularSegments: 8, radialSegments: 4 }
        )
      );
      if (i % 3 === 0) {
        K.addDove(B, 'white', {
          u: bu + mirror * 0.3,
          y: by + 0.55,
          w: bw + 0.2,
          size: 0.66 + (i % 2) * 0.14,
          seed: 1950 + i + mirror,
          ry: mirror * 0.7,
          rz: 0.2,
        });
      }
    }
    K.addStar(B, 'gold', { u: mirror * 6.8, y: 31.4, w: treeW + 0.18, r: 0.26, points: 4 });
    K.addStar(B, 'gold', { u: mirror * 5.2, y: 35.1, w: treeW + 0.18, r: 0.2, points: 4 });
    K.addStar(B, 'gold', { u: mirror * 3.1, y: 38.6, w: treeW + 0.16, r: 0.18, points: 4 });
  };
  treeBranch(1);
  treeBranch(-1);

  // ---- the great cypress crowning the Tree of Life ------------------------
  const cypressBaseY = 43.4;
  const cypressW = FACE + 2.0;
  // sculpted console carrying the tree
  B.stoneDark.push(K.boxGeo(4.2, 0.5, 1.3, 0, cypressBaseY - 1.55, FACE + 0.75));
  B.stoneLight.push(K.boxGeo(3.6, 0.45, 1.15, 0, cypressBaseY - 1.1, FACE + 0.7));
  B.stoneWarm.push(K.cylGeo(1.15, 1.55, 0.85, 8, 0, cypressBaseY - 0.45, cypressW - 0.6));
  for (const sgn of [-1, 1]) {
    K.addCorbel(B, 'stoneLight', { u: sgn * 1.6, y: cypressBaseY - 1.6, w: FACE + 0.1, size: 0.5 });
    K.addFoliage(B, 'foliage', {
      u: sgn * 1.5,
      y: cypressBaseY - 0.4,
      w: cypressW - 0.15,
      scale: 0.4,
      seed: 2010 + sgn,
      count: 5,
    });
  }
  const cyp = K.cypressTreeGeo({ height: 18.0, radius: 2.7, seed: 913 });
  cyp.translate(0, cypressBaseY, cypressW);
  B.foliage.push(cyp);
  B.stoneWarm.push(K.cylGeo(0.24, 0.42, 2.4, 8, 0, cypressBaseY + 1.1, cypressW));
  const crown = K.crossGeo({ arm: 0.62, thickness: 0.11, depth: 0.13 });
  crown.translate(0, cypressBaseY + 18.5, cypressW);
  B.gold.push(crown);

  // white doves: perched on the foliage, flying around the crown
  const doveSpots = [
    [-1.5, 3.0, 0.15, 0.88],
    [1.45, 4.2, 0.5, 0.82],
    [-1.3, 6.4, 0.95, 0.95],
    [1.55, 7.6, 0.1, 0.85],
    [0.2, 10.6, 0.85, 1.1],
    [-1.95, 9.2, 1.1, 0.82],
    [2.05, 10.2, 0.7, 0.86],
    [-0.9, 12.6, 0.55, 0.92],
    [1.2, 5.6, 0.85, 0.85],
    [0.65, 14.2, 0.45, 0.78],
    [-1.8, 13.6, 0.85, 0.72],
    [1.7, 12.8, 1.05, 0.74],
    [-0.35, 16.2, 0.4, 0.7],
  ];
  for (let i = 0; i < doveSpots.length; i++) {
    const [du, dy, dOut, ds] = doveSpots[i];
    K.addDove(B, 'white', {
      u: du,
      y: cypressBaseY + dy,
      w: cypressW + dOut,
      size: ds * 1.15,
      seed: 950 + i,
      ry: K.rand(r, -0.9, 0.9),
      rz: K.rand(r, -0.5, 0.5),
      rx: K.rand(r, -0.4, 0.4),
    });
  }
  // pelican piercing its breast, large and prominent at the foot of the tree
  const pel = K.pelicanGeo({ size: 1.9 });
  K.xform(pel, { ry: 0.35, x: 1.15, y: cypressBaseY - 0.02, z: cypressW + 0.85 });
  B.white.push(pel);
  K.addCorbel(B, 'stoneLight', { u: 1.15, y: cypressBaseY + 0.02, w: cypressW + 0.4, size: 0.55 });

  // angels flying around the tree
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.4;
    const rr = 2.7 + (i % 2) * 0.9;
    B.stoneLight.push(
      K.xform(
        K.figureGeo({
          height: 1.7 + (i % 3) * 0.15,
          pose: K.pick(r, ['armsUp', 'hold', 'pray', 'stand']),
          kind: 'angel',
          wings: true,
          halo: true,
          seed: 700 + i,
        }),
        {
          ry: -a + Math.PI / 2 + K.rand(r, -0.3, 0.3),
          x: Math.cos(a) * rr,
          y: cypressBaseY + 2.0 + (i % 3) * 4.6,
          z: cypressW + 0.5,
        }
      )
    );
  }
  // stars pinned to the gable face around the tree
  for (let i = 0; i < 14; i++) {
    K.addStar(B, i % 3 === 0 ? 'gold' : 'stoneLight', {
      u: K.rand(r, -8.5, 8.5),
      y: cypressBaseY + K.rand(r, 0.5, 8.5),
      w: gz + 0.2,
      r: K.rand(r, 0.12, 0.28),
      points: 4,
    });
  }
  // clouds at the base of the gable, clear of the cypress
  for (let i = 0; i < 6; i++) {
    const sgn = i % 2 === 0 ? -1 : 1;
    K.addCloud(B, 'stoneLight', {
      u: sgn * K.rand(r, 3.6, 9.4),
      y: WALL_TOP + K.rand(r, 0.3, 1.5),
      w: gz + 0.04,
      scale: K.rand(r, 0.5, 0.85),
      seed: 800 + i,
      count: 5,
    });
  }
}

// ---------------------------------------------------------------------------
// Side-portal upper composition
// ---------------------------------------------------------------------------

function buildSideUpper(B, r, d) {
  const { u } = d;

  // relief panel above the canopy gable
  const panelY = 18.35;
  const pw = 6.5;
  const ph = 4.3;
  B.stoneWarm.push(K.boxGeo(pw - 0.4, ph - 0.4, 0.14, u, panelY + ph / 2, FACE + 0.08));
  B.stone.push(K.boxGeo(pw, 0.3, 0.6, u, panelY + ph + 0.15, FACE + 0.3));
  B.stone.push(K.boxGeo(pw, 0.26, 0.55, u, panelY - 0.1, FACE + 0.28));
  B.stone.push(K.boxGeo(0.3, ph, 0.55, u - pw / 2 + 0.15, panelY + ph / 2, FACE + 0.3));
  B.stone.push(K.boxGeo(0.3, ph, 0.55, u + pw / 2 - 0.15, panelY + ph / 2, FACE + 0.3));
  B.stoneDark.push(K.boxGeo(pw - 0.3, 0.2, 0.5, u, panelY + 0.25, FACE + 0.3));

  for (let i = 0; i < 2; i++) {
    B.stoneLight.push(
      K.xform(
        K.figureGeo({
          height: 2.05 + i * 0.1,
          pose: i === 0 ? 'pray' : 'hold',
          hood: i === 1,
          halo: true,
          seed: 880 + i + Math.round(u),
        }),
        { ry: i === 0 ? 0.28 : -0.24, x: u + (i === 0 ? -1.35 : 1.3), y: panelY + 0.3, z: FACE + 0.35 }
      )
    );
  }
  B.stoneLight.push(K.boxGeo(1.3, 0.45, 0.4, u, panelY + 0.36, FACE + 0.6));

  // ---- oculus above the side portal ---------------------------------------
  const ocU = u + Math.sign(u) * 0.5;
  const ocY = 26.6;
  const ocR = 2.45;
  B.reveal.push(K.discGeo(ocR + 0.12, 0.14, 36).translate(ocU, ocY, FACE + 0.06));
  const ocSurround = K.circleRingGeo(ocR + 0.95, ocR, 0.5, 44);
  ocSurround.translate(ocU, ocY, FACE + 0.27);
  B.stoneLight.push(ocSurround);
  const oc = K.roseWindowParts({ radius: ocR, colors: PALETTE.glassRose, seed: 320 + Math.round(u), petals: 14 });
  K.xform(oc.stone, { x: ocU, y: ocY, z: FACE + 0.14 });
  B.stoneLight.push(oc.stone);
  K.xform(oc.glass, { x: ocU, y: ocY, z: FACE + 0.27 });
  B.glass.push({ geo: oc.glass, colored: true });
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    B.stoneLight.push(
      K.xform(K.figureGeo({ height: 0.75, pose: 'hold', kind: 'angel', wings: true, halo: true, seed: 400 + i }), {
        ry: -a,
        x: ocU + Math.cos(a) * (ocR + 1.5),
        y: ocY + Math.sin(a) * (ocR + 1.5),
        z: FACE + 0.42,
      })
    );
  }
  // pediment above the oculus
  K.addPediment(B, 'stoneLight', {
    u: ocU,
    y: ocY + ocR + 1.35,
    w: FACE,
    width: 7.2,
    height: 2.7,
    depth: 0.85,
  });
  K.addCloud(B, 'stoneLight', { u: ocU, y: ocY + ocR + 1.0, w: FACE + 0.5, scale: 0.6, seed: 460 + Math.round(u) });
  B.texts.push({
    text: d.id === 'hope' ? 'SPES IN DOMINO' : 'FIDES QUAE VINCIT',
    u: ocU,
    y: ocY + ocR + 2.15,
    w: FACE + 0.9,
    size: 3.6,
    maxH: 0.75,
    color: '#4a3a26',
    letterSpacing: 2,
  });
  // upper field stars
  for (let i = 0; i < 6; i++) {
    K.addStar(B, i % 2 ? 'gold' : 'stoneLight', {
      u: ocU + K.rand(r, -2.2, 2.2),
      y: ocY + ocR + K.rand(r, 3.4, 6.0),
      w: FACE + 0.04,
      r: K.rand(r, 0.1, 0.2),
      points: 4,
    });
  }
}

// ---------------------------------------------------------------------------
// Piers, mosaic and wall-field ornament
// ---------------------------------------------------------------------------

function buildPiers(B, r) {
  const THREEW = K.THREE;
  for (const pu of [-22.4, -18, -9, 9, 18, 22.4]) {
    B.stone.push(K.boxGeo(1.35, 22.4, 0.5, pu, 32.3, FACE + 0.22));
    B.stoneLight.push(K.boxGeo(1.55, 0.45, 0.75, pu, 43.3, FACE + 0.34));
    B.stoneDark.push(K.boxGeo(1.5, 0.35, 0.7, pu, 21.35, FACE + 0.33));
    const strip = new THREEW.PlaneGeometry(0.52, 20.6);
    K.scaleUV(strip, 0.52 / 2, 20.6 / 2);
    strip.translate(pu, 32.3, FACE + 0.49);
    B.mosaic.push(strip);
    K.addCorbelRow(B, 'stoneLight', { u0: pu - 0.6, u1: pu + 0.6, y: 43.0, w: FACE + 0.35, step: 0.6, size: 0.26 });
  }

  // horizontal mosaic friezes
  const frieze = new THREEW.PlaneGeometry(WALL_W - 1.6, 0.62);
  K.scaleUV(frieze, (WALL_W - 1.6) / 2, 0.62 / 2);
  frieze.translate(0, 43.15, FACE + 0.035);
  B.mosaic.push(frieze);
  const frieze2 = new THREEW.PlaneGeometry(WALL_W - 1.6, 0.4);
  K.scaleUV(frieze2, (WALL_W - 1.6) / 2, 0.4 / 2);
  frieze2.translate(0, 21.0, FACE + 0.035);
  B.mosaic2.push(frieze2);
  for (const sgn of [-1, 1]) {
    const p = new THREEW.PlaneGeometry(2.1, 2.6);
    K.scaleUV(p, 2.1 / 2, 2.6 / 2);
    p.translate(sgn * 20.9, 39.2, FACE + 0.04);
    B.mosaic2.push(p);
  }

  // horizontal string courses that catch the light and break the flat field
  for (const [a, b] of [
    [-24, -16.3],
    [16.3, 24],
  ]) {
    B.stoneLight.push(K.boxGeo(b - a, 0.3, 0.55, (a + b) / 2, 20.86, FACE + 0.28));
    B.stoneDark.push(K.boxGeo(b - a, 0.14, 0.42, (a + b) / 2, 20.66, FACE + 0.3));
  }
  for (const sgn of [-1, 1]) {
    B.stoneLight.push(K.boxGeo(6.8, 0.32, 0.5, sgn * 20.5, 12.45, FACE + 0.26));
    B.stoneDark.push(K.boxGeo(6.8, 0.14, 0.38, sgn * 20.5, 12.22, FACE + 0.28));
    B.stoneLight.push(K.boxGeo(6.8, 0.28, 0.45, sgn * 20.5, 16.6, FACE + 0.24));
  }

  // climbing vines on the upper piers
  for (const vu of [-18, -9.9, 9.9, 18]) {
    K.addVine(B, 'stoneWarm', {
      u: vu,
      y0: 22.0,
      y1: 41.5,
      w: FACE + 0.42,
      sway: 0.6,
      seed: 610 + Math.round(vu * 7),
      leaves: 20,
      leafKey: 'stoneWarm',
      radius: 0.085,
      leafScale: 1.5,
    });
    K.addVine(B, 'stoneWarm', {
      u: vu + Math.sign(vu) * 0.55,
      y0: 24.0,
      y1: 37.0,
      w: FACE + 0.36,
      sway: 0.4,
      seed: 620 + Math.round(vu * 11),
      leaves: 13,
      leafKey: 'stoneWarm',
      radius: 0.07,
      leafScale: 1.3,
    });
  }

  // carved stars scattered over the upper fields
  K.addStarField(B, { u0: -22, u1: -8, y0: 31, y1: 42, w: FACE + 0.05, count: 9, seed: 651, key: 'stoneLight' });
  K.addStarField(B, { u0: 8, u1: 22, y0: 31, y1: 42, w: FACE + 0.05, count: 9, seed: 652, key: 'stoneLight' });

  // mosaic rosettes on the corner buttresses
  for (const su of [-23.3, 23.3]) {
    for (let i = 0; i < 3; i++) {
      const rosette = K.starGeo(8, 0.34, 0.16, 0.08);
      rosette.translate(su, 24.5 + i * 2.0, FACE + 0.98);
      B.mosaic2.push(rosette);
    }
  }

  // ---- corner buttresses ---------------------------------------------------
  for (const sgn of [-1, 1]) {
    const bu = sgn * 23.3;
    B.stone.push(K.boxGeo(1.55, 45.0, 1.05, bu, 22.5, FACE + 0.42));
    B.stoneDark.push(K.boxGeo(1.85, 1.2, 1.35, bu, 0.6, FACE + 0.5));
    for (let i = 0; i < 5; i++) {
      B.stoneLight.push(K.boxGeo(1.7, 0.26, 1.2, bu, 8.5 + i * 7.5, FACE + 0.45));
      B.stoneLight.push(K.coneGeo(0.12, 0.45, 4, bu, 9.2 + i * 7.5, FACE + 1.02, Math.PI / 4));
    }
    const p = K.pinnacleGeo({ base: 1.35, height: 7.5, tiers: 2, seed: 720 + sgn });
    p.translate(bu, 46.1, FACE + 0.6);
    B.stoneLight.push(p);
    B.stoneDark.push(K.sphereGeo(0.34, 8, bu, 54.1, FACE + 0.6));
  }
}

// ---------------------------------------------------------------------------
// Cornice, parapet, pinnacles, gargoyles
// ---------------------------------------------------------------------------

function buildCrown(B, r) {
  // great cornice
  B.stone.push(K.boxGeo(WALL_W + 0.5, 0.62, 1.6, 0, 44.66, FACE + 0.2));
  B.stoneLight.push(K.boxGeo(WALL_W + 0.15, 0.2, 1.1, 0, 44.33, FACE + 0.28));
  K.addCorbelRow(B, 'stoneDark', { u0: -23.2, u1: 23.2, y: 44.4, w: FACE, step: 2.15, size: 0.42 });

  // parapet
  B.stone.push(K.boxGeo(WALL_W, 1.25, 1.1, 0, 45.6, FACE + 0.52));
  const pm = new K.THREE.PlaneGeometry(WALL_W - 0.5, 0.85);
  K.scaleUV(pm, (WALL_W - 0.5) / 2, 0.85 / 2);
  pm.translate(0, 45.62, FACE + 1.1);
  B.mosaic.push(pm);
  for (let i = 0; i < 17; i++) {
    const pu = -22.5 + i * 2.8;
    B.stoneLight.push(K.boxGeo(0.34, 1.05, 0.5, pu, 45.55, FACE + 1.12));
    B.stoneDark.push(K.sphereGeo(0.22, 7, pu, 46.2, FACE + 1.12));
  }

  // pinnacles on the parapet
  const pinnacles = [
    [-22.9, 6.2],
    [-17.0, 5.4],
    [-13.3, 4.9],
    [13.3, 4.9],
    [17.0, 5.4],
    [22.9, 6.2],
  ];
  for (let i = 0; i < pinnacles.length; i++) {
    const [pu, h] = pinnacles[i];
    const p = K.pinnacleGeo({ base: 1.5, height: h, tiers: 2, seed: 1000 + i * 7 });
    p.translate(pu, 46.2, FACE + 0.7);
    B.stoneLight.push(p);
    B.stoneDark.push(K.sphereGeo(0.24, 8, pu, 46.2 + h + 0.55, FACE + 0.7));
  }
  for (const bu of [-19.9, -15.1, -11.5, 11.5, 15.1, 19.9]) {
    B.stoneLight.push(K.sphereGeo(0.34, 10, bu, 46.45, FACE + 1.0));
    B.stoneDark.push(K.cylGeo(0.16, 0.24, 0.36, 8, bu, 46.15, FACE + 1.0));
  }

  // gargoyles at the cornice
  K.addGargoyle(B, 'stoneWarm', { u: -22.6, y: 43.6, w: FACE - 0.15, scale: 1.25, seed: 1101 });
  K.addGargoyle(B, 'stoneWarm', { u: 22.6, y: 43.6, w: FACE - 0.15, scale: 1.25, seed: 1102 });
  K.addGargoyle(B, 'stoneWarm', { u: -7.2, y: 44.0, w: FACE - 0.2, scale: 0.9, seed: 1103 });
  K.addGargoyle(B, 'stoneWarm', { u: 7.2, y: 44.0, w: FACE - 0.2, scale: 0.9, seed: 1104 });

  // inscription on the projecting cornice face
  B.texts.push({
    text: 'ET VERBUM CARO FACTUM EST',
    u: 0,
    y: 44.66,
    w: FACE + 1.02,
    size: 9.6,
    maxH: 0.58,
    color: '#4a3a26',
    letterSpacing: 3,
  });
}

// ---------------------------------------------------------------------------
// Scatter: extra life on the lower façade
// ---------------------------------------------------------------------------

function buildScatter(B, r) {
  // musical angels on the outer archivolt step of the central portal
  for (let i = 0; i < 2; i++) {
    const sgn = i === 0 ? -1 : 1;
    const g = K.figureGeo({ height: 1.4, pose: 'hold', kind: 'angel', wings: true, halo: true, seed: 1200 + i });
    K.xform(g, { ry: sgn * 0.3, x: sgn * 6.45, y: 5.3, z: 2.65 });
    B.stoneLight.push(g);
    const harp = [];
    harp.push(K.boxGeo(0.06, 0.75, 0.1, 0, 0.38, 0));
    harp.push(K.boxGeo(0.34, 0.06, 0.1, 0.14, 0.72, 0));
    harp.push(
      K.tubeGeo(
        [
          [-0.05, 0.1, 0],
          [-0.18, 0.4, 0],
          [0.02, 0.76, 0],
        ],
        0.025,
        { tubularSegments: 8, radialSegments: 4 }
      )
    );
    const hg = K.mergeGeos(harp);
    K.xform(hg, { x: sgn * 6.1, y: 5.55, z: 2.78, ry: sgn * 0.3 });
    B.gold.push(hg);
  }

  // lamb at the foot of the central portal
  B.stoneLight.push(
    K.xform(K.animalGeo({ kind: 'lamb', length: 0.9, height: 0.6, seed: 1301 }), { x: -7.9, y: 0, z: 2.5, ry: 0.5 })
  );

  // snails and a chameleon on ledges near the portal bases
  K.addSnail(B, { u: 7.6, y: 0.05, w: 2.6, s: 1.15, seed: 1302 });
  K.addSnail(B, { u: -8.4, y: 0.05, w: 2.35, s: 0.9, seed: 1303 });
  K.addLizard(B, { u: 5.6, y: 3.1, w: 1.93, s: 1.25, seed: 1304 });
  K.addSnail(B, { u: -17.4, y: 0.05, w: 2.06, s: 0.95, seed: 1305 });
  K.addSnail(B, { u: 17.2, y: 0.05, w: 2.06, s: 0.95, seed: 1306 });

  // relief rosettes in the portal spandrels
  for (const sgn of [-1, 1]) {
    const rosette = K.starGeo(12, 0.55, 0.24, 0.1);
    rosette.translate(sgn * 7.4, 18.2, FACE + 0.12);
    B.stoneLight.push(rosette);
  }
}

// ---------------------------------------------------------------------------
// Ground-level ornament: prophets on the frieze, outer-bay niches, relief panels
// ---------------------------------------------------------------------------

function buildGroundOrnament(B, r) {
  // prophets standing on corbels along the frieze above the portal zone
  for (const [pu, seed] of [
    [-7.65, 1401],
    [7.65, 1402],
    [-16.7, 1403],
    [16.7, 1404],
  ]) {
    K.addCorbel(B, 'stoneLight', { u: pu, y: 21.36, w: FACE, size: 0.52 });
    B.stoneLight.push(
      K.xform(
        K.figureGeo({
          height: 1.85,
          pose: K.pick(r, ['stand', 'hold', 'cross', 'pray']),
          hood: K.chance(r, 0.4),
          halo: K.chance(r, 0.7),
          seed,
        }),
        { ry: pu > 0 ? -0.28 : 0.28, x: pu, y: 21.38, z: FACE + 0.42 }
      )
    );
  }

  // shallow niches with saints in the outer bays, at walking height
  for (const [nu, ny, seed] of [
    [-20.4, 2.4, 1501],
    [-20.4, 6.5, 1502],
    [20.4, 2.4, 1503],
    [20.4, 6.5, 1504],
  ]) {
    K.addNiche(B, 'stoneLight', {
      u: nu,
      y: ny,
      w: FACE,
      width: 1.7,
      height: 3.1,
      figure: true,
      seed,
      hood: K.chance(r, 0.5),
    });
  }

  // relief panels with angels on the upper corner fields
  for (const sgn of [-1, 1]) {
    const nu = sgn * 20.4;
    B.stoneWarm.push(K.boxGeo(2.6, 3.6, 0.16, nu, 30.4, FACE + 0.1));
    B.stone.push(K.boxGeo(3.0, 0.32, 0.6, nu, 32.35, FACE + 0.3));
    B.stone.push(K.boxGeo(3.0, 0.28, 0.55, nu, 28.55, FACE + 0.28));
    B.stone.push(K.boxGeo(0.32, 3.95, 0.55, nu - 1.34, 30.4, FACE + 0.3));
    B.stone.push(K.boxGeo(0.32, 3.95, 0.55, nu + 1.34, 30.4, FACE + 0.3));
    B.stoneDark.push(K.boxGeo(2.62, 0.18, 0.5, nu, 28.78, FACE + 0.3));
    B.stoneLight.push(
      K.xform(K.figureGeo({ height: 2.3, pose: 'armsUp', kind: 'angel', wings: true, halo: true, seed: 1600 + sgn }), {
        x: nu,
        y: 28.95,
        z: FACE + 0.32,
      })
    );
    K.addCloud(B, 'stoneLight', { u: nu - 0.9, y: 30.2, w: FACE + 0.34, scale: 0.32, seed: 1610 + sgn });
    K.addCloud(B, 'stoneLight', { u: nu + 0.95, y: 29.4, w: FACE + 0.34, scale: 0.3, seed: 1620 + sgn });
  }

  // carved rosettes flanking the side relief panels
  for (const sgn of [-1, 1]) {
    for (const nu of [sgn * 8.6, sgn * 17.2]) {
      K.addStar(B, 'stoneLight', { u: nu, y: 19.4, w: FACE + 0.1, r: 0.3, points: 8 });
    }
  }
}

// ---------------------------------------------------------------------------
// Rich field fill: mosaics, angel groups, reliefs, eroded crest, parapet statues
// ---------------------------------------------------------------------------

function buildRichFields(B, r) {
  const T = K.THREE;
  // colourful trencadís band across the fields
  for (const fy of [26.9]) {
    const band = new T.PlaneGeometry(WALL_W - 1.8, 0.46);
    K.scaleUV(band, (WALL_W - 1.8) / 2, 0.46 / 2);
    band.translate(0, fy, FACE + 0.045);
    B.mosaic.push(band);
  }
  for (const sgn of [-1, 1]) {
    // vertical mosaics on the outer piers
    const mv = new T.PlaneGeometry(0.7, 7.2);
    K.scaleUV(mv, 0.7 / 2, 7.2 / 2);
    mv.translate(sgn * 21.05, 31.2, FACE + 0.04);
    B.mosaic2.push(mv);
  }

  // relief panels with animals and foliage in the narrow fields beside the rose
  for (const sgn of [-1, 1]) {
    const pu = sgn * 8.2;
    B.reveal.push(K.boxGeo(1.7, 3.8, 0.16, pu, 26.4, FACE + 0.1));
    B.stone.push(K.boxGeo(2.1, 0.26, 0.6, pu, 28.45, FACE + 0.3));
    B.stone.push(K.boxGeo(2.1, 0.24, 0.55, pu, 24.45, FACE + 0.28));
    B.stone.push(K.boxGeo(0.26, 4.2, 0.55, pu - 0.92, 26.4, FACE + 0.3));
    B.stone.push(K.boxGeo(0.26, 4.2, 0.55, pu + 0.92, 26.4, FACE + 0.3));
    B.stoneDark.push(K.boxGeo(1.72, 0.16, 0.5, pu, 24.65, FACE + 0.3));
    B.stoneWarm.push(
      K.xform(K.animalGeo({ kind: sgn > 0 ? 'lamb' : 'donkey', length: 0.85, height: 0.7, seed: 2100 + sgn }), {
        ry: sgn > 0 ? 0.4 : -0.5,
        x: pu,
        y: 24.85,
        z: FACE + 0.34,
      })
    );
    K.addFoliage(B, 'foliage', { u: pu - 0.35, y: 27.2, w: FACE + 0.36, scale: 0.32, seed: 2110 + sgn, count: 4 });
    K.addVine(B, 'stoneWarm', {
      u: pu + 0.45,
      y0: 25.0,
      y1: 27.8,
      w: FACE + 0.36,
      sway: 0.18,
      seed: 2120 + sgn,
      leaves: 8,
      radius: 0.05,
      leafScale: 0.8,
    });
  }

  // angel groups standing on corbels high on the façade
  for (const [au, ay, aseed] of [
    [-20.3, 41.8, 2201],
    [-15.4, 41.8, 2202],
    [-11.5, 41.8, 2203],
    [11.5, 41.8, 2204],
    [15.4, 41.8, 2205],
    [20.3, 41.8, 2206],
  ]) {
    K.addCorbel(B, 'stoneLight', { u: au, y: ay - 0.05, w: FACE, size: 0.42 });
    B.stoneLight.push(
      K.xform(
        K.figureGeo({
          height: K.rand(r, 1.2, 1.5),
          pose: K.pick(r, ['armsUp', 'pray', 'hold']),
          kind: 'angel',
          wings: true,
          halo: true,
          seed: aseed,
        }),
        { ry: K.rand(r, -0.3, 0.3), x: au, y: ay, z: FACE + 0.52 }
      )
    );
  }
  // extra niche saints in the narrow fields beside the big window
  for (const sgn of [-1, 1]) {
    K.addNiche(B, 'stoneLight', {
      u: sgn * 8.9,
      y: 31.6,
      w: FACE,
      width: 1.35,
      height: 2.6,
      figure: true,
      seed: 2300 + sgn,
      hood: true,
    });
  }

  // vine friezes and grapes on the outer fields
  for (const [vu, seed] of [
    [-20.2, 2401],
    [20.2, 2402],
    [-16.2, 2403],
    [16.2, 2404],
  ]) {
    K.addVine(B, 'stoneWarm', {
      u: vu,
      y0: 22.4,
      y1: 28.2,
      w: FACE + 0.4,
      sway: 0.7,
      seed,
      leaves: 16,
      radius: 0.08,
      leafScale: 1.35,
    });
    K.addVine(B, 'stoneWarm', {
      u: vu + 0.6,
      y0: 23.2,
      y1: 27.4,
      w: FACE + 0.34,
      sway: 0.45,
      seed: seed + 7,
      leaves: 10,
      radius: 0.06,
      leafScale: 1.1,
    });
    K.addGrapes(B, 'stoneWarm', { u: vu + 0.5, y: 26.6, w: FACE + 0.44, scale: 1.2, seed: seed + 11 });
    K.addGrapes(B, 'stoneWarm', { u: vu - 0.45, y: 24.6, w: FACE + 0.42, scale: 1.0, seed: seed + 12 });
  }

  // ragged, eroded crest along the parapet (skipping the central gable)
  for (let i = 0; i < 26; i++) {
    const cu = -23.6 + i * 1.9 + K.rand(r, -0.25, 0.25);
    if (Math.abs(cu) < 11.5) continue;
    const h = K.rand(r, 0.3, 1.05);
    const wdt = K.rand(r, 0.55, 1.15);
    const dep = K.rand(r, 0.6, 1.2);
    const g = new T.IcosahedronGeometry(0.5, 0);
    K.xform(g, {
      sy: h * 1.6,
      sx: wdt,
      sz: dep,
      x: cu,
      y: 46.3 + h * 0.3,
      z: FACE + 0.85,
    });
    B[i % 2 === 0 ? 'stoneLight' : 'stoneDark'].push(g);
  }
  // extra slender pinnacles between the main ones
  for (const [pu, h, seed] of [
    [-14.8, 5.4, 2501],
    [14.8, 5.4, 2502],
    [-20.5, 5.8, 2503],
    [20.5, 5.8, 2504],
  ]) {
    const p = K.pinnacleGeo({ base: 1.15, height: h, tiers: 2, seed });
    p.translate(pu, 46.25, FACE + 0.72);
    B.stoneLight.push(p);
    B.stoneDark.push(K.sphereGeo(0.22, 8, pu, 46.25 + h + 0.45, FACE + 0.72));
  }
  // statues standing on the parapet
  for (const [su, sseed] of [
    [-11.9, 2511],
    [11.9, 2512],
    [-21.6, 2513],
    [21.6, 2514],
  ]) {
    B.stoneDark.push(K.boxGeo(0.85, 0.4, 0.85, su, 46.4, FACE + 1.2));
    B.stoneLight.push(
      K.xform(
        K.figureGeo({
          height: 1.55,
          pose: K.pick(r, ['stand', 'pray', 'cross']),
          halo: K.chance(r, 0.6),
          seed: sseed,
        }),
        { ry: -Math.sign(su) * 0.35, x: su, y: 46.6, z: FACE + 1.2 }
      )
    );
  }

  // lower outer bays: vines, niche saints, carved animals and a mosaic band
  for (const sgn of [-1, 1]) {
    K.addVine(B, 'stoneWarm', {
      u: sgn * 21.4,
      y0: 1.6,
      y1: 9.4,
      w: FACE + 0.42,
      sway: 0.5,
      seed: 2600 + sgn,
      leaves: 14,
      radius: 0.08,
      leafScale: 1.3,
    });
    K.addVine(B, 'stoneWarm', {
      u: sgn * 17.6,
      y0: 1.6,
      y1: 10.2,
      w: FACE + 0.4,
      sway: 0.55,
      seed: 2610 + sgn,
      leaves: 15,
      radius: 0.07,
      leafScale: 1.2,
    });
    K.addGrapes(B, 'stoneWarm', { u: sgn * 21.2, y: 8.6, w: FACE + 0.46, scale: 1.3, seed: 2620 + sgn });
    K.addNiche(B, 'stoneLight', {
      u: sgn * 20.4,
      y: 13.4,
      w: FACE,
      width: 1.6,
      height: 2.8,
      figure: true,
      seed: 2630 + sgn,
      hood: true,
    });
    B.stoneWarm.push(
      K.xform(K.animalGeo({ kind: sgn > 0 ? 'lamb' : 'ox', length: 0.85, height: 0.62, seed: 2640 + sgn }), {
        ry: sgn * 0.4,
        x: sgn * 19.2,
        y: 1.15,
        z: FACE + 0.5,
      })
    );
    const mb = new T.PlaneGeometry(6.4, 0.42);
    K.scaleUV(mb, 6.4 / 2, 0.42 / 2);
    mb.translate(sgn * 20.4, 9.7, FACE + 0.04);
    B.mosaic.push(mb);
  }

  // small angel reliefs in the fields above the side windows
  for (const [au, ay, aseed] of [
    [-16.2, 34.6, 2801],
    [-11.2, 34.6, 2802],
    [11.2, 34.6, 2803],
    [16.2, 34.6, 2804],
  ]) {
    K.addCorbel(B, 'stoneLight', { u: au, y: ay - 0.05, w: FACE, size: 0.36 });
    B.stoneLight.push(
      K.xform(
        K.figureGeo({
          height: 1.25,
          pose: K.pick(r, ['pray', 'hold', 'armsUp']),
          kind: 'angel',
          wings: true,
          halo: true,
          seed: aseed,
        }),
        { ry: K.rand(r, -0.25, 0.25), x: au, y: ay, z: FACE + 0.45 }
      )
    );
  }

  // eroded, mountainous outcrops breaking the flat wall surface
  const outcrops = [];
  for (let i = 0; i < 8; i++) {
    const sgn = i % 2 === 0 ? -1 : 1;
    outcrops.push([sgn * K.rand(r, 13.4, 17.0), K.rand(r, 33.2, 42.2), K.rand(r, 0.45, 1.05)]);
  }
  for (let i = 0; i < 6; i++) {
    const sgn = i % 2 === 0 ? -1 : 1;
    const oy = i < 3 ? K.rand(r, 33.4, 35.4) : K.rand(r, 39.3, 42.2);
    outcrops.push([sgn * K.rand(r, 20.7, 22.1), oy, K.rand(r, 0.42, 0.9)]);
  }
  for (let i = 0; i < 8; i++) {
    const sgn = i % 2 === 0 ? -1 : 1;
    const ou = sgn * (i % 4 < 2 ? K.rand(r, 17.3, 19.3) : K.rand(r, 21.3, 23.2));
    outcrops.push([ou, K.rand(r, 12.3, 19.1), K.rand(r, 0.4, 0.9)]);
  }
  for (let i = 0; i < outcrops.length; i++) {
    const [ou, oy, os] = outcrops[i];
    const g = new T.IcosahedronGeometry(os * 0.55, 0);
    K.xform(g, {
      sy: K.rand(r, 0.75, 1.25),
      sx: K.rand(r, 0.8, 1.3),
      sz: K.rand(r, 0.6, 1.0),
      ry: K.rand(r, 0, Math.PI * 2),
      x: ou,
      y: oy,
      z: FACE + K.rand(r, 0.12, 0.42),
    });
    B[['stoneLight', 'stoneDark', 'stoneWarm'][i % 3]].push(g);
  }
  // larger rock masses fused into the top corners
  for (const sgn of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      const g = new T.IcosahedronGeometry(K.rand(r, 0.7, 1.4), 0);
      K.xform(g, {
        sy: K.rand(r, 0.8, 1.3),
        sx: K.rand(r, 0.9, 1.5),
        ry: K.rand(r, 0, Math.PI * 2),
        x: sgn * K.rand(r, 21.0, 23.6),
        y: K.rand(r, 43.0, 45.4),
        z: FACE + K.rand(r, 0.2, 0.7),
      });
      B[i % 2 === 0 ? 'stoneLight' : 'stoneDark'].push(g);
    }
  }

  // final inscription filling the top field
  B.texts.push({
    text: 'SANCTA FAMILIA',
    u: 0,
    y: 43.85,
    w: FACE + 0.04,
    size: 8,
    maxH: 0.5,
    color: '#3f2f1b',
    letterSpacing: 4,
  });
}

function nativityHotspots() {
  return [
    hotspot(
      'nativity',
      'Nativity Façade',
      'The only façade Gaudí saw completed (1894–1930), facing the rising sun. Three portals — Faith, Hope and Charity — are buried under vines, doves, angels, animals and the Holy Family: the Incarnation told as a hymn to creation rather than a doctrine. Gaudí took his models from the cathedral of Reims and from the living world of Catalan nature.',
      [37.8, 8.5, 0],
      { kicker: 'The east face · Gaudí’s own work', radius: 16 }
    ),
    hotspot(
      'charity',
      'Portal of Charity',
      'The central and deepest of the three portals, its nested archivolts crowded with small figures of angels, musicians and saints. Inside the porch the Nativity is carved above the door: Mary, Joseph, the child in the manger, the ox and the donkey, watched by shepherds and the Magi. Look for the pelican piercing its own breast — the medieval image of a love that feeds others with itself.',
      [33.9, 5.5, 0],
      { kicker: 'Nativity Façade · the central portal', radius: 11 }
    ),
    hotspot(
      'tree',
      'The Tree of Life',
      'A stone cypress crowns the central gable, its branches alive with white doves — souls gathered under the cross. Gaudí crowded the tree with the pelican, a chameleon, snails, stars and clouds: a whole cosmology carved in stone. The gable beneath it rises to the small cross that tops the whole façade.',
      [34.8, 15, 0],
      { kicker: 'Cypress · doves · the crown of the façade', radius: 16 }
    ),
    hotspot(
      'hope-faith',
      'Portals of Hope and Faith',
      'The two side portals are narrower and gentler than Charity, each with its own carved tympanum and a canopy gable set into the wall. Hope carries an anchor and Faith a cross; around them the archivolt steps hold choirs of little angels. Two round windows above answer the great rose window in the centre.',
      [34.2, 8.5, 12.5],
      { kicker: 'Nativity Façade · side portals', radius: 12 }
    ),
  ];
}

// ---------------------------------------------------------------------------
// Colliders
// ---------------------------------------------------------------------------

function nativityColliders(extra) {
  const C = [];
  // solid wall segments, with exact gaps for the three open doors
  // (openings at z = 0 ±4.5 and z = ±12.5 ±2.75)
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

export function buildNativity() {
  const group = new K.THREE.Group();
  group.name = 'nativity-facade';
  group.position.set(X0, 0, 0);
  group.rotation.y = Math.PI / 2;

  const B = K.makeBuckets();
  const M = K.nativityMaterials();
  const r = K.rng(4171);
  const extraColliders = [];

  // structural wall with the three exact openings
  B.stone.push(
    K.wallWithOpeningsGeo({
      width: WALL_W,
      height: WALL_TOP,
      depth: WALL_D,
      openings: DOORS.map((d) => ({ x: d.u, w: d.w, h: d.h, bow: d.spring, pinch: d.pinch })),
      curveSegments: 10,
    })
  );

  // plinth band between the portals
  const piers = [
    [-24, -15.9],
    [-9.2, -4.95],
    [4.95, 9.2],
    [15.9, 24],
  ];
  for (const [a, b] of piers) {
    B.stoneDark.push(K.boxGeo(b - a, 1.05, 0.55, (a + b) / 2, 0.52, FACE + 0.14));
    B.stoneLight.push(K.boxGeo(b - a - 0.3, 0.16, 0.45, (a + b) / 2, 1.1, FACE + 0.2));
  }

  for (const d of DOORS) {
    buildPortal(B, r, d, extraColliders);
    buildCanopyGable(B, r, d);
  }

  buildCentralUpper(B, r);
  for (const d of DOORS) if (!d.central) buildSideUpper(B, r, d);
  buildPiers(B, r);
  buildCrown(B, r);
  buildScatter(B, r);
  buildGroundOrnament(B, r);
  buildRichFields(B, r);

  K.finishFacade(group, B, M);

  return {
    group,
    colliders: nativityColliders(extraColliders),
    hotspots: nativityHotspots(),
  };
}
