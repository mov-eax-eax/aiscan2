import * as THREE from 'three';
import { mulberry32 } from './rng.js';

const cache = new Map();

function canvasTexture(canvas) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  return tex;
}

function stone(seed = 2) {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 512;
  const ctx = c.getContext('2d');
  const rng = mulberry32(seed);
  ctx.fillStyle = '#7b8794';
  ctx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 80; i++) {
    const y = Math.floor(rng() * 512);
    ctx.strokeStyle = `rgba(${20 + rng() * 30},${20 + rng() * 30},${25 + rng() * 30},${0.08 + rng() * 0.13})`;
    ctx.lineWidth = 1 + rng() * 4;
    ctx.beginPath();
    ctx.moveTo(0, y);
    for (let x = 0; x <= 512; x += 48) ctx.lineTo(x, y + Math.sin(x * 0.02 + i) * 5 + (rng() - 0.5) * 4);
    ctx.stroke();
  }
  for (let i = 0; i < 900; i++) {
    const v = Math.floor(90 + rng() * 110);
    ctx.fillStyle = `rgba(${v},${v},${v + 8},${0.08 + rng() * 0.16})`;
    ctx.fillRect(rng() * 512, rng() * 512, 1 + rng() * 8, 1 + rng() * 3);
  }
  return canvasTexture(c);
}

