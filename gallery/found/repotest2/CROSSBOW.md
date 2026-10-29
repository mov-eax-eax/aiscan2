# Compound Match Crossbow — a mechanically honest Three.js model

An interactive, physically consistent compound crossbow. Every number in the
HUD comes from a solver that enforces the real constraints of a compound cam
system, and the energy bookkeeping closes to **1e-16 relative** — i.e. it is
machine-precision consistent, not "close enough".

Open **`crossbow.standalone.html`** (double-click; no server, no network — it is
fully self-contained, three.js included). For development, serve the folder and
open `crossbow.html`.

```
node tools/serve.mjs          # or any static server
node src/verify.js            # mechanism report from Node, no browser
node tools/verify-page.mjs    # 23 functional checks against the live page
node tools/bundle.mjs         # rebuild the standalone file
```

---

## 1. The machine as built

| | |
|---|---|
| Peak draw weight | **190.2 lbf** (845.8 N) at 81 % of the stroke |
| Holding weight | **126.2 lbf** — **33.7 % let-off** |
| Power stroke | **11.02 in** (280 mm) |
| Draw-force curve | rises monotonically to the peak, then lets off |
| Stored energy | **95.9 J** (70.8 ft-lb) |
| Energy identity | W 95.93 J vs E_limb 95.93 J — residual **1.4e-14 J (0.0000000000 %)** |
| Limb swing | **−7.0°** at full draw; limb tips travel **5.4 cm** |
| Cam rotation | **109°** over the stroke |
| String track radius | **123 mm → 56 mm** (this taper *is* the let-off) |
| Cable track radius | 13 mm |
| Tension ratio Tc/Ts | 1.73 – 12.0 |
| Bolt | 40.0 g (617 gr), 508 mm, 167.6 Hz spine |
| Muzzle velocity | **54.07 m/s = 177.4 fps**, 58.5 J (43.1 ft-lb) |
| Efficiency | **60.9 %** (moving-mass ratio n = 0.641) |
| Limb tip speed | 0.28 × bolt speed |
| Velocity retained at 50 m | 97.8 % |
| Max solver residual | 7.3e-12 |

## 2. How the mechanism is solved

The nock is latched to the rail, so the drawn distance `s` is the input. Two
unknowns remain — `beta` (limb tip swing about its root) and `theta` (cam wind) —
and two constraints pin them down:

1. **String payout** — each bowstring half must equal its braced length plus
   whatever the string track has paid out: `half = half0 + rS(theta)·theta`
2. **Cable take-up** — the cam-to-cam cable must equal its braced length minus
   what the two cable tracks have wound in: `Lcable = cable0 − 2·rC(theta)·theta`

They are solved together by damped Newton on a **numerically differentiated**
Jacobian, continued along the stroke. All limb / cam / string / cable geometry
lives in one horizontal plane; the cam axles are vertical and the cams turn in
that plane, so the string leaves the cam below the axle and the cable above it.
Their tangents are antiparallel, which is exactly what makes the cam's own
balance `Ts·rS = Tc·rC` an identity rather than an approximation.

### Where the draw force comes from

The limb is a rotational spring about its root, so

```
E_limb(s) = ½·k·beta(s)²        F(s) = dE_limb/ds
```

`beta(s)` is the swing the cable constraint *actually produces*, so the **shape**
of the force curve is set by the cam geometry and only its **scale** by the limb
stiffness `k`. Nothing is fitted to a hand-drawn curve. The two features that
make a bow compound both fall out of the geometry:

* the string track radius tapering **down** toward full draw is what produces
  let-off — the cam has to turn further for each further inch of string;
* the ratio of the two track radii sets how far the limbs travel, and therefore
  how much of the stored energy is wasted accelerating the limbs.

### Where the tensions come from

Virtual work on the two ideal lines, so no moment arm is ever hand-derived:

```
Q_q = −Ts·dLs/dq − Tc·dLc/dq
limb balance:   k·beta = −Q_beta
cam bearing:    0      = −Q_theta    ⇒   Tc = −Ts·(dLs/dθ)/(dLc/dθ)
draw force:     F      = −Ts·dLs/ds
```

## 3. What is honestly simplified

These are stated in the UI and in the code, not hidden:

* the limb is a **lumped rotational spring** about its root rather than a
  distributed Euler–Bernoulli beam — the standard archery-simulation reduction;
* string and cable are **ideal, inextensible, massless lines**; all stretch is
  rolled into the limb spring;
* the cable runs **cam-to-cam straight** in the horizontal plane — no idler wheel
  and no split limbs;
* the bolt is an ideal projectile: quadratic drag with a **constant `Cd` of 0.55**
  on the shaft's frontal area. Real bolts also shed speed through vane drag,
  which a single coefficient cannot capture, so it is chosen to reproduce
  published velocity retention (~98 % over 50 m) rather than derived from first
  principles. Because the bolt is heavy and slim its drop is essentially
  ballistic — **4.2 m at 50 m** — which is the dominant effect at these speeds;
