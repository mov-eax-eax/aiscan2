# One-shot refactor: split the monolithic eif3/index.html inline module into
# ordered source fragments under eif3/src/, keeping a concatenation build.
import os, shutil

ROOT = r'F:\repo-aiscan2\eif3'
SRC = os.path.join(ROOT, 'src')
TMP = r'F:\repo-aiscan2\.eif3-team'
os.makedirs(SRC, exist_ok=True)
os.makedirs(TMP, exist_ok=True)

path = os.path.join(ROOT, 'index.html')
html = open(path, encoding='utf-8').read()
shutil.copyfile(path, os.path.join(TMP, 'index.old.html'))
lines = html.splitlines()

def sl(a, b):
    return '\n'.join(lines[a - 1:b])

def rep(text, old, new, count=1):
    assert text.count(old) >= count, 'MISSING: ' + old[:90]
    return text.replace(old, new)

def write(name, text):
    with open(os.path.join(SRC, name), 'w', encoding='utf-8', newline='\n') as f:
        f.write(text)
    print('wrote src/' + name, len(text.splitlines()), 'lines')

# --------------------------------------------------------------------------
# 00-three.js : CDN loader (top-level await, runs first in the bundle)
# --------------------------------------------------------------------------
three = '''/* 00-three.js — load three.js from a CDN with fallbacks.
   This fragment runs first and its top-level await gates the whole bundle. */
''' + sl(148, 171) + '\n'
write('00-three.js', three)

# --------------------------------------------------------------------------
# 10-utils.js : helpers + shared world constants
# --------------------------------------------------------------------------
utils = '''/* 10-utils.js — math helpers and the shared world constants.
   Everything in src/ is concatenated into one module scope, so these are
   simply in scope for every other fragment. */
''' + sl(173, 204) + '''

/* Shared layout constants — keep the modules agreeing about the map. */
const WORLD = {
  cityInner: 760,       // radius where the grey city floor starts
  cityOuter: 3400,      // radius of that floor
  ringY: 0.6,           // city-floor height (above ground=0, avoids z-fighting)
  riverZ: -330,         // Seine centre line (behind the tower)
  riverWidth: 220,
  waterY: 1.2,
  mallWidth: 58,        // Champ de Mars allée
  mallStart: 100,
  mallEnd: 740,
  groundY: 0,
};
'''
write('10-utils.js', utils)

# --------------------------------------------------------------------------
# 40-terrain.js : ground / plaza / city floor / river / bridge
# --------------------------------------------------------------------------
terrain_body = sl(438, 504)
terrain_body = rep(terrain_body, 'new THREE.RingGeometry(760, 3400, 96)',
                   'new THREE.RingGeometry(WORLD.cityInner, WORLD.cityOuter, 96)')
terrain_body = rep(terrain_body, 'urban.position.y = 0.02;', 'urban.position.y = WORLD.ringY;')
terrain_body = rep(terrain_body, 'plaza.position.y = 0.06;', 'plaza.position.y = 0.25;')
terrain_body = rep(terrain_body, 'new THREE.PlaneGeometry(58, 830), pathMat',
                   'new THREE.PlaneGeometry(WORLD.mallWidth, WORLD.mallEnd - WORLD.mallStart), pathMat')
terrain_body = rep(terrain_body, 'mall.position.set(0, 0.05, 511);',
                   'mall.position.set(0, 0.3, (WORLD.mallStart + WORLD.mallEnd) / 2);')
terrain_body = rep(terrain_body, 'riverWalk.position.set(0, 0.05, -158);',
                   'riverWalk.position.set(0, 0.3, -162.5);')
terrain_body = rep(terrain_body, 'new THREE.PlaneGeometry(9000, 220), waterMat',
                   'new THREE.PlaneGeometry(9000, WORLD.riverWidth), waterMat')
terrain_body = rep(terrain_body, 'river.position.set(0, 0.13, -330);',
                   'river.position.set(0, WORLD.waterY, WORLD.riverZ);')

terrain = '''/* 40-terrain.js — ground, plaza, city floor, the Seine and Pont d'Iéna.
   All near-coplanar surfaces are deliberately separated in Y; do not place
   overlay planes on the same Y or they will flicker. */
function buildTerrain(scene) {
  const groundMat = new THREE.MeshStandardMaterial({ color: 0x444d36, roughness: 1 });
  const plazaMat = new THREE.MeshStandardMaterial({ color: 0x9c9080, roughness: 0.92 });
  const pathMat = new THREE.MeshStandardMaterial({ color: 0xa99e8b, roughness: 0.95 });
  const waterMat = new THREE.MeshStandardMaterial({ color: 0x35697d, metalness: 0.35, roughness: 0.12 });
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0x968b7c, metalness: 0.02, roughness: 0.96 });

''' + terrain_body + '\n}\n'
write('40-terrain.js', terrain)

