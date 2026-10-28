/* 50-tower.js — the iron lady. Everything is generated from the silhouette
   curves below; no models. Registers night lighting + sparkle/beacon updaters. */
function buildTower(scene, renderer) {
  // deck surfaces sit slightly proud of the lattice ends so caps never z-fight
  const DECK_LIFT = 0.22;

  /* ---- materials ---- */
  const ironMat = new THREE.MeshStandardMaterial({
    color: 0x74604b, metalness: 0.5, roughness: 0.46,
    emissive: 0xffa14a, emissiveIntensity: 0,
  });
  const slabMat = new THREE.MeshStandardMaterial({
    color: 0x4d4238, metalness: 0.4, roughness: 0.65,
    emissive: 0xff9a4a, emissiveIntensity: 0,
  });
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0x7fa6b2, metalness: 0.5, roughness: 0.2,
    transparent: true, opacity: 0.45,
    emissive: 0xffcf96, emissiveIntensity: 0.08,
    side: THREE.DoubleSide,
  });
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0x968b7c, metalness: 0.02, roughness: 0.96 });
  const mastMat = new THREE.MeshStandardMaterial({ color: 0xd6d1c6, metalness: 0.85, roughness: 0.35 });

  /* ---- night light rig ---- */
  const upA = new THREE.DirectionalLight(0xffa552, 0);
  upA.position.set(150, -90, 130);
  upA.target.position.set(0, 260, 0);
  scene.add(upA, upA.target);

  const upB = new THREE.DirectionalLight(0xff9a4a, 0);
  upB.position.set(-170, -70, -150);
  upB.target.position.set(0, 220, 0);
  scene.add(upB, upB.target);

  const baseGlow = new THREE.PointLight(0xffb066, 0, 320, 1.8);
  baseGlow.position.set(0, 26, 0);
  scene.add(baseGlow);

  const deckGlow = new THREE.PointLight(0xffbe7a, 0, 190, 1.8);
  deckGlow.position.set(0, 118, 0);
  scene.add(deckGlow);

/* ================================================================== */
/*  THE TOWER                                                         */
/* ================================================================== */

const TOWER_TOP = 300;
const ANTENNA_TOP = 332;

// how far the four corner pillars sit from the centre line
const halfWidth = smoothCurve([
  [0, 62.5], [57.6, 35.0], [115.7, 20.0], [200, 10.4], [276, 6.5], [300, 3.4],
]);
// the side of each corner pillar's square cross-section
const pillarWidth = smoothCurve([
  [0, 20.0], [57.6, 16.0], [115.7, 9.5], [200, 4.2], [276, 2.1], [300, 1.4],
]);
// radius of the main chords
const chordRadius = smoothCurve([
  [0, 1.0], [57.6, 0.58], [115.7, 0.42], [200, 0.34], [300, 0.26],
]);

// horizontal tiers: one panel per step
const lin = (a, b, n) => Array.from({ length: n + 1 }, (_, i) => a + (b - a) * i / n);
const levelsA = lin(0, 57.6, 18);
const levelsB = lin(57.6, 115.7, 14);
const levelsC = lin(115.7, 276, 34);
const levelsD = lin(276, 300, 8);
// the faces above the second floor get large X-braced panels, not a mesh
const faceTiersC = lin(115.7, 276, 14);

// the four faces: outward normal (nx, nz) and tangent (tx, tz)
const frames = [
  { nx: 0, nz: 1, tx: 1, tz: 0 },
  { nx: 1, nz: 0, tx: 0, tz: -1 },
  { nx: 0, nz: -1, tx: -1, tz: 0 },
  { nx: -1, nz: 0, tx: 0, tz: 1 },
];

const segs = [];
const member = (a, b, r) => segs.push({ a, b, r });

/* --- one corner pillar: a square lattice column -------------------- */
function pillarPoints(sx, sz, y) {
  const w = halfWidth(y);
  const c = pillarWidth(y);
  return [
    [sx * w, y, sz * w],
    [sx * (w - c), y, sz * w],
    [sx * (w - c), y, sz * (w - c)],
    [sx * w, y, sz * (w - c)],
  ];
}

