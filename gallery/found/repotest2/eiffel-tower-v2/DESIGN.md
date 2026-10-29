# DESIGN.md — every research finding, and where it lives in the code

This file exists so the reasoning is not lost. Each section names the finding, its
source in `research/notes/`, and the exact function or constant that implements it.
If you change the code, check here first.

---

## 1. The width profile is TWO exponentials

**Source:** `notes/01-real-tower-geometry.md` §3, §6 (and Weidman & Pinelis 2004).

Fitting a single exponential to each adjacent pair of measured half-widths yields
decay constants **0.009877 / 0.009393 / 0.004905** per metre: the decay rate
**halves** above platform 2. So no single exponential, and no parabola, fits this
tower. A power law is out by up to **+52 %**; a Catmull-Rom through the four
measured points overshoots and bulges, because it interpolates *position* rather
than *log-width*.

**Implemented:** `SEGMENTS` + `deckHalf()` in `src/eiffelGenesis.js`.

```js
var SEGMENTS = [
  { y0: 0.00,   y1: 57.63,  k: 0.009876, w0: 62.45 },
  { y0: 57.63,  y1: 115.73, k: 0.009397, w0: 35.35 },
  { y0: 115.73, y1: 276.13, k: 0.004902, w0: 20.48 }
];
```

The constants are chosen so the curve passes **exactly** through the four measured
half-widths, which is why the generator's own `profileCheck` reports a maximum
error of **0.012 %** (verified, see `research/verify/test-genesis.cjs`).

Above 276.13 m the exponential is an extrapolation and overshoots, so the summit is
tapered explicitly to the ironwork top at 300.65 m.

## 2. Those measured widths are the DECK EDGES, not the shaft

**Source:** `notes/01-real-tower-geometry.md` §1A.

This is the subtlety that cost the most time. 62.45 / 35.35 / 20.48 / 9.33 m are
the **platform deck outer edges** — the widest thing at each height, i.e. the three
crisp horizontal bars in the skyline. The lattice **shaft** sits inside them.

Getting this backwards is a trap in both directions:

- Make the shaft *equal* the measured widths and the decks stop overhanging. The
  three bars vanish and the tower becomes a smooth cone — the classic
  "pyramid / radio mast" failure. This was implemented, measured, and **rejected**
  during development.
- Make the shaft *far* narrower and the tower reads as a needle.

**Implemented:** `shaftHalf()` = `deckHalf(y) * (1 - 0.065 * smoothstep(y / L2))`,
so the shaft is ~6.5 % inside the deck edges at deck level and exactly equal to the
measured base at ground level (which is what makes the base 124.90 m).

## 3. Painted iron is a dielectric

**Source:** `notes/03-prior-art.md` (the best-matching reference used
`metalness` 0.24) and `notes/01-real-tower-geometry.md` §11 (colour chronology).

Painted iron shows the **paint film**, not the metal substrate. Paint is a
dielectric. Leaving `metalness` at 0.5–0.6 — which the reference implementation and
most tutorials do — sends almost all the response down the specular path, and the
tower reads as dark metal and collapses into a silhouette. Dropping to ~0.20 with
higher roughness makes it read as brown painted iron. **This was the single biggest
visual improvement in the project.**

**Implemented:** the `materials` block in `src/eiffelGenesis.js`
(`metalness` 0.16–0.30, `roughness` 0.60–0.74).

## 4. A metallic surface with no environment map renders black

**Source:** `notes/02-threejs-lattice-techniques.md` §9.3.1 — promoted there to
"the single most important visual fix".

Metals have essentially no diffuse response; with no environment to reflect they
render black no matter how many lights you add. `PMREMGenerator` is part of the
**core** three.js build, not an addon, so a sky gradient can be turned into an
environment map with no extra imports.

**Implemented:** `updateEnvironment()` in `src/main.js`, regenerated only when the
sky changes (a dirty flag), with the previous render target disposed.

## 5. The arch is decorative, and it is circular

**Source:** `notes/01-real-tower-geometry.md` §4; reconciled with
`notes/03-prior-art.md` §4, which found that two different curves are involved:
the structural **void** between the legs (span ~109.7 m, rise ~42.5 m) and the
**decorative Sauvestre grillwork arch** (span ~74.24 m, rise ~39 m). This project
models the decorative one.

A circle of radius **37.17 m centred 1.83 m up** reproduces the published span and
rise exactly. The radius is not a coincidence: the legs' inner faces at 1.83 m are
37.17 m from the axis, so the arc **springs exactly off both legs**.

There are **four** arches — one per *face* of the tower (±x and ±z), not one per
leg. (Placing them on the leg diagonals instead is a bug that was found and fixed
here; it puts them at the corners rather than on the faces.)

Because the face plane converges with height, the arc is **swept onto** the face
rather than being a flat plate, or its crown would protrude through the tower.

**Implemented:** `archFaces` + `onFace()` in `src/eiffelGenesis.js`.

## 6. Density must be zone-dependent, and the shaft must stay OPEN

**Source:** `notes/03-prior-art.md` §4(c), §6 (zone-dependent panel heights: legs
~4.4 m, mid-section giant X, upper 7.7 m) and §5 (uniform lattice = radio mast).

