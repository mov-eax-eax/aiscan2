/* Everything that bolts onto the bow: sight, stabilisers, clicker, plunger,
   rest, the arrow, and the stand it sits on.

   This is the half of the silhouette the previous attempt treated as an
   afterthought. In a side view of a real target bow the long rod is about as
   long as the riser is tall, and the sight extension reaches out as far as the
   limbs reach back - ignore that and the bow stops reading as "modern"
   whatever the riser looks like. */
import * as THREE from '../../vendor/three.module.js';
import { MAT } from './mats.js';
import { chain, group, mesh, roundedBox, ring, tube, lerp } from './prims.js';
import { STRING_X } from './limbs.js';

const NOCK = new THREE.Vector3(STRING_X, -20, 0);   /* arrow nock point */
const BUSH_X = -47;                                  /* front-face bushing */

/* ---------------------------------------------------------------- sight -- */

export function buildSight() {
  const g = group('sight');
  const barX = -30;                 /* sight rail sits here on the riser */
  const mountY = 140;

  /* dovetail block clamped to the riser rail */
  const block = mesh(roundedBox(30, 46, 34, 3), MAT.black, 'sight-block');
  block.position.set(barX + 4, mountY, 0);
  g.add(block);

  /* horizontal extension bar: the long reach toward the target */
  const ext = mesh(new THREE.CylinderGeometry(6, 6, 230, 18), MAT.black, 'sight-extension');
  ext.rotation.z = Math.PI / 2;
  ext.position.set(barX - 118, mountY, 0);
  g.add(ext);

  /* carriage that slides on the extension */
  const carr = mesh(roundedBox(40, 30, 30, 3), MAT.black, 'sight-carriage');
  carr.position.set(barX - 150, mountY, 0);
  g.add(carr);

  /* vertical adjustment bar */
  const vbar = mesh(roundedBox(15, 170, 26, 3), MAT.black, 'sight-vertical');
  vbar.position.set(barX - 150, mountY + 94, 0);
  g.add(vbar);

  /* elevation / windage turrets - the fiddly bits that make it read as a sight */
  for (const [dy, tag] of [[46, 'elev'], [-24, 'wind']]) {
    const k = mesh(new THREE.CylinderGeometry(11, 11, 15, 18), MAT.black, `sight-knob-${tag}`);
    k.rotation.x = Math.PI / 2;
    k.position.set(barX - 150, mountY + dy, 0);
    g.add(k);
    const cap = mesh(ring(11, 0, 2), MAT.steel, `sight-knob-${tag}-cap`);
    cap.rotation.x = Math.PI / 2;
    cap.position.set(barX - 150, mountY + dy, 8);
    g.add(cap);
  }

  /* the scope: aperture ring on a pin, the thing the archer looks through */
  const scopeY = mountY + 158;
  const pin = mesh(new THREE.CylinderGeometry(3.4, 3.4, 58, 14), MAT.black, 'sight-pin');
  pin.rotation.z = Math.PI / 2;
  pin.position.set(barX - 172, scopeY, 0);
  g.add(pin);

  const aperRing = mesh(ring(21, 16.5, 5), MAT.black, 'sight-aperture-ring');
  aperRing.rotation.y = Math.PI / 2;
  aperRing.position.set(barX - 198, scopeY, 0);
  g.add(aperRing);

  const aperGlass = mesh(ring(16.5, 0, 1.2), MAT.steel, 'sight-aperture-glass');
  aperGlass.rotation.y = Math.PI / 2;
  aperGlass.position.set(barX - 198, scopeY, 0);
  g.add(aperGlass);

  const clampb = mesh(roundedBox(18, 24, 20, 2), MAT.black, 'sight-aperture-clamp');
  clampb.position.set(barX - 198, scopeY - 22, 0);
  g.add(clampb);

  /* level bubble hanging off the extension, a real Olympic detail */
  const lvl = mesh(new THREE.CylinderGeometry(5.5, 5.5, 34, 14), MAT.black, 'sight-level');
  lvl.rotation.z = Math.PI / 2;
  lvl.position.set(barX - 96, mountY - 22, 0);
  g.add(lvl);

  return g;
}

/* ---------------------------------------------------------- stabilisers -- */

function orientTo(obj, a, b, t) {
  const p = new THREE.Vector3().lerpVectors(a, b, t);
  const dir = new THREE.Vector3().subVectors(b, a).normalize();
  obj.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
  obj.position.copy(p);
}

function orientRingTo(obj, dir) {
  obj.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
}

