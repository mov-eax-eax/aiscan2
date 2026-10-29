# v4 — FOUND: the authoritative source (Plate I, Fig. 2)

## What it is

`research/sources/gallica/PL-I-f17-elevation.jpg` — 5961 × 8831 (52.6 MP), Plate I of
*La Tour de trois cents mètres*.

**Fig. 2 — « DIAGRAMME DE L'ÉLÉVATION », échelle 0.001 p. m.** — an **orthographic
elevation at 1:1000**, with the complete dimension chain.

Located in the sheet at approximately **x 2180–3780, y 1700–6400**, giving
**≈ 13.5 px/m** — about **2× the resolution of the best photograph**, and with no
perspective to rectify.

## Why this changes the plan

Every proportion fault of the last session was a number I chose or derived, checked
against nothing. This plate carries the numbers directly:

| content | use |
|---|---|
| panels numbered **1 … 29** bottom-up | replaces the reconstructed `panelBounds()` |
| **width at every panel boundary** | replaces the interpolated leg/shaft widths |
| **panel heights** | replaces the assumed 11 m pitch |
| level names with heights **in metres ASL** | cross-checks the platform chain |
| the outline itself | the silhouette envelope to assert `profileHalf()` against |

## Read so far (to be transcribed carefully at full resolution)

Levels, metres ASL as printed:
  324,015 · *plancher supérieur*
  312,21  · *logement de M. Eiffel*
  303,38  · *plancher de la Coupole*
  300,68  · *niveau du plancher*
  299,216 · *plateforme*
  222,44  · *plancher intermédiaire*
  142,23  · *niveau du plancher*
   61,13  · *niveau du plancher*

Margin heights: 298.895 · 271.894 · 235.72 · 192.03 · 143.19

Panel widths, upper shaft, descending: 2,8 · 2,7 · 2,6 · 2,5 · 2,4 · 2,3 · 2,2 · 2,1 ·
2,0 · 1,9 · 1,8 · 1,7 · 1,6 · 1,5 · 1,4 · 1,3 · 1,2 · 1,1 · 1,0 …

Panel widths, lower, descending: 13,58 · 13,85 · 14,60 · 15,98 · 16,38 · 16,60 …

Panel heights (left chain): 12,780 · 12,637 · 13,000 · 12,800 · 11,62 · 10,48 · 6,262 ·
5,838 · 3,00 · 2,80

## OPEN — must be resolved before use

**The printed widths do not obviously match the documented shaft.** The 2nd-platform
caisson is recorded as **31.70 m**, but the plate's widths near that level read 13,58 /
13,85. So these are probably **half-widths, or the width of one face's flat panel**, or
the leg width — **not the full envelope**. Do NOT use them until that is settled from the
plate itself, by counting the printed figures against the drawn outline at known levels.

This is exactly the `pilier`/`pile` trap again: a number that is precise about an object
other than the one assumed. Resolve it before it enters the model.

## Method for the measurement loop

1. Extract the tower's **envelope** from Fig. 2 — outermost drawn ink per row, measured
   from the tower's centre line, **excluding the dimension chains and margin text**
   (the failure mode is the one that produced the "314 m tower": a scan walking out into
   a neighbouring element that is not the subject).
2. Calibrate px→m on the **total height 330 m** and cross-check on the **base 124.906 m**.
   If the two disagree by more than ~1 %, the region is wrong.
3. Emit `verify/plate1-profile.json` — half-width in metres per row.
4. Assert `profileHalf(y)` against it, per row, in `verify/run.mjs`.
5. Only then touch geometry.

## Rule (carried from v3)

When a derived value conflicts with an attested one, **the attested one wins**. A rounded
figure in Eiffel's own prose is *attested*, not imprecise.

---

# Extractor status — ROUND 1, NOT CONVERGED

`verify/trace-plate1.ps1` locates Fig. 2 and traces an outline, but **the two-scale
self-check refuses to emit a profile**, correctly.

| reading | value |
|---|---|
| centre line | **x = 3468** (from the widest lower span; corrected from 2980) |
| vertical scale | 13.66 px/m |
| horizontal scale | 4.81 px/m |
| agreement | fails (183 %) — profile NOT written |

## Two known faults

1. **The trace starts at y = 1706**, the region's top edge — so the first ink it finds
   is plate furniture (border/grid), not the crown. `topY` is therefore the region
   boundary and the vertical scale is meaningless.
2. **The widest contiguous run is stuck at 297 px** regardless of region width, so it is
   a solid drawing element (fascia or rule), not the splayed base. The real base is a
   series of *isolated* thin runs spanning ~710 px.

## First correction that DID work

The original centre-finder ran at `y = 0.45–0.55 H` and locked onto the caption
**« DIAGRAMME DE L'ÉLÉVATION »**, reporting an axis 360 px off — which is what produced
the 74 % scale disagreement. Centre is now taken from the lower tower.

## The lesson, and it is the third time

**Do not write a detector before visually confirming what it detects.** This is the same
fault as the "314 m tower" and the contaminated px/m scan.

**NEXT ACTION (do this first, before any more code):** render the traced outline back
over the plate crop as an overlay image and LOOK at it. Confirm the axis and the two
outlines are on the tower. Only then tune thresholds. Grep/probe output is not a
substitute for seeing the overlay.

---

# ROUND 2 — OVERLAY DONE. THIS REDIRECTS THE WHOLE APPROACH.

Overlay: `research/refs/overlay-trace.png` (trace drawn in red over the plate crop).

## 1. The trace is wrong, in three known ways

- follows **internal members**, not the outer envelope, through the shaft
- **falls off in the legs**, where the outline moves faster than its ±8 px window
- runs to the **top edge of the region** along a nearby vertical rule

Fixable. But it no longer matters, because of the next point.

## 2. Fig. 2 IS NOT TO SCALE — horizontal ≈ 2.3 × vertical

Measured straight off the overlay:

| quantity | px | for | implies |
|---|---|---|---|
| drawn height | ~4300 | 330 m | **13.0 px/m vertical** |
| 2nd-platform band | ~1240 | 40.96 m | **30.3 px/m horizontal** |
| the base | runs **off both edges** of a 2700 px window | 124.906 m | **> 21.6 px/m** |

