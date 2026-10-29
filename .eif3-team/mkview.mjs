// mkview.mjs — temporary verification helper (city-landmarks).
// Copies the built page and replaces the orbit camera constants so each
// landmark can be framed, without touching any src/ file.
import { readFile, writeFile } from 'node:fs/promises';

const SRC = 'build-city-landmarks.html';
const src = await readFile(SRC, 'utf8');

const views = {
  top:         { t: [0, 0, -40],        r: 3200, phi: 0.06, theta: 0.4, fog: true },
  ecole:       { t: [0, 20, 830],       r: 235, phi: 1.24, theta: Math.PI },
  troca:       { t: [0, 12, -640],      r: 340, phi: 1.25, theta: 0 },
  montparnasse:{ t: [980, 110, -260],   r: 620, phi: 1.17, theta: -1.312 },
  defense:     { t: [-1260, 95, -860],  r: 760, phi: 1.18, theta: 0.968 },
  invalides:   { t: [560, 34, 720],     r: 360, phi: 1.14, theta: -2.48 },
  reverse:     { t: [0, 140, 200],      r: 1400, phi: 1.45, theta: Math.PI },
  axis:        { t: [0, 60, -80],       r: 900, phi: 1.08, theta: 2.35 },
};

for (const [name, v] of Object.entries(views)) {
  let out = src;
  const reps = [
    ['radius: 555, phi: 1.44, theta: 0.63,', `radius: ${v.r}, phi: ${v.phi}, theta: ${v.theta},`],
    ['tr: 555, tphi: 1.44, ttheta: 0.63,', `tr: ${v.r}, tphi: ${v.phi}, ttheta: ${v.theta},`],
    ['auto: true, dragging: false,', 'auto: false, dragging: false,'],
    ['const cameraTarget = new THREE.Vector3(0, 172, 0);', `const cameraTarget = new THREE.Vector3(${v.t[0]}, ${v.t[1]}, ${v.t[2]});`],
  ];
  for (const [from, to] of reps) {
    if (!out.includes(from)) throw new Error(`marker missing: ${from}`);
    out = out.replace(from, to);
  }
  if (v.fog) {
    const from = 'scene.fog = new THREE.Fog(0xdfd2be, 900, 3200);';
    if (!out.includes(from)) throw new Error('fog marker missing');
    out = out.replace(from, 'scene.fog = new THREE.Fog(0xdfd2be, 9000, 40000);');
  }
  await writeFile(`view-${name}.html`, out);
  console.log(`view-${name}.html`);
}
