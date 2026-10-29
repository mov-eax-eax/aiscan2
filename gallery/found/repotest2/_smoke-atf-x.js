/* headless smoke test: stub DOM + WebGL2, run the real scripts, validate output */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const DIR = __dirname;
let glCalls = { drawElements: 0, drawArrays: 0, bufferData: 0, texImage: 0, readPixels: 0 };
let createdTextures = 0;

function makeGLStub() {
  let idc = 1;
  const c = {};
  const K = ['DEPTH_TEST', 'LEQUAL', 'CULL_FACE', 'BACK', 'COLOR_BUFFER_BIT', 'DEPTH_BUFFER_BIT',
    'TRIANGLES', 'LINES', 'ARRAY_BUFFER', 'ELEMENT_ARRAY_BUFFER', 'STATIC_DRAW', 'FLOAT', 'UNSIGNED_INT',
    'UNSIGNED_BYTE', 'RGBA', 'RGBA8', 'DEPTH_COMPONENT24', 'TEXTURE_2D', 'TEXTURE0', 'TEXTURE_WRAP_S',
    'TEXTURE_WRAP_T', 'REPEAT', 'TEXTURE_MIN_FILTER', 'TEXTURE_MAG_FILTER', 'LINEAR', 'LINEAR_MIPMAP_LINEAR',
    'VERTEX_SHADER', 'FRAGMENT_SHADER', 'COMPILE_STATUS', 'LINK_STATUS', 'ACTIVE_UNIFORMS', 'FRAMEBUFFER',
    'RENDERBUFFER', 'COLOR_ATTACHMENT0', 'DEPTH_ATTACHMENT', 'BLEND', 'SRC_ALPHA', 'ONE_MINUS_SRC_ALPHA',
    'POLYGON_OFFSET_FILL', 'BUFFER_SIZE', 'MAX_TEXTURE_SIZE', 'NO_ERROR'];
  K.forEach((k, i) => c[k] = 0x1000 + i);
  const noop = () => { };
  Object.assign(c, {
    createShader: () => ({}),
    shaderSource: noop, compileShader: noop,
    getShaderParameter: () => true, getShaderInfoLog: () => '',
    createProgram: () => ({}), attachShader: noop, linkProgram: noop,
    getProgramParameter: (p, what) => (what === c.LINK_STATUS ? true : 0),
    getProgramInfoLog: () => '',
    getActiveUniform: () => ({ name: 'u' }),
    getUniformLocation: () => ({}),
    createBuffer: () => ({}), bindBuffer: noop,
    bufferData: () => { glCalls.bufferData++; },
    createVertexArray: () => ({}), bindVertexArray: noop,
    enableVertexAttribArray: noop, vertexAttribPointer: noop,
    createTexture: () => { createdTextures++; return {}; },
    bindTexture: noop, texImage2D: () => { glCalls.texImage++; },
    texParameteri: noop, generateMipmap: noop,
    createFramebuffer: () => ({}), bindFramebuffer: noop,
    createRenderbuffer: () => ({}), bindRenderbuffer: noop,
    renderbufferStorage: noop, framebufferRenderbuffer: noop,
    useProgram: noop, uniform1f: noop, uniform1i: noop, uniform2f: noop, uniform3f: noop, uniform4f: noop,
    uniformMatrix4fv: noop,
    enable: noop, disable: noop, depthFunc: noop, depthMask: noop, cullFace: noop, blendFunc: noop,
    polygonOffset: noop, clearColor: noop, clear: noop, viewport: noop, activeTexture: noop,
    drawElements: () => { glCalls.drawElements++; },
    drawArrays: () => { glCalls.drawArrays++; },
    readPixels: (x, y, w, h, f, t, buf) => { glCalls.readPixels++; buf[0] = buf[1] = buf[2] = 0; },
    getExtension: () => ({}),
    getParameter: () => 16384
  });
  return c;
}

/* --- canvas 2D stub for the procedural textures --- */
function make2D(w, h) {
  const grad = { addColorStop: () => { } };
  return {
    fillStyle: '', strokeStyle: '', lineWidth: 1,
    fillRect: () => { }, strokeRect: () => { }, clearRect: () => { },
    beginPath: () => { }, moveTo: () => { }, lineTo: () => { }, arc: () => { }, stroke: () => { }, fill: () => { },
    createLinearGradient: () => grad, createRadialGradient: () => grad,
    getImageData: (x, y, ww, hh) => ({ data: new Uint8ClampedArray(ww * hh * 4), width: ww, height: hh }),
    putImageData: () => { }, createImageData: (ww, hh) => ({ data: new Uint8ClampedArray(ww * hh * 4), width: ww, height: hh }),
    save: () => { }, restore: () => { }, translate: () => { }, rotate: () => { }, scale: () => { }
  };
}

