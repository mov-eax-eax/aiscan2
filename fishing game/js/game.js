/* ABYSS ANGLER — game logic: progression, casting, fights, economy, UI. */
(function () {
  'use strict';

  var D = window.GAME_DATA;
  if (!D) { console.error('Abyss Angler: game data missing.'); return; }

  var FISH = {};
  D.FISH.forEach(function (f) { FISH[f.id] = f; });
  var LEVELS = D.LEVELS;
  var UPGRADES = D.UPGRADES;
  var RANKS = D.RANKS;
  var TIPS = D.TIPS;
  var THEMES = ['day', 'reef', 'trench', 'night', 'storm'];
  var SAVE_KEY = 'abyss_angler_save_v6';
  var SAVE_BACKUP_KEY = SAVE_KEY + '_backup';
  var LEGACY_KEYS = [
    'abyss_angler_save_v5', 'abyss_angler_save_v5_backup',
    'abyss_angler_save_v4', 'abyss_angler_save_v4_backup',
    'abyss_angler_save_v3', 'abyss_angler_save_v3_backup',
    'abyss_angler_save_v2', 'abyss_angler_save_v2_backup',
    'abyss_angler_save_v1', 'abyss_angler_save_v1_backup'
  ];
  var SAVE_VERSION = 6;
  var RARITY_WEIGHT = { common: 10, uncommon: 5.5, rare: 2.2, epic: 1.0, legendary: 0.35 };
  var RARITY_COLOR = { common: '#5a5648', uncommon: '#42674f', rare: '#3f5c70', epic: '#634d68', legendary: '#8a5e2c' };
  var RARITY_SONAR = { common: '#c8c0aa', uncommon: '#9cc2ad', rare: '#9db6c4', epic: '#b4a3ba', legendary: '#e0bd80' };
  var UPGRADE_ICONS = { rod: '◢', reel: '◉', line: '≈', sonar: '◈', lure: '✦' };

  function $(id) { return document.getElementById(id); }
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function rand(a, b) { return a + Math.random() * (b - a); }
  function randInt(a, b) { return Math.floor(rand(a, b + 1)); }
  function fmtWeight(w) { return w < 1 ? w.toFixed(2) : w.toFixed(1); }
  function fmtTime(s) {
    s = Math.max(0, Math.ceil(s));
    var m = Math.floor(s / 60);
    var ss = s % 60;
    return m + ':' + (ss < 10 ? '0' : '') + ss;
  }
  function fmtMinutes(sec) {
    var m = Math.floor(sec / 60);
    return m < 1 ? 'under a minute' : m + ' min';
  }
  function rarityClass(r) { return 'rarity ' + r; }
  function shufflePick(list, total, weights) {
    var r = Math.random() * total;
    for (var i = 0; i < list.length; i++) {
      r -= weights[i];
      if (r <= 0) return list[i];
    }
    return list[list.length - 1];
  }

  // ------------------------------------------------------------------ save
  function defaultSave() {
    return {
      v: SAVE_VERSION, startedAt: null, lastPlayed: null,
      coins: 0, xp: 0, unlocked: 1,
      caught: {}, best: {}, completed: {}, run: null,
      contracts: [], contractSeq: 1, tokens: 0, renown: 0, contractsDone: 0,
      charms: [], charm: null,
      upgrades: { rod: 0, reel: 0, line: 0, sonar: 0, lure: 0 },
      stats: { casts: 0, catches: 0, escapes: 0, bestWeight: 0, playtime: 0, bestStreak: 0 },
      settings: { muted: false, ambience: false, lure: 'minnow' },
      finalSeen: false
    };
  }

  function readSaveSlot(key) {
    try {
      var raw = window.localStorage.getItem(key);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      return (parsed && typeof parsed === 'object') ? parsed : null;
    } catch (e) {
      return null;
    }
  }

  function loadSave() {
    // Current key, its backup, then every older build's key in order.
    var s = readSaveSlot(SAVE_KEY);
    if (!s) s = readSaveSlot(SAVE_BACKUP_KEY);
    for (var li = 0; li < LEGACY_KEYS.length && !s; li++) s = readSaveSlot(LEGACY_KEYS[li]);
    var d = defaultSave();
    if (!s) return d;
    var out = d;
    out.startedAt = s.startedAt || null;
    out.lastPlayed = s.lastPlayed || null;
    out.coins = Math.max(0, Math.floor(Number(s.coins) || 0));
    out.xp = Math.max(0, Math.floor(Number(s.xp) || 0));
    out.unlocked = clamp(Math.floor(Number(s.unlocked) || 1), 1, LEVELS.length);
    out.caught = (s.caught && typeof s.caught === 'object') ? s.caught : {};
    out.best = (s.best && typeof s.best === 'object') ? s.best : {};
    out.completed = (s.completed && typeof s.completed === 'object') ? s.completed : {};
    out.contracts = Array.isArray(s.contracts) ? s.contracts.slice(0, 6) : [];
    out.contractSeq = Math.max(1, Math.floor(Number(s.contractSeq) || 1));
    out.tokens = Math.max(0, Math.floor(Number(s.tokens) || 0));
    out.renown = Math.max(0, Math.floor(Number(s.renown) || 0));
    out.contractsDone = Math.max(0, Math.floor(Number(s.contractsDone) || 0));
    out.charms = Array.isArray(s.charms) ? s.charms.filter(function (x) { return typeof x === 'string'; }) : [];
    out.charm = typeof s.charm === 'string' ? s.charm : null;
    if (s.upgrades) {
      UPGRADES.forEach(function (u) {
        var t = Number(s.upgrades[u.id]);
        out.upgrades[u.id] = clamp(isFinite(t) ? Math.floor(t) : 0, 0, u.costs.length - 1);
      });
    }
    if (s.stats) {
      out.stats.casts = Math.max(0, Math.floor(Number(s.stats.casts) || 0));
      out.stats.catches = Math.max(0, Math.floor(Number(s.stats.catches) || 0));
      out.stats.escapes = Math.max(0, Math.floor(Number(s.stats.escapes) || 0));
      out.stats.bestWeight = Math.max(0, Number(s.stats.bestWeight) || 0);
      out.stats.playtime = Math.max(0, Number(s.stats.playtime) || 0);
      out.stats.bestStreak = Math.max(0, Math.floor(Number(s.stats.bestStreak) || 0));
    }
    if (s.settings) {
      out.settings.muted = !!s.settings.muted;
      out.settings.ambience = !!s.settings.ambience;
      out.settings.lure = lureById(s.settings.lure).id;
    }
    out.run = (s.run && typeof s.run === 'object') ? s.run : null;
    out.v = SAVE_VERSION;
    out.finalSeen = !!s.finalSeen;
    return out;
  }

  var save = loadSave();
  var audioReady = false;
  var skipSaveOnUnload = false;

  function saveNow() {
    try {
      save.lastPlayed = Date.now();
      save.v = SAVE_VERSION;
      var json = JSON.stringify(save);
      window.localStorage.setItem(SAVE_KEY, json);
      try { window.localStorage.setItem(SAVE_BACKUP_KEY, json); } catch (e) {}
    } catch (e) { /* private mode / file restrictions */ }
  }

  // Autosave a resumable snapshot of the current expedition. The save file is
  // always JSON, so this rides along in export/import and future releases.
  // One-shot recovery grant used by the ?grant=max URL. It never removes
  // caught/best/completed data; it only raises the floor.
  function grantMaxProgress() {
    var now = Date.now();
    if (!save.startedAt) save.startedAt = now;
    UPGRADES.forEach(function (u) { save.upgrades[u.id] = u.costs.length - 1; });
    save.unlocked = LEVELS.length;
    save.coins = Math.max(save.coins || 0, 5000);
    save.xp = Math.max(save.xp || 0, 5000);
    save.v = SAVE_VERSION;
    saveNow();
    toast('PROGRESS RESTORED · ALL UPGRADES MAX · ALL WATERS OPEN', 'good');
    try { window.history.replaceState(null, '', window.location.pathname + '?v=38'); } catch (e) {}
  }

  function maybeGrantMaxProgress() {
    try {
      if (/(?:^|[?&])grant=max(?:&|$)/.test(window.location.search)) grantMaxProgress();
    } catch (e) {}
  }

  function snapshotRun() {
    if (!state.inLevel || !state.level || state.phase === 'done') {
      save.run = null;
      return;
    }
    var counts = {};
    Object.keys(state.targetCounts || {}).forEach(function (k) { counts[k] = state.targetCounts[k]; });
    save.run = {
      levelId: state.level.id,
      levelIndex: state.level.index,
      casts: state.casts,
      fishLost: state.fishLost,
      quotaCount: state.quotaCount,
      targetCounts: counts,
      runCoins: state.runCoins,
      runXP: state.runXP,
      lureTarget: state.lureTarget,
      feedLayerDepth: state.feedLayer ? state.feedLayer.depth : null,
      streak: state.streak,
      creel: state.creel.map(function (c) {
        return {
          id: c.def.id, weight: c.weight, length: c.length, value: c.value,
          xp: c.xp, depth: c.depth, newBest: !!c.newBest,
          target: !!c.target, bestiaryNew: !!c.bestiaryNew, streak: c.streak || 0
        };
      })
    };
  }

  function clearRun() {
    save.run = null;
  }

  function autosaveRun() {
    snapshotRun();
    saveNow();
  }

  // ------------------------------------------------------------------ state
  var state = {
    inLevel: false, paused: false, screen: null,
    level: null, phase: 'idle',
    casts: 0, fishLost: 0, quotaCount: 0, targetCounts: {},
    creel: [], runCoins: 0, runXP: 0,
    pendingCatch: null, landingTimer: 0, lostTimer: 0,
    chargeT: 0, chargePower: 0, castDistance: 0, castTimer: 0,
    lureDepth: 0, lureTarget: 6,
    school: { dist: 20, depth: 10 },
    biteMeter: 0, biteCooldown: 0, biteWindow: 0, pendingFish: null,
    actionHeld: false, giveLine: false, jigBoost: 0, jigCooldown: 0, jigFx: 0,
    feedLayer: { depth: 8, timer: 14, dir: 1 },
    streak: 0, bestStreak: 0,
    fight: { active: false, def: null, weight: 0, length: 1, depth: 0, startDepth: 0, tension: 0, tensionMax: 100, stamina: 1, time: 0, surge: false, surgeTimer: 0, surgeDur: 0, danger: 0, reelSpeed: 5, sfxTick: 0, alarm: 0 },
    sonarBlips: [], sonarTimer: 0, sonarTierShown: -1,
    result: null, helpReturn: 'title',
    playAccum: 0, sfxCooldown: 0,
    saveTimer: 0
  };

  var ui = {};

  function cacheUi() {
    [
      'scene', 'hud', 'boot', 'overlay', 'flash', 'btn-pause', 'hud-level-name', 'hud-level-sub',
      'quota', 'hud-coins', 'btn-mute', 'toasts', 'sonar-panel', 'sonar', 'sonar-tier', 'sonar-hint',
      'school-hint', 'school-dist', 'depth-control', 'depth-max', 'feed-layer', 'btn-recall', 'lure-row', 'scan-line', 'depth-down', 'lure-depth', 'depth-up',
      'depth-slider', 'depth-bands', 'prompt', 'cast-meter', 'cast-fill', 'cast-target', 'cast-power',
      'cast-range', 'fight', 'fight-rarity', 'fight-name', 'fight-weight', 'fight-behavior', 'fight-depth', 'fight-timer',
      'tension-val', 'tension-fill', 'safe-zone', 'stamina-val', 'stamina-fill', 'fight-status',
      'depth-ticks', 'fish-marker', 'surge-warning', 'pip', 'pip-depth', 'btn-give', 'btn-action',
      'screen-title', 'btn-continue', 'btn-new', 'btn-help', 'title-save',
      'screen-harbor', 'harbor-coins', 'harbor-rank', 'harbor-xp', 'level-list', 'fishing-log',
      'shop-coins', 'shop-list', 'captain-card', 'btn-resume-run', 'save-note', 'btn-bestiary', 'bestiary-count', 'btn-help2',
      'btn-mute2', 'btn-quit', 'btn-ambience', 'btn-bounties', 'bounty-badge', 'screen-bounties', 'bounty-list', 'charm-list', 'bounty-renown', 'bounty-title', 'bounty-tokens', 'bounty-done', 'bounty-streak',
      'screen-bestiary', 'bestiary-progress', 'bestiary-grid',
      'screen-help', 'screen-pause', 'pause-stats', 'btn-resume', 'btn-pause-help', 'btn-pause-sound',
      'btn-pause-ambience', 'btn-pause-harbor', 'screen-catch', 'catch-dialog', 'catch-kicker', 'catch-name', 'catch-rarity',
      'catch-depth', 'catch-length', 'catch-weight', 'catch-badges', 'catch-desc', 'catch-value',
      'btn-catch-ok', 'screen-results', 'result-kicker', 'result-title', 'result-stars', 'result-stats',
      'result-coins', 'result-note', 'btn-next-level', 'btn-replay', 'btn-result-harbor',
      'btn-export-save', 'btn-import-save', 'save-file',
      'screen-final', 'final-stats', 'btn-final-harbor'
    ].forEach(function (id) {
      var key = id.replace(/-([a-z])/g, function (m, c) { return c.toUpperCase(); });
      ui[key] = $(id);
    });
    ui.tensionTrack = ui.tensionFill ? ui.tensionFill.parentElement : null;
    if (ui.sonar) ui.sonarCtx = ui.sonar.getContext('2d');
  }

  // ------------------------------------------------------------------ audio
  function lureById(id) {
    var pool = (window.GAME_DATA && window.GAME_DATA.LURES) || [];
    for (var i = 0; i < pool.length; i++) if (pool[i].id === id) return pool[i];
    return pool[0] || { id: 'minnow', name: 'Silver Minnow', short: 'MINNOW', icon: '◆', tint: '#cfe8ff', sink: 1, bite: 1, rare: 0, layer: 1, desc: '' };
  }

  function currentLure() {
    return lureById(save.settings && save.settings.lure);
  }

  function ensureAudio() {
    if (!window.AudioKit) return;
    if (!audioReady) {
      try {
        window.AudioKit.init();
        window.AudioKit.setMuted(!!save.settings.muted);
        if (window.AudioKit.setAmbientEnabled) window.AudioKit.setAmbientEnabled(!!save.settings.ambience);
        audioReady = true;
      } catch (e) { audioReady = true; }
    }
    try { window.AudioKit.resume(); } catch (e) {}
  }
  function sfx(name) {
    var a = window.AudioKit;
    if (!a || !audioReady) return;
    var args = Array.prototype.slice.call(arguments, 1);
    try { if (typeof a[name] === 'function') a[name].apply(a, args); } catch (e) {}
  }
  function setTheme(name) {
    if (!window.AudioKit) return;
    try { window.AudioKit.setTheme(name); } catch (e) {}
  }
  function unlockAudio() { ensureAudio(); }
  window.addEventListener('pointerdown', unlockAudio, { once: true });
  window.addEventListener('keydown', unlockAudio, { once: true });

  // ------------------------------------------------------------------ helpers
  function castRange() {
    return state.level.castRange + tier('rod') * 4;
  }
  function schoolWindow() {
    return 3 + tier('rod') * 0.8;
  }
  function tier(id) {
    var u = null;
    for (var i = 0; i < UPGRADES.length; i++) if (UPGRADES[i].id === id) u = UPGRADES[i];
    if (!u) return 0;
    return clamp(save.upgrades[id] || 0, 0, u.costs.length - 1);
  }
  function rankInfo(xp) {
    var idx = 0;
    for (var i = 0; i < RANKS.length; i++) if (xp >= RANKS[i].xp) idx = i;
    var cur = RANKS[idx];
    var next = RANKS[idx + 1] || null;
    var pct = next ? clamp((xp - cur.xp) / Math.max(1, next.xp - cur.xp) * 100, 0, 100) : 100;
    return { index: idx, name: cur.name, next: next, pct: pct };
  }
  function bestiaryCount() { return Object.keys(save.caught).filter(function (k) { return save.caught[k] && save.caught[k].count > 0; }).length; }
  function bestCatch() {
    var bestW = 0, bestId = null;
    Object.keys(save.best).forEach(function (id) {
      var w = Number(save.best[id]) || 0;
      if (w > bestW) { bestW = w; bestId = id; }
    });
    if (!bestId || !FISH[bestId]) return null;
    return { def: FISH[bestId], weight: bestW };
  }
  function levelById(id) {
    for (var i = 0; i < LEVELS.length; i++) if (LEVELS[i].id === id) return LEVELS[i];
    return null;
  }
  var CHARMS = [
    { id: 'storm', name: 'Stormglass', icon: '✦', cost: 3, desc: 'Rare fish are 20% more likely during storms and dusk.' },
    { id: 'tide', name: 'Tidekeeper', icon: '≈', cost: 4, desc: 'The feeding layer drifts 35% slower, giving you more time to read it.' },
    { id: 'ember', name: 'Ember Streak', icon: '◆', cost: 4, desc: 'Streak coin bonus cap rises from +25% to +35%.' }
  ];

  var RENOWN_TIERS = [
    { at: 0, name: 'Contract Hand' },
    { at: 12, name: 'Bounty Runner' },
    { at: 30, name: 'Storm Broker' },
    { at: 60, name: 'Abyss Factor' },
    { at: 100, name: 'Ridge Broker' }
  ];

  function charmById(id) {
    for (var i = 0; i < CHARMS.length; i++) if (CHARMS[i].id === id) return CHARMS[i];
    return null;
  }
  function renownInfo() {
    var idx = 0;
    for (var i = 0; i < RENOWN_TIERS.length; i++) if (save.renown >= RENOWN_TIERS[i].at) idx = i;
    var cur = RENOWN_TIERS[idx];
    var next = RENOWN_TIERS[idx + 1] || null;
    return { index: idx, name: cur.name, next: next, pct: next ? clamp((save.renown - cur.at) / Math.max(1, next.at - cur.at) * 100, 0, 100) : 100 };
  }
  function streakCap() { return save.charm === 'ember' ? 0.35 : 0.25; }
  function layerTimer() {
    var base = rand(12, 20);
    return save.charm === 'tide' ? base * 1.5 : base;
  }
  function unlockedFishIds() {
    var out = [];
    LEVELS.forEach(function (lv) {
      if (lv.index > save.unlocked) return;
      lv.species.forEach(function (id) { if (FISH[id]) out.push(id); });
    });
    return out;
  }
  function makeBounty() {
    var seq = save.contractSeq++;
    var pool = unlockedFishIds();
    var roll = Math.random();
    var c = { id: 'b' + seq, have: 0, need: 1, tokens: 1, renown: 8 };
    if (roll < 0.34 && pool.length) {
      var id = pool[Math.floor(Math.random() * pool.length)];
      var def = FISH[id];
      var rarityNeed = def.rarity === 'common' ? 3 : def.rarity === 'uncommon' ? 2 : 1;
      c.type = 'species';
      c.fishId = id;
      c.need = rarityNeed;
      c.tokens = def.rarity === 'common' || def.rarity === 'uncommon' ? 1 : 2;
      c.renown = 8 + def.level * 3;
    } else if (roll < 0.55 && pool.length) {
      var wid = pool[Math.floor(Math.random() * pool.length)];
      var wdef = FISH[wid];
      var target = wdef.weight[0] + (wdef.weight[1] - wdef.weight[0]) * (0.66 + Math.random() * 0.20);
      c.type = 'weight';
      c.fishId = wid;
      c.target = Math.round(target * 10) / 10;
      c.need = 1;
      c.tokens = 2;
      c.renown = 16;
    } else if (roll < 0.72) {
      var maxDepth = LEVELS[Math.max(0, save.unlocked - 1)].depthMax;
      var thresholds = [50, 80, 110].filter(function (d) { return d < maxDepth * 0.95; });
      var depth = thresholds.length ? thresholds[Math.floor(Math.random() * thresholds.length)] : 40;
      c.type = 'deep';
      c.depth = depth;
      c.need = 2;
      c.tokens = 1;
      c.renown = 12;
    } else if (roll < 0.87) {
      c.type = 'clean';
      c.need = 4;
      c.tokens = 2;
      c.renown = 14;
    } else {
      c.type = 'any';
      c.need = 5;
      c.tokens = 1;
      c.renown = 7;
    }
    return c;
  }

  function bountyKind(c) {
    return c.type === 'species' ? 'SPECIES ORDER' : c.type === 'weight' ? 'WEIGHT HUNT' : c.type === 'deep' ? 'DEEP ORDER' : c.type === 'clean' ? 'CLEAN RUN' : 'CATCH ORDER';
  }
  function bountyTitle(c) {
    if (!c || !c.type) return 'UNKNOWN CONTRACT';
    if (c.type === 'species') return 'LAND ' + c.need + ' × ' + (FISH[c.fishId] ? FISH[c.fishId].name : 'FISH');
    if (c.type === 'weight') return 'LAND A ' + (FISH[c.fishId] ? FISH[c.fishId].name : 'FISH') + ' OVER ' + c.target + ' KG';
    if (c.type === 'deep') return 'LAND ' + c.need + ' FISH BELOW ' + c.depth + ' M';
    if (c.type === 'clean') return 'LAND ' + c.need + ' FISH WITHOUT LOSING ONE';
    return 'LAND ' + c.need + ' FISH';
  }
  function bountyDone(c) { return !!c && c.have >= c.need; }
  function bountyNext() {
    if (!Array.isArray(save.contracts)) return null;
    for (var i = 0; i < save.contracts.length; i++) if (!bountyDone(save.contracts[i])) return save.contracts[i];
    return null;
  }
  function ensureBounties() {
    if (!Array.isArray(save.contracts)) save.contracts = [];
    save.contracts = save.contracts.filter(function (c) { return c && typeof c.type === 'string' && typeof c.need === 'number'; }).slice(0, 3);
    while (save.contracts.length < 3) save.contracts.push(makeBounty());
    save.contracts.forEach(function (c) {
      c.have = clamp(Math.floor(Number(c.have) || 0), 0, Math.max(1, Math.floor(Number(c.need) || 1)));
      c.need = Math.max(1, Math.floor(Number(c.need) || 1));
      c.tokens = Math.max(1, Math.floor(Number(c.tokens) || 1));
      c.renown = Math.max(1, Math.floor(Number(c.renown) || 1));
    });
    if (save.charm && !charmById(save.charm)) save.charm = null;
    if (!Array.isArray(save.charms)) save.charms = [];
  }
  function bountyCatch(c) {
    var completed = [];
    if (!Array.isArray(save.contracts)) return;
    save.contracts.forEach(function (b) {
      if (!b || bountyDone(b)) return;
      var hit = false;
      if (b.type === 'species') hit = b.fishId === c.def.id;
      else if (b.type === 'any' || b.type === 'clean') hit = true;
      else if (b.type === 'weight') hit = c.weight >= b.target;
      else if (b.type === 'deep') hit = c.depth >= b.depth;
      if (hit) {
        b.have = Math.min(b.need, b.have + 1);
        if (bountyDone(b)) completed.push(b);
      }
    });
    completed.forEach(function (b) {
      window.setTimeout(function () { toast('BOUNTY COMPLETE · ' + bountyTitle(b), 'good'); }, 600);
    });
  }
  function bountyLoss() {
    if (!Array.isArray(save.contracts)) return;
    save.contracts.forEach(function (b) { if (b && b.type === 'clean') b.have = 0; });
  }

  function toast(text, kind) {
    if (!ui.toasts) return;
    var el = document.createElement('div');
    el.className = 'toast' + (kind ? ' ' + kind : '');
    el.textContent = text;
    ui.toasts.appendChild(el);
    while (ui.toasts.children.length > 3) ui.toasts.removeChild(ui.toasts.firstChild);
    window.setTimeout(function () {
      if (el.parentNode) el.parentNode.removeChild(el);
    }, 3400);
  }
  function setPrompt(main, sub, warn) {
    if (!ui.prompt) return;
    var html = main || '';
    if (sub) html += '<span class="sub">' + sub + '</span>';
    if (ui.prompt.innerHTML !== html) ui.prompt.innerHTML = html;
    ui.prompt.classList.toggle('warn', !!warn);
  }
  function showHudPanels() {}

  // ------------------------------------------------------------------ init
  function init() {
    cacheUi();
    maybeGrantMaxProgress();
    ensureBounties();
    if (save.startedAt) saveNow();
    if (!window.THREE || !window.World) {
      if (ui.boot) {
        var b = ui.boot.querySelector('.boot-sub');
        if (b) b.textContent = 'The 3D engine failed to load. Check vendor/three.min.js.';
      }
      return;
    }
    try {
      window.World.init(ui.scene);
      window.World.setLevel(LEVELS[0]);
      window.World.setMode('title');
    } catch (e) {
      console.error(e);
      if (ui.boot) {
        var b2 = ui.boot.querySelector('.boot-sub');
        if (b2) b2.textContent = 'WebGL could not start on this device.';
      }
      return;
    }
    if ('ontouchstart' in window || (navigator.maxTouchPoints && navigator.maxTouchPoints > 0)) {
      document.body.classList.add('touch');
    }
    bindEvents();
    renderTitle();
    showScreen('title');
    setTheme('day');
    updateSoundUi();
    if (ui.boot) window.setTimeout(function () { ui.boot.classList.add('gone'); }, 650);
    window.setTimeout(function () { if (ui.boot) ui.boot.classList.add('gone'); }, 2600);
    started = true;
    requestAnimationFrame(loop);
  }

  // ------------------------------------------------------------------ main loop
  var started = false;
  var lastFrame = 0;
  function loop(now) {
    requestAnimationFrame(loop);
    if (!started) return;
    if (!lastFrame) lastFrame = now;
    var dt = Math.min(0.05, Math.max(0, (now - lastFrame) / 1000));
    lastFrame = now;
    if (state.inLevel && !state.paused && state.screen === null) updateGame(dt);
    try { window.World.render(dt); } catch (e) { /* keep the loop alive */ }
    if (state.inLevel && !state.paused && state.screen === null) {
      state.playAccum += dt;
      if (state.playAccum > 20) {
        save.stats.playtime += state.playAccum;
        state.playAccum = 0;
        saveNow();
      }
    }
  }

  function updateGame(dt) {
    state.sfxCooldown = Math.max(0, state.sfxCooldown - dt);
    state.saveTimer = (state.saveTimer || 0) + dt;
    if (state.saveTimer > 8) {
      state.saveTimer = 0;
      autosaveRun();
    }
    switch (state.phase) {
      case 'charging': updateCharging(dt); break;
      case 'casting': updateCasting(dt); break;
      case 'waiting': updateWaiting(dt); break;
      case 'bite': updateBite(dt); break;
      case 'fighting': updateFight(dt); break;
      case 'landing': updateLanding(dt); break;
      case 'lost': updateLost(dt); break;
    }
    if (state.phase === 'waiting' || state.phase === 'bite' || state.phase === 'idle') {
      state.sonarTimer -= dt;
      if (state.sonarTimer <= 0) { state.sonarTimer = 0.12; drawSonar(); }
    }
  }

  // ------------------------------------------------------------------ phase switching
  function setPhase(p) {
    state.phase = p;
    var fighting = p === 'fighting';
    if (ui.fight) ui.fight.classList.toggle('hidden', !fighting);
    if (ui.pip) ui.pip.classList.toggle('hidden', !fighting);
    if (ui.sonarPanel) ui.sonarPanel.classList.toggle('hidden', !(p === 'idle' || p === 'waiting' || p === 'bite' || p === 'charging'));
    if (ui.depthControl) ui.depthControl.classList.toggle('hidden', !(p === 'idle' || p === 'waiting' || p === 'bite'));
    if (ui.castMeter) ui.castMeter.classList.toggle('hidden', p !== 'charging');
    if (ui.schoolHint) ui.schoolHint.classList.toggle('hidden', !(p === 'idle' || p === 'waiting' || p === 'bite'));
    if (ui.btnAction) ui.btnAction.classList.toggle('jig-ready', p === 'waiting' && state.jigCooldown <= 0);
    if (ui.btnRecall) ui.btnRecall.classList.toggle('hidden', p !== 'waiting');
    if (ui.surgeWarning) ui.surgeWarning.classList.add('hidden');
    if (ui.btnAction) {
      ui.btnAction.textContent = p === 'idle' ? 'CAST' : p === 'charging' ? 'RELEASE' : p === 'waiting' ? 'JIG' : p === 'bite' ? 'STRIKE!' : p === 'fighting' ? 'REEL' : p === 'landing' ? 'LANDED' : 'REEL';
    }
    if (ui.btnGive) ui.btnGive.classList.toggle('hidden', p !== 'fighting');
    if (p !== 'fighting') {
      if (ui.fight) ui.fight.classList.add('hidden');
      if (ui.pip) ui.pip.classList.add('hidden');
      if (state.fight) state.fight.active = p === 'landing' ? false : state.fight.active;
      state.actionHeld = false;
      state.giveLine = false;
    }
    var touch = document.body.classList.contains('touch');
    if (p === 'idle') {
      setPrompt(touch ? 'HOLD THE CAST BUTTON TO CHARGE' : 'HOLD LMB / SPACE TO CHARGE A CAST', schoolText() + ' · LAND WITHIN 3 M');
      if (ui.depthControl) ui.depthControl.classList.remove('hidden');
    } else if (p === 'charging') {
      setPrompt('RELEASE TO CAST', 'THE POWER BAR MARKS THE SCHOOL');
    } else if (p === 'casting') {
      setPrompt('WATCH THE WATER', '');
    } else if (p === 'waiting') {
      setPrompt('WAIT FOR THE BITE', waitText());
    } else if (p === 'bite') {
      setPrompt('STRIKE!', touch ? 'TAP STRIKE NOW' : 'CLICK / SPACE NOW', true);
    } else if (p === 'fighting') {
      if (ui.prompt) ui.prompt.style.display = 'none';
    } else if (p === 'landing') {
      setPrompt('LANDED', 'BRINGING IT ABOARD');
    } else if (p === 'lost') {
      setPrompt('THE LINE IS GONE', 'RESETTING THE ROD');
    } else if (p === 'done') {
      if (ui.prompt) ui.prompt.style.display = 'none';
    }
    if (p !== 'fighting' && p !== 'done' && ui.prompt) ui.prompt.style.display = '';
    if (ui.depthControl) ui.depthControl.classList.toggle('hidden', !(p === 'idle' || p === 'waiting' || p === 'bite'));
  }

  function schoolText() {
    if (!state.school) return 'SCHOOL —';
    var s = 'SCHOOL ' + state.school.dist + ' M';
    if (tier('sonar') >= 1) s += ' · ' + state.school.depth + ' M DEEP';
    return s;
  }
  function waitText() {
    var cur = Math.round(state.lureDepth);
    var tgt = Math.round(state.lureTarget);
    var sink = Math.abs(state.lureDepth - state.lureTarget) > 1.2 ? 'SINKING' : 'READY';
    var layer = state.feedLayer ? Math.round(state.feedLayer.depth) : 0;
    var jig = state.jigCooldown > 0 ? 'JIG COOLDOWN' : 'JIG TO STIR';
    return 'LURE ' + cur + ' M · LAYER ' + layer + ' M · ' + sink + ' · ' + jig;
  }

  // ------------------------------------------------------------------ level flow
  function startLevel(index) {
    var lv = LEVELS[index - 1];
    if (!lv) return;
    if (index > save.unlocked) { toast('THAT WATER IS NOT OPEN YET', 'bad'); return; }
    ensureAudio();
    state.level = lv;
    state.inLevel = true;
    state.paused = false;
    state.phase = 'idle';
    state.casts = 0;
    state.fishLost = 0;
    state.quotaCount = 0;
    state.targetCounts = {};
    state.creel = [];
    state.runCoins = 0;
    state.runXP = 0;
    state.pendingCatch = null;
    state.biteMeter = 0;
    state.biteCooldown = 1.0;
    state.biteWindow = 0;
    state.pendingFish = null;
    state.chargeT = 0;
    state.chargePower = 0;
    state.castTimer = 0;
    state.actionHeld = false;
    state.giveLine = false;
    state.jigBoost = 0;
    state.jigCooldown = 0;
    state.jigFx = 0;
    state.streak = 0;
    state.saveTimer = 0;
    state.feedLayer = newFeedLayer(lv);
    state.fight = { active: false, def: null, weight: 0, length: 1, depth: 0, startDepth: 0, tension: 0, tensionMax: 100 + tier('line') * 12, stamina: 1, time: 0, surge: false, surgeTimer: 0, surgeDur: 0, danger: 0, reelSpeed: 5.2 * (1 + 0.18 * tier('reel')), sfxTick: 0, alarm: 0, behavior: 'steady' };
    state.lureTarget = Math.max(2, Math.round(lv.depthMax * 0.3));
    state.lureDepth = 0;
    state.sonarBlips = buildSonarBlips(lv);
    state.sonarTierShown = -1;
    state.result = null;
    save.run = null;

    window.World.setLevel(lv);
    window.World.setMode('fishing');
    window.World.reset();
    window.World.clearFish();
    spawnSchool(false);
    window.World.setLureDepth(0, state.lureTarget);

    if (ui.depthSlider) {
      ui.depthSlider.max = String(lv.depthMax);
      ui.depthSlider.value = String(state.lureTarget);
    }
    renderDepthBands();
    updateSonarHint();
    renderDepthTicks(lv);
    renderHud();
    renderQuota();
    updateDepthReadout();
    renderFeedLayer();
    renderLureBox();
    renderScanLine();
    setPhase('idle');
    hideScreens();
    if (ui.hud) ui.hud.classList.remove('hidden');
    drawSonar();
    setTheme(THEMES[(lv.index - 1) % THEMES.length]);
    var targetNames = lv.quota.targets.map(function (t) { return FISH[t.id].name; }).join(' + ');
    toast(lv.name.toUpperCase() + ' · ' + lv.quota.total + ' FISH' + (targetNames ? ' · ' + targetNames : ''), '');
    save.lastPlayed = Date.now();
    snapshotRun();
    saveNow();
  }

  function newFeedLayer(lv) {
    var def = FISH[lv.species[Math.floor(Math.random() * lv.species.length)]];
    var d = rand(def.depth[0], def.depth[1]);
    return {
      depth: Math.round(clamp(d, 1, lv.depthMax)),
      timer: layerTimer(),
      dir: Math.random() < 0.5 ? -1 : 1
    };
  }

  function moveFeedLayer() {
    var layer = state.feedLayer;
    if (!layer || !state.level) return;
    layer.depth += layer.dir * rand(2, 5);
    var lo = Math.max(2, state.level.depthMax * 0.12);
    var hi = state.level.depthMax * 0.92;
    if (layer.depth < lo || layer.depth > hi) { layer.dir *= -1; layer.depth = clamp(layer.depth, lo, hi); }
    layer.depth = Math.round(layer.depth);
    layer.timer = layerTimer();
    renderFeedLayer();
    drawSonar();
    toast('THE FEEDING LAYER MOVED · ' + layer.depth + ' M', '');
  }

  function renderFeedLayer() {
    if (!ui.feedLayer) return;
    if (!state.level || !state.feedLayer) { ui.feedLayer.textContent = 'FEEDING LAYER —'; return; }
    var close = Math.abs(state.lureTarget - state.feedLayer.depth) <= 3.5;
    ui.feedLayer.innerHTML = 'FEEDING LAYER <b>' + Math.round(state.feedLayer.depth) + ' M</b>' + (close ? ' <em>IN THE LAYER</em>' : '');
    ui.feedLayer.classList.toggle('hot', close);
  }

  function fishBehavior(def) {
    if (def.behavior) return def.behavior;
    if (def.shape === 'eel') return 'diver';
    if (def.shape === 'shark') return 'runner';
    if (def.agility >= 0.75) return 'thrasher';
    if (def.power >= 3) return 'deadweight';
    return 'steady';
  }

  function behaviorLabel(b) {
    return b === 'diver' ? 'DIVER' : b === 'runner' ? 'RUNNER' : b === 'thrasher' ? 'THRASHER' : b === 'deadweight' ? 'DEADWEIGHT' : 'STEADY';
  }

  function renderLureBox() {
    if (!ui.lureRow) return;
    var pool = (window.GAME_DATA && window.GAME_DATA.LURES) || [];
    var active = currentLure().id;
    ui.lureRow.innerHTML = pool.map(function (l) {
      return '<button type="button" class="lure-btn' + (l.id === active ? ' active' : '') + '" data-lure="' + l.id + '" style="--lure:' + l.tint + '" title="' + l.desc + '"><span class="lure-icon">' + l.icon + '</span>' + l.short + '</button>';
    }).join('');
  }

  function selectLure(id) {
    var lure = lureById(id);
    if (!lure || !lure.id) return;
    if (save.settings.lure === lure.id) return;
    save.settings.lure = lure.id;
    saveNow();
    renderLureBox();
    toast('LURE · ' + lure.name.toUpperCase(), '');
    sfx('ui');
  }

  function renderScanLine() {
    if (!ui.scanLine || !state.level) return;
    var t = tier('sonar');
    var at = speciesAtTarget(1);
    var depth = Math.round(state.lureTarget);
    if (t < 1) {
      ui.scanLine.textContent = 'BAND ' + depth + ' M · SONAR OFFLINE';
      return;
    }
    if (t < 2) {
      var seen = {};
      at.forEach(function (f) { seen[f.rarity] = true; });
      var rar = Object.keys(seen).map(function (r) { return r.toUpperCase(); }).join(' / ');
      ui.scanLine.textContent = at.length ? at.length + ' FISH IN BAND · ' + rar : 'NO FISH IN BAND · MOVE THE LURE';
      return;
    }
    if (!at.length) { ui.scanLine.textContent = 'NO FISH IN BAND · MOVE THE LURE'; return; }
    at.sort(function (a, b) { return RARITY_WEIGHT[b.rarity] - RARITY_WEIGHT[a.rarity]; });
    var names = at.slice(0, 3).map(function (f) {
      return '<span style="color:' + RARITY_SONAR[f.rarity] + '">' + f.name + '</span>';
    });
    if (at.length > 3) names.push('+' + (at.length - 3));
    ui.scanLine.innerHTML = 'BAND ' + depth + ' M · ' + names.join(' · ');
  }

  function jig() {
    if (state.phase !== 'waiting') return;
    if (state.jigCooldown > 0) {
      state.jigCooldown = 1.2;
      state.biteCooldown = Math.max(state.biteCooldown, 1.4);
      state.biteMeter = 0;
      sfx('miss');
      toast('YOU SPOOKED THEM — LET IT SETTLE', 'bad');
      return;
    }
    state.jigCooldown = 1.0;
    state.jigBoost = 1.0;
    state.jigFx = 0.5;
    state.biteMeter = Math.min(0.92, state.biteMeter + 0.06);
    window.World.jig();
    sfx('splash', 0.22);
  }

  function spawnSchool(notify) {
    var lv = state.level;
    var maxR = castRange();
    var d = rand(10, Math.max(12, maxR - 3));
    if (state.lastSchoolDist && Math.abs(d - state.lastSchoolDist) < 5) d = clamp(d + 8, 10, maxR - 2);
    state.lastSchoolDist = d;
    var def = FISH[lv.species[Math.floor(Math.random() * lv.species.length)]];
    var depth = rand(def.depth[0], def.depth[1]);
    state.school = { dist: Math.round(d), depth: Math.round(depth) };
    window.World.showSchool(state.school.dist, state.school.depth);
    if (notify) toast('THE SCHOOL MOVED', '');
    if (ui.schoolDist) {
      ui.schoolDist.textContent = state.school.dist + ' m' + (tier('sonar') >= 1 ? ' · ' + state.school.depth + ' m deep' : '');
    }
  }

  function beginNextCast() {
    state.pendingCatch = null;
    state.landingTimer = 0;
    state.lostTimer = 0;
    window.World.clearFish();
    window.World.setMode('fishing');
    window.World.reset();
    state.lureDepth = 0;
    state.biteMeter = 0;
    state.biteCooldown = 1.0;
    state.jigBoost = 0;
    state.jigCooldown = 0.6;
    spawnSchool(true);
    state.actionHeld = false;
    state.giveLine = false;
    setPhase('idle');
    renderHud();
    renderQuota();
    drawSonar();
    autosaveRun();
  }

  // ------------------------------------------------------------------ casting
  function startCharge() {
    if (state.phase !== 'idle') return;
    state.chargeT = 0;
    state.chargePower = 0;
    setPhase('charging');
    if (ui.castFill) ui.castFill.style.width = '0%';
  }

  function updateCharging(dt) {
    state.chargeT += dt;
    var p = clamp(state.chargeT / 1.15, 0, 1);
    state.chargePower = p;
    window.World.setCharge(p);
    if (ui.castFill) ui.castFill.style.width = (p * 100).toFixed(1) + '%';
    if (ui.castPower) ui.castPower.textContent = Math.round(p * 100) + '%';
    var dist = 7 + p * (castRange() - 7);
    if (ui.castRange) ui.castRange.textContent = Math.round(dist) + ' m';
    var tx = clamp((state.school.dist - 7) / Math.max(1, castRange() - 7), 0, 1) * 100;
    if (ui.castTarget) { ui.castTarget.style.display = 'block'; ui.castTarget.style.left = tx.toFixed(1) + '%'; }
  }

  function releaseCast() {
    if (state.phase !== 'charging') return;
    var p = state.chargePower;
    if (p < 0.035) {
      cancelCharge();
      return;
    }
    var dist = 7 + p * (castRange() - 7);
    state.castDistance = dist;
    state.casts++;
    save.stats.casts++;
    state.lureDepth = 0;
    state.castTimer = 0;
    state.biteMeter = 0;
    state.biteCooldown = 0.8;
    window.World.setCharge(0);
    window.World.cast(dist, onCastLanded);
    setPhase('casting');
    sfx('cast');
    state.actionHeld = false;
    autosaveRun();
  }

  function cancelCharge() {
    window.World.setCharge(0);
    state.chargeT = 0;
    state.chargePower = 0;
    if (ui.castTarget) ui.castTarget.style.display = 'none';
    setPhase('idle');
  }

  function onCastLanded() {
    if (!state.inLevel) return;
    state.castTimer = 0;
    setPhase('waiting');
    sfx('splash', 0.55);
    var near = Math.abs(state.castDistance - state.school.dist) <= schoolWindow();
    toast(near ? 'ON THE SCHOOL · DOUBLE BITES' : 'CAST LANDED · ' + Math.round(state.castDistance) + ' M', near ? 'good' : '');
    if (near) sfx('ui');
    state.biteCooldown = 0.5;
    autosaveRun();
  }

  function updateCasting(dt) {
    state.castTimer += dt;
    if (state.castTimer > 2.4) onCastLanded();
  }

  // ------------------------------------------------------------------ waiting & bite
  function updateWaiting(dt) {
    var sinkRate = (8 + state.level.index * 2.6) * currentLure().sink;
    if (state.lureDepth < state.lureTarget) state.lureDepth = Math.min(state.lureTarget, state.lureDepth + sinkRate * dt);
    else if (state.lureDepth > state.lureTarget) state.lureDepth = Math.max(state.lureTarget, state.lureDepth - sinkRate * dt);
    window.World.setLureDepth(state.lureDepth, state.lureTarget);
    state.biteCooldown = Math.max(0, state.biteCooldown - dt);
    state.jigCooldown = Math.max(0, state.jigCooldown - dt);
    state.jigBoost = Math.max(0, state.jigBoost - dt);
    state.jigFx = Math.max(0, state.jigFx - dt);
    state.feedLayer.timer -= dt;
    if (state.feedLayer.timer <= 0) moveFeedLayer();
    updateDepthReadout();
    renderFeedLayer();
    setPrompt('WAIT FOR THE BITE', waitText());
    if (state.biteCooldown > 0 || Math.abs(state.lureDepth - state.lureTarget) > 1.6) return;

    var candidates = depthCandidates();
    if (!candidates.length) {
      state.biteMeter += dt * 0.012;
    } else {
      var near = Math.abs(state.castDistance - state.school.dist) <= schoolWindow();
      var inLayer = Math.abs(state.lureDepth - state.feedLayer.depth) <= 3.5;
      var lure = currentLure();
      var layerMul = inLayer ? lure.layer : (lure.id === 'jig' ? 0.82 : 1.0);
      var rate = 0.20 * (1 + 0.12 * tier('lure')) * (near ? 2.0 : 1.0) * layerMul * lure.bite * (state.jigBoost > 0 ? 1.5 : 1.0);
      if (lure.id === 'glow' && (state.level.time === 'night' || state.level.time === 'dusk')) rate *= 1.12;
      state.biteMeter += dt * rate;
    }
    if (state.biteMeter >= 1) {
      state.biteMeter = 0;
      var fish = pickCandidate(candidates.length ? candidates : speciesAtDepth(8));
      if (fish) triggerBite(fish);
    }
  }

  function speciesAtDepth(margin) {
    var out = [];
    state.level.species.forEach(function (id) {
      var f = FISH[id];
      if (f.depth[0] - margin <= state.lureDepth && f.depth[1] + margin >= state.lureDepth) out.push(f);
    });
    return out;
  }

  function speciesAtTarget(margin) {
    var out = [];
    if (!state.level) return out;
    state.level.species.forEach(function (id) {
      var f = FISH[id];
      if (f.depth[0] - margin <= state.lureTarget && f.depth[1] + margin >= state.lureTarget) out.push(f);
    });
    return out;
  }

  function depthCandidates() {
    var out = [];
    state.level.species.forEach(function (id) {
      var f = FISH[id];
      if (f.depth[0] - 2.5 <= state.lureDepth && f.depth[1] + 2.5 >= state.lureDepth) out.push(f);
    });
    return out;
  }

  function targetNeeds(id) {
    var targets = state.level.quota.targets;
    for (var i = 0; i < targets.length; i++) {
      if (targets[i].id === id && (state.targetCounts[id] || 0) < targets[i].count) return true;
    }
    return false;
  }

  function pickCandidate(list) {
    if (!list.length) return null;
    var weights = [];
    var total = 0;
    var lure = currentLure();
    list.forEach(function (f) {
      var w = RARITY_WEIGHT[f.rarity] || 1;
      if (targetNeeds(f.id)) w *= (f.rarity === 'legendary' ? 7 : f.rarity === 'epic' ? 5 : 3);
      if (f.rarity !== 'common') w *= (1 + tier('lure') * 0.12) * (1 + lure.rare);
      if (save.charm === 'storm' && f.rarity !== 'common' && (state.level.weather === 'storm' || state.level.time === 'dusk')) w *= 1.2;
      else w *= Math.max(0.35, 1 - (lure.rare || 0) * 0.35);
      var mid = (f.depth[0] + f.depth[1]) / 2;
      var span = Math.max(6, (f.depth[1] - f.depth[0]) / 2);
      var close = 1 - Math.min(1, Math.abs(state.lureDepth - mid) / span);
      w *= 0.7 + 0.6 * close;
      if (state.feedLayer && f.depth[0] - 3 <= state.feedLayer.depth && f.depth[1] + 3 >= state.feedLayer.depth) w *= 1.18;
      weights.push(w);
      total += w;
    });
    return shufflePick(list, total, weights);
  }

  function triggerBite(fish) {
    if (state.phase !== 'waiting') return;
    state.pendingFish = fish;
    state.biteWindow = 1.3;
    window.World.bite();
    sfx('bite');
    setPhase('bite');
    state.biteMeter = 0;
  }

  function updateBite(dt) {
    state.biteWindow -= dt;
    if (state.biteWindow <= 0) missedBite();
  }

  function missedBite() {
    state.pendingFish = null;
    window.World.endBite();
    state.streak = 0;
    setPhase('waiting');
    state.biteCooldown = 2.3;
    state.biteMeter = 0;
    sfx('miss');
    toast('IT TOOK THE BAIT · STREAK LOST', 'bad');
    renderQuota();
  }

  function strike() {
    if (state.phase !== 'bite' || !state.pendingFish) return;
    var fish = state.pendingFish;
    state.pendingFish = null;
    state.biteWindow = 0;
    window.World.endBite();
    hookFish(fish);
  }

  // ------------------------------------------------------------------ fight
  function hookFish(def) {
    var f = state.fight;
    f.active = true;
    f.def = def;
    f.weight = rollWeight(def);
    f.length = lengthFor(f.weight);
    var minFight = state.level.depthMax * 0.72;
    var rawDepth = Math.max(state.lureDepth, def.depth[0], minFight);
    var d = clamp(rawDepth + rand(0, 2.5), def.depth[0], state.level.depthMax);
    d = clamp(d, 2, state.level.depthMax);
    f.startDepth = d;
    f.depth = d;
    f.tension = 20;
    f.tensionMax = 100 + tier('line') * 12;
    f.stamina = 1;
    f.time = 0;
    f.surge = false;
    f.behavior = fishBehavior(def);
    f.surgeTimer = rand(2.0, 3.4) * (f.behavior === 'runner' ? 0.62 : f.behavior === 'deadweight' ? 2.2 : 1);
    f.surgeDur = 0;
    f.danger = 0;
    f.reelSpeed = 5.2 * (1 + 0.18 * tier('reel'));
    f.sfxTick = 0;
    f.alarm = 0;
    f.landed = false;

    state.phase = 'fighting';
    window.World.hideSchool();
    window.World.hook(def, f.length, f.depth);
    window.World.setMode('fight');
    setPhase('fighting');
    if (ui.fight) ui.fight.classList.remove('hidden');
    if (ui.pip) ui.pip.classList.remove('hidden');
    if (ui.fightName) ui.fightName.textContent = def.name;
    if (ui.fightBehavior) ui.fightBehavior.textContent = behaviorLabel(f.behavior);
    if (ui.fightRarity) { ui.fightRarity.textContent = def.rarity.toUpperCase(); ui.fightRarity.className = rarityClass(def.rarity); }
    if (ui.fightWeight) ui.fightWeight.textContent = '?? kg';
    if (ui.fightTimer) ui.fightTimer.textContent = '0:00';
    if (ui.pipDepth) ui.pipDepth.textContent = f.depth.toFixed(1) + ' m';
    if (ui.surgeWarning) ui.surgeWarning.classList.add('hidden');
    sfx('strike');
    if (state.sonarPanel) state.sonarPanel.classList.add('hidden');
    if (ui.sonarPanel) ui.sonarPanel.classList.add('hidden');
    if (ui.depthControl) ui.depthControl.classList.add('hidden');
    if (ui.schoolHint) ui.schoolHint.classList.add('hidden');
    if (ui.prompt) ui.prompt.style.display = 'none';
    renderFight();
  }

  function rollWeight(def) {
    var t = Math.pow(Math.random(), 1.55);
    return def.weight[0] + (def.weight[1] - def.weight[0]) * t;
  }
  function lengthFor(w) {
    return 0.5 + Math.pow(Math.max(0.01, w), 0.38) * 0.85;
  }

  function updateFight(dt) {
    var f = state.fight;
    if (!f.active) return;
    f.time += dt;
    f.alarm = Math.max(0, f.alarm - dt);
    if (f.time > 90) { loseFish('THE FISH OUTLASTED YOU', 'timeout'); return; }

    var reeling = state.actionHeld && !state.giveLine && !state.paused;
    f.reeling = reeling;
    f.giveLine = state.giveLine;

    // surge scheduling
    if (f.surge) {
      f.surgeDur -= dt;
      if (f.surgeDur <= 0) {
        f.surge = false;
        var freq = f.behavior === 'runner' ? 0.62 : f.behavior === 'thrasher' ? 0.85 : f.behavior === 'deadweight' ? 2.2 : 1;
        f.surgeTimer = (2.4 + Math.random() * 2.6 - f.def.agility * 1.0) * freq;
      }
    } else {
      f.surgeTimer -= dt;
      if (f.surgeTimer <= 0 && f.stamina > 0.08 && f.depth > 3) {
        f.surge = true;
        f.surgeDur = 0.9 + f.def.agility * 1.2 + Math.random() * 0.5;
        sfx('surge');
      }
    }
    if (ui.surgeWarning) ui.surgeWarning.classList.toggle('hidden', !f.surge);

    var delta;
    if (state.giveLine) delta = -60;
    else if (reeling) delta = (8 + f.def.power * 2.2) * (f.behavior === 'deadweight' ? 1.15 : f.behavior === 'runner' ? 0.9 : 1);
    else delta = -30;
    if (f.surge) {
      var pull = 16 + f.def.power * 5;
      if (f.behavior === 'thrasher') pull *= 1.25;
      else if (f.behavior === 'deadweight') pull *= 0.7;
      else if (f.behavior === 'runner') pull *= 0.9;
      delta += pull;
    }
    f.tension += delta * dt;

    var shakeCount = f.behavior === 'thrasher' && f.surge ? 1.6 : 1;
    if (state.giveLine) f.depth += (1.7 + f.def.power * 0.35) * (f.behavior === 'diver' ? 1.35 : 1) * dt;
    else if (reeling) f.depth -= f.reelSpeed * dt * (f.depth < 6 ? 0.4 : 1) * (1 - 0.18 * (1 - f.stamina)) * (f.surge ? 0.6 / shakeCount : 1);
    else f.depth += (0.5 + f.def.power * 0.15 + (f.surge ? 1.5 : 0)) * (f.behavior === 'diver' ? 1.35 : f.behavior === 'runner' ? 0.8 : 1) * dt;
    f.depth = clamp(f.depth, 0.8, state.level.depthMax + 8);

    var norm = clamp(f.tension / f.tensionMax, 0, 1.2);
    var staminaMul = f.behavior === 'runner' ? 1.2 : f.behavior === 'thrasher' ? 1.1 : f.behavior === 'deadweight' ? 0.8 : 1;
    if (norm > 0.3 && norm < 0.85 && !state.giveLine) f.stamina -= (0.042 + f.def.stamina * 0.007) * staminaMul * dt;
    else if (state.giveLine) f.stamina -= 0.005 * dt;
    else f.stamina -= 0.009 * dt;
    f.stamina = clamp(f.stamina, 0, 1);

    if (f.tension > f.tensionMax) {
      f.danger += dt;
      if (f.alarm <= 0) { sfx('tensionAlarm'); f.alarm = 1.1; }
      if (f.danger > 0.95) { snapLine(); return; }
    } else {
      f.danger = Math.max(0, f.danger - dt * 2.2);
    }
    f.tension = clamp(f.tension, 0, f.tensionMax + 15);

    if (f.depth <= 1.6) { landFish(); return; }

    if (reeling) {
      f.sfxTick -= dt;
      if (f.sfxTick <= 0) { f.sfxTick = 0.12; sfx('reel', clamp(norm, 0.2, 1)); }
    }
    window.World.setFight({ depth: f.depth, tension: norm, stamina: f.stamina, reeling: reeling, giveLine: state.giveLine, surge: f.surge });
    renderFight();
    if (ui.pipDepth) ui.pipDepth.textContent = f.depth.toFixed(1) + ' m';
  }

  function renderFight() {
    var f = state.fight;
    if (!f.active) return;
    var norm = clamp(f.tension / f.tensionMax, 0, 1);
    if (ui.tensionFill) ui.tensionFill.style.width = (norm * 100).toFixed(1) + '%';
    if (ui.tensionVal) ui.tensionVal.textContent = Math.round(norm * 100) + '%';
    if (ui.tensionTrack) ui.tensionTrack.classList.toggle('danger', norm > 0.9);
    if (ui.staminaFill) ui.staminaFill.style.width = (f.stamina * 100).toFixed(0) + '%';
    if (ui.staminaVal) ui.staminaVal.textContent = Math.round(f.stamina * 100) + '%';
    if (ui.fightDepth) ui.fightDepth.textContent = f.depth.toFixed(1) + ' m';
    if (ui.fightTimer) ui.fightTimer.textContent = fmtTime(f.time);
    if (ui.fishMarker) {
      var topPct = clamp(f.depth / Math.max(1, state.level.depthMax), 0, 1) * 100;
      ui.fishMarker.style.bottom = (100 - topPct).toFixed(1) + '%';
    }
    var status = 'HOLD TO REEL';
    var danger = false;
    if (f.giveLine) status = 'GIVING LINE';
    else if (f.surge) status = 'SURGE — EASE OFF';
    else if (norm > 0.9) { status = 'LINE CRITICAL — GIVE LINE'; danger = true; }
    else if (f.reeling) status = 'REELING';
    if (ui.fightStatus) {
      ui.fightStatus.textContent = status;
      ui.fightStatus.classList.toggle('danger', danger || f.surge);
    }
  }

  function snapLine() {
    var f = state.fight;
    if (!f.active) return;
    f.active = false;
    f.landed = false;
    state.fishLost++;
    state.streak = 0;
    save.stats.escapes++;
    bountyLoss();
    window.World.snap();
    setPhase('lost');
    state.lostTimer = 1.7;
    sfx('snap');
    toast('THE LINE SNAPPED · STREAK LOST', 'bad');
    renderQuota();
    autosaveRun();
  }

  function loseFish(message) {
    var f = state.fight;
    if (!f.active) return;
    f.active = false;
    state.fishLost++;
    state.streak = 0;
    save.stats.escapes++;
    bountyLoss();
    window.World.snap();
    setPhase('lost');
    state.lostTimer = 1.7;
    sfx('snap');
    toast((message || 'THE FISH GOT AWAY') + ' · STREAK LOST', 'bad');
    renderQuota();
    autosaveRun();
  }

  function updateLost(dt) {
    state.lostTimer -= dt;
    if (state.lostTimer <= 0) {
      save.stats.playtime += state.playAccum;
      state.playAccum = 0;
      beginNextCast();
    }
  }

  function landFish() {
    var f = state.fight;
    if (!f.active) return;
    f.active = false;
    var def = f.def;
    var weight = f.weight;
    var ratio = clamp((weight - def.weight[0]) / Math.max(0.001, def.weight[1] - def.weight[0]), 0, 1);
    var baseValue = Math.max(1, Math.round(def.value * (0.8 + ratio * 0.5)));
    state.streak++;
    state.bestStreak = Math.max(state.bestStreak || 0, state.streak);
    save.stats.bestStreak = Math.max(save.stats.bestStreak || 0, state.streak);
    var streakPct = Math.min(streakCap(), (state.streak - 1) * 0.05);
    var value = Math.round(baseValue * (1 + streakPct));
    var xp = Math.max(4, Math.round(value * 0.36));
    var target = targetNeeds(def.id);
    var prevBest = Number(save.best[def.id]) || 0;
    var newBest = weight > prevBest;
    if (newBest) save.best[def.id] = weight;
    var rec = save.caught[def.id] || { count: 0, best: 0 };
    rec.count = (Number(rec.count) || 0) + 1;
    rec.best = Math.max(Number(rec.best) || 0, weight);
    save.caught[def.id] = rec;
    save.coins += value;
    save.xp += xp;
    save.stats.catches++;
    save.stats.bestWeight = Math.max(save.stats.bestWeight, weight);
    save.stats.playtime += state.playAccum;
    state.playAccum = 0;
    state.runCoins += value;
    state.runXP += xp;
    state.quotaCount++;
    state.targetCounts[def.id] = (state.targetCounts[def.id] || 0) + 1;
    var catchObj = {
      def: def, weight: weight, length: f.length, value: value, xp: xp,
      depth: f.startDepth, newBest: newBest, target: target,
      bestiaryNew: rec.count === 1, streak: state.streak, streakPct: streakPct
    };
    bountyCatch(catchObj);
    state.creel.push(catchObj);
    state.pendingCatch = catchObj;
    state.landingTimer = 1.1;
    window.World.land(def, f.length);
    setPhase('landing');
    if (ui.fight) ui.fight.classList.add('hidden');
    if (ui.pip) ui.pip.classList.add('hidden');
    sfx('splash', 0.8);
    autosaveRun();
    renderHud();
    renderQuota();
    var before = rankInfo(save.xp - xp);
    var after = rankInfo(save.xp);
    if (after.index > before.index) {
      window.setTimeout(function () { toast('RANK UP · ' + after.name.toUpperCase(), 'good'); }, 900);
    }
  }

  function updateLanding(dt) {
    state.landingTimer -= dt;
    if (state.landingTimer <= 0 && state.pendingCatch) openCatchCard();
  }

  // ------------------------------------------------------------------ catch card
  function openCatchCard() {
    var c = state.pendingCatch;
    if (!c) return;
    if (ui.catchName) ui.catchName.textContent = c.def.name;
    if (ui.catchKicker) ui.catchKicker.textContent = c.target ? 'QUOTA TARGET LANDED' : 'CAUGHT';
    if (ui.catchRarity) { ui.catchRarity.textContent = c.def.rarity.toUpperCase(); ui.catchRarity.style.color = RARITY_COLOR[c.def.rarity]; }
    if (ui.catchDepth) ui.catchDepth.textContent = Math.round(c.depth) + ' m deep';
    if (ui.catchLength) ui.catchLength.textContent = c.length.toFixed(2) + ' m';
    if (ui.catchWeight) ui.catchWeight.textContent = fmtWeight(c.weight);
    if (ui.catchValue) ui.catchValue.textContent = String(c.value);
    if (ui.catchDesc) ui.catchDesc.textContent = c.def.desc;
    var badges = [];
    if (c.newBest) badges.push('<span class="badge gold">NEW BEST</span>');
    if (c.target) badges.push('<span class="badge">QUOTA TARGET</span>');
    if (c.bestiaryNew) badges.push('<span class="badge">NEW SPECIES</span>');
    if (c.streak && c.streak > 1) badges.push('<span class="badge gold">STREAK ×' + c.streak + ' +' + Math.round((c.streakPct || 0) * 100) + '%</span>');
    if (c.depth > state.level.depthMax * 0.7) badges.push('<span class="badge">DEEP WATER</span>');
    if (ui.catchBadges) ui.catchBadges.innerHTML = badges.join('');
    if (ui.catchDialog) ui.catchDialog.style.borderColor = RARITY_COLOR[c.def.rarity];
    showScreen('catch');
    if (window.CatchLab) {
      try { window.CatchLab.show(c.def, c.weight, c.length); } catch (e) {}
    }
    sfx('catchFish', c.def.rarity);
  }

  function closeCatch() {
    if (state.screen !== 'catch') return;
    if (window.CatchLab) { try { window.CatchLab.hide(); } catch (e) {} }
    var wasTarget = state.pendingCatch && state.pendingCatch.target;
    state.pendingCatch = null;
    hideScreens();
    if (quotaComplete()) {
      finishLevel();
    } else {
      beginNextCast();
      if (wasTarget) toast('TARGET ADDED TO THE CREEL', 'good');
    }
  }

  function quotaComplete() {
    var lv = state.level;
    if (!lv) return false;
    if (state.quotaCount < lv.quota.total) return false;
    for (var i = 0; i < lv.quota.targets.length; i++) {
      var t = lv.quota.targets[i];
      if ((state.targetCounts[t.id] || 0) < t.count) return false;
    }
    return true;
  }

  // ------------------------------------------------------------------ completion
  function finishLevel() {
    var lv = state.level;
    if (!lv) return;
    var stars = 1;
    if (state.casts <= lv.starCasts) stars++;
    if (state.fishLost === 0) stars++;
    stars = clamp(stars, 1, 3);
    var reward = lv.reward + (stars - 1) * Math.round(lv.reward * 0.2);
    var levelXp = 120 + lv.index * 60;
    save.coins += reward;
    save.xp += levelXp;
    state.runCoins += reward;
    state.runXP += levelXp;
    var prev = save.completed[lv.id] || { stars: 0, bestCasts: 999 };
    prev.stars = Math.max(prev.stars || 0, stars);
    prev.bestCasts = Math.min(Number(prev.bestCasts) || 999, state.casts);
    prev.lastStars = stars;
    save.completed[lv.id] = prev;
    var unlockedBefore = save.unlocked;
    save.unlocked = Math.max(save.unlocked, Math.min(LEVELS.length, lv.index + 1));
    var unlockedNew = save.unlocked > unlockedBefore;
    save.finalSeen = save.finalSeen || lv.index === LEVELS.length;
    state.finalSeen = save.finalSeen;
    clearRun();
    saveNow();
    state.result = {
      level: lv, stars: stars, reward: reward, levelXp: levelXp,
      casts: state.casts, fishLost: state.fishLost, quota: state.quotaCount,
      best: state.creel.slice().sort(function (a, b) { return b.weight - a.weight; })[0] || null,
      unlockedNew: unlockedNew,
      nextIndex: lv.index < LEVELS.length ? lv.index + 1 : null
    };
    state.inLevel = false;
    state.paused = false;
    setPhase('done');
    window.World.clearFish();
    if (ui.hud) ui.hud.classList.add('hidden');
    showScreen('results');
    window.World.setMode('results');
    renderResults();
    setTheme(THEMES[(lv.index - 1) % THEMES.length]);
    sfx('levelComplete');
  }

  function renderResults() {
    var r = state.result;
    if (!r) return;
    if (ui.resultKicker) ui.resultKicker.textContent = r.stars === 3 ? 'A PERFECT RUN' : 'EXPEDITION COMPLETE';
    if (ui.resultTitle) ui.resultTitle.textContent = r.level.name;
    if (ui.resultStars) {
      var sp = '';
      for (var i = 1; i <= 3; i++) sp += '<span class="' + (i <= r.stars ? 'on' : '') + '">★</span>';
      ui.resultStars.innerHTML = sp;
    }
    var best = r.best;
    if (ui.resultStats) {
      ui.resultStats.innerHTML =
        '<div><span>FISH LANDED</span><b>' + r.quota + ' / ' + r.level.quota.total + '</b></div>' +
        '<div><span>CASTS</span><b>' + r.casts + (r.casts <= r.level.starCasts ? ' · CLEAN' : '') + '</b></div>' +
        '<div><span>FISH LOST</span><b>' + r.fishLost + '</b></div>' +
        '<div><span>BEST CATCH</span><b>' + (best ? best.def.name + ' · ' + fmtWeight(best.weight) + ' kg' : '—') + '</b></div>' +
        '<div><span>CLEAR BONUS</span><b>◈ ' + r.reward + '</b></div>' +
        '<div><span>XP EARNED</span><b>' + r.levelXp + '</b></div>';
    }
    if (ui.resultCoins) ui.resultCoins.textContent = String(state.runCoins);
    var note = '';
    if (r.stars < 3) {
      if (r.fishLost > 0 && r.casts > r.level.starCasts) note = 'For three stars: finish inside ' + r.level.starCasts + ' casts and lose nothing.';
      else if (r.fishLost > 0) note = 'For three stars: land the quota without losing a fish.';
      else if (r.casts > r.level.starCasts) note = 'For three stars: finish inside ' + r.level.starCasts + ' casts.';
    } else {
      note = 'A clean run. The ledger has nothing to add.';
    }
    if (r.unlockedNew && r.nextIndex) note += ' New water unlocked: ' + LEVELS[r.nextIndex - 1].name + '.';
    if (ui.resultNote) ui.resultNote.textContent = note;
    if (ui.btnNextLevel) ui.btnNextLevel.textContent = r.nextIndex ? 'NEXT DEPTH' : 'FINISH EXPEDITION';
  }

  function nextFromResults() {
    var r = state.result;
    if (!r) return;
    if (r.nextIndex) startLevel(r.nextIndex);
    else showFinal();
  }

  function replayLevel() {
    var r = state.result;
    if (!r) return;
    startLevel(r.level.index);
  }

  function showFinal() {
    state.inLevel = false;
    state.paused = false;
    save.finalSeen = true;
    saveNow();
    renderFinal();
    showScreen('final');
    window.World.setMode('results');
    setTheme('night');
  }

  function renderFinal() {
    var stars = 0;
    LEVELS.forEach(function (l) { stars += (save.completed[l.id] && save.completed[l.id].stars) || 0; });
    var best = bestCatch();
    var minutes = save.stats.playtime;
    if (ui.finalStats) {
      ui.finalStats.innerHTML =
        '<div><span>WATERS CLEARED</span><b>' + Object.keys(save.completed).length + ' / ' + LEVELS.length + '</b></div>' +
        '<div><span>STARS</span><b>' + stars + ' / 15</b></div>' +
        '<div><span>BESTIARY</span><b>' + bestiaryCount() + ' / ' + D.FISH.length + '</b></div>' +
        '<div><span>TOTAL CATCHES</span><b>' + save.stats.catches + '</b></div>' +
        '<div><span>BIGGEST FISH</span><b>' + (best ? best.def.name + ' · ' + fmtWeight(best.weight) + ' kg' : '—') + '</b></div>' +
        '<div><span>TIME ON THE WATER</span><b>' + fmtMinutes(minutes) + '</b></div>';
    }
  }

  // ------------------------------------------------------------------ harbour / shop
  function showHarbor() {
    state.inLevel = false;
    state.paused = false;
    state.phase = 'idle';
    state.fight.active = false;
    state.pendingCatch = null;
    window.World.clearFish();
    window.World.reset();
    window.World.hideSchool();
    window.World.setMode('harbor');
    showScreen('harbor');
    renderHarbor();
    setTheme('day');
    saveNow();
  }

  function resumeRun() {
    var r = save.run;
    if (!r) return;
    var lv = levelById(r.levelId);
    if (!lv || lv.index > save.unlocked) { clearRun(); saveNow(); renderHarbor(); return; }
    startLevel(lv.index);
    if (!state.inLevel) return;
    state.casts = Math.max(0, Math.floor(Number(r.casts) || 0));
    state.fishLost = Math.max(0, Math.floor(Number(r.fishLost) || 0));
    state.quotaCount = Math.max(0, Math.floor(Number(r.quotaCount) || 0));
    state.targetCounts = {};
    if (r.targetCounts && typeof r.targetCounts === 'object') {
      Object.keys(r.targetCounts).forEach(function (k) { state.targetCounts[k] = Math.max(0, Math.floor(Number(r.targetCounts[k]) || 0)); });
    }
    state.runCoins = Math.max(0, Math.floor(Number(r.runCoins) || 0));
    state.runXP = Math.max(0, Math.floor(Number(r.runXP) || 0));
    state.lureTarget = clamp(Math.round(Number(r.lureTarget) || state.lureTarget), 1, lv.depthMax);
    state.lureDepth = state.lureTarget;
    state.streak = Math.max(0, Math.floor(Number(r.streak) || 0));
    if (r.feedLayerDepth != null) {
      state.feedLayer.depth = clamp(Math.round(Number(r.feedLayerDepth) || state.feedLayer.depth), 1, lv.depthMax);
      state.feedLayer.timer = rand(10, 18);
    }
    state.creel = [];
    (r.creel || []).forEach(function (c) {
      var def = c && FISH[c.id];
      if (!def) return;
      state.creel.push({
        def: def,
        weight: Number(c.weight) || def.weight[0],
        length: Number(c.length) || 1,
        value: Math.max(0, Math.floor(Number(c.value) || 0)),
        xp: Math.max(0, Math.floor(Number(c.xp) || 0)),
        depth: Number(c.depth) || 0,
        newBest: !!c.newBest,
        target: !!c.target,
        bestiaryNew: !!c.bestiaryNew,
        streak: Math.max(0, Math.floor(Number(c.streak) || 0)),
        streakPct: 0
      });
    });
    if (ui.depthSlider) ui.depthSlider.value = String(state.lureTarget);
    renderHud();
    renderQuota();
    updateDepthReadout();
    renderFeedLayer();
    drawSonar();
    if (quotaComplete()) {
      finishLevel();
      return;
    }
    autosaveRun();
    toast('RUN RESTORED · ' + lv.name.toUpperCase(), 'good');
  }

  function showTitle() {
    state.inLevel = false;
    state.paused = false;
    state.phase = 'idle';
    state.fight.active = false;
    var idx = clamp(save.unlocked, 1, LEVELS.length) - 1;
    window.World.setLevel(LEVELS[idx]);
    window.World.setMode('title');
    window.World.reset();
    showScreen('title');
    renderTitle();
    setTheme('day');
  }

  function renderTitle() {
    if (!ui.titleSave) return;
    var has = !!save.startedAt;
    if (ui.btnContinue) ui.btnContinue.disabled = !has;
    if (!has) {
      ui.titleSave.innerHTML = 'NO EXPEDITION YET · THE WATER IS FLAT AND WAITING';
      if (ui.btnNew) ui.btnNew.textContent = 'BEGIN EXPEDITION';
    } else {
      var rank = rankInfo(save.xp);
      var best = bestCatch();
      ui.titleSave.innerHTML = '<b>' + rank.name + '</b> · BESTIARY ' + bestiaryCount() + ' / ' + D.FISH.length +
        ' · WATERS OPEN ' + save.unlocked + ' / ' + LEVELS.length + (best ? ' · BEST ' + best.def.name.toUpperCase() + ' ' + fmtWeight(best.weight) + ' KG' : '');
      if (ui.btnNew) ui.btnNew.textContent = 'NEW EXPEDITION';
    }
  }

  function renderHarbor() {
    if (!ui.harborCoins) return;
    ui.harborCoins.textContent = String(save.coins);
    var rank = rankInfo(save.xp);
    if (ui.harborRank) ui.harborRank.textContent = rank.name + (rank.next ? ' · ' + Math.round(rank.pct) + '% TO ' + rank.next.name.toUpperCase() : ' · MAX');
    if (ui.harborXp) ui.harborXp.style.width = rank.pct + '%';
    if (ui.shopCoins) ui.shopCoins.textContent = '◈ ' + save.coins;
    if (ui.bestiaryCount) ui.bestiaryCount.textContent = bestiaryCount() + ' / ' + D.FISH.length;
    renderLevels();
    renderShop();
    renderCaptain();
    var lvRun = save.run && levelById(save.run.levelId);
    if (ui.btnResumeRun) {
      if (lvRun) {
        ui.btnResumeRun.classList.remove('hidden');
        ui.btnResumeRun.textContent = 'RESUME RUN · LV' + lvRun.index;
        ui.btnResumeRun.title = lvRun.name + ' — ' + save.run.quotaCount + '/' + lvRun.quota.total + ' fish, ' + save.run.casts + ' casts';
      } else {
        ui.btnResumeRun.classList.add('hidden');
      }
    }
    if (ui.bountyBadge) {
      var ready = save.contracts.filter(bountyDone).length;
      ui.bountyBadge.textContent = ready ? ready + ' READY' : '';
    }
    if (ui.saveNote) {
      var stamp = save.lastPlayed ? new Date(save.lastPlayed).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—';
      ui.saveNote.textContent = 'Autosaved ' + stamp + ' · backup slot active. Export a JSON save to carry progress across browsers or future releases.';
    }
    updateSoundUi();
    if (ui.fishingLog) {
      var nextLevel = LEVELS[clamp(save.unlocked, 1, LEVELS.length) - 1];
      var tip = TIPS[Math.floor(Math.random() * TIPS.length)];
      ui.fishingLog.innerHTML = '<b>NEXT WATER:</b> ' + nextLevel.name + ' — ' + nextLevel.brief + '<br><br><b>TIP:</b> ' + tip;
    }
  }

  function renderLevels() {
    if (!ui.levelList) return;
    var html = '';
    LEVELS.forEach(function (lv) {
      var unlocked = lv.index <= save.unlocked;
      var comp = save.completed[lv.id];
      var isCurrent = unlocked && !comp && lv.index === save.unlocked;
      var cls = 'level-card' + (unlocked ? '' : ' locked') + (comp ? ' complete' : '') + (isCurrent ? ' current' : '');
      var targets = lv.quota.targets.map(function (t) {
        var done = comp ? true : false;
        return '<span class="target-chip' + (done ? ' done' : '') + '">' + FISH[t.id].name + ' ×' + t.count + '</span>';
      }).join('');
      var starCount = comp ? comp.stars : 0;
      var stars = '';
      for (var s = 1; s <= 3; s++) stars += '<span class="' + (s <= starCount ? 'on' : '') + '">★</span>';
      var lock = !unlocked ? '<div class="level-lock">CLEAR ' + LEVELS[lv.index - 2].name.toUpperCase() + '</div>' : '';
      html += '<button class="' + cls + '" data-level="' + lv.index + '"' + (unlocked ? '' : ' disabled') + '>' +
        '<div class="level-num">' + (lv.index < 10 ? '0' : '') + lv.index + '</div>' +
        '<div class="level-info">' +
          '<div class="level-name">' + lv.name + ' <em>' + lv.time + '</em>' + (comp ? ' <em>DONE</em>' : '') + '</div>' +
          '<div class="level-sub"><span>DEPTH <b>' + lv.depthMax + ' m</b></span><span>QUOTA <b>' + lv.quota.total + ' fish</b></span><span>CASTS <b>≤' + lv.starCasts + '</b></span></div>' +
          '<div class="level-targets">' + targets + '</div>' +
        '</div>' +
        '<div class="level-side">' +
          '<div class="level-depth">' + lv.depthMax + ' m</div>' +
          '<div class="level-casts">' + lv.tagline + '</div>' +
          '<div class="level-stars">' + lock + stars + '</div>' +
        '</div>' +
      '</button>';
    });
    ui.levelList.innerHTML = html;
  }

  function renderShop() {
    if (!ui.shopList) return;
    var html = '';
    UPGRADES.forEach(function (u) {
      var t = tier(u.id);
      var maxed = t >= u.costs.length - 1;
      var cost = maxed ? 0 : u.costs[t + 1];
      var can = !maxed && save.coins >= cost;
      var pips = '';
      for (var i = 0; i < u.costs.length - 1; i++) pips += '<i class="' + (i < t ? 'on' : '') + '"></i>';
      html += '<div class="shop-item">' +
        '<div class="shop-icon">' + (UPGRADE_ICONS[u.id] || '◇') + '</div>' +
        '<div><div class="shop-name">' + u.name + ' <span class="mini">TIER ' + t + ' / ' + (u.costs.length - 1) + '</span></div>' +
        '<div class="shop-desc">' + u.effect + ' · ' + u.desc + '</div><div class="pips">' + pips + '</div></div>' +
        '<button class="shop-buy' + (maxed ? ' maxed' : '') + '" data-upgrade="' + u.id + '"' + (maxed || !can ? ' disabled' : '') + '>' +
        (maxed ? 'MAXED' : '◈ ' + cost) + '</button>' +
      '</div>';
    });
    ui.shopList.innerHTML = html;
    var allMaxed = UPGRADES.every(function (u) { return tier(u.id) >= u.costs.length - 1; });
    ui.shopList.classList.toggle('all-maxed', allMaxed);
  }

  function buyUpgrade(id) {
    var u = null;
    for (var i = 0; i < UPGRADES.length; i++) if (UPGRADES[i].id === id) u = UPGRADES[i];
    if (!u) return;
    var t = tier(id);
    if (t >= u.costs.length - 1) { toast('ALREADY MAXED', ''); return; }
    var cost = u.costs[t + 1];
    if (save.coins < cost) { toast('NOT ENOUGH COINS', 'bad'); sfx('miss'); return; }
    save.coins -= cost;
    save.upgrades[id] = t + 1;
    if (id === 'sonar') { renderDepthBands(); state.sonarBlips = buildSonarBlips(state.level || LEVELS[0]); drawSonar(); }
    if (id === 'lure') renderDepthBands();
    saveNow();
    sfx('purchase');
    toast(u.name.toUpperCase() + ' → TIER ' + (t + 1), 'good');
    renderHarbor();
    renderHud();
  }

  function renderCaptain() {
    if (!ui.captainCard) return;
    var rank = rankInfo(save.xp);
    var renown = renownInfo();
    var best = bestCatch();
    var levels = Object.keys(save.completed).length;
    ui.captainCard.innerHTML =
      '<div class="cap-name">' + rank.name + '</div>' +
      '<div class="cap-title">' + renown.name + ' · ' + save.renown + ' RENOWN</div>' +
      '<div class="mini">' + save.xp + ' XP' + (rank.next ? ' · ' + (rank.next.xp - save.xp) + ' TO NEXT RANK' : ' · MAX RANK') + '</div>' +
      '<div class="captain-stats">' +
        '<div><span>FISH LANDED</span><b>' + save.stats.catches + '</b></div>' +
        '<div><span>FISH LOST</span><b>' + save.stats.escapes + '</b></div>' +
        '<div><span>BEST CATCH</span><b>' + (best ? best.def.name + ' ' + fmtWeight(best.weight) + ' kg' : '—') + '</b></div>' +
        '<div><span>WATERS CLEARED</span><b>' + levels + ' / ' + LEVELS.length + '</b></div>' +
        '<div><span>BESTIARY</span><b>' + bestiaryCount() + ' / ' + D.FISH.length + '</b></div>' +
        '<div><span>CONTRACTS</span><b>' + save.contractsDone + ' · ' + save.tokens + ' ✦</b></div>' +
        '<div><span>BEST STREAK</span><b>×' + (save.stats.bestStreak || 0) + '</b></div>' +
        '<div><span>ON THE WATER</span><b>' + fmtMinutes(save.stats.playtime) + '</b></div>' +
      '</div>';
  }


  function renderBounties() {
    if (!ui.bountyList) return;
    var ri = renownInfo();
    if (ui.bountyRenown) ui.bountyRenown.textContent = String(save.renown);
    if (ui.bountyTitle) ui.bountyTitle.textContent = ri.name + (ri.next ? ' · ' + Math.round(ri.pct) + '% TO ' + ri.next.name.toUpperCase() : ' · MAX');
    if (ui.bountyTokens) ui.bountyTokens.textContent = String(save.tokens);
    if (ui.bountyDone) ui.bountyDone.textContent = String(save.contractsDone);
    if (ui.bountyStreak) ui.bountyStreak.textContent = '×' + (save.stats.bestStreak || 0);

    var html = '';
    save.contracts.forEach(function (c, idx) {
      var done = bountyDone(c);
      var pct = Math.min(100, c.have / Math.max(1, c.need) * 100);
      html += '<article class="bounty-card' + (done ? ' done' : '') + '">' +
        '<div class="bounty-kind">' + bountyKind(c) + '</div>' +
        '<div class="bounty-name">' + bountyTitle(c) + '</div>' +
        '<div class="bounty-desc">' + (c.type === 'clean' ? 'A lost fish resets this contract.' : c.type === 'deep' ? 'Deeper water pays the broker.' : 'Any water counts.') + '</div>' +
        '<div class="bounty-bar"><i style="width:' + pct.toFixed(1) + '%"></i></div>' +
        '<div class="bounty-meta"><span><b>' + c.have + ' / ' + c.need + '</b></span><span class="bounty-reward">✦ ' + c.tokens + ' · +' + c.renown + ' RENOWN</span></div>' +
        '<div class="bounty-actions"><button class="bounty-claim" data-claim="' + c.id + '"' + (done ? '' : ' disabled') + '>' + (done ? 'CLAIM' : 'IN PROGRESS') + '</button></div>' +
      '</article>';
    });
    ui.bountyList.innerHTML = html;

    var charms = '';
    CHARMS.forEach(function (ch) {
      var owned = save.charms.indexOf(ch.id) !== -1;
      var equipped = save.charm === ch.id;
      charms += '<article class="charm-card' + (equipped ? ' equipped' : '') + '">' +
        '<div class="charm-name"><span class="charm-icon">' + ch.icon + '</span>' + ch.name + '</div>' +
        '<div class="charm-desc">' + ch.desc + '</div>' +
        '<button class="charm-buy' + (equipped ? ' equipped' : '') + '" data-charm="' + ch.id + '"' + (!owned && save.tokens < ch.cost ? ' disabled' : '') + '>' +
          (equipped ? 'EQUIPPED · CLICK TO UNEQUIP' : owned ? 'EQUIP' : '✦ ' + ch.cost + ' TOKENS') +
        '</button>' +
      '</article>';
    });
    ui.charmList.innerHTML = charms;
  }

  function claimBounty(id) {
    var idx = -1;
    for (var i = 0; i < save.contracts.length; i++) if (save.contracts[i].id === id) idx = i;
    if (idx < 0) return;
    var c = save.contracts[idx];
    if (!bountyDone(c)) return;
    save.tokens += c.tokens;
    save.renown += c.renown;
    save.contractsDone++;
    save.contracts[idx] = makeBounty();
    saveNow();
    renderBounties();
    renderCaptain();
    renderHarbor();
    sfx('purchase');
    toast('CONTRACT PAID · +' + c.tokens + ' ✦ · +' + c.renown + ' RENOWN', 'good');
  }

  function buyCharm(id) {
    var ch = charmById(id);
    if (!ch) return;
    var owned = save.charms.indexOf(id) !== -1;
    if (owned) {
      save.charm = save.charm === id ? null : id;
    } else {
      if (save.tokens < ch.cost) { toast('NEED ' + ch.cost + ' TOKENS', 'bad'); sfx('miss'); return; }
      save.tokens -= ch.cost;
      save.charms.push(id);
      save.charm = id;
    }
    saveNow();
    renderBounties();
    renderCaptain();
    renderHarbor();
    sfx('purchase');
    toast(save.charm === id ? 'CHARM EQUIPPED · ' + ch.name.toUpperCase() : 'CHARM UNEQUIPPED', 'good');
  }

  // ------------------------------------------------------------------ bestiary
  function renderBestiary() {
    if (!ui.bestiaryGrid) return;
    if (ui.bestiaryProgress) ui.bestiaryProgress.textContent = bestiaryCount() + ' / ' + D.FISH.length + ' LANDED';
    var list = D.FISH.slice().sort(function (a, b) {
      if (a.level !== b.level) return a.level - b.level;
      return a.depth[0] - b.depth[0];
    });
    var html = '';
    list.forEach(function (f) {
      var rec = save.caught[f.id];
      var known = !!(rec && rec.count > 0);
      var bestW = Number(save.best[f.id]) || 0;
      if (known) {
        html += '<div class="beast-card" style="--beast-color:' + RARITY_COLOR[f.rarity] + '">' +
          '<div class="beast-top"><div class="beast-name">' + f.name + '</div><div class="beast-rarity" style="color:' + RARITY_COLOR[f.rarity] + '">' + f.rarity + '</div></div>' +
          '<div class="beast-meta"><span>LVL <b>' + f.level + '</b></span><span>DEPTH <b>' + f.depth[0] + '–' + f.depth[1] + ' m</b></span><span>BEST <b>' + fmtWeight(bestW) + ' kg</b></span></div>' +
          '<div class="beast-desc">' + f.desc + '</div>' +
          '<div class="beast-count">×' + rec.count + '</div>' +
        '</div>';
      } else {
        html += '<div class="beast-card unknown" style="--beast-color: rgba(255,255,255,.2)">' +
          '<div class="beast-top"><div class="beast-name">???</div><div class="beast-rarity" style="color:' + RARITY_COLOR[f.rarity] + '">' + f.rarity + '</div></div>' +
          '<div class="beast-meta"><span>LVL <b>' + f.level + '</b></span><span>DEPTH <b>' + f.depth[0] + '–' + f.depth[1] + ' m</b></span></div>' +
          '<div class="beast-desc">Not yet landed. The water keeps its name.</div>' +
        '</div>';
      }
    });
    ui.bestiaryGrid.innerHTML = html;
  }

  // ------------------------------------------------------------------ sonar
  function buildSonarBlips(lv) {
    var blips = [];
    lv.species.forEach(function (id) {
      var f = FISH[id];
      var n = f.rarity === 'legendary' ? 1 : f.rarity === 'epic' ? 1 : 2;
      for (var i = 0; i < n; i++) {
        blips.push({
          x: rand(0.14, 0.86),
          depth: rand(f.depth[0], f.depth[1]),
          rarity: f.rarity,
          name: f.name
        });
      }
    });
    return blips;
  }

  function drawSonar() {
    if (!ui.sonarCtx || !state.level) return;
    var ctx = ui.sonarCtx;
    var w = ui.sonar.width;
    var h = ui.sonar.height;
    var topPad = 16;
    var bottomPad = 8;
    var leftPad = 22;
    var rightPad = 8;
    var maxD = Math.max(1, state.level.depthMax);
    var t = tier('sonar');
    ctx.clearRect(0, 0, w, h);
    var bg = ctx.createLinearGradient(0, topPad, 0, h - bottomPad);
    bg.addColorStop(0, 'rgba(48, 45, 34, .55)');
    bg.addColorStop(0.5, 'rgba(23, 25, 19, .70)');
    bg.addColorStop(1, 'rgba(4, 7, 5, .93)');
    ctx.fillStyle = bg;
    ctx.fillRect(leftPad, topPad, w - leftPad - rightPad, h - topPad - bottomPad);

    // grid
    ctx.font = '7px Palatino Linotype, Georgia, serif';
    ctx.textBaseline = 'middle';
    for (var i = 0; i <= 4; i++) {
      var depth = maxD * (i / 4);
      var y = topPad + (h - topPad - bottomPad) * (i / 4);
      ctx.strokeStyle = 'rgba(190, 164, 112, .14)';
      ctx.beginPath();
      ctx.moveTo(leftPad, y);
      ctx.lineTo(w - rightPad, y);
      ctx.stroke();
      ctx.fillStyle = 'rgba(220, 204, 168, .55)';
      ctx.fillText(Math.round(depth) + 'm', 2, y);
    }
    ctx.strokeStyle = 'rgba(200, 178, 132, .58)';
    ctx.beginPath();
    ctx.moveTo(leftPad, topPad + 0.5);
    ctx.lineTo(w - rightPad, topPad + 0.5);
    ctx.stroke();

    var usableH = h - topPad - bottomPad;
    function yFor(d) { return topPad + clamp(d / maxD, 0, 1) * usableH; }

    // feeding layer band
    if (t >= 1 && state.feedLayer) {
      var f1 = yFor(state.feedLayer.depth - 3.5);
      var f2 = yFor(state.feedLayer.depth + 3.5);
      ctx.fillStyle = 'rgba(195, 162, 106, .10)';
      ctx.fillRect(leftPad, Math.min(f1, f2), w - leftPad - rightPad, Math.abs(f2 - f1));
      ctx.strokeStyle = 'rgba(195, 162, 106, .38)';
      ctx.setLineDash([2, 3]);
      ctx.beginPath(); ctx.moveTo(leftPad, f1); ctx.lineTo(w - rightPad, f1);
      ctx.moveTo(leftPad, f2); ctx.lineTo(w - rightPad, f2); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(224, 198, 148, .72)';
      ctx.font = '5.5px Palatino Linotype, Georgia, serif';
      ctx.fillText('FEED LAYER ' + Math.round(state.feedLayer.depth) + 'm', w - rightPad - 70, f2 + 8);
    }

    // school
    if (t >= 1) {
      var sy = yFor(state.school.depth);
      var sx = w * 0.72;
      ctx.strokeStyle = 'rgba(195, 162, 106, .8)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(sx, sy, 8 + Math.sin(performance.now() * 0.004) * 2, 4, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = 'rgba(224, 198, 148, .9)';
      ctx.font = '6px Palatino Linotype, Georgia, serif';
      ctx.fillText('SCHOOL', sx - 34, sy);
    }

    // fish blips
    if (t >= 1) {
      state.sonarBlips.forEach(function (b) {
        if (b.depth > maxD) return;
        var bx = leftPad + clamp(b.x, 0, 1) * (w - leftPad - rightPad);
        var by = yFor(b.depth);
        var col = RARITY_SONAR[b.rarity];
        ctx.beginPath();
        ctx.fillStyle = col;
        ctx.globalAlpha = 0.8;
        ctx.arc(bx, by, b.rarity === 'legendary' ? 3.2 : b.rarity === 'epic' ? 2.6 : 1.8, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        if (t >= 2) {
          ctx.fillStyle = 'rgba(226, 212, 182, .58)';
          ctx.font = '5.5px Palatino Linotype, Georgia, serif';
          ctx.fillText(b.name, bx + 5, by - 2);
        }
      });
    } else {
      ctx.fillStyle = 'rgba(190, 174, 145, .40)';
      ctx.font = '8px Palatino Linotype, Georgia, serif';
      ctx.fillText('NO SONAR', w / 2 - 26, h / 2);
      ctx.font = '6px Palatino Linotype, Georgia, serif';
      ctx.fillText('THE DEPTH IS A GUESS', w / 2 - 39, h / 2 + 12);
    }

    // lure line
    var ly = yFor(state.lureDepth);
    ctx.strokeStyle = 'rgba(224, 204, 166, .88)';
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(leftPad, ly);
    ctx.lineTo(w - rightPad, ly);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(232, 211, 165, .95)';
    ctx.font = '7px Palatino Linotype, Georgia, serif';
    ctx.fillText(Math.round(state.lureDepth) + 'm LURE', leftPad + 4, ly - 5);

    if (ui.sonarTier) ui.sonarTier.textContent = 'TIER ' + t;
  }

  function renderDepthBands() {
    if (!ui.depthBands || !state.level) return;
    var t = tier('sonar');
    var html = '';
    if (t < 1) {
      html = '<span class="band-chip">SONAR TIER 1 REVEALS THE BANDS</span>';
    } else {
      state.level.species.forEach(function (id) {
        var f = FISH[id];
        var hot = state.lureTarget >= f.depth[0] - 1 && state.lureTarget <= f.depth[1] + 1;
        var label = t >= 2 ? f.name : f.depth[0] + '–' + f.depth[1] + ' m';
        html += '<span class="band-chip' + (hot ? ' hot' : '') + '" style="' + (t >= 2 ? 'color:' + RARITY_COLOR[f.rarity] + ';' : '') + '">' + label + '</span>';
      });
    }
    ui.depthBands.innerHTML = html;
    updateSonarHint();
  }

  function updateSonarHint() {
    if (!ui.sonarHint) return;
    var t = tier('sonar');
    if (ui.sonarTier) ui.sonarTier.textContent = 'TIER ' + t;
    if (t < 1) ui.sonarHint.textContent = 'No sonar fitted. The water is a guess. Fit one in the harbour.';
    else if (t < 2) ui.sonarHint.textContent = 'Bands and blips online. Sonar tier 2 names each species.';
    else ui.sonarHint.textContent = 'Species identified. Match the lure to a band before you wait.';
  }

  function renderDepthTicks(lv) {
    if (!ui.depthTicks) return;
    var html = '';
    for (var i = 0; i <= 4; i++) {
      var pct = i * 25;
      var depth = Math.round(lv.depthMax * i / 4);
      html += '<span style="top:calc(' + pct + '% - 5px)">' + depth + 'm</span><i style="top:' + pct + '%"></i>';
    }
    ui.depthTicks.innerHTML = html;
  }

  // ------------------------------------------------------------------ HUD
  function renderHud() {
    if (!state.level) return;
    if (ui.hudLevelName) ui.hudLevelName.textContent = state.level.name;
    if (ui.hudLevelSub) ui.hudLevelSub.textContent = 'DEPTH ' + state.level.depthMax + ' M · QUOTA ' + state.quotaCount + '/' + state.level.quota.total;
    if (ui.hudCoins) ui.hudCoins.textContent = String(save.coins + (state.inLevel ? 0 : 0));
    if (ui.hud) ui.hud.classList.toggle('hidden', !(state.inLevel && state.screen === null));
    updateSoundUi();
  }

  function renderQuota() {
    if (!ui.quota || !state.level) return;
    var lv = state.level;
    var html = '<span class="chip' + (state.quotaCount >= lv.quota.total ? ' done' : '') + '">FISH <b>' + state.quotaCount + ' / ' + lv.quota.total + '</b></span>';
    if (state.streak > 1) {
      var pct = Math.round(Math.min(streakCap(), (state.streak - 1) * 0.05) * 100);
      html += '<span class="chip streak">STREAK <b>×' + state.streak + '</b> +' + pct + '%</span>';
    }
    var bc = bountyNext();
    if (bc) html += '<span class="chip bounty" title="' + bountyTitle(bc) + '">◎ BOUNTY <b>' + bc.have + ' / ' + bc.need + '</b></span>';
    lv.quota.targets.forEach(function (t) {
      var n = state.targetCounts[t.id] || 0;
      var done = n >= t.count;
      html += '<span class="chip target' + (done ? ' done' : '') + '">' + FISH[t.id].name + ' <b>' + Math.min(n, t.count) + ' / ' + t.count + '</b></span>';
    });
    ui.quota.innerHTML = html;
    if (ui.hudLevelSub) ui.hudLevelSub.textContent = 'DEPTH ' + lv.depthMax + ' M · QUOTA ' + state.quotaCount + '/' + lv.quota.total;
  }

  function updateDepthReadout() {
    if (!state.level) return;
    if (ui.lureDepth) ui.lureDepth.textContent = String(Math.round(state.lureTarget));
    if (ui.depthMax) ui.depthMax.textContent = 'MAX ' + state.level.depthMax + ' m';
    if (ui.schoolDist) ui.schoolDist.textContent = state.school.dist + ' m' + (tier('sonar') >= 1 ? ' · ' + state.school.depth + ' m deep' : '');
    renderScanLine();
  }

  function updateSoundUi() {
    var muted = !!(save.settings && save.settings.muted);
    var ambience = !!(save.settings && save.settings.ambience);
    if (ui.btnMute) ui.btnMute.textContent = muted ? '✕' : '♪';
    if (ui.btnMute2) ui.btnMute2.textContent = 'SOUND: ' + (muted ? 'OFF' : 'ON');
    if (ui.btnPauseSound) ui.btnPauseSound.textContent = 'SOUND: ' + (muted ? 'OFF' : 'ON');
    if (ui.btnAmbience) ui.btnAmbience.textContent = 'ATMOSPHERE: ' + (ambience ? 'SURF' : 'OFF');
    if (ui.btnPauseAmbience) ui.btnPauseAmbience.textContent = 'ATMOSPHERE: ' + (ambience ? 'SURF' : 'OFF');
  }

  function toggleMute() {
    ensureAudio();
    save.settings.muted = !save.settings.muted;
    if (window.AudioKit) { try { window.AudioKit.setMuted(save.settings.muted); } catch (e) {} }
    saveNow();
    updateSoundUi();
    if (!save.settings.muted) sfx('ui');
  }

  function toggleAmbience() {
    ensureAudio();
    save.settings.ambience = !save.settings.ambience;
    if (window.AudioKit && window.AudioKit.setAmbientEnabled) {
      try { window.AudioKit.setAmbientEnabled(!!save.settings.ambience); } catch (e) {}
    }
    saveNow();
    updateSoundUi();
    toast(save.settings.ambience ? 'ATMOSPHERE ON · SOFT SURF' : 'ATMOSPHERE OFF', '');
    if (save.settings.ambience) sfx('ui');
  }

  // Export writes a plain JSON file; import goes back through loadSave() by
  // replacing the local slot and reloading, so old saves are migrated too.
  function exportSave() {
    try {
      saveNow();
      var json = JSON.stringify(save, null, 2);
      var blob = new Blob([json], { type: 'application/json' });
      var url = URL.createObjectURL(blob);
      var d = new Date();
      var stamp = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
      var a = document.createElement('a');
      a.href = url;
      a.download = 'abyss-angler-save-' + stamp + '.json';
      document.body.appendChild(a);
      a.click();
      setTimeout(function () { try { URL.revokeObjectURL(url); a.remove(); } catch (e) {} }, 1200);
      toast('SAVE EXPORTED', 'good');
    } catch (e) {
      toast('SAVE EXPORT FAILED', 'bad');
    }
  }

  function importSaveFile(file) {
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var obj = JSON.parse(String(reader.result));
        if (!obj || typeof obj !== 'object' || typeof obj.startedAt !== 'number' || typeof obj.coins !== 'number' || !obj.upgrades) {
          throw new Error('not an Abyss Angler save');
        }
        if (!window.confirm('Import this save? Your current progress will be replaced.')) return;
        var json = JSON.stringify(obj);
        window.localStorage.setItem(SAVE_KEY, json);
        try { window.localStorage.setItem(SAVE_BACKUP_KEY, json); } catch (e) {}
        skipSaveOnUnload = true;
        window.location.reload();
      } catch (e) {
        toast('NOT A VALID SAVE FILE', 'bad');
      }
    };
    reader.onerror = function () { toast('COULD NOT READ FILE', 'bad'); };
    reader.readAsText(file);
  }

  // ------------------------------------------------------------------ screens
  function hideScreens() {
    if (window.CatchLab) { try { window.CatchLab.hide(); } catch (e) {} }
    var screens = document.querySelectorAll('.screen');
    for (var i = 0; i < screens.length; i++) screens[i].classList.remove('active');
    if (ui.overlay) ui.overlay.style.pointerEvents = 'none';
    state.screen = null;
    if (ui.hud) ui.hud.classList.toggle('hidden', !state.inLevel);
  }

  function showScreen(name) {
    var screens = document.querySelectorAll('.screen');
    for (var i = 0; i < screens.length; i++) screens[i].classList.remove('active');
    var el = $('screen-' + name);
    if (el) el.classList.add('active');
    if (ui.overlay) ui.overlay.style.pointerEvents = name ? 'auto' : 'none';
    state.screen = name;
    if (ui.hud) ui.hud.classList.add('hidden');
    if (name === 'title') window.World.setMode('title');
    else if (name === 'harbor') window.World.setMode('harbor');
    else if (name === 'results' || name === 'final') window.World.setMode('results');
    if (name !== 'catch' && window.CatchLab) { try { window.CatchLab.hide(); } catch (e) {} }
  }

  function openHelp(returnTo) {
    state.helpReturn = returnTo || state.screen || 'title';
    showScreen('help');
  }

  function closeHelp() {
    var ret = state.helpReturn || 'title';
    if (ret === 'pause') showScreen('pause');
    else if (ret === 'harbor') showScreen('harbor');
    else if (ret === 'title') showScreen('title');
    else if (ret === 'bestiary') showScreen('bestiary');
    else hideScreens();
  }

  function pauseGame() {
    if (!state.inLevel || state.paused || state.phase === 'done') return;
    autosaveRun();
    if (state.phase === 'charging') cancelCharge();
    state.paused = true;
    state.actionHeld = false;
    state.giveLine = false;
    if (state.fight) { state.fight.reeling = false; state.fight.giveLine = false; }
    if (ui.pauseStats) {
      ui.pauseStats.innerHTML = 'WATER <b>' + state.level.name + '</b><br>QUOTA <b>' + state.quotaCount + ' / ' + state.level.quota.total + '</b><br>CASTS <b>' + state.casts + '</b> · LOST <b>' + state.fishLost + '</b><br>CREEL VALUE <b>◈ ' + state.runCoins + '</b>';
    }
    showScreen('pause');
    sfx('ui');
  }

  function resumeGame() {
    if (!state.paused) return;
    state.paused = false;
    hideScreens();
    if (ui.hud) ui.hud.classList.remove('hidden');
    sfx('ui');
  }

  function quitToHarbor() {
    if (state.fight && state.fight.active) { state.fight.active = false; window.World.clearFish(); }
    state.inLevel = false;
    state.paused = false;
    state.phase = 'idle';
    save.stats.playtime += state.playAccum;
    state.playAccum = 0;
    clearRun();
    showHarbor();
    saveNow();
  }

  // ------------------------------------------------------------------ input
  function recallLure() {
    if (!state.inLevel || state.paused || state.screen) return;
    if (state.phase !== 'waiting') return;
    state.biteMeter = 0;
    state.jigBoost = 0;
    state.jigCooldown = 0;
    state.pendingFish = null;
    window.World.endBite();
    beginNextCast();
    toast('LURE RECALLED · CAST WHERE YOU WANT', '');
    sfx('ui');
  }

  function actionDown() {
    if (!state.inLevel || state.paused || state.screen) return;
    if (state.phase === 'idle') { startCharge(); state.actionHeld = true; }
    else if (state.phase === 'bite') { strike(); }
    else if (state.phase === 'waiting') { jig(); }
    else if (state.phase === 'fighting') { state.actionHeld = true; }
  }

  function actionUp() {
    if (state.phase === 'charging') { releaseCast(); state.actionHeld = false; return; }
    state.actionHeld = false;
  }

  function adjustDepth(delta) {
    if (!state.inLevel || state.paused || state.screen) return;
    if (state.phase === 'fighting' || state.phase === 'landing' || state.phase === 'lost') return;
    if (!state.level) return;
    state.lureTarget = clamp(state.lureTarget + delta, 1, state.level.depthMax);
    if (ui.depthSlider) ui.depthSlider.value = String(state.lureTarget);
    updateDepthReadout();
    renderDepthBands();
    renderFeedLayer();
    window.World.setLureDepth(state.lureDepth, state.lureTarget);
    if (state.phase === 'waiting') setPrompt('WAIT FOR THE BITE', waitText());
  }

  function bindEvents() {
    document.addEventListener('pointerdown', function (e) {
      if (e.button !== undefined && e.button !== 0) return;
      if (!state.inLevel || state.paused || state.screen) return;
      var t = e.target;
      if (t && t.closest && t.closest('button, input, .panel, .screen, #pip, .toast')) return;
      actionDown();
    }, { passive: true });

    window.addEventListener('pointerup', function () { actionUp(); });
    window.addEventListener('pointercancel', function () { actionUp(); });
    window.addEventListener('blur', function () { state.actionHeld = false; });

    document.addEventListener('keydown', function (e) {
      if (e.code === 'Space') {
        if (state.screen) return;
        if (!state.inLevel) return;
        e.preventDefault();
        actionDown();
        return;
      }
      if (e.code === 'ArrowUp' || e.code === 'ArrowDown') {
        if (!state.inLevel || state.paused || state.screen) return;
        e.preventDefault();
        adjustDepth(e.code === 'ArrowUp' ? -1 : 1);
        return;
      }
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') { if (state.phase === 'fighting') state.giveLine = true; return; }
      if (e.code === 'Escape') {
        if (state.screen === 'help') { closeHelp(); return; }
        if (state.screen === 'pause') { resumeGame(); return; }
        if (state.screen === 'bestiary') { showScreen('harbor'); return; }
        if (state.screen === 'bounties') { showScreen('harbor'); return; }
        if (state.screen === 'catch') { return; }
        if (state.screen) return;
        if (state.inLevel) pauseGame();
        return;
      }
      if (e.key === 'm' || e.key === 'M') { toggleMute(); return; }
      if (e.key === 'r' || e.key === 'R') { recallLure(); return; }
      if (e.key === '1' || e.key === '2' || e.key === '3') {
        if (!state.inLevel || state.paused || state.screen) return;
        if (state.phase === 'fighting' || state.phase === 'landing' || state.phase === 'lost') return;
        var pool = (window.GAME_DATA && window.GAME_DATA.LURES) || [];
        var pick = pool[Number(e.key) - 1];
        if (pick) selectLure(pick.id);
        return;
      }
    });

    document.addEventListener('keyup', function (e) {
      if (e.code === 'Space') { actionUp(); }
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') state.giveLine = false;
    });

    document.addEventListener('wheel', function (e) {
      if (!state.inLevel || state.paused || state.screen) return;
      if (e.target && e.target.closest && e.target.closest('input')) return;
      if (state.phase === 'fighting') return;
      e.preventDefault();
      adjustDepth(e.deltaY > 0 ? 1 : -1);
    }, { passive: false });

    // buttons
    if (ui.btnContinue) ui.btnContinue.addEventListener('click', function () { ensureAudio(); showHarbor(); });
    if (ui.btnNew) ui.btnNew.addEventListener('click', newExpedition);
    if (ui.btnHelp) ui.btnHelp.addEventListener('click', function () { openHelp('title'); });
    if (ui.btnHelp2) ui.btnHelp2.addEventListener('click', function () { openHelp('harbor'); });
    if (ui.btnQuit) ui.btnQuit.addEventListener('click', showTitle);
    if (ui.btnResumeRun) ui.btnResumeRun.addEventListener('click', function () { ensureAudio(); resumeRun(); });
    if (ui.btnRecall) ui.btnRecall.addEventListener('click', function () { ensureAudio(); recallLure(); });
    if (ui.lureRow) ui.lureRow.addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('[data-lure]') : null;
      if (!b) return;
      ensureAudio();
      selectLure(b.getAttribute('data-lure'));
    });
    if (ui.btnBestiary) ui.btnBestiary.addEventListener('click', function () { renderBestiary(); showScreen('bestiary'); });
    if (ui.btnBounties) ui.btnBounties.addEventListener('click', function () { renderBounties(); showScreen('bounties'); });
    if (ui.bountyList) ui.bountyList.addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('[data-claim]') : null;
      if (b) { ensureAudio(); claimBounty(b.getAttribute('data-claim')); }
    });
    if (ui.charmList) ui.charmList.addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('[data-charm]') : null;
      if (b) { ensureAudio(); buyCharm(b.getAttribute('data-charm')); }
    });
    if (ui.btnMute) ui.btnMute.addEventListener('click', toggleMute);
    if (ui.btnMute2) ui.btnMute2.addEventListener('click', toggleMute);
    if (ui.btnPauseSound) ui.btnPauseSound.addEventListener('click', toggleMute);
    if (ui.btnAmbience) ui.btnAmbience.addEventListener('click', toggleAmbience);
    if (ui.btnPauseAmbience) ui.btnPauseAmbience.addEventListener('click', toggleAmbience);
    if (ui.btnExportSave) ui.btnExportSave.addEventListener('click', exportSave);
    if (ui.btnImportSave && ui.saveFile) ui.btnImportSave.addEventListener('click', function () { ui.saveFile.click(); });
    if (ui.saveFile) ui.saveFile.addEventListener('change', function () { if (this.files && this.files[0]) importSaveFile(this.files[0]); this.value = ''; });
    if (ui.btnPause) ui.btnPause.addEventListener('click', pauseGame);
    if (ui.btnResume) ui.btnResume.addEventListener('click', resumeGame);
    if (ui.btnPauseHelp) ui.btnPauseHelp.addEventListener('click', function () { openHelp('pause'); });
    if (ui.btnPauseHarbor) ui.btnPauseHarbor.addEventListener('click', quitToHarbor);
    if (ui.btnCatchOk) ui.btnCatchOk.addEventListener('click', closeCatch);
    if (ui.btnNextLevel) ui.btnNextLevel.addEventListener('click', function () { nextFromResults(); });
    if (ui.btnReplay) ui.btnReplay.addEventListener('click', replayLevel);
    if (ui.btnResultHarbor) ui.btnResultHarbor.addEventListener('click', showHarbor);
    if (ui.btnFinalHarbor) ui.btnFinalHarbor.addEventListener('click', showHarbor);
    if (ui.btnAction) {
      ui.btnAction.addEventListener('pointerdown', function (e) { e.preventDefault(); actionDown(); });
      ui.btnAction.addEventListener('pointerup', function (e) { e.preventDefault(); actionUp(); });
      ui.btnAction.addEventListener('pointercancel', actionUp);
      ui.btnAction.addEventListener('pointerleave', function () { if (state.phase === 'fighting') actionUp(); });
    }
    if (ui.btnGive) {
      ui.btnGive.addEventListener('pointerdown', function (e) { e.preventDefault(); if (state.phase === 'fighting') state.giveLine = true; });
      ui.btnGive.addEventListener('pointerup', function (e) { e.preventDefault(); state.giveLine = false; });
      ui.btnGive.addEventListener('pointercancel', function () { state.giveLine = false; });
      ui.btnGive.addEventListener('pointerleave', function () { state.giveLine = false; });
    }

    if (ui.levelList) {
      ui.levelList.addEventListener('click', function (e) {
        var card = e.target.closest ? e.target.closest('[data-level]') : null;
        if (!card) return;
        ensureAudio();
        sfx('ui');
        startLevel(Number(card.getAttribute('data-level')));
      });
    }
    if (ui.shopList) {
      ui.shopList.addEventListener('click', function (e) {
        var btn = e.target.closest ? e.target.closest('[data-upgrade]') : null;
        if (!btn) return;
        ensureAudio();
        buyUpgrade(btn.getAttribute('data-upgrade'));
      });
    }
    if (ui.depthDown) ui.depthDown.addEventListener('click', function () { adjustDepth(-1); });
    if (ui.depthUp) ui.depthUp.addEventListener('click', function () { adjustDepth(1); });
    if (ui.depthSlider) {
      ui.depthSlider.addEventListener('input', function () {
        if (!state.level) return;
        state.lureTarget = clamp(Number(ui.depthSlider.value) || 1, 1, state.level.depthMax);
        updateDepthReadout();
        renderDepthBands();
        window.World.setLureDepth(state.lureDepth, state.lureTarget);
      });
    }

    var closes = document.querySelectorAll('[data-close]');
    for (var i = 0; i < closes.length; i++) {
      (function (el) {
        el.addEventListener('click', function () {
          var target = el.getAttribute('data-close');
          if (target === 'screen-help') closeHelp();
          else if (target === 'screen-bestiary') showScreen('harbor');
          else if (target === 'screen-bounties') showScreen('harbor');
        });
      })(closes[i]);
    }

    window.addEventListener('resize', function () { if (window.World) window.World.resize(); });
    window.addEventListener('beforeunload', function () {
      if (skipSaveOnUnload) return;
      if (state.inLevel) snapshotRun();
      saveNow();
    });
    window.addEventListener('pagehide', function () {
      if (skipSaveOnUnload) return;
      if (state.inLevel) snapshotRun();
      saveNow();
    });
    document.addEventListener('visibilitychange', function () {
      if (document.hidden && state.inLevel) { snapshotRun(); saveNow(); }
    });

    if (ui.depthSlider && !ui.depthSlider.value) ui.depthSlider.value = '6';
  }

  function newExpedition() {
    if (save.startedAt) {
      var ok = window.confirm('Start a new expedition? Your coins, upgrades and bestiary will be erased.');
      if (!ok) return;
    }
    var wasMuted = !!(save.settings && save.settings.muted);
    var wasAmbience = !!(save.settings && save.settings.ambience);
    var wasLure = (save.settings && save.settings.lure) || 'minnow';
    save = defaultSave();
    save.startedAt = Date.now();
    ensureBounties();
    save.settings.muted = wasMuted;
    save.settings.ambience = wasAmbience;
    save.settings.lure = lureById(wasLure).id;
    if (window.AudioKit) {
      try { window.AudioKit.setMuted(wasMuted); } catch (e) {}
      try { if (window.AudioKit.setAmbientEnabled) window.AudioKit.setAmbientEnabled(wasAmbience); } catch (e) {}
    }
    state.level = null;
    if (window.World) {
      window.World.clearFish();
      window.World.reset();
      window.World.hideSchool();
      window.World.setLevel(LEVELS[0]);
      window.World.setMode('harbor');
    }
    state.inLevel = false;
    state.screen = null;
    state.paused = false;
    showHarbor();
    toast('NEW EXPEDITION · CATCH SOMETHING WORTH KEEPING', 'good');
  }

  // ------------------------------------------------------------------ debug (query-gated)
  var Game = window.Game = {};
  Game.version = '1.6.1';
  Game.getState = function () { return state; };
  Game.getSave = function () { return save; };
  Game.startLevel = startLevel;
  Game.renderHarbor = renderHarbor;
  if (location.search.indexOf('debug=1') !== -1) {
    Game.debug = {
      coins: function (n) { save.coins += Number(n) || 0; saveNow(); renderHarbor(); },
      unlockAll: function () { save.unlocked = LEVELS.length; saveNow(); renderHarbor(); },
      hook: function (id) {
        if (!state.inLevel) startLevel(state.level ? state.level.index : 1);
        var lv = state.level || LEVELS[0];
        var def = FISH[id] || FISH[lv.species[0]];
        state.lureDepth = (def.depth[0] + def.depth[1]) / 2;
        hookFish(def);
        return def.id;
      },
      land: function () { if (state.fight.active) state.fight.depth = 0.5; },
      lose: function () { if (state.fight.active) loseFish('DEBUG LOSS'); },
      win: function () { if (state.inLevel) finishLevel(); },
      bite: function (id) {
        var lv = state.level || LEVELS[0];
        var def = id ? FISH[id] : FISH[lv.species[0]];
        triggerBite(def);
      },
      state: state,
      save: function () { return save; }
    };
  }

  // boot
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
