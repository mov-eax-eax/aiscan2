/* ============================================================================
   COMPOUND CROSSBOW — MECHANISM CORE          (pure math; Node + browser)

   FRAME / SIGNS
     +X toward the LEFT limb, +Y up, +Z toward the target.  Rearward is -Z.
     Limb / cam / string / cable geometry lives in the X-Z plane.  The cam axles
     are horizontal and the cams turn in the Y-Z plane, so the string leaves the
     cam below the axle and the cable above it.  Their tangents are antiparallel,
     which is exactly what makes the cam's own balance  Ts*rS = Tc*rC  hold.

   HOW THE MECHANISM IS SOLVED
   The nock is latched to the rail, so the drawn distance s is the input.  Two
   unknowns are left — beta (limb swing) and theta (cam wind) — and two
   constraints fix them:

     C1  STRING PAYOUT   half(s)  ==  half0 + rS(theta)*theta
     C2  CABLE TAKE-UP   Lcable(s) ==  cable0 - 2*rC(theta)*theta

   Those are solved by damped Newton on a numerically differentiated Jacobian,
   continued along the stroke.

   THE DRAW FORCE comes from the limb's stored energy, which makes energy
   conservation exact rather than approximate:

        E_limb(s) = k*beta(s)^2 / 2        (limb = rotational spring)
        F(s)      = dE_limb/ds

   beta(s) is the swing the cable constraint actually produces, so the curve's
   SHAPE is set by the cam geometry and its SCALE by the limb stiffness.  The
   two features that make a bow compound both fall out of the geometry: the
   string track tapering DOWN toward full draw is what produces let-off, and the
   ratio of the two tracks sets how far the limbs travel for a given stroke.

   Tensions come from virtual work on the two ideal lines, so no moment arm is
   ever hand-derived:
        Ts = k*beta / denom,   denom = -(dLs/dbeta + (Tc/Ts)*dLc/dbeta)
        Tc/Ts = -dLs/dtheta / dLc/dtheta
   ==========================================================================*/

import { buildNock, stringR, cableR } from './geom.js';

export const D2R = Math.PI / 180, R2D = 180 / Math.PI;
export const G = 9.80665;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const N2LBF = 0.224809, M2IN = 39.3700787, J2FTLB = 0.737562, MS2FPS = 3.280839895;

/* ---------------------------------------------------------------- design --- */
export const DESIGN = {
  name: 'compound match crossbow',

  // limb & riser
  rootX: 0.060, limbLen: 0.440, limbAng: 55 * D2R,
  kSpring: 12914,                // N m/rad — from the design scan at 0.28 m stroke
  limbTipMass: 0.085, camInertia: 2.0e-5, stringMass: 0.010,

  // string
  stringAng: 60 * D2R, stringHalfBraced: 0.780,
  powerStroke: 0.280,            // 11.0 in

  // cam: string track tapers DOWN (let-off), cable track is the take-up spool
  camSpan: 1.80,
  rS0: 0.1226, rS1: 0.0557,
  rC0: 0.0130, rC1: 0.0130,

  // bolt
  boltMass: 0.040, boltLength: 0.508, shaftR: 0.00415, shaftRho: 1750, shaftE: 60e9,

  // air
  rhoAir: 1.2041, Cd: 0.55,
};

/* ------------------------------------------------------------- context ----- */
export function makeContext(p) {
  const g0 = buildNock(0, 0, p, 0);
  return { halfBrace: g0.half, braceZ: g0.nock.z, cable0: g0.Lcable, p };
}

function res(beta, theta, zn, ctx) {
  const g = buildNock(beta, theta, ctx.p, zn);
  return [
    g.half - (ctx.halfBrace + g.rS * theta),
    g.Lcable - (ctx.cable0 - 2 * g.rC * theta),
  ];
}
function solve(beta0, theta0, zn, ctx) {
  let beta = clamp(beta0, -1.2, 1.6), theta = clamp(theta0, -0.8, 4.0);
  let r = res(beta, theta, zn, ctx);
  let nrm = Math.abs(r[0]) / 5e-4 + Math.abs(r[1]) / 5e-4;
  for (let it = 0; it < 120 && nrm > 1e-11; it++) {
    const h = 1e-7;
    const a1 = res(beta + h, theta, zn, ctx), a2 = res(beta - h, theta, zn, ctx);
    const b1 = res(beta, theta + h, zn, ctx), b2 = res(beta, theta - h, zn, ctx);
    const j11 = (a1[0] - a2[0]) / (2 * h), j12 = (b1[0] - b2[0]) / (2 * h);
    const j21 = (a1[1] - a2[1]) / (2 * h), j22 = (b1[1] - b2[1]) / (2 * h);
    const det = j11 * j22 - j12 * j21;
    if (!isFinite(det) || Math.abs(det) < 1e-18) break;
    const db = (-r[0] * j22 + r[1] * j12) / det;
    const dt = (-j11 * r[1] + j21 * r[0]) / det;
    let step = 1, moved = false;
    for (let ls = 0; ls < 34; ls++) {
      const nb = clamp(beta + db * step, -1.2, 1.6), nt = clamp(theta + dt * step, -0.8, 4.0);
      const nr = res(nb, nt, zn, ctx);
      const nn = Math.abs(nr[0]) / 5e-4 + Math.abs(nr[1]) / 5e-4;
      if (isFinite(nn) && nn < nrm) { beta = nb; theta = nt; r = nr; nrm = nn; moved = true; break; }
      step *= 0.5;
    }
    if (!moved) break;
  }
  return { beta, theta, conv: nrm < 1e-7, resid: nrm };
}

