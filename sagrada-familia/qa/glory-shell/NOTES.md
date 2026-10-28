# Glory façade + outer shell — build notes, QA views

Builder: `src/glory-shell.js` → `buildGloryShell(ctx)`.
Modules: `src/glory-shell/{kit,windows,ornaments,glory-facade,nave,apse}.js`.
Preview: `qa/glory-shell/preview.html` (imports only this builder + a simple
sky/ground/sun/shadow rig). App: `http://127.0.0.1:8141/`.

## What is built

**Glory façade** (z = 45..46.6, x = −24..24, wall 45 m, attic 52.5, gable apex ~60.5)
- Wall is a single pierced panel (`panelGeoWithHoles`) with the three open doors
  (DIM.doors.glory at x = 0 / ±12), the two blind doors (x = ±19) and a real
  circular opening for the rose window (r = 7.8 at y = 30.5).
- The central portal is split into three leaves by two carved trumeaux, so the
  façade reads as **seven doorways** (3 + 2 + the triple main portal).
- Stepped archivolts: 3 rings (main), 2 (side), 1 (blind), each with a stone
  colonnette tube, mosaic fillet and gold line. Porch projects ~1.2 m.
- Sculpted tympana (saints + angels + clouds + gilded dove) over stone lintels.
- Seven virtues: six canopied niches across the piers, Charity on the attic.
- Rose window: 16 petals, warm + rose palette, real hole, mosaic/gold outer
  rings, stone bosses; plus two small roses, two wing oculi, an attic oculus and
  a gable oculus.
- Angels flank the rose and the gable; stone cloud banks; gold dove + finial orb.
- Inscriptions: `GLORIA IN EXCELSIS DEO`, `SANCTUS · SANCTUS · SANCTUS`,
  `HOSANNA · FILI DAVID` (on the main lintel).
- Crown: coping + balustrade, wing attic gables with crockets and finials,
  attic corner pinnacles, flanking pinnacle turrets, corner turrets.
- Flush mosaic apron and stone thresholds (plaza is at y = −0.055, walk stays
  at y ≈ 0) — no step at the doors.

**Nave shell** (x = ±15..16.2, two wall segments per side at |z| = 15..45)
- `wallWithOpeningsGeo` walls, rotated ±π/2, pierced by the DIM clerestory
  windows (y 24..39) and aisle windows (y 9..18); glass cool on +X, warm on −X.
- Window layers: splayed surround, tracery, coloured shards, dark backing panel,
  inner tracery ring (for the view from inside), sill.
- Buttress-chapels at z = ±24 / ±36 with steep tiled roofs (29.8..32.4), cornice,
  blind arcading, canopied saint niches, superior pinnacle.
- Base plinth, string courses, corbel table, wall-head cornice; corner piers at
  the transept junctions; saint niches between the aisle windows.
- All ground-standing masses are sunk ~0.3 m (the plaza is at y = −0.055).

**Transept shell** (z = ±15, x = ±15..30.2)
- Two high lancets + rose oculus per segment, lower blind arcade, base plinth,
  string courses, corbel table, cornice, and three stepped buttresses with
  niches and pinnacles per segment. Crossing (|x| < 15) is left completely open.

**Apse exterior** (centre (0, −45), r = 16.2, angles π..2π, height 40)
- Curved wall built as an extruded annular sector (watertight), base plinth,
  cornices, mosaic band.
- Seven radial chapels to r = 22.5 with axial lancets, stepped/conical roofs,
  gold finials, side pilasters and mosaic bands.
- Eight radial buttress fins with pinnacles; seven blind lancets above the
  chapel roofs; crown pinnacles on the wall head.
- Above y ≈ 41 the footprint of the Virgin tower (0, −52, baseY 45) is left
  completely clear — the roof/lantern transition belongs to `towers.js`.

## Coordination decisions (agreed with the Lead)

- Nave outer walls only for |z| ≥ 15 (config updated), so the transept arms stay
  open to the crossing. `DIM.clerestory/aisleWindows` coords are read from
  config, including the ±19.4 corner windows.
- The Glory apostle towers sit behind the façade (z = 41); the façade wall and
  its attic/gable (to ~60.5 m) hide their bases from the plaza. Wing masses at
  |x| > 15 are partly embedded in the ground-standing outer towers by design —
  they exist to close the shell and are not visible from the plaza.
- The Virgin tower rises from y = 45 over the apse; nothing is built above 41 in
  its r ≈ 8 footprint.

## Final QA fixes (after Lead's first integrated capture)

