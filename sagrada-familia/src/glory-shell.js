// Sagrada Família — Glory façade + outer shell.
//
// Owns the public south face of the temple and the complete exterior shell of
// the nave, transept and apse. The interior builder owns every inner surface;
// the towers builder owns everything above the roofline (main roofs, evangelist
// towers, the Virgin lantern and the tower of Jesus).
//
// Coordinate conventions (see src/config.js):
//   +X east (Nativity) · -X west (Passion) · +Z south (Glory) · -Z north (apse)
//   Y up · origin at the crossing floor.
//
// Returns { group, colliders, hotspots, walkables: [] } as expected by main.js.

import {
  THREE,
  addMerged,
  mergeGeos,
  colorize,
  glassMaterial,
  hotspot,
} from './lib.js';
import { createKit, createMaterials } from './glory-shell/kit.js';
import { buildGloryFacade } from './glory-shell/glory-facade.js';
import { buildNaveShell } from './glory-shell/nave.js';
import { buildApseExterior } from './glory-shell/apse.js';

export function buildGloryShell(ctx) {
  const t0 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : 0;
  const kit = createKit();
  const mats = createMaterials();

  buildGloryFacade(kit);
  buildNaveShell(kit);
  buildApseExterior(kit);

  const group = new THREE.Group();
  group.name = 'glory-shell';

  // Merge by material: one draw call per stone/roof/mosaic/material family.
  for (const [key, list] of kit.parts) {
    const mat = mats[key];
    if (!mat || !list.length) continue;
    addMerged(group, list, mat, {
      name: `gs:${key}`,
      castShadow: key !== 'shadow',
      receiveShadow: true,
    });
  }

  // Stained glass: one merged, vertex-coloured mesh per palette region so the
  // shared glassMaterial can be driven by the day/night system. Window kits
  // arrive already colour-baked (per-pane variety); simple panels are colourised
  // here.
  for (const [region, list] of Object.entries(kit.glass)) {
    if (!list.length) continue;
    const geos = [];
    for (const part of list) {
      if (!part || !part.geo) continue;
      if (part.color === null || part.color === undefined) {
        if (part.geo.attributes && part.geo.attributes.color) geos.push(part.geo);
        else geos.push(colorize(part.geo, 0xffffff));
      } else {
        geos.push(colorize(part.geo, part.color));
      }
    }
    const geo = mergeGeos(geos);
    if (!geo) continue;
    const mesh = new THREE.Mesh(geo, glassMaterial);
    mesh.name = `gs:glass:${region}`;
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    group.add(mesh);
  }

  // Carved inscriptions (each has its own canvas texture).
  for (const mesh of kit.textMeshes) group.add(mesh);

  // ------------------------------------------------------- layout assertion
  // The Glory wall family (pierced wall panel, archivolts, coping, attic and
  // gables all share the 'glory' material bucket) must live on the south façade
  // plane. If a piece is ever left in its local frame it would sit near z = 0,
  // slice through the crossing and block the interior — catch that here.
  // Cheap one-shot bounding-box check; costs nothing at run time.
  const gloryWall = group.getObjectByName('gs:glory');
  if (gloryWall && gloryWall.geometry) {
    gloryWall.geometry.computeBoundingBox();
    const bb = gloryWall.geometry.boundingBox;
    if (bb.min.z < 40) {
      console.error(
        `[glory-shell] ASSERT FAILED: Glory wall geometry reaches z=${bb.min.z.toFixed(2)} (expected > 40 — ` +
          'a wall piece is missing its world translation)'
      );
    } else {
      console.log(
        `[glory-shell] Glory wall z-range ${bb.min.z.toFixed(2)}..${bb.max.z.toFixed(2)} (assert min.z > 40 OK)`
      );
    }
  }

  // -------------------------------------------------------------- hotspots
  // Positions sit at walking height near each feature so that a player on foot
  // triggers them; the cards describe what to look up at.
  const hotspots = [
    hotspot(
      'glory-facade',
      'The Glory Façade',
      'Seven portals, a rose window eight metres wide and a gable crowned by the Holy Spirit: the Glory façade is the largest of the three faces and the door the city enters by. Gaudí reserved it for the Last Judgement and the seven virtues, and it is still being carved in stone and glass. Stand back on the plaza to read the whole composition — then walk in through the central doors.',
      [0, 10, 52],
      { kicker: 'The south face · the main entrance', radius: 48 }
    ),
    hotspot(
      'glory-portal',
      'The Central Portal',
      'The main doorway is split into three leaves by two carved trumeaux, and above the lintel the tympanum carries the saints, angels and the dove. The stepped archivolts project almost two metres from the wall, so the porch is a deep room of stone before you even reach the door. The rose window above is set into a real opening cut through the wall.',
      [0, 6, 50],
      { kicker: 'Glory façade · the door of the city', radius: 21 }
    ),
    hotspot(
      'glory-virtues',
      'The Seven Virtues',
      'Faith, Hope and Charity — the theological virtues — flank the portals, while Prudence, Justice, Fortitude and Temperance stand above the outer doors. Each figure has its own canopied niche, pedestal and halo, and Charity crowns the attic over the rose. Gaudí’s workshop modelled them full-size in plaster before a chisel touched stone.',
      [-13, 9, 49],
      { kicker: 'Glory façade · look up at the niches', radius: 19 }
    ),
    hotspot(
      'glory-dove',
      'The Holy Spirit',
      'At the apex of the great gable a gilded dove descends, wings spread, over a bank of stone clouds and two trumpeting angels. The gable is the highest point of the façade on purpose: from the plaza the eye travels from the doors up through the rose to the dove. Late in the day the gold holds the last of the sun.',
      [0, 11, 49],
      { kicker: 'Above the rose window · look up', radius: 21 }
    ),
    hotspot(
      'glory-threshold',
      'The Doors Stand Open',
      'The three central doors are open at ground level and flush with the plaza — no step, only a band of mosaic underfoot. Walk straight through: the nave begins immediately beyond the threshold. Look back once you are inside; the rose window glows behind the organ gallery.',
      [0, 2, 51],
      { kicker: 'Threshold · walk in', radius: 14 }
    ),
    hotspot(
      'glass-cool',
      'Cool Glass · the East Side',
      'The east windows are filled with cool glass — deep blues, teals and sea-greens, the colours of morning and of the Nativity. Seen from outside, the leadwork and the deep stone recesses keep them dark and rich; from inside the aisle they become a screen of coloured light. The panes are vertex-coloured and brighten when the temple is lit at night.',
      [16.6, 8, 30],
      { kicker: 'Nave · Nativity side', radius: 16 }
    ),
    hotspot(
      'glass-warm',
      'Warm Glass · the West Side',
      'The west windows burn with amber, red and gold — the palette of the Passion and of the setting sun. Every lancet sits in a splayed stone surround, so the wall keeps its depth even where the glazing is largest. Walk the outside of the nave to compare the two sides of the temple.',
      [-16.6, 8, -30],
      { kicker: 'Nave · Passion side', radius: 16 }
    ),
    hotspot(
      'nave-shell',
      'The Sculpted Shell',
      'The outer aisle wall is not a flat box: buttress-chapels every bay carry steep tiled roofs and pinnacles, blind arcades run at head height, and saints stand in niches between the lower windows. These masses make the temple read as carved geology from the plaza rather than a building with windows cut in it. The aisle roofs sit around thirty metres up, under the high windows.',
      [-19.8, 7, 30],
      { kicker: 'Nave · outer aisle wall', radius: 15 }
    ),
    hotspot(
      'transept-glazing',
      'The Transept Windows',
      'The transept shoulders carry the tallest lancets outside the façade, each with a stone surround, a rose oculus above and stepped buttresses between the bays. Cool glass faces east, warm glass west, so the cross-arm of the temple reads as two different times of day. The buttress pinnacles stand on the wall head where the transept roof begins.',
      [22.5, 9, 20],
      { kicker: 'Transept · south shoulder', radius: 17 }
    ),
    hotspot(
      'apse-chapels',
      'The Apse Chapels',
      'Seven radial chapels wrap the north end like a crown, each with its own window, stepped roof and gilded finial, separated by buttress fins that rise into pinnacles. Behind them the semicircular wall closes the nave stone-tight, and high blind lancets light the clerestory band above the chapel roofs. Above this base the tower of the Virgin rises from the roof.',
      [0, 9, -68],
      { kicker: 'Apse · the north end', radius: 27 }
    ),
  ];

  // -------------------------------------------------------------- diagnostics
  let triangles = 0;
  let meshes = 0;
  group.traverse((o) => {
    if (o.isMesh && o.geometry) {
      meshes++;
      const g = o.geometry;
      triangles += (g.index ? g.index.count : g.attributes.position ? g.attributes.position.count : 0) / 3;
    }
  });
  const ms = t0
    ? (performance.now() - t0).toFixed(0)
    : '?';
  console.log(
    `[glory-shell] built ${Math.round(triangles).toLocaleString()} triangles in ${meshes} meshes, ` +
      `${kit.colliders.length} colliders, ${hotspots.length} hotspots (${ms} ms)`
  );

  return {
    group,
    colliders: kit.colliders,
    hotspots,
    walkables: [],
  };
}
