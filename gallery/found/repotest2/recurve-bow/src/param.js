/* ============================================================================
   recurve-bow / src/param.js  --  THE DESIGN TABLE

   Every dimension of the bow lives here and nowhere else. If a number in the
   model disagrees with this file, the model is wrong.

   Units are INCHES and POUNDS throughout -- real archery shop units, so the
   numbers can be checked against a catalogue.

   ============================================================================
   COORDINATE SYSTEM  (right-handed, all builders must obey it)

       +y   up the bow, grip throat at y = 0
       +z   toward the archer   ("belly" side).  -z faces the target ("back")
       +x   out of the bow plane toward the arrow / sight-window side.
            A RIGHT-HANDED bow: the window and the rest are on +x.

   The bow is symmetric about y = 0 in its resting state; positive tiller
   breaks that symmetry on purpose (see TILLER below).

   ============================================================================
   WHAT THIS BOW IS

   A 25" machined ILF takedown target riser with medium ILF limbs -- 68" AMO,
   8.75" brace, 36 lb at 28". It is the one archetype of bow that genuinely
   comes apart: the limbs slide sideways out of dovetail pockets, the string
   lifts off, the grip unbolts, and every accessory screws into a 5/16-24
   bushing. So the exploded view is not a rendering trick, it is the object.
   ========================================================================== */

export const UNIT = { name: 'inch', mm: 25.4, lb: 1, grain: 1 };

/* ---------------------------------------------------------------- riser --- */

/* The riser is a stack of horizontal cross sections. Each control row gives
   the shape of the section at one height:

       y       control height
       hw      lateral HALF width  (x extent, so the bar is 2*hw thick)
       zBack   target-side face    (negative z)
       zBelly  archer-side face    (positive z)

   Rows are interpolated linearly and then smoothed, so the fillets where the
   sight window opens and closes come out of the table spacing rather than
   from a boolean. The window is simply where zBelly retracts toward zBack. */

export const RISER = {
  half: 11.60,                     // body ends here; pocket blocks go on top
  profile: [
    //  y       hw     zBack   zBelly
    [ 11.60,  0.735, -0.775,  0.790],  // upper pocket seat
    [ 10.60,  0.715, -0.750,  0.780],  // pocket foot
    [  9.60,  0.630, -0.700,  0.745],
    [  8.20,  0.560, -0.665,  0.715],
    [  6.95,  0.520, -0.630,  0.690],  // window top fillet begins
    [  6.70,  0.505, -0.613,  0.560],
    [  6.52,  0.495, -0.600,  0.232],
    [  6.38,  0.488, -0.592,  0.030],  // window: belly fully retracted
    [  4.60,  0.472, -0.578,  0.012],
    [  2.80,  0.462, -0.570,  0.008],
    [  2.32,  0.468, -0.574,  0.022],
    [  2.14,  0.482, -0.586,  0.150],
    [  1.98,  0.512, -0.608,  0.452],  // window bottom fillet
    [  1.84,  0.552, -0.638,  0.662],
    [  1.62,  0.600, -0.660,  0.722],  // arrow shelf
    [  1.30,  0.585, -0.672,  0.742],
    [  0.55,  0.538, -0.690,  0.752],  // grip top; narrowest in x
    [ -0.55,  0.522, -0.700,  0.756],  // GRIP THROAT -- brace height datum
    [ -1.90,  0.540, -0.700,  0.754],
    [ -3.40,  0.580, -0.688,  0.744],
    [ -5.60,  0.612, -0.680,  0.738],
    [ -8.00,  0.646, -0.692,  0.750],
    [-10.60,  0.715, -0.750,  0.780],
    [-11.60,  0.735, -0.775,  0.790],
  ],
  sliceStep: 0.030,                // height of one cross section
  smoothPasses: 9,                 // fillet radius control (no overshoot, ever)
  cornerFrac: 0.42,                // corner radius as a fraction of the section
  ringPoints: 44,                  // points around one section

  pocket: {                        // ILF dovetail pocket block, both ends
    y0: 11.60, y1: 12.50,
    x0: -0.735, x1: 0.735,
    zBack: -0.775, zBelly: 0.790,
    /* mortise: a trapezoid that is NARROW at the mouth and WIDE at the floor,
       which is what makes it a dovetail and what stops the limb pulling out. */
    mouthZ: [-0.255, 0.300], mouthY: 12.500,
    floorZ: [-0.340, 0.385], floorY: 12.075,
    slotX: [-0.560, 0.560],        // the mortise is open at both ends in x
    boltY: 12.290, boltZ: 0.020, boltDia: 0.250,
    edgeR: 0.055,
  },

  bushing: {                       // 5/16-24 UNC, the archery standard
    dia: 0.3125, depth: 0.400, seatR: 0.028,
    sight:  [{ y: 3.30, z: -0.500 }, { y: 5.10, z: -0.500 }],
    plunger: { y: 1.98, z: -0.300 },   // "Berger hole", just above the shelf
    stab:    { y: -6.60, z: -0.560 },  // stabiliser / long rod
    clicker: [{ y: 2.10, z: 0.560 }, { y: 5.90, z: 0.560 }],
  },
  shelf: {                         // the arrow shelf lip on the +x window wall
    y: 1.62, x0: 0.470, x1: 0.700, z0: -0.420, z1: 0.735, r: 0.030,
  },
  gripSeatX: 0.505,                // lateral face the wooden grip plates sit on
  throatY: -0.55,                  // the deepest point of the grip: brace datum
};

