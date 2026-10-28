// ============================================================
// environment.js - product-photography studio, HDR environment, floor
// ============================================================
import * as THREE from 'three';
import { makeContactShadowTexture, makeRadialGlowTexture } from './lib.js';

function studioEnvironment(renderer) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x030405);
  const room = new THREE.Mesh(
    new THREE.BoxGeometry(70, 46, 70),
    new THREE.MeshBasicMaterial({ color: 0x07080a, side: THREE.BackSide }),
  );
  scene.add(room);

  const softbox = (w, h, pos, rot, color, intensity, opacity = 1) => {
    const c = new THREE.Color(color).multiplyScalar(intensity);
    const mat = new THREE.MeshBasicMaterial({
      color: c,
      side: THREE.DoubleSide,
      transparent: opacity < 1,
      opacity,
      toneMapped: false,
    });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    m.position.set(...pos);
    m.rotation.set(...rot);
    scene.add(m);
    return m;
  };

  // Large key softbox above and to the left, a cool strip on the right,
  // warm kicker behind, and a gentle front fill. These reflections do most
  // of the work on the glossy white shell.
  softbox(24, 16, [-18, 17, 16], [0.0, -0.55, 0.06], 0xfff4e6, 3.5);
  softbox(12, 22, [20, 7, 8], [0.05, 0.9, 0.0], 0xf7f8fa, 1.2);
  softbox(30, 8, [0, 12, -24], [0.1, 0, 0], 0xdfe7ea, 0.7);
  softbox(22, 13, [2, 0, 26], [0.0, 0.05, 0], 0xffffff, 0.55);
  softbox(8, 18, [-22, -2, -8], [0, 1.2, 0.2], 0xe8eef2, 0.6);
  softbox(18, 6, [0, -8, -8], [0, 0, 0], 0x203040, 1.0);

  // A dark gradient floor inside the environment so the underside gets
  // believable bounce rather than black.
  const envFloor = new THREE.Mesh(
    new THREE.CircleGeometry(26, 64),
    new THREE.MeshBasicMaterial({ color: 0x0a0c10, side: THREE.DoubleSide }),
  );
  envFloor.rotation.x = -Math.PI / 2;
  envFloor.position.y = -8;
  scene.add(envFloor);

  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();
  const target = pmrem.fromScene(scene, 0.035, 0.1, 80);
  pmrem.dispose();
  scene.traverse((o) => {
    if (o.isMesh) {
      o.geometry.dispose();
      o.material.dispose();
    }
  });
  return target.texture;
}

function buildBackdrop() {
  const geo = new THREE.SphereGeometry(70, 48, 24);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      topColor: { value: new THREE.Color(0x11151b) },
      midColor: { value: new THREE.Color(0x07090d) },
      bottomColor: { value: new THREE.Color(0x020203) },
      glowColor: { value: new THREE.Color(0x0b2028) },
    },
    vertexShader: /* glsl */ `
      varying vec3 vWorld;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorld = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vWorld;
      uniform vec3 topColor;
      uniform vec3 midColor;
      uniform vec3 bottomColor;
      uniform vec3 glowColor;
      void main() {
        float h = clamp((vWorld.y + 24.0) / 54.0, 0.0, 1.0);
        vec3 col = mix(bottomColor, midColor, smoothstep(0.0, 0.55, h));
        col = mix(col, topColor, smoothstep(0.45, 1.0, h));
        float r = length(vWorld.xz);
        float halo = exp(-pow((vWorld.y - 1.0) / 16.0, 2.0)) * exp(-pow(r / 28.0, 2.0));
        col += glowColor * halo * 0.20;
        float cyan = exp(-pow((vWorld.x + 20.0) / 18.0, 2.0)) * exp(-pow((vWorld.y - 10.0) / 22.0, 2.0));
        col += vec3(0.018, 0.052, 0.07) * cyan;
        gl_FragColor = vec4(col, 1.0);
      }
    `,
    toneMapped: false,
  });
  const sphere = new THREE.Mesh(geo, mat);
  sphere.name = 'studio-backdrop';
  sphere.frustumCulled = false;
  return sphere;
}

export function createStudio(renderer, scene) {
  const envMap = studioEnvironment(renderer);
  scene.environment = envMap;

  const backdrop = buildBackdrop();
  scene.add(backdrop);

  const hemisphere = new THREE.HemisphereLight(0xc5d8e8, 0x090a0c, 0.28);
  scene.add(hemisphere);

  const key = new THREE.DirectionalLight(0xfff6ee, 2.35);
  key.position.set(11, 17, 13);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = -14;
  key.shadow.camera.right = 14;
  key.shadow.camera.top = 14;
  key.shadow.camera.bottom = -14;
  key.shadow.camera.near = 2;
  key.shadow.camera.far = 55;
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.018;
  key.shadow.radius = 4;
  scene.add(key);

  const fill = new THREE.DirectionalLight(0xe8eef2, 0.45);
  fill.position.set(-14, 7, 9);
  scene.add(fill);

  const rim = new THREE.DirectionalLight(0xdbe7ee, 0.28);
  rim.position.set(-5, 9, -16);
  scene.add(rim);

  const top = new THREE.DirectionalLight(0xffffff, 0.35);
  top.position.set(0, 18, -2);
  scene.add(top);

  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(30, 128),
    new THREE.MeshPhysicalMaterial({
      color: 0x0a0a0b,
      roughness: 0.78,
      metalness: 0.0,
      envMapIntensity: 0.06,
      clearcoat: 0.35,
      clearcoatRoughness: 0.28,
      transparent: true,
      opacity: 0.98,
    }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -6.34;
  floor.receiveShadow = true;
  floor.name = 'studio-floor';
  scene.add(floor);

  const floorRing = new THREE.Mesh(
    new THREE.RingGeometry(10.4, 10.48, 160),
    new THREE.MeshBasicMaterial({
      color: 0x1d6677,
      transparent: true,
      opacity: 0.04,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: false,
    }),
  );
  floorRing.rotation.x = -Math.PI / 2;
  floorRing.position.y = -6.335;
  scene.add(floorRing);

  const contactTex = makeContactShadowTexture(512);
  const contact = new THREE.Mesh(
    new THREE.PlaneGeometry(15, 9.5),
    new THREE.MeshBasicMaterial({
      map: contactTex,
      transparent: true,
      opacity: 0.62,
      depthWrite: false,
      toneMapped: false,
    }),
  );
  contact.rotation.x = -Math.PI / 2;
  contact.position.set(0, -6.332, 0.4);
  contact.renderOrder = 1;
  scene.add(contact);

  const halo = new THREE.Mesh(
    new THREE.PlaneGeometry(36, 28),
    new THREE.MeshBasicMaterial({
      map: makeRadialGlowTexture(512, [
        [0, 'rgba(14,36,44,0.07)'],
        [0.3, 'rgba(6,20,26,0.035)'],
        [0.7, 'rgba(2,7,10,0.01)'],
        [1, 'rgba(0,0,0,0)'],
      ]),
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    }),
  );
  halo.position.set(0, 1.2, -22);
  halo.renderOrder = 0;
  scene.add(halo);

  return { envMap, key, fill, rim, floor, contact, backdrop };
}