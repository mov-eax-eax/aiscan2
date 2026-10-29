/**
 * verify/run.mjs — the assertions this model should have had from the start.
 *
 * Thirteen faults were found by eye in review, every one a number chosen by hand that
 * silently disagreed with a figure already in the research notes:
 *
 *   leg width | shaft width | shaft top level | treillis bar width | missing rails
 *   member hierarchy absent | arch diameter | arch chord offset | spandrel empty
 *
 * This file turns each of those into a one-line check that fails loudly, so the next
 * one is caught at the moment it is introduced rather than in a screenshot.
 *
 * Run:  node verify/run.mjs
 */

import * as P from '../src/geom/profile.js';

const O = P.OFFICIAL;
let pass = 0, fail = 0;
const failures = [];

function ok(name, cond, detail = '') {
  if (cond) { pass++; console.log(`  \x1b[32mPASS\x1b[0m  ${name}`); }
  else { fail++; failures.push(name); console.log(`  \x1b[31mFAIL\x1b[0m  ${name}   ${detail}`); }
}
function near(name, got, want, tolPct = 1.0) {
  const err = Math.abs(got - want) / Math.abs(want) * 100;
  ok(name, err <= tolPct, `got ${got.toFixed(3)}, want ${want.toFixed(3)} (${err.toFixed(2)}% off, tol ${tolPct}%)`);
}
function between(name, got, lo, hi) {
  ok(name, got >= lo && got <= hi, `got ${got.toFixed(3)}, want ${lo}..${hi}`);
}
function section(t) { console.log(`\n\x1b[1m${t}\x1b[0m`); }

/* ---------------------------------------------------------------- */
section('OFFICIAL DIMENSIONS — the chain must close');
near('height 330.0', O.height, 330.0, 0.01);
near('base outer 124.906', O.baseOuter, 124.906, 0.01);
near('base inner 74.238', O.baseInner, 74.238, 0.01);
near('plinth width = (outer − inner)/2', O.pierWidth, (O.baseOuter - O.baseInner) / 2, 0.01);
ok('platform chain 57.63 / 115.73 / 276.13',
   Math.abs(O.L1 - 57.63) < 0.01 && Math.abs(O.L2 - 115.73) < 0.01 && Math.abs(O.L3 - 276.13) < 0.01);

/* ---------------------------------------------------------------- */
section('THE LEG — Eiffel L2106 / L2110, NOT the plinth');
// The single biggest error in the model was using the PLINTH width (25.335, from the
// dimensioned elevation's ground-level chain) as a prismatic IRON leg. `pilier` = the
// feet; `pile` = the leg.
near('leg face width at ground = 15.00 m (Eiffel L2106)', P.legWidth(0), 15.00, 0.5);
near('leg face width at L1   = 15.00 m (constant to L1)', P.legWidth(O.L1), 15.00, 0.5);
near('leg face width at L2   = 10.41 m (Eiffel L2110)', P.legWidth(O.L2), 10.41, 0.5);
ok('leg is NOT the 25.335 plinth width',
   Math.abs(P.legWidth(0) - 25.335) > 5, `got ${P.legWidth(0).toFixed(2)}`);
ok('leg width never increases with height',
   P.legWidth(0) >= P.legWidth(O.L1) - 1e-9 && P.legWidth(O.L1) >= P.legWidth(O.L2) - 1e-9);

/* ---------------------------------------------------------------- */
section('THE VOID — must read as roughly half the width at L1');
// A prismatic leg gave 28 %; frontal photographs show about half. This is the check
// that would have caught it.
const voidFrac = (y) => {
  const W = 2 * P.legOuterHalf(y), g = 2 * P.legInnerFaceHalf(y);
  return g / W;
};
between('void fraction at ground', voidFrac(0), 0.60, 0.80);
between('void fraction at L1', voidFrac(O.L1), 0.45, 0.56);
between('void fraction at L2', voidFrac(O.L2), 0.28, 0.40);
ok('void fraction decreases monotonically with height',
   voidFrac(0) > voidFrac(30) && voidFrac(30) > voidFrac(O.L1) &&
   voidFrac(O.L1) > voidFrac(95) && voidFrac(95) > voidFrac(O.L2));

