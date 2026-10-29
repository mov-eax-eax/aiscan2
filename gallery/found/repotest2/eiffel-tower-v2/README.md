# Tour Eiffel — research-driven procedural build (v2)

A **from-scratch** procedural Eiffel Tower for three.js, as plain HTML + JS.
No build step, no bundler, no external models, no textures: every one of the
**10,088 structural members** is generated from code at load time.

This is a separate project from `../eiffel-tower-3js` (v1). **v1 is untouched.**
v1 wraps a third-party MIT builder; **v2 contains no third-party geometry code** —
it is written from the measured numbers and profile law in `research/notes/`.

| | v1 (reference wrapper) | **v2 (this project)** |
|---|---|---|
| Members | 4,382 | **10,088** (up to 12,700 at Dense) |
| Profile | inherited control points | **three-segment exponential, max error 0.012 %** |
| Base measured | 124.90 m | **124.90 m, 0.000 m error** |
| Arch | inherited | **circular arc R = 37.17 m, swept onto the face plane** |
| Iron material | metalness 0.62 (reads dark) | **metalness 0.20 — paint is a dielectric** |
| Paint | single tone per bucket | **official three-tone degrade, baked per instance** |
| Night | emissive + uplights | **+ 23,714 GPU-twinkling bulbs** |
| Draw calls | 9 | 16 |

![panorama](research/shots/FINAL2-day.png)
![night](research/shots/v3-night.png)
![lattice detail](research/shots/FINAL2-base.png)

## Run it

**Just open `index.html`** — all scripts are classic `<script>` tags with local
files, so it works straight from disk. Or run `serve.cmd` for
`http://localhost:8080/`.

## What the research changed

Full reasoning in `DESIGN.md`. In short, seven findings drove the code:

1. **The profile is two exponentials, not one.** Fitting a single exponential per
   segment gives decay constants 0.009877 / 0.009393 / **0.004905** — the rate
   halves above platform 2. A power law is out by +52 %. Implemented as three
   exact segments through the four measured half-widths, so the generated
   envelope reproduces 62.45 / 35.35 / 20.48 / 9.33 m to **0.012 %**.
2. **Those widths are the *deck edges*, not the shaft.** The lattice sits ~6 %
   inside them, which is what makes each deck overhang and read as one of the
   three bars in the skyline.
3. **Painted iron is a dielectric.** Leaving `metalness` at 0.5–0.6 — as most
   examples do — makes the tower read as dark metal and collapse into a
   silhouette. Dropping to ~0.2 is the single biggest colour fix.
4. **A metallic surface with no environment map renders black.** The sky gradient
   doubles as a PMREM environment (`PMREMGenerator` is in the core build).
5. **The arch is decorative and circular**: radius 37.17 m centred 1.83 m up
   reproduces the published 74.24 m span and 39 m rise. The radius is not a
   coincidence — the legs' inner faces at 1.83 m are 37.17 m from the axis, so the
   arc springs exactly off both legs.
6. **Density must be zone-dependent.** Uniform spacing is the biggest "radio mast"
   tell. The legs carry dense lacing (the real pillars have 28 triangulated
   quadrilaterals each); the shaft is deliberately kept **open** so its faces read
   as large X-braced panels with visible voids. Over-bracing the shaft was tried
   and rejected — it fills the voids and the tower becomes a solid cone.
7. **Draw calls, not triangles, were the old constraint.** Measured at 20k struts:
   `InstancedMesh` 34 ms vs `TubeGeometry` 588 ms vs `mergeGeometries` 2,117 ms.
   Everything here is one `InstancedMesh` per material bucket.

## Controls

- **Time of day** — 0 = deep night, 0.35 = sunset, 1 = bright afternoon.
- **Lattice** — Light (1.0) / Balanced (1.4) / Dense (1.9) brace density.
- **Sparkle** — the twinkling bulbs.
- **Auto-spin**, **Shadows**.
- `Space` toggles the turntable, `H` hides the UI.

Deep links: `index.html?tod=0.02&view=arch&density=1.9&sparkle=0&shadows=0&spin=0`

## Layout

```
index.html                 entry point: markup, CSS, UI
src/eiffelGenesis.js       THE GENERATOR — all geometry, original work
src/main.js                scene, day/night art direction, orbit camera, UI
vendor/three.min.js        three.js r160 (last release with a classic build)
vendor/ATTRIBUTION.md      licences
research/notes/            the three research write-ups this is built from
research/verify/           the headless audit + CDP harness used to verify
research/shots/            rendered evidence
serve.cmd                  local HTTP server
DESIGN.md                  how each research finding maps onto the code
```

three.js is MIT, © three.js authors. `src/eiffelGenesis.js` and `src/main.js` are
original work, MIT.
