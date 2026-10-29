# Attribution and licences

## 1. `src/eiffelTower.js` — MIT (derived work)

`buildEiffelTower()` and `EIFFEL_OFFICIAL_DIMENSIONS` are taken verbatim from
lines 512–1899 of `index.html` in:

- **Repository:** https://github.com/iamtechartist/eiffel-tower-district
- **Copyright:** © 2026 Techartist
- **Licence:** MIT
- **File:** `research/repos/eiffel-tower-district/LICENSE` (full text retained there)

The MIT licence permits use, copying, modification and redistribution provided
the copyright notice and permission notice are retained. They are retained in the
header of `src/eiffelTower.js` and reproduced in full below.

```
MIT License

Copyright (c) 2026 Techartist

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

### Changes made to the upstream code

MIT requires modifications to be noted. Two changes were made, both inside
`buildEiffelTower`:

1. **Packaging.** The ESM `export { buildEiffelTower, EIFFEL_OFFICIAL_DIMENSIONS }`
   was replaced by a `window.EiffelTowerKit` global so the file loads as a classic
   `<script>` (required for `file://` support). Nothing else was touched.

2. **Platform deck sizes.** The three `addRingPlatform(...)` calls were changed to
   use the official outer deck dimensions, so the decks overhang the shaft and read
   as the three crisp horizontal bars in the skyline:

   | Deck | Upstream | Now | Official |
   |---|---|---|---|
   | First (57 m) | 68 | **70.69** | 70.69 m |
   | Second (115 m) | 39 | **40.96** | 40.96 m |
   | Third (276 m) | 16 | **18.65** | 18.65 m |

   Inner ring dimensions were left as upstream.

The `curveControls` shaft profile was **trialled and reverted**: widening the shaft
to the published two-exponential profile (Weidman & Pinelis 2004, fitted in
`research/notes/01-real-tower-geometry.md` to 0.94 % error) measured better on paper
but produced a shaft wider than the decks, which swallowed them and flattened the
skyline into a smooth cone — the classic "pyramid / radio mast" failure. Upstream's
slimmer shaft is kept so that every deck overhangs it. The reasoning is recorded in
a comment in the source so it is not "improved" back.

A third change lives in this project's own code, not in the derived file:
`src/main.js` applies a per-instance vertical colour degrade (darkest at the base,
lightest at the top), which is the official paint scheme's actual intent —
*"volontairement dégradée du plus foncé au plus clair pour accentuer la ligne de
fuite"*.

## 2. `vendor/three.min.js` — MIT

three.js **r160** (`build/three.min.js`, the last release that still ships a
classic non-module build), © 2010–2024 three.js authors, MIT.
https://github.com/mrdoob/three.js

Loaded as a classic script so the page runs from `file://` without a server.
Versions after r160 ship ES modules only, which browsers refuse to load over
`file://` — that is why r160 is pinned.

## 3. `research/repos/` — third-party, reference only

Cloned for study. **These are not part of the deliverable and carry their own
licence terms.** Redistribution status checked via the GitHub API:

| Repo | Licence | Redistributable? |
|---|---|---|
| `iamtechartist/eiffel-tower-district` | MIT | Yes, with notice |
| `doiiaioiiiailphin-cmyk/eiffel-tower-3d` | **none** | No |
| `logusivam/threejs-eiffel-tower-animation` | **none** | No |
| `MaidenTaief/Eiffel-Tower` | **none** | No |
| `shubhransh-gupta/courier-city` | see repo | Only per its own licence |

`MaidenTaief/Eiffel-Tower` additionally contains a ~5 MB inline float dump of a
pre-baked mesh; it is a data file, not a generator, and was not used.

## 4. Colour reference

The warm iron palette used in `src/main.js` is inspired by the cross-checked
values found in `doiiaioiiiailphin-cmyk/eiffel-tower-3d`
(`matIron` ≈ `0x816a50`, roughness 0.74, metalness 0.24) and by the "Eiffel Tower
Brown" paint used on the real structure. No code was copied from that unlicensed
repository.
