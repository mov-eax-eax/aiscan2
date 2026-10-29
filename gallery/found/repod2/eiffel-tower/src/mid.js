import * as THREE from 'three';
import { DIM } from './config.js';
import { levels, thickness } from './profile.js';
import { addFaceLattice, latticeCells, V } from './beam.js';
import { FACES, faceLanePoint } from './frame.js';

const LANES = 3;

/**
 * Between the 1st and 2nd floors the four pillars are braced together: each
 * face carries a deep lattice girder split into three lanes by vertical
 * mullions, with horizontal members at every panel and St Andrew's crosses
 * filled in by a finer diagonal web.
 */
export function addMidSection(ctx) {
  const { main, fine } = ctx;
  const yl = levels(DIM.h1 + 0.6, DIM.h2, 2.7);

  for (let f = 0; f < FACES.length; f++) {
    let prev = null;
    for (let i = 0; i < yl.length; i++) {
      const y = yl[i];
      // LANES + 1 points across the face
      const row = [];
      for (let k = 0; k <= LANES; k++) row.push(faceLanePoint(V(), f, k / LANES, y));

      const t = thickness.ring(y);
      for (let k = 0; k < LANES; k++) main.beamV(row[k], row[k + 1], t);

      if (prev) {
        const h = y - yl[i - 1];
        for (let k = 1; k < LANES; k++) main.beamV(prev.row[k], row[k], thickness.main(y) * 0.85);
        const faceW = row[0].distanceTo(row[LANES]) / LANES;
        const cells = latticeCells(faceW, h, 3.4);
        for (let k = 0; k < LANES; k++) {
          addFaceLattice(main, fine, prev.row[k], prev.row[k + 1], row[k + 1], row[k], {
            mainT: thickness.main(y),
            fineT: thickness.fine(y),
            ...cells,
          });
        }
      }
      prev = { row };
    }

    // the girder that carries the 2nd floor, at the head of the face
    const yb = DIM.h2;
    const low = [];
    const high = [];
    for (let k = 0; k <= LANES; k++) {
      high.push(faceLanePoint(V(), f, k / LANES, yb));
      low.push(faceLanePoint(V(), f, k / LANES, yb - 3.6));
    }
    for (let k = 0; k < LANES; k++) {
      main.beamV(high[k], high[k + 1], 0.52);
      main.beamV(low[k], low[k + 1], 0.52);
    }
    for (let k = 0; k <= LANES * 2; k++) {
      const t = k / (LANES * 2);
      const p = new THREE.Vector3().lerpVectors(high[0], high[LANES], t);
      const q = new THREE.Vector3().lerpVectors(low[0], low[LANES], t);
      main.beamV(p, q, 0.3);
    }
  }
}
