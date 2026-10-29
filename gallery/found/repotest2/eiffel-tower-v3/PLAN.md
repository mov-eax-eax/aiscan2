# v3 — build plan for sign-off

**Status: PROVISIONAL.** Open items flagged inline. Nothing should be coded until you've marked
this up.

**Correction log:** `2026-09-10` — four rounds folded in (§11). Two failed measurements and
several unattested figures were caught and retired. Superseded values are recorded, not deleted.

> ### A dimensioned elevation has arrived — and it changes three things
>
> The user supplied a **1/1000 dimensioned elevation** (1176 × 1706; better than the 822 × 773
> Commons copy of the same idea). Analysed in `research/notes/13-dimensioned-elevation.md`.
>
> 1. **The base is now triple-attested.** The drawing chains **25,335 + 74,238 + 25,335 =
>    124,908** against a stated total of **124,906**, with the pier width drawn at **25,335 m** —
>    independently confirming the DERIVED 25.33 m. Build with confidence: **124.90 m outer /
>    74.24 m inner.**
> 2. **The panels are NOT a uniform 11.00 m.** The drawing's per-panel chain runs from roughly
>    **4 m to 14 m** (averaging ~10.3 m over 29 panels), in irregular bands with their own
>    subtotals. The ontology's "panel height 11.00 m" is at most a *typical* value. **Rule 4's
>    facet boundaries are therefore unevenly spaced** — the profile module takes the panel
>    schedule as input and must not assume a constant pitch.
> 3. **It is the dimension-overlay source**, better than the Commons SVG I had earmarked: a real
>    dimensioned elevation with panel boundaries marked.
>
> New: a **support datum at 36,00 m ASL** and an **intermediate floor at 259,63 m ASL
> (226,13 m above ground)** that no other source gives. Unresolved: a second base width
> **123,907** at the support level (~1 m narrower than at ground over 2.5 m of height), and the
> drawing's provenance — it is not the Commons file and its licence is not established.
>
> **On §9.2:** the drawing renders the legs with **X-bracing visible throughout**, the arch
> region as a large open void, and the 1st floor as a deep continuous mass. That sides with the
> photograph and **weakens the "panels 1–5 solid" reading** — it more likely means the panel
> *face* is closed by the decorative girders and the `masque`. Still not settled.

Research this rests on:

- `research/notes/10-element-ontology.md` (136 KB) — the taxonomy, from Eiffel's own 1900
  treatise (full OCR) and Gallica's native-resolution Plate XXXI (5927 × 8896 px)
- `research/notes/11-solidity-and-production.md` (108 KB) — measured solidity per zone, a dated
  correction section, three.js production constraints
- `research/notes/12-drawing-techniques.md` (104 KB) — how the tower is **drawn**, as a
  perceptual compression; 9 written tutorials + 10 step-sequences, plus a professional
  illustration investigation
- `research/notes/13-dimensioned-elevation.md` — the user-supplied **1/1000 dimensioned
  elevation**: the base chain, platform levels, and the per-panel dimension schedule

---

## 1. What v3 is

A **technical / architectural model** of the Eiffel Tower: tower only, no Paris, no walkthrough.
Measurably faithful to the documented structure, legible as an engineering object, and
**verifiable against the records** rather than against my opinion.

Default view: **orthographic technical elevation**. Interrogation: **layer toggles**.
Detail: **compound sections, no rivets**.

Non-goals: context/city, rivets at 2.5 M scale, people, weather, game navigation.

## 2. The four rules

### Rule 1 — no member spans between the legs except two belts

Eiffel: the four montants *"ne sont plus réunis que par les ceintures du 1ᵉʳ et du 2ᵉ étage"*,
and *"il est inutile d'entretoiser la Tour dans les divers plans horizontaux."*

Between the legs, ground → 115.73 m, there is **no structural member at all** apart from the two
belts. v2 drew gallery bands and face diagonals across that void — **that is the "wires."**

### Rule 2 — the chord is a *constant-section box* whose plate thickness tapers

