/* ============================================================================
   recurve-bow / src/verify.js  --  build and check everything, in bare Node

   No browser, no WebGL, no three.js. Every part in the bow is built here from
   the same source the renderer uses and put through the same checks, because
   a model whose geometry cannot be measured cannot be trusted:

     * every part is a closed manifold (each edge shared by exactly two
       triangles), outward-wound, finite, with positive volume
     * the bow measures what it claims to measure -- 68" AMO, 8.75" brace
     * the limb's dovetail physically fits its mortise, with clearance
     * the string is exactly as long drawn as it is braced
     * the draw-force curve peaks where stated, stores what it should, and
       the eff=80% arrow speed is in a believable band
     * every mesh volume becomes a real part mass

   run:  node src/verify.js           (or: npm run verify)
   ========================================================================== */

import * as M from './mesh.js';
import * as L from './limb.js';
import * as S from './string.js';
import * as MECH from './mech.js';
import { buildRiserParts, sections, sectionAtY } from './riser.js';
import { buildAccessoryParts } from './accessories.js';
import { RISER, LIMB, TARGET, MATERIALS, ARROW } from './param.js';

let pass = 0, fail = 0;
const ok = (cond, label, detail = '') => {
  if (cond) { pass++; console.log(`  ok    ${label}${detail ? '   ' + detail : ''}`); }
  else { fail++; console.log(`  FAIL  ${label}${detail ? '   ' + detail : ''}`); }
};
const near = (a, b, tol) => Math.abs(a - b) <= tol;
const rule = t => console.log('\n' + t + '\n' + '-'.repeat(t.length));

/* ------------------------------------------------------------ 1. parts --- */

rule('1. every part is a solid');

const MECH_CURVE = null;
const parts = [];
for (const p of buildRiserParts()) parts.push(p);
for (const p of buildAccessoryParts()) parts.push(p);
parts.push({ name: 'limb.upper', mesh: L.buildLimb(null, 1), material: 'glass' });
parts.push({ name: 'limb.lower', mesh: L.buildLimb(null, -1), material: 'glass' });

let bad = [], totalTris = 0, totalMass = 0, heaviest = [];
for (const p of parts) {
  const g = M.finish(p.mesh, { angle: 32 });
  const mass = g.volume * (MATERIALS[p.material] || MATERIALS.alu).density;
  totalTris += g.idx.length / 3;
  totalMass += mass;
  heaviest.push([p.name, mass]);
  const problems = [];
  if (M.hasNaN(g)) problems.push('NaN');
  if (g.openEdges !== 0) problems.push(`${g.openEdges} open edges`);
  if (!(g.volume > 0)) problems.push(`volume ${g.volume.toFixed(6)}`);
  if (problems.length) bad.push(`${p.name}: ${problems.join(', ')}`);
}
ok(bad.length === 0, `${parts.length} parts closed, outward-wound and finite`,
  bad.length ? '\n        ' + bad.join('\n        ') : '');
ok(totalTris > 80000, 'model has real density', `${totalTris.toLocaleString()} triangles`);

heaviest.sort((a, b) => b[1] - a[1]);
console.log('\n  heaviest parts');
for (const [n, m] of heaviest.slice(0, 8)) console.log(`    ${n.padEnd(26)} ${(m * 453.592).toFixed(0).padStart(5)} g   ${m.toFixed(3)} lb`);

/* --------------------------------------------------------- 2. the bow --- */

rule('2. the bow measures what it claims');

const sec = sections();
const throat = (() => {
  const T = RISER.profile.slice().sort((a, b) => a[0] - b[0]);
  const y = RISER.throatY;
  for (let i = 0; i < T.length - 1; i++) {
    if (y >= T[i][0] && y <= T[i + 1][0]) {
      const t = (y - T[i][0]) / (T[i + 1][0] - T[i][0]);
      return T[i][3] + (T[i + 1][3] - T[i][3]) * t;
    }
  }
  return 0;
})();

ok(near(sec[0].y, -RISER.half, 0.02) && near(sec[sec.length - 1].y, RISER.half - 0.01, 0.02),
  'riser body spans its machined height',
  `${(sec[sec.length - 1].y - sec[0].y).toFixed(2)} in of ${(2 * RISER.half).toFixed(2)}`);
