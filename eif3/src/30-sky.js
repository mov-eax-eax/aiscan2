/* 30-sky.js — gradient sky, stars and the sun/moon/fill rig.
   Registers its own day/night behaviour with registerEnv. */
function buildSky(scene) {
/* ------------------------------------------------------------------ */
/*  sky, stars                                                        */
/* ------------------------------------------------------------------ */
const skyMat = new THREE.ShaderMaterial({
  side: THREE.BackSide,
  depthWrite: false,
  fog: false,
  uniforms: {
    uTop: { value: new THREE.Color(0x3f6fb8) },
    uBot: { value: new THREE.Color(0xf4d3a6) },
  },
  vertexShader: /* glsl */`
    varying vec3 vDir;
    void main() {
      vec4 wp = modelMatrix * vec4(position, 1.0);
      vDir = wp.xyz - cameraPosition;
      gl_Position = projectionMatrix * viewMatrix * wp;
    }
  `,
  fragmentShader: /* glsl */`
    uniform vec3 uTop;
    uniform vec3 uBot;
    varying vec3 vDir;
    void main() {
      float h = normalize(vDir).y;
      float t = smoothstep(-0.02, 0.34, h);
      vec3 c = mix(uBot, uTop, pow(t, 0.9));
      gl_FragColor = vec4(c, 1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }
  `,
});
const sky = new THREE.Mesh(new THREE.SphereGeometry(5000, 32, 20), skyMat);
scene.add(sky);

const starGeo = new THREE.BufferGeometry();
{
  const count = 2200;
  const pos = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const a = Math.random() * TAU;
    const y = 0.04 + Math.random() * 0.96;
    const r = Math.sqrt(1 - y * y);
    pos[i * 3 + 0] = Math.cos(a) * r * 4400;
    pos[i * 3 + 1] = y * 4400;
    pos[i * 3 + 2] = Math.sin(a) * r * 4400;
  }
  starGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
}
const starMat = new THREE.PointsMaterial({
  color: 0xdfe8ff, size: 1.7, sizeAttenuation: false,
  transparent: true, opacity: 0, depthWrite: false, fog: false,
});
const stars = new THREE.Points(starGeo, starMat);
stars.frustumCulled = false;
scene.add(stars);

/* ------------------------------------------------------------------ */
/*  lights                                                            */
/* ------------------------------------------------------------------ */
const hemi = new THREE.HemisphereLight(0xc9dcff, 0x6b5942, 1.05);
scene.add(hemi);

const sun = new THREE.DirectionalLight(0xfff0d8, 2.8);
sun.position.set(330, 300, 220);
sun.target.position.set(0, 120, 0);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -320;
sun.shadow.camera.right = 320;
sun.shadow.camera.top = 300;
sun.shadow.camera.bottom = -300;
sun.shadow.camera.near = 60;
sun.shadow.camera.far = 1600;
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.7;
scene.add(sun);
scene.add(sun.target);

const moon = new THREE.DirectionalLight(0x9ab4ff, 0);
moon.position.set(-420, 260, -300);
moon.target.position.set(0, 120, 0);
scene.add(moon);
scene.add(moon.target);

const fill = new THREE.DirectionalLight(0xbfd4ff, 0.5);
fill.position.set(-300, 160, 260);
fill.target.position.set(0, 120, 0);
scene.add(fill);
scene.add(fill.target);

  registerEnv((t) => {
    sun.intensity = mix(2.8, 0.04, t);
    moon.intensity = mix(0, 0.6, t);
    fill.intensity = mix(0.5, 0.12, t);
    hemi.intensity = mix(1.05, 0.42, t);
    hemi.color.copy(PALETTE.hemiSkyDay).lerp(PALETTE.hemiSkyNight, t);
    hemi.groundColor.copy(PALETTE.hemiGroundDay).lerp(PALETTE.hemiGroundNight, t);
    skyMat.uniforms.uTop.value.copy(PALETTE.skyTopDay).lerp(PALETTE.skyTopNight, t);
    skyMat.uniforms.uBot.value.copy(PALETTE.skyBotDay).lerp(PALETTE.skyBotNight, t);
    starMat.opacity = t * 0.95;
  });
}