**877 mm outer / 800 mm clear internal, held constant**; plate thickness steps 18.5 → 17 → 16 →
15 → 13.5 → 12.5 mm. *(`extrudePath` cannot taper — needs a hand-rolled sweep.)* The "90 cm"
section is **REFUTED**: 0.90 m is Eiffel's *wind-facing width*, never a section side.

### Rule 3 — each leg is a four-chord box truss with its own lacing, full height

Eiffel L2226–2229: *"la partie inférieure formée par quatre montants isolés, **dont chacun est
constitué par quatre arbalétriers réunis par des treillis**."* Each leg = 4 arbalétriers joined
by its own treillis; the four legs meet **only at the 1st and 2nd platforms**. My earlier "the
lower legs have no lattice" claim is retracted.

### Rule 4 — the profile is a FACETED POLYLINE, not a smooth curve ⚠️ rewritten

**This is the correction that explains the shape complaint.** I had been fitting smooth
exponentials to the envelope — a two-exponential to 0.012%, and before that an invented curve.
Both are the wrong *class* of curve.

Eiffel, 1900: *"La courbe extérieure est donnée par **des changements d'inclinaison… de deux en
deux panneaux**"* — the outer "curve" is a **piecewise-linear polyline whose slope breaks every
two panels**, mostly at the platforms. And *"La courbe des moments fléchissants est tracée dans
la planche XXXIII… à l'aide des polygones des forces"* — the profile **is a plotted
bending-moment diagram** of wind load. Weidman: *"He built it section by section, and did not
have an equation for its description."*

So: **do not fit a hyperbola, exponential, catenary or parabola.** Build the envelope as a
polyline with slope breaks every two panels, anchored on the attested half-widths
(62.45 / 35.35 / 20.48 / 9.33 m at 0 / 57.63 / 115.73 / 276.13 m). The smooth curve is a
consequence of the structure, not its definition — and *the faceting is visible*, which is why
v2's smooth cone read as a generic taper rather than as this building.

Independent confirmation, DERIVED from the drawing tradition: a straight chord from base corner
to apex is **1.46× too wide at platform 1** and **1.98× too wide at platform 2** (real
half-width 20.48 m vs chord 40.55 m). At the 2nd platform a naive triangle is essentially
**twice** the real width — which is why "draw a triangle" doesn't look like the tower until the
concavity is added. Maupassant's 1887 attack describes the same geometry from the other side:
*"a base that looks built to carry a colossal monument of Cyclops, but which just peters out
into a ridiculous thin shape."* Designer and detractor agree on the shape.

## 3. The documented geometry core

ATTESTED unless tagged.

| Quantity | Value | Note |
|---|---|---|
| Outer span, piers | **124.90 m** | official FR table — **build from this pair** |
| Inner clear gap, piers | **74.24 m** | official table; equals the arch span |
| Leg transverse width | **25.33 m** | DERIVED: (124.90 − 74.24)/2 |
| Chord box | **877 mm outer / 800 mm inner** | constant section |
| Corner angles · cover plate | 12 × **100 × 100 × 12** · **200 × 12** | per chord box |
| Chord count | **16** (4 per leg) ground → level 2 | above: **12, then 8** |
| Leg rake | 65°48′49″ face · 54°35′26″ diagonal | **rakes**, not plan angles |
| **Leg splay, face-on** | **24°11′11″** | DERIVED, cross-validated to ~1° |
| Plan shape | **square**, not rhombus | resolved |
| Legs merge | **2nd floor, 115.73 m** | joined system runs campanile → 2nd platform |
| Inner face below L1 | a **PLANE** — prismatic leg | constant inclination *and* face width |
| One great caisson | **31.70 m** at 114.73 m → **10.00 m** at 276.13 m | decks overhang 4.63 / 4.33 m per side |
| Deck sides | 70.69 / 40.96 / 18.65 m | official |
| Arches | **circles**, and slightly **more than a semicircle** | span 74 m primary; rise 39 m secondary-only; ≈**185.7°** included |
| Arch ribs | doubled depth; 2 × curved **600 mm** box chords **2.72 m apart**, depth ≈ **3.92 m** | 3 mm tympana |
| `masque` | 4 mm plate, 630 / 750 mm | purpose: to *hide* the girder depths |
| Campanile | decagonal prism 3.980 m, side 0.80 m, cupola 2.180 m | upper platform 300.81 m |
| Lightning rod | 10.790 m of 60 mm round iron, 3 × 1.50 m points, 9 rods | |
| Massifs | pyramid 7.50 m × 9.00 m base, 196.80 m³, **16** | sabot 1.80 m sq × 0.915 m |
| Ironwork mass | **7 300 t** (total 10 100 t) | Eiffel's own 7 341 / 8 505 |
| Pieces | **18 038** | a *bound*, not a target |
| Paint | 250 000 m² | live SETE's 2 500 000 m² is a 10× typo — REFUTED |

