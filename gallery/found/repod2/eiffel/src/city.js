// ---------------------------------------------------------------------------
// city.js - Haussmann Paris: perimeter blocks on the layout grid, mansard zinc
// roofs, dormers, chimneys, corner rotundas and domes, plus the landmarks on
// the great axis (Ecole Militaire, Palais de Chaillot, Pont d'Iena).
//
//   export function createCity(ctx) -> { group, update(tod, time, camera, fog) }
//
// Everything is procedural (no textures, no external assets), deterministic
// through ctx.rng, opaque (never blended) and instanced.  Materials are
// ShaderMaterial and output linear HDR; every spatially extended fragment
// shader fades to the live fog colour with applyAerial().
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import common from './glsl/common.glsl';
import {
  CITY, SEINE, TROCADERO, ECOLE_MILITAIRE, cityAllowed,
} from './layout.js';
import { clamp } from './rng.js';
import { boxGeo, mergeGeometries } from './lib.js';

// --- Haussmann metrics (metres) --------------------------------------------
const GROUND_H = 4.6;             // ground floor + entresol band
const CORNICE_H = 1.0;            // projecting stone cornice
const FLOOR_H = 2.98;             // 4.6 + 5 * 2.98 + 1.0 = 20.5 = CITY.cornice
const FOG_DENSITY = 0.00034;      // house aerial-perspective density
const RUN_MIN = 14, RUN_MAX = 24;

// limestone body colour + subtle per-building variants (sRGB hex -> linear)
const STONE_HEX = 0xc9c0ad;
const VARIANTS = [0xd8d0bd, 0xd0c7b1, 0xc5bba4, 0xded6c4, 0xc0b59e, 0xccc2ab,
  0xd3cab6, 0xc8bda3, 0xd1c9b4, 0xcbc1a8];
const uStone = new THREE.Color(STONE_HEX);
const TINTS = VARIANTS.map((h) => {
  const c = new THREE.Color(h);
  return [clamp(c.r / uStone.r, 0.84, 1.16), clamp(c.g / uStone.g, 0.84, 1.16),
    clamp(c.b / uStone.b, 0.84, 1.16)];
});

// ---------------------------------------------------------------------------
// GLSL - shared lighting / shadow prologue and the surface shaders.
// ---------------------------------------------------------------------------

const SHADOW_VERT = /* glsl */ `
#include <common>
#include <shadowmap_pars_vertex>
`;

const SHADOW_FRAG = /* glsl */ `
#include <common>
#include <packing>
#include <shadowmap_pars_fragment>
`;

const LIGHT_LIB = /* glsl */ `
uniform vec3 uSunDir, uMoonDir, uSunColor, uAmb, uZenith, uHorizon, uGround, uFog, uLamp;
uniform float uSunI, uMoonI, uAmbI, uFogDensity, uWindowLit, uTime;
uniform bool receiveShadow;
${common}
vec3 skyTint(){ return mix(uHorizon, uZenith, 0.42); }

// one 4096 shadow map covers roughly +/-900 m around the tower: fade the lookup
// out well inside that radius so the edge of the map is never visible.
float sunShadow(vec3 wp){
  float s = 1.0;
#ifdef USE_SHADOWMAP
  #if NUM_DIR_LIGHT_SHADOWS > 0
  if (receiveShadow) {
    #pragma unroll_loop_start
    for (int i = 0; i < NUM_DIR_LIGHT_SHADOWS; i++) {
      s *= getShadow(directionalShadowMap[i], directionalLightShadows[i].shadowMapSize,
                     directionalLightShadows[i].shadowBias, directionalLightShadows[i].shadowRadius,
                     vDirectionalShadowCoord[i]);
    }
    #pragma unroll_loop_end
  }
  #endif
#endif
  return mix(1.0, s, 1.0 - smoothstep(640.0, 900.0, length(wp.xz)));
}

// sun + moon + sky/ground hemisphere ambient, all linear HDR
vec3 lightSurface(vec3 N, vec3 wp){
  float ndl = max(dot(N, uSunDir), 0.0);
  vec3 sun = uSunColor * (uSunI * ndl * mix(1.0, sunShadow(wp), 0.88));
  float ndm = max(dot(N, uMoonDir), 0.0);
  vec3 moon = vec3(0.52, 0.66, 1.0) * (uMoonI * 0.55 * ndm);
  vec3 amb = uAmb * (uAmbI * 0.62)
           + skyTint() * (uAmbI * 0.30 * (0.5 + 0.5 * N.y))
           + uGround * (uAmbI * 0.20 * (0.5 - 0.5 * N.y));
  return sun + moon + amb;
}
`;

// --- facade vertex ---------------------------------------------------------
const FACADE_VERT = /* glsl */ `
${SHADOW_VERT}
attribute vec3 aSize;
attribute float aSeed;
attribute vec3 aTint;
attribute float aLod;
attribute float aFloors;
attribute float aShape;
varying vec3 vWorld;
varying vec3 vWN;
varying vec3 vNl;
varying vec2 vF;
varying float vH;
varying float vW;
varying float vSeed;
varying vec3 vTint;
varying float vLod;
varying float vFloors;

void main(){
  mat4 im = instanceMatrix;
  vec4 worldPosition = modelMatrix * im * vec4(position, 1.0);
  vec3 transformedNormal = normalize(mat3(modelMatrix) * mat3(im) * normal);
  vWorld = worldPosition.xyz;
  vWN = transformedNormal;
  vNl = normal;
  vH = aSize.y;
  float faceW = abs(normal.x) > 0.5 ? aSize.z : aSize.x;
  float cylW = aSize.x * 3.141592653589793;
  vF = vec2(uv.x * mix(faceW, cylW, aShape), (position.y + 0.5) * aSize.y);
  vW = mix(faceW, cylW, aShape);
  vSeed = aSeed;
  vTint = aTint;
  vLod = aLod;
  vFloors = aFloors;
  #include <shadowmap_vertex>
  gl_Position = projectionMatrix * viewMatrix * worldPosition;
}
`;

