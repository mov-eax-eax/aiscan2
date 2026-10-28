# STALE — screenshots from the interrupted Phase-1 smoke run

These images came from the first Phase-1 smoke run, which the Lead terminated
mid-mobile-section. The harness used the real GPU (boot recorded
`ANGLE ... Direct3D11`), but several checks in that run were themselves buggy and
produced false failures. Do not use these as evidence; Phase 2 re-captures
everything into the main `shots/` set.

| File | Status |
| --- | --- |
| fail-boot-loader-dismissed.png | HARNESS BUG — loader check raced the 1.1 s CSS fade. Fixed (waits for display:none/opacity<0.05). |
| fail-ui-photo-mode.png | HARNESS BUG — assertion wrongly required controls disabled. Photo mode hides the UI correctly. Fixed. |
| fail-ui-quality.png | HARNESS BUG — unscoped `[data-act="quality"]` selector + offsetParent visibility. Fixed (scoped + rect-based). |
| fail-ui-sound-toggle.png | HARNESS BUG — same unscoped-selector/visibility issue. Fixed. |
| fail-collision-facade-wall.png | UNCONFIRMED — walker crossed the Nativity façade plane at z≈18 in that run. Static collider list covers z 15.25..24, so this may have been a stale served build while builders were editing. Needs a Phase-2 retest. |
| fail-fly-rise.png | LIKELY APP BUG — Space did not rise in fly mode; statically confirmed that `controls.js` reads `keys.has('Space')` but never adds Space to the keys set (and Q/E are likewise documented but unread by `updateFly`). Re-captured in Phase 2. |

`shots/gpu-smoke.png` is current, valid evidence from the follow-up single-page
GPU smoke test.
