# MARIO 3-2 — build contract (LEAD-OWNED, READ BY ALL)

A full playable **Super Mario Bros. 3, World 3-2** remake: the underwater level — swim
mechanics, Frog Suit, Bloopers / Cheep-Cheeps / Jelectros / Boss Bass / Piranha Plants,
coin runs, a bonus pipe, a tunnel gauntlet, a vertical ascent, and the white-flag goal
with the SMB3 end-of-level card panel.

* Vanilla **HTML + JS + three.js** (r158 UMD, vendored at `vendor/three.min.js` → global `THREE`).
  No build step. Works from a static server. (Classic `<script>` tags, NOT ES modules.)
* Deterministic, fixed-timestep gameplay. 60 Hz logic.
* Everything is procedural geometry + canvas textures. No external assets, no network.

---

## 1. Coordinates & units

World units are **pixels**; the camera is an **OrthographicCamera** looking down -Z.
Y is **up**. Player origin is at the **bottom-center of its feet**.

```
WORLD_W = 6400   WORLD_H = 1080      // level bounds (x: 0..WORLD_W)
TILE    = 32
WATER_TOP_Y = 900     // for open-water sections, the surface line
FLOOR_Y     = 40      // sea floor
```

Camera: `OrthographicCamera(-W/2, W/2, H/2, -H/2, 0.1, 2000)`, positioned at
`(camX, camY, 600)`, looking at `(camX, camY, 0)`. Default view height **800** units
(so ~25 tiles tall), width = `viewH * aspect`, clamped view width 1100..1500.

Z layers (render only, no 3D gameplay):
`z=-60 bg sky/water gradient`, `z=-40 far silhouette`, `z=-25 mid silhouette`,
`z=-6 water surface/caustic planes`, `z=0 gameplay`, `z=8 decorative foreground`.

## 2. Gameplay constants (tune here only)

Player box: **w=26, h=30** (small) / **h=46** (big), origin at feet center.
Surface gravity **2350 px/s²**, swim gravity **420 px/s²** (water drag), terminal fall **-1150**.
Run max **260**, sprint **360**, accel ground **1900**, friction **1500**.
Swim: max vertical **-330..+210**, horizontal accel **900**, drag **3.2/s**.
Jump (surface sections only): vy **820**, hold-gravity factor 0.55.
Invulnerability after damage: **1.6 s**. Death: fall below `y < -120`, hazard touch, timeout.
Timer: **300** units for the full level, 1 unit per 0.4 s.

## 3. File map & ownership (ONLY edit the files you own)

```
mario-3-2/
  index.html            LEAD        shell, canvas, HUD DOM, script order
  css/style.css         UI          pixel HUD + overlays, safe w/ DOM elements only
  vendor/three.min.js   LEAD        three r158 UMD (already present)
  js/core.js            LEAD        namespace, input, math/AABB helpers, fixed loop, persistence
  js/textures.js        WORLD       procedural canvas textures + material cache
  js/world.js           WORLD       renders level geometry (zones, blocks, pipes, deco, bg)
  js/camera.js          UI          camera controller + parallax background layers
  js/particles.js       UI          pooled sprite/point particle system (bubbles, sparkles, dust)
  js/audio.js           AUDIO       procedural WebAudio SFX + underwater music loop
  js/level.js           LEVEL       LEVEL_DATA (zones, blocks, pipes, enemies, items, checkpoints)
  js/level3d.js         LEVEL       optional: converts LEVEL_DATA -> collision structs + queries
  js/player.js          PLAYER      player physics, swim states, power-ups, damage/death, anim
  js/entities.js        PLAYER      enemy + item classes, spawn/update/render, contact rules
  js/goal.js            LEAD        flag, card panel, level-complete sequence
  js/hud.js             UI          HUD binding, messages, minimap, overlays
  js/main.js            LEAD        boot, state machine (title/play/dead/clear), wiring, debug API
  serve.js              LEAD        zero-dependency static dev server
  test/smoke.js         LEAD        headless-chrome smoke test (errors + screenshots + drive)
  BUILD.md              LEAD        how to run / controls
```

Never create additional files outside your owned scope without telling the Lead.
Never edit `index.html`; the Lead already defines every script tag + the DOM ids.

## 3b. WIRING CONTRACT (main.js owns construction — use exactly these signatures)

