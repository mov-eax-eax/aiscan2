/* ============================================================================
   bowlab / bow.js — assembles the whole bow from the physics blueprint and
   drives every moving part from the mechanics solution each frame.

   Nothing here is animated by hand: the cam angle, limb bend (a real cantilever
   deflection shape), limb-tip travel, string wrap, string legs, cable line of
   action and arrow position all come out of BowPhysics.

   Bow local space = INCHES, y up, z toward the archer, x across the bow.
   The group is scaled to metres by the scene.
   ========================================================================== */
(function (root) {
  'use strict';
  var BB = root.BowBuilders, PT = root.BowParts, V = BB.v;
  var LAY = {};

  function bezier(p0, p1, p2, t) {
    var u = 1 - t;
    return V(u * u * p0.x + 2 * u * t * p1.x + t * t * p2.x,
             u * u * p0.y + 2 * u * t * p1.y + t * t * p2.y,
             u * u * p0.z + 2 * u * t * p1.z + t * t * p2.z);
  }
  function mirrorPts(pts, side) {
    var out = pts.map(function (p) { return { y: side * p.y, z: p.z }; });
    if (side < 0) out.reverse();
    return out;
  }

  // ======================================================== shared layout ===
  function layoutFor(bp) {
    var P = bp.params, g = bp.geometry, L = {};
    L.kind = bp.kind;
    L.x = 0.55;                       // riser half thickness
    L.bladeX = 0.46;                  // split-limb blade centreline
    L.bladeW = 0.36;
    if (bp.kind === 'compound') {
      L.ata = P.ata; L.brace = P.brace; L.rs = P.stringGrooveR;
      L.zAxle0 = g.zAxle0; L.pocketY = g.yPocket; L.pocketZ = g.zPocket;
      L.yTop = L.pocketY + 0.75; L.yBot = -(L.pocketY + 0.75);
      L.winY1 = 4.3; L.winY0 = -0.6; L.winZ = -0.62;
      L.gripY0 = -4.7; L.zBack = 0.85; L.zFront = -1.5;
      L.stabY = -3.1; L.stabLen = 9.0;
      L.sightY = 3.55;
      L.guardY = -0.9; L.guardZ = 1.1; L.guardX = 3.3;
      L.arrowLen = 28.5; L.shaftR = 0.148;
      L.limbRootY = g.yPocket + 0.15; L.limbRootZ = g.zPocket + 0.28;
      L.camW = 0.54; L.rHub = bp.metrics.hubRadius;
      L.arrowY = 0;
    } else {
      L.ata = P.tipToTip; L.brace = P.brace; L.rt = P.tipRadius;
      L.yTop = P.riserHalf + 0.9; L.yBot = -(P.riserHalf + 0.9);
      L.pocketY = P.riserHalf; L.pocketZ = P.pocketZ;
      L.winY1 = 4.6; L.winY0 = -1.2; L.winZ = -0.7;
      L.gripY0 = -5.4; L.zBack = 0.9; L.zFront = -1.6;
      L.stabY = -3.6; L.stabLen = 11.0;
      L.sightY = 3.8;
      L.guardY = -1.2; L.guardZ = 1.0; L.guardX = 0;   // recurves have no guard
      L.arrowLen = 29.5; L.shaftR = 0.155;
      L.limbRootY = P.riserHalf + 0.2; L.limbRootZ = P.pocketZ + 0.3;
      L.arrowY = 0;
      L.zAxle0 = g.zPocket + g.limbChord * Math.sin(g.beta0);
    }
    return L;
  }

  // =============================================================== COMPOUND ==
  function buildCompound(bp, opts) {
    var P = bp.params, g = bp.geometry, M = PT.mats, L = layoutFor(bp);
    var group = new THREE.Group();
    var rs = g.rs, rHub = bp.metrics.hubRadius;
    var tipRest = { y: P.ata / 2, z: g.zAxle0 };
    var deltaMax = bp.metrics.limbTipTravel + 1e-6;

    group.add(PT.buildRiser(L));
    group.add(PT.buildPocket(L, 1));
    group.add(PT.buildPocket(L, -1));
    group.add(PT.buildRest(L));
    group.add(PT.buildSight(L));
    group.add(PT.buildStabilizer(L));
    group.add(PT.buildCableGuard(L));

    // ---------------------------------------------------------- limbs ------
    var nSeg = 26;
    var blades = [];
    var limbRoots = {};
    function restCenterline(side) {
      var p0 = V(0, side * L.limbRootY, L.limbRootZ);
      var p2 = V(0, side * tipRest.y, tipRest.z);
      var mid = V(0, (p0.y + p2.y) / 2, (p0.z + p2.z) / 2);
      var dz = 0.55;                       // limb pre-curve (belly toward archer)
      var p1 = V(0, mid.y + side * 0.05, mid.z + dz);
      var out = [];
      for (var i = 0; i <= nSeg; i++) out.push(bezier(p0, p1, p2, i / nSeg));
      return out;
    }
    function axlePos(delta, side) {
      var dy = Math.max(g.dy0 - delta, 0.2);
      var dz = Math.sqrt(Math.max(g.L0 * g.L0 - dy * dy, 1e-6));
      return { y: side * (g.yPocket + dy), z: g.zPocket + dz };
    }
    [1, -1].forEach(function (side) {
      var rest = restCenterline(side);
      var tip0 = rest[rest.length - 1];
      [-1, 1].forEach(function (bx) {
        var sw = BB.Sweep({
          segments: nSeg, sides: 12, uAxis: V(1, 0, 0), superEllipse: 2.8,
          station: function (t) { return { w: L.bladeW * (1 - 0.12 * t), h: 0.30 * (1 - 0.42 * t) + 0.06 }; }
        });
        var mesh = new THREE.Mesh(sw.geometry, M.limb);
        mesh.name = 'limb' + side + '_' + bx;
        mesh.castShadow = true; mesh.receiveShadow = true;
        mesh.position.x = bx * L.bladeX;
        group.add(mesh);
        blades.push({ side: side, bx: bx, sweep: sw, rest: rest, tip0: tip0, mesh: mesh });
      });
    });

    // ----------------------------------------------------------- cams ------
    function buildCam(side) {
      var outer = new THREE.Group();                 // positioned at the axle
      var spin = new THREE.Group();                  // rotates with the cam
      outer.add(spin);
      var hubR = rHub + 0.09;
      var flange = rs - 0.04;                        // rim just above the string
      // hub (the cable winds onto this)
      var hub = new THREE.CylinderGeometry(hubR, hubR, 0.30, 28);
      hub.rotateZ(Math.PI / 2);
      spin.add(PT.mesh(hub, M.camDark));
      // groove: a machined channel the string sits down inside
      spin.add(PT.mesh(BB.ringSolid(hubR - 0.03, rs - 0.15, -0.17, 0.17, 64), M.camDark));
      // cheek plates (flanges) either side of the groove
      spin.add(PT.mesh(BB.ringSolid(hubR, flange, -0.29, -0.17, 64), M.cam));
      spin.add(PT.mesh(BB.ringSolid(hubR, flange, 0.17, 0.29, 64), M.cam));
      // a bright machined rim so the cam's edge catches the light
      spin.add(PT.mesh(BB.ringSolid(flange - 0.05, flange, -0.29, 0.29, 64), M.steel));
      // machined lightening pockets in the flanges
      for (var hh = 0; hh < 3; hh++) {
        var ha = -0.7 + hh * 1.2;
        var hr = (hubR + rs) * 0.5 + 0.05;
        var hole = new THREE.CylinderGeometry(0.19, 0.19, 0.22, 14);
        hole.rotateZ(Math.PI / 2);
        [-1, 1].forEach(function (s) {
          spin.add(PT.mesh(hole.clone(), M.black, s * 0.24, hr * Math.cos(ha), hr * Math.sin(ha)));
        });
      }
      // cable cam-over post: the cable's line of action walks toward the axle
      // as the draw progresses -- this is what makes let-off
      var post = new THREE.CylinderGeometry(0.15, 0.15, 0.62, 12);
      post.rotateZ(Math.PI / 2);
      spin.add(PT.mesh(post, M.steel, 0, 0, rHub + 0.5));
      // draw-stop peg (contacts the limb at full draw)
      var stopA = -2.35;
      var peg = new THREE.CylinderGeometry(0.11, 0.11, 0.72, 12);
      peg.rotateZ(Math.PI / 2);
      spin.add(PT.mesh(peg, M.rubber, 0, 0.95 * Math.cos(stopA), 0.95 * Math.sin(stopA)));
      // string anchor slot on the flange
      var anc = BB.roundedRectProfile(0.44, 0.34, 0.1, 3);
      anc.forEach(function (p) { p.z += hubR + 0.3; p.y += 0.12; });
      [-1, 1].forEach(function (s) {
        spin.add(PT.mesh(BB.prism(anc, s * 0.2, s * 0.31, { bevel: 0.03 }), M.camDark));
      });
      // axle + spacers
      var axLen = 2 * L.bladeX + 0.16;
      var axle = new THREE.CylinderGeometry(0.115, 0.115, axLen, 14);
      axle.rotateZ(Math.PI / 2);
      outer.add(PT.mesh(axle, M.steel));
      [-1, 1].forEach(function (s) {
        var sp = new THREE.CylinderGeometry(0.21, 0.21, 0.12, 14);
        sp.rotateZ(Math.PI / 2);
        outer.add(PT.mesh(sp, M.black, s * (L.bladeX - 0.06), 0, 0));
      });
      return { outer: outer, spin: spin };
    }
    var cams = { top: buildCam(1), bot: buildCam(-1) };
    group.add(cams.top.outer); group.add(cams.bot.outer);

    // ------------------------------------------------------- string --------
    /* Wrap bookkeeping.  The mechanics solver says the string pays out
       u = L - L0 inches per cam, so the arc still wrapped on the groove is
         W(u) = W0 - u / r_s      (radians)
       We render the wrap by walking from the departure point *backwards* along
       the groove by exactly W, which keeps the picture and the payout identical. */
    var rows = bp.rows, N = rows.length;
    function depWorldAngle(r) { return Math.atan2(r.tp.p.z - r.ax.z, r.tp.p.y - r.ax.y); }
    var payoutEnd = bp.metrics.payout;
    var wrap0S = payoutEnd / rs + 0.9 / rs;            // arc at brace (rad)
    var sweepTop = 1, sweepBot = -1;                   // mirror image
    var wrap0C = Math.abs(rows[N - 1].rho) + 0.6;      // cable arc at brace (rad)

    var strandS = BB.Strand(78, 0.072, 7);
    var stringMesh = new THREE.Mesh(strandS.geometry, M.string);
    stringMesh.name = 'bowstring';
    stringMesh.castShadow = true;
    group.add(stringMesh);
    var cables = [];
    [-1, 1].forEach(function (k) {
      var st = BB.Strand(58, 0.062, 6);
      var m = new THREE.Mesh(st.geometry, k > 0 ? M.cable : M.string);
      m.name = 'cable' + k;
      m.castShadow = true;
      group.add(m);
      cables.push({ strand: st, k: k, mesh: m });
    });

    // ------------------------------------------------------- accessories ---
    var dloop = PT.buildDLoop(); group.add(dloop);
    var peep = PT.buildPeep(); group.add(peep);
    var arrow = PT.buildArrow(L.arrowLen, L.shaftR); group.add(arrow);

    // --------------------------------------------------- mechanics overlay --
    var overlay = new THREE.Group(); group.add(overlay);
    var armLine = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([V(0, 0, 0), V(0, 0, 0)]),
      new THREE.LineDashedMaterial({ color: 0xff7a1a, dashSize: 0.28, gapSize: 0.2, linewidth: 1 }));
    var armLine2 = armLine.clone();
    overlay.add(armLine); overlay.add(armLine2);
    var forceArrow = new THREE.ArrowHelper(V(0, 0, 1), V(0, 0, 0), 6, 0xff7a1a, 1.1, 0.6);
    overlay.add(forceArrow);
    var tipArrow = new THREE.ArrowHelper(V(0, -1, 0), V(0, 0, 0), 2, 0x4ad6ff, 0.7, 0.4);
    var tipArrow2 = new THREE.ArrowHelper(V(0, 1, 0), V(0, 0, 0), 2, 0x4ad6ff, 0.7, 0.4);
    overlay.add(tipArrow); overlay.add(tipArrow2);

    // ============================================================== update ==
    var tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3();
    var strPts = [], cabPtsA = [], cabPtsB = [];

    function wrapArcPts(axle, r, aAnchor, aDep, n, out) {
      // walk the groove from the anchor round to the departure point
      for (var i = 0; i < n; i++) {
        var f = i / (n - 1);
        var a = aAnchor + (aDep - aAnchor) * f;
        out.push(V(0, axle.y + r * Math.cos(a), axle.z + r * Math.sin(a)));
      }
    }

    function update(st, extra) {
      extra = extra || {};
      var side = 1, delta = st.delta;
      // ---- limbs: real cantilever deflection shape -----------------------
      var ax = axlePos(delta, 1);
      var disp = { y: ax.y - tipRest.y, z: ax.z - tipRest.z };
      blades.forEach(function (b) {
        var pts = b.rest.map(function (p, i) {
          var t = i / (b.rest.length - 1);
          var shape = (3 * t * t - t * t * t) / 2;          // cantilever, tip load
          return V(b.bx * L.bladeX, p.y + disp.y * shape, p.z + disp.z * shape);
        });
        b.sweep.update(pts);
      });
      // ---- cams ----------------------------------------------------------
      var rho = st.theta;
      cams.top.outer.position.set(0, ax.y, ax.z);
      cams.top.spin.rotation.x = rho;
      var axB = axlePos(delta, -1);
      cams.bot.outer.position.set(0, axB.y, axB.z);
      cams.bot.spin.rotation.x = -rho;

      // ---- string: wrap + leg + nock + leg + wrap ------------------------
      strPts.length = 0;
      var depY = st.tp.p.y, depZ = st.tp.p.z;
      var aTop = Math.atan2(depZ - ax.z, depY - ax.y);
      var Ws = Math.max(0.06, wrap0S - st.u / rs);
      wrapArcPts(ax, rs, aTop - sweepTop * Ws, aTop, 20, strPts);
      var nockY = 0, nockZ = st.zNock;
      if (extra.vibe) { nockY += extra.vibe.y; nockZ += extra.vibe.z; }
      var legN = 12;
      for (var i = 1; i <= legN; i++) {
        var f = i / legN;
        strPts.push(V(0, depY + (nockY - depY) * f, depZ + (nockZ - depZ) * f));
      }
      for (var j = 1; j <= legN; j++) {
        var f2 = j / legN;
        strPts.push(V(0, nockY + (-depY - nockY) * f2, nockZ + (depZ - nockZ) * f2));
      }
      var aBot = Math.atan2(depZ - axB.z, -depY - axB.y);
      wrapArcPts(axB, rs, aBot - sweepBot * Ws, aBot, 20, strPts);
      strandS.update(strPts);

      // ---- cables: hub wrap -> cam-over line -> roller -> other cam -------
      var Wc = Math.max(0.1, wrap0C + Math.abs(rho));
      cables.forEach(function (c, ci) {
        var pts = ci === 0 ? cabPtsA : cabPtsB;
        pts.length = 0;
        var off = c.k * 0.085;
        var zLineT = ax.z + st.arm;             // cable line of action (top)
        var zLineB = axB.z + st.arm;
        var aC = Math.PI / 2;                    // leaves straight behind the axle
        wrapArcPts(ax, rHub, aC - sweepBot * Wc, aC, 12, pts);
        pts.push(V(off, ax.y, zLineT));
        var midY = (ax.y + axB.y) / 2;
        pts.push(V(L.guardX * 0.5, ax.y - (ax.y - midY) * 0.5, (zLineT + zLineB) / 2 + 0.3));
        pts.push(V(L.guardX, midY, (zLineT + zLineB) / 2));
        pts.push(V(L.guardX * 0.5, axB.y + (midY - axB.y) * 0.5, (zLineT + zLineB) / 2 + 0.3));
        pts.push(V(off, axB.y, zLineB));
        var aCB = Math.PI / 2;
        wrapArcPts(axB, rHub, aCB - sweepTop * Wc, aCB, 12, pts);
        c.strand.update(pts);
      });

      // ---- arrow / D-loop / peep ----------------------------------------
      var az = extra.arrowZ === undefined ? nockZ : extra.arrowZ;
      var ay = extra.arrowY === undefined ? nockY : extra.arrowY;
      var apitch = extra.arrowPitch || 0;
      arrow.position.set(0, ay, az);
      arrow.rotation.x = apitch;
      dloop.position.set(0, nockY, nockZ + 0.2);
      peep.position.set(0, nockY + 1.55, nockZ + 1.9);

      // ---- mechanics overlay --------------------------------------------
      if (extra.showArms) {
        overlay.visible = true;
        tmpA.set(0, ax.y, ax.z + st.arm * 0.0);
        armLine.geometry.setFromPoints([V(0, ax.y, ax.z), V(0, ax.y, ax.z + st.arm)]);
        armLine.computeLineDistances();
        armLine2.geometry.setFromPoints([V(0, axB.y, axB.z), V(0, axB.y, axB.z + st.arm)]);
        armLine2.computeLineDistances();
        var fl = Math.max(0.4, st.F * 0.12);
        forceArrow.position.set(0, nockY, nockZ);
        forceArrow.setDirection(V(0, 0, 1));
        forceArrow.setLength(fl, fl * 0.22, fl * 0.12);
        tipArrow.position.set(0, ax.y, ax.z);
        tipArrow.setLength(1.2, 0.4, 0.24);
        tipArrow2.position.set(0, axB.y, axB.z);
        tipArrow2.setDirection(V(0, 1, 0));
        tipArrow2.setLength(1.2, 0.4, 0.24);
      } else {
        overlay.visible = false;
      }
    }

    return {
      kind: 'compound', group: group, layout: L, scale: 0.0254,
      update: update, bp: bp,
      parts: { cams: cams, blades: blades, arrow: arrow, string: stringMesh }
    };
  }

  // ================================================================ RECURVE ==
  function buildRecurve(bp, opts) {
    var P = bp.params, g = bp.geometry, M = PT.mats, L = layoutFor(bp);
    var group = new THREE.Group();
    group.add(PT.buildRiser(L));
    group.add(PT.buildPocket(L, 1));
    group.add(PT.buildPocket(L, -1));
    group.add(PT.buildRest(L));
    group.add(PT.buildSight(L));
    group.add(PT.buildStabilizer(L));

    var rt = P.tipRadius, nSeg = 30;
    var tipRest = { y: P.tipToTip / 2, z: P.brace - rt };
    function restCenterline(side) {
      // recurve limb: leaves the pocket, bows away, then hooks back at the tip
      var p0 = V(0, side * L.limbRootY, L.limbRootZ);
      var p2 = V(0, side * tipRest.y, tipRest.z);
      var mid = V(0, (p0.y + p2.y) / 2, (p0.z + p2.z) / 2);
      var p1 = V(0, mid.y - side * 0.5, mid.z - 1.5);        // deflex then recurve
      var out = [];
      for (var i = 0; i <= nSeg; i++) out.push(bezier(p0, p1, p2, i / nSeg));
      // bend the last stretch into the recurve hook
      for (var k = Math.max(0, nSeg - 5); k <= nSeg; k++) {
        var t = (k - (nSeg - 5)) / 5;
        var hook = V(0, 0, 0);
        var base = out[k];
        var ang = t * 0.85;
        var dy = base.y - tipRest.y * side, dz = base.z - tipRest.z;
        hook.set(0, tipRest.y * side + dy * Math.cos(ang) - dz * Math.sin(ang) * side,
                 tipRest.z + dz * Math.cos(ang) + dy * Math.sin(ang) * side);
        out[k] = hook;
      }
      return out;
    }
    var blades = [];
    [1, -1].forEach(function (side) {
      var rest = restCenterline(side);
      var sw = BB.Sweep({
        segments: nSeg, sides: 12, uAxis: V(1, 0, 0), superEllipse: 3.0,
        station: function (t) { return { w: 0.52 * (1 - 0.36 * t) + 0.1, h: 0.26 * (1 - 0.5 * t) + 0.05 }; }
      });
      var mesh = new THREE.Mesh(sw.geometry, M.limb);
      mesh.castShadow = true; mesh.receiveShadow = true;
      group.add(mesh);
      blades.push({ side: side, sweep: sw, rest: rest });
    });
    // tip overlays (the string groove the string sits in)
    [1, -1].forEach(function (side) {
      var t = new THREE.Mesh(new THREE.TorusGeometry(rt, 0.09, 8, 24, Math.PI * 1.1), M.limbEdge);
      t.position.set(0, side * tipRest.y, tipRest.z);
      t.rotation.y = Math.PI / 2;
      t.rotation.z = side > 0 ? -1.1 : Math.PI + 1.1;
      t.castShadow = true;
      group.add(t);
    });

    var strN = 60;
    var strand = BB.Strand(strN, 0.05, 6);
    var stringMesh = new THREE.Mesh(strand.geometry, M.string);
    stringMesh.name = 'bowstring';
    stringMesh.castShadow = true;
    group.add(stringMesh);
    var dloop = PT.buildDLoop(); group.add(dloop);
    var peep = PT.buildPeep(); group.add(peep);
    var arrow = PT.buildArrow(L.arrowLen, L.shaftR); group.add(arrow);

    var overlay = new THREE.Group(); group.add(overlay);
    var forceArrow = new THREE.ArrowHelper(V(0, 0, 1), V(0, 0, 0), 6, 0xff7a1a, 1.1, 0.6);
    overlay.add(forceArrow);
    var tipArrow = new THREE.ArrowHelper(V(0, -1, 0), V(0, 0, 0), 2, 0x4ad6ff, 0.7, 0.4);
    var tipArrow2 = new THREE.ArrowHelper(V(0, 1, 0), V(0, 0, 0), 2, 0x4ad6ff, 0.7, 0.4);
    overlay.add(tipArrow); overlay.add(tipArrow2);

    function wrapArc(centre, r, a0, a1, n, out, side, dir) {
      for (var i = 0; i < n; i++) {
        var f = i / (n - 1), a = a0 + dir * (a1 - a0) * f;
        out.push(V(0, centre.y + r * Math.cos(a), centre.z + r * Math.sin(a)));
      }
    }
    var strPts = [];

    function update(st, extra) {
      extra = extra || {};
      // limb tip displacement straight from the mechanics
      [1, -1].forEach(function (side) {
        var tip = side > 0 ? st.tip : st.tipB;
        var d = { y: tip.y - side * tipRest.y, z: tip.z - tipRest.z };
        var b = blades[side > 0 ? 0 : 1];
        var pts = b.rest.map(function (p, i) {
          var t = i / (b.rest.length - 1);
          // a recurve limb bends over its whole length: use a fuller shape
          var shape = (3 * t * t - t * t * t) / 2 * 0.85 + t * t * 0.15;
          return V(0, p.y + d.y * shape, p.z + d.z * shape);
        });
        b.sweep.update(pts);
        var ring = group.children.find(function (c) { return c.isMesh && c.geometry.type === 'TorusGeometry'; });
      });

      var nockY = 0, nockZ = st.zNock;
      if (extra.vibe) { nockY += extra.vibe.y; nockZ += extra.vibe.z; }
      strPts.length = 0;
      var side = 1;
      var dep = st.dep, tip = st.tip;
      var aDep = Math.atan2(dep.z - tip.z, dep.y - tip.y);
      var aAnchor = aDep + 1.15;
      wrapArc(tip, rt, aAnchor, aDep, 10, strPts, 1, -1);
      for (var i = 1; i <= 14; i++) {
        var f = i / 14;
        strPts.push(V(0, dep.y + (nockY - dep.y) * f, dep.z + (nockZ - dep.z) * f));
      }
      for (var j = 1; j <= 14; j++) {
        var f2 = j / 14;
        strPts.push(V(0, nockY + (-st.depB.y - nockY) * f2, nockZ + (st.depB.z - nockZ) * f2));
      }
      var aDepB = Math.atan2(st.depB.z - st.tipB.z, st.depB.y - st.tipB.y);
      var aAnchorB = aDepB - 1.15;
      wrapArc(st.tipB, rt, aAnchorB, aDepB, 10, strPts, -1, 1);
      strand.update(strPts);

      var az = extra.arrowZ === undefined ? nockZ : extra.arrowZ;
      var ay = extra.arrowY === undefined ? nockY : extra.arrowY;
      arrow.position.set(0, ay, az);
      arrow.rotation.x = extra.arrowPitch || 0;
      dloop.position.set(0, nockY, nockZ + 0.2);
      peep.position.set(0, nockY + 1.6, nockZ + 1.7);

      if (extra.showArms) {
        overlay.visible = true;
        var fl = Math.max(0.4, st.F * 0.12);
        forceArrow.position.set(0, nockY, nockZ);
        forceArrow.setLength(fl, fl * 0.22, fl * 0.12);
        tipArrow.position.set(0, st.tip.y, st.tip.z);
        tipArrow2.position.set(0, st.tipB.y, st.tipB.z);
        tipArrow2.setDirection(V(0, 1, 0));
      } else overlay.visible = false;
    }

    return { kind: 'recurve', group: group, layout: L, scale: 0.0254, update: update, bp: bp, parts: { blades: blades, arrow: arrow, string: stringMesh } };
  }

  root.BowModel = {
    create: function (bp, opts) {
      var bow = (bp.kind === 'recurve') ? buildRecurve(bp, opts) : buildCompound(bp, opts);
      bow.group.scale.setScalar(0.0254);
      return bow;
    },
    layoutFor: layoutFor
  };
})(window);
