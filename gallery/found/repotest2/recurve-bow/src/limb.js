/* ============================================================================
   recurve-bow / src/limb.js

   One limb, from curvature to mesh, with no iteration anywhere in the
   geometry path.

   Everything the rest of the program needs about a limb comes out of one
   function -- integrate() -- which walks the centreline by arc length:

       theta += kappa ds        (tangent turns)
       z     += sin(theta) ds
       y     += cos(theta) ds

   Bend the limb by changing kappa and re-run that loop. Arc length is
   preserved for free, the tip lands wherever it lands (we measure it rather
   than assume it), and the strain energy is the same integral over the same
   samples. Nothing can fail to converge because nothing is being solved.

   ---------------------------------------------------------------------------
   HOW THE LIMB BENDS

   Drawing the bow applies a tip load along the string. The added curvature is
   the classical first-order beam result,

       delta_kappa(s) = bend * |arm(s)| / EI(s)

   where `arm` is the perpendicular distance from the section to the line of
   action of the string and EI is the real section stiffness w*t^3/12 of the
   actual taper. That is a single forward pass -- no equilibrium iteration.

   The interesting consequence: arm/EI comes out very nearly CONSTANT along
   this limb (it stays within a factor of 1.4 root to tip). The taper and the
   recurve profile between them keep the bending strain almost uniform, which
   is exactly what a well-designed laminated limb is shaped to do. The model
   discovers that rather than being told it.
   ========================================================================== */

import * as M from './mesh.js';
import { LIMB, RISER, TARGET } from './param.js';

/* Brace height and draw length are both measured from the THROAT of the grip
   -- the deepest point of the grip's curve, not the deepest point anywhere on
   the riser. Taking the max over the whole profile table picks up the limb
   pocket seat, which stands 0.034" proud of the throat and quietly shifts
   every draw-length number by that much. */
export const pivotZ = (() => {
  const T = RISER.profile.slice().sort((a, b) => a[0] - b[0]);
  const y = RISER.throatY;
  for (let i = 0; i < T.length - 1; i++) {
    if (y >= T[i][0] && y <= T[i + 1][0]) {
      const t = (y - T[i][0]) / (T[i + 1][0] - T[i][0]);
      return T[i][3] + (T[i + 1][3] - T[i][3]) * t;
    }
  }
  return T[T.length - 1][3];
})();
export const DRAWN_NOCK_Z = pivotZ + TARGET.drawLength - 1.75;
export const BRACE_NOCK_Z = pivotZ + TARGET.brace;

/* ------------------------------------------------------------ curvature --- */

/* The braced curvature. A recurve's bend is NOT concentrated at the root: the
   inner limb is nearly straight and the working curve is outboard, which is
   what lets the limb leave the pocket going up rather than sideways and then
   lie down alongside the string. kappaBase is the fraction of the curvature
   present at the butt; kappaQ shapes the ramp outboard. */
export function baseKappa(s) {
  const { L, theta0, straightAt, kappaBase, kappaQ, hookFrom, hookTurn, hookBlend } = LIMB;
  let k = 0;
  if (s < straightAt) {
    const u = s / straightAt;
    const f = kappaBase + (1 - kappaBase) * Math.pow(u, kappaQ);
    const norm = straightAt * (kappaBase + (1 - kappaBase) / (kappaQ + 1));
    k -= (theta0 / (L * norm)) * f;
  }
  if (s > hookFrom) {
    const t = Math.min(1, (s - hookFrom) / hookBlend);
    const w = t * t * (3 - 2 * t);
    k += (hookTurn / (L * (1 - hookFrom - hookBlend / 2))) * w;
  }
  return k;
}

/* Section second moment about the in-plane axis, E factored out. */
export function EIunit(s) {
  const w = widthAt(s), t = thickAt(s);
  return (w * t * t * t) / 12;
}

/* ------------------------------------------------------------ the modes --- */

/* Two independent ways this limb can change shape, and a pose is a mix of
   them:

       g1  the inboard cantilever mode -- curvature weighted by the moment arm
           of the string load over the real section stiffness. Classical.
       g2  the outboard mode -- concentrated in the recurve. This is the
           section unrolling, which is what a recurve tip actually does.

   One mode is NOT enough, and the reason is worth stating: with the butt
   angle pinned by the pocket, every single-mode change that moves the tip
   backward also straightens the limb and therefore RELEASES energy. A bow
   built from one mode draws by getting weaker. The second mode lets the
   shape rotate and shorten at the same time.

   Which mix the limb actually takes is decided by minimum potential energy
   in mech.js -- not by a hand-picked number here. */

