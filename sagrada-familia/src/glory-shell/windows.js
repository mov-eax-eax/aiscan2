// Sagrada Família — windows and glazing for the Glory façade + outer shell.
//
// Each window is built in the wall-local frame supplied by kit.wallFrame():
// the frame origin sits on the *outer* face of the wall, +Z is outward.
// Layers (outer -> inner): splay surround, stone tracery, glass shards,
// dark backing panel, inner tracery ring. Stained glass is vertex-coloured and
// merged per region (+X cool, -X warm, rose, apse) so the shared glassMaterial
// can be lit by the day/night system in one draw call per region.

import {
  THREE,
  lancetWindowParts,
  roseWindowParts,
  oculusParts,
  archRingGeo,
  archPanelGeo,
  boxGeo,
} from '../lib.js';
import { annulusGeo } from './kit.js';

// Deep, saturated backing colours — they read as the dark leading between the
// glass shards from outside and as a rich field from inside. The rose uses a
// warmer, brighter field so the window reads as fired glass, not a hole.
const BACKING = {
  cool: [0x102438, 0x14303f, 0x0e2430],
  warm: [0x351318, 0x3d180c, 0x2e1019],
  rose: [0x6b3220, 0x7a3a1e, 0x5b2a2e],
  apse: [0x101f2e, 0x241428, 0x122a30],
};

// Vertex colours are multiplied by the shared glassMaterial colour, which the
// day/night system keeps below 1 by day. Boosting the vertex colours here makes
// the glass read as luminous colour from the plaza (especially the big rose)
// while the darker backing values still read as leadwork.
const REGION_GAIN = { cool: 1.7, warm: 1.8, rose: 3.1, apse: 1.9 };

function frameOffset(geo, frame, off) {
  if (!geo) return null;
  geo.translate(0, 0, off);
  geo.applyMatrix4(new THREE.Matrix4().makeRotationY(frame.ry));
  geo.translate(frame.x, frame.y, frame.z);
  return geo;
}

function put(kit, key, geo, frame, off) {
  const g = frameOffset(geo, frame, off);
  if (g) kit.add(key, g);
  return g;
}

function putGlass(kit, region, geo, frame, off, color, pick = 0) {
  const g = frameOffset(geo, frame, off);
  if (!g) return;
  const gain = REGION_GAIN[region] ?? 1.7;
  // The lib window kits already bake per-pane vertex colours (each shard and
  // rose petal has its own colour). Preserve that variety and just boost it —
  // re-colouring the merged geometry would flatten the whole window to one hue.
  if (g.attributes && g.attributes.color) {
    const col = g.attributes.color;
    for (let i = 0; i < col.count; i++) {
      col.setXYZ(i, col.getX(i) * gain, col.getY(i) * gain, col.getZ(i) * gain);
    }
    col.needsUpdate = true;
    kit.addGlass(region, g, null);
    return;
  }
  const palette = BACKING[region] || BACKING.cool;
  const base = new THREE.Color(color !== undefined ? color : palette[pick % palette.length]);
  base.multiplyScalar(gain);
  kit.addGlass(region, g, base);
}

/**
 * A glazed lancet window (stone tracery + coloured glass).
 * `proud: true` mounts every layer in front of a solid wall face (blind
 * windows); the default recesses the tracery and glass into a real opening.
 * @param {object} kit
 * @param {object} opts { frame, w, h, colors, seed, bands, region, depth, sill }
 */
export function addLancet(kit, {
  frame,
  w,
  h,
  colors,
  seed = 1,
  bands = 3,
  region = 'cool',
  depth = 1.2,
  sill = true,
  backing = true,
  innerRing = true,
  bow = 0.55,
  proud = false,
}) {
  const parts = lancetWindowParts({ w, h, colors, seed, bands });
  const layers = proud
    ? { surround: 0.02, tracery: 0.2, glass: 0.1, backing: 0.04, inner: null }
    : {
        surround: 0.02,
        tracery: -0.16,
        glass: -0.36,
        backing: -depth * 0.5,
        inner: -(depth + 0.03),
      };
  // 1. Splayed stone surround proud of the wall face.
  put(
    kit,
    'trim',
    archRingGeo({ w, h, band: 0.4, depth: 0.55, spring: bow, baseExtend: 0.95 }),
    frame,
    layers.surround
  );
  // 2. Stone tracery.
  put(kit, 'trim', parts.stone, frame, layers.tracery);
  // 3. Coloured glass shards.
  putGlass(kit, region, parts.glass, frame, layers.glass, undefined, seed);
  // 4. Backing panel — keeps the opening light-tight and deepens the colour.
  if (backing) {
    putGlass(
      kit,
      region,
      archPanelGeo(w * 1.02, h * 1.01, 0.05, { spring: bow }),
      frame,
      layers.backing,
      undefined,
      seed + 2
    );
  }
  // 5. Inner tracery ring so the window has a coloured frame when seen from
  //    inside the temple (real openings only).
  if (innerRing && layers.inner !== null) {
    put(
      kit,
      'trim',
      archRingGeo({ w, h, band: 0.3, depth: 0.32, spring: bow, baseExtend: 0.95 }),
      frame,
      layers.inner
    );
  }
  // 6. Projecting sill.
  if (sill) {
    put(kit, 'trim', boxGeo(w * 1.22, 0.3, 1.0, 0, -0.34, 0), frame, proud ? 0.42 : 0.12);
  }
}

/** A large rose window. `hole` = true when the wall has a real circular hole. */
export function addRose(kit, {
  frame,
  radius = 8,
  colors,
  seed = 1,
  petals = 16,
  region = 'rose',
  depth = 1.6,
  surround = true,
}) {
  const parts = roseWindowParts({ radius, colors, seed, petals });
  // Splayed outer ring.
  if (surround) {
    put(kit, 'trim', annulusGeo(radius * 0.985, radius * 1.14, 0.9, 56), frame, 0.12);
    put(kit, 'trim', annulusGeo(radius * 1.14, radius * 1.2, 0.45, 56), frame, 0.02);
  }
  // Stone tracery (ring, hub, spokes, trefoils) proud of the glass.
  put(kit, 'trim', parts.stone, frame, 0.18);
  // Glass petals.
  putGlass(kit, region, parts.glass, frame, 0.0, undefined, seed);
  // Light-tight coloured disc filling the hole.
  const disc = new THREE.CircleGeometry(radius * 1.03, 56);
  putGlass(kit, region, disc, frame, -depth * 0.42, undefined, seed + 3);
  // Ring of stone bosses around the splay.
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    const boss = boxGeo(radius * 0.07, radius * 0.1, radius * 0.2, Math.cos(a) * radius * 1.075, Math.sin(a) * radius * 1.075, 0);
    boss.applyMatrix4(new THREE.Matrix4().makeRotationZ(a));
    put(kit, 'trim', boss, frame, 0.32);
  }
}

/** A circular oculus / small round window (mounted proud of a solid wall). */
export function addOculus(kit, {
  frame,
  radius = 1.6,
  colors,
  seed = 1,
  region = 'cool',
  depth = 1.2,
}) {
  const parts = oculusParts({ radius, colors, seed });
  put(kit, 'trim', annulusGeo(radius * 0.98, radius * 1.22, 0.55, 40), frame, 0.04);
  put(kit, 'trim', parts.stone, frame, 0.16);
  putGlass(kit, region, parts.glass, frame, 0.06, undefined, seed);
  const disc = new THREE.CircleGeometry(radius * 1.02, 36);
  putGlass(kit, region, disc, frame, 0.03, undefined, seed + 1);
}
