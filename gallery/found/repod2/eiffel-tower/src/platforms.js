import * as THREE from 'three';
import { DIM } from './config.js';
import { halfWidth, legCentre, legHalf } from './profile.js';
import { BeamBuilder, V } from './beam.js';
import { FACE_ROT, facePoint } from './frame.js';

const DECK = new THREE.Color(0x8d7f6a);
const DARK = new THREE.Color(0x171a20);

export function deckGeometry(half, holeHalf, thickness) {
  const shape = new THREE.Shape();
  shape.moveTo(-half, -half);
  shape.lineTo(half, -half);
  shape.lineTo(half, half);
  shape.lineTo(-half, half);
  shape.closePath();
  if (holeHalf > 0.01) {
    const p = new THREE.Path();
    p.moveTo(-holeHalf, -holeHalf);
    p.lineTo(-holeHalf, holeHalf);
    p.lineTo(holeHalf, holeHalf);
    p.lineTo(holeHalf, -holeHalf);
    p.closePath();
    shape.holes.push(p);
  }
  const geo = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false });
  geo.rotateX(-Math.PI / 2);
  geo.computeVertexNormals();
  return geo;
}

export function railing(b, half, y, step = 1.15, h = 1.12) {
  const corners = [
    [-half, -half],
    [half, -half],
    [half, half],
    [-half, half],
  ];
  for (let e = 0; e < 4; e++) {
    const a = corners[e];
    const c = corners[(e + 1) % 4];
    const len = Math.hypot(c[0] - a[0], c[1] - a[1]);
    const n = Math.max(1, Math.round(len / step));
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      b.box(a[0] + (c[0] - a[0]) * t, y + h / 2, a[1] + (c[1] - a[1]) * t, 0.055, h, 0.055);
    }
    b.beam(a[0], y + h, a[1], c[0], y + h, c[1], 0.085);
    b.beam(a[0], y + h * 0.5, a[1], c[0], y + h * 0.5, c[1], 0.05);
  }
}

/** Radial floor beams and knee braces under a deck. */
function underDeck(b, half, y, step = 4.2) {
  const w = halfWidth(y - 0.7);
  const depth = 1.5;
  for (let e = 0; e < 4; e++) {
    const horiz = e % 2 === 0;
    const sgn = e < 2 ? 1 : -1;
    for (let u = -half + step * 0.5; u < half; u += step) {
      const outer = horiz ? V(sgn * half, y - 0.35, u) : V(u, y - 0.35, sgn * half);
      const inner = horiz ? V(sgn * w, y - 0.35, u * (w / half)) : V(u * (w / half), y - 0.35, sgn * w);
      b.beamV(outer, inner, 0.26);
      const foot = horiz ? V(sgn * w, y - 0.35 - depth, u * 0.92) : V(u * 0.92, y - 0.35 - depth, sgn * w);
      b.beamV(outer, foot, 0.2);
    }
  }
}

/** A glazed pavilion (restaurant / shop) standing on a deck. */
export function pavilion(ctx, cx, cy, cz, w, h, d, yaw = 0) {
  const { detail, glass } = ctx;
  glass.box(cx, cy + h * 0.5, cz, w, h, d, yaw, DARK);
  detail.box(cx, cy + h + 0.18, cz, w + 0.9, 0.4, d + 0.9, yaw);
  detail.box(cx, cy + 0.12, cz, w + 0.6, 0.24, d + 0.6, yaw);
}

