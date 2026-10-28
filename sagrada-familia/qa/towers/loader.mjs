// Node module-resolution shim so the tower geometry can be exercised without a
// browser: maps the bare "three" specifier to the vendor ES module.
import { pathToFileURL } from 'node:url';

const root = 'F:/repo-aiscan2/sagrada-familia/';
const threeUrl = pathToFileURL(root + 'vendor/three.module.min.js').href;

export async function resolve(specifier, context, nextResolve) {
  if (specifier === 'three') return { url: threeUrl, shortCircuit: true };
  return nextResolve(specifier, context);
}
