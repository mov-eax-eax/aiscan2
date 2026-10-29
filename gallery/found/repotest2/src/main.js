/* ============================================================================
   SCENE + INTERACTION
   The mechanism is driven by the physics core; the shot is a real 3-D
   integration of the bolt with quadratic drag, and the sights are solved from
   that ballistics, not faked.
   ==========================================================================*/
import * as THREE from 'three';
import { buildMachine, flight, trajectory, sightSetting, dragK, DESIGN, M2IN, N2LBF, J2FTLB, MS2FPS, R2D, G } from './core.js';
import { makeMaterials, buildCrossbow, applyState } from './crossbow.js';

/* ---------------------------------------------------------------- setup ---- */
const canvas = document.getElementById('view');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x9fb3c8, 40, 260);

const camera = new THREE.PerspectiveCamera(38, 1, 0.02, 600);

/* procedural sky-ish environment so metal has something to reflect */
{
  const pmrem = new THREE.PMREMGenerator(renderer);
  const sky = new THREE.Scene();
  const geo = new THREE.SphereGeometry(60, 24, 16);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: { top: { value: new THREE.Color(0x7fa8d8) }, bot: { value: new THREE.Color(0xd8d2c4) }, gnd: { value: new THREE.Color(0x4a4f42) } },
    vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader: `varying vec3 vP; uniform vec3 top,bot,gnd;
      void main(){ float h = normalize(vP).y;
        vec3 c = h>0.0 ? mix(bot,top,pow(h,0.7)) : mix(bot,gnd,pow(-h,0.5));
        gl_FragColor = vec4(c,1.0); }`,
  });
  sky.add(new THREE.Mesh(geo, mat));
  const env = pmrem.fromScene(sky, 0.04).texture;
  scene.environment = env;
}
scene.background = new THREE.Color(0x9fb3c8);

/* lights: a key sun with a tight shadow frustum around the machine */
const sun = new THREE.DirectionalLight(0xfff2e0, 3.1);
sun.position.set(-2.4, 3.4, -1.8);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.near = 0.5; sun.shadow.camera.far = 14;
sun.shadow.camera.left = -1.6; sun.shadow.camera.right = 1.6;
sun.shadow.camera.top = 1.6; sun.shadow.camera.bottom = -1.6;
sun.shadow.bias = -0.0008;
scene.add(sun);
scene.add(new THREE.HemisphereLight(0xbcd3ee, 0x4b4636, 1.5));
const rim = new THREE.DirectionalLight(0xa8c8ff, 1.1);
rim.position.set(3.0, 1.6, 3.2);
scene.add(rim);

/* ground */
const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshStandardMaterial({ color: 0x59614c, roughness: 0.98 }));
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

/* --------------------------------------------------------------- machine --- */
const machine = buildMachine();
const { p, curve, shot } = machine;
const M = makeMaterials();
const rig = buildCrossbow(p, curve, M);
const gun = new THREE.Group();
gun.add(rig.root);
/* Everything is authored in the range frame directly: the machine sits at the
   origin (rail on the Z axis, +Z downrange) so world coordinates ARE shooting
   coordinates and no offset ever has to be subtracted again. */
gun.position.set(0, 0, 0);
scene.add(gun);

/* ------------------------------------------------------------ the range ---- */
const RANGE_M = 70;
function buildTarget(dist) {
  const g = new THREE.Group();
  const face = new THREE.Mesh(new THREE.CircleGeometry(0.30, 40), M.target);
  g.add(face);
  for (const [r, col] of [[0.30, 0x22304a], [0.24, 0xe8e4da], [0.18, 0x22304a], [0.12, 0xe8e4da], [0.06, 0xb02a1e]]) {
    const ring = new THREE.Mesh(new THREE.RingGeometry(Math.max(r - 0.028, 0.001), r, 48), new THREE.MeshStandardMaterial({ color: col, roughness: 0.9, side: THREE.DoubleSide }));
    ring.position.z = 0.002;
    g.add(ring);
  }
  const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.03, 1.1, 12), M.aluDark);
  stand.position.y = -0.30; g.add(stand);
  g.position.set(0, 0.62, dist);
  return g;
}
const target = buildTarget(50);
scene.add(target);
const target2 = buildTarget(70);
target2.scale.setScalar(1.25);
scene.add(target2);

