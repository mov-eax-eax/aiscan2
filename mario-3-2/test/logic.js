// Node logic harness for MARIO 3-2 — no browser, no rendering.
// Loads core/level/level3d/textures/player/entities with a minimal DOM stub and
// THREE (UMD build loads in Node), then verifies collision, water, traversal,
// swim physics, enemies/items and the goal trigger.
//
//   node test/logic.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const report = { checks: [], pass: 0, fail: 0, info: {} };

function check(name, ok, detail) {
  report.checks.push({ name, ok: !!ok, detail: detail === undefined ? null : detail });
  if (ok) report.pass++;
  else report.fail++;
  return ok;
}

/* ------------------------------------------------------------ DOM stub */
function makeCtx2d(canvas) {
  const grad = { addColorStop() {} };
  const handler = {
    get(target, prop) {
      if (prop === 'canvas') return canvas;
      if (prop === 'createLinearGradient' || prop === 'createRadialGradient' || prop === 'createPattern') {
        return () => grad;
      }
      if (prop === 'measureText') return () => ({ width: 12 });
      if (prop === 'getImageData') return (x, y, w, h) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h });
      if (prop === 'putImageData') return () => {};
      if (prop === 'getContext') return () => makeCtx2d(canvas);
      if (prop in target) return target[prop];
      return () => {};
    },
    set(target, prop, value) {
      target[prop] = value;
      return true;
    },
  };
  return new Proxy({}, handler);
}

function makeCanvas() {
  const canvas = {
    width: 2,
    height: 2,
    style: {},
    getContext(kind) {
      if (kind === '2d') return makeCtx2d(canvas);
      return null;
    },
    addEventListener() {},
    removeEventListener() {},
  };
  return canvas;
}

const fakeDocument = {
  createElement(tag) {
    if (tag === 'canvas') return makeCanvas();
    return { style: {}, getContext: () => null, addEventListener() {}, appendChild() {}, remove() {}, setAttribute() {} };
  },
  createElementNS(ns, tag) {
    return fakeDocument.createElement(tag);
  },
  getElementById() {
    return null;
  },
  querySelectorAll() {
    return [];
  },
  querySelector() {
    return null;
  },
  body: { appendChild() {}, removeChild() {} },
  documentElement: { style: {} },
  addEventListener() {},
  removeEventListener() {},
};

/* --------------------------------------------------------------- loaders */
global.window = globalThis;
global.self = globalThis;
global.document = fakeDocument;
global.navigator = { getGamepads: () => [], userAgent: 'node' };
global.localStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
};
global.HTMLCanvasElement = function () {};
global.AudioContext = function () {
  throw new Error('no audio in node');
};
global.requestAnimationFrame = (fn) => setTimeout(() => fn(Date.now()), 16);
global.performance = global.performance || { now: () => Date.now() };
global.window.innerWidth = 1280;
global.window.innerHeight = 720;
global.window.devicePixelRatio = 1;
global.window.addEventListener = () => {};
global.window.removeEventListener = () => {};

const THREE = require(path.join(ROOT, 'vendor', 'three.min.js'));
global.THREE = THREE;
report.info.threeRevision = THREE.REVISION;

function load(file) {
  const code = fs.readFileSync(path.join(ROOT, 'js', file), 'utf8');
  vm.runInThisContext(code, { filename: file });
}

const loadErrors = [];
for (const f of ['core.js', 'textures.js', 'level.js', 'level3d.js', 'player.js', 'entities.js', 'goal.js']) {
  try {
    load(f);
    report.info['load_' + f] = 'ok';
  } catch (e) {
    report.info['load_' + f] = 'FAILED: ' + e.message;
    loadErrors.push(f + ': ' + e.message);
  }
}
check('all modules load in node', loadErrors.length === 0, loadErrors);

const M = global.M32;
const C = M.C;
const level = M.LEVEL;
check('level data exists', !!level, level && { width: level.width, blocks: level.blocks.length, enemies: level.enemies.length });

/* --------------------------------------------------------------- build */
const level3d = M.Level3D.build(level);
M.Game.level = level;
M.Game.level3d = level3d;
M.Game.particles = null;
M.Game.audio = null;
M.Game.hud = null;
M.Game.entities = null;

report.info.level = {
  width: level.width,
  zones: level.zones.length,
  blocks: level.blocks.length,
  blocks2: level.blocks2.length,
  pipes: level.pipes.length,
  enemies: level.enemies.length,
  items: level.items.length,
  checkpoints: level.checkpoints.length,
  solids: level3d.solids.length,
  rooms: level3d.rooms.length,
};

check('level3d builds', level3d.solids.length > 40, level3d.solids.length);
check(
  'water at spawn',
  level3d.inWater(level.start.x, level.start.y),
  { x: level.start.x, y: level.start.y }
);
check('no water on beach plateau', !level3d.inWater(6150, 940), level3d.inWater(6150, 940));
check('water top at start is 900', level3d.waterTopAt(200) === 900, level3d.waterTopAt(200));

