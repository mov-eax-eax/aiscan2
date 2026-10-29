import * as THREE from 'three';
import common from './glsl/common.glsl';
import { mergeGeometries } from './lib.js';
import { CHAMP, SEINE, TROCADERO } from './layout.js';

/* ---------------------------------------------------------------------------
 * The ground. One procedural albedo evaluated in world space: Champ de Mars
 * lawns and gravel alleys, the parvis, the Trocadero gardens, Haussmann
 * streets. It is a MeshStandardMaterial with an injected terrain shader, so
 * the renderer still lights it and the tower's shadow sweeps the park at
 * golden hour. The Seine and the Trocadero basin get their own water shader.
 * ------------------------------------------------------------------------- */

const N = (v) => Number(v).toFixed(2);
const CROSS_LINES = CHAMP.crossPaths
  .map((z) => 'cz = ' + N(z) + '; crossBand = max(crossBand, band(p.y, cz - ' + N(CHAMP.crossHalf) + ', cz + ' + N(CHAMP.crossHalf) + ', 1.2));')
  .join('\n    ');

const TERRAIN_FN = `
  uniform vec3 uGrassA, uGrassB, uGravel, uAsphalt, uPaving, uSand;
  uniform float uTime;

  float rect(vec2 p, vec2 c, vec2 h, float soft){
    vec2 d = abs(p - c) - h;
    return 1.0 - smoothstep(-soft, soft, max(d.x, d.y));
  }
  float band(float v, float a, float b, float soft){
    return smoothstep(a - soft, a + soft, v) * (1.0 - smoothstep(b - soft, b + soft, v));
  }

  void applyTerrain(vec2 p, inout vec3 albedo){
    float ax = abs(p.x);
    vec3 col = uPaving * 0.94;
    col *= 0.9 + 0.2 * fbm2(p * 0.35, 4);

    // ---- Haussmann streets ------------------------------------------------
    float streetP = ${N(88 + 19)};
    float sx = mod(p.x, streetP), sz = mod(p.y, streetP);
    float street = clamp(step(sx, ${N(19)}) + step(sz, ${N(19)}), 0.0, 1.0);
    street *= 1.0 - rect(p, vec2(0.0, 240.0), vec2(150.0, 900.0), 12.0);
    street *= 1.0 - rect(p, vec2(0.0, -520.0), vec2(190.0, 330.0), 24.0);
    col = mix(col, uAsphalt, street * 0.92);
    float kerb = smoothstep(0.0, 1.4, abs(sx - ${N(19)})) * smoothstep(0.0, 1.4, abs(sz - ${N(19)}));
    col *= mix(1.0, kerb, street * 0.25);

    // ---- Champ de Mars ----------------------------------------------------
    float park = rect(p, vec2(0.0, ${N((CHAMP.z0 + CHAMP.z1) / 2)}), vec2(${N(CHAMP.xHalf)}, ${N((CHAMP.z1 - CHAMP.z0) / 2 + 30)}), 6.0);
    float lawn = band(ax, ${N(CHAMP.alleyHalf)}, ${N(CHAMP.lawnOuter)}, 1.4) * park;
    float crossBand = 0.0;
    float cz;
    ${CROSS_LINES}
    lawn *= 1.0 - crossBand;

    float stripe = sin(p.y * 0.16) * 0.5 + 0.5;
    vec3 grass = mix(uGrassA, uGrassB, stripe * 0.5 + 0.5 * fbm2(p * 0.09, 3));
    grass *= 0.86 + 0.3 * fbm2(p * 1.6, 4);
    grass = mix(grass, uSand * 0.9, smoothstep(0.55, 0.95, fbm2(p * 0.05 + 31.0, 3)) * 0.35);
    col = mix(col, grass, lawn);

    float alley = (1.0 - smoothstep(${N(CHAMP.alleyHalf - 2)}, ${N(CHAMP.alleyHalf + 2)}, ax)) * park;
    float side = band(ax, ${N(CHAMP.lawnOuter)}, ${N(CHAMP.pathOuter)}, 1.6) * park;
    float gravel = clamp(alley + side + crossBand * band(ax, 0.0, ${N(CHAMP.xHalf)}, 1.5) * park, 0.0, 1.0);
    vec3 gv = uGravel * (0.9 + 0.22 * fbm2(p * 2.2, 4));
    gv *= 0.94 + 0.12 * vnoise2(p * 0.7);
    col = mix(col, gv, gravel);

    float verge = band(ax, ${N(CHAMP.pathOuter)}, ${N(CHAMP.xHalf)}, 1.5) * park;
    col = mix(col, mix(gv, grass, 0.35), verge * 0.75);

    // ---- parvis and esplanade around the tower ----------------------------
    float parvis = rect(p, vec2(0.0, -30.0), vec2(120.0, 180.0), 10.0);
    parvis = max(parvis, rect(p, vec2(0.0, 152.0), vec2(120.0, 45.0), 8.0));
    vec3 pav = uPaving * (0.92 + 0.16 * fbm2(p * 0.6, 3));
    vec2 grid = abs(fract(p / 9.0) - 0.5);
    pav *= 0.965 + 0.055 * smoothstep(0.40, 0.5, max(grid.x, grid.y));
    col = mix(col, pav, parvis * 0.92);

    // ---- Quai Branly ------------------------------------------------------
    float quai = band(p.y, ${N(SEINE.zNear + 5)}, ${N(SEINE.zNear + 85)}, 6.0) * (1.0 - smoothstep(600.0, 720.0, ax));
    col = mix(col, mix(uAsphalt, uPaving, 0.35), quai * 0.8);

    // ---- Trocadero gardens ------------------------------------------------
    float jard = rect(p, vec2(0.0, ${N((TROCADERO.z0 + TROCADERO.z1) / 2)}), vec2(215.0, ${N((TROCADERO.z0 - TROCADERO.z1) / 2 + 20)}), 8.0);
    float jlawn = jard * (1.0 - smoothstep(20.0, 30.0, ax));
    jlawn = max(jlawn, jard * band(ax, 46.0, 155.0, 8.0) * 0.8);
    vec3 jg = mix(uGrassA * 0.96, uGrassB, fbm2(p * 0.12 + 7.0, 3));
    col = mix(col, jg * (0.85 + 0.3 * fbm2(p * 1.3, 4)), jlawn * 0.9);
    col = mix(col, gv * 1.06, jard * (1.0 - jlawn) * 0.65);
    col = mix(col, pav * 0.98, rect(p, vec2(0.0, -795.0), vec2(210.0, 95.0), 12.0));

    // ---- quays ------------------------------------------------------------
    float bank = max(1.0 - smoothstep(0.0, 14.0, abs(p.y - ${N(SEINE.zNear)})), 1.0 - smoothstep(0.0, 14.0, abs(p.y - ${N(SEINE.zFar)})));
    col = mix(col, uPaving * 1.05, bank * 0.85);

    // ---- micro detail -----------------------------------------------------
    col *= 0.95 + 0.10 * fbm2(p * 9.0, 3);
    col *= 1.0 - 0.10 * smoothstep(0.6, 0.95, fbm2(p * 0.03 + 13.0, 3)) * (1.0 - lawn);
    albedo *= col;
  }
`;

