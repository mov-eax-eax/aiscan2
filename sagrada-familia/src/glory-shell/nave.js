// Sagrada Família — outer shell of the nave and transept.
//
// Nave side walls x = ±15..16.2, built in two segments per side (|z| = 15..45)
// so the transept arms stay open to the crossing. Pierced by the DIM
// clerestory windows (cool glass on +X, warm on -X) and the lower aisle
// windows, with exterior buttress-chapels, blind arcading, cornices, saint
// niches and roofs at ~30 m. Transept side walls at z = ±15 carry the four
// outer wall segments with high glazing and stepped buttresses.

import { DIM, PALETTE } from '../config.js';
import {
  boxGeo,
  wallWithOpeningsGeo,
  xform,
  archRingGeo,
  boxCollider,
} from '../lib.js';
import { addLancet, addOculus } from './windows.js';
import {
  addPinnacle,
  addNiche,
  addFigure,
  addRoofPrism,
} from './ornaments.js';
import { bandGeo } from './kit.js';

const WALL_H = 45;
const TH = DIM.wallT; // 1.2
const COOL = PALETTE.glassCool;
const WARM = PALETTE.glassWarm;

export function buildNaveShell(kit) {
  buildNaveWalls(kit);
  buildTranseptWalls(kit);
}

// ---------------------------------------------------------------------------
// Nave side walls
// ---------------------------------------------------------------------------

