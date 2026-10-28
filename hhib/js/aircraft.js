/* ============================================================================
   BOEING 747-400  --  procedural, ultra-detailed Three.js model
   Everything is generated from code: no external meshes or textures.
   Coordinate system: +X = nose, +Y = up, +Z = right wing. Units = metres.
   ==========================================================================*/
window.BOEING747 = (function () {
  'use strict';
  var T = window.THREE;
  var D2R = Math.PI / 180;

  /* ---------------------------------------------------------------- utils */
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function smoothstep(e0, e1, x) { var t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); }
  function col(hex) { return new T.Color(hex).convertSRGBToLinear(); }
  function V3(x, y, z) { return new T.Vector3(x, y, z); }
  function V2(x, y) { return new T.Vector2(x, y); }

  /* ------------------------------------------------------------- airfoils */
  // NACA-style thickness + parabolic camber.  u = 0 at leading edge, 1 at TE.
  function airfoil(u, tc, camber) {
    u = clamp(u, 0, 1);
    var yt = 5 * tc * (0.2969 * Math.sqrt(u) - 0.1260 * u - 0.3516 * u * u
      + 0.2843 * u * u * u - 0.1036 * u * u * u * u);
    var yc = 4 * camber * u * (1 - u);
    return { yt: yt, yc: yc };
  }

  /* ----------------------------------------------------- generic lofting */
  // rings: array of equal-length point arrays. Optionally close the ring.
  function loft(rings, o) {
    o = o || {};
    var ringClosed = o.ringClosed !== false;
    var R = o.reverse ? rings.map(function (r) { return r.slice().reverse(); }) : rings;
    var n = R.length, m = R[0].length;
    var pos = [], uv = [], idx = [], i, j, k = 0, uk = 0;
    for (i = 0; i < n; i++) {
      for (j = 0; j < m; j++) {
        var p = R[i][j];
        pos.push(p.x, p.y, p.z);
        uv.push(i / (n - 1), j / (m - 1));
      }
    }
    var lim = ringClosed ? m : m - 1;
    for (i = 0; i < n - 1; i++) {
      for (j = 0; j < lim; j++) {
        var j2 = (j + 1) % m;
        var a = i * m + j, b = i * m + j2, c = (i + 1) * m + j, d = (i + 1) * m + j2;
        idx.push(a, c, b, b, c, d);
      }
    }
    // flat fan caps (only used on small parts)
    function cap(ringIndex, flip) {
      var ring = R[ringIndex], ctr = V3(0, 0, 0);
      for (var q = 0; q < ring.length; q++) ctr.add(ring[q]);
      ctr.multiplyScalar(1 / ring.length);
      var ci = pos.length / 3;
      pos.push(ctr.x, ctr.y, ctr.z); uv.push(0.5, 0.5);
      for (var q2 = 0; q2 < ring.length; q2++) {
        var q3 = (q2 + 1) % ring.length;
        var base = ringIndex * m;
        if (flip) idx.push(ci, base + q3, base + q2);
        else idx.push(ci, base + q2, base + q3);
      }
    }
    if (o.capStart) cap(0, false);
    if (o.capEnd) cap(n - 1, true);
    var g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  }

  /* ============================================================ FUSELAGE */
  var F = {
    L: 70.7, halfL: 35.35,      // overall length
    a: 3.25, b: 3.20,           // half width / half height of the barrel
    hump: 1.90,                 // upper-deck hump height
    tNose: 0.105, tTail: 0.745
  };

  function fusRS(t) {
    if (t <= 0.0002) return 0.0002;
    if (t < F.tNose) { var u = t / F.tNose; return Math.pow(1 - (1 - u) * (1 - u), 0.5); }
    if (t <= F.tTail) return 1;
    var v = (t - F.tTail) / (1 - F.tTail);
    return Math.pow(1 - v, 0.82) * 0.985 + 0.015;
  }
  function fusUp(t) {                       // tail cone upsweep
    if (t <= F.tTail) return 0;
    var v = (t - F.tTail) / (1 - F.tTail);
    return 3.3 * Math.pow(smoothstep(0, 1, v), 1.3);
  }
  function fusHump(t) {                     // upper deck
    return F.hump * smoothstep(0.105, 0.175, t) * (1 - smoothstep(0.395, 0.505, t));
  }
  function fusBelly(t) {                    // wing/body fairing
    return 0.95 * smoothstep(0.30, 0.43, t) * (1 - smoothstep(0.62, 0.80, t));
  }
  function fusPoint(t, th) {
    var rs = fusRS(t), a = F.a * rs, b = F.b * rs;
    var c = Math.cos(th), s = Math.sin(th);
    var x = F.halfL - t * F.L;
    var y = fusUp(t) + b * c;
    if (c > 0) y += fusHump(t) * Math.pow(c, 1.9);
    else y -= fusBelly(t) * Math.pow(-c, 1.35);
    return V3(x, y, a * s);
  }
  function fusNormal(t, th) {
    var dt = 0.0007, da = 0.002;
    var pt = fusPoint(t + dt, th).sub(fusPoint(t - dt, th));
    var pa = fusPoint(t, th + da).sub(fusPoint(t, th - da));
    return pt.cross(pa).normalize();
  }
  // side: +1 right (+Z), -1 left.  thSide measured down from the top.
  function sideTheta(thSide, side) { return side > 0 ? thSide : (Math.PI * 2 - thSide); }

  function fusBand(t0, t1, th0, th1, off, mat, nt, na) {
    nt = nt || 26; na = na || 6;
    var rings = [];
    for (var i = 0; i <= nt; i++) {
      var t = lerp(t0, t1, i / nt), ring = [];
      for (var j = 0; j <= na; j++) {
        var th = lerp(th0, th1, j / na);
        var p = fusPoint(t, th);
        p.addScaledVector(fusNormal(t, th), off);
        ring.push(p);
      }
      rings.push(ring);
    }
    return new T.Mesh(loft(rings, { ringClosed: false }), mat);
  }

  // A flat plate tangent to the fuselage skin (doors, text, window panes...)
  function plateFrame(t, thSide, side) {
    var th = sideTheta(thSide, side);
    var p = fusPoint(t, th), n = fusNormal(t, th);
    var bx = V3(0, 1, 0).cross(n);
    if (bx.lengthSq() < 1e-8) bx.set(1, 0, 0);
    bx.normalize();
    var by = n.clone().cross(bx).normalize();
    return { p: p, n: n, bx: bx, by: by, th: th };
  }

  /* ======================================================= material set */
  var PALETTES = {
    house: { name: 'Boeing House', fuselage: 0xffffff, belly: 0xbfc7d1, stripe: 0x093a6b, accent: 0x35b6e6, tail: 0x093a6b, cowl: 0x093a6b, wing: 0xdfe4ea, gear: 0xf2f4f6 },
    retro: { name: 'Retro Red', fuselage: 0xfffaf3, belly: 0xd6cfc4, stripe: 0xb02a1e, accent: 0xe7b53c, tail: 0x7d1a12, cowl: 0xb02a1e, wing: 0xe4e0da, gear: 0xf4f0ea },
    jade: { name: 'Jade', fuselage: 0xfbfdfd, belly: 0xc2cdcd, stripe: 0x0d4f42, accent: 0x63c7a0, tail: 0x0d4f42, cowl: 0x0d4f42, wing: 0xdfe6e4, gear: 0xf2f6f4 }
  };

  function makeMaterials(pal) {
    var m = {};
    m.fuselage = new T.MeshStandardMaterial({ vertexColors: true, color: col(pal.fuselage), roughness: 0.34, metalness: 0.18, envMapIntensity: 1.2 });
    m.stripe = new T.MeshStandardMaterial({ color: col(pal.stripe), roughness: 0.36, metalness: 0.12 });
    m.accent = new T.MeshStandardMaterial({ color: col(pal.accent), roughness: 0.4, metalness: 0.1 });
    m.tail = new T.MeshStandardMaterial({ color: col(pal.tail), roughness: 0.34, metalness: 0.14 });
    m.cowl = new T.MeshStandardMaterial({ color: col(pal.cowl), roughness: 0.3, metalness: 0.4, side: T.DoubleSide, envMapIntensity: 1.3 });
    m.wing = new T.MeshStandardMaterial({ color: col(pal.wing), roughness: 0.42, metalness: 0.32 });
    m.surface = new T.MeshStandardMaterial({ color: col(pal.wing), roughness: 0.44, metalness: 0.26, side: T.DoubleSide });
    m.metal = new T.MeshStandardMaterial({ color: col(0xb8c0c9), roughness: 0.26, metalness: 0.96, envMapIntensity: 1.5 });
    m.dark = new T.MeshStandardMaterial({ color: col(0x121519), roughness: 0.55, metalness: 0.45 });
    m.glass = new T.MeshStandardMaterial({ color: col(0x08131c), roughness: 0.06, metalness: 0.9, envMapIntensity: 2.6, side: T.DoubleSide });
    m.tire = new T.MeshStandardMaterial({ color: col(0x17191c), roughness: 0.92, metalness: 0.04 });
    m.hub = new T.MeshStandardMaterial({ color: col(0x8f98a2), roughness: 0.38, metalness: 0.82 });
    m.white = new T.MeshStandardMaterial({ color: col(0xf5f6f8), roughness: 0.4, metalness: 0.1 });
    m.gap = new T.MeshStandardMaterial({ color: col(0x8f99a5), roughness: 0.55, metalness: 0.2 });
    m.panel = new T.MeshStandardMaterial({ color: col(0xd4dae1), roughness: 0.44, metalness: 0.3, side: T.DoubleSide });
    m.fillet = new T.MeshStandardMaterial({ color: col(pal.fuselage), roughness: 0.36, metalness: 0.14 });
    m.gearDoor = new T.MeshStandardMaterial({ color: col(pal.gear), roughness: 0.45, metalness: 0.15, side: T.DoubleSide });
    m.redL = new T.MeshStandardMaterial({ color: col(0xff2b1a), emissive: col(0xff2b1a), emissiveIntensity: 2.4, roughness: 0.4 });
    m.greenR = new T.MeshStandardMaterial({ color: col(0x25ff6a), emissive: col(0x25ff6a), emissiveIntensity: 2.2, roughness: 0.4 });
    m.strobe = new T.MeshStandardMaterial({ color: col(0xffffff), emissive: col(0xffffff), emissiveIntensity: 3.5, roughness: 0.3 });
    m.landLight = new T.MeshStandardMaterial({ color: col(0xfff6e0), emissive: col(0xfff2c8), emissiveIntensity: 3.2, roughness: 0.3 });
    return m;
  }

  /* ======================================================== THE AIRCRAFT */
  function build(opts) {
    opts = opts || {};
    var GROUND = opts.groundY === undefined ? -6.8 : opts.groundY;
    var pal = PALETTES[opts.livery || 'house'] || PALETTES.house;
    var mat = makeMaterials(pal);
    var root = new T.Group();
    root.name = 'Boeing747';

    var decals = [];         // text decal materials, need livery tint
    var anim = { ailerons: [], elevators: [], spoilers: [], rudder: null, flaps: [], slats: [] };
    var fans = [], strobes = [], beacons = [];

    function add(parent, mesh, cast, receive) {
      mesh.castShadow = cast !== false;
      mesh.receiveShadow = receive !== false;
      parent.add(mesh);
      return mesh;
    }

    /* ------------------------------------------------------- fuselage ---- */
    var rings = [], NTH = 84, NST = 176, colArr = [];
    for (var i = 0; i < NST; i++) {
      var u = i / (NST - 1);
      var t = 0.0018 + 0.9964 * (0.5 - 0.5 * Math.cos(Math.PI * u));
      var ring = [];
      for (var j = 0; j < NTH; j++) ring.push(fusPoint(t, j / NTH * Math.PI * 2));
      rings.push(ring);
    }
    var fusGeo = loft(rings, { capStart: true, capEnd: true });
    var posA = fusGeo.attributes.position;
    var cW = col(pal.fuselage), cB = col(pal.belly), cTmp = new T.Color();
    var colors = new Float32Array(posA.count * 3);
    for (var vi = 0; vi < posA.count; vi++) {
      var yy = posA.getY(vi), zz = posA.getZ(vi);
      cTmp.copy(cW).lerp(cB, smoothstep(-2.1, -3.45, yy));
      if (zz < -0.4) cTmp.lerp(cB, smoothstep(0.0, -3.0, zz) * 0.12); // soft shading under the wing
      colors[vi * 3] = cTmp.r; colors[vi * 3 + 1] = cTmp.g; colors[vi * 3 + 2] = cTmp.b;
    }
    fusGeo.setAttribute('color', new T.Float32BufferAttribute(colors, 3));
    var fuselage = add(root, new T.Mesh(fusGeo, mat.fuselage));
    fuselage.name = 'fuselage';

    /* ---- panel / frame seam lines (cheap, crisp detail) ---------------- */
    var seamMat = new T.LineBasicMaterial({ color: col(0x8d97a2), transparent: true, opacity: 0.38 });
    function fusRingLine(t) {
      var pts = [];
      for (var q = 0; q < 100; q++) {
        var th = q / 100 * Math.PI * 2;
        var pp = fusPoint(t, th);
        pp.addScaledVector(fusNormal(t, th), 0.010);
        pts.push(pp);
      }
      root.add(new T.LineLoop(new T.BufferGeometry().setFromPoints(pts), seamMat));
    }
    [0.128, 0.206, 0.286, 0.366, 0.446, 0.526, 0.606, 0.686, 0.760].forEach(fusRingLine);

    // upper-deck / main-deck crease along the forward fuselage
    (function () {
      var pts = [];
      for (var q = 0; q <= 40; q++) {
        var t = lerp(0.118, 0.512, q / 40);
        var th = 61 * D2R;
        var pp = fusPoint(t, th);
        pp.addScaledVector(fusNormal(t, th), 0.012);
        pts.push(pp);
        var pm = fusPoint(t, Math.PI * 2 - th);
        pts.push(pm.addScaledVector(fusNormal(t, Math.PI * 2 - th), 0.012));
      }
      root.add(new T.Line(new T.BufferGeometry().setFromPoints(pts), seamMat));
    })();

    /* livery: cheatline + pinstripes, both sides */
    var stripe = new T.Group();
    stripe.add(fusBand(0.085, 0.945, 96 * D2R, 110 * D2R, 0.016, mat.stripe, 40, 4));
    stripe.add(fusBand(0.085, 0.945, 2 * Math.PI - 110 * D2R, 2 * Math.PI - 96 * D2R, 0.016, mat.stripe, 40, 4));
    stripe.add(fusBand(0.085, 0.945, 111.4 * D2R, 114.2 * D2R, 0.016, mat.accent, 40, 2));
    stripe.add(fusBand(0.085, 0.945, 2 * Math.PI - 114.2 * D2R, 2 * Math.PI - 111.4 * D2R, 0.016, mat.accent, 40, 2));
    stripe.add(fusBand(0.085, 0.945, 90.6 * D2R, 92.2 * D2R, 0.016, mat.accent, 40, 2));
    stripe.add(fusBand(0.085, 0.945, 2 * Math.PI - 92.2 * D2R, 2 * Math.PI - 90.6 * D2R, 0.016, mat.accent, 40, 2));
    root.add(stripe);

    /* cockpit windshield: curved panes around the nose */
    var crash = new T.Group();
    var WS = { t0: 0.0585, t1: 0.0985, a0: 4.5 * D2R, a1: 79 * D2R };
    [-1, 1].forEach(function (side) {
      var g0 = side > 0 ? WS.a0 : (Math.PI * 2 - WS.a1);
      var g1 = side > 0 ? WS.a1 : (Math.PI * 2 - WS.a0);
      crash.add(fusBand(WS.t0, WS.t1, g0, g1, 0.026, mat.glass, 12, 14));
      [29, 51, 71].forEach(function (deg) {
        var a = deg * D2R, fw = 0.75 * D2R;
        var f0 = side > 0 ? (a - fw) : (Math.PI * 2 - a - fw);
        var f1 = side > 0 ? (a + fw) : (Math.PI * 2 - a + fw);
        crash.add(fusBand(WS.t0 - 0.0012, WS.t1 + 0.0012, f0, f1, 0.030, mat.gap, 12, 1));
      });
      // glazing sill / lower frame
      var b0 = side > 0 ? (WS.a1 - 1.2 * D2R) : (Math.PI * 2 - WS.a1 - 0.6 * D2R);
      crash.add(fusBand(WS.t0 - 0.002, WS.t1 + 0.002, b0, b0 + 1.8 * D2R, 0.030, mat.gap, 12, 1));
      // lengthwise frame splitting upper / lower glazing
      var tMid = (WS.t0 + WS.t1) * 0.5;
      var gm0 = side > 0 ? WS.a0 : (Math.PI * 2 - WS.a1);
      var gm1 = side > 0 ? WS.a1 : (Math.PI * 2 - WS.a0);
      crash.add(fusBand(tMid - 0.0012, tMid + 0.0012, gm0, gm1, 0.030, mat.gap, 1, 14));
    });
    root.add(crash);

    /* doors, windows, cargo doors */
    var doorTs = [0.150, 0.251, 0.375, 0.494, 0.607, 0.695];
    var upDoorTs = [0.212, 0.336];
    function nearDoor(t, list, span) {
      for (var d = 0; d < list.length; d++) if (Math.abs(t - list[d]) < span) return true;
      return false;
    }
    [-1, 1].forEach(function (side) {
      doorTs.forEach(function (dt) {
        var fr = plateFrame(dt, 84 * D2R, side);
        var outer = new T.Mesh(new T.PlaneGeometry(0.94, 1.98), mat.gap);
        outer.position.copy(fr.p).addScaledVector(fr.n, 0.024);
        outer.quaternion.setFromRotationMatrix(new T.Matrix4().makeBasis(fr.bx, fr.by, fr.n));
        outer.castShadow = false; root.add(outer);
        var inner = new T.Mesh(new T.PlaneGeometry(0.86, 1.9), mat.white);
        inner.position.copy(fr.p).addScaledVector(fr.n, 0.03);
        inner.quaternion.copy(outer.quaternion);
        inner.castShadow = false; root.add(inner);
        // door window
        var dw = new T.Mesh(new T.PlaneGeometry(0.2, 0.3), mat.glass);
        dw.position.copy(fr.p).addScaledVector(fr.n, 0.034).addScaledVector(fr.by, 0.62).addScaledVector(fr.bx, -0.16);
        dw.quaternion.copy(outer.quaternion);
        root.add(dw);
      });
      upDoorTs.forEach(function (dt) {
        var fr = plateFrame(dt, 50 * D2R, side);
        var outer = new T.Mesh(new T.PlaneGeometry(0.86, 1.45), mat.gap);
        outer.position.copy(fr.p).addScaledVector(fr.n, 0.024);
        outer.quaternion.setFromRotationMatrix(new T.Matrix4().makeBasis(fr.bx, fr.by, fr.n));
        root.add(outer);
        var inner = new T.Mesh(new T.PlaneGeometry(0.78, 1.37), mat.white);
        inner.position.copy(fr.p).addScaledVector(fr.n, 0.03);
        inner.quaternion.copy(outer.quaternion);
        root.add(inner);
      });
    });

    /* main deck window row (instanced) */
    var winMats = [], upWinMats = [];
    function pushWin(list, t, thSide, side, w, h) {
      var fr = plateFrame(t, thSide, side);
      var bx = fr.bx.clone().multiplyScalar(w), by = fr.by.clone().multiplyScalar(h);
      var m = new T.Matrix4().makeBasis(bx, by, fr.n);
      m.setPosition(fr.p.clone().addScaledVector(fr.n, 0.028));
      list.push(m);
    }
    for (var wt = 0.168; wt < 0.664; wt += 0.0086) {
      if (nearDoor(wt, doorTs, 0.0125)) continue;
      [-1, 1].forEach(function (side) { pushWin(winMats, wt, 84.5 * D2R, side, 0.23, 0.16); });
    }
    for (var ut = 0.205; ut < 0.405; ut += 0.0104) {
      if (nearDoor(ut, upDoorTs, 0.014)) continue;
      [-1, 1].forEach(function (side) { pushWin(upWinMats, ut, 46 * D2R, side, 0.25, 0.18); });
    }
    function makeInstanced(list, material, name) {
      if (!list.length) return null;
      var inst = new T.InstancedMesh(new T.PlaneGeometry(1, 1), material, list.length);
      for (var q = 0; q < list.length; q++) inst.setMatrixAt(q, list[q]);
      inst.instanceMatrix.needsUpdate = true;
      inst.castShadow = false; inst.receiveShadow = false;
      inst.name = name; root.add(inst);
      return inst;
    }
    makeInstanced(winMats, mat.glass, 'mainDeckWindows');
    makeInstanced(upWinMats, mat.glass, 'upperDeckWindows');

    /* cargo doors on the right hand side */
    [0.345, 0.55].forEach(function (ct) {
      var fr = plateFrame(ct, 122 * D2R, 1);
      var o = new T.Mesh(new T.PlaneGeometry(2.7, 1.75), mat.gap);
      o.position.copy(fr.p).addScaledVector(fr.n, 0.02);
      o.quaternion.setFromRotationMatrix(new T.Matrix4().makeBasis(fr.bx, fr.by, fr.n));
      root.add(o);
      var i2 = new T.Mesh(new T.PlaneGeometry(2.6, 1.65), mat.white);
      i2.position.copy(fr.p).addScaledVector(fr.n, 0.026);
      i2.quaternion.copy(o.quaternion); root.add(i2);
    });

    /* text decals */
    function makeTextTexture(text, color, italic) {
      var cv = document.createElement('canvas');
      cv.width = 1024; cv.height = 176;
      var ctx = cv.getContext('2d');
      ctx.clearRect(0, 0, cv.width, cv.height);
      ctx.fillStyle = color;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = (italic ? 'italic ' : '') + '700 126px Arial, Helvetica, sans-serif';
      ctx.fillText(text, cv.width / 2, cv.height / 2 + 6, cv.width * 0.95);
      var tex = new T.CanvasTexture(cv);
      tex.encoding = T.sRGBEncoding;
      tex.anisotropy = 8;
      return { tex: tex, aspect: cv.width / cv.height };
    }
    // Text wrapped onto the fuselage skin, so it never clips into the barrel.
    function fusTextPatch(text, widthM, color, tCenter, thSide, side, italic) {
      var tt = makeTextTexture(text, color, italic);
      var mat2 = new T.MeshStandardMaterial({
        map: tt.tex, transparent: true, depthWrite: false, roughness: 0.55, metalness: 0,
        side: T.DoubleSide, polygonOffset: true, polygonOffsetFactor: -4
      });
      var nu = 28, nv = 6;
      var hM = widthM / tt.aspect;
      var dt = widthM / F.L;
      var t0 = tCenter - dt / 2, t1 = tCenter + dt / 2;
      var th0 = sideTheta(thSide, side);
      var rings = [];
      for (var i = 0; i <= nu; i++) {
        var tx = lerp(t0, t1, i / nu);
        var rad = Math.max(1.4, F.b * fusRS(tx));
        var dth = (hM / rad) * (side > 0 ? 1 : -1);
        var ring = [];
        for (var j = 0; j <= nv; j++) {
          var thj = th0 + (j / nv - 0.5) * dth;
          var pp = fusPoint(tx, thj);
          pp.addScaledVector(fusNormal(tx, thj), 0.022);
          ring.push(pp);
        }
        rings.push(ring);
      }
      var geo2 = loft(rings, { ringClosed: false });
      var uv = geo2.attributes.uv;
      for (var i2 = 0; i2 <= nu; i2++) {
        for (var j2 = 0; j2 <= nv; j2++) {
          var uu2 = i2 / nu;
          if (side > 0) uu2 = 1 - uu2;
          uv.setXY(i2 * (nv + 1) + j2, uu2, 1 - j2 / nv);
        }
      }
      uv.needsUpdate = true;
      var mesh2 = new T.Mesh(geo2, mat2);
      mesh2.castShadow = false; mesh2.receiveShadow = false;
      root.add(mesh2);
      return mesh2;
    }
    [-1, 1].forEach(function (side) {
      fusTextPatch('BOEING 747-400', 7.4, '#0a2a45', 0.238, 70 * D2R, side, false);
      fusTextPatch('N747HH', 2.8, '#12304a', 0.702, 76 * D2R, side, false);
    });

    /* small fuselage details: antennas, pitot probes, apu */
    var antGeo = new T.ConeGeometry(0.055, 0.55, 8);
    [[0.30, 1], [0.42, 1], [0.55, 1], [0.66, 1], [0.36, -1]].forEach(function (ad) {
      var t2 = ad[0];
      var th = ad[1] > 0 ? 0 : Math.PI;
      var p = fusPoint(t2, th), n = fusNormal(t2, th);
      var a = new T.Mesh(antGeo, mat.white);
      a.position.copy(p).addScaledVector(n, 0.25);
      a.rotation.z = Math.PI * 0.5 * (ad[1] > 0 ? 1 : -1) * 0 + (ad[1] > 0 ? 0 : Math.PI);
      a.castShadow = true; root.add(a);
    });
    [-1, 1].forEach(function (side) {
      for (var pz = 0; pz < 3; pz++) {
        var pr = plateFrame(0.052, (100 + pz * 3.4) * D2R, side);
        var tube = new T.Mesh(new T.CylinderGeometry(0.026, 0.026, 0.95, 8), mat.metal);
        tube.position.copy(pr.p).addScaledVector(pr.n, 0.18);
        tube.position.x += 0.5;
        tube.rotation.z = Math.PI / 2;
        root.add(tube);
      }
    });

    /* APU exhaust cone */
    var apu = new T.Mesh(new T.CylinderGeometry(0.42, 0.5, 0.9, 20, 1, true), mat.dark);
    apu.rotation.z = Math.PI / 2;
    apu.position.set(-34.95, fusPoint(0.995, 0).y - 0.12, 0);
    root.add(apu);

    /* ---------------------------------------------------- wing surfaces --- */
    var W = {
      halfSpan: 31.0, rootLE: 6.0, rootChord: 14.6, tipChord: 3.0,
      sweep: Math.tan(37.5 * D2R), dihedral: Math.tan(6.5 * D2R),
      rootY: -2.55, incidence: 1.6 * D2R
    };
    function wingSec(s) {
      var chord = W.tipChord + (W.rootChord - W.tipChord) * Math.pow(1 - s / W.halfSpan, 0.9);
      var xLE = W.rootLE - W.sweep * s;
      var y = W.rootY + W.dihedral * s;
      var tc = lerp(0.135, 0.095, s / W.halfSpan);
      return { s: s, x: xLE, y: y, z: s, chord: chord, tc: tc, camber: 0.022, inc: W.incidence };
    }
    function sectionsFrom(list, side) {
      return list.map(function (sec) {
        var o = {};
        for (var k in sec) o[k] = sec[k];
        o.z = sec.z * side; return o;
      });
    }

    // generic lifting surface: sections have x (LE), y, z, chord, tc, camber, inc
    function liftSurface(sections, o) {
      o = o || {};
      var lateralZ = o.axis === 'z';
      var NP = o.np || 20;
      var us = [];
      var u0 = o.u0 === undefined ? 0 : o.u0, u1 = o.u1 === undefined ? 1 : o.u1;
      for (var q = 0; q < NP; q++) us.push(lerp(u0, u1, 0.5 - 0.5 * Math.cos(Math.PI * q / (NP - 1))));
      var rgs = sections.map(function (sec) {
        var anchor = o.anchor ? o.anchor(sec) : null;
        function pt(uu, sign) {
          var af = airfoil(uu, sec.tc, sec.camber === undefined ? 0.02 : sec.camber);
          var dx = -uu * sec.chord;
          var dl = (af.yc + sign * af.yt) * sec.chord;
          var inc = sec.inc || 0;
          var ci = Math.cos(inc), si = Math.sin(inc);
          var dx2 = dx * ci - dl * si;
          var dl2 = dx * si + dl * ci;
          var p = V3(sec.x + dx2, sec.y, sec.z);
          if (lateralZ) p.z += dl2; else p.y += dl2;
          if (anchor) { p.sub(anchor); }
          return p;
        }
        var ring = [], a, b;
        for (a = NP - 1; a >= 0; a--) ring.push(pt(us[a], 1));
        for (a = 1; a < NP; a++) ring.push(pt(us[a], -1));
        return ring;
      });
      var geo = loft(rgs, { reverse: o.reverse, capStart: o.capStart, capEnd: o.capEnd });
      return geo;
    }

    var wingSecs = [];
    var NS = 17;
    for (var ws = 0; ws < NS; ws++) wingSecs.push(wingSec(lerp(0.0, W.halfSpan, Math.pow(ws / (NS - 1), 1.02))));

    var wingGroups = new T.Group(); root.add(wingGroups);
    var winglets = [];

    /* wing panel seams: chordwise lines on the upper skin + slat hinge line */
    var seamMatW = new T.LineBasicMaterial({ color: col(0x8d97a2), transparent: true, opacity: 0.34 });
    function wingSeam(sec, side) {
      var pts = [], q, u, af, x, y, af2, dx, dy, nx, ny, len;
      for (q = 0; q <= 26; q++) {
        u = 0.012 + (0.735 - 0.012) * q / 26;
        af = airfoil(u, sec.tc, sec.camber);
        x = sec.x - u * sec.chord;
        y = sec.y + (af.yc + af.yt) * sec.chord;
        af2 = airfoil(Math.min(1, u + 0.004), sec.tc, sec.camber);
        dx = -0.004 * sec.chord;
        dy = ((af2.yc + af2.yt) - (af.yc + af.yt)) * sec.chord;
        nx = dy; ny = -dx; len = Math.sqrt(nx * nx + ny * ny) || 1;
        pts.push(V3(x + nx / len * 0.018, y + ny / len * 0.018, sec.z * side));
      }
      wingGroups.add(new T.Line(new T.BufferGeometry().setFromPoints(pts), seamMatW));
    }
    [4.6, 9.8, 15.4, 21.0, 26.6].forEach(function (ss) {
      wingSeam(wingSec(ss), 1);
      wingSeam(wingSec(ss), -1);
    });
    // leading-edge slat hinge line, port and starboard
    [1, -1].forEach(function (side) {
      var pts = [];
      for (var q2 = 0; q2 <= 30; q2++) {
        var sec2 = wingSec(lerp(1.8, 30.2, q2 / 30));
        var afx = airfoil(0.135, sec2.tc, sec2.camber);
        pts.push(V3(sec2.x - 0.135 * sec2.chord, sec2.y + (afx.yc + afx.yt) * sec2.chord + 0.02, sec2.z * side));
      }
      wingGroups.add(new T.Line(new T.BufferGeometry().setFromPoints(pts), seamMatW));
    });

    [-1, 1].forEach(function (side) {
      var sideSecs = sectionsFrom(wingSecs, side);
      var core = liftSurface(sideSecs, { u0: 0, u1: 1, reverse: side < 0 });
      var wm = new T.Mesh(core, mat.wing);
      wingGroups.add(wm);

      /* winglet */
      var tip = wingSecs[wingSecs.length - 1];
      var wlSecs = [];
      for (var wv = 0; wv <= 8; wv++) {
        var v = wv / 8;
        wlSecs.push({
          x: tip.x - 1.55 * v - 0.22 * v * v,
          y: tip.y + 2.0 * Math.pow(v, 1.05),
          z: tip.z + 1.0 * Math.pow(v, 1.12),
          chord: lerp(tip.chord, 1.6, v),
          tc: lerp(0.095, 0.085, v),
          camber: 0.0
        });
      }
      var wl = new T.Mesh(liftSurface(sectionsFrom(wlSecs, side), { np: 16, reverse: side < 0, capStart: true, capEnd: true }), mat.wing);
      wl.userData.noShadow = false;
      wingGroups.add(wl);
      winglets.push(wl);

      /* leading edge slats */
      [[2.0, 12.2], [13.0, 21.5], [22.3, 30.2]].forEach(function (rng) {
        var secs = [], ns2 = 7;
        for (var si = 0; si < ns2; si++) secs.push(wingSec(lerp(rng[0], rng[1], si / (ns2 - 1))));
        var g = liftSurface(sectionsFrom(secs, side), { np: 8, u0: 0.0, u1: 0.135, reverse: side < 0, capStart: true, capEnd: true });
        var panel = new T.Mesh(g, mat.surface);
        var grp = new T.Group(); grp.add(panel);
        // hinge along the leading edge
        var mid = wingSec((rng[0] + rng[1]) / 2);
        var hx = mid.x, hy = mid.y + 0.02, hz = mid.z * side;
        g.translate(-hx, -hy, -hz);
        grp.position.set(hx + 0.02 * Math.sign(1), hy, hz);
        grp.rotation.z = 0.055;
        wingGroups.add(grp);
        anim.slats.push(grp);
      });

      /* trailing edge flaps */
      [[2.6, 12.0, 0.20], [13.2, 23.6, 0.17]].forEach(function (fr) {
        var secs = [], ns3 = 7;
        for (var si2 = 0; si2 < ns3; si2++) secs.push(wingSec(lerp(fr[0], fr[1], si2 / (ns3 - 1))));
        var ssecs = sectionsFrom(secs, side);
        var g2 = liftSurface(ssecs, { np: 12, u0: 0.745, u1: 1.0, reverse: side < 0, capStart: true, capEnd: true });
        var mid2 = wingSec((fr[0] + fr[1]) / 2);
        var hx2 = mid2.x - 0.745 * mid2.chord, hy2 = mid2.y + airfoil(0.745, mid2.tc, 0.022).yc * mid2.chord;
        var hz2 = mid2.z * side;
        g2.translate(-hx2, -hy2, -hz2);
        var grp2 = new T.Group();
        grp2.add(new T.Mesh(g2, mat.surface));
        grp2.position.set(hx2, hy2, hz2);
        grp2.rotation.z = fr[2];
        wingGroups.add(grp2);
        anim.flaps.push({ grp: grp2, base: fr[2] });
      });

      /* ailerons */
      [[24.2, 30.4, 0.09]].forEach(function (ar) {
        var secs = [], ns4 = 6;
        for (var si3 = 0; si3 < ns4; si3++) secs.push(wingSec(lerp(ar[0], ar[1], si3 / (ns4 - 1))));
        var g3 = liftSurface(sectionsFrom(secs, side), { np: 10, u0: 0.745, u1: 1.0, reverse: side < 0, capStart: true, capEnd: true });
        var mid3 = wingSec((ar[0] + ar[1]) / 2);
        var hx3 = mid3.x - 0.745 * mid3.chord, hy3 = mid3.y + airfoil(0.745, mid3.tc, 0.022).yc * mid3.chord;
        var hz3 = mid3.z * side;
        g3.translate(-hx3, -hy3, -hz3);
        var grp3 = new T.Group(); grp3.add(new T.Mesh(g3, mat.surface));
        grp3.position.set(hx3 + 0.06, hy3, hz3);
        grp3.rotation.z = ar[2];
        wingGroups.add(grp3);
        anim.ailerons.push({ grp: grp3, base: ar[2], side: side });
      });

      /* spoilers: thin plates on the upper surface */
      [[3.6, 9.0], [9.6, 14.6], [15.2, 19.6], [20.2, 24.2], [24.8, 28.6]].forEach(function (sr) {
        var secs = [], ns5 = 5;
        for (var si4 = 0; si4 < ns5; si4++) secs.push(wingSec(lerp(sr[0], sr[1], si4 / (ns5 - 1))));
        var ssecs2 = sectionsFrom(secs, side);
        var top = [], bot = [];
        for (var q2 = 0; q2 <= 8; q2++) {
          var uu = lerp(0.45, 0.72, q2 / 8);
          var ringTop = [], ringBot = [];
          ssecs2.forEach(function (sec) {
            var af = airfoil(uu, sec.tc, sec.camber);
            var x = sec.x - uu * sec.chord;
            ringTop.push(V3(x, sec.y + (af.yc + af.yt) * sec.chord + 0.012, sec.z));
            ringBot.push(V3(x, sec.y + (af.yc + af.yt) * sec.chord + 0.004, sec.z));
          });
          top.push(ringTop); bot.push(ringBot);
        }
        // build as a closed thin shell: top grid travelling out, bottom grid back
        var grid = [];
        for (var q3 = 0; q3 < top.length; q3++) grid.push(top[q3]);
        var geoP = loft(top, { ringClosed: false });
        var plate = new T.Mesh(geoP, mat.panel);
        plate.castShadow = true; wingGroups.add(plate);
      });

      /* flap track fairings */
      [4.4, 8.6, 13.2, 18.4, 23.0].forEach(function (fs) {
        var sec = wingSec(fs);
        var pod = new T.Mesh(new T.SphereGeometry(1, 18, 12), mat.wing);
        pod.scale.set(1.85, 0.48, 0.42);
        pod.position.set(sec.x - 0.55, sec.y - 0.34, sec.z * side);
        pod.castShadow = true;
        wingGroups.add(pod);
      });

      /* wing tip navigation lights */
      var nav = new T.Mesh(new T.SphereGeometry(0.13, 10, 8), side > 0 ? mat.greenR : mat.redL);
      nav.position.set(tip.x - tip.chord * 0.55, tip.y + 0.04, tip.z * side);
      wingGroups.add(nav);
      strobes.push(nav);
      var st = new T.Mesh(new T.SphereGeometry(0.1, 8, 6), mat.strobe);
      st.position.set(tip.x - tip.chord * 0.85, tip.y + 0.05, tip.z * side);
      wingGroups.add(st); strobes.push(st);
    });

    /* --------------------------------------------------------- engines --- */
    var engineGroups = [];
    function latheGeo(points, segs) {
      var g = new T.LatheGeometry(points, segs || 44);
      g.computeVertexNormals();
      return g;
    }
    function buildEngine(inletX, centerY, z, spanY) {
      var grp = new T.Group();
      grp.position.set(inletX, centerY, z);
      grp.rotation.y = Math.PI;      // local +X points aft

      var prof = [
        V2(1.30, 0.015), V2(1.42, 0.05), V2(1.53, 0.16), V2(1.59, 0.36),
        V2(1.605, 0.78), V2(1.60, 1.45), V2(1.565, 2.10), V2(1.505, 2.75),
        V2(1.425, 3.35), V2(1.32, 3.85), V2(1.21, 4.30), V2(1.09, 4.70),
        V2(1.00, 4.95), V2(0.96, 5.02),
        V2(0.90, 4.95), V2(0.98, 4.70), V2(1.08, 4.30), V2(1.17, 3.85),
        V2(1.24, 3.35), V2(1.285, 2.75), V2(1.31, 2.10), V2(1.32, 1.45),
        V2(1.32, 0.9), V2(1.30, 0.5), V2(1.235, 0.25), V2(1.15, 0.105),
        V2(1.20, 0.03)
      ];
      var cowl = new T.Mesh(latheGeo(prof, 44), mat.cowl);
      cowl.rotation.z = -Math.PI / 2;   // local +Y -> +X (aft)
      cowl.castShadow = true; cowl.receiveShadow = true;
      grp.add(cowl);

      // polished inlet lip ring
      var lip = new T.Mesh(new T.TorusGeometry(1.352, 0.062, 10, 44), mat.metal);
      lip.rotation.y = Math.PI / 2;
      lip.position.x = 0.035;
      grp.add(lip);
      // light grey inlet duct so the throat is not livery coloured
      var ductMat = new T.MeshStandardMaterial({ color: col(0xc4cad2), roughness: 0.55, metalness: 0.35, side: T.BackSide });
      var duct = new T.Mesh(new T.CylinderGeometry(1.30, 1.27, 1.55, 40, 1, true), ductMat);
      duct.rotation.z = -Math.PI / 2;
      duct.position.x = 0.82;
      grp.add(duct);

      // fan disk + blades + spinner (rotating assembly)
      var fan = new T.Group();
      fan.position.x = 1.42;
      var disk = new T.Mesh(new T.CircleGeometry(1.19, 40), mat.dark);
      disk.rotation.y = -Math.PI / 2;
      disk.position.x = 0.32;
      fan.add(disk);
      var bladeGeo = (function () {
        var g = new T.PlaneGeometry(0.5, 0.72, 5, 4);
        var pp = g.attributes.position;
        for (var q = 0; q < pp.count; q++) {
          var x = pp.getX(q), y = pp.getY(q);
          var taper = 1 - 0.42 * ((y + 0.36) / 0.72);
          x *= taper;
          var twist = (y + 0.36) * 1.15;
          pp.setXYZ(q, x * Math.cos(twist), y + 0.85, x * Math.sin(twist));
        }
        g.computeVertexNormals();
        return g;
      })();
      var bladeMat = new T.MeshStandardMaterial({ color: col(0x2b3138), roughness: 0.36, metalness: 0.9, side: T.DoubleSide });
      var blades = new T.InstancedMesh(bladeGeo, bladeMat, 22);
      var bm = new T.Matrix4(), bq = new T.Quaternion(), bAxis = V3(1, 0, 0), bs = V3(1, 1, 1);
      for (var bi = 0; bi < 22; bi++) {
        bq.setFromAxisAngle(bAxis, bi / 22 * Math.PI * 2);
        bm.compose(V3(0, 0, 0), bq, bs);
        blades.setMatrixAt(bi, bm);
      }
      blades.instanceMatrix.needsUpdate = true;
      fan.add(blades);
      var spinnerProf = [];
      for (var spi = 0; spi <= 12; spi++) {
        var sv = spi / 12;
        spinnerProf.push(V2(0.5 * Math.pow(sv, 0.72), 1.05 * sv));
      }
      var spinner = new T.Mesh(latheGeo(spinnerProf, 28), mat.metal);
      spinner.rotation.z = -Math.PI / 2;
      spinner.position.x = 0.34;
      fan.add(spinner);
      grp.add(fan);
      fans.push(fan);

      // core cowl, exhaust nozzle and plug
      var coreMat = new T.MeshStandardMaterial({ color: col(0x6d747c), roughness: 0.45, metalness: 0.75 });
      var core = new T.Mesh(new T.CylinderGeometry(0.82, 1.06, 1.65, 36, 1), coreMat);
      core.rotation.z = -Math.PI / 2;
      core.position.x = 3.7;
      grp.add(core);
      var nozzle = new T.Mesh(new T.CylinderGeometry(0.88, 0.74, 0.9, 30, 1, true), coreMat);
      nozzle.rotation.z = -Math.PI / 2;
      nozzle.position.x = 4.92;
      grp.add(nozzle);
      var plug = new T.Mesh(new T.ConeGeometry(0.80, 1.25, 30), new T.MeshStandardMaterial({ color: col(0x4a4f56), roughness: 0.35, metalness: 0.9 }));
      plug.rotation.z = -Math.PI / 2;
      plug.position.x = 5.55;
      grp.add(plug);
      var exhaustRing = new T.Mesh(new T.TorusGeometry(0.98, 0.05, 8, 40), mat.metal);
      exhaustRing.rotation.y = Math.PI / 2; exhaustRing.position.x = 4.98;
      grp.add(exhaustRing);
      // panel seams + thrust reverser band
      [1.05, 2.5, 3.6].forEach(function (ax, ai) {
        var rr = [1.60, 1.55, 1.44][ai];
        var seam = new T.Mesh(new T.TorusGeometry(rr, 0.014, 4, 44), mat.dark);
        seam.rotation.y = Math.PI / 2; seam.position.x = ax;
        grp.add(seam);
      });
      var rev = new T.Mesh(new T.CylinderGeometry(1.575, 1.5, 0.55, 40, 1, true), mat.dark);
      rev.rotation.z = -Math.PI / 2; rev.position.x = 2.1;
      grp.add(rev);

      /* pylon */
      var toWing = spanY - centerY;
      var shape = new T.Shape();
      shape.moveTo(0.2, 0.45);
      shape.lineTo(1.35, toWing - 0.15);
      shape.lineTo(2.1, toWing + 0.05);
      shape.lineTo(6.7, toWing);
      shape.lineTo(6.25, toWing - 0.55);
      shape.lineTo(5.35, 1.35);
      shape.lineTo(2.5, 1.3);
      shape.lineTo(1.35, 0.9);
      shape.closePath();
      var pylonGeo = new T.ExtrudeGeometry(shape, { depth: 0.26, bevelEnabled: true, bevelSize: 0.035, bevelThickness: 0.035, bevelSegments: 2, steps: 1 });
      pylonGeo.translate(0, 0, -0.13);
      var pylon = new T.Mesh(pylonGeo, mat.wing);
      pylon.castShadow = true;
      grp.add(pylon);

      engineGroups.push(grp);
      root.add(grp);
      return grp;
    }
    [[11.4, 2.55], [20.4, 2.45]].forEach(function (ep) {
      var s = ep[0];
      var sec = wingSec(s);
      var inletX = sec.x + 2.25;
      var y = sec.y - ep[1];
      var z = s;
      [-1, 1].forEach(function (side) {
        buildEngine(inletX, y, z * side, sec.y - 0.42);
      });
    });

    /* ------------------------------------------------------ empennage ---- */
    // vertical fin
    var finSecs = [], FH = 10.6, finBaseY = 2.0, finRootLE = -19.4, finRootChord = 12.2, finTipChord = 2.6;
    for (var fi = 0; fi <= 7; fi++) {
      var fv = fi / 7;
      finSecs.push({
        x: finRootLE - Math.tan(44 * D2R) * (FH * fv),
        y: finBaseY + FH * fv,
        z: 0,
        chord: finRootChord - (finRootChord - finTipChord) * Math.pow(fv, 0.92),
        tc: lerp(0.10, 0.085, fv),
        camber: 0,
        inc: 0
      });
    }
    var fin = new T.Mesh(liftSurface(finSecs, { axis: 'z', np: 20, u0: 0, u1: 0.756, reverse: true, capStart: true, capEnd: true }), mat.tail);
    fin.castShadow = true;
    root.add(fin);
    // tail number on both sides of the fin
    [-1, 1].forEach(function (side) {
      var hf = 0.47;
      var yy = finBaseY + FH * hf;
      var xle = finRootLE - Math.tan(44 * D2R) * (FH * hf);
      var ch = finRootChord - (finRootChord - finTipChord) * Math.pow(hf, 0.92);
      var halfT = airfoil(0.5, 0.09, 0).yt * ch;
      var tt = makeTextTexture('747', '#ffffff', true);
      var mm = new T.MeshStandardMaterial({ map: tt.tex, transparent: true, depthWrite: false, roughness: 0.55, metalness: 0, side: T.DoubleSide, polygonOffset: true, polygonOffsetFactor: -4 });
      var dmesh = new T.Mesh(new T.PlaneGeometry(3.4, 3.4 / tt.aspect), mm);
      var bx = side > 0 ? V3(1, 0, 0) : V3(-1, 0, 0);
      dmesh.quaternion.setFromRotationMatrix(new T.Matrix4().makeBasis(bx, V3(0, 1, 0), V3(0, 0, side)));
      dmesh.position.set(xle - ch * 0.52, yy, side * (halfT + 0.05));
      dmesh.castShadow = false; root.add(dmesh);
    });

    // fin tip fairing / antenna
    var finTip = new T.Mesh(new T.CylinderGeometry(0.09, 0.07, 0.85, 8), mat.white);
    finTip.position.set(finRootLE - Math.tan(44 * D2R) * FH - 1.0, finBaseY + FH + 0.15, 0);
    root.add(finTip);

    // dorsal fin fillet
    var filRings = [];
    for (var dfi = 0; dfi <= 18; dfi++) {
      var dfv = dfi / 18;
      var fx = lerp(-8.6, -23.4, dfv);
      var ft = (F.halfL - fx) / F.L;
      var fTop = fusPoint(ft, 0).y;
      var finLEatX = finBaseY + Math.max(0, (finRootLE - fx)) / Math.tan(44 * D2R);
      var topY = Math.max(fTop + 0.12, finLEatX);
      var extra = topY - fTop;
      var w2 = 0.78 * smoothstep(-9.5, -19.5, fx) + 0.08;
      var hh = extra * 0.55 + 0.18;
      var cy = fTop + extra - hh;
      var fring = [];
      for (var fj = 0; fj < 20; fj++) {
        var fa = fj / 20 * Math.PI * 2;
        fring.push(V3(fx, cy + hh * Math.cos(fa), w2 * Math.sin(fa)));
      }
      filRings.push(fring);
    }
    var fillet = new T.Mesh(loft(filRings, { capStart: true, capEnd: true }), mat.fillet);
    fillet.castShadow = true;
    root.add(fillet);

    // rudder
    (function () {
      var secs = [], nr = 6;
      for (var q = 0; q < nr; q++) {
        var v = q / (nr - 1);
        secs.push({
          x: finRootLE - Math.tan(44 * D2R) * (FH * lerp(1.2, 8.4, v) / FH) * 0,
          y: 0, z: 0, chord: 1, tc: 0.1, camber: 0, inc: 0
        });
      }
      // build the rudder directly from the fin sections
      var rsecs = [];
      for (var q2 = 0; q2 < 6; q2++) {
        var h = lerp(1.4, 8.3, q2 / 5);
        var sec = {
          x: finRootLE - Math.tan(44 * D2R) * h,
          y: finBaseY + h, z: 0,
          chord: finRootChord - (finRootChord - finTipChord) * Math.pow(h / FH, 0.92),
          tc: lerp(0.10, 0.085, h / FH), camber: 0, inc: 0
        };
        rsecs.push(sec);
      }
      var g = liftSurface(rsecs, { axis: 'z', np: 10, u0: 0.76, u1: 1.0, reverse: true, capStart: true, capEnd: true });
      var grp = new T.Group();
      var mid = rsecs[2];
      var hx = mid.x - 0.76 * mid.chord, hy = mid.y;
      g.translate(-hx, -hy, 0);
      grp.add(new T.Mesh(g, mat.tail));
      grp.position.set(hx, hy, 0);
      root.add(grp);
      anim.rudder = grp;
    })();

    // horizontal stabiliser + elevators
    [-1, 1].forEach(function (side) {
      var hsecs = [], HS = 10.6;
      for (var hi = 0; hi <= 6; hi++) {
        var hv = hi / 6, s = lerp(0.8, HS, hv);
        hsecs.push({
          x: -25.4 - Math.tan(38 * D2R) * s,
          y: 1.55 + Math.tan(7 * D2R) * s,
          z: s,
          chord: lerp(6.4, 2.0, Math.pow(hv, 0.92)),
          tc: lerp(0.12, 0.10, hv), camber: 0.01, inc: 0
        });
      }
      var hss = sectionsFrom(hsecs, side);
      var hstab = new T.Mesh(liftSurface(hss, { np: 14, u0: 0, u1: 0.755, reverse: side < 0, capStart: true, capEnd: true }), mat.wing);
      root.add(hstab);
      var g = liftSurface(hss, { np: 10, u0: 0.75, u1: 1.0, reverse: side < 0, capStart: true, capEnd: true });
      var midH = hsecs[3];
      var hx = midH.x - 0.75 * midH.chord, hy = midH.y + airfoil(0.75, midH.tc, 0.01).yc * midH.chord;
      var hz = midH.z * side;
      g.translate(-hx, -hy, -hz);
      var grp = new T.Group();
      grp.add(new T.Mesh(g, mat.surface));
      grp.position.set(hx, hy, hz);
      root.add(grp);
      anim.elevators.push({ grp: grp, base: 0, side: side });
    });

    /* --------------------------------------------------- landing gear ---- */
    var gearGroup = new T.Group(); root.add(gearGroup);
    var wheelR = 0.68, noseR = 0.60;
    var hubY = GROUND + wheelR;
    var noseHubY = GROUND + noseR;
    function tube(a, b, r, material) {
      var dir = b.clone().sub(a), len = dir.length();
      var mesh = new T.Mesh(new T.CylinderGeometry(r, r, len, 12), material);
      mesh.position.copy(a).add(b).multiplyScalar(0.5);
      mesh.quaternion.setFromUnitVectors(V3(0, 1, 0), dir.normalize());
      mesh.castShadow = true;
      return mesh;
    }
    function wheel(r, w) {
      var g = new T.Group();
      var tire = new T.Mesh(new T.CylinderGeometry(r, r, w, 22, 1), mat.tire);
      tire.rotation.x = Math.PI / 2;
      g.add(tire);
      var hub = new T.Mesh(new T.CylinderGeometry(r * 0.56, r * 0.56, w + 0.03, 16), mat.hub);
      hub.rotation.x = Math.PI / 2;
      g.add(hub);
      var cap = new T.Mesh(new T.CylinderGeometry(r * 0.2, r * 0.2, w + 0.06, 10), mat.dark);
      cap.rotation.x = Math.PI / 2;
      g.add(cap);
      g.traverse(function (o) { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
      return g;
    }
    function addBogie(x, z, wheelZ) {
      var g = new T.Group();
      var beam = new T.Mesh(new T.BoxGeometry(1.72, 0.24, 0.34), mat.dark);
      g.add(beam);
      var plate = new T.Mesh(new T.BoxGeometry(1.2, 0.34, 0.2), mat.metal);
      g.add(plate);
      [-0.62, 0.62].forEach(function (ax) {
        var axle = new T.Mesh(new T.CylinderGeometry(0.085, 0.085, wheelZ * 2 + 0.55, 12), mat.metal);
        axle.rotation.x = Math.PI / 2;
        axle.position.set(ax, 0, 0);
        g.add(axle);
        [-1, 1].forEach(function (wz) {
          var wh = wheel(wheelR, 0.42);
          wh.position.set(ax, 0, wz * (wheelZ + 0.22));
          g.add(wh);
        });
      });
      g.position.set(x, hubY, z);
      gearGroup.add(g);
      return g;
    }
    // nose gear
    (function () {
      var ng = new T.Group();
      var top = V3(24.9, -3.05, 0);
      var hub = V3(24.9, noseHubY, 0);
      ng.add(tube(top, hub, 0.17, mat.hub));
      ng.add(tube(top, hub.clone().add(V3(0, 1.5, 0)), 0.23, mat.metal));
      // drag brace + torque link
      ng.add(tube(V3(23.2, -3.05, 0), V3(24.9, noseHubY + 1.2, 0), 0.09, mat.metal));
      ng.add(tube(V3(24.55, noseHubY + 1.65, 0.15), V3(24.9, noseHubY + 0.4, 0.15), 0.065, mat.metal));
      ng.add(tube(V3(24.55, noseHubY + 1.65, -0.15), V3(24.9, noseHubY + 0.4, -0.15), 0.065, mat.metal));
      [-1, 1].forEach(function (sz) {
        var wh = wheel(noseR, 0.34);
        wh.position.set(24.9, noseHubY, sz * 0.45);
        ng.add(wh);
      });
      var axleN = new T.Mesh(new T.CylinderGeometry(0.085, 0.085, 1.2, 12), mat.metal);
      axleN.rotation.x = Math.PI / 2; axleN.position.set(24.9, noseHubY, 0);
      ng.add(axleN);
      gearGroup.add(ng);
    })();
    // four main gear legs: 2 wing, 2 body  (16 main wheels)
    [[-2.1, 9.1, 0.40], [-2.1, -9.1, 0.40], [-6.9, 2.6, 0.36], [-6.9, -2.6, 0.36]].forEach(function (lg) {
      var lx = lg[0], lz = lg[1], wz = lg[2];
      var leg = new T.Group();
      var topY = lz > 5 ? -1.95 : -3.95;
      var top = V3(lx, topY, lz), hub = V3(lx, hubY, lz);
      leg.add(tube(top, hub, 0.20, mat.hub));
      leg.add(tube(V3(lx, topY + 0.1, lz), V3(lx, hubY + 2.1, lz), 0.25, mat.metal));
      leg.add(tube(V3(lx - 1.35, topY, lz), V3(lx, hubY + 1.05, lz), 0.10, mat.metal));
      leg.add(tube(V3(lx + 1.1, topY, lz), V3(lx, hubY + 1.05, lz), 0.09, mat.metal));
      leg.add(tube(V3(lx, hubY + 2.3, lz + 0.2), V3(lx, hubY + 0.9, lz + 0.2), 0.07, mat.metal));
      addBogie(lx, lz, wz);
      gearGroup.add(leg);
    });
    /* ---------------------------------------------------------- lights --- */
    function beacon(t, up) {
      var th = up ? 0 : Math.PI;
      var p = fusPoint(t, th), n = fusNormal(t, th);
      var b = new T.Mesh(new T.SphereGeometry(0.11, 10, 8), mat.redL);
      b.position.copy(p).addScaledVector(n, 0.1);
      root.add(b); beacons.push(b);
      return b;
    }
    beacon(0.50, true); beacon(0.50, false); beacon(0.255, true);
    // landing lights in the wing root leading edge
    [-1, 1].forEach(function (side) {
      var sec = wingSec(3.2);
      var l = new T.Mesh(new T.BoxGeometry(0.32, 0.22, 0.9), mat.landLight);
      l.position.set(sec.x - 0.15, sec.y + 0.1, sec.z * side);
      wingGroups.add(l);
    });

    /* ------------------------------------------------------- shadows etc */
    root.traverse(function (o) {
      if (o.isMesh) {
        if (o.userData.noShadow) { o.castShadow = false; o.receiveShadow = false; }
        else { o.castShadow = true; o.receiveShadow = true; }
      }
    });

    /* ----------------------------------------------------------- update -- */
    var fanSpeed = 0, demoAmt = 0, spin = 0;
    var tmpQ = new T.Quaternion();
    function update(dt, time, state) {
      state = state || {};
      var target = state.engines ? 17 : 0;
      fanSpeed += (target - fanSpeed) * Math.min(1, dt * 1.8);
      spin += fanSpeed * dt;
      for (var f = 0; f < fans.length; f++) fans[f].rotation.x = spin;

      var dTarget = state.demo ? 1 : 0;
      demoAmt += (dTarget - demoAmt) * Math.min(1, dt * 2.6);
      if (state.demo) {
        var a1 = demoAmt * Math.sin(time * 0.8) * 0.30;
        var e1 = demoAmt * Math.sin(time * 0.8 + 1.1) * 0.24;
        var r1 = demoAmt * Math.sin(time * 0.62) * 0.32;
        for (var ai = 0; ai < anim.ailerons.length; ai++) {
          var A = anim.ailerons[ai];
          A.grp.rotation.z = A.base + (A.side > 0 ? a1 : -a1);
        }
        for (var ei = 0; ei < anim.elevators.length; ei++) {
          anim.elevators[ei].grp.rotation.z = e1;
        }
        if (anim.rudder) anim.rudder.rotation.y = r1;
        for (var fi2 = 0; fi2 < anim.flaps.length; fi2++) {
          var FL = anim.flaps[fi2];
          FL.grp.rotation.z = FL.base + demoAmt * 0.22;
        }
      } else {
        for (var ai2 = 0; ai2 < anim.ailerons.length; ai2++) {
          var A2 = anim.ailerons[ai2];
          A2.grp.rotation.z += (A2.base - A2.grp.rotation.z) * Math.min(1, dt * 4);
        }
        for (var ei2 = 0; ei2 < anim.elevators.length; ei2++) {
          var E2 = anim.elevators[ei2];
          E2.grp.rotation.z += (0 - E2.grp.rotation.z) * Math.min(1, dt * 4);
        }
        if (anim.rudder) anim.rudder.rotation.y += (0 - anim.rudder.rotation.y) * Math.min(1, dt * 4);
        for (var fi3 = 0; fi3 < anim.flaps.length; fi3++) {
          var FL2 = anim.flaps[fi3];
          FL2.grp.rotation.z += (FL2.base - FL2.grp.rotation.z) * Math.min(1, dt * 4);
        }
      }
      // strobes
      var flash = (time % 1.35) < 0.055;
      for (var si = 0; si < strobes.length; si++) strobes[si].visible = flash;
      // beacon pulse
      var pulse = 0.7 + 0.55 * Math.sin(time * 3.6);
      mat.redL.emissiveIntensity = 1.6 + pulse;
    }

    function setLivery(key) {
      var p = PALETTES[key]; if (!p) return;
      mat.stripe.color.copy(col(p.stripe));
      mat.accent.color.copy(col(p.accent));
      mat.tail.color.copy(col(p.tail));
      mat.cowl.color.copy(col(p.cowl));
      mat.wing.color.copy(col(p.wing));
      mat.surface.color.copy(col(p.wing));
      mat.fuselage.color.copy(col(p.fuselage));
      mat.gearDoor.color.copy(col(p.gear));
      var pos = fusGeo.attributes.position, colors2 = fusGeo.attributes.color;
      var cw = col(p.fuselage), cb = col(p.belly);
      for (var q = 0; q < pos.count; q++) {
        cTmp.copy(cw).lerp(cb, smoothstep(-2.1, -3.45, pos.getY(q)));
        colors2.setXYZ(q, cTmp.r, cTmp.g, cTmp.b);
      }
      colors2.needsUpdate = true;
    }

    function setGear(on) { gearGroup.visible = on; }

    return {
      root: root,
      update: update,
      setLivery: setLivery,
      setGear: setGear,
      GROUND: GROUND,
      palettes: PALETTES
    };
  }

  return { build: build, palettes: PALETTES };
})();
