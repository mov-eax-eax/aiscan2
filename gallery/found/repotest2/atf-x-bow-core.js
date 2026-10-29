/* ============================================================================
 *  FIVICS ATF-X  ·  Core Engine
 *  A dependency-free WebGL2 engine: math, geometry builders, PBR-ish shading,
 *  procedural material textures, colour-id picking, orbit camera, annotations.
 *  1 unit = 1 millimetre.  Bow plane = Y/Z (riser vertical, limbs curve in Z).
 * ==========================================================================*/
(function () {
'use strict';

/* ------------------------------------------------------------------ 1. STATE */
var STATE = {
  gl: null, canvas: null, vw: 0, vh: 0, dpr: 1,
  objs: [], groups: [], byId: {},
  wire: false, labels: true, dims: true, ghost: false, grid: true, auto: true,
  tex: true, explode: 0, sel: null, hover: null,
  cam: { az: -22, el: 8, dist: 2500, tx: 0, ty: 0, tz: 0, fov: 42 },
  t0: performance.now(), time: 0, fps: 0, acc: 0, frames: 0, tris: 0, drew: 0,
  pickFB: null, pickRB: null, pickBuf: new Uint8Array(4), pickReady: false,
  sections: [], ready: false
};
window.S = STATE;
window.STATE = STATE;
window.reg = function (n, f) { STATE.sections.push([n, f]); };
window.boot = function () { for (var i = 0; i < STATE.sections.length; i++) STATE.sections[i][1](); };

window.fail = function (msg) {
  var e = document.getElementById('err');
  if (e) { e.style.display = 'block'; e.innerHTML = '<b>引擎错误</b><br>' + msg; }
};

/* ----------------------------------------------------------------- 2. MATH */
var DEG = Math.PI / 180;
window.DEG = DEG;

function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
window.clamp = clamp;
function lerp(a, b, t) { return a + (b - a) * t; }
window.lerp = lerp;
function smooth(t) { return t * t * (3 - 2 * t); }
window.smooth = smooth;

function V3(x, y, z) { return { x: x || 0, y: y || 0, z: z || 0 }; }
window.V3 = V3;
function vsub(a, b) { return V3(a.x - b.x, a.y - b.y, a.z - b.z); }
window.vsub = vsub;
function vadd(a, b) { return V3(a.x + b.x, a.y + b.y, a.z + b.z); }
window.vadd = vadd;
function vscale(a, s) { return V3(a.x * s, a.y * s, a.z * s); }
window.vscale = vscale;
function vlen(a) { return Math.sqrt(a.x * a.x + a.y * a.y + a.z * a.z); }
window.vlen = vlen;
function vnorm(a) { var l = vlen(a) || 1; return V3(a.x / l, a.y / l, a.z / l); }
window.vnorm = vnorm;
function vcross(a, b) {
  return V3(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x);
}
window.vcross = vcross;
function vdot(a, b) { return a.x * b.x + a.y * b.y + a.z * b.z; }
window.vdot = vdot;
function vlerp(a, b, t) { return V3(lerp(a.x, b.x, t), lerp(a.y, b.y, t), lerp(a.z, b.z, t)); }
window.vlerp = vlerp;

/* deterministic PRNG so textures/model never change between runs */
function mulberry32(seed) {
  var a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    var t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
window.mulberry32 = mulberry32;

function hash2(x, y) {
  var s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
}
window.hash2 = hash2;

/* value noise (bilinear over hash grid) */
function vnoise(x, y) {
  var xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  var u = smooth(xf), v = smooth(yf);
  var a = hash2(xi, yi), b = hash2(xi + 1, yi), c = hash2(xi, yi + 1), d = hash2(xi + 1, yi + 1);
  return lerp(lerp(a, b, u), lerp(c, d, u), v);
}
window.vnoise = vnoise;

function fbm(x, y, oct) {
  var s = 0, amp = .5, f = 1, n = oct || 4;
  for (var i = 0; i < n; i++) { s += amp * vnoise(x * f, y * f); f *= 2.03; amp *= .5; }
  return s;
}
window.fbm = fbm;

/* ------------------------------------------------------------------ 3. MAT4 (column-major) */
function m4() {
  return new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
}
window.m4 = m4;
function m4mul(a, b, o) {
  o = o || new Float32Array(16);
  for (var c = 0; c < 4; c++) {
    for (var r = 0; r < 4; r++) {
      o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
    }
  }
  return o;
}
window.m4mul = m4mul;
function m4trs(p, r, s) {
  var cx = Math.cos(r[0] || 0), sx = Math.sin(r[0] || 0);
  var cy = Math.cos(r[1] || 0), sy = Math.sin(r[1] || 0);
  var cz = Math.cos(r[2] || 0), sz = Math.sin(r[2] || 0);
  /* R = Rz * Ry * Rx */
  var m00 = cz * cy, m01 = cz * sy * sx - sz * cx, m02 = cz * sy * cx + sz * sx;
  var m10 = sz * cy, m11 = sz * sy * sx + cz * cx, m12 = sz * sy * cx - cz * sx;
  var m20 = -sy, m21 = cy * sx, m22 = cy * cx;
  var sxx = s[0], syy = s[1], szz = s[2];
  return new Float32Array([
    m00 * sxx, m10 * sxx, m20 * sxx, 0,
    m01 * syy, m11 * syy, m21 * syy, 0,
    m02 * szz, m12 * szz, m22 * szz, 0,
    p[0], p[1], p[2], 1]);
}
window.m4trs = m4trs;
function m4persp(fovy, aspect, near, far) {
  var f = 1 / Math.tan(fovy / 2), nf = 1 / (near - far);
  return new Float32Array([
    f / aspect, 0, 0, 0,
    0, f, 0, 0,
    0, 0, (far + near) * nf, -1,
    0, 0, 2 * far * near * nf, 0]);
}
window.m4persp = m4persp;
function m4lookAt(eye, ctr, up) {
  var z = vnorm(vsub(eye, ctr));
  var x = vnorm(vcross(up, z));
  var y = vcross(z, x);
  return new Float32Array([
    x.x, y.x, z.x, 0,
    x.y, y.y, z.y, 0,
    x.z, y.z, z.z, 0,
    -vdot(x, eye), -vdot(y, eye), -vdot(z, eye), 1]);
}
window.m4lookAt = m4lookAt;
function m4xform(m, p) {
  return V3(
    m[0] * p.x + m[4] * p.y + m[8] * p.z + m[12],
    m[1] * p.x + m[5] * p.y + m[9] * p.z + m[13],
    m[2] * p.x + m[6] * p.y + m[10] * p.z + m[14]);
}
window.m4xform = m4xform;
function m4xformDir(m, p) {
  return V3(m[0] * p.x + m[4] * p.y + m[8] * p.z,
    m[1] * p.x + m[5] * p.y + m[9] * p.z,
    m[2] * p.x + m[6] * p.y + m[10] * p.z);
}
window.m4xformDir = m4xformDir;

/* ------------------------------------------------------------------ 4. GEOMETRY */
function newGeo() {
  return { pos: [], nrm: [], txc: [], tri: [], ctr: V3(), r: 1, name: '' };
}
window.newGeo = newGeo;

function geoBounds(g) {
  var p = g.pos, n = p.length / 3;
  if (!n) { g.ctr = V3(); g.r = 1; return g; }
  var mnx = 1e9, mny = 1e9, mnz = 1e9, mxx = -1e9, mxy = -1e9, mxz = -1e9;
  for (var i = 0; i < n; i++) {
    var x = p[i * 3], y = p[i * 3 + 1], z = p[i * 3 + 2];
    if (x < mnx) mnx = x; if (x > mxx) mxx = x;
    if (y < mny) mny = y; if (y > mxy) mxy = y;
    if (z < mnz) mnz = z; if (z > mxz) mxz = z;
  }
  g.ctr = V3((mnx + mxx) / 2, (mny + mxy) / 2, (mnz + mxz) / 2);
  var dx = (mxx - mnx) / 2, dy = (mxy - mny) / 2, dz = (mxz - mnz) / 2;
  g.r = Math.max(.5, Math.sqrt(dx * dx + dy * dy + dz * dz));
  return g;
}
window.geoBounds = geoBounds;

/* append a single triangle with an explicit face normal */
function pushTri(g, a, b, c, n) {
  n = n || vnorm(vcross(vsub(b, a), vsub(c, a)));
  var f = g.pos.length / 3;
  g.pos.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
  g.nrm.push(n.x, n.y, n.z, n.x, n.y, n.z, n.x, n.y, n.z);
  g.txc.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
  g.tri.push(f, f + 1, f + 2);
}
window.pushTri = pushTri;

/* append a quad a-b-c-d (CCW seen from outside) with a single flat normal */
function pushQuad(g, a, b, c, d, n) {
  n = n || vnorm(vcross(vsub(b, a), vsub(d, a)));
  pushTri(g, a, b, c, n);
  pushTri(g, a, c, d, n);
}
window.pushQuad = pushQuad;

/* unique-edge list for wireframe overlay */
function geoEdges(g) {
  var seen = {}, out = [];
  for (var i = 0; i < g.tri.length; i += 3) {
    var t = [g.tri[i], g.tri[i + 1], g.tri[i + 2]];
    for (var e = 0; e < 3; e++) {
      var a = t[e], b = t[(e + 1) % 3];
      var k = a < b ? a + ':' + b : b + ':' + a;
      if (seen[k]) continue;
      seen[k] = 1;
      out.push(g.pos[a * 3], g.pos[a * 3 + 1], g.pos[a * 3 + 2],
        g.pos[b * 3], g.pos[b * 3 + 1], g.pos[b * 3 + 2]);
    }
  }
  return new Float32Array(out);
}
window.geoEdges = geoEdges;

function mergeGeo(dst, src) {
  var off = dst.pos.length / 3, i;
  for (i = 0; i < src.pos.length; i++) dst.pos.push(src.pos[i]);
  for (i = 0; i < src.nrm.length; i++) dst.nrm.push(src.nrm[i]);
  for (i = 0; i < src.txc.length; i++) dst.txc.push(src.txc[i]);
  for (i = 0; i < src.tri.length; i++) dst.tri.push(src.tri[i] + off);
  return dst;
}
window.mergeGeo = mergeGeo;

/* --- rounded rectangle profile in the (a,b) plane ------------------------- */
function rrProfile(hw, hh, r, seg) {
  seg = seg || 4;
  r = Math.min(r, hw * .98, hh * .98);
  var pts = [], i, t;
  function arc(ca, cb, a0, a1) {
    for (i = 0; i <= seg; i++) {
      t = a0 + (a1 - a0) * (i / seg);
      pts.push([ca + Math.cos(t) * r, cb + Math.sin(t) * r]);
    }
  }
  arc(hw - r, hh - r, 0, Math.PI / 2);            /* +a +b corner */
  arc(-hw + r, hh - r, Math.PI / 2, Math.PI);     /* -a +b */
  arc(-hw + r, -hh + r, Math.PI, Math.PI * 1.5);  /* -a -b */
  arc(hw - r, -hh + r, Math.PI * 1.5, Math.PI * 2);/* +a -b */
  pts.pop(); /* last == first */
  return pts;
}
window.rrProfile = rrProfile;

/* --- loft: sweep a rounded-rect section along stations -------------------- */
/*  o.axis : 'y' (section in X/Z) or 'z' (section in X/Y)
 *  st[i]  : { p:V3, hw, hh, r, aoff }                                        */
function loft(o) {
  var g = newGeo();
  g.name = o.name || '';
  var st = o.st, seg = o.seg || 4, axis = o.axis || 'y', i, j;
  var rings = [];
  for (i = 0; i < st.length; i++) {
    var s = st[i];
    var pts = rrProfile(s.hw, s.hh, s.r, seg);
    var ring = [];
    for (j = 0; j < pts.length; j++) {
      var a = pts[j][0] + (s.aoff || 0), b = pts[j][1];
      var p;
      if (axis === 'y') p = V3(a, s.p.y, s.p.z + b);
      else p = V3(a, s.p.y + b, s.p.z);
      ring.push(p);
    }
    rings.push({ p: s.p, pts: ring });
  }
  var m = rings[0].pts.length;
  for (i = 0; i < rings.length - 1; i++) {
    for (j = 0; j < m; j++) {
      var k = (j + 1) % m;
      pushQuad(g, rings[i].pts[j], rings[i].pts[k], rings[i + 1].pts[k], rings[i + 1].pts[j]);
    }
  }
  /* end caps (fan) */
  function cap(ring, flip) {
    var c = V3(0, 0, 0);
    for (var q = 0; q < m; q++) { c.x += ring.pts[q].x; c.y += ring.pts[q].y; c.z += ring.pts[q].z; }
    c.x /= m; c.y /= m; c.z /= m;
    for (var q2 = 0; q2 < m; q2++) {
      var k2 = (q2 + 1) % m;
      if (flip) pushTri(g, c, ring.pts[k2], ring.pts[q2]);
      else pushTri(g, c, ring.pts[q2], ring.pts[k2]);
    }
  }
  cap(rings[0], true);
  cap(rings[rings.length - 1], false);
  return geoBounds(g);
}
window.loft = loft;

/* --- blended-station loft: interpolate n stations from a key list --------- */
/*  keys[i] = { y, hy:1, hw:[..], hh:[..], r:[..], zoff:[..] } -> use helper  */
function stationList(keys, count) {
  /* keys: array of {t:[y,z,hw,hh,r,ax]} ; produce `count` interpolated rows */
  var out = [], i, n = keys.length;
  for (i = 0; i < count; i++) {
    var u = i / (count - 1), f = u * (n - 1), i0 = Math.min(n - 2, Math.floor(f)), t = f - i0;
    var a = keys[i0], b = keys[i0 + 1], row = [];
    for (var k = 0; k < a.length; k++) row.push(lerp(a[k], b[k], t));
    out.push(row);
  }
  return out;
}
window.stationList = stationList;

/* --- tube along a polyline with a rounded-rect / circle section ----------- */
function tubeAlong(o) {
  var g = newGeo();
  g.name = o.name || '';
  var P = o.path, rad = o.rad || 8, arc = o.arc || 8, mode = o.mode || 'round';
  var hw = o.hw || rad, hh = o.hh || rad, rnd = o.round == null ? .9 : o.round;
  var caps = o.caps !== false, i, j;
  var pts = [], tans = [];
  for (i = 0; i < P.length; i++) {
    var a = P[Math.max(0, i - 1)], b = P[Math.min(P.length - 1, i + 1)];
    var t = vnorm(vsub(b, a));
    if (vlen(t) < 1e-6) t = V3(1, 0, 0);
    tans.push(t);
  }
  for (i = 0; i < P.length; i++) {
    var t2 = tans[i];
    var ref = Math.abs(t2.y) > .9 ? V3(1, 0, 0) : V3(0, 1, 0);
    var n1 = vnorm(vcross(ref, t2)), n2 = vnorm(vcross(t2, n1));
    if (vlen(n1) < 1e-5) { n1 = V3(1, 0, 0); n2 = V3(0, 0, 1); }
    var ring = [];
    if (mode === 'rect') {
      var prof = rrProfile(hw, hh, Math.min(hw, hh) * rnd, o.seg || 3);
      for (j = 0; j < prof.length; j++) {
        ring.push(V3(P[i].x + n1.x * prof[j][0] + n2.x * prof[j][1],
          P[i].y + n1.y * prof[j][0] + n2.y * prof[j][1],
          P[i].z + n1.z * prof[j][0] + n2.z * prof[j][1]));
      }
    } else {
      for (j = 0; j < arc; j++) {
        var th = (j / arc) * Math.PI * 2;
        ring.push(V3(P[i].x + n1.x * Math.cos(th) * hw + n2.x * Math.sin(th) * hh,
          P[i].y + n1.y * Math.cos(th) * hw + n2.y * Math.sin(th) * hh,
          P[i].z + n1.z * Math.cos(th) * hw + n2.z * Math.sin(th) * hh));
      }
    }
    pts.push({ p: P[i], pts: ring });
  }
  var m = pts[0].pts.length;
  for (i = 0; i < pts.length - 1; i++) {
    for (j = 0; j < m; j++) {
      var k = (j + 1) % m;
      pushQuad(g, pts[i].pts[j], pts[i].pts[k], pts[i + 1].pts[k], pts[i + 1].pts[j]);
    }
  }
  if (caps) {
    for (var e = 0; e < 2; e++) {
      var ring2 = pts[e === 0 ? 0 : pts.length - 1].pts, flip = (e === 0);
      var c = V3(0, 0, 0);
      for (j = 0; j < m; j++) { c.x += ring2[j].x; c.y += ring2[j].y; c.z += ring2[j].z; }
      c.x /= m; c.y /= m; c.z /= m;
      for (j = 0; j < m; j++) {
        var k3 = (j + 1) % m;
        if (flip) pushTri(g, c, ring2[k3], ring2[j]); else pushTri(g, c, ring2[j], ring2[k3]);
      }
    }
  }
  return geoBounds(g);
}
window.tubeAlong = tubeAlong;

/* --- axis-aligned box ---------------------------------------------------- */
function boxGeo(w, h, d, r, seg) {
  r = r == null ? Math.min(w, h, d) * .12 : r;
  return loft({
    axis: 'y', seg: seg || 3, st: [
      { p: V3(0, -h / 2, 0), hw: w / 2, hh: d / 2, r: r },
      { p: V3(0, h / 2, 0), hw: w / 2, hh: d / 2, r: r }]
  });
}
window.boxGeo = boxGeo;

/* --- cylinder along Y between y0,y1 (r may be [r0,r1]) ------------------- */
function cylY(y0, y1, r0, r1, seg, name) {
  seg = seg || 24;
  if (typeof r0 === 'object') { r1 = r0[1]; r0 = r0[0]; }
  var st = [], n = 5, i;
  for (i = 0; i < n; i++) {
    var t = i / (n - 1);
    st.push({ p: V3(0, lerp(y0, y1, t), 0), hw: lerp(r0, r1, t), hh: lerp(r0, r1, t), r: lerp(r0, r1, t) });
  }
  return loft({ axis: 'y', st: st, seg: Math.max(3, Math.round(seg / 4)), name: name });
}
window.cylY = cylY;

/* --- cylinder along Z between z0,z1 (r may be [r0,r1]) ------------------- */
function cylZ(z0, z1, r0, r1, seg, name) {
  seg = seg || 24;
  if (typeof r0 === 'object') { r1 = r0[1]; r0 = r0[0]; }
  var st = [], n = 5, i;
  for (i = 0; i < n; i++) {
    var t = i / (n - 1);
    st.push({ p: V3(0, 0, lerp(z0, z1, t)), hw: lerp(r0, r1, t), hh: lerp(r0, r1, t), r: lerp(r0, r1, t) });
  }
  return loft({ axis: 'z', st: st, seg: Math.max(3, Math.round(seg / 4)), name: name });
}
window.cylZ = cylZ;

/* --- cylinder between two arbitrary points ------------------------------- */
function cylBetween(a, b, r0, r1, seg, name) {
  seg = seg || 18;
  var n = 6, pth = [], i;
  for (i = 0; i < n; i++) pth.push(vlerp(a, b, i / (n - 1)));
  var g = tubeAlong({ path: pth, hw: (r0 + r1) / 2, hh: (r0 + r1) / 2, arc: seg, mode: 'round', caps: true, name: name });
  /* linearly taper the tube around its own axis (simple, radius-only) */
  var dir = vnorm(vsub(b, a));
  var ref = Math.abs(dir.y) > .9 ? V3(1, 0, 0) : V3(0, 1, 0);
  var n1 = vnorm(vcross(ref, dir)), n2 = vnorm(vcross(dir, n1));
  var L = Math.max(1e-6, vlen(vsub(b, a)));
  var cnt = g.pos.length / 3;
  for (i = 0; i < cnt; i++) {
    var pp = V3(g.pos[i * 3], g.pos[i * 3 + 1], g.pos[i * 3 + 2]);
    var tt = clamp(vdot(vsub(pp, a), dir) / L, 0, 1);
    var f = lerp(r1, r0, tt) / Math.max(1e-6, (r0 + r1) / 2);
    var rel = vsub(pp, vlerp(a, b, tt));
    var rn = vdot(rel, n1), rv = vdot(rel, n2);
    var np = V3(vlerp(a, b, tt).x + n1.x * rn * f + n2.x * rv * f,
      vlerp(a, b, tt).y + n1.y * rn * f + n2.y * rv * f,
      vlerp(a, b, tt).z + n1.z * rn * f + n2.z * rv * f);
    g.pos[i * 3] = np.x; g.pos[i * 3 + 1] = np.y; g.pos[i * 3 + 2] = np.z;
    g.txc[i * 3] = np.x; g.txc[i * 3 + 1] = np.y; g.txc[i * 3 + 2] = np.z;
  }
  return geoBounds(g);
}
window.cylBetween = cylBetween;

/* --- torus in the plane whose normal is `up` ----------------------------- */
function torus(up, R, r, segU, segV, frac, name) {
  up = vnorm(up);
  segU = segU || 48; segV = segV || 12; frac = frac == null ? 1 : frac;
  var g = newGeo(); g.name = name || '';
  var ref = Math.abs(up.y) > .9 ? V3(0, 0, 1) : V3(0, 1, 0);
  var e1 = vnorm(vcross(ref, up)), e2 = vnorm(vcross(up, e1));
  var i, j;
  for (i = 0; i < segU; i++) {
    var a0 = (i / segU) * Math.PI * 2 * frac, a1 = ((i + 1) / segU) * Math.PI * 2 * frac;
    var c0 = V3(e1.x * Math.cos(a0) * R + e2.x * Math.sin(a0) * R,
      e1.y * Math.cos(a0) * R + e2.y * Math.sin(a0) * R,
      e1.z * Math.cos(a0) * R + e2.z * Math.sin(a0) * R);
    var c1 = V3(e1.x * Math.cos(a1) * R + e2.x * Math.sin(a1) * R,
      e1.y * Math.cos(a1) * R + e2.y * Math.sin(a1) * R,
      e1.z * Math.cos(a1) * R + e2.z * Math.sin(a1) * R);
    var rd0 = vnorm(V3(e1.x * Math.cos(a0) + e2.x * Math.sin(a0), e1.y * Math.cos(a0) + e2.y * Math.sin(a0), e1.z * Math.cos(a0) + e2.z * Math.sin(a0)));
    var rd1 = vnorm(V3(e1.x * Math.cos(a1) + e2.x * Math.sin(a1), e1.y * Math.cos(a1) + e2.y * Math.sin(a1), e1.z * Math.cos(a1) + e2.z * Math.sin(a1)));
    for (j = 0; j < segV; j++) {
      var b0 = (j / segV) * Math.PI * 2, b1 = ((j + 1) / segV) * Math.PI * 2;
      function pt(c, rd, b) {
        var nr = V3(rd.x * Math.cos(b) + up.x * Math.sin(b), rd.y * Math.cos(b) + up.y * Math.sin(b), rd.z * Math.cos(b) + up.z * Math.sin(b));
        return V3(c.x + nr.x * r, c.y + nr.y * r, c.z + nr.z * r);
      }
      pushQuad(g, pt(c0, rd0, b0), pt(c1, rd1, b0), pt(c1, rd1, b1), pt(c0, rd0, b1));
    }
  }
  return geoBounds(g);
}
window.torus = torus;

/* --- lathe a profile [{r,a}] around an axis ------------------------------ */
/*  axis 'y' -> revolve in X/Z ; axis 'z' -> revolve in X/Y
 *  closed profile -> solid shell (tube / washer / rim)                       */
function lathe(o) {
  var g = newGeo(); g.name = o.name || '';
  var prof = o.prof, axis = o.axis || 'y', seg = o.seg || 32, closed = !!o.closed, i, j;
  function put(r, a, th) {
    if (axis === 'y') return V3(Math.cos(th) * r, a, Math.sin(th) * r);
    return V3(Math.cos(th) * r, Math.sin(th) * r, a);
  }
  for (i = 0; i < seg; i++) {
    var t0 = (i / seg) * Math.PI * 2, t1 = ((i + 1) / seg) * Math.PI * 2;
    var last = closed ? prof.length : prof.length - 1;
    for (j = 0; j < last; j++) {
      var j2 = (j + 1) % prof.length;
      var A = prof[j], B = prof[j2];
      var p00 = put(A[0], A[1], t0), p10 = put(B[0], B[1], t0), p11 = put(B[0], B[1], t1), p01 = put(A[0], A[1], t1);
      var degA = A[0] < 1e-5, degB = B[0] < 1e-5;
      if (degA && degB) continue;
      if (degA) pushTri(g, put(0, A[1], t0), p10, p11);
      else if (degB) pushTri(g, p00, put(0, B[1], t0), p01);
      else pushQuad(g, p00, p10, p11, p01);
    }
  }
  return geoBounds(g);
}
window.lathe = lathe;

/* --- primitive profile helpers ------------------------------------------- */
function pCyl(r, a0, a1) { return [[0, a0], [r, a0], [r, a1], [0, a1]]; }
window.pCyl = pCyl;
function pWasher(ri, ro, a0, a1) { return [[ri, a0], [ro, a0], [ro, a1], [ri, a1]]; }
window.pWasher = pWasher;
function pDisc(r, t) { return pCyl(r, 0, t); }
window.pDisc = pDisc;
function pStack(n, r, t, pitch) {
  var out = [], i;
  for (i = 0; i < n; i++) {
    var a0 = i * pitch;
    out.push([0, a0], [r, a0], [r, a0 + t], [r * .62, a0 + t], [r * .62, a0 + t + pitch * .28], [0, a0 + t + pitch * .28]);
  }
  return out;
}
window.pStack = pStack;

/* --- flat disc (washer face) -------------------------------------------- */
function disc(o) {
  var g = newGeo(); g.name = o.name || '';
  var n = o.axis || 'y', seg = o.seg || 40, i;
  var u, v, fn;
  if (n === 'y') { u = V3(1, 0, 0); v = V3(0, 0, 1); fn = V3(0, 1, 0); }
  else if (n === 'z') { u = V3(1, 0, 0); v = V3(0, 1, 0); fn = V3(0, 0, 1); }
  else { u = V3(0, 1, 0); v = V3(0, 0, 1); fn = V3(1, 0, 0); }
  if (o.normal) fn = vnorm(o.normal);
  var ctr = V3(u.x * (o.cu || 0) + v.x * (o.cv || 0), u.y * (o.cu || 0) + v.y * (o.cv || 0), u.z * (o.cu || 0) + v.z * (o.cv || 0));
  for (i = 0; i < seg; i++) {
    var t0 = (i / seg) * Math.PI * 2, t1 = ((i + 1) / seg) * Math.PI * 2;
    var p0 = V3(ctr.x + u.x * Math.cos(t0) * o.r + v.x * Math.sin(t0) * o.r,
      ctr.y + u.y * Math.cos(t0) * o.r + v.y * Math.sin(t0) * o.r,
      ctr.z + u.z * Math.cos(t0) * o.r + v.z * Math.sin(t0) * o.r);
    var p1 = V3(ctr.x + u.x * Math.cos(t1) * o.r + v.x * Math.sin(t1) * o.r,
      ctr.y + u.y * Math.cos(t1) * o.r + v.y * Math.sin(t1) * o.r,
      ctr.z + u.z * Math.cos(t1) * o.r + v.z * Math.sin(t1) * o.r);
    pushTri(g, ctr, p0, p1, fn);
  }
  return geoBounds(g);
}
window.disc = disc;

/* --- arrow vane / fletching --------------------------------------------- */
function vane(o) {
  var g = newGeo(); g.name = o.name || '';
  var len = o.len || 58, h = o.h || 9, th = o.th || .55, az = o.az || 0, tw = o.twist || 0;
  var z0 = o.z0 || 0, r0 = o.r0 == null ? 2.2 : o.r0, seg = o.seg || 14, i;
  var base = V3(Math.cos(az), Math.sin(az), 0);
  var side = V3(-Math.sin(az), Math.cos(az), 0);
  /* height profile: parabolic-ish shield shape, clamped at both ends */
  function hp(u) {
    var s = Math.sin(Math.PI * Math.pow(clamp(u, 0, 1), .78));
    return h * Math.pow(s, .55);
  }
  for (i = 0; i < seg; i++) {
    var u0 = i / seg, u1 = (i + 1) / seg;
    var zz0 = z0 - len * u0, zz1 = z0 - len * u1;
    var a0 = az + tw * u0, a1 = az + tw * u1;
    var b0 = V3(Math.cos(a0), Math.sin(a0), 0), b1 = V3(Math.cos(a1), Math.sin(a1), 0);
    var s0 = V3(-Math.sin(a0), Math.cos(a0), 0), s1 = V3(-Math.sin(a1), Math.cos(a1), 0);
    var h0 = hp(u0), h1 = hp(u1);
    function P(b, s, zz, r, hh, sg) {
      return V3(b.x * r + s.x * sg * th / 2, b.y * r + s.y * sg * th / 2, zz);
    }
    var A = P(b0, s0, zz0, r0, h0, -1), B = P(b0, s0, zz0, r0 + h0, h0, -1);
    var C = P(b1, s1, zz1, r0 + h1, h1, -1), D = P(b1, s1, zz1, r0, h1, -1);
    var A2 = P(b0, s0, zz0, r0, h0, 1), B2 = P(b0, s0, zz0, r0 + h0, h0, 1);
    var C2 = P(b1, s1, zz1, r0 + h1, h1, 1), D2 = P(b1, s1, zz1, r0, h1, 1);
    pushQuad(g, A, B, C, D);            /* -side face */
    pushQuad(g, A2, D2, C2, B2);        /* +side face */
    pushQuad(g, B, B2, C2, C);          /* outer edge */
    pushQuad(g, A, A2, B2, B);          /* leading edge */
    pushQuad(g, D, D2, C2, C);          /* trailing edge */
  }
  return geoBounds(g);
}
window.vane = vane;

/* --- object + part registration ----------------------------------------- */
function addObj(o) {
  o.id = o.id || ('p' + (STATE.objs.length + 1));
  o.pos = o.pos || V3();
  o.rot = o.rot || [0, 0, 0];
  o.scale = o.scale || [1, 1, 1];
  o.color = o.color || [0.6, 0.62, 0.66];
  o.rough = o.rough == null ? .5 : o.rough;
  o.metal = o.metal == null ? 0 : o.metal;
  o.emiss = o.emiss || [0, 0, 0];
  o.uv = o.uv || 1;
  o.opacity = o.opacity == null ? 1 : o.opacity;
  o.radOut = o.radOut || [0, 0, 0];
  o.pickId = STATE.objs.length + 1;
  if (!o.g) { o.g = newGeo(); o.g.name = o.id; }
  geoBounds(o.g);
  STATE.objs.push(o);
  STATE.byId[o.id] = o;
  return o;
}
window.addObj = addObj;

function addGroup(name, en, cn, tint) {
  var g = { name: name, en: en, cn: cn, tint: tint || '#3fd2c7', items: [] };
  STATE.groups.push(g);
  return g;
}
window.addGroup = addGroup;
function groupAdd(g, o) { g.items.push(o); o.group = g; return o; }
window.groupAdd = groupAdd;
function mark(o, name) { if (o.g) o.g.name = name; return o; }
window.mark = mark;

/* ------------------------------------------------------------------ 5. SHADERS */
var VS = [
  '#version 300 es',
  'precision highp float;',
  'layout(location=0) in vec3 aPos;',
  'layout(location=1) in vec3 aNrm;',
  'layout(location=2) in vec3 aTex;',
  'uniform mat4 uPV, uModel;',
  'uniform vec3 uLocalCenter;',
  'uniform float uLocalRadius, uExplode, uSign, uVib;',
  'out vec3 vN, vW, vT;',
  'void main(){',
  '  vec3 lp = aPos;',
  '  if (uVib > 0.001) {',
  '    float s = sin(lp.y*0.055 + uVib*21.0) + 0.55*sin(lp.y*0.093 - uVib*33.0);',
  '    lp += vec3(s*0.85, 0.0, s*0.45);',
  '  }',
  '  if (uExplode > 0.001) {',
  '    vec3 d = lp - uLocalCenter;',
  '    float l = length(d);',
  '    float amp = uLocalRadius * 0.9 + 14.0;',
  '    lp += normalize(d + vec3(0.0007)) * uExplode * amp;',
  '    lp.y += uExplode * uSign * 22.0;',
  '  }',
  '  vec4 wp = uModel * vec4(lp, 1.0);',
  '  vN = mat3(uModel) * aNrm;',
  '  vW = wp.xyz;',
  '  vT = aTex;',
  '  gl_Position = uPV * wp;',
  '}'
].join('\n');

var FS = [
  '#version 300 es',
  'precision highp float;',
  'in vec3 vN, vW, vT;',
  'out vec4 oCol;',
  'uniform vec3 uColor, uEmiss, uEye, uTint;',
  'uniform float uRough, uMetal, uTexMode, uUV, uTime, uOpacity, uSel, uPick;',
  'uniform float uTexOn;',
  'uniform sampler2D uTex0;',
  'const float PI = 3.14159265;',
  'float h21(vec2 p){ p = fract(p*vec2(123.34,456.21)); p += dot(p, p+34.56); return fract(p.x*p.y); }',
  'float vn(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);',
  '  return mix(mix(h21(i),h21(i+vec2(1,0)),f.x), mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x), f.y); }',
  'float fb(vec2 p){ float s=0.0,a=0.5; for(int i=0;i<4;i++){ s+=a*vn(p); p*=2.03; a*=0.5;} return s; }',
  'void main(){',
  '  if (uPick > 0.5) {',
  '    float t = uSel;',
  '    float id = float(gl_PrimitiveID);',
  '    float r = mod(t, 256.0), g = mod(floor(t/256.0), 256.0), b = mod(floor(t/65536.0), 256.0);',
  '    oCol = vec4(r/255.0, g/255.0, b/255.0, 1.0); return;',
  '  }',
  '  vec3 N = normalize(vN);',
  '  vec3 V = normalize(uEye - vW);',
  '  if (dot(N, V) < 0.0 && uOpacity < 0.99) N = -N;',
  '  vec3 alb = uColor;',
  '  float texAO = 1.0;',
  '  if (uTexOn > 0.5) {',
  '    vec2 uv = vT.xy * uUV;',
  '    if (uTexMode > -0.5 && uTexMode < 0.5) {',
  '      vec3 tc = texture(uTex0, uv).rgb;',
  '      alb *= (0.55 + 0.9*tc);',
  '      texAO = 0.86 + 0.28*dot(tc, vec3(0.3333));',
  '    } else if (uTexMode < 1.5 && uTexMode > 0.5) {',
  '      vec3 tc = texture(uTex0, uv).rgb;',
  '      alb *= (0.60 + 0.85*tc);',
  '      texAO = 0.9 + 0.18*dot(tc, vec3(0.3333));',
  '    } else if (uTexMode < 2.5 && uTexMode > 1.5) {',
  '      vec2 q = vec2(atan(vT.z, vT.x)*0.32, vT.y*0.012);',
  '      float gr = fb(q*3.0)*0.6 + 0.55;',
  '      float rings = 0.5 + 0.5*sin(vT.y*0.055 + fb(q*2.0)*5.0);',
  '      alb *= mix(0.72, 1.22, gr) * mix(0.92, 1.06, rings);',
  '      texAO = 0.92 + 0.14*gr;',
  '    } else if (uTexMode < 3.5 && uTexMode > 2.5) {',
  '      float n = fb(vT.xy*0.65 + vT.z*0.2);',
  '      float bump = smoothstep(0.42, 0.62, n);',
  '      alb *= 0.80 + 0.34*bump;',
  '      texAO = 0.86 + 0.22*bump;',
  '    } else {',
  '      float n = fb(vT.xy*2.6 + vec2(0.0, vT.z*0.45));',
  '      alb *= 0.88 + 0.22*n;',
  '      texAO = 0.9 + 0.16*n;',
  '    }',
  '  }',
  '  float wear = 0.97 + 0.06*fb(vW.xz*0.34 + vW.y*0.11);',
  '  vec3 L1 = normalize(vec3(-0.52, 0.78, 0.72));',
  '  vec3 L2 = normalize(vec3(0.86, 0.12, 0.42));',
  '  vec3 L3 = normalize(vec3(0.18, 0.55, -0.96));',
  '  vec3 C1 = vec3(1.00, 0.965, 0.90) * 2.55;',
  '  vec3 C2 = vec3(0.58, 0.74, 1.00) * 1.10;',
  '  vec3 C3 = vec3(0.72, 0.86, 1.00) * 1.95;',
  '  float sh = mix(0.10, 0.55, uMetal);',
  '  vec3 diff = alb * (C1*max(dot(N,L1),0.0) + C2*max(dot(N,L2),0.0) + C3*max(dot(N,L3),0.0));',
  '  vec3 H1 = normalize(L1+V), H2 = normalize(L2+V), H3 = normalize(L3+V);',
  '  vec3 F0 = mix(vec3(0.045), alb, uMetal);',
  '  float sp = mix(9.0, 260.0, 1.0 - uRough);',
  '  vec3 spec = (C1*pow(max(dot(N,H1),0.0), sp) + C2*pow(max(dot(N,H2),0.0), sp)*0.45',
  '            + C3*pow(max(dot(N,H3),0.0), sp)*0.35) * F0 * (1.35 - 0.55*uRough);',
  '  float fres = pow(1.0 - max(dot(N,V),0.0), 4.0);',
  '  spec += vec3(0.28,0.43,0.62) * fres * mix(0.22, 1.45, uMetal);',
  '  float ao = texAO*mix(0.80, 1.0, clamp(length(uColor)*1.4, 0.0, 1.0));',
  '  vec3 col = (diff*mix(0.30, 0.66, uMetal) + spec) * ao;',
  '  vec3 amb = mix(vec3(0.045,0.055,0.075), vec3(0.09,0.11,0.15), N.y*0.5+0.5);',
  '  col += alb * amb * ao;',
  '  col += uEmiss;',
  '  col += uColor * uSel * 0.30;',
  '  float d2c = distance(uEye, vW);',
  '  col *= clamp(1.0 - (d2c-2400.0)/6200.0, 0.60, 1.0);',
  '  col = mix(col, uTint, uSel*0.13);',
  '  col = col / (col + vec3(0.92)) * 1.62;',
  '  col = pow(max(col, vec3(0.0)), vec3(0.4545));',
  '  oCol = vec4(col, uOpacity);',
  '}'
].join('\n');

var WIRE_VS = [
  '#version 300 es',
  'precision highp float;',
  'layout(location=0) in vec3 aPos;',
  'uniform mat4 uPV, uModel;',
  'uniform vec3 uLocalCenter;',
  'uniform float uLocalRadius, uExplode, uSign;',
  'void main(){',
  '  vec3 lp = aPos;',
  '  if (uExplode > 0.001) {',
  '    vec3 d = lp - uLocalCenter;',
  '    float amp = uLocalRadius*0.9 + 14.0;',
  '    lp += normalize(d + vec3(0.0007))*uExplode*amp;',
  '    lp.y += uExplode*uSign*22.0;',
  '  }',
  '  gl_Position = uPV * uModel * vec4(lp,1.0);',
  '}'
].join('\n');

var WIRE_FS = [
  '#version 300 es',
  'precision highp float;',
  'out vec4 oCol;',
  'uniform vec3 uLine;',
  'uniform float uOpacity;',
  'void main(){ oCol = vec4(uLine, uOpacity); }'
].join('\n');

var PICK_VS = [
  '#version 300 es',
  'precision highp float;',
  'layout(location=0) in vec3 aPos;',
  'uniform mat4 uPV, uModel;',
  'uniform vec3 uLocalCenter;',
  'uniform float uLocalRadius, uExplode, uSign;',
  'void main(){',
  '  vec3 lp = aPos;',
  '  if (uExplode > 0.001) {',
  '    vec3 d = lp - uLocalCenter;',
  '    lp += normalize(d + vec3(0.0007))*uExplode*(uLocalRadius*0.9+14.0);',
  '    lp.y += uExplode*uSign*22.0;',
  '  }',
  '  gl_Position = uPV * uModel * vec4(lp,1.0);',
  '}'
].join('\n');

var PICK_FS = [
  '#version 300 es',
  'precision highp float;',
  'out vec4 oCol;',
  'uniform float uPickId;',
  'void main(){',
  '  float id = uPickId;',
  '  oCol = vec4(mod(id,256.0)/255.0, mod(floor(id/256.0),256.0)/255.0, mod(floor(id/65536.0),256.0)/255.0, 1.0);',
  '}'
].join('\n');

function compile(gl, type, src, tag) {
  var s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    fail('着色器编译失败 (' + tag + ')：<br>' + gl.getShaderInfoLog(s).replace(/\n/g, '<br>'));
    throw new Error('shader ' + tag);
  }
  return s;
}
window.compile = compile;

function program(gl, vs, fs, tag) {
  var p = gl.createProgram();
  gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, vs, tag + '.vs'));
  gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fs, tag + '.fs'));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    fail('程序链接失败 (' + tag + ')：<br>' + gl.getProgramInfoLog(p));
    throw new Error('link ' + tag);
  }
  p._u = {};
  var n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS), i;
  for (i = 0; i < n; i++) {
    var info = gl.getActiveUniform(p, i);
    var nm = info.name.replace('[0]', '');
    p._u[nm] = gl.getUniformLocation(p, info.name);
  }
  return p;
}
window.program = program;

