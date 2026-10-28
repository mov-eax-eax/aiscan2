// qa/smoke.mjs — headless geometry check: builds every subsystem with stub materials,
// counts primitives, verifies normals face outward and exercises the animation API.
import * as THREE from '../lib/three.module.min.js';
import { buildFuselage, fuselageGeometry, fusePoint, fuseNormalAt } from '../js/fuselage.js';
import { buildWings } from '../js/wings.js';
import { buildEngines } from '../js/engines.js';
import { buildTail } from '../js/tail.js';
import { buildGear, GROUND_Y } from '../js/gear.js';

const stubMat = () => new THREE.MeshStandardMaterial();
const mats = new Proxy({}, { get: () => stubMat() });

const parts = {
  fuselage: buildFuselage(mats),
  wings: buildWings(mats),
  engines: buildEngines(mats),
  tail: buildTail(mats),
  gear: buildGear(mats),
};

const root = new THREE.Group();
for (const k of Object.keys(parts)) root.add(parts[k].group || parts[k]);
root.updateMatrixWorld(true);

let meshes = 0, tris = 0, verts = 0, nan = 0;
const box = new THREE.Box3();
root.traverse((o) => {
  if (!o.isMesh) return;
  meshes++;
  const g = o.geometry;
  const pos = g.attributes.position;
  if (!pos) return;
  const inst = o.isInstancedMesh ? o.count : 1;
  tris += Math.round(((g.index ? g.index.count : pos.count) / 3) * inst);
  verts += pos.count * inst;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) nan++;
  }
  g.computeBoundingBox();
  const b = g.boundingBox.clone();
  if (o.isInstancedMesh) { /* instance matrices are near identity for our fans */ }
  box.union(b);
});

// --- outward-normal audit on the closed lofts (fuselage skin, nacelle shells, tyres)
function outwardScore(mesh) {
  const g = mesh.geometry;
  const pos = g.attributes.position, nor = g.attributes.normal, idx = g.index;
  if (!idx || !nor) return null;
  let good = 0, bad = 0;
  const c = new THREE.Vector3(), a = new THREE.Vector3(), b = new THREE.Vector3(), d = new THREE.Vector3();
  g.computeBoundingBox();
  g.boundingBox.getCenter(c);
  const step = Math.max(3, Math.floor(idx.count / 900));
  for (let i = 0; i < idx.count - 2; i += step * 3) {
    const i0 = idx.getX(i), i1 = idx.getX(i + 1), i2 = idx.getX(i + 2);
    a.fromBufferAttribute(pos, i0); b.fromBufferAttribute(pos, i1); d.fromBufferAttribute(pos, i2);
    const face = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(d, a)).normalize();
    const mid = new THREE.Vector3().addVectors(a, b).add(d).multiplyScalar(1 / 3).sub(c);
    if (face.dot(mid) > 0) good++; else bad++;
  }
  return { mesh: mesh.name || mesh.type, good, bad, pct: Math.round((good / Math.max(1, good + bad)) * 100) };
}
const audits = [];
for (const name of ['fuselage-skin', 'fan-cowl', 'core-cowl', 'fin', 'wing-box-R', 'wing-box-L']) {
  const m = root.getObjectByName(name);
  if (m && m.isMesh) audits.push(outwardScore(m));
}

// --- surface sanity: analytic normal vs finite-difference normal, and radius continuity
let normalErr = 0, maxNormalErr = 0;
for (let i = 0; i < 400; i++) {
  const x = -33 + Math.random() * 66;
  const th = Math.random() * Math.PI * 2;
  const p0 = fusePoint(x, th), n = fuseNormalAt(x, th);
  const e = 0.02;
  const p1 = fusePoint(x + e, th), p2 = fusePoint(x, th + e);
  const fd = new THREE.Vector3().subVectors(p2, p0).cross(new THREE.Vector3().subVectors(p1, p0)).normalize();
  const err = 1 - Math.abs(fd.dot(n));
  const radial = new THREE.Vector3(0, p0.y, p0.z).normalize();
  if (err > 0.02) normalErr++;
  if (p0.length() > 4) maxNormalErr = Math.max(maxNormalErr, err);
}
const fuseGeo = fuselageGeometry(48);

// --- animation API
const w = parts.wings, e = parts.engines, t = parts.tail, gr = parts.gear;
w.setFlaps(1); w.setSlats(1); w.setSpoilers(1); w.setAilerons(1);
e.setReversers(1); e.spool(0.016, 8);
t.setRudder(1); t.setElevators(-1);
gr.setGear(0); gr.setGear(1);
const flapOk = Number.isFinite(w.animate.flaps[0].group.rotation.z) && Math.abs(w.animate.flaps[0].group.rotation.z) > 0.3;
const spoilerOk = Math.abs(w.animate.spoilers[0].group.rotation.z) > 0.3;
const rudderOk = Math.abs(t.rudder.rotation.y) > 0.2;
const elevatorOk = Math.abs(t.elevators[0].group.rotation.z) > 0.2;

console.log(JSON.stringify({
  meshes, triangles: tris, vertices: verts, nanVertices: nan,
  bounds: { min: box.min.toArray().map((v) => +v.toFixed(2)), max: box.max.toArray().map((v) => +v.toFixed(2)) },
  fuselageGeom: { verts: fuseGeo.attributes.position.count, tris: fuseGeo.index.count / 3 },
  normalAudit: audits,
  analyticNormals: { samples: 400, mismatches: normalErr, worst: +maxNormalErr.toFixed(3) },
  animations: { flapOk, spoilerOk, rudderOk, elevatorOk },
  groundY: GROUND_Y,
}, null, 2));
