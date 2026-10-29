# Xenosphere — Alien Park 04

A modular Three.js **alien entertainment park**, built from scratch and pushed through an extended RSI run with a dispassionate critic. Phase II asks the alienologist’s questions: what is the scale, what is entertainment for six body plans, and which parts of the park are organic, mechanical, or deliberately unknown?

The park is a floating terraced island: a glowing bloom tower, six embassy pavilions, a halo wheel, a skyway, a drop tower, a carousel, a resonance stage, crowds, waterways, grazers, drones, sky mantas, a foreground approach causeway and the unclassified Quiet Object. It is procedural, self-contained and does not use external image, model or audio assets.

## Run

From the repository root:

```bash
node gallery/serve.mjs 8150
```

Open:

```text
http://127.0.0.1:8150/gallery/alien-park4/
```

Or use the root `Open 3D Gallery.bat` and follow the gallery.

## Controls

- **Drag** — orbit the island
- **Wheel** — zoom
- **Auto orbit** — continuous camera orbit
- **View** — cycle island / crown / promenade inspection presets
- **Park guide ↗** — scale, attractions, ecology, materials and open questions
- **Process ↗** — the complete RSI run board, with every cycle render and critique

## Structure

```
index.html              shell + import map + park guide
css/style.css           HUD, guide, process archive, responsive layout
js/world.js             renderer, camera, lights, orbit controls
js/sky.js               CSS-backed sky, stars, moons, aurora shaders
js/terrain.js           island, terraces, cliffs, water, causeway
js/architecture.js      bloom crown, pavilions, halo wheel, transit, gate
js/nature.js            flora, waterfalls, crowds, mist, sky mantas
js/ecosystem.js         organic grazers, mechanical drones, unknown object
js/attractions.js       skyway, drop tower, carousel, stage, tickets, fireworks
js/textures.js          procedural stone / panel / organic / unknown detail
js/process.js           shared run board
js/main.js              assembly + UI + QA hooks
ALIENOLOGY.md           field notes, scale, open questions
BOARD.md                human/agent coordination board
cycles/critic-01.md     independent critic pass
shots/cycle-00..20.png  one render per cycle
vendor/three.module.min.js
```

## RSI loop

Every cycle follows the same discipline:

1. Render the current park.
2. Inspect the pixels, not the intention.
3. Write a dispassionate critique.
4. Choose one highest-leverage move.
5. Implement, re-render and record.

The process overlay in the app is the archive. `BOARD.md` and `js/process.js` are the shared board. Cycle 12 is an intentional failure: the volumetric-light pass produced black wedges and a frame-rate drop, and was reverted in cycle 13.

## QA hooks

`window.__ready` is `true` once the park is assembled. `window.__app.getStats()` returns live `fps`, draw calls, triangles, geometries and textures. The page is designed for the gallery’s GPU QA harness.