/* --------------------------------------------- free-space flood fill (16px) */
const CELL = 16;
const COLS = Math.floor(level.width / CELL);
const ROWS = Math.floor(1080 / CELL);
const BW = 26;
const BH = 46;
function cellCenter(cx, cy) {
  return { x: cx * CELL + CELL / 2, y: cy * CELL + CELL / 2 };
}
function freeAt(cx, cy) {
  const c = cellCenter(cx, cy);
  // box anchored at the feet (matches the player's box semantics)
  const box = { x: c.x - BW / 2, y: c.y, w: BW, h: BH };
  if (box.x < 0 || box.x + box.w > level.width) return false;
  if (box.y < 0) return false;
  const solids = level3d.query(box);
  for (const s of solids) if (M.aabb(box, s)) return false;
  return true;
}
function cellOf(x, y) {
  return { cx: Math.floor(x / CELL), cy: Math.floor(y / CELL) };
}
const startCell = cellOf(level.start.x, level.start.y);
// goal: standing in front of the flag on the plateau (feet on the plateau top)
const goalCell = cellOf(level.goal.x - 60, level.goal.y);

const visited = new Uint8Array(COLS * ROWS);
const q = [startCell.cx + startCell.cy * COLS];
visited[q[0]] = 1;
let head = 0;
const NEI = [
  [1, 0], [-1, 0], [0, 1], [0, -1],
  [1, 1], [1, -1], [-1, 1], [-1, -1],
];
while (head < q.length) {
  const idx = q[head++];
  const cx = idx % COLS;
  const cy = (idx / COLS) | 0;
  for (const [dx, dy] of NEI) {
    const nx = cx + dx;
    const ny = cy + dy;
    if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS) continue;
    const ni = nx + ny * COLS;
    if (visited[ni]) continue;
    if (!freeAt(nx, ny)) continue;
    visited[ni] = 1;
    q.push(ni);
  }
}
const goalReachable = !!visited[goalCell.cx + goalCell.cy * COLS];
check('geometry: goal reachable from start by free-space flood fill', goalReachable, {
  startCell,
  goalCell,
  reachableCells: q.length,
});
report.info.floodFill = { reachableCells: q.length, totalCells: COLS * ROWS, goalReachable, startCell, goalCell };

// checkpoints reachable
for (let i = 0; i < level.checkpoints.length; i++) {
  const cp = level.checkpoints[i];
  const c = cellOf(cp.x, cp.y);
  const ok = !!visited[c.cx + c.cy * COLS];
  check('geometry: checkpoint ' + (i + 1) + ' reachable (' + (cp.label || '') + ')', ok, { x: cp.x, y: cp.y });
}

// per-column: an open gap of >= 96px must exist somewhere in every column
let narrow = [];
for (let cx = 3; cx < Math.floor((level.goal.x + 80) / CELL); cx++) {
  let best = 0;
  let run = 0;
  for (let cy = 0; cy < ROWS; cy++) {
    if (freeAt(cx, cy)) {
      run++;
      best = Math.max(best, run);
    } else run = 0;
  }
  if (best < 6) narrow.push({ x: cx * CELL, gap: best * CELL });
}
check('geometry: every column has a >=96px vertical opening', narrow.length === 0, narrow.slice(0, 8));

/* ------------------------------------------------------ player + entities */
const scene = new THREE.Scene();
M.Game.scene = scene;
M.Game.player = null;
M.Game.entities = null;

const player = new M.Player(scene, level, level3d);
M.Game.player = player;

let goal = null;
if (M.Goal) {
  goal = new M.Goal(scene, level, level3d);
  M.Game.goal = goal;
}

let entities = null;
if (M.Entities) {
  entities = new M.Entities(scene, level, level3d);
  M.Game.entities = entities;
  entities.reset();
  report.info.entities = entities.all ? entities.all.length : null;
}
check('entities spawn from level data', !M.Entities || (entities && entities.all && entities.all.length > 10), entities && entities.all ? entities.all.length : 'no M.Entities');

// enemies not inside solids at spawn
let badSpawns = [];
if (entities && entities.all) {
  for (const e of entities.all) {
    const box = { x: e.x - (e.w || 20) / 2, y: e.y - (e.h || 20) / 2, w: e.w || 20, h: e.h || 20 };
    for (const s of level3d.query(box)) {
      if (M.aabb(box, s)) {
        badSpawns.push({ type: e.type, x: Math.round(e.x), y: Math.round(e.y) });
        break;
      }
    }
  }
}
check('no enemy spawns inside a solid', badSpawns.length === 0, badSpawns.slice(0, 6));

/* --------------------------------------------------------- physics driver */
M.Input.endTick();
function tick(dt) {
  M.Input.poll();
  player.update(dt);
  if (entities) entities.update(dt, player);
  if (goal) goal.update(dt);
  const evs = M.Game.events.slice();
  M.Game.events.length = 0;
  M.Input.endTick();
  return evs;
}
const DT = C.FIXED_DT;

function resetPlayer(x, y) {
  player.reset(x, y);
  M.Input.simulate('left', false);
  M.Input.simulate('right', false);
  M.Input.simulate('stroke', false);
  M.Input.simulate('down', false);
  M.Input.simulate('run', false);
  tick(DT);
}

