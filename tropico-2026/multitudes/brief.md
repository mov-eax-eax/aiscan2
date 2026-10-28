# MULTITUDES — fourth room
### Ten scenes. Crowds, depth, simultaneous stories.

The first three rooms built single subjects, then changed arrangement, then added nested systems.
This room is about **scenes**: many figures, several planes, more than one thing happening at once,
and a picture you can walk into for ten minutes.

Density is the assignment. But density is not clutter: every figure has a role, and every cluster
answers to a rule.

## Complexity floor (mandatory)

- **At least 50 figures or discrete objects in the scene** (people, animals, vehicles, stalls,
  machines). Not decorative specks: each needs a readable role at middle distance.
- **At least 4 depth planes**: foreground (large, cropped, often silhouetted), near-middle,
  far-middle, background (architecture / horizon / sky). Atmospheric perspective between them.
- **At least 3 simultaneous actions** happening in different parts of the frame, with no
  indication of which one we are supposed to watch.
- **A crowd logic**, stated as a rule: e.g. every seventh figure is a child; the market recedes in
  bays of three stalls; the crowd thickens toward the vanishing point; one red hat recurs.
- **A find-it thread**: one small motif repeated exactly N times (say 7-12), never announced,
  discoverable only by looking. The caption must not list them.
- **Architecture that recedes**: a consistent eye level and a convincing depth structure. No
  floating bands.
- **Value discipline**: even in a busy frame, the four value masses must survive a squint, and the
  densest area must not be the brightest area unless that is the point.

## The three-distance test (still)

FAR (400 px): a place, a mood, one dominant structure. If it reads as noise, it fails.
MIDDLE (1600 px): the simultaneous stories; you should be able to follow three of them.
NEAR (100%): individual characters with poses, faces suggested by shape and light, objects in hands.

## Thinking budget

- **Before drawing**: write the argument, the crowd rule, the find-it motif and its count, and a
  list of the three simultaneous actions. Then build.
- **10 to 14 passes.** Render and look after each. Checkpoints at pass 4 and pass 9: what the
  far / middle / near readings are, and where the eye actually goes.
- Build the scene in layers: ground plane and architecture first, then crowd masses, then
  incidents, then light and atmosphere last. Never detail before the value structure works.
- Generate crowds procedurally if it helps (variation by seed), but hand-place every incident that
  the picture is actually about.

## Deliverables per piece

    multitudes/<id>-<slug>/<slug>.svg
    multitudes/<id>-<slug>/render-<slug>.png       1600 px
    multitudes/<id>-<slug>/notes.md                argument, crowd rule, find-it motif + count,
                                                   three actions, 10-14 pass log, checkpoints, critique
    multitudes/<id>-<slug>/meta.json               id, title, idiom, scene, crowdRule, findIt,
                                                   readings {far,middle,near}, palette, techniques,
                                                   statement, artist

## The ten scenes

| # | Work | Idiom | Scene |
|---|------|-------|-------|
| M1 | La Feria | Bruegelian village panorama | a town square on festival day: market, procession, children, a windmill, a fight |
| M2 | El Puente | ukiyo-e crowd print | a bridge in the rain, forty people crossing, boats below, a festival on the far bank |
| M3 | El Hotel | cutaway / dollhouse | a six-storey hotel with every room visible at once, twenty simultaneous lives |
| M4 | La Torre | Bruegelian construction | a tower under construction: scaffolds, cranes, hundreds of workers, the city below |
| M5 | El Puerto | harbour panorama | a container port at shift change: cranes, ships, crowds, a fire in the distance |
| M6 | El Jardín | Mughal miniature | a walled garden durbar: musicians, elephants, courtiers, water channels, a drone |
| M7 | La Caza | millefleurs tapestry | a hunt across a flowering field, castle, hounds, dozens of animals |
| M8 | El Jardín de los Datos | Boschian garden | a garden of devices: people tending servers, machines growing, animals with antennas |
| M9 | El Mural | social-realist mural | a crowded street mural: workers, machines, history, a crowd that faces the viewer |
| M10 | El Mercado | night market scene | a market street at night: stalls, crowds, bulbs, smoke, wet ground, reflections |

No two scenes may share a depth structure. No idiom may repeat from the first three rooms.