ok(near(2 * RISER.pocket.y1, 25.0, 0.01), 'with the pocket blocks, a full 25 in ILF riser',
  `${(2 * RISER.pocket.y1).toFixed(2)} in`);
ok(near(throat, 0.756, 0.01), 'grip throat is where the mechanics thinks it is',
  `z = ${throat.toFixed(3)} in`);

const up = L.bellyProfile(null);
const dn = up.map(([z, y]) => [z, -y]);
const braced = S.tautPath(up, dn, null);
const stringLen = S.pathLength(braced.path);
const amo = stringLen + 3.0;
ok(near(amo, TARGET.amo, 0.10), 'AMO bow length', `${amo.toFixed(3)} in (spec ${TARGET.amo})`);

const nockZ = MECH.BRACE_NOCK_Z;
const brace = nockZ - throat;
ok(near(brace, TARGET.brace, 0.05), 'brace height', `${brace.toFixed(3)} in (spec ${TARGET.brace})`);

const tip = L.tipOf(null);
ok(tip.z < nockZ - 0.05, 'the recurve tip hooks forward of the string line',
  `tip z ${tip.z.toFixed(3)} vs string ${nockZ.toFixed(3)}`);

/* the string must lie ALONG the groove, not touch the limb at a point */
const contact = S.contactFraction(up, braced.path);
ok(contact.s > 0.80, 'string rests in the string groove at brace',
  `contact from ${(contact.s * 100).toFixed(1)} % of limb length`);
ok(contact.s >= LIMB.groove.from - 0.012 && contact.s <= LIMB.groove.to,
  'and it makes contact inside the milled groove, not on bare limb',
  `groove runs ${(LIMB.groove.from * 100).toFixed(1)}-${(LIMB.groove.to * 100).toFixed(0)} %`);

/* ------------------------------------------------------ 3. the fit ----- */

rule('3. the dovetail actually fits its mortise');

const P = RISER.pocket, D = LIMB.dovetail;
const mouthW = P.mouthZ[1] - P.mouthZ[0];
const tenonMouthW = D.mouthZ[1] - D.mouthZ[0];
const floorW = P.floorZ[1] - P.floorZ[0];
const tenonFloorW = D.floorZ[1] - D.floorZ[0];
ok(tenonMouthW < mouthW, 'tenon is narrower than the mortise mouth',
  `clr ${((mouthW - tenonMouthW) / 2).toFixed(4)} in per side`);
ok(tenonFloorW < floorW, 'tenon is narrower than the mortise floor',
  `clr ${((floorW - tenonFloorW) / 2).toFixed(4)} in per side`);
ok(floorW > mouthW, 'and the mortise is a real dovetail (wider at the floor)',
  `mouth ${mouthW.toFixed(3)} in -> floor ${floorW.toFixed(3)} in`);
ok(D.x0 > -P.x1 && D.x1 < P.x1, 'tenon slides in sideways and is captured in x',
  `tenon ${D.x0}..${D.x1} vs pocket ${-P.x1}..${P.x1}`);
ok(Math.abs(tenonMouthW - mouthW) / mouthW < 0.06, 'but only just -- a dovetail is a fit, not a gap');

/* --------------------------------------------------------- 4. mechanics --- */

rule('4. the mechanics');

const t0 = Date.now();
const curve = MECH.solveCurve(13);
const solveMs = Date.now() - t0;
const cal = MECH.calibrate(curve);
MECH.applyStiffness(curve, cal.E);
const full = curve[curve.length - 1];
const first = curve[0];

console.log('  amo     draw    force     stored    string T');
for (const r of curve) {
  console.log(`  ${r.amo.toFixed(2).padStart(5)}  ${r.draw.toFixed(2).padStart(5)}  ${r.drawForce.toFixed(2).padStart(6)} lb  ${(r.stored * 0.0836).toFixed(2).padStart(6)} ft-lb  ${MECH.stringTension(r.drawForce, r.legAngleDeg).toFixed(1).padStart(6)} lb`);
}

const maxErr = Math.max(...curve.map(r => Math.abs(r.stringErr)));
ok(maxErr < 2e-3, 'string length is conserved through the whole draw',
  `max |dL| = ${maxErr.toExponential(2)} in over ${curve.length} poses`);
ok(near(full.drawForce, TARGET.drawWeight, 0.05), 'rated draw weight',
  `${full.drawForce.toFixed(2)} lb at ${full.amo.toFixed(1)} in AMO`);
