// Node module-resolution hook: map the browser import-map bare specifier
// "three" onto the vendored module so the builder code can be audited offline
// (geometry maths runs fine in Node; only the renderer needs a GPU).
// Usage: node --import ./qa/glory-shell/audit.mjs
import { pathToFileURL } from 'node:url';

const VENDOR = new URL('../../vendor/three.module.min.js', import.meta.url).href;
void pathToFileURL;

export async function resolve(specifier, context, nextResolve) {
  if (specifier === 'three') {
    return { url: VENDOR, shortCircuit: true };
  }
  return nextResolve(specifier, context);
}