function buildNaveWalls(kit) {
  const cler = DIM.clerestory;
  const aisle = DIM.aisleWindows;
  const SEG_Z0 = 14.85;
  const SEG_Z1 = 45.15;
  const SEG_LEN = SEG_Z1 - SEG_Z0; // 30.3
  const SEG_C = (SEG_Z0 + SEG_Z1) / 2; // 30.0

  for (const side of ['east', 'west']) {
    const sign = side === 'east' ? 1 : -1;
    const ry = side === 'east' ? Math.PI / 2 : -Math.PI / 2;
    const colors = side === 'east' ? COOL : WARM;
    const region = side === 'east' ? 'cool' : 'warm';

    for (const segSign of [1, -1]) {
      const zc = segSign * SEG_C;
      // world z -> wall-local X (the wall is built in local XY, X along the wall)
      const toLocalX = side === 'east' ? (z) => zc - z : (z) => z - zc;

      const openings = [];
      const clerList = cler.coords.filter((z) => Math.sign(z) === segSign);
      const aisleList = aisle.coords.filter((z) => Math.sign(z) === segSign);
      for (const z of clerList) {
        openings.push({
          x: toLocalX(z),
          w: cler.w,
          h: cler.h,
          y0: cler.y0,
          bow: 0.55,
        });
      }
      for (const z of aisleList) {
        openings.push({
          x: toLocalX(z),
          w: aisle.w,
          h: aisle.h,
          y0: aisle.y0,
          bow: 0.55,
        });
      }

      // --- wall panel ------------------------------------------------------
      const wall = wallWithOpeningsGeo({
        width: SEG_LEN,
        height: WALL_H,
        depth: TH,
        openings,
        baseExtend: 1.0,
        curveSegments: 10,
      });
      xform(wall, { ry, x: sign * 15.6, y: 0, z: zc });
      kit.add('shell', wall);

      // --- glazing ---------------------------------------------------------
      const frameOf = (worldZ, sill, out = TH) => ({
        x: sign * (DIM.naveWallX + out),
        y: sill,
        z: worldZ,
        ry,
      });
      clerList.forEach((z, i) => {
        addLancet(kit, {
          frame: frameOf(z, cler.y0),
          w: cler.w,
          h: cler.h,
          colors,
          seed: 100 + i * 7 + (segSign > 0 ? 0 : 3) + (side === 'east' ? 0 : 50),
          bands: 3,
          region,
          depth: TH,
          sill: false,
        });
      });
      aisleList.forEach((z, i) => {
        addLancet(kit, {
          frame: frameOf(z, aisle.y0),
          w: aisle.w,
          h: aisle.h,
          colors,
          seed: 200 + i * 11 + (segSign > 0 ? 0 : 5) + (side === 'east' ? 0 : 60),
          bands: 2,
          region,
          depth: TH,
        });
      });

      // --- base plinth ----------------------------------------------------
      kit.add('aisle', bandGeo(0.5, 1.5, SEG_LEN, sign * 16.4, 0.45, zc));
      kit.add('trim2', bandGeo(0.66, 0.24, SEG_LEN, sign * 16.42, 1.3, zc));

      // --- blind window gallery above the clerestory ----------------------
      clerList.forEach((z, i) => {
        addLancet(kit, {
          frame: frameOf(z, 40.7),
          w: 0.95,
          h: 1.9,
          colors,
          seed: 620 + i + segSign * 2 + (side === 'east' ? 0 : 7),
          bands: 1,
          region,
          depth: TH,
          sill: false,
          innerRing: false,
          proud: true,
        });
      });

      // --- slim buttress in the free bay between the aisle windows --------
      const bs = segSign * 33.3;
      kit.add('aisle', boxGeo(0.85, 43.4, 0.95, sign * 16.6, 21.4, bs));
      kit.add('trim2', boxGeo(1.1, 0.4, 1.25, sign * 16.6, 42.9, bs));
      kit.add('trim', boxGeo(0.95, 0.26, 1.1, sign * 16.6, 43.25, bs));
      kit.add(
        'trim2',
        xform(
          archRingGeo({ w: 1.0, h: 3.0, band: 0.15, depth: 0.25, spring: 0.62, baseExtend: 0.2 }),
          { ry: sign > 0 ? Math.PI / 2 : -Math.PI / 2, x: sign * 17.05, y: 20.0, z: bs }
        )
      );
      kit.box(sign * 16.6, bs, 0.5, 0.55, 0, 40);

      // --- sill band, string course and cornice ---------------------------
      for (const [ya, hh] of [
        [3.6, 0.34],
        [19.0, 0.36],
        [40.4, 0.34],
      ]) {
        kit.add('trim2', bandGeo(1.85, hh, SEG_LEN, sign * 16.0, ya, zc));
      }
      // Corbel table + wall-head cornice. The cornice tops out at ~44.35 so the
      // towers builder's eave parapet (which starts at 44.35) sits directly on it.
      for (let i = 0; i < 22; i++) {
        const cz2 = zc - SEG_LEN / 2 + 0.7 + i * 1.38;
        kit.add('trim', boxGeo(0.75, 0.5, 0.5, sign * 16.55, 43.0, cz2));
      }
      kit.add('trim', bandGeo(1.95, 1.05, SEG_LEN, sign * 15.95, 43.82, zc));

      // --- corner pier at the transept junction ---------------------------
      const zp = segSign * 15.9;
      kit.add('aisle', boxGeo(2.9, 40.3, 2.3, sign * 17.65, 19.85, zp));
      kit.add('trim', boxGeo(3.2, 0.7, 2.6, sign * 17.65, 40.3, zp));
      kit.add('trim2', boxGeo(3.4, 0.3, 2.8, sign * 17.65, 40.9, zp));
      kit.circle(sign * 17.65, zp, 1.05, 0, 40);
      // Blind arcade on the two exposed faces of the pier.
      for (const face of ['outer', 'front']) {
        for (let i = 0; i < 2; i++) {
          const off = i * 0.82 - 0.41;
          let px;
          let pz;
          let pry;
          if (face === 'outer') {
            px = sign * 19.1;
            pz = zp + off;
            pry = sign > 0 ? Math.PI / 2 : -Math.PI / 2;
          } else {
            px = sign * 17.65 + off;
            pz = segSign * 17.08;
            pry = segSign > 0 ? 0 : Math.PI;
          }
          kit.add(
            'trim2',
            xform(
              archRingGeo({ w: 0.62, h: 2.4, band: 0.11, depth: 0.2, spring: 0.62, baseExtend: 0.2 }),
              { ry: pry, x: px, y: 7.2, z: pz }
            )
          );
        }
      }

      // --- buttress-chapels between the bays ------------------------------
      for (const bz of [24, 36]) {
        buildButtressChapel(kit, sign, segSign * bz, colors, region);
      }

      // --- saint niches on the wall between the aisle windows -------------
      const nicheZ = segSign * 31.6;
      addNiche(kit, {
        x: sign * (DIM.naveWallX + TH + 0.03),
        y: 9.4,
        z: nicheZ,
        ry: sign > 0 ? Math.PI / 2 : -Math.PI / 2,
        w: 1.9,
        h: 4.6,
        figure: { height: 2.2, pose: 'pray', halo: true, seed: 300 + segSign + sign * 3 },
        figureKey: 'trim',
        pedestal: 0.75,
      });

      // --- colliders ------------------------------------------------------
      kit.box(sign * 15.6, zc, 0.7, SEG_LEN / 2, 0, WALL_H);
    }
  }
}

