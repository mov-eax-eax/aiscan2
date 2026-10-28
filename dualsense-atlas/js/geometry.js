// ============================================================================
// DualSense Ontology Atlas - procedural geometry from ontology descriptors
// Millimetres. x right; y down from top edge; z toward face.
// ============================================================================
(function () {
  "use strict";
  const O = window.ONTOLOGY;
  const byId = new Map(O.entities.map(function (e) { return [e.id, e]; }));
  const matById = new Map(O.entities.filter(function (e) { return e.layer === "material"; }).map(function (e) { return [e.id, e]; }));

  function matColor(id) { const m = matById.get(id); return (m && m.color) || "#8b98a8"; }

  const TAU = Math.PI * 2;
  function add(a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
  function rotZ(p, deg) { const c = Math.cos(deg * Math.PI / 180), s = Math.sin(deg * Math.PI / 180); return [p[0] * c - p[1] * s, p[0] * s + p[1] * c, p[2]]; }
  function rotX(p, deg) { const c = Math.cos(deg * Math.PI / 180), s = Math.sin(deg * Math.PI / 180); return [p[0], p[1] * c - p[2] * s, p[1] * s + p[2] * c]; }
  function smoothstep(a, b, x) { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); }

  function roundRect(w, h, r, seg) {
    const pts = []; r = Math.min(r, w / 2, h / 2);
    const corners = [[w / 2 - r, -h / 2 + r, -90], [w / 2 - r, h / 2 - r, 0], [-w / 2 + r, h / 2 - r, 90], [-w / 2 + r, -h / 2 + r, 180]];
    for (let c = 0; c < corners.length; c++) {
      const cx = corners[c][0], cy = corners[c][1], a0 = corners[c][2];
      for (let i = 0; i <= seg; i++) {
        const a = (a0 + i * 90 / seg) * Math.PI / 180;
        pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
      }
    }
    return pts;
  }
  function superellipse(w, h, n, seg) {
    const pts = [];
    for (let i = 0; i < seg; i++) {
      const t = TAU * i / seg, c = Math.cos(t), s = Math.sin(t);
      pts.push([w / 2 * Math.sign(c) * Math.pow(Math.abs(c), 2 / n), h / 2 * Math.sign(s) * Math.pow(Math.abs(s), 2 / n)]);
    }
    return pts;
  }
  function circle(r, seg) { const p = []; for (let i = 0; i < seg; i++) { const a = TAU * i / seg; p.push([r * Math.cos(a), r * Math.sin(a)]); } return p; }
  function mirrorHalf(half) { const out = half.slice(); for (let i = half.length - 2; i >= 1; i--) out.push([-half[i][0], half[i][1]]); return out; }
  function shapePoints(shape) {
    if (!shape) return [];
    if (shape.type === "roundrect") return roundRect(shape.w, shape.h, shape.r || 2, shape.seg || 5);
    if (shape.type === "superellipse") return superellipse(shape.w, shape.h, shape.n || 3, shape.seg || 64);
    if (shape.type === "circle") return circle(shape.r, shape.seg || 32);
    if (shape.type === "polygon") return shape.half ? mirrorHalf(shape.half) : shape.points.slice();
    return [];
  }
  function place(points, at, rot) {
    return points.map(function (p) {
      const q = rot ? rotZ([p[0], p[1], 0], rot) : [p[0], p[1], 0];
      return [q[0] + (at ? at[0] : 0), q[1] + (at ? at[1] : 0), 0];
    });
  }
  function catmullClosed(points, perSpan) {
    const n = points.length, out = [];
    for (let i = 0; i < n; i++) {
      const p0 = points[(i - 1 + n) % n], p1 = points[i], p2 = points[(i + 1) % n], p3 = points[(i + 2) % n];
      for (let s = 0; s < perSpan; s++) {
        const t = s / perSpan, t2 = t * t, t3 = t2 * t;
        out.push([
          0.5 * ((2 * p1[0]) + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
          0.5 * ((2 * p1[1]) + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3),
        ]);
      }
    }
    return out;
  }
  function pointInPoly(x, y, poly) {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const xi = poly[i][0], yi = poly[i][1], xj = poly[j][0], yj = poly[j][1];
      if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  }
  function insetPolygon(poly, d) {
    const n = poly.length, out = [];
    for (let i = 0; i < n; i++) {
      const p = poly[i], a = poly[(i - 1 + n) % n], b = poly[(i + 1) % n];
      let e1 = [p[0] - a[0], p[1] - a[1]], e2 = [b[0] - p[0], b[1] - p[1]];
      const l1 = Math.hypot(e1[0], e1[1]) || 1, l2 = Math.hypot(e2[0], e2[1]) || 1;
      e1 = [e1[0] / l1, e1[1] / l1]; e2 = [e2[0] / l2, e2[1] / l2];
      let n1 = [-e1[1], e1[0]], n2 = [-e2[1], e2[0]];
      if (!pointInPoly(p[0] + n1[0] * 0.05, p[1] + n1[1] * 0.05, poly)) n1 = [-n1[0], -n1[1]];
      if (!pointInPoly(p[0] + n2[0] * 0.05, p[1] + n2[1] * 0.05, poly)) n2 = [-n2[0], -n2[1]];
      let m = [n1[0] + n2[0], n1[1] + n2[1]];
      const ml = Math.hypot(m[0], m[1]) || 1; m = [m[0] / ml, m[1] / ml];
      if (!pointInPoly(p[0] + m[0] * 0.05, p[1] + m[1] * 0.05, poly)) m = n1;
      out.push([p[0] + m[0] * d, p[1] + m[1] * d]);
    }
    return out;
  }

  const faces = [], decorations = [];
  let currentPart = null, currentHidden = false, currentGhost = false;

  function face(v, mat, opts) {
    if (v.length < 3) return;
    const o = opts || {};
    faces.push({ v: v, mat: mat || "mat.core-black", part: o.part || currentPart, hidden: currentHidden, ghost: currentGhost, emissive: !!o.emissive, glow: !!o.glow, rear: !!o.rear, surface: !!o.surface, seamless: !!o.seamless });
  }
  function quad(a, b, c, d, mat, opts) { face([a, b, c, d], mat, opts); }
  function decorate(d) { decorations.push(Object.assign({ part: currentPart }, d)); }
  function topPolygon(points2, z, mat, opts) { face(points2.map(function (p) { return [p[0], p[1], z]; }), mat, opts); }
  function sideWall(points2, z0, z1, mat, opts) {
    for (let i = 0; i < points2.length; i++) {
      const j = (i + 1) % points2.length;
      quad([points2[i][0], points2[i][1], z0], [points2[j][0], points2[j][1], z0], [points2[j][0], points2[j][1], z1], [points2[i][0], points2[i][1], z1], mat, opts);
    }
  }

  const outlineEnt = byId.get("curve.body-outline");
  const half = outlineEnt && outlineEnt.params ? outlineEnt.params.half : [];
  const rawOutline = mirrorHalf(half);
  const outline = catmullClosed(rawOutline, (outlineEnt && outlineEnt.params && outlineEnt.params.samplesPerSpan) || 4);
  const outlineInset2 = insetPolygon(outline, 2);
  const outlineInset5 = insetPolygon(outline, 5);

  function depthAt(y, g) {
    const top = g.depthTop || 22, base = g.depthBase || 26, grip = g.depthGrip || 54;
    const d = top + (base - top) * smoothstep(0, 22, y);
    return d + (grip - d) * smoothstep(g.gripStart || 50, g.gripEnd || 92, y);
  }

  function buildShell(e, g) {
    const frontPart = g.frontPart || currentPart, rearPart = g.rearPart || currentPart;
    topPolygon(outlineInset2, 0, g.topMat);
    for (let i = 0; i < outline.length; i++) {
      const j = (i + 1) % outline.length;
      quad([outlineInset2[i][0], outlineInset2[i][1], 0], [outlineInset2[j][0], outlineInset2[j][1], 0], [outline[j][0], outline[j][1], -2.4], [outline[i][0], outline[i][1], -2.4], g.topMat);
    }
    const midZ = [], botZ = [];
    for (let i = 0; i < outline.length; i++) {
      const dep = depthAt(outline[i][1], g);
      midZ.push(-Math.min(18, dep * 0.6)); botZ.push(-dep);
    }
    for (let i = 0; i < outline.length; i++) {
      const j = (i + 1) % outline.length;
      const p = outline[i], q = outline[j];
      quad([p[0], p[1], -2.4], [q[0], q[1], -2.4], [q[0], q[1], midZ[j]], [p[0], p[1], midZ[i]], g.sideMat);
      quad([p[0], p[1], midZ[i]], [q[0], q[1], midZ[j]], [q[0], q[1], botZ[j]], [p[0], p[1], botZ[i]], g.bottomMat, { part: rearPart });
      quad([p[0], p[1], botZ[i]], [q[0], q[1], botZ[j]], [outlineInset5[j][0], outlineInset5[j][1], botZ[j] - 2], [outlineInset5[i][0], outlineInset5[i][1], botZ[i] - 2], g.bottomMat, { part: rearPart });
    }
    face(outlineInset5.map(function (p, i) { return [p[0], p[1], botZ[i] - 2]; }), g.bottomMat, { part: rearPart, rear: true });
    // keep frontPart referenced even if only the top cap belongs to it
    void frontPart;
  }

  function buildPlate(e, g) {
    const pts = place(shapePoints(g.shape), g.at, g.rot || 0);
    const z = g.z || 0, t = g.t == null ? 1 : g.t;
    const surf = z >= 0.2;
    topPolygon(pts, z, g.mat, { emissive: g.emissive, glow: g.glow, part: g.part, surface: surf });
    if (t > 0.05) {
      sideWall(pts, z - t, z, g.mat, { part: g.part });
      face(pts.map(function (p) { return [p[0], p[1], z - t]; }), g.mat, { rear: true, part: g.part });
    }
    if (g.glyph) decorate({ type: "glyph", glyph: g.glyph, at: [g.at[0], g.at[1], z + 0.02], size: g.glyphSize || null });
    if (g.arrow) decorate({ type: "arrow", dir: g.arrow, at: [g.at[0], g.at[1], z + 0.02], size: 4.2 });
    if (g.label) decorate({ type: "text", text: g.label, at: [g.at[0], g.at[1], z + 0.02], size: g.labelSize || 2.2 });
  }
  function buildBar(e, g) { buildPlate(e, Object.assign({}, g, { shape: { type: "roundrect", w: g.w, h: g.h, r: Math.min(g.w, g.h) * 0.42 } })); }
  function buildCylinder(e, g) {
    const x = g.at[0], y = g.at[1], r = g.r, z0 = g.z || 0, z1 = z0 + (g.h || 2), seg = g.seg || 32;
    const ring = []; for (let i = 0; i < seg; i++) { const a = TAU * i / seg; ring.push([x + r * Math.cos(a), y + r * Math.sin(a)]); }
    sideWall(ring, z0, z1, g.mat, { surface: z0 >= 0.2 });
    const top = ring.map(function (p) { return [p[0], p[1], z1]; });
    face(top, g.mat, { emissive: g.emissive, surface: z0 >= 0.2 });
    face(top.map(function (p) { return [p[0], p[1], z0]; }), g.mat, { rear: true });
    if (g.dome) face([[x, y, z1 + g.dome]].concat(top.slice(0, 1)), g.mat);
    if (g.glyph) decorate({ type: "glyph", glyph: g.glyph, at: [x, y, z1 + 0.05], size: g.glyphSize || null });
  }
  function buildStickCap(e, g) {
    const x = g.at[0], y = g.at[1], z0 = g.z || 0, R = g.r, H = g.h || 7;
    const profile = [[0.99, 0], [1, 0.9], [0.99, 2.1], [0.94, 3.3], [0.86, 4.4], [0.74, 5.4], [0.59, 6.1], [0.43, 6.55], [0.25, 6.8], [0.1, 6.9], [0, 6.9]]
      .map(function (p) { return [p[0] * R, z0 + p[1] * H / 7]; });
    const seg = 40;
    for (let k = 0; k < profile.length - 1; k++) {
      const r0 = profile[k][0], za = profile[k][1], r1 = profile[k + 1][0], zb = profile[k + 1][1];
      for (let i = 0; i < seg; i++) {
        const a0 = TAU * i / seg, a1 = TAU * (i + 1) / seg;
        quad([x + r0 * Math.cos(a0), y + r0 * Math.sin(a0), za], [x + r0 * Math.cos(a1), y + r0 * Math.sin(a1), za], [x + r1 * Math.cos(a1), y + r1 * Math.sin(a1), zb], [x + r1 * Math.cos(a0), y + r1 * Math.sin(a0), zb], g.mat, { surface: true });
      }
    }
    const last = profile[profile.length - 1];
    face(circle(last[0], 20).map(function (p) { return [x + p[0], y + p[1], last[1]]; }), g.mat, { surface: true });
    face(circle(R, 20).map(function (p) { return [x + p[0], y + p[1], z0]; }), g.mat, { rear: true });
  }
  function buildRing(e, g) {
    const x = g.at[0], y = g.at[1], seg = 40, z0 = g.z, z1 = z0 + (g.h || 1), r2 = g.r2 || g.r - 0.5;
    const outer = [], inner = [];
    for (let i = 0; i < seg; i++) {
      const a = TAU * i / seg;
      outer.push([x + g.r * Math.cos(a), y + g.r * Math.sin(a)]);
      inner.push([x + r2 * Math.cos(a), y + r2 * Math.sin(a)]);
    }
    sideWall(outer, z0, z1, g.mat);
    for (let i = 0; i < seg; i++) {
      const j = (i + 1) % seg;
      quad([outer[i][0], outer[i][1], z1], [outer[j][0], outer[j][1], z1], [inner[j][0], inner[j][1], z1], [inner[i][0], inner[i][1], z1], g.mat);
    }
  }
  function buildBox(e, g) {
    const x = g.at[0], y = g.at[1], z = g.at[2], w = g.w, h = g.h, d = g.d;
    const x0 = x - w / 2, x1 = x + w / 2, y0 = y - h / 2, y1 = y + h / 2, z0 = z - d / 2, z1 = z + d / 2;
    const V = [[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]];
    const F = [[0, 1, 2, 3], [4, 5, 6, 7], [0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7]];
    for (let i = 0; i < F.length; i++) face(F[i].map(function (k) { return V[k]; }), g.mat);
  }
  function buildTrigger(e, g) {
    const pts = superellipse(g.w, g.h, 3.2, 40);
    const at = [g.at[0], g.at[1], g.z];
    const V0 = pts.map(function (p) { return add(rotX(rotZ([p[0], p[1], -g.d / 2], g.rotZ || 0), g.rotX || 0), at); });
    const V1 = pts.map(function (p) { return add(rotX(rotZ([p[0], p[1], g.d / 2], g.rotZ || 0), g.rotX || 0), at); });
    face(V1, g.mat); face(V0, g.mat, { rear: true });
    for (let i = 0; i < pts.length; i++) { const j = (i + 1) % pts.length; quad(V0[i], V0[j], V1[j], V1[i], g.mat); }
  }
  function buildPetal(e, g) {
    const shape = { type: "roundrect", w: g.w, h: g.h, r: Math.min(g.w, g.h) * 0.34 };
    buildPlate(e, Object.assign({}, g, { shape: shape, surface: true }));
    if (g.arrow) decorate({ type: "arrow", dir: g.arrow, at: [g.at[0], g.at[1], g.z + 0.04], size: g.arrowSize || 3.6 });
  }
  function buildGrille(e, g) {
    for (let row = 0; row < (g.rows || 2); row++) {
      const count = row === 0 ? (g.cols || 5) : (g.cols || 5) - 1;
      for (let i = 0; i < count; i++) {
        const x = g.at[0] + (i - (count - 1) / 2) * g.pitchX;
        const y = g.at[1] + (row - 0.5) * g.pitchY;
        face(circle(g.r || 0.65, 16).map(function (p) { return [x + p[0], y + p[1], g.z]; }), g.mat, { surface: true });
      }
    }
  }
  function buildScrew(e, g) {
    face(circle(g.r, 20).map(function (p) { return [g.at[0] + p[0], g.at[1] + p[1], g.z]; }), g.mat);
    decorate({ type: "cross", at: [g.at[0], g.at[1], g.z - 0.01], size: g.r * 1.3 });
  }

  for (let ei = 0; ei < O.entities.length; ei++) {
    const e = O.entities[ei];
    if (!e.geom || !e.geom.length) continue;
    currentPart = e.id;
    for (let gi = 0; gi < e.geom.length; gi++) {
      const g = e.geom[gi];
      currentHidden = !!g.hidden; currentGhost = !!g.hidden;
      switch (g.kind) {
        case "shell": buildShell(e, g); break;
        case "plate": buildPlate(e, g); break;
        case "bar": buildBar(e, g); break;
        case "cylinder": buildCylinder(e, g); break;
        case "stickCap": buildStickCap(e, g); break;
        case "ring": buildRing(e, g); break;
        case "box": buildBox(e, g); break;
        case "trigger": buildTrigger(e, g); break;
        case "petal": buildPetal(e, g); break;
        case "grille": buildGrille(e, g); break;
        case "circle": face(circle(g.r, 28).map(function (p) { return [g.at[0] + p[0], g.at[1] + p[1], g.z]; }), g.mat, { emissive: g.emissive, surface: (g.z || 0) >= 0.2 }); break;
        case "screw": buildScrew(e, g); break;
        default: break;
      }
    }
  }

  for (let i = 0; i < 5; i++) decorations.push({ part: "part.player-led", type: "dot", at: [-20 + i * 5, 30.2, 1.62], r: 0.55, cls: "led" });

  const dims = O.entities.filter(function (e) { return e.layer === "dimension" && e.annot; });
  let mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
  for (let fi = 0; fi < faces.length; fi++) for (let vi = 0; vi < faces[fi].v.length; vi++) for (let k = 0; k < 3; k++) {
    const v = faces[fi].v[vi][k]; if (v < mn[k]) mn[k] = v; if (v > mx[k]) mx[k] = v;
  }

  window.DSA_GEOM = {
    faces: faces, decorations: decorations, outline: outline, outlineInset2: outlineInset2,
    materials: matById, matColor: matColor, byId: byId, dims: dims, bounds: { min: mn, max: mx },
  };
})();