> **Retired:** the **101.40 m** chord-centre square. On no plate; the cited Plate III fig. 2
> **does not exist**; Eiffel's own rake implies **113.70 m** outer, not 124.90 m.

### 3b. The 29 panels

| Quantity | Value |
|---|---|
| Panel height | **11.00 m vertical / 12.31 m in the face plane** |
| Chord run between transverse axes | **13.50 m in three 4.50 m segments** |
| Joints (manholes) per panel | **3**, sized 0.50 × 0.345 m |
| Decorative arches spring | just below the horizontal transverse of **panel 3** |
| Level-1 girders occupy | **panel 5** (7.00 m vertical / 7.53 m true) |
| Panel 4 | counted as **« entièrement pleine »** — entirely solid |
| Summit greatest-reaction point | **three solid panels 1.25 m wide** interrupting the lattice |

**Per-panel mass is attested** (Plate XXXI): monotonic **≈35 000 kg at the top to 544 200 kg at
the base**; panels 1–2 = 544 200 kg each; panel 8 = 237 970 kg; panel 12 = 118 650 kg;
panel 29 = 153 350 kg. ⚠️ **Panel-11 row reads ≈10× its neighbours — probable misread, excluded.**

## 4. The compression ladder = the LOD priority order

The drawing corpus's ranked construction order. It is **not** the order I would have chosen, and
it is a better simplification priority than mine because ten independent tutorials converged on
it. Ranked by how early it is drawn and how strongly it is emphasised:

| Rung | Feature | Consensus |
|---|---|---|
| **L0** | vertical axis + bilateral symmetry | 7/10 stated, 10/10 implied, **zero exceptions** |
| **L1** | **the three platform bars** | 10/10; drawn 1st–3rd by 8 of them; three rectangles alone seed the drawing |
| **L2** | **the concave tapering envelope** | every tutorial starts with a straight triangle, then curves it |
| **L3** | the arch void | |
| **L4** | the doubling of the arch | |
| **L5** | summit block + antenna | |
| **L6** | girders / floor lines | |
| **L7** | **one repeating lattice CELL** | 10/10, always **last, never member-by-member** |
| **L8** | per-level motif change | |
| **L9** | density gradient | |
| **L10** | erase construction lines | |
| **L11** | scene | |
| **L12** | tone | |

**Minimum stroke set that reads as the Eiffel Tower:** symmetric concave wedge + three platform
bars + one arch void + a small summit block. Koechlin's original concept sentence is the
authoritative form of rungs L1–L2: *"a great pylon… four lattice girders standing apart at the
base and coming together at the top."*

Two consequences for the model: **lattice detail is a screen-space/tone problem, not a geometry
problem** (rung L7 plus rung L9 — which independently corroborates the measured
projected-metal-fraction approach), and **the platform bars rank above the envelope**, so they
must never be allowed to read weakly.

## 5. Element classes → production route

