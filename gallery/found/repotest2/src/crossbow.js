/* ============================================================================
   GEOMETRY — the physical crossbow, built from the same numbers the physics
   uses.  Local frame:  +X left, +Y up, +Z forward (toward the target).
   ==========================================================================*/
import * as THREE from 'three';

const D2R = Math.PI / 180;
const TAU = Math.PI * 2;

/* ------------------------------------------------------------- materials --- */
export function makeMaterials() {
  const M = {
    carbon: new THREE.MeshPhysicalMaterial({
      color: 0x14171c, roughness: 0.36, metalness: 0.12, clearcoat: 0.85,
      clearcoatRoughness: 0.22, sheen: 0.5, sheenColor: new THREE.Color(0x2a3340),
    }),
    carbonWeave: new THREE.MeshPhysicalMaterial({
      color: 0x1b2028, roughness: 0.44, metalness: 0.2, clearcoat: 0.6,
    }),
    alu: new THREE.MeshStandardMaterial({ color: 0x9aa3ad, roughness: 0.34, metalness: 0.95 }),
    aluDark: new THREE.MeshStandardMaterial({ color: 0x3a4149, roughness: 0.44, metalness: 0.9 }),
    anodized: new THREE.MeshStandardMaterial({ color: 0x22262c, roughness: 0.4, metalness: 0.85 }),
    brass: new THREE.MeshStandardMaterial({ color: 0xb08d4a, roughness: 0.32, metalness: 1.0 }),
    steel: new THREE.MeshStandardMaterial({ color: 0xc9ced6, roughness: 0.2, metalness: 1.0 }),
    string: new THREE.MeshStandardMaterial({ color: 0x2b2b30, roughness: 0.9, metalness: 0.0 }),
    serving: new THREE.MeshStandardMaterial({ color: 0x6d5a2e, roughness: 0.85 }),
    rubber: new THREE.MeshStandardMaterial({ color: 0x15171a, roughness: 0.95 }),
    glass: new THREE.MeshPhysicalMaterial({
      color: 0x223344, roughness: 0.06, metalness: 0.0, transmission: 0.82,
      thickness: 0.02, ior: 1.52, transparent: true, opacity: 0.35,
    }),
    bolt: new THREE.MeshStandardMaterial({ color: 0x1a1d22, roughness: 0.42, metalness: 0.3 }),
    vane: new THREE.MeshStandardMaterial({ color: 0xd8482a, roughness: 0.7, metalness: 0.0, side: THREE.DoubleSide }),
    point: new THREE.MeshStandardMaterial({ color: 0xd7dce3, roughness: 0.14, metalness: 1.0 }),
    target: new THREE.MeshStandardMaterial({ color: 0xe8e4da, roughness: 0.9 }),
    targetRing: new THREE.MeshStandardMaterial({ color: 0x22304a, roughness: 0.85 }),
    ground: new THREE.MeshStandardMaterial({ color: 0x5c6350, roughness: 1.0 }),
  };
  return M;
}

/* -------------------------------------------------------------- helpers ---- */
function roundedRectShape(w, h, r) {
  const s = new THREE.Shape();
  const x = -w / 2, y = -h / 2;
  r = Math.min(r, w / 2, h / 2);
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  return s;
}
function box(w, h, d, mat, r = 0.004) {
  const g = new THREE.ExtrudeGeometry(roundedRectShape(w, h, r), { depth: d, bevelEnabled: true, bevelThickness: 0.0016, bevelSize: 0.0016, bevelSegments: 2, curveSegments: 6 });
  g.translate(0, 0, -d / 2);
  return new THREE.Mesh(g, mat);
}
/* A cam plate whose profile is the true radius schedule rS(theta)/rC(theta). */
function camPlate(p, opts) {
  const { span, rIn, rOut, thickness } = opts;
  const N = 220;
  const shape = new THREE.Shape();
  let first = true;
  for (let i = 0; i <= N; i++) {
    const th = span * i / N;
    const r = rIn + (rOut - rIn) * (0.5 - 0.5 * Math.cos(Math.PI * i / N));
    const a = p.stringAng + th;
    const x = r * Math.cos(a), y = r * Math.sin(a);
    if (first) { shape.moveTo(x, y); first = false; } else shape.lineTo(x, y);
  }
  // close back through the hub
  for (let i = N; i >= 0; i--) {
    const th = span * i / N;
    const r = Math.max(0.022, (rIn + (rOut - rIn) * (0.5 - 0.5 * Math.cos(Math.PI * i / N))) * 0.30);
    const a = p.stringAng + th;
    shape.lineTo(r * Math.cos(a), r * Math.sin(a));
  }
  shape.closePath();
  const g = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false });
  return g;
}

