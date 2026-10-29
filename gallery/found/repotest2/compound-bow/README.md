# A modern compound bow — ontology, dimensions, references and a 3D model

A build project for a modern compound bow — the bow with the complex mechanics:
non-circular eccentrics, a synchronised cable train, modular draw length and let-off,
and a hard back wall. The ontology and the measured dimension table come first; the
Three.js model is authored from them and from the reference photographs.

```
node tools/validate.mjs          # 46 checks on the ontology and the dimension table
node tools/render-ontology.mjs   # regenerate ONTOLOGY.md from the JSON
```


Open **`mathews-standalone.html`** (double-click; no server, no network, three.js
included). For development, serve the folder and open `mathews.html`.

```
node tools/bundle.mjs          # rebuild the portable single file
node tools/shot.mjs            # 13 offline captures into shots/
node tools/verify-page.mjs     # load both pages headless, check for errors
node tools/validate.mjs        # 46 checks on the ontology and the dimension table
node tools/render-ontology.mjs # regenerate ONTOLOGY.md from the JSON
```

---

## The 3D model

`mathews.html` / `mathews-standalone.html` are a Three.js model of the LIFT 33, built
**only from the reference photographs in `refs/` and the ontology** — the skeletal
machined riser, the long split limbs, the rounded-triangle cams with their cut-outs,
string grooves and modules, the crossing cables and the accessory stack all come from
what the photos show. About **174 000 triangles**, one drawable scene.

What is modelled: riser body with sight window and lightening windows; limb pockets
and tiller bolts; two split limbs; two Crosscentric-style cams with string-groove
flanges, three cut-outs, a hub, an axle with hex heads, a SwitchWeight module, two
offset AVS discs and an adjustable draw stop with a hard-wall cap; the bowstring with
centre serving, nocking point, peep and silencers; two harness cables through a roller
guard and cable slide; a string stop; a drop-away rest; a scope sight; a long
stabilizer; the Engage grip; a nocked arrow; and an optional quiver.

### It draws

The draw control (or **space**) runs the mechanism: the cams turn through **210°**, the
limbs flex toward and past parallel, and the string leaves each cam on a *computed
tangent* — so it visually wraps and unwraps as the cams rotate. The two harness cables
stay anchored to the rotating cam faces and pass through the roller guard. The arrow
rides the string, the release appears past half draw, and on release the string snaps
back and the arrow flies. The HUD reads nock travel, draw force, cam rotation and
let-off from the ontology's normalised force-draw curve.

### How it is built

Two geometry engines, both in `src/geom.js`: **extruded plates** (riser outline and its
holes, cams, pockets, grip, modules) and **swept flat blades** (the limbs). The cam is a
polar rounded-triangle profile with three kidney cut-outs and a groove formed by two rim
flanges at ±z; the string rides that groove. Materials use a procedurally generated
studio environment map, so the anodised surfaces pick up real reflections.

### Controls

| | |
|---|---|
| drag / right-drag / wheel | orbit · pan · zoom |
| draw slider, `space` | draw and release |
| **Side / Whole bow / 3/4 / Top cam / Riser / Grip / Full draw / Front / Hero** | camera presets |
| **Callouts** | part labels, projected and de-collided |
| finish swatches | graphite · bronze · olive · camo |
| **Quiver** | bow-mounted quiver |

### What is honestly simplified

* **Proportions are authored to look right, not measured.** ATA, brace and cam rotation
  follow `refs/dimensions.json`; the riser outline, limb sweep and cam profile are shaped
  from the photographs, not digitised.
* **The eccentrics are constant-radius discs with the wrap in the groove.** The
  effective-radius change that produces let-off is implied by the cam rotation and the
  force-draw readout, not solved from a cam profile.
* **Limb flex is a pivot rotation**, not a distributed bend; the string is a tangent
  solve, not a full cable-wind model.
* **Camo, knurling and threads are textures or omissions**, not geometry.

### Model files

```
mathews.html               the page (dev copy, loads vendor + src)
mathews-standalone.html    one portable file, three.js inlined
src/geom.js                geometry kernel: plates, sweeps, tubes, profiles
src/materials.js           materials, finish presets, procedural studio env
src/bow.js                 the bow: riser, limbs, cams, string train, accessories
src/app.js                 scene, lights, cameras, UI, labels, draw animation
tools/bundle.mjs           makes the portable build
tools/shot.mjs             offline captures
tools/verify-page.mjs      headless load + error check
```

---

## What a compound bow actually is

A recurve stores energy by bending its limbs backwards. A compound does something
different: **cables pull the limb tips toward each other**, and the string runs over
non-circular eccentrics whose moment arm changes as they rotate. That single trick
buys both ends of the force-draw curve:

* early in the draw the eccentrics present a long lever arm, so the limbs are loaded
  hard while little string travel is spent — the curve peaks within the first third;
* near full draw the arm collapses, so the force falls away to **15–20 % of peak**
  (the let-off) and the archer holds almost nothing;
* a **draw stop** then hits the limb for a solid, repeatable wall at the anchor.

The stored energy is the *area under the force-draw curve*, which is why a compound
out-shoots a recurve of the same peak weight.

## The reference bow

**Mathews LIFT 33 (2024)** — a current flagship whose Crosscentric/SwitchWeight-X cam
system is exactly the "complex mechanics" this project is about, and whose numbers are
fully published.

| specification | value |
|---|---|
| Axle-to-axle | **33.0 in** |
| Brace height | **6.5 in** |
| Draw length | **26.0 – 31.5 in** (0.5 in modules) |
| Peak draw weight | **45 – 80 lb** (5 lb modules, 10 lb down on the limb bolt) |
| Let-off | **85 %** standard, 80 % optional |
| IBO speed | **343 fps** |
| Mass weight | **4.26 lb** |

