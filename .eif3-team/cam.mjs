/* cam.mjs — scratch inspector: copy the built bundle with a custom orbit camera.
   usage: node cam.mjs <in.html> <out.html> <tx> <ty> <tz> <radius> <phi> <theta> */
import { readFileSync, writeFileSync } from 'node:fs';

const [inFile, outFile, tx, ty, tz, radius, phi, theta] = process.argv.slice(2);
let html = readFileSync(inFile, 'utf8');

const before = `const cameraTarget = new THREE.Vector3(0, 172, 0);`;
const after = `const cameraTarget = new THREE.Vector3(${tx}, ${ty}, ${tz});`;
if (!html.includes(before)) throw new Error('cameraTarget anchor not found');
html = html.replace(before, after);

const camBefore = `radius: ${555}, phi: ${1.44}, theta: ${0.63},\n  tr: ${555}, tphi: ${1.44}, ttheta: ${0.63},`;
const camAfter = `radius: ${radius}, phi: ${phi}, theta: ${theta},\n  tr: ${radius}, tphi: ${phi}, ttheta: ${theta},`;
if (!html.includes(camBefore)) throw new Error('orbit anchor not found');
html = html.replace(camBefore, camAfter);

writeFileSync(outFile, html, 'utf8');
console.log('cam ' + outFile);