function buildPillar(sx, sz, levels) {
  const first = pillarPoints(sx, sz, levels[0]);
  const r0 = chordRadius(levels[0]) * 0.7;
  for (let k = 0; k < 4; k++) member(first[k], first[(k + 1) % 4], r0);

  const lerp3 = (a, b, t) => [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
  ];

  for (let i = 0; i < levels.length - 1; i++) {
    const y0 = levels[i];
    const y1 = levels[i + 1];
    const p = pillarPoints(sx, sz, y0);
    const q = pillarPoints(sx, sz, y1);
    const r = chordRadius((y0 + y1) / 2);
    const cells = clamp(Math.round(pillarWidth((y0 + y1) / 2) / 4.2), 1, 3);

    for (let k = 0; k < 4; k++) {
      const k2 = (k + 1) % 4;
      const pv = [];
      const qv = [];
      for (let j = 0; j <= cells; j++) {
        const t = j / cells;
        pv.push(lerp3(p[k], p[k2], t));
        qv.push(lerp3(q[k], q[k2], t));
      }
      // vertical lattice bars (the outer ones are the main chords)
      for (let j = 0; j <= cells; j++) {
        const isChord = j === 0 || j === cells;
        member(pv[j], qv[j], isChord ? r : r * 0.68);
      }
      // X bracing inside every cell + rail along the top of the panel
      for (let j = 0; j < cells; j++) {
        member(pv[j], qv[j + 1], r * 0.48);
        member(pv[j + 1], qv[j], r * 0.48);
        member(qv[j], qv[j + 1], r * 0.6);
      }
    }
  }
}

for (const levels of [levelsA, levelsB, levelsC, levelsD]) {
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) buildPillar(sx, sz, levels);
  }
}

/* --- face lattice between two pillars ------------------------------ */
function facePoint(fr, u, y) {
  const w = halfWidth(y);
  const c = pillarWidth(y);
  const span = w - c;
  const offset = w - c / 2;
  return [
    fr.tx * u * span + fr.nx * offset,
    y,
    fr.tz * u * span + fr.nz * offset,
  ];
}

/* --- horizontal lattice girder band across a face ------------------- */
function bandGirder(fr, y, depth, segments) {
  const yT = y + depth / 2;
  const yB = y - depth / 2;
  const r = chordRadius(y);
  const span = 2 * (halfWidth(y) - pillarWidth(y));
  const n = Math.max(3, segments || Math.round(span / 3.6));

  const top = [];
  const bot = [];
  for (let j = 0; j <= n; j++) {
    const u = -1 + (2 * j) / n;
    top.push(facePoint(fr, u, yT));
    bot.push(facePoint(fr, u, yB));
  }
  for (let j = 0; j < n; j++) {
    member(top[j], top[j + 1], r * 1.15);  // chords of the girder
    member(bot[j], bot[j + 1], r * 1.15);
    member(top[j], bot[j + 1], r * 0.45);  // zig-zag web
    member(bot[j], top[j + 1], r * 0.45);
  }
  for (let j = 0; j <= n; j += Math.max(1, Math.round(n / 3))) {
    member(top[j], bot[j], r * 0.55);      // posts
  }
}

/* --- open bay between the first and second floors ------------------- */
// The real tower is wide open here: on every face the four legs are tied
// together only by the deep girder that carries the second floor.
function buildOpenBay() {
  for (const fr of frames) bandGirder(fr, 111.3, 4.8, 8);
}

/* --- large open X bracing on the faces above the second floor ------- */
function buildFaceBracing(levels, girderDepth) {
  for (const fr of frames) {
    for (let i = 0; i < levels.length - 1; i++) {
      const y0 = levels[i];
      const y1 = levels[i + 1];
      const r = chordRadius((y0 + y1) / 2);
      member(facePoint(fr, -1, y0), facePoint(fr, 1, y1), r * 1.9);
      member(facePoint(fr, 1, y0), facePoint(fr, -1, y1), r * 1.9);
    }
    for (let i = 1; i < levels.length; i++) bandGirder(fr, levels[i], girderDepth);
  }
}

