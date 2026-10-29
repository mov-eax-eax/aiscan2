import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { makeSky, makeEnvTexture } from './sky.js';
import { buildTower } from './tower.js';
import { PROFILES, ORDER } from './profiles.js';

const SUN = new THREE.Vector3(-0.50, 0.575, 0.648).normalize();

const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
const env = makeEnvTexture(renderer, SUN);
scene.environment = env;
const sky = makeSky(SUN);
scene.add(sky);

const camera = new THREE.PerspectiveCamera(30, window.innerWidth / window.innerHeight, 0.5, 9000);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.075;
controls.minDistance = 25;
controls.maxDistance = 1500;
controls.maxPolarAngle = Math.PI * 0.497;
controls.target.set(0, 42, 0);

const sun = new THREE.DirectionalLight(0xffefd2, 2.9);
sun.position.copy(SUN).multiplyScalar(420);
sun.castShadow = true;
sun.shadow.mapSize.set(4096, 4096);
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 3.0;
const sc = sun.shadow.camera;
sc.left = -150; sc.right = 150; sc.top = 155; sc.bottom = -155; sc.near = 40; sc.far = 900;
sc.updateProjectionMatrix();
scene.add(sun);
scene.add(sun.target);
scene.add(new THREE.HemisphereLight(0xa9cbe8, 0x5f5848, 0.55));

function groundTexture() {
  const s = 1024;
  const c = document.createElement('canvas');
  c.width = c.height = s;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(s / 2, s / 2, s * 0.02, s / 2, s / 2, s * 0.52);
  g.addColorStop(0.00, '#8e8877');
  g.addColorStop(0.30, '#7f7969');
  g.addColorStop(0.62, '#6d6a5e');
  g.addColorStop(1.00, '#5c625f');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
  for (let i = 0; i < 52000; i++) {
    ctx.fillStyle = Math.random() > 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.075)';
    ctx.fillRect(Math.random() * s, Math.random() * s, 2, 2);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return t;
}

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(2600, 2600),
  new THREE.MeshStandardMaterial({ map: groundTexture(), roughness: 0.98, metalness: 0.0 }));
ground.rotation.x = -Math.PI / 2;
ground.position.y = -0.2;
ground.receiveShadow = true;
scene.add(ground);

const fog = new THREE.Fog(0xa8bccc, 640, 2500);
scene.fog = fog;

/* ------------------------------------------------------------------ *
 * Profile switching. Both silhouettes normalise to a 100-unit tower, so
 * the camera rig, lights and shadow map are shared.
 * ------------------------------------------------------------------ */
let profileId = 'sketch';
let tower = null;

function disposeGroup(g) {
  g.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    const m = o.material;
    if (m && !Array.isArray(m)) { if (m.map) m.map.dispose(); m.dispose(); }
  });
}

function setProfile(id) {
  if (!PROFILES[id]) return false;
  silhouette(false);
  if (tower) { scene.remove(tower.group); disposeGroup(tower.group); }
  profileId = id;
  tower = buildTower(PROFILES[id]);
  scene.add(tower.group);
  const p = PROFILES[id];
  document.getElementById('note').innerHTML = p.label + ' &mdash; ' + p.note;
  for (const b of document.querySelectorAll('#profiles button')) b.classList.toggle('on', b.dataset.profile === id);
  renderer.render(scene, camera);
  return true;
}

const VIEWS = {
  photo:     { pos: [ 132,  66, 196], target: [0, 42, 0], fov: 30 },
  elevation: { pos: [   0,  52, 640], target: [0, 50, 0], fov: 11 },
  three:     { pos: [ 205, 148, 188], target: [0, 34, 0], fov: 34 },
  base:      { pos: [  66,  27, 104], target: [0, 17, 0], fov: 42 },
  top:       { pos: [  26,  98,  46], target: [0, 88, 0], fov: 34 },
};

let tween = null;
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

function setView(name, animate) {
  const v = VIEWS[name];
  if (!v) return false;
  const toPos = new THREE.Vector3().fromArray(v.pos);
  const toTgt = new THREE.Vector3().fromArray(v.target);
  for (const b of document.querySelectorAll('#views button')) b.classList.toggle('on', b.dataset.view === name);
  if (!animate) {
    tween = null;
    camera.position.copy(toPos);
    controls.target.copy(toTgt);
    camera.fov = v.fov;
    camera.updateProjectionMatrix();
    controls.update();
    return true;
  }
  tween = { t: 0, fromPos: camera.position.clone(), fromTgt: controls.target.clone(), fromFov: camera.fov, toPos, toTgt, toFov: v.fov };
  return true;
}

const profilesEl = document.getElementById('profiles');
for (const id of ORDER) {
  const b = document.createElement('button');
  b.textContent = PROFILES[id].label;
  b.dataset.profile = id;
  b.addEventListener('click', () => setProfile(id));
  profilesEl.appendChild(b);
}
const viewsEl = document.getElementById('views');
for (const name of Object.keys(VIEWS)) {
  const b = document.createElement('button');
  b.textContent = name;
  b.dataset.view = name;
  b.addEventListener('click', () => setView(name, true));
  viewsEl.appendChild(b);
}
document.getElementById('hint').addEventListener('click', () => document.getElementById('hud').classList.toggle('mini'));

setProfile('eiffel');
setView('photo', false);

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);