/* distance markers */
const marks = new THREE.Group();
for (let d = 10; d <= 70; d += 10) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.02, 0.9), new THREE.MeshStandardMaterial({ color: 0xcfd6dd, roughness: 0.9 }));
  m.position.set(-1.6, 0.012, d);
  marks.add(m);
}
scene.add(marks);

/* --------------------------------------------------------- trajectory ----- */
const trajMat = new THREE.LineBasicMaterial({ color: 0x66e0ff, transparent: true, opacity: 0.9 });
const trajGeo = new THREE.BufferGeometry();
const trajLine = new THREE.Line(trajGeo, trajMat);
scene.add(trajLine);

const boltVisual = rig.bolt;

/* -------------------------------------------------------------- camera ----- */
const OrbitCtl = class {
  constructor(cam, dom) {
    this.cam = cam; this.dom = dom;
    this.target = new THREE.Vector3(0, 1.05, 0.1);
    this.sph = new THREE.Spherical(1.15, 1.15, -0.9);
    this.tSph = this.sph.clone();
    this.dragging = 0; this.px = 0; this.py = 0;
    this.auto = 0;
    dom.addEventListener('pointerdown', e => { this.dragging = e.button === 2 ? 2 : 1; this.px = e.clientX; this.py = e.clientY; dom.setPointerCapture(e.pointerId); });
    dom.addEventListener('pointerup', e => { this.dragging = 0; });
    dom.addEventListener('pointermove', e => {
      if (!this.dragging) return;
      const dx = e.clientX - this.px, dy = e.clientY - this.py;
      this.px = e.clientX; this.py = e.clientY;
      if (this.dragging === 1) { this.tSph.theta -= dx * 0.005; this.tSph.phi = Math.max(0.06, Math.min(Math.PI - 0.06, this.tSph.phi - dy * 0.005)); }
      else { const s = this.tSph.radius * 0.0016; const fwd = new THREE.Vector3().subVectors(this.target, this.cam.position).setY(0).normalize(); const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), fwd); this.target.addScaledVector(right, dx * s).addScaledVector(new THREE.Vector3(0, 1, 0), dy * s); this.tSph.radius = Math.min(60, this.tSph.radius); }
    });
    dom.addEventListener('wheel', e => { e.preventDefault(); this.tSph.radius = Math.max(0.35, Math.min(60, this.tSph.radius * (1 + Math.sign(e.deltaY) * 0.12))); }, { passive: false });
    dom.addEventListener('contextmenu', e => e.preventDefault());
  }
  set(pos, tgt, fov) {
    this.target.set(tgt[0], tgt[1], tgt[2]);
    const d = new THREE.Vector3(pos[0] - tgt[0], pos[1] - tgt[1], pos[2] - tgt[2]);
    this.tSph.setFromVector3(d);
    this.sph.copy(this.tSph);
    if (fov) { this.cam.fov = fov; this.cam.updateProjectionMatrix(); }
    this.snap();
  }
  snap() { this.sph.copy(this.tSph); }
  update(dt) {
    this.sph.theta += (this.tSph.theta - this.sph.theta) * Math.min(1, dt * 12);
    this.sph.phi += (this.tSph.phi - this.sph.phi) * Math.min(1, dt * 12);
    this.sph.radius += (this.tSph.radius - this.sph.radius) * Math.min(1, dt * 12);
    const o = new THREE.Vector3().setFromSpherical(this.sph);
    this.cam.position.copy(this.target).add(o);
    this.cam.lookAt(this.target);
  }
};
const controls = new OrbitCtl(camera, renderer.domElement);

/* -------------------------------------------------------------- views ------ */
/* The machine sits at the origin with the rail at y = 0.128, so the framing
   target is (0, 0.13, 0) for close work. */
