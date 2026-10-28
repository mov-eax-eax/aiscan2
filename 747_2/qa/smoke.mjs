// qa/smoke.mjs — build every subsystem in plain Node with stub materials and audit it.
import * as THREE from '../lib/three.module.min.js';
import { buildFuselage, WINDOW_X, UPPER_WINDOW_X } from '../js/fuselage.js';
import { buildWings, wingPoint, WING } from '../js/wings.js';
import { buildEngines } from '../js/engines.js';
import { buildTail } from '../js/tail.js';
import { buildGear, GROUND_Y } from '../js/gear.js';

const mats = new Proxy({}, { get: () => new THREE.MeshStandardMaterial() });

const parts = {
  fuselage: buildFuselage(mats),
  wings: buildWings(mats),
  engines: buildEngines(mats),
  tail: buildTail(mats),
  gear: buildGear(mats),
};
const root = new THREE.Group();
for (const k in parts) root.add(parts[k].group || parts[k]);
root.updateMatrixWorld(true);

let meshes = 0, tris = 0, verts = 0, nan = 0, instanced = 0;
const box = new THREE.Box3();
root.traverse((o) => {
  if (!o.isMesh) return;
  meshes++;
  if (o.isInstancedMesh) instanced++;
  const g = o.geometry;
  const pos = g.attributes.position;
  if (!pos) return;
  const inst = o.isInstancedMesh ? o.count : 1;
  tris += Math.round(((g.index ? g.index.count : pos.count) / 3) * inst);
  verts += pos.count * inst;
  for (let i = 0; i < pos.count; i++) {
    if (!Number.isFinite(pos.getX(i)) || !Number.isFinite(pos.getY(i)) || !Number.isFinite(pos.getZ(i))) nan++;
  }
  g.computeBoundingBox();
  box.union(g.boundingBox.clone());
});

const size = { length: box.max.x - box.min.x, span: box.max.z - box.min.z, height: box.max.y - box.min.y };

// exercise animation API
const w = parts.wings, e = parts.engines, t = parts.tail, gr = parts.gear;
w.setFlaps(1); w.setSlats(1); w.setSpoilers(1); w.setAilerons(1);
e.setReversers(0.6); e.spool(0.05, 300);
t.setRudder(1); t.setElevators(-1);
gr.setGear(0.5); gr.setGear(1);

const fuseMesh = parts.fuselage.getObjectByName('fuselage-skin');
const g = fuseMesh.geometry;
const pos = g.attributes.position, nor = g.attributes.normal;
let good = 0, bad = 0;
const centerY = 0.5;
for (let i = 0; i < pos.count; i += 7) {
  const p = new THREE.Vector3(pos.getX(i), pos.getY(i), pos.getZ(i));
  const n = new THREE.Vector3(nor.getX(i), nor.getY(i), nor.getZ(i));
  const radial = new THREE.Vector3(0, p.y - centerY, p.z);
  if (n.dot(radial) > 0) good++; else bad++;
}

console.log(JSON.stringify({
  meshes, instancedMeshes: instanced, triangles: tris, vertices: verts, nanVertices: nan,
  bounds: { min: box.min.toArray().map((v) => +v.toFixed(2)), max: box.max.toArray().map((v) => +v.toFixed(2)) },
  size: { length: +size.length.toFixed(2), span: +size.span.toFixed(2), height: +size.height.toFixed(2) },
  groundY: GROUND_Y, windowInstances: (WINDOW_X.length + UPPER_WINDOW_X.length) * 2,
  fuselageWindows: WINDOW_X.length, upperWindows: UPPER_WINDOW_X.length,
  fuselageNormals: { good, bad },
  wingTip: wingPoint(WING.semiSpan, 0.5, 1, true).toArray().map((v) => +v.toFixed(2)),
  flapRotation: +w.animate.flaps[0].group.rotation.z.toFixed(3),
  slatRotation: +w.animate.slats[0].group.rotation.z.toFixed(3),
  spoilerRotation: +w.animate.spoilers[0].group.rotation.z.toFixed(3),
  rudder: +t.rudder.rotation.y.toFixed(3),
  elevator: +t.elevators[0].group.rotation.z.toFixed(3),
}, null, 2));
