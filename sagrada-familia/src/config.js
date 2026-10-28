// Sagrada Família — shared architecture constants.
// Units are metres. +X = east (Nativity façade), -X = west (Passion façade),
// +Z = south (Glory façade / main entrance), -Z = north (apse). Y is up.
// Origin = centre of the crossing floor.
//
// This file is the single source of truth for every builder. Do not hard-code
// dimensions that exist here.

export const DIM = {
  // ---- vertical levels -----------------------------------------------------
  floorY: 0,
  aisleVaultY: 30,
  naveVaultY: 45,
  transeptVaultY: 45,
  crossingVaultY: 60,
  roofSpringY: 45,
  roofRidgeY: 51.5,
  towerRoofY: 45, // evangelist towers emerge from the roof here

  // ---- plan ----------------------------------------------------------------
  wallT: 1.2, // ordinary wall thickness
  facadeT: 1.6, // façade wall thickness
  naveWallX: 15, // inner face of the nave outer walls
  naveWallOuterX: 16.2,
  centralNaveHalf: 7.5, // column line of the central nave
  naveHalfLength: 45, // crossing centre -> Glory inner face
  transeptHalfLength: 30, // crossing centre -> Nativity/Passion inner face
  transeptHalfWidth: 15, // transept width equals the nave width
  aisleCount: 3, // central nave + two side aisles (modelled), plus chapels

  // ---- apse ----------------------------------------------------------------
  apseCenterZ: -45,
  apseRadius: 15,
  apseWallRadius: 16.2,
  apseOuterRadius: 22.5, // outer face of the seven radial chapels
  apseChapelCount: 7,

  // ---- façades -------------------------------------------------------------
  facadeInner: {
    nativityX: 30,
    passionX: -30,
    gloryZ: 45,
  },
  facadeHalfWidth: 24, // Nativity/Passion wall spans z = -24..24
  gloryHalfWidth: 24, // Glory wall spans x = -24..24

  // Central portal + two side portals on each façade. The three are open on
  // Nativity and Passion; Glory has three open doors and four decorative ones.
  doors: {
    nativity: [
      { id: 'charity', coord: 0, w: 9.0, h: 18.0 },
      { id: 'hope', coord: 12.5, w: 5.5, h: 13.0 },
      { id: 'faith', coord: -12.5, w: 5.5, h: 13.0 },
    ],
    passion: [
      { id: 'passion-main', coord: 0, w: 9.0, h: 19.0 },
      { id: 'passion-north', coord: 12.5, w: 5.5, h: 13.0 },
      { id: 'passion-south', coord: -12.5, w: 5.5, h: 13.0 },
    ],
    glory: [
      { id: 'glory-main', coord: 0, w: 10.0, h: 22.0 },
      { id: 'glory-east', coord: 12.0, w: 6.0, h: 15.0 },
      { id: 'glory-west', coord: -12.0, w: 6.0, h: 15.0 },
      { id: 'glory-e2', coord: 19.0, w: 4.0, h: 11.0, decorative: true },
      { id: 'glory-w2', coord: -19.0, w: 4.0, h: 11.0, decorative: true },
    ],
  },

  // ---- columns -------------------------------------------------------------
  naveColumnZ: [-36, -24, -12, 12, 24, 36],
  transeptColumnX: [-24, -12, 12, 24],
  crossingColumn: 14, // four giant columns at (+/-14, +/-14)
  crossingColumnRadius: 2.15,
  naveColumnRadius: 0.85,
  treeBranchY: 17.5,
  treeColumnTopY: 33,

  // ---- windows -------------------------------------------------------------
  // Large clerestory windows on the nave walls, between the column bays.
  // The nave outer walls are interrupted by the transept between z=-15..15, so
  // windows inside that interval do not exist. ±19.4 clears the transept corner.
  clerestory: {
    y0: 24,
    w: 4.4,
    h: 15,
    coords: [-42, -30, -19.4, 19.4, 30, 42],
  },
  // Lower aisle windows.
  aisleWindows: {
    y0: 9,
    w: 3.2,
    h: 9,
    coords: [-39, -27, -19.4, 19.4, 27, 39],
  },
  // Rose windows (radius, wall positions).
  roseWindows: {
    nativity: { r: 5.2, y: 30 },
    passion: { r: 6.0, y: 30 },
    glory: { r: 8.0, y: 30 },
  },

  // ---- towers --------------------------------------------------------------
  // 12 apostle towers: four per façade, standing BEHIND the façade screen.
  // `baseY` is where the visible shaft starts. The two inner towers of each
  // façade spring from above the portals (45 m, just behind the façade top), so
  // the three open doors stay clear. The outer towers are ground-standing at the
  // outer edges of each façade, framing it; they are behind the wall as seen
  // from the plaza. Ground colliders only for outer towers.
  apostleTowers: [
    { id: 'n1', name: 'St Barnabas', facade: 'nativity', x: 26, z: -21, baseY: 0, top: 101, finial: 109, tint: 0.0, ground: true },
    { id: 'n2', name: 'St Matthew', facade: 'nativity', x: 26, z: -7, baseY: 45, top: 103, finial: 111, tint: 0.06, ground: false },
    { id: 'n3', name: 'St Jude', facade: 'nativity', x: 26, z: 7, baseY: 45, top: 103, finial: 111, tint: 0.1, ground: false },
    { id: 'n4', name: 'St Simon', facade: 'nativity', x: 26, z: 21, baseY: 0, top: 101, finial: 109, tint: 0.04, ground: true },
    { id: 'p1', name: 'St Thomas', facade: 'passion', x: -26, z: -21, baseY: 0, top: 101, finial: 109, tint: 0.0, ground: true },
    { id: 'p2', name: 'St Philip', facade: 'passion', x: -26, z: -7, baseY: 45, top: 103, finial: 111, tint: 0.05, ground: false },
    { id: 'p3', name: 'St James the Less', facade: 'passion', x: -26, z: 7, baseY: 45, top: 103, finial: 111, tint: 0.08, ground: false },
    { id: 'p4', name: 'St James the Great', facade: 'passion', x: -26, z: 21, baseY: 0, top: 101, finial: 109, tint: 0.03, ground: true },
    { id: 'g1', name: 'St Peter', facade: 'glory', x: -21, z: 41, baseY: 0, top: 101, finial: 109, tint: 0.02, ground: true },
    { id: 'g2', name: 'St Andrew', facade: 'glory', x: -7, z: 41, baseY: 48, top: 103, finial: 111, tint: 0.07, ground: false },
    { id: 'g3', name: 'St Paul', facade: 'glory', x: 7, z: 41, baseY: 48, top: 103, finial: 111, tint: 0.11, ground: false },
    { id: 'g4', name: 'St John', facade: 'glory', x: 21, z: 41, baseY: 0, top: 101, finial: 109, tint: 0.05, ground: true },
  ],
  apostleBase: 9,
  apostleBelfryY: 76,
  apostleBelfryTop: 92,

  // Four evangelist towers around the crossing, rising from the roof.
  evangelistTowers: [
    { id: 'ev-matthew', name: 'St Matthew', symbol: 'angel', x: -14, z: -14, top: 135 },
    { id: 'ev-mark', name: 'St Mark', symbol: 'lion', x: 14, z: -14, top: 135 },
    { id: 'ev-luke', name: 'St Luke', symbol: 'ox', x: 14, z: 14, top: 135 },
    { id: 'ev-john', name: 'St John', symbol: 'eagle', x: -14, z: 14, top: 135 },
  ],
  evangelistBase: 9,
  evangelistBaseY: 44,
  evangelistSymbolY: 116,

  // Virgin Mary tower, rising from the apse roof (NOT from the apse floor: the
  // apse interior and half-dome occupy the volume below). The builder starts the
  // visible shaft at baseY and provides a roof/lantern transition; no ground collider.
  virginTower: { x: 0, z: -52, base: 10, baseY: 45, ground: false, top: 126, starY: 137, starR: 6.5 },
  // Jesus Christ tower over the crossing.
  jesusTower: { x: 0, z: 0, base: 16, baseY: 58, top: 160, crossTop: 172.5, crossArm: 8.5 },
  towerFinialBallR: 1.35,

  // ---- roofs ---------------------------------------------------------------
  roofPitch: 0.62, // rise/run of the main gable roof
  roofOverhang: 1.3,

  // ---- plaza / world -------------------------------------------------------
  plazaRadius: 135,
  cityRadius: 330,
  playerClamp: 128,
  eyeHeight: 1.72,
  playerRadius: 0.42,
};