/* --- minimal DOM --- */
const elements = {};
function makeEl(tag, id) {
  const el = {
    tagName: (tag || 'div').toUpperCase(), id: id || '', _children: [], dataset: {},
    className: '', style: new Proxy({}, { get: (t, k) => (k === 'setProperty' ? () => { } : ''), set: () => true }),
    innerHTML: '', textContent: '', value: '0', checked: false, width: 1280, height: 800,
    clientWidth: 1280, clientHeight: 800,
    classList: { add: () => { }, remove: () => { }, toggle: () => { }, contains: () => false },
    appendChild(c) { this._children.push(c); c.parentNode = this; return c; },
    removeChild(c) { return c; },
    addEventListener: () => { }, removeEventListener: () => { },
    setPointerCapture: () => { },
    getContext: (t) => (t === '2d' ? make2D(el.width, el.height) : makeGLStub()),
    getBoundingClientRect: () => ({ left: 900, top: 56, right: 1222, bottom: 600, width: 322, height: 544 }),
    querySelector: () => null, querySelectorAll: () => [],
    childElementCount: 0, offsetWidth: 120, offsetHeight: 24,
    dispatchEvent: () => { }, focus: () => { }
  };
  Object.defineProperty(el, 'childElementCount', { get() { return this._children.length; } });
  Object.defineProperty(el, 'children', { get() { return this._children; } });
  return el;
}
['cv', 'err', 'tree', 'q', 'pcount', 'dbody', 'did', 'dclr', 'tt', 'out', 'stat', 'cTri',
  'tAuto', 'tWire', 'tLab', 'tDim', 'tGho', 'tGrid', 'rX', 'vX', 'bAll', 'bOri', 'panel'].forEach(id => {
    elements[id] = makeEl(id === 'cv' ? 'canvas' : 'div', id);
  });
elements.tAuto.checked = true;

const listeners = {};
const win = {
  innerWidth: 1600, innerHeight: 900, devicePixelRatio: 1,
  addEventListener: (k, f) => { (listeners[k] = listeners[k] || []).push(f); },
  removeEventListener: () => { },
  requestAnimationFrame: (f) => { win.__raf = f; return 1; },
  performance: { now: () => Date.now() },
  console,
  document: {
    getElementById: (id) => elements[id] || null,
    createElement: (t) => makeEl(t),
    createElementNS: (ns, t) => makeEl(t),
    createDocumentFragment: () => makeEl('frag'),
    querySelectorAll: () => [],
    addEventListener: () => { },
    body: makeEl('body')
  },
  navigator: { userAgent: 'node' },
  Math, Date, JSON, isNaN, parseFloat, parseInt, Float32Array, Uint8Array, Uint32Array,
  Uint8ClampedArray, Int32Array, Array, Object, String, Number, Boolean, Error, Proxy, Reflect
};
win.window = win;
win.self = win;
win.globalThis = win;
const ctx = vm.createContext(win);
ctx.console = console;
ctx.performance = win.performance;

/* --- run the three real scripts in order --- */
['atf-x-bow-core.js', 'atf-x-bow-parts.js', 'atf-x-bow-ui.js'].forEach(f => {
  const src = fs.readFileSync(path.join(DIR, f), 'utf8');
  vm.runInContext(src, ctx, { filename: f });
});

/* --- fire DOMContentLoaded/load --- */
let bootErr = null;
try {
  (listeners['load'] || []).forEach(f => f({}));
} catch (e) { bootErr = e; }

console.log('boot error :', bootErr ? (bootErr.stack || bootErr.message) : 'none');
console.log('err panel  :', (elements.err.innerHTML || '(empty)').slice(0, 400));

const S = win.S;
if (!S) { console.log('FATAL: STATE missing'); process.exit(1); }
console.log('objects    :', S.objs.length);
console.log('groups     :', S.groups.map(g => g.en + '(' + g.items.length + ')').join(', '));
console.log('tris (all) :', Math.round(S.objs.reduce((a, o) => a + o.g.tri.length / 3, 0)).toLocaleString());
console.log('gl calls   :', JSON.stringify(glCalls), 'textures:', createdTextures);

