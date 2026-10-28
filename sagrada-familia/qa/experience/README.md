# Experience layer — QA notes

Files owned by the experience task:

    src/experience.js              entry: createExperience(ctx), modes, debug API, URL params
    src/experience/ui.js           all DOM: splash, HUD, tour captions, cards, plan, mobile sheet
    src/experience/controls.js     walk/fly controller, pointer lock, drag fallback, touch input
    src/experience/tour.js         guided tour state machine and cinematic transitions
    src/experience/collide.js      circle-vs-box (ry) / circle-vs-circle collision
    src/experience/minimap.js      canvas ground plan
    src/experience/audio.js        procedural WebAudio ambience, bells, reverb, footsteps
    src/experience/util.js         small helpers
    css/ui.css                     every experience-layer style (tokens come from css/base.css)

Static / offline checks (no browser, safe to run any time):

    node qa/experience/check-imports.mjs    # every named import resolves
    node qa/experience/check-symbols.mjs    # no shared kit symbol used without import
    node qa/experience/check-css.mjs        # css brace balance
    node --check src/experience.js          # + each src/experience/*.js

    node --import ./qa/experience/three-register.mjs qa/experience/unit.mjs
        # 36 offline checks: collision push-out (axis + rotated boxes + circles,
        # vertical filtering, clamp), and the tour state machine (dwell, travel,
        # pause, next/prev, finish, stop collision safety)

## Running QA (only when the Lead green-lights a serialized browser run)

The machine is CPU-sensitive: one browser at a time, 800×450 default viewport,
close immediately. `qa/shot.mjs` uses real GPU ANGLE/D3D11 in headless mode.

Screenshots:

    SHOT_W=800 SHOT_H=450 node qa/shot.mjs "http://127.0.0.1:8141/" qa/experience/splash.png 12000
    SHOT_W=800 SHOT_H=450 node qa/shot.mjs "http://127.0.0.1:8141/?skipSplash=1&mode=walk&pos=0,2,40&look=0,20,-20" qa/experience/walk-interior.png 12000
    SHOT_W=800 SHOT_H=450 node qa/shot.mjs "http://127.0.0.1:8141/?skipSplash=1&mode=fly&pos=70,25,95&look=0,55,0" qa/experience/fly.png 12000
    SHOT_W=800 SHOT_H=450 node qa/shot.mjs "http://127.0.0.1:8141/?skipSplash=1&time=21.5&mode=fly&pos=60,18,80&look=0,50,0" qa/experience/night.png 12000
    SHOT_W=390 SHOT_H=844 node qa/shot.mjs "http://127.0.0.1:8141/?skipSplash=1&mode=fly&pos=70,30,100&look=0,50,0" qa/experience/mobile.png 12000

Note: first paint can take several seconds while builders merge geometry and
shaders compile; the loader stays up until boot completes. Give the shot at
least 10–12 s, or wait for `window.__sagrada.uiReady` in a script.

Programmatic test (one browser, closes itself):

    node qa/experience/test.mjs

It drives `window.__sagrada.simulate(seconds)` so movement/physics assertions do
not depend on render frame-rate under headless GPU. `simulate` runs the same
`experience.update(dt)` path as the rAF loop and returns
`{ pos, mode, photo, yaw, pitch, look, tour }`.

## Debug contract

URL parameters (applied immediately when `?skipSplash=1`):

    skipSplash=1            don't show the entry screen
    mode=walk|fly|tour      initial mode
    pos=x,y,z               camera position (metres)
    look=x,y,z              camera look target
    time=0..24              time of day (e.g. 21.5)
    tour=<stopId>           start the guided tour at a stop (e.g. ?tour=nave)
    ui=0                    hide every overlay
    hud=0                   hide only the HUD chrome
    photo=1                 photo mode (all overlays hidden)

`window.__sagrada` (augmenting main.js; never replaces its fields):

    setPose(pos, look)      teleport the free camera
    teleport(id)            jump to a TOUR stop (walk stops land at eye height)
    setMode('walk'|'fly'|'tour')
    startTour(idOrIndex)
    setTime(h)              also updates clock + slider UI
    hideUI(bool)
    openHotspot(id)         open an info card by id (QA)
    hotspots()              list of { id, title, position, radius }
    view()                  { mode, photo, locked, pos, yaw, pitch, lookTarget }
    simulate(seconds, step) deterministic fixed-step update for QA
    getMode(), modeName, uiReady, ready
    mode()                  main.js's getter function (kept intact)

## Known issues / notes

* **Headless render starvation.** Under software WebGL (SwiftShader) the scene is
  far below real time, so keyboard movement appears frozen in screenshots even
  though input works. Use `simulate()` or the real GPU path for QA. The earlier
  "W does not move" failures in `test.mjs` were this.
* **Pointer lock in headless.** A click on the canvas requests pointer lock; if
  the headless browser refuses it (pointerlockerror), the experience falls back
  to drag-to-look and shows a single toast. QA never needs pointer lock.
* **Tour framing.** The authored TOUR stops are used verbatim by 	eleport()
  (the QA contract compares against them). The cinematic tour uses framing
  overrides in TOUR_FRAMING: exterior stops widen the lens (fov 74-76) and
  raise their look target so the tower of Jesus stays in frame; interior stops
  drop to eye level (1.9 m) with subject-level targets instead of looking into
  the vaults. Travel interpolates the lens smoothly and restores 58° on exit.
* **Tour transitions.** Travel is an eased arc with a lifted midpoint for long
  moves. Moving from an interior stop to an aerial stop necessarily crosses the
  shell for a moment (the vault); endpoints are collision-checked and no stop
  ends inside geometry.
* **Initial time.** The experience opens at 16:45 late-afternoon light
  (DEFAULT_HOUR, applied via pp.setTimeOfDay); the N key / Night button
  still toggle between 10:21 and 21:30 as before. ?time= overrides it.
* **Entry screen timing.** The splash is held at opacity 0 and fades in only
  after main.js dismisses the loader (so a cold start never shows the splash
  through the loading screen), with a 15 s fallback reveal.
* **Movement.** Walking is 4.6 m/s, sprinting 9.0 m/s. The verifier's
  walk-to-interior check needs a 10-12 s hold at this natural speed (the old
  5 s allowance assumed a much faster game-style walk).
* **Fly vertical mapping** (consistent across controls, HUD hints and Help):
  Space or E rises, Ctrl or Q descends. When a hotspot label is active,
  E reads the card instead of rising; Q remains descend. Walk mode uses
  Space only as a queued jump (no bunny-hop from holding it).
* **Software GPU.** If main.js detects SwiftShader/llvmpipe
  (pp.softwareRenderer), the HUD footer appends · SOFTWARE and the Help
  card explains that antialiasing/shadows are reduced.
* **Audio** starts only after a real user gesture (`AudioContext` is created on
  the first pointer/key gesture or splash button). Headless screenshots are
  silent; AudioContext warnings before a gesture are avoided by design.
* Screenshots currently in this folder were captured during the builder
  placeholders phase (rough geometry) or while the loader was still up; they
  document the UI layout, not final geometry. They are replaced during the
  serialized visual pass.
