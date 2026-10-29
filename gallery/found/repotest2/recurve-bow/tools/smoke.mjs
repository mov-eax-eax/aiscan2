/* Kernel smoke test -- does every primitive in mesh.js produce a closed,
   positive-volume solid?  Run: node tools/smoke.mjs   (from recurve-bow/) */
import * as M from '../src/mesh.js';

const cases = [];
const check = (name, mesh, angle = 34) => {
  const f = M.finish(mesh, { angle });
  const b = M.bounds(f);
  cases.push({
    name,
    verts: f.pos.length / 3,
    tris: f.idx.length / 3,
    vol: f.volume,
    open: f.openEdges,
    nan: M.hasNaN(f),
    size: b.size.map(v => +v.toFixed(3)),
  });
  return f;
};

check('rod', M.rod(5, 0.5, 0.2, 24));
check('tube(3pt)', M.tube([[0, 0, 0], [3, 1, 0.5], [6, 3, 0]], 0.08, 10));
check('revolve(cyl)', M.revolve([[0.0001, 0], [0.6, 0], [0.6, 1.4], [0.0001, 1.4]], 40));
check('revolve(washer)', M.revolve([[0.3, 0], [0.6, 0], [0.6, 0.5], [0.3, 0.5]], 40));
check('roundedRect loft', M.loft([
  M.roundedRect(1, 0.5, 0.2, 6).map(([a, b]) => [a, 0, b]),
  M.roundedRect(0.6, 0.3, 0.12, 6).map(([a, b]) => [a, 3, b]),
], { ringClosed: true, capStart: true, capEnd: true }));
check('extrude(concave)', M.extrude([
  [0, 0], [2, 0], [2, 0.5], [0.7, 0.5], [0.7, 1.4], [2, 1.4], [2, 2], [0, 2],
], -0.4, 0.4, 'xy'));
check('hull2', { pos: [0, 0, 0, 1, 0, 0, 0, 1, 0], idx: [] });

let bad = 0;
for (const c of cases) {
  const flag = (c.open === 0 && c.vol > 0 && !c.nan) ? 'ok  ' : 'FAIL';
  if (flag === 'FAIL') bad++;
  console.log(`${flag} ${c.name.padEnd(20)} v=${String(c.verts).padStart(5)} t=${String(c.tris).padStart(5)} vol=${c.vol.toFixed(5).padStart(9)} open=${c.open} size=${JSON.stringify(c.size)}`);
}

const h = M.hull2([[0, 0], [1, 0], [1, 1], [0, 1], [0.5, 0.5]]);
console.log('hull2 pts =', h.length, JSON.stringify(h));
const cone = M.creaseNormals(M.orient(M.rod(2, 0.4, 0.4, 12)), 34);
console.log('creaseNormals verts =', cone.pos.length / 3, 'normals =', cone.nor.length / 3);
console.log(bad ? `\n${bad} FAILURES` : '\nall primitives closed and outward');
process.exit(bad ? 1 : 0);
