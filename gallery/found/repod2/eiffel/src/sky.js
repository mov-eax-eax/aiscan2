import * as THREE from 'three';
import common from './glsl/common.glsl';

/* ---------------------------------------------------------------------------
 * Physically-flavoured sky dome: gradient + Mie forward scattering, sun with
 * limb darkening, phased moon, twinkling star field, two procedural cloud
 * decks lit by the sun, horizon haze. Everything is driven by the TimeOfDay
 * palette so the sky, fog and lights never disagree.
 * ------------------------------------------------------------------------- */

const VERT = `
varying vec3 vDir;
void main(){
  vDir = normalize(position);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const FRAG = `
precision highp float;
varying vec3 vDir;

uniform vec3 uZenith, uHorizon, uSunColor, uGroundColor, uCloudLit, uCloudDark, uAmbient;
uniform vec3 uSunDir, uMoonDir, uMoonRight, uMoonUp;
uniform float uSunI, uStarAlpha, uMoonAmt, uCloudCover, uTime, uCloudWind, uMoonPhase, uHaze;
uniform float uCirrus;

${common}

float sunSpot(vec3 d, vec3 dir, float cosR, float soft){
  float c = dot(d, dir);
  float a = acos(clamp(c, -1.0, 1.0));
  return smoothstep(cosR + soft, cosR - soft, a);
}

// --- cumulus deck ----------------------------------------------------------
// One flat-based layer of domain-warped fbm with a crisp coverage curve. The
// warp is what turns round blobs into ragged, wind-torn cumulus.
float cloudField(vec2 p, float cover, int oct){
  float warp = fbm2(p * 0.42 + 17.0, 2);
  float base = fbm2(p + warp * 0.45, 3);
  float det  = fbm2(p * 3.4 + base * 0.7, oct);
  float shape = base * 0.60 + det * 0.40;
  return smoothstep(cover, cover + 0.20, shape);
}

