// Interior lighting: five warm/cool point lights plus an update() that makes
// the candle flames and the altar light breathe. Everything else (candles,
// glass, oculi, lamps) is emissive so it costs nothing per frame.

import { THREE } from '../lib.js';

export function buildLighting(parent, mats, out) {
  const group = new THREE.Group();
  group.name = 'interior-lights';

  const defs = [
    { pos: [0, 5.6, -36], color: 0xffb877, intensity: 340, distance: 44, name: 'altar' },
    { pos: [0, 34, 0], color: 0xffe3b8, intensity: 880, distance: 120, name: 'lantern' },
    { pos: [0, 8.5, -49], color: 0x9fc4e8, intensity: 210, distance: 42, name: 'apse' },
    { pos: [0, 9.5, 24], color: 0xffd7a2, intensity: 240, distance: 52, name: 'nave' },
    { pos: [0, 15.0, 40.5], color: 0xffc88d, intensity: 110, distance: 28, name: 'organ' },
  ];
  const lights = [];
  for (const d of defs) {
    const l = new THREE.PointLight(d.color, d.intensity, d.distance, 2);
    l.position.set(d.pos[0], d.pos[1], d.pos[2]);
    l.name = `interior-light-${d.name}`;
    l.castShadow = false;
    group.add(l);
    lights.push({ light: l, base: d.intensity, phase: lights.length * 1.7 });
  }
  parent.add(group);

  const flame = mats.flame;
  const baseOpacity = flame.opacity;
  let elapsed = 0;

  function update(dt, t) {
    elapsed = typeof t === 'number' ? t : elapsed + dt;
    // shared flame material: cheap three-sine flicker
    const f =
      0.9 +
      0.05 * Math.sin(elapsed * 9.7) +
      0.035 * Math.sin(elapsed * 23.3 + 1.3) +
      0.02 * Math.sin(elapsed * 4.3 + 2.1);
    if (flame) flame.opacity = Math.min(1, Math.max(0.3, baseOpacity * f + 0.05));
    for (const l of lights) {
      const s = 0.92 + 0.05 * Math.sin(elapsed * 6.1 + l.phase) + 0.035 * Math.sin(elapsed * 17.7 + l.phase * 2);
      l.light.intensity = l.base * s;
    }
  }

  return { group, update };
}
