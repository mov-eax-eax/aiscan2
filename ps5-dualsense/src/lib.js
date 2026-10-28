// ============================================================
// lib.js - math, shape and geometry utilities
// ============================================================
import * as THREE from 'three';

export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const invLerp = (a, b, v) => (v - a) / (b - a);
export const smoothstep = (a, b, v) => {
  const t = clamp((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
export const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/** Monotone cubic Hermite interpolation over [(x,y), ...]. */
export class CubicSpline1D {
  constructor(points) {
    this.points = points.map(([x, y]) => ({ x, y })).sort((a, b) => a.x - b.x);
    const n = this.points.length;
    const h = [];
    const d = [];
    for (let i = 0; i < n - 1; i++) {
      const dx = this.points[i + 1].x - this.points[i].x;
      h.push(dx);
      d.push((this.points[i + 1].y - this.points[i].y) / dx);
    }
    const m = new Array(n);
    m[0] = d[0];
    m[n - 1] = d[n - 2];
    for (let i = 1; i < n - 1; i++) {
      if (d[i - 1] * d[i] <= 0) m[i] = 0;
      else m[i] = (d[i - 1] + d[i]) * 0.5;
    }
    for (let i = 0; i < n - 1; i++) {
      if (Math.abs(d[i]) < 1e-9) {
        m[i] = 0;
        m[i + 1] = 0;
        continue;
      }
      const a = m[i] / d[i];
      const b = m[i + 1] / d[i];
      const s = a * a + b * b;
      if (s > 9) {
        const t = 3 / Math.sqrt(s);
        m[i] = t * a * d[i];
        m[i + 1] = t * b * d[i];
      }
    }
    this.m = m;
  }

  eval(x) {
    const p = this.points;
    if (x <= p[0].x) return p[0].y;
    if (x >= p[p.length - 1].x) return p[p.length - 1].y;
    let lo = 0;
    let hi = p.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (p[mid].x <= x) lo = mid;
      else hi = mid;
    }
    const h = p[lo + 1].x - p[lo].x;
    const t = (x - p[lo].x) / h;
    const t2 = t * t;
    const t3 = t2 * t;
    const h00 = 2 * t3 - 3 * t2 + 1;
    const h10 = t3 - 2 * t2 + t;
    const h01 = -2 * t3 + 3 * t2;
    const h11 = t3 - t2;
    return h00 * p[lo].y + h10 * h * this.m[lo] + h01 * p[lo + 1].y + h11 * h * this.m[lo + 1];
  }
}

export function roundedRectShape(w, h, r, cx = 0, cy = 0) {
  const s = new THREE.Shape();
  const x = cx - w / 2;
  const y = cy - h / 2;
  r = Math.min(r, w / 2, h / 2);
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

export function superellipseShape(rx, ry, n = 4, segments = 96) {
  const s = new THREE.Shape();
  for (let i = 0; i <= segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    const c = Math.cos(a);
    const si = Math.sin(a);
    const x = rx * Math.sign(c) * Math.pow(Math.abs(c), 2 / n);
    const y = ry * Math.sign(si) * Math.pow(Math.abs(si), 2 / n);
    if (i === 0) s.moveTo(x, y);
    else s.lineTo(x, y);
  }
  return s;
}

export function extrudeShape(shape, depth = 0.2, bevel = 0.05, bevelSegments = 3, curveSegments = 24) {
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments,
    curveSegments,
    steps: 1,
  });
  geo.translate(0, 0, -depth / 2);
  geo.computeVertexNormals();
  return geo;
}

/** Round a 2D outline into a smooth sampled polygon. */
export function sampleRoundedRect2D(hy, hz, radius, arcSegments = 16, lineSegments = 8) {
  const r = Math.min(radius, hy * 0.92, hz * 0.92);
  const py = hy - r;
  const pz = hz - r;
  const pts = [];
  const arc = (cy, cz, a0, a1) => {
    for (let i = 0; i <= arcSegments; i++) {
      const a = lerp(a0, a1, i / arcSegments);
      pts.push(new THREE.Vector2(cy + r * Math.cos(a), cz + r * Math.sin(a)));
    }
  };
  const line = (y0, z0, y1, z1) => {
    for (let i = 1; i <= lineSegments; i++) {
      const t = i / lineSegments;
      pts.push(new THREE.Vector2(lerp(y0, y1, t), lerp(z0, z1, t)));
    }
  };
  // top-front corner
  arc(py, pz, 0, Math.PI / 2);
  // top edge (backwards along z)
  line(hy, pz, hy, -pz);
  // top-back corner
  arc(py, -pz, Math.PI / 2, Math.PI);
  // back edge
  line(py, -hz, -py, -hz);
  // bottom-back corner
  arc(-py, -pz, Math.PI, Math.PI * 1.5);
  // bottom edge
  line(-hy, -pz, -hy, pz);
  // bottom-front corner
  arc(-py, pz, Math.PI * 1.5, Math.PI * 2);
  // front edge, closing
  line(-py, hz, py, hz);
  // avoid duplicate closing point
  if (pts.length > 1) pts.pop();
  return pts;
}

function triKey(a, b, n) {
  return a < b ? a * n + b : b * n + a;
}

/** Subdivide a triangle mesh with shared edge vertices. */
export function subdivideTriangles(flatPositions, indices, levels = 1) {
  let pos = flatPositions.slice();
  let idx = indices.slice();
  for (let level = 0; level < levels; level++) {
    const next = [];
    const cache = new Map();
    const vertexCount = pos.length / 3;
    const getMid = (a, b) => {
      const k = triKey(a, b, vertexCount + 1000000);
      if (cache.has(k)) return cache.get(k);
      const i = pos.length / 3;
      pos.push(
        (pos[a * 3] + pos[b * 3]) / 2,
        (pos[a * 3 + 1] + pos[b * 3 + 1]) / 2,
        (pos[a * 3 + 2] + pos[b * 3 + 2]) / 2,
      );
      cache.set(k, i);
      return i;
    };
    for (let i = 0; i < idx.length; i += 3) {
      const a = idx[i];
      const b = idx[i + 1];
      const c = idx[i + 2];
      const ab = getMid(a, b);
      const bc = getMid(b, c);
      const ca = getMid(c, a);
      next.push(a, ab, ca, ab, b, bc, ca, bc, c, ab, bc, ca);
    }
    idx = next;
  }
  return { positions: pos, indices: idx };
}

/**
 * Build a thin, closed plate that follows a curved front/back surface.
 * shape: THREE.Shape; frontZ(x,y), backZ(x,y) world-space height.
 */
export function buildSurfacePlate(shape, frontZ, backZ, { curveSegments = 140, levels = 3 } = {}) {
  const contour = shape.getPoints(curveSegments);
  const tris = THREE.ShapeUtils.triangulateShape(contour, []);
  const basePositions = [];
  for (const p of contour) basePositions.push(p.x, p.y, 0);
  const baseIndices = [];
  for (const t of tris) baseIndices.push(t[0], t[1], t[2]);
  const { positions, indices } = subdivideTriangles(basePositions, baseIndices, levels);

  const out = [];
  const uv = [];
  const index = [];
  const n = positions.length / 3;
  const minX = Math.min(...contour.map((p) => p.x));
  const maxX = Math.max(...contour.map((p) => p.x));
  const minY = Math.min(...contour.map((p) => p.y));
  const maxY = Math.max(...contour.map((p) => p.y));
  // front cap
  for (let i = 0; i < n; i++) {
    const x = positions[i * 3];
    const y = positions[i * 3 + 1];
    out.push(x, y, frontZ(x, y));
    uv.push((x - minX) / (maxX - minX || 1), (y - minY) / (maxY - minY || 1));
  }
  for (const i of indices) index.push(i);
  // back cap
  for (let i = 0; i < n; i++) {
    const x = positions[i * 3];
    const y = positions[i * 3 + 1];
    out.push(x, y, backZ(x, y));
    uv.push((x - minX) / (maxX - minX || 1), (y - minY) / (maxY - minY || 1));
  }
  for (let i = 0; i < indices.length; i += 3) {
    index.push(indices[i] + n, indices[i + 2] + n, indices[i + 1] + n);
  }
  // side wall along contour
  const c = contour.length;
  const wallStart = (n * 2) * 3;
  for (let i = 0; i < c; i++) {
    const p = contour[i];
    const q = contour[(i + 1) % c];
    const a = n * 2 + i * 2;
    const b = n * 2 + i * 2 + 1;
    const cc = n * 2 + ((i + 1) % c) * 2;
    const d = n * 2 + ((i + 1) % c) * 2 + 1;
    out.push(p.x, p.y, frontZ(p.x, p.y));
    out.push(p.x, p.y, backZ(p.x, p.y));
    out.push(q.x, q.y, frontZ(q.x, q.y));
    out.push(q.x, q.y, backZ(q.x, q.y));
    uv.push(0, 0, 0, 1, 1, 0, 1, 1);
    index.push(a, b, cc, b, d, cc);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(out, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(index);
  geo.computeVertexNormals();
  return geo;
}

/** Warp a slab geometry (e.g. RoundedBoxGeometry) onto a curved deck. */
export function warpSlabToSurface(geo, zFunc, offset = 0, face = 1, cx = 0, cy = 0) {
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i) + cx;
    const y = pos.getY(i) + cy;
    const z = pos.getZ(i);
    pos.setX(i, x);
    pos.setY(i, y);
    pos.setZ(i, zFunc(x, y) + offset + z * face);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

export function surfaceNormal(zFunc, x, y, eps = 0.035, face = 1) {
  const dzdx = (zFunc(x + eps, y) - zFunc(x - eps, y)) / (2 * eps);
  const dzdy = (zFunc(x, y + eps) - zFunc(x, y - eps)) / (2 * eps);
  return new THREE.Vector3(-dzdx * face, -dzdy * face, face).normalize();
}

export function quaternionForNormal(normal) {
  return new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
}

export function makeCanvas(size = 512) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  return c;
}

export function canvasTexture(canvas, { srgb = false, repeat = null } = {}) {
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = 8;
  if (repeat) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeat[0], repeat[1]);
  }
  t.needsUpdate = true;
  return t;
}