const VIEWS = {
  full:    { pos: [-1.75, 0.95, -2.30], tgt: [0, 0.16, -0.10], fov: 38 },
  action:  { pos: [0.95, 0.62, -1.30], tgt: [0.10, 0.15, -0.18], fov: 42 },
  side:    { pos: [-1.70, 0.26, -0.06], tgt: [0, 0.13, -0.06], fov: 30 },
  top:     { pos: [0.0, 1.55, -0.02], tgt: [0, 0.13, -0.02], fov: 34 },
  cam:     { pos: [-0.30, 0.46, -0.30], tgt: [-0.30, 0.13, 0.05], fov: 32 },
  riser:   { pos: [-0.44, 0.34, 0.34], tgt: [-0.18, 0.12, -0.28], fov: 34 },
  trigger: { pos: [-0.24, 0.19, -0.62], tgt: [0, 0.12, -0.30], fov: 30 },
  string:  { pos: [-0.52, 0.58, -0.36], tgt: [0.04, 0.13, -0.10], fov: 34 },
  range:   { pos: [-0.95, 0.95, -1.60], tgt: [0, 0.25, 6], fov: 34 },
  downrange: { pos: [0.02, 0.32, 47.6], tgt: [0, 0.90, 50], fov: 22 },
};
function view(name, over) {
  const v = { ...(VIEWS[name] || VIEWS.full), ...(over || {}) };
  controls.tSph.setFromVector3(new THREE.Vector3(v.pos[0] - v.tgt[0], v.pos[1] - v.tgt[1], v.pos[2] - v.tgt[2]));
  controls.target.set(v.tgt[0], v.tgt[1], v.tgt[2]);
  if (v.fov) { camera.fov = v.fov; camera.updateProjectionMatrix(); }
}

/* ------------------------------------------------------------ shot logic --- */
const state = {
  drawn: 0,            // 0..1 fraction of the power stroke
  phase: 'brace',      // brace | drawing | hold | loose | flight | impact
  boltLoaded: true,
  boltPos: new THREE.Vector3(),
  boltVel: new THREE.Vector3(),
  boltSpin: 0,
  timeScale: 1,
  slowmo: false,
  showTrajectory: true,
  zeroRange: 50,
  sightClicks: 0,
  windSpeed: 0,
  arrowFlex: 0,
  flightT: 0,
  shots: 0,
  lastImpact: null,
  trail: [],
};

function currentState() {
  const i = Math.min(curve.rows.length - 1, Math.max(0, Math.round(state.drawn * (curve.rows.length - 1))));
  return curve.rows[i];
}

/* Full 3-D integration of the bolt: quadratic drag, gravity, wind.
   Slow-motion just scales dt, so the physics stays exact. */
function stepBolt(dt) {
  const k = dragK(p);
  const v = state.boltVel;
  const windX = state.windSpeed * Math.cos(0);
  const rel = new THREE.Vector3(v.x - windX, v.y, v.z);
  const sp = rel.length();
  const acc = rel.clone().multiplyScalar(-k * sp);
  acc.y -= G;
  v.addScaledVector(acc, dt);
  state.boltPos.addScaledVector(v, dt);
  state.boltSpin += dt * 2.0;
  // de-spine visual: the shaft whips at its free-free frequency on launch
  state.arrowFlex = Math.exp(-state.flightT * 9) * Math.sin(state.flightT * shot.spineHz * 2 * Math.PI) * 0.004;
}

function launch() {
  const st = currentState();
  const F = st.F;
  const v0 = shot.v;
  // sight elevation for the selected zero, plus any clicks dialled on
  const s = flight(v0, state.zeroRange, p);
  const extra = (state.sightClicks / 4) / 60 * Math.PI / 180;
  const ang = s.angleDeg / R2D + extra;
  state.boltVel.set(0, v0 * Math.sin(ang), v0 * Math.cos(ang));
  state.boltPos.set(0, rig.railTopY + 0.006, st.nock.z + p.boltLength / 2 + 0.02);
  state.phase = 'flight';
  state.flightT = 0;
  state.trail = [{ x: state.boltPos.x, y: state.boltPos.y, z: state.boltPos.z }];
  state.shots++;
  sfx.loose(v0);
}

