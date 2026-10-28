// Sagrada Família — environment: sky, sun/day-night cycle, plaza, city context,
// trees, street furniture, night illumination and world lighting.
// The Lead owns this file.

import * as THREE from 'three';
import {
  stoneMat,
  glassMaterial,
  textTexture,
  rng,
  rand,
  pick,
  clamp,
  lerp,
  smoothstep,
  addMerged,
  mergeGeos,
  instancedMesh,
  matrixAt,
  boxGeo,
  cylGeo,
  coneGeo,
  sphereGeo,
  figureGeo,
  hotspot,
  boxCollider,
  circleCollider,
} from './lib.js';
import { DIM } from './config.js';

// ---------------------------------------------------------------------------
// Small canvas helpers
// ---------------------------------------------------------------------------

function makeCanvas(size) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  return c;
}

function plazaTexture() {
  const S = 1024;
  const c = makeCanvas(S);
  const g = c.getContext('2d');
  const r = rng(81);
  g.fillStyle = '#b8ad9b';
  g.fillRect(0, 0, S, S);

  // fine stone grain
  for (let i = 0; i < 26000; i++) {
    const v = Math.floor(rand(r, 140, 210));
    g.fillStyle = `rgba(${v},${v - 6},${v - 16},${rand(r, 0.03, 0.12).toFixed(2)})`;
    g.fillRect(r() * S, r() * S, rand(r, 1, 3), rand(r, 1, 3));
  }
  // concentric rings
  const cx = S / 2;
  const cy = S / 2;
  for (let i = 0; i < 18; i++) {
    const rad = (i + 0.5) * (S / 36);
    g.strokeStyle = i % 2 === 0 ? 'rgba(88,79,66,0.35)' : 'rgba(238,230,212,0.3)';
    g.lineWidth = i % 2 === 0 ? 2.2 : 1.1;
    g.beginPath();
    g.arc(cx, cy, rad, 0, Math.PI * 2);
    g.stroke();
  }
  // radial pattern
  for (let i = 0; i < 48; i++) {
    const a = (i / 48) * Math.PI * 2;
    g.strokeStyle = i % 3 === 0 ? 'rgba(80,72,60,0.28)' : 'rgba(235,228,212,0.22)';
    g.lineWidth = i % 3 === 0 ? 1.8 : 0.8;
    g.beginPath();
    g.moveTo(cx + Math.cos(a) * S * 0.04, cy + Math.sin(a) * S * 0.04);
    g.lineTo(cx + Math.cos(a) * S * 0.5, cy + Math.sin(a) * S * 0.5);
    g.stroke();
  }
  // paving slabs in the outer band
  g.strokeStyle = 'rgba(84,76,64,0.22)';
  g.lineWidth = 1;
  const step = S / 64;
  for (let x = 0; x < S; x += step) {
    g.beginPath();
    g.moveTo(x, 0);
    g.lineTo(x, S);
    g.stroke();
    g.beginPath();
    g.moveTo(0, x);
    g.lineTo(S, x);
    g.stroke();
  }
  // stains and worn paths
  for (let i = 0; i < 140; i++) {
    g.fillStyle = `rgba(70,62,50,${rand(r, 0.01, 0.055).toFixed(3)})`;
    g.beginPath();
    g.ellipse(r() * S, r() * S, rand(r, 8, 80), rand(r, 5, 50), r() * Math.PI, 0, Math.PI * 2);
    g.fill();
  }
  // darker ring around the building footprint
  const grd = g.createRadialGradient(cx, cy, S * 0.18, cx, cy, S * 0.26);
  grd.addColorStop(0, 'rgba(60,54,45,0.34)');
  grd.addColorStop(1, 'rgba(60,54,45,0)');
  g.fillStyle = grd;
  g.beginPath();
  g.arc(cx, cy, S * 0.26, 0, Math.PI * 2);
  g.fill();

  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

function facadeTexture() {
  const S = 512;
  const c = makeCanvas(S);
  const g = c.getContext('2d');
  const r = rng(93);
  g.fillStyle = '#cbbda6';
  g.fillRect(0, 0, S, S);
  for (let i = 0; i < 2200; i++) {
    g.fillStyle = `rgba(120,100,75,${rand(r, 0.02, 0.1).toFixed(2)})`;
    g.fillRect(r() * S, r() * S, rand(r, 2, 20), rand(r, 1, 5));
  }
  // window grid
  const cols = 6;
  const rows = 9;
  const cw = S / cols;
  const ch = S / rows;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const px = x * cw + cw * 0.2;
      const py = y * ch + ch * 0.18;
      const ww = cw * 0.6;
      const wh = ch * 0.58;
      // recess
      g.fillStyle = 'rgba(50,45,38,0.55)';
      g.fillRect(px - 2, py - 2, ww + 4, wh + 4);
      // glass, unlit by day
      const lit = r() < 0.32;
      g.fillStyle = lit ? `rgba(${Math.floor(rand(r, 150, 240))},${Math.floor(rand(r, 120, 190))},${Math.floor(rand(r, 70, 130))},0.38)` : 'rgba(38,48,58,0.9)';
      g.fillRect(px, py, ww, wh);
      // shutters / balconies
      if (r() < 0.4) {
        g.fillStyle = 'rgba(72,60,45,0.55)';
        g.fillRect(px - 1, py + wh, ww + 2, 3);
      }
      if (r() < 0.25) {
        g.strokeStyle = 'rgba(45,40,34,0.65)';
        g.lineWidth = 2;
        for (let b = 0; b < 4; b++) {
          const bx = px + (ww / 4) * b;
          g.beginPath();
          g.moveTo(bx, py);
          g.lineTo(bx, py + wh);
          g.stroke();
        }
      }
    }
  }
  // cornice lines
  g.strokeStyle = 'rgba(80,68,52,0.5)';
  g.lineWidth = 5;
  for (let y = 1; y < rows; y++) {
    g.beginPath();
    g.moveTo(0, y * ch);
    g.lineTo(S, y * ch);
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

function facadeEmissiveTexture() {
  const S = 512;
  const c = makeCanvas(S);
  const g = c.getContext('2d');
  const r = rng(97);
  g.fillStyle = '#000';
  g.fillRect(0, 0, S, S);
  const cols = 6;
  const rows = 9;
  const cw = S / cols;
  const ch = S / rows;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (r() < 0.44) {
        const px = x * cw + cw * 0.2;
        const py = y * ch + ch * 0.18;
        const warm = r() < 0.72;
        g.fillStyle = warm ? `rgba(${Math.floor(rand(r, 180, 255))},${Math.floor(rand(r, 120, 190))},${Math.floor(rand(r, 50, 110))},${rand(r, 0.55, 1).toFixed(2)})` : `rgba(${Math.floor(rand(r, 100, 160))},${Math.floor(rand(r, 160, 210))},${Math.floor(rand(r, 180, 240))},${rand(r, 0.4, 0.8).toFixed(2)})`;
        g.fillRect(px, py, cw * 0.6, ch * 0.58);
      }
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

function moonTexture() {
  const S = 128;
  const c = makeCanvas(S);
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(S / 2, S / 2, S * 0.1, S / 2, S / 2, S * 0.5);
  grd.addColorStop(0, 'rgba(245,246,255,1)');
  grd.addColorStop(0.45, 'rgba(225,230,245,0.95)');
  grd.addColorStop(0.6, 'rgba(200,212,238,0.35)');
  grd.addColorStop(1, 'rgba(160,180,220,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, S, S);
  // subtle maria
  g.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 9; i++) {
    g.fillStyle = `rgba(0,0,0,${rand(rng(i + 1), 0.03, 0.1).toFixed(2)})`;
    g.beginPath();
    g.arc(rand(rng(i + 7), 35, 90), rand(rng(i + 3), 35, 90), rand(rng(i + 5), 5, 18), 0, Math.PI * 2);
    g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function lampGlowTexture() {
  const S = 128;
  const c = makeCanvas(S);
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  grd.addColorStop(0, 'rgba(255,214,150,0.9)');
  grd.addColorStop(0.35, 'rgba(255,176,90,0.35)');
  grd.addColorStop(1, 'rgba(255,150,60,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, S, S);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// ---------------------------------------------------------------------------
// Builder
// ---------------------------------------------------------------------------

export function buildEnvironment(ctx) {
  const group = new THREE.Group();
  group.name = 'environment';
  const r = rng(2026);
  const colliders = [];
  const hotspots = [];
  const walkables = [];
  const nightMaterials = [];
  const qualityHooks = [];

  // ------------------------------------------------------------------ lights
  const hemi = new THREE.HemisphereLight(0xbcd7f2, 0x7c6f5b, 1.1);
  group.add(hemi);

  const ambient = new THREE.AmbientLight(0x8ea4c0, 0.14);
  group.add(ambient);

  const sun = new THREE.DirectionalLight(0xfff2dc, 3.2);
  sun.position.set(180, 260, 120);
  sun.castShadow = true;
  sun.shadow.mapSize.set(4096, 4096);
  sun.shadow.camera.left = -180;
  sun.shadow.camera.right = 180;
  sun.shadow.camera.top = 240;
  sun.shadow.camera.bottom = -180;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 800;
  sun.shadow.bias = -0.00018;
  sun.shadow.normalBias = 0.55;
  sun.shadow.radius = 4;
  sun.target.position.set(0, 55, 0);
  group.add(sun);
  group.add(sun.target);

  const moon = new THREE.DirectionalLight(0x8ea8d6, 0.0);
  moon.position.set(-180, 220, -120);
  moon.target.position.set(0, 40, 0);
  group.add(moon);
  group.add(moon.target);

  // Facade floodlights (off by day).
  const floodTargets = [
    [48, 2.5, -20, 30, 30, 0, 0.5, 0xffd9a6, 1150],
    [-48, 2.5, 20, -30, 30, 0, 0.5, 0xffd9a6, 1150],
    [4, 2.5, 78, 0, 34, 45, 0.58, 0xffd6a0, 1450],
    [28, 2.5, 30, 0, 112, 0, 0.3, 0xffe0b8, 1700],
  ];
  const floods = [];
  for (const [x, y, z, tx, ty, tz, angle, color, intensity] of floodTargets) {
    const spot = new THREE.SpotLight(color, 0, 190, angle, 0.75, 1.35);
    spot.position.set(x, y, z);
    spot.target.position.set(tx, ty, tz);
    spot.castShadow = false;
    group.add(spot);
    group.add(spot.target);
    floods.push({ light: spot, intensity });
  }
  const floodCones = [];
  const coneMat = new THREE.MeshBasicMaterial({
    color: 0xffd9a0,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    fog: false,
  });
  for (const [x, y, z, tx, ty, tz] of floodTargets) {
    const a = new THREE.Vector3(x, y, z);
    const b = new THREE.Vector3(tx, ty, tz);
    const len = a.distanceTo(b);
    const mid = a.clone().add(b).multiplyScalar(0.5);
    const dir = b.clone().sub(a).normalize();
    const cone = new THREE.Mesh(new THREE.ConeGeometry(len * 0.075, len, 12, 1, true), coneMat);
    cone.position.copy(mid);
    cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir);
    cone.renderOrder = 2;
    group.add(cone);
    floodCones.push(cone);
  }

  // --------------------------------------------------------- image environment
  // A small PMREM IBL map gives the gold finials, bronze bells and stone a
  // believable sky/ground reflection (metallic materials are black without it).
  function makeEquirect(night) {
    const w = 512;
    const h = 256;
    const c = makeCanvas(w);
    c.width = w;
    c.height = h;
    const g = c.getContext('2d');
    const grd = g.createLinearGradient(0, 0, 0, h);
    if (night) {
      grd.addColorStop(0, '#03050d');
      grd.addColorStop(0.46, '#0a1220');
      grd.addColorStop(0.52, '#1a2233');
      grd.addColorStop(0.54, '#0e1014');
      grd.addColorStop(1, '#050608');
    } else {
      grd.addColorStop(0, '#3d70b6');
      grd.addColorStop(0.38, '#8fb5d8');
      grd.addColorStop(0.5, '#dbe6e4');
      grd.addColorStop(0.53, '#8d8272');
      grd.addColorStop(1, '#4d463a');
    }
    g.fillStyle = grd;
    g.fillRect(0, 0, w, h);
    if (!night) {
      const sun = g.createRadialGradient(w * 0.72, h * 0.33, 4, w * 0.72, h * 0.33, w * 0.28);
      sun.addColorStop(0, 'rgba(255,248,225,1)');
      sun.addColorStop(0.06, 'rgba(255,238,200,0.9)');
      sun.addColorStop(0.3, 'rgba(255,220,160,0.25)');
      sun.addColorStop(1, 'rgba(255,210,150,0)');
      g.fillStyle = sun;
      g.fillRect(0, 0, w, h);
    } else {
      const glow = g.createLinearGradient(0, h * 0.45, 0, h * 0.55);
      glow.addColorStop(0, 'rgba(255,170,90,0)');
      glow.addColorStop(0.7, 'rgba(255,150,80,0.35)');
      glow.addColorStop(1, 'rgba(255,130,60,0)');
      g.fillStyle = glow;
      g.fillRect(0, h * 0.45, w, h * 0.12);
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.mapping = THREE.EquirectangularReflectionMapping;
    return t;
  }
  let envMapDay = null;
  let envMapNight = null;
  try {
    const pmrem = new THREE.PMREMGenerator(ctx.renderer);
    pmrem.compileEquirectangularShader();
    const tDay = makeEquirect(false);
    const tNight = makeEquirect(true);
    envMapDay = pmrem.fromEquirectangular(tDay).texture;
    envMapNight = pmrem.fromEquirectangular(tNight).texture;
    tDay.dispose();
    tNight.dispose();
    pmrem.dispose();
    ctx.scene.environment = envMapDay;
    ctx.scene.environmentIntensity = 0.62;
  } catch (e) {
    console.warn('environment map generation failed', e);
  }

  // -------------------------------------------------------------------- sky
  const skyUniforms = {
    uSunDir: { value: new THREE.Vector3(0, 1, 0) },
    uSunColor: { value: new THREE.Color(0xfff3dc) },
    uZenith: { value: new THREE.Color(0x3568b0) },
    uHorizon: { value: new THREE.Color(0xcfdfe3) },
    uGround: { value: new THREE.Color(0x6f6b60) },
    uNight: { value: 0 },
    uSunAlt: { value: 1 },
    uTime: { value: 0 },
    uDetail: { value: 1 },
  };
  const skyMat = new THREE.ShaderMaterial({
    uniforms: skyUniforms,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uSunDir;
      uniform vec3 uSunColor;
      uniform vec3 uZenith;
      uniform vec3 uHorizon;
      uniform vec3 uGround;
      uniform float uNight;
      uniform float uSunAlt;
      uniform float uTime;
      uniform float uDetail;
      varying vec3 vDir;

      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
      }
      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
                   mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
      }
      float fbm(vec2 p) {
        float v = 0.0;
        float a = 0.5;
        mat2 rot = mat2(0.8, -0.6, 0.6, 0.8);
        for (int i = 0; i < 4; i++) {
          v += a * noise(p);
          p = rot * p * 2.03 + vec2(1.7, 9.2);
          a *= 0.5;
        }
        return v;
      }

      void main() {
        vec3 d = normalize(vDir);
        float h = clamp(d.y, -1.0, 1.0);
        float up = pow(clamp(h, 0.0, 1.0), 0.62);
        vec3 col = mix(uHorizon, uZenith, up);
        if (h < 0.0) {
          col = mix(uHorizon, uGround, clamp(-h * 3.0, 0.0, 1.0));
        }

        // sun glow and disc
        float sd = max(dot(d, uSunDir), 0.0);
        float glow = pow(sd, 9.0) * 0.22 + pow(sd, 90.0) * 0.45 + pow(sd, 600.0) * 0.7;
        col += uSunColor * glow * (1.0 - uNight * 0.86);
        float disc = smoothstep(0.99955, 0.99985, sd);
        col += uSunColor * disc * 2.2 * (1.0 - uNight * 0.9);

        // low sun horizon burn
        float burn = pow(max(1.0 - abs(uSunAlt) * 4.0, 0.0), 3.0);
        float horizonBand = pow(1.0 - clamp(abs(h) * 4.5, 0.0, 1.0), 2.0);
        col += vec3(1.0, 0.48, 0.18) * burn * horizonBand * 0.22 * (1.0 - uNight);

        // clouds, only above the horizon and mostly by day (skipped in lean mode)
        if (h > 0.015 && uDetail > 0.5) {
          vec2 cp = d.xz / (h + 0.28);
          float cl = fbm(cp * 1.35 + vec2(uTime * 0.0025, uTime * 0.001));
          cl = smoothstep(0.52, 0.78, cl);
          float cl2 = fbm(cp * 2.7 - vec2(uTime * 0.004, 0.0));
          cl2 = smoothstep(0.62, 0.86, cl2) * 0.4;
          float cloud = clamp(cl + cl2, 0.0, 1.0) * smoothstep(0.015, 0.12, h);
          vec3 cloudCol = mix(vec3(0.56, 0.6, 0.67), vec3(1.0, 0.9, 0.78), pow(sd, 2.0));
          cloudCol = mix(cloudCol, vec3(0.12, 0.14, 0.2), uNight);
          col = mix(col, cloudCol, cloud * 0.55 * (1.0 - uNight * 0.55));
        }

        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(1500, 32, 18), skyMat);
  sky.renderOrder = -1000;
  sky.frustumCulled = false;
  group.add(sky);
  // Software rasterisation cannot afford the fbm cloud pass every pixel.
  skyUniforms.uDetail.value = ctx.app?.softwareRenderer || ctx.env?.software ? 0 : 1;

  // stars
  const starCount = 1400;
  const starPos = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i++) {
    const u = r();
    const v = r() * 0.92 + 0.08;
    const theta = u * Math.PI * 2;
    const phi = Math.acos(v);
    const rad = 1380;
    starPos[i * 3] = rad * Math.sin(phi) * Math.cos(theta);
    starPos[i * 3 + 1] = rad * Math.cos(phi);
    starPos[i * 3 + 2] = rad * Math.sin(phi) * Math.sin(theta);
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  const starMat = new THREE.PointsMaterial({
    color: 0xdfe8ff,
    size: 1.9,
    sizeAttenuation: false,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    fog: false,
    blending: THREE.AdditiveBlending,
  });
  const stars = new THREE.Points(starGeo, starMat);
  stars.frustumCulled = false;
  group.add(stars);

  // moon sprite
  const moonMat = new THREE.SpriteMaterial({ map: moonTexture(), transparent: true, opacity: 0, depthWrite: false, fog: false });
  const moonSprite = new THREE.Sprite(moonMat);
  moonSprite.scale.setScalar(80);
  group.add(moonSprite);

  // ------------------------------------------------------------------ plaza
  const plaza = new THREE.Mesh(
    new THREE.CircleGeometry(152, 96),
    new THREE.MeshStandardMaterial({
      map: plazaTexture(),
      color: 0xe8dfcd,
      roughness: 0.93,
      metalness: 0.02,
    })
  );
  plaza.rotation.x = -Math.PI / 2;
  plaza.position.y = -0.055;
  plaza.receiveShadow = true;
  plaza.name = 'plaza';
  group.add(plaza);
  walkables.push(plaza);

  // dark ring / kerb around the plaza
  const kerbMat = stoneMat(0x6f6758, { roughness: 0.9, repeat: 8 });
  const kerb = new THREE.Mesh(new THREE.RingGeometry(150.5, 156, 96, 1), kerbMat);
  kerb.rotation.x = -Math.PI / 2;
  kerb.position.y = 0.01;
  kerb.receiveShadow = true;
  group.add(kerb);

  // ring road and green belt between the plaza and the Eixample blocks
  const road = new THREE.Mesh(
    new THREE.RingGeometry(157, 173, 96, 1),
    new THREE.MeshStandardMaterial({ color: 0x35373a, roughness: 0.92, metalness: 0.02 })
  );
  road.rotation.x = -Math.PI / 2;
  road.position.y = -0.03;
  road.receiveShadow = true;
  group.add(road);
  const belt = new THREE.Mesh(
    new THREE.RingGeometry(173, 190, 96, 1),
    new THREE.MeshStandardMaterial({ color: 0x53633f, roughness: 1, metalness: 0 })
  );
  belt.rotation.x = -Math.PI / 2;
  belt.position.y = -0.055;
  belt.receiveShadow = true;
  group.add(belt);

  // base earth / grass plane
  const earth = new THREE.Mesh(
    new THREE.CircleGeometry(700, 80),
    new THREE.MeshStandardMaterial({ color: 0x666a52, roughness: 1, metalness: 0 })
  );
  earth.rotation.x = -Math.PI / 2;
  earth.position.y = -0.22;
  earth.receiveShadow = true;
  group.add(earth);

  // ------------------------------------------------------------------ city
  const cityGroup = new THREE.Group();
  cityGroup.name = 'city';
  group.add(cityGroup);
  const facadeMap = facadeTexture();
  const facadeEmissive = facadeEmissiveTexture();
  const cityMat = new THREE.MeshStandardMaterial({
    map: facadeMap,
    emissiveMap: facadeEmissive,
    emissive: new THREE.Color(0xffb463),
    emissiveIntensity: 0,
    roughness: 0.9,
    metalness: 0.02,
    vertexColors: false,
  });
  const cityGeo = new THREE.BoxGeometry(1, 1, 1);
  cityGeo.translate(0, 0.5, 0);
  const cityPalette = [0xd8c8ae, 0xc9b59a, 0xbfae94, 0xd3c3ac, 0xb9a88f, 0xcbbba0, 0xa9977e];
  const blocks = [];
  const step = 50;
  for (let gx = -360; gx <= 360; gx += step) {
    for (let gz = -360; gz <= 360; gz += step) {
      const cx = gx + rand(r, -3, 3);
      const cz = gz + rand(r, -3, 3);
      const dist = Math.hypot(cx, cz);
      if (dist < 196 || dist > 430) continue;
      if (r() < 0.22) continue; // courtyards, squares, gaps between blocks
      const w = rand(r, 22, 32);
      const d = rand(r, 22, 32);
      const h = rand(r, 13, 26) * (dist > 300 ? 1.18 : 1);
      blocks.push({ x: cx, z: cz, w, d, h, color: pick(r, cityPalette) });
    }
  }
  const cityMesh = new THREE.InstancedMesh(cityGeo, cityMat, blocks.length);
  const m = new THREE.Matrix4();
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    m.compose(
      new THREE.Vector3(b.x, 0, b.z),
      new THREE.Quaternion(),
      new THREE.Vector3(b.w, b.h, b.d)
    );
    cityMesh.setMatrixAt(i, m);
    cityMesh.setColorAt(i, new THREE.Color(b.color));
  }
  cityMesh.instanceMatrix.needsUpdate = true;
  if (cityMesh.instanceColor) cityMesh.instanceColor.needsUpdate = true;
  cityMesh.castShadow = false;
  cityMesh.receiveShadow = false;
  cityMesh.frustumCulled = false;
  cityGroup.add(cityMesh);

  // a few taller landmark blocks to break the roofline
  const landmarkMat = new THREE.MeshStandardMaterial({ map: facadeMap, roughness: 0.9, metalness: 0.02 });
  const landmarks = [];
  for (let i = 0; i < 7; i++) {
    const a = r() * Math.PI * 2;
    const dist = rand(r, 250, 390);
    const x = Math.cos(a) * dist;
    const z = Math.sin(a) * dist;
    if (Math.hypot(x, z) < 220) continue;
    const h = rand(r, 30, 52);
    landmarks.push(boxGeo(rand(r, 16, 26), h, rand(r, 16, 26), x, h / 2, z));
  }
  addMerged(cityGroup, landmarks, landmarkMat, { castShadow: false, receiveShadow: false });

  // distant hills / Tibidabo silhouette: low, dark, overlapping ridges
  const hillMat = new THREE.MeshStandardMaterial({ color: 0x2f403c, roughness: 1, metalness: 0, fog: true, flatShading: true });
  const hillParts = [];
  const hillDefs = [
    [-540, -760, 520, 120, 280],
    [-260, -880, 420, 96, 240],
    [-820, -580, 460, 108, 260],
    [430, -840, 420, 84, 280],
    [820, -620, 400, 72, 230],
    [-900, 160, 430, 76, 280],
    [540, 800, 460, 66, 280],
  ];
  for (const [x, z, w, h, d] of hillDefs) {
    const g = new THREE.SphereGeometry(0.5, 12, 7, 0, Math.PI * 2, 0, Math.PI / 2);
    g.scale(w, h, d);
    g.translate(x, 0, z);
    hillParts.push(g);
  }
  addMerged(group, hillParts, hillMat, { castShadow: false, receiveShadow: false });

  // -------------------------------------------------------------- greenery
  const trunkMat = stoneMat(0x5b4632, { roughness: 0.95, repeat: 2, bumpScale: 0.2 });
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x4e6f4a, roughness: 0.92, metalness: 0.02, flatShading: true });
  const treePositions = [];
  // ring of plane trees around the plaza
  for (let i = 0; i < 34; i++) {
    const a = (i / 34) * Math.PI * 2 + rand(r, -0.03, 0.03);
    const dist = rand(r, 140, 157);
    treePositions.push({ x: Math.cos(a) * dist, z: Math.sin(a) * dist, s: rand(r, 0.85, 1.3) });
  }
  // street trees further out
  for (let i = 0; i < 90; i++) {
    const a = r() * Math.PI * 2;
    const dist = rand(r, 170, 330);
    const x = Math.cos(a) * dist;
    const z = Math.sin(a) * dist;
    if (Math.abs(x) % 44 < 8 || Math.abs(z) % 44 < 8) {
      treePositions.push({ x, z, s: rand(r, 0.7, 1.25) });
    }
  }
  const trunkGeo = new THREE.CylinderGeometry(0.28, 0.42, 4.2, 6);
  trunkGeo.translate(0, 2.1, 0);
  const trunkMesh = new THREE.InstancedMesh(trunkGeo, trunkMat, treePositions.length);
  const leafGeo = new THREE.IcosahedronGeometry(2.5, 1);
  const leafMesh = new THREE.InstancedMesh(leafGeo, leafMat, treePositions.length * 3);
  let li = 0;
  for (let i = 0; i < treePositions.length; i++) {
    const t = treePositions[i];
    const rot = r() * Math.PI * 2;
    m.compose(new THREE.Vector3(t.x, 0, t.z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rot, 0)), new THREE.Vector3(t.s, t.s, t.s));
    trunkMesh.setMatrixAt(i, m);
    const clumps = [
      [0, 4.6, 0, 1.5],
      [1.0, 5.6, 0.4, 1.05],
      [-0.8, 5.9, -0.6, 0.95],
    ];
    for (const [cx, cy, cz, cs] of clumps) {
      m.compose(
        new THREE.Vector3(t.x + cx * t.s, cy * t.s, t.z + cz * t.s),
        new THREE.Quaternion(),
        new THREE.Vector3(cs * t.s, cs * t.s * 0.85, cs * t.s)
      );
      leafMesh.setMatrixAt(li, m);
      leafMesh.setColorAt(li, new THREE.Color().setHSL(rand(r, 0.22, 0.32), rand(r, 0.2, 0.38), rand(r, 0.2, 0.34)));
      li++;
    }
  }
  trunkMesh.instanceMatrix.needsUpdate = true;
  leafMesh.instanceMatrix.needsUpdate = true;
  if (leafMesh.instanceColor) leafMesh.instanceColor.needsUpdate = true;
  trunkMesh.castShadow = true;
  trunkMesh.receiveShadow = true;
  leafMesh.castShadow = true;
  leafMesh.receiveShadow = true;
  trunkMesh.frustumCulled = false;
  leafMesh.frustumCulled = false;
  group.add(trunkMesh);
  group.add(leafMesh);

  // low hedges framing the plaza edge
  const hedgeMat = new THREE.MeshStandardMaterial({ color: 0x38543a, roughness: 0.95, flatShading: true });
  const hedgeParts = [];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const dist = 163;
    const x = Math.cos(a) * dist;
    const z = Math.sin(a) * dist;
    const g = boxGeo(26, 1.1, 3.2, x, 0.55, z);
    g.rotateY(-a);
    hedgeParts.push(g);
  }
  addMerged(group, hedgeParts, hedgeMat, { castShadow: true, receiveShadow: true });

  // ---------------------------------------------------------- street furniture
  const metal = new THREE.MeshStandardMaterial({ color: 0x2f3430, roughness: 0.55, metalness: 0.65 });
  const wood = new THREE.MeshStandardMaterial({ color: 0x6b4b2c, roughness: 0.8 });
  const benchGeo = [];
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + 0.16;
    const dist = 132;
    const x = Math.cos(a) * dist;
    const z = Math.sin(a) * dist;
    const rot = -a + Math.PI / 2;
    // seat slats
    for (let k = 0; k < 3; k++) {
      benchGeo.push(boxGeo(2.4, 0.06, 0.14, x, 0.47, z, rot));
    }
    // legs
    for (const off of [-0.9, 0.9]) {
      const dx = Math.cos(rot) * off;
      const dz = -Math.sin(rot) * off;
      benchGeo.push(boxGeo(0.08, 0.47, 0.5, x + dx, 0.235, z + dz, rot));
    }
    colliders.push(boxCollider(x, z, 1.35, 0.45, { y0: 0, y1: 1 }));
  }
  addMerged(group, benchGeo, wood, { castShadow: true, receiveShadow: true });
  // bench supports in metal
  const benchMetal = [];
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + 0.16;
    const dist = 132;
    const x = Math.cos(a) * dist;
    const z = Math.sin(a) * dist;
    benchMetal.push(boxGeo(0.1, 0.42, 0.5, x, 0.21, z, -a + Math.PI / 2));
  }
  addMerged(group, benchMetal, metal, { castShadow: true, receiveShadow: true });

  // lamp posts
  const lampPosts = [];
  const lampGlobes = [];
  const globeMat = new THREE.MeshBasicMaterial({ color: 0x2b2c26 });
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 + 0.32;
    const dist = 122;
    const x = Math.cos(a) * dist;
    const z = Math.sin(a) * dist;
    lampPosts.push(cylGeo(0.08, 0.13, 5.6, 8, x, 2.8, z));
    lampPosts.push(boxGeo(0.5, 0.12, 0.5, x, 5.68, z));
    lampGlobes.push({ x, z });
    colliders.push(circleCollider(x, z, 0.3, { y0: 0, y1: 6 }));
  }
  addMerged(group, lampPosts, metal, { castShadow: true, receiveShadow: true });
  const globeGeo = new THREE.SphereGeometry(0.28, 10, 8);
  const globes = new THREE.InstancedMesh(globeGeo, globeMat, lampGlobes.length);
  for (let i = 0; i < lampGlobes.length; i++) {
    const p = lampGlobes[i];
    globes.setMatrixAt(i, matrixAt(p.x, 5.95, p.z));
  }
  globes.instanceMatrix.needsUpdate = true;
  globes.frustumCulled = false;
  group.add(globes);
  const glowMat = new THREE.SpriteMaterial({ map: lampGlowTexture(), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
  for (const p of lampGlobes) {
    const spr = new THREE.Sprite(glowMat);
    spr.position.set(p.x, 5.95, p.z);
    spr.scale.setScalar(4.2);
    group.add(spr);
  }
  nightMaterials.push({ update: (night) => {
    globeMat.color.setRGB(lerp(0.18, 1.0, night), lerp(0.17, 0.72, night), lerp(0.15, 0.38, night));
    glowMat.opacity = night * 0.55;
  } });

  // information monolith at the south-east approach
  const signGroup = new THREE.Group();
  const signTex = textTexture('LA SAGRADA FAMÍLIA', { font: '600 46px Georgia, serif', color: '#2a2a26', bg: '#e9e2d2', pad: 30, letterSpacing: 4 });
  const signPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(7, 1.55),
    new THREE.MeshBasicMaterial({ map: signTex, toneMapped: false })
  );
  signPlane.position.set(0, 2.4, 0.06);
  const signBody = new THREE.Mesh(new THREE.BoxGeometry(7.6, 3.2, 0.18), stoneMat(0x4a4a44, { roughness: 0.8, repeat: 1 }));
  signBody.position.y = 1.6;
  signBody.castShadow = true;
  signGroup.add(signBody);
  signGroup.add(signPlane);
  signGroup.position.set(58, 0, 96);
  signGroup.rotation.y = -Math.PI / 4 + Math.PI;
  group.add(signGroup);
  colliders.push(boxCollider(58, 96, 3.9, 0.4, { y0: 0, y1: 3.2 }));

  // bollards around the cathedral forecourt
  const bollardGeo = [];
  for (let i = 0; i < 28; i++) {
    const a = (i / 28) * Math.PI * 2;
    const dist = 108;
    const x = Math.cos(a) * dist;
    const z = Math.sin(a) * dist;
    bollardGeo.push(cylGeo(0.13, 0.16, 0.85, 8, x, 0.42, z));
  }
  addMerged(group, bollardGeo, metal, { castShadow: true, receiveShadow: true });

  // -------------------------------------------------------------- people
  const clothing = [0x8e3b32, 0x2f4e63, 0x6c6a5c, 0x8b7a5b, 0x3d5a48, 0xa06a45, 0x5a4b63, 0xb8b0a2];
  const skin = new THREE.MeshStandardMaterial({ color: 0xb98b6f, roughness: 0.7 });
  const hair = new THREE.MeshStandardMaterial({ color: 0x3a2b22, roughness: 0.9 });
  const personClothMats = clothing.map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.85 }));
  const peopleGroup = new THREE.Group();
  const spots = [
    [58, 84, -0.7], [64, 90, -1.1], [52, 102, -0.3], [-42, 96, 0.5], [-58, 84, 0.9],
    [30, 106, -0.2], [-30, 112, 0.8], [90, 52, -1.4], [-92, 44, 1.2], [76, -42, -2.2],
    [-80, -34, 2.3], [18, 122, 0.1], [104, 12, -1.6], [-106, 16, 1.7],
  ];
  const clothGeos = clothing.map(() => []);
  const skinGeos = [];
  const hairGeos = [];
  for (let i = 0; i < spots.length; i++) {
    const [x, z, ry] = spots[i];
    const s = rand(r, 0.92, 1.06);
    const ci = i % clothing.length;
    // legs
    for (const side of [-1, 1]) {
      cladGeo(clothGeos[ci], cylGeo(0.07 * s, 0.08 * s, 0.82, 6, x + Math.cos(ry) * side * 0.11, 0.41, z + Math.sin(ry) * side * 0.11));
    }
    // torso
    cladGeo(clothGeos[ci], new THREE.CapsuleGeometry(0.19 * s, 0.34, 3, 7).translate(x, 1.16, z));
    // arms
    cladGeo(clothGeos[ci], cylGeo(0.055, 0.06, 0.55, 5, x + 0.24, 1.03, z));
    cladGeo(clothGeos[ci], cylGeo(0.055, 0.06, 0.55, 5, x - 0.24, 1.03, z));
    // head
    skinGeos.push(sphereGeo(0.12 * s, 9, x, 1.55, z));
    // hair cap
    hairGeos.push(sphereGeo(0.123 * s, 8, x, 1.58, z, 0));
    // rotate torso etc? Keep figures facing mostly outward; build a group rotation would be cleaner.
  }
  function cladGeo(arr, geo) {
    geo.rotateY(0);
    arr.push(geo);
  }
  for (let i = 0; i < clothing.length; i++) {
    if (clothGeos[i].length) addMerged(peopleGroup, clothGeos[i], personClothMats[i], { castShadow: true, receiveShadow: true });
  }
  addMerged(peopleGroup, skinGeos, skin, { castShadow: true, receiveShadow: true });
  addMerged(peopleGroup, hairGeos, hair, { castShadow: true, receiveShadow: true });
  group.add(peopleGroup);

  // pigeons
  const pigeonMat = new THREE.MeshStandardMaterial({ color: 0x8d8f92, roughness: 0.8 });
  const pigeonGeos = [];
  for (let i = 0; i < 26; i++) {
    const a = r() * Math.PI * 2;
    const dist = rand(r, 60, 128);
    const x = Math.cos(a) * dist;
    const z = Math.sin(a) * dist;
    const y = 0.09;
    pigeonGeos.push(sphereGeo(0.075, 6, x, y + 0.08, z));
    pigeonGeos.push(sphereGeo(0.04, 5, x + 0.07, y + 0.16, z + 0.02));
    pigeonGeos.push(coneGeo(0.02, 0.08, 4, x + 0.11, y + 0.16, z + 0.02, Math.PI / 2));
  }
  addMerged(group, pigeonGeos, pigeonMat, { castShadow: false, receiveShadow: true });

  // --------------------------------------------------------------- hotspots
  hotspots.push(
    hotspot('plaza', 'Plaça de Gaudí', 'The plaza was designed as a viewing platform for the completed temple: from here the eighteen towers, the three façades and the forest of pinnacles can be read as one composition. Look for the way the Nativity and Passion façades answer each other across the transept.', [4, 2.2, 122], { radius: 90 }),
    hotspot('city', 'Barcelona, around', 'The temple stands in the Eixample, Barcelona’s nineteenth-century grid. The low blocks around the site are deliberately held back so the basilica can rise above the city like a mountain range; the sea lies a few kilometres to the south-east.', [96, 1.8, 92], { radius: 18 }),
    hotspot('nightfall', 'The temple at night', 'After dark the floodlights pick out the ribs and pinnacles while the stained glass glows from inside. The building reads as a lantern: the same stone that is warm and sandy by day turns to blue shadow and gold light.', [62, 1.8, 104], { radius: 20 })
  );

  // ----------------------------------------------------------------- update
  const sunDir = new THREE.Vector3(0.4, 0.8, 0.3);
  const moonDir = new THREE.Vector3(-0.4, 0.6, -0.3);
  const dayZenith = new THREE.Color(0x3d72b8);
  const dayHorizon = new THREE.Color(0xd6e3e4);
  const nightZenith = new THREE.Color(0x030611);
  const nightHorizon = new THREE.Color(0x0b1526);
  const sunsetZenith = new THREE.Color(0x2b4d7e);
  const sunsetHorizon = new THREE.Color(0xf2a35e);
  const cloudCol = new THREE.Color(0xffffff);
  const dayFog = new THREE.Color(0xc4d4d2);
  const nightFog = new THREE.Color(0x070c15);
  const glassDay = new THREE.Color(0.62, 0.66, 0.72);
  const glassNight = new THREE.Color(1.55, 1.5, 1.42);
  const sunWarm = new THREE.Color(0xffb06a);
  const sunWhite = new THREE.Color(0xfff4e2);
  // Reused scratch colours: the update runs every frame and must not allocate.
  const cHemiSkyDay = new THREE.Color(0xbcd7f2);
  const cHemiSkyNight = new THREE.Color(0x6688bb);
  const cHemiGroundDay = new THREE.Color(0x7c6f5b);
  const cHemiGroundNight = new THREE.Color(0x0b1016);
  const cAmbientDay = new THREE.Color(0x8ea4c0);
  const cAmbientNight = new THREE.Color(0x24364f);
  const cSkyGroundDay = new THREE.Color(0x6f6b60);
  const cSkyGroundNight = new THREE.Color(0x0a0e13);
  const tmpColor = new THREE.Color();
  const tmpFogColor = new THREE.Color();
  let lastQuality = null;

  sceneFogSetup();
  function sceneFogSetup() {
    ctx.scene.fog = new THREE.FogExp2(0xc4d4d2, 0.00115);
  }

  function applyQuality(q) {
    lastQuality = q;
    const size = q === 'low' ? 512 : q === 'medium' ? 1024 : 2048;
    sun.shadow.mapSize.set(size, size);
    if (sun.shadow.map) {
      sun.shadow.map.dispose();
      sun.shadow.map = null;
    }
    sun.castShadow = q !== 'low';
    qualityHooks.forEach((fn) => fn(q));
  }
  applyQuality(ctx.quality || 'high');
  ctx.onQuality(applyQuality);

  function update(dt, elapsed, env) {
    const t = env.time;
    const hour = ((t % 24) + 24) % 24;
    // solar geometry: sunrise 6h east, noon south, sunset 18h west
    const a = ((hour - 6) / 12) * Math.PI;
    const alt = Math.sin(a) * (68 * Math.PI / 180);
    const cosAlt = Math.cos(alt);
    sunDir.set(Math.cos(a) * cosAlt, Math.sin(alt), Math.sin(a) * cosAlt).normalize();
    const y = sunDir.y;
    const day = smoothstep(-0.09, 0.14, y);
    const night = 1 - day;
    const twilight = clamp(1 - Math.abs(y) / 0.3, 0, 1) * day;
    env.night = night;
    env.sunDir.copy(sunDir);
    env.sun = sun;
    env.hemi = hemi;

    // sun light
    sun.position.copy(sunDir).multiplyScalar(420).add(new THREE.Vector3(0, 40, 0));
    sun.target.position.set(0, 55, 0);
    sun.target.updateMatrixWorld();
    const altitude = clamp(y, 0, 1);
    sun.intensity = day * (2.15 + 1.85 * altitude);
    sun.color.copy(sunWarm).lerp(sunWhite, clamp(y / 0.36, 0, 1));
    sun.shadow.intensity = day * 0.92;
    // moon (opposite)
    moonDir.copy(sunDir).multiplyScalar(-1);
    if (moonDir.y < 0.12) moonDir.y = 0.3;
    moonDir.normalize();
    moon.position.copy(moonDir).multiplyScalar(380).add(new THREE.Vector3(0, 30, 0));
    moon.intensity = night * 0.6;
    hemi.intensity = 0.28 + 0.92 * day;
    hemi.color.copy(cHemiSkyNight).lerp(cHemiSkyDay, day);
    hemi.groundColor.copy(cHemiGroundNight).lerp(cHemiGroundDay, day);
    ambient.intensity = 0.07 + 0.1 * day + 0.16 * night;
    ambient.color.copy(cAmbientNight).lerp(cAmbientDay, day);

    // sky colours
    skyUniforms.uSunDir.value.copy(sunDir);
    skyUniforms.uSunColor.value.copy(sun.color);
    skyUniforms.uZenith.value.copy(nightZenith).lerp(dayZenith, day).lerp(sunsetZenith, twilight * 0.6);
    skyUniforms.uHorizon.value.copy(nightHorizon).lerp(dayHorizon, day).lerp(sunsetHorizon, twilight * 0.8);
    skyUniforms.uGround.value.copy(cSkyGroundNight).lerp(cSkyGroundDay, day);
    skyUniforms.uNight.value = night;
    skyUniforms.uSunAlt.value = y;
    skyUniforms.uTime.value = elapsed;

    // stars and moon
    starMat.opacity = Math.max(0, night - 0.08) * 0.95;
    moonSprite.position.copy(moonDir).multiplyScalar(1340);
    moonSprite.material.opacity = Math.max(0, night) * 0.95;

    // fog + exposure
    tmpFogColor.copy(nightFog).lerp(dayFog, day).lerp(sunsetHorizon, twilight * 0.25);
    ctx.scene.fog.color.copy(tmpFogColor);
    ctx.scene.fog.density = 0.0011 + night * 0.00045;
    ctx.renderer.toneMappingExposure = 0.9 + 0.16 * day + 0.1 * night;

    // floodlights
    for (const f of floods) {
      f.light.intensity = night * f.intensity;
    }
    coneMat.opacity = night * 0.018;

    // materials that change with the night
    glassMaterial.color.copy(glassDay).lerp(glassNight, night);
    cityMat.emissiveIntensity = night * 0.85;
    for (const nm of nightMaterials) nm.update(night);

    // IBL: warm daylight reflections, cold city glow at night
    if (envMapDay) {
      const wanted = night > 0.58 ? envMapNight : envMapDay;
      if (ctx.scene.environment !== wanted) ctx.scene.environment = wanted;
      ctx.scene.environmentIntensity = lerp(0.62, 0.24, night);
    }

    env.exposure = ctx.renderer.toneMappingExposure;
    env.ready = true;
  }

  return {
    group,
    colliders,
    hotspots,
    walkables,
    update,
    sun,
    get sky() {
      return sky;
    },
  };
}
