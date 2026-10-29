# BUILD.md — engineering plan for the v3 model

Companion to `PLAN.md` (which holds the evidence, the rules and the correction log). This file
is the *how*: architecture, algorithms, module contracts, milestones and gates.

Every factual input is cited to `research/notes/10`–`13`. Where a number is not attested it is
marked **INFERRED** and listed in §10.

---

## 0. What "very good" means here — measurable success criteria

"Good" is not a matter of taste in this project; three attempts already failed on numbers I
chose myself. So the target is defined by measurements that either pass or fail:

| # | Criterion | Threshold | Source |
|---|---|---|---|
| C1 | Outer envelope | 124.90 m × 330.00 m, **±0.05 m** | official table + dimensioned elevation |
| C2 | Base : height ratio | **0.379** (the drawing tradition draws 0.50–0.54 — reject it) | note 12 |
| C3 | Profile is **faceted**, not smooth-fitted | slope breaks every two panels, on the attested widths | note 12 §6; note 10 |
| C4 | Chord section area at XXVIII | **366 368 mm²**, ±2 % | note 10 §8, verified arithmetically below |
| C5 | Ironwork mass | inside **7 000–8 505 t** (three attested figures) | note 10 |
| C6 | Per-panel mass profile | Plate XXXI weight column, ±25 % per panel | note 10 §3.2 |
| C7 | **No member spans between the legs** below 115.73 m, except the 2 belts | assertion, 0 exceptions | Rule 1 |
| C8 | Per-zone projected metal fraction | `11-solidity` corrected table, per-zone tolerance | note 11 §C |
| C9 | Minimum stroke set reads at LOD 4 | symmetric concave wedge + 3 platform bars + arch void + summit block | note 12 §3 |
| C10 | Painted iron, not black metal | `metalness` ≤ 0.25 on all painted surfaces | note 11 (v2's biggest visual fault) |

**C7 and C8 are the two that fix the complaint.** C7 removes the phantom members; C8 fixes the
porosity. C3 fixes the shape.

Arithmetic check that anchors the whole schedule: 95 992 + 91 192 + 87 992 + 91 192 = **366 368**
— the four chord areas sum *exactly* to the stated leg total, so the section schedule is real and
internally consistent. (The other section totals do **not** yet reconcile monotonically — see
§10.4.)

---

## 1. Architecture and stack

**Decision (already taken in PLAN §10):** ES modules + importmap, vendored locally, served over
HTTP. That is what buys GTAO, SMAA, AgX and HDRI loading. Double-clicking `index.html` stops
working — accepted deliberately.

```
eiffel-tower-v3/
  index.html                  entry: importmap, canvas, UI shell
  vendor/three/               three r186 + the addons actually used, vendored
  src/
    spec/                     ← pure data, no three.js
    geom/                     ← pure geometry, three.js only for maths
    build/                    ← assembles spec+geom into meshes
    scene/                    ← lighting, views, post
    ui/                       ← layer toggles, dimensions, inspector
  verify/                     ← the harness: runs against a build, emits a report
  research/                   ← notes 10–13, plates, crops
```

Rules that keep it honest:

- **`spec/` contains no three.js.** It is a data layer that a test can read without a renderer.
- **`verify/` never imports from `scene/`.** It measures what was built, independently.
- Every builder returns `{ mesh|geometry, meta }` where `meta` carries the provenance tag of
  each number used, so the harness can attribute any deviation to an ATTESTED / DERIVED /
  INFERRED input.

---

## 2. The spec layer

Four data modules, each a plain exported structure. This is where every contested decision is
frozen in one place.

### `spec/constants.js`

```js
export const OFFICIAL = {
  height: 330.00, ironTop: 300.65,
  baseOuter: 124.906,        // drawing: 124,906; table: 124.90  → use 124.90
  baseInner: 74.238,         // drawing: 74,238; table: 74.24   → use 74.24
  pierWidth: 25.335,         // drawing, and DERIVED (124.90-74.24)/2 = 25.33
  supportDatumASL: 36.00, groundASL: 33.50,
  floors: { f1: 91.13, f2: 149.23, mid: 259.63, f3: 309.63 },   // ASL
  floorsAGL: { f1: 57.63, f2: 115.73, mid: 226.13, f3: 276.13 },
  deckOuter: { f1: 70.69, f2: 40.962, f3: 18.65 },
  mergedCaisson: { atF2: 31.70, atF3: 10.00 },
  massFrame: 7300, massTotal: 10100, pieces: 18038,
  developedArbaletrier: 256.822,
  chordBox: { outer: 0.877, inner: 0.800 },   // constant outer
  arch: { span: 74.238, rise: 39.0, radius: 37.165, centreAboveSpringing: 1.835,
          includedAngleDeg: 185.7, ribsPerFace: 2, chordBox: 0.600, chordGap: 2.72,
          ribDepth: 3.92, tympanum: 0.003 }
};
// Attested half-widths — the four anchors the profile MUST hit
export const ANCHORS = [
  { y: 0,      half: 62.45 },
  { y: 57.63,  half: 35.35 },
  { y: 115.73, half: 20.48 },
  { y: 276.13, half: 9.33  }
];
```

### `spec/panels.js` — the 29 panels

The drawing's per-panel chain is only partly read, so this module holds **what is read** plus a
**reconstruction** that is explicitly tagged:

```js
// READ from the 1/1000 elevation (LOW-CONF on individual glyphs; bands are certain)
export const PANEL_BANDS_READ = [
  { from: 1,  dims: [4.00, 14.00, 11.00, 10.20, 10.00, 6.30], subtotal: 58.10 },
  { from: 7,  dims: [9.69, 10.00, 10.00, 10.50, 10.50, 10.50], subtotal: null },  // group "10 panneaux" = 75.796
  { from: 13, dims: [9.066, 6.498, 8.133, 7.625, 7.350, 6.300, 6.370, 6.377, 6.55, 6.65, 6.66, 17.28],
    subtotals: [75.796, 12.28] }
];
```

**Reconstruction (INFERRED):** assemble a monotone 30-entry boundary list
`y[0..29]`, `y[0] = 0`, `y[29] = 300.65`, that (a) contains every READ panel height, (b) is
consistent with the band subtotals, (c) puts boundaries at the platform levels 57.63, 115.73,
226.13, 276.13, and (d) sums to the ironwork height. Where the read values conflict, the
subtotals win. **If it does not close, say so loudly rather than fudging a value.**

This module also owns the **facet schedule**: Eiffel's *"changements d'inclinaison… de deux en
deux panneaux"* → a slope break at every second panel boundary. ~14–15 facets, unevenly spaced,
because the panels are unevenly spaced. **That irregularity is the point** — a uniform pitch is
what made v2 read as a generic cone.

### `spec/sections.js` — the chord schedule

```js
// READ, note 10 §8. XXVIII verifies arithmetically to the stated leg total.
export const LEG_SECTIONS = {
  XXVIII: { a:{plate:800,t:18.5,area:95992}, b:{plate:800,t:17,area:91192},
            c:{plate:800,t:16,area:87992},   d:{plate:800,t:17,area:91192},
            legTotal:366368 },   // 95992+91192+87992+91192 = 366368  ✓
  XXIV:   { legTotal:316500 }
  // ... XVIII–XXIII (832–866 mm plates, 8–15 mm), I–XVII (open L/T then closed 500 mm)
};
export const TREILLIS_BARS = [ /* 28-row schedule, note 10 §8 */ ];
export const BELTS = {
  L1: { panel: 5, vertical: 7.00, true: 7.53, area: 316500, kgPerM: 2470, span: [38.28, 32.70] },
  L2: { panel: 11, vertical: 4.90, true: 5.03, doubleWall: true }
};
```

### `spec/targets.js` — the solidity targets

The corrected measured table (note 11 §C) **and** Eiffel's own void series where it exists, kept
as two separate arrays with a `preferred` flag — because they still disagree at the base (§10.2)
and averaging them would be dishonest.

---

## 3. Geometry modules — the algorithms

### 3.1 `geom/profile.js` — the faceted envelope

```
in:  ANCHORS (4 attested widths) + panel facet boundaries (from spec/panels)
out: { halfWidthAt(y), facets: [{y0, y1, w0, w1, slope}] }
```

Method: the two-exponential is used **only as a sampler** to evaluate the envelope at each facet
boundary; the *shape* is then the straight segments between those samples.

1. Fit the three attested exponential segments (decay constants 0.009876 / 0.009397 / 0.004902 —
   these reproduce the four anchors to 0.012 %).
2. Sample it at every facet boundary `y_i`.
3. Force the four anchors exactly (they are already hit by construction).
4. Return the polyline.

**Why this satisfies both constraints:** the anchors and the faceting are both honoured; the
exponential stops being the definition and becomes a sampling convenience. `halfWidthAt` is
evaluated *from the polyline*, never from the exponential — so nothing downstream can
accidentally reintroduce the smooth curve.

Gate: C1, C2, C3.

### 3.2 `geom/sweep.js` — the tapered compound sweep ⚠️ critical path

Nothing else can be built until this works, and `extrudePath` **cannot** do it (one cap
triangulation reused at every station — verified in the r186 source).

```
in:  stations: [{ p: Vector3, section: Section2D, roll?: number }]
out: BufferGeometry (indexed, with UVs and a group per material)
```

Algorithm:

1. **Tangents.** Central differences on the station positions; endpoints one-sided.
2. **Frames by parallel transport.** Start with a reference normal chosen *deliberately*, not by
   area — the r186 rule picks it from the first tangent only, so a degenerate first station
   mis-orients the entire member. Propagate by minimal rotation (project the previous normal
   onto the plane perpendicular to the new tangent, renormalise). Fall back to double-reflection
   if the projection degenerates on a near-180° turn.
3. **Section placement.** Section vertices are 2D; map to world as
   `p + x·normal + y·binormal` — matching three.js's own convention so `extrudePath` results and
   hand-rolled results are interchangeable.
4. **Ring stitching.** Consecutive rings (identical vertex counts) → quads → two triangles, with
   **consistent winding** throughout; do not rely on three's asymmetric branch (it can silently
   fill or invert holes).