export function buildStabilisers() {
  const g = group('stabilisers');
  const anchor = new THREE.Vector3(BUSH_X, 60, 0);

  /* --- long rod: forward and slightly down, as long as the riser is tall --- */
  const long = group('stab-longrod');
  const longEnd = new THREE.Vector3(anchor.x - 780, anchor.y - 74, 0);
  long.add(mesh(chain([anchor.toArray(), longEnd.toArray()], [11, 8.5]),
    MAT.black, 'stab-longrod-shaft'));

  const damp = mesh(new THREE.CylinderGeometry(14, 14, 54, 20), MAT.rubber, 'stab-longrod-damper');
  orientTo(damp, anchor, longEnd, 0.62);
  long.add(damp);

  const dir = new THREE.Vector3().subVectors(longEnd, anchor).normalize();
  const cursor = longEnd.clone().addScaledVector(dir, -30);
  for (let i = 0; i < 4; i++) {
    const w = mesh(ring(i === 3 ? 15 : 20, 4, 9), MAT.black, `stab-longrod-weight-${i}`);
    orientRingTo(w, dir);
    w.position.copy(cursor);
    long.add(w);
    cursor.addScaledVector(dir, 11);
  }
  const cap = mesh(ring(15, 0, 3), MAT.steel, 'stab-longrod-cap');
  orientRingTo(cap, dir);
  cap.position.copy(cursor);
  long.add(cap);
  g.add(long);

  /* --- v-bar: splits the side rods off the same bushing --- */
  const vbar = mesh(roundedBox(70, 26, 30, 4), MAT.black, 'stab-vbar');
  vbar.position.set(anchor.x - 46, anchor.y + 4, 0);
  g.add(vbar);

  const knob = mesh(new THREE.CylinderGeometry(9, 9, 26, 16), MAT.black, 'stab-vbar-knob');
  knob.rotation.x = Math.PI / 2;
  knob.position.set(anchor.x - 60, anchor.y + 4, 0);
  g.add(knob);

  /* --- side rods: shorter, angled outward and canted down --- */
  for (const [sign, tag] of [[1, 'f'], [-1, 'n']]) {
    const start = new THREE.Vector3(anchor.x - 60, anchor.y + 4, sign * 14);
    const end = new THREE.Vector3(anchor.x - 520, anchor.y - 96, sign * 250);
    const s = group(`stab-siderod-${tag}`);
    s.add(mesh(chain([start.toArray(), end.toArray()], [8, 6.5]),
      MAT.black, `stab-siderod-${tag}-shaft`));

    const d = mesh(new THREE.CylinderGeometry(11, 11, 40, 18), MAT.rubber, `stab-siderod-${tag}-damper`);
    orientTo(d, start, end, 0.6);
    s.add(d);

    const sdir = new THREE.Vector3().subVectors(end, start).normalize();
    const c = end.clone().addScaledVector(sdir, -22);
    for (let i = 0; i < 3; i++) {
      const w = mesh(ring(i === 2 ? 12 : 16, 3.5, 8), MAT.black, `stab-siderod-${tag}-weight-${i}`);
      orientRingTo(w, sdir);
      w.position.copy(c);
      s.add(w);
      c.addScaledVector(sdir, 10);
    }
    const cap2 = mesh(ring(12, 0, 3), MAT.steel, `stab-siderod-${tag}-cap`);
    orientRingTo(cap2, sdir);
    cap2.position.copy(c);
    s.add(cap2);
    g.add(s);
  }

  return g;
}

/* ------------------------------------------- clicker, plunger, rest ------ */

