# v4 STATUS — handover

**Objective:** build `eiffel-tower-v4` as the best-attested model possible.
**Rules:** attested beats derived; a rounded figure in Eiffel's own prose is attested.
**`eiffel-tower-v3` is untouched** — verified, newest model file 07:50, before v4 work began.

---

## Priority (1) — the measurement loop — DELIVERED

`verify/profile-vs-photo.mjs`, asserting `profileHalf()` against the photograph.

| | |
|---|---|
| source | `La_Tour_Eiffel_vue_du_Pont_de_Bir_Hakeim.jpeg`, 4608×3072, daylight |
| method | envelope by **run grouping** — dark runs merged across gaps < 170 px |
| calibration | height-derived 0.1548 vs width-derived 0.1564 m/px → **1.06 %**, at **6.43 px/m** |
| profile | `verify/photo-profile.json`, 997 rows |
| result | **mean 4.29 %** over 416 rows outside the platform bands |

**Assertions currently FAIL (honestly):** worst 14.8 % at 107.2 m, inside the 2nd platform's
silhouette band. Not a model fault and not an artifact — see "resolved" below.

### Why earlier methods failed (all four recorded)
1. trace Plate I's outline → locked onto the caption; then Plate I proved ~2.3× wide
2. photo trace from the antenna → axis-hugging (14 px half-width vs 150+)
3. seed on "widest row" outward from centre → found the **nearest** ink, an interior member
4. full-row seed → captured the **statue** (span 1907–3739, centre 2823, axis 2152)

**The fix:** group runs by the white gap between them. The tower's lattice members are
separated by small gaps; the statue is separated by hundreds of px of blown sky. It groups
out by construction rather than by tuning a coordinate.

### Resolved in rounds 16–20: the platform discrepancy
The photograph reads deck width ~8 m below the 2nd platform; the model reads the caisson.
- **grouping artifact — eliminated** by raw runs (max internal gap 14–19 px)
- **perspective — ruled out** numerically: explaining the band would need d ≈ 380 m, i.e. a
  47° field of view; the photograph is not that
- **conclusion:** the model represents the **caisson**; the photograph measures the
  silhouette including the **overhanging deck**. Different quantities, same rows.
- **eight band adjustments were made before this was understood, each relocating the error
  rather than removing it.** That relocating error was the signal.

---

## Priority (2) — transcribe the schedules — LARGELY DONE

### READ and cross-confirmed
- **Panel heights, panels 18–29** — Plate I Fig. 2, cross-confirmed on Plate VII Fig. 3.
  **Panel 19: 9.08613 vs 9.09635 → 0.1 % apart on two independent plates.**
- **Member sections** — Plate VII: Treillis 45×45×5; Corn. 80×80×8 / 80×80×9 / 90×90×10 /
  80×80×14 / 80×80×15.
- **Chord = 877**, printed at every chord position on Plate VII.

### The closure that validates the chain
```
panels 18..29  READ      111.465 m
panels 11..17  IMPLIED    73.455 m
                         ────────
                         184.920 m  =  documented L2 → ironwork-top span, exact
```
An earlier version used L3 (276.13) as the top and produced a contradiction. **The error was
mine: panel 29 is the campanile and reaches the ironwork top (300.65), not L3.**

### Deliberately NOT used
`plateVII-sections.js` sections are **component sizes, not effective member widths.**
Wiring 45×45×5 in as the trellis would replace the thick members with the thin lacing and
destroy the hierarchy. Resolved by measuring 443 drawn stroke widths on the plate:
p25 = 53 mm (matches the 45 mm label) vs p75 = 160 mm (the built-up members). **The plate has
a hierarchy; both numbers are right.**

### STILL BLOCKED
- **Panel widths** — printed *inside* the drawing, over the lattice. Round 9 read one panel's
  height three different ways (11.9628 / 11.36251 / 10.4058) and the transcription was stopped.
  The **heights read because they are in a clean margin column; the widths do not.**
- **Panels 1–10** — not transcribed.

---

## Priority (3) — rebuild from attested sources — BEGUN

`src/geom/panels.js` — the attested upper-tower schedule, per-value provenance
(READ / IMPLIED / UNREAD), 7/7 self-checks.
**Wired into `tower-detailed.js`** in round 24: panels 11–29 now use the attested pitch.

