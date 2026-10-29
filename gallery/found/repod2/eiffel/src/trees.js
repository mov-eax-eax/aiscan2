// ---------------------------------------------------------------------------
// trees.js - every tree in the scene.
//
// Parisian plane trees (platanes) are the signature of the Champ de Mars: a
// straight trunk pruned clear at 4-5 m, then a dense slightly flattened dome of
// foliage.  They line the central alley and the park edges in regular double
// rows aligned to the axis, the cross alleys, the Quai Branly and the Trocadero
// gardens, plus single rows along the city avenues with two other species
// (marronnier, tilleul) and a few large unpruned specimens.
//
// ~1250 trees live in 3 InstancedMesh (3 draw calls): three LOD variants.
// Trunk and canopy share one geometry, separated in the shader by aInfo.x.
// Wind sway, leaf-cluster shading and the silhouette cut-out are procedural; a
// matching customDepthMaterial (MeshDepthMaterial + RGBADepthPacking) runs the
// exact same displacement + discard so the cast shadows follow the sway.
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import common from './glsl/common.glsl';
import { clamp, lerp } from './rng.js';
import { UP } from './lib.js';
import {
  CHAMP, SEINE, TROCADERO, CITY,
  cityAllowed, isStreet,
} from './layout.js';

/* ==========================================================================
 * 0. build-time helpers (deterministic; nothing allocates in the frame loop)
 * ========================================================================== */

function ihash(x, y, z) {
  let n = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(z | 0, 1274126177);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

// value noise in JS - drives the lumpy blob silhouettes at build time
function vn3(x, y, z) {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
  const fx = x - ix, fy = y - iy, fz = z - iz;
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy), uz = fz * fz * (3 - 2 * fz);
  const c000 = ihash(ix, iy, iz), c100 = ihash(ix + 1, iy, iz);
  const c010 = ihash(ix, iy + 1, iz), c110 = ihash(ix + 1, iy + 1, iz);
  const c001 = ihash(ix, iy, iz + 1), c101 = ihash(ix + 1, iy, iz + 1);
  const c011 = ihash(ix, iy + 1, iz + 1), c111 = ihash(ix + 1, iy + 1, iz + 1);
  const x00 = lerp(c000, c100, ux), x10 = lerp(c010, c110, ux);
  const x01 = lerp(c001, c101, ux), x11 = lerp(c011, c111, ux);
  return lerp(lerp(x00, x10, uy), lerp(x01, x11, uy), uz);
}

/* Vertex accumulator: position plus the custom attributes the shaders need.
 * aInfo = (part, y/treeHeight, radial position inside the canopy 0..1, blob
 * seed);  aDef = the centre of the blob a vertex belongs to (the pivot of the
 * canopy shape deform).  Per instance: aMisc = (seed, species, variation). */
class Builder {
  constructor() {
    this.pos = []; this.nor = []; this.info = []; this.def = [];
    this.fixed = [];          // 1 = normal supplied by the caller
    this.idx = [];
  }
  // aInfo = (part, height/treeHeight, canopy rim factor, blob seed): one vec4
  // attribute instead of four floats - WebGL only guarantees 16 attribute slots
  // and instancing already eats four of them.
  vert(x, y, z, part, h, r, blob, dx, dy, dz) {
    const i = this.pos.length / 3;
    this.pos.push(x, y, z);
    this.nor.push(0, 0, 0);
    this.fixed.push(0);
    this.info.push(part, h, r, blob);
    this.def.push(dx, dy, dz);
    return i;
  }
  // analytic normal: on an ellipsoid the sphere poles are smooth, so the
  // canopy never shows a shading crease at the blob caps
  vertN(x, y, z, nx, ny, nz, part, h, r, blob, dx, dy, dz) {
    const i = this.pos.length / 3;
    this.pos.push(x, y, z);
    this.nor.push(nx, ny, nz);
    this.fixed.push(1);
    this.info.push(part, h, r, blob);
    this.def.push(dx, dy, dz);
    return i;
  }
  // (ox,oy,oz) must lie inside the surface: it orients the winding outward,
  // which removes every head-ache about sphere-pole vertex order.
  tri(a, b, c, ox, oy, oz) {
    const p = this.pos;
    const ax = p[a * 3], ay = p[a * 3 + 1], az = p[a * 3 + 2];
    const bx = p[b * 3], by = p[b * 3 + 1], bz = p[b * 3 + 2];
    const cx = p[c * 3], cy = p[c * 3 + 1], cz = p[c * 3 + 2];
    let nx = (by - ay) * (cz - az) - (bz - az) * (cy - ay);
    let ny = (bz - az) * (cx - ax) - (bx - ax) * (cz - az);
    let nz = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
    const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
    if (!(len > 1e-12)) return;                       // degenerate -> dropped
    nx /= len; ny /= len; nz /= len;
    const gx = (ax + bx + cx) / 3 - ox, gy = (ay + by + cy) / 3 - oy, gz = (az + bz + cz) / 3 - oz;
    if (nx * gx + ny * gy + nz * gz < 0) {
      const t = b; b = c; c = t; nx = -nx; ny = -ny; nz = -nz;
    }
    this.idx.push(a, b, c);
    if (!this.fixed[a]) { this.nor[a * 3] += nx; this.nor[a * 3 + 1] += ny; this.nor[a * 3 + 2] += nz; }
    if (!this.fixed[b]) { this.nor[b * 3] += nx; this.nor[b * 3 + 1] += ny; this.nor[b * 3 + 2] += nz; }
    if (!this.fixed[c]) { this.nor[c * 3] += nx; this.nor[c * 3 + 1] += ny; this.nor[c * 3 + 2] += nz; }
  }
  quad(a, b, c, d, ox, oy, oz) { this.tri(a, b, c, ox, oy, oz); this.tri(a, c, d, ox, oy, oz); }
  transformRange(i0, i1, m) {
    const e = m.elements;
    for (let i = i0; i < i1; i++) {
      let x = this.pos[i * 3], y = this.pos[i * 3 + 1], z = this.pos[i * 3 + 2];
      this.pos[i * 3] = e[0] * x + e[4] * y + e[8] * z + e[12];
      this.pos[i * 3 + 1] = e[1] * x + e[5] * y + e[9] * z + e[13];
      this.pos[i * 3 + 2] = e[2] * x + e[6] * y + e[10] * z + e[14];
      x = this.def[i * 3]; y = this.def[i * 3 + 1]; z = this.def[i * 3 + 2];
      this.def[i * 3] = e[0] * x + e[4] * y + e[8] * z + e[12];
      this.def[i * 3 + 1] = e[1] * x + e[5] * y + e[9] * z + e[13];
      this.def[i * 3 + 2] = e[2] * x + e[6] * y + e[10] * z + e[14];
    }
  }
  geo() {
    const n = this.pos.length / 3;
    const nor = new Float32Array(this.nor.length);
    for (let i = 0; i < n; i++) {
      let x = this.nor[i * 3], y = this.nor[i * 3 + 1], z = this.nor[i * 3 + 2];
      let l = Math.sqrt(x * x + y * y + z * z);
      if (l < 1e-8) { x = 0; y = 1; z = 0; l = 1; }
      if (this.fixed[i]) { nor[i * 3] = x / l; nor[i * 3 + 1] = y / l; nor[i * 3 + 2] = z / l; continue; }
      nor[i * 3] = x / l; nor[i * 3 + 1] = y / l; nor[i * 3 + 2] = z / l;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(this.pos), 3));
    g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    // no uv: everything is procedural, and each attribute slot is precious
    g.setAttribute('aInfo', new THREE.BufferAttribute(new Float32Array(this.info), 4));
    g.setAttribute('aDef', new THREE.BufferAttribute(new Float32Array(this.def), 3));
    g.setIndex(new THREE.BufferAttribute(
      n > 65535 ? new Uint32Array(this.idx) : new Uint16Array(this.idx), 1));
    return g;
  }
}