export function buildRiserFurniture() {
  const g = group('furniture');

  /* clicker: a spring steel blade reaching back over the arrow */
  const bladePts = [];
  for (let i = 0; i <= 26; i++) {
    const t = i / 26;
    bladePts.push([lerp(6, 46, Math.pow(t, 1.4)), 34 - t * 46 + Math.sin(t * 2.2) * 3, 0]);
  }
  g.add(mesh(new THREE.TubeGeometry(
    new THREE.CatmullRomCurve3(bladePts.map(p => new THREE.Vector3(...p))), 26, 0.9, 6, false),
    MAT.steel, 'clicker-blade'));

  const ctab = mesh(new THREE.BoxGeometry(22, 9, 16), MAT.steel, 'clicker-tab');
  ctab.position.set(52, -14, 0);
  g.add(ctab);

  const cmount = mesh(new THREE.BoxGeometry(8, 26, 18), MAT.black, 'clicker-mount');
  cmount.position.set(4, 26, 0);
  g.add(cmount);

  /* plunger button: protrudes into the sight window above the rest */
  const pb = mesh(new THREE.CylinderGeometry(5.4, 5.4, 30, 18), MAT.black, 'plunger-body');
  pb.rotation.z = Math.PI / 2;
  pb.position.set(16, 12, 0);
  g.add(pb);

  const pt = mesh(new THREE.CylinderGeometry(3.0, 3.0, 10, 14), MAT.steel, 'plunger-tip');
  pt.rotation.z = Math.PI / 2;
  pt.position.set(34, 12, 0);
  g.add(pt);

  const pl = mesh(new THREE.CylinderGeometry(6.6, 6.6, 56, 16), MAT.black, 'plunger-locknut');
  pl.rotation.z = Math.PI / 2;
  pl.position.set(-4, 12, 0);
  g.add(pl);

  /* arrow rest: a wire arm with a launcher pad */
  const restPts = [[-2, -2, 0], [10, 0, 0], [22, 2, 0], [34, 1, 0]];
  g.add(mesh(new THREE.TubeGeometry(
    new THREE.CatmullRomCurve3(restPts.map(p => new THREE.Vector3(...p))), 20, 1.6, 8, false),
    MAT.steel, 'rest-arm'));

  const pad = mesh(new THREE.BoxGeometry(26, 5, 13), MAT.black, 'rest-pad');
  pad.position.set(40, 1, 0);
  g.add(pad);

  const rbody = mesh(roundedBox(20, 26, 22, 3), MAT.black, 'rest-body');
  rbody.position.set(-4, -6, 0);
  g.add(rbody);

  return g;
}

/* --------------------------------------------------------------- arrow --- */

export function buildArrow() {
  const g = group('arrow');
  const tip = new THREE.Vector3(-620, NOCK.y - 4, 0);
  const dir = new THREE.Vector3().subVectors(tip, NOCK).normalize();

  g.add(mesh(chain([NOCK.toArray(), tip.toArray()], [3.6, 3.4]), MAT.shaft, 'arrow-shaft'));

  const nk = mesh(new THREE.CylinderGeometry(3.4, 4.4, 16, 12), MAT.fletch2, 'arrow-nock');
  orientTo(nk, NOCK, tip, 0.008);
  g.add(nk);

  const pt = mesh(chain(
    [tip.clone().addScaledVector(dir, -54).toArray(), tip.toArray()],
    [4.6, 1.6]), MAT.point, 'arrow-point');
  g.add(pt);

  /* three vanes; the odd one out is a different colour so the spin reads */
  const fletch = (ang, mat, tag) => {
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.lineTo(58, 0);
    shape.quadraticCurveTo(70, 4, 78, 11);
    shape.lineTo(14, 11);
    shape.closePath();
    const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.9, bevelEnabled: false });
    geo.translate(-78, 0, -0.45);
    const m = mesh(geo, mat, `arrow-fletch-${tag}`);
    m.position.copy(NOCK.clone().addScaledVector(dir, 34));
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    m.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(dir, ang));
    m.position.add(new THREE.Vector3(0, 1, 0).applyQuaternion(m.quaternion).multiplyScalar(3.2));
    return m;
  };
  g.add(fletch(0, MAT.fletch, 'a'));
  g.add(fletch((2 * Math.PI) / 3, MAT.fletch, 'b'));
  g.add(fletch((4 * Math.PI) / 3, MAT.fletch2, 'c'));

  return g;
}

/* --------------------------------------------------------------- stand --- */

export function buildStand() {
  const g = group('stand');
  const yoke = mesh(new THREE.BoxGeometry(20, 16, 70), MAT.stand, 'stand-yoke');
  yoke.position.set(-6, -150, 0);
  g.add(yoke);
  for (const zs of [-1, 1]) {
    const cup = mesh(new THREE.BoxGeometry(16, 20, 14), MAT.rubber, `stand-cup-${zs > 0 ? 'f' : 'n'}`);
    cup.position.set(-6, -138, zs * 28);
    g.add(cup);
  }
  for (const [dx, dz, tag] of [[-60, 70, 'f'], [-60, -70, 'n'], [50, 0, 'b']]) {
    g.add(mesh(chain([[-6, -156, 0], [dx, -470, dz]], [6, 4.5]), MAT.stand, `stand-leg-${tag}`));
    const foot = mesh(new THREE.CylinderGeometry(7, 7, 8, 12), MAT.rubber, `stand-foot-${tag}`);
    foot.rotation.x = Math.PI / 2;
    foot.position.set(dx, -470, dz);
    g.add(foot);
  }
  return g;
}