/* ------------------------------------------------------------------ 6. TEXTURES */
function canvasTex(gl, w, h, draw, key) {
  var c = document.createElement('canvas');
  c.width = w; c.height = h;
  var ctx = c.getContext('2d');
  draw(ctx, w, h);
  var t = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.generateMipmap(gl.TEXTURE_2D);
  return { tex: t, w: w, h: h, key: key };
}
window.canvasTex = canvasTex;

function buildTextures(gl) {
  var T = {};
  /* -- carbon twill 2x2 -- */
  T.carbon = canvasTex(gl, 128, 128, function (c, w, h) {
    var cell = 16;
    c.fillStyle = '#16181d'; c.fillRect(0, 0, w, h);
    for (var y = 0; y < w / cell; y++) {
      for (var x = 0; x < w / cell; x++) {
        var over = ((x + y) % 2) === 0;
        var g = c.createLinearGradient(x * cell, y * cell, (x + 1) * cell, (y + 1) * cell);
        var a = over ? '#5c6472' : '#1d2027';
        var b = over ? '#20242c' : '#434b58';
        g.addColorStop(0, b); g.addColorStop(.45, a); g.addColorStop(1, b);
        c.fillStyle = g;
        c.fillRect(x * cell + 1, y * cell + 1, cell - 2, cell - 2);
        /* fibre lines */
        c.strokeStyle = 'rgba(255,255,255,.05)';
        c.lineWidth = 1;
        for (var k = 0; k < 6; k++) {
          c.beginPath();
          if (over) { c.moveTo(x * cell + 2 + k * 2, y * cell + 1); c.lineTo(x * cell + 2 + k * 2, y * cell + cell - 1); }
          else { c.moveTo(x * cell + 1, y * cell + 2 + k * 2); c.lineTo(x * cell + cell - 1, y * cell + 2 + k * 2); }
          c.stroke();
        }
      }
    }
  }, 'carbon');

  /* -- anodised aluminium micro-grain -- */
  T.ano = canvasTex(gl, 96, 96, function (c, w, h) {
    var rnd = mulberry32(8841);
    c.fillStyle = '#c9ccd2'; c.fillRect(0, 0, w, h);
    var img = c.getImageData(0, 0, w, h), d = img.data;
    for (var i = 0; i < d.length; i += 4) {
      var n = (fbm((i / 4 % w) * .35, Math.floor(i / 4 / w) * .35, 3) - .5) * 60 + (rnd() - .5) * 22;
      d[i] = clamp(d[i] + n, 0, 255); d[i + 1] = clamp(d[i + 1] + n, 0, 255); d[i + 2] = clamp(d[i + 2] + n, 0, 255);
    }
    c.putImageData(img, 0, 0);
  }, 'ano');

  /* -- wood grain (grip) -- */
  T.wood = canvasTex(gl, 128, 128, function (c, w, h) {
    var img = c.createImageData(w, h), d = img.data;
    for (var y = 0; y < h; y++) {
      for (var x = 0; x < w; x++) {
        var g = fbm(x * .09, y * .012, 5);
        var ring = .5 + .5 * Math.sin((x * .055) + g * 9.0 + Math.sin(y * .02) * 2.2);
        var v = .55 + .45 * ring;
        var i = (y * w + x) * 4;
        d[i] = clamp(120 * v + 34, 0, 255);
        d[i + 1] = clamp(84 * v + 22, 0, 255);
        d[i + 2] = clamp(52 * v + 14, 0, 255);
        d[i + 3] = 255;
      }
    }
    c.putImageData(img, 0, 0);
  }, 'wood');

  /* -- rubber grip stipple -- */
  T.rubber = canvasTex(gl, 96, 96, function (c, w, h) {
    var rnd = mulberry32(2299);
    c.fillStyle = '#4a4d53'; c.fillRect(0, 0, w, h);
    for (var i = 0; i < 2400; i++) {
      var x = rnd() * w, y = rnd() * h, r = .5 + rnd() * 1.5;
      var v = rnd();
      c.fillStyle = 'rgba(' + Math.round(120 + v * 90) + ',' + Math.round(122 + v * 90) + ',' + Math.round(128 + v * 90) + ',' + (.25 + v * .4) + ')';
      c.beginPath(); c.arc(x, y, r, 0, 6.2832); c.fill();
    }
  }, 'rubber');

  /* -- bowstring fibre -- */
  T.string = canvasTex(gl, 64, 64, function (c, w, h) {
    c.fillStyle = '#c9b98c'; c.fillRect(0, 0, w, h);
    for (var x = 0; x < w; x += 2) {
      c.fillStyle = 'rgba(0,0,0,' + (.04 + Math.random() * .1) + ')';
      c.fillRect(x, 0, 1, h);
    }
    for (var i = 0; i < 500; i++) {
      c.fillStyle = 'rgba(255,255,240,' + Math.random() * .12 + ')';
      c.fillRect(Math.random() * w, Math.random() * h, 1, 2);
    }
  }, 'string');

  return T;
}
window.buildTextures = buildTextures;