/* vertical tapered tube; rows = [{ y, r, x, z }] */
function addTube(b, rows, o) {
  const sides = o.sides, part = o.part, blob = o.blob, treeH = o.treeH;
  const hBase = o.hBase || 0, hMul = o.hMul === undefined ? 1 : o.hMul;
  const rings = [];
  for (let k = 0; k < rows.length; k++) {
    const row = rows[k];
    const ring = [];
    for (let i = 0; i <= sides; i++) {
      const a = (i % sides) / sides * Math.PI * 2;
      const x = row.x + Math.cos(a) * row.r;
      const z = row.z + Math.sin(a) * row.r;
      ring.push(b.vert(x, row.y, z, part,
        clamp((hBase + row.y * hMul) / treeH, 0, 1), 0, blob, x, row.y, z));
    }
    rings.push(ring);
  }
  for (let k = 0; k + 1 < rows.length; k++) {
    const A = rings[k], B = rings[k + 1];
    const oy = (rows[k].y + rows[k + 1].y) * 0.5;
    const ox = (rows[k].x + rows[k + 1].x) * 0.5, oz = (rows[k].z + rows[k + 1].z) * 0.5;
    for (let i = 0; i < sides; i++) b.quad(A[i], A[i + 1], B[i + 1], B[i], ox, oy, oz);
  }
  if (o.capTop) {
    const last = rows[rows.length - 1], R = rings[rings.length - 1];
    const c = b.vert(last.x, last.y, last.z, part,
      clamp((hBase + last.y * hMul) / treeH, 0, 1), 0, blob, last.x, last.y, last.z);
    for (let i = 0; i < sides; i++) b.tri(R[i], R[i + 1], c, last.x, last.y - 0.15, last.z);
  }
}

/* lumpy ellipsoid blob - the canopy is 4-7 of these */
function addBlob(b, o) {
  const cx = o.cx, cy = o.cy, cz = o.cz, rx = o.rx, ry = o.ry, rz = o.rz;
  const wSeg = o.wSeg, hSeg = o.hSeg, lump = o.lump, seed = o.seed;
  const treeH = o.treeH, cRad = o.cRad, blobSeed = o.blobSeed;
  const ringStart = [];
  for (let j = 0; j <= hSeg; j++) {
    const v = j / hSeg, th = v * Math.PI, st = Math.sin(th), ct = Math.cos(th);
    const pole = (j === 0 || j === hSeg);
    ringStart.push(b.pos.length / 3);
    const count = pole ? 1 : wSeg + 1;
    for (let i = 0; i < count; i++) {
      const u = pole ? 0 : i / wSeg;
      const ph = u * Math.PI * 2;
      const dx = st * Math.cos(ph), dy = ct, dz = st * Math.sin(ph);
      const L = 1 + lump * (vn3(dx * 1.6 + seed * 7.1, dy * 1.6 + seed * 3.3, dz * 1.6 + seed * 5.7) - 0.5) * 2;
      const px = cx + dx * rx * L, py = cy + dy * ry * L, pz = cz + dz * rz * L;
      // ellipsoid normal from the unit direction (rx,ry,rz are the blob radii)
      let nX = dx / (rx * rx), nY = dy / (ry * ry), nZ = dz / (rz * rz);
      const nl = Math.sqrt(nX * nX + nY * nY + nZ * nZ) || 1;
      nX /= nl; nY /= nl; nZ /= nl;
      b.vertN(px, py, pz, nX, nY, nZ, 1, clamp(py / treeH, 0, 1),
        clamp(Math.sqrt(px * px + pz * pz) / cRad, 0, 1), blobSeed, cx, cy, cz);
    }
  }
  for (let j = 0; j < hSeg; j++) {
    const a0 = ringStart[j], b0 = ringStart[j + 1];
    const top = (j === 0), bot = (j + 1 === hSeg);
    for (let i = 0; i < wSeg; i++) {
      const a1 = a0 + (top ? 0 : i), a2 = a0 + (top ? 0 : i + 1);
      const b1 = b0 + (bot ? 0 : i), b2 = b0 + (bot ? 0 : i + 1);
      b.quad(a1, b1, b2, a2, cx, cy, cz);      // pole quads collapse gracefully
    }
  }
}

