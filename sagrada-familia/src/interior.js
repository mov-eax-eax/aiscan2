// Sagrada Família — interior builder.
//
// Owns everything inside the outer shell: the walkable floor, the forest of
// branching stone columns, the ribbed hyperboloid vaults and lantern, the
// sanctuary and high altar, the seven apse chapels, the side chapels, the organ
// gallery, pews, window tracery and the light that ties them together.
//
// Everything is procedural and merged by material; repeated elements (organ
// pipes) are instanced. No external assets.

import { THREE, hotspot } from './lib.js';
import { DIM } from './config.js';
import { makeMaterials } from './interior/common.js';
import { buildFloor } from './interior/floor.js';
import { buildColumns } from './interior/columns.js';
import { buildVaults } from './interior/vaults.js';
import { buildApse } from './interior/apse.js';
import { buildSanctuary } from './interior/sanctuary.js';
import { buildChapels } from './interior/chapels.js';
import { buildWindows } from './interior/windows.js';
import { buildFurniture } from './interior/furniture.js';
import { buildLighting } from './interior/lighting.js';

function countTriangles(root) {
  let tris = 0;
  root.traverse((o) => {
    if (!o.isMesh || !o.geometry) return;
    const g = o.geometry;
    const n = g.index ? g.index.count : g.attributes.position ? g.attributes.position.count : 0;
    tris += (n / 3) * (o.isInstancedMesh ? o.count : 1);
  });
  return Math.round(tris);
}

export function buildInterior(ctx) {
  const group = new THREE.Group();
  group.name = 'interior';

  const mats = makeMaterials();
  const out = { colliders: [], hotspots: [], walkables: [] };

  buildFloor(group, mats, out);
  const columns = buildColumns(group, mats, out);
  buildVaults(group, mats, out);
  buildApse(group, mats, out);
  buildSanctuary(group, mats, out);
  buildChapels(group, mats, out);
  buildWindows(group, mats, out);
  buildFurniture(group, mats, out);
  const lights = buildLighting(group, mats, out);

  // ---------------------------------------------------------------------------
  // Hotspots: factual, evocative, 2-4 sentences each.
  // ---------------------------------------------------------------------------
  const hotspots = [
    hotspot(
      'nave-forest',
      'The Forest of Stone',
      'Gaudí designed the interior as a forest: the columns are trunks that split into branches, leaning toward the centre so the load travels like sap. Each branch becomes a rib of the hyperboloid vault above, and the double-twist shafts are dark basalt chosen to look wet and heavy. Stand in the central aisle and the nave reads as an avenue of trees rather than a wall of masonry.',
      [0, 9, 22],
      { kicker: 'Interior · the nave', radius: 26 }
    ),
    hotspot(
      'crossing-lantern',
      'The Crossing and the Lantern',
      'Four columns of red porphyry hold the crossing, nearly four metres thick and banded with white stone and gold. Their branches meet overhead in a coffered stone canopy that closes around a golden lantern ring, its warm glass lighting the crossing from above; the tower of Jesus rises beyond the canopy. Every other dimension in the building is struck from this still centre.',
      [0, 32, 0],
      { kicker: 'Interior · the crossing', radius: 30 }
    ),
    hotspot(
      'high-altar',
      'The High Altar',
      'Beyond the crossing, under the third bay of the nave vault, the high altar stands on octagonal marble steps beneath a gold baldachin carried on four porphyry columns. Its face is trencadís mosaic; on the table sit the tabernacle, six candles and vases of flowers, and a crucifix hangs from the canopy above. The sanctuary lamp burns in front of it, and the processional axis from the Glory door ends exactly here, with the seven apse chapels beyond.',
      [0, 4.5, -36],
      { kicker: 'Interior · sanctuary', radius: 18 }
    ),
    hotspot(
      'apse-chapels',
      'The Seven Apse Chapels',
      'Beyond the high altar the apse curves north beneath a half-dome at forty-five metres, its surface combed with radial ribs. Seven chapels radiate from the curve, each with a marble altar, a mosaic retable, a statue and its own window. The geometry narrows the whole church toward this point of focus, exactly as a Gothic apse does.',
      [0, 9, -51],
      { kicker: 'Interior · apse', radius: 22 }
    ),
    hotspot(
      'side-chapels',
      'The Side Chapels',
      'Fourteen chapels line the nave aisles and the transept arms, each a small aedicule with a marble altar, a gilded retable, a robed figure and racks of votive candles. Iron screens and kneelers keep the devotion local while the aisle keeps moving. Their warm candlelight is the counterpoint to the cool light from the windows.',
      [12.2, 4, 33],
      { kicker: 'Interior · chapels', radius: 13 }
    ),
    hotspot(
      'organ',
      'The Organ Gallery',
      'Above the Glory door a stone gallery carries the organ, its bronze pipes rising like a second plantation of trunks and branches. The case is dark wood against the wall, with choir stalls and a console set behind the balustrade. From here the whole nave reads as a single avenue of light leading to the altar.',
      [0, 15, 40.5],
      { kicker: 'Interior · music', radius: 17 }
    ),
    hotspot(
      'stained-glass',
      'The Colour of the Windows',
      'Every window is dressed from inside with stone tracery, a deep sill and reveals, so daylight arrives through carved stone before it reaches the floor. The glass is deliberately two-sided in colour: cool blues and greens along the east wall, warm reds and golds along the west. Where the light lands, it leaves coloured pools on the pavement.',
      [11.5, 24, 21],
      { kicker: 'Interior · light', radius: 24 }
    ),
  ];

  group.userData.triangles = countTriangles(group);
  group.userData.apseResponds = columns.apseResponds ? columns.apseResponds.length : 0;

  return {
    group,
    colliders: out.colliders,
    hotspots,
    walkables: out.walkables,
    update(dt, t) {
      lights.update(dt, t);
    },
  };
}
