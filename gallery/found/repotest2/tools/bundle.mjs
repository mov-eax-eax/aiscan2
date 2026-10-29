/* Bundler: produce ONE portable HTML file.
   Both three.js and the simulation are base64-encoded into the document and
   decoded at run time, so the file opens straight from disk (file://) with no
   server and no network, and no source content can collide with HTML markup.
   node tools/bundle.mjs                                                      */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'src');
const read = (p) => fs.readFileSync(p, 'utf8');
const b64 = (s) => Buffer.from(s, 'utf8').toString('base64');

/* Bundle one module into its own IIFE so private names (clamp, box, ...) cannot
   collide across modules, re-exporting its public names onto a shared object. */
function wrapModule(code, head = '', exposeNames = null) {
  const names = new Set(exposeNames || []);
  if (!exposeNames) {
    code.replace(/^export\s+(?:const|let|var|function|class)\s+([A-Za-z_$][\w$]*)/gm, (m, n) => { names.add(n); return m; });
    for (const m of code.matchAll(/^export\s*\{([^}]*)\}\s*;?\s*$/gm)) {
      for (const part of m[1].split(',')) {
        const t = part.trim();
        if (!t) continue;
        const as = t.split(/\s+as\s+/);
        names.add((as[1] || as[0]).trim());
      }
    }
  }
  const body = code
    .replace(/^\s*import\s+[^;]*?from\s+['"][^'"]+['"];?[ \t]*$/gm, '')
    .replace(/^\s*import\s+['"][^'"]+['"];?[ \t]*$/gm, '')
    .replace(/^export\s+(const|let|var|function|class)\s/gm, '$1 ')
    .replace(/^export\s*\{[^}]*\}\s*;?\s*$/gm, '');
  const expose = [...names].map(n => `__M.${n} = ${n};`).join(' ');
  return `/* ---- module ---- */\n{\n${head}${body}\n${expose}\n}`;
}

const ORDER = ['geom.js', 'core.js', 'crossbow.js', 'main.js'];
const three = read(path.join(ROOT, 'vendor', 'three.module.js'));

/* All top-level `const`/`let`/`var` names, including those in multi-declarator
   statements such as `const A = 1, B = 2;`.  Exposing these means the bundle
   never depends on getting the import graph perfectly parsed. */
function topLevelNames(code) {
  const names = new Set();
  const lines = code.split(/\r?\n/);
  for (const line of lines) {
    const m = line.match(/^(?:export[ \t]+)?(?:const|let|var)[ \t]+(.+)$/);
    if (!m) continue;
    let depth = 0;
    for (const part of m[1].split(',')) {
      if (depth === 0) {
        const n = part.trim().match(/^([A-Za-z_$][\w$]*)/);
        if (n) names.add(n[1]);
      }
      depth += (part.match(/[[({]/g) || []).length - (part.match(/[\])}]/g) || []).length;
    }
  }
  for (const m of code.matchAll(/^(?:async[ \t]+)?function[ \t]+([A-Za-z_$][\w$]*)/gm)) names.add(m[1]);
  for (const m of code.matchAll(/^class[ \t]+([A-Za-z_$][\w$]*)/gm)) names.add(m[1]);
  return names;
}

/* Every module in the bundle exposes all of its top-level names.  The scopes are
   private anyway (each module is wrapped in its own block), so this is the
   simplest thing that cannot go wrong. */
const fromModule = {};
for (const f of ORDER.slice(0, -1)) fromModule[f] = topLevelNames(read(path.join(SRC, f)));
const shared = [...new Set(ORDER.slice(0, -1).flatMap(f => [...fromModule[f]]))];
const bundle = ORDER
  .map((f, idx) => {
    const code = read(path.join(SRC, f));
    /* main.js needs the other modules' public names bound at the top of its own
       scope — by then the earlier modules have already populated __M. */
    const head = idx === ORDER.length - 1
      ? `const { ${[...new Set(shared)].join(', ')} } = __M;\n`
      : '';
    const expose = idx === ORDER.length - 1 ? [] : [...fromModule[f]];
    return `\n/* ===== ${f} ${'='.repeat(64 - f.length)} ===== */\n` + wrapModule(code, head, expose);
  })
  .join('\n');

const threeB64 = b64(three);
const simB64 = b64(bundle);

const bootstrap = `
const b64d = (s) => new TextDecoder().decode(Uint8Array.from(atob(s), (c) => c.charCodeAt(0)));
const __threeSrc = b64d(${JSON.stringify(threeB64)});
window.__SIMSRC__ = b64d(${JSON.stringify(simB64)});
const __threeURL = URL.createObjectURL(new Blob([__threeSrc], { type: 'text/javascript' }));
window.__THREE__ = await import(__threeURL);
const THREE = window.__THREE__;
const __M = {};
/* --- simulation: the modules run in order inside this scope, so they can see
       THREE, and each writes its public names onto __M --- */
const __runAll = new Function('THREE', '__M', window.__SIMSRC__);
__runAll(THREE, __M);
`;

let html = read(path.join(ROOT, 'crossbow.html'));
html = html.replace(/<script type="importmap">[\s\S]*?<\/script>\s*/, '');
html = html.replace(/<script type="module" src="\.\/src\/main\.js"><\/script>/,
  `<script type="module">${bootstrap}</script>`);

const out = path.join(ROOT, 'crossbow.standalone.html');
fs.writeFileSync(out, html);
console.log('wrote', out, (fs.statSync(out).size / 1024 / 1024).toFixed(2), 'MB');
console.log('shared names hoisted:', [...new Set(shared)].length);
console.log('core.js exposes:', [...fromModule['core.js']].join(','));



