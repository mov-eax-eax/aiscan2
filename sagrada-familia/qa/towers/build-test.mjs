// Headless geometry smoke test (no DOM, no WebGL).
// Builds every tower/roof module against a validating fake GeoBuilder so
// runtime errors, bad batch entries and triangle budgets are caught quickly.

// --- minimal canvas stub so lib.js procedural textures can be constructed ---
function makeCtx() {
  const noop = () => {};
  const base = { measureText: (t) => ({ width: String(t).length * 30 }) };
  return new Proxy(base, {
    get(target, key) {
      if (key in target) return target[key];
      return noop;
    },
    set() {
      return true;
    },
  });
}
globalThis.document = {
  createElement: () => ({ width: 0, height: 0, getContext: () => makeCtx() }),
};

const { GeoBuilder } = await import('../../src/towers/common.js');
const { buildApostles } = await import('../../src/towers/apostles.js');
const { buildRoofs } = await import('../../src/towers/roofs.js');
const { buildEvangelists } = await import('../../src/towers/evangelists.js');
const { buildJesus } = await import('../../src/towers/jesus.js');
const { buildVirgin } = await import('../../src/towers/virgin.js');
const { DIM } = await import('../../src/config.js');

const mats = new Proxy({}, { get: (_t, key) => ({ key: String(key) }) });

class TestBuilder extends GeoBuilder {
  add(key, geo) {
    if (Array.isArray(geo)) return geo.forEach((g) => this.add(key, g));
    if (!geo || !geo.isBufferGeometry) throw new Error(`non-geometry add for batch "${key}": ${geo}`);
    return super.add(key, geo);
  }
  instance(key, geo, material, matrix) {
    if (!geo || !geo.isBufferGeometry) throw new Error(`non-geometry instance for "${key}"`);
    if (!matrix) throw new Error(`missing matrix for "${key}"`);
    return super.instance(key, geo, material, matrix);
  }
}

const b = new TestBuilder();
buildApostles(b, mats);
buildEvangelists(b, mats);
buildJesus(b, mats);
buildVirgin(b, mats);
buildRoofs(b, mats);

let triangles = 0;
const batches = [...b.batches.entries()].map(([k, geos]) => {
  let t = 0;
  for (const g of geos) t += (g.index ? g.index.count : g.attributes.position.count) / 3;
  triangles += t;
  return [k, geos.length, Math.round(t)];
});
let instTris = 0;
const instanced = [...b.inst.entries()].map(([k, e]) => {
  const n = e.geo.index ? e.geo.index.count : e.geo.attributes.position.count;
  const t = (n / 3) * e.matrices.length;
  instTris += t;
  return [k, e.matrices.length, Math.round(t)];
});
const total = Math.round(triangles + instTris);
console.log('apostles:', DIM.apostleTowers.length, 'evangelists:', DIM.evangelistTowers.length);
console.log('batches:', JSON.stringify(batches));
console.log('instanced:', JSON.stringify(instanced));
console.log(`triangles: ${total} (merged ${Math.round(triangles)} + instanced ${Math.round(instTris)})`);
console.log('OK');