/* --------------------------------------------------------------- sound ----- */
const sfx = (() => {
  let ctx = null;
  const get = () => { if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)(); return ctx; };
  const noise = (dur) => {
    const c = get(), n = Math.floor(c.sampleRate * dur), buf = c.createBuffer(1, n, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 2);
    const src = c.createBufferSource(); src.buffer = buf; return src;
  };
  return {
    resume() { const c = get(); if (c.state === 'suspended') c.resume(); },
    loose(v0) {
      const c = get(), t = c.currentTime;
      // string release: filtered noise burst + a low thump
      const n = noise(0.16); const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1500; bp.Q.value = 0.8;
      const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.5, t + 0.003); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
      n.connect(bp).connect(g).connect(c.destination); n.start(t);
      const o = c.createOscillator(); o.type = 'triangle'; o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(52, t + 0.18);
      const g2 = c.createGain(); g2.gain.setValueAtTime(0.35, t); g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
      o.connect(g2).connect(c.destination); o.start(t); o.stop(t + 0.24);
      // limb resonance ring
      const o2 = c.createOscillator(); o2.type = 'sine'; o2.frequency.value = 96;
      const g3 = c.createGain(); g3.gain.setValueAtTime(0.12, t + 0.01); g3.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
      o2.connect(g3).connect(c.destination); o2.start(t + 0.01); o2.stop(t + 0.72);
    },
    thud(delay) {
      const c = get(), t = c.currentTime + delay;
      const o = c.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(120, t); o.frequency.exponentialRampToValueAtTime(48, t + 0.2);
      const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.45, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
      o.connect(g).connect(c.destination); o.start(t); o.stop(t + 0.32);
    },
  };
})();

/* ------------------------------------------------------------ draw logic --- */
const DRAW_RATE = 1.25;      // fraction of stroke per second when cocking
function updateDraw(dt) {
  if (state.phase === 'posed') { /* held at a posed draw, for inspection */ }
  if (state.phase === 'drawing') {
    state.drawn = Math.min(1, state.drawn + DRAW_RATE * dt);
    if (state.drawn >= 1) state.phase = 'hold';
  }
  if (state.phase === 'loose') {
    state.drawn = Math.max(0, state.drawn - 7.5 * dt);
    if (state.drawn <= 0) { state.phase = 'brace'; state.boltLoaded = false; }
  }
}
function fire() {
  if (state.phase !== 'hold' || !state.boltLoaded) return;
  state.phase = 'loose';
  launch();
}

/* ------------------------------------------------------------ HUD wiring -- */
const H = {
  draw: document.getElementById('h-draw'),
  force: document.getElementById('h-force'),
  hold: document.getElementById('h-hold'),
  let: document.getElementById('h-let'),
  energy: document.getElementById('h-energy'),
  speed: document.getElementById('h-speed'),
  ke: document.getElementById('h-ke'),
  tof: document.getElementById('h-tof'),
  drop: document.getElementById('h-drop'),
  moa: document.getElementById('h-moa'),
  phase: document.getElementById('h-phase'),
  chart: document.getElementById('chart'),
  status: document.getElementById('status'),
};
const ctx2d = H.chart.getContext('2d');
H.chart.width = 420; H.chart.height = 150;

