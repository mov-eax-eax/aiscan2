# THE FOUR HORSEMEN — Revelation 6:1–8

A self-contained 3D animated retelling of the opening of the first four seals
(Revelation 6:1–8, King James Version). About 88 seconds, told in four
seal-breaks and four riders, ending with the four horsemen together.

Everything is procedural: the scroll, wax seals, horses, riders, props, dust,
embers, sky and sound are generated at runtime. No external assets, no network
calls — three.js r158 is vendored locally.

## Open it

Double-click **`index.html`** (or drag it into a browser). A WebGL-capable
browser is required (Chrome, Edge, Firefox, Safari). No server is needed and it
works offline.

Sound starts on BEGIN (the browser requires a click before audio is allowed).

## Controls

| Input | Action |
|---|---|
| **BEGIN** | Start |
| **Space** | Pause / resume |
| **M** | Mute / unmute |
| **R** | Restart |
| **F** | Fullscreen |
| Bottom-right buttons | Pause · Sound · Fullscreen |

## Chapter map

| Time | Scene | Text |
|---|---|---|
| 0:00 | Title over the night sky | — |
| 0:07 | The First Seal breaks | Revelation 6:1 |
| 0:12 | The White Horse (bow, crown) | Revelation 6:2 |
| 0:23 | The Second Seal | Revelation 6:3 |
| 0:27 | The Red Horse (great sword) | Revelation 6:4 |
| 0:38 | The Third Seal | Revelation 6:5 |
| 0:42 | The Black Horse (balances) | Revelation 6:5–6 |
| 0:55 | The Fourth Seal | Revelation 6:7 |
| 0:59 | The Pale Horse (Death; Hell follows — embers) | Revelation 6:8 |
| 1:12 | The four horsemen | Revelation 6:8 |
| 1:28 | The End | — |

## How it is built

- `index.html` — page shell, typography, captions, HUD, start/end cards.
- `app.js` — the whole sequence: renderer, procedural parchment/scroll with
  seven wax seals, a parametric horse rig (body, legs, mane, tail, saddle,
  rider, props), camera choreography, dust/spark/ember particles, the
  four-seal timeline, and the synthesized WebAudio score (wind, low drone,
  hoofbeats, seal-break booms).
- `vendor/three.min.js` — Three.js r158 (MIT), vendored so the page opens
  from `file://` without a CDN.

### Stills / testing hooks

The renderer accepts two query parameters used to produce still frames:

- `index.html?t=42&still=1` — fast-forward the sequence to 42 s, render one
  frame and hold it (no intro, no audio, no animation). Handy for screenshots.
- `index.html?autostart=1` — begin automatically (used for automated capture;
  audio stays silent because there is no user gesture).

`previews/` contains stills captured this way.

## Text

All quoted scripture is from the **King James Version (1611)**, which is in the
public domain. The wording is reproduced verbatim; only line-break artifacts
from the source text were normalized to spaces. Quotation marks around the
verses are decorative.

- 6:1 "And I saw when the Lamb opened one of the seals, and I heard, as it were
  the noise of thunder, one of the four beasts saying, Come and see."
- 6:2 "And I saw, and behold a white horse: and he that sat on him had a bow;
  and a crown was given unto him: and he went forth conquering, and to conquer."
- 6:3 "And when he had opened the second seal, I heard the second beast say,
  Come and see."
- 6:4 "And there went out another horse that was red: and power was given to him
  that sat thereon to take peace from the earth, and that they should kill one
  another: and there was given unto him a great sword."
- 6:5 "And when he had opened the third seal, I heard the third beast say, Come
  and see. And I beheld, and lo a black horse; and he that sat on him had a pair
  of balances in his hand."
- 6:6 "And I heard a voice in the midst of the four beasts say, A measure of
  wheat for a penny, and three measures of barley for a penny; and see thou hurt
  not the oil and the wine."
- 6:7 "And when he had opened the fourth seal, I heard the voice of the fourth
  beast say, Come and see."
- 6:8 "And I looked, and behold a pale horse: and his name that sat on him was
  Death, and Hell followed with him. And power was given unto them over the
  fourth part of the earth, to kill with sword, and with hunger, and with death,
  and with the beasts of the earth."

> Note: modern translations (NIV, ESV, NASB, NLT) are still under copyright and
> are not used here; the KJV is public domain.