// --- facade fragment: the Parisian street wall ------------------------------
const FACADE_FRAG = /* glsl */ `
${SHADOW_FRAG}
${LIGHT_LIB}
uniform float uGroundH, uCorniceH;
uniform vec3 uStone, uIron;

varying vec3 vWorld;
varying vec3 vWN;
varying vec3 vNl;
varying vec2 vF;
varying float vH;
varying float vW;
varying float vSeed;
varying vec3 vTint;
varying float vLod;
varying float vFloors;

float bandF(float x, float a, float b, float soft){
  return smoothstep(a - soft, a + soft, x) * (1.0 - smoothstep(b - soft, b + soft, x));
}
float boxSDF(vec2 p, vec2 c, vec2 h){
  vec2 d = abs(p - c) - h;
  return max(d.x, d.y);
}
float fill(float sd, float soft){ return 1.0 - smoothstep(-soft, soft, sd); }

void main(){
  vec3 Ng = normalize(vWN);
  vec3 V = normalize(cameraPosition - vWorld);
  float dist = length(cameraPosition - vWorld);
  float lod = vLod;
  vec3 alb; vec3 emis = vec3(0.0); float ao = 1.0; float nUp = 0.0;

  if (abs(vNl.y) > 0.6) {
    // flat top of the mass (the mansard usually hides it) / hidden underside
    alb = vec3(0.115, 0.125, 0.140);
    if (vNl.y < 0.0) alb *= 0.18;
    ao = 0.92;
  } else {
    float H = vH;
    float fw = vW;
    float sd = vSeed;
    float nf = max(3.0, vFloors);
    float gH = uGroundH;
    float fh = (H - gH - uCorniceH) / nf;
    float c0 = H - uCorniceH;

    // ---------- bay / floor layout -----------------------------------------
    float nb = max(2.0, floor(fw / 3.55 + 0.35));
    float bayW = fw / nb;
    float bxf = vF.x / bayW;
    float bx = floor(bxf);
    float xm = (fract(bxf) - 0.5) * bayW;

    float fy = vF.y - gH;
    float fi = floor(fy / fh);
    float ly = fy - fi * fh;
    float inFloors = step(gH, vF.y) * (1.0 - step(c0, vF.y));
    float topF = step(nf - 1.5, fi);
    float noble = step(0.5, fi) * (1.0 - step(1.5, fi));
    float tall = max(topF, noble);
    float wH = mix(1.96, 2.40, tall);
    float wB = mix(0.62, 0.34, tall);
    float wHW = mix(0.60, 0.66, tall);
    float wcy = wB + wH * 0.5;
    vec2 wh = vec2(wHW, wH * 0.5);

    // ---------- limestone ---------------------------------------------------
    float grain = vnoise2(vF * 1.6);
    if (lod < 0.5) grain = grain * 0.55 + fbm2(vF * 0.85, 3) * 0.62;
    else if (lod < 1.5) grain = grain * 0.60 + fbm2(vF * 0.85, 2) * 0.50;
    vec3 stone = uStone * vTint * (0.90 + 0.22 * grain);

    // ashlar coursing (0.62 m) with staggered vertical joints
    float cy = vF.y / 0.62;
    float cm = fract(cy);
    float mortar = smoothstep(0.0, 0.030, cm) * (1.0 - smoothstep(0.950, 0.985, cm));
    float courseTone = 0.962 + 0.075 * hash11(floor(cy) * 1.37 + sd * 3.1);
    stone *= mix(0.80, courseTone, mortar);
    if (lod < 1.5) {
      float vj = fract((vF.x + 1.9 * hash11(floor(cy) * 0.77 + sd)) / 2.05);
      float vm = smoothstep(0.0, 0.02, vj) * (1.0 - smoothstep(0.972, 0.996, vj));
      stone *= mix(0.90, 1.0, vm);
    }

    // ---------- windows -----------------------------------------------------
    float wsdf = boxSDF(vec2(xm, ly), vec2(0.0, wcy), wh);
    float soft = lod < 1.5 ? 0.030 : 0.055;
    float glass = fill(wsdf, soft) * inFloors;
    float reveal = clamp(fill(wsdf - 0.17, soft + 0.02) - glass, 0.0, 1.0) * inFloors;
    float bandX = 1.0 - smoothstep(wHW + 0.22, wHW + 0.32, abs(xm));
    float sill = fill(abs(ly - (wB - 0.11)) - 0.065, soft) * bandX * inFloors;
    float lintel = fill(abs(ly - (wB + wH + 0.13)) - 0.080, soft) * bandX * inFloors;

    stone = mix(stone, stone * 1.07, max(sill, lintel));
    alb = stone;
    alb = mix(alb, alb * 0.60, reveal);
    nUp += reveal * mix(0.45, -0.75, step(0.0, ly - wcy));
    nUp += sill * 0.85 + lintel * 0.35;
    ao *= 1.0 - 0.35 * reveal;

    // ---------- glazing -----------------------------------------------------
    float fres = pow(1.0 - clamp(dot(Ng, V), 0.0, 1.0), 4.0);
    vec3 glassCol = mix(vec3(0.013, 0.017, 0.026), skyTint() * 0.60, fres * 0.85);
    vec3 col = mix(alb, glassCol, glass);

    // ---------- iron balconies ----------------------------------------------
    if (lod < 1.5) {
      float railTop = wB + 0.94;
      float rz = bandF(ly, wB - 0.05, railTop, 0.035);
      float spread = mix(1.0 - smoothstep(wHW + 0.05, wHW + 0.15, abs(xm)), 1.0, tall);
      float fb = fract(vF.x / 0.135);
      float bars = smoothstep(0.33, 0.40, fb) * (1.0 - smoothstep(0.56, 0.63, fb));
      float hrails = max(1.0 - smoothstep(0.018, 0.048, abs(ly - (railTop - 0.055))),
                         1.0 - smoothstep(0.018, 0.048, abs(ly - (wB + 0.035))));
      float rail = clamp(max(bars, hrails), 0.0, 1.0) * rz * spread * inFloors;
      col = mix(col, uIron, rail * 0.94);
      float spec = pow(max(dot(reflect(-V, Ng), uSunDir), 0.0), 28.0);
      emis += rail * spec * uSunColor * (uSunI * 0.20);
      ao *= 1.0 - 0.18 * rail;
    }

    // ---------- ground floor: shopfronts + awnings --------------------------
    float gzone = 1.0 - smoothstep(4.05, 4.22, vF.y);
    if (gzone > 0.001) {
      float sr = hash12(vec2(bx * 2.13 + sd * 4.0, 1.7));
      vec3 shop = vec3(0.019, 0.024, 0.021);
      if (sr < 0.26) shop = vec3(0.058, 0.013, 0.013);
      else if (sr < 0.44) shop = vec3(0.013, 0.019, 0.050);
      else if (sr < 0.62) shop = vec3(0.030, 0.047, 0.032);
      float gsdf = boxSDF(vec2(xm, vF.y), vec2(0.0, 1.95), vec2(wHW + 0.52, 1.30));
      float gopen = fill(gsdf, 0.06) * gzone;
      float mull = 1.0 - smoothstep(0.035, 0.065, abs(fract(vF.x / 0.98) - 0.5) * 0.98);
      float sg = gopen * (1.0 - mull);
      col = mix(col, shop, gzone * 0.92);
      float sl = hash12(vec2(bx * 1.9 + sd, 5.3));
      vec3 shopGlass = mix(vec3(0.020, 0.026, 0.032), uLamp * (0.35 + 0.9 * sl),
                           0.10 + 0.85 * uWindowLit);
      col = mix(col, shopGlass, sg);
      emis += sg * uLamp * (uWindowLit * (0.45 + 0.85 * sl) * 0.85);
      float band2 = bandF(vF.y, 4.14, 4.42, 0.03);
      col = mix(col, stone * 1.06, band2);
      nUp += band2 * 0.5;
      if (lod < 1.5) {
        float aon = step(0.52, hash12(vec2(bx * 1.31 + sd * 9.0, 2.3)));
        float am = aon * bandF(vF.y, 2.72, 3.42, 0.06)
                 * (1.0 - smoothstep(wHW + 0.34, wHW + 0.44, abs(xm)));
        vec3 awn = mix(vec3(0.24, 0.030, 0.026), vec3(0.020, 0.078, 0.046),
                       step(0.5, hash12(vec2(bx, sd + 3.0))));
        awn *= 0.55 + 0.70 * step(0.5, fract(xm / 0.34));
        col = mix(col, awn, am);
        nUp -= am * 0.55;
        ao *= 1.0 - 0.22 * am;
      }
    }

    // ---------- cornice ------------------------------------------------------
    float inCor = step(c0, vF.y);
    if (inCor > 0.5) {
      float cz = vF.y - c0;
      float b1 = fill(abs(cz - 0.20) - 0.11, 0.028);
      float b2 = fill(abs(cz - 0.50) - 0.10, 0.028);
      float b3 = fill(abs(cz - 0.80) - 0.13, 0.028);
      float cor = clamp(max(max(b1, b2), b3), 0.0, 1.0);
      col = mix(col, col * 0.62, 1.0 - cor);
      col = mix(col, stone * 1.10, cor);
      nUp += cor * 0.85 - (1.0 - cor) * 0.95;
      ao *= 1.0 - 0.25 * (1.0 - cor);
    }

    // ---------- night windows ------------------------------------------------
    float r1 = hash12(vec2(bx * 1.71 + sd * 7.3, fi * 3.77 + sd * 2.1));
    float on = step(1.0 - uWindowLit * 0.44, r1);
    float r2 = hash12(vec2(bx * 3.13 + sd, fi * 2.71 + 5.0));
    float br = 0.16 + 0.75 * r2 * r2 + 0.35 * r2;
    float cool = step(0.885, hash12(vec2(bx * 5.31 + sd * 3.0, fi * 1.93)));
    vec3 lamp = mix(uLamp, vec3(0.52, 0.68, 1.10), cool * 0.7);
    float curtain = mix(0.58, 1.0, vnoise2(vF * 2.4 + vec2(sd * 13.0, sd * 7.0)));
    float blind = step(0.5, hash12(vec2(bx + sd, fi * 9.1)));
    float blindM = mix(1.0, 1.0 - smoothstep(wcy - 0.40, wcy + 0.05, ly), blind);
    float flick = 1.0 + 0.05 * sin(uTime * 2.7 + r1 * 41.0);
    vec3 lit = lamp * (on * br * uWindowLit * curtain * blindM * flick);
    emis += glass * lit * 1.25;
    float outd = max(wsdf, 0.0);
    emis += (1.0 - glass) * lamp * (exp(-outd * 4.5) * on * uWindowLit * 0.16);

    // ---------- weathering ---------------------------------------------------
    float streak = vnoise2(vec2(vF.x * 2.4, vF.y * 0.055));
    if (lod < 1.5) streak = streak * 0.6 + vnoise2(vec2(vF.x * 7.1, vF.y * 0.20)) * 0.5;
    float dirt = smoothstep(0.44, 0.90, streak);
    col *= 1.0 - 0.17 * dirt * (0.45 + 0.55 * (1.0 - smoothstep(1.0, 13.0, vF.y)));
    col *= mix(0.70, 1.0, smoothstep(0.0, 2.6, vF.y));
    col *= mix(1.0, 0.82, smoothstep(c0 - 3.0, c0 - 0.15, vF.y) * (1.0 - inCor));
    col *= mix(1.0, 0.86, smoothstep(0.55, 1.0, abs(vF.x / max(fw, 1.0) * 2.0 - 1.0)));
    alb = col;
  }

  Ng = normalize(Ng + vec3(0.0, nUp, 0.0));
  vec3 outc = alb * ao * lightSurface(Ng, vWorld) + emis;
  outc = applyAerial(outc, uFog, dist, uFogDensity);
  gl_FragColor = vec4(outc, 1.0);
}
`;

// --- zinc roofs, dormers, chimneys, tanks, domes ----------------------------
const PROP_VERT = /* glsl */ `
${SHADOW_VERT}
attribute vec3 aSize;
attribute float aSeed;
attribute vec3 aTint;
attribute float aLod;
attribute float aShape;
varying vec3 vWorld;
varying vec3 vWN;
varying vec3 vNl;
varying vec3 vLp;
varying float vSeed;
varying vec3 vTint;
varying float vLod;
varying float vShape;
void main(){
  mat4 im = instanceMatrix;
  vec4 worldPosition = modelMatrix * im * vec4(position, 1.0);
  vec3 transformedNormal = normalize(mat3(modelMatrix) * mat3(im) * normal);
  vWorld = worldPosition.xyz;
  vWN = transformedNormal;
  vNl = normal;
  vLp = position;
  vSeed = aSeed;
  vTint = aTint;
  vLod = aLod;
  vShape = aShape;
  #include <shadowmap_vertex>
  gl_Position = projectionMatrix * viewMatrix * worldPosition;
}
`;

