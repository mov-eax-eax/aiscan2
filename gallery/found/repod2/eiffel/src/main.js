import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Rng } from './rng.js';
import { clamp, lerp } from './rng.js';
import { TimeOfDay } from './palette.js';
import { Sky } from './sky.js';
import { PostChain } from './post.js';
import { createTower } from './tower.js';
import { createGround } from './ground.js';
import { createCity } from './city.js';
import { createTrees } from './trees.js';

/* ===========================================================================
 *  LA TOUR EIFFEL - Paris, Champ de Mars.
 *  Scene assembly: renderer, sun/ambient rig driven by the time-of-day
 *  palette, orbit camera with cinematic presets, the custom post chain and
 *  the HUD. Every module exposes { group, update(tod, time, camera, fog) }.
 * =========================================================================== */

const q = new URLSearchParams(location.search);
const param = (k, d) => (q.has(k) ? q.get(k) : d);
const STILL = param('still', '0') === '1';
const HUD_OFF = param('hud', '1') === '0';
const LITE = param('lite', '0') === '1';      // cheap verification renders
const SHEET = param('sheet', '0') === '1';
const FIXED_TIME = parseFloat(param('t', '14.0'));

const VIEWS = {
  postcard: { name: 'Trocadero', pos: [0, 44, -860], target: [0, 120, 0], fov: 30 },
  champ: { name: 'Champ de Mars', pos: [0, 7, 800], target: [0, 168, 0], fov: 30 },
  base: { name: 'Sous la tour', pos: [10, 5, 118], target: [0, 215, 0], fov: 70 },
  aerial: { name: 'Aerien', pos: [560, 470, 820], target: [0, 80, 0], fov: 40 },
  seine: { name: 'Seine', pos: [-60, 30, -470], target: [0, 120, 0], fov: 42 },
  top: { name: 'Sommet', pos: [52, 300, 78], target: [0, 268, 0], fov: 42 },
  lattice: { name: 'Charpente', pos: [46, 92, 54], target: [6, 118, 6], fov: 46 },
  night: { name: 'Nuit', pos: [-120, 60, -700], target: [0, 120, 0], fov: 34 },
};

const HOURS = {
  aube: 6.4, matin: 9.2, midi: 13.0, apresmidi: 17.4, doree: 20.7, coucher: 21.7, crepuscule: 22.4, nuit: 23.6,
};

// ---------------------------------------------------------------- renderer --
const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance', stencil: false });
renderer.setPixelRatio(1);
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.LinearSRGBColorSpace;   // the post chain owns gamma
renderer.toneMapping = THREE.NoToneMapping;
renderer.shadowMap.enabled = !LITE;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.info.autoReset = false;
document.getElementById('app').appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(32, innerWidth / innerHeight, 0.7, 24000);
camera.position.set(0, 44, -860);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.055;
controls.rotateSpeed = 0.62;
controls.zoomSpeed = 0.9;
controls.panSpeed = 0.7;
controls.minDistance = 6;
controls.maxDistance = 4200;
controls.maxPolarAngle = Math.PI * 0.88;   // allow looking UP at the tower from below
controls.target.set(0, 120, 0);

// ------------------------------------------------------------------ lights --
const sun = new THREE.DirectionalLight(0xffffff, 2.6);
sun.castShadow = true;
sun.shadow.mapSize.set(4096, 4096);
sun.shadow.camera.near = 1;
sun.shadow.camera.far = 4200;
sun.shadow.camera.left = -820; sun.shadow.camera.right = 820;
sun.shadow.camera.top = 820; sun.shadow.camera.bottom = -820;
sun.shadow.bias = -0.0006;
sun.shadow.normalBias = 0.9;
const sunTarget = new THREE.Object3D();
scene.add(sunTarget);
sun.target = sunTarget;
scene.add(sun);

const hemi = new THREE.HemisphereLight(0x9dc4ff, 0x4a4436, 1.0);
scene.add(hemi);
const fill = new THREE.AmbientLight(0xffffff, 0.25);
scene.add(fill);

// ------------------------------------------------------------------- world --
const rng = new Rng(20240607);
const tod = new TimeOfDay(parseFloat(param('hour', String(HOURS.doree))));
const sky = new Sky();
scene.add(sky.mesh);
const tower = createTower({ rng, tod, quality: 'high' });
scene.add(tower.group);
const ground = createGround({ rng, tod, quality: 'high' });
scene.add(ground.group);
const modules = [tower, ground];
const world = { scene, rng, tod, renderer, camera, sky, fog: new THREE.Color() };

/** add an optional world module; a failure never takes the scene down */
function addModule(name, factory, ctx) {
  try {
    const m = factory(ctx);
    if (!m || !m.group) throw new Error('module returned no group');
    scene.add(m.group);
    modules.push(m);
    return m;
  } catch (e) {
    console.warn('[scene] module "' + name + '" failed:', e);
    if (typeof showError === 'function') showError(name + ': ' + (e && e.message ? e.message : e));
    return null;
  }
}
world.addModule = addModule;
const MODCTX = { rng, tod, quality: 'high' };
addModule('trees', createTrees, MODCTX);
addModule('city', createCity, MODCTX);