/* --- the small dense cage at the very summit ------------------------ */
function buildDenseLattice(levels) {
  for (const fr of frames) {
    for (let i = 0; i < levels.length - 1; i++) {
      const y0 = levels[i];
      const y1 = levels[i + 1];
      const h = y1 - y0;
      const span = (halfWidth(y0) - pillarWidth(y0)) + (halfWidth(y1) - pillarWidth(y1));
      const n = clamp(Math.round(span / (h * 1.9)), 1, 9);
      const r = chordRadius((y0 + y1) / 2) * 0.78;

      const at = (u, y) => facePoint(fr, u, y);

      for (let j = 0; j <= n; j++) {
        const u = -1 + 2 * j / n;
        member(at(u, y0), at(u, y1), r * 0.72);
      }
      for (let j = 0; j < n; j++) {
        const u0 = -1 + 2 * j / n;
        const u1 = -1 + 2 * (j + 1) / n;
        member(at(u0, y0), at(u1, y1), r);
        member(at(u1, y0), at(u0, y1), r);
        member(at(u0, y0), at(u1, y0), r * 0.9);
      }
    }
  }
}

buildOpenBay();
buildFaceBracing(faceTiersC, 1.8);
buildDenseLattice(levelsD);

/* --- the great arches under the first floor ------------------------ */
function buildArch(fr) {
  const N = 26;
  const ySpring = 2.5;
  const rise = 50;
  const R = halfWidth(ySpring) - pillarWidth(ySpring);

  const top = [];
  const bot = [];
  for (let i = 0; i <= N; i++) {
    const th = Math.PI * (1 - i / N);
    const sn = Math.sin(th);
    const cs = Math.cos(th);
    const x = R * cs;

    const yT = ySpring + rise * sn;
    const yB = ySpring + (rise - 5) * sn;

    const wT = halfWidth(yT), cT = pillarWidth(yT);
    const wB = halfWidth(yB), cB = pillarWidth(yB);

    const zT = wT - cT / 2;
    const zB = wB - cB / 2;

    top.push([fr.tx * x + fr.nx * zT, yT, fr.tz * x + fr.nz * zT]);
    bot.push([fr.tx * x * 0.985 + fr.nx * zB, yB, fr.tz * x * 0.985 + fr.nz * zB]);
  }

  for (let i = 0; i < N; i++) {
    member(top[i], top[i + 1], 0.55);
    member(bot[i], bot[i + 1], 0.45);
    member(top[i], bot[i + 1], 0.34);
    member(bot[i], top[i + 1], 0.34);
  }
  for (let i = 0; i <= N; i += 3) member(top[i], bot[i], 0.26);
}

for (const fr of frames) buildArch(fr);

/* --- girder under the first floor ---------------------------------- */
for (const y of [54.8, 56.6]) {
  for (const fr of frames) {
    const half = halfWidth(y) - pillarWidth(y);
    const z = halfWidth(y) - pillarWidth(y) / 2;
    const left = [-fr.tx * half + fr.nx * z, y, -fr.tz * half + fr.nz * z];
    const right = [fr.tx * half + fr.nx * z, y, fr.tz * half + fr.nz * z];
    member(left, right, 0.55);
  }
}

/* --- platform railings (thin members, same instanced mesh) ---------- */
function addRailing(y, half, height) {
  const postR = 0.11;
  for (const fr of frames) {
    const n = Math.max(3, Math.round(2 * half / 5));
    let prev = null;
    for (let j = 0; j <= n; j++) {
      const u = -1 + 2 * j / n;
      const x = fr.tx * u * half + fr.nx * half;
      const z = fr.tz * u * half + fr.nz * half;
      member([x, y - 0.15, z], [x, y + height, z], postR * 1.5);
      if (prev) {
        member([prev[0], y + height, prev[2]], [x, y + height, z], postR * 1.1);
        member([prev[0], y + height * 0.55, prev[2]], [x, y + height * 0.55, z], postR * 0.8);
      }
      prev = [x, y, z];
    }
  }
}

