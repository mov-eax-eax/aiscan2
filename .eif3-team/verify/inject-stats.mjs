/**
 * inject-stats.mjs — verifier helper. Copies the built single-file page and
 * appends an instrumentation block to the END of the inline module script:
 *   - collects window.error / unhandledrejection messages
 *   - after ~6 s of virtual time writes scene stats + loader/error-overlay
 *     state into document.title as "STATS {json}"
 * Nothing in src/, dist/ or tools/ is touched.
 */
import { readFile, writeFile } from 'node:fs/promises';

const [, , inFile, outFile] = process.argv;
const source = await readFile(inFile, 'utf8');

const marker = '\n</script>\n</body>';
const idx = source.lastIndexOf(marker);
if (idx < 0) {
  console.error('inject-stats: closing module script not found');
  process.exit(1);
}

const snippet = `
;window.__eif3verify = { errors: [] };
window.addEventListener('error', (e) => window.__eif3verify.errors.push('error: ' + (e.message || e.type)));
window.addEventListener('unhandledrejection', (e) => window.__eif3verify.errors.push('rejection: ' + String(e.reason)));
setTimeout(() => {
  let meshes = 0, instanced = 0, instances = 0, points = 0, tris = 0;
  scene.traverse((o) => {
    if (o.isMesh) {
      meshes++;
      if (o.isInstancedMesh) { instanced++; instances += o.count; }
      const g = o.geometry;
      if (g) {
        const n = g.index ? g.index.count : (g.attributes.position ? g.attributes.position.count : 0);
        tris += (n / 3) * (o.isInstancedMesh ? o.count : 1);
      }
    } else if (o.isPoints) points++;
  });
  const ld = document.getElementById('loader');
  const er = document.getElementById('error');
  const stats = {
    meshes, instanced, instances, points, tris: Math.round(tris),
    calls: renderer.info.render.calls,
    trisDrawn: renderer.info.render.triangles,
    geometries: renderer.info.memory.geometries,
    textures: renderer.info.memory.textures,
    loaderHidden: ld.classList.contains('hide'),
    loaderOpacity: getComputedStyle(ld).opacity,
    errorShown: !er.hidden,
    frames: frameCount,
    errors: window.__eif3verify.errors,
  };
  document.title = 'STATS ' + JSON.stringify(stats);
}, 6000);
`;

const out = source.slice(0, idx) + snippet + source.slice(idx);
await writeFile(outFile, out, 'utf8');
console.log('wrote ' + outFile + ' (' + (out.length / 1024).toFixed(1) + ' kB)');