function terrainMaterial() {
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.96, metalness: 0.0 });
  mat.userData.u = {
    uGrassA: { value: new THREE.Color(0x3f6b28) },
    uGrassB: { value: new THREE.Color(0x578a33) },
    uGravel: { value: new THREE.Color(0xc9bb9c) },
    uAsphalt: { value: new THREE.Color(0x44443f) },
    uPaving: { value: new THREE.Color(0xa9a294) },
    uSand: { value: new THREE.Color(0xb8a077) },
    uFogColor: { value: new THREE.Color(0xffffff) },
    uFogDensity: { value: 0.00015 },
    uTime: { value: 0 },
  };
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, mat.userData.u);
    const body = TERRAIN_FN;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n  vWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;\nuniform vec3 uFogColor; uniform float uFogDensity;\n' + common + '\n' + body)
      .replace('#include <map_fragment>', '#include <map_fragment>\n        {\n          vec3 albedo = vec3(1.0);\n          applyTerrain(vWPos.xz, albedo);\n          diffuseColor.rgb *= albedo;\n        }')
      .replace('#include <dithering_fragment>', '#include <dithering_fragment>\n        gl_FragColor.rgb = applyAerial(gl_FragColor.rgb, uFogColor, length(vWPos - cameraPosition), uFogDensity);');
  };
  mat.customProgramCacheKey = () => 'eiffel-terrain';
  return mat;
}

const WATER_VERT = `
varying vec3 vW;
void main(){ vW = (modelMatrix * vec4(position,1.0)).xyz; gl_Position = projectionMatrix * viewMatrix * vec4(vW, 1.0); }`;

