/* Scene, cameras and UI for the recurve bow.

   Deliberately not simulated. There is no draw-force solver, no limb
   deflection model, no verification pass - the bow is drawn at brace, which is
   the pose you actually look at a bow in. Everything here is shape.

   The shot harness drives this through window.__view / window.__set and waits
   on window.__READY__, same contract as the previous attempt. */
import * as THREE from '../../vendor/three.module.js';
import { buildRiser } from './riser.js';
import { buildLimb, buildString } from './limbs.js';
import {
  buildSight, buildStabilisers, buildRiserFurniture, buildArrow, buildStand,
} from './accessories.js';

const canvas = document.getElementById('view');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xd2d7dc);

/* ---------------------------------------------------------------- light -- */

scene.add(new THREE.HemisphereLight(0xffffff, 0x9aa0a8, 1.15));

const key = new THREE.DirectionalLight(0xffffff, 2.0);
key.position.set(-560, 760, 900);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
key.shadow.camera.near = 100;
key.shadow.camera.far = 4600;
key.shadow.camera.left = -1150;
key.shadow.camera.right = 1150;
key.shadow.camera.top = 1250;
key.shadow.camera.bottom = -1250;
key.shadow.bias = -0.0009;
scene.add(key);

const fill = new THREE.DirectionalLight(0xffffff, 0.6);
fill.position.set(760, 260, -520);
scene.add(fill);

const rim = new THREE.DirectionalLight(0xffffff, 0.5);
rim.position.set(320, -640, -820);
scene.add(rim);

/* ---------------------------------------------------------------- bow ---- */

const bow = new THREE.Group();
bow.name = 'bow';
bow.add(buildRiser());
for (const [sign, tag] of [[1, 'upper'], [-1, 'lower']]) bow.add(buildLimb(sign, tag));
bow.add(buildString());
bow.add(buildSight());
bow.add(buildStabilisers());
bow.add(buildRiserFurniture());
bow.add(buildArrow());

const stand = buildStand();
bow.add(stand);
scene.add(bow);

/* exposed for the inspection tooling */
window.__bow = bow;
window.__THREE = THREE;

/* --------------------------------------------------------------- parts --- */

const parts = [];
bow.traverse((o) => {
  if (o.isMesh) {
    let cur = o;
    while (cur.parent && cur.parent !== bow) cur = cur.parent;
    o.userData.root = cur.name || 'riser';
    parts.push(o);
  }
});

/* Plain-language groups for the parts list, keyed off the scene graph. */
const PART_GROUPS = [
  ['riser', 'Riser'],
  ['limb-upper', 'Upper limb'],
  ['limb-lower', 'Lower limb'],
  ['string', 'String'],
  ['sight', 'Sight'],
  ['stab-longrod', 'Long rod'],
  ['stab-siderod-f', 'Side rod (far)'],
  ['stab-siderod-n', 'Side rod (near)'],
  ['furniture', 'Clicker, plunger, rest'],
  ['arrow', 'Arrow'],
  ['stand', 'Bow stand'],
];

const FRIENDLY = (name) => name
  .replace(/^(riser|limb-upper|limb-lower|string|sight|stab-longrod|stab-siderod-[fn]|clicker|plunger|rest|arrow|stand)-?/, '')
  .replace(/-/g, ' ')
  .trim() || name;

function renderPartList() {
  const el = document.getElementById('parts');
  if (!el) return;
  const byRoot = new Map();
  for (const m of parts) {
    const r = m.userData.root;
    if (!byRoot.has(r)) byRoot.set(r, []);
    byRoot.get(r).push(m);
  }
  let html = '';
  for (const [root, label] of PART_GROUPS) {
    const list = byRoot.get(root);
    if (!list) continue;
    html += `<div class="pi"><span>${label}</span><em>${list.length}</em></div>`;
  }
  el.innerHTML = html;
}

/* --------------------------------------------------------------- labels -- */

const labelLayer = new THREE.Group();
scene.add(labelLayer);

