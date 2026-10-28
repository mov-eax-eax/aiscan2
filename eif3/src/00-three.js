/* 00-three.js — load three.js from a CDN with fallbacks.
   This fragment runs first and its top-level await gates the whole bundle. */
const CDNS = [
  'https://cdn.jsdelivr.net/npm/three@0.160.1/build/three.module.js',
  'https://unpkg.com/three@0.160.1/build/three.module.js',
  'https://esm.sh/three@0.160.1',
];

let THREE = null;
for (const url of CDNS) {
  try { THREE = await import(url); break; }
  catch (err) { console.warn('[eiffel] three.js failed from', url); }
}

const loaderEl = document.getElementById('loader');
const errorEl = document.getElementById('error');
const errorText = document.getElementById('error-text');
function fail(message) {
  loaderEl.classList.add('hide');
  errorEl.hidden = false;
  errorText.textContent = message;
}
if (!THREE) {
  fail('three.js could not be downloaded from any CDN. Check the connection and reload the page.');
  throw new Error('three.js unavailable');
}
