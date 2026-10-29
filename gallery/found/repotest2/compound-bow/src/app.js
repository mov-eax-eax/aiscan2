/* Scene, studio lighting, camera presets, UI and the draw animation. */
(function (global) {
  'use strict';
  const BOW = global.CB_BOW, MATS = global.CB_MATS;

  const canvas = document.getElementById('view');
  const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(global.devicePixelRatio || 1, 2));
  renderer.setSize(innerWidth, innerHeight, false);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.16;
  renderer.outputEncoding = THREE.sRGBEncoding;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, innerWidth / innerHeight, 0.1, 900);

  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTex = MATS.envTexture();
  envTex.encoding = THREE.sRGBEncoding;
  const envRT = pmrem.fromEquirectangular(envTex);
  scene.environment = envRT.texture;

  scene.add(new THREE.HemisphereLight(0xe4eef8, 0x3a4048, 0.55));
  const key = new THREE.DirectionalLight(0xfff4e6, 2.7);
  key.position.set(22, 34, 34); key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  const sc = key.shadow.camera; sc.left = -30; sc.right = 30; sc.top = 34; sc.bottom = -34; sc.near = 1; sc.far = 140;
  key.shadow.bias = -0.0006; key.shadow.radius = 3;
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xcfe0f5, 0.75); fill.position.set(-36, 6, 28); scene.add(fill);
  const rim = new THREE.DirectionalLight(0xffdcb0, 1.25); rim.position.set(-8, 22, -36); scene.add(rim);

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(260, 260), new THREE.ShadowMaterial({ opacity: 0.2 }));
  ground.rotation.x = -Math.PI / 2; ground.position.y = -19.8; ground.receiveShadow = true; scene.add(ground);

  const mats = MATS.make();
  const bow = BOW.build(mats);
  scene.add(bow.root);

  const controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true; controls.dampingFactor = 0.07;
  controls.minDistance = 8; controls.maxDistance = 260;

  const VIEWS = {
    side:  { pos: [8.0, 0, 84], tgt: [8.0, 0, 0], fov: 30 },
    whole: { pos: [9.0, 1, 100], tgt: [9.0, 0, 0], fov: 30 },
    three: { pos: [-26, 15, 64], tgt: [7.0, 0.5, 0], fov: 32 },
    cam:   { pos: [13, 20.5, 17], tgt: [2.0, 16.6, 0], fov: 30 },
    riser: { pos: [19, 0.5, 30], tgt: [7.9, 0, 0], fov: 30 },
    grip:  { pos: [13, -1, 21], tgt: [7.1, 0.2, 0], fov: 30 },
    draw:  { pos: [1, 0, 94], tgt: [0.5, 0, 0], fov: 30 },
    front: { pos: [70, 0, 6], tgt: [7.5, 0, 0], fov: 30 },
    pair:  { pos: [-22, 11, 60], tgt: [6.5, 0.5, 0], fov: 32 }
  };
  function applyView(name, opt) {
    const base = VIEWS[name] || VIEWS.side;
    const p = (opt && opt.pos) ? opt.pos : base.pos;
    const t = (opt && opt.tgt) ? opt.tgt : base.tgt;
    camera.position.set(p[0], p[1], p[2]);
    camera.fov = (opt && opt.fov) ? opt.fov : base.fov;
    camera.updateProjectionMatrix();
    controls.target.set(t[0], t[1], t[2]);
    controls.update();
  }

  const CURVE = [[0, 0.10], [0.05, 0.60], [0.10, 0.90], [0.15, 1.00], [0.30, 1.00], [0.50, 0.99], [0.70, 0.97], [0.80, 0.85], [0.90, 0.55], [0.96, 0.32], [1.00, 0.15]];
  const PEAK = 70, LETOFF = 0.85, POWER = 20.75, CAMDEG = 210;
  function forceAt(t) {
    for (let i = 1; i < CURVE.length; i++) {
      if (t <= CURVE[i][0]) {
        const a = CURVE[i - 1], b = CURVE[i];
        const f = (t - a[0]) / (b[0] - a[0] || 1);
        return (a[1] + (b[1] - a[1]) * f) * PEAK;
      }
    }
    return CURVE[CURVE.length - 1][1] * PEAK;
  }

  const state = { t: 0, auto: false, mode: 'idle', hold: 0, flying: 0, finish: 'graphite', labels: true };
  const arrowObj = bow.root.getObjectByName('arrow');

  const slider = document.getElementById('draw');
  const sliderOut = document.getElementById('drawv');
  const readout = document.getElementById('readout');
  const chart = document.getElementById('chart');
  const ctx = chart.getContext('2d');

  function setDraw(t, fromSlider) {
    state.t = Math.max(0, Math.min(1, t));
    bow.setDraw(state.t);
    if (!fromSlider) slider.value = Math.round(state.t * 100);
    sliderOut.textContent = Math.round(state.t * 100) + '%';
    updateReadout(); drawChart();
  }

  const VNAMES = [['side', 'Side'], ['whole', 'Whole bow'], ['three', '3/4'], ['cam', 'Top cam'], ['riser', 'Riser'], ['grip', 'Grip'], ['draw', 'Full draw'], ['front', 'Front'], ['pair', 'Hero']];
  const viewsEl = document.getElementById('views');
  viewsEl.innerHTML = VNAMES.map(function (a) { return '<button data-view="' + a[0] + '"' + (a[0] === 'side' ? ' class="on"' : '') + '>' + a[1] + '</button>'; }).join('');
  viewsEl.addEventListener('click', function (e) {
    const b = e.target.closest('button'); if (!b) return;
    Array.prototype.forEach.call(viewsEl.children, function (c) { c.classList.remove('on'); });
    b.classList.add('on'); applyView(b.getAttribute('data-view'));
  });

  const FIN = [['graphite', '#24272c'], ['bronze', '#3a2c1e'], ['olive', '#333a2c'], ['camo', 'camo']];
  const finEl = document.getElementById('finish');
  finEl.innerHTML = FIN.map(function (a) { return '<button data-fin="' + a[0] + '" title="' + a[0] + '" style="background:' + (a[1] === 'camo' ? 'repeating-linear-gradient(45deg,#3c4033,#3c4033 4px,#2c3126 4px,#2c3126 8px)' : a[1]) + '"></button>'; }).join('');
  finEl.addEventListener('click', function (e) {
    const b = e.target.closest('button'); if (!b) return;
    state.finish = b.getAttribute('data-fin'); MATS.applyFinish(mats, state.finish);
  });

  slider.addEventListener('input', function () { state.auto = false; document.getElementById('auto').checked = false; setDraw(slider.value / 100, true); });
  document.getElementById('auto').addEventListener('change', function (e) { state.auto = e.target.checked; if (state.auto) { state.mode = 'idle'; state.t = 0; } });
  document.getElementById('chk-labels').addEventListener('change', function (e) { state.labels = e.target.checked; });
  document.getElementById('quiver').addEventListener('change', function (e) { bow.moving.quiver.visible = e.target.checked; });

  document.getElementById('specs').textContent = 'ATA 33 in  \u00b7  brace 6.5 in  \u00b7  DL 26-31.5 in  \u00b7  70 lb peak  \u00b7  85% let-off  \u00b7  IBO 343 fps';
  setDraw(0);

  function updateReadout() {
    const f = forceAt(state.t);
    const rows = [
      ['Nock travel', (state.t * POWER).toFixed(1) + ' in'],
      ['Draw force', f.toFixed(1) + ' lb'],
      ['Cam rotation', (state.t * CAMDEG).toFixed(0) + ' deg'],
      ['Holding weight', (state.t > 0.97 ? (PEAK * (1 - LETOFF)).toFixed(1) : '--') + ' lb'],
      ['Let-off', (LETOFF * 100).toFixed(0) + ' %']
    ];
    readout.innerHTML = rows.map(function (r) { return '<div class="kv"><span>' + r[0] + '</span><b>' + r[1] + '</b></div>'; }).join('');
  }

  function drawChart() {
    const W = chart.width, H = chart.height, pad = 30;
    ctx.clearRect(0, 0, W, H);
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, 'rgba(200,114,30,0.20)'); g.addColorStop(1, 'rgba(200,114,30,0.01)');
    ctx.beginPath(); ctx.moveTo(pad, H - pad);
    for (let i = 0; i < CURVE.length; i++) ctx.lineTo(pad + CURVE[i][0] * (W - pad * 1.5), (H - pad) - CURVE[i][1] * (H - pad * 1.7));
    ctx.lineTo(W - pad * 0.5, H - pad); ctx.closePath(); ctx.fillStyle = g; ctx.fill();
    ctx.beginPath();
    for (let i = 0; i < CURVE.length; i++) {
      const x = pad + CURVE[i][0] * (W - pad * 1.5), y = (H - pad) - CURVE[i][1] * (H - pad * 1.7);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = '#c8721e'; ctx.lineWidth = 2.6; ctx.stroke();
    ctx.strokeStyle = 'rgba(20,26,34,0.25)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(pad, H - pad); ctx.lineTo(W - pad * 0.5, H - pad); ctx.stroke();
    const mx = pad + state.t * (W - pad * 1.5);
    const my = (H - pad) - forceAt(state.t) / PEAK * (H - pad * 1.7);
    ctx.beginPath(); ctx.moveTo(mx, H - pad); ctx.lineTo(mx, my); ctx.strokeStyle = 'rgba(200,114,30,0.6)'; ctx.stroke();
    ctx.beginPath(); ctx.arc(mx, my, 5.5, 0, 6.2832); ctx.fillStyle = '#c8721e'; ctx.fill();
    ctx.fillStyle = 'rgba(40,50,62,0.6)'; ctx.font = '16px ui-sans-serif,system-ui';
    ctx.fillText('draw force (lb)', 7, 19);
    ctx.fillText('nock travel', W - 132, H - 6);
  }

  const labEl = document.getElementById('labels');
  const divs = bow.labels.map(function (l) {
    const d = document.createElement('div'); d.className = 'lab'; d.textContent = l.name;
    labEl.appendChild(d); return { l: l, d: d };
  });
  const proj = new THREE.Vector3();
  function layoutLabels() {
    if (!state.labels) { divs.forEach(function (x) { x.d.style.display = 'none'; }); return; }
    const items = [];
    for (let i = 0; i < divs.length; i++) {
      divs[i].l.o.getWorldPosition(proj);
      const p = proj.clone().project(camera);
      if (p.z > 1) { divs[i].d.style.display = 'none'; continue; }
      items.push({ d: divs[i].d, x: (p.x * 0.5 + 0.5) * innerWidth, y: (-p.y * 0.5 + 0.5) * innerHeight });
    }
    items.sort(function (a, b) { return a.y - b.y; });
    for (let i = 1; i < items.length; i++) if (items[i].y - items[i - 1].y < 21) items[i].y = items[i - 1].y + 21;
    items.forEach(function (it) { it.d.style.display = 'block'; it.d.style.left = it.x + 'px'; it.d.style.top = it.y + 'px'; });
  }

  addEventListener('keydown', function (e) {
    if (e.code === 'Space') {
      e.preventDefault();
      if (state.mode === 'idle' || state.mode === 'release') { state.mode = 'draw'; state.auto = true; document.getElementById('auto').checked = true; }
      else if (state.mode === 'hold') { state.mode = 'release'; }
    }
  });

  let last = performance.now();
  function tick(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (state.auto) {
      if (state.mode === 'idle') state.mode = 'draw';
      if (state.mode === 'draw') { setDraw(state.t + dt / 1.25); if (state.t >= 1) { state.mode = 'hold'; state.hold = 0; } }
      else if (state.mode === 'hold') { state.hold += dt; if (state.hold > 0.75) state.mode = 'release'; }
      else if (state.mode === 'release') {
        setDraw(state.t - dt / 0.085);
        state.flying = Math.min(1, state.flying + dt / 0.3);
        if (arrowObj) arrowObj.position.x += state.flying * 95 * dt;
        if (state.t <= 0) { state.mode = 'idle'; state.flying = 0; if (arrowObj) arrowObj.visible = true; setDraw(0); }
      }
    }
    controls.update();
    layoutLabels();
    renderer.render(scene, camera);
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

  addEventListener('resize', function () {
    renderer.setSize(innerWidth, innerHeight, false);
    camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  });

  global.__view = function (name, opt) { applyView(name, opt); };
  global.__set = function (s) {
    if (!s) return;
    if (s.ui !== undefined) document.body.classList.toggle('clean', !s.ui);
    if (s.finish !== undefined) { state.finish = s.finish; MATS.applyFinish(mats, s.finish); }
    if (s.labels !== undefined) { state.labels = !!s.labels; document.getElementById('chk-labels').checked = !!s.labels; }
    if (s.quiver !== undefined) { bow.moving.quiver.visible = !!s.quiver; document.getElementById('quiver').checked = !!s.quiver; }
    if (s.auto !== undefined) { state.auto = !!s.auto; document.getElementById('auto').checked = !!s.auto; }
    if (s.draw !== undefined) { state.auto = false; document.getElementById('auto').checked = false; setDraw(s.draw); state.mode = 'idle'; }
  };
  global.__settle = function (n) { return new Promise(function (res) { let k = 0; (function f() { renderer.render(scene, camera); if (++k < (n || 3)) requestAnimationFrame(f); else res(true); })(); }); };
  global.__STATS__ = { triangles: bow.triangles, labels: bow.labels.length, parts: bow.root.children.length };

  applyView('side');
  const loadingEl = document.getElementById('loading');
  requestAnimationFrame(function () { requestAnimationFrame(function () {
    setTimeout(function () {
      loadingEl.style.opacity = '0';
      setTimeout(function () { loadingEl.style.display = 'none'; }, 520);
      global.__READY__ = true;
    }, 80);
  }); });
})(window);
