// CPU-only software renderer for the tower/roof geometry.
//
// No browser, no WebGL, no GPU: it builds the real geometry with the real
// builder modules (DOM stubbed for the procedural textures) and rasterises it
// with a z-buffer into a PNG. Useful for visual verification while headless
// browsers are off-limits.
//
// Usage:
//   node --import ./qa/towers/register.mjs qa/towers/render-wire.mjs out.png camX,camY,camZ lookX,lookY,lookZ [fov] [width] [height]

import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

// --- canvas stub so lib.js texture builders can construct materials ---------
function makeCtx() {
  const noop = () => {};
  const base = { measureText: (t) => ({ width: String(t).length * 30 }) };
  return new Proxy(base, {
    get(target, key) {
      if (key in target) return target[key];
      return noop;
    },
    set() {
      return true;
    },
  });
}
globalThis.document = {
  createElement: () => ({ width: 0, height: 0, getContext: () => makeCtx() }),
};

const THREE = await import('three');
const { GeoBuilder, bellProtos } = await import('../../src/towers/common.js');
const { buildApostles } = await import('../../src/towers/apostles.js');
const { buildRoofs } = await import('../../src/towers/roofs.js');
const { buildEvangelists } = await import('../../src/towers/evangelists.js');
const { buildJesus } = await import('../../src/towers/jesus.js');
const { buildVirgin } = await import('../../src/towers/virgin.js');
const { mergeGeos } = await import('../../src/lib.js');

// ---------------------------------------------------------------------------
// args
// ---------------------------------------------------------------------------
const argv = process.argv.slice(2);
const out = argv[0] || 'F:/repo-aiscan2/sagrada-familia/qa/towers/wire.png';
const vec = (s, d) => (s ? s.split(',').map(Number) : d);
const eye = new THREE.Vector3().fromArray(vec(argv[1], [106, 30, 132]));
const look = new THREE.Vector3().fromArray(vec(argv[2], [0, 70, -4]));
const fov = Number(argv[3] || 58);
const W = Number(argv[4] || 800);
const H = Number(argv[5] || 450);

// ---------------------------------------------------------------------------
// build geometry
// ---------------------------------------------------------------------------
const mats = new Proxy({}, { get: (_t, k) => ({ key: String(k) }) });
const b = new GeoBuilder();
buildApostles(b, mats);
buildEvangelists(b, mats);
buildJesus(b, mats);
buildVirgin(b, mats);
buildRoofs(b, mats);

// Flatten combined batches into { geo, matrix } render items.
const items = [];
for (const [key, geos] of b.batches) {
  const geo = mergeGeos(geos);
  if (geo) items.push({ key, geo, matrix: null });
}
for (const [key, e] of b.inst) {
  items.push({ key, geo: e.geo, matrices: e.matrices });
}

// ---------------------------------------------------------------------------
// palette (flat colours approximating the materials)
// ---------------------------------------------------------------------------
function colorFor(key) {
  if (key.startsWith('ap_') || key === 'evangelist' || key === 'jesus' || key === 'virgin') {
    return [0.78, 0.67, 0.52];
  }
  if (key.startsWith('text')) return null;
  if (key === 'trim' || key.startsWith('win') || key.startsWith('niche') || key === 'baluster' || key === 'pinnacle' || key.startsWith('roofPinnacle')) {
    if (key.endsWith('Glass')) return [0.1, 0.14, 0.2];
    return [0.55, 0.47, 0.37];
  }
  if (key === 'roof' || key === 'roofDouble') return [0.24, 0.44, 0.37];
  if (key === 'roofWall') return [0.7, 0.6, 0.46];
  if (key === 'roofEdge') return [0.34, 0.32, 0.29];
  if (key === 'gold' || key === 'goldGlow') return [0.95, 0.79, 0.34];
  if (key === 'star') return [1.0, 0.86, 0.4];
  if (key === 'bell' || key === 'bronze') return [0.45, 0.36, 0.24];
  if (key === 'wood') return [0.3, 0.2, 0.12];
  if (key === 'glass') return [0.1, 0.14, 0.2];
  if (key === 'dark') return [0.17, 0.15, 0.12];
  if (key === 'mosaic' || key === 'mosaicDark') return [0.24, 0.4, 0.64];
  if (key === 'trimLight') return [0.8, 0.72, 0.58];
  if (key === 'crest' || key === 'dormerFinial') return [0.55, 0.47, 0.37];
  return [0.6, 0.55, 0.45];
}

