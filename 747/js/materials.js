// js/materials.js — procedural PBR materials and livery painting for the 747.
import * as THREE from '../lib/three.module.min.js';
import { makeCanvas, canvasTexture, normalMapFromHeight, clamp, lerp, TAU, roundRect, fbm } from './util.js';
import { FUSE, vOfX, thetaForY, WINDOW_X, UPPER_WINDOW_X, MAIN_DOOR_X, UPPER_DOOR_X, CARGO_DOORS } from './fuselage.js';

export const LIVERIES = [
  {
    id: 'skylark', name: 'Skylark Airways 1994', base: '#f4f5f7', belly: '#b7bcc4',
    accent: '#0b3d91', accent2: '#dcb45a', fin: '#0b3d91', finText: '#f6f7f9',
    title: 'SKYLARK', reg: 'N747SL', metal: 0.22, rough: 0.28, night: false, freighter: false,
  },
  {
    id: 'retro', name: 'Pacific Retro 1972', base: '#f7f3e9', belly: '#9aa0a6',
    accent: '#c0392b', accent2: '#e6c34a', fin: '#c0392b', finText: '#f7f3e9',
    title: 'PACIFIC', reg: 'N747PA', metal: 0.30, rough: 0.32, night: false, freighter: false,
  },
  {
    id: 'freight', name: 'Global Freight Cargo', base: '#e9ebed', belly: '#8c929a',
    accent: '#1f6f4a', accent2: '#c9ced4', fin: '#1f6f4a', finText: '#f2f4f5',
    title: 'GLOBAL', reg: 'N747GF', metal: 0.18, rough: 0.42, night: false, freighter: true,
  },
  {
    id: 'night', name: 'Night Ops Charter', base: '#2c3138', belly: '#1a1d22',
    accent: '#c8102e', accent2: '#9aa0a8', fin: '#15181c', finText: '#e8eaee',
    title: 'NIGHT OPS', reg: 'N747NO', metal: 0.42, rough: 0.34, night: true, freighter: false,
  },
];

// ------------------------------------------------------------------ helpers
const pxTheta = (theta, W) => (theta / TAU) * W;
const pyX = (x, H) => (1 - vOfX(x)) * H;
const pxPerRad = (W) => W / TAU;
const pxPerM = (H) => H / FUSE.len;

function sideCtx(ctx, x0, w, mirrored) {
  ctx.save();
  ctx.translate(x0, 0);
  if (mirrored) { ctx.translate(w, 0); ctx.scale(-1, 1); }
  return () => ctx.restore();
}

