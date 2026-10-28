// Sagrada Família — towers and roofs builder.
//
// Owns the eighteen towers and the roofscape that ties them to the shell:
//   * 12 apostle bell towers (4 per façade, outer ones ground-standing, inner
//     ones springing from above the façade screen at baseY 45/48)
//   * 4 evangelist towers around the crossing with the angel/lion/ox/eagle
//   * the Virgin Mary tower above the apse roof, crowned by the Star of Bethlehem
//   * the tower of Jesus Christ over the crossing, crowned by the great cross
//   * nave + transept glazed gable roofs, apse half-cone roof, sealing gables,
//     ridge crests, eave parapets with pinnacles, dormers
//
// Returns { group, colliders, hotspots, walkables: [] }. Only the ground-
// standing towers contribute colliders.

import { THREE } from './lib.js';
import { DIM, PALETTE } from './config.js';
import {
  stoneMat,
  goldMat,
  brightGoldMat,
  bronzeMat,
  woodMat,
  bellMat,
  roofMat,
  mosaicMat,
  textTexture,
  hotspot,
  boxCollider,
} from './lib.js';
import { GeoBuilder } from './towers/common.js';
import { buildApostles } from './towers/apostles.js';
import { buildRoofs } from './towers/roofs.js';
import { buildEvangelists } from './towers/evangelists.js';
import { buildJesus } from './towers/jesus.js';
import { buildVirgin } from './towers/virgin.js';

// ---------------------------------------------------------------------------
// Materials
// ---------------------------------------------------------------------------

function textMaterial(text, color = '#e9d3a0') {
  const tex = textTexture(text, {
    font: '600 66px Georgia, "Times New Roman", serif',
    color,
    pad: 26,
    letterSpacing: 6,
  });
  return new THREE.MeshBasicMaterial({
    map: tex,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    toneMapped: false,
  });
}

function makeMaterials() {
  const mats = {};
  const families = {
    nativity: PALETTE.stoneNativity,
    passion: PALETTE.stonePassion,
    glory: PALETTE.stoneGlory,
  };
  // per-tower stone tint (DIM.tint): tiny hue and lightness drift so the
  // family reads as twelve individual buildings, not one extruded shape
  for (const t of DIM.apostleTowers) {
    const c = new THREE.Color(families[t.facade] || PALETTE.stoneNativity);
    c.offsetHSL(t.tint * 0.04 - 0.002, t.tint * 0.18, (t.tint - 0.05) * 1.6);
    mats['ap_' + t.id] = stoneMat(c.getHex(), { repeat: 2.2, bumpScale: 0.3 });
  }
  mats.evangelist = stoneMat(0xcfc2a5, { repeat: 2.2, bumpScale: 0.3 });
  mats.jesus = stoneMat(0xc9bda0, { repeat: 2.2, bumpScale: 0.28 });
  mats.virgin = stoneMat(0xdacdb4, { repeat: 2.2, bumpScale: 0.26 });
  mats.trim = stoneMat(0x8f7d62, { repeat: 3, bumpScale: 0.4 });
  mats.trimLight = stoneMat(0xd2c4a8, { repeat: 3, bumpScale: 0.2 });
  mats.gold = brightGoldMat();
  mats.goldGlow = new THREE.MeshStandardMaterial({
    color: 0xf5d982,
    metalness: 0.92,
    roughness: 0.2,
    emissive: 0x9a6a1e,
    emissiveIntensity: 0.45,
  });
  mats.goldDim = goldMat();
  mats.bronze = bronzeMat();
  mats.bell = bellMat();
  mats.wood = woodMat();
  // clone so we can deepen the green without mutating the shared lib material
  mats.roof = roofMat().clone();
  mats.roof.color.setHex(0x76927f);
  mats.roofDouble = mats.roof.clone();
  mats.roofDouble.side = THREE.DoubleSide;
  mats.roofEdge = stoneMat(0x6e695c, { repeat: 3, bumpScale: 0.3 });
  mats.roofWall = stoneMat(0xc6b493, { repeat: 2.6, bumpScale: 0.3 });
  mats.mosaic = mosaicMat([0x2f5f9e, 0x2b7f9e, 0xd9b25e, 0xe6ddca, 0x1f4f7a, 0x48a88e]);
  mats.mosaicDark = mosaicMat([0x1f4f7a, 0x235c74, 0x2b7f9e, 0xd9b25e]);
  mats.glass = new THREE.MeshStandardMaterial({
    color: 0x1c242e,
    roughness: 0.28,
    metalness: 0.5,
    emissive: 0x0a1218,
    emissiveIntensity: 0.35,
  });
  mats.star = new THREE.MeshStandardMaterial({
    color: 0xf7dd88,
    roughness: 0.16,
    metalness: 0.92,
    emissive: 0xd6a23f,
    emissiveIntensity: 0.85,
  });
  mats.dark = stoneMat(0x4a4237, { texture: false, roughness: 1 });
  mats.textAlleluia = textMaterial('ALLELUIA');
  mats.textSanctus = textMaterial('SANCTUS');
  mats.textMaria = textMaterial('AVE MARIA', '#f3dda8');
  return mats;
}

