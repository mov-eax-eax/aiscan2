// Sagrada Família — application bootstrap and integration.
// The Lead owns this file: it builds the renderer, sequences the builders,
// merges their colliders/hotspots/walkables and runs the frame loop.

import * as THREE from 'three';
import { DIM, TOUR } from './config.js';
import * as LIB from './lib.js';
import { buildEnvironment } from './environment.js';
import { buildFacadesNP } from './facades-np.js';
import { buildGloryShell } from './glory-shell.js';
import { buildTowers } from './towers.js';
import { buildInterior } from './interior.js';
import { createExperience } from './experience.js';

const loader = document.getElementById('loader');
const loaderBar = document.getElementById('loader-bar');
const loaderStatus = document.getElementById('loader-status');
const loaderPercent = document.getElementById('loader-percent');
const fatal = document.getElementById('fatal');
const fatalMsg = document.getElementById('fatal-msg');
const errors = [];
const params = new URLSearchParams(location.search);
const DEBUG = params.get('debug') === '1';

function nextFrame() {
  return new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));
}
function setProgress(pct, text) {
  if (loaderBar) loaderBar.style.width = `${pct}%`;
  if (loaderPercent) loaderPercent.textContent = `${Math.round(pct)}%`;
  if (text && loaderStatus) loaderStatus.textContent = text;
}
function recordError(where, err) {
  const message = err && err.stack ? err.stack : String(err);
  errors.push({ where, message });
  console.error(`[sagrada] ${where}`, err);
}