const PROP_FRAG = /* glsl */ `
${SHADOW_FRAG}
${LIGHT_LIB}
uniform vec3 uZinc, uSlate, uChimney, uIron;
varying vec3 vWorld;
varying vec3 vWN;
varying vec3 vNl;
varying vec3 vLp;
varying float vSeed;
varying vec3 vTint;
varying float vLod;
varying float vShape;

float bandF(float x, float a, float b, float soft){
  return smoothstep(a - soft, a + soft, x) * (1.0 - smoothstep(b - soft, b + soft, x));
}

void main(){
  vec3 Ng = normalize(vWN);
  vec3 V = normalize(cameraPosition - vWorld);
  float dist = length(cameraPosition - vWorld);
  float lod = vLod;
  float sd = vSeed;
  float k = floor(vShape + 0.5);
  vec3 alb; vec3 emis = vec3(0.0); float ao = 1.0; float nUp = 0.0;

  if (k < 0.5) {
    // ---- mansard: zinc with standing seams, flat terrasson on top
    float hc = abs(vNl.x) > 0.5 ? vWorld.z : vWorld.x;
    float seam = 1.0 - smoothstep(0.0, 0.035, abs(fract(hc / 0.60) - 0.5) * 0.60 - 0.276);
    float sheet = 1.0 - smoothstep(0.0, 0.05, abs(fract(vWorld.y / 1.05) - 0.5) * 1.05 - 0.44);
    vec3 zinc = uZinc * vTint * (0.92 + 0.16 * vnoise2(vWorld.xz * 0.30 + vWorld.y * 0.14));
    zinc *= mix(1.0, 0.87, seam * 0.8 + sheet * 0.30);
    zinc *= mix(0.88, 1.0, smoothstep(-2.0, 9.0, vWorld.y));
    zinc *= 1.0 - 0.20 * smoothstep(0.45, 0.95, vnoise2(vec2(hc * 0.5, vWorld.y * 0.12)));
    alb = mix(zinc, uZinc * 0.72 * vTint, step(0.5, vNl.y));
    ao *= 0.97;
  } else if (k < 1.5) {
    // ---- dormer: zinc cheek with a lit window on the outward (+Z) face
    alb = uZinc * (0.94 + 0.14 * vnoise2(vWorld.xz * 0.9));
    if (step(0.5, vNl.z) > 0.5 && lod < 1.5) {
      float w = 1.0 - smoothstep(0.30, 0.40, max(abs(vLp.x) * 2.0, abs(vLp.y + 0.02) * 2.0));
      float lit = step(0.30, hash12(vWorld.xz * 3.1 + sd));
      vec3 on = uLamp * (lit * uWindowLit * (0.6 + 1.1 * hash12(vWorld.zx * 7.0 + sd)));
      alb = mix(alb, vec3(0.020, 0.024, 0.030), w);
      emis += w * on * 1.5;
      emis += (1.0 - w) * uLamp * (exp(-max(0.0, max(abs(vLp.x) * 2.0, abs(vLp.y + 0.02) * 2.0) - 0.42) * 5.0)
             * lit * uWindowLit * 0.18);
    }
    ao *= 0.94;
  } else if (k < 2.5) {
    // ---- chimney stack: pale render, clay pots on top
    vec3 c = uChimney * (0.90 + 0.20 * vnoise2(vWorld.xz * 2.2 + vWorld.y * 0.8));
    float pot = smoothstep(0.42, 0.50, vLp.y + 0.02);
    alb = mix(c, vec3(0.300, 0.105, 0.062), pot);
    alb = mix(alb, c * 0.72, step(0.5, vNl.y));
    nUp += step(0.5, vNl.y) * 0.3;
    ao *= 1.0 - 0.25 * smoothstep(0.28, 0.46, vLp.y) * (1.0 - pot);
  } else if (k < 3.5) {
    // ---- water tank
    vec3 wood = vec3(0.075, 0.055, 0.038) * (0.85 + 0.3 * vnoise2(vWorld.xz * 1.5));
    alb = mix(wood, uZinc * 0.9, step(0.5, vNl.y));
    ao *= 0.95;
  } else {
    // ---- lead / slate dome, rotunda cap
    float u = clamp(vNl.y, 0.0, 1.0);
    vec3 d = mix(uSlate * 0.80, uSlate * 1.25, u);
    d *= 0.92 + 0.16 * vnoise2(vWorld.xz * 2.6 + vWorld.y * 0.9);
    float ang = atan(vWorld.z, vWorld.x);
    d *= 1.0 - 0.16 * (1.0 - smoothstep(0.0, 0.09, abs(fract(ang * 3.8197) - 0.5) * 6.2832 - 0.28));
    alb = d;
  }

  Ng = normalize(Ng + vec3(0.0, nUp, 0.0));
  vec3 outc = alb * ao * lightSurface(Ng, vWorld) + emis;
  outc = applyAerial(outc, uFog, dist, uFogDensity);
  gl_FragColor = vec4(outc, 1.0);
}
`;

// ---------------------------------------------------------------------------
// materials
// ---------------------------------------------------------------------------
function makeUniforms() {
  return {
    uSunDir: { value: new THREE.Vector3(0.3, 0.6, 0.5) },
    uMoonDir: { value: new THREE.Vector3(-0.3, 0.6, -0.5) },
    uSunColor: { value: new THREE.Color(1, 1, 1) },
    uMoonI: { value: 0 },
    uSunI: { value: 2.5 },
    uAmb: { value: new THREE.Color(0.3, 0.35, 0.45) },
    uAmbI: { value: 1.2 },
    uZenith: { value: new THREE.Color(0.1, 0.2, 0.5) },
    uHorizon: { value: new THREE.Color(0.6, 0.7, 0.8) },
    uGround: { value: new THREE.Color(0.2, 0.19, 0.16) },
    uFog: { value: new THREE.Color(0.6, 0.7, 0.8) },
    uLamp: { value: new THREE.Color(0xffb257) },
    uIron: { value: new THREE.Color(0x191a1c) },
    uStone: { value: uStone },
    uZinc: { value: new THREE.Color(0x8d97a2) },
    uSlate: { value: new THREE.Color(0x50596a) },
    uChimney: { value: new THREE.Color(0xbfae95) },
    uFogDensity: { value: FOG_DENSITY },
    uWindowLit: { value: 0 },
    uTime: { value: 0 },
    uGroundH: { value: GROUND_H },
    uCorniceH: { value: CORNICE_H },
  };
}

function lightUniforms(U) {
  const u = THREE.UniformsUtils.clone(THREE.UniformsLib.lights);
  Object.assign(u, U);
  return u;
}

function makeMaterials(U) {
  const base = { uniforms: null, lights: true, side: THREE.FrontSide };
  const facade = new THREE.ShaderMaterial(Object.assign({}, base, {
    uniforms: lightUniforms(U), vertexShader: FACADE_VERT, fragmentShader: FACADE_FRAG,
  }));
  const prop = new THREE.ShaderMaterial(Object.assign({}, base, {
    uniforms: lightUniforms(U), vertexShader: PROP_VERT, fragmentShader: PROP_FRAG,
  }));
  const lm = new THREE.ShaderMaterial(Object.assign({}, base, {
    uniforms: lightUniforms(U), vertexShader: LM_VERT, fragmentShader: LM_FRAG,
  }));
  return { facade, prop, lm };
}

// ---------------------------------------------------------------------------
// instance plumbing
// ---------------------------------------------------------------------------
const _m4 = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _v = new THREE.Vector3();
const _s = new THREE.Vector3();
const _YUP = new THREE.Vector3(0, 1, 0);

function inst(geo, mat, list, name) {
  const n = Math.max(1, list.length);
  const mesh = new THREE.InstancedMesh(geo, mat, n);
  mesh.name = name;
  const size = new Float32Array(n * 3), seed = new Float32Array(n), tint = new Float32Array(n * 3);
  const lod = new Float32Array(n), floors = new Float32Array(n), shape = new Float32Array(n);
  for (let i = 0; i < list.length; i++) {
    const it = list[i];
    _q.setFromAxisAngle(_YUP, it.ry || 0);
    _v.set(it.x, it.y, it.z);
    _s.set(it.sx, it.sy, it.sz);
    _m4.compose(_v, _q, _s);
    mesh.setMatrixAt(i, _m4);
    size[i * 3] = it.sx; size[i * 3 + 1] = it.sy; size[i * 3 + 2] = it.sz;
    seed[i] = it.seed;
    lod[i] = it.lod || 0;
    floors[i] = it.floors || 5;
    shape[i] = it.shape || 0;
    const t = it.tint || TINTS[0];
    tint[i * 3] = t[0]; tint[i * 3 + 1] = t[1]; tint[i * 3 + 2] = t[2];
  }
  mesh.instanceMatrix.needsUpdate = true;
  geo.setAttribute('aSize', new THREE.InstancedBufferAttribute(size, 3));
  geo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seed, 1));
  geo.setAttribute('aTint', new THREE.InstancedBufferAttribute(tint, 3));
  geo.setAttribute('aLod', new THREE.InstancedBufferAttribute(lod, 1));
  geo.setAttribute('aFloors', new THREE.InstancedBufferAttribute(floors, 1));
  geo.setAttribute('aShape', new THREE.InstancedBufferAttribute(shape, 1));
  mesh.count = list.length;
  mesh.frustumCulled = false;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function boxUnit() { return boxGeo(1, 1, 1); }

function cylUnit() { return new THREE.CylinderGeometry(0.5, 0.5, 1, 18, 1, true); }