The two axes differ by roughly **2.3×**. A drawing whose own title is
« **DIAGRAMME** DE L'ÉLÉVATION » is illustrative in plan and need not be uniform.

**Consequence: tracing the outline was the wrong method.** Plate I's value is its
**printed dimension chain** — attested data — not its drawn geometry.

## 3. Therefore Tier 1 is re-scoped

~~Extract the true orthographic elevation profile from Plate I and assert per row.~~

**→ Transcribe the printed 29-panel schedule from Plate I Fig. 2** (panel numbers, panel
heights, boundary widths, level heights in metres ASL) and assert the model against
**those numbers**. Same for Plate XXXI's section table and Plate VII's schedule.

The measurement loop against a *photograph* still stands as a separate, later step —
photographs ARE to scale — but it needs the rectification that the plate was supposed to
make unnecessary.

## 4. What this also settles

The OPEN question from round 1 — whether the printed widths 13,58 / 13,85 are half-widths
or something else — is **not** resolved by geometry here, because the drawing is not to
scale. It must be settled by reading the printed figures against their labels directly.
Still do not use them until that is done.

---

# ROUND 3 — THE HEIGHT CHAIN IS VALIDATED, AND IT CORRECTS v3

## The cross-check that had been missing all project

Building the height chain **downward from the ironwork top** (300.65 AGL) using only the
panel heights read off Plate I:

| boundary | reconstructed | documented | agreement |
|---|---|---|---|
| panel 29 bottom | **276.26 AGL** | **L3 = 276.13 AGL** (309.63 ASL) | **0.13 m** |
| panel 18 bottom | **189.19 AGL** | **« Plancher intermédiaire (222,44) »** = 188.94 AGL | **0.25 m** |

**Two independent documented levels hit within 25 cm.** The transcription is right, and —
for the first time in this project — a figure is confirmed against something other than
itself.

## Correction to v3: the intermediate floors

Plate I names intermediate floors that **v3 does not contain**:

| plate label | ASL | AGL |
|---|---|---|
| *Niveau du plancher* | **142,23** | **108,73** |
| *Plancher intermédiaire* | **222,44** | **188,94** |

v3 instead records a single intermediate floor at **259,63 ASL / 226,13 AGL** — **37 m
away** from the plate's 222,44 and, on this evidence, a wrong reading.

So v3's panel scheme is wrong in two ways at once:
- **pitch**: it interpolates 18 equal steps of 10.27 m; the plate's upper panels run
  **5.88 → 9.60 m and grow downward**
- **floors**: it has no intermediate levels where the plate names two

## Still open

`BOUNDARY_WIDTH_READ` does **not** match the documented caisson line at a constant ratio
(0.910 at panel 27, 0.853 at panel 19). A varying ratio means they are not the same
quantity, or the height assigned to each width is wrong, or the caisson line is wrong.
**Do not reconcile by scaling.** The height chain is now corroborated, which narrows it to
two candidates: the widths measure something other than the full caisson, or the caisson
line (31.70 → 10.00) is wrong.

The panel-29 width (10.90) remains flagged: it breaks monotonicity, and the documented
caisson tops out at 10.00 m there.

---

# ROUND 4 — PLATE VII FOUND. IT IS THE SCHEDULE PLATE.

## What Plate VII is