5. **Caps.** Fan-triangulate the two end rings. Emit **our own UVs** — three's end-cap UVs come
   back in profile space and are wrong for a path sweep.
6. **Validation, in-module:** for every station, compute the closed-polygon area of the placed
   section and compare to `spec.sections`. Area error > 2 % → throw. This makes C4 a build-time
   assertion, not a report line.

`roll` exists because the chord box's *faces* must stay parallel to the tower's faces — the
profile is pre-rotated in 2D, and roll is applied about the tangent to keep a chosen section
axis aligned to a world axis.

Gate: C4.

### 3.3 `geom/section.js` — compound sections

Two levels of detail for the same member:

- **shell** — the outer 877 mm box, 4 faces, closed. This is what the silhouette needs. 8 verts.
- **compound** — the real assembly: 2 plates + 1 cover plate + 12 corner angles `100 × 100 × 12`,
  modelled as separate swept sub-shapes. For close range and the blueprint mode.

Both are produced from the same `spec/sections` entry, so they can never disagree about the outer
dimension. **The outer dimension is constant at 877 mm** (note 10) — so below L1 the sweep's
section scale is 1.0, and only the *plate thickness* changes, which the compound level shows and
the shell level ignores. Above L2 the section changes materially (500 mm faces), so the sweep
must interpolate between the L2 section and the L3 section across the shaft.