```js
const level   = M32.LEVEL;                          // level.js
const level3d = M32.Level3D.build(level);           // level3d.js  (see 6b)
const world   = new M32.World(scene, level, level3d);          world.build();
const parts   = new M32.Particles(scene);
const rig     = new M32.CameraRig(renderer, scene, level, level3d);
const audio   = new M32.Audio();
const player  = new M32.Player(scene, level, level3d);
const ents    = new M32.Entities(scene, level, level3d);
const hud     = new M32.Hud();
const goal    = new M32.Goal(scene, level, level3d);
```
`main.js` puts them on `M32.Game` and then calls, each fixed step:
`Input.poll() → input → player.update(dt) → ents.update(dt) → world.update(dt)
→ goal.update(dt) → particles.update(dt) → rig.update(dt) → hud.update(dt) → audio.tick(dt)`.
`M32.Game.level3d` is the shared collision world — **use `M32.Game.level3d`** anywhere
you need collision/water queries. Nothing else may construct these classes.

## 4. Global namespace (single file-level object per module)

Every module starts with exactly one `window.M32 = window.M32 || {};` then adds its names.

```js
// core.js
window.M32 = window.M32 || {};
M32.C = { WORLD_W, WORLD_H, TILE, WATER_TOP_Y, FLOOR_Y, GRAVITY, SWIM_GRAVITY, ... }  // constants
M32.clamp(v,a,b) M32.lerp(a,b,t) M32.approach(v,target,step) M32.aabb(a,b)         // a,b={x,y,w,h}
M32.rng(seed) -> function(){return 0..1}     // deterministic PRNG (mulberry32)
M32.Input   // { left,right,up,down,run,jump,strokes, prevJump, prevStroke, any, pressed(name), consumed(...) }
M32.Game    // set by main.js: { state, time, dt, frame, player, world, camera, hud, audio, particles, entities, goal }
M32.onGameReady(fn)  // queue callback run after M32.Game is fully wired
```

`Input` specifics (PLAYER must use these):
* `Input.down('left')` etc. via booleans `Input.left/right/up/down/run`.
* `Input.jump` = jump/swim-stroke held. `Input.jumpPressed` = edge this tick.
* `Input.strokePressed` = edge for the main stroke key (Space / Z / W / Up).
  In water a stroke is triggered by fresh `strokePressed`, and holding `up` gives a
  weaker continuous swim. On land `jumpPressed` jumps.
* Keys: ←→ A/D move · ↑/W/Space/Z jump & swim stroke · ↓/S dive · Shift/X run
  · P/Esc pause · M mute · R restart. Touch buttons are provided by index.html as
  `<button data-key="left">` etc. — the Input module already binds them; modules never
  bind DOM keys themselves.

## 5. Level data schema (`js/level.js` → `M32.LEVEL`)

```js
M32.LEVEL = {
  name: '3-2', width: 6400, height: 1080,
  zones: [
    // Solid water is implicit: every zone with `water:true` fills from yBottom..yTop.
    { x:0, w:700, yBottom:40, yTop:900, water:true, kind:'open' },
    { x:700, w:900, yBottom:470, yTop:560, water:true, kind:'tunnel' }, // corridor
    { x:1600, w:500, yBottom:40, yTop:900, water:true, kind:'open', surface:false },
  ],
  // Solid terrain tiles (coral/stone). Drawn by world.js, collided by level3d.js.
  blocks: [
    // x,y = bottom-left corner in world px; w,h default 32
    { x:0, y:0, w:6400, h:40, type:'floor' },        // sea floor
    { x:300, y:200, w:96, h:32, type:'coral' },       // ledge
    { x:900, y:600, w:64, h:64, type:'stone' },
    { x:1200, y:0, w:32, h:700, type:'wall' },        // pipe body / cliff face
  ],
  // Classic pipes (drawn as green pipe w/ rim). `dir` = where the mouth points.
  pipes: [ { x:1400, y:40, w:96, h:128, dir:'up', target:'bonus' } ],
  // Enemy spawn markers
  enemies: [
    { type:'blooper', x:800, y:600 },
    { type:'cheep', x:1000, y:400, variant:'red' },     // red = sine wave, green = straight
    { type:'jelectro', x:1200, y:500 },
    { type:'bossbass', x:2400, y:300 },
    { type:'piranha', x:1500, y:170, pipeX:1450 },      // emerges from pipes[i]
    { type:'spike', x:2000, y:300 },
  ],
  items: [
    { type:'coin', x:300, y:200 },                      // 1 coin
    { type:'coinArc', x:300, y:240, n:5 },              // arc of n coins
    { type:'frogsuit', x:2600, y:300, fromBlock:true }, // spawns when block above hit
    { type:'oneup', x:3100, y:300, hidden:true, trigger:{x:3100,y:300,r:60} },
    { type:'starman', x:4000, y:300 },
  ],
  blocks2: [ { x:2600, y:332, type:'itembox', content:'frogsuit' } ], // ?-blocks
  checkpoints: [ { x:900 }, { x:2600 }, { x:4300 } ],
  goal: { x:6150, y:40 },
  bonusRooms: [ { id:'bonus', x:700, y:40, w:520, h:420, coins: 24 } ],
}
```

