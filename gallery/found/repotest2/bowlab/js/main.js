/* ============================================================================
   bowlab / main.js — scene, lighting, cameras, and the glue between the
   mechanics solver, the bow model, the simulation and the UI.
   ========================================================================== */
(function (root) {
  'use strict';
  var BP = root.BowPhysics, UI = root.BowUI, fmt = UI.fmt;
  var scene, camera, renderer, controls, bow, sim, chartF, chartA, chartV;
  var params = { kind: 'compound' };
  var uiRows = {}, readout = {}, playBtns = {};
  var flags = { wire: false, arms: false, explode: 0, follow: true };
  var autoCycle = false, autoTimer = 0, autoStage = 0, viewScale = 1;
  var lastKey = '';
  var camAnim = null;

  var CAM_PRESETS = {
    side: { pos: [1.95, 0.02, 0.17], tgt: [0, 0.02, 0.12], label: 'Side' },
    three: { pos: [1.40, 0.50, 1.15], tgt: [0, 0.02, 0.10], label: '3/4' },
    cam: { pos: [0.52, 0.62, 0.52], tgt: [0, 0.40, 0.20], label: 'Top cam' },
    grip: { pos: [0.46, -0.02, 0.34], tgt: [0, -0.05, 0.02], label: 'Grip' },
    front: { pos: [0.08, 0.06, -2.30], tgt: [0, 0.02, 0.12], label: 'Front' },
    wide: { pos: [2.30, 0.55, 1.70], tgt: [0, 0.0, -0.10], label: 'Wide' }
  };

  // --------------------------------------------------------------- env map --
  function makeEnv(renderer) {
    var faces = [];
    for (var i = 0; i < 6; i++) {
      var cv = document.createElement('canvas');
      cv.width = cv.height = 64;
      var g = cv.getContext('2d');
      var grd = g.createLinearGradient(0, 0, 0, 64);
      var top = i === 2 ? '#eef4ff' : (i === 3 ? '#20242c' : '#8fa0b8');
      var bot = i === 2 ? '#cfd8e6' : (i === 3 ? '#0d1014' : '#2a3038');
      grd.addColorStop(0, top); grd.addColorStop(1, bot);
      g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
      // a warm blob to give metals something to reflect
      g.fillStyle = 'rgba(255,178,110,0.5)';
      g.beginPath(); g.arc(20, 22, 13, 0, 7); g.fill();
      faces.push(cv);
    }
    var tex = new THREE.CubeTexture(faces);
    tex.needsUpdate = true;
    tex.encoding = THREE.sRGBEncoding;
    return tex;
  }

  function makeBackdrop() {
    var cv = document.createElement('canvas');
    cv.width = 8; cv.height = 256;
    var g = cv.getContext('2d');
    var grd = g.createLinearGradient(0, 0, 0, 256);
    grd.addColorStop(0, '#1a2028');
    grd.addColorStop(0.45, '#12161c');
    grd.addColorStop(0.72, '#0d1014');
    grd.addColorStop(1, '#070809');
    g.fillStyle = grd; g.fillRect(0, 0, 8, 256);
    var tex = new THREE.CanvasTexture(cv);
    tex.encoding = THREE.sRGBEncoding;
    var geo = new THREE.SphereGeometry(30, 32, 24);
    var mat = new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, depthWrite: false });
    var m = new THREE.Mesh(geo, mat);
    return m;
  }

  // ------------------------------------------------------------------ init --
  function init() {
    var canvas = document.getElementById('gl');
    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.setSize(innerWidth, innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;

    scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x0a0d11, 1.6, 7.5);
    scene.add(makeBackdrop());
    scene.environment = makeEnv(renderer);

    camera = new THREE.PerspectiveCamera(34, innerWidth / innerHeight, 0.02, 60);
    camera.position.set(1.30, 0.03, 0.16);
    controls = new THREE.OrbitControls(camera, canvas);
    controls.target.set(0, 0.02, 0.13);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 0.18;
    controls.maxDistance = 6;
    controls.maxPolarAngle = Math.PI * 0.92;
    controls.update();

    // lights
    scene.add(new THREE.HemisphereLight(0xbfd2ea, 0x20262e, 0.95));
    var key = new THREE.DirectionalLight(0xfff2e2, 3.2);
    key.position.set(1.6, 2.2, 1.9);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.near = 0.5; key.shadow.camera.far = 8;
    key.shadow.camera.left = -1.1; key.shadow.camera.right = 1.1;
    key.shadow.camera.top = 1.1; key.shadow.camera.bottom = -1.1;
    key.shadow.bias = -0.0008;
    scene.add(key);
    var rim = new THREE.DirectionalLight(0x8fc0ff, 2.0);
    rim.position.set(-1.8, 0.6, -1.6); scene.add(rim);
    var fill = new THREE.DirectionalLight(0xffd9a8, 0.7);
    fill.position.set(-0.8, -1.4, 1.2); scene.add(fill);

    // ground
    var ground = new THREE.Mesh(
      new THREE.CircleGeometry(9, 64),
      new THREE.MeshStandardMaterial({ color: 0x0c0f13, roughness: 0.85, metalness: 0.1 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.62;
    ground.receiveShadow = true;
    scene.add(ground);

    // charts + ui
    chartF = new root.BowChart(document.getElementById('chartForce'), { xLabel: 'inches', yLabel: 'lb' });
    chartA = new root.BowChart(document.getElementById('chartArm'), { xLabel: 'stroke fraction', yLabel: 'in' });
    chartV = new root.BowChart(document.getElementById('chartVel'), { xLabel: 'inches', yLabel: 'fps' });

    sim = new root.BowSim();
    buildControlsFor(params.kind);
    readout = UI.readout(document.getElementById('readout'));
    playBtns = UI.playback(document.getElementById('playback'), onAction);

    document.querySelectorAll('#kindSwitch button').forEach(function (b) {
      b.addEventListener('click', function () {
        params = { kind: b.dataset.kind };
        document.querySelectorAll('#kindSwitch button').forEach(function (x) { x.classList.toggle('on', x === b); });
        sim.reset();
        buildControlsFor(params.kind);
        rebuild(true);
        setCam('side');
      });
    });
    document.querySelectorAll('#camSwitch button').forEach(function (b) {
      b.addEventListener('click', function () { setCam(b.dataset.cam); });
    });

    addEventListener('resize', onResize);
    addEventListener('keydown', function (e) {
      if (e.code === 'Space') { e.preventDefault(); if (!e.repeat) sim.startDraw(); }
      if (e.key === 'r' || e.key === 'R') sim.reset();
      if (e.key === 'f' || e.key === 'F') sim.release();
    });
    addEventListener('keyup', function (e) {
      if (e.code === 'Space') { e.preventDefault(); sim.release(); }
    });

    rebuild(true);
    animate();
  }

  function onResize() {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
    [chartF, chartA, chartV].forEach(function (c) { c.resize(); c.draw(); });
  }

  // --------------------------------------------------------------- rebuild --
  function buildControlsFor(kind) {
    var defs = kind === 'recurve' ? BP.RECURVE_DEFAULTS : BP.COMPOUND_DEFAULTS;
    uiRows = UI.controls(document.getElementById('controls'), kind, defs, function (id, value, live) {
      params[id] = value;
      if (live) throttledRebuild(); else rebuild();
    });
  }

  var pendingTimer = null, lastRebuild = 0;
  function throttledRebuild() {
    var now = performance.now();
    if (now - lastRebuild > 130) { rebuild(); return; }
    if (pendingTimer) return;
    pendingTimer = setTimeout(function () { pendingTimer = null; rebuild(); }, 140);
  }

  function currentPhysicsParams() {
    var p = { kind: params.kind };
    var defs = params.kind === 'recurve' ? BP.RECURVE_DEFAULTS : BP.COMPOUND_DEFAULTS;
    for (var k in defs) p[k] = defs[k];
    for (var k2 in params) if (params[k2] !== undefined && k2 !== 'kind') p[k2] = params[k2];
    // keep the derived geometry honest: ATA at full draw can never exceed brace ATA
    if (params.kind === 'compound') {
      p.ataFull = Math.min(p.ataFull === undefined ? p.ata - 3 : p.ataFull, p.ata - 0.5);
      if (p.ataFull < p.ata - 6) p.ataFull = p.ata - 6;
      if (p.ataFull > p.ata - 0.5) p.ataFull = p.ata - 0.5;
      var maxSpan = (p.drawLength - 1.75) - p.brace;
      if (maxSpan < 4) { p.brace = p.drawLength - 1.75 - 4; if (uiRows.brace) { uiRows.brace.input.value = p.brace; uiRows.brace.disp(); } }
    }
    return p;
  }

  function rebuild(force) {
    var pp = currentPhysicsParams();
    var key = JSON.stringify(pp);
    if (!force && key === lastKey) return;
    lastKey = key;
    var t0 = performance.now();
    lastRebuild = t0;
    var bp = BP.solve(pp);
    viewScale = bp.kind === 'recurve' ? 1.85 : 1.0;
    // remember for the UI
    params._bp = bp;
    if (bow) { disposeBow(bow); scene.remove(bow.group); }
    bow = root.BowModel.create(bp);
    scene.add(bow.group);
    sim.setBlueprint(bp);
    updateCharts(bp);
    updateReadoutStatic(bp);
    var ms = performance.now() - t0;
    var badge = document.getElementById('solveTime');
    if (badge) badge.textContent = 'solved in ' + ms.toFixed(0) + ' ms';
    // sync the ATA-full-draw slider bounds to the current ATA
    if (uiRows.ataFull && pp.kind === 'compound') {
      uiRows.ataFull.input.min = (pp.ata - 6).toFixed(2);
      uiRows.ataFull.input.max = (pp.ata - 0.5).toFixed(2);
    }
  }

  function disposeBow(b) {
    b.group.traverse(function (o) {
      if (o.geometry) o.geometry.dispose();
    });
  }

  // ---------------------------------------------------------------- charts --
  function updateCharts(bp) {
    var fd = [];
    for (var i0 = 0; i0 < bp.xs.length; i0++) fd.push([bp.xs[i0], bp.forces[i0]]);
    chartF.setSeries([{ data: fd, color: '#ff8a3c', width: 1.9, fill: 'rgba(255,122,26,0.28)' }]);
    if (bp.kind === 'compound') {
      chartA.setSeries([{ data: bp.rows.map(function (r) { return [r.t, r.arm]; }), color: '#4ad6ff', width: 1.7 }]);
    } else {
      chartA.setSeries([{ data: bp.phis.map(function (p, i) { return [i / (bp.phis.length - 1), p * 180 / Math.PI]; }), color: '#4ad6ff', width: 1.7 }]);
    }
    var vp = [];
    var vtabl = bp.releaseVel || bp.velocity;
    for (var i = 0; i < bp.xs.length; i++) vp.push([bp.xs[i], vtabl[i] * 3.280839895]);
    chartV.setSeries([{ data: vp, color: '#9fe870', width: 1.7, fill: 'rgba(159,232,112,0.18)' }]);
  }

  function updateReadoutStatic(bp) {
    var m = bp.metrics;
    var set = function (k, v) { if (readout[k]) readout[k].innerHTML = '<span>' + readout[k].querySelector('span').textContent + '</span><b>' + v + '</b>'; };
    var relabel = function (k, label) { if (readout[k]) readout[k].querySelector('span').textContent = label; };
    var rec = bp.kind === 'recurve';
    relabel('Cam rotation', rec ? 'Limb rotation' : 'Cam rotation');
    relabel('Cable tension', rec ? 'Bow length (strung)' : 'Cable tension');
    relabel('Cable lever ratio', rec ? 'Tip hook radius' : 'Cable lever ratio');
    relabel('Cable hub radius', rec ? 'Tip travel' : 'Cable hub radius');
    relabel('String paid out', rec ? 'Limb rotation rate' : 'String paid out');
    relabel('ATA at full draw', rec ? 'Stored energy / in' : 'ATA at full draw');
    set('Stored energy', fmt(m.energyFtLb, 1) + ' ft-lb / ' + fmt(m.energyJ, 0) + ' J');
    set('Arrow speed', fmt(m.fps, 0) + ' fps / ' + fmt(m.arrowSpeed, 1) + ' m/s');
    set('Kinetic energy', fmt(m.arrowKEftLb, 1) + ' ft-lb');
    set('Efficiency', fmt(m.efficiency * 100, 0) + ' %');
    set('IBO-style spec', m.iboFps ? fmt(m.iboFps, 0) + ' fps' : 'n/a');
    set('Peak / holding force', fmt(m.peakForce, 1) + ' / ' + fmt(m.holdForce, 1) + ' lb');
    set('Let-off (actual)', fmt(m.letOff * 100, 1) + ' %');
    set('Limb tip rate', fmt(m.limbRate, 0) + (rec ? ' lb*in/rad' : ' lb/in'));
    set('Cable hub radius', rec ? fmt(m.limbTipTravel, 2) + ' in' : fmt(m.hubRadius, 3) + ' in');
    set('String paid out', rec ? fmt(m.limbRotationDeg, 1) + ' deg' : fmt(m.payout, 2) + ' in per cam');
    set('ATA at full draw', rec ? fmt(m.energyFtLb / (m.powerStroke || 1) * 12, 1) + ' lb/in' : fmt(m.ataFull, 2) + ' in');
    set('Power stroke', fmt(m.powerStroke, 2) + ' in');
    set('Release time', fmt(m.drawTime * 1000, 1) + ' ms');
    var armTitle = document.getElementById('armTitle');
    if (armTitle) {
      armTitle.innerHTML = rec
        ? 'Limb rotation vs draw <em>(the recurve bends further and further)</em>'
        : 'Cable lever arm about the axle <em>(the cam-over that makes let-off)</em>';
    }
  }

  function updateReadoutLive(st) {
    var m = params._bp ? params._bp.metrics : null;
    var kind = params._bp ? params._bp.kind : 'compound';
    var set = function (k, v) { if (readout[k]) readout[k].innerHTML = '<span>' + readout[k].querySelector('span').textContent + '</span><b>' + v + '</b>'; };
    set('Draw force', fmt(st.F, 1) + ' lb');
    set('String tension', fmt(st.Tstr, 1) + ' lb');
    if (kind === 'recurve') {
      var bp = params._bp;
      set('Cable tension', fmt(bp.params.tipToTip, 1) + ' in');
      set('Cable lever ratio', fmt(bp.params.tipRadius, 2) + ' in');
      set('Cam rotation', fmt((st.phi || 0) * 180 / Math.PI, 1) + ' deg');
      var t0 = bp.tip0 || { y: 0, z: 0 };
      set('Limb tip travel', fmt(Math.hypot(st.tip.y - t0.y, st.tip.z - t0.z), 2) + ' in');
    } else {
      set('Cable tension', st.Tcab === undefined ? '--' : fmt(st.Tcab, 1) + ' lb');
      set('Cam rotation', fmt((st.theta || 0) * 180 / Math.PI, 0) + ' deg');
      set('Limb tip travel', fmt(st.delta || 0, 2) + ' in');
      set('Cable lever ratio', st.arm === undefined || !m ? '--' : fmt(st.arm / params._bp.params.stringGrooveR, 4) + ' : 1');
    }
    chartF.setMarker({ x: st.x, y: st.F });
  }

  // ------------------------------------------------------------ interaction --
  function onAction(a) {
    if (a === 'draw') sim.startDraw();
    else if (a === 'hold') sim.stopDraw();
    else if (a === 'release') sim.release();
    else if (a === 'reset') { sim.reset(); autoCycle = false; autoStage = 0; }
    else if (a === 'auto') { autoCycle = !autoCycle; autoStage = 0; autoTimer = 0; }
    else if (a === 'wire') {
      flags.wire = !flags.wire;
      bow.group.traverse(function (o) {
        if (!o.isMesh || !o.material || !o.material.isMeshStandardMaterial) return;
        if (!o.userData.m0) o.userData.m0 = { wireframe: o.material.wireframe, transparent: o.material.transparent, opacity: o.material.opacity };
        o.material.wireframe = flags.wire;
        o.material.transparent = flags.wire || o.userData.m0.transparent;
        o.material.opacity = flags.wire ? 0.35 : o.userData.m0.opacity;
        o.material.needsUpdate = true;
      });
      playBtns.bWire.classList.toggle('on', flags.wire);
    } else if (a === 'arms') {
      flags.arms = !flags.arms;
      playBtns.bArms.classList.toggle('on', flags.arms);
    } else if (a === 'explode') {
      flags.explode = flags.explode > 0 ? 0 : 1;
      playBtns.bExp.classList.toggle('on', flags.explode > 0);
    }
  }

  function setCam(name) {
    var p = CAM_PRESETS[name];
    if (!p) return;
    var s = viewScale || 1;
    var t1v = new THREE.Vector3().fromArray(p.tgt);
    var p1v = new THREE.Vector3().fromArray(p.pos).sub(new THREE.Vector3().fromArray(p.tgt)).multiplyScalar(s).add(t1v);
    camAnim = {
      t: 0, dur: 0.75,
      p0: camera.position.clone(), p1: p1v,
      t0: controls.target.clone(), t1: t1v
    };
    document.querySelectorAll('#camSwitch button').forEach(function (b) { b.classList.toggle('on', b.dataset.cam === name); });
  }

  // ------------------------------------------------------------------ loop --
  var last = 0, fpsAcc = 0, fpsN = 0;
  function animate(now) {
    requestAnimationFrame(animate);
    var t = (now || 0) / 1000;
    var dt = Math.min(0.05, last ? t - last : 0.016);
    last = t;

    if (camAnim) {
      camAnim.t += dt / camAnim.dur;
      var k = Math.min(1, camAnim.t);
      var e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      camera.position.lerpVectors(camAnim.p0, camAnim.p1, e);
      controls.target.lerpVectors(camAnim.t0, camAnim.t1, e);
      if (k >= 1) camAnim = null;
    }

    if (autoCycle) {
      autoTimer += dt;
      if (autoStage === 0 && autoTimer > 0.4) { sim.startDraw(); autoStage = 1; }
      else if (autoStage === 1 && sim.phase === 'holding') { autoStage = 2; autoTimer = 0; }
      else if (autoStage === 2 && autoTimer > 0.9) { sim.release(); autoStage = 3; }
      else if (autoStage === 3 && sim.phase === 'brace') { autoStage = 0; autoTimer = 0; }
    }

    sim.update(dt);
    var st = sim.viewState();
    var extra = { showArms: flags.arms, vibe: sim.vibe };
    if (sim.phase === 'flight') {
      extra.arrowZ = sim.arrow.z;
      extra.arrowY = sim.arrow.y;
    } else if (sim.phase === 'power') {
      extra.arrowZ = st.zNock;
    }
    if (bow) bow.update(st, extra);
    if (st) updateReadoutLive(st);

    // follow the arrow during flight
    if (flags.follow && sim.phase === 'flight') {
      var az = sim.arrow.z * 0.0254;
      controls.target.z += (az - controls.target.z) * Math.min(1, dt * 2.5);
      camera.position.z += (az + 0.16 - camera.position.z) * Math.min(1, dt * 2.5);
    }

    controls.update();
    renderer.render(scene, camera);
    fpsAcc += dt; fpsN++;
    if (fpsAcc > 0.5) {
      var el = document.getElementById('fps');
      if (el) el.textContent = (fpsN / fpsAcc).toFixed(0) + ' fps';
      fpsAcc = 0; fpsN = 0;
    }
  }

  root.BowLab = {
    init: init, rebuild: function () { rebuild(true); },
    sim: function () { return sim; },
    scene: function () { return scene; },
    bow: function () { return bow; },
    camera: function () { return camera; },
    controls: function () { return controls; }
  };
  addEventListener('DOMContentLoaded', init);
})(window);