### 3.4 `geom/cellpanel.js` — φ-targeted lattice

```
in:  quad (4 corner nodes), cellSize, barWidth | targetPhi
out: bars: [{a, b, w, d}] + achievedPhi
```

Projected metal fraction for a bar grid on a panel `W × H` with bar width `w`:

```
φ = [ 2w·√(W²+H²) + 2w·(W+H) − 2w² ] / (W·H)
```

Solved for the target, this is the calibration from note 11: **0.180 m bars on a 3 m cell**
reproduces the measured 0.65–0.71 of the legs-above-arch zone. The inversion is the API —
you ask for a target fraction and get the bar width.

**The rule when it undershoots: halve the CELL, do not thicken the bars.** Thickening bars
raises φ but reads as heavy timber; halving the cell adds members, which is what the real
structure does. Encode that as the default behaviour, not a comment.

Bounds: bars are clamped to `[0.10, 2.0] m`; if the target is unreachable at the minimum cell
size, report it rather than exceeding the clamp.

### 3.5 `geom/loft.js` — decks, frieze, masque

Ruled surfaces between two closed polygons (outer deck edge → inner edge), thickened to a solid
by offsetting along the normal and stitching. Used for the three decks, the `masque` band, and
the frieze. The first-floor underside is **not** a lattice — it is a deep continuous riveted
girder band (note 10), so it is lofted solid, with the dentil arcade as a shallow relief.

