import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const dev = process.argv.includes('--dev');
const out = dev ? resolve(here, 'dist/tower.dev.html') : resolve(root, 'tour-eiffel.html');

const result = await build({
  entryPoints: [resolve(here, 'src/main.js')],
  bundle: true, format: 'iife', target: ['chrome110'], minify: !dev,
  legalComments: 'none', write: false, logLevel: 'warning',
  loader: { '.glsl': 'text' },
});
const js = result.outputFiles[0].text;
const shell = readFileSync(resolve(here, 'src/index.html'), 'utf8');
const html = shell.replace('/*__APP__*/', () => js);
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, html);
const kb = (n) => (n / 1024).toFixed(0) + ' KB';
console.log('built', out, '| html', kb(html.length), '| js', kb(js.length));
