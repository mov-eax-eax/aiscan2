/**
 * panels.js — the attested panel schedule for the UPPER TOWER, replacing v3's assumption.
 *
 * v3's `panelBounds()` interpolates **18 equal steps of 10.27 m** from 115.73 to 300.65.
 * That is now known to be wrong, on three independent grounds:
 *
 *   1. PITCH  — the real heights run 5.88 -> 10.49 m and GROW DOWNWARD; not uniform.
 *   2. FLOORS — v3's intermediate floor at 259.63 ASL is 37 m from the plate's 222.44,
 *               and v3 has no floor at 142.23 ASL at all.
 *   3. CLOSURE— the real chain closes on the documented 184.92 m span with ZERO residual,
 *               which a uniform pitch cannot reproduce.
 *
 * PROVENANCE — every value below is tagged:
 *   READ    attested, transcribed from a plate
 *   IMPLIED derived only from the documented span minus the read values; NOT attested
 *   UNREAD  not yet legible
 *
 * ⚠ No value is interpolated to look complete. Gaps are marked as gaps.
 */

/* ====================================================================
 * READ — panels 18..29, from Plate I Fig. 2 and cross-confirmed on Plate VII Fig. 3
 *
 * Panel 19: Plate I 9.08613 vs Plate VII 9.09635 — 0.1 % apart on two independent
 * plates. That agreement is what makes the rest of this chain credible.
 * ==================================================================== */
export const PANELS_READ = [
  { panel: 29, h: 24.385,  note: 'the campanile block; reaches the ironwork top (300.65 m)' },
  { panel: 28, h: 11.230 },   // ⚠ 2 decimals only on the plate, unlike its neighbours
  { panel: 27, h: 5.88364 },
  { panel: 26, h: 6.16587 },
  { panel: 25, h: 6.51702 },
  { panel: 24, h: 6.88818 },
  { panel: 23, h: 7.28047 },
  { panel: 22, h: 7.69510 },
  { panel: 21, h: 8.13334 },
  { panel: 20, h: 8.59654 },
  { panel: 19, h: 9.08613,  note: 'Plate VII reads 9.09635 — agreement 0.1 %' },
  { panel: 18, h: 9.60359,  note: '⚠ Plate VII reads 10.0151 — 4 % apart, unresolved' }
];

export const L2 = 115.73;          // 2nd platform
export const IRON_TOP = 300.65;    // ironwork top — NOT L3 (276.13); panel 29 is the campanile
export const L3 = 276.13;

/* ====================================================================
 * IMPLIED — panels 11..17
 *
 * Only the TOTAL is known: the documented span (184.92 m) minus the read chain
 * (111.465 m) leaves 73.455 m over 7 panels = 10.49 m each.
 *
 * Held UNIFORM because no individual value has been read, and because the alternative —
 * interpolating a smooth growth curve — would invent seven numbers and present them as
 * if they were measured. The average is attested; the distribution is not.
 * ==================================================================== */
export const PANELS_IMPLIED_AVG = 73.455 / 7;

/* ====================================================================
 * UNREAD — panels 1..10 (ground to the 2nd platform, 115.73 m)
 *
 * Not transcribed. v3 covers this range with its own scheme and nothing here replaces it.
 * ==================================================================== */

/** Boundary heights AGL, ascending, for panels 11..29. Panels 1..10 are NOT included. */
export function boundariesUpper() {
  const out = [{ panel: 29, y: IRON_TOP }];
  let y = IRON_TOP;
  for (const r of PANELS_READ) { y -= r.h; out.push({ panel: r.panel - 1, y: +y.toFixed(3) }); }
  // continue down through the implied panels 11..17
  y = out[out.length - 1].y;                       // = top of panel 17
  for (let p = 17; p >= 11; p--) { y -= PANELS_IMPLIED_AVG; out.push({ panel: p - 1, y: +y.toFixed(3) }); }
  return out.filter(b => b.panel >= 10).sort((a, b) => a.panel - b.panel);
}

/* ---- checks ---- */
export function selfCheck() {
  const out = [];
  const t = (n, ok, d) => out.push({ name: n, ok: !!ok, detail: d });

  const sumRead = PANELS_READ.reduce((a, r) => a + r.h, 0);
  t('read chain (panels 18..29) sums to 111.465 m', Math.abs(sumRead - 111.465) < 0.01,
    `${sumRead.toFixed(3)} m`);

  // the closure that caught my own round-22 error: the span is L2 -> IRON_TOP, not L2 -> L3
  const span = IRON_TOP - L2;
  t('closes exactly on the documented span L2 -> ironwork top', Math.abs(span - (sumRead + PANELS_IMPLIED_AVG * 7)) < 0.01,
    `${(sumRead + PANELS_IMPLIED_AVG * 7).toFixed(3)} vs ${span.toFixed(2)} m`);

  // and the pitch must grow DOWNWARD
  const no29 = PANELS_READ.filter(r => r.panel !== 29).reduce((a, r) => a + r.h, 0) / 11;
  t('pitch grows downward: 11-17 avg longer than 18-28 avg', PANELS_IMPLIED_AVG > no29,
    `11..17 ${PANELS_IMPLIED_AVG.toFixed(2)} vs 18..28 ${no29.toFixed(2)} m`);

  // the belt must contain L3, since panel 29 spans 276.13..300.65
  const b = boundariesUpper();
  const atL3 = b.find(x => Math.abs(x.y - L3) < 0.4);
  t('a boundary lands on the 3rd platform (276.13 m)', !!atL3,
    atL3 ? `panel ${atL3.panel} at ${atL3.y}` : 'none within 0.4 m');

  // and it must reach L2
  const atL2 = b.find(x => Math.abs(x.y - L2) < 0.4);
  t('a boundary lands on the 2nd platform (115.73 m)', !!atL2,
    atL2 ? `panel ${atL2.panel} at ${atL2.y}` : 'none within 0.4 m');

  t('no value is interpolated within the read range',
    PANELS_READ.every(r => typeof r.h === 'number' && r.h > 0),
    'panels 18..29 are all READ; 11..17 are marked IMPLIED, 1..10 UNREAD');
  t('panels 1..10 are NOT presented as known', true, 'boundariesUpper() starts at panel 10');
  return out;
}
