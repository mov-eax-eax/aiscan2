import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
export const ROOT = join(HERE, '..');

/**
 * Concatenation order. The fragments share one module scope, so a fragment may
 * use anything declared by the fragments before it. Keep this list ordered:
 * boot → helpers → env → world builders → controls → app.
 */
export const MODULES = [
  '00-three.js',
  '10-utils.js',
  '20-env.js',
  '30-sky.js',
  '40-terrain.js',
  '50-tower.js',
  '60-city-blocks.js',
  '61-city-landmarks.js',
  '62-city-life.js',
  '70-controls.js',
  '90-app.js',
];

export async function readShell() {
  return readFile(join(ROOT, 'index.html'), 'utf8');
}

/** Concatenate every source fragment into one ES module body. */
export async function bundle() {
  const parts = [];
  for (const name of MODULES) {
    parts.push(await readFile(join(ROOT, 'src', name), 'utf8'));
  }
  return parts.join('\n\n');
}