// mansard: two slopes + flat terrasson, unit footprint and unit height
function mansardUnit() {
  const rings = [[0.0, 0.5, 0.5], [0.55, 0.440, 0.440], [1.0, 0.200, 0.200]];
  const pos = [], nor = [], uv = [];
  const quad = (a, b, c, d, nx, ny, nz, u0, u1) => {
    const P = [a, b, c, a, c, d];
    const T = [[0, 0], [1, 0], [1, 1], [0, 0], [1, 1], [0, 1]];
    for (let i = 0; i < 6; i++) {
      pos.push(P[i][0], P[i][1], P[i][2]);
      nor.push(nx, ny, nz);
      uv.push(u0 + (u1 - u0) * T[i][0], T[i][1]);
    }
  };
  for (let r = 0; r < rings.length - 1; r++) {
    const a = rings[r], b = rings[r + 1];
    const y0 = a[0], x0 = a[1], z0 = a[2], y1 = b[0], x1 = b[1], z1 = b[2];
    const faces = [
      [[-x0, y0, z0], [x0, y0, z0], [x1, y1, z1], [-x1, y1, z1], 0, 0, 1],
      [[x0, y0, -z0], [-x0, y0, -z0], [-x1, y1, -z1], [x1, y1, -z1], 0, 0, -1],
      [[-x0, y0, -z0], [-x0, y0, z0], [-x1, y1, z1], [-x1, y1, -z1], -1, 0, 0],
      [[x0, y0, z0], [x0, y0, -z0], [x1, y1, -z1], [x1, y1, z1], 1, 0, 0],
    ];
    for (const f of faces) quad(f[0], f[1], f[2], f[3], f[4], f[5], f[6], r * 0.5, r * 0.5 + 0.5);
  }
  const t = rings[rings.length - 1];
  quad([-t[1], t[0], t[2]], [t[1], t[0], t[2]], [t[1], t[0], -t[2]], [-t[1], t[0], -t[2]], 0, 1, 0, 0, 1);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  return g;
}

// dormer body + gable cap (merged through lib.mergeGeometries)
function dormerUnit() {
  const body = boxGeo(1, 1, 1);
  const cap = new THREE.CylinderGeometry(0.62, 0.62, 1, 3, 1);
  cap.rotateZ(Math.PI * 0.5);
  cap.rotateY(Math.PI * 0.5);
  cap.scale(1.0, 0.40, 1.0);
  cap.translate(0, 0.66, 0);
  const g = mergeGeometries([body, cap]);
  g.computeVertexNormals();
  return g;
}

function chimneyUnit() { return boxGeo(1, 1, 1); }

function tankUnit() {
  const b = new THREE.CylinderGeometry(0.5, 0.5, 1, 12, 1, false);
  const c = new THREE.CylinderGeometry(0.04, 0.5, 1, 12, 1, false);
  c.translate(0, 1.02, 0);
  const g = mergeGeometries([b, c]);
  g.computeVertexNormals();
  return g;
}