/* ------------------------------------------------------------------ 7. GL SETUP */
function initGL() {
  var cv = document.getElementById('cv');
  var gl = cv.getContext('webgl2', {
    antialias: true, alpha: false, depth: true, stencil: false,
    premultipliedAlpha: false, powerPreference: 'high-performance',
    preserveDrawingBuffer: true
  });
  if (!gl) { fail('此浏览器/设备不支持 WebGL2。请使用最新版 Chrome / Edge / Firefox。'); return false; }
  STATE.gl = gl; STATE.canvas = cv;
  if (!gl.getExtension('EXT_color_buffer_float')) { /* not required */ }

  var R = STATE.R = {};
  R.shade = program(gl, VS, FS, 'shade');
  R.wire = program(gl, WIRE_VS, WIRE_FS, 'wire');
  R.pick = program(gl, PICK_VS, PICK_FS, 'pick');
  R.T = buildTextures(gl);

  gl.enable(gl.DEPTH_TEST);
  gl.depthFunc(gl.LEQUAL);
  gl.enable(gl.CULL_FACE);
  gl.cullFace(gl.BACK);
  gl.clearColor(0.027, 0.035, 0.05, 1);
  return true;
}
window.initGL = initGL;

function makeGL(o) {
  var gl = STATE.gl;
  o.vao = gl.createVertexArray();
  gl.bindVertexArray(o.vao);
  o.vbo = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, o.vbo);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(o.g.pos), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
  o.nbo = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, o.nbo);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(o.g.nrm), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(1);
  gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 0, 0);
  o.tbo = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, o.tbo);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(o.g.txc), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(2);
  gl.vertexAttribPointer(2, 3, gl.FLOAT, false, 0, 0);
  o.ibo = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, o.ibo);
  var U = new Uint32Array(o.g.tri);
  o.idxType = gl.UNSIGNED_INT;
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, U, gl.STATIC_DRAW);
  o.count = o.g.tri.length;
  gl.bindVertexArray(null);
  /* wireframe edges */
  o.wvao = gl.createVertexArray();
  gl.bindVertexArray(o.wvao);
  o.wvbo = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, o.wvbo);
  var ED = geoEdges(o.g);
  gl.bufferData(gl.ARRAY_BUFFER, ED, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
  o.wcount = ED.length / 3;
  gl.bindVertexArray(null);
}
window.makeGL = makeGL;

