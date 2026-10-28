# 03 · PABELLÓN MINISTERIO DEL FUTURO
vectorista · TROPICO 2026 · geometric abstraction / tropical modernism

## Concept

The sun is the debt, and this is the building the debt paid for. A 1960s
tropical-modernist ministry pavilion, raked by one late-afternoon sun, still
flying the Ministry of the Future: brise-soleil louvres, a coral portal, a
boarded-up wing, a dish bolted to the roof, a solar array on the terrace, a
dead neon, a cable bundle, a monobloc chair, and one person walking past the
steps who is not looking at us.

Method: **poster, not picture.** One eye level, one sun, flat fields, three
deliberate flat colours plus one coral accent. The building is cropped by the
top edge so it reads as a mass, not an object. The composition is a diagonal:
the brise-soleil's raking shadow falls across the whole lower-left and one
huge flat shadow mass slides off the frame. The right third is sea, shore,
palms.

## The mechanism I stole (REFS A07 / A08)

1. **Module + permutation (Bulcão).** The brise-soleil shadow is ONE module —
   a 45° band — repeated on a fixed period with a *precomputed permutation of
   widths* (46, 26, 54, 34, 22, 48, 30, 58, 26, 40, 32), then fanned slightly
   (0.22 per unit) so the rhythm has perspective instead of wallpaper.
   The rule is stated in `build.mjs` and can be audited.
2. **The rule is broken in one place.** The coral portal is a recess: the band
   rhythm stops dead at it, and the coral is the only saturated area in the
   frame. That is the "one decision" A07's test asks for.
3. **Formwork grain (Bo Bardi).** The concrete carries a 9 px board pattern at
   13 % inside the masses, plus blurred stains that are kept off the shadow
   edges. Concrete is bleached and stained, not grey and sad.
4. **The shadow is designed as carefully as the building.** Ground shadows
   fan to a common vanishing point on the horizon (VP 1750, 492) and the
   facade bands are parallel — two planes, two behaviours, one sun.

## Pass log (11 renders)

**v1 — blockout.** First render: sea floated above the ground, no palms, empty
beige field, shadow field a flat fill with no contrast. Composition wrong.

**v2 — added roof kit + a first palm.** Palm came out as a starburst; building
floated; the fin screen read as a barcode.

**v3 — reframed (eye level, horizon, wider mass).** Still a diagram: 60 % of
the canvas was empty beige, the fins were still 20 dark bars.

**v4 — perspective fix.** Put sea + shore on one line, ground recedes, shadows
fan to a VP; palms entering from the right. Discovered a clip-path bug that
was excluding the tall slab from the shadow rhythm.

**v5 — fixed the clip, first diagonal rhythm.** Read as wallpaper (uniform
period, edge to edge). Palms still too star-like.

**v6 — finer palm study (3 studies, 5 palm renders).** Rebuilt fronds as
serrated bezier ribbons with a crown that bends toward the vertical: the
fountain silhouette. This is what finally made them palms.

**v7 — irregular band widths, coral portal punched as a recess.** Poster
reading arrived. Right 40 % still empty sand.

**v8 — lead review pass:** dish rebuilt as a shallow paraboloid in
perspective; figure given a walking stance and a bag; louvre blades tried over
the portal (they read as a ladder/beach-towel, rejected).

**v9 — canopy instead of louvres;** chair enlarged; palm crown-shadows
rebuilt as clean tapered fronds.

**v10 — one big foreground object:** monobloc chair brought forward,
cropped, standing at the edge of the palm shade; canopy given a hard shadow
beneath it and its whisker-rebar removed.

**v11 — final:** back palm enlarged into the mid-right gap; palette deepened
(shadow mass darkened, sand pulled back so the concrete is the lightest mass);
greyscale now holds four values: pale concrete / lit sand / shadow rhythm /
black palm + portal.

## Checks

* **1600 px**: the render is the deliverable.
* **400 px thumbnail**: pavilion mass, coral portal, palm cut-outs, sea + ship
  all still read; the chair survives as a small pale shape.
* **Greyscale**: four distinct masses and one bright event (the pale facade).
  The strongest dark is the palm mass, second the portal and the boarded bay.
  The weakest area in grey is the mid-right sand, which is the piece's one
  soft spot.

## Honest self-critique

* The **left half** is still a large, fairly even striped wall; the rhythm is
  disciplined but it carries less incident than the right half. In a richer
  pass I would put one more event into it (a second recess, a bleeding stain
  or a broken fin), because right now the eye crosses it to reach the coral.
* The **chair** reads as a chair, but it sits oddly light against sand of a
  similar value; it is held by its shadow more than by its own drawing.
* The **figure** is legible at 1600 but at 400 px it is a dark dot — which is
  correct for the scale story, but it means the human note only works up close.
* The **sea** is honest (one strip, one ship, one shore line) but it does not
  have the heat shimmer a real horizon has; a couple of flat haze slivers
  would have helped, and I chose not to add detail to save it.
* **Risk taken**: the pavilion is cropped by the top edge and the shadow
  rhythm is invented (parallel on the wall, fanned on the ground). It could
  have read as a mistake; it reads as a light study instead.
* **Weakest thing**: the composition's weight is left-heavy and the right
  third still needs the palms more than the palms need it.


# FIX PASS after CRITIQUE-A (curator scored it 31, not 38)

The critique named the cost as LIGHT, not weight. Three ranked fixes, three renders.
1. Deepen the shadow, blow the light: the screen wall becomes a recessed half-shade plane
   (#E1D4AB); shadow bands #9BA28A -> #6C7149; pavement shadow #5F6444 with #4B5036 core;
   lit faces #F2E7C6 / #FCF6E2; sand down to #CBB886 so it sits between shade and light.
   Sun-to-shadow gap is now ~55 points, not ~20.
2. One broken-fin blade of sun: a snapped fin stump hangs off the top edge, its slot a hard
   white parallelogram (#FFFFFF, 94 wide, same shear as the rhythm) cutting four shadow bands
   in the upper left - the second deliberate break after the coral portal.
3. Grain split per mass: horizontal on the tall slab, vertical on the low slab, diagonal on the
   plinth, per-fin phase-shifted board lines; plus a water bleed running from the roof across
   the plinth joint into salt bloom, a rust run from the dish bolt, and a re-drawn, uneven shore.

Measured before the last tone change: 51% of pixels between 25-75% grey (from 53%). The census
barely moved because the shadow now sits inside that band; the change is the GAP (shadow ~41%
against lit ~95%).
Not touched: chair, coral portal, cropped top edge, composition, palms as shapes, the sea.
Risk taken: the screen wall as half-shade rather than lit is a reading the earlier version did
not have - it fixes the light but makes the left cooler and quieter than the right.
Remaining weakness, stated plainly: the blade of sun is a bright parallelogram in a wall of
stripes - it reads at 1600 and in the posterised reduction, but at 400 px it is nearly
invisible, so the left half's first thing is still the rhythm rather than the break.
