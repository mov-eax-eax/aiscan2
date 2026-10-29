import * as THREE from 'three';

export function createWorld(container) {
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x17222b, 0.0024);

  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 1200);
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.42;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate = false;
  renderer.domElement.id = 'xenosphere-canvas';
  container.appendChild(renderer.domElement);

  const hemi = new THREE.HemisphereLight(0x9aafbc, 0x4a3a2c, 1.45);
  scene.add(hemi);
  const ambient = new THREE.AmbientLight(0x55605d, 0.42);
  scene.add(ambient);
  const sun = new THREE.DirectionalLight(0xffb076, 2.6);
  sun.position.set(-68, 56, 34);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -78;
  sun.shadow.camera.right = 78;
  sun.shadow.camera.top = 78;
  sun.shadow.camera.bottom = -78;
  sun.shadow.camera.near = 20;
  sun.shadow.camera.far = 260;
  sun.shadow.bias = -0.0004;
  scene.add(sun);
  const rim = new THREE.DirectionalLight(0x8faec2, 1.3);
  rim.position.set(52, 26, -62);
  const bounce = new THREE.DirectionalLight(0xc69268, 0.45);
  bounce.position.set(26, 10, 78);
  scene.add(bounce);
  const warmFill = new THREE.PointLight(0xffa06a, 1400, 170, 2);
  warmFill.position.set(26, 32, 42);
  scene.add(warmFill);
  const coolFill = new THREE.PointLight(0x7fa6bd, 1050, 165, 2);
  coolFill.position.set(-42, 20, -24);
  scene.add(coolFill);
  scene.add(rim);

  const state = {
    theta: 0.86,
    phi: 0.32,
    radius: 125,
    targetY: 25,
    auto: true,
    dragging: false,
    lastX: 0,
    lastY: 0,
    autoSpeed: 0.026,
  };

  function placeCamera() {
    const x = Math.sin(state.theta) * Math.cos(state.phi) * state.radius;
    const y = state.targetY + Math.sin(state.phi) * state.radius;
    const z = Math.cos(state.theta) * Math.cos(state.phi) * state.radius;
    camera.position.set(x, y, z);
    camera.lookAt(0, state.targetY, 0);
  }
  placeCamera();

  const canvas = renderer.domElement;
  canvas.addEventListener('pointerdown', (event) => {
    state.dragging = true;
    state.lastX = event.clientX;
    state.lastY = event.clientY;
    canvas.setPointerCapture(event.pointerId);
    canvas.classList.add('dragging');
  });
  canvas.addEventListener('pointermove', (event) => {
    if (!state.dragging) return;
    state.theta -= (event.clientX - state.lastX) * 0.006;
    state.phi = Math.max(-0.04, Math.min(1.24, state.phi + (event.clientY - state.lastY) * 0.004));
    state.lastX = event.clientX;
    state.lastY = event.clientY;
    placeCamera();
  });
  const release = (event) => {
    state.dragging = false;
    canvas.classList.remove('dragging');
    if (event.pointerId !== undefined && canvas.hasPointerCapture(event.pointerId)) {
      canvas.releasePointerCapture(event.pointerId);
    }
  };
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);
  canvas.addEventListener('wheel', (event) => {
    event.preventDefault();
    state.radius = Math.max(48, Math.min(190, state.radius * (1 + event.deltaY * 0.0008)));
    placeCamera();
  }, { passive: false });

  function resize() {
    const width = container.clientWidth;
    const height = container.clientHeight;
    renderer.setSize(width, height, false);
    camera.aspect = width / Math.max(1, height);
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);
  resize();

  const updates = [];
  const clock = new THREE.Clock();
  let time = 0;

  function frame() {
    const dt = Math.min(0.05, clock.getDelta());
    time += dt;
    if (state.auto && !state.dragging) {
      state.theta += dt * state.autoSpeed;
      placeCamera();
    }
    for (const update of updates) update(dt, time);
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  return {
    scene,
    camera,
    renderer,
    sun,
    state,
    addUpdate(fn) { updates.push(fn); },
    setAutoOrbit(value) { state.auto = value; },
    getAutoOrbit() { return state.auto; },
    resetView() {
      state.theta = 0.86;
      state.phi = 0.32;
      state.radius = 125;
      placeCamera();
    },
    setView({ theta, phi, radius, targetY } = {}) {
      if (theta !== undefined) state.theta = theta;
      if (phi !== undefined) state.phi = phi;
      if (radius !== undefined) state.radius = radius;
      if (targetY !== undefined) state.targetY = targetY;
      placeCamera();
    },
    resize,
  };
}