// ---------------------------------------------------------------------------
// Builder
// ---------------------------------------------------------------------------

export function buildTowers(ctx) {
  const group = new THREE.Group();
  group.name = 'towers';
  const mats = makeMaterials();
  const b = new GeoBuilder();

  buildApostles(b, mats);
  buildEvangelists(b, mats);
  buildJesus(b, mats);
  buildVirgin(b, mats);
  buildRoofs(b, mats);

  const triangles = b.finalize(group, mats, {
    noCast: new Set([
      'glass',
      'baluster',
      'winApostleStone',
      'winApostleGlass',
      'nicheApostleStone',
      'nicheApostleGlass',
      'winEvangelistStone',
      'winEvangelistGlass',
      'winJesusStone',
      'winJesusGlass',
      'winJesusLanternStone',
      'winJesusLanternGlass',
      'winVirginStone',
      'winVirginGlass',
      'nicheVirginStone',
      'nicheVirginGlass',
      'winDormerStone',
      'winDormerGlass',
      'dormerFinial',
      'crest',
      'textAlleluia',
      'textSanctus',
      'textMaria',
    ]),
  });
  group.userData.triangles = triangles;

  // ------------------------------------------------------------- colliders
  // Only the ground-standing outer apostle towers obstruct the player. The
  // inner towers spring from above the façade screen (baseY 45/48) and the
  // Virgin tower starts above the apse roof, so neither gets a ground collider.
  const colliders = [];
  for (const t of DIM.apostleTowers) {
    if (!t.ground) continue;
    colliders.push(boxCollider(t.x, t.z, 4.95, 4.95, { y0: 0, y1: t.top }));
  }

  // -------------------------------------------------------------- hotspots
  const hotspots = [
    hotspot(
      'towers-overview',
      'The Eighteen Towers',
      'Eighteen towers crown the temple. Twelve apostle bell towers ring the building, four to each façade; four evangelist towers carry the angel, lion, ox and eagle around the crossing; the Virgin’s tower holds the twelve-pointed Star of Bethlehem; and the tower of Jesus rises above them all to 172.5 m. Seen from the plaza they read as one mountain range in stone.',
      [0, 118, 70],
      { kicker: 'The skyline', radius: 70 }
    ),
    hotspot(
      'apostles-nativity',
      'Apostles of the Nativity',
      'The four bell towers of the Nativity façade. Each is a tapering square shaft with corner buttresses and narrow ribs, string courses every few metres, paired lancet windows, a shadowed ground niche, and an open belfry holding bronze tubular bells and a spiral stair. Above the belfry: corner pinnacles, a needle spire and the fruit-like stone finial.',
      [26, 60, 0],
      { kicker: 'Bell towers', radius: 32 }
    ),
    hotspot(
      'apostles-passion',
      'Apostles of the Passion',
      'Four bell towers behind Subirachs’ Passion façade. The same family of forms, but the Passion stone is greyer and the shadows across the ribs harder — the towers were designed to read at night as a row of lanterns.',
      [-26, 60, 0],
      { kicker: 'Bell towers', radius: 32 }
    ),
    hotspot(
      'apostles-glory',
      'Apostles of the Glory',
      'Four more bell towers above the main entrance, inclining the whole composition toward the city. Their bells and finials complete the family of twelve.',
      [0, 60, 41],
      { kicker: 'Bell towers', radius: 32 }
    ),
    hotspot(
      'evangelists',
      'The Four Evangelists',
      'Four towers rise from the crossing roof to 135 m. Near the top of each stands its emblem in stone: the angel of Matthew, the lion of Mark, the ox of Luke and the eagle of John — the tetramorph that frames the tower of Jesus.',
      [0, 112, 0],
      { kicker: 'Evangelist towers', radius: 38 }
    ),
    hotspot(
      'virgin-tower',
      'The Virgin’s Tower',
      'Behind the apse the tower of the Virgin Mary climbs from the apse roof in pale stone, banded with blue-and-gold trencadís mosaic and pierced by a niche holding the Virgin. It is crowned by the twelve-pointed Star of Bethlehem, six and a half metres across, gilded and lit from within.',
      [0, 124, -52],
      { kicker: 'Star of Bethlehem', radius: 34 }
    ),
    hotspot(
      'jesus-tower',
      'The Tower of Jesus',
      'Above the crossing, the tallest tower: an octagonal, ribbed shaft rising from a glazed lantern, its faces carved with ALLELUIA and SANCTUS. At 160 m it gathers into an eight-pinnacled crown carrying the great gilded four-armed cross, whose tip reaches 172.5 m — the highest point of the temple.',
      [0, 156, 0],
      { kicker: 'The crown of the temple', radius: 34 }
    ),
    hotspot(
      'roofscape',
      'The Glazed Roofs',
      'Gaudí’s roofs are the dragon-back of the temple: green glazed tiles over the nave and transept, ridge crests, parapets with pinnacle clusters and small dormer windows, all pitched to shed the Barcelona rain and catch the light like a lizard’s scales.',
      [0, 55, 18],
      { kicker: 'Roofscape', radius: 40 }
    ),
  ];

  return { group, colliders, hotspots, walkables: [] };
}
