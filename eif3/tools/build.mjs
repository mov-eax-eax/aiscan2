/**
 * build.mjs — concatenate src/*.js into a single self-contained dist/index.html.
 *
 *   node tools/build.mjs                     → dist/index.html
 *   node tools/build.mjs --out ../x.html     → custom output (handy for agents)
 *
 * The bundle is syntax-checked with `node --check` before the shell is written,
 * so a broken fragment fails the build with the offending file in the error.
 */
import { writeFile, mkdir, unlink } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { bundle, readShell } from './modules.mjs';

const args = process.argv.slice(2);
const outIndex = args.indexOf('--out');
const outFile = resolve(outIndex >= 0 ? args[outIndex + 1] : 'dist/index.html');

const code = await bundle();
const shell = await readShell();

// Syntax-check the concatenated module (top-level await is legal in .mjs).
const tmp = join(tmpdir(), 'eif3-bundle-check.mjs');
await writeFile(tmp, code, 'utf8');
const check = spawnSync(process.execPath, ['--check', tmp], { encoding: 'utf8' });
await unlink(tmp).catch(() => {});
if (check.status !== 0) {
  console.error('build failed: one of src/*.js does not parse\n');
  console.error((check.stderr || '').trim());
  process.exit(1);
}

const tag = '<script type="module" src="./app.js"></script>';
if (!shell.includes(tag)) {
  console.error('build failed: index.html shell is missing ' + tag);
  process.exit(1);
}

const html = shell.replace(tag, '<script type="module">\n' + code + '\n</script>');
await mkdir(dirname(outFile), { recursive: true });
await writeFile(outFile, html, 'utf8');
console.log('built ' + outFile + '  (' + (html.length / 1024).toFixed(1) + ' kB)');
