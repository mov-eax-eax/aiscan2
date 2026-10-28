# THE STORM — Acts 27:13–44

A long-form 3D retelling of Paul's voyage and shipwreck: the soft south wind,
the Euroclydon, fourteen nights of storm, the anchors, the boat cut away, the
bread, the grounding, and the escape to Melita. About **3 minutes 45 seconds**,
told in thirteen narrated beats.

Everything is procedural: the shader ocean, the ship and its rig, the crew,
rain, lightning, spray, the island and the dawn. No external assets and no
network calls — Three.js r158 is vendored locally.

## Open it

Double-click **`index.html`** (or drag it into a WebGL browser). Works offline;
no server needed. Sound starts on BEGIN (browsers require a click before audio).

## Controls

| Input | Action |
|---|---|
| **BEGIN** | Start |
| **Space** | Pause / resume |
| **M** | Mute |
| **R** | Restart |
| **F** | Fullscreen |
| Bottom-right buttons | Pause · Sound · Fullscreen |

## Chapter map

| Time | Beat | Text |
|---|---|---|
| 0:00 | Title | — |
| 0:07 | The south wind — under full sail | Acts 27:13 |
| 0:24 | Euroclydon — sail struck, sea rises | Acts 27:14–15 |
| 0:46 | Lightening the ship — cargo overboard | Acts 27:18–19 |
| 1:02 | No sun nor stars — the crew gives up | Acts 27:20 |
| 1:17 | Be of good cheer — Paul speaks | Acts 27:22, 23–25 |
| 1:47 | The fourteenth night — soundings and four anchors | Acts 27:27–29 |
| 2:06 | The boat — soldiers cut the ropes | Acts 27:30–32 |
| 2:21 | Bread — Paul gives thanks and eats | Acts 27:33–36 |
| 2:43 | The wheat into the sea | Acts 27:38 |
| 2:54 | The creek — the ship runs aground | Acts 27:39–41 |
| 3:16 | All safe to land — swimmers and planks | Acts 27:42–44 |
| 3:35 | Melita — the fire on the beach | Acts 28:1 |
| 3:45 | The End | — |

## What is on screen

- A 30-unit wooden ship with a full rig: hull, deck and gunwales, stern cabin,
  mast and yard, a billowing and furling sail, rigging, three lanterns, crates,
  sacks, a deck boat and four anchors.
- Seven crew figures — six sailors and a centurion — plus Paul, posed and lit by
  the deck lanterns. They brace, pull, throw cargo, slump, gather around Paul,
  eat, and finally swim.
- A shader sea built from five summed waves with analytic normals, fresnel sky
  reflection, glints, crest foam, manual tone mapping and distance-smoothed
  normals. The same wave function drives the ship's heave, pitch and roll.
- Weather: 2,400 rain streaks, bow spray, splash bursts, rolling cloud sprites,
  and lightning that flares the sky, lights the sea and schedules delayed thunder.
- Dawn: the fog, sky, sea palette, sun glow and warm key light all cross-fade
  from storm to sunrise as the ship approaches the island.

## Under the hood

- `index.html` — page shell, typography, captions, HUD, start/end cards.
- `app.js` — renderer, ocean shader, ship and crew builders, weather, particles,
  the 13-beat timeline, camera choreography, and the synthesized WebAudio score
  (wind gusts, sea rumble, rain hiss, wood creaks, thunder, a low drone and an
  A-minor pad for the hope beats).
- `vendor/three.min.js` — Three.js r158 (MIT), vendored so the page opens from
  `file://` without a CDN.

## Stills and testing hooks

- `index.html?t=120&still=1` — fast-forward to 120 s, render one frame, hold it.
- `index.html?autostart=1` — begin automatically (silent, since there is no user
  gesture).

`previews/` holds the stills used while checking the piece.

## Text

Scripture is the **King James Version (1611)**, public domain. The quoted verses
are reproduced verbatim; only line-break artifacts from the source text were
normalized to spaces. Quotation marks around the verses are decorative.

Quoted: Acts 27:13, 14–15, 18–19, 20, 22, 23–25, 27–29, 30–32, 33–36, 38,
39–41, 42–44; Acts 28:1.

> Note: modern translations (NIV, ESV, NASB, NLT) are still under copyright and
> are not used here; the KJV is public domain.