# --------------------------------------------------------------------------
# 30-sky.js : sky gradient, stars, sun/moon/fill lights + night handling
# --------------------------------------------------------------------------
sky_body = sl(324, 414)
sky = '''/* 30-sky.js — gradient sky, stars and the sun/moon/fill rig.
   Registers its own day/night behaviour with registerEnv. */
function buildSky(scene) {
''' + sky_body + '''

  registerEnv((t) => {
    sun.intensity = mix(2.8, 0.04, t);
    moon.intensity = mix(0, 0.6, t);
    fill.intensity = mix(0.5, 0.12, t);
    hemi.intensity = mix(1.05, 0.42, t);
    hemi.color.copy(PALETTE.hemiSkyDay).lerp(PALETTE.hemiSkyNight, t);
    hemi.groundColor.copy(PALETTE.hemiGroundDay).lerp(PALETTE.hemiGroundNight, t);
    skyMat.uniforms.uTop.value.copy(PALETTE.skyTopDay).lerp(PALETTE.skyTopNight, t);
    skyMat.uniforms.uBot.value.copy(PALETTE.skyBotDay).lerp(PALETTE.skyBotNight, t);
    starMat.opacity = t * 0.95;
  });
}
'''
write('30-sky.js', sky)

# --------------------------------------------------------------------------
# 50-tower.js : every bit of ironwork + sparkles + night lighting
# --------------------------------------------------------------------------
tower_body = sl(506, 869)
tower_body = rep(tower_body,
    'Math.sin(a) * 33.5, 57.6 + 3.25, Math.cos(a) * 33.5',
    'Math.sin(a) * 33.5, 57.6 + DECK_LIFT - 0.5 + 3.25, Math.cos(a) * 33.5')
tower_body = rep(tower_body,
    'Math.sin(a) * 19.5, 115.7 + 2.6, Math.cos(a) * 19.5',
    'Math.sin(a) * 19.5, 115.7 + DECK_LIFT - 0.5 + 2.6, Math.cos(a) * 19.5')
tower_body = rep(tower_body,
    'addMesh(new THREE.BoxGeometry(8, 6, 8), glassMat, 0, 279, 0);',
    'addMesh(new THREE.BoxGeometry(8, 6, 8), glassMat, 0, 276 + DECK_LIFT - 0.5 + 3, 0);')
tower_body = rep(tower_body,
    'addMesh(new THREE.BoxGeometry(4.4, 8, 4.4), glassMat, 0, 286, 0);',
    'addMesh(new THREE.BoxGeometry(4.4, 8, 4.4), glassMat, 0, 285.5, 0);')
tower_body = rep(tower_body, 'mastMat, 0, 313, 0);', 'mastMat, 0, 312.6, 0);')
tower_body = rep(tower_body, 'mastMat, 0, 329, 0);', 'mastMat, 0, 328.4, 0);')
tower_body = rep(tower_body, 'beacon.position.set(0, ANTENNA_TOP + 1.2, 0);',
                 'beacon.position.set(0, 331.95, 0);')
tower_body = rep(tower_body,
    'slabMat, 0, p.y - p.thickness / 2, 0);',
    'slabMat, 0, p.y + DECK_LIFT - p.thickness / 2, 0);')
tower_body = rep(tower_body, 'for (const p of platforms) addRailing(p.y, p.half - 0.8, p.rail);',
                 'for (const p of platforms) addRailing(p.y + DECK_LIFT, p.half - 0.8, p.rail);')
tower_body = rep(tower_body,
    'member([x, y, z], [x, y + height, z], postR * 1.5);',
    'member([x, y - 0.15, z], [x, y + height, z], postR * 1.5);')

sparkles_body = sl(1016, 1075)

tower = '''/* 50-tower.js — the iron lady. Everything is generated from the silhouette
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

''' + tower_body + '\n\n' + sparkles_body + '''

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
'''
write('50-tower.js', tower)

# --------------------------------------------------------------------------
# 60-city-blocks.js : the Paris urban fabric (team module, initial version)
# --------------------------------------------------------------------------
city_body = sl(871, 1014)
city_body = rep(city_body, 'p.set(t.x, h / 2, t.z);', 'p.set(t.x, h / 2 - 0.25, t.z);')
city = '''/* 60-city-blocks.js — the Paris urban fabric: street blocks, roofs, trees,
   lit windows. TEAM MODULE (owner: city-blocks).
   Contract: buildCityBlocks(scene) adds content and may call registerEnv /
   registerUpdater. Keep geometry instanced; target < 40k instances. */
function buildCityBlocks(scene) {
  const cityMat = new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.05, roughness: 0.9 });
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4a3a2a, roughness: 1 });
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x3f5c33, roughness: 0.95 });

''' + city_body + '''

  registerEnv((t) => {
    if (typeof windowMat !== 'undefined') windowMat.opacity = t * 0.6;
  });
}
'''
write('60-city-blocks.js', city)

# --------------------------------------------------------------------------
# 70-controls.js : orbit camera
# --------------------------------------------------------------------------
controls_body = sl(232, 293)
controls = '''/* 70-controls.js — damped orbit camera (pointer drag, wheel, pinch).
   Returns { orbit, updateCamera }. */
function createControls(renderer, camera, cameraTarget) {
''' + controls_body + '''

  updateCamera();
  return { orbit, updateCamera };
}
'''
write('70-controls.js', controls)

# --------------------------------------------------------------------------
# 90-app.js : composition root
# --------------------------------------------------------------------------
app = '''/* 90-app.js — composition root. Owns the renderer, camera, the frame loop and
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
'''
write('90-app.js', app)

# --------------------------------------------------------------------------
# shell index.html (dev shell; build inlines the bundle for dist/)
# --------------------------------------------------------------------------
shell = sl(1, 138).rstrip() + '''

<script type="module" src="./app.js"></script>
</body>
</html>
'''
with open(path, 'w', encoding='utf-8', newline='\n') as f:
    f.write(shell)
print('rewrote index.html shell', len(shell.splitlines()), 'lines')
print('DONE')