/* ------------------------------------------------------------- the curve --- */
export function buildCurve(p, steps = 240) {
  const ctx = makeContext(p);
  const rows = [];
  let g = { beta: 0.02, theta: 0.02 };
  for (let i = 0; i <= steps; i++) {
    const s = p.powerStroke * i / steps;
    const zn = ctx.braceZ - s;
    const sol = solve(g.beta, g.theta, zn, ctx);
    g = { beta: sol.beta, theta: sol.theta };
    const gn = buildNock(sol.beta, sol.theta, p, zn);

    const h = 1e-7;
    const Ls = (b, t, z) => buildNock(b, t, p, z).half * 2;
    const Lc = (b, t) => buildNock(b, t, p, zn).Lcable;
    const dLsdB = (Ls(sol.beta + h, sol.theta, zn) - Ls(sol.beta - h, sol.theta, zn)) / (2 * h);
    const dLcdB = (Lc(sol.beta + h, sol.theta) - Lc(sol.beta - h, sol.theta)) / (2 * h);
    const dLsdT = (Ls(sol.beta, sol.theta + h, zn) - Ls(sol.beta, sol.theta - h, zn)) / (2 * h);
    const dLcdT = (Lc(sol.beta, sol.theta + h) - Lc(sol.beta, sol.theta - h)) / (2 * h);
    const ratio = Math.abs(dLcdT) < 1e-12 ? 0 : -dLsdT / dLcdT;
    const denom = -(dLsdB + ratio * dLcdB);

    rows.push({
      s, sIn: s * M2IN, zn, beta: sol.beta, theta: sol.theta, phi: gn.phi,
      rS: gn.rS, rC: gn.rC, half: gn.half, Lcable: gn.Lcable, Lstring: gn.Lstring,
      tL: gn.tL, tR: gn.tR, strL: gn.strL, strR: gn.strR, cabL: gn.cabL, cabR: gn.cabR,
      nock: gn.nock, dLsdB, dLcdB, dLsdT, dLcdT, ratio, denom,
      tipSwingDeg: sol.beta * R2D, camRotDeg: gn.phi * R2D,
      conv: sol.conv, resid: sol.resid,
    });
  }

  /* Energy-exact draw force: F = dE/ds with E = k beta^2 / 2. */
  const k = p.kSpring;
  for (const r of rows) r.E_limb = 0.5 * k * r.beta * r.beta;
  for (let i = 0; i < rows.length; i++) {
    const a = rows[Math.max(i - 1, 0)], b = rows[Math.min(i + 1, rows.length - 1)];
    const dE = b.E_limb - a.E_limb, ds = b.s - a.s;
    r0: { rows[i].F = Math.abs(ds) > 1e-12 ? Math.max(dE / ds, 0) : 0; }
  }
  let W = 0;
  for (let i = 1; i < rows.length; i++) W += 0.5 * (rows[i].F + rows[i - 1].F) * (rows[i].s - rows[i - 1].s);
  const last = rows[rows.length - 1];
  const pk = rows.reduce((a, r) => (r.F > a.F ? r : a), rows[0]);
  // The tension RATIO Tc/Ts is solvable wherever the cable is genuinely taking
  // up line.  Near the ends of the wind the cam's tangent can swing past its
  // efficient sector and the numerical derivative degenerates; those samples
  // are marked rather than silently reported, and the tensions are computed
  // only from the usable band so no nonsense ever reaches the UI.
  const usable = rows.filter(r => r.s > 1e-9 && isFinite(r.ratio) && r.ratio > 0.05 && r.ratio < 12);
  const ratios = usable.map(r => r.ratio);
  const ratioMin = ratios.length ? Math.min(...ratios) : 0;
  const ratioMax = ratios.length ? Math.max(...ratios) : 0;
  for (const r of rows) {
    const okRatio = isFinite(r.ratio) && r.ratio > 0.05 && r.ratio < 12;
    r.ratioDegenerate = !okRatio;
    const ratio = okRatio ? r.ratio : Math.min(Math.max(r.ratio || ratioMin, ratioMin), ratioMax);
    const kb = k * r.beta;
    r.Ts = Math.abs(r.denom) < 1e-9 ? 0 : Math.abs(kb / r.denom);
    r.Tc = r.Ts * ratio;
    r.ratioUsed = ratio;
  }
  return {
    rows, ctx, p, k, W, peak: pk, peakF: pk.F, peakLbf: pk.F * N2LBF,
    peakFrac: pk.s / p.powerStroke, peakDrawIn: pk.sIn,
    holdF: last.F, holdLbf: last.F * N2LBF,
    letOff: pk.F > 0 ? 1 - last.F / pk.F : 0,
    energy: W, E_limb: last.E_limb,
    energyResidual: last.E_limb - W, energyResidualFrac: W > 0 ? (last.E_limb - W) / W : 0,
    strokeIn: last.sIn, bad: rows.filter(r => !r.conv).length,
    maxTs: Math.max(...rows.map(r => r.Ts)), maxTc: Math.max(...rows.map(r => r.Tc)),
    tipTravel: Math.hypot(last.tL.x - rows[0].tL.x, last.tL.z - rows[0].tL.z),
    ratioMin, ratioMax,
    degenerate: rows.filter(r => r.ratioDegenerate).length,
  };
}