function makeLabel(text) {
  const pad = 9;
  const font = '600 30px ui-sans-serif, system-ui, "Segoe UI", sans-serif';
  const probe = document.createElement('canvas').getContext('2d');
  probe.font = font;
  const w = Math.ceil(probe.measureText(text).width) + pad * 2;
  const c = document.createElement('canvas');
  c.width = w; c.height = 48;
  const g = c.getContext('2d');
  g.font = font;
  g.fillStyle = 'rgba(16,20,26,0.84)';
  g.beginPath();
  g.roundRect(0, 0, w, 48, 9);
  g.fill();
  g.fillStyle = '#eef1f4';
  g.textBaseline = 'middle';
  g.fillText(text, pad, 25);
  const tex = new THREE.CanvasTexture(c);
  tex.anisotropy = 4;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({
    map: tex, depthTest: false, transparent: true, sizeAttenuation: true,
  }));
  sp.scale.set(w * 0.66, 31, 1);
  sp.renderOrder = 10;
  return sp;
}

const LABELS = [
  ['riser', 62, 60, 140],
  ['limb — upper', 30, 500, 140],
  ['limb — lower', 30, -500, 140],
  ['string', 152, -330, 140],
  ['sight', -260, 300, 140],
  ['long rod', -720, 30, 140],
  ['side rod', -430, -140, 300],
  ['clicker', 96, 26, 140],
  ['plunger', -34, -26, 140],
  ['arrow rest', 74, -74, 140],
  ['arrow', -430, -90, 140],
];

for (const [text, x, y, z] of LABELS) {
  const sp = makeLabel(text);
  sp.position.set(x, y, z);
  labelLayer.add(sp);
}
labelLayer.visible = false;

/* --------------------------------------------------------------- views --- */

/* Camera positions follow the bow's own frame: +X is toward the archer, +Z is
   the flat side of the bow. So the true side view looks down Z, and the front
   view (the archer's view of the string, face-on) looks down X.

   Distances are chosen from the vertical field of view so each shot actually
   contains its subject: a 635 mm riser needs ~2.8 m at fov 18 to sit inside a
   1050-tall frame with margin. */
const VIEWS = {
  side:  { pos: [-40, 40, 3150],  tgt: [-40, 60, 0],    fov: 19 },
  whole: { pos: [430, 60, 3900],  tgt: [-60, 40, 0],    fov: 16 },
  riser: { pos: [-2, 0, 2750],    tgt: [-2, 0, 0],      fov: 18 },
  sight: { pos: [-300, 380, 1250], tgt: [-190, 250, 0], fov: 20 },
  front: { pos: [2750, 40, 0],    tgt: [-60, 20, 0],    fov: 17 },
  three: { pos: [1950, 660, 1950], tgt: [-60, 30, 0],   fov: 19 },
};

const cam = new THREE.PerspectiveCamera(17, 1, 5, 40000);

const orbit = {
  active: false, mode: 'rotate', lx: 0, ly: 0,
  theta: 0, phi: 0, radius: 2800, tgt: new THREE.Vector3(-40, 30, 0),
};

function updateCam() {
  const sp = Math.sin(orbit.phi);
  cam.position.set(
    orbit.tgt.x + orbit.radius * sp * Math.sin(orbit.theta),
    orbit.tgt.y + orbit.radius * Math.cos(orbit.phi),
    orbit.tgt.z + orbit.radius * sp * Math.cos(orbit.theta),
  );
  cam.lookAt(orbit.tgt);
}

function applyView(v) {
  cam.fov = v.fov;
  cam.updateProjectionMatrix();
  orbit.tgt.set(...v.tgt);
  const off = new THREE.Vector3(...v.pos).sub(orbit.tgt);
  orbit.radius = off.length();
  orbit.phi = Math.acos(THREE.MathUtils.clamp(off.y / orbit.radius, -1, 1));
  orbit.theta = Math.atan2(off.x, off.z);
  updateCam();
}

let current = 'side';
function setView(name) {
  if (!VIEWS[name]) return;
  current = name;
  applyView(VIEWS[name]);
  document.querySelectorAll('[data-view]').forEach((b) =>
    b.classList.toggle('on', b.dataset.view === name));
}

/* ------------------------------------------------------------ interaction - */

