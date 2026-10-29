/* MECHANISM DESIGN STUDY — the searches that chose this machine.
   Geometry sets the SHAPE of the draw-force curve; the limb spring only scales
   it.  This file re-runs the three findings the final design rests on.

   node src/design.js                                                    */
import { buildCurve, shotSolution, DESIGN, N2LBF, M2IN, J2FTLB } from './core.js';

const base = { ...DESIGN };

/* The peak force scales linearly with the limb spring, so solve for k. */
function lock(over, target = 845, steps = 70) {
  let o = { ...over };
  for (let i = 0; i < 30; i++) {
    const c = buildCurve({ ...base, ...o }, steps);
    if (!isFinite(c.peakF) || c.peakF <= 0) { o.kSpring = (o.kSpring ?? base.kSpring) * 2; continue; }
    const err = target - c.peakF;
    if (Math.abs(err) < 0.5) break;
    o.kSpring = (o.kSpring ?? base.kSpring) * (1 + err / c.peakF);
  }
  return o;
}
function assess(label, over, steps = 200) {
  const o = lock({ ...over });
  const p = { ...base, ...o };
  const c = buildCurve(p, steps);
  const sh = shotSolution(p, c);
  const last = c.rows[c.rows.length - 1];
  console.log(
    `  ${label.padEnd(22)}` +
    ` cam ${(2 * p.rS0 * 1000).toFixed(0).padStart(4)}mm` +
    ` rot ${last.camRotDeg.toFixed(0).padStart(3)}deg` +
    ` k ${c.k.toFixed(0).padStart(6)}` +
    ` | ${c.peakLbf.toFixed(0).padStart(3)} lbf @${(c.peakFrac * 100).toFixed(0).padStart(3)}%` +
    ` hold ${c.holdLbf.toFixed(0).padStart(3)} lbf` +
    ` let-off ${(c.letOff * 100).toFixed(0).padStart(3)}%` +
    ` E ${c.energy.toFixed(0).padStart(3)}J` +
    ` ${sh.vFps.toFixed(0).padStart(3)}fps` +
    ` eff ${(sh.efficiency * 100).toFixed(0).padStart(2)}%` +
    ` tip ${sh.tipSpeedRatio.toFixed(2)}` +
    ` travel ${(c.tipTravel * 100).toFixed(1).padStart(4)}cm` +
    ` | bad ${c.bad} degen ${c.degenerate}`
  );
  return { c, sh, p };
}

const S = base.powerStroke;
const rSmean = (taper) => S / (2 * base.camSpan) * 1.0;
function taperPair(taper) {
  const m = rSmean(taper);
  return { rS0: m * (2 * taper / (1 + taper)), rS1: m * (2 / (1 + taper)) };
}

console.log('\n=== 1. CABLE TRACK RADIUS controls how far the limbs travel ===');
console.log('    (the moving limb mass is the dominant loss, so this is the efficiency knob)');
for (const rC of [0.006, 0.009, 0.013, 0.018, 0.024, 0.032]) {
  assess(`cable r=${(rC * 1000).toFixed(0)}mm`, { ...taperPair(2.2), rC0: rC, rC1: rC }, 160);
}

console.log('\n=== 2. STRING TRACK TAPER controls let-off ===');
console.log('    (the cam must turn further per inch of string, so the load lever falls)');
for (const t of [1.0, 1.4, 1.8, 2.2, 2.8, 3.5]) {
  assess(`taper ${t.toFixed(1)}:1`, { ...taperPair(t), rC0: 0.013, rC1: 0.013 }, 160);
}

console.log('\n=== 3. LIMB SWEEP ANGLE controls how the tip motion couples to the cable ===');
for (const a of [25, 35, 45, 55, 65]) {
  assess(`limb sweep ${a}deg`, { ...taperPair(2.2), rC0: 0.013, rC1: 0.013, limbAng: a * Math.PI / 180 }, 160);
}

console.log('\n=== 4. POWER STROKE vs CAM SIZE (stroke = 2*rS*theta, so they trade) ===');
for (const st of [0.20, 0.24, 0.28, 0.33]) {
  const m = st / (2 * base.camSpan);
  const taper = 2.2;
  assess(`stroke ${(st * M2IN).toFixed(1)}in`,
    { rS0: m * (2 * taper / (1 + taper)), rS1: m * (2 / (1 + taper)), rC0: 0.013, rC1: 0.013, powerStroke: st }, 160);
}

console.log('\n=== the shipped machine ===');
assess('SHIPPED', {}, 240);
