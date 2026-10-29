# Attribution and licences

## 1. `src/eiffelGenesis.js` and `src/main.js` — original work, MIT

Both files were written for this project. **No third-party geometry or rendering
code was copied into them.** The geometry is generated from the published
dimensions and from the profile measurements collected in `research/notes/`,
which cite their own sources (Wikipedia EN/FR, the French "Données techniques de
la tour Eiffel", the official toureiffel.paris site via the Wayback Machine,
Structurae, and the Commons "Dimensions Eiffel Tower.svg"), plus the published
engineering literature (Gallant 2002; Weidman & Pinelis 2004; Weidman 2009).

The project that this one is *not*: `../eiffel-tower-3js` (v1) wraps a
third-party MIT builder. v2 deliberately does not, precisely so that the geometry
is ours and can be changed freely. Nothing from v1 is included here.

## 2. `vendor/three.min.js` — MIT

three.js **r160** (`build/three.min.js`), © 2010–2024 three.js authors, MIT.
https://github.com/mrdoob/three.js

Pinned to r160 because it is the **last release that ships a classic
(non-module) build**. `build/three.min.js` and `build/three.js` were removed in
r161. Versions after that are ES modules only, and browsers refuse to load ES
modules over `file://` (CORS), which would break double-click-to-open. Pinning
r160 is what lets this project run with no build step *and* no server.

## 3. `research/notes/` — third-party research, copied for self-containment

The three research notes were produced during the v1 project and are copied here
so this folder stands alone. They are factual research with citations, not code.
They contain quotes from third-party repositories; quoted material remains under
its original terms and is used for analysis.

## 4. Referenced but NOT included

| Project | Licence | Status |
|---|---|---|
| `iamtechartist/eiffel-tower-district` | MIT | Studied; **not used** in v2 |
| `doiiaioiiiailphin-cmyk/eiffel-tower-3d` | **none** | Studied; not used |
| `logusivam/threejs-eiffel-tower-animation` | **none** | Not three.js — CSS silhouette |
| `MaidenTaief/Eiffel-Tower` | **none** | Baked float dump, not a generator |

No 3D model file is loaded anywhere in this project — every member is generated
in code. A CC-BY Eiffel Tower GLB and a CC0 STL do exist (see
`research/notes/03b-model-sources.md` in the v1 project), but using either would
contradict the point of the exercise.