function buildButtressChapel(kit, sign, zc, colors, region) {
  const xOut = sign * 20.3;
  const cx = sign * 18.2;
  const ry = sign > 0 ? Math.PI / 2 : -Math.PI / 2;
  // Body, plinth and cornice.
  kit.add('aisle', boxGeo(4.2, 27.8, 2.7, cx, 14.9, zc));
  kit.add('aisle', boxGeo(4.55, 2.7, 3.05, sign * 18.25, 0.95, zc));
  kit.add('dark', boxGeo(4.25, 0.5, 2.75, cx, 28.9, zc));
  kit.add('trim', boxGeo(4.6, 0.55, 3.05, cx, 29.35, zc));
  kit.add('trim2', boxGeo(4.75, 0.22, 3.2, cx, 29.72, zc));
  // Gable roof (~30-33 m: the "aisle roofs").
  addRoofPrism(kit, {
    x: cx,
    y: 29.8,
    z: zc,
    ry: 0,
    width: 4.4,
    span: 2.95,
    rise: 2.55,
    key: 'roof',
  });
  // Ridge pinnacle.
  addPinnacle(kit, 'trim', cx, 32.1, zc, { base: 0.95, height: 6.6, seed: 400 + zc + sign, goldTip: true, goldR: 0.16 });
  // Blind arcade on the outward face.
  for (let i = -1; i <= 1; i++) {
    kit.add(
      'trim2',
      xform(
        archRingGeo({ w: 0.7, h: 2.3, band: 0.12, depth: 0.22, spring: 0.62, baseExtend: 0.2 }),
        { ry, x: xOut, y: 6.6, z: zc + i * 0.86 }
      )
    );
  }
  // Niche with a saint on the outward face.
  addNiche(kit, {
    x: xOut + sign * 0.03,
    y: 12.2,
    z: zc,
    ry,
    w: 1.55,
    h: 3.7,
    figure: { height: 1.95, pose: 'stand', halo: true, seed: 410 + zc + sign },
    figureKey: 'trim',
    pedestal: 0.6,
  });
  // Small lancet above the niche (blind: mounted proud of the chapel front).
  addLancet(kit, {
    frame: { x: xOut, y: 18.4, z: zc, ry },
    w: 1.35,
    h: 4.2,
    colors,
    seed: 420 + zc + sign,
    bands: 2,
    region,
    depth: 0.9,
    sill: false,
    innerRing: false,
    proud: true,
  });
  // Vertical ribs at the front corners.
  kit.add('trim2', boxGeo(0.34, 24, 0.34, sign * 20.1, 13, zc - 1.18));
  kit.add('trim2', boxGeo(0.34, 24, 0.34, sign * 20.1, 13, zc + 1.18));
  kit.box(cx, zc, 2.15, 1.55, 0, 33);
}

// ---------------------------------------------------------------------------
// Transept side walls (z = ±15), four segments x = -30..-15 and 15..30
// ---------------------------------------------------------------------------

