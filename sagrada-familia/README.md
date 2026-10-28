# La Sagrada Família — a walkable model

An extreme-detail, procedurally generated 3D study of the Sagrada Família in
Barcelona, built with Three.js. Everything is generated in code: stone, stained
glass, sculpture, roofs, mosaic, the plaza and the surrounding Eixample. There
are no external models, textures, fonts or audio files.

**Walk in.** The model is built at 1:1 metric scale. You can enter through any of
the open portals, walk the nave under the branching columns, reach the high
altar and the apse, fly above the towers, or take the guided tour. Hotspots open
short architectural notes.

## Run it

Double-click **`Open Sagrada Familia.bat`** (Windows), or from this folder:

```powershell
.\start.ps1
```

This starts a tiny local web server on `http://127.0.0.1:8141/` and opens it.
A local server is required because the app uses ES modules; opening
`index.html` directly from `file://` will not work. If you prefer:

```bash
node serve.mjs 8141
# or
python -m http.server 8141
```

Then open <http://127.0.0.1:8141/>.

### Controls

| Input | Action |
| --- | --- |
| `W A S D` | walk / fly |
| Mouse | look (click to capture the pointer) |
| `Shift` | run / boost |
| `Space` (walk) | jump |
| `Space` / `E` (fly) | rise |
| `Ctrl` / `Q` (fly) | descend |
| Mouse wheel (free fly) | change flight speed |
| `R` (free fly) | reset to an aerial survey view |
| `F` | toggle walk / free fly |
| `E` | read the hotspot under the reticle |
| `T` | guided tour |
| `M` | plan / minimap |
| `V` / `X` / `I` | mesh · section · isolate study views |
| `P` | photo mode (hides the interface) |
| `N` | toggle day / night |
| `H` | help |
| `Esc` | close a panel or release the pointer |

**Free fly** is a true no-collision 6-DOF camera: `WASD` follows your gaze,
`Space`/`E` rise, `Ctrl`/`Q` descend, `Shift` boosts, the wheel scales speed and
`R` returns to a clean aerial survey. Open it from the splash screen's **FREE FLY**
button, the mode chip (`FREE FLY`), or by pressing `F`.

**Study** (HUD → Study) adds three ways to inspect the fabric:
- **Mesh** — a cyan wireframe / X-ray survey of the geometry, including the
  surrounding city, on a dark blueprint background.
- **Section** — a live cutaway at `z = 8 m` revealing the nave, columns, vaults
  and sanctuary inside one continuous cut.
- **Isolate** — show only the shell & façades, towers & roofs, or the interior.

Touch devices get a virtual joystick and drag-look.

## What is modelled

- **Three façades**: Nativity (Gaudí’s organic sculpture), Passion (Subirachs’
  angular Via Crucis), Glory (seven portals, virtues and the great rose window),
  with deep archivolts, carved figures, the Tree of Life, cypresses, animals,
  mosaics and inscriptions.
- **Eighteen towers**: twelve apostle bell towers, four evangelist towers, the
  Virgin’s tower with its twelve-pointed star, and the tower of Jesus Christ with
  its four-armed cross. Belfries contain bells and spiral stairs.
- **Interior**: the forest of double-twist tree columns, four porphyry crossing
  columns, hyperboloid/star vaults, the crossing lantern, apse and seven radial
  chapels, high altar and baldachin, side chapels, organ gallery, stained glass
  and mosaic floors.
- **Roofscape**: glazed green gable roofs, crests, parapets and pinnacles.
- **Environment**: Plaça de Gaudí, street furniture, trees, pigeons, people, the
  Eixample grid, distant hills, moving sun, stars, moon and night floodlighting.
- **Day/night cycle** with a time slider, auto-cycle, and glass that glows from
  within after dark.

## Technical notes

- `src/config.js` is the single source of truth for dimensions, colours and the
  guided-tour stops. Units are metres. `+X` = east (Nativity), `-X` = west
  (Passion), `+Z` = south (Glory / main entrance), `-Z` = north (apse).
- `src/lib.js` holds the procedural geometry/material/texture library
  (arch builders, wall openings, figures, rose windows, bells, pinnacles,
  tree columns, merging/instancing helpers, collider/hotspot contracts).
- `src/environment.js` — sky shader, solar path, night lighting, plaza and city.
- `src/facades-np.js`, `src/glory-shell.js`, `src/towers.js`, `src/interior.js`
  are the building modules. Each returns geometry plus colliders, walkable
  surfaces and hotspots.
- `src/experience.js` (with `src/experience/`) — controls, collision, guided
  tour, HUD, minimap, audio and mobile UI.
- `src/main.js` — integration and frame loop. `index.html` / `css/` — shell.
- Three.js is vendored under `vendor/` (r170, MIT licence included). The rest is
  original procedural code.
- Performance: use the **Quality** control (low/medium/high) if the frame rate
  is low. Shadows and pixel ratio are the main cost. A modern desktop GPU is
  recommended for high quality.

## Accuracy and known issues

This is a detailed interpretive model, not a survey document. Proportions follow
published dimensions (90 m nave, 45 m nave vault, 60 m crossing, 172.5 m tower of
Jesus, 18 towers), but sculpture and some plan details are simplified or
recomposed. The intention is to let you experience the building’s space, light
and iconography by walking through it.

- **Known visual defect:** a small teal-green roof slab can be visible from
  inside at the crossing vault springing, in a few upward sight-lines. It is
  documented, with zoom evidence, in `qa/verify/REPORT.md`; it does not affect
  movement or the guided tour.
- The surrounding Eixample blocks are deliberately abstracted background massing.
- QA: `qa/verify/REPORT.md` — independent final verdict PASS, 96/96 executed
  checks (boot, builders, NaN scan, walk/collision/doors, fly, teleport, tour,
  hotspots, day/night, UI, URL/API, performance). Mobile was verified separately
  (`qa/mobile-check.png`). Hero captures are in `screenshots/` and
  `qa/verify/shots/`.

Built as a procedural study. La Sagrada Família is a real basilica in Barcelona,
designed by Antoni Gaudí and still under construction.