/* --------------------------------------------------------------- build ----- */
export function buildCrossbow(p, curve, M) {
  const root = new THREE.Group();
  root.name = 'crossbow';
  const rowF = curve.rows[0], rowL = curve.rows[curve.rows.length - 1];
  const parts = [];

  const axle = (row) => row.tL;                       // limb tip = cam axle (left)

  /* ---------------- riser: a machined plate carrying both limb pockets ----- */
  const riserW = 0.120, riserH = 0.185, riserD = 0.070;
  const riser = box(riserW, riserH, riserD, M.alu, 0.007);
  riser.position.set(0, 0.052, 0.055);
  riser.castShadow = riser.receiveShadow = true;
  root.add(riser); parts.push(riser);

  // riser window / lightening cut
  const window1 = box(0.062, 0.052, riserD * 1.3, M.aluDark, 0.012);
  window1.position.set(0, 0.060, 0.055);
  root.add(window1);

  /* ---------------- limbs: a split pair per side, root -> axle ------------
     Swept as a closed rectangular section along the limb axis, with eight
     vertices per ring so the shading stays clean at the taper.              */
  const L = { rootX: p.rootX, ang: p.limbAngle0 ?? p.limbAng, len: p.limbLen };
  const limbGroups = [];
  const nSeg = 16;
  const limbY = 0.058;
  const RING = 8;
  for (const side of [1, -1]) {
    for (const vert of [1, -1]) {
      const g = new THREE.Group();
      const y0 = limbY + vert * 0.022;
      const verts = [], idx = [];
      for (let i = 0; i <= nSeg; i++) {
        const t = i / nSeg;
        const rr = L.len * t;
        const cx = side * (L.rootX + rr * Math.cos(L.ang));
        const cz = rr * Math.sin(L.ang);
        const w = (0.062 * (1 - 0.66 * t) + 0.012) / 2;    // half width  (z)
        const h = (0.026 * (1 - 0.58 * t) + 0.005) / 2;    // half height (y)
        // ring in the (y,z) plane: 8 points, counter-clockwise
        for (let k = 0; k < RING; k++) {
          const a = TAU * k / RING;
          verts.push(cx, y0 + h * Math.cos(a), cz + w * Math.sin(a));
        }
      }
      for (let i = 0; i < nSeg; i++) {
        for (let k = 0; k < RING; k++) {
          const a = i * RING + k, b = i * RING + (k + 1) % RING;
          const c = (i + 1) * RING + (k + 1) % RING, d = (i + 1) * RING + k;
          idx.push(a, b, c, a, c, d);
        }
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
      geo.setIndex(idx);
      geo.computeVertexNormals();
      const m = new THREE.Mesh(geo, M.carbon);
      m.castShadow = m.receiveShadow = true;
      g.add(m);
      // limb pocket / clamp at the riser
      const pocket = box(0.078, 0.060, 0.062, M.aluDark, 0.008);
      pocket.position.set(side * (L.rootX + 0.030), y0, 0.014);
      pocket.castShadow = true;
      g.add(pocket);
      for (const dz of [-0.018, 0.018]) {
        const bl = new THREE.Mesh(new THREE.CylinderGeometry(0.0036, 0.0036, 0.034, 8), M.steel);
        bl.rotation.z = Math.PI / 2;
        bl.position.set(side * (L.rootX + 0.030), y0, 0.014 + dz);
        g.add(bl);
      }
      root.add(g);
      limbGroups.push({ g, side, vert });
    }
  }
  // spacer blocks joining each limb pair at the tip, carrying the axle
  for (const side of [1, -1]) {
    const blk = box(0.034, 0.046, 0.036, M.aluDark, 0.005);
    blk.position.set(side * rowF.tL.x, limbY, rowF.tL.z);
    blk.castShadow = true;
    root.add(blk);
  }

  /* ---------------- cams: eccentric discs, built from the real profile -----
     The plate outline is the string-track radius schedule rS(theta) swept over
     the cam's wind, so the shape you see IS the cam the physics solved for.
     Two further tracks are modelled: the cable spool inside it, and the string
     groove on the rim, with the strands visibly wound onto both.            */
  const cams = [];
  for (const side of [1, -1]) {
    const cam = new THREE.Group();
    cam.position.set(side * rowF.tL.x, limbY, rowF.tL.z);

    // --- string track plate (the eccentric outline) ---
    const geo = camPlate(p, { span: p.camSpan, rIn: p.rS1, rOut: p.rS0, thickness: 0.026 });
    const plate = new THREE.Mesh(geo, M.alu);
    plate.rotation.x = -Math.PI / 2;
    plate.position.y = 0.011;
    plate.castShadow = plate.receiveShadow = true;
    cam.add(plate);

    // --- rim flange so the string groove reads as a groove ---
    const flange = new THREE.Mesh(new THREE.TorusGeometry(p.rS0 * 0.995, 0.0055, 8, 64), M.aluDark);
    flange.rotation.x = Math.PI / 2;
    flange.position.y = 0.020;
    cam.add(flange);

    // --- cable spool (inner drum) with its two flanges ---
    const spoolR = Math.max(p.rC0 * 2.2, 0.028);
    const spool = new THREE.Mesh(new THREE.CylinderGeometry(spoolR, spoolR, 0.030, 28), M.aluDark);
    spool.position.y = -0.016;
    cam.add(spool);
    for (const yy of [0.000, -0.032]) {
      const fl = new THREE.Mesh(new THREE.CylinderGeometry(spoolR * 1.16, spoolR * 1.16, 0.004, 28), M.alu);
      fl.position.y = yy;
      cam.add(fl);
    }

    // --- the wound strands: they rotate with the cam, so their number grows
    //     with wind.  Purely visual, but driven by theta. ---
    const wraps = new THREE.Group();
    for (let i = 0; i < 7; i++) {
      const rr = p.rS1 + (p.rS0 - p.rS1) * (i / 6);
      const w = new THREE.Mesh(new THREE.TorusGeometry(rr, 0.0028, 5, 44, Math.PI * 0.55), M.string);
      w.rotation.x = Math.PI / 2;
      w.position.y = 0.021 + i * 0.0006;
      w.rotation.z = -0.5 + i * 0.06;
      wraps.add(w);
    }
    cam.add(wraps);

    // --- axle + hub bolts ---
    const ax = new THREE.Mesh(new THREE.CylinderGeometry(0.0085, 0.0085, 0.086, 18), M.steel);
    cam.add(ax);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.020, 22), M.alu);
    hub.position.y = 0.024;
    cam.add(hub);
    for (let i = 0; i < 5; i++) {
      const b = new THREE.Mesh(new THREE.CylinderGeometry(0.0030, 0.0030, 0.030, 8), M.brass);
      const a = TAU * i / 5 + 0.4;
      b.position.set(Math.cos(a) * 0.0175, 0.028, Math.sin(a) * 0.0175);
      cam.add(b);
    }
    root.add(cam);
    cams.push({ cam, side, wraps });
  }

  /* ---------------- rail / barrel + stock --------------------------------- */
  const railZ0 = -0.42, railZ1 = 0.30, railLen = railZ1 - railZ0;
  const rail = box(0.030, 0.024, railLen, M.alu, 0.004);
  rail.position.set(0, 0.116, (railZ0 + railZ1) / 2);
  rail.castShadow = rail.receiveShadow = true;
  root.add(rail); parts.push(rail);
  // bolt groove
  const groove2 = new THREE.Mesh(new THREE.CylinderGeometry(0.0052, 0.0052, railLen, 12, 1, true, 0, Math.PI), M.aluDark);
  groove2.rotation.z = Math.PI / 2; groove2.rotation.y = Math.PI / 2;
  groove2.position.set(0, 0.129, (railZ0 + railZ1) / 2);
  groove2.material.side = THREE.BackSide;
  root.add(groove2);

  // main stock
  const stock = box(0.052, 0.070, 0.300, M.carbon, 0.012);
  stock.position.set(0, 0.070, -0.235);
  stock.castShadow = stock.receiveShadow = true;
  root.add(stock); parts.push(stock);
  // grip
  const grip = box(0.040, 0.115, 0.058, M.rubber, 0.014);
  grip.position.set(0, -0.012, -0.150);
  grip.rotation.x = -0.26;
  grip.castShadow = true;
  root.add(grip); parts.push(grip);
  // butt plate
  const butt = box(0.048, 0.100, 0.024, M.rubber, 0.008);
  butt.position.set(0, 0.062, -0.392);
  root.add(butt);
  // fore-end
  const fore = box(0.056, 0.040, 0.230, M.carbonWeave, 0.010);
  fore.position.set(0, 0.086, -0.115);
  fore.castShadow = true;
  root.add(fore); parts.push(fore);

  /* ---------------- trigger group ---------------------------------------- */
  const trig = new THREE.Group();
  trig.position.set(0, 0.086, -0.196);
  const housing = box(0.036, 0.046, 0.086, M.aluDark, 0.005);
  trig.add(housing);
  const blade = box(0.010, 0.034, 0.008, M.steel, 0.002);
  blade.position.set(0, -0.030, 0.004); blade.rotation.x = 0.18;
  trig.add(blade);
  // trigger guard
  const guard = new THREE.Mesh(new THREE.TorusGeometry(0.030, 0.0035, 8, 20, Math.PI * 1.1), M.aluDark);
  guard.rotation.y = Math.PI / 2; guard.rotation.z = -0.6;
  guard.position.set(0, -0.018, -0.010);
  trig.add(guard);
  root.add(trig); parts.push(trig);

  // the string latch / claw at the rear of the rail (auto-safety housing)
  const latch = box(0.028, 0.030, 0.036, M.alu, 0.004);
  latch.position.set(0, 0.124, -0.268);
  root.add(latch);

  /* ---------------- scope ------------------------------------------------- */
  const scope = new THREE.Group();
  scope.position.set(0, 0.176, -0.150);
  const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.019, 0.019, 0.210, 24), M.anodized);
  tube.rotation.x = Math.PI / 2;
  tube.castShadow = true;
  scope.add(tube);
  const obj = new THREE.Mesh(new THREE.CylinderGeometry(0.027, 0.022, 0.052, 24), M.anodized);
  obj.rotation.x = Math.PI / 2; obj.position.z = 0.118; scope.add(obj);
  const eye = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.026, 0.044, 24), M.anodized);
  eye.rotation.x = Math.PI / 2; eye.position.z = -0.118; scope.add(eye);
  const lensF = new THREE.Mesh(new THREE.CircleGeometry(0.024, 24), M.glass);
  lensF.position.z = 0.145; scope.add(lensF);
  const lensR = new THREE.Mesh(new THREE.CircleGeometry(0.020, 24), M.glass);
  lensR.position.z = -0.141; lensR.rotation.y = Math.PI; scope.add(lensR);
  // turrets
  for (const [ax, ay] of [[0, 0.026], [0.026, 0]]) {
    const t = new THREE.Mesh(new THREE.CylinderGeometry(0.0085, 0.0085, 0.018, 14), M.anodized);
    t.position.set(ax, ay, 0.0);
    if (ay) t.rotation.x = 0; else t.rotation.z = Math.PI / 2;
    scope.add(t);
  }
  // mounts
  for (const z of [0.055, -0.055]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.021, 0.004, 8, 20), M.alu);
    ring.rotation.y = Math.PI / 2; ring.position.z = z;
    scope.add(ring);
    const post = box(0.016, 0.036, 0.014, M.alu, 0.003);
    post.position.set(0, -0.028, z);
    scope.add(post);
  }
  root.add(scope); parts.push(scope);

  /* ---------------- string stop + dampers + stirrup ---------------------- */
  const stopArm = box(0.014, 0.014, 0.090, M.aluDark, 0.003);
  stopArm.position.set(0, 0.150, -0.020);
  root.add(stopArm);
  const bumper = new THREE.Mesh(new THREE.CylinderGeometry(0.010, 0.010, 0.024, 12), M.rubber);
  bumper.rotation.x = Math.PI / 2; bumper.position.set(0, 0.150, -0.062);
  root.add(bumper);

  for (const side of [1, -1]) {
    const d = box(0.020, 0.016, 0.052, M.rubber, 0.005);
    d.position.set(side * 0.230, 0.058, 0.135);
    d.rotation.y = side * 0.35;
    root.add(d);
  }
  // stirrup at the front for cocking
  const stir = new THREE.Mesh(new THREE.TorusGeometry(0.052, 0.006, 8, 24, Math.PI * 1.35), M.alu);
  stir.rotation.set(Math.PI / 2, 0, Math.PI * 0.18);
  stir.position.set(0, -0.020, 0.115);
  root.add(stir);

  /* ---------------- the string and cables, dynamically updated ----------- */
  const strMat = M.string;
  const cabMat = new THREE.MeshStandardMaterial({ color: 0x3a3f47, roughness: 0.85, metalness: 0.1 });
  const mkSeg = (mat, r, segs = 6) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 1, segs), mat);
    m.castShadow = true;
    return m;
  };
  const stringMeshes = [mkSeg(strMat, 0.0030, 8), mkSeg(strMat, 0.0030, 8)];
  const cableMeshes = [mkSeg(cabMat, 0.0026, 8), mkSeg(cabMat, 0.0026, 8)];
  stringMeshes.forEach(m => root.add(m));
  cableMeshes.forEach(m => root.add(m));

  // serving / centre serving at the nock
  const nockSrv = new THREE.Mesh(new THREE.CylinderGeometry(0.0042, 0.0042, 0.045, 10), M.serving);
  root.add(nockSrv);
  // D-loop + nock set
  const dloop = new THREE.Mesh(new THREE.TorusGeometry(0.008, 0.0018, 6, 14), M.serving);
  root.add(dloop);

  /* ---------------- the bolt -------------------------------------------- */
  const bolt = new THREE.Group();
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(p.shaftR, p.shaftR, p.boltLength, 14), M.bolt);
  shaft.rotation.z = Math.PI / 2;                    // lay along +Z of the group
  shaft.castShadow = true;
  bolt.add(shaft);
  // nock (rear, in the string)
  const nk = new THREE.Mesh(new THREE.CylinderGeometry(0.0052, 0.0046, 0.016, 12), M.serving);
  nk.rotation.z = Math.PI / 2; nk.position.x = -p.boltLength / 2 + 0.008;
  bolt.add(nk);
  // point (front)
  const pt = new THREE.Mesh(new THREE.ConeGeometry(0.0068, 0.042, 16), M.point);
  pt.rotation.z = -Math.PI / 2; pt.position.x = p.boltLength / 2 + 0.021;
  bolt.add(pt);
  const fer = new THREE.Mesh(new THREE.CylinderGeometry(0.0060, 0.0060, 0.010, 12), M.alu);
  fer.rotation.z = Math.PI / 2; fer.position.x = p.boltLength / 2 - 0.002;
  bolt.add(fer);
  // three vanes
  for (let i = 0; i < 3; i++) {
    const v = new THREE.Mesh(new THREE.PlaneGeometry(0.052, 0.018), M.vane);
    const a = TAU * i / 3 + Math.PI / 6;
    v.position.set(-p.boltLength / 2 + 0.045, Math.sin(a) * 0.0, 0);
    v.rotation.y = 0;
    v.rotation.x = 0;
    v.position.y = Math.cos(a) * 0.0075;
    v.position.z = Math.sin(a) * 0.0075;
    v.lookAt(v.position.x, 0, 0);
    bolt.add(v);
  }
  root.add(bolt);

  return {
    root, M, parts, cams, stringMeshes, cableMeshes, bolt, scope,
    nockSrv, dloop, rail, railTopY: 0.128,
    limbGroups,
  };
}

