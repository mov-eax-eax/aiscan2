/* =========================================================================
   MARIO 3-2 — core.js
   Namespace, constants, math + AABB helpers, deterministic RNG, input, and
   the fixed-timestep loop scaffolding. Owned by the Lead. Modules only read.
   ========================================================================= */
(function () {
  'use strict';
  window.M32 = window.M32 || {};
  const M = window.M32;

  /* ---------------------------------------------------------------- math */
  M.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  M.lerp = (a, b, t) => a + (b - a) * t;
  M.invLerp = (a, b, v) => (b === a ? 0 : (v - a) / (b - a));
  M.approach = (v, target, step) => {
    if (v < target) return Math.min(v + step, target);
    if (v > target) return Math.max(v - step, target);
    return v;
  };
  M.sign = (v) => (v > 0 ? 1 : v < 0 ? -1 : 0);
  M.smoothstep = (t) => {
    t = M.clamp(t, 0, 1);
    return t * t * (3 - 2 * t);
  };
  M.easeOutCubic = (t) => 1 - Math.pow(1 - M.clamp(t, 0, 1), 3);
  M.easeInOutSine = (t) => -(Math.cos(Math.PI * M.clamp(t, 0, 1)) - 1) / 2;
  M.damp = (a, b, lambda, dt) => M.lerp(a, b, 1 - Math.exp(-lambda * dt));

  /** axis-aligned box {x,y,w,h} with x,y = bottom-left. */
  M.box = (x, y, w, h) => ({ x, y, w, h });
  /** does point lie in box */
  M.pointIn = (px, py, b) => px >= b.x && px <= b.x + b.w && py >= b.y && py <= b.y + b.h;
  /** AABB overlap: a,b = {x,y,w,h} bottom-left anchored */
  M.aabb = (a, b) =>
    a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  /** overlap of two boxes as {x,y,w,h} or null */
  M.intersect = (a, b) => {
    const x = Math.max(a.x, b.x);
    const y = Math.max(a.y, b.y);
    const r = Math.min(a.x + a.w, b.x + b.w);
    const t = Math.min(a.y + a.h, b.y + b.h);
    if (r <= x || t <= y) return null;
    return { x, y, w: r - x, h: t - y };
  };
  M.dist = (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay);
  M.dist2 = (ax, ay, bx, by) => {
    const dx = bx - ax, dy = by - ay;
    return dx * dx + dy * dy;
  };

  /* ------------------------------------------------------- deterministic */
  /** mulberry32 PRNG — same seed, same level layout, every run. */
  M.rng = function (seed) {
    let a = seed >>> 0;
    if (!a) a = 0x9e3779b9;
    return function () {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  M.hash01 = function (n) {
    const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return s - Math.floor(s);
  };
  /** value noise 1d, smooth */
  M.noise1 = function (x, seed) {
    const i = Math.floor(x), f = x - i;
    const a = M.hash01(i * 71.3 + (seed || 0) * 13.7);
    const b = M.hash01((i + 1) * 71.3 + (seed || 0) * 13.7);
    const t = f * f * (3 - 2 * f);
    return a + (b - a) * t;
  };

  /* ----------------------------------------------------------- constants */
  M.C = {
    WORLD_W: 6400,
    WORLD_H: 1080,
    TILE: 32,

    // vertical layout
    WATER_TOP_Y: 900,
    FLOOR_Y: 40,
    CEIL_Y: 1040,

    // camera
    VIEW_H: 480,
    VIEW_W_MIN: 700,
    VIEW_W_MAX: 1080,

    // player body
    PW: 26,
    PH_SMALL: 30,
    PH_BIG: 46,

    // physics — surface
    GRAVITY: 2350,
    GRAVITY_HOLD: 2350 * 0.55,
    MAX_FALL: 1150,
    RUN_MAX: 260,
    SPRINT_MAX: 360,
    ACCEL_GROUND: 1900,
    ACCEL_AIR: 1300,
    FRICTION: 1500,
    JUMP_VY: 820,

    // physics — water
    SWIM_GRAVITY: 260,
    SWIM_MAX_UP: 420,
    SWIM_MAX_DOWN: 210,
    SWIM_ACCEL_H: 900,
    SWIM_ACCEL_V: 700,
    SWIM_DRAG: 3.2,
    STROKE_VY: 430,
    STROKE_LIFT: 160,
    SURFACE_LEAP: 760,

    // timing
    FIXED_DT: 1 / 60,
    MAX_FRAME_DT: 0.1,

    // rules
    START_LIVES: 3,
    LEVEL_TIME: 300,
    TIME_PER_TICK: 0.6,
    CHECKPOINT_INVULN: 1.6,
    INVULN_TIME: 1.6,
    STAR_TIME: 10,
    COIN_SCORE: 200,
    TOTAL_COINS_FOR_LIFE: 100,
  };

  /* ---------------------------------------------------------------- input */
  const KEYMAP = {
    ArrowLeft: 'left',
    KeyA: 'left',
    ArrowRight: 'right',
    KeyD: 'right',
    ArrowUp: 'stroke',
    KeyW: 'stroke',
    Space: 'stroke',
    KeyZ: 'stroke',
    KeyK: 'stroke',
    ArrowDown: 'down',
    KeyS: 'down',
    ShiftLeft: 'run',
    ShiftRight: 'run',
    KeyX: 'run',
    KeyJ: 'run',
    KeyP: 'pause',
    Escape: 'pause',
    KeyM: 'mute',
    KeyR: 'restart',
    Enter: 'start',
  };

  const held = Object.create(null);
  const pressed = Object.create(null);
  const released = Object.create(null);
  const simulated = Object.create(null); // debug overrides

  const Input = {
    left: false,
    right: false,
    up: false,
    down: false,
    run: false,
    jump: false,
    stroke: false,
    jumpPressed: false,
    strokePressed: false,
    jumpReleased: false,
    anyPressed: false,
    pausePressed: false,
    startPressed: false,
    restartPressed: false,
    mutePressed: false,
    lastVector: { x: 0, y: 0 },
    _prev: { jump: false, stroke: false },
    _tick: 0,

    /** Clear per-tick edges. Called by the main loop AFTER the fixed step. */
    endTick() {
      for (const k in pressed) delete pressed[k];
      for (const k in released) delete released[k];
      this._tick++;
    },
    /** kept for compatibility: same as endTick */
    beginTick() {
      this.endTick();
    },

    _set(action, isDown) {
      if (isDown && !held[action]) {
        pressed[action] = true;
      } else if (!isDown && held[action]) {
        released[action] = true;
      }
      held[action] = isDown;
    },

    /** Recompute derived booleans from key state. Call once per logic tick. */
    poll() {
      const on = (a) => !!(held[a] || simulated[a]);
      this.left = on('left');
      this.right = on('right');
      this.up = on('stroke');
      this.down = on('down');
      this.run = on('run');
      this.stroke = on('stroke');
      this.jump = on('stroke');
      this.jumpPressed = !!pressed['stroke'];
      this.strokePressed = !!pressed['stroke'];
      this.jumpReleased = !!released['stroke'];
      this.anyPressed = Object.keys(pressed).length > 0;
      this.pausePressed = !!pressed['pause'];
      this.startPressed = !!pressed['start'] || !!pressed['stroke'];
      this.restartPressed = !!pressed['restart'];
      this.mutePressed = !!pressed['mute'];
      const vx = (this.right ? 1 : 0) - (this.left ? 1 : 0);
      const vy = (this.up ? 1 : 0) - (this.down ? 1 : 0);
      this.lastVector.x = vx;
      this.lastVector.y = vy;
    },

    /** debug helper: force an action as if a key were held (keeps edge detection) */
    simulate(action, down) {
      simulated[action] = !!down;
      if (down) {
        if (!held[action]) pressed[action] = true;
        held[action] = true;
      } else {
        if (held[action]) released[action] = true;
        held[action] = false;
      }
    },

    /** debug helper: press for N seconds (frames handled by debug driver) */
    tap(action) {
      this._set(action, true);
      pressed[action] = true;
    },

    down(action) {
      return !!(held[action] || simulated[action]);
    },
    pressed(action) {
      return !!pressed[action];
    },
    released(action) {
      return !!released[action];
    },
  };
  M.Input = Input;

  function bindKeyboard() {
    window.addEventListener('keydown', (e) => {
      const a = KEYMAP[e.code];
      if (!a) return;
      // don't steal arrows/space from the page unless the game canvas is focused
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'].indexOf(e.code) >= 0) {
        e.preventDefault();
      }
      if (e.repeat) return;
      Input._set(a, true);
      if (M.Audio && M.Audio.instance) M.Audio.instance.unlock();
    });
    window.addEventListener('keyup', (e) => {
      const a = KEYMAP[e.code];
      if (!a) return;
      Input._set(a, false);
    });
    window.addEventListener('blur', () => {
      for (const k in held) Input._set(k, false);
    });
  }

  function bindTouch() {
    const buttons = document.querySelectorAll('#touch [data-key]');
    buttons.forEach((btn) => {
      const action = btn.getAttribute('data-key');
      const set = (down) => (ev) => {
        ev.preventDefault();
        Input._set(action, down);
        if (M.Audio && M.Audio.instance) M.Audio.instance.unlock();
        btn.classList.toggle('active', down);
      };
      btn.addEventListener('pointerdown', set(true));
      btn.addEventListener('pointerup', set(false));
      btn.addEventListener('pointercancel', set(false));
      btn.addEventListener('pointerleave', set(false));
    });
  }

  function bindGamepad() {
    Input._padPrev = {};
    Input.pollGamepad = function () {
      const pads = navigator.getGamepads ? navigator.getGamepads() : [];
      for (let i = 0; i < pads.length; i++) {
        const p = pads[i];
        if (!p) continue;
        const ax = p.axes[0] || 0;
        const ay = p.axes[1] || 0;
        const b = (n) => !!(p.buttons[n] && p.buttons[n].pressed);
        Input._set('left', ax < -0.35 || b(14));
        Input._set('right', ax > 0.35 || b(15));
        Input._set('stroke', b(0) || b(12) || ay < -0.5);
        Input._set('down', b(13) || ay > 0.5);
        Input._set('run', b(1) || b(2) || b(3));
        Input._set('pause', b(9));
        return;
      }
    };
  }

  M.bindInput = function () {
    bindKeyboard();
    bindTouch();
    bindGamepad();
  };

  /* ------------------------------------------------------------ game hub */
  M.Game = {
    state: 'boot', // boot | title | play | pause | dead | clear | gameover
    time: 0,
    dt: 0,
    frame: 0,
    player: null,
    world: null,
    camera: null,
    hud: null,
    audio: null,
    particles: null,
    entities: null,
    goal: null,
    level: null,
    score: 0,
    coins: 0,
    lives: M.C.START_LIVES,
    timer: M.C.LEVEL_TIME,
    power: 'small',
    checkpoint: 0,
    events: [],
    emit(name, payload) {
      this.events.push({ name, payload: payload || null, t: this.time });
      if (this.events.length > 200) this.events.shift();
    },
    resetRun() {
      this.score = 0;
      this.coins = 0;
      this.lives = M.C.START_LIVES;
      this.timer = M.C.LEVEL_TIME;
      this.power = 'small';
      this.checkpoint = 0;
      this.events.length = 0;
    },
  };

  /* --------------------------------------------------------- small utils */
  M.store = {
    get(key, fallback) {
      try {
        const v = localStorage.getItem('m32.' + key);
        return v == null ? fallback : JSON.parse(v);
      } catch (e) {
        return fallback;
      }
    },
    set(key, value) {
      try {
        localStorage.setItem('m32.' + key, JSON.stringify(value));
      } catch (e) {
        /* ignore quota / private mode */
      }
    },
  };

  /** palette shared by modules (kept in one place so the game reads as one art style) */
  M.PAL = {
    waterDeep: 0x0a2e4f,
    waterMid: 0x0f4f7d,
    waterLight: 0x1d7ba8,
    waterTop: 0x6fd3e8,
    caustic: 0x9fe8ff,
    sand: 0xd9c07a,
    sandDark: 0xb59b55,
    coral: 0xe06a6a,
    coralPink: 0xf28ba0,
    coralOrange: 0xf5a24a,
    coralPurple: 0x9a6ad1,
    kelp: 0x2f8f4e,
    kelpLight: 0x57c266,
    brick: 0xc06a3a,
    brickDark: 0x8a4526,
    pipe: 0x2fa03a,
    pipeDark: 0x1b6b28,
    pipeLight: 0x6fdc5c,
    stone: 0x6d7f8f,
    stoneDark: 0x4a5866,
    gold: 0xffcf3d,
    goldDark: 0xc08a12,
    white: 0xf5f8fa,
    black: 0x101418,
    mario: 0xe23a2e,
    marioBlue: 0x2f5ed6,
    frog: 0x39c449,
    frogDark: 0x1f8a2f,
    starColors: [0xffe14d, 0xffffff, 0xff9a3c],
    cheepGreen: 0x7ad14a,
    cheepRed: 0xe8452e,
    jelectro: 0x3a2f8f,
    jelectric: 0x9f8cff,
    boss: 0x3c8f2f,
  };
})();
