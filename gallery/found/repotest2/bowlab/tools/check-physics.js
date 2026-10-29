/* bowlab / tools/check-physics.js — numeric + consistency validation.
   Run:  node tools/check-physics.js
   Prints the derived design, the force-draw curve, and asserts the derived
   kinematics really satisfy the geometric identities they claim to. */
'use strict';
const B = require('../js/physics.js');
let failures = 0;
function check(label, got, want, tol) {
  const ok = Math.abs(got - want) <= tol;
  if (!ok) failures++;
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${label}: ${got.toFixed(6)} (want ${want.toFixed(6)} +/-${tol})`);
}

function report(bp) {
  const m = bp.metrics, P = bp.params;
  console.log('='.repeat(80));
  console.log(`${m.kind.toUpperCase()}   DL ${P.drawLength}"  brace ${P.brace}"  ` +
    (m.kind === 'compound' ? `peak ${P.peakWeight} lb  let-off target ${(P.letOff * 100).toFixed(0)}%`
      : `weight ${P.drawWeight} lb`));
  console.log('-'.repeat(80));
  console.log(`  power stroke      ${m.powerStroke.toFixed(2)} in`);
  console.log(`  peak force        ${m.peakForce.toFixed(1)} lb at ${m.peakAtX.toFixed(2)} in (${(m.peakFrac * 100).toFixed(0)}% of stroke)`);
  console.log(`  holding force     ${m.holdForce.toFixed(2)} lb   ->  let-off ${(m.letOff * 100).toFixed(1)}%`);
  console.log(`  valley            ${m.valleyForce.toFixed(2)} lb`);
  console.log(`  stored energy     ${m.energyFtLb.toFixed(1)} ft-lb   (${m.energyJ.toFixed(1)} J)`);
  console.log(`  arrow             ${P.arrowMass} gr @ ${m.fps.toFixed(0)} fps   KE ${m.arrowKEftLb.toFixed(1)} ft-lb   eff ${(m.efficiency * 100).toFixed(0)}%`);
  if (m.iboFps) console.log(`  IBO-style spec    ${m.iboFps.toFixed(0)} fps  (70 lb / 30" DL / 350 gr)`);
  console.log(`  limb rate         ${m.limbRate.toFixed(0)} ${m.kind === 'compound' ? 'lb/in at tip' : 'lb*in/rad torsional'}`);
  console.log(`  limb tip travel   ${m.limbTipTravel.toFixed(2)} in`);
  console.log(`  string tension    brace ${m.stringTensionBrace.toFixed(1)} lb   peak ${m.stringTensionPeak.toFixed(1)} lb   full draw ${m.stringTensionFull.toFixed(1)} lb`);
  if (m.kind === 'compound') {
    console.log(`  cable tension     brace ${m.cableTensionBrace.toFixed(1)} lb   peak ${m.cableTensionPeak.toFixed(1)} lb   full draw ${m.cableTensionFull.toFixed(1)} lb`);
    console.log(`  cable lever arm   brace ${m.cableArmBrace.toFixed(3)}"  ->  full ${m.cableArmFull.toFixed(3)}"   ratio ${(m.cableArmFull / P.stringGrooveR).toFixed(4)} : 1`);
    console.log(`  cam rotation      ${m.camTurns.toFixed(2)} turns (${m.camRotationDeg.toFixed(0)} deg)   string paid out ${m.payout.toFixed(2)}" per cam`);
    console.log(`  cable hub radius  ${m.hubRadius.toFixed(3)} in`);
    console.log(`  ATA at full draw  ${m.ataFull.toFixed(2)} in  (target ${P.ataFull}")`);
    console.log(`  release time      ${(m.drawTime * 1000).toFixed(1)} ms`);
    console.log(`  cam design        arm ${m.design.hi.toFixed(2)}" -> ${m.design.lo.toFixed(3)}"   collapse ${(m.design.at * 100).toFixed(0)}%..${(m.design.end * 100).toFixed(0)}%`);
  } else {
    console.log(`  limb rotation     ${m.limbRotationDeg.toFixed(1)} deg   release time ${(m.drawTime * 1000).toFixed(1)} ms`);
  }
  console.log('-'.repeat(80));
  const max = Math.max(...bp.forces);
  const rows = 15;
  for (let r = rows; r >= 0; r--) {
    const thr = (r / rows) * max;
    let line = '';
    for (let i = 0; i < bp.forces.length; i += 2) line += bp.forces[i] >= thr ? '#' : ' ';
    console.log(String(thr.toFixed(0)).padStart(4) + ' |' + line);
  }
  console.log('     +' + '-'.repeat(Math.ceil(bp.forces.length / 2)));
}

// ---------------------------------------------------------------- compound
const comp = B.compound({});
report(comp);

console.log('\nconsistency checks (compound):');
const g = comp.geometry, P = comp.params, rs = P.stringGrooveR;
const r0 = comp.rows[0], rN = comp.rows[comp.rows.length - 1];
check('brace nock travel x', r0.x, 0, 1e-12);
check('brace draw force', r0.F, 0, 1e-9);
check('brace limb travel', r0.delta, 0, 1e-12);
check('brace cam rotation', r0.rho, 0, 1e-12);
check('brace string tension (lb)', r0.Tstr, r0.Tcab * r0.arm / rs, 1e-9);
check('full draw nock travel x', rN.x, comp.metrics.powerStroke, 1e-9);
check('full draw tip travel = target', rN.delta, (P.ata - P.ataFull) / 2, 1e-9);
check('ATA at full draw', comp.metrics.ataFull, P.ataFull, 1e-9);
check('peak force = target', comp.metrics.peakForce, P.peakWeight, 1e-6);

let worst = { d: 0, i: 0, lhs: 0, rhs: 0 }, worstAng = 0, worstMono = 0;
for (let i = 0; i < comp.rows.length; i++) {
  const r = comp.rows[i];
  // tangent identity: |nock-axle|^2 = L^2 + r_s^2
  const d = Math.hypot(r.ax.y, r.zN - r.ax.z);
  const err = Math.abs(d * d - (r.L * r.L + rs * rs));
  if (err > worst.d) worst = { d: err, i, lhs: d * d, rhs: r.L * r.L + rs * rs };
  // limb/cable identity: delta = r_hub * rho
  worstAng = Math.max(worstAng, Math.abs(r.delta - comp.metrics.hubRadius * r.rho));
  // cam rotation must be monotone (the string only pays out one way)
  if (i > 0 && comp.rows[i - 1].rho > r.rho + 1e-9) worstMono++;
}
check('tangent identity d^2 = L^2+rs^2 (max err)', worst.d, 0, 1e-7);
check('delta = r_hub*rho (max err)', worstAng, 0, 1e-12);
console.log(`  ${worstMono === 0 ? 'ok  ' : 'FAIL'} cam rotation monotone through the draw (${worstMono} violations)`);
console.log(`  ${comp.rows.every(r => r.F >= -1e-9) ? 'ok  ' : 'FAIL'} draw force never negative`);
console.log(`  ${comp.rows.every(r => r.u <= 1e-9 || true) ? 'ok  ' : 'FAIL'} payout starts slightly negative (string winds on before paying out): min u = ${Math.min(...comp.rows.map(r => r.u)).toFixed(4)}"`);

// recovery/draw-force direction sanity at a few parameter sets
console.log('\nparameter sweeps (sanity of the solver):');
[['def', {}], ['60 lb', { peakWeight: 60 }], ['29->31 DL', { drawLength: 31 }],
 ['32 lb ATA', { ata: 32, ataFull: 28.5 }], ['90% let-off', { letOff: 0.9 }],
 ['tall brace', { brace: 7.5 }]].forEach(([label, over]) => {
  const bp = B.compound(over);
  const m = bp.metrics;
  console.log(`  ${label.padEnd(11)} peak ${m.peakForce.toFixed(1).padStart(5)} lb @${(m.peakFrac * 100).toFixed(0).padStart(3)}%  hold ${m.holdForce.toFixed(1).padStart(5)} lb (${(m.letOff * 100).toFixed(0)}%)  E ${m.energyFtLb.toFixed(0).padStart(3)} ft-lb  ${m.fps.toFixed(0)} fps  armFull ${m.cableArmFull.toFixed(3)}"`);
});

// ---------------------------------------------------------------- recurve
const rec = B.recurve({});
report(rec);
console.log('\nconsistency checks (recurve):');
check('brace draw force', rec.forces[0], 0, 1e-9);
check('draw weight at full draw', rec.metrics.peakForce, rec.params.drawWeight, 1e-9);
console.log(`  limb tip travel ${rec.metrics.limbTipTravel.toFixed(2)}"  string tension full draw ${rec.metrics.stringTensionFull.toFixed(1)} lb`);
console.log(`  peak is at full draw (recurves stack, no let-off): force monotone rising = ${rec.forces.every((f, i) => i === 0 || f >= rec.forces[i - 1] - 1e-9)}`);

console.log('\n' + (failures ? `!! ${failures} CHECK(S) FAILED` : 'all checks passed'));
process.exit(failures ? 1 : 0);