function drawChart() {
  const w = H.chart.width, h = H.chart.height, pad = 26;
  ctx2d.clearRect(0, 0, w, h);
  ctx2d.fillStyle = 'rgba(8,12,18,0.72)'; ctx2d.fillRect(0, 0, w, h);
  const fmax = curve.peakF * 1.08;
  const X = s => pad + (s / p.powerStroke) * (w - pad - 8);
  const Y = f => h - 18 - (f / fmax) * (h - 30);
  // grid
  ctx2d.strokeStyle = 'rgba(120,150,180,0.22)'; ctx2d.lineWidth = 1;
  for (let i = 0; i <= 4; i++) { const y = 12 + i * (h - 30) / 4; ctx2d.beginPath(); ctx2d.moveTo(pad, y); ctx2d.lineTo(w - 8, y); ctx2d.stroke(); }
  // curve
  ctx2d.beginPath();
  curve.rows.forEach((r, i) => { const x = X(r.s), y = Y(r.F); i ? ctx2d.lineTo(x, y) : ctx2d.moveTo(x, y); });
  ctx2d.strokeStyle = '#4fd1ff'; ctx2d.lineWidth = 2.2; ctx2d.stroke();
  // fill under
  ctx2d.lineTo(X(curve.rows[curve.rows.length - 1].s), h - 18); ctx2d.lineTo(pad, h - 18); ctx2d.closePath();
  ctx2d.fillStyle = 'rgba(79,209,255,0.13)'; ctx2d.fill();
  // peak marker
  const pk = curve.peak;
  ctx2d.strokeStyle = 'rgba(255,196,80,0.9)'; ctx2d.setLineDash([4, 3]);
  ctx2d.beginPath(); ctx2d.moveTo(X(pk.s), Y(pk.F)); ctx2d.lineTo(X(pk.s), h - 18); ctx2d.stroke(); ctx2d.setLineDash([]);
  // current draw marker
  const st = currentState();
  ctx2d.fillStyle = '#ffd24a';
  ctx2d.beginPath(); ctx2d.arc(X(st.s), Y(st.F), 4, 0, Math.PI * 2); ctx2d.fill();
  // labels
  ctx2d.fillStyle = 'rgba(190,215,240,0.9)'; ctx2d.font = '10px ui-monospace, monospace';
  ctx2d.fillText(`${(pk.F * N2LBF).toFixed(0)} lbf peak @ ${(curve.peakFrac * 100).toFixed(0)}%`, pad + 2, 11);
  ctx2d.fillText(`hold ${(curve.holdLbf).toFixed(0)} lbf  (${(curve.letOff * 100).toFixed(0)}% let-off)`, pad + 2, h - 6);
  ctx2d.fillText('0', pad - 2, h - 22);
  // axis ticks
  ctx2d.strokeStyle = 'rgba(120,150,180,0.35)';
  ctx2d.beginPath(); ctx2d.moveTo(pad, h - 18); ctx2d.lineTo(w - 8, h - 18); ctx2d.stroke();
  ctx2d.fillText((p.powerStroke * M2IN).toFixed(0) + ' in', w - 40, h - 6);
}

/* -------------------------------------------------------------- input ----- */
window.addEventListener('keydown', e => {
  const k = e.key.toLowerCase();
  if (k === ' ') { e.preventDefault(); if (state.phase === 'brace') { state.phase = 'drawing'; state.boltLoaded = true; sfx.resume(); } else fire(); }
  if (k === 'f') { if (state.phase === 'hold') fire(); }
  if (k === 'r') { if (state.phase === 'brace' || state.phase === 'flight' || state.phase === 'impact') reset(); }
  if (k === 's') { state.slowmo = !state.slowmo; state.timeScale = state.slowmo ? 0.06 : 1; }
  if (k === 't') { state.showTrajectory = !state.showTrajectory; }
  if (k === 'c') { state.zeroRange = state.zeroRange === 50 ? 30 : state.zeroRange === 30 ? 20 : 50; }
  if (k === 'arrowup') { state.sightClicks += 1; }
  if (k === 'arrowdown') { state.sightClicks -= 1; }
  if (k === 'arrowleft') { state.windSpeed = Math.max(-9, state.windSpeed - 0.5); }
  if (k === 'arrowright') { state.windSpeed = Math.min(9, state.windSpeed + 0.5); }
});

document.querySelectorAll('[data-view]').forEach(b => b.addEventListener('click', () => { view(b.dataset.view); setActive(b); }));
function setActive(btn) { document.querySelectorAll('[data-view]').forEach(b => b.classList.toggle('on', b === btn)); }

const btnCock = document.getElementById('b-cock');
const btnFire = document.getElementById('b-fire');
const btnReset = document.getElementById('b-reset');
const btnSlow = document.getElementById('b-slow');
const drag = document.getElementById('drag');
btnCock.addEventListener('click', () => { if (state.phase === 'brace') { state.phase = 'drawing'; state.boltLoaded = true; sfx.resume(); } });
btnFire.addEventListener('click', fire);
btnReset.addEventListener('click', reset);
btnSlow.addEventListener('click', () => { state.slowmo = !state.slowmo; state.timeScale = state.slowmo ? 0.06 : 1; btnSlow.classList.toggle('on', state.slowmo); });
/* Only a REAL user drag on the slider may drive the draw; the slider is also
   written every frame to mirror state, and feeding that back would fight the
   mechanism (it would snap the draw to whatever the last frame rendered). */
