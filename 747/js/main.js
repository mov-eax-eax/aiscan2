// js/main.js — boot, UI wiring, hotspot labels, stats and the render loop.
import * as THREE from '../lib/three.module.min.js';
import { createScene, PRESETS } from './scene.js';
import { createAircraft, SPEC, LIVERIES } from './aircraft.js';
import { clamp, lerp } from './util.js';

const canvas = document.getElementById('view');
const loader = document.getElementById('loader');
const loadbar = document.getElementById('loadbar');
const loadstep = document.getElementById('loadstep');
const $ = (id) => document.getElementById(id);

const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));
const tick = (ms) => new Promise((r) => setTimeout(r, ms));

async function boot() {
  loadstep.textContent = 'renderer, sky and apron';
  loadbar.style.width = '12%';
  await nextFrame();
  const scene = createScene(canvas);

  loadbar.style.width = '30%';
  loadstep.textContent = 'lofting fuselage, wings, engines, gear';
  await nextFrame(); await tick(30);

  const aircraft = createAircraft(scene.renderer);
  scene.scene.add(aircraft.group);

  loadbar.style.width = '82%';
  loadstep.textContent = 'image-based lighting';
  await nextFrame(); await tick(20);
  aircraft.mats.applyEnv(scene.envMap);
  scene.setSunAngle(148, 34);
  scene.setPreset('hero', true);

  loadbar.style.width = '96%';
  loadstep.textContent = 'panel wiring';
  await nextFrame();

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
    ['Wing area', SPEC.wingArea.toFixed(1) + ' m\u00B2'],
    ['Sweep', SPEC.sweep.toFixed(1) + '\u00B0'],
    ['MTOW', SPEC.mtow.toLocaleString() + ' kg'],
    ['Fuel capacity', SPEC.fuel.toLocaleString() + ' L'],
    ['Range', SPEC.range.toLocaleString() + ' km'],
    ['Cruise', 'M ' + SPEC.cruise.toFixed(3)],
    ['Ceiling', SPEC.ceiling.toLocaleString() + ' m'],
    ['Engines', SPEC.engines],
    ['Thrust each', SPEC.thrust + ' kN'],
    ['Seats (3-class)', String(SPEC.pax)],
  ];
  const modelRows = [
    ['Meshes', String(meshes)],
    ['Triangles', tris.toLocaleString()],
    ['Vertices', verts.toLocaleString()],
    ['Geometries', String(geos.size)],
    ['Materials', String(materials.size)],
    ['Texture maps', 'livery colour, normal, MR, fin, wing, apron, sky'],
    ['Renderer', 'three.js r160 (vendored)'],
  ];
  $('specTable').innerHTML = specRows.map((r) => '<tr><td>' + r[0] + '</td><td>' + r[1] + '</td></tr>').join('');
  $('modelTable').innerHTML = modelRows.map((r) => '<tr><td>' + r[0] + '</td><td>' + r[1] + '</td></tr>').join('');

  // ------------------------------------------------------------------ UI
  const presetGrid = $('presetGrid');
  PRESETS.forEach((p) => {
    const b = document.createElement('button');
    b.textContent = p.name; b.dataset.preset = p.id;
    b.addEventListener('click', () => applyPreset(p.id));
    presetGrid.appendChild(b);
  });
  const applyPreset = (id, instant) => {
    scene.setPreset(id, !!instant);
    for (const b of presetGrid.children) b.classList.toggle('active', b.dataset.preset === id);
  };
  applyPreset('hero');

  const liveryGrid = $('liveryGrid');
  LIVERIES.forEach((l, i) => {
    const b = document.createElement('button');
    b.textContent = l.name.split(' ')[0];
    b.title = l.name;
    b.addEventListener('click', () => {
      const liv = aircraft.setLivery(i);
      $('liveryName').textContent = liv.name;
      for (const c of liveryGrid.children) c.classList.toggle('active', c === b);
    });
    if (i === 0) b.classList.add('active');
    liveryGrid.appendChild(b);
  });

  const flapText = (v) => (v < 0.02 ? 'UP' : Math.round(v * 40) + '\u00B0');
  $('gear').addEventListener('change', (e) => aircraft.setGear(e.target.checked ? 1 : 0));
  $('flaps').addEventListener('input', (e) => {
    aircraft.setFlaps(parseFloat(e.target.value));
    $('flapsVal').textContent = flapText(parseFloat(e.target.value));
  });
  $('spoilers').addEventListener('input', (e) => {
    aircraft.setSpoilers(parseFloat(e.target.value));
    $('sbVal').textContent = Math.round(parseFloat(e.target.value) * 100) + '%';
  });
  $('reverser').addEventListener('input', (e) => aircraft.setReverser(parseFloat(e.target.value)));
  $('spool').addEventListener('input', (e) => {
    aircraft.setSpool(parseFloat(e.target.value));
    $('spoolVal').textContent = Math.round(parseFloat(e.target.value) * 100) + '%';
  });
  $('explode').addEventListener('input', (e) => aircraft.setExplode(parseFloat(e.target.value)));
  $('elevator').addEventListener('input', (e) => {
    aircraft.setElevator(parseFloat(e.target.value));
    $('elevVal').textContent = parseFloat(e.target.value).toFixed(2);
  });
  $('aileron').addEventListener('input', (e) => {
    aircraft.setAileron(parseFloat(e.target.value));
    $('ailVal').textContent = parseFloat(e.target.value).toFixed(2);
  });
  $('rudder').addEventListener('input', (e) => {
    aircraft.setRudder(parseFloat(e.target.value));
    $('rudVal').textContent = parseFloat(e.target.value).toFixed(2);
  });
  $('lNav').addEventListener('change', (e) => aircraft.setLights({ nav: e.target.checked }));
  $('lStrobe').addEventListener('change', (e) => aircraft.setLights({ strobe: e.target.checked }));
  $('lBeacon').addEventListener('change', (e) => aircraft.setLights({ beacon: e.target.checked }));
  $('lLand').addEventListener('change', (e) => aircraft.setLights({ landing: e.target.checked }));
  $('night').addEventListener('change', (e) => {
    aircraft.setNight(e.target.checked);
    scene.sun.intensity = e.target.checked ? 0.9 : 3.1;
    scene.renderer.toneMappingExposure = e.target.checked ? 0.72 : 1.05;
  });
  $('autoRotate').addEventListener('change', (e) => { scene.controls.autoRotate = e.target.checked; });
  $('wire').addEventListener('change', (e) => aircraft.setWireframe(e.target.checked));
  $('hotspots').addEventListener('change', (e) => { labelsOn = e.target.checked; });
  $('reset').addEventListener('click', () => { applyPreset('hero'); scene.controls.autoRotate = false; $('autoRotate').checked = false; });
  $('shot').addEventListener('click', () => {
    scene.renderer.render(scene.scene, scene.camera);
    const a = document.createElement('a');
    a.href = scene.renderer.domElement.toDataURL('image/png');
    a.download = 'boeing-747-400.png';
    a.click();
  });
  $('panelToggle').addEventListener('click', () => $('panel').classList.toggle('hidden'));

  // ------------------------------------------------------------------ presentation mode (?clean=1)
  const CLEAN = /[?&]clean/.test(location.search);
  if (CLEAN) {
    $('panel').classList.add('hidden');
    $('topbar').style.display = 'none';
    $('hint').style.display = 'none';
    document.getElementById('panelToggle').style.display = 'none';
  }

  // ------------------------------------------------------------------ hotspots
  let labelsOn = !CLEAN;
  const labelBox = $('labels');
  const presetFor = {
    cockpit: 'cockpit', upperdeck: 'side', fan: 'engine', winglet: 'winglet',
    flaps: 'flap', gear: 'gear', apu: 'tail', fin: 'tail', spoiler: 'flap',
  };
  const labelEls = aircraft.hotspots.map((h) => {
    const el = document.createElement('div');
    el.className = 'hot';
    el.innerHTML = '<div class="dot"></div><div class="chip"><b>' + h.label + '</b><small>' + h.text + '</small></div>';
    el.querySelector('.chip').addEventListener('click', () => applyPreset(presetFor[h.id] || 'hero'));
    labelBox.appendChild(el);
    return { el, h };
  });

  // ------------------------------------------------------------------ loop
  const clock = new THREE.Clock();
  let t = 0, fps = 60, ctlPhase = 0;
  const readouts = $('readouts');
  let acc = 0, frames = 0;

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
    }

    aircraft.update(dt, t);
    scene.updateCamera(dt);
    scene.renderer.render(scene.scene, scene.camera);

    acc += dt; frames++;
    if (acc > 0.4) {
      fps = frames / acc; acc = 0; frames = 0;
      const info = scene.renderer.info.render;
      readouts.innerHTML =
        '<div>FPS <b>' + fps.toFixed(0) + '</b></div>' +
        '<div>tris <b>' + (info.triangles / 1000).toFixed(0) + 'k</b></div>' +
        '<div>calls <b>' + info.calls + '</b></div>' +
        '<div>meshes <b>' + info.calls + '</b></div>';
    }

    const w = canvas.clientWidth, h = canvas.clientHeight;
    for (const { el, h: hs } of labelEls) {
      const v = hs.anchor.clone().project(scene.camera);
      const on = labelsOn && v.z < 1;
      el.style.display = on ? 'block' : 'none';
      if (on) el.style.transform = 'translate(' + ((v.x * 0.5 + 0.5) * w).toFixed(1) + 'px,' + ((-v.y * 0.5 + 0.5) * h).toFixed(1) + 'px)';
    }
  });

  window.addEventListener('resize', () => scene.resize());
  window.addEventListener('keydown', (ev) => {
    const n = parseInt(ev.key, 10);
    if (n >= 1 && n <= 9 && PRESETS[n - 1]) applyPreset(PRESETS[n - 1].id);
  });

  loadbar.style.width = '100%';
  await tick(120);
  loader.classList.add('done');

  // handy handle for scripting / QA
  window.__747__ = { scene, aircraft, applyPreset, THREE };
}

boot().catch((err) => {
  loadstep.textContent = 'error: ' + err.message;
  console.error(err);
});