const platforms = [
  { y: 57.6, half: 39.0, thickness: 2.8, rail: 2.7 },
  { y: 115.7, half: 23.5, thickness: 2.4, rail: 2.4 },
  { y: 276.0, half: 8.4, thickness: 2.2, rail: 2.0 },
  { y: 300.0, half: 3.6, thickness: 1.5, rail: 1.6 },
];

for (const p of platforms) addRailing(p.y + DECK_LIFT, p.half - 0.8, p.rail);

/* --- build the instanced ironwork ---------------------------------- */
function buildStructure(list) {
  const geo = new THREE.CylinderGeometry(1, 1, 1, 6, 1, false);
  const mesh = new THREE.InstancedMesh(geo, ironMat, list.length);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.frustumCulled = false; // instances span far beyond the unit geometry

  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const dir = new THREE.Vector3();
  const mid = new THREE.Vector3();
  const sc = new THREE.Vector3();

  for (let i = 0; i < list.length; i++) {
    const s = list[i];
    a.fromArray(s.a);
    b.fromArray(s.b);
    dir.subVectors(b, a);
    const len = dir.length();
    if (len < 1e-4) {
      mid.copy(a);
      sc.set(1e-3, 1e-3, 1e-3);
    } else {
      dir.divideScalar(len);
      q.setFromUnitVectors(up, dir);
      mid.addVectors(a, b).multiplyScalar(0.5);
      sc.set(s.r, len, s.r);
    }
    m4.compose(mid, q, sc);
    mesh.setMatrixAt(i, m4);
  }
  mesh.instanceMatrix.needsUpdate = true;
  mesh.name = 'ironwork';
  scene.add(mesh);
  return mesh;
}

buildStructure(segs);

/* --- platform decks, pavilions, piers, summit, antenna -------------- */
function addMesh(geo, mat, x, y, z, rotY = 0) {
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(x, y, z);
  mesh.rotation.y = rotY;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);
  return mesh;
}

for (const p of platforms) {
  const slab = addMesh(new THREE.BoxGeometry(p.half * 2, p.thickness, p.half * 2), slabMat, 0, p.y + DECK_LIFT - p.thickness / 2, 0);
  // The fine lattice shadow aliases into a shimmering dapple at shadow-map
  // resolution, so decks stay out of the shadow lookup (fixes "floor flicker").
  slab.receiveShadow = false;
}

// first floor: four glass pavilions around the perimeter
for (let k = 0; k < 4; k++) {
  const a = k * Math.PI / 2;
  addMesh(new THREE.BoxGeometry(34, 6.5, 5.2), glassMat,
    Math.sin(a) * 33.5, 57.6 + DECK_LIFT - 0.5 + 3.25, Math.cos(a) * 33.5, a);
}
// second floor: a slimmer ring of pavilions
for (let k = 0; k < 4; k++) {
  const a = k * Math.PI / 2;
  addMesh(new THREE.BoxGeometry(16, 5.2, 4.2), glassMat,
    Math.sin(a) * 19.5, 115.7 + DECK_LIFT - 0.5 + 2.6, Math.cos(a) * 19.5, a);
}
// third floor: the glazed cabin and the little lantern over it
addMesh(new THREE.BoxGeometry(8, 6, 8), glassMat, 0, 276 + DECK_LIFT - 0.5 + 3, 0);
addMesh(new THREE.BoxGeometry(4.4, 8, 4.4), glassMat, 0, 285.5, 0);

// masonry piers under the four pillars
for (const sx of [-1, 1]) {
  for (const sz of [-1, 1]) {
    addMesh(new THREE.BoxGeometry(18, 6.5, 18), stoneMat, sx * 55, 3.25, sz * 55);
  }
}

