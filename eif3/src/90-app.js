/* 90-app.js — composition root. Owns the renderer, camera, the frame loop and
   the HUD. It knows nothing about tower or city internals: builders register
   their own env/updater callbacks. */
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
} catch (err) {
  fail('WebGL could not be initialised in this browser.');
  throw err;
}
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.domElement.style.touchAction = 'none';
document.getElementById('app').appendChild(renderer.domElement);

const scene = new THREE.Scene();
initEnv(scene);

const camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 0.8, 12000);
const cameraTarget = new THREE.Vector3(0, 172, 0);
const { orbit, updateCamera } = createControls(renderer, camera, cameraTarget);

/* ---- scene assembly ---- */
buildSky(scene);
buildTerrain(scene);
buildTower(scene, renderer);
buildCityBlocks(scene);
buildCityLandmarks(scene);
buildCityLife(scene);

/* ---- HUD buttons ---- */
const nightBtn = document.getElementById('btn-night');
const nightLabel = document.getElementById('btn-night-label');
nightBtn.addEventListener('click', () => {
  ENV.nightTarget = ENV.nightTarget > 0.5 ? 0 : 1;
  const isNight = ENV.nightTarget > 0.5;
  nightLabel.textContent = isNight ? 'Day' : 'Night';
  nightBtn.classList.toggle('on', isNight);
});

const autoBtn = document.getElementById('btn-auto');
autoBtn.addEventListener('click', () => {
  orbit.auto = !orbit.auto;
  autoBtn.classList.toggle('on', orbit.auto);
});

if (ENV.nightTarget > 0.5) {
  nightLabel.textContent = 'Day';
  nightBtn.classList.add('on');
}

/* ---- resize ---- */
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
});

/* ---- frame loop ---- */
let frameCount = 0;
let last = performance.now();

function animate(now) {
  requestAnimationFrame(animate);

  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  const elapsed = now * 0.001;

  tickEnv(dt);

  if (orbit.auto && !orbit.dragging) orbit.ttheta += dt * 0.06;
  const k = 1 - Math.exp(-dt * 7.0);
  orbit.radius += (orbit.tr - orbit.radius) * k;
  orbit.phi += (orbit.tphi - orbit.phi) * k;
  orbit.theta += (orbit.ttheta - orbit.theta) * k;
  updateCamera();

  runUpdaters(dt, elapsed);
  renderer.toneMappingExposure = mix(1.0, 1.15, ENV.night);

  renderer.render(scene, camera);

  frameCount++;
  if (frameCount === 2) loaderEl.classList.add('hide');
}

requestAnimationFrame(animate);