void main(){
  vec3 d = normalize(vDir);
  float up = clamp(d.y, -1.0, 1.0);

  // ---- base gradient -------------------------------------------------------
  float grad = pow(clamp(up * 0.5 + 0.5, 0.0, 1.0), 0.62);
  vec3 sky = mix(uHorizon, uZenith, smoothstep(0.02, 1.0, grad));
  // ground half of the dome (only visible if something is missing)
  sky = mix(uGroundColor, sky, smoothstep(-0.06, 0.015, up));

  // ---- sun -----------------------------------------------------------------
  float cosSun = dot(d, uSunDir);
  float sunUp = smoothstep(-0.14, 0.06, uSunDir.y);
  float disk = sunSpot(d, uSunDir, 0.999955, 0.00012);
  float limb = sqrt(max(0.0, 1.0 - pow(acos(clamp(cosSun,-1.0,1.0)) / 0.0047, 2.0)));
  vec3 sunCol = uSunColor * uSunI;
  sky += sunCol * disk * (0.35 + 0.65 * limb) * 22.0 * sunUp;
  // Mie halo + broad forward scatter (the warm wash around a low sun)
  float mu = max(cosSun, 0.0);
  float mie = pow(mu, 6.0) * 0.22 + pow(mu, 60.0) * 0.30 + pow(mu, 900.0) * 0.55;
  sky += sunCol * mie * (0.35 + 0.65 * sunUp) * 0.5;
  // horizon glow on the sun side
  float az = max(dot(normalize(vec3(d.x, 0.0, d.z) + 1e-5), normalize(vec3(uSunDir.x, 0.0, uSunDir.z) + 1e-5)), 0.0);
  float lowGlow = pow(az, 3.0) * exp(-abs(up) * 9.0);
  sky += uSunColor * lowGlow * (0.55 * (1.0 - sunUp) + 0.20) * (0.6 + 0.8 * uHaze);

  // ---- stars ---------------------------------------------------------------
  if (uStarAlpha > 0.001 && up > -0.02){
    vec3 sd = d * 260.0;
    vec3 cell = floor(sd);
    vec3 f = fract(sd) - 0.5;
    vec3 rnd = hash33(cell);
    float s = 0.0;
    if (rnd.x > 0.9725){
      vec3 off = (vec3(rnd.y, rnd.z, fract(rnd.x * 91.7)) - 0.5) * 0.62;
      float dist = length(f - off);
      float mag = pow(fract(rnd.z * 57.3), 7.0);
      float tw = 0.72 + 0.28 * sin(uTime * 2.3 + rnd.z * 61.0);
      s = (0.14 + mag * 2.6) * smoothstep(0.20, 0.0, dist) * tw;
    }
    vec3 tint = mix(vec3(0.72, 0.82, 1.0), vec3(1.0, 0.86, 0.70), fract(rnd.x * 13.7));
    // faint milky-way band
    float band = exp(-pow(dot(d, normalize(vec3(0.42, 0.30, -0.86))) * 3.1, 2.0));
    sky += tint * s * uStarAlpha * smoothstep(-0.02, 0.20, up) * 1.5;
    sky += vec3(0.32, 0.36, 0.52) * band * uStarAlpha * 0.05 * fbm(d * 9.0, 3);
  }

  // ---- moon ----------------------------------------------------------------
  if (uMoonAmt > 0.002 && uMoonDir.y > -0.1){
    float md = sunSpot(d, uMoonDir, 0.999965, 0.00030);
    vec2 lm = vec2(dot(d, uMoonRight), dot(d, uMoonUp));
    vec3 nrm = normalize(uMoonRight * lm.x + uMoonUp * lm.y + uMoonDir * sqrt(max(0.0, 1.0 - dot(lm, lm))));
    // illuminated fraction: the sun lights the hemisphere facing it
    float lit = smoothstep(-0.12, 0.22, dot(nrm, uSunDir));
    vec3 moonCol = vec3(1.0, 0.97, 0.90) * uMoonAmt;
    sky += moonCol * md * lit * 10.0;
    sky += moonCol * pow(max(dot(d, uMoonDir), 0.0), 220.0) * 0.30;
    sky += moonCol * pow(max(dot(d, uMoonDir), 0.0), 12.0) * 0.05;
  }

  // ---- clouds --------------------------------------------------------------
  // The deck is shaded by marching a short way towards the sun *inside the
  // cloud plane*: near-opaque cores go blue-grey, thin edges transmit and pick
  // up a silver lining. That contrast is what makes cloud read as cloud.
  if (d.y > 0.014){
    float cover = 1.0 - uCloudCover;
    vec2 p = d.xz * (1500.0 / d.y) * 0.00062 + vec2(uCloudWind * uTime * 0.16, uCloudWind * uTime * 0.07);
    float dens = cloudField(p, cover, 4);
    if (dens > 0.004){
      vec2 so = normalize(vec2(uSunDir.x, uSunDir.z) + 1e-4) * 0.062 / max(uSunDir.y, 0.18);
      float s1 = cloudField(p + so * 1.0, cover, 3);
      float s2 = cloudField(p + so * 2.6, cover, 3);
      float s3 = cloudField(p + so * 6.5, cover, 2);
      float shadow = s1 * 0.45 + s2 * 0.33 + s3 * 0.22;
      float trans = exp(-shadow * 3.6);              // Beer's law through the deck
      float powder = 1.0 - exp(-dens * 3.2);         // thick middles read darker
      vec3 col = mix(uCloudDark, uCloudLit, trans);
      col += uSunColor * pow(trans, 4.0) * 0.50 * sunUp;   // silver lining
      col *= mix(1.0, 0.58, powder);
      col += uZenith * 0.12 * (1.0 - trans);               // sky bounce in the shadows
      float horizonFade = smoothstep(0.014, 0.22, d.y);
      col = mix(uHorizon * 0.88, col, horizonFade);        // no white smear at the horizon
      col = min(col, vec3(1.22));
      sky = mix(sky, col, clamp(dens * 1.2, 0.0, 1.0) * mix(0.45, 1.0, horizonFade));
    }
  }

  // high cirrus veil, well above the cumulus
  if (uCirrus > 0.001 && d.y > 0.03){
    float t = 4200.0 / max(d.y, 0.03);
    vec2 p = d.xz * t * 0.00013 + vec2(uCloudWind * uTime * 0.16, uCloudWind * uTime * 0.06);
    float c = fbm2(p * vec2(1.0, 2.6) + fbm2(p * 0.4, 2) * 0.5, 4);
    float v = smoothstep(0.50, 0.86, c) * smoothstep(0.03, 0.28, d.y) * uCirrus;
    vec3 cc = mix(uCloudLit, uSunColor, 0.30) * (0.60 + 0.40 * sunUp);
    cc = min(cc, vec3(1.1));
    sky = mix(sky, cc, v * 0.45);
  }

  // ---- horizon haze --------------------------------------------------------
  vec3 hazeCol = mix(uHorizon, uSunColor, 0.25 * pow(az, 2.0));
  sky = mix(sky, hazeCol, (1.0 - smoothstep(0.0, 0.075, up)) * uHaze * smoothstep(-0.10, 0.0, up));

  gl_FragColor = vec4(max(sky, 0.0), 1.0);
}`;

export class Sky {
  constructor() {
    this.uniforms = {
      uZenith: { value: new THREE.Color(0x2664c4) },
      uHorizon: { value: new THREE.Color(0xbcd4e6) },
      uSunColor: { value: new THREE.Color(0xfff6e2) },
      uGroundColor: { value: new THREE.Color(0x3a3a34) },
      uCloudLit: { value: new THREE.Color(0xffffff) },
      uCloudDark: { value: new THREE.Color(0x8b98ab) },
      uAmbient: { value: new THREE.Color(0xa8c0d8) },
      uSunDir: { value: new THREE.Vector3(0, 1, 0) },
      uMoonDir: { value: new THREE.Vector3(0, 1, 0) },
      uMoonRight: { value: new THREE.Vector3(1, 0, 0) },
      uMoonUp: { value: new THREE.Vector3(0, 1, 0) },
      uSunI: { value: 1 }, uStarAlpha: { value: 0 }, uMoonAmt: { value: 0 },
      uCloudCover: { value: 0.60 }, uTime: { value: 0 }, uCloudWind: { value: 0.5 },
      uMoonPhase: { value: 0.5 }, uHaze: { value: 0.75 }, uCirrus: { value: 0.32 },
    };
    this.material = new THREE.ShaderMaterial({
      uniforms: this.uniforms, vertexShader: VERT, fragmentShader: FRAG,
      side: THREE.BackSide, depthWrite: false, depthTest: false, fog: false,
    });
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(9000, 64, 40), this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -1000;
    this.fogColor = new THREE.Color();
  }

  update(tod, camera, time) {
    const u = this.uniforms, p = tod.pal;
    u.uZenith.value.copy(p.zenith);
    u.uHorizon.value.copy(p.horizon);
    u.uSunColor.value.copy(p.sun);
    u.uGroundColor.value.copy(p.ground);
    u.uCloudLit.value.copy(p.cloud).multiplyScalar(0.90);
    u.uCloudDark.value.copy(p.cloud).multiplyScalar(0.26).lerp(p.amb, 0.22);
    u.uAmbient.value.copy(p.amb);
    u.uSunDir.value.copy(tod.sunDir);
    u.uMoonDir.value.copy(tod.moonDir);
    u.uSunI.value = p.sunI;
    u.uStarAlpha.value = tod.starAlpha;
    u.uMoonAmt.value = p.moon;
    u.uTime.value = time;
    u.uCloudWind.value = 0.55;
    // moon phase basis: pick a stable "up" so the crescent reads correctly
    const mn = tod.moonDir;
    const right = new THREE.Vector3().crossVectors(mn, new THREE.Vector3(0, 1, 0));
    if (right.lengthSq() < 1e-6) right.set(1, 0, 0);
    right.normalize();
    u.uMoonRight.value.copy(right);
    u.uMoonUp.value.crossVectors(right, mn).normalize();
    u.uHaze.value = 0.34 + 0.30 * (1 - Math.min(1, Math.abs(tod.sunElevation) / 30));
    u.uCloudCover.value = 0.66;
    this.mesh.position.copy(camera.position);
    // fog / aerial-perspective colour: horizon tinted by the sun side
    this.fogColor.copy(p.horizon).lerp(p.zenith, 0.26).lerp(p.sun, 0.08).multiplyScalar(tod.isNight ? 0.38 : 0.70);
    return this;
  }
}