/* ==========================================================================
 * 1. tree geometry - one pruned platane per LOD variant, trunk + canopy baked
 * ========================================================================== */

const VARIANT = [
  // 0: near - the alley rows, seen up close from the Champ de Mars
  { height: 12.0, clear: 4.6, canR: 3.95, sides: 9, trunkRings: 6, branches: 3,
    blobs: 5, wSeg: 14, hSeg: 8, lump: 0.20, trunkR: 0.245 },
  // 1: mid - outer edges, cross alleys, Trocadero gardens, Quai Branly
  { height: 11.2, clear: 4.3, canR: 3.60, sides: 7, trunkRings: 5, branches: 3,
    blobs: 5, wSeg: 11, hSeg: 7, lump: 0.24, trunkR: 0.225 },
  // 2: city - street trees, 3 species picked per instance in the shader
  { height: 9.6, clear: 3.5, canR: 3.00, sides: 6, trunkRings: 4, branches: 3,
    blobs: 4, wSeg: 10, hSeg: 6, lump: 0.29, trunkR: 0.185 },
];

function makeTreeGeometry(rng, cfg) {
  const b = new Builder();
  const H = cfg.height - cfg.clear;             // canopy vertical extent
  const ph = rng.range(0, Math.PI * 2);
  const lean = rng.range(0.05, 0.20);
  const R = cfg.trunkR;

  // --- trunk: tapered, root flare, gentle lean -----------------------------
  const top = cfg.clear + H * 0.40;
  const rows = [];
  for (let k = 0; k <= cfg.trunkRings; k++) {
    const t = k / cfg.trunkRings;
    const y = -0.45 + t * (top + 0.45);
    let r = lerp(R, R * 0.40, Math.pow(t, 0.78));
    r *= 1 + 1.55 * Math.exp(-t * 13.0);        // root flare
    r *= 1 + 0.055 * Math.sin(t * 8.5 + ph);    // faint buttress ripple
    const cx = Math.sin(t * 2.1 + ph) * lean * t * t;
    const cz = Math.cos(t * 1.6 + ph * 1.4) * lean * 0.8 * t * t;
    rows.push({ y, r, x: cx, z: cz });
  }
  addTube(b, rows, { sides: cfg.sides, part: 0, blob: 0.0, treeH: cfg.height, hBase: 0.45, capTop: true });

  // --- low pruned branches: a tube rotated into place ----------------------
  const q = new THREE.Quaternion(), m = new THREE.Matrix4();
  const origin = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1), dir = new THREE.Vector3();
  for (let j = 0; j < cfg.branches; j++) {
    const a = (j / cfg.branches) * Math.PI * 2 + rng.range(-0.45, 0.45);
    const y0 = cfg.clear * rng.range(0.74, 1.00);
    const tilt = rng.range(0.62, 1.02);
    const len = rng.range(1.0, 2.1) * (cfg.height / 12);
    dir.set(Math.sin(tilt) * Math.cos(a), Math.cos(tilt), Math.sin(tilt) * Math.sin(a));
    q.setFromUnitVectors(UP, dir);
    m.compose(origin.set(0, y0, 0), q, one);
    const i0 = b.pos.length / 3;
    const brows = [];
    for (let k = 0; k <= 3; k++) {
      const t = k / 3;
      brows.push({ y: t * len, r: R * lerp(0.60, 0.09, t), x: Math.sin(t * 1.7) * len * 0.10, z: 0 });
    }
    addTube(b, brows, {
      sides: 5, part: 0, blob: 0.35 + j * 0.13, treeH: cfg.height,
      hBase: y0, hMul: Math.max(0.3, dir.y), capTop: true,
    });
    b.transformRange(i0, b.pos.length / 3, m);
  }

  // --- canopy: 4-7 overlapping lumpy ellipsoids ---------------------------
  const blobs = [];
  blobs.push({ x: 0, y: cfg.clear + H * 0.52, z: 0, rx: cfg.canR * 0.68, ry: H * 0.46, rz: cfg.canR * 0.68 });
  const ringN = cfg.blobs - 1;
  for (let i = 0; i < ringN; i++) {
    const a = (i / ringN) * Math.PI * 2 + ph * 0.8;
    const rad = cfg.canR * rng.range(0.42, 0.58);
    const yy = cfg.clear + H * rng.range(0.34, 0.56);
    const rr = cfg.canR * rng.range(0.42, 0.54);
    blobs.push({
      x: Math.cos(a) * rad, y: yy, z: Math.sin(a) * rad,
      rx: rr, ry: H * rng.range(0.30, 0.40), rz: rr * rng.range(0.88, 1.12),
    });
  }
  const cRad = cfg.canR * 1.02;
  for (let i = 0; i < blobs.length; i++) {
    const bl = blobs[i];
    addBlob(b, {
      cx: bl.x, cy: bl.y, cz: bl.z, rx: bl.rx, ry: bl.ry, rz: bl.rz,
      wSeg: cfg.wSeg, hSeg: cfg.hSeg, lump: cfg.lump,
      seed: rng.range(0, 40), treeH: cfg.height, cRad,
      blobSeed: i / Math.max(1, blobs.length - 1),
    });
  }
  return b.geo();
}

