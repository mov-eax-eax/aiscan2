import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

// ============================================================
//   GTA 3D CLONE - v2: PLAYABLE
//   - Mission system (eliminate marked gang members)
//   - Enemies with AI that shoot back
//   - Edge-detection post-process (cel-shaded look)
//   - Better shooting (muzzle flash, hit markers, recoil, tracers)
//   - Combo system, damage indicator
// ============================================================

// ---------- GLOBALS ----------
const WORLD = { size: 800, blocks: 8, blockSize: 100, roadWidth: 14 };
const WEAPONS = {
  fists:  { name: 'Fists',   type: 'melee',  damage: 15,  fireRate: 0.4,  range: 2.5,  ammo: Infinity, maxAmmo: Infinity, spread: 0,    bullets: 1, model: null     },
  knife:  { name: 'Knife',   type: 'melee',  damage: 30,  fireRate: 0.3,  range: 2,    ammo: Infinity, maxAmmo: Infinity, spread: 0,    bullets: 1, model: 'knife'  },
  bat:    { name: 'Bat',     type: 'melee',  damage: 50,  fireRate: 0.6,  range: 3,    ammo: Infinity, maxAmmo: Infinity, spread: 0,    bullets: 1, model: 'bat'    },
  pistol: { name: 'Pistol',  type: 'ranged', damage: 25,  fireRate: 0.18, range: 60,   ammo: 12,  maxAmmo: 12,  reload: 1.5, spread: 0.02, bullets: 1, auto: false, model: 'pistol' },
  smg:    { name: 'SMG',     type: 'ranged', damage: 12,  fireRate: 0.07, range: 50,   ammo: 30,  maxAmmo: 30,  reload: 2,   spread: 0.06, bullets: 1, auto: true,  model: 'smg'    },
  shotgun:{ name: 'Shotgun', type: 'ranged', damage: 14,  fireRate: 0.55, range: 30,   ammo: 8,   maxAmmo: 8,   reload: 2.5, spread: 0.12, bullets: 6, auto: false, model: 'shotgun'},
  sniper: { name: 'Sniper',  type: 'ranged', damage: 200, fireRate: 1.2,  range: 300,  ammo: 5,   maxAmmo: 5,   reload: 2.5, spread: 0.003, bullets: 1, auto: false, model: 'sniper', scope: 2.2 },
  rocket: { name: 'Rocket',  type: 'ranged', damage: 100, fireRate: 1.5,  range: 200,  ammo: 4,   maxAmmo: 4,   reload: 3,   spread: 0,    bullets: 1, auto: false, model: 'rocket', explosive: true },
};
const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
const _skyColor = new THREE.Color(0x87ceeb);
scene.background = _skyColor.clone();
scene.fog = new THREE.Fog(0x87ceeb, 300, 700);

const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 1500);
const cameraYaw = { value: 0 };
const cameraPitch = { value: 0.3 };
const CAM_DIST = 7;
const CAM_HEIGHT = 3;

// ---------- POST-PROCESSING: LUMINANCE OUTLINES + BLOOM + GRADE ----------
// Luminance Sobel only — the simpler, reliable form of edge detection.
// (Earlier versions tried depth-texture outlines and ShaderPass clones
// of WebGLRenderTarget, which created feedback loops and cascaded into
// "too many errors". Luminance Sobel gives 80% of the look with zero risk.)
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));