// Named viewpoints. `mode` controls how the camera gets there; `time` is the
// hour of day the tour should set (null = leave the user's clock alone).
export const TOUR = [
  {
    id: 'plaza',
    title: 'Plaça de Gaudí',
    kicker: 'The whole temple',
    body: 'Gaudí imagined a cathedral as a forest: stone trunks, a canopy of leaves, light falling through the branches. From here the eighteen towers read like a mountain range in stone. The model is 1:1 in metres — walk in, or fly up.',
    pos: [88, 22, 96],
    target: [0, 58, 0],
    mode: 'fly',
    time: null,
  },
  {
    id: 'nativity',
    title: 'Nativity Façade',
    kicker: 'The east face · Gaudí’s own work',
    body: 'Built between 1894 and 1930, the only façade Gaudí saw completed. Three portals — Faith, Hope and Charity — are wrapped in the Tree of Life, doves, vines, angels, animals and the Holy Family. Every surface is carved; no line is merely structural.',
    pos: [70, 9, -2],
    target: [30, 30, 0],
    mode: 'fly',
    time: null,
  },
  {
    id: 'nativity-portal',
    title: 'Portal of Charity',
    kicker: 'Nativity Façade · detail',
    body: 'Look for the pelican piercing its breast, the chameleon, the musical angels and the cypress crowned with white doves. The deep archivolts were designed to hold whole populations of carved figures, each one legible from the ground.',
    pos: [41, 4.2, 4],
    target: [30.5, 11, 0],
    mode: 'walk',
    time: null,
  },
  {
    id: 'passion',
    title: 'Passion Façade',
    kicker: 'The west face · Subirachs',
    body: 'Josep Maria Subirachs answered Gaudí’s organic abundance with angular, hollow-eyed figures: the scourging, the crown of thorns, the denial of Peter, Veronica’s veil. The contrast is deliberate — the Passion is meant to feel stripped bare.',
    pos: [-62, 10, 18],
    target: [-30, 30, 0],
    mode: 'fly',
    time: null,
  },
  {
    id: 'glory',
    title: 'Glory Façade',
    kicker: 'The south face · main entrance',
    body: 'The largest of the three façades and the one still being completed. Seven portals lead toward the nave under a sculpted cloud of virtues, angels and the Holy Spirit. This is the door the city enters by.',
    pos: [0, 12, 100],
    target: [0, 39, 45],
    mode: 'fly',
    time: null,
  },
  {
    id: 'nave',
    title: 'The Nave',
    kicker: 'Interior · a forest of stone',
    body: 'The columns lean toward the centre, split into branches, and flower into a lattice of hyperboloid vaults. Gaudí derived the geometry from trees and from ruled surfaces; every arch is a path for light as much as a support.',
    pos: [0, 2.1, 39],
    target: [0, 24, -8],
    mode: 'walk',
    time: null,
  },
  {
    id: 'crossing',
    title: 'The Crossing',
    kicker: 'Under the tower of Jesus',
    body: 'Four columns of red porphyry hold the crossing. Above, the vault opens toward the lantern and the great tower. It is the still centre of the building; the eighteen towers are arranged around this point.',
    pos: [2.5, 2.1, 8],
    target: [0, 30, -5],
    mode: 'walk',
    time: null,
  },
  {
    id: 'altar',
    title: 'The High Altar',
    kicker: 'Apse and sanctuary',
    body: 'Beyond the crossing, the apse curves around the altar. Seven radial chapels line the ambulatory, each with its own window and altar. The geometry narrows the whole building toward this point of focus.',
    pos: [0, 2.7, -26],
    target: [0, 9, -46],
    mode: 'walk',
    time: null,
  },
  {
    id: 'organ',
    title: 'The Organ Gallery',
    kicker: 'Above the Glory door',
    body: 'The organ looks back down the nave, its pipes rising into the gallery like another plantation of stone and metal. Turn around from here and the nave reads as a single avenue of light.',
    pos: [0, 13.5, 36],
    target: [0, 16, 18],
    mode: 'fly',
    time: null,
  },
  {
    id: 'towers',
    title: 'Among the Towers',
    kicker: 'Bell towers and pinnacles',
    body: 'Each apostle tower carries tubular bells and its own fruit-like finial. The four evangelist towers stand around the crossing; the Virgin’s tower carries a twelve-pointed star, and the tower of Jesus rises above them all.',
    pos: [55, 112, 40],
    target: [0, 105, -5],
    mode: 'fly',
    time: 10.5,
  },
  {
    id: 'summit',
    title: 'Above the Crossing',
    kicker: 'The crown of the temple',
    body: 'From here the plan resolves: nave, transept, apse and the three façades, with the tower of Jesus at the centre. The building is a Latin cross, but Gaudí softened the cross into a mountain of pinnacles and light.',
    pos: [74, 196, 82],
    target: [0, 92, 0],
    mode: 'fly',
    time: null,
  },
  {
    id: 'night',
    title: 'Night Illumination',
    kicker: 'Stone, glass and electric light',
    body: 'At night the temple turns inside out: floodlights pick out the ribs and pinnacles while the stained glass glows from within. The effect is closer to Gaudí’s model than daylight — a building lit like a lantern.',
    pos: [72, 18, 78],
    target: [0, 62, 0],
    mode: 'fly',
    time: 21.5,
  },
];