// A) idle float: sinks slowly and rests on the sea floor (never falls through)
resetPlayer(level.start.x, level.start.y);
const yIdle = player.y;
let minY = player.y;
for (let i = 0; i < 180; i++) {
  tick(DT);
  minY = Math.min(minY, player.y);
}
const sinkRate = (yIdle - minY) / 3;
check('water: idle player sinks slowly (not a rock) and does not fall through the floor', minY >= 40 && sinkRate < 220, {
  minY: Math.round(minY),
  sinkRate: Math.round(sinkRate),
  inWater: player.inWater,
});

// A2) rhythmically stroking keeps you hovering at roughly the same depth
resetPlayer(400, 500);
const yHover = player.y;
let hoverMin = 1e9;
let hoverMax = -1e9;
for (let i = 0; i < 240; i++) {
  if (i % 30 === 0) {
    M.Input.simulate('stroke', false);
    M.Input.simulate('stroke', true);
  } else if (i % 30 === 8) {
    M.Input.simulate('stroke', false);
  }
  tick(DT);
  hoverMin = Math.min(hoverMin, player.y);
  hoverMax = Math.max(hoverMax, player.y);
}
check('water: sustained strokes can ascend to the surface', hoverMax > yHover + 250, {
  yHover: Math.round(yHover),
  hoverMin: Math.round(hoverMin),
  hoverMax: Math.round(hoverMax),
});

// B) stroke lifts the player
resetPlayer(400, 300);
const y0 = player.y;
for (let i = 0; i < 90; i++) {
  if (i % 20 === 0) {
    M.Input.simulate('stroke', false);
    M.Input.simulate('stroke', true);
  }
  tick(DT);
}
check('water: stroking gains height', player.y > y0 + 40, { from: Math.round(y0), to: Math.round(player.y) });

// C) swim right progress with a simple lane-keeping controller
resetPlayer(level.start.x, level.start.y);
let maxX = player.x;
let stuckT = 0;
let lastX = player.x;
for (let i = 0; i < 60 * 150; i++) {
  M.Input.simulate('right', true);
  const lane = 470;
  M.Input.simulate('down', player.y > lane + 80);
  if (i % 18 === 0) {
    M.Input.simulate('stroke', false);
    M.Input.simulate('stroke', true);
  } else if (i % 18 === 6) {
    M.Input.simulate('stroke', false);
  }
  if (player.vx < 20) M.Input.simulate('stroke', true);
  tick(DT);
  maxX = Math.max(maxX, player.x);
  if (Math.abs(player.x - lastX) < 0.5) stuckT++;
  else stuckT = 0;
  lastX = player.x;
  if (player.x > level.goal.x - 120) break;
  if (player.dead) {
    resetPlayer(level.start.x, level.start.y);
  }
}
check('physics: swim controller makes large progress to the right', maxX > 4800, {
  maxX: Math.round(maxX),
  goalX: level.goal.x,
  ratio: +(maxX / level.goal.x).toFixed(2),
  stuckFrames: stuckT,
});
report.info.swimRun = { maxX: Math.round(maxX), t: 150, y: Math.round(player.y) };

// D) goal trigger on the beach
if (goal) goal.reset();
player.dead = false;
resetPlayer(6040, 900);
M.Input.simulate('right', true);
let sawGoal = false;
for (let i = 0; i < 60 * 8; i++) {
  const evs = tick(DT);
  if (evs.some((e) => e.name === 'goal')) sawGoal = true;
  if (sawGoal) break;
}
M.Input.simulate('right', false);
check('goal: walking to the flag emits goal', sawGoal, { x: Math.round(player.x), y: Math.round(player.y) });

// E) gravity/landing in the dry bonus room
resetPlayer(940, 1400);
let grounded = false;
for (let i = 0; i < 120; i++) {
  tick(DT);
  if (player.onGround) grounded = true;
}
check('land: player falls and lands in the dry bonus room', grounded, { y: Math.round(player.y), onGround: player.onGround });

// F) damage / death
resetPlayer(500, 400);
player.setPower('big');
player.damage({ type: 'test' });
const afterDamage = player.power;
resetPlayer(500, 400);
player.damage({ type: 'test' });
for (let i = 0; i < 120; i++) tick(DT);
check('damage: big -> small, small -> dead', afterDamage === 'small' && player.dead, {
  afterDamage,
  dead: player.dead,
});

// G) items + ? blocks present
check('items: coins present', level.items.filter((it) => (it.type || '').indexOf('coin') === 0).length > 10,
  level.items.filter((it) => (it.type || '').indexOf('coin') === 0).length);
check('items: ? blocks present', level.blocks2.length >= 3, level.blocks2.length);
check('items: a frog suit exists', level.blocks2.some((b) => b.content === 'frogsuit') || level.items.some((it) => it.type === 'frogsuit'), level.blocks2.map((b) => b.content));

/* --------------------------------------------------------------- report */
report.pass = report.checks.filter((c) => c.ok).length;
report.fail = report.checks.filter((c) => !c.ok).length;
console.log(JSON.stringify(report, null, 2));
process.exit(report.fail === 0 ? 0 : 1);