const WATER_FRAG = `
varying vec3 vW;
uniform vec3 uSunDir, uSunColor, uSkyColor, uHorizonColor, uDeep, uFogColor;
uniform float uTime, uFogDensity, uNight;
${common}
void main(){
  vec3 V = normalize(cameraPosition - vW);
  vec2 p = vW.xz;
  float dist0 = length(vW - cameraPosition);
  // waves flatten with distance: without this the far river turns into moire
  float detail = 1.0 - smoothstep(90.0, 900.0, dist0);
  float amp = 0.0;
  vec2 g = vec2(0.0);
  for (int i = 0; i < 4; i++){
    float f = 0.016 * pow(1.95, float(i)) * mix(1.0, 0.35, 1.0 - detail);
    vec2 dir = normalize(vec2(cos(float(i) * 2.1), sin(float(i) * 1.7)));
    float ph = dot(p, dir) * f + uTime * (0.35 + 0.2 * float(i));
    float w = exp(-float(i) * 0.42);
    amp += sin(ph) * w;
    g += dir * cos(ph) * f * w;
  }
  vec3 N = normalize(vec3(-g.x * 30.0 * detail, 1.0, -g.y * 30.0 * detail));
  float fres = pow(1.0 - max(dot(N, V), 0.0), 3.2);
  vec3 R = reflect(-V, N);
  vec3 skyRefl = mix(uHorizonColor, uSkyColor, clamp(R.y * 0.6 + 0.4, 0.0, 1.0));
  vec3 col = mix(uDeep * (0.6 + 0.4 * amp), skyRefl, clamp(0.14 + 0.86 * fres, 0.0, 1.0));
  float spec = pow(max(dot(R, uSunDir), 0.0), mix(120.0, 380.0, detail));
  col += uSunColor * spec * 2.6 * mix(0.35, 1.0, detail);
  col += uSunColor * pow(max(dot(R, uSunDir), 0.0), 22.0) * 0.10;
  col *= mix(1.0, 0.35, uNight);
  col = applyAerial(col, uFogColor, dist0, uFogDensity);
  gl_FragColor = vec4(col, 1.0);
}`;

export function createGround(ctx) {
  const group = new THREE.Group();
  group.name = 'ground';
  const mat = terrainMaterial();

  const HALF = 3400;
  const slab = (depth, cz) => {
    const g = new THREE.PlaneGeometry(HALF * 2, depth, 1, 1);
    g.rotateX(-Math.PI / 2);
    g.translate(0, 0, cz);
    return g;
  };
  const south = new THREE.Mesh(slab(HALF - SEINE.zNear, (HALF + SEINE.zNear) * 0.5), mat);
  const north = new THREE.Mesh(slab(HALF + SEINE.zFar, (SEINE.zFar - HALF) * 0.5), mat);
  for (const m of [south, north]) {
    m.receiveShadow = true;
    m.frustumCulled = false;
    group.add(m);
  }

  const waterU = {
    uSunDir: { value: new THREE.Vector3(0, 1, 0) },
    uSunColor: { value: new THREE.Color(1, 1, 1) },
    uSkyColor: { value: new THREE.Color(0x3f6fb4) },
    uHorizonColor: { value: new THREE.Color(0xbcd4e6) },
    uDeep: { value: new THREE.Color(0x1b2c2a) },
    uFogColor: { value: new THREE.Color(1, 1, 1) },
    uFogDensity: { value: 0.00015 },
    uTime: { value: 0 }, uNight: { value: 0 },
  };
  const waterMat = new THREE.ShaderMaterial({ uniforms: waterU, vertexShader: WATER_VERT, fragmentShader: WATER_FRAG });
  const river = new THREE.Mesh(new THREE.PlaneGeometry(HALF * 2, SEINE.zNear - SEINE.zFar), waterMat);
  river.rotation.x = -Math.PI / 2;
  river.position.set(0, SEINE.waterY, (SEINE.zNear + SEINE.zFar) * 0.5);
  river.frustumCulled = false;
  group.add(river);

  const basin = new THREE.Mesh(new THREE.PlaneGeometry(TROCADERO.basin.xHalf * 2, TROCADERO.basin.z0 - TROCADERO.basin.z1), waterMat);
  basin.rotation.x = -Math.PI / 2;
  basin.position.set(0, 0.4, (TROCADERO.basin.z0 + TROCADERO.basin.z1) * 0.5);
  group.add(basin);

  const quayParts = [[SEINE.zNear, 2.2], [SEINE.zFar, -2.2]].map((pair) => {
    const g = new THREE.BoxGeometry(HALF * 2, 10.0, 4.4);
    g.translate(0, -3.6, pair[0] + pair[1]);
    return g;
  });
  const quays = new THREE.Mesh(mergeGeometries(quayParts), mat);
  quays.geometry.computeVertexNormals();
  quays.receiveShadow = true;
  group.add(quays);

  return {
    group,
    update(tod, time, camera, fog) {
      const p = tod.pal;
      const u = mat.userData.u;
      u.uFogColor.value.copy(fog);
      u.uTime.value = time;
      waterU.uSunDir.value.copy(tod.sunDir);
      waterU.uSunColor.value.copy(p.sun).multiplyScalar(Math.min(p.sunI, 3.0));
      waterU.uSkyColor.value.copy(p.zenith);
      waterU.uHorizonColor.value.copy(p.horizon);
      waterU.uFogColor.value.copy(fog);
      waterU.uTime.value = time;
      waterU.uNight.value = tod.isNight ? 1 : 0;
    },
  };
}
