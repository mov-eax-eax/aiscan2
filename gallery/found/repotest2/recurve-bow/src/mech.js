/* ============================================================================
   recurve-bow / src/mech.js  --  the mechanics, and ALL of it

   This file is deliberately the second smallest in the project. There is no
   beam solver, no Newton iteration, no continuation, no cam, no cable, no
   trajectory integration. A recurve has one limb bending and one string, and
   that is what is modelled.

   ---------------------------------------------------------------------------
   WHAT IS ACTUALLY SOLVED, AND WHY IT IS WELL POSED

   Prescribe the nock position (draw). The limb must reach a shape that

     (1) keeps the string exactly as long as it was at brace, and
     (2) minimises stored strain energy.

   (2) is not a heuristic. With the nock displacement prescribed, the work done
   by the draw force is fixed, so the equilibrium shape is precisely the one of
   least strain energy among all shapes satisfying (1). That is the principle
   of minimum potential energy, and it is what a real limb obeys.

   The limb has TWO bend modes (see limb.js), so the pose is a two-parameter
   family and (1)+(2) is two conditions for two unknowns -- not over- or
   under-determined. Solve the amplitude from (1) by bisection for each mix
   ratio, then sweep the mix ratio for (2). Both searches are one-dimensional
   on monotone or unimodal quantities, so neither can fail to converge.

   Then F = dE/d(draw) by central differences on the same energy integral that
   produced the shape. The force is not fitted, tuned, or drawn by hand.
   ========================================================================== */

import * as L from './limb.js';
import * as S from './string.js';
import { STRING, TARGET, LIMB } from './param.js';

export const PIVOT_Z = L.pivotZ;
export const BRACE_NOCK_Z = L.BRACE_NOCK_Z;
export const DRAWN_NOCK_Z = L.DRAWN_NOCK_Z;
export const NOCK_TRAVEL = DRAWN_NOCK_Z - BRACE_NOCK_Z;

/* AMO draw length = nock-to-pivot + 1.75". This conversion matters: the nock
   travels 17.5" on a 28" draw, not 28". */
export const amoToTravel = amo => (PIVOT_Z + amo - 1.75) - BRACE_NOCK_Z;
export const travelToAmo = t => (BRACE_NOCK_Z + t) - PIVOT_Z + 1.75;

const MECH_STATIONS = 110;
const HULL_STRIDE = 4;

/* --------------------------------------------------------- fast geometry --- */

/* A cheap belly profile for the string search: coarser stations and a stride,
   because the hull only needs the outer surface to within a thousandth. */
function bellyCoarse(pose) {
  const st = L.integrate(pose, MECH_STATIONS);
  const out = [];
  for (let i = 0; i < st.length; i += HULL_STRIDE) {
    const p = st[i];
    const nz = Math.cos(p.theta), ny = -Math.sin(p.theta);
    const b = L.bellyOffset(p.s);
    out.push([p.z + nz * b, p.y + ny * b]);
  }
  const last = st[st.length - 1];
  const nz = Math.cos(last.theta), ny = -Math.sin(last.theta);
  const b = L.bellyOffset(last.s);
  out.push([last.z + nz * b, last.y + ny * b]);
  return out;
}

function stringLengthAt(pose, nockZ, bellyUp) {
  const up = bellyUp || bellyCoarse(pose);
  const dn = up.map(([z, y]) => [z, -y]);
  const t = S.tautPath(up, dn, [nockZ, 0]);
  return { len: S.pathLength(t.path), path: t.path, up };
}

/* The braced string length, computed once. */
let _braced = null;
export function braced() {
  if (!_braced) {
    const up = bellyCoarse(null);
    const dn = up.map(([z, y]) => [z, -y]);
    const t = S.tautPath(up, dn, null);
    _braced = { len: S.pathLength(t.path), path: t.path, up };
  }
  return _braced;
}

/* ------------------------------------------------- solve one drawn pose --- */

/* For a fixed mix ratio lambda, find amplitudes that make the string come back
   to its braced length.  The constraint can have a root on either side of
   zero, so we scan for sign changes and keep EVERY root: the two branches are
   the limb bending further and the limb unbending, and picking between them
   is the energy minimiser's job, not this function's. */
