/* MECHANISM VERIFICATION — Node, no browser.
   node src/verify.js                                                     */
import { buildCurve, shotSolution, flight, sightSetting, dragK, DESIGN,
  N2LBF, M2IN, J2FTLB, MS2FPS } from './core.js';

const f = (v, n = 2) => (v === undefined || v === null || Number.isNaN(v)) ? 'n/a' : v.toFixed(n);
const line = (k, v, extra = '') => console.log(`  ${k.padEnd(26)} ${v}${extra ? '   ' + extra : ''}`);

const p = { ...DESIGN };
const t0 = Date.now();
const c = buildCurve(p, 240);
const sh = shotSolution(p, c);
const ms = Date.now() - t0;
const rows = c.rows, last = rows[rows.length - 1];

console.log('='.repeat(74));
console.log('  COMPOUND CROSSBOW — MECHANISM REPORT');
console.log('='.repeat(74));
line('solve time', `${ms} ms`, `(${rows.length} steps)`);
console.log('\n  GEOMETRY');
line('limb tip at brace', `x=${f(rows[0].tL.x, 4)}  z=${f(rows[0].tL.z, 4)}`, `span ${f(2 * rows[0].tL.x * M2IN, 1)} in`);
line('limb tip full draw', `x=${f(last.tL.x, 4)}  z=${f(last.tL.z, 4)}`, `swing ${f(last.tipSwingDeg, 1)} deg`);
line('limb tip travel', `${f(c.tipTravel * 100, 1)} cm`);
line('cam rotation', `${f(last.camRotDeg, 0)} deg`);
line('string track radius', `${f(rows[0].rS * 1000, 0)} -> ${f(last.rS * 1000, 0)} mm`);
line('cable track radius', `${f(rows[0].rC * 1000, 1)} -> ${f(last.rC * 1000, 1)} mm`);
line('brace nock', `${f(c.ctx.braceZ, 4)} m`);
line('full-draw nock', `${f(last.nock.z, 4)} m`);
line('power stroke', `${f(c.strokeIn, 2)} in  (${f(last.s, 4)} m)`);

console.log('\n  DRAW CURVE');
line('peak draw weight', `${f(c.peakF, 1)} N = ${f(c.peakLbf, 1)} lbf`, `at ${f(c.peakFrac * 100, 0)}% of stroke`);
line('holding weight', `${f(c.holdF, 1)} N = ${f(c.holdLbf, 1)} lbf`);
line('let-off', `${f(c.letOff * 100, 1)} %`);
line('stored energy', `${f(c.energy, 1)} J = ${f(c.energy * J2FTLB, 1)} ft-lb`);
line('limb spring constant', `${f(c.k, 0)} N m/rad`, '(derived)');
line('energy identity', `W ${f(c.energy, 2)} J  vs  E_limb ${f(c.E_limb, 2)} J`);
line('  residual', `${c.energyResidual.toExponential(2)} J`, `(${f(c.energyResidualFrac * 100, 10)} %)`);
line('max string tension', `${f(c.maxTs, 0)} N`);
line('max cable tension', `${f(c.maxTc, 0)} N`);
line('tension ratio Tc/Ts', `${f(c.ratioMin, 2)} – ${f(c.ratioMax, 1)}`, `${c.degenerate} degenerate samples flagged`);

console.log('\n  SHOT');
line('bolt', `${f(p.boltMass * 1000, 1)} g = ${f(p.boltMass * 15432.4, 0)} gr`, `${f(p.boltLength * 1000, 0)} mm`);
line('muzzle velocity', `${f(sh.v, 2)} m/s = ${f(sh.vFps, 1)} fps`);
line('muzzle energy', `${f(sh.ke, 1)} J = ${f(sh.ke * J2FTLB, 1)} ft-lb`);
line('moving-mass ratio', `n = ${f(sh.nEff, 3)}`);
line('efficiency', `${f(sh.efficiency * 100, 1)} %`);
line('limb tip speed', `${f(sh.tipSpeedRatio, 2)} x bolt speed`);
line('shaft spine', `${f(sh.spineHz, 1)} Hz`);
line('drag constant k', `${dragK(p).toExponential(3)} 1/m`);

console.log('\n  FORCE CURVE');
console.log('   draw(in)   F(N)  F(lbf)    Ts(N)    Tc(N)  swing(deg) cam(deg)  rS(mm)  rC(mm)    nockZ');
for (let i = 0; i <= 14; i++) {
  const r = rows[Math.round(i / 14 * (rows.length - 1))];
  console.log(`   ${f(r.s * M2IN, 2).padStart(7)} ${f(r.F, 0).padStart(7)} ${f(r.F * N2LBF, 1).padStart(7)} ${f(r.Ts, 0).padStart(8)} ${f(r.Tc, 0).padStart(8)} ${f(r.tipSwingDeg, 2).padStart(10)} ${f(r.camRotDeg, 0).padStart(8)} ${f(r.rS * 1000, 1).padStart(7)} ${f(r.rC * 1000, 1).padStart(7)} ${f(r.nock.z, 4).padStart(8)}`);
}

console.log('\n  EXTERIOR BALLISTICS  (zeroed at 50 m)');
const z = sightSetting(sh.v, 50, p, 50);
console.log(`   time of flight to 50 m ${f(z.time, 3)} s   drop ${f(z.drop * 100, 1)} cm   elevation ${f(z.moa, 2)} MOA`);
console.log('   range   drop(cm)   zero-hold(cm)   v(m/s)   fps    KE(ft-lb)   elev(MOA)  clicks');
for (const R of [10, 20, 30, 40, 50, 60, 70, 80]) {
  const fl = flight(sh.v, R, p);
  const s = sightSetting(sh.v, R, p, 50);
  console.log(`   ${String(R).padStart(4)}m ${f(fl.drop * 100, 0).padStart(10)} ${f(s.need * 100, 0).padStart(14)} ${f(fl.vEnd, 1).padStart(9)} ${f(fl.fpsEnd, 0).padStart(6)} ${f(fl.energyEnd * J2FTLB, 0).padStart(11)} ${f(s.moa, 2).padStart(11)} ${String(s.clicks).padStart(7)}`);
}
console.log(`   velocity retained at 50 m: ${f(flight(sh.v, 50, p).vEnd / sh.v * 100, 1)} %`);

console.log('\n  INTEGRITY CHECKS');
let mono = true, badResid = 0, negF = 0, nonConv = 0;
for (let i = 1; i <= c.rows.indexOf(c.peak); i++) if (rows[i].F < rows[i - 1].F - 1e-6) mono = false;
for (const r of rows) {
  if (!isFinite(r.F)) badResid++;
  if (r.F < -1e-9) negF++;
  if (!r.conv) nonConv++;
}
const negT = rows.filter(r => r.Ts < -1e-6).length;
console.log(`   force rises monotonically to peak   ${mono}`);
console.log(`   draw force never negative           ${negF === 0}   (${negF} bad)`);
console.log(`   solver converged every step         ${nonConv === 0}   (${nonConv} bad)`);
console.log(`   finite force everywhere             ${badResid === 0}`);
console.log(`   string tension never negative       ${negT === 0}`);
console.log(`   energy conserved to machine eps     ${Math.abs(c.energyResidualFrac) < 1e-12}`);
console.log(`   max solver residual                 ${Math.max(...rows.map(r => r.resid)).toExponential(1)}`);
console.log('');