drag.addEventListener('input', () => {
  if (!state.dragLive) return;
  state.phase = state.drawn >= 1 ? 'hold' : 'drawing';
  state.boltLoaded = true;
  sfx.resume();
});
drag.addEventListener('pointerdown', () => { state.dragLive = true; });
window.addEventListener('pointerup', () => { state.dragLive = false; });
drag.addEventListener('keydown', () => { state.dragLive = true; });
drag.addEventListener('blur', () => { state.dragLive = false; });

/* dragging the string itself on the canvas also draws the bow */
let dragging = false;
canvas.addEventListener('pointerdown', e => {
  const rect = canvas.getBoundingClientRect();
  if (e.clientY - rect.top < 90) return;         // leave the top strip for the toolbar
  if (state.phase !== 'brace') return;
  dragging = true; state.phase = 'drawing'; state.boltLoaded = true; sfx.resume();
});
window.addEventListener('pointermove', e => { if (dragging) state.drawn = Math.min(1, state.drawn + 0.006); if (dragging && state.drawn >= 1) { state.phase = 'hold'; dragging = false; } });
window.addEventListener('pointerup', () => { dragging = false; });

function reset() {
  state.drawn = 0; state.phase = 'brace'; state.boltLoaded = true;
  state.trail = []; state.boltPos.set(0, 0, -999);
  state.shots = 0; state.sightClicks = 0; state.lastImpact = null;
  trajLine.visible = false;
}

/* -------------------------------------------------------------- loop ------ */
let last = performance.now();
let fps = 0, fpsAcc = 0, fpsN = 0;
function tick(now) {
  const raw = Math.min((now - last) / 1000, 0.05);
  last = now;
  fpsAcc += raw; fpsN++;
  if (fpsAcc > 0.4) { fps = fpsN / fpsAcc; fpsAcc = 0; fpsN = 0; }

  let dt = raw;
  if (state.phase === 'flight') {
    dt = raw * state.timeScale;
    const sub = 6;
    for (let i = 0; i < sub; i++) stepBolt(dt / sub);
    state.flightT += dt;
    // trail
    if (state.trail.length < 4000) state.trail.push({ x: state.boltPos.x, y: state.boltPos.y, z: state.boltPos.z });
    // impact test
    for (const [tg, dist] of [[target, 50], [target2, 70]]) {
      if (state.boltPos.z >= dist && state.boltPos.z < dist + 0.4 && Math.abs(state.boltPos.x) < 0.62 && Math.abs(state.boltPos.y - tg.position.y) < 0.62) {
        state.phase = 'impact'; state.lastImpact = { z: state.boltPos.z, x: state.boltPos.x, y: state.boltPos.y, v: state.boltVel.length(), dist };
        sfx.thud(0.06 * (1 / state.timeScale) * 0.06);
        break;
      }
    }
    if (state.boltPos.y < 0 || state.boltPos.z > 200) state.phase = 'brace';
  } else {
    state.drawn = state.phase === 'hold' ? state.drawn : state.drawn;
  }
  updateDraw(raw);

  const st = currentState();
  applyState(rig, p, st, state.boltLoaded && state.phase !== 'flight' && state.phase !== 'impact');

  // bolt visual during flight
  if (state.phase === 'flight' || state.phase === 'impact') {
    boltVisual.visible = true;
    boltVisual.position.set(state.boltPos.x, state.boltPos.y, state.boltPos.z);
    const dir = state.boltVel.clone().normalize();
    boltVisual.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), dir);
    boltVisual.rotateX(state.boltSpin);
  }

  // trajectory line
  if (state.showTrajectory && (state.phase === 'flight' || state.phase === 'impact')) {
    const arr = new Float32Array(state.trail.length * 3);
    state.trail.forEach((q, i) => { arr[i * 3] = q.x; arr[i * 3 + 1] = q.y; arr[i * 3 + 2] = q.z; });
    trajGeo.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    trajGeo.computeBoundingSphere();
    trajLine.visible = true;
  } else trajLine.visible = false;

  // camera follows the bolt in flight
  if (state.phase === 'flight' && state.trail.length % 3 === 0) {
    const bp = state.boltPos;
    const behind = Math.min(3.2, 0.5 + state.flightT * 1.4);
    controls.target.lerp(new THREE.Vector3(bp.x * 0.3, bp.y, bp.z), Math.min(1, raw * 6));
    controls.tSph.radius += (behind - controls.tSph.radius) * Math.min(1, raw * 2);
  }

  controls.update(raw);

  // HUD
  H.draw.textContent = `${(st.s * M2IN).toFixed(2)} in`;
  H.force.textContent = `${(st.F * N2LBF).toFixed(1)} lbf`;
  H.hold.textContent = `${(curve.holdLbf).toFixed(1)} lbf`;
  H.let.textContent = `${(curve.letOff * 100).toFixed(0)} %`;
  H.energy.textContent = `${(0.5 * p.kSpring * st.beta * st.beta).toFixed(1)} J`;
  H.phase.textContent = state.phase;
  if (state.phase === 'flight' || state.phase === 'impact') {
    const z = state.boltPos.z;
    const v = state.boltVel.length();
    H.speed.textContent = `${v.toFixed(1)} m/s  (${(v * MS2FPS).toFixed(0)} fps)`;
    H.ke.textContent = `${(0.5 * p.boltMass * v * v).toFixed(1)} J`;
    const f = flight(shot.v, Math.max(z, 0.01), p);
    H.tof.textContent = `${f.time.toFixed(3)} s`;
    H.drop.textContent = `${(f.drop * 100).toFixed(1)} cm`;
    H.moa.textContent = `${sightSetting(shot.v, Math.max(z, 0.01), p, state.zeroRange).moa.toFixed(1)} MOA`;
  } else {
    H.speed.textContent = `${shot.v.toFixed(1)} m/s  (${shot.vFps.toFixed(0)} fps)`;
    H.ke.textContent = `${shot.ke.toFixed(1)} J`;
    H.tof.textContent = '—';
    H.drop.textContent = '—';
    H.moa.textContent = `${state.sightClicks} clicks`;
  }
  H.status.textContent = `${fps.toFixed(0)} fps · ${state.windSpeed.toFixed(1)} m/s wind · zero ${state.zeroRange} m`;
  drag.value = Math.round(state.drawn * 1000);
  window.__BOLT__ = {
    z: state.boltPos.z, y: state.boltPos.y, x: state.boltPos.x,
    v: state.boltVel.length(), phase: state.phase, t: state.flightT,
  };

  drawChart();
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}

