# TROPICO 2026
### A collection of vector paintings · República de Trópico, 2026

Seven original artworks, hand-authored in SVG and rasterised with librsvg. One fictional
Caribbean republic. One year. Seven entirely different ways of looking at it.

**Open the exhibition:** `gallery/index.html` in a browser.
**The images alone:** `renders/` (1600 px, plus the hero at 2400 px).
**The source:** `iterations/<n>-<slug>/<slug>.svg` — every piece is editable text.

---

## The fiction

Eight degrees north. A tourism economy, a container port, blackouts, a Ministry of the
Future that survives mostly as a stencil on a wall, and a sun that is simultaneously the
national resource and the national debt. Nothing in these paintings is science fiction;
everything in them is 2026 — solar panels, remittances, cables, salt bloom, heat, debt,
mangoes, a machete, a fan.

> *"El sol es la deuda."* — The sun is the debt.

## Three rooms

1. **Trópico 2026** — one country in seven styles (`gallery/index.html`) — 7 works
2. **VARIEDADES** — eight composition archetypes (`variedades/index.html`) — 8 works
3. **ESTRATOS** — ten systems, each meant to be read at three distances (`estratos/index.html`) — 10 works
4. **MULTITUDES** — ten crowded scenes with four depth planes and simultaneous stories (`multitudes/index.html`) — 10 works

35 works total.

## The seven works

| # | Title | Language | Artist |
|---|-------|----------|--------|
| 01 | **El Inventario** | Spanish realism / bodegón | maestro |
| 02 | **La Siesta de los Peces** | Sorolla light / impressionism | colorist |
| 03 | **Pabellón Ministerio del Futuro** | geometric abstraction / tropical modernism | vectorista |
| 04 | **El Funcionario** | neo-baroque tenebrism | maestro |
| 05 | **La Red** | post-digital thermal / surveillance | colorist |
| 06 | **Jardín de Datos** | cyber-botanical art nouveau | vectorista |
| 07 | **Trópico 2026 (Retablo)** | three-ink screenprint — synthesis | lead |

## Structure

    BRIEF.md              the art direction: premise, canon, rubric, craft rules
    FINAL.md              the catalogue: scores, statements, what the iteration taught
    iterations/           one folder per work: svg + render + notes.md + meta.json
    curation/             the critic: REFS, RUBRIC, CRITIQUE-A/B, DIRECTION-B, SCORES.json
    renders/              flattened PNGs for the gallery + contact-sheet.jpg
    gallery/              the exhibition page (index.html + pieces.js)
    tools/                render.ps1, SVG-KIT.md, build-gallery.js, contact-sheet.ps1

## How it was made

Three artists and one curator worked from `BRIEF.md` and `tools/SVG-KIT.md`. Every piece
was rendered and *looked at* repeatedly — each artist's `notes.md` records what was wrong
in each pass and what was changed. The curator scored the first round against a written
rubric (`curation/CRITIQUE-A.md`); each round-A piece then went back for one targeted fix
pass on the fault the critic named. Round B added three new visual languages, and the
collection closes with a synthesis print.

The medium is the constraint and the subject: everything here is vector geometry, gradients,
filters and patterns — no photographs, no raster assets, no text doing the work. Rasterising
is done with librsvg (+ ImageMagick) so the render matches what a browser shows.

## Rebuild

    node tools/build-gallery.js                 # collect renders + write gallery/pieces.js
    pwsh -File tools/contact-sheet.ps1          # contact sheet of all renders
    pwsh -File tools/render.ps1 -Svg <file.svg> # single render at 1600 px

Everything is offline and self-contained. No external assets, no fonts, no scripts
inside the artworks.
