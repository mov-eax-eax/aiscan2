/* =========================================================================
   MARIO 3-2 — entities.js  (owner: PLAYER)

   M32.Entities — every enemy and item in World 3-2:
     blooper, cheep (green/red), jelectro, bossbass, spike, piranha, frog,
     coin, coinArc, frogsuit, oneup, starman  (+ ? block spawning).

   ------------------------------------------------------------------ API --
     new M32.Entities(scene, level, level3d)
     reset()                    clear + respawn everything from M32.LEVEL
     clear()                    remove every live entity
     spawn(type, opts)          -> entity | null (capped at ~140 live)
     spawnFromBlock(block,hit)  ? block pops its content above the block
     update(dt, player)         behaviour + player contact resolution
     contact(player)            centralised AABB player-vs-entity pass
     freeze()                   stop updating (end-of-level sequence)
     blockBump(block)           dust puff helper for head-butts
     fields: all[] (live), coins[] (live coins), groups, spawnedCount

   Each entity is {type, kind, x, y, w, h, vx, vy, alive, mesh,
   update(dt,player), onPlayerContact(player), box()}. x,y = CENTRE for all
   entities (level data convention); piranha anchors to its pipe lip.

   ---------------------------------------------------------------- events --
   emitted through M32.Game.emit(name, payload) (main.js owns the SFX/score):
     'coin'    {x,y,points,value}                 +1 coin (main updates HUD)
     'score'   {points,x,y,type}                  enemy points
     'stomp'   {type,points,x,y,how}              killed an enemy
     'boss-hit'{hits,max,final?,x,y}              boss bass took a hit
     'powerup' {power:'frog'|'star',x,y}          main applies setPower
     'oneup'   {x,y}                              +1 life (main)
   Hazards call player.damage(entity), which emits 'damage' itself.

   Visuals: cheap primitives only (shared unit geometries, per-colour Lambert
   materials), deterministic phases from the spawn position, ~55 live entities
   typical, capped at 140. Entities >1500px from the player are paused.
   ========================================================================= */
