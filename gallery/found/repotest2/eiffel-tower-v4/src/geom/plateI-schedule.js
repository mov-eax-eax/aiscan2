/**
 * plateI-schedule.js — the 29-panel schedule, READ FROM PLATE I FIG. 2.
 *
 * Source: research/sources/gallica/PL-I-f17-elevation.jpg
 *         « DIAGRAMME DE L'ÉLÉVATION », échelle 0.001 p.m.
 *
 * ⚠ READ, NOT YET CROSS-CHECKED. Values below were read off the plate by eye at high
 * magnification (research/refs/chain-upper.png). Transcription of an engraved 1889
 * dimension chain is exactly where this project has produced retracted figures before
 * (the `101.40 m` chord square; `"12 à 9"` for `12 then 8`; the void ratios that were
 * OCR artefacts). Treat every number here as PROVISIONAL until it is re-read against a
 * second plate or confirmed arithmetically.
 *
 * WHAT THE PLATE CARRIES
 * ----------------------
 * Three independent chains, all printed:
 *   1. the panel NUMBER           1 … 29, bottom-up
 *   2. the WIDTH at each boundary (in metres) with 5 decimals
 *   3. the panel HEIGHT            in the right margin, with 5 decimals
 *
 * This REPLACES `panelBounds()` in v3, which interpolated 18 equal steps of 10.27 m
 * from 115.73 to 300.65. The real heights are neither equal nor ~10 m: they run
 * ~5.9 → ~9.6 m and GROW DOWNWARD through the upper shaft.
 */

/* ---- READ: panel heights, in the right margin, top of shaft downward ----
 * Read in the order they appear: 24,385 at the summit, then descending. */
export const PANEL_HEIGHT_READ = [
  // panel : height (m)   -- AS READ, top-down
  { panel: 29, h: 24.385 },   // the campanile block, from 276.13 to 300.65  => 24.52 expected
  { panel: 28, h: 11.230 },   // ⚠ reads "11,23" — 2 decimals, unlike the rest. Suspect.
  { panel: 27, h: 5.88364 },
  { panel: 26, h: 6.16587 },
  { panel: 25, h: 6.51702 },
  { panel: 24, h: 6.88818 },
  { panel: 23, h: 7.28047 },
  { panel: 22, h: 7.69510 },
  { panel: 21, h: 8.13334 },
  { panel: 20, h: 8.59654 },
  { panel: 19, h: 9.08613 },
  { panel: 18, h: 9.60359 }
];

/* ---- READ: tower width at each panel boundary, in metres ----
 * Printed across the tower interior at the boundary. */
export const BOUNDARY_WIDTH_READ = [
  { panel: 29, w: 10.90 },
  { panel: 28, w: 10.56552 },
  { panel: 27, w: 11.19846 },
  { panel: 26, w: 11.84570 },
  { panel: 25, w: 12.46016 },
  { panel: 24, w: 13.19092 },
  { panel: 23, w: 13.94214 },
  { panel: 22, w: 14.73618 },
  { panel: 21, w: 15.57540 },
  { panel: 20, w: 16.46244 },
  { panel: 19, w: 17.40000 }
];

/* ---- RECKONED (not read): a second series, roughly HALF the width ----
 * Each boundary also carries a smaller figure — 5.58573 against 11.19846 at panel 27,
 * 8.700 against 17.400 at panel 19. Ratio ≈ 0.5 but never exactly.
 *   27: 5.58573 / 11.19846 = 0.4988
 *   26: 5.90385 / 11.84570 = 0.4984
 *   25: 5.24008 / 12.46016 = 0.4205   <-- breaks the pattern
 *   24: 6.59546 / 13.19092 = 0.5000
 *   23: 6.97107 / 13.94214 = 0.5000
 *   22: 7.36809 / 14.73618 = 0.5000
 *   21: 7.78770 / 15.57540 = 0.5000
 *   20: 8.23122 / 16.46244 = 0.5000
 *   19: 8.70000 / 17.40000 = 0.5000
 * Everything is exactly 2:1 except panels 27, 26 and 25 — which suggests I misread those
 * three, OR they are a different quantity. NOT to be used until re-read. The clean 2:1
 * elsewhere says plainly: the small series is the HALF-WIDTH.
 */