function panel(seed = 4) {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 512;
  const ctx = c.getContext('2d');
  const rng = mulberry32(seed);
  ctx.fillStyle = '#8a93a0';
  ctx.fillRect(0, 0, 512, 512);
  ctx.strokeStyle = 'rgba(28,34,48,0.6)';
  ctx.lineWidth = 2;
  for (let x = 0; x < 512; x += 64) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 512); ctx.stroke(); }
  for (let y = 0; y < 512; y += 64) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(512, y); ctx.stroke(); }
  for (let i = 0; i < 260; i++) {
    ctx.fillStyle = 'rgba(20,25,38,0.7)';
    ctx.beginPath();
    ctx.arc(Math.floor(rng() * 8) * 64 + 8, Math.floor(rng() * 8) * 64 + 8, 2 + rng() * 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
  for (let i = 0; i < 40; i++) {
    ctx.fillStyle = `rgba(210,230,255,${0.05 + rng() * 0.12})`;
    ctx.fillRect(Math.floor(rng() * 8) * 64 + 3, Math.floor(rng() * 8) * 64 + 3, 58, 4);
  }
  return canvasTexture(c);
}

function organic(seed = 8) {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 512;
  const ctx = c.getContext('2d');
  const rng = mulberry32(seed);
  ctx.fillStyle = '#6d7e7a';
  ctx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 42; i++) {
    let x = rng() * 512;
    let y = rng() * 512;
    let a = rng() * Math.PI * 2;
    ctx.strokeStyle = `rgba(${30 + rng() * 25},${55 + rng() * 35},${50 + rng() * 30},${0.16 + rng() * 0.25})`;
    ctx.lineWidth = 1 + rng() * 2.4;
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let j = 0; j < 18; j++) {
      a += (rng() - 0.5) * 0.55;
      x += Math.cos(a) * (5 + rng() * 8);
      y += Math.sin(a) * (5 + rng() * 8);
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  for (let i = 0; i < 120; i++) {
    const v = Math.floor(80 + rng() * 100);
    ctx.fillStyle = `rgba(${v},${v + 10},${v},${0.05 + rng() * 0.1})`;
    ctx.beginPath();
    ctx.arc(rng() * 512, rng() * 512, 2 + rng() * 12, 0, Math.PI * 2);
    ctx.fill();
  }
  return canvasTexture(c);
}

function unknown(seed = 12) {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 512;
  const ctx = c.getContext('2d');
  const rng = mulberry32(seed);
  ctx.fillStyle = '#17151f';
  ctx.fillRect(0, 0, 512, 512);
  ctx.translate(256, 256);
  for (let i = 0; i < 26; i++) {
    ctx.strokeStyle = `rgba(${80 + rng() * 110},${40 + rng() * 80},${120 + rng() * 90},${0.1 + rng() * 0.25})`;
    ctx.lineWidth = 1 + rng() * 3;
    ctx.beginPath();
    for (let a = 0; a <= Math.PI * 2; a += 0.08) {
      const r = 15 + i * 9 + Math.sin(a * (3 + (i % 4)) + i) * 6;
      const x = Math.cos(a) * r;
      const y = Math.sin(a) * r;
      if (a === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  return canvasTexture(c);
}

export function bump(kind) {
  if (cache.has(kind)) return cache.get(kind);
  const tex = kind === 'panel' ? panel() : kind === 'organic' ? organic() : kind === 'unknown' ? unknown() : stone();
  tex.repeat.set(2, 2);
  cache.set(kind, tex);
  return tex;
}

function stoneAlbedo() {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 512;
  const ctx = c.getContext('2d');
  const rng = mulberry32(19);
  const g = ctx.createLinearGradient(0, 0, 0, 512);
  g.addColorStop(0, '#525d68');
  g.addColorStop(0.5, '#3e4854');
  g.addColorStop(1, '#2c333d');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 90; i++) {
    const y = rng() * 512;
    ctx.strokeStyle = `rgba(${20 + rng() * 30},${20 + rng() * 30},${25 + rng() * 30},${0.08 + rng() * 0.15})`;
    ctx.lineWidth = 1 + rng() * 5;
    ctx.beginPath();
    for (let x = 0; x <= 512; x += 32) ctx.lineTo(x, y + Math.sin(x * 0.025 + i) * (3 + rng() * 4));
    ctx.stroke();
  }
  for (let i = 0; i < 80; i++) {
    const a = rng() * Math.PI * 2;
    const x = rng() * 512;
    const y = rng() * 512;
    ctx.fillStyle = `rgba(${40 + rng() * 20},${55 + rng() * 25},${45 + rng() * 20},${0.05 + rng() * 0.12})`;
    ctx.beginPath();
    ctx.ellipse(x, y, 4 + rng() * 18, 2 + rng() * 8, a, 0, Math.PI * 2);
    ctx.fill();
  }
  return canvasTexture(c);
}

function panelAlbedo() {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 512;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#4c566b';
  ctx.fillRect(0, 0, 512, 512);
  const rng = mulberry32(27);
  for (let x = 0; x < 512; x += 64) {
    for (let y = 0; y < 512; y += 64) {
      const shade = 35 + Math.floor(rng() * 18);
      ctx.fillStyle = `rgb(${shade + 22},${shade + 30},${shade + 46})`;
      ctx.fillRect(x + 2, y + 2, 60, 60);
      ctx.strokeStyle = 'rgba(8,12,20,0.7)';
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 1, y + 1, 62, 62);
      for (let i = 0; i < 4; i++) {
        ctx.fillStyle = 'rgba(10,16,28,0.7)';
        ctx.beginPath();
        ctx.arc(x + 8 + i * 16, y + 8, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  for (let i = 0; i < 50; i++) {
    ctx.fillStyle = `rgba(200,230,255,${0.03 + rng() * 0.08})`;
    ctx.fillRect(rng() * 512, rng() * 512, 2 + rng() * 30, 1 + rng() * 2);
  }
  return canvasTexture(c);
}

function petalMap() {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 512;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, 256, 512);
  const g = ctx.createLinearGradient(0, 512, 0, 0);
  g.addColorStop(0, 'rgba(48,74,62,0.98)');
  g.addColorStop(0.42, 'rgba(92,151,124,0.98)');
  g.addColorStop(0.78, 'rgba(190,186,145,0.98)');
  g.addColorStop(1, 'rgba(244,224,190,0.98)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 512);
  const rng = mulberry32(43);
  ctx.lineWidth = 2;
  for (let i = 0; i < 26; i++) {
    const t = i / 26;
    ctx.strokeStyle = `rgba(210,255,246,${0.15 + rng() * 0.35})`;
    ctx.beginPath();
    ctx.moveTo(128, 480 - t * 40);
    ctx.quadraticCurveTo(128 + (rng() - 0.5) * 80, 300 - t * 180, 128 + (rng() - 0.5) * 40, 20 + t * 80);
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(230,255,250,0.8)';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(128, 500);
  ctx.quadraticCurveTo(120, 270, 128, 30);
  ctx.stroke();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

export function albedo(kind) {
  const key = 'albedo:' + kind;
  if (cache.has(key)) return cache.get(key);
  const tex = kind === 'panel' ? panelAlbedo() : stoneAlbedo();
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 2);
  cache.set(key, tex);
  return tex;
}

export function petalTexture() {
  if (!cache.has('petal')) cache.set('petal', petalMap());
  return cache.get('petal');
}