/* ----------------------------------------------------------------- grip --- */

export const GRIP = {
  y0: -3.30, y1: 1.30,             // wooden side plates, one per side
  zFront: -0.575, zBack: 0.640,
  thick: 0.345,                    // each plate
  screwDia: 0.105, screws: [-2.30, 0.35],
  sideR: 0.115,
};

/* ----------------------------------------------------------------- limb --- */

/* The limb is defined by its CURVATURE, not by control points. That choice is
   the whole trick of this project: bending the limb is then a one-line change
   to kappa(s), arc length is preserved by construction, and the elastic energy
   is the same integral that produced the shape in the first place. There is
   nothing to converge and nothing to debug.

       kappa(s)  curvature at arc length s (s = 0 at the butt)
       theta(s)  = integral of kappa         (tangent angle from +y toward +z)
       pos(s)    = integral of (sin theta, cos theta)

   kappa is NEGATIVE throughout, which puts the centre of curvature on the +z
   side. That is exactly what makes the limb concave toward the archer, and it
   is why the string can lie down inside it.

   The outer stretch is DEAD STRAIGHT. That is the string groove, and it is the
   reason a recurve's string lies along the limb instead of merely touching it
   at the nock. Past it the tip hooks forward, out of the string line.       */

export const LIMB = {
  nStations: 320,
  L: 22.804,                       // arc length butt -> tip; solved by tools/design.mjs
  theta0: 0.7680,                  // tangent angle at the butt, radians (44.0 deg)
  buttY: 12.500, buttZ: 0.022,     // emerges from the pocket mouth
  straightAt: 0.880,               // fraction of arc length where it goes straight
  /* Where the braced curvature lives.  A recurve's bend is NOT concentrated at
     the root -- the inner limb is nearly straight and the working curve is
     outboard, which is what lets the limb leave the pocket going UP instead of
     sideways and then lie down alongside the string.  kappaBase is the fraction
     of the curvature present at the butt; kappaQ shapes the ramp outboard. */
  kappaBase: 0.20, kappaQ: 3.00,
  hookFrom: 0.950, hookTurn: -0.436, hookBlend: 0.030,
  mode2At: 0.860, mode2Width: 0.150,   // where the recurve-unroll mode lives

  width: [[0.00, 1.140], [0.35, 0.980], [0.70, 0.740], [0.90, 0.585], [1.00, 0.520]],
  thick: [[0.00, 0.415], [0.30, 0.360], [0.65, 0.268], [0.88, 0.198], [1.00, 0.175]],
  edgeFrac: 0.40, ringCorner: 6,

  groove: {                        // milled into the belly, holds the string
    from: 0.865, to: 1.000,
    depth: 0.040, width: 0.175,
    fadeIn: 0.045,
  },
  overlay: { from: 0.930, len: 0.070, extra: 0.020 },  // phenolic tip overlay
  wedge: { from: 0.000, len: 0.050, extra: 0.060 },    // butt wedge

  /* dovetail tenon on the butt -- slides sideways into RISER.pocket.mortise */
  dovetail: {
    x0: -0.555, x1: 0.555,
    yTop: 12.620,                 // runs up into the limb body, so they overlap
    yBot: 12.100,
    mouthZ: [-0.250, 0.295], floorZ: [-0.335, 0.380],
    bevel: 0.10,
  },
};

export const TILLER = { braceBendUpper: 0.00070, braceBendLower: -0.00070 };

/* --------------------------------------------------------------- string --- */

export const STRING = {
  strands: 16,
  dia: 0.085,                      // served end loops
  legDia: 0.078,
  centreDia: 0.104,                // centre serving is thicker
  centreLen: 7.00,                 // serving length around the nocking point
  loopDia: 0.210,
  nockAbove: 0.375,                // nocking point above square
  nockDia: 0.115,
  silencer: { dia: 0.480, from: 9.5, to: 12.5 },   // distance below each tip
};

/* ---------------------------------------------------------- accessories --- */