async function boot() {
  // ------------------------------------------------------ GPU capability probe
  // Headless browsers and machines without GPU acceleration often fall back to
  // SwiftShader/llvmpipe. That renders on the CPU and can choke the machine, so
  // detect it up front and enter a lean performance mode automatically.
  function detectSoftwareRenderer() {
    try {
      const c = document.createElement('canvas');
      const gl = c.getContext('webgl2') || c.getContext('webgl');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const name = ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : '';
      const soft = /swiftshader|software|llvmpipe|softpipe|basic render|microsoft basic/i.test(name);
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return soft;
    } catch {
      return false;
    }
  }
  const softwareRenderer = detectSoftwareRenderer();

  // ---------------------------------------------------------------- renderer
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      antialias: !softwareRenderer,
      powerPreference: 'high-performance',
      stencil: false,
      alpha: false,
    });
  } catch (err) {
    recordError('renderer', err);
    if (fatal) fatal.hidden = false;
    if (fatalMsg) fatalMsg.textContent = 'WebGL could not start. Please enable hardware acceleration or try another browser.';
    return;
  }
  // Cap the backing-store resolution. Native 2x/3x DPR on a 4K screen costs
  // 4-9x the pixels for almost no visible benefit on a soft stone model.
  renderer.setPixelRatio(softwareRenderer ? 0.7 : Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = !softwareRenderer;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.02;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.domElement.setAttribute('aria-label', 'Sagrada Família 3D view');
  document.body.insertBefore(renderer.domElement, document.getElementById('ui'));

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x9fc0d8);
  const camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.08, 2600);
  camera.position.set(95, 26, 110);
  camera.lookAt(0, 55, 0);

  // Live state shared between the day/night system, builders and UI.
  const env = {
    // Late-afternoon light: warm, raking, and far more revealing of the
    // sculpture than flat midday sun. The user can scrub to any hour.
    time: 16.5,
    auto: false,
    night: 0, // 0 = day, 1 = full night
    sunDir: new THREE.Vector3(0, 1, 0),
    sun: null,
    moonDir: new THREE.Vector3(0, 1, 0),
    exposure: 1.02,
    quality: 'high',
    elapsed: 0,
    fps: 0,
    ready: false,
    software: softwareRenderer,
  };

  const app = {
    renderer,
    scene,
    camera,
    env,
    DIM,
    TOUR,
    lib: LIB,
    version: '1.0',
    quality: env.quality,
    softwareRenderer,
    qualityHooks: [],
    teleport: () => {},
    setMode: () => {},
    setTimeOfDay,
    setAutoTime,
    setQuality,
    getStats,
    onQuality(fn) {
      app.qualityHooks.push(fn);
      if (env.quality !== 'high') fn(env.quality);
    },
  };

  function setTimeOfDay(hours, auto = false) {
    env.time = ((hours % 24) + 24) % 24;
    env.auto = auto;
  }
  function setAutoTime(on) {
    env.auto = !!on;
  }
  function setQuality(q) {
    if (!['low', 'medium', 'high'].includes(q)) return;
    env.quality = q;
    app.quality = q;
    const dpr = window.devicePixelRatio || 1;
    const ratio = q === 'low' ? (softwareRenderer ? 0.65 : 0.75) : q === 'medium' ? Math.min(dpr, 1.15) : Math.min(dpr, 1.5);
    renderer.setPixelRatio(ratio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    for (const fn of app.qualityHooks) {
      try {
        fn(q);
      } catch (e) {
        recordError('qualityHook', e);
      }
    }
  }
  function getStats() {
    const info = renderer.info;
    return {
      fps: Math.round(env.fps),
      calls: info.render.calls,
      triangles: info.render.triangles,
      geometries: info.memory.geometries,
      textures: info.memory.textures,
      time: env.time,
      quality: env.quality,
    };
  }

  const ctx = {
    scene,
    camera,
    renderer,
    env,
    app,
    DIM,
    TOUR,
    LIB,
    quality: env.quality,
    onQuality(fn) {
      app.onQuality(fn);
    },
  };

  const colliders = [];
  const hotspots = [];
  const walkables = [];
  const updates = [];

  async function buildPhase(label, pct, fn) {
    setProgress(pct, label);
    await nextFrame();
    try {
      const result = fn(ctx);
      if (result) {
        if (result.group) scene.add(result.group);
        if (result.colliders) colliders.push(...result.colliders);
        if (result.hotspots) hotspots.push(...result.hotspots);
        if (result.walkables) walkables.push(...result.walkables);
        if (result.update) updates.push(result.update);
      }
    } catch (err) {
      recordError(label, err);
    }
    await nextFrame();
  }

  setProgress(2, 'Surveying the site…');
  await nextFrame();
  await buildPhase('Laying the plaza and the sky…', 8, buildEnvironment);
  await buildPhase('Raising the outer shell and the Glory façade…', 26, buildGloryShell);
  await buildPhase('Carving the Nativity and Passion façades…', 48, buildFacadesNP);
  await buildPhase('Raising eighteen towers…', 68, buildTowers);
  await buildPhase('Planting the forest of columns…', 86, buildInterior);

  // Make sure a walkable floor always exists.
  if (walkables.length === 0) {
    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(130, 48).rotateX(-Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: 0x7a7264, roughness: 0.92 })
    );
    floor.receiveShadow = true;
    scene.add(floor);
    walkables.push(floor);
  }

  // Software rasterisation: drop to the lean preset and cap the frame rate so a
  // GPU-less machine stays usable instead of pegging every CPU core.
  if (softwareRenderer) {
    setQuality('low');
    console.warn('[sagrada] software WebGL detected — lean performance mode enabled');
  }

  // ----------------------------------------------------------- experience/UI
  setProgress(94, 'Lighting the windows…');
  await nextFrame();
  let experience = null;
  try {
    experience = createExperience({
      ...ctx,
      colliders,
      hotspots,
      walkables,
      updates,
    });
  } catch (err) {
    recordError('experience', err);
  }

  if (!experience) {
    // Absolute fallback: a calm orbit so the model is still visible.
    let a = 0;
    experience = {
      update(dt) {
        a += dt * 0.05;
        camera.position.set(Math.cos(a) * 130 + 20, 62, Math.sin(a) * 130 + 20);
        camera.lookAt(0, 45, 0);
      },
      teleport() {},
      setMode() {},
    };
  }

  app.teleport = (id) => experience.teleport?.(id);
  app.setMode = (m) => experience.setMode?.(m);
  app.experience = experience;
  app.hotspots = hotspots;
  app.colliders = colliders;
  app.walkables = walkables;
  app.errors = errors;

  // ------------------------------------------------------------------ resize
  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    experience?.resize?.(w, h);
  }
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', () => setTimeout(resize, 120));

  // -------------------------------------------------------------------- loop
  const clock = new THREE.Clock();
  let statsAccum = 0;
  let statsFrames = 0;
  // Adaptive resolution: quietly protects weaker GPUs without the user having to
  // hunt for the Quality control. Disabled in QA via ?adaptive=0.
  const adaptive = params.get('adaptive') !== '0';
  let adaptAccum = 0;
  let adaptFrames = 0;
  let adaptCooldown = 4;
  let adaptCeiling = Math.min(window.devicePixelRatio || 1, 1.5);
  function adapt(dt) {
    if (!adaptive) return;
    adaptAccum += dt;
    adaptFrames++;
    adaptCooldown -= dt;
    if (adaptAccum < 2.5) return;
    const fps = adaptFrames / adaptAccum;
    adaptAccum = 0;
    adaptFrames = 0;
    if (env.quality === 'low' || adaptCooldown > 0) return;
    const current = renderer.getPixelRatio();
    if (fps < 42 && current > 0.78) {
      renderer.setPixelRatio(Math.max(0.75, current - 0.15));
      renderer.setSize(window.innerWidth, window.innerHeight);
      adaptCooldown = 5;
    } else if (fps > 58 && current < adaptCeiling - 0.01) {
      renderer.setPixelRatio(Math.min(adaptCeiling, current + 0.1));
      renderer.setSize(window.innerWidth, window.innerHeight);
      adaptCooldown = 8;
    }
  }

  let lastSoftwareRender = 0;
  function frame() {
    requestAnimationFrame(frame);
    if (document.hidden) return;
    const dt = Math.min(clock.getDelta(), 0.1);
    env.elapsed += dt;
    if (env.auto) env.time = (env.time + dt * 0.055) % 24;
    adapt(dt);

    for (const fn of updates) {
      try {
        fn(dt, env.elapsed, env);
      } catch (err) {
        if (!errors.some((e) => e.where === 'update')) recordError('update', err);
      }
    }
    try {
      experience.update(dt, env.elapsed);
    } catch (err) {
      if (!errors.some((e) => e.where === 'experience-update')) recordError('experience-update', err);
    }
    // Cap software rendering to ~30 fps; the simulation still runs at 60.
    if (!softwareRenderer || env.elapsed - lastSoftwareRender >= 1 / 30) {
      renderer.render(scene, camera);
      lastSoftwareRender = env.elapsed;
      statsAccum += dt;
      statsFrames++;
      if (statsAccum >= 0.5) {
        env.fps = statsFrames / statsAccum;
        statsAccum = 0;
        statsFrames = 0;
      }
    }
  }

  setProgress(100, 'Entering the basilica…');
  await nextFrame();
  env.ready = true;
  window.__app = app;
  window.__errors = errors;
  window.__sagrada = {
    ready: true,
    app,
    teleport: (id) => app.teleport(id),
    setMode: (m) => app.setMode(m),
    setTime: (h) => setTimeOfDay(h, false),
    stats: () => getStats(),
    errors: () => errors.slice(),
    mode: () => experience?.mode,
    camera: () => ({ pos: camera.position.toArray(), rot: [camera.rotation.x, camera.rotation.y, camera.rotation.z] }),
  };
  if (DEBUG) {
    const pre = document.createElement('pre');
    pre.id = 'debug-errors';
    pre.style.cssText = 'position:fixed;left:8px;top:8px;z-index:300;max-width:70vw;max-height:40vh;overflow:auto;background:#000c;color:#f88;font:11px monospace;padding:8px;white-space:pre-wrap;pointer-events:none';
    document.body.appendChild(pre);
    setInterval(() => {
      pre.textContent = errors.length ? errors.map((e) => `${e.where}: ${e.message}`).join('\n\n').slice(0, 4000) : 'no errors';
    }, 500);
  }
  frame();
  setTimeout(() => {
    loader?.classList.add('hidden');
    setTimeout(() => {
      if (loader) loader.style.display = 'none';
    }, 1200);
  }, 250);
  console.log('[sagrada] ready', getStats());
}

boot().catch((err) => {
  recordError('boot', err);
  console.error(err);
  if (fatal) fatal.hidden = false;
  if (fatalMsg) fatalMsg.textContent = String(err && err.message ? err.message : err);
});
