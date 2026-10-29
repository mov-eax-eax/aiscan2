# Critic 01 — cycle-01 render, independent review

Reviewed: `shots/cycle-01.png` (1600×1000) at full size and in 3–5× crops, against `shots/cycle-00.png`
as a baseline, with `js/*.js` read only to explain what the pixels are. No source was edited.

**Read this first, because it changes how much of the record can be trusted.** The artifact and the
board disagree about what this render is. `shots/cycle-01.log` reports `"ready": false` and
`"stats": null` — no readiness assertion and no FPS sample — while the burned-in HUD reads
`CYCLE 01 · frame and dark sky` and `60 fps`. `BOARD.md` says cycle 02 is in progress and lists
layered petals, veins, halo and a lit core as its deliverable, `js/process.js` still ends at cycle
`01`, and yet `js/architecture.js` already contains those veins, three halo tori and an emissive
core, some of which are faintly visible in this render. The critique below is written against the
pixels in `shots/cycle-01.png`; that is the only honest basis for it.

## 1. What is actually visible

**1. Composition: a monument on a plinth, with the monument out of the picture.** The island fills
the lower half (lit coverage peaks at 0.55 of the width at row 800; silhouette spans x≈306–1293).
The crown — the declared destination — occupies a 198×212 px bounding box at x 692–890, y 57–269:
about **1% of the frame by area and 12% of its width**, pinned 57 px below the top edge. Measured
value structure is bottom-heavy and dot-lit: **49.6% of all pixels are below luminance 12**, while
only 2.1% carry any channel above 150 — and every one of those is a dot or a hairline. There is no
large bright form anywhere in the frame for the eye to land on. The right third above the island
(x>1000, y<460) is 75.6% below luminance 20: dead air, not composed negative space. The bottom
120 px are a featureless dark band. The image is left- and top-heavy for no readable reason.

**2. Sky: the seam is genuinely fixed; the depth it was supposed to buy is not there yet.** Cycle
00's hard red horizon wall (a one-pixel seam at y≈160) is gone. A 300×200 sky patch now holds 1061
distinct colours — smooth, no banding; the only step-class artefact left is a ~20-level jump at
y≈184 on the far-left edge of the horizon-glow band. But the visible sky is almost entirely that
horizon band: with the camera pitched ~17° down and a 50° vertical field, the top of frame reaches
only ~+8° elevation, so the shader's deep-space top colour and gradient never enter the shot. The
1000 stars sit at radius 230–480, and `FogExp2(0x080b1c, 0.0028)` is enabled on their material, so
they are 50–85% lerped into the fog colour: they lose hue and read as uniform one-pixel noise, with
no clustering and no band. The ringed planet is present top-right but at ~389 units it is ~69%
fogged and clipped by the frame edge; it reads as a grey ball with a hairline scratch, not as the
cycle's advertised reveal. The moon is out of frame. The ring's additive torus at 0.36 opacity
survives only as the near arc.

**3. Bloom/crown: a pinwheel of tinted sheets, not a flower.** Only two of the seven petals read.
`petals.rotation.y = a` followed by `rotation.z = -0.36` composes to a *tangential* lean: every
blade stays a vertical sheet and all of them sweep the same direction, so from this camera five of
seven are edge-on and vanish. That is the mechanical cause of "a few flat leaves", and it will
survive any amount of added detail. The seven petals are one identical bezier silhouette, 0.22
units thick, opacity 0.74, emissive 1.1 with flat shading — no form shading within a petal, no
thickness read, tinted acrylic rather than tissue. Veins are 0.05-radius tubes at a crown distance
of ~115 units, i.e. sub-pixel: they appear as one-pixel scratches. The "lit core" (emissive
intensity 2.8) renders as a dull pale-pink ball half-hidden behind the blades — there is no
post-processing bloom pass in the project (the vendored three bundle is core-only; no
`EffectComposer`/`RenderPass` exists), and emissive materials do not illuminate anything. The halo
tori and base rings read as clean white and pink vector ellipses crossing in front of the crown —
HUD, not atmosphere. The join between the petal bases and the stem top (y≈200–270) is a jagged
sawtooth of shard triangles and is the most obviously unmodelled area in frame.

**4. Island: a bullseye with a blank wall.** Four perfect circles (r = 55/40/27/16), no break, no
cantilever, no asymmetry beyond the pavilions — it still reads as stacked cake, which cycle 00's own
critique already named. The front wall band (y≈800–1000) is a smooth single-material cylinder with
no panel line, no plumbing, no windows, no occlusion gradient; it is 20% of the frame height and
carries zero information. The caps are flat untextured discs; the radial path strips (0.2 wide,
0.03 tall) are invisible. The five pavilions are five unrelated prototypes: a hoop on two rose
slabs, a teal fishbowl with a dark wedge and a floating pale rectangle inside, a cluster of
saturated purple spikes, and a tiered wedding cake. They share no grammar. The entrance gate reads
as two unlit black slabs with a one-pixel pale seam; its arch and glow strips are gone. The transit
ring is a plain hoop crossing in front of the spire, connected to nothing, carried by six hairline
struts that read as broken cables, with seven 0.58-unit pods that read as specks.