const post = new PostChain(renderer, scene, camera);
post.setSize(innerWidth, innerHeight);

// ------------------------------------------------------------------ quality --
const QUALITY = {
  low: { scale: 0.72, shadow: 1024, bloom: 0.44 },
  med: { scale: 1.0, shadow: 2048, bloom: 0.55 },
  high: { scale: 1.28, shadow: 4096, bloom: 0.64 },
};
let quality = param('q', LITE ? 'low' : 'high');   // a real GPU eats this for breakfast
function setQuality(name) {
  quality = name;
  const Q = QUALITY[name] || QUALITY.med;
  post.setQuality(Q.scale);
  post.bloomStrength = Q.bloom;
  post.setSize(innerWidth, innerHeight);
  sun.shadow.mapSize.set(Q.shadow, Q.shadow);
  if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; }
  for (const b of document.querySelectorAll('#opts button[data-q]')) b.classList.toggle('on', b.dataset.q === name);
}

// --------------------------------------------------------------------- HUD --
function button(label, parent, onClick, cls) {
  const b = document.createElement('button');
  b.textContent = label;
  if (cls) b.className = cls;
  b.addEventListener('click', onClick);
  parent.appendChild(b);
  return b;
}
const viewRow = document.getElementById('views');
const timeRow = document.getElementById('times');
const optRow = document.getElementById('opts');
const viewButtons = {};
for (const key of Object.keys(VIEWS)) {
  viewButtons[key] = button(VIEWS[key].name, viewRow, () => setView(key));
}
const hourLabel = document.createElement('div');
hourLabel.className = 'lbl';
hourLabel.style.marginTop = '4px';
timeRow.appendChild(hourLabel);
const slider = document.createElement('input');
slider.type = 'range'; slider.min = '0'; slider.max = '24'; slider.step = '0.02';
slider.value = String(tod.hour);
slider.style.cssText = 'width:100%;margin-top:6px;accent-color:#f2c078;height:14px;';
slider.addEventListener('input', () => { targetHour = parseFloat(slider.value); autoCycle = false; });
timeRow.appendChild(slider);
for (const [name, h] of Object.entries(HOURS)) {
  button(name === 'apresmidi' ? '17h' : name, timeRow, () => { targetHour = h; slider.value = String(h); autoCycle = false; });
}
let autoCycle = false;
button('Cycle 24h', timeRow, (e) => { autoCycle = !autoCycle; e.target.classList.toggle('on', autoCycle); });

let sparkleMode = param('sparkle', 'auto');
const sparkleBtn = button('Scintillement', optRow, () => {
  sparkleMode = sparkleMode === 'auto' ? 'on' : sparkleMode === 'on' ? 'off' : 'auto';
  sparkleBtn.textContent = 'Scintillement: ' + sparkleMode;
});
sparkleBtn.textContent = 'Scintillement: ' + sparkleMode;
const beaconBtn = button('Phare', optRow, () => { beaconOn = !beaconOn; beaconBtn.classList.toggle('on', beaconOn); });
let beaconOn = true;
beaconBtn.classList.add('on');
const rotBtn = button('Rotation', optRow, () => { controls.autoRotate = !controls.autoRotate; rotBtn.classList.toggle('on', controls.autoRotate); });
controls.autoRotateSpeed = 0.18;
for (const name of ['low', 'med', 'high']) button(name, optRow, () => setQuality(name), null).dataset.q = name;