// ------------------------------------------------------------------ fuselage paint
function paintFuselageColor(ctx, W, H, liv) {
  const sx = pxPerRad(W), sy = pxPerM(H);
  ctx.fillStyle = liv.base;
  ctx.fillRect(0, 0, W, H);

  // belly wash: grey underside, strongest at the keel, fading at both waterlines
  const g = ctx.createLinearGradient(0.5 * W, 0, W, 0);
  g.addColorStop(0, liv.base); g.addColorStop(0.22, liv.belly);
  g.addColorStop(0.5, liv.belly); g.addColorStop(0.78, liv.belly); g.addColorStop(1, liv.base);
  ctx.fillStyle = g;
  ctx.fillRect(0.5 * W, 0, 0.5 * W, H);

  // cheatline through the window line on both sides: accent band plus a thin gold pin
  for (const th of [0.105 * TAU, 0.395 * TAU]) {
    const cx = pxTheta(th, W);
    const pyNose = pyX(28.6, H), pyTail = pyX(-32.0, H);
    ctx.fillStyle = liv.accent;
    const steps = 160;
    for (let i = 0; i < steps; i++) {
      const y0 = pyNose + ((pyTail - pyNose) * i) / steps;
      const y1 = pyNose + ((pyTail - pyNose) * (i + 1)) / steps;
      const f = clamp((y0 - pyNose) / (0.06 * H), 0, 1);       // taper into the nose
      const g2 = clamp((pyTail - y0) / (0.03 * H), 0, 1);      // taper out at the tail
      const k = Math.min(f, g2);
      if (k <= 0.01) continue;
      ctx.fillRect(cx - 0.15 * sx * k, y0, 0.30 * sx * k, y1 - y0 + 1);
    }
    ctx.fillStyle = liv.accent2;
    ctx.fillRect(cx + 0.155 * sx, pyNose, 0.055 * sx, pyTail - pyNose);
    ctx.fillRect(cx - 0.21 * sx, pyNose, 0.05 * sx, pyTail - pyNose);
  }

  // nose radome: slightly darker, with lightning diverter strips
  const nosePy = pyX(FUSE.noseX - 1.35, H);
  ctx.fillStyle = 'rgba(160,166,175,0.55)';
  ctx.fillRect(0, nosePy, W, H - nosePy);
  ctx.strokeStyle = 'rgba(60,64,70,0.5)';
  ctx.lineWidth = Math.max(1, W / 900);
  ctx.strokeRect(0, nosePy, W, H - nosePy);
  for (let i = 0; i <= 13; i++) {
    const th = Math.PI / 2 + (i - 6.5) * 0.105;
    const px = pxTheta(th, W);
    ctx.fillStyle = 'rgba(74,78,84,0.5)';
    ctx.fillRect(px, nosePy, Math.max(1, W / 1600), (H - nosePy) * 0.62);
  }

  // frame lines (circumferential joints) and stringers
  ctx.lineWidth = 1;
  for (let x = 28.5; x > -33; x -= 0.52) {
    const py = pyX(x, H);
    ctx.fillStyle = 'rgba(90,95,102,0.10)';
    ctx.fillRect(0, py, W, Math.max(1, sy * 0.035));
  }
  for (const th of [0.045, 0.115, 0.205, 0.295, 0.455, 0.545, 0.635, 0.725, 0.795, 0.885, 0.955]) {
    ctx.fillStyle = 'rgba(90,95,102,0.08)';
    ctx.fillRect(pxTheta(th * TAU, W), 0, Math.max(1, sx * 0.02), H);
  }

  // rivets along the frames
  ctx.fillStyle = 'rgba(80,85,92,0.20)';
  const rivetStep = 0.055;
  for (let x = 28.5; x > -33; x -= 0.52) {
    const py = pyX(x, H);
    for (let th = 0; th < TAU; th += rivetStep / FUSE.R) {
      ctx.fillRect(pxTheta(th, W), py - sy * 0.05, 1, 1);
    }
  }

  // cabin windows: recessed frame painted around each glass tile
  const cabin = liv.freighter ? [] : WINDOW_X;
  for (const x of cabin) {
    for (const star of [true, false]) {
      const th = star ? thetaForY(x, FUSE.deckY, true) : thetaForY(x, FUSE.deckY, false);
      const cx = pxTheta(th, W), cy = pyX(x, H);
      ctx.fillStyle = 'rgba(40,44,50,0.55)';
      roundRect(ctx, cx - 0.17 * sx, cy - 0.25 * sy, 0.34 * sx, 0.50 * sy, 0.05 * sx);
      ctx.fill();
      ctx.fillStyle = '#0b0e13';
      roundRect(ctx, cx - 0.145 * sx, cy - 0.215 * sy, 0.29 * sx, 0.43 * sy, 0.04 * sx);
      ctx.fill();
    }
  }
  for (const x of UPPER_WINDOW_X) {
    if (liv.freighter) break;
    for (const star of [true, false]) {
      const th = star ? thetaForY(x, FUSE.upperY, true) : thetaForY(x, FUSE.upperY, false);
      const cx = pxTheta(th, W), cy = pyX(x, H);
      ctx.fillStyle = '#0b0e13';
      roundRect(ctx, cx - 0.16 * sx, cy - 0.21 * sy, 0.32 * sx, 0.42 * sy, 0.04 * sx);
      ctx.fill();
    }
  }

  // doors: outline, handle, window, number
  const doorPx = 1.07, doorH = 1.93, doorY = 1.32;
  MAIN_DOOR_X.forEach((x, i) => {
    for (const star of [true, false]) {
      const thTop = star ? thetaForY(x, doorY + doorH / 2, true) : thetaForY(x, doorY + doorH / 2, false);
      const thBot = star ? thetaForY(x, doorY - doorH / 2, true) : thetaForY(x, doorY - doorH / 2, false);
      const cx = pxTheta((thTop + thBot) / 2, W), cy = pyX(x, H);
      const halfArcPx = Math.abs((thTop - thBot) / 2) * sx;
      ctx.strokeStyle = 'rgba(255,255,255,0.55)';
      ctx.lineWidth = Math.max(1.5, sx * 0.018);
      roundRect(ctx, cx - halfArcPx - 2, cy - (doorPx / 2) * sy, halfArcPx * 2 + 4, doorPx * sy, 0.10 * sx);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(30,34,40,0.35)';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = '#12161c';
      const wpx = 0.26 * sx, wsp = 0.34 * sy;
      ctx.fillRect(cx - wpx / 2, cy - 0.60 * sy, wpx, wsp);
      ctx.fillStyle = liv.accent;
      ctx.font = 'bold ' + Math.round(sy * 0.34) + 'px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(String(i + 1), cx, cy + 0.62 * sy);
      ctx.textAlign = 'left';
    }
  });
  // upper deck door
  if (!liv.freighter) {
    const th = thetaForY(UPPER_DOOR_X, 3.55, true), th2 = thetaForY(UPPER_DOOR_X, 3.55, false);
    for (const t of [th, th2]) {
      const cx = pxTheta(t, W), cy = pyX(UPPER_DOOR_X, H);
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth = Math.max(1.5, sx * 0.016);
      roundRect(ctx, cx - 0.15 * sx, cy - 0.55 * sy, 0.30 * sx, 1.1 * sy, 0.06 * sx);
      ctx.stroke();
    }
  }

  // cargo doors: lighter panel with a heavy outline
  for (const d of CARGO_DOORS) {
    const star = d.side === 'S';
    const th = star ? thetaForY(d.x, d.yc, true) : thetaForY(d.x, d.yc, false);
    const cx = pxTheta(th, W), cy = pyX(d.x, H);
    ctx.fillStyle = 'rgba(210,213,218,0.55)';
    ctx.fillRect(cx - (d.h / 2 / FUSE.R) * sx, cy - (d.w / 2) * sy, (d.h / FUSE.R) * sx, d.w * sy);
    ctx.strokeStyle = 'rgba(40,44,50,0.55)';
    ctx.lineWidth = Math.max(1.5, sx * 0.02);
    ctx.strokeRect(cx - (d.h / 2 / FUSE.R) * sx, cy - (d.w / 2) * sy, (d.h / FUSE.R) * sx, d.w * sy);
  }

  // weathering: exhaust soot near the tail, dirt streaks underneath
  for (let i = 0; i < 900; i++) {
    const x = -18 - Math.random() * 16;
    const th = Math.random() * TAU;
    const py = pyX(x, H), px = pxTheta(th, W);
    const a = 0.05 * Math.random() * clamp((py - pyX(-18, H)) / (pyX(-33, H) - pyX(-18, H)), 0, 1);
    ctx.fillStyle = 'rgba(30,30,32,' + a.toFixed(3) + ')';
    ctx.fillRect(px, py, sx * 0.02 * (1 + Math.random() * 4), sy * (0.2 + Math.random()));
  }
  for (let i = 0; i < 1200; i++) {
    const th = (0.6 + Math.random() * 0.8) % 1;
    const x = 30 - Math.random() * 62;
    ctx.fillStyle = 'rgba(120,124,130,' + (0.05 * Math.random()).toFixed(3) + ')';
    ctx.fillRect(th * W, pyX(x, H), 2, sy * (0.3 + Math.random() * 2));
  }
}

