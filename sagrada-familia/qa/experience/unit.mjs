// Offline unit checks for the pure-math parts of the experience layer
// (collision + guided-tour state machine). No browser, no GPU.
// Run from the project root:  node qa/experience/unit.mjs

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { prepareColliders, resolveCollisions, clampToRadius, isClear } from '../../src/experience/collide.js';
import { createTour } from '../../src/experience/tour.js';
import { flyVerticalInput } from '../../src/experience/controls.js';
import { THREE } from '../../src/lib.js';

const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok, detail });
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`);
}
let failures = 0;
const near = (a, b, eps = 0.01) => Math.abs(a - b) <= eps;

// ---------------------------------------------------------------- collision
{
  const prep = prepareColliders([
    { type: 'box', x: 0, z: 0, hw: 2, hd: 2, y0: 0, y1: 10 },
    { type: 'circle', x: 10, z: 0, r: 1, y0: 0, y1: 10 },
  ]);
  check('prepareColliders keeps valid entries', prep.length === 2, String(prep.length));

  const p = { x: 2, y: 0, z: 0 };
  resolveCollisions(p, 0.42, prep, 0);
  check('box pushes out along +X', near(p.x, 2.42) && near(p.z, 0), `${p.x.toFixed(2)},${p.z.toFixed(2)}`);

  // A Y-rotated box: hw runs along world Z after the rotation, hd along world X.
  const rotated = prepareColliders([{ type: 'box', x: 0, z: 0, hw: 4, hd: 0.5, y0: 0, y1: 10, ry: Math.PI / 2 }]);
  const q = { x: 0, y: 0, z: 1.5 };
  resolveCollisions(q, 0.42, rotated, 0);
  check('Y-rotated box pushes into its thin axis', near(Math.abs(q.x), 0.92) && near(q.z, 1.5), `${q.x.toFixed(2)},${q.z.toFixed(2)}`);

  const c = { x: 10, y: 0, z: 0.5 };
  resolveCollisions(c, 0.42, prep, 0);
  check('circle pushes out', Math.hypot(c.x - 10, c.z) >= 1.41, `${Math.hypot(c.x - 10, c.z).toFixed(2)}`);

  const above = { x: 0, y: 0, z: 0 };
  resolveCollisions(above, 0.42, prepareColliders([{ type: 'box', x: 0, z: 0, hw: 2, hd: 2, y0: 0, y1: 1.0 }]), 1.5);
  check('colliders above the head do not block', near(above.x, 0) && near(above.z, 0), `${above.x},${above.z}`);

  const low = { x: 0, y: 0, z: 0 };
  resolveCollisions(low, 0.42, prepareColliders([{ type: 'box', x: 0, z: 0, hw: 2, hd: 2, y0: 0, y1: 0.2 }]), 0);
  check('ground trim below the ankle does not block', near(low.x, 0) && near(low.z, 0), `${low.x},${low.z}`);

  const cl = { x: 200, y: 0, z: 0 };
  clampToRadius(cl, 128);
  check('player clamp is radial', near(Math.hypot(cl.x, cl.z), 128), Math.hypot(cl.x, cl.z).toFixed(2));

  check('isClear detects a blocked point', isClear(0, 0, 0.4, prep, 0) === false);
  check('isClear accepts an open point', isClear(30, 30, 0.4, prep, 0) === true);
}

// ---------------------------------------------------------------- tour
function makeCamera() {
  const camera = {
    position: new THREE.Vector3(0, 10, 120),
    _dir: new THREE.Vector3(0, 0, -1),
    lookAt(target) {
      this._dir.copy(target).sub(this.position).normalize();
    },
    getWorldDirection(out) {
      return out.copy(this._dir);
    },
  };
  return camera;
}

const TOUR = [
  { id: 'a', title: 'A', kicker: '', body: 'First stop.', pos: [0, 10, 120], target: [0, 10, 0], mode: 'fly', time: 21.5 },
  { id: 'b', title: 'B', kicker: '', body: 'Second stop, a little longer body to read.', pos: [60, 30, 0], target: [0, 10, 0], mode: 'fly', time: null },
  { id: 'c', title: 'C', kicker: '', body: 'Third stop.', pos: [0, 2, 40], target: [0, 10, 0], mode: 'walk', time: 10.35 },
];

{
  const camera = makeCamera();
  const events = { stops: [], finished: 0, paused: [] };
  const tour = createTour({
    camera,
    TOUR,
    prepared: [],
    playerClamp: 128,
    callbacks: {
      onStop(stop, index) {
        events.stops.push(stop.id);
      },
      onFinish() {
        events.finished++;
      },
      onPause(paused) {
        events.paused.push(paused);
      },
    },
  });
  check('tour exposes authored stops', tour.stops.length === 3, String(tour.stops.length));

  tour.start(0, { instant: true });
  check('instant start lands on the stop', near(camera.position.z, 120) && near(camera.position.y, 10), camera.position.toArray().map((v) => v.toFixed(1)).join(','));
  check('onStop fires for the first stop', events.stops[0] === 'a', events.stops.join(','));

  // Let the first dwell elapse, then its travel, then reach stop b.
  let guard = 0;
  while (tour.getState().index === 0 && guard++ < 4000) tour.update(0.1);
  while (tour.getState().phase === 'travel' && guard++ < 8000) tour.update(0.1);
  const afterTravel = tour.getState();
  check('auto-advance reaches the second stop', afterTravel.index === 1 && afterTravel.phase === 'dwell', `${afterTravel.index}/${afterTravel.phase}`);
  check('travel arrives at the authored position', camera.position.distanceTo(tour.stops[1].posVec) < 0.1, camera.position.toArray().map((v) => v.toFixed(1)).join(','));
  check('onStop fires on arrival', events.stops.includes('b'), events.stops.join(','));

  // Pause freezes the dwell progress.
  tour.setPaused(true);
  const pausedAt = tour.getState().progress;
  for (let i = 0; i < 20; i++) tour.update(0.1);
  check('pause freezes dwell progress', near(tour.getState().progress, pausedAt, 0.001), `${pausedAt.toFixed(3)} → ${tour.getState().progress.toFixed(3)}`);
  tour.setPaused(false);

  tour.next();
  check('next starts a travel', tour.getState().phase === 'travel');
  guard = 0;
  while (tour.getState().phase === 'travel' && guard++ < 8000) tour.update(0.1);
  check('next reaches the third stop', tour.getState().index === 2, String(tour.getState().index));
  tour.prev();
  guard = 0;
  while (tour.getState().phase === 'travel' && guard++ < 8000) tour.update(0.1);
  check('prev goes back', tour.getState().index === 1, String(tour.getState().index));

  // Finish from the last stop.
  tour.start(2, { instant: true });
  guard = 0;
  while (events.finished === 0 && guard++ < 6000) tour.update(0.1);
  check('tour finishes after the last stop', events.finished === 1, String(events.finished));
  check('finished tour is inactive', tour.isActive() === false);
}

// ---------------------------------------------------- tour stop safety
{
  const camera = makeCamera();
  const prepared = prepareColliders([{ type: 'box', x: 0, z: 0, hw: 3, hd: 3, y0: 0, y1: 100 }]);
  const tour = createTour({
    camera,
    TOUR: [{ id: 'inside', title: 'Inside', body: 'x', pos: [0, 2, 0], target: [0, 2, 40], mode: 'walk' }],
    prepared,
    playerClamp: 128,
  });
  const stop = tour.stops[0];
  check('a stop inside a wall is pushed clear', Math.hypot(stop.posVec.x, stop.posVec.z) > 3.5, Math.hypot(stop.posVec.x, stop.posVec.z).toFixed(2));
  check('safe stop is clear at eye height', isClear(stop.posVec.x, stop.posVec.z, 0.8, prepared, Math.max(0, stop.posVec.y - 1.72)), '');
}

// ------------------------------------------------- fly vertical input mapping
{
  const K = (...codes) => new Set(codes);
  check('fly: Space rises', flyVerticalInput({ keys: K('Space') }) === 1);
  check('fly: E rises', flyVerticalInput({ keys: K('KeyE') }) === 1);
  check('fly: Ctrl descends', flyVerticalInput({ keys: K('ControlLeft') }) === -1);
  check('fly: Q descends', flyVerticalInput({ keys: K('KeyQ') }) === -1);
  check('fly: E reads instead of rising near a hotspot', flyVerticalInput({ keys: K('KeyE'), hotspotActive: true }) === 0);
  check('fly: opposite keys cancel', flyVerticalInput({ keys: K('Space', 'KeyQ') }) === 0);
  check('fly: touch analogue is respected and clamped', flyVerticalInput({ keys: K('Space'), touchVertical: 0.6 }) === 1 && flyVerticalInput({ keys: K(), touchVertical: -0.4 }) === -0.4);
  check('fly: jump queue is ignored (no Space in walk input)', flyVerticalInput({ keys: K() }) === 0);
}

// --------------------------------------- static: Space is registered for fly
{
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
  const source = fs.readFileSync(path.join(root, 'src/experience/controls.js'), 'utf8');
  check("controls keydown registers Space in the key set", /keys\.add\('Space'\)/.test(source));
  const flyBody = source.match(/function updateFly\(dt\) \{[\s\S]*?\n  \}/);
  check('updateFly uses flyVerticalInput', !!flyBody && /flyVerticalInput\(\{ keys, touchVertical/.test(flyBody[0]));
  check('updateFly does not read Space directly', !!flyBody && !/keys\.has\('Space'\)/.test(flyBody[0]));
  const walkBody = source.match(/function updateWalk\(dt\) \{[\s\S]*?\n  \}/);
  check('updateWalk never uses Space as a held key (no bunny hop)', !!walkBody && !/keys\.has\('Space'\)/.test(walkBody[0]));
  const experienceSource = fs.readFileSync(path.join(root, 'src/experience.js'), 'utf8');
  check('experience supplies the hotspotActive callback', /hotspotActive\(\) \{[\s\S]*?activeHotspot/.test(experienceSource));
}

console.log(`\n${results.length - failures}/${results.length} unit checks passed, ${failures} failed.`);
process.exit(failures === 0 ? 0 : 1);
