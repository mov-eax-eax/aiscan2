/* ============================================================================
   recurve-bow / src/bow.js  --  the assembly

   Collects every part from every builder, turns them into three.js objects,
   and owns the two things that make an exploded view readable:

     * a per-part explode DIRECTION and DISTANCE and a GROUP, so the bow comes
       apart in the order it was assembled rather than all at once
     * a draw cycle, rebuilt from the mechanics on demand

   Nothing here invents geometry. Every mesh arrives from a builder that
   verify.js can check on its own.
   ========================================================================== */

import * as THREE from '../vendor/three.module.js';
import * as M from './mesh.js';
import * as L from './limb.js';
import * as S from './string.js';
import { buildRiserParts } from './riser.js';
import { buildAccessoryParts } from './accessories.js';
import { materialFor, toGeometry } from './togl.js';
import { STRING, LIMB, ARROW } from './param.js';

/* Explode timing. Each group starts moving at `delay` and is fully out by the
   end, so the bow comes apart in assembly order instead of exploding into a
   debris field: limbs off first, then the string lifts, then the furniture. */
export const GROUPS = {
  limbs:    { delay: 0.00, label: 'Limbs' },
  string:   { delay: 0.12, label: 'String' },
  pockets:  { delay: 0.26, label: 'Limb pockets' },
  rest:     { delay: 0.30, label: 'Rest & plunger' },
  grip:     { delay: 0.33, label: 'Grip' },
  clicker:  { delay: 0.35, label: 'Clicker' },
  sight:    { delay: 0.38, label: 'Sight' },
  riser:    { delay: 0.44, label: 'Riser' },
  stab:     { delay: 0.46, label: 'Stabilisers' },
  bushings: { delay: 0.52, label: 'Threaded inserts' },
  arrow:    { delay: 0.60, label: 'Arrow' },
};

export const ease = t => t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t);

export function groupFactor(group, t) {
  const g = GROUPS[group] || { delay: 0 };
  const span = Math.max(0.24, 1 - g.delay);
  return ease((t - g.delay) / span);
}

/* ------------------------------------------------------------ the draw --- */

/* The mechanics gives a handful of solved poses. Interpolating between them
   for the slider is honest -- they are the real solutions, sampled -- and it
   keeps dragging interactive instead of re-solving at 60 Hz. */
export function poseAtDraw(curve, frac) {
  const n = curve.length;
  const x = Math.max(0, Math.min(1, frac)) * (n - 1);
  const i = Math.min(n - 2, Math.floor(x));
  const t = x - i;
  const A = curve[i], B = curve[i + 1];
  const mix = k => A[k] + (B[k] - A[k]) * t;
  /* The readouts are interpolated too. Reporting the lower sample makes the
     HUD disagree with verify.js at exactly full draw -- 34.7 lb instead of
     36.0 -- which is the sort of thing that quietly destroys trust in every
     other number on the panel. */
  return {
    pose: { a: mix('pose.a') || (A.pose.a + (B.pose.a - A.pose.a) * t), b: A.pose.b + (B.pose.b - A.pose.b) * t },
    draw: mix('draw'),
    sample: {
      drawForce: mix('drawForce'),
      stored: mix('stored'),
      legAngleDeg: mix('legAngleDeg'),
      tipY: mix('tipY'), tipZ: mix('tipZ'),
      contactS: mix('contactS'),
      amo: mix('amo'), nockZ: mix('nockZ'),
    },
  };
}

/* --------------------------------------------------------------- build --- */