// ---------------------------------------------------------------------------
// camera + raster
// ---------------------------------------------------------------------------
const fwd = new THREE.Vector3().subVectors(look, eye).normalize();
const right = new THREE.Vector3().crossVectors(fwd, new THREE.Vector3(0, 1, 0)).normalize();
const up = new THREE.Vector3().crossVectors(right, fwd).normalize();
const focal = 1 / Math.tan((fov * Math.PI) / 180 / 2);
const halfH = H / 2;
const halfW = W / 2;

const zbuf = new Float32Array(W * H).fill(Infinity);
const rbuf = new Float32Array(W * H * 3);
// sky gradient
for (let y = 0; y < H; y++) {
  const t = y / H;
  for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 3;
    rbuf[i] = 0.55 + 0.2 * (1 - t);
    rbuf[i + 1] = 0.68 + 0.16 * (1 - t);
    rbuf[i + 2] = 0.8 + 0.12 * (1 - t);
  }
}

const L = new THREE.Vector3(0.55, 0.78, 0.3).normalize();

const v = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
const sp = [new Float32Array(3), new Float32Array(3), new Float32Array(3)];
const mat3 = new Float32Array(9);
const tmp = new THREE.Vector3();

function setMat3(m) {
  const e = m.elements;
  mat3[0] = e[0]; mat3[1] = e[1]; mat3[2] = e[2];
  mat3[3] = e[4]; mat3[4] = e[5]; mat3[5] = e[6];
  mat3[6] = e[8]; mat3[7] = e[9]; mat3[8] = e[10];
}

function triangle(ax, ay, az, bx, by, bz, cx, cy, cz, col) {
  // world normal for shading
  const ux = bx - ax, uy = by - ay, uz = bz - az;
  const vx = cx - ax, vy = cy - ay, vz = cz - az;
  let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
  const nl = Math.hypot(nx, ny, nz) || 1;
  nx /= nl; ny /= nl; nz /= nl;
  const ndl = Math.abs(nx * L.x + ny * L.y + nz * L.z);
  const shade = 0.32 + 0.68 * ndl;
  // project
  const proj = (x, y, z, o) => {
    const dx = x - eye.x, dy = y - eye.y, dz = z - eye.z;
    const cz2 = dx * fwd.x + dy * fwd.y + dz * fwd.z;
    if (cz2 <= 0.05) return false;
    const sx = dx * right.x + dy * right.y + dz * right.z;
    const sy = dx * up.x + dy * up.y + dz * up.z;
    o[0] = halfW + (sx / cz2) * focal * halfH;
    o[1] = halfH - (sy / cz2) * focal * halfH;
    o[2] = cz2;
    return true;
  };
  if (!proj(ax, ay, az, sp[0])) return;
  if (!proj(bx, by, bz, sp[1])) return;
  if (!proj(cx, cy, cz, sp[2])) return;
  const x0 = sp[0][0], y0 = sp[0][1], z0 = sp[0][2];
  const x1 = sp[1][0], y1 = sp[1][1], z1 = sp[1][2];
  const x2 = sp[2][0], y2 = sp[2][1], z2 = sp[2][2];
  const minX = Math.max(0, Math.floor(Math.min(x0, x1, x2)));
  const maxX = Math.min(W - 1, Math.ceil(Math.max(x0, x1, x2)));
  const minY = Math.max(0, Math.floor(Math.min(y0, y1, y2)));
  const maxY = Math.min(H - 1, Math.ceil(Math.max(y0, y1, y2)));
  if (minX > maxX || minY > maxY) return;
  const area = (x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0);
  if (Math.abs(area) < 1e-9) return;
  const inv = 1 / area;
  const cr = col[0] * shade, cg = col[1] * shade, cb = col[2] * shade;
  for (let py = minY; py <= maxY; py++) {
    const fy = py + 0.5;
    for (let px = minX; px <= maxX; px++) {
      const fx = px + 0.5;
      const w0 = ((x1 - fx) * (y2 - fy) - (x2 - fx) * (y1 - fy)) * inv;
      const w1 = ((x2 - fx) * (y0 - fy) - (x0 - fx) * (y2 - fy)) * inv;
      const w2 = 1 - w0 - w1;
      if (w0 < -1e-4 || w1 < -1e-4 || w2 < -1e-4) continue;
      const z = w0 * z0 + w1 * z1 + w2 * z2;
      const idx = py * W + px;
      if (z < zbuf[idx]) {
        zbuf[idx] = z;
        const i3 = idx * 3;
        rbuf[i3] = cr;
        rbuf[i3 + 1] = cg;
        rbuf[i3 + 2] = cb;
      }
    }
  }
}

