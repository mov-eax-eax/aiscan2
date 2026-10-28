# Nativity & Passion façades — build notes

Owner: teammate `facades-np` (task-1). Files owned: `src/facades-np.js`,
`src/facades-np/{kit,nativity,passion}.js`, `qa/facades-np/*`.

## Coordinate system

Local façade space `(u, y, w)`: `u` along the wall, `y` up, `w` outward from the
wall centre plane (wall occupies `w = -0.8..+0.8`, i.e. x = 30.0..31.6 Nativity,
-31.6..-30.0 Passion). The parent groups sit at `x = ±30.8` with `ry = ±π/2`:

* Nativity: local → world `(30.8 + w, y, -u)`, `u = -z`
* Passion:  local → world `(-30.8 - w, y, u)`,  `u = +z`

Door openings follow `DIM.doors.nativity` / `.passion` exactly (9×18 / 9×19
central, 5.5×13 sides at `z = ±12.5`), with a dark reveal lining that only
insets the visible jamb by 13–14 cm — the 9 m walkable gap is untouched.

## What is built

### Nativity (east, `buildNativity`)

* 48 × 45 m wall, 1.6 m thick, with the three exact openings + inner-face
  mouldings so the doors read from inside the transept.
* Deep stepped portal funnels: 5 concentric archivolt rings on the central
  portal (4 on the side portals), each ring carrying small figures, pearl
  beading, a highlight lip and a shadow groove; twisted solomonic columns and
  jamb statues frame each portal mouth; dark threshold + shadow line.
* Carved tympana *inside* the porches above head height: the Nativity scene
  (Mary, Joseph, manger/child, ox, donkey, shepherds, Magi with gold crowns,
  angel, Star of Bethlehem, clouds, vines, chameleon, snails) and the side
  portals' Hope anchor / Faith cross.
* Canopy gables with corbels, crockets, recessed relief, dove/star, and carved
  inscriptions (`PORTA CHARITATIS`, `SPES`, `FIDES`).
* Great rose window r = 5.2 at y = 30 (DIM) with stone surround, dark backing,
  coloured glass, a ring of clouds and six angels; two flanking rose oculi with
  warm glass above the side portals + pediments (SPES/FIDES inscriptions).
* Side relief panels with saints, outer-bay niches at walking height, prophet
  statues on corbels along the frieze, mosaic friezes/pilaster strips,
  climbing vines, carved stars, cloud clusters, gargoyles, corner buttresses
  with mosaic rosettes, pinnacles + ball finials, cornice inscription
  (`ET VERBUM CARO FACTUM EST`), inscription field above the rose
  (`HODIE NATUS EST VOBIS SALVATOR`, `GLORIA IN EXCELSIS DEO`).
* Central gable to ~55.6 m, crockets, recessed carved field with clouds/dove
  and `SANCTUS`, flanking angels, and the Tree of Life: a real flame-shaped
  stone cypress with 12 white doves, pelican piercing its breast, five angels,
  gold stars and a gold cross.

### Passion (west, `buildPassion`)

* Same wall/opening logic but with a sharper pointed arch (`bow 0.6`,
  `pinch 0.72`), angular 4-segment curves, flat-shaded stone.
* Three stepped angular arch orders with square block jambs, heavy angular
  hoods, dark tympana with a stark crucifix + witnesses (`ECCE HOMO`).
* Tall stripped pilasters flanking the portals (3 vertical grooves each,
  stepped capitals), side-portal canopies with wedge brackets, hard projecting
  cornice under the oculus.
* The great oculus r = 6 at y = 30 (DIM): coloured rose glass, two rings of
  angular wedge blocks (18 + 14), 12 long stone rays, inscription
  (`VELUM TEMPLI SCISSUM EST`).