function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h; camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
resize();
view('action');
controls.snap();
state.boltPos.set(0, 0.2, -999);
requestAnimationFrame(tick);

/* expose for the offline harness */
window.__READY__ = true;
window.__set = (o) => { Object.assign(state, o); if (o.view) view(o.view); };
window.__view = view;
window.__camFree = (pos, tgt, fov) => {
  controls.tSph.setFromVector3(new THREE.Vector3(pos[0] - tgt[0], pos[1] - tgt[1], pos[2] - tgt[2]));
  controls.target.set(tgt[0], tgt[1], tgt[2]);
  if (fov) { camera.fov = fov; camera.updateProjectionMatrix(); }
  controls.snap();
};
window.__fire = fire;
window.__cock = () => { state.phase = 'drawing'; state.boltLoaded = true; };
window.__reset = reset;
window.__seek = (f) => { state.phase = f >= 1 ? 'hold' : 'posed'; state.drawn = f; };
window.__BOLT__ = null;
window.__state = () => ({ drawn: state.drawn, phase: state.phase, ts: state.timeScale });
window.__STATS__ = {
  peakLbf: curve.peakLbf, holdLbf: curve.holdLbf, letOff: curve.letOff,
  energy: curve.energy, vFps: shot.vFps, ke: shot.ke, eff: shot.efficiency,
  strokeIn: curve.strokeIn, tipTravel: curve.tipTravel, camRot: curve.rows[curve.rows.length - 1].camRotDeg,
  energyResidual: curve.energyResidualFrac,
};
console.log('STATS', JSON.stringify(window.__STATS__));