// ---------------------------------------------------------------------------
// rasterise all items
// ---------------------------------------------------------------------------
let tris = 0;
for (const item of items) {
  const col = colorFor(item.key);
  if (!col) continue;
  const geo = item.geo;
  const pos = geo.attributes.position;
  const idx = geo.index;
  const count = idx ? idx.count : pos.count;
  const matrices = item.matrices || [null];
  for (const m of matrices) {
    let tx = 0;
    let ty = 0;
    let tz = 0;
    if (m) {
      setMat3(m);
      tx = m.elements[12];
      ty = m.elements[13];
      tz = m.elements[14];
    } else {
      mat3[0] = 1; mat3[1] = 0; mat3[2] = 0;
      mat3[3] = 0; mat3[4] = 1; mat3[5] = 0;
      mat3[6] = 0; mat3[7] = 0; mat3[8] = 1;
    }
    for (let t = 0; t < count; t += 3) {
      const i0 = idx ? idx.getX(t) : t;
      const i1 = idx ? idx.getX(t + 1) : t + 1;
      const i2 = idx ? idx.getX(t + 2) : t + 2;
      const p0 = [pos.getX(i0), pos.getY(i0), pos.getZ(i0)];
      const p1 = [pos.getX(i1), pos.getY(i1), pos.getZ(i1)];
      const p2 = [pos.getX(i2), pos.getY(i2), pos.getZ(i2)];
      const tr = (p) => [
        p[0] * mat3[0] + p[1] * mat3[3] + p[2] * mat3[6] + tx,
        p[0] * mat3[1] + p[1] * mat3[4] + p[2] * mat3[7] + ty,
        p[0] * mat3[2] + p[1] * mat3[5] + p[2] * mat3[8] + tz,
      ];
      const a = tr(p0), bb = tr(p1), c = tr(p2);
      triangle(a[0], a[1], a[2], bb[0], bb[1], bb[2], c[0], c[1], c[2], col);
      tris++;
    }
  }
}
console.log('rasterised triangles:', tris);

// ---------------------------------------------------------------------------
// PNG encode
// ---------------------------------------------------------------------------
const table = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = table[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const t = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
  return Buffer.concat([len, t, data, crc]);
}
const raw = Buffer.alloc((W * 3 + 1) * H);
const toByte = (v) => Math.max(0, Math.min(255, Math.round(Math.pow(Math.max(0, v), 1 / 2.2) * 255)));
for (let y = 0; y < H; y++) {
  const row = y * (W * 3 + 1);
  raw[row] = 0;
  for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 3;
    const o = row + 1 + x * 3;
    raw[o] = toByte(rbuf[i]);
    raw[o + 1] = toByte(rbuf[i + 1]);
    raw[o + 2] = toByte(rbuf[i + 2]);
  }
}
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W, 0);
ihdr.writeUInt32BE(H, 4);
ihdr[8] = 8;
ihdr[9] = 2;
const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr),
  chunk('IDAT', deflateSync(raw, { level: 6 })),
  chunk('IEND', Buffer.alloc(0)),
]);
writeFileSync(out, png);
console.log('wrote', out, W + 'x' + H);
