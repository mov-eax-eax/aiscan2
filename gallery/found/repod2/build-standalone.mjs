
import { readFileSync, writeFileSync } from 'node:fs';

const base = 'F:\\repod2\\';
const read = (p) => readFileSync(base + p, 'utf8');

// 1) three core
let three = read('node_modules/three/build/three.module.js');
const exp = three.match(/export\s*\{([\s\S]*?)\}\s*;\s*$/);
if (!exp) throw new Error('three export not found');
const names = exp[1].split(',').map((s) => s.trim()).filter(Boolean);
three = 'const THREE = (() => {\n'
  + three.slice(0, exp.index)
  + 'return { ' + names.join(', ') + ' };\n})();';

// 2) OrbitControls
let orbit = read('node_modules/three/examples/jsm/controls/OrbitControls.js');
const oi = orbit.match(/import\s*\{([\s\S]*?)\}\s*from\s*'three'\s*;/);
if (!oi) throw new Error('orbit import not found');
const oNames = oi[1].split(',').map((s) => s.trim()).filter(Boolean);
orbit = 'const __orbit = (() => {\n'
  + 'const { ' + oNames.join(', ') + ' } = THREE;'
  + orbit.slice(oi.index + oi[0].length).replace(/export\s*\{\s*OrbitControls\s*\}\s*;/, 'return { OrbitControls };')
  + '\n})();';

// 3) RoomEnvironment
let room = read('node_modules/three/examples/jsm/environments/RoomEnvironment.js');
const ri = room.match(/import\s*\{([\s\S]*?)\}\s*from\s*'three'\s*;/);
if (!ri) throw new Error('room import not found');
const rNames = ri[1].split(',').map((s) => s.trim()).filter(Boolean);
room = 'const __room = (() => {\n'
  + 'const { ' + rNames.join(', ') + ' } = THREE;'
  + room.slice(ri.index + ri[0].length).replace(/export\s*\{\s*RoomEnvironment\s*\}\s*;/, 'return { RoomEnvironment };')
  + '\n})();';

// 4) app script + shell from the CDN version
const html = read('boeing747-v2.html');
const headEnd = html.indexOf('<script type="importmap">');
if (headEnd < 0) throw new Error('importmap not found');
const shell = html.slice(0, headEnd);
const appMatch = html.match(/<script type="module">([\s\S]*?)<\/script>/);
if (!appMatch) throw new Error('app script not found');
let app = appMatch[1];
app = app.replace("import * as THREE from 'three';", '// three.js r160 core is inlined above');
app = app.replace(
  "import { OrbitControls } from 'three/addons/controls/OrbitControls.js';",
  'const { OrbitControls } = __orbit;');
app = app.replace(
  "import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';",
  'const { RoomEnvironment } = __room;');

// 5) assemble standalone file
const out = shell
  + '<script type="module">\n'
  + '/* ============ three.js r160 (MIT, inlined) ============ */\n'
  + three + '\n'
  + '/* ============ OrbitControls (inlined) ============ */\n'
  + orbit + '\n'
  + '/* ============ RoomEnvironment (inlined) ============ */\n'
  + room + '\n'
  + '/* ============ 747 application ============ */\n'
  + app + '\n'
  + '</script>\n</body>\n</html>\n';

writeFileSync(base + 'boeing747-standalone.html', out);
console.log('written boeing747-standalone.html bytes:', out.length);
console.log('three:', three.length, 'orbit:', orbit.length, 'room:', room.length, 'app:', app.length);
