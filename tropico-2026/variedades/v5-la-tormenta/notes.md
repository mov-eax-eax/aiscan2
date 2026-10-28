# La Tormenta — notes

**Archetype assigned:** circular medallion inside a vertical card (concentric).
**Canvas:** 1000 x 1500 portrait. **Style:** art nouveau + Mexican ex-voto / tarot.

## Concept

A hurricane as a saint. The card is a votive *estampa*: a heavy ornamental frame, a
circular medallion, a dedication plate below, and two small scenes in the bottom corners
(before / after). Inside the medallion the eye of the storm is the family's halo: a gold
disc, ringed by a scalloped eye-wall, over which a red roof is still standing. The roof is
the only shelter; the storm surge is already at the family's feet; the rain-bands spiral
outward; lightning crosses the gold rim from the cloud banks. The halo *is* the eye — the
saint in the picture is the storm, and its miracle is that the roof held.

## Build

Hand-authored through a small generator (`gen.mjs`, plain SVG output, no external assets)
so the concentric geometry is exact. Everything is flat ink; no gradients. Grain is the last
element.

## Pass log (what I actually saw, and what I fixed)

1. **Pass 1** — first render was a gold balloon: the medallion rim circle had a *fill*, so
   it covered the whole interior (roof, family, water, spiral). Fixed to stroke-only.
2. **Pass 2** — blank PNG: two malformed `opacity="0.32/` attributes. Fixed; interior visible.
   Interior read as a bright target with no focal hierarchy, roof too big, water like a bath.
3. **Pass 3** — rebuilt the storm interior (concentric rings + spiral bands), smaller roof,
   moved the cloud bank behind the medallion. Spiral arms visible but turned into a plain
   ring (their sweep overlapped 3×), and the "eye wall" puffs read as a pearl necklace.
4. **Pass 4** — narrower spiral sweep, cloud puffs half-hidden behind the halo, tilted roof,
   thinner lightning. The medallion finally read as one object; the clouds still read as an
   awning and the pale arms as scratches.
5. **Pass 5** — arms widened and made pale (rain bands), scalloped cloud edge hugging the
   halo, roof on two posts, cartouche got a votive heart. Bottom-right scene still a tangle.
6. **Pass 6** — replaced the bottom-right wreck with a single toppled house + floating roof
   fragment; cleaner posts; heart plate; final grain. Re-checked the 400 px thumb.

## Honest self-critique

- **What works:** it reads as a *card* instantly at 400 px — frame, medallion, corner
  vignettes — and the concentric logic is unmistakable. The gold / indigo / vermillion
  palette is coherent and the family-under-the-roof is legible at thumbnail size.
- **What is weak:** the hurricane itself is the least convincing part. The pale spiral bands
  read as two brush-sweeps rather than a rotating storm; at small size the cloud banks and
  the eye-wall scallops merge into one teal mass. The "saint" is only implied by the halo —
  a bolder divine figure would have been braver, and the brief pointed that way.
- **What I would change with another pass:** replace the scalloped eye wall with real
  cloud-flat shapes, and give the storm a directional vortex (bands that thicken as they
  turn) rather than symmetric arms.
- **Craft notes:** flat colour throughout; the only filter is the grain. The two bottom
  vignettes are true ex-voto miniatures but at 400 px only the red roof triangles survive.
