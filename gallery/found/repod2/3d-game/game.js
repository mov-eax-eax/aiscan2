import * as THREE from 'three';

// ---------- Scene Setup ----------
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb); // sky blue
scene.fog = new THREE.Fog(0x87ceeb, 60, 160);

const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 300);
camera.position.set(0, 7, 14);
camera.lookAt(0, 1.2, -8);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

// ---------- Lights ----------
const sun = new THREE.DirectionalLight(0xfff5e0, 1.4);
sun.position.set(30, 50, 20);
sun.castShadow = true;
sun.shadow.mapSize.width = 2048;
sun.shadow.mapSize.height = 2048;
sun.shadow.camera.near = 0.5;
sun.shadow.camera.far = 100;
sun.shadow.camera.left = -40;
sun.shadow.camera.right = 40;
sun.shadow.camera.top = 40;
sun.shadow.camera.bottom = -40;
scene.add(sun);
scene.add(new THREE.AmbientLight(0xffffff, 0.55));

// ---------- Ground ----------
function makeGround() {
  const geo = new THREE.PlaneGeometry(40, 400);
  const mat = new THREE.MeshStandardMaterial({ color: 0x3fa84a });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.z = -100;
  mesh.receiveShadow = true;
  scene.add(mesh);
  return mesh;
}
const ground = makeGround();

// Road stripe down the middle
function makeStripe() {
  const geo = new THREE.PlaneGeometry(0.6, 400);
  const mat = new THREE.MeshStandardMaterial({ color: 0xe8e8e8 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(0, 0.02, -100);
  scene.add(mesh);
}
makeStripe();

// Lane guide lines
for (const x of [-3, 3]) {
  const geo = new THREE.PlaneGeometry(0.15, 400);
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.6 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(x, 0.01, -100);
  scene.add(mesh);
}

// Clouds
const clouds = [];
function makeCloud() {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xcccccc, emissiveIntensity: 0.1 });
  for (let i = 0; i < 5; i++) {
    const s = new THREE.Mesh(new THREE.SphereGeometry(1 + Math.random() * 1.4, 8, 8), mat);
    s.position.set(i - 2, (Math.random() - 0.5) * 0.8, (Math.random() - 0.5) * 1.5);
    s.scale.set(1.5, 0.6, 1);
    g.add(s);
  }
  return g;
}
for (let i = 0; i < 10; i++) {
  const c = makeCloud();
  c.position.set((Math.random() - 0.5) * 60, 18 + Math.random() * 14, -20 - Math.random() * 120);
  scene.add(c);
  clouds.push(c);
}

// Trees along the sides
const trees = [];
function makeTree() {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.6, 2, 8),
    new THREE.MeshStandardMaterial({ color: 0x7a4d28 }));
  trunk.position.y = 1;
  g.add(trunk);
  const leaves = new THREE.Mesh(new THREE.ConeGeometry(1.6, 3.4, 8),
    new THREE.MeshStandardMaterial({ color: 0x2e8b3f }));
  leaves.position.y = 3.2;
  g.add(leaves);
  return g;
}
for (let i = 0; i < 40; i++) {
  const t = makeTree();
  const side = Math.random() > 0.5 ? 1 : -1;
  const x = side * (9 + Math.random() * 6);
  t.position.set(x, 0, -Math.random() * 160);
  t.scale.setScalar(0.8 + Math.random() * 0.6);
  t.traverse(o => { if (o.isMesh) o.castShadow = true; });
  scene.add(t);
  trees.push(t);
}

// ---------- Player ----------
function makePlayer() {
  const group = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(1.2, 1.6, 0.9),
    new THREE.MeshStandardMaterial({ color: 0x2962ff })
  );
  body.position.y = 0.8;
  body.castShadow = true;
  group.add(body);

  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.45, 16, 16),
    new THREE.MeshStandardMaterial({ color: 0xffccb0 })
  );
  head.position.y = 1.85;
  head.castShadow = true;
  group.add(head);

  const eyeMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a });
  const eyeGeo = new THREE.SphereGeometry(0.12, 8, 8);
  const e1 = new THREE.Mesh(eyeGeo, eyeMat); e1.position.set(0.16, 1.95, 0.36);
  const e2 = new THREE.Mesh(eyeGeo, eyeMat); e2.position.set(-0.16, 1.95, 0.36);
  group.add(e1, e2);

  group.position.set(0, 0, 2);
  return group;
}
const player = makePlayer();
scene.add(player);

// Player physics state
const lanes = [-3, 0, 3];
const playerState = {
  lane: 1,
  targetX: 0,
  y: 0,
  vy: 0,
  jumping: false,
  sliding: false,
  slideTimer: 0
};