export function makeRadialGlowTexture(size = 256, stops = null) {
  const c = makeCanvas(size);
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  const s = stops || [
    [0, 'rgba(255,255,255,1)'],
    [0.18, 'rgba(210,250,255,0.75)'],
    [0.45, 'rgba(80,220,255,0.25)'],
    [0.75, 'rgba(20,120,180,0.06)'],
    [1, 'rgba(0,0,0,0)'],
  ];
  for (const [p, col] of s) g.addColorStop(p, col);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return canvasTexture(c, { srgb: true });
}

export function makeContactShadowTexture(size = 512) {
  const c = makeCanvas(size);
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(0,0,0,0.82)');
  g.addColorStop(0.22, 'rgba(0,0,0,0.65)');
  g.addColorStop(0.5, 'rgba(0,0,0,0.28)');
  g.addColorStop(0.78, 'rgba(0,0,0,0.06)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return canvasTexture(c, { srgb: true });
}

/** Draw a rounded polygon path into a 2D context. */
export function roundedPolygonPath(ctx, points, r) {
  const n = points.length;
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const p = points[i];
    const prev = points[(i - 1 + n) % n];
    const next = points[(i + 1) % n];
    const v1 = new THREE.Vector2(prev.x - p.x, prev.y - p.y);
    const v2 = new THREE.Vector2(next.x - p.x, next.y - p.y);
    const l1 = v1.length();
    const l2 = v2.length();
    v1.normalize();
    v2.normalize();
    const a = p.x + v1.x * Math.min(r, l1 * 0.45);
    const b = p.y + v1.y * Math.min(r, l1 * 0.45);
    const c = p.x + v2.x * Math.min(r, l2 * 0.45);
    const d = p.y + v2.y * Math.min(r, l2 * 0.45);
    if (i === 0) ctx.moveTo(a, b);
    else ctx.lineTo(a, b);
    ctx.quadraticCurveTo(p.x, p.y, c, d);
  }
  ctx.closePath();
}