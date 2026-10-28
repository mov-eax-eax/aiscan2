# V1 — La Persecución

**Archetype assigned:** extreme diagonal / dutch tilt, figure cropped at the edge.
**Style:** expressionist woodcut, two inks (black + one red on paper).
**Theme:** a rooftop chase at 5am in a city that is not named.

## Concept

A 20° camera roll turns every architectural edge into a diagonal. The roofline runs
corner to corner (bottom-left to top-right) and the chase runs against it
(bottom-right to upper-left). The runner is the only red mass besides a thin
dawn edge burning along the parapet. His pursuer is not a figure: it is a
headless running body — a shadow entering from off-frame top-left, stretched
along the light — whose feet land on the parapet. The upper left stays open
(paper) and is broken only by a water tower cut off by the left edge.

## Pass log

1. **Build 1.** Diagonal established: parapet at -20°, red dawn edge, water tank,
   runner, roof hatch, pursuer as a long black band. Looked at it: the "shadow"
   read as a construction crane / tower, the tank as a shed, the runner as a
   static red puppet.
2. **Build 2.** Tank rebuilt as a cone + cylinder; runner given a stride; shadow
   given a head and arms. Still read as a segmented black beam — the limbs were
   thin parallel strips, no anatomy.
3. **Build 3.** Tried a matrix-stretched running figure for the shadow. Read as a
   crane with a hook. Wrong approach: stretching a pictogram 4x destroys the
   silhouette.
4. **Build 4 (lead feedback).** Shadow re-drawn as a running body **cropped by the
   top edge** (the caster is off-frame), thick overlapping limbs, feet on the
   roofline. Whole art group got a displacement filter for hand-cut edges;
   paper gouges and chips added inside the black masses. Runner re-posed and
   re-cropped so the **bottom-right corner cuts the knees**, not the shoulder.
   Soft edge on the shadow's light side (blurred offset copy), small twin
   shadow at the runner's feet.
5. **Converge.** Water tower narrowed and raised, shadow feet anchored to the
   parapet, shadow gouges added, 400px thumb checked. Stopped.

## Self-critique (honest)

- **The shadow reads as a runner but not quite as a cast shadow.** It is legible
  at 400 px (headless body, stride, arms), yet it still reads like a pictogram
  more than like a projected shadow. The soft edge is subtle at full size and
  disappears at thumb. A real improvement would be a wider penumbra and a
  stronger contact with the parapet.
- **The runner is the weakest figure.** The torso is a red block; the arms read
  as bent bars; the pose is inferred from the lean rather than built. At 400 px
  he reads as "a red running man", which is what the archetype needs, but up
  close he is stiff.
- **The water tower** at thumbnail is a dark shape with a slanted top — closer to
  a shed than to a tank. Full size it has a cone, rim, legs, ladder and braces.
- **The roof hatching is slightly mechanical** — rows of broken dashes; it reads
  as cut wood at 1600 px but as rain at 400 px in places.
- **5am is carried by the red dawn edge, not by light.** There is no atmospheric
  glow; it is a flat two-ink print by design, but the time of day is a caption
  more than an sensation.
- The upper-left void is larger than in the first room (no horizon band, no
  subject band along the lower third), but the shadow's body does cut into it.

## Technique notes

- No <text>, no external assets, no gradients, no smooth curves (all polylines
  and polygon fills).
- Only three inks on the page: paper #E7DDC4, black #12100E, red #BE2A1D.
- Edge roughness: feTurbulence + feDisplacementMap (scale 4) on the whole art
  group; hand-jagged contour points underneath.
- Grain: feTurbulence fractalNoise, alpha from luminance, last element, 0.13.
- 400 px thumbnail checked after the final pass; reads as diagonal chase.