All arrays are optional. Coordinates are bottom-left for blocks, center for enemies/items.
`level.js` also exports `M32.LEVEL.progressMarks` (array of x positions for the minimap
labels: 'Start', 'Tunnel', 'Gauntlet', 'Ascent', 'Goal').

## 6. World rendering (`world.js`)

```js
M32.World = class {
  constructor(scene, level)
  build()                       // create all meshes; call once
  update(dt, cam)               // animate caustics, swaying seaweed, bubbles
  dispose()
}
```
* Uses `M32.Textures` (textures.js) for all materials. Must **merge** static block meshes
  per material (manual BufferGeometry merge is fine) to keep draw calls low.
* Open water: gradient backdrop planes + a bright surface band at each zone `yTop` +
  animated caustic light pattern; tunnels get darker walls. Distant parallax silhouettes.
* Pipes: green cylinder/box with rim; entrance pipe glows softly; `target:'bonus'` pipes
  pulse. Pipe mouths are solid except the entrance, handled by level3d.
* Must be visually rich: coral clusters, rock arches, kelp, hanging vines, air bubbles
  columns, coin sparkles. Geometry budget: < 400 draw calls, < 250k triangles.

## 6b. Collision world (`level3d.js`)

```js
M32.Level3D = {
  build(level) -> level3d
};
// level3d:
{
  level, solids: [ {x,y,w,h,type,block?} ],   // every solid AABB (blocks + pipe walls)
  zones, pipes, rooms, blocks: [...],         // from LEVEL
  inWater(x, y) -> bool                       // is point inside a water zone
  waterTopAt(x) -> number|null                // top of the water zone at x (for surface logic)
  solidAt(x, y) -> solid|null
  query(box) -> solid[]                       // broadphase, bucketed by 64px columns
  moveX(body, dx) -> collision|null           // body {x,y,w,h}; moves and clamps x
  moveY(body, dy) -> {solid, box}|null        // moves y, returns first solid hit
  hitFromBelow(box) -> hitBlock[]             // ?blocks cracked by the box (head hits)
  roomAt(x, y) -> room|null                   // bonus room containing the point
  respawnPoint(checkpointIndex) -> {x, y}
}
```
Movement is **axis-separated** (x then y) against static AABBs — no slopes, no rotation.

## 7. Camera (`camera.js`)

```js
M32.CameraRig = class {
  constructor(renderer, scene, level)
  resize(w, h)
  update(dt)                    // follow M32.Game.player with deadzone + lookahead + shake
  shake(amount, time)
  worldToScreen(v3) -> {x,y}    // for HUD/minimap of world objects
}
```

## 8. Player (`player.js`)

```js
M32.Player = class {
  constructor(scene, level, world)
  reset(x, y)                   // respawn at checkpoint
  update(dt)                    // input -> physics -> collision -> animation
  damage(source)                // lose power state; if small -> die()
  die()
  setPower(power)               // 'small' | 'big' | 'frog'
  invincible                    // starman
  onEvent(name, payload)        // emits through M32.Game.events.push({name,payload})
  mesh                          // THREE.Group at feet position
}
```
* Water detection: `M32.level3d.inWater(x, y)` (LEVEL provides it). Player is in water when
  its center y is inside a `water:true` zone and not inside a solid block.
* Swim: stroke imparts `vy += -430` clamped, with a splash bubble burst; holding up adds
  `-160` thrust. Body rotates slightly toward velocity; flipper kick in frog suit (faster
  swim: `maxH *= 1.25`, stroke `*1.3`). On the surface (`waterTop - y < 6`) the player may
  jump out of the water (SMB3 lets you leap: `vy=760` when stroke at the surface).
* Enemies damage on contact unless stomped (top contact for cheep/bossbass) or invincible.
  Frog suit lets the player swim faster and *stomp* underwater enemies.
* Bounce/stomp: `vy = 700`, tiny hitstop.

## 9. Entities (`entities.js`)

```js
M32.Entities = class {
  constructor(scene, level, world)
  spawn(type, opts)            // from level data; returns entity
  update(dt, player)
  render()                     // only if not doing direct mesh updates
  reset()                      // re-spawn all from level data (after death/restart)
  contact(player)              // resolve player<->entity interactions
  coins, groups...
}
```
Enemy types + behaviour (all Meshes built from primitives, each ~60-200 tris):

