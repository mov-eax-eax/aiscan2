import * as THREE from 'three';
import { mulberry32, range, pick, chance } from './rng.js';
import { bump, petalTexture, albedo } from './textures.js';

const TAU = Math.PI * 2;
const hsl = (h, s, l) => new THREE.Color().setHSL(((h % 360) + 360) % 360 / 360, s, l);

function mat(color, emissive = 0x000000, intensity = 0, extra = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    emissive,
    emissiveIntensity: intensity,
    roughness: 0.42,
    metalness: 0.42,
    flatShading: true,
    ...extra,
  });
}

function petalGeometry({ length = 16, width = 3.4, cup = 1.1, bend = 0.5, segmentsU = 22, segmentsV = 10 }) {
  const positions = [];
  const uvs = [];
  const indices = [];
  for (let iu = 0; iu <= segmentsU; iu++) {
    const u = iu / segmentsU;
    const half = width * Math.sin(Math.PI * Math.pow(u, 0.72)) * (1 - u * 0.12);
    const spine = cup * Math.sin(Math.PI * u * 0.82) + bend * u * u;
    for (let iv = 0; iv <= segmentsV; iv++) {
      const v = (iv / segmentsV) * 2 - 1;
      const x = half * v;
      const y = length * u + Math.abs(v) * 0.36;
      const z = spine - Math.abs(v) * 0.42 - Math.pow(Math.abs(v), 3) * 0.35;
      positions.push(x, y, z);
      uvs.push((v + 1) / 2, u);
    }
  }
  for (let iu = 0; iu < segmentsU; iu++) {
    for (let iv = 0; iv < segmentsV; iv++) {
      const a = iu * (segmentsV + 1) + iv;
      const b = a + segmentsV + 1;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function flutedColumnGeometry(radiusAt, height, rings = 90, segments = 56, flutes = 18) {
  const positions = [];
  const uvs = [];
  const indices = [];
  for (let iy = 0; iy <= rings; iy++) {
    const u = iy / rings;
    const y = u * height;
    const r = radiusAt(y);
    for (let ia = 0; ia <= segments; ia++) {
      const a = (ia / segments) * TAU;
      const flute = 1 + Math.sin(a * flutes + y * 0.55) * 0.025 + Math.sin(a * 7 + y * 1.4) * 0.012;
      positions.push(Math.sin(a) * r * flute, y, Math.cos(a) * r * flute);
      uvs.push(ia / segments, u);
    }
  }
  for (let iy = 0; iy < rings; iy++) {
    for (let ia = 0; ia < segments; ia++) {
      const a = iy * (segments + 1) + ia;
      const b = a + segments + 1;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function textLabel(text, color, width = 5.2) {  const canvas = document.createElement('canvas');
  canvas.width = 512; canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, 512, 128);
  ctx.font = '600 54px Segoe UI, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = color;
  ctx.shadowBlur = 18;
  ctx.fillStyle = color;
  ctx.fillText(text, 256, 66);
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(0,0,0,0.5)';
  ctx.strokeText(text, 256, 66);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  sprite.scale.set(width, width / 4, 1);
  return sprite;
}

function glyphTexture(seed) {
  const canvas = document.createElement('canvas');
  canvas.width = 256; canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = 'rgba(5,8,14,0.72)';
  ctx.fillRect(0, 0, 256, 256);
  const rng = mulberry32(seed);
  ctx.strokeStyle = 'rgba(126,255,226,0.75)';
  ctx.lineWidth = 3;
  for (let i = 0; i < 9; i++) {
    const x = 24 + Math.floor(rng() * 5) * 42;
    const y = 26 + Math.floor(rng() * 5) * 42;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + range(rng, -18, 24), y + range(rng, -20, 22));
    ctx.lineTo(x + range(rng, -12, 30), y + range(rng, -18, 20));
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createArchitecture() {
  const group = new THREE.Group();
  group.name = 'architecture';
  const rng = mulberry32(22061);
  const updates = [];

  const panelBump = bump('panel');
  const panelMap = albedo('panel');
  const organicBump = bump('organic');
  const metal = new THREE.MeshStandardMaterial({ color: 0xc3b9a8, map: panelMap, roughness: 0.38, metalness: 0.5, emissive: 0x111d2b, emissiveIntensity: 0.55, flatShading: false, bumpMap: panelBump, bumpScale: 0.11 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x6b6358, map: panelMap, roughness: 0.76, metalness: 0.2, emissive: 0x060c16, emissiveIntensity: 0.5, flatShading: false, bumpMap: panelBump, bumpScale: 0.14 });
  const gold = new THREE.MeshBasicMaterial({ color: 0xe3b48b, transparent: true, opacity: 0.76, blending: THREE.AdditiveBlending, depthWrite: false });
  const teal = new THREE.MeshBasicMaterial({ color: 0x9fcabb, transparent: true, opacity: 0.72, blending: THREE.AdditiveBlending, depthWrite: false });
  const pink = new THREE.MeshBasicMaterial({ color: 0xc98f7c, transparent: true, opacity: 0.65, blending: THREE.AdditiveBlending, depthWrite: false });

  function mesh(geo, material, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
    const m = new THREE.Mesh(geo, material);
    m.position.set(x, y, z);
    m.rotation.set(rx, ry, rz);
    m.castShadow = true;
    m.receiveShadow = true;
    return m;
  }

  // ------------------------------------------------------------------ bloom
  const bloom = new THREE.Group();
  bloom.position.y = 20;
  bloom.name = 'bloom';
  group.add(bloom);

  bloom.add(mesh(new THREE.CylinderGeometry(9.4, 10.4, 1.8,24), metal, 0, 0.9, 0));
  bloom.add(mesh(new THREE.CylinderGeometry(7.2, 8.2, 1.4,24), dark, 0, 2.2, 0));
  bloom.add(mesh(new THREE.TorusGeometry(7.4, 0.12,10,64), teal, 0, 2.95, 0, Math.PI / 2));
  bloom.add(mesh(new THREE.TorusGeometry(9.8, 0.08,10,64), gold, 0, 2.1, 0, Math.PI / 2));

  const stemRadius = (y) => {
    const keys = [[0, 5.2], [3, 4.2], [8, 3.2], [15, 2.5], [22, 2.8], [30, 2.1], [36, 1.6], [41.5, 1.1]];
    for (let i = 0; i < keys.length - 1; i++) {
      if (y <= keys[i + 1][0]) {
        const u = (y - keys[i][0]) / (keys[i + 1][0] - keys[i][0]);
        return keys[i][1] + (keys[i + 1][1] - keys[i][1]) * u;
      }
    }
    return 1.1;
  };
  const stem = mesh(flutedColumnGeometry(stemRadius, 41.5, 110, 64, 22), metal);
  bloom.add(stem);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU;
    bloom.add(mesh(new THREE.CylinderGeometry(0.06, 0.12, 37,24), i % 2 ? teal : pink, Math.sin(a) * 1.6, 20, Math.cos(a) * 1.6));
  }
  for (const y of [8, 18, 28, 35]) {
    bloom.add(mesh(new THREE.TorusGeometry(3.1 - y * 0.035, 0.09,10,64), teal, 0, y, 0, Math.PI / 2));
  }

  // Spiral tendrils around the stem.
  for (let t = 0; t < 3; t++) {
    const pts = [];
    for (let i = 0; i <= 30; i++) {
      const u = i / 30;
      const a = u * Math.PI * 3.6 + t * 2.1;
      pts.push(new THREE.Vector3(Math.sin(a) * (4.8 - u * 2.2), 4 + u * 34, Math.cos(a) * (4.8 - u * 2.2)));
    }
    const curve = new THREE.CatmullRomCurve3(pts);
    bloom.add(mesh(new THREE.TubeGeometry(curve, 40, 0.07, 4, false), teal));
  }

  const petalTex = petalTexture();
  const petals = new THREE.Group();
  bloom.add(petals);
  const petalMaterial = new THREE.MeshPhysicalMaterial({
    map: petalTex,
    emissiveMap: petalTex,
    emissive: 0x8ec6b1,
    emissiveIntensity: 1.2,
    transparent: true,
    opacity: 0.93,
    side: THREE.DoubleSide,
    roughness: 0.28,
    metalness: 0.12,
    clearcoat: 0.6,
    clearcoatRoughness: 0.3,
    iridescence: 0.5,
    iridescenceIOR: 1.35,
  });
  const petalPalette = [0xa8d6c5, 0xb9d0cd, 0xd2a78b, 0x9ab6c5, 0xc6b18d];
  const petalDummy = new THREE.Object3D();
  function petalLayer({ count, radius, y, tilt, length, width, cup, phase, spread = 0.04 }) {
    const layer = new THREE.Group();
    layer.position.y = y;
    const geo = petalGeometry({ length, width, cup, bend: 0.35, segmentsU: 26, segmentsV: 12 });
    const mesh = new THREE.InstancedMesh(geo, petalMaterial, count);
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    for (let i = 0; i < count; i++) {
      const a = (i / count) * TAU + phase;
      petalDummy.position.set(Math.sin(a) * radius, 0, Math.cos(a) * radius);
      petalDummy.rotation.order = 'YXZ';
      petalDummy.rotation.set(tilt + Math.sin(i * 1.7) * spread, a, Math.sin(i * 2.1) * 0.03);
      petalDummy.updateMatrix();
      mesh.setMatrixAt(i, petalDummy.matrix);
      mesh.setColorAt(i, new THREE.Color(petalPalette[i % petalPalette.length]));
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    layer.add(mesh);
    return layer;
  }
  petals.add(petalLayer({ count: 7, radius: 1.7, y: 39.2, tilt: 0.82, length: 12.5, width: 3.0, cup: 1.0, phase: 0.0 }));
  petals.add(petalLayer({ count: 10, radius: 2.6, y: 38.4, tilt: 1.15, length: 16.5, width: 4.0, cup: 1.3, phase: 0.23 }));
  petals.add(petalLayer({ count: 13, radius: 3.6, y: 37.5, tilt: 1.36, length: 20.5, width: 5.2, cup: 1.5, phase: 0.47 }));

  // Calyx cup behind the petals: a lofted, grown socket instead of a cut cylinder.
  const calyxMat = new THREE.MeshStandardMaterial({ color: 0x33796d, map: panelMap, emissive: 0x0a2a25, emissiveIntensity: 1.2, roughness: 0.45, metalness: 0.24, flatShading: false, bumpMap: organicBump, bumpScale: 0.1, side: THREE.DoubleSide });
  const calyxProfile = [[0.2, 0], [3.4, 0], [5.6, 1.2], [6.8, 3.8], [7.4, 5.4]].map(([r, y]) => new THREE.Vector2(r, y));
  const calyx = new THREE.Mesh(new THREE.LatheGeometry(calyxProfile, 48), calyxMat);
  calyx.position.y = 31.9;
  bloom.add(calyx);
  const sepalGeo = petalGeometry({ length: 8, width: 1.6, cup: 0.7, bend: 0.2, segmentsU: 14, segmentsV: 8 });
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * TAU;
    const sepal = new THREE.Mesh(sepalGeo, calyxMat);
    sepal.position.set(Math.sin(a) * 5.8, 36.8, Math.cos(a) * 5.8);
    sepal.rotation.order = 'YXZ';
    sepal.rotation.set(2.15, a, 0);
    sepal.castShadow = true;
    bloom.add(sepal);
  }

  // Stamens with luminous tips.
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * TAU;
    const pts = [];
    for (let j = 0; j <= 12; j++) {
      const u = j / 12;
      pts.push(new THREE.Vector3(Math.sin(a) * (0.4 + u * 3.2), 39 + Math.sin(u * Math.PI) * 4.2 + u * 2.2, Math.cos(a) * (0.4 + u * 3.2)));
    }
    const curve = new THREE.CatmullRomCurve3(pts);
    bloom.add(mesh(new THREE.TubeGeometry(curve, 18, 0.045, 4, false), i % 2 ? gold : pink));
    bloom.add(mesh(new THREE.SphereGeometry(0.16,18,12), i % 2 ? gold : pink, Math.sin(a) * 3.6, 45.4, Math.cos(a) * 3.6));
  }

  // Halo architecture around the crown.
  for (let i = 0; i < 4; i++) {
    const halo = mesh(
      new THREE.TorusGeometry(8 + i * 2.4, 0.08 + i * 0.02,10,64),
      i % 2 ? pink : teal,
      0, 40.5 + i * 1.8, 0, Math.PI / 2 - 0.12 + i * 0.07, i * 0.2, i * 0.08
    );
    halo.userData.spin = 0.08 + i * 0.05;
    bloom.add(halo);
    updates.push((dt) => { halo.rotation.z += dt * halo.userData.spin; });
  }

  // Crown light shafts.
  const beamMat = new THREE.MeshBasicMaterial({ color: 0xffd7a2, transparent: true, opacity: 0.055, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const beam = new THREE.Mesh(new THREE.ConeGeometry(5.4, 28, 16, 1, true), beamMat);
  beam.position.y = 62;
  bloom.add(beam);
  const coreLight = new THREE.PointLight(0xffd3a6, 1050, 170, 2);
  coreLight.position.y = 45;
  bloom.add(coreLight);
  const warmCore = new THREE.PointLight(0xff9a66, 260, 66, 2);
  warmCore.position.set(0, 43, 1.2);
  bloom.add(warmCore);

  const haloCanvas = document.createElement('canvas');
  haloCanvas.width = 256; haloCanvas.height = 256;
  const haloCtx = haloCanvas.getContext('2d');
  const haloGrad = haloCtx.createRadialGradient(128, 128, 3, 128, 128, 128);
  haloGrad.addColorStop(0, 'rgba(255,255,255,1)');
  haloGrad.addColorStop(0.08, 'rgba(255,220,245,0.95)');
  haloGrad.addColorStop(0.26, 'rgba(255,110,220,0.42)');
  haloGrad.addColorStop(0.62, 'rgba(255,70,190,0.12)');
  haloGrad.addColorStop(1, 'rgba(255,70,190,0)');
  haloCtx.fillStyle = haloGrad;
  haloCtx.fillRect(0, 0, 256, 256);
  const haloTexture = new THREE.CanvasTexture(haloCanvas);
  haloTexture.colorSpace = THREE.SRGBColorSpace;
  for (const [size, opacity, hue] of [[44, 0.62, 0xffd7ad], [22, 0.86, 0xfff0d4], [70, 0.16, 0xa8c9be]]) {
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTexture, color: hue, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false }));
    sprite.scale.set(size, size, 1);
    sprite.position.y = 44.5;
    bloom.add(sprite);
  }

  // Root fins.
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU;
    const fin = mesh(new THREE.ConeGeometry(0.72, 5.8,20), i % 2 ? teal : pink, Math.sin(a) * 7.8, 1.4, Math.cos(a) * 7.8, 0.55, -a, 0.45);
    bloom.add(fin);
  }

  // Luminous climbing veins on the trunk.
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU;
    const pts = [];
    for (let j = 0; j <= 24; j++) {
      const u = j / 24;
      pts.push(new THREE.Vector3(Math.sin(a + u * 0.5) * (4.4 - u * 2.4), 3 + u * 33, Math.cos(a + u * 0.5) * (4.4 - u * 2.4)));
    }
    bloom.add(mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 34, 0.1, 4, false), i % 2 ? teal : pink));
  }

  const core = mesh(new THREE.IcosahedronGeometry(3.4, 3), new THREE.MeshStandardMaterial({ color: 0xffd7a2, emissive: 0xff4fc8, emissiveIntensity: 3.6, roughness: 0.2, metalness: 0.3, flatShading: true }), 0, 44.5, 0);
  bloom.add(core);
  for (let i = 0; i < 3; i++) {
    const ring = mesh(new THREE.TorusGeometry(4 + i * 2.4, 0.1,10,64), i % 2 ? pink : teal, 0, 41.2 + i * 1.2, 0, Math.PI / 2 + i * 0.2);
    ring.userData.spin = 0.18 + i * 0.08;
    bloom.add(ring);
    updates.push((dt) => { ring.rotation.z += dt * ring.userData.spin; });
  }

  // base glyphs and lamps
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU;
    const lamp = mesh(new THREE.CylinderGeometry(0.16, 0.26, 3.4,24), dark, Math.sin(a) * 10.5, 2.9, Math.cos(a) * 10.5);
    bloom.add(lamp);
    bloom.add(mesh(new THREE.SphereGeometry(0.34,18,12), gold, Math.sin(a) * 10.5, 4.7, Math.cos(a) * 10.5));
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.5), new THREE.MeshBasicMaterial({ map: glyphTexture(910 + i), transparent: true, opacity: 0.6, depthWrite: false }));
    plate.position.set(Math.sin(a + 0.15) * 9.6, 1.2, Math.cos(a + 0.15) * 9.6);
    plate.rotation.y = -a;
    bloom.add(plate);
  }

  // --------------------------------------------------------------- pavilions
  const pavilions = new THREE.Group();
  group.add(pavilions);
  const styles = ['dome', 'stack', 'crystal', 'ring', 'shell', 'gate'];
  const pavilionColors = [0xd18a68, 0x7da79a, 0xd4ac76, 0x7b96b5, 0x9aa879, 0x9b8fa6];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU + 0.18;
    const p = new THREE.Group();
    p.position.set(Math.sin(a) * 33, 7.75, Math.cos(a) * 33);
    p.rotation.y = -a;
    pavilions.add(p);
    const accent = new THREE.MeshBasicMaterial({ color: pavilionColors[i], transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false });
    p.add(mesh(new THREE.CylinderGeometry(8.2, 9.2, 0.9,24), dark, 0, 0.5, 0));
    p.add(mesh(new THREE.TorusGeometry(7.6, 0.12,10,64), accent, 0, 1.1, 0, Math.PI / 2));
    const bodyMat = mat(hsl(180 + i * 33, 0.28, 0.23), hsl(180 + i * 33, 0.65, 0.1), 0.8);
    bodyMat.flatShading = false;
    bodyMat.map = panelMap;
    bodyMat.color.set(0x9aa6ba);
    bodyMat.bumpMap = panelBump;
    bodyMat.bumpScale = 0.1;
    const style = styles[i];
    if (style === 'dome') {
      p.add(mesh(new THREE.CylinderGeometry(5.8, 6.7, 3.6,24), bodyMat, 0, 2.8, 0));
      p.add(mesh(new THREE.SphereGeometry(6.1, 14, 7, 0, TAU, 0, Math.PI / 2), bodyMat, 0, 4.4, 0));
      for (let j = 0; j < 4; j++) {
        const aa = (j / 4) * TAU;
        p.add(mesh(new THREE.TorusGeometry(5.8, 0.07, 4, 24, Math.PI), accent, 0, 4.55, 0, 0, 0, aa));
      }
      p.add(mesh(new THREE.CylinderGeometry(0.1, 0.1, 8,24), accent, 0, 11.5, 0));
    } else if (style === 'stack') {
      const podProfile = [
        [5.7, 1.2], [5.4, 2.4], [4.7, 4.2], [3.9, 6.2], [3.2, 8.3], [2.4, 10.1], [1.5, 11.6], [0.35, 12.9],
      ].map(([r, y]) => new THREE.Vector2(r, y));
      p.add(mesh(new THREE.LatheGeometry(podProfile, 64), bodyMat));
      for (const y of [2.2, 4.2, 6.4, 8.6, 10.6]) {
        p.add(mesh(new THREE.TorusGeometry(5.1 - (y - 2.2) * 0.34, 0.06, 8, 72), accent, 0, y, 0, Math.PI / 2));
      }
      for (let j = 0; j < 10; j++) {
        const aa = (j / 10) * TAU;
        const pts = [];
        for (let k = 0; k < 8; k++) {
          const u = k / 7;
          const r = 5.5 - u * 4.6;
          pts.push(new THREE.Vector3(Math.sin(aa) * r, 1.8 + u * 10, Math.cos(aa) * r));
        }
        p.add(mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 20, 0.035, 4, false), accent));
      }
      p.add(mesh(new THREE.CylinderGeometry(0.09, 0.35, 3.4, 24), metal, 0, 13.4, 0));
    } else if (style === 'crystal') {
      for (let j = 0; j < 6; j++) {
        const aa = (j / 6) * TAU;
        const h = 6 + (j % 3) * 3.2;
        p.add(mesh(new THREE.ConeGeometry(1.5, h,20), bodyMat, Math.sin(aa) * 3.8, h / 2 + 1, Math.cos(aa) * 3.8, 0, aa, 0.1));
        p.add(mesh(new THREE.OctahedronGeometry(0.36, 0), accent, Math.sin(aa) * 3.8, h + 1, Math.cos(aa) * 3.8));
      }
    } else if (style === 'ring') {
      for (const x of [-4.2, 4.2]) {
        p.add(mesh(new THREE.CylinderGeometry(0.36, 0.7, 11,24), bodyMat, x, 6, 0));
      }
      p.add(mesh(new THREE.TorusGeometry(5.2, 0.42,10,64), metal, 0, 10.2, 0, Math.PI / 2));
      p.add(mesh(new THREE.TorusGeometry(5.2, 0.12,10,64), accent, 0, 10.7, 0, Math.PI / 2));
      p.add(mesh(new THREE.SphereGeometry(1.1,18,12), accent, 0, 8, 0));
    } else if (style === 'shell') {
      p.add(mesh(new THREE.CylinderGeometry(4.8, 6.2, 4.2,24), bodyMat, 0, 3.1, 0));
      p.add(mesh(new THREE.SphereGeometry(5.8, 14, 7, 0, TAU, 0, Math.PI / 2), bodyMat, 0, 4.1, 0, 0.2, 0, 0.4));
      for (let j = 0; j < 5; j++) {
        const aa = (j / 5) * TAU;
        p.add(mesh(new THREE.ConeGeometry(0.7, 7,20), accent, Math.sin(aa) * 4.3, 6.5, Math.cos(aa) * 4.3, 0, aa, 0.45));
      }
    } else {
      for (const x of [-5, 5]) p.add(mesh(new THREE.BoxGeometry(1.1, 8, 1.4), bodyMat, x, 4.5, 0));
      p.add(mesh(new THREE.TorusGeometry(5, 0.32, 5, 28, Math.PI), metal, 0, 8.5, 0));
      p.add(mesh(new THREE.TorusGeometry(5, 0.1, 4, 28, Math.PI), accent, 0, 8.8, 0));
    }
    // banners
    for (const side of [-1, 1]) {
      const banner = mesh(new THREE.PlaneGeometry(1.1, 3.2), accent, side * 5.5, 4.4, 4.8);
      banner.rotation.y = -0.2;
      banner.userData.phase = range(rng, 0, TAU);
      p.add(banner);
      updates.push((dt, time) => { banner.rotation.z = Math.sin(time * 1.4 + banner.userData.phase) * 0.08; });
    }
    const labelMat = new THREE.MeshBasicMaterial({ map: glyphTexture(330 + i), transparent: true, opacity: 0.68, depthWrite: false });
    p.add(mesh(new THREE.PlaneGeometry(2.4, 2.4), labelMat, 0, 3, 6.3));
    const embassyNames = ['VEYRA', 'KETH', 'MORROW', 'SABLE', 'ILO', 'ORION'];
    const nameplate = textLabel(embassyNames[i], '#' + pavilionColors[i].toString(16).padStart(6, '0'), 4.8);
    nameplate.position.set(0, 18.8 + (i % 2) * 1.2, 0);
    nameplate.scale.multiplyScalar(1.35);
    p.add(nameplate);

    // Each embassy gets its own crown, entry and lit forecourt.
    const crownRing = mesh(new THREE.TorusGeometry(8.2 + i * 0.16, 0.09,10,64), accent, 0, 13.2 + (i % 2) * 1.1, 0, Math.PI / 2 + (i % 2) * 0.16);
    crownRing.userData.spin = 0.06 + i * 0.018;
    p.add(crownRing);
    updates.push((dt) => { crownRing.rotation.z += dt * crownRing.userData.spin; });
    const crownAntenna = mesh(new THREE.CylinderGeometry(0.07, 0.16, 5.4 + (i % 3) * 2,24), metal, 0, 15.8 + (i % 2), 0);
    p.add(crownAntenna);
    p.add(mesh(new THREE.OctahedronGeometry(0.55, 0), accent, 0, 18.4 + (i % 3) * 2, 0));
    const light = new THREE.PointLight(pavilionColors[i], 240, 30, 2);
    light.position.set(0, 8, 0);
    p.add(light);

    for (let j = 0; j < 5; j++) {
      const a = (j / 5) * TAU + 0.3;
      const r = 7.4;
      p.add(mesh(new THREE.CylinderGeometry(0.06, 0.09, 3.2,24), metal, Math.sin(a) * r, 2.4, Math.cos(a) * r));
      p.add(mesh(new THREE.SphereGeometry(0.15,18,12), j % 2 ? accent : gold, Math.sin(a) * r, 4.1, Math.cos(a) * r));
    }
    for (let j = 0; j < 4; j++) {
      p.add(mesh(new THREE.BoxGeometry(8.4, 0.28, 1.2), j % 2 ? dark : metal, 0, 0.35 + j * 0.35, 8.6 + j * 0.55));
    }
    for (let j = 0; j < 3; j++) {
      const orb = mesh(new THREE.IcosahedronGeometry(0.32,2), accent, Math.sin(j * 2.1) * 3.2, 11 + j * 1.8, Math.cos(j * 2.1) * 3.2);
      orb.userData.baseY = 11 + j * 1.8;
      orb.userData.phase = j * 1.7 + i;
      p.add(orb);
      updates.push((dt, time) => { orb.position.y = orb.userData.baseY + Math.sin(time * 0.55 + orb.userData.phase) * 0.6; });
    }
    // Fine window slits give every hull a second reading at close range.
    const windowGeo = new THREE.PlaneGeometry(0.52, 1.8);
    const windowMat = new THREE.MeshBasicMaterial({ color: 0xffd7a6, transparent: true, opacity: 0.54, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    const windows = new THREE.InstancedMesh(windowGeo, windowMat, 18);
    const wd = new THREE.Object3D();
    for (let j = 0; j < 18; j++) {
      const a = (j / 18) * TAU + 0.17;
      const r = 5.8 + (j % 3) * 0.16;
      wd.position.set(Math.sin(a) * r, 3.4 + Math.floor(j / 9) * 3.1, Math.cos(a) * r);
      wd.rotation.set(0, a, 0);
      wd.updateMatrix();
      windows.setMatrixAt(j, wd.matrix);
    }
    windows.instanceMatrix.needsUpdate = true;
    p.add(windows);
  }

  // ----------------------------------------------------------------- transit
  const transit = new THREE.Group();
  transit.position.y = 24;
  group.add(transit);
  transit.add(mesh(new THREE.TorusGeometry(29, 0.26,10,96), metal, 0, 0, 0, Math.PI / 2 - 0.08));
  transit.add(mesh(new THREE.TorusGeometry(29, 0.07,10,96), pink, 0, 0.24, 0, Math.PI / 2 - 0.08));
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU;
    transit.add(mesh(new THREE.CylinderGeometry(0.15, 0.32, 16.2,24), metal, Math.sin(a) * 29, -8.1, Math.cos(a) * 29, 0, a, 0.05));
  }
  const pods = new THREE.Group();
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * TAU;
    const pod = new THREE.Group();
    pod.add(mesh(new THREE.SphereGeometry(0.58,18,12), i % 2 ? pink : teal));
    pod.add(mesh(new THREE.ConeGeometry(0.22, 1.1,20), metal, 0, -0.75, 0, 0, 0, Math.PI));
    pod.position.set(Math.sin(a) * 29, 0.25, Math.cos(a) * 29);
    pod.rotation.y = -a;
    pods.add(pod);
  }
  transit.add(pods);
  updates.push((dt) => { pods.rotation.y += dt * 0.13; });

  // --------------------------------------------------------- the halo wheel
  const wheel = new THREE.Group();
  wheel.position.set(Math.sin(2.15) * 46, 1.7, Math.cos(2.15) * 46);
  wheel.rotation.y = -2.15;
  group.add(wheel);
  wheel.add(mesh(new THREE.CylinderGeometry(8.5, 9.5, 0.9,24), dark, 0, 0.45, 0));
  wheel.add(mesh(new THREE.TorusGeometry(7.8, 0.12,10,64), gold, 0, 1.0, 0, Math.PI / 2));
  const wheelRing = new THREE.Group();
  wheelRing.position.y = 27;
  wheelRing.rotation.y = 0.08;
  wheel.add(wheelRing);
  wheelRing.add(mesh(new THREE.TorusGeometry(13, 0.45,10,72), metal));
  wheelRing.add(mesh(new THREE.TorusGeometry(13, 0.1,10,72), teal));
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * TAU;
    const pod = new THREE.Group();
    pod.add(mesh(new THREE.SphereGeometry(0.85,18,12), i % 2 ? pink : teal));
    pod.add(mesh(new THREE.ConeGeometry(0.38, 1.6,20), metal, 0, -1.2, 0, 0, 0, Math.PI));
    pod.position.set(Math.cos(a) * 13, Math.sin(a) * 13, 0);
    pod.rotation.z = -a;
    wheelRing.add(pod);
  }
  for (const side of [-1, 1]) {
    wheel.add(mesh(new THREE.CylinderGeometry(0.42, 1.1, 28,24), metal, side * 7.9, 14, 0, 0, 0, side * 0.16));
    wheel.add(mesh(new THREE.CylinderGeometry(0.12, 0.18, 28,24), side * 7.9, 14, 0, 0, 0, side * 0.16));
  }
  wheel.add(mesh(new THREE.CylinderGeometry(2.4, 2.8, 2.2,24), dark, 0, 1.4, 0));
  updates.push((dt) => { wheelRing.rotation.z += dt * 0.09; });

  // ---------------------------------------------------------------- entrance
  const gate = new THREE.Group();
  gate.position.set(Math.sin(0.86) * 50, 1.5, Math.cos(0.86) * 50);
  gate.rotation.y = -0.86;
  group.add(gate);
  for (const x of [-6, 6]) {
    gate.add(mesh(new THREE.BoxGeometry(1.6, 12, 2.2), dark, x, 6, 0));
    gate.add(mesh(new THREE.BoxGeometry(0.3, 8, 0.2), teal, x, 7, 1.15));
  }
  gate.add(mesh(new THREE.TorusGeometry(6.2, 0.3, 5, 32, Math.PI), metal, 0, 11, 0));
  gate.add(mesh(new THREE.TorusGeometry(6.2, 0.1, 4, 32, Math.PI), gold, 0, 11.2, 0));
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU;
    const r = 40 + (i % 2) * 5;
    const post = mesh(new THREE.CylinderGeometry(0.09, 0.16, 4.6,24), dark, Math.sin(a) * r, 2.3, Math.cos(a) * r);
    group.add(post);
    group.add(mesh(new THREE.SphereGeometry(0.22,18,12), gold, Math.sin(a) * r, 4.7, Math.cos(a) * r));
  }

  // --------------------------------------------------------------- details
  const details = new THREE.Group();
  group.add(details);
  const detailRng = mulberry32(7781);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU + 0.18;
    const r = 41;
    const stall = new THREE.Group();
    stall.position.set(Math.sin(a) * r, 1.6, Math.cos(a) * r);
    stall.rotation.y = -a;
    stall.add(mesh(new THREE.BoxGeometry(3.2, 1.1, 2.2), dark, 0, 0.6, 0));
    stall.add(mesh(new THREE.BoxGeometry(3.6, 0.16, 2.5), gold, 0, 1.3, 0));
    for (const x of [-1.35, 1.35]) stall.add(mesh(new THREE.CylinderGeometry(0.08, 0.08, 2.4,24), metal, x, 2.2, 0));
    stall.add(mesh(new THREE.BoxGeometry(3.8, 0.18, 0.2), teal, 0, 3.35, 0.9));
    details.add(stall);
  }
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * TAU + 0.1;
    const r = 36 + (i % 3) * 3;
    const h = range(detailRng, 2.4, 5.2);
    details.add(mesh(new THREE.CylinderGeometry(0.07, 0.12, h,24), metal, Math.sin(a) * r, 1.5 + h / 2, Math.cos(a) * r));
    details.add(mesh(new THREE.SphereGeometry(0.18,18,12), i % 2 ? teal : gold, Math.sin(a) * r, 1.5 + h + 0.1, Math.cos(a) * r));
  }

  // animated bloom rings + floating debris
  updates.push((dt) => {
    petals.rotation.y += dt * 0.025;
    core.rotation.y -= dt * 0.11;
  });

  for (let i = 0; i < 12; i++) {
    const a = range(rng, 0, TAU);
    const r = range(rng, 44, 70);
    const y = range(rng, 18, 45);
    const rock = mesh(new THREE.IcosahedronGeometry(range(rng, 0.8, 2.8), 0), pick(rng, [metal, dark]), Math.sin(a) * r, y, Math.cos(a) * r);
    rock.userData.baseY = y;
    rock.userData.phase = range(rng, 0, TAU);
    group.add(rock);
    updates.push((dt, time) => {
      rock.position.y = rock.userData.baseY + Math.sin(time * 0.4 + rock.userData.phase) * 0.8;
      rock.rotation.y += dt * 0.03;
    });
  }

  return { group, updates };
}
