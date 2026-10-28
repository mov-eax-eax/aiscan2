# QA harness — Sagrada Família (independent verification)

Owner: **verifier** (independent QA/verification engineer). This directory is the
only part of the project this role writes to. Application source (`src/`, `css/`,
`index.html`, builders) is treated as **read-only**: defects are reported to the
Lead, never fixed here.

Status: **harness complete, run pending Lead green-light** (browser runs are
paused to protect the machine — see "Machine safety" below).

---

## Run it

```powershell
# from the project root
node qa/verify/harness.mjs
```

The harness ensures a dedicated static server on **127.0.0.1:8145** (starts
`node serve.mjs 8145` if absent; never touches 8141 or any other server), runs
one headless Edge browser sequentially, and writes:

| Output | Meaning |
| --- | --- |
| `qa/verify/results.json` | machine-readable results: tests, console/pageerror capture, screenshots with pixel stats, per-stop teleport results, performance samples |
| `qa/verify/REPORT.md` | human report: verdict, pass/fail table, prioritized defect list, performance table, screenshot index, curated visual review, coverage/limitations |
| `qa/verify/shots/` | screenshots (deliverable set at 1600×900) |
| `qa/verify/shots/stops/` | one screenshot per TOUR stop at 1600×900 |

Exit code is `1` when any check fails, `0` otherwise. `SF_REPORT_ONLY=1` rewrites
`REPORT.md` from the last `results.json` without launching a browser.

### Useful overrides

| Env var | Default | Purpose |
| --- | --- | --- |
| `SF_PORT` | `8145` | static-server port |
| `SF_BROWSER` | Edge at `C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe` | browser executable |
| `SF_CAPTURE_W` / `SF_CAPTURE_H` | `1280` / `720` | tour-stop + secondary screenshot / performance viewport |
| `SF_HERO_W` / `SF_HERO_H` | `1600` / `900` | hero screenshots viewport (5 frames) |
| `SF_INTERACT_W` / `SF_INTERACT_H` | `800` / `500` | interaction-test viewport (light/fast) |
| `SF_MOBILE_W` / `SF_MOBILE_H` | `390` / `844` | mobile section viewport |
| `SF_SKIP_CAPTURE=1` | off | skip screenshots + performance (smoke run) |
| `SF_SKIP_MOBILE=1` | off | skip mobile section |
| `SF_SKIP_URLPARAMS=1` | off | skip extra URL-parameter page loads |
| `SF_QA_LOCK_FILE` | `qa/.shot.lock` | serialized-QA lock file (shared with `qa/shot.mjs`) |
| `SF_LOCK_WAIT_MS` | `90000` | how long to wait for the QA lock before giving up |
| `SF_LOCK_STALE_MS` | `180000` | age after which a lock left by a dead run is reclaimed |
| `SF_REPORT_ONLY=1` | off | only regenerate `REPORT.md` from `results.json` |
| `SF_HEADED=1` | off | show the browser (debugging only) |

---

## Machine safety (important)

Headless 3D rendering is expensive. This harness is deliberately conservative:

- **Real GPU only** (ANGLE / D3D11: `--enable-gpu --ignore-gpu-blocklist
  --use-angle=d3d11`). SwiftShader software rendering is **not** used: it pinned
  every CPU core when several instances ran in parallel. Note: Playwright injects
  `--enable-unsafe-swiftshader` into every launch by default — this harness strips
  it with `ignoreDefaultArgs: ['--enable-unsafe-swiftshader']` so the browser
  command line contains no SwiftShader flag at all. The `boot-renderer` check
  asserts the live `WEBGL_debug_renderer_info` string contains `Direct3D11`.
- **Quick GPU smoke** (single browser/page, ~20 s): `node qa/verify/gpu-smoke.mjs`
  boots 800×500, prints the WebGL renderer string, walks ~1 s, saves
  `shots/gpu-smoke.png`. Set `SF_HOLD_MS=8000` to hold the browser open while
  inspecting its command line.
- **One browser, sequential pages.** The interaction suite is one page; then the
  page is closed before the capture page starts; then the mobile page. No two
  renderers run at the same time (one browser launch for the whole run).