/* ==========================================================================
 * 2. shaders
 * ========================================================================== */

const GLSL_VARY = /* glsl */`
varying vec3  vWorld;
varying vec3  vNrm;
varying vec3  vTint;
varying float vH;
varying float vR;
varying float vPart;
varying float vBlob;
varying float vSeed;
varying float vSpecies;
`;

const GLSL_ATTR = /* glsl */`
attribute vec4  aInfo;   // (part, height, canopy rim, blob seed)
attribute vec3  aDef;    // blob centre: pivot of the canopy shape deform
attribute vec2  aWind;   // wind axis in object space
attribute vec3  aMisc;   // (instance seed, species, shape variation)
attribute vec3  aTint;

uniform float uTime;
uniform vec2  uWindDir;
uniform float uWindAmp;
`;

/* species silhouette deform (object space, canopy only) + two-frequency wind
 * with a travelling gust wave.  Shared verbatim by the colour pass and by the
 * customDepthMaterial, so the cast shadows move with the leaves. */
const GLSL_VERTFUNC = /* glsl */`
vec3 treeShape(vec3 op) {
  if (aInfo.x < 0.5) return op;
  vec3 c = aDef;
  vec3 d = op - c;
  float kChest = (aMisc.y > 0.5 && aMisc.y < 1.5) ? 1.0 : 0.0;
  float kLime  = (aMisc.y > 1.5) ? 1.0 : 0.0;
  vec3 sf = vec3(1.0);
  sf.xz *= 1.0 + 0.22 * kChest - 0.17 * kLime + 0.13 * aMisc.z;
  sf.y  *= 1.0 + 0.26 * kChest + 0.32 * kLime - 0.11 * aMisc.z;
  d *= sf;
  d.xz *= mix(1.0, 1.0 - 0.55 * smoothstep(0.42, 1.0, aInfo.y), kLime);
  // clumpy foliage: coherent noise swells and hollows each blob so the
  // silhouette never reads as a clean ellipsoid
  float clump = vnoise(op * 0.62 + vec3(aMisc.x * 31.0)) - 0.5;
  d *= 1.0 + 0.34 * clump;
  return c + d;
}

vec3 treeSway(vec3 op) {
  vec3 iOrigin = vec3(0.0);
  #ifdef USE_INSTANCING
    iOrigin = instanceMatrix[3].xyz;
  #endif
  float hgt = clamp(aInfo.y, 0.0, 1.0);
  float leaf = step(0.5, aInfo.x);
  float stiff = mix(0.20, 1.0, leaf);                       // trunk barely moves
  float rim = mix(0.45, 0.42 + 0.95 * aInfo.z, leaf);            // stronger at the rim
  float amp = uWindAmp * 0.30 * stiff * rim * (0.05 + pow(hgt, 1.7));
  float phz = aMisc.x * 6.2831853 + aInfo.w * 2.1 + aMisc.z * 0.7;
  float t = uTime;
  vec2 w1 = vec2(sin(t * 0.83 + phz), cos(t * 0.71 + phz * 1.31));
  vec2 w2 = vec2(sin(t * 2.17 + phz * 1.7), cos(t * 1.83 + phz * 2.3));
  float g = sin(dot(iOrigin.xz, uWindDir) * 0.045 - t * 0.80 + aMisc.x * 0.9);
  g = 0.45 + 0.55 * (0.5 + 0.5 * g) * (0.5 + 0.5 * g);      // travelling gust
  vec2 sw = (w1 * 0.62 + w2 * 0.38) * amp * g;
  vec2 pp = vec2(-aWind.y, aWind.x);
  sw += pp * sin(t * 3.1 + phz * 3.7 + hgt * 5.0) * amp * 0.32 * leaf;
  vec2 disp = aWind * sw.x + pp * sw.y;
  vec3 out3 = op;
  out3.xz += disp;
  out3.y += sin(t * 1.27 + phz * 1.9) * amp * 0.16 * leaf;
  out3.y -= dot(disp, disp) * 0.30;
  return out3;
}

vec3 treeVertex(vec3 pos) { return treeSway(treeShape(pos)); }
`;

const GLSL_UNIFRAG = /* glsl */`
uniform vec3  uSunDir;
uniform vec3  uSunCol;
uniform vec3  uSkyAmb;
uniform vec3  uGndAmb;
uniform vec3  uFogCol;
uniform vec3  uMoonDir;
uniform vec3  uLeafA;
uniform vec3  uLeafB;
uniform vec3  uLeafDry;
uniform vec3  uBarkA;
uniform vec3  uBarkB;
uniform vec3  uBarkPale;
uniform float uSunI;
uniform float uMoonI;
uniform float uFogDensity;
uniform float uGolden;
uniform float uSeason;
uniform float uLeafBump;
uniform float uTime;
`;

/* identical in the colour pass and in the depth pass: the shadow silhouette
 * breaks exactly where the leaves break */
