# VARIEDADES — second room

Eight works, eight **composition archetypes**, eight themes. The first room
(`../gallery/index.html`) was one country in seven styles; this room changes the
*arrangement* before the palette.

| # | Work | Composition | Style | Theme |
|---|------|-------------|-------|-------|
| V1 | La Persecución | extreme diagonal, 20° roll, figure cropped at knee | expressionist woodcut, 2 inks | rooftop chase, 5am |
| V2 | Manifiesto del Agua | type-as-image, letters as shapes | constructivist poster | water-rights manifesto, 2031 |
| V3 | Delta | all-over aerial topography, no horizon | cartographic / woodblock flat colour | drowned coast, 2100 |
| V4 | Un Día | 4×6 contact-sheet grid, the grid is the composition | monochrome photographic | one day on one city block |
| V5 | La Tormenta | circular medallion in a vertical card | art nouveau + ex-voto | a hurricane as a saint |
| V6 | Ciudad / Selva | double exposure, phase boundary as mask | psychedelic screenprint | jungle growing through the city |
| V7 | Polilla | extreme macro, fills the frame, no background | photorealist macro | bio-digital moth |
| V8 | Observatorio | silhouette against void, 85% sky | minimal symbolist poster | desert astronomy, 2040 |

Open `index.html` (or the served URL). Source, render, notes and metadata live in each
`v<n>-<slug>/` folder. Rebuild the page with:

    node tools/build-variedades.js

The one rule of the room: no two pieces may share a skeleton, and each must be
recognisable as its archetype at 400 px without a caption.
