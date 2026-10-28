// Node ESM resolver hook: map the browser import-map specifier "three" to the
// vendored build so offline unit checks can import src modules directly.
export async function resolve(specifier, context, next) {
  if (specifier === 'three') {
    return {
      url: new URL('../../vendor/three.module.min.js', import.meta.url).href,
      shortCircuit: true,
    };
  }
  return next(specifier, context);
}