canvas.addEventListener('pointerdown', (e) => {
  orbit.active = true;
  orbit.mode = e.button === 2 ? 'pan' : 'rotate';
  orbit.lx = e.clientX; orbit.ly = e.clientY;
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointerup', () => { orbit.active = false; });
canvas.addEventListener('pointermove', (e) => {
  if (!orbit.active) return;
  const dx = e.clientX - orbit.lx, dy = e.clientY - orbit.ly;
  orbit.lx = e.clientX; orbit.ly = e.clientY;
  if (orbit.mode === 'rotate') {
    orbit.theta -= dx * 0.005;
    orbit.phi = THREE.MathUtils.clamp(orbit.phi - dy * 0.005, 0.05, Math.PI - 0.05);
  } else {
    const right = new THREE.Vector3().setFromMatrixColumn(cam.matrix, 0);
    const up = new THREE.Vector3().setFromMatrixColumn(cam.matrix, 1);
    orbit.tgt.addScaledVector(right, -dx * orbit.radius * 0.0012);
    orbit.tgt.addScaledVector(up, dy * orbit.radius * 0.0012);
  }
  updateCam();
});
canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  orbit.radius = THREE.MathUtils.clamp(orbit.radius * (1 + Math.sign(e.deltaY) * 0.09), 60, 20000);
  updateCam();
}, { passive: false });
canvas.addEventListener('contextmenu', (e) => e.preventDefault());

document.querySelectorAll('[data-view]').forEach((b) =>
  b.addEventListener('click', () => setView(b.dataset.view)));

const chkLabels = document.getElementById('chk-labels');
const chkStand = document.getElementById('chk-stand');
if (chkLabels) chkLabels.addEventListener('change', () => { labelLayer.visible = chkLabels.checked; });
if (chkStand) chkStand.addEventListener('change', () => { stand.visible = chkStand.checked; });

/* Soft contact shadow so the bow is not floating in a void. */
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(14000, 14000),
  new THREE.ShadowMaterial({ opacity: 0.15 }),
);
ground.rotation.x = -Math.PI / 2;
ground.position.y = -560;
ground.receiveShadow = true;
scene.add(ground);

/* ------------------------------------------------------------- harness --- */

function resize() {
  const w = canvas.clientWidth || innerWidth;
  const h = canvas.clientHeight || innerHeight;
  renderer.setSize(w, h, false);
  cam.aspect = w / h;
  cam.updateProjectionMatrix();
}
addEventListener('resize', resize);

window.__view = (name) => setView(name);
window.__set = (o = {}) => {
  if ('labels' in o) {
    labelLayer.visible = !!o.labels;
    if (chkLabels) chkLabels.checked = !!o.labels;
  }
  if ('stand' in o) {
    stand.visible = !!o.stand;
    if (chkStand) chkStand.checked = !!o.stand;
  }
};
let orthoCam = null;

window.__cam = (pos, tgt, fov) => {
  /* fov === 'ortho' switches to an orthographic camera, so geometry can be
     measured without perspective skew. */
  if (fov === 'ortho') {
    const halfH = 720;
    const halfW = halfH * (canvas.clientWidth / Math.max(1, canvas.clientHeight));
    const oc = new THREE.OrthographicCamera(-halfW, halfW, halfH, -halfH, 1, 12000);
    oc.position.set(...pos);
    oc.lookAt(new THREE.Vector3(...tgt));
    orthoCam = oc;
    return;
  }
  orthoCam = null;
  orbit.tgt.set(...tgt);
  const off = new THREE.Vector3(...pos).sub(orbit.tgt);
  orbit.radius = off.length();
  orbit.phi = Math.acos(THREE.MathUtils.clamp(off.y / orbit.radius, -1, 1));
  orbit.theta = Math.atan2(off.x, off.z);
  if (fov) { cam.fov = fov; cam.updateProjectionMatrix(); }
  updateCam();
};

/* Isolate one group - used to check a single part without the rest of the bow
   overlapping it in silhouette. 'all' restores everything. */
window.__only = (name) => {
  bow.children.forEach((c) => { c.visible = (name === 'all' || c.name === name); });
  labelLayer.visible = false;
};

let frames = 0;
function tick() {
  requestAnimationFrame(tick);
  renderer.render(scene, orthoCam || cam);
  if (++frames === 3) {
    renderPartList();
    window.__STATS__ = {
      parts: parts.length,
      tris: renderer.info.render.triangles,
      view: current,
    };
    window.__READY__ = true;
  }
}

resize();
setView('side');
tick();
