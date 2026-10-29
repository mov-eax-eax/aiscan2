import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Rng, clamp, lerp } from './rng.js';
import { TimeOfDay } from './palette.js';
import { Sky } from './sky.js';
import { PostChain } from './post.js';
import { createTower } from './tower.js';
import { halfWidth } from './profile.js';
import common from './glsl/common.glsl';

/* ===========================================================================
 *  LA TOUR EIFFEL - tower only, built from Eiffel's 1:1000 elevation.
 *  Real sky, real sun, an environment probe for the painted iron, and a
 *  shadow-catching esplanade - nothing else in the frame.
 * =========================================================================== */

const q = new URLSearchParams(location.search);
const param = (k, d) => (q.has(k) ? q.get(k) : d);
const STILL = param('still', '0') === '1';
const HUD_OFF = param('hud', '1') === '0';
const FIXED_TIME = parseFloat(param('t', '14.0'));

const VIEWS = {
  photo: { name: 'Champ de Mars', pos: [0, 8, 700], target: [0, 158, 0], fov: 30 },
  elevation: { name: 'Elevation', pos: [0, 150, 1500], target: [0, 150, 0], fov: 14 },
  three: { name: 'Trois-quarts', pos: [560, 150, 700], target: [0, 132, 0], fov: 30 },
  base: { name: 'Sous la tour', pos: [58, 6, 108], target: [0, 175, 0], fov: 70 },
  first: { name: 'Premier etage', pos: [200, 100, 250], target: [0, 88, 0], fov: 42 },
  pylon: { name: 'Pylone', pos: [130, 235, 160], target: [0, 215, 0], fov: 38 },
  top: { name: 'Sommet', pos: [64, 296, 92], target: [0, 286, 0], fov: 34 },
};
const HOURS = { aube: 6.4, matin: 9.2, midi: 13.0, doree: 20.5, coucher: 21.7, nuit: 23.4 };

// ---------------------------------------------------------------- renderer --
const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance', stencil: false });
renderer.setPixelRatio(1);
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.info.autoReset = false;
document.getElementById('app').appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(30, innerWidth / innerHeight, 0.6, 30000);
camera.position.set(0, 8, 700);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.rotateSpeed = 0.6;
controls.minDistance = 8;
controls.maxDistance = 6000;
controls.maxPolarAngle = Math.PI * 0.9;
controls.target.set(0, 158, 0);

// ------------------------------------------------------------------ lights --
const sun = new THREE.DirectionalLight(0xffffff, 3);
sun.castShadow = true;
sun.shadow.mapSize.set(4096, 4096);
sun.shadow.camera.near = 10;
sun.shadow.camera.far = 3200;
sun.shadow.camera.left = -760; sun.shadow.camera.right = 760;
sun.shadow.camera.top = 760; sun.shadow.camera.bottom = -760;
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.55;
const sunTarget = new THREE.Object3D();
sunTarget.position.set(0, 120, 0);
scene.add(sunTarget);
sun.target = sunTarget;
scene.add(sun);

const hemi = new THREE.HemisphereLight(0x9dc4ff, 0x59503c, 1.0);
scene.add(hemi);

// ------------------------------------------------------------------- world --
const rng = new Rng(1889);
let tod = new TimeOfDay(parseFloat(param('hour', String(HOURS.doree))));
const sky = new Sky();
scene.add(sky.mesh);
const tower = createTower({ rng, tod, quality: 'high' });
scene.add(tower.group);

// (no environment probe: the iron, decks and stone all shade themselves from
//  the same palette uniforms, so a cube-rendered sky only washed them out)

// ------------------------------------------------------------------ ground --
const groundMat = new THREE.MeshStandardMaterial({ color: 0xbcae92, roughness: 0.97, metalness: 0.0 });
groundMat.onBeforeCompile = (sh) => {
  sh.uniforms.uFogColor = { value: new THREE.Color(1, 1, 1) };
  sh.uniforms.uFogDensity = { value: 0.00016 };
  sh.uniforms.uNight = { value: 0 };
  groundMat.userData.u = sh.uniforms;
  sh.vertexShader = sh.vertexShader
    .replace('#include <common>', '#include <common>\nvarying vec3 vW;')
    .replace('#include <begin_vertex>', '#include <begin_vertex>\n vW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
  sh.fragmentShader = sh.fragmentShader
    .replace('#include <common>', '#include <common>\nvarying vec3 vW;\nuniform vec3 uFogColor; uniform float uFogDensity, uNight;\n' + common)
    .replace('#include <map_fragment>', `#include <map_fragment>
      {
        vec2 p = vW.xz;
        // packed gravel with worn paths, and the four pillar aprons
        vec3 gravel = diffuseColor.rgb * (0.9 + 0.2 * fbm2(p * 0.6, 4));
        gravel *= 0.94 + 0.12 * fbm2(p * 7.0, 3);
        float worn = smoothstep(0.45, 0.9, fbm2(p * 0.045 + 11.0, 3));
        gravel = mix(gravel, gravel * 1.08, worn);
        diffuseColor.rgb = gravel;
      }`)
    .replace('#include <dithering_fragment>', '#include <dithering_fragment>\n gl_FragColor.rgb = applyAerial(gl_FragColor.rgb, uFogColor, length(vW - cameraPosition), uFogDensity);');
};
const ground = new THREE.Mesh(new THREE.PlaneGeometry(6000, 6000, 1, 1), groundMat);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

const post = new PostChain(renderer, scene, camera);
post.setSize(innerWidth, innerHeight);

const QUALITY = {
  low: { scale: 0.7, shadow: 1024, bloom: 0.4 },
  med: { scale: 1.0, shadow: 2048, bloom: 0.5 },
  high: { scale: 1.25, shadow: 4096, bloom: 0.6 },
};
let quality = param('q', 'high');
function setQuality(name) {
  quality = name;
  const Q = QUALITY[name] || QUALITY.high;
  post.setQuality(Q.scale);
  post.bloomStrength = Q.bloom;
  post.setSize(innerWidth, innerHeight);
  sun.shadow.mapSize.set(Q.shadow, Q.shadow);
  if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; }
  for (const b of document.querySelectorAll('#opts button[data-q]')) b.classList.toggle('on', b.dataset.q === name);
}

