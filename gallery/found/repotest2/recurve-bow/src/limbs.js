/* The limbs, and the geometry constants the rest of the bow hangs off.

   A modern recurve limb is a thin laminated strip. Almost all of its bend
   happens in the working section near the pocket, and the last stretch is a
   stiff recurve that curls back toward the archer and ends in a squarish tip
   with a string groove and an overlay. The previous attempt bowed the limb
   evenly over its whole length like a longbow, which is why it read as a
   stick rather than a recurve limb.

   Limb butt is captured in the riser pocket at y = +-315 and the limb runs to
   a tip in the string plane at x = 150, giving the two tips a straight line
   between them - which is what a strung bow at brace actually is. */
import * as THREE from '../../vendor/three.module.js';
import { MAT } from './mats.js';
import { ribbon, group, mesh, lerp, clamp } from './prims.js';

export const STRING_X = 150;        /* the string plane, archer side */
export const LIMB_BUTT = 315;       /* where the limb enters the pocket */
export const TIP_Y = 858;           /* tip height, so tip-to-tip = 1716 mm */

export function limbCurve(sign) {
  const pts = [
    new THREE.Vector3(20, 315, 0),
    new THREE.Vector3(-52, 480, 0),
    new THREE.Vector3(20, 690, 0),
    new THREE.Vector3(STRING_X, 858, 0),
  ];
  const up = pts.map(p => new THREE.Vector3(p.x, p.y * sign, p.z));
  return new THREE.CatmullRomCurve3(up, false, 'catmullrom', 0.5);
}

/* ---------------------------------------------------------------- limbs -- */

export function buildLimb(sign, tag) {
  const g = group(`limb-${tag}`);
  const curve = limbCurve(sign);

  /* width: wide and parallel at the butt, tapering to a slim tip */
  const halfWidth = (t) => {
    const w = lerp(20.5, 12.0, Math.pow(t, 0.75));
    /* a small swell where the limb leaves the pocket */
    const swell = t < 0.12 ? (0.12 - t) * 26 : 0;
    return w + swell;
  };
  /* thickness: thickest just out of the pocket, thinning toward the tip */
  const halfThick = (t) => lerp(5.4, 3.6, Math.pow(t, 0.8));

  /* the limb rolls slightly as it goes into the recurve - real ones are
     laid up with a twist so the tip presents its groove to the string */
  const roll = (t) => -sign * lerp(0, 0.16, clamp((t - 0.55) / 0.45, 0, 1));

  const ribbonGeo = ribbon({
    curve, samples: 110, halfWidth, halfThick, roll, sides: 10,
  });
  const body = mesh(ribbonGeo, MAT.limb, `limb-${tag}-laminate`);
  g.add(body);

  /* --- butt: the metal/wood block that sits in the dovetail --- */
  const butt = group(`limb-${tag}-butt`);
  const buttBlock = mesh(new THREE.BoxGeometry(62, 54, 26), MAT.black, `limb-${tag}-buttblock`);
  buttBlock.position.set(22, sign * 322, 0);
  butt.add(buttBlock);
  /* dovetail tongue reaching into the pocket jaws */
  const tongue = mesh(new THREE.BoxGeometry(30, 26, 14), MAT.steel, `limb-${tag}-dovetail`);
  tongue.position.set(22, sign * 336, 0);
  butt.add(tongue);
  g.add(butt);

  /* --- tip: overlay, string groove, and the nock the string sits in --- */
  const tipP = curve.getPointAt(1);
  const tipT = curve.getTangentAt(1).normalize();
  const tipG = group(`limb-${tag}-tip`);

  /* the overlay is a slightly fatter block capping the last 55mm */
  const over = mesh(new THREE.BoxGeometry(15, 56, 22), MAT.limbEdge, `limb-${tag}-tipoverlay`);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), tipT);
  over.quaternion.copy(q);
  over.position.copy(tipP).addScaledVector(tipT, -26);
  tipG.add(over);

  /* the groove: two small horns either side of where the string rides */
  for (const zs of [-1, 1]) {
    const horn = mesh(new THREE.BoxGeometry(9, 30, 5), MAT.limbEdge, `limb-${tag}-tipgroove-${zs > 0 ? 'f' : 'n'}`);
    horn.quaternion.copy(q);
    horn.position.copy(tipP).addScaledVector(tipT, -8);
    horn.position.z += zs * 8;
    tipG.add(horn);
  }
  g.add(tipG);

  g.userData.tip = tipP.clone();
  g.userData.tipTangent = tipT.clone();
  return g;
}

/* --------------------------------------------------------------- string -- */

export function buildString() {
  const g = group('string');
  const top = limbCurve(1).getPointAt(1);
  const bot = limbCurve(-1).getPointAt(1);
  const nockY = -20;                      /* where the arrow nocks on */

  /* main bundle */
  const main = mesh(
    new THREE.CylinderGeometry(1.45, 1.45, top.y - bot.y, 10, 1),
    MAT.string, 'string-main');
  main.position.set(STRING_X, (top.y + bot.y) / 2, 0);
  g.add(main);

  /* end servings looped round each tip */
  for (const [y, tag] of [[top.y - 90, 'upper'], [bot.y + 90, 'lower']]) {
    const s = mesh(new THREE.CylinderGeometry(2.3, 2.3, 180, 12, 1), MAT.serving, `string-endserving-${tag}`);
    s.position.set(STRING_X, y, 0);
    g.add(s);
  }

  /* centre serving, the fat section the fingers and the nock sit on */
  const cs = mesh(new THREE.CylinderGeometry(2.6, 2.6, 210, 12, 1), MAT.serving, 'string-centreserving');
  cs.position.set(STRING_X, nockY + 30, 0);
  g.add(cs);

  /* nocking point: a brass bead crimped above the arrow */
  const nock = mesh(new THREE.CylinderGeometry(3.2, 3.2, 9, 12), MAT.gold, 'string-nockingpoint');
  nock.position.set(STRING_X, nockY + 13, 0);
  g.add(nock);

  /* D-loop below the nock */
  const loopPts = [];
  for (let i = 0; i <= 40; i++) {
    const t = i / 40;
    const a = lerp(-Math.PI * 0.75, Math.PI * 0.75, t);
    loopPts.push([STRING_X + 10 + Math.cos(a) * 9, nockY + 4 + Math.sin(a) * 15, 0]);
  }
  const loop = mesh(
    new THREE.TubeGeometry(new THREE.CatmullRomCurve3(loopPts.map(p => new THREE.Vector3(...p))), 40, 1.7, 8, false),
    MAT.serving, 'string-dloop');
  g.add(loop);

  return g;
}