/* ------------------------------------------------------------------ 8. DRAW */
function bindCommon(p, o, model) {
  var gl = STATE.gl, u = p._u;
  gl.uniformMatrix4fv(u.uPV, false, STATE.pv);
  gl.uniformMatrix4fv(u.uModel, false, model);
  if (u.uLocalCenter) gl.uniform3f(u.uLocalCenter, o.g.ctr.x, o.g.ctr.y, o.g.ctr.z);
  if (u.uLocalRadius) gl.uniform1f(u.uLocalRadius, o.g.r);
  if (u.uExplode) gl.uniform1f(u.uExplode, STATE.explode);
  if (u.uSign) gl.uniform1f(u.uSign, o.g.ctr.y >= 0 ? 1 : -1);
  if (u.uVib) gl.uniform1f(u.uVib, o.vibrate ? (0.35 + 0.65 * Math.abs(Math.sin(STATE.time * 0.9))) : 0);
}
window.bindCommon = bindCommon;

function modelOf(o) {
  return m4trs([o.pos.x, o.pos.y, o.pos.z], o.rot, o.scale);
}
window.modelOf = modelOf;

function drawScene() {
  var gl = STATE.gl, R = STATE.R;
  gl.viewport(0, 0, STATE.vw, STATE.vh);
  gl.clearColor(0.027, 0.035, 0.05, 1);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  gl.enable(gl.DEPTH_TEST);
  gl.enable(gl.CULL_FACE);
  gl.disable(gl.BLEND);

  var u = R.shade._u;
  gl.useProgram(R.shade);
  gl.uniform1f(u.uTime, STATE.time);
  gl.uniform3f(u.uEye, STATE.eye.x, STATE.eye.y, STATE.eye.z);
  gl.uniform1f(u.uTexOn, STATE.tex ? 1 : 0);
  gl.activeTexture(gl.TEXTURE0);
  gl.uniform1i(u.uTex0, 0);
  gl.uniform3f(u.uTint, 0.25, 0.83, 0.78);

  var i, k;
  STATE.tris = 0;
  /* opaque pass */
  for (i = 0; i < STATE.drew.length; i++) {
    var o = STATE.drew[i];
    if (o.opacity < .999) continue;
    var model = modelOf(o);
    bindCommon(R.shade, o, model);
    gl.uniform3f(u.uColor, o.color[0], o.color[1], o.color[2]);
    gl.uniform3f(u.uEmiss, o.emiss[0], o.emiss[1], o.emiss[2]);
    gl.uniform1f(u.uRough, o.rough);
    gl.uniform1f(u.uMetal, o.metal);
    gl.uniform1f(u.uUV, o.uv);
    gl.uniform1f(u.uOpacity, 1);
    gl.uniform1f(u.uSel, (STATE.sel === o || STATE.hover === o) ? 1 : 0);
    gl.uniform1f(u.uPick, 0);
    gl.uniform1f(u.uTexMode, o.texMode == null ? -1 : o.texMode);
    if (o.texMode >= 0 && R.T[o.tex] ) gl.bindTexture(gl.TEXTURE_2D, R.T[o.tex].tex);
    gl.bindVertexArray(o.vao);
    gl.drawElements(gl.TRIANGLES, o.count, o.idxType, 0);
    STATE.tris += o.count / 3;
  }
  /* transparent pass */
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  gl.depthMask(false);
  for (i = 0; i < STATE.drew.length; i++) {
    var o2 = STATE.drew[i];
    if (o2.opacity >= .999) continue;
    var m2 = modelOf(o2);
    bindCommon(R.shade, o2, m2);
    gl.uniform3f(u.uColor, o2.color[0], o2.color[1], o2.color[2]);
    gl.uniform3f(u.uEmiss, o2.emiss[0], o2.emiss[1], o2.emiss[2]);
    gl.uniform1f(u.uRough, o2.rough);
    gl.uniform1f(u.uMetal, o2.metal);
    gl.uniform1f(u.uUV, o2.uv);
    gl.uniform1f(u.uOpacity, o2.opacity);
    gl.uniform1f(u.uSel, (STATE.sel === o2 || STATE.hover === o2) ? 1 : 0);
    gl.uniform1f(u.uPick, 0);
    gl.uniform1f(u.uTexMode, o2.texMode == null ? -1 : o2.texMode);
    if (o2.texMode >= 0 && R.T[o2.tex]) gl.bindTexture(gl.TEXTURE_2D, R.T[o2.tex].tex);
    gl.bindVertexArray(o2.vao);
    gl.drawElements(gl.TRIANGLES, o2.count, o2.idxType, 0);
  }
  gl.depthMask(true);
  gl.disable(gl.BLEND);

  /* wireframe overlay */
  if (STATE.wire) {
    gl.useProgram(R.wire);
    gl.uniform3f(R.wire._u.uLine, 0.18, 0.82, 0.78);
    gl.uniform1f(R.wire._u.uOpacity, 0.26);
    gl.enable(gl.POLYGON_OFFSET_FILL);
    gl.polygonOffset(-1.6, -1.6);
    for (i = 0; i < STATE.drew.length; i++) {
      var o3 = STATE.drew[i];
      if (o3.opacity < .999) continue;
      bindCommon(R.wire, o3, modelOf(o3));
      gl.bindVertexArray(o3.wvao);
      gl.drawArrays(gl.LINES, 0, o3.wcount);
    }
    gl.disable(gl.POLYGON_OFFSET_FILL);
  }

  /* engineering grid + measurement lines (flat, drawn as raw segments) */
  if (STATE.grid && STATE.gridGeo) drawLines(STATE.gridGeo, [0.14, 0.17, 0.22], 0.85);
  if (STATE.dims && STATE.dimGeo) drawLines(STATE.dimGeo, [1.0, 0.72, 0.18], 0.95);
  gl.bindVertexArray(null);
}
window.drawScene = drawScene;

