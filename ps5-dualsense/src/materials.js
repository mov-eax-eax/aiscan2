// ============================================================
// materials.js - procedural micro-textures and PBR materials
// ============================================================
import * as THREE from 'three';
import { canvasTexture, makeCanvas } from './lib.js';

const PS_PATH = 'M8.984 2.596v17.547l3.915 1.261V6.688c0-.69.304-1.151.794-.991.636.18.76.814.76 1.505v5.875c2.441 1.193 4.362-.002 4.362-3.152 0-3.237-1.126-4.675-4.438-5.827-1.307-.448-3.728-1.186-5.39-1.502zm4.656 16.241l6.296-2.275c.715-.258.826-.625.246-.818-.586-.192-1.637-.139-2.357.123l-4.205 1.5V14.98l.24-.085s1.201-.42 2.913-.615c1.696-.18 3.785.03 5.437.661 1.848.601 2.04 1.472 1.576 2.072-.465.6-1.622 1.036-1.622 1.036l-8.544 3.107V18.86zM1.807 18.6c-1.9-.545-2.214-1.668-1.352-2.32.801-.586 2.16-1.052 2.16-1.052l5.615-2.013v2.313L4.205 17c-.705.271-.825.632-.239.826.586.195 1.637.15 2.343-.12L8.247 17v2.074c-.12.03-.256.044-.39.073-1.939.331-3.996.196-6.038-.479z';

function hash2(x, y) {
  let n = (x * 374761393 + y * 668265263) | 0;
  n = (n ^ (n >> 13)) * 1274126177;
  return ((n ^ (n >> 16)) >>> 0) / 4294967295;
}
function vnoise(x, y) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi);
  const b = hash2(xi + 1, yi);
  const c = hash2(xi, yi + 1);
  const d = hash2(xi + 1, yi + 1);
  return (a + (b - a) * u) * (1 - v) + (c + (d - c) * u) * v;
}
function fbm(x, y, octaves = 4) {
  let sum = 0;
  let amp = 0.5;
  let freq = 1;
  for (let i = 0; i < octaves; i++) {
    sum += vnoise(x * freq, y * freq) * amp;
    freq *= 2.03;
    amp *= 0.5;
  }
  return sum;
}

function plasticColorCanvas() {
  const size = 512;
  const c = makeCanvas(size);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#f4f4f0';
  ctx.fillRect(0, 0, size, size);
  const img = ctx.getImageData(0, 0, size, size);
  const d = img.data;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const low = fbm(x / 42, y / 42, 3) - 0.5;
      const grain = (Math.random() - 0.5) * 4.5;
      const speck = Math.random() < 0.00055 ? -20 : 0;
      const v = low * 5 + grain + speck;
      d[i] = Math.max(0, Math.min(255, d[i] + v));
      d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + v));
      d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + v * 0.9));
    }
  }
  ctx.putImageData(img, 0, 0);
  // faint hairline scratches
  ctx.globalAlpha = 0.05;
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 0.6;
  for (let i = 0; i < 70; i++) {
    ctx.beginPath();
    const x = Math.random() * size;
    const y = Math.random() * size;
    ctx.moveTo(x, y);
    ctx.lineTo(x + 8 + Math.random() * 45, y + (Math.random() - 0.5) * 3);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  return c;
}