| # | Class | Production route |
|---|---|---|
| **R1** | Masonry massifs, sabots, piers | Lofted solid blocks; 16 pyramids |
| **R2** | **Arbalétriers** — 16 corner chords, ground → 2nd floor | Hand-rolled tapered sweep of a closed box: 877 mm outer constant, plate thickness from the schedule |
| **R3** | Shaft above 2nd floor — one great caisson | Sections I–XVII: **open L and T (I–XI)**, then **closed 500 mm caissons (XII–XVII)** — a *process centred on section XI*, not a switch at panel 11 |
| **R4** | **Ceintures** — exactly two between-leg members | 7.53 m belt at panel 5; 4.90 m double-wall at panel 11 |
| **R5** | Decorative arches | **Circular, >semicircular (≈185.7°)**, 2 per face, doubled depth, springing below panel 3's transverse |
| **R6** | Leg internal lacing | `croix de Saint-André` at 11.00 m pitch, full height; omit two members in panels 6–9 |
| **R7** | Platforms, frieze, `masque` | Lofted thickened shells; L1 girders in panel 5; continuous fascia, **not** lattice |
| **R8** | Campanile, lanterne, summit, antenna | Decagonal prism + cupola; three solid 1.25 m summit panels; match the photo you copy |
| **R9** | Face panels | Cell-grid bar panels, targeted per panel |

**R9 has two targets that disagree at the base.** Eiffel's own `rapport des vides au plein` runs
**0.61–0.63 (most open) to 0.73–0.76**, with **panels 1–5, 11 and 29 carrying no ratio because
he counts them as solid**; the most open panels are **10–18**. The photo measurement instead puts
the minimum at the **arch void**:

| Zone | z | Metal fraction |
|---|---|---|
| Legs below arch | 0.00–0.10 | 0.480 |
| Arch void | 0.10–0.19 | **0.346** ← minimum |
| 1st platform | 0.19–0.24 | 0.643 |
| Legs above arch | 0.24–0.38 | **0.754** |
| 2nd platform | 0.38–0.43 | 0.453 |
| Lower shaft | 0.43–0.55 | 0.668 |
| Lower-mid shaft | 0.55–0.70 | **0.804** |
| Upper-mid shaft | 0.70–0.85 | 0.715 |
| Upper shaft | 0.85–0.95 | 0.738 |
| Campanile | 0.95–1.00 | 0.235 |

⚠️ Different quantities; **do not average them** — see §7.2.

**Build consequence: the legs need heavy compound chords *plus substantial face filling*** —
about half opaque in frontal projection, not heavy chords with air between them. Where a cell
grid undershoots, **halve the cell, not thicken the bars.**

**Instancing:** `InstancedMesh` is insufficient (tapering chords, per-section caissons). Use
**`BatchedMesh`** (core in r186), distinct (geometry, material) pairs under ~30, with three baked
LOD sets switched on **screen-space member width**: >16 px real bars, 6–16 px solid web volume,
<6 px proxy.

## 6. Three.js constraints

Verified against the r186 **source**:

- `extrudePath` maps profile **+x → Frenet normal, +y → binormal** — in-plane rotation is
  controllable *only* by pre-rotating the 2D profile.
- **`extrudePath` cannot taper** → R2 and R3 need a hand-rolled sweep. Highest-value work.
- The initial Frenet normal comes from the *first* tangent only.
- Two source defects: end-cap UVs are in **profile space**; the winding branch is asymmetric so
  holes can silently fill or invert — use `ShapePath` (`toShapes()` takes **no arguments** in r186).
- `ParametricGeometry` is an addon. `ParametricGeometries` is gone.

## 7. Module layout

```
index.html                 entry, UI, importmap
src/spec/constants.js      §3 — single source of truth, each value tagged
src/spec/sections.js       Eiffel's section schedules (XXIV–XXVIII, XVIII–XXIII, I–XVII)
src/spec/panels.js         the 29 panels, pitch, belts, mass + solidity targets
src/geom/profile.js        the FACETED polyline — slope breaks every two panels  ← Rule 4
src/geom/sweep.js          hand-rolled tapered sweep                            ← critical path
src/geom/loft.js           ruled/thickened shells for decks and friezes
src/geom/cellpanel.js      cell-grid bar panels with a target solidity φ
src/build/massifs.js  legs.js  belts.js  arches.js  platforms.js  summit.js
src/scene/lighting.js      Studio / Daylight / Illuminated / Blueprint
src/scene/views.js         orthographic elevations, plan, section plane
src/ui/                    layer toggles, dimension overlay, readouts
verify/measure-ratio.mjs   the harness (§9)
```