const EdgeShader = {
  uniforms: {
    tDiffuse: { value: null },
    resolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) }
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform vec2 resolution;
    varying vec2 vUv;
    float lum(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }
    void main() {
      vec2 px = 1.0 / resolution;
      vec4 c = texture2D(tDiffuse, vUv);

      // 8-tap Sobel on luminance
      float lC  = lum(c.rgb);
      float lN  = lum(texture2D(tDiffuse, vUv + vec2(0.0,  px.y)).rgb);
      float lS  = lum(texture2D(tDiffuse, vUv + vec2(0.0, -px.y)).rgb);
      float lE  = lum(texture2D(tDiffuse, vUv + vec2( px.x, 0.0)).rgb);
      float lW  = lum(texture2D(tDiffuse, vUv + vec2(-px.x, 0.0)).rgb);
      float lNE = lum(texture2D(tDiffuse, vUv + vec2( px.x,  px.y)).rgb);
      float lNW = lum(texture2D(tDiffuse, vUv + vec2(-px.x,  px.y)).rgb);
      float lSE = lum(texture2D(tDiffuse, vUv + vec2( px.x, -px.y)).rgb);
      float lSW = lum(texture2D(tDiffuse, vUv + vec2(-px.x, -px.y)).rgb);
      float gx = -lNW - 2.0*lW - lSW + lNE + 2.0*lE + lSE;
      float gy = -lSW - 2.0*lS - lSE + lNW + 2.0*lN + lNE;
      float edge = sqrt(gx*gx + gy*gy);
      float edgeMask = smoothstep(0.18, 0.45, edge);

      vec3 col = mix(c.rgb, vec3(0.05, 0.05, 0.07), edgeMask * 0.85);

      // Vignette
      vec2 q = vUv - 0.5;
      col *= 1.0 - dot(q, q) * 0.55;

      // Saturation boost
      float g = lum(col);
      col = mix(vec3(g), col, 1.2);

      // Slight contrast lift
      col = (col - 0.5) * 1.05 + 0.5;

      gl_FragColor = vec4(col, c.a);
    }
  `
};
const edgePass = new ShaderPass(EdgeShader);
composer.addPass(edgePass);

// Subtle bloom on bright pixels (lights, muzzle flash, sun)
const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  0.4, 0.55, 0.85
);
composer.addPass(bloomPass);
composer.addPass(new OutputPass());

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
  edgePass.uniforms.resolution.value.set(window.innerWidth, window.innerHeight);
});

// ---------- INPUT ----------
const keys = {};
let mouseDown = false, rightMouseDown = false;
let pointerLocked = false;
const pauseEl = document.getElementById('pause');
const titleScreen = document.getElementById('titleScreen');
const playBtn = document.getElementById('playBtn');

function setWeapon(name) {
  if (!player.inventory.includes(name)) return;
  player.currentWeapon = name;
  player.weapon = name;
  player.weaponIndex = player.inventory.indexOf(name);
  player.ammo = WEAPONS[name].ammo;
  player.reloading = false;
  player.reloadTimer = 0;
  // attach gun mesh
  if (player.gun) {
    player.mesh.userData.armR.remove(player.gun);
    player.gun = null;
  }
  const model = WEAPONS[name].model;
  if (model) {
    player.gun = makeGunModel(model);
    if (model === 'bat' || model === 'knife') {
      player.gun.position.set(0, -0.5, 0.15);
      player.gun.rotation.set(0, 0, 0);
    } else {
      player.gun.position.set(0, -0.5, 0.1);
      player.gun.rotation.set(1.3, 0, 0);
    }
    player.mesh.userData.armR.add(player.gun);
  }
  setFPGun(name);
  updateWeaponHUD();
  showMessage(WEAPONS[name].name.toUpperCase(), 1);
}

function switchWeaponByIndex(i) {
  const owned = player.inventory;
  if (owned.length === 0) return;
  const idx = ((i % owned.length) + owned.length) % owned.length;
  setWeapon(owned[idx]);
}

function startReload() {
  const w = WEAPONS[player.currentWeapon];
  if (w.ammo === Infinity) return;
  if (player.ammo >= w.maxAmmo) return;
  if (player.money < 5) { showMessage('Need $5 to reload'); return; }
  if (player.reloading) return;
  player.reloading = true;
  player.reloadTimer = w.reload;
  showMessage('Reloading...', w.reload);
}

function doMelee() {
  const w = WEAPONS[player.currentWeapon];
  let nearest = null, nearD = w.range;
  for (const n of npcs) {
    if (n.dead) continue;
    const d = n.pos.distanceTo(player.pos);
    if (d < nearD) { nearD = d; nearest = n; }
  }
  for (const e of enemies) {
    if (e.dead) continue;
    const d = e.pos.distanceTo(player.pos);
    if (d < nearD) { nearD = d; nearest = e; }
  }
  if (nearest) {
    if (nearest.isEnemy) damageEnemy(nearest, w.damage);
    else damageNpc(nearest, w.damage);
    addWanted(1);
  }
  // swing animation
  const { armR } = player.mesh.userData;
  armR.rotation.x = -1.6;
  setTimeout(() => { armR.rotation.x = 0; }, 200);
  addRecoil();
}

function doShoot() {
  const w = WEAPONS[player.currentWeapon];
  if (player.ammo <= 0) {
    if (player.money >= 5) startReload();
    return;
  }
  player.ammo--;
  // Shoot straight forward (in the direction the player faces)
  const baseDir = new THREE.Vector3(Math.sin(player.yaw), 0, Math.cos(player.yaw)).normalize();
  const origin = player.pos.clone().add(new THREE.Vector3(0, 1.4, 0)).add(baseDir.clone().multiplyScalar(1.0));
  spawnMuzzleFlash(origin.clone().add(baseDir.clone().multiplyScalar(0.3)), player.yaw);
  // recoil
  cameraPitch.value = Math.min(1.1, cameraPitch.value + 0.05);
  cameraYaw.value += (Math.random() - 0.5) * 0.04;
  // fire bullets
  for (let i = 0; i < w.bullets; i++) {
    const d = baseDir.clone();
    d.x += (Math.random() - 0.5) * w.spread;
    d.y += (Math.random() - 0.5) * w.spread * 0.3;  // less vertical spread
    d.z += (Math.random() - 0.5) * w.spread;
    d.normalize();
    // aim correction if locked on - strong correction
    if (aimLock.target && !aimLock.target.dead) {
      const tp = aimLock.target.pos.clone().add(new THREE.Vector3(0, 1.2, 0));
      const corrected = tp.sub(origin).normalize();
      d.lerp(corrected, 0.85);
      d.normalize();
    }
    const bMesh = fireBullet(origin, d, false);
    if (w.explosive && bMesh) bMesh.userData.explosive = true;
  }
  addRecoil();
  updateWeaponHUD();
}

window.addEventListener('keydown', e => {
  keys[e.code] = true;
  // Weapon switching: 1-7 by index in inventory
  if (e.code.startsWith('Digit')) {
    const n = parseInt(e.code.slice(5)) - 1;
    if (n >= 0 && n < player.inventory.length) {
      setWeapon(player.inventory[n]);
      e.preventDefault();
    }
  }
  // Aim lock toggle
  if (e.code === 'KeyQ') {
    aimLock.toggle();
  }
  // Reload
  if (e.code === 'KeyR') {
    startReload();
  }
});
window.addEventListener('keyup', e => { keys[e.code] = false; });
canvas.addEventListener('mousedown', e => { if (e.button === 0) mouseDown = true; if (e.button === 2) rightMouseDown = true; });
window.addEventListener('mouseup', e => { if (e.button === 0) mouseDown = false; if (e.button === 2) rightMouseDown = false; });
canvas.addEventListener('contextmenu', e => e.preventDefault());

document.addEventListener('mousemove', e => {
  if (!pointerLocked) return;
  cameraYaw.value -= e.movementX * 0.0025;
  cameraPitch.value -= e.movementY * 0.0025;
  cameraPitch.value = Math.max(-0.4, Math.min(1.1, cameraPitch.value));
});

document.addEventListener('pointerlockchange', () => {
  pointerLocked = document.pointerLockElement === canvas;
  pauseEl.classList.toggle('hidden', pointerLocked);
  titleScreen.classList.toggle('hidden', pointerLocked);
});
playBtn.addEventListener('click', () => {
  titleScreen.classList.add('hidden');
  canvas.requestPointerLock();
});
canvas.addEventListener('click', () => { if (!pointerLocked) canvas.requestPointerLock(); });

// ---------- LIGHTING ----------
const sun = new THREE.DirectionalLight(0xffffff, 1.1);
sun.position.set(120, 200, 80);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
sun.shadow.camera.left = -250;
sun.shadow.camera.right = 250;
sun.shadow.camera.top = 250;
sun.shadow.camera.bottom = -250;
sun.shadow.camera.near = 0.5;
sun.shadow.camera.far = 600;
scene.add(sun);

scene.add(new THREE.HemisphereLight(0xb0d8ff, 0x404030, 0.6));
scene.add(new THREE.AmbientLight(0xffffff, 0.25));

// ---------- GROUND ----------
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(WORLD.size * 2, WORLD.size * 2),
  new THREE.MeshLambertMaterial({ color: 0x4a6b3a })
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

const basePlane = new THREE.Mesh(
  new THREE.PlaneGeometry(WORLD.size + 200, WORLD.size + 200),
  new THREE.MeshLambertMaterial({ color: 0x2a2a2a })
);
basePlane.rotation.x = -Math.PI / 2;
basePlane.position.y = -0.05;
basePlane.receiveShadow = true;
scene.add(basePlane);

// ============================================================
//   WORLD GENERATION
// ============================================================
const colliders = [];
const buildings = [];
const lampPosts = [];

function addBox(x, z, w, d, h, color, opts = {}) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshLambertMaterial({ color }));
  m.position.set(x, h / 2, z);
  m.castShadow = !opts.noShadow;
  m.receiveShadow = true;
  scene.add(m);
  if (opts.collide !== false) colliders.push({ x, z, w, d, h });
  return m;
}

// Pre-baked wall textures: 1 mesh per building instead of hundreds of window planes
const wallTextures = [];
function initWallTextures() {
  const baseColors = ['#8a8a8a', '#a08a70', '#5a6a78', '#b0a890', '#6a5a4a', '#9a8a78', '#7a6a5a', '#8a8a98'];
  for (const base of baseColors) {
    const c = document.createElement('canvas');
    c.width = 128; c.height = 128;
    const ctx = c.getContext('2d');
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, 128, 128);
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.fillRect(0, 0, 128, 2);
    ctx.fillRect(0, 126, 128, 2);
    for (let y = 0; y < 4; y++) {
      for (let x = 0; x < 4; x++) {
        const lit = Math.random() < 0.35;
        ctx.fillStyle = lit ? '#fff4b0' : '#2a3848';
        ctx.fillRect(x * 32 + 6, y * 32 + 10, 20, 14);
        ctx.fillStyle = 'rgba(255,255,255,0.15)';
        ctx.fillRect(x * 32 + 8, y * 32 + 11, 4, 6);
      }
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    wallTextures.push(tex);
  }
}
initWallTextures();

function makeBuilding(x, z, w, d, h) {
  const baseTex = wallTextures[Math.floor(Math.random() * wallTextures.length)];
  const sideXTex = baseTex.clone(); sideXTex.needsUpdate = true; sideXTex.colorSpace = THREE.SRGBColorSpace;
  sideXTex.wrapS = sideXTex.wrapT = THREE.RepeatWrapping;
  sideXTex.repeat.set(Math.max(1, w / 6), Math.max(1, h / 6));
  const sideZTex = baseTex.clone(); sideZTex.needsUpdate = true; sideZTex.colorSpace = THREE.SRGBColorSpace;
  sideZTex.wrapS = sideZTex.wrapT = THREE.RepeatWrapping;
  sideZTex.repeat.set(Math.max(1, d / 6), Math.max(1, h / 6));
  const matX = new THREE.MeshLambertMaterial({ map: sideXTex });
  const matZ = new THREE.MeshLambertMaterial({ map: sideZTex });
  const matTop = new THREE.MeshLambertMaterial({ color: 0x3a3a3a });
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), [matX, matX, matTop, matTop, matZ, matZ]);
  mesh.position.set(x, h / 2, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);
  colliders.push({ x, z, w, d, h });
  if (h > 12) {
    const roof = new THREE.Mesh(
      new THREE.BoxGeometry(w * 0.4, 2, d * 0.4),
      new THREE.MeshLambertMaterial({ color: 0x2a2a2a })
    );
    roof.position.set(x, h + 1, z);
    roof.castShadow = true;
    scene.add(roof);
  }
  // Rooftop details
  if (h > 14 && Math.random() < 0.6) {
    // AC unit cluster
    for (let a = 0; a < 1 + Math.floor(Math.random() * 3); a++) {
      const ac = new THREE.Mesh(
        new THREE.BoxGeometry(1.2 + Math.random() * 0.8, 0.8, 1.2 + Math.random() * 0.8),
        new THREE.MeshLambertMaterial({ color: 0x888888 })
      );
      ac.position.set(
        x + (Math.random() - 0.5) * (w - 3),
        h + 0.4,
        z + (Math.random() - 0.5) * (d - 3)
      );
      scene.add(ac);
    }
  }
  if (h > 22 && Math.random() < 0.35) {
    // Antenna
    const ant = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.08, 4 + Math.random() * 4, 5),
      new THREE.MeshLambertMaterial({ color: 0x444444 })
    );
    ant.position.set(x + (Math.random() - 0.5) * 2, h + 2.5, z + (Math.random() - 0.5) * 2);
    scene.add(ant);
    // small red light
    const light = new THREE.Mesh(
      new THREE.SphereGeometry(0.15, 6, 5),
      new THREE.MeshBasicMaterial({ color: 0xff2222 })
    );
    light.position.set(ant.position.x, ant.position.y + 2, ant.position.z);
    scene.add(light);
  }
  if (h > 26 && Math.random() < 0.25) {
    // Water tower (cylinder)
    const tank = new THREE.Mesh(
      new THREE.CylinderGeometry(1.4, 1.4, 2.2, 8),
      new THREE.MeshLambertMaterial({ color: 0x553322 })
    );
    tank.position.set(x, h + 1.5, z);
    scene.add(tank);
    // 4 legs
    for (let l = 0; l < 4; l++) {
      const leg = new THREE.Mesh(
        new THREE.BoxGeometry(0.15, 1.5, 0.15),
        new THREE.MeshLambertMaterial({ color: 0x444444 })
      );
      const ang = (l / 4) * Math.PI * 2;
      leg.position.set(x + Math.cos(ang) * 0.9, h + 0.4, z + Math.sin(ang) * 0.9);
      scene.add(leg);
    }
  }
  if (h > 10 && Math.random() < 0.25) {
    // Big wall sign (colored panel)
    const signColors = [0xff3344, 0xffaa00, 0x00aaff, 0x00dd66, 0xff66dd];
    const signColor = signColors[Math.floor(Math.random() * signColors.length)];
    const sign = new THREE.Mesh(
      new THREE.BoxGeometry(w * 0.5, h * 0.12, 0.4),
      new THREE.MeshBasicMaterial({ color: signColor })
    );
    sign.position.set(
      x + (Math.random() < 0.5 ? 1 : -1) * w * 0.1,
      h * (0.5 + Math.random() * 0.3),
      z + d / 2 + 0.25
    );
    scene.add(sign);
  }
  buildings.push({ x, z, w, d, h });
}

function makeTree(x, z) {
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.3, 0.4, 2, 5),
    new THREE.MeshLambertMaterial({ color: 0x4a2a16 })
  );
  trunk.position.set(x, 1, z);
  scene.add(trunk);
  const leaves = new THREE.Mesh(
    new THREE.SphereGeometry(1.6, 6, 5),
    new THREE.MeshLambertMaterial({ color: 0x2f6b2f })
  );
  leaves.position.set(x, 2.6, z);
  leaves.castShadow = true;
  scene.add(leaves);
  colliders.push({ x, z, w: 1.2, d: 1.2, h: 4 });
}

function makeLamp(x, z) {
  const post = new THREE.Mesh(
    new THREE.CylinderGeometry(0.15, 0.15, 5, 5),
    new THREE.MeshLambertMaterial({ color: 0x222222 })
  );
  post.position.set(x, 2.5, z);
  scene.add(post);
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.4, 6, 5),
    new THREE.MeshBasicMaterial({ color: 0xffeeaa })
  );
  head.position.set(x, 5, z);
  scene.add(head);
  lampPosts.push({ x, z });
}

function makeDumpster(x, z, rot = 0) {
  const d = new THREE.Mesh(
    new THREE.BoxGeometry(3, 1.6, 1.6),
    new THREE.MeshLambertMaterial({ color: 0x2a5a2a })
  );
  d.position.set(x, 0.8, z);
  d.rotation.y = rot;
  scene.add(d);
  colliders.push({ x, z, w: 3, d: 1.6, h: 1.6 });
}

// Roads
const roadMat = new THREE.MeshLambertMaterial({ color: 0x2a2a2a });
const sideMat = new THREE.MeshLambertMaterial({ color: 0x6a6a6a });
const stripeMat = new THREE.MeshBasicMaterial({ color: 0xffee00 });

for (let i = 0; i <= WORLD.blocks; i++) {
  const offset = -WORLD.size / 2 + i * WORLD.blockSize;
  const hRoad = new THREE.Mesh(new THREE.PlaneGeometry(WORLD.size, WORLD.roadWidth), roadMat);
  hRoad.rotation.x = -Math.PI / 2; hRoad.position.set(0, 0.01, offset); hRoad.receiveShadow = true; scene.add(hRoad);
  for (let s = -WORLD.size / 2; s < WORLD.size / 2; s += 6) {
    const stripe = new THREE.Mesh(new THREE.PlaneGeometry(3, 0.3), stripeMat);
    stripe.rotation.x = -Math.PI / 2; stripe.position.set(s, 0.02, offset); scene.add(stripe);
  }
  const vRoad = new THREE.Mesh(new THREE.PlaneGeometry(WORLD.roadWidth, WORLD.size), roadMat);
  vRoad.rotation.x = -Math.PI / 2; vRoad.position.set(offset, 0.01, 0); vRoad.receiveShadow = true; scene.add(vRoad);
  for (let s = -WORLD.size / 2; s < WORLD.size / 2; s += 6) {
    const stripe = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 3), stripeMat);
    stripe.rotation.x = -Math.PI / 2; stripe.position.set(offset, 0.02, s); scene.add(stripe);
  }
}

// Sidewalks
const blockHalf = WORLD.blockSize / 2;
const swWidth = (WORLD.blockSize - WORLD.roadWidth) / 2;
for (let bx = 0; bx < WORLD.blocks; bx++) {
  for (let bz = 0; bz < WORLD.blocks; bz++) {
    const cx = -WORLD.size / 2 + bx * WORLD.blockSize + blockHalf;
    const cz = -WORLD.size / 2 + bz * WORLD.blockSize + blockHalf;
    const innerW = WORLD.blockSize - WORLD.roadWidth * 2;
    const plot = new THREE.Mesh(new THREE.PlaneGeometry(innerW, innerW), new THREE.MeshLambertMaterial({ color: 0x4a6b3a }));
    plot.rotation.x = -Math.PI / 2; plot.position.set(cx, 0.015, cz); plot.receiveShadow = true; scene.add(plot);
    const swN = new THREE.Mesh(new THREE.PlaneGeometry(innerW, swWidth), sideMat);
    swN.rotation.x = -Math.PI / 2; swN.position.set(cx, 0.012, cz + innerW / 2 + swWidth / 2); swN.receiveShadow = true; scene.add(swN);
    const swS = swN.clone(); swS.position.z = cz - innerW / 2 - swWidth / 2; scene.add(swS);
    const swE = new THREE.Mesh(new THREE.PlaneGeometry(swWidth, innerW), sideMat);
    swE.rotation.x = -Math.PI / 2; swE.position.set(cx + innerW / 2 + swWidth / 2, 0.012, cz); swE.receiveShadow = true; scene.add(swE);
    const swW = swE.clone(); swW.position.x = cx - innerW / 2 - swWidth / 2; scene.add(swW);
  }
}

// Buildings
for (let bx = 0; bx < WORLD.blocks; bx++) {
  for (let bz = 0; bz < WORLD.blocks; bz++) {
    const cx = -WORLD.size / 2 + bx * WORLD.blockSize + blockHalf;
    const cz = -WORLD.size / 2 + bz * WORLD.blockSize + blockHalf;
    const innerW = WORLD.blockSize - WORLD.roadWidth * 2 - 6;
    const count = 1 + Math.floor(Math.random() * 3);
    for (let k = 0; k < count; k++) {
      const bw = 10 + Math.random() * 20;
      const bd = 10 + Math.random() * 20;
      const bh = 8 + Math.random() * 40;
      const ox = (Math.random() - 0.5) * (innerW - bw);
      const oz = (Math.random() - 0.5) * (innerW - bd);
      makeBuilding(cx + ox, cz + oz, bw, bd, bh);
    }
  }
}

// Lamps
for (let i = 0; i <= WORLD.blocks; i++) {
  for (let j = 0; j <= WORLD.blocks; j++) {
    const x = -WORLD.size / 2 + i * WORLD.blockSize;
    const z = -WORLD.size / 2 + j * WORLD.blockSize;
    if (Math.abs(x) < WORLD.size / 2 - 5 && Math.abs(z) < WORLD.size / 2 - 5) {
      makeLamp(x + WORLD.roadWidth / 2 + 1, z + WORLD.roadWidth / 2 + 1);
      makeLamp(x - WORLD.roadWidth / 2 - 1, z - WORLD.roadWidth / 2 - 1);
    }
  }
}

// Trees & dumpsters
for (let i = 0; i < 40; i++) {
  const x = (Math.random() - 0.5) * (WORLD.size - 40);
  const z = (Math.random() - 0.5) * (WORLD.size - 40);
  if (Math.abs(x % WORLD.blockSize) < WORLD.blockSize / 2 - 8 &&
      Math.abs(z % WORLD.blockSize) < WORLD.blockSize / 2 - 8) {
    makeTree(x, z);
  }
}
for (let i = 0; i < 15; i++) {
  const x = (Math.random() - 0.5) * (WORLD.size - 40);
  const z = (Math.random() - 0.5) * (WORLD.size - 40);
  makeDumpster(x, z, Math.random() * Math.PI);
}

// ============================================================
//   CLOUDS (skybox sprites)
// ============================================================
function makeCloudTexture() {
  const size = 256;
  const c = document.createElement('canvas');
  c.width = size; c.height = size / 2;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, c.width, c.height);
  for (let i = 0; i < 50; i++) {
    const x = c.width / 2 + (Math.random() - 0.5) * c.width * 0.75;
    const y = c.height / 2 + (Math.random() - 0.5) * c.height * 0.55;
    const r = 22 + Math.random() * 40;
    const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, 'rgba(255,255,255,0.85)');
    grad.addColorStop(0.5, 'rgba(255,255,255,0.35)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
const cloudTex = makeCloudTexture();
const clouds = [];
for (let i = 0; i < 36; i++) {
  const cloud = new THREE.Sprite(new THREE.SpriteMaterial({
    map: cloudTex, transparent: true, opacity: 0.65, depthWrite: false
  }));
  cloud.position.set(
    (Math.random() - 0.5) * 1400,
    160 + Math.random() * 100,
    (Math.random() - 0.5) * 1400
  );
  const s = 100 + Math.random() * 80;
  cloud.scale.set(s, s * 0.5, 1);
  scene.add(cloud);
  clouds.push(cloud);
}
function updateClouds(dt) {
  for (const c of clouds) {
    c.position.x += dt * 4;
    if (c.position.x > 720) c.position.x = -720;
  }
}

// ============================================================
//   PLAYER
// ============================================================
function makePed(skinColor, shirtColor, pantsColor, opts = {}) {
  const o = Object.assign({
    hairColor: 0x222222,
    hasHat: false,
    hasVest: false,
    hasHeadband: false,
    headbandColor: 0xdd0000,
    bodyType: 'normal',  // normal, heavy, thin
    skinTone: skinColor
  }, opts);

  const g = new THREE.Group();
  const mat = (c) => new THREE.MeshLambertMaterial({ color: c });

  let sx = 1, sy = 1, sz = 1;
  if (o.bodyType === 'heavy') { sx = 1.25; sy = 1.05; sz = 1.25; }
  if (o.bodyType === 'thin')  { sx = 0.85; sy = 1.0;  sz = 0.85; }

  // Legs (cylinders)
  const legGeo = new THREE.CylinderGeometry(0.16 * sx, 0.18 * sx, 1.0, 6);
  const legL = new THREE.Mesh(legGeo, mat(pantsColor)); legL.position.set(-0.22 * sx, 0.5, 0); g.add(legL);
  const legR = new THREE.Mesh(legGeo, mat(pantsColor)); legR.position.set(0.22 * sx, 0.5, 0); g.add(legR);

  // Feet
  const footGeo = new THREE.BoxGeometry(0.28 * sx, 0.12, 0.5);
  const footL = new THREE.Mesh(footGeo, mat(0x111111)); footL.position.set(-0.22 * sx, 0.08, 0.07); g.add(footL);
  const footR = new THREE.Mesh(footGeo, mat(0x111111)); footR.position.set(0.22 * sx, 0.08, 0.07); g.add(footR);

  // Torso
  const torso = new THREE.Mesh(
    new THREE.BoxGeometry(0.9 * sx, 1.2 * sy, 0.5 * sz),
    mat(shirtColor)
  );
  torso.position.set(0, 1.6, 0);
  g.add(torso);

  // Belt
  const belt = new THREE.Mesh(
    new THREE.BoxGeometry(0.92 * sx, 0.12, 0.52 * sz),
    mat(0x2a1a0a)
  );
  belt.position.set(0, 1.0, 0);
  g.add(belt);

  // Vest
  if (o.hasVest) {
    const vest = new THREE.Mesh(
      new THREE.BoxGeometry(0.96 * sx, 0.9 * sy, 0.54 * sz),
      mat(0x1a1a1a)
    );
    vest.position.set(0, 1.6, 0.02);
    g.add(vest);
  }

  // Arms (cylinders)
  const armGeo = new THREE.CylinderGeometry(0.11 * sx, 0.12 * sx, 1.0, 6);
  const armL = new THREE.Mesh(armGeo, mat(shirtColor)); armL.position.set(-0.6 * sx, 1.6, 0); g.add(armL);
  const armR = new THREE.Mesh(armGeo, mat(shirtColor)); armR.position.set(0.6 * sx, 1.6, 0); g.add(armR);

  // Hands
  const handGeo = new THREE.SphereGeometry(0.11, 6, 4);
  const handL = new THREE.Mesh(handGeo, mat(skinColor)); handL.position.set(-0.6 * sx, 1.05, 0); g.add(handL);
  const handR = new THREE.Mesh(handGeo, mat(skinColor)); handR.position.set(0.6 * sx, 1.05, 0); g.add(handR);

  // Neck
  const neck = new THREE.Mesh(
    new THREE.CylinderGeometry(0.1, 0.13, 0.2, 6),
    mat(skinColor)
  );
  neck.position.set(0, 2.25, 0);
  g.add(neck);

  // Head
  const head = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 0.55, 0.5),
    mat(skinColor)
  );
  head.position.set(0, 2.5, 0);
  g.add(head);

  // Hair / hat
  if (o.hasHat) {
    const cap = new THREE.Mesh(
      new THREE.CylinderGeometry(0.32, 0.32, 0.18, 8),
      mat(0x111111)
    );
    cap.position.set(0, 2.92, 0);
    g.add(cap);
    const brim = new THREE.Mesh(
      new THREE.CylinderGeometry(0.45, 0.45, 0.04, 10),
      mat(0x111111)
    );
    brim.position.set(0, 2.82, 0.08);
    g.add(brim);
  } else {
    const hair = new THREE.Mesh(
      new THREE.BoxGeometry(0.55, 0.18, 0.55),
      mat(o.hairColor)
    );
    hair.position.set(0, 2.82, 0);
    g.add(hair);
  }

  // Headband
  if (o.hasHeadband) {
    const hb = new THREE.Mesh(
      new THREE.BoxGeometry(0.6, 0.1, 0.6),
      mat(o.headbandColor)
    );
    hb.position.set(0, 2.65, 0);
    g.add(hb);
  }

  g.userData = { armL, armR, legL, legR, handL, handR, footL, footR };
  return g;
}

// Gun models - visually distinct per weapon type
function makeGunModel(type) {
  const g = new THREE.Group();
  const mat = (c, em) => new THREE.MeshLambertMaterial({ color: c, emissive: em || 0x000000 });
  const emMat = (c, em) => new THREE.MeshBasicMaterial({ color: c });

  if (type === 'pistol') {
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.13, 0.2), mat(0x444a55, 0x111111)); g.add(body);
    const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.18), mat(0x222222, 0x000000));
    barrel.position.set(0, 0.05, 0.18); g.add(barrel);
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.18, 0.1), mat(0x3a3a3a, 0x000000));
    grip.position.set(0, -0.13, -0.05); g.add(grip);
    const sight = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.03, 0.02), emMat(0xffaa00, 0xffaa00));
    sight.position.set(0, 0.08, 0.08); g.add(sight);
  } else if (type === 'knife') {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.12, 0.32), mat(0xdddddd, 0x222222));
    blade.position.set(0, 0.05, 0.16); g.add(blade);
    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.16, 0.12), mat(0x663311, 0x110800));
    handle.position.set(0, -0.04, 0); g.add(handle);
  } else if (type === 'bat') {
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.6, 6), mat(0xaa7744, 0x110800));
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0, 0.25);
    g.add(barrel);
    const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.2, 6), mat(0x553311, 0x110800));
    grip.rotation.x = Math.PI / 2;
    grip.position.set(0, 0, -0.1);
    g.add(grip);
  } else if (type === 'smg') {
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.14, 0.45), mat(0x444a55, 0x111111)); g.add(body);
    const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.22), mat(0x222222, 0x000000));
    barrel.position.set(0, 0.05, 0.32); g.add(barrel);
    const mag = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.18, 0.12), mat(0x222222, 0x000000));
    mag.position.set(0, -0.16, 0.05); g.add(mag);
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.1, 0.18), mat(0x444444, 0x000000));
    stock.position.set(0, 0.0, -0.28); g.add(stock);
  } else if (type === 'shotgun') {
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.14, 0.4), mat(0x444a55, 0x111111)); g.add(body);
    const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, 0.5), mat(0x222222, 0x000000));
    barrel.position.set(0, 0.05, 0.4); g.add(barrel);
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.2, 0.22), mat(0x663311, 0x110800));
    stock.position.set(0, -0.04, -0.32); g.add(stock);
    const pump = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.1), mat(0x663311, 0x110800));
    pump.position.set(0, -0.07, 0.18); g.add(pump);
  } else if (type === 'sniper') {
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.12, 0.55), mat(0x3a3a3a, 0x111111)); g.add(body);
    const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.45), mat(0x111111, 0x000000));
    barrel.position.set(0, 0.05, 0.48); g.add(barrel);
    const scope = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.18, 8), mat(0x111111, 0x000000));
    scope.rotation.x = Math.PI / 2;
    scope.position.set(0, 0.14, 0.05); g.add(scope);
    const scopeLens = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.02, 8), emMat(0x66ccff, 0x66ccff));
    scopeLens.rotation.x = Math.PI / 2;
    scopeLens.position.set(0, 0.14, 0.14); g.add(scopeLens);
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.16, 0.25), mat(0x663311, 0x110800));
    stock.position.set(0, -0.02, -0.4); g.add(stock);
  } else if (type === 'rocket') {
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.16, 0.45), mat(0x666622, 0x111100)); g.add(body);
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.3, 8), mat(0x333333, 0x000000));
    tube.rotation.x = Math.PI / 2;
    tube.position.set(0, 0.04, 0.32); g.add(tube);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.18, 6), emMat(0xff4400, 0xff4400));
    tip.rotation.x = Math.PI / 2;
    tip.position.set(0, 0, -0.32); g.add(tip);
  }
  return g;
}

const player = {
  mesh: makePed(0xe8b88a, 0x2244aa, 0x111122, { hairColor: 0x2a1a0a, hasVest: false }),
  pos: new THREE.Vector3(20, 0, 20),
  vel: new THREE.Vector3(),
  yaw: 0,
  hp: 100,
  armor: 0,
  money: 500,
  inventory: ['pistol', 'fists'],
  weaponIndex: 0,
  currentWeapon: 'pistol',
  gun: null,
  ammo: 12,
  wanted: 0,
  state: 'onfoot',
  inVehicle: null,
  walkPhase: 0,
  jumpVel: 0,
  onGround: true,
  invincible: 0,
  wantedTimer: 0,
  meleeCooldown: 0,
  shootCooldown: 0,
  reloadTimer: 0,
  reloading: false,
  mouseWasDown: false,
  scopeActive: false,
  dead: false
};
scene.add(player.mesh);
player.mesh.position.copy(player.pos);

// First-person gun (attached to camera so always visible in third-person view too)
const fpGun = new THREE.Group();
fpGun.visible = false;
camera.add(fpGun);
scene.add(camera);
let fpGunModel = null;
function setFPGun(weaponName) {
  if (fpGunModel) { fpGun.remove(fpGunModel); fpGunModel = null; }
  const w = WEAPONS[weaponName];
  if (!w || !w.model) { fpGun.visible = false; return; }
  fpGunModel = makeGunModel(w.model);
  // Scale up and position in lower-right of view
  fpGunModel.scale.set(2.5, 2.5, 2.5);
  fpGunModel.position.set(0.35, -0.35, -0.7);
  fpGunModel.rotation.set(0, Math.PI, 0);
  fpGun.add(fpGunModel);
  fpGun.visible = true;
}

// Aim lock state
const aimLock = {
  target: null,
  range: 50,
  indicator: null,
  toggle() {
    if (this.target) { this.target = null; return; }
    this.target = this.findBestTarget();
  },
  findBestTarget() {
    const camDir = new THREE.Vector3();
    camera.getWorldDirection(camDir);
    let best = null, bestScore = -Infinity;
    for (const e of enemies) {
      if (e.dead) continue;
      const dist = e.pos.distanceTo(player.pos);
      if (dist > this.range) continue;
      const toEnemy = e.pos.clone().sub(camera.position).normalize();
      if (toEnemy.dot(camDir) < 0.6) continue;
      const sp = e.pos.clone().add(new THREE.Vector3(0, 1.5, 0));
      sp.project(camera);
      const off = Math.hypot(sp.x, sp.y);
      if (off > 0.25) continue;
      const score = (1 / dist) - off;
      if (score > bestScore) { bestScore = score; best = e; }
    }
    return best;
  },
  update() {
    if (this.target && (this.target.dead || this.target.pos.distanceTo(player.pos) > this.range)) {
      this.target = null;
    }
  }
};
// 3D lock-on indicator (wireframe box around target)
aimLock.indicator = new THREE.LineSegments(
  new THREE.EdgesGeometry(new THREE.BoxGeometry(2.0, 3.2, 2.0)),
  new THREE.LineBasicMaterial({ color: 0xff2222, transparent: true, opacity: 0.9 })
);
aimLock.indicator.visible = false;
scene.add(aimLock.indicator);

// ============================================================
//   VEHICLES
// ============================================================
function makeCar(bodyColor) {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color: bodyColor });
  const tireMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
  const glassMat = new THREE.MeshLambertMaterial({ color: 0x223344, transparent: true, opacity: 0.7 });
  const chassis = new THREE.Mesh(new THREE.BoxGeometry(2, 0.5, 4.2), bodyMat);
  chassis.position.y = 0.55; g.add(chassis);
  const cab = new THREE.Mesh(new THREE.BoxGeometry(1.85, 0.9, 2.2), bodyMat);
  cab.position.set(0, 1.25, -0.2); g.add(cab);
  const ws = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.7, 0.1), glassMat);
  ws.position.set(0, 1.3, 0.91); g.add(ws);
  const rw = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.7, 0.1), glassMat);
  rw.position.set(0, 1.3, -1.31); rw.rotation.x = -0.2; g.add(rw);
  const hlMat = new THREE.MeshBasicMaterial({ color: 0xfff7c0 });
  const hl1 = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.2, 0.1), hlMat); hl1.position.set(-0.6, 0.7, 2.15); g.add(hl1);
  const hl2 = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.2, 0.1), hlMat); hl2.position.set(0.6, 0.7, 2.15); g.add(hl2);
  const tlMat = new THREE.MeshBasicMaterial({ color: 0xff3030 });
  const tl1 = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.15, 0.1), tlMat); tl1.position.set(-0.6, 0.7, -2.15); g.add(tl1);
  const tl2 = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.15, 0.1), tlMat); tl2.position.set(0.6, 0.7, -2.15); g.add(tl2);
  const wheelG = new THREE.CylinderGeometry(0.4, 0.4, 0.3, 8);
  const wheels = [];
  [[-0.9, 0.4, 1.4], [0.9, 0.4, 1.4], [-0.9, 0.4, -1.4], [0.9, 0.4, -1.4]].forEach(p => {
    const w = new THREE.Mesh(wheelG, tireMat);
    w.rotation.z = Math.PI / 2; w.position.set(...p); g.add(w); wheels.push(w);
  });
  g.userData = { wheels };
  return g;
}

const carColors = [0xcc2222, 0x2266cc, 0x22aa22, 0xeebb00, 0x222222, 0xeeeeee, 0x884422, 0x662288, 0x00aaaa, 0xdd4488];
const vehicles = [];

function spawnCar(x, z, rot = 0, isPolice = false) {
  const color = isPolice ? 0x000000 : carColors[Math.floor(Math.random() * carColors.length)];
  const mesh = makeCar(color);
  mesh.position.set(x, 0, z);
  mesh.rotation.y = rot;
  scene.add(mesh);
  const car = {
    mesh, pos: mesh.position, vel: new THREE.Vector3(), yaw: rot,
    speed: 0,
    isPolice,
    hp: 100,
    occupied: false,
    driver: null
  };
  vehicles.push(car);
  return car;
}

for (let i = 0; i < 28; i++) {
  const x = (Math.random() - 0.5) * (WORLD.size - 30);
  const z = (Math.random() - 0.5) * (WORLD.size - 30);
  const blockX = Math.round((x + WORLD.size / 2) / WORLD.blockSize);
  const blockZ = Math.round((z + WORLD.size / 2) / WORLD.blockSize);
  const cx = -WORLD.size / 2 + blockX * WORLD.blockSize;
  const cz = -WORLD.size / 2 + blockZ * WORLD.blockSize;
  if (Math.random() < 0.5) {
    spawnCar(cx + (Math.random() < 0.5 ? -3 : 3), cz + (Math.random() - 0.5) * (WORLD.blockSize - 20), Math.random() < 0.5 ? 0 : Math.PI);
  } else {
    spawnCar(cx + (Math.random() - 0.5) * (WORLD.blockSize - 20), cz + (Math.random() < 0.5 ? -3 : 3), Math.random() < 0.5 ? Math.PI / 2 : -Math.PI / 2);
  }
}

// ============================================================
//   CIVILIAN NPCs
// ============================================================
const npcs = [];
const npcColors = [
  [0xe8b88a, 0xcc3344, 0x222244],
  [0xc89870, 0x44aa66, 0x333333],
  [0xb88a6a, 0xffaa22, 0x222222],
  [0xeed0b8, 0x6622aa, 0x444444],
  [0x886644, 0x22aacc, 0x222222],
  [0xffd8b8, 0xee44aa, 0x222222],
];

function spawnNpc() {
  const c = npcColors[Math.floor(Math.random() * npcColors.length)];
  const mesh = makePed(...c);
  const bx = Math.floor(Math.random() * WORLD.blocks);
  const bz = Math.floor(Math.random() * WORLD.blocks);
  const cx = -WORLD.size / 2 + bx * WORLD.blockSize + WORLD.blockSize / 2;
  const cz = -WORLD.size / 2 + bz * WORLD.blockSize + WORLD.blockSize / 2;
  const inner = WORLD.blockSize - WORLD.roadWidth * 2;
  const sw = (inner - WORLD.roadWidth) / 2;
  const side = Math.floor(Math.random() * 4);
  const offX = (Math.random() - 0.5) * (inner - 4);
  const offZ = (Math.random() - 0.5) * (inner - 4);
  let x, z;
  if (side === 0) { x = cx + offX; z = cz + inner / 2 + sw / 2; }
  else if (side === 1) { x = cx + offX; z = cz - inner / 2 - sw / 2; }
  else if (side === 2) { x = cx + inner / 2 + sw / 2; z = cz + offZ; }
  else { x = cx - inner / 2 - sw / 2; z = cz + offZ; }
  mesh.position.set(x, 0, z);
  scene.add(mesh);
  const npc = {
    mesh, pos: mesh.position, vel: new THREE.Vector3(),
    yaw: Math.random() * Math.PI * 2, targetYaw: Math.random() * Math.PI * 2,
    walkPhase: Math.random() * 10, state: 'walk', stateTimer: 2 + Math.random() * 4,
    walkSpeed: 1 + Math.random() * 1.5,
    hp: 30, dead: false, isEnemy: false
  };
  npcs.push(npc);
  return npc;
}
for (let i = 0; i < 30; i++) spawnNpc();

// ============================================================
//   ENEMY NPCs (GANG MEMBERS - FIGHT BACK)
// ============================================================
const enemies = [];
// Enemy archetypes: thug, heavy, boss, sniper
const ENEMY_TYPES = {
  thug:   { skin: 0xc89870, shirt: 0xaa1111, pants: 0x222222, hat: false, vest: false, headband: true,  headbandColor: 0xdd0000, hairColor: 0x222222, bodyType: 'normal', hp: 60,  weapon: 'pistol',  speed: 3.2, fireRate: 1.4, range: 22, aggro: 25 },
  heavy:  { skin: 0xa07050, shirt: 0x111111, pants: 0x222222, hat: false, vest: true,  headband: false, headbandColor: 0x000000, hairColor: 0x222222, bodyType: 'heavy', hp: 120, weapon: 'shotgun', speed: 2.6, fireRate: 1.8, range: 18, aggro: 22 },
  boss:   { skin: 0xb88a6a, shirt: 0xcc9900, pants: 0x222222, hat: true,  vest: true,  headband: false, headbandColor: 0x000000, hairColor: 0x000000, bodyType: 'heavy', hp: 180, weapon: 'smg',     speed: 3.0, fireRate: 0.6, range: 28, aggro: 30 },
  sniper: { skin: 0xeed0b8, shirt: 0x2a4a2a, pants: 0x111111, hat: true,  vest: false, headband: false, headbandColor: 0x000000, hairColor: 0x224422, bodyType: 'thin',  hp: 50,  weapon: 'sniper',  speed: 3.4, fireRate: 2.2, range: 45, aggro: 35 }
};
function makeEnemyPed(type) {
  const t = ENEMY_TYPES[type];
  const ped = makePed(t.skin, t.shirt, t.pants, {
    hairColor: t.hairColor, hasHat: t.hat, hasVest: t.vest,
    hasHeadband: t.headband, headbandColor: t.headbandColor, bodyType: t.bodyType
  });
  // Attach their weapon
  const gunType = WEAPONS[t.weapon].model;
  if (gunType) {
    const gun = makeGunModel(gunType);
    gun.position.set(0, 0.5, 0.18);
    ped.userData.armR.add(gun);
    ped.userData.gun = gun;
  }
  return ped;
}

function spawnEnemy(type, isTarget) {
  type = type || (Math.random() < 0.55 ? 'thug' : Math.random() < 0.6 ? 'heavy' : Math.random() < 0.6 ? 'sniper' : 'boss');
  const t = ENEMY_TYPES[type];
  const bx = Math.floor(Math.random() * WORLD.blocks);
  const bz = Math.floor(Math.random() * WORLD.blocks);
  const cx = -WORLD.size / 2 + bx * WORLD.blockSize + WORLD.blockSize / 2;
  const cz = -WORLD.size / 2 + bz * WORLD.blockSize + WORLD.blockSize / 2;
  const inner = WORLD.blockSize - WORLD.roadWidth * 2;
  const sw = (inner - WORLD.roadWidth) / 2;
  const side = Math.floor(Math.random() * 4);
  const offX = (Math.random() - 0.5) * (inner - 6);
  const offZ = (Math.random() - 0.5) * (inner - 6);
  let x, z;
  if (side === 0) { x = cx + offX; z = cz + inner / 2 + sw / 2; }
  else if (side === 1) { x = cx + offX; z = cz - inner / 2 - sw / 2; }
  else if (side === 2) { x = cx + inner / 2 + sw / 2; z = cz + offZ; }
  else { x = cx - inner / 2 - sw / 2; z = cz + offZ; }
  const mesh = makeEnemyPed(type);
  mesh.position.set(x, 0, z);
  scene.add(mesh);
  const enemy = {
    type,
    mesh, pos: mesh.position, vel: new THREE.Vector3(),
    yaw: Math.random() * Math.PI * 2, targetYaw: Math.random() * Math.PI * 2,
    walkPhase: Math.random() * 10,
    state: 'patrol', stateTimer: 2 + Math.random() * 4,
    shootCooldown: 1 + Math.random() * 2,
    hp: t.hp, maxHp: t.hp, dead: false, isEnemy: true,
    isTarget: isTarget || false,
    weapon: t.weapon, speed: t.speed, fireRate: t.fireRate, range: t.range, aggro: t.aggro,
    marker: null
  };
  enemies.push(enemy);
  if (isTarget) attachTargetMarker(enemy);
  return enemy;
}

// ============================================================
//   MARKERS (3D world indicators)
// ============================================================
const markers = [];
function makeMarker(color) {
  const g = new THREE.Group();
  const arrow = new THREE.Mesh(
    new THREE.ConeGeometry(0.7, 1.4, 6),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9 })
  );
  arrow.rotation.x = Math.PI;
  g.add(arrow);
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.8, 0.1, 6, 16),
    new THREE.MeshBasicMaterial({ color })
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = -0.4;
  g.add(ring);
  return g;
}
function attachTargetMarker(enemy) {
  const m = makeMarker(0xff2222);
  m.position.set(enemy.pos.x, 4, enemy.pos.z);
  scene.add(m);
  enemy.marker = m;
  markers.push({ mesh: m, target: enemy, phase: Math.random() * 10, baseY: 4, active: true });
}
function attachMissionGiverMarker(target) {
  const m = makeMarker(0xffeb3b);
  m.position.set(target.pos.x, 4, target.pos.z);
  scene.add(m);
  target.marker = m;
  markers.push({ mesh: m, target, phase: 0, baseY: 4, active: true });
}
function updateMarkers(dt) {
  for (const m of markers) {
    if (!m.active) continue;
    m.mesh.position.y = m.baseY + Math.sin(performance.now() * 0.003 + m.phase) * 0.4;
    m.mesh.rotation.y += dt * 2;
    if (m.target.dead) {
      scene.remove(m.mesh);
      m.active = false;
    }
  }
}

// ============================================================
//   MISSION GIVER
// ============================================================
const missionGiver = {
  mesh: makePed(0xeed0b8, 0xffd700, 0x333333),
  pos: new THREE.Vector3(0, 0, 0),
  yaw: 0,
  marker: null,
  bobPhase: 0
};
scene.add(missionGiver.mesh);
attachMissionGiverMarker(missionGiver);
missionGiver.marker.userData.isGiver = true;

// Mission state
const mission = {
  active: false,
  type: 'elimination',
  targets: [],
  killed: 0,
  total: 0
};

function startMission() {
  // clear any old targets
  for (const t of mission.targets) {
    if (t.marker) { scene.remove(t.marker); }
    t.marker = null;
  }
  mission.targets = [];
  mission.killed = 0;
  mission.total = 5;
  // Spawn a mix of enemy types for variety
  const types = ['thug', 'thug', 'heavy', 'sniper', 'boss'];
  for (let i = 0; i < mission.total; i++) {
    const e = spawnEnemy(types[i % types.length], true);
    mission.targets.push(e);
  }
  mission.active = true;
  showMessage('NEW MISSION: Eliminate the gang leaders', 4);
  updateMissionHUD();
}

function onMissionTargetKilled(enemy) {
  if (!mission.active) return;
  mission.killed++;
  updateMissionHUD();
  if (mission.killed >= mission.total) {
    mission.active = false;
    player.money += 500;
    showMessage('MISSION COMPLETE  +$500', 5);
    // small regen
    player.hp = Math.min(100, player.hp + 30);
    setTimeout(() => showMessage('Talk to the contact for another job', 3), 4500);
    updateMissionHUD();
  }
}

// ============================================================
//   PICKUPS
// ============================================================
const pickups = [];
function spawnPickup(type, x, z) {
  let color, label;
  if (type === 'money') { color = 0x44dd44; }
  else if (type === 'health') { color = 0xff4444; }
  else if (type === 'armor') { color = 0x4488ff; }
  else if (type === 'pistol') { color = 0xffaa00; }
  else if (type === 'bat') { color = 0x884422; }
  else if (type === 'knife') { color = 0xcccccc; }
  else if (type === 'smg') { color = 0xff6600; }
  else if (type === 'shotgun') { color = 0xaa3300; }
  else if (type === 'sniper') { color = 0x00aa44; }
  else if (type === 'rocket') { color = 0xaa00aa; }
  else if (type === 'ammo') { color = 0xffd700; }
  const g = new THREE.Group();
  const box = new THREE.Mesh(
    new THREE.BoxGeometry(0.7, 0.7, 0.7),
    new THREE.MeshLambertMaterial({ color, emissive: color, emissiveIntensity: 0.6 })
  );
  g.add(box);
  if (x === undefined) {
    x = (Math.random() - 0.5) * (WORLD.size - 30);
    z = (Math.random() - 0.5) * (WORLD.size - 30);
  }
  g.position.set(x, 1, z);
  g.userData = { type, baseY: 1 };
  scene.add(g);
  pickups.push(g);
  return g;
}
for (let i = 0; i < 8; i++) spawnPickup('money');
for (let i = 0; i < 5; i++) spawnPickup('health');
for (let i = 0; i < 3; i++) spawnPickup('armor');
for (let i = 0; i < 3; i++) spawnPickup('pistol');
for (let i = 0; i < 2; i++) spawnPickup('bat');
for (let i = 0; i < 2; i++) spawnPickup('knife');
for (let i = 0; i < 2; i++) spawnPickup('smg');
for (let i = 0; i < 1; i++) spawnPickup('shotgun');
for (let i = 0; i < 1; i++) spawnPickup('sniper');
for (let i = 0; i < 1; i++) spawnPickup('rocket');

// ============================================================
//   BULLETS, MUZZLE FLASH, HIT MARKERS
// ============================================================
const bullets = [];
const muzzleFlashes = [];
let combo = 0;
let lastKillTime = 0;
let hitMarkerTimer = 0;
let hitMarkerKill = false;

// ---------- SMOKE / IMPACT PARTICLES ----------
const particles = [];
function spawnSmoke(pos, color, count = 6, spread = 0.3) {
  for (let i = 0; i < count; i++) {
    const g = new THREE.Mesh(
      new THREE.SphereGeometry(0.12 + Math.random() * 0.1, 5, 4),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.7, depthWrite: false })
    );
    g.position.copy(pos);
    g.position.x += (Math.random() - 0.5) * spread;
    g.position.y += (Math.random() - 0.5) * spread;
    g.position.z += (Math.random() - 0.5) * spread;
    const vel = new THREE.Vector3(
      (Math.random() - 0.5) * 2.5,
      Math.random() * 1.2 + 0.4,
      (Math.random() - 0.5) * 2.5
    );
    scene.add(g);
    particles.push({ mesh: g, vel, life: 0.5 + Math.random() * 0.3, maxLife: 0.7 });
  }
}
function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life -= dt;
    if (p.life <= 0) {
      scene.remove(p.mesh);
      particles.splice(i, 1);
      continue;
    }
    p.mesh.position.add(p.vel.clone().multiplyScalar(dt));
    p.vel.multiplyScalar(0.94);
    p.vel.y += dt * 0.3;
    p.mesh.material.opacity = Math.max(0, (p.life / p.maxLife) * 0.7);
    p.mesh.scale.setScalar(1 + (1 - p.life / p.maxLife) * 1.2);
  }
}

function spawnMuzzleFlash(pos, yaw) {
  const g = new THREE.Group();
  const flash = new THREE.Mesh(
    new THREE.SphereGeometry(0.5, 6, 5),
    new THREE.MeshBasicMaterial({ color: 0xffee88 })
  );
  g.add(flash);
  const light = new THREE.PointLight(0xffee88, 3, 8);
  g.add(light);
  g.position.copy(pos);
  g.rotation.y = yaw;
  scene.add(g);
  muzzleFlashes.push({ mesh: g, life: 0.05 });
  // Smoke
  spawnSmoke(pos.clone(), 0xaaaaaa, 5, 0.2);
}

function fireBullet(origin, dir, fromEnemy) {
  const color = fromEnemy ? 0xff3333 : 0xfff200;
  const size = fromEnemy ? 0.32 : 0.28;
  const speed = 80;
  const g = new THREE.Mesh(
    new THREE.SphereGeometry(size, 8, 6),
    new THREE.MeshBasicMaterial({ color })
  );
  g.position.copy(origin);
  // Add a glowing point light for visibility
  const light = new THREE.PointLight(color, 1.5, 6);
  g.add(light);
  // Add a halo sprite
  const halo = new THREE.Mesh(
    new THREE.SphereGeometry(size * 1.8, 8, 6),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.35 })
  );
  g.add(halo);
  scene.add(g);
  bullets.push({ mesh: g, vel: dir.clone().multiplyScalar(speed), life: 1.5, fromEnemy: !!fromEnemy });
  return g;
}

// Explosion: damages everything in radius
function explode(pos) {
  const radius = 8;
  // visual: spawn many smoke particles
  for (let i = 0; i < 20; i++) {
    spawnSmoke(pos.clone(), 0xff8800, 1, 1.0);
  }
  // damage
  for (const e of enemies) {
    if (e.dead) continue;
    const d = e.pos.distanceTo(pos);
    if (d < radius) damageEnemy(e, 100 * (1 - d / radius));
  }
  for (const n of npcs) {
    if (n.dead) continue;
    const d = n.pos.distanceTo(pos);
    if (d < radius) damageNpc(n, 50 * (1 - d / radius));
  }
}

function updateBullets(dt) {
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    const prevPos = b.mesh.position.clone();
    b.mesh.position.add(b.vel.clone().multiplyScalar(dt));
    b.life -= dt;
    if (b.life <= 0 || b.mesh.position.y < 0.2) {
      if (b.mesh.userData.explosive) explode(b.mesh.position);
      scene.remove(b.mesh);
      bullets.splice(i, 1);
      continue;
    }
    if (b.fromEnemy) {
      if (b.mesh.position.distanceTo(player.pos.clone().add(new THREE.Vector3(0, 1.2, 0))) < 1.0) {
        const w = ENEMY_TYPES[enemies.find(e => e.mesh && !e.dead && e.pos.distanceTo(b.mesh.position) < 2)?.type || 'thug'];
        damagePlayer(w ? w.weapon === 'shotgun' ? 18 : w.weapon === 'sniper' ? 35 : 12 : 12);
        scene.remove(b.mesh);
        bullets.splice(i, 1);
        continue;
      }
    } else {
      // Player bullets: use swept hit detection (segment vs sphere) to avoid tunneling
      let hit = false;
      const segDir = b.mesh.position.clone().sub(prevPos);
      const segLen = segDir.length();
      if (segLen > 0) {
        const seg = new THREE.Ray(prevPos, segDir.clone().normalize());
        // Check enemies
        for (const e of enemies) {
          if (e.dead || !e.mesh) continue;
          const ec = e.pos.clone().add(new THREE.Vector3(0, 1.2, 0));
          // find closest point on segment to ec
          const t = Math.max(0, Math.min(segLen, ec.clone().sub(prevPos).dot(segDir.clone().normalize())));
          const closest = prevPos.clone().add(segDir.clone().normalize().multiplyScalar(t));
          if (closest.distanceTo(ec) < 1.1) {
            const w = WEAPONS[player.currentWeapon];
            if (b.mesh.userData.explosive) {
              explode(b.mesh.position);
            } else {
              damageEnemy(e, w.damage);
            }
            scene.remove(b.mesh);
            bullets.splice(i, 1);
            hit = true;
            break;
          }
        }
        if (!hit) {
          // Check civilians
          for (const n of npcs) {
            if (n.dead) continue;
            const nc = n.pos.clone().add(new THREE.Vector3(0, 1.2, 0));
            const t = Math.max(0, Math.min(segLen, nc.clone().sub(prevPos).dot(segDir.clone().normalize())));
            const closest = prevPos.clone().add(segDir.clone().normalize().multiplyScalar(t));
            if (closest.distanceTo(nc) < 1.0) {
              if (b.mesh.userData.explosive) explode(b.mesh.position);
              else damageNpc(n, 25);
              scene.remove(b.mesh);
              bullets.splice(i, 1);
              hit = true;
              break;
            }
          }
        }
      }
    }
  }
}

function updateMuzzleFlashes(dt) {
  for (let i = muzzleFlashes.length - 1; i >= 0; i--) {
    const m = muzzleFlashes[i];
    m.life -= dt;
    if (m.life <= 0) {
      scene.remove(m.mesh);
      muzzleFlashes.splice(i, 1);
    }
  }
}

// ============================================================
//   COMBAT
// ============================================================
function showHitMarker(kill) {
  hitMarkerTimer = 0.1;
  hitMarkerKill = kill;
}
function updateHitMarker(dt) {
  if (hitMarkerTimer > 0) {
    hitMarkerTimer -= dt;
    hitMarkerEl.className = hitMarkerKill ? 'show kill' : 'show';
  } else {
    hitMarkerEl.className = '';
  }
}

function showCombo(c, bonus) {
  comboEl.textContent = `${c}x COMBO  +$${bonus}`;
  comboEl.classList.add('show');
  clearTimeout(showCombo._t);
  showCombo._t = setTimeout(() => comboEl.classList.remove('show'), 1500);
}

function showDamageBorder() {
  damageBorderEl.classList.add('hit');
  setTimeout(() => damageBorderEl.classList.remove('hit'), 300);
}

function registerKill() {
  const now = performance.now();
  if (now - lastKillTime < 3000) combo++;
  else combo = 1;
  lastKillTime = now;
  const bonus = 10 * combo;
  player.money += bonus;
  if (combo >= 2) showCombo(combo, bonus);
}

function damageNpc(n, amount) {
  n.hp -= amount;
  if (n.hp <= 0) {
    n.dead = true;
    n.state = 'dead';
    n.mesh.rotation.x = Math.PI / 2;
    n.mesh.position.y = 0.3;
    player.money += 10;
    showMessage('+$10');
  } else {
    n.state = 'flee';
    n.stateTimer = 5;
    const away = new THREE.Vector3().subVectors(n.pos, player.pos).normalize();
    n.vel.x = away.x * 5;
    n.vel.z = away.z * 5;
    n.targetYaw = Math.atan2(away.x, away.z);
  }
}

function damageEnemy(e, amount) {
  e.hp -= amount;
  showHitMarker(false);
  if (e.hp <= 0) {
    e.dead = true;
    e.state = 'dead';
    e.mesh.rotation.x = Math.PI / 2;
    e.mesh.position.y = 0.3;
    if (e.marker) e.marker.userData.fade = 0;
    player.money += 25;
    registerKill();
    showHitMarker(true);
    addWanted(1);
    // drop ammo
    spawnPickup('ammo', e.pos.x, e.pos.z);
    if (e.isTarget) onMissionTargetKilled(e);
  } else {
    // aggro on player
    e.state = 'attack';
    e.shootCooldown = 0.5;
  }
}

function damagePlayer(amount) {
  if (player.invincible > 0 || player.dead || player.state === 'driving') return;
  if (player.armor > 0) {
    const absorbed = Math.min(player.armor, amount * 0.6);
    player.armor -= absorbed;
    amount -= absorbed;
  }
  player.hp -= amount;
  player.invincible = 0.5;
  showDamageBorder();
  if (player.hp <= 0) {
    player.dead = true;
    player.hp = 0;
    player.mesh.rotation.x = Math.PI / 2;
    player.mesh.position.y = 0.3;
    showMessage('WASTED. Respawning...', 3);
    setTimeout(() => {
      player.dead = false;
      player.hp = 100;
      player.armor = 0;
      player.money = Math.max(0, player.money - 500);
      player.wanted = 0;
      player.pos.set(20, 0, 20);
      player.mesh.position.copy(player.pos);
      player.mesh.rotation.x = 0;
      updateWantedUI();
      showMessage('Respawned -$500', 3);
    }, 3500);
  }
}

// ============================================================
//   ENEMY AI
// ============================================================
function enemyFire(e) {
  const w = WEAPONS[e.weapon];
  // Aim at player chest with some inaccuracy
  const dx = player.pos.x - e.pos.x;
  const dz = player.pos.z - e.pos.z;
  const baseYaw = Math.atan2(dx, dz);
  const inaccuracy = w.spread * 1.5;
  const fireYaw = baseYaw + (Math.random() - 0.5) * inaccuracy;
  const dir = new THREE.Vector3(Math.sin(fireYaw), 0, Math.cos(fireYaw)).normalize();
  const origin = e.pos.clone().add(new THREE.Vector3(Math.sin(fireYaw) * 0.6, 1.4, Math.cos(fireYaw) * 0.6));
  spawnMuzzleFlash(origin.clone().add(dir.clone().multiplyScalar(0.3)), e.yaw);
  for (let i = 0; i < w.bullets; i++) {
    const d = dir.clone();
    d.x += (Math.random() - 0.5) * w.spread;
    d.y += (Math.random() - 0.5) * w.spread * 0.3;
    d.z += (Math.random() - 0.5) * w.spread;
    d.normalize();
    fireBullet(origin, d, true);
  }
}

function updateEnemies(dt) {
  for (const e of enemies) {
    if (e.dead) continue;
    const distToPlayer = e.pos.distanceTo(player.pos);
    if (e.state === 'patrol') {
      e.stateTimer -= dt;
      if (e.stateTimer <= 0) {
        e.targetYaw = Math.random() * Math.PI * 2;
        e.stateTimer = 3 + Math.random() * 4;
      }
      e.pos.x += Math.sin(e.targetYaw) * 1.5 * dt;
      e.pos.z += Math.cos(e.targetYaw) * 1.5 * dt;
      let dy = e.targetYaw - e.yaw;
      while (dy > Math.PI) dy -= Math.PI * 2;
      while (dy < -Math.PI) dy += Math.PI * 2;
      e.yaw += dy * Math.min(1, dt * 3);
      e.walkPhase += dt * 8;
      if (distToPlayer < e.aggro) { e.state = 'chase'; }
    } else if (e.state === 'chase') {
      const dx = player.pos.x - e.pos.x;
      const dz = player.pos.z - e.pos.z;
      e.targetYaw = Math.atan2(dx, dz);
      let dy = e.targetYaw - e.yaw;
      while (dy > Math.PI) dy -= Math.PI * 2;
      while (dy < -Math.PI) dy += Math.PI * 2;
      e.yaw += dy * Math.min(1, dt * 4);
      if (distToPlayer > e.aggro + 8) { e.state = 'patrol'; continue; }
      if (distToPlayer < e.range) { e.state = 'attack'; e.shootCooldown = 0.5; }
      else {
        e.pos.x += Math.sin(e.yaw) * e.speed * dt;
        e.pos.z += Math.cos(e.yaw) * e.speed * dt;
        e.walkPhase += dt * 12;
      }
    } else if (e.state === 'attack') {
      const dx = player.pos.x - e.pos.x;
      const dz = player.pos.z - e.pos.z;
      e.targetYaw = Math.atan2(dx, dz);
      let dy = e.targetYaw - e.yaw;
      while (dy > Math.PI) dy -= Math.PI * 2;
      while (dy < -Math.PI) dy += Math.PI * 2;
      e.yaw += dy * Math.min(1, dt * 6);
      // snipers keep distance
      if (e.type === 'sniper' && distToPlayer < 15) {
        const back = Math.atan2(-dx, -dz);
        e.pos.x += Math.sin(back) * e.speed * dt;
        e.pos.z += Math.cos(back) * e.speed * dt;
      }
      e.shootCooldown -= dt;
      if (e.shootCooldown <= 0) {
        e.shootCooldown = e.fireRate + (Math.random() - 0.5) * 0.3;
        enemyFire(e);
      }
      if (distToPlayer > e.range + 5) { e.state = 'chase'; }
    }
    e.pos.x = Math.max(-WORLD.size / 2 + 2, Math.min(WORLD.size / 2 - 2, e.pos.x));
    e.pos.z = Math.max(-WORLD.size / 2 + 2, Math.min(WORLD.size / 2 - 2, e.pos.z));
    e.mesh.position.copy(e.pos);
    e.mesh.rotation.y = e.yaw;
    const { armL, armR, legL, legR } = e.mesh.userData;
    const swing = Math.sin(e.walkPhase) * 0.5;
    if (e.state === 'chase' || e.state === 'patrol') {
      legL.rotation.x = swing; legR.rotation.x = -swing;
      armL.rotation.x = -swing * 0.5;
      armR.rotation.x = swing * 0.5;
    } else {
      legL.rotation.x *= 0.85; legR.rotation.x *= 0.85;
      armL.rotation.x *= 0.85;
      armR.rotation.x = -1.3;
    }
  }
}

// ============================================================
//   NPC UPDATE
// ============================================================
function updateNpcs(dt) {
  for (const n of npcs) {
    if (n.dead) continue;
    n.stateTimer -= dt;
    if (n.state === 'flee') {
      n.pos.x += n.vel.x * dt;
      n.pos.z += n.vel.z * dt;
      n.walkPhase += dt * 18;
      if (n.stateTimer <= 0) { n.state = 'walk'; n.vel.set(0, 0, 0); n.stateTimer = 2 + Math.random() * 4; }
    } else if (n.state === 'walk' || n.state === 'idle') {
      if (n.stateTimer <= 0) {
        n.state = Math.random() < 0.6 ? 'walk' : 'idle';
        if (n.state === 'walk') {
          n.targetYaw = Math.random() * Math.PI * 2;
          n.stateTimer = 3 + Math.random() * 5;
        } else { n.stateTimer = 2 + Math.random() * 4; }
      }
      if (n.state === 'walk') {
        n.pos.x += Math.sin(n.targetYaw) * n.walkSpeed * dt;
        n.pos.z += Math.cos(n.targetYaw) * n.walkSpeed * dt;
        n.walkPhase += dt * 8;
        let dy = n.targetYaw - n.yaw;
        while (dy > Math.PI) dy -= Math.PI * 2;
        while (dy < -Math.PI) dy += Math.PI * 2;
        n.yaw += dy * Math.min(1, dt * 3);
      }
      n.pos.x = Math.max(-WORLD.size / 2 + 2, Math.min(WORLD.size / 2 - 2, n.pos.x));
      n.pos.z = Math.max(-WORLD.size / 2 + 2, Math.min(WORLD.size / 2 - 2, n.pos.z));
    }
    n.mesh.position.copy(n.pos);
    n.mesh.rotation.y = n.yaw;
    const { armL, armR, legL, legR } = n.mesh.userData;
    const swing = Math.sin(n.walkPhase) * 0.5;
    if (n.state === 'walk' || n.state === 'flee') {
      legL.rotation.x = swing; legR.rotation.x = -swing;
      armL.rotation.x = -swing * 0.5; armR.rotation.x = swing * 0.5;
    } else {
      legL.rotation.x *= 0.85; legR.rotation.x *= 0.85;
      armL.rotation.x *= 0.85; armR.rotation.x *= 0.85;
    }
  }
}

// ============================================================
//   COLLISIONS
// ============================================================
function resolveCollision(pos, radius) {
  for (const b of colliders) {
    const dx = pos.x - b.x;
    const dz = pos.z - b.z;
    const ox = b.w / 2 + radius - Math.abs(dx);
    const oz = b.d / 2 + radius - Math.abs(dz);
    if (ox > 0 && oz > 0) {
      if (ox < oz) pos.x += Math.sign(dx) * ox;
      else pos.z += Math.sign(dz) * oz;
    }
  }
}
function resolveVehicleCollision(car) {
  for (const b of colliders) {
    const dx = car.pos.x - b.x;
    const dz = car.pos.z - b.z;
    const ox = b.w / 2 + 1.4 - Math.abs(dx);
    const oz = b.d / 2 + 2.4 - Math.abs(dz);
    if (ox > 0 && oz > 0) {
      if (ox < oz) car.pos.x += Math.sign(dx) * ox;
      else car.pos.z += Math.sign(dz) * oz;
      car.speed *= -0.3;
    }
  }
  for (const v of vehicles) {
    if (v === car) continue;
    const dx = car.pos.x - v.pos.x;
    const dz = car.pos.z - v.pos.z;
    const ox = 3 - Math.abs(dx);
    const oz = 5 - Math.abs(dz);
    if (ox > 0 && oz > 0) {
      if (ox < oz) car.pos.x += Math.sign(dx) * ox;
      else car.pos.z += Math.sign(dz) * oz;
      car.speed *= -0.2;
    }
  }
}

// ============================================================
//   WANTED LEVEL & POLICE
// ============================================================
function addWanted(amount) {
  player.wanted = Math.max(0, Math.min(6, player.wanted + amount));
  player.wantedTimer = 8;
  updateWantedUI();
}
function decayWanted(dt) {
  player.wantedTimer -= dt;
  if (player.wantedTimer <= 0 && player.wanted > 0) {
    player.wanted = Math.max(0, player.wanted - 1);
    player.wantedTimer = 12;
    updateWantedUI();
  }
}
let policeSpawnTimer = 0;
function updatePoliceSpawning(dt) {
  if (player.wanted === 0) return;
  const policeCount = vehicles.filter(v => v.isPolice).length;
  const target = player.wanted * 2;
  policeSpawnTimer -= dt;
  if (policeSpawnTimer <= 0 && policeCount < target) {
    policeSpawnTimer = 5;
    const angle = Math.random() * Math.PI * 2;
    const dist = 200;
    const x = player.pos.x + Math.cos(angle) * dist;
    const z = player.pos.z + Math.sin(angle) * dist;
    const car = spawnCar(x, z, Math.atan2(player.pos.x - x, player.pos.z - z), true);
  }
  for (let i = vehicles.length - 1; i >= 0; i--) {
    const v = vehicles[i];
    if (v.isPolice) {
      const d = v.pos.distanceTo(player.pos);
      if (d > 500 && !v.occupied) {
        scene.remove(v.mesh);
        vehicles.splice(i, 1);
      }
    }
  }
}

// ============================================================
//   HUD
// ============================================================
const wantedEl = document.getElementById('wanted');
const healthBar = document.getElementById('healthBar');
const healthText = document.getElementById('healthText');
const armorBar = document.getElementById('armorBar');
const armorText = document.getElementById('armorText');
const moneyEl = document.getElementById('money');
const messageEl = document.getElementById('message');
const minimapCanvas = document.getElementById('minimapCanvas');
const mctx = minimapCanvas.getContext('2d');
const objectiveEl = document.getElementById('missionObjective');
const objectiveTextEl = document.getElementById('objectiveText');
const objectiveProgressEl = document.getElementById('objectiveProgress');
const hitMarkerEl = document.getElementById('hitMarker');
const comboEl = document.getElementById('combo');
const damageBorderEl = document.getElementById('damageBorder');
const weaponNameEl = document.getElementById('weaponName');
const weaponAmmoEl = document.getElementById('weaponAmmo');
const lockStatusEl = document.getElementById('lockStatus');
const crosshairEl = document.getElementById('crosshair');

function updateWeaponHUD() {
  const w = WEAPONS[player.currentWeapon];
  if (!w) return;
  weaponNameEl.textContent = w.name;
  if (w.ammo === Infinity) weaponAmmoEl.textContent = '∞';
  else weaponAmmoEl.textContent = `${player.ammo} / ${w.maxAmmo}`;
  // highlight auto weapons
  if (w.auto) weaponNameEl.textContent += ' [AUTO]';
  if (player.reloading) weaponAmmoEl.textContent = 'RELOADING';
}

function isAnyEnemyInCrosshair() {
  for (const e of enemies) {
    if (e.dead) continue;
    if (e.pos.distanceTo(player.pos) > 40) continue;
    const sp = e.pos.clone().add(new THREE.Vector3(0, 1.5, 0));
    sp.project(camera);
    if (Math.abs(sp.x) < 0.04 && Math.abs(sp.y) < 0.04 && sp.z < 1) return true;
  }
  return false;
}

function updateCrosshairAndLock() {
  // crosshair red when over enemy
  if (isAnyEnemyInCrosshair()) crosshairEl.classList.add('over-enemy');
  else crosshairEl.classList.remove('over-enemy');
  // lock status text
  if (aimLock.target) lockStatusEl.classList.add('on');
  else lockStatusEl.classList.remove('on');
  // 3D lock indicator
  if (aimLock.target) {
    aimLock.indicator.visible = true;
    aimLock.indicator.position.copy(aimLock.target.pos);
    aimLock.indicator.position.y += 1.5;
    const s = 1 + Math.sin(performance.now() * 0.006) * 0.08;
    aimLock.indicator.scale.set(s, s, s);
    aimLock.indicator.lookAt(camera.position);
  } else {
    aimLock.indicator.visible = false;
  }
}

function updateWantedUI() {
  const stars = wantedEl.querySelectorAll('.star');
  stars.forEach((s, i) => {
    s.classList.toggle('on', i < player.wanted);
    s.classList.remove('flash');
  });
  if (player.wanted > 0) {
    const idx = player.wanted - 1;
    if (stars[idx]) {
      stars[idx].classList.add('flash');
      setTimeout(() => stars[idx].classList.remove('flash'), 400);
    }
  }
}
function showMessage(text, duration = 2.5) {
  messageEl.innerHTML = text.replace('\n', '<br>');
  messageEl.classList.add('show');
  clearTimeout(showMessage._t);
  showMessage._t = setTimeout(() => messageEl.classList.remove('show'), duration * 1000);
}
function updateHUD() {
  healthBar.style.width = Math.max(0, player.hp) + '%';
  healthText.textContent = Math.max(0, Math.round(player.hp));
  armorBar.style.width = Math.max(0, player.armor) + '%';
  armorText.textContent = Math.max(0, Math.round(player.armor));
  moneyEl.textContent = player.money;
  // Weapon display is handled by updateWeaponHUD()
}
function updateMissionHUD() {
  if (!mission.active) {
    objectiveTextEl.textContent = 'TALK TO THE CONTACT (YELLOW MARKER)';
    objectiveProgressEl.textContent = '';
  } else {
    objectiveTextEl.textContent = 'ELIMINATE THE GANG LEADERS';
    objectiveProgressEl.textContent = `${mission.killed}/${mission.total}`;
  }
}

function drawMinimap() {
  const w = minimapCanvas.width, h = minimapCanvas.height;
  mctx.fillStyle = '#0a1a0a';
  mctx.fillRect(0, 0, w, h);
  mctx.strokeStyle = '#1a3a1a';
  mctx.lineWidth = 1;
  for (let i = 0; i <= 8; i++) {
    const p = (i / 8) * w;
    mctx.beginPath(); mctx.moveTo(p, 0); mctx.lineTo(p, h); mctx.stroke();
    mctx.beginPath(); mctx.moveTo(0, p); mctx.lineTo(w, p); mctx.stroke();
  }
  mctx.strokeStyle = '#3a3a3a';
  mctx.lineWidth = 3;
  for (let i = 0; i <= WORLD.blocks; i++) {
    const p = (i / WORLD.blocks) * w;
    mctx.beginPath(); mctx.moveTo(p, 0); mctx.lineTo(p, h); mctx.stroke();
    mctx.beginPath(); mctx.moveTo(0, p); mctx.lineTo(w, p); mctx.stroke();
  }
  mctx.fillStyle = '#5a5a5a';
  for (const b of buildings) {
    const s = w / WORLD.size;
    mctx.fillRect(w / 2 + b.x * s - (b.w * s) / 2, h / 2 + b.z * s - (b.d * s) / 2, b.w * s, b.d * s);
  }
  // mission targets (red dots)
  for (const t of mission.targets) {
    if (t.dead) continue;
    const s = w / WORLD.size;
    mctx.fillStyle = '#ff3333';
    mctx.beginPath();
    mctx.arc(w / 2 + t.pos.x * s, h / 2 + t.pos.z * s, 3, 0, Math.PI * 2);
    mctx.fill();
  }
  for (const v of vehicles) {
    if (v === player.inVehicle) continue;
    const s = w / WORLD.size;
    mctx.fillStyle = v.isPolice ? '#2244ff' : '#ffaa00';
    mctx.fillRect(w / 2 + v.pos.x * s - 1, h / 2 + v.pos.z * s - 1, 2, 2);
  }
  // mission giver
  {
    const s = w / WORLD.size;
    mctx.fillStyle = '#ffeb3b';
    mctx.beginPath();
    mctx.arc(w / 2 + missionGiver.pos.x * s, h / 2 + missionGiver.pos.z * s, 3, 0, Math.PI * 2);
    mctx.fill();
  }
  const s = w / WORLD.size;
  const px = w / 2 + player.pos.x * s;
  const py = h / 2 + player.pos.z * s;
  mctx.fillStyle = '#00ff66';
  mctx.beginPath(); mctx.arc(px, py, 3, 0, Math.PI * 2); mctx.fill();
  mctx.strokeStyle = '#00ff66';
  mctx.lineWidth = 1.5;
  mctx.beginPath(); mctx.moveTo(px, py);
  mctx.lineTo(px + Math.sin(player.yaw) * 6, py + Math.cos(player.yaw) * 6); mctx.stroke();
  mctx.globalCompositeOperation = 'destination-in';
  mctx.beginPath(); mctx.arc(w / 2, h / 2, w / 2, 0, Math.PI * 2); mctx.fill();
  mctx.globalCompositeOperation = 'source-over';
}

// ============================================================
//   PLAYER UPDATE
// ============================================================
function enterVehicle(car) {
  if (car.occupied || car.hp <= 0) return;
  car.occupied = true;
  car.driver = player;
  player.inVehicle = car;
  player.state = 'driving';
  player.mesh.visible = false;
  showMessage('Entered vehicle (E to exit)');
}
function exitVehicle() {
  const car = player.inVehicle;
  if (!car) return;
  car.occupied = false;
  car.driver = null;
  player.inVehicle = null;
  player.state = 'onfoot';
  player.mesh.visible = true;
  const exitX = car.pos.x + Math.sin(car.yaw) * 3;
  const exitZ = car.pos.z + Math.cos(car.yaw) * 3;
  player.pos.set(exitX, 0, exitZ);
  player.mesh.position.copy(player.pos);
  resolveCollision(player.pos, 0.5);
  showMessage('Exited vehicle');
}

function interactWithMissionGiver() {
  if (mission.active) {
    showMessage('Complete the current mission first!', 2);
    return;
  }
  startMission();
}

function updatePlayer(dt) {
  if (player.dead) return;
  if (player.invincible > 0) player.invincible -= dt;

  if (player.state === 'onfoot') {
    const forward = (keys['KeyW'] ? 1 : 0) - (keys['KeyS'] ? 1 : 0);
    const strafe = (keys['KeyD'] ? 1 : 0) - (keys['KeyA'] ? 1 : 0);
    const running = keys['ShiftLeft'] || keys['ShiftRight'];
    const speed = running ? 9 : 5;
    const cosY = Math.cos(cameraYaw.value);
    const sinY = Math.sin(cameraYaw.value);
    const moveX = (strafe * cosY + forward * sinY);
    const moveZ = (strafe * -sinY + forward * cosY);
    const len = Math.hypot(moveX, moveZ);
    if (len > 0) {
      const nx = moveX / len, nz = moveZ / len;
      player.pos.x += nx * speed * dt;
      player.pos.z += nz * speed * dt;
      const targetYaw = Math.atan2(nx, nz);
      let dy = targetYaw - player.yaw;
      while (dy > Math.PI) dy -= Math.PI * 2;
      while (dy < -Math.PI) dy += Math.PI * 2;
      player.yaw += dy * Math.min(1, dt * 12);
      player.walkPhase += dt * (running ? 14 : 9);
    } else { player.walkPhase *= 0.85; }
    if (keys['Space'] && player.onGround) { player.jumpVel = 7; player.onGround = false; }
    player.jumpVel -= 18 * dt;
    player.pos.y += player.jumpVel * dt;
    if (player.pos.y <= 0) { player.pos.y = 0; player.jumpVel = 0; player.onGround = true; }
    resolveCollision(player.pos, 0.5);
    player.pos.x = Math.max(-WORLD.size / 2 + 2, Math.min(WORLD.size / 2 - 2, player.pos.x));
    player.pos.z = Math.max(-WORLD.size / 2 + 2, Math.min(WORLD.size / 2 - 2, player.pos.z));
    player.mesh.position.copy(player.pos);
    player.mesh.rotation.y = player.yaw;
    const { armL, armR, legL, legR } = player.mesh.userData;
    const swing = Math.sin(player.walkPhase) * 0.7;
    const holdingGun = player.gun !== null && WEAPONS[player.currentWeapon].type === 'ranged';
    if (len > 0) {
      legL.rotation.x = swing; legR.rotation.x = -swing;
      armL.rotation.x = -swing * 0.6;
      if (holdingGun) {
        armR.rotation.x = -1.3;  // arm forward
        armR.rotation.z = 0;
      } else {
        armR.rotation.x = swing * 0.6;
      }
    } else {
      legL.rotation.x *= 0.85; legR.rotation.x *= 0.85;
      armL.rotation.x *= 0.85;
      if (holdingGun) {
        armR.rotation.x = -1.3;
      } else {
        armR.rotation.x *= 0.85;
      }
    }
    // Melee (F key, or click with melee weapon)
    if (player.meleeCooldown > 0) player.meleeCooldown -= dt;
    if (player.reloadTimer > 0) {
      player.reloadTimer -= dt;
      if (player.reloadTimer <= 0) {
        const w = WEAPONS[player.currentWeapon];
        player.ammo = w.maxAmmo;
        player.money = Math.max(0, player.money - 5);
        player.reloading = false;
        showMessage('Reloaded -$5');
        updateWeaponHUD();
      }
    }
    const w = WEAPONS[player.currentWeapon];
    if (w.type === 'melee') {
      const wantAttack = (keys['KeyF'] || (mouseDown && !player.mouseWasDown));
      if (wantAttack && player.meleeCooldown <= 0) {
        player.meleeCooldown = w.fireRate;
        doMelee();
      }
    } else {
      // Ranged
      if (player.shootCooldown > 0) player.shootCooldown -= dt;
      const wantShoot = w.auto ? mouseDown : (mouseDown && !player.mouseWasDown);
      if (wantShoot && player.shootCooldown <= 0 && !player.reloading && player.ammo > 0) {
        player.shootCooldown = w.fireRate;
        doShoot();
      }
    }
    player.mouseWasDown = mouseDown;
    // E: interact
    if (keys['KeyE']) {
      keys['KeyE'] = false;
      // mission giver first
      const dg = missionGiver.pos.distanceTo(player.pos);
      if (dg < 4) { interactWithMissionGiver(); }
      else {
        // vehicle
        let nearest = null, nearD = 4;
        for (const v of vehicles) {
          const d = v.pos.distanceTo(player.pos);
          if (d < nearD) { nearD = d; nearest = v; }
        }
        if (nearest) enterVehicle(nearest);
      }
    }
  } else if (player.state === 'driving') {
    const car = player.inVehicle;
    if (!car) { player.state = 'onfoot'; player.mesh.visible = true; return; }
    const accel = (keys['KeyW'] ? 1 : 0) - (keys['KeyS'] ? 1 : 0);
    const steerInput = (keys['KeyA'] ? 1 : 0) - (keys['KeyD'] ? 1 : 0);
    const brake = keys['Space'];
    if (brake) car.speed *= 0.92;
    else { car.speed += accel * 14 * dt; car.speed *= 0.985; }
    car.speed = Math.max(-8, Math.min(28, car.speed));
    const turnRate = 0.04 * Math.sign(car.speed) * (Math.abs(car.speed) > 0.1 ? 1 : 0);
    car.yaw += steerInput * turnRate * (1 - Math.abs(car.speed) / 40);
    car.pos.x += Math.sin(car.yaw) * car.speed * dt;
    car.pos.z += Math.cos(car.yaw) * car.speed * dt;
    resolveVehicleCollision(car);
    car.pos.x = Math.max(-WORLD.size / 2 + 3, Math.min(WORLD.size / 2 - 3, car.pos.x));
    car.pos.z = Math.max(-WORLD.size / 2 + 3, Math.min(WORLD.size / 2 - 3, car.pos.z));
    car.mesh.position.copy(car.pos);
    car.mesh.rotation.y = car.yaw;
    player.pos.copy(car.pos);
    player.yaw = car.yaw;
    const { wheels } = car.mesh.userData;
    for (const w of wheels) w.rotation.x += car.speed * dt * 2;
    if (keys['KeyE']) { keys['KeyE'] = false; exitVehicle(); }
  }

  // Pickups
  for (let i = pickups.length - 1; i >= 0; i--) {
    const p = pickups[i];
    p.rotation.y += dt * 2;
    p.position.y = p.userData.baseY + Math.sin(performance.now() * 0.003 + i) * 0.2;
    if (player.pos.distanceTo(p.position) < 1.5) {
      const t = p.userData.type;
      if (t === 'money') { player.money += 100; showMessage('+$100'); }
      else if (t === 'health') { player.hp = Math.min(100, player.hp + 30); showMessage('+30 HP'); }
      else if (t === 'armor') { player.armor = Math.min(100, player.armor + 30); showMessage('+30 ARMOR'); }
      else if (t === 'pistol') { if (!player.inventory.includes('pistol')) player.inventory.push('pistol'); setWeapon('pistol'); showMessage('Got Pistol (12 ammo)'); }
      else if (t === 'bat') { if (!player.inventory.includes('bat')) player.inventory.push('bat'); setWeapon('bat'); showMessage('Got Bat'); }
      else if (t === 'knife') { if (!player.inventory.includes('knife')) player.inventory.push('knife'); setWeapon('knife'); showMessage('Got Knife'); }
      else if (t === 'smg') { if (!player.inventory.includes('smg')) player.inventory.push('smg'); setWeapon('smg'); showMessage('Got SMG (30 ammo)'); }
      else if (t === 'shotgun') { if (!player.inventory.includes('shotgun')) player.inventory.push('shotgun'); setWeapon('shotgun'); showMessage('Got Shotgun (8 ammo)'); }
      else if (t === 'sniper') { if (!player.inventory.includes('sniper')) player.inventory.push('sniper'); setWeapon('sniper'); showMessage('Got Sniper (5 ammo)'); }
      else if (t === 'rocket') { if (!player.inventory.includes('rocket')) player.inventory.push('rocket'); setWeapon('rocket'); showMessage('Got Rocket Launcher (4 ammo)'); }
      else if (t === 'ammo') { player.ammo = Math.min(WEAPONS[player.currentWeapon].maxAmmo, player.ammo + Math.ceil(WEAPONS[player.currentWeapon].maxAmmo / 2)); showMessage('+' + Math.ceil(WEAPONS[player.currentWeapon].maxAmmo / 2) + ' AMMO'); }
      scene.remove(p);
      pickups.splice(i, 1);
      setTimeout(() => spawnPickup(t), 30000);
    }
  }
}

// ============================================================
//   POLICE AI
// ============================================================
function updatePoliceAI(dt) {
  for (const v of vehicles) {
    if (!v.isPolice) continue;
    const dx = player.pos.x - v.pos.x;
    const dz = player.pos.z - v.pos.z;
    const dist = Math.hypot(dx, dz);
    const targetYaw = Math.atan2(dx, dz);
    let dy = targetYaw - v.yaw;
    while (dy > Math.PI) dy -= Math.PI * 2;
    while (dy < -Math.PI) dy += Math.PI * 2;
    v.yaw += dy * Math.min(1, dt * 2.5);
    v.speed += 8 * dt;
    v.speed = Math.min(20, v.speed);
    v.pos.x += Math.sin(v.yaw) * v.speed * dt;
    v.pos.z += Math.cos(v.yaw) * v.speed * dt;
    resolveVehicleCollision(v);
    v.mesh.position.copy(v.pos);
    v.mesh.rotation.y = v.yaw;
    const { wheels } = v.mesh.userData;
    for (const w of wheels) w.rotation.x += v.speed * dt * 2;
    if (dist < 2.5 && player.invincible <= 0) {
      damagePlayer(15);
      v.speed *= -0.5;
    }
  }
}

// ============================================================
//   CAMERA
// ============================================================
function updateCamera(dt) {
  let targetX, targetY, targetZ;
  if (player.state === 'driving' && player.inVehicle) {
    const car = player.inVehicle;
    targetX = car.pos.x - Math.sin(car.yaw) * CAM_DIST;
    targetZ = car.pos.z - Math.cos(car.yaw) * CAM_DIST;
    targetY = CAM_HEIGHT;
    cameraYaw.value = car.yaw;
  } else {
    targetX = player.pos.x - Math.sin(cameraYaw.value) * CAM_DIST * Math.cos(cameraPitch.value);
    targetZ = player.pos.z - Math.cos(cameraYaw.value) * CAM_DIST * Math.cos(cameraPitch.value);
    targetY = player.pos.y + CAM_HEIGHT - Math.sin(cameraPitch.value) * CAM_DIST;
    player.yaw = cameraYaw.value;
  }
  camera.position.x += (targetX - camera.position.x) * Math.min(1, dt * 8);
  camera.position.y += (targetY - camera.position.y) * Math.min(1, dt * 8);
  camera.position.z += (targetZ - camera.position.z) * Math.min(1, dt * 8);
  camera.lookAt(player.pos.x, player.pos.y + 1.6, player.pos.z);
}

// ============================================================
//   DAY/NIGHT
// ============================================================
let dayTime = 0.3;
function updateDayNight(dt) {
  dayTime += dt * 0.005;
  if (dayTime > 1) dayTime -= 1;
  const angle = dayTime * Math.PI * 2 - Math.PI / 2;
  sun.position.set(Math.cos(angle) * 200, Math.sin(angle) * 200 + 30, 80);
  const dayness = Math.max(0, Math.sin(angle));
  _skyColor.setHSL(0.6, 0.7, 0.3 + dayness * 0.4);
  scene.background.copy(_skyColor);
  scene.fog.color.copy(_skyColor);
  sun.intensity = 0.3 + dayness * 1.0;
  sun.color.setHSL(0.1, 0.3, 0.7 + dayness * 0.3);
}

// ============================================================
//   MAIN LOOP
// ============================================================
let last = performance.now();
function loop() {
  const now = performance.now();
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (pointerLocked) {
    updatePlayer(dt);
    updateNpcs(dt);
    updateEnemies(dt);
    updateBullets(dt);
    updateMuzzleFlashes(dt);
    updateParticles(dt);
    updatePoliceAI(dt);
    updatePoliceSpawning(dt);
    updateMarkers(dt);
    updateClouds(dt);
    decayWanted(dt);
    updateDayNight(dt);
    aimLock.update();
  }
  updateCamera(dt);
  updateFPGun(dt);
  updateHitMarker(dt);
  updateCrosshairAndLock();
  drawMinimap();
  updateHUD();
  composer.render();
  requestAnimationFrame(loop);
}

let fpBob = 0;
let fpRecoil = 0;
function updateFPGun(dt) {
  if (!fpGun.visible) return;
  const baseY = -0.35;
  const baseX = 0.35;
  // bob when moving
  if (player.walkPhase && (keys['KeyW'] || keys['KeyA'] || keys['KeyS'] || keys['KeyD'])) {
    fpBob += dt * 8;
    fpGun.position.y = baseY + Math.sin(fpBob) * 0.02;
    fpGun.position.x = baseX + Math.sin(fpBob * 0.5) * 0.015;
  } else {
    fpBob = 0;
    fpGun.position.y = baseY;
    fpGun.position.x = baseX;
  }
  // recoil
  if (fpRecoil > 0) {
    fpGun.position.z = -0.7 + fpRecoil * 0.04;
    fpGun.rotation.x = -fpRecoil * 0.3;
    fpRecoil -= dt * 4;
    if (fpRecoil < 0) fpRecoil = 0;
  } else {
    fpGun.position.z = -0.7;
    fpGun.rotation.x = 0;
  }
}
function addRecoil() { fpRecoil = 1.0; }
updateWantedUI();
updateHUD();
updateMissionHUD();
updateWeaponHUD();
setWeapon('pistol');
loop();