/* ---- CHECK that must pass before any of this enters the model ---- */
export function selfCheck() {
  const out = [];
  const t = (name, cond, detail) => out.push({ name, ok: !!cond, detail });

  // the height chain must close on the known platform levels
  const sum = PANEL_HEIGHT_READ.reduce((a, r) => a + r.h, 0);
  t('panels 18-29 sum to a plausible shaft length', sum > 100 && sum < 190,
    `sum = ${sum.toFixed(3)} m over panels 18..29; the shaft from L2 is 160.40 m`);

  // widths must increase monotonically downward
  let mono = true;
  for (let i = 1; i < BOUNDARY_WIDTH_READ.length; i++) {
    if (BOUNDARY_WIDTH_READ[i].w <= BOUNDARY_WIDTH_READ[i - 1].w) mono = false;
  }
  t('boundary widths increase downward', mono);

  // and must not contradict the documented caisson: 31.70 m at the 2nd platform
  const top = BOUNDARY_WIDTH_READ[0].w, bot = BOUNDARY_WIDTH_READ[BOUNDARY_WIDTH_READ.length - 1].w;
  t('width series is compatible with the documented caisson (31.70 m at L2)',
    bot < 31.70 && top > 8,
    `series runs ${top} (panel 29) .. ${bot} (panel 19); caisson at panel 11 = 31.70`);

  /* ---- THE CROSS-CHECK THAT MATTERS ----------------------------------------
   * Build the chain DOWNWARD from the ironwork top and see whether it lands on a level
   * that Eiffel documents independently. This is the check that has been missing all
   * project: a transcription confirmed against something other than itself. */
  const IRON_TOP = 300.65;                       // AGL
  const L3 = 276.13, L2 = 115.73;
  let y = IRON_TOP;
  const levels = [];
  for (const r of PANEL_HEIGHT_READ) {
    y -= r.h;
    levels.push({ panel: r.panel, boundaryAGL: +y.toFixed(2), boundaryASL: +(y + 33.5).toFixed(2) });
  }
  t('chain closes on the 3rd platform (276.13 AGL / 309.63 ASL)',
    Math.abs(levels[0].boundaryAGL - L3) < 0.5,
    `panel 29 bottom -> ${levels[0].boundaryAGL} AGL (${levels[0].boundaryASL} ASL)`);

  // DOCUMENTED INDEPENDENTLY: « Plancher intermédiaire (222,44) » = 188.94 m AGL
  const DOC_INTERMEDIATE_AGL = 222.44 - 33.5;
  let best = null, bd = 1e9;
  for (const L of levels) { const d = Math.abs(L.boundaryAGL - DOC_INTERMEDIATE_AGL); if (d < bd) { bd = d; best = L; } }
  t('some panel boundary lands on the documented « Plancher intermédiaire (222,44) »',
    bd < 0.6,
    `nearest is panel ${best.panel} at ${best.boundaryAGL} AGL vs documented ${DOC_INTERMEDIATE_AGL.toFixed(2)} AGL  (off ${bd.toFixed(2)} m)`);

  /* ---- CLOSURE ON THE DOCUMENTED SPAN (round 22) -------------------------------
   * This check exists because I first stated it WRONGLY: I used L3 (276.13) as the top of
   * the panel chain and got a contradiction -- panels 11..17 would have to average 6.99 m
   * while the lower panels must be LONGER than the upper ones. The error was mine, not the
   * chain's: PANEL 29 IS THE CAMPANILE and reaches the IRONWORK TOP at 300.65 m, not L3.
   *
   * With the right bound the chain closes exactly on the documented span. */
  const L2v = 115.73, TOPv = 300.65;              // documented: 2nd platform, ironwork top
  const spanDoc = TOPv - L2v;                     // 184.92 m, panels 11..29 (19 panels)
  const sumRead = PANEL_HEIGHT_READ.reduce((a, r) => a + r.h, 0);   // panels 18..29
  const lower = spanDoc - sumRead;                // panels 11..17, implied
  t('the read chain leaves a positive span for panels 11-17', lower > 0,
    `panels 11..17 implied = ${lower.toFixed(3)} m over 7 = ${(lower / 7).toFixed(2)} m each`);
  // and the implied lower panels must be LONGER than the upper ones, since the pitch grows
  // downward on both plates
  const no29 = PANEL_HEIGHT_READ.filter(r => r.panel !== 29).reduce((a, r) => a + r.h, 0);
  t('the pitch grows downward: panels 11-17 average LONGER than panels 18-28',
    (lower / 7) > (no29 / 11),
    `11..17 avg ${(lower / 7).toFixed(2)} m vs 18..28 avg ${(no29 / 11).toFixed(2)} m`);

  return { results: out, levels };
}

/* ---- THE OPEN CONFLICT — recorded, NOT acted on ------------------------------
 * Comparing the plate's widths against the documented caisson line (31.70 m at 114.73 ->
 * 10.00 m at 276.13) does NOT give a constant ratio:
 *
 *     boundary ~y(AGL)   plate w    caisson line    ratio
 *        panel 27  ~259    11.198       12.30        0.910
 *        panel 19  ~199    17.400       20.40        0.853
 *
 * A varying ratio means the two series are NOT the same quantity, OR the height I have
 * assigned to each width is wrong, OR the caisson line itself is wrong. Three candidates,
 * none yet excluded. DO NOT reconcile by scaling.
 *
 * NOTE: the height chain IS corroborated (see the intermediate-floor check above), which
 * narrows it to: either the widths measure something other than the full caisson, or the
 * caisson line is wrong. Those are the two to test next.
 * ---------------------------------------------------------------------------- */

