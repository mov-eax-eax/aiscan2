// Sagrada Família — the Glory façade (south, z = 45..46.6, x = -24..24).
//
// The largest and most public face of the temple: seven portals (three open,
// two carved blind doors plus the main portal split into three leaves), deep
// stepped archivolts, a rose window pierced through the wall, the seven
// virtues in canopied niches, angels and clouds, the Holy Spirit dove over a
// great gable, inscriptions and a crown of pinnacles.
//
// Everything here is axis-aligned: the wall plane is z = 45.8 with the outer
// face at 46.6 and local +Z = outward = world +Z.

import {
  DIM,
  PALETTE,
} from '../config.js';
import {
  THREE,
  xform,
  boxGeo,
  cylGeo,
  archPanelGeo,
  archRingGeo,
  mergeGeos,
} from '../lib.js';
import {
  archHolePoints,
  circleHolePoints,
  panelGeoWithHoles,
  tympanumGeo,
  annulusGeo,
  parabolicGableGeo,
  bandGeo,
} from './kit.js';
import { addLancet, addRose, addOculus } from './windows.js';
import {
  addPinnacle,
  addFigure,
  addNiche,
  addCloud,
  addGable,
  addArchTube,
  addInscription,
  addBird,
  addGoldBoss,
} from './ornaments.js';

const Z = 45.8; // wall centre plane
const T = DIM.facadeT; // 1.6
const FACE = Z + T / 2; // 46.6 — outer face
const WALL_H = 45;
const HW = DIM.gloryHalfWidth; // 24

const ROSE_COLORS = [
  PALETTE.glassRose[0],
  PALETTE.glassRose[4],
  PALETTE.glassRose[1],
  PALETTE.glassRose[6],
  PALETTE.glassRose[2],
  PALETTE.glassRose[5],
  PALETTE.glassWarm[3],
  PALETTE.glassWarm[5],
  PALETTE.glassRose[3],
];

