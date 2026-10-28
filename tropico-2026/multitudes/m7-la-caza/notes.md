# La Caza — notes

**Idiom:** millefleurs tapestry. **Canvas:** 1600 x 1200 landscape.

## Argument (before drawing)

What the tapestry knows that the caption will not say: the field is one module repeated, and the
hunt is what happens when figures are laid on top of a pattern that does not care about them. The
millefleurs is a lattice of flowers in five colours; the hunt is arranged in three depth bands at a
fixed scale ratio (1 : 0.62 : 0.40), so the picture is a wallpaper with a story pinned to it. The
stag is at bay in the foreground, cropped by the bottom edge; the kill has not happened. Ten white
hares are in the field, and five of them are inside the flowers - the pattern is also a hiding place.

## Crowd rule

The millefleurs module repeats on a 64 px lattice across the whole field. Figures are placed in three
depth bands - foreground (y > 760, scale 1), middle (y 470-760, scale 0.62), far (y < 470, scale 0.40)
- and every third figure in a band belongs to the hunt (a hunter, a hound, or the quarry). Animals
that are not hunted are hidden inside the module.

## Find-it motif

A white hare: 10 occurrences, ten poses (sitting, running, rearing, crouched, ears flat, washing,
asleep, half in a burrow, behind a flower, leaping); five are half-hidden by flowers.

## Three simultaneous actions

1. The stag at bay in the foreground: four hounds closing, a spearman, the stag turning.
2. The falconer at the middle left: a bird leaving the fist above the river.
3. The picnic at the lower left: a party on a cloth, a servant with a tray, a hound stealing.

## Pass log (5 passes)

1. Build: sky strip, hill and castle, river and mill, millefleurs field, three bands of figures, the
   stag, hounds, the picnic, the hares. First render: every animal read as a blob with sticks.
2. Animals rebuilt with proportions (body ellipse, neck, head, legs): still camel-like, because the
   neck was vertical and the head too small.

3. Proportions corrected again: shorter neck, larger head, shorter legs.

4. Stag head rebuilt as a forward-leaning neck plus a wedge muzzle and four branched antlers; the
   stag finally reads as a deer. PASS-4 CHECKPOINT BELOW.

5. Final: grain, border, weave, thumb check.

## Checkpoint — pass 4

- **FAR (400 px):** a dark green tapestry field scattered with flowers, a river band, a castle on the
  hill, and a large pale animal in the foreground. It reads as a millefleurs hang at thumbnail size,
  though the field-to-figure contrast is low and the flowers dominate.

- **MIDDLE (1600 px):** the hunt reads: riders in three bands, hounds, the pale stag at bay, the
  picnic, the mill, the river. The three actions are findable. Failure: the horses still read as
  long-necked brown animals, not horses.

- **NEAR (100%):** the hares resolve as hares in ten poses; hidden animals (14) are inside the module;
  the weavers texture and the border are there. Failure: the flowers are pasted on the field rather
  than woven into it - they sit in a perfect grid, which reads as wallpaper, not as millefleurs.

**Where the eye goes:** the pale stag first (brightest, largest), then the river, then the picnic.

## Critique

- **What works:** the wallpaper-plus-story logic is legible: a repeating field with a ruled placement
  of figures in three depths, a bright quarry in the foreground, and a find-it thread that uses the
  pattern as camouflage. At 400 px the piece reads as a tapestry, not a painting.

- **What is weak:** the animals are naive to the point of being wrong - the horses read as camels and
  the whole hunt is soft because nothing in the field has a hard silhouette except the stag. The
  millefleurs is a pattern tile, not a woven distribution: real millefleurs vary density, overlap and
  scale. The find-it hares are legible but the false ones (the hidden animals) are indistinguishable
  from them, which weakens the discovery.

- **What I would change:** build the field from three overlapping flower scales with gaps, and draw
  the horses from a single silhouette path rather than parts.

