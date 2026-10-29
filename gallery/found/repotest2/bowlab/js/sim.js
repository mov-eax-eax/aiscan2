/* ============================================================================
   bowlab / sim.js — draw / hold / release / flight state machine.
   The power stroke is timed from the mechanics: dx/dt = v(x), where v comes
   from the energy integral of the solved draw-force curve.  So the arrow
   leaves the string at exactly the speed the physics predicts, and the cams
   unwind over the real 15-25 ms the power stroke takes.
   ========================================================================== */
(function (root) {
  'use strict';
  var U = root.BowPhysics.units;

  function Sim() {
    this.bp = null;
    this.phase = 'brace';       // brace | drawing | holding | power | flight
    this.t = 0;                 // draw fraction 0..1
    this.x = 0;                 // nock travel (in)
    this.vx = 0;                // arrow speed (m/s)
    this.time = 0;
    this.arrow = { z: 0, y: 0, v: 0, vz: 0, vy: 0, flying: false, dist: 0 };
    this.vibe = { y: 0, z: 0, amp: 0, phase: 0 };
    this.drawRate = 2.4;        // draw fractions per second
    this.slowmo = 0.02;         // power-stroke time scale
    this.flightSlow = 0.05;
    this.autoReset = 2.4;
    this.resetTimer = 0;
    this.listeners = [];
  }

  Sim.prototype.setBlueprint = function (bp) {
    this.bp = bp;
    this.span = bp.metrics.powerStroke;
    this.rows = bp.rows;
    this.reset();
  };
  Sim.prototype.on = function (fn) { this.listeners.push(fn); };
  Sim.prototype.emit = function (ev) { this.listeners.forEach(function (f) { f(ev); }); };

  Sim.prototype.reset = function () {
    this.phase = 'brace'; this.t = 0; this.x = 0; this.time = 0;
    this.vx = 0;
    this.arrow = { z: 0, y: 0, v: 0, vz: 0, vy: 0, flying: false, dist: 0 };
    this.vibe.amp = 0; this.resetTimer = 0;
  };
  Sim.prototype.startDraw = function () {
    if (this.phase === 'brace' || this.phase === 'holding') this.phase = 'drawing';
    this.emit('draw');
  };
  Sim.prototype.stopDraw = function () {
    if (this.phase === 'drawing') { this.phase = 'holding'; this.emit('hold'); }
  };
  Sim.prototype.setDraw = function (t) {
    if (this.phase === 'power' || this.phase === 'flight') return;
    this.t = Math.max(0, Math.min(1, t));
    this.x = this.t * (this.span || 0);
    this.phase = this.t >= 0.999 ? 'holding' : 'drawing';
  };
  Sim.prototype.release = function () {
    if (this.phase !== 'holding' && this.phase !== 'drawing') return;
    if (this.t < 0.02) return;
    this.x = this.t * this.span;              // nock travel at the moment of the loose
    this.phase = 'power';
    this.vx = 0;
    this.emit('release');
  };

  // interpolate the mechanics table by nock travel x
  Sim.prototype.solveAt = function (x) {
    var r = this.rows, n = r.length;
    x = Math.max(0, Math.min(x, r[n - 1].x));
    var lo = 0, hi = n - 1;
    while (hi - lo > 1) { var m = (lo + hi) >> 1; if (r[m].x <= x) lo = m; else hi = m; }
    var f = (x - r[lo].x) / ((r[hi].x - r[lo].x) || 1);
    var A = r[lo], B = r[hi];
    function L(k) { return A[k] + (B[k] - A[k]) * f; }
    return {
      t: L('t'), x: x, F: L('F'), theta: L('rho'), delta: L('delta'), arm: L('arm'),
      Tcab: L('Tcab'), Tstr: L('Tstr'), uz: L('uz'), zNock: L('zN'), L: L('L'),
      u: L('u'),
      axle: { y: A.ax.y + (B.ax.y - A.ax.y) * f, z: A.ax.z + (B.ax.z - A.ax.z) * f },
      axleB: { y: -(A.ax.y + (B.ax.y - A.ax.y) * f), z: A.ax.z + (B.ax.z - A.ax.z) * f },
      tp: { p: { y: A.tp.p.y + (B.tp.p.y - A.tp.p.y) * f, z: A.tp.p.z + (B.tp.p.z - A.tp.p.z) * f } }
    };
  };
  Sim.prototype.stateAtFrac = function (t) { return this.bp.stateAtT(t); };

  Sim.prototype.update = function (dt) {
    if (!this.bp) return;
    var span = this.span;
    if (this.phase === 'drawing') {
      this.t = Math.min(1, this.t + dt * this.drawRate * (1.15 - 0.3 * this.t));
      this.x = this.t * span;
      if (this.t >= 1) { this.t = 1; this.x = span; this.phase = 'holding'; this.emit('hold'); }
    } else if (this.phase === 'holding') {
      this.x = this.t * span;
    } else if (this.phase === 'power') {
      /* Integrate the arrow's actual equation of motion through the power
         stroke: a = F(x)/m_eff, dx = v dt.  v starts at zero at full draw, so
         this is driven from the force curve rather than from dx = v dt.
         Energy in must equal KE out (checked in tools/check-physics.js). */
      var st = this.solveAt(this.x);
      var mEff = (this.bp.params.arrowMass + this.bp.params.virtualMass) * U.GRAIN2KG;
      var a = st.F * U.LB2N / mEff;
      this.vx += a * dt * this.slowmo;
      this.x -= this.vx * dt * this.slowmo / 0.0254;
      this.t = Math.max(0, this.x / span);
      var v = this.vx;
      if (this.x <= 0) {
        this.x = 0;
        this.phase = 'flight';
        this.arrow.flying = true;
        this.arrow.z = this.bp.params.brace;                // arrow nock at the brace line
        this.arrow.y = 0;
        this.arrow.vz = -v; this.arrow.vy = 0;
        this.arrow.v = v; this.arrow.dist = 0;
        this.vibe.amp = 0.42; this.vibe.phase = 0;
        this.emit('shot', { fps: v * U.MPS2FPS, ke: 0.5 * (this.bp.params.arrowMass * U.GRAIN2KG) * v * v, mps: v });
      }
      if (this.vibe.amp > 0) {
        this.vibe.phase += dt * 140;
        this.vibe.amp *= Math.exp(-dt * 9);
        this.vibe.y = Math.sin(this.vibe.phase) * this.vibe.amp * 0.06;
      }
    } else if (this.phase === 'flight') {
      var a = this.arrow;
      // gravity + light drag, in slow motion so it is watchable
      var k = 0.012, g = 9.81;
      var sp = Math.hypot(a.vz, a.vy);
      var drag = k * sp;
      a.vz += (-drag * a.vz / (sp || 1)) * dt * this.flightSlow * 1000 * 0.001;
      a.vy -= g * dt * this.flightSlow;
      a.z += a.vz * dt * this.flightSlow / 0.0254;           // m -> in (z decreasing)
      a.y += a.vy * dt * this.flightSlow / 0.0254;
      a.dist = -a.z * 0.0254;
      if (this.vibe.amp > 0) {
        this.vibe.phase += dt * 140;
        this.vibe.amp *= Math.exp(-dt * 7);
        this.vibe.y = Math.sin(this.vibe.phase) * this.vibe.amp * 0.06;
      }
      this.resetTimer += dt;
      if (this.resetTimer > this.autoReset) { this.reset(); this.emit('reset'); }
    }
    this.time += dt;
  };

  Sim.prototype.viewState = function () {
    var bp = this.bp;
    if (this.phase === 'power') {
      var st = this.solveAt(this.x);
      st.F = st.F; return st;
    }
    if (this.phase === 'flight') {
      var st2 = bp.stateAtT(0);
      return st2;
    }
    return bp.stateAtT(this.t);
  };

  root.BowSim = Sim;
})(window);
