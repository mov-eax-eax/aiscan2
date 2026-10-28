# Super Mario Bros. 3 — World 3-2 (Remake)

A complete, playable remake of **World 3-2**, the underwater level of *Super Mario Bros. 3*,
built from scratch with **HTML + JavaScript + three.js** (vendored, no build step, no network).

Everything is procedural: geometry, textures, animation, music and sound effects are generated
at runtime. There are no image, audio or model files.

## Run it

```bash
cd mario-3-2
node serve.js            # -> http://127.0.0.1:8173/
```

Open the printed URL in a desktop browser, press **Space** / **Z** and swim.

> A static server is required (the game loads classic scripts, but browsers block some
> file:// behaviour). Any static server works, e.g. `npx http-server`.
> `serve.js` is a zero-dependency Node server.

## Controls

| Action | Keys |
|---|---|
| Swim / run | **← →** or **A D** |
| Stroke (swim up / jump) | **Space**, **Z**, **↑** or **W** |
| Dive | **↓** or **S** |
| Dash (assist) | **Shift** or **X** |
| Pause | **P** / **Esc** |
| Mute | **M** |
| Restart level | **R** |

Touch controls appear automatically on phones/tablets. Gamepads are supported.

**Swimming is stroke-based, like SMB3:** each press of the stroke key gives a burst of upward
momentum; holding up gives a gentler continuous thrust; without input Mario slowly sinks.
Tap rhythmically to gain height. At the surface, a stroke launches Mario out of the water.

## Level 3-2 features

* The full underwater course, ~6400 px long, in eight beats:
  the open-water start, coral gardens, the tunnel and its Jelectros, the Boss Bass arena,
  a vertical ascent shaft, the deep staggered-pillar run, the surface ascent, and the
  beach finish with the white flag and the SMB3 card panel.
* Enemies: **Bloopers**, green and red **Cheep-Cheeps**, **Jelectros** (invincible electric
  jellyfish), **Boss Bass**, **Spike** balls, **Piranha Plants** and hopping frogs.
* Items: coins, coin arcs, the **Frog Suit** (faster swimming, stomps underwater enemies),
  a hidden **1-Up**, a **Starman** (invincibility), `?` blocks.
* A hidden **bonus coin room** reachable through a pipe.
* Checkpoints, a countdown timer, score/coins/lives, 3 power states (small / super / frog),
  a course-clear card panel, results tally and title screen.
* Fully procedural audio: an underwater music loop plus ~18 synthesized sound effects.

## Project layout

```
index.html          shell, HUD DOM, script order
css/style.css       pixel-art HUD, overlays, touch controls
vendor/three.min.js three.js r158 (UMD)
js/core.js          constants, math, input, game object
js/textures.js      procedural canvas textures + material cache
js/level.js         the complete 3-2 layout (zones, blocks, pipes, enemies, items)
js/level3d.js       collision world (AABB grid, water zones, pipes, checkpoints)
js/world.js         all static 3D scenery, water, coral, kelp, parallax
js/player.js        swim/run physics, power states, animation, death
js/entities.js      enemies + items and their interactions
js/goal.js          white flag, card panel, celebration
js/camera.js        orthographic follow camera, bonus-room framing, shake
js/particles.js     pooled bubbles/sparks/stars
js/audio.js         WebAudio music sequencer + SFX
js/hud.js           HUD binding, toasts, minimap, overlays
js/main.js          boot, fixed-step loop, state machine, scoring, debug API
serve.js            static dev server
test/cdp.js         headless-Chrome smoke test (screenshots + autopilot completion run)
test/playtest.js    headless-Chrome gameplay scenario test (input, items, death, pipes)
test/logic.js       Node logic harness (level traversal, collision, physics)
```

## Performance

The renderer is deliberately cheap and is decoupled from the game logic:

* **Fixed 60 Hz logic, throttled rendering.** The simulation is a fixed-step accumulator;
  rendering is capped at about 60 fps (so 120/144 Hz monitors don't burn CPU/GPU for
  nothing), 30 fps on menus, and 10 fps while paused (the scene is static then).
* **Adaptive resolution.** If the frame interval stays above ~40 fps the canvas pixel ratio
  drops in 0.2 steps (down to 0.8); it recovers automatically when there is headroom.
  Default cap is 1.5x device pixel ratio, `antialias` only kicks in below 2x DPR.
* **Pauses itself.** `visibilitychange` and window `blur` pause the game, so an alt-tabbed
  tab does no simulation or continuous rendering.
* **Low-quality mode:** `index.html?low=1` forces 1x resolution (and `?dpr=1.25` caps it).
  On hardware WebGL the whole level is ~58 draw calls / ~3k triangles, so it is
  GPU-trivial; the software-rendering fallback (headless/SwiftShader) is the only
  CPU-bound path.
* 2D canvas textures are baked once at boot and cached; the HUD only touches the DOM when
  a value actually changes; particles are one pooled draw call.

If you are profiling in headless Chrome, remember it uses SwiftShader (software GL), so you
are measuring the CPU rasteriser, not the game's GPU path — run the same URL in a normal
desktop browser for the real numbers.

## Verification

The repo ships three checks. The first two need no browser; the third drives the real
game in headless Chrome (Edge works too).

```bash
node test/logic.js        # pure Node: level geometry, collision, swim physics, damage,
                          # flood-fill start->goal reachability, enemy spawn sanity
node test/playtest.js     # real Chrome: boot, keyboard input, pause, coins, ? blocks,
                          # frog suit, death/respawn, bonus pipe, game over, audio unlock
node test/cdp.js          # real Chrome: full visual tour + autopilot start->goal run
```

`test/cdp.js` writes screenshots to `test/shots/` (title, every level section, the bonus
room, the frog suit, the goal sequence and the results screen) and a report to
`test/report.json`. Useful flags:

```bash
node test/cdp.js --quick            # skip the section tour, just boot + goal
node test/cdp.js --size=900,520     # small-laptop / tablet framing
node test/cdp.js --tag=mobile       # suffix the screenshots
```

Headless Chrome needs a real GPU/software-GL stack; the flags used are
`--headless=new --enable-unsafe-swiftshader --use-angle=swiftshader`.

## Architecture in one paragraph

`js/core.js` owns constants, input and the shared `M32.Game` hub. `level.js` is pure data
(rects/points in world pixels) and `level3d.js` turns it into an axis-aligned collision world
with water zones, pipe mouths, checkpoint respawns and a bonus room. `player.js` is a
character controller with two rule sets (water: buoyant stroke-based swimming; land: classic
running/jumping) that shares one AABB collision core; `entities.js` implements all enemies and
items with centralised contact rules. `world.js` batches the whole level into a handful of
merged meshes and animates caustics, water surfaces, kelp and foreground parallax;
`camera.js` is an orthographic side-scroll camera with lookahead, a bonus-room clamp and
shake; `particles.js` is a pooled single-draw-call points system; `goal.js` draws the flag and
card panel; `hud.js` is a cached-DOM pixel HUD; `audio.js` synthesises everything with WebAudio.
`main.js` runs a fixed 60 Hz accumulator loop and the game-state machine, and exposes
`M32.DEBUG` for tests.

## Notes

* `M32.DEBUG` in the console exposes `start()`, `teleport(x,y)`, `setPower(p)`,
  `simulate(seconds)`, `stats()` etc. for debugging.
* Best played at 1280×720 or larger. The game is fully responsive.
* This is a fan remake for demonstration; Super Mario Bros. 3 is © Nintendo.