### 3.6 `geom/solid.js` — gussets and plates

Extruded 2D shapes (`Shape` → `ExtrudeGeometry` — correct here, because a gusset genuinely *is*
a constant-thickness plate along a straight extrusion; `extrudePath` is not involved). Use
`ShapePath`, whose `toShapes()` takes **no arguments** in r186.

Gussets are the "solid where there should be wire" material. Place one at every node where a
treillis bar meets a chord, sized from the bar widths, as a triangle with a filleted corner.

---

## 4. Assembly — the build graph

Order matters because later stages consume earlier nodes. Each step returns nodes that the next
step reuses — no re-derivation.

```
1  ground plane / datums        ASL → AGL conversion happens ONCE, here
2  massifs (16 pyramids)        + sabots (1.80 sq × 0.915)
3  leg axes                     geom/profile → 4 leg centrelines (prismatic below L1)
4  leg chords                   THE 16 ARBALÉTRIERS — geom/sweep × compound/shell
5  leg treillis                 croix de Saint-André, 11 m pitch (panel schedule),
                                minus the two named members in panels 6–9
6  BELTS (exactly two)          panel 5 (7.53 m true) and panel 11 (4.90 / 5.03 double wall)
   ── ASSERTION: no other member may connect two different legs below 115.73 m ──
7  shaft                        sections I–XVII, following the schedule INCLUDING the
                                XII–XVII closed-caisson exception band
8  decks ×3                     lofted rings, outer edges exactly 70.69 / 40.962 / 18.65
9  arches ×4                    circular, 185.7° included, doubled ribs springing below
                                panel 3's transverse, spandrels to the L1 underside
10 campanile / lanterne         decagonal prism + cupola + the three solid 1.25 m summit panels
11 antenna + paratonnerre       300.65 → 330, 10.790 m rod, 9 rods total
12 elevators / stairs           inclined tracks in the legs; stair run in the shaft
13 gussets + rivet suggestion   last, because they depend on every node above
```

Step 6 is the one that fixes the user's complaint, so it is implemented as an **assertion, not a
convention**: the builder collects every member's two endpoint legs; any member touching two
different legs below 115.73 m that is not a belt throws.

---

## 5. Materials and colour

| Material | metalness | roughness | Note |
|---|---|---|---|
| Painted iron (all structural) | **0.22** | 0.62–0.72 | paint is a **dielectric**; 0.5–0.6 is what made v2 read as black metal |
| Stone (massifs) | 0.03 | 0.86 | |
| `masque` / fascias | 0.20 | 0.68 | same paint, darker instance tint |
| Glass (L1 floor) | 0.05 | 0.14 | clearcoat, `DoubleSide`, low opacity |
| Blueprint (mode only) | — | — | unlit, line-weight hierarchy, no metalness |

**Colour is per-instance, not per-material.** The official scheme is a vertical degrade —
*"volontairement dégradée du plus foncé au plus clair pour accentuer la ligne de fuite"* — so the
material colour stays neutral white and every instance carries its own tint from the sampled
swatches (base `#67482F` → mid `#775A3F` → top `#976C35`, marked DERIVED). Day/night then works
by multiplying the material colour, with no per-instance churn.

**Environment:** the sky gradient runs through `PMREMGenerator` (core, no addon) and becomes
`scene.environment`. Without it, metallic surfaces render black regardless of lighting — the
single biggest visual fault of the first attempt, and it cost me an hour to find.

---

## 6. LOD — the compression ladder as the priority order

This is the part the drawing research improved most: ten independent tutorials converged on an
order, and it is a better simplification priority than the one I would have chosen.

| LOD | Keep | Screen-space trigger |
|---|---|---|
| 0 | axis, symmetry, **the three platform bars**, the concave faceted envelope | always |
| 1 | + arch void, summit block | always |
| 2 | + girders and floor lines, the belts | always |
| 3 | + one repeating lattice cell per zone (never member-by-member) | member width > 16 px |
| 4 | + per-level motif changes, gussets | 6–16 px |
| 5 | + full cell density and tone | < 6 px → drop to a solid web volume |

