# Tour Eiffel — procedural three.js

A procedurally generated Eiffel Tower rendered with **three.js**, as plain HTML + JS.
No build step, no bundler, no external models, no textures: every one of the
**4,382 structural members** is generated from code at load time.

![panorama](research/shots/FINAL-tint.png)

![first level](research/shots/ok-level1.png)

## Run it

**Option A — just open it.** Double-click `index.html`. All scripts are plain
classic `<script>` tags with local files, so this works straight from disk.

**Option B — local server** (recommended, and required by some hardened browser
configurations):

```
serve.cmd            ::  then open http://localhost:8080/
```

## What you get

| Feature | Detail |
|---|---|
| Geometry | 4,382 members / 1,682 structural nodes, ~61.7 k triangles, 9 instanced draw calls, 107 plain meshes |
| Scale | Bounding box exactly **125.0 m × 330.0 m × 125.0 m** (official dimensions) |
| Structure | 4 splayed curved legs × 4 chords, nested diagonal hierarchies, 4 Sauvestre arches, 3 platforms, elevator tracks, stairs, antenna |
| Lighting | Image-based lighting from a generated sky (PMREM), sun with 4096² soft shadows, hemisphere + ambient fill |
| Time of day | Continuous slider, night → dusk → day, driving sky, fog, sun, and the tower's own uplights/beacons |
| Paint scheme | Per-instance vertical colour degrade, darkest at the base and lightest at the top — the real paint scheme's stated purpose is to *accentuate the taper* |
| Camera | Damped orbit (drag / wheel / right-drag pan / pinch), 6 presets, turntable, auto-framed |
| Detail | Full ↔ compact lattice toggle (rebuilds at 4,382 or 2,232 members) |
| Context | Esplanade plaza and the two tree-lined axes, purely for scale |

Keyboard: `Space` toggles the turntable, `H` hides the UI.

Deep links: `index.html?tod=0.05&view=arch&detail=compact&shadows=0&spin=0`

## Controls

- **Time of day** — 0 = deep night, 0.35 = sunset, 1 = bright afternoon.
- **Detail** — Full (4,382 struts) or Compact (2,232) for weaker GPUs.
- **Auto-spin** — turntable.
- **Shadows** — toggle the shadow map.

## Layout

```
index.html                 entry point: markup, CSS, UI
src/main.js                scene, day/night art direction, orbit camera, UI wiring
src/eiffelTower.js         the procedural tower builder (MIT, derived — see below)
vendor/three.min.js        three.js r160, vendored so the page works offline
vendor/ATTRIBUTION.md      licence and provenance
serve.cmd                  one-line local HTTP server
research/                  the research that produced this (see research/README.md)
```

## Provenance and licence

The procedural builder in `src/eiffelTower.js` is a **derived work under the MIT
licence**: `buildEiffelTower()` and `EIFFEL_OFFICIAL_DIMENSIONS` are taken from
[`iamtechartist/eiffel-tower-district`](https://github.com/iamtechartist/eiffel-tower-district)
(Copyright © 2026 Techartist, MIT) and repackaged as a standalone classic script.
The MIT notice is preserved in the file header and in `vendor/ATTRIBUTION.md`.

`research/repos/` contains **third-party clones kept for reference only**; they
carry their own licences and must not be redistributed as part of this project.
Note in particular that `eiffel-tower-3d` and `threejs-eiffel-tower-animation`
ship **no licence at all**.

three.js is MIT, © three.js authors.
