/* =========================================================================
   MARIO 3-2 — main.js
   Boot, renderer, lights, module wiring, fixed-step game loop, state machine
   (title / play / pause / dead / clear / gameover), scoring, timer, checkpoints,
   pipe teleports, goal sequence, debug API.
   ========================================================================= */
(function () {
  'use strict';
  const M = window.M32 || (window.M32 = {});
  const G = M.Game;
  const C = M.C;

  /* ------------------------------------------------------- debug surface */
  const D = {
    ready: false,
    errors: [],
    fatal: null,
    fps: 0,
    frames: 0,
    _fpsT: 0,
  };
  window.M32.DEBUG = D;

  function errText(e) {
    if (!e) return 'unknown error';
    if (typeof e === 'string') return e;
    return (e.message || String(e)) + (e.stack ? '\n' + String(e.stack).split('\n').slice(0, 4).join('\n') : '');
  }
  window.addEventListener('error', (ev) => {
    const t = errText(ev.error || ev.message);
    D.errors.push(t);
    if (D.errors.length > 40) D.errors.shift();
  });
  window.addEventListener('unhandledrejection', (ev) => {
    D.errors.push('unhandledrejection: ' + errText(ev.reason));
  });
  const log = (...a) => {
    if (window.M32_VERBOSE) console.log('[M32]', ...a);
  };

  /* ---------------------------------------------------------- module refs */
  let renderer = null;
  let scene = null;
  let level = null;
  let level3d = null;
  let world = null;
  let particles = null;
  let rig = null;
  let audio = null;
  let player = null;
  let entities = null;
  let hud = null;
  let goal = null;

  let rafId = 0;
  let lastNow = 0;
  let acc = 0;
  let started = false;
  let deathTimer = 0;
  let clearTimer = 0;
  let clearDone = false;
  let lowWarnStage = 0;
  let autopilot = false;
  let botClock = 0;
  let botStroke = 0;
  let titleClock = 0;
  let pendingResults = null;

  /* ---------------------------------------------------------- perf state
     The game logic runs on a fixed 60 Hz step. Rendering is decoupled and
     throttled: unused refresh rate on 120/144 Hz monitors would burn CPU/GPU
     for nothing, and a paused game shouldn't render 60 times a second.
     `maxDpr` is the adaptive canvas resolution scale (auto-drops if frames
     are slow). URL params: ?low=1 (force 1x), ?dpr=1.25 (cap). */
  let maxDpr = 1.5;
  let dprCap = 1.5;
  let quality = 'auto';
  let lastRenderAt = 0;
  let adaptAcc = 0;
  let adaptN = 0;

  function detectQuality() {
    try {
      const q = new URLSearchParams(window.location.search);
      if (q.get('low') === '1' || q.get('quality') === 'low') quality = 'low';
      if (q.get('dpr')) {
        const d = parseFloat(q.get('dpr'));
        if (isFinite(d) && d > 0) dprCap = Math.min(2, d);
      }
    } catch (e) {
      /* ignore */
    }
    if (quality === 'low') dprCap = 1;
    maxDpr = Math.min(window.devicePixelRatio || 1, dprCap);
  }

  function applyDpr() {
    if (!renderer) return;
    renderer.setPixelRatio(maxDpr);
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    if (rig && rig.resize) rig.resize(window.innerWidth, window.innerHeight);
  }

  const START = { x: 140, y: 120 };

  function spawnPoint() {
    if (level && level.start && isFinite(level.start.x)) {
      return { x: level.start.x, y: level.start.y };
    }
    return START;
  }

  /* ------------------------------------------------------------- renderer */
  function initRenderer() {
    const canvas = document.getElementById('game');
    if (!canvas) throw new Error('missing #game canvas');
    detectQuality();
    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: window.devicePixelRatio < 2,
      alpha: false,
      stencil: false,
      powerPreference: 'high-performance',
    });
    renderer.setPixelRatio(maxDpr);
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    if ('outputColorSpace' in renderer) renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NoToneMapping;
    renderer.shadowMap.enabled = false;
    renderer.info.autoReset = true;

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x07243c);
    scene.add(makeLights());
  }

  function makeLights() {
    const grp = new THREE.Group();
    grp.name = 'lights';
    // legacy-lights=false in r158: ambient/hemi are in "lux-ish" units, directional ~π stronger
    grp.add(new THREE.AmbientLight(0xbfe8ff, 1.35));
    const hemi = new THREE.HemisphereLight(0xa8f0ff, 0x08202f, 1.1);
    hemi.position.set(0, 400, 0);
    grp.add(hemi);
    const sun = new THREE.DirectionalLight(0xfff4d6, 2.15);
    sun.position.set(-320, 900, 700);
    grp.add(sun);
    const fill = new THREE.DirectionalLight(0x77ccff, 0.85);
    fill.position.set(500, -200, 400);
    grp.add(fill);
    return grp;
  }

  /* -------------------------------------------------------------- modules */
  function initModules() {
    level = M.LEVEL;
    if (!level) throw new Error('M32.LEVEL missing (js/level.js failed to load?)');
    if (!M.Level3D) throw new Error('M32.Level3D missing (js/level3d.js failed to load?)');

    level3d = M.Level3D.build(level);
    G.level = level;
    G.level3d = level3d;

    if (M.World) {
      world = new M.World(scene, level, level3d);
      world.build();
      G.world = world;
    }
    if (M.Particles) {
      particles = new M.Particles(scene);
      G.particles = particles;
    }
    if (M.CameraRig) {
      rig = new M.CameraRig(renderer, scene, level, level3d);
      G.camera = rig;
    } else {
      // minimal fallback so the game still renders
      const cam = new THREE.OrthographicCamera(-640, 640, 400, -400, 0.1, 2000);
      cam.position.set(640, 400, 600);
      rig = {
        camera: cam,
        x: 640,
        y: 400,
        viewW: 1280,
        viewH: 800,
        update() {},
        resize() {},
        shake() {},
        snapTo(x, y) {
          cam.position.set(x, y, 600);
        },
      };
      G.camera = rig;
    }
    if (M.Audio) {
      audio = new M.Audio();
      M.Audio.instance = audio;
      G.audio = audio;
    }
    if (M.Player) {
      player = new M.Player(scene, level, level3d);
      G.player = player;
    } else {
      throw new Error('M32.Player missing (js/player.js failed to load?)');
    }
    if (M.Entities) {
      entities = new M.Entities(scene, level, level3d);
      G.entities = entities;
    }
    if (M.Goal) {
      goal = new M.Goal(scene, level, level3d);
      G.goal = goal;
    }
    if (M.Hud) {
      hud = new M.Hud();
      hud.bind(G);
      G.hud = hud;
    }

    // background / decorative start
    G.power = 'small';
    G.level3d = level3d;
  }

  /* --------------------------------------------------------------- states */
  function startTitle() {
    G.state = 'title';
    G.resetRun();
    deathTimer = 0;
    clearTimer = 0;
    clearDone = false;
    lowWarnStage = 0;
    pendingResults = null;
    autopilot = false;
    titleClock = 0;
    deathHandled = false;

    if (player) {
      const p = respawnPos(0);
      player.reset(p.x, p.y);
      if (player.setPower) player.setPower('small');
      player.dead = false;
    }
    if (entities) entities.reset();
    if (goal) goal.reset();
    if (particles) particles.clear();
    if (rig) {
      const p0 = respawnPos(0);
      snapCamera(Math.max(p0.x + 380, 500), 430);
      if (rig.setZoom) rig.setZoom(1);
    }
    if (hud) {
      hud.setPower('small');
      hud.setPaused(false);
      hud.overlay(
        'WORLD 3-2',
        'UNDERWATER',
        'A Super Mario Bros. 3 remake',
        'PRESS <b>SPACE</b> / <b>Z</b> TO START',
        { keys: true }
      );
    }
    if (audio) audio.music('title');
    D.ready = true;
  }

  function startPlay() {
    if (G.state === 'gameover') {
      startTitle();
      return;
    }
    if (G.state !== 'title' && G.state !== 'clear') {
      // resume-style start is handled elsewhere
    }
    if (G.state === 'title') {
      G.resetRun();
      G.state = 'play';
      G.timer = C.LEVEL_TIME;
      if (player) {
        const p = respawnPos(0);
        player.reset(p.x, p.y);
        player.setPower('small');
      }
      if (entities) entities.reset();
      if (goal) goal.reset();
      if (hud) {
        hud.hideOverlay();
        hud.setPower('small');
        hud.toast('WORLD 3-2 · UNDERWATER', { tone: 'info', ms: 2100 });
      }
      if (audio) {
        audio.unlock();
        audio.music('underwater');
      }
      if (rig && rig.setZoom) rig.setZoom(1);
      if (rig) snapCamera(respawnPos(0).x, respawnPos(0).y);
    }
  }

  function restartLevel() {
    G.resetRun();
    G.state = 'play';
    G.timer = C.LEVEL_TIME;
    lowWarnStage = 0;
    deathHandled = false;
    if (player) {
      const p = respawnPos(0);
      player.reset(p.x, p.y);
      player.setPower('small');
    }
    if (entities) entities.reset();
    if (goal) goal.reset();
    if (particles) particles.clear();
    if (hud) {
      hud.hideOverlay();
      hud.setPaused(false);
      hud.setPower('small');
      hud.toast('LEVEL RESTART', { tone: 'info' });
    }
    if (audio) {
      audio.unlock();
      audio.music('underwater');
    }
    if (rig && rig.setZoom) rig.setZoom(1);
    snapCamera(respawnPos(0).x, respawnPos(0).y);
  }

  let deathHandled = false;

  function respawnPos(index) {
    if (level3d && level3d.respawnPoint) {
      try {
        const p = level3d.respawnPoint(index);
        if (p && isFinite(p.x)) return p;
      } catch (e) {
        /* fall through */
      }
    }
    if (index > 0 && level && level.checkpoints && level.checkpoints[index - 1]) {
      const cp = level.checkpoints[index - 1];
      return { x: cp.x, y: cp.y != null ? cp.y : 300 };
    }
    return spawnPoint();
  }

  function snapCamera(x, y) {
    if (!rig) return;
    if (rig.snapTo) {
      rig.snapTo(x, y);
      return;
    }
    if (rig.camera) rig.camera.position.set(x, y, 600);
    if (typeof rig.x === 'number') rig.x = x;
    if (typeof rig.y === 'number') rig.y = y;
  }

  function respawn() {
    const p = respawnPos(G.checkpoint || 0);
    G.state = 'play';
    G.timer = C.LEVEL_TIME;
    lowWarnStage = 0;
    deathHandled = false;
    if (player) {
      player.reset(p.x, p.y);
      player.setPower('small');
      player.dead = false;
    }
    if (entities) entities.reset();
    if (goal) goal.reset();
    if (particles) particles.clear();
    if (hud) {
      hud.setPower('small');
      hud.hideOverlay();
      hud.toast('CHECKPOINT ' + (G.checkpoint || 0), { tone: 'info', ms: 1200 });
    }
    if (audio) audio.music('underwater');
    if (rig && rig.setZoom) rig.setZoom(1);
    snapCamera(p.x, p.y);
  }

  function onDeath() {
    if (G.state !== 'play') return;
    if (deathHandled) return;
    deathHandled = true;
    G.state = 'dead';
    deathTimer = 0;
    if (audio) {
      audio.music('none');
      audio.play('die');
    }
    if (rig) {
      rig.shake(9, 0.45);
      if (rig.setZoom) rig.setZoom(1.18);
    }
  }

  function onGameOver() {
    G.state = 'gameover';
    if (hud) {
      hud.overlay(
        'GAME OVER',
        'TRY AGAIN',
        'The sea wins this time.',
        'PRESS <b>SPACE</b> / <b>Z</b> TO CONTINUE',
        { keys: false }
      );
    }
    if (audio) audio.music('none');
  }

  function onGoal() {
    if (G.state === 'clear' || clearDone) return;
    G.state = 'clear';
    clearTimer = 0;
    clearDone = false;
    // classic end-of-level time bonus
    const timeBonus = Math.floor(G.timer) * 50;
    G.score += timeBonus;
    if (hud) hud.toast('COURSE CLEAR! +' + timeBonus, { tone: 'power', ms: 2400 });
    if (audio) {
      audio.music('clear');
      audio.play('clear');
    }
    if (rig && rig.setZoom) rig.setZoom(0.92);
    if (player && player.celebrate) player.celebrate();
    if (entities) entities.freeze && entities.freeze();
  }

  function showResults() {
    if (clearDone) return;
    clearDone = true;
    const timeBonus = Math.max(0, Math.floor(G.timer)) * 50;
    pendingResults = {
      score: G.score,
      coins: G.coins,
      lives: G.lives,
      time: Math.max(0, Math.floor(G.timer)),
      timeBonus: timeBonus,
    };
    if (hud) {
      hud.overlay(
        'COURSE CLEAR',
        'WORLD 3-2',
        'SCORE ' + pad(G.score, 6) + '   ·   COINS ' + G.coins +
          '   ·   TIME BONUS ' + timeBonus,
        'PRESS <b>SPACE</b> / <b>Z</b> TO PLAY AGAIN',
        { keys: false }
      );
      if (hud.showCards) {
        hud.showCards([
          { label: 'SCORE', value: pad(G.score, 6) },
          { label: 'COINS', value: 'x' + pad(G.coins, 2) },
          { label: 'TIME BONUS', value: '+' + timeBonus },
        ]);
      }
    }
  }

  function pad(n, len) {
    let s = String(Math.max(0, Math.floor(n)));
    while (s.length < len) s = '0' + s;
    return s;
  }

  /* -------------------------------------------------------------- events */
  function handleEvents() {
    const evs = G.events;
    for (let i = 0; i < evs.length; i++) {
      const ev = evs[i];
      const p = ev.payload || {};
      switch (ev.name) {
        case 'coin': {
          G.coins++;
          G.score += p.points || C.COIN_SCORE;
          if (audio) audio.play('coin');
          if (G.coins > 0 && G.coins % C.TOTAL_COINS_FOR_LIFE === 0) {
            G.lives++;
            if (audio) audio.play('oneup');
            if (hud) hud.toast('1-UP! 100 COINS', { tone: 'power' });
          }
          break;
        }
        case 'score': {
          G.score += p.points || 0;
          break;
        }
        case 'powerup': {
          const pw = p.power || 'big';
          G.power = pw;
          if (player && player.setPower) player.setPower(pw);
          if (hud) hud.setPower(pw);
          if (audio) audio.play('powerup');
          if (particles) particles.burst(player ? player.x : 0, player ? player.y + 24 : 0, {
            count: 18,
            color: 0x7dff7d,
            speed: 260,
            size: 7,
            life: 0.7,
            gravity: -120,
            sprite: 'star',
          });
          break;
        }
        case 'oneup': {
          G.lives++;
          if (audio) audio.play('oneup');
          if (hud) hud.toast('1-UP!', { tone: 'power' });
          break;
        }
        case 'stomp': {
          if (audio) audio.play('stomp');
          if (rig) rig.shake(4, 0.14);
          break;
        }
        case 'boss-hit': {
          if (audio) audio.play('boss');
          if (rig) rig.shake(12, 0.4);
          if (hud) hud.toast('BOSS BASS HIT!', { tone: 'warn', ms: 900 });
          break;
        }
        case 'damage': {
          if (audio) audio.play('damage');
          if (rig) rig.shake(10, 0.32);
          if (hud) {
            hud.flash();
            hud.toast('OUCH!', { tone: 'warn', ms: 800 });
          }
          break;
        }
        case 'death': {
          onDeath();
          break;
        }
        case 'goal': {
          onGoal();
          break;
        }
        case 'checkpoint': {
          const idx = p.index != null ? p.index : (G.checkpoint || 0) + 1;
          G.checkpoint = Math.max(G.checkpoint || 0, idx);
          if (audio) audio.play('oneup');
          if (hud) {
            hud.toast('CHECKPOINT!', { tone: 'power', ms: 1300 });
            hud.flash();
          }
          if (particles && player) {
            particles.burst(player.x, player.y + 30, {
              count: 24,
              color: 0xffe680,
              speed: 240,
              size: 8,
              life: 0.8,
              gravity: -60,
              sprite: 'spark',
            });
          }
          break;
        }
        case 'pipe-enter': {
          onPipeEnter(p);
          break;
        }
        case 'timer-low': {
          if (audio) audio.play('timer');
          break;
        }
        case 'toast': {
          if (hud) hud.toast(p.text || '', p);
          break;
        }
        case 'bubble': {
          if (particles) particles.burst(p.x || 0, p.y || 0, { count: 3, color: 0xbdefff, speed: 90, size: 4, life: 1.1, gravity: -140, sprite: 'bubble' });
          break;
        }
        case 'surface': {
          if (audio) audio.play('surface');
          if (particles && player) {
            particles.burst(player.x, player.y + 20, { count: 16, color: 0xdff6ff, speed: 220, size: 6, life: 0.8, gravity: -300, sprite: 'bubble' });
          }
          break;
        }
        default:
          break;
      }
    }
    evs.length = 0;
  }

  /* --------------------------------------------------------------- pipes */
  function onPipeEnter(p) {
    const pipe = p.pipe || p;
    if (!pipe) return;
    const target = pipe.target || (pipe.roomEntry ? 'bonus' : null);
    const rooms = level && level.bonusRooms ? level.bonusRooms : [];
    if (target === 'bonus' || pipe.roomEntry) {
      const room = rooms.find((r) => r.id === pipe.room) || rooms[0];
      if (!room) return;
      if (audio) audio.play('powerup');
      if (hud) hud.toast('BONUS ROOM', { tone: 'coin', ms: 1200 });
      const rect = room.rect || room;
      const entry = room.entry || { x: rect.x + 90, y: rect.y + 80 };
      if (player) player.reset(entry.x, entry.y);
      snapCamera(rect.x + rect.w / 2, rect.y + rect.h / 2);
      G.inBonus = true;
    } else if (target === 'main' || pipe.exit) {
      const room = rooms.find((r) => r.id === pipe.room) || rooms[0] || {};
      const to = pipe.to || pipe.returnTo || room.returnTo || { x: 3350, y: 520 };
      if (audio) audio.play('surface');
      if (player) player.reset(to.x, to.y);
      if (hud) hud.toast('BACK TO THE DEEP', { tone: 'info', ms: 1100 });
      snapCamera(to.x, to.y);
      G.inBonus = false;
    }
  }

  /* ---------------------------------------------------------------- timer */
  function updateTimer(dt) {
    if (G.state !== 'play') return;
    const before = G.timer;
    G.timer -= dt / C.TIME_PER_TICK;
    if (G.timer < 0) G.timer = 0;
    if (before > 100 && G.timer <= 100 && lowWarnStage < 1) {
      lowWarnStage = 1;
      if (audio) audio.play('timer');
      if (hud) hud.toast('HURRY UP!', { tone: 'warn', ms: 1400 });
    }
    if (before > 50 && G.timer <= 50 && lowWarnStage < 2) {
      lowWarnStage = 2;
      if (audio) audio.play('timer');
      if (hud) hud.toast('TIME IS RUNNING OUT!', { tone: 'warn', ms: 1400 });
    }
    if (G.timer <= 0 && player && !player.dead) {
      player.die();
    }
  }

  function updateCheckpoints() {
    if (G.state !== 'play' || !player) return;
    const cps = (level && level.checkpoints) || [];
    for (let i = 0; i < cps.length; i++) {
      const idx = i + 1;
      if (player.x > cps[i].x + 24 && (G.checkpoint || 0) < idx) {
        G.checkpoint = idx;
        G.emit('checkpoint', { index: idx, x: cps[i].x });
      }
    }
  }

  /* -------------------------------------------------------------- autopilot
     Used by the smoke test to prove the level is completable. Swims right,
     pulses strokes, probes ahead for a clear lane and steers to it; at the
     beach it leaps out of the water and walks to the flag. */
  let botTargetY = 470;
  let botProbeT = 0;
  let botBlocked = 0;

  function botClearAt(x, y) {
    const g = M.Game;
    if (!g || !g.level3d || !player) return true;
    const w = player.w || 26;
    const h = player.h || 30;
    const box = { x: x - w / 2, y: y, w: w, h: h };
    const solids = g.level3d.query(box);
    for (let i = 0; i < solids.length; i++) if (M.aabb(box, solids[i])) return false;
    return true;
  }

  function runBot(dt) {
    botClock += dt;
    const inp = M.Input;
    if (!player) return;

    inp.simulate('right', true);
    inp.simulate('run', true);

    // ---- lane choice: probe ahead, pick the nearest clear height
    botProbeT -= dt;
    if (botProbeT <= 0) {
      botProbeT = 0.12;
      const px = player.x;
      const py = player.y;
      if (!player.inWater) {
        botTargetY = py; // on land: just keep walking/jumping
      } else if (!botClearAt(px + 70, py)) {
        let best = null;
        let bestD = 1e9;
        for (let d = 16; d <= 200; d += 16) {
          for (const sgn of [1, -1]) {
            const ty = py + sgn * d;
            if (ty < 70 || ty > 880) continue;
            if (botClearAt(px + 70, ty)) {
              const dd = Math.abs(ty - 470) * 0.15 + d;
              if (dd < bestD) {
                bestD = dd;
                best = ty;
              }
            }
          }
          if (best != null) break;
        }
        if (best != null) botTargetY = best;
      } else {
        // no obstacle: drift back toward the mid lane
        botTargetY = 470;
      }
    }

    // ---- beach finale: surface, leap, walk to the flag
    const goalX = level && level.goal ? level.goal.x : 6150;
    const nearGoal = player.x > goalX - 380;
    if (nearGoal) {
      botTargetY = 940;
      inp.simulate('down', false);
      // pulse strokes so the surface leap triggers near the bank
      if (botClock - botStroke > 0.3) {
        botStroke = botClock;
        inp.simulate('stroke', false);
        inp.simulate('stroke', true);
      } else if (botClock - botStroke > 0.14) {
        inp.simulate('stroke', false);
      }
    } else if (player.inWater) {
      const dy = botTargetY - player.y;
      if (dy > 24) {
        // rise: rhythmic fresh strokes + held thrust
        if (botClock - botStroke > 0.3) {
          botStroke = botClock;
          inp.simulate('stroke', false);
          inp.simulate('stroke', true);
        } else if (botClock - botStroke > 0.13) {
          inp.simulate('stroke', false);
        }
        inp.simulate('down', false);
      } else if (dy < -70) {
        inp.simulate('stroke', false);
        inp.simulate('down', true);
      } else {
        inp.simulate('stroke', false);
        inp.simulate('down', false);
      }
    } else {
      // on land: walk / jump
      inp.simulate('stroke', false);
      inp.simulate('down', false);
      if (Math.abs(player.vx) < 40 && player.onGround) {
        M.Input.tap('stroke');
      }
    }

    // ---- unstick: blocked for a while -> swim up, then down
    if (player.inWater && Math.abs(player.vx) < 28) botBlocked += dt;
    else botBlocked = 0;
    if (botBlocked > 0.35) {
      inp.simulate('stroke', true);
      inp.simulate('down', false);
    }
    if (botBlocked > 1.6) {
      inp.simulate('stroke', false);
      inp.simulate('down', true);
    }
    if (botBlocked > 2.6) botBlocked = 0;
  }

  function clearBot() {
    const inp = M.Input;
    ['right', 'left', 'stroke', 'down', 'run', 'up'].forEach((a) => inp.simulate(a, false));
    botBlocked = 0;
  }

  /* ----------------------------------------------------------- fixed step */
  function step(dt) {
    G.dt = dt;
    G.time += dt;
    G.frame++;

    if (G.state === 'title') {
      M.Input.poll();
      titleClock += dt;
      if (player && player.idleUpdate) player.idleUpdate(dt);
      if (entities) entities.update(dt, player);
      if (world) world.update(dt, rig);
      if (particles) particles.update(dt);
      if (rig) rig.update(dt);
      if (audio) audio.tick(dt);
      if (hud) hud.update(dt);
      if (titleClock > 0.1) handleEvents();
      M.Input.endTick();
      return;
    }

    if (G.state === 'pause') {
      if (hud) hud.update(dt);
      if (audio) audio.tick(dt);
      M.Input.endTick();
      return;
    }

    if (G.state === 'gameover') {
      M.Input.poll();
      if (world) world.update(dt, rig);
      if (particles) particles.update(dt);
      if (rig) rig.update(dt);
      if (audio) audio.tick(dt);
      if (hud) hud.update(dt);
      handleEvents();
      M.Input.endTick();
      return;
    }

    // autopilot injects synthetic input edges *before* poll so the player sees them
    if (G.state === 'play' && autopilot) runBot(dt);

    M.Input.poll();

    if (player) player.update(dt);
    if (entities) entities.update(dt, player);
    if (world) world.update(dt, rig);
    if (goal) goal.update(dt);
    if (particles) particles.update(dt);
    if (rig) rig.update(dt);
    if (hud) hud.update(dt);
    if (audio) audio.tick(dt);

    handleEvents();

    if (G.state === 'play') {
      updateTimer(dt);
      updateCheckpoints();
    } else if (G.state === 'dead') {
      deathTimer += dt;
      if (deathTimer > 2.6) {
        G.lives--;
        if (G.lives > 0) respawn();
        else onGameOver();
      }
    } else if (G.state === 'clear') {
      clearTimer += dt;
      if (clearTimer > 7.5 && !clearDone) showResults();
      if (clearDone && (M.Input.startPressed || M.Input.anyPressed) && clearTimer > 8.2) {
        startTitle();
        if (audio) audio.music('title');
      }
    }

    M.Input.endTick();
  }

  function togglePause(force) {
    if (G.state === 'play') {
      G.state = 'pause';
      if (hud) hud.setPaused(true);
      if (audio) {
        audio.music('none');
        audio.play('pause');
      }
      log('paused');
    } else if (G.state === 'pause' && !force) {
      G.state = 'play';
      if (hud) hud.setPaused(false);
      if (audio) audio.music('underwater');
    }
  }

  /* ------------------------------------------------------------ main loop */
  function render() {
    if (!renderer || !rig) return;
    renderer.render(scene, rig.camera);
    G.drawCalls = renderer.info.render.calls;
    G.triangles = renderer.info.render.triangles;
  }

  function frame(now) {
    rafId = requestAnimationFrame(frame);
    if (!lastNow) lastNow = now;
    let dt = (now - lastNow) / 1000;
    lastNow = now;
    if (dt < 0) dt = 0;
    if (dt > C.MAX_FRAME_DT) dt = C.MAX_FRAME_DT;

    D.frames++;
    D._fpsT += dt;
    if (D._fpsT >= 0.5) {
      D.fps = Math.round(D.frames / D._fpsT);
      D.frames = 0;
      D._fpsT = 0;
    }

    // global keys handled in real time so they work even while paused
    M.Input.poll();
    if (M.Input.mutePressed && audio) audio.setMuted(!audio.muted);
    if (M.Input.restartPressed && (G.state === 'play' || G.state === 'pause' || G.state === 'dead')) {
      restartLevel();
    }
    if (M.Input.pausePressed) {
      if (G.state === 'play') togglePause(true);
      else if (G.state === 'pause') togglePause(false);
    }
    if (G.state === 'title' || G.state === 'gameover') {
      // first key press on title starts the game (SMB3 behaviour)
      if (M.Input.startPressed || M.Input.anyPressed) startPlay();
    }

    // fixed-step logic (cheap even on 144 Hz displays)
    acc += dt;
    let guard = 0;
    while (acc >= C.FIXED_DT && guard < 6) {
      step(C.FIXED_DT);
      acc -= C.FIXED_DT;
      guard++;
    }
    if (guard >= 6) acc = 0;

    // ---- render throttle: never render more than ~60 fps, 30 on menus,
    //      10 while paused (the camera/scene are static then).
    const state = G.state;
    const minRenderMs = state === 'pause' ? 100 : state === 'play' || state === 'dead' ? 15.5 : 33;
    if (now - lastRenderAt >= minRenderMs) {
      render();
      lastRenderAt = now;
    }

    // ---- adaptive resolution: if we are consistently slower than ~40 fps,
    //      drop the canvas resolution in steps; recover when there is headroom.
    adaptAcc += dt;
    adaptN++;
    if (adaptAcc >= 1.5 && adaptN > 10) {
      const avg = adaptAcc / adaptN;
      if (quality !== 'low') {
        if (avg > 0.024 && maxDpr > 0.8) {
          maxDpr = Math.max(0.8, maxDpr - 0.2);
          applyDpr();
          log('quality: dpr ->', maxDpr.toFixed(2));
        } else if (avg < 0.018 && maxDpr < dprCap - 0.01) {
          maxDpr = Math.min(dprCap, maxDpr + 0.2);
          applyDpr();
          log('quality: dpr ->', maxDpr.toFixed(2));
        }
      }
      adaptAcc = 0;
      adaptN = 0;
    }
  }

  /* ------------------------------------------------------------- resize */
  function onResize() {
    if (!renderer) return;
    renderer.setPixelRatio(maxDpr);
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    if (rig && rig.resize) rig.resize(window.innerWidth, window.innerHeight);
  }

  /* ---------------------------------------------------------------- boot */
  function boot() {
    if (started) return;
    started = true;
    try {
      initRenderer();
      initModules();
    } catch (e) {
      D.fatal = errText(e);
      D.errors.push(D.fatal);
      showFatal(D.fatal);
      return;
    }

    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && G.state === 'play') togglePause(true);
    });
    // don't keep simulating/rendering while the player alt-tabs away
    window.addEventListener('blur', () => {
      if (G.state === 'play') togglePause(true);
    });

    M.bindInput();
    M.Input.poll();

    // click / tap anywhere starts (audio unlock needs a gesture)
    const overlay = document.getElementById('overlay');
    if (overlay) {
      overlay.addEventListener('pointerdown', () => {
        if (G.state === 'title' || G.state === 'gameover') {
          if (audio) audio.unlock();
          startPlay();
        }
      });
    }
    const canvas = document.getElementById('game');
    if (canvas) {
      canvas.addEventListener('pointerdown', () => {
        if (audio) audio.unlock();
        if (G.state === 'title' || G.state === 'gameover') startPlay();
      });
    }

    startTitle();
    lastNow = 0;
    rafId = requestAnimationFrame(frame);
    log('booted', { level: level && level.name, blocks: level3d && level3d.solids.length });
  }

  function showFatal(msg) {
    const ov = document.getElementById('overlay');
    if (!ov) return;
    ov.classList.add('visible');
    const t = document.getElementById('overlay-title');
    const s = document.getElementById('overlay-sub');
    const k = document.getElementById('overlay-kicker');
    const hint = document.getElementById('overlay-hint');
    if (k) k.textContent = 'ERROR';
    if (t) t.textContent = 'FAILED TO START';
    if (s) s.textContent = String(msg).slice(0, 240);
    if (hint) hint.innerHTML = 'Open the console (F12) for details.';
  }

  /* ----------------------------------------------------------- debug API */
  D.state = () => G.state;
  D.stepOnce = () => step(C.FIXED_DT);
  D.start = () => {
    if (G.state === 'title' || G.state === 'gameover') startPlay();
  };
  /** force a clean playable state at an arbitrary point (test/tour helper) */
  D.revive = (x, y) => {
    if (!player) return;
    G.state = 'play';
    G.lives = Math.max(G.lives, 3);
    G.timer = C.LEVEL_TIME;
    lowWarnStage = 0;
    deathHandled = false;
    clearDone = false;
    clearTimer = 0;
    autopilot = false;
    if (G.state === 'gameover') G.resetRun();
    const p = x != null && isFinite(x) ? { x: x, y: y == null ? 300 : y } : respawnPos(G.checkpoint || 0);
    player.reset(p.x, p.y);
    player.dead = false;
    if (player.setPower) player.setPower(G.power === 'small' ? 'small' : G.power);
    if (entities) entities.reset();
    if (goal) goal.reset();
    if (particles) particles.clear();
    if (hud) {
      hud.hideOverlay();
      hud.setPaused(false);
    }
    if (rig && rig.setZoom) rig.setZoom(1);
    snapCamera(p.x, p.y);
    if (audio) audio.music('underwater');
  };
  D.hold = (action, down) => M.Input.simulate(action, !!down);
  D.releaseAll = clearBot;
  D.press = (action) => M.Input.tap(action);
  D.autopilot = (on) => {
    autopilot = !!on;
    if (!on) clearBot();
  };
  D.teleport = (x, y) => {
    if (!player) return;
    player.reset(x, y);
    if (player.setPower && G.power) player.setPower(G.power);
    player.dead = false;
    snapCamera(x, y);
  };
  D.skipTo = (x, lane) => {
    D.teleport(x, lane == null ? 470 : lane);
  };
  D.setPower = (p) => {
    G.power = p;
    if (player && player.setPower) player.setPower(p);
    if (hud) hud.setPower(p);
  };
  D.giveInvincible = (sec) => {
    if (!player) return;
    player.invincible = true;
    player.starTime = sec || 10;
  };
  D.kill = () => {
    if (player) player.die();
  };
  D.simulate = (seconds) => {
    const n = Math.round(seconds / C.FIXED_DT);
    for (let i = 0; i < n; i++) {
      step(C.FIXED_DT);
    }
  };
  D.stats = () => ({
    state: G.state,
    fps: D.fps,
    draws: G.drawCalls || 0,
    tris: G.triangles || 0,
    score: G.score,
    coins: G.coins,
    lives: G.lives,
    time: Math.round(G.timer * 10) / 10,
    power: G.power,
    checkpoint: G.checkpoint,
    x: player ? Math.round(player.x) : null,
    y: player ? Math.round(player.y) : null,
    inWater: player ? !!player.inWater : null,
    dead: player ? !!player.dead : null,
    invincible: player ? !!player.invincible : null,
    enemies: entities && entities.all ? entities.all.filter((e) => e.alive).length : 0,
    entities: entities && entities.all ? entities.all.length : 0,
    errors: D.errors.length,
    levelMaxX: level ? level.width : 0,
    goalX: level && level.goal ? level.goal.x : 0,
    inBonus: !!G.inBonus,
  });
  D.errorsList = () => D.errors.slice();
  D.perf = () => ({
    fps: D.fps,
    dpr: Math.round(maxDpr * 100) / 100,
    dprCap: dprCap,
    quality: quality,
    state: G.state,
    draws: G.drawCalls || 0,
    tris: G.triangles || 0,
    renderThrottled: true,
  });
  D.setQuality = (q) => {
    quality = q === 'low' ? 'low' : 'auto';
    dprCap = quality === 'low' ? 1 : Math.min(window.devicePixelRatio || 1, 1.5);
    maxDpr = Math.min(window.devicePixelRatio || 1, dprCap);
    applyDpr();
  };
  D.worldInfo = () => ({
    solids: level3d ? level3d.solids.length : 0,
    zones: level && level.zones ? level.zones.length : 0,
    pipes: level && level.pipes ? level.pipes.length : 0,
    checkpoints: level && level.checkpoints ? level.checkpoints.length : 0,
    bonusRooms: level && level.bonusRooms ? level.bonusRooms.length : 0,
  });
  D.forceGoal = () => {
    if (goal && goal.trigger) goal.trigger();
    else G.emit('goal', {});
  };

  /* ---------------------------------------------------------------- kick */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
