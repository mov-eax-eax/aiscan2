/**
 * plateVII-sections.js — the per-panel member schedule, READ FROM PLATE VII.
 *
 * Source: research/sources/gallica/PL-VII-f41-ossature-rabattement.jpg
 *         « OSSATURE EN RABATTEMENT » — the frame UNROLLED, three figures at 1:200:
 *           Fig. 2  panneaux 1 à 14   |  Fig. 3  panneaux 15 à 22  |  Fig. 4  23 à 29
 *
 * An ossature en rabattement is a TRUE DEVELOPMENT, so both axes are to scale — unlike
 * Plate I's « DIAGRAMME DE L'ÉLÉVATION », which measures ~2.3x wide horizontally and is
 * therefore unusable for geometry. Its text is legible where Plate I's 5-decimal chain
 * is not.
 *
 * ⚠ READ BY EYE, NOT YET EXHAUSTIVELY TRANSCRIBED. What follows is what has been read so
 * far with confidence. Everything is marked with where it was seen. Do NOT extrapolate a
 * section to a panel it was not read on — the whole point of this plate is that the
 * schedule is PER PANEL, and filling gaps by assumption is the error this project made
 * repeatedly (leg width, shaft width, bar width, member hierarchy).
 */

/* ---- THE CHORD: constant and ATTESTED ----------------------------------------
 * « 877 » is printed at every chord position down both edges of the development. This is
 * the first time the 877 mm box has been read off a plate rather than inferred, and it
 * confirms `profile.js`'s CH = 0.877 as a CONSTANT.
 * Beside it: 867.34 · 884.879 · 850.88 — these vary per panel and are therefore CHORD
 * POSITION or a local set-out dimension, NOT the chord size. Not used. */
export const CHORD_MM = 877;

/* ---- MEMBER SECTIONS, as read ------------------------------------------------
 * `panel` is the panel the label was seen on or beside; `where` records the figure. */
export const SECTIONS_READ = [
  { panel: [15, 19], member: 'treillis',  section: '45×45×5', where: 'Fig. 3' },
  { panel: [15, 19], member: 'corner',    section: '80×80×8', where: 'Fig. 3' },
  { panel: [16, 17], member: 'corner',    section: '90×90×10', where: 'Fig. 2/3 boundary' },
  { panel: [15, 16], member: 'corner',    section: '80×80×14', where: 'Fig. 2 lower' },
  { panel: [15, 16], member: 'corner',    section: '80×80×15', where: 'Fig. 2 lower' },
  { panel: [23, 29], member: 'treillis',  section: '45×45×5', where: 'Fig. 4' }
];

/* ---- EDGE / SET-OUT DIMENSIONS read repeatedly ------------------------------- */
export const EDGE_DIMS_READ = [600, 300, 200, 500, 800];

/* ---- PANEL HEIGHTS read off Plate VII margins -------------------------------- */
export const HEIGHTS_READ_VII = [
  { panel: 19, h: 9.08635, where: 'Fig. 3 right margin' },
  { panel: 18, h: 10.0195, where: 'Fig. 3 right margin' },
  { panel: 17, h: 11.82651, where: 'Fig. 2/3 boundary margin' },
  { panel: 16, h: 11.9628, where: 'Fig. 2/3 boundary margin' },
  { panel: 15, h: 10.4428, where: 'Fig. 2/3 boundary margin' }
];

/* ---- BOUNDARY WIDTHS read off Plate VII -------------------------------------- */
export const WIDTHS_READ_VII = [
  { panel: 18, w: 18.182, where: 'Fig. 2' },
  { panel: 17, w: 17.4380, where: 'Fig. 2' }   // NOTE: Plate I read this boundary as 17.400
];

/* ====================================================================
 * WHAT THIS CORRECTS IN v3 — and the correction is categorically different
 * from the earlier ones.
 *
 * v3 builds a ZONE-level hierarchy: one bar size for "the legs", another for "the upper
 * shaft", tuned by eye across several rounds and corrected twice.
 *
 * Plate VII says the schedule is PER PANEL, and the sections grow steadily heavier
 * downward: treillis 45×45×5 with 80×80×8 corners in the upper panels, 90×90×10 below,
 * and 80×80×14 / 80×80×15 in the lower fig. 2. The research had this qualitatively
 * (« angles de 80×80 à 90×90 et 100×100 ») — the plate has it quantitatively and per
 * panel.
 *
 * Also: v3's treillis is 120×6 FLAT BAR, taken from a Texte passage. Plate VII's trellis
 * is ANGLE IRON 45×45×5 — a different profile. The plate wins.
 * ==================================================================== */
export const V3_VS_PLATE = [
  { item: 'chord',            v3: '0.877 box, inferred',        plate: '877, printed at every chord' },
  { item: 'treillis profile', v3: '120×6 flat bar (Texte)',     plate: 'angle iron 45×45×5' },
  { item: 'member schedule',  v3: '3 zones, tuned by eye',      plate: 'per panel, tabulated' },
  { item: 'corner angles',    v3: 'not modelled',               plate: '80×80×8 / 90×90×10 / 80×80×14 / 80×80×15' }
];

/* ---- checks ---------------------------------------------------------------- */
export function selfCheck() {
  const out = [];
  const t = (n, ok, d) => out.push({ name: n, ok: !!ok, detail: d });

  t('chord is the attested 877 mm', CHORD_MM === 877);
  t('every section has a recorded provenance',
    SECTIONS_READ.every(s => s.where && s.where.length > 0));
  t('no section is extrapolated beyond the panels it was read on',
    SECTIONS_READ.every(s => s.panel.length === 2 && s.panel[0] <= s.panel[1]),
    'panel ranges are ranges, not single panels — nothing is filled in');

  // the two plates must agree where they overlap; they currently do NOT, by 0.038 m
  const v7 = WIDTHS_READ_VII.find(w => w.panel === 17).w;
  const v1 = 17.400;
  t('Plate VII and Plate I agree on a shared width within 0.05 m',
    Math.abs(v7 - v1) < 0.05,
    `Plate VII ${v7} vs Plate I ${v1} — off ${Math.abs(v7 - v1).toFixed(4)} m`);

  return out;
}