const SPAN = 0.45, SCAN = 22;

function amplitudeRoots(lambda, nockZ, len0) {
  const poseAt = T => ({ a: T * (1 - lambda), b: T * lambda });
  const f = T => stringLengthAt(poseAt(T), nockZ).len - len0;
  const roots = [];
  let prevT = -SPAN, prevF = f(prevT);
  for (let i = 1; i <= SCAN; i++) {
    const T = -SPAN + (2 * SPAN * i) / SCAN;
    const F = f(T);
    if ((prevF <= 0 && F >= 0) || (prevF >= 0 && F <= 0)) {
      let a = prevT, b = T, fa = prevF;
      for (let k = 0; k < 20; k++) {
        const m = 0.5 * (a + b), fm = f(m);
        if ((fa <= 0 && fm <= 0) || (fa >= 0 && fm >= 0)) { a = m; fa = fm; } else b = m;
      }
      roots.push(0.5 * (a + b));
    }
    prevT = T; prevF = F;
  }
  if (!roots.length) roots.push(0);
  return roots.map(T => ({ T, pose: poseAt(T) }));
}

/* Golden-section on the mix ratio, minimising stored strain energy.

   `offset` is the BRACING bend: how far the limb was pulled away from its
   moulded shape just to get the string on. Energy is measured from the mould,
   so it carries a cross term between the bracing bend and the drawing bend --
   and that cross term is exactly what makes the force non-zero at brace.
   Without it a 36 lb bow reads zero pounds at brace height and stores barely
   half the energy it should. */
export function solvePose(nockTravel, offset = null) {
  const nockZ = BRACE_NOCK_Z + nockTravel;
  const len0 = braced().len;
  const oa = offset ? offset.a : 0, ob = offset ? offset.b : 0;
  const cache = new Map();
  const evalLambda = (lambda) => {
    const key = lambda.toFixed(6);
    if (cache.has(key)) return cache.get(key);
    let best = null;
    for (const r of amplitudeRoots(lambda, nockZ, len0)) {
      const e = L.drawEnergy({ a: r.pose.a + oa, b: r.pose.b + ob }, MECH_STATIONS);
      if (!best || e < best.energy) best = { lambda, T: r.T, pose: r.pose, energy: e };
    }
    cache.set(key, best);
    return best;
  };

  const GR = 0.6180339887;
  let a = -0.60, b = 1.60;
  let c = b - GR * (b - a), d = a + GR * (b - a);
  let fc = evalLambda(c), fd = evalLambda(d);
  for (let i = 0; i < 20; i++) {
    if (fc.energy < fd.energy) { b = d; d = c; fd = fc; c = b - GR * (b - a); fc = evalLambda(c); }
    else { a = c; c = d; fc = fd; d = a + GR * (b - a); fd = evalLambda(d); }
  }
  const best = fc.energy < fd.energy ? fc : fd;

  const pose = best.pose;
  const sl = stringLengthAt(pose, nockZ);
  const st = L.integrate(pose, LIMB.nStations);
  const tip = st[st.length - 1];
  const contact = S.contactFraction(sl.up, sl.path);

  /* String angle at the nock, and therefore the real string tension.
     The draw force is shared by the two legs, so T = F / (2 cos a) where `a`
     is the angle between a leg and the draw direction.  Measured from the
     NOCK TO THE TIP -- an earlier version read it off the wrong vertex of the
     path and reported nonsense the moment the path collapsed to three
     points. */
  const legDy = tip.y, legDz = tip.z - nockZ;
  const legLen = Math.hypot(legDy, legDz) || 1;
  const legAngle = Math.acos(Math.min(1, Math.abs(legDz) / legLen));

  return {
    nockZ,
    draw: nockTravel,
    amo: travelToAmo(nockTravel),
    pose,
    lambda: best.lambda,
    energy: best.energy,
    stringLen: sl.len,
    stringErr: sl.len - len0,
    tipY: tip.y, tipZ: tip.z, tipThetaDeg: tip.theta * 180 / Math.PI,
    contactS: contact.s,
    legAngleDeg: legAngle * 180 / Math.PI,
    legLen,
  };
}

