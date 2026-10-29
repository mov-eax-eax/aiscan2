import * as THREE from 'three';
import { DIM } from './config.js';
import { halfWidth, levels } from './profile.js';
import { addFaceLattice, V } from './beam.js';
import { perimeterPoint } from './frame.js';
import { deckGeometry, railing, pavilion } from './platforms.js';

const _v = new THREE.Vector3();

/**
 * The summit: the 276.13 m platform (about 250 m²), the campanile that rises
 * to 300.65 m, the glassed-in top room, Gustave Eiffel's little apartment and
 * the antenna mast that brings the tower to 330 m — the highest structure in
 * France.  Eight mullions carry the campanile, four carry the mast.
 */
export function addSummit(ctx) {
  const { main, fine, detail, glass, group, materials } = ctx;

  /* ---------------- summit deck, 276.13 m ---------------- */
  const half = DIM.deck3Side / 2;
  const deck = new THREE.Mesh(deckGeometry(half, 1.6, 0.5), materials.deck);
  deck.position.y = DIM.h3 - 0.5;
  deck.castShadow = true;
  deck.receiveShadow = true;
  deck.name = 'deck-3';
  group.add(deck);

  const glassPanel = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 3.2), materials.glass);
  glassPanel.rotation.x = -Math.PI / 2;
  glassPanel.position.y = DIM.h3 + 0.02;
  glassPanel.name = 'glass-floor-3';
  group.add(glassPanel);

  railing(detail, half - 0.28, DIM.h3 + 0.04, 0.95, 1.05);

  // radial brackets under the deck
  for (let e = 0; e < 4; e++) {
    const horiz = e % 2 === 0;
    const sgn = e < 2 ? 1 : -1;
    for (let u = -half + 1.6; u < half; u += 3.2) {
      const w = halfWidth(DIM.h3 - 0.8);
      const outer = horiz ? V(sgn * half, DIM.h3 - 0.3, u) : V(u, DIM.h3 - 0.3, sgn * half);
      const inner = horiz ? V(sgn * w, DIM.h3 - 0.3, u) : V(u, DIM.h3 - 0.3, sgn * w);
      const foot = horiz ? V(sgn * w, DIM.h3 - 1.6, u * 0.85) : V(u * 0.85, DIM.h3 - 1.6, sgn * w);
      main.beamV(outer, inner, 0.2);
      main.beamV(outer, foot, 0.16);
    }
  }

  /* ---------------- campanile : 276.13 → 300.65 m ---------------- */
  {
    const NP = 8;
    const yl = levels(DIM.h3, DIM.roof, 1.5);
    const rows = yl.map((y) => {
      const row = [];
      for (let k = 0; k < NP; k++) row.push(perimeterPoint(V(), k / NP, y));
      return row;
    });
    const tMain = 0.24;
    const tFine = 0.085;
    for (let k = 0; k < NP; k++) {
      for (let i = 0; i < yl.length - 1; i++) main.beamV(rows[i][k], rows[i + 1][k], 0.3);
    }
    for (let i = 0; i < yl.length; i++) {
      for (let k = 0; k < NP; k++) main.beamV(rows[i][k], rows[i][(k + 1) % NP], 0.18);
    }
    for (let i = 0; i < yl.length - 1; i++) {
      for (let k = 0; k < NP; k++) {
        addFaceLattice(main, fine, rows[i][k], rows[i][(k + 1) % NP], rows[i + 1][(k + 1) % NP], rows[i + 1][k], {
          mainT: tMain,
          fineT: tFine,
          sub: 2,
        });
      }
    }

    // the glassed-in upper room
    const roomMid = DIM.h3 + 8.5;
    const roomH = 4.2;
    glass.box(0, roomMid, 0, 6.6, roomH, 6.6, 0, new THREE.Color(0x1b2027));
    materialiseRoom(ctx, roomMid, roomH);

    // Eiffel's apartment on the platform
    pavilion(ctx, 4.4, DIM.h3 + 0.06, 4.4, 3.6, 2.9, 3.2, Math.PI / 4);
  }

  /* ---------------- antenna mast : 300.65 → 330 m ---------------- */
  {
    const yl = [];
    for (let y = DIM.roof; y < DIM.tip - 0.01; y += 1.4) yl.push(y);
    yl.push(DIM.tip);
    const mastHalf = (y) => {
      const t = (y - DIM.roof) / (DIM.tip - DIM.roof);
      return 1.55 - 1.15 * t;
    };
    const rows = yl.map((y) => {
      const w = mastHalf(y);
      return [V(w, y, w), V(w, y, -w), V(-w, y, -w), V(-w, y, w)];
    });
    for (let k = 0; k < 4; k++) {
      for (let i = 0; i < yl.length - 1; i++) {
        main.beamV(rows[i][k], rows[i + 1][k], 0.16 - 0.06 * (i / yl.length));
      }
    }
    for (let i = 0; i < yl.length; i++) {
      for (let k = 0; k < 4; k++) main.beamV(rows[i][k], rows[i][(k + 1) % 4], 0.09);
    }
    for (let i = 0; i < yl.length - 1; i++) {
      for (let k = 0; k < 4; k++) {
        main.beamV(rows[i][k], rows[i + 1][(k + 1) % 4], 0.06);
        main.beamV(rows[i][(k + 1) % 4], rows[i + 1][k], 0.06);
      }
    }

    // antenna tiers: horizontal booms with dipoles
    const tiers = [303.6, 309.5, 316.5, 322.5];
    const boomLen = [2.9, 2.6, 2.3, 1.9];
    tiers.forEach((y, ti) => {
      const w = mastHalf(y);
      detail.box(0, y, 0, 0.4, 0.4, 0.4, 0);
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const len = boomLen[ti];
        detail.beam(dx * w, y, dz * w, dx * (w + len), y, dz * (w + len), 0.07);
        detail.box(dx * (w + len), y, dz * (w + len), 0.5, 0.5, 0.5, 0, new THREE.Color(0xbfc3c7));
      }
    });

    // two microwave dishes
    for (const [y, yaw, r] of [[296.5, 0.5, 1.5], [305.5, 2.4, 1.1]]) {
      const dish = new THREE.Mesh(
        new THREE.CylinderGeometry(r, r * 0.86, 0.35, 18, 1, false),
        materials.dish,
      );
      const w = halfWidth(Math.min(y, DIM.roof)) + 0.4;
      dish.position.set(Math.cos(yaw) * w, y, Math.sin(yaw) * w);
      dish.lookAt(new THREE.Vector3(Math.cos(yaw) * 40, y - 12, Math.sin(yaw) * 40));
      dish.rotateX(Math.PI / 2);
      dish.castShadow = true;
      group.add(dish);
    }
  }
}

function materialiseRoom(ctx, y, h) {
  const { detail } = ctx;
  for (const dy of [-h / 2, h / 2]) {
    for (const [dx, dz] of [[1, 1], [1, -1]]) {
      detail.beam(dx * 3.4, y + dy, -3.4, dx * 3.4, y + dy, 3.4, 0.16);
      detail.beam(-3.4, y + dy, dz * 3.4, 3.4, y + dy, dz * 3.4, 0.16);
    }
  }
}
