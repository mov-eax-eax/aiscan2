import * as THREE from 'three';
import { DIM } from './config.js';
import { levels, halfWidth } from './profile.js';
import { addFaceLattice, latticeCells, V } from './beam.js';
import { perimeterPoint } from './frame.js';

const NP = 16; // vertical mullions around the shaft

/**
 * The upper shaft, from the 2nd floor (115.73 m) to the summit (276.13 m):
 * a single tapering square lattice with sixteen mullions, rings at every
 * panel, a full cross in each face panel and a fine diagonal web, plus the
 * inner core that carries the two summit lifts.
 */
export function addShaft(ctx) {
  const { main, fine, detail } = ctx;
  const yl = levels(DIM.h2, DIM.h3, 2.2);
  const n = yl.length;

  const tChord = (y) => {
    const t = clamp01((y - DIM.h2) / (DIM.h3 - DIM.h2));
    return 0.60 - 0.42 * t;
  };
  const tMain = (y) => {
    const t = clamp01((y - DIM.h2) / (DIM.h3 - DIM.h2));
    return 0.40 - 0.28 * t;
  };
  const tFine = (y) => Math.max(0.05, tMain(y) * 0.32);

  // perimeter points: rows[level][k]
  const rows = [];
  for (let i = 0; i < n; i++) {
    const row = [];
    for (let k = 0; k < NP; k++) row.push(perimeterPoint(V(), k / NP, yl[i]));
    rows.push(row);
  }

  // verticals
  for (let k = 0; k < NP; k++) {
    const corner = k % 4 === 0;
    for (let i = 0; i < n - 1; i++) {
      const t = corner ? tChord(yl[i]) : tMain(yl[i]) * 0.85;
      main.beamV(rows[i][k], rows[i + 1][k], t);
    }
  }

  // rings + face lattices
  for (let i = 0; i < n; i++) {
    const tr = tMain(yl[i]) * 0.75;
    for (let k = 0; k < NP; k++) main.beamV(rows[i][k], rows[i][(k + 1) % NP], tr);
  }
  for (let i = 0; i < n - 1; i++) {
    const tm = tMain(yl[i]);
    const tf = tFine(yl[i]);
    const h = yl[i + 1] - yl[i];
    const faceW = rows[i][0].distanceTo(rows[i][1]);
    const cells = latticeCells(faceW, h, 2.3);
    for (let k = 0; k < NP; k++) {
      addFaceLattice(main, fine, rows[i][k], rows[i][(k + 1) % NP], rows[i + 1][(k + 1) % NP], rows[i + 1][k], {
        mainT: tm,
        fineT: tf,
        ...cells,
      });
    }
  }

  // ---- inner core (lifts and the 1,665 steps of the last flight) --------
  const coreRows = [];
  for (let i = 0; i < n; i++) {
    const y = yl[i];
    const w = halfWidth(y) * 0.42;
    coreRows.push([
      V(w, y, w),
      V(w, y, -w),
      V(-w, y, -w),
      V(-w, y, w),
    ]);
  }
  const tc = (y) => Math.max(0.1, tMain(y) * 0.42);
  for (let k = 0; k < 4; k++) {
    for (let i = 0; i < n - 1; i++) main.beamV(coreRows[i][k], coreRows[i + 1][k], tc(yl[i]));
  }
  for (let i = 0; i < n; i += 2) {
    for (let k = 0; k < 4; k++) main.beamV(coreRows[i][k], coreRows[i][(k + 1) % 4], tc(yl[i]));
  }
  for (let i = 0; i + 2 < n; i += 2) {
    for (let k = 0; k < 4; k++) {
      main.beamV(coreRows[i][k], coreRows[i + 2][(k + 1) % 4], tc(yl[i]));
      main.beamV(coreRows[i][(k + 1) % 4], coreRows[i + 2][k], tc(yl[i]));
    }
  }

  // rails of the summit lifts (they run up the middle of the shaft)
  const rails = [];
  for (const side of [-1, 1]) {
    const pts = [];
    for (let i = 0; i < n; i++) {
      const w = perimeterPoint(V(), 0, yl[i]).x * 0.30;
      pts.push(V(side * w, yl[i], 0));
    }
    rails.push(pts);
  }
  detail.polyline(rails[0], 0.2);
  detail.polyline(rails[1], 0.2);
}

function clamp01(v) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}
