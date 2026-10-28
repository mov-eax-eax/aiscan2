/* =========================================================================
   MARIO 3-2 — hud.js
   HUD binding, score/coin/time/lives/power readouts, swim-stroke pips, SMB3
   minimap strip, title/pause overlays, queued toasts and screen flash.
   Owned by UI. Public: window.M32.Hud
   ========================================================================= */
(function () {
  'use strict';
  window.M32 = window.M32 || {};
  const M = window.M32;
  const PIP_COUNT = 10;

  function byId(id) {
    return typeof document !== 'undefined' ? document.getElementById(id) : null;
  }

  function setText(el, value) {
    if (!el) return;
    if (el.textContent !== value) el.textContent = value;
  }

  function hasClass(el, cls) {
    return !!(el && el.classList && el.classList.contains(cls));
  }

  function toggleClass(el, cls, on) {
    if (!el || !el.classList) return;
    if (hasClass(el, cls) !== !!on) el.classList.toggle(cls, !!on);
  }

  function pad(n, len) {
    let s = String(Math.max(0, Math.floor(n)));
    while (s.length < len) s = '0' + s;
    return s;
  }

  function normPower(power) {
    const p = String(power == null ? 'small' : power).toLowerCase();
    if (p === 'frog') return { key: 'frog', label: 'FROG' };
    if (p === 'star' || p === 'invincible' || p === 'starman') return { key: 'star', label: 'STAR' };
    if (p === 'big' || p === 'super') return { key: 'super', label: 'SUPER' };
    return { key: 'small', label: 'SMALL' };
  }

  const TONES = ['info', 'coin', 'power', 'warn'];

  /* ================================================================ Hud */
  M32.Hud = class Hud {
    constructor() {
      this.game = null;
      this._bound = false;
      this._level = null;

      this.el = {
        app: byId('app'),
        hud: byId('hud'),
        score: byId('score'),
        coins: byId('coins'),
        world: byId('world'),
        time: byId('time'),
        lives: byId('lives'),
        power: byId('power'),
        powerIcon: byId('power-icon'),
        strokes: byId('strokes'),
        minimap: byId('minimap'),
        track: byId('minimap-track'),
        fill: byId('minimap-fill'),
        dot: byId('minimap-dot'),
        marks: byId('minimap-marks'),
        minimapLabel: byId('minimap-label'),
        overlay: byId('overlay'),
        card: byId('overlay-card'),
        kicker: byId('overlay-kicker'),
        title: byId('overlay-title'),
        sub: byId('overlay-sub'),
        hint: byId('overlay-hint'),
        keys: byId('overlay-keys'),
        pause: byId('pause'),
        toast: byId('toast'),
      };

      // last-written values: the HUD is DOM-write free when nothing changed
      this._cache = {
        score: null, coins: null, world: null, time: null, lives: null,
        low: null, critical: null, powerKey: null, state: null,
        mapVisible: null, pct: null, paused: null,
      };

      // swim pips
      this._pips = [];
      this._pipOn = -1;
      this._strokeMeter = 0;
      this._buildPips();

      // toasts
      this._toastQueue = [];
      this._toastActive = false;
      this._toastTimer = 0;
      this._toastGap = 0;

      // minimap
      this._marksKey = '';
      this._markEls = [];
      this.minimap = this.el.minimap;

      // flash
      this._flashEl = null;
      this._paused = false;
      this._overlayVisible = false;
    }

    /* -------------------------------------------------------------- setup */
    bind(game) {
      this.game = game || M.Game || null;
      this._bound = true;
      this._level = (this.game && this.game.level) || (M.LEVEL || null);
      this._buildMinimapMarks(true);
      this._syncVisibility(true);
      this.update(0);
      return this;
    }

    /* -------------------------------------------------------------- update */
    update(dt) {
      dt = typeof dt === 'number' && isFinite(dt) ? Math.min(Math.max(dt, 0), 0.1) : 0;
      const g = this.game || M.Game || null;

      this._updateToast(dt);

      if (!g) {
        this._syncVisibility(true);
        return;
      }

      this._syncVisibility(false);

      // ---- scalar readouts (only writes on change)
      const score = Math.max(0, Math.floor(g.score || 0));
      const scoreStr = score > 999999 ? String(score) : pad(score, 6);
      if (scoreStr !== this._cache.score) {
        this._cache.score = scoreStr;
        setText(this.el.score, scoreStr);
      }

      const coins = Math.max(0, Math.floor(g.coins || 0));
      const coinStr = 'x' + (coins > 99 ? String(coins) : pad(coins, 2));
      if (coinStr !== this._cache.coins) {
        this._cache.coins = coinStr;
        setText(this.el.coins, coinStr);
      }

      const level = (g.level) || this._level || M.LEVEL || null;
      const worldStr = (level && level.name ? String(level.name) : '3-2');
      if (worldStr !== this._cache.world) {
        this._cache.world = worldStr;
        setText(this.el.world, worldStr);
      }

      const lives = Math.max(0, Math.floor(g.lives != null ? g.lives : 0));
      const lifeStr = 'x' + (lives > 99 ? String(lives) : String(lives));
      if (lifeStr !== this._cache.lives) {
        this._cache.lives = lifeStr;
        setText(this.el.lives, lifeStr);
      }

      // ---- timer + urgency classes
      const timer = Math.max(0, Math.ceil(g.timer != null ? g.timer : 0));
      const timeStr = timer > 999 ? String(timer) : pad(timer, 3);
      if (timeStr !== this._cache.time) {
        this._cache.time = timeStr;
        setText(this.el.time, timeStr);
      }
      const low = timer < 100;
      const critical = timer < 50;
      if (low !== this._cache.low) {
        this._cache.low = low;
        toggleClass(this.el.time, 'low', low);
      }
      if (critical !== this._cache.critical) {
        this._cache.critical = critical;
        toggleClass(this.el.time, 'critical', critical);
      }

      // ---- power state (star invincibility overrides)
      const player = g.player || null;
      let power = (g.power != null ? g.power : 'small');
      if (player) {
        if (player.invincible || (player.starTime || 0) > 0) power = 'star';
        else if (typeof player.power === 'string' && player.power) power = player.power;
      }
      this._applyPower(power);

      // ---- swim pips
      this._updatePips(dt, player);

      // ---- minimap
      this._updateMinimap(g, player, level);

      // ---- pause card tracks game state (explicit setPaused also works)
      const paused = (g.state === 'pause') || this._paused;
      if (paused !== this._cache.paused) {
        this._cache.paused = paused;
        toggleClass(this.el.pause, 'visible', paused);
      }
    }

    /* -------------------------------------------------------------- overlays */
    /**
     * overlay(kicker, title, sub, hint, opts)
     * hint may contain simple HTML (main.js passes <b> key hints).
     * opts: {keys:false} hides the key legend; {kicker,title,sub,hint} object form also accepted.
     */
    overlay(kicker, title, sub, hint, opts) {
      if (kicker && typeof kicker === 'object') {
        const o = kicker;
        opts = title || o;
        kicker = o.kicker;
        title = o.title;
        sub = o.sub;
        hint = o.hint;
      }
      opts = opts || {};

      setText(this.el.kicker, kicker == null ? '' : String(kicker));
      setText(this.el.title, title == null ? '' : String(title));
      setText(this.el.sub, sub == null ? '' : String(sub));
      if (this.el.hint) {
        const h = hint == null ? '' : String(hint);
        if (this.el.hint.innerHTML !== h) this.el.hint.innerHTML = h;
      }
      toggleClass(this.el.card, 'no-keys', opts.keys === false);
      if (this.el.card) this.el.card.scrollTop = 0;

      // clear a previous tally panel when the overlay is reused for another screen
      if (this.el.card && this.el.card.querySelector) {
        const oldWrap = this.el.card.querySelector('.clear-cards');
        if (Array.isArray(opts.cards)) {
          this.showCards(opts.cards);
        } else if (oldWrap && oldWrap.parentNode) {
          oldWrap.parentNode.removeChild(oldWrap);
        }
      }

      toggleClass(this.el.overlay, 'visible', true);
      this._overlayVisible = true;
    }

    hideOverlay() {
      toggleClass(this.el.overlay, 'visible', false);
      this._overlayVisible = false;
    }

    /** optional end-of-level tally cards rendered inside the overlay card */
    showCards(cards, opts) {
      const card = this.el.card;
      if (!card) return;
      let wrap = card.querySelector ? card.querySelector('.clear-cards') : null;
      if (!wrap) {
        wrap = document.createElement('div');
        wrap.className = 'clear-cards';
        card.appendChild(wrap);
      }
      wrap.textContent = '';
      if (Array.isArray(cards)) {
        for (let i = 0; i < cards.length; i++) {
          const c = cards[i] || {};
          const row = document.createElement('div');
          row.className = 'clear-card';
          const label = document.createElement('span');
          label.className = 'cc-label';
          label.textContent = c.label == null ? '' : String(c.label);
          const value = document.createElement('span');
          value.className = 'cc-value';
          value.textContent = c.value == null ? '' : String(c.value);
          row.appendChild(label);
          row.appendChild(value);
          wrap.appendChild(row);
        }
      }
      if (opts && opts.title) setText(this.el.title, String(opts.title));
    }

    /* ---------------------------------------------------------------- power */
    setPower(power) {
      this._applyPower(power);
    }

    _applyPower(power) {
      const info = normPower(power);
      if (info.key === this._cache.powerKey) return;
      this._cache.powerKey = info.key;
      const el = this.el.power;
      if (el && el.classList) {
        el.classList.remove('small', 'super', 'frog', 'star');
        el.classList.add(info.key);
      }
      setText(this.el.powerIcon, info.label);
    }

    /* ---------------------------------------------------------------- toasts */
    /**
     * toast(text, {ms=1600, tone='info'})
     * Tones: 'coin' (gold), 'power' (green), 'warn' (red), 'info' (white).
     * Queued so messages never clip each other.
     */
    toast(text, opts) {
      if (!this.el.toast) return;
      opts = opts || {};
      const tone = TONES.indexOf(opts.tone) >= 0 ? opts.tone : 'info';
      const ms = typeof opts.ms === 'number' && isFinite(opts.ms) ? Math.max(200, opts.ms) : 1600;
      const item = { text: text == null ? '' : String(text), tone: tone, ms: ms };

      if (this._toastActive) {
        this._toastQueue.push(item);
        if (this._toastQueue.length > 8) this._toastQueue.shift();
        return;
      }
      this._showToast(item);
    }

    _showToast(item) {
      const el = this.el.toast;
      if (!el) return;
      this._toastActive = true;
      this._toastTimer = item.ms / 1000;
      this._toastGap = 0;
      el.textContent = item.text;
      if (el.classList) {
        el.classList.remove('show', 'tone-info', 'tone-coin', 'tone-power', 'tone-warn');
        el.classList.add('tone-' + item.tone);
        // restart the pop animation even when a toast is shown back-to-back
        void el.offsetWidth;
        el.classList.add('show');
      }
    }

    _updateToast(dt) {
      if (this._toastActive) {
        this._toastTimer -= dt;
        if (this._toastTimer <= 0) {
          this._toastActive = false;
          toggleClass(this.el.toast, 'show', false);
          this._toastGap = 0.16;
        }
        return;
      }
      if (this._toastGap > 0) {
        this._toastGap -= dt;
        if (this._toastGap > 0) return;
      }
      if (this._toastQueue.length) this._showToast(this._toastQueue.shift());
    }

    /* ---------------------------------------------------------------- flash */
    flash() {
      const app = this.el.app || (typeof document !== 'undefined' ? document.body : null);
      if (!app || typeof document === 'undefined') return;
      if (this._flashEl && this._flashEl.parentNode) {
        this._flashEl.parentNode.removeChild(this._flashEl);
      }
      const div = document.createElement('div');
      div.className = 'flash';
      app.appendChild(div);
      this._flashEl = div;
      const self = this;
      if (typeof setTimeout === 'function') {
        setTimeout(function () {
          if (div.parentNode) div.parentNode.removeChild(div);
          if (self._flashEl === div) self._flashEl = null;
        }, 220);
      }
    }

    /* ---------------------------------------------------------------- pause */
    setPaused(on) {
      this._paused = !!on;
      const visible = this._paused || !!(this.game && this.game.state === 'pause');
      if (visible !== this._cache.paused) {
        this._cache.paused = visible;
        toggleClass(this.el.pause, 'visible', visible);
      }
    }

    /* ----------------------------------------------------------- internals */
    _buildPips() {
      const box = this.el.strokes;
      if (!box || typeof document === 'undefined') return;
      if (box.children && box.children.length === PIP_COUNT && box.getAttribute('data-ready') === '1') {
        this._pips = Array.prototype.slice.call(box.children);
        return;
      }
      box.textContent = '';
      this._pips = [];
      for (let i = 0; i < PIP_COUNT; i++) {
        const pip = document.createElement('span');
        pip.className = 'pip';
        box.appendChild(pip);
        this._pips.push(pip);
      }
      box.setAttribute('data-ready', '1');
    }

    _updatePips(dt, player) {
      let norm = -1;

      if (player) {
        if (typeof player.strokeMeter === 'number' && isFinite(player.strokeMeter)) {
          let max = 1;
          if (typeof player.strokeMeterMax === 'number' && player.strokeMeterMax > 0) {
            max = player.strokeMeterMax;
          } else if (player.strokeMeter > 1.5) {
            max = 10;
          }
          norm = M.clamp(player.strokeMeter / max, 0, 1);
        }
      }

      if (norm < 0) {
        // no player meter: drive a decaying display from the input edge
        const input = M.Input;
        if (input && input.strokePressed) this._strokeMeter += 0.17;
        this._strokeMeter = M.clamp(this._strokeMeter - dt * 0.55, 0, 1);
        norm = this._strokeMeter;
      }

      const on = Math.round(norm * PIP_COUNT);
      if (on === this._pipOn) return;
      this._pipOn = on;
      for (let i = 0; i < this._pips.length; i++) {
        toggleClass(this._pips[i], 'on', i < on);
      }
    }

    _syncVisibility(force) {
      const g = this.game || M.Game || null;
      const state = g ? g.state : 'boot';
      const showHud = state === 'play' || state === 'pause' || state === 'dead' || state === 'clear';
      if (showHud !== this._cache.state || force) {
        this._cache.state = showHud;
        toggleClass(this.el.hud, 'hidden', !showHud);
      }

      // The minimap is a "progress overview", never an in-play overlay: at the
      // 480-tall camera the strip would sit right on Mario at spawn / on the
      // beach goal. Show it only while gameplay is not actively running.
      const level = this._level || (g && g.level) || M.LEVEL || null;
      const showMap = !!level &&
        (state === 'title' || state === 'pause' || state === 'gameover');
      if (showMap !== this._cache.mapVisible || force) {
        this._cache.mapVisible = showMap;
        toggleClass(this.el.minimap, 'hidden', !showMap);
      }
    }

    /* -------------------------------------------------------------- minimap */
    _buildMinimapMarks(force) {
      const marks = this.el.marks;
      const level = this.game && this.game.level ? this.game.level : (M.LEVEL || null);
      this._level = level || this._level;
      if (!marks || typeof document === 'undefined') return;

      const width = (level && isFinite(level.width) ? level.width : (M.C ? M.C.WORLD_W : 6400)) || 6400;
      const list = [];

      if (level) {
        const marksData = Array.isArray(level.progressMarks) ? level.progressMarks : [];
        for (let i = 0; i < marksData.length; i++) {
          const m = marksData[i];
          if (m == null) continue;
          let x = 0;
          let label = '';
          if (typeof m === 'number' || typeof m === 'string') {
            x = Number(m);
            if (!isFinite(x)) continue;
          } else if (typeof m === 'object') {
            if (!isFinite(m.x)) continue;
            x = m.x;
            label = m.label == null ? '' : String(m.label);
          } else {
            continue;
          }
          list.push({ x: x, label: label, goal: false });
        }

        // the level may mark the start anywhere in the first ~2% of the strip
        let hasStart = false;
        for (let i = 0; i < list.length; i++) if (list[i].x <= width * 0.02) hasStart = true;
        if (!hasStart) list.unshift({ x: 0, label: 'START', goal: false });

        const goalX = level.goal && isFinite(level.goal.x) ? level.goal.x : null;
        if (goalX != null) {
          let hasGoal = false;
          for (let i = 0; i < list.length; i++) {
            if (Math.abs(list[i].x - goalX) < width * 0.01) hasGoal = true;
          }
          if (!hasGoal) list.push({ x: goalX, label: 'GOAL', goal: true });
        }
      }

      const key = width + '|' + list.map(function (m) { return Math.round(m.x) + ':' + m.label; }).join('|');
      if (!force && key === this._marksKey) return;
      this._marksKey = key;

      marks.textContent = '';
      this._markEls = [];
      for (let i = 0; i < list.length; i++) {
        const m = list[i];
        const el = document.createElement('i');
        el.className = 'mm-mark' + (m.goal ? ' goal' : '');
        el.style.left = M.clamp((m.x / width) * 100, 0, 100).toFixed(2) + '%';
        if (m.label) {
          const b = document.createElement('b');
          b.textContent = m.label;
          el.appendChild(b);
        }
        marks.appendChild(el);
        this._markEls.push(el);
      }

      if (this.el.minimapLabel && level && level.name) {
        setText(this.el.minimapLabel, String(level.name) + ' · UNDERWATER');
      }
    }

    _updateMinimap(g, player, level) {
      if (!this._bound) return;
      if (!level) level = this._level || M.LEVEL || null;
      if (!level) {
        if (this._cache.mapVisible !== false) {
          this._cache.mapVisible = false;
          toggleClass(this.el.minimap, 'hidden', true);
        }
        return;
      }
      if (!this._cache.mapVisible) return;

      const width = isFinite(level.width) && level.width > 0 ? level.width : 6400;
      const px = player && isFinite(player.x) ? player.x : 0;
      const pct = M.clamp((px / width) * 100, 0, 100);
      if (this._cache.pct == null || Math.abs(pct - this._cache.pct) > 0.06) {
        this._cache.pct = pct;
        const s = pct.toFixed(2) + '%';
        if (this.el.dot) this.el.dot.style.left = s;
        if (this.el.fill) this.el.fill.style.width = s;
      }
    }
  };

  // expose sprite-ish helpers for potential HUD use later (no-op if unused)
  M32.Hud.PIP_COUNT = PIP_COUNT;
})();