/* --- dimension helper geometry ------------------------------------------ */
function buildLineGeo(pts) {
  var gl = STATE.gl, arr = [], i;
  for (i = 0; i < pts.length; i++) arr.push(pts[i].x, pts[i].y, pts[i].z);
  var g = { vao: gl.createVertexArray() };
  gl.bindVertexArray(g.vao);
  var b = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, b);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(arr), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
  gl.bindVertexArray(null);
  g.n = arr.length / 3;
  return g;
}
window.buildLineGeo = buildLineGeo;

function buildDimGeo(segs) {
  var pts = [], i;
  for (i = 0; i < segs.length; i++) { pts.push(segs[i][0], segs[i][1]); }
  STATE.dimGeo = buildLineGeo(pts);
}
window.buildDimGeo = buildDimGeo;

/* draw a raw line-buffer object with the flat wire program */
function drawLines(geo, color, opacity) {
  var gl = STATE.gl, R = STATE.R;
  if (!geo) return;
  gl.useProgram(R.wire);
  gl.uniformMatrix4fv(R.wire._u.uPV, false, STATE.pv);
  gl.uniformMatrix4fv(R.wire._u.uModel, false, m4());
  gl.uniform3f(R.wire._u.uLocalCenter, 0, 0, 0);
  gl.uniform1f(R.wire._u.uLocalRadius, 1);
  gl.uniform1f(R.wire._u.uExplode, 0);
  gl.uniform1f(R.wire._u.uSign, 0);
  gl.uniform3f(R.wire._u.uLine, color[0], color[1], color[2]);
  gl.uniform1f(R.wire._u.uOpacity, opacity);
  gl.bindVertexArray(geo.vao);
  gl.drawArrays(gl.LINES, 0, geo.n);
}
window.drawLines = drawLines;

