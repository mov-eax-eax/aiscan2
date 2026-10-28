// js/aircraft.js — assembles the 747-8 and exposes the animation API and hotspots.
import * as THREE from '../lib/three.module.min.js';
import { clamp, easeInOut } from './util.js';
import { createMaterials, LIVERIES } from './materials.js';
import { buildFuselage } from './fuselage.js';
import { buildWings } from './wings.js';
import { buildEngines } from './engines.js';
import { buildTail } from './tail.js';
import { buildGear, GROUND_Y } from './gear.js';
import { buildDetails } from './details.js';

export { GROUND_Y, LIVERIES };

export const SPEC = {
  length: 76.30, span: 68.40, height: 19.40, fuseWidth: 6.50,
  wingArea: 554.0, sweep: 37.5, mtow: 447700, oew: 220128, fuel: 242470,
  range: 14320, cruise: 0.855, ceiling: 13100,
  engines: '4 \u00D7 GEnx-2B67', thrust: 296, pax: 410, cargo: 170, firstFlight: 2010,
};

export function createAircraft(renderer) {
  const mats = createMaterials(renderer);
  mats.setLivery(0);

  const group = new THREE.Group();
  group.name = 'Boeing 747-8';

  const fuselage = buildFuselage(mats);
  const wings = buildWings(mats);
  const engines = buildEngines(mats);
  const tail = buildTail(mats);
  const gear = buildGear(mats);
  let details = buildDetails(mats);
  group.add(fuselage, wings.group, engines.group, tail.group, gear.group, details.group);

  // Remember home transforms so the exploded view can offset the assemblies.
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
    spool: 0.55, reverser: 0, explode: 0, cabin: true, livery: 0,
  };

  const setGear = (t) => { state.gear = clamp(t, 0, 1); gear.setGear(state.gear); };
  const setFlaps = (t) => {
    state.flaps = clamp(t, 0, 1);
    wings.setFlaps(state.flaps);
    wings.setSlats(clamp(state.flaps * 1.5, 0, 1));
  };
  const setSpoilers = (t) => { state.spoilers = clamp(t, 0, 1); wings.setSpoilers(state.spoilers); };
  const setAileron = (t) => { state.aileron = clamp(t, -1, 1); wings.setAilerons(state.aileron); };
  const setElevator = (t) => { state.elevator = clamp(t, -1, 1); tail.setElevators(state.elevator); };
  const setRudder = (t) => { state.rudder = clamp(t, -1, 1); tail.setRudder(state.rudder); };
  const setReverser = (t) => { state.reverser = clamp(t, 0, 1); engines.setReversers(state.reverser); };
  const setSpool = (t) => { state.spool = clamp(t, 0, 1); };
  const setLights = (opts) => details.setLights(opts);
  const setCabin = (on) => {
    state.cabin = !!on;
    mats.setCabin(state.cabin, 0.34);
  };
  const setNight = setCabin;
  const setLivery = (i) => {
    state.livery = i;
    const liv = mats.setLivery(i);
    // titles and registrations are livery specific: rebuild the detail set
    group.remove(details.group);
    details.group.traverse((o) => { if (o.isMesh && o.geometry) o.geometry.dispose(); });
    const idx = movable.indexOf(details.group);
    if (idx >= 0) movable.splice(idx, 1);
    details = buildDetails(mats);
    group.add(details.group);
    markMovable(details.group, new THREE.Vector3(3.0, 0.6, 0));
    api.parts.details = details;
    setCabin(state.cabin);
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
    fanAngle += dt * (1.5 + state.spool * 24);
    for (const f of engines.fans) f.rotation.x = fanAngle;
    details.update(time);
  };

  const hotspots = [
    { id: 'cockpit', label: 'Flight deck', text: 'Six curved windscreen panes and two sliding side windows above the 747-8 radome.', anchor: new THREE.Vector3(33.2, 3.7, 0) },
    { id: 'upperdeck', label: 'Upper deck', text: 'The stretched upper deck runs 9.6 m further aft than the 747-400 and carries its own door.', anchor: new THREE.Vector3(24.0, 4.85, 1.9) },
    { id: 'fan', label: 'GEnx-2B67', text: '2.82 m fan, 18 wide-chord composite blades, 296 kN take-off thrust. Four of them.', anchor: new THREE.Vector3(5.0, -2.5, 11.0) },
    { id: 'tip', label: 'Raked wingtip', text: 'The 747-8 replaces winglets with a raked, highly swept tip that extends the span to 68.4 m.', anchor: new THREE.Vector3(-18.8, 4.3, 33.4) },
    { id: 'flaps', label: 'Fowler flaps', text: 'Three panels per wing translate aft on curved tracks as they droop to 42 degrees.', anchor: new THREE.Vector3(-5.6, 1.1, 13.0) },
    { id: 'gear', label: 'Main gear', text: 'Four four-wheel bogies: 16 main wheels plus two on the nose gear; the body gear steers with the nose.', anchor: new THREE.Vector3(-1.8, -4.9, 5.75) },
    { id: 'apu', label: 'APU exhaust', text: 'Auxiliary power unit in the tail cone; the exhaust sits above the aft fuselage.', anchor: new THREE.Vector3(-36.6, 2.7, 0.3) },
    { id: 'fin', label: 'Vertical fin', text: 'A 14 m fin above the crown with a dorsal fillet blending into the swept leading edge.', anchor: new THREE.Vector3(-29.0, 12.0, 0.4) },
    { id: 'spoiler', label: 'Spoilers', text: 'Six flying-spoiler panels per wing; all six lift for the speedbrake.', anchor: new THREE.Vector3(-2.8, 1.8, 7.6) },
    { id: 'doors', label: 'Main doors', text: 'Five pair of 1.98 m main-deck doors, plus one upper-deck door and three cargo doors.', anchor: new THREE.Vector3(19.2, 0.9, 3.0) },
  ];

  const api = {
    group, mats, state, parts: { fuselage, wings, engines, tail, gear, details },
    setGear, setFlaps, setSpoilers, setAileron, setElevator, setRudder,
    setReverser, setSpool, setLights, setCabin, setNight, setLivery, setExplode, setWireframe,
    update, hotspots, groundY: GROUND_Y, specs: SPEC,
  };
  api.setGear(1);
  api.setFlaps(0);
  api.setSpoilers(0);
  setCabin(true);
  return api;
}