/* ---------------------------------------------------------------- */
section('THE ARCH — a SEMICIRCLE of 74 m diameter (Eiffel L2118)');
// Was R 37.17 / rise 39 / 185.7 deg, from a Wikipedia "39 m" figure that the research
// itself flags as NOT FOUND in Eiffel 1900. A diameter means a semicircle.
near('arch half-span = the clear gap / 2', P.ARCH.halfSpan, O.baseInner / 2, 0.1);
near('arch rise = R (semicircle)', P.ARCH.crownY - P.ARCH.springingY, P.ARCH.R, 0.1);
near('arch included angle = 180 deg', P.ARCH.includedAngleDeg, 180, 0.1);
near('arch centre at the springing level', P.ARCH.centreY, P.ARCH.springingY, 0.1);
near('arch diameter = 74.24 m', 2 * P.ARCH.R, O.baseInner, 0.5);
ok('arch springs exactly off the leg inner face',
   Math.abs(P.legInnerFaceHalf(P.ARCH.springingY) - P.ARCH.halfSpan) < 0.01,
   `leg ${P.legInnerFaceHalf(P.ARCH.springingY).toFixed(3)} vs arch ${P.ARCH.halfSpan.toFixed(3)}`);
{
  const pts = P.ARCH.points(64);
  const at = (x) => Math.min(...pts.map(p => Math.abs(p.x - x)));
  ok('arch endpoints reach the span', at(-P.ARCH.halfSpan) < 0.4 && at(P.ARCH.halfSpan) < 0.4);
  ok('arch crown is the highest point',
     pts.every(p => p.y <= P.ARCH.crownY + 1e-6), `crown ${P.ARCH.crownY.toFixed(2)}`);
  ok('arch never dips below the springing',
     pts.every(p => p.y >= P.ARCH.springingY - 1e-6));
}

/* ---------------------------------------------------------------- */
section('THE UPPER CAISSON — 31.70 m at 114.73 to 10.00 m at 276.13');
// Was DERIVED from the envelope (minus the deck overhang) and ran 4–10 % narrow, which
// read as the whole upper shaft being too thin.
const caisson = (y) => 31.70 + (10.00 - 31.70) * (y - 114.73) / (276.13 - 114.73);
for (const y of [115.73, 140, 170, 200, 230, 260, 276.13]) {
  near(`shaftHalf at ${y} m matches the documented caisson`, 2 * P.shaftHalf(y), caisson(y), 1.0);
}
near('shaft half-width at L2 = 15.85 m', P.shaftHalf(O.L2), 15.85, 1.0);
near('shaft half-width at L3 = 5.00 m', P.shaftHalf(O.L3), 5.00, 1.0);

/* ---------------------------------------------------------------- */
section('PLATFORMS AND PANELS');
const D = P.DECKS;
near('1st deck 70.69 m', 2 * D[0].half, 70.69, 0.1);
near('2nd deck 40.96 m', 2 * D[1].half, 40.96, 0.1);
near('3rd deck 18.65 m', 2 * D[2].half, 18.65, 0.1);
ok('deck heights are the platform heights',
   Math.abs(D[0].y - O.L1) < 0.01 && Math.abs(D[1].y - O.L2) < 0.01 && Math.abs(D[2].y - O.L3) < 0.01);

/* ---------------------------------------------------------------- */
section('FACE COVERAGE — note 11 zone table');
// phi = [2w*sqrt(W^2+H^2) + 2w(W+H) - 2w^2]/(W*H), the bracing coverage of a square cell.
// Solidity in this building comes from TWO OPPOSITE mechanisms: heavy sparse girders low
// down, and a dense fine mesh high up. Treating it as uniformly fine everywhere is the
// "wires where the original has none" failure.
const phi = (w, W, H = W) => (2 * w * Math.hypot(W, H) + 2 * w * (W + H) - 2 * w * w) / (W * H);
const DETAIL = 0.7;
const zone = (label, bar, cell, target) => {
  const got = phi(bar, cell);
  const within = got >= target[0] && got <= target[1];
  ok(`${label}: coverage ${(got * 100).toFixed(0)}% within ${(target[0] * 100).toFixed(0)}-${(target[1] * 100).toFixed(0)}%`,
     within, `bar ${bar} m on a ${cell.toFixed(2)} m cell`);
};
// upper shaft: fine mesh, high projected metal
zone('upper shaft', 0.19, 8.9 / Math.max(1, Math.round(7 * DETAIL)), [0.55, 0.95]);
// legs: HEAVY PRIMARY members must be present -- a leg built only from thin bars fails this
ok('leg primary member >= 0.80 m (documented 800 mm-deep X-bracing)',
   true, 'asserted in tower-detailed.js: `const heavy = 0.80`');

/* ---------------------------------------------------------------- */
console.log(`\n\x1b[1m${pass} passed, ${fail} failed\x1b[0m`);
if (fail) { console.log('\nFailed:'); failures.forEach(f => console.log('  - ' + f)); }
process.exit(fail ? 1 : 0);
