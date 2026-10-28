// Interior floor: nave, transept, apse, apse chapels and door thresholds.
// Pale stone with dark aisle borders, mosaic inlays, a large geometric mosaic
// at the crossing, brass grilles and stone thresholds. Walkable meshes are
// returned separately so the experience can raycast against them.

import {
  THREE,
  boxGeo,
  cylGeo,
  torusGeo,
  xform,
  scaleUV,
  rng,
  rand,
} from '../lib.js';
import { bucket, DIM, PALETTE, flatStar, bossGeo, gridSurface } from './common.js';

function rectFloor(w, d, cx, cz, tile = 2.7, y = 0) {
  const g = new THREE.PlaneGeometry(w, d);
  scaleUV(g, w / tile, d / tile);
  g.rotateX(-Math.PI / 2);
  g.translate(cx, y, cz);
  return g;
}

/** Flat sector of annulus between radii r0..r1, angles a0..a1. */
function sectorFloor(cx, cz, r0, r1, a0, a1, y = 0, tile = 2.7) {
  const g = gridSurface(10, 4, (u, v) => {
    const a = a0 + (a1 - a0) * u;
    const r = r0 + (r1 - r0) * v;
    return [cx + Math.cos(a) * r, y, cz - Math.sin(a) * r];
  }, { uv: [(a1 - a0) * r1 / tile, (r1 - r0) / tile] });
  return g;
}