/* ------------------------------------------------------------------ 9. PICKING */
function initPick() {
  var gl = STATE.gl;
  var fb = gl.createFramebuffer();
  var rb = gl.createRenderbuffer();
  gl.bindRenderbuffer(gl.RENDERBUFFER, rb);
  gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
  gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.RENDERBUFFER, rb);
  var drb = gl.createRenderbuffer();
  gl.bindRenderbuffer(gl.RENDERBUFFER, drb);
  gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, drb);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  STATE.pickFB = fb; STATE.pickRB = rb; STATE.pickDRB = drb;
}
window.initPick = initPick;

function pickAt(px, py) {
  var gl = STATE.gl, R = STATE.R;
  if (!STATE.pickFB) initPick();
  var w = STATE.vw, h = STATE.vh;
  if (STATE.pickW !== w || STATE.pickH !== h) {
    gl.bindRenderbuffer(gl.RENDERBUFFER, STATE.pickRB);
    gl.renderbufferStorage(gl.RENDERBUFFER, gl.RGBA8, w, h);
    gl.bindRenderbuffer(gl.RENDERBUFFER, STATE.pickDRB);
    gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT24, w, h);
    STATE.pickW = w; STATE.pickH = h;
  }
  gl.bindFramebuffer(gl.FRAMEBUFFER, STATE.pickFB);
  gl.viewport(0, 0, w, h);
  gl.clearColor(0, 0, 0, 1);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  gl.enable(gl.DEPTH_TEST); gl.enable(gl.CULL_FACE); gl.disable(gl.BLEND);
  gl.useProgram(R.pick);
  var u = R.pick._u;
  for (var i = 0; i < STATE.drew.length; i++) {
    var o = STATE.drew[i];
    if (o.noPick) continue;
    bindCommon(R.pick, o, modelOf(o));
    gl.uniform1f(u.uPickId, o.pickId);
    gl.bindVertexArray(o.vao);
    gl.drawElements(gl.TRIANGLES, o.count, o.idxType, 0);
  }
  gl.bindVertexArray(null);
  gl.readPixels(px, h - py, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, STATE.pickBuf);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  var b = STATE.pickBuf;
  return b[0] + b[1] * 256 + b[2] * 65536;
}
window.pickAt = pickAt;