1. **Rose window luminance.** Fixed a real bug: the window kits (`lancetWindowParts`,
   `roseWindowParts`, `oculusParts`) already bake a per-pane vertex colour, but the
   region merge was re-colouring the whole merged geometry with one dark backing
   value — flattening every window to a single near-black hue. Glass parts that
   arrive pre-coloured are now kept intact and boosted (rose ×3.1, side windows
   ×1.7/1.8, apse ×1.9) in linear space; only plain backing panels are flat-filled,
   with a brighter warm field behind the rose. The rose now reads as multi-coloured
   fired glass (16 petals cycling deep reds, gold, purple, teal) from across the plaza.
2. **Richer lower façade.** Deeper stepped archivolts (0.7 / 1.06 / 1.42 m), dark
   shadow fields behind every tympanum relief, dark jamb linings + lintel soffits in
   the open passages, four colossal saints on plinths flanking the portals, two
   recessed saints in the narrow bays between the main and side porches, two glazed
   trencadís medallions below the rose, and `BAPTISMUS` / `PAENITENTIA` labels over
   the blind doors.
3. **Side/apse shell relief.** Blind window galleries above the clerestory and the
   transept high lancets, blind lancets in the blank transept mid-band, a slim
   buttress in the free bay above the aisle roofs, corbel + cornice tops aligned to
   y≈44.35 so the towers builder's eave parapet lands directly on them, and
   terminated transept wall ends at x = ±30 (pier + cornice + blind arch). Apse
   crown pinnacles removed (the towers builder's apse roof cone + rim pinnacles own
   that line); apse fin pinnacles lowered to clear the roof cone.
4. **Watertight / passable.** No duplicate geometry at the transept ends; corners
   remain overlapped (no coplanar faces); the three Glory doors stay open with
   porch-band colliders only beside the walks, and the tympanum colliders sit above
   lintel height.

## Local-frame translation bug fix + offline geometry audit

A ray audit by the interior builder found that the main Glory wall panel was
added in its local XY frame (`panelGeoWithHoles` is centred on z = 0) and was
therefore standing at z ≈ -0.8..0.8, slicing through the crossing. Fixed in
`glory-facade.js`:

- wall panel now translated onto the façade plane: `wallPanel.translate(0, 0, Z)`
  with `Z = 45.8` (wall centre) → **world z = 45.00..46.60**;
- the new audit found two more instances of the same class and they are fixed:
  the rose mosaic/gold outer annuli were missing `y: 30.5` (they sat at
  y ≈ -9.8..9.8) and the wing roof slabs were missing `x: cx` (centred on the
  façade centre instead of the wings);
- `glory-shell.js` now asserts the merged `gs:glory` mesh has `min.z > 40` at
  build time and logs the wall z range (console.error on regression).

Offline audit (real three.js geometry, headless canvas stub, no browser/GPU):

    node qa/glory-shell/audit.mjs      # prints AUDIT PASSED, exit 0

It asserts:

- Glory façade: every geometry at z > 40; nothing behind the wall inside
  |x| < 14.6; nothing below y = -2.2; wall panel exactly z 45.00..46.60;
- rose glass keeps per-pane colour variety (265 distinct colours ≥ 6);
- nave/transept: no geometry wholly inside the central temple volume;
- apse: max.z < -40 (stays north of the crossing);
- merged build: Glory wall z-range, ≤ 450k triangles, ≥ 6 hotspots, colliders
  present, walkables empty.

Current numbers: 232,270 triangles in 22 merged meshes, 4 glass meshes,
122 colliders, 10 hotspots. Glory-material family z-range 45.00..47.96; whole
façade builder z-range 43.17..53.10 (the 43.17 low end is the wing back ribs,
intentionally behind the wall).

## Suggested QA views (sequential, one browser)

App (`qa/shot.mjs`, GPU path):
1. Plaza, whole face: `?debug=1&skipSplash=1&mode=fly&pos=0,25,105&look=0,30,45`
2. Portal close-up: `?…&pos=0,4,55&look=0,12,45`
3. Nave east wall: `?…&pos=45,20,20&look=16,24,26`
4. Apse from north: `?…&pos=0,22,-92&look=0,22,-58`
5. Corner watertight check: `?…&pos=56,28,58&look=16,26,42`
6. Inside the door looking back: `?…&pos=0,2,30&look=0,14,46`
7. Night: `?…&time=21.5&pos=0,22,95&look=0,30,45`

Preview page (same views, faster to isolate this builder):
`qa/glory-shell/preview.html?pos=…&look=…&fov=…&time=…` then
`node qa/shot.mjs "<url>" "F:/repo-aiscan2/sagrada-familia/qa/glory-shell/<name>.png" 6000`

## Known limits / follow-ups

- The façade top relies on the towers builder for the skyline behind it; the
  nave wall head (y = 45) is open until `towers.js` adds the nave/transept roofs
  and the apse roof/lantern.
- The Glory wing backs (z < 45, |x| > 15) are deliberately simple — they are
  hidden behind the tower shafts.
- Triangle budget of this builder alone was ~190 k before the final polish pass;
  re-check with the console line `[glory-shell] built … triangles`.
