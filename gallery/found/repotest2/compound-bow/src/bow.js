/* Mathews LIFT 33 compound bow.
   Shape vocabulary taken only from the reference photos in refs/ and the part /
   mechanics inventory in ontology/compound-bow.ontology.json. */
(function (global) {
  'use strict';
  const G = global.CB_GEOM;
  const Z_AXIS = new THREE.Vector3(0, 0, 1);

  const D = {
    camX: 2.0, camR: 2.34, grooveR: 2.0, camTh: 0.31,
    axleY: 16.5,
    pocketX: 7.0, pocketY: 9.4,
    riserTh: 1.5,
    nockY: 2.6,
    powerStroke: 20.75,
    arrowLen: 25.0,
    leafZ: 0.27,
    guard: new THREE.Vector3(3.1, -1.3, 0.55)
  };

  function add(parent, geo, mat, name) {
    const m = new THREE.Mesh(geo, mat); m.name = name || '';
    m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
  }
  function empty(parent, name, x, y, z) {
    const o = new THREE.Object3D(); o.name = name || '';
    if (x !== undefined) o.position.set(x, y, z || 0);
    parent.add(o); return o;
  }
  function v(x, y, z) { return new THREE.Vector3(x, y, z || 0); }
  function wrap(pts) { return pts.concat([pts[0], pts[1]]); }
  function setGeo(mesh, geo) { if (mesh.geometry) mesh.geometry.dispose(); mesh.geometry = geo; }

  function tangentPoint(C, r, P, out) {
    const dx = P.x - C.x, dy = P.y - C.y;
    const L = Math.sqrt(dx * dx + dy * dy);
    if (L <= r * 1.0005) return out.set(C.x + r * (dx / (L || 1)), C.y + r * (dy / (L || 1)), 0);
    const base = Math.atan2(dy, dx), a = Math.acos(r / L);
    const ax = C.x + Math.cos(base + a) * r, ay = C.y + Math.sin(base + a) * r;
    const bx = C.x + Math.cos(base - a) * r, by = C.y + Math.sin(base - a) * r;
    if (ax <= bx) out.set(ax, ay, 0); else out.set(bx, by, 0);
    return out;
  }

  function build(mats) {
    const root = new THREE.Group(); root.name = 'mathews-lift-33';
    const moving = {}; const labels = [];
    function label(name, x, y, z) { const o = empty(root, 'label-' + name, x, y, z); labels.push({ name: name, o: o }); }

    /* ================= RISER ================= */
    const riser = new THREE.Group(); riser.name = 'riser'; root.add(riser);
    const OUTLINE = [
      [8.70, 10.25], [8.98, 8.4], [9.05, 5.6], [9.02, 2.6], [8.98, 0.0],
      [9.02, -2.6], [9.05, -5.6], [8.98, -8.4], [8.70, -10.25],
      [7.05, -10.6], [6.30, -9.2], [6.18, -6.4], [6.24, -3.2], [6.42, -1.0],
      [7.35, -0.15], [7.66, 1.0], [7.30, 1.9],
      [7.10, 3.2], [7.05, 4.8], [6.90, 6.4], [6.55, 7.6],
      [6.68, 9.1], [7.30, 10.05]
    ];
    const riserShape = G.blobShape(wrap(OUTLINE));
    riserShape.holes.push(G.roundRectPath(1.3, 2.9, 0.55, 7.98, 6.65));
    riserShape.holes.push(G.roundRectPath(1.3, 2.9, 0.55, 7.98, -6.65));
    riserShape.holes.push(G.roundRectPath(0.5, 1.6, 0.24, 8.20, 3.0));
    riserShape.holes.push(G.roundRectPath(0.5, 1.6, 0.24, 8.20, -3.0));
    riserShape.holes.push(G.circlePath(0.25, 7.62, 9.45));
    riserShape.holes.push(G.circlePath(0.25, 7.62, -9.45));
    riserShape.holes.push(G.circlePath(0.22, 8.3, 9.5));
    riserShape.holes.push(G.circlePath(0.22, 8.3, -9.5));
    riserShape.holes.push(G.roundRectPath(0.42, 0.9, 0.2, 7.85, 8.5));
    riserShape.holes.push(G.roundRectPath(0.42, 0.9, 0.2, 7.85, -8.5));
    riserShape.holes.push(G.roundRectPath(0.42, 0.9, 0.2, 8.05, 0.1));
    add(riser, G.plate(riserShape, D.riserTh, 0.032), mats.riser, 'riserBody');
    add(riser, G.roundedBox(0.46, 15.4, D.riserTh + 0.16, 0.18), mats.riser2, 'riserSpine').position.set(8.62, 0, 0);
    const pockT = add(riser, G.roundedBox(2.05, 2.2, 1.78, 0.3), mats.riser2, 'limbPocketTop');
    pockT.position.set(7.15, 9.85, 0); pockT.rotation.z = -0.32;
    const pockB = add(riser, G.roundedBox(2.05, 2.2, 1.78, 0.3), mats.riser2, 'limbPocketBottom');
    pockB.position.set(7.15, -9.85, 0); pockB.rotation.z = 0.32;
    add(riser, G.roundedBox(0.42, 0.42, 1.0, 0.1), mats.steel, 'pocketBoltTop').position.set(7.4, 9.6, 0.95);
    add(riser, G.roundedBox(0.42, 0.42, 1.0, 0.1), mats.steel, 'pocketBoltBottom').position.set(7.4, -9.6, 0.95);
    const GRIP = [
      [7.55, 3.5], [6.92, 3.3], [6.22, 1.6], [6.18, -0.6], [6.38, -2.4],
      [6.98, -3.3], [7.5, -3.45], [7.66, -0.4]
    ];
    add(riser, G.plate(G.blobShape(wrap(GRIP)), 1.22, 0.05), mats.grip, 'grip');
    add(riser, G.roundedBox(0.5, 2.5, 1.24, 0.16), mats.steel, 'restBracket').position.set(7.98, 2.55, 0);

    /* ================= SPLIT LIMBS (flat blades) ================= */
    const LB = [
      [7.00, 9.10], [6.86, 10.65], [6.28, 12.35], [5.25, 13.95],
      [3.95, 15.45], [2.75, 16.32], [2.05, 16.55]
    ];
    const LT = [0.50, 0.465, 0.42, 0.37, 0.32, 0.27, 0.235];
    const LW = [0.115, 0.112, 0.108, 0.102, 0.095, 0.086, 0.078];

    function makeLimb(sign) {
      const g = new THREE.Group();
      g.name = sign > 0 ? 'limbTop' : 'limbBottom';
      g.position.set(D.pocketX, sign * D.pocketY, 0);
      const local = LB.map(function (p) { return v(p[0] - D.pocketX, sign * p[1] - sign * D.pocketY, 0); });
      for (let i = 0; i < 2; i++) {
        const zw = i === 0 ? -D.leafZ : D.leafZ;
        const geo = G.sweep(local, LW, LT);
        geo.translate(0, 0, zw);
        add(g, geo, mats.limb, 'limbHalf');
        const edge = G.sweep(local, 0.012, LT.map(function (t) { return t * 0.15; }));
        edge.translate(0, 0, zw + (i === 0 ? -0.116 : 0.116));
        add(g, edge, mats.limbEdge, 'limbEdge');
      }
      root.add(g);
      return g;
    }
    moving.limbTop = makeLimb(1);
    moving.limbBottom = makeLimb(-1);

    /* ================= CAMS ================= */
    function buildCam(sign) {
      const cam = new THREE.Group();
      cam.name = sign > 0 ? 'camTop' : 'camBottom';
      cam.position.set(D.camX - D.pocketX, sign * (D.axleY - D.pocketY), 0);
      const R = D.camR;
      const rFn = function (a) { return R * (1 + 0.12 * Math.cos(3 * a + 0.6)); };
      const outline = G.blobShape(wrap(G.polarRing(null, rFn, 30)));
      const slotAngles = [0.6, 0.6 + 2.0944, 0.6 + 4.1888];
      for (let s = 0; s < 3; s++) {
        const a = slotAngles[s], n = 6, halfA = 0.62, ri = R * 0.30, ro = R * 0.88;
        const pts = [];
        for (let i = 0; i <= n; i++) { const t = a - halfA + 2 * halfA * i / n; pts.push([Math.cos(t) * ro, Math.sin(t) * ro]); }
        for (let i = n; i >= 0; i--) { const t = a - halfA + 2 * halfA * i / n; pts.push([Math.cos(t) * ri, Math.sin(t) * ri]); }
        outline.holes.push(G.blobPath(wrap(pts)));
      }
      add(cam, G.plate(outline, 0.09, 0.012), mats.camFace, 'camWeb');
      const ring = G.blobShape(wrap(G.polarRing(null, rFn, 30)));
      ring.holes.push(G.blobPath(wrap(G.polarOffset(rFn, 0.885, 30))));
      add(cam, G.plate(ring, 0.08, 0.012), mats.cam, 'camFlangeA').position.z = 0.115;
      add(cam, G.plate(ring, 0.08, 0.012), mats.cam, 'camFlangeB').position.z = -0.115;
      add(cam, G.cyl(0.5, 0.38, 30), mats.cam, 'camHub').rotation.x = Math.PI / 2;
      const axle = add(cam, G.cyl(0.185, 1.12, 20), mats.steel, 'axle'); axle.rotation.x = Math.PI / 2;
      const h1 = add(cam, new THREE.CylinderGeometry(0.3, 0.3, 0.13, 6), mats.steel, 'axleHead');
      h1.rotation.x = Math.PI / 2; h1.position.z = 0.6;
      const h2 = add(cam, new THREE.CylinderGeometry(0.3, 0.3, 0.13, 6), mats.steel, 'axleHead');
      h2.rotation.x = Math.PI / 2; h2.position.z = -0.6;
      const mod = add(cam, G.roundedBox(1.1, 0.66, 0.12, 0.2), mats.module, 'camModule');
      mod.position.set(0.72, -0.7, 0.215); mod.rotation.z = 0.55;
      for (let i = 0; i < 2; i++) {
        const avs = add(cam, G.cyl(0.34, 0.1, 22), mats.darkMetal, 'avsDisc');
        avs.rotation.x = Math.PI / 2; avs.position.set(i === 0 ? 0.46 : -0.46, 0.55, 0.215);
      }
      const ds = add(cam, G.cyl(0.1, 0.7, 12), mats.rubber, 'drawStop');
      ds.rotation.x = Math.PI / 2; ds.position.set(R * 0.7, R * 0.74, 0.25);
      const cap = add(cam, G.cyl(0.15, 0.1, 12), mats.accent, 'drawStopCap');
      cap.rotation.x = Math.PI / 2; cap.position.set(R * 0.7, R * 0.74, 0.56);
      empty(cam, 'cableAnchorA', -1.15, sign * -1.3, 0);
      empty(cam, 'cableAnchorB', 0.32, sign * -1.78, 0);
      return cam;
    }
    moving.camTop = buildCam(1); moving.limbTop.add(moving.camTop);
    moving.camBottom = buildCam(-1); moving.limbBottom.add(moving.camBottom);

    /* ================= STRING + CABLES ================= */
    const rig = new THREE.Group(); rig.name = 'cableTrain'; root.add(rig);
    const stringMesh = add(rig, new THREE.BufferGeometry(), mats.string, 'bowstring');
    const serveMesh = add(rig, new THREE.BufferGeometry(), mats.serving, 'centerServing');
    const cableA = add(rig, new THREE.BufferGeometry(), mats.cable, 'cableA');
    const cableB = add(rig, new THREE.BufferGeometry(), mats.cable, 'cableB');
    const peep = add(rig, new THREE.TorusGeometry(0.3, 0.062, 8, 18), mats.darkMetal, 'peep');
    const silTop = add(rig, new THREE.SphereGeometry(0.19, 10, 8), mats.fur, 'silencerTop');
    const silBot = add(rig, new THREE.SphereGeometry(0.19, 10, 8), mats.fur, 'silencerBottom');
    const nockCyl = add(rig, G.cyl(0.07, 0.42, 10), mats.serving, 'nockingPoint');
    nockCyl.rotation.x = Math.PI / 2;
    const dloop = add(rig, new THREE.TorusGeometry(0.48, 0.062, 8, 20), mats.serving, 'dLoop');
    dloop.rotation.y = Math.PI / 2;
    add(rig, G.sweep([v(7.2, -1.7, 0), v(5.5, -1.6, 0.16), v(4.0, -1.45, 0.42), v(3.2, -1.3, 0.52)], 0.1, 0.1), mats.riser2, 'rollerGuard');
    const roller = add(rig, G.cyl(0.32, 0.56, 16), mats.darkMetal, 'roller');
    roller.rotation.x = Math.PI / 2; roller.position.copy(D.guard);
    add(rig, G.roundedBox(0.55, 0.68, 0.8, 0.14), mats.darkMetal, 'cableSlide').position.set(D.guard.x + 0.12, D.guard.y, D.guard.z);
    add(rig, G.sweep([v(7.15, -4.8, 0), v(4.4, -4.75, 0), v(2.2, -4.7, 0), v(1.05, -4.65, 0)], 0.09, 0.09), mats.riser2, 'stringStopArm');
    add(rig, G.roundedBox(0.5, 0.95, 0.66, 0.18), mats.rubber, 'stringStop').position.set(0.9, -4.65, 0);

    /* ================= ARROW ================= */
    const arrowGroup = new THREE.Group(); arrowGroup.name = 'arrow'; root.add(arrowGroup);
    const shaft = add(arrowGroup, G.cyl(0.2, D.arrowLen - 0.6, 14), mats.arrow, 'arrowShaft');
    shaft.rotation.z = Math.PI / 2; shaft.position.set(0.3 + (D.arrowLen - 0.6) / 2, 0, 0);
    const nk = add(arrowGroup, G.cyl(0.235, 0.55, 12), mats.darkMetal, 'arrowNock'); nk.rotation.z = Math.PI / 2;
    const pt = add(arrowGroup, G.cone(0.0, 0.235, 1.2, 14), mats.steel, 'arrowPoint');
    pt.rotation.z = -Math.PI / 2; pt.position.set(D.arrowLen - 0.25, 0, 0);
    for (let i = 0; i < 3; i++) {
      const a = i * Math.PI * 2 / 3;
      const vane = add(arrowGroup, new THREE.BoxGeometry(2.5, 0.66, 0.04), mats.vane, 'vane');
      vane.position.set(2.8, Math.cos(a) * 0.36, Math.sin(a) * 0.36); vane.rotation.x = a;
    }
    const release = new THREE.Group(); release.visible = false; arrowGroup.add(release);
    add(release, G.roundedBox(1.6, 0.55, 0.46, 0.15), mats.darkMetal, 'releaseBody').position.set(-1.2, 0, 0);
    add(release, G.roundedBox(0.55, 0.28, 0.32, 0.1), mats.accent, 'releaseTrigger').position.set(-1.65, 0.33, 0);
    moving.release = release;

    /* ================= ACCESSORIES ================= */
    const acc = new THREE.Group(); acc.name = 'accessories'; root.add(acc);
    add(acc, G.sweep([v(7.7, 3.6, 0.98), v(6.2, 3.85, 0.98), v(4.6, 4.05, 0.98), v(3.1, 4.2, 0.98)], 0.14, 0.14), mats.darkMetal, 'sightBar');
    const scope = add(acc, G.cyl(0.82, 1.6, 26), mats.scope, 'sightScope');
    scope.rotation.z = Math.PI / 2; scope.position.set(2.5, 4.15, 0.98);
    const lens = add(acc, G.cyl(0.68, 0.06, 26), mats.lens, 'scopeLens');
    lens.rotation.z = Math.PI / 2; lens.position.set(1.75, 4.15, 0.98);
    add(acc, G.cyl(0.04, 0.55, 8), mats.lens, 'fiberPin').position.set(1.8, 3.92, 0.98);
    add(acc, G.cyl(0.55, 0.66, 20), mats.darkMetal, 'sightMount').position.set(7.95, 3.6, 0.98);
    add(acc, G.sweep([v(8.4, -4.0, 0), v(12.2, -4.05, 0), v(16.4, -4.1, 0), v(19.9, -4.15, 0)], 0.32, 0.32), mats.darkMetal, 'stabilizerRod');
    const c1 = add(acc, G.cyl(0.58, 0.75, 24), mats.accent, 'stabilizerCollar'); c1.rotation.z = Math.PI / 2; c1.position.set(9.4, -4.02, 0);
    const c2 = add(acc, G.cyl(0.58, 0.75, 24), mats.accent, 'stabilizerCollar2'); c2.rotation.z = Math.PI / 2; c2.position.set(14.4, -4.08, 0);
    for (let i = 0; i < 3; i++) {
      const w = add(acc, G.cyl(0.8, 0.42, 26), mats.darkMetal, 'stabilizerWeight');
      w.rotation.z = Math.PI / 2; w.position.set(19.8 + i * 0.52, -4.15, 0);
    }
    const restArm = new THREE.Group(); restArm.name = 'arrowRest'; acc.add(restArm);
    add(restArm, G.sweep([v(7.95, 2.35, 0.4), v(7.9, 2.95, 0.22), v(7.8, 3.3, 0.0)], 0.1, 0.1), mats.darkMetal, 'restArm');
    const blade = add(restArm, new THREE.BoxGeometry(0.8, 0.55, 0.055), mats.darkMetal, 'restBlade');
    blade.position.set(7.35, 3.42, 0.0); blade.rotation.z = 0.5;

    const quiver = new THREE.Group(); quiver.name = 'quiver'; quiver.visible = false; root.add(quiver);
    add(quiver, G.sweep([v(7.7, 1.2, 0.78), v(7.5, -1.0, 0.98), v(7.4, -3.0, 0.98)], 0.17, 0.17), mats.darkMetal, 'quiverBar');
    add(quiver, G.roundedBox(1.4, 4.4, 2.3, 0.55), mats.riser2, 'quiverHood').position.set(7.5, 4.7, 0.98);
    add(quiver, G.roundedBox(1.2, 3.2, 2.1, 0.45), mats.riser2, 'quiverGrip').position.set(7.4, -5.1, 0.98);
    for (let i = 0; i < 3; i++) add(quiver, G.cyl(0.14, 30, 10), mats.arrow, 'quiverArrow').position.set(7.6 + (i - 1) * 0.34, -0.5, 0.98 + (i - 1) * 0.52);
    moving.quiver = quiver;

    /* ================= LABELS ================= */
    label('Skeletonised riser', 8.6, 0.0, 0);
    label('Split limb', 4.4, 13.2, 0.5);
    label('Limb pocket', 7.15, 10.3, 1.0);
    label('Crosscentric cam', 2.0, 18.6, 0.3);
    label('SwitchWeight module', 3.2, 14.9, 0.5);
    label('Draw stop', 4.1, 18.3, 0.6);
    label('Bowstring', 0.05, 10.0, 0);
    label('Cable slide', 3.4, -1.7, 1.0);
    label('String stop', 1.0, -5.5, 0);
    label('Arrow rest', 8.0, 4.0, 0.6);
    label('Sight', 2.2, 4.7, 1.3);
    label('Stabilizer', 15.2, -4.8, 0);
    label('Engage grip', 6.5, -0.2, 0.9);

    /* ================= DRAW / REBUILD ================= */
    const nock = empty(root, 'nock', 0.02, D.nockY, 0);
    moving.nock = nock;

    function anchorOf(cam, name, out) {
      const o = cam.getObjectByName(name);
      return o ? o.getWorldPosition(out) : out.set(0, 0, 0);
    }
    function rebuild() {
      root.updateMatrixWorld(true);
      const cT = moving.camTop.getWorldPosition(new THREE.Vector3());
      const cB = moving.camBottom.getWorldPosition(new THREE.Vector3());
      const N = nock.getWorldPosition(new THREE.Vector3());
      const tT = tangentPoint(cT, D.grooveR, N, new THREE.Vector3());
      const tB = tangentPoint(cB, D.grooveR, N, new THREE.Vector3());
      setGeo(stringMesh, G.tube([tT, N, tB], 0.07, 6, 24));
      const up = tT.clone().sub(N).normalize();
      const dn = tB.clone().sub(N).normalize();
      setGeo(serveMesh, G.tube([N.clone().addScaledVector(up, 3.6), N, N.clone().addScaledVector(dn, 3.6)], 0.108, 6, 12));
      peep.position.copy(N).addScaledVector(up, 6.6);
      peep.quaternion.setFromUnitVectors(Z_AXIS, up);
      silTop.position.copy(N).addScaledVector(up, 12.0);
      silBot.position.copy(N).addScaledVector(dn, 12.0);
      nockCyl.position.copy(N).addScaledVector(up, 0.18);
      dloop.position.copy(N).addScaledVector(up, 0.38).add(new THREE.Vector3(0.32, 0, 0));
      const aA = anchorOf(moving.camTop, 'cableAnchorA', new THREE.Vector3());
      const aB = anchorOf(moving.camBottom, 'cableAnchorA', new THREE.Vector3());
      const bA = anchorOf(moving.camTop, 'cableAnchorB', new THREE.Vector3());
      const bB = anchorOf(moving.camBottom, 'cableAnchorB', new THREE.Vector3());
      const gA = D.guard.clone(), gB = D.guard.clone(); gB.z += 0.16;
      setGeo(cableA, G.tube([aA, gA, aB], 0.068, 6, 28));
      setGeo(cableB, G.tube([bA, gB, bB], 0.068, 6, 28));
      arrowGroup.position.copy(N);
    }
    function setDraw(t) {
      t = Math.max(0, Math.min(1, t));
      const camA = THREE.MathUtils.degToRad(210) * t;
      moving.camTop.rotation.z = camA;
      moving.camBottom.rotation.z = -camA;
      const flex = THREE.MathUtils.degToRad(7.5) * t;
      moving.limbTop.rotation.z = flex;
      moving.limbBottom.rotation.z = -flex;
      nock.position.set(0.02 - D.powerStroke * t, D.nockY, 0);
      moving.release.visible = t > 0.55;
      rebuild();
    }

    let tris = 0;
    root.traverse(function (o) {
      if (!o.isMesh || !o.geometry) return;
      if (o.geometry.index) tris += o.geometry.index.count / 3;
      else if (o.geometry.attributes.position) tris += o.geometry.attributes.position.count / 3;
    });
    setDraw(0);
    return { root: root, moving: moving, labels: labels, setDraw: setDraw, rebuild: rebuild, D: D, triangles: Math.round(tris) };
  }
  global.CB_BOW = { build: build, D: D };
})(window);
