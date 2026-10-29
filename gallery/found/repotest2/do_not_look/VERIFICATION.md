# Eiffel Tower — final verification report

Subject: `eiffel-tower.html` — **120,166 B**, SHA256
`F4B3F326F70C5938088CECCECCA002352DBFC4C71B3A9796C12FF9B1714EF76C`
Verified: 2026-09-08. Three rounds: acceptance → four-defect fix → night polish.
Every number below is from **independent re-verification in the main session**
(vision-capable model), not from the build workers' reports.

## 1. Deliverables

| Path | Bytes | Notes |
|---|---|---|
| `eiffel-tower.html` | 120,166 | single self-contained page, importmap → `./vendor/` |
| `serve.mjs` | 1,880 | zero-dep static server, 127.0.0.1:8080 |
| `vendor/` | 14 files, 1.31 MB | three r169 + addons + `README.txt` (URLs, sizes, keep-these note) |

Downloads were **not** deleted, per the explicit instruction. Protected files
are byte-identical to their pre-build state across all three rounds:

* `index.html` — SHA256 `919E173068BD05AB…`
* `test_do_not_touch.html` — SHA256 `7CF637FA20CECCF1…`

## 2. Static checks — PASS

`node --check` on the extracted inline module and on `serve.mjs`: exit 0.
All 8 import specifiers resolve; modules served as `text/javascript`.
No runtime CDN dependency.

## 3. Headless render — PASS

Every load reached the page's own self-test:

```
EIFFEL-OK 431992 tris 205 calls
```

Camera states captured and read: `hero`, `base`, `top`, `night`, `ground`,
`lvl1`, `lvl2`, plus forced-night. **Zero page errors, zero console errors.**

`window.__EIFFEL_STATE__`: `{ok:true, triangles:431992, calls:205, beams:23058, sparks:20000}`

Geometry audit: `bad: 0`, `n: 23058`, bounds `minY 2 → maxY 330`, envelope
±60.088 m. Beams: chord 1404 · diag 10664 · belt 5908 · sub 4012 · girder 40 ·
rail 732 + FB2 rail 298.

## 4. Defect rounds — before / after

| Defect | Before | Final (independently measured) |
|---|---|---|
| **D1** non-finite beams | `bad 4138/23058` (sub 1600, belt 1472, diag 768, FB2 rail 298/298) | **`bad 0`**, `per {}`, `minY 2 → maxY 330` |
| **D2** hero crops spire | top ~90 m cut off | whole tower base→antenna tip in frame with sky margin |
| **D3** `state.sparks` | `0` | **`20000`** |
| **D4** weak ground/city | floating white cubes | grounded Paris: École Militaire, avenue street walls, arrondissement blocks with zinc roofs, skyline ring, allées |
| **D5** night city pale slabs | emissive lit whole facades → near-white blocks | emissiveMap rebuilt to near-black with sparse warm panes; `regAlb` sinks facades to dark indigo |
| **D6** night ground stayed day-bright | lawn/plaza/paths unchanged at `nightT=1` | `regAlb` extended to meadow, green collar, esplanade paving, curb and gravel avenues — found by visual review, fixed with 5 lines |
| cost | 187 calls / 312,256 tris | **205 calls / 431,992 tris** (budget ≤ ~250) |

D1 root causes: the arch helper read `sd.s` instead of `sd.sd` (3,840 NaNs) and
both stair handrail builders stored `[x,z]` so rails read a z as y and
`undefined` as z (all 298 FB2 rails).

## 5. Visual acceptance — read by the vision-capable verifier

* `_shot6_day_hero.png` — full tower framed base→spire, city flanking the
  Champ de Mars, lawns/paths/trees. **D2 fixed, day look unchanged.**
* `_shot5_lvl2.png`, `_shot3_lvl1.png` — dense diamond X-bracing, no gaps.
  **D1 visibly fixed.**
* `_shot6_ground.png` — city rows grounded on both sides, reads as Paris.
  **D4 fixed, no day regression.**
* `_shot_night_forced.png` — dark starfield sky, **dark city blocks with warm
  window dots**, **dark lawn and plaza**, floodlit gold tower, beacon shafts,
  lamp posts. **D5 + D6 fixed.** This is the frame that the vision-less workers
  could not evaluate; the albedo/emissive rig was confirmed visually here.

## 6. Residual limitations (honest)

* The city is stylized low-poly; block repetition is visible at close range.
* The École Militaire mass reads as a long pale bar from the hero distance.
* Night tower floodlighting + bloom is strong; the base pool is close to blown
  out. The single knob is the night bloom/flood intensities.
* 3–8 fps under swiftshader software rendering. 205 draw calls / 432 k triangles
  is a sane budget for real hardware, but **no GPU frame-rate measurement was
  possible here** — the 60 fps target remains unverified.

## 7. How to run

```
cd F:\repotest2
node serve.mjs
# http://127.0.0.1:8080/eiffel-tower.html
```

Query params: `?view=hero|ground|base|lvl1|lvl2|top`, `&intro=0`, `&night=1`,
`&density=`, `&seed=`, `&post=0`, `&shadows=0`, `&pr=`.

## 8. Artifacts kept on disk

35 screenshots (`_shot_*`, `_shot2_*` fix round, `_shot3_*`/`_shot5_*`/`_shot6_*`
independent re-verification, `_shot4_*_before_fix.png` polish baselines),
`_verify_all.json`, `_verify_all_log{,2}.txt`, `_verify_final.txt`,
`_probe_audit.txt`, `_probe_deep{,_after,_final}.txt`, `_probe_night.txt`,
`_probe.html` (throwaway copy with debug hooks), `_check{,2,3,4,5}.mjs`
(extracted modules), `_build/part_*.txt`, `_tool/` (puppeteer-core harness).
