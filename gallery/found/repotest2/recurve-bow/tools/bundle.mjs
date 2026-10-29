/* Build recurve.standalone.html -- one portable file with three.js and every
   module inlined, so it opens by double-clicking with no server and no
   network.

   This is a deliberately small bundler rather than a dependency: the project
   is ten ES modules with static named imports and no dynamic import, no
   circular dependency and no top-level await, so a topological walk plus two
   regexes is enough -- and it keeps the repo installable with nothing but
   puppeteer for screenshots.

   usage:  node tools/bundle.mjs
*/
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const ENTRY = 'src/main.js';
const PAGE = 'recurve.html';
const OUT = 'recurve.standalone.html';

const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');

/* ------------------------------------------------------------- imports --- */

const IMPORT_RE = /^[ \t]*import\s+(?:(\*\s+as\s+[\w$]+)|(\{[^}]*\})|([\w$]+))\s+from\s+['"]([^'"]+)['"];?[ \t]*$/gm;
const BARE_IMPORT_RE = /^[ \t]*import\s+['"]([^'"]+)['"];?[ \t]*$/gm;

function depsOf(src) {
  const out = [];
  let m;
  IMPORT_RE.lastIndex = 0;
  while ((m = IMPORT_RE.exec(src))) out.push(m[4]);
  BARE_IMPORT_RE.lastIndex = 0;
  while ((m = BARE_IMPORT_RE.exec(src))) out.push(m[1]);
  return out;
}

function resolve(fromId, spec) {
  if (!spec.startsWith('.')) throw new Error(`bare specifier "${spec}" in ${fromId} -- cannot inline`);
  const dir = path.posix.dirname(fromId);
  return path.posix.normalize(path.posix.join(dir, spec));
}

/* --------------------------------------------------------------- order --- */

const modules = new Map();
const order = [];

function visit(id) {
  if (modules.has(id)) return;
  const src = read(id);
  modules.set(id, src);
  for (const spec of depsOf(src)) visit(resolve(id, spec));
  order.push(id);                       // post-order == dependencies first
}

visit(ENTRY);
console.log(`modules: ${order.length}`);
for (const id of order) console.log(`  ${id}  ${(modules.get(id).length / 1024).toFixed(1)} kB`);

/* ---------------------------------------------------------- transform --- */

const varName = id => '__mod_' + id.replace(/[^a-zA-Z0-9]/g, '_');

function transform(id, src, { isThree = false } = {}) {
  const exports = [];
  let body = src;

  /* imports -> registry lookups */
  body = body.replace(IMPORT_RE, (full, ns, named, def, spec) => {
    const dep = varName(resolve(id, spec));
    if (ns) {
      const local = ns.replace(/^\*\s+as\s+/, '').trim();
      return `const ${local} = ${dep};`;
    }
    if (named) {
      const inner = named.slice(1, -1).split(',').map(s => s.trim()).filter(Boolean)
        .map(s => {
          const parts = s.split(/\s+as\s+/).map(x => x.trim());
          return parts.length === 2 ? `${parts[0]}: ${parts[1]}` : parts[0];
        }).join(', ');
      return `const { ${inner} } = ${dep};`;
    }
    if (def) return `const ${def} = ${dep}.default;`;
    return '';
  });
  body = body.replace(BARE_IMPORT_RE, '');

  /* exports -> declarations (+ a record of the name) */
  const declRe = /^[ \t]*export\s+(const|let|var|function|class|async\s+function)\s+([\w$]+)/gm;
  body = body.replace(declRe, (full, kw, name) => {
    if (!exports.includes(name)) exports.push(name);
    return full.replace(/^([ \t]*)export\s+/, '$1');
  });

  /* export { a, b as c } */
  const listRe = /^[ \t]*export\s*\{([^}]*)\}\s*;?[ \t]*$/gm;
  body = body.replace(listRe, (full, inner) => {
    for (const piece of inner.split(',').map(s => s.trim()).filter(Boolean)) {
      const parts = piece.split(/\s+as\s+/).map(x => x.trim());
      const name = parts.length === 2 ? parts[1] : parts[0];
      if (!exports.includes(name)) exports.push(name);
    }
    return '';
  });

  /* three.js gets the SAME registry name as every other module, so that
     `import * as THREE from '...three.module.js'` resolves to it by the
     ordinary path. Binding it to a literal `THREE` looks tidier and fails at
     the very first import. */
  if (isThree && !exports.length) throw new Error(`${id}: found no exports -- format changed`);
  return `const ${varName(id)} = (function(){\n${body}\nreturn { ${exports.join(', ')} };\n})();\n`;
}

const chunks = order.map(id =>
  `\n/* ===== ${id} ${'='.repeat(Math.max(0, 64 - id.length))} */\n` +
  transform(id, modules.get(id), { isThree: id.endsWith('three.module.js') }));

/* ------------------------------------------------------------- assemble --- */

let html = read(PAGE);

/* the page's own bottom script imports main.js; fold that import away and
   keep the view-button setup that follows it */
html = html.replace(
  /<script\s+type="module">([\s\S]*?)<\/script>/,
  (full, inner) => {
    if (!/import\s+['"][^'"]*main\.js['"]/.test(inner)) {
      throw new Error('could not find the entry import in the page script');
    }
    const rest = inner.replace(/^[ \t]*import\s+['"][^'"]*main\.js['"];?[ \t]*$/m, '');
    return `<script>\n${chunks.join('\n')}\n/* ===== page bootstrap ===== */\n${rest}\n</script>`;
  });

if (!html.includes('__mod_vendor_three_module_js')) throw new Error('three.js was not inlined');

fs.writeFileSync(path.join(ROOT, OUT), html);
const kb = (fs.statSync(path.join(ROOT, OUT)).size / 1024).toFixed(0);
console.log(`\nwrote ${OUT}  (${kb} kB, self-contained)`);
