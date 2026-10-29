/* ============================================================================
   recurve-bow / src/togl.js  --  the only file that knows three.js exists

   Everything upstream is plain JavaScript with no renderer dependency, which
   is what lets src/verify.js build and check all 50-odd parts in bare Node.
   This module is the thin adapter: my {pos, idx, nor} -> BufferGeometry, and
   the material table -> MeshPhysicalMaterial.
   ========================================================================== */

import * as THREE from '../vendor/three.module.js';
import { MATERIALS } from './param.js';

export function toGeometry(mesh) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(mesh.pos, 3));
  if (mesh.nor && mesh.nor.length === mesh.pos.length) {
    g.setAttribute('normal', new THREE.Float32BufferAttribute(mesh.nor, 3));
  } else {
    g.computeVertexNormals();
  }
  g.setIndex(mesh.idx);
  g.computeBoundingBox();
  g.computeBoundingSphere();
  return g;
}

const matCache = new Map();
export function materialFor(key) {
  if (matCache.has(key)) return matCache.get(key);
  const d = MATERIALS[key] || MATERIALS.alu;
  const m = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(d.colour),
    metalness: d.metal,
    roughness: d.rough,
    clearcoat: d.metal > 0.5 ? 0.25 : 0.55,
    clearcoatRoughness: d.metal > 0.5 ? 0.35 : 0.55,
    envMapIntensity: d.metal > 0.5 ? 1.15 : 0.75,
    side: THREE.FrontSide,
  });
  m.name = key;
  matCache.set(key, m);
  return m;
}

/* One shared material per key when we want the whole bow in one colour
   (used by the x-ray / ghost pass and by the design-review view). */
export function flatMaterial(colour, opts = {}) {
  const key = 'flat:' + colour + JSON.stringify(opts);
  if (matCache.has(key)) return matCache.get(key);
  const m = new THREE.MeshStandardMaterial({
    color: colour, metalness: 0.25, roughness: 0.55,
    transparent: !!opts.opacity, opacity: opts.opacity || 1,
    wireframe: !!opts.wire, side: opts.side || THREE.FrontSide,
    depthWrite: opts.opacity ? false : true,
  });
  matCache.set(key, m);
  return m;
}

export function clearMaterialCache() { matCache.clear(); }

/* ----------------------------------------------------------- environment --- */

/* A procedural studio: a sky-to-floor gradient plus three soft boxes. Without
   something for them to reflect, every metal part in the bow renders black --
   and this bow is mostly machined aluminium, so it matters. */
export function studioEnvironment(renderer) {
  const W = 1024, H = 512;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');

  const sky = g.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0.00, '#39424f');
  sky.addColorStop(0.38, '#7d8a9a');
  sky.addColorStop(0.50, '#b9c4d1');
  sky.addColorStop(0.58, '#5d6874');
  sky.addColorStop(1.00, '#20242b');
  g.fillStyle = sky;
  g.fillRect(0, 0, W, H);

  const box = (x, y, w, h, a) => {
    const grd = g.createRadialGradient(x + w / 2, y + h / 2, 0, x + w / 2, y + h / 2, Math.max(w, h) / 2);
    grd.addColorStop(0, `rgba(255,255,252,${a})`);
    grd.addColorStop(0.5, `rgba(240,246,255,${a * 0.5})`);
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.fillRect(x, y, w, h);
  };
  box(W * 0.04, H * 0.06, W * 0.30, H * 0.50, 1.0);   // key
  box(W * 0.50, H * 0.00, W * 0.34, H * 0.34, 0.80);   // top fill
  box(W * 0.72, H * 0.26, W * 0.26, H * 0.46, 0.65);   // rim
  box(W * 0.28, H * 0.60, W * 0.44, H * 0.34, 0.34);   // bounce

  const tex = new THREE.CanvasTexture(c);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();
  const rt = pmrem.fromEquirectangular(tex);
  tex.dispose();
  pmrem.dispose();
  return rt.texture;
}

/* A soft radial floor shadow, so the bow is not floating in a void. */
export function contactShadowTexture() {
  const S = 512;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  grd.addColorStop(0, 'rgba(0,0,0,0.55)');
  grd.addColorStop(0.45, 'rgba(0,0,0,0.22)');
  grd.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, S, S);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
