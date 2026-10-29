/* Materials, finish presets and the procedural studio environment. Exposes CB_MATS. */
(function (global) {
  'use strict';
  const M = {};

  M.envTexture = function () {
    const c = document.createElement('canvas');
    c.width = 1024; c.height = 512;
    const x = c.getContext('2d');
    const grd = x.createLinearGradient(0, 0, 0, 512);
    grd.addColorStop(0.00, '#f4f7fa');
    grd.addColorStop(0.40, '#c3cedb');
    grd.addColorStop(0.52, '#7d8896');
    grd.addColorStop(1.00, '#2a3038');
    x.fillStyle = grd; x.fillRect(0, 0, 1024, 512);
    function blob(cx, cy, rx, ry, al) {
      const g2 = x.createRadialGradient(cx, cy, 0, cx, cy, rx);
      g2.addColorStop(0, 'rgba(255,255,255,' + al + ')');
      g2.addColorStop(1, 'rgba(255,255,255,0)');
      x.save(); x.translate(cx, cy); x.scale(1, ry / rx);
      x.fillStyle = g2; x.beginPath(); x.arc(0, 0, rx, 0, 6.2832); x.fill(); x.restore();
    }
    blob(270, 110, 250, 160, 1.0);
    blob(780, 150, 200, 125, 0.9);
    blob(520, 50, 180, 100, 0.8);
    const t = new THREE.CanvasTexture(c);
    t.mapping = THREE.EquirectangularReflectionMapping;
    return t;
  };

  M.camoTexture = function () {
    const c = document.createElement('canvas');
    c.width = 512; c.height = 512;
    const x = c.getContext('2d');
    let s = 987654321;
    const rnd = function () { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; };
    x.fillStyle = '#3c4033'; x.fillRect(0, 0, 512, 512);
    const cols = ['#4d5340', '#2c3126', '#5b5f49', '#23271d', '#6a6b52'];
    for (let i = 0; i < 200; i++) {
      const cx = rnd() * 512, cy = rnd() * 512;
      const rx = 18 + rnd() * 62, ry = 10 + rnd() * 34;
      x.save(); x.translate(cx, cy); x.rotate(rnd() * Math.PI);
      x.fillStyle = cols[(rnd() * cols.length) | 0];
      x.beginPath(); x.ellipse(0, 0, rx, ry, 0, 0, 6.2832); x.fill(); x.restore();
    }
    for (let i = 0; i < 260; i++) {
      const cx = rnd() * 512, cy = rnd() * 512;
      x.strokeStyle = 'rgba(20,24,16,' + (0.08 + rnd() * 0.16) + ')';
      x.lineWidth = 1 + rnd() * 2;
      x.beginPath(); x.moveTo(cx, cy);
      x.bezierCurveTo(cx + rnd() * 40 - 20, cy + rnd() * 40 - 20, cx + rnd() * 50 - 25, cy + rnd() * 50 - 25, cx + rnd() * 30 - 15, cy + rnd() * 30 - 15);
      x.stroke();
    }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(1.15, 1.15);
    return t;
  };

  M.make = function () {
    const std = function (o) { return new THREE.MeshStandardMaterial(o); };
    const m = {};
    m.riser     = std({ color: 0x1c1f24, metalness: 0.92, roughness: 0.30 });
    m.riser2    = std({ color: 0x353b43, metalness: 0.95, roughness: 0.22 });
    m.limb      = std({ color: 0x141619, metalness: 0.45, roughness: 0.44, side: THREE.DoubleSide });
    m.limbEdge  = std({ color: 0x9aa1a9, metalness: 0.9, roughness: 0.3 });
    m.cam       = std({ color: 0x1b1e23, metalness: 0.95, roughness: 0.28 });
    m.camFace   = std({ color: 0x2b3036, metalness: 0.95, roughness: 0.22 });
    m.module    = std({ color: 0xc2751f, metalness: 0.85, roughness: 0.34 });
    m.steel     = std({ color: 0xaab0b8, metalness: 1.0, roughness: 0.26 });
    m.darkMetal = std({ color: 0x2a2f35, metalness: 1.0, roughness: 0.36 });
    m.rubber    = std({ color: 0x0b0c0e, metalness: 0.0, roughness: 0.95 });
    m.grip      = std({ color: 0x0d0e11, metalness: 0.0, roughness: 0.86 });
    m.string    = std({ color: 0xdad7cb, metalness: 0.04, roughness: 0.78 });
    m.serving   = std({ color: 0xa7a49a, metalness: 0.04, roughness: 0.76 });
    m.cable     = std({ color: 0x3a3f45, metalness: 0.15, roughness: 0.6 });
    m.accent    = std({ color: 0xd07a20, metalness: 0.8, roughness: 0.36 });
    m.scope     = std({ color: 0x14171b, metalness: 0.6, roughness: 0.4 });
    m.lens      = new THREE.MeshPhysicalMaterial({ color: 0x1f546f, metalness: 0.15, roughness: 0.04, clearcoat: 1.0, clearcoatRoughness: 0.04 });
    m.carbon    = std({ color: 0x22252a, metalness: 0.35, roughness: 0.42 });
    m.arrow     = std({ color: 0x1b1e22, metalness: 0.4, roughness: 0.36 });
    m.vane      = std({ color: 0xe05a1e, metalness: 0.0, roughness: 0.68 });
    m.fur       = std({ color: 0x33332a, metalness: 0.0, roughness: 1.0 });
    const ks = Object.keys(m);
    for (let i = 0; i < ks.length; i++) { if ('envMapIntensity' in m[ks[i]]) m[ks[i]].envMapIntensity = 1.4; }
    return m;
  };

  M.applyFinish = function (m, kind) {
    const ks = Object.keys(m);
    for (let i = 0; i < ks.length; i++) { if ('map' in m[ks[i]]) m[ks[i]].map = null; }
    if (kind === 'bronze') {
      m.riser.color.setHex(0x3a2c1e); m.riser2.color.setHex(0x4a3724);
      m.limb.color.setHex(0x241a12); m.cam.color.setHex(0x2a2018); m.camFace.color.setHex(0x38291d);
      m.module.color.setHex(0xd9a24a); m.accent.color.setHex(0xd9a24a);
    } else if (kind === 'olive') {
      m.riser.color.setHex(0x333a2c); m.riser2.color.setHex(0x414a36);
      m.limb.color.setHex(0x272d21); m.cam.color.setHex(0x2a3023); m.camFace.color.setHex(0x363d2b);
      m.module.color.setHex(0xbcc84e); m.accent.color.setHex(0xc8721e);
    } else if (kind === 'camo') {
      const t = M.camoTexture();
      const t2 = M.camoTexture();
      m.riser.map = t; m.riser.color.setHex(0xffffff);
      m.riser2.map = t2; m.riser2.color.setHex(0xdadada);
      m.limb.map = t; m.limb.color.setHex(0xffffff);
      m.cam.map = t; m.cam.color.setHex(0xe6e6e6);
      m.camFace.map = t2; m.camFace.color.setHex(0xffffff);
      m.module.color.setHex(0xc8721e); m.accent.color.setHex(0xc8721e);
    } else {
      m.riser.color.setHex(0x24272c); m.riser2.color.setHex(0x2f333a);
      m.limb.color.setHex(0x191c20); m.cam.color.setHex(0x1b1e23); m.camFace.color.setHex(0x2b3036);
      m.module.color.setHex(0xc2751f); m.accent.color.setHex(0xd07a20);
    }
    for (let i = 0; i < ks.length; i++) m[ks[i]].needsUpdate = true;
  };

  global.CB_MATS = M;
})(window);
