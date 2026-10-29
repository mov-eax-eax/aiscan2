/* Small geometry helpers shared by every part.
   Bow convention, used everywhere in this project:

     +Y  up the bow (riser centre at y = 0)
     +X  toward the archer  (the string plane lives at x = +150)
     -X  toward the target  (arrow, sight extension, stabilisers point -X)
     +-Z  the two flat sides of the bow

   Units are millimetres, so a 25" riser really is 635 tall and a 68" bow
   really is 1727 tip to tip. Nothing here is simulated; these are drawn
   dimensions. */
import * as THREE from '../../vendor/three.module.js';

export const TAU = Math.PI * 2;

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;

/* ------------------------------------------------------------- ribbons --- */

/* Sweep a width/thickness profile along a curve, with the ribbon's "up"
   direction rotated by a per-station roll so the face can twist like a real
   limb does as it rolls into the recurve. Returns a closed solid. */
export function ribbon({ curve, samples = 90, halfWidth, halfThick, roll, sides = 8 }) {
  const pos = [];
  const idx = [];
  const up = new THREE.Vector3(0, 1, 0);

  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const p = curve.getPointAt(t);
    const tan = curve.getTangentAt(t).normalize();
    const side = new THREE.Vector3().crossVectors(tan, up);
    if (side.lengthSq() < 1e-9) side.set(0, 0, 1);
    side.normalize();
    const nrm = new THREE.Vector3().crossVectors(side, tan).normalize();

    const hw = halfWidth(t);
    const ht = halfThick(t);
    const r = roll ? roll(t) : 0;
    const cs = Math.cos(r), sn = Math.sin(r);
    /* roll the cross-section about the tangent */
    const e1 = side.clone().multiplyScalar(cs).addScaledVector(nrm, sn);
    const e2 = nrm.clone().multiplyScalar(cs).addScaledVector(side, -sn);

    for (let s = 0; s < sides; s++) {
      const a = (s / sides) * TAU;
      /* rounded rectangle -> reads as a laminated limb edge */
      const ca = Math.cos(a), sa = Math.sin(a);
      const k = 2.4;
      const px = Math.sign(ca) * Math.pow(Math.abs(ca), 2 / k) * hw;
      const py = Math.sign(sa) * Math.pow(Math.abs(sa), 2 / k) * ht;
      pos.push(
        p.x + e1.x * px + e2.x * py,
        p.y + e1.y * px + e2.y * py,
        p.z + e1.z * px + e2.z * py,
      );
    }
  }
  for (let i = 0; i < samples; i++) {
    for (let s = 0; s < sides; s++) {
      const a = i * sides + s;
      const b = i * sides + ((s + 1) % sides);
      const c = a + sides;
      const d = b + sides;
      idx.push(a, c, b, b, c, d);
    }
  }
  /* caps */
  const capA = pos.length / 3;
  const p0 = curve.getPointAt(0), p1 = curve.getPointAt(1);
  pos.push(p0.x, p0.y, p0.z, p1.x, p1.y, p1.z);
  for (let s = 0; s < sides; s++) {
    const a = 0 * sides + s, b = 0 * sides + ((s + 1) % sides);
    idx.push(capA, b, a);
    const c = samples * sides + s, d = samples * sides + ((s + 1) % sides);
    idx.push(capA + 1, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/* ------------------------------------------------------------ tubes ----- */

export function tube({ from, to, r0, r1 = null, seg = 20, radial = 16 }) {
  const a = new THREE.Vector3(...from);
  const b = new THREE.Vector3(...to);
  const dir = new THREE.Vector3().subVectors(b, a);
  const len = dir.length();
  const rr = r1 === null ? r0 : r1;
  const g = new THREE.CylinderGeometry(r0, rr, len, radial, seg, false);
  g.translate(0, len / 2, 0);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
  g.applyQuaternion(q);
  g.translate(a.x, a.y, a.z);
  return g;
}

/* Cylinder specified as a chain of stations, for tapered/twisted things. */
export function chain(points, radii, { radial = 16 } = {}) {
  const pos = [], idx = [];
  const up = new THREE.Vector3(0, 1, 0);
  const P = points.map(p => new THREE.Vector3(...p));
  for (let i = 0; i < P.length; i++) {
    const tan = new THREE.Vector3();
    if (i === 0) tan.subVectors(P[1], P[0]);
    else if (i === P.length - 1) tan.subVectors(P[i], P[i - 1]);
    else tan.subVectors(P[i + 1], P[i - 1]);
    tan.normalize();
    const side = new THREE.Vector3().crossVectors(tan, up);
    if (side.lengthSq() < 1e-9) side.set(1, 0, 0);
    side.normalize();
    const nrm = new THREE.Vector3().crossVectors(side, tan).normalize();
    const r = radii[i];
    for (let s = 0; s < radial; s++) {
      const a = (s / radial) * TAU;
      pos.push(
        P[i].x + side.x * Math.cos(a) * r + nrm.x * Math.sin(a) * r,
        P[i].y + side.y * Math.cos(a) * r + nrm.y * Math.sin(a) * r,
        P[i].z + side.z * Math.cos(a) * r + nrm.z * Math.sin(a) * r,
      );
    }
  }
  for (let i = 0; i < P.length - 1; i++) {
    for (let s = 0; s < radial; s++) {
      const a = i * radial + s, b = i * radial + ((s + 1) % radial);
      idx.push(a, a + radial, b, b, a + radial, b + radial);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/* ---------------------------------------------------------- solids ------ */

/* Box with rounded long edges on the X/Z faces: the shape of every machined
   fitting on this bow (pockets, sight blocks, v-bar, dampers). */
export function roundedBox(w, h, d, r = 2.5, seg = 3) {
  const shape = new THREE.Shape();
  const x = w / 2 - r, y = h / 2 - r;
  shape.moveTo(-x - r, -y);
  shape.lineTo(-x - r, y);
  shape.quadraticCurveTo(-x - r, y + r, -x, y + r);
  shape.lineTo(x, y + r);
  shape.quadraticCurveTo(x + r, y + r, x + r, y);
  shape.lineTo(x + r, -y);
  shape.quadraticCurveTo(x + r, -y - r, x, -y - r);
  shape.lineTo(-x, -y - r);
  shape.quadraticCurveTo(-x - r, -y - r, -x - r, -y);
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: d - 2 * r > 0 ? d - 2 * r : 0.01,
    bevelEnabled: true, bevelThickness: r, bevelSize: r * 0.7,
    bevelSegments: seg, curveSegments: seg + 2,
  });
  g.center();
  return g;
}

/* Flat disc with a hole - stabiliser weights, washers, apertures. */
export function ring(rOuter, rInner, thickness, { seg = 48 } = {}) {
  const shape = new THREE.Shape();
  shape.absarc(0, 0, rOuter, 0, TAU, false);
  if (rInner > 0) {
    const hole = new THREE.Path();
    hole.absarc(0, 0, rInner, 0, TAU, true);
    shape.holes.push(hole);
  }
  const g = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false, curveSegments: seg / 4 });
  g.rotateX(-Math.PI / 2);
  g.translate(0, thickness / 2, 0);
  return g;
}

export function screw(r = 2.6, h = 3.0) {
  const g = new THREE.CylinderGeometry(r, r, h, 12);
  g.rotateX(Math.PI / 2);
  return g;
}

export function mesh(geo, mat, name) {
  const m = new THREE.Mesh(geo, mat);
  m.name = name;
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

export function group(name) {
  const g = new THREE.Group();
  g.name = name;
  return g;
}
