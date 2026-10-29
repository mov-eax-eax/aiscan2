import * as THREE from 'three';
import { DIM } from './config.js';
import { legHalf, legCentre, levelChain, thickness } from './profile.js';
import { addFaceLattice, latticeCells, V } from './beam.js';
import { LEGS, legPoint, legCentrePoint, legLateral } from './frame.js';

const CORNER_SIGNS = [
  [-1, -1],
  [1, -1],
  [1, 1],
  [-1, 1],
];

/**
 * The four pillars.
 *
 * Each pillar is a tapering lattice box built of four main chord members
 * (the "arbalétriers"), horizontal frames at every panel and St Andrew's
 * crosses with a finer diagonal web in every panel face — plus the inner core
 * that holds the spiral staircase (674 steps to the 2nd floor, exactly the
 * real number) and the inclined lift rails.
 */
export function addLegs(ctx) {
  const { main, fine, detail } = ctx;
  const yl = levelChain([
    [0, DIM.h1, 2.45],
    [DIM.h1, DIM.h2, 2.7],
  ]);

  const liftPaths = [];

  for (const leg of LEGS) {
    const { sx, sz } = leg;

    // ---- corners of the pillar at every level -----------------------------
    const ring = [];
    for (let i = 0; i < yl.length; i++) {
      const y = yl[i];
      const pts = CORNER_SIGNS.map(([dx, dz]) => legPoint(V(), sx, sz, dx, dz, y));
      ring.push(pts);
    }

    // ---- chords -----------------------------------------------------------
    for (let c = 0; c < 4; c++) {
      for (let i = 0; i < yl.length - 1; i++) {
        main.beamV(ring[i][c], ring[i + 1][c], thickness.chord(yl[i]));
      }
    }

    // ---- horizontal frames + panel lattices -------------------------------
    for (let i = 0; i < yl.length; i++) {
      const y = yl[i];
      const tr = thickness.ring(y);
      for (let c = 0; c < 4; c++) main.beamV(ring[i][c], ring[i][(c + 1) % 4], tr);
    }

    for (let i = 0; i < yl.length - 1; i++) {
      const y = yl[i];
      const tm = thickness.main(y);
      const tf = thickness.fine(y);
      const cells = latticeCells(2 * legHalf(y), yl[i + 1] - y, y < DIM.h1 ? 3.2 : 3.6);
      for (let c = 0; c < 4; c++) {
        const a = ring[i][c];
        const b = ring[i][(c + 1) % 4];
        const a2 = ring[i + 1][c];
        const b2 = ring[i + 1][(c + 1) % 4];
        addFaceLattice(main, fine, a, b, b2, a2, { mainT: tm, fineT: tf, ...cells });
      }
    }

    // ---- inner core (stair / lift shaft) ----------------------------------
    const corePts = [];
    for (let i = 0; i < yl.length; i++) {
      const y = yl[i];
      const lh = legHalf(y) * 0.62;
      const c = legCentre(y);
      corePts.push(
        CORNER_SIGNS.map(([dx, dz]) => V(sx * (c + dx * lh), y, sz * (c + dz * lh))),
      );
    }
    for (let c = 0; c < 4; c++) {
      for (let i = 0; i < yl.length - 1; i++) {
        main.beamV(corePts[i][c], corePts[i + 1][c], thickness.main(yl[i]) * 0.55);
      }
    }
    for (let i = 0; i < yl.length; i += 2) {
      const t = thickness.main(yl[i]) * 0.45;
      for (let c = 0; c < 4; c++) main.beamV(corePts[i][c], corePts[i][(c + 1) % 4], t);
    }

    // ---- spiral staircase (674 steps per pillar, 0.1717 m rise) -----------
    const rise = DIM.h2 / DIM.stepsTo2nd;
    const perTurn = 26;
    const centre = V();
    for (let s = 0; s < DIM.stepsTo2nd; s++) {
      const y = 1.4 + s * rise;
      if (y > DIM.h2 - 1.2) break;
      const lh = legHalf(y);
      const r = Math.max(0.55, lh * 0.42);
      const a = (s / perTurn) * Math.PI * 2;
      legCentrePoint(centre, sx, sz, y);
      const st = centre.clone();
      st.x += Math.cos(a) * r;
      st.z += Math.sin(a) * r;
      detail.box(st.x, st.y, st.z, 0.9, 0.05, 0.34, -a + Math.PI / 2);
    }

    // hand rail following the helix, every ~1.3 m of rise
    const rail = [];
    for (let y = 1.6; y < DIM.h2 - 1.2; y += 1.3) {
      const lh = legHalf(y);
      const r = Math.max(0.55, lh * 0.42) + 0.46;
      const a = ((y - 1.4) / rise / perTurn) * Math.PI * 2;
      legCentrePoint(centre, sx, sz, y);
      rail.push(V(centre.x + Math.cos(a) * r, y + 0.95, centre.z + Math.sin(a) * r));
    }
    detail.polyline(rail, 0.09);

    // ---- inclined lift rails + ties ---------------------------------------
    const lat = legLateral(V(), sx, sz);
    const rails = [-1, 1].map((side) => {
      const pts = [];
      for (let i = 0; i < yl.length; i++) {
        const y = yl[i];
        legCentrePoint(centre, sx, sz, y);
        pts.push(V(centre.x + lat.x * side * 0.78, y, centre.z + lat.z * side * 0.78));
      }
      return pts;
    });
    for (const pts of rails) detail.polyline(pts, 0.26);
    for (let i = 2; i < yl.length - 1; i += 3) {
      detail.beamV(rails[0][i], rails[1][i], 0.14);
    }

    liftPaths.push({ sx, sz, y0: 2.2, y1: DIM.h2 - 3.0 });
  }

  return liftPaths;
}
