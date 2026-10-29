# A 68″ Olympic recurve, as a model you can take apart

A **25″ machined ILF takedown riser** with medium ILF limbs — 68″ AMO, 8.75″
brace, 36 lb at 28″ — built as **59 named parts** that assemble into a bow and
come apart in the order they were built.

Open **`recurve.standalone.html`** (double-click; no server, no network, three.js
included). For development, serve the folder and open `recurve.html`.

```
node src/verify.js        # 30 geometry + mechanics checks, bare Node, no browser
node tools/bundle.mjs     # rebuild the portable single file
node tools/shot.mjs       # 24 offline captures into shots/
node tools/design.mjs --sweep   # re-run the limb design search
```

---

## 1. What this is, and what the last attempt got wrong

The previous bow in this repo (`../bowlab`) has a **524-line `physics.js`**
whose header derives compound-cam torque balance, and a bow assembled from
stacked slabs and prisms — a sight window approximated by a thin box, limb
pockets as cubes. It optimised the mechanism nobody asked for and skimped on
the object everybody did.

This one inverts that. The rule held throughout:

> **Geometry is authored. Physics is a readout.**

The mechanics module is the second-smallest file in the project. There is no
beam solver, no Newton iteration, no continuation, no cam, no cable, no
trajectory integration. A recurve has one limb bending and one string, and
that is exactly what is modelled — about 40 lines of actual mechanism.

## 2. The bow as built

| | |
|---|---|
| AMO length | **68.00 in** (1727 mm) |
| Brace height | **8.75 in** (222.3 mm) |
| Rated weight | **36.00 lb** (160 N) at 28 in AMO |
| Stored energy | **31.3 ft·lb** (42 J) |
| Limb tip travel | **5.72 in** — inward and back |
| String tension at full draw | **46.5 lb** |
| Force 10.5″→28″ | 3.2 lb → 36.0 lb, monotone |
| Area ratio of F–d curve | **0.595** (0.5 would be a straight line) |
| Laminate stiffness (fitted) | **7.55 Mpsi** — real glass/wood limbs sit near 5 |
| Arrow, 80 % efficiency | **199 fps** with a 285 gr arrow |
| Model mass | **5.98 lb** (2712 g) fully kitted |
| Triangles | 128,876 |

**Parts (59).** Riser body, 2 dovetail pockets, 2 tiller bolts, 2 walnut grip
plates, 4 grip screws, 6 threaded inserts, 2 limbs (with dovetail tenons,
string grooves and tip overlays), string + fittings (nocking point, silencers,
served end loops), arrow rest (plate / arm / magnet), cushion plunger
(body / lock nut / button), clicker (plate / blade), sight (block, rail,
extension bar, aperture ring, pin, level, 2 knobs), stabilisers (quick
disconnect, 30″ long rod, 4 weights and a damper, V-bar, 2 side rods with
2 weights and a damper each), and an arrow (shaft, nock, point, 3 vanes).

## 3. How the geometry is made

Two engines, reused everywhere. Nothing is a stack of boxes.

**The limb is defined by its CURVATURE, not by control points.** Everything
comes out of one loop that walks the centreline by arc length:

```
theta += kappa ds          (the tangent turns)
z     += sin(theta) ds
y     += cos(theta) ds
```

Arc length is preserved for free. The tip lands wherever it lands — it is
*measured*, not assumed — and the strain energy is the same integral over the
same samples. The limb mesh is a sweep of a variable-cross-section ring along
that line, with the string groove carved into the belly by *moving points in
the section*, not with a boolean.

**The riser is a stack of horizontal cross sections whose 2D shape is one
continuous function of height.** The sight window is where that function
retracts the archer-side face; the arrow shelf is the fillet where it comes
back; the grip waist is where it narrows laterally; the pocket shoulders are
where it widens again. All of it falls out of one table plus a smoothing pass.
No CSG, no boolean failures, and every fillet is a real machined radius.

End caps use **ear clipping**, not a centroid fan. A fan is only correct for a
convex section; the grip has finger scallops and the pocket has a dovetail
mortise, and a fan turned the grip into a starburst while still passing the
manifold check.

## 4. How the mechanics works

Prescribe the nock position. The limb must reach a shape that

1. keeps the string exactly as long as it was at brace, and
2. minimises stored strain energy.

(2) is not a heuristic. With the nock displacement prescribed, the work done by
the draw force is fixed, so the equilibrium shape *is* the one of least strain
energy among those satisfying (1). That is the principle of minimum potential
energy, and it is what a real limb obeys.

The limb has **two** bend modes — an inboard cantilever mode weighted by the
real moment arm over the real section stiffness, and an outboard mode
concentrated in the recurve. One mode is provably not enough: with the butt
angle pinned by the pocket, *every* single-mode change that moves the tip
backward also straightens the limb and therefore releases energy. A bow built
from one mode draws by getting weaker. The second mode lets the shape rotate
and shorten at the same time.

Solve the amplitude from (1) by bisection for each mix ratio, then sweep the
mix for (2). Both searches are one-dimensional on monotone or unimodal
quantities. They cannot fail to converge, and `verify.js` proves the string
length is conserved to **7×10⁻⁶ in** across the whole draw.

