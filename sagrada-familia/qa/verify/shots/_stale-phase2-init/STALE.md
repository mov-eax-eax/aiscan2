# STALE — first full-run artifacts (pre-harness-hardening)

These came from the first complete suite run. All were understood and the harness
was corrected before the authoritative re-run; kept only for the audit trail.

| File | Status |
| --- | --- |
| fail-fly-vertical-qe.png | HARNESS BUG — test assumed Q=rise/E=fall. Actual (Lead-confirmed) mapping is Q=fall, E=rise; both keys work. Fixed. |
| fail-ui-sound-toggle.png | HARNESS BUG at 800x500 — the HUD is in its responsive layout there (desktop nav hidden, Menu sheet shown), so the desktop Sound button is legitimately not visible. The mute state DID toggle correctly (false→true→false). Test now opens the Menu sheet and asserts the mute state. Fixed. |
| fail-mobile-boot.png | HARNESS BUG — the mobile section created its page but never called goto(), so it waited on about:blank and screenshotted a white page. Mobile itself boots fine (proof: shots/mobile-probe.png — ready, canvas 390x844, is-touch, no errors). The missing navigation was added. |
