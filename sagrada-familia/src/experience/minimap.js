// Tasteful top-down plan of the temple for the HUD map panel.
// World +X is east (right), +Z is south (down). North (-Z) is up.

const EXTENT = 150; // world metres from centre to edge of the plan

export function createMinimap({ DIM, TOUR, canvas, getPlayer, onSelectStop }) {
  const g = canvas.getContext('2d');
  let width = 300;
  let height = 300;
  let dpr = 1;
  let markers = [];
  let visible = false;
  let lastPlayer = { x: 0, z: 0, yaw: 0 };
  let currentStopId = null;

  const colors = {
    bg0: 'rgba(10, 13, 20, 0.92)',
    bg1: 'rgba(23, 26, 31, 0.86)',
    ink: 'rgba(241, 232, 214, 0.9)',
    dim: 'rgba(241, 232, 214, 0.42)',
    faint: 'rgba(241, 232, 214, 0.16)',
    line: 'rgba(241, 232, 214, 0.22)',
    gold: '#d9b25e',
    goldSoft: 'rgba(217, 178, 94, 0.5)',
    teal: '#73b6ad',
    stone: 'rgba(203, 185, 160, 0.2)',
    stoneEdge: 'rgba(203, 185, 160, 0.55)',
  };

  function resize() {
    const rect = canvas.getBoundingClientRect();
    width = Math.max(120, Math.round(rect.width || canvas.clientWidth || 300));
    height = Math.max(120, Math.round(rect.height || canvas.clientHeight || width));
    const size = Math.min(width, height);
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    // The plan is drawn in a square logical space, centred in the panel.
    const padX = (width - size) / 2;
    const padY = (height - size) / 2;
    g.setTransform(dpr, 0, 0, dpr, padX * dpr, padY * dpr);
    canvas._sfSize = size;
    canvas._sfPadX = padX;
    canvas._sfPadY = padY;
  }

  function project(x, z) {
    const size = canvas._sfSize || Math.min(width, height);
    const scale = size / (EXTENT * 2);
    return {
      x: size / 2 + x * scale,
      y: size / 2 + z * scale,
      scale,
    };
  }

  function drawRing(cx, cy, r, stroke, lw = 1, dash = null) {
    g.save();
    g.beginPath();
    g.strokeStyle = stroke;
    g.lineWidth = lw;
    if (dash) g.setLineDash(dash);
    g.arc(cx, cy, r, 0, Math.PI * 2);
    g.stroke();
    g.restore();
  }

  function drawFootprint(cx, cy, scale) {
    const x = (wx) => cx + wx * scale;
    const y = (wz) => cy + wz * scale;
    const hw = DIM.naveWallOuterX;
    const naveHalf = DIM.naveHalfLength;
    const transHalf = DIM.transeptHalfLength;
    const transW = DIM.transeptHalfWidth;

    g.save();
    g.fillStyle = colors.stone;
    g.strokeStyle = colors.stoneEdge;
    g.lineWidth = 1.1;

    // Nave body (z = -45 .. 45).
    g.beginPath();
    g.rect(x(-hw), y(-naveHalf), x(hw) - x(-hw), y(naveHalf) - y(-naveHalf));
    g.fill();
    g.stroke();

    // Transept (x = -30 .. 30).
    g.beginPath();
    g.rect(x(-transHalf), y(-transW), x(transHalf) - x(-transHalf), y(transW) - y(-transW));
    g.fill();
    g.stroke();

    // Apse: half disc beyond z = -45.
    g.beginPath();
    g.arc(x(0), y(-naveHalf), DIM.apseOuterRadius * scale, Math.PI, Math.PI * 2);
    g.closePath();
    g.fill();
    g.stroke();

    // Crossing emphasis.
    g.strokeStyle = colors.goldSoft;
    g.lineWidth = 1;
    g.strokeRect(x(-transW), y(-transW), (x(transW) - x(-transW)) || 1, y(transW) - y(-transW));

    // Façade traces.
    g.strokeStyle = colors.line;
    g.lineWidth = 1.4;
    // Glory (south, z = +45) spans x -24..24.
    g.beginPath();
    g.moveTo(x(-DIM.gloryHalfWidth), y(DIM.facadeInner.gloryZ));
    g.lineTo(x(DIM.gloryHalfWidth), y(DIM.facadeInner.gloryZ));
    g.stroke();
    // Nativity (east, x = +30) spans z -24..24.
    g.beginPath();
    g.moveTo(x(DIM.facadeInner.nativityX), y(-DIM.facadeHalfWidth));
    g.lineTo(x(DIM.facadeInner.nativityX), y(DIM.facadeHalfWidth));
    g.stroke();
    // Passion (west, x = -30).
    g.beginPath();
    g.moveTo(x(DIM.facadeInner.passionX), y(-DIM.facadeHalfWidth));
    g.lineTo(x(DIM.facadeInner.passionX), y(DIM.facadeHalfWidth));
    g.stroke();

    // Door ticks.
    g.strokeStyle = colors.goldSoft;
    g.lineWidth = 2;
    const doorTicks = [
      [0, DIM.facadeInner.gloryZ, 0],
      [DIM.facadeInner.nativityX, 0, Math.PI / 2],
      [DIM.facadeInner.passionX, 0, Math.PI / 2],
    ];
    for (const [dx, dz, rot] of doorTicks) {
      g.save();
      g.translate(x(dx), y(dz));
      g.rotate(rot);
      g.beginPath();
      g.moveTo(0, -4);
      g.lineTo(0, 4);
      g.stroke();
      g.restore();
    }
    g.restore();
  }

  function drawTowers(cx, cy, scale) {
    const x = (wx) => cx + wx * scale;
    const y = (wz) => cy + wz * scale;
    g.save();
    // Apostle towers — small gold points.
    for (const t of DIM.apostleTowers) {
      g.fillStyle = colors.gold;
      g.beginPath();
      g.arc(x(t.x), y(t.z), 2.1, 0, Math.PI * 2);
      g.fill();
    }
    // Evangelist towers — teal rings.
    for (const t of DIM.evangelistTowers) {
      g.strokeStyle = colors.teal;
      g.lineWidth = 1.3;
      g.beginPath();
      g.arc(x(t.x), y(t.z), 3.2, 0, Math.PI * 2);
      g.stroke();
      g.fillStyle = 'rgba(115, 182, 173, 0.28)';
      g.fill();
    }
    // Virgin tower + star.
    g.fillStyle = colors.teal;
    g.beginPath();
    g.arc(x(DIM.virginTower.x), y(DIM.virginTower.z), 2.4, 0, Math.PI * 2);
    g.fill();
    // Tower of Jesus — a four-pointed star.
    const jx = x(DIM.jesusTower.x);
    const jy = y(DIM.jesusTower.z);
    g.fillStyle = colors.gold;
    g.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
      const r = i % 2 === 0 ? 5 : 1.8;
      const px = jx + Math.cos(a) * r;
      const py = jy + Math.sin(a) * r;
      if (i === 0) g.moveTo(px, py);
      else g.lineTo(px, py);
    }
    g.closePath();
    g.fill();
    g.restore();
  }

  function drawTourStops(cx, cy, scale) {
    markers = [];
    if (!Array.isArray(TOUR)) return;
    g.save();
    for (let i = 0; i < TOUR.length; i++) {
      const stop = TOUR[i];
      if (!stop || !Array.isArray(stop.pos)) continue;
      const px = cx + stop.pos[0] * scale;
      const py = cy + stop.pos[2] * scale;
      const isCurrent = stop.id === currentStopId;
      markers.push({ id: stop.id, x: px, y: py, title: stop.title });
      g.beginPath();
      g.arc(px, py, isCurrent ? 4.2 : 3.1, 0, Math.PI * 2);
      g.fillStyle = isCurrent ? 'rgba(217, 178, 94, 0.9)' : 'rgba(11, 14, 20, 0.85)';
      g.fill();
      g.strokeStyle = isCurrent ? '#f0d27a' : colors.goldSoft;
      g.lineWidth = isCurrent ? 1.6 : 1.1;
      g.stroke();
      if (isCurrent) {
        g.beginPath();
        g.arc(px, py, 7.5, 0, Math.PI * 2);
        g.strokeStyle = 'rgba(217, 178, 94, 0.4)';
        g.lineWidth = 1;
        g.stroke();
      }
      g.fillStyle = isCurrent ? '#1a1c22' : colors.dim;
      g.font = '7px "Segoe UI", system-ui, sans-serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(String(i + 1), px, py + 0.5);
    }
    g.restore();
  }

  function drawPlayer(cx, cy, scale) {
    const p = lastPlayer;
    const px = cx + p.x * scale;
    const py = cy + p.z * scale;
    g.save();
    g.translate(px, py);
    // Forward in world: (-sin yaw, -cos yaw) => screen (-sin, -cos).
    const fx = -Math.sin(p.yaw);
    const fz = -Math.cos(p.yaw);
    g.rotate(Math.atan2(fx, -fz));
    g.beginPath();
    g.moveTo(0, -7.5);
    g.lineTo(5, 5.5);
    g.lineTo(0, 3);
    g.lineTo(-5, 5.5);
    g.closePath();
    g.fillStyle = colors.teal;
    g.shadowColor = 'rgba(115, 182, 173, 0.8)';
    g.shadowBlur = 8;
    g.fill();
    g.shadowBlur = 0;
    g.strokeStyle = 'rgba(10, 13, 20, 0.8)';
    g.lineWidth = 1;
    g.stroke();
    g.restore();
  }

  function drawLabels(cx, cy, scale) {
    g.save();
    g.font = '7px "Segoe UI", system-ui, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillStyle = 'rgba(241, 232, 214, 0.34)';
    const label = (text, x, z) => {
      g.fillText(text, cx + x * scale, cy + z * scale);
    };
    label('GLORY', 0, 64);
    label('NATIVITY', 52, 0);
    label('PASSION', -52, 0);
    label('APSE', 0, -76);
    // North indicator.
    g.fillStyle = 'rgba(241, 232, 214, 0.55)';
    g.font = '8px "Segoe UI", system-ui, sans-serif';
    g.fillText('N', cx, 12);
    g.strokeStyle = 'rgba(241, 232, 214, 0.35)';
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(cx, 18);
    g.lineTo(cx, 27);
    g.moveTo(cx - 3, 22);
    g.lineTo(cx, 18);
    g.lineTo(cx + 3, 22);
    g.stroke();
    g.restore();
  }

  function render() {
    if (!canvas._sfSize) resize();
    const size = canvas._sfSize || Math.min(width, height);
    const cx = size / 2;
    const cy = size / 2;
    const scale = size / (EXTENT * 2);

    // Background wash.
    const bg = g.createRadialGradient(cx, cy, 10, cx, cy, size * 0.72);
    bg.addColorStop(0, colors.bg1);
    bg.addColorStop(1, colors.bg0);
    g.fillStyle = bg;
    g.fillRect(0, 0, size, size);

    // Plaza ring + faint metre rings.
    drawRing(cx, cy, DIM.plazaRadius * scale, 'rgba(241, 232, 214, 0.2)', 1.2);
    drawRing(cx, cy, 50 * scale, 'rgba(241, 232, 214, 0.07)', 1);
    drawRing(cx, cy, 100 * scale, 'rgba(241, 232, 214, 0.07)', 1);
    g.strokeStyle = 'rgba(241, 232, 214, 0.06)';
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(cx - EXTENT * scale, cy);
    g.lineTo(cx + EXTENT * scale, cy);
    g.moveTo(cx, cy - EXTENT * scale);
    g.lineTo(cx, cy + EXTENT * scale);
    g.stroke();

    drawFootprint(cx, cy, scale);
    drawTowers(cx, cy, scale);
    drawTourStops(cx, cy, scale);
    drawPlayer(cx, cy, scale);
    drawLabels(cx, cy, scale);

    // Scale bar, bottom-left.
    g.save();
    g.strokeStyle = 'rgba(241, 232, 214, 0.4)';
    g.lineWidth = 1;
    g.beginPath();
    const barX = 16;
    const barY = size - 16;
    g.moveTo(barX, barY);
    g.lineTo(barX + 50 * scale, barY);
    g.moveTo(barX, barY - 3);
    g.lineTo(barX, barY + 3);
    g.moveTo(barX + 50 * scale, barY - 3);
    g.lineTo(barX + 50 * scale, barY + 3);
    g.stroke();
    g.fillStyle = 'rgba(241, 232, 214, 0.4)';
    g.font = '7px "Segoe UI", system-ui, sans-serif';
    g.textAlign = 'left';
    g.textBaseline = 'bottom';
    g.fillText('50 m', barX, barY - 5);
    g.restore();
  }

  function onClick(ev) {
    if (!visible) return;
    const rect = canvas.getBoundingClientRect();
    const size = canvas._sfSize || Math.min(width, height);
    const offsetX = (rect.width - size) / 2;
    const offsetY = (rect.height - size) / 2;
    const mx = ev.clientX - rect.left - offsetX;
    const my = ev.clientY - rect.top - offsetY;
    let best = null;
    let bestD = 16;
    for (const m of markers) {
      const d = Math.hypot(m.x - mx, m.y - my);
      if (d < bestD) {
        bestD = d;
        best = m;
      }
    }
    if (best && typeof onSelectStop === 'function') {
      onSelectStop(best.id);
      return true;
    }
    return false;
  }

  canvas.addEventListener('click', onClick);

  function setVisible(v) {
    visible = !!v;
    if (visible) {
      resize();
      render();
    }
  }

  function setPlayer(p) {
    if (!p) return;
    const pos = p.pos || p;
    lastPlayer = {
      x: Number(pos.x) || 0,
      z: Number(pos.z) || 0,
      yaw: Number(p.yaw) || 0,
    };
  }

  function setCurrentStop(id) {
    currentStopId = id || null;
  }

  return {
    resize,
    render,
    setVisible,
    setPlayer,
    setCurrentStop,
    isVisible: () => visible,
    getMarkers: () => markers.map((m) => ({ ...m })),
    dispose() {
      canvas.removeEventListener('click', onClick);
    },
  };
}
