# Tour Eiffel — measured 3D reconstruction (Three.js)

`eiffel-tower.html` is a single-file, procedurally generated model of the Eiffel Tower.
Open it in any WebGL browser (internet needed once, for the three.js CDN module):

    npx serve .          →  http://localhost:3000/eiffel-tower.html
    # or just double-click the file (module + import map work from file://)

## What is modelled

| element | how it is built |
|---|---|
| outer envelope | monotone-cubic (PCHIP) fit through a profile table digitised from the reference elevation, normalised on the documented 124.90 m base |
| 4 pillars | box trusses, 24 panels, 4 boxed corner chords (arbalétriers), dense St-Andrew bracing, transverse ties, cast-iron shoes |
| decorative arches | 4 openwork curved girders (39 m rise / 74.24 m span, circular intrados R ≈ 37.17 m) + spandrel lattice up to the 1st floor |
| 1st floor (57.63 m) | 70.69 m ring deck, edge girders, frieze with the **72 engraved names** (gold, 18 per side), railing, glazed gallery |
| 2nd floor (115.73 m) | 40.96 m deck, frieze, railing, glazed gallery |
| 3rd floor (276.13 m) | 18.65 m deck, railing, gallery |
| shaft | 4 corner box columns + 4 lattice faces with horizontal belts, inclined lifts inside |
| summit | belvédère with glazed band, ribbed campanile dome, lantern, iron mast to 300.65 m, antenna to 330 m |
| lighting | 336-projector night wash, 20 000 scintillation bulbs (GPU points), rotating beacon, bloom |
| ground | Champ-de-Mars style lawn, esplanade, tree lines, sun shadow of the tower |

Press **Dimensions** for live projected measurement labels; **Members** for a wireframe.

## Reference data used

Documented figures (SETE / toureiffel.paris key figures; fr.wikipedia *Données
techniques de la tour Eiffel*, itself sourced from G. Eiffel, *La Tour de 300
mètres*, Paris, Lemercier, 1900):

* total height 330.00 m (2022 antenna); 324 m (2000); iron frame 300.65 m (1889, 300 m without flag), flag 312.27 m
* base 124.90 m outer square, 74.24 m clear gap between opposite pillars, pillar width 25.33 m
* arbalétriers inclined 54° to the ground
* 1st floor 57.63 m / 70.69 m square / 4200 m²; 2nd 115.73 m / 40.96 m / 1652 m²; 3rd 276.13 m / 18.65 m / 350 m²
* decorative arch 39 m high × 74 m wide
* 18 038 iron parts, 2 500 000 rivets, 7 300 t of puddled iron (10 100 t total), 1 665 steps, ground at 33.5 m NGF
* 20 000 bulbs, 336 projectors, 60 t of paint every 7 years

Profile: the outer envelope was recovered by rasterising the Wikimedia technical
elevation drawing (`refs/dimensions.svg` → `refs/dimensions_render.png`), masking
the iron by colour, flood-filling the tower component and sampling its width row by
row (1 px = 0.2407 m, verified against the 330 m height and the 124.90 m base —
the two scales agree to 0.5 %). The resulting table is embedded as `PROFILE` in the
HTML and interpolated with a monotone cubic spline, so the silhouette is anchored
on measurement rather than on a guessed formula.

Structure layout follows Eiffel's own Atlas plates: I (élévation), VIII (pied),
XV (partie supérieure) — boxed corner chords, St-Andrew panel bracing, corner box
columns above the first floor, openwork arch girder, ribbed campanile dome.

The 72 names on the first-floor frieze (raised gold lettering, ~60 cm high,
restored in 1986–87 and repainted in 2010–11) are engraved in the four documented
groups: Trocadéro, École-Militaire, Grenelle and La-Bourdonnais sides.

## Files

* `eiffel-tower.html` — the model (self-contained, ~1 400 lines)
* `refs/` — reference photographs, Eiffel plates, the technical dimension drawing and the digitised profile (`_profile.json`)
* `shots/` — deterministic captures produced by the harness
* `tools/shot.mjs` — headless-Chrome capture harness (SwiftShader WebGL), `tools/extract.mjs` profile digitisation
