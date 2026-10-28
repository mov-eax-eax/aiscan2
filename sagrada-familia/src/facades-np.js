// Nativity (east) and Passion (west) façades — builder entry point.
//
// Returns { group, colliders, hotspots, walkables: [] } for main.js.
// The two façade groups are self-contained: each is merged into roughly a dozen
// material-batched meshes. No lights, no animation, no network assets.

import { THREE } from './lib.js';
import { buildNativity } from './facades-np/nativity.js';
import { buildPassion } from './facades-np/passion.js';

export function buildFacadesNP(ctx) {
  const group = new THREE.Group();
  group.name = 'facades-np';

  const nativity = buildNativity(ctx);
  const passion = buildPassion(ctx);

  group.add(nativity.group);
  group.add(passion.group);

  return {
    group,
    colliders: [...nativity.colliders, ...passion.colliders],
    hotspots: [...nativity.hotspots, ...passion.hotspots],
    walkables: [],
  };
}