if (HUD_OFF) for (const id of ['hud', 'stats']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
const hudEl = document.getElementById('hud');
const titleEl = document.getElementById('title');
if (titleEl && hudEl) {
  titleEl.style.cursor = 'pointer';
  titleEl.title = 'Click to collapse / expand the panel';
  titleEl.addEventListener('click', () => hudEl.classList.toggle('min'));
}
const stats = document.getElementById('stats');
const loading = document.getElementById('loading');
const bar = document.querySelector('#bar i');
const errBox = document.getElementById('err');
function showError(e) {
  errBox.style.display = 'block';
  errBox.textContent = String(e && e.message ? e.message : e).slice(0, 400);
}
addEventListener('error', (e) => showError(e.error || e.message));

// ------------------------------------------------------------ camera moves --
let flight = null;
function setView(key) {
  const v = VIEWS[key];
  if (!v) return;
  for (const [k, b] of Object.entries(viewButtons)) b.classList.toggle('on', k === key);
  flight = {
    t: 0, dur: 1.5,
    p0: camera.position.clone(), p1: new THREE.Vector3().fromArray(v.pos),
    t0: controls.target.clone(), t1: new THREE.Vector3().fromArray(v.target),
    f0: camera.fov, f1: v.fov,
  };
}
setView(param('view', 'postcard'));

// -------------------------------------------------------------- url / hooks --
let targetHour = tod.hour;
function setHour(h) { targetHour = h; slider.value = String(h); tod.set(h); }   // snap, never lerp on start
setHour(tod.hour);

// ------------------------------------------------------------------- loop ---
const clock = new THREE.Clock();
let frames = 0, fpsAcc = 0, fpsTime = 0, fps = 0;
const fog = new THREE.Color();

function updateWorld(time) {
  if (autoCycle) targetHour = (targetHour + 0.045) % 24;
  tod.set(lerp(tod.hour, targetHour, 0.12));
  slider.value = tod.hour.toFixed(2);
  sky.update(tod, camera, time);
  fog.copy(sky.fogColor);

  const p = tod.pal;
  sun.position.copy(tod.sunDir).multiplyScalar(1600).add(new THREE.Vector3(0, 0, 0));
  sunTarget.position.set(0, 60, 0);
  sun.color.copy(p.sun);
  sun.intensity = tod.sunElevation > -3 ? p.sunI * 1.35 : 0;
  sun.visible = sun.intensity > 0.001;
  hemi.color.copy(p.zenith).lerp(p.amb, 0.4);
  hemi.groundColor.copy(p.ground);
  hemi.intensity = p.ambI * 0.55;
  fill.intensity = p.ambI * 0.12;
  fill.color.copy(p.amb);
  post.exposure = p.exp * 0.82;

  for (const m of modules) m.update(tod, time, camera, fog);
}

function frame() {
  const dt = Math.min(clock.getDelta(), 0.1);
  const time = STILL ? FIXED_TIME : clock.getElapsedTime();
  renderer.info.reset();
  updateWorld(time);

  if (flight) {
    flight.t += dt;
    const k = clamp(flight.t / flight.dur, 0, 1);
    const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
    camera.position.lerpVectors(flight.p0, flight.p1, e);
    controls.target.lerpVectors(flight.t0, flight.t1, e);
    const fv = lerp(flight.f0, flight.f1, e);
    if (Math.abs(camera.fov - fv) > 0.01) { camera.fov = fv; camera.updateProjectionMatrix(); }
    if (k >= 1) flight = null;
  }
  controls.update();

  post.render(time);

  fpsAcc += dt; frames++;
  if ((fpsTime += dt) > 0.4) { fps = frames / fpsAcc; frames = 0; fpsAcc = 0; fpsTime = 0; }
  if (!STILL && !SHEET && fps) {
    stats.innerHTML = '<b>' + fps.toFixed(0) + '</b> fps &nbsp; <b>' + renderer.info.render.calls + '</b> calls<br><b>' +
      (renderer.info.render.triangles / 1000).toFixed(0) + 'k</b> tris &nbsp; ' + tod.hour.toFixed(2) + 'h';
  }
  if (!window.__ready) {
    window.__ready = true;
    loading.classList.add('gone');
    setTimeout(() => loading.remove(), 900);
    if (SHEET) renderer.setAnimationLoop(null);   // the sheet hook draws the tiles
  }
}
renderer.setAnimationLoop(frame);

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  post.setSize(innerWidth, innerHeight);
});

// ------------------------------------------------------- automation surface --
window.__stats = () => ({
  calls: renderer.info.render.calls,
  tris: renderer.info.render.triangles,
  hour: tod.hour,
  sunEl: tod.sunElevation,
  lights: tod.lightsOn,
  quality,
});
window.__setHour = setHour;
window.__setView = setView;
window.__views = Object.keys(VIEWS);
window.__capture = () => { updateWorld(FIXED_TIME); post.render(FIXED_TIME); };
window.__snap = (key) => {
  const v = VIEWS[key];
  if (!v) return false;
  camera.position.fromArray(v.pos);
  controls.target.fromArray(v.target);
  camera.fov = v.fov;
  camera.updateProjectionMatrix();
  camera.lookAt(controls.target);
  flight = null;
  updateWorld(FIXED_TIME);
  post.render(FIXED_TIME);
  return true;
};
window.__sheet = (keys) => {
  const spec = param('sheet', '1');
  const list = keys || (spec !== '1' ? spec.split(',') : ['postcard', 'champ', 'base', 'lattice']);
  const W = innerWidth, H = innerHeight;
  const prevAspect = camera.aspect;
  const prevFov = camera.fov;
  const grid = [[0, 1], [1, 1], [0, 0], [1, 0]];
  for (let i = 0; i < list.length && i < 4; i++) {
    const v = VIEWS[list[i]];
    const g = grid[i];
    camera.aspect = (W / 2) / (H / 2);
    camera.fov = v.fov;
    camera.updateProjectionMatrix();
    camera.position.fromArray(v.pos);
    controls.target.fromArray(v.target);
    camera.lookAt(controls.target);
    updateWorld(FIXED_TIME);
    const vp = [g[0] * W / 2, g[1] * H / 2, W / 2, H / 2];
    renderer.setViewport(vp[0], vp[1], vp[2], vp[3]);
    post.render(FIXED_TIME, vp);
  }
  renderer.setViewport(0, 0, W, H);
  camera.aspect = prevAspect;
  camera.fov = prevFov;
  camera.updateProjectionMatrix();
};
window.__world = world;
window.__THREE = THREE;   // handy for debugging from the console
