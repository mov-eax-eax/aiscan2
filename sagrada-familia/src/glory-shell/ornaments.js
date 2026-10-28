// Sagrada Família — sculptural ornaments shared by the Glory façade and the
// outer shell: pinnacles, canopied niches, robed figures, angels, clouds,
// gables, roof prisms, carved inscriptions and archivolt mouldings.

import {
  THREE,
  figureGeo,
  birdGeo,
  pinnacleGeo,
  textTexture,
  sphereGeo,
  boxGeo,
  xform,
  mergeGeos,
  rng,
  rand,
} from '../lib.js';
import { parabolicGableGeo } from './kit.js';

/** Stone pinnacle with optional gilded finial ball. */
export function addPinnacle(kit, key, x, y, z, {
  base = 1.1,
  height = 7,
  tiers = 2,
  seed = 1,
  goldTip = false,
  goldR = 0.2,
  ry = 0,
} = {}) {
  const g = pinnacleGeo({ base, height, tiers, seed });
  xform(g, { x, y, z, ry });
  kit.add(key, g);
  if (goldTip) {
    const ball = sphereGeo(goldR, 10, 0, height * 1.21, 0);
    xform(ball, { x, y, z, ry });
    kit.add('gold', ball);
  }
}

/** A robed figure / angel standing at a world position, facing `ry`. */
export function addFigure(kit, key, {
  x = 0,
  y = 0,
  z = 0,
  ry = 0,
  height = 1.8,
  pose = 'stand',
  kind = 'human',
  hood = false,
  halo = false,
  wings = false,
  seed = 1,
} = {}) {
  const g = figureGeo({ height, pose, kind, hood, halo, wings, seed });
  xform(g, { x, y, z, ry });
  kit.add(key, g);
}

/** A bird (dove / eagle) with optional spread wings. */
export function addBird(kit, key, { x, y, z, ry = 0, size = 1, wings = true, seed = 1, sx = 1, sy = 1, sz = 1 } = {}) {
  const g = birdGeo({ size, wings, seed });
  xform(g, { sx, sy, sz });
  xform(g, { x, y, z, ry });
  kit.add(key, g);
}

/**
 * Canopied wall niche with a pedestal and an optional figure.
 * Local frame: origin on the wall face, +Z outward. Placed by (x,y,z,ry).
 */
export function addNiche(kit, {
  x = 0,
  y = 0,
  z = 0,
  ry = 0,
  w = 2.1,
  h = 4.5,
  stone = 'trim',
  figure = null,
  figureKey = 'trim',
  pedestal = 0.85,
} = {}) {
  const put = (key, geo) => kit.add(key, xform(geo, { x, y, z, ry }));
  // Dark recess behind the figure.
  put('shadow', boxGeo(w * 0.9, h * 0.92, 0.28, 0, h * 0.46, 0.14));
  // Side pilasters.
  put(stone, boxGeo(0.26, h, 0.52, -w * 0.47, h * 0.5, 0.3));
  put(stone, boxGeo(0.26, h, 0.52, w * 0.47, h * 0.5, 0.3));
  // Pedestal and corbel.
  put(stone, boxGeo(w * 0.8, pedestal, 0.8, 0, pedestal * 0.5, 0.44));
  put(stone, boxGeo(w * 0.62, 0.28, 0.55, 0, pedestal - 0.1, 0.46));
  // Arched frame over the display area.
  const archH = Math.max(1.2, h - pedestal - 0.35);
  const arch = new THREE.Shape();
  const aw = w * 0.78;
  const ah = archH;
  const spring = ah * 0.62;
  arch.moveTo(-aw / 2, 0);
  arch.lineTo(-aw / 2, spring);
  arch.quadraticCurveTo(-aw * 0.34, ah * 0.96, 0, ah);
  arch.quadraticCurveTo(aw * 0.34, ah * 0.96, aw / 2, spring);
  arch.lineTo(aw / 2, 0);
  arch.closePath();
  put(stone, xform(new THREE.ExtrudeGeometry(arch, { depth: 0.4, bevelEnabled: false, curveSegments: 8 }), { y: pedestal + 0.1, z: 0.14 }));
  // Crocketed canopy.
  put(stone, xform(parabolicGableGeo(w * 1.06, 1.0, 0.7), { y: h + 0.05, z: 0.28 }));
  put(stone, sphereGeo(0.13, 8, 0, h + 1.22, 0.3));
  // Figure.
  if (figure) {
    const f = figureGeo({
      height: figure.height || Math.min(2.5, h - pedestal - 0.5),
      pose: figure.pose || 'stand',
      kind: figure.kind || 'human',
      hood: figure.hood || false,
      halo: figure.halo || false,
      wings: figure.wings || false,
      seed: figure.seed || 1,
    });
    xform(f, { x: 0, y: pedestal, z: 0.36, ry: figure.ry || 0 });
    put(figureKey, f);
  }
}