`PL-VII-f41-ossature-rabattement.jpg` — **« OSSATURE EN RABATTEMENT »**, the frame
**unrolled**, in three figures at **1:200** (5× Plate I's scale):

| figure | panels |
|---|---|
| Fig. 2 | **1 à 14** |
| Fig. 3 | **15 à 22** |
| Fig. 4 | **23 à 29** |

Each is a tower FACE DEVELOPED FLAT, every panel labelled and fully dimensioned. Unlike
Plate I's *diagramme* (which is ~2.3× horizontally exaggerated and therefore unmeasurable),
a *rabattement* is a true development — both axes are usable.

## Cross-check: the width series is CONFIRMED on two independent plates

| | Plate I | Plate VII |
|---|---|---|
| width at panel 19 | 17.400 | **17,400** ✓ |
| height of panel 19 | 9.08613 | **9,08635** ✓ |
| width at panel 18 | — | **18,500** |
| height of panel 18 | 9.60359 | **10,0195** ⚠ |

**The width series is right.** Round 3's open conflict therefore resolves against the
caisson line (31.70 → 10.00), not against the plate readings. The caisson line must be
re-examined — it is the one figure with no plate behind it.

**⚠ New discrepancy:** panel 18's height reads 10,0195 here against 9,60359 off Plate I.
A 0.42 m difference. One of the two is a misread, OR the margin numbers on Plate I are not
all panel heights. Re-read before use.

## THE MEMBER SECTIONS — the per-panel schedule the objective asks for

Read directly off Plate VII Fig. 3, panels 17–19:

| member | section |
|---|---|
| **Treillis** (trellis bracing) | **45 × 45 × 5** |
| **Corn.** (corner angle) | **80 × 80 × 8** |
| **Corn.** | **90 × 90 × 8** |
| **Corn.** | **90 × 90 × 11** |

Plus edge dimensions 600 · 300 · 200 · 500, and the brace angles given to the minute:
40°37′19″ · 59°34′50″ · 47°27′52″ · 42°32′5″ · 44°48′32″.

**This is the attested member schedule.** Note it does NOT include 120×6 flats — the
trellis here is **angle iron 45×45×5**, which is a different member from what v3 builds.

## Next

1. Transcribe Figs. 2, 3 and 4 of Plate VII panel by panel — all 29 widths and heights,
   and the member sections per panel. This supersedes the Plate I transcription.
2. Re-read the caisson line. It is the only figure in the width conflict with no plate
   behind it.

---

# ROUND 5 — PLATE VII DETAIL READS

## The chord is ATTESTED on the plate

**« 877 »** is printed at every chord position down both edges of the development. Eiffel's
877 mm box is now read off a plate rather than inferred, and the varying figures beside it
(**867.34 · 884.879 · 850.88**) suggest the chord's *position* varies per panel while its
size does not.

## The member sections are PER PANEL and get heavier downward

Read across the figures:

| position | member |
|---|---|
| upper panels | Corn. **80×80×8**, Treillis **45×45×5** |
| lower | Corn. **90×90×10** |
| lower still | Corn. **80×80×14**, **80×80×15** |

This corroborates the research's *« angles de 80×80 à 90×90 et 100×100 »* for the lower
X-bracing — and shows the schedule is **per panel, not per zone** as v3 builds it. The
member hierarchy that had to be guessed and then corrected by eye is simply *written down*
on this plate.

## Correction to my own Plate I reading

Plate VII's boundary widths read **18,182** · **17,438**0 where I transcribed **17.400**
from Plate I. So the Plate I 5-decimal figures are being read slightly wrong — consistent
with the panel-18 height discrepancy (10,0195 vs 9.60359) flagged in round 4.

**Conclusion: the Plate I transcription is to be SUPERSEDED by Plate VII throughout.**
Plate I is smaller (1:1000), horizontally exaggerated, and its 5-decimal chain is at the
limit of legibility. Plate VII is 1:200, a true development, and legible. Keep Plate I
only for the level NAMES and ASL heights, which Plate VII does not carry.

---

# ROUND 7 — THE WIDTH CONFLICT IS BETWEEN TWO ATTESTED SOURCES

## I was wrong in rounds 3–4

I recorded the caisson line (31.70 m at 114.73 → 10.00 m at 276.13) as "the only figure in
the width conflict with no plate behind it". **It is attested by Eiffel's own text:**

> « tronc de pyramide quadrangulaire dont la base, à la hauteur de **114,73 m**, a
> **31,70 m** de côté »                    — **Eiffel 1900 L2115–2116**

## So the conflict is ATTESTED vs ATTESTED

| source | figure |
|---|---|
| **Eiffel's *Texte* L2115–2116** | caisson **31.70 m** side at 114.73 m → **10.00 m** at 276.13 m |
| **Plate VII** (rabattement, 1:200) | boundary width **17.438 m** at a panel boundary |

The stated rule — *when a derived value conflicts with an attested one, the attested one
wins* — **does not resolve this**, because both are attested. A different question has to
be asked: **what does each measure?**

## The two candidates, neither yet excluded

1. **Eiffel's 31.70 m is the SQUARE SIDE IN PLAN** (a cardinal extent), while Plate VII's
   rabattement gives the **developed face width**. For an unrotated square caisson these
   should be equal — so this only works if the caisson is rotated in plan, which is not
   currently attested either way.
2. **My assignment of the 17.438 m width to a panel boundary height is wrong.** On the
   caisson line, 17.438 m corresponds to **~220.8 m AGL** — near panels 21–22, not the
   panel 17 boundary (~177 m) I assumed. A one-panel misassignment would explain it
   without either source being wrong.

**Candidate 2 is cheaper to test and is the next action:** read which panel the 17.438
figure actually sits on, rather than assuming from crop position.

## Do not

Do not reconcile these by scaling. A varying ratio (0.910 at one boundary, 0.853 at
another) already rules out a constant factor, and scaling is how the leg width went wrong.

---

# ROUND 9 — I CANNOT RELIABLY TRANSCRIBE THIS CHAIN. STOPPING THE TRANSCRIPTION.

## The evidence is my own inconsistency

Across three crops of Plate VII I have read **the same panel's height** three ways:

| crop | panel 16 read as |
|---|---|
| `pVII-fig2-b.png` (round 5) | **11.9628** |
| `pVII-fig3-low` region (round 4) | not read |
| `pVII-17438-context.png` (round 9) | **11.36251** |
| same crop, adjacent margin | **10.4058** |

Three different values for one dimension. That is not a transcription; it is guessing with
a plausible-looking output — the exact failure class this project has already produced
retracted figures from (the `101.40 m` chord square, `"12 à 9"`, the OCR void ratios).

## Why

Plate VII is a photograph of a **bound page**, at 1:200, with a chain carrying **five
decimal places**. At this scale the digits are a few pixels tall and the page is curved.
**The resolution is not sufficient for reliable reading by me.** More crops do not fix
this; they only generate more inconsistent readings.

## What IS reliable from Plate VII (confirmed across multiple crops)

- **chord = 877**, printed at every chord position — the one hard number, and it agrees
  with `profile.js`
- **member families**: Treillis 45×45×5 · Corn. 80×80×8 / 80×80×9 / 90×90×10 /
  80×80×14 / 80×80×15
- **chord position dimensions vary per panel** (867.44, 864.879) while the chord does not
- brace angles to the minute; edge dims 800 · 500 · 400 · 300 · 200

## What is therefore BLOCKED, and what is not

**Blocked (needs a human eye or OCR):** the exact per-panel numeric chain — widths,
heights and section assignments to specific panels.

**Not blocked:** everything already validated. The **panel heights transcribed from
Plate I pass a two-level cross-check** (panel 29 → 276.26 vs 276.13; panel 18 → 189.19 vs
188.94). Those stand. The Plate I *heights* are usable; the Plate I *widths* are not, and
Plate VII's widths cannot yet replace them.

## Recommendation to the human

The single highest-value input left is **a legible transcription of Plate VII's chain** —
done by eye on the original, or by OCR at higher resolution than these scans give. It is
one bounded task, it needs no judgement, and it would collapse most of the remaining
uncertainty in this model.

Everything else this session produced is durable: provenance, the two-level height
validation, the not-to-scale finding about Plate I, and the harness.

---

# ROUND 10 — THE PHOTOGRAPH ENVELOPE TRACE WORKS

Overlay: `research/refs/overlay-photo.png` — trace drawn in red on
`La_Tour_Eiffel_vue_du_Pont_de_Bir_Hakeim.jpeg`.

**Verified by eye, per the round-2 discipline.** The red outline follows the silhouette
from the antenna tip down the shaft, across the 2nd platform, and into the legs. The blue
axis sits correctly on the tower. The trace terminates at the treeline, which is where the
base is occluded — as predicted, not a fault.

| | |
|---|---|
| image | 4608 × 3072, daylight |
| centre line | x = 2152 |
| rows traced | 1255 left / 1354 right, down to y = 3066 |
| useful range | antenna → treeline, roughly the upper **70 %** |
| base | **occluded by trees — not available from this image** |

## Why this matters

It breaks the round-9 blocker by a different route. The objective's priority (1) assumed
Plate I would be the measurement source; Plate I's outline turns out to be ~2.3×
horizontally exaggerated and unusable, and Plate VII's chain is below my reading
resolution. **A photograph is to scale in both axes and legible.**

- The trace is **calibrated against the known total height** and cross-checkable against
  the 2nd-platform width (40.96 m), giving the same two-constraint check that Plate I
  failed.
- The failure mode to watch is the one that produced the "314 m tower": the trace walking
  out of the subject. Here it is guarded by the contour-trace method (each row searched
  within a window of the previous position), plus the treeline forming a natural stop.

## Next

1. Emit the profile as JSON, calibrate on height **and** cross-check on the 2nd-platform
   width. If the two scales disagree by more than ~2 %, the trace is wrong — do not use it.
2. Assert `profileHalf()` against it, per row, in `verify/run.mjs`. This is the objective's
   priority (1), reached by the photograph route rather than the plate route.
3. Only then touch geometry.

## Carried forward from round 9

Plate VII's numeric chain remains **blocked** and needs a human eye or better OCR. The
Plate I **height** chain stands, validated against two documented levels. v3's panel
scheme is wrong in pitch and in intermediate floors, and the member schedule is per panel
rather than per zone — all three recorded and waiting on the chain.

---

# ROUND 11 — THE PHOTO TRACE ALSO FAILS. AND THE OVERLAY LIED.

## The calibration caught it

Calibrating on the 2nd-platform width (40.96 m) gave:

| quantity | read | should be |
|---|---|---|
| widest mid-band **half**-width | **14 px** | ~150+ px |
| derived scale | **0.7 px/m** | ~13 px/m |

0.7 px/m would make the tower **4700 px tall** — taller than the 3072 px image. So the
trace is following something close to the axis (the mast/antenna), not the tower's edges.

## The overlay did NOT catch it — and that is the real lesson of the round

`overlay-photo.png` looked correct. It is **620×413 — 13 % of the original**. At that scale
two traced lines sitting near the axis instead of on the tower's edges are
indistinguishable from lines sitting on the edges.

**A visual check at insufficient resolution is not a check.** Round 2's discipline —
*overlay first, look* — is necessary but **not sufficient**: the overlay must be rendered
at a scale that can actually reveal the fault being tested for. Better still, the numeric
second constraint should be run *before* looking, since it caught in one line what the
image hid.

## Corrected method for the next attempt

1. **Run the two-constraint calibration FIRST**, before any visual check. Emit
   height-scale and width-scale; they must agree within ~2 %. If they do not, the trace is
   wrong and there is nothing to look at yet.
2. **Then** render the overlay at **≥50 % scale on a crop around the 1st/2nd platform**,
   where the tower is widest and any axis-hugging fault is unmistakable.
3. Fix the trace: it is currently starting from the antenna and never leaving it. The
   start condition (`first ink within 120 px of the centre`) locks onto the mast. It must
   instead latch onto the **silhouette edges** — e.g. begin at a row where the tower is
   wide, trace BOTH up and down from there, and require the half-width to grow monotonically
   toward the base as a sanity gate.

## Status of all three measurement sources

| source | status |
|---|---|
| **Plate I outline** | **unusable** — ~2.3× horizontally exaggerated; it is a *diagramme* |
| **Plate VII chain** | **blocked** — below my reliable reading resolution (three inconsistent reads of one panel) |
| **Photograph envelope** | **not yet working** — the trace hugs the axis, caught by calibration |

All three recorded with their failure mode, so none is retried blind.

---

# ROUND 12 — AUTOMATED EXTRACTION: THREE ATTEMPTS, THREE FAILURES

## The record

| attempt | method | failure |
|---|---|---|
| r2 | trace Plate I outline | locked onto the caption; then Plate I proved ~2.3× exaggerated |
| r11 | photo trace from the antenna | axis-hugging (half-width 14 px where it should be 150+) |
| r12a | photo, seed on "widest row" from the centre outward | finds the **nearest** ink — an interior member — not the silhouette edge (19 px) |
| r12b | photo, seed by full-row scan in a clean band | caught the **treeline/foreground** (1832 px at row 2295 ≈ 141 m, wider than the 124.9 m base); down-trace then nearly constant 916–941 px instead of tapering |

## What went right

**Every failure was caught by a check, not by eye.** The two-constraint calibration —
does the height-scale agree with the width-scale? — rejected all three. Round 11's
620×413 overlay looked *correct* while the trace was broken; the number caught it in one
line. That check is worth keeping regardless of what happens to the extractor.

## The honest conclusion

**Automated envelope extraction from these sources is beyond what I can do reliably here.**
Not for want of method — the contour-trace plus the calibration gate is sound — but because
each source defeats it differently:

- **Plate I**: right structure, but not to scale; nothing to extract.
- **Plate VII**: to scale, but below my reading resolution.
- **Photographs**: to scale and legible, but the tower is never alone in the frame —
  treeline, statue, blown sky. Every seed rule either hugs the axis or captures a
  neighbour.

The recurring shape is the one from the very start of this project: **a detector writes
plausible numbers for the wrong object.** Four times now, across four rounds.

## Recommendation

**Stop the extractor. Use the human eye, or a purpose-built tool, for the measurement.**
The two highest-value inputs, both bounded and needing no judgement from the model:

1. **A legible transcription of Plate VII's dimension chain** — by eye on the original, or
   OCR at higher resolution. Resolves panel pitch, intermediate floors, and the per-panel
   member schedule at once.
2. **A trace of the envelope on `La_Tour_Eiffel_vue_du_Pont_de_Bir_Hakeim.jpeg` above the
   treeline** — trivially done by hand in an image editor, and it is the profile the model
   needs to be asserted against.

Everything needed to consume either one exists: `verify/run.mjs`, the two schedule
modules, and this record.

---

# ROUND 13 — THE MEASUREMENT LOOP EXISTS AND THE MODEL FAILS IT IN ONE BAND

## The loop works

`verify/profile-vs-photo.mjs` asserts `profileHalf()` against the photograph.
Calibration passes: height-derived 0.1548 m/px vs width-derived 0.1564 m/px =
**1.06 % agreement** at **6.43 px/m**. Three independent attested facts (330 m, 57.63 m,
70.69 m) agreeing to one percent.

## Where the model agrees — and where it does not

| y (m) | error |
|---|---|
| 115.6 (L2) | **2.6 %** |
| 149.8 | 4.7 % |
| 199.9 | 3.8 % |
| 57.7 (L1) | 4.6 % |
| **63.7** | **19.3 %** ← worst |
| 80.2 | 14.1 % |
| 250.0 | 11.8 % |
| 276.1 (L3) | 27.9 % |

**The model agrees to 2.6–4.7 % over roughly 115–205 m and fails badly in a band from
just above the 1st platform to about 80 m.**

## The honest reading: UNRESOLVED

Two candidates, neither excluded:

1. **A real model error.** `legWidth()` tapers from 15.00 m at L1 to 10.41 m at L2; the
   photo says the tower is 19 % NARROWER than that at 64 m. A genuine fault in the
   taper's shape, not its endpoints.
2. **A measurement artifact.** In that band the legs have just converged and the grouping
   may still be merging across the remaining void, reading narrower than the true envelope.

**Do not resolve by widening the tolerance or moving the range.** An earlier version of the
file claimed the band 45–205 m was valid and failed at 21.7 %; the boundary was then moved
to the documented platform (57.63 m, where the legs end) and it still failed at 19.3 %.
Two attempts, both rejected by the check. The next step is to distinguish model error from
measurement artifact, not to re-draw the boundary.

## A silent-check failure caught here too

The runner used `import.meta.url === \`file://${process.argv[1]…}\``. On Windows that
compares `file:///F:/…` against `file://F:/…`, so **the check never fired and reported
nothing while appearing to pass** — the same class as the missing `?view=` hook in v3.
Removed; the file now runs unconditionally.

---

# ROUND 14 — THE FAILING BAND WAS MY TEST, NOT THE MODEL. THEN I STOPPED TUNING.

## Resolved: the 57–80 m "discrepancy" was comparing unlike with unlike

Below L2 the tower is **four separate legs**; the physical silhouette is `legOuterHalf()`
= inner face + leg width. But `profileHalf()` is the **deck-to-deck** envelope — a faceted
polyline through the platform edges. Between platforms it interpolates deck-edge to
deck-edge, which is *not* the structure, because the decks overhang and the ironwork is
inset.

Comparing the photograph against `profileHalf` in the L1–L2 band therefore compared deck
line against ironwork and produced a bogus **19.3 %** at 63.7 m. Against `legOuterHalf` the
same row agrees to **4.0 %** (29.20 vs 28.08), and 80.2 m to **0.7 %** (24.96 vs 25.13).

**The model was right. The assertion was wrong.** Fixed by selecting the envelope by zone.

## Then four successive adjustments — and each moved the worst to the next boundary

| adjustment | worst moved to |
|---|---|
| zone switch `<=` L2 | 20.6 % at 115.62 (deck read as caisson) |
| deck band 6 m | 17.5 % at 60.86 (band absorbed ironwork 3.2 m above L1) |
| deck band 2.5 m | 19.0 % at 113.13 (2.6 m *below* L2, outside the band) |

**Stopped.** Every adjustment was individually defensible, but a fourth would be fitting the
comparison to the data rather than measuring. The pattern is the same one this project has
already paid for twice — moving a boundary until the test passes.

## The real cause, recorded but NOT implemented

A deck is not a line. **Its silhouette band is asymmetric**: the L1 girders are **7.53 m
deep**, so the deck dominates from ~7.5 m below L1 to only ~2 m above it; the L2 girders are
**4.90 m deep**. A single symmetric band cannot express that, which is why each value
relocated the error instead of removing it.

The correct fix is a per-platform asymmetric band taken from each deck's own recorded
girder depth — not another scalar.

## Where the comparison actually stands

| | |
|---|---|
| calibration | **1.06 %** agreement, 6.43 px/m — passes |
| mean error, 57.63–205 m | **4.67 %** over 474 rows |
| worst | 19.0 % at 113.13 m, inside the L2 deck's girder band |
| 30 m and 276 m | correctly excluded and still asserted as excluded |

**The model's profile is validated to ~5 % mean across the shaft.** The residual is
concentrated at the platform bands and is a limitation of the *comparison*, not evidence of
a model fault.

---

# ROUND 15 — SEVEN ADJUSTMENTS. THE TEST STILL FAILS. IT STAYS FAILING.

## What I did

Made the deck band asymmetric (above ~2 m, below = the platform's recorded girder depth),
corrected L2's girder from 4.90 to the attested **5.03 m** (*« poutres en treillis à double
paroi de 5,03 m »*), and allowed the sampling interval (0.31 m) at the band edges.

Mean improved **4.67 % → 4.46 %**. The worst error did not: it walked
**115.6 → 60.9 → 113.1 → 110.6 → 110.3 m** across the seven adjustments, staying at 17–21 %.

## Why it stays failing

**The photograph reads the deck width (~20.7 m) over a band below L2 that is wider than any
recorded girder depth explains.** The model supplies `legOuterHalf` there (~17.2 m). So
either the deck's silhouette genuinely extends further than the documentation says, or the
run-grouping is merging the deck across more rows than it should, or `legOuterHalf` is
narrow there. **Three candidates, none excluded.**

Adjusting the band cannot distinguish them, and seven attempts have now shown that. The
assertions are left **FAILING** because that is the true state. Tuning them green would
destroy the only instrument this project has.

## Final measured state

| | |
|---|---|
| calibration (height vs width) | **1.06 %** at 6.43 px/m — PASS |
| mean error outside the deck bands | **4.46 %** over 442 rows |
| worst | **16.7 % at y = 110.3 m**, ~5.4 m below the 2nd platform |
| 30 m / 276 m exclusions | asserted, PASS |

**Priority (1) is delivered**: the loop exists, its calibration is sound, it validates the
model to ~4.5 % mean over the shaft, and it honestly reports where it does not.

## The pattern, named for the record

This round repeated the failure the project has now made three times: **moving a boundary
until the test passes.** Caught each time by the fact that the error relocated rather than
disappearing — which is the signal that the model of the comparison, not its parameters,
is what is wrong.

---

# ROUND 16 — ROOT CAUSE FOUND. IT IS PERSPECTIVE, NOT STRUCTURE.

## The raw runs eliminated the artifact hypothesis

Inspecting the dark RUNS around L2 directly (not the grouped span):

| height | span | max internal gap |
|---|---|---|
| 120.0 m | 251 px → 39.1 m | 15 px |
| 115.7 (L2) | 257 px → 40.0 m | 14 px |
| 111.0 m | 266 px → 41.4 m | 15 px |
| 108.0 m | 270 px → 42.0 m | 19 px |

**Continuous and dense** — maximum internal gap 14–19 px. So the grouping is NOT merging
across a void. The photograph is reading a real, deck-width object from ~108 to ~120 m.
Candidate 2 (grouping artifact) is eliminated.

## But that range keeps extending — and the reason is perspective

Setting the band from that measurement (≈ ±7 m at L2) relocated the error to 107.2 m, where
the photograph *still* reads deck width. The eighth such adjustment.

**The cause is now clear: a horizontal platform seen from below projects as a wide band
spanning many rows** — near edge low and wide, far edge high and narrow. The band's extent
therefore depends on the camera's height and distance relative to each platform, and differs
per photograph.

**No vertical band can express that**, because the quantity being modelled is a perspective
projection, not a property of the tower. This is why seven attempts each relocated rather
than reduced the error: the comparison's model of the platform is wrong, not its parameters.

## Consequence — recorded, not implemented

Comparing an orthographic model profile against a **perspective** photograph is sound only
away from horizontal overhangs. Near a platform, the photograph must be **rectified**, or
the platform's projected band must be **modelled from the camera pose**, before any
per-row assertion means anything there.

That is a real piece of work and it is distinct from the extraction.

## Final honest state of the measurement loop

| | |
|---|---|
| calibration (height vs width) | **1.06 %** at 6.43 px/m — **PASS** |
| mean error outside the platform bands | **4.29 %** over 416 rows |
| worst | **14.8 % at 107.2 m** — inside the L2 platform's perspective band |
| 30 m / 276 m | asserted as excluded — **PASS** |

The assertions **stay failing**, because they are true. The model matches the photograph to
~4.3 % mean wherever the comparison is valid, and cannot be measured near the platforms by
this method.

---

# ROUND 18 — MY ROUND-16 CONCLUSION DOES NOT SURVIVE ITS OWN ARITHMETIC

## What I checked

For a pinhole camera, every point on the tower AXIS is at the same horizontal distance, so
the image row is **exactly linear** in height. That is why the two-point calibration came
out exact rather than approximate, and it is confirmed by the third point (the 3rd platform
at 276.13 m landing at row ~713 as the axis-line predicts).

The platform's projected band therefore comes **only** from its near and far edges sitting
at different distances:

```
f/d = 6.462 px/m                       (from the axis calibration)
Δrow = (f/d) × (h_p − h_c) × 2w × d / (d² − w²)
```

For L2 (h = 115.73 m, w = 20.48 m) at d ≈ 1500 m, h_c ≈ 5 m:

```
Δrow ≈ 6.462 × 110.73 × 40.96 × 1500 / 2 249 581 ≈ 19.5 px ≈ 3.1 m
```

## The result contradicts round 16

I measured the photograph reading **deck width over 8+ m** below L2 (108–120 m). The
perspective band is **~3 m**. So **perspective does not explain it** — at least not at
plausible camera distances. Round 16's conclusion was stated with more confidence than the
evidence supported.

Caveats, since d and h_c are estimated rather than measured: a much closer camera would
enlarge the band (Δrow scales roughly as 1/d, so d ≈ 300 m would give ~150 px). The Pont de
Bir-Hakeim is roughly 1.5–2 km from the tower, so 1500 m is the reasonable figure — but
**d is not measured, and the conclusion depends on it.**

## Honest state of the residual

The photograph reads deck width ~8 m below the 2nd platform. **Unexplained.** Candidates
now:

| candidate | status |
|---|---|
| grouping artifact | **eliminated** (round 16 raw runs: max internal gap 14–19 px) |
| perspective band | **~3 m, insufficient** (this round) — unless d is far smaller than assumed |
| the 2nd platform's structure genuinely spans that range | not excluded |
| `legOuterHalf` too narrow there | not excluded |

The honest position is that I do not know, and that a confident explanation was offered one
round early. That is the same failure the project keeps producing: a plausible mechanism
accepted before its magnitude was checked.

---

# ROUND 19 — THE PERSPECTIVE EXPLANATION IS RULED OUT NUMERICALLY

## The band as a function of d, with no assumed focal length

Because `f/d` is already known from the axis calibration (6.462 px/m), the perspective band
reduces to a function of **distance alone**:

```
Δrow ≈ (f/d) × (h_p − h_c) × 2w / d
     = 6.462 × 110.73 × 40.96 / d
     = 29 296 / d   px
```

So the observation **implies** a distance instead of requiring one to be assumed:

| observed band | implies d |
|---|---|
| 19.5 px (3.1 m) | 1500 m |
| 50 px (7.8 m) | 586 m |
| **77 px (the full 108–120 m range)** | **380 m** |

## Implausible, therefore ruled out

To explain the whole observed band by perspective, the camera must be **~380 m** from the
tower. At 380 m a 330 m tower subtends about **47°** — a strongly wide-angle frame. The
photograph does not look like that: the tower sits comfortably within the frame with a
normal field of view and foreground context.

**So perspective is ruled out** as the explanation, on its own arithmetic, without needing
the bridge's true distance.

## Where that leaves the residual

| candidate | status |
|---|---|
| grouping artifact | **eliminated** — raw runs, max internal gap 14–19 px (r16) |
| perspective band | **ruled out** — requires d ≈ 380 m (r19) |
| the 2nd platform's structure genuinely spans that range | **now the leading candidate** |
| `legOuterHalf` too narrow there | still open |

**The leading explanation is now that the model is wrong in that band** — the tower really
is deck-width for several metres below the 2nd platform, and `legOuterHalf` is too narrow
there. That is consistent with the original round-14 finding that the model reads ~17 m
where the photograph reads ~21 m.

**But note the shape of the evidence**: eliminated by *measurement* (the raw runs) and
ruled out by *arithmetic* (the distance implication). Neither step required a new
assumption. That is the standard the previous three rounds did not meet.

## Next action

Test the leading candidate directly: **is the model too narrow just below L2?** The
documented caisson is 31.70 m at 114.73 m. A tower reading 42 m wide at 108 m cannot be a
31.70 m caisson — so either the platform's structure genuinely extends that far, or the
photograph's rows 108–120 m include the deck overhang in a way the model does not
represent. Resolve by reading what the plate says the structure is at those heights.

---

# ROUND 20 — THERE IS NO BAND EDGE. THAT IS WHY EIGHT VALUES ALL RELOCATED.

## The measurement

Searching for the height where the photograph's reading drops from deck-width to
caisson-width:

| height | span | width |
|---|---|---|
| 120.0 m | 251 px | 39.1 m |
| 117.0 | 256 px | 39.8 m |
| 115.7 (L2) | 257 px | 40.0 m |
| 114.0 | 260 px | 40.5 m |
| 111.0 | 266 px | 41.4 m |
| 108.0 | 270 px | 42.0 m |

**Monotonic and smooth. No step.** The platform's structure blends continuously into the
tower; there is no discrete edge between "deck" and "ironwork".

## Both sources are right — about different things

- The **documented caisson is 31.70 m** at 114.73 m. The model reproduces it (~32.5 m
  there), and `legOuterHalf` ≈ 34.1 m at 111 m is consistent with it.
- The **photograph measures the silhouette**, which includes the platform's overhanging
  deck (40.96 m). So it reads ~40 m across that whole range.

Neither is wrong. The model represents **the caisson**; the photograph measures **caisson
plus the platform's structure**. They are different quantities in the same rows.

## Consequence — the comparison is the wrong instrument at the platforms, and not for the reason I gave

Round 16 blamed perspective; round 18 disproved that; round 19 ruled it out numerically.
The real reason is simpler and was visible all along: **an orthographic model with distinct
decks cannot be compared row-by-row against a silhouette in which the decks blend
continuously into the tower.** There is no boundary to set, which is exactly why every band
value relocated the error rather than reducing it.

## Final resolution of the residual — no model fault established

The ~17–21 % "error" at 108–120 m is **the model and the photograph measuring different
things**, not a model fault and not a measurement artifact. The model matches the
photograph to **4.29 % mean** wherever the comparison is valid, and at the platforms the
comparison is not valid.

The assertions therefore stay as they are, with the deck bands excluded and **the reason
now established by measurement rather than assumed**.

## What would settle it properly

A comparison against a source that shows the ironwork WITHOUT the decks — which is what
Plate VII's *rabattement* is: the frame unrolled, decks absent, at 1:200. That returns to
priority (2), still blocked on the chain's legibility.

---

# ROUND 21 — THE PLATE VII HEIGHT CHAIN IS LEGIBLE. BLOCKER PARTLY LIFTED.

## Why the heights read and the widths do not

The heights sit in a **clean margin column** with leader lines; the widths are printed
*inside* the drawing, over the lattice. That is why round 9's repeated failures were on the
widths. Harvesting the margin directly (`research/refs/pVII-margin-strip.png`, plate x
3420–3840, y 1400–7000) gives a readable chain:

```
8,14302 · 8,60677 · 9,09635 · 10,380 · 10,0151 · 10,0285 · 10,530
```
plus a separate annotation **« 24 m 385 Campanile »** (the campanile block height).

## Two results

**1. The structural finding is confirmed on a SECOND plate.** The chain runs ~8.1 m at the
top to ~10.5 m lower down — the panel pitch **grows downward**, exactly as the Plate I
chain said and exactly opposite to v3's assumed uniform 10.27 m. Two independent plates
agreeing on the *shape* of the pitch.

**2. Cross-plate agreement where the ranges overlap:**

| panel | Plate I | Plate VII | |
|---|---|---|---|
| 19 | 9.08613 | **9.09635** | **0.1 % apart** ✓ |
| 18 | 9.60359 | **10.0151 / 10.0195** | 4 % apart ⚠ |

Panel 19 agreeing to **0.1 %** across two plates is the confirmation that the height
transcription is real. And since panel 19 is right, **the 4 % discrepancy at panel 18 is
most likely MY Plate I misread**, not Plate VII.

## Status of the round-9 blocker

**Partly lifted.** The HEIGHT chain is now legible from Plate VII and cross-confirmed. The
WIDTH chain remains blocked — it is printed inside the drawing and my readings there have
been inconsistent.

Since the heights are what determine the **panel pitch and the intermediate floors** — two
of the three things priority (2) needs — this unblocks that part. The per-panel member
sections were already read (rounds 4–5). Only the widths remain unreadable.

---

# ROUND 25 — SECTION CONFLICT. NOT WIRED IN, DELIBERATELY.

## The conflict, three ways

| source | treillis member |
|---|---|
| **Plate VII label** | *Treillis* **45×45×5** angle → **0.045 m** in-plane |
| **My model builds** | **0.18–0.19 m** bars |
| **Research calibration** | **0.180 m**, chosen to reproduce the measured 0.65–0.71 metal fraction |

A factor of four. Wiring 0.045 m in would render the tower as a ghost. But 0.180 m was
calibrated *against a measurement*, so neither can be discarded by fiat.

## The drawing resolves it — and disagrees with its own label

Plate VII is at **1:200**; the scan is ~7.5 px/mm of paper. A 45 mm member should therefore
be **1.7 px** wide on the plate. The drawn X-members measure **8–10 px** — about
**260 mm at 1:200**.

**So the drawn lattice is ~0.26 m wide, which agrees with the calibration (0.18–0.26 m) and
NOT with the "45×45×5" label.**

Most likely reading: **45×45×5 is one specific secondary component** (a lacing angle)
labelled on the drawing, while the main lattice members are the larger built-up sections.
The label is not wrong; it is labelling something other than what I assumed — the same
`pilier`/`pile` trap that produced the leg-width error in the first place.

## Action taken: NONE, deliberately

`plateVII-sections.js` is **not** wired into the builder. Under this objective's own rule —
*discard any figure that cannot be traced to an attested source* — a section I cannot yet
identify with confidence must not enter the geometry. The zone-level 0.18–0.19 m bars stay,
because they are backed by the measured metal fraction.

## Route to resolution — recorded

The drawn member width is **measurable directly off Plate VII** (my ~8–10 px estimate should
be confirmed by sampling the actual stroke widths in Fig. 3). If the drawn value holds near
0.26 m, the calibration is confirmed from an independent direction and the label is a
component annotation. That is a bounded measurement, not a transcription, so it does not
depend on reading 5-decimal numbers.

---

# ROUND 25 (cont.) — MEASURED. BOTH NUMBERS ARE RIGHT. NO CONFLICT.

Sampled 443 ink-run widths across Plate VII Fig. 3 (plate y 4700–5600, x 1900–2900):

| stroke | px | mm on paper | **mm full size (1:200)** |
|---|---|---|---|
| p25 | 2 | 0.27 | **53 mm** |
| median | 4 | 0.53 | 107 mm |
| p75 | 6 | 0.80 | 160 mm |

## Resolution

**The plate carries a member HIERARCHY, not one member size.**

- The **p25 stroke (53 mm) matches the 45×45×5 label** — the label is correct, and the
  drawing is to scale. That lacing is real.
- The **thicker strokes (107–160 mm)** are the larger built-up members, and they are what
  the 0.180 m calibration corresponds to.

So my model's 0.18–0.19 m bars represent the **thick** members and are backed by the measured
metal fraction; the **45×45×5 is the fine lacing**, which the model does not resolve
separately at 6.43 px/m.

## The error avoided

**Wiring the 45×45×5 in as the trellis would have replaced the thick members with the thin
ones** — turning the tower into a ghost and silently deleting the hierarchy that took
several rounds of correction to establish.

Caught by measuring the drawn stroke width *before* acting, rather than after. The three-way
conflict (label / calibration / drawing) was resolved by a fourth measurement, not by
choosing among the three.

## Consequence for `plateVII-sections.js`

Its `SECTIONS_READ` entries are **component sizes**, not effective member widths, and must
NOT be used to set bar widths in the builder. They remain recorded as the documented
component schedule. The builder's effective widths stay as they are.

---

# ROUND 28 — MEASURING THE PLATE VII WIDTHS: ATTEMPT FAILED, CAUGHT IMMEDIATELY

## The idea was sound

Round 25 resolved the section conflict by **measuring** the drawing rather than reading its
labels. Plate VII is a 1:200 development, so its panel widths are measurable the same way —
which would route around the round-9 blocker (the printed widths are illegible).

## The magnitude check killed it in one line

At 1:200 with the scan at ~7.5 px/mm of paper:

```
1 m  ->  1000/200 = 5 mm on paper  ->  5 x 7.5 = 37.5 px
a 17.4 m panel width  ->  ~652 px
```

The scan measured **2000+ px** extents, and the left edge sat pinned at the window boundary
(x ≈ 1500) row after row. **The window x 1500–3900 spans more than Fig. 3**, so the scan was
capturing neighbouring figures and margin content.

**No number from this run is usable.** The check that caught it — does the measured magnitude
match the expected one? — took one arithmetic line, and is the same check whose absence
produced the "314 m tower" at the start of this project.

## The recurring shape, now five times

| round | detector | reported numbers for |
|---|---|---|
| 2 | Plate I outline trace | the caption « DIAGRAMME DE L'ÉLÉVATION » |
| 11 | photo trace from the antenna | the mast |
| 12a | centre-outward seed | the nearest interior member |
| 12b | full-row seed | the statue |
| **28** | **Plate VII width scan** | **neighbouring figures / margin** |

Every one was caught by a magnitude or calibration check, never by eye. **The check is the
only thing that has ever worked**, and it should be the first thing written, not the last.

## Not retried blind

A correct version needs Fig. 3's true x bounds established **visually first** — a crop with
the figure's edges confirmed — before any scan. That is the round-2 lesson, which round 28
shows I still have not made routine.

---

# ROUND 29 — SAME FAILURE, AND AN UNCERTAINTY IN THE CHECK ITSELF

## Retried with corrected bounds — still contaminated

Narrowed the window from x 1500–3900 to **1840–3470** on the reasoning that it had been
overlapping Figs. 2 and 4. **The right edge is still pinned at 3420–3470 — the window
boundary — in row after row.** So Fig. 4's content (or the margin between them) is still
being captured. Measured widths 17–27 m where panels 15–22 should be 17–22 m.

## And the magnitude check was itself built on an unmeasured constant

The check assumed **~7.5 px/mm of paper** for the scan. **I never measured the plate's
physical width.** At 12 px/mm the same extents land at 17.3–26.9 m — much closer to
plausible.

So round 28's confident "the magnitude is 3× wrong" rested on a number I had not verified.
That is a check I proposed as the thing that always works, undermined by the same habit —
**using a recalled constant instead of a measured one.**

## No numbers used

Nothing from rounds 28 or 29 is written into the model. Both runs are recorded as failures.

## What a correct attempt needs, in order

1. **Establish the plate's physical width**, hence px/mm, from the sheet itself (e.g. a
   printed scale bar) — not from assumption.
2. **Establish Fig. 3's x-extent visually**, from an annotated crop, before scanning.
3. Only then measure, and require the result to fall in the expected 17–22 m band before
   accepting it.

Three preconditions, none of which round 28 or 29 satisfied — and all three are the same
lesson this project has now recorded five times.






















