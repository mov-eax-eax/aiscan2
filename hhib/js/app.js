/* ============================================================================
   Scene, lighting, environment and UI for the BOEING 747-400 showcase.
   ==========================================================================*/
(function () {
  'use strict';
  var T = window.THREE;
  var GROUND = -6.8;
  var params = new URLSearchParams(location.search);

  function fail(msg) {
    var el = document.getElementById('err');
    el.style.display = 'block';
    el.textContent = 'ERROR: ' + msg;
    document.title = 'ERROR - ' + msg;
  }
  window.addEventListener('error', function (e) {
    fail((e.message || 'error') + '  @ ' + ((e.filename || '').split('/').pop()) + ':' + (e.lineno || '?'));
  });
  window.addEventListener('unhandledrejection', function (e) {
    fail('promise: ' + ((e.reason && e.reason.message) || e.reason));
  });

  if (!window.THREE) { fail('Three.js failed to load (lib/three.min.js)'); return; }
  if (!window.THREE.OrbitControls) { fail('OrbitControls failed to load (lib/OrbitControls.js)'); return; }

  /* ------------------------------------------------------------- renderer */
  var canvas = document.getElementById('scene');
  var renderer = new T.WebGLRenderer({ canvas: canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputEncoding = T.sRGBEncoding;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFSoftShadowMap;
  renderer.physicallyCorrectLights = false;

  var scene = new T.Scene();
  scene.fog = new T.Fog(col(0xc9dced), 240, 900);

  function col(hex) { return new T.Color(hex).convertSRGBToLinear(); }

  var camera = new T.PerspectiveCamera(34, window.innerWidth / window.innerHeight, 0.5, 4000);
  var controls = new T.OrbitControls(camera, canvas);
  controls.target.set(0, -0.6, 0);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.minDistance = 26;
  controls.maxDistance = 340;
  controls.maxPolarAngle = Math.PI * 0.497;
  controls.autoRotateSpeed = 0.38;
  controls.enablePan = true;
  controls.panSpeed = 0.6;

  /* ------------------------------------------------------------- lights */
  var hemi = new T.HemisphereLight(col(0xcfe6ff), col(0x4b4a44), 0.65);
  scene.add(hemi);

  var sun = new T.DirectionalLight(col(0xfff0d8), 2.9);
  sun.position.set(95, 120, 72);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -80;
  sun.shadow.camera.right = 80;
  sun.shadow.camera.top = 80;
  sun.shadow.camera.bottom = -80;
  sun.shadow.camera.near = 20;
  sun.shadow.camera.far = 420;
  sun.shadow.bias = -0.00035;
  sun.shadow.normalBias = 0.035;
  scene.add(sun);
  scene.add(sun.target);

  var rim = new T.DirectionalLight(col(0x9fc4ff), 1.15);
  rim.position.set(-90, 46, -85);
  scene.add(rim);

  var fill = new T.DirectionalLight(col(0xffffff), 0.4);
  fill.position.set(-60, 24, 110);
  scene.add(fill);

  var bounce = new T.DirectionalLight(col(0xd8e4f0), 0.35);
  bounce.position.set(0, -40, 30);
  scene.add(bounce);

  /* --------------------------------------------------- environment probe */
  function skyCanvas() {
    var c = document.createElement('canvas');
    c.width = 1024; c.height = 512;
    var x = c.getContext('2d');
    var g = x.createLinearGradient(0, 0, 0, 512);
    g.addColorStop(0.00, '#153a66');
    g.addColorStop(0.30, '#3f7db4');
    g.addColorStop(0.47, '#8db9dc');
    g.addColorStop(0.52, '#dce9f2');
    g.addColorStop(0.58, '#9aa196');
    g.addColorStop(1.00, '#5a5c52');
    x.fillStyle = g; x.fillRect(0, 0, 1024, 512);
    var rg = x.createRadialGradient(690, 112, 8, 690, 112, 230);
    rg.addColorStop(0, 'rgba(255,250,235,1)');
    rg.addColorStop(0.45, 'rgba(255,240,210,0.55)');
    rg.addColorStop(1, 'rgba(255,240,210,0)');
    x.fillStyle = rg; x.fillRect(0, 0, 1024, 512);
    // a couple of soft cloud bands for reflection interest
    for (var i = 0; i < 14; i++) {
      var cx = Math.random() * 1024, cy = 150 + Math.random() * 160, rr = 40 + Math.random() * 110;
      var cg = x.createRadialGradient(cx, cy, 1, cx, cy, rr);
      cg.addColorStop(0, 'rgba(255,255,255,0.5)');
      cg.addColorStop(1, 'rgba(255,255,255,0)');
      x.fillStyle = cg;
      x.beginPath(); x.ellipse(cx, cy, rr * 1.7, rr * 0.55, 0, 0, Math.PI * 2); x.fill();
    }
    return c;
  }
  var eq = new T.CanvasTexture(skyCanvas());
  eq.mapping = T.EquirectangularReflectionMapping;
  eq.encoding = T.sRGBEncoding;
  var pmrem = new T.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();
  var envRT = pmrem.fromEquirectangular(eq);
  scene.environment = envRT.texture;

  /* ------------------------------------------------------------ skydome */
  var skyMat = new T.ShaderMaterial({
    side: T.BackSide,
    depthWrite: false,
    uniforms: {
      top: { value: col(0x123a68) },
      mid: { value: col(0x86b4d9) },
      bottom: { value: col(0xe4eef5) }
    },
    vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: [
      'uniform vec3 top; uniform vec3 mid; uniform vec3 bottom; varying vec3 vP;',
      'void main(){',
      '  float h = normalize(vP).y;',
      '  vec3 c = mix(bottom, mid, smoothstep(-0.02, 0.22, h));',
      '  c = mix(c, top, smoothstep(0.16, 0.85, h));',
      '  gl_FragColor = vec4(c, 1.0);',
      '}'
    ].join('\n')
  });
  var sky = new T.Mesh(new T.SphereGeometry(1800, 40, 24), skyMat);
  scene.add(sky);

  /* -------------------------------------------------------------- ground */
  function tarmacTexture() {
    var c = document.createElement('canvas');
    c.width = c.height = 1024;
    var x = c.getContext('2d');
    x.fillStyle = '#54595f'; x.fillRect(0, 0, 1024, 1024);
    for (var i = 0; i < 26000; i++) {
      var v = 40 + Math.random() * 45;
      x.fillStyle = 'rgba(' + v + ',' + v + ',' + (v + 4) + ',' + (0.1 + Math.random() * 0.35) + ')';
      var s = 1 + Math.random() * 3;
      x.fillRect(Math.random() * 1024, Math.random() * 1024, s, s);
    }
    // expansion joints
    x.strokeStyle = 'rgba(28,30,33,0.55)'; x.lineWidth = 3;
    for (var k = 0; k <= 4; k++) {
      x.beginPath(); x.moveTo(k * 256, 0); x.lineTo(k * 256, 1024); x.stroke();
      x.beginPath(); x.moveTo(0, k * 256); x.lineTo(1024, k * 256); x.stroke();
    }
    // a faint yellow taxi line
    x.strokeStyle = 'rgba(222,186,72,0.55)'; x.lineWidth = 14;
    x.beginPath(); x.moveTo(0, 512); x.lineTo(1024, 512); x.stroke();
    var tex = new T.CanvasTexture(c);
    tex.wrapS = tex.wrapT = T.RepeatWrapping;
    tex.repeat.set(14, 14);
    tex.encoding = T.sRGBEncoding;
    tex.anisotropy = 8;
    return tex;
  }
  var groundMat = new T.MeshStandardMaterial({
    map: tarmacTexture(), color: col(0x8d949c), roughness: 0.95, metalness: 0.05
  });
  var ground = new T.Mesh(new T.PlaneGeometry(1600, 1600, 1, 1), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = GROUND;
  ground.receiveShadow = true;
  scene.add(ground);

  // soft dark contact patch under the aircraft
  var shadowBlobTex = (function () {
    var c = document.createElement('canvas'); c.width = c.height = 256;
    var x = c.getContext('2d');
    var g = x.createRadialGradient(128, 128, 10, 128, 128, 126);
    g.addColorStop(0, 'rgba(0,0,0,0.55)');
    g.addColorStop(0.55, 'rgba(0,0,0,0.22)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g; x.fillRect(0, 0, 256, 256);
    return new T.CanvasTexture(c);
  })();
  var blob = new T.Mesh(new T.PlaneGeometry(96, 96), new T.MeshBasicMaterial({ map: shadowBlobTex, transparent: true, depthWrite: false }));
  blob.rotation.x = -Math.PI / 2;
  blob.position.set(-2, GROUND + 0.02, 0);
  scene.add(blob);

  /* ------------------------------------------------------------ aircraft */
  var aircraft;
  try {
    aircraft = window.BOEING747.build({ livery: params.get('livery') || 'house', groundY: GROUND });
    scene.add(aircraft.root);
  } catch (e) {
    fail('model build: ' + (e && e.message ? e.message : e));
    throw e;
  }

  /* --------------------------------------------------------------- views */
  var VIEWS = {
    hero:  { pos: [64, 22, 68],  target: [0, -0.8, 0] },
    front: { pos: [94, 5, 7],    target: [0, -0.4, 0] },
    side:  { pos: [3, 9, 104],   target: [0, -0.4, 0] },
    top:   { pos: [4, 116, 26],  target: [0, 0, 0] },
    rear:  { pos: [-86, 26, 46], target: [0, -0.4, 0] },
    belly: { pos: [64, -2.2, 52], target: [-2, -3.0, 0] },
    nose:  { pos: [58, 5, 22],   target: [20, 0, 0] }
  };
  var camGoal = { pos: new T.Vector3(), target: new T.Vector3() };
  var transitioning = false;
  function setView(name, instant) {
    var v = VIEWS[name] || VIEWS.hero;
    camGoal.pos.set(v.pos[0], v.pos[1], v.pos[2]);
    camGoal.target.set(v.target[0], v.target[1], v.target[2]);
    if (instant) {
      camera.position.copy(camGoal.pos);
      controls.target.copy(camGoal.target);
      transitioning = false;
    } else {
      transitioning = true;
    }
  }
  setView(params.get('view') || 'hero', true);
  controls.addEventListener('start', function () { transitioning = false; });

  /* ----------------------------------------------------------------- UI */
  var state = {
    engines: params.get('engines') !== '0',
    demo: params.get('demo') === '1',
    gear: params.get('gear') !== '0',
    rotate: params.get('rotate') !== '0',
    livery: params.get('livery') || 'house'
  };
  controls.autoRotate = state.rotate;
  aircraft.setGear(state.gear);

  function bindToggle(id, key, fn) {
    var el = document.getElementById(id);
    if (!el) return;
    function sync() { el.classList.toggle('on', !!state[key]); }
    el.addEventListener('click', function () {
      state[key] = !state[key];
      if (fn) fn(state[key]);
      sync();
    });
    sync();
  }
  bindToggle('t-engines', 'engines');
  bindToggle('t-demo', 'demo');
  bindToggle('t-gear', 'gear', function (v) { aircraft.setGear(v); });
  bindToggle('t-rotate', 'rotate', function (v) { controls.autoRotate = v; });

  var liveryOrder = ['house', 'retro', 'jade'];
  var liveryBtn = document.getElementById('t-livery');
  function applyLivery(key) {
    state.livery = key;
    aircraft.setLivery(key);
    if (liveryBtn) liveryBtn.textContent = 'Livery: ' + aircraft.palettes[key].name;
  }
  applyLivery(state.livery);
  if (liveryBtn) liveryBtn.addEventListener('click', function () {
    var i = liveryOrder.indexOf(state.livery);
    applyLivery(liveryOrder[(i + 1) % liveryOrder.length]);
  });

  Array.prototype.forEach.call(document.querySelectorAll('[data-view]'), function (b) {
    b.addEventListener('click', function () {
      setView(b.getAttribute('data-view'), false);
      Array.prototype.forEach.call(document.querySelectorAll('[data-view]'), function (o) { o.classList.remove('on'); });
      b.classList.add('on');
    });
  });
  // mark the default view button
  var initialView = params.get('view') || 'hero';
  Array.prototype.forEach.call(document.querySelectorAll('[data-view]'), function (b) {
    if (b.getAttribute('data-view') === initialView) b.classList.add('on');
  });

  /* ------------------------------------------------------------- resize */
  function onResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }
  window.addEventListener('resize', onResize);

  /* ---------------------------------------------------------- main loop */
  var clock = { last: performance.now() };
  var elapsed = 0;
  function loop(now) {
    var dt = Math.min(0.05, Math.max(0.0001, (now - clock.last) / 1000));
    clock.last = now;
    elapsed += dt;

    aircraft.update(dt, elapsed, state);

    if (transitioning) {
      var k = 1 - Math.exp(-dt * 3.4);
      camera.position.lerp(camGoal.pos, k);
      controls.target.lerp(camGoal.target, k);
      if (camera.position.distanceTo(camGoal.pos) < 0.35) {
        camera.position.copy(camGoal.pos);
        controls.target.copy(camGoal.target);
        transitioning = false;
      }
    }
    controls.update();
    renderer.render(scene, camera);
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  // hide the loading card after the first painted frame
  requestAnimationFrame(function () {
    setTimeout(function () { document.body.classList.add('ready'); }, 160);
  });
})();