export function buildGloryFacade(kit) {
  const glory = DIM.doors.glory;
  const byCoord = (c) => glory.find((d) => Math.abs(d.coord - c) < 0.01) || glory[0];
  const main = byCoord(0);
  const east = byCoord(12);
  const west = byCoord(-12);
  const decoEast = byCoord(19);
  const decoWest = byCoord(-19);

  // ------------------------------------------------------------------ wall
  const holes = [
    archHolePoints(main.coord, main.w, main.h, -1, { bow: 0.52 }),
    archHolePoints(east.coord, east.w, east.h, -1, { bow: 0.52 }),
    archHolePoints(west.coord, west.w, west.h, -1, { bow: 0.52 }),
    archHolePoints(decoEast.coord, decoEast.w, decoEast.h, -1, { bow: 0.52 }),
    archHolePoints(decoWest.coord, decoWest.w, decoWest.h, -1, { bow: 0.52 }),
    circleHolePoints(0, 30.5, 7.8, 56),
  ];
  // The panel is built in a local XY plane centred on z = 0, so it MUST be
  // moved onto the Glory façade plane (wall centre Z = 45.8 → 45.0..46.6).
  const wallPanel = panelGeoWithHoles({ x0: -HW, x1: HW, y0: -2, y1: WALL_H, depth: T, holes });
  wallPanel.translate(0, 0, Z);
  kit.add('glory', wallPanel);

  // Solid wing masses behind the outer third of the façade (§ "façade wing
  // masses"): they give the free-standing wall real body and close its back.
  for (const s of [-1, 1]) {
    const cx = s * 19.75;
    // Body starts at |x| = 15.1 so its back face is inside the nave wall
    // (no coplanar face with the interior surface at |x| = 15).
    kit.add('shell', boxGeo(9.3, 36.6, 2.0, cx, 17.85, 44.6));
    // Back-face vertical ribs.
    for (let i = -1; i <= 1; i++) {
      kit.add('aisle', boxGeo(0.5, 34, 0.4, cx + i * 2.6, 17, 43.45));
    }
    // Wing roof (sloped back over the wing mass, centred on the wing).
    kit.add(
      'roof',
      (() => {
        const span = 2.6;
        const rise = 1.7;
        const half = span / 2;
        const len = Math.hypot(half, rise) + 0.1;
        const a = Math.atan2(rise, half);
        const parts = [];
        const f = boxGeo(9.6, 0.24, len);
        xform(f, { rx: a, x: cx, y: 36 + rise / 2, z: 44.6 + half / 2 });
        parts.push(f);
        const b = boxGeo(9.6, 0.24, len);
        xform(b, { rx: -a, x: cx, y: 36 + rise / 2, z: 44.6 - half / 2 });
        parts.push(b);
        return mergeGeos(parts);
      })()
    );
    // Wing attic gable over the decorative portal.
    addGable(kit, 'glory', {
      x: s * 19.4,
      y: 45.6,
      z: 46.35,
      width: 6.6,
      height: 6.6,
      depth: 1.4,
    });
    // Crocketed edge + finial on the wing gable.
    for (let k = 0; k < 4; k++) {
      const u = 0.24 + k * 0.2;
      for (const e of [-1, 1]) {
        kit.add(
          'trim',
          boxGeo(0.26, 0.3, 1.5, s * 19.4 + e * 3.3 * (1 - u), 45.6 + 6.6 * Math.sin((u * Math.PI) / 2), 46.4)
        );
      }
    }
    addPinnacle(kit, 'trim', s * 19.4, 52.0, 46.45, { base: 0.42, height: 2.2, seed: 47 + s, goldTip: true, goldR: 0.12 });
    // Niche with a figure in the wing gable.
    addNiche(kit, {
      x: s * 19.4,
      y: 46.4,
      z: 47.0,
      w: 1.5,
      h: 2.9,
      figure: { height: 1.75, pose: 'pray', halo: true, seed: 57 + s },
      figureKey: 'trim',
      pedestal: 0.55,
    });
    // Small rose over the decorative door.
    addRose(kit, {
      frame: { x: s * 19.2, y: 23.2, z: FACE + 0.1, ry: 0 },
      radius: 2.0,
      colors: ROSE_COLORS,
      seed: 41 + s,
      petals: 10,
      region: 'rose',
    });
    // A saint in a canopied niche above the small rose.
    addNiche(kit, {
      x: s * 19.2,
      y: 29.6,
      z: FACE + 0.02,
      w: 1.9,
      h: 4.2,
      figure: { height: 2.25, pose: 'stand', halo: true, seed: 63 + s },
      figureKey: 'trim',
      pedestal: 0.68,
    });
    // Glazed oculus high on the wing.
    addOculus(kit, {
      frame: { x: s * 19.2, y: 35.9, z: FACE + 0.1, ry: 0 },
      radius: 1.5,
      colors: ROSE_COLORS,
      seed: 71 + s,
      region: 'rose',
      depth: T,
    });
    // Corner turret.
    addPinnacle(kit, 'trim', s * 23.6, 45.6, 46.0, {
      base: 1.7,
      height: 9.5,
      seed: 7 + s,
      goldTip: true,
      goldR: 0.22,
    });
    kit.add('trim', boxGeo(2.0, 1.3, 2.1, s * 23.6, 45.55, 46.0));
  }

  // ---------------------------------------------------------------- plinth
  const piers = [
    [-HW, -21],
    [-17, -15],
    [-9, -5],
    [5, 9],
    [15, 17],
    [21, HW],
  ];
  for (const [a, b] of piers) {
    const cx = (a + b) / 2;
    const w = b - a;
    // The plaza surface is at y = -0.055: sink the plinth so no gap shows.
    // Inset slightly from the opening edges so the walk stays clear.
    kit.add('aisle', bandGeo(w - 0.16, 1.8, 1.6, cx, 0.55, 46.8));
    kit.add('trim2', bandGeo(w - 0.06, 0.28, 1.8, cx, 1.47, 46.85));
    // shallow blind arcade on the plinth
    const n = Math.max(1, Math.round(w / 1.4));
    for (let i = 0; i < n; i++) {
      const x = a + ((b - a) * (i + 0.5)) / n;
      kit.add(
        'trim',
        xform(archRingGeo({ w: Math.min(1.0, (w / n) * 0.7), h: 0.85, band: 0.09, depth: 0.16, spring: 0.62, baseExtend: 0.1 }), {
          x,
          y: 0.18,
          z: 47.62,
        })
      );
    }
  }

  // ---------------------------------------------------------------- cornices
  for (const s of [-1, 1]) {
    // coping over the outer thirds of the wall top
    kit.add('glory', bandGeo(15.0, 1.0, 1.9, s * 16.9, 45.5, 46.0));
    kit.add('trim', bandGeo(15.2, 0.24, 2.1, s * 16.9, 46.1, 46.0));
  }
  // String course above the portals / below the rose.
  kit.add('trim', bandGeo(48.4, 0.55, 1.0, 0, 39.15, 46.85));
  kit.add('trim2', bandGeo(48.6, 0.22, 1.1, 0, 39.5, 46.9));
  // Main cornice with a corbel table under it.
  kit.add('trim2', bandGeo(48.8, 0.3, 1.05, 0, 44.02, 46.8));
  for (let i = 0; i < 36; i++) {
    const x = -23.32 + i * 1.33;
    kit.add('trim', boxGeo(0.52, 0.62, 0.85, x, 43.95, 46.9));
  }
  kit.add('trim', bandGeo(48.8, 0.85, 1.02, 0, 44.48, 46.85));
  kit.add('trim2', bandGeo(48.5, 0.26, 1.2, 0, 44.98, 46.9));
  kit.add('mosaic', bandGeo(48.2, 0.32, 0.2, 0, 44.72, 47.32));

  // Vertical pilasters between the portals (relief for the big wall bays).
  for (const s of [-1, 1]) {
    for (const px of [7.4, 14.1]) {
      const x = s * px;
      kit.add('trim2', boxGeo(0.72, 27.5, 0.9, x, 30.15, 46.7));
      kit.add('trim', boxGeo(1.02, 0.42, 1.15, x, 43.7, 46.75));
      kit.add('trim', boxGeo(1.02, 0.42, 1.15, x, 16.55, 46.75));
    }
  }

  // Blind arcade in the attic band of the outer bays.
  {
    const arcadeX = [8.8, 10.6, 12.4, 15.9, 17.8, 19.7, 21.6];
    for (const s of [-1, 1]) {
      for (const ax of arcadeX) {
        kit.add(
          'trim2',
          xform(
            archRingGeo({ w: 1.45, h: 2.5, band: 0.15, depth: 0.26, spring: 0.6, baseExtend: 0.2 }),
            { x: s * ax, y: 40.55, z: FACE }
          )
        );
      }
    }
  }

  // Balustrade along the wall head, between the attic and the wing gables.
  for (const s of [-1, 1]) {
    for (const [a, b] of [
      [12.0, 16.2],
      [22.6, 24.2],
    ]) {
      const x0 = s * a;
      const x1 = s * b;
      const len = Math.abs(x1 - x0);
      const cx = (x0 + x1) / 2;
      kit.add('trim', bandGeo(len, 0.22, 0.58, cx, 46.52, 46.35));
      kit.add('trim2', bandGeo(len, 0.28, 0.7, cx, 45.82, 46.35));
      const n = Math.max(1, Math.round(len / 1.15));
      for (let i = 0; i < n; i++) {
        const px = x0 + ((i + 0.5) * (x1 - x0)) / n;
        kit.add('trim', boxGeo(0.24, 0.72, 0.42, px, 46.15, 46.35));
      }
    }
  }

  // ---------------------------------------------------------------- portals
  buildPortal(kit, {
    cx: main.coord,
    w: main.w,
    h: main.h,
    rings: 3,
    band: 0.62,
    lintel: 9.4,
    open: true,
    seed: 11,
    kind: 'main',
  });
  for (const [door, side] of [
    [east, 1],
    [west, -1],
  ]) {
    buildPortal(kit, {
      cx: door.coord,
      w: door.w,
      h: door.h,
      rings: 2,
      band: 0.55,
      lintel: 6.6,
      open: true,
      seed: 21 + side * 3,
      kind: 'side',
    });
  }
  for (const [door, side] of [
    [decoEast, 1],
    [decoWest, -1],
  ]) {
    buildPortal(kit, {
      cx: door.coord,
      w: door.w,
      h: door.h,
      rings: 1,
      band: 0.46,
      lintel: 5.7,
      open: false,
      seed: 31 + side * 5,
      kind: 'blind',
    });
  }

  // -------------------------------------------------- entrance sculpture &c.
  // Colossal saints framing the doorway at eye level (pedestal + figure).
  for (const [sx, sz, seed] of [
    [-6.35, 48.4, 201],
    [6.35, 48.4, 202],
    [-22.5, 47.35, 203],
    [22.5, 47.35, 204],
  ]) {
    kit.add('trim2', boxGeo(1.4, 0.36, 1.4, sx, 0.125, sz));
    kit.add('marble', boxGeo(1.12, 1.05, 1.12, sx, 0.83, sz));
    kit.add('trim', boxGeo(1.34, 0.16, 1.34, sx, 1.43, sz));
    addFigure(kit, 'marble', {
      x: sx,
      y: 1.51,
      z: sz,
      height: 2.75,
      pose: 'hold',
      halo: true,
      seed,
    });
    kit.circle(sx, sz, 0.85, 0, 5);
  }
  // Two saints in the narrow bays between the main and side porches.
  for (const s of [-1, 1]) {
    kit.add('trim2', boxGeo(0.8, 0.36, 0.6, s * 7.4, 1.9, FACE + 0.1));
    addFigure(kit, 'trim', {
      x: s * 7.4,
      y: 2.08,
      z: FACE + 0.16,
      height: 2.05,
      pose: 'pray',
      halo: true,
      seed: 221 + s,
    });
  }
  // Glazed trencadís medallions flanking the main portal below the rose.
  for (const s of [-1, 1]) {
    addOculus(kit, {
      frame: { x: s * 9.15, y: 24.0, z: FACE + 0.04, ry: 0 },
      radius: 1.2,
      colors: ROSE_COLORS,
      seed: 231 + s,
      region: 'rose',
      depth: T,
    });
  }
  // Names over the two blind doors.
  addInscription(kit, 'BAPTISMUS', {
    x: 19,
    y: 12.7,
    z: FACE + 0.04,
    height: 0.5,
    color: '#4a3d2b',
    letterSpacing: 3,
  });
  addInscription(kit, 'PAENITENTIA', {
    x: -19,
    y: 12.7,
    z: FACE + 0.04,
    height: 0.5,
    color: '#4a3d2b',
    letterSpacing: 3,
  });

  // ------------------------------------------------------------- rose window
  addRose(kit, {
    frame: { x: 0, y: 30.5, z: FACE + 0.02, ry: 0 },
    radius: 7.8,
    colors: ROSE_COLORS,
    seed: 91,
    petals: 16,
    region: 'rose',
    depth: T,
  });
  // Mosaic ring outside the splay (lifted to the rose centre, y = 30.5).
  kit.add('mosaic', xform(annulusGeo(9.55, 9.78, 0.16, 56), { y: 30.5, z: FACE + 0.1 }));
  kit.add('gold', xform(annulusGeo(9.42, 9.55, 0.13, 56), { y: 30.5, z: FACE + 0.16 }));

  // --------------------------------------------------------- virtues niches
  // Six virtues flank the portals; the seventh (Charity) crowns the attic.
  const virtueSpots = [
    { x: -22.9, y: 18.3, s: 8, pose: 'hold', name: 'Prudence' },
    { x: -16.0, y: 18.6, s: 9, pose: 'cross', name: 'Justice' },
    { x: -12.0, y: 17.1, s: 10, pose: 'stand', name: 'Faith' },
    { x: 12.0, y: 17.1, s: 11, pose: 'pray', name: 'Hope' },
    { x: 16.0, y: 18.6, s: 12, pose: 'hold', name: 'Fortitude' },
    { x: 22.9, y: 18.3, s: 13, pose: 'cross', name: 'Temperance' },
  ];
  for (const v of virtueSpots) {
    const w = Math.abs(v.x) === 16.0 ? 1.85 : Math.abs(v.x) === 22.9 ? 1.8 : 2.15;
    addNiche(kit, {
      x: v.x,
      y: v.y,
      z: FACE + 0.02,
      w,
      h: 4.9,
      figure: { height: Math.min(2.35, w + 0.55), pose: v.pose, halo: true, seed: v.s },
      figureKey: 'trim',
      pedestal: 0.8,
    });
  }
  // Two angels flanking the rose.
  for (const s of [-1, 1]) {
    addNiche(kit, {
      x: s * 11.2,
      y: 28.8,
      z: FACE + 0.02,
      w: 2.05,
      h: 4.7,
      figure: { height: 2.3, pose: 'armsUp', kind: 'angel', wings: true, seed: 51 + s },
      figureKey: 'trim',
      pedestal: 0.7,
    });
  }

  // ------------------------------------------------------------ attic + gable
  // Attic block above the cornice, carrying Charity and the inscription.
  kit.add('glory', boxGeo(19.2, 7.5, 2.4, 0, 48.75, 46.4));
  for (const s of [-1, 1]) {
    kit.add('trim2', boxGeo(1.0, 7.5, 2.75, s * 8.6, 48.75, 46.5));
    kit.add('trim', boxGeo(1.25, 0.5, 3.0, s * 8.6, 45.55, 46.5));
  }
  // Corbels and cornice.
  kit.add('trim', bandGeo(20.4, 0.7, 2.8, 0, 52.2, 46.5));
  kit.add('trim2', bandGeo(20.8, 0.3, 3.0, 0, 51.9, 46.5));
  kit.add('mosaic', bandGeo(19.4, 0.26, 0.18, 0, 50.8, 47.66));
  // Charity in the central niche.
  addNiche(kit, {
    x: 0,
    y: 45.6,
    z: 47.3,
    w: 2.6,
    h: 3.8,
    figure: { height: 2.2, pose: 'pray', halo: true, seed: 77 },
    figureKey: 'trim',
    pedestal: 0.6,
  });
  // Flanking saints on the attic face.
  for (const s of [-1, 1]) {
    addNiche(kit, {
      x: s * 6.0,
      y: 46.1,
      z: 47.35,
      w: 1.6,
      h: 3.3,
      figure: { height: 1.9, pose: 'stand', halo: true, seed: 131 + s },
      figureKey: 'trim',
      pedestal: 0.55,
    });
  }
  // Pinnacles at the attic corners.
  for (const s of [-1, 1]) {
    addPinnacle(kit, 'trim', s * 9.3, 52.5, 47.3, {
      base: 1.0,
      height: 4.2,
      seed: 137 + s,
      goldTip: true,
      goldR: 0.16,
    });
  }
  addInscription(kit, 'GLORIA IN EXCELSIS DEO', {
    x: 0,
    y: 51.3,
    z: 47.68,
    height: 0.9,
    color: '#3b3022',
    letterSpacing: 3,
  });

  // The great gable.
  addGable(kit, 'glory', {
    x: 0,
    y: 52.5,
    z: 46.7,
    width: 13.0,
    height: 8.0,
    depth: 1.7,
  });
  // Moulded band along the two gable slopes.
  {
    const slope = Math.hypot(6.5, 8);
    const ang = Math.atan2(8, 6.5);
    for (const s of [-1, 1]) {
      const edge = boxGeo(0.5, slope, 1.95);
      xform(edge, { x: s * 3.25, y: 56.5, z: 46.7, rz: s * (Math.PI / 2 - ang) });
      kit.add('trim', edge);
    }
  }
  // Oculus in the gable.
  addRose(kit, {
    frame: { x: 0, y: 55.2, z: 47.66, ry: 0 },
    radius: 1.55,
    colors: ROSE_COLORS,
    seed: 93,
    petals: 8,
    region: 'rose',
    depth: 0.6,
  });
  // Clouds and angels in the gable field, and the Holy Spirit above.
  addCloud(kit, 'trim', { x: -4.5, y: 55.6, z: 47.55, size: 1.9, count: 6, seed: 5 });
  addCloud(kit, 'trim', { x: 4.5, y: 55.6, z: 47.55, size: 1.9, count: 6, seed: 6 });
  addCloud(kit, 'trim', { x: 0, y: 58.4, z: 47.4, size: 1.5, count: 5, seed: 7, squash: 0.5 });
  for (const s of [-1, 1]) {
    addFigure(kit, 'trim', {
      x: s * 4.0,
      y: 55.4,
      z: 47.9,
      ry: s * 0.25,
      height: 2.1,
      pose: 'armsUp',
      kind: 'angel',
      wings: true,
      seed: 81 + s,
    });
    addPinnacle(kit, 'trim', s * 6.6, 52.7, 46.9, { base: 0.75, height: 4.2, seed: 85 + s });
  }
  // The Holy Spirit dove, gilded.
  addBird(kit, 'gold', {
    x: 0,
    y: 58.9,
    z: 48.05,
    ry: 0,
    size: 2.2,
    wings: true,
    seed: 3,
    sy: 1.1,
  });
  addGoldBoss(kit, 0, 60.3, 47.6, 0.34);

  // Attic flanking pinnacle turrets.
  for (const s of [-1, 1]) {
    addPinnacle(kit, 'trim', s * 10.7, 45.6, 46.2, {
      base: 1.5,
      height: 8.2,
      seed: 17 + s,
      goldTip: true,
      goldR: 0.2,
    });
    kit.add('trim', boxGeo(1.8, 1.2, 1.9, s * 10.7, 45.1, 46.1));
  }

  // -------------------------------------------------------------- inscriptions
  addInscription(kit, 'SANCTUS · SANCTUS · SANCTUS', {
    x: 0,
    y: 41.6,
    z: FACE + 0.04,
    height: 1.35,
    color: '#463a29',
    letterSpacing: 3,
  });

  // ------------------------------------------------------------- thresholds
  // Flush mosaic apron: no step, the walk stays at y ≈ 0 (plaza is at -0.055).
  const apron = new THREE.PlaneGeometry(33, 6.4).rotateX(-Math.PI / 2);
  apron.translate(0, -0.02, 49.9);
  kit.add('mosaic', apron);
  for (const door of [main, east, west]) {
    kit.add('trim', bandGeo(door.w + 0.4, 0.1, 1.8, door.coord, -0.04, 45.9));
  }
  // Low flanking kerbs of the entrance platform.
  for (const s of [-1, 1]) {
    kit.add('aisle', boxGeo(0.6, 0.62, 5.6, s * 17.2, 0.24, 49.6));
    kit.add('trim', boxGeo(0.8, 0.16, 5.8, s * 17.2, 0.62, 49.6));
  }

  // --------------------------------------------------------------- colliders
  const wallSegs = [
    [-HW, -15],
    [-9, -5],
    [5, 9],
    [15, HW],
  ];
  for (const [a, b] of wallSegs) kit.box((a + b) / 2, Z, (b - a) / 2, 0.85, 0, 62);
  // Wing bodies.
  for (const s of [-1, 1]) kit.box(s * 19.7, 44.6, 4.7, 1.05, 0, 36);
  // Trumeaux of the main portal.
  for (const s of [-1, 1]) kit.box(s * 2.05, 46.0, 0.48, 0.75, 0, 9.4);
  // Porch projections of every portal: the stepped archivolt bands stand in
  // front of the wall face, so give them precise colliders beside the walks.
  for (const [pcx, pw, band, rings] of [
    [main.coord, main.w, 0.62, 3],
    [east.coord, east.w, 0.55, 2],
    [west.coord, west.w, 0.55, 2],
    [decoEast.coord, decoEast.w, 0.46, 1],
    [decoWest.coord, decoWest.w, 0.46, 1],
  ]) {
    const outerHoleHalf = (pw + (rings - 1) * (2 * band + 0.04)) / 2;
    const bandMid = outerHoleHalf + band / 2;
    const depth = 0.7 + (rings - 1) * 0.36;
    const back = FACE - 0.06;
    const front = back + depth;
    for (const s of [-1, 1]) {
      kit.box(pcx + s * bandMid, (back + front) / 2, band / 2 + 0.04, (front - back) / 2, 0, 26);
    }
  }
  // Tympanum fields close the arch heads, so flying players cannot pass through.
  for (const [pcx, pw, lintel] of [
    [main.coord, main.w, 9.4],
    [east.coord, east.w, 6.6],
    [west.coord, west.w, 6.6],
  ]) {
    kit.box(pcx, Z, pw / 2, 0.85, lintel, 60);
  }
}