// ---------- Obstacles & Coins ----------
const obstacles = []; // { mesh, type, x, z, box }
const coins = [];     // { mesh, x, z, taken }
const coinGroup = [];

const ROCK = 0, BLOCK = 1, LOG = 2, GATE = 3;

function makeObstacle(type) {
  const g = new THREE.Group();
  if (type === ROCK) {
    const m = new THREE.Mesh(new THREE.DodecahedronGeometry(0.9, 0),
      new THREE.MeshStandardMaterial({ color: 0x8b8b8b, flatShading: true }));
    m.position.y = 0.9; m.castShadow = true; g.add(m);
  } else if (type === BLOCK) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.6, 1.6),
      new THREE.MeshStandardMaterial({ color: 0xb5651d }));
    m.position.y = 0.8; m.castShadow = true; g.add(m);
  } else if (type === LOG) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 2.6, 10),
      new THREE.MeshStandardMaterial({ color: 0xa0522d }));
    m.rotation.z = Math.PI / 2;
    m.position.y = 0.55; m.castShadow = true; g.add(m);
  } else { // GATE - high bar, must slide under
    const bar = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.4, 0.4),
      new THREE.MeshStandardMaterial({ color: 0xff4500 }));
    bar.position.y = 1.7; bar.castShadow = true; g.add(bar);
    for (const sx of [-1.2, 1.2]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.3, 2, 0.3),
        new THREE.MeshStandardMaterial({ color: 0x888888 }));
      post.position.set(sx, 1, 0); g.add(post);
    }
  }
  return g;
}

function makeCoin() {
  const geo = new THREE.CylinderGeometry(0.5, 0.5, 0.12, 20);
  const mat = new THREE.MeshStandardMaterial({ color: 0xffd700, emissive: 0xffa500, emissiveIntensity: 0.4 });
  const coin = new THREE.Mesh(geo, mat);
  coin.rotation.x = Math.PI / 2;
  coin.castShadow = true;
  return coin;
}

function obstacleBox(o) {
  // returns collision box based on type
  return { halfW: 0.8, halfH: 0.8, halfD: 0.8 };
}

// ---------- Spawning / Recycle ----------
const SPAWN_Z = -70;
const activeObstacles = [];
const activeCoins = [];
let distance = 0;
let scrollSpeed = 12; // units per second
const BASE_SPEED = 12;

function spawn() {
  const type = Math.floor(Math.random() * 4);
  const lane = Math.floor(Math.random() * 3);
  const x = lanes[lane];

  if (type === GATE) {
    // Gate spans across, only passable by sliding
    const g = makeObstacle(GATE);
    g.position.set(0, 0, SPAWN_Z);
    scene.add(g);
    activeObstacles.push({ mesh: g, type: GATE, x: 0, z: SPAWN_Z, lane: -1 });
  } else {
    const g = makeObstacle(type);
    g.position.set(x, 0, SPAWN_Z);
    scene.add(g);
    activeObstacles.push({ mesh: g, type, x, z: SPAWN_Z, lane });
  }

  // Maybe spawn coin(s) in an open lane
  if (Math.random() < 0.6) {
    const openLanes = [0, 1, 2].filter(i => i !== lane);
    const cl = openLanes[Math.floor(Math.random() * openLanes.length)];
    const coin = makeCoin();
    coin.position.set(lanes[cl], 1.2, SPAWN_Z);
    scene.add(coin);
    activeCoins.push({ mesh: coin, x: lanes[cl], z: SPAWN_Z, taken: false });
  }
}

function recycleObstacles() {
  for (let i = activeObstacles.length - 1; i >= 0; i--) {
    const o = activeObstacles[i];
    if (o.z > 8) {
      scene.remove(o.mesh);
      activeObstacles.splice(i, 1);
    }
  }
  for (let i = activeCoins.length - 1; i >= 0; i--) {
    const c = activeCoins[i];
    if (c.z > 8) {
      scene.remove(c.mesh);
      activeCoins.splice(i, 1);
    }
  }
}

// ---------- Score / UI ----------
const scoreEl = document.getElementById('score');
const coinsEl = document.getElementById('coins');
const speedEl = document.getElementById('speed');
const menuEl = document.getElementById('menu');
const overEl = document.getElementById('gameover');
const bestTextEl = document.getElementById('bestText');
const finalScoreEl = document.getElementById('finalScore');
const newBestEl = document.getElementById('newBest');

