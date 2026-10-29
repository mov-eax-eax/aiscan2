/**
 * merge.js — concatenate BufferGeometries that share the same attributes.
 *
 * Used to collapse the ~90 separately-swept chord members into one mesh per layer,
 * which removes ~85 draw calls with no visual change. A local implementation so the
 * builder does not depend on an addon.
 */
import * as THREE from 'three';

export function mergeGeos(geos) {
  geos = geos.filter(Boolean);
  if (!geos.length) return null;
  if (geos.length === 1) return geos[0];

  const useColor = geos.every(g => g.attributes.color);
  const useNormal = geos.every(g => g.attributes.normal);

  let vCount = 0, iCount = 0;
  for (const g of geos) {
    vCount += g.attributes.position.count;
    iCount += g.index ? g.index.count : g.attributes.position.count;
  }

  const pos = new Float32Array(vCount * 3);
  const nor = useNormal ? new Float32Array(vCount * 3) : null;
  const col = useColor ? new Float32Array(vCount * 3) : null;
  const idx = vCount > 65535 ? new Uint32Array(iCount) : new Uint16Array(iCount);

  let vo = 0, io = 0;
  for (const g of geos) {
    const p = g.attributes.position;
    pos.set(p.array, vo * 3);
    if (nor) nor.set(g.attributes.normal.array, vo * 3);
    if (col) col.set(g.attributes.color.array, vo * 3);
    if (g.index) {
      const a = g.index.array;
      for (let k = 0; k < g.index.count; k++) idx[io + k] = a[k] + vo;
      io += g.index.count;
    } else {
      for (let k = 0; k < p.count; k++) idx[io + k] = k + vo;
      io += p.count;
    }
    vo += p.count;
  }

  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  if (nor) out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  if (col) out.setAttribute('color', new THREE.BufferAttribute(col, 3));
  out.setIndex(new THREE.BufferAttribute(idx, 1));
  out.computeBoundingSphere();
  return out;
}
