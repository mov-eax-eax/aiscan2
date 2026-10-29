/* ============================================================================
   bowlab / parts.js — the furniture of the bow: riser, grip, limb pockets,
   arrow rest, sight/scope, stabilizer, cable guard, arrow.
   All dimensions in INCHES, converted to metres by the scene scale.
   ========================================================================== */
(function (root) {
  'use strict';
  var BB = root.BowBuilders, P = {};
  var V = BB.v;

  // ------------------------------------------------------------- materials --
  function mat(o) { return new THREE.MeshStandardMaterial(o); }
  P.mats = {
    riser: mat({ color: 0x69737d, metalness: 0.88, roughness: 0.31 }),
    riserDark: mat({ color: 0x3b434c, metalness: 0.9, roughness: 0.40 }),
    cam: mat({ color: 0x9aa4b0, metalness: 0.92, roughness: 0.24 }),
    camDark: mat({ color: 0x2c3238, metalness: 0.9, roughness: 0.35 }),
    limb: mat({ color: 0x1d2126, metalness: 0.45, roughness: 0.38 }),
    limbEdge: mat({ color: 0x2a2f35, metalness: 0.5, roughness: 0.3 }),
    wood: mat({ color: 0x3a2a20, metalness: 0.05, roughness: 0.75 }),
    rubber: mat({ color: 0x121417, metalness: 0.05, roughness: 0.95 }),
    steel: mat({ color: 0xd2dae2, metalness: 0.95, roughness: 0.18 }),
    black: mat({ color: 0x0d0f11, metalness: 0.3, roughness: 0.6 }),
    string: mat({ color: 0xcfe0a8, metalness: 0.0, roughness: 0.85 }),
    cable: mat({ color: 0x9fb37a, metalness: 0.0, roughness: 0.85 }),
    serving: mat({ color: 0x2f3a22, metalness: 0.0, roughness: 0.9 }),
    shaft: mat({ color: 0x1e2126, metalness: 0.55, roughness: 0.35 }),
    fletch: mat({ color: 0xff6a12, metalness: 0.0, roughness: 0.7, side: THREE.DoubleSide }),
    fletch2: mat({ color: 0xe8e8ea, metalness: 0.0, roughness: 0.7, side: THREE.DoubleSide }),
    accent: mat({ color: 0xff7a1a, metalness: 0.3, roughness: 0.4 }),
    glass: mat({ color: 0x101418, metalness: 0.2, roughness: 0.05 })
  };

  function mesh(geo, material, x, y, z) {
    var m = new THREE.Mesh(geo, material);
    if (x || y || z) m.position.set(x || 0, y || 0, z || 0);
    m.castShadow = true; m.receiveShadow = true;
    return m;
  }
  P.mesh = mesh;

  // ----------------------------------------------------------------- riser --
  /* L: layout in inches
       yTop, yBot  - ends of the riser body
       x           - half thickness
       zBack       - the +z (archer side) face
       zFront      - the -z (target side) face
       winY0,winY1 - sight window vertical extent
       winZ        - window back wall (material remains in front of it)
  */
  P.buildRiser = function (L) {
    var g = new THREE.Group();
    var x = L.x, zb = L.zBack, zf = L.zFront;
    var rrect = function (w, h, r, n) { return BB.roundedRectProfile(w, h, r || 0.18, n || 4); };
    function slab(y0, y1, z0, z1, thick, mtl, bev) {
      var h = y1 - y0, d = z1 - z0;
      if (h <= 0.001 || d <= 0.001) return null;
      var pts = rrect(d, h, Math.min(0.16, h * 0.3, d * 0.3), 4);
      pts.forEach(function (p) { p.z += (z0 + z1) / 2; p.y += (y0 + y1) / 2; });
      var m = mesh(BB.prism(pts, -thick, thick, { bevel: bev === undefined ? 0.05 : bev }), mtl || P.mats.riser);
      return m;
    }
    /* a machined "bridge": a rectangular frame with a window cut through it */
    function frame(y0, y1, z0, z1, hy0, hy1, hz0, hz1, thick, mtl) {
      var gg = new THREE.Group();
      var m;
      m = slab(hy1, y1, z0, z1, thick, mtl); if (m) gg.add(m);         // top bar
      m = slab(y0, hy0, z0, z1, thick, mtl); if (m) gg.add(m);         // bottom bar
      m = slab(hy0, hy1, hz1, z1, thick, mtl); if (m) gg.add(m);       // back bar (archer side)
      m = slab(hy0, hy1, z0, hz0, thick, mtl); if (m) gg.add(m);       // front bar
      // machined bevel lip around the window (catches the light, reads as a cutout)
      var lip = rrect(hz1 - hz0 + 0.24, hy1 - hy0 + 0.24, 0.14, 4);
      lip.forEach(function (p) { p.z += (hz0 + hz1) / 2; p.y += (hy0 + hy1) / 2; });
      gg.add(mesh(BB.prism(lip, thick - 0.05, thick + 0.02, { bevel: 0.04 }), P.mats.riserDark));
      gg.add(mesh(BB.prism(lip.map(function (p) { return { y: p.y, z: p.z }; }), -thick - 0.02, -thick + 0.05, { bevel: 0.04 }), P.mats.riserDark));
      return gg;
    }
    // ---- upper section: bridge with a window through it -------------------
    g.add(frame(L.winY1, L.yTop - 0.55, zf, zb, L.winY1 + 0.9, L.yTop - 1.5, zf + 0.42, zb - 0.5, x));
    // top cap that the pocket bolts through
    g.add(slab(L.yTop - 0.75, L.yTop, zf - 0.05, zb + 0.05, x + 0.02, P.mats.riser, 0.07));
    // ---- sight window: only the front bar remains (arrow passes here) -----
    g.add(slab(L.winY0, L.winY1, zf, L.winZ, x * 0.95, P.mats.riser));
    // the shelf under the window (where the rest bolts on)
    g.add(slab(L.winY0 - 0.55, L.winY0 + 0.1, zf, zb - 0.1, x, P.mats.riser));
    // ---- grip section ----------------------------------------------------
    g.add(slab(L.gripY0, L.winY0 - 0.4, zf, zb - 0.25, x, P.mats.riser));
    // ---- lower section: another bridge window ----------------------------
    g.add(frame(L.yBot + 0.5, L.gripY0, zf, zb, L.yBot + 1.5, L.gripY0 - 0.85, zf + 0.42, zb - 0.55, x));
    g.add(slab(L.yBot, L.yBot + 0.75, zf - 0.05, zb + 0.05, x + 0.02, P.mats.riser, 0.07));
    // ---- reflexed spine along the front (the riser's "backbone") ---------
    var spine = [];
    var pts = [[L.yBot + 0.6, zf + 0.02], [L.gripY0 - 0.4, zf - 0.16], [L.winY0 - 0.6, zf - 0.1],
               [L.winY0 + 0.6, zf + 0.05], [L.winY1 + 0.4, zf + 0.02], [L.yTop - 0.9, zf + 0.1]];
    pts.forEach(function (p) { spine.push({ y: p[0], z: p[1] }); });
    spine.push({ y: L.yTop - 0.9, z: zf + 0.52 });
    for (var i = pts.length - 2; i >= 0; i--) spine.push({ y: pts[i][0], z: pts[i][1] + 0.46 });
    g.add(mesh(BB.prism(spine, -x - 0.03, x + 0.03, { bevel: 0.06 }), P.mats.riserDark));

    // ---- grip (moulded, stands proud of the front) -----------------------
    var gy0 = L.gripY0 + 0.2, gy1 = L.winY0 - 0.6;
    var gp = rrect(1.05, gy1 - gy0, 0.42, 5);
    gp.forEach(function (p) { p.z += zf + 0.46; p.y += (gy0 + gy1) / 2; });
    g.add(mesh(BB.prism(gp, -x - 0.09, x + 0.09, { bevel: 0.16 }), P.mats.wood));
    var sp = rrect(0.8, 0.72, 0.3, 4);
    sp.forEach(function (p) { p.z += zf + 0.2; p.y += gy1 - 0.15; });
    g.add(mesh(BB.prism(sp, -x - 0.05, x + 0.05, { bevel: 0.13 }), P.mats.wood));
    // grip side plates
    [-1, 1].forEach(function (s) {
      var pl = rrect(0.5, (gy1 - gy0) * 0.8, 0.2, 4);
      pl.forEach(function (p) { p.z += zf + 0.5; p.y += (gy0 + gy1) / 2; });
      g.add(mesh(BB.prism(pl, s * (x + 0.09), s * (x + 0.15), { bevel: 0.05 }), P.mats.black));
    });
    // ---- stabiliser bushing + front bar ----------------------------------
    var bush = new THREE.CylinderGeometry(0.30, 0.30, 0.46, 18);
    bush.rotateX(Math.PI / 2);
    g.add(mesh(bush, P.mats.steel, 0, L.stabY, zf - 0.05));
    // ---- sight mount plate (+x face) -------------------------------------
    var mp = rrect(1.6, 1.2, 0.25, 4);
    mp.forEach(function (p) { p.z += (zb + zf) / 2 + 0.45; p.y += L.sightY; });
    g.add(mesh(BB.prism(mp, x - 0.01, x + 0.24, { bevel: 0.06 }), P.mats.riserDark));
    var mp2 = rrect(1.6, 1.2, 0.25, 4);
    mp2.forEach(function (p) { p.z += (zb + zf) / 2 + 0.45; p.y += L.sightY; });
    g.add(mesh(BB.prism(mp2, -x - 0.24, -x + 0.01, { bevel: 0.06 }), P.mats.riserDark));
    // ---- rest mount plate ------------------------------------------------
    var rp = rrect(1.3, 1.5, 0.24, 4);
    rp.forEach(function (p) { p.z += -0.15; p.y += -0.45; });
    g.add(mesh(BB.prism(rp, x - 0.01, x + 0.2, { bevel: 0.06 }), P.mats.riserDark));
    return g;
  };

  // --------------------------------------------------------- limb pockets ---
  /* pocket with a fork that receives the limb root, plus the limb bolt */
  P.buildPocket = function (L, side) {
    var g = new THREE.Group();
    var py = side * L.pocketY, pz = L.pocketZ;
    var body = BB.roundedRectProfile(1.7, 1.55, 0.28, 4);
    body.forEach(function (p) { p.z += pz + 0.25; p.y += py + side * 0.55; });
    g.add(mesh(BB.prism(body, -L.x - 0.06, L.x + 0.06, { bevel: 0.07 }), P.mats.riserDark));
    // fork cheeks that straddle the limb blades
    [-1, 1].forEach(function (s) {
      var fork = BB.roundedRectProfile(1.5, 1.15, 0.24, 4);
      fork.forEach(function (p) { p.z += pz + 0.5; p.y += py - side * 0.25; });
      g.add(mesh(BB.prism(fork, s * (L.bladeX - 0.16), s * (L.bladeX + 0.16), { bevel: 0.06 }), P.mats.riserDark));
    });
    // limb bolt head (both sides)
    [-1, 1].forEach(function (s) {
      var b = new THREE.CylinderGeometry(0.28, 0.28, 0.14, 16);
      b.rotateZ(Math.PI / 2);
      g.add(mesh(b, P.mats.steel, s * (L.bladeX + 0.24), py - side * 0.25, pz + 0.5));
      var hex = new THREE.CylinderGeometry(0.11, 0.11, 0.18, 6);
      hex.rotateZ(Math.PI / 2);
      g.add(mesh(hex, P.mats.black, s * (L.bladeX + 0.26), py - side * 0.25, pz + 0.5));
    });
    return g;
  };

  // ------------------------------------------------------- arrow rest ------
  P.buildRest = function (L) {
    var g = new THREE.Group();
    var x = L.x;
    var body = BB.roundedRectProfile(0.95, 1.0, 0.2, 4);
    body.forEach(function (p) { p.z += -0.05; p.y += -0.35; });
    g.add(mesh(BB.prism(body, x + 0.02, x + 0.55, { bevel: 0.06 }), P.mats.black));
    // launcher arm reaching under the arrow
    var arm = [{ y: -0.35, z: -0.5 }, { y: -0.22, z: 0.1 }, { y: -0.22, z: 0.75 }, { y: -0.4, z: 0.8 }];
    g.add(mesh(BB.prism(arm, x + 0.04, x + 0.30, { bevel: 0.04 }), P.mats.black));
    var prong = BB.roundedRectProfile(0.42, 0.16, 0.06, 3);
    prong.forEach(function (p) { p.z += -0.42; p.y += -0.16; });
    g.add(mesh(BB.prism(prong, -0.10, 0.10, { bevel: 0.03 }), P.mats.rubber));
    // activation cord up to the buss cable
    var cord = BB.rodGeo(V(x + 0.35, -0.6, 0.1), V(0.55, 2.0, 3.4), 0.045, 6);
    g.add(mesh(cord, P.mats.black));
    return g;
  };

  // -------------------------------------------------------- sight + scope ---
  P.buildSight = function (L) {
    var g = new THREE.Group();
    var x = L.x, y = L.sightY;
    // dovetail bar
    var bar = BB.roundedRectProfile(0.55, 0.5, 0.12, 3);
    bar.forEach(function (p) { p.z += 0.35; p.y += y; });
    g.add(mesh(BB.prism(bar, x + 0.2, x + 3.1, { bevel: 0.05 }), P.mats.riserDark));
    // vertical adjustment block
    var blk = BB.roundedRectProfile(0.7, 1.9, 0.2, 4);
    blk.forEach(function (p) { p.z += 0.15; p.y += y; });
    g.add(mesh(BB.prism(blk, x + 2.9, x + 3.9, { bevel: 0.07 }), P.mats.black));
    // scope housing (ring facing the target) + lens + sunshade
    var cx = x + 3.4, cy = y;
    var housing = new THREE.TorusGeometry(1.05, 0.12, 12, 40);
    var hm = mesh(housing, P.mats.black);
    hm.position.set(cx, cy, -1.7); g.add(hm);
    var lens = new THREE.CircleGeometry(1.0, 36);
    var lm = mesh(lens, P.mats.glass); lm.position.set(cx, cy, -1.68); g.add(lm);
    var shade = new THREE.CylinderGeometry(1.12, 1.12, 1.5, 36, 1, true);
    shade.rotateX(Math.PI / 2);
    var sm = mesh(shade, P.mats.black, cx, cy, -2.4); sm.material = P.mats.black; g.add(sm);
    // scope to block bracket
    var br = BB.roundedRectProfile(0.3, 0.34, 0.1, 3);
    br.forEach(function (p) { p.z += 0.6; p.y += y; });
    g.add(mesh(BB.prism(br, x + 3.3, x + 3.5, { bevel: 0.05 }), P.mats.black));
    // bubble level
    var lvl = new THREE.CylinderGeometry(0.13, 0.13, 1.1, 12);
    lvl.rotateZ(Math.PI / 2);
    g.add(mesh(lvl, P.mats.glass, x + 2.3, y - 1.3, -0.7));
    return g;
  };

  // ----------------------------------------------------------- stabiliser ---
  P.buildStabilizer = function (L) {
    var g = new THREE.Group();
    var y = L.stabY, zf = L.zFront;
    var len = L.stabLen;
    g.add(mesh(BB.rodGeo(V(0, y, zf), V(0, y, zf - len), 0.34, 16), P.mats.black));
    // weight stack
    for (var i = 0; i < 3; i++) {
      var w = new THREE.CylinderGeometry(1.05 - i * 0.05, 1.05 - i * 0.05, 0.32, 28);
      w.rotateX(Math.PI / 2);
      g.add(mesh(w, P.mats.riserDark, 0, y, zf - len + 0.4 + i * 0.42));
    }
    var cap = new THREE.CylinderGeometry(0.5, 0.5, 0.3, 18);
    cap.rotateX(Math.PI / 2);
    g.add(mesh(cap, P.mats.accent, 0, y, zf - len + 1.7));
    // rubber damper
    var d = new THREE.TorusGeometry(0.42, 0.11, 8, 20);
    var dm = mesh(d, P.mats.rubber); dm.rotation.y = Math.PI / 2;
    dm.position.set(0, y, zf - 1.4); g.add(dm);
    return g;
  };

  // --------------------------------------------------------- cable guard ----
  P.buildCableGuard = function (L) {
    var g = new THREE.Group();
    var y = L.guardY, z = L.guardZ;
    g.add(mesh(BB.rodGeo(V(L.x * 0.7, y, z - 0.9), V(L.guardX, y, z), 0.19, 10), P.mats.black));
    var roller = new THREE.CylinderGeometry(0.42, 0.42, 0.62, 18);
    roller.rotateX(Math.PI / 2);
    roller.rotateY(Math.PI / 2);
    g.add(mesh(roller, P.mats.rubber, L.guardX, y, z));
    var cap2 = new THREE.CylinderGeometry(0.17, 0.17, 0.9, 12);
    cap2.rotateZ(Math.PI / 2);
    g.add(mesh(cap2, P.mats.steel, L.guardX + 0.3, y, z));
    return g;
  };

  // ---------------------------------------------------------------- arrow ---
  /* Built with the origin AT THE NOCK, shaft running toward -z (the target). */
  P.buildArrow = function (arrowLen, shaftR) {
    var g = new THREE.Group();
    var len = arrowLen, r = shaftR || 0.15;
    var shaft = new THREE.CylinderGeometry(r, r, len, 14, 1, false);
    shaft.rotateX(Math.PI / 2);
    shaft.translate(0, 0, -len / 2);
    g.add(mesh(shaft, P.mats.shaft));
    // point / insert
    var pt = new THREE.CylinderGeometry(r * 1.15, r * 1.15, 1.1, 14);
    pt.rotateX(Math.PI / 2); pt.translate(0, 0, -len + 0.5);
    g.add(mesh(pt, P.mats.steel));
    var tip = new THREE.ConeGeometry(r * 1.15, 0.55, 14);
    tip.rotateX(-Math.PI / 2); tip.translate(0, 0, -len - 0.2);
    g.add(mesh(tip, P.mats.steel));
    // nock
    var nk = new THREE.CylinderGeometry(r * 1.05, r * 0.95, 0.55, 12);
    nk.rotateX(Math.PI / 2); nk.translate(0, 0, -0.15);
    g.add(mesh(nk, P.mats.black));
    // fletching: 3 helical vanes built directly in 3D (proper shape + twist)
    function vaneGeo(a, r, z0, z1, h0, twist, n) {
      n = n || 8;
      var pos = [], idx = [];
      for (var k = 0; k <= n; k++) {
        var t = k / n, z = z0 + (z1 - z0) * t;
        var hh = h0 * (0.30 + 0.85 * t);
        var ang = a + twist * t;
        var ca = Math.cos(ang), sa = Math.sin(ang);
        pos.push(ca * r, sa * r, z);                 // inner
        pos.push(ca * (r + hh), sa * (r + hh), z);   // outer
      }
      for (var j = 0; j < n; j++) {
        var b0 = j * 2, b1 = (j + 1) * 2;
        idx.push(b0, b1, b1 + 1, b0, b1 + 1, b0 + 1);
      }
      var g2 = new THREE.BufferGeometry();
      g2.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g2.setIndex(idx);
      g2.computeVertexNormals();
      return g2;
    }
    for (var i = 0; i < 3; i++) {
      var a2 = (i / 3) * Math.PI * 2 + Math.PI / 2;
      var vg = vaneGeo(a2, r * 0.98, -1.1, -3.05, 0.42, 0.42);
      g.add(mesh(vg, i === 0 ? P.mats.fletch2 : P.mats.fletch));
    }
    var wrap = new THREE.CylinderGeometry(r * 1.06, r * 1.06, 2.4, 14);
    wrap.rotateX(Math.PI / 2); wrap.translate(0, 0, -2.1);
    g.add(mesh(wrap, P.mats.accent));
    return g;
  };

  // ------------------------------------------------------------- D-loop -----
  P.buildDLoop = function () {
    var g = new THREE.Group();
    var t = new THREE.TorusGeometry(0.42, 0.055, 8, 26);
    var m = mesh(t, P.mats.serving);
    m.rotation.y = Math.PI / 2;
    g.add(m);
    return g;
  };

  // peep sight: small ring sitting in the string
  P.buildPeep = function () {
    var g = new THREE.Group();
    var t = new THREE.TorusGeometry(0.17, 0.055, 8, 20);
    var m = mesh(t, P.mats.black);
    m.rotation.x = Math.PI / 2;
    g.add(m);
    return g;
  };

  root.BowParts = P;
})(window);