/* ------------------------------------------------------------------ 10. VIEWPORT */
function resize() {
  var cv = STATE.canvas;
  var dpr = Math.min(window.devicePixelRatio || 1, 2);
  var w = Math.max(320, Math.floor(window.innerWidth)), h = Math.max(240, Math.floor(window.innerHeight));
  cv.width = Math.floor(w * dpr); cv.height = Math.floor(h * dpr);
  cv.style.width = w + 'px'; cv.style.height = h + 'px';
  STATE.vw = cv.width; STATE.vh = cv.height; STATE.dpr = dpr;
}
window.resize3d = resize;

/* active (unobstructed) viewport rect, in CSS px */
function viewRect() {
  var W = window.innerWidth, H = window.innerHeight;
  var panel = document.getElementById('panel');
  var pr = (panel && W > 760) ? panel.getBoundingClientRect() : null;
  var insetR = (pr && pr.width > 200) ? (W - pr.left + 10) : 10;
  var top = 52, bottom = 80;
  return { x: 6, y: top, w: Math.max(320, W - insetR - 6), h: Math.max(240, H - top - bottom) };
}
window.viewRect = viewRect;

function updateCamera() {
  var c = STATE.cam;
  var R = viewRect();
  var aspect = Math.max(.4, R.w / R.h);
  var e = c.el * DEG, a = c.az * DEG;
  var d = c.dist;
  var eye = V3(c.tx + Math.cos(e) * Math.sin(a) * d, c.ty + Math.sin(e) * d, c.tz + Math.cos(e) * Math.cos(a) * d);
  STATE.eye = eye;
  var up = V3(0, 1, 0);
  if (Math.abs(e) > 1.45) up = V3(0, Math.cos(e + (e > 0 ? -1.5708 : 1.5708)) , 0);
  STATE.view = m4lookAt(eye, V3(c.tx, c.ty, c.tz), V3(0, 1, 0));
  STATE.proj = m4persp(c.fov * DEG, aspect, 4, 16000);
  STATE.pv = m4mul(STATE.proj, STATE.view);
  STATE.rect = R;
}
window.updateCamera = updateCamera;