let score = 0;
let coinCount = 0;
let running = false;
let best = parseInt(localStorage.getItem('skyrunner_best') || '0', 10);
bestTextEl && (bestTextEl.textContent = 'Best: ' + best);

function updateHUD() {
  scoreEl.textContent = 'Score: ' + Math.floor(score);
  coinsEl.textContent = 'Coins: ' + coinCount;
  speedEl.textContent = 'Speed: ' + (scrollSpeed / BASE_SPEED).toFixed(1) + 'x';
}

// ---------- Game Flow ----------
function startGame() {
  menuEl.classList.add('hidden');
  overEl.classList.add('hidden');
  running = true;
  score = 0;
  coinCount = 0;
  scrollSpeed = BASE_SPEED;
  distance = 0;
  player.position.set(0, 0, 2);
  playerState.lane = 1; playerState.targetX = 0; playerState.y = 0;
  playerState.vy = 0; playerState.jumping = false; playerState.sliding = false;
  player.scale.setScalar(1);
  player.position.y = 0;
  // clear obstacles
  for (const o of activeObstacles) scene.remove(o.mesh);
  for (const c of activeCoins) scene.remove(c.mesh);
  activeObstacles.length = 0;
  activeCoins.length = 0;
  // initial spawns
  for (let i = 0; i < 8; i++) {
    nextZ += SPAWN_GAP;
    spawnAt(nextZ);
  }
  spawnTimer = SPAWN_GAP / scrollSpeed;
  updateHUD();
}

let nextZ = 0;
const SPAWN_GAP = 12;

function spawnAt(z) {
  const type = Math.floor(Math.random() * 4);
  const lane = Math.floor(Math.random() * 3);
  const x = lanes[lane];
  if (type === GATE) {
    const g = makeObstacle(GATE);
    g.position.set(0, 0, z);
    scene.add(g);
    activeObstacles.push({ mesh: g, type: GATE, x: 0, z, lane: -1, warn: true });
  } else {
    const g = makeObstacle(type);
    g.position.set(x, 0, z);
    scene.add(g);
    activeObstacles.push({ mesh: g, type, x, z, lane });
  }
  if (Math.random() < 0.5) {
    const cl = [0,1,2][Math.floor(Math.random()*3)];
    const coin = makeCoin();
    coin.position.set(lanes[cl], 1.2, z - 3);
    scene.add(coin);
    activeCoins.push({ mesh: coin, x: lanes[cl], z: z - 3, taken: false });
  }
}

function gameOver() {
  running = false;
  const final = Math.floor(score);
  finalScoreEl.textContent = 'Score: ' + final + '   Coins: ' + coinCount;
  if (final > best) {
    best = final;
    localStorage.setItem('skyrunner_best', String(best));
    newBestEl.textContent = '🎉 NEW BEST! 🎉';
  } else {
    newBestEl.textContent = '';
  }
  bestTextEl.textContent = 'Best: ' + best;
  overEl.classList.remove('hidden');
}

// ---------- Input ----------
const keys = {};
window.addEventListener('keydown', (e) => {
  keys[e.code] = true;
  if (e.code === 'Space') e.preventDefault();
  if (!running) return;
  if (e.code === 'ArrowLeft') moveTo(playerState.lane - 1);
  if (e.code === 'ArrowRight') moveTo(playerState.lane + 1);
  if ((e.code === 'ArrowUp' || e.code === 'Space')) jump();
  if (e.code === 'ArrowDown') startSlide();
});
window.addEventListener('keyup', (e) => { keys[e.code] = false; });

function moveTo(lane) {
  if (lane < 0 || lane > 2) return;
  playerState.lane = lane;
  playerState.targetX = lanes[lane];
}

function jump() {
  if (playerState.jumping) return;
  playerState.jumping = true;
  playerState.vy = 12;
}

function startSlide() {
  playerState.sliding = true;
  playerState.slideTimer = 0.7;
  player.scale.set(1, 0.5, 1);
  player.position.y = 0;
}

// Touch / on-screen hints via buttons already covered. Click to jump is nice:
window.addEventListener('click', () => {
  if (running && !overEl.classList.contains('hidden') === false) {
    // ignore
  }
});

// Restart / start buttons
document.getElementById('startBtn').addEventListener('click', startGame);
document.getElementById('restartBtn').addEventListener('click', startGame);

// keyboard start
window.addEventListener('keydown', (e) => {
  if (!running && (e.code === 'Enter' || e.code === 'Space')) {
    startGame();
  }
});

// ---------- Collision ----------
function playerBox() {
  const h = playerState.sliding ? 0.7 : 1.7;
  return { cx: player.position.x, cy: player.position.y + h / 2, halfW: 0.6, halfH: h / 2 };
}