The legs are dense — the real pillars carry **28 triangulated quadrilaterals**
each, with X-bracing (*croix de Saint-André*) between two curved chords per face.

The shaft is the opposite. It must read as **large X-braced panels with visible
voids**. Adding a second and third lacing family there (as the legs have) was
tried and rejected: it fills the voids and the whole tower reads as a **solid
cone**, which is exactly the failure mode the research warns about.

**Implemented:** panel heights of `2.4 / density` (legs), `3.7 / density`
(57.63–115.73 m), `6.6 / density` (115.73–276.13 m), and only a single mid rail
per shaft face — no sub-diagonals.

## 7. Instancing beats every alternative, by a lot

**Source:** `notes/02-threejs-lattice-techniques.md` §1, §3 — measured on this
machine at 20,000 struts:

| Technique | Build | RAM | Draw calls |
|---|---|---|---|
| `InstancedMesh` | **34 ms** | **1.2 MB** | 1 |
| `LineSegments2` | 24 ms | 0.5 MB | 1 |
| `TubeGeometry` | 588 ms | 7.0 MB | 20,000 |
| `mergeGeometries` | 2,117 ms | 7.9 MB | 1 |

`mergeGeometries` is **strictly worse** than instancing: same draw calls, 6.5× the
RAM, 62× the build time. `mergeVertices` retains **100 %** of vertices on a strut
soup while costing 0.127 ms/strut, so it must not be called to "optimise".
Also: `alignObjectToSegment` **does not exist** in three.js — it is a community
idiom. The real primitives are `Quaternion.setFromUnitVectors` (which **assumes
normalised inputs**; an un-normalised direction silently shears the beam) plus
`Matrix4.compose`.

**Implemented:** one `InstancedMesh` per material bucket; the segment matrix helper
normalises the direction before `setFromUnitVectors`. 10,088 members → **16 draw
calls**, ~70 k triangles drawn, ~60 ms to build.

## 8. Shadows and LOD

**Source:** `notes/02-threejs-lattice-techniques.md` §9.5.

Sub-metre struts alias badly in a shadow map: 2048² over a ~700 m frustum is
~0.34 m/texel, so a 0.3 m member smears into a long hard streak across the plaza.
The fix is three-part: a denser map, a tighter frustum, and letting only the heavy
and medium chords cast. Beams should **not** receive shadows (sub-pixel casters
self-shadow into acne). Fine lacework is dropped by `THREE.LOD` beyond 620 m,
because at that distance it is sub-pixel and costs more than it shows.

**Implemented:** `sun.shadow` settings in `src/main.js`; `castShadow` /
`receiveShadow` and the `THREE.LOD` wrappers in `src/eiffelGenesis.js`.

## 9. Colour: the official three-tone degrade

**Source:** `notes/01-real-tower-geometry.md` §11; `notes/03-prior-art.md` delta.

The scheme is a deliberate vertical degrade, darkest at the base and lightest at
the top, and the official rationale is itself a silhouette argument — it exists
*"pour accentuer la ligne de fuite"* (to accentuate the taper).

**Caveat, carried forward honestly:** there is **no published RAL/Pantone/hex** —
the official wording is that the colour was blended for the tower alone. The
swatches used here (`0x67482F` → `0x775A3F` → `0x976C35`) are **derived** by
sampling SETE artwork, and are marked as derived in the research notes.

**Implemented:** `PAINT` + `paintAt()`, baked into each instance's `instanceColor`
so it costs nothing to animate. Platform slabs get the same treatment — they are
instanced boxes and would otherwise render pure white, since the materials are
deliberately neutral white and simply multiply the per-instance colour.

## 10. What is deliberately NOT modelled

- **Rivets.** The real tower has 2.5 million; this has 48 suggested ones at the
  deck nodes. The research recommends not modelling them.
- **The four legs merging into one shaft above platform 2.** `notes/03-prior-art.md`
  §4(c) flags this as a hard geometric constraint, and it is worth recording why
  the concern does not apply here: the legs already converge to a 9 m section by
  276 m, and the four faces are tied together continuously by gallery ties at
  every level, so the upper body is a single braced box rather than four separate
  towers. Verified visually in `research/shots/v3-level1.png`.
- **The "A" shape.** Popular legend only; the research found no documentary basis.

---

## Verification performed

| Check | Result |
|---|---|
| Envelope vs official dimensions | **124.90 × 330.02 × 124.90 m** — 0.000 m error on width and depth |
| Profile vs the four measured widths | max error **0.012 %** |
| Member / instance count | 10,088 members, 10,180 instances, 11 instanced meshes |
| Geometry audit | non-finite members **0**, too-short members **0** |
| Console errors / uncaught exceptions | **0 / 0** (Chrome DevTools Protocol) |
| WebGL context | webgl2, `glError` 0 |
| Draw calls / triangles drawn | 16 / ~70 k |

Harnesses: `research/verify/test-genesis.cjs` (headless geometry audit) and
`research/verify/cdp-verify.mjs` (live page: console errors, exceptions, GL state).