function buildTranseptWalls(kit) {
  const X0 = 14.85;
  const X1 = 30.2;
  const LEN = X1 - X0; // 15.35
  const XC = (X0 + X1) / 2; // 22.525

  for (const zsign of [1, -1]) {
    for (const xsign of [1, -1]) {
      const xc = xsign * XC;
      const ry = zsign > 0 ? 0 : Math.PI;
      const region = xsign > 0 ? 'cool' : 'warm';
      const colors = xsign > 0 ? COOL : WARM;

      // world x -> wall-local X
      const toLocalX = zsign > 0 ? (x) => x - xc : (x) => xc - x;
      const winOffsets = [-3.55, 3.55];
      const openings = winOffsets.map((o) => ({
        x: toLocalX(xc + o),
        w: 3.8,
        h: 16,
        y0: 19.5,
        bow: 0.55,
      }));
      const wall = wallWithOpeningsGeo({
        width: LEN,
        height: WALL_H,
        depth: TH,
        openings,
        baseExtend: 1.0,
        curveSegments: 10,
      });
      xform(wall, { ry, x: xc, y: 0, z: zsign * 15.6 });
      kit.add('shell', wall);

      const frameOf = (worldX, sill, out = TH) => ({
        x: worldX,
        y: sill,
        z: zsign * (15 + out),
        ry,
      });

      winOffsets.forEach((o, i) => {
        const wx = xc + o;
        addLancet(kit, {
          frame: frameOf(wx, 19.5),
          w: 3.8,
          h: 16,
          colors,
          seed: 500 + i * 9 + zsign * 2 + xsign * 4,
          bands: 3,
          region,
          depth: TH,
        });
        addOculus(kit, {
          frame: frameOf(wx, 37.8, TH),
          radius: 1.7,
          colors,
          seed: 530 + i + zsign,
          region,
          depth: TH,
        });
      });

      // Lower blind arcade along the wall.
      for (let i = -2; i <= 2; i++) {
        kit.add(
          'trim2',
          xform(
            archRingGeo({ w: 1.15, h: 4.4, band: 0.16, depth: 0.3, spring: 0.6, baseExtend: 0.2 }),
            { ry, x: xc + i * 2.5, y: 6.4, z: zsign * (15 + TH) }
          )
        );
      }
      // Base plinth, string courses, corbel table and cornice.
      kit.add('aisle', bandGeo(LEN, 1.5, 0.5, xc, 0.45, zsign * 16.42));
      kit.add('trim2', bandGeo(LEN, 0.24, 0.66, xc, 1.3, zsign * 16.42));
      for (const ya of [17.6, 40.9]) {
        kit.add('trim2', bandGeo(1.85, 0.34, LEN, xc, ya, zsign * 15.9));
      }
      // Blind window gallery above the high lancets.
      winOffsets.forEach((o, i) => {
        addLancet(kit, {
          frame: frameOf(xc + o, 41.2),
          w: 0.9,
          h: 1.3,
          colors,
          seed: 640 + i + zsign * 3 + xsign * 5,
          bands: 1,
          region,
          depth: TH,
          sill: false,
          innerRing: false,
          proud: true,
        });
        // Blind lancet in the blank mid-band between sill and arcade.
        addLancet(kit, {
          frame: frameOf(xc + o, 12.2),
          w: 1.5,
          h: 3.8,
          colors,
          seed: 660 + i + zsign * 4 + xsign * 6,
          bands: 2,
          region,
          depth: TH,
          sill: false,
          innerRing: false,
          proud: true,
        });
      });
      for (let i = 0; i < 11; i++) {
        kit.add('trim', boxGeo(0.5, 0.5, 0.75, xc - LEN / 2 + 0.8 + i * 1.4, 43.0, zsign * 16.7));
      }
      kit.add('trim', bandGeo(1.95, 1.05, LEN, xc, 43.82, zsign * 15.95));

      // Terminate the transept wall ends at the façade planes (x = ±30).
      // Built once per zsign (the wall is symmetric) to avoid duplicate geometry.
      if (xsign > 0) for (const sx of [-1, 1]) {
        kit.add('aisle', boxGeo(1.7, 40.4, 3.2, sx * 30.0, 19.9, zsign * 15.6));
        kit.add('trim', boxGeo(2.0, 0.7, 3.5, sx * 30.0, 40.3, zsign * 15.6));
        kit.add('trim2', boxGeo(2.2, 0.3, 3.7, sx * 30.0, 40.9, zsign * 15.6));
        kit.add('trim2', boxGeo(0.55, 32, 0.7, sx * 30.85, 16, zsign * 15.6));
        kit.add(
          'trim2',
          xform(
            archRingGeo({ w: 0.9, h: 3.2, band: 0.14, depth: 0.24, spring: 0.6, baseExtend: 0.2 }),
            { ry: sx > 0 ? Math.PI / 2 : -Math.PI / 2, x: sx * 30.95, y: 9.5, z: zsign * 15.6 }
          )
        );
        kit.box(sx * 30.0, zsign * 15.6, 0.95, 1.7, 0, 41);
      }

      // Stepped buttresses (three per segment).
      for (const bx of [xc - 6.9, xc, xc + 6.9]) {
        buildTranseptButtress(kit, bx, zsign);
      }
      kit.box(xc, zsign * 15.6, LEN / 2, 0.7, 0, WALL_H);
    }
  }
}

function buildTranseptButtress(kit, x, zsign) {
  const z0 = zsign * (15 + TH); // outer wall face
  const stages = [
    { y0: -0.3, y1: 8, proj: 2.2, w: 2.2 },
    { y0: 8, y1: 18, proj: 1.7, w: 1.9 },
    { y0: 18, y1: 28, proj: 1.2, w: 1.6 },
    { y0: 28, y1: 37.6, proj: 0.85, w: 1.35 },
  ];
  for (const st of stages) {
    const zc = zsign * (Math.abs(z0) + st.proj / 2);
    kit.add('aisle', boxGeo(st.w, st.y1 - st.y0, st.proj, x, (st.y0 + st.y1) / 2, zc));
    // weathering cap
    kit.add(
      'trim2',
      boxGeo(st.w * 1.08, 0.22, st.proj * 1.12, x, st.y1 - 0.06, zsign * (Math.abs(z0) + st.proj * 0.56))
    );
  }
  // Blind niche on the buttress face (stage 1 front).
  kit.add(
    'trim2',
    xform(
      archRingGeo({ w: 0.9, h: 3.4, band: 0.14, depth: 0.24, spring: 0.6, baseExtend: 0.2 }),
      { ry: zsign > 0 ? 0 : Math.PI, x, y: 10.4, z: zsign * 17.9 }
    )
  );
  addPinnacle(kit, 'trim', x, 37.9, zsign * (Math.abs(z0) + 0.5), {
    base: 0.9,
    height: 6.4,
    seed: 600 + Math.round(x) + zsign * 3,
    goldTip: true,
    goldR: 0.15,
  });
  kit.box(x, z0 + zsign * 1.1, 1.15, 1.25, 0, 40);
}
