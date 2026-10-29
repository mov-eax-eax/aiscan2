/**
 * extract-plate-profile.mjs — read the true elevation envelope off Plate I Fig. 2.
 *
 * PL-I-f17-elevation.jpg is « DIAGRAMME DE L'ÉLÉVATION », échelle 0.001 p.m. — an
 * ORTHOGRAPHIC elevation at 1:1000, ~13.5 px/m. No rectification is needed, which
 * removes the hardest step from the measurement plan.
 *
 * METHOD — and why it is a contour TRACE and not a per-row scan:
 *   A naive "outermost dark pixel per row" is exactly the failure that produced the
 *   "314 m tower" earlier in this project: the scan walked out of the subject and into
 *   a neighbouring element (there, the ground; here, the dimension chains and margin
 *   text that flank Fig. 2). So instead we TRACE the outline — start at a known point
 *   on the curve and step row by row, staying within a small window of the previous
 *   position. The chains are metres away and can never be reached.
 *
 * Run: node extract-plate-profile.mjs <path-to-plate.jpg> <out.json>
 */
import { readFileSync, writeFileSync } from 'node:fs';

const PLATE = process.argv[2];
const OUT = process.argv[3] || 'plate1-profile.json';

/* A minimal JPEG-ish loader is not available in Node without deps, so the pixel work is
 * done by a PowerShell helper that emits raw luminance. This module only does the
 * geometry: trace, calibrate, and emit the profile. */
const raw = JSON.parse(readFileSync(process.argv[4] || 'plate1-raw.json', 'utf8'));
const { x0, y0, w, h, lum /* Int array, row-major, 0..255 */ } = raw;

const DARK = 150;                       // ink below this, paper above
const at = (x, y) => lum[(y - y0) * w + (x - x0)];

/* ---- 1. the crown: highest row with ink near the centre line ---- */
const cx = x0 + Math.round(w * 0.5);
let centre = cx;
{
  // refine the centre line from the widest full row in the shaft, so the trace is
  // symmetric about the real axis rather than the crop's middle
  let bestW = 0, bestX = cx;
  for (let y = y0 + Math.round(h * 0.45); y < y0 + Math.round(h * 0.55); y += 3) {
    let l = cx, r = cx;
    while (l > x0 && at(l, y) >= DARK) l--;
    while (r < x0 + w - 1 && at(r, y) >= DARK) r++;
    if (r - l > bestW) { bestW = r - l; bestX = (l + r) >> 1; }
  }
  centre = bestX;
}
console.log(`centre line x = ${centre}  (crop centre ${cx})`);

/* ---- 2. trace the two outlines downward ---- */
function trace(side) {           // side = -1 left, +1 right
  const pts = [];
  let x = centre;
  let started = false;
  for (let y = y0 + 4; y < y0 + h - 4; y++) {
    // window: how far the outline may move per row. Steep at the base, so scale with y.
    const win = started ? 6 : 2;
    let found = -1;
    if (!started) {
      // look for the first ink either side of the centre within a small band
      for (let d = 2; d < 60; d += 1) {
        const xx = centre + side * d;
        if (xx > x0 && xx < x0 + w - 1 && at(xx, y) < DARK) { found = xx; break; }
      }
      if (found >= 0) { started = true; x = found; }
    } else {
      // stay on the outline: search outward-in from the previous position
      for (let d = 0; d <= win; d++) {
        for (const xx of [x - d, x + d]) {
          if (xx > x0 && xx < x0 + w - 1 && at(xx, y) < DARK) { found = xx; break; }
        }
        if (found >= 0) break;
      }
      // if nothing within the window, allow a larger jump (panel steps)
      if (found < 0) {
        for (let d = win; d < 40; d++) {
          const xx = x + side * d;
          if (xx > x0 && xx < x0 + w - 1 && at(xx, y) < DARK) { found = xx; break; }
        }
      }
      if (found >= 0) x = found;
    }
    if (started) pts.push({ y, x });
  }
  return pts;
}

const left = trace(-1), right = trace(1);
console.log(`traced ${left.length} rows left, ${right.length} rows right`);
console.log(`  left  y ${left[0]?.y} .. ${left[left.length - 1]?.y}`);
console.log(`  right y ${right[0]?.y} .. ${right[right.length - 1]?.y}`);

/* ---- 3. calibrate px -> m, on TWO independent constraints ---- */
const topY = Math.min(left[0].y, right[0].y);
// ground: the last row where BOTH outlines exist and the half-width is still growing
let groundY = 0, widest = 0;
for (const p of left) {
  const q = right.find(r => r.y === p.y);
  if (!q) continue;
  const half = Math.abs(q.x - p.x) / 2;
  if (half > widest) { widest = half; groundY = p.y; }
}
const heightPx = groundY - topY;
const scaleV = 330 / heightPx;               // m per px, vertical  (known: 330 m)
const baseW = widest * 2;                    // px
const scaleH = 124.906 / baseW;              // m per px, horizontal (known: 124.906 m)
console.log(`top y=${topY}  ground y=${groundY}  height=${heightPx} px`);
console.log(`  vertical   : ${scaleV.toFixed(4)} m/px  (${(1 / scaleV).toFixed(2)} px/m)`);
console.log(`  horizontal : ${scaleH.toFixed(4)} m/px  (${(1 / scaleH).toFixed(2)} px/m)`);
console.log(`  agreement  : ${(100 * Math.abs(scaleV - scaleH) / scaleV).toFixed(2)} %`);
if (Math.abs(scaleV - scaleH) / scaleV > 0.03) {
  console.log('  *** the two scales disagree by >3 % -- the traced region is WRONG. Do not use. ***');
}

/* ---- 4. emit the half-width profile in metres above ground ---- */
const prof = [];
for (const p of left) {
  const q = right.find(r => r.y === p.y);
  if (!q) continue;
  const halfPx = Math.abs(q.x - p.x) / 2;
  const yAGL = (groundY - p.y) * scaleV;
  if (yAGL < 0 || yAGL > 330) continue;
  prof.push({ y: +yAGL.toFixed(3), half: +(halfPx * scaleH).toFixed(3) });
}
prof.sort((a, b) => a.y - b.y);
writeFileSync(OUT, JSON.stringify({ scaleV, scaleH, topY, groundY, profile: prof }, null, 0));
console.log(`wrote ${OUT} : ${prof.length} rows`);

/* ---- 5. report against the model, at the platform heights ---- */
const P = await import('../src/geom/profile.js');
console.log('\n  y(m)   plate half   model half   err');
for (const y of [0, 5, 20, 40, 57.63, 80, 115.73, 150, 200, 250, 276.13, 300]) {
  let best = null, bd = 1e9;
  for (const r of prof) { const d = Math.abs(r.y - y); if (d < bd) { bd = d; best = r; } }
  if (!best || bd > 4) continue;
  const m = P.profileHalf(best.y);
  console.log(`  ${String(best.y).padStart(6)}   ${best.half.toFixed(2).padStart(8)}   ${m.toFixed(2).padStart(9)}   ${(100 * (m - best.half) / best.half).toFixed(1)}%`);
}
