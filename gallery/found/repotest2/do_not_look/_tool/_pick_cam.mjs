// Quick numeric camera-framing check against vendored three r169 (no browser).
import * as THREE from 'file:///F:/repotest2/vendor/three.module.js';
import { createRequire } from 'node:module';

const W = 1600, H = 900, aspect = W / H;
function frame(pos, tgt) {
  const cam = new THREE.PerspectiveCamera(46, aspect, 0.5, 15000);
  cam.position.set(...pos);
  cam.up.set(0, 1, 0);
  cam.lookAt(new THREE.Vector3(...tgt));
  cam.updateMatrixWorld(true);
  const v = new THREE.Vector3();
  const proj = p => { v.set(...p).project(cam); return [v.x, v.y, v.z]; };
  // sample tower points: base ring corners, mid, platform3, tip, antenna slightly above?
  const pts = [
    [ 62.5, 0,  62.5], [ 62.5, 0, -62.5], [-62.5, 0,  62.5], [-62.5, 0, -62.5],
    [0, 57, 0], [0, 115, 0], [0, 276.1, 0], [0, 330, 0],
    [ 30, 330, 0], [-30, 330, 0], [0, 330, 30], [0, 330, -30],   // antenna cross arms
    [0, 0, 0]
  ];
  const p = pts.map(proj);
  const minX = Math.min(...p.map(a => a[0])), maxX = Math.max(...p.map(a => a[0]));
  const minY = Math.min(...p.map(a => a[1])), maxY = Math.max(...p.map(a => a[1]));
  const inside = minX >= -1 && maxX <= 1 && minY >= -1 && maxY <= 1;
  return { minX: +minX.toFixed(3), maxX: +maxX.toFixed(3), minY: +minY.toFixed(3), maxY: +maxY.toFixed(3),
           inside, skyMarginTop: +(1 - maxY).toFixed(3), groundMarginBottom: +(minY + 1).toFixed(3) };
}

const cands = [
  ['hero NEW',            [285, 195, 530], [0, 160, 0]],
  ['hero A',              [280, 200, 520], [0, 155, 0]],
  ['hero B',              [300, 210, 560], [0, 165, 0]],
  ['ground',              [0, 2.4, 188],   [0, 168, 0]],
  ['base',                [0, 1.8, 96],    [0, 190, 0]],
  ['lvl1',                [0, 62, 148],    [0, 150, 0]],
  ['lvl2',                [0, 120, 124],   [0, 225, 0]],
  ['top',                 [118, 330, 170], [0, 258, 0]],
];
for (const [n, pos, tgt] of cands) {
  const f = frame(pos, tgt);
  console.log(n.padEnd(20), JSON.stringify(pos).padEnd(24), JSON.stringify(tgt).padEnd(20),
    'minX', f.minX, 'maxX', f.maxX, 'minY', f.minY, 'maxY', f.maxY,
    'inside', f.inside, 'skyTop', f.skyMarginTop, 'groundBot', f.groundMarginBottom);
}