### What makes its mechanics complex

* a **binary cam** pair: each cable is anchored to the *opposite* cam, so the two stay
  synchronised without a limb-anchored buss cable;
* **Advanced Vectoring System** discs mounted offset to each axle and anchored to the
  cable ends — they rotate non-concentrically and shift the force vector;
* **SwitchWeight modules** that reset draw length, let-off and peak weight in steps;
* split limbs in closed-end pockets, reaching beyond parallel at full draw.

## What is in this folder

```
ontology/
  compound-bow.ontology.json   the ontology: 59 classes, 18 relations, 13 materials,
                               66 part individuals, mechanics, states, build order
ONTOLOGY.md                    the same thing, readable (generated — do not hand-edit)
refs/
  dimensions.json              the design table: published specs, standards and
                               class-typical component sizes, each with provenance
  SOURCES.md                   spec sources and photo credits / licences
  commons_*.jpg / .JPG         9 reference photographs
tools/
  validate.mjs                 referential-integrity, mechanics and arithmetic checks
  render-ontology.mjs          renders ONTOLOGY.md from the JSON
mathews.html                  the Three.js model (dev copy)
mathews-standalone.html       the same, one portable file
src/                          geom, materials, bow, app (see The 3D model below)
shots/                        offline captures
```

## What the dimensions say

The dimension table separates four provenances so nothing is over-claimed:

| provenance | meaning | example |
|---|---|---|
| `published` | the maker's spec for this bow | ATA 33 in, brace 6.5 in, IBO 343 fps |
| `standard` | AMO / ATA / IBO definitions | AMO draw length = nock-to-pivot + 1.75 in |
| `classTypical` | typical of the class, **not** this bow | cam Ø ≈ 4 in, axle Ø ≈ 3/8 in |
| `derived` | computed from the others | power stroke 20.75 in at a 29 in draw |

Useful derived numbers the model will use directly:

* power stroke (nock travel) = draw length − 1.75 in − brace height;
  at a 29 in draw and 6.5 in brace that is **20.75 in**
* holding weight = peak × (1 − let-off): **10.5 lb** at 70 lb / 85 %
* minimum arrow mass = 5 gr per lb of peak: **350 gr** at 70 lb
* 26.0–31.5 in in 0.5 in steps = **12 draw-length positions**
* IBO sanity check: 350 gr at 343 fps = **91.4 ft·lb**; at 80 % efficiency that implies
  ~114 ft·lb stored, a stored/peak ratio of 1.63 — *above* the real-world 1.0–1.4 band,
  so the IBO figure must not be read as a guaranteed delivered speed.

## Reference photographs

Nine Wikimedia Commons photographs, chosen for specific jobs (all CC BY-SA — see
`refs/SOURCES.md`):

| file | what it documents |
|---|---|
| `commons_cam_forcedraw.jpg` | the key one: a cam at 0°, 45°, 90°, 135° and ~210°, annotated with lever arms and cable take-up |
| `commons_idler_stopper.jpg` | idler wheel, string stop and Y-cable split |
| `commons_mathews_trx38_g2.jpg` | a modern target Mathews nearly side-on: bridges, sight window, rest |
| `commons_worldcup_draw.jpg` | a compound archer at full draw |
| `commons_bow_full.jpg`, `commons_hoyt_double_cam.jpg`, `commons_pse_talja.jpg` | whole-bow silhouettes |
| `commons_cam_closeup.jpg`, `commons_wheel_cam.jpg` | cam / wheel detail |

## Verification

```
$ node tools/validate.mjs
1. referential integrity
  ok   every class parent exists
  ok   every individual class exists
  ok   every material reference resolves
  ...
4. every part belongs to a subsystem and a build phase
  ok   all individuals grouped into a subsystem
6. dimensions
  ok   ATA matches the reference bow
  ok   IBO arrow energy recomputes    91.42 ft.lb
  ok   stored/peak ratio flags itself as out of band
  ...
46 passed, 0 failed
```

The validator is the first, cheap instance of the project rule: **a number that cannot be
recomputed from its own definition is not yet known.** It already found four real gaps on
the first run — an undefined `LimbHalf` class, three relations pointing at non-classes,
two missing materials, and eleven parts not placed in any subsystem or build phase.

## Honest simplifications and open items

* **Component sizes are class-typical, not measured.** The bow-level numbers are published
  and exact; cam diameter, limb length, riser length and the axle diameter are typical of
  the class. They are flagged `classTypical` with a `confidence` and a plausible band, and
  the model phase must either measure them or replace them with CAD.
* **The force-draw curve is a class-typical normalised shape**, not a cam solve. Solving the
  effective-radius profile that reproduces a target curve is the next phase.
* **One bow is measured, several are referenced.** Bowtech (DeadLock) and Hoyt variants are
  named in the ontology's source list for comparison, but only the LIFT 33 is dimensionalised.
* **The reference photographs are different bows.** They inform shape and mechanism, not
  the LIFT 33's exact geometry.

## Next phases

1. **Mechanism solve** — from a target force-draw curve, solve the cam effective-radius
   profile, then integrate the binary cable kinematics so timing, let-off and nock travel
   fall out (and can be checked, as in `../recurve-bow`).
2. **Geometry** — author the parts from `refs/dimensions.json`; riser as horizontal
   cross-sections, limbs as swept curvature, cams as an authored radius profile, cables as
   a taut-path solve.
3. **Model and shots** — assemble, explode along the build order, and capture reference views.
