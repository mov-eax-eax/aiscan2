// The twelve apostle bell towers: four behind each façade.
//
// Layout (see DIM.apostleTowers): the two outer towers of each façade are
// ground-standing at the outer edges, behind the façade wall; the two inner
// towers spring from `baseY` (45 m, or 48 m for the Glory pair), just above the
// façade screen, so the three portals stay completely clear. Each visible shaft
// is a tapering square mass on a stepped plinth / roof-terrace base, with corner
// buttresses, vertical ribs, string courses and lancet windows. The belfry
// (DIM.apostleBelfryY..apostleBelfryTop) opens on every face, holds tubular
// bells and a spiral stair, and is crowned by a balustrade, corner pinnacles,
// an openwork needle spire and the fruit-like finial ball.

import { DIM } from '../config.js';
import {
  THREE,
  boxGeo,
  xform,
  sphereGeo,
  torusGeo,
  latheGeo,
  wallWithOpeningsGeo,
  pinnacleGeo,
  spiralStairGeo,
  scaleUV,
  crossGeo,
  matrixAt,
} from '../lib.js';
import {
  FACES4,
  frustum4,
  corniceGeo,
  windowUnit,
  nicheUnit,
  faceMatrix,
  bellProtos,
  balustradeSquare,
  simplePinnacleGeo,
} from './common.js';

// Global shaft profile: width by height (world y).
const PROFILE = [
  { y: 1.15, w: 9.0 },
  { y: 22, w: 8.7 },
  { y: 40, w: 8.45 },
  { y: 58, w: 8.15 },
  { y: 74, w: 7.88 },
];

function profileWidth(y) {
  if (y <= PROFILE[0].y) return PROFILE[0].w;
  for (let i = 1; i < PROFILE.length; i++) {
    if (y <= PROFILE[i].y) {
      const a = PROFILE[i - 1];
      const c = PROFILE[i];
      const t = (y - a.y) / (c.y - a.y);
      return a.w + (c.w - a.w) * t;
    }
  }
  return PROFILE[PROFILE.length - 1].w;
}

/** Shaft sections from `start` up to the belfry, aligned to the global profile.
 *  Long spans are subdivided so the taper is smooth and string courses sit
 *  roughly every 9 m. */
function sectionsFor(start) {
  const ys = [start];
  for (const p of PROFILE) {
    if (p.y > start + 0.05) ys.push(p.y);
  }
  const fine = [ys[0]];
  for (let i = 1; i < ys.length; i++) {
    const a = fine[fine.length - 1];
    const b = ys[i];
    const n = Math.max(1, Math.round((b - a) / 9));
    for (let k = 1; k <= n; k++) fine.push(a + ((b - a) * k) / n);
  }
  const out = [];
  for (let i = 0; i < fine.length - 1; i++) {
    out.push({ y0: fine[i], y1: fine[i + 1], w0: profileWidth(fine[i]), w1: profileWidth(fine[i + 1]) });
  }
  return out;
}

