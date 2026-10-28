// js/materials.js — procedural PBR materials, four 747-8 liveries and all canvas art.
import * as THREE from '../lib/three.module.min.js';
import { makeCanvas, canvasTexture, normalMapFromHeight, clamp, lerp, TAU, roundRect, fbm } from './util.js';
import { FUSE, vOfX, thetaForY, WINDOW_X, UPPER_WINDOW_X, MAIN_DOOR_X, UPPER_DOOR_X, CARGO_DOORS } from './fuselage.js';

export const LIVERIES = [
  {
    id: 'house', name: 'Boeing House 2011', base: '#f6f7fa', belly: '#dfe4ea',
    accent: '#0b2e52', accent2: '#c9a96a', fin: '#0a2b4d', finText: '#f7f9fc',
    title: 'BOEING', sub: '747-8', finMark: '747-8', finSub: 'INTERCONTINENTAL',
    reg: 'N747BJ', metal: 0.06, rough: 0.30, dark: false,
    wingBase: '#e9ebee', nacelle: '#f1f3f6',
  },
  {
    id: 'aurora', name: 'Aurora Pacific', base: '#f5f1e9', belly: '#e3ddd2',
    accent: '#0d3a3f', accent2: '#cf7a43', fin: '#0d3a3f', finText: '#f5f1e9',
    title: 'AURORA', sub: '747-8', finMark: 'AURORA', finSub: 'PACIFIC',
    reg: 'VH-AUR', metal: 0.06, rough: 0.32, dark: false,
    wingBase: '#e9e5dd', nacelle: '#f2eee6',
  },
  {
    id: 'retro', name: 'Pacific Retro 1972', base: '#efe9dc', belly: '#c6c9cc',
    accent: '#b2372c', accent2: '#d9b95e', fin: '#efe9dc', finText: '#b2372c',
    title: 'PACIFIC', sub: '747-8', finMark: 'PACIFIC', finSub: 'AIRWAYS',
    reg: 'N747PA', metal: 0.22, rough: 0.32, dark: false,
    wingBase: '#dddad2', nacelle: '#e8e3d8',
  },
  {
    id: 'obsidian', name: 'Obsidian VIP', base: '#1b2027', belly: '#10141a',
    accent: '#c9a96a', accent2: '#c9a96a', fin: '#11151b', finText: '#eadcb8',
    title: 'OBSIDIAN', sub: '747-8', finMark: '747-8', finSub: 'OBSIDIAN',
    reg: 'N747JV', metal: 0.18, rough: 0.34, dark: true,
    wingBase: '#3a404a', nacelle: '#343a43',
  },
];

// ------------------------------------------------------------------ helpers
const pxTheta = (theta, W) => ((((theta / TAU) % 1) + 1) % 1) * W;
const pyX = (x, H) => (1 - vOfX(x)) * H;
const pxPerRad = (W) => W / TAU;
const pxPerM = (H) => H / FUSE.len;

// Split a small angular band into canvas-u segments, handling the theta = 0 seam.
function arcSegments(t0, t1) {
  let u0 = (((t0 / TAU) % 1) + 1) % 1;
  let u1 = (((t1 / TAU) % 1) + 1) % 1;
  if (Math.abs(u1 - u0) > 0.5) {
    return u0 > u1 ? [[u0, 1], [0, u1]] : [[u1, 1], [0, u0]];
  }
  return [[Math.min(u0, u1), Math.max(u0, u1)]];
}

function paintBand(ctx, W, uSegs, y, h, color) {
  ctx.fillStyle = color;
  for (const [a, b] of uSegs) {
    const x0 = a * W, x1 = b * W;
    if (x1 - x0 < 0.5) continue;
    ctx.fillRect(x0, y, x1 - x0, Math.max(1, h));
  }
}

