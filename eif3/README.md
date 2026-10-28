# eif3 — procedural Eiffel Tower & Paris

A single-page three.js scene: the tower is generated from silhouette curves, the
surroundings are procedural, and everything builds into **one self-contained
`dist/index.html`** that runs by double-click (three.js comes from a CDN).

## Quick start

```bash
cd eif3
node tools/build.mjs                 # → dist/index.html  (single file, open it)
node tools/serve.mjs                 # → http://127.0.0.1:8123  (dev, rebuilds /app.js live)
node tools/shot.mjs dist/index.html shot.png             # headless screenshot
node tools/shot.mjs dist/index.html night.png --hash night
```

`index.html` is only a shell (styles + HUD + `<script src="./app.js">`).
The real source is in `src/`; the build concatenates it. Opening `index.html`
directly from disk will not work (browser blocks `file://` module imports) —
open `dist/index.html` or use the dev server.

## Source layout (and ownership)

All fragments are concatenated, in order, into **one ES module scope**. A
fragment may use anything declared by an earlier fragment. Order lives in
`tools/modules.mjs`.

| file | responsibility | owner |
| --- | --- | --- |
| `src/00-three.js` | CDN loader (top-level await) + error overlay | lead |
| `src/10-utils.js` | math helpers, `WORLD` map constants, `LANDMARK_SITES` | lead |
| `src/20-env.js` | `ENV` day/night dial, `PALETTE`, `registerEnv`, `registerUpdater` | lead |
| `src/30-sky.js` | gradient sky, stars, sun/moon/fill lights | lead |
| `src/40-terrain.js` | ground, plaza, city floor, Seine, quays, Pont d'Iéna | lead |
| `src/50-tower.js` | all ironwork, decks, pavilions, antenna, sparkles | lead |
| `src/60-city-blocks.js` | Paris urban fabric: street grid, roofs, trees, lit windows | **city-blocks** |
| `src/61-city-landmarks.js` | École Militaire, Trocadéro, Montparnasse, La Défense… | **city-landmarks** |
| `src/62-city-life.js` | boats, lamps, traffic, anything animated | **city-life** |
| `src/70-controls.js` | orbit camera | lead |
| `src/90-app.js` | renderer, scene assembly, frame loop, HUD | lead |

**Only edit the file you own.** If you need something from another file, ask the
lead instead of editing it.

## Fragment contract

- Plain JS, no `import`/`export`: fragments share one scope.
- Use `THREE` (from `00-three.js`), `clamp`/`mix`/`smoothCurve` (`10-utils.js`),
  `WORLD`/`LANDMARK_SITES` (`10-utils.js`).
- Add content from your `buildX(scene)` function; it is called once at startup.
- Night behaviour: `registerEnv((night) => { … })` — `night` eases 0→1.
- Animation: `registerUpdater((dt, elapsed) => { … })` — called every frame.
- Never create materials/geometries inside the update loop, never rely on
  wall-clock time, and keep the bundle dependency-free (no npm installs).
- Units are metres, Y up. The tower is at the origin.

## Map conventions

```
+X   Montparnasse side            -X   La Défense side
+Z   Champ de Mars (mall 100→740) -Z   Seine (z=-330) then Trocadéro
ground y=0    city floor y=WORLD.ringY (0.6)    water y=WORLD.waterY (1.2)
```

`LANDMARK_SITES` in `10-utils.js` lists the reserved spots and clearings so the
city fabric and the landmark meshes do not overlap:

```js
LANDMARK_SITES = {
  ecoleMilitaire: { x: 0,     z: 830,  clearing: 170 },
  trocadero:      { x: 0,     z: -640, clearing: 210 },
  montparnasse:   { x: 980,   z: -260, clearing: 90  },
  defense:        { x: -1280, z: -880, clearing: 200 },
}
```

## Team workflow (parallel agents)

1. Claim your task on the shared board, read this file and your fragment.
2. Keep your fragment syntactically valid at all times — **write the whole file**.
3. Build to your own output so you never race another agent:
   ```bash
   node tools/build.mjs --out ../.eif3-team/build-<your-name>.html
   node tools/shot.mjs ../.eif3-team/build-<your-name>.html ../.eif3-team/<your-name>-day.png
   node tools/shot.mjs ../.eif3-team/build-<your-name>.html ../.eif3-team/<your-name>-night.png --hash night
   ```
   If the build fails inside a file you do **not** own, wait a few seconds and
   retry (another agent is mid-write).
4. Inspect your screenshots (`read_image`), iterate, then complete the task and
   report: what you added, member/instance counts, and anything you could not do.

## Known traps (learned the hard way)

- **No coplanar surfaces.** Overlay planes are separated in Y (`plaza 0.25`,
  `paths 0.3`, `city floor 0.6`, `water 1.2`); decks are lifted 0.22 above the
  lattice ends and pavilions are sunk 0.5 into them. Coplanar faces flicker.
- **Decks must not receive the fine lattice shadow** — it aliases into a
  shimmering dapple (see `slab.receiveShadow = false` in the tower).
- Keep the tower's open gap between the 1st and 2nd floors: that is correct.
- The whole scene must stay smooth: batch repeated geometry with
  `InstancedMesh`, keep material count low, no per-frame allocation.
