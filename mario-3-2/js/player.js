/* =========================================================================
   MARIO 3-2 — player.js  (owner: PLAYER)

   M32.Player — Mario's swim/run physics, power states, damage & death, pipe
   entry, and his chunky primitive-built model.

   ------------------------------------------------------------------ API --
     new M32.Player(scene, level, level3d)
     reset(x, y)            respawn at a checkpoint (keeps power state)
     update(dt)             fixed-step: input -> physics -> collision -> anim
     idleUpdate(dt)         title-screen idle animation (no input, no physics)
     damage(source)         lose a power state; small Mario dies
     die()                  start the death animation, emits 'death' when done
     setPower('small'|'big'|'frog')   (also accepts 'star' -> invincibility)
     setInvincible(seconds) / giveStar()
     celebrate()            end-of-level celebration pose
     onEvent(name, payload) push through M32.Game.emit
     box()                  collision box {x,y,w,h} (feet-anchored)
     play(name) / burst(x,y,opts)   defensive audio/particle helpers

   public read fields: x, y, vx, vy, w, h, onGround, facing, inWater, power,
   invincible, starTime, dead, mesh, state, strokeMeter, waterTop.

   ---------------------------------------------------------------- events --
   emitted through M32.Game.emit(name, payload):
     'damage'  {x,y,power,src}       (main.js plays the hurt sfx/shake)
     'death'   {x,y,cause}           emitted AFTER the sink/spin animation
     'surface' {x,y,enter?,leap?}    broke / entered the water surface
     'swim'    {x,y,strength}        fresh stroke (HUD/audio cue)
     'block'   {block}               head-butted a block (main may ignore)
     'pipe-enter' {pipe,index,room,x,y}   -> main.js teleports
   'stomp'/'score' are entities.js territory; 'coin' too.

   Everything is defensive: if M32.Game.level3d is not wired yet, update()
   returns silently so script load order can never crash the boot.

   --------------------------------------------------------------- feel -----
   The feel constants live in M32.C where they already exist; the extras that
   only player.js needs are gathered in M32.PFEEL (see below) so the Lead can
   tune the swim without touching this file. All numbers are named.
   ========================================================================= */
