# VARIEDADES — second room
### Eight works. Eight composition archetypes. Eight themes.

The first room (TROPICO 2026) was one country in seven languages. This room is the opposite
exercise: **change the composition before you change the palette.** Every piece below is locked
to a different way of arranging a picture, and to a different subject. If two works in this room
share a skeleton, one of them is wrong.

## The eight archetypes

| # | Work | Composition archetype | Style | Theme |
|---|------|----------------------|-------|-------|
| V1 | La Persecución | extreme diagonal, dutch tilt, figure cropped at edge | expressionist woodcut, 2 inks | a rooftop chase at 5am |
| V2 | Manifiesto del Agua | type-as-image, letters as shapes | constructivist / Swiss poster | a water-rights manifesto, 2031 |
| V3 | Delta | all-over aerial topography, no horizon | cartographic realism / woodblock flat colour | a drowned coast, 2100 |
| V4 | Un Día | 4×6 contact-sheet grid — the grid IS the composition | monochrome photographic | one day on one city block |
| V5 | La Tormenta | circular medallion inside a vertical card | art nouveau + ex-voto / tarot | a hurricane as a saint |
| V6 | Ciudad / Selva | double exposure, two images superimposed | 1960s psychedelic screenprint | the jungle growing through the city |
| V7 | Polilla | extreme macro, fills the frame, no background | photorealist macro painting | bio-digital: a moth whose scales are circuits |
| V8 | Observatorio | silhouette against void, 85% sky | minimal symbolist poster | desert astronomy, 2040 |

## Rules of the room

- **Composition is the assignment.** The archetype is not a suggestion; if the piece could be
  re-laid-out into the same "subject band across the lower third" skeleton the first room used,
  it has failed.
- **No shared canon.** These are not Trópico pieces. New worlds, new objects. The only thing
  shared is the medium: hand-authored SVG, self-contained, 1600×1200 (V5 is 1000×1500 portrait).
- **Each piece must be readable as its archetype at 400 px**: you should be able to say "that's
  the aerial one" / "that's the type poster" / "that's the contact sheet" without reading a caption.
- **Text**: V2 is the only piece allowed letterforms, and they must be drawn as vector paths —
  no <text> element, no font dependency.
- **Craft**: no outlines unless the style demands them; no plastic radial gradients; every filter
  gets a generous region; grain last. See ../tools/SVG-KIT.md.

## Deliverables per piece

    variedades/<id>-<slug>/<slug>.svg        self-contained, viewBox as specified
    variedades/<id>-<slug>/render-<slug>.png 1600 px
    variedades/<id>-<slug>/notes.md          concept, pass log, self-critique
    variedades/<id>-<slug>/meta.json         id, title, style, theme, artist, year, palette,
                                             techniques, statement, composition

Render:  & 'F:\repo-aiscan2\tropico-2026\tools\render.ps1' -Svg '<abs svg>' -Width 1600
Look at the PNG after every pass. Minimum three passes, maximum six. Converge.
