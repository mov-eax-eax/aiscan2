// Static audit for src/facades-np/*.js — catches undefined kit helpers, bad
// re-exports, missing bucket materials and duplicate kit exports without a browser.
import { readFileSync } from 'node:fs';

const root = new URL('../../src/facades-np/', import.meta.url);
const read = (f) => readFileSync(new URL(f, root), 'utf8');
const readSrc = (f) => readFileSync(new URL('../' + f, root), 'utf8');

const kit = read('kit.js');
const nativity = read('nativity.js');
const passion = read('passion.js');
const lib = readSrc('lib.js');
const config = readSrc('config.js');

const problems = [];
const exportsOf = (src) => {
  const set = new Set();
  for (const m of src.matchAll(/export\s+(?:function|const|class|let|var)\s+(\w+)/g)) set.add(m[1]);
  for (const m of src.matchAll(/export\s*\{([\s\S]*?)\}/g)) {
    for (const raw of m[1].split(',')) {
      const name = raw.trim().split(/\s+as\s+/).pop().trim();
      if (name && /^\w+$/.test(name)) set.add(name);
    }
  }
  return set;
};
const libExports = exportsOf(lib);
const kitExports = exportsOf(kit);

// --- named imports inside kit must exist in lib ----------------------------
const importBlocks = [...kit.matchAll(/import\s*\{([\s\S]*?)\}\s*from\s*'([^']+)'/g)];
for (const [, names, from] of importBlocks) {
  for (const raw of names.split(',')) {
    const name = raw.trim().split(/\s+as\s+/).pop().trim();
    if (!name) continue;
    if (from === '../lib.js' && !libExports.has(name)) problems.push(`kit.js imports missing lib export '${name}'`);
    if (from === '../config.js' && !exportsOf(config).has(name)) problems.push(`kit.js imports missing config export '${name}'`);
  }
}

// --- re-exports from lib must exist ---------------------------------------
const reexport = kit.match(/export\s*\{([\s\S]*?)\}\s*from\s*'\.\.\/lib\.js'/);
if (reexport) {
  for (const raw of reexport[1].split(',')) {
    const name = raw.trim().split(/\s+as\s+/).pop().trim();
    if (!name) continue;
    if (!libExports.has(name)) problems.push(`kit.js re-exports missing lib export '${name}'`);
    if (new RegExp(`export\\s+(?:function|const)\\s+${name}\\b`).test(kit)) problems.push(`kit.js duplicate export '${name}'`);
  }
}

// --- buckets + materials ---------------------------------------------------
const buckets = new Set();
const bn = kit.match(/const BUCKET_NAMES = \[([\s\S]*?)\];/);
if (bn) for (const m of bn[1].matchAll(/'(\w+)'/g)) buckets.add(m[1]);
for (const fn of ['nativityMaterials', 'passionMaterials']) {
  const start = kit.indexOf(`export function ${fn}`);
  const end = kit.indexOf('export function', start + 10);
  const body = kit.slice(start, end === -1 ? undefined : end);
  for (const b of buckets) {
    if (b === 'glass') continue; // shared glassMaterial, not in the maps
    if (!new RegExp(`\\b${b}:`).test(body)) problems.push(`${fn}: missing material for bucket '${b}'`);
  }
}

// --- usages ----------------------------------------------------------------
for (const [name, src] of [
  ['nativity.js', nativity],
  ['passion.js', passion],
]) {
  for (const m of src.matchAll(/\bK\.(\w+)/g)) {
    if (!kitExports.has(m[1]) && !libExports.has(m[1])) problems.push(`${name}: K.${m[1]} is not exported by kit.js`);
  }
  for (const m of src.matchAll(/\bB\.(\w+)/g)) {
    if (m[1] === 'texts' || m[1] === 'glass') continue;
    if (!buckets.has(m[1])) problems.push(`${name}: B.${m[1]} is not a bucket`);
  }
  for (const [, names, from] of [...src.matchAll(/import\s*\{([\s\S]*?)\}\s*from\s*'([^']+)'/g)]) {
    for (const raw of names.split(',')) {
      const nm = raw.trim().split(/\s+as\s+/).pop().trim();
      if (!nm) continue;
      const table = from.includes('lib') ? libExports : from.includes('config') ? exportsOf(config) : from.includes('kit') ? kitExports : null;
      if (table && !table.has(nm)) problems.push(`${name}: imports missing '${nm}' from '${from}'`);
    }
  }
}

if (problems.length) {
  console.log('PROBLEMS:\n' + problems.join('\n'));
  process.exit(1);
}
console.log(
  `OK — lib exports ${libExports.size}, kit exports ${kitExports.size}, buckets: ${[...buckets].join(',')}`
);
