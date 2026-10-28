// Focused: dense ray grid over the crossing square, listing foreign geometry
// (roof / tower trim) that sits BELOW my interior ceiling.
import { registerHooks } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import path from 'node:path';
const here = path.dirname(fileURLToPath(import.meta.url));
const vendor = path.resolve(here, '../../vendor/three.module.min.js');
registerHooks({ resolve(s, c, n) { if (s === 'three') return { url: pathToFileURL(vendor).href, shortCircuit: true }; return n(s, c); } });
function ctx2d() { const g = { addColorStop() {} }; return { fillStyle:'#000',strokeStyle:'#000',lineWidth:1,globalAlpha:1,font:'',textAlign:'',textBaseline:'',createRadialGradient:()=>g,createLinearGradient:()=>g,fillRect(){},clearRect(){},beginPath(){},closePath(){},moveTo(){},lineTo(){},quadraticCurveTo(){},bezierCurveTo(){},arc(){},ellipse(){},rect(){},fill(){},stroke(){},save(){},restore(){},translate(){},rotate(){},scale(){},setTransform(){},drawImage(){},fillText(){},measureText:(t)=>({width:8*String(t).length}),getImageData:()=>({data:new Uint8ClampedArray(4)}),putImageData(){} }; }
function canvas() { const c = { width:1, height:1, style:{} }; c.getContext = () => { const x = ctx2d(); x.canvas = c; return x; }; return c; }
globalThis.document = { createElement: () => canvas(), createElementNS: () => canvas() };
const THREE = await import(pathToFileURL(vendor).href);
const { DIM, TOUR } = await import(pathToFileURL(path.resolve(here, '../../src/config.js')).href);
const LIB = await import(pathToFileURL(path.resolve(here, '../../src/lib.js')).href);
const { buildGloryShell } = await import(pathToFileURL(path.resolve(here, '../../src/glory-shell.js')).href);
const { buildFacadesNP } = await import(pathToFileURL(path.resolve(here, '../../src/facades-np.js')).href);
const { buildTowers } = await import(pathToFileURL(path.resolve(here, '../../src/towers.js')).href);
const { buildInterior } = await import(pathToFileURL(path.resolve(here, '../../src/interior.js')).href);
const scene = new THREE.Scene();
const env = { time:10,auto:false,night:0,sunDir:new THREE.Vector3(0,1,0),sun:null,moonDir:new THREE.Vector3(0,1,0),exposure:1,quality:'high',elapsed:0,fps:60,ready:false };
const app = { qualityHooks: [], onQuality(f){ app.qualityHooks.push(f); }, getStats: () => ({}) };
const ctx = { scene, camera: new THREE.PerspectiveCamera(), renderer:{info:{render:{}}}, env, app, DIM, TOUR, LIB, quality:'high', onQuality:(f)=>app.onQuality(f) };
const groups = {};
for (const [k, fn] of [['shell', buildGloryShell], ['facades', buildFacadesNP], ['towers', buildTowers], ['interior', buildInterior]]) {
  const r = fn(ctx);
  if (r && r.group) { r.group.updateMatrixWorld(true); scene.add(r.group); groups[k] = r.group; }
}
const meta = new Map();
const mine = [], others = [];
for (const [k, g] of Object.entries(groups)) g.traverse((o) => { if (o.isMesh && o.geometry) { meta.set(o, k); (k === 'interior' ? mine : others).push(o); } });
const ray = new THREE.Raycaster(); ray.far = 200;
const up = new THREE.Vector3(0,1,0);
function hit(objs, x, y, z) {
  ray.set(new THREE.Vector3(x,y,z), up); ray.near = 0.02;
  for (const h of ray.intersectObjects(objs, false)) return { y: h.point.y, obj: h.object };
  return null;
}
const rows = [];
for (let x = -11.9; x <= 11.9; x += 1) {
  for (let z = -11.9; z <= 11.9; z += 1) {
    const m = hit(mine, x, 1.8, z);
    const o = hit(others, x, 1.8, z);
    if (!o) continue;
    const myY = m ? m.y : Infinity;
    if (o.y < myY) rows.push({ x: +x.toFixed(1), z: +z.toFixed(1), y: +o.y.toFixed(2), group: meta.get(o.obj), name: o.obj.name || '', mat: (o.obj.material && (o.obj.material.name || o.obj.material.type)) || '' });
  }
}
rows.sort((a,b) => a.y - b.y);
console.log('foreign hits below my ceiling:', rows.length);
const names = {};
for (const r of rows) { const k = r.group + ':' + r.name; names[k] = names[k] || { n: 0, minY: 1e9, maxY: -1e9, cells: [] }; const e = names[k]; e.n++; e.minY = Math.min(e.minY, r.y); e.maxY = Math.max(e.maxY, r.y); if (e.cells.length < 10) e.cells.push(`${r.x},${r.z}@${r.y}`); }
for (const k of Object.keys(names)) { const e = names[k]; console.log(k, 'n=' + e.n, 'y ' + e.minY.toFixed(2) + '..' + e.maxY.toFixed(2), e.cells.join(' ')); }
process.exit(0);
