/*!
 * main.js — scene, art direction and camera for the research-driven Eiffel Tower.
 * Classic script: expects `THREE` (vendor/three.min.js) and `EiffelGenesis`
 * (src/eiffelGenesis.js) to already be defined.
 *
 * The generator bakes the official three-tone paint degrade into each instance's
 * colour, so the metal materials here stay near-white by day and simply darken at
 * night, letting emissive and the uplights take over.
 */
(function () {
  'use strict';

  var loaderEl = document.getElementById('loader');
  var hintEl = document.getElementById('hint');

  function bail(message) {
    if (loaderEl) loaderEl.classList.add('done');
    if (hintEl) {
      var h2 = hintEl.querySelector('h2');
      var p = hintEl.querySelector('p');
      if (h2) h2.textContent = 'Cannot start the renderer';
      if (p) p.textContent = message;
      hintEl.classList.add('show');
    }
  }

  if (typeof THREE === 'undefined' || typeof EiffelGenesis === 'undefined') {
    bail('The three.js or generator script did not load. Serve this folder over HTTP (see serve.cmd).');
    return;
  }

  /* ------------------------------------------------------------------ *
   * Palettes — one "time of day" value drives everything.
   *   0 = deep night, 0.35 = sunset, 1 = bright afternoon.
   * Iron is near-white because the paint degrade rides on instanceColor.
   * ------------------------------------------------------------------ */
  var NIGHT = {
    skyTop: 0x04070f, skyHorizon: 0x101c33, skyBottom: 0x070b12,
    fog: 0x0a1120, fogNear: 560, fogFar: 3900,
    sunColor: 0xa8bce6, sunIntensity: 0.30, sunElevation: 0.26, sunAzimuth: -2.35,
    hemiSky: 0x1d2a45, hemiGround: 0x080b10, hemiIntensity: 0.34, ambient: 0.05,
    grass: 0x121820, plaza: 0x24272c, plazaInner: 0x2b2e33, trunk: 0x140f0c, canopy: 0x16211a,
    iron: 0x2a201a, stone: 0x2b2c30
  };
  var DUSK = {
    skyTop: 0x1d3a6b, skyHorizon: 0xe08a54, skyBottom: 0x6a4a3c,
    fog: 0x9a7a63, fogNear: 520, fogFar: 3600,
    sunColor: 0xffb066, sunIntensity: 1.15, sunElevation: 0.30, sunAzimuth: -1.15,
    hemiSky: 0x6b7ba8, hemiGround: 0x3a3028, hemiIntensity: 0.55, ambient: 0.10,
    grass: 0x3f4a3c, plaza: 0x6a6155, plazaInner: 0x776d5f, trunk: 0x2b1f16, canopy: 0x2f3a26,
    iron: 0xe8dbcb, stone: 0x8d8271
  };
  var DAY = {
    skyTop: 0x2160b4, skyHorizon: 0xc2d8ee, skyBottom: 0x93a08a,
    fog: 0xc4d7e9, fogNear: 620, fogFar: 4300,
    sunColor: 0xfff3e2, sunIntensity: 2.7, sunElevation: 0.92, sunAzimuth: -0.75,
    hemiSky: 0xbcd8ff, hemiGround: 0x6f6b52, hemiIntensity: 0.85, ambient: 0.14,
    grass: 0x77855c, plaza: 0xa9a294, plazaInner: 0xb8b1a2, trunk: 0x4a3826, canopy: 0x4c6b33,
    iron: 0xffffff, stone: 0xcfc2a9
  };

  var COLOR_KEYS = Object.keys(DAY).filter(function (k) { return typeof DAY[k] === 'number'; });
  var TMP_COLOR = new THREE.Color();
  var PAL = {};
  COLOR_KEYS.forEach(function (key) { PAL[key] = new THREE.Color(DAY[key]); });
  PAL.nightMix = 0;

  function smoothstep(t) { t = t < 0 ? 0 : t > 1 ? 1 : t; return t * t * (3 - 2 * t); }

  function mixPalette(tod, out) {
    var a, b, k;
    if (tod < 0.35) { a = NIGHT; b = DUSK; k = tod / 0.35; }
    else { a = DUSK; b = DAY; k = (tod - 0.35) / 0.65; }
    k = smoothstep(k);
    COLOR_KEYS.forEach(function (key) {
      out[key].setHex(a[key]);
      if (k > 0) out[key].lerp(TMP_COLOR.setHex(b[key]), k);
    });
    ['fogNear', 'fogFar', 'sunIntensity', 'sunElevation', 'sunAzimuth', 'hemiIntensity', 'ambient']
      .forEach(function (key) { out[key] = a[key] + (b[key] - a[key]) * k; });
    out.nightMix = 1 - smoothstep((tod - 0.10) / 0.40);
    return out;
  }

  /* ------------------------------------------------------------------ *
   * Renderer
   * ------------------------------------------------------------------ */
  var renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  } catch (err) {
    bail('WebGL is unavailable in this browser: ' + err.message);
    return;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.14;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  document.body.appendChild(renderer.domElement);

  var scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xc4d7e9, 620, 4300);
  var camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 1, 14000);

  /* ------------------------------------------------------------------ *
   * Image-based lighting.
   *
   * The single most important visual fix: the lattice materials are metallic,
   * and a metallic surface with no environment to reflect renders BLACK no
   * matter how many lights are added. The sky gradient therefore doubles as a
   * PMREM environment map. PMREMGenerator is in the core build, so this needs
   * no addon imports.
   * ------------------------------------------------------------------ */
  var pmrem = new THREE.PMREMGenerator(renderer);
  var envTarget = null;
  var envDirty = true;

  function updateEnvironment() {
    envDirty = false;
    var previous = envTarget;
    envTarget = pmrem.fromEquirectangular(skyTexture);
    scene.environment = envTarget.texture;
    if (previous) previous.dispose();
  }

  /* ---- sky ---------------------------------------------------------- */
  var skyCanvas = document.createElement('canvas');
  skyCanvas.width = 64;
  skyCanvas.height = 256;
  var skyCtx = skyCanvas.getContext('2d');
  var skyTexture = new THREE.CanvasTexture(skyCanvas);
  skyTexture.colorSpace = THREE.SRGBColorSpace;
  skyTexture.mapping = THREE.EquirectangularReflectionMapping;
  skyTexture.minFilter = THREE.LinearFilter;
  skyTexture.magFilter = THREE.LinearFilter;
  skyTexture.wrapS = THREE.RepeatWrapping;
  skyTexture.wrapT = THREE.ClampToEdgeWrapping;

  var skyMesh = new THREE.Mesh(
    new THREE.SphereGeometry(9000, 32, 16),
    new THREE.MeshBasicMaterial({ map: skyTexture, side: THREE.BackSide, depthWrite: false, fog: false })
  );
  skyMesh.frustumCulled = false;
  scene.add(skyMesh);

  function css(color) { return '#' + color.getHexString(); }

  function drawSky() {
    var w = skyCanvas.width, h = skyCanvas.height;
    // Only a narrow band is on screen at eye level (v ~0.38-0.50 for a 42 deg
    // fov), so the zenith colour is held down to v=0.40 and the pale haze is
    // compressed into the last few degrees above the horizon.
    var mid = TMP_COLOR.copy(PAL.skyTop).lerp(PAL.skyHorizon, 0.55);
    var midCss = css(mid);
    var g = skyCtx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0.00, css(PAL.skyTop));
    g.addColorStop(0.40, css(PAL.skyTop));
    g.addColorStop(0.475, midCss);
    g.addColorStop(0.50, css(PAL.skyHorizon));
    g.addColorStop(0.56, css(PAL.skyBottom));
    g.addColorStop(1.00, css(PAL.skyBottom));
    skyCtx.fillStyle = g;
    skyCtx.fillRect(0, 0, w, h);

    var u = ((PAL.sunAzimuth / (Math.PI * 2)) + 0.5) * w;
    var v = (0.5 - PAL.sunElevation / Math.PI) * h;
    var glow = skyCtx.createRadialGradient(u, v, 0, u, v, h * 0.17);
    var tint = css(PAL.sunColor);
    glow.addColorStop(0, tint);
    glow.addColorStop(0.25, tint);
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    skyCtx.globalAlpha = 0.55;
    skyCtx.fillStyle = glow;
    skyCtx.fillRect(0, 0, w, h);
    skyCtx.globalAlpha = 1;

    skyTexture.needsUpdate = true;
    envDirty = true;
  }

  /* ---- ground, esplanade and the two tree-lined axes ---------------- */
  var lawn = new THREE.Mesh(
    new THREE.CircleGeometry(2400, 96).rotateX(-Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: 0x77855c, roughness: 1, metalness: 0 })
  );
  lawn.receiveShadow = true;
  scene.add(lawn);

  var plaza = new THREE.Mesh(
    new THREE.CircleGeometry(150, 72).rotateX(-Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: 0xa9a294, roughness: 0.94, metalness: 0.02 })
  );
  plaza.position.y = 0.06;
  plaza.receiveShadow = true;
  scene.add(plaza);

  var plazaInner = new THREE.Mesh(
    new THREE.RingGeometry(82, 151, 72).rotateX(-Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: 0xb8b1a2, roughness: 0.9, metalness: 0.02 })
  );
  plazaInner.position.y = 0.12;
  plazaInner.receiveShadow = true;
  scene.add(plazaInner);

  var trunkGeo = new THREE.CylinderGeometry(0.75, 1.35, 8, 6);
  trunkGeo.translate(0, 4, 0);
  var canopyGeo = new THREE.IcosahedronGeometry(5.2, 1);
  canopyGeo.scale(1, 0.86, 1);
  canopyGeo.translate(0, 12.4, 0);
  var trunkMat = new THREE.MeshStandardMaterial({ color: 0x4a3826, roughness: 0.95, metalness: 0 });
  var canopyMat = new THREE.MeshStandardMaterial({ color: 0x4c6b33, roughness: 0.92, metalness: 0 });

  var avenue = [];
  [58, -58].forEach(function (x) { for (var z = 250; z <= 1560; z += 46) avenue.push([x, z]); });
  [64, -64].forEach(function (x) { for (var z = -250; z >= -900; z -= 46) avenue.push([x, z]); });

  var trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, avenue.length);
  var canopies = new THREE.InstancedMesh(canopyGeo, canopyMat, avenue.length);
  (function placeTrees() {
    var m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3();
    for (var i = 0; i < avenue.length; i++) {
      var jitter = ((i * 2654435761) % 1000) / 1000;
      var scale = 0.82 + jitter * 0.42;
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), jitter * 6.283);
      s.set(scale, scale * (0.92 + jitter * 0.2), scale);
      m.compose(new THREE.Vector3(avenue[i][0] + (jitter - 0.5) * 3, 0, avenue[i][1]), q, s);
      trunks.setMatrixAt(i, m);
      canopies.setMatrixAt(i, m);
    }
    trunks.instanceMatrix.needsUpdate = true;
    canopies.instanceMatrix.needsUpdate = true;
    trunks.castShadow = canopies.castShadow = true;
    trunks.receiveShadow = canopies.receiveShadow = true;
    scene.add(trunks, canopies);
  })();

  /* ---- lights ------------------------------------------------------- */
  var hemi = new THREE.HemisphereLight(0xbcd8ff, 0x6f6b52, 0.85);
  scene.add(hemi);
  var ambient = new THREE.AmbientLight(0xffffff, 0.14);
  scene.add(ambient);

  var sun = new THREE.DirectionalLight(0xfff3e2, 2.7);
  sun.castShadow = true;
  // Sub-metre struts alias badly in a shadow map, so the map is dense and the
  // frustum tight; the research measured ~0.34 m/texel at 2048 over 700 m.
  sun.shadow.mapSize.set(4096, 4096);
  sun.shadow.camera.left = -300;
  sun.shadow.camera.right = 300;
  sun.shadow.camera.top = 400;
  sun.shadow.camera.bottom = -40;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 3200;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 1.1;
  scene.add(sun);
  scene.add(sun.target);

  function placeSun() {
    var el = PAL.sunElevation, az = PAL.sunAzimuth;
    var horiz = Math.cos(el);
    sun.position.set(
      Math.sin(az) * horiz * 1400,
      Math.max(60, Math.sin(el) * 1400),
      Math.cos(az) * horiz * 1400
    );
    sun.target.position.set(0, 150, 0);
    sun.target.updateMatrixWorld();
    sun.color.copy(PAL.sunColor);
    sun.intensity = PAL.sunIntensity;
  }

  /* ------------------------------------------------------------------ *
   * The tower
   * ------------------------------------------------------------------ */
  var towerKit = null;
  var DENSITIES = [
    { label: 'Light', value: 1.0 },
    { label: 'Balanced', value: 1.4 },
    { label: 'Dense', value: 1.9 }
  ];
  var densityIndex = 1;

  // 'deck' and 'stone' are excluded: the deck rides the same painted instanceColor
  // path as the lattice, and stone is a separate palette entry.
  var IRON_BUCKETS = ['heavy', 'medium', 'fine', 'railing', 'elevator', 'stair', 'antenna'];

  function buildTower() {
    if (towerKit) {
      scene.remove(towerKit.group);
      towerKit.dispose();
      towerKit = null;
    }
    towerKit = EiffelGenesis.build(THREE, {
      density: DENSITIES[densityIndex].value,
      includeLights: true,
      sparkle: sparkleOn,
      nightMix: PAL.nightMix || 0
    });
    scene.add(towerKit.group);

    var meta = towerKit.metadata;
    var men = document.getElementById('m-members');
    var tri = document.getElementById('m-tris');
    var pro = document.getElementById('m-profile');
    if (men) men.textContent = meta.memberCount.toLocaleString() + ' members';
    if (tri) tri.textContent = 'rendering...';
    if (pro) pro.textContent = 'max ' + meta.profileMaxErrorPercent + '% error';
    if (btnDensity) btnDensity.textContent = 'Lattice: ' + DENSITIES[densityIndex].label;

    applyPaletteToScene();
  }

  function applyPaletteToScene() {
    scene.fog.color.copy(PAL.fog);
    scene.fog.near = PAL.fogNear;
    scene.fog.far = PAL.fogFar;

    hemi.color.copy(PAL.hemiSky);
    hemi.groundColor.copy(PAL.hemiGround);
    hemi.intensity = PAL.hemiIntensity;
    ambient.intensity = PAL.ambient;

    lawn.material.color.copy(PAL.grass);
    plaza.material.color.copy(PAL.plaza);
    plazaInner.material.color.copy(PAL.plazaInner);
    trunkMat.color.copy(PAL.trunk);
    canopyMat.color.copy(PAL.canopy);

    if (towerKit) {
      var mats = towerKit.materials;
      IRON_BUCKETS.forEach(function (name) {
        if (mats[name] && mats[name].color) mats[name].color.copy(PAL.iron);
      });
      if (mats.stone) mats.stone.color.copy(PAL.stone);
      Object.keys(mats).forEach(function (name) {
        var m = mats[name];
        if (m && 'envMapIntensity' in m) m.envMapIntensity = 1.15;
      });
      towerKit.setNightMix(PAL.nightMix);
    }
    placeSun();
    drawSky();
    skyMesh.material.needsUpdate = true;
  }

  /* ------------------------------------------------------------------ *
   * Camera rig — small damped orbit controller, no addon needed.
   * phi is measured from +Y, so phi > PI/2 puts the camera BELOW the target:
   * that is what makes the tower loom instead of sitting in a puddle of lawn.
   * ------------------------------------------------------------------ */
  function OrbitRig(camera, dom) {
    var self = this;
    this.target = new THREE.Vector3(0, 150, 0);
    this.theta = -0.62; this.phi = 1.24; this.radius = 800;
    this._theta = this.theta; this._phi = this.phi; this._radius = this.radius;
    this._target = this.target.clone();
    this.autoSpin = 0.05;
    this.spinning = true;
    this.damping = 0.14;
    this.minPhi = 0.08;
    this.maxPhi = Math.PI * 0.497;
    this.minRadius = 40;
    this.maxRadius = 5200;

    var pointers = new Map();
    var lastPinch = 0;
    var mode = null;
    var prev = { x: 0, y: 0 };
    function localXY(e) { return { x: e.clientX, y: e.clientY }; }

    dom.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    dom.addEventListener('pointerdown', function (e) {
      dom.setPointerCapture(e.pointerId);
      pointers.set(e.pointerId, localXY(e));
      if (pointers.size === 1) {
        mode = (e.button === 2 || e.shiftKey) ? 'pan' : 'rotate';
        prev = localXY(e);
      } else if (pointers.size === 2) { mode = 'pinch'; lastPinch = pinchDistance(); }
      self.spinning = false;
      syncSpinButton();
    });

    function pinchDistance() {
      var p = Array.from(pointers.values());
      return Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y);
    }
    function pinchMid() {
      var p = Array.from(pointers.values());
      return { x: (p[0].x + p[1].x) / 2, y: (p[0].y + p[1].y) / 2 };
    }

    dom.addEventListener('pointermove', function (e) {
      if (!pointers.has(e.pointerId)) return;
      pointers.set(e.pointerId, localXY(e));
      if (mode === 'rotate' && pointers.size === 1) {
        var p = localXY(e);
        var k = 0.0055 * Math.min(1, 900 / self._radius + 0.35);
        self._theta -= (p.x - prev.x) * k;
        self._phi -= (p.y - prev.y) * k;
        self._phi = Math.max(self.minPhi, Math.min(self.maxPhi, self._phi));
        prev = p;
      } else if (mode === 'pan' && pointers.size === 1) {
        var q = localXY(e);
        panBy(q.x - prev.x, q.y - prev.y);
        prev = q;
      } else if (mode === 'pinch' && pointers.size === 2) {
        var d = pinchDistance();
        if (lastPinch > 0) {
          self._radius *= lastPinch / Math.max(1, d);
          self._radius = Math.max(self.minRadius, Math.min(self.maxRadius, self._radius));
        }
        lastPinch = d;
        var mid = pinchMid();
        panBy(mid.x - prev.x, mid.y - prev.y);
        prev = mid;
      }
    });

    function endPointer(e) {
      pointers.delete(e.pointerId);
      if (pointers.size === 0) mode = null;
      else if (pointers.size === 1) { mode = 'rotate'; prev = Array.from(pointers.values())[0]; }
    }
    dom.addEventListener('pointerup', endPointer);
    dom.addEventListener('pointercancel', endPointer);

    function panBy(dx, dy) {
      var scale = self._radius * 0.0016;
      var right = new THREE.Vector3().setFromMatrixColumn(camera.matrix, 0);
      var up = new THREE.Vector3().setFromMatrixColumn(camera.matrix, 1);
      self._target.addScaledVector(right, -dx * scale);
      self._target.addScaledVector(up, dy * scale);
      self._target.y = Math.max(-30, Math.min(360, self._target.y));
    }

    dom.addEventListener('wheel', function (e) {
      e.preventDefault();
      self._radius *= Math.exp(e.deltaY * 0.0011);
      self._radius = Math.max(self.minRadius, Math.min(self.maxRadius, self._radius));
    }, { passive: false });

    this.goTo = function (v) {
      this._target.set(v.target[0], v.target[1], v.target[2]);
      this._theta = v.theta; this._phi = v.phi; this._radius = v.radius;
    };
    this.snap = function () {
      this.theta = this._theta; this.phi = this._phi; this.radius = this._radius;
      this.target.copy(this._target);
      this.update(0);
    };
    this.update = function (dt) {
      if (this.spinning) this._theta += this.autoSpin * dt;
      var k = 1 - Math.pow(1 - this.damping, dt * 60);
      this.theta += (this._theta - this.theta) * k;
      this.phi += (this._phi - this.phi) * k;
      this.radius += (this._radius - this.radius) * k;
      this.target.lerp(this._target, k);
      var sp = Math.sin(this.phi);
      camera.position.set(
        this.target.x + this.radius * sp * Math.sin(this.theta),
        this.target.y + this.radius * Math.cos(this.phi),
        this.target.z + this.radius * sp * Math.cos(this.theta)
      );
      camera.lookAt(this.target);
    };
  }

  var rig = new OrbitRig(camera, renderer.domElement);

  var VIEWS = {
    panorama: { target: [0, 168, 0], theta: -0.62, phi: 1.645, radius: 655 },
    arch: { target: [0, 74, 0], theta: -0.12, phi: 1.71, radius: 232 },
    base: { target: [0, 150, 0], theta: -0.98, phi: 1.74, radius: 335 },
    level1: { target: [0, 84, 0], theta: 0.36, phi: 1.78, radius: 168 },
    shaft: { target: [0, 205, 0], theta: -0.35, phi: 1.66, radius: 430 },
    summit: { target: [0, 292, 0], theta: -0.5, phi: 1.44, radius: 250 },
    bird: { target: [0, 96, 0], theta: -0.55, phi: 0.74, radius: 830 }
  };

  /* ------------------------------------------------------------------ *
   * UI
   * ------------------------------------------------------------------ */
  var todInput = document.getElementById('tod');
  var btnDensity = document.getElementById('btn-density');
  var btnSparkle = document.getElementById('btn-sparkle');
  var btnSpin = document.getElementById('btn-spin');
  var btnShadow = document.getElementById('btn-shadow');
  var btnReset = document.getElementById('btn-reset');
  var sparkleOn = true;

  function syncSpinButton() {
    if (btnSpin) btnSpin.classList.toggle('active', rig.spinning);
  }
  function setTimeOfDay(tod) {
    mixPalette(tod, PAL);
    applyPaletteToScene();
  }

  if (todInput) todInput.addEventListener('input', function () { setTimeOfDay(parseFloat(todInput.value)); });

  Array.prototype.forEach.call(document.querySelectorAll('#views button'), function (button) {
    button.addEventListener('click', function () {
      var view = VIEWS[button.getAttribute('data-view')];
      if (!view) return;
      rig.goTo(view);
      rig.spinning = false;
      syncSpinButton();
      Array.prototype.forEach.call(document.querySelectorAll('#views button'), function (b) { b.classList.remove('active'); });
      button.classList.add('active');
    });
  });

  if (btnDensity) {
    btnDensity.addEventListener('click', function () {
      densityIndex = (densityIndex + 1) % DENSITIES.length;
      buildTower();
    });
  }
  if (btnSparkle) {
    btnSparkle.addEventListener('click', function () {
      sparkleOn = !sparkleOn;
      btnSparkle.classList.toggle('active', sparkleOn);
      buildTower();
    });
  }
  if (btnSpin) btnSpin.addEventListener('click', function () { rig.spinning = !rig.spinning; syncSpinButton(); });
  if (btnShadow) {
    btnShadow.addEventListener('click', function () {
      var on = !renderer.shadowMap.enabled;
      renderer.shadowMap.enabled = on;
      btnShadow.classList.toggle('active', on);
      scene.traverse(function (o) { if (o.material) o.material.needsUpdate = true; });
    });
  }
  if (btnReset) {
    btnReset.addEventListener('click', function () {
      rig.goTo(VIEWS.panorama);
      rig.spinning = true;
      syncSpinButton();
    });
  }

  window.addEventListener('keydown', function (e) {
    if (e.key === ' ' || e.code === 'Space') { e.preventDefault(); rig.spinning = !rig.spinning; syncSpinButton(); }
    if (e.key === 'h' || e.key === 'H') {
      ['info', 'views', 'controls'].forEach(function (id) {
        var el = document.getElementById(id);
        if (el) el.style.display = el.style.display === 'none' ? '' : 'none';
      });
    }
  });

  window.addEventListener('resize', function () {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  /* ------------------------------------------------------------------ *
   * Boot + render loop
   * ------------------------------------------------------------------ */
  // Deep links: index.html?tod=0.05&view=arch&density=1.9&shadows=0&spin=0&still=1
  var query = new URLSearchParams(window.location.search);
  var qTod = parseFloat(query.get('tod'));
  if (todInput && isFinite(qTod)) todInput.value = String(Math.max(0, Math.min(1, qTod)));
  var qDensity = parseFloat(query.get('density'));
  if (isFinite(qDensity)) {
    var best = 0;
    for (var di = 1; di < DENSITIES.length; di++) {
      if (Math.abs(DENSITIES[di].value - qDensity) < Math.abs(DENSITIES[best].value - qDensity)) best = di;
    }
    densityIndex = best;
  }
  if (query.get('sparkle') === '0') sparkleOn = false;
  if (btnSparkle) btnSparkle.classList.toggle('active', sparkleOn);
  if (query.get('shadows') === '0') {
    renderer.shadowMap.enabled = false;
    if (btnShadow) btnShadow.classList.remove('active');
  }
  var still = query.get('still') === '1';
  if (query.get('spin') === '0' || still) rig.spinning = false;

  setTimeOfDay(parseFloat(todInput ? todInput.value : 0.74));
  updateEnvironment();
  buildTower();
  rig.goTo(VIEWS[query.get('view')] || VIEWS.panorama);
  if (still) rig.snap();
  syncSpinButton();

  var fpsEl = document.getElementById('p-fps');
  var trisEl = document.getElementById('p-tris');
  var callsEl = document.getElementById('p-calls');
  var last = performance.now();
  var start = last;
  var acc = 0, frames = 0, firstFrame = true;

  function loop(now) {
    if (!still) requestAnimationFrame(loop);
    var dt = Math.min(0.05, Math.max(0.0005, (now - last) / 1000));
    last = now;

    rig.update(dt);
    if (towerKit && towerKit.update) towerKit.update((now - start) / 1000);
    if (envDirty) updateEnvironment();
    renderer.render(scene, camera);

    acc += dt; frames++;
    if (acc >= 0.5) {
      if (fpsEl) fpsEl.textContent = Math.round(frames / acc);
      var kt = (renderer.info.render.triangles / 1000).toFixed(0) + 'k';
      if (trisEl) trisEl.textContent = kt;
      var mTri = document.getElementById('m-tris');
      if (mTri) mTri.textContent = kt + ' drawn';
      if (callsEl) callsEl.textContent = renderer.info.render.calls + ' calls';
      acc = 0; frames = 0;
    }
    if (firstFrame) {
      firstFrame = false;
      if (loaderEl) loaderEl.classList.add('done');
    }
  }
  requestAnimationFrame(loop);
})();
