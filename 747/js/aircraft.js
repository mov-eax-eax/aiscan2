// js/aircraft.js — assembles every subsystem and exposes the animation API.
import * as THREE from '../lib/three.module.min.js';
import { clamp, lerp, easeInOut } from './util.js';
import { createMaterials, LIVERIES } from './materials.js';
import { buildFuselage, FUSE } from './fuselage.js';
import { buildWings, wingPoint } from './wings.js';
import { buildEngines, ENGINE } from './engines.js';
import { buildTail } from './tail.js';
import { buildGear, GROUND_Y } from './gear.js';
import { buildDetails } from './details.js';

export { GROUND_Y, LIVERIES };

export const SPEC = {
  length: 70.66, span: 64.44, height: 19.41, fuseWidth: 6.50,
  wingArea: 541.2, sweep: 37.5, mtow: 396890, oew: 178800, fuel: 216840,
  range: 13450, cruise: 0.855, ceiling: 13700, engines: '4 x PW4056 / CF6-80C2',
  thrust: 252, pax: 416, cargo: 170, firstFlight: 1988,
};

export function createAircraft(renderer) {
  const mats = createMaterials(renderer);
  mats.setLivery(0);

  const group = new THREE.Group();
  group.name = 'Boeing 747-400';

  const fuselage = buildFuselage(mats);
  const wings = buildWings(mats);
  const engines = buildEngines(mats);
  const tail = buildTail(mats);
  const gear = buildGear(mats);
  let details = buildDetails(mats);
  group.add(fuselage, wings.group, engines.group, tail.group, gear.group, details.group);

  // Remember home transforms so the exploded view can offset them.
  const movable = [];
  const markMovable = (obj, exp) => {
    obj.userData.home = obj.position.clone();
    obj.userData.exp = exp.clone();
    movable.push(obj);
  };
  for (const name of ['wing-R', 'wing-L']) {
    const w = wings.group.getObjectByName(name);
    if (w) markMovable(w, new THREE.Vector3(name.endsWith('R') ? 6 : -6, 4.5, 0));
  }
  for (const child of engines.group.children) {
    if (child.name === 'engine') {
      const s = Math.sign(child.position.z) || 1;
      markMovable(child, child.position.clone().add(new THREE.Vector3(0, -5.0, s * 4.0)));
    }
  }
  markMovable(tail.group, new THREE.Vector3(-4.5, 5.5, 0));
  markMovable(gear.group, new THREE.Vector3(0, -3.0, 0));
  markMovable(details.group, new THREE.Vector3(3.0, 0.6, 0));

  const state = {
    gear: 1, flaps: 0, spoilers: 0, aileron: 0, elevator: 0, rudder: 0,
    spool: 0.55, reverser: 0, explode: 0, night: false, livery: 0,
  };

  const setGear = (t) => { state.gear = clamp(t, 0, 1); gear.setGear(state.gear); };
  const setFlaps = (t) => {
    state.flaps = clamp(t, 0, 1);
    wings.setFlaps(state.flaps);
    wings.setSlats(clamp(state.flaps * 1.6, 0, 1));
  };
  const setSpoilers = (t) => { state.spoilers = clamp(t, 0, 1); wings.setSpoilers(state.spoilers); };
  const setAileron = (t) => { state.aileron = clamp(t, -1, 1); wings.setAilerons(state.aileron); };
  const setElevator = (t) => { state.elevator = clamp(t, -1, 1); tail.setElevators(state.elevator); };
  const setRudder = (t) => { state.rudder = clamp(t, -1, 1); tail.setRudder(state.rudder); };
  const setReverser = (t) => { state.reverser = clamp(t, 0, 1); engines.setReversers(state.reverser); };
  const setSpool = (t) => { state.spool = clamp(t, 0, 1); };
  const setLights = (opts) => details.setLights(opts);
  const setNight = (on) => { state.night = !!on; mats.setNight(state.night); };
  const setLivery = (i) => {
    state.livery = i;
    const liv = mats.setLivery(i);
    // the window row and the decals are livery-specific: rebuild the detail set
    const win = fuselage.getObjectByName('cabin-windows');
    if (win) win.visible = !liv.freighter;
    group.remove(details.group);
    details.group.traverse((o) => { if (o.isMesh && o.geometry) o.geometry.dispose(); });
    const idx = movable.indexOf(details.group);
    if (idx >= 0) movable.splice(idx, 1);
    details = buildDetails(mats);
    group.add(details.group);
    markMovable(details.group, new THREE.Vector3(3.0, 0.6, 0));
    api.parts.details = details;
    setNight(!!liv.night);
    setExplode(state.explode);
    return liv;
  };
  const setExplode = (t) => {
    state.explode = clamp(t, 0, 1);
    const k = easeInOut(state.explode);
    for (const o of movable) o.position.lerpVectors(o.userData.home, o.userData.exp, k);
  };
  const setWireframe = (on) => {
    group.traverse((o) => {
      if (o.isMesh && o.material) {
        const list = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of list) if ('wireframe' in m) m.wireframe = on;
      }
    });
  };

  let fanAngle = 0;
  const update = (dt, time) => {
    fanAngle += dt * lerp(2, 22, state.spool);
    for (const f of engines.fans) f.rotation.x = fanAngle;
    details.update(time);
  };

  const hotspots = [
    { id: 'cockpit', label: 'Flight deck', text: 'Six-pane windscreen; the 747 flight deck sits on the main deck ahead of the upper deck.', anchor: new THREE.Vector3(30.6, 1.9, 0) },
    { id: 'upperdeck', label: 'Upper deck', text: 'The signature hump: a 3.4 m stretch of upper cabin with its own door and three windows per side.', anchor: new THREE.Vector3(22.0, 4.5, 1.6) },
    { id: 'fan', label: 'Turbofan', text: 'High-bypass turbofan, 2.36 m fan, 38 blades, 252 kN take-off thrust. Four of them.', anchor: new THREE.Vector3(3.8, -2.5, 10.6) },
    { id: 'winglet', label: 'Winglet', text: '1.95 m canted winglet added on the -400 to cut induced drag on long sectors.', anchor: new THREE.Vector3(-18.2, 4.3, 32.9) },
    { id: 'flaps', label: 'Fowler flaps', text: 'Triple-slotted inboard and double-slotted outboard flaps translate aft on tracks as they droop.', anchor: new THREE.Vector3(-9.0, 0.9, 12.8) },
    { id: 'gear', label: 'Main gear', text: 'Four four-wheel bogies: 16 main wheels plus 2 on the nose. The body gear steers with the nose gear.', anchor: new THREE.Vector3(-4.3, -5.4, 5.95) },
    { id: 'apu', label: 'APU exhaust', text: 'Auxiliary power unit exhaust at the base of the tail cone.', anchor: new THREE.Vector3(-35.4, 1.9, 0.4) },
    { id: 'fin', label: 'Vertical fin', text: '9.7 m of fin above the crown, with a dorsal fillet feeding into the swept leading edge.', anchor: new THREE.Vector3(-31.0, 11.4, 0.4) },
    { id: 'spoiler', label: 'Spoilers', text: 'Six panels per wing; all deploy for the speedbrake, panels 4-6 also fly as roll spoilers.', anchor: new THREE.Vector3(-4.4, 1.1, 7.6) },
  ];

  const api = {
    group, mats, state, parts: { fuselage, wings, engines, tail, gear, details },
    setGear, setFlaps, setSpoilers, setAileron, setElevator, setRudder,
    setReverser, setSpool, setLights, setNight, setLivery, setExplode, setWireframe,
    update, hotspots, groundY: GROUND_Y, specs: SPEC,
  };
  api.setGear(1);
  api.setFlaps(0);
  api.setSpoilers(0);
  return api;
}