// surface of revolution from [y, r] pairs, unit height and radius
function latheGeo(pts, seg) {
  const pos = [], nor = [], uv = [], idx = [];
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const y = pts[i][0], r = pts[i][1];
    const p = pts[Math.max(0, i - 1)], q = pts[Math.min(n - 1, i + 1)];
    const dr = (q[1] - p[1]) / Math.max(1e-4, q[0] - p[0]);
    const len = Math.hypot(1, dr);
    for (let j = 0; j <= seg; j++) {
      const a = j / seg * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
      pos.push(ca * r, y, sa * r);
      nor.push(ca / len, -dr / len, sa / len);
      uv.push(j / seg, y);
    }
  }
  for (let i = 0; i < n - 1; i++) {
    for (let j = 0; j < seg; j++) {
      const a = i * (seg + 1) + j, b = a + seg + 1;
      idx.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}
function domeUnit() {
  return latheGeo([[0, 1], [0.12, 0.99], [0.30, 0.955], [0.50, 0.865], [0.68, 0.72],
    [0.83, 0.53], [0.93, 0.32], [1.0, 0.0]], 16);
}

// ---------------------------------------------------------------------------
// the city: a perimeter of buildings on every allowed block
// ---------------------------------------------------------------------------
function buildBlocks(rng, L) {
  const P = CITY.block + CITY.street;
  const N = Math.ceil(CITY.maxRadius / P);
  const R = CITY.block;

  for (let i = -N; i <= N; i++) {
    for (let j = -N; j <= N; j++) {
      const x0 = i * P + CITY.street, z0 = j * P + CITY.street;
      const x1 = x0 + R, z1 = z0 + R;
      const cx = (x0 + x1) * 0.5, cz = (z0 + z1) * 0.5;
      const rad = Math.hypot(cx, cz);
      if (rad > CITY.maxRadius) continue;
      if (!cityAllowed(cx, cz)) continue;
      const lod = rad < 700 ? 0 : rad < 1500 ? 1 : 2;

      const tall = rng.chance(0.16) ? 6 : (rng.chance(0.22) ? 4 : 5);
      const floorH = rng.range(2.90, 3.10);
      const tint = TINTS[rng.int(0, TINTS.length - 1)];
      const seedBase = rng.range(0, 512);
      const runMin = lod === 0 ? RUN_MIN : lod === 1 ? 22 : 30;
      const runMax = lod === 0 ? RUN_MAX : lod === 1 ? 36 : 48;
      const depth = lod === 0 ? rng.range(12, 16) : rng.range(13, 17);

      // rounded corner buildings (rotundes) - 0=(x0,z0) 1=(x1,z0) 2=(x1,z1) 3=(x0,z1)
      const cr = [0, 0, 0, 0];
      const cRot = lod === 0 ? 0.42 : lod === 1 ? 0.15 : 0;
      const cxs = [x0, x1, x1, x0], czs = [z0, z0, z1, z1];
      const cdx = [1, -1, -1, 1], cdz = [1, 1, -1, -1];
      for (let c = 0; c < 4; c++) {
        if (!rng.chance(cRot)) continue;
        if (!cityAllowed(cxs[c], czs[c])) continue;
        const r = rng.range(6.5, 9.5);
        cr[c] = r;
        const h = GROUND_H + (tall + 1) * floorH + CORNICE_H;
        const px = cxs[c] + cdx[c] * r, pz = czs[c] + cdz[c] * r;
        L.cyl.push({
          x: px, y: h * 0.5, z: pz, sx: r * 2, sy: h, sz: r * 2,
          seed: seedBase + 40 + c * 3.7, tint, lod, floors: tall + 1, shape: 1,
        });
        L.dome.push({
          x: px, y: h, z: pz, sx: r * 2.1, sy: r * (rng.chance(0.25) ? 1.55 : 0.78), sz: r * 2.1,
          seed: seedBase + 60 + c, tint: [1, 1, 1], lod, shape: 4,
        });
      }

      // four sides of the block; each is a continuous street wall of runs
      const sides = [
        { ax: 0, o: z0, dir: 1, ry: 0, iA: cr[0], iB: cr[1] },
        { ax: 0, o: z1, dir: -1, ry: 0, iA: cr[3], iB: cr[2] },
        { ax: 1, o: x0, dir: 1, ry: Math.PI * 0.5, iA: cr[0], iB: cr[3] },
        { ax: 1, o: x1, dir: -1, ry: -Math.PI * 0.5, iA: cr[1], iB: cr[2] },
      ];
      for (const S of sides) {
        const o0 = S.ax === 0 ? x0 : z0;
        let t = o0 + S.iA;
        const tEnd = o0 + R - S.iB;
        if (tEnd - t < 9) continue;
        while (t < tEnd - 2) {
          let len = rng.range(runMin, runMax);
          if (tEnd - t - len < runMin * 0.55) len = tEnd - t;
          const atCorner = (t < o0 + S.iA + 6) || (t + len > tEnd - 6);
          const floors = tall + (atCorner && lod === 0 ? 1 : 0);
          const h = GROUND_H + floors * floorH + CORNICE_H;
          // keep the wall (both faces) out of the corridor, the river and the
          // gardens: step the facade line back into the block if need be.
          let off = -1;
          for (let o = 0; o <= 9 && off < 0; o++) {
            let ok = true;
            for (let k = 0; k <= 2 && ok; k++) {
              const q = t + len * k * 0.5;
              const px = (S.ax === 0 ? q : S.o) + (S.ax === 1 ? S.dir * o : 0);
              const pz = (S.ax === 0 ? S.o : q) + (S.ax === 0 ? S.dir * o : 0);
              const ix = px + (S.ax === 1 ? S.dir * depth : 0);
              const iz = pz + (S.ax === 0 ? S.dir * depth : 0);
              if (!cityAllowed(px, pz) || !cityAllowed(ix, iz)) ok = false;
            }
            if (ok) off = o;
          }
          if (off >= 0) {
            const seed = seedBase + rng.range(0, 90);
            const mx = (S.ax === 0 ? t + len * 0.5 : S.o + S.dir * (depth * 0.5 + off));
            const mz = (S.ax === 0 ? S.o + S.dir * (depth * 0.5 + off) : t + len * 0.5);
            L.box.push({
              x: mx, y: h * 0.5, z: mz, ry: S.ry, sx: len, sy: h, sz: depth,
              seed, tint, lod, floors, shape: 0,
            });
            const mh = CITY.mansard * rng.range(0.86, 1.08);
            const inx = S.ax === 1 ? S.dir : 0, inz = S.ax === 0 ? S.dir : 0;
            L.mans.push({
              x: mx + inx * 0.30, y: h + mh * 0.5, z: mz + inz * 0.30, ry: S.ry,
              sx: len * 0.995, sy: mh, sz: depth * 0.94,
              seed: seed + 7.7, tint: [0.92 + 0.16 * rng.next(), 0.94 + 0.12 * rng.next(), 1.0],
              lod, shape: 0,
            });
            if (lod === 0) {
              const nd = Math.max(1, Math.floor(len / 6.4));
              for (let d = 0; d < nd; d++) {
                const q = t + len * (d + 0.5) / nd;
                L.dormer.push({
                  x: S.ax === 0 ? q : S.o + S.dir * (1.45 + off),
                  y: h + 1.62,
                  z: S.ax === 0 ? S.o + S.dir * (1.45 + off) : q,
                  ry: S.ry + Math.PI,
                  sx: 1.25, sy: 1.45, sz: 1.7, seed: seed + d * 3.1, tint: [1, 1, 1], lod, shape: 1,
                });
              }
            }
            // chimney stacks along the ridge of the terrace
            const nc = lod === 0 ? 2 : 1;
            for (let c = 0; c < nc; c++) {
              if (!rng.chance(0.78)) continue;
              const q = t + len * (c + 0.5) / nc;
              const dp = off + depth * (0.5 + rng.range(-0.14, 0.14));
              const cxx = S.ax === 0 ? q : S.o + S.dir * dp;
              const czz = S.ax === 0 ? S.o + S.dir * dp : q;
              const chh = rng.range(1.5, 2.6);
              L.chim.push({
                x: cxx, y: h + mh + chh * 0.5 - 0.22, z: czz, ry: S.ry,
                sx: rng.range(1.1, 2.0), sy: chh, sz: rng.range(0.9, 1.5),
                seed: seed + c * 5.3, tint: [1, 1, 1], lod, shape: 2,
              });
              if (lod === 0 && rng.chance(0.05)) {
                L.tank.push({
                  x: cxx, y: h + mh + 0.5, z: czz, ry: S.ry,
                  sx: 3.0, sy: 2.6, sz: 3.0, seed: seed + c, tint: [1, 1, 1], lod, shape: 3,
                });
              }
            }
            if (lod < 2 && rng.chance(0.02)) {
              L.dome.push({
                x: mx, y: h + mh * 0.9, z: mz, ry: 0,
                sx: Math.min(len, depth) * 0.45, sy: rng.range(4.5, 8.0), sz: Math.min(len, depth) * 0.45,
                seed: seed + 11, tint: [1, 1, 1], lod, shape: 4,
              });
            }
          }
          t += len;
        }
      }
    }
  }
}


// ---------------------------------------------------------------------------
// Landmarks on the great axis: Ecole Militaire, Palais de Chaillot, Pont
// d'Iena.  These are merged (non-instanced) meshes carrying a per-vertex
// surface class, so one classical shader covers stone, slate, lead, glass,
// paving, iron and water-stained masonry.
// ---------------------------------------------------------------------------

const LM_VERT = /* glsl */ `
${SHADOW_VERT}
attribute float aCls;
attribute float aSeed;
attribute vec3 aTint;
attribute vec4 aAux;
varying vec3 vWorld;
varying vec3 vWN;
varying vec2 vF;
varying float vCls;
varying float vSeed;
varying vec3 vTint;
varying vec4 vAux;
void main(){
  vec4 worldPosition = modelMatrix * vec4(position, 1.0);
  vec3 transformedNormal = normalize(mat3(modelMatrix) * normal);
  vWorld = worldPosition.xyz;
  vWN = transformedNormal;
  vF = uv;
  vCls = aCls;
  vSeed = aSeed;
  vTint = aTint;
  vAux = aAux;
  #include <shadowmap_vertex>
  gl_Position = projectionMatrix * viewMatrix * worldPosition;
}
`;

const LM_FRAG = /* glsl */ `
${SHADOW_FRAG}
${LIGHT_LIB}
uniform vec3 uStone, uSlate, uIron, uZinc;
varying vec3 vWorld;
varying vec3 vWN;
varying vec2 vF;
varying float vCls;
varying float vSeed;
varying vec3 vTint;
varying vec4 vAux;

float bandF(float x, float a, float b, float soft){
  return smoothstep(a - soft, a + soft, x) * (1.0 - smoothstep(b - soft, b + soft, x));
}

void main(){
  vec3 Ng = normalize(vWN);
  vec3 V = normalize(cameraPosition - vWorld);
  float dist = length(cameraPosition - vWorld);
  float k = floor(vCls + 0.5);
  float sd = vSeed;
  vec3 alb; vec3 emis = vec3(0.0); float ao = 1.0; float nUp = 0.0;

  if (k < 0.5) {
    // ---- classical limestone: coursing, plinth, windows, cornice, pilasters
    float mode = vAux.x;
    float fh = vAux.y;
    float pH = max(vAux.z, 0.001);
    vec2 p = vF;
    float ch = mix(0.58, 1.20, step(0.5, mode) * (1.0 - step(1.5, mode)));
    float cm = fract(p.y / ch);
    float mortar = smoothstep(0.0, 0.05, cm) * (1.0 - smoothstep(0.90, 0.965, cm));
    vec3 stone = uStone * vTint * (0.94 + 0.13 * vnoise2(p * 0.85));
    stone *= mix(0.82, 1.0, mortar);
    stone *= mix(1.0, 0.86, 1.0 - smoothstep(1.10, 1.45, p.y));
    alb = stone;
    // recessed dark opening / glass
    float glass = 0.0; float reveal = 0.0;
    if (fh > 0.05 && mode < 2.5) {
      float bayW = 4.30;
      float bx = floor(p.x / bayW);
      float xm = (fract(p.x / bayW) - 0.5) * bayW;
      float fi = floor(p.y / fh);
      float ly = p.y - fi * fh;
      vec2 d = abs(vec2(xm, ly - (1.05 + 1.75))) - vec2(0.85, 1.75);
      float s = max(d.x, d.y);
      glass = 1.0 - smoothstep(-0.04, 0.04, s);
      reveal = clamp((1.0 - smoothstep(-0.04, 0.04, s - 0.20)) - glass, 0.0, 1.0);
      float key = 1.0 - smoothstep(-0.05, 0.05, abs(xm) - 0.30) * step(ly, 4.0);
      float sill = (1.0 - smoothstep(-0.04, 0.04, abs(ly - 0.94) - 0.11))
                 * (1.0 - smoothstep(0.95, 1.25, abs(xm)));
      stone = mix(stone, stone * 1.08, sill);
      nUp += sill * 0.8;
      alb = mix(stone, stone * 0.62, reveal);
      alb = mix(alb, vec3(0.014, 0.018, 0.028), glass);
      ao *= 1.0 - 0.32 * reveal;
      float lit = step(0.62, hash12(vec2(bx * 2.7 + sd, fi * 3.1)));
      emis += glass * mix(uLamp, vec3(0.5, 0.66, 1.1), 0.25 * step(0.8, hash12(vec2(bx + sd, fi))))
            * (lit * uWindowLit * (0.5 + 0.9 * hash12(vec2(bx * 3.3 + sd, fi * 1.7))) * 1.1);
      float fres = pow(1.0 - clamp(dot(Ng, V), 0.0, 1.0), 4.0);
      emis += glass * skyTint() * (fres * 0.22 * (1.0 - uWindowLit));
    }
    // giant pilasters
    if (mode > 1.5 && mode < 2.5) {
      float f = abs(fract(p.x / 5.4) - 0.5) * 2.0;
      float pil = (1.0 - smoothstep(0.70, 0.80, f)) * smoothstep(0.9, 1.6, p.y)
                * (1.0 - smoothstep(pH - 2.4, pH - 1.6, p.y));
      alb = mix(alb, stone * 1.05, pil);
      nUp += 0.0;
      float cap = pil * bandF(p.y, pH - 2.6, pH - 2.1, 0.06);
      alb = mix(alb, stone * 1.12, cap);
    }
    // top cornice + a string course at each floor line
    float cor = smoothstep(pH - 1.35, pH - 1.10, p.y) * (1.0 - smoothstep(pH - 0.25, pH - 0.05, p.y));
    alb = mix(alb, stone * 1.10, cor);
    nUp += cor * 0.75 - (1.0 - cor) * smoothstep(pH - 1.9, pH - 1.30, p.y) * 0.8;
    alb *= 1.0 - 0.18 * smoothstep(pH - 3.0, pH - 1.3, p.y) * (1.0 - cor);
    if (fh > 0.05 && mode < 2.5) {
      float sc = bandF(fract(p.y / fh), 0.0, 0.10, 0.035);
      alb = mix(alb, stone * 1.08, sc);
      nUp += sc * 0.5;
    }
    float streak = vnoise2(vec2(p.x * 1.9, p.y * 0.05));
    alb *= 1.0 - 0.15 * smoothstep(0.45, 0.92, streak) * (1.0 - smoothstep(2.0, 16.0, p.y));
    ao *= mix(0.86, 1.0, smoothstep(0.0, 3.0, p.y));
  } else if (k < 1.5) {
    // ---- slate roof
    float hc = abs(vWN.x) > 0.5 ? vWorld.z : vWorld.x;
    alb = uSlate * vTint * (0.90 + 0.20 * vnoise2(vWorld.xz * 0.6 + vWorld.y * 0.3));
    alb *= 0.90 + 0.10 * smoothstep(0.0, 0.06, abs(fract(vWorld.y / 0.34) - 0.5) * 0.34 - 0.13);
    alb *= mix(0.82, 1.0, smoothstep(-2.0, 12.0, vWorld.y));
    alb *= 1.0 - 0.16 * smoothstep(0.5, 0.95, vnoise2(vec2(hc * 0.6, vWorld.y * 0.2)));
  } else if (k < 2.5) {
    // ---- lead dome
    float u = clamp(vWN.y, 0.0, 1.0);
    alb = mix(uSlate * 0.78, uSlate * 1.22, u) * vTint;
    float ang = atan(vWorld.z - vAux.x, vWorld.x - vAux.y);
    alb *= 1.0 - 0.18 * (1.0 - smoothstep(0.0, 0.10, abs(fract(ang * 3.8197) - 0.5) * 6.2832 - 0.28));
    alb *= 0.94 + 0.12 * vnoise2(vWorld.xz * 1.6);
  } else if (k < 3.5) {
    // ---- dark opening / lantern glass
    alb = vec3(0.020, 0.024, 0.032);
    float fres = pow(1.0 - clamp(dot(Ng, V), 0.0, 1.0), 3.0);
    alb = mix(alb, skyTint() * 0.4, fres * 0.5);
    float on = step(0.25, hash12(vWorld.xz * 1.7 + sd));
    emis += alb * 0.0 + uLamp * (on * uWindowLit * 1.5 + 0.05);
    emis += skyTint() * (fres * 0.25 * (1.0 - uWindowLit));
  } else if (k < 4.5) {
    // ---- paving / stone deck
    vec2 q = vWorld.xz * 0.62;
    vec2 f = abs(fract(q) - 0.5);
    float joint = smoothstep(0.44, 0.50, max(f.x, f.y));
    alb = vec3(0.185, 0.180, 0.168) * (0.86 + 0.26 * vnoise2(vWorld.xz * 1.1));
    alb *= mix(1.0, 0.72, joint);
    alb *= 1.0 - 0.12 * smoothstep(0.5, 0.95, vnoise2(vWorld.xz * 0.2));
  } else if (k < 5.5) {
    // ---- ironwork
    alb = uIron;
    float spec = pow(max(dot(reflect(-V, Ng), uSunDir), 0.0), 26.0);
    emis += spec * uSunColor * (uSunI * 0.25);
  } else {
    // ---- masonry in the river: waterline stain and algae
    alb = uStone * vTint * (0.88 + 0.16 * vnoise2(vF * 0.7));
    float wl = vWorld.y - (-7.5);
    alb *= mix(0.36, 1.0, smoothstep(-1.2, 2.4, wl));
    alb = mix(alb, vec3(0.055, 0.075, 0.045), 1.0 - smoothstep(-1.4, 0.6, wl));
    float streak6 = vnoise2(vec2(vF.x * 1.6, vWorld.y * 0.10));
    alb *= 1.0 - 0.22 * smoothstep(0.4, 0.9, streak6) * smoothstep(-6.0, 4.0, vWorld.y);
  }

  Ng = normalize(Ng + vec3(0.0, nUp, 0.0));
  vec3 outc = alb * ao * lightSurface(Ng, vWorld) + emis;
  outc = applyAerial(outc, uFog, dist, uFogDensity);
  gl_FragColor = vec4(outc, 1.0);
}
`;

// --- merged geometry accumulator -------------------------------------------
function acc() {
  return { pos: [], nor: [], uv: [], cls: [], seed: [], tint: [], aux: [] };
}
function pushV(A, x, y, z, nx, ny, nz, u, v, cls, seed, tint, aux) {
  A.pos.push(x, y, z);
  A.nor.push(nx, ny, nz);
  A.uv.push(u, v);
  A.cls.push(cls);
  A.seed.push(seed);
  A.tint.push(tint[0], tint[1], tint[2]);
  A.aux.push(aux[0], aux[1], aux[2], aux[3]);
}
function quad(A, a, b, c, d, nx, ny, nz, uvs, cls, seed, tint, aux) {
  const P = [a, b, c, a, c, d];
  const T = [uvs[0], uvs[1], uvs[2], uvs[0], uvs[2], uvs[3]];
  for (let i = 0; i < 6; i++) {
    pushV(A, P[i][0], P[i][1], P[i][2], nx, ny, nz, T[i][0], T[i][1], cls, seed, tint, aux);
  }
}
function tri(A, a, b, c, nx, ny, nz, uvs, cls, seed, tint, aux) {
  const P = [a, b, c];
  for (let i = 0; i < 3; i++) {
    pushV(A, P[i][0], P[i][1], P[i][2], nx, ny, nz, uvs[i][0], uvs[i][1], cls, seed, tint, aux);
  }
}
// an axis-aligned-in-local box with facade metres baked into uv
function addBox(A, w, h, d, x, y, z, ry, cls, clsTop, seed, tint, aux) {
  const g = boxGeo(w, h, d);
  const P = g.getAttribute('position'), N = g.getAttribute('normal');
  const idx = g.index.array;
  const ca = Math.cos(ry), sa = Math.sin(ry);
  for (let t = 0; t < idx.length; t += 3) {
    for (let k = 0; k < 3; k++) {
      const i = idx[t + k];
      const px = P.getX(i), py = P.getY(i), pz = P.getZ(i);
      const nx = N.getX(i), ny = N.getY(i), nz = N.getZ(i);
      let u;
      if (Math.abs(ny) > 0.5) u = px + w * 0.5;
      else if (Math.abs(nx) > 0.5) u = pz + d * 0.5;
      else u = px + w * 0.5;
      const v = y + py;
      pushV(A, x + px * ca + pz * sa, v, z - px * sa + pz * ca,
        nx * ca + nz * sa, ny, -nx * sa + nz * ca,
        u, v, (ny > 0.5 && clsTop !== undefined) ? clsTop : cls, seed, tint, aux);
    }
  }
  g.dispose();
}
function addGeo(A, g, m, cls, seed, tint, aux) {
  const P = g.getAttribute('position'), N = g.getAttribute('normal'), U = g.getAttribute('uv');
  const idx = g.index ? g.index.array : null;
  const n = idx ? idx.length : P.count;
  const v = new THREE.Vector3(), nv = new THREE.Vector3();
  const nm = new THREE.Matrix3().getNormalMatrix(m);
  for (let t = 0; t < n; t++) {
    const i = idx ? idx[t] : t;
    v.set(P.getX(i), P.getY(i), P.getZ(i)).applyMatrix4(m);
    nv.set(N.getX(i), N.getY(i), N.getZ(i)).applyMatrix3(nm).normalize();
    pushV(A, v.x, v.y, v.z, nv.x, nv.y, nv.z, U ? U.getX(i) : 0, U ? U.getY(i) : 0, cls, seed, tint, aux);
  }
}
function addCyl(A, r0, r1, h, x, y, z, seg, cls, seed, tint, aux) {
  const g = new THREE.CylinderGeometry(r0, r1, h, seg, 1, false);
  const m = new THREE.Matrix4().makeTranslation(x, y, z);
  addGeo(A, g, m, cls, seed, tint, aux);
  g.dispose();
}
function addLathe(A, pts, seg, x, y, z, sx, sy, sz, cls, seed, tint, aux) {
  const g = latheGeo(pts, seg);
  const m = new THREE.Matrix4().makeScale(sx, sy, sz).setPosition(x, y, z);
  addGeo(A, g, m, cls, seed, tint, aux);
  g.dispose();
}
// hipped / frustum roof between two rectangles
function addFrustum(A, x0, x1, z0, z1, y0, y1, ix, iz, cls, seed, tint, aux) {
  const b = [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];
  const t = [[x0 + ix, z0 + iz], [x1 - ix, z0 + iz], [x1 - ix, z1 - iz], [x0 + ix, z1 - iz]];
  const L = (p, q) => Math.hypot(q[0] - p[0], q[1] - p[1]);
  let acc2 = 0;
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    const dx = b[j][0] - b[i][0], dz = b[j][1] - b[i][1];
    const len = Math.hypot(dx, dz);
    const nx = dz / len, nz = -dx / len, dy = y1 - y0;
    const sl = Math.hypot(nx * dy, ix, nz * dy);
    quad(A, [b[i][0], y0, b[i][1]], [b[j][0], y0, b[j][1]], [t[j][0], y1, t[j][1]], [t[i][0], y1, t[i][1]],
      nx * dy / sl, ix / sl, nz * dy / sl, [[acc2, 0], [acc2 + len, 0], [acc2 + len, 1], [acc2, 1]], cls, seed, tint, aux);
    acc2 += len;
  }
  quad(A, [t[0][0], y1, t[0][1]], [t[1][0], y1, t[1][1]], [t[2][0], y1, t[2][1]], [t[3][0], y1, t[3][1]],
    0, 1, 0, [[0, 0], [1, 0], [1, 1], [0, 1]], cls, seed, tint, aux);
}
function buildAcc(A, name, mat) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(A.pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(A.nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(A.uv, 2));
  g.setAttribute('aCls', new THREE.Float32BufferAttribute(A.cls, 1));
  g.setAttribute('aSeed', new THREE.Float32BufferAttribute(A.seed, 1));
  g.setAttribute('aTint', new THREE.Float32BufferAttribute(A.tint, 3));
  g.setAttribute('aAux', new THREE.Float32BufferAttribute(A.aux, 4));
  const m = new THREE.Mesh(g, mat);
  m.name = name;
  m.castShadow = true;
  m.receiveShadow = true;
  m.frustumCulled = false;
  return m;
}
const W1 = [1, 1, 1], DS = [1, 0, 0, 0];