export function assemble(curve) {
  const root = new THREE.Group();
  root.name = 'recurve';
  const items = [];

  /* Every explode vector is authored in "part-sized" units and scaled here.
     The bow is 68" tall, so a hand-authored 5" offset that looks generous in
     a builder's head is invisible on screen. */
  const EXPLODE_SCALE = 1.0;

  const statics = buildRiserParts().concat(buildAccessoryParts());
  for (const p of statics) {
    const geo = M.finish(p.mesh, { angle: 32 });
    const obj = new THREE.Mesh(toGeometry(geo), materialFor(p.material));
    obj.name = p.name;
    obj.castShadow = true; obj.receiveShadow = true;
    root.add(obj);
    items.push({
      name: p.name, group: p.group, order: p.order, note: p.note || '',
      material: p.material, volume: geo.volume, tris: geo.idx.length / 3,
      object: obj, base: obj.position.clone(),
      dir: new THREE.Vector3(...p.explode).multiplyScalar(EXPLODE_SCALE),
    });
  }

  /* dynamic: two limbs and the string, rebuilt as the draw changes */
  const limbMat = materialFor('glass');
  const dynamic = [];
  for (const [name, sign, order] of [['limb.upper', 1, 96], ['limb.lower', -1, 97]]) {
    const obj = new THREE.Mesh(new THREE.BufferGeometry(), limbMat);
    obj.name = name;
    obj.castShadow = true; obj.receiveShadow = true;
    root.add(obj);
    const it = {
      name, group: 'limbs', order, note: sign > 0 ? 'upper limb, ILF dovetail' : 'lower limb, ILF dovetail',
      material: 'glass', object: obj,
      base: new THREE.Vector3(),
      dir: new THREE.Vector3(0, sign * 18.0, 2.5),
      dynamic: { kind: 'limb', sign },
    };
    items.push(it); dynamic.push(it);
  }
  {
    const obj = new THREE.Mesh(new THREE.BufferGeometry(), materialFor('string'));
    obj.name = 'string.main';
    obj.castShadow = true;
    root.add(obj);
    const it = {
      name: 'string.main', group: 'string', order: 98,
      note: '16 strand, centre served, served end loops',
      material: 'string', object: obj,
      base: new THREE.Vector3(),
      dir: new THREE.Vector3(0, 0, 17),
      dynamic: { kind: 'string' },
    };
    items.push(it); dynamic.push(it);
  }
  {
    const obj = new THREE.Mesh(new THREE.BufferGeometry(), materialFor('serving'));
    obj.name = 'string.furniture';
    obj.castShadow = true;
    root.add(obj);
    const it = {
      name: 'string.furniture', group: 'string', order: 99,
      note: 'nocking point and string silencers',
      material: 'serving', object: obj,
      base: new THREE.Vector3(),
      dir: new THREE.Vector3(0, 0, 19),
      dynamic: { kind: 'stringFurniture' },
    };
    items.push(it); dynamic.push(it);
  }

  items.sort((a, b) => (a.order - b.order) || a.name.localeCompare(b.name));

  const bow = { root, items, dynamic, curve, draw: 0, explode: 0 };
  setDraw(bow, 0);
  return bow;
}

/* ------------------------------------------------------------- redraw --- */

export function setDraw(bow, frac) {
  const { pose, draw } = poseAtDraw(bow.curve, frac);
  bow.draw = frac;
  bow.pose = pose;

  for (const it of bow.dynamic) {
    if (it.dynamic.kind === 'limb') {
      const g = M.finish(L.buildLimb(pose, it.dynamic.sign), { angle: 32 });
      it.object.geometry.dispose();
      it.object.geometry = toGeometry(g);
      it.volume = g.volume; it.tris = g.idx.length / 3;
      continue;
    }

    /* both string parts share one evaluation of the taut path */
    const up = L.bellyProfile(pose, 220);
    const dn = up.map(([z, y]) => [z, -y]);
    const t = S.tautPath(up, dn, [bow.curve[0].nockZ + draw, 0]);
    const total = S.pathLength(t.path);
    const tipU = L.tipOf(pose);
    bow.lastString = { path: t.path, total, tipU };

    if (it.dynamic.kind === 'string') {
      const loopU = S.endLoop([tipU.z, tipU.y], tipU.theta, 1);
      const loopL = S.endLoop([tipU.z, -tipU.y], -tipU.theta, -1);
      const g = M.finish(M.merge([S.stringMesh(t.path), loopU, loopL]), { angle: 44 });
      it.object.geometry.dispose();
      it.object.geometry = toGeometry(g);
      it.volume = g.volume; it.tris = g.idx.length / 3;
    } else {
      const nocks = S.nockSet([bow.curve[0].nockZ + draw, ARROW.restY + 0.06], 0.075);
      const fuzz = S.silencers(t.path, total);
      const g = M.finish(M.merge([nocks, fuzz]), { angle: 44 });
      it.object.geometry.dispose();
      it.object.geometry = toGeometry(g);
      it.volume = g.volume; it.tris = g.idx.length / 3;
    }
  }
  applyExplode(bow, bow.explode);
  return bow;
}

export function applyExplode(bow, t) {
  bow.explode = t;
  for (const it of bow.items) {
    const f = groupFactor(it.group, t);
    it.object.position.copy(it.base).addScaledVector(it.dir, f);
  }
}
