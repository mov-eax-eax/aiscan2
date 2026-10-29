/* Inline the vendor scripts and the model modules into one portable HTML file. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ORDER = ['vendor/three.min.js', 'vendor/OrbitControls.js', 'src/geom.js', 'src/materials.js', 'src/bow.js', 'src/app.js'];
let html = fs.readFileSync(path.join(ROOT, 'mathews.html'), 'utf8');
for (const f of ORDER) {
  const code = fs.readFileSync(path.join(ROOT, f), 'utf8').split('</script').join('<\\/script');
  const tag = '<script src="' + f + '"></script>';
  if (html.indexOf(tag) < 0) { console.error('missing tag for ' + f); process.exit(1); }
  html = html.replace(tag, '<script>\n' + code + '\n</script>');
}
const out = path.join(ROOT, 'mathews-standalone.html');
fs.writeFileSync(out, html);
console.log('wrote ' + out + '  ' + (fs.statSync(out).size / 1024 / 1024).toFixed(2) + ' MB');
