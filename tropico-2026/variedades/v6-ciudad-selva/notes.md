# Ciudad / Selva — notes

**Archetype assigned:** double exposure — two images superimposed and offset.
**Canvas:** 1600 x 1200. **Style:** 1960s psychedelic screenprint, four flat inks.

## Concept

The jungle growing through the city, printed as two images pulled out of register on the
same sheet. A city of vertical bars, window slots and black mullions runs at +9.5°; a canopy
of leaves and vines runs at -26°; the two lattices interfere everywhere. Across the middle lies
one large silhouette that is deliberately *not* a character: a jaguar head and back fused to a
stepped tower and its piers, with no face, no eye and no spots. The silhouette is the mask: its
edge is where the print changes phase. Outside, the sheet is bone with pink buildings and green
foliage; inside, the field turns warm black with the *same* city grid in bone (rotated a further
4°, shifted, narrower) and the *same* foliage in solid green. The beast's belly and legs are the
negative of the city, its back and head are unbroken black. Nothing is transparent: the two
images read through each other by ink density, not opacity.

## Inks (four, flat)

    bone      #efe6cc   paper / negative plate
    warm black#1c1108   key plate
    hot pink  #ff2a6d   city plate
    poison    #a8c40c   canopy plate

No gradients, no blend modes, no `<text>`. The only filter is the final grain.

## Misregistration

Every plate carries its own pull. The city plate's offset varies across the sheet
(`6 + 4·sin(0.0042x)`, `5 + 3·cos(0.0031x)`), so the pink slides against the black from
left to right. Each leaf's fill sits (-5, +4) off its own keyline. The silhouette's pink ghost
is +13 / +10. Inside the mask the bone city is +4° and shifted (-52, +26) against the outside
grid, and its pink mullions are pulled a further (+10, -7): the moiré at the mask edge is the
phase shift, not a filter.

## Pass log (honest)

1. **Pass 1-6** — a dense four-ink field with a black animal. It was a *pattern with a
   character on top*: the animal had an eye, teeth, whiskers and paper rosettes; it read as a
   friendly dog, and the two images did not pass through each other.
2. **Pass 7 (rewrite)** — dropped navy for bone/black/pink/poison; silhouette rebuilt as a
   faceless head + stepped tower + colonnade of piers; inside the mask the city and canopy are
   re-drawn in the opposite phase. First render: the interior was covered by the pink plate, so
   the mask read as a pink striped box.
3. **Pass 8** — separated the plates: pink bars with bone windows outside, bone bars with black
   slots inside, green foliage both sides. The mask then read as a black mass, but it dissolved
   into black leaves elsewhere on the sheet.
4. **Pass 9** — removed black from the canopy (green only + black keylines), so black belongs to
   the key plate and the mask alone; the city moved into the belly and legs only, leaving the
   head unbroken; ears sharpened, muzzle extended. Final thumb check.

## Honest self-critique

- **What works:** the phase swap at the silhouette edge is real — the eye reads the black mass,
  then sees the city measured *inside* it. The palette is acid and dirty rather than candy, the
  misregistration is systematic, and the sheet has no horizon, so it does not turn into a
  landscape with a subject.
- **What is weak:** the hybrid leans architectural — at 400 px the mass reads as a long black
  building with pointed ears more often than as a jaguar; the head/muzzle is small relative to
  the body. The canopy is a mass of similar leaves (a texture, not a jungle with strata), and the
  top-right plateau of the mask is a large featureless black area.
- **What I would do next:** build the canopy in three overlapping strata with a few trunks
  crossing the frame, and give the head more scale and a stronger jaw so the animal wins against
  the building at thumbnail size.
- **Craft:** flat inks only; the "wobble" is per-vertex jitter in the street and vine paths, not
  a displacement filter, so edges stay printable; grain is the final layer at 0.13.