export function buildFloor(parent, mats, out) {
  const b = bucket();
  const overlay = bucket();

  // ---------------------------------------------------------------- main floor
  // The nave slab covers the full 30 m width and its whole length; the
  // transept arms are added either side so nothing overlaps coplanar.
  b.add('floor', rectFloor(30, 90, 0, 0));
  b.add('floor', rectFloor(15, 30, 22.5, 0));
  b.add('floor', rectFloor(15, 30, -22.5, 0));
  // Apse semicircle (north of z = -45).
  {
    const g = new THREE.CircleGeometry(DIM.apseRadius, 44, 0, Math.PI);
    scaleUV(g, (DIM.apseRadius * 2) / 2.7, (DIM.apseRadius * 2) / 2.7);
    g.rotateX(-Math.PI / 2);
    g.translate(0, 0, DIM.apseCenterZ);
    b.add('floor', g);
  }
  // Apse chapel zone: a half-annulus that fills the seven radial chapels
  // continuously (no gaps between the chapel platforms). Nudged 1 cm below the
  // apse disc so the thin overlapping band cannot z-fight.
  {
    const ring = new THREE.RingGeometry(14.9, 21.4, 52, 4, 0, Math.PI);
    scaleUV(ring, 14, 14);
    ring.rotateX(-Math.PI / 2);
    ring.translate(0, -0.01, DIM.apseCenterZ);
    b.add('floor', ring);
  }
  const chapelAngles = [];

  const floorMeshes = b.flush(parent, mats, { castShadow: false, receiveShadow: true });
  out.walkables.push(...floorMeshes);

  // ------------------------------------------------------------ mosaic inlays
  // Crossing medallion: a great twelve-pointed star in trencadis, ringed with
  // dark stone and gold diamonds.
  overlay.add('mosaicGold', xform(flatStar(12, 7.3, 3.15, 0.018), { y: 0.014 }));
  {
    const ring = new THREE.RingGeometry(7.75, 8.65, 56);
    ring.rotateX(-Math.PI / 2);
    ring.translate(0, 0.02, 0);
    overlay.add('mosaic', ring);
  }
  {
    const ring2 = new THREE.RingGeometry(8.72, 8.95, 56);
    ring2.rotateX(-Math.PI / 2);
    ring2.translate(0, 0.024, 0);
    overlay.add('ribDark', ring2);
  }
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2 + Math.PI / 32;
    const g = boxGeo(0.55, 0.032, 0.55, Math.cos(a) * 9.35, 0.024, Math.sin(a) * 9.35, -a);
    overlay.add('gold', g);
  }
  // central brass compass boss
  overlay.add('bronze', xform(new THREE.CylinderGeometry(0.95, 1.05, 0.05, 24), { y: 0.032 }));
  overlay.add('gold', xform(new THREE.CylinderGeometry(0.62, 0.7, 0.04, 20), { y: 0.055 }));

  // Aisle and nave borders: dark stone strips and narrow mosaic bands.
  const strip = (w, d, cx, cz, mat = 'ribDark', y = 0.018) =>
    overlay.add(mat, boxGeo(w, 0.026, d, cx, y, cz));
  for (const sx of [-1, 1]) {
    // central processional aisle border
    strip(0.42, 86, sx * 3.55, 0);
    overlay.add('mosaic', boxGeo(0.26, 0.024, 86, sx * 3.92, 0.022, 0));
    // arcade line
    strip(0.4, 88, sx * 7.5, 0);
    // aisle / chapel border
    strip(0.4, 88, sx * 12.9, 0);
  }
  // Transverse band lines at the nave bay divisions.
  for (const z of [-36, -24, -12, 12, 24, 36]) strip(30, 0.38, 0, z);
  for (const x of [-24, -12, 12, 24]) strip(0.38, 30, x, 0);
  // Transept side-aisle borders (only across the transept arms, not the crossing).
  for (const sz of [-1, 1]) {
    for (const sx of [-1, 1]) {
      strip(15, 0.36, sx * 22.5, sz * 7.5);
      strip(15, 0.36, sx * 22.5, sz * 12.9);
    }
  }

  // Brass grilles / floor drains under the aisle edges.
  for (const sx of [-1, 1]) {
    for (const z of [-30, -18, 18, 30]) {
      overlay.add('iron', boxGeo(0.72, 0.05, 0.72, sx * 6.6, 0.03, z));
      for (let i = 0; i < 5; i++) {
        overlay.add('bronze', boxGeo(0.62, 0.02, 0.06, sx * 6.6, 0.058, z - 0.26 + i * 0.13));
      }
    }
  }

  // ---------------------------------------------------------------- thresholds
  // Stone thresholds run right through each doorway (wall + reveal) so there is
  // no gap in the floor between the nave and the plaza outside.
  const th = bucket();
  const threshold = (w, d, cx, cz, ry = 0) => {
    const tx = { x: cx, z: cz, ry };
    th.add('marble', xform(boxGeo(w, 0.08, d, 0, 0.04, 0), tx));
    th.add('bronze', xform(boxGeo(w * 0.94, 0.02, d * 0.1, 0, 0.085, d * 0.08), tx));
    th.add('mosaic', xform(boxGeo(w * 0.88, 0.02, d * 0.12, 0, 0.084, -d * 0.34), tx));
  };
  // Glory façade (wall at z = 45..46.6)
  threshold(10.4, 3.4, 0, 45.0);
  threshold(6.2, 3.2, 12.0, 45.0);
  threshold(6.2, 3.2, -12.0, 45.0);
  // Nativity and Passion portals (walls at |x| = 30..31.6)
  for (const sx of [-1, 1]) {
    const x = sx * 30.3;
    threshold(9.0, 3.4, x, 0, Math.PI / 2);
    threshold(5.5, 3.0, x, 12.5, Math.PI / 2);
    threshold(5.5, 3.0, x, -12.5, Math.PI / 2);
  }
  // Portal reveals: stone lining around each great doorway, on the inside face
  // of the shell, so the first metres past every door read as carved masonry.
  // Kept in their own bucket: only the flat threshold slabs may be walkable.
  const rv = bucket();
  const reveal = (w, h, cx, cz, ry, depth) => {
    const tx = { x: cx, z: cz, ry };
    for (const s of [-1, 1]) {
      rv.add('stoneLight', xform(boxGeo(0.4, h, depth, s * (w / 2 + 0.2), h / 2, 0), tx));
    }
    rv.add('stoneLight', xform(boxGeo(w + 0.8, 0.5, depth, 0, h + 0.25, 0), tx));
    rv.add('gold', xform(boxGeo(w + 0.2, 0.1, depth * 0.5, 0, h + 0.02, 0), tx));
    rv.add('marble', xform(boxGeo(w + 0.9, 0.2, depth + 0.5, 0, -0.09, 0), tx));
  };
  reveal(10.0, 22.0, 0, 45.75, 0, 1.9); // Glory main portal
  reveal(6.0, 15.0, 12.0, 45.75, 0, 1.7);
  reveal(6.0, 15.0, -12.0, 45.75, 0, 1.7);
  for (const sx of [-1, 1]) {
    reveal(9.0, 18.0, sx * 30.75, 0, Math.PI / 2, 1.9); // Nativity / Passion main
    reveal(5.5, 13.0, sx * 30.75, 12.5, Math.PI / 2, 1.7);
    reveal(5.5, 13.0, sx * 30.75, -12.5, Math.PI / 2, 1.7);
  }
  rv.flush(parent, mats, { castShadow: false, receiveShadow: true });
  const thMeshes = th.flush(parent, mats, { castShadow: false, receiveShadow: true, name: 'thresholds' });
  // Threshold tops are above the floor: include them as walkables so the player
  // rises over the step instead of floating through it.
  out.walkables.push(...thMeshes);

  // Subtle wear: dark, soft patches where centuries of feet would pass — the
  // processional axis, the doorways and the crossing.
  const wearSpot = (x, z, r) =>
    overlay.add('wear', xform(new THREE.CircleGeometry(r, 18), { rx: -Math.PI / 2, x, y: 0.007, z }));
  for (const z of [-30, -18, -6, 6, 18, 30, 40]) wearSpot(0, z, 2.6 + (z % 7) * 0.12);
  for (const z of [-6, 8, 22]) {
    wearSpot(6.2, z, 1.6);
    wearSpot(-6.2, z, 1.6);
  }
  wearSpot(0, 0, 9.5);
  wearSpot(0, 42.5, 4.2);

  const overlayMeshes = overlay.flush(parent, mats, { castShadow: false, receiveShadow: true });
  overlayMeshes.forEach((m) => {
    m.receiveShadow = true;
    m.renderOrder = 1;
  });

  return { chapelAngles };
}