export function addPlatforms(ctx) {
  const { main, detail, group, materials } = ctx;

  /* ---------------- 1st floor : 57.63 m, 4,415 m² ---------------- */
  {
    const y = DIM.h1;
    const half = DIM.deck1Side / 2;
    const deck = new THREE.Mesh(deckGeometry(half, 6.2, 0.55), materials.deck);
    deck.position.y = y - 0.55;
    deck.receiveShadow = true;
    deck.castShadow = true;
    deck.name = 'deck-1';
    group.add(deck);

    // glass floor over the void in the middle
    const g = new THREE.Mesh(new THREE.PlaneGeometry(12.4, 12.4), materials.glass);
    g.rotation.x = -Math.PI / 2;
    g.position.y = y + 0.02;
    g.name = 'glass-floor-1';
    group.add(g);

    railing(detail, half - 0.35, y + 0.08);
    underDeck(main, half, y);

    // outer fascia band under the deck
    for (let e = 0; e < 4; e++) {
      const horiz = e % 2 === 0;
      const sgn = e < 2 ? 1 : -1;
      const a = horiz ? V(sgn * half, y - 1.15, -half) : V(-half, y - 1.15, sgn * half);
      const b = horiz ? V(sgn * half, y - 1.15, half) : V(half, y - 1.15, sgn * half);
      detail.beamV(a, b, 0.42);
      detail.beamV(V(a.x, y - 0.35, a.z), V(b.x, y - 0.35, b.z), 0.34);
    }

    pavilion(ctx, half - 8.5, y + 0.1, 0, 12.5, 4.2, 22);
    pavilion(ctx, -(half - 8.5), y + 0.1, 0, 12.5, 4.2, 22);
  }

  /* ---------------- 2nd floor : 115.73 m, 1,430 m² ---------------- */
  {
    const y = DIM.h2;
    const half = DIM.deck2Side / 2;
    const deck = new THREE.Mesh(deckGeometry(half, 3.4, 0.5), materials.deck);
    deck.position.y = y - 0.5;
    deck.receiveShadow = true;
    deck.castShadow = true;
    deck.name = 'deck-2';
    group.add(deck);

    const g = new THREE.Mesh(new THREE.PlaneGeometry(6.8, 6.8), materials.glass);
    g.rotation.x = -Math.PI / 2;
    g.position.y = y + 0.02;
    g.name = 'glass-floor-2';
    group.add(g);

    railing(detail, half - 0.3, y + 0.06);
    underDeck(main, half, y, 3.4);

    for (let e = 0; e < 4; e++) {
      const horiz = e % 2 === 0;
      const sgn = e < 2 ? 1 : -1;
      const a = horiz ? V(sgn * half, y - 1.0, -half) : V(-half, y - 1.0, sgn * half);
      const b = horiz ? V(sgn * half, y - 1.0, half) : V(half, y - 1.0, sgn * half);
      detail.beamV(a, b, 0.36);
    }

    // Le Jules Verne
    pavilion(ctx, -(half - 6.4), y + 0.08, 0, 10.5, 4.6, 18);
    // snack bar / boutique
    pavilion(ctx, half - 5.6, y + 0.08, 5.5, 7.5, 3.4, 9);
  }
}

/**
 * The frieze of the 72 names, engraved in 60 cm letters just under the first
 * balcony on all four faces; painted gold, as in 1889.
 */
export function addFrieze(ctx, textures) {
  const y = DIM.h1 - 1.5;
  const d = halfWidth(y) + 0.18;
  const halfSpan = legCentre(y) - legHalf(y) + 1.2;
  const height = 2.2;
  for (let f = 0; f < 4; f++) {
    const geo = new THREE.PlaneGeometry(halfSpan * 2, height);
    const map = textures ? textures[f] : null;
    const mat = map
      ? new THREE.MeshStandardMaterial({ map, roughness: 0.62, metalness: 0.4 })
      : ctx.materials.friezePlain;
    const mesh = new THREE.Mesh(geo, mat);
    const p = facePoint(V(), f, 0, y, d);
    mesh.position.copy(p);
    mesh.rotation.y = FACE_ROT[f];
    mesh.receiveShadow = true;
    mesh.name = `frieze-${f}`;
    mesh.userData.textured = !!map;
    ctx.group.add(mesh);
  }
  // small cornice above and below the band
  for (let f = 0; f < 4; f++) {
    for (const dy of [-height / 2 - 0.18, height / 2 + 0.18]) {
      const a = facePoint(new THREE.Vector3(), f, -halfSpan, y + dy, d + 0.06);
      const b = facePoint(new THREE.Vector3(), f, halfSpan, y + dy, d + 0.06);
      ctx.detail.beamV(a, b, 0.16);
    }
  }
}