/* world -> css pixel inside the 3D viewport */
function project(p) {
  var m = STATE.pv;
  var x = m[0] * p.x + m[4] * p.y + m[8] * p.z + m[12];
  var y = m[1] * p.x + m[5] * p.y + m[9] * p.z + m[13];
  var w = m[3] * p.x + m[7] * p.y + m[11] * p.z + m[15];
  if (w <= 0.0001) return null;
  var R = STATE.rect || viewRect();
  var ndcx = x / w, ndcy = y / w;
  return {
    x: R.x + (ndcx * .5 + .5) * R.w,
    y: R.y + (1 - (ndcy * .5 + .5)) * R.h,
    behind: false,
    w: w
  };
}
window.project = project;

/* create the GL buffers for every object (call once after parts are built) */
function uploadAll() {
  var i;
  for (i = 0; i < STATE.objs.length; i++) makeGL(STATE.objs[i]);
  STATE.ready = true;
  var t = 0;
  for (i = 0; i < STATE.objs.length; i++) t += STATE.objs[i].count / 3;
  var el = document.getElementById('cTri');
  if (el) el.innerHTML = 'Tris <b>' + Math.round(t).toLocaleString() + '</b>';
}
window.uploadAll = uploadAll;

/* ghost / x-ray: fade everything except the selected part + riser core */
function applyGhost() {
  var i, o;
  for (i = 0; i < STATE.objs.length; i++) {
    o = STATE.objs[i];
    o.opacity = 1;
  }
  if (STATE.ghost) {
    for (i = 0; i < STATE.objs.length; i++) {
      o = STATE.objs[i];
      if (o.noPick) continue;                 /* the ground plane never fades */
      var keep = (STATE.sel && (o === STATE.sel || (o.group && o.group === STATE.sel.group)));
      if (!keep) o.opacity = o.ghostOpacity == null ? .17 : o.ghostOpacity;
    }
  }
}
window.applyGhost = applyGhost;

/* depth sort + collect draw list */
function frameUpdate() {
  var i, o, list = [];
  for (i = 0; i < STATE.objs.length; i++) {
    o = STATE.objs[i];
    if (o.hidden) continue;
    list.push(o);
  }
  STATE.drew = list;
}
window.frameUpdate = frameUpdate;

/* ------------------------------------------------------------------ 11. MAIN LOOP */
window.renderFrame = function () {
  var now = performance.now();
  var dt = Math.min(.05, (now - STATE.t0) / 1000);
  STATE.t0 = now; STATE.time += dt;
  STATE.acc += dt; STATE.frames++;
  if (STATE.acc > .5) { STATE.fps = STATE.frames / STATE.acc; STATE.acc = 0; STATE.frames = 0; }
  if (STATE.auto && !STATE.drag) STATE.cam.az += dt * 6.5;
  updateCamera();
  frameUpdate();
  drawScene();
  if (window.updateOverlay) window.updateOverlay();
  if (window.updateHUD) window.updateHUD();
  requestAnimationFrame(window.renderFrame);
};

window.initCore = function () {
  if (!initGL()) return false;
  resize();
  window.addEventListener('resize', function () { resize(); });
  return true;
};

})();
