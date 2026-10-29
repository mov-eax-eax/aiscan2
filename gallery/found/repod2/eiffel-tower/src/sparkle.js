import * as THREE from 'three';
import { DIM } from './config.js';

/* deterministic RNG so the sparkle is always the same */
function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * The 20,000 bulbs of the hourly sparkle.
 *
 * Their positions are sampled from the real members of the model (the
 * instanced beams), so the light show sits exactly on the ironwork.
 */
export function createBulbs(builders, count = DIM.bulbs) {
  // bulbs sit on the tower itself: drop the ground-level pavilions' fittings
  const pool = [
    { b: builders.main, keep: null },
    {
      b: builders.detail,
      keep: (it) => {
        const y = it.m.elements[13];
        const x = it.m.elements[12];
        const z = it.m.elements[14];
        return !(y < 4 && Math.hypot(x, z) > 70);
      },
    },
    { b: builders.fine, keep: null },
  ]
    .filter((p) => p.b && p.b.count)
    .map((p) => ({ items: p.keep ? p.b.items.filter(p.keep) : p.b.items }))
    .filter((p) => p.items.length);

  const total = pool.reduce((s, p) => s + p.items.length, 0);
  const rnd = mulberry32(20240607);
  const pos = new Float32Array(count * 3);
  const phase = new Float32Array(count);
  const size = new Float32Array(count);

  const p = new THREE.Vector3();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3();
  const axis = new THREE.Vector3();

  for (let i = 0; i < count; i++) {
    let k = Math.floor(rnd() * total);
    let bucket = pool[0];
    for (const b of pool) {
      if (k < b.items.length) {
        bucket = b;
        break;
      }
      k -= b.items.length;
    }
    const item = bucket.items[Math.min(k, bucket.items.length - 1)];
    item.m.decompose(p, q, s);
    axis.set(0, 1, 0).applyQuaternion(q);
    const t = (rnd() - 0.5) * s.y;
    p.addScaledVector(axis, t);
    const r = Math.hypot(p.x, p.z);
    if (r > 0.5) {
      const off = 0.2 + rnd() * 0.45;
      p.x += (p.x / r) * off;
      p.z += (p.z / r) * off;
    }
    pos[i * 3] = p.x;
    pos[i * 3 + 1] = p.y;
    pos[i * 3 + 2] = p.z;
    phase[i] = rnd();
    size[i] = 0.75 + rnd() * 0.9;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));
  geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  geo.computeBoundingSphere();

  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uOn: { value: 0 },
      uTwinkle: { value: 0 },
      uUnit: { value: 900 },
      uColor: { value: new THREE.Color(0xffcf7a) },
    },
    vertexShader: /* glsl */ `
      attribute float aPhase;
      attribute float aSize;
      uniform float uTime, uOn, uTwinkle, uUnit;
      varying float vB;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = clamp(aSize * uUnit / max(1.0, -mv.z), 1.0, 22.0);
        float tw = 1.0;
        if (uTwinkle > 0.5) {
          float t = floor(uTime * 12.0);
          tw = step(0.40, fract(sin(aPhase * 78.233 + t * 12.9898) * 43758.5453));
          tw = 0.12 + 0.88 * tw;
        }
        vB = uOn * tw;
      }
    `,
    fragmentShader: /* glsl */ `
      varying float vB;
      uniform vec3 uColor;
      void main() {
        vec2 d = gl_PointCoord - 0.5;
        float r = length(d);
        if (r > 0.5) discard;
        float a = smoothstep(0.5, 0.02, r);
        gl_FragColor = vec4(uColor * a * vB * 1.8, a * vB);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  points.name = 'sparkle-bulbs';
  points.userData.mat = mat;
  return points;
}

function beamTexture() {
  if (typeof document === 'undefined') return null;
  const w = 256;
  const h = 64;
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const g = cv.getContext('2d');
  const gx = g.createLinearGradient(0, 0, w, 0);
  gx.addColorStop(0, 'rgba(255,255,255,0)');
  gx.addColorStop(0.5, 'rgba(255,248,224,1)');
  gx.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gx;
  g.fillRect(0, 0, w, h);
  const gy = g.createLinearGradient(0, 0, 0, h);
  gy.addColorStop(0, 'rgba(0,0,0,0)');
  gy.addColorStop(0.5, 'rgba(0,0,0,1)');
  gy.addColorStop(1, 'rgba(0,0,0,0)');
  g.globalCompositeOperation = 'destination-in';
  g.fillStyle = gy;
  g.fillRect(0, 0, w, h);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * The rotating beacon ("le phare", 2000) plus the red aircraft warning light
 * at the very top of the antenna.
 */
export function createBeacon() {
  const group = new THREE.Group();
  group.name = 'beacon';
  group.position.y = DIM.roof - 2;

  const tex = beamTexture();
  const mat = new THREE.MeshBasicMaterial({
    map: tex,
    color: 0xfff0cf,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
    toneMapped: false,
  });
  const beams = new THREE.Group();
  for (let i = 0; i < 2; i++) {
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(420, 10), mat);
    plane.rotation.y = (i * Math.PI) / 2 + Math.PI / 4;
    beams.add(plane);
  }
  group.add(beams);

  const lamp = new THREE.Mesh(
    new THREE.SphereGeometry(0.9, 12, 10),
    new THREE.MeshBasicMaterial({ color: 0xff5533, toneMapped: false }),
  );
  lamp.position.y = DIM.tip - DIM.roof + 2;
  group.add(lamp);

  const lampGlow = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: tex,
      color: 0xff4422,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    }),
  );
  lampGlow.scale.set(22, 22, 1);
  lampGlow.position.copy(lamp.position);
  group.add(lampGlow);

  return {
    group,
    lamp,
    lampGlow,
    material: mat,
    update(time, amount) {
      beams.rotation.y = time * 0.9;
      mat.opacity = 0.34 * amount;
      lamp.material.color.setRGB(amount * 1.0, amount * 0.28, amount * 0.18);
      lampGlow.material.opacity = 0.55 * amount * (0.45 + 0.55 * Math.pow(Math.abs(Math.sin(time * 1.6)), 0.35));
    },
  };
}
