# V7 POLILLA — notes
Artist: lead · extreme macro · 1600x1200

## ARCHETYPE
Extreme close-up, fills the frame, no background. The composition is one edge (a diagonal from
lower-left to upper-right) and one field (scales). No horizon, no subject, no place.

## PASS LOG
1. First build: the wing vanished. Cause: `<use href="#wing">` inside a `<clipPath>` — librsvg
   2.40 does not resolve plain `href` in clip paths. Fixed by inlining the `<path>` in the clip.
2. Second build: the scales read as wallpaper — a uniform grid of identical tiles inside a clean
   curve. No wing, no depth.
3. REBUILD: smaller scales (34x22), overlapping with a cast shadow under each; broad dark and
   light bands across the wing so the grid is broken by the wing's own pattern; banded
   iridescence (cyan / magenta / violet) instead of one diagonal wash; a ragged fringe of
   procedural hairs along the edge (110 strokes, deterministic seed); 26 torn-scale gaps; a rim
   light on the contour; inner shadow at the lower-left so the wing turns away from the light.

## HONEST CRITIQUE
The macro archetype is achieved — it does fill the frame and refuse a horizon. The scales still
read slightly as manufactured tile rather than chitin, and the surface is lit too evenly across
the field: a real macro would have one falloff. The circuit traces are present but quiet; at
1600 they are visible on inspection, at 400 they disappear. It is the least "place-like" piece in
the project, which is exactly what the room asked for.