ok(curve.every((r, i) => i === 0 || r.drawForce >= curve[i - 1].drawForce - 1e-6),
  'draw force never falls as the bow is drawn (no let-off: this is a recurve)');
ok(curve.every(r => r.drawForce > 0), 'and the bow is loaded at brace, not slack',
  `${first.drawForce.toFixed(2)} lb at brace`);
ok(cal.E / 1e6 > 1.5 && cal.E / 1e6 < 14,
  'the calibrated laminate stiffness is physically plausible',
  `E = ${(cal.E / 1e6).toFixed(2)} Mpsi (real glass/wood limbs sit near 5)`);
ok(full.stored * 0.0836 > 22 && full.stored * 0.0836 < 46, 'stored energy',
  `${(full.stored * 0.0836).toFixed(1)} ft-lb = ${(full.stored * 0.112985).toFixed(0)} J`);

const areaRatio = full.stored / (full.drawForce * MECH.NOCK_TRAVEL);
ok(areaRatio > 0.45 && areaRatio < 0.75, 'force-draw curve is the right SHAPE',
  `area ratio ${areaRatio.toFixed(3)} (0.5 = a straight line)`);

const tension = MECH.stringTension(full.drawForce, full.legAngleDeg);
ok(tension > full.drawForce * 1.1 && tension < full.drawForce * 2.2,
  'string tension exceeds draw force, as the closing angle demands',
  `${tension.toFixed(1)} lb vs ${full.drawForce.toFixed(1)} lb`);

ok(full.contactS > first.contactS + 0.05, 'the string LIFTS OFF the groove as it is drawn',
  `contact ${(first.contactS * 100).toFixed(1)} % -> ${(full.contactS * 100).toFixed(0)} % of limb`);
ok(full.tipY < first.tipY && full.tipZ > first.tipZ,
  'the limb tip travels inward and back',
  `(${first.tipY.toFixed(2)}, ${first.tipZ.toFixed(2)}) -> (${full.tipY.toFixed(2)}, ${full.tipZ.toFixed(2)})`);

const fps = MECH.arrowSpeed(full.stored) * 3.28084;
ok(fps > 150 && fps < 230, 'estimated arrow speed is in a believable band',
  `${fps.toFixed(0)} fps with a ${ARROW.grains} gr arrow at ${(MECH.EFFICIENCY * 100).toFixed(0)} % efficiency`);

/* -------------------------------------------------------- 5. the draw --- */

rule('5. the drawn bow still looks like a bow');

for (const frac of [0.5, 1.0]) {
  const p = curve[Math.round(frac * (curve.length - 1))];
  const bu = L.bellyProfile(p.pose);
  const bd = bu.map(([z, y]) => [z, -y]);
  const t = S.tautPath(bu, bd, [p.nockZ, 0]);
  ok(t.path.length >= 3 && S.pathLength(t.path) > 0,
    `string is a valid taut path at ${(frac * 100).toFixed(0)} % draw`,
    `${t.path.length} vertices, ${S.pathLength(t.path).toFixed(3)} in`);
  const chord = Math.hypot(L.tipOf(p.pose).y - LIMB.buttY, L.tipOf(p.pose).z - LIMB.buttZ);
  ok(chord < LIMB.L, `limb chord stays inside its arc length at ${(frac * 100).toFixed(0)} % draw`,
    `chord ${chord.toFixed(3)} < arc ${LIMB.L.toFixed(3)}`);
}

/* ------------------------------------------------------------- summary --- */

rule('summary');
console.log(`  parts                ${parts.length}`);
console.log(`  triangles            ${totalTris.toLocaleString()}`);
console.log(`  model mass           ${totalMass.toFixed(2)} lb  (${(totalMass * 453.592).toFixed(0)} g)`);
console.log(`  AMO / brace          ${amo.toFixed(2)} in / ${brace.toFixed(2)} in`);
console.log(`  weight               ${full.drawForce.toFixed(1)} lb at ${TARGET.drawLength}"`);
console.log(`  stored               ${(full.stored * 0.0836).toFixed(1)} ft-lb`);
console.log(`  arrow (est.)         ${fps.toFixed(0)} fps`);
console.log(`  solve time           ${solveMs} ms for ${curve.length} posed draws`);
console.log(`\n  ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