function paintFuselageHeight(ctx, W, H, liv) {
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, W, H);
  const sx = pxPerRad(W), sy = pxPerM(H);
  // panel grooves
  for (let x = 28.5; x > -33; x -= 0.52) {
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, pyX(x, H) - Math.max(1, sy * 0.01), W, Math.max(1, sy * 0.022));
  }
  for (const th of [0.045, 0.115, 0.205, 0.295, 0.455, 0.545, 0.635, 0.725, 0.795, 0.885, 0.955]) {
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(pxTheta(th * TAU, W), 0, Math.max(1, sx * 0.012), H);
  }
  // doors and hatches sit slightly proud
  const cabin = liv.freighter ? [] : WINDOW_X;
  for (const x of cabin) {
    for (const star of [true, false]) {
      const th = star ? thetaForY(x, FUSE.deckY, true) : thetaForY(x, FUSE.deckY, false);
      ctx.fillStyle = 'rgba(0,0,0,0.75)';
      roundRect(ctx, pxTheta(th, W) - 0.145 * sx, pyX(x, H) - 0.215 * sy, 0.29 * sx, 0.43 * sy, 0.04 * sx);
      ctx.fill();
    }
  }
  for (const x of MAIN_DOOR_X) {
    for (const star of [true, false]) {
      const th = star ? thetaForY(x, 1.32, true) : thetaForY(x, 1.32, false);
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth = Math.max(2, sy * 0.05);
      ctx.strokeRect(pxTheta(th, W) - 0.18 * sx, pyX(x, H) - 1.0 * sy, 0.36 * sx, 2.0 * sy);
    }
  }
  // surface waviness
  const img = ctx.getImageData(0, 0, W, H);
  const d = img.data;
  for (let y = 0; y < H; y += 2) {
    for (let x = 0; x < W; x += 2) {
      const n = (fbm(x * 0.05, y * 0.05, 3, 7) - 0.5) * 26;
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
  // G = roughness, B = metalness
  const img = ctx.createImageData(W, H);
  const d = img.data;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      const n = fbm(x * 0.08, y * 0.08, 4, 21);
      const streak = fbm(x * 0.6, y * 0.02, 2, 5);
      const rough = clamp(liv.rough + (n - 0.5) * 0.16 + (streak - 0.5) * 0.12, 0.05, 0.95);
      const metal = clamp(liv.metal + (n - 0.5) * 0.12, 0.0, 1.0);
      d[i] = 255;
      d[i + 1] = Math.round(rough * 255);
      d[i + 2] = Math.round(metal * 255);
      d[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
}

// ------------------------------------------------------------------ fin paint
function paintFin(ctx, W, H, liv) {
  ctx.fillStyle = liv.fin;
  ctx.fillRect(0, 0, W, H);
  const drawSide = (x0, w, mirrored) => {
    const done = sideCtx(ctx, x0, w, mirrored);
    // sweep-shaped accent swoosh
    ctx.beginPath();
    ctx.moveTo(0, H);
    ctx.lineTo(w * 0.55, H);
    ctx.quadraticCurveTo(w * 0.78, H * 0.55, w * 0.95, H * 0.12);
    ctx.lineTo(w, H * 0.30);
    ctx.quadraticCurveTo(w * 0.70, H * 0.72, w * 0.5, H);
    ctx.closePath();
    ctx.fillStyle = liv.accent2;
    ctx.fill();
    ctx.fillStyle = liv.finText;
    ctx.font = 'bold ' + Math.round(H * 0.115) + 'px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(liv.title, w * 0.45, H * 0.50);
    ctx.font = 'bold ' + Math.round(H * 0.075) + 'px Arial';
    ctx.fillStyle = 'rgba(255,255,255,0.82)';
    ctx.fillText(liv.reg, w * 0.45, H * 0.60);
    ctx.textAlign = 'left';
    done();
  };
  // the fin UV loop runs tail-to-nose on the port side and nose-to-tail on the
  // starboard side, so both halves must be mirrored for the titles to read correctly
  drawSide(0, W / 2, true);
  drawSide(W / 2, W / 2, true);
  // leading-edge de-ice boot
  const grad = ctx.createLinearGradient(0, 0, W * 0.06, 0);
  grad.addColorStop(0, 'rgba(0,0,0,0.55)'); grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W * 0.06, H);
  ctx.fillRect(W / 2, 0, W * 0.06, H);
}

// ------------------------------------------------------------------ wing / panel tiles
function paintPanelTile(ctx, W, H, liv, opts = {}) {
  const base = opts.base || liv.base;
  const line = opts.line || 'rgba(70,74,82,0.35)';
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, W, H);
  const cells = opts.cells || 6;
  ctx.strokeStyle = line;
  ctx.lineWidth = Math.max(1.5, W / 700);
  for (let i = 1; i < cells; i++) {
    const x = (i / cells) * W;
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
  }
  for (let i = 1; i < cells * 2; i++) {
    const y = (i / (cells * 2)) * H;
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
  }
  ctx.fillStyle = 'rgba(80,84,90,0.25)';
  for (let i = 0; i <= cells; i++) {
    const x = (i / cells) * W;
    for (let y = 0; y < H; y += Math.max(3, H / 240)) {
      ctx.fillRect(x - 1, y, 1.5, 1.5);
    }
  }
  // scuffs and fuel stains
  for (let i = 0; i < 260; i++) {
    const x = Math.random() * W, y = Math.random() * H;
    const r = 2 + Math.random() * 26;
    ctx.fillStyle = 'rgba(40,42,46,' + (0.02 + Math.random() * 0.05).toFixed(3) + ')';
    ctx.beginPath(); ctx.ellipse(x, y, r, r * (0.2 + Math.random() * 0.8), Math.random() * 3, 0, TAU); ctx.fill();
  }
}

