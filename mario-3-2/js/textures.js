/* =========================================================================
   MARIO 3-2 — textures.js
   Procedural HTMLCanvas texture + material factory for the underwater world.

   Every texture is baked exactly once (lazily, on first request) and cached by
   name + option key. Materials are cached the same way. Nothing here touches
   the GPU per frame; animation of textures is done by the caller through
   texture.offset / material.opacity, never by re-baking.

   Public API (also aliased as M32.Textures for the old SPEC name):
     M32.Tex.get(name, opts)        -> THREE.Texture   (cached, tiling by default)
     M32.Tex.mat(name, opts)        -> THREE.Material  (Lambert unless opts.lit=false)
     M32.Tex.colorMat(hex, opts)    -> cached untextured MeshLambertMaterial/MeshBasicMaterial
     M32.Tex.sprite(name, opts)     -> soft sprite texture (bubble / spark / coin / glow)
     M32.Tex.clear()                -> dispose every cached texture + material
     M32.Tex.has(name)              -> texture author exists?

   Names: brick wall stone rockDark sand beach floor coral pipe itembox used wood
          waterGradient bgGradient tunnelGradient caveGradient skyWarm airGradient
          caustic kelp vine coin bubble spark surface glow godray vignette
   ========================================================================= */
(function () {
  'use strict';
  window.M32 = window.M32 || {};
  const M = window.M32;
  const PAL = M.PAL || {};
  const PI2 = Math.PI * 2;

  /* ------------------------------------------------------------ colours */
  function hex(v) {
    const s = (v >>> 0).toString(16);
    return '#' + '000000'.slice(s.length) + s;
  }
  function rgba(v, a) {
    return 'rgba(' + ((v >> 16) & 255) + ',' + ((v >> 8) & 255) + ',' + (v & 255) + ',' + a + ')';
  }
  function mix(a, b, t) {
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
    const br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
    return (((ar + (br - ar) * t) << 16) | ((ag + (bg - ag) * t) << 8) | (ab + (bb - ab) * t)) >>> 0;
  }
  function lighten(c, t) { return mix(c, 0xffffff, t); }
  function darken(c, t) { return mix(c, 0x000000, t); }

  /* ------------------------------------------------------------ helpers */
  function rngFor(name, seed) {
    let h = (0x9e3779b9 ^ ((seed || 0) >>> 0)) >>> 0;
    for (let i = 0; i < name.length; i++) h = Math.imul(h ^ name.charCodeAt(i), 16777619) >>> 0;
    return M.rng ? M.rng(h) : (function () { let s = h; return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; })();
  }

  /**
   * Draw fn nine times, offset by ±w / ±h. Any motif that overflows one edge
   * reappears on the opposite edge, which is what makes the tile seamless.
   */
  function tile(ctx, w, h, fn) {
    for (let dy = -h; dy <= h; dy += h) {
      for (let dx = -w; dx <= w; dx += w) {
        ctx.save();
        ctx.translate(dx, dy);
        fn();
        ctx.restore();
      }
    }
  }

  function dot(ctx, x, y, r, fill) {
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, PI2);
    ctx.fill();
  }

  /* ----------------------------------------------------- texture sizes */
  const TEX_SIZE = {
    brick: [128, 128], wall: [128, 128], stone: [128, 128], rockDark: [128, 128],
    sand: [128, 128], beach: [128, 128], sandWet: [128, 128], floor: [128, 128], coral: [128, 128],
    pipe: [128, 128], itembox: [128, 128], used: [128, 128], wood: [128, 128],
    waterGradient: [256, 256], bgGradient: [256, 256], tunnelGradient: [256, 256],
    caveGradient: [256, 256], skyWarm: [256, 256], airGradient: [128, 256],
    caustic: [128, 128], kelp: [64, 256], vine: [64, 256], coin: [64, 64],
    bubble: [64, 64], spark: [64, 64], surface: [128, 64], glow: [128, 128],
    godray: [128, 256], vignette: [256, 128], edgeFade: [128, 128],
  };
  const SMOOTH = {
    waterGradient: 1, bgGradient: 1, tunnelGradient: 1, caveGradient: 1, skyWarm: 1,
    airGradient: 1, caustic: 1, glow: 1, bubble: 1, spark: 1, godray: 1, surface: 1,
    coin: 1, vignette: 1, edgeFade: 1,
  };
  const HREPEAT = { waterGradient: 1, airGradient: 1, bgGradient: 1 };
  const CLAMP = {
    waterGradient: 1, bgGradient: 1, tunnelGradient: 1, caveGradient: 1, skyWarm: 1,
    airGradient: 1, glow: 1, spark: 1, bubble: 1, vignette: 1, coin: 1,
    edgeFade: 1,
  };

  /* ============================================================ authors */
  const AUTHORS = {};

  AUTHORS.missing = function (ctx, w, h) {
    for (let y = 0; y < h; y += 16) {
      for (let x = 0; x < w; x += 16) {
        ctx.fillStyle = ((x + y) / 16) % 2 ? '#ff00aa' : '#221122';
        ctx.fillRect(x, y, 16, 16);
      }
    }
  };

  /* -------------------------------------------------------------- brick */
  AUTHORS.brick = function (ctx, w, h) {
    const base = PAL.brick != null ? PAL.brick : 0xc06a3a;
    const mortar = darken(PAL.brickDark != null ? PAL.brickDark : 0x8a4526, 0.32);
    ctx.fillStyle = hex(mortar);
    ctx.fillRect(0, 0, w, h);
    const rows = 2, bh = h / rows, bw = w / 2, gap = 5;
    for (let r = 0; r < rows; r++) {
      const off = (r % 2) ? bw / 2 : 0;
      for (let i = -1; i <= 2; i++) {
        const ci = ((i % 2) + 2) % 2;
        const v = M.hash01(r * 12.7 + ci * 5.3 + 2.1);
        const col = mix(base, v > 0.5 ? lighten(base, 0.24) : darken(base, 0.2), Math.abs(v - 0.5) * 1.5);
        const x = i * bw + off, y = r * bh;
        ctx.fillStyle = hex(col);
        ctx.fillRect(x + gap / 2, y + gap / 2, bw - gap, bh - gap);
        ctx.fillStyle = rgba(0xffffff, 0.2);
        ctx.fillRect(x + gap / 2, y + gap / 2, bw - gap, 3);
        ctx.fillRect(x + gap / 2, y + gap / 2, 3, bh - gap);
        ctx.fillStyle = rgba(0x000000, 0.24);
        ctx.fillRect(x + gap / 2, y + bh - gap / 2 - 3, bw - gap, 3);
        ctx.fillRect(x + bw - gap / 2 - 3, y + gap / 2, 3, bh - gap);
        for (let k = 0; k < 5; k++) {
          const vx = M.hash01(r * 71 + ci * 17 + k * 3.1);
          const vy = M.hash01(r * 37 + ci * 23 + k * 7.7);
          ctx.fillStyle = rgba(k % 2 ? 0xffffff : 0x000000, 0.08);
          ctx.fillRect(x + gap + vx * (bw - gap * 2 - 4), y + gap + vy * (bh - gap * 2 - 4), 3, 3);
        }
      }
    }
  };

  /* --------------------------------------------------------- stone / wall */
  function stoneLike(ctx, w, h, rng, base, crackAlpha) {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, hex(lighten(base, 0.2)));
    g.addColorStop(0.55, hex(base));
    g.addColorStop(1, hex(darken(base, 0.38)));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    tile(ctx, w, h, function () {
      for (let i = 0; i < 22; i++) {
        const x = rng() * w, y = rng() * h, r = 8 + rng() * 30;
        const lite = rng() < 0.5;
        ctx.fillStyle = lite ? rgba(0xffffff, 0.05) : rgba(0x000000, 0.08);
        ctx.beginPath();
        ctx.arc(x, y, r, 0, PI2);
        ctx.fill();
      }
      for (let i = 0; i < 80; i++) {
        const x = Math.floor(rng() * w), y = Math.floor(rng() * h);
        ctx.fillStyle = rng() < 0.5 ? rgba(0xffffff, 0.1) : rgba(0x000000, 0.11);
        ctx.fillRect(x, y, 2, 2);
      }
    });

    ctx.strokeStyle = rgba(0x000000, crackAlpha);
    ctx.lineWidth = 1.6;
    for (let i = 0; i < 7; i++) {
      let x = rng() * w, y = rng() * h;
      ctx.beginPath();
      ctx.moveTo(x, y);
      for (let s = 0; s < 4; s++) {
        x += (rng() - 0.5) * 44;
        y += (rng() - 0.5) * 44;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.strokeStyle = rgba(0xffffff, 0.06);
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.strokeStyle = rgba(0x000000, crackAlpha);
      ctx.lineWidth = 1.6;
    }
  }

  AUTHORS.stone = function (ctx, w, h, rng) {
    stoneLike(ctx, w, h, rng, PAL.stone != null ? PAL.stone : 0x6d7f8f, 0.24);
  };
  AUTHORS.rockDark = function (ctx, w, h, rng) {
    stoneLike(ctx, w, h, rng, PAL.stoneDark != null ? PAL.stoneDark : 0x4a5866, 0.34);
  };

  AUTHORS.wall = function (ctx, w, h) {
    const base = PAL.stone != null ? PAL.stone : 0x6d7f8f;
    ctx.fillStyle = hex(darken(base, 0.52));
    ctx.fillRect(0, 0, w, h);
    const bw = w / 2, bh = h / 2, gap = 6;
    for (let r = 0; r < 2; r++) {
      const off = (r % 2) ? bw / 2 : 0;
      for (let i = -1; i <= 2; i++) {
        const ci = ((i % 2) + 2) % 2;
        const col = mix(base, M.hash01(r * 9.3 + ci * 4.7) > 0.5 ? lighten(base, 0.18) : darken(base, 0.14), 0.5);
        const x = i * bw + off, y = r * bh;
        ctx.fillStyle = hex(col);
        ctx.fillRect(x + gap / 2, y + gap / 2, bw - gap, bh - gap);
        ctx.fillStyle = rgba(0xffffff, 0.16);
        ctx.fillRect(x + gap / 2, y + gap / 2, bw - gap, 3);
        ctx.fillStyle = rgba(0x000000, 0.26);
        ctx.fillRect(x + gap / 2, y + bh - gap / 2 - 3, bw - gap, 3);
        // chisel marks
        ctx.strokeStyle = rgba(0x000000, 0.16);
        ctx.lineWidth = 2;
        ctx.beginPath();
        const mx = x + bw * 0.35, my = y + bh * 0.55;
        ctx.moveTo(mx, my);
        ctx.lineTo(mx + 18, my + 8);
        ctx.stroke();
      }
    }
  };

  /* ---------------------------------------------------------- sand / floor */
  AUTHORS.sand = function (ctx, w, h, rng) {
    // bright warm gold; deliberately little dark mottling so the beach stays sunny
    const base = 0xf2d08a;
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, hex(0xffe7b0));
    g.addColorStop(0.55, hex(base));
    g.addColorStop(1, hex(0xdcb470));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    // soft warm ripple bands
    ctx.strokeStyle = rgba(0xc79a52, 0.09);
    ctx.lineWidth = 4;
    for (let i = 0; i < 5; i++) {
      const y = (i + 0.5) * (h / 5);
      ctx.beginPath();
      for (let x = 0; x <= w; x += 8) ctx.lineTo(x, y + Math.sin((x / w) * PI2 * 2 + i) * 4);
      ctx.stroke();
    }

    tile(ctx, w, h, function () {
      for (let i = 0; i < 160; i++) {
        const x = rng() * w, y = rng() * h;
        const lite = rng() < 0.6;
        ctx.fillStyle = lite ? rgba(0xfff5d2, 0.22) : rgba(0xa87838, 0.14);
        const s = rng() < 0.85 ? 2 : 3;
        ctx.fillRect(x, y, s, s);
      }
      for (let i = 0; i < 12; i++) {
        const x = rng() * w, y = rng() * h, r = 2 + rng() * 4;
        ctx.fillStyle = rgba(0xb98844, 0.3);
        ctx.beginPath();
        ctx.ellipse(x, y, r, r * 0.7, rng() * PI2, 0, PI2);
        ctx.fill();
        ctx.fillStyle = rgba(0xfff2c8, 0.35);
        ctx.fillRect(x - r * 0.4, y - r * 0.4, 2, 2);
      }
    });
  };

  AUTHORS.beach = function (ctx, w, h, rng) {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, hex(0xfff0c8));
    g.addColorStop(0.55, hex(0xf8dc9e));
    g.addColorStop(1, hex(0xecc984));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    tile(ctx, w, h, function () {
      for (let i = 0; i < 140; i++) {
        const x = rng() * w, y = rng() * h;
        ctx.fillStyle = rng() < 0.6 ? rgba(0xfff8dd, 0.3) : rgba(0xc79a58, 0.14);
        ctx.fillRect(x, y, 2, 2);
      }
    });
    for (let i = 0; i < 5; i++) {
      const x = rng() * w, y = rng() * h;
      ctx.strokeStyle = rgba(0xfff6e4, 0.75);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, 5, Math.PI * 0.15, Math.PI * 0.85);
      ctx.stroke();
    }
  };

  /* wet dark sand for the waterline band */
  AUTHORS.sandWet = function (ctx, w, h, rng) {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, hex(0xb98a52));
    g.addColorStop(0.5, hex(0x9c7444));
    g.addColorStop(1, hex(0x7a5834));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 9; i++) {
      ctx.strokeStyle = rgba(0xe8c890, 0.1 + rng() * 0.08);
      ctx.lineWidth = 1 + rng() * 2;
      const y = rng() * h;
      ctx.beginPath();
      for (let x = 0; x <= w; x += 12) ctx.lineTo(x, y + Math.sin(x * 0.05 + i) * 3);
      ctx.stroke();
    }
    tile(ctx, w, h, function () {
      for (let i = 0; i < 130; i++) {
        const x = rng() * w, y = rng() * h;
        ctx.fillStyle = rng() < 0.45 ? rgba(0x5f4224, 0.2) : rgba(0xd8b47c, 0.12);
        ctx.fillRect(x, y, 2, 2);
      }
      for (let i = 0; i < 10; i++) {
        const x = rng() * w, y = rng() * h, r = 2 + rng() * 3;
        ctx.fillStyle = rgba(0x6b4a28, 0.28);
        ctx.beginPath();
        ctx.ellipse(x, y, r, r * 0.7, rng() * PI2, 0, PI2);
        ctx.fill();
      }
    });
  };

  AUTHORS.floor = function (ctx, w, h, rng) {
    const sand = PAL.sand != null ? PAL.sand : 0xd9c07a;
    const stone = PAL.stoneDark != null ? PAL.stoneDark : 0x4a5866;
    const base = mix(sand, stone, 0.34);
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, hex(lighten(base, 0.2)));
    g.addColorStop(0.45, hex(base));
    g.addColorStop(1, hex(darken(base, 0.34)));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    // dark rock plates with light rims
    tile(ctx, w, h, function () {
      for (let i = 0; i < 7; i++) {
        const cx = rng() * w, cy = rng() * h;
        const rx = 14 + rng() * 26, ry = 8 + rng() * 16, rot = rng() * PI2;
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(rot);
        ctx.fillStyle = rgba(0x3c4a55, 0.55);
        ctx.beginPath();
        ctx.ellipse(0, 0, rx, ry, 0, 0, PI2);
        ctx.fill();
        ctx.strokeStyle = rgba(0xd9c07a, 0.22);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(0, 0, rx, ry, 0, Math.PI * 0.9, Math.PI * 1.6);
        ctx.stroke();
        ctx.restore();
      }
      for (let i = 0; i < 120; i++) {
        const x = rng() * w, y = rng() * h;
        ctx.fillStyle = rng() < 0.5 ? rgba(0xffffff, 0.1) : rgba(0x2a2418, 0.16);
        ctx.fillRect(x, y, 2, 2);
      }
      for (let i = 0; i < 8; i++) {
        const x = rng() * w, y = rng() * h;
        ctx.fillStyle = rgba(0x7fb0a8, 0.25);
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, PI2);
        ctx.fill();
      }
    });
  };

  /* -------------------------------------------------------------- coral */
  AUTHORS.coral = function (ctx, w, h, rng) {
    const coral = PAL.coral != null ? PAL.coral : 0xe06a6a;
    const pink = PAL.coralPink != null ? PAL.coralPink : 0xf28ba0;
    const orange = PAL.coralOrange != null ? PAL.coralOrange : 0xf5a24a;
    const purple = PAL.coralPurple != null ? PAL.coralPurple : 0x9a6ad1;
    const cols = [coral, pink, orange, purple];
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, hex(lighten(coral, 0.1)));
    g.addColorStop(1, hex(darken(coral, 0.35)));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    tile(ctx, w, h, function () {
      for (let i = 0; i < 110; i++) {
        const x = rng() * w, y = rng() * h, r = 2.5 + rng() * 8;
        const c = cols[(i + Math.floor(rng() * 4)) % 4];
        dot(ctx, x, y, r, rgba(darken(c, 0.35), 0.85));
        dot(ctx, x, y, r * 0.8, rgba(c, 0.95));
        dot(ctx, x - r * 0.22, y - r * 0.25, r * 0.32, rgba(lighten(c, 0.45), 0.85));
      }
      for (let i = 0; i < 36; i++) {
        dot(ctx, rng() * w, rng() * h, 1 + rng() * 2, rgba(lighten(pink, 0.3), 0.35));
      }
      // organic connective veins
      ctx.strokeStyle = rgba(darken(coral, 0.45), 0.25);
      ctx.lineWidth = 2;
      for (let i = 0; i < 8; i++) {
        let x = rng() * w, y = rng() * h;
        ctx.beginPath();
        ctx.moveTo(x, y);
        for (let s = 0; s < 4; s++) {
          x += (rng() - 0.5) * 40;
          y += (rng() - 0.5) * 40;
          ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
    });
  };

  /* --------------------------------------------------------------- pipe */
  AUTHORS.pipe = function (ctx, w, h, rng) {
    const pipe = PAL.pipe != null ? PAL.pipe : 0x2fa03a;
    const g = ctx.createLinearGradient(0, 0, w, 0);
    g.addColorStop(0, hex(darken(pipe, 0.6)));
    g.addColorStop(0.1, hex(darken(pipe, 0.3)));
    g.addColorStop(0.28, hex(lighten(pipe, 0.38)));
    g.addColorStop(0.4, hex(lighten(pipe, 0.16)));
    g.addColorStop(0.55, hex(pipe));
    g.addColorStop(0.82, hex(darken(pipe, 0.22)));
    g.addColorStop(1, hex(darken(pipe, 0.55)));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    // metal segment seams
    for (let k = 1; k <= 3; k++) {
      const y = (h * k) / 4;
      ctx.fillStyle = rgba(0x000000, 0.2);
      ctx.fillRect(0, y - 2, w, 3);
      ctx.fillStyle = rgba(0xffffff, 0.14);
      ctx.fillRect(0, y + 1, w, 2);
      // rivets
      for (let i = 0; i < 4; i++) {
        const x = (i + 0.5) * (w / 4);
        ctx.fillStyle = rgba(darken(pipe, 0.4), 0.7);
        ctx.beginPath();
        ctx.arc(x, y + (k % 2 ? 7 : -9), 2.2, 0, PI2);
        ctx.fill();
        ctx.fillStyle = rgba(0xffffff, 0.25);
        ctx.fillRect(x - 1, y + (k % 2 ? 6 : -10), 2, 1);
      }
    }
    // grime speckles
    for (let i = 0; i < 60; i++) {
      ctx.fillStyle = rgba(rng() < 0.5 ? 0xffffff : 0x000000, 0.05);
      ctx.fillRect(rng() * w, rng() * h, 2, 2);
    }
  };

  /* ------------------------------------------------------------ itembox */
  AUTHORS.itembox = function (ctx, w, h) {
    const gold = PAL.gold != null ? PAL.gold : 0xffcf3d;
    const goldDark = PAL.goldDark != null ? PAL.goldDark : 0xc08a12;
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, hex(lighten(gold, 0.35)));
    g.addColorStop(0.5, hex(gold));
    g.addColorStop(1, hex(darken(gold, 0.18)));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    // border
    ctx.strokeStyle = hex(goldDark);
    ctx.lineWidth = 9;
    ctx.strokeRect(4.5, 4.5, w - 9, h - 9);
    ctx.strokeStyle = rgba(0xffffff, 0.28);
    ctx.lineWidth = 3;
    ctx.strokeRect(10, 10, w - 20, h - 20);
    // inner bevel
    ctx.fillStyle = rgba(0xffffff, 0.16);
    ctx.fillRect(14, 14, w - 28, 4);
    ctx.fillStyle = rgba(0x7a4a00, 0.22);
    ctx.fillRect(14, h - 18, w - 28, 4);
    // corner studs
    const studs = [[22, 22], [w - 22, 22], [22, h - 22], [w - 22, h - 22]];
    for (let i = 0; i < studs.length; i++) {
      dot(ctx, studs[i][0], studs[i][1], 7, rgba(goldDark, 0.9));
      dot(ctx, studs[i][0] - 1, studs[i][1] - 1, 4, rgba(lighten(gold, 0.5), 0.9));
    }
    // big question mark
    ctx.font = 'bold ' + Math.round(h * 0.56) + 'px Arial, Helvetica, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 8;
    ctx.strokeStyle = hex(goldDark);
    ctx.strokeText('?', w / 2, h / 2 + h * 0.04);
    ctx.fillStyle = '#fffdf3';
    ctx.fillText('?', w / 2, h / 2 + h * 0.04);
  };

  AUTHORS.used = function (ctx, w, h, rng) {
    const base = 0x8a6a44;
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, hex(lighten(base, 0.2)));
    g.addColorStop(1, hex(darken(base, 0.32)));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = hex(darken(base, 0.5));
    ctx.lineWidth = 8;
    ctx.strokeRect(4, 4, w - 8, h - 8);
    ctx.fillStyle = rgba(0x000000, 0.18);
    ctx.fillRect(12, 14, w - 24, 5);
    const studs = [[24, 24], [w - 24, 24], [24, h - 24], [w - 24, h - 24]];
    for (let i = 0; i < studs.length; i++) {
      dot(ctx, studs[i][0], studs[i][1], 6, rgba(darken(base, 0.55), 0.85));
      dot(ctx, studs[i][0] - 1, studs[i][1] - 1, 3, rgba(0xffffff, 0.25));
    }
    for (let i = 0; i < 30; i++) {
      ctx.fillStyle = rgba(rng() < 0.5 ? 0xffffff : 0x000000, 0.06);
      ctx.fillRect(rng() * w, rng() * h, 2, 2);
    }
  };

  /* --------------------------------------------------------------- wood */
  AUTHORS.wood = function (ctx, w, h, rng) {
    const base = 0x8a5a33;
    const g = ctx.createLinearGradient(0, 0, w, 0);
    g.addColorStop(0, hex(darken(base, 0.28)));
    g.addColorStop(0.25, hex(lighten(base, 0.12)));
    g.addColorStop(0.7, hex(base));
    g.addColorStop(1, hex(darken(base, 0.35)));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    // grain
    for (let i = 0; i < 26; i++) {
      const x = rng() * w;
      ctx.strokeStyle = rgba(rng() < 0.5 ? 0x2a1608 : 0xd8a86a, 0.16 + rng() * 0.12);
      ctx.lineWidth = 1 + rng() * 1.6;
      ctx.beginPath();
      for (let y = 0; y <= h; y += 12) ctx.lineTo(x + Math.sin(y * 0.06 + i) * 5, y);
      ctx.stroke();
    }
    // plank seams
    for (let k = 1; k <= 2; k++) {
      const y = (h * k) / 3;
      ctx.fillStyle = rgba(0x1c0e04, 0.55);
      ctx.fillRect(0, y - 2, w, 4);
      ctx.fillStyle = rgba(0xffffff, 0.1);
      ctx.fillRect(0, y + 2, w, 2);
    }
    // knots
    for (let i = 0; i < 3; i++) {
      const x = rng() * w, y = rng() * h;
      ctx.strokeStyle = rgba(0x2a1608, 0.5);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(x, y, 7, 4, 0.4, 0, PI2);
      ctx.stroke();
    }
  };

  /* ------------------------------------------------------- water / sky */
  AUTHORS.waterGradient = function (ctx, w, h, rng) {
    const top = PAL.waterTop != null ? PAL.waterTop : 0x6fd3e8;
    const light = PAL.waterLight != null ? PAL.waterLight : 0x1d7ba8;
    const mid = PAL.waterMid != null ? PAL.waterMid : 0x0f4f7d;
    const deep = PAL.waterDeep != null ? PAL.waterDeep : 0x0a2e4f;
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, hex(lighten(top, 0.08)));
    g.addColorStop(0.16, hex(lighten(light, 0.12)));
    g.addColorStop(0.42, hex(light));
    g.addColorStop(0.66, hex(mid));
    g.addColorStop(0.86, hex(deep));
    g.addColorStop(1, hex(darken(deep, 0.4)));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    // light bloom below the surface
    const rg = ctx.createRadialGradient(w * 0.5, h * 0.04, 10, w * 0.5, h * 0.04, w * 0.85);
    rg.addColorStop(0, rgba(lighten(top, 0.4), 0.35));
    rg.addColorStop(0.5, rgba(light, 0.1));
    rg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = rg;
    ctx.fillRect(0, 0, w, h);
    // faint vertical light shafts
    for (let i = 0; i < 12; i++) {
      const x = rng() * w;
      const sg = ctx.createLinearGradient(x, 0, x + 30, h * 0.7);
      sg.addColorStop(0, rgba(lighten(top, 0.3), 0.09));
      sg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = sg;
      ctx.fillRect(x, 0, 26 + rng() * 34, h * 0.75);
    }
  };

  AUTHORS.bgGradient = function (ctx, w, h) {
    const top = PAL.waterTop != null ? PAL.waterTop : 0x6fd3e8;
    const light = PAL.waterLight != null ? PAL.waterLight : 0x1d7ba8;
    const mid = PAL.waterMid != null ? PAL.waterMid : 0x0f4f7d;
    const deep = PAL.waterDeep != null ? PAL.waterDeep : 0x0a2e4f;
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, hex(light));
    g.addColorStop(0.35, hex(mid));
    g.addColorStop(0.72, hex(deep));
    g.addColorStop(1, hex(darken(deep, 0.55)));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    const rg = ctx.createRadialGradient(w * 0.5, h * 0.12, 20, w * 0.5, h * 0.12, w * 1.1);
    rg.addColorStop(0, rgba(lighten(top, 0.25), 0.22));
    rg.addColorStop(0.55, rgba(mid, 0.05));
    rg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = rg;
    ctx.fillRect(0, 0, w, h);
  };

  AUTHORS.tunnelGradient = function (ctx, w, h) {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, hex(0x071d2e));
    g.addColorStop(0.45, hex(0x0a2b40));
    g.addColorStop(1, hex(0x020a12));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    const rg = ctx.createRadialGradient(w * 0.5, h * 0.55, 8, w * 0.5, h * 0.55, w * 0.75);
    rg.addColorStop(0, rgba(0x1d6a8a, 0.3));
    rg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = rg;
    ctx.fillRect(0, 0, w, h);
    // dark side vignette so the corridor feels enclosed
    const lg = ctx.createLinearGradient(0, 0, w, 0);
    lg.addColorStop(0, 'rgba(0,0,0,0.4)');
    lg.addColorStop(0.25, 'rgba(0,0,0,0)');
    lg.addColorStop(0.75, 'rgba(0,0,0,0)');
    lg.addColorStop(1, 'rgba(0,0,0,0.4)');
    ctx.fillStyle = lg;
    ctx.fillRect(0, 0, w, h);
  };

  AUTHORS.caveGradient = function (ctx, w, h) {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, hex(0x0d1d2a));
    g.addColorStop(0.6, hex(0x081521));
    g.addColorStop(1, hex(0x03080d));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    const rg = ctx.createRadialGradient(w * 0.5, h * 0.42, 10, w * 0.5, h * 0.42, w * 0.7);
    rg.addColorStop(0, rgba(0xcf9a3a, 0.16));
    rg.addColorStop(0.55, 'rgba(0,0,0,0)');
    ctx.fillStyle = rg;
    ctx.fillRect(0, 0, w, h);
  };

  /* Beach sky. The texture v=0 (canvas bottom) is the HORIZON and v=1 the
     zenith, so the warm band sits right above the beach and the upper sky
     cools to pale blue. The goal sky plane only shows the bottom ~25%. */
  AUTHORS.skyWarm = function (ctx, w, h, rng) {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, hex(0x9fd4e6)); // canvas top = zenith
    g.addColorStop(0.24, hex(0xbfe2ea));
    g.addColorStop(0.5, hex(0xffe2b2));
    g.addColorStop(0.72, hex(0xffc98c));
    g.addColorStop(0.88, hex(0xffb277)); // horizon warmth
    g.addColorStop(1, hex(0xffa468));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    // low sun right above the horizon
    const sx = w * 0.64, sy = h * 0.8;
    const sg = ctx.createRadialGradient(sx, sy, 4, sx, sy, w * 0.4);
    sg.addColorStop(0, 'rgba(255,252,235,0.96)');
    sg.addColorStop(0.16, 'rgba(255,240,190,0.8)');
    sg.addColorStop(0.45, 'rgba(255,214,140,0.26)');
    sg.addColorStop(1, 'rgba(255,200,120,0)');
    ctx.fillStyle = sg;
    ctx.fillRect(0, 0, w, h);
    // soft warm cloud bands in the cooler upper sky
    for (let i = 0; i < 9; i++) {
      const y = h * (0.08 + rng() * 0.42);
      const x = rng() * w;
      ctx.fillStyle = rgba(0xfff4e0, 0.1 + rng() * 0.14);
      ctx.beginPath();
      ctx.ellipse(x, y, 26 + rng() * 62, 5 + rng() * 8, 0, 0, PI2);
      ctx.fill();
    }
  };

  /* One-sided dark dissolve used to hide hard tunnel-mouth rectangles.
     Opaque at u=0, transparent at u=1 (flip option reverses it). */
  AUTHORS.edgeFade = function (ctx, w, h, rng, o) {
    const g = ctx.createLinearGradient(0, 0, w, 0);
    const c0 = 'rgba(6,20,32,0.94)';
    const c1 = 'rgba(7,24,38,0.55)';
    const c2 = 'rgba(8,28,44,0)';
    if (o && o.flip) {
      g.addColorStop(0, c2);
      g.addColorStop(0.55, c1);
      g.addColorStop(1, c0);
    } else {
      g.addColorStop(0, c0);
      g.addColorStop(0.45, c1);
      g.addColorStop(1, c2);
    }
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    // a few darker ragged blobs at the opaque end so the dissolve is organic
    for (let i = 0; i < 14; i++) {
      const edge = (o && o.flip) ? w : 0;
      const x = edge + ((o && o.flip) ? -1 : 1) * rng() * w * 0.5;
      const y = rng() * h;
      const r = 10 + rng() * 34;
      const rg = ctx.createRadialGradient(x, y, 0, x, y, r);
      rg.addColorStop(0, 'rgba(5,17,28,0.22)');
      rg.addColorStop(1, 'rgba(5,17,28,0)');
      ctx.fillStyle = rg;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, PI2);
      ctx.fill();
    }
  };

  AUTHORS.airGradient = function (ctx, w, h, rng) {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, hex(0xcfeef8));   // canvas top = high sky
    g.addColorStop(0.35, hex(0xe2f4f6));
    g.addColorStop(0.62, hex(0xf5efd2));
    g.addColorStop(0.84, hex(0xffe6b4)); // warm haze above the waterline
    g.addColorStop(1, hex(0xffd79a));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 7; i++) {
      const y = rng() * h;
      const x = rng() * w;
      ctx.fillStyle = rgba(0xffffff, 0.12);
      ctx.beginPath();
      ctx.ellipse(x, y, 30 + rng() * 50, 6 + rng() * 8, 0, 0, PI2);
      ctx.fill();
    }
  };

  /* Very soft, low-contrast caustics: broad calm light cells, no bright claws.
     Kept mostly-dark so it works as an additive light layer. */
  AUTHORS.caustic = function (ctx, w, h, rng) {
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, w, h);
    const caustic = PAL.caustic != null ? PAL.caustic : 0x9fe8ff;
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    tile(ctx, w, h, function () {
      // broad, slow light webs
      for (let i = 0; i < 9; i++) {
        const x = rng() * w, y = rng() * h;
        const a = 0.04 + rng() * 0.09;
        ctx.strokeStyle = rgba(caustic, a);
        ctx.lineWidth = 1.2 + rng() * 1.6;
        ctx.shadowColor = rgba(caustic, 0.3);
        ctx.shadowBlur = 9 + rng() * 9;
        ctx.beginPath();
        ctx.moveTo(x, y);
        let px = x, py = y;
        for (let s = 0; s < 3; s++) {
          ctx.bezierCurveTo(
            px + (rng() - 0.5) * 64, py + (rng() - 0.5) * 64,
            px + (rng() - 0.5) * 64, py + (rng() - 0.5) * 64,
            px + (rng() - 0.5) * 44, py + (rng() - 0.5) * 44
          );
          px += (rng() - 0.5) * 28;
          py += (rng() - 0.5) * 28;
        }
        ctx.stroke();
      }
      // wide soft light pools between the webs
      for (let i = 0; i < 9; i++) {
        const x = rng() * w, y = rng() * h, r = 10 + rng() * 22;
        const rg = ctx.createRadialGradient(x, y, 0, x, y, r);
        rg.addColorStop(0, rgba(caustic, 0.07));
        rg.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = rg;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, PI2);
        ctx.fill();
      }
    });
    ctx.shadowBlur = 0;
    ctx.globalCompositeOperation = 'source-over';
  };

  /* -------------------------------------------------------- kelp / vine */
  AUTHORS.kelp = function (ctx, w, h, rng) {
    const kelp = PAL.kelp != null ? PAL.kelp : 0x2f8f4e;
    const kelpL = PAL.kelpLight != null ? PAL.kelpLight : 0x57c266;
    const cx = w * 0.5;
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, hex(lighten(kelpL, 0.18)));
    g.addColorStop(0.45, hex(kelp));
    g.addColorStop(1, hex(darken(kelp, 0.32)));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(cx - w * 0.12, h);
    ctx.bezierCurveTo(cx - w * 0.3, h * 0.78, cx - w * 0.22, h * 0.56, cx - w * 0.1, h * 0.34);
    ctx.bezierCurveTo(cx - w * 0.03, h * 0.18, cx + w * 0.02, h * 0.1, cx + w * 0.01, h * 0.01);
    ctx.bezierCurveTo(cx + w * 0.12, h * 0.12, cx + w * 0.14, h * 0.3, cx + w * 0.13, h * 0.42);
    ctx.bezierCurveTo(cx + w * 0.3, h * 0.6, cx + w * 0.3, h * 0.82, cx + w * 0.14, h);
    ctx.closePath();
    ctx.fill();
    // vein
    ctx.strokeStyle = rgba(lighten(kelpL, 0.35), 0.6);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx, h * 0.98);
    ctx.bezierCurveTo(cx - w * 0.06, h * 0.72, cx + w * 0.02, h * 0.4, cx, h * 0.06);
    ctx.stroke();
    // edge rim
    ctx.strokeStyle = rgba(lighten(kelpL, 0.25), 0.35);
    ctx.lineWidth = 1.6;
    ctx.stroke();
    // side leaves near the base
    for (let i = 0; i < 3; i++) {
      const y = h * (0.72 + i * 0.09);
      const side = i % 2 ? 1 : -1;
      ctx.fillStyle = rgba(kelp, 0.9);
      ctx.beginPath();
      ctx.moveTo(cx + side * w * 0.13, y);
      ctx.quadraticCurveTo(cx + side * w * 0.34, y - h * 0.05, cx + side * w * 0.3, y - h * 0.12);
      ctx.quadraticCurveTo(cx + side * w * 0.16, y - h * 0.05, cx + side * w * 0.13, y);
      ctx.fill();
    }
  };

  AUTHORS.vine = function (ctx, w, h, rng) {
    const kelp = PAL.kelp != null ? PAL.kelp : 0x2f8f4e;
    const kelpL = PAL.kelpLight != null ? PAL.kelpLight : 0x57c266;
    const cx = w * 0.5;
    ctx.strokeStyle = rgba(darken(kelp, 0.25), 0.95);
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx, 0);
    for (let y = 0; y <= h; y += 16) ctx.lineTo(cx + Math.sin(y * 0.045) * w * 0.16, y);
    ctx.stroke();
    ctx.strokeStyle = rgba(lighten(kelpL, 0.2), 0.4);
    ctx.lineWidth = 2;
    ctx.stroke();
    // leaves
    for (let i = 0; i < 9; i++) {
      const y = h * (0.06 + i * 0.1);
      const side = i % 2 ? 1 : -1;
      const x = cx + Math.sin(y * 0.045) * w * 0.16;
      ctx.fillStyle = rgba(i % 3 ? kelp : lighten(kelp, 0.18), 0.92);
      ctx.beginPath();
      ctx.ellipse(x + side * w * 0.19, y, w * 0.17, h * 0.035, side * 0.5, 0, PI2);
      ctx.fill();
      ctx.strokeStyle = rgba(darken(kelp, 0.35), 0.4);
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  };

  /* ------------------------------------------------------- coin / sprites */
  AUTHORS.coin = function (ctx, w, h) {
    const gold = PAL.gold != null ? PAL.gold : 0xffcf3d;
    const goldDark = PAL.goldDark != null ? PAL.goldDark : 0xc08a12;
    const cx = w / 2, cy = h / 2, r = w * 0.4;
    const rg = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.35, 2, cx, cy, r);
    rg.addColorStop(0, hex(lighten(gold, 0.65)));
    rg.addColorStop(0.45, hex(gold));
    rg.addColorStop(1, hex(darken(gold, 0.25)));
    ctx.fillStyle = rg;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, PI2);
    ctx.fill();
    ctx.strokeStyle = hex(goldDark);
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(cx, cy, r - 2, 0, PI2);
    ctx.stroke();
    ctx.strokeStyle = rgba(0xffffff, 0.7);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.62, Math.PI * 0.95, Math.PI * 1.65);
    ctx.stroke();
    ctx.fillStyle = rgba(0xffffff, 0.85);
    ctx.beginPath();
    ctx.ellipse(cx - r * 0.34, cy - r * 0.42, r * 0.16, r * 0.09, -0.7, 0, PI2);
    ctx.fill();
    ctx.strokeStyle = rgba(darken(gold, 0.4), 0.7);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy - r * 0.35);
    ctx.lineTo(cx, cy + r * 0.35);
    ctx.stroke();
  };

  AUTHORS.bubble = function (ctx, w, h) {
    const cx = w / 2, cy = h / 2, r = w * 0.34;
    const rg = ctx.createRadialGradient(cx, cy, r * 0.2, cx, cy, r);
    rg.addColorStop(0, 'rgba(220,250,255,0.10)');
    rg.addColorStop(0.7, 'rgba(190,240,255,0.16)');
    rg.addColorStop(1, 'rgba(190,240,255,0.02)');
    ctx.fillStyle = rg;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, PI2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(235,252,255,0.85)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, PI2);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(235,252,255,0.35)';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.86, Math.PI * 0.9, Math.PI * 1.5);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.beginPath();
    ctx.ellipse(cx - r * 0.38, cy - r * 0.42, r * 0.18, r * 0.11, -0.6, 0, PI2);
    ctx.fill();
  };

  AUTHORS.spark = function (ctx, w, h) {
    const cx = w / 2, cy = h / 2, r = w * 0.47;
    const rg = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    rg.addColorStop(0, 'rgba(255,255,255,0.95)');
    rg.addColorStop(0.25, 'rgba(255,240,180,0.55)');
    rg.addColorStop(1, 'rgba(255,220,120,0)');
    ctx.fillStyle = rg;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, PI2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,250,0.95)';
    ctx.beginPath();
    for (let i = 0; i < 4; i++) {
      const a = (i * PI2) / 4;
      const bx = Math.cos(a), by = Math.sin(a);
      const px = -by, py = bx;
      ctx.moveTo(cx + bx * r * 0.95, cy + by * r * 0.95);
      ctx.lineTo(cx + px * r * 0.11, cy + py * r * 0.11);
      ctx.lineTo(cx - bx * r * 0.1, cy - by * r * 0.1);
      ctx.lineTo(cx - px * r * 0.11, cy - py * r * 0.11);
      ctx.closePath();
    }
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,1)';
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.12, 0, PI2);
    ctx.fill();
  };

  AUTHORS.glow = function (ctx, w, h) {
    ctx.fillStyle = 'rgba(235,250,255,0.02)';
    ctx.fillRect(0, 0, w, h);
    const cx = w / 2, cy = h / 2;
    const rg = ctx.createRadialGradient(cx, cy, 0, cx, cy, w * 0.5);
    rg.addColorStop(0, 'rgba(255,255,255,0.9)');
    rg.addColorStop(0.25, 'rgba(220,250,255,0.45)');
    rg.addColorStop(0.6, 'rgba(160,220,255,0.14)');
    rg.addColorStop(1, 'rgba(120,200,255,0)');
    ctx.fillStyle = rg;
    ctx.fillRect(0, 0, w, h);
  };

  AUTHORS.surface = function (ctx, w, h, rng) {
    // wavy water-line streaks + soft foam band.
    // The faint base fill keeps every texel slightly non-transparent: filtering
    // then never mixes a white streak with transparent BLACK, which is what made
    // dark indigo dashes once the material moved to normal blending.
    ctx.fillStyle = rgba(0xd6faff, 0.05);
    ctx.fillRect(0, 0, w, h);
    // The top edge fades in so the quad never shows a hard 1px line.
    for (let i = 0; i < 6; i++) {
      const y = 10 + i * (h / 7.5);
      ctx.strokeStyle = rgba(0xe8ffff, 0.4 - i * 0.05);
      ctx.lineWidth = 2 + (i === 0 ? 1.5 : 0);
      ctx.beginPath();
      for (let x = 0; x <= w; x += 4) {
        ctx.lineTo(x, y + Math.sin((x / w) * PI2 * 2 + i * 1.7) * 3.2);
      }
      ctx.stroke();
    }
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, 'rgba(235,255,255,0.1)');
    g.addColorStop(0.16, 'rgba(240,255,255,0.6)');
    g.addColorStop(0.5, 'rgba(210,250,255,0.22)');
    g.addColorStop(1, 'rgba(200,250,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 9; i++) {
      const x = rng() * w, y = 6 + rng() * 10, r = 2 + rng() * 5;
      ctx.fillStyle = rgba(0xffffff, 0.45);
      ctx.beginPath();
      ctx.arc(x, y, r, 0, PI2);
      ctx.fill();
    }
  };

  AUTHORS.godray = function (ctx, w, h, rng) {
    const caustic = PAL.caustic != null ? PAL.caustic : 0x9fe8ff;
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, rgba(caustic, 0));
    g.addColorStop(0.1, rgba(caustic, 0.4));
    g.addColorStop(0.45, rgba(caustic, 0.16));
    g.addColorStop(1, rgba(caustic, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(w * 0.3, 0);
    ctx.quadraticCurveTo(w * 0.12, h * 0.55, w * 0.06, h);
    ctx.lineTo(w * 0.94, h);
    ctx.quadraticCurveTo(w * 0.8, h * 0.5, w * 0.7, 0);
    ctx.closePath();
    ctx.fill();
    // soften horizontally
    ctx.globalCompositeOperation = 'destination-in';
    const hg = ctx.createLinearGradient(0, 0, w, 0);
    hg.addColorStop(0, 'rgba(255,255,255,0)');
    hg.addColorStop(0.35, 'rgba(255,255,255,0.85)');
    hg.addColorStop(0.5, 'rgba(255,255,255,1)');
    hg.addColorStop(0.65, 'rgba(255,255,255,0.85)');
    hg.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = hg;
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'source-over';
    // faint base alpha so filtered edges stay light rather than going black
    ctx.fillStyle = 'rgba(180,235,255,0.02)';
    ctx.fillRect(0, 0, w, h);
  };

  AUTHORS.vignette = function (ctx, w, h, rng, o) {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    const a0 = 0.78, a1 = 0;
    if (o && o.flip) {
      g.addColorStop(0, 'rgba(3,14,24,' + a1 + ')');
      g.addColorStop(1, 'rgba(3,14,24,' + a0 + ')');
    } else {
      g.addColorStop(0, 'rgba(3,14,24,' + a0 + ')');
      g.addColorStop(1, 'rgba(3,14,24,' + a1 + ')');
    }
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  };

  /* ==================================================== texture factory */
  function makeTexture(name, o) {
    o = o || {};
    const dims = TEX_SIZE[name] || TEX_SIZE.missing || [128, 128];
    const w = (o.w | 0) || dims[0];
    const h = (o.h | 0) || dims[1];
    let canvas;
    if (typeof document !== 'undefined' && document.createElement) {
      canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
    } else {
      return null;
    }
    const ctx = canvas.getContext('2d');
    const author = AUTHORS[name] || AUTHORS.missing;
    author(ctx, w, h, rngFor(name, o.seed || 0), o);

    const smooth = o.smooth != null ? !!o.smooth : !!SMOOTH[name];
    const clamp = o.clamp != null ? !!o.clamp : !!CLAMP[name];
    // big gradient backdrops tile horizontally with world-anchored U, but must
    // clamp vertically so the top/bottom of the gradient is never repeated
    const hRepeat = o.hrepeat != null ? !!o.hrepeat : !!HREPEAT[name];
    // magNearest/noMip: for sprite-style textures whose transparent texels are
    // black, filtering mixes white foam with black and makes dark fringes.
    const magNearest = o.magNearest != null ? !!o.magNearest : !smooth;
    const noMip = o.noMip != null ? !!o.noMip : false;
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = hRepeat || !clamp ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
    tex.wrapT = clamp ? THREE.ClampToEdgeWrapping : THREE.RepeatWrapping;
    tex.generateMipmaps = !noMip;
    tex.magFilter = magNearest ? THREE.NearestFilter : THREE.LinearFilter;
    if (noMip) tex.minFilter = smooth ? THREE.LinearFilter : THREE.NearestFilter;
    else tex.minFilter = smooth ? THREE.LinearMipmapLinearFilter : THREE.NearestMipmapLinearFilter;
    tex.anisotropy = noMip ? 1 : smooth ? 4 : 2;
    if (THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
    return tex;
  }

  function stableKey(o) {
    if (!o) return '';
    const keys = Object.keys(o).sort();
    let s = '';
    for (let i = 0; i < keys.length; i++) {
      const k = keys[i], v = o[k];
      if (v === undefined || v === null) continue;
      s += k + '=' + (v && typeof v === 'object' ? JSON.stringify(v) : v) + ';';
    }
    return s;
  }

  const texCache = new Map();
  const matCache = new Map();

  const Tex = {
    /** cached THREE.Texture for a named author */
    get: function (name, opts) {
      const key = 'tex:' + name + '|' + stableKey(opts);
      let t = texCache.get(key);
      if (t) return t;
      t = makeTexture(name, opts);
      if (t) texCache.set(key, t);
      return t;
    },

    /** cached material; opts.lit=false -> MeshBasicMaterial */
    mat: function (name, opts) {
      const o = opts || {};
      const key = 'mat:' + name + '|' + stableKey(o);
      let m = matCache.get(key);
      if (m) return m;
      const params = {
        map: name ? this.get(name, o.tex) : null,
        color: o.color != null ? o.color : 0xffffff,
        transparent: !!o.transparent,
        opacity: o.opacity != null ? o.opacity : 1,
        side: o.side != null ? o.side : THREE.FrontSide,
        depthWrite: o.depthWrite !== false,
        depthTest: o.depthTest !== false,
        vertexColors: !!o.vertexColors,
        alphaTest: o.alphaTest || 0,
        blending: o.blending != null ? o.blending : THREE.NormalBlending,
      };
      if (o.lit === false) {
        m = new THREE.MeshBasicMaterial(params);
      } else {
        params.emissive = o.emissive != null ? o.emissive : 0x000000;
        params.emissiveIntensity = o.emissiveIntensity != null ? o.emissiveIntensity : 1;
        m = new THREE.MeshLambertMaterial(params);
      }
      m.name = 'tex:' + name;
      matCache.set(key, m);
      return m;
    },

    /** cached plain-colour Lambert (or Basic) material, no map */
    colorMat: function (color, opts) {
      const o = opts || {};
      const key = 'color:' + (color >>> 0) + '|' + stableKey(o);
      let m = matCache.get(key);
      if (m) return m;
      const params = {
        color: color >>> 0,
        transparent: !!o.transparent,
        opacity: o.opacity != null ? o.opacity : 1,
        side: o.side != null ? o.side : THREE.FrontSide,
        depthWrite: o.depthWrite !== false,
        depthTest: o.depthTest !== false,
        vertexColors: !!o.vertexColors,
        blending: o.blending != null ? o.blending : THREE.NormalBlending,
      };
      if (o.lit === false) {
        m = new THREE.MeshBasicMaterial(params);
      } else {
        params.emissive = o.emissive != null ? o.emissive : 0x000000;
        params.emissiveIntensity = o.emissiveIntensity != null ? o.emissiveIntensity : 1;
        m = new THREE.MeshLambertMaterial(params);
      }
      m.name = 'color:' + hex(color);
      matCache.set(key, m);
      return m;
    },

    /** soft round sprite texture (for particles / glints) */
    sprite: function (name, opts) {
      const o = opts || {};
      const key = 'spr:' + name + '|' + stableKey(o);
      let t = texCache.get(key);
      if (t) return t;
      const src = this.get(name, o);
      if (!src) return null;
      t = src.clone();
      t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
      t.needsUpdate = true;
      texCache.set(key, t);
      return t;
    },

    has: function (name) { return !!AUTHORS[name]; },

    /** dispose everything this factory owns (a fresh get() will re-bake) */
    clear: function () {
      texCache.forEach(function (t) { if (t && t.dispose) t.dispose(); });
      texCache.clear();
      matCache.forEach(function (m) { if (m && m.dispose) m.dispose(); });
      matCache.clear();
    },
  };

  M.Tex = Tex;
  M.Textures = Tex; // SPEC-compatible alias
})();