export const SIGHT = {
  blockY: 4.20, blockZ: -0.620, blockThick: 0.300,
  blockW: 0.640, blockH: 1.240, dovetail: 0.190,
  barLen: 4.600, barDia: 0.400, barTaper: 0.30, barDrop: 0.260,
  ringOuter: 1.700, ringInner: 1.420, ringThick: 0.075,
  pinLen: 0.900, pinDia: 0.062,
  knobDia: 0.420, knobThick: 0.300,
  levelLen: 1.100, levelDia: 0.180,
  offset: -2.35,                   // ring sits forward of the window back wall
};

export const STABILISER = {
  longRod: { len: 30.0, dia0: 0.560, dia1: 0.330, weights: 4, wDia: 1.050, wThick: 0.360, damper: 0.640 },
  vbar:    { len: 3.10, dia: 0.560, spread: 42 * Math.PI / 180 },   // included angle
  sideRod: { len: 12.0, dia0: 0.470, dia1: 0.300, weights: 2, wDia: 0.880, wThick: 0.320, damper: 0.560 },
  mountZ: -0.560, mountY: -6.60, quickDisconnect: 0.720,
};

export const REST = {
  y: 1.86, z: 0.520, x: 0.470,
  plate: [0.900, 0.620, 0.085],
  armLen: 0.960, armThick: 0.052, armTip: 0.150,
  magnet: 0.230, armAngle: -14 * Math.PI / 180,
};

export const PLUNGER = {
  y: 1.98, z: -0.300, bodyDia: 0.400, bodyLen: 0.620,
  buttonDia: 0.290, buttonLen: 0.260, lockDia: 0.450, lockThick: 0.135,
  tipZ: 0.760,
};

export const CLICKER = {
  plateY: [2.10, 5.90], plateZ: 0.560, plateW: 0.360, plateThick: 0.100,
  bladeLen: 5.20, bladeW: 0.320, bladeThick: 0.024, bendY: 4.10,
};

export const ARROW = {
  len: 30.0, shaftDia: 0.290, wallDia: 0.238,
  nockLen: 0.620, nockDia: 0.300,
  vaneLen: 2.250, vaneH: 0.420, vaneThick: 0.026, vaneOff: 1.30,
  pointLen: 1.900, pointDia: 0.290, pointTip: 0.130,
  spine: 700, grains: 285,
  restZ: 0.520, restY: 1.86,
};

/* ------------------------------------------------------ targets & tiller --- */

export const TARGET = {
  amo: 68.0,                       // AMO bow length = string length + 3"
  brace: 8.75,                     // grip throat to string
  drawWeight: 36.0,                // pounds at 28" AMO draw
  drawLength: 28.0,
  tillerPositive: 0.125,           // upper limb gap exceeds lower by 1/8"
  /* Force still on the string at brace height, as a fraction of the full-draw
     weight.  A strung bow is already loaded; without this the model reads zero
     pounds at brace and stores barely half the energy a real bow does. */
  braceForceRatio: 0.55,

  massRiser: 2.62, massLimbPair: 1.18, massString: 0.023,
};

/* ------------------------------------------------------------ materials --- */

/* density in lb/in^3 -- used to turn every mesh volume into a real part mass,
   which doubles as the watertightness check in verify.js */

export const MATERIALS = {
  alu:      { density: 0.0975, colour: 0x9BA4B0, metal: 0.90, rough: 0.30 },  // 6061-T6
  aluDark:  { density: 0.0975, colour: 0x4A525C, metal: 0.88, rough: 0.42 },
  carbon:   { density: 0.0570, colour: 0x2A2D33, metal: 0.30, rough: 0.36 },
  glass:    { density: 0.0715, colour: 0x3A3E45, metal: 0.22, rough: 0.33 },  // graphite laminate limb
  wood:     { density: 0.0255, colour: 0x7A4E28, metal: 0.00, rough: 0.58 },  // walnut grip
  phenolic: { density: 0.0490, colour: 0x2A2320, metal: 0.05, rough: 0.55 },  // tip overlays
  steel:    { density: 0.2830, colour: 0xBCC3CB, metal: 0.95, rough: 0.24 },
  brass:    { density: 0.3080, colour: 0xC79A5C, metal: 0.95, rough: 0.28 },
  rubber:   { density: 0.0360, colour: 0x1A1D22, metal: 0.00, rough: 0.92 },
  string:   { density: 0.0490, colour: 0xF2EDE0, metal: 0.00, rough: 0.78 },
  serving:  { density: 0.0490, colour: 0x24272D, metal: 0.00, rough: 0.74 },
  arrow:    { density: 0.0640, colour: 0x1E2126, metal: 0.20, rough: 0.40 },
  vane:     { density: 0.0330, colour: 0xF2A21B, metal: 0.00, rough: 0.68 },
  anodised: { density: 0.0975, colour: 0x2E6398, metal: 0.85, rough: 0.34 },
};
