/* ============================================================================
   THE FOUR HORSEMEN — Revelation 6:1–8
   A 3D retelling in four seals. Three.js r158, vendored locally.

   Structure:  title → (seal → rider) ×4 → finale → end
   Everything is procedural: no external assets except the three.js build.
   Scripture: King James Version (public domain), quoted verbatim.
   ========================================================================== */
(function () {
  'use strict';

  /* ---------------------------------------------------------------- helpers */
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = (arr) => arr[(Math.random() * arr.length) | 0];

  const params = new URLSearchParams(location.search);
  const STILL = params.get('still') === '1';
  const STILL_T = clamp(parseFloat(params.get('t') || '0') || 0, 0, 600);

  /* ------------------------------------------------------------------ DOM */
  const $ = (id) => document.getElementById(id);
  const stageEl = $('stage');
  const fadeEl = $('fade');
  const capEl = $('caption');
  const capTextEl = $('cap-text');
  const capRefEl = $('cap-ref');
  const titlecardEl = $('titlecard');
  const endcardEl = $('endcard');
  const labelEl = $('act-label');
  const refEl = $('act-ref');
  const sealsEl = $('seals');
  const barEl = $('bar');
  const timeEl = $('time');
  const errEl = $('err');

  function showErr(msg) {
    errEl.style.display = 'block';
    errEl.textContent += (errEl.textContent ? '\n' : '') + msg;
  }
  window.addEventListener('error', (e) => showErr('ERROR: ' + e.message + '\n' + (e.filename || '') + ':' + (e.lineno || '')));
  window.addEventListener('unhandledrejection', (e) => showErr('REJECTION: ' + e.reason));

  const sealDots = [];
  for (let i = 0; i < 7; i++) {
    const s = document.createElement('span');
    sealsEl.appendChild(s);
    sealDots.push(s);
  }

  /* --------------------------------------------------------------- scripture */
  const Q = {
    seal: [
      'And I saw when the Lamb opened one of the seals, and I heard, as it were the noise of thunder, one of the four beasts saying, Come and see.',
      'And when he had opened the second seal, I heard the second beast say, Come and see.',
      'And when he had opened the third seal, I heard the third beast say, Come and see.',
      'And when he had opened the fourth seal, I heard the voice of the fourth beast say, Come and see.'
    ],
    sealRef: ['REVELATION 6:1', 'REVELATION 6:3', 'REVELATION 6:5', 'REVELATION 6:7'],
    horse: [
      'And I saw, and behold a white horse: and he that sat on him had a bow; and a crown was given unto him: and he went forth conquering, and to conquer.',
      'And there went out another horse that was red: and power was given to him that sat thereon to take peace from the earth, and that they should kill one another: and there was given unto him a great sword.',
      'And I beheld, and lo a black horse; and he that sat on him had a pair of balances in his hand. And I heard a voice in the midst of the four beasts say, A measure of wheat for a penny, and three measures of barley for a penny; and see thou hurt not the oil and the wine.',
      'And I looked, and behold a pale horse: and his name that sat on him was Death, and Hell followed with him. And power was given unto them over the fourth part of the earth, to kill with sword, and with hunger, and with death, and with the beasts of the earth.'
    ],
    horseRef: ['REVELATION 6:2', 'REVELATION 6:4', 'REVELATION 6:5–6', 'REVELATION 6:8'],
    finale: 'And power was given unto them over the fourth part of the earth, to kill with sword, and with hunger, and with death, and with the beasts of the earth.'
  };
  const SEAL_LABELS = ['THE FIRST SEAL', 'THE SECOND SEAL', 'THE THIRD SEAL', 'THE FOURTH SEAL'];
  const HORSE_LABELS = ['I · THE WHITE HORSE', 'II · THE RED HORSE', 'III · THE BLACK HORSE', 'IV · THE PALE HORSE'];

  /* --------------------------------------------------------------- renderer */
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.02;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  stageEl.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x05060c);
  scene.fog = new THREE.FogExp2(0x05060c, 0.017);

  const camera = new THREE.PerspectiveCamera(46, window.innerWidth / window.innerHeight, 0.1, 2600);
  camera.position.set(2.5, 4.4, 22);
  const lookAt = new THREE.Vector3(0, 3.1, 0);

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  /* ----------------------------------------------------------------- lights */
  scene.add(new THREE.HemisphereLight(0x3f5070, 0x07080b, 0.9));
  const moonLight = new THREE.DirectionalLight(0xa8bce0, 2.1);
  moonLight.position.set(-14, 18, 7);
  scene.add(moonLight);
  const fillLight = new THREE.DirectionalLight(0x25384f, 0.7);
  fillLight.position.set(12, 6, -9);
  scene.add(fillLight);

  /* --------------------------------------------------------------- textures */
  function canvasTex(w, h, draw) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = renderer.capabilities.getMaxAnisotropy();
    return t;
  }

  const radialTex = canvasTex(128, 128, (x) => {
    const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0.0, 'rgba(255,255,255,1)');
    g.addColorStop(0.28, 'rgba(255,255,255,0.55)');
    g.addColorStop(1.0, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  });

  const sparkTex = canvasTex(64, 64, (x) => {
    const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0.0, 'rgba(255,255,255,1)');
    g.addColorStop(0.25, 'rgba(255,228,180,0.85)');
    g.addColorStop(0.6, 'rgba(255,150,70,0.3)');
    g.addColorStop(1.0, 'rgba(255,120,40,0)');
    x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  });

  const dustTex = canvasTex(64, 64, (x) => {
    const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0.0, 'rgba(255,255,255,0.5)');
    g.addColorStop(0.45, 'rgba(255,255,255,0.2)');
    g.addColorStop(1.0, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  });

  const shadowTex = canvasTex(128, 128, (x) => {
    const g = x.createRadialGradient(64, 64, 4, 64, 64, 62);
    g.addColorStop(0.0, 'rgba(0,0,0,0.9)');
    g.addColorStop(0.55, 'rgba(0,0,0,0.45)');
    g.addColorStop(1.0, 'rgba(0,0,0,0)');
    x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  });

  /* ---------------------------------------------------------------- ground */
  const groundTex = canvasTex(256, 256, (x, w, h) => {
    x.fillStyle = '#2b303b'; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 4200; i++) {
      const a = 0.02 + Math.random() * 0.05;
      x.fillStyle = Math.random() < 0.55 ? 'rgba(0,0,0,' + a + ')' : 'rgba(150,168,192,' + (a * 0.6) + ')';
      x.fillRect(Math.random() * w, Math.random() * h, 1.6, 1.6);
    }
    for (let i = 0; i < 26; i++) {
      const px = Math.random() * w, py = Math.random() * h, r = 12 + Math.random() * 46;
      const g = x.createRadialGradient(px, py, 0, px, py, r);
      g.addColorStop(0, 'rgba(18,21,27,0.16)');
      g.addColorStop(1, 'rgba(18,21,27,0)');
      x.fillStyle = g; x.beginPath(); x.arc(px, py, r, 0, Math.PI * 2); x.fill();
    }
  });
  groundTex.wrapS = groundTex.wrapT = THREE.RepeatWrapping;
  groundTex.repeat.set(140, 140);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(2400, 2400),
    new THREE.MeshStandardMaterial({ map: groundTex, color: 0xb9c0cc, roughness: 0.97, metalness: 0.02 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = 0;
  scene.add(ground);

  /* ---------------------------------------------------------------- stars */
  (function stars() {
    const N = 2600;
    const pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 700 + Math.random() * 900;
      const y = Math.pow(Math.random(), 0.75) * 750 + 12;
      pos[i * 3] = Math.cos(a) * r * (0.6 + Math.random() * 0.4);
      pos[i * 3 + 1] = y;
      pos[i * 3 + 2] = Math.sin(a) * r * (0.6 + Math.random() * 0.4);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const m = new THREE.PointsMaterial({
      color: 0xc6d4f2, size: 1.6, sizeAttenuation: false,
      transparent: true, opacity: 0.75, depthWrite: false, fog: false
    });
    const p = new THREE.Points(g, m);
    scene.add(p);
  })();

  const glowTexture = canvasTex(256, 256, (x) => {
    const g = x.createRadialGradient(128, 128, 0, 128, 128, 128);
    g.addColorStop(0.0, 'rgba(255,255,255,1)');
    g.addColorStop(0.5, 'rgba(255,255,255,0.95)');
    g.addColorStop(0.62, 'rgba(255,255,255,0.75)');
    g.addColorStop(0.7, 'rgba(255,255,255,0)');
    x.fillStyle = g;
    x.beginPath(); x.arc(128, 128, 128, 0, Math.PI * 2); x.fill();
  });

  /* ----------------------------------------------------------------- moon */
  (function moon() {
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: radialTex, color: 0x9fb3d8, transparent: true, opacity: 0.34,
      blending: THREE.AdditiveBlending, depthWrite: false, fog: false
    }));
    glow.scale.set(210, 210, 1);
    glow.position.set(-165, 120, -430);
    scene.add(glow);
    const disc = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTexture, color: 0xe8eefb, transparent: true, opacity: 0.92,
      depthWrite: false, fog: false
    }));
    disc.scale.set(46, 46, 1);
    disc.position.set(-165, 120, -430);
    scene.add(disc);
  })();

  /* ------------------------------------------------------------- particles */
  class Pool {
    constructor(n, tex, size, colorHex, blending, gravity, drag) {
      this.n = n;
      this.base = new THREE.Color(colorHex);
      this.pos = new Float32Array(n * 3);
      this.col = new Float32Array(n * 3);
      this.vel = new Float32Array(n * 3);
      this.life = new Float32Array(n);
      this.maxLife = new Float32Array(n);
      this.gravity = gravity;
      this.drag = drag;
      for (let i = 0; i < n; i++) this.pos[i * 3 + 1] = -600;
      this.geo = new THREE.BufferGeometry();
      this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
      this.geo.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
      this.mat = new THREE.PointsMaterial({
        map: tex, size, transparent: true, depthWrite: false,
        blending, vertexColors: true, sizeAttenuation: true, alphaTest: 0.002
      });
      this.points = new THREE.Points(this.geo, this.mat);
      this.points.frustumCulled = false;
      this.cursor = 0;
      scene.add(this.points);
    }
    spawn(px, py, pz, vx, vy, vz, life) {
      const i = this.cursor;
      this.cursor = (this.cursor + 1) % this.n;
      const j = i * 3;
      this.pos[j] = px; this.pos[j + 1] = py; this.pos[j + 2] = pz;
      this.vel[j] = vx; this.vel[j + 1] = vy; this.vel[j + 2] = vz;
      this.life[i] = life; this.maxLife[i] = life;
      this.col[j] = this.base.r * 0.2;
      this.col[j + 1] = this.base.g * 0.2;
      this.col[j + 2] = this.base.b * 0.2;
    }
    burst(p, count, spdMin, spdMax, lifeMin, lifeMax) {
      for (let k = 0; k < count; k++) {
        const theta = Math.random() * Math.PI * 2;
        const up = rand(-0.55, 1);
        const s = rand(spdMin, spdMax);
        this.spawn(
          p.x + rand(-0.12, 0.12), p.y + rand(-0.12, 0.12), p.z + rand(-0.12, 0.12),
          Math.cos(theta) * s * 0.9, up * s, Math.sin(theta) * s * 0.9,
          rand(lifeMin, lifeMax)
        );
      }
    }
    update(dt) {
      const pos = this.pos, col = this.col, vel = this.vel;
      const damp = Math.pow(this.drag, dt * 60);
      for (let i = 0; i < this.n; i++) {
        const l = this.life[i];
        if (l <= 0) continue;
        const nl = l - dt;
        const j = i * 3;
        if (nl <= 0) {
          this.life[i] = 0;
          pos[j + 1] = -600;
          col[j] = col[j + 1] = col[j + 2] = 0;
          continue;
        }
        this.life[i] = nl;
        vel[j] *= damp; vel[j + 1] *= damp; vel[j + 2] *= damp;
        vel[j + 1] += this.gravity * dt;
        pos[j] += vel[j] * dt;
        pos[j + 1] += vel[j + 1] * dt;
        pos[j + 2] += vel[j + 2] * dt;
        const k = nl / this.maxLife[i];
        const f = this.gravity < -1
          ? Math.pow(k, 0.7)
          : Math.sin(Math.PI * clamp(k, 0, 1));
        col[j] = this.base.r * f;
        col[j + 1] = this.base.g * f;
        col[j + 2] = this.base.b * f;
      }
      this.geo.attributes.position.needsUpdate = true;
      this.geo.attributes.color.needsUpdate = true;
    }
  }

  const dust = new Pool(360, dustTex, 0.26, 0x5f6672, THREE.NormalBlending, 0.25, 0.985);
  const sparks = new Pool(260, sparkTex, 0.11, 0xffb066, THREE.AdditiveBlending, -5.2, 0.96);
  const embers = new Pool(220, sparkTex, 0.095, 0xff6a26, THREE.AdditiveBlending, 0.5, 0.99);

  /* ---------------------------------------------------------------- flashes */
  const flashes = [];
  function flashAt(p, size) {
    const spr = new THREE.Sprite(new THREE.SpriteMaterial({
      map: sparkTex, color: 0xffcf96, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false
    }));
    spr.position.copy(p);
    spr.scale.set(0.4, 0.4, 1);
    scene.add(spr);
    flashes.push({ spr, t: 0, dur: 0.8, size: size || 4.2 });
  }
  function updateFlashes(dt) {
    for (let i = flashes.length - 1; i >= 0; i--) {
      const f = flashes[i];
      f.t += dt;
      const k = f.t / f.dur;
      if (k >= 1) {
        scene.remove(f.spr);
        f.spr.material.dispose();
        flashes.splice(i, 1);
        continue;
      }
      const s = f.size * (0.25 + k * 2.6);
      f.spr.scale.set(s, s, 1);
      f.spr.material.opacity = Math.pow(1 - k, 1.7) * 0.95;
    }
  }

  /* ------------------------------------------------------------- the scroll */
  const scrollGroup = new THREE.Group();
  scrollGroup.position.set(0, 3.1, 0);
  scene.add(scrollGroup);

  const parchmentTex = canvasTex(1024, 1440, (x, w, h) => {
    const bg = x.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, '#c8b68d');
    bg.addColorStop(0.42, '#d9caa4');
    bg.addColorStop(1, '#b3a077');
    x.fillStyle = bg; x.fillRect(0, 0, w, h);

    for (let i = 0; i < 1500; i++) {
      const r = 2 + Math.random() * 26;
      const a = Math.random() * 0.055;
      x.fillStyle = Math.random() < 0.5 ? 'rgba(116,90,52,' + a + ')' : 'rgba(255,248,226,' + a + ')';
      x.beginPath(); x.arc(Math.random() * w, Math.random() * h, r, 0, Math.PI * 2); x.fill();
    }
    const vg = x.createRadialGradient(w / 2, h / 2, 280, w / 2, h / 2, 930);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(0.75, 'rgba(48,32,14,0.18)');
    vg.addColorStop(1, 'rgba(38,24,10,0.55)');
    x.fillStyle = vg; x.fillRect(0, 0, w, h);

    // pseudo-script
    x.lineCap = 'round';
    x.strokeStyle = '#3a2b17';
    for (let row = 0; row < 18; row++) {
      const y = 118 + row * 66 + rand(-3, 3);
      let px = 92;
      while (px < 760) {
        const wd = 5 + Math.random() * 25;
        x.globalAlpha = 0.16 + Math.random() * 0.22;
        x.lineWidth = 1 + Math.random() * 1.3;
        x.beginPath();
        x.moveTo(px, y + rand(-1.4, 1.4));
        x.lineTo(px + wd, y + rand(-1.4, 1.4));
        x.stroke();
        px += wd + 4 + Math.random() * 9;
      }
    }
    x.globalAlpha = 1;

    // fold hint before the seal margin
    const fold = x.createLinearGradient(690, 0, 790, 0);
    fold.addColorStop(0, 'rgba(60,40,20,0)');
    fold.addColorStop(0.5, 'rgba(60,40,20,0.12)');
    fold.addColorStop(1, 'rgba(60,40,20,0)');
    x.fillStyle = fold; x.fillRect(690, 0, 100, h);
  });

  const sealDefs = [];

  (function buildScroll() {
    const geo = new THREE.PlaneGeometry(3.7, 5.2, 38, 28);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i);
      const u = x / 3.7 + 0.5, v = y / 5.2 + 0.5;
      let z = Math.sin(u * Math.PI * 1.15) * 0.09 + Math.sin(v * Math.PI * 3) * 0.015;
      const edge = Math.min(u, 1 - u);
      if (edge < 0.035) {
        z += rand(-0.045, 0.045);
        pos.setX(i, x + rand(-0.02, 0.02));
      }
      pos.setZ(i, z);
    }
    geo.computeVertexNormals();
    const paper = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
      map: parchmentTex, roughness: 0.93, metalness: 0.0, side: THREE.DoubleSide
    }));
    scrollGroup.add(paper);

    // rods
    const rodMat = new THREE.MeshStandardMaterial({ color: 0x3a2a1c, roughness: 0.72, metalness: 0.05 });
    [-1, 1].forEach((sy) => {
      const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 3.98, 10), rodMat);
      rod.rotation.z = Math.PI / 2;
      rod.position.set(0, sy * 2.62, 0.02);
      scrollGroup.add(rod);
      [-1, 1].forEach((sx) => {
        const cap = new THREE.Mesh(new THREE.SphereGeometry(0.095, 10, 8), new THREE.MeshStandardMaterial({
          color: 0x8a6a3f, roughness: 0.4, metalness: 0.7
        }));
        cap.position.set(sx * 2.0, sy * 2.62, 0.02);
        scrollGroup.add(cap);
      });
    });

    // warm candle + cool rim, scoped to the scroll (hidden lights cost nothing)
    const candle = new THREE.PointLight(0xffd7a0, 30, 11, 2);
    candle.position.set(1.6, 0.8, 2.6);
    scrollGroup.add(candle);
    const rim = new THREE.PointLight(0x6f8fbe, 22, 12, 2);
    rim.position.set(-2.2, 0.5, -2.0);
    scrollGroup.add(rim);

    // the seven seals
    const waxMat = new THREE.MeshStandardMaterial({ color: 0x56120d, roughness: 0.52, metalness: 0.05 });
    const waxRimMat = new THREE.MeshStandardMaterial({ color: 0x2c0805, roughness: 0.62 });
    const sigilMat = new THREE.MeshStandardMaterial({ color: 0x1b0504, roughness: 0.85 });
    for (let i = 0; i < 7; i++) {
      const sg = new THREE.Group();
      sg.position.set(1.36, 2.12 - i * 0.72, 0.09);
      const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.272, 0.08, 22), waxMat);
      disc.rotation.x = Math.PI / 2;
      sg.add(disc);
      const rimT = new THREE.Mesh(new THREE.TorusGeometry(0.236, 0.027, 8, 26), waxRimMat);
      rimT.position.z = 0.041;
      sg.add(rimT);
      const sig = new THREE.Mesh(new THREE.IcosahedronGeometry(0.072, 0), sigilMat);
      sig.position.z = 0.052;
      sg.add(sig);

      const hole = new THREE.Group();
      const hd = new THREE.Mesh(new THREE.CircleGeometry(0.243, 24), new THREE.MeshBasicMaterial({ color: 0x080402 }));
      const hr = new THREE.Mesh(new THREE.TorusGeometry(0.243, 0.014, 6, 28), new THREE.MeshStandardMaterial({
        color: 0x2a0c07, emissive: 0xff7a33, emissiveIntensity: 2.2, roughness: 0.5
      }));
      hole.add(hd); hole.add(hr);
      const holeGlow = new THREE.Sprite(new THREE.SpriteMaterial({
        map: sparkTex, color: 0xff9a4a, transparent: true, opacity: 0.6,
        blending: THREE.AdditiveBlending, depthWrite: false
      }));
      holeGlow.scale.set(0.9, 0.9, 1);
      holeGlow.position.z = 0.06;
      hole.add(holeGlow);
      hole.position.z = 0.03;
      hole.visible = false;
      const emberLight = new THREE.PointLight(0xff7a2a, 1.6, 1.4, 2);
      emberLight.position.set(0, 0, 0.28);
      hole.add(emberLight);
      sg.add(hole);

      scrollGroup.add(sg);
      sealDefs.push({ group: sg, disc, rim: rimT, sig, hole, ring: hr, broken: false });
    }

    const glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: radialTex, color: 0xffcf96, transparent: true, opacity: 0.10,
      blending: THREE.AdditiveBlending, depthWrite: false
    }));
    glow.scale.set(8.5, 10, 1);
    glow.position.set(0, 0, -0.6);
    scrollGroup.add(glow);
  })();

  function breakSeal(i) {
    const s = sealDefs[i];
    if (!s || s.broken) return;
    s.broken = true;
    scene.updateMatrixWorld(true);
    const wp = new THREE.Vector3();
    s.group.getWorldPosition(wp);
    s.disc.visible = false;
    s.rim.visible = false;
    s.sig.visible = false;
    s.hole.visible = true;
    s.group.scale.set(1, 1, 1);
    sparks.burst(wp, 46, 1.4, 4.2, 0.5, 1.15);
    flashAt(wp, 4.6);
    shakeAmt = Math.min(1.4, shakeAmt + 0.85);
    if (sealDots[i]) sealDots[i].classList.add('broken');
    audio.boom();
  }

  /* ---------------------------------------------------------------- horses */
  const HORSE_CFG = [
    {
      body: 0xe4e7ec, mane: 0xf6f7fa, aura: 0xdfe6ff, eye: 0xffffff,
      robe: 0xe9e2cf, accent: 0x8b6b3f, prop: 'bow', crown: true, death: false, gait: 8.2
    },
    {
      body: 0x7d1a10, mane: 0x1a0504, aura: 0xff4a22, eye: 0xffb15a,
      robe: 0x2a0b08, accent: 0x45120c, prop: 'sword', crown: false, death: false, gait: 9.0
    },
    {
      body: 0x1c1d23, mane: 0x050508, aura: 0x7e8cff, eye: 0xffd27a,
      robe: 0x14161c, accent: 0x282b33, prop: 'scales', crown: false, death: false, gait: 7.6
    },
    {
      body: 0xc2ccb1, mane: 0xdde3cd, aura: 0x9fe6b0, eye: 0xa8ffd0,
      robe: 0x0c0e0b, accent: 0x1b2017, prop: 'none', crown: false, death: true, gait: 7.0
    }
  ];

  function makeHorse(cfg) {
    const root = new THREE.Group();
    const body = new THREE.Group();
    root.add(body);

    const mat = (c, r, m) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m || 0 });
    const bodyMat = mat(cfg.body, 0.58, 0.06);
    const maneMat = mat(cfg.mane, 0.9, 0);
    const leatherMat = mat(0x2c2118, 0.9, 0);
    const goldMat = new THREE.MeshStandardMaterial({ color: 0xd2ab30, roughness: 0.28, metalness: 0.9, emissive: 0x3a2500, emissiveIntensity: 0.6 });
    const steelMat = mat(0xc4cedb, 0.18, 0.94);
    const skinMat = mat(0xc7ab8e, 0.8, 0);
    const robeMat = mat(cfg.robe, 0.86, 0);
    const accentMat = mat(cfg.accent, 0.9, 0);
    const eyeMat = new THREE.MeshStandardMaterial({
      color: 0x050505, emissive: cfg.eye, emissiveIntensity: cfg.death ? 4.2 : 1.9, roughness: 0.4
    });

    // --- torso
    const torso = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), bodyMat);
    torso.scale.set(1.22, 0.64, 0.52);
    torso.position.set(0, 1.44, 0);
    body.add(torso);

    const chest = new THREE.Mesh(new THREE.SphereGeometry(0.55, 16, 12), bodyMat);
    chest.scale.set(1.0, 0.92, 0.92);
    chest.position.set(0.78, 1.45, 0);
    body.add(chest);

    const rump = new THREE.Mesh(new THREE.SphereGeometry(0.56, 16, 12), bodyMat);
    rump.scale.set(0.98, 0.95, 0.95);
    rump.position.set(-0.8, 1.44, 0);
    body.add(rump);

    // --- neck
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.34, 0.95, 12), bodyMat);
    neck.position.set(1.44, 1.88, 0);
    neck.rotation.z = -0.78;
    body.add(neck);

    // --- head
    const headG = new THREE.Group();
    headG.position.set(1.79, 2.23, 0);
    headG.rotation.z = -0.12;
    body.add(headG);

    const skull = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), bodyMat);
    skull.scale.set(0.38, 0.28, 0.25);
    skull.position.set(0.06, 0, 0);
    headG.add(skull);

    const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.16, 0.22), bodyMat);
    jaw.position.set(0.24, -0.13, 0);
    jaw.rotation.z = 0.08;
    headG.add(jaw);

    const muzzle = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.15, 0.42, 8), bodyMat);
    muzzle.rotation.z = -Math.PI / 2;
    muzzle.position.set(0.4, -0.04, 0);
    headG.add(muzzle);

    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), maneMat);
    nose.scale.set(0.8, 0.75, 0.85);
    nose.position.set(0.6, -0.05, 0);
    headG.add(nose);

    [-1, 1].forEach((s) => {
      const ear = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.2, 5), bodyMat);
      ear.position.set(0.0, 0.25, s * 0.1);
      ear.rotation.z = 0.16;
      ear.rotation.x = s * 0.16;
      headG.add(ear);

      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.028, 8, 8), eyeMat);
      eye.position.set(0.27, 0.05, s * 0.2);
      headG.add(eye);
    });

    // --- mane
    for (let i = 0; i < 7; i++) {
      const t = i / 6;
      const tuft = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.3, 5), maneMat);
      tuft.position.set(0.97 + t * 0.62, 1.79 + t * 0.63, 0);
      tuft.rotation.z = -1.0 + Math.sin(t * 3) * 0.08;
      tuft.scale.z = 0.5;
      body.add(tuft);
    }

    // --- tail
    const tailG = new THREE.Group();
    tailG.position.set(-1.26, 1.62, 0);
    body.add(tailG);
    const tailMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.13, 1.0, 8), maneMat);
    tailMesh.position.set(-0.44, -0.2, 0);
    tailMesh.rotation.z = 1.28;
    tailG.add(tailMesh);
    const tuft = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.55, 7), maneMat);
    tuft.position.set(-0.9, -0.55, 0);
    tuft.rotation.z = 1.45;
    tailG.add(tuft);

    // --- saddle
    const blanket = new THREE.Mesh(new THREE.BoxGeometry(0.88, 0.045, 0.7), accentMat);
    blanket.position.set(0.1, 2.02, 0);
    body.add(blanket);
    const saddle = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.1, 0.6), leatherMat);
    saddle.position.set(0.12, 2.09, 0);
    body.add(saddle);

    // --- legs
    const legs = [];
    const legDefs = [
      { x: 0.82, z: 0.34, phase: 0.0 },
      { x: 0.82, z: -0.34, phase: 0.16 },
      { x: -0.86, z: 0.36, phase: Math.PI },
      { x: -0.86, z: -0.36, phase: Math.PI + 0.16 }
    ];
    legDefs.forEach((d) => {
      const leg = new THREE.Group();
      leg.position.set(d.x, 1.3, d.z);
      const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.075, 0.62, 8), bodyMat);
      upper.position.y = -0.31;
      leg.add(upper);
      const lowerG = new THREE.Group();
      lowerG.position.y = -0.62;
      leg.add(lowerG);
      const lower = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.05, 0.58, 8), bodyMat);
      lower.position.y = -0.29;
      lowerG.add(lower);
      const hoof = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.12, 0.16), maneMat);
      hoof.position.set(0.015, -0.62, 0);
      lowerG.add(hoof);
      leg.userData = { phase: d.phase, lower: lowerG };
      root.add(leg);
      legs.push(leg);
    });

    // --- reins
    const reinGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0.5, 2.52, 0.2),
      new THREE.Vector3(1.86, 2.2, 0.08)
    ]);
    body.add(new THREE.Line(reinGeo, new THREE.LineBasicMaterial({ color: 0x1d1610 })));

    // --- rider
    const rider = new THREE.Group();
    rider.position.set(0.1, 2.12, 0);
    body.add(rider);

    const pelvis = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.2, 0.42), robeMat);
    pelvis.position.y = 0.06;
    rider.add(pelvis);

    const torsoR = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.25, 0.6, 10), robeMat);
    torsoR.position.set(0.02, 0.44, 0);
    torsoR.rotation.z = -0.1;
    rider.add(torsoR);

    const shoulders = new THREE.Mesh(new THREE.BoxGeometry(0.27, 0.14, 0.46), robeMat);
    shoulders.position.set(0.02, 0.72, 0);
    rider.add(shoulders);

    // thighs on the flanks
    [-1, 1].forEach((s) => {
      const thigh = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.06, 0.55, 8), robeMat);
      thigh.position.set(0.0, -0.14, s * 0.26);
      thigh.rotation.x = s * 0.12;
      rider.add(thigh);
    });

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.135, 14, 12), skinMat);
    head.position.set(0.05, 0.9, 0);
    head.scale.set(1, 1.1, 0.9);
    rider.add(head);

    // arms
    const arms = [];
    [-1, 1].forEach((s) => {
      const armG = new THREE.Group();
      const armMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.042, 0.5, 8), robeMat);
      armMesh.position.y = -0.25;
      armG.add(armMesh);
      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 8), skinMat);
      hand.position.y = -0.52;
      armG.add(hand);
      armG.position.set(0.06, 0.66, s * 0.21);
      armG.rotation.z = s > 0 ? 1.28 : 0.95;
      armG.rotation.x = s > 0 ? 0.18 : -0.32;
      rider.add(armG);
      arms.push(armG);
    });

    // headwear / face
    if (cfg.death) {
      const cloth = new THREE.MeshStandardMaterial({ color: 0x0a0b09, roughness: 1, side: THREE.FrontSide });
      const cloak = new THREE.Mesh(new THREE.ConeGeometry(0.46, 1.38, 12, 1, true), cloth);
      cloak.position.set(-0.02, 0.3, 0);
      rider.add(cloak);
      const hood = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.44, 10, 1, true), cloth);
      hood.position.set(0.03, 0.97, 0);
      hood.rotation.z = -0.12;
      rider.add(hood);
      const face = new THREE.Mesh(new THREE.SphereGeometry(0.115, 12, 10), new THREE.MeshStandardMaterial({ color: 0x000000 }));
      face.position.set(0.12, 0.9, 0);
      rider.add(face);
      [-1, 1].forEach((s) => {
        const glowEye = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 8), eyeMat);
        glowEye.position.set(0.19, 0.91, s * 0.05);
        rider.add(glowEye);
      });
    } else {
      const hood = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.34, 9, 1, true), accentMat);
      hood.position.set(-0.02, 1.0, 0);
      hood.rotation.z = -0.16;
      rider.add(hood);
      if (cfg.crown) {
        const band = new THREE.Mesh(new THREE.CylinderGeometry(0.105, 0.12, 0.09, 9, 1, true), goldMat);
        band.position.set(0.05, 1.045, 0);
        rider.add(band);
        for (let k = 0; k < 5; k++) {
          const a = (k / 5) * Math.PI * 2;
          const spike = new THREE.Mesh(new THREE.ConeGeometry(0.028, 0.13, 4), goldMat);
          spike.position.set(0.05 + Math.cos(a) * 0.105, 1.11, Math.sin(a) * 0.105);
          rider.add(spike);
        }
      }
    }

    // cape
    if (!cfg.death) {
      const cape = new THREE.Mesh(
        new THREE.ConeGeometry(0.38, 0.72, 10, 1, true),
        new THREE.MeshStandardMaterial({ color: cfg.accent, roughness: 0.92, side: THREE.DoubleSide })
      );
      cape.position.set(-0.05, 0.46, 0);
      rider.add(cape);
    }

    // --- props
    if (cfg.prop === 'bow') {
      const bowG = new THREE.Group();
      bowG.position.set(0.5, 0.2, 0.48);
      bowG.rotation.y = 1.2;
      bowG.rotation.x = 0.3;
      bowG.rotation.z = 0.1;
      const R = 0.38;
      const A = Math.PI * 0.9;
      const bowMesh = new THREE.Mesh(new THREE.TorusGeometry(R, 0.01, 4, 20, A), mat(0x5a3d22, 0.75, 0.05));
      bowG.add(bowMesh);
      const p0 = new THREE.Vector3(R, 0, 0);
      const p1 = new THREE.Vector3(R * Math.cos(A), R * Math.sin(A), 0);
      bowG.add(new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([p0, p1]),
        new THREE.LineBasicMaterial({ color: 0x2a2017 })
      ));
      rider.add(bowG);
      // quiver of arrows, slung at the hip
      const quiver = new THREE.Group();
      quiver.position.set(-0.12, 0.1, 0.29);
      quiver.rotation.z = -0.32;
      quiver.rotation.x = 0.12;
      const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.075, 0.46, 8), leatherMat);
      quiver.add(tube);
      for (let k = 0; k < 3; k++) {
        const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.42, 4), mat(0x8a6a44, 0.7));
        shaft.position.set((k - 1) * 0.032, 0.23, (k % 2) * 0.025);
        quiver.add(shaft);
        const fletch = new THREE.Mesh(new THREE.ConeGeometry(0.024, 0.09, 4), mat(0xd8d2c4, 0.85));
        fletch.position.set((k - 1) * 0.032, 0.42, (k % 2) * 0.025);
        quiver.add(fletch);
      }
      rider.add(quiver);
    } else if (cfg.prop === 'sword') {
      const sword = new THREE.Group();
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.96, 0.11), steelMat);
      blade.position.y = 0.52;
      const guard = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.03, 0.13), goldMat);
      guard.position.y = 0.02;
      const hilt = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.22, 8), leatherMat);
      hilt.position.y = -0.1;
      sword.add(blade, guard, hilt);
      sword.position.set(0.44, 0.5, -0.3);
      sword.rotation.z = -0.15;
      rider.add(sword);
    } else if (cfg.prop === 'scales') {
      const scales = new THREE.Group();
      const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.56, 6), goldMat);
      rod.position.y = 0.04;
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.022, 0.022), goldMat);
      bar.position.y = 0.32;
      scales.add(rod, bar);
      [-1, 1].forEach((s) => {
        const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.2, 5), goldMat);
        chain.position.set(s * 0.235, 0.21, 0);
        const pan = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.012, 12), goldMat);
        pan.position.set(s * 0.235, 0.1, 0);
        scales.add(chain, pan);
      });
      scales.position.set(0.44, 0.52, -0.3);
      scales.rotation.z = 0.16;
      rider.add(scales);
    }

    // --- aura lighting: rim from behind, soft fill from the front
    const rimLight = new THREE.PointLight(cfg.aura, cfg.death ? 30 : 22, 16, 2);
    rimLight.position.set(-1.9, 3.5, -2.1);
    root.add(rimLight);
    const fillGlow = new THREE.PointLight(cfg.aura, 12, 9, 2);
    fillGlow.position.set(1.4, 1.4, 2.0);
    root.add(fillGlow);

    const shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(5.0, 3.0),
      new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, opacity: 0.5, depthWrite: false, color: 0x000000 })
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.set(0.15, 0.015, 0);
    root.add(shadow);

    const state = { phase: rand(0, 6.28) };
    root.userData.update = (dt) => {
      state.phase += dt * cfg.gait;
      const p = state.phase;
      for (let i = 0; i < legs.length; i++) {
        const L = legs[i];
        const ph = p + L.userData.phase;
        const s = Math.sin(ph);
        L.rotation.z = s * 0.62;
        L.userData.lower.rotation.z = -0.22 - Math.max(0, Math.sin(ph + 1.9)) * 0.9;
      }
      body.position.y = Math.abs(Math.sin(p)) * 0.05;
      body.rotation.z = Math.sin(p) * 0.012;
      headG.rotation.z = -0.14 + Math.sin(2 * p + 0.4) * 0.07;
      tailG.rotation.y = Math.sin(state.phase * 0.28 + 1) * 0.14;
      tailG.rotation.z = Math.sin(state.phase * 0.19) * 0.08;
    };

    root.visible = false;
    scene.add(root);
    return { group: root, update: root.userData.update };
  }

  const horses = HORSE_CFG.map(makeHorse);

  function setHorseVisibility(mode) {
    horses.forEach((h, i) => { h.group.visible = (mode === 9) || (mode === i); });
  }

  /* ------------------------------------------------------------- timeline */
  const TOTAL_SEAL_DUR = 4.4;
  const HORSE_DUR = [10.9, 10.9, 12.6, 12.6];
  const TITLE_DUR = 7.2;
  const FINALE_DUR = 16.0;
  const LANES = [6.4, 2.1, -2.1, -6.4];

  const SHOTS = [
    { a: [5.2, 1.15, 6.6], b: [3.4, 1.95, 4.6], look: [0.35, 1.95, 0], yaw: -0.32 },
    { a: [-2.4, 1.25, 7.6], b: [1.9, 2.15, 6.2], look: [0.15, 1.85, 0], yaw: 0.18 },
    { a: [6.0, 1.05, 2.4], b: [4.2, 1.55, 0.9], look: [0.25, 1.7, 0], yaw: 0.06 },
    { a: [5.0, 1.2, -5.8], b: [2.9, 2.15, -7.6], look: [0.15, 1.95, -0.2], yaw: 0.62 }
  ];

  const SEGMENTS = [];
  let cursor = 0;
  function segment(dur, enter, update, exit) {
    SEGMENTS.push({ start: cursor, dur, enter, update, exit });
    cursor += dur;
  }

  function setLabel(text, ref) {
    labelEl.textContent = text;
    refEl.textContent = ref || '';
  }
  function showCaption(text, ref) {
    if (!text) { capEl.classList.remove('on'); return; }
    capTextEl.textContent = '\u201C' + text + '\u201D';
    capRefEl.textContent = ref || '';
    capEl.classList.add('on');
  }
  function hideCaption() { capEl.classList.remove('on'); }
  function setTitleCard(on) { titlecardEl.classList.toggle('off', !on); }

  /* --- title --- */
  segment(TITLE_DUR,
    () => {
      scrollGroup.visible = false;
      setHorseVisibility(-1);
      activeMode = -1;
      setLabel('REVELATION', 'KING JAMES VERSION');
      hideCaption();
      setTitleCard(true);
    },
    (lt) => {
      const k = smooth(lt / (TITLE_DUR * 0.95));
      camera.position.set(lerp(4.0, 1.4, k), lerp(5.0, 4.3, k), lerp(26.0, 18.0, k));
      lookAt.set(lerp(-2.0, -4.0, k), lerp(5.0, 5.4, k), -20);
    },
    () => { setTitleCard(false); titlecardEl.style.visibility = 'hidden'; }
  );

  /* --- four seal / rider pairs --- */
  for (let i = 0; i < 4; i++) {
    let broken = false;
    segment(TOTAL_SEAL_DUR,
      () => {
        scrollGroup.visible = true;
        setHorseVisibility(-1);
        activeMode = -1;
        setLabel(SEAL_LABELS[i], Q.sealRef[i]);
        hideCaption();
        broken = false;
      },
      (lt) => {
        const k = smooth(lt / (TOTAL_SEAL_DUR * 0.9));
        const dir = i % 2 === 0 ? 1 : -1;
        camera.position.set(lerp(0.72 * dir, 0.26 * dir, k), lerp(3.02, 3.12, k), lerp(8.3, 6.9, k));
        lookAt.set(lerp(0.04, 0.12, k), 3.13, 0);
        scrollGroup.rotation.y = lerp(-0.14, -0.05, k);
        if (!broken && lt >= 1.55) {
          broken = true;
          breakSeal(i);
          showCaption(Q.seal[i], Q.sealRef[i]);
        }
        if (!broken && sealDefs[i]) {
          const pulse = 1 + 0.035 * Math.sin(lt * 9);
          sealDefs[i].group.scale.set(pulse, pulse, pulse);
        }
      },
      () => hideCaption()
    );

    segment(HORSE_DUR[i],
      () => {
        scrollGroup.visible = false;
        setHorseVisibility(i);
        activeMode = i;
        const h = horses[i];
        h.group.position.set(0, 0, 0);
        h.group.rotation.set(0, SHOTS[i].yaw, 0);
        setLabel(HORSE_LABELS[i], Q.horseRef[i]);
        showCaption(Q.horse[i], Q.horseRef[i]);
        shakeAmt = Math.max(shakeAmt, 0.25);
        audio.boom();
      },
      (lt) => {
        const k = smooth(lt / (HORSE_DUR[i] * 0.94));
        const S = SHOTS[i];
        camera.position.set(
          lerp(S.a[0], S.b[0], k) + Math.sin(lt * 0.5) * 0.16,
          lerp(S.a[1], S.b[1], k) + Math.cos(lt * 0.42) * 0.06,
          lerp(S.a[2], S.b[2], k)
        );
        lookAt.set(S.look[0], S.look[1], S.look[2]);
        horses[i].group.rotation.y = S.yaw + Math.sin(lt * 0.4) * 0.055;
        horses[i].group.rotation.z = Math.sin(lt * 0.33) * 0.008;
      },
      () => hideCaption()
    );
  }

  /* --- finale --- */
  let finaleCapShown = false;
  segment(FINALE_DUR,
    () => {
      scrollGroup.visible = false;
      setHorseVisibility(9);
      activeMode = 9;
      horses.forEach((h, i) => {
        h.group.position.set(0, 0, LANES[i]);
        h.group.rotation.set(0, 0.05 + (i - 1.5) * 0.035, 0);
      });
      setLabel('THE FOUR HORSEMEN', 'REVELATION 6:1–8');
      hideCaption();
      finaleCapShown = false;
      shakeAmt = Math.max(shakeAmt, 0.35);
      audio.boom();
    },
    (lt) => {
      const k = smooth(lt / (FINALE_DUR * 0.9));
      camera.position.set(lerp(10.6, 8.4, k), lerp(3.7, 3.1, k), lerp(15.2, 12.2, k));
      lookAt.set(0, 1.9, lerp(0.2, 0.4, k));
      if (!finaleCapShown && lt > 1.4) {
        finaleCapShown = true;
        showCaption(Q.finale, 'REVELATION 6:8');
      }
      horses.forEach((h, i) => {
        h.group.rotation.y = 0.05 + (i - 1.5) * 0.035 + Math.sin(lt * 0.35 + i) * 0.035;
      });
    },
    () => hideCaption()
  );

  const total = cursor;

  /* ------------------------------------------------------------------ misc */
  let globalTime = 0;
  let segIdx = -1;
  let shakeAmt = 0;
  let fadeAlpha = 1;
  let activeMode = -1;
  let running = false;
  let paused = false;
  let ended = false;
  let lastT = 0;
  let hoofTimer = 0;

  function fmt(t) {
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60);
    return m + ':' + String(s).padStart(2, '0');
  }

  function endSequence() {
    if (ended) return;
    ended = true;
    hideCaption();
    endcardEl.classList.add('on');
    document.body.classList.add('ended');
  }

  function updateSegments() {
    if (globalTime >= total) {
      endSequence();
    }
    let idx = 0;
    for (let i = 0; i < SEGMENTS.length; i++) {
      if (globalTime >= SEGMENTS[i].start) idx = i;
    }
    const seg = SEGMENTS[idx];
    const lt = globalTime - seg.start;

    if (idx !== segIdx) {
      const prev = SEGMENTS[segIdx];
      if (prev && prev.exit) prev.exit();
      segIdx = idx;
      fadeAlpha = 1;
      if (seg.enter) seg.enter();
    }
    if (seg.update) seg.update(lt, globalTime);
  }

  function emitDustFor(h) {
    const z0 = h.group.position.z;
    const bases = [
      [0.82, 0.1, 0.34], [0.82, 0.1, -0.34],
      [-0.86, 0.1, 0.36], [-0.86, 0.1, -0.36]
    ];
    const b = pick(bases);
    dust.spawn(
      b[0] + rand(-0.14, 0.14), rand(0.04, 0.24), z0 + b[2] + rand(-0.12, 0.12),
      rand(-3.4, -1.5), rand(0.35, 1.25), rand(-0.8, 0.8),
      rand(0.75, 1.35)
    );
  }

  function emitEmbers(z0) {
    z0 = z0 || 0;
    embers.spawn(
      rand(-3.4, -1.2), rand(0.15, 1.4), z0 + rand(-1.7, 1.7),
      rand(-1.6, -0.5), rand(0.5, 1.4), rand(-0.5, 0.5),
      rand(1.2, 2.4)
    );
  }

  function applyShakeAndLook() {
    camera.lookAt(lookAt);
    if (shakeAmt > 0.001) {
      camera.position.x += Math.sin(globalTime * 43.1) * 0.035 * shakeAmt;
      camera.position.y += Math.cos(globalTime * 37.7) * 0.028 * shakeAmt;
      camera.rotation.z += Math.sin(globalTime * 29.3) * 0.012 * shakeAmt;
    }
  }

  function step(dt) {
    if (paused || ended) {
      if (ended) endSequence();
      return;
    }
    globalTime += dt;
    updateSegments();

    // horses
    for (const h of horses) if (h.group.visible) h.update(dt);

    // dust & embers
    if (activeMode >= 0 && activeMode <= 3) {
      emitDustFor(horses[activeMode]);
      if (horses[activeMode] === horses[3]) emitEmbers(horses[3].group.position.z);
    } else if (activeMode === 9) {
      horses.forEach((h) => { if (h.group.visible) emitDustFor(h); });
      emitEmbers(horses[3].group.position.z);
    }

    dust.update(dt);
    sparks.update(dt);
    embers.update(dt);
    updateFlashes(dt);

    shakeAmt = Math.max(0, shakeAmt - dt * 2.2);
    fadeAlpha = Math.max(0, fadeAlpha - dt * 2.4);
    fadeEl.style.opacity = fadeAlpha.toFixed(3);

    applyShakeAndLook();

    barEl.style.transform = 'scaleX(' + clamp(globalTime / total, 0, 1).toFixed(5) + ')';
    timeEl.textContent = fmt(Math.min(globalTime, total)) + ' / ' + fmt(total);

    audio.tick(activeMode, dt);
  }

  function renderFrame() {
    renderer.render(scene, camera);
  }

  function frame(now) {
    if (!lastT) lastT = now;
    let dt = (now - lastT) / 1000;
    lastT = now;
    dt = clamp(dt, 0.001, 0.05);
    if (running) step(dt);
    renderFrame();
  }

  /* ----------------------------------------------------------------- audio */
  const audio = (() => {
    let ctx = null, master = null, noiseBuf = null;
    let started = false, enabled = true;

    function init() {
      if (started) return;
      started = true;
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) { enabled = false; return; }
        ctx = new AC();
        master = ctx.createGain();
        master.gain.value = 0.85;
        master.connect(ctx.destination);

        noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
        const d = noiseBuf.getChannelData(0);
        let last = 0;
        for (let i = 0; i < d.length; i++) {
          const white = Math.random() * 2 - 1;
          last = last * 0.97 + white * 0.03;
          d[i] = last * 3.4;
        }

        // wind
        const wind = ctx.createBufferSource();
        wind.buffer = noiseBuf; wind.loop = true;
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass'; lp.frequency.value = 430; lp.Q.value = 0.6;
        const wg = ctx.createGain(); wg.gain.value = 0.055;
        const lfo = ctx.createOscillator(); lfo.frequency.value = 0.065;
        const lfoG = ctx.createGain(); lfoG.gain.value = 0.028;
        lfo.connect(lfoG); lfoG.connect(wg.gain);
        wind.connect(lp); lp.connect(wg); wg.connect(master);
        wind.start(); lfo.start();

        // low drone
        [41.2, 61.7, 82.4].forEach((f, i) => {
          const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f;
          const og = ctx.createGain(); og.gain.value = [0.035, 0.017, 0.009][i];
          const olp = ctx.createBiquadFilter(); olp.type = 'lowpass'; olp.frequency.value = 260;
          o.connect(olp); olp.connect(og); og.connect(master); o.start();
          const l = ctx.createOscillator(); l.frequency.value = 0.045 + i * 0.012;
          const lg = ctx.createGain(); lg.gain.value = og.gain.value * 0.4;
          l.connect(lg); lg.connect(og.gain); l.start();
        });

        if (ctx.state === 'suspended') ctx.resume();
      } catch (e) {
        enabled = false;
      }
    }

    function hoof() {
      if (!ctx || !enabled) return;
      const t = ctx.currentTime;
      const src = ctx.createBufferSource();
      src.buffer = noiseBuf;
      src.playbackRate.value = 0.75 + Math.random() * 0.45;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 120 + Math.random() * 70;
      bp.Q.value = 2.1;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.17, t + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
      src.connect(bp); bp.connect(g); g.connect(master);
      src.start(t, Math.random() * 1.4, 0.2);

      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(74, t);
      o.frequency.exponentialRampToValueAtTime(33, t + 0.13);
      const og = ctx.createGain();
      og.gain.setValueAtTime(0.0001, t);
      og.gain.exponentialRampToValueAtTime(0.10, t + 0.012);
      og.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
      o.connect(og); og.connect(master);
      o.start(t); o.stop(t + 0.22);
    }

    function boom() {
      if (!ctx || !enabled) return;
      const t = ctx.currentTime;
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(112, t);
      o.frequency.exponentialRampToValueAtTime(23, t + 1.35);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.5, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 1.7);
      o.connect(g); g.connect(master);
      o.start(t); o.stop(t + 1.75);

      const src = ctx.createBufferSource();
      src.buffer = noiseBuf;
      src.playbackRate.value = 0.55;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(2600, t);
      lp.frequency.exponentialRampToValueAtTime(110, t + 1.0);
      const ng = ctx.createGain();
      ng.gain.setValueAtTime(0.3, t);
      ng.gain.exponentialRampToValueAtTime(0.0001, t + 1.1);
      src.connect(lp); lp.connect(ng); ng.connect(master);
      src.start(t); src.stop(t + 1.2);
    }

    function tick(mode, dt) {
      if (!ctx || !enabled) return;
      if (mode >= 0 || mode === 9) {
        hoofTimer -= dt;
        if (hoofTimer <= 0) {
          hoofTimer = 0.26 + Math.random() * 0.09;
          hoof();
        }
      }
    }

    function toggle() {
      enabled = !enabled;
      if (master) master.gain.value = enabled ? 0.85 : 0;
      return enabled;
    }

    return { init, boom, tick, toggle, isOn: () => enabled };
  })();

  /* -------------------------------------------------------------------- UI */
  const beginBtn = $('begin');
  const replayBtn = $('replay');
  const pauseBtn = $('btn-pause');
  const muteBtn = $('btn-mute');
  const fullBtn = $('btn-full');

  function begin() {
    if (running) return;
    audio.init();
    running = true;
    lastT = performance.now();
    fadeAlpha = 1;
    document.body.classList.add('playing');
    beginBtn.blur();
  }

  beginBtn.addEventListener('click', begin);

  replayBtn.addEventListener('click', () => location.reload());

  pauseBtn.addEventListener('click', () => {
    paused = !paused;
    pauseBtn.textContent = paused ? '▶' : '❚❚';
  });

  muteBtn.addEventListener('click', () => {
    const on = audio.toggle();
    muteBtn.textContent = on ? '♪' : '✕';
    muteBtn.classList.toggle('muted', !on);
  });

  fullBtn.addEventListener('click', () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen && document.documentElement.requestFullscreen();
    } else {
      document.exitFullscreen && document.exitFullscreen();
    }
  });

  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space') {
      e.preventDefault();
      if (!running) begin();
      else pauseBtn.click();
    } else if (e.key === 'm' || e.key === 'M') {
      muteBtn.click();
    } else if (e.key === 'r' || e.key === 'R') {
      location.reload();
    } else if (e.key === 'f' || e.key === 'F') {
      fullBtn.click();
    }
  });

  document.addEventListener('fullscreenchange', () => {
    fullBtn.textContent = document.fullscreenElement ? '⤢' : '⛶';
  });

  /* ------------------------------------------------------------------ boot */
  fadeEl.style.opacity = '1';

  if (STILL) {
    document.body.classList.add('still', 'playing');
    endcardEl.classList.remove('on');
    running = false;
    const target = STILL_T;
    let t = 0;
    const dt = 1 / 60;
    do {
      step(dt);
      t += dt;
    } while (t < target - 1e-6 && !ended);
    applyShakeAndLook();
    renderFrame();
    lastT = 0;
    window.__READY__ = true;
    // keep the drawing buffer alive for screenshots / display
    if (renderer.setAnimationLoop) renderer.setAnimationLoop(() => renderFrame());
  } else {
    renderFrame();
    renderer.setAnimationLoop(frame);
    if (params.get('autostart') === '1') {
      setTimeout(() => { try { begin(); } catch (e) { showErr('AUTOSTART: ' + e.message); } }, 300);
    }
  }

  /* expose a little debugging handle */
  window.__REV = {
    total,
    segments: SEGMENTS,
    get time() { return globalTime; },
    begin,
    jump(seconds) {
      if (!running) begin();
      globalTime = clamp(seconds, 0, total - 0.01);
      segIdx = -1;
      fadeAlpha = 0;
    }
  };
})();
