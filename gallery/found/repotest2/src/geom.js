/* Pure geometric engine for the compound crossbow mechanism.
   Built so that every length is computed from an explicit joint layout — no
   moment arms are hand-derived and no sign is guessed.

   Layout (X-Z plane; +X = left limb, +Z = toward target):
     rootL        limb root at the riser
     tipL(beta)   limb tip / cam axle, swung forward by `beta` about the root
     strL         string tangent point = tip + rS * u(stringAng + phi)
     cabL         cable  tangent point = tip + rC * u(stringAng + PI + phi)
     nock         vertex of the two string halves, on the centreline
   phi = beta + theta is the cam's absolute angle (limb swing plus wind).
*/
const TAU = Math.PI * 2;
const sub = (a, b) => ({ x: a.x - b.x, z: a.z - b.z });
const add = (a, b) => ({ x: a.x + b.x, z: a.z + b.z });
const len = (v) => Math.hypot(v.x, v.z);
const norm = (v) => { const L = len(v) || 1e-9; return { x: v.x / L, z: v.z / L }; };
const mul = (v, s) => ({ x: v.x * s, z: v.z * s });
const dir = (a) => ({ x: Math.cos(a), z: Math.sin(a) });
const mirror = (v) => ({ x: -v.x, z: v.z });
const rot = (v, a) => { const c = Math.cos(a), s = Math.sin(a); return { x: v.x * c - v.z * s, z: v.x * s + v.z * c }; };
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

export const stringR = (th, p) => lerp(p.rS0, p.rS1, 0.5 - 0.5 * Math.cos(Math.PI * clamp(th / p.camSpan, 0, 1)));
export const cableR = (th, p) => lerp(p.rC0, p.rC1, 0.5 - 0.5 * Math.cos(Math.PI * clamp(th / p.camSpan, 0, 1)));

export function tipPos(beta, p) {
  const d0 = { x: p.limbLen * Math.cos(p.limbAng), z: p.limbLen * Math.sin(p.limbAng) };
  return add({ x: p.rootX, z: 0 }, rot(d0, -beta));
}

/* Nock position: on the centreline, behind the string tangent points, at
   distance `half` from each. dz must be real. */
export function nockFrom(half, strL) {
  const xS = Math.abs(strL.x);
  const dz = Math.sqrt(Math.max(half * half - xS * xS, 0));
  return { x: 0, z: strL.z - dz };
}

export function build(beta, theta, p, half) {
  const rS = stringR(theta, p), rC = cableR(theta, p);
  const phi = beta + theta;
  const tL = tipPos(beta, p), tR = mirror(tL);
  const aS = p.stringAng + phi;
  const oS = mul(dir(aS), rS);
  // The cable groove is the SAME azimuth as the string groove but wound the
  // other way round the disc.  Geometrically that puts the cable tangent point
  // on the opposite side of the AXLE, which is what makes the tips rock
  // inboard — and therefore lengthen the cam-to-cam run — as the limb swings
  // forward.  The two tangent directions are then parallel but opposite in
  // sign, so the cam's own moment balance is Ts*rS = Tc*rC exactly.
  const oC = mul(dir(aS + Math.PI), rC);
  const strL = add(tL, oS), strR = mirror(strL);
  const cabL = add(tL, oC), cabR = mirror(cabL);
  const nock = nockFrom(half, strL);
  const Lstring = len(sub(nock, strL)) + len(sub(nock, strR));
  const Lcable = len(sub(cabR, cabL));
  return { beta, theta, phi, rS, rC, tL, tR, strL, strR, cabL, cabR, nock, Lstring, Lcable, oS, oC, half };
}

/* Explicit-nock variant: the nock height is an INPUT (it is latched to the
   rail), so the string half-length is whatever the geometry demands.  This is
   the form that makes dLstring/dbeta non-zero, which is how the archer's pull
   reaches the limb. */
export function buildNock(beta, theta, p, nockZ) {
  const rS = stringR(theta, p), rC = cableR(theta, p);
  const phi = beta + theta;
  const tL = tipPos(beta, p), tR = mirror(tL);
  const aS = p.stringAng + phi;
  const oS = mul(dir(aS), rS);
  const oC = mul(dir(aS + Math.PI), rC);
  const strL = add(tL, oS), strR = mirror(strL);
  const cabL = add(tL, oC), cabR = mirror(cabL);
  const nock = { x: 0, z: nockZ };
  const half = len(sub(nock, strL));
  return {
    beta, theta, phi, rS, rC, tL, tR, strL, strR, cabL, cabR, nock, half, oS, oC,
    Lstring: half * 2, Lcable: len(sub(cabR, cabL)),
  };
}

/* Numerical Jacobian of the two line lengths with respect to (beta, theta).
   Virtual work then gives the generalized forces directly:
       Q_beta  = -Ts*dLs/dbeta - Tc*dLc/dbeta      (limb spring must supply)
       Q_theta = -Ts*dLs/dtheta - Tc*dLc/dtheta = 0 (cam is a free rotor)
*/
export function jac(beta, theta, p, half) {
  const hb = 1e-6, ht = 1e-6;
  const LsPlus = build(beta + hb, theta, p, half).Lstring, LsMinus = build(beta - hb, theta, p, half).Lstring;
  const LcPlus = build(beta + hb, theta, p, half).Lcable, LcMinus = build(beta - hb, theta, p, half).Lcable;
  const LsTp = build(beta, theta + ht, p, half).Lstring, LsTm = build(beta, theta - ht, p, half).Lstring;
  const LcTp = build(beta, theta + ht, p, half).Lcable, LcTm = build(beta, theta - ht, p, half).Lcable;
  return {
    dLsdB: (LsPlus - LsMinus) / (2 * hb), dLcdB: (LcPlus - LcMinus) / (2 * hb),
    dLsdT: (LsTp - LsTm) / (2 * ht), dLcdT: (LcTp - LcTm) / (2 * ht),
    Ls: build(beta, theta, p, half).Lstring, Lc: build(beta, theta, p, half).Lcable,
  };
}
