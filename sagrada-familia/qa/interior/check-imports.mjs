// Static import/export checker for the interior modules (no browser needed).
// Usage: node qa/interior/check-imports.mjs
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '../..');
const SRC = resolve(ROOT, 'src');
const files = [
  ...readdirSync(resolve(SRC, 'interior')).filter((f) => f.endsWith('.js')).map((f) => resolve(SRC, 'interior', f)),
  resolve(SRC, 'interior.js'),
];

function exportsOf(file) {
  const txt = readFileSync(file, 'utf8');
  const names = new Set();
  for (const m of txt.matchAll(/export\s+(?:async\s+)?(?:function|const|let|var|class)\s+([A-Za-z_$][\w$]*)/g)) names.add(m[1]);
  for (const m of txt.matchAll(/export\s*\{([^}]*)\}/g)) {
    for (const part of m[1].split(',')) {
      const name = part.trim().split(/\s+as\s+/).pop().trim();
      if (name) names.add(name);
    }
  }
  if (/export\s+default/.test(txt)) names.add('default');
  return names;
}

let problems = 0;
for (const file of files) {
  const txt = readFileSync(file, 'utf8');
  const exportCache = new Map();
  for (const m of txt.matchAll(/import\s*\{([\s\S]*?)\}\s*from\s*['"]([^'"]+)['"]/g)) {
    const names = m[1]
      .split(',')
      .map((s) => s.trim().split(/\s+as\s+/)[0].trim())
      .filter(Boolean);
    const spec = m[2];
    if (!spec.startsWith('.')) continue; // bare 'three' is resolved by the import map
    const target = resolve(dirname(file), spec);
    if (!exportCache.has(target)) exportCache.set(target, exportsOf(target));
    const ex = exportCache.get(target);
    for (const name of names) {
      if (!ex.has(name)) {
        problems++;
        console.log(`MISSING ${file.replace(ROOT, '')}: '${name}' not exported by ${spec}`);
      }
    }
  }
}
console.log(problems ? `${problems} import problem(s)` : 'all relative imports resolve to real exports');
process.exit(problems ? 1 : 0);