function obstacleDim(o) {
  if (o.type === ROCK) return { halfW: 0.75, halfH: 0.75, halfD: 0.75 };
  if (o.type === BLOCK) return { halfW: 0.8, halfH: 0.8, halfD: 0.8 };
  if (o.type === LOG) return { halfW: 1.3, halfH: 0.5, halfD: 0.5 };
  // GATE: bar overhead
  if (o.type === GATE) return { gate: true, barY: 1.85, halfHeight: 0.2, halfW: 1.3, halfD: 0.3 };
  return { halfW: 0.5, halfH: 0.5, halfD: 0.5 };
}

function checkCollision(o) {
  const px = player.position.x;
  const py = player.position.y;
  const d = obstacleDim(o);

  if (d.gate) {
    // Gate: collide only if player upright (not sliding) and in middle (any lane near center)
    if (playerState.sliding) return false;
    const inW = Math.abs(px) < 1.4;
    const inZ = Math.abs(o.z - player.position.z) < d.halfD + 0.5;
    if (inW && inZ) return true;
    return false;
  }

  const inZ = Math.abs(o.z - player.position.z) < d.halfD + 0.5;
  if (!inZ) return false;
  const inX = Math.abs(o.x - px) < d.halfW + 0.5;
  if (!inX) return false;

  // vertical (jump over low obstacles)
  const pyTop = py + (playerState.sliding ? 0.7 : 1.7);
  const obBottom = d.halfH > 0.6 ? 0 : 0.5;
  const jumpOver = py > d.halfH + (o.type === LOG ? 0.3 : 0);
  if (jumpOver) return false;
  return true;
}

// ---------- Update ----------
let spawnTimer = 0;
let lastTime = performance.now();

function animate(time) {
  requestAnimationFrame(animate);
  const dt = Math.min((time - lastTime) / 1000, 0.05);
  lastTime = time;

  // Clouds drift slowly
  for (const c of clouds) {
    c.position.x += dt * 1.2;
    if (c.position.x > 40) c.position.x = -40;
  }

  if (running) {
    // Increase speed gradually
    scrollSpeed = Math.min(BASE_SPEED + score / 100, BASE_SPEED * 2.2);

    // Move world forward (player stays, world scrolls toward +z)
    distance += scrollSpeed * dt;
    score += scrollSpeed * dt * 1.5; // score grows with distance

    for (const o of activeObstacles) o.z += scrollSpeed * dt;
    for (const c of activeCoins) c.z += scrollSpeed * dt;
    for (const o of activeObstacles) o.mesh.position.z = o.z;
    for (const c of activeCoins) c.mesh.position.z = c.z;

    // Spin coins
    for (const c of activeCoins) c.mesh.rotation.y += dt * 4;

    // Player movement toward target lane
    player.position.x += (playerState.targetX - player.position.x) * Math.min(dt * 10, 1);

    // Jump physics
    if (playerState.jumping) {
      playerState.vy -= 30 * dt;
      playerState.y += playerState.vy * dt;
      if (playerState.y <= 0) {
        playerState.y = 0;
        playerState.vy = 0;
        playerState.jumping = false;
      }
    }
    if (playerState.sliding) {
      playerState.slideTimer -= dt;
      if (playerState.slideTimer <= 0) {
        playerState.sliding = false;
        player.scale.set(1, 1, 1);
      }
    }
    player.position.y = playerState.y;

    // Spawning
    spawnTimer -= dt;
    if (spawnTimer <= 0) {
      nextZ += SPAWN_GAP;
      spawnAt(nextZ);
      spawnTimer = SPAWN_GAP / scrollSpeed;
    }

    // Recycle objects that pass behind camera
    recycleObstacles();

    // Collisions
    for (const o of activeObstacles) {
      if (checkCollision(o)) {
        gameOver();
        break;
      }
    }
    if (running) {
      for (const c of activeCoins) {
        if (!c.taken && Math.abs(c.x - player.position.x) < 1 && Math.abs(c.z - player.position.z) < 1.2) {
          c.taken = true;
          coinCount++;
          c.mesh.visible = false;
          scene.remove(c.mesh);
        }
      }
    }

    // Camera slight idle bob follows speed feel
    camera.position.z = 14 - scrollSpeed * 0.15;

    updateHUD();
  }

  // player lean
  const lean = (playerState.targetX - player.position.x) * 0.15;
  player.rotation.z += (lean - player.rotation.z) * 0.15;

  renderer.render(scene, camera);
}

// ---------- Resize ----------
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ---------- Boot ----------
requestAnimationFrame(animate);