/* --------------------------------------------------------- the full curve --- */

export const DEFAULT_SAMPLES = 17;

/* Two passes.  Pass one finds the drawn shapes; pass two re-measures energy
   from the moulded shape, using pass one's full-draw pose as the bracing
   bend.  For a quadratic energy the brace-to-full-draw force ratio works out
   at k/(1+k), so k follows directly from the ratio we want and no search is
   needed. */
export function braceOffsetRatio(r = TARGET.braceForceRatio) {
  const q = Math.max(0, Math.min(0.75, r));
  return q / (1 - q);
}

export function solveCurve(samples = DEFAULT_SAMPLES) {
  const draws = [];
  for (let i = 0; i < samples; i++) draws.push((i / (samples - 1)) * NOCK_TRAVEL);

  /* Pass one only needs the FULL-DRAW pose -- that is the only thing the
     bracing bend is derived from, so solving the other eleven draws twice
     would be pure waste. */
  const full = solvePose(NOCK_TRAVEL, null).pose;
  const k = braceOffsetRatio();
  const offset = { a: k * full.a, b: k * full.b };

  const poses = draws.map(t => solvePose(t, offset));

  /* energy is integrated finer than the search needed, so the force curve is
     not limited by the cheap evaluate the search used */
  const oa = offset.a, ob = offset.b;
  for (const r of poses) r.energyFine = L.drawEnergy({ a: r.pose.a + oa, b: r.pose.b + ob }, 400);

  /* central differences on the draw grid -> units of E per inch */
  for (let i = 0; i < poses.length; i++) {
    const i0 = Math.max(0, i - 1), i1 = Math.min(poses.length - 1, i + 1);
    const dE = poses[i1].energyFine - poses[i0].energyFine;
    const dd = poses[i1].draw - poses[i0].draw;
    poses[i].unitForce = dd > 0 ? dE / dd : 0;
  }
  poses.offset = offset;
  poses.braceEnergy = poses[0].energyFine;
  return poses;
}

/* ------------------------------------------------------------- calibrate --- */

/* ONE scalar is fitted: the effective flexural modulus of the laminate. The
   SHAPE of the curve is pure geometry; the scale is stiffness. Real
   fibreglass-laminate limbs sit near 5-6 Mpsi, so if this lands outside
   roughly 2-12 Mpsi the geometry is wrong and that is worth knowing. */
export function calibrate(curve, targetLb = TARGET.drawWeight, amo = TARGET.drawLength) {
  const want = amoToTravel(amo);
  let i = 0, best = Infinity;
  for (let k = 0; k < curve.length; k++) {
    const d = Math.abs(curve[k].draw - want);
    if (d < best) { best = d; i = k; }
  }
  const u = curve[i].unitForce;
  const E = u > 0 ? (targetLb / u) : 0;
  return { E, index: i, atDraw: curve[i].draw, unitForce: u, clipped: Math.abs(curve[i].draw - want) > 1e-6 };
}

export function applyStiffness(curve, E) {
  const e0 = curve.braceEnergy !== undefined ? curve.braceEnergy : curve[0].energyFine;
  for (const r of curve) {
    r.drawForce = r.unitForce * E;
    r.stored = (r.energyFine - e0) * E;
  }
  return curve;
}

/* String tension from the half-angle at the nock: the two legs share the draw
   force, and as the angle closes the tension climbs faster than the force.
   This is the "stack" every archer feels, and it falls straight out. */
export function stringTension(drawForce, legAngleDeg) {
  const c = Math.cos(legAngleDeg * Math.PI / 180);
  return Math.abs(c) > 1e-6 ? drawForce / (2 * c) : Infinity;
}

/* Arrow speed from stored energy and a stated efficiency. This is the ONE
   number in the whole model that is a rule of thumb rather than a mechanism,
   and it is labelled as such wherever it is shown. */
export const EFFICIENCY = 0.80;
export function arrowSpeed(storedInLb, grains = 285) {
  const joules = storedInLb * 0.112985;
  const massKg = grains * 6.4799e-5;
  return Math.sqrt(2 * EFFICIENCY * joules / massKg);       // m/s
}