let _modes = null;
export function bendModes(n = 420) {
  if (_modes && _modes.n === n) return _modes;
  const st = integrate({ a: 0, b: 0 }, n);
  const tip = st[n - 1];
  let dy = -tip.y, dz = DRAWN_NOCK_Z - tip.z;
  const dl = Math.hypot(dy, dz) || 1;
  dy /= dl; dz /= dl;

  const g1 = new Float64Array(n), g2 = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const s = i / (n - 1);
    const py = st[i].y - tip.y, pz = st[i].z - tip.z;
    const arm = Math.abs(py * dz - pz * dy);
    g1[i] = arm / EIunit(s);
    const u = (s - LIMB.mode2At) / LIMB.mode2Width;
    g2[i] = Math.exp(-u * u);
  }
  const norm = (g) => {
    let m = 0;
    for (const v of g) m = Math.max(m, v);
    if (m > 0) for (let i = 0; i < n; i++) g[i] /= m;
  };
  norm(g1); norm(g2);
  _modes = { n, g1, g2 };
  return _modes;
}

function sample(g, s) {
  const n = g.length;
  const x = Math.max(0, Math.min(1, s)) * (n - 1);
  const i = Math.min(n - 2, Math.floor(x));
  const t = x - i;
  return g[i] * (1 - t) + g[i + 1] * t;
}

export function kappaAt(s, pose) {
  const k = baseKappa(s);
  if (!pose) return k;
  const { a = 0, b = 0 } = pose;
  if (!a && !b) return k;
  const m = bendModes();
  /* Positive `a` leans the limb further toward the archer, which is the
     direction the string pulls; `b` unrolls the recurve. Together they are
     rich enough to both move the tip and store energy -- which one mode
     alone demonstrably cannot. */
  return k + a * sample(m.g1, s) + b * sample(m.g2, s);
}

/* ------------------------------------------------- integration of the line --- */

export function integrate(pose = null, n = LIMB.nStations) {
  const { L, theta0, buttY, buttZ } = LIMB;
  const ds = 1 / (n - 1);
  const out = new Array(n);
  let theta = theta0, z = buttZ, y = buttY;
  out[0] = { s: 0, z, y, theta };
  for (let i = 1; i < n; i++) {
    const s0 = (i - 1) * ds, s1 = i * ds;
    const k0 = kappaAt(s0, pose), k1 = kappaAt(s1, pose);
    const dth = 0.5 * (k0 + k1) * ds * L;
    const tm = theta + 0.5 * dth;
    theta += dth;
    z += Math.sin(tm) * ds * L;
    y += Math.cos(tm) * ds * L;
    out[i] = { s: s1, z, y, theta };
  }
  return out;
}

/* ---------------------------------------------------------- section sizes --- */

function lerpTable(table, s) {
  if (s <= table[0][0]) return table[0][1];
  const last = table[table.length - 1];
  if (s >= last[0]) return last[1];
  for (let i = 0; i < table.length - 1; i++) {
    if (s >= table[i][0] && s <= table[i + 1][0]) {
      const t = (s - table[i][0]) / (table[i + 1][0] - table[i][0]);
      return table[i][1] + (table[i + 1][1] - table[i][1]) * t;
    }
  }
  return last[1];
}

export const widthAt = s => lerpTable(LIMB.width, s);
export const thickAt = s => lerpTable(LIMB.thick, s);

/* extra material for the butt wedge and the tip overlay */
function extraAt(s) {
  let e = 0;
  const w = LIMB.wedge, o = LIMB.overlay;
  if (s < w.from + w.len) {
    const t = 1 - (s - w.from) / w.len;
    e = Math.max(e, w.extra * Math.max(0, Math.min(1, t)) ** 0.6);
  }
  if (s > o.from) {
    const t = 1 - (s - o.from) / o.len;
    e = Math.max(e, o.extra * Math.max(0, Math.min(1, t)));
  }
  return e;
}

/* groove depth at this station -- zero outside the milled stretch */
export function grooveAt(s) {
  const g = LIMB.groove;
  if (s < g.from || s > g.to) return 0;
  const t = Math.min(1, (s - g.from) / g.fadeIn);
  return g.depth * (t * t * (3 - 2 * t));
}

/* Distance from the centreline to the belly face -- the surface the string
   sits on. Everything about contact, brace height and string length uses this
   one number, so the groove cannot get out of step with the string. */
export function bellyOffset(s) {
  return thickAt(s) / 2 + extraAt(s) - grooveAt(s);
}

