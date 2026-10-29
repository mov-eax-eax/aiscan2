import { createWorld } from './world.js';
import { createSky } from './sky.js';
import { createTerrain } from './terrain.js';
import { createArchitecture } from './architecture.js';
import { createNature } from './nature.js';
import { createEcosystem } from './ecosystem.js';
import { createAttractions } from './attractions.js';
import { PROCESS } from './process.js';

const params = new URLSearchParams(location.search);
const shotMode = params.get('shot') === '1';
if (shotMode) document.body.classList.add('shot-mode');

const stage = document.getElementById('stage');
const loader = document.getElementById('loader');
const orbitButton = document.getElementById('orbit');
const viewButton = document.getElementById('view');
const processButton = document.getElementById('process');
const processOverlay = document.getElementById('processOverlay');
const processBody = document.getElementById('processBody');
const closeProcess = document.getElementById('closeProcess');
const guideButton = document.getElementById('guide');
const guideOverlay = document.getElementById('guideOverlay');
const closeGuide = document.getElementById('closeGuide');
const cycleNumber = document.getElementById('cycleNumber');
const cycleNote = document.getElementById('cycleNote');
const fpsEl = document.getElementById('fps');

const world = createWorld(stage);
const sky = createSky(world.scene);
world.addUpdate(sky.update);
const terrain = createTerrain();
world.scene.add(terrain.group);
const architecture = createArchitecture();
world.scene.add(architecture.group);
const nature = createNature();
world.scene.add(nature.group);
const ecosystem = createEcosystem();
world.scene.add(ecosystem.group);
const attractions = createAttractions();
world.scene.add(attractions.group);
for (const update of architecture.updates) world.addUpdate(update);
for (const update of nature.updates) world.addUpdate(update);
for (const update of ecosystem.updates) world.addUpdate(update);
for (const update of attractions.updates) world.addUpdate(update);

// The base view. Later cycles may move this; keep it centered on the bloom.
world.setView({ theta: 0.86, phi: 0.32, radius: 125, targetY: 25 });
const viewParam = (key, fallback) => {
  const value = Number(params.get(key));
  return Number.isFinite(value) && params.has(key) ? value : fallback;
};
world.setView({
  theta: viewParam('theta', 0.86),
  phi: viewParam('phi', 0.32),
  radius: viewParam('radius', 125),
  targetY: viewParam('target', 25),
});
if (params.get('orbit') === '0') world.setAutoOrbit(false);
orbitButton.classList.toggle('on', world.getAutoOrbit());

const last = PROCESS[PROCESS.length - 1];
cycleNumber.textContent = `CYCLE ${last.n}`;
cycleNote.textContent = last.title.toLowerCase();

function renderProcess() {
  processBody.innerHTML = `
    <p class="process-intro">The park is improved through recursive self-improvement cycles. Each pass starts with a render, a dispassionate critique of what is actually there, and one highest-leverage action. Nothing is hidden: the process below is the run board.</p>
    <div class="cycles">
      ${PROCESS.map((entry) => `
        <article class="cycle-card">
          <span class="n">${entry.n}</span>
          <div>
            <div class="cycle-visual"><img src="./shots/cycle-${entry.n}.png" alt="Cycle ${entry.n} render" loading="lazy" /></div>
            <h3>${entry.title}</h3>
            <p>${entry.critique}</p>
            <p class="critique"><b>Action:</b> ${entry.action}</p>
          </div>
        </article>
      `).join('')}
    </div>
  `;
}
renderProcess();

processButton.addEventListener('click', () => {
  processOverlay.hidden = false;
});
closeProcess.addEventListener('click', () => {
  processOverlay.hidden = true;
});
processOverlay.addEventListener('click', (event) => {
  if (event.target === processOverlay) processOverlay.hidden = true;
});
guideButton.addEventListener('click', () => {
  guideOverlay.hidden = false;
});
closeGuide.addEventListener('click', () => {
  guideOverlay.hidden = true;
});
guideOverlay.addEventListener('click', (event) => {
  if (event.target === guideOverlay) guideOverlay.hidden = true;
});
orbitButton.addEventListener('click', () => {
  const next = !world.getAutoOrbit();
  world.setAutoOrbit(next);
  orbitButton.classList.toggle('on', next);
  orbitButton.textContent = `Auto orbit: ${next ? 'on' : 'off'}`;
});
orbitButton.textContent = `Auto orbit: ${world.getAutoOrbit() ? 'on' : 'off'}`;

const views = [
  { label: 'island', view: { theta: 0.86, phi: 0.32, radius: 125, targetY: 25 } },
  { label: 'crown', view: { theta: 0.72, phi: 0.24, radius: 57, targetY: 49 } },
  { label: 'promenade', view: { theta: 1.15, phi: 0.19, radius: 82, targetY: 12 } },
];
let viewIndex = 0;
viewButton.addEventListener('click', () => {
  viewIndex = (viewIndex + 1) % views.length;
  const preset = views[viewIndex];
  world.setAutoOrbit(false);
  orbitButton.classList.remove('on');
  orbitButton.textContent = 'Auto orbit: off';
  world.setView(preset.view);
  viewButton.textContent = `View: ${preset.label}`;
});

let frames = 0;
let frameTime = 0;
let currentFps = 0;
function fpsTick(now) {
  frames++;
  if (!fpsTick.last) fpsTick.last = now;
  frameTime += now - fpsTick.last;
  fpsTick.last = now;
  if (frameTime > 500) {
    currentFps = Math.round((frames * 1000) / frameTime);
    fpsEl.textContent = `${currentFps} fps`;
    frames = 0;
    frameTime = 0;
  }
  requestAnimationFrame(fpsTick);
}
requestAnimationFrame(fpsTick);

requestAnimationFrame(() => {
  setTimeout(() => loader.classList.add('hidden'), shotMode ? 0 : 450);
});

world.renderer.shadowMap.needsUpdate = true;
window.__ready = true;
window.__app = {
  getStats: () => ({
    fps: currentFps,
    calls: world.renderer.info.render.calls,
    triangles: world.renderer.info.render.triangles,
    geometries: world.renderer.info.memory.geometries,
    textures: world.renderer.info.memory.textures,
  }),
};
window.__alien04 = { world, scene: world.scene, camera: world.camera, renderer: world.renderer, PROCESS, version: 'alien-park4-base' };
