import * as THREE from 'three';
import common from './glsl/common.glsl';

/* ---------------------------------------------------------------------------
 * Hand-written post chain (no addons):
 *   scene(HDR) -> bright pass -> 2 blurred levels -> composite
 *   (chromatic aberration, bloom, exposure, ACES, vignette, grain) -> FXAA
 * ------------------------------------------------------------------------- */

const QUAD_VERT = `
varying vec2 vUv;
void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

class FullScreenPass {
  constructor(fragmentShader, uniforms) {
    this.material = new THREE.ShaderMaterial({
      uniforms, vertexShader: QUAD_VERT, fragmentShader,
      depthTest: false, depthWrite: false,
    });
    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material);
    this.mesh.frustumCulled = false;
    this.scene.add(this.mesh);
  }
  get uniforms() { return this.material.uniforms; }
  render(renderer, target, viewport) {
    renderer.setRenderTarget(target || null);
    if (viewport) renderer.setViewport(viewport[0], viewport[1], viewport[2], viewport[3]);
    renderer.render(this.scene, this.camera);
  }
}

export class PostChain {
  constructor(renderer, scene, camera) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.scale = 1.0;          // scene render scale (supersampling knob)
    this.enabled = true;
    this.bloomStrength = 0.62;
    this.exposure = 1.0;

    const rtOpts = {
      type: THREE.HalfFloatType,
      minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter,
      depthBuffer: true, stencilBuffer: false,
    };
    this.rtScene = new THREE.WebGLRenderTarget(2, 2, rtOpts);
    this.rtBright = new THREE.WebGLRenderTarget(2, 2, { ...rtOpts, depthBuffer: false });
    this.rtBlurA = new THREE.WebGLRenderTarget(2, 2, { ...rtOpts, depthBuffer: false });
    this.rtBlurB = new THREE.WebGLRenderTarget(2, 2, { ...rtOpts, depthBuffer: false });
    this.rtLdr = new THREE.WebGLRenderTarget(2, 2, {
      type: THREE.UnsignedByteType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter,
      depthBuffer: false, stencilBuffer: false,
    });

    const blurUniforms = () => ({
      tDiffuse: { value: null },
      uDirection: { value: new THREE.Vector2(1, 0) },
      uTexel: { value: new THREE.Vector2(1 / 512, 1 / 512) },
    });

    this.bright = new FullScreenPass(`
      varying vec2 vUv;
      uniform sampler2D tDiffuse;
      uniform float uThreshold, uKnee;
      void main(){
        vec3 c = texture2D(tDiffuse, vUv).rgb;
        float l = max(max(c.r, c.g), c.b);
        float soft = clamp(l - uThreshold + uKnee, 0.0, 2.0 * uKnee);
        soft = soft * soft / (4.0 * uKnee + 1e-4);
        float w = max(soft, l - uThreshold) / max(l, 1e-4);
        gl_FragColor = vec4(c * w, 1.0);
      }`, { tDiffuse: { value: null }, uThreshold: { value: 1.05 }, uKnee: { value: 0.55 } });

    const BLUR_FRAG = `
      varying vec2 vUv;
      uniform sampler2D tDiffuse;
      uniform vec2 uDirection;
      uniform vec2 uTexel;
      void main(){
        vec2 o = uDirection * uTexel;
        vec3 c = texture2D(tDiffuse, vUv).rgb * 0.2270270270;
        c += texture2D(tDiffuse, vUv + o * 1.3846153846).rgb * 0.3162162162;
        c += texture2D(tDiffuse, vUv - o * 1.3846153846).rgb * 0.3162162162;
        c += texture2D(tDiffuse, vUv + o * 3.2307692308).rgb * 0.0702702703;
        c += texture2D(tDiffuse, vUv - o * 3.2307692308).rgb * 0.0702702703;
        gl_FragColor = vec4(c, 1.0);
      }`;
    this.blurA = new FullScreenPass(BLUR_FRAG, blurUniforms());
    this.blurB = new FullScreenPass(BLUR_FRAG, blurUniforms());

    this.composite = new FullScreenPass(`
      varying vec2 vUv;
      uniform sampler2D tScene, tBloom1, tBloom2;
      uniform float uExposure, uBloom, uVignette, uGrain, uAberration, uTime, uFade, uSaturation, uContrast;
      ${common}
      void main(){
        vec2 uv = vUv;
        vec2 d = uv - 0.5;
        float r2 = dot(d, d);
        // lateral chromatic aberration, strongest at the frame edge
        float ca = uAberration * r2;
        vec3 col;
        col.r = texture2D(tScene, uv - d * ca).r;
        col.g = texture2D(tScene, uv).g;
        col.b = texture2D(tScene, uv + d * ca).b;

        vec3 b1 = texture2D(tBloom1, uv).rgb;
        vec3 b2 = texture2D(tBloom2, uv).rgb;
        col += uBloom * (b1 * 0.55 + b2 * 0.95);

        col *= uExposure;
        col = acesFilm(col * 0.92);
        col = pow(col, vec3(1.0 / 2.2));

        float l = luma(col);
        col = mix(vec3(l), col, uSaturation);
        col = (col - 0.5) * uContrast + 0.5;

        col *= vec3(1.035, 1.002, 0.962);   // gentle warm grade\n        col *= mix(1.0, smoothstep(1.25, 0.25, r2 * 1.35), uVignette);
        float g = hash12(uv * 1024.0 + fract(uTime) * 137.0) - 0.5;
        col += g * uGrain;
        col *= uFade;
        gl_FragColor = vec4(max(col, 0.0), 1.0);
      }`, {
      tScene: { value: null }, tBloom1: { value: null }, tBloom2: { value: null },
      uExposure: { value: 1 }, uBloom: { value: 0.62 }, uVignette: { value: 0.85 },
      uGrain: { value: 0.028 }, uAberration: { value: 0.0022 }, uTime: { value: 0 },
      uFade: { value: 1 }, uSaturation: { value: 1.06 }, uContrast: { value: 1.045 },
    });

    this.fxaa = new FullScreenPass(`
      varying vec2 vUv;
      uniform sampler2D tDiffuse;
      uniform vec2 uTexel;
      void main(){
        vec3 rgbNW = texture2D(tDiffuse, vUv + vec2(-1.0, -1.0) * uTexel).rgb;
        vec3 rgbNE = texture2D(tDiffuse, vUv + vec2( 1.0, -1.0) * uTexel).rgb;
        vec3 rgbSW = texture2D(tDiffuse, vUv + vec2(-1.0,  1.0) * uTexel).rgb;
        vec3 rgbSE = texture2D(tDiffuse, vUv + vec2( 1.0,  1.0) * uTexel).rgb;
        vec3 rgbM  = texture2D(tDiffuse, vUv).rgb;
        vec3 lw = vec3(0.299, 0.587, 0.114);
        float lNW = dot(rgbNW, lw), lNE = dot(rgbNE, lw), lSW = dot(rgbSW, lw), lSE = dot(rgbSE, lw), lM = dot(rgbM, lw);
        float lMin = min(lM, min(min(lNW, lNE), min(lSW, lSE)));
        float lMax = max(lM, max(max(lNW, lNE), max(lSW, lSE)));
        vec2 dir = vec2(-((lNW + lNE) - (lSW + lSE)), ((lNW + lSW) - (lNE + lSE)));
        float dirReduce = max((lNW + lNE + lSW + lSE) * 0.25 * 0.125, 1.0 / 128.0);
        float rcpDirMin = 1.0 / (min(abs(dir.x), abs(dir.y)) + dirReduce);
        dir = clamp(dir * rcpDirMin, vec2(-8.0), vec2(8.0)) * uTexel;
        vec3 rgbA = 0.5 * (texture2D(tDiffuse, vUv + dir * (1.0/3.0 - 0.5)).rgb +
                           texture2D(tDiffuse, vUv + dir * (2.0/3.0 - 0.5)).rgb);
        vec3 rgbB = rgbA * 0.5 + 0.25 * (texture2D(tDiffuse, vUv + dir * -0.5).rgb +
                                         texture2D(tDiffuse, vUv + dir *  0.5).rgb);
        float lB = dot(rgbB, lw);
        gl_FragColor = vec4((lB < lMin || lB > lMax) ? rgbA : rgbB, 1.0);
        // gate: skip FXAA on low-contrast areas to keep the image crisp
        if (lMax - lMin < 0.055) gl_FragColor = vec4(rgbM, 1.0);
      }`, { tDiffuse: { value: null }, uTexel: { value: new THREE.Vector2(1/512, 1/512) } });

    this.setSize(1, 1);
  }

  setSize(w, h) {
    const r = this.renderer;
    const sw = Math.max(2, Math.floor(w * this.scale));
    const sh = Math.max(2, Math.floor(h * this.scale));
    this.rtScene.setSize(sw, sh);
    const hw = Math.max(2, Math.floor(sw / 2)), hh = Math.max(2, Math.floor(sh / 2));
    this.rtBright.setSize(hw, hh);
    this.rtBlurA.setSize(hw, hh);
    this.rtBlurB.setSize(hw, hh);
    this.rtLdr.setSize(sw, sh);
    this.blurA.uniforms.uTexel.value.set(1 / hw, 1 / hh);
    this.blurB.uniforms.uTexel.value.set(1 / hw, 1 / hh);
    this.fxaa.uniforms.uTexel.value.set(1 / sw, 1 / sh);
    void r;
  }

  setQuality(scale) { this.scale = scale; }

  render(time, viewport) {
    const r = this.renderer;
    if (!this.enabled) { r.setRenderTarget(null); r.render(this.scene, this.camera); return; }
    const vp = viewport || null;
    r.setRenderTarget(this.rtScene);
    r.clear();
    r.render(this.scene, this.camera);

    this.bright.uniforms.tDiffuse.value = this.rtScene.texture;
    this.bright.render(r, this.rtBright);

    const blurPass = (src, dst, dx, dy) => {
      this.blurA.uniforms.tDiffuse.value = src.texture;
      this.blurA.uniforms.uDirection.value.set(dx, dy);
      this.blurA.render(r, dst);
    };
    blurPass(this.rtBright, this.rtBlurA, 1, 0);
    this.blurA.uniforms.tDiffuse.value = this.rtBlurA.texture;
    this.blurA.uniforms.uDirection.value.set(0, 1);
    this.blurA.render(r, this.rtBlurB);
    // second, wider level (the source is already blurred, so two more taps widen it)
    blurPass(this.rtBlurB, this.rtBlurA, 2.6, 0);
    this.blurA.uniforms.tDiffuse.value = this.rtBlurA.texture;
    this.blurA.uniforms.uDirection.value.set(0, 2.6);
    this.blurA.render(r, this.rtBlurB);

    this.composite.uniforms.tScene.value = this.rtScene.texture;
    this.composite.uniforms.tBloom1.value = this.rtBlurB.texture;
    this.composite.uniforms.tBloom2.value = this.rtBright.texture;
    this.composite.uniforms.uTime.value = time;
    this.composite.uniforms.uExposure.value = this.exposure;
    this.composite.uniforms.uBloom.value = this.bloomStrength;
    this.composite.render(r, this.rtLdr);

    this.fxaa.uniforms.tDiffuse.value = this.rtLdr.texture;
    this.fxaa.render(r, null, vp);
  }
}