/** A cloud of lodged stone spheres (used around the gable). */
export function addCloud(kit, key, { x = 0, y = 0, z = 0, size = 2.4, count = 6, seed = 1, ry = 0, squash = 0.7 } = {}) {
  const r = rng(seed);
  const parts = [];
  for (let i = 0; i < count; i++) {
    const a = r() * Math.PI * 2;
    const rad = rand(r, 0, size * 0.55);
    parts.push(
      xform(new THREE.SphereGeometry(size * rand(r, 0.28, 0.52), 8, 5), {
        x: Math.cos(a) * rad,
        y: rand(r, -0.3, 0.3) * size * 0.35,
        z: Math.sin(a) * rad * 0.55,
        sy: rand(r, 0.55, 0.8) * squash + 0.15,
        sz: rand(r, 0.7, 0.95),
      })
    );
  }
  const g = mergeGeos(parts);
  xform(g, { x, y, z, ry });
  kit.add(key, g);
}

/** A parabolic gable slab. */
export function addGable(kit, key, { x = 0, y = 0, z = 0, width = 8, height = 6, depth = 1.2, ry = 0, samples = 10 } = {}) {
  const g = parabolicGableGeo(width, height, depth, samples);
  xform(g, { x, y, z, ry });
  kit.add(key, g);
}

/**
 * A gable roof prism. Ridge runs along local X, span along Z.
 * Base of the prism sits at local y = 0 (eaves), ridge at y = rise.
 */
export function addRoofPrism(kit, {
  x = 0,
  y = 0,
  z = 0,
  ry = 0,
  width = 4,
  span = 4,
  rise = 2,
  thickness = 0.24,
  key = 'roof',
} = {}) {
  const halfSpan = span / 2;
  const slopeLen = Math.hypot(halfSpan, rise) + 0.12;
  const a = Math.atan2(rise, halfSpan);
  const parts = [];
  const front = boxGeo(width * 1.02, thickness, slopeLen);
  xform(front, { rx: a, y: rise / 2, z: halfSpan / 2 });
  parts.push(front);
  const back = boxGeo(width * 1.02, thickness, slopeLen);
  xform(back, { rx: -a, y: rise / 2, z: -halfSpan / 2 });
  parts.push(back);
  parts.push(boxGeo(width * 1.04, 0.16, 0.3, 0, rise + 0.02, 0));
  const g = mergeGeos(parts);
  xform(g, { x, y, z, ry });
  kit.add(key, g);
}

/** Continuous stone moulding following an arch (archivolt colonnette). */
export function addArchTube(kit, key, {
  w,
  h,
  y0 = 0,
  bow = 0.52,
  pinch = 0.92,
  radius = 0.1,
  off = 0,
  x = 0,
  y = 0,
  z = 0,
  ry = 0,
  steps = 16,
} = {}) {
  // Re-use the arch sampler without importing it here (keep modules acyclic):
  // derive from lib's arch shape by sampling the quadratic directly.
  const hw = w / 2;
  const springY = y0 + h * bow;
  const ctrlY = y0 + h * 0.93;
  const apexY = y0 + h;
  const pts = [];
  const push = (t, sign) => {
    const mt = 1 - t;
    const px = sign * (mt * mt * hw + 2 * mt * t * hw * pinch);
    const py = mt * mt * springY + 2 * mt * t * ctrlY + t * t * apexY;
    pts.push([px, py, 0]);
  };
  for (let i = 0; i <= steps; i++) push(i / steps, -1);
  for (let i = steps - 1; i >= 0; i--) push(i / steps, 1);
  const g = new THREE.TubeGeometry(
    new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)), false, 'catmullrom', 0.2),
    steps * 2,
    radius,
    5,
    false
  );
  g.translate(0, 0, off);
  xform(g, { x, y, z, ry });
  kit.add(key, g);
}

/** Carved-looking inscription plane. Collects meshes added straight to the group. */
export function addInscription(kit, text, {
  x = 0,
  y = 0,
  z = 0,
  ry = 0,
  height = 1.2,
  color = '#3a3024',
  font = '600 62px Georgia, "Times New Roman", serif',
  letterSpacing = 2,
  opacity = 0.92,
} = {}) {
  const tex = textTexture(text, { font, color, letterSpacing });
  const aspect = tex.image.width / Math.max(1, tex.image.height);
  const geo = new THREE.PlaneGeometry(height * aspect, height);
  const mat = new THREE.MeshStandardMaterial({
    map: tex,
    transparent: true,
    opacity,
    roughness: 0.92,
    metalness: 0,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(x, y, z);
  mesh.rotation.y = ry;
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  mesh.renderOrder = 2;
  mesh.name = 'inscription';
  kit.textMeshes.push(mesh);
}

/** Small gilded rosette / boss, useful as a gold accent. */
export function addGoldBoss(kit, x, y, z, r = 0.18) {
  kit.add('gold', sphereGeo(r, 10, x, y, z));
}
