/* ============================================================================
   bowlab / physics.js  —  archery bow mechanics (pure math, no rendering)

   Units (US archery shop units):
     length in inches, force in pounds-force, mass in grains, angles in radians.
   Bow plane is (y,z):  +y = up (top limb), +z = toward the archer.
   The string / arrow plane is x = 0 and the nock rides on the z axis.
   The grip throat sits at (0,0);  at brace the string is the line z = brace.

   ---------------------------------------------------------------------------
   COMPOUND BOW — how the model actually works
   ---------------------------------------------------------------------------
   Every compound bow is:  riser -> limb pocket -> limb (spring) -> cam (lever),
   the cam's fulcrum being its own axle.  Three loads meet at the cam:

       bowstring  pays out of a circular string groove  radius r_s
       cable      winds onto a small hub                radius r_hub
       limb       pushes on the axle  (zero moment about the axle)

   Torque balance about the axle is the governing equation of the whole bow:

       T_string * r_s  =  T_cable * a_c                       (a_c = cable arm)

   `a_c` is the perpendicular distance from the axle to the *line of action* of
   the cable.  A compound cam is shaped so that, as the bow is drawn, the
   cable's line walks in toward the axle and a_c nearly vanishes.  Cable tension
   keeps climbing while its leverage on the cam disappears -- that collapse (the
   cam-over) is let-off.  We carry a_c as a designed profile (camArmHi ->
   camArmLo, collapsing over part of the stroke) and solve for the collapse
   timing and the floor so the curve hits the requested peak position and
   let-off.  Limb tip rate k is then just peakWeight / max(F_unit): the force is
   exactly linear in k because T_cable = k*(delta + deltaPreBend).

   KINEMATICS (derived from geometry, not animated by hand).
   Drive parameter is the nock travel x.  At every x:

       d(x)     = |nock - axle|                      nock is at (0, brace+x)
       L(x)     = sqrt(d^2 - r_s^2)                  straight string leg
       u(x)     = L(x) - L(0)                        arc paid out per cam
       rho(x)   = [psi(x) - psi(0)] + u/r_s          cam rotation
       delta(x) = r_hub * rho(x)                     limb tip travel

   rho comes from the fact that the departure point's *material* angle changes
   by exactly u/r_s while its world angle moves by psi(x)-psi(0).  Note u is
   slightly NEGATIVE just off brace (the string winds on a hair before it pays
   out, because near brace the leg is almost perpendicular to the draw), which
   is why x -- not u -- is the natural parameter.

   The limb tips are pulled together by the cable take-up, so the ATA shrinks
   and the axle rides a circle about the limb pocket.  r_hub is picked so that
   the tips travel (ata - ataFull)/2 by full draw.
   ========================================================================== */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.BowPhysics = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ---------------------------------------------------------------- units ---
  var IN2M = 0.0254, LB2N = 4.4482216152605, GRAIN2KG = 6.479891e-5;
  var INLB2J = IN2M * LB2N, MPS2FPS = 3.280839895, J2FTLB = 1 / 1.35581795;

  // ------------------------------------------------------------- numerics ---
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function smoothstep(t) { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); }
  function trapz(xs, ys) {
    var s = 0;
    for (var i = 1; i < xs.length; i++) s += 0.5 * (ys[i] + ys[i - 1]) * (xs[i] - xs[i - 1]);
    return s;
  }
  function argmax(a) { var m = -Infinity, i = 0; for (var j = 0; j < a.length; j++) if (a[j] > m) { m = a[j]; i = j; } return i; }

  // ------------------------------------------------ 2D geometry (y,z plane) --
  // Tangent point(s) on circle (centre O, radius r) seen from point N.
  // sgn picks a branch; the branch that starts at the front of the cam at brace
  // (string straight between the cams) stays continuous all the way to full
  // draw, and that is sgn = +1 for the top cam.
  function tangentPoint(O, N, r, sgn) {
    var dy = N.y - O.y, dz = N.z - O.z;
    var d = Math.sqrt(dy * dy + dz * dz);
    if (d <= r * 1.0000001) return null;
    var a = Math.acos(clamp(r / d, -1, 1)) * (sgn || 1);
    var c = Math.cos(a), s = Math.sin(a), uy = dy / d, uz = dz / d;
    var py = uy * c - uz * s, pz = uy * s + uz * c;
    return { p: { y: O.y + r * py, z: O.z + r * pz } };
  }
  // Angular position of a point about a centre.  The branch cut is placed on
  // the +y side, which the departure point never crosses, so the angle varies
  // continuously and monotonically through the draw.
  function angAbout(O, p) { return Math.atan2(p.z - O.z, -(p.y - O.y)); }

  // =============================================================== COMPOUND ==
  var COMPOUND_DEFAULTS = {
    kind: 'compound',
    ata: 32,               // axle-to-axle at brace (in)
    brace: 6.75,           // string height over the grip throat (in)
    drawLength: 29,        // AMO draw length (in)
    peakWeight: 70,        // lb
    letOff: 0.80,          // 0.80 = 80% let-off
    peakAt: 0.45,          // peak force at this fraction of the power stroke
    ataFull: 29.0,         // axle-to-axle at full draw (in) -> limb tip travel
    stringGrooveR: 1.35,   // circular string groove radius (in)
    limbPreBend: 0.55,     // limb tip travel already present at brace (in)
    camArmHi: 0.95,        // cable moment arm about the axle at brace (in)
    camArmLo: 0.10,        // ... at full draw (solved)
    camOverAt: 0.40,       // stroke fraction where the arm collapses (solved)
    camOverEnd: 0.88,      // collapse finishes here -> flat "back wall" after
    limbSweep: 1.0,        // visual limb length trim
    arrowMass: 350,        // grains
    virtualMass: 46,       // grains (string + cams + limb effective mass)
    riserHalf: 9.6,        // limb pocket y (in)
    pocketZ: -0.55,        // limb pocket z (in)
    samples: 200
  };

  function compound(paramsIn, noIbo) {
    var P = {}, a;
    for (a in COMPOUND_DEFAULTS) P[a] = COMPOUND_DEFAULTS[a];
    for (a in (paramsIn || {})) if (paramsIn[a] !== undefined && paramsIn[a] !== null) P[a] = paramsIn[a];

    var g = {
      rs: P.stringGrooveR, yPocket: P.riserHalf, zPocket: P.pocketZ,
      ata0: P.ata, brace: P.brace
    };
    g.zAxle0 = P.brace + g.rs;                  // string grazes the groove at brace
    g.dy0 = P.ata / 2 - g.yPocket;
    g.dz0 = g.zAxle0 - g.zPocket;
    g.L0 = Math.sqrt(g.dy0 * g.dy0 + g.dz0 * g.dz0);
    g.limbLen = g.L0 * P.limbSweep;
    var span = Math.max((P.drawLength - 1.75) - P.brace, 1);
    var deltaEnd = Math.max(P.ata - P.ataFull, 0) / 2;
    var rs = g.rs;

    // axle position once the limbs have been pulled together by `delta`
    function axleAt(delta, side) {
      var dy = Math.max(g.dy0 - delta, 0.2);
      var dz = Math.sqrt(Math.max(g.L0 * g.L0 - dy * dy, 1e-6));
      return { y: side * (g.yPocket + dy), z: g.zPocket + dz };
    }

    // ---- brace reference -------------------------------------------------
    var ax0 = axleAt(0, 1);
    var tp0 = tangentPoint(ax0, { y: 0, z: P.brace }, rs, 1);
    var ANG0 = angAbout(ax0, tp0.p);
    var L0 = Math.sqrt(Math.max(ax0.y * ax0.y + (P.brace - ax0.z) * (P.brace - ax0.z) - rs * rs, 1e-9));

    // ---- one state, solved for a nock travel x ---------------------------
    function stateAt(x, rHub, design, rhoGuess) {
      var zN = P.brace + x;
      var rho = rhoGuess || (x / span) * (deltaEnd / Math.max(rHub, 1e-6));
      var st = null, converged = false;
      for (var it = 0; it < 60; it++) {
        var delta = rHub * rho;
        var ax = axleAt(delta, 1);
        var d = Math.sqrt(ax.y * ax.y + (zN - ax.z) * (zN - ax.z));
        var L = Math.sqrt(Math.max(d * d - rs * rs, 1e-9));
        var u = L - L0;
        var tp = tangentPoint(ax, { y: 0, z: zN }, rs, 1) ||
                 { p: { y: ax.y, z: ax.z - rs } };
        var rhoNew = (angAbout(ax, tp.p) - ANG0) + u / rs;
        st = { rho: rhoNew, delta: delta, ax: ax, zN: zN, tp: tp, L: L, u: u, d: d };
        if (Math.abs(rhoNew - rho) < 1e-13) { rho = rhoNew; converged = true; break; }
        rho = rhoNew;
      }
      var t = clamp(x / span, 0, 1);
      var arm = armAt(t, design);
      var Tcab = st.delta + P.limbPreBend;           // per unit k
      var Tstr = Tcab * arm / rs;                    // per unit k
      var uy = -st.tp.p.y, uz = zN - st.tp.p.z;
      var ln = Math.sqrt(uy * uy + uz * uz) || 1;
      st.t = t; st.arm = arm; st.Tcab = Tcab; st.Tstr = Tstr;
      st.uz = uz / ln; st.F = 2 * Tstr * st.uz;      // per unit k
      st.x = x; st.converged = converged;
      return st;
    }

    // cam-over: the cable's lever arm about the axle, in inches
    function armAt(t, design) {
      var w = Math.max(design.end - design.at, 1e-3);
      var col = smoothstep(clamp((t - design.at) / w, 0, 1));
      return Math.max(design.hi - (design.hi - design.lo) * col, 0.006);
    }

    // sweep x = 0..span carrying the rotation guess forward (fast + stable)
    function sweep(rHub, design, N) {
      var rows = new Array(N), rg = 0;
      for (var i = 0; i < N; i++) {
        var x = (i / (N - 1)) * span;
        rows[i] = stateAt(x, rHub, design, rg);
        rg = rows[i].rho;
      }
      return rows;
    }

    // r_hub so the limb tips travel deltaEnd by full draw (fixed point)
    function fitHub(design, N) {
      var rHub = 0.2;
      for (var it = 0; it < 14; it++) {
        var rows = sweep(rHub, design, N || 21);
        var rNew = clamp(deltaEnd / Math.max(Math.abs(rows[rows.length - 1].rho), 1e-6), 0.02, 3.0);
        if (Math.abs(rNew - rHub) < 1e-12) { rHub = rNew; break; }
        rHub = rNew;
      }
      return rHub;
    }

    // normalised shape -> find peak position + end level (k independent)
    function shapeOf(design, rHub) {
      var rows = sweep(rHub, design, 41);
      var F = rows.map(function (r) { return r.F; });
      var i = argmax(F);
      return { peakT: rows[i].t, endNorm: F[F.length - 1] / (F[i] || 1), rhoEnd: rows[rows.length - 1].rho };
    }

    function fit() {
      var design = { hi: P.camArmHi, lo: P.camArmLo, at: P.camOverAt, end: P.camOverEnd };
      var rHub = 0.2;
      for (var pass = 0; pass < 3; pass++) {
        // collapse timing -> peak position (later collapse = later peak)
        var lo = 0.02, hi = Math.min(design.end - 0.02, 0.86);
        for (var i = 0; i < 11; i++) {
          var mid = 0.5 * (lo + hi);
          design.at = mid;
          if (shapeOf(design, rHub).peakT < P.peakAt) lo = mid; else hi = mid;
        }
        design.at = 0.5 * (lo + hi);
        // arm floor -> let-off depth (lower floor = deeper let-off)
        var lo2 = 0.004, hi2 = Math.max(design.hi * 0.98, 0.02), target = 1 - P.letOff;
        for (var j = 0; j < 13; j++) {
          var m2 = 0.5 * (lo2 + hi2);
          design.lo = m2;
          if (shapeOf(design, rHub).endNorm > target) hi2 = m2; else lo2 = m2;
        }
        design.lo = 0.5 * (lo2 + hi2);
        rHub = fitHub(design, 15);
      }
      return { design: design, rHub: rHub };
    }

    var fitRes = fit();
    var design = fitRes.design;
    var rHub = fitHub(design, 31);

    // ---- final sample table ----------------------------------------------
    var N = P.samples, rows = sweep(rHub, design, N);
    var Fs = rows.map(function (r) { return r.F; });
    var pi = argmax(Fs);
    var k = P.peakWeight / (Fs[pi] || 1);
    rows.forEach(function (r) { r.F *= k; r.Tcab *= k; r.Tstr *= k; });
    Fs = rows.map(function (r) { return r.F; });
    var xs = rows.map(function (r) { return r.x; });

    // ---- energy + arrow ---------------------------------------------------
    var energy = trapz(xs, Fs);                        // in*lb
    var mArrow = P.arrowMass * GRAIN2KG, mVirt = P.virtualMass * GRAIN2KG;
    var speed = Math.sqrt(2 * energy * INLB2J / (mArrow + mVirt));
    var ke = 0.5 * mArrow * speed * speed;

    var cum = [0], vel = [0], tim = [0];
    for (var s = 1; s < N; s++) {
      cum.push(cum[s - 1] + 0.5 * (Fs[s] + Fs[s - 1]) * (xs[s] - xs[s - 1]));   // in*lb
      vel.push(Math.sqrt(2 * cum[s] * INLB2J / (mArrow + mVirt)));
    }
    /* The release runs the other way: the arrow starts at full draw (all the
       energy stored) and leaves the string at brace, so its speed is
       sqrt(2*(E_total - cum)/m_eff) and the power-stroke time is the integral
       of dx/v along that path. */
    var relVel = [], tim2 = [];
    for (var q3 = 0; q3 < N; q3++) relVel.push(Math.sqrt(Math.max(0, 2 * (energy - cum[q3]) * INLB2J / (mArrow + mVirt))));
    tim2[N - 1] = 0;
    for (var q4 = N - 2; q4 >= 0; q4--) {
      var vAvg = 0.5 * (relVel[q4] + relVel[q4 + 1]);
      tim2[q4] = tim2[q4 + 1] + (xs[q4 + 1] - xs[q4]) * IN2M / Math.max(vAvg, 0.5);
    }
    tim = tim2;

    function stateAtT(t) {
      t = clamp(t, 0, 1);
      var f = t * (N - 1), i0 = Math.floor(f), i1 = Math.min(i0 + 1, N - 1), ft = f - i0;
      var A = rows[i0], B = rows[i1];
      var R = function (key) { return lerp(A[key], B[key], ft); };
      return {
        t: t, x: R('x'), F: R('F'), theta: R('rho'), delta: R('delta'),
        arm: R('arm'), Tcab: R('Tcab'), Tstr: R('Tstr'), uz: R('uz'), u: R('u'),
        rHub: rHub, zNock: R('zN'), L: R('L'), d: R('d'),
        axle: { y: lerp(A.ax.y, B.ax.y, ft), z: lerp(A.ax.z, B.ax.z, ft) },
        axleB: { y: -lerp(A.ax.y, B.ax.y, ft), z: lerp(A.ax.z, B.ax.z, ft) },
        tp: { p: { y: lerp(A.tp.p.y, B.tp.p.y, ft), z: lerp(A.tp.p.z, B.tp.p.z, ft) } }
      };
    }

    var metrics = {
      kind: 'compound',
      powerStroke: span,
      peakForce: Fs[pi], peakAtX: xs[pi], peakFrac: rows[pi].t,
      holdForce: Fs[N - 1],
      letOff: 1 - Fs[N - 1] / (Fs[pi] || 1),
      valleyForce: (function () { var m = Infinity; for (var i = Math.floor(N * 0.8); i < N; i++) m = Math.min(m, Fs[i]); return m; })(),
      energy: energy, energyFtLb: energy / 12, energyJ: energy * INLB2J,
      arrowSpeed: speed, fps: speed * MPS2FPS, arrowKE: ke, arrowKEftLb: ke * J2FTLB,
      efficiency: energy > 0 ? ke / (energy * INLB2J) : 0,
      momentum: mArrow * speed,
      limbRate: k, limbTipTravel: rows[N - 1].delta,
      ataFull: P.ata - 2 * rows[N - 1].delta,
      cableTensionBrace: rows[0].Tcab,
      cableTensionPeak: (function () { var m = 0; for (var i = 0; i < N; i++) m = Math.max(m, rows[i].Tcab); return m; })(),
      cableTensionFull: rows[N - 1].Tcab,
      stringTensionBrace: rows[0].Tstr,
      stringTensionPeak: (function () { var m = 0; for (var i = 0; i < N; i++) m = Math.max(m, rows[i].Tstr); return m; })(),
      stringTensionFull: rows[N - 1].Tstr,
      cableArmBrace: rows[0].arm, cableArmFull: rows[N - 1].arm,
      hubRadius: rHub, camTurns: rows[N - 1].rho / (2 * Math.PI),
      camRotationDeg: rows[N - 1].rho * 180 / Math.PI,
      payout: rows[N - 1].u, drawTime: tim[0],
      design: design, params: P, geometry: g
    };

    if (!noIbo) {
      try {
        var ibo = {}; for (var kk in P) ibo[kk] = P[kk];
        ibo.peakWeight = 70; ibo.drawLength = 30; ibo.brace = 6.75; ibo.arrowMass = 350;
        metrics.iboFps = compound(ibo, true).metrics.fps;
      } catch (e) { metrics.iboFps = null; }
    }

    return {
      kind: 'compound', params: P, geometry: g, metrics: metrics, design: design,
      rows: rows, xs: xs, forces: Fs, cumulative: cum, velocity: vel, releaseVel: relVel, time: tim,
      stateAtT: stateAtT,
      armProfile: rows.map(function (r) { return { t: r.t, arm: r.arm }; }),
      tensionProfile: rows.map(function (r) { return { t: r.t, Tcab: r.Tcab, Tstr: r.Tstr }; })
    };
  }

  // =============================================================== RECURVE ==
  var RECURVE_DEFAULTS = {
    kind: 'recurve',
    tipToTip: 62, brace: 7.0, drawLength: 28, drawWeight: 45,
    riserHalf: 12.5, pocketZ: -0.8,
    tipRadius: 2.5,        // recurve hook radius at the tip (in) - flattens the curve
    braceTension: 36,      // string tension at brace (lb) -> limb preload
    arrowMass: 400, virtualMass: 52, preCurve: 1.14, samples: 160
  };

  function recurve(paramsIn) {
    var P = {}, a;
    for (a in RECURVE_DEFAULTS) P[a] = RECURVE_DEFAULTS[a];
    for (a in (paramsIn || {})) if (paramsIn[a] !== undefined && paramsIn[a] !== null) P[a] = paramsIn[a];

    var span = Math.max((P.drawLength - 1.75) - P.brace, 1);
    var rt = P.tipRadius;
    var g = { yPocket: P.riserHalf, zPocket: P.pocketZ, tipToTip: P.tipToTip, brace: P.brace, tipR: rt };
    var y0 = P.tipToTip / 2;
    // At brace the string is the straight line z = brace resting in the hooks,
    // so the tip *centres* sit tipR in front of the string line.
    var dy0 = y0 - P.riserHalf, dz0 = (P.brace - rt) - P.pocketZ;
    // kinematics run off the pocket->tip chord, which is fixed at brace;
    // preCurve only lengthens the limb *arc* (the visual pre-bend).
    g.limbChord = Math.sqrt(dy0 * dy0 + dz0 * dz0);
    g.limbArc = g.limbChord * P.preCurve;
    g.limbLen = g.limbChord;
    g.beta0 = Math.atan2(dz0, dy0);
    g.Lstr = y0;                                   // straight half-string (constant)
    g.dNock = Math.sqrt(g.Lstr * g.Lstr + rt * rt);

    function tipAt(phi, side) {
      var b = g.beta0 + phi;
      var s = side === undefined ? 1 : side;
      return { y: s * (g.yPocket + g.limbChord * Math.cos(b)), z: g.zPocket + g.limbChord * Math.sin(b) };
    }

    // ---- string length bookkeeping ---------------------------------------
    // Total string length is fixed, so  leg + (arc wrapped on the hook) = C.
    // The departure point walks around the hook as the limb rotates, and that
    // arc IS the payout.  For a given limb rotation we therefore solve for the
    // nock position zN such that the constraint holds.
    var psi0, C0, leg0;
    (function init() {
      var t = tipAt(0, 1);
      var d = Math.sqrt(t.y * t.y + (P.brace - t.z) * (P.brace - t.z));
      leg0 = Math.sqrt(Math.max(d * d - rt * rt, 1e-9));
      var dep = tangentPoint(t, { y: 0, z: P.brace }, rt, -1) || { p: { y: t.y, z: P.brace } };
      psi0 = angAbout(t, dep.p);
      C0 = leg0 + rt * psi0;
    })();

    function hookState(phi, zn) {
      var t = tipAt(phi, 1);
      var d = Math.sqrt(t.y * t.y + (zn - t.z) * (zn - t.z));
      var leg = Math.sqrt(Math.max(d * d - rt * rt, 1e-9));
      var dep = tangentPoint(t, { y: 0, z: zn }, rt, -1) || { p: { y: t.y, z: zn } };
      var psi = angAbout(t, dep.p);
      // keep psi on the same branch as the brace value
      while (psi - psi0 > Math.PI) psi -= 2 * Math.PI;
      while (psi - psi0 < -Math.PI) psi += 2 * Math.PI;
      return { tip: t, leg: leg, psi: psi, dep: dep.p, d: d };
    }
    // solve for the nock z that satisfies leg + tipR*(psi - phi) = C0.  The
    // wrap arc has to be measured in the LIMB's frame, hence the -phi term:
    // rotating the limb by phi winds tipR*phi of string onto the tip.
    function nockZ(phi, zLo, zHi) {
      var lo = zLo, hi = zHi;
      for (var i = 0; i < 60; i++) {
        var mid = 0.5 * (lo + hi);
        var hs = hookState(phi, mid);
        var f = hs.leg + rt * (hs.psi - phi) - C0;
        if (f < 0) lo = mid; else hi = mid;
      }
      return 0.5 * (lo + hi);
    }

    // limb rotation that reaches the power stroke
    var lo = 0, hi = 1.2, zLo = P.brace - 0.5, zHi = P.brace + span * 2.5 + 2;
    for (var i = 0; i < 40; i++) {
      var mid = 0.5 * (lo + hi);
      if (nockZ(mid, zLo, zHi) - P.brace < span) lo = mid; else hi = mid;
    }
    var phiMax = 0.5 * (lo + hi);
    var N = P.samples, dphi = phiMax / (N - 1);
    var xs = [], phis = [], Gk = [], tips = [], zns = [], deps = [], uzs = [], hs = [];

    for (var j = 0; j < N; j++) {
      var phi = j * dphi;
      var zn = nockZ(phi, zLo, zHi);
      var st = hookState(phi, zn);
      var legLen = Math.hypot(st.dep.y - 0, st.dep.z - zn);
      var uz = (zn - st.dep.z) / (legLen || 1);
      // Moment arm of the whole string force (leg tension + wrap + anchor knot)
      // about the limb pocket: by virtual work that is exactly the sensitivity
      // of the string's length to the limb angle at a FIXED nock position.
      var hh = 2e-5;
      var Lp = hookState(phi + hh, zn), Lm = hookState(phi - hh, zn);
      var H = ((Lp.leg + rt * (Lp.psi - (phi + hh))) - (Lm.leg + rt * (Lm.psi - (phi - hh)))) / (2 * hh);
      var G = 2 * uz / Math.max(Math.abs(H), 1e-6);
      xs.push(zn - P.brace); phis.push(phi); Gk.push(G); tips.push(st.tip); zns.push(zn);
      deps.push(st.dep); uzs.push(uz); hs.push(Math.abs(H));
    }

    // ---- solve kt and the limb pre-rotation at brace ----------------------
    //   T(0) = kt*phiPre/H0 = chosen brace tension      (limb moment balance)
    //   F(full) = 2*kt*(phiPre+phiEnd)*uz/H            (= draw weight)
    // With these, F = kt*(phiPre+phi)*dphi/dx exactly, so the curve is
    // conservative and F(0) = 0 falls out of the geometry (uz(0) = 0).
    var A = P.braceTension * hs[0];                        // kt*phiPre
    var Ge = Gk[N - 1];
    var kt = (P.drawWeight - A * Ge) / Math.max(phiMax * Ge, 1e-9);
    var phiPre = A / Math.max(kt, 1e-9);
    var Fs = [], Tsk = [];
    for (var q = 0; q < N; q++) {
      var F = 2 * kt * (phiPre + phis[q]) * uzs[q] / Math.max(hs[q], 1e-6);
      Fs.push(F);
      // String tension from the nock's force balance F = 2*T*uz.  Right at
      // brace F and uz both vanish, so blend in the static brace tension.
      var uzq = Math.max(uzs[q], 1e-4);
      var Tn = F / (2 * uzq);
      var wgt = smoothstep(clamp(xs[q] / 0.75, 0, 1));
      Tsk.push((1 - wgt) * P.braceTension + wgt * Tn);
    }
    var energy = trapz(xs, Fs);
    var mArrow = P.arrowMass * GRAIN2KG, mVirt = P.virtualMass * GRAIN2KG;
    var speed = Math.sqrt(2 * energy * INLB2J / (mArrow + mVirt));
    var ke = 0.5 * mArrow * speed * speed;

    var cum = [0], vel = [0], tim = [];
    for (var s = 1; s < N; s++) {
      cum.push(cum[s - 1] + 0.5 * (Fs[s] + Fs[s - 1]) * (xs[s] - xs[s - 1]));   // in*lb
      vel.push(Math.sqrt(2 * cum[s] * INLB2J / (mArrow + mVirt)));
    }
    var relVel = [];
    for (var q5 = 0; q5 < N; q5++) relVel.push(Math.sqrt(Math.max(0, 2 * (energy - cum[q5]) * INLB2J / (mArrow + mVirt))));
    tim[N - 1] = 0;
    for (var q6 = N - 2; q6 >= 0; q6--) tim[q6] = tim[q6 + 1] + (xs[q6 + 1] - xs[q6]) * IN2M / Math.max(0.5 * (relVel[q6] + relVel[q6 + 1]), 0.5);

    var tip0 = tipAt(0, 1), tipN = tips[N - 1];

    function stateAtT(t) {
      t = clamp(t, 0, 1);
      var f = t * (N - 1), i0 = Math.floor(f), i1 = Math.min(i0 + 1, N - 1), ft = f - i0;
      var A = tips[i0], B = tips[i1], DA = deps[i0], DB = deps[i1];
      return {
        t: t, x: lerp(xs[i0], xs[i1], ft), F: lerp(Fs[i0], Fs[i1], ft),
        phi: lerp(phis[i0], phis[i1], ft),
        tip: { y: lerp(A.y, B.y, ft), z: lerp(A.z, B.z, ft) },
        tipB: { y: -lerp(A.y, B.y, ft), z: lerp(A.z, B.z, ft) },
        dep: { y: lerp(DA.y, DB.y, ft), z: lerp(DA.z, DB.z, ft) },
        depB: { y: -lerp(DA.y, DB.y, ft), z: lerp(DA.z, DB.z, ft) },
        zNock: lerp(zns[i0], zns[i1], ft),
        Tstr: lerp(Tsk[i0], Tsk[i1], ft)
      };
    }

    return {
      kind: 'recurve', params: P, geometry: g, tip0: tip0,
      xs: xs, forces: Fs, cumulative: cum, velocity: vel, releaseVel: relVel, time: tim,
      tips: tips, phis: phis, stateAtT: stateAtT, armProfile: null, design: null,
      metrics: {
        kind: 'recurve',
        powerStroke: span, peakForce: P.drawWeight, peakAtX: xs[N - 1], peakFrac: 1,
        holdForce: P.drawWeight, letOff: 0, valleyForce: P.drawWeight,
        energy: energy, energyFtLb: energy / 12, energyJ: energy * INLB2J,
        arrowSpeed: speed, fps: speed * MPS2FPS, arrowKE: ke, arrowKEftLb: ke * J2FTLB,
        efficiency: energy > 0 ? ke / (energy * INLB2J) : 0,
        momentum: mArrow * speed,
        limbRate: kt, phiPre: phiPre,
        limbTipTravel: Math.sqrt((tipN.y - tip0.y) * (tipN.y - tip0.y) + (tipN.z - tip0.z) * (tipN.z - tip0.z)),
        tipTravelY: tip0.y - tipN.y, tipTravelZ: tipN.z - tip0.z,
        stringTensionBrace: Tsk[0], stringTensionPeak: Tsk[N - 1],
        stringTensionFull: Tsk[N - 1],
        limbRotationDeg: phis[N - 1] * 180 / Math.PI,
        drawTime: tim[0],
        design: null, params: P, geometry: g
      }
    };
  }

  return {
    compound: compound, recurve: recurve,
    COMPOUND_DEFAULTS: COMPOUND_DEFAULTS, RECURVE_DEFAULTS: RECURVE_DEFAULTS,
    solve: function (p) { return (p && p.kind === 'recurve') ? recurve(p) : compound(p); },
    units: { IN2M: IN2M, LB2N: LB2N, GRAIN2KG: GRAIN2KG, INLB2J: INLB2J, MPS2FPS: MPS2FPS },
    util: { clamp: clamp, lerp: lerp, smoothstep: smoothstep, trapz: trapz, tangentPoint: tangentPoint, angAbout: angAbout }
  };
});
