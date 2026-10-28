/* ABYSS ANGLER - procedural low-poly fish models (window.FishFactory).
 *
 *   FishFactory.create(fish, lengthMeters) -> THREE.Group
 *   FishFactory.animate(group, time, speed, excitement)
 *
 * A created group faces +X, +Y is up, +Z is its side, its origin is the body
 * centre and its overall length along X is about lengthMeters (tail included).
 * The group carries animation handles in group.userData:
 *   { tail, leftFin, rightFin, jaw, bodyMat, glowMat, spine, halo, phase }
 * Handles that a shape does not need are null; animate() ignores them.
 *
 * Shapes: round, long, eel, shark, flat, angler, seahorse.
 * Classic script, THREE r128 global, no modules, no external assets.
 */
(function (global) {
  'use strict';

  var PI = Math.PI;
  var TAU = PI * 2;

  /* ------------------------------------------------------------------ *
   * shared, lazily built resources                                      *
   * ------------------------------------------------------------------ */
  var G = null;
  var EYE_MAT = null;
  var SCLERA_MAT = null;
  var GLINT_MAT = null;
  var GILL_MAT = null;
  var LINE_MAT = null;
  var TOOTH_MAT = null;
  var SCALE_TEX = null;
  var CURRENT_MATS = null;
  var MOUTH_MAT = null;
  var HALO_TEX = null;

  function geos() {
    if (G) return G;
    G = {
      sphere: new THREE.SphereGeometry(1, 15, 11),
      blob: new THREE.SphereGeometry(1, 10, 8),
      cone: new THREE.ConeGeometry(1, 1, 8),
      cyl: new THREE.CylinderGeometry(1, 1, 1, 8, 1),
      tri: new THREE.CircleGeometry(1, 3),
      fan: new THREE.CircleGeometry(1, 8),
      box: new THREE.BoxGeometry(1, 1, 1),
      tailCurl: new THREE.TorusGeometry(0.2, 0.07, 5, 9, PI * 1.5),
      gill: new THREE.TorusGeometry(0.5, 0.045, 4, 9, PI * 0.92),
      tooth: new THREE.ConeGeometry(1, 1, 4),
      ring: new THREE.TorusGeometry(0.5, 0.025, 4, 12)
    };
    Object.keys(G).forEach(function (k) {
      if (!G[k].userData) G[k].userData = {};
      G[k].userData.shared = true;
    });
    return G;
  }

  function eyeMat() {
    if (!EYE_MAT) {
      EYE_MAT = new THREE.MeshStandardMaterial({ color: 0x0a1218, roughness: 0.3, metalness: 0.25, flatShading: true });
      EYE_MAT.userData.shared = true;
    }
    return EYE_MAT;
  }

  function mouthMat() {
    if (!MOUTH_MAT) {
      MOUTH_MAT = new THREE.MeshStandardMaterial({ color: 0x2b1418, roughness: 0.9, metalness: 0.0 });
      MOUTH_MAT.userData.shared = true;
    }
    return MOUTH_MAT;
  }

  function scleraMat() {
    if (!SCLERA_MAT) {
      SCLERA_MAT = new THREE.MeshStandardMaterial({ color: 0x1b2725, roughness: 0.38, metalness: 0.08, flatShading: false });
      SCLERA_MAT.userData.shared = true;
    }
    return SCLERA_MAT;
  }

  function glintMat() {
    if (!GLINT_MAT) {
      GLINT_MAT = new THREE.MeshBasicMaterial({ color: 0xffffff });
      GLINT_MAT.userData.shared = true;
    }
    return GLINT_MAT;
  }

  function gillMat() {
    if (!GILL_MAT) {
      GILL_MAT = new THREE.MeshBasicMaterial({ color: 0x071217, transparent: true, opacity: 0.58, depthWrite: false });
      GILL_MAT.userData.shared = true;
    }
    return GILL_MAT;
  }

  function lineMat() {
    if (!LINE_MAT) {
      LINE_MAT = new THREE.LineBasicMaterial({ color: 0xb9e2de, transparent: true, opacity: 0.35 });
      LINE_MAT.userData.shared = true;
    }
    return LINE_MAT;
  }

  function toothMat() {
    if (!TOOTH_MAT) {
      TOOTH_MAT = new THREE.MeshStandardMaterial({ color: 0xe8dfc3, roughness: 0.55, metalness: 0.0, flatShading: true });
      TOOTH_MAT.userData.shared = true;
    }
    return TOOTH_MAT;
  }

  function haloTexture() {
    if (HALO_TEX) return HALO_TEX;
    if (typeof document === 'undefined') return null;
    var cv = document.createElement('canvas');
    cv.width = 64;
    cv.height = 64;
    var c = cv.getContext('2d');
    if (!c) return null;
    var grad = c.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255,255,255,0.95)');
    grad.addColorStop(0.4, 'rgba(255,255,255,0.30)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = grad;
    c.fillRect(0, 0, 64, 64);
    HALO_TEX = new THREE.CanvasTexture(cv);
    HALO_TEX.userData.shared = true;
    return HALO_TEX;
  }

  /* ------------------------------------------------------------------ *
   * body silhouettes (radius, position along the body axis)             *
   * For horizontal fish the profile runs tail -> nose along +Y before   *
   * the lathe is rotated onto +X. For the seahorse it stays upright.    *
   * ------------------------------------------------------------------ */
  var PROF_ROUND = [[0, -0.62], [0.20, -0.50], [0.40, -0.22], [0.52, 0.05], [0.48, 0.32], [0.32, 0.50], [0.14, 0.60], [0, 0.64]];
  var PROF_LONG = [[0, -0.95], [0.10, -0.82], [0.20, -0.55], [0.28, -0.20], [0.30, 0.10], [0.27, 0.45], [0.20, 0.72], [0.10, 0.90], [0, 0.98]];
  var PROF_SHARK = [[0, -0.95], [0.12, -0.82], [0.24, -0.55], [0.33, -0.18], [0.35, 0.15], [0.32, 0.50], [0.22, 0.75], [0.12, 0.90], [0, 0.98]];
  var PROF_ANGLER = [[0, -0.72], [0.18, -0.58], [0.38, -0.28], [0.52, 0.05], [0.50, 0.38], [0.38, 0.60], [0.20, 0.74], [0, 0.80]];
  var PROF_FLAT = [[0, -0.75], [0.22, -0.58], [0.40, -0.28], [0.52, 0.00], [0.48, 0.28], [0.34, 0.52], [0.16, 0.66], [0, 0.72]];
  var PROF_SEA = [[0, -0.52], [0.10, -0.42], [0.19, -0.20], [0.24, 0.02], [0.20, 0.24], [0.12, 0.40], [0, 0.50]];

  /* ------------------------------------------------------------------ *
   * small geometry helpers                                              *
   * ------------------------------------------------------------------ */
  function m(parent, geo, mat, sx, sy, sz, px, py, pz, rx, ry, rz) {
    var o = new THREE.Mesh(geo, mat);
    o.scale.set(sx, sy, sz);
    o.position.set(px || 0, py || 0, pz || 0);
    o.rotation.set(rx || 0, ry || 0, rz || 0);
    o.castShadow = false;
    o.receiveShadow = false;
    if (parent) parent.add(o);
    return o;
  }

  function pivot(parent, x, y, z) {
    var p = new THREE.Object3D();
    p.position.set(x || 0, y || 0, z || 0);
    if (parent) parent.add(p);
    return p;
  }

  function lathe(parent, mat, profile, sx, sy, sz, px, py, pz, upright) {
    var raw = [];
    var i;
    for (i = 0; i < profile.length; i++) raw.push(new THREE.Vector2(profile[i][0], profile[i][1]));
    var pts = [];
    if (THREE.SplineCurve) {
      var smooth = new THREE.SplineCurve(raw).getPoints(24);
      for (i = 0; i < smooth.length; i++) pts.push(new THREE.Vector2(Math.max(0.0001, smooth[i].x), smooth[i].y));
    } else {
      pts = raw;
    }
    var geo = new THREE.LatheGeometry(pts, 16);
    if (!upright) geo.rotateZ(-PI / 2);
    var o = new THREE.Mesh(geo, mat);
    o.scale.set(sx, sy, sz);
    o.position.set(px || 0, py || 0, pz || 0);
    o.castShadow = false;
    o.receiveShadow = false;
    parent.add(o);
    return o;
  }

  // Triangle blade whose base midpoint sits at (px, py): dorsal / caudal fins.
  function finBlade(parent, mats, len, width, angle, px, py, pz) {
    return m(parent, geos().tri, mats.fin, len, width, 1,
      px + len * 0.5 * Math.cos(angle),
      py + len * 0.5 * Math.sin(angle),
      pz || 0, 0, 0, angle);
  }

  function addEye(parent, x, y, z, r, axis) {
    var nx = 0, ny = 0, nz = 0;
    if (axis === 'y') ny = y >= 0 ? 1 : -1;
    else nz = z >= 0 ? 1 : -1;
    var irisMat = (CURRENT_MATS && CURRENT_MATS.iris) || eyeMat();
    var sclera = m(parent, geos().blob, scleraMat(), r * 1.08, r * 1.08, r * 1.02, x, y, z);
    m(parent, geos().blob, irisMat, r * 0.78, r * 0.78, r * 0.58, x + nx * r * 0.32, y + ny * r * 0.32, z + nz * r * 0.32);
    m(parent, geos().blob, eyeMat(), r * 0.45, r * 0.45, r * 0.34, x + nx * r * 0.52, y + ny * r * 0.52, z + nz * r * 0.52);
    m(parent, geos().blob, glintMat(), r * 0.16, r * 0.16, r * 0.12, x + nx * r * 0.58 + r * 0.18, y + ny * r * 0.58 + r * 0.22, z + nz * r * 0.58);
    return sclera;
  }

  function addMouth(parent, x, y, z, sx, sy, sz, rz) {
    return m(parent, geos().box, mouthMat(), sx, sy, sz, x, y, z, 0, 0, rz || 0);
  }

  function addGlowDots(parent, mats, spots) {
    if (!mats.glow) return;
    var g = geos();
    var i;
    for (i = 0; i < spots.length; i++) {
      m(parent, g.blob, mats.glow, 0.06, 0.06, 0.06, spots[i][0], spots[i][1], spots[i][2]);
    }
  }

  function addGillSlits(parent, x, y, z, s) {
    var g = geos();
    for (var side = -1; side <= 1; side += 2) {
      for (var i = 0; i < 3; i++) {
        m(parent, g.gill, gillMat(), s * 0.30, s * 0.78, s * 0.22,
          x - i * s * 0.48, y + i * s * 0.05, side * z, 0, 0, 0.10);
      }
    }
  }

  function addLateralLine(parent, x1, x2, y, z) {
    for (var side = -1; side <= 1; side += 2) {
      var pts = [];
      for (var i = 0; i <= 7; i++) {
        var t = i / 7;
        pts.push(new THREE.Vector3(x1 + (x2 - x1) * t, y + Math.sin(t * PI) * 0.025, side * (z + Math.sin(t * PI) * 0.012)));
      }
      var geo = new THREE.BufferGeometry().setFromPoints(pts);
      var line = new THREE.Line(geo, lineMat());
      parent.add(line);
    }
  }

  function addBarbels(parent, mats, x, y, z, len) {
    var g = geos();
    for (var side = -1; side <= 1; side += 2) {
      m(parent, g.cyl, mats.fin, 0.010, len, 0.010, x, y - len * 0.45, side * z, 0, 0, side * 0.28);
    }
  }

  function addTeeth(parent, mats, x, y, z, count, size, spread) {
    var g = geos();
    for (var i = 0; i < count; i++) {
      var t = count === 1 ? 0 : (i / (count - 1) - 0.5);
      m(parent, g.tooth, toothMat(), size * 0.38, size, size * 0.38,
        x + Math.abs(t) * 0.03, y, z + t * spread, 0, 0, 0.10 + Math.abs(t) * 0.2);
    }
  }

  function decorate(rig, pal, mats) {
    var shape = pal.shape;
    var name = pal.name || '';
    if (shape === 'round') {
      addGillSlits(rig, 0.23, 0.01, 0.19, 0.17);
      addLateralLine(rig, -0.30, 0.44, 0.06, 0.205);
      if (/fang|viper|leviathan/i.test(name)) addTeeth(rig, mats, 0.58, -0.02, -0.04, 4, 0.035, 0.12);
    } else if (shape === 'long') {
      addGillSlits(rig, 0.36, 0.01, 0.155, 0.15);
      addLateralLine(rig, -0.58, 0.56, 0.03, 0.175);
    } else if (shape === 'shark') {
      addGillSlits(rig, 0.31, -0.03, 0.175, 0.14);
      addLateralLine(rig, -0.66, 0.54, 0.02, 0.185);
      addTeeth(rig, mats, 0.70, -0.22, -0.08, 4, 0.035, 0.16);
    } else if (shape === 'eel') {
      addGillSlits(rig, 0.65, 0.01, 0.105, 0.11);
      addLateralLine(rig, -0.15, 0.60, 0.03, 0.115);
    } else if (shape === 'angler') {
      addGillSlits(rig, 0.10, 0.02, 0.31, 0.18);
      addLateralLine(rig, -0.42, 0.36, 0.04, 0.33);
    } else if (shape === 'flat') {
      addTeeth(rig, mats, 0.50, 0.01, 0, 2, 0.018, 0.12);
    }
    if (shape !== 'flat' && shape !== 'seahorse' && /carp|cod|tooth|grouper|viper/i.test(name)) {
      addBarbels(rig, mats, shape === 'angler' ? 0.88 : 0.56, -0.12, 0.045, 0.15);
    }
  }

  // Paired pectoral fins on left/right pivots (handles: leftFin / rightFin).
  function addPectorals(parent, mats, handles, o) {
    var style = o.style || 'fan';
    var geo = style === 'fan' ? geos().fan : geos().tri;
    var len = o.len * (style === 'small' ? 0.6 : 1);
    var wid = o.wid * (style === 'small' ? 0.65 : 1);
    var sweep = o.sweep === undefined ? 0.5 : o.sweep;
    var s;
    for (s = -1; s <= 1; s += 2) {
      var p = pivot(parent, o.x, o.y || 0, s * (o.z || 0.2));
      p.rotation.y = -s * sweep;
      var wing = m(p, geo, mats.fin, len, wid, 1, 0, 0, s * wid * 0.55, s * PI * 0.5, 0, 0);
      if (style === 'spike') {
        wing.scale.x = len * 1.2;
        wing.scale.y = wid * 0.5;
      }
      if (s < 0) handles.leftFin = p;
      else handles.rightFin = p;
    }
  }

  // Single dorsal fin above the back. style: fan | sail | spike | none.
  function addDorsal(parent, mats, o) {
    var style = o.style || 'fan';
    if (style === 'none') return;
    var s = o.size || 0.25;
    var top = o.y || 0;
    var i;
    if (style === 'sail') {
      finBlade(parent, mats, s * 1.5, s * 0.95, PI * 0.5 + 0.24, o.x, top, 0);
    } else if (style === 'spike') {
      var n = o.compact ? 2 : 3;
      for (i = 0; i < n; i++) {
        var hh = s * (0.52 - i * 0.12);
        var sp = m(parent, geos().cone, mats.fin, s * 0.08, hh, s * 0.08, o.x - i * s * 0.45, top + hh * 0.42, 0);
        sp.rotation.z = 0.2 + i * 0.1;
      }
    } else {
      m(parent, geos().fan, mats.fin, s * 0.62, s * 0.44, 1, o.x, top + s * 0.2, 0, 0, 0, 0.16);
    }
  }

  // Caudal fin on its own pivot (handle: tail). style: fork | crescent | fan | small | whip.
  function addCaudal(parent, mats, handles, o) {
    var style = o.style || 'fork';
    var s = o.size || 0.28;
    var p = pivot(parent, o.x, o.y || 0, 0);
    handles.tail = p;
    if (style === 'crescent') {
      finBlade(p, mats, s * 1.75, s * 0.55, PI - 0.60, 0, 0.05, 0);
      finBlade(p, mats, s * 0.95, s * 0.40, PI + 0.70, 0, -0.02, 0);
    } else if (style === 'fan') {
      m(p, geos().fan, mats.fin, s * 0.80, s * 0.64, 1, -s * 0.18, 0, 0, 0, 0, PI);
    } else if (style === 'small') {
      m(p, geos().fan, mats.fin, s * 0.46, s * 0.38, 1, -s * 0.10, 0, 0, 0, 0, PI);
    } else if (style === 'whip') {
      m(p, geos().cyl, mats.fin, s * 0.05, s * 2.2, s * 0.05, -s * 1.05, 0, 0, 0, 0, PI * 0.5);
    } else {
      finBlade(p, mats, s * 1.20, s * 0.52, PI - 0.44, 0, 0.03, 0);
      finBlade(p, mats, s * 1.20, s * 0.52, PI + 0.44, 0, -0.03, 0);
    }
    return p;
  }

  /* ------------------------------------------------------------------ *
   * materials, palette and procedural patterns                          *
   * ------------------------------------------------------------------ */
  function numColor(v, fallback) {
    if (typeof v === 'number' && isFinite(v)) return Math.max(0, Math.min(0xffffff, Math.floor(v)));
    if (typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v)) return parseInt(v.slice(1), 16);
    return fallback;
  }

  function cssHex(n) {
    var s = (n & 0xffffff).toString(16);
    while (s.length < 6) s = '0' + s;
    return '#' + s;
  }

  function rng(seed) {
    var s = (seed >>> 0) || 1;
    return function () {
      s ^= s << 13; s >>>= 0;
      s ^= s >>> 17;
      s ^= s << 5; s >>>= 0;
      return s / 4294967296;
    };
  }

  function muted(hex, satMul, lightMul) {
    var c = new THREE.Color(hex);
    var hsl = {};
    c.getHSL(hsl);
    c.setHSL(hsl.h, Math.min(0.85, hsl.s * satMul), Math.min(0.82, Math.max(0.05, hsl.l * lightMul)));
    return c.getHex();
  }

  function palette(fish) {
    fish = fish || {};
    var color = muted(numColor(fish.color, 0x5a8fa6), 0.70, 0.86);
    var accent = muted(numColor(fish.accent, 0xe6c268), 0.62, 0.90);
    var glow = (fish.glow === undefined || fish.glow === null) ? null : muted(numColor(fish.glow, 0x7fe6ff), 0.52, 0.64);
    var shape = fish.shape;
    if (shape !== 'round' && shape !== 'long' && shape !== 'eel' && shape !== 'shark' &&
        shape !== 'flat' && shape !== 'angler' && shape !== 'seahorse') shape = 'round';
    var fin = fish.fin;
    if (fin !== 'fan' && fin !== 'sail' && fin !== 'spike' && fin !== 'small') fin = 'fan';
    var pattern = fish.pattern;
    if (pattern !== 'stripes' && pattern !== 'spots' && pattern !== 'bands') pattern = 'plain';
    var name = typeof fish.name === 'string' ? fish.name : '';
    var seed = (((color * 2654435761) ^ (accent * 40503) ^ (name.length * 7919)) >>> 0);
    return { color: color, accent: accent, glow: glow, shape: shape, fin: fin, pattern: pattern, seed: seed, name: name, rarity: fish.rarity || 'common' };
  }

  function finStyles(fin) {
    if (fin === 'sail') return { pectoral: 'fan', dorsal: 'sail', caudal: 'fan' };
    if (fin === 'spike') return { pectoral: 'spike', dorsal: 'spike', caudal: 'fork' };
    if (fin === 'small') return { pectoral: 'small', dorsal: 'none', caudal: 'small' };
    return { pectoral: 'fan', dorsal: 'fan', caudal: 'fork' };
  }

  // A shared scale relief map. One grayscale canvas is reused by every fish.
  function scaleBumpTexture() {
    if (SCALE_TEX) return SCALE_TEX;
    if (typeof document === 'undefined') return null;
    var cv = document.createElement('canvas');
    cv.width = 128; cv.height = 128;
    var c = cv.getContext('2d');
    if (!c) return null;
    c.fillStyle = '#808080';
    c.fillRect(0, 0, 128, 128);
    c.strokeStyle = 'rgba(255,255,255,.38)';
    c.lineWidth = 1;
    for (var row = 0; row < 18; row++) {
      var y = row * 7 + 3;
      for (var col = 0; col < 18; col++) {
        var x = col * 8 + (row % 2 ? 4 : 0);
        c.beginPath();
        c.arc(x, y, 5, Math.PI * 0.08, Math.PI * 0.92);
        c.stroke();
      }
    }
    c.fillStyle = 'rgba(0,0,0,.12)';
    for (var i = 0; i < 90; i++) c.fillRect((i * 37) % 128, (i * 61) % 128, 2, 1);
    SCALE_TEX = new THREE.CanvasTexture(cv);
    SCALE_TEX.wrapS = THREE.RepeatWrapping;
    SCALE_TEX.wrapT = THREE.RepeatWrapping;
    SCALE_TEX.repeat.set(2, 3);
    SCALE_TEX.minFilter = THREE.LinearFilter;
    SCALE_TEX.magFilter = THREE.LinearFilter;
    SCALE_TEX.generateMipmaps = false;
    SCALE_TEX.userData.shared = true;
    return SCALE_TEX;
  }

  // 256x128 body map: base colour, species pattern, scale rows and speckle.
  // u wraps around the body, v runs tail -> nose, so horizontal bands become
  // rings and vertical marks become flank stripes along the fish.
  function bodyTexture(pal) {
    if (typeof document === 'undefined') return null;
    var cv = document.createElement('canvas');
    cv.width = 256; cv.height = 128;
    var c = cv.getContext('2d');
    if (!c) return null;
    var base = cssHex(pal.color);
    var accent = cssHex(pal.accent);
    c.fillStyle = base;
    c.fillRect(0, 0, 256, 128);
    var rnd = rng(pal.seed);
    var i, y;
    if (pal.pattern === 'stripes') {
      c.fillStyle = accent;
      c.globalAlpha = 0.72;
      for (i = 1; i < 13; i++) {
        y = Math.round(i * 10);
        c.fillRect(0, y, 256, 3 + (i % 3));
      }
      c.globalAlpha = 1;
    } else if (pal.pattern === 'bands') {
      c.fillStyle = accent;
      c.globalAlpha = 0.72;
      for (i = 0; i < 5; i++) c.fillRect(0, 10 + i * 25, 256, 9);
      c.globalAlpha = 1;
    } else if (pal.pattern === 'spots') {
      c.fillStyle = accent;
      for (i = 0; i < 62; i++) {
        c.globalAlpha = 0.55 + rnd() * 0.3;
        c.beginPath();
        c.arc(rnd() * 256, rnd() * 128, 2 + rnd() * 5.5, 0, TAU);
        c.fill();
      }
      c.globalAlpha = 1;
    }
    // Scale rows, drawn subtly so they read at catch-preview distance.
    c.lineWidth = 1.2;
    for (var row = 0; row < 17; row++) {
      y = row * 8 + 4;
      for (var col = 0; col < 32; col++) {
        var x = col * 8 + (row % 2 ? 4 : 0);
        c.strokeStyle = 'rgba(0,0,0,.10)';
        c.beginPath();
        c.arc(x, y, 4.8, Math.PI * 0.06, Math.PI * 0.94);
        c.stroke();
        c.strokeStyle = 'rgba(255,255,255,.055)';
        c.beginPath();
        c.arc(x, y + 1.4, 4.2, Math.PI * 0.10, Math.PI * 0.90);
        c.stroke();
      }
    }
    // speckle
    c.fillStyle = 'rgba(255,255,255,.075)';
    for (i = 0; i < 80; i++) c.fillRect(rnd() * 256, rnd() * 128, 1 + rnd() * 2, 1);
    var tex = new THREE.CanvasTexture(cv);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearFilter;
    tex.generateMipmaps = false;
    tex.anisotropy = 2;
    return tex;
  }

  // Fin map: translucent-looking membranes with radial rays.
  function finTexture(pal) {
    if (typeof document === 'undefined') return null;
    var cv = document.createElement('canvas');
    cv.width = 128; cv.height = 128;
    var c = cv.getContext('2d');
    if (!c) return null;
    var accent = cssHex(pal.accent);
    var base = cssHex(pal.color);
    var grd = c.createLinearGradient(0, 0, 0, 128);
    grd.addColorStop(0, base);
    grd.addColorStop(0.45, accent);
    grd.addColorStop(1, accent);
    c.fillStyle = grd;
    c.fillRect(0, 0, 128, 128);
    c.strokeStyle = 'rgba(3, 15, 18, .28)';
    c.lineWidth = 1.5;
    for (var i = 0; i <= 12; i++) {
      var a = (i / 12) * Math.PI;
      c.beginPath();
      c.moveTo(64, 64);
      c.lineTo(64 + Math.cos(a) * 78, 64 + Math.sin(a) * 78);
      c.stroke();
    }
    c.strokeStyle = 'rgba(0,0,0,.22)';
    c.lineWidth = 3;
    c.beginPath(); c.arc(64, 64, 84, 0, TAU); c.stroke();
    c.fillStyle = 'rgba(255,255,255,.10)';
    for (var s = 0; s < 16; s++) c.fillRect((s * 43) % 128, (s * 71) % 128, 2, 1);
    var tex = new THREE.CanvasTexture(cv);
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearFilter;
    tex.generateMipmaps = false;
    return tex;
  }

  function makeMaterials(pal) {
    var tex = bodyTexture(pal);
    var bump = scaleBumpTexture();
    var finTex = finTexture(pal);
    var body = new THREE.MeshStandardMaterial({
      color: tex ? 0xffffff : pal.color,
      map: tex,
      bumpMap: bump,
      bumpScale: 0.016,
      roughness: 0.60,
      metalness: 0.04,
      flatShading: false
    });
    var fin = new THREE.MeshStandardMaterial({
      color: finTex ? 0xffffff : pal.accent,
      map: finTex,
      roughness: 0.68,
      metalness: 0.03,
      flatShading: true,
      side: THREE.DoubleSide
    });
    body.onBeforeCompile = function (shader) {
      shader.uniforms.uWaveTime = { value: 0 };
      shader.uniforms.uWaveAmp = { value: 0.010 };
      shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nuniform float uWaveTime;\nuniform float uWaveAmp;');
      shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nfloat wv = sin(position.x * 4.2 + uWaveTime) * uWaveAmp * smoothstep(-0.9, 0.7, position.x);\ntransformed.z += wv;');
      body.userData.shader = shader;
    };
    var irisColor = new THREE.Color(pal.accent);
    irisColor.lerp(new THREE.Color(0xffe6a8), 0.30);
    var iris = new THREE.MeshStandardMaterial({
      color: irisColor.getHex(),
      roughness: 0.30,
      metalness: 0.18,
      emissive: irisColor.getHex(),
      emissiveIntensity: 0.10
    });
    var glow = null;
    if (pal.glow !== null) {
      body.emissive.setHex(pal.glow);
      body.emissiveIntensity = 0.08;
      fin.emissive.setHex(pal.glow);
      fin.emissiveIntensity = 0.14;
      glow = new THREE.MeshBasicMaterial({
        color: pal.glow,
        transparent: true,
        opacity: 0.62,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      });
    }
    return { body: body, fin: fin, glow: glow, iris: iris };
  }

  function makeHalo(glowHex) {
    var tex = haloTexture();
    if (!tex) return null;
    var mat = new THREE.SpriteMaterial({
      map: tex,
      color: glowHex,
      transparent: true,
      opacity: 0.16,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    var sprite = new THREE.Sprite(mat);
    // keep the additive halo inside the body bounds so it never inflates the fish length
    sprite.scale.setScalar(0.62);
    return sprite;
  }

  /* ------------------------------------------------------------------ *
   * shape builders (one comment line per silhouette)                    *
   * ------------------------------------------------------------------ */

  // round: tall disc-like body (sunfish / koi), small rounded tail, fan fins
  function buildRound(rig, pal, mats, h, fs) {
    lathe(rig, mats.body, PROF_ROUND, 1.0, 1.35, 0.42, 0, 0, 0, false);
    addDorsal(rig, mats, {
      style: fs.dorsal === 'none' ? 'fan' : fs.dorsal,
      x: -0.04, y: 0.62, size: 0.30
    });
    addCaudal(rig, mats, h, { style: fs.caudal === 'fork' ? 'fan' : fs.caudal, x: -0.58, size: 0.30 });
    addPectorals(rig, mats, h, { style: fs.pectoral, x: 0.16, y: -0.04, z: 0.19, len: 0.24, wid: 0.16 });
    addEye(rig, 0.34, 0.15, 0.19, 0.048);
    addEye(rig, 0.34, 0.15, -0.19, 0.048);
    addMouth(rig, 0.63, 0.0, 0, 0.05, 0.035, 0.06);
    if (mats.glow) addGlowDots(rig, mats, [[0.02, 0.40, 0.14], [-0.28, 0.32, -0.14]]);
  }

  // long: streamlined fusiform body (mackerel / silverfin), forked tail
  function buildLong(rig, pal, mats, h, fs) {
    lathe(rig, mats.body, PROF_LONG, 1, 1, 0.62, 0, 0, 0, false);
    addDorsal(rig, mats, { style: fs.dorsal, x: -0.16, y: 0.27, size: 0.22 });
    addCaudal(rig, mats, h, { style: fs.caudal, x: -0.90, size: 0.30 });
    addPectorals(rig, mats, h, { style: fs.pectoral, x: 0.10, y: -0.12, z: 0.16, len: 0.20, wid: 0.12 });
    addEye(rig, 0.62, 0.10, 0.165, 0.042);
    addEye(rig, 0.62, 0.10, -0.165, 0.042);
    addMouth(rig, 0.90, -0.02, 0, 0.03, 0.045, 0.09);
    if (mats.glow) addGlowDots(rig, mats, [[0.06, 0.20, 0.10], [-0.32, 0.16, -0.10]]);
  }

  // eel: long ribbon body of four tapering segments (chained tail wave)
  function buildEel(rig, pal, mats, h, fs) {
    var g = geos();
    m(rig, g.sphere, mats.body, 0.27, 0.19, 0.16, 0.82, 0, 0);
    addEye(rig, 1.00, 0.08, 0.155, 0.040);
    addEye(rig, 1.00, 0.08, -0.155, 0.040);
    addMouth(rig, 1.05, -0.02, 0, 0.03, 0.035, 0.07);
    var lens = [0.36, 0.31, 0.27, 0.23, 0.19, 0.16, 0.13];
    var rads = [0.19, 0.17, 0.15, 0.13, 0.11, 0.09, 0.075];
    var parent = rig;
    var x = 0.60;
    var spine = [];
    var i, p;
    for (i = 0; i < lens.length; i++) {
      p = pivot(parent, x, 0, 0);
      m(p, g.sphere, mats.body, lens[i] * 1.04, rads[i], rads[i] * 0.90, -lens[i] * 0.52, 0, 0);
      spine.push(p);
      parent = p;
      x = -lens[i] * 0.66;
    }
    h.spine = spine;
    h.tail = spine[0];
    addDorsal(rig, mats, { style: fs.dorsal, x: -0.15, y: 0.14, size: 0.16, compact: true });
    addPectorals(rig, mats, h, { style: fs.pectoral, x: 0.58, y: -0.08, z: 0.11, len: 0.14, wid: 0.09 });
    if (mats.glow) addGlowDots(rig, mats, [[0.34, 0.14, 0.08], [-0.05, 0.13, -0.08]]);
  }

  // shark: big torpedo body, tall dorsal, crescent tail, pale belly, gill marks
  function buildShark(rig, pal, mats, h, fs) {
    lathe(rig, mats.body, PROF_SHARK, 1, 1.08, 0.62, 0, 0, 0, false);
    finBlade(rig, mats, 0.62, 0.50, PI * 0.5 + 0.30, -0.10, 0.35, 0);
    addCaudal(rig, mats, h, { style: 'crescent', x: -0.92, size: 0.34 });
    addPectorals(rig, mats, h, { style: fs.pectoral, x: 0.18, y: -0.20, z: 0.19, len: 0.36, wid: 0.17, sweep: 0.85 });
    addEye(rig, 0.60, 0.12, 0.205, 0.040);
    addEye(rig, 0.60, 0.12, -0.205, 0.040);
    addMouth(rig, 0.72, -0.25, 0, 0.07, 0.04, 0.16, 0.10);
    m(rig, geos().box, mouthMat(), 0.04, 0.15, 0.02, 0.14, -0.03, 0.20, 0, 0, 0.30);
    m(rig, geos().box, mouthMat(), 0.04, 0.15, 0.02, 0.14, -0.03, -0.20, 0, 0, 0.30);
  }

  // flat: wide flat diamond ray body, eyes on top, long thin whip tail
  function buildFlat(rig, pal, mats, h, fs) {
    lathe(rig, mats.body, PROF_FLAT, 1.05, 0.16, 1.15, 0, 0, 0, false);
    addPectorals(rig, mats, h, { style: fs.pectoral, x: 0.02, y: 0.02, z: 0.34, len: 0.62, wid: 0.52, sweep: 0.06 });
    addCaudal(rig, mats, h, { style: 'whip', x: -0.66, size: 0.42 });
    addEye(rig, 0.20, 0.12, 0.12, 0.036, 'y');
    addEye(rig, 0.20, 0.12, -0.12, 0.036, 'y');
    addMouth(rig, 0.56, 0.02, 0, 0.04, 0.025, 0.14);
    if (mats.glow) addGlowDots(rig, mats, [[-0.12, 0.09, 0], [-0.40, 0.08, 0]]);
  }

  // angler: bulbous body, huge hinged jaw with teeth, glowing illicium + esca
  function buildAngler(rig, pal, mats, h, fs) {
    var g = geos();
    lathe(rig, mats.body, PROF_ANGLER, 1, 1.15, 0.85, 0, 0, 0, false);
    var jaw = pivot(rig, 0.50, -0.08, 0);
    h.jaw = jaw;
    m(jaw, g.sphere, mats.body, 0.50, 0.15, 0.36, 0.35, -0.02, 0);
    m(jaw, g.cone, mats.fin, 0.045, 0.14, 0.045, 0.55, 0.10, 0, 0, 0, 0.12);
    m(jaw, g.cone, mats.fin, 0.045, 0.17, 0.045, 0.72, 0.11, 0, 0, 0, 0.02);
    m(jaw, g.cone, mats.fin, 0.045, 0.12, 0.045, 0.88, 0.09, 0, 0, 0, -0.10);
    m(rig, g.blob, mouthMat(), 0.32, 0.15, 0.22, 1.00, -0.06, 0);
    addEye(rig, 0.15, 0.48, 0.43, 0.056);
    addEye(rig, 0.15, 0.48, -0.43, 0.056);
    m(rig, g.cyl, mats.fin, 0.030, 0.75, 0.030, 0.55, 0.485, 0, 0, 0, -1.94);
    m(rig, g.blob, mats.glow || mats.fin, 0.095, 0.095, 0.095, 1.00, 0.31, 0);
    h.haloAt = { x: 1.0, y: 0.31, z: 0 };
    addCaudal(rig, mats, h, { style: 'fan', x: -0.68, size: 0.28 });
    addPectorals(rig, mats, h, { style: fs.pectoral, x: 0.08, y: -0.18, z: 0.40, len: 0.20, wid: 0.14 });
  }

  // seahorse: upright curled body, snout, crown, dorsal fin, curled tail
  function buildSeahorse(rig, pal, mats, h, fs) {
    var g = geos();
    var wrap = pivot(rig, 0, 0.06, 0);
    wrap.rotation.z = -0.24;
    lathe(wrap, mats.body, PROF_SEA, 1.25, 1.0, 0.82, 0, 0, 0, true);
    for (var ri = 0; ri < 5; ri++) {
      m(wrap, g.ring, mats.body, 0.22 - ri * 0.018, 0.035, 0.17 - ri * 0.012,
        0, 0.43 - ri * 0.17, 0, PI / 2, 0, 0);
    }
    m(wrap, g.sphere, mats.body, 0.20, 0.22, 0.18, 0.05, 0.64, 0);
    m(wrap, g.cyl, mats.body, 0.045, 0.30, 0.045, 0.24, 0.64, 0, 0, 0, -PI * 0.5);
    m(wrap, g.cone, mats.fin, 0.05, 0.14, 0.05, 0.0, 0.86, 0, 0, 0, -0.20);
    m(wrap, g.blob, mouthMat(), 0.025, 0.025, 0.025, 0.40, 0.635, 0);
    addEye(wrap, 0.17, 0.68, 0.19, 0.038);
    addEye(wrap, 0.17, 0.68, -0.19, 0.038);
    finBlade(wrap, mats, 0.30, 0.28, PI * 0.5 + 0.50, -0.26, 0.16, 0);
    var tBase = pivot(wrap, -0.02, -0.48, 0);
    h.tail = tBase;
    var curl = new THREE.Mesh(g.tailCurl, mats.body);
    curl.position.set(0, -0.18, 0);
    curl.rotation.z = -PI * 0.20;
    curl.castShadow = false;
    curl.receiveShadow = false;
    tBase.add(curl);
    addPectorals(wrap, mats, h, { style: fs.pectoral, x: 0.12, y: 0.28, z: 0.14, len: 0.11, wid: 0.08 });
    if (mats.glow) addGlowDots(wrap, mats, [[0.05, 0.30, 0.16], [-0.03, 0.02, -0.20]]);
  }

  var BUILDERS = {
    round: buildRound,
    long: buildLong,
    eel: buildEel,
    shark: buildShark,
    flat: buildFlat,
    angler: buildAngler,
    seahorse: buildSeahorse
  };

  /* ------------------------------------------------------------------ *
   * public API                                                          *
   * ------------------------------------------------------------------ */
  function create(fish, lengthMeters) {
    if (typeof THREE === 'undefined') return null;
    var L = (typeof lengthMeters === 'number' && isFinite(lengthMeters) && lengthMeters > 0) ? lengthMeters : 1.4;
    var pal = palette(fish);
    var mats = makeMaterials(pal);

    var root = new THREE.Group();
    var rig = new THREE.Group();
    root.add(rig);

    var handles = {
      tail: null,
      leftFin: null,
      rightFin: null,
      jaw: null,
      bodyMat: mats.body,
      glowMat: mats.glow,
      spine: null,
      halo: null,
      haloBase: 1,
      haloAt: null,
      body: rig,
      bodyGlow: pal.glow !== null ? 0.16 : 0,
      phase: Math.random() * TAU
    };

    var builder = BUILDERS[pal.shape] || BUILDERS.round;
    CURRENT_MATS = mats;
    builder(rig, pal, mats, handles, finStyles(pal.fin));
    decorate(rig, pal, mats);
    CURRENT_MATS = null;

    // Fit to the requested length along X and put the bounds centre on the origin.
    var box = new THREE.Box3().setFromObject(rig);
    var size = new THREE.Vector3();
    box.getSize(size);
    if (size.x > 1e-5) {
      rig.position.set(
        -(box.min.x + box.max.x) * 0.5,
        -(box.min.y + box.max.y) * 0.5,
        -(box.min.z + box.max.z) * 0.5
      );
      root.scale.setScalar(L / size.x);
    } else {
      root.scale.setScalar(1);
    }

    // Additive halo sprite (no real light: 30 fish on screen must stay cheap).
    if (pal.glow !== null) {
      var halo = makeHalo(pal.glow);
      if (halo) {
        var at = handles.haloAt || { x: 0, y: 0, z: 0 };
        halo.position.set(at.x, at.y, at.z);
        handles.halo = halo;
        handles.haloBase = halo.scale.x;
        rig.add(halo);
      }
    }

    root.userData = handles;
    return root;
  }

  function disposeGroup(root) {
    if (!root) return;
    root.traverse(function (o) {
      if (!o.isMesh && !o.isLine && !o.isSprite) return;
      if (o.geometry && !(o.geometry.userData && o.geometry.userData.shared)) o.geometry.dispose();
      var mats = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
      mats.forEach(function (mat) {
        if (!mat) return;
        if (mat.map && mat.map.dispose && !(mat.map.userData && mat.map.userData.shared)) mat.map.dispose();
        if (!(mat.userData && mat.userData.shared)) mat.dispose();
      });
    });
  }

  function animate(group, time, speed, excitement) {
    if (!group) return;
    var u = group.userData;
    if (!u) return;

    var t = (typeof time === 'number' && isFinite(time)) ? time : 0;
    var sp = (typeof speed === 'number' && isFinite(speed)) ? (speed < 0 ? 0 : (speed > 3 ? 3 : speed)) : 1;
    var ex = (typeof excitement === 'number' && isFinite(excitement)) ? (excitement < 0 ? 0 : (excitement > 1 ? 1 : excitement)) : 0;
    var base = u.phase || 0;
    var phase = t * (2.0 + sp * 2.1 + ex * 2.4);
    var tailAmp = 0.16 + sp * 0.13 + ex * 0.34;

    if (u.spine && u.spine.length > 1) {
      // eel: one travelling wave down the chained segments
      for (var i = 0; i < u.spine.length; i++) {
        u.spine[i].rotation.y = Math.sin(phase + base - i * 0.8) * tailAmp * (0.75 + i * 0.18);
      }
    } else if (u.tail) {
      u.tail.rotation.y = Math.sin(phase + base) * tailAmp;
    }
    if (u.body) {
      u.body.rotation.y = Math.sin(phase * 0.45 + base) * 0.018;
    }

    var flap = Math.sin(phase * 1.55 + base + 0.9) * (0.12 + sp * 0.10 + ex * 0.42);
    if (u.leftFin) u.leftFin.rotation.x = flap;
    if (u.rightFin) u.rightFin.rotation.x = -flap;

    if (u.jaw) {
      u.jaw.rotation.z = -(0.10 + 0.12 * (0.5 + 0.5 * Math.sin(t * 2.2 + base)) + ex * 0.35);
    }

    if (u.glowMat) {
      u.glowMat.opacity = 0.55 + 0.40 * (0.5 + 0.5 * Math.sin(t * 3.4 + base));
    }
    if (u.bodyGlow && u.bodyMat) {
      u.bodyMat.emissiveIntensity = u.bodyGlow * (0.85 + 0.35 * (0.5 + 0.5 * Math.sin(t * 2.6 + base)));
    }
    if (u.bodyMat && u.bodyMat.userData && u.bodyMat.userData.shader) {
      var sh = u.bodyMat.userData.shader;
      if (sh.uniforms.uWaveTime) sh.uniforms.uWaveTime.value = phase + base;
      if (sh.uniforms.uWaveAmp) sh.uniforms.uWaveAmp.value = 0.006 + sp * 0.010 + ex * 0.020;
    }
    if (u.halo && u.halo.material) {
      var pulse = 0.5 + 0.5 * Math.sin(t * 2.7 + base);
      u.halo.material.opacity = 0.09 + 0.12 * pulse;
      u.halo.scale.setScalar(u.haloBase * (0.85 + 0.28 * pulse));
    }
  }

  global.FishFactory = {
    create: create,
    animate: animate,
    dispose: disposeGroup,
    shapes: ['round', 'long', 'eel', 'shark', 'flat', 'angler', 'seahorse'],
    version: '2.0.0'
  };
})(typeof window !== 'undefined' ? window : globalThis);