(function () {
  'use strict';
  window.M32 = window.M32 || {};
  const M = window.M32;
  const C = M.C || {};
  const num = (v, d) => (typeof v === 'number' && isFinite(v) ? v : d);

  /* ------------------------------------------------------------------------
     FEEL CONSTANTS
     primary values are mirrored from M32.C (core.js) when present; the rest
     are the swim/land tuning knobs. M32.C.PLAYER = {...} can override any of
     them at load time; M32.PFEEL stays live-readable for debugging.
     ---------------------------------------------------------------------- */
  const PFEEL = {
    /* body box (SPEC §2) */
    PW: num(C.PW, 26),
    PH_SMALL: num(C.PH_SMALL, 30),
    PH_BIG: num(C.PH_BIG, 46),

    /* ---- water ---- */
    // weak pull down; with SWIM_DRAG_V this gives a slow natural sink (~175px/s)
    SWIM_GRAVITY: num(C.SWIM_GRAVITY, 420),
    // holding up: gentle continuous lift (equilibrium ~ (thrust-g)/drag ≈180px/s)
    SWIM_THRUST: 900,
    // holding down: a real dive, capped by SWIM_MAX_DOWN
    SWIM_DIVE: 950,
    SWIM_MAX_UP: num(C.SWIM_MAX_UP, 420), // cap for a single stroke burst
    SWIM_MAX_DOWN: num(C.SWIM_MAX_DOWN, 210), // dive terminal velocity
    SINK_MAX: 300, // nothing sinks faster than this when idle
    SWIM_ACCEL_H: num(C.SWIM_ACCEL_H, 900), // horizontal acceleration in water
    SWIM_DRAG_H: num(C.SWIM_DRAG, 3.2), // vx *= exp(-drag*dt) -> top ~281
    SWIM_DRAG_V: 2.4, // vertical water thickness (slightly less than H)
    STROKE_VY: num(C.STROKE_VY, 430), // fresh stroke impulse (up)
    STROKE_MAX: 500, // hard cap right after a stroke burst
    STROKE_FWD: 55, // little forward push per stroke
    STROKE_COOLDOWN: 0.08, // ignore key-repeat double edges
    STROKE_METER_GAIN: 0.34, // strokeMeter += per stroke
    STROKE_METER_DECAY: 0.42, // strokeMeter -= per second
    FROG_SPEED_MUL: 1.25, // frog suit horizontal speed
    FROG_STROKE_MUL: 1.3, // frog suit stroke strength
    SURFACE_BAND: 14, // |body centre - waterTop| <= this => can leap out
    SURFACE_LEAP: num(C.SURFACE_LEAP, 760), // breach velocity
    SURFACE_COOLDOWN: 0.32,
    BUBBLE_INTERVAL: 0.11, // frog bubble trail spacing

    /* ---- surface / land ---- */
    GRAVITY: num(C.GRAVITY, 2350),
    GRAVITY_HOLD: num(C.GRAVITY_HOLD, 2350 * 0.55), // variable jump height
    MAX_FALL: num(C.MAX_FALL, 1150),
    RUN_MAX: num(C.RUN_MAX, 260),
    SPRINT_MAX: num(C.SPRINT_MAX, 360),
    SWIM_RUN_BONUS: 1.0, // dash key does not speed up swimming (SMB3-ish)
    ACCEL_GROUND: num(C.ACCEL_GROUND, 1900),
    ACCEL_AIR: num(C.ACCEL_AIR, 1300),
    FRICTION: num(C.FRICTION, 1500),
    JUMP_VY: num(C.JUMP_VY, 820),
    JUMP_CUT: 0.55, // release jump early -> cut the remaining rise
    COYOTE_TIME: 0.08,
    JUMP_BUFFER: 0.1,
    CEIL_BUMP: 90, // downward bump after a head hit
    HEAD_HIT_COOLDOWN: 0.12,
    AIR_DUST: 0.24, // airborne this long before landing kicks up dust

    /* ---- damage / death ---- */
    INVULN_TIME: num(C.INVULN_TIME, 1.6),
    DEATH_TIME: 1.4, // sink/spin animation before 'death' is emitted
    HURT_KNOCK: 240, // horizontal knockback
    HURT_POP: 220, // upward pop on land
    STAR_TIME: num(C.STAR_TIME, 10),

    /* ---- misc ---- */
    PIPE_COOLDOWN: 0.7,
    SCALE_SMALL: 0.85,
    SCALE_BIG: 1.14,
    SCALE_FROG: 1.16,
  };
  if (C.PLAYER && typeof C.PLAYER === 'object') {
    for (const k in C.PLAYER) if (k in PFEEL) PFEEL[k] = C.PLAYER[k];
  }
  M.PFEEL = PFEEL;

  /* ------------------------------------------------------------ geometry */
  // unit primitives shared by every body part (scaled per-mesh) — keeps the
  // geometry count tiny and the whole Mario ~36 draw calls.
  const GEO = {};
  function unitBox() {
    return GEO.box || (GEO.box = new THREE.BoxGeometry(1, 1, 1));
  }
  function unitSphere() {
    return GEO.sph || (GEO.sph = new THREE.SphereGeometry(0.5, 10, 8));
  }

  /* ===================================================================== */
  M.Player = class Player {
    constructor(scene, level, level3d) {
      this.scene = scene || null;
      this.level = level || M.LEVEL || {};
      this.level3d = level3d || null;

      /* ---- body / physics state (public) ---- */
      this.w = PFEEL.PW;
      this.h = PFEEL.PH_SMALL;
      this.x = 120;
      this.y = 120;
      this.vx = 0;
      this.vy = 0;
      this.onGround = false;
      this.facing = 1;
      this.inWater = false;
      this.waterTop = null;
      this.power = 'small';
      this.invincible = false;
      this.starTime = 0;
      this.dead = false;
      this.state = 'idle';
      this.strokeMeter = 0; // 0..1 swim stroke momentum, read by the HUD
      this.strokeMeterMax = 1; // HUD normalises against this
      this.celebrating = false;
      this.animT = 0;

      /* ---- internal timers / flags ---- */
      this.invulnTimer = 0;
      this.strokeCd = 0;
      this.surfaceCd = 0;
      this.headCd = 0;
      this.bubbleCd = 0;
      this.pipeCd = 0;
      this.leapT = 0;
      this.coyote = 0;
      this.jumpBuffer = 0;
      this.jumping = false;
      this.airTime = 0;
      this.deathT = 0;
      this.deathCause = 'hazard';
      this.deathEmitted = false;
      this._starLit = false;

      /* ---- visuals ---- */
      this.mats = []; // [{mat, base}] every material owned by the model
      this.spawn = this._spawnPoint();
      this.buildMesh();
      this.setPower('small');
      this.reset(this.spawn.x, this.spawn.y);
    }

    /* ------------------------------------------------------------ helpers */
    _spawnPoint() {
      const L = this.level || {};
      const sp = L.start || L.spawn || L.playerStart;
      if (sp && isFinite(sp.x)) return { x: sp.x, y: isFinite(sp.y) ? sp.y : 120 };
      const cps = L.checkpoints;
      if (cps && cps.length && isFinite(cps[0].x)) {
        return { x: cps[0].x, y: isFinite(cps[0].y) ? cps[0].y : 120 };
      }
      return { x: 120, y: 120 };
    }

    /** collision world, preferring the live Game wiring over the ctor arg. */
    _l3d() {
      const G = M.Game;
      const l = (G && G.level3d) || this.level3d;
      if (l && typeof l === 'object') return l;
      return null;
    }

    _input() {
      return M.Input || null;
    }

    /** feet-anchored collision box (x = centre, y = feet). */
    box() {
      return { x: this.x - this.w * 0.5, y: this.y, w: this.w, h: this.h };
    }

    /** play a sound only for cues main.js does not already own. */
    play(name, opts) {
      const A = M.Game && M.Game.audio;
      if (A && typeof A.play === 'function') {
        try {
          A.play(name, opts);
        } catch (e) {
          /* audio is optional */
        }
      }
    }

    /** particles.burst is called with plain numbers, matching main.js/goal.js. */
    burst(x, y, opts) {
      const P = M.Game && M.Game.particles;
      if (P && typeof P.burst === 'function') {
        try {
          P.burst(x, y, opts || {});
        } catch (e) {
          /* particles are optional */
        }
      }
    }

    onEvent(name, payload) {
      const G = M.Game;
      if (G && typeof G.emit === 'function') G.emit(name, payload || {});
    }

    /* ==================================================================== *
     *  MODEL — a chunky SMB3 Mario out of scaled primitives.
     *  Authored ~40px tall at scale 1; big Mario hugs ~46px, small ~34px.
     * ==================================================================== */
    buildMesh() {
      this.mesh = new THREE.Group();
      this.mesh.name = 'player';
      this.mesh.position.set(this.x, this.y, 0);

      this.pivot = new THREE.Group(); // tilt / bob / death spin
      this.mesh.add(this.pivot);

      if (this.scene) this.scene.add(this.mesh);
      this.buildModel();
    }

    /* material factory that remembers each material's "true" colour so the
       Starman hue-cycle and damage flash can be undone cleanly. */
    _mkMat(color, opts) {
      opts = opts || {};
      let m;
      if (opts.basic) {
        m = new THREE.MeshBasicMaterial({ color });
      } else {
        m = new THREE.MeshLambertMaterial({ color });
      }
      this.mats.push({ mat: m, base: color });
      return m;
    }

    _setBase(mat, color) {
      for (let i = 0; i < this.mats.length; i++) {
        if (this.mats[i].mat === mat) {
          this.mats[i].base = color;
          mat.color.setHex(color);
          return;
        }
      }
      mat.color.setHex(color);
    }

    buildModel() {
      const P = M.PAL || {};
      const mk = (c, o) => this._mkMat(c, o);
      this.mSkin = mk(0xf7c48a);
      this.mShirt = mk(P.mario || 0xe23a2e);
      this.mOveralls = mk(P.marioBlue || 0x2f5ed6);
      this.mCap = mk(P.mario || 0xe23a2e);
      this.mShoe = mk(0x6b3a1a);
      this.mGlove = mk(0xfff4e0);
      this.mHair = mk(P.black || 0x101418, { basic: true });
      this.mEyeW = mk(0xffffff, { basic: true });
      this.mEyeB = mk(0x101418, { basic: true });
      this.mButton = mk(P.gold || 0xffcf3d, { basic: true });
      this.mFrogSkin = mk(P.frog || 0x39c449);
      this.mFrogDark = mk(P.frogDark || 0x1f8a2f);
      this.mFrogBelly = mk(0xd7f5a8);

      const box = (parent, w, h, d, mat, x, y, z) => {
        const m = new THREE.Mesh(unitBox(), mat);
        m.scale.set(w, h, d);
        m.position.set(x, y, z || 0);
        parent.add(m);
        return m;
      };
      const sph = (parent, r, mat, x, y, z, sx, sy, sz) => {
        const m = new THREE.Mesh(unitSphere(), mat);
        m.scale.set(r * 2 * (sx == null ? 1 : sx), r * 2 * (sy == null ? 1 : sy), r * 2 * (sz == null ? 1 : sz));
        m.position.set(x, y, z || 0);
        parent.add(m);
        return m;
      };

      /* ---------- legs: groups pivot at the hips so they can swing ------- */
      this.legL = new THREE.Group();
      this.legL.position.set(-5, 15, 0);
      this.pivot.add(this.legL);
      this.legR = new THREE.Group();
      this.legR.position.set(5, 15, 0);
      this.pivot.add(this.legR);

      box(this.legL, 6, 10, 6, this.mOveralls, 0, -5, 0);
      box(this.legR, 6, 10, 6, this.mOveralls, 0, -5, 0);
      // boots (front-heavy chunky shoes, +x is forward)
      box(this.legL, 9, 4, 8.5, this.mShoe, 1.2, -11.2, 0);
      box(this.legR, 9, 4, 8.5, this.mShoe, 1.2, -11.2, 0);

      /* ------------------------------ torso ------------------------------ */
      box(this.pivot, 17, 13, 12, this.mOveralls, 0, 20, 0); // 13.5..26.5
      box(this.pivot, 18, 5, 12.5, this.mShirt, 0, 25, 0); // shoulders
      box(this.pivot, 10, 8.5, 1.2, this.mOveralls, 0, 20.2, 6.1); // bib
      box(this.pivot, 1.6, 7, 1.2, this.mOveralls, -4.6, 23.8, 6.2); // straps
      box(this.pivot, 1.6, 7, 1.2, this.mOveralls, 4.6, 23.8, 6.2);
      sph(this.pivot, 1.35, this.mButton, -4.6, 22.4, 6.6);
      sph(this.pivot, 1.35, this.mButton, 4.6, 22.4, 6.6);

      /* ------------------------------- head ------------------------------ */
      sph(this.pivot, 6.7, this.mSkin, 0.4, 32.2, 0, 1.0, 0.98, 0.94);
      sph(this.pivot, 2.4, this.mSkin, -5.4, 31.4, 0); // ear
      sph(this.pivot, 2.7, this.mSkin, 6.4, 31.0, 0); // nose
      box(this.pivot, 6.2, 2.5, 5.6, this.mHair, 4.6, 29.1, 0); // moustache
      sph(this.pivot, 2.0, this.mEyeW, 3.5, 34.3, 2.9, 1, 1.25, 1);
      sph(this.pivot, 0.95, this.mEyeB, 4.35, 34.3, 3.8);
      box(this.pivot, 4.6, 1.2, 1.7, this.mHair, 3.9, 36.2, 2.7); // eyebrow

      // cap: crown + forward brim + white emblem
      box(this.pivot, 14, 3.4, 13, this.mCap, 0.4, 38.2, 0);
      box(this.pivot, 9.5, 1.8, 10.5, this.mCap, 7.6, 37.1, 0);
      sph(this.pivot, 2.3, this.mEyeW, 4.4, 38.4, 6.5);

      /* ------------------------------- arms ------------------------------ */
      this.armL = new THREE.Group();
      this.armL.position.set(-9.6, 25.8, 0);
      this.pivot.add(this.armL);
      this.armR = new THREE.Group();
      this.armR.position.set(9.6, 25.8, 0);
      this.pivot.add(this.armR);
      box(this.armL, 5.4, 11, 5.4, this.mShirt, 0, -5.0, 0);
      box(this.armR, 5.4, 11, 5.4, this.mShirt, 0, -5.0, 0);
      sph(this.armL, 3.2, this.mGlove, 0, -10.8, 0);
      sph(this.armR, 3.2, this.mGlove, 0, -10.8, 0);

      /* ---------------------- frog suit extras (hidden) ------------------ */
      this.frog = new THREE.Group();
      this.pivot.add(this.frog);
      this.frog.visible = false;
      // frog eyes on top of the cap
      sph(this.frog, 3.1, this.mEyeW, -3.3, 40.6, 0.6);
      sph(this.frog, 3.1, this.mEyeW, 3.3, 40.6, 0.6);
      sph(this.frog, 1.4, this.mEyeB, -3.3, 40.9, 3.2);
      sph(this.frog, 1.4, this.mEyeB, 3.3, 40.9, 3.2);
      // pale belly
      box(this.frog, 11.5, 8.5, 1.2, this.mFrogBelly, 0, 19.6, 6.3);
      // webbed flippers attached to the legs so they kick with them
      this.flipperL = box(this.legL, 13, 2.2, 10.5, this.mFrogSkin, 2, -11.6, 0);
      this.flipperR = box(this.legR, 13, 2.2, 10.5, this.mFrogSkin, 2, -11.6, 0);
      this.flipperL.visible = false;
      this.flipperR.visible = false;

      /* ---------------------- overall suit hints ------------------------- */
      // a soft rim so Mario reads against deep water
      this.mats.forEach((e) => {
        if (e.mat.emissive) e.mat.emissive.setHex(0x000000);
      });
    }

    /* ==================================================================== *
     *  POWER STATE
     * ==================================================================== */
    setPower(power) {
      if (power === 'star' || power === 'invincible') {
        // main.js routes the starman through 'powerup' -> setPower('star');
        // keep the body size unchanged and light up instead.
        this.setInvincible(PFEEL.STAR_TIME);
        return;
      }
      const p = power === 'frog' ? 'frog' : power === 'big' ? 'big' : 'small';
      this.power = p;
      this.h = p === 'small' ? PFEEL.PH_SMALL : PFEEL.PH_BIG;
      this.w = PFEEL.PW;
      this.scale = p === 'small' ? PFEEL.SCALE_SMALL : p === 'frog' ? PFEEL.SCALE_FROG : PFEEL.SCALE_BIG;

      // recolour the suit; frog suit turns everything green + shows its bits
      const P = M.PAL || {};
      const frog = p === 'frog';
      this._setBase(this.mShirt, frog ? P.frog || 0x39c449 : P.mario || 0xe23a2e);
      this._setBase(this.mOveralls, frog ? P.frogDark || 0x1f8a2f : P.marioBlue || 0x2f5ed6);
      this._setBase(this.mCap, frog ? P.frogDark || 0x1f8a2f : P.mario || 0xe23a2e);
      this._setBase(this.mShoe, frog ? P.frogDark || 0x1f8a2f : 0x6b3a1a);
      if (this.frog) this.frog.visible = frog;
      if (this.flipperL) this.flipperL.visible = frog;
      if (this.flipperR) this.flipperR.visible = frog;

      // growing lifts the head into the ceiling potentially — nudge down out
      // of any solid we now overlap (feet stay put when there is room).
      const l3d = this._l3d();
      if (l3d && typeof l3d.query === 'function') {
        try {
          const hits = l3d.query(this.box());
          if (hits && hits.length) {
            let lowest = Infinity;
            for (let i = 0; i < hits.length; i++) {
              const s = hits[i];
              if (s && isFinite(s.y)) lowest = Math.min(lowest, s.y);
            }
            if (isFinite(lowest)) this.y = Math.min(this.y, lowest - this.h);
          }
        } catch (e) {
          /* query is best-effort */
        }
      }
      if (M.Game) M.Game.power = p; // keep the hub field in sync for the HUD
      if (this.mesh) this.mesh.scale.setScalar(this.scale || 1);
    }

    setInvincible(seconds) {
      this.invincible = true;
      this.starTime = Math.max(0.1, typeof seconds === 'number' ? seconds : PFEEL.STAR_TIME);
    }

    giveStar() {
      this.setInvincible(PFEEL.STAR_TIME);
      this.onEvent('powerup', { power: 'star', star: true, x: this.x, y: this.y });
    }

    /* ==================================================================== *
     *  RESET / SPAWN
     * ==================================================================== */
    reset(x, y) {
      if (!isFinite(x)) x = this.spawn.x;
      if (!isFinite(y)) y = this.spawn.y;
      this.x = x;
      this.y = y;
      this.vx = 0;
      this.vy = 0;
      this.onGround = false;
      this.inWater = false;
      this.waterTop = null;
      this.dead = false;
      this.deathT = 0;
      this.deathEmitted = false;
      this.deathCause = 'hazard';
      this.invulnTimer = 0;
      this.invincible = false;
      this.starTime = 0;
      this.strokeMeter = 0;
      this.strokeCd = 0;
      this.surfaceCd = 0;
      this.headCd = 0;
      this.bubbleCd = 0;
      this.pipeCd = 0;
      this.leapT = 0;
      this.coyote = 0;
      this.jumpBuffer = 0;
      this.jumping = false;
      this.airTime = 0;
      this.celebrating = false;
      this.facing = 1;
      this.state = 'idle';
      this._starLit = false;
      this.restoreColors();
      if (this.pivot) {
        this.pivot.rotation.set(0, 0, 0);
        this.pivot.position.set(0, 0, 0);
        this.pivot.visible = true;
      }
      if (this.mesh) {
        this.mesh.visible = true;
        this.mesh.rotation.y = 0;
        this.mesh.scale.setScalar(this.scale || 1);
        this.mesh.position.set(this.x, this.y, 0);
      }
      this.pollWater();
    }

    /* ==================================================================== *
     *  UPDATE
     * ==================================================================== */
    update(dt) {
      // self-test / load-order guard: nothing to stand on yet.
      if (!this._l3d()) return;

      const F = PFEEL;
      const inp = this._input();
      dt = num(dt, C.FIXED_DT || 1 / 60);
      if (dt <= 0) return;
      if (dt > 0.05) dt = 0.05;

      if (this.dead) {
        this.updateDeath(dt);
        return;
      }
      if (this.celebrating) {
        this.updateCelebrate(dt);
        return;
      }

      this.tickTimers(dt);
      this.pollWater();

      if (this.inWater) this.updateWater(dt);
      else this.updateLand(dt);

      // post-move probes
      const wasWater = this.inWater;
      this.pollWater();
      if (wasWater && !this.inWater) {
        // breached the surface
        this.onEvent('surface', { x: this.x, y: this.y, leap: this.leapT > 0 });
      } else if (!wasWater && this.inWater) {
        // splashed back in
        this.burst(this.x, this.waterTop != null ? this.waterTop : this.y + this.h, {
          count: 10,
          color: 0xdff6ff,
          speed: 160,
          spread: 'up',
          life: 0.7,
          size: 4,
          sprite: 'bubble',
        });
        this.onEvent('surface', { x: this.x, y: this.y, enter: true });
      }

      this.checkPipes();
      this.animate(dt);
      this.syncMesh();

      if (this.y < -120) this.die();
    }

    /* --------------------------------------------------------- title idle */
    idleUpdate(dt) {
      if (this.dead) return;
      this.animT += dt;
      this.pollWater();
      // gentle float bob while the title card is up
      this.pivot.position.y = Math.sin(this.animT * 1.8) * 2.2;
      this.pivot.rotation.z = M.damp(this.pivot.rotation.z, 0.04 * Math.sin(this.animT * 1.3), 6, dt);
      this.legL.rotation.z = M.damp(this.legL.rotation.z, 0.18 * Math.sin(this.animT * 1.9), 8, dt);
      this.legR.rotation.z = M.damp(this.legR.rotation.z, -0.18 * Math.sin(this.animT * 1.9), 8, dt);
      this.armL.rotation.z = M.damp(this.armL.rotation.z, 0.35 + 0.16 * Math.sin(this.animT * 2.2), 8, dt);
      this.armR.rotation.z = M.damp(this.armR.rotation.z, 0.35 - 0.16 * Math.sin(this.animT * 2.2), 8, dt);
      this.syncMesh();
    }

    /* -------------------------------------------------------------- timers */
    tickTimers(dt) {
      const F = PFEEL;
      if (this.invulnTimer > 0) this.invulnTimer = Math.max(0, this.invulnTimer - dt);
      if (this.starTime > 0) {
        this.starTime -= dt;
        if (this.starTime <= 0) {
          this.starTime = 0;
          this.invincible = false;
        }
      }
      if (this.strokeMeter > 0) this.strokeMeter = Math.max(0, this.strokeMeter - F.STROKE_METER_DECAY * dt);
      if (this.strokeCd > 0) this.strokeCd -= dt;
      if (this.surfaceCd > 0) this.surfaceCd -= dt;
      if (this.headCd > 0) this.headCd -= dt;
      if (this.bubbleCd > 0) this.bubbleCd -= dt;
      if (this.pipeCd > 0) this.pipeCd -= dt;
      if (this.leapT > 0) this.leapT -= dt;
      if (this.jumpBuffer > 0) this.jumpBuffer -= dt;
      if (this.onGround) this.airTime = 0;
      else this.airTime += dt;
    }

    /* -------------------------------------------------------- water query */
    pollWater() {
      const F = PFEEL;
      const l3d = this._l3d();
      const cy = this.y + this.h * 0.5;
      let inWater = false;
      let top = null;

      if (l3d && typeof l3d.inWater === 'function') {
        try {
          inWater = !!l3d.inWater(this.x, cy);
        } catch (e) {
          inWater = false;
        }
        if (inWater && typeof l3d.waterTopAt === 'function') {
          try {
            top = l3d.waterTopAt(this.x);
          } catch (e) {
            top = null;
          }
        }
      } else {
        // fallback: derive from the raw level zones (module self-test)
        const zones = (this.level && this.level.zones) || [];
        for (let i = 0; i < zones.length; i++) {
          const z = zones[i];
          if (!z || !z.water) continue;
          const x0 = z.x || 0;
          const x1 = x0 + (z.w || 0);
          const y0 = z.yBottom != null ? z.yBottom : 0;
          const y1 = z.yTop != null ? z.yTop : C.WATER_TOP_Y || 900;
          if (this.x >= x0 && this.x <= x1 && cy >= y0 && cy <= y1) {
            inWater = true;
            if (top == null || y1 < top) top = y1;
          }
        }
      }

      // bonus rooms / dry interiors suppress water
      if (l3d && typeof l3d.roomAt === 'function') {
        try {
          const room = l3d.roomAt(this.x, cy);
          if (room && room.water !== true) {
            inWater = false;
            top = null;
          }
        } catch (e) {
          /* ignore */
        }
      }

      this.inWater = inWater;
      this.waterTop = inWater ? top : null;
    }

    /* ==================================================================== *
     *  WATER MOVEMENT — SMB3 swim: drag, not friction; strokes stack momentum
     * ==================================================================== */
    updateWater(dt) {
      const F = PFEEL;
      const inp = this._input() || {};
      const frog = this.power === 'frog';
      const ax = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);

      /* ---------------- horizontal: accelerate, then water drag --------- */
      const maxH = F.RUN_MAX * (frog ? F.FROG_SPEED_MUL : 1) * (inp.run ? 1.06 : 1);
      if (ax !== 0) {
        this.vx += ax * F.SWIM_ACCEL_H * (frog ? 1.15 : 1) * dt;
        this.facing = ax;
      }
      this.vx *= Math.exp(-F.SWIM_DRAG_H * dt);
      this.vx = M.clamp(this.vx, -maxH, maxH);

      this.onGround = false;
      this.jumping = false;
      this.coyote = 0;

      /* ---------------- fresh stroke: the satisfying bit ----------------- */
      const cy = this.y + this.h * 0.5;
      const atSurface =
        this.waterTop != null && Math.abs(cy - this.waterTop) <= F.SURFACE_BAND;

      if (inp.strokePressed && this.strokeCd <= 0) {
        this.strokeCd = F.STROKE_COOLDOWN;
        this.strokeMeter = Math.min(1, this.strokeMeter + F.STROKE_METER_GAIN);
        const meter = this.strokeMeter;

        if (atSurface && this.surfaceCd <= 0) {
          /* ---------- leap out of the water (SMB3 beach exit) ---------- */
          this.vy = F.SURFACE_LEAP;
          this.surfaceCd = F.SURFACE_COOLDOWN;
          this.leapT = 0.55;
          this.strokeMeter = Math.min(1, this.strokeMeter + 0.1);
          this.play('jump');
          this.burst(this.x, this.waterTop, {
            count: 16,
            color: 0xd8f6ff,
            speed: 240,
            spread: 'up',
            life: 0.7,
            size: 5,
            sprite: 'bubble',
          });
          // 'surface' is emitted by the transition check in update()
        } else {
          /* ---------- normal stroke: strong upward impulse ----------- */
          const power = (0.86 + 0.34 * meter) * (frog ? F.FROG_STROKE_MUL : 1);
          this.vy = Math.min(this.vy + F.STROKE_VY * power, F.STROKE_MAX);
          this.vx += (ax !== 0 ? ax : this.facing) * F.STROKE_FWD * (0.5 + 0.5 * meter) * (frog ? 1.15 : 1);
          this.burst(this.x - this.facing * 6, this.y + this.h * 0.45, {
            count: frog ? 7 : 5,
            color: frog ? 0x9be86a : 0xcdefff,
            speed: 110,
            spread: 'circle',
            life: 0.55,
            size: 4,
            sprite: 'bubble',
          });
          this.play('stroke');
          this.onEvent('swim', { x: this.x, y: this.y, strength: meter });
        }
      } else {
        /* ---------------- buoyancy + hold-up / hold-down thrust ------- */
        this.vy -= F.SWIM_GRAVITY * dt;
        if (inp.up) this.vy += F.SWIM_THRUST * dt;
        else if (inp.down) this.vy -= F.SWIM_DIVE * dt;

        this.vy *= Math.exp(-F.SWIM_DRAG_V * dt);

        if (inp.down) this.vy = Math.max(this.vy, -F.SWIM_MAX_DOWN);
        else if (!inp.up) this.vy = Math.max(this.vy, -F.SINK_MAX);
        this.vy = Math.min(this.vy, F.STROKE_MAX);
      }

      // frog suit leaves a green bubble trail
      if (frog && this.bubbleCd <= 0 && (Math.abs(this.vx) > 45 || Math.abs(this.vy) > 45)) {
        this.bubbleCd = F.BUBBLE_INTERVAL;
        this.burst(this.x - this.facing * 12, this.y + this.h * 0.35, {
          count: 2,
          color: 0x9be86a,
          speed: 38,
          spread: 'up',
          life: 1.0,
          size: 4,
          sprite: 'bubble',
        });
      }

      this.collide(dt);

      /* ---------------- surface tension: can't swim out without a leap -- */
      if (this.inWater && this.waterTop != null && this.leapT <= 0) {
        const lim = this.waterTop - 2;
        const c2 = this.y + this.h * 0.5;
        if (c2 > lim) {
          this.y = lim - this.h * 0.5;
          if (this.vy > 0) this.vy *= 0.12;
        }
      }
    }

    /* ==================================================================== *
     *  LAND MOVEMENT — beach / bonus room pipes (classic SMB3 running)
     * ==================================================================== */
    updateLand(dt) {
      const F = PFEEL;
      const inp = this._input() || {};
      const ax = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
      const maxH = inp.run ? F.SPRINT_MAX : F.RUN_MAX;

      const grounded = this.onGround;
      this.onGround = false;

      if (ax !== 0) {
        this.vx += ax * (grounded ? F.ACCEL_GROUND : F.ACCEL_AIR) * dt;
        this.facing = ax;
      } else if (grounded) {
        this.vx = M.approach(this.vx, 0, F.FRICTION * dt);
      }
      this.vx = M.clamp(this.vx, -maxH, maxH);

      if (grounded) this.coyote = F.COYOTE_TIME;

      // jump buffer eats an early press (feels responsive)
      if (inp.jumpPressed) this.jumpBuffer = F.JUMP_BUFFER;

      if (this.jumpBuffer > 0 && (grounded || this.coyote > 0)) {
        this.vy = F.JUMP_VY;
        this.onGround = false;
        this.jumping = true;
        this.coyote = 0;
        this.jumpBuffer = 0;
        this.play('jump');
        this.burst(this.x, this.y, {
          count: 5,
          color: 0xe8f8ff,
          speed: 70,
          life: 0.28,
          size: 3,
          sprite: 'dot',
        });
      }

      // variable jump height: release early cuts the rise
      if (this.jumping && this.vy > 0 && !inp.jump) {
        this.vy *= F.JUMP_CUT;
        this.jumping = false;
      }
      if (this.jumping && this.vy <= 0) this.jumping = false;

      const g = this.jumping && this.vy > 0 && inp.jump ? F.GRAVITY_HOLD : F.GRAVITY;
      this.vy -= g * dt;
      if (this.vy < -F.MAX_FALL) this.vy = -F.MAX_FALL;

      this.collide(dt);
      if (this.onGround) {
        this.coyote = F.COYOTE_TIME;
        this.airTime = 0;
      } else {
        this.coyote = Math.max(0, this.coyote - dt);
      }
    }

    /* ==================================================================== *
     *  COLLISION — axis separated through level3d, with safe fallbacks
     * ==================================================================== */
    _moveX(box, dx) {
      const l3d = this._l3d();
      if (l3d && typeof l3d.moveX === 'function') {
        try {
          return l3d.moveX(box, dx) || null;
        } catch (e) {
          /* fall through to un-collided move */
        }
      }
      box.x += dx;
      return null;
    }

    _moveY(box, dy) {
      const l3d = this._l3d();
      if (l3d && typeof l3d.moveY === 'function') {
        try {
          return l3d.moveY(box, dy) || null;
        } catch (e) {
          /* fall through */
        }
      }
      box.y += dy;
      return null;
    }

    collide(dt) {
      const F = PFEEL;

      /* ------------------------------- x ------------------------------- */
      let box = this.box();
      const dx = this.vx * dt;
      if (dx !== 0) {
        const hitX = this._moveX(box, dx);
        this.x = box.x + box.w * 0.5;
        if (hitX) {
          this.vx = 0;
          box = this.box();
        }
      }
      if (!isFinite(this.x)) this.x = this.spawn.x;

      /* ------------------------------- y ------------------------------- */
      box = this.box();
      const beforeVy = this.vy;
      const dy = beforeVy * dt;
      if (dy !== 0) {
        const hitY = this._moveY(box, dy);
        this.y = box.y;
        if (hitY) {
          if (beforeVy > 0) {
            /* ---- head hit: bump blocks, spawn their content ---- */
            if (this.headCd <= 0) this.headHit(box);
            else this.vy = Math.min(this.vy, 0);
          } else if (beforeVy < 0) {
            /* ---- landed on top of something ---- */
            this.vy = 0;
            this.onGround = true;
            if (this.airTime > F.AIR_DUST) {
              this.burst(this.x, this.y, {
                count: 8,
                color: 0xbfe6ef,
                speed: 90,
                life: 0.32,
                size: 3,
                sprite: 'dot',
              });
            }
          }
        }
      }
      if (!isFinite(this.y)) this.y = this.spawn.y;

      /* --------------------------- world bounds ------------------------ */
      const W = (this.level && this.level.width) || C.WORLD_W || 6400;
      const half = this.w * 0.5;
      if (this.x < half) {
        this.x = half;
        if (this.vx < 0) this.vx = 0;
      }
      if (this.x > W - half) {
        this.x = W - half;
        if (this.vx > 0) this.vx = 0;
      }

      if (this.y < -120) this.die();
    }

    /** head-butted a solid: bump the block + spawn contents + puff. */
    headHit(box) {
      const F = PFEEL;
      this.vy = -F.CEIL_BUMP; // small downward bump, SMB3-style
      this.headCd = F.HEAD_HIT_COOLDOWN;
      const l3d = this._l3d();
      if (!l3d || typeof l3d.hitFromBelow !== 'function') return;

      let hits = null;
      try {
        hits = l3d.hitFromBelow(box);
      } catch (e) {
        hits = null;
      }
      if (!hits || !hits.length) return;

      const ents = M.Game && M.Game.entities;
      for (let i = 0; i < hits.length; i++) {
        const h = hits[i];
        const blk = h && h.block ? h.block : h;
        if (ents && typeof ents.spawnFromBlock === 'function') {
          try {
            ents.spawnFromBlock(blk, h);
          } catch (e) {
            /* keep playing */
          }
        }
        const bx = blk && isFinite(blk.x) ? blk.x + (blk.w || 32) * 0.5 : this.x;
        const by = blk && isFinite(blk.y) ? blk.y + (blk.h || 32) : this.y + this.h;
        this.burst(bx, by, {
          count: 6,
          color: 0xffffff,
          speed: 130,
          life: 0.35,
          size: 3,
          sprite: 'dot',
        });
        this.onEvent('block', { block: blk });
      }
      this.play('block');
    }

    /* ==================================================================== *
     *  PIPES — down / into the mouth -> ask main.js to teleport
     * ==================================================================== */
    _pipeList() {
      const l3d = this._l3d();
      const out = [];
      const push = (arr) => {
        if (!arr) return;
        for (let i = 0; i < arr.length; i++) if (arr[i]) out.push(arr[i]);
      };
      if (l3d && l3d.pipes) push(l3d.pipes);
      else if (this.level && this.level.pipes) push(this.level.pipes);
      // bonus-room pipes (exit pipes) if the room carries its own list
      const rooms = (this.level && this.level.bonusRooms) || [];
      for (let i = 0; i < rooms.length; i++) {
        const r = rooms[i];
        if (r && r.pipes) push(r.pipes);
      }
      return out;
    }

    checkPipes() {
      if (this.pipeCd > 0) return;
      const inp = this._input() || {};
      if (!inp.down) return;

      const pipes = this._pipeList();
      if (!pipes.length) return;
      const box = this.box();
      const cy = this.y + this.h * 0.5;

      for (let i = 0; i < pipes.length; i++) {
        const p = pipes[i];
        if (!p || !isFinite(p.x)) continue;
        const pw = isFinite(p.w) ? p.w : 64;
        const ph = isFinite(p.h) ? p.h : 64;
        const x0 = p.x;
        const x1 = p.x + pw;
        const top = p.y + ph;
        // only pipes that lead somewhere are enterable
        const enterable = !!(p.target || p.enter || p.roomEntry || p.exit || p.door);
        if (!enterable) continue;
        if (this.x < x0 - 6 || this.x > x1 + 6) continue;

        let mouth;
        if (p.enterBox && isFinite(p.enterBox.x)) {
          mouth = p.enterBox;
        } else {
          const mh = 34;
          mouth = { x: x0 + 2, y: top - mh, w: Math.max(8, pw - 4), h: mh + 14 };
        }
        const standingOnTop = Math.abs(this.y - top) <= 14;
        if (!(standingOnTop || M.aabb(box, mouth))) continue;

        this.pipeCd = PFEEL.PIPE_COOLDOWN;
        const l3d = this._l3d();
        let room = null;
        if (l3d && typeof l3d.roomAt === 'function') {
          try {
            room = l3d.roomAt(this.x, cy);
          } catch (e) {
            room = null;
          }
        }
        this.onEvent('pipe-enter', { pipe: p, index: i, room, x: this.x, y: this.y });
        return;
      }
    }

    /* ==================================================================== *
     *  DAMAGE / DEATH
     * ==================================================================== */
    damage(src) {
      if (this.dead || this.celebrating) return false;
      if (this.invincible) return false; // Starman shrugs it off
      if (this.invulnTimer > 0) return false;

      if (this.power === 'small') {
        this.die();
        return true;
      }

      // big / frog -> small, one free hit
      this.setPower('small');
      this.invulnTimer = PFEEL.INVULN_TIME;

      const srcX = src && isFinite(src.x) ? src.x : null;
      const dir = srcX == null ? -this.facing : this.x < srcX ? -1 : 1;
      this.vx = dir * PFEEL.HURT_KNOCK;
      if (this.inWater) {
        this.vy = Math.min(this.vy, 0) - 60;
        this.burst(this.x, this.y + this.h * 0.6, {
          count: 10,
          color: 0xffb3a3,
          speed: 150,
          life: 0.5,
          size: 4,
          sprite: 'dot',
        });
      } else {
        this.vy = Math.max(this.vy, PFEEL.HURT_POP);
        this.onGround = false;
      }
      this.onEvent('damage', { x: this.x, y: this.y, power: this.power, src: src || null });
      return true;
    }

    die(cause) {
      if (this.dead) return;
      this.dead = true;
      this.state = 'dead';
      this.deathT = 0;
      this.deathEmitted = true; // emitted immediately — see comment below
      this.deathCause = cause || 'hazard';
      this.vx = 0;
      this.vy = this.inWater ? 240 : 520; // a last little pop upward
      this.invincible = false;
      this.starTime = 0;
      this.invulnTimer = 0;
      this.celebrating = false;
      this._starLit = false;
      if (this.pivot) this.pivot.visible = true;
      this.restoreColors();
      this.burst(this.x, this.y + this.h * 0.5, {
        count: 14,
        color: 0xffffff,
        speed: 220,
        life: 0.6,
        size: 4,
        sprite: 'dot',
      });
      // main.js owns the death state machine: it wants the event at the START
      // of the animation (music cut + sfx + 2.6 s timer), while the sink/spin
      // below keeps playing underneath. Emitting once here; updateDeath()
      // never emits again (deathEmitted stays true).
      this.onEvent('death', { x: this.x, y: this.y, cause: this.deathCause });
    }

    updateDeath(dt) {
      const F = PFEEL;
      this.deathT += dt;
      // sink slowly; spin for the first half, then just settle
      this.vx = M.damp(this.vx, 0, 3, dt);
      this.vy -= (this.inWater ? 260 : 1400) * dt;
      if (this.vy < -240) this.vy = -240;

      let box = this.box();
      if (Math.abs(this.vx) > 0.01) {
        this._moveX(box, this.vx * dt);
        this.x = box.x + box.w * 0.5;
      }
      box = this.box();
      const hit = this._moveY(box, this.vy * dt);
      this.y = box.y;
      if (hit) this.vy = 0;

      // spin & shrink into the depths
      const spin = Math.min(1, this.deathT / Math.max(0.2, F.DEATH_TIME * 0.75));
      this.pivot.rotation.z += (9 - spin * 5) * dt;
      this.pivot.position.y = 0;
      this.mesh.visible = true;
      this.mesh.position.set(this.x, this.y, 0);
      this.mesh.scale.setScalar((this.scale || 1) * (1 - 0.18 * spin));
      this.mesh.rotation.y = this.facing < 0 ? Math.PI : 0;

      if (!this.deathEmitted && this.deathT >= F.DEATH_TIME) {
        this.deathEmitted = true;
        this.onEvent('death', { x: this.x, y: this.y, cause: this.deathCause });
      }
    }

    /* --------------------------------------------------------- celebration */
    celebrate() {
      if (this.dead) return;
      this.celebrating = true;
      this.state = 'celebrate';
      this.vx = 0;
      this.vy = 0;
      this.strokeMeter = 0;
      this.celebrateT = 0;
    }

    updateCelebrate(dt) {
      this.celebrateT = (this.celebrateT || 0) + dt;
      this.animT += dt;
      const hop = Math.max(0, Math.sin(this.celebrateT * 5.5));
      this.pivot.position.y = hop * 9;
      this.pivot.rotation.z = Math.sin(this.celebrateT * 3.2) * 0.12;
      this.armL.rotation.z = 2.4 + Math.sin(this.celebrateT * 9) * 0.35;
      this.armR.rotation.z = 2.4 + Math.sin(this.celebrateT * 9 + 1.6) * 0.35;
      this.legL.rotation.z = hop * 0.5;
      this.legR.rotation.z = -hop * 0.5;
      this.mesh.rotation.y = this.facing < 0 ? Math.PI : 0;
      this.mesh.scale.setScalar(this.scale || 1);
      this.mesh.position.set(this.x, this.y, 0);
    }

    /* ==================================================================== *
     *  ANIMATION + VISUAL SYNC
     * ==================================================================== */
    restoreColors() {
      for (let i = 0; i < this.mats.length; i++) {
        const e = this.mats[i];
        if (e.mat.color) e.mat.color.setHex(e.base);
        if (e.mat.emissive) e.mat.emissive.setHex(0x000000);
      }
    }

    animate(dt) {
      const F = PFEEL;
      const sp = Math.abs(this.vx);
      this.animT += dt * (1 + Math.min(1.3, sp / 320));
      const t = this.animT;

      let legL = 0;
      let legR = 0;
      let armL = 0;
      let armR = 0;
      let lean = 0;
      let bob = 0;

      if (this.inWater) {
        this.state = this.vy > 70 ? 'swim-up' : this.vy < -70 ? 'swim-down' : 'swim';
        const speed = 7 + Math.min(7, sp * 0.02);
        const kick = Math.sin(t * speed);
        legL = 0.55 * kick;
        legR = -0.55 * kick;
        // arms paddle forward in the swim direction
        armL = 1.3 + Math.sin(t * 5.4) * 0.4;
        armR = 1.3 + Math.sin(t * 5.4 + Math.PI) * 0.4;
        lean = M.clamp((this.vx * this.facing) / 800, -0.3, 0.3);
        bob = Math.sin(t * 2.4) * 1.6;
        if (this.power === 'frog') {
          legL *= 1.55;
          legR *= 1.55;
          armL += 0.25;
          armR += 0.25;
        }
      } else if (this.onGround) {
        if (sp > 16) {
          this.state = 'run';
          const phase = t * (6 + sp * 0.045);
          legL = Math.sin(phase) * 0.85;
          legR = -Math.sin(phase) * 0.85;
          armL = -Math.sin(phase) * 0.6;
          armR = Math.sin(phase) * 0.6;
          lean = Math.min(0.24, sp / 900);
          bob = Math.abs(Math.sin(phase)) * 1.5;
        } else {
          this.state = 'idle';
          armL = 0.14 * Math.sin(t * 2.1);
          armR = -0.14 * Math.sin(t * 2.1);
          bob = Math.sin(t * 2.0) * 0.6;
        }
      } else if (this.vy > 0) {
        this.state = 'jump';
        legL = 0.85;
        legR = -0.45;
        armL = 2.0;
        armR = 2.0;
        lean = M.clamp((this.vx * this.facing) / 900, -0.2, 0.2);
      } else {
        this.state = 'fall';
        legL = -0.28;
        legR = 0.34;
        armL = 1.05;
        armR = 1.05;
        lean = M.clamp((this.vx * this.facing) / 900, -0.16, 0.16);
      }

      const lam = this.inWater ? 12 : 18;
      this.legL.rotation.z = M.damp(this.legL.rotation.z, legL, lam, dt);
      this.legR.rotation.z = M.damp(this.legR.rotation.z, legR, lam, dt);
      this.armL.rotation.z = M.damp(this.armL.rotation.z, armL, lam, dt);
      this.armR.rotation.z = M.damp(this.armR.rotation.z, armR, lam, dt);

      // body tilt: lean into horizontal motion, tip slightly with vertical
      const pitch = M.clamp(this.vy / 700, -1, 1);
      const tilt = -lean + (this.inWater ? pitch * 0.10 : 0);
      this.pivot.rotation.z = M.damp(this.pivot.rotation.z, tilt, 10, dt);
      this.pivot.position.y = bob;

      // hit flash / invulnerability blink
      const blink = this.invulnTimer > 0 && Math.floor(this.invulnTimer * 16) % 2 === 1;
      this.pivot.visible = !blink;

      this.updateStarVisuals();

      // emissive hurt pulse on the Lambert materials
      if (!this.invincible && this.invulnTimer > 0) {
        const f = 0.30 + 0.32 * Math.abs(Math.sin(this.invulnTimer * 26));
        for (let i = 0; i < this.mats.length; i++) {
          const m = this.mats[i].mat;
          if (m.emissive) m.emissive.setRGB(f, 0.02, 0.02);
        }
      } else if (!this.invincible) {
        for (let i = 0; i < this.mats.length; i++) {
          const m = this.mats[i].mat;
          if (m.emissive) m.emissive.setHex(0x000000);
        }
      }
    }

    /** Starman: hue-cycle every material (also covers DEBUG.giveInvincible). */
    updateStarVisuals() {
      const active = this.invincible && this.starTime > 0;
      if (active) {
        const h = (this.animT * 2.1) % 1;
        for (let i = 0; i < this.mats.length; i++) {
          const m = this.mats[i].mat;
          if (!m.color) continue;
          m.color.setHSL((h + i * 0.045) % 1, 0.92, 0.62);
        }
        this._starLit = true;
      } else if (this._starLit) {
        this._starLit = false;
        this.restoreColors();
      }
    }

    syncMesh() {
      if (!this.mesh) return;
      this.mesh.position.set(this.x, this.y, 0);
      this.mesh.rotation.y = this.facing < 0 ? Math.PI : 0;
      this.mesh.scale.setScalar(this.scale || 1);
    }
  };
})();
