/* ============================================================================
   bowlab / builders.js — geometry toolkit (no Three.js addons, r128 core only)

   Everything is built from explicit buffers so the bow can be re-generated on
   every parameter change and deformed on every frame without leaking geometry.

     prism(profile, x0, x1)   extruded 2D profile in the (y,z) plane along x,
                              with chamfered edges -- used for the machined
                              aluminium parts (riser, pockets, cams, brackets)
     Sweep(...)               a swept rounded-rectangle section along a
                              centreline -- used for the limbs, which bend
     Strand(...)              a tube along a polyline with a fixed vertex
                              budget -- used for the string and cables

   Convention: y = up, z = toward the archer, x = across the bow.
   Profiles are wound CCW in the (u=z, v=y) plane so the +x cap faces outward.
   ========================================================================== */
(function (root) {
  'use strict';
  var BB = {};

  function V(x, y, z) { return new THREE.Vector3(x, y, z); }

  // ---------------------------------------------------------------- prism ---
  /* profile: [{y,z}, ...] closed CCW polygon. Extrudes from x0 to x1 with a
     chamfer of `bevel` on both faces. Optional `inset` shrinks the chamfer
     ring toward the centroid (fake machining bevel). */
  BB.prism = function (profile, x0, x1, opts) {
    opts = opts || {};
    var bevel = opts.bevel === undefined ? 0.035 : opts.bevel;
    var n = profile.length;
    if (x1 < x0) { var t = x0; x0 = x1; x1 = t; }

    var cy = 0, cz = 0, i;
    for (i = 0; i < n; i++) { cy += profile[i].y / n; cz += profile[i].z / n; }
    var maxr = 1e-6;
    for (i = 0; i < n; i++) maxr = Math.max(maxr, Math.hypot(profile[i].y - cy, profile[i].z - cz));
    var outer = x1 - x0;
    bevel = Math.min(bevel, outer * 0.45, maxr * 0.4);
    var k = maxr > 1e-6 ? Math.max(0.55, 1 - bevel / maxr) : 1;

    var ringY = new Float64Array(2 * n), ringZ = new Float64Array(2 * n);
    for (i = 0; i < n; i++) {
      ringY[i] = cy + (profile[i].y - cy) * k; ringZ[i] = cz + (profile[i].z - cz) * k;
      ringY[n + i] = profile[i].y; ringZ[n + i] = profile[i].z;
    }
    // rings: 0 = inset @x0, 1 = full @x0+bevel, 2 = full @x1-bevel, 3 = inset @x1
    var xs = [x0, x0 + bevel, x1 - bevel, x1];
    var rings = [];
    for (var r = 0; r < 4; r++) {
      var ey = (r === 0 || r === 3) ? 0 : n;
      var arr = new Float32Array(3 * n);
      for (i = 0; i < n; i++) {
        arr[3 * i] = xs[r];
        arr[3 * i + 1] = ringY[ey + i];
        arr[3 * i + 2] = ringZ[ey + i];
      }
      rings.push(arr);
    }
    // weld rings into one position array
    var verts = [];
    for (r = 0; r < 4; r++) for (i = 0; i < n; i++) verts.push(rings[r][3 * i], rings[r][3 * i + 1], rings[r][3 * i + 2]);
    var cIdx = [];
    cIdx.push(verts.length / 3); verts.push(x0, cy, cz);
    cIdx.push(verts.length / 3); verts.push(x1, cy, cz);

    var idx = [];
    // caps (fan). +x cap uses ring 3 with the given winding; -x cap reversed.
    for (i = 0; i < n; i++) {
      var j = (i + 1) % n;
      idx.push(cIdx[1], 3 * n + i, 3 * n + j);                  // +x cap
      idx.push(cIdx[0], j, i);                                  // -x cap
    }
    // bands between consecutive rings
    var ringStart = [0, n, 2 * n, 3 * n];
    for (r = 0; r < 3; r++) {
      var a = ringStart[r], b = ringStart[r + 1];
      for (i = 0; i < n; i++) {
        var j2 = (i + 1) % n;
        idx.push(a + i, b + i, b + j2);
        idx.push(a + i, b + j2, a + j2);
      }
    }
    var g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    g.computeBoundingSphere();
    return g;
  };

  // -------------------------------------------------------------- profiles ---
  /* polar profile helper: r(psi) sampled into a CCW (y,z) polygon, psi
     measured from +y toward +z. */
  BB.polarProfile = function (n, rFn, cx, cyc, opts) {
    opts = opts || {};
    var pts = [], i, a;
    for (i = 0; i < n; i++) {
      a = (i / n) * Math.PI * 2;
      // angle from +y towards +z, but iterate clockwise so the polygon is CCW
      var r = rFn(a);
      pts.push({ y: cyc + r * Math.cos(-a), z: cx + r * Math.sin(-a), a: a, r: r });
    }
    return pts;
  };

  BB.circleProfile = function (n, r, cz, cy) {
    var pts = [];
    for (var i = 0; i < n; i++) {
      var a = (i / n) * Math.PI * 2;
      pts.push({ y: cy + r * Math.cos(-a), z: cz + r * Math.sin(-a) });
    }
    return pts;
  };

  // ---------------------------------------------------------------- sweep ---
  /* A swept rounded-rectangle beam.  The section is defined per station:
       width  (across x), thick (in the bending plane), roll (deg)
     `update(points)` rewrites the vertex buffer from a deformed centreline. */
  BB.Sweep = function (opts) {
    var nSeg = opts.segments, nSide = opts.sides || 12;
    var stationFn = opts.station;             // (t) -> {w, h}
    var uAxis = opts.uAxis || V(1, 0, 0);     // section "width" direction
    var superE = opts.superEllipse || 2.6;
    var verts = new Float32Array((nSeg + 1) * nSide * 3);
    var idx = [];
    for (var i = 0; i < nSeg; i++) {
      for (var j = 0; j < nSide; j++) {
        var a = i * nSide + j, b = i * nSide + (j + 1) % nSide;
        var c = (i + 1) * nSide + j, d = (i + 1) * nSide + (j + 1) % nSide;
        idx.push(a, c, d, a, d, b);
      }
    }
    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(verts, 3));
    geo.setIndex(idx);
    var pos = geo.attributes.position;
    var cosT = new Float32Array(nSide), sinT = new Float32Array(nSide);
    for (var s = 0; s < nSide; s++) {
      var ang = (s / nSide) * Math.PI * 2;
      var ca = Math.cos(ang), sa = Math.sin(ang);
      cosT[s] = Math.sign(ca) * Math.pow(Math.abs(ca), 2 / superE);
      sinT[s] = Math.sign(sa) * Math.pow(Math.abs(sa), 2 / superE);
    }
    var T = new THREE.Vector3(), U = new THREE.Vector3(), W = new THREE.Vector3();

    function update(points) {
      var n = points.length;
      for (var i = 0; i < n; i++) {
        var t = i / (n - 1);
        var st = stationFn(t);
        var p = points[i];
        var pPrev = points[Math.max(i - 1, 0)], pNext = points[Math.min(i + 1, n - 1)];
        T.subVectors(pNext, pPrev);
        if (T.lengthSq() < 1e-12) T.set(0, 1, 0);
        T.normalize();
        U.copy(uAxis);
        W.crossVectors(T, U);
        if (W.lengthSq() < 1e-9) { W.set(0, 0, 1); }
        W.normalize();
        U.crossVectors(W, T).normalize();
        for (var j = 0; j < nSide; j++) {
          var o = (i * nSide + j) * 3;
          verts[o] = p.x + U.x * st.w * 0.5 * cosT[j] + W.x * st.h * 0.5 * sinT[j];
          verts[o + 1] = p.y + U.y * st.w * 0.5 * cosT[j] + W.y * st.h * 0.5 * sinT[j];
          verts[o + 2] = p.z + U.z * st.w * 0.5 * cosT[j] + W.z * st.h * 0.5 * sinT[j];
        }
      }
      pos.needsUpdate = true;
      geo.computeVertexNormals();
      geo.computeBoundingSphere();
    }
    return { geometry: geo, update: update, nSeg: nSeg, nSide: nSide };
  };

  // --------------------------------------------------------------- strand ---
  /* A tube along a polyline with a FIXED vertex budget, so update() can just
     rewrite positions (string + cables are re-solved every frame). */
  BB.Strand = function (maxPoints, radius, sides) {
    sides = sides || 6;
    var verts = new Float32Array(maxPoints * sides * 3);
    var idx = [];
    for (var i = 0; i < maxPoints - 1; i++) {
      for (var j = 0; j < sides; j++) {
        var a = i * sides + j, b = i * sides + (j + 1) % sides;
        var c = (i + 1) * sides + j, d = (i + 1) * sides + (j + 1) % sides;
        idx.push(a, c, d, a, d, b);
      }
    }
    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(verts, 3));
    geo.setIndex(idx);
    geo.setDrawRange(0, idx.length);
    var pos = geo.attributes.position;
    var up = new THREE.Vector3(0, 0, 1), tmp = new THREE.Vector3();
    var U = new THREE.Vector3(), W = new THREE.Vector3(), T = new THREE.Vector3();
    var q = new THREE.Quaternion(), prevT = new THREE.Vector3();

    function update(points, rad) {
      var n = Math.min(points.length, maxPoints);
      var r = rad === undefined ? radius : rad;
      U.set(1, 0, 0);
      for (var i = 0; i < n; i++) {
        var p = points[Math.min(i, points.length - 1)];
        var pPrev = points[Math.max(i - 1, 0)], pNext = points[Math.min(i + 1, points.length - 1)];
        T.subVectors(pNext, pPrev);
        if (T.lengthSq() < 1e-12) T.copy(prevT);
        if (T.lengthSq() < 1e-12) T.set(0, 1, 0);
        T.normalize();
        if (i > 0) {
          q.setFromUnitVectors(prevT, T);
          U.applyQuaternion(q);
        } else {
          up.set(0, 0, 1);
          if (Math.abs(T.dot(up)) > 0.95) up.set(1, 0, 0);
          U.crossVectors(T, up).normalize();
        }
        prevT.copy(T);
        W.crossVectors(T, U).normalize();
        for (var j = 0; j < sides; j++) {
          var ang = (j / sides) * Math.PI * 2;
          var ca = Math.cos(ang) * r, sa = Math.sin(ang) * r;
          var o = (i * sides + j) * 3;
          verts[o] = p.x + U.x * ca + W.x * sa;
          verts[o + 1] = p.y + U.y * ca + W.y * sa;
          verts[o + 2] = p.z + U.z * ca + W.z * sa;
        }
      }
      pos.needsUpdate = true;
      geo.computeVertexNormals();
      geo.computeBoundingSphere();
      geo.setDrawRange(0, Math.max(0, (n - 1) * sides * 6));
    }
    return { geometry: geo, update: update, maxPoints: maxPoints };
  };

  // ------------------------------------------------------------- utilities --
  // parallel transport arc of points around a circle in the (y,z) plane
  BB.arcPoints = function (cx, cz, r, a0, a1, n) {
    var out = [];
    for (var i = 0; i < n; i++) {
      var a = a0 + (a1 - a0) * (i / (n - 1));
      out.push(V(0, cx + r * Math.cos(a), cz + r * Math.sin(a)));
    }
    return out;
  };
  BB.v = V;
  BB.clone = function (pts) { return pts.map(function (p) { return p.clone(); }); };

  // soft-shadow friendly local box
  BB.box = function (w, h, d, bevel) {
    var p = [
      { y: h / 2, z: -d / 2 }, { y: h / 2, z: d / 2 }, { y: -h / 2, z: d / 2 }, { y: -h / 2, z: -d / 2 }
    ];
    var g = BB.prism(p, -w / 2, w / 2, { bevel: bevel === undefined ? Math.min(w, h, d) * 0.08 : bevel });
    return g;
  };

  BB.roundedRectProfile = function (w, h, r, perCorner) {
    var hw = w / 2, hh = h / 2;
    r = Math.min(r, hw * 0.98, hh * 0.98);
    perCorner = perCorner || 3;
    var pts = [], i, a;
    function corner(cz, cy, a0) {
      for (i = 0; i <= perCorner; i++) {
        a = a0 + (i / perCorner) * (Math.PI / 2);
        pts.push({ z: cz + r * Math.cos(a), y: cy + r * Math.sin(a) });
      }
    }
    // CCW in (z,y): up the +z side, over the top, down the -z side, along the bottom
    pts.push({ z: hw, y: -hh + r });
    pts.push({ z: hw, y: hh - r });
    corner(hw - r, hh - r, 0);
    pts.push({ z: -hw + r, y: hh });
    corner(-hw + r, hh - r, Math.PI / 2);
    pts.push({ z: -hw, y: -hh + r });
    corner(-hw + r, -hh + r, Math.PI);
    pts.push({ z: hw - r, y: -hh });
    corner(hw - r, -hh + r, -Math.PI / 2);
    return pts;
  };

  /* washer / ring solid in the (y,z) plane extruded along x */
  BB.ringSolid = function (rIn, rOut, x0, x1, n) {
    n = n || 48;
    var verts = [], idx = [], i;
    function ring(r, x) {
      var base = verts.length / 3;
      for (i = 0; i < n; i++) {
        var a = (i / n) * Math.PI * 2;
        verts.push(x, r * Math.cos(a), r * Math.sin(a));
      }
      return base;
    }
    var i0 = ring(rIn, x0), o0 = ring(rOut, x0), i1 = ring(rIn, x1), o1 = ring(rOut, x1);
    for (i = 0; i < n; i++) {
      var j = (i + 1) % n;
      idx.push(i0 + i, o0 + i, o0 + j, i0 + i, o0 + j, i0 + j);       // -x cap
      idx.push(i1 + j, o1 + j, o1 + i, i1 + j, o1 + i, i1 + i);       // +x cap
      idx.push(i0 + i, i0 + j, i1 + j, i0 + i, i1 + j, i1 + i);       // inner wall
      idx.push(o0 + j, o0 + i, o1 + i, o0 + j, o1 + i, o1 + j);       // outer wall
    }
    var g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  };

  /* a rod (cylinder) between two points, as a geometry with a baked transform */
  BB.rodGeo = function (p0, p1, r, seg) {
    var dir = new THREE.Vector3().subVectors(p1, p0);
    var len = dir.length();
    var g = new THREE.CylinderGeometry(r, r, len, seg || 12, 1, false);
    g.rotateX(Math.PI / 2);                       // along +z
    var q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir.clone().normalize());
    var m = new THREE.Matrix4().compose(
      new THREE.Vector3().addVectors(p0, p1).multiplyScalar(0.5), q, new THREE.Vector3(1, 1, 1));
    g.applyMatrix4(m);
    return g;
  };

  root.BowBuilders = BB;
})(window);

