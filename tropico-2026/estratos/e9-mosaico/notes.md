# E9 — Mosaico

**Idiom:** Soviet mosaic panel (1970s bus stop / palace-of-culture wall), 1600x1200.
816 tesserae on a 34x24 grid, plus joints, border and patina.

## Argument (written before drawing) — what this piece knows that the caption will not say

The panel is a public wall, and public walls are built to be read from the bus. So the mosaic
carries two images at once: the one the commission asked for (a worker, a peasant woman, the
sun, the harvest) and the one the field produces when the eye steps back — a red star burned
into the background, present in every tessera's colour bias but invisible when you stand close
enough to see the grout. The tesserae are a grid with a per-cell jitter; the star is not drawn,
it is a bias in the jitter. One tessera out of every ninety-seven is out of place, rotated and
pushed off the joint; those tiles walk across the panel on a diagonal. Up close the panel is
material and repair; at the distance of the street it is an emblem.

## Rule (one sentence)

A 34 x 24 tessera grid with per-cell colour jitter; every 97th tessera is displaced and
darkened, and the background's jitter is biased toward a warm red inside a five-point star,
so the second image exists only at a distance.

## Hidden system

- The star: a pentagram in page coordinates; background tesserae inside it are blended 70%
  toward deep red, outside it they are ochre/terracotta. At 400 px it reads as a red star
  behind the figures; at 100% it is only a warm patch of tesserae.
- The diagonal thread: row-major index 97n+96, displaced +7/-7 px, rotated +9 degrees and
  darkened 18%; in a 34-column grid this steps left five columns and down three rows per hit,
  so the outliers form a diagonal from the upper left to the lower right.
- Registers: the main figure group (worker with hammer, woman with sheaf), the tesserae field,
  the cement joints, the border course (a two-tile red band with gold/cream corner blocks).

## Pass log

1. **Build 1.** Grid, border, figures, sun, hidden star, 97-thread. Looked: the figures were
   lost in a gold field; the joints were too thick; the star did not read.
2. **Build 2.** Terracotta field, cream sun, stronger star bias, thinner joints, simpler
   border. Looked: the field read as mosaic; the figures still low contrast.
3. **Build 3 — CHECKPOINT.** FAR: a bordered mosaic panel; the figures do not yet separate.
   MIDDLE: the worker/woman are visible but their heads vanish into the sun's halo; the star
   is only a faint darkening. NEAR: tesserae, grout, jitter and the displaced thread read.
   **Failing: far and middle (contrast and star).**
4. **Build 4.** Worker in a cream shirt and blue overalls; smaller sun with a red rim; the
   star bias raised to 62% toward deep red; the ground lowered. Looked: the figures now read at
   400 px; the star begins to appear.
5. **Build 5 — CHECKPOINT.** FAR: a red star behind a worker and a peasant woman reads at
   400 px. MIDDLE: the figures are legible; the sun is a halo; the border course is busy but
   correct. NEAR: grout, jitter, patina, missing tesserae, the displaced diagonal thread all
   read at 100%. **Failing: the star is still softer than it should be at middle distance.**
6. **Build 6.** Star bias raised to 70%; final render and three-distance check. Converged.

## Three-distance result (final)

- **FAR (400 px):** a Soviet mosaic panel: border course, terracotta field, red star, worker
  in cream and blue, woman in red with a gold sheaf.
- **MIDDLE (1600 px):** the figure group and the sun, the border, the tesserae; the star is
  visible as a colour field behind the figures.
- **NEAR (100%):** grout joints, per-tile rotation and jitter, missing tiles, patina, and the
  diagonal of displaced tesserae; the star disappears into the tile noise.

## Critique (honest)

- The figures are crude even for mosaic: the heads are blocks with a single dark hair tile, the
  hands are squares. At middle distance they read as types, not people.
- The star is a colour bias, so at middle distance it is soft — a real optical mosaic trick
  would use tile rotation or a complementary tile and read more crisply. I raised the bias
  instead of solving it structurally.
- The border course is the weakest drawing: a red band with gold corner blocks, busy without
  being decorative.
- The "one in ninety-seven" thread is visible but reads as damage rather than as a system; the
  count is documented, not perceivable.
- The panel is flat: no light, no recess beyond one shadow line; the cement joints are uniform.
  A 1970s wall would be dirtier, with water stains and repairs; the patina is token.
