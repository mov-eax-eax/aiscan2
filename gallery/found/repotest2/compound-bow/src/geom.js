/* Geometry helpers for the compound-bow model. Classic script: exposes CB_GEOM. */
(function (global) {
  'use strict';
  const G = {};

  G.roundRectShape = function (w, h, r) {
    const s = new THREE.Shape();
    const x = -w / 2, y = -h / 2;
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
  };

  G.roundRectPath = function (w, h, r, cx, cy) {
    const p = new THREE.Path();
    const x = (cx || 0) - w / 2, y = (cy || 0) - h / 2;
    p.moveTo(x + r, y);
    p.lineTo(x + w - r, y);
    p.quadraticCurveTo(x + w, y, x + w, y + r);
    p.lineTo(x + w, y + h - r);
    p.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    p.lineTo(x + r, y + h);
    p.quadraticCurveTo(x, y + h, x, y + h - r);
    p.lineTo(x, y + r);
    p.quadraticCurveTo(x, y, x + r, y);
    return p;
  };

  G.circlePath = function (r, cx, cy) {
    const p = new THREE.Path();
    p.absarc(cx || 0, cy || 0, r, 0, Math.PI * 2, true);
    return p;
  };

  G.blobShape = function (pts) {
    const s = new THREE.Shape();
    const v = pts.map(function (a) { return new THREE.Vector2(a[0], a[1]); });
    s.moveTo(v[0].x, v[0].y);
    s.splineThru(v.slice(1));
    s.closePath();
    return s;
  };

  G.blobPath = function (pts) {
    const p = new THREE.Path();
    const v = pts.map(function (a) { return new THREE.Vector2(a[0], a[1]); });
    p.moveTo(v[0].x, v[0].y);
    p.splineThru(v.slice(1));
    p.closePath();
    return p;
  };

  G.polarRing = function (fn, rFn, samples) {
    const pts = [];
    for (let i = 0; i < samples; i++) {
      const a = i / samples * Math.PI * 2;
      const r = rFn(a);
      pts.push([Math.cos(a) * r, Math.sin(a) * r]);
    }
    return pts;
  };

  G.polarOffset = function (rFn, scale, samples) {
    const pts = [];
    for (let i = 0; i < samples; i++) {
      const a = i / samples * Math.PI * 2;
      const r = rFn(a) * scale;
      pts.push([Math.cos(a) * r, Math.sin(a) * r]);
    }
    return pts;
  };

  /* Extrude a 2D shape in Z, centred on z=0, with a small machined bevel. */
  G.plate = function (shape, th, bevel) {
    const b = (bevel === undefined) ? Math.min(0.04, th * 0.15) : bevel;
    const g = new THREE.ExtrudeGeometry(shape, {
      depth: th, bevelEnabled: b > 0, bevelThickness: b, bevelSize: b,
      bevelSegments: 2, curveSegments: 26, steps: 1
    });
    g.translate(0, 0, -th / 2);
    g.computeVertexNormals();
    return g;
  };

  /* Sweep a rectangular section along a 3D centreline (mostly in XY).
     halfW = half width along Z, halfT = half thickness along the in-plane
     normal.  Numbers or per-station arrays. */
  G.sweep = function (center, halfW, halfT) {
    const N = center.length;
    const wAt = (typeof halfW === 'number') ? function () { return halfW; } : function (i) { return halfW[i]; };
    const tAt = (typeof halfT === 'number') ? function () { return halfT; } : function (i) { return halfT[i]; };
    const Z = new THREE.Vector3(0, 0, 1);
    const frames = [];
    for (let i = 0; i < N; i++) {
      const t = new THREE.Vector3();
      if (i === 0) t.subVectors(center[1], center[0]);
      else if (i === N - 1) t.subVectors(center[N - 1], center[N - 2]);
      else t.subVectors(center[i + 1], center[i - 1]);
      if (t.lengthSq() === 0) t.set(0, 1, 0);
      t.normalize();
      frames.push(new THREE.Vector3().crossVectors(t, Z).normalize());
    }
    const corners = [];
    for (let i = 0; i < N; i++) {
      const c = center[i], n = frames[i], w = wAt(i), h = tAt(i);
      corners.push([
        new THREE.Vector3().copy(c).addScaledVector(Z, w).addScaledVector(n, h),
        new THREE.Vector3().copy(c).addScaledVector(Z, -w).addScaledVector(n, h),
        new THREE.Vector3().copy(c).addScaledVector(Z, -w).addScaledVector(n, -h),
        new THREE.Vector3().copy(c).addScaledVector(Z, w).addScaledVector(n, -h)
      ]);
    }
    const pos = [];
    const put = function (v) { pos.push(v.x, v.y, v.z); };
    for (let i = 0; i < N - 1; i++) {
      const c0 = corners[i], c1 = corners[i + 1];
      for (let k = 0; k < 4; k++) {
        const k2 = (k + 1) % 4;
        put(c0[k]); put(c0[k2]); put(c1[k2]);
        put(c0[k]); put(c1[k2]); put(c1[k]);
      }
    }
    const a0 = corners[0], aN = corners[N - 1];
    put(a0[0]); put(a0[1]); put(a0[2]); put(a0[0]); put(a0[2]); put(a0[3]);
    put(aN[0]); put(aN[2]); put(aN[1]); put(aN[0]); put(aN[3]); put(aN[2]);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.computeVertexNormals();
    return g;
  };

  G.tube = function (pts, r, radial, tubular) {
    const cc = pts.map(function (p) { return p.clone ? p.clone() : new THREE.Vector3(p[0], p[1], p[2]); });
    const curve = new THREE.CatmullRomCurve3(cc);
    return new THREE.TubeGeometry(curve, tubular || Math.max(10, cc.length * 8), r, radial || 8, false);
  };

  G.cyl = function (r, h, seg) {
    return new THREE.CylinderGeometry(r, r, h, seg || 22, 1, false);
  };

  G.cone = function (r1, r2, h, seg) {
    return new THREE.CylinderGeometry(r1, r2, h, seg || 22, 1, false);
  };

  /* A rounded box as a plate: w along X, h along Y, d along Z. */
  G.roundedBox = function (w, h, d, r) {
    return G.plate(G.roundRectShape(w, h, r), d, Math.min(0.035, d * 0.12));
  };

  global.CB_GEOM = G;
})(window);