## 8. The blueprint mode, now specifiable

The illustration investigation gives a real basis for the default view:

- **Line-weight hierarchy**, Borson's five tiers, governed by *"everything is related to the
  distance between adjacent surfaces"*: Profile **0.53** · Heavy **0.4** · Medium **0.3** ·
  Light **0.15** · Hatching **0.09**.
- **Heaviest on the profile and the platform bars** (rungs L1–L2), lightest for lattice and
  hatch. This is the drawing tradition's answer to "what reads", and it matches the ladder.
- The **arch is treated as poché** — figure-ground for the void, *"to emphasize their existence
  as defined objects in their own right."*
- **Steel is drawn as double parallel lines** (ANSI Y14.2M) rather than single strokes.
- **Moiré warning** for near-parallel cross layers — relevant to the lattice at distance.
- **Camera locked to vertical-verticals** by default — the standing convention for tall
  buildings.
- A **construction-lines toggle** gives a "tutorial view" that walks rungs L0–L7 in order.
- Harold Speed, 1913, as the written statement of the whole approach: *"Finish in art has no
  connection with the amount of detail."*

**Honest negatives:** no written rule was found for selective member omission, coursing,
tapering line weight with height, or far-face ghosting; Ching's *Architectural Graphics* is
access-restricted (HTTP 401) and is **not** quoted anywhere; the "0.7 / 0.5 / 0.35 / 0.25 /
0.18 mm pen set" as a stated hierarchy is **NOT FOUND**.

## 9. Open items — do not code past these

1. ~~The 2.84 m inner-face conflict~~ — **CLOSED: a false problem.** Eiffel's 15.00 m is the
   leg's *cardinal-direction* extent, not a perpendicular face width; unlike quantities. Build
   the leg **prismatic** from **124.90 / 74.24 m**.
2. **The two solidity targets disagree at the base** — Eiffel says panels 1–5 are solid and the
   most open are 10–18; the photograph's minimum is the arch void. Plausibly reconcilable
   (panel *face* closed vs legs *isolated*) but **unconfirmed**. Resolve before tuning R9.
3. **Panel-11 mass row** — probable misread (≈10× neighbours); excluded from the harness.
4. **Eiffel's `0.07` / `0.13` void ratios were retracted** as Internet-Archive OCR artefacts;
   correct value 0.484/0.72 = **0.67**.
5. **The "closed below, open above" rule has an exception band** — I–XI open, XII–XVII closed.
   R3 follows the schedule, not the summary.
6. **Arch rise 39 m is Wikipedia-only**; only the 74 m span is primary.
7. **"Traverses every 50 m" is disputed** — ties exist only at L1 and L2.
8. **Full 29-panel void series not yet extracted.**
9. **`porte-à-faux` claim UNVERIFIED** — the 27 occurrences in the 1900 book are all
   erection-method language, not silhouette language. Do not cite it.

> **Do not import tutorial proportions.** Measured: wikiHow puts the platforms at 25 % / 50 %
> and 33 % / 67 % against attested **17.46 % / 35.07 %**, and fr.wikihow reproduces the same
> wrong fractions — "the waist is at the geometric midpoint" is a tradition-level error (real
> waist 35 %, not 50 %). Two tutorial *drawings* measured objectively are **1.33× and 1.42× too
> wide** at the base (0.504 and 0.538 vs the real 124.90/330 = **0.379**) — the hobby tradition
> draws the tower squat. wikiHow's stated **"45°"** leg splay is ~2× the real face-on
> **24°11′11″**. **Use the tutorials for stroke ORDER only, never for proportions.**

## 10. Verification harness

Three attempts failed for one reason: I decided shape and solidity myself and presented the
result as fact. An invented leg curve, a "structural void" traced to a stranger's three.js file,
and a **314 m tower** all nearly went in. Each was caught only by an independent constraint.

