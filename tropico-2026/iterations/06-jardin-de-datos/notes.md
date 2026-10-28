# 06 · JARDÍN DE DATOS
vectorista · TROPICO 2026 · cyber-botanical art nouveau

## Concept

A plate from an imaginary botanical monograph: the walled garden of a Ministry research
station, where the planting and the hardware have grown into one organism. The specimen is
one plant. Its stem is a twisted two-core cable. Its leaves are solar panels — the cell
wiring is drawn as the venation. Its flower is a satellite dish opening: a gold paraboloid
with concentric rings and the LNB standing up out of it on its tripod, inside a ring of coral
petals. Its roots are a cable mat under the soil. Its tendrils end in fibre-optic points.
A drip line climbs the stem as a vine, with emitter pods as buds. One branch carries a
router as a seed pod, antennae raised.

At the foot of it, half-swallowed by the planting, a technician crouched under a straw hat,
one hand forward with clippers, is doing maintenance on the thing that is eating him.

Three insets, as on a real plate: the flower in plan, the fruit (the router pod), and the
seed — which is a cut cable end, its strands splaying like roots. Not a microchip.

## Structure, and the module

This is a PLATE, so the structure is the plate's: an ornamental border, a field, a specimen,
three details, a cartouche. The border is one 48 x 56 module — an S-band in ink over a gold
band, a leaf, a coral bead — repeated on all four sides with <use>, so the repeat is a rule
and not a drawing. The field carries a faint seven-line ornamental fibre ground, and the
paper a grain overlay.

The plate's plate-ness is the joke, and the argument: a plant that does not exist, catalogued
with the same apparatus empire used to catalogue plants that did.

## Pass log (4 passes)

**v1.** Blockout. Border built from the module; stem, branches, solar leaves, fern tips,
dish-flower, three insets, gardener. Seen in render: border bottom band missing (transform
bug), the leaf cell-grids invisible (clipPath transform not honoured by librsvg — moved the
clip inside the transformed group), the gardener was a hat on two black sticks, the microchip
inset was the cliché the brief warns about.

**v2.** Fixed the border maths on all four sides; rewrote solarLeaf with a local-space clip so
the cell wiring reads; rebuilt the dish-flower (outer ring of 12 narrow petals + inner ring,
paraboloid rings, LNB on a tripod instead of a berry); replaced the microchip with the cut
cable; staggered the insets and removed the gold chain that had turned them into a necklace;
added hanging cable-vines into the empty top corners; replaced the flat soil band with a
cable-mat root system.

**v3.** Rebuilt the gardener as a legible crouching figure — knee down, boot on the soil, a
forward arm with clippers, the other hand on the ground, hat over the head, and ferns and a
leaf partly covering him, so the person reads first and the ornament swallows him second.
Scaled him down 7 % and moved him off the stem. Bigger, clearer cut-cable inset.

**v4.** Coral blooms on the branch sprigs to carry the accent into the paper; removed the one
floating bloom (an error: a flower with no stalk) and hung it on a stalk from the stem; final
render, thumbnail and greyscale.

## Checks

- **400 px thumbnail (T1):** passes as *this* plate — border, specimen, flower, insets,
  and the crouched figure are all identifiable.
- **Greyscale:** the ink line holds the whole structure; the dominant dark is the stem and
  foliage mass, the bright event is the gold dish, the paper stays the light. The border
  reads as a frame, not as decoration competing with the drawing.
- **Middle-value measure:** 8 % of pixels between 25 % and 75 % grey (0.940 - 0.857). This
  is a high-key line-and-flat plate, not a mush — appropriate for the medium, and noted
  honestly: it is not a picture with deep shadow.
- **Text:** none. The cartouche is a rosette and two gold rules. The plate numbers are
  ticks, not numerals.
- **Size:** 119 KB, well under budget.

## Honest self-critique

- The plate is decorative before it is *lived in*. A real botanical print is
  observed; this one is invented, and there are passages (the empty cream at mid-right,
  the evenly spaced insets) where it shows.
- The line is consistent, which is the strength and also a limit: because every contour
  is the same confident stroke, the cable, the leaf, the paper and the gold ferrule only
  separate by fill colour, not by edge behaviour.
- The strongest idea in it is that the solar panel is a leaf with its wiring as venation.
  It is also the quietest — at 400 px the leaves are just leaves.
- **Weakest thing:** the three insets are still a list down the right side. A better plate
  would have let the specimen dictate where its own details belong.