// --------------------------------------------------------------------- HUD --
function button(label, parent, onClick) {
  const b = document.createElement('button');
  b.textContent = label;
  b.addEventListener('click', onClick);
  parent.appendChild(b);
  return b;
}
if (HUD_OFF) for (const id of ['hud', 'stats']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
const hudEl = document.getElementById('hud');
const titleEl = document.getElementById('title');
if (titleEl && hudEl) { titleEl.style.cursor = 'pointer'; titleEl.addEventListener('click', () => hudEl.classList.toggle('min')); }

const viewRow = document.getElementById('views');
const timeRow = document.getElementById('times');
const optRow = document.getElementById('opts');
const viewButtons = {};
for (const key of Object.keys(VIEWS)) viewButtons[key] = button(VIEWS[key].name, viewRow, () => setView(key));
const hourLabel = document.createElement('div');
hourLabel.className = 'lbl';
timeRow.appendChild(hourLabel);
const slider = document.createElement('input');
slider.type = 'range'; slider.min = '0'; slider.max = '24'; slider.step = '0.02';
slider.value = String(tod.hour);
slider.style.cssText = 'width:100%;margin-top:5px;accent-color:#f2c078;height:13px;';
slider.addEventListener('input', () => { targetHour = parseFloat(slider.value); });
timeRow.appendChild(slider);
for (const [name, h] of Object.entries(HOURS)) button(name, timeRow, () => { targetHour = h; slider.value = String(h); });
const sparkleBtn = button('Scintillement', optRow, () => { sparkleOn = !sparkleOn; sparkleBtn.classList.toggle('on', sparkleOn); });
let sparkleOn = true;
sparkleBtn.classList.add('on');
const rotBtn = button('Rotation', optRow, () => { controls.autoRotate = !controls.autoRotate; rotBtn.classList.toggle('on', controls.autoRotate); });
controls.autoRotateSpeed = 0.22;
for (const name of ['low', 'med', 'high']) button(name, optRow, () => setQuality(name)).dataset.q = name;

const stats = document.getElementById('stats');
const loading = document.getElementById('loading');
const errBox = document.getElementById('err');
function showError(e) { errBox.style.display = 'block'; errBox.textContent = String(e && e.message ? e.message : e).slice(0, 400); }
addEventListener('error', (e) => showError(e.error || e.message));

let flight = null;
function setView(key) {
  const v = VIEWS[key];
  if (!v) return;
  for (const [k, b] of Object.entries(viewButtons)) b.classList.toggle('on', k === key);
  flight = {
    t: 0, dur: 1.4,
    p0: camera.position.clone(), p1: new THREE.Vector3().fromArray(v.pos),
    t0: controls.target.clone(), t1: new THREE.Vector3().fromArray(v.target),
    f0: camera.fov, f1: v.fov,
  };
}
setView(param('view', 'photo'));

let targetHour = tod.hour;
function setHour(h) { targetHour = h; slider.value = String(h); tod.set(h); }
setHour(tod.hour);

const clock = new THREE.Clock();
let frames = 0, fpsAcc = 0, fpsTime = 0, fps = 0;
const fog = new THREE.Color();

function updateWorld(time) {
  tod.set(lerp(tod.hour, targetHour, 0.12));
  slider.value = tod.hour.toFixed(2);
  sky.update(tod, camera, time);
  fog.copy(sky.fogColor);
  const p = tod.pal;
  sun.position.copy(tod.sunDir).multiplyScalar(1300).add(new THREE.Vector3(0, 120, 0));
  sun.color.copy(p.sun);
  sun.intensity = tod.sunElevation > -3 ? p.sunI * 1.3 : 0;
  sun.visible = sun.intensity > 0.001;
  hemi.color.copy(p.zenith).lerp(p.amb, 0.4);
  hemi.groundColor.copy(p.ground);
  hemi.intensity = p.ambI * 0.5;
  post.exposure = p.exp * 0.95;
  tower.update(tod, time, camera, fog);
  const gu = groundMat.userData.u;
  if (gu) { gu.uFogColor.value.copy(fog); gu.uNight.value = tod.lightsOn ? 1 : 0; }
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
  if (fps) stats.innerHTML = '<b>' + fps.toFixed(0) + '</b> fps &nbsp; <b>' + renderer.info.render.calls + '</b> calls<br><b>' +
    (renderer.info.render.triangles / 1000).toFixed(0) + 'k</b> tris &nbsp; ' + tod.hour.toFixed(2) + 'h';
  if (!window.__ready) {
    window.__ready = true;
    loading.classList.add('gone');
    setTimeout(() => loading.remove(), 900);
  }
}
renderer.setAnimationLoop(frame);

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  post.setSize(innerWidth, innerHeight);
});

window.__stats = () => ({ calls: renderer.info.render.calls, tris: renderer.info.render.triangles, hour: tod.hour, sunEl: tod.sunElevation, quality });
window.__setView = setView;
window.__setHour = setHour;
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
window.__THREE = THREE;
window.__world = { scene, camera, tower };