- **Small interaction viewport** (800×500) and screenshots only where required.
- **Serialized QA gate, shared with `qa/shot.mjs`.**
  - `qa/.paused` (the Lead's global pause marker): if present the harness prints
    `[qa] rendering is globally paused by the Lead (remove qa/.paused to resume)`
    and exits **3** without touching a browser.
  - `qa/.shot.lock`: exclusive PID lock taken before launching the browser and
    released at the end, so two QA processes can never render at once. Locks
    older than 180 s are reclaimed as stale; after 90 s of waiting the harness
    gives up and exits **4**.
  - `SF_QA_LOCK_FILE` can point at a different lock file if the Lead's tooling
    uses one.

---

## Test matrix

Groups are recorded in `results.json` and grouped in `REPORT.md`:

| Group | What is checked |
| --- | --- |
| `boot` | app reaches `__sagrada.ready`, real GPU renderer, canvas, loader dismissed, no page errors, **builder errors empty**, **all five builder groups present/non-empty**, debug API complete, canvas not black |
| `splash` | title + three entry buttons visible, "Enter on foot" enters walk mode, default pose |
| `walk` | W moves, eye-height/ground sanity, Space jump |
| `collision` | Nativity façade wall, apostle tower, crossing column block the walker (no pass-through) |
| `doors` | Nativity / Passion / Glory open portals passable; walk from Glory entrance to the crossing |
| `fly` | F toggles, Space rises, Ctrl descends, Q/E rise/descend, Shift boosts |
| `teleport` | `teleport()` to every TOUR stop lands at the authored pose/mode (and tour time where set) |
| `tour` | T starts tour, caption title/body/index, next advances, pause↔resume, Escape exits |
| `hotspots` | builder hotspots registered, reticle label on aim, **E** opens card with content, Escape closes |
| `time` | day 10.35 / night 21.5 (`env.time`, `env.night`, HUD clock, slider), N toggle, night frame not black |
| `ui` | plan/minimap painted, help, photo mode, `hideUI`, quality low/high, sound toggle presence, HUD layout, pointer-lock fallback |
| `urlparams` | documented QA URL params: `skipSplash`, `mode`, `pos`, `look`, `time`, `ui`, `hud`, `tour`, `photo` |
| `capture` | deliverable screenshots (5 hero frames 1600×900, other shots + every TOUR stop at 1280×720); every frame is decoded and checked for being black/blank |
| `perf` | FPS / draw calls / triangles / geometries / textures **at every TOUR stop**, hero exterior, + low-quality delta |
| `mobile` | 390×844 boot, splash fit, touch controls, joystick movement, no horizontal overflow |
| `health` | page errors, console errors, failed requests across the run |

### Honesty rules baked into the harness

- A black canvas, missing builder group, stuck splash or failed boot is a
  **FAIL**, never a pass.
- `window.__sagrada.errors()` is checked: `src/main.js` swallows builder
  exceptions, so this is the only way the report can surface a missing builder.
- Screenshots are decoded in the browser and measured (mean/std/max luminance);
  a black or flat frame is flagged in the report.
- Skips and untested items are listed explicitly (`REPORT.md` → coverage).

---

## Screenshot set

Deliverable naming in `qa/verify/shots/`:

Hero frames at **1600×900**: `02-exterior-3q`, `06-nave-interior`,
`07-crossing`, `12-night-exterior`, `13-night-interior`.
Everything else (splash, façade close-ups, altar, apse, towers, aerial, tour
caption, hotspot card, minimap, photo mode) at **1280×720**, and
`stops/01-plaza.png` … `stops/12-night.png` at **1280×720**.

Every screenshot row in `REPORT.md` links to the file and its luminance stats;
the curated visual review is injected from `visual-notes.json`.

---

## Curated visual review

`visual-notes.json` holds the human (model) review that cannot be automated:

```json
{
  "critique": "short prose on composition, lighting, detail, legibility, scale",
  "observations": [{ "title": "…", "severity": "MAJOR", "notes": "…", "shots": ["shots/…png"] }],
  "defects": [{ "title": "…", "severity": "BLOCKER", "notes": "…", "repro": "…", "shots": ["shots/…png"] }]
}
```

Edit it after inspecting screenshots, then `SF_REPORT_ONLY=1 node qa/verify/harness.mjs`
to refresh `REPORT.md`.

---

## What this harness cannot verify

- **Audio output** — headless Edge has no audible device; only mute state is checked.
- **Pointer lock** — denied in headless; the drag-look fallback is exercised instead. A manual desktop pass should confirm pointer capture.
- **Subjective art direction** — the harness proves a frame is not black, not that it is beautiful; use the curated visual review.
- **Long-play memory/thermals** — not measured.
- **Other browsers** — Edge/Chromium only.
- **Full collider audit** — three representative colliders are probed, not every wall.

---

## Defect reporting

The Lead receives a concise message with: overall verdict, BLOCKER/MAJOR
defects with exact repro + screenshot paths, performance numbers, and anything
not covered. `REPORT.md` is the full artifact and stays rerunnable after fixes
(`node qa/verify/harness.mjs`).
