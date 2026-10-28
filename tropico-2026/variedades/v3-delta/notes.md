# DELTA — working notes

**Artist:** aereo · **Style:** cartographic realism / woodblock flat colour · **Canvas:** 1600×1200
**Archetype:** all-over aerial topography. No horizon, no sky, no single focal point.
**Subject:** a drowned coast in 2100, seen from straight above.

**Concept.** The picture is the delta, not an object in it. The four edges are all ground: fields,
tidal flats, braided water, a drowned town. I drew it as an aerial survey plate that a Japanese
block-cutter might have cut in 1830 — flat colour areas, one consistent fine keyline, paper showing
through — but the subject is 2100: the polders are returning to water, the sea is in the streets,
and the survey furniture (north arrow, scale bar, triangulation marks) is the only thing still
confident about where anything is.

**Organising rule.** A woodblock map is flat: no gradients on the land, no horizon, no atmosphere
that would imply a vanishing point. So all depth is carried by *registration* — the pale shore rims,
the double waterline rings, the dropped shadows of the roofs — and by scale: fields are huge, roofs
are specks, so the eye reads altitude before it reads subject. The braid is the composition's only
linear system; the survey traverses (dotted) are the second; the field polders are a third, each
district rotated a few degrees differently, as if reclaimed by different generations.

**Palette.** Cream paper, straw/pale/ochre/olive fields, one rust accent per district, two water
values (open water and tidal flat), bone for bars and wet sand, ink for the keyline. Water is the
coldest and largest mass; the town is the darkest.
## Pass log

**Pass 1.** Full scaffold: nine polder blocks, braided channels, town, survey marks, grain. Saw
immediately: every field was BLACK. Cause: I had written the palette as *names* (`straw`, `pale`)
and used them as fill values, so librsvg fell back to black. The water channels read as asphalt —
wide, uniform, smoothly curved ribbons with a dashed centre line: a motorway interchange. The
islands were potatoes with a thick white outline (the shore rim was 13 units of solid bone).

**Pass 2.** Fixed the fill lookup. Water lightened, three water values introduced, fields now straw /
ochre / olive with rust accents. Still wrong: the channels were two-tone ribbons with an offset
second stroke, so they read as dual carriageways; the field lattice was a quilt of equal-weight
rectangles; the town was a tidy village plan on a cream grid.

**Pass 3.** Rebuilt the water as a *network*: 16 narrow channels with fine ink banks, oxbows, a
displacement filter to break the mechanical edges, pale sand bars between them, current lines,
mangrove clusters on the shores (instead of evenly spaced beads). Fields got stroke-width variation,
some unoutlined parcels, merged fields and vertical sub-divisions. Town densified. Saw: the channels
now read as pale glass ribbons lying on the water, and the town was still a plan, not a drowned place.

**Pass 4.** Addressed the lead's note: the town's southern third is now *in* the water — a tilted
tide line crosses the street grid, roofs and cream wall-tops break the surface, each roof carries a
bone waterline and a washed reflection, two buildings are only a dashed footprint and a ripple, and
a breach has been cut through the seawall on the south-west. Channels were re-cut as pale ribbons
with ink banks (a map river) and the bars rebuilt as irregular blobs. Saw: the flooded quarter
worked, the pale ribbons did not — glass again, and the oxbow read as a hand-drawn loop.

**Pass 5.** Channels narrowed (7–26), butt caps, no filter; oxbow deleted; the town's flood clusters
rebuilt with wet reflections, foam on the tide line, a church with two roof pitches; fields got a
per-cell vertical split to break the horizontal banding; sea deepened one step. Saw: the braid still
read as grey glass, and the drowned roofs still looked parked.

**Pass 6.** One surgical change — the channels stopped being pale ribbons and became *deep water*:
the same channels now cut darker water through the pale tidal flats, with the ink banks as a fine
double line. That single change made the braid read as water and stopped the road analogy. Grain
and paper tint last. Converged.

## Honest self-critique

- **The field mosaic is still a quilt.** I generated the parcels as rows of rectangles, so they line
  up in long horizontal bands however many sub-divisions I add. A real polder map is irregular at
  the parcel level, and mine is irregular only at the block level. This is the piece's main failure.
- **The braid is legible at 400 px but not quite inevitable at 1600.** Two or three junctions still
  look drawn rather than eroded, and the widest western arm keeps a ribbon quality. I ran out of
  passes before tapering widths with filled polygons, which is what it actually needs.
- **The northern town is tidy.** The dark roofline and the plaza read as a plan; only the flooded
  third has the right weather. The two halves do not quite belong to the same town.
- **The sand bars look like pale leaves.** They are too even in size and too clean in outline.
- **The scale bar is furniture.** It is honest (a survey plate needs one) and it is legible, but it
  sits on the water like a sticker. A cutter would have set it in a reserve; I refused the reserve
  because it would have made a focal point, and the compromise shows.
- What works: the all-over distribution — there is no place the eye can rest and call the subject;
  the drowned quarter with its tide line and wall-tops; the waterline rings around every shore,
  which give the piece its slow cartographic shimmer; the rust accents that keep the pale fields
  from going to sleep.