* Via Crucis scenes in hard rectangular frames: Flagellation (column + bound
  Christ + soldier), Crown of Thorns (kneeling Christ, thorn crown, two
  soldiers), Denial of Peter (Peter, maid, rooster), Veronica's Veil (veil
  relief with blocky face + figures), Resurrection above the oculus (tomb
  slab, rising figure, kneeling witnesses), and the empty tomb at ground level
  with rolled stone and witnesses.
* Angular figure niches at walking height (8), vertical stripped ribs,
  slotted "hollow plane" screens, wedge clouds, grey mosaic accents, corner
  buttresses, angular pinnacles, hard triangular gable with angular crockets,
  large cross relief, apex cross and inscriptions (`VIA CRUCIS`,
  `MORS UBI EST VICTORIA TUA`).

## Colliders

* 4 solid wall segments per façade at the wall centre plane, `hw = 0.82`,
  y 0..46; gaps exactly `z = 0 ±4.5` and `z = ±12.5 ±2.75`.
* Circles for the freestanding portal jamb columns/statues (Nativity), the
  portal pilasters and two ground soldiers (Passion), plus the empty-tomb
  masses. Nothing overlaps the open door gaps or the transept floor path.

## Hotspots (8, radius 10–16)

Nativity façade, Portal of Charity, Tree of Life, Portals of Hope & Faith,
Passion façade, Subirachs' Figures, Passion Oculus, Via Crucis.

## Stats (last measured)

* **329,431 triangles, 36 meshes, 33 colliders, 8 hotspots** (simulation harness).
* Built in ~1.2–1.6 s in Node (browser build is in the same range).
* Geometry merged per material bucket (≈14 buckets/façade) + one glass mesh per
  façade + inscription planes (unique canvas textures). Nothing over 400k.

## Collider audit (requested after a reported walk-through at z≈18)

Exact wall colliders (identical for both façades, `ry = 0`):

| façade | x | z centre | hw (x half) | hd (z half) | covers z | y |
|---|---|---|---|---|---|---|
| Nativity | 30.8 | -19.625 | 0.82 | 4.375 | -24.00 … -15.25 | 0…46 |
| Nativity | 30.8 | -7.125 | 0.82 | 2.625 | -9.75 … -4.50 | 0…46 |
| Nativity | 30.8 | 7.125 | 0.82 | 2.625 | 4.50 … 9.75 | 0…46 |
| Nativity | 30.8 | 19.625 | 0.82 | 4.375 | 15.25 … 24.00 | 0…46 |
| Passion | -30.8 | same four z ranges | | | | 0…46 |

Openings (no collider): z = 0 ± 4.5 (9.0 m), z = ±12.5 ± 2.75 (5.5 m).

`simulate.mjs` now imports the **app's own `src/experience/collide.js`** and runs a
capsule (r 0.42, h 1.7, feet y 0) against the real prepared collider set:

* 56/56 solid-band walks blocked from inside **and** from outside, both façades —
  including z = ±18 (and ±17.2, ±20, ±22 …);
* 36/36 door-gap walks pass through;
* a 0.1 m fine sweep across the whole 48 m wall finds clearance *only* inside
  the three door gaps (with a 0.44 m capsule margin) — no unintended gap;
* a coarse 0.5 m/frame sprint at z = ±18 cannot tunnel;
* no collider sits inside a door passage or on the interior floor path.

## Revision 3 (after the integrated visual pass)

* Nativity: archivolt "throats" changed from near-black to dark stone (the black
  banding was too harsh); portal foliage clumps replaced by vines + grape
  clusters; Tree of Life foliage made denser/finer and flat-shaded; cypress grown
  to 18 m / r 2.7 with larger doves; side oculi switched to mixed rose glass.
* Passion: stone pushed decisively cold blue-grey (base 0xa9b1bb, light 0xc4cad2,
  dark 0x626a74, voids 0x252a30, flat-dark 0x565d66) so it no longer reads cream
  in warm afternoon light; additional angular grooves/bosses on the gable and two
  more severe figure niches high on the flanks; scene figures enlarged ~10%.


