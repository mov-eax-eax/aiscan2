/*!
 * main.js — scene, day/night art direction and camera for the procedural
 * Eiffel Tower. Classic script: expects `THREE` (vendor/three.min.js) and
 * `EiffelTowerKit` (src/eiffelTower.js) to already be defined.
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

  if (typeof THREE === 'undefined' || typeof EiffelTowerKit === 'undefined') {
    bail('The three.js or tower script did not load. Serve this folder over HTTP (see serve.cmd).');
    return;
  }

  /* ------------------------------------------------------------------ *
   * Palettes — the whole look is driven by one "time of day" value:
   *   0 = deep night,  0.35 = sunset,  1 = bright afternoon.
   * ------------------------------------------------------------------ */
  var NIGHT = {
    skyTop: 0x04070f, skyHorizon: 0x101c33, skyBottom: 0x070b12,
    fog: 0x0a1120, fogNear: 560, fogFar: 3900,
    sunColor: 0xa8bce6, sunIntensity: 0.32, sunElevation: 0.26, sunAzimuth: -2.35,
    hemiSky: 0x1d2a45, hemiGround: 0x080b10, hemiIntensity: 0.34,
    ambient: 0.05,
    grass: 0x121820, plaza: 0x24272c, plazaInner: 0x2b2e33, trunk: 0x140f0c, canopy: 0x16211a,
    ironHeavy: 0x2a1f1a, ironMedium: 0x2f231d, ironFine: 0x34261f, ironDark: 0x191210,
    bronze: 0x2a1f18, platformFloor: 0x221a16, foundationStone: 0x2b2c30, foundationCap: 0x26272b,
    glazing: 0x18262b, champagne: 0x3a3226
  };
  var DUSK = {
    skyTop: 0x1d3a6b, skyHorizon: 0xe08a54, skyBottom: 0x6a4a3c,
    fog: 0x9a7a63, fogNear: 520, fogFar: 3600,
    sunColor: 0xffb066, sunIntensity: 1.15, sunElevation: 0.3, sunAzimuth: -1.15,
    hemiSky: 0x6b7ba8, hemiGround: 0x3a3028, hemiIntensity: 0.55,
    ambient: 0.1,
    grass: 0x3f4a3c, plaza: 0x6a6155, plazaInner: 0x776d5f, trunk: 0x2b1f16, canopy: 0x2f3a26,
    ironHeavy: 0x5d4331, ironMedium: 0x664a37, ironFine: 0x6d503b, ironDark: 0x2e211a,
    bronze: 0x5c4229, platformFloor: 0x3b2a21, foundationStone: 0x8d8271, foundationCap: 0x7d7362,
    glazing: 0x24454b, champagne: 0x7a6547
  };
  var DAY = {
    skyTop: 0x2160b4, skyHorizon: 0xc2d8ee, skyBottom: 0x93a08a,
    fog: 0xc4d7e9, fogNear: 620, fogFar: 4300,
    sunColor: 0xfff3e2, sunIntensity: 2.7, sunElevation: 0.92, sunAzimuth: -0.75,
    hemiSky: 0xbcd8ff, hemiGround: 0x6f6b52, hemiIntensity: 0.85,
    ambient: 0.14,
    grass: 0x77855c, plaza: 0xa9a294, plazaInner: 0xb8b1a2, trunk: 0x4a3826, canopy: 0x4c6b33,
    ironHeavy: 0x7d5b42, ironMedium: 0x8a684e, ironFine: 0x9a7859, ironDark: 0x3b2b22,
    bronze: 0x735238, platformFloor: 0x4a352a, foundationStone: 0xcfc2a9, foundationCap: 0xb6a88f,
    glazing: 0x294247, champagne: 0xa78962
  };

  var COLOR_KEYS = Object.keys(DAY).filter(function (k) { return typeof DAY[k] === 'number'; });

  function smoothstep(t) { return t * t * (3 - 2 * t); }

  /** Blend NIGHT→DUSK→DAY and write into `out` as THREE.Color instances. */
  function mixPalette(tod, out) {
    var a, b, k;
    if (tod < 0.35) { a = NIGHT; b = DUSK; k = tod / 0.35; }
    else { a = DUSK; b = DAY; k = (tod - 0.35) / 0.65; }
    k = smoothstep(Math.max(0, Math.min(1, k)));
    COLOR_KEYS.forEach(function (key) {
      out[key].setHex(a[key]);
      if (k > 0) out[key].lerp(TMP_COLOR.setHex(b[key]), k);
    });
    ['fogNear', 'fogFar', 'sunIntensity', 'sunElevation', 'sunAzimuth', 'hemiIntensity', 'ambient']
      .forEach(function (key) { out[key] = a[key] + (b[key] - a[key]) * k; });
    // Night-time glow ramps up as the sky darkens: 0 at full day, 1 at full night.
    out.nightMix = 1 - smoothstep(Math.max(0, Math.min(1, (tod - 0.1) / 0.4)));
    return out;
  }

  var TMP_COLOR = new THREE.Color();
  var PAL = {};
  COLOR_KEYS.forEach(function (key) { PAL[key] = new THREE.Color(DAY[key]); });
  PAL.nightMix = 0;

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
  renderer.toneMappingExposure = 1.1;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  document.body.appendChild(renderer.domElement);

  var scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xc4d7e9, 620, 4300);

  var camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 1, 14000);

  /* ------------------------------------------------------------------ *
   * Image-based lighting.
   *
   * This is the single most important detail for making the tower read as
   * IRON rather than as a black silhouette: the lattice materials are
   * metallic (metalness 0.5-0.7), and a metallic surface with no
   * environment to reflect renders black no matter how many lights you add.
   * We therefore turn the sky gradient into a PMREM environment map.
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

  /* ------------------------------------------------------------------ *
   * Sky — a canvas gradient on an inverted sphere, re-drawn as time changes
   * ------------------------------------------------------------------ */
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
  skyMesh.name = 'Sky gradient';
  skyMesh.frustumCulled = false;
  scene.add(skyMesh);

  function css(color) { return '#' + color.getHexString(); }

  function drawSky() {
    var w = skyCanvas.width;
    var h = skyCanvas.height;
    // Only a narrow band of the sphere is on screen at eye level (v ~0.38-0.50
    // for a 42 deg fov), so the zenith colour is held down to v=0.40 and the
    // pale haze is compressed into the last few degrees above the horizon.
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

    // A soft sun/moon blob so the environment has a real key direction.
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

  /* ------------------------------------------------------------------ *
   * Ground: lawn, the stone plaza around the four footings, and the two
   * tree-lined axes (Champ de Mars to the south, Trocadéro to the north).
   * These exist purely for scale — the tower is 330 m and needs references.
   * ------------------------------------------------------------------ */
  var lawn = new THREE.Mesh(
    new THREE.CircleGeometry(2400, 96).rotateX(-Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: 0x77855c, roughness: 1, metalness: 0 })
  );
  lawn.name = 'Lawn';
  lawn.receiveShadow = true;
  scene.add(lawn);

  var plaza = new THREE.Mesh(
    new THREE.CircleGeometry(155, 72).rotateX(-Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: 0xa9a294, roughness: 0.94, metalness: 0.02 })
  );
  plaza.name = 'Plaza';
  plaza.position.y = 0.06;
  plaza.receiveShadow = true;
  scene.add(plaza);

  var plazaInner = new THREE.Mesh(
    new THREE.RingGeometry(84, 156, 72).rotateX(-Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: 0xb8b1a2, roughness: 0.9, metalness: 0.02 })
  );
  plazaInner.name = 'Plaza paving ring';
  plazaInner.position.y = 0.12;
  plazaInner.receiveShadow = true;
  scene.add(plazaInner);

  // --- tree avenues (instanced: 1 draw call each for trunks and canopies)
  function avenuePositions() {
    var out = [];
    function row(x, z0, z1, step) {
      for (var z = z0; z <= z1; z += step) out.push([x, z]);
    }
    // Champ de Mars axis (+z) and Trocadéro axis (-z), both sides of the axis.
    [58, -58].forEach(function (x) { row(x, 250, 1560, 46); });
    [64, -64].forEach(function (x) { row(x, -250, -900, -46); });
    return out;
  }

  var AVENUE = avenuePositions();
  var trunkGeo = new THREE.CylinderGeometry(0.75, 1.35, 8, 6);
  trunkGeo.translate(0, 4, 0);
  var canopyGeo = new THREE.IcosahedronGeometry(5.2, 1);
  canopyGeo.scale(1, 0.86, 1);
  canopyGeo.translate(0, 12.4, 0);

  var trunkMat = new THREE.MeshStandardMaterial({ color: 0x4a3826, roughness: 0.95, metalness: 0 });
  var canopyMat = new THREE.MeshStandardMaterial({ color: 0x4c6b33, roughness: 0.92, metalness: 0 });
  var trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, AVENUE.length);
  var canopies = new THREE.InstancedMesh(canopyGeo, canopyMat, AVENUE.length);
  trunks.name = 'Avenue trunks';
  canopies.name = 'Avenue canopies';
  (function placeTrees() {
    var m = new THREE.Matrix4();
    var q = new THREE.Quaternion();
    var s = new THREE.Vector3();
    for (var i = 0; i < AVENUE.length; i++) {
      var jitter = ((i * 2654435761) % 1000) / 1000; // deterministic scatter
      var scale = 0.82 + jitter * 0.42;
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), jitter * 6.283);
      s.set(scale, scale * (0.92 + jitter * 0.2), scale);
      m.compose(new THREE.Vector3(AVENUE[i][0] + (jitter - 0.5) * 3, 0, AVENUE[i][1]), q, s);
      trunks.setMatrixAt(i, m);
      canopies.setMatrixAt(i, m);
    }
    trunks.instanceMatrix.needsUpdate = true;
    canopies.instanceMatrix.needsUpdate = true;
    trunks.castShadow = canopies.castShadow = true;
    trunks.receiveShadow = canopies.receiveShadow = true;
    scene.add(trunks, canopies);
  })();

  /* ------------------------------------------------------------------ *
   * Lights
   * ------------------------------------------------------------------ */
  var hemi = new THREE.HemisphereLight(0xbcd8ff, 0x6f6b52, 0.85);
  scene.add(hemi);

  var ambient = new THREE.AmbientLight(0xffffff, 0.14);
  scene.add(ambient);

  var sun = new THREE.DirectionalLight(0xfff3e2, 2.7);
  sun.castShadow = true;
  // Thin members (0.2-1.5 m across) alias badly in a shadow map: at 2048 over a
  // 700 m frustum one texel is ~0.35 m, so a 0.3 m strut smears into a long hard
  // streak across the plaza. A denser map plus a tighter frustum fixes it.
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
    var el = PAL.sunElevation;
    var az = PAL.sunAzimuth;
    var horizontal = Math.cos(el);
    sun.position.set(
      Math.sin(az) * horizontal * 1400,
      Math.max(60, Math.sin(el) * 1400),
      Math.cos(az) * horizontal * 1400
    );
    sun.target.position.set(0, 150, 0);
    sun.target.updateMatrixWorld();
    sun.color.copy(PAL.sunColor);
    sun.intensity = PAL.sunIntensity;
  }

  /* ------------------------------------------------------------------ *
   * The tower itself
   * ------------------------------------------------------------------ */
  var towerKit = null;
  var detailLevel = 'full';

  var IRON_MATERIALS = [
    ['iron', 'ironHeavy'], ['ironMedium', 'ironMedium'], ['ironFine', 'ironFine'], ['darkIron', 'ironDark'],
    ['bronze', 'bronze'], ['platformFloor', 'platformFloor'], ['opaqueGlazing', 'glazing'],
    ['champagneMetal', 'champagne'], ['foundationStone', 'foundationStone'], ['foundationCap', 'foundationCap']
  ];

  function buildTower() {
    if (towerKit) {
      scene.remove(towerKit.group);
      towerKit.dispose();
      towerKit = null;
    }
    towerKit = EiffelTowerKit.buildEiffelTower(THREE, {
      detail: detailLevel,
      includeLights: true,
      // Only the heavy chords cast shadows. Letting the 1,576 medium members
      // cast as well costs a lot and only adds shadow aliasing.
      mediumShadows: false,
      nightMix: PAL.nightMix || 0
    });
    scene.add(towerKit.group);

    var meta = towerKit.metadata;
    var membersEl = document.getElementById('m-members');
    var nodesEl = document.getElementById('m-nodes');
    if (membersEl) membersEl.textContent = meta.towerStructuralMemberCount.toLocaleString() + ' struts';
    if (nodesEl) nodesEl.textContent = meta.structuralNodeCount.toLocaleString() + ' nodes';

    applyVerticalTint(towerKit.group);
    applyPaletteToScene();
  }

  /* The official paint scheme is a deliberate vertical degrade, darkest at the
   * base and lightest at the top — officially "pour accentuer la ligne de
   * fuite", i.e. the paint exists to accentuate the taper (sampled swatches
   * #67482F at the base through #976C35 at the top). The builder groups members
   * into materials by structural ROLE, not by height, so the degrade is applied
   * per instance as a multiplier on whatever the current palette colour is.
   */
  var BASE_TINT = new THREE.Color(0.76, 0.72, 0.70);
  var TOP_TINT = new THREE.Color(1.26, 1.20, 1.02);
  var _tint = new THREE.Color();
  var _tintMatrix = new THREE.Matrix4();
  var _tintPos = new THREE.Vector3();
  var _tintQuat = new THREE.Quaternion();
  var _tintScale = new THREE.Vector3();

  function applyVerticalTint(root) {
    root.traverse(function (o) {
      if (!o.isInstancedMesh) return;
      for (var i = 0; i < o.count; i++) {
        o.getMatrixAt(i, _tintMatrix);
        _tintMatrix.decompose(_tintPos, _tintQuat, _tintScale);
        var t = Math.max(0, Math.min(1, _tintPos.y / 300));
        _tint.copy(BASE_TINT).lerp(TOP_TINT, t);
        o.setColorAt(i, _tint);
      }
      if (o.instanceColor) o.instanceColor.needsUpdate = true;
    });
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
      IRON_MATERIALS.forEach(function (pair) {
        if (mats[pair[0]] && mats[pair[0]].color) mats[pair[0]].color.copy(PAL[pair[1]]);
      });
      // Let the sky do the heavy lifting on these metallic surfaces.
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
   * Camera rig — a small damped orbit controller (no addon needed, which
   * keeps the page working from a plain file:// load).
   * ------------------------------------------------------------------ */
  function OrbitRig(camera, dom) {
    var self = this;
    this.target = new THREE.Vector3(0, 130, 0);
    this.theta = -0.62; this.phi = 1.20; this.radius = 950;
    this._theta = this.theta; this._phi = this.phi; this._radius = this.radius;
    this._target = this.target.clone();
    this.autoSpin = 0.05;
    this.spinning = true;
    this.damping = 0.14;
    this.minPhi = 0.1;
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
      } else if (pointers.size === 2) {
        mode = 'pinch';
        lastPinch = pinchDistance();
      }
      self.spinning = false;
      syncSpinButton();
    });

    function pinchDistance() {
      var pts = Array.from(pointers.values());
      var dx = pts[0].x - pts[1].x;
      var dy = pts[0].y - pts[1].y;
      return Math.hypot(dx, dy);
    }

    function pinchMid() {
      var pts = Array.from(pointers.values());
      return { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
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
        panBy((q.x - prev.x), (q.y - prev.y));
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

    this.goTo = function (view) {
      this._target.set(view.target[0], view.target[1], view.target[2]);
      this._theta = view.theta; this._phi = view.phi; this._radius = view.radius;
    };

    /** Jump straight to the requested pose instead of easing into it. */
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

  // phi is measured from +Y, so phi > PI/2 places the camera BELOW the look-at
  // point — that is what makes the tower loom instead of sitting in a puddle of
  // lawn. Keep every preset slightly below its target.
  var VIEWS = {
    panorama: { target: [0, 178, 0], theta: -0.62, phi: 1.63, radius: 790 },
    arch: { target: [0, 74, 0], theta: -0.12, phi: 1.71, radius: 235 },
    base: { target: [0, 150, 0], theta: -0.98, phi: 1.74, radius: 340 },
    level1: { target: [0, 84, 0], theta: 0.36, phi: 1.78, radius: 170 },
    summit: { target: [0, 296, 0], theta: -0.5, phi: 1.44, radius: 255 },
    bird: { target: [0, 96, 0], theta: -0.55, phi: 0.74, radius: 830 }
  };

  /* ------------------------------------------------------------------ *
   * UI wiring
   * ------------------------------------------------------------------ */
  var todInput = document.getElementById('tod');
  var btnDetail = document.getElementById('btn-detail');
  var btnSpin = document.getElementById('btn-spin');
  var btnShadow = document.getElementById('btn-shadow');
  var btnReset = document.getElementById('btn-reset');

  function syncSpinButton() {
    if (btnSpin) btnSpin.classList.toggle('active', rig.spinning);
  }

  function setTimeOfDay(tod) {
    mixPalette(tod, PAL);
    applyPaletteToScene();
  }

  if (todInput) {
    todInput.addEventListener('input', function () { setTimeOfDay(parseFloat(todInput.value)); });
  }

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

  if (btnDetail) {
    btnDetail.addEventListener('click', function () {
      detailLevel = detailLevel === 'full' ? 'compact' : 'full';
      btnDetail.textContent = 'Detail: ' + (detailLevel === 'full' ? 'Full' : 'Compact');
      buildTower();
    });
  }
  if (btnSpin) {
    btnSpin.addEventListener('click', function () { rig.spinning = !rig.spinning; syncSpinButton(); });
  }
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
      var panel = document.getElementById('info');
      var views = document.getElementById('views');
      var controls = document.getElementById('controls');
      [panel, views, controls].forEach(function (el) {
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
  // Optional deep links, handy for screenshots and for sharing a view:
  //   index.html?tod=0.05&view=arch&detail=compact
  var query = new URLSearchParams(window.location.search);
  var qTod = parseFloat(query.get('tod'));
  if (todInput && isFinite(qTod)) todInput.value = String(Math.max(0, Math.min(1, qTod)));
  if (query.get('detail') === 'compact') detailLevel = 'compact';
  if (btnDetail) btnDetail.textContent = 'Detail: ' + (detailLevel === 'full' ? 'Full' : 'Compact');
  // ?still=1 draws exactly one frame (fast, deterministic screenshots).
  var still = query.get('still') === '1';
  if (still) rig.spinning = false;
  if (query.get('shadows') === '0') {
    renderer.shadowMap.enabled = false;
    if (btnShadow) btnShadow.classList.remove('active');
  }
  if (query.get('spin') === '0') rig.spinning = false;

  setTimeOfDay(parseFloat(todInput ? todInput.value : 0.72));
  updateEnvironment();
  buildTower();
  rig.goTo(VIEWS[query.get('view')] || VIEWS.panorama);
  rig.spinning = !still;
  if (still) rig.snap();
  syncSpinButton();

  var fpsEl = document.getElementById('p-fps');
  var trisEl = document.getElementById('p-tris');
  var callsEl = document.getElementById('p-calls');
  var last = performance.now();
  var acc = 0, frames = 0, firstFrame = true;

  function loop(now) {
    if (!still) requestAnimationFrame(loop);
    var dt = Math.min(0.05, Math.max(0.0005, (now - last) / 1000));
    last = now;

    rig.update(dt);
    if (envDirty) updateEnvironment();
    renderer.render(scene, camera);

    acc += dt; frames++;
    if (acc >= 0.5) {
      if (fpsEl) fpsEl.textContent = Math.round(frames / acc);
      if (trisEl) trisEl.textContent = (renderer.info.render.triangles / 1000).toFixed(0) + 'k';
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