// --- Ecole Militaire: the long classical facade that closes the Champ de Mars
function buildEcole(A, seed) {
  const EZ = ECOLE_MILITAIRE.z, hw = ECOLE_MILITAIRE.halfWidth, dep = ECOLE_MILITAIRE.depth;
  const zF = EZ - dep * 0.5;                 // facade plane (faces the tower)
  const A0 = [0, 6.2, 0, 0];                 // plain ashlar + windows, 6.2 m floors
  const A1 = [1, 0, 0, 0];                   // rusticated plinth
  const A2 = [2, 6.6, 0, 0];                 // giant pilasters
  const S = seed;
  // long wings + rear range
  addBox(A, 74, 20, 30, -56, 10, zF + 15, 0, 0, undefined, S, W1, [0, 6.2, 20, 0]);
  addBox(A, 74, 20, 30, 56, 10, zF + 15, 0, 0, undefined, S + 3, W1, [0, 6.2, 20, 0]);
  addBox(A, 116, 17, 26, 0, 8.5, zF + 34, 0, 0, undefined, S + 5, W1, [3, 5.6, 17, 0]);
  addBox(A, 40, 20, 30, 0, 10, zF + 15, 0, 0, undefined, S + 7, W1, [0, 6.2, 20, 0]);
  // rusticated plinth running the whole length
  addBox(A, 188, 5.0, 6, 0, 2.5, zF - 1.4, 0, 1, undefined, S + 9, W1, [1, 0, 5, 0]);
  // end pavilions
  addBox(A, 34, 24, 46, -76, 12, zF + 17, 0, 0, undefined, S + 11, W1, [2, 6.2, 24, 0]);
  addBox(A, 34, 24, 46, 76, 12, zF + 17, 0, 0, undefined, S + 12, W1, [2, 6.2, 24, 0]);
  addBox(A, 38, 5, 50, -76, 26.5, zF + 17, 0, 1, 1, S + 13, W1, DS);
  addBox(A, 38, 5, 50, 76, 26.5, zF + 17, 0, 1, 1, S + 14, W1, DS);
  // central pavilion + portico
  addBox(A, 54, 27, 50, 0, 13.5, zF + 12, 0, 0, undefined, S + 15, W1, [2, 6.7, 27, 0]);
  addBox(A, 44, 5.4, 14, 0, 2.7, zF - 12, 0, 4, 4, S + 17, W1, DS);
  for (let i = -2; i <= 2; i++) {
    const x = i * 8.8;
    addBox(A, 3.0, 0.9, 3.0, x, 5.85, zF - 12, 0, 0, 0, S + 19, W1, DS);
    addCyl(A, 1.05, 1.15, 12.4, x, 12.5, zF - 12, 12, 0, S + 21, W1, [0, 0, 0, 0]);
    addBox(A, 3.0, 0.9, 3.0, x, 19.15, zF - 12, 0, 0, 0, S + 23, W1, DS);
  }
  addBox(A, 48, 2.8, 15, 0, 20.9, zF - 12, 0, 0, 1, S + 25, W1, [0, 0, 0, 0]);
  // pediment over the portico
  const pz0 = zF - 19.5, pz1 = zF - 4.5;
  quad(A, [-24, 22.3, pz0], [24, 22.3, pz0], [24, 22.3, pz1], [-24, 22.3, pz1], 0, 0, -1,
    [[0, 0], [48, 0], [48, 15], [0, 15]], 0, S + 27, W1, [2, 0, 22.3, 0]);
  tri(A, [-24, 22.3, pz0], [0, 29.5, pz0], [24, 22.3, pz0], 0, 0, -1, [[0, 0], [24, 7.2], [48, 0]], 0, S + 28, W1, [3, 0, 29.5, 0]);
  tri(A, [24, 22.3, pz1], [0, 29.5, pz1], [-24, 22.3, pz1], 0, 0, 1, [[0, 0], [24, 7.2], [48, 0]], 0, S + 29, W1, [3, 0, 29.5, 0]);
  const rl = Math.hypot(24, 7.2);
  quad(A, [-24, 22.3, pz0], [0, 29.5, pz0], [0, 29.5, pz1], [-24, 22.3, pz1], -7.2 / rl, 24 / rl, 0,
    [[0, 0], [rl, 0], [rl, 15], [0, 15]], 1, S + 30, W1, DS);
  quad(A, [24, 22.3, pz1], [0, 29.5, pz1], [0, 29.5, pz0], [24, 22.3, pz0], 7.2 / rl, 24 / rl, 0,
    [[0, 0], [rl, 0], [rl, 15], [0, 15]], 1, S + 31, W1, DS);
  // slate roofs on the wings and pavilions
  addFrustum(A, -93, -19, zF + 1, zF + 29, 20, 25.4, 3.2, 3.2, 1, S + 33, W1, DS);
  addFrustum(A, 19, 93, zF + 1, zF + 29, 20, 25.4, 3.2, 3.2, 1, S + 34, W1, DS);
  // drum, dome, lantern
  const cyl = [[0, 1], [0.06, 0.99], [0.2, 0.96], [0.42, 0.885], [0.62, 0.755], [0.79, 0.575], [0.91, 0.36], [1.0, 0.0]];
  addCyl(A, 13.4, 13.4, 15, 0, 34.5, zF + 12, 20, 0, S + 36, W1, [0, 6.5, 42, 0]);
  addCyl(A, 14.6, 14.6, 1.6, 0, 42.8, zF + 12, 20, 6, S + 37, W1, DS);
  addLathe(A, cyl, 20, 0, 43.4, zF + 12, 14.6, 17.5, 14.6, 2, S + 38, W1, [0, zF + 12, 0, 0]);
  addCyl(A, 3.0, 3.0, 6.5, 0, 63.5, zF + 12, 12, 0, S + 39, W1, [2, 0, 6.5, 0]);
  addLathe(A, cyl, 12, 0, 66.6, zF + 12, 3.4, 4.4, 3.4, 2, S + 40, W1, [0, zF + 12, 0, 0]);
  addCyl(A, 0.35, 0.7, 6.5, 0, 74.5, zF + 12, 8, 2, S + 41, W1, DS);
}