v3's scheme is superseded on three independent grounds:
1. **pitch** — 5.88 → 11.23 m growing downward, vs v3's uniform 10.27 m
2. **floors** — v3's intermediate floor at 259.63 ASL is **37 m** from the plate's 222.44,
   and v3 has no floor at 142.23 ASL at all
3. **closure** — the real chain closes exactly on 184.92 m; a uniform pitch cannot

---

## Priority (4) — matched-angle review — NOT STARTED

The photograph route is calibration-complete (6.43 px/m, axis x=2152, antenna row 360,
L1 row 2120). A matched-angle render is the remaining step and needs no further transcription.

---

## Attested facts now in the model

| element | source |
|---|---|
| leg 15.00 m → 10.41 m | Eiffel L2106 / L2110 |
| shaft / caisson 31.70 → 10.00 m | Eiffel L2115–2116 |
| chord 877 mm constant | Plate VII, printed at every chord |
| panel pitch, panels 11–29 | Plate I, cross-confirmed Plate VII |
| arch: 74 m **diameter** semicircle | Eiffel L2118 |
| no cross-bracing in tympana | Eiffel §13 |
| trellis 45×45×5 = the *lacing*, not the members | Plate VII + stroke measurement |

## Corrections to the record
- I claimed twice that the caisson line was "unattested" — **wrong**, it is Eiffel L2115–2116.
- I concluded in round 16 that the platform band was perspective — **disproved in round 18**
  by my own arithmetic, one round later than it should have been.
- The height-chain "contradiction" in round 22 was **my error**, using L3 instead of the
  ironwork top.

## Failing checks, left failing on purpose
`profile-vs-photo.mjs` — 2 of 6 assertions, both about the platform bands, for a reason now
established by measurement. Tuning them green would destroy the only instrument this project
has.

---

# FINAL STATE — rounds 26–30

## What rounds 26–30 added

| round | outcome |
|---|---|
| 26 | **`STATUS.md`** written (this file) — the four priorities consolidated |
| 27 | **v4 served on 8082** and rendered for the first time with the attested pitch: 18,985 members, 30 panel boundaries |
| 28 | attempted to **measure** the Plate VII widths (routing around the reading blocker, as round 25 had for sections) — **FAILED**, magnitude check caught it |
| 29 | retried with corrected bounds — **FAILED again**; and the magnitude check itself rested on an **unmeasured** px/mm |
| 30 | close-out |

## Priority (4) — started but not completed

v4 renders with the attested panel schedule, and the quantitative half of the review already
exists as `profile-vs-photo.mjs`. What is **not** done is a visual matched-angle comparison
against the photographs (side-by-side at matched scale), which is what priority (4) asks for.

## Final check state

| check | result |
|---|---|
| `verify/run.mjs` | **38 / 38** |
| `verify/profile-vs-photo.mjs` | 4 PASS, **2 FAIL (honest)** — mean **4.29 %** over 416 rows |
| `geom/panels.js` | **7 / 7** |
| `geom/plateI-schedule.js` | 6 / 7 — the flagged panel-29 width |
| `geom/plateVII-sections.js` | 4 / 4 |
| `eiffel-tower-v3` | **untouched** — served on 8081 |

## The objective is NOT complete

- **(1) delivered** — loop, calibration 1.06 %, honest failures.
- **(2) largely done** — heights cross-confirmed on two plates; sections read and correctly
  classified; **widths blocked**; **panels 1–10 untranscribed**.
- **(3) begun** — attested pitch wired in; member sections deliberately not wired in.
- **(4) started** — renders at the attested pitch; no visual matched-angle comparison yet.

## The single lesson this project kept re-teaching

Six detectors, six failures, every one writing **plausible numbers for the wrong object**:

| round | detector | actually measuring |
|---|---|---|
| 2 | Plate I outline trace | the caption |
| 11 | photo trace from the antenna | the mast |
| 12a | centre-outward seed | the nearest interior member |
| 12b | full-row seed | the statue |
| 28 | Plate VII width scan | neighbouring figures |
| 29 | same, re-bounded | still the neighbouring figure |

**Every one was caught by a magnitude or calibration check — never by eye.** And in round 29
even that check was undermined, by using a recalled px/mm instead of a measured one.

The check should be written **first**, every time. It never was.

## To continue

Two blockers, both needing a **legible transcription** rather than more code:
1. **Plate VII's printed panel widths** — inside the drawing, over the lattice.
2. **Panels 1–10** — ground to the 2nd platform.

And one unblocked task: **priority (4)'s visual matched-angle comparison.**