* the tension ratio `Tc/Ts` becomes numerically degenerate near the very ends of
  the cam wind, where the cam's tangent swings past its efficient sector. Those
  samples are **flagged** (`ratioDegenerate`) rather than silently reported, and
  the UI only ever shows the usable band (1.8 – 12).

## 4. Controls

| | |
|---|---|
| drag / right-drag / wheel | orbit · pan · zoom |
| `Space` | cock, then loose |
| `F` | fire |
| `↑` `↓` | scope elevation, ¼ MOA clicks |
| `←` `→` | crosswind, m/s |
| `C` | zero range (50 / 30 / 20 m) |
| `S` | slow motion (0.06×) |
| `T` | trajectory trace |
| `R` | reset |

Dragging on the canvas also draws the bow by hand. Ten camera presets cover the
whole machine, including cam, riser, trigger and string detail.

The shot itself is a real 3-D integration: quadratic drag, gravity and the
crosswind, with the sight elevation solved from that ballistics for the selected
zero. The trajectory trace and the flight readouts come from the same
integration, so what you watch *is* the model.

## 5. Layout

```
crossbow.html                 dev page (ES modules + import map)
crossbow.standalone.html      single portable file, three.js inlined
src/geom.js                   cam / limb / string / cable geometry, no dependencies
src/core.js                   the mechanism solver and exterior ballistics
src/crossbow.js               the 3-D machine, built from the solver's own numbers
src/main.js                   scene, cameras, interaction, HUD, shot logic
src/verify.js                 mechanism report + force-curve table (Node)
src/design.js                 the design search that chose the cam parameters
tools/bundle.mjs              makes the portable build
tools/verify-page.mjs         23 functional checks against the running page
tools/sheet.mjs, shotseq.mjs  offline multi-view captures
```

## 6. How the design was chosen

`src/design.js` re-runs the searches. The findings, which are not obvious:

**Cable track radius sets efficiency.** The moving limbs are the dominant loss,
and their travel scales with this one number:

| cable track r | limb tip travel | tip speed ÷ bolt | efficiency | fps |
|---|---|---|---|---|
| 6 mm | 2.7 cm | 0.14 | **71 %** | 197 |
| 13 mm *(shipped)* | 5.9 cm | 0.31 | 58 % | 178 |
| 24 mm | 10.8 cm | 0.57 | 37 % | 142 |
| 32 mm | 14.4 cm | 0.76 | 26 % | 121 |

**String-track taper sets let-off.** The cam has to turn further for each further
inch of string, so the load lever collapses toward full draw:

| taper | peak at | let-off | hold | stored | fps |
|---|---|---|---|---|---|
| 1.0 : 1 | 72 % | 10 % | 171 lbf | 177 J | 242 |
| 1.8 : 1 | 72 % | 33 % | 127 lbf | 122 J | 197 |
| 2.2 : 1 | 72 % | 45 % | 105 lbf | 101 J | 178 |
| 3.5 : 1 | 71 % | 77 % | 46 lbf | 54 J | 121 |

**Limb sweep angle changes the peak position and the coupling.** At 25° the tip
travels along the limb axis rather than inboard, so the cable barely loads it and
the curve peaks at 90 % of the stroke with only 37 % let-off; at 55–65° the
coupling is strong, the peak moves back to ~70 % and let-off rises to 45–52 %.

**Stroke and cam size trade off directly**, because `stroke = 2·rS·theta`:

| stroke | cam diameter | stored | fps |
|---|---|---|---|
| 7.9 in | 153 mm | 71 J | 133 |
| 9.4 in | 183 mm | 86 J | 156 |
| 11.0 in *(shipped)* | 214 mm | 101 J | 178 |
| 13.0 in | 252 mm | 121 J | 201 |

The shipped machine sits deliberately at 11.0 in: a 13 in stroke forces a
250 mm cam and a much larger, heavier limb assembly, while 11 in keeps every
number realistic and the cam to a plausible size. Its let-off is trimmed from
45 % to 34 % by softening the taper slightly (2.2 : 1 → 1.83 : 1), which is what
the `rS0 = 123 mm, rS1 = 56 mm` schedule above encodes.

## 7. Verification

```
$ node src/verify.js
peak draw weight     190.2 lbf @ 81 %  of stroke
holding weight       126.2 lbf          let-off 33.7 %
stored energy        95.9 J
energy identity      W 95.93 J vs E_limb 95.93 J
  residual           1.42e-14 J   (0.0000000000 %)
muzzle velocity      54.07 m/s = 177.4 fps
efficiency           60.9 %   (n = 0.641)
solver               bad steps 0 / 241   max |resid| 7.3e-12
velocity at 50 m     52.87 m/s = 97.8 % retained

$ node tools/verify-page.mjs
23 passed, 0 failed
```

The page test checks the peak weight, stroke, let-off, the exact energy identity,
muzzle velocity, efficiency, limb travel, monotonicity of the force curve, that
the launched bolt's speed matches the model to within 2.5 m/s, that it only ever
decelerates in flight, that all ten camera presets render, and that the page
raises no runtime errors.
