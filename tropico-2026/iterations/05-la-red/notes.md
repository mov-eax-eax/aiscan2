# LA RED — working notes

**Artist:** colorist · **Style:** post-digital / thermal / surveillance · **Canvas:** 1600x1200
**Concept.** The same street, 03:00, as the state sees it: a fixed pole camera at a corner. Two
people walking home are the hottest thing in the frame; a doorway is a hot rectangle; a parked car
is still cooling; a palm, a satellite dish and a shop window are cold — and the window is a *blank*,
because ordinary glass is opaque to long-wave IR. The instrument is looking at a street it cannot
see into. That is the piece.

**Organising rule (from REFS A11).** Thermal is a *relative* measurement: automatic gain rescales
the frame to the hottest thing in it. So one thing justifies every other value. Here the two bodies
are the zero-point: everything else is compressed toward the cold end of the ramp. At 3am the sky is
the coldest thing and every horizontal surface is losing heat to it, so the roofs and the road go
cold while the vertical walls, which held the day, stay warm. That is real physics, and it is what
makes the picture a landscape of temperature rather than a filter over a night street.

**Palette.** Six values only: black-blue, teal/cyan (road, kerb, cool mid), magenta-violet (walls),
warm orange (doorway, engine bay, window lights), amber-white and pure white (bodies). One accent
for the instrument marks: pale instrument cyan.

## Pass log

**Pass 1 (22:20).** Full scene, first render. Saw: the couple read as two gingerbread men — a white
ball head on a triangle torso with stick arms; the sky was a milky blue-grey because the sensor
blotch layer was at 0.5 and the vignette at 0.62; the skyline was a set of horizontal stripes that
read as fog banks; the "stars" were scratches. The doorway was a glowing tent. The macroblock floated
in the road as a pink pill. But the frame read as thermal surveillance, and the doorway/car/palm were
already doing their jobs.

**Pass 2 (22:35).** Rebuilt the sky as a real skyline (23 buildings with verticals, antennas, a water
tower, a tinaco, and a dozen tiny hot windows — other people in other rooms — which is the one
optimistic/dreadful detail I kept). Rebuilt the two bodies as *melted* masses: no outlines, soft
falloff, a white core in the head and upper torso, magenta legs dissolving into the road, heat plumes.
Cut the blotch to 0.2, the vignette to 0.45, deepened the sky. Saw: the two figures merged into one
amoeba because the halos overlapped and one arm crossed between them.

**Pass 3 (22:48).** Separated them (x≈718 and x≈842, different heights and leans), moved the bag to
the taller one's hand, gave the doorway architecture (dark reveal, interior split into two
temperature zones, a door leaf ajar cutting the heat, a threshold step, a spill), added the street's
depth cues (two converging kerbs, a drain grate, a bollard, a colder near-foreground band), shutters
and an AC box on the right wall. Saw: the kerb bands read as two pale searchlight ribbons across the
road — an artefact, not a street.

**Pass 4 (22:58).** Kerbs made dark instead of light (a cold edge, not a glow), the halo tightened
from 0.33h to 0.26h, a cooler neck band added so the heads separate from the shoulders, doorway spill
turned down so the bodies stay the zero-point. This is the delivered frame.

## Self-critique
I got the sensor right: the image is organised by temperature, not by a filter, the blanks (the shop
window, the windscreen) are deliberate, and the marks are four and quiet. But the beauty is under-
delivered — the two bodies are still closer to soft blobs than to people, the road in the middle is
an empty teal field, and the walls are flat magenta planes with a few pasted rectangles. The dread is
there (the ticks, the timestamp, the windows that are awake at 3am); the painting is not yet.

**Weakest thing:** the bodies. They read as heat signatures but not as *people walking* — no gait, no
contact with the ground, no weight. The piece's whole argument rests on the viewer recognising two
fellow humans in a white blob, and it only half-happens.

## Files
- `la-red.svg` — self-contained, no external assets
- `render-la-red.png` — 1600 px render
- `_gen.mjs` — generator, kept as a record of method