(function () {
  'use strict';
  window.M32 = window.M32 || {};
  const M = window.M32;
  const C = M.C || {};
  const PAL = M.PAL || {};
  const num = (v, d) => (typeof v === 'number' && isFinite(v) ? v : d);

  /* ------------------------------------------------------------------------
     TUNING — M32.C.ENTITIES = {...} can override any of these at load.
     ---------------------------------------------------------------------- */
  const E = {
    CAP: 140, // hard cap on live entity records (SPEC §9)
    CULL_X: 1500, // entities farther than this from the player are paused
    DEATH_ANIM: 0.38, // squash/poof time after a kill

    /* coin streaming (the level holds ~140 coin markers in total) */
    COIN_SPAWN_X: 1450,
    COIN_SPAWN_Y: 640,
    COIN_DESPAWN_X: 2050,
    COIN_DESPAWN_Y: 900,
    COIN_PICK_R: 30, // circle pickup radius around the player centre

    /* blooper: sink / jet / hover pulse */
    BLOOPER_PERIOD: 2.9,
    BLOOPER_JET_VY: 300,
    BLOOPER_SINK_VY: -60,

    /* cheeps */
    CHEEP_SPEED: 108,
    CHEEP_SINE_RX: 140,
    CHEEP_SINE_RY: 48,

    /* jelectro */
    JELECTRO_BOB: 26,

    /* boss bass */
    BOSS_SPEED: 74,
    BOSS_LUNGE_SPEED: 355,
    BOSS_LUNGE_RANGE: 320,
    BOSS_LUNGE_VY: 130,
    BOSS_HITS: 3,

    /* hazards */
    SPIKE_SPEED: 32,
    SPIKE_PATROL: 140,
    PIRANHA_RANGE: 70, // plant retracts when the player is closer than this
    PIRANHA_SPEED: 1.7, // extension per second

    /* frog enemy (surface physics on its ledge) */
    FROG_GRAVITY: 1350,
    FROG_HOP_VY: 400,
    FROG_HOP_VX: 86,
    FROG_PATROL: 120,

    /* stomping */
    STOMP_VY: 700, // player bounce after a stomp
    STOMP_MIN_FALL: 30, // player must be moving down faster than this

    /* score values (main.js adds them through the 'score'/'coin' events) */
    SCORE: {
      cheep: 100,
      blooper: 200,
      frog: 100,
      jelectro: 200,
      spike: 200,
      piranha: 200,
      bossbass: 300,
    },
    BOSS_BONUS: 2000,
  };
  if (C.ENTITIES && typeof C.ENTITIES === 'object') {
    for (const k in C.ENTITIES) if (k in E) E[k] = C.ENTITIES[k];
  }
  M.EFEEL = E;

  /* ------------------------------------------------------------- helpers */
  function emit(name, payload) {
    const G = M.Game;
    if (G && typeof G.emit === 'function') G.emit(name, payload || {});
  }
  function burst(x, y, opts) {
    const P = M.Game && M.Game.particles;
    if (P && typeof P.burst === 'function') {
      try {
        P.burst(x, y, opts || {});
      } catch (e) {
        /* particles are optional */
      }
    }
  }

  /* shared unit geometries — every entity is built by scaling these */
  const GEO = {};
  function uBox() {
    return GEO.box || (GEO.box = new THREE.BoxGeometry(1, 1, 1));
  }
  function uSphere() {
    return GEO.sph || (GEO.sph = new THREE.SphereGeometry(0.5, 10, 8));
  }
  function uCone() {
    return GEO.cone || (GEO.cone = new THREE.ConeGeometry(0.5, 1, 7));
  }
  function uCyl() {
    return GEO.cyl || (GEO.cyl = new THREE.CylinderGeometry(0.5, 0.5, 1, 12));
  }
  let STAR_GEO = null;
  function starGeo() {
    if (STAR_GEO) return STAR_GEO;
    const shape = new THREE.Shape();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const r = i % 2 === 0 ? 1 : 0.45;
      const px = Math.cos(a) * r;
      const py = Math.sin(a) * r;
      if (i === 0) shape.moveTo(px, py);
      else shape.lineTo(px, py);
    }
    shape.closePath();
    STAR_GEO = new THREE.ExtrudeGeometry(shape, { depth: 0.5, bevelEnabled: false, curveSegments: 1 });
    return STAR_GEO;
  }

  /* shared material cache for the static colours */
  const MATS = {};
  function mat(color, opts) {
    opts = opts || {};
    const key =
      color +
      '|' +
      (opts.emissive || 0) +
      '|' +
      (opts.basic ? 1 : 0) +
      '|' +
      (opts.opacity == null ? 1 : opts.opacity) +
      '|' +
      (opts.side || 0);
    let m = MATS[key];
    if (m) return m;
    const params = { color };
    if (opts.emissive) params.emissive = opts.emissive;
    if (opts.opacity != null && opts.opacity < 1) {
      params.transparent = true;
      params.opacity = opts.opacity;
    }
    if (opts.side) params.side = opts.side;
    if (opts.basic) m = new THREE.MeshBasicMaterial(params);
    else m = new THREE.MeshLambertMaterial(params);
    MATS[key] = m;
    return m;
  }

  /* mesh part builders: parent is any Object3D, positions are LOCAL */
  function addBox(parent, w, h, d, material, x, y, z) {
    const m = new THREE.Mesh(uBox(), material);
    m.scale.set(w, h, d);
    m.position.set(x, y, z || 0);
    parent.add(m);
    return m;
  }
  function addSphere(parent, rx, ry, rz, material, x, y, z) {
    const m = new THREE.Mesh(uSphere(), material);
    m.scale.set(rx * 2, ry * 2, rz * 2);
    m.position.set(x, y, z || 0);
    parent.add(m);
    return m;
  }
  function addCone(parent, r, h, material, x, y, z, rz, ry) {
    const m = new THREE.Mesh(uCone(), material);
    m.scale.set(r * 2, h, r * 2);
    m.position.set(x, y, z || 0);
    if (rz) m.rotation.z = rz;
    if (ry) m.rotation.y = ry;
    parent.add(m);
    return m;
  }
  function addCyl(parent, r, h, material, x, y, z, rx, rz) {
    const m = new THREE.Mesh(uCyl(), material);
    m.scale.set(r * 2, h, r * 2);
    m.position.set(x, y, z || 0);
    if (rx) m.rotation.x = rx;
    if (rz) m.rotation.z = rz;
    parent.add(m);
    return m;
  }

  /** first water zone containing the point (raw level data) */
  function waterZoneAt(level, x, y) {
    const zs = (level && level.zones) || [];
    for (let i = 0; i < zs.length; i++) {
      const z = zs[i];
      if (!z || !z.water) continue;
      const x1 = num(z.x, 0) + num(z.w, 0);
      const y0 = num(z.yBottom, 0);
      const y1 = num(z.yTop, (C.WATER_TOP_Y || 900));
      if (x >= num(z.x, 0) && x <= x1 && y >= y0 && y <= y1) return z;
    }
    return null;
  }

  /** highest solid top directly below (x, y) — used by the frog enemy. */
  function groundBelow(l3d, x, y) {
    if (l3d && typeof l3d.query === 'function') {
      const cands = l3d.query({ x: x - 3, y: y - 70, w: 6, h: 70 });
      let best = null;
      for (let i = 0; i < cands.length; i++) {
        const s = cands[i];
        if (!s || s.type === 'boundary') continue;
        const top = s.y + s.h;
        if (top <= y + 8 && (best === null || top > best)) best = top;
      }
      if (best != null) return best;
    }
    return y - 12;
  }

  /* ===================================================================== *
   *  ENTITY BASE
   * ===================================================================== */
  class Ent {
    constructor(owner, type, w, h) {
      this.o = owner;
      this.type = type;
      this.kind = 'enemy';
      this.w = w;
      this.h = h;
      this.x = 0;
      this.y = 0;
      this.vx = 0;
      this.vy = 0;
      this.alive = false;
      this.dying = false;
      this.deathT = 0;
      this.culled = false;
      this.t = 0;
      this.phase = 0;
      this.flash = 0;
      this.seed = null;
      this.poolKey = type;
      this.mesh = new THREE.Group();
      this.mesh.name = type;
      this.build();
    }

    /* subclasses override */
    build() {}
    update(dt, player) {}
    onPlayerContact(player) {
      if (player && player.damage) player.damage(this);
    }

    box() {
      return { x: this.x - this.w * 0.5, y: this.y - this.h * 0.5, w: this.w, h: this.h };
    }

    revive(opts) {
      opts = opts || {};
      this.x = num(opts.x, 0);
      this.y = num(opts.y, 0);
      this.vx = 0;
      this.vy = 0;
      this.t = 0;
      this.age = 0;
      this.alive = true;
      this.dying = false;
      this.deathT = 0;
      this.culled = false;
      this.flash = 0;
      this.seed = opts.seed || null;
      this.riseFrom = num(opts.rise, 0);
      this.riseT = this.riseFrom > 0 ? 0 : 1;
      this.riseOff = 0;
      this.spawnY = this.y;
      this.phase = (this.x * 0.013 + this.y * 0.007) % (Math.PI * 2);
      this.mesh.visible = true;
      this.mesh.scale.set(1, 1, 1);
      this.mesh.rotation.set(0, 0, 0);
      this.mesh.position.set(this.x, this.y, 0);
    }

    /** items spawned out of a block float up into place. */
    tickRise(dt) {
      if (this.riseT < 1) {
        this.riseT = Math.min(1, this.riseT + dt / 0.32);
        this.riseOff = -this.riseFrom * (1 - M.easeOutCubic(this.riseT));
      }
    }

    syncMesh() {
      this.mesh.position.set(this.x, this.y, 0);
    }

    updateDying(dt) {
      this.deathT += dt;
      const k = Math.min(1, this.deathT / E.DEATH_ANIM);
      this.mesh.scale.set(1 + 0.55 * k, Math.max(0.06, 1 - 0.94 * k), 1);
      this.mesh.position.set(this.x, this.y, 0);
      if (this.deathT >= E.DEATH_ANIM) this.o.despawn(this);
    }
  }

  /* ===================================================================== *
   *  ENEMIES
   * ===================================================================== */

  /* ------------------------------------------------------------- BLOOPER */
  class Blooper extends Ent {
    constructor(o) {
      super(o, 'blooper', 46, 58);
    }
    build() {
      const cream = new THREE.MeshLambertMaterial({ color: 0xf7f1e3, emissive: 0x1b2b34 });
      const creamDark = mat(0xdfd2bd);
      const black = mat(0x101418, { basic: true });
      this.bell = addSphere(this.mesh, 22, 17, 19, cream, 0, 9, 0);
      this.bellBase = { x: 44, y: 34, z: 38 };
      addSphere(this.mesh, 15, 5, 13, creamDark, 0, -2, 2);
      // little eyes on the bell
      addSphere(this.mesh, 2.6, 2.6, 2.6, black, -8, 14, 15);
      addSphere(this.mesh, 2.6, 2.6, 2.6, black, 8, 14, 15);
      // eight waving tentacles
      this.tents = [];
      for (let i = 0; i < 8; i++) {
        const g = new THREE.Group();
        g.position.set(-17.5 + i * 5, 0, i % 2 ? 4 : -4);
        addBox(g, 3.6, 25, 3.6, cream, 0, -12.5, 0);
        this.mesh.add(g);
        this.tents.push({ g: g, ph: i * 0.85 });
      }
      this.zone = null;
    }
    revive(opts) {
      super.revive(opts);
      const l3d = this.o._l3d();
      const z = waterZoneAt(this.o.level, this.x, this.y);
      this.zone = z
        ? { x0: num(z.x, 0), x1: num(z.x, 0) + num(z.w, 0), y0: num(z.yBottom, 0), y1: num(z.yTop, 900) }
        : null;
      this.baseVx = 0;
    }
    update(dt, player) {
      this.t += dt;
      const cyc = this.t % E.BLOOPER_PERIOD;
      let target;
      if (cyc < 1.55) target = E.BLOOPER_SINK_VY;
      else if (cyc < 2.15) target = E.BLOOPER_JET_VY;
      else target = -12;
      this.vy = M.damp(this.vy, target, 2.4, dt);
      let tvx = 0;
      if (player && cyc > 1.85 && cyc < 2.3) {
        tvx = M.clamp((player.x - this.x) * 0.9, -110, 110);
      }
      this.vx = M.damp(this.vx, tvx, 1.6, dt);
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      this.clampZone();
      // bell pulse + tentacle wave
      const jet = cyc > 1.85 && cyc < 2.35;
      const s = 1 + (jet ? 0.16 : 0.05) * Math.sin(this.t * 7);
      this.bell.scale.set(this.bellBase.x * s, this.bellBase.y * s, this.bellBase.z * s);
      for (let i = 0; i < this.tents.length; i++) {
        const tn = this.tents[i];
        tn.g.rotation.z = Math.sin(this.t * 4.2 + tn.ph) * 0.55;
        tn.g.rotation.x = Math.cos(this.t * 3.1 + tn.ph) * 0.25;
      }
    }
    clampZone() {
      const z = this.zone;
      if (!z) return;
      const hw = this.w * 0.5 + 6;
      if (this.x < z.x0 + hw) {
        this.x = z.x0 + hw;
        if (this.vx < 0) this.vx = 0;
      }
      if (this.x > z.x1 - hw) {
        this.x = z.x1 - hw;
        if (this.vx > 0) this.vx = 0;
      }
      const hh = this.h * 0.5 + 4;
      if (this.y < z.y0 + hh) {
        this.y = z.y0 + hh;
        if (this.vy < 0) this.vy = 0;
      }
      if (this.y > z.y1 - hh) {
        this.y = z.y1 - hh;
        if (this.vy > 0) this.vy = 0;
      }
    }
  }

  /* --------------------------------------------------------------- CHEEP */
  class Cheep extends Ent {
    constructor(o, variant) {
      super(o, 'cheep', 36, 26);
      this.variant = variant === 'red' ? 'red' : 'green';
      this.poolKey = 'cheep:' + this.variant;
    }
    build() {
      const red = this.variant === 'red';
      const c = red ? PAL.cheepRed || 0xe8452e : PAL.cheepGreen || 0x7ad14a;
      this.bodyMat = new THREE.MeshLambertMaterial({ color: c });
      this.body = addSphere(this.mesh, 15, 11, 10, this.bodyMat, 0, 0, 0);
      addSphere(this.mesh, 11, 7, 6, mat(0xfff0d0), 2, -4, 7);
      this.tail = addCone(this.mesh, 7, 13, this.bodyMat, -17, 1, 0, -Math.PI / 2);
      this.fin = addCone(this.mesh, 5, 11, this.bodyMat, -3, 11, 0);
      const white = mat(0xffffff, { basic: true });
      const black = mat(0x101418, { basic: true });
      addSphere(this.mesh, 4, 4, 4, white, 8, 4, 7);
      addSphere(this.mesh, 2, 2, 2, black, 9.6, 4, 10);
      addBox(this.mesh, 5, 2, 3, black, 13, -2, 7); // mouth
    }
    revive(opts) {
      super.revive(opts);
      this.dir = opts.dir === -1 ? -1 : 1;
      this.baseX = this.x;
      this.baseY = this.y;
      const z = waterZoneAt(this.o.level, this.x, this.y);
      this.zone = z
        ? { x0: num(z.x, 0), x1: num(z.x, 0) + num(z.w, 0), y0: num(z.yBottom, 0), y1: num(z.yTop, 900) }
        : null;
      this.mesh.rotation.y = this.dir < 0 ? Math.PI : 0;
    }
    update(dt, player) {
      this.t += dt;
      if (this.variant === 'red') {
        // sine-wave path around the spawn lane
        const w = this.t * 1.45 + this.phase;
        this.x = this.baseX + Math.sin(w) * E.CHEEP_SINE_RX;
        this.y = this.baseY + Math.sin(this.t * 2.6 + this.phase) * E.CHEEP_SINE_RY;
        this.vx = Math.cos(w) * E.CHEEP_SINE_RX * 1.45;
        this.dir = this.vx >= 0 ? 1 : -1;
      } else {
        // straight horizontal swim, bounce off zone walls / solids
        this.x += this.dir * E.CHEEP_SPEED * dt;
        this.y += Math.sin(this.t * 2.2 + this.phase) * 8 * dt;
        this.vx = this.dir * E.CHEEP_SPEED;
        const z = this.zone;
        if (z) {
          const hw = this.w * 0.5 + 6;
          if (this.x < z.x0 + hw) {
            this.x = z.x0 + hw;
            this.dir = 1;
          } else if (this.x > z.x1 - hw) {
            this.x = z.x1 - hw;
            this.dir = -1;
          }
        }
        // flip when swimming into a solid
        const l3d = this.o._l3d();
        if (l3d && typeof l3d.query === 'function') {
          const ahead = { x: this.x + this.dir * (this.w * 0.5 + 6) - 3, y: this.y - 4, w: 6, h: 8 };
          const cands = l3d.query(ahead);
          for (let i = 0; i < cands.length; i++) {
            if (cands[i].type !== 'boundary') {
              this.dir *= -1;
              break;
            }
          }
        }
        if (z) this.y = M.clamp(this.y, z.y0 + this.h * 0.5 + 4, z.y1 - this.h * 0.5 - 4);
      }
      this.mesh.rotation.y = this.dir < 0 ? Math.PI : 0;
      this.tail.rotation.y = Math.sin(this.t * 9 + this.phase) * 0.55;
      this.fin.rotation.z = Math.sin(this.t * 9 + this.phase + 1) * 0.2;
    }
  }

  /* ------------------------------------------------------------ JELECTRO */
  class Jelectro extends Ent {
    constructor(o) {
      super(o, 'jelectro', 44, 54);
    }
    build() {
      const dark = new THREE.MeshLambertMaterial({ color: PAL.jelectro || 0x3a2f8f, emissive: 0x140c3a });
      this.bell = addSphere(this.mesh, 20, 16, 17, dark, 0, 8, 0);
      this.bellBase = { x: 40, y: 32, z: 34 };
      const glow = mat(PAL.jelectric || 0x9f8cff, { basic: true });
      addSphere(this.mesh, 3.2, 3.2, 3.2, glow, -7, 15, 13);
      addSphere(this.mesh, 3.2, 3.2, 3.2, glow, 7, 15, 13);
      addSphere(this.mesh, 4.5, 4.5, 4.5, glow, 0, 4, 16);
      // tentacles
      this.tents = [];
      for (let i = 0; i < 6; i++) {
        const g = new THREE.Group();
        g.position.set(-14 + i * 5.6, 0, 0);
        addBox(g, 3, 26, 3, dark, 0, -13, 0);
        this.mesh.add(g);
        this.tents.push({ g: g, ph: i * 1.1 });
      }
      // flickering electric arcs between the tentacle tips
      this.arcs = [];
      for (let k = 0; k < 3; k++) {
        const geo = new THREE.BufferGeometry();
        const pos = new Float32Array(9);
        geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        const lm = new THREE.LineBasicMaterial({
          color: PAL.jelectric || 0x9f8cff,
          transparent: true,
          opacity: 0.8,
        });
        const line = new THREE.Line(geo, lm);
        line.frustumCulled = false;
        this.mesh.add(line);
        this.arcs.push({ line: line, attr: geo.getAttribute('position'), mat: lm, off: k });
      }
      this.zone = null;
    }
    revive(opts) {
      super.revive(opts);
      this.baseX = this.x;
      this.baseY = this.y;
      const z = waterZoneAt(this.o.level, this.x, this.y);
      this.zone = z
        ? { y0: num(z.yBottom, 0), y1: num(z.yTop, 900) }
        : null;
    }
    update(dt) {
      this.t += dt;
      const s = Math.sin(this.t * 1.15 + this.phase);
      this.y = this.baseY + s * E.JELECTRO_BOB;
      this.x = this.baseX + Math.sin(this.t * 0.7 + this.phase) * 14;
      if (this.zone) {
        this.y = M.clamp(this.y, this.zone.y0 + this.h * 0.5 + 4, this.zone.y1 - this.h * 0.5 - 4);
      }
      // bell squish + tentacle sway
      const pulse = 1 + Math.sin(this.t * 5.5) * 0.045;
      this.bell.scale.set(this.bellBase.x * pulse, this.bellBase.y / pulse, this.bellBase.z * pulse);
      for (let i = 0; i < this.tents.length; i++) {
        const tn = this.tents[i];
        tn.g.rotation.z = Math.sin(this.t * 3.4 + tn.ph) * 0.4;
      }
      // crackle
      for (let k = 0; k < this.arcs.length; k++) {
        const a = this.arcs[k];
        const on = Math.sin(this.t * (10 + k * 3.3) + k) > -0.15;
        a.line.visible = on;
        if (!on) continue;
        a.mat.opacity = 0.45 + 0.5 * Math.abs(Math.sin(this.t * (8 + k * 2.3) + k));
        const arr = a.attr.array;
        const ox = -12 + k * 12;
        const sy = -8;
        const ex = ox + Math.sin(this.t * 6.1 + k * 2.4) * 11;
        const ey = -34 + Math.sin(this.t * 4.2 + k) * 5;
        const mx = (ox + ex) * 0.5 + Math.sin(this.t * 9 + k) * 6;
        const my = (sy + ey) * 0.5 + Math.cos(this.t * 8 + k) * 5;
        arr[0] = ox; arr[1] = sy; arr[2] = 0;
        arr[3] = mx; arr[4] = my; arr[5] = 0;
        arr[6] = ex; arr[7] = ey; arr[8] = 0;
        a.attr.needsUpdate = true;
      }
    }
  }

  /* ------------------------------------------------------------ BOSSBASS */
  class BossBass extends Ent {
    constructor(o) {
      super(o, 'bossbass', 112, 80);
    }
    build() {
      this.bodyMat = new THREE.MeshLambertMaterial({ color: PAL.boss || 0x3c8f2f });
      this.bellyMat = new THREE.MeshLambertMaterial({ color: 0x9bd06a });
      this.finMat = new THREE.MeshLambertMaterial({ color: 0x2f7a25 });
      this.mats = [this.bodyMat, this.bellyMat, this.finMat];
      this.body = addSphere(this.mesh, 46, 33, 36, this.bodyMat, 0, 0, 0);
      addSphere(this.mesh, 32, 20, 27, this.bellyMat, 0, -11, 9);
      this.tail = addCone(this.mesh, 20, 30, this.finMat, -52, 0, 0, -Math.PI / 2);
      this.dorsal = addCone(this.mesh, 12, 22, this.finMat, -2, 33, 0);
      addCone(this.mesh, 9, 16, this.finMat, 12, -30, 0, Math.PI);
      const white = mat(0xffffff, { basic: true });
      const black = mat(0x101418, { basic: true });
      addSphere(this.mesh, 7.5, 7.5, 7.5, white, 22, 15, 22);
      addSphere(this.mesh, 3.6, 3.6, 3.6, black, 25, 15, 28);
      addSphere(this.mesh, 7.5, 7.5, 7.5, white, 4, 17, 26);
      addSphere(this.mesh, 3.6, 3.6, 3.6, black, 5, 17, 31);
      // mouth: dark throat, white teeth, animated lower jaw
      addSphere(this.mesh, 17, 12, 14, mat(0x4a1010), 38, -3, 6);
      const teeth = mat(0xfff6e8);
      for (let i = 0; i < 4; i++) addBox(this.mesh, 5, 5, 4, teeth, 28 + i * 6, 4, 18);
      this.jaw = new THREE.Group();
      this.jaw.position.set(30, -8, 2);
      this.mesh.add(this.jaw);
      addBox(this.jaw, 30, 7, 20, this.finMat, 6, 0, 0);
      for (let i = 0; i < 4; i++) addBox(this.jaw, 5, 4, 4, teeth, 2 + i * 7, 3, 8);
      this.zone = null;
    }
    revive(opts) {
      super.revive(opts);
      this.baseX = this.x;
      this.baseY = this.y;
      this.dir = -1;
      this.hits = 0;
      this.lungeT = 0;
      this.lungeCd = 1.2 + Math.abs(Math.sin(this.phase)) * 1.4;
      this.lungeVx = 0;
      this.lungeVy = 0;
      const z = waterZoneAt(this.o.level, this.x, this.y);
      this.zone = z
        ? { x0: num(z.x, 0), x1: num(z.x, 0) + num(z.w, 0), y0: num(z.yBottom, 0), y1: num(z.yTop, 900) }
        : null;
      this.mesh.rotation.y = 0;
      this.flash = 0;
      for (let i = 0; i < this.mats.length; i++) this.mats[i].emissive.setHex(0x000000);
    }
    update(dt, player) {
      this.t += dt;
      if (this.flash > 0) {
        this.flash -= dt;
        const f = Math.max(0, this.flash / 0.3);
        for (let i = 0; i < this.mats.length; i++) {
          this.mats[i].emissive.setRGB(0.75 * f, 0.4 * f, 0.1 * f);
        }
      }
      if (this.lungeT > 0) {
        this.lungeT -= dt;
        this.x += this.lungeVx * dt;
        this.y += this.lungeVy * dt;
        if (this.lungeVx !== 0) this.dir = this.lungeVx > 0 ? 1 : -1;
        this.jaw.rotation.z = M.damp(this.jaw.rotation.z, -0.75, 14, dt);
      } else {
        this.lungeCd -= dt;
        const p = player && !player.dead ? player : null;
        if (p && this.lungeCd <= 0) {
          const py = p.y + (p.h || 30) * 0.5;
          if (Math.abs(p.x - this.x) < E.BOSS_LUNGE_RANGE && Math.abs(py - this.y) < E.BOSS_LUNGE_VY + 20) {
            const dx = p.x - this.x;
            const dy = py - this.y;
            const d = Math.hypot(dx, dy) || 1;
            this.lungeVx = (dx / d) * E.BOSS_LUNGE_SPEED;
            this.lungeVy = (dy / d) * E.BOSS_LUNGE_SPEED * 0.45;
            this.lungeT = 0.5;
            this.lungeCd = 2.4;
            this.dir = dx >= 0 ? 1 : -1;
          }
        }
        this.x += this.dir * E.BOSS_SPEED * dt;
        this.y = this.baseY + Math.sin(this.t * 0.8 + this.phase) * 14;
        this.jaw.rotation.z = M.damp(
          this.jaw.rotation.z,
          -0.12 - 0.22 * (0.5 + 0.5 * Math.sin(this.t * 6)),
          8,
          dt
        );
      }
      this.clampZone();
      this.mesh.rotation.y = this.dir < 0 ? Math.PI : 0;
      this.tail.rotation.y = Math.sin(this.t * 3.4) * 0.22;
      this.dorsal.rotation.z = Math.sin(this.t * 2.6) * 0.1;
    }
    clampZone() {
      const z = this.zone;
      if (!z) return;
      const hw = this.w * 0.5 + 4;
      const lo = Math.max(z.x0 + hw, this.baseX - 360);
      const hi = Math.min(z.x1 - hw, this.baseX + 360);
      if (this.x < lo) {
        this.x = lo;
        if (this.lungeT > 0) this.lungeT = 0;
        this.dir = 1;
      } else if (this.x > hi) {
        this.x = hi;
        if (this.lungeT > 0) this.lungeT = 0;
        this.dir = -1;
      }
      const hh = this.h * 0.5 + 4;
      this.y = M.clamp(this.y, z.y0 + hh, z.y1 - hh);
    }
    /** frog-suit / starman hit. returns true when this was the killing blow. */
    bossHit(player) {
      this.hits++;
      this.flash = 0.3;
      this.lungeT = 0;
      this.lungeCd = 1.6;
      const away = player && player.x > this.x ? -1 : 1;
      this.x += away * 22;
      emit('boss-hit', { hits: this.hits, max: E.BOSS_HITS, x: this.x, y: this.y });
      if (this.hits >= E.BOSS_HITS) {
        this.o.killEntity(this, player, { points: E.BOSS_BONUS, how: 'boss' });
        return true;
      }
      emit('score', { points: E.SCORE.bossbass, x: this.x, y: this.y, type: 'bossbass' });
      return false;
    }
  }

  /* --------------------------------------------------------------- SPIKE */
  class Spike extends Ent {
    constructor(o) {
      super(o, 'spike', 42, 42);
    }
    build() {
      this.ballMat = new THREE.MeshLambertMaterial({ color: 0x3f8f3a, emissive: 0x0c240b });
      addSphere(this.mesh, 16, 16, 16, this.ballMat, 0, 0, 0);
      const spikeMat = mat(0xe8f2e0);
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        addCone(this.mesh, 4.5, 12, spikeMat, Math.cos(a) * 17, Math.sin(a) * 17, 0, a - Math.PI / 2);
      }
    }
    revive(opts) {
      super.revive(opts);
      this.dir = opts.dir === 1 ? 1 : -1;
      this.baseX = this.x;
      this.baseY = this.y;
    }
    update(dt) {
      this.t += dt;
      this.x += this.dir * E.SPIKE_SPEED * dt;
      if (this.x < this.baseX - E.SPIKE_PATROL) {
        this.x = this.baseX - E.SPIKE_PATROL;
        this.dir = 1;
      } else if (this.x > this.baseX + E.SPIKE_PATROL) {
        this.x = this.baseX + E.SPIKE_PATROL;
        this.dir = -1;
      }
      this.mesh.rotation.z += this.dir * (E.SPIKE_SPEED / 16) * dt;
      this.y = this.baseY + Math.sin(this.t * 2.2) * 5;
    }
  }

  /* ------------------------------------------------------------- PIRANHA */
  class Piranha extends Ent {
    constructor(o) {
      super(o, 'piranha', 36, 62);
    }
    build() {
      const stemMat = new THREE.MeshLambertMaterial({ color: 0x2f8f3e });
      const headMat = new THREE.MeshLambertMaterial({ color: 0xd8392b, emissive: 0x2a0603 });
      addBox(this.mesh, 7, 30, 7, stemMat, 0, 15, 0);
      addBox(this.mesh, 20, 4, 6, stemMat, -11, 9, 0).rotation.z = 0.42;
      addBox(this.mesh, 20, 4, 6, stemMat, 11, 17, 0).rotation.z = -0.42;
      this.head = new THREE.Group();
      this.head.position.set(0, 45, 0);
      this.mesh.add(this.head);
      addSphere(this.head, 16, 14, 14, headMat, 0, 0, 0);
      const white = mat(0xfff4e6);
      const black = mat(0x101418, { basic: true });
      addSphere(this.head, 3.6, 3.6, 3.6, white, -8, 6, 10);
      addSphere(this.head, 3.6, 3.6, 3.6, white, 8, 6, 10);
      addSphere(this.head, 1.7, 1.7, 1.7, black, -8, 6, 13);
      addSphere(this.head, 1.7, 1.7, 1.7, black, 8, 6, 13);
      // open mouth + teeth
      addBox(this.head, 19, 5, 10, white, 0, -7, 8);
      for (let i = 0; i < 4; i++) addBox(this.head, 3.6, 5, 3, white, -6 + i * 4, -2, 12);
      this.jaw = addBox(this.head, 18, 5, 9, headMat, 0, -11, 7);
      this.zone = null;
    }
    revive(opts) {
      super.revive(opts);
      this.l3d = this.o._l3d();
      // anchor: pipe lip (from the pipe itself when we can find it)
      let top = null;
      const px = opts.pipeX;
      const pipes = (this.l3d && this.l3d.pipes) || (this.o.level && this.o.level.pipes) || [];
      if (px != null) {
        for (let i = 0; i < pipes.length; i++) {
          const p = pipes[i];
          if (!p || !isFinite(p.x)) continue;
          if (Math.abs(p.x - px) < 8) {
            top = num(p.y, 0) + num(p.h, 64);
            break;
          }
        }
      }
      if (top == null) top = this.y; // authored y = pipe lip
      this.baseY = top;
      this.ext = 0;
      this.mesh.scale.set(1, 0.02, 1);
      this.mesh.visible = false;
    }
    box() {
      const ext = this.ext || 0;
      return { x: this.x - this.w * 0.5, y: this.baseY, w: this.w, h: this.h * ext };
    }
    update(dt, player) {
      this.t += dt;
      const dx = player ? Math.abs(player.x - this.x) : 9999;
      const target = dx > E.PIRANHA_RANGE ? 1 : 0;
      this.ext = M.approach(this.ext, target, E.PIRANHA_SPEED * dt);
      const ext = this.ext;
      this.mesh.scale.set(1, Math.max(0.02, ext), 1);
      this.mesh.visible = ext > 0.06;
      this.y = this.baseY;
      this.head.rotation.z = Math.sin(this.t * 4) * 0.08;
      this.jaw.rotation.z = Math.sin(this.t * 7) * 0.18;
    }
  }

  /* ---------------------------------------------------------- FROG ENEMY */
  class FrogEnemy extends Ent {
    constructor(o) {
      super(o, 'frog', 32, 28);
    }
    build() {
      const bodyMat = new THREE.MeshLambertMaterial({ color: 0x4fc24a });
      this.body = addSphere(this.mesh, 13, 10, 11, bodyMat, 0, 0, 0);
      addSphere(this.mesh, 9, 5, 7, mat(0xd7f5a8), 0, -5, 5);
      const white = mat(0xffffff, { basic: true });
      const black = mat(0x101418, { basic: true });
      addSphere(this.mesh, 4.6, 4.6, 4.6, white, -6, 9, 3);
      addSphere(this.mesh, 4.6, 4.6, 4.6, white, 6, 9, 3);
      addSphere(this.mesh, 2, 2, 2, black, -6, 9, 7);
      addSphere(this.mesh, 2, 2, 2, black, 6, 9, 7);
      addBox(this.mesh, 9, 1.5, 3, black, 0, -2, 10);
      this.legL = addBox(this.mesh, 7, 10, 8, bodyMat, -10, -10, 0);
      this.legR = addBox(this.mesh, 7, 10, 8, bodyMat, 10, -10, 0);
    }
    revive(opts) {
      super.revive(opts);
      this.dir = opts.dir === -1 ? -1 : 1;
      this.baseX = this.x;
      const l3d = this.o._l3d();
      this.ground = groundBelow(l3d, this.x, this.y);
      this.y = this.ground;
      this.onGround = true;
      this.hopCd = 0.25 + Math.abs(Math.sin(this.phase)) * 0.5;
      this.mesh.rotation.y = this.dir < 0 ? Math.PI : 0;
    }
    update(dt) {
      this.t += dt;
      if (!this.onGround) {
        this.vy -= E.FROG_GRAVITY * dt;
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        if (this.y <= this.ground) {
          this.y = this.ground;
          this.vy = 0;
          this.vx = 0;
          this.onGround = true;
          this.hopCd = 0.45;
        }
      } else {
        this.hopCd -= dt;
        if (this.hopCd <= 0) {
          this.hopCd = 0.75;
          this.vy = E.FROG_HOP_VY;
          this.vx = this.dir * E.FROG_HOP_VX;
          this.onGround = false;
        }
      }
      if (this.x < this.baseX - E.FROG_PATROL) {
        this.x = this.baseX - E.FROG_PATROL;
        this.dir = 1;
      } else if (this.x > this.baseX + E.FROG_PATROL) {
        this.x = this.baseX + E.FROG_PATROL;
        this.dir = -1;
      }
      this.mesh.rotation.y = this.dir < 0 ? Math.PI : 0;
      const tuck = this.onGround ? 0 : 0.5;
      this.legL.rotation.z = tuck;
      this.legR.rotation.z = -tuck;
    }
  }

  /* ===================================================================== *
   *  ITEMS
   * ===================================================================== */
  class Item extends Ent {
    constructor(o, type, w, h) {
      super(o, type, w, h);
      this.kind = 'item';
    }
    update(dt) {
      this.t += dt;
      this.tickRise(dt);
    }
  }

  class Coin extends Item {
    constructor(o) {
      super(o, 'coin', 24, 24);
    }
    build() {
      this.spin = new THREE.Group();
      this.mesh.add(this.spin);
      const gold = new THREE.MeshLambertMaterial({ color: PAL.gold || 0xffcf3d, emissive: 0x4a3300 });
      this.disc = addCyl(this.spin, 10, 3, gold, 0, 0, 0, Math.PI / 2);
      const dark = mat(PAL.goldDark || 0xc08a12);
      addCyl(this.spin, 6, 3.6, dark, 0, 0, 0, Math.PI / 2);
      addBox(this.spin, 2.5, 11, 3.8, mat(0xfff2b0), 0, 0, 0);
    }
    update(dt) {
      super.update(dt);
      this.spin.rotation.y = this.t * 5.5 + this.phase;
      this.y = this.spawnY + (this.riseOff || 0) + Math.sin(this.t * 3 + this.phase) * 4.5;
    }
    pickup(player) {
      emit('coin', { x: this.x, y: this.y, points: C.COIN_SCORE || 200, value: 1 });
      burst(this.x, this.y, {
        count: 8,
        color: 0xffe066,
        speed: 160,
        size: 4,
        life: 0.5,
        sprite: 'star',
      });
      if (this.seed) {
        this.seed.collected = true;
        this.seed.live = null;
      }
      this.o.despawn(this);
    }
  }

  class FrogSuit extends Item {
    constructor(o) {
      super(o, 'frogsuit', 32, 46);
    }
    build() {
      const green = new THREE.MeshLambertMaterial({ color: PAL.frog || 0x39c449, emissive: 0x0d3412 });
      const dark = new THREE.MeshLambertMaterial({ color: PAL.frogDark || 0x1f8a2f });
      addBox(this.mesh, 18, 20, 11, green, 0, 0, 0);
      addBox(this.mesh, 7, 15, 7, green, -13, 2, 0);
      addBox(this.mesh, 7, 15, 7, green, 13, 2, 0);
      addBox(this.mesh, 7, 13, 8, dark, -5, -17, 0);
      addBox(this.mesh, 7, 13, 8, dark, 5, -17, 0);
      addBox(this.mesh, 13, 2.5, 10, green, -5, -23, 0);
      addBox(this.mesh, 13, 2.5, 10, green, 5, -23, 0);
      addBox(this.mesh, 11, 9, 1.4, mat(0xd7f5a8), 0, -1, 5.8);
      const white = mat(0xffffff, { basic: true });
      const black = mat(0x101418, { basic: true });
      addSphere(this.mesh, 4.4, 4.4, 4.4, white, -5, 13, 0);
      addSphere(this.mesh, 4.4, 4.4, 4.4, white, 5, 13, 0);
      addSphere(this.mesh, 2, 2, 2, black, -5, 13, 3.6);
      addSphere(this.mesh, 2, 2, 2, black, 5, 13, 3.6);
    }
    update(dt) {
      super.update(dt);
      this.y = this.spawnY + (this.riseOff || 0) + Math.sin(this.t * 2.3 + this.phase) * 5;
      this.mesh.rotation.z = Math.sin(this.t * 1.4 + this.phase) * 0.06;
    }
    pickup(player) {
      if (player && player.setPower) player.setPower('frog');
      emit('powerup', { power: 'frog', x: this.x, y: this.y });
      burst(this.x, this.y, {
        count: 16,
        color: 0x8cff6b,
        speed: 220,
        size: 6,
        life: 0.7,
        sprite: 'star',
      });
      this.o.despawn(this);
    }
  }

  class OneUp extends Item {
    constructor(o) {
      super(o, 'oneup', 30, 32);
    }
    build() {
      const green = new THREE.MeshLambertMaterial({ color: 0x3bd23b, emissive: 0x0c3a0c });
      addSphere(this.mesh, 15, 11, 15, green, 0, 6, 0);
      const white = mat(0xfff4e6);
      addSphere(this.mesh, 4, 4, 4, white, -7, 10, 10);
      addSphere(this.mesh, 4, 4, 4, white, 7, 10, 10);
      addSphere(this.mesh, 3.6, 3.6, 3.6, white, 0, 5, 14);
      addBox(this.mesh, 14, 12, 12, white, 0, -9, 0);
      const black = mat(0x101418, { basic: true });
      addBox(this.mesh, 3, 4, 2, black, -4, -8, 6.2);
      addBox(this.mesh, 3, 4, 2, black, 4, -8, 6.2);
    }
    update(dt) {
      super.update(dt);
      this.y = this.spawnY + (this.riseOff || 0) + Math.sin(this.t * 2.6 + this.phase) * 5;
    }
    pickup(player) {
      emit('oneup', { x: this.x, y: this.y });
      burst(this.x, this.y, {
        count: 14,
        color: 0x8cff6b,
        speed: 190,
        size: 6,
        life: 0.7,
        sprite: 'star',
      });
      this.o.despawn(this);
    }
  }

  class Starman extends Item {
    constructor(o) {
      super(o, 'starman', 36, 36);
    }
    build() {
      this.starMat = new THREE.MeshLambertMaterial({ color: PAL.gold || 0xffcf3d, emissive: 0x6a4a00 });
      const m = new THREE.Mesh(starGeo(), this.starMat);
      m.scale.set(15, 15, 10);
      m.position.z = -3;
      this.star = m;
      this.mesh.add(m);
      const black = mat(0x101418, { basic: true });
      addBox(this.mesh, 2.6, 5, 2, black, -4, 4, 3.2);
      addBox(this.mesh, 2.6, 5, 2, black, 4, 4, 3.2);
    }
    revive(opts) {
      super.revive(opts);
      this.baseY = this.y;
    }
    update(dt) {
      super.update(dt);
      this.t += 0;
      const bob = Math.abs(Math.sin(this.t * 3.1 + this.phase));
      this.y = this.spawnY + (this.riseOff || 0) + bob * 12;
      this.star.rotation.z = this.t * 2.6 + this.phase;
      const h = (this.t * 1.6 + this.phase) % 1;
      this.starMat.color.setHSL(h, 0.95, 0.62);
      if (this.starMat.emissive) this.starMat.emissive.setHSL(h, 0.9, 0.25);
    }
    pickup(player) {
      if (player && player.setInvincible) player.setInvincible(C.STAR_TIME || 10);
      emit('powerup', { power: 'star', star: true, x: this.x, y: this.y });
      burst(this.x, this.y, {
        count: 20,
        color: [0xffe14d, 0xffffff, 0xff9a3c],
        speed: 260,
        size: 7,
        life: 0.8,
        sprite: 'star',
      });
      this.o.despawn(this);
    }
  }

  /* ===================================================================== *
   *  ENTITIES MANAGER
   * ===================================================================== */
  M.Entities = class Entities {
    constructor(scene, level, level3d) {
      this.scene = scene || null;
      this.level = level || M.LEVEL || {};
      this.level3d = level3d || null;

      this.all = [];
      this.coins = [];
      this.groups = { enemies: [], items: [] };
      this.spawnedCount = 0;
      this.time = 0;
      this.frozen = false;

      this._pool = {};
      this._coinSeeds = [];
      this._hidden = [];

      this.reset();
    }

    /* ------------------------------------------------------------ helpers */
    _l3d() {
      const G = M.Game;
      const l = (G && G.level3d) || this.level3d;
      if (l && typeof l === 'object') return l;
      return null;
    }

    _liveCount() {
      return this.all.length;
    }

    _removeFrom(arr, e) {
      const i = arr.indexOf(e);
      if (i >= 0) arr.splice(i, 1);
    }

    _register(e) {
      this.all.push(e);
      if (e.kind === 'item') {
        this.groups.items.push(e);
        if (e.type === 'coin') this.coins.push(e);
      } else {
        this.groups.enemies.push(e);
      }
    }

    _unregister(e) {
      this._removeFrom(this.all, e);
      if (e.kind === 'item') {
        this._removeFrom(this.groups.items, e);
        this._removeFrom(this.coins, e);
      } else {
        this._removeFrom(this.groups.enemies, e);
      }
    }

    _factory(type, variant) {
      switch (type) {
        case 'blooper':
          return new Blooper(this);
        case 'cheep':
          return new Cheep(this, variant);
        case 'jelectro':
          return new Jelectro(this);
        case 'bossbass':
          return new BossBass(this);
        case 'spike':
          return new Spike(this);
        case 'piranha':
          return new Piranha(this);
        case 'frog':
          return new FrogEnemy(this);
        case 'coin':
          return new Coin(this);
        case 'frogsuit':
          return new FrogSuit(this);
        case 'oneup':
          return new OneUp(this);
        case 'starman':
          return new Starman(this);
        default:
          return null;
      }
    }

    /* --------------------------------------------------------------- spawn */
    /**
     * spawn(type, opts) — opts = {x, y, variant, pipeX, pipeY, dir, seed, rise}
     * x,y are CENTRE coordinates (level data convention). Returns entity or null.
     */
    spawn(type, opts) {
      opts = opts || {};
      if (this._liveCount() >= E.CAP) return null;
      const variant = type === 'cheep' && opts.variant === 'red' ? 'red' : type === 'cheep' ? 'green' : null;
      const key = variant ? type + ':' + variant : type;
      const pool = this._pool[key];
      let e = pool && pool.length ? pool.pop() : this._factory(type, variant);
      if (!e) return null;
      if (!e.mesh.parent && this.scene) this.scene.add(e.mesh);
      e.revive(opts);
      e.alive = true;
      e.dying = false;
      e.mesh.visible = true;
      this.spawnedCount++;
      this._register(e);
      e.syncMesh();
      return e;
    }

    /** remove + recycle an entity (never touches its level-data record). */
    despawn(e) {
      if (!e) return;
      if (e.seed) {
        if (e.seed.live === e) e.seed.live = null;
        e.seed = null;
      }
      e.alive = false;
      e.dying = false;
      e.culled = false;
      if (e.mesh) {
        if (e.mesh.parent) e.mesh.parent.remove(e.mesh);
        e.mesh.visible = false;
      }
      this._unregister(e);
      const pool = this._pool[e.poolKey] || (this._pool[e.poolKey] = []);
      if (pool.length < 24) pool.push(e);
    }

    /** a kill started by the player (stomp / frog suit / starman / boss) */
    killEntity(e, player, opts) {
      if (!e || !e.alive || e.dying) return;
      opts = opts || {};
      const pts = opts.points != null ? opts.points : E.SCORE[e.type] || 100;
      e.alive = false;
      e.dying = true;
      e.deathT = 0;
      e.flash = 0;
      if (e.mesh) {
        e.mesh.visible = true;
        e.mesh.scale.set(1, 1, 1); // normalise squashed/risen states before the poof
      }
      const color =
        e.type === 'blooper'
          ? 0xfff1e0
          : e.type === 'cheep'
            ? e.variant === 'red'
              ? 0xff7a5a
              : 0x9be86a
            : e.type === 'bossbass'
              ? 0xffcf3d
              : e.type === 'frog'
                ? 0x8cff6b
                : 0xcfe9ff;
      burst(e.x, e.y, {
        count: e.type === 'bossbass' ? 34 : 12,
        color: color,
        speed: e.type === 'bossbass' ? 340 : 180,
        size: e.type === 'bossbass' ? 8 : 5,
        life: 0.6,
        sprite: 'star',
      });
      emit('stomp', { type: e.type, points: pts, x: e.x, y: e.y, how: opts.how || 'stomp' });
      emit('score', { points: pts, x: e.x, y: e.y, type: e.type });
      if (e.type === 'bossbass') emit('boss-hit', { hits: 3, max: 3, final: true, x: e.x, y: e.y });
      const G = M.Game;
      if (G && G.camera && G.camera.shake && e.type === 'bossbass') G.camera.shake(10, 0.35);
      if (player) player.vy = Math.max(player.vy, E.STOMP_VY * 0.65);
    }

    /* --------------------------------------------------------------- items */
    _pickupCheck(e, player, pb) {
      if (!e.alive || e.dying) return false;
      if (e.type === 'coin') {
        const ph = player.h || 30;
        const dx = player.x - e.x;
        const dy = player.y + ph * 0.5 - e.y;
        if (dx * dx + dy * dy <= E.COIN_PICK_R * E.COIN_PICK_R) {
          e.pickup(player);
          return true;
        }
        return false;
      }
      const eb = e.box();
      if (M.aabb(pb, eb)) {
        e.pickup(player);
        return true;
      }
      return false;
    }

    /* ------------------------------------------------- player-vs-entity */
    contact(player) {
      if (!player || player.dead) return;
      const pw = player.w || 26;
      const ph = player.h || 30;
      const pb = { x: player.x - pw * 0.5, y: player.y, w: pw, h: ph };

      for (let i = this.all.length - 1; i >= 0; i--) {
        const e = this.all[i];
        if (!e || !e.alive || e.dying || e.culled) continue;
        if (e.kind === 'item') {
          this._pickupCheck(e, player, pb);
          continue;
        }
        if (e.type === 'piranha' && (e.ext || 0) < 0.2) continue;
        const eb = e.box();
        if (!M.aabb(pb, eb)) continue;
        this._resolveEnemy(e, player);
      }
    }

    _bounce(player) {
      if (!player) return;
      player.vy = E.STOMP_VY;
      player.onGround = false;
      player.jumping = false;
    }

    /** one place for every stomp / hazard rule. */
    _resolveEnemy(e, player) {
      const star = !!player.invincible;
      const frog = player.power === 'frog';
      const falling = player.vy < -E.STOMP_MIN_FALL;
      const feetAbove = player.y + 4 > e.y;
      const stomp = falling && feetAbove;

      if (star) {
        this.killEntity(e, player, { how: 'star' });
        this._bounce(player);
        return;
      }

      switch (e.type) {
        case 'bossbass': {
          if (frog) {
            e.bossHit(player);
            this._bounce(player);
            return;
          }
          if (stomp) {
            // a plain stomp just bounces off the boss, and hurts
            player.damage(e);
            this._bounce(player);
            return;
          }
          player.damage(e);
          return;
        }
        case 'jelectro': {
          if (frog) {
            const dx = player.x - e.x;
            const dy = player.y + (player.h || 30) * 0.5 - e.y;
            const core = e.w * 0.26;
            if (dx * dx + dy * dy <= core * core) {
              this.killEntity(e, player, { how: 'frog' });
              this._bounce(player);
              return;
            }
          }
          player.damage(e);
          return;
        }
        case 'spike':
        case 'piranha':
          player.damage(e);
          return;
        default: {
          // blooper / cheep / frog: frog suit kills on contact, otherwise stomp
          if (frog) {
            this.killEntity(e, player, { how: 'frog' });
            this._bounce(player);
            return;
          }
          if (stomp) {
            this.killEntity(e, player, { how: 'stomp' });
            this._bounce(player);
            return;
          }
          player.damage(e);
        }
      }
    }

    /* --------------------------------------------------------- ? blocks */
    /** pops the content of a bumped block. `hit` is level3d.hitFromBelow's. */
    spawnFromBlock(block, hit) {
      if (!block) return null;
      const b = block.block || block;
      let content = b.content || b.item || null;
      if (!content) content = b.type === 'itembox' ? 'coin' : 'coin';
      const bx = hit && isFinite(hit.x) ? hit.x : num(b.x, 0) + num(b.w, 32) * 0.5;
      const by = hit && isFinite(hit.y) ? hit.y : num(b.y, 0) + num(b.h, 32);
      this.blockBump(b, bx, by);
      if (content === 'coin' || content === 'coinArc') {
        const n = content === 'coinArc' ? Math.max(1, num(b.n, 3)) : 1;
        for (let i = 0; i < n; i++) {
          emit('coin', { x: bx + i * 18, y: by, points: C.COIN_SCORE || 200, value: 1 });
          burst(bx + i * 18, by + 6, {
            count: 6,
            color: 0xffe066,
            speed: 170,
            size: 4,
            life: 0.5,
            sprite: 'star',
          });
        }
        return null;
      }
      const e = this.spawn(content, { x: bx, y: by + 30, fromBlock: true, rise: 30 });
      if (e) {
        burst(bx, by + 10, { count: 10, color: 0xfff2b0, speed: 180, size: 5, life: 0.5, sprite: 'spark' });
      }
      return e;
    }

    /* --------------------------------------------------- reset / clear */
    /** small dust puff when a block is knocked from below (visual helper). */
    blockBump(block, x, y) {
      const cx = isFinite(x) ? x : num(block && block.x, 0) + num(block && block.w, 32) * 0.5;
      const cy = isFinite(y) ? y : num(block && block.y, 0) + num(block && block.h, 32);
      burst(cx, cy, { count: 6, color: 0xffffff, speed: 130, life: 0.3, size: 3, sprite: 'dot' });
      burst(cx, cy, { count: 4, color: 0xfff2b0, speed: 90, life: 0.4, size: 3, sprite: 'spark' });
    }

    reset() {
      this.clear();
      const enemies = (this.level && this.level.enemies) || [];
      for (let i = 0; i < enemies.length; i++) {
        const d = enemies[i];
        if (!d || !d.type) continue;
        this.spawn(d.type, d); // unknown types are ignored by spawn()
      }

      this._buildCoinSeeds();

      const items = (this.level && this.level.items) || [];
      this._hidden.length = 0;
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        if (!it || !it.type) continue;
        if (it.fromBlock) continue; // spawned when its ? block is hit
        if (it.type === 'coin' || it.type === 'coinArc') continue; // streamed seeds
        if (it.hidden || it.trigger) {
          this._hidden.push({ def: it, spawned: false });
          continue;
        }
        this.spawn(it.type, it);
      }
    }

    clear() {
      const copy = this.all.slice();
      for (let i = 0; i < copy.length; i++) this.despawn(copy[i]);
      this.all.length = 0;
      this.coins.length = 0;
      this.groups.enemies.length = 0;
      this.groups.items.length = 0;
      this._coinSeeds.length = 0;
      this._hidden.length = 0;
      this.spawnedCount = 0;
      this.time = 0;
      this.frozen = false;
    }

    freeze() {
      this.frozen = true;
    }

    /* ---------------------------------------------------- coin streaming */
    _buildCoinSeeds() {
      const seeds = this._coinSeeds;
      seeds.length = 0;
      const items = (this.level && this.level.items) || [];
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        if (!it) continue;
        if (it.type === 'coin') {
          seeds.push({ x: num(it.x, 0), y: num(it.y, 0), collected: false, live: null });
        } else if (it.type === 'coinArc') {
          const n = Math.max(1, Math.round(num(it.n, 5)));
          const span = 34;
          for (let k = 0; k < n; k++) {
            const tt = n > 1 ? k / (n - 1) - 0.5 : 0;
            seeds.push({
              x: num(it.x, 0) + tt * (n - 1) * span,
              y: num(it.y, 0) + (0.25 - tt * tt) * 60,
              collected: false,
              live: null,
            });
          }
        }
      }
    }

    _streamCoins(player) {
      if (!player) return;
      const pcx = player.x;
      const pcy = player.y + (player.h || 30) * 0.5;
      const seeds = this._coinSeeds;
      for (let i = 0; i < seeds.length; i++) {
        const s = seeds[i];
        if (s.collected) continue;
        const dx = s.x - pcx;
        const dy = s.y - pcy;
        const near = Math.abs(dx) < E.COIN_SPAWN_X && Math.abs(dy) < E.COIN_SPAWN_Y;
        if (!s.live) {
          if (near) s.live = this.spawn('coin', { x: s.x, y: s.y, seed: s });
        } else if (!s.live.alive) {
          s.live = null;
        } else if (Math.abs(dx) > E.COIN_DESPAWN_X || Math.abs(dy) > E.COIN_DESPAWN_Y) {
          this.despawn(s.live);
          s.live = null;
        }
      }
    }

    _updateHidden(player) {
      if (!player) return;
      for (let i = 0; i < this._hidden.length; i++) {
        const h = this._hidden[i];
        if (h.spawned) continue;
        const it = h.def;
        const tr = it.trigger;
        let near = false;
        if (tr) {
          const dx = player.x - num(tr.x, it.x);
          const dy = player.y - num(tr.y, it.y);
          near = dx * dx + dy * dy <= num(tr.r, 60) * num(tr.r, 60);
        } else {
          near = Math.abs(player.x - num(it.x, 0)) < 120;
        }
        if (near) {
          h.spawned = true;
          this.spawn(it.type, { x: it.x, y: it.y });
        }
      }
    }

    /* ----------------------------------------------------------- update */
    update(dt, player) {
      // Load-order / self-test guard: no collision world wired yet.
      if (!this._l3d()) return;
      if (this.frozen) return;

      dt = num(dt, C.FIXED_DT || 1 / 60);
      if (dt <= 0) return;
      if (dt > 0.05) dt = 0.05;
      this.time += dt;

      if (!player) player = (M.Game && M.Game.player) || null;
      if (player && player.dead) {
        // keep coins in place but let the world settle
        for (let i = this.all.length - 1; i >= 0; i--) {
          const e = this.all[i];
          if (e && !e.alive && e.dying) e.updateDying(dt);
        }
        return;
      }

      this._streamCoins(player);
      this._updateHidden(player);

      const px = player ? player.x : 0;
      for (let i = this.all.length - 1; i >= 0; i--) {
        const e = this.all[i];
        if (!e) continue;
        if (!e.alive) {
          if (e.dying) e.updateDying(dt);
          continue;
        }
        if (Math.abs(e.x - px) > E.CULL_X) {
          e.culled = true;
          continue;
        }
        e.culled = false;
        e.update(dt, player);
        e.syncMesh();
      }

      if (player) this.contact(player);
    }

    /* -------------------------------------------------------- debug bits */
    /** convenience for HUD / debug: live counts by type. */
    counts() {
      const out = {};
      for (let i = 0; i < this.all.length; i++) {
        const t = this.all[i].type;
        out[t] = (out[t] || 0) + 1;
      }
      return out;
    }
  };
})();
