/**
 * Software wireframe preview: renders the instanced members of the model to
 * PNG files so the silhouette can be checked without a browser.
 *
 *   node tools/preview.mjs
 */
import fs from 'node:fs';
import zlib from 'node:zlib';
import path from 'node:path';
import * as THREE from 'three';
import { buildTower } from '../src/tower.js';
import { paint } from '../src/config.js';

const OUT = path.join(process.cwd(), 'preview');

/* ------------------------------ PNG writer ----------------------------- */
const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

function writePng(file, w, h, rgba) {
  const stride = w * 4;
  const raw = Buffer.alloc((stride + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
  fs.writeFileSync(file, png);
}

/* ------------------------------- render -------------------------------- */
const W = 900;
const H = 1100;
const MARGIN = 30;

function render(view, file, opts = {}) {
  const { yaw = 0, elev = 0, span = 380, centreY = 165, thick = 1 } = opts;
  const world = new THREE.Vector3();
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, yaw, 0));
  const qe = new THREE.Quaternion().setFromEuler(new THREE.Euler(elev, 0, 0));
  q.premultiply(qe);

  const scale = (H - MARGIN * 2) / span;
  const cx = W / 2;
  const cy = H / 2;

  const buf = Buffer.alloc(W * H * 4);
  for (let i = 0; i < W * H; i++) {
    const g = 12 + Math.round(18 * (1 - (i / W / H) % 1));
    buf[i * 4] = 6;
    buf[i * 4 + 1] = 9;
    buf[i * 4 + 2] = 16;
    buf[i * 4 + 3] = 255;
    void g;
  }

  const col = new THREE.Color();
  const pos = new THREE.Vector3();
  const quat = new THREE.Quaternion();
  const scl = new THREE.Vector3();
  const axis = new THREE.Vector3();
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const p0 = new THREE.Vector2();
  const p1 = new THREE.Vector2();

  const project = (v, out) => {
    world.copy(v).applyQuaternion(q);
    out.set(cx + world.x * scale, cy - (world.y - centreY) * scale);
  };

  let drawn = 0;
  for (const part of Object.values(tower.parts)) {
    const items = part.userData.builders.items;
    const n = Math.min(items.length, part.count);
    for (let i = 0; i < n; i++) {
      const it = items[i];
      it.m.decompose(pos, quat, scl);
      axis.set(0, 1, 0).applyQuaternion(quat);
      a.copy(pos).addScaledVector(axis, -scl.y / 2);
      b.copy(pos).addScaledVector(axis, scl.y / 2);
      project(a, p0);
      project(b, p1);
      paint(pos.y, col);
      const lift = 1.6;
      const r = Math.min(255, Math.round(col.r * 255 * lift + 60));
      const g = Math.min(255, Math.round(col.g * 255 * lift + 52));
      const bl = Math.min(255, Math.round(col.b * 255 * lift + 34));
      const t = scl.x > 0.3 ? thick + 1 : thick;
      line(buf, p0, p1, r, g, bl, t);
      drawn++;
    }
  }

  fs.mkdirSync(OUT, { recursive: true });
  writePng(path.join(OUT, file), W, H, buf);
  console.log(`${file}: ${drawn} members drawn`);
}

function line(buf, a, b, r, g, bl, t) {
  let x0 = Math.round(a.x);
  let y0 = Math.round(a.y);
  const x1 = Math.round(b.x);
  const y1 = Math.round(b.y);
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;
  let guard = 0;
  for (;;) {
    plot(buf, x0, y0, r, g, bl, t);
    if ((x0 === x1 && y0 === y1) || guard++ > 20000) break;
    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      x0 += sx;
    }
    if (e2 < dx) {
      err += dx;
      y0 += sy;
    }
  }
}

function plot(buf, x, y, r, g, b, t) {
  for (let j = 0; j < t; j++) {
    for (let i = 0; i < t; i++) {
      const px = x + i - (t >> 1);
      const py = y + j - (t >> 1);
      if (px < 0 || py < 0 || px >= W || py >= H) continue;
      const o = (py * W + px) * 4;
      buf[o] = Math.max(buf[o], r);
      buf[o + 1] = Math.max(buf[o + 1], g);
      buf[o + 2] = Math.max(buf[o + 2], b);
    }
  }
}

const t0 = Date.now();
const tower = buildTower({});
console.log(`built ${tower.counts.total} members in ${Date.now() - t0} ms`);

// front elevation, face on, as in the 1889 plates
render('front', 'front.png', { yaw: 0, elev: 0, span: 360, thick: 1 });
// three-quarter view
render('3/4', 'three-quarter.png', { yaw: 0.6, elev: -0.05, span: 360, thick: 1 });
// detail: the base
render('base', 'base.png', { yaw: 0.35, elev: -0.12, span: 230, centreY: 75, thick: 2 });
// detail: the summit
render('summit', 'summit.png', { yaw: 0.35, elev: 0, span: 120, centreY: 262, thick: 2 });