function paintMetalTile(ctx, W, H, tint) {
  ctx.fillStyle = tint;
  ctx.fillRect(0, 0, W, H);
  for (let y = 0; y < H; y++) {
    const n = fbm(0, y * 0.4, 3, 11);
    ctx.fillStyle = 'rgba(255,255,255,' + (n * 0.06).toFixed(3) + ')';
    ctx.fillRect(0, y, W, 1);
  }
  ctx.strokeStyle = 'rgba(0,0,0,0.10)';
  ctx.lineWidth = 1;
  for (let i = 1; i < 8; i++) { ctx.beginPath(); ctx.moveTo((i / 8) * W, 0); ctx.lineTo((i / 8) * W, H); ctx.stroke(); }
}

function tex(canvas, srgb, rep, aniso) {
  return canvasTexture(canvas, { srgb: !!srgb, repeat: rep || [1, 1], aniso: aniso || 8 });
}

// ------------------------------------------------------------------ material set
export function createMaterials(renderer) {
  const aniso = renderer ? renderer.capabilities.getMaxAnisotropy() : 8;
  const M = { aniso, env: null };

  M.std = (o) => new THREE.MeshStandardMaterial(o);
  M.phys = (o) => new THREE.MeshPhysicalMaterial(o);

  M.glassWindow = M.phys({ color: '#05070b', roughness: 0.06, metalness: 0.05, clearcoat: 1, clearcoatRoughness: 0.04, envMapIntensity: 1.6 });
  M.cockpitGlass = M.phys({ color: '#0a1018', roughness: 0.04, metalness: 0.10, clearcoat: 1, clearcoatRoughness: 0.03, envMapIntensity: 2.0 });
  M.rubber = M.std({ color: '#17181b', roughness: 0.88, metalness: 0.0 });
  M.hub = M.std({ color: '#9aa0a6', roughness: 0.35, metalness: 0.85 });
  M.brake = M.std({ color: '#4a4e54', roughness: 0.45, metalness: 0.75 });
  M.strut = M.std({ color: '#c8ccd2', roughness: 0.32, metalness: 0.55 });
  M.chrome = M.std({ color: '#dfe3e8', roughness: 0.10, metalness: 1.0 });
  M.detail = M.std({ color: '#7e848b', roughness: 0.55, metalness: 0.35 });
  M.pipe = M.std({ color: '#5b6066', roughness: 0.4, metalness: 0.8 });
  M.intakeDark = M.std({ color: '#15171a', roughness: 0.7, metalness: 0.2 });
  M.cascade = M.std({ color: '#8d939a', roughness: 0.42, metalness: 0.8 });
  M.well = M.std({ color: '#1c1f23', roughness: 0.85, metalness: 0.15 });
  M.fanBlade = M.std({ color: '#cfd4da', roughness: 0.16, metalness: 0.95 });
  M.fanHub = M.std({ color: '#b9bec4', roughness: 0.25, metalness: 0.9 });
  M.spinner = M.std({ color: '#e6e9ed', roughness: 0.2, metalness: 0.3 });

  M.lights = {
    navRed: new THREE.MeshStandardMaterial({ color: '#3a0202', emissive: '#ff2b2b', emissiveIntensity: 3.2, roughness: 0.3 }),
    navGreen: new THREE.MeshStandardMaterial({ color: '#02300d', emissive: '#25ff6a', emissiveIntensity: 3.2, roughness: 0.3 }),
    navWhite: new THREE.MeshStandardMaterial({ color: '#2b2b2b', emissive: '#ffffff', emissiveIntensity: 3.0, roughness: 0.3 }),
    strobe: new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#ffffff', emissiveIntensity: 6.0, roughness: 0.2 }),
    beacon: new THREE.MeshStandardMaterial({ color: '#3a0202', emissive: '#ff2020', emissiveIntensity: 4.5, roughness: 0.3 }),
    landing: new THREE.MeshStandardMaterial({ color: '#f2f4f6', emissive: '#fff6d8', emissiveIntensity: 5.0, roughness: 0.15, metalness: 0.4 }),
  };

  M.setLivery = (index) => {
    const liv = LIVERIES[index % LIVERIES.length];
    M.livery = liv;

    // ---- fuselage texture stack
    const CW = 2048, CH = 4096;
    const colorC = makeCanvas(CW, CH, true), heightC = makeCanvas(1024, 2048, true), packC = makeCanvas(512, 1024, true);
    paintFuselageColor(colorC.ctx, CW, CH, liv);
    paintFuselageHeight(heightC.ctx, heightC.w, heightC.h, liv);
    paintPacked(packC.ctx, packC.w, packC.h, liv);

    const colorTex = tex(colorC.canvas, true, [1, 1], aniso);
    const normalTex = tex(normalMapFromHeight(heightC.canvas, 1.7), false, [1, 1], aniso);
    const packTex = tex(packC.canvas, false, [1, 1], aniso);

    if (M.skin) { M.skin.map.dispose(); M.skin.normalMap.dispose(); M.skin.roughnessMap.dispose(); }
    M.skin = M.phys({
      map: colorTex, normalMap: normalTex, roughnessMap: packTex, metalnessMap: packTex,
      metalness: 1.0, roughness: 1.0, normalScale: new THREE.Vector2(0.55, 0.55),
      clearcoat: 0.62, clearcoatRoughness: 0.22, envMapIntensity: 0.9,
    });

    // ---- fin texture
    const finC = makeCanvas(1024, 1024, true);
    paintFin(finC.ctx, finC.w, finC.h, liv);
    if (M.finSkin) M.finSkin.map.dispose();
    M.finSkin = M.phys({ map: tex(finC.canvas, true, [1, 1], aniso), roughness: 0.3, metalness: 0.18, clearcoat: 0.8, clearcoatRoughness: 0.15 });

    // ---- painted wing / panel surfaces
    const wingC = makeCanvas(1024, 1024, true);
    paintPanelTile(wingC.ctx, wingC.w, wingC.h, liv, { base: liv.base === '#2c3138' ? '#3a404a' : '#eef0f3', cells: 5 });
    if (M.wingSkin) M.wingSkin.map.dispose();
    const wingTex = tex(wingC.canvas, true, [2, 6], aniso);
    M.wingSkin = M.phys({
      map: wingTex, roughness: 0.34, metalness: 0.22, clearcoat: 0.7, clearcoatRoughness: 0.2,
    });

    const panelC = makeCanvas(512, 512, true);
    paintPanelTile(panelC.ctx, panelC.w, panelC.h, liv, { base: liv.base === '#2c3138' ? '#4a515c' : '#dfe2e6', cells: 3 });
    if (M.panel) M.panel.map.dispose();
    M.panel = M.phys({ map: tex(panelC.canvas, true, [3, 3], aniso), roughness: 0.4, metalness: 0.25, clearcoat: 0.5 });

    const nacC = makeCanvas(1024, 512, true);
    paintMetalTile(nacC.ctx, nacC.w, nacC.h, liv.base === '#2c3138' ? '#5c626b' : '#cfd3d8');
    if (M.nacelle) M.nacelle.map.dispose();
    M.nacelle = M.phys({ map: tex(nacC.canvas, true, [4, 1], aniso), roughness: 0.34, metalness: 0.52, clearcoat: 0.35, clearcoatRoughness: 0.22, envMapIntensity: 0.85 });

    M.core = M.std({ color: '#666b72', roughness: 0.52, metalness: 0.85, envMapIntensity: 0.7 });
    M.pylon = M.phys({ color: liv.base === '#2c3138' ? '#3d434c' : '#e2e5e9', roughness: 0.34, metalness: 0.25, clearcoat: 0.6 });
    M.belly = M.std({ color: liv.belly, roughness: 0.45, metalness: 0.25 });
    M.door = M.phys({ color: liv.base, roughness: 0.36, metalness: 0.22, clearcoat: 0.7 });
    M.finPaint = M.phys({ color: liv.fin, roughness: 0.32, metalness: 0.16, clearcoat: 0.75, clearcoatRoughness: 0.18 });

    // ---- decals
    M.decal = (text, opts = {}) => {
      const w = opts.w || 1024, h = opts.h || 256;
      const c = makeCanvas(w, h, true).canvas;
      const ctx = c.getContext('2d');
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = opts.color || liv.accent;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const sub = opts.sub;
      ctx.font = 'bold ' + Math.round(h * (opts.scale || (sub ? 0.44 : 0.62))) + 'px Arial';
      ctx.fillText(text, w / 2, sub ? h * 0.36 : h / 2);
      if (sub) {
        ctx.font = '600 ' + Math.round(h * 0.24) + 'px Arial';
        ctx.fillStyle = opts.subColor || liv.accent2;
        ctx.fillText(sub, w / 2, h * 0.76);
      }
      return decalMaterial(c, aniso, opts);
    };

    if (M.env) M.applyEnv(M.env);
    return liv;
  };

  M.applyEnv = (env) => {
    M.env = env;
    const keys = ['skin', 'finSkin', 'wingSkin', 'panel', 'nacelle', 'pylon', 'door',
      'glassWindow', 'cockpitGlass', 'chrome', 'fanBlade', 'core', 'belly', 'hub', 'brake',
      'strut', 'detail', 'pipe', 'intakeDark', 'cascade', 'well', 'fanHub', 'spinner'];
    for (const k of keys) {
      const m = M[k];
      if (m && m.isMeshStandardMaterial) { m.envMap = env; m.needsUpdate = true; }
    }
  };

  M.setNight = (on) => {
    M.glassWindow.emissive = new THREE.Color(on ? '#ffd9a0' : '#000000');
    M.glassWindow.emissiveIntensity = on ? 1.1 : 0;
    M.glassWindow.needsUpdate = true;
  };

  return M;
}

function decalMaterial(canvas, aniso, opts = {}) {
  return new THREE.MeshPhysicalMaterial({
    map: canvasTexture(canvas, { srgb: true, aniso }),
    transparent: true, roughness: 0.3, metalness: 0.1, clearcoat: 0.6,
    depthWrite: false, side: THREE.DoubleSide, ...opts.mat,
  });
}