let frozen = false;
let last = performance.now(), fps = 0;
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (dt > 0) fps = fps * 0.9 + (1 / dt) * 0.1;
  if (tween) {
    tween.t = Math.min(1, tween.t + dt / 0.75);
    const e = ease(tween.t);
    camera.position.lerpVectors(tween.fromPos, tween.toPos, e);
    controls.target.lerpVectors(tween.fromTgt, tween.toTgt, e);
    camera.fov = tween.fromFov + (tween.toFov - tween.fromFov) * e;
    camera.updateProjectionMatrix();
    if (tween.t >= 1) { tween = null; controls.update(); }
  } else {
    controls.update();
  }
  if (!frozen) renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

window.__snap = (name) => { setView(name, false); renderer.render(scene, camera); return true; };
window.__views = () => Object.keys(VIEWS);
window.__profiles = () => ORDER;
window.__profile = (id) => setProfile(id);
window.__stats = () => ({
  profile: profileId,
  members: tower.members,
  triangles: renderer.info.render.triangles,
  calls: renderer.info.render.calls,
  fps: Math.round(fps),
  size: [renderer.domElement.width, renderer.domElement.height],
});

/* ------------------------------------------------------------------ *
 * Validation harness. Flattens the scene to one tone with the ground
 * and sky off, renders a true orthographic elevation, reads the
 * silhouette out of the framebuffer, and exposes the profile it was
 * built from so compare.mjs can diff the two.
 * ------------------------------------------------------------------ */
const flatMat = new THREE.MeshBasicMaterial({ color: 0x0a0a0a });
const ortho = new THREE.OrthographicCamera(-56, 56, 56, -56, 1, 1400);
const orthoHalf = 56, orthoY = 50;

function silhouette(on) {
  frozen = !!on;
  sky.visible = !on;
  ground.visible = !on;
  scene.fog = on ? null : fog;
  scene.background = on ? new THREE.Color(0xffffff) : null;
  scene.traverse((o) => {
    if (!o.isMesh && !o.isInstancedMesh) return;
    if (on) {
      if (o.userData.m === undefined) o.userData.m = o.material;
      o.material = flatMat;
    } else if (o.userData.m !== undefined) {
      o.material = o.userData.m;
      o.userData.m = undefined;
    }
  });
  return true;
}
window.__silhouette = silhouette;

window.__silhouetteScan = () => {
  const a = window.innerWidth / window.innerHeight;
  ortho.left = -orthoHalf * a;
  ortho.right = orthoHalf * a;
  ortho.top = orthoHalf;
  ortho.bottom = -orthoHalf;
  ortho.position.set(0, orthoY, 400);
  ortho.lookAt(0, orthoY, 0);
  ortho.updateProjectionMatrix();
  const worldTop = orthoY + orthoHalf, worldBottom = orthoY - orthoHalf;
  renderer.render(scene, ortho);
  const gl = renderer.getContext();
  const w = renderer.domElement.width, h = renderer.domElement.height;
  const buf = new Uint8Array(w * h * 4);
  gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, buf);
  const axisPx = Math.round((0 - ortho.left) / (ortho.right - ortho.left) * w - 0.5);
  const rows = [];
  for (let ry = 0; ry < h; ry++) {
    let lo = -1, hi = -1, n = 0, gap = -1;
    for (let x = 0; x < w; x++) {
      const i = (ry * w + x) * 4;
      if (buf[i] < 128) { if (lo < 0) lo = x; hi = x; n++; }
    }
    for (let x = axisPx; x < w; x++) { if (buf[(ry * w + x) * 4] < 128) { gap = x; break; } }
    rows.push([ry, lo, hi, n, gap]);
  }
  return { w, h, left: ortho.left, right: ortho.right, top: worldTop, bottom: worldBottom, rows, profile: profileId };
};

window.__profileRef = (step) => {
  const P = PROFILES[profileId];
  const y = [], hw = [], vd = [];
  for (let k = 0; k <= P.height + 1e-6; k += step) {
    y.push(+k.toFixed(3));
    hw.push(P.halfWidth(k));
    vd.push(P.voidHalf(k));
  }
  return { id: P.id, label: P.label, style: P.style, height: P.height, step, y, halfWidth: hw, voidHalf: vd };
};

const allMats = [];
scene.traverse((o) => { if (o.material) allMats.push(o.material); });
window.__tune = (o) => {
  if (o.normalBias !== undefined) sun.shadow.normalBias = o.normalBias;
  if (o.bias !== undefined) sun.shadow.bias = o.bias;
  if (o.exposure !== undefined) renderer.toneMappingExposure = o.exposure;
  if (o.sunIntensity !== undefined) sun.intensity = o.sunIntensity;
  if (o.extent !== undefined) {
    sc.left = -o.extent; sc.right = o.extent; sc.top = o.extent + 5; sc.bottom = -o.extent - 5;
    sc.updateProjectionMatrix();
  }
  if (o.shadow !== undefined) {
    renderer.shadowMap.enabled = !!o.shadow;
    for (const m of allMats) m.needsUpdate = true;
  }
  if (o.hide || o.show) {
    scene.traverse((n) => {
      if (n.name === o.hide) n.visible = false;
      if (n.name === o.show) n.visible = true;
    });
  }
  renderer.render(scene, camera);
  return true;
};

window.__ready = true;
