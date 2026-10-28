/* 20-env.js — the day/night dial plus the tiny observer registry that lets each
   module light and animate its own objects without editing the composition root.

   - ENV.night / ENV.nightTarget : 0 = golden hour, 1 = night
   - registerEnv(fn)             : fn(night) runs every frame after the dial eases
   - registerUpdater(fn)         : fn(dt, elapsed) runs every frame before render
   Keep side effects inside your own module; never mutate another module's state. */

const ENV = { night: 0, nightTarget: 0 };
// deep link straight to the night view: index.html#night
if (location.hash === '#night') { ENV.night = 1; ENV.nightTarget = 1; }

const PALETTE = {
  skyTopDay: new THREE.Color(0x3f6fb8),
  skyTopNight: new THREE.Color(0x02040c),
  skyBotDay: new THREE.Color(0xf4d3a6),
  skyBotNight: new THREE.Color(0x0e1a30),
  fogDay: new THREE.Color(0xdfd2be),
  fogNight: new THREE.Color(0x0a1120),
  hemiSkyDay: new THREE.Color(0xc9dcff),
  hemiSkyNight: new THREE.Color(0x1a2744),
  hemiGroundDay: new THREE.Color(0x6b5942),
  hemiGroundNight: new THREE.Color(0x0b0d14),
};

const envHandlers = [];
const updaters = [];
let envScene = null;

function initEnv(scene) {
  envScene = scene;
  scene.fog = new THREE.Fog(0xdfd2be, 900, 3200);
}

function registerEnv(handler) {
  envHandlers.push(handler);
}

function registerUpdater(fn) {
  updaters.push(fn);
}

function tickEnv(dt) {
  ENV.night += (ENV.nightTarget - ENV.night) * (1 - Math.exp(-dt * 2.2));
  if (Math.abs(ENV.nightTarget - ENV.night) < 0.001) ENV.night = ENV.nightTarget;

  for (let i = 0; i < envHandlers.length; i++) envHandlers[i](ENV.night);

  if (envScene && envScene.fog) {
    envScene.fog.color.copy(PALETTE.fogDay).lerp(PALETTE.fogNight, ENV.night);
  }
}

function runUpdaters(dt, elapsed) {
  for (let i = 0; i < updaters.length; i++) updaters[i](dt, elapsed);
}