// ---------------------------------------------------------------------------
// One portal: stepped archivolts, lintel, tympanum, sculpture, door leaves.
// ---------------------------------------------------------------------------

function buildPortal(kit, { cx, w, h, rings, band, lintel, open, seed, kind }) {
  const frontZ = [];
  for (let i = 0; i < rings; i++) {
    const holeW = w + i * (2 * band + 0.04);
    const holeH = h + i * (band * 1.12 + 0.04);
    const depth = 0.7 + i * 0.36;
    const ring = archRingGeo({
      w: holeW,
      h: holeH,
      band,
      depth,
      spring: 0.52,
      baseExtend: 0.95,
    });
    ring.translate(cx, 0, FACE - 0.06 + depth / 2);
    kit.add(i % 2 === 0 ? 'glory' : 'trim', ring);
    frontZ.push(FACE - 0.06 + depth);
    // Archivolt colonnette.
    addArchTube(kit, 'trim', {
      w: holeW + band * 0.9,
      h: holeH + band * 0.55,
      y0: 0.02,
      bow: 0.52,
      radius: Math.max(0.06, band * 0.14),
      off: 0,
      x: cx,
      y: 0,
      z: frontZ[i] + 0.07,
      ry: 0,
      steps: 14,
    });
  }
  const outerHoleW = w + (rings - 1) * (2 * band + 0.04);
  const outerHoleH = h + (rings - 1) * (band * 1.12 + 0.04);
  const front = frontZ[frontZ.length - 1];
  // Mosaic fillet on the front of the outermost archivolt.
  const mosaicRing = archRingGeo({
    w: outerHoleW,
    h: outerHoleH,
    band: 0.17,
    depth: 0.16,
    spring: 0.52,
    baseExtend: 0.95,
  });
  mosaicRing.translate(cx, 0, front + 0.02);
  kit.add('mosaic', mosaicRing);
  // Gilded fillet just outside the mosaic.
  const goldRing = archRingGeo({
    w: outerHoleW + 0.34,
    h: outerHoleH + 0.36,
    band: 0.07,
    depth: 0.1,
    spring: 0.52,
    baseExtend: 0.95,
  });
  goldRing.translate(cx, 0, front + 0.06);
  kit.add('gold', goldRing);

  // Lintel.
  kit.add('trim', boxGeo(w + 1.1, 0.6, 1.7, cx, lintel - 0.18, FACE - 0.55));
  kit.add('trim2', boxGeo(w + 0.7, 0.22, 1.85, cx, lintel - 0.56, FACE - 0.5));
  if (kind === 'main') {
    addInscription(kit, 'HOSANNA · FILI DAVID', {
      x: cx,
      y: lintel - 0.18,
      z: FACE + 0.32,
      height: 0.3,
      color: '#4a3d2b',
      letterSpacing: 2,
    });
  }

  // Tympanum field (seals the arch above the lintel). Grown slightly past the
  // opening so its edges tuck into the wall and no daylight can leak through
  // the polygon approximation of the arch.
  const tymp = tympanumGeo(w + 0.3, h + 0.16, lintel, 0.6, { bow: 0.52 });
  tymp.translate(cx, 0, FACE - 0.6);
  kit.add('glory', tymp);
  // Raised tympanum border.
  const tympRing = archRingGeo({
    w: w - 0.5,
    h: h - 0.55,
    band: 0.22,
    depth: 0.24,
    spring: 0.52,
    baseExtend: 0.2,
  });
  tympRing.translate(cx, lintel + 0.18, FACE - 0.34);
  kit.add('trim2', tympRing);
  // Deep shadowed field behind the relief figures — the porch should read as a
  // dark room of stone, not a flat lit panel.
  const darkField = tympanumGeo(w - 1.25, h - 1.45, lintel + 0.42, 0.06, { bow: 0.52 });
  darkField.translate(cx, 0, FACE - 0.26);
  kit.add('shadow', darkField);
  // Dark jamb linings and lintel soffit inside the open passages.
  if (open) {
    for (const s of [-1, 1]) {
      kit.add('shadow', boxGeo(0.13, lintel - 0.12, T - 0.12, cx + s * (w / 2 - 0.095), (lintel - 0.12) / 2, Z));
    }
    kit.add('shadow', boxGeo(w - 0.2, 0.12, T - 0.2, cx, lintel - 0.52, Z));
  }

  const fz = FACE - 0.2; // sculpture plane, just proud of the tympanum
  const seed0 = seed * 7;

  if (open) {
    // Open portal: sculpted tympanum over a walkable triple/quadruple doorway.
    if (kind === 'main') {
      // Three door leaves separated by two carved trumeaux.
      for (const s of [-1, 1]) {
        const tx = s * 2.05;
        kit.add('trim', boxGeo(0.85, lintel, 1.25, tx, lintel / 2, FACE - 0.5));
        kit.add('trim2', boxGeo(1.05, 0.34, 1.35, tx, lintel - 0.1, FACE - 0.5));
        kit.add('trim2', boxGeo(1.05, 0.34, 1.35, tx, 0.9, FACE - 0.5));
        kit.add('trim2', boxGeo(0.22, lintel, 0.22, tx - 0.34, lintel / 2, FACE + 0.2));
        kit.add('trim2', boxGeo(0.22, lintel, 0.22, tx + 0.34, lintel / 2, FACE + 0.2));
        // Standing saint against the trumeau.
        kit.add('trim', boxGeo(0.62, 0.5, 0.7, tx, 0.85, FACE + 0.15));
        addFigure(kit, 'trim', {
          x: tx,
          y: 1.1,
          z: FACE + 0.12,
          height: 2.15,
          pose: 'hold',
          halo: true,
          seed: seed0 + s,
        });
      }
      // Tympanum sculpture: three saints, two angels, the dove.
      addFigure(kit, 'trim', {
        x: 0,
        y: lintel + 0.25,
        z: fz,
        height: 2.75,
        pose: 'cross',
        halo: true,
        seed: seed0 + 2,
      });
      for (const s of [-1, 1]) {
        addFigure(kit, 'trim', {
          x: s * 2.55,
          y: lintel + 0.25,
          z: fz,
          height: 2.2,
          pose: 'pray',
          halo: true,
          seed: seed0 + 3 + s,
        });
        addFigure(kit, 'trim', {
          x: s * 1.85,
          y: lintel + 3.3,
          z: fz,
          height: 2.1,
          pose: 'armsUp',
          kind: 'angel',
          wings: true,
          seed: seed0 + 6 + s,
        });
      }
      addCloud(kit, 'trim', { x: 0, y: lintel + 6.4, z: fz - 0.05, size: 1.5, count: 5, seed: seed0 + 9 });
      for (const s of [-1, 1]) {
        addCloud(kit, 'trim', {
          x: s * 1.85,
          y: lintel + 3.15,
          z: fz - 0.06,
          size: 0.8,
          count: 4,
          seed: seed0 + 20 + s,
        });
      }
      addBird(kit, 'gold', {
        x: 0,
        y: lintel + 7.7,
        z: fz + 0.12,
        size: 1.35,
        wings: true,
        seed: seed0 + 11,
      });
    } else {
      // Side portal: two saints and an angel.
      for (const s of [-1, 1]) {
        addFigure(kit, 'trim', {
          x: cx + s * 0.9,
          y: lintel + 0.25,
          z: fz,
          height: 1.95,
          pose: s < 0 ? 'pray' : 'hold',
          halo: true,
          seed: seed0 + s,
        });
      }
      addFigure(kit, 'trim', {
        x: cx,
        y: lintel + 2.9,
        z: fz,
        height: 1.7,
        pose: 'armsUp',
        kind: 'angel',
        wings: true,
        seed: seed0 + 4,
      });
      addCloud(kit, 'trim', { x: cx, y: lintel + 4.6, z: fz - 0.05, size: 1.1, count: 4, seed: seed0 + 5 });
    }
  } else {
    // Blind portal: a carved pair of door leaves below the lintel.
    const doorH = lintel - 0.2;
    kit.add('wood', boxGeo(w - 0.5, doorH, 0.24, cx, doorH / 2, FACE - 0.95));
    kit.add('bronze', boxGeo(w - 0.35, 0.16, 0.3, cx, doorH / 2, FACE - 0.95));
    for (const s of [-1, 1]) {
      for (let row = 0; row < 3; row++) {
        const panelW = (w - 1.0) / 2;
        const panelH = (doorH - 0.8) / 3;
        kit.add(
          'bronze',
          boxGeo(panelW - 0.2, panelH - 0.2, 0.1, cx + s * (w / 4), 0.4 + panelH * (row + 0.5), FACE - 0.8)
        );
        kit.add(
          'gold',
          boxGeo(panelW - 0.38, panelH - 0.38, 0.06, cx + s * (w / 4), 0.4 + panelH * (row + 0.5), FACE - 0.74)
        );
      }
      addGoldBoss(kit, cx + s * 0.55, doorH * 0.62, FACE - 0.7, 0.09);
    }
    // Tympanum: one carved figure in relief.
    addFigure(kit, 'trim', {
      x: cx,
      y: lintel + 0.25,
      z: FACE - 0.2,
      height: 2.3,
      pose: 'stand',
      halo: true,
      seed: seed0 + 2,
    });
    addCloud(kit, 'trim', { x: cx, y: lintel + 3.3, z: FACE - 0.25, size: 0.95, count: 4, seed: seed0 + 3 });
    addGoldBoss(kit, cx, lintel + 4.4, FACE - 0.18, 0.11);
  }
}
