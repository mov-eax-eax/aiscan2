import * as THREE from 'three';

const VERT = [
  'varying vec3 vDir;',
  'void main() {',
  '  vDir = normalize(position);',
  '  vec4 mv = modelViewMatrix * vec4(position, 1.0);',
  '  gl_Position = projectionMatrix * mv;',
  '}',
].join('\n');

const FRAG = [
  'uniform vec3 uZenith;',
  'uniform vec3 uHorizon;',
  'uniform vec3 uHaze;',
  'uniform vec3 uSun;',
  'uniform vec3 uSunColor;',
  'varying vec3 vDir;',
  'void main() {',
  '  vec3 d = normalize(vDir);',
  '  float up = clamp(d.y, -1.0, 1.0);',
  '  vec3 col = mix(uHorizon, uZenith, pow(clamp(up, 0.0, 1.0), 0.52));',
  '  col = mix(col, uHaze, smoothstep(0.06, -0.28, up));',
  '  float s = max(dot(d, normalize(uSun)), 0.0);',
  '  col += uSunColor * pow(s, 900.0) * 12.0;',
  '  col += uSunColor * pow(s, 22.0) * 0.30;',
  '  col += uSunColor * pow(s, 3.0) * 0.06;',
  '  gl_FragColor = vec4(col, 1.0);',
  '}',
].join('\n');

export function makeSky(sunDir) {
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uZenith: { value: new THREE.Color(0x2f6bb8) },
      uHorizon: { value: new THREE.Color(0xbcd4e8) },
      uHaze: { value: new THREE.Color(0x9aa5ab) },
      uSunColor: { value: new THREE.Color(0xfff0cf) },
      uSun: { value: sunDir.clone() },
    },
    vertexShader: VERT,
    fragmentShader: FRAG,
    side: THREE.BackSide,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(3000, 48, 32), mat);
  mesh.frustumCulled = false;
  return mesh;
}

/** Small equirect gradient used as the environment probe for the bronze. */
export function makeEnvTexture(renderer, sunDir) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 128;
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, 128);
  g.addColorStop(0.00, '#3d78c0');
  g.addColorStop(0.40, '#cfe0ef');
  g.addColorStop(0.55, '#8f8878');
  g.addColorStop(1.00, '#48443e');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 128);
  const sd = sunDir.clone().normalize();
  const sx = (Math.atan2(sd.x, -sd.z) / (Math.PI * 2) + 0.5) * 256;
  const sy = (0.5 - Math.asin(THREE.MathUtils.clamp(sd.y, -1, 1)) / Math.PI) * 128;
  const rg = ctx.createRadialGradient(sx, sy, 0, sx, sy, 46);
  rg.addColorStop(0, 'rgba(255,246,222,1)');
  rg.addColorStop(0.25, 'rgba(255,236,196,0.5)');
  rg.addColorStop(1, 'rgba(255,236,196,0)');
  ctx.fillStyle = rg;
  ctx.fillRect(0, 0, 256, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromEquirectangular(tex).texture;
  pmrem.dispose();
  tex.dispose();
  return env;
}