| Check | Against | Fails if |
|---|---|---|
| Bounding envelope | 124.90 × 330 m attested | off by > 0.05 m |
| **Profile is faceted** | slope breaks every two panels, on the attested widths | a smooth curve is fitted instead |
| Chord section area | 366 368 mm² at XXVIII | off by > 2% |
| Mass estimate | 7 300 t (range 7 000–8 505) | outside range |
| **Per-panel mass profile** | Plate XXXI weight column | any panel off > 25 % (panel 11 excluded) |
| Member count | 18 038 as a **bound** | outside 12k–25k |
| **Between-leg members** | exactly 2 belts below 115.73 m | any extra member present |
| Per-zone metal fraction | §5 table | outside tolerance |
| **Silhouette shape ratio** | attested envelope, scale-free | ratio error > 1.5× |
| **Base:height ratio** | 0.379 | drawn squat, as the tutorials do |

Scale-free shape test is the alarm that was missing: the contaminated profile scored a
geometric-mean ratio error of **3.897**, worst **×21.7**. It now fails loudly.

## 11. Order of work

1. **`geom/profile.js` + `geom/sweep.js`** — the faceted polyline and the tapered compound
   sweep. Critical path. Validate the sweep against the section schedule; validate the profile
   against the attested widths *and* that it is faceted.
2. **Fix the concavity before anything else** — rungs L0–L2. The ladder is explicit that a
   straight triangle is 1.98× too wide at platform 2.
3. **R1 + R2 + R4** — massifs, the 16 arbalétriers, the two belts. The correct lower tower, and
   the part v2 got most wrong.
4. **Harness first run** — envelope, faceting, section areas, mass, per-panel profile,
   two-belt rule, base:height.
5. **R6 + R9** — leg lacing and cell panels, once §9.2 is resolved.
6. **R3** — the shaft, following the real schedule including the exception band.
7. **R5 + R7 + R8** — arches, platforms and frieze, campanile.
8. **Presentation** — four lighting modes, orthographic elevations and plan, section plane,
   layer toggles, dimension overlay, **blueprint mode per §8**.
9. **Final harness run** and a validation report listing every deviation.

## 12. What I need from you

1. **Approve or amend Rules 1–4** — Rule 4 is the changed one, and it is the one that addresses
   the shape complaint. The profile becomes a **faceted polyline** (slope breaks every two
   panels), not a fitted exponential.
2. **Confirm the base solidity target** (§9.2) — the one thing I cannot resolve from the
   documents I hold. Fetch Plate III / VII first, or build to one of the two?
3. **Confirm the reader** — plan and all three research documents, served for mark-up.

## 13. Correction log

**(a) Solidity measurements re-run.** First pass implied a **314 m** tower; the base is 124.90 m
and the diagonal 176.6 m, so I raised it as impossible. Mechanism, by measurement: ground and
structure **overlap in luminance**; the per-row border-median background **collapsed onto the
ground**; dilating 12 px before labelling **fused ground into the pier feet**. Fixed with
hysteresis thresholding, validated by **threshold stability** not by eye. Corrected: legs below
arch 0.176 → **0.480**; 1st platform 0.362 → **0.643**; lower shaft 0.459 → **0.668**; shaft
zones held within ±0.07. **The inversion survives but weakens — 0.480 is not "mostly open."**
**Withdrawn:** the photo-derived *"measured silhouette curve."*

**(b) Ontology figures corrected.** `0.07` / `0.13` void ratios were OCR artefacts (real
0.484/0.72 = **0.67**); the **101.40 m** square is on no plate and the drawing cited for it does
not exist; **"12 à 9"** → **12 then 8**; the **"70-tonne"** girders are per face (~280 t total);
SETE's live **2 500 000 m²** paint figure is a 10× typo.

**(c) Drawing research corrected my own brief.** The **toureiffel.paris** drawing page I called
"the highest-value source" is **not a tutorial** — it is a directory of five *video* tutorials
plus colouring pages, with no written construction order or proportions, and none of the
expected vocabulary. Excluded, along with `easydrawings.net` (image-only, no step text).
**Zola is not a signatory** of the 1887 petition despite fr.wikipedia; the **Maupassant**
"peters out" attribution is contested; **`porte-à-faux`** as a silhouette statement is
**UNVERIFIED**.