**Strain energy is measured from the MOULDED shape**, not from a straight
limb. A laminated limb comes out of the press already curved; at brace it is
bent away from that mould. Measuring against a straight limb gets the sign of
the draw force wrong — the model then thinks the shortest route to a longer
string is to unbend, and a bow that unbends when drawn gets weaker.

The **string is not two lines from the nock to the tips.** It is the taut cord
around the limbs, found as the convex hull of the two tips and the belly
surfaces. That one choice buys the entire recurve mechanism for free: at brace
the hull lies flat along the straight string groove, and as the bow is drawn
the groove rotates away and the contact point migrates outboard. `verify.js`
watches it walk from **86 % to 100 %** of limb length. Nobody scripts that.

## 5. What is honestly simplified

Stated here and in the code, not hidden:

* **Bracing preload is one fitted scalar.** The offset between the moulded and
  braced shapes is set from a target brace-to-full-draw force ratio, not from a
  press schedule. It is the reason the force at brace is 3.2 lb rather than 0.
* **Limb stiffness is one fitted scalar.** The *shape* of the force curve is
  pure geometry; only its scale is stiffness. It lands at 7.55 Mpsi, which is
  the right order for a glass/wood laminate, and `verify.js` fails if it leaves
  the 1.5–14 Mpsi band.
* **Arrow speed uses a fixed 80 % efficiency.** It is the one number in the
  whole model that is a rule of thumb rather than a mechanism, and it is
  labelled as such everywhere it appears.
* **Threads, knurling and carbon weave are not geometry.** A 5/16-24 insert is
  modelled as a flush cup with a chamfer and a recessed bore. Calipered form
  and function, not fillet farming.
* **Tiller is symmetric.** The bow is modelled with a positive 1/8″ tiller in
  the spec, but the two limbs are built from the same pose.
* **The drawn shape is a two-mode fit, not a finite-element solution.** It is
  constrained to satisfy the string exactly and selected by minimum energy, but
  it is not a distributed beam discretisation.

## 6. Layout

```
recurve.html                  dev page (ES modules)
recurve.standalone.html       single portable file, three.js inlined
src/param.js                  THE DESIGN TABLE -- every dimension lives here
src/mesh.js                   geometry kernel: sweep, slice-loft, revolve,
                              ear clipping, crease normals, volume, manifolds
src/limb.js                   curvature -> centreline -> mesh, and the energy
src/string.js                 taut-path convex hull, servings, loops, nocks
src/riser.js                  section function, dovetail pockets, grip, inserts
src/accessories.js            rest, plunger, clicker, sight, stabilisers, arrow
src/mech.js                   the draw solve and the force curve -- ALL of it
src/bow.js                    assembly, explode groups, draw redraw
src/togl.js                   the only file that knows three.js exists
src/main.js                   scene, cameras, labels, parts tree, HUD
src/verify.js                 30 checks, bare Node, no browser
tools/design.mjs              the limb design search
tools/bundle.mjs              makes the portable build
tools/shot.mjs                24 offline captures
tools/smoke.mjs               geometry kernel sanity
```

## 7. Controls

| | |
|---|---|
| drag / right-drag / wheel | orbit · pan · zoom |
| `E` | explode |
| `D` | draw |
| `L` | labels |
| `R` | reset |

Twelve camera presets cover the whole machine, including the sight window,
the grip, the dovetail pocket, the recurve tip and the string. **Hover any
part** to name it; click a part or a callout to isolate it. The exploded view
draws a ghost of the assembled bow behind the parts so it still reads as one
object, and the callouts are laid out like a technical drawing — pushed to one
side and de-collided, with leader lines.

## 8. Verification

```
$ node src/verify.js
1. every part is a solid
  ok    57 parts closed, outward-wound and finite
  ok    model has real density   120,064 triangles
2. the bow measures what it claims
  ok    AMO bow length            67.998 in (spec 68)
  ok    brace height              8.750 in (spec 8.75)
  ok    the recurve tip hooks forward of the string line
  ok    string rests in the string groove at brace    contact from 86.8 %
3. the dovetail actually fits its mortise
  ok    tenon is narrower than the mortise mouth      0.0050 in per side
  ok    and the mortise is a real dovetail            0.555 in -> 0.725 in
4. the mechanics
  ok    string length is conserved    max |dL| = 7.18e-6 in over 13 poses
  ok    rated draw weight             36.00 lb at 28.0 in AMO
  ok    the calibrated laminate stiffness is physically plausible   7.52 Mpsi
  ok    force-draw curve is the right SHAPE   area ratio 0.596
  ok    the string LIFTS OFF the groove as it is drawn   85.7 % -> 100 %
  ok    the limb tip travels inward and back
  ok    estimated arrow speed        199 fps
5. the drawn bow still looks like a bow
  ok    limb chord stays inside its arc length at 100 % draw
  ...
  30 passed, 0 failed
```

Every part must be a closed manifold (each edge shared by exactly two
triangles), outward-wound, finite, with positive volume — and every mesh
volume becomes a real part mass, which is a second, independent check that the
geometry is watertight.

Three bugs in this project were found by these checks rather than by eye: a
riser whose volume read 0.16 in³ instead of 34.4 because ear-clipped cap
indices were not remapped after de-duplicating the outline; a brace height
measured from the highest point of the riser instead of the grip throat; and a
grip that was a starburst. All three rendered perfectly convincingly.