// ------------------------------------------------------------------ fuselage paint
function paintFuselageColor(ctx, W, H, liv) {
  const sx = pxPerRad(W), sy = pxPerM(H);
  ctx.fillStyle = liv.base;
  ctx.fillRect(0, 0, W, H);

  // lower-half colour: symmetric gradient, darkest at the keel
  const g = ctx.createLinearGradient(0.5 * W, 0, W, 0);
  g.addColorStop(0.00, liv.base);
  g.addColorStop(0.08, liv.belly);
  g.addColorStop(0.50, liv.belly);
  g.addColorStop(0.92, liv.belly);
  g.addColorStop(1.00, liv.base);
  ctx.fillStyle = g;
  ctx.fillRect(0.5 * W, 0, 0.5 * W, H);

  // sweeping cheatline, painted station by station so it follows the fuselage
  for (let x = 31.5; x > -34.0; x -= 0.10) {
    const water = 0.32 + 0.46 * smoothstep(-8, 24, x) + 0.10 * smoothstep(-31, -18, x);
    const y0 = water - 0.62;
    for (const star of [true, false]) {
      const t0 = thetaForY(x, y0, star), t1 = thetaForY(x, water, star);
      paintBand(ctx, W, arcSegments(t0, t1), pyX(x, H), sy * 0.12, liv.accent);
      const tp0 = thetaForY(x, water, star), tp1 = thetaForY(x, water + 0.075, star);
      paintBand(ctx, W, arcSegments(tp0, tp1), pyX(x, H), sy * 0.12, liv.accent2);
    }
  }

  // radome and its lightning-diverter strips
  const nosePy = pyX(FUSE.noseX - 2.05, H);
  ctx.fillStyle = '#aeb4bb';
  ctx.fillRect(0, nosePy, W, H - nosePy);
  ctx.strokeStyle = 'rgba(55,60,66,0.55)';
  ctx.lineWidth = Math.max(1.5, W / 900);
  ctx.beginPath(); ctx.moveTo(0, nosePy); ctx.lineTo(W, nosePy); ctx.stroke();
  for (let i = 0; i <= 15; i++) {
    const th = (i / 15) * TAU;
    ctx.fillStyle = 'rgba(64,69,76,0.5)';
    ctx.fillRect(pxTheta(th, W), nosePy, Math.max(1, W / 1700), (H - nosePy) * 0.55);
  }

  // frame and stringer lines
  ctx.lineWidth = 1;
  for (let x = 30.5; x > -33.5; x -= 0.56) {
    ctx.fillStyle = 'rgba(80,86,94,0.09)';
    ctx.fillRect(0, pyX(x, H), W, Math.max(1, sy * 0.030));
  }
  for (const th of [0.055, 0.135, 0.235, 0.335, 0.435, 0.565, 0.645, 0.745, 0.845, 0.945]) {
    ctx.fillStyle = 'rgba(80,86,94,0.07)';
    ctx.fillRect(pxTheta(th * TAU, W), 0, Math.max(1, sx * 0.014), H);
  }

  // cargo doors (starboard lower deck)
  for (const d of CARGO_DOORS) {
    const th = thetaForY(d.x, d.yc, d.side === 'S');
    const cx = pxTheta(th, W), cy = pyX(d.x, H);
    const hw = (d.h / 2 / FUSE.R) * sx, hh = (d.w / 2) * sy;
    ctx.fillStyle = 'rgba(205,210,216,0.35)';
    ctx.fillRect(cx - hw, cy - hh, hw * 2, hh * 2);
    ctx.strokeStyle = 'rgba(35,40,46,0.6)';
    ctx.lineWidth = Math.max(2, sx * 0.018);
    ctx.strokeRect(cx - hw, cy - hh, hw * 2, hh * 2);
    ctx.fillStyle = 'rgba(35,40,46,0.55)';
    ctx.fillRect(cx - hw - sx * 0.02, cy - hh * 0.5, sx * 0.035, hh * 0.8);
  }

  // main-deck doors: five per side, outlined with a handle and a window
  const doorH = 1.98, doorY = 0.72;
  MAIN_DOOR_X.forEach((x) => {
    for (const star of [true, false]) {
      const yTop = doorY + doorH / 2, yBot = doorY - doorH / 2;
      for (let k = 0; k <= 14; k++) {
        const xx = lerp(x - 0.56, x + 0.56, k / 14);
        const tT = thetaForY(xx, yTop, star), tB = thetaForY(xx, yBot, star);
        paintBand(ctx, W, arcSegments(tB, tT), pyX(xx, H) - sy * 0.012, sy * 0.024, 'rgba(255,255,255,0.55)');
      }
      for (let k = 0; k <= 14; k++) {
        const xx = lerp(x - 0.53, x + 0.53, k / 14);
        const tT = thetaForY(xx, yTop - 0.025, star), tB = thetaForY(xx, yBot + 0.025, star);
        paintBand(ctx, W, arcSegments(tB, tT), pyX(xx, H), sy * 0.005, 'rgba(30,36,44,0.45)');
      }
      const tMid = thetaForY(x, doorY, star);
      const cu = pxTheta(tMid, W);
      ctx.fillStyle = 'rgba(30,36,44,0.55)';
      roundRect(ctx, cu - 0.05 * sx, pyX(x, H) - sy * 0.16, 0.10 * sx, sy * 0.22, 0.03 * sx);
      ctx.fill();
      ctx.fillStyle = 'rgba(15,18,22,0.75)';
      roundRect(ctx, cu - 0.11 * sx, pyX(x, H) - sy * 0.08, 0.22 * sx, sy * 0.16, 0.04 * sx);
      ctx.fill();
    }
  });

  // upper-deck door
  for (const star of [true, false]) {
    const tMid = thetaForY(UPPER_DOOR_X, 3.05, star);
    const cx = pxTheta(tMid, W), cy = pyX(UPPER_DOOR_X, H);
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = Math.max(2, sx * 0.012);
    ctx.strokeRect(cx - 0.13 * sx, cy - 0.55 * sy, 0.26 * sx, 1.10 * sy);
  }

  // weathering: exhaust soot and belly streaks
  for (let i = 0; i < 700; i++) {
    const x = -18 - Math.random() * 18;
    const th = Math.random() * TAU;
    const a = 0.05 * Math.random() * clamp((pyX(x, H) - pyX(-18, H)) / (pyX(-33, H) - pyX(-18, H) + 1e-6), 0, 1);
    ctx.fillStyle = 'rgba(25,26,28,' + a.toFixed(3) + ')';
    ctx.fillRect(pxTheta(th, W), pyX(x, H), sx * 0.015 * (1 + Math.random() * 4), sy * (0.2 + Math.random()));
  }
  for (let i = 0; i < 900; i++) {
    const x = 30 - Math.random() * 64;
    const th = 0.58 + Math.random() * 0.84;
    ctx.fillStyle = 'rgba(110,115,122,' + (0.045 * Math.random()).toFixed(3) + ')';
    ctx.fillRect(th * W, pyX(x, H), 2, sy * (0.2 + Math.random() * 1.8));
  }
}

