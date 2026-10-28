// Heuristic: find bare calls to shared kit symbols that are neither imported
// nor locally declared. Catches missing import-list entries (the boxGeo class
// of boot failure) without running a browser.
// Run: node qa/experience/check-symbols.mjs

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

function exportedNames(file) {
  const source = fs.readFileSync(file, 'utf8');
  const names = new Set();
  for (const m of source.matchAll(/export\s+(?:async\s+)?(?:function|const|let|var|class)\s+([A-Za-z_$][\w$]*)/g)) names.add(m[1]);
  for (const m of source.matchAll(/export\s*\{([^}]*)\}/g)) {
    for (const part of m[1].split(',')) {
      const bits = part.trim().split(/\s+as\s+/);
      const name = (bits[1] || bits[0] || '').trim();
      if (name) names.add(name);
    }
  }
  return names;
}

const libNames = exportedNames(path.join(srcDir, 'lib.js'));
const commonNames = fs.existsSync(path.join(srcDir, 'interior/common.js'))
  ? exportedNames(path.join(srcDir, 'interior/common.js'))
  : new Set();
const shared = new Set([...libNames, ...commonNames]);
// Ignore generic names that are frequently local helpers.
for (const skip of ['group', 'rng', 'rand', 'pick', 'chance', 'clamp', 'lerp', 'smoothstep', 'matrixAt', 'matricesFrom', 'scaleUV', 'shapeGeo', 'bucket']) {
  // keep them: only flag when used bare and not imported/defined, which the
  // per-file test below handles correctly either way
}

const files = walk(srcDir);
const problems = [];

for (const file of files) {
  const source = fs.readFileSync(file, 'utf8');
  const imported = new Set();
  for (const m of source.matchAll(/import\s+([\s\S]*?)\s+from\s+['"][^'"]+['"]/g)) {
    const clause = m[1];
    const braces = clause.match(/\{([\s\S]*)\}/);
    if (braces) {
      for (const part of braces[1].split(',')) {
        const name = part.trim().split(/\s+as\s+/)[0].trim();
        if (name) imported.add(name);
      }
    }
    const ns = clause.match(/\*\s+as\s+([A-Za-z_$][\w$]*)/);
    if (ns) imported.add(ns[1]);
  }
  const local = new Set();
  for (const m of source.matchAll(/(?:function|const|let|var|class)\s+([A-Za-z_$][\w$]*)/g)) local.add(m[1]);
  for (const m of source.matchAll(/(?:const|let|var)\s*\{([^}]*)\}\s*=/g)) {
    for (const part of m[1].split(',')) {
      const name = part.trim().split(':').pop().trim();
      if (name) local.add(name);
    }
  }
  // Strip import statements so symbol names in import lists don't count as uses.
  const body = source.replace(/import\s+[\s\S]*?\s+from\s+['"][^'"]+['"]\s*;?/g, '');
  for (const name of shared) {
    if (imported.has(name) || local.has(name)) continue;
    const re = new RegExp(`(?<![.\\w$])${name}\\s*\\(`);
    if (re.test(body)) problems.push(`${path.relative(root, file)}: uses '${name}' but does not import or declare it`);
  }
}

if (problems.length === 0) console.log('No missing shared-symbol imports detected.');
else {
  console.log(`${problems.length} possible missing symbol import(s):`);
  for (const p of problems) console.log('  ' + p);
}