const GLSL_CUT = /* glsl */`
uniform float uAlphaCut;
// three octaves between roughly 8 cm and 45 cm: the rim breaks into leaf
// clusters, not into holes.  Shared verbatim with the depth pass so the cast
// shadow breaks exactly where the leaves break.
float treeLeafCut(vec3 wp, float rim, float blob, float seed) {
  vec3 q = wp + vec3(seed * 17.0, blob * 9.0, seed * 5.0);
  float cut = vnoise(q * 2.2 + 11.0) * 0.34
            + vnoise(q * 5.7) * 0.40
            + vnoise(q * 13.0 + 3.0) * 0.26;
  return cut - uAlphaCut * (0.13 + 0.55 * rim);
}
`;

const VERT = /* glsl */`
${common}
${GLSL_ATTR}
${GLSL_VARY}
${GLSL_VERTFUNC}

void main() {
  vec3 op = treeVertex(position);
  vec4 world = vec4(op, 1.0);
  vec3 nrm = normal;
  #ifdef USE_INSTANCING
    world = instanceMatrix * world;
    nrm = mat3(instanceMatrix[0].xyz, instanceMatrix[1].xyz, instanceMatrix[2].xyz) * nrm;
  #endif
  world = modelMatrix * world;
  nrm = mat3(modelMatrix[0].xyz, modelMatrix[1].xyz, modelMatrix[2].xyz) * nrm;

  vWorld = world.xyz;
  vNrm = normalize(nrm);
  vTint = aTint;
  vH = aInfo.y; vR = aInfo.z; vPart = aInfo.x; vBlob = aInfo.w;
  vSeed = aMisc.x; vSpecies = aMisc.y;
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

const FRAG = /* glsl */`
${common}
${GLSL_VARY}
${GLSL_UNIFRAG}
${GLSL_CUT}