| type | look | behaviour | player interaction |
|---|---|---|---|
| `blooper` | white bell + 8 tentacles | pulsing bell, jets upward in bursts, drifts, tentacles wave | stompable on top (squish→poof); else damage |
| `cheep` (green) | orange fish w/ tail | swims straight horizontally, wing flap | stompable; else damage |
| `cheep` (red) | red fish | sine-wave path around spawn | stompable; else damage |
| `jelectro` | dark blue jellyfish + electric arcs | bobs up/down slowly, sparks arc between tentacles | **invincible hazard** — never stompable |
| `bossbass` | huge green fish, 3x scale | patrols a lane, lunges at player when within 300, chomps (scales mouth) | damaged only by frog-suit stomp / invincible; else damage |
| `spike` | green ball w/ spikes | slow roll left/right, spikes | invincible hazard |
| `piranha` | red/white plant | rises out of a pipe on a timer when player is >70 px away, then retracts | invincible; damage on touch |
| `frog` | green frog (helmetless) | hops in arcs along platforms | stompable |

Items: `coin` (animated spin), `coinArc` (n coins in an arc), `frogsuit` (green suit pickup),
`oneup` (green mushroom), `starman` (flashing star; 10 s invincibility, music switch),
`itembox` is a block (world/level) that when hit from below spawns its content.

All entities must be **pooled / capped** (≤ 140 live) and update in O(live).

## 10. Particles (`particles.js`)

```js
M32.Particles = class {
  constructor(scene)
  burst(pos, opts)   // {count, color, speed, size, life, gravity, spread:'circle'|'up', sprite:'bubble'|'dot'|'star'|'ring'}
  trail(pos, opts)
  update(dt)
  clear()
}
```
Pool of ~600 `THREE.Sprite` or `Points` with additive blending. Bubbles rise, sparkles
fall, dust puffs settle.

## 11. Audio (`audio.js`)

```js
M32.Audio = class {
  constructor()
  unlock()                      // call on first user gesture
  play(name, opts)              // 'jump','stroke','coin','stomp','powerup','damage','die','oneup','clear','bubble','boss','swimLoop'
  music(state)                  // 'title' | 'underwater' | 'clear' | 'none'
  setMuted(bool) / muted
  tick(dt)                      // schedule sequencer steps
}
```
All synthesized with OscillatorNode/BufferSource + BiquadFilter; **no external files**.
Underwater theme: slow, bubbly, consonant (e.g. Dorian pad + plucked arpeggio), must not
clash. Keep master gain modest (0.5) and everything ≤ -6 dBFS.

## 12. HUD (`hud.js`) + CSS (`css/style.css`)

index.html provides this DOM. Do not rename ids.

```
<div id="hud">        #score #coins #world #time #lives #power #strokes
<div id="minimap">    <div id="minimap-track"><div id="minimap-dot"></div>... labels
<div id="overlay">    <div id="overlay-title"> <div id="overlay-sub"> <div id="overlay-hint">
<div id="toast">      transient message banner
<div id="pause">      pause panel
<div id="touch">      on-screen controls (down/left/right/stroke)
```
`M32.Hud = class { constructor(); bind(game); update(dt); toast(text, opts); overlay(title, sub,
hint, opts); hideOverlay(); setPower(power); flash(); }`
Style: SMB3-ish pixel HUD (press-start-2p-like look via CSS letter-spacing + borders,
`image-rendering: pixelated`), crisp, readable over bright water. Mobile safe: media queries
under 700 px shrink the HUD, show touch controls.

## 13. Events / wiring

`main.js` drives, in this order every frame:
```
input.poll() -> Game.time += dt; player.update -> entities.update -> world.update ->
particles.update -> camera.update -> hud.update -> audio.tick -> goal.update -> render
```
Modules communicate **only** via `M32.Game.*` and `M32.Game.events` (`{name, payload, t}`):
`coin`, `score`, `powerup`, `damage`, `death`, `stomp`, `goal`, `checkpoint`, `bubble`,
`timer-low`, `boss-hit`. `main.js` listens for `coin/score` to update totals, `death` to run
the life-loss state machine, `goal` to run the clear sequence.

## 14. Debug API (main.js sets this — the smoke test uses it)

```js
window.M32.DEBUG = {
  ready:true, errors:[],
  state(), // 'title'|'play'|'pause'|'dead'|'clear'|'gameover'
  teleport(x,y), setPower(p), giveInvincible(sec), press(key,ms), hold(key,bool),
  simulate(seconds), // fast-forward fixed steps without rendering
  stats(), // {fps, draws, tris, coins, score, lives, time, playerX, playerY, enemies}
  screenshotReady,
  skipTo(x),
}
```

## 15. Quality bar

* 60 fps at 1280×720 in Chrome/Edge headless; single render pass, no postprocessing.
* No console errors, no uncaught promise rejections, no WebGL warnings spamming.
* Every enemy is killable or avoidable by a competent player; no unfinishable state.
* Death → checkpoint respawn; losing all lives → title. Completing the level → card panel →
  score tally → title after ~8 s or on key.
* The level **must be completable start→goal** within ~300 s by holding right + mashing
  stroke in the open sections. That is the primary acceptance test.