// antenna mast on the summit
addMesh(new THREE.CylinderGeometry(0.34, 0.95, 26, 10), mastMat, 0, 312.6, 0);
addMesh(new THREE.CylinderGeometry(0.1, 0.34, 6, 8), mastMat, 0, 328.4, 0);
for (const [y, w] of [[305, 3.6], [311, 2.9], [317, 2.4], [323, 1.9]]) {
  addMesh(new THREE.BoxGeometry(w, 0.16, w * 0.32), mastMat, 0, y, 0);
}

const beaconMat = new THREE.MeshBasicMaterial({ color: 0xff3b2f, transparent: true, opacity: 0.2 });
const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.55, 12, 10), beaconMat);
beacon.position.set(0, 331.95, 0);
scene.add(beacon);

/* ------------------------------------------------------------------ */
/*  sparkle: the tower's hourly shimmer                               */
/* ------------------------------------------------------------------ */
const sparkleMat = new THREE.ShaderMaterial({
  transparent: true,
  depthWrite: false,
  depthTest: false,
  blending: THREE.AdditiveBlending,
  uniforms: {
    uTime: { value: 0 },
    uPixel: { value: 1 },
    uOpacity: { value: 0 },
  },
  vertexShader: /* glsl */`
    attribute float aPhase;
    uniform float uTime;
    uniform float uPixel;
    varying float vAlpha;
    void main() {
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      gl_Position = projectionMatrix * mv;
      float tw = sin(uTime * 3.0 + aPhase * 6.2831853);
      vAlpha = smoothstep(0.15, 1.0, tw);
      gl_PointSize = (1.8 + 2.6 * tw) * uPixel * (460.0 / max(1.0, -mv.z));
    }
  `,
  fragmentShader: /* glsl */`
    uniform float uOpacity;
    varying float vAlpha;
    void main() {
      float d = length(gl_PointCoord - 0.5);
      float a = smoothstep(0.5, 0.0, d);
      gl_FragColor = vec4(vec3(1.0, 0.82, 0.55), a * vAlpha * uOpacity);
    }
  `,
});

{
  const count = 2600;
  const pos = new Float32Array(count * 3);
  const phase = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    let s = segs[(Math.random() * segs.length) | 0];
    for (let tries = 0; tries < 6; tries++) {
      if ((s.a[1] + s.b[1]) * 0.5 > 22) break;
      s = segs[(Math.random() * segs.length) | 0];
    }
    const t = Math.random();
    pos[i * 3 + 0] = s.a[0] + (s.b[0] - s.a[0]) * t;
    pos[i * 3 + 1] = s.a[1] + (s.b[1] - s.a[1]) * t;
    pos[i * 3 + 2] = s.a[2] + (s.b[2] - s.a[2]) * t;
    phase[i] = Math.random();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));
  const sparkles = new THREE.Points(geo, sparkleMat);
  sparkles.frustumCulled = false;
  scene.add(sparkles);
}

  registerEnv((t) => {
    upA.intensity = t * 3.2;
    upB.intensity = t * 2.2;
    baseGlow.intensity = t * 2600;
    deckGlow.intensity = t * 900;
    ironMat.emissiveIntensity = t * 0.38;
    slabMat.emissiveIntensity = t * 0.12;
    glassMat.emissiveIntensity = mix(0.08, 0.85, t);
    sparkleMat.uniforms.uOpacity.value = t * 0.85;
  });

  registerUpdater((dt, elapsed) => {
    const pulse = 0.5 + 0.5 * Math.sin(elapsed * 2.6);
    beaconMat.opacity = (0.15 + 0.85 * ENV.night) * (0.35 + 0.65 * pulse);
    beacon.scale.setScalar(0.85 + pulse * 0.3);
    sparkleMat.uniforms.uTime.value = elapsed;
    sparkleMat.uniforms.uPixel.value = renderer.getPixelRatio();
  });
}
