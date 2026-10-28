// Sagrada Família — interior builder shared kit.
//
// Everything the interior modules need: cached materials, a per-material
// geometry bucket that merges static geometry aggressively, parametric vault
// surface builders, ribs, statue/furniture helpers and a few emissive/additive
// effect textures. No external assets: all procedural.

import {
  THREE,
  addMerged,
  mergeGeos,
  mergeColored,
  xform,
  rng,
  rand,
  pick,
  clamp,
  lerp,
  stoneMat,
  marbleMat,
  porphyryMat,
  basaltMat,
  goldMat,
  brightGoldMat,
  bronzeMat,
  ironMat,
  woodMat,
  mosaicMat,
  candleFlameMat,
  glassMaterial,
  colorize,
  scaleUV,
  boxGeo,
  cylGeo,
  sphereGeo,
  coneGeo,
  torusGeo,
  latheGeo,
  tubeGeo,
  shapeGeo,
  starGeo,
  figureGeo,
  limbGeo,
} from '../lib.js';
import { DIM, PALETTE } from '../config.js';

export { THREE, DIM, PALETTE };

// ---------------------------------------------------------------------------
// Materials
// ---------------------------------------------------------------------------

/** Shared interior material set. Built once; lib caches the heavy textures. */
export function makeMaterials() {
  const vaultBase = stoneMat(0xd9c9ad, { repeat: 2.6, roughness: 0.94, bumpScale: 0.1 });
  const vault = vaultBase.clone();
  // Vaults are seen mostly from below but their extrados is visible from the
  // nave through the triforium openings, so they must be two-sided.
  vault.side = THREE.DoubleSide;
  vault.name = 'int-vault';
  // A slightly deeper tone for the crossing dome so the lantern reads as the
  // focus above a lighter nave.
  const vaultDeep = stoneMat(0xc9b494, { repeat: 2.0, roughness: 0.93, bumpScale: 0.12 }).clone();
  vaultDeep.side = THREE.DoubleSide;
  vaultDeep.name = 'int-vault-deep';

  // Glass shares lib's vertex-coloured, day/night-aware material so the
  // interior windows dim and glow in step with the rest of the building. Cool
  // and warm glass are the same material — the colour is per vertex.
  const glassCool = glassMaterial;
  const glassWarm = glassMaterial;

  const mats = {
    // ---- stone families
    floor: stoneMat(PALETTE.stoneInterior, { repeat: 1, roughness: 0.9, bumpScale: 0.19 }),
    floorDark: stoneMat(PALETTE.stoneAisle, { repeat: 1, roughness: 0.92, bumpScale: 0.22 }),
    stone: stoneMat(PALETTE.stoneInterior, { repeat: 2.4, roughness: 0.86 }),
    stoneLight: stoneMat(0xe9ddc6, { repeat: 2, roughness: 0.8, bumpScale: 0.15 }),
    stoneWarm: stoneMat(0xd6c3a0, { repeat: 2.2, roughness: 0.88 }),
    plaster: stoneMat(0xe4d8c4, { repeat: 3, roughness: 0.95, bumpScale: 0.11 }),
    vault,
    vaultDeep,
    rib: stoneMat(0xb6a17a, { repeat: 1.6, roughness: 0.84, bumpScale: 0.2 }),
    ribDark: stoneMat(PALETTE.stoneDark, { repeat: 1.4, roughness: 0.9 }),
    ribGold: stoneMat(0xc9a86a, { repeat: 1.2, roughness: 0.5, metalness: 0.5 }),
    basalt: basaltMat(),
    // lighter granite for the tree trunks and branches so they read as stone
    // rather than dark wires under the low interior light
    basaltLight: stoneMat(0x938e84, { repeat: 1.5, roughness: 0.7, bumpScale: 0.24 }),
    basaltDark: stoneMat(0x57544f, { repeat: 1.4, roughness: 0.68, bumpScale: 0.28 }),
    porphyry: porphyryMat(),
    // Lighter porphyry for the giant crossing shafts: reads red rather than
    // black under the dim interior light.
    porphyryLight: stoneMat(0x9a5346, { repeat: 1.0, roughness: 0.58, bumpScale: 0.1 }),
    porphyryDark: stoneMat(PALETTE.porphyryDark, { repeat: 1.2, roughness: 0.62, bumpScale: 0.16 }),
    marble: marbleMat(),
    marbleDark: stoneMat(0xcfc3ad, { repeat: 1.4, roughness: 0.45, bumpScale: 0.06 }),
    // ---- metals
    gold: goldMat(),
    goldBright: brightGoldMat(),
    bronze: bronzeMat(),
    iron: ironMat(),
    // ---- timber / textiles
    wood: woodMat(),
    woodDark: stoneMat(0x4a3019, { repeat: 2, roughness: 0.72, bumpScale: 0.12 }),
    cloth: new THREE.MeshStandardMaterial({ color: PALETTE.cloth, roughness: 0.94, metalness: 0 }),
    carpet: new THREE.MeshStandardMaterial({ color: 0x6d1d24, roughness: 0.97, metalness: 0 }),
    velvet: new THREE.MeshStandardMaterial({ color: 0x4f1a22, roughness: 0.92, metalness: 0 }),
    // ---- mosaic / glass
    mosaic: mosaicMat(),
    mosaicGold: mosaicMat([0xd9b25e, 0xf0d27a, 0x9c7c39, 0x2f5f9e, 0xe6ddca, 0x8f1e2c]),
    mosaicCool: mosaicMat([0x2f5fa8, 0x2b7f9e, 0x48a88e, 0x1f4f7a, 0x63b7b1, 0xe6ddca]),
    glassCool,
    glassWarm,
    // ---- emissive light sources
    vaultGlow: new THREE.MeshBasicMaterial({ color: 0xfff0cd }),
    vaultGlowCool: new THREE.MeshBasicMaterial({ color: 0xdceaff }),
    candle: new THREE.MeshStandardMaterial({
      color: 0xfff2d6,
      emissive: 0xffcf7a,
      emissiveIntensity: 0.55,
      roughness: 0.65,
    }),
    flame: candleFlameMat(),
    lampRed: new THREE.MeshBasicMaterial({ color: 0xff5a3c }),
    // ---- transparent lighting helpers
    poolWarm: new THREE.MeshBasicMaterial({
      map: radialTexture(),
      color: 0xffcf94,
      transparent: true,
      opacity: 0.55,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
    poolCool: new THREE.MeshBasicMaterial({
      map: radialTexture(),
      color: 0x9ec8ff,
      transparent: true,
      opacity: 0.4,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
    shaftWarm: new THREE.MeshBasicMaterial({
      color: 0xffd29a,
      transparent: true,
      opacity: 0.038,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
    shaftCool: new THREE.MeshBasicMaterial({
      color: 0x9dc8ff,
      transparent: true,
      opacity: 0.042,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
    shaftGold: new THREE.MeshBasicMaterial({
      color: 0xffe6b4,
      transparent: true,
      opacity: 0.03,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
    lanternGlow: new THREE.MeshBasicMaterial({
      color: 0xfff0d2,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.96,
    }),
    wear: new THREE.MeshBasicMaterial({
      map: radialTexture(),
      color: 0x2a231a,
      transparent: true,
      opacity: 0.22,
      depthWrite: false,
    }),
  };
  return mats;
}

// ---------------------------------------------------------------------------
// Geometry bucket: accumulate raw geometry per material key, merge on flush.
// ---------------------------------------------------------------------------

export function bucket() {
  const map = new Map();
  return {
    add(key, geo) {
      if (!geo || !geo.attributes || !geo.attributes.position) return;
      const g = typeof globalThis !== 'undefined' ? globalThis : null;
      if (g && g.__INTERIOR_TRACE) {
        geo.computeBoundingBox();
        const b = geo.boundingBox;
        g.__INTERIOR_TRACE.push({
          key,
          type: geo.type,
          verts: geo.attributes.position.count,
          min: b ? b.min.toArray() : null,
          max: b ? b.max.toArray() : null,
        });
      }
      if (typeof window !== 'undefined' && window.__INTERIOR_DEBUG_NAN) {
        const p = geo.attributes.position;
        let bad = 0;
        for (let i = 0; i < p.count * 3; i++) if (!Number.isFinite(p.array[i])) bad++;
        if (bad) console.log(`[nan-source] ${key} type=${geo.type} verts=${p.count} bad=${bad}`);
      }
      let list = map.get(key);
      if (!list) {
        list = [];
        map.set(key, list);
      }
      list.push(geo);
      return geo;
    },
    has(key) {
      return map.has(key);
    },
    /** Merge each material group into one mesh and attach to `parent`. */
    flush(parent, mats, { castShadow = true, receiveShadow = true, noCast = [] } = {}) {
      const skipCast = new Set(noCast);
      const meshes = [];
      for (const [key, list] of map) {
        const mat = mats[key];
        if (!mat) {
          console.warn('[interior] missing material', key);
          continue;
        }
        const mesh = addMerged(parent, list, mat, {
          castShadow: castShadow && !skipCast.has(key),
          receiveShadow,
          name: `interior-${key}`,
        });
        if (mesh) {
          mesh.userData.matKey = key;
          meshes.push(mesh);
        }
      }
      map.clear();
      return meshes;
    },
  };
}

// ---------------------------------------------------------------------------
// Parametric surfaces
// ---------------------------------------------------------------------------

/**
 * Indexed grid surface. fn(u,v) -> [x,y,z] with u,v in 0..1.
 * Normals are computed smooth; flip reverses winding so a ceiling faces down.
 */
export function gridSurface(nu, nv, fn, { flip = false, uv = [1, 1] } = {}) {
  const cols = nu + 1;
  const pos = new Float32Array((nu + 1) * (nv + 1) * 3);
  const uvs = new Float32Array((nu + 1) * (nv + 1) * 2);
  const idx = [];
  let p = 0;
  let q = 0;
  for (let j = 0; j <= nv; j++) {
    for (let i = 0; i <= nu; i++) {
      const t = fn(i / nu, j / nv);
      pos[p++] = t[0];
      pos[p++] = t[1];
      pos[p++] = t[2];
      uvs[q++] = (i / nu) * uv[0];
      uvs[q++] = (j / nv) * uv[1];
    }
  }
  for (let j = 0; j < nv; j++) {
    for (let i = 0; i < nu; i++) {
      const a = j * cols + i;
      const b = a + 1;
      const c = a + cols;
      const d = c + 1;
      if (flip) idx.push(a, b, c, b, d, c);
      else idx.push(a, c, b, b, c, d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/**
 * Sampled tube following fn(t) -> [x,y,z]. Used for vault ribs so they sit on
 * the surface they decorate.
 */
export function ribCurve(samples, radius = 0.24, { tubular = 18, radial = 4 } = {}) {
  return tubeGeo(samples, radius, { tubularSegments: tubular, radialSegments: radial });
}

/** Concatenate a list of point runs into one Catmull-Rom tube; null if too short. */
export function ribTube(points, radius, opts) {
  if (!points || points.length < 2) return null;
  return ribCurve(points, radius, opts);
}

// ---------------------------------------------------------------------------
// Small architectural helpers
// ---------------------------------------------------------------------------

/** Horizontal stone ring around a column (a torus laid flat). */
export function ringBand(radius, y, tube = 0.1, seg = 18) {
  return xform(torusGeo(radius, tube, seg, 5), { rx: Math.PI / 2, y });
}

/** Octagonal plinth + mouldings for a floor-standing column. */
export function octPlinth(r = 1.4, h = 0.9) {
  const parts = [];
  parts.push(boxGeo(r * 2.0, h * 0.24, r * 2.0, 0, h * 0.12, 0, Math.PI / 8));
  parts.push(xform(new THREE.CylinderGeometry(r * 1.0, r * 1.15, h * 0.3, 8), { y: h * 0.39, ry: Math.PI / 8 }));
  parts.push(xform(new THREE.CylinderGeometry(r * 0.84, r * 1.0, h * 0.28, 8), { y: h * 0.68, ry: Math.PI / 8 }));
  parts.push(ringBand(r * 0.92, h * 0.86, r * 0.055, 16));
  return mergeGeos(parts);
}

/** Flared capital for a column of radius r whose top is at y. */
export function capitalGeo(r = 1.4, { y = 0, h = 0.9, square = true } = {}) {
  const parts = [];
  parts.push(ringBand(r * 1.02, y + 0.06, r * 0.06, 16));
  parts.push(xform(new THREE.CylinderGeometry(r * 1.26, r * 0.96, h * 0.62, 8), { y: y + h * 0.4, ry: Math.PI / 8 }));
  if (square) parts.push(boxGeo(r * 2.5, h * 0.2, r * 2.5, 0, y + h * 0.82, 0, Math.PI / 8));
  parts.push(xform(new THREE.CylinderGeometry(r * 1.3, r * 1.34, h * 0.12, 8), { y: y + h * 0.95, ry: Math.PI / 8 }));
  return mergeGeos(parts);
}

/** Shallow boss / rosette used on ribs and vault webbing. */
export function bossGeo(r = 0.5, seed = 1) {
  const parts = [];
  parts.push(xform(new THREE.SphereGeometry(r, 10, 6), { y: r * 0.4, sy: 0.55 }));
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    parts.push(coneGeo(r * 0.16, r * 0.62, 4, Math.cos(a) * r * 0.72, r * 0.2, Math.sin(a) * r * 0.72, a));
  }
  parts.push(xform(new THREE.CylinderGeometry(r * 0.18, r * 0.24, r * 0.3, 8), { y: r * 0.85 }));
  return mergeGeos(parts);
}

/** Small four/eight pointed gold star laid flat (horizontal). */
export function flatStar(points, outer, inner, thickness = 0.06) {
  return xform(starGeo(points, outer, inner, thickness), { rx: -Math.PI / 2 });
}

/** Downward-pointing cone (a pendant / corbel / ray), correctly placed. */
export function downCone(r, h, seg = 4, x = 0, y = 0, z = 0) {
  return xform(new THREE.ConeGeometry(r, h, seg), { rx: Math.PI, x, y, z });
}

/** A robed figure standing on a pedestal; returns merged stone geometry. */
export function statueGeo({ height = 1.9, pose = 'stand', kind = 'human', seed = 1, halo = false, wings = false, hood = false } = {}) {
  return figureGeo({ height, pose, kind, seed, halo, wings, hood });
}

/** Emissive disc facing down: a lit oculus. */
export function oculusDisc(radius, material = 'vaultGlow') {
  const g = new THREE.CircleGeometry(radius, 24);
  g.rotateX(Math.PI / 2); // normal points down (-Y)
  return g;
}

/** Glowing glass panes around a lantern drum. */
export function glowRing(radius, height, segments = 12) {
  const geo = new THREE.CylinderGeometry(radius, radius * 0.98, height, segments, 1, true);
  return geo;
}

// ---------------------------------------------------------------------------
// Light effect helpers
// ---------------------------------------------------------------------------

let _radial = null;
/** Soft radial gradient used for floor light pools / glows. */
export function radialTexture() {
  if (_radial) return _radial;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,255,255,0.95)');
  grad.addColorStop(0.35, 'rgba(255,255,255,0.4)');
  grad.addColorStop(0.7, 'rgba(255,255,255,0.12)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  _radial = t;
  return t;
}

/** Open-ended cone of light between two points. */
export function shaftGeo(a, b, r0, r1, seg = 10) {
  const start = new THREE.Vector3(a[0], a[1], a[2]);
  const end = new THREE.Vector3(b[0], b[1], b[2]);
  const dir = new THREE.Vector3().subVectors(end, start);
  const len = dir.length();
  if (len < 1e-4) return null;
  const geo = new THREE.CylinderGeometry(r1, r0, len, seg, 1, true);
  geo.translate(0, len / 2, 0);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  geo.applyQuaternion(q);
  geo.translate(start.x, start.y, start.z);
  return geo;
}

/** Additive flat pool of light on the floor (normal up). */
export function lightPool(radius, x, z, y = 0.03, squash = 1) {
  const g = new THREE.CircleGeometry(radius, 20);
  g.rotateX(-Math.PI / 2);
  g.translate(x, y, z);
  if (squash !== 1) {
    g.scale(squash, 1, 1);
    g.translate(0, 0, 0);
  }
  return g;
}

// ---------------------------------------------------------------------------
// Shared layout constants derived from DIM
// ---------------------------------------------------------------------------

export const L = {
  naveHalf: DIM.centralNaveHalf, // 7.5 — central nave column line
  aisleOuter: DIM.naveWallX, // 15 — inner face of outer walls
  aisleVaultSpring: 25.5,
  aisleVaultCrown: 29.8,
  naveVaultSpring: 39.5,
  naveVaultCrown: 45,
  naveBays: [
    [12, 24],
    [24, 36],
    [36, 45],
  ],
  naveBaysNorth: [
    [-45, -36],
    [-36, -24],
    [-24, -12],
  ],
  transeptBays: [
    [12, 24],
    [24, 30],
  ],
  transeptBaysWest: [
    [-30, -24],
    [-24, -12],
  ],
  transeptAisleBays: [
    [12, 24],
    [24, 30],
  ],
  crossingHalf: 12, // open crossing square bounded by the four great columns
  crossingTop: DIM.crossingVaultY, // 60
};

/** Orthogonal frame helper: rotate a locally-built chapel/altar by ry then move. */
export function place(geo, x, z, ry = 0) {
  return xform(geo, { x, z, ry });
}

/** Shape of the crossing dome, shared by the vaults and the crossing columns. */
export const CROSSING_DOME = { R: 15.4, R0: 6.4, drop: 15, power: 1.55 };

/** Height of the crossing dome surface at a plan point (x, z). */
export function crossingDomeY(x, z) {
  const th = Math.atan2(z, x);
  const r = Math.hypot(x, z);
  const m = Math.max(Math.abs(Math.cos(th)), Math.abs(Math.sin(th)));
  const rEdge = CROSSING_DOME.R / m;
  const h = clamp((r - CROSSING_DOME.R0) / (rEdge - CROSSING_DOME.R0), 0, 1);
  return DIM.crossingVaultY - CROSSING_DOME.drop * Math.pow(h, CROSSING_DOME.power);
}

/**
 * Height of the nave / aisle vault outline at the crossing or apse boundary,
 * as a function of the coordinate across that boundary (|x| <= 15).
 * Shared so spandrel walls close exactly against the vaults they abut.
 */
export function vaultEdgeY(coord) {
  const a = Math.abs(coord);
  if (a <= DIM.centralNaveHalf) {
    const U = coord / DIM.centralNaveHalf;
    return L.naveVaultSpring + (L.naveVaultCrown - L.naveVaultSpring) * Math.max(0, 1 - U * U);
  }
  const U = clamp((a - 11.25) / 3.75, -1, 1);
  return L.aisleVaultSpring + (L.aisleVaultCrown - L.aisleVaultSpring) * Math.max(0, 1 - U * U);
}