Two things this encodes that I would have got wrong:

- **The platform bars outrank the envelope.** In 8 of 10 tutorials the three bars are drawn
  first; in two, three rectangles alone seed the whole drawing. They must never be the thing
  that degrades.
- **Lattice is a tone problem, not a geometry problem.** At distance the correct rendering of the
  lattice is a *solid web volume* whose opacity equals the measured metal fraction — and note 11
  measured that shortcut as *true* in the upper shaft (0.74–0.80 opaque). It is not a cheat there.

Mechanically: `BatchedMesh` (core in r186) for height-banded section variants, distinct
(geometry, material) pairs kept under ~30, and **three baked LOD sets** built once at load and
switched on measured screen-space member width.

---

## 7. Rendering and views

**Four modes**, one shared scene:

- **Studio** — neutral technical lighting; GTAO on for member separation; the default for
  measurement and screenshots. This is what makes a lattice legible: without ambient occlusion
  the near and far faces take the same value and the structure flattens.
- **Daylight** — sun + sky, as built. Shadow map 4096², tight frustum; only heavy members cast
  (sub-metre casters alias into long streaks across the plaza otherwise).
- **Illuminated** — the real night scheme: uplights, platform practicals, emissive ramp, and the
  twinkling bulbs as a GPU point cloud (one draw call).
- **Blueprint** — the mode the illustration research licenses, and now specifiable:

  - line weights from Borson's five tiers, governed by *"everything is related to the distance
    between adjacent surfaces"*: Profile **0.53** · Heavy **0.4** · Medium **0.3** · Light
    **0.15** · Hatching **0.09**
  - **heaviest on the profile and platform bars**, lightest on lattice and hatch — the same
    ordering as the compression ladder, arrived at independently
  - the **arch as poché** — figure-ground, so the void reads as an object in its own right
  - steel drawn as **double parallel lines** (ANSI Y14.2M)
  - a **construction-lines toggle** that walks rungs L0–L7 in order — a "tutorial view"
  - camera **locked to vertical-verticals**

**Views:** orthographic front / side / plan to 1:1000 scale (matching the supplied elevation, so
an overlay is trivial), plus a **section-plane slider** that slices at height *h* and reports the
measured width, the panel index and the cumulative mass against the official figures.

---

## 8. The verification harness — the loop that makes this self-correcting

`verify/run.mjs` builds the model headlessly and emits `verify/report.md`. It **never imports
from `scene/`** and it measures the model the same way the real tower was measured.

| Check | Method | Threshold |
|---|---|---|
| Envelope | traverse all instances, transform bounding boxes | 124.90 × 330 ±0.05 m → **C1** |
| Base:height | from the envelope | 0.379 ±0.01 → **C2** |
| Faceting | assert `profile.facets.length ≥ 12` and no facet spans a platform | **C3** |
| Chord area | `sweep`'s own per-station area vs `spec/sections` | ±2 % → **C4** |
| Mass | Σ(volume × 7850 kg/m³) over all members, × a stated fill factor for built-up sections | inside 7 000–8 505 t → **C5** |
| Per-panel mass | Σ mass per panel band vs Plate XXXI | ±25 % per panel, panel 11 excluded → **C6** |
| **Between-leg members** | endpoint-leg-set test over every member below 115.73 m | must be exactly the 2 belts → **C7** |
| **Projected metal fraction** | render an **orthographic elevation**, run the *same* measurement tool as note 11 (`measure-opening-ratio.mjs`) on the render, compare per zone | per-zone tolerance → **C8** |
| Stroke-set read | render at LOD 4 and check the three platform bars survive as distinct minima in a horizontal scanline profile | **C9** |
| Material sanity | assert `metalness ≤ 0.25` on painted surfaces | **C10** |
| Pressure/facet agreement | envelope never departs the faceted polyline by > 2 % | Rule 4 |

**C8 is the important one.** It is the only check that closes the loop between what the model
*is* and what the building *looks like*, and it uses the same instrument on both sides — a
photograph of the real tower, and an orthographic render of the model. The first attempt at this
measurement produced a 314 m tower because the ground was fused into the mask; that is exactly
the class of error this harness exists to catch, and it only worked because the tool had a
scale-free sanity check bolted to it. Keep that check: **`calibrate-outline.mjs` compares shape
ratios and fails loudly** (the contaminated profile scored ×21.7).

