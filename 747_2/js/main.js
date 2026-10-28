// js/main.js — boot, UI wiring, labels, guided tour and the render loop.
import * as THREE from '../lib/three.module.min.js';
import { createScene, PRESETS } from './scene.js';
import { createAircraft, SPEC, LIVERIES } from './aircraft.js';

const $ = (id) => document.getElementById(id);
const canvas = $('view');
const CLEAN = /[?&]clean/.test(location.search);
const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));
const tick = (ms) => new Promise((r) => setTimeout(r, ms));

async function boot() {
  document.body.classList.toggle('clean', CLEAN);

  // progress ticker while the (synchronous) geometry and textures are built
  let pct = 4;
  const stages = ['lofting the fuselage', 'cutting 20-inch windows', 'sweeping the wing', 'milling the raked tips',
    'hanging four GEnx nacelles', 'pumping the landing gear', 'painting the livery', 'baking image-based light'];
  let stageIdx = 0;
  const setProgress = (p, text) => {
    pct = Math.max(pct, p);
    $('loadbar').style.width = pct + '%';
    $('loadpct').textContent = String(Math.min(99, Math.round(pct))).padStart(2, '0');
    if (text) $('loadstep').textContent = text;
  };
  setProgress(6, stages[0]);
  const ticker = setInterval(() => {
    stageIdx = Math.min(stages.length - 1, stageIdx + 1);
    setProgress(Math.min(90, pct + 7 + Math.random() * 7), stages[stageIdx]);
  }, 520);

  await nextFrame();
  const scene = createScene(canvas);
  setProgress(34, 'lofting the fuselage');
  await nextFrame();

  const aircraft = createAircraft(scene.renderer);
  scene.scene.add(aircraft.group);
  setProgress(88, 'aiming the lights');
  await nextFrame();

  aircraft.mats.applyEnv(scene.envMap);
  scene.setSunAngle(205, 9.5);
  scene.setPreset('hero', true);
  aircraft.setGear(1);
  aircraft.setFlaps(0);
  aircraft.setSpoilers(0);
  aircraft.setReverser(0);
  aircraft.setSpool(0.35);
  aircraft.setCabin(true);
  aircraft.setLights({ nav: true, strobe: true, beacon: true, landing: true });

  // ------------------------------------------------------------------ stats
  let meshes = 0, tris = 0, verts = 0, materials = new Set(), geos = new Set();
  aircraft.group.traverse((o) => {
    if (!o.isMesh) return;
    meshes++;
    const g = o.geometry;
    const n = g.index ? g.index.count : g.attributes.position.count;
    const inst = o.isInstancedMesh ? o.count : 1;
    tris += Math.round((n / 3) * inst);
    verts += g.attributes.position.count * inst;
    geos.add(g.uuid);
    for (const m of (Array.isArray(o.material) ? o.material : [o.material])) materials.add(m.uuid);
  });

  const specRows = [
    ['Length', SPEC.length.toFixed(2) + ' m'],
    ['Wingspan', SPEC.span.toFixed(2) + ' m'],
    ['Height', SPEC.height.toFixed(2) + ' m'],
    ['Fuselage width', SPEC.fuseWidth.toFixed(2) + ' m'],
    ['Wing area', SPEC.wingArea.toFixed(0) + ' m\u00B2'],
    ['Sweep', SPEC.sweep.toFixed(1) + '\u00B0'],
    ['MTOW', SPEC.mtow.toLocaleString('en-US') + ' kg'],
    ['Range', SPEC.range.toLocaleString('en-US') + ' km'],
    ['Cruise', 'Mach ' + SPEC.cruise.toFixed(3)],
    ['Engines', SPEC.engines],
    ['Thrust each', SPEC.thrust + ' kN'],
    ['Seats (3-class)', String(SPEC.pax)],
  ];
  const modelRows = [
    ['Meshes', String(meshes)],
    ['Triangles', tris.toLocaleString('en-US')],
    ['Vertices', verts.toLocaleString('en-US')],
    ['Geometries', String(geos.size)],
    ['Materials', String(materials.size)],
    ['Renderer', 'three.js r160 (vendored)'],
  ];
  $('specTable').innerHTML = specRows.map((r) => '<tr><td>' + r[0] + '</td><td>' + r[1] + '</td></tr>').join('');
  $('modelTable').innerHTML = modelRows.map((r) => '<tr><td>' + r[0] + '</td><td>' + r[1] + '</td></tr>').join('');

  // ------------------------------------------------------------------ views
  const presetGrid = $('presetGrid');
  PRESETS.forEach((p) => {
    const b = document.createElement('button');
    b.textContent = p.name;
    b.dataset.preset = p.id;
    b.title = p.name;
    b.addEventListener('click', () => { stopTour(); applyPreset(p.id); });
    presetGrid.appendChild(b);
  });
  const applyPreset = (id, instant) => {
    scene.setPreset(id, !!instant);
    for (const b of presetGrid.children) b.classList.toggle('active', b.dataset.preset === id);
  };
  applyPreset('hero', true);

  // ------------------------------------------------------------------ liveries
  const liveryGrid = $('liveryGrid');
  LIVERIES.forEach((l, i) => {
    const b = document.createElement('button');
    b.className = 'livery';
    b.innerHTML = '<span class="sw" style="background:linear-gradient(145deg,' + l.base + ' 0 52%,' + l.accent + ' 52% 100%)"></span><span>' + l.name + '</span>';
    b.title = l.name;
    b.addEventListener('click', () => {
      const liv = aircraft.setLivery(i);
      $('liveryName').textContent = liv.name;
      for (const c of liveryGrid.children) c.classList.toggle('active', c === b);
    });
    if (i === 0) b.classList.add('active');
    liveryGrid.appendChild(b);
  });

  // ------------------------------------------------------------------ controls
  const flapText = (v) => (v < 0.02 ? 'UP' : Math.round(v * 40) + '\u00B0');
  $('gear').addEventListener('change', (e) => aircraft.setGear(e.target.checked ? 1 : 0));
  $('flaps').addEventListener('input', (e) => {
    const v = parseFloat(e.target.value);
    aircraft.setFlaps(v);
    $('flapsVal').textContent = flapText(v);
  });
  $('spoilers').addEventListener('input', (e) => {
    const v = parseFloat(e.target.value);
    aircraft.setSpoilers(v);
    $('sbVal').textContent = Math.round(v * 100) + '%';
  });
  $('reverser').addEventListener('input', (e) => {
    const v = parseFloat(e.target.value);
    aircraft.setReverser(v);
    $('revVal').textContent = Math.round(v * 100) + '%';
  });
  $('spool').addEventListener('input', (e) => {
    const v = parseFloat(e.target.value);
    aircraft.setSpool(v);
    $('spoolVal').textContent = Math.round(v * 100) + '%';
  });
  $('explode').addEventListener('input', (e) => aircraft.setExplode(parseFloat(e.target.value)));
  $('elevator').addEventListener('input', (e) => {
    const v = parseFloat(e.target.value);
    aircraft.setElevator(v);
    $('elevVal').textContent = v.toFixed(2);
  });
  $('aileron').addEventListener('input', (e) => {
    const v = parseFloat(e.target.value);
    aircraft.setAileron(v);
    $('ailVal').textContent = v.toFixed(2);
  });
  $('rudder').addEventListener('input', (e) => {
    const v = parseFloat(e.target.value);
    aircraft.setRudder(v);
    $('rudVal').textContent = v.toFixed(2);
  });
  $('lNav').addEventListener('change', (e) => aircraft.setLights({ nav: e.target.checked }));
  $('lStrobe').addEventListener('change', (e) => aircraft.setLights({ strobe: e.target.checked }));
  $('lBeacon').addEventListener('change', (e) => aircraft.setLights({ beacon: e.target.checked }));
  $('lLand').addEventListener('change', (e) => aircraft.setLights({ landing: e.target.checked }));
  $('lCabin').addEventListener('change', (e) => aircraft.setCabin(e.target.checked));
  $('autoRotate').addEventListener('change', (e) => { scene.controls.autoRotate = e.target.checked; });
  $('wire').addEventListener('change', (e) => aircraft.setWireframe(e.target.checked));
  $('hotspots').addEventListener('change', (e) => { labelsOn = e.target.checked; });
  $('panelToggle').addEventListener('click', () => document.body.classList.toggle('panel-hidden'));
  $('panelClose').addEventListener('click', () => document.body.classList.add('panel-hidden'));
  $('reset').addEventListener('click', () => {
    stopTour();
    applyPreset('hero');
    scene.controls.autoRotate = false;
    $('autoRotate').checked = false;
    aircraft.setGear(1);
    aircraft.setFlaps(0);
    aircraft.setSpoilers(0);
    aircraft.setReverser(0);
    aircraft.setExplode(0);
    $('gear').checked = true;
    $('flaps').value = 0; $('flapsVal').textContent = 'UP';
    $('spoilers').value = 0; $('sbVal').textContent = '0%';
    $('reverser').value = 0; $('revVal').textContent = '0%';
    $('explode').value = 0;
  });
  $('shot').addEventListener('click', () => {
    scene.renderer.render(scene.scene, scene.camera);
    const a = document.createElement('a');
    a.href = scene.renderer.domElement.toDataURL('image/png');
    a.download = 'boeing-747-8-' + (aircraft.mats.livery.id || 'house') + '.png';
    a.click();
  });

  // ------------------------------------------------------------------ guided tour
  const TOUR = [
    ['hero', 'The 747-8 on the dusk flightline'],
    ['nose', 'Nose — 6-pane flight deck above a drooped radome'],
    ['side', 'Profile — 76.3 m of double-bubble fuselage'],
    ['top', 'Planform — 68.4 m span with raked wingtips'],
    ['engine', 'GEnx-2B67 — 2.82 m fan, 18 wide-chord blades'],
    ['gear', 'Landing gear — four four-wheel bogies, 18 wheels total'],
    ['tail', 'Empennage — 14 m fin with dorsal fillet'],
    ['cockpit', 'Flight deck — glazing cut into the upper-deck lobe'],
    ['flap', 'Fowler flaps and six flying spoilers per wing'],
    ['titles', 'House livery — BOEING 747-8'],
  ];
  let tourActive = false, tourIndex = 0, tourClock = 0;
  const caption = $('tourCaption');
  const showCaption = (b, s) => {
    caption.querySelector('b').textContent = b;
    caption.querySelector('span').textContent = s || '';
    caption.classList.add('on');
  };
  const hideCaption = () => caption.classList.remove('on');
  const stopTour = () => {
    if (!tourActive) return;
    tourActive = false;
    $('tour').classList.remove('active');
    $('tour').innerHTML = '&#9654; Guided tour';
    hideCaption();
  };
  const startTour = () => {
    tourActive = true; tourIndex = 0; tourClock = 0;
    $('tour').classList.add('active');
    $('tour').innerHTML = '&#10074;&#10074; Stop tour';
    scene.controls.autoRotate = false;
    $('autoRotate').checked = false;
    const [id] = TOUR[0];
    applyPreset(id);
    showCaption(TOUR[0][0].toUpperCase(), TOUR[0][1]);
  };
  $('tour').addEventListener('click', () => (tourActive ? stopTour() : startTour()));
  scene.controls.addEventListener('start', () => stopTour());

  // ------------------------------------------------------------------ labels
  let labelsOn = false;
  const labelBox = $('labels');
  const presetFor = {
    cockpit: 'cockpit', upperdeck: 'side', fan: 'engine', tip: 'wingtip', flaps: 'flap',
    gear: 'gear', apu: 'tail', fin: 'tail', spoiler: 'flap', doors: 'titles',
  };
  const labelEls = aircraft.hotspots.map((h) => {
    const el = document.createElement('div');
    el.className = 'hot';
    el.innerHTML = '<div class="dot"></div><div class="chip"><b>' + h.label + '</b><small>' + h.text + '</small></div>';
    el.querySelector('.chip').addEventListener('click', () => {
      stopTour();
      applyPreset(presetFor[h.id] || 'hero');
    });
    labelBox.appendChild(el);
    return { el, h };
  });
  if (CLEAN) $('hotspots').checked = false;

  // ------------------------------------------------------------------ loop
  const clock = new THREE.Clock();
  let t = 0, ctlPhase = 0;
  const readouts = $('readouts');
  let acc = 0, frames = 0;
  const smoothstep = (a, b, x) => {
    const k = Math.min(1, Math.max(0, (x - a) / (b - a)));
    return k * k * (3 - 2 * k);
  };
  let introT = 0;

  scene.renderer.setAnimationLoop(() => {
    const dt = Math.min(clock.getDelta(), 0.05);
    t += dt;

    if ($('ctlCheck').checked) {
      ctlPhase += dt;
      const e = Math.sin(ctlPhase * 0.9), a = Math.sin(ctlPhase * 0.9 + 0.6), r = Math.sin(ctlPhase * 0.55);
      aircraft.setElevator(e); aircraft.setAileron(a); aircraft.setRudder(r);
      aircraft.setSpoilers(Math.max(0, Math.sin(ctlPhase * 0.4)));
      $('elevVal').textContent = e.toFixed(2);
      $('ailVal').textContent = a.toFixed(2);
      $('rudVal').textContent = r.toFixed(2);
      $('sbVal').textContent = Math.round(Math.max(0, Math.sin(ctlPhase * 0.4)) * 100) + '%';
    }

    if (tourActive) {
      tourClock += dt;
      if (tourClock > 7.0) {
        tourClock = 0;
        tourIndex = (tourIndex + 1) % TOUR.length;
        applyPreset(TOUR[tourIndex][0]);
        showCaption(TOUR[tourIndex][0].toUpperCase(), TOUR[tourIndex][1]);
      }
    }

    aircraft.update(dt, t);
    scene.updateCamera(dt);
    scene.renderer.render(scene.scene, scene.camera);

    acc += dt; frames++;
    if (acc > 0.4) {
      const fps = frames / acc;
      acc = 0; frames = 0;
      const info = scene.renderer.info.render;
      readouts.innerHTML =
        '<div>FPS <b>' + fps.toFixed(0) + '</b></div>' +
        '<div>TRIS <b>' + (info.triangles / 1000).toFixed(0) + 'k</b></div>' +
        '<div>CALLS <b>' + info.calls + '</b></div>' +
        '<div>MESHES <b>' + meshes + '</b></div>';
    }

    const w = canvas.clientWidth, h = canvas.clientHeight;
    for (const { el, h: hs } of labelEls) {
      const v = hs.anchor.clone().project(scene.camera);
      const inFrame = v.z < 1 && v.x > -1.02 && v.x < 1.02 && v.y > -1.02 && v.y < 1.02;
      const on = labelsOn && inFrame && !CLEAN;
      el.style.display = on ? 'block' : 'none';
      if (on) el.style.transform = 'translate(' + ((v.x * 0.5 + 0.5) * w).toFixed(1) + 'px,' + ((-v.y * 0.5 + 0.5) * h).toFixed(1) + 'px)';
    }
  });

  window.addEventListener('resize', () => scene.resize());
  window.addEventListener('keydown', (ev) => {
    if (ev.target && /INPUT|TEXTAREA/.test(ev.target.tagName)) return;
    const n = parseInt(ev.key, 10);
    if (n >= 1 && n <= 9 && PRESETS[n - 1]) { stopTour(); applyPreset(PRESETS[n - 1].id); }
    if (ev.key.toLowerCase() === 'h') document.body.classList.toggle('panel-hidden');
    if (ev.key.toLowerCase() === 'g') { const g = !$('gear').checked; $('gear').checked = g; aircraft.setGear(g ? 1 : 0); }
    if (ev.key.toLowerCase() === 'c') { $('lCabin').checked = !$('lCabin').checked; aircraft.setCabin($('lCabin').checked); }
  });

  clearInterval(ticker);
  setProgress(100, 'ready');
  await tick(260);
  $('loader').classList.add('done');
  document.body.classList.add('ready');

  window.__747__ = {
    scene, aircraft, applyPreset, THREE, SPEC, LIVERIES, CLEAN,
    setLivery: (i) => { const liv = aircraft.setLivery(i); $('liveryName').textContent = liv.name; return liv; },
    setLabels: (on) => { labelsOn = on; $('hotspots').checked = on; },
    stats: { meshes, triangles: tris, vertices: verts, materials: materials.size, geometries: geos.size },
    ready: true,
  };
  console.log('[747-8] ready', JSON.stringify(window.__747__.stats));
}

boot().catch((err) => {
  const step = document.getElementById('loadstep');
  if (step) step.textContent = 'error: ' + err.message;
  console.error(err);
});
