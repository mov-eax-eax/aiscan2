/* =========================================================================
   MARIO 3-2 — world.js
   Renders the whole underwater world from LEVEL_DATA:
     * water: deep gradient backdrops, animated surface bands, caustics, god rays
     * terrain: merged static block geometry (one draw call per material)
     * pipes: classic green pipes with rims + dark mouths; entrance pipes glow
     * decoration: coral fans, tube sponges, kelp (instanced + swaying), arches,
       hanging vines, sand ripples, bubble columns, distant parallax reefs,
       sparse dark foreground layer
     * bonus rooms: enclosed cave rooms with coin glints and exit pipes
     * goal: raised beach island, wooden post, flag-pole base, warm sun sky
   Everything is procedural; materials come from M32.Tex (textures.js) and are
   baked once. Static geometry is concatenated per material so the whole world
   stays far below the draw-call budget.

   Public API:
     new M32.World(scene, level, level3d)
     world.build()
     world.update(dt, rig)        // rig optional: {x,y,viewW,viewH}
     world.dispose()
   Extras: world.foreground, world.rooms, world.drawCalls, world.triangles
   ========================================================================= */
(function () {
  'use strict';
  window.M32 = window.M32 || {};
  const M = window.M32;
  const TAU = Math.PI * 2;
  const TILE = 32;
  const DEF_TEXW = 64;

  /* --------------------------------------------------------- z layers */
  const Z = {
    bg: -60,
    air: -55,
    water: -50,
    far: -40,
    mid: -25,
    goalSky: -54,
    tunnelBack: -12,
    caustic: -8,
    godray: -7.4,
    tunnelRock: -6.6,
    surface: -6,
    vines: -5.6,
    arch: -3.6,
    kelp: -2.6,
    deco: -2.5,
    bubbles: -2.0,
    terrain: 0,
    edgeDark: 0.05,
    edgeHi: 0.06,
    ripple: 0.08,
    island: 0.22,
    post: 0.45,
    pipe: 1.15,
    foreground: 8,
    vignette: 45,
  };

  const OPEN = 'open';
  const TUNNEL = 'tunnel';

  /* ---------------------------------------------------------- helpers */
  function num(v, d) {
    return typeof v === 'number' && isFinite(v) ? v : d;
  }
  function hash01(v) {
    return M.hash01 ? M.hash01(v) : 0.5;
  }
  function lin(c) {
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  }
  /** authored sRGB hex -> linear vertex colour (three treats vertex colours as linear) */
  function rgb(hexv, f) {
    f = f == null ? 1 : f;
    return [lin(((hexv >> 16) & 255) / 255) * f, lin(((hexv >> 8) & 255) / 255) * f, lin((hexv & 255) / 255) * f];
  }
  /** authored sRGB components (0..1) -> linear vertex colour */
  function lc3(r, g, b) {
    return [lin(r), lin(g), lin(b)];
  }
  function mixRgb(a, b, t) {
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  }
  function gcols(a, b, c, d) {
    return [[a, a, a], [b, b, b], [c, c, c], [d, d, d]];
  }
  function flatRgb(c) {
    return [c, c, c];
  }

  /* ============================================================== Batch
     Concatenates static quads into one BufferGeometry per material.        */
  class Batch {
    constructor() {
      this.p = [];
      this.n = [];
      this.uv = [];
      this.c = [];
      this.i = [];
      this.v = 0;
      this._c0 = [1, 1, 1];
    }

    /** 4 corners BL, BR, TR, TL; uv = [u0,v0,u1,v1]; cols = 4x [r,g,b] */
    quad(x0, y0, x1, y1, x2, y2, x3, y3, z, uv, cols) {
      const base = this.v;
      this.p.push(x0, y0, z, x1, y1, z, x2, y2, z, x3, y3, z);
      this.n.push(0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1);
      this.uv.push(uv[0], uv[1], uv[2], uv[1], uv[2], uv[3], uv[0], uv[3]);
      for (let k = 0; k < 4; k++) {
        const c = cols[k];
        this.c.push(c[0], c[1], c[2]);
      }
      this.i.push(base, base + 1, base + 2, base, base + 2, base + 3);
      this.v += 4;
    }

    /** axis-aligned rect; the workhorse for terrain, backdrops and deco */
    rect(x, y, w, h, z, o) {
      o = o || {};
      const tw = o.texW || DEF_TEXW;
      const su = o.uScale != null ? o.uScale : (o.swapUV ? h : w) / tw;
      const sv = o.vScale != null ? o.vScale : (o.swapUV ? w : h) / tw;
      const u0 = o.u0 != null ? o.u0 : 0;
      const v0 = o.v0 != null ? o.v0 : 0;
      const u1 = o.u1 != null ? o.u1 : u0 + su;
      const v1 = o.v1 != null ? o.v1 : v0 + sv;
      let cols = o.colors;
      if (!cols) {
        const t = o.topShade != null ? o.topShade : 1;
        const b = o.bottomShade != null ? o.bottomShade : 1;
        cols = gcols(b, b, t, t);
      }
      this.quad(x, y, x + w, y, x + w, y + h, x, y + h, z, [u0, v0, u1, v1], cols);
    }

    /** convex-ish polygon fan, vertical colour ramp bottom->top */
    poly(pts, z, colBottom, colTop) {
      const n = pts.length;
      if (n < 3) return;
      let minY = Infinity, maxY = -Infinity;
      for (let i = 0; i < n; i++) {
        const y = pts[i][1];
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
      const span = maxY - minY || 1;
      const base = this.v;
      for (let i = 0; i < n; i++) {
        const p = pts[i];
        const t = (p[1] - minY) / span;
        const c = mixRgb(colBottom, colTop, t);
        this.p.push(p[0], p[1], z);
        this.n.push(0, 0, 1);
        this.uv.push(0, 0);
        this.c.push(c[0], c[1], c[2]);
      }
      this.v += n;
      for (let i = 1; i < n - 1; i++) this.i.push(base, base + i, base + i + 1);
    }

    geometry() {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
      g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
      const I = this.v > 65535 ? THREE.Uint32BufferAttribute : THREE.Uint16BufferAttribute;
      g.setIndex(new I(this.i, 1));
      g.computeBoundingSphere();
      return g;
    }
  }

  /* ============================================================== World */
  class World {
    constructor(scene, level, level3d) {
      this.scene = scene || null;
      this.level = level || null;
      this.level3d = level3d || null;
      this.root = null;
      this.foreground = null;
      this.rooms = [];
      this.drawCalls = 0;
      this.triangles = 0;
      this.blockCount = 0;
      this._t = 0;
      this._built = false;
      this._batchMap = new Map();
      this._byKey = Object.create(null);
      this._geometries = [];
      this._ownedMaterials = [];
      this._glows = [];
      this._kelpData = [];
      this._bubbleData = [];
      this._moteData = [];
      this._roomCoinMats = [];
      this._vignettes = null;
      this._farGroup = null;
      this._midGroup = null;
      this._bgMesh = null;
      this._waterTop = (M.C && M.C.WORLD_H ? 900 : 900);
      // scratch objects (no per-frame allocation)
      this._tm4 = new THREE.Matrix4();
      this._tq = new THREE.Quaternion();
      this._te = new THREE.Euler();
      this._tv = new THREE.Vector3();
      this._ts = new THREE.Vector3();
      this._tc = new THREE.Color();
    }

    /* ------------------------------------------------------------ build */
    build() {
      if (this._built) return this;
      const lvl = this.level || (this.level3d && this.level3d.level) || null;
      const l3 = this.level3d || null;
      if (!lvl && !(l3 && (l3.solids || l3.zones))) return this; // level.js missing -> draw nothing

      this.root = new THREE.Group();
      this.root.name = 'm32-world';
      if (this.scene && this.scene.add) this.scene.add(this.root);

      const data = this._collect();
      this._data = data;
      this._waterTop = data.waterTop;

      this._buildBackground(data);
      this._buildWater(data);
      this._buildReefs(data);
      this._buildTerrain(data);
      this._buildPipes(data);
      this._buildDecor(data);
      this._buildBonusRooms(data);
      this._buildGoal(data);
      this._buildBubbles(data);
      this._buildMotes();
      this._buildForeground();
      this._buildVignette();
      this._flushBatches();

      // grab animated handles after the batches became meshes
      this._causticTexA = this._texOf('causticA');
      this._causticTexB = this._texOf('causticB');
      this._surfTex1 = this._texOf('surface1');
      this._surfTex2 = this._texOf('surface2');
      const rayMesh = this._byKey.rays;
      this._rayMat = rayMesh ? rayMesh.material : null;
      const box = this._byKey['block:itembox'];
      this._itemboxMat = box ? box.material : null;

      this._computeStats();
      this._built = true;
      return this;
    }

    /* ---------------------------------------------------- data gathering */
    _collect() {
      const lvl = this.level || {};
      const l3 = this.level3d || {};
      const zones = (l3.zones && l3.zones.length ? l3.zones : lvl.zones) || [];
      let solids = l3.solids && l3.solids.length ? l3.solids.slice() : null;
      if (!solids) solids = this._solidsFromBlocks(lvl);
      const pipes = lvl.pipes || l3.pipes || [];
      const rooms = lvl.bonusRooms || l3.rooms || [];
      const goal = lvl.goal || l3.goal || null;
      const width = num(lvl.width, num(l3.width, (M.C && M.C.WORLD_W) || 6400));
      const height = num(lvl.height, (M.C && M.C.WORLD_H) || 1080);

      // ?-blocks (level.blocks2) may live outside the collision solids list
      if (l3.solids && l3.solids.length && lvl.blocks2 && lvl.blocks2.length) {
        const seen = Object.create(null);
        for (let i = 0; i < solids.length; i++) seen[this._solidKey(solids[i])] = 1;
        for (let i = 0; i < lvl.blocks2.length; i++) {
          const s = this._blockToSolid(lvl.blocks2[i], 'itembox');
          const k = this._solidKey(s);
          if (!seen[k]) {
            seen[k] = 1;
            solids.push(s);
          }
        }
      }
      return {
        zones: zones,
        solids: solids,
        pipes: pipes,
        rooms: rooms,
        goal: goal,
        width: width,
        height: height,
        waterTop: this._zoneWaterTop(zones),
      };
    }

    _blockToSolid(b, defType) {
      b = b || {};
      return {
        x: num(b.x, 0),
        y: num(b.y, 0),
        w: num(b.w, TILE),
        h: num(b.h, TILE),
        type: b.type || defType || 'stone',
      };
    }

    _solidsFromBlocks(lvl) {
      lvl = lvl || {};
      const out = [];
      const seen = Object.create(null);
      const self = this;
      const push = function (b, defType) {
        if (!b || typeof b !== 'object') return;
        const s = self._blockToSolid(b, defType);
        const k = self._solidKey(s);
        if (seen[k]) return;
        seen[k] = 1;
        out.push(s);
      };
      (lvl.blocks || []).forEach(function (b) { push(b, 'stone'); });
      (lvl.blocks2 || []).forEach(function (b) { push(b, 'itembox'); });
      (lvl.bonusRooms || []).forEach(function (r) {
        (r.blocks || []).forEach(function (b) { push(b, 'stone'); });
      });
      return out;
    }

    _solidKey(s) {
      return (
        Math.round(s.x * 4) / 4 + '|' + Math.round(s.y * 4) / 4 + '|' +
        Math.round(s.w * 4) / 4 + '|' + Math.round(s.h * 4) / 4
      );
    }

    _zoneWaterTop(zones) {
      let top = (M.C && M.C.WATER_TOP_Y) || 900;
      for (let i = 0; i < (zones || []).length; i++) {
        const z = zones[i];
        if (!z || z.water === false) continue;
        if ((z.kind || OPEN) === TUNNEL) continue;
        top = Math.max(top, num(z.yTop, 0));
      }
      return top;
    }

    /** highest water surface at x, or null when x is dry land. */
    _waterTopAt(x) {
      const l3 = this.level3d;
      if (l3 && typeof l3.waterTopAt === 'function') {
        let t = null;
        try { t = l3.waterTopAt(x); } catch (e) { t = null; }
        return (t === undefined || t === null) ? null : t;
      }
      const data = this._data;
      const zones = (data && data.zones) || (this.level && this.level.zones) || [];
      let top = null;
      for (let i = 0; i < zones.length; i++) {
        const z = zones[i];
        if (!z || z.water === false) continue;
        const zx = num(z.x, 0), zw = num(z.w, 0);
        if (x < zx || x > zx + zw) continue;
        const t = num(z.yTop, 0);
        if (top === null || t > top) top = t;
      }
      return top;
    }

    /* ------------------------------------------------------ geometry out */
    _batch(key, opts) {
      let e = this._batchMap.get(key);
      if (!e) {
        e = { batch: new Batch(), opts: opts || {} };
        this._batchMap.set(key, e);
      }
      return e.batch;
    }

    _flushBatches() {
      const self = this;
      this._batchMap.forEach(function (e, key) {
        if (!e.batch.v) return;
        const geo = e.batch.geometry();
        const o = e.opts || {};
        const mo = Object.assign({ vertexColors: true }, o.mat || {});
        if (o.texOpts) mo.tex = Object.assign({}, o.texOpts, mo.tex || {});
        let material;
        if (o.tex) {
          material = M.Tex.mat(o.tex, mo);
        } else {
          const col = mo.color != null ? mo.color : 0xffffff;
          const m2 = Object.assign({}, mo);
          delete m2.color;
          material = M.Tex.colorMat(col, m2);
        }
        if (o.uniqueMaterial) {
          material = material.clone();
          self._ownedMaterials.push(material);
        }
        const mesh = new THREE.Mesh(geo, material);
        mesh.name = 'b:' + key;
        mesh.frustumCulled = false;
        if (o.renderOrder) mesh.renderOrder = o.renderOrder;
        self.root.add(mesh);
        self._geometries.push(geo);
        self._byKey[key] = mesh;
      });
      this._batchMap.clear();
    }

    _planeMesh(w, h, material, z) {
      const geo = new THREE.PlaneGeometry(w, h);
      const mesh = new THREE.Mesh(geo, material);
      mesh.position.z = z;
      mesh.frustumCulled = false;
      this.root.add(mesh);
      this._geometries.push(geo);
      return mesh;
    }

    _texOf(key) {
      const m = this._byKey[key];
      return m && m.material ? m.material.map : null;
    }

    _addGlow(x, y, w, h, color, base, phase, speed, z) {
      const src = M.Tex.mat('glow', {
        lit: false,
        transparent: true,
        opacity: base,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        color: color,
      });
      const mat = src.clone();
      mat.opacity = base;
      this._ownedMaterials.push(mat);
      const geo = new THREE.PlaneGeometry(w, h);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(x, y, z);
      mesh.frustumCulled = false;
      this.root.add(mesh);
      this._geometries.push(geo);
      this._glows.push({
        mesh: mesh,
        mat: mat,
        base: base,
        phase: phase || 0,
        speed: speed || 1.4,
      });
      return mesh;
    }

    /* ------------------------------------------------------- background */
    _buildBackground(data) {
      const mat = M.Tex.mat('bgGradient', { lit: false });
      const bg = this._planeMesh(4400, 2800, mat, Z.bg);
      this._bgMesh = bg;

      // soft vignette inside the background itself (top + bottom bands)
    }

    /* ---------------------------------------------------------- water */
    _buildWater(data) {
      const zones = data.zones || [];
      const height = data.height;
      const rng = M.rng(0x2ca7);
      // absolute v mapping: the same world y gets the same gradient colour in
      // every zone, so adjacent backdrops never show as vertical bands
      const WATER_Y1 = 1000;
      const AIR_Y0 = 880;
      const AIR_Y1 = 1580;

      const openB = this._batch('waterOpen', { tex: 'waterGradient', mat: { lit: false } });
      const tunnelB = this._batch('waterTunnel', { tex: 'tunnelGradient', mat: { lit: false } });
      const airB = this._batch('air', { tex: 'airGradient', mat: { lit: false } });
      const rockB = this._batch('tunnelRock', {
        tex: 'rockDark',
        mat: { lit: false, color: 0x4c6674 },
      });
      const tunGlow = this._batch('tunnelGlow', {
        tex: null,
        mat: {
          lit: false,
          transparent: true,
          opacity: 0.28,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          color: 0x8fd8ff,
        },
      });
      const causticA = this._batch('causticA', {
        tex: 'caustic',
        texOpts: { seed: 3 },
        mat: {
          lit: false,
          transparent: true,
          opacity: 0.27,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        },
      });
      const causticB = this._batch('causticB', {
        tex: 'caustic',
        texOpts: { seed: 17 },
        mat: {
          lit: false,
          transparent: true,
          opacity: 0.15,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        },
      });
      const surf1 = this._batch('surface1', {
        tex: 'surface',
        mat: {
          lit: false,
          transparent: true,
          opacity: 0.58,
          blending: THREE.NormalBlending,
          depthWrite: false,
        },
      });
      const surf2 = this._batch('surface2', {
        tex: 'surface',
        texOpts: { seed: 9 },
        mat: {
          lit: false,
          transparent: true,
          opacity: 0.4,
          blending: THREE.NormalBlending,
          depthWrite: false,
        },
      });
      const rayB = this._batch('rays', {
        tex: 'godray',
        mat: {
          lit: false,
          transparent: true,
          opacity: 0.2,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          color: 0xcaf7ff,
        },
        uniqueMaterial: true,
      });

      const surfaceZones = [];
      for (let i = 0; i < zones.length; i++) {
        const z = zones[i];
        if (!z || z.water === false) continue;
        const x = num(z.x, 0);
        const w = num(z.w, 0);
        if (!(w > 0)) continue;
        const yb = num(z.yBottom, 0);
        const yt = num(z.yTop, height);
        if (!(yt > yb)) continue;
        const kind = z.kind || OPEN;
        const surfaceOn = z.surface !== false && kind !== TUNNEL;

        if (kind === TUNNEL) {
          tunnelB.rect(x, yb, w, yt - yb, Z.tunnelBack, { u0: 0, v0: 0, u1: 1, v1: 1 });
          const above = height + 400 - yt;
          if (above > 0) rockB.rect(x, yt, w, above, Z.tunnelRock, { texW: 96 });
          if (yb > 0) rockB.rect(x, 0, w, yb, Z.tunnelRock, { texW: 96 });
          tunGlow.rect(x, yt - 2, w, 3, Z.surface + 0.2, { texW: 128 });
          tunGlow.rect(x, yb - 1, w, 3, Z.surface + 0.2, { texW: 128 });
          continue;
        }

        // one continuous body of water: absolute v mapping
        openB.rect(x, yb, w, yt - yb, Z.water, {
          u0: x / 640,
          v0: yb / WATER_Y1,
          u1: (x + w) / 640,
          v1: yt / WATER_Y1,
        });

        if (surfaceOn) {
          const above = height + 520 - yt;
          if (above > 0) {
            airB.rect(x, yt, w, above, Z.air, {
              u0: x / 900,
              v0: (yt - AIR_Y0) / (AIR_Y1 - AIR_Y0),
              u1: (x + w) / 900,
              v1: (height + 520 - AIR_Y0) / (AIR_Y1 - AIR_Y0),
            });
          }
          // one thin foam line per zone; it overlaps its neighbours a little so
          // stepped surfaces read as broken waves instead of rectangles
          surf1.rect(x - 12, yt - 8, w + 24, 14, Z.surface, {
            u0: (x - 12) / 128,
            u1: (x + w + 12) / 128,
            vScale: 1,
          });
          surfaceZones.push({ x: x, w: w, top: yt, kind: kind });
        }

        causticA.rect(x, yb, w, yt - yb, Z.caustic, {
          u0: x / 520,
          v0: yb / 520,
          u1: (x + w) / 520,
          v1: yt / 520,
        });
        causticB.rect(x, yb, w, yt - yb, Z.caustic - 0.15, {
          u0: x / 360 + 0.3,
          v0: yb / 360 + 0.2,
          u1: (x + w) / 360 + 0.3,
          v1: yt / 360 + 0.2,
        });

        // few, soft god rays; the texture fades at every edge too
        if (surfaceOn) {
          let rx = x + 180 + rng() * 220;
          while (rx < x + w - 180) {
            const rh = 300 + rng() * 340;
            const rw = 50 + rng() * 90;
            const slant = (rng() - 0.5) * 90;
            rayB.quad(
              rx, yt - 6,
              rx + rw, yt - 6,
              rx + rw + slant * 0.3, yt - rh,
              rx + slant * 0.3, yt - rh,
              Z.godray,
              [0, 0, 1, 1],
              gcols(0.5, 0.5, 1, 1)
            );
            rx += 460 + rng() * 520;
          }
        }
      }
      this._surfaceZones = surfaceZones;

      // one soft curtain where a surface steps from one zone height to the next
      for (let i = 1; i < surfaceZones.length; i++) {
        const a = surfaceZones[i - 1];
        const b = surfaceZones[i];
        if (Math.abs(a.top - b.top) < 3) continue;
        const bx = b.x;
        if (bx > a.x + a.w + 2) continue;
        const lo = Math.min(a.top, b.top);
        const hi = Math.max(a.top, b.top);
        surf2.rect(bx - 16, lo - 4, 32, hi - lo + 10, Z.surface + 0.05, {
          u0: (bx - 16) / 256,
          u1: (bx + 16) / 256,
          vScale: 1,
        });
        // foam blob that breaks the corner where two surface heights meet
        surf2.quad(
          bx - 24, lo - 10,
          bx + 12, lo - 14,
          bx + 26, hi + 6,
          bx - 2, hi + 10,
          Z.surface + 0.06,
          [0, 0, 1, 1],
          gcols(1, 1, 0.9, 0.9)
        );
      }

      // ---- cave mouths: dissolve the hard tunnel <-> open-water edge ----
      const fadeL = this._batch('mouthFadeL', {
        tex: 'edgeFade',
        texOpts: { flip: 1 },
        mat: { lit: false, transparent: true, opacity: 0.85, depthWrite: false },
      });
      const fadeR = this._batch('mouthFadeR', {
        tex: 'edgeFade',
        mat: { lit: false, transparent: true, opacity: 0.85, depthWrite: false },
      });
      const mouthRock = this._batch('tunnelLip', {
        tex: 'stone',
        texOpts: { seed: 31 },
        mat: { color: 0x7d93a1, vertexColors: true },
      });
      for (let i = 0; i < zones.length; i++) {
        const z = zones[i];
        if (!z || z.water === false || (z.kind || OPEN) !== TUNNEL) continue;
        const zx = num(z.x, 0), zw = num(z.w, 0);
        const yb = num(z.yBottom, 0), yt = num(z.yTop, height);
        if (!(zw > 40) || !(yt > yb)) continue;
        const x0 = zx, x1 = zx + zw;
        fadeL.rect(x0 - 132, yb, 138, yt - yb, Z.tunnelBack + 0.3, { u0: 0, v0: 0, u1: 1, v1: 1 });
        fadeR.rect(x1 - 6, yb, 138, yt - yb, Z.tunnelBack + 0.3, { u0: 0, v0: 0, u1: 1, v1: 1 });
        for (let k = 0; k < 4; k++) {
          const out = 22 + hash01(i * 11 + k * 3.7) * 36;
          const lw = 36 + hash01(i * 5.3 + k) * 30;
          const hh = 28 + k * 6;
          mouthRock.rect(x0 - out, yt - 4 + k * 6, lw + out, hh, 0.5, { texW: 96 });
          mouthRock.rect(x0 - out, yb - hh + 4 - k * 6, lw + out, hh, 0.5, { texW: 96 });
          mouthRock.rect(x1 - lw, yt - 4 + k * 6, lw + out, hh, 0.5, { texW: 96 });
          mouthRock.rect(x1 - lw, yb - hh + 4 - k * 6, lw + out, hh, 0.5, { texW: 96 });
        }
      }
    }

    /* -------------------------------------------------- parallax reefs */
    _buildReefs() {
      const mk = (groupName, z, seed, colorLo, colorHi, count, x0, x1, tall) => {
        const group = new THREE.Group();
        group.name = groupName;
        this.root.add(group);
        const b = new Batch();
        const rng = M.rng(seed);
        for (let i = 0; i < count; i++) {
          const cx = x0 + ((x1 - x0) * (i + 0.25 + rng() * 0.5)) / count;
          const w = 150 + rng() * 360;
          const h = (tall ? 180 : 110) + rng() * (tall ? 380 : 280);
          const baseY = -540;
          const pts = [
            [cx, baseY],
            [cx + w * 0.06, baseY + h * 0.5],
            [cx + w * 0.2, baseY + h * 0.85],
            [cx + w * 0.36, baseY + h * 0.98],
            [cx + w * 0.52, baseY + h],
            [cx + w * 0.68, baseY + h * 0.9],
            [cx + w * 0.86, baseY + h * 0.55],
            [cx + w, baseY],
          ];
          b.poly(pts, z, colorLo, colorHi);
          // spires / coral towers on the mid layer
          if (tall && rng() < 0.45) {
            const sx = cx + w * (0.2 + rng() * 0.6);
            const sw = 20 + rng() * 46;
            const sh = 90 + rng() * 260;
            b.poly(
              [
                [sx - sw * 0.6, baseY + h * 0.55],
                [sx - sw * 0.15, baseY + h * 0.55 + sh],
                [sx + sw * 0.25, baseY + h * 0.55 + sh * 0.85],
                [sx + sw * 0.6, baseY + h * 0.55],
              ],
              z + 0.1,
              colorLo,
              colorHi
            );
          }
        }
        const geo = b.geometry();
        const mat = M.Tex.colorMat(0xffffff, { lit: false, vertexColors: true });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.frustumCulled = false;
        group.add(mesh);
        this._geometries.push(geo);
        return group;
      };

      this._farGroup = mk('far-reef', Z.far, 0x1a2f, rgb(0x04121e), rgb(0x0d3b5c), 26, -950, 1850, false);
      this._midGroup = mk('mid-reef', Z.mid, 0x51c3, rgb(0x02090f), rgb(0x0a2f47), 22, -1050, 1950, true);
    }

    /* ---------------------------------------------------------- terrain */
    _style(type, i) {
      const p = M.PAL || {};
      const h = hash01(i * 13.17 + 5.3);
      switch (type) {
        case 'floor':
          return { key: 'floor', tex: 'floor', color: 0xffffff, texW: 128 };
        case 'sand':
          return h < 0.5
            ? { key: 'sandA', tex: 'sand', color: 0xffffff, texW: 96, offset: true, emissive: 0xff8a33, emissiveIntensity: 0.16 }
            : { key: 'sandB', tex: 'sand', color: 0xffe9c4, texW: 96, offset: true, emissive: 0xff7a22, emissiveIntensity: 0.13 };
        case 'coral': {
          const k = (i + Math.floor(h * 4)) % 4;
          const cols = [0xffffff, 0xffd6e2, 0xffc27f, 0xd2b8ff];
          return { key: 'coral' + k, tex: 'coral', color: cols[k], texW: 64, offset: true };
        }
        case 'stone':
          return h < 0.5
            ? { key: 'stoneA', tex: 'stone', color: 0xffffff, texW: 96, offset: true }
            : { key: 'stoneB', tex: 'stone', color: 0xc4d8e8, texW: 96, offset: true };
        case 'wall':
          return { key: 'wall', tex: 'wall', color: 0xdceaf4, texW: 64 };
        case 'brick':
          return { key: 'brick', tex: 'brick', color: 0xffffff, texW: 32 };
        case 'itembox':
          return {
            key: 'itembox',
            tex: 'itembox',
            color: 0xffffff,
            texW: 32,
            emissive: p.gold != null ? p.gold : 0xffcf3d,
            emissiveIntensity: 0.3,
            uniqueMaterial: true,
          };
        case 'used':
          return { key: 'used', tex: 'used', color: 0xffffff, texW: 32 };
        case 'pipe':
          return { key: 'pipeSolid', tex: 'pipe', color: 0xffffff, texW: 64 };
        default:
          return { key: 'stoneA', tex: 'stone', color: 0xcfd8de, texW: 96, offset: true };
      }
    }

    _buildTerrain(data) {
      const solids = data.solids || [];
      for (let i = 0; i < solids.length; i++) {
        const s = solids[i];
        if (!s) continue;
        const t = s.type || '';
        // invisible playfield bounds are collision-only; pipe walls are drawn
        // by _buildPipes() as proper pipes, so do not render the raw AABBs.
        if (t === 'boundary' || t === 'pipe') continue;
        this._addBlock(s, i);
      }
    }

    _addBlock(s, i, zOverride) {
      if (!s) return;
      const w = num(s.w, 0), h = num(s.h, 0);
      if (!(w > 0) || !(h > 0)) return;
      // decorative dry-land sand blocks behind the goal get the bright beach sand
      const meta = (this.level && this.level.meta) || {};
      const beachX = num(meta.beachX, 0);
      const plateauTop = this.level && this.level.goal
        ? num(this.level.goal.groundY, num(this.level.goal.y, -1))
        : -1;
      let style;
      if (s.type === 'sand' && plateauTop > 0 && num(s.y, 0) >= plateauTop - 4 && num(s.x, 0) >= beachX) {
        style = { key: 'beachStep', tex: 'beach', color: 0xffffff, texW: 64, emissive: 0xffa030, emissiveIntensity: 0.13 };
      } else {
        style = this._style(s.type || 'stone', i);
      }
      const z = zOverride != null ? zOverride : Z.terrain;
      if (style.key === 'beachStep') {
        // sunlit sand blocks: darker golden front, bright top face, dark sides
        const bx = num(s.x, 0), by = num(s.y, 0);
        const mainB = this._batch('block:beachStep', {
          tex: 'beach',
          mat: { color: 0xd9b878, vertexColors: true, emissive: 0xffa030, emissiveIntensity: 0.07 },
        });
        mainB.rect(bx, by, w, h, z, { texW: 64, topShade: 0.95, bottomShade: 0.7 });
        const topB = this._batch('beachStepTop', {
          tex: 'beach',
          mat: { color: 0xffefbc, vertexColors: true },
        });
        topB.rect(bx, by + h - 10, w, 10, z + 0.02, { texW: 64, topShade: 1.08, bottomShade: 1.0 });
        const sideB = this._batch('beachStepSide', {
          tex: 'beach',
          mat: { color: 0x9a7444, vertexColors: true },
        });
        sideB.rect(bx, by, 7, h, z + 0.01, { texW: 64, topShade: 0.92, bottomShade: 0.66 });
        sideB.rect(bx + w - 7, by, 7, h, z + 0.01, { texW: 64, topShade: 0.92, bottomShade: 0.66 });
        sideB.rect(bx, by, w, 3, z + 0.01, { texW: 64, topShade: 0.55, bottomShade: 0.55 });
        this.blockCount++;
        return;
      }
      const b = this._batch('block:' + style.key, {
        tex: style.tex,
        texOpts: style.texOpts,
        mat: {
          color: style.color,
          vertexColors: true,
          emissive: style.emissive || 0x000000,
          emissiveIntensity: style.emissiveIntensity != null ? style.emissiveIntensity : 1,
        },
        uniqueMaterial: !!style.uniqueMaterial,
      });
      const tw = style.texW || 32;
      const tall = h > 96;
      const top = tall ? 1.14 : 1.07;
      const bot = tall ? 0.58 : 0.8;
      const u0 = style.offset ? hash01(i * 3.73) : 0;
      const v0 = style.offset ? hash01(i * 7.19 + 2) : 0;
      b.rect(num(s.x, 0), num(s.y, 0), w, h, z, {
        texW: tw,
        u0: u0,
        v0: v0,
        topShade: top,
        bottomShade: bot,
      });
      this.blockCount++;

      // top light + dark silhouette lines make the collision boxes readable
      // warm top light on sand/floor, cool rim light on rock/coral/brick.
      // No additive layer is drawn on the dry beach (the sunlit sand blocks read
      // from their textures + the deco lip only).
      const dryBeach = plateauTop > 0 && num(s.x, 0) >= beachX && num(s.y, 0) >= plateauTop - 4 &&
        (style.key === 'sandA' || style.key === 'sandB' || style.key === 'beach' || style.key === 'beachStep');
      if (!dryBeach) {
        const hi = this._batch('edgeHi', {
          tex: null,
          mat: {
            lit: false,
            transparent: true,
            opacity: 0.3,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            color: 0xffffff,
          },
        });
        const warmEdge = style.key === 'floor' || style.key.indexOf('sand') === 0 || style.key === 'beach' || style.key === 'beachStep';
        const ec = warmEdge ? [1.0, 0.86, 0.64] : [0.78, 0.92, 1.0];
        hi.rect(num(s.x, 0), num(s.y, 0) + h - 3, w, 3, z + Z.edgeHi, { colors: [ec, ec, ec, ec] });
      }
      const dk = this._batch('edgeDark', {
        tex: null,
        mat: {
          lit: false,
          transparent: true,
          opacity: 0.4,
          depthWrite: false,
          color: 0x03131f,
        },
      });
      dk.rect(num(s.x, 0), num(s.y, 0), 2.5, h, z + Z.edgeDark);
      dk.rect(num(s.x, 0) + w - 2.5, num(s.y, 0), 2.5, h, z + Z.edgeDark);
      dk.rect(num(s.x, 0), num(s.y, 0), w, 2.5, z + Z.edgeDark);
    }

    /* ------------------------------------------------------------ pipes */
    _buildPipes(data) {
      const pipes = data.pipes || [];
      for (let i = 0; i < pipes.length; i++) this._addPipe(pipes[i], i);
    }

    _pipeDims(p, dir) {
      const horiz = dir === 'left' || dir === 'right';
      return {
        x: num(p.x, 0),
        y: num(p.y, 0),
        w: num(p.w, horiz ? 96 : 64),
        h: num(p.h, horiz ? 64 : 96),
      };
    }

    _addPipe(p, idx, opts) {
      if (!p) return;
      opts = opts || {};
      const dir = p.dir || 'up';
      const horiz = dir === 'left' || dir === 'right';
      const d = this._pipeDims(p, dir);
      const x = d.x, y = d.y, w = d.w, h = d.h;
      const z = opts.z != null ? opts.z : Z.pipe + ((idx || 0) % 7) * 0.01;
      const lit = !!(p.entrance || p.target || p.glowing) && !opts.dark;
      const rimW = 20;
      const bodyKey = lit ? 'pipeBodyLit' : 'pipeBody';
      const rimKey = lit ? 'pipeRimLit' : 'pipeRim';
      const bodyMat = {
        color: lit ? 0xd9ffe0 : 0xffffff,
        vertexColors: true,
        emissive: lit ? 0x2f9a3a : 0x0a2410,
        emissiveIntensity: lit ? 0.7 : 0.4,
      };
      const body = this._batch(bodyKey, { tex: 'pipe', mat: bodyMat });
      const rim = this._batch(rimKey, {
        tex: 'pipe',
        mat: {
          color: lit ? 0xf2fff2 : 0xe8ffe8,
          vertexColors: true,
          emissive: lit ? 0x3fbf4a : 0x0a2410,
          emissiveIntensity: lit ? 0.8 : 0.4,
        },
      });
      const mouth = this._batch('pipeMouth', {
        tex: null,
        mat: { lit: false, color: 0x04130b },
      });

      if (!horiz) {
        const rimAtTop = dir === 'up';
        const bodyY = rimAtTop ? y : y + rimW;
        const bodyH = Math.max(4, h - rimW);
        body.rect(x + 6, bodyY, w - 12, bodyH, z, {
          texW: 64,
          colors: gcols(0.78, 0.94, 1.12, 1.18),
        });
        const rimY = rimAtTop ? y + h - rimW : y;
        rim.rect(x - 5, rimY, w + 10, rimW, z + 0.01, {
          texW: 64,
          colors: gcols(0.8, 0.8, 1.16, 1.16),
        });
        // dark recessed mouth
        mouth.rect(x + 12, rimY + (rimAtTop ? 4 : rimW - 12), w - 24, 8, z + 0.02);
        mouth.rect(x + 18, rimY + (rimAtTop ? 3 : rimW - 9), w - 36, 6, z + 0.03);
        // rim lip highlight
        const hi = this._batch('edgeHi', {
          tex: null,
          mat: {
            lit: false,
            transparent: true,
            opacity: 0.3,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            color: 0xd8f7ff,
          },
        });
        hi.rect(x - 5, rimAtTop ? rimY + rimW - 2 : rimY, w + 10, 2, z + 0.04);
      } else {
        const rimAtLeft = dir === 'left';
        body.rect(rimAtLeft ? x + rimW : x, y + 6, Math.max(4, w - rimW), h - 12, z, {
          texW: 64,
          swapUV: true,
          colors: gcols(0.82, 1.1, 1.1, 0.82),
        });
        const rimX = rimAtLeft ? x : x + w - rimW;
        rim.rect(rimX, y - 5, rimW, h + 10, z + 0.01, {
          texW: 64,
          swapUV: true,
          colors: gcols(0.85, 1.12, 1.12, 0.85),
        });
        mouth.rect(rimX + (rimAtLeft ? 4 : rimW - 12), y + 12, 8, h - 24, z + 0.02);
        mouth.rect(rimX + (rimAtLeft ? 3 : rimW - 9), y + 18, 6, h - 36, z + 0.03);
      }

      // opening glow (entrance / bonus-target pipes pulse)
      if (lit) {
        const cx = horiz ? (dir === 'left' ? x + 6 : x + w - 6) : x + w / 2;
        const cy = horiz ? y + h / 2 : dir === 'up' ? y + h - 6 : y + 6;
        const size = Math.max(w, h) * (opts.dark ? 1.3 : 1.9);
        this._addGlow(cx, cy, size, size * 0.85, p.target ? 0x9fffb0 : 0xc9ffb0, 0.3, idx * 1.7, 1.5 + (idx || 0) * 0.2, z + 0.35);
      }
      return d;
    }

    /* -------------------------------------------------------- decoration */
    _buildDecor(data) {
      const solids = data.solids || [];
      const rng = M.rng(0x7a32a1);
      const deco = this._batch('deco', { tex: null, mat: { color: 0xffffff, vertexColors: true } });
      const ripple = this._batch('ripple', {
        tex: null,
        mat: {
          lit: false,
          transparent: true,
          opacity: 0.4,
          depthWrite: false,
          color: 0xa8e6f2,
        },
      });

      // ---- scatter on every submerged walkable top surface --------------
      for (let i = 0; i < solids.length; i++) {
        const s = solids[i];
        const type = s.type || 'stone';
        if (type === 'itembox' || type === 'used' || type === 'pipe' || type === 'boundary') continue;
        const w = num(s.w, 0);
        const h = num(s.h, 0);
        if (!(w > 22) || !(h > 10)) continue;
        const sx = num(s.x, 0);
        const top = num(s.y, 0) + h;

        if (type === 'floor' || type === 'sand') {
          // sand ripples on the sea floor (skip the dry beach part)
          for (let k = 0; k < 3; k++) {
            const ry = top - 9 - k * 9;
            let px = sx + 10 + rng() * 40;
            const step = 26;
            while (px < sx + w - 20) {
              const wt = this._waterTopAt(px);
              if (wt != null && top <= wt + 4) {
                const y1 = ry + Math.sin(px * 0.05 + k * 1.7) * 2.5;
                const y2 = ry + Math.sin((px + step) * 0.05 + k * 1.7) * 2.5;
                ripple.quad(px, y1, px + step, y2, px + step, y2 + 2, px, y1 + 2, Z.ripple, [0, 0, 1, 1], gcols(0.7, 0.7, 1, 1));
              }
              px += step + 6 + rng() * 22;
            }
          }
        }
        const step = 55 + rng() * 70;
        for (let px = sx + 22 + rng() * 50; px < sx + w - 20; px += step * (0.7 + rng() * 0.7)) {
          const wt = this._waterTopAt(px);
          if (wt == null || top > wt + 4) continue; // dry land / above the surface
          const r = rng();
          if (r < 0.3) this._coralFan(deco, px, top, 0.8 + rng() * 0.9, rng);
          else if (r < 0.5) this._tubeSponge(deco, px, top, 0.8 + rng() * 0.7, rng);
          else if (r < 0.56) this._smallRock(deco, px, top, 0.8 + rng() * 0.8, rng);
          else if (r < 0.83) {
            this._kelpData.push({
              x: px,
              y: top - 2,
              z: Z.kelp + rng() * 0.5,
              w: 26 + rng() * 22,
              h: 66 + rng() * 130,
              tilt: (rng() - 0.5) * 0.4,
              phase: rng() * TAU,
              speed: 0.7 + rng() * 0.9,
              amp: 0.05 + rng() * 0.1,
              tint: rng() < 0.5 ? 0x2f8f4e : 0x57c266,
            });
          }
        }
      }

      this._buildArches(data, rng);
      this._buildVines(data, rng);
      this._buildKelp();
    }

    _coralFan(b, x, y, scale, rng, z) {
      const zz = z != null ? z : Z.deco;
      const p = M.PAL || {};
      const cols = [
        p.coralPink != null ? p.coralPink : 0xf28ba0,
        p.coral != null ? p.coral : 0xe06a6a,
        p.coralOrange != null ? p.coralOrange : 0xf5a24a,
        p.coralPurple != null ? p.coralPurple : 0x9a6ad1,
      ];
      const base = cols[Math.floor(rng() * cols.length) % cols.length];
      const n = 5 + Math.floor(rng() * 4);
      const bx = x + (rng() - 0.5) * 6;
      for (let i = 0; i < n; i++) {
        const spread = (i / (n - 1) - 0.5) * 1.9 + (rng() - 0.5) * 0.16;
        const a = -Math.PI / 2 + spread;
        const dx = Math.cos(a), dy = Math.sin(a);
        const px = -dy, py = dx;
        const len = (20 + rng() * 28) * scale;
        const hw = (3.2 + rng() * 3.4) * scale;
        const tw = hw * 0.28;
        const bxx = bx + (rng() - 0.5) * 10 * scale;
        const byy = y - 2;
        const c0 = rgb(base, 0.72);
        const c1 = rgb(base, 1.05);
        b.quad(
          bxx - px * hw, byy - py * hw,
          bxx + px * hw, byy + py * hw,
          bxx + dx * len + px * tw, byy + dy * len + py * tw,
          bxx + dx * len - px * tw, byy + dy * len - py * tw,
          zz,
          [0, 0, 1, 1],
          [c0, c0, c1, c1]
        );
      }
      // stem
      const cc = rgb(base, 0.6);
      b.quad(bx - 4 * scale, y - 3, bx + 4 * scale, y - 3, bx + 3 * scale, y + 14 * scale, bx - 3 * scale, y + 14 * scale, zz - 0.01, [0, 0, 1, 1], [cc, cc, cc, cc]);
    }

    _tubeSponge(b, x, y, scale, rng, z) {
      const zz = z != null ? z : Z.deco;
      const p = M.PAL || {};
      const cols = [
        p.coralOrange != null ? p.coralOrange : 0xf5a24a,
        p.coral != null ? p.coral : 0xe06a6a,
        p.coralPink != null ? p.coralPink : 0xf28ba0,
        0xf7d05a,
      ];
      const base = cols[Math.floor(rng() * cols.length) % cols.length];
      const h = (24 + rng() * 34) * scale;
      const w = (9 + rng() * 8) * scale;
      const cb = rgb(base, 0.62);
      const ct = rgb(base, 1.02);
      b.quad(x - w / 2, y - 2, x + w / 2, y - 2, x + w * 0.4, y + h, x - w * 0.4, y + h, zz, [0, 0, 1, 1], [cb, cb, ct, ct]);
      // lighter bands
      const cband = rgb(base, 1.2);
      for (let k = 1; k <= 3; k++) {
        const t = k / 4;
        const yy = y - 2 + h * t;
        const ww = w * (1 - t * 0.18);
        b.quad(x - ww / 2, yy, x + ww / 2, yy, x + ww / 2, yy + 3.5, x - ww / 2, yy + 3.5, zz + 0.02, [0, 0, 1, 1], [cband, cband, cband, cband]);
      }
      const cm = rgb(0x2a1220, 1);
      b.quad(x - w * 0.28, y + h - 4, x + w * 0.28, y + h - 4, x + w * 0.28, y + h, x - w * 0.28, y + h, zz + 0.03, [0, 0, 1, 1], [cm, cm, cm, cm]);
    }

    _smallRock(b, x, y, scale, rng, z) {
      const grey = 0x6d7f8f;
      const w = (12 + rng() * 20) * scale;
      const h = (8 + rng() * 14) * scale;
      const pts = [
        [x - w, y - 2],
        [x - w * 0.6, y + h * 0.75],
        [x - w * 0.1, y + h],
        [x + w * 0.55, y + h * 0.8],
        [x + w, y - 2],
      ];
      b.poly(pts, z != null ? z : Z.deco + 0.01, rgb(grey, 0.5), rgb(grey, 1.05));
    }

    _buildArches(data, rng) {
      const zones = data.zones || [];
      const solids = data.solids || [];
      const stone = this._batch('block:arch', {
        tex: 'stone',
        texOpts: { seed: 23 },
        mat: { color: 0xb0c4d0, vertexColors: true },
      });
      const width = data.width;
      for (let x = 420; x < width - 300; x += 900 + rng() * 620) {
        // only in open water
        let open = false;
        for (let i = 0; i < zones.length; i++) {
          const z = zones[i];
          if (!z || z.water === false) continue;
          if ((z.kind || OPEN) === TUNNEL) continue;
          if (x >= num(z.x, 0) && x <= num(z.x, 0) + num(z.w, 0) && x + 320 < num(z.x, 0) + num(z.w, 0)) { open = true; break; }
        }
        if (!open) continue;
        // find ground height under the arch feet
        let ground = 0;
        for (let i = 0; i < solids.length; i++) {
          const s = solids[i];
          if (num(s.x, 0) <= x && num(s.x, 0) + num(s.w, 0) >= x) {
            const t = num(s.y, 0) + num(s.h, 0);
            if (t < 500 && t > ground) ground = t;
          }
        }
        if (ground < 1) continue;
        const z = Z.arch;
        stone.rect(x, ground, 34, 150, z, { texW: 96, topShade: 1, bottomShade: 0.7 });
        stone.rect(x + 276, ground, 34, 150, z, { texW: 96, topShade: 1, bottomShade: 0.7 });
        stone.rect(x - 10, ground + 138, 330, 30, z, { texW: 96, topShade: 1.05, bottomShade: 0.82 });
        stone.rect(x + 40, ground + 162, 250, 26, z, { texW: 96, topShade: 1.05, bottomShade: 0.8 });
        stone.rect(x + 92, ground + 182, 150, 24, z, { texW: 96, topShade: 1.05, bottomShade: 0.8 });
      }
    }

    _buildVines(data, rng) {
      const zones = data.zones || [];
      const vines = this._batch('vines', {
        tex: 'vine',
        mat: {
          color: 0xa8d8a0,
          vertexColors: true,
          side: THREE.DoubleSide,
          alphaTest: 0.45,
        },
      });
      for (let i = 0; i < zones.length; i++) {
        const z = zones[i];
        if (!z || z.water === false) continue;
        if ((z.kind || OPEN) === TUNNEL || z.surface === false) continue;
        const x0 = num(z.x, 0), w = num(z.w, 0), yt = num(z.yTop, 0);
        let px = x0 + 150 + rng() * 170;
        while (px < x0 + w - 120) {
          const vw = 16 + rng() * 22;
          const len = 80 + rng() * 240;
          const sway = (rng() - 0.5) * 30;
          const shade = 0.75 + rng() * 0.3;
          vines.quad(
            px, yt - 2,
            px + vw, yt - 2,
            px + vw * 0.8 + sway, yt - len,
            px + vw * 0.2 + sway, yt - len,
            Z.vines,
            [0, 0, 1, 1],
            gcols(shade, shade, shade, shade)
          );
          px += 190 + rng() * 260;
        }
      }
    }

    _buildKelp() {
      const data = this._kelpData;
      if (!data.length) return;
      const geo = new THREE.PlaneGeometry(1, 1);
      geo.translate(0, 0.5, 0);
      const mat = M.Tex.mat('kelp', {
        lit: true,
        alphaTest: 0.45,
        side: THREE.DoubleSide,
        color: 0xffffff,
      });
      const mesh = new THREE.InstancedMesh(geo, mat, data.length);
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.frustumCulled = false;
      mesh.name = 'kelp-field';
      const c = new THREE.Color();
      for (let i = 0; i < data.length; i++) {
        mesh.setColorAt(i, c.setHex(data[i].tint));
        data[i].sway = data[i].amp * 3;
      }
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      this.root.add(mesh);
      this._geometries.push(geo);
      this._kelp = { mesh: mesh, data: data };
      this._updateKelp(0);
    }

    /* ------------------------------------------------------- bonus rooms */
    _buildBonusRooms(data) {
      const rooms = data.rooms || [];
      this.rooms = rooms;
      if (!rooms.length) return;
      const cave = this._batch('cave', { tex: 'caveGradient', mat: { lit: false } });
      const rock = this._batch('roomRock', {
        tex: 'rockDark',
        mat: { lit: false, color: 0x5a7386 },
      });
      const glow = this._batch('roomGlow', {
        tex: 'glow',
        mat: {
          lit: false,
          transparent: true,
          opacity: 0.34,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          color: 0xffc96a,
        },
      });
      const coinPositions = [];
      const items = (this.level && this.level.items) || [];

      for (let i = 0; i < rooms.length; i++) {
        const r = rooms[i] || {};
        // rooms may be given as {rect:{x,y,w,h}} (level.js) or flat {x,y,w,h}
        const rect = r.rect || r;
        const x = num(rect.x, 0), y = num(rect.y, 0);
        const w = num(rect.w, 320), h = num(rect.h, 320);
        if (!(w > 0) || !(h > 0)) continue;

        // dark cave shell a little larger than the room: no bright backdrop may
        // leak around the collision blocks that seal the room
        cave.rect(x - 40, y - 40, w + 80, h + 80, Z.tunnelBack - 2, { u0: 0, v0: 0, u1: 1, v1: 1 });
        // rocky shell sits just behind the room's collision blocks
        const t = 26;
        rock.rect(x - 4, y - 4, w + 8, t, Z.tunnelBack + 1, { texW: 96 });
        rock.rect(x - 4, y + h - t + 4, w + 8, t, Z.tunnelBack + 1, { texW: 96 });
        rock.rect(x - 4, y, t, h, Z.tunnelBack + 1, { texW: 96 });
        rock.rect(x + w - t + 4, y, t, h, Z.tunnelBack + 1, { texW: 96 });
        // warm torch pools + a lit strip along the cave floor
        glow.rect(x + w * 0.5 - 170, y + h * 0.55 - 105, 340, 230, Z.tunnelBack + 2, { u0: 0, v0: 0, u1: 1, v1: 1 });
        glow.rect(x + 10, y + 6, w - 20, 84, Z.tunnelBack + 2, { u0: 0, v0: 0, u1: 1, v1: 1 });
        glow.rect(x + 6, y + h * 0.5 - 130, 64, 260, Z.tunnelBack + 2, { u0: 0, v0: 0, u1: 1, v1: 1 });
        glow.rect(x + w - 70, y + h * 0.5 - 130, 64, 260, Z.tunnelBack + 2, { u0: 0, v0: 0, u1: 1, v1: 1 });

        // coin glints: use the real coin item coordinates when available so the
        // sparkle sits exactly behind each entity coin (entity z is in front)
        let placed = 0;
        for (let k = 0; k < items.length && placed < 24; k++) {
          const it = items[k];
          if (!it || it.type !== 'coin') continue;
          const cx = num(it.x, -1e5), cy = num(it.y, -1e5);
          if (cx < x || cx > x + w || cy < y || cy > y + h) continue;
          coinPositions.push(cx, cy, Z.tunnelBack + 3, (placed % 7) * 0.7);
          placed++;
        }
        if (!placed) {
          const n = Math.min(typeof r.coins === 'number' ? r.coins : 10, 20);
          for (let k = 0; k < n; k++) {
            const tt = n > 1 ? k / (n - 1) : 0.5;
            const cx = x + w * (0.18 + 0.64 * tt);
            const cy = y + h * 0.5 + Math.sin(tt * Math.PI) * h * 0.16;
            coinPositions.push(cx, cy, Z.tunnelBack + 3, (k % 7) * 0.7);
          }
        }
        // NOTE: the room's entrance/exit pipes are part of level.pipes and are
        // already drawn by _buildPipes() at their world coordinates.
      }

      if (coinPositions.length) {
        const count = coinPositions.length / 4;
        const pos = new Float32Array(count * 3);
        const phases = new Float32Array(count);
        for (let i = 0; i < count; i++) {
          pos[i * 3] = coinPositions[i * 4];
          pos[i * 3 + 1] = coinPositions[i * 4 + 1];
          pos[i * 3 + 2] = coinPositions[i * 4 + 2];
          phases[i] = coinPositions[i * 4 + 3];
        }
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        const mat = new THREE.PointsMaterial({
          map: M.Tex.sprite('coin'),
          size: 15,
          transparent: true,
          opacity: 0.75,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
          color: 0xffe27a,
          sizeAttenuation: false,
        });
        const pts = new THREE.Points(g, mat);
        pts.frustumCulled = false;
        pts.name = 'room-coins';
        this.root.add(pts);
        this._geometries.push(g);
        this._ownedMaterials.push(mat);
        this._roomCoinMats.push(mat);
        this._roomCoinPhases = phases;
      }
    }

    /* ------------------------------------------------------------- goal */
    _buildGoal(data) {
      const g = data.goal;
      if (!g) return;
      const meta = (this.level && this.level.meta) || {};
      const width = data.width;
      const beachX = num(meta.beachX, num(g.x, width) - 250);
      const goalX = num(g.x, beachX + 250);
      // MUST be the walkable collision plateau top - goal.js stands on it too
      const plateauTop = num(g.groundY, num(g.y, num(meta.plateauY, (M.C && M.C.WATER_TOP_Y) || 900)));
      const shoreTop = num(this._waterTopAt(beachX - 30), plateauTop);

      // ---------- soft warm sky over the beach ---------------------------
      const skyH = 780;
      const skyX = beachX - 80;
      const skyW = width + 520 - skyX;
      const skyMat = M.Tex.mat('skyWarm', { lit: false });
      const sky = this._planeMesh(skyW, skyH, skyMat, Z.goalSky);
      sky.position.set(skyX + skyW / 2, plateauTop + skyH / 2, Z.goalSky);
      // no additive bloom or horizon haze: the sun is baked into the sky
      // gradient, so nothing rectangular can show up around the cards/flag.

      // ---------- batches -------------------------------------------------
      const decoB = this._batch('beachDeco', {
        tex: null,
        mat: { lit: false, color: 0xffffff, vertexColors: true },
      });
      const wetB = this._batch('beachWet', {
        tex: 'sandWet',
        mat: { color: 0xffffff, vertexColors: true, emissive: 0x8a3c10, emissiveIntensity: 0.3 },
      });
      const foamB = this._batch('goalFoam', {
        tex: 'surface',
        texOpts: { seed: 11 },
        mat: {
          lit: false,
          transparent: true,
          opacity: 0.48,
          blending: THREE.NormalBlending,
          depthWrite: false,
        },
      });
      const surf2 = this._batch('surface2');
      const whiteB = this._batch('whitewater', {
        tex: 'glow',
        texOpts: {},
        mat: {
          lit: false,
          transparent: true,
          opacity: 0.36,
          blending: THREE.NormalBlending,
          depthWrite: false,
          color: 0xeaffff,
        },
      });
      const wood = this._batch('post', {
        tex: 'wood',
        mat: { color: 0xffffff, vertexColors: true },
      });

      // ---------- wet stepped bank at the waterline (silhouette only) -----
      for (let k = 0; k < 5; k++) {
        const wBand = 168 - k * 27;
        wetB.rect(beachX, plateauTop - (k + 1) * 40, wBand, 42, 0.11 + k * 0.002, {
          texW: 96,
          topShade: k === 0 ? 0.98 : 0.9,
          bottomShade: 0.62,
        });
      }
      wetB.rect(beachX, plateauTop - 18, 182, 20, 0.14, { texW: 96, topShade: 0.9, bottomShade: 0.72 });

      // ---------- sparse, tiny pebbles / shells ---------------------------
      for (let k = 0; k < 22; k++) {
        if (hash01(k * 2.9) > 0.62) continue;
        const x = beachX + 30 + hash01(k * 4.7) * (width - beachX - 40);
        const y = plateauTop - 350 + hash01(k * 8.1) * 320;
        const rr = 1.4 + hash01(k * 5.5) * 2.2;
        const cc = hash01(k * 7.7) > 0.6 ? lc3(0.93, 0.86, 0.68) : lc3(0.4, 0.32, 0.2);
        decoB.quad(x, y, x + rr * 2, y, x + rr * 2, y + rr * 1.3, x, y + rr * 1.3, 0.13, [0, 0, 1, 1], [cc, cc, cc, cc]);
      }

      // ---------- soft warm lip along the plateau ridge --------------------
      for (let px = beachX; px < width + 80; px += 40) {
        const yy = plateauTop - 2 + Math.sin(px * 0.06) * 1.6;
        const cc = lc3(0.95, 0.86, 0.62);
        decoB.quad(px, yy, px + 30, yy, px + 30, yy + 3, px, yy + 3, 0.36, [0, 0, 1, 1], [cc, cc, cc, cc]);
      }

      // ---------- dune mounds break the straight ridge ---------------------
      const mounds = 6;
      for (let k = 0; k < mounds; k++) {
        const mx = beachX + 40 + ((k + 0.25 + hash01(k * 3.3) * 0.5) * (width - beachX - 60)) / mounds;
        const mw = 60 + hash01(k * 5.1) * 150;
        const mh = 8 + hash01(k * 8.8) * 22;
        decoB.poly(
          [
            [mx - mw / 2, plateauTop],
            [mx - mw * 0.32, plateauTop + mh * 0.9],
            [mx, plateauTop + mh],
            [mx + mw * 0.35, plateauTop + mh * 0.82],
            [mx + mw / 2, plateauTop],
          ],
          0.35,
          lc3(0.82, 0.7, 0.47),
          lc3(0.96, 0.87, 0.64)
        );
      }

      // ---------- dune grass tufts + dry pebbles ---------------------------
      for (let k = 0; k < 18; k++) {
        const tx = beachX + 30 + hash01(k * 6.7) * (width - beachX - 50);
        const gh = 10 + hash01(k * 2.9) * 24;
        for (let b = 0; b < 3; b++) {
          const lean = (b - 1) * 5 + (hash01(k * 11 + b) - 0.5) * 3;
          const cc = b === 1 ? lc3(0.42, 0.62, 0.34) : lc3(0.28, 0.5, 0.28);
          decoB.quad(
            tx + lean - 1, plateauTop - 1,
            tx + lean + 1, plateauTop - 1,
            tx + lean * 1.6 + 1, plateauTop + gh,
            tx + lean * 1.6 - 1, plateauTop + gh,
            0.37, [0, 0, 1, 1], [cc, cc, cc, cc]
          );
        }
      }
      for (let k = 0; k < 22; k++) {
        const x = beachX + 20 + hash01(k * 9.1) * (width - beachX - 30);
        const y = plateauTop + 2 + hash01(k * 4.3) * 30;
        const cc = hash01(k * 3.1) > 0.5 ? lc3(0.95, 0.9, 0.76) : lc3(0.5, 0.41, 0.27);
        decoB.quad(x, y, x + 3, y, x + 3, y + 2.4, x, y + 2.4, 0.38, [0, 0, 1, 1], [cc, cc, cc, cc]);
      }

      // ---------- whitewater where the sea meets the bank ------------------
      const surfTop = Math.max(shoreTop, plateauTop + 6);
      // vertical foam sheet running down the cliff face: several strips with
      // irregular tops/bottoms so there is no straight cyan cut against the sand
      for (let k = 0; k < 8; k++) {
        const sx = beachX - 16 + k * 9;
        const topY = surfTop - 4 + hash01(k * 3.1) * 14;
        const botY = plateauTop - 10 - hash01(k * 7.7) * 38;
        whiteB.quad(
          sx, topY,
          sx + 14, topY + 2,
          sx + 17, botY,
          sx + 2, botY + 5,
          Z.surface + 0.1 + k * 0.002,
          [0, 0, 1, 1],
          gcols(0.8, 0.8, 0.9, 0.9)
        );
      }
      // sheet spilling over the lip onto the wet sand
      whiteB.quad(
        beachX - 22, surfTop + 6,
        beachX + 30, surfTop + 6,
        beachX + 52, plateauTop - 18,
        beachX + 2, plateauTop - 18,
        Z.surface + 0.12,
        [0, 0, 1, 1],
        gcols(0.75, 0.75, 0.85, 0.85)
      );
      // narrow foam streaks riding the vertical sheet
      for (let k = 0; k < 5; k++) {
        const fx = beachX - 4 + k * 11;
        surf2.rect(fx, plateauTop - 6 - hash01(k * 4.3) * 24, 5, surfTop - plateauTop + 10, Z.surface + 0.14, {
          texW: 160,
          vScale: 5 / 160,
        });
      }
      foamB.rect(beachX - 10, plateauTop - 16, 140, 26, 0.52, { texW: 128, vScale: 1 });
      // broken foam lip along the top of the wet bands
      for (let k = 0; k < 9; k++) {
        const fx = beachX - 12 + k * 19 + hash01(k * 3.7) * 8;
        const fy = plateauTop - 6 - hash01(k * 5.3) * 10;
        const fr = 5 + hash01(k * 7.1) * 9;
        decoB.poly(
          [
            [fx - fr, fy],
            [fx - fr * 0.4, fy + fr * 0.8],
            [fx + fr * 0.5, fy + fr * 0.7],
            [fx + fr, fy],
          ],
          0.55,
          lc3(0.9, 0.97, 1.0),
          lc3(1, 1, 1)
        );
      }
      // a little spray at the waterline
      for (let k = 0; k < 6; k++) {
        const fx = beachX - 50 + hash01(k * 7.1) * 120;
        const fy = shoreTop - 12 + hash01(k * 3.7) * 24;
        const fr = 4 + hash01(k * 5.3) * 8;
        decoB.poly(
          [
            [fx - fr, fy],
            [fx - fr * 0.4, fy + fr * 0.7],
            [fx + fr * 0.5, fy + fr * 0.6],
            [fx + fr, fy],
          ],
          0.56,
          lc3(0.9, 0.97, 1.0),
          lc3(1, 1, 1)
        );
      }

      // ---------- wooden signpost (goal.js owns the flag + pedestal) ------
      const postX = goalX - 70;
      wood.rect(postX, plateauTop, 16, 122, Z.post, { texW: 32 });
      wood.rect(postX - 26, plateauTop + 104, 68, 12, Z.post, { texW: 32, topShade: 1.12, bottomShade: 0.9 });
      wood.rect(postX - 26, plateauTop + 114, 68, 3, Z.post + 0.01, { texW: 32, topShade: 1.3, bottomShade: 1.3 });

      // hanging sign board so it reads as an exit signpost, not a telephone pole
      const signX = postX - 20;
      const signY = plateauTop + 62;
      const signW = 58, signH = 38;
      const signB = this._batch('postSign', {
        tex: 'wood',
        mat: { color: 0xe8c692, vertexColors: true },
      });
      signB.rect(signX - 3, signY - 3, signW + 6, signH + 6, Z.post + 0.08, {
        texW: 32,
        topShade: 0.9,
        bottomShade: 0.6,
      });
      signB.rect(signX, signY, signW, signH, Z.post + 0.09, {
        texW: 32,
        topShade: 1.16,
        bottomShade: 0.92,
      });
      // hanging ropes up to the crossbar
      signB.rect(postX - 9, signY + signH, 3, 8, Z.post + 0.1, { texW: 32, topShade: 0.9, bottomShade: 0.9 });
      signB.rect(postX + 22, signY + signH, 3, 8, Z.post + 0.1, { texW: 32, topShade: 0.9, bottomShade: 0.9 });
      // carved dark triangle insignia
      const ink = lc3(0.34, 0.2, 0.09);
      decoB.poly(
        [
          [signX + 19, signY + 12],
          [signX + 29, signY + 28],
          [signX + 39, signY + 12],
        ],
        Z.post + 0.11,
        ink,
        ink
      );
      const ink2 = lc3(0.2, 0.12, 0.05);
      decoB.quad(signX + 16, signY + 7, signX + 42, signY + 7, signX + 42, signY + 10, signX + 16, signY + 10, Z.post + 0.11, [0, 0, 1, 1], [ink2, ink2, ink2, ink2]);

      // NOTE: no additive glow of any kind on the beach - the sunset warmth
      // comes from the baked sky gradient and the lit sand blocks.
    }

    /* ---------------------------------------------------------- bubbles */
    _buildBubbles(data) {
      const zones = data.zones || [];
      const rng = M.rng(0xb0bb1e);
      const data2 = [];
      for (let i = 0; i < zones.length; i++) {
        const z = zones[i];
        if (!z || z.water === false) continue;
        const x = num(z.x, 0), w = num(z.w, 0);
        const yb = num(z.yBottom, 0), yt = num(z.yTop, 0);
        if (!(w > 40) || !(yt > yb + 20)) continue;
        const cols = Math.max(1, Math.min(26, Math.round(w / 200)));
        for (let c = 0; c < cols; c++) {
          const bx = x + 80 + ((w - 160) * (c + 0.15 + rng() * 0.7)) / cols;
          const nb = 5 + Math.floor(rng() * 4);
          for (let k = 0; k < nb; k++) {
            data2.push({
              x: bx + (rng() - 0.5) * 26,
              y: yb + 20 + rng() * (yt - yb - 40),
              z: Z.bubbles + rng() * 0.6,
              spd: 16 + rng() * 46,
              amp: 3 + rng() * 10,
              phase: rng() * TAU,
              freq: 0.8 + rng() * 1.6,
              bottom: yb + 6,
              top: yt - 6,
              reseed: rng(),
            });
          }
        }
      }
      if (!data2.length) return;
      const pos = new Float32Array(data2.length * 3);
      for (let i = 0; i < data2.length; i++) {
        pos[i * 3] = data2[i].x;
        pos[i * 3 + 1] = data2[i].y;
        pos[i * 3 + 2] = data2[i].z;
      }
      const g = new THREE.BufferGeometry();
      const attr = new THREE.BufferAttribute(pos, 3);
      attr.setUsage(THREE.DynamicDrawUsage);
      g.setAttribute('position', attr);
      const mat = new THREE.PointsMaterial({
        map: M.Tex.sprite('bubble'),
        size: 13,
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        color: 0xcdeeff,
        sizeAttenuation: false,
      });
      const pts = new THREE.Points(g, mat);
      pts.frustumCulled = false;
      pts.name = 'bubbles';
      this.root.add(pts);
      this._geometries.push(g);
      this._ownedMaterials.push(mat);
      this._bubbles = { points: pts, mat: mat, attr: attr, data: data2 };
    }

    _buildMotes() {
      const n = 90;
      const rng = M.rng(0x5075);
      const arr = new Float32Array(n * 3);
      const data = [];
      for (let i = 0; i < n; i++) {
        const d = {
          x: (rng() - 0.5) * 1700,
          y: (rng() - 0.5) * 900,
          spd: 3 + rng() * 9,
          amp: 4 + rng() * 14,
          phase: rng() * TAU,
        };
        data.push(d);
        arr[i * 3] = d.x;
        arr[i * 3 + 1] = d.y;
        arr[i * 3 + 2] = 0;
      }
      const g = new THREE.BufferGeometry();
      const attr = new THREE.BufferAttribute(arr, 3);
      attr.setUsage(THREE.DynamicDrawUsage);
      g.setAttribute('position', attr);
      const mat = new THREE.PointsMaterial({
        map: M.Tex.sprite('spark'),
        size: 6,
        transparent: true,
        opacity: 0.5,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        color: 0xdff8ff,
        sizeAttenuation: false,
      });
      const pts = new THREE.Points(g, mat);
      pts.frustumCulled = false;
      pts.name = 'motes';
      const group = new THREE.Group();
      group.name = 'motes-group';
      group.add(pts);
      group.position.z = -4;
      this.root.add(group);
      this._geometries.push(g);
      this._ownedMaterials.push(mat);
      this._motes = { group: group, attr: attr, data: data };
    }

    /* ------------------------------------------------------- foreground */
    _buildForeground() {
      const group = new THREE.Group();
      group.name = 'foreground';
      group.position.z = Z.foreground;
      this.root.add(group);
      this.foreground = group;
      const rng = M.rng(0xf00d);

      // Only the tips of dark kelp blades intrude from the bottom edge. The
      // group follows the camera, so these are laid out in screen-ish local
      // coordinates: base below the bottom edge, tips no higher than ~100px
      // into a 480-unit-tall view. They never reach the middle of the frame.
      const blade = this._batch('fgKelp', {
        tex: 'kelp',
        mat: {
          lit: false,
          transparent: true,
          opacity: 0.9,
          alphaTest: 0.3,
          side: THREE.DoubleSide,
          depthWrite: false,
          vertexColors: true,
        },
      });
      const spots = [-1420, -1180, -980, -760, -540, -300, 260, 430, 620, 830];
      for (let i = 0; i < spots.length; i++) {
        const x = spots[i] + (rng() - 0.5) * 120;
        const y = -305 + rng() * 45;
        const h = 60 + rng() * 82;
        const w = 44 + rng() * 60;
        const lean = (rng() - 0.5) * 90;
        const dark = 0.6 + rng() * 0.35;
        const c = [0.018 * dark, 0.07 * dark, 0.115 * dark];
        blade.quad(
          x - w / 2, y,
          x + w / 2, y,
          x + lean + w * 0.3, y + h,
          x + lean - w * 0.3, y + h,
          0,
          [0, 0, 1, 1],
          [c, c, [c[0] * 1.6, c[1] * 1.6, c[2] * 1.6], [c[0] * 1.6, c[1] * 1.6, c[2] * 1.6]]
        );
      }
      // very soft dark blobs hugging the bottom corners
      const blur = this._batch('fgBlur', {
        tex: 'glow',
        mat: {
          lit: false,
          transparent: true,
          opacity: 0.3,
          depthWrite: false,
          vertexColors: true,
        },
      });
      const b1 = [0.015, 0.04, 0.07];
      blur.quad(-1500, -330, -760, -330, -760, -160, -1500, -160, 0, [0, 0, 1, 1], [b1, b1, b1, b1]);
      blur.quad(700, -340, 1440, -340, 1440, -150, 700, -150, 0, [0, 0, 1, 1], [b1, b1, b1, b1]);
      // fg batches are flushed with the rest of the static batches; they are
      // re-parented into the camera-following group after the flush.
      this._fgKeys = ['fgKelp', 'fgBlur'];
    }

    _buildVignette() {
      const topMat = M.Tex.mat('vignette', {
        lit: false,
        transparent: true,
        depthTest: false,
        depthWrite: false,
        opacity: 0.8,
      });
      const bottomMat = M.Tex.mat('vignette', {
        lit: false,
        transparent: true,
        depthTest: false,
        depthWrite: false,
        opacity: 0.8,
        tex: { flip: 1 },
      });
      const top = this._planeMesh(3800, 200, topMat, Z.vignette);
      top.renderOrder = 60;
      const bottom = this._planeMesh(3800, 200, bottomMat, Z.vignette);
      bottom.renderOrder = 61;
      this._vignettes = { top: top, bottom: bottom };
      this._vigMats = [topMat, bottomMat];
      this._vigBase = 0.8;
    }

    /* ------------------------------------------------------------ stats */
    _computeStats() {
      let draws = 0, tris = 0;
      this.root.traverse(function (o) {
        if (!(o.isMesh || o.isPoints)) return;
        draws++;
        const g = o.geometry;
        if (!g) return;
        const c = g.index ? g.index.count : g.attributes && g.attributes.position ? g.attributes.position.count : 0;
        let t = Math.floor(c / 3);
        if (o.isInstancedMesh) t *= o.count;
        tris += t;
      });
      this.drawCalls = draws;
      this.triangles = tris;
    }

    /* ----------------------------------------------------------- update */
    update(dt, rig) {
      if (!this.root) return;
      dt = dt > 0.1 ? 0.1 : dt || 0;
      const t = (this._t += dt);

      rig = rig || (M.Game && M.Game.camera) || null;
      const rx = rig && isFinite(rig.x) ? rig.x : 0;
      const ry = rig && isFinite(rig.y) ? rig.y : 0;
      const vh = rig && isFinite(rig.viewH) && rig.viewH > 0
        ? rig.viewH
        : (M.C && M.C.VIEW_H) || 480;

      // camera-anchored background + vignette
      if (this._bgMesh) {
        this._bgMesh.position.x = rx;
        this._bgMesh.position.y = ry;
      }
      if (this._vignettes) {
        // keep the soft shade proportional to the (small) view height
        const sy = Math.max(0.24, Math.min(1.2, (vh * 0.16) / 200));
        const half = vh * 0.5;
        const v = this._vignettes;
        v.top.scale.set(1, sy, 1);
        v.bottom.scale.set(1, sy, 1);
        v.top.position.x = rx;
        v.top.position.y = ry + half - 100 * sy;
        v.bottom.position.x = rx;
        v.bottom.position.y = ry - half + 100 * sy;
        if (this._vigMats) {
          // fade the vignette out over the sunlit beach so the goal stays crisp
          const g2 = M.clamp((rx - 5300) / 540, 0, 1);
          const fade = 1 - 0.82 * (M.smoothstep ? M.smoothstep(g2) : g2);
          const op = this._vigBase * fade;
          this._vigMats[0].opacity = op;
          this._vigMats[1].opacity = op;
        }
      }

      // parallax layers (ortho cameras do not parallax by themselves)
      if (this._farGroup) {
        this._farGroup.position.x = rx * 0.85;
        this._farGroup.position.y = ry * 0.95;
      }
      if (this._midGroup) {
        this._midGroup.position.x = rx * 0.65;
        this._midGroup.position.y = ry * 0.93;
      }
      if (this.foreground) {
        // x parallax 1.15x; y follows exactly so the blade tips stay pinned to
        // the bottom edge at any camera height (they must not cover the player)
        this.foreground.position.x = rx * 1.15;
        this.foreground.position.y = ry;
        if (this._fgMats) {
          // deep-water foreground has no place in front of the sunlit beach
          const fg2 = M.clamp((rx - 5350) / 560, 0, 1);
          const fgf = 1 - 0.72 * (M.smoothstep ? M.smoothstep(fg2) : fg2);
          for (let i = 0; i < this._fgMats.length; i++) {
            const fm = this._fgMats[i];
            fm.opacity = (fm.userData.baseOpacity == null ? 0.9 : fm.userData.baseOpacity) * fgf;
          }
        }
      }
      if (this._motes) {
        this._motes.group.position.x = rx;
        this._motes.group.position.y = ry;
        const arr = this._motes.attr.array;
        const md = this._motes.data;
        for (let i = 0; i < md.length; i++) {
          const d = md[i];
          d.y += d.spd * dt;
          if (d.y > 470) d.y = -470;
          arr[i * 3] = d.x + Math.sin(t * 0.4 + d.phase) * d.amp;
          arr[i * 3 + 1] = d.y;
        }
        this._motes.attr.needsUpdate = true;
      }

      // drifting caustics + scrolling surface
      if (this._causticTexA) {
        this._causticTexA.offset.x = (t * 0.011) % 1;
        this._causticTexA.offset.y = (t * 0.005) % 1;
      }
      if (this._causticTexB) {
        this._causticTexB.offset.x = (-t * 0.008) % 1;
        this._causticTexB.offset.y = (t * 0.004) % 1;
      }
      if (this._surfTex1) {
        this._surfTex1.offset.x = (t * 0.025) % 1;
        this._surfTex1.offset.y = Math.sin(t * 0.7) * 0.01;
      }
      if (this._surfTex2) {
        this._surfTex2.offset.x = (-t * 0.018) % 1;
        this._surfTex2.offset.y = Math.sin(t * 0.5 + 1.3) * 0.02;
      }
      if (this._rayMat) this._rayMat.opacity = 0.3 + 0.12 * Math.sin(t * 0.45);

      // ? blocks pulse
      if (this._itemboxMat) {
        this._itemboxMat.emissiveIntensity = 0.3 + 0.16 * (0.5 + 0.5 * Math.sin(t * 3.1));
      }
      // entrance/exit pipe glow pulse
      for (let i = 0; i < this._glows.length; i++) {
        const g = this._glows[i];
        const p = 0.5 + 0.5 * Math.sin(t * g.speed + g.phase);
        g.mat.opacity = g.base * (0.55 + 0.65 * p);
        const s = 1 + 0.09 * p;
        g.mesh.scale.set(s, s, 1);
      }
      // bonus-room coin twinkle
      for (let i = 0; i < this._roomCoinMats.length; i++) {
        this._roomCoinMats[i].opacity = 0.45 + 0.32 * (0.5 + 0.5 * Math.sin(t * 2.3));
      }

      this._updateKelp(t);
      this._updateBubbles(dt, t);
    }

    _updateKelp(t) {
      const k = this._kelp;
      if (!k) return;
      const data = k.data;
      const m = this._tm4, q = this._tq, e = this._te, v = this._tv, s = this._ts;
      for (let i = 0; i < data.length; i++) {
        const d = data[i];
        const sway = Math.sin(t * d.speed + d.phase) * d.amp;
        e.set(0, 0, d.tilt + sway);
        q.setFromEuler(e);
        v.set(d.x, d.y, d.z);
        s.set(d.w, d.h, 1);
        m.compose(v, q, s);
        k.mesh.setMatrixAt(i, m);
      }
      k.mesh.instanceMatrix.needsUpdate = true;
    }

    _updateBubbles(dt, t) {
      const b = this._bubbles;
      if (!b) return;
      const arr = b.attr.array;
      const data = b.data;
      for (let i = 0; i < data.length; i++) {
        const d = data[i];
        d.y += d.spd * dt;
        if (d.y > d.top) d.y = d.bottom + 4 + d.reseed * 26;
        arr[i * 3] = d.x + Math.sin(t * d.freq + d.phase) * d.amp;
        arr[i * 3 + 1] = d.y;
      }
      b.attr.needsUpdate = true;
    }

    /* ---------------------------------------------------------- dispose */
    dispose() {
      for (let i = 0; i < this._geometries.length; i++) {
        if (this._geometries[i] && this._geometries[i].dispose) this._geometries[i].dispose();
      }
      this._geometries.length = 0;
      for (let i = 0; i < this._ownedMaterials.length; i++) {
        if (this._ownedMaterials[i] && this._ownedMaterials[i].dispose) this._ownedMaterials[i].dispose();
      }
      this._ownedMaterials.length = 0;
      if (this.root && this.scene && this.scene.remove) this.scene.remove(this.root);
      this.root = null;
      this.foreground = null;
      this._built = false;
      this._batchMap.clear();
      this._byKey = Object.create(null);
      this._glows.length = 0;
      this._kelpData.length = 0;
      this._kelp = null;
      this._bubbles = null;
      this._motes = null;
      this._vignettes = null;
    }
  }

  /* foreground batches must be re-parented into the foreground group after
     the global batch flush (they carry camera-parallax transforms) */
  const _origBuild = World.prototype.build;
  World.prototype.build = function () {
    const r = _origBuild.call(this);
    if (!r || !r.root || !r.foreground || !r._fgKeys) return r;
    r._fgMats = [];
    for (let i = 0; i < r._fgKeys.length; i++) {
      const mesh = r._byKey[r._fgKeys[i]];
      if (!mesh) continue;
      r.foreground.add(mesh);
      const fm = mesh.material;
      if (fm) {
        if (fm.userData.baseOpacity == null) fm.userData.baseOpacity = fm.opacity;
        r._fgMats.push(fm);
      }
    }
    return r;
  };

  M.World = World;
})();