## Revision 2 (after Lead's "generic Gothic" note)

* **Nativity**
  * Portals rebuilt with a rounder parabolic head (`spring 0.62`, `pinch 0.8`),
    6 nested archivolts on Charity (5 on the sides), each order darkened at the
    throat, with lip highlights + shadow grooves, hanging foliage on the lower
    steps and jamb relief figures climbing the outer jambs — a deep cave now,
    not an applied frame.
  * **Tree of Life is one continuous sculptural vertical**: trunk springs from
    the portal canopy (y≈23), two great branches frame the rose window and
    rejoin at the cypress console (y≈41), then a 17 m stone cypress rises past
    the gable apex to y≈59 with 13 white doves, a large pelican (1.9 m), six
    angels and a gold cross. Wrought in `foliage` stone with leaf clusters,
    twigs and gold stars.
  * Blank fields filled: trencadís mosaic bands (y 26.9 / 37.7 / 9.7 / 43), a
    vine frieze with grapes, six angel groups on corbels (y≈41.8), extra niches
    (each side, at three heights), animal reliefs beside the rose, carved
    animals on the plinth, angel busts, parapet statues, extra pinnacles, a
    ragged eroded crest, and scattered eroded stone outcrops across the upper
    wall.
  * Warmer/darker stone palette with more tonal spread; portal reveals almost
    black. Doors remain exactly 9 × 18 / 5.5 × 13 and passable.
* **Passion**
  * Colder blue-grey stone palette (base = PALETTE.stonePassion, cool lights and
    blue-black shadows) to separate it decisively from the Nativity.
  * Rich oculus: brightened 20-petal glass (vertex colours ×1.5 so it reads by
    day), plus stone tracery — two concentric rings, 12 radial lead bars and 24
    bosses over the glazing.
  * Stripped angular language: two full-height blades flanking the main portal
    (with colliders), two further upper blades, deep angular hollows high on
    the flanks, vertical dark shadow slots.
  * Via Crucis frames deepened to 0.82 m with dark inner shadow reveals and a
    projecting angular hood over every station → hard, deep shadows; two extra
    severe figures above the outer pilasters; inscriptions `STABAT MATER
    DOLOROSA` / `VIA DOLOROSA` added.

## Static/runtime validation (no browser needed)

`qa/facades-np/audit.mjs` — verifies every `K.*` reference resolves against the
kit, every lib import/re-export exists, every geometry bucket has a material and
there are no duplicate kit exports.

`qa/facades-np/simulate.mjs` — runs the real builder in Node with a minimal canvas
stub (loader maps `three` to the vendor build). It asserts:
* no NaN vertices, no vertices below the floor,
* no geometry inside any door passage (25 cm–10.5 m/13.6 m prism through each
  opening),
* no collider intersects a door passage or the interior floor path,
* hotspots have valid fields, radius 10–16 and are reachable from the pavement,
* prints triangle/mesh counts and world bounds.

Latest run: `OK` — 321,687 tris, 36 meshes, 0 NaN, 0 door violations, 33
colliders, 8 hotspots, no collider in a door or on the interior path.

## QA harness

`qa/facades-np/preview.html?view=<id>` (import map → three, scene with sun /
hemisphere / shadows / ground). Views: `nativity`, `nativity-portal`,
`nativity-upper`, `nativity-oblique`, `nativity-doors`, `passion`,
`passion-portal`, `passion-oculus`, `passion-oblique`, `passion-doors`, `both`.
Add `&night=1` for the glass glow, `&pos=x,y,z&look=x,y,z` to override.
`preview.html` logs `[facades-np-stats]` JSON and sets `window.__ready` after
20 frames. Lead's shared `qa/shot.mjs` drives screenshots; only run one
browser at a time (machine constraint).

Screenshots from the first pass: `nativity.png`, `nativity-portal.png`,
`nativity-upper.png`, `passion.png`. Revision 2 needs one final capture set.