/* The closed cross section at station s, as [a, b] with a along +x (lateral)
   and b along the in-plane belly normal. The string groove is a flat-bottomed
   channel carved into the +b face by MOVING POINTS, not by a boolean. */
export function sectionAt(s) {
  const e = extraAt(s);
  const hw = widthAt(s) / 2 + e * 0.35;
  const ht = thickAt(s) / 2 + e;
  const r = LIMB.edgeFrac * Math.min(hw, ht);
  const pts = M.roundedRect(hw, ht, r, LIMB.ringCorner);
  const g = grooveAt(s);
  if (g > 0) {
    const halfW = LIMB.groove.width / 2;
    for (const p of pts) {
      if (p[1] <= 0) continue;
      const t = 1 - Math.min(1, Math.abs(p[0]) / halfW);
      if (t <= 0) continue;
      p[1] -= g * (t * t * (3 - 2 * t));
    }
  }
  return pts;
}

/* The belly surface -- the only part of the limb the string can ever touch.
   Returned in the (z, y) plane of the bow. */
export function bellyProfile(pose = null, n = LIMB.nStations) {
  const st = integrate(pose, n);
  return st.map(p => {
    const nz = Math.cos(p.theta), ny = -Math.sin(p.theta);
    const b = bellyOffset(p.s);
    return [p.z + nz * b, p.y + ny * b];
  });
}

/* --------------------------------------------------------------- energy --- */

/* Strain energy RELATIVE TO THE MOULDED SHAPE.

   This is the point that makes the whole model work. A laminated limb comes
   out of the press already curved; at brace it is bent away from that moulded
   curve, and drawing bends it further. Measuring strain against a STRAIGHT
   limb instead (as the first version of this file did) gets the sign of the
   draw force wrong, because the model then thinks the shortest route to a
   longer string is to unbend -- and a bow that unbends when drawn gets
   weaker, which is not a bow.

   With the moulded curve as the reference, energy is zero at brace, rises
   with every departure from it, and the least-energy shape consistent with
   the string is the one nearest the mould. That is both the correct physics
   and the thing that picks the right branch of the constraint. */
export function drawEnergy(pose = null, n = 300) {
  const ds = (1 / (n - 1)) * LIMB.L;
  let e = 0;
  for (let i = 0; i < n; i++) {
    const s = i / (n - 1);
    const dk = kappaAt(s, pose) - baseKappa(s);
    const w = (i === 0 || i === n - 1) ? 0.5 : 1;
    e += w * 0.5 * EIunit(s) * dk * dk * ds;
  }
  return e;                       // multiply by E (psi) for inch-pounds
}

/* ---------------------------------------------------------------- meshing --- */

export function limbMesh(pose = null, n = LIMB.nStations) {
  const st = integrate(pose, n);
  const rings = st.map(p => {
    const nz = Math.cos(p.theta), ny = -Math.sin(p.theta);
    return sectionAt(p.s).map(([a, b]) => [a, p.y + ny * b, p.z + nz * b]);
  });
  return M.loft(rings, { ringClosed: true, capStart: true, capEnd: true });
}

/* The ILF dovetail tenon at the butt. A constant trapezoid in (z,y) swept
   along x -- and it deliberately runs up inside the limb body so the two
   solids overlap instead of leaving a hairline gap at the joint. */
export function dovetailTenon() {
  const d = LIMB.dovetail;
  const poly = [
    [d.floorZ[0], d.yBot], [d.floorZ[1], d.yBot],
    [d.mouthZ[1], d.yTop], [d.mouthZ[0], d.yTop],
  ];
  return M.extrudeBeveled(M.polyRound(poly, 0.012, 2), d.x0, d.x1, 'yz', d.bevel, 5);
}

/* The whole limb: body + tenon, already mirrored for the lower limb. */
export function buildLimb(pose = null, sign = 1) {
  let m = M.merge([limbMesh(pose), dovetailTenon()]);
  if (sign < 0) m = M.transform(m, M.mat4({ s: [1, -1, 1] }));
  return m;
}

/* ------------------------------------------------------------- reporting --- */

export function tipOf(pose = null) {
  const st = integrate(pose);
  return st[st.length - 1];
}

export function report(pose = null) {
  const t = tipOf(pose);
  return {
    pose: pose ? { a: +pose.a.toFixed(5), b: +pose.b.toFixed(5) } : null,
    tipY: +t.y.toFixed(4), tipZ: +t.z.toFixed(4),
    tipTheta: +(t.theta * 180 / Math.PI).toFixed(3),
    chord: +Math.hypot(t.y - LIMB.buttY, t.z - LIMB.buttZ).toFixed(4),
  };
}