/* every object must have finite positions, a bounding box and metadata */
let bad = 0, noMeta = 0, empty = 0;
for (const o of S.objs) {
  const p = o.g.pos;
  if (!p.length) { empty++; console.log('  EMPTY GEO  ', o.id); continue; }
  let nan = 0;
  for (let i = 0; i < p.length; i++) if (!isFinite(p[i])) nan++;
  if (nan) { bad++; console.log('  NaN x' + nan + ' in', o.id); }
  if (!isFinite(o.g.r) || o.g.r <= 0) { bad++; console.log('  bad radius', o.id, o.g.r); }
  if (!o.part || o.part === o.g.name) { noMeta++; console.log('  NO METADATA', o.id, '->', o.part); }
}
console.log('geometry problems:', bad, ' empty:', empty, ' missing metadata:', noMeta);

/* extents of the real model (ignoring floor/grid/tools) */
let mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
for (const o of S.objs) {
  if (o.noPick || o.id.startsWith('tool.')) continue;
  const m = win.m4trs([o.pos.x, o.pos.y, o.pos.z], o.rot, o.scale);
  for (let i = 0; i < o.g.pos.length; i += 3) {
    const w = win.m4xform(m, { x: o.g.pos[i], y: o.g.pos[i + 1], z: o.g.pos[i + 2] });
    mn = [Math.min(mn[0], w.x), Math.min(mn[1], w.y), Math.min(mn[2], w.z)];
    mx = [Math.max(mx[0], w.x), Math.max(mx[1], w.y), Math.max(mx[2], w.z)];
  }
}
console.log('model X    :', mn[0].toFixed(1), '..', mx[0].toFixed(1), '(宽度)');
console.log('model Y    :', mn[1].toFixed(1), '..', mx[1].toFixed(1), '(高度 = 整弓长)');
console.log('model Z    :', mn[2].toFixed(1), '..', mx[2].toFixed(1), '(深度)');

/* run a few frames */
try {
  for (let i = 0; i < 3; i++) { if (win.__raf) win.__raf(); }
  console.log('frames     : ok, tris drawn =', Math.round(S.tris).toLocaleString(), 'fps=', Math.round(S.fps));
} catch (e) { console.log('frame error:', e.stack || e.message); }

/* pick + selection path */
try {
  const o = S.objs.find(x => x.id === 'riser.body');
  console.log('part name  :', o.part, '| mat:', o.mat, '| spec:', o.spec, '| notes:', o.note && o.note.length);
  win.selectPart(o);
  console.log('detail html:', (elements.dbody.innerHTML || '').slice(0, 220).replace(/\s+/g, ' '));
  win.focusOn(o);
  console.log('focus cam  :', S.cam.tx.toFixed(0), S.cam.ty.toFixed(0), S.cam.tz.toFixed(0), 'dist', S.cam.dist.toFixed(0));
} catch (e) { console.log('select error:', e.stack || e.message); }

/* annotations */
try {
  win.buildDimensions();
  console.log('dim labels :', (win.DIMMARKS || []).length);
} catch (e) { console.log('dim error  :', e.stack || e.message); }

console.log('BOW spec   :', JSON.stringify(win.BOW));

/* ---- physical clearance check: string vs limb centreline ---- */
(function clearance() {
  const P = [];
  for (let i = 0; i <= 40; i++) {
    const t = i / 40;
    const p = win.limbParam(t, 1);
    P.push({ y: p.y, z: p.z, hw: 0.94 + (0.28 - 0.94) * Math.pow(t, 0.86), hh: 0.50 + (0.180 - 0.50) * Math.pow(t, 0.95) });
  }
  const A = { y: win.BOW.tipY, z: win.BOW.tipZ }, B = { y: 0, z: win.BOW.stringZ };
  let worst = 1e9, wy = 0;
  for (const p of P) {
    /* distance from the limb node to the string segment (in the y/z plane) */
    const vy = B.y - A.y, vz = B.z - A.z;
    const L2 = vy * vy + vz * vz;
    let u = ((p.y - A.y) * vy + (p.z - A.z) * vz) / L2;
    u = Math.max(0, Math.min(1, u));
    const cy = A.y + vy * u, cz = A.z + vz * u;
    const d = Math.hypot(p.y - cy, p.z - cz);
    const need = p.hh + 1.8;
    if (d - need < worst) { worst = d - need; wy = p.y; }
  }
  console.log('string/limb clearance:', worst.toFixed(1), 'mm  (at y=' + wy.toFixed(0) + ', must be > 0)');
})();