// Colours sampled from photographs of the real materials. Builders may tint
// variants but should start from these.
export const PALETTE = {
  stoneNativity: 0xd2bb95,
  stonePassion: 0xb9b2a6,
  stoneGlory: 0xcbb9a0,
  stoneInterior: 0xd9c9ac,
  stoneAisle: 0xb7a98f,
  stoneDark: 0x857559,
  stoneShadow: 0x5e5142,
  basalt: 0x6d6a64,
  porphyry: 0x793d35,
  porphyryDark: 0x5b2c27,
  bronze: 0x6b583c,
  bellBronze: 0x7d6440,
  gold: 0xd9b25e,
  goldBright: 0xf0d27a,
  roofGreen: 0x4d6a60,
  roofTerracotta: 0x9a6247,
  wood: 0x5e4028,
  iron: 0x3d3a35,
  marble: 0xe6ddca,
  glassCool: [0x2f5fa8, 0x2b7f9e, 0x48a88e, 0x1f4f7a, 0x63b7b1, 0x235c74, 0x8fd0c4],
  glassWarm: [0xb0472e, 0xd0832f, 0x9a2d33, 0xe0a94a, 0x8f3f50, 0xcf6a2c, 0xf0c46a],
  glassRose: [0x8f1e2c, 0xc94b2c, 0x2f5f9e, 0x3e8c7b, 0xe0a13a, 0x6b2d62, 0x2b7f9e],
  flame: 0xffb45a,
  candle: 0xffcf7a,
  cloth: 0xe8ddc4,
};

// Convenience: world positions of important landmarks, for UI, tour and QA.
export const LANDMARKS = {
  nativityDoor: [30, 0, 0],
  passionDoor: [-30, 0, 0],
  gloryDoor: [0, 0, 45],
  crossing: [0, 0, 0],
  altar: [0, 0, -38],
  apse: [0, 0, -58],
  virginStar: [0, DIM.virginTower.starY, DIM.virginTower.z],
  jesusCross: [0, DIM.jesusTower.crossTop, 0],
  plaza: [0, 0, 92],
};