function grayNoiseCanvas(size = 512, base = 128, amp = 22, scale = 32) {
  const c = makeCanvas(size);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  const d = img.data;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const v = base + (fbm(x / scale, y / scale, 4) - 0.5) * amp + (Math.random() - 0.5) * 7;
      d[i] = d[i + 1] = d[i + 2] = Math.max(0, Math.min(255, v));
      d[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

function knurlCanvas() {
  const size = 512;
  const c = makeCanvas(size);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#7d7d7d';
  ctx.fillRect(0, 0, size, size);
  const n = 64;
  for (let i = 0; i < n; i++) {
    const x = (i / n) * size;
    const g = ctx.createLinearGradient(x, 0, x + size / n, 0);
    g.addColorStop(0, '#5a5a5a');
    g.addColorStop(0.5, '#c4c4c4');
    g.addColorStop(1, '#5a5a5a');
    ctx.fillStyle = g;
    ctx.fillRect(x, 0, size / n + 1, size);
  }
  ctx.globalAlpha = 0.35;
  for (let i = 0; i < 4000; i++) {
    ctx.fillStyle = Math.random() > 0.5 ? '#d0d0d0' : '#3d3d3d';
    ctx.fillRect(Math.random() * size, Math.random() * size, 1, 1);
  }
  ctx.globalAlpha = 1;
  return c;
}

export function makeIconCanvas(kind, size = 256) {
  const c = makeCanvas(size);
  const ctx = c.getContext('2d');
  const s = size / 256;
  ctx.save();
  ctx.scale(s, s);
  ctx.clearRect(0, 0, 256, 256);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#d7dadc';
  ctx.fillStyle = '#d7dadc';
  ctx.lineWidth = 11;
  const cx = 128;
  const cy = 128;
  const R = 78;
  if (kind === 'triangle') {
    ctx.beginPath();
    ctx.moveTo(128, 51);
    ctx.lineTo(206, 200);
    ctx.quadraticCurveTo(210, 211, 197, 211);
    ctx.lineTo(59, 211);
    ctx.quadraticCurveTo(46, 211, 50, 200);
    ctx.closePath();
    ctx.stroke();
  } else if (kind === 'circle') {
    ctx.beginPath();
    ctx.arc(128, 132, 76, 0, Math.PI * 2);
    ctx.stroke();
  } else if (kind === 'cross') {
    ctx.beginPath();
    ctx.moveTo(62, 66);
    ctx.lineTo(194, 198);
    ctx.moveTo(194, 66);
    ctx.lineTo(62, 198);
    ctx.stroke();
  } else if (kind === 'square') {
    ctx.beginPath();
    ctx.roundRect(55, 57, 146, 146, 10);
    ctx.stroke();
  } else if (kind.startsWith('arrow-')) {
    const dir = kind.slice(6);
    const rot = { up: 0, right: Math.PI / 2, down: Math.PI, left: -Math.PI / 2 }[dir] || 0;
    ctx.translate(128, 128);
    ctx.rotate(rot);
    ctx.beginPath();
    ctx.moveTo(-38, 28);
    ctx.lineTo(0, -42);
    ctx.lineTo(38, 28);
    ctx.lineTo(10, 18);
    ctx.lineTo(10, 54);
    ctx.lineTo(-10, 54);
    ctx.lineTo(-10, 18);
    ctx.closePath();
    ctx.fill();
  } else if (kind === 'create') {
    ctx.lineWidth = 9;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(67 + i * 8, 87 + i * 38);
      ctx.lineTo(181 - i * 8, 79 + i * 38);
      ctx.stroke();
    }
  } else if (kind === 'options') {
    ctx.lineWidth = 10;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(76, 88 + i * 40);
      ctx.lineTo(180, 88 + i * 40);
      ctx.stroke();
    }
  } else if (kind === 'mute') {
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.roundRect(96, 46, 64, 104, 30);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(78, 124);
    ctx.quadraticCurveTo(78, 184, 128, 184);
    ctx.quadraticCurveTo(178, 184, 178, 124);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(128, 184);
    ctx.lineTo(128, 210);
    ctx.moveTo(103, 210);
    ctx.lineTo(153, 210);
    ctx.stroke();
    ctx.strokeStyle = '#ff9d2e';
    ctx.lineWidth = 11;
    ctx.beginPath();
    ctx.moveTo(63, 55);
    ctx.lineTo(195, 200);
    ctx.stroke();
  } else if (kind === 'ps') {
    ctx.save();
    ctx.translate(128, 128);
    ctx.scale(8.6, 8.6);
    ctx.translate(-12, -12);
    const p = new Path2D(PS_PATH);
    ctx.fillStyle = '#d8dde0';
    ctx.fill(p);
    ctx.restore();
  } else if (kind === 'dot') {
    ctx.beginPath();
    ctx.arc(128, 128, 30, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  return c;
}

function iconTexture(kind) {
  return canvasTexture(makeIconCanvas(kind), { srgb: true });
}

function labelCanvas() {
  const w = 1024;
  const h = 512;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#080909';
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = 'rgba(210,215,220,0.22)';
  ctx.lineWidth = 3;
  ctx.strokeRect(18, 18, w - 36, h - 36);
  ctx.fillStyle = 'rgba(225,228,230,0.72)';
  ctx.font = '600 38px Arial, sans-serif';
  ctx.fillText('SONY INTERACTIVE ENTERTAINMENT', 54, 88);
  ctx.font = '500 31px Arial, sans-serif';
  ctx.fillText('DUALSENSE® WIRELESS CONTROLLER', 54, 136);
  ctx.font = '500 27px Arial, sans-serif';
  ctx.fillStyle = 'rgba(215,220,224,0.52)';
  ctx.fillText('MODEL  CFI-ZCT1W     INPUT  5V ⎓ 1.5A', 54, 207);
  ctx.fillText('MADE IN CHINA     SERIAL  ZCT1W-2406-118742', 54, 246);
  ctx.fillText('CMIIT ID  2020DJ1234     FCC ID  AK8CFIZCT1', 54, 285);
  ctx.fillText('Designed for PlayStation®5', 54, 345);
  // barcode
  ctx.fillStyle = 'rgba(230,232,233,0.8)';
  let x = 650;
  for (let i = 0; i < 46; i++) {
    const ww = 2 + Math.floor(Math.random() * 5);
    if (Math.random() > 0.35) ctx.fillRect(x, 335, ww, 96);
    x += ww + 3;
  }
  // CE / UKCA marks
  ctx.strokeStyle = 'rgba(220,224,226,0.55)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(870, 420, 22, 0, Math.PI * 2);
  ctx.stroke();
  ctx.font = '700 24px Arial';
  ctx.fillStyle = 'rgba(220,224,226,0.55)';
  ctx.fillText('CE', 855, 428);
  ctx.font = '500 22px Arial';
  ctx.fillText('UKCA', 920, 428);
  // tiny recycling mark
  ctx.strokeStyle = 'rgba(220,224,226,0.4)';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(785, 420, 22, 0.2, 4.2);
  ctx.stroke();
  return c;
}

export function createMaterials(renderer) {
  const maxAniso = renderer.capabilities.getMaxAnisotropy();
  const plastic = canvasTexture(plasticColorCanvas(), { srgb: true, repeat: [3, 3] });
  plastic.anisotropy = Math.min(8, maxAniso);
  const bump = canvasTexture(grayNoiseCanvas(512, 128, 30, 26), { repeat: [10, 10] });
  bump.anisotropy = Math.min(8, maxAniso);
  const rough = canvasTexture(grayNoiseCanvas(512, 142, 36, 70), { repeat: [2, 2] });
  rough.anisotropy = Math.min(4, maxAniso);
  const knurl = canvasTexture(knurlCanvas(), { repeat: [1, 1] });

  const shell = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    map: plastic,
    bumpMap: bump,
    bumpScale: 0.003,
    roughnessMap: rough,
    roughness: 0.52,
    metalness: 0.0,
    clearcoat: 0.12,
    clearcoatRoughness: 0.56,
    envMapIntensity: 0.74,
    sheen: 0.08,
    sheenRoughness: 0.75,
    sheenColor: new THREE.Color(0xdde3e8),
  });
  shell.name = 'shell';

  const core = new THREE.MeshPhysicalMaterial({
    color: 0x0d0d0f,
    roughness: 0.44,
    metalness: 0.02,
    clearcoat: 0.22,
    clearcoatRoughness: 0.50,
    envMapIntensity: 0.82,
    bumpMap: bump,
    bumpScale: 0.002,
  });
  core.name = 'core';

  const coreMatte = new THREE.MeshPhysicalMaterial({
    color: 0x09090b,
    roughness: 0.68,
    metalness: 0.0,
    clearcoat: 0.06,
    clearcoatRoughness: 0.80,
    envMapIntensity: 0.58,
    bumpMap: bump,
    bumpScale: 0.003,
  });

  const rubber = new THREE.MeshPhysicalMaterial({
    color: 0x0a0a0b,
    roughness: 0.78,
    metalness: 0.0,
    clearcoat: 0.16,
    clearcoatRoughness: 0.48,
    envMapIntensity: 0.58,
    bumpMap: knurl,
    bumpScale: 0.018,
  });

  const touchpad = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    map: plastic,
    bumpMap: bump,
    bumpScale: 0.002,
    roughness: 0.50,
    metalness: 0.0,
    clearcoat: 0.18,
    clearcoatRoughness: 0.46,
    envMapIntensity: 0.72,
  });

  const clear = new THREE.MeshPhysicalMaterial({
    color: 0x8f9aa2,
    metalness: 0.0,
    roughness: 0.22,
    clearcoat: 1.0,
    clearcoatRoughness: 0.10,
    envMapIntensity: 1.15,
    sheen: 0.30,
    sheenColor: new THREE.Color(0xe8f0f4),
    sheenRoughness: 0.35,
  });
  clear.name = 'clear';

  const chrome = new THREE.MeshPhysicalMaterial({
    color: 0xd7dade,
    metalness: 1.0,
    roughness: 0.16,
    envMapIntensity: 1.4,
  });

  const icon = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    transparent: true,
    alphaTest: 0.03,
    roughness: 0.36,
    metalness: 0.05,
    emissive: new THREE.Color(0xffffff),
    emissiveIntensity: 0.12,
    depthWrite: false,
  });

  const lightbar = new THREE.MeshStandardMaterial({
    color: 0xa9f6ff,
    emissive: 0x4fe3ff,
    emissiveIntensity: 2.4,
    roughness: 0.18,
    metalness: 0.0,
    toneMapped: true,
  });

  const psLogo = new THREE.MeshStandardMaterial({
    color: 0xd9ecff,
    emissive: 0x7fcaff,
    emissiveIntensity: 1.0,
    roughness: 0.22,
    metalness: 0.0,
  });

  const led = new THREE.MeshStandardMaterial({
    color: 0xffb04d,
    emissive: 0xff8a1e,
    emissiveIntensity: 2.4,
    roughness: 0.3,
  });

  const usbDark = new THREE.MeshPhysicalMaterial({
    color: 0x050506,
    roughness: 0.5,
    metalness: 0.2,
    clearcoat: 0.4,
  });

  const labelTexture = canvasTexture(labelCanvas(), { srgb: true });
  labelTexture.anisotropy = Math.min(8, maxAniso);
  const label = new THREE.MeshStandardMaterial({
    map: labelTexture,
    roughness: 0.46,
    metalness: 0.15,
    envMapIntensity: 0.7,
  });

  const colorways = {
    white: { label: 'Arctic White', shell: 0xffffff, touchpad: 0xf3f2ed, ui: '#dfe6ea' },
    midnight: { label: 'Midnight Black', shell: 0x26282d, touchpad: 0x2c2e33, ui: '#aeb7bd' },
    cosmic: { label: 'Cosmic Red', shell: 0xb82e48, touchpad: 0xb52a44, ui: '#ff8b9e' },
  };

  function setColorway(id) {
    const c = colorways[id] || colorways.white;
    shell.color.setHex(c.shell);
    touchpad.color.setHex(c.touchpad);
    return c;
  }

  return {
    shell,
    core,
    coreMatte,
    rubber,
    touchpad,
    clear,
    chrome,
    icon,
    lightbar,
    psLogo,
    led,
    usbDark,
    label,
    textures: { plastic, bump, rough, knurl, labelTexture },
    colorways,
    setColorway,
  };
}

export { iconTexture };