// --- Palais de Chaillot: two curved colonnaded wings sweeping back ----------
function buildChaillot(A, seed) {
  const Z = TROCADERO.palaceZ;
  const S = seed;
  const bez = (p0, p1, p2, t) => {
    const u = 1 - t;
    return [u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0],
            u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1]];
  };
  const bezD = (p0, p1, p2, t) => {
    const u = 1 - t;
    return [2 * u * (p1[0] - p0[0]) + 2 * t * (p2[0] - p1[0]),
            2 * u * (p1[1] - p0[1]) + 2 * t * (p2[1] - p1[1])];
  };
  for (const sgn of [-1, 1]) {
    const P0 = [sgn * 30, Z - 1], P1 = [sgn * 78, Z - 24], P2 = [sgn * 126, Z - 62];
    const N = 12, depth = 24;
    const pts = [];
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      const p = bez(P0, P1, P2, t);
      const d = bezD(P0, P1, P2, t);
      const dl = Math.hypot(d[0], d[1]);
      const tx = d[0] / dl, tz = d[1] / dl;
      let nx = tz, nz = -tx;                       // outward (away from the tower)
      if (nz > 0) { nx = -nx; nz = -nz; }
      const h = 20 + 7 * (1 - t) * (1 - t) + 4.5 * t * t;
      pts.push({ x: p[0], z: p[1], nx, nz, tx, tz, h, al: 0, s: sgn });
    }
    let al = 0;
    for (let i = 0; i < N; i++) {
      const a = pts[i], b = pts[i + 1];
      const seg = Math.hypot(b.x - a.x, b.z - a.z);
      // front wall (faces the tower), floor lines every 6.4 m
      quad(A, [a.x, 0, a.z], [b.x, 0, b.z], [b.x, b.h, b.z], [a.x, a.h, a.z],
        -a.nx, 0, -a.nz, [[al, 0], [al + seg, 0], [al + seg, b.h], [al, a.h]],
        0, S + i * 0.7, W1, [2, 6.4, (a.h + b.h) * 0.5, 0]);
      // back wall + roof + end caps
      const ax = a.x + a.nx * depth, az = a.z + a.nz * depth;
      const bx = b.x + b.nx * depth, bz = b.z + b.nz * depth;
      quad(A, [ax, 0, az], [ax, a.h, az], [bx, b.h, bz], [bx, 0, bz],
        a.nx, 0, a.nz, [[0, 0], [0, a.h], [seg, b.h], [seg, 0]], 0, S + i * 0.7 + 0.2, W1, [3, 0, 0, 0]);
      quad(A, [a.x, a.h, a.z], [b.x, b.h, b.z], [bx, b.h, bz], [ax, a.h, az],
        0, 1, 0, [[al, 0], [al + seg, 0], [al + seg, depth], [al, depth]], 1, S + i * 0.7 + 0.4, W1, DS);
      al += seg;
    }
    // columns + entablature in front of the wall
    for (let i = 0; i <= N; i++) {
      const p = pts[i];
      const cx = p.x - p.nx * 2.9, cz = p.z - p.nz * 2.9;
      addBox(A, 2.6, 0.9, 2.6, cx, 6.15, cz, Math.atan2(p.tx, p.tz), 0, 0, S + i, W1, DS);
      addCyl(A, 0.82, 0.92, 10.6, cx, 11.9, cz, 12, 0, S + i + 0.1, W1, [0, 0, 0, 0]);
      addBox(A, 2.6, 0.8, 2.6, cx, 17.6, cz, Math.atan2(p.tx, p.tz), 0, 0, S + i + 0.2, W1, DS);
      if (i < N) {
        const q = pts[i + 1];
        const qx = q.x - q.nx * 2.9, qz = q.z - q.nz * 2.9;
        // entablature: soffit over the columns then the architrave face
        quad(A, [p.x, 17.9, p.z], [q.x, 17.9, q.z], [qx, 17.9, qz], [cx, 17.9, cz],
          0, -1, 0, [[0, 0], [1, 0], [1, 1], [0, 1]], 0, S + i + 0.3, W1, [0, 0, 0, 0]);
        quad(A, [cx, 17.9, cz], [qx, 17.9, qz], [qx, 21.0, qz], [cx, 21.0, cz],
          -p.nx, 0, -p.nz, [[0, 0], [1, 0], [1, 1], [0, 1]], 0, S + i + 0.35, W1, [0, 0, 0, 0]);
      }
    }
    // inner pavilion next to the esplanade + outer pavilion at the wing end
    const e = pts[N], eang = Math.atan2(e.tx, e.tz);
    addBox(A, 30, 30, 46, sgn * 34, 15, Z - 22, 0, 0, undefined, S + 50, W1, [2, 6.6, 30, 0]);
    addBox(A, 34, 6, 50, sgn * 34, 33, Z - 22, 0, 1, 1, S + 51, W1, DS);
    addBox(A, 36, 26, 44, e.x + e.nx * 16, 13, e.z + e.nz * 16, eang, 0, undefined, S + 52, W1, [2, 6.5, 26, 0]);
    addFrustum(A, sgn * 34 - 16, sgn * 34 + 16, Z - 46, Z + 2, 30, 34.5, 3.5, 3.5, 1, S + 53, W1, DS);
    // podium under the colonnade
    for (let i = 0; i < N; i++) {
      const a = pts[i], b = pts[i + 1];
      quad(A, [a.x, 5.7, a.z], [b.x, 5.7, b.z], [a.x - a.nx * 4.4, 5.7, a.z - a.nz * 4.4], [b.x - b.nx * 4.4, 5.7, b.z - b.nz * 4.4],
        0, 1, 0, [[0, 0], [1, 0], [1, 1], [0, 1]], 4, S + 60 + i, W1, DS);
      quad(A, [a.x, 0, a.z], [b.x, 0, b.z], [b.x, 5.7, b.z], [a.x, 5.7, a.z],
        -a.nx, 0, -a.nz, [[0, 0], [1, 0], [1, 1], [0, 1]], 1, S + 70 + i, W1, [1, 0, 5.7, 0]);
    }
  }
  // esplanade between the two inner pavilions + parapet + stairs
  addBox(A, 104, 1.7, 44, 0, 0.85, Z + 22, 0, 4, 4, S + 80, W1, DS);
  addBox(A, 104, 1.2, 1.4, 0, 2.3, Z + 43.4, 0, 0, 0, S + 81, W1, [3, 0, 0, 0]);
  addBox(A, 1.4, 1.2, 44, -51.4, 2.3, Z + 22, 0, 0, 0, S + 82, W1, [3, 0, 0, 0]);
  addBox(A, 1.4, 1.2, 44, 51.4, 2.3, Z + 22, 0, 0, 0, S + 83, W1, [3, 0, 0, 0]);
  for (let i = 0; i < 3; i++) {
    addBox(A, 30, 0.42, 1.2, 0, 1.5 - i * 0.42, Z + 44.6 + i * 1.25, 0, 4, 4, S + 84 + i, W1, DS);
  }
}

// --- Pont d'Iena: five shallow stone arches over the Seine ------------------
function buildPont(A, seed) {
  const W = SEINE.bridgeWidth, x0 = -W * 0.5, x1 = W * 0.5;
  const zA = SEINE.zNear - 4, zB = SEINE.zFar + 4;
  const deckTop = 9.0, deckBot = 5.7;
  const springY = -3.4, crownY = deckBot - 1.5;
  const NP = 5, span = (zB - zA) / NP, pierW = 7.0;
  const clear = span - pierW, half = clear * 0.5, rise = crownY - springY;
  const R = (half * half + rise * rise) / (2 * rise), yc = crownY - R;
  const S = seed;
  for (let a = 0; a < NP; a++) {
    const zc = zA + span * (a + 0.5);
    const NS = 12;
    for (let j = 0; j < NS; j++) {
      const za = zc - half + 2 * half * j / NS, zb = zc - half + 2 * half * (j + 1) / NS;
      const ya = yc + Math.sqrt(Math.max(0, R * R - (za - zc) * (za - zc)));
      const yb = yc + Math.sqrt(Math.max(0, R * R - (zb - zc) * (zb - zc)));
      // intrados (soffit)
      let ny = -(ya - yc), nz = -(za - zc);
      const nl = Math.hypot(ny, nz); ny /= nl; nz /= nl;
      quad(A, [x0, ya, za], [x1, ya, za], [x1, yb, zb], [x0, yb, zb], 0, ny, nz,
        [[0, 0], [W, 0], [W, 1], [0, 1]], 6, S, W1, [0, ya, 0, 0]);
      // side spandrels + projecting archivolts
      for (const sx of [x0 - 0.25, x1 + 0.25]) {
        const sn = sx < 0 ? -1 : 1;
        const oa = [sx, ya, za], ob = [sx, yb, zb];
        quad(A, oa, ob, [sx, deckBot, zb], [sx, deckBot, za], sn, 0, 0,
          [[0, ya], [1, yb], [1, deckBot], [0, deckBot]], 6, S + 1, W1, [0, 0, 0, 0]);
        // archivolt band, pushed out radially
        const ay = (ya - yc) * 1.09 + yc, by = (yb - yc) * 1.09 + yc;
        const az = zc + (za - zc) * 1.09, bz = zc + (zb - zc) * 1.09;
        const ox = sx + sn * 0.45;
        quad(A, [ox, ya, za], [ox, ay, az], [ox, by, bz], [ox, yb, zb], sn, 0, 0,
          [[0, 0], [0.5, 0], [0.5, 1], [0, 1]], 6, S + 2, W1, [0, 0, 0, 0]);
      }
    }
  }
  // piers and abutments
  for (let a = 0; a <= NP; a++) {
    const zc = zA + span * a;
    const end = (a === 0 || a === NP);
    const w = end ? 15 : pierW;
    const zz = end ? (a === 0 ? zA - 6 : zB + 6) : zc;
    addBox(A, W + 1.4, deckBot + 14, w, 0, (deckBot - 14) * 0.5, zz, 0, 6, 6, S + 10 + a, W1, [0, 0, 0, 0]);
    addBox(A, W + 2.6, 1.0, w + 1.2, 0, deckBot - 0.5, zz, 0, 6, 6, S + 20 + a, W1, [0, 0, 0, 0]);
  }
  // deck, parapets, lamps
  addBox(A, W, deckTop - deckBot, zB - zA + 30, 0, (deckTop + deckBot) * 0.5, (zA + zB) * 0.5, 0, 6, 4, S + 30, W1, [0, 0, 0, 0]);
  for (const sx of [-1, 1]) {
    addBox(A, 1.5, 1.5, zB - zA + 26, sx * (W * 0.5 - 0.75), deckTop + 0.75, (zA + zB) * 0.5, 0, 6, 6, S + 32, W1, [0, 0, 0, 0]);
    addBox(A, 1.9, 0.35, zB - zA + 26, sx * (W * 0.5 - 0.75), deckTop + 1.65, (zA + zB) * 0.5, 0, 6, 6, S + 33, W1, [0, 0, 0, 0]);
    for (let i = 0; i < 5; i++) {
      const lz = zA + 14 + i * (zB - zA - 28) / 4;
      const lx = sx * (W * 0.5 - 2.2);
      addBox(A, 2.0, 0.5, 2.0, lx, deckTop + 1.9, lz, 0, 6, 6, S + 40 + i, W1, DS);
      addCyl(A, 0.18, 0.30, 4.4, lx, deckTop + 4.3, lz, 8, 5, S + 45 + i, W1, DS);
      addBox(A, 1.0, 1.2, 1.0, lx, deckTop + 7.0, lz, 0, 3, 3, S + 50 + i, W1, DS);
      addCyl(A, 0.05, 0.62, 0.5, lx, deckTop + 7.85, lz, 8, 5, S + 55 + i, W1, DS);
    }
  }
}

// ---------------------------------------------------------------------------
// module
// ---------------------------------------------------------------------------
export function createCity(ctx) {
  const rng = ctx.rng;
  const group = new THREE.Group();
  group.name = 'city';
  const U = makeUniforms();
  const M = makeMaterials(U);

  const L = { box: [], cyl: [], mans: [], dormer: [], chim: [], tank: [], dome: [] };
  buildBlocks(rng, L);

  const meshes = [];
  const addInst = (g, l, mat, name) => {
    if (!l.length) return;
    const m = inst(g, mat, l, name);
    group.add(m);
    meshes.push(m);
  };
  // landmarks on the great axis
  const lmSeed = rng.range(0, 400);
  const A = acc();
  buildEcole(A, lmSeed);
  const ecole = buildAcc(A, 'city.ecoleMilitaire', M.lm);
  const B = acc();
  buildChaillot(B, lmSeed + 900);
  const chaillot = buildAcc(B, 'city.palaisChaillot', M.lm);
  const C = acc();
  buildPont(C, lmSeed + 1700);
  const pont = buildAcc(C, 'city.pontIena', M.lm);
  for (const m of [ecole, chaillot, pont]) { group.add(m); meshes.push(m); }

  addInst(boxUnit(), L.box, M.facade, 'city.blocks');
  addInst(cylUnit(), L.cyl, M.facade, 'city.rotundas');
  addInst(mansardUnit(), L.mans, M.prop, 'city.mansards');
  addInst(dormerUnit(), L.dormer, M.prop, 'city.dormers');
  addInst(chimneyUnit(), L.chim, M.prop, 'city.chimneys');
  addInst(tankUnit(), L.tank, M.prop, 'city.tanks');
  addInst(domeUnit(), L.dome, M.prop, 'city.domes');

  let tris = 0;
  for (const m of meshes) {
    const g = m.geometry;
    const n = g.index ? g.index.count / 3 : g.getAttribute('position').count / 3;
    tris += n * (m.isInstancedMesh ? m.count : 1);
  }
  const stats = { drawCalls: meshes.length, triangles: tris, runs: L.box.length };

  // --- per-frame (no allocation) -------------------------------------------
  const LAMP_WARM = new THREE.Color(0xffb257);
  const LAMP_COOL = new THREE.Color(0xfff0d8);

  function update(tod, time, camera, fog) {
    const p = tod.pal;
    U.uSunDir.value.copy(tod.sunDir);
    U.uMoonDir.value.copy(tod.moonDir);
    U.uSunColor.value.copy(p.sun);
    U.uSunI.value = p.sunI;
    U.uMoonI.value = p.moon;
    U.uAmb.value.copy(p.amb);
    U.uAmbI.value = p.ambI;
    U.uZenith.value.copy(p.zenith);
    U.uHorizon.value.copy(p.horizon);
    U.uGround.value.copy(p.ground);
    U.uFog.value.copy(fog);
    U.uWindowLit.value = tod.windowLit;
    U.uTime.value = time;
    U.uLamp.value.copy(LAMP_WARM).lerp(LAMP_COOL, clamp(1 - tod.windowLit, 0, 1) * 0.55);
  }

  return { group, update, stats };
}
