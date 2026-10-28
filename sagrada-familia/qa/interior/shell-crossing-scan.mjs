import { registerHooks } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import path from 'node:path';
const here = path.dirname(fileURLToPath(import.meta.url));
const vendor = path.resolve(here, '../../vendor/three.module.min.js');
registerHooks({ resolve(s, c, n) { if (s === 'three') return { url: pathToFileURL(vendor).href, shortCircuit: true }; return n(s, c); } });
function ctx2d() { const g = { addColorStop() {} }; return { fillStyle:'',strokeStyle:'',lineWidth:1,globalAlpha:1,font:'',textAlign:'',textBaseline:'',createRadialGradient:()=>g,createLinearGradient:()=>g,fillRect(){},clearRect(){},beginPath(){},closePath(){},moveTo(){},lineTo(){},quadraticCurveTo(){},bezierCurveTo(){},arc(){},ellipse(){},rect(){},fill(){},stroke(){},save(){},restore(){},translate(){},rotate(){},scale(){},setTransform(){},drawImage(){},fillText(){},measureText:(t)=>({width:8*String(t).length}),getImageData:()=>({data:new Uint8ClampedArray(4)}),putImageData(){} }; }
function canvas() { const c = { width:1, height:1, style:{} }; c.getContext = () => { const x = ctx2d(); x.canvas = c; return x; }; return c; }
globalThis.document = { createElement: () => canvas(), createElementNS: () => canvas() };
const THREE = await import(pathToFileURL(vendor).href);
const { DIM, TOUR } = await import(pathToFileURL(path.resolve(here, '../../src/config.js')).href);
const LIB = await import(pathToFileURL(path.resolve(here, '../../src/lib.js')).href);
const { buildGloryShell } = await import(pathToFileURL(path.resolve(here, '../../src/glory-shell.js')).href);
const scene = new THREE.Scene();
const env = { time:10,auto:false,night:0,sunDir:new THREE.Vector3(0,1,0),sun:null,moonDir:new THREE.Vector3(0,1,0),exposure:1,quality:'high',elapsed:0,fps:60,ready:false };
const app = { qualityHooks: [], onQuality(f){ app.qualityHooks.push(f); }, getStats: () => ({}) };
const ctx = { scene, camera:new THREE.PerspectiveCamera(), renderer:{info:{render:{}}}, env, app, DIM, TOUR, LIB, quality:'high', onQuality:(f)=>app.onQuality(f) };
const r = buildGloryShell(ctx);
r.group.updateMatrixWorld(true);
r.group.traverse((o) => {
  if (!o.isMesh || !o.geometry) return;
  const name = o.name || '';
  const v = new THREE.Vector3();
  const pos = o.geometry.attributes.position;
  let n = 0, minY = 1e9, maxY = -1e9, minX = 1e9, maxX = -1e9, minZ = 1e9, maxZ = -1e9;
  const cells = new Map();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
    if (v.y > 8 && v.y < 26 && Math.abs(v.x) < 13 && Math.abs(v.z) < 13) {
      n++;
      minY = Math.min(minY, v.y); maxY = Math.max(maxY, v.y);
      minX = Math.min(minX, v.x); maxX = Math.max(maxX, v.x);
      minZ = Math.min(minZ, v.z); maxZ = Math.max(maxZ, v.z);
      const k = [Math.round(v.x), Math.round(v.y), Math.round(v.z)].join(',');
      cells.set(k, (cells.get(k) || 0) + 1);
    }
  }
  if (n) {
    console.log(name, 'transform', o.position.toArray().map(x=>x.toFixed(1)), 'verts', n, 'x', minX.toFixed(1)+'..'+maxX.toFixed(1), 'y', minY.toFixed(1)+'..'+maxY.toFixed(1), 'z', minZ.toFixed(1)+'..'+maxZ.toFixed(1));
    console.log('  cells:', [...cells.entries()].sort((a,b)=>b[1]-a[1]).slice(0,10).map(c=>c[0]).join(' | '));
  }
});
process.exit(0);