/* Update the whole assembly for a solved mechanism state.  `st` is a row from
   the physics curve, so the render is driven by the same numbers as the maths. */
const _A = new THREE.Vector3(), _B = new THREE.Vector3(), _D = new THREE.Vector3(), _UP = new THREE.Vector3(0, 1, 0);
export function applyState(rig, p, st, boltLoaded) {
  const { cams, stringMeshes, cableMeshes, bolt, nockSrv, dloop } = rig;
  // cams ride on the limb tips and rotate with phi; their wound strands spin too
  for (const { cam, side, wraps } of cams) {
    cam.position.set(side * st.tL.x, 0.058, st.tL.z);
    cam.rotation.y = -side * st.phi;
    if (wraps) wraps.rotation.y = st.theta * 1.5;
  }
  const seg = (mesh, a, b) => {
    _A.set(a.x, a.y, a.z); _B.set(b.x, b.y, b.z);
    _D.subVectors(_B, _A);
    const len = _D.length();
    mesh.position.copy(_A).addScaledVector(_D, 0.5);
    mesh.scale.set(1, len, 1);
    mesh.quaternion.setFromUnitVectors(_UP, _D.normalize());
  };
  // Strand heights follow the cam's own tracks: the string comes off the top of
  // the string groove, the cable off the lower spool, and the nock sits between
  // them at the rail.
  const nockY = rig.railTopY;
  const strY = 0.058 + 0.021;
  const cabY = 0.058 - 0.026;
  const L = st.strL, R = st.strR, nk = st.nock;
  seg(stringMeshes[0], { x: L.x, y: strY, z: L.z }, { x: 0, y: nockY, z: nk.z });
  seg(stringMeshes[1], { x: R.x, y: strY, z: R.z }, { x: 0, y: nockY, z: nk.z });
  nockSrv.position.set(0, nockY, nk.z);
  nockSrv.rotation.set(Math.PI / 2, 0, 0);
  dloop.position.set(0, nockY - 0.013, nk.z);
  dloop.rotation.set(0, Math.PI / 2, 0);

  // the cable is a single straight run between the two cams
  seg(cableMeshes[0], { x: st.cabL.x, y: cabY, z: st.cabL.z }, { x: st.cabR.x, y: cabY, z: st.cabR.z });
  seg(cableMeshes[1], { x: st.cabL.x, y: cabY - 0.011, z: st.cabL.z }, { x: st.cabR.x, y: cabY - 0.011, z: st.cabR.z });

  // bolt rides on the rail, nock against the string
  if (bolt) {
    bolt.visible = boltLoaded;
    bolt.position.set(0, rig.railTopY + 0.004, nk.z + p.boltLength / 2 + 0.010);
  }
}


