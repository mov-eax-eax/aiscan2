# TROPICO 2026
## A collection of vector paintings · República de Trópico, 2026

> *"El sol es la deuda."* — The sun is the debt.

---

## 0. What this is

Seven original vector paintings, hand-authored in SVG and rasterised with librsvg.
One fictional country. One year. Seven entirely different ways of looking at it.

This is not illustration for a video game. It is **reportage from a country that does
not exist and is completely plausible**: eight degrees north, a tourism economy, a
container port, blackouts, a Ministry of the Future that survives mostly as a stencil
on a wall, and a sun that is simultaneously the national resource and the national debt.

The collection is an argument, made seven times in seven visual languages:

> **The near future has already arrived in the tropics. It is being lived in, weathered,
> and made beautiful by ordinary people, and nobody asked them to design it.**

Everything in these paintings is 2026. Nothing in them is science fiction.
Solar panels, remittances, cables, salt bloom, heat, debt, mangoes, a machete, a fan.

---

## 1. Canon — what must recur, however the style changes

These are the collection's recurring notes. A piece does not have to use all of them,
but a viewer moving through the gallery should feel one place, one year, one weather.

**Objects.** mango · machete · tinaco (black water tank) · solar panel + inverter ·
coiled cable · standing fan · satellite dish · azulejo tile · plastic monobloc chair ·
stamped official form · sea wall · exposed rebar · palm · sea grape · frangipani ·
shipping container · oil drum · "24H" sign · salt bloom on concrete · sand in a corner.

**Light.** Two lights only, and they are the same sun:
- **Noon** — vertical, white, merciless, shadows directly under things, air visibly hot.
- **Shutter-light** — a dark interior, one blade of light through a half-closed shutter,
  everything else in tenebrist brown-black.

**People.** Unidealised. Working, waiting, carrying, sweating. In profile, from behind,
half in shadow, or small in the frame. **Never posed for the viewer.** Nobody looks at us.

**Palette.** Limestone white · sea-salt grey · concrete grey-green · mango and frangipani
coral · dusty palm green (never emerald) · oil-drum blue · rebar rust. One accent only:
hot orange **or** cyan — never both.

**Time.** Afternoon, or the moment just after the power cuts. Never night-city neon
except where a piece is explicitly about the grid (05).

---

## 2. The seven pieces

| # | Title | Visual language | Handed to |
|---|-------|-----------------|-----------|
| 01 | **EL INVENTARIO** | Spanish realism / bodegón | maestro |
| 02 | **LA SIESTA DE LOS PECES** | Sorolla light / impressionism | colorist |
| 03 | **PABELLÓN MINISTERIO DEL FUTURO** | geometric abstraction / tropical modernist | vectorista |
| 04 | **EL FUNCIONARIO** | neo-baroque tenebrism / contemporary chiaroscuro | maestro |
| 05 | **LA RED** | post-digital / thermal / surveillance glitch | colorist |
| 06 | **JARDÍN DE DATOS** | cyber-botanical art nouveau | vectorista |
| 07 | **TRÓPICO 2026** | synthesis — the hero panorama | lead |

Round A = 01, 02, 03 (parallel). Round B = 04, 05, 06 (parallel, after critique).
07 is built last by the Lead from what the collection learned.

---

## 3. ITERATION 01 — Spain realism — **EL INVENTARIO**

*Spanish realism is not a style of surface; it is a morality of attention. Velázquez,
Sánchez Cotán, Zurbarán, Ribera, Antonio López García, Isabel Quintanilla: the ordinary
object given the weight of a sacrament, the unidealised body given the dignity of a
portrait, and one light doing all the moral work.*

**The subject.** A still life on a concrete counter inside a shuttered room, at the
hour when the sun crosses the shutter blades. It is the inventory of a household
economy at 2026: **a mango, a jar of instant coffee, a small solar charge controller
with a cable, a machete, a stamped and folded official form, a glass of water, and a
plastic fan blade.** On the wall behind, the light falls in one or two hard blades.

This is a **bodegón** — but the inventory of a country. Every object is a wage, a
dependency, a small system. The painting should be quiet, frontal, grave, and warm.
Nothing is decorative. Nothing is cute. The composition is a ledger.

**Non-negotiables for 01.**
- One light source. Everything else is reflected warmth or falls to near-black.
- A visible **plane change** between wall, counter edge, and counter surface.
- At least one object must be **cut by the frame** — the inventory continues past us.
- Value structure must survive in greyscale: 4 masses (light wall, mid concrete,
  dark ground, near-black), with the mango or the water glass as the single brightest
  event. If you squint, it should still work.
