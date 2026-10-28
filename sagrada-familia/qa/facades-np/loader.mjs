// Node ESM resolve hook: map the bare specifier "three" to the vendored build.
// Used only by qa/facades-np/simulate.mjs so the façade builders can be executed
// headlessly (no browser, no GPU) for runtime/geometry validation.
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const threeURL = pathToFileURL(path.join(here, '../../vendor/three.module.min.js')).href;

export async function resolve(specifier, context, next) {
  if (specifier === 'three') return { url: threeURL, shortCircuit: true };
  return next(specifier, context);
}
