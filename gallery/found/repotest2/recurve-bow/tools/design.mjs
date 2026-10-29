/* Design solver: picks the two limb constants (arc length L and butt angle
   theta0) so the integrated limb actually produces the bow we specified --
   65" string (68" AMO) and 8.75" brace.  Nested bisection on two monotone
   scalars; no gradients, nothing to diverge.

   node tools/design.mjs            report current param.js
   node tools/design.mjs --write    solve and print the param.js lines to paste */
import * as L from '../src/limb.js';
import * as S from '../src/string.js';
import { RISER, TARGET, LIMB } from '../src/param.js';

const THROAT_Z = Math.max(...RISER.profile.map(r => r[3]));
const TARGET_STRING = TARGET.amo - 3.0;          // AMO: bow length = string + 3"

export function evaluate(Lval, theta0) {
  LIMB.L = Lval; LIMB.theta0 = theta0;
  const up = L.bellyProfile(0);
  const dn = up.map(([z, y]) => [z, -y]);
  const { path } = S.tautPath(up, dn, null);
  const len = S.pathLength(path);
  /* where the string crosses the bow's centreline -- that is the nock */
  let z0 = null;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1], b = path[i];
    if ((a[1] <= 0 && b[1] >= 0) || (a[1] >= 0 && b[1] <= 0)) {
      if (Math.abs(b[1] - a[1]) < 1e-12) continue;
      const t = (0 - a[1]) / (b[1] - a[1]);
      z0 = a[0] + (b[0] - a[0]) * t;
      break;
    }
  }
  const tip = path[0];
  const contact = S.contactFraction(up, path);
  return {
    L: Lval, theta0,
    len, brace: z0 - THROAT_Z, nockZ: z0,
    tipY: Math.abs(tip[1]), tipZ: tip[0],
    contactS: contact.s,
    nStations: up.length,
  };
}

function solve(Lval, theta0, which, target) {
  const key = which === 'len' ? 'len' : 'brace';
  let lo = which === 'len' ? Lval * 0.86 : theta0 * 0.55;
  let hi = which === 'len' ? Lval * 1.14 : theta0 * 1.55;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    const v = which === 'len' ? evaluate(mid, theta0)[key] : evaluate(Lval, mid)[key];
    /* both targets increase with their knob */
    if (v < target) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

const solveAll = (L0, t0) => {
  let theta0 = t0;
  for (let k = 0; k < 12; k++) {
    const Lv = solve(L0, theta0, 'len', TARGET_STRING);
    const th = solve(Lv, theta0, 'brace', TARGET.brace);
    if (Math.abs(th - theta0) < 1e-12) { theta0 = th; break; }
    theta0 = th;
  }
  const Lv = solve(L0, theta0, 'len', TARGET_STRING);
  return evaluate(Lv, theta0);
};

const r0 = evaluate(LIMB.L, LIMB.theta0);
console.log('--- current param.js ---');
for (const [k, v] of Object.entries(r0)) console.log(`  ${k.padEnd(11)} ${typeof v === 'number' ? v.toFixed(5) : v}`);

/* The butt angle is the number that decides whether the limb looks like a bow
   limb or like a swan neck. Sweep the shape exponent and see which one gives a
   sane angle. */
if (process.argv.includes('--sweep')) {
  console.log('\n  base     q      L       theta0    tipY     brace   contactS  gap@mid  dE/dbend');
  for (const [base, q] of [[0.00, 3.0], [0.02, 4.0], [0.05, 4.0], [0.02, 6.0],
                           [0.05, 6.0], [0.10, 6.0], [0.15, 4.0], [0.20, 3.0], [0.30, 2.0]]) {
    LIMB.kappaBase = base; LIMB.kappaQ = q;
    const r = solveAll(LIMB.L, LIMB.theta0);
    const st = L.integrate(0, 201);
    const mid = st[100];
    const gap = r.nockZ - mid.z;
    /* does drawing the limb actually STORE energy?  If this is negative the
       bend is bending the bow backwards and the whole model is worthless. */
    const e1 = L.strainEnergy(0.000), e2 = L.strainEnergy(0.004);
    console.log(`  ${base.toFixed(2)}  ${q.toFixed(1)}  ${r.L.toFixed(3).padStart(7)}  ${(r.theta0 * 180 / Math.PI).toFixed(2).padStart(6)}deg  ${r.tipY.toFixed(2).padStart(6)}  ${r.brace.toFixed(3).padStart(6)}  ${r.contactS.toFixed(3).padStart(7)}  ${gap.toFixed(2).padStart(6)}  ${((e2 - e1) / 0.004).toExponential(2).padStart(9)}`);
  }
}

if (process.argv.includes('--shape')) {
  const i = process.argv.indexOf('--shape');
  const base = parseFloat(process.argv[i + 1]);
  const q = parseFloat(process.argv[i + 2]);
  if (Number.isFinite(base)) LIMB.kappaBase = base;
  if (Number.isFinite(q)) LIMB.kappaQ = q;
  const r = solveAll(LIMB.L, LIMB.theta0);
  console.log(`\n--- braced limb centreline  base=${LIMB.kappaBase} q=${LIMB.kappaQ}  L=${r.L.toFixed(3)}  theta0=${(r.theta0 * 180 / Math.PI).toFixed(2)} deg ---`);
  console.log('   s      y       z     theta(deg)   kappa(1/in)');
  const st = L.integrate(0, 21);
  for (let i2 = 0; i2 < st.length; i2++) {
    const s = i2 / 20;
    console.log(`  ${s.toFixed(2)}  ${st[i2].y.toFixed(3).padStart(7)} ${st[i2].z.toFixed(3).padStart(7)}  ${(st[i2].theta * 180 / Math.PI).toFixed(2).padStart(8)}   ${L.kappaAt(s).toFixed(4).padStart(8)}`);
  }
}

if (process.argv.includes('--write') || process.argv.includes('--solve')) {
  const r = solveAll(LIMB.L, LIMB.theta0);
  console.log('\n--- solved ---');
  for (const [k, v] of Object.entries(r)) console.log(`  ${k.padEnd(11)} ${typeof v === 'number' ? v.toFixed(5) : v}`);
  console.log(`\n  L: ${r.L.toFixed(4)},`);
  console.log(`  theta0: ${r.theta0.toFixed(6)},`);
  const err = Math.abs(r.len - TARGET_STRING) + Math.abs(r.brace - TARGET.brace);
  console.log(`\n  residual on (string length, brace) = ${err.toExponential(3)}`);
}