- Spanish realism is **frontal**. Resist dramatic diagonal composition. The dignity is
  in the frontality.
- No text, no logo, no stamp legible enough to read. Suggest, never spell.

**Alternate composition if the above fails:** the same inventory seen from a low
three-quarter angle, counter edge cutting the frame, a doorway of blinding noon behind
and the objects in silhouette against it (contre-jour). Only switch if you can prove
the first reads badly at thumbnail size.

**What would make this piece fail:** a stack of floating objects with same-size shadows;
a fruit rendered as a sphere with a highlight sticker; brown-on-brown with no hue
separation; making it *pretty* instead of *specific*.

---

## 4. Method — iterate visually, in passes

Art is made by looking, not by writing markup. Every piece goes through this loop.
**Minimum three documented passes; the good pieces take five.** Every pass: render,
LOOK at the PNG, write down what is wrong, fix the three worst things.

1. **Silhouette.** Block the composition in three flat values only. Does it read at
   320 px? If not, stop — the composition is wrong, not the rendering.
2. **Value.** Refine to 4–5 value masses. Print/convert to greyscale mentally: is there
   a clear hierarchy, a dominant dark, a clear light?
3. **Hue.** Introduce colour at low saturation, keeping the value map. Check that warm
   light meets cool shadow somewhere (or the reverse) — this is what makes paint live.
4. **Light events.** Speculars, rim light, bounce light, the caustic in a glass. Two or
   three, placed, not scattered.
5. **Material.** Grain, scumble, edge break-up, displacement. Materials must be legible
   by *texture*, not by colour alone: concrete ≠ wood ≠ metal ≠ fruit.
6. **Cold read.** Render at 400 px wide. If the thumbnail does not say "Trópico 2026",
   go back to step 1.

---

## 5. Craft rules for SVG (this medium punishes carelessness)

- Canvas: **viewBox 1600x1200** (4:3 landscape). Render at 1600 wide.
- Standalone, self-contained. No external images, no scripts, no foreignObject, no CSS
  mix-blend-mode (librsvg 2.40 does not support it). No web fonts.
- Every filter needs an explicit generous filter region, or it will clip:
  `x="-25%" y="-25%" width="150%" height="150%"` (use -50%/200% for blurs).
- Edges: soft edges are made with blur, not with opacity. A 0.8–2 px blur on a shape
  reads as paint; a 1.0-opacity hard path reads as clip-art.
- Translucent washes with hard path edges `seam` into visible bands — dissolve them with
  blur ≥ 30 or build them from radial gradients. This is the #1 accidental artefact.
- Grain is the last element, black, opacity 0.12–0.18. See the kit.
- No outlines anywhere. Ever. This is a painting, not an icon set.
- Keep it under ~500 KB; readability of the source matters as much as the render.

Read `tropico-2026/tools/SVG-KIT.md` before writing a single tag. It contains tested
recipes and the artefacts I have already hit, so you don't have to.

---

## 6. Quality bar (the curator scores 1–10 on each; ≥ 34/60 ships)

1. **Composition & value structure** — does it read at thumbnail? is there a focal point?
2. **Light & atmosphere** — one coherent sun, believable air, warm/cool tension.
3. **Material truth** — concrete is concrete; salt is salt; fruit is fruit.
4. **Trópico 2026 legibility** — without the title, is it this country in this year?
5. **Craft of the medium** — no clipping artefacts, no plastic gradients, edges controlled.
6. **Risk** — a decision you can name. Something that could have gone wrong.

**Failure modes to hunt:** flat icon look · plasticky radial gradients · everything in
the middle values · no focal point · filter clipped at canvas edge · silted/polluted
palette · text doing the work the image should do · a beautiful surface with nothing to
say.

---

## 7. Deliverables & file conventions

    tropico-2026/
      BRIEF.md                  this document (Lead owns)
      iterations/
        01-el-inventario/       es-el-inventario.svg  render-*.png  NOTES.md  meta.json
        ...
      curation/                 curator only
      renders/                  Lead-owned final exports
      gallery/                  Lead-owned gallery page
      tools/                    render.ps1, SVG-KIT.md

Each artist writes **only inside their own iteration folder**. The curator writes only
inside `curation/`. The Lead owns `renders/`, `gallery/`, and the root files.

`meta.json` schema:

    { "id":"01", "title":"El Inventario", "style":"Spanish realism / bodegón",
      "artist":"<your name>", "year":2026, "palette":["#..."],
      "techniques":["tenebrist gradient","displacement edge","grain"],
      "statement":"2-3 sentences, first person, about the decision you made." }

`NOTES.md` is the working document: concept, composition decisions, what failed, pass
log (what you saw in each render and what you changed).
