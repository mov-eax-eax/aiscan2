/* =========================================================================
   MARIO 3-2 — particles.js
   Pooled GPU point-sprite particle system: bubbles, dots, sparks, stars and
   expanding rings. One THREE.Points draw call, one 5-cell canvas texture atlas.
   Owned by UI. Public: window.M32.Particles
   ========================================================================= */
(function () {
  'use strict';
  window.M32 = window.M32 || {};
  const M = window.M32;

  const SPRITES = ['bubble', 'dot', 'spark', 'star', 'ring'];
  const SPRITE_INDEX = { bubble: 0, dot: 1, spark: 2, star: 3, ring: 4 };
  const CELL = 64;
  const CAP = 512;          // hard pool cap (~500 as specified)
  const MAX_BURST = 96;     // per-call clamp so one event cannot drain the pool
  const Z = 6;              // render layer above gameplay (z=0)

  /* ------------------------------------------------------------ textures */
  function drawSprite(g, name, size) {
    const c = size / 2;
    g.clearRect(0, 0, size, size);
    g.save();
    g.translate(c, c);
    g.fillStyle = '#ffffff';
    g.strokeStyle = '#ffffff';
    g.lineJoin = 'round';
    g.lineCap = 'round';

    if (name === 'bubble') {
      // bright rim + a soft inner glow, classic SMB3 underwater bubble
      const r = c * 0.74;
      g.lineWidth = c * 0.14;
      g.globalAlpha = 1;
      g.beginPath();
      g.arc(0, 0, r, 0, Math.PI * 2);
      g.stroke();
      const grad = g.createRadialGradient(-r * 0.25, -r * 0.25, r * 0.05, 0, 0, r);
      grad.addColorStop(0, 'rgba(255,255,255,0.34)');
      grad.addColorStop(0.72, 'rgba(255,255,255,0.06)');
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grad;
      g.beginPath();
      g.arc(0, 0, r, 0, Math.PI * 2);
      g.fill();
      // highlight glint
      g.fillStyle = 'rgba(255,255,255,0.95)';
      g.beginPath();
      g.arc(-r * 0.34, -r * 0.34, r * 0.16, 0, Math.PI * 2);
      g.fill();
    } else if (name === 'dot') {
      const r = c * 0.8;
      const grad = g.createRadialGradient(0, 0, 0, 0, 0, r);
      grad.addColorStop(0, 'rgba(255,255,255,1)');
      grad.addColorStop(0.45, 'rgba(255,255,255,0.7)');
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grad;
      g.beginPath();
      g.arc(0, 0, r, 0, Math.PI * 2);
      g.fill();
    } else if (name === 'spark') {
      // four-point star with a hot core
      const r = c * 0.9;
      g.beginPath();
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
        const rr = i % 2 === 0 ? r : r * 0.16;
        if (i === 0) g.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
        else g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
      }
      g.closePath();
      g.fillStyle = 'rgba(255,255,255,0.95)';
      g.fill();
      g.fillStyle = 'rgba(255,255,255,1)';
      g.beginPath();
      g.arc(0, 0, r * 0.2, 0, Math.PI * 2);
      g.fill();
    } else if (name === 'star') {
      // chunky five-point star
      const r = c * 0.86;
      g.beginPath();
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
        const rr = i % 2 === 0 ? r : r * 0.44;
        if (i === 0) g.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
        else g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
      }
      g.closePath();
      g.fillStyle = 'rgba(255,255,255,0.96)';
      g.fill();
      g.lineWidth = c * 0.05;
      g.strokeStyle = 'rgba(255,255,255,1)';
      g.stroke();
    } else if (name === 'ring') {
      const r = c * 0.66;
      g.lineWidth = c * 0.16;
      g.beginPath();
      g.arc(0, 0, r, 0, Math.PI * 2);
      g.strokeStyle = 'rgba(255,255,255,0.95)';
      g.stroke();
      g.lineWidth = c * 0.05;
      g.beginPath();
      g.arc(0, 0, r * 1.16, 0, Math.PI * 2);
      g.strokeStyle = 'rgba(255,255,255,0.45)';
      g.stroke();
    } else {
      // 'dot' fallback
      g.fillStyle = 'rgba(255,255,255,1)';
      g.beginPath();
      g.arc(0, 0, c * 0.5, 0, Math.PI * 2);
      g.fill();
    }
    g.restore();
  }

  function buildAtlas() {
    const canvas = document.createElement('canvas');
    canvas.width = CELL * SPRITES.length;
    canvas.height = CELL;
    const g = canvas.getContext('2d');
    if (g) {
      g.clearRect(0, 0, canvas.width, canvas.height);
      for (let i = 0; i < SPRITES.length; i++) {
        g.save();
        g.translate(i * CELL, 0);
        drawSprite(g, SPRITES[i], CELL);
        g.restore();
      }
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearFilter;
    tex.generateMipmaps = false;
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.needsUpdate = true;
    return tex;
  }

  const soloTexCache = Object.create(null);
  function soloTexture(name) {
    if (soloTexCache[name]) return soloTexCache[name];
    const canvas = document.createElement('canvas');
    canvas.width = CELL;
    canvas.height = CELL;
    const g = canvas.getContext('2d');
    if (g) drawSprite(g, name, CELL);
    const tex = new THREE.CanvasTexture(canvas);
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearFilter;
    tex.generateMipmaps = false;
    soloTexCache[name] = tex;
    return tex;
  }

  /* ------------------------------------------------------------- helpers */
  function num(v, fallback) {
    return typeof v === 'number' && isFinite(v) ? v : fallback;
  }

  /** normalize any of: hex number, '#rrggbb', {r,g,b} 0..1, THREE.Color */
  function readColor(color, out) {
    if (Array.isArray(color) && color.length) {
      color = color[(Math.random() * color.length) | 0];
    }
    if (typeof color === 'number' && isFinite(color)) {
      out[0] = ((color >> 16) & 255) / 255;
      out[1] = ((color >> 8) & 255) / 255;
      out[2] = (color & 255) / 255;
      return out;
    }
    if (typeof color === 'string') {
      let s = color.trim();
      if (s.charAt(0) === '#') s = s.slice(1);
      if (s.length === 3) {
        const r = parseInt(s.charAt(0) + s.charAt(0), 16);
        const g = parseInt(s.charAt(1) + s.charAt(1), 16);
        const b = parseInt(s.charAt(2) + s.charAt(2), 16);
        if (isFinite(r) && isFinite(g) && isFinite(b)) {
          out[0] = r / 255; out[1] = g / 255; out[2] = b / 255;
          return out;
        }
      } else if (s.length >= 6) {
        const n = parseInt(s.slice(0, 6), 16);
        if (isFinite(n)) {
          out[0] = ((n >> 16) & 255) / 255;
          out[1] = ((n >> 8) & 255) / 255;
          out[2] = (n & 255) / 255;
          return out;
        }
      }
    }
    if (color && typeof color === 'object') {
      if (typeof color.r === 'number') {
        out[0] = color.r; out[1] = num(color.g, color.r); out[2] = num(color.b, color.r);
        return out;
      }
      if (typeof color.getHex === 'function') return readColor(color.getHex(), out);
    }
    out[0] = out[1] = out[2] = 1;
    return out;
  }

  /* ---------------------------------------------------------------- shader */
  const VERT = [
    'uniform float uScale;',
    'attribute vec3 aColor;',
    'attribute float aSize;',
    'attribute float aAlpha;',
    'attribute float aSprite;',
    'varying vec3 vColor;',
    'varying float vAlpha;',
    'varying float vSprite;',
    'void main() {',
    '  vec4 mv = modelViewMatrix * vec4(position, 1.0);',
    '  gl_Position = projectionMatrix * mv;',
    '  gl_PointSize = max(1.0, aSize * uScale);',
    '  vColor = aColor;',
    '  vAlpha = aAlpha;',
    '  vSprite = aSprite;',
    '}',
  ].join('\n');

  const FRAG = [
    'precision mediump float;',
    'uniform sampler2D uTex;',
    'varying vec3 vColor;',
    'varying float vAlpha;',
    'varying float vSprite;',
    'void main() {',
    '  vec2 uv = gl_PointCoord;',
    '  uv.x = (uv.x + vSprite) * 0.2;',
    '  vec4 tex = texture2D(uTex, uv);',
    '  float a = tex.a * vAlpha;',
    '  if (a < 0.004) discard;',
    '  gl_FragColor = vec4(vColor * tex.rgb, a);',
    '}',
  ].join('\n');

  /* ============================================================== class */
  M32.Particles = class Particles {
    /** @param {THREE.Scene} scene */
    constructor(scene) {
      this.scene = scene || null;
      this.capacity = CAP;
      this.count = 0;

      this._live = new Int16Array(CAP);     // dense list of active pool indices
      this._free = new Int16Array(CAP);     // free slot stack
      this._freeCount = CAP;
      this._pool = new Array(CAP);
      this._rng = Math.random;

      for (let i = 0; i < CAP; i++) {
        this._free[i] = CAP - 1 - i;
        this._pool[i] = {
          alive: false,
          x: 0, y: 0,
          vx: 0, vy: 0,
          gravity: 0, drag: 1,
          age: 0, life: 1,
          size0: 4, size1: 4, curSize: 4,
          baseAlpha: 1, curAlpha: 0,
          wobbleAmp: 0, wobbleFreq: 0, phase: 0,
          sprite: 0,
          r: 1, g: 1, b: 1,
        };
      }

      // geometry — dynamically updated, packed into [0, count)
      const pos = new Float32Array(CAP * 3);
      const col = new Float32Array(CAP * 3);
      const size = new Float32Array(CAP);
      const alpha = new Float32Array(CAP);
      const sprite = new Float32Array(CAP);
      const geo = new THREE.BufferGeometry();
      const pAttr = new THREE.BufferAttribute(pos, 3);
      const cAttr = new THREE.BufferAttribute(col, 3);
      const sAttr = new THREE.BufferAttribute(size, 1);
      const aAttr = new THREE.BufferAttribute(alpha, 1);
      const spAttr = new THREE.BufferAttribute(sprite, 1);
      pAttr.setUsage(THREE.DynamicDrawUsage);
      cAttr.setUsage(THREE.DynamicDrawUsage);
      sAttr.setUsage(THREE.DynamicDrawUsage);
      aAttr.setUsage(THREE.DynamicDrawUsage);
      spAttr.setUsage(THREE.DynamicDrawUsage);
      geo.setAttribute('position', pAttr);
      geo.setAttribute('aColor', cAttr);
      geo.setAttribute('aSize', sAttr);
      geo.setAttribute('aAlpha', aAttr);
      geo.setAttribute('aSprite', spAttr);
      geo.setDrawRange(0, 0);
      // a generous static bounds so frustum culling never eats live particles
      geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, Z), 1e6);

      this.atlas = buildAtlas();
      this.material = new THREE.ShaderMaterial({
        uniforms: {
          uTex: { value: this.atlas },
          uScale: { value: 1 },
        },
        vertexShader: VERT,
        fragmentShader: FRAG,
        transparent: true,
        depthWrite: false,
        depthTest: true,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
        fog: false,
      });

      this.points = new THREE.Points(geo, this.material);
      this.points.name = 'particles';
      this.points.frustumCulled = false;
      this.points.renderOrder = 20;
      this.points.visible = true;
      this.geometry = geo;
      this._pos = pos;
      this._col = col;
      this._size = size;
      this._alpha = alpha;
      this._sprite = sprite;
      this._geoCount = 0;
      this._scale = 0;

      if (this.scene && this.scene.add) this.scene.add(this.points);
      this._syncScale(0);
    }

    /* -------------------------------------------------------- public API */

    /**
     * burst(x, y, opts) — also accepts burst({x,y}, opts)
     * opts: {count, color, speed, size, life, gravity, spread, sprite, drag, alpha}
     */
    burst(x, y, opts) {
      if (x && typeof x === 'object') {
        const pos = x;
        opts = y || {};
        y = pos.y;
        x = pos.x;
      }
      opts = opts || {};
      const countRaw = Math.round(num(opts.count, 10));
      const count = Math.max(1, Math.min(MAX_BURST, countRaw));
      const speed = num(opts.speed, 180);
      const size = num(opts.size, 6);
      const life = num(opts.life, 0.8);
      const gravity = num(opts.gravity, -80);
      const drag = num(opts.drag, 1.2);
      const alpha = M.clamp(num(opts.alpha, 0.95), 0, 1);
      const spread = opts.spread || 'circle';
      const spriteName = SPRITES.indexOf(opts.sprite) >= 0 ? opts.sprite : 'bubble';
      const spriteIdx = SPRITE_INDEX[spriteName];
      const colorArr = [1, 1, 1];
      const colors = Array.isArray(opts.color) && opts.color.length ? opts.color : null;

      const baseX = num(x, 0);
      const baseY = num(y, 0);

      for (let i = 0; i < count; i++) {
        // direction
        let ang;
        let sp = speed * (0.42 + this._rng() * 0.85);
        if (spread === 'up') {
          ang = -Math.PI / 2 + (this._rng() - 0.5) * Math.PI * 0.55;
        } else if (spread === 'down') {
          ang = Math.PI / 2 + (this._rng() - 0.5) * Math.PI * 0.55;
        } else if (spread === 'burst') {
          ang = (i / count) * Math.PI * 2 + (this._rng() - 0.5) * 0.35;
          sp = speed * (0.7 + this._rng() * 0.5);
        } else {
          ang = this._rng() * Math.PI * 2;
        }

        const p = this._take();
        if (!p) break;

        p.x = baseX + (this._rng() - 0.5) * 6;
        p.y = baseY + (this._rng() - 0.5) * 6;
        p.vx = Math.cos(ang) * sp;
        p.vy = Math.sin(ang) * sp;
        p.gravity = gravity;
        p.drag = drag;
        p.age = 0;
        p.life = Math.max(0.06, life * (0.72 + this._rng() * 0.62));
        p.size0 = Math.max(1, size * (0.7 + this._rng() * 0.7));
        p.size1 = spriteName === 'ring' ? p.size0 * (2.1 + this._rng() * 0.9) : p.size0;
        p.curSize = p.size0;
        p.baseAlpha = alpha;
        p.curAlpha = 0;
        p.sprite = spriteIdx;
        p.wobbleAmp = spriteName === 'bubble' ? 9 + this._rng() * 26 : 0;
        p.wobbleFreq = 1.6 + this._rng() * 3.4;
        p.phase = this._rng() * Math.PI * 2;

        if (spriteName === 'bubble' && spread === 'circle') {
          p.vy = -Math.abs(sp) * (0.25 + this._rng() * 0.5);
        }

        readColor(colors ? colors[(this._rng() * colors.length) | 0] : opts.color, colorArr);
        p.r = colorArr[0];
        p.g = colorArr[1];
        p.b = colorArr[2];
      }
      this._flush();
    }

    /**
     * trail(x, y, opts) — a light emitter, meant to be called every frame.
     * Adds positional jitter so a moving emitter leaves a soft wake.
     */
    trail(x, y, opts) {
      if (x && typeof x === 'object') {
        const pos = x;
        opts = y || {};
        y = pos.y;
        x = pos.x;
      }
      opts = opts || {};
      const jitter = num(opts.jitter, 7);
      const o = {
        count: 1,
        color: opts.color != null ? opts.color : 0x9fe8ff,
        speed: num(opts.speed, 24),
        size: num(opts.size, 4),
        life: num(opts.life, 0.4),
        gravity: num(opts.gravity, -90),
        drag: num(opts.drag, 1.6),
        alpha: num(opts.alpha, 0.7),
        spread: opts.spread || 'circle',
        sprite: opts.sprite || 'bubble',
      };
      const jx = num(x, 0) + (this._rng() - 0.5) * jitter * 2;
      const jy = num(y, 0) + (this._rng() - 0.5) * jitter;
      this.burst(jx, jy, o);
    }

    /** advance all live particles; only touches live slots */
    update(dt) {
      dt = Math.min(Math.max(num(dt, 0), 0), 0.1);
      this._syncScale(dt);

      if (dt > 0) {
        for (let i = 0; i < this.count; ) {
          const p = this._pool[this._live[i]];
          p.age += dt;
          if (p.age >= p.life) {
            p.alive = false;
            this._free[this._freeCount++] = this._live[i];
            // swap-remove: last live slot fills the gap
            this._live[i] = this._live[this.count - 1];
            this.count--;
            continue;
          }

          const d = Math.exp(-p.drag * dt);
          p.vx *= d;
          p.vy *= d;
          p.vy += p.gravity * dt;
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          if (p.wobbleAmp) {
            p.x += Math.cos(p.age * p.wobbleFreq + p.phase) * p.wobbleAmp * dt;
          }

          const t = p.age / p.life;
          const grow = p.size1 - p.size0;
          p.curSize = p.size0 + grow * t;
          // quick pop-in, long smooth fade-out
          if (t < 0.12) p.curAlpha = p.baseAlpha * (t / 0.12);
          else p.curAlpha = p.baseAlpha * Math.pow(1 - (t - 0.12) / 0.88, 1.15);

          const o = i * 3;
          this._pos[o] = p.x;
          this._pos[o + 1] = p.y;
          this._pos[o + 2] = Z;
          this._col[o] = p.r;
          this._col[o + 1] = p.g;
          this._col[o + 2] = p.b;
          this._size[i] = p.curSize;
          this._alpha[i] = p.curAlpha;
          this._sprite[i] = p.sprite;
          i++;
        }
      }

      this._geoCount = this.count;
      this.geometry.setDrawRange(0, this.count);
      if (this.count > 0) {
        this.geometry.attributes.position.needsUpdate = true;
        this.geometry.attributes.aColor.needsUpdate = true;
        this.geometry.attributes.aSize.needsUpdate = true;
        this.geometry.attributes.aAlpha.needsUpdate = true;
        this.geometry.attributes.aSprite.needsUpdate = true;
      }
      this.points.visible = this.count > 0;
    }

    /** hide + recycle everything immediately */
    clear() {
      for (let i = 0; i < this.count; i++) {
        const p = this._pool[this._live[i]];
        p.alive = false;
        this._free[this._freeCount++] = this._live[i];
      }
      this.count = 0;
      this._geoCount = 0;
      this.geometry.setDrawRange(0, 0);
      this.points.visible = false;
      if (this.count === 0) this.points.visible = false;
    }

    /** number of currently live particles */
    get liveCount() {
      return this.count;
    }

    /** standalone texture helper for other modules (cached, 64x64) */
    static spriteTex(name) {
      return soloTexture(SPRITES.indexOf(name) >= 0 ? name : 'dot');
    }

    /** list of sprite names */
    static get SPRITES() {
      return SPRITES.slice();
    }

    /* ----------------------------------------------------------- internals */

    _take() {
      if (this._freeCount <= 0) return null;
      const idx = this._free[--this._freeCount];
      const p = this._pool[idx];
      p.alive = true;
      this._live[this.count++] = idx;
      return p;
    }

    _flush() {
      if (this.count === 0) {
        this.geometry.setDrawRange(0, 0);
        this.points.visible = false;
        return;
      }
      for (let i = 0; i < this.count; i++) {
        const p = this._pool[this._live[i]];
        const o = i * 3;
        this._pos[o] = p.x;
        this._pos[o + 1] = p.y;
        this._pos[o + 2] = Z;
        this._col[o] = p.r;
        this._col[o + 1] = p.g;
        this._col[o + 2] = p.b;
        this._size[i] = p.curSize;
        this._alpha[i] = p.curAlpha > 0 ? p.curAlpha : p.baseAlpha;
        this._sprite[i] = p.sprite;
      }
      this._geoCount = this.count;
      this.geometry.setDrawRange(0, this.count);
      this.geometry.attributes.position.needsUpdate = true;
      this.geometry.attributes.aColor.needsUpdate = true;
      this.geometry.attributes.aSize.needsUpdate = true;
      this.geometry.attributes.aAlpha.needsUpdate = true;
      this.geometry.attributes.aSprite.needsUpdate = true;
      this.points.visible = true;
    }

    /** keep gl_PointSize proportional to world->pixel scale (cheap, cached) */
    _syncScale() {
      const cam = M.Game && M.Game.camera;
      const viewH = (cam && cam.viewH) || (M.C && M.C.VIEW_H) || 800;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const pxH = (window.innerHeight || 720) * dpr;
      const scale = pxH / Math.max(200, viewH);
      if (Math.abs(scale - this._scale) > 0.01) {
        this._scale = scale;
        this.material.uniforms.uScale.value = scale;
      }
    }
  };
})();