export function buildApostles(b, mats) {
  const win = windowUnit({ w: 1.5, h: 8.2, band: 0.24, depth: 0.34 });
  const niche = nicheUnit({ w: 2.4, h: 5.2, band: 0.32, depth: 0.46 });
  const pinnGeo = simplePinnacleGeo({ base: 1.0, height: 4.8 });
  const bells = bellProtos(1.15, 2.7);

  DIM.apostleTowers.forEach((t, ti) => {
    const key = 'ap_' + t.id;
    const H = t.top; // crown tip / start of the needle
    const F = t.finial; // very top of the finial cluster
    const belfryY = DIM.apostleBelfryY;
    const belfryTop = DIM.apostleBelfryTop;
    const cx = t.x;
    const cz = t.z;
    const baseY = t.baseY || 0;
    const grounded = baseY <= 0.01;
    const start = grounded ? 1.15 : baseY + 1.25; // visible shaft start
    const add = (g) => b.add(key, g);
    const addF = (w0, w1, h, y0) => add(xform(frustum4(w0, w1, h, y0), { x: cx, z: cz }));
    // cornices and ribs go to the darker trim stone so the articulation reads
    const addC = (w, y, opts) => b.add('trim', xform(corniceGeo(w, y, opts), { x: cx, z: cz }));

    // ------------------------------------------------------- plinth / terrace
    if (grounded) {
      addF(9.9, 9.7, 0.5, 0);
      addF(9.6, 9.25, 0.65, 0.5);
      addC(9.3, 1.15, { out: 0.42, h: 0.32 });
    } else {
      // roof-terrace base: solid corbelled block that visually carries the
      // shaft above the façade screen / roof
      addF(10.3, 9.9, 0.45, baseY);
      addF(9.9, 9.3, 0.8, baseY + 0.45);
      addC(10.5, baseY + 0.14, { out: 0.5, h: 0.34 });
      addC(9.55, baseY + 1.24, { out: 0.3, h: 0.24 });
    }

    // ----------------------------------------------------------------- shaft
    const secs = sectionsFor(start);
    for (const s of secs) addF(s.w0, s.w1, s.y1 - s.y0, s.y0);

    // slim string courses at every section joint (smooth, un-Gothic rhythm)
    for (const s of secs) {
      addC(s.w1 + 0.12, s.y1 + 0.06, { out: 0.22, h: 0.28 });
      addC(s.w1 + 0.04, s.y1 + 0.24, { out: 0.09, h: 0.12 });
    }

    // corner buttresses, continuing up as the belfry corner piers
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        add(xform(frustum4(1.35, 1.05, belfryTop - start, start), {
          x: cx + sx * 4.14,
          z: cz + sz * 4.14,
        }));
      }
    }

    // vertical ribs on every face, per shaft section (strong vertical rhythm)
    for (const face of FACES4) {
      for (const s of secs) {
        const halfW = (s.w0 + s.w1) / 4;
        const h = s.y1 - s.y0;
        const yMid = (s.y0 + s.y1) / 2;
        for (const off of [-2.9, 0, 2.9]) {
          const tx = face.nz;
          const tz = -face.nx;
          b.add('trim', boxGeo(0.6, h, 0.52, cx + face.nx * halfW + tx * off, yMid, cz + face.nz * halfW + tz * off));
        }
        // little capital where the middle rib meets the string course
        add(boxGeo(0.9, 0.4, 0.9, cx + face.nx * halfW, s.y1 - 0.35, cz + face.nz * halfW));
      }
    }

    // --------------------------------------------------------------- windows
    // one paired-lancet row every other shaft course: a calm vertical rhythm
    for (const face of FACES4) {
      secs.forEach((s, si) => {
        if (si % 2 !== 0) return;
        const len = s.y1 - s.y0;
        const h = Math.min(6.8, len * 0.66);
        const y = s.y0 + (len - h) * 0.68;
        const halfW = profileWidth(y + h * 0.5) / 2;
        for (const off of [-1.5, 1.5]) {
          const m = faceMatrix(cx, cz, halfW, face, y, { off, extra: 0.03 });
          b.instance('winApostleStone', win.stone, mats.trim, m);
          b.instance('winApostleGlass', win.glass, mats.glass, m);
        }
      });
      // recessed ground niche, ground-standing towers only
      if (grounded) {
        const nm = faceMatrix(cx, cz, 9.25 / 2, face, 1.25, { extra: 0.03 });
        b.instance('nicheApostleStone', niche.stone, mats.trim, nm);
        b.instance('nicheApostleGlass', niche.glass, mats.glass, nm);
      }
    }

    // ---------------------------------------------------------------- belfry
    // chamfered octagonal transition at the belfry foot
    add(frustumN8(4.15, 3.95, 2.1, 73.9, cx, cz));
    addC(8.05, 74.05, { out: 0.34, h: 0.3 });
    addC(7.95, belfryY + 0.05, { out: 0.44, h: 0.42 });

    const faceW = 7.85 / 2;
    const panel = wallWithOpeningsGeo({
      width: 7.75,
      height: belfryTop - belfryY,
      depth: 0.8,
      curveSegments: 5,
      openings: [
        { x: -1.95, w: 2.55, h: 11.2, y0: 2.4 },
        { x: 1.95, w: 2.55, h: 11.2, y0: 2.4 },
        { x: 0, w: 1.55, h: 1.9, y0: 13.9 },
      ],
    });
    for (const face of FACES4) {
      const g = panel.clone();
      xform(g, {
        ry: Math.atan2(face.nx, face.nz),
        x: cx + face.nx * (faceW - 0.4),
        y: belfryY,
        z: cz + face.nz * (faceW - 0.4),
      });
      add(g);
    }
    // deep sill ring under the openings, bell beams and tubular bells
    add(boxGeo(6.2, 1.0, 6.2, cx, belfryY + 0.2, cz));
    // dark inner bell-chamber shell: gives the openings a shadowed interior so
    // the bells and spiral stair read in silhouette
    for (const face of FACES4) {
      const g = boxGeo(6.0, belfryTop - belfryY - 0.4, 0.24);
      xform(g, {
        ry: Math.atan2(face.nx, face.nz),
        x: cx + face.nx * 2.98,
        y: (belfryY + belfryTop) / 2,
        z: cz + face.nz * 2.98,
      });
      b.add('dark', g);
    }
    add(boxGeo(6.8, 0.32, 0.55, cx, 88.5, cz));
    add(boxGeo(0.55, 0.32, 5.0, cx, 87.0, cz));
    const bellY = 85.7;
    for (const [sx, sz, rot] of [
      [-1.75, 0, 0.12],
      [1.75, 0, -0.1],
      [0, -1.55, 0.4],
    ]) {
      const bellG = bells.bellGeo.clone();
      xform(bellG, { ry: rot, x: cx + sx, y: bellY + 0.5, z: cz + sz });
      b.add('bell', bellG);
      const clap = bells.clapperGeo.clone();
      xform(clap, { ry: rot, x: cx + sx, y: bellY + 0.5, z: cz + sz });
      b.add('bell', clap);
      const yoke = bells.yokeGeo.clone();
      xform(yoke, { ry: rot, x: cx + sx, y: bellY + 0.5, z: cz + sz });
      b.add('wood', yoke);
    }
    // spiral stair inside the bell chamber (visible through the openings)
    const stair = spiralStairGeo({ radius: 1.28, turns: 2.2, height: 14.4, steps: 30 });
    xform(stair, { x: cx, y: belfryY + 0.5, z: cz });
    add(stair);

    // belfry crown cornice + balustrade
    addC(8.3, belfryTop, { out: 0.55, h: 0.45 });
    balustradeSquare(b, mats, { cx, cz, halfW: 3.86, y: belfryTop + 0.22, spacing: 1.95, height: 0.85 });

    // corner pinnacles (instanced, shared geometry)
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const m = matrixAt(cx + sx * 4.02, belfryTop + 0.2, cz + sz * 4.02, { ry: Math.PI / 4 });
        b.instance('pinnacle', pinnGeo, mats.trim, m, { castShadow: true });
      }
    }

    // ----------------------------------------------------- needle spire crown
    const crownY = belfryTop + 0.55;
    const crownTop = H - 1.0;
    const crownH = crownTop - crownY;
    add(frustumN8(3.25, 1.15, crownH, crownY, cx, cz));
    // eight ribs riding the taper (segmented so they follow the core)
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      const nx = Math.sin(a);
      const nz = Math.cos(a);
      for (let si = 0; si < 4; si++) {
        const tMid = (si + 0.5) / 4;
        const rr = 3.25 + (1.15 - 3.25) * tMid + 0.18;
        const g = boxGeo(0.34, (crownH / 4) * 1.04, 0.44);
        xform(g, { ry: a, x: cx + nx * rr, y: crownY + crownH * tMid, z: cz + nz * rr });
        b.add('trim', g);
      }
    }
    // collars
    for (const tRel of [0.34, 0.62]) {
      const rr = 3.25 + (1.15 - 3.25) * tRel;
      add(xform(new THREE.CylinderGeometry(rr * 1.1, rr * 1.1, 0.3, 8), {
        ry: Math.PI / 8,
        x: cx,
        y: crownY + crownH * tRel,
        z: cz,
      }));
    }
    // needle: thin shaft from crown tip to the finial fruit
    const ballR = DIM.towerFinialBallR * 1.18;
    const ballY = F - 0.62 - ballR * 1.07;
    const needleTop = ballY - ballR * 0.5;
    const needleBottom = crownTop - 0.2;
    if (needleTop > needleBottom) {
      const nat = new THREE.CylinderGeometry(0.28, 0.82, needleTop - needleBottom, 8);
      xform(nat, { ry: Math.PI / 8, x: cx, y: (needleTop + needleBottom) / 2, z: cz });
      add(nat);
    }
    // bulbous, ribbed fruit finial with collar and gold tip
    const fruit = fruitGeo(ballR);
    xform(fruit, { x: cx, y: ballY - ballR * 1.06, z: cz });
    add(fruit);
    add(xform(torusGeo(ballR * 0.62, 0.14, 14, 6), { rx: Math.PI / 2, x: cx, y: ballY - ballR * 0.95, z: cz }));
    add(xform(torusGeo(ballR * 0.45, 0.1, 12, 5), { rx: Math.PI / 2, x: cx, y: ballY + ballR * 0.9, z: cz }));
    // small gold cross on the fruit
    b.add('gold', xform(crossGeo({ arm: 0.5, thickness: 0.16, depth: 0.16 }), { x: cx, y: F - 0.55, z: cz }));
  });
}

/** Ribbed fruit-like finial (lathe with scalloped profile), base at y=0. */
function fruitGeo(R) {
  const pts = [];
  const N = 18;
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const a = t * Math.PI;
    let rad = Math.sin(a) * R;
    rad *= 1 + 0.05 * Math.sin(a * 7.5);
    pts.push([Math.max(0.015, rad), R * 1.06 * (1 - Math.cos(a))]);
  }
  return latheGeo(pts, 16);
}

/** Octagonal frustum centred at (cx, cz) — local helper for spire crowns. */
function frustumN8(rBottom, rTop, h, y0, cx, cz) {
  const g = new THREE.CylinderGeometry(rTop, rBottom, h, 8, 1, false);
  g.rotateY(-Math.PI / 8);
  g.translate(cx, y0 + h / 2, cz);
  const flat = g.toNonIndexed();
  flat.computeVertexNormals();
  scaleUV(flat, Math.max(0.7, rBottom * 2.4), Math.max(0.7, h / 3.2));
  return flat;
}