---

## 9. Milestones and gates

Each milestone produces something *lookable* and has a pass/fail gate. No milestone starts
before the previous gate passes.

| M | Deliverable | Gate |
|---|---|---|
| **M0** | `spec/` complete, `verify/run.mjs` skeleton, three r186 vendored, importmap working | harness runs on a stub and reports "nothing built" |
| **M1** | `geom/profile.js` + orthographic elevation of the **envelope alone** | **C1, C2, C3** pass |
| **M2** | `geom/sweep.js` + one swept chord shown on its own | **C4** passes; renders clean at 10× zoom |
| **M3** | massifs + the 16 arbalétriers + treillis + **the two belts** | **C7 passes, 0 exceptions**; C1 still passes |
| **M4** | `geom/cellpanel.js` + shaft faces | **C8 first run** — per-zone fractions inside tolerance |
| **M5** | shaft per the section schedule incl. the XII–XVII exception band; campanile; antenna | C5, C6 pass |
| **M6** | decks, arches, frieze, `masque`, gussets | C9 passes |
| **M7** | the four lighting modes + blueprint, ortho views, section plane, layer toggles | C10 passes; section plane reports match the official figures |
| **M8** | final `verify/report.md` listing every deviation with its provenance tag | all ten criteria pass, or every failure is documented |

M3 is the milestone worth demoing: it is the correct lower tower, and it is the part that has
been wrong in every previous attempt.

---

## 10. Risks, unknowns, and what would change the plan

1. **The panel schedule is only partly read.** Three bands recovered, individual values
   LOW-CONF, full 29-value series not. **Mitigation:** the reconstruction in `spec/panels.js` is
   an explicit, tagged INFERRED fit constrained by the band subtotals; if it cannot close, the
   build fails loudly rather than approximating. **Fetch the higher-resolution Plate III/VII to
   finish it** — that is the single highest-value remaining fetch.
2. **Base solidity is unresolved (two targets disagree).** Eiffel's void series reportedly counts
   panels 1–5 as solid; the photograph measures 0.48 there; the dimensioned elevation draws the
   legs as latticed. Current evidence is *two-to-one* toward the latticed reading. **Mitigation:**
   `spec/targets.js` keeps both arrays and a `preferred` flag; M4 runs C8 against both and
   reports which fits. Do **not** average them.
3. **Section totals for I–XVII do not reconcile monotonically** (471–591 k mm² sits above
   210–254 k for the sections below it), so those are either different quantities or misread.
   **Mitigation:** use only XXVIII numerically (it verifies arithmetically), and use the rest as
   relative guidance with the ambiguity recorded.
4. **`123,907`** — a second base width at the support level, ~1 m narrower than at ground over
   2.5 m. Unexplained. **Mitigation:** build the prismatic leg from 124.90 / 74.24 and leave the
   datum unused; revisit if Plate VI (`Appuis des piles et des vérins`) is fetched.
5. **The intermediate floor at 226.13 m AGL** appears on the supplied elevation and nowhere else.
   **Mitigation:** model it (it is on a dimensioned drawing) but tag it SINGLE-SOURCE.
6. **Drawing provenance unresolved** — the supplied elevation is not the Commons file and its
   licence is not established. Used as measurement input only, so nothing is redistributed, but
   it should be labelled in the model's documentation.
7. **Post-processing cost.** GTAO + SMAA + bloom on a lattice of this density is the main
   performance risk. **Mitigation:** GTAO only in Studio mode; the LOD ladder means the full
   lattice is only built at close range; three baked LOD sets switch on measured screen-space
   width, so the frame cost is bounded by design rather than by hope.
8. **`extrudePath` is a trap and will tempt future edits.** It cannot taper, and its end-cap UVs
   are wrong. **Mitigation:** `geom/sweep.js` is the only sanctioned path-sweep, and the harness
   asserts section area per station, so a regression to `extrudePath` fails C4 immediately.

---

## 11. Non-goals — where I stop

Paris and the surroundings; rivets at 2.5 M scale (a bounded suggestion pass only); people,
birds, weather; game-like navigation; and **any fitting of a smooth curve to the profile**,
however good the fit — the building is faceted, and that is now a gate, not a preference.