function paintFuselageHeight(ctx, W, H) {
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, W, H);
  const sx = pxPerRad(W), sy = pxPerM(H);
  for (let x = 30.5; x > -33.5; x -= 0.56) {
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, pyX(x, H) - Math.max(1, sy * 0.008), W, Math.max(1, sy * 0.020));
  }
  for (const th of [0.055, 0.135, 0.235, 0.335, 0.435, 0.565, 0.645, 0.745, 0.845, 0.945]) {
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(pxTheta(th * TAU, W), 0, Math.max(1, sx * 0.010), H);
  }
  // subtle skin waviness
  const img = ctx.getImageData(0, 0, W, H);
  const d = img.data;
  for (let y = 0; y < H; y += 2) {
    for (let x = 0; x < W; x += 2) {
      const n = (fbm(x * 0.05, y * 0.05, 3, 7) - 0.5) * 22;
      for (let dy = 0; dy < 2 && y + dy < H; dy++) {
        for (let dx = 0; dx < 2 && x + dx < W; dx++) {
          const i = ((y + dy) * W + (x + dx)) * 4;
          const v = clamp(d[i] + n, 0, 255);
          d[i] = v; d[i + 1] = v; d[i + 2] = v;
        }
      }
    }
  }
  ctx.putImageData(img, 0, 0);
}

