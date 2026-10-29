import * as THREE from 'three';
import { DIM } from './config.js';
import { halfWidth, legCentre } from './profile.js';
import { addFaceLattice, V } from './beam.js';
import { FACES, facePoint, faceChordPoint } from './frame.js';

/**
 * The four decorative arches (arcs) that link the pillars two by two.
 *
 * They are purely ornamental — the structure would stand without them — and
 * spring from the pillars at about 18 m, crowning at about 42 m.
 */
export function addArcs(ctx) {
  const { main, fine } = ctx;

  const ySpring = 18.0;
  const crown = 42.0;
  const halfSpan = legCentre(ySpring);
  const rise = crown - ySpring;

  // circle through (±halfSpan, ySpring) with apex (0, crown)
  const cy = (crown + ySpring) / 2 - (halfSpan * halfSpan) / (2 * rise);
  const R = crown - cy;
  const th = Math.asin(Math.min(1, halfSpan / R));

  const planeD = halfWidth(ySpring) - 0.9;
  const depth = 2.2; // half thickness of the arch band
  const N = 20;
  const thicknessMain = 0.42;
  const thicknessFine = 0.13;

  for (let f = 0; f < FACES.length; f++) {
    const outer = [];
    const inner = [];
    const mid = [];
    for (let i = 0; i <= N; i++) {
      const t = -th + (2 * th * i) / N;
      const u = R * Math.sin(t);
      const y = cy + R * Math.cos(t);
      const nu = Math.sin(t);
      const ny = Math.cos(t);
      outer.push(facePoint(V(), f, u + nu * depth, y + ny * depth, planeD));
      inner.push(facePoint(V(), f, u - nu * depth, y - ny * depth, planeD));
      mid.push(facePoint(V(), f, u, y, planeD));
    }

    main.polyline(outer, thicknessMain);
    main.polyline(inner, thicknessMain);
    for (let i = 0; i < N; i++) {
      addFaceLattice(main, fine, outer[i], outer[i + 1], inner[i + 1], inner[i], {
        mainT: thicknessMain * 0.62,
        fineT: thicknessFine,
        subU: 1,
        subV: 2,
        edges: false,
        cross: true,
      });
      main.beamV(mid[i], mid[i + 1], thicknessMain * 0.5);
      main.beamV(outer[i], inner[i], thicknessMain * 0.45);
    }
    // springing blocks, where the arch dies into the pillar
    for (const sgn of [-1, 1]) {
      const i = sgn < 0 ? 0 : N;
      const anchor = faceChordPoint(
        V(),
        f,
        sgn < 0 ? 0 : 1,
        ySpring,
      );
      main.beamV(outer[i], anchor, 0.5);
      main.beamV(inner[i], anchor, 0.5);
    }
  }
}
