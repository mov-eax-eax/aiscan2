import * as THREE from 'three';

export function createSky(scene) {
  const group = new THREE.Group();
  group.name = 'sky';
  scene.add(group);

  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      top: { value: new THREE.Color(0x03020c) },
      mid: { value: new THREE.Color(0x17103a) },
      horizon: { value: new THREE.Color(0x4e2351) },
      bottom: { value: new THREE.Color(0x050b17) },
    },
    vertexShader: 'varying vec3 vPos; void main(){ vPos = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `
      varying vec3 vPos;
      uniform vec3 top; uniform vec3 mid; uniform vec3 horizon; uniform vec3 bottom;
      void main(){
        vec3 p = normalize(vPos);
        float h = p.y;
        vec3 color = mix(bottom, horizon, smoothstep(-0.32, 0.06, h));
        color = mix(color, mid, smoothstep(0.02, 0.34, h));
        color = mix(color, top, smoothstep(0.34, 0.92, h));
        float horizonGlow = exp(-abs(h - 0.055) * 24.0);
        color += vec3(0.12, 0.025, 0.1) * horizonGlow;
        float wisp = sin(p.x * 2.1 + p.z * 1.3) * sin(p.x * 0.8 - p.z * 2.6);
        color += vec3(0.03, 0.008, 0.05) * smoothstep(0.05, 0.55, h) * (1.0 - smoothstep(0.55, 0.95, h)) * (0.5 + wisp * 0.5);
        gl_FragColor = vec4(color, 1.0);
      }
    `,
  });
  // The gradient is the stage's CSS backdrop; the WebGL sky is transparent.

  const rng = (() => { let a = 8117; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; })();

  const starCount = 1000;
  const positions = new Float32Array(starCount * 3);
  const colors = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i++) {
    const a = rng() * Math.PI * 2;
    const r = 230 + rng() * 250;
    const y = -20 + rng() * 300;
    positions[i * 3] = Math.sin(a) * r;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = Math.cos(a) * r;
    const c = new THREE.Color().setHSL(0.55 + rng() * 0.18, 0.35 + rng() * 0.4, 0.55 + rng() * 0.4);
    colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  starGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ size: 1.9, vertexColors: true, transparent: true, opacity: 1, sizeAttenuation: true, depthWrite: false }));
  group.add(stars);

  const planetMat = new THREE.MeshStandardMaterial({ color: 0x826bc8, emissive: 0x1b1138, emissiveIntensity: 1.1, roughness: 0.92, flatShading: true });
  const planet = new THREE.Mesh(new THREE.IcosahedronGeometry(22, 4), planetMat);
  planet.position.set(-122, 96, -252);
  group.add(planet);
  const planetRing = new THREE.Mesh(
    new THREE.TorusGeometry(37, 1.2, 4, 96),
    new THREE.MeshBasicMaterial({ color: 0xffa7e6, transparent: true, opacity: 0.36, blending: THREE.AdditiveBlending, depthWrite: false })
  );
  planetRing.position.copy(planet.position);
  planetRing.rotation.set(1.1, 0.34, 0.08);
  group.add(planetRing);

  const moon = new THREE.Mesh(
    new THREE.IcosahedronGeometry(7, 3),
    new THREE.MeshStandardMaterial({ color: 0xbdf9ff, emissive: 0x176d70, emissiveIntensity: 1.6, roughness: 0.7, flatShading: true })
  );
  moon.position.set(190, 150, -230);
  group.add(moon);

  const auroraMat = new THREE.ShaderMaterial({
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { time: { value: 0 } },
    vertexShader: 'varying vec2 vUv; uniform float time; void main(){ vUv = uv; vec3 p = position; p.y += sin(p.x * 0.055 + time * 0.2) * 3.5; gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0); }',
    fragmentShader: `
      varying vec2 vUv; uniform float time;
      void main(){
        float ripple = sin(vUv.x * 13.0 + time * 0.45) * 0.5 + 0.5;
        float edge = smoothstep(0.0, 0.24, vUv.y) * (1.0 - smoothstep(0.74, 1.0, vUv.y));
        edge *= smoothstep(0.0, 0.08, vUv.x) * (1.0 - smoothstep(0.92, 1.0, vUv.x));
        vec3 a = vec3(0.32, 1.0, 0.72);
        vec3 b = vec3(0.9, 0.3, 1.0);
        gl_FragColor = vec4(mix(a, b, ripple), edge * (0.06 + ripple * 0.1));
      }
    `,
  });
  const aurora = new THREE.Group();
  for (let i = 0; i < 4; i++) {
    const ribbon = new THREE.Mesh(new THREE.PlaneGeometry(300, 46, 100, 3), auroraMat);
    ribbon.position.set(-15 + i * 10, 96 + i * 9, -210 - i * 25);
    ribbon.rotation.x = -0.8 + i * 0.08;
    ribbon.rotation.z = -0.18 + i * 0.07;
    aurora.add(ribbon);
  }
  aurora.visible = false;
  group.add(aurora);

  const hazeMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { time: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'varying vec2 vUv; uniform float time; void main(){ float a = smoothstep(0.0,0.3,vUv.y)*smoothstep(1.0,0.55,vUv.y); float b = sin(vUv.x*6.0+time*0.04)*0.5+0.5; gl_FragColor = vec4(0.45,0.3,0.7, a*b*0.035); }',
  });
  return {
    group,
    update(dt, time) {
      auroraMat.uniforms.time.value = time;
      stars.rotation.y += dt * 0.0025;
      planetRing.rotation.z += dt * 0.004;
      moon.rotation.y += dt * 0.0015;
    },
  };
}