/* --------------------------------------------------------- shot solution --- */
export function shotSolution(p, curve) {
  const rows = curve.rows, m = p.boltMass;
  let nTip = 0, nCam = 0, cnt = 0;
  for (let i = 1; i < rows.length; i++) {
    const ds = rows[i].s - rows[i - 1].s;
    if (Math.abs(ds) < 1e-12) continue;
    const dz = (rows[i].tL.z - rows[i - 1].tL.z) / ds, dx = (rows[i].tL.x - rows[i - 1].tL.x) / ds;
    const dth = (rows[i].theta - rows[i - 1].theta) / ds;
    nTip += 2 * (dz * dz + dx * dx); nCam += 2 * p.camInertia * dth * dth; cnt++;
  }
  if (cnt) { nTip /= cnt; nCam /= cnt; }
  const nEff = nTip * p.limbTipMass * 2 / m + nCam / m + p.stringMass / m;
  const v = Math.sqrt(Math.max(2 * curve.energy / (m * (1 + nEff)), 0));
  const I = Math.PI * Math.pow(p.shaftR, 4) / 4, A = Math.PI * p.shaftR * p.shaftR, b1 = 4.73004074;
  const spineHz = (b1 * b1 / (2 * Math.PI * p.boltLength * p.boltLength)) * Math.sqrt(p.shaftE * I / (p.shaftRho * A));
  return {
    v, vFps: v * MS2FPS, ke: 0.5 * m * v * v, nEff, efficiency: 1 / (1 + nEff),
    momentum: m * v, spineHz, tipSpeedRatio: Math.sqrt(nTip), limbEnergy: curve.energy * (1 - 1 / (1 + nEff)),
  };
}

/* ------------------------------------------------- exterior ballistics ----- */
export const dragK = (p) => 0.5 * p.rhoAir * p.Cd * Math.PI * p.shaftR * p.shaftR / p.boltMass;
export function flight(v0, range, p) {
  const k = dragK(p);
  const tf = (Math.exp(k * range) - 1) / (k * v0);
  const vEnd = v0 * Math.exp(-k * range);
  const drop = 0.5 * G * tf * tf;
  return { range, time: tf, v0, vEnd, fpsEnd: vEnd * MS2FPS, drop,
    angleDeg: Math.atan2(drop, range) * R2D,
    energy0: 0.5 * p.boltMass * v0 * v0, energyEnd: 0.5 * p.boltMass * vEnd * vEnd };
}
export function trajectory(v0, angleRad, p, maxRange, dt = 0.001) {
  const k = dragK(p);
  let x = 0, y = 0, vxz = v0 * Math.cos(angleRad), vy = v0 * Math.sin(angleRad), t = 0;
  const pts = [{ x, y, t, v: v0 }];
  while (x < maxRange && t < 3) {
    const v = Math.hypot(vxz, vy);
    vxz += -k * v * vxz * dt; vy += (-G - k * v * vy) * dt;
    x += vxz * dt; y += vy * dt; t += dt;
    if (pts.length < 6000) pts.push({ x, y, t, v: Math.hypot(vxz, vy) });
    if (y < -3) break;
  }
  return pts;
}
/* Sight elevation for a given range, in MOA and in clicks (1/4 MOA) */
export function sightSetting(v0, range, p, zeroRange = 50) {
  const here = flight(v0, range, p), zero = flight(v0, zeroRange, p);
  const need = here.drop - zero.drop * (range / zeroRange);
  const rad = Math.atan2(need, range);
  const moa = rad / (Math.PI / 180) * 60;
  return { need, rad, moa, clicks: Math.round(moa * 4), drop: here.drop, time: here.time, vEnd: here.vEnd };
}

export function buildMachine(over) {
  const p = { ...DESIGN, ...(over || {}) };
  const curve = buildCurve(p, 240);
  return { p, curve, shot: shotSolution(p, curve) };
}


