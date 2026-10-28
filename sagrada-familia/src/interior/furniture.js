// Furniture: pews toward the rear leaving a 6 m central aisle, hymn boards,
// and the organ gallery above the Glory door with bronze pipe arrays, wooden
// case, choir stalls and balustrade.

import {
  THREE,
  xform,
  boxGeo,
  cylGeo,
  sphereGeo,
  coneGeo,
  torusGeo,
  latheGeo,
  mergeGeos,
  instancedMesh,
  matrixAt,
  textTexture,
  circleCollider,
  boxCollider,
  rng,
  rand,
} from '../lib.js';
import { bucket, DIM, ringBand, octPlinth, capitalGeo, bossGeo, downCone } from './common.js';

function textPlate(text) {
  const tex = textTexture(text, {
    font: '600 52px Georgia, "Times New Roman", serif',
    color: '#f0e2be',
    pad: 20,
    letterSpacing: 4,
  });
  return new THREE.MeshBasicMaterial({
    map: tex,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
}

// ---------------------------------------------------------------------------
// Pews
// ---------------------------------------------------------------------------

function pewGeo() {
  const parts = [];
  parts.push(boxGeo(3.5, 0.09, 0.42, 0, 0.45, 0)); // seat
  parts.push(boxGeo(3.5, 0.62, 0.07, 0, 0.76, 0.26)); // back
  parts.push(boxGeo(3.54, 0.08, 0.12, 0, 1.06, 0.28)); // top rail
  parts.push(boxGeo(3.3, 0.08, 0.18, 0, 0.1, -0.3)); // kneeler
  parts.push(boxGeo(3.3, 0.05, 0.1, 0, 0.24, -0.34));
  for (const sx of [-1.55, 1.55]) {
    parts.push(boxGeo(0.09, 0.45, 0.55, sx, 0.22, 0.02)); // end panels
    parts.push(boxGeo(0.09, 0.9, 0.07, sx, 0.45, 0.26));
  }
  parts.push(boxGeo(3.3, 0.06, 0.06, 0, 0.72, 0.16)); // book ledge
  parts.push(boxGeo(0.5, 0.05, 0.32, 0, 0.76, 0.19)); // hymnal
  parts.push(boxGeo(0.5, 0.04, 0.32, 0, 0.79, 0.19));
  return mergeGeos(parts);
}

export function buildFurniture(parent, mats, out) {
  const b = bucket();
  const rnd = rng(818);

  // --------------------------------------------------------------- pew rows
  const pew = pewGeo();
  const rows = [];
  for (let z = 17.6; z <= 43.4; z += 2.3) rows.push(z);
  for (const z of rows) {
    for (const sx of [-1, 1]) {
      const x = sx * 4.5;
      // clone: xform mutates, and the same pew geometry is reused for every row
      b.add('woodDark', xform(pew.clone(), { x, z, sx: 0.86 }));
      b.add('gold', xform(boxGeo(0.12, 0.16, 0.1, x - 1.35, 0.4, z - 0.34)));
      out.colliders.push(boxCollider(x, z, 1.55, 0.44, { y0: 0, y1: 1.1 }));
    }
  }

  // --------------------------------------------------------------- hymn boards
  const plates = [textPlate('HYMN'), textPlate('GLORIA')];
  let pi = 0;
  for (const [x, z, ry] of [
    [5.4, 16.0, 0.12],
    [-5.4, 16.0, -0.12],
    [5.4, 44.2, Math.PI + 0.12],
    [-5.4, 44.2, Math.PI - 0.12],
  ]) {
    b.add('woodDark', xform(boxGeo(0.09, 1.25, 0.09, x, 0.62, z)));
    b.add('wood', xform(boxGeo(0.95, 0.68, 0.06), { x, y: 1.38, z: z + 0.05, ry }));
    b.add('gold', xform(boxGeo(1.0, 0.05, 0.09), { x, y: 1.72, z: z + 0.05, ry }));
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.86, 0.42), plates[pi++ % 2]);
    plate.position.set(x + Math.sin(ry) * 0.05, 1.38, z + 0.05 + Math.cos(ry) * 0.05);
    plate.rotation.set(-0.12, ry, 0, 'YXZ');
    plate.renderOrder = 2;
    parent.add(plate);
  }

  // ------------------------------------------------------------ organ gallery
  const GY = 12.0; // gallery deck level
  // two stone supports, set against the aisle wall clear of the chapel at z=42
  for (const sx of [-1, 1]) {
    const x = sx * 12.2;
    b.add('stone', xform(octPlinth(1.15, 0.85), { x, z: 37.6 }));
    b.add('stone', xform(new THREE.CylinderGeometry(0.82, 0.9, 10.2, 12), { x, y: 5.9, z: 37.6 }));
    b.add('stoneLight', xform(ringBand(0.88, 8.6, 0.11, 18), { x, z: 37.6 }));
    b.add('stoneLight', xform(capitalGeo(0.9, { y: 10.95, h: 0.95 }), { x, z: 37.6 }));
    out.colliders.push(circleCollider(x, 37.6, 1.22, { y0: 0, y1: 4 }));
  }
  // deck + fascia + corbels
  b.add('stoneLight', xform(boxGeo(26.2, 0.7, 8.2, 0, GY - 0.35, 41.1)));
  b.add('marble', xform(boxGeo(26.4, 0.1, 8.4, 0, GY + 0.03, 41.1)));
  b.add('stone', xform(boxGeo(26.2, 1.5, 0.5, 0, GY - 1.2, 37.15)));
  b.add('gold', xform(boxGeo(26.4, 0.1, 0.55, 0, GY - 0.5, 37.1)));
  for (let i = -5; i <= 5; i++) {
    b.add('stone', xform(boxGeo(0.7, 1.6, 2.4, i * 2.35, GY - 1.3, 38.3)));
    b.add('stoneLight', downCone(0.5, 0.9, 4, i * 2.35, GY - 2.3, 38.8));
  }
  // balustrade
  b.add('marble', xform(boxGeo(25.6, 0.18, 0.45, 0, GY + 0.13, 37.2)));
  b.add('marble', xform(boxGeo(25.6, 0.16, 0.5, 0, GY + 1.12, 37.2)));
  for (let i = 0; i < 27; i++) {
    const x = -12.4 + i * 0.955;
    b.add('marble', xform(latheGeo([[0.075, 0], [0.1, 0.12], [0.06, 0.3], [0.085, 0.62], [0.06, 0.78], [0.09, 0.86]], 8), { x, y: GY + 0.2, z: 37.2 }));
  }
  // organ case: wooden frame against the Glory wall
  b.add('woodDark', xform(boxGeo(17.0, 8.4, 0.8, 0, GY + 4.4, 44.3)));
  for (const sx of [-1, 1]) {
    b.add('woodDark', xform(boxGeo(3.4, 9.0, 3.2, sx * 6.3, GY + 4.5, 43.0)));
    b.add('woodDark', xform(boxGeo(3.8, 0.5, 3.6, sx * 6.3, GY + 9.15, 43.0)));
    b.add('woodDark', xform(boxGeo(0.5, 9.6, 3.4, sx * 8.0, GY + 4.8, 43.0)));
    b.add('wood', xform(boxGeo(0.18, 6.2, 2.6, sx * 4.62, GY + 4.0, 43.4)));
    b.add('gold', xform(boxGeo(0.22, 0.3, 2.8, sx * 4.6, GY + 7.2, 43.4)));
  }
  b.add('woodDark', xform(boxGeo(9.0, 3.2, 1.0, 0, GY + 2.0, 44.2)));
  b.add('gold', xform(boxGeo(9.2, 0.22, 1.1, 0, GY + 3.5, 44.2)));
  // console
  b.add('wood', xform(boxGeo(3.0, 1.1, 1.4, 0, GY + 0.6, 43.2)));
  b.add('woodDark', xform(boxGeo(2.7, 0.16, 1.0, 0, GY + 1.1, 43.2)));
  b.add('ivory' in mats ? 'ivory' : 'cloth', xform(boxGeo(2.5, 0.06, 0.3, 0, GY + 1.2, 43.2)));
  b.add('brass' in mats ? 'brass' : 'bronze', xform(boxGeo(2.5, 0.05, 0.28, 0, GY + 1.24, 43.15)));

  // ------------------------------------------------------------ organ pipes
  const pipeGeo = new THREE.CylinderGeometry(1, 1, 1, 8, 1, false);
  const pipeMats = [];
  const groups = [
    { x0: -7.4, x1: -3.4, n: 13, hMax: 7.6 },
    { x0: -2.6, x1: 2.6, n: 15, hMax: 8.6 },
    { x0: 3.4, x1: 7.4, n: 13, hMax: 7.6 },
  ];
  for (const g of groups) {
    for (let i = 0; i < g.n; i++) {
      const t = g.n === 1 ? 0.5 : i / (g.n - 1);
      const x = g.x0 + (g.x1 - g.x0) * t;
      const h = 2.4 + g.hMax * Math.pow(Math.sin((0.16 + 0.68 * t) * Math.PI), 0.85);
      const r = 0.1 + 0.075 * (1 - Math.abs(t - 0.5) * 2) + 0.02 * (i % 3);
      pipeMats.push(matrixAt(x, GY + h / 2, 43.0, { sx: r, sy: h, sz: r }));
    }
  }
  const pipes = instancedMesh(pipeGeo, mats.bronze, pipeMats, { castShadow: false, receiveShadow: false });
  if (pipes) parent.add(pipes);

  // ------------------------------------------------------------ choir stalls
  for (const sx of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      const x = sx * 10.6;
      const z = 38.6 + i * 1.6;
      b.add('woodDark', xform(boxGeo(1.5, 0.1, 1.1, x, GY + 0.42, z)));
      b.add('woodDark', xform(boxGeo(1.55, 0.95, 0.12, x + sx * 0.72, GY + 0.9, z)));
      b.add('wood', xform(boxGeo(1.3, 0.09, 0.42, x, GY + 0.98, z - sx * 0.55)));
      b.add('cloth', xform(boxGeo(1.3, 0.12, 0.55, x, GY + 0.53, z)));
    }
    // desk rail (clear of the gallery support at z = 37.6)
    b.add('wood', xform(boxGeo(0.12, 0.1, 4.2, sx * 11.6, GY + 1.0, 40.7)));
  }

  // A second, small organ case at the crossing's north side is left to the
  // sanctuary's own composition; the gallery instrument is the main one.

  b.flush(parent, mats, { castShadow: true, receiveShadow: true });
  return { rows: rows.length };
}