**5. Detail is confetti, and it all floats.** The picture's "detail" is overwhelmingly additive
points, and they share one failure mode: `depthWrite: false`, so nothing occludes anything — 1000
stars, 240 spores/fireflies, 10 pods, 12 drifting rocks, 42 boulders, 8 stalls, 34 trees. Dots sit
*over* geometry instead of inside it, which flattens depth rather than layering it. The 34 trees are
one construction (three branches, an icosahedron, a cone) in one pale-cyan hue band (HSL 150–210,
emissive 1.2): cotton-wool blobs with no trunk read, no canopy layering, no understory. The boulders
are 42 dark dodecahedra at random rotations — coal scattered on the rim. Water is three emissive
teal discs with additive rims lying flat on the cap: glowing stickers, no reflection, ripple or
shoreline.

## 2. The single highest-leverage move

**Make the crown the scene's key light — a real light at the core, not more petal geometry.**

Today nothing in the frame is lit *by* anything in the frame. The key `DirectionalLight` sits at
(64, 92, 42), nearly behind the camera at (87, 69, 75), so it front-lights the scene into
flatness; the blue rim light is behind the island, so it only touches thin silhouettes; and
`HemisphereLight` 1.05 + `AmbientLight` 0.6 lift everything uniformly. That is why 49.6% of the
frame is near-black and the rest has no falloff. A light at the bloom's core fixes the image's
central problem in one move: the destination becomes the brightest thing in frame, the terraces get
a directional warm-to-cool gradient for the first time, and every "glow" material currently faking
emission has something real to agree with.

Concrete, no addons needed (vendor bundle is core three only):

- `PointLight(0xff7fe0, ~900, 260, 2)` parented to the bloom group at the core; a smaller warm
  `PointLight(0xffd7a2, ~300, 120, 2)` inside it.
- One additive radial-gradient canvas sprite at the core (scale ~40–60 units, second faint copy
  ~90) as the halo — this buys 80% of a bloom pass for one texture.
- Rebalance so the new light can be seen: hemisphere 1.05 → ~0.55, ambient 0.6 → ~0.25.

Two things this deliberately is *not*: it is not the board's planned cycle-02 geometry pass (more
layers/veins under a lightless crown will keep reading as tinted paper), and it is not a re-frame.
Separately, and only if it is free: radius 122 → ~100 and `targetY` 28 → ~38 would lift the crown
from 1% to roughly 3–4% of frame area, since a light the size of a pinhole still will not carry the
picture.

## 3. What reads as fake, under-detailed or incoherent

- **The sky rays.** Six of them: a scaled sphere plus two 4.8×2.2 additive planes. In frame they are
  pale tan parallelograms with a dot in the gap. They read as floating cardboard or a UV sheet
  error, and they are the single most fake-looking element in the shot.
- **The petal lean** (above): a pinwheel sold as a flower. One-line cause, one-line fix
  (`rotation.x` radial cup, plus a second offset ring for layering — later, not now).
- **The pavilion zoo** (hoop, fishbowl, party hats, tiered cake) reads as a prop test, not a place.
- **Transparent surfaces** — dome, petals, banners — are pure opacity with no refraction, absorption
  or rim; they read as coloured glass or paper, not as material.
- **Water and glow discs** are stickers: additive rims, no contact shadow, no shore.
- **Instanced monotony**: seven petals with one silhouette, 34 trees with one construction, 42
  random boulders, 12 drifting rocks. Repetition without scale or lighting variation reads as
  generated, which it is.
- **The empty bands** — the bottom 120 px of blank terrace wall and the right-side dead air — read
  as unfinished rather than as atmosphere.
- **Process incoherence**: the shot log's `ready: false` / `stats: null` versus the burned-in
  `60 fps`, and the board/code/record disagreement above. An RSI loop whose verification step
  cannot assert that the render it critiqued is the render it recorded will keep producing
  critiques of the wrong thing.

## 4. One thing worth keeping

**The rim-trace language.** Every terrace edge, pool rim, transit rail and stem ring is a thin
additive line in gold/teal/pink (`terrain.js` rim tori, `architecture.js` ring traces). It is the
only device in the frame that reads as engineered rather than decorative, it survives at every
zoom, and it is what gives the island scale and structure. Extend it — traces down the terrace
walls, along the petal edges, onto the gate — rather than abandoning it for more props. The sky's
horizon gradient and the magenta/cyan palette are the other keepers.

**Overall judgement.** Cycle 01 is a real improvement over 00: the seam and the crop are fixed and
the palette coheres. But it still fails as a picture — no focal light, no surface, and a centrepiece
that is 1% of the frame and made of translucent sheets. The gap between the concept and the pixels
is currently being carried by colour, not by form or light.
