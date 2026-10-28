// Static import/export sanity check for the project's ES modules.
// No browser, no network: reads files from disk and compares named imports
// against the exported names of their targets.
// Run: node qa/experience/check-imports.mjs

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const srcDir = path.join(root, 'src');

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (entry.isFile() && entry.name.endsWith('.js')) out.push(full);
  }
  return out;
}

const files = walk(srcDir);
const exportsByFile = new Map();

function collectExports(source) {
  const names = new Set();
  // export function/const/let/var/class
  for (const m of source.matchAll(/export\s+(?:async\s+)?(?:function|const|let|var|class)\s+([A-Za-z_$][\w$]*)/g)) names.add(m[1]);
  // export { a, b as c }
  for (const m of source.matchAll(/export\s*\{([^}]*)\}/g)) {
    for (const part of m[1].split(',')) {
      const bits = part.trim().split(/\s+as\s+/);
      const name = (bits[1] || bits[0] || '').trim();
      if (name) names.add(name);
    }
  }
  // export * from ... is not resolved here
  for (const m of source.matchAll(/export\s*\*\s*from/g)) names.add('*');
  return names;
}

for (const file of files) exportsByFile.set(path.resolve(file), collectExports(fs.readFileSync(file, 'utf8')));

const problems = [];
for (const file of files) {
  const source = fs.readFileSync(file, 'utf8');
  const dir = path.dirname(file);
  const importRe = /import\s+([\s\S]*?)\s+from\s+['"]([^'"]+)['"]/g;
  for (const m of source.matchAll(importRe)) {
    const clause = m[1].trim();
    const spec = m[2];
    if (!spec.startsWith('.')) continue;
    let target = path.resolve(dir, spec);
    if (!target.endsWith('.js')) target += '.js';
    if (!fs.existsSync(target)) {
      problems.push(`${path.relative(root, file)}: missing module ${spec}`);
      continue;
    }
    const exported = exportsByFile.get(target);
    if (!exported) continue;
    const braces = clause.match(/\{([\s\S]*)\}/);
    if (!braces) continue;
    for (const part of braces[1].split(',')) {
      const name = part.trim().split(/\s+as\s+/)[0].trim();
      if (!name) continue;
      if (!exported.has(name) && !exported.has('*')) {
        problems.push(
          `${path.relative(root, file)}: imports '${name}' from ${path.relative(root, target)}, which does not export it`
        );
      }
    }
  }
}

if (problems.length === 0) console.log('All named imports resolve.');
else {
  console.log(`${problems.length} unresolved import(s):`);
  for (const p of problems) console.log('  ' + p);
}