void main() {
  vec3 V = normalize(cameraPosition - vWorld);
  vec3 N = normalize(vNrm);
  float dist = distance(cameraPosition, vWorld);
  vec3 sunWarm = uSunCol * mix(vec3(1.0), vec3(1.22, 0.95, 0.72), uGolden);
  vec3 col;

  if (vPart > 0.5) {
    /* ---- leaf clusters ---- */
    if (treeLeafCut(vWorld, vR, vBlob, vSeed) < 0.0) discard;

    vec3 q = vWorld + vec3(vSeed * 17.0, vBlob * 9.0, vSeed * 5.0);
    float n1 = vnoise(q * 1.10);
    float n2 = vnoise(q * 3.30 + 3.7);
    float n3 = vnoise(q * 8.50 + 11.3);
    vec3 Nl = normalize(N + vec3(n1 - n2, n2 - n3, n3 - n1) * uLeafBump);

    vec3 leaf = mix(uLeafA, uLeafB, n2) * vTint * mix(0.86, 1.14, vBlob);
    leaf = mix(leaf, uLeafDry * vTint, uSeason * (0.30 + 0.70 * n1));

    float ndl = dot(Nl, uSunDir);
    float diff = max(ndl, 0.0);
    float wrap = clamp(ndl * 0.5 + 0.5, 0.0, 1.0);
    float flutter = 0.86 + 0.26 * vnoise(q * 2.0 + vec3(uTime * 0.75));
    vec3 lit = leaf * sunWarm * uSunI * (diff * 0.70 + wrap * 0.40) * flutter;

    /* sky-transmitted leaves: bright translucent rim */
    float fres = 1.0 - clamp(abs(dot(Nl, V)), 0.0, 1.0);
    float trans = pow(clamp(dot(-Nl, uSunDir) * 0.5 + 0.5, 0.0, 1.0), 2.4);
    vec3 transLeaf = mix(leaf * vec3(1.28, 1.20, 0.66), leaf * vec3(1.45, 1.02, 0.44), uGolden);
    vec3 thru = transLeaf * sunWarm * uSunI * trans * (0.50 + 0.80 * fres) * 0.85;

    float up = Nl.y * 0.5 + 0.5;
    vec3 amb = mix(uGndAmb, uSkyAmb, up) * leaf * 1.10;
    vec3 moon = leaf * max(dot(Nl, uMoonDir), 0.0) * uMoonI * vec3(0.55, 0.70, 1.0);

    float baseShade = mix(0.42, 1.0, smoothstep(0.02, 0.42, vH));
    float inner = mix(0.60, 1.0, smoothstep(0.08, 0.85, vR));
    col = (lit + thru + amb + moon) * baseShade * inner;

  } else {
    /* ---- plane-tree bark: vertical ridges + pale mottled patches ---- */
    vec3 p = vWorld + vec3(vSeed * 7.0, 0.0, vSeed * 3.0);
    float rg  = ridge(vec3(p.x * 7.5, p.y * 0.85, p.z * 7.5), 3);      // vertical ridges
    float rg2 = vnoise(vec3(p.x * 17.0, p.y * 2.60, p.z * 17.0));      // grain / cracks
    float bark = clamp(rg * 0.66 + rg2 * 0.34, 0.0, 1.0);
    vec3 bc = mix(uBarkA, uBarkB, bark);
    bc *= 0.80 + 0.28 * rg2;
    // the signature pale camouflage flakes of a plane tree
    float mottle = vnoise(vec3(p.x * 2.6, p.y * 1.10, p.z * 2.6) + vec3(2.0));
    float pm = smoothstep(0.48, 0.70, mottle + 0.20 * (rg - 0.5));
    bc = mix(bc, uBarkPale, pm * 0.72);

    float base = 1.0 - smoothstep(0.0, 0.26, vH);
    bc *= mix(1.0, 0.45, base);
    bc = mix(bc, bc * vec3(0.70, 0.84, 0.60), base * 0.65);

    vec3 Nl = normalize(N + vec3(rg - 0.5, (rg2 - 0.5) * 0.4, rg2 - 0.5) * 0.55);
    float ndl = dot(Nl, uSunDir);
    float up = Nl.y * 0.5 + 0.5;
    vec3 amb = mix(uGndAmb, uSkyAmb, up) * 1.15;
    col = bc * (sunWarm * uSunI * (max(ndl, 0.0) * 0.85 + clamp(ndl * 0.5 + 0.5, 0.0, 1.0) * 0.15)
               + amb + uMoonI * vec3(0.50, 0.66, 1.0) * max(dot(Nl, uMoonDir), 0.0));
  }

  col = applyAerial(col, uFogCol, dist, uFogDensity);
  gl_FragColor = vec4(col, 1.0);
}
`;

/* ==========================================================================
 * 3. placement
 * ========================================================================== */

// spatial hash keeping trunks apart
class Spacer {
  constructor(cell) { this.cell = cell; this.map = new Map(); }
  ok(x, z, sep) {
    const cx = Math.floor(x / this.cell), cz = Math.floor(z / this.cell);
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
      const a = this.map.get((cx + i) + ':' + (cz + j));
      if (!a) continue;
      for (let k = 0; k < a.length; k += 2) {
        const dx = a[k] - x, dz = a[k + 1] - z;
        if (dx * dx + dz * dz < sep * sep) return false;
      }
    }
    return true;
  }
  add(x, z) {
    const k = Math.floor(x / this.cell) + ':' + Math.floor(z / this.cell);
    let a = this.map.get(k);
    if (!a) { a = []; this.map.set(k, a); }
    a.push(x, z);
  }
}

// wind direction: drives the travelling gust wave and the object-space sway axis
const WIND = { x: 0.80, z: 0.60 };
const WIND_LEN = Math.hypot(WIND.x, WIND.z);
WIND.x /= WIND_LEN; WIND.z /= WIND_LEN;

function speciesTint(rng, species) {
  const hue = rng.range(-1, 1);
  const lum = 1 + rng.gauss(0, 0.09);
  let r = lum * (1 + 0.11 * hue), g = lum, b = lum * (1 - 0.13 * hue);
  if (species === 1) { r *= 0.92; g *= 1.03; b *= 0.90; }        // marronnier
  else if (species === 2) { r *= 1.10; g *= 1.05; b *= 0.78; }   // tilleul
  return [clamp(r, 0.6, 1.5), clamp(g, 0.6, 1.5), clamp(b, 0.6, 1.5)];
}

/* ==========================================================================
 * 4. factory
 * ========================================================================== */

export function createTrees(ctx) {
  const rng = ctx.rng;
  const slots = [[], [], []];               // one bucket per LOD variant
  const spacer = new Spacer(12);

  function addTree(x, z, variant, o) {
    const sep = o.sep || 5.4;
    if (!spacer.ok(x, z, sep)) return false;
    spacer.add(x, z);
    const yaw = o.yaw === undefined ? rng.range(0, Math.PI * 2) : o.yaw;
    const species = o.species === undefined ? 0 : o.species;
    const s = o.s !== undefined ? o.s : rng.range(0.94, 1.10);
    const vr = o.vr !== undefined ? o.vr : rng.gauss(0, 0.34);
    const seed = rng.next();
    const cs = Math.cos(yaw), sn = Math.sin(yaw);   // world wind -> object space
    slots[variant].push({
      x, z, yaw, s, species,
      vr: clamp(vr, -1, 1),
      seed,
      tint: speciesTint(rng, species),
      wx: cs * WIND.x - sn * WIND.z,
      wz: sn * WIND.x + cs * WIND.z,
    });
    return true;
  }

  /* ---- 4.1 Champ de Mars: regular rows aligned to the axis --------------- */
  const zA = CHAMP.z0 + 20, zB = CHAMP.z1 - 24;      // 170 .. 936
  const PITCH = 11;
  const alleyX = [CHAMP.alleyHalf + 3.2, CHAMP.alleyHalf + 9.4];   // 16.2 / 22.4
  const beltX = [CHAMP.lawnOuter + 3.5, CHAMP.pathOuter - 3.0];    // 77.5 / 93
  for (let z = zA; z <= zB; z += PITCH) {
    const zz = z + rng.range(-0.35, 0.35);
    for (let r = 0; r < alleyX.length; r++) {
      for (let si = 0; si < 2; si++) {
        const sx = si === 0 ? -1 : 1;
        const gap = rng.chance(0.03);
        const jx = rng.range(-0.3, 0.3);
        const sp = rng.chance(0.05) ? 1 : 0;
        if (gap) continue;
        addTree(sx * (alleyX[r] + jx), zz, 0, { species: sp, s: rng.range(0.97, 1.10) });
      }
    }
    for (let r = 0; r < beltX.length; r++) {
      for (let si = 0; si < 2; si++) {
        const sx = si === 0 ? -1 : 1;
        const gap = rng.chance(0.05);
        const jx = rng.range(-0.5, 0.5);
        if (gap) continue;
        addTree(sx * (beltX[r] + jx), zz + rng.range(-0.5, 0.5), 1, { s: rng.range(0.92, 1.18) });
      }
    }
  }
  // rows along the cross alleys
  for (let ci = 0; ci < CHAMP.crossPaths.length; ci++) {
    const cz = CHAMP.crossPaths[ci];
    for (let si = 0; si < 2; si++) {
      for (let sj = 0; sj < 2; sj++) {
        const zz = cz + (sj === 0 ? -1 : 1) * (CHAMP.crossHalf + 2.8);
        for (let x = CHAMP.alleyHalf + 6; x <= CHAMP.lawnOuter - 3; x += PITCH) {
          const px = (si === 0 ? -1 : 1) * (x + rng.range(-0.3, 0.3));
          addTree(px, zz + rng.range(-0.4, 0.4), 1, { s: rng.range(0.94, 1.12) });
        }
      }
    }
  }

  /* ---- 4.2 Quai Branly strip: loose double row along the left bank ------- */
  for (let zi = 0; zi < 2; zi++) {
    const zz = SEINE.zNear + 20 + zi * 17;
    for (let x = -560; x <= 560; x += 13) {
      if (Math.abs(x) < 34) continue;                     // clear of the Pont d'Iena
      const keep = rng.chance(0.62), sp = rng.chance(0.12) ? 1 : 0;
      if (!keep) continue;
      addTree(x + rng.range(-2.5, 2.5), zz + rng.range(-4.0, 4.0), 1,
        { s: rng.range(0.95, 1.24), species: sp });
    }
  }

  /* ---- 4.3 Trocadero gardens: loose clumps flanking the basin ------------ */
  for (let z = TROCADERO.z0 - 8; z >= TROCADERO.z1 + 12; z -= 12) {
    for (let x = -122; x <= 122; x += 12) {
      const ax = Math.abs(x);
      if (ax < TROCADERO.basin.xHalf + 8) continue;        // the water basin
      const dens = ax < 50 ? 0.55 : (ax < 84 ? 0.34 : 0.19);
      const keep = rng.chance(dens);
      const sp = rng.chance(0.16) ? 1 : 0;
      if (!keep) continue;
      addTree(x + rng.range(-4.5, 4.5), z + rng.range(-4.5, 4.5), 1,
        { s: rng.range(0.90, 1.32), species: sp, vr: rng.gauss(0.1, 0.4) });
    }
  }
  // large unpruned specimens flanking the basin
  for (let i = 0; i < 5; i++) {
    const zz = TROCADERO.basin.z0 - 18 - i * 46;
    for (let si = 0; si < 2; si++) {
      const sx = si === 0 ? -1 : 1;
      addTree(sx * (TROCADERO.basin.xHalf + rng.range(16, 26)), zz + rng.range(-6, 6), 0,
        { s: rng.range(1.30, 1.48), vr: rng.range(0.55, 0.95), species: 0, sep: 7 });
    }
  }

  /* ---- 4.4 city avenues: 9 m rows, evenly thinned with distance ---------- */
  const P = CITY.block + CITY.street;
  const RMAX = 1500;
  const KI = Math.floor(RMAX / P);
  const cityCand = [];
  for (let k = -KI; k <= KI; k++) {
    const line = k * P;
    for (let side = 0; side < 2; side++) {
      const sg = side === 0 ? 1 : -1;
      for (let t = -RMAX; t <= RMAX; t += 9) {
        // verge of a vertical avenue
        let x = line + (sg > 0 ? CITY.street + 1.7 : -1.7), z = t;
        const fz = ((z % P) + P) % P;
        if (fz > CITY.street + 5 && fz < P - 4 && cityAllowed(x, z) &&
            isStreet(x - sg * 2.6, z)) cityCand.push([x, z]);
        // verge of a horizontal avenue
        x = t; z = line + (sg > 0 ? CITY.street + 1.7 : -1.7);
        const fx = ((x % P) + P) % P;
        if (fx > CITY.street + 5 && fx < P - 4 && cityAllowed(x, z) &&
            isStreet(x, z - sg * 2.6)) cityCand.push([x, z]);
      }
    }
  }
  // deterministic shuffle -> even thinning instead of a hard radial cut
  for (let i = cityCand.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    const t = cityCand[i]; cityCand[i] = cityCand[j]; cityCand[j] = t;
  }
  let cityCount = 0;
  for (let i = 0; i < cityCand.length && cityCount < 380; i++) {
    const x = cityCand[i][0], z = cityCand[i][1];
    const r = Math.hypot(x, z);
    const p = r < 420 ? 1.0 : (r < 800 ? 0.55 : 0.26);
    const big = rng.chance(0.018);
    const roll = rng.next();
    const sp = roll < 0.55 ? 0 : (roll < 0.80 ? 1 : 2);
    if (!rng.chance(p)) continue;
    const ok = big
      ? addTree(x, z, 0, { s: rng.range(1.26, 1.46), vr: rng.range(0.5, 0.95), species: 0, sep: 8.6 })
      : addTree(x, z, 2, { s: rng.range(0.82, 1.26), species: sp, sep: 8.6 });
    if (ok) cityCount++;
  }

  return finish(slots, rng);
}

/* ==========================================================================
 * 5. instancing, materials, uniforms, per-frame update
 * ========================================================================== */

function finish(slots, rng) {
  const group = new THREE.Group();
  group.name = 'trees';

  const uniforms = {
    uTime: { value: 0 },
    uWindDir: { value: new THREE.Vector2(WIND.x, WIND.z) },
    uWindAmp: { value: 0.8 },
    uSunDir: { value: new THREE.Vector3(0.4, 0.6, 0.7) },
    uSunCol: { value: new THREE.Color(0xfff2dc) },
    uSunI: { value: 1.0 },
    uSkyAmb: { value: new THREE.Color(0x9db4c8) },
    uGndAmb: { value: new THREE.Color(0x4a4740) },
    uFogCol: { value: new THREE.Color(0xbfd2e2) },
    uMoonDir: { value: new THREE.Vector3(-0.4, 0.6, -0.7) },
    uMoonI: { value: 0 },
    uGolden: { value: 0 },
    uSeason: { value: 0.26 },
    uLeafBump: { value: 0.80 },
    uAlphaCut: { value: 0.72 },
    uFogDensity: { value: 0.00036 },
    uLeafA: { value: new THREE.Color(0x35601f) },
    uLeafB: { value: new THREE.Color(0x6d9a38) },
    uLeafDry: { value: new THREE.Color(0x8d8b3c) },
    uBarkA: { value: new THREE.Color(0x4b453a) },
    uBarkB: { value: new THREE.Color(0x6e6553) },
    uBarkPale: { value: new THREE.Color(0xb0a68e) },
  };

  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: VERT,
    fragmentShader: FRAG,
    side: THREE.FrontSide,
    fog: false,
  });
  material.name = 'treeLeaves';

  // depth pass: same displacement, same cut-out -> shadows follow the sway
  const depthMat = new THREE.MeshDepthMaterial({
    depthPacking: THREE.RGBADepthPacking,
    side: THREE.FrontSide,
  });
  depthMat.name = 'treeDepth';
  depthMat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uniforms.uTime;
    shader.uniforms.uWindDir = uniforms.uWindDir;
    shader.uniforms.uWindAmp = uniforms.uWindAmp;
    shader.uniforms.uAlphaCut = uniforms.uAlphaCut;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\n' + common + GLSL_ATTR + GLSL_VARY + GLSL_VERTFUNC)
      .replace('#include <begin_vertex>', [
        'vec3 transformed = treeVertex(position);',
        'vec4 treeWP = vec4(transformed, 1.0);',
        '#ifdef USE_INSTANCING',
        '  treeWP = instanceMatrix * treeWP;',
        '#endif',
        'vWorld = (modelMatrix * treeWP).xyz;',
        'vNrm = normal; vTint = aTint; vH = aInfo.y; vR = aInfo.z;',
        'vPart = aInfo.x; vBlob = aInfo.w; vSeed = aMisc.x; vSpecies = aMisc.y;',
      ].join('\n'));
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\n' + common + GLSL_CUT +
        'varying vec3 vWorld;\nvarying float vR;\nvarying float vBlob;\n' +
        'varying float vSeed;\nvarying float vPart;\n')
      .replace('#include <alphatest_fragment>',
        'if (vPart > 0.5) { if (treeLeafCut(vWorld, vR, vBlob, vSeed) < 0.0) discard; }');
  };

  let trees = 0, tris = 0, calls = 0;
  const m = new THREE.Matrix4(), q = new THREE.Quaternion();
  const pv = new THREE.Vector3(), sv = new THREE.Vector3();
  for (let v = 0; v < slots.length; v++) {
    const list = slots[v];
    if (!list.length) continue;
    const geo = makeTreeGeometry(rng, VARIANT[v]);
    const n = list.length;
    const aMisc = new Float32Array(n * 3);
    const aWind = new Float32Array(n * 2), aTint = new Float32Array(n * 3);
    const mesh = new THREE.InstancedMesh(geo, material, n);
    for (let i = 0; i < n; i++) {
      const t = list[i];
      q.setFromAxisAngle(UP, t.yaw);
      m.compose(pv.set(t.x, 0, t.z), q, sv.set(t.s, t.s, t.s));
      mesh.setMatrixAt(i, m);
      aMisc[i * 3] = t.seed; aMisc[i * 3 + 1] = t.species; aMisc[i * 3 + 2] = t.vr;
      aWind[i * 2] = t.wx; aWind[i * 2 + 1] = t.wz;
      aTint[i * 3] = t.tint[0]; aTint[i * 3 + 1] = t.tint[1]; aTint[i * 3 + 2] = t.tint[2];
    }
    mesh.instanceMatrix.needsUpdate = true;
    geo.setAttribute('aMisc', new THREE.InstancedBufferAttribute(aMisc, 3));
    geo.setAttribute('aWind', new THREE.InstancedBufferAttribute(aWind, 2));
    geo.setAttribute('aTint', new THREE.InstancedBufferAttribute(aTint, 3));
    geo.computeBoundingSphere();
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.customDepthMaterial = depthMat;
    mesh.frustumCulled = false;
    mesh.name = 'trees_lod' + v;
    group.add(mesh);
    trees += n; calls++;
    tris += (geo.index ? geo.index.count / 3 : 0) * n;
  }

  group.userData.stats = {
    trees, drawCalls: calls, triangles: Math.round(tris),
    variants: slots.map((s) => s.length),
  };

  // ---- per-frame update: reuses uniform objects, allocates nothing --------
  function update(tod, time, camera, fog) {
    const p = tod.pal;
    uniforms.uTime.value = time;
    uniforms.uWindAmp.value = 0.72 + 0.34 * Math.sin(time * 0.061) + 0.18 * Math.sin(time * 0.017 + 1.3);
    uniforms.uSunDir.value.copy(tod.sunDir);
    uniforms.uMoonDir.value.copy(tod.moonDir);
    uniforms.uSunCol.value.copy(p.sun);
    uniforms.uSunI.value = p.sunI;
    uniforms.uSkyAmb.value.copy(p.amb).multiplyScalar(p.ambI);
    uniforms.uGndAmb.value.copy(p.ground).multiplyScalar(p.ambI * 0.55);
    uniforms.uMoonI.value = p.moon * clamp(tod.moonDir.y * 2.0, 0, 1) * 0.55;
    uniforms.uGolden.value = clamp(1 - Math.abs(tod.sunElevation - 3.5) / 11, 0, 1) *
      (tod.sunElevation > -5 ? 1 : 0);
    uniforms.uSeason.value = 0.22 + 0.10 * Math.sin(time * 0.011);
    uniforms.uFogCol.value.copy(fog);
    void camera;
  }

  return { group, update };
}