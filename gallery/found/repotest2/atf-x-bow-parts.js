/* ============================================================================
 *  FIVICS ATF-X  ·  PARTS CATALOG
 *  全零件建模：弓把 / 弓片 / 弓弦 / 箭台 / 箭侧垫 / 瞄准器 / 平衡杆 / 箭 / 工具
 *  Coordinate system:  x = left(-)/right(+)   y = up(+)   z = toward archer(+)
 *  1 unit = 1 mm.  Bow is modelled braced: 66" AMO, brace height 220 mm.
 * ==========================================================================*/
(function () {
'use strict';

/* ------------------------------------------------------------------ PALETTE */
var C = {
  riser: [0.115, 0.125, 0.145],
  riserEdge: [0.055, 0.06, 0.07],
  anodBlack: [0.07, 0.075, 0.085],
  anodGray: [0.34, 0.36, 0.40],
  anodSilver: [0.72, 0.74, 0.78],
  steel: [0.66, 0.68, 0.72],
  darkSteel: [0.30, 0.31, 0.34],
  brass: [0.72, 0.58, 0.26],
  carbon: [0.085, 0.09, 0.10],
  carbonClear: [0.13, 0.135, 0.15],
  limbWood: [0.34, 0.20, 0.11],
  limbCore: [0.46, 0.31, 0.17],
  grip: [0.16, 0.165, 0.18],
  woodGrip: [0.30, 0.16, 0.07],
  stringMat: [0.82, 0.74, 0.52],
  serving: [0.10, 0.10, 0.12],
  nock: [0.92, 0.30, 0.14],
  vane: [0.95, 0.36, 0.12],
  vane2: [0.98, 0.80, 0.22],
  shaft: [0.13, 0.14, 0.17],
  point: [0.60, 0.61, 0.64],
  glow: [0.35, 1.0, 0.55],
  tape: [0.85, 0.24, 0.30],
  rubber: [0.14, 0.15, 0.17]
};

/* --------------------------------------------------------- KEY DIMENSIONS */
var BOW = {
  amo: 1676.4,          /* 66 inch */
  riser: 635,           /* 25 inch nominal */
  pocketY: 254,         /* ILF limb pocket centre  */
  tipY: 830,            /* string nock height -> 1 660 mm nock-to-nock  */
  tipZ: 72,             /* string plane at the nocks -> brace height    */
  gripZ: -190,          /* deepest point of the grip (belly side) */
  brace: 210,           /* gripZ (-190) -> string plane (+20) */
  stringZ: 20,          /* string plane at the arrow */
  drawLen: 711.2,       /* 28 inch AMO draw length */
  limbLen: 500,         /* arc length of one limb */
  nockY: 0              /* arrow nock height = string centre */
};
window.BOW = BOW;

var texMode = { none: -1, carbon: 0, ano: 1, wood: 2, rubber: 3, string: 4 };

/* limb neutral-axis curve : t=0 at the pocket dovetail, t=1 at the tip.
   Pocket at +254 mm, tip at +838 mm -> 584 mm rise; the limb sweeps back,
   flattens, then hooks forward at the tip so the string stands 221 mm off
   the grip throat.  Arc length ~= 500 mm = 19.7" per limb (66" AMO bow). */
/* limb neutral-axis curve : t=0 at the pocket dovetail, t=1 at the tip.
   Grip throat sits at z = -190; the string plane is z = +20, so the brace
   height is 210 mm.  The limb sweeps forward from the pocket (z = -26) to a
   plateau at z = +6, then hooks forward to z = +50 where the string nocks.
   Arc length ~= 500 mm = 19.7" per limb (66" AMO bow). */
var LIMB = [
  { t: 0.00, y: 254.0, z: -26 },
  { t: 0.06, y: 285.0, z: -16 },
  { t: 0.14, y: 330.0, z: -4 },
  { t: 0.24, y: 383.0, z: 6 },
  { t: 0.36, y: 442.0, z: 12 },
  { t: 0.49, y: 507.0, z: 16 },
  { t: 0.62, y: 573.0, z: 20 },
  { t: 0.72, y: 625.0, z: 26 },
  { t: 0.80, y: 666.0, z: 34 },
  { t: 0.88, y: 707.0, z: 38 },
  { t: 0.95, y: 752.0, z: 41 },
  { t: 1.00, y: 830.0, z: 46 }
];
window.LIMB = LIMB;

function limbParam(u, s) {
  var P = LIMB.slice();
  if (s < 0) for (var i = 0; i < P.length; i++) P[i] = { t: P[i].t, y: -P[i].y, z: P[i].z };
  var uu = clamp(u, 0, 1);
  var i0 = 0;
  for (var k = 0; k < P.length - 1; k++) if (uu >= P[k].t && uu <= P[k + 1].t) { i0 = k; break; }
  var f = (uu - P[i0].t) / Math.max(1e-6, P[i0 + 1].t - P[i0].t);
  return V3(0, lerp(P[i0].y, P[i0 + 1].y, f), lerp(P[i0].z, P[i0 + 1].z, f));
}
window.limbParam = limbParam;

/* tapered width / thickness of the limb along its length (mm, half values) */
function limbHW(u) { return lerp(0.94, 0.28, Math.pow(u, 0.86)); }   /* half width  */
function limbHH(u) { return lerp(0.50, 0.180, Math.pow(u, 0.95)); } /* half thick  */

/* ==========================================================================
 *  1 · RISER  —  25" forged / CNC aluminium, 3D relief, adjustable ILF pockets
 * ========================================================================*/
var riserGroup = addGroup('riser', 'RISER ASSEMBLY', '弓把总成', '#3fd2c7');
var limbGroupU = addGroup('limbU', 'UPPER LIMB', '上弓片总成', '#5aa9ff');
var limbGroupL = addGroup('limbL', 'LOWER LIMB', '下弓片总成', '#5aa9ff');
var sightGroup = addGroup('sight', 'SIGHT', '瞄准器总成', '#a78bfa');
var restGroup = addGroup('rest', 'REST / PLUNGER / CLICKER', '箭台 · 侧垫 · 响片', '#6ee787');
var stabGroup = addGroup('stab', 'STABILISER SYSTEM', '平衡杆系统', '#ffb020');
var stringGroup = addGroup('string', 'STRING & NOCKING', '弓弦与搭箭点', '#ffd166');
var arrowGroup = addGroup('arrow', 'ARROW', '箭', '#ff5f6d');
var toolGroup = addGroup('tools', 'TOOLS & ACCESSORIES', '工具与附件', '#8fa0b8');

/* ---------------------------------------------------------------- riser body */
function buildRiserBody() {
  /*  [ y , halfWidth(x) , halfDepth(z) , cornerR , spineZ ]  bottom -> top   */
  var keys = [
    [254, 20.0, 14.0, 5.0, 3.5],
    [230, 20.0, 14.6, 5.0, 6.0],
    [200, 21.5, 15.4, 5.5, 8.5],
    [168, 23.0, 16.2, 6.0, 10.5],
    [132, 24.5, 17.4, 6.5, 12.0],
    [94, 25.5, 18.4, 6.5, 13.0],
    [52, 26.0, 18.8, 6.5, 12.6],
    [20, 26.5, 18.2, 6.0, 11.0],
    [-8, 26.5, 17.0, 6.0, 8.5],
    [-44, 26.0, 15.8, 5.5, 4.0],
    [-84, 25.0, 14.6, 5.0, -1.0],
    [-124, 24.0, 13.6, 5.0, -5.5],
    [-170, 22.0, 12.8, 4.5, -9.5],
    [-224, 20.5, 12.6, 4.5, -8.0],
    [-254, 20.0, 12.6, 4.5, -5.0]
  ];
  var rows = stationList(keys, 36);
  var st = [];
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    var w = r[1], d = r[2];
    /* sight window: relieve the left (-x) wall through the window band */
    var y = r[0];
    var win = 0;
    if (y > -34 && y < 186) {
      var f = smooth(clamp((186 - y) / 44, 0, 1)) * smooth(clamp((y + 34) / 40, 0, 1));
      win = 13.5 * f;
    }
    st.push({
      p: V3(0, y, r[4]),
      hw: w - win * .5,
      hh: d,
      r: Math.min(r[3], (w - win) * .45, d * .8),
      aoff: -win * .5
    });
  }
  var o = addObj({
    id: 'riser.body', g: loft({ axis: 'y', st: st, seg: 5, name: 'riser.body' }),
    color: C.riser, rough: .52, metal: .45, tex: 'ano', texMode: texMode.ano, uv: .055
  });
  o.g.ctr.y = 0;
  return mark(o, 'riser.body');
}

/* --------------------------------------------------------- sight window faces */
function buildWindowFaces() {
  var y0 = -34, y1 = 190, xw = -25.4;
  var st = [];
  for (var i = 0; i <= 12; i++) {
    var t = i / 12, y = lerp(y0, y1, t);
    /* the cavity floor follows the riser's spine so it stays inside the body */
    var spine = lerp(-8.0, 12.4, t) - 3;
    st.push({ p: V3(0, y, spine), hw: 0.8, hh: lerp(14.0, 11.0, t), r: 0.6, aoff: xw });
  }
  var o = addObj({
    id: 'riser.windowface', g: loft({ axis: 'y', st: st, seg: 2, name: 'riser.windowface' }),
    color: [0.075, 0.08, 0.095], rough: .6, metal: .45
  });
  return mark(o, 'riser.windowface');
}

/* ------------------------------------------------------- dovetail / pocket   */
function buildPockets() {
  var out = [];
  [1, -1].forEach(function (s) {
    var pocketCenter = V3(0, BOW.pocketY * s, 3.5);
    /* pocket cheeks (left + right) with a dovetail slot between them */
    [-1, 1].forEach(function (side) {
      var st = [];
      for (var i = 0; i <= 6; i++) {
        var t = i / 6;
        st.push({
          p: V3(side * 23.0, lerp(pocketCenter.y - 22 * s, pocketCenter.y + 26 * s, t), 4.0 + t * 5.0 * s),
          hw: 3.6, hh: lerp(19.0, 14.0, t), r: 2.4
        });
      }
      var o = addObj({
        id: 'pocket.cheek.' + (s > 0 ? 'U' : 'L') + (side > 0 ? 'R' : 'L'),
        g: loft({ axis: 'y', st: st, seg: 3, name: 'pocket' }),
        color: C.anodBlack, rough: .38, metal: .8, pos: V3(), tex: 'ano', texMode: texMode.ano, uv: .12
      });
      groupAdd(riserGroup, mark(o, 'pocket'));
      out.push(o);
    });
    /* pocket floor + ILF stop plate */
    var floor = addObj({
      id: 'pocket.floor.' + (s > 0 ? 'U' : 'L'),
      g: boxGeo(46, 7, 37, 2.4),
      pos: V3(0, pocketCenter.y + 21 * s, -1.0),
      color: C.anodBlack, rough: .34, metal: .85, tex: 'ano', texMode: texMode.ano, uv: .1
    });
    groupAdd(riserGroup, mark(floor, 'pocket'));
    /* dovetail insert block (the ILF slot itself) */
    var dv = addObj({
      id: 'pocket.dovetail.' + (s > 0 ? 'U' : 'L'),
      g: boxGeo(21.5, 26, 12, 1.6),
      pos: V3(0, pocketCenter.y + 6 * s, 7.0),
      color: [0.05, 0.055, 0.065], rough: .3, metal: .9
    });
    groupAdd(riserGroup, mark(dv, 'pocket'));
    /* limb bolt (through-bolt with hex socket) */
    var bolt = addObj({
      id: 'pocket.bolt.' + (s > 0 ? 'U' : 'L'),
      g: lathe({ axis: 'x', seg: 18, closed: true, prof: [
        [4.6, -26], [4.6, -14], [5.4, -13], [5.4, -6], [3.2, -5.6], [3.2, -1], [0, -1]
      ] }),
      pos: V3(0, pocketCenter.y + 6 * s, 8.2),
      color: C.steel, rough: .22, metal: 1.0
    });
    groupAdd(riserGroup, mark(bolt, 'pocket'));
    /* limb alignment screw (front of the pocket, sets lateral limb angle) */
    [-1, 1].forEach(function (side) {
      var al = addObj({
        id: 'pocket.align.' + (s > 0 ? 'U' : 'L') + (side > 0 ? 'R' : 'L'),
        g: lathe({ axis: 'z', seg: 14, closed: true, prof: [
          [2.4, 8], [2.4, 13], [2.0, 13.4], [2.0, 17.4], [0, 17.4]
        ] }),
        pos: V3(side * 17.5, pocketCenter.y + 2 * s, 12.0),
        color: C.anodSilver, rough: .25, metal: 1.0
      });
      groupAdd(riserGroup, mark(al, 'pocket'));
    });
    /* tiller / lock screw on the side of the pocket */
    var tl = addObj({
      id: 'pocket.tiller.' + (s > 0 ? 'U' : 'L'),
      g: lathe({ axis: 'y', seg: 14, closed: true, prof: [
        [3.0, 16], [3.0, 26], [2.4, 26.6], [2.4, 30], [0, 30]
      ] }),
      pos: V3(0, pocketCenter.y - 14 * s, 6.0),
      color: C.anodSilver, rough: .28, metal: 1.0
    });
    groupAdd(riserGroup, mark(tl, 'pocket'));
    /* limb pocket shim / alignment plate (a-l-a-m-b-r-i-c detail) */
    var shim = addObj({
      id: 'pocket.shim.' + (s > 0 ? 'U' : 'L'),
      g: boxGeo(20.6, 18, 1.2, 0.5),
      pos: V3(0, pocketCenter.y + 9 * s, 15.6),
      color: [0.55, 0.45, 0.18], rough: .45, metal: .6
    });
    groupAdd(riserGroup, mark(shim, 'pocket'));
  });
  return out;
}

/* ----------------------------------------------------------- bushings & holes */
function buildBushings() {
  /*  front stabiliser bushing (5/16-24) on the belly, below the grip */
  var b1 = addObj({
    id: 'riser.bushing.stab', g: lathe({ axis: 'z', seg: 24, closed: true, prof: [
      [7.6, 0], [7.6, 7], [6.4, 8], [6.4, 14.5], [4.2, 15], [4.2, 18.5], [0, 18.5]
    ] }),
    pos: V3(0, -142, 17), color: C.anodSilver, rough: .3, metal: 1.0
  });
  groupAdd(riserGroup, mark(b1, 'riser.bushing'));
  /*  side (V-bar) bushings on both flanks of the lower riser */
  [-1, 1].forEach(function (side) {
    var b = addObj({
      id: 'riser.bushing.vbar.' + (side > 0 ? 'R' : 'L'),
      g: lathe({ axis: 'x', seg: 20, closed: true, prof: [
        [6.8, 0], [6.8, 7], [5.6, 8], [5.6, 12], [0, 12]
      ] }),
      pos: V3(side * 21.5, -118, 6), color: C.anodSilver, rough: .3, metal: 1.0
    });
    groupAdd(riserGroup, mark(b, 'riser.bushing'));
  });
  /*  plunger bushing in the window floor */
  var b2 = addObj({
    id: 'riser.bushing.plunger', g: lathe({ axis: 'x', seg: 22, closed: true, prof: [
      [7.2, 0], [7.2, 6.5], [6.0, 7], [6.0, 12.5], [0, 12.5]
    ] }),
    pos: V3(-25.8, -6, -3), color: C.anodBlack, rough: .32, metal: .9
  });
  groupAdd(riserGroup, mark(b2, 'riser.bushing'));
  /*  arrow rest bushing + shelf plate */
  var b3 = addObj({
    id: 'riser.bushing.rest', g: lathe({ axis: 'x', seg: 22, closed: true, prof: [
      [6.4, 0], [6.4, 5.5], [5.2, 6], [5.2, 11], [3.0, 11.5], [3.0, 14.5], [0, 14.5]
    ] }),
    pos: V3(-25.8, 13, -3), color: C.anodBlack, rough: .32, metal: .9
  });
  groupAdd(riserGroup, mark(b3, 'riser.bushing'));
  /*  clicker plate mount (above the window, out of the sight's way) */
  var b4 = addObj({
    id: 'riser.bushing.clicker', g: lathe({ axis: 'x', seg: 18, closed: true, prof: [
      [5.4, 0], [5.4, 5.0], [4.2, 5.4], [4.2, 10.0], [0, 10.0]
    ] }),
    pos: V3(-25.8, 176, -6), color: C.anodBlack, rough: .32, metal: .9
  });
  groupAdd(riserGroup, mark(b4, 'riser.bushing'));
  /*  sight bushing pair (upper + lower of the window band) */
  [158, 96].forEach(function (yy, idx) {
    var b = addObj({
      id: 'riser.bushing.sight.' + (idx === 0 ? 'A' : 'B'),
      g: lathe({ axis: 'x', seg: 18, closed: true, prof: [
        [5.6, 0], [5.6, 5.0], [4.4, 5.4], [4.4, 11.0], [0, 11.0]
      ] }),
      pos: V3(-25.8, yy, -3.5), color: C.anodBlack, rough: .32, metal: .9
    });
    groupAdd(riserGroup, mark(b, 'riser.bushing'));
  });
  /*  rest shelf lip on the belly side of the window */
  var lip = addObj({
    id: 'riser.shelf', g: boxGeo(13, 3.2, 20, 0.9),
    pos: V3(-18.5, 2.4, -8), color: C.riserEdge, rough: .45, metal: .5
  });
  groupAdd(riserGroup, mark(lip, 'riser.shelf'));
}

/* ---------------------------------------------------------------- riser ridge */
function buildRiserDetails() {
  /*  the ATF-X's signature machined spine running down the back of the riser */
  var st = [];
  for (var i = 0; i <= 26; i++) {
    var t = i / 26, y = lerp(-250, 250, t);
    var w = 4.6 + 2.4 * Math.sin(t * Math.PI);
    st.push({ p: V3(0, y, 21.0 + 2.4 * Math.sin(t * Math.PI)), hw: w, hh: 2.6, r: 1.6 });
  }
  var o = addObj({
    id: 'riser.spine', g: loft({ axis: 'y', st: st, seg: 3, name: 'riser.spine' }),
    color: C.riserEdge, rough: .4, metal: .6, tex: 'ano', texMode: texMode.ano, uv: .1
  });
  groupAdd(riserGroup, mark(o, 'riser.spine'));
  /* weighted cap at the bottom of the riser (a.k.a. the "butt" plug) */
  var cap = addObj({
    id: 'riser.cap', g: lathe({ axis: 'y', seg: 26, closed: true, prof: [
      [0, -272], [14.5, -272], [15.5, -269], [15.5, -262], [13.0, -260.5], [13.0, -256], [0, -256]
    ] }),
    pos: V3(0, 0, -5), color: C.anodBlack, rough: .35, metal: .9, tex: 'ano', texMode: texMode.ano, uv: .1
  });
  groupAdd(riserGroup, mark(cap, 'riser.cap'));
  /* badge / engraving plate on the belly */
  var badge = addObj({
    id: 'riser.badge', g: boxGeo(22, 34, 1.0, 0.8),
    pos: V3(0, 96, -19.4), rot: [0, 0, 0],
    color: [0.55, 0.60, 0.66], rough: .35, metal: .9
  });
  groupAdd(riserGroup, mark(badge, 'riser.badge'));
  /*  two tungsten dampers in the riser's upper limb-pocket web */
  [1, -1].forEach(function (s) {
    var d = addObj({
      id: 'riser.damper.' + (s > 0 ? 'U' : 'L'),
      g: lathe({ axis: 'x', seg: 20, closed: true, prof: [
        [6.2, 0], [6.2, 5.5], [7.4, 6.1], [7.4, 11.9], [6.2, 12.5], [6.2, 18.0], [0, 18.0]
      ] }),
      pos: V3(-25.2, 216 * s, -4), color: [0.18, 0.19, 0.22], rough: .72, metal: .2,
      tex: 'rubber', texMode: texMode.rubber, uv: .3
    });
    groupAdd(riserGroup, mark(d, 'riser.damper'));
  });
}

/* ---------------------------------------------------------------------- grip */
function buildGrip() {
  /*  a moulded low-wrist grip: lofted with a palm swell and a thumb shelf */
  var keys = [
    /* y , halfW , halfD , spineZ */
    [12, 14.0, 25.0, -6],
    [-16, 14.8, 26.5, -6],
    [-48, 15.2, 27.5, -7],
    [-84, 15.4, 27.0, -7],
    [-122, 15.0, 25.5, -6],
    [-160, 14.2, 23.5, -5],
    [-196, 13.0, 21.0, -3],
    [-224, 11.6, 19.0, 0]
  ];
  var rows = stationList(keys, 22), st = [];
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    var t = i / (rows.length - 1);
    st.push({
      p: V3(0, r[0], -12.0 - r[2] * 0.16),
      hw: r[1] * (1 + 0.05 * Math.sin(t * Math.PI)),
      hh: r[2],
      r: Math.min(r[1], r[2]) * .62
    });
  }
  var o = addObj({
    id: 'grip.main', g: loft({ axis: 'y', st: st, seg: 5, name: 'grip.main' }),
    color: C.grip, rough: .78, metal: .05, tex: 'rubber', texMode: texMode.rubber, uv: .09
  });
  groupAdd(riserGroup, mark(o, 'grip.main'));
  /*  thumb / index shelf on the left side of the grip  */
  var sh = [];
  for (var k = 0; k <= 10; k++) {
    var u = k / 10;
    sh.push({ p: V3(0, lerp(-30, -108, u), -28 - 4 * Math.sin(u * Math.PI)), hw: lerp(3.0, 5.2, u), hh: lerp(2.6, 4.4, u), r: 1.6, aoff: lerp(-15, -19, u) });
  }
  var o2 = addObj({
    id: 'grip.shelf', g: loft({ axis: 'y', st: sh, seg: 3, name: 'grip.shelf' }),
    color: C.grip, rough: .8, metal: .04, tex: 'rubber', texMode: texMode.rubber, uv: .12
  });
  groupAdd(riserGroup, mark(o2, 'grip.shelf'));
  /*  grip cap screw at the bottom */
  var cap = addObj({
    id: 'grip.cap', g: lathe({ axis: 'y', seg: 18, closed: true, prof: [
      [4.4, -232], [4.4, -226], [5.6, -225], [5.6, -219], [0, -219]
    ] }),
    pos: V3(0, 0, -14), color: C.steel, rough: .3, metal: 1.0
  });
  groupAdd(riserGroup, mark(cap, 'grip.cap'));
}

/* ==========================================================================
 *  2 · LIMBS  —  ILF dovetail, carbon/wood core, recurve, tip overlay
 * ========================================================================*/
function buildLimb(side) {
  var where = side > 0 ? 'U' : 'L';
  var grp = side > 0 ? limbGroupU : limbGroupL;
  var N = 30, i, t, p;

  /* --- main limb lamination stack --------------------------------------- */
  var st = [];
  for (i = 0; i <= N; i++) {
    t = i / N;
    p = limbParam(t, side);
    st.push({ p: p, hw: limbHW(t), hh: limbHH(t), r: Math.min(limbHW(t), limbHH(t)) * .55 });
  }
  var body = addObj({
    id: 'limb.' + where + '.body',
    g: loft({ axis: 'y', st: st, seg: 4, name: 'limb.' + where + '.body' }),
    color: C.carbon, rough: .30, metal: .18, tex: 'carbon', texMode: texMode.carbon, uv: .30
  });
  groupAdd(grp, mark(body, 'limb.body'));

  /* --- clear-coated carbon back layer (visible weave) -------------------- */
  var st2 = [];
  for (i = 0; i <= 16; i++) {
    t = 0.04 + (i / 16) * 0.94;
    p = limbParam(t, side);
    st2.push({ p: V3(0, p.y, p.z - limbHH(t) * 0.92), hw: limbHW(t) * .985, hh: 0.22, r: 0.12 });
  }
  var back = addObj({
    id: 'limb.' + where + '.back',
    g: loft({ axis: 'y', st: st2, seg: 4, name: 'limb.' + where + '.back' }),
    color: C.carbonClear, rough: .16, metal: .28, tex: 'carbon', texMode: texMode.carbon, uv: .62
  });
  groupAdd(grp, mark(back, 'limb.back'));

  /* --- hardwood core stripe visible on the belly ------------------------ */
  var st3 = [];
  for (i = 0; i <= 16; i++) {
    t = 0.05 + (i / 16) * 0.93;
    p = limbParam(t, side);
    st3.push({ p: V3(0, p.y, p.z + limbHH(t) * 0.93), hw: limbHW(t) * .93, hh: 0.20, r: 0.1 });
  }
  var core = addObj({
    id: 'limb.' + where + '.core',
    g: loft({ axis: 'y', st: st3, seg: 4, name: 'limb.' + where + '.core' }),
    color: C.limbWood, rough: .42, metal: .05, tex: 'wood', texMode: texMode.wood, uv: 3.4
  });
  groupAdd(grp, mark(core, 'limb.core'));

  /* --- ILF dovetail tongue at the butt ---------------------------------- */
  var dv = addObj({
    id: 'limb.' + where + '.dovetail',
    g: boxGeo(21.0, 24, 9.0, 1.2),
    pos: V3(0, BOW.pocketY * side + 2 * side, -21),
    rot: [(-7 * side) * DEG, 0, 0],
    color: C.anodBlack, rough: .34, metal: .85
  });
  groupAdd(grp, mark(dv, 'limb.dovetail'));

  /* --- limb butt wedge (thicker build-up near the pocket) --------------- */
  var bw = [];
  for (i = 0; i <= 8; i++) {
    t = i / 8 * 0.14;
    p = limbParam(t, side);
    bw.push({ p: p, hw: limbHW(t) * 1.03, hh: limbHH(t) * 1.32, r: limbHW(0) * .34 });
  }
  var butt = addObj({
    id: 'limb.' + where + '.butt',
    g: loft({ axis: 'y', st: bw, seg: 4, name: 'limb.' + where + '.butt' }),
    color: [0.09, 0.095, 0.105], rough: .2, metal: .2, tex: 'carbon', texMode: texMode.carbon, uv: .55
  });
  groupAdd(grp, mark(butt, 'limb.butt'));

  /* --- recurve tip overlay (phenolic) + string groove ------------------- */
  var to = [];
  for (i = 0; i <= 8; i++) {
    t = 0.90 + (i / 8) * 0.10;
    p = limbParam(t, side);
    var sc = 1 - (i / 8) * 0.24;
    to.push({ p: p, hw: limbHW(t) * 1.12 * sc, hh: limbHH(t) * 1.85 * sc, r: limbHW(t) * .22 });
  }
  /* the overlay continues past the neutral axis to form the nock end */
  for (i = 1; i <= 3; i++) {
    var u2 = i / 3;
    to.push({
      p: V3(0, side * lerp(830, 856, u2), lerp(72, 76, u2)),
      hw: limbHW(1) * 0.86 * (1 - u2 * 0.40),
      hh: limbHH(1) * 1.85 * (1 - u2 * 0.28),
      r: limbHW(1) * .2
    });
  }
  var tip = addObj({
    id: 'limb.' + where + '.tip',
    g: loft({ axis: 'y', st: to, seg: 4, name: 'limb.' + where + '.tip' }),
    color: [0.055, 0.058, 0.065], rough: .22, metal: .25
  });
  groupAdd(grp, mark(tip, 'limb.tip'));

  /* --- string groove cut through the tip -------------------------------- */
  var gp = [];
  for (i = 0; i <= 10; i++) {
    t = 0.915 + (i / 10) * 0.085;
    p = limbParam(t, side);
    var r = limbHH(t) * 1.95 + 0.35;
    gp.push(V3(0, p.y, p.z - r * 0.15 + (i / 10) * 1.6));
  }
  gp.push(V3(0, side * 854, 76));
  var groove = addObj({
    id: 'limb.' + where + '.groove',
    g: tubeAlong({ path: gp, hw: 1.05, hh: 2.6, arc: 8, mode: 'round', caps: true, name: 'limb.' + where + '.groove' }),
    color: [0.02, 0.02, 0.025], rough: .6, metal: .1
  });
  groupAdd(grp, mark(groove, 'limb.groove'));

  /* --- limb graphics / spec decal on the back --------------------------- */
  var dec = [];
  for (i = 0; i <= 6; i++) {
    t = 0.16 + (i / 6) * 0.30;
    p = limbParam(t, side);
    dec.push({ p: V3(0, p.y, p.z - limbHH(t) * 0.93 - 0.15), hw: limbHW(t) * .72, hh: 0.12, r: 0.08 });
  }
  var decal = addObj({
    id: 'limb.' + where + '.decal',
    g: loft({ axis: 'y', st: dec, seg: 3, name: 'limb.' + where + '.decal' }),
    color: [0.78, 0.80, 0.84], rough: .45, metal: .3
  });
  groupAdd(grp, mark(decal, 'limb.decal'));

  /* --- limb tip damper (rubber) ----------------------------------------- */
  var dmp = addObj({
    id: 'limb.' + where + '.damper',
    g: lathe({ axis: 'y', seg: 20, closed: true, prof: [
      [0, 0], [3.2, 0], [3.6, 3], [4.6, 6], [3.4, 9], [0, 9]
    ] }),
    pos: V3(0, limbParam(0.90, side).y, limbParam(0.90, side).z - 7),
    color: [0.11, 0.115, 0.13], rough: .85, metal: .03, tex: 'rubber', texMode: texMode.rubber, uv: 0.5
  });
  groupAdd(grp, mark(dmp, 'limb.damper'));
  return body;
}

/* ==========================================================================
 *  3 · STRING  —  18 strand, centre serving, loops, nocking point
 * ========================================================================*/
function stringPath() {
  var pts = [], i;
  var A = V3(0, BOW.tipY, BOW.tipZ + 1.0);
  var B = V3(0, 0, BOW.stringZ);
  var D = V3(0, -BOW.tipY, BOW.tipZ + 1.0);
  for (i = 0; i <= 18; i++) {
    var t = i / 18, p;
    if (t <= .5) p = vlerp(A, B, t * 2);
    else p = vlerp(B, D, (t - .5) * 2);
    pts.push(p);
  }
  /* slight inward camber so the string is not a dead straight line */
  for (i = 0; i < pts.length; i++) {
    var u = i / (pts.length - 1);
    pts[i].z += Math.sin(u * Math.PI) * 0.0;
  }
  return pts;
}

function buildString() {
  var P = stringPath();
  var s = addObj({
    id: 'string.main',
    g: tubeAlong({ path: P, hw: 1.55, hh: 1.55, arc: 8, mode: 'round', caps: true, name: 'string.main' }),
    color: C.stringMat, rough: .55, metal: .05, tex: 'string', texMode: texMode.string, uv: 2.2,
    vibrate: true
  });
  groupAdd(stringGroup, mark(s, 'string.main'));

  /* --- centre serving (thicker wrap) ------------------------------------ */
  var sp = [], i;
  for (i = 0; i <= 12; i++) {
    var t = lerp(0.5 - 0.105, 0.5 + 0.105, i / 12);
    var idx = t * (P.length - 1), i0 = Math.floor(idx), f = idx - i0;
    sp.push(vlerp(P[i0], P[Math.min(P.length - 1, i0 + 1)], f));
  }
  var sv = addObj({
    id: 'string.serving',
    g: tubeAlong({ path: sp, hw: 1.95, hh: 1.95, arc: 10, mode: 'round', caps: true, name: 'string.serving' }),
    color: C.serving, rough: .62, metal: .06, vibrate: true
  });
  groupAdd(stringGroup, mark(sv, 'string.serving'));

  /* --- end servings under the loops ------------------------------------- */
  [1, -1].forEach(function (s2) {
    var ep = [], k;
    for (k = 0; k <= 8; k++) {
      var t2 = s2 > 0 ? lerp(0.0, 0.085, k / 8) : lerp(1.0, 0.915, k / 8);
      var idx2 = t2 * (P.length - 1), i2 = Math.floor(idx2), f2 = idx2 - i2;
      ep.push(vlerp(P[i2], P[Math.min(P.length - 1, i2 + 1)], f2));
    }
    var e = addObj({
      id: 'string.endserving.' + (s2 > 0 ? 'U' : 'L'),
      g: tubeAlong({ path: ep, hw: 1.85, hh: 1.85, arc: 10, mode: 'round', caps: true, name: 'endserving' }),
      color: C.serving, rough: .62, metal: .06
    });
    groupAdd(stringGroup, mark(e, 'string.endserving'));
  });

  /* --- top + bottom loops ----------------------------------------------- */
  [1, -1].forEach(function (s3) {
    var c = V3(0, (BOW.tipY - 5) * s3, BOW.tipZ - 6.0);
    var l = addObj({
      id: 'string.loop.' + (s3 > 0 ? 'U' : 'L'),
      g: torus(V3(1, 0, 0), 6.4, 1.5, 26, 8, 1, 'loop'),
      pos: c, color: C.stringMat, rough: .6, metal: .04, tex: 'string', texMode: texMode.string, uv: 3.0
    });
    groupAdd(stringGroup, mark(l, 'string.loop'));
  });

  /* --- nocking point (brass, crimped) — the arrow clips here ------------ */
  var np = addObj({
    id: 'string.nockingpoint',
    g: torus(V3(0, 1, 0), 2.1, 0.85, 22, 8, 1, 'nock'),
    pos: V3(0, 6, BOW.stringZ), color: C.brass, rough: .35, metal: 1.0
  });
  groupAdd(stringGroup, mark(np, 'string.nockingpoint'));
  var np2 = addObj({
    id: 'string.nockingpoint2',
    g: torus(V3(0, 1, 0), 2.1, 0.85, 22, 8, 1, 'nock'),
    pos: V3(0, -7, BOW.stringZ), color: C.brass, rough: .35, metal: 1.0
  });
  groupAdd(stringGroup, mark(np2, 'string.nockingpoint'));

  /* --- D-loop (release aid loop, useful when shooting a compound-style) - */
  var dl = addObj({
    id: 'string.dloop',
    g: tubeAlong({
      path: [V3(1.6, 12, BOW.stringZ + 1), V3(1.6, 12, BOW.stringZ - 12),
      V3(-1.6, 12, BOW.stringZ - 12), V3(-1.6, 3, BOW.stringZ - 12),
      V3(-1.6, 3, BOW.stringZ + 1)],
      hw: 1.1, hh: 1.1, arc: 8, mode: 'round', caps: true, name: 'dloop'
    }),
    color: [0.08, 0.08, 0.09], rough: .7, metal: .05
  });
  groupAdd(stringGroup, mark(dl, 'string.dloop'));
}

/* ==========================================================================
 *  4 · ARROW REST · PLUNGER · CLICKER
 * ========================================================================*/
var ARROW = {
  nock: V3(0, 0, BOW.stringZ),
  dir: null, len: 760, rest: V3(0, 0, -36)
};
ARROW.dir = vnorm(V3(0, 0.0043, -1));

function arrowPointAt(d) { return vadd(ARROW.nock, vscale(ARROW.dir, d)); }
window.ARROW = ARROW;
window.arrowPointAt = arrowPointAt;

function buildRest() {
  /* --- magnetic arrow rest: body + launcher blade ----------------------- */
  var body = addObj({
    id: 'rest.body', g: boxGeo(12, 26, 15, 1.8),
    pos: V3(-16.5, 13, -2.0), rot: [0, 0, 0],
    color: C.anodBlack, rough: .34, metal: .85, tex: 'ano', texMode: texMode.ano, uv: .2
  });
  groupAdd(restGroup, mark(body, 'rest.body'));
  /* vertical adjustment screw */
  var screw = addObj({
    id: 'rest.screw', g: lathe({ axis: 'y', seg: 14, closed: true, prof: [
      [2.6, 0], [2.6, 10], [3.6, 11], [3.6, 14], [0, 14]
    ] }),
    pos: V3(-16.5, 26, -2.0), color: C.anodSilver, rough: .3, metal: 1.0
  });
  groupAdd(restGroup, mark(screw, 'rest.screw'));
  /* launcher blade: rises from the body up under the arrow */
  var bl = [];
  for (var i = 0; i <= 8; i++) {
    var t = i / 8;
    bl.push({
      p: V3(lerp(-20.5, -10.0, t), lerp(1.2, 1.0, t), lerp(-3.2, -8.0, t)),
      hw: 0.7, hh: lerp(4.0, 1.2, t), r: 0.5
    });
  }
  var blade = addObj({
    id: 'rest.blade', g: loft({ axis: 'z', st: bl, seg: 3, name: 'rest.blade' }),
    color: [0.10, 0.105, 0.12], rough: .22, metal: .3
  });
  groupAdd(restGroup, mark(blade, 'rest.blade'));
  /* arrow support pad on the blade tip */
  var pad = addObj({
    id: 'rest.pad', g: cylZ(-8.4, -6.2, 1.7, 1.7, 12),
    pos: V3(-11.4, 0.9, 0), rot: [0, 0, -14 * DEG],
    color: [0.85, 0.72, 0.20], rough: .8, metal: .05
  });
  groupAdd(restGroup, mark(pad, 'rest.pad'));

  /* --- cushion plunger (threads into the window floor) ------------------ */
  var cage = addObj({
    id: 'plunger.body', g: lathe({ axis: 'x', seg: 22, closed: true, prof: [
      [6.6, 0], [6.6, 9], [7.6, 10], [7.6, 17], [6.0, 18], [6.0, 25], [3.4, 25.6], [3.4, 32], [0, 32]
    ] }),
    pos: V3(-30.5, -6, -3), color: C.anodBlack, rough: .35, metal: .85, tex: 'ano', texMode: texMode.ano, uv: .25
  });
  groupAdd(restGroup, mark(cage, 'plunger.body'));
  /* spring */
  var spring = addObj({
    id: 'plunger.spring', g: lathe({ axis: 'x', seg: 16, closed: true, prof: [
      [1.5, 9.0], [2.6, 9.0], [2.6, 9.5], [1.7, 10.0], [2.6, 10.5], [1.7, 11.0], [2.6, 11.5],
      [1.7, 12.0], [2.6, 12.5], [1.7, 13.0], [2.6, 13.5], [1.7, 14.0], [2.6, 14.5], [1.5, 14.5]
    ] }),
    pos: V3(-30.5, -6, -3), color: C.steel, rough: .3, metal: 1.0
  });
  groupAdd(restGroup, mark(spring, 'plunger.spring'));
  /* pressure button tip (contacts the arrow shaft at x = 0) */
  var tip = addObj({
    id: 'plunger.tip', g: lathe({ axis: 'x', seg: 18, closed: true, prof: [
      [2.9, 21.0], [2.9, 25.0], [2.2, 25.6], [2.2, 28.6], [0, 29.2]
    ] }),
    pos: V3(-30.5, -6, -3), color: [0.22, 0.23, 0.26], rough: .55, metal: .3
  });
  groupAdd(restGroup, mark(tip, 'plunger.tip'));
  /* knurled adjuster + lock ring */
  var adj = addObj({
    id: 'plunger.adjuster', g: lathe({ axis: 'x', seg: 8, closed: true, prof: [
      [7.0, 0.5], [7.0, 5.5], [6.0, 6.0], [6.0, 8.0], [7.0, 8.5], [7.0, 13.5], [6.0, 14.0], [6.0, 16.0], [7.0, 16.5], [7.0, 19.5], [0, 19.5]
    ] }),
    pos: V3(-30.5, -6, -3), color: C.anodSilver, rough: .3, metal: 1.0
  });
  groupAdd(restGroup, mark(adj, 'plunger.adjuster'));

  /* --- clicker (blade on the upper plate mount) ------------------------ */
  var plate = addObj({
    id: 'clicker.plate', g: boxGeo(4.5, 44, 16, 1.0),
    pos: V3(-24.4, 176, -2), color: C.anodBlack, rough: .35, metal: .85
  });
  groupAdd(restGroup, mark(plate, 'clicker.plate'));
  /* the blade hangs in the window; its rest position must sit 20 mm in
     front of the brace-height arrow so a full draw makes it click. */
  var cpath = [];
  for (var k = 0; k <= 12; k++) {
    var u = k / 12;
    cpath.push(V3(lerp(-24.0, -13.5, u) + Math.sin(u * Math.PI) * 1.6,
      lerp(198, 40, u),
      lerp(-6.0, 1.5, u) + Math.sin(u * Math.PI) * 3.0));
  }
  var bladeC = addObj({
    id: 'clicker.blade',
    g: tubeAlong({ path: cpath, hw: 4.2, hh: 0.35, arc: 6, mode: 'rect', seg: 2, caps: true, name: 'clicker.blade' }),
    color: [0.72, 0.74, 0.78], rough: .18, metal: 1.0
  });
  groupAdd(restGroup, mark(bladeC, 'clicker.blade'));
}

/* ==========================================================================
 *  5 · SIGHT  —  dovetail block, elevation bar, extension, aperture + pin
 * ========================================================================*/
var SIGHT = {
  mount: V3(-25.6, 156, -2),
  barZ: -8.5,
  extEnd: -104,
  apertureY: -9
};

function buildSight() {
  /* --- dovetail mount block (clamps the riser's sight bushing bar) ----- */
  var blk = addObj({
    id: 'sight.dovetail', g: boxGeo(15, 72, 26, 2.4),
    pos: V3(-37.0, 127, -2), color: C.anodBlack, rough: .32, metal: .9, tex: 'ano', texMode: texMode.ano, uv: .16
  });
  groupAdd(sightGroup, mark(blk, 'sight.dovetail'));
  /* --- elevation bar (vertical dovetail slide) ------------------------- */
  var eb = addObj({
    id: 'sight.bar', g: boxGeo(9.0, 150, 11.0, 2.0),
    pos: V3(-44.5, 100, -8.5), color: [0.10, 0.105, 0.12], rough: .28, metal: .55, tex: 'ano', texMode: texMode.ano, uv: .2
  });
  groupAdd(sightGroup, mark(eb, 'sight.bar'));
  /* elevation scale / markings strip */
  var es = addObj({
    id: 'sight.scale', g: boxGeo(1.2, 132, 5.0, 0.4),
    pos: V3(-49.3, 100, -12.2), color: [0.88, 0.88, 0.90], rough: .5, metal: .2
  });
  groupAdd(sightGroup, mark(es, 'sight.scale'));
  /* elevation lock knob */
  var ek = addObj({
    id: 'sight.knob', g: lathe({ axis: 'x', seg: 10, closed: true, prof: [
      [5.6, 0], [5.6, 6], [7.6, 7], [7.6, 13], [5.6, 14], [5.6, 18], [0, 18]
    ] }),
    pos: V3(-52.0, 160, -4), color: C.anodSilver, rough: .28, metal: 1.0
  });
  groupAdd(sightGroup, mark(ek, 'sight.knob'));
  /* windage adjust screw */
  var wk = addObj({
    id: 'sight.windage', g: lathe({ axis: 'x', seg: 12, closed: true, prof: [
      [4.4, 0], [4.4, 6], [6.4, 7], [6.4, 12], [4.4, 13], [4.4, 18], [0, 18]
    ] }),
    pos: V3(-52.0, 30, -8.5), color: C.anodSilver, rough: .28, metal: 1.0
  });
  groupAdd(sightGroup, mark(wk, 'sight.windage'));
  /* --- carbon extension bar (carries the aperture forward) ------------- */
  var ext = addObj({
    id: 'sight.extension', g: tubeAlong({
      path: [V3(-44.5, 30, -12), V3(-44.5, 20, -34), V3(-44.5, 7, -62), V3(-44.5, -4, -88), V3(-44.5, -8, -100)],
      hw: 4.6, hh: 4.2, arc: 14, mode: 'round', caps: true, name: 'sight.extension'
    }),
    color: [0.10, 0.105, 0.12], rough: .24, metal: .35, tex: 'carbon', texMode: texMode.carbon, uv: .7
  });
  groupAdd(sightGroup, mark(ext, 'sight.extension'));
  /* --- aperture ring + crosshair + fibre pin --------------------------- */
  var yA = SIGHT.apertureY, zA = -103.5;
  var ring = addObj({
    id: 'sight.aperture', g: torus(V3(0, 0, 1), 21, 2.6, 44, 10, 1, 'aperture'),
    pos: V3(-44.5, yA, zA), color: C.anodBlack, rough: .3, metal: .8, tex: 'ano', texMode: texMode.ano, uv: .3
  });
  groupAdd(sightGroup, mark(ring, 'sight.aperture'));
  /* crosshair level (thin bar across the ring) */
  var lvl = addObj({
    id: 'sight.level', g: boxGeo(36, 1.0, 1.2, 0.3),
    pos: V3(-44.5, yA + 13, zA + 0.5), color: [0.9, 0.9, 0.92], rough: .35, metal: .5
  });
  groupAdd(sightGroup, mark(lvl, 'sight.level'));
  /* fibre optic pin + bright tip */
  var pin = addObj({
    id: 'sight.pin', g: lathe({ axis: 'z', seg: 12, closed: true, prof: [
      [1.5, 4], [1.5, -7], [0.9, -8], [0.9, -11], [0, -11]
    ] }),
    pos: V3(-44.5, yA, zA), color: [0.85, 0.86, 0.9], rough: .3, metal: .8
  });
  groupAdd(sightGroup, mark(pin, 'sight.pin'));
  var fib = addObj({
    id: 'sight.fibre', g: lathe({ axis: 'z', seg: 12, closed: true, prof: [
      [0.85, -10.5], [0.85, -15.0], [0, -15.0]
    ] }),
    pos: V3(-44.5, yA, zA), color: [0.35, 1.0, 0.55], rough: .25, metal: 0,
    emiss: [0.30, 0.95, 0.45]
  });
  groupAdd(sightGroup, mark(fib, 'sight.fibre'));
  /* level bubble in the sight ring */
  var bub = addObj({
    id: 'sight.bubble', g: cylZ(-2.0, 2.0, 4.6, 4.6, 16),
    pos: V3(-44.5, yA - 15, zA), color: [0.35, 0.85, 0.6], rough: .2, metal: .1,
    emiss: [0.05, 0.20, 0.13]
  });
  groupAdd(sightGroup, mark(bub, 'sight.bubble'));
}

/* ==========================================================================
 *  6 · STABILISER SYSTEM  —  long rod, dampers, weights, V-bar, rear rod
 * ========================================================================*/
var STAB = {
  mount: V3(0, -142, 24),
  rodLen: 760,
  sideOut: 205,
  sideDown: -176,
  sideFwd: -190
};

function weightStack(n, r, t, pitch, axis, z0, color) {
  var prof = pStack(n, r, t, pitch), out = [];
  for (var i = 0; i < prof.length; i++) out.push([prof[i][0], prof[i][1] + z0]);
  return lathe({ axis: axis, seg: 30, closed: true, prof: out });
}

function buildStab() {
  var m = STAB.mount;
  /* --- quick-disconnect mount block ------------------------------------ */
  var qd = addObj({
    id: 'stab.mount', g: lathe({ axis: 'z', seg: 26, closed: true, prof: [
      [11, 12], [11, 30], [12.5, 31.5], [12.5, 44], [10, 45.5], [10, 54], [0, 54]
    ] }),
    pos: V3(m.x, m.y, m.z), color: C.anodBlack, rough: .34, metal: .85, tex: 'ano', texMode: texMode.ano, uv: .14
  });
  groupAdd(stabGroup, mark(qd, 'stab.mount'));
  /* --- main long rod (tapered carbon) ---------------------------------- */
  var z0 = m.z + 54, z1 = z0 - STAB.rodLen;
  var rod = addObj({
    id: 'stab.rod', g: cylZ(z0, z1, 9.5, 6.4, 26),
    pos: V3(0, -142, 0), color: [0.085, 0.09, 0.10], rough: .22, metal: .3, tex: 'carbon', texMode: texMode.carbon, uv: .22
  });
  groupAdd(stabGroup, mark(rod, 'stab.rod'));
  /* --- rubber damper at the rod root ----------------------------------- */
  var dmp = addObj({
    id: 'stab.damperA', g: lathe({ axis: 'z', seg: 24, closed: true, prof: [
      [11.0, 0], [11.0, 9], [13.0, 11], [13.0, 24], [11.0, 26], [11.0, 33], [0, 33]
    ] }),
    pos: V3(0, -142, z0 - 62), color: [0.13, 0.14, 0.16], rough: .88, metal: .02,
    tex: 'rubber', texMode: texMode.rubber, uv: .4
  });
  groupAdd(stabGroup, mark(dmp, 'stab.damper'));
  /* --- 3 x 1oz stainless weights at the far end ------------------------ */
  var w3 = addObj({
    id: 'stab.weights', g: weightStack(3, 17.5, 9.6, 12.0, 'z', z1 + 4, 'w'),
    pos: V3(0, -142, 0), color: C.darkSteel, rough: .42, metal: .95, tex: 'ano', texMode: texMode.ano, uv: .12
  });
  groupAdd(stabGroup, mark(w3, 'stab.weights'));
  /* end cap / weight locking screw */
  var ec = addObj({
    id: 'stab.endcap', g: lathe({ axis: 'z', seg: 20, closed: true, prof: [
      [9.0, z1 - 34], [9.0, z1 - 40], [6.5, z1 - 42], [6.5, z1 - 46], [0, z1 - 46]
    ] }),
    pos: V3(0, -142, 0), color: C.anodSilver, rough: .3, metal: 1.0
  });
  groupAdd(stabGroup, mark(ec, 'stab.endcap'));

  /* --- V-bar (swivel) -------------------------------------------------- */
  var vp = V3(0, -118, 6);
  var vb = addObj({
    id: 'stab.vbar', g: lathe({ axis: 'y', seg: 22, closed: true, prof: [
      [9.0, -12], [9.0, 12], [11.0, 14], [11.0, 20], [8.0, 22], [8.0, 28], [0, 28]
    ] }),
    pos: V3(0, -118, 20), rot: [0, 0, 0], color: C.anodBlack, rough: .32, metal: .9, tex: 'ano', texMode: texMode.ano, uv: .16
  });
  groupAdd(stabGroup, mark(vb, 'stab.vbar'));
  /* swivel lock knob */
  var vk = addObj({
    id: 'stab.vbar.knob', g: lathe({ axis: 'z', seg: 10, closed: true, prof: [
      [5.0, -12], [5.0, -6], [7.0, -5], [7.0, 0], [5.0, 1], [5.0, 6], [0, 6]
    ] }),
    pos: V3(0, -118, 34), color: C.anodSilver, rough: .3, metal: 1.0
  });
  groupAdd(stabGroup, mark(vk, 'stab.vbar'));

  /* --- side rods (left + right), angled out / down / forward ----------- */
  [-1, 1].forEach(function (side) {
    var tip = V3(side * STAB.sideOut, -118 + STAB.sideDown, 20 + STAB.sideFwd);
    var root = V3(side * 16, -118 - 10, 22);
    var sr = addObj({
      id: 'stab.siderod.' + (side > 0 ? 'R' : 'L'),
      g: cylBetween(root, tip, 8.2, 5.6, 20, 'siderod'),
      color: [0.085, 0.09, 0.10], rough: .22, metal: .3, tex: 'carbon', texMode: texMode.carbon, uv: .28
    });
    groupAdd(stabGroup, mark(sr, 'stab.siderod'));
    /* side rod damper */
    var d2 = addObj({
      id: 'stab.sidedamper.' + (side > 0 ? 'R' : 'L'),
      g: lathe({ axis: 'z', seg: 20, closed: true, prof: [
        [10.5, 0], [10.5, 8], [12.5, 10], [12.5, 21], [10.5, 23], [10.5, 29], [0, 29]
      ] }),
      pos: vlerp(root, tip, 0.36), rot: [0, Math.atan2(side * STAB.sideOut * 0.55, -STAB.sideFwd) * 0.35, -90 * DEG],
      color: [0.13, 0.14, 0.16], rough: .88, metal: .02, tex: 'rubber', texMode: texMode.rubber, uv: .45
    });
    groupAdd(stabGroup, mark(d2, 'stab.damper'));
    /* weights */
    var wdir = vnorm(vsub(tip, root));
    var wg = addObj({
      id: 'stab.sideweights.' + (side > 0 ? 'R' : 'L'),
      g: weightStack(2, 15.0, 8.4, 10.5, 'z', 0, 'w'),
      pos: vadd(tip, vscale(wdir, -18)), rot: [0, Math.atan2(wdir.x, wdir.z) + Math.PI, 0],
      color: C.darkSteel, rough: .42, metal: .95, tex: 'ano', texMode: texMode.ano, uv: .14
    });
    groupAdd(stabGroup, mark(wg, 'stab.weights'));
  });

  /* --- rear (back) stabiliser: short rod + damper ---------------------- */
  var rb = addObj({
    id: 'stab.rearrod', g: lathe({ axis: 'z', seg: 24, closed: true, prof: [
      [7.6, z0 + 140], [7.6, z0 - 12], [6.2, z0 - 16], [6.2, z0 - 250], [0, z0 - 250]
    ] }),
    pos: V3(0, -142, 0), color: [0.085, 0.09, 0.10], rough: .24, metal: .3, tex: 'carbon', texMode: texMode.carbon, uv: .3
  });
  groupAdd(stabGroup, mark(rb, 'stab.rod'));
  var rd = addObj({
    id: 'stab.reardamper', g: lathe({ axis: 'z', seg: 22, closed: true, prof: [
      [9.5, z0 - 236], [9.5, z0 - 222], [11.5, z0 - 220], [11.5, z0 - 208], [0, z0 - 206]
    ] }),
    pos: V3(0, -142, 0), color: [0.13, 0.14, 0.16], rough: .88, metal: .02, tex: 'rubber', texMode: texMode.rubber, uv: .5
  });
  groupAdd(stabGroup, mark(rd, 'stab.damper'));
}

/* ==========================================================================
 *  7 · ARROW  —  shaft, nock, pin, vanes, point
 * ========================================================================*/
function buildArrow() {
  var a = ARROW.nock, d = ARROW.dir, len = ARROW.len;
  /* --- shaft ------------------------------------------------------------ */
  var shaft = addObj({
    id: 'arrow.shaft', g: cylBetween(a, arrowPointAt(len), 3.15, 3.15, 16, 'shaft'),
    color: C.shaft, rough: .26, metal: .25, tex: 'carbon', texMode: texMode.carbon, uv: .18
  });
  groupAdd(arrowGroup, mark(shaft, 'arrow.shaft'));
  /* --- nock (pin nock) -------------------------------------------------- */
  var nk = addObj({
    id: 'arrow.nock', g: lathe({ axis: 'z', seg: 20, closed: true, prof: [
      [3.2, 6.5], [3.2, 2], [2.4, 1], [2.4, -3], [3.6, -5], [3.6, -12], [0, -12]
    ] }),
    pos: a, color: C.nock, rough: .32, metal: .05
  });
  groupAdd(arrowGroup, mark(nk, 'arrow.nock'));
  /* nock throat slot (dark separator) */
  var th = addObj({
    id: 'arrow.nockthroat', g: boxGeo(0.7, 8, 6, 0.2),
    pos: vadd(a, V3(0, 0, -8.5)), color: [0.05, 0.05, 0.06], rough: .6, metal: .05
  });
  groupAdd(arrowGroup, mark(th, 'arrow.nock'));
  /* --- pin / bushing ---------------------------------------------------- */
  var pin = addObj({
    id: 'arrow.pin', g: lathe({ axis: 'z', seg: 16, closed: true, prof: [
      [2.2, 12], [2.2, 5], [1.4, 4], [1.4, 9.5], [0, 9.5]
    ] }),
    pos: a, color: C.steel, rough: .28, metal: 1.0
  });
  groupAdd(arrowGroup, mark(pin, 'arrow.pin'));
  /* --- 3 x shield-cut vanes at 120° ------------------------------------ */
  for (var v = 0; v < 3; v++) {
    var az = 90 * DEG + v * 120 * DEG;
    var base = arrowPointAt(122);
    var vn = addObj({
      id: 'arrow.vane' + (v + 1),
      g: vane({ len: 58, h: 9.2, th: .62, az: az, twist: 0.10, z0: base.z, r0: 3.1, seg: 16 }),
      pos: V3(base.x, base.y, 0),
      color: v === 0 ? C.vane2 : C.vane, rough: .5, metal: .04, uv: 1
    });
    groupAdd(arrowGroup, mark(vn, 'arrow.vane'));
  }
  /* --- insert + 100 gr target point ------------------------------------ */
  var ins = addObj({
    id: 'arrow.insert', g: lathe({ axis: 'z', seg: 16, closed: true, prof: [
      [2.6, -6], [2.6, 2], [0, 2]
    ] }),
    pos: arrowPointAt(len - 4),
    rot: [-Math.atan2(ARROW.dir.y, -ARROW.dir.z), 0, 0],
    color: C.darkSteel, rough: .35, metal: .9
  });
  groupAdd(arrowGroup, mark(ins, 'arrow.insert'));
  var pt = addObj({
    id: 'arrow.point', g: lathe({ axis: 'z', seg: 20, closed: true, prof: [
      [3.1, -4], [3.1, 8], [2.6, 10], [2.6, 28], [1.6, 32], [0, 37]
    ] }),
    pos: arrowPointAt(len),
    rot: [-Math.atan2(ARROW.dir.y, -ARROW.dir.z), 0, 0],
    color: C.point, rough: .2, metal: 1.0
  });
  groupAdd(arrowGroup, mark(pt, 'arrow.point'));
  /* --- arrow wrap / cresting tape -------------------------------------- */
  var wrap = addObj({
    id: 'arrow.wrap', g: cylBetween(arrowPointAt(118), arrowPointAt(184), 3.30, 3.30, 14, 'wrap'),
    color: C.tape, rough: .45, metal: .1
  });
  groupAdd(arrowGroup, mark(wrap, 'arrow.wrap'));
}

/* ==========================================================================
 *  8 · TOOLS  —  bow square, serving spool, nock set, tiller gauge
 * ========================================================================*/
function buildTools() {
  var ox = 300, oy = -300;
  /* bow square */
  var v1 = addObj({
    id: 'tool.bowsquare.v', g: boxGeo(6, 300, 22, 2),
    pos: V3(ox, oy + 150, 200), color: [0.78, 0.80, 0.84], rough: .35, metal: .85
  });
  groupAdd(toolGroup, mark(v1, 'tool.bowsquare'));
  var v2 = addObj({
    id: 'tool.bowsquare.h', g: boxGeo(6, 22, 120, 2),
    pos: V3(ox, oy + 289, 200 + 49), color: [0.78, 0.80, 0.84], rough: .35, metal: .85
  });
  groupAdd(toolGroup, mark(v2, 'tool.bowsquare'));
  /* tiller gauge (thin steel rule) */
  var v3 = addObj({
    id: 'tool.tiller', g: boxGeo(4, 240, 16, 1),
    pos: V3(ox + 40, oy + 120, 200), rot: [0, 12 * DEG, 0], color: [0.85, 0.72, 0.28], rough: .4, metal: .8
  });
  groupAdd(toolGroup, mark(v3, 'tool.tiller'));
  /* serving spool + thread */
  var sp = addObj({
    id: 'tool.serving', g: lathe({ axis: 'z', seg: 24, closed: true, prof: [
      [0, -14], [17, -14], [19, -11], [19, -4], [15, -2], [15, 2], [19, 4], [19, 11], [17, 14], [0, 14]
    ] }),
    pos: V3(ox - 60, oy + 60, 210), color: [0.16, 0.17, 0.20], rough: .6, metal: .1,
    tex: 'string', texMode: texMode.string, uv: .9
  });
  groupAdd(toolGroup, mark(sp, 'tool.serving'));
  /* nock set pliers-ish block + spare nocks */
  var pl = addObj({
    id: 'tool.nockset', g: boxGeo(14, 90, 16, 2),
    pos: V3(ox + 110, oy + 60, 205), rot: [0, 0, 24 * DEG], color: [0.30, 0.32, 0.36], rough: .5, metal: .7
  });
  groupAdd(toolGroup, mark(pl, 'tool.nockset'));
  for (var i = 0; i < 3; i++) {
    var nk = addObj({
      id: 'tool.sparenock' + (i + 1), g: lathe({ axis: 'z', seg: 16, closed: true, prof: [
        [3.2, 0], [3.2, 6], [2.4, 7], [2.4, 11], [0, 11]
      ] }),
      pos: V3(ox + 130 + i * 14, oy - 40, 208), color: [0.92, 0.30 + i * .12, 0.14], rough: .35, metal: .1
    });
    groupAdd(toolGroup, mark(nk, 'tool.sparenock'));
  }
}

/* ==========================================================================
 *  9 · BUILD EVERYTHING
 * ========================================================================*/
window.buildBowModel = function () {
  buildRiserBody();
  buildWindowFaces();
  buildPockets();
  buildBushings();
  buildRiserDetails();
  buildGrip();
  buildLimb(1);
  buildLimb(-1);
  buildString();
  buildRest();
  buildSight();
  buildStab();
  buildArrow();
  buildTools();

  /* --- metadata: name / material / spec / notes for the BOM panel ------ */
  var M = {
    'floor': {
      n: '工程基准平面 Datum Plane', mat: '—', spec: '5 000 × 5 000 mm · 网格间距 500 mm',
      note: ['仅作为尺寸参考，非弓的零件。']
    },
    'riser.body': {
      n: '弓把主体 Riser Body', n2: 'ATF-X 25″ Forged Riser',
      mat: '6061-T6 锻造铝合金 · 3D 数控铣削 · 硬质阳极氧化',
      spec: '长 635 mm (25″) · 弓窗高 218 mm · 握把深 42 mm · 净重 1 186 g',
      note: ['锻造毛坯一次成型后 3 轴 CNC 精铣，弓窗与配重脊为整体结构，避免胶合界面。',
        '上下弓片座为可调式 ILF 燕尾，可做左右 (alignment) 与前后 (tiller) 微调。']
    },
    'riser.windowface': { n: '弓窗侧壁 Sight Window Wall', mat: '阳极氧化面', spec: '深 13.5 mm · 高 216 mm', note: ['弓窗深度决定箭侧垫与箭台的调节余量。'] },
    'riser.spine': { n: '配重脊 / 加强脊 Spine Rib', mat: '铝合金一体成型', spec: '宽 4.6–7.0 mm · 长 464 mm', note: ['提高弓把抗扭刚性，同时作为配重块安装面。'] },
    'riser.cap': { n: '弓把底盖 Butt Cap', mat: '铝合金 + 橡胶垫', spec: 'Ø29 mm', note: ['可加装底部配重，调整整弓重心。'] },
    'riser.badge': { n: '铭牌 Badge Plate', mat: '不锈钢', spec: '22 × 34 mm', note: ['刻印型号、磅数、序列号。'] },
    'riser.shelf': { n: '箭台搁板 Arrow Shelf', mat: '铝合金', spec: '宽 16 mm', note: ['搁板边缘贴绒面，减小箭羽刮擦。'] },
    'riser.bushing': { n: '衬套 Bushing', mat: '不锈钢 5/16-24 UNF', spec: '稳定杆 / 侧垫 / 响片 / 瞄准器用', note: ['全弓共 5 处标准衬套，均通心攻牙。'] },
    'riser.damper': { n: '弓把减震块 Riser Damper', mat: '钨粉 + 丁基橡胶', spec: 'Ø14.8 mm', note: ['抑制弓把高频振动，可拆卸。'] },
    'pocket': { n: 'ILF 弓片座部件 Pocket Hardware', mat: '铝合金 / 不锈钢', spec: '燕尾槽宽 21.5 mm', note: ['含左右颊板、底板、限位板、对齐螺丝、锁定螺丝与调磅垫片。'] },
    'grip.main': { n: '握把 Grip', mat: 'Fivics 一体成型塑料 / 可选胡桃木', spec: '低腕 · 握围 118 mm · 前倾 8°', note: ['低握设计降低扭转力臂，提升容错。'] },
    'grip.shelf': { n: '拇指托 Thumb Shelf', mat: '橡胶包覆', spec: '长 78 mm', note: ['稳定推弓手，减少左右偏移。'] },
    'grip.cap': { n: '握把固定螺丝 Grip Screw', mat: '不锈钢 M6', spec: '内六角 4 mm', note: [] },

    'limb.body': { n: '弓片主体 Limb (ILF)', mat: '碳纤维 / 泡沫芯 / 硬木层压', spec: '长 498 mm · 宽 33→18 mm · 厚 10.4→3.7 mm', note: ['反曲弧线：先向射手侧回弯，末端再向靶面回勾形成 recurve。', 'ILF 燕尾插片直接插入弓把弓片座。'] },
    'limb.back': { n: '弓片背面碳层 Carbon Back', mat: '3K 斜纹碳布 + 清漆', spec: '厚 0.44 mm', note: ['承受拉伸应力，决定弓片回弹速度。'] },
    'limb.core': { n: '弓片木芯 Wood Core', mat: '硬木 / 泡沫芯', spec: '厚 0.40 mm 外露层', note: ['影响手感与阻尼，木质芯手感柔和，泡沫芯更快。'] },
    'limb.dovetail': { n: 'ILF 燕尾插片 Dovetail Tongue', mat: '不锈钢 / 铝合金', spec: '21 × 24 × 9 mm', note: ['插入弓片座后由限位板与锁紧螺丝固定。'] },
    'limb.butt': { n: '弓片根部加厚 Wedge', mat: '碳纤 + 玻纤过渡', spec: '根部厚 13.7 mm', note: ['根部加厚以避免应力集中造成劈裂。'] },
    'limb.tip': { n: '弓片梢加强片 Tip Overlay', mat: '黑色酚醛 / 碳纤', spec: '长 43 mm', note: ['承载弦环摩擦，需定期检查有无裂纹。'] },
    'limb.groove': { n: '弦槽 String Groove', mat: '—', spec: '槽宽 2.1 mm', note: ['保证弦环居中，防止脱弦。'] },
    'limb.decal': { n: '弓片标识 Decal', mat: '转印贴纸', spec: '型号 / 磅数 / 编号', note: ['标注实测磅数（如 38# @28″）。'] },
    'limb.damper': { n: '弓片减震器 Limb Damper', mat: '橡胶', spec: 'Ø9 mm', note: ['装于弓片梢内侧，抑制弦振。'] },

    'string.main': { n: '弓弦 Bowstring', mat: 'Fast Flight / 8125 纤维', spec: '18 股 · 弦长 1 610 mm (66″ 弓用)', note: ['弦长按 AMO 标准：弓长 1676 mm 对应弦长约 1600–1615 mm。', '每次射击前检查起毛与断股。'] },
    'string.serving': { n: '中央缠绳 Center Serving', mat: '涤纶缠线', spec: '长 152 mm · Ø3.9 mm', note: ['保护弦体免遭箭尾与手指磨损。'] },
    'string.endserving': { n: '弦环缠绳 End Serving', mat: '涤纶缠线', spec: '长 84 mm', note: [] },
    'string.loop': { n: '弦环 String Loop', mat: '弦体自绕', spec: '内径 14 mm', note: ['套在弓片梢弦槽内。'] },
    'string.nockingpoint': { n: '搭箭点 Nocking Point', mat: '黄铜压接', spec: 'Ø4.2 mm · 间隙 13 mm', note: ['上下各一，夹住箭尾；高度以箭与箭台呈 90° 为准。'] },
    'string.dloop': { n: 'D 环 D-Loop', mat: 'Dyneema 绳', spec: '内径 12 mm', note: ['使用撒放器时安装；地中海式射法可拆除。'] },

    'rest.body': { n: '箭台本体 Rest Body', mat: '铝合金 + 磁铁', spec: '11 × 26 × 13 mm', note: ['磁力吸附式起落箭台，箭离弦后托板落下。'] },
    'rest.blade': { n: '箭台托板 Launcher Blade', mat: '弹簧钢 0.7 mm', spec: '长 21 mm · 高 7.2 mm', note: ['托板角度与高度直接影响箭的飞行姿态。'] },
    'rest.pad': { n: '托板缓冲垫 Blade Pad', mat: '聚氨酯', spec: 'Ø3.2 mm', note: [] },
    'rest.screw': { n: '高度调节螺丝 Height Screw', mat: '不锈钢', spec: 'M3 内六角', note: [] },
    'plunger.body': { n: '箭侧垫本体 Plunger Body', mat: '阳极氧化铝', spec: 'Ø15.2 mm · 螺纹 5/16-24', note: ['安装于弓窗底部衬套，压住箭侧。'] },
    'plunger.spring': { n: '弹簧 Spring', mat: '弹簧钢', spec: '刚度约 0.35 N/mm', note: ['更换弹簧可改变侧向容错。'] },
    'plunger.tip': { n: '触头 Button Tip', mat: '聚甲醛 / 特氟龙', spec: 'Ø5.8 mm', note: ['触头硬度影响箭离弦时的侧向扰动。'] },
    'plunger.adjuster': { n: '调节环 Adjuster Ring', mat: '不锈钢滚花', spec: '行程 4 mm', note: ['顺时针旋入增大张力。'] },
    'clicker.plate': { n: '响片座 Clicker Plate', mat: '铝合金', spec: '45 × 15 mm', note: ['固定于弓窗上方两颗衬套。'] },
    'clicker.blade': { n: '响片 Clicker Blade', mat: '弹簧钢 0.5 mm', spec: '伸出 62 mm', note: ['箭头拉过响片即发出声响，控制拉距一致性。'] },

    'sight.dovetail': { n: '瞄准器燕尾座 Dovetail Block', mat: '铝合金', spec: '52 × 26 mm', note: ['插入弓把燕尾槽，可前后滑动。'] },
    'sight.bar': { n: '升降杆 Elevation Bar', mat: '碳纤 + 铝', spec: '行程 150 mm · 刻度 0.5 mm/格', note: [] },
    'sight.scale': { n: '刻度尺 Scale Tape', mat: '—', spec: '0–150 mm', note: ['记录瞄准器位置以便复现。'] },
    'sight.knob': { n: '升降锁紧旋钮 Lock Knob', mat: '不锈钢', spec: 'Ø15 mm', note: [] },
    'sight.windage': { n: '风偏调节 Windage Screw', mat: '不锈钢', spec: '行程 ±12 mm', note: [] },
    'sight.extension': { n: '延长杆 Extension Bar', mat: '碳纤维', spec: '长 210 mm · 前伸 4″', note: ['延长瞄准基线，减小角度误差。'] },
    'sight.aperture': { n: '瞄准环 Aperture Ring', mat: '铝合金', spec: '外径 47 mm · 内径 37 mm', note: ['可选不同内径与倍率镜。'] },
    'sight.level': { n: '水平丝 Crosshair Level', mat: '不锈钢丝', spec: 'Ø1.0 mm', note: [] },
    'sight.pin': { n: '瞄针 Pin', mat: '不锈钢', spec: 'Ø1.8 mm', note: [] },
    'sight.fibre': { n: '光纤瞄点 Fibre Optic', mat: '光纤', spec: 'Ø1.7 mm · 绿光', note: ['低光环境下提升可见度。'] },
    'sight.bubble': { n: '水平气泡 Level Bubble', mat: '亚克力', spec: 'Ø9.2 mm', note: ['确认弓身左右水平。'] },

    'stab.mount': { n: '平衡杆座 Quick Mount', mat: '铝合金', spec: 'Ø25 × 42 mm', note: ['螺纹 5/16-24，可加装橡胶隔振块。'] },
    'stab.rod': { n: '长杆 Long Rod', mat: '碳纤维', spec: '长 760 mm (30″) · Ø19→13 mm', note: ['前伸配重，抵消开弓时的后仰力矩。'] },
    'stab.damper': { n: '减震胶 Damper', mat: '丁基橡胶', spec: 'Ø26 mm', note: ['打断杆体共振，抑制震动传递。'] },
    'stab.weights': { n: '配重块 Weight Stack', mat: '不锈钢 1 oz ×3', spec: 'Ø35 mm · 单块 28 g', note: ['按手感增减，整弓配重通常 4–8 oz。'] },
    'stab.endcap': { n: '杆端锁紧 End Cap', mat: '不锈钢', spec: 'M6', note: [] },
    'stab.vbar': { n: 'V 型座 V-Bar', mat: '铝合金', spec: '可调角度 0–45°', note: ['侧杆夹角通常 30–40°，兼顾稳定与容错。'] },
    'stab.siderod': { n: '侧杆 Side Rod', mat: '碳纤维', spec: '长 300 mm ×2', note: ['左右各一，抵消风偏并抑制左右摆动。'] },

    'arrow.shaft': { n: '箭杆 Shaft', mat: '碳纤维', spec: '长 760 mm · 内径 5.2 mm · 挠度 600–700', note: ['挠度需与弓的磅数匹配；箭重约 18 g。'] },
    'arrow.nock': { n: '箭尾 Nock', mat: '聚碳酸酯', spec: '插入式 · 重 0.5 g', note: ['夹在上下搭箭点之间。'] },
    'arrow.pin': { n: '箭尾插销 Pin', mat: '铝', spec: 'Ø4.4 mm', note: [] },
    'arrow.vane': { n: '箭羽 Vane', mat: '弹性聚合物', spec: '长 58 mm ×3 · 120° 分布', note: ['一枚异色为“记号羽”，用于统一搭箭方向。'] },
    'arrow.insert': { n: '箭杆内插 Insert', mat: '铝合金', spec: '重 12 g', note: [] },
    'arrow.point': { n: '箭头 Target Point', mat: '硬化钢', spec: '100 gr (6.5 g) · Ø7 mm', note: ['靶箭头为锥形，不伤靶面。'] },
    'arrow.wrap': { n: '箭羽贴纸 Wrap', mat: 'PVC 贴膜', spec: '长 66 mm', note: [] },

    'tool.bowsquare': { n: '弓方 Bow Square', mat: '铝合金', spec: '300 × 120 mm', note: ['测量搭箭点高度与 brace height。'] },
    'tool.tiller': { n: '磅数尺 Tiller Gauge', mat: '不锈钢', spec: '0–240 mm', note: ['测量上下弓片距离，用于调整 tiller。'] },
    'tool.serving': { n: '缠线卷 Serving Spool', mat: '涤纶线', spec: '100 m', note: [] },
    'tool.nockset': { n: '搭箭点钳 Nock Set Pliers', mat: '工具钢', spec: '90 mm', note: [] },
    'tool.sparenock': { n: '备用箭尾 Spare Nock', mat: '聚碳酸酯', spec: '×3', note: [] }
  };

  /* apply metadata + group colours */
  for (var i = 0; i < STATE.objs.length; i++) {
    var o = STATE.objs[i];
    var m = M[o.g.name];
    if (!m) { m = { n: o.g.name, mat: '—', spec: '—', note: [] }; }
    o.part = m.n;
    o.partEn = m.n2 || '';
    o.mat = m.mat;
    o.spec = m.spec;
    o.note = m.note || [];
  }
  /* multi-instance parts get a quantity suffix */
  var counts = {};
  for (i = 0; i < STATE.objs.length; i++) {
    var nm = STATE.objs[i].g.name;
    counts[nm] = (counts[nm] || 0) + 1;
  }
  for (i = 0; i < STATE.objs.length; i++) {
    var oo = STATE.objs[i];
    oo.qty = counts[oo.g.name];
  }
};
})();