function paintPacked(ctx, W, H, liv) {
  const img = ctx.createImageData(W, H);
  const d = img.data;
  for (let y = 0; y < H; y++) {
    const belly = clamp((y / H - 0.45) * 2.2, 0, 1);
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      const n = fbm(x * 0.08, y * 0.08, 4, 21);
      const rough = clamp(liv.rough + belly * 0.12 + (n - 0.5) * 0.14, 0.05, 0.95);
      const metal = clamp(liv.metal + (n - 0.5) * 0.10, 0, 1);
      d[i] = 255;
      d[i + 1] = Math.round(rough * 255);
      d[i + 2] = Math.round(metal * 255);
      d[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
}

// ------------------------------------------------------------------ fin
function paintFin(ctx, W, H, liv) {
  ctx.fillStyle = liv.fin;
  ctx.fillRect(0, 0, W, H);
  const drawSide = (x0, w) => {
    ctx.save();
    ctx.translate(x0, 0);
    // sweeping accent band from the lower trailing corner
    ctx.beginPath();
    ctx.moveTo(0, H);
    ctx.lineTo(w * 0.62, H);
    ctx.quadraticCurveTo(w * 0.82, H * 0.62, w * 0.98, H * 0.18);
    ctx.lineTo(w, H * 0.34);
    ctx.quadraticCurveTo(w * 0.74, H * 0.78, w * 0.52, H);
    ctx.closePath();
    ctx.fillStyle = liv.accent2;
    ctx.globalAlpha = 0.9;
    ctx.fill();
    ctx.globalAlpha = 1;
    // broad soft sheen
    const gr = ctx.createLinearGradient(0, 0, w, H);
    gr.addColorStop(0, 'rgba(255,255,255,0.10)');
    gr.addColorStop(0.5, 'rgba(255,255,255,0)');
    gr.addColorStop(1, 'rgba(0,0,0,0.14)');
    ctx.fillStyle = gr;
    ctx.fillRect(0, 0, w, H);
    ctx.restore();
  };
  drawSide(0, W / 2);
  drawSide(W / 2, W / 2);
  // de-ice boot along the leading edge
  const grad = ctx.createLinearGradient(0, 0, W * 0.05, 0);
  grad.addColorStop(0, 'rgba(0,0,0,0.5)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W * 0.05, H);
  ctx.fillRect(W / 2, 0, W * 0.05, H);
}

// ------------------------------------------------------------------ wing / nacelle tiles
function paintPanelTile(ctx, W, H, base, cells = 5) {
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = 'rgba(70,76,84,0.30)';
  ctx.lineWidth = Math.max(1.5, W / 720);
  for (let i = 1; i < cells; i++) {
    const x = (i / cells) * W;
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
  }
  for (let i = 1; i < cells * 2; i++) {
    const y = (i / (cells * 2)) * H;
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
  }
  ctx.fillStyle = 'rgba(80,84,90,0.22)';
  for (let i = 0; i <= cells; i++) {
    const x = (i / cells) * W;
    for (let y = 0; y < H; y += Math.max(3, H / 220)) ctx.fillRect(x - 1, y, 1.5, 1.5);
  }
  for (let i = 0; i < 220; i++) {
    const x = Math.random() * W, y = Math.random() * H, r = 2 + Math.random() * 24;
    ctx.fillStyle = 'rgba(40,42,46,' + (0.015 + Math.random() * 0.04).toFixed(3) + ')';
    ctx.beginPath(); ctx.ellipse(x, y, r, r * (0.2 + Math.random() * 0.8), Math.random() * 3, 0, TAU); ctx.fill();
  }
}

function paintMetalTile(ctx, W, H, tint) {
  ctx.fillStyle = tint;
  ctx.fillRect(0, 0, W, H);
  for (let y = 0; y < H; y++) {
    const n = fbm(0, y * 0.4, 3, 11);
    ctx.fillStyle = 'rgba(255,255,255,' + (n * 0.05).toFixed(3) + ')';
    ctx.fillRect(0, y, W, 1);
  }
  ctx.strokeStyle = 'rgba(0,0,0,0.10)';
  ctx.lineWidth = 1;
  for (let i = 1; i < 8; i++) { ctx.beginPath(); ctx.moveTo((i / 8) * W, 0); ctx.lineTo((i / 8) * W, H); ctx.stroke(); }
}

const tex = (canvas, srgb, rep, aniso) => canvasTexture(canvas, { srgb: !!srgb, repeat: rep || [1, 1], aniso: aniso || 8 });

// ------------------------------------------------------------------ material set
export function createMaterials(renderer) {
  const aniso = renderer ? renderer.capabilities.getMaxAnisotropy() : 8;
  const M = { aniso, env: null, livery: LIVERIES[0] };
  M.std = (o) => new THREE.MeshStandardMaterial(o);
  M.phys = (o) => new THREE.MeshPhysicalMaterial(o);

  M.glassWindow = M.phys({ color: '#070b10', roughness: 0.06, metalness: 0.06, clearcoat: 1, clearcoatRoughness: 0.03, envMapIntensity: 1.5 });
  M.glassWindow.emissive = new THREE.Color('#ffb066');
  M.glassWindow.emissiveIntensity = 0.22;
  M.cockpitGlass = M.phys({ color: '#0b1a26', roughness: 0.07, metalness: 0.30, clearcoat: 0.8, clearcoatRoughness: 0.06, envMapIntensity: 1.1, side: THREE.DoubleSide });
  M.cockpitGlass.emissive = new THREE.Color('#153246');
  M.cockpitGlass.emissiveIntensity = 0.35;
  M.windowFrame = M.phys({ color: '#d6dbe1', roughness: 0.30, metalness: 0.60, clearcoat: 0.4, clearcoatRoughness: 0.2 });
  M.frameDark = M.std({ color: '#0b0d10', roughness: 0.5, metalness: 0.4, side: THREE.DoubleSide });
  M.rubber = M.std({ color: '#17181b', roughness: 0.90, metalness: 0.0 });
  M.hub = M.std({ color: '#9aa0a6', roughness: 0.33, metalness: 0.88 });
  M.brake = M.std({ color: '#4a4e54', roughness: 0.45, metalness: 0.75 });
  M.strut = M.std({ color: '#c8ccd2', roughness: 0.30, metalness: 0.60 });
  M.chrome = M.std({ color: '#e2e6eb', roughness: 0.09, metalness: 1.0 });
  M.detail = M.std({ color: '#7e848b', roughness: 0.52, metalness: 0.40 });
  M.pipe = M.std({ color: '#5b6066', roughness: 0.40, metalness: 0.80 });
  M.intakeDark = M.std({ color: '#111316', roughness: 0.72, metalness: 0.15 });
  M.cascade = M.std({ color: '#8d939a', roughness: 0.40, metalness: 0.82 });
  M.well = M.std({ color: '#171a1e', roughness: 0.90, metalness: 0.10 });
  M.fanBlade = M.std({ color: '#c7ccd2', roughness: 0.16, metalness: 0.95 });
  M.fanHub = M.std({ color: '#b9bec4', roughness: 0.24, metalness: 0.90 });
  M.spinner = M.std({ color: '#e6e9ed', roughness: 0.18, metalness: 0.35 });
  M.slat = M.std({ color: '#c8ccd1', roughness: 0.22, metalness: 0.92 });
  M.core = M.std({ color: '#666b72', roughness: 0.50, metalness: 0.86 });

  M.lights = {
    navRed: new THREE.MeshStandardMaterial({ color: '#3a0202', emissive: '#ff2b2b', emissiveIntensity: 3.2, roughness: 0.3 }),
    navGreen: new THREE.MeshStandardMaterial({ color: '#02300d', emissive: '#25ff6a', emissiveIntensity: 3.2, roughness: 0.3 }),
    navWhite: new THREE.MeshStandardMaterial({ color: '#2b2b2b', emissive: '#ffffff', emissiveIntensity: 3.0, roughness: 0.3 }),
    strobe: new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#ffffff', emissiveIntensity: 6.0, roughness: 0.2 }),
    beacon: new THREE.MeshStandardMaterial({ color: '#3a0202', emissive: '#ff2020', emissiveIntensity: 4.5, roughness: 0.3 }),
    landing: new THREE.MeshStandardMaterial({ color: '#f2f4f6', emissive: '#fff6d8', emissiveIntensity: 5.0, roughness: 0.15, metalness: 0.4 }),
  };

  // shared normal map for the fuselage (shape detail is livery independent)
  const heightC = makeCanvas(1024, 2048, true);
  paintFuselageHeight(heightC.ctx, heightC.w, heightC.h);
  const fuselageNormal = normalMapFromHeight(heightC.canvas, 1.45);

  const disposeMap = (mat) => {
    if (!mat) return;
    for (const key of ['map', 'normalMap', 'roughnessMap', 'metalnessMap']) {
      if (mat[key] && mat[key].dispose) mat[key].dispose();
    }
  };

  M.setLivery = (index) => {
    const liv = LIVERIES[((index % LIVERIES.length) + LIVERIES.length) % LIVERIES.length];
    M.livery = liv;

    const CW = 2048, CH = 4096;
    const colorC = makeCanvas(CW, CH, true);
    paintFuselageColor(colorC.ctx, CW, CH, liv);
    const packC = makeCanvas(512, 1024, true);
    paintPacked(packC.ctx, packC.w, packC.h, liv);

    disposeMap(M.skin);
    M.skin = M.phys({
      map: tex(colorC.canvas, true, [1, 1], aniso),
      normalMap: tex(fuselageNormal, false, [1, 1], aniso),
      roughnessMap: tex(packC.canvas, false, [1, 1], aniso),
      metalnessMap: tex(packC.canvas, false, [1, 1], aniso),
      metalness: 1.0, roughness: 1.0, normalScale: new THREE.Vector2(0.42, 0.42),
      clearcoat: 0.66, clearcoatRoughness: 0.20, envMapIntensity: 0.95,
    });

    const finC = makeCanvas(1024, 1024, true);
    paintFin(finC.ctx, finC.w, finC.h, liv);
    disposeMap(M.finSkin);
    M.finSkin = M.phys({ map: tex(finC.canvas, true, [1, 1], aniso), roughness: 0.30, metalness: 0.20, clearcoat: 0.8, clearcoatRoughness: 0.15 });

    const wingC = makeCanvas(1024, 1024, true);
    paintPanelTile(wingC.ctx, wingC.w, wingC.h, liv.wingBase, 5);
    disposeMap(M.wingSkin);
    M.wingSkin = M.phys({ map: tex(wingC.canvas, true, [2, 5], aniso), roughness: 0.38, metalness: 0.26, clearcoat: 0.55, clearcoatRoughness: 0.24 });

    const panelC = makeCanvas(512, 512, true);
    paintPanelTile(panelC.ctx, panelC.w, panelC.h, liv.dark ? '#4a515c' : '#dfe2e6', 3);
    disposeMap(M.panel);
    M.panel = M.phys({ map: tex(panelC.canvas, true, [3, 3], aniso), roughness: 0.42, metalness: 0.28, clearcoat: 0.5 });

    const nacC = makeCanvas(1024, 512, true);
    paintMetalTile(nacC.ctx, nacC.w, nacC.h, liv.nacelle);
    disposeMap(M.nacelle);
    M.nacelle = M.phys({ map: tex(nacC.canvas, true, [4, 1], aniso), roughness: 0.32, metalness: 0.50, clearcoat: 0.4, clearcoatRoughness: 0.2, envMapIntensity: 0.9 });

    M.pylon = M.phys({ color: liv.base, roughness: 0.34, metalness: 0.25, clearcoat: 0.6 });
    M.door = M.phys({ color: liv.base, roughness: 0.36, metalness: 0.22, clearcoat: 0.7 });
    M.belly = M.std({ color: liv.belly, roughness: 0.45, metalness: 0.25 });
    M.finPaint = M.phys({ color: liv.fin, roughness: 0.32, metalness: 0.18, clearcoat: 0.75, clearcoatRoughness: 0.18 });

    // decal materials are regenerated by details.js on a livery change
    M.decal = (text, opts = {}) => decalMaterial(textCanvas(text, opts, liv), aniso, opts);
    M.decalCanvas = (canvas, opts = {}) => decalMaterial(canvas, aniso, opts);
    return liv;
  };

  M.setCabin = (on, intensity) => {
    M.glassWindow.emissiveIntensity = on ? (intensity === undefined ? 0.34 : intensity) : 0.03;
    M.glassWindow.needsUpdate = true;
  };

  M.applyEnv = (env) => {
    M.env = env;
    const keys = ['skin', 'finSkin', 'wingSkin', 'panel', 'nacelle', 'pylon', 'door', 'glassWindow',
      'cockpitGlass', 'chrome', 'fanBlade', 'core', 'belly', 'hub', 'brake', 'strut', 'detail', 'pipe',
      'intakeDark', 'cascade', 'well', 'fanHub', 'spinner', 'slat', 'windowFrame', 'finPaint'];
    for (const k of keys) {
      const m = M[k];
      if (m && m.isMeshStandardMaterial) { m.envMap = env; m.needsUpdate = true; }
    }
  };

  M.setLivery(0);
  return M;
}

// ------------------------------------------------------------------ decals
function textCanvas(text, opts = {}, liv = LIVERIES[0]) {
  const w = opts.w || 2048, h = opts.h || 420;
  const c = makeCanvas(w, h, true).canvas;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, w, h);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = opts.color || liv.accent;
  const sub = opts.sub;
  const titleSize = Math.round(h * (sub ? 0.52 : 0.66) * (opts.scale || 1));
  ctx.font = '900 ' + titleSize + 'px "Segoe UI", Arial, sans-serif';
  if ('letterSpacing' in ctx) ctx.letterSpacing = Math.round(titleSize * 0.055) + 'px';
  ctx.fillText(text, w / 2, sub ? h * 0.40 : h / 2);
  if (sub) {
    ctx.font = '600 ' + Math.round(h * 0.20) + 'px "Segoe UI", Arial, sans-serif';
    if ('letterSpacing' in ctx) ctx.letterSpacing = Math.round(h * 0.02) + 'px';
    ctx.fillStyle = opts.subColor || liv.accent2;
    ctx.fillText(sub, w / 2, h * 0.76);
  }
  if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
  return c;
}

function decalMaterial(canvas, aniso, opts = {}) {
  return new THREE.MeshPhysicalMaterial({
    map: canvasTexture(canvas, { srgb: true, aniso }),
    transparent: true, roughness: 0.30, metalness: 0.10, clearcoat: 0.6,
    depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2,
    ...opts.mat,
  });
}

function smoothstep(e0, e1, x) {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
}
