# Lámina Anatómica — notes

**Idiom:** 19th-century anatomical plate (1200 x 1600 portrait).

## The argument, before drawing

What this plate knows that the caption will not say: the specimen has no skin and no patient — it is
a **body made of its own instruments**, and the plate is cut from a corpse that was also a works.
Every component is numbered, and the forty numbers are not arranged in a list but on a **spiral**
that widens as it turns, so the eye that tries to count the plate is led round and round rather than
down. The components themselves are sited on a human frame that is nowhere drawn: heart-pump in the
chest, filters where the lungs were, a boiler where the skull was, and forty small fittings placed
along the outline of a standing body. Follow the callout leaders in numerical order and the fittings
draw that body — the one thing the plate refuses to engrave. The key at the foot does not explain the
machine; it lists the fittings in spiral order, so the list is a second spiral.

## The rule (one sentence)

One fitting-module is drawn forty times, and the forty numbers are placed on an Archimedean spiral
(r_i = 262 + 6.0·i, θ_i = 0.62·i + 0.4) so the sequence is a rotation, not a list; each fitting sits
on a hidden standing body, so tracing the leaders 1→40 draws the figure. The deliberate break:
fitting 21 (the heart) is drawn inverted and ringed in red.

## Hidden systems

1. **The body**: forty fittings sited on a standing-frame layout; their leader terminals trace the
   outline (head, arms, trunk, legs). Nothing draws the body; the terminals do.
2. **The spiral**: 40 stations, four turns; the key repeats the spiral order in a rectangular spiral.
3. **Counters**: 40 fittings, 12 boiler rivets, 6 ribs a side, 12 gauge ticks.

## Registers

plate (the exploded machine) · key (foot) · callout leaders and numbers (the spiral) · engraved
hatching (ground). Three scales: border/hatching > machine > fittings and numbers > hatching lines.

## Palette

paper #efe6d2 · ink #2a2119 · sepia wash #a9834f · arterial red #a83a2c · venous blue #35597f.

## Pass log (6 passes)

1. **Build.** Machine from primitives, 40 fittings, numbers on the spiral, key. First render read as
   a thin insect with a spiderweb of leaders.
2. **Scale + stations.** Machine scaled to 0.80, terminals moved onto a standing body, numbers
   enlarged, key re-laid.
3. **Crash + re-order.** The leaders were emitted before they were computed (the file threw); moved
   the station and leader definitions ahead of the machine so the leaders pass *behind* the drawing.
   PASS-3 CHECKPOINT WRITTEN.
4. **Numerals + key.** Heavier seven-segment strokes, 4×10 key spiral (it had only 20 cells), a
   cross-hatched shadow under the machine.
5. **Anatomy.** Two-lobed heart, lung drums with intakes and filter bands, machine scaled to 0.92.
6. **Spacing.** Spiral radius per turn raised to 60 so the 40 numbers stop overlapping. PASS-6
   CHECKPOINT WRITTEN (the piece converged at 6 rather than 7; the near reading was the last to hold).

## Checkpoint — pass 3

- **FAR:** a technical/anatomical plate — hatched field, a symmetric specimen, a ring of numbers, a
  key at the foot. Archetype reads; the failing part is that the specimen is small and illegible.
- **MIDDLE:** the machine reads as an assembly of drums, pipes and a bellows, but not yet as an
  organism; the leaders form a spiderweb that crosses the machine.
- **NEAR:** numbers, fittings and hatching are present and countable, but the numerals are mushy at
  16 px and the leaders cut over the machine.
**Failing: MIDDLE.** Fixed by passing the leaders behind the machine, enlarging the machine, and
turning the heart into a heart.

## Checkpoint — pass 6

- **FAR:** plate with a spiral of numbered stations and a key; the archetype is unmistakable.
- **MIDDLE:** an exploded heart-pump with filter lungs, a boiler skull, a spine of flanges, ribs and
  a plinth; the spiral of numbers around it reads as a rule. PASS.
- **NEAR:** 40 seven-segment numerals, 40 fittings on a body contour, the key's rectangular spiral,
  the 12 boiler rivets, the shadow hatching. The hidden body is present but subtle: at 100% the
  terminals trace head-arms-trunk-legs; at 400 px it is invisible, which is the point.

## Honest critique

- **What works:** the plate *is* a plate: hatched paper, a specimen in the middle, numbered stations
  on a visible spiral, a key in a second spiral. The three registers (image, numbering, key) are
  distinct, and the numbering is genuinely generated rather than placed.
- **What is weak:** the specimen reads as plumbing more than as a body. The heart and lungs are
  recognisable; the rest is a stack of drums. The hidden body is too faint — I would raise the
  fittings' contrast and give the terminals a second, larger ring so the figure can be found at
  800 px, not only at 100%.
- **Craft:** the numerals are seven-segment paths (drawn, no text); the hatching is 150 rules and a
  cross-hatched shadow; grain last.
