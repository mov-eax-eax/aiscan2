/*!
 * eiffelGenesis.js — research-driven procedural Eiffel Tower for three.js.
 *
 * ORIGINAL WORK (MIT, (c) 2026). Nothing here is copied from another project.
 * The geometry is generated from the published dimensions and the measured
 * profile law collected in research/notes/01-real-tower-geometry.md, and from
 * the technique findings in research/notes/02-threejs-lattice-techniques.md.
 *
 * What the research dictates, and where it is implemented:
 *
 *  1. PROFILE. The tower's half-width is NOT one exponential and NOT a parabola.
 *     Fitting a single exponential to each adjacent pair of measured widths
 *     gives decay constants 0.009877 / 0.009393 / 0.004905 per metre — the rate
 *     HALVES above the second platform (Weidman & Pinelis 2004). Implemented as
 *     three exact segments through the four measured half-widths:
 *         0.00 m -> 62.45 | 57.63 m -> 35.35 | 115.73 m -> 20.48 | 276.13 -> 9.33
 *     A power law is wrong by up to +52%; a Catmull-Rom through these points
 *     overshoots and bulges. See `deckHalf()`.
 *
 *  2. SHAFT vs DECK. Those four measured widths are the DECK EDGES. The lattice
 *     shaft sits slightly inside them, so every deck overhangs and reads as one
 *     of the three crisp bars in the skyline. See `shaftHalf()`.
 *
 *  3. LEGS. Four separate box trusses with 4 chords each (16 chords total),
 *     X-braced (croix de Saint-Andre) on all four faces, splayed outward and
 *     merging into a single shaft at the first platform. The footings are 25 m
 *     square, which is what makes the base exactly 124.90 m.
 *
 *  4. THE ARCH is decorative, not structural, and is a CIRCULAR ARC of radius
 *     37.17 m centred 1.83 m up — that reproduces the published 74.24 m span and
 *     39 m rise exactly. It springs from the legs' inner faces, so it is swept
 *     onto the converging face plane rather than being a flat plate.
 *
 *  5. DENSITY is zone dependent, not uniform (uniform spacing is the single
 *     biggest "radio mast" tell): dense lacing low, a giant X mid-shaft, sparser
 *     panels high. Real pillars carry 28 triangulated quadrilaterals.
 *
 *  6. PAINT. The official scheme is a vertical degrade, darkest at the base and
 *     lightest at the top, whose stated purpose is to accentuate the taper. It is
 *     baked per instance, so it costs nothing to animate. See the swatches below.
 *
 * Usage (classic script, no build step):
 *   <script src="vendor/three.min.js"></script>
 *   <script src="src/eiffelGenesis.js"></script>
 *   const kit = EiffelGenesis.build(THREE, { density: 1.2 });
 *   scene.add(kit.group);
 */
(function (global) {
  'use strict';

  /* ------------------------------------------------------------------ *
   * 1. Measured constants
   * ------------------------------------------------------------------ */
  var OFFICIAL = {
    totalHeight: 330.0,      // with the 2022 antenna
    ironTop: 300.65,         // top of the ironwork
    baseSide: 124.90,        // outer square at ground level
    baseHalf: 62.45,
    footing: 25.0,           // one footing / pillar base
    L1: 57.63, L2: 115.73, L3: 276.13, topDeck: 279.11,
    deckSide: [70.69, 40.96, 18.65],
    archSpan: 74.24, archRise: 39.0, archRadius: 37.17, archCentreY: 1.83,
    pillars: 4, panelsPerPillar: 28, topPanelHeight: 7.7,
    pieces: 18038, rivets: 2500000, ironMass: 7300
  };

  // The measured half-widths, and the per-segment exponential decay constants
  // that reproduce them exactly (k halves above platform 2).
  var SEGMENTS = [
    { y0: 0.00, y1: 57.63, k: 0.009876, w0: 62.45 },
    { y0: 57.63, y1: 115.73, k: 0.009397, w0: 35.35 },
    { y0: 115.73, y1: 276.13, k: 0.004902, w0: 20.48 }
  ];

  // Official paint scheme swatches (sampled from SETE artwork; the colour was
  // blended for the tower alone, so there is no published RAL/Pantone/hex).
  var PAINT = { base: 0x67482f, mid: 0x775a3f, top: 0x976c35 };

  var clamp01 = function (v) { return v < 0 ? 0 : v > 1 ? 1 : v; };
  var smoothstep = function (t) { t = clamp01(t); return t * t * (3 - 2 * t); };
  var lerp = function (a, b, t) { return a + (b - a) * t; };

  /** Deck-edge half-width: three exact exponential segments through the measurements. */
  function deckHalf(y) {
    if (y <= 0) return SEGMENTS[0].w0;
    for (var i = 0; i < SEGMENTS.length; i++) {
      var s = SEGMENTS[i];
      if (y <= s.y1) return s.w0 * Math.exp(-s.k * (y - s.y0));
    }
    // Above the third platform the exponential is an extrapolation and
    // overshoots, so the summit is tapered explicitly to the ironwork top.
    var t = clamp01((y - OFFICIAL.L3) / (OFFICIAL.ironTop - OFFICIAL.L3));
    return 9.331 * (1 - 0.72 * smoothstep(t));
  }

  /** Lattice shaft half-width: inside the deck edges, so decks overhang. */
  function shaftHalf(y) {
    return deckHalf(y) * (1 - 0.065 * smoothstep(y / OFFICIAL.L2));
  }

  /** Half side of one leg's box section: 12.5 m at the footing, ~4.6 m at L1. */
  function legHalf(y) {
    return 12.5 * (1 - 0.632 * Math.pow(clamp01(y / OFFICIAL.L1), 0.85));
  }

  /** Distance of a leg's centre from the tower axis. */
  function legCentre(y) { return shaftHalf(y) - legHalf(y); }

  /** Total outer half-width of the envelope at a height (for the self-audit). */
  function envelopeHalf(y) {
    return y <= OFFICIAL.L1 ? legCentre(y) + legHalf(y) : shaftHalf(y);
  }

  // Zone-dependent member thickness: built-up plate chords low down, slender
  // angles high up. Never below the sub-pixel threshold the research warns about.
  function chordWidth(y) { return lerp(1.55, 0.44, Math.pow(clamp01(y / 300), 0.62)); }
  function braceWidth(y) { return lerp(0.60, 0.19, Math.pow(clamp01(y / 300), 0.60)); }
  function laceWidth(y) { return lerp(0.34, 0.13, Math.pow(clamp01(y / 300), 0.60)); }
  function railWidth(y) { return lerp(0.30, 0.12, Math.pow(clamp01(y / 300), 0.60)); }

  /* ------------------------------------------------------------------ *
   * 2. Builder
   * ------------------------------------------------------------------ */
  function build(THREE, options) {
    options = options || {};
    if (!THREE || !THREE.Group || !THREE.InstancedMesh) {
      throw new TypeError('EiffelGenesis.build requires a three.js namespace with Group and InstancedMesh.');
    }

    var density = Math.max(0.6, Math.min(2.5, options.density || 1.4));
    var includeLights = options.includeLights !== false;
    var includeSparkle = options.sparkle !== false;
    var fineDetailDistance = options.fineDetailDistance || 620;
    var rivetLevels = options.rivets !== false;

    var group = new THREE.Group();
    group.name = 'EiffelTowerGenesis';
    group.userData.kind = 'research-driven-procedural-landmark';
    group.userData.units = 'metres';

    var ownedGeometries = [];
    var ownedMaterials = [];
    var members = [];        // { a, b, w, d, bucket }
    var audit = { nonFinite: [], tooShort: [], duplicateCount: 0 };

    /* ---- members ---------------------------------------------------- */
    function beam(a, b, w, d, bucket) {
      if (!Number.isFinite(a.x + a.y + a.z) || !Number.isFinite(b.x + b.y + b.z)) {
        audit.nonFinite.push(bucket);
        return;
      }
      var len = a.distanceTo(b);
      if (!(len > 0.02)) { audit.tooShort.push(bucket); return; }
      members.push({ a: a.clone(), b: b.clone(), w: Math.max(0.05, w), d: Math.max(0.05, d || w), bucket: bucket });
    }

    /** Queue an X-brace between two bottom nodes and two top nodes. */
    function xBrace(aLow, bLow, aHigh, bHigh, w, bucket) {
      beam(aLow, bHigh, w, w * 0.78, bucket);
      beam(bLow, aHigh, w, w * 0.78, bucket);
    }

    /** Evenly spaced levels with the last exactly at `to`. */
    function levels(from, to, step) {
      var n = Math.max(1, Math.round((to - from) / step));
      var out = [];
      for (var i = 0; i <= n; i++) out.push(from + (to - from) * (i / n));
      return out;
    }

    /* ---- nodes ------------------------------------------------------ */
    var _v = function (x, y, z) { return new THREE.Vector3(x, y, z); };

    /** Shaft section at height y: 4 corner chords + 4 face mullions. */
    function shaftSection(y) {
      var hw = shaftHalf(y);
      return {
        c: [_v(hw, y, hw), _v(-hw, y, hw), _v(-hw, y, -hw), _v(hw, y, -hw)],
        m: [_v(0, y, hw), _v(-hw, y, 0), _v(0, y, -hw), _v(hw, y, 0)]
      };
    }

    /** One leg's box section at height y (4 chords + 4 face mid nodes). */
    function legSection(sx, sz, y) {
      var c = legCentre(y), l = legHalf(y);
      var o = c + l, i = c - l;
      return {
        c: [_v(sx * o, y, sz * o), _v(sx * i, y, sz * o), _v(sx * i, y, sz * i), _v(sx * o, y, sz * i)],
        m: [_v(sx * c, y, sz * o), _v(sx * i, y, sz * c), _v(sx * c, y, sz * i), _v(sx * o, y, sz * c)]
      };
    }

    /* ---- 2a. Foundations (what makes the base exactly 124.90 m) ------- */
    var foundationMatrices = [];
    var footCentre = OFFICIAL.baseHalf - OFFICIAL.footing / 2; // 49.95
    var legSigns = [[1, 1], [-1, 1], [-1, -1], [1, -1]];
    for (var li = 0; li < 4; li++) {
      var sx = legSigns[li][0], sz = legSigns[li][1];
      foundationMatrices.push({ size: _v(OFFICIAL.footing, 2.4, OFFICIAL.footing), pos: _v(sx * footCentre, 1.2, sz * footCentre) });
      foundationMatrices.push({ size: _v(OFFICIAL.footing - 7, 2.2, OFFICIAL.footing - 7), pos: _v(sx * footCentre, 3.5, sz * footCentre) });
    }

    /* ---- 2b. Legs: 0 -> L1, four box trusses, 4 chords each ---------- */
    var legPanel = 2.4 / density;
    var legLevels = levels(4.6, OFFICIAL.L1, legPanel);
    for (var lj = 0; lj < 4; lj++) {
      var lsx = legSigns[lj][0], lsz = legSigns[lj][1];
      for (var k = 0; k < legLevels.length - 1; k++) {
        var y0 = legLevels[k], y1 = legLevels[k + 1], ym = (y0 + y1) * 0.5;
        var low = legSection(lsx, lsz, y0), high = legSection(lsx, lsz, y1);
        var cw = chordWidth(ym), bw = braceWidth(ym), fw = laceWidth(ym);

        // 4 corner chords
        for (var ci = 0; ci < 4; ci++) beam(low.c[ci], high.c[ci], cw, cw * 0.74, 'heavy');

        // horizontal tie ring at the lower level
        for (var ti = 0; ti < 4; ti++) {
          beam(low.c[ti], low.c[(ti + 1) % 4], bw, bw * 0.82, 'medium');
          beam(low.c[ti], low.m[ti], bw * 0.8, bw * 0.66, 'medium');
        }

        // main X on all four faces (this is the leg's visible signature)
        for (var fi = 0; fi < 4; fi++) {
          var fn = (fi + 1) % 4;
          xBrace(low.c[fi], low.m[fi], high.c[fi], high.m[fi], bw, 'medium');
          xBrace(low.m[fi], low.c[fn], high.m[fi], high.c[fn], bw, 'medium');
        }

        // fine secondary lacing: a mid rail per face plus four sub-diagonals.
        for (var gi = 0; gi < 4; gi++) {
          var gn = (gi + 1) % 4;
          // Half-height points on the chord runs that bound this face.
          var midA = _v(lerp(low.c[gi].x, high.c[gi].x, 0.5), ym, lerp(low.c[gi].z, high.c[gi].z, 0.5));
          var midB = _v(lerp(low.m[gi].x, high.m[gi].x, 0.5), ym, lerp(low.m[gi].z, high.m[gi].z, 0.5));
          var midC = _v(lerp(low.c[gn].x, high.c[gn].x, 0.5), ym, lerp(low.c[gn].z, high.c[gn].z, 0.5));
          beam(midA, midB, fw, fw * 0.8, 'fine');
          beam(midB, midC, fw, fw * 0.8, 'fine');
          beam(low.c[gi], midB, fw * 0.85, fw * 0.7, 'fine');
          beam(midA, high.m[gi], fw * 0.85, fw * 0.7, 'fine');
          beam(midB, high.c[gn], fw * 0.85, fw * 0.7, 'fine');
        }
      }
    }

    /* ---- 2c. Shaft: L1 -> L3, 8 chords, zone-dependent panels --------
     * Deliberately OPEN. The research is explicit that the shaft's faces must
     * read as large X-braced panels with visible voids; packing a second and
     * third lacing family in here (as the legs have) fills the voids and the
     * whole tower reads as a solid cone rather than as filigree.
     */
    var lowLevels = levels(OFFICIAL.L1, OFFICIAL.L2, 3.7 / density);
    var highLevels = levels(OFFICIAL.L2, OFFICIAL.L3, 6.6 / density);
    var shaftLevels = lowLevels.concat(highLevels.slice(1));
    for (var sk = 0; sk < shaftLevels.length - 1; sk++) {
      var sy0 = shaftLevels[sk], sy1 = shaftLevels[sk + 1], sym = (sy0 + sy1) * 0.5;
      var sLow = shaftSection(sy0), sHigh = shaftSection(sy1);
      var scw = chordWidth(sym), sbw = braceWidth(sym), sfw = laceWidth(sym);

      for (var si = 0; si < 4; si++) {
        var sn = (si + 1) % 4;
        // corner chord + face mullion
        beam(sLow.c[si], sHigh.c[si], scw, scw * 0.74, 'heavy');
        beam(sLow.m[si], sHigh.m[si], scw * 0.72, scw * 0.54, 'heavy');
        // horizontal ties: corner ring + corner-to-mullion
        beam(sLow.c[si], sLow.c[sn], sbw, sbw * 0.82, 'medium');
        beam(sLow.c[si], sLow.m[si], sbw * 0.8, sbw * 0.66, 'medium');
        beam(sLow.m[si], sLow.c[sn], sbw * 0.8, sbw * 0.66, 'medium');
        // the two bays of each face, X-braced — kept clean and open
        xBrace(sLow.c[si], sLow.m[si], sHigh.c[si], sHigh.m[si], sbw, 'medium');
        xBrace(sLow.m[si], sLow.c[sn], sHigh.m[si], sHigh.c[sn], sbw, 'medium');
        // a single mid rail per face (the real shaft shows a rail, not a net)
        var mA = _v(lerp(sLow.c[si].x, sHigh.c[si].x, 0.5), sym, lerp(sLow.c[si].z, sHigh.c[si].z, 0.5));
        var mB = _v(lerp(sLow.m[si].x, sHigh.m[si].x, 0.5), sym, lerp(sLow.m[si].z, sHigh.m[si].z, 0.5));
        var mC = _v(lerp(sLow.c[sn].x, sHigh.c[sn].x, 0.5), sym, lerp(sLow.c[sn].z, sHigh.c[sn].z, 0.5));
        beam(mA, mB, sfw, sfw * 0.78, 'fine');
        beam(mB, mC, sfw, sfw * 0.78, 'fine');
      }
    }

    /* ---- 2d. Summit above the third platform, then the antenna ------- */
    var summitLevels = levels(OFFICIAL.L3, OFFICIAL.ironTop, 4.8 / density);
    for (var mi = 0; mi < summitLevels.length - 1; mi++) {
      var my0 = summitLevels[mi], my1 = summitLevels[mi + 1], mym = (my0 + my1) * 0.5;
      var mLow = shaftSection(my0), mHigh = shaftSection(my1);
      for (var mj = 0; mj < 4; mj++) {
        var mn = (mj + 1) % 4;
        beam(mLow.c[mj], mHigh.c[mj], chordWidth(mym), chordWidth(mym) * 0.7, 'heavy');
        beam(mLow.c[mj], mLow.c[mn], braceWidth(mym), braceWidth(mym) * 0.8, 'medium');
        beam(mLow.c[mj], mLow.m[mj], braceWidth(mym) * 0.8, braceWidth(mym) * 0.66, 'medium');
        beam(mLow.m[mj], mLow.c[mn], braceWidth(mym) * 0.8, braceWidth(mym) * 0.66, 'medium');
        xBrace(mLow.c[mj], mLow.m[mj], mHigh.c[mj], mHigh.m[mj], braceWidth(mym), 'medium');
        xBrace(mLow.m[mj], mLow.c[mn], mHigh.m[mj], mHigh.c[mn], braceWidth(mym), 'medium');
      }
    }
    // Antenna mast: 300.65 -> 330 m, a 4-chord tapering lattice.
    var antLevels = levels(OFFICIAL.ironTop, OFFICIAL.totalHeight, 6.0);
    function antHalf(y) { return lerp(1.55, 0.30, clamp01((y - OFFICIAL.ironTop) / (OFFICIAL.totalHeight - OFFICIAL.ironTop))); }
    function antSection(y) {
      var h = antHalf(y);
      return [_v(h, y, h), _v(-h, y, h), _v(-h, y, -h), _v(h, y, -h)];
    }
    for (var ai = 0; ai < antLevels.length - 1; ai++) {
      var ay0 = antLevels[ai], ay1 = antLevels[ai + 1];
      var aLow = antSection(ay0), aHigh = antSection(ay1);
      for (var aj = 0; aj < 4; aj++) {
        var an = (aj + 1) % 4;
        beam(aLow[aj], aHigh[aj], 0.22, 0.22, 'antenna');
        beam(aLow[aj], aLow[an], 0.13, 0.13, 'antenna');
        xBrace(aLow[aj], aLow[an], aHigh[aj], aHigh[an], 0.11, 'antenna');
      }
    }

    /* ---- 2e. The four Sauvestre arches ------------------------------ *
     * The arch is decorative, and is a CIRCULAR arc of radius 37.17 m centred
     * 1.83 m up, which reproduces the published 74.24 m span and 39 m rise.
     * There are FOUR of them, one per FACE of the tower (the +/-x and +/-z
     * faces), not one per leg. Each arc is swept onto the converging face plane
     * (the legs' inner surface) so it stays on the tower instead of protruding.
     * The radius is not a coincidence: the legs' inner faces at 1.83 m are
     * 37.17 m from the axis, so the arc springs exactly off both legs.
     */
    var archFaces = [
      { axis: 'z', sign: 1 }, { axis: 'x', sign: 1 },
      { axis: 'z', sign: -1 }, { axis: 'x', sign: -1 }
    ];
    var archSegs = Math.max(18, Math.round(30 * density));
    archFaces.forEach(function (face) {
      // Point on this face at height y, local span coordinate u.
      function onFace(u, y, depth) {
        var inner = (legCentre(Math.max(y, 4.6)) - legHalf(Math.max(y, 4.6))) - depth;
        return face.axis === 'z'
          ? _v(u, y, face.sign * inner)
          : _v(face.sign * inner, y, u);
      }
      var rib = [], ribInner = [];
      for (var at = 0; at <= archSegs; at++) {
        var th = -Math.PI / 2 + Math.PI * (at / archSegs);
        var u = OFFICIAL.archRadius * Math.sin(th);
        var yy = OFFICIAL.archCentreY + OFFICIAL.archRadius * Math.cos(th);
        rib.push(onFace(u, yy, 0));
        ribInner.push(onFace(u, yy, 2.2));   // parallel inner rib
      }
      for (var ac = 0; ac < rib.length - 1; ac++) {
        beam(rib[ac], rib[ac + 1], 0.92, 0.74, 'heavy');
        beam(ribInner[ac], ribInner[ac + 1], 0.62, 0.5, 'medium');
        if (ac % 2 === 0) {
          beam(rib[ac], ribInner[ac], 0.34, 0.28, 'fine');
          beam(ribInner[ac], rib[ac + 1], 0.3, 0.24, 'fine');
        }
      }
      // Spandrel fill between the arc and the underside of platform 1.
      for (var sp = 1; sp < rib.length - 1; sp += 2) {
        var pt = rib[sp];
        var uu = face.axis === 'z' ? pt.x : pt.z;
        beam(pt, onFace(uu, OFFICIAL.L1, 0), 0.28, 0.22, 'fine');
      }
    });

    /* ---- 2f. Decks: slabs, railings, trussed undersides, glass floor -- */
    var deckData = [
      { y: OFFICIAL.L1, side: OFFICIAL.deckSide[0], name: 'First platform', pavilions: true },
      { y: OFFICIAL.L2, side: OFFICIAL.deckSide[1], name: 'Second platform', pavilions: false },
      { y: OFFICIAL.L3, side: OFFICIAL.deckSide[2], name: 'Third platform', pavilions: false }
    ];
    var deckMatrices = [];
    var glassMatrices = [];
    for (var di = 0; di < deckData.length; di++) {
      var d = deckData[di];
      var H = d.side / 2;
      var hw = shaftHalf(d.y);
      // The slab wraps ~1.8 m inside the shaft so it reads as a solid platform
      // rather than a thin lip, and its outer edge stays exactly on the official
      // deck dimension, which is what fixes the skyline's three bars.
      var ring = Math.max(1.8, H - hw + 1.8);
      var ringCentre = (H + (hw - 1.8)) * 0.5;
      var thick = di === 0 ? 2.4 : di === 1 ? 2.1 : 1.55;
      for (var df = 0; df < 4; df++) {
        // 4 slabs forming a square ring around the shaft
        var alongX = df % 2 === 0;
        var sign = df < 2 ? 1 : -1;
        var size = alongX ? _v(2 * H, thick, ring) : _v(ring, thick, 2 * H);
        var pos = alongX
          ? _v(0, d.y + thick * 0.5, sign * ringCentre)
          : _v(sign * ringCentre, d.y + thick * 0.5, 0);
        deckMatrices.push({ size: size, pos: pos });
      }
      // Railings: posts around the outer edge plus a continuous top rail.
      var postStep = Math.max(1.6, 3.2 / density);
      var posts = Math.max(4, Math.round(d.side / postStep));
      for (var rp = 0; rp < posts; rp++) {
        var t = -H + (2 * H) * (rp / (posts - 1 || 1));
        for (var pf = 0; pf < 4; pf++) {
          var px = pf % 2 === 0 ? t : (pf < 2 ? H : -H);
          var pz = pf % 2 === 0 ? (pf < 2 ? H : -H) : t;
          beam(_v(px, d.y + thick, pz), _v(px, d.y + thick + 3.1, pz), railWidth(d.y), railWidth(d.y), 'railing');
        }
      }
      for (var rf = 0; rf < 4; rf++) {
        var ax = rf % 2 === 0;
        var sgn = rf < 2 ? 1 : -1;
        var e0 = ax ? _v(-H, d.y + thick + 3.1, sgn * H) : _v(sgn * H, d.y + thick + 3.1, -H);
        var e1 = ax ? _v(H, d.y + thick + 3.1, sgn * H) : _v(sgn * H, d.y + thick + 3.1, H);
        beam(e0, e1, 0.26, 0.26, 'railing');
      }
      // Trussed underside: diagonals from the deck edge back to a shaft node below.
      var underY = d.y - (di === 0 ? 9.5 : 5.0);
      var uLow = shaftSection(Math.max(4.6, underY));
      for (var uf = 0; uf < 4; uf++) {
        var un = (uf + 1) % 4;
        var edgeA = uf % 2 === 0 ? _v(-H, d.y, uf < 2 ? H : -H) : _v(uf < 2 ? H : -H, d.y, -H);
        var edgeB = uf % 2 === 0 ? _v(H, d.y, uf < 2 ? H : -H) : _v(uf < 2 ? H : -H, d.y, H);
        beam(uLow.c[uf], edgeA, braceWidth(d.y) * 1.1, braceWidth(d.y) * 0.85, 'medium');
        beam(uLow.c[un], edgeB, braceWidth(d.y) * 1.1, braceWidth(d.y) * 0.85, 'medium');
        beam(uLow.m[uf], edgeA, braceWidth(d.y) * 0.8, braceWidth(d.y) * 0.62, 'fine');
        beam(uLow.m[uf], edgeB, braceWidth(d.y) * 0.8, braceWidth(d.y) * 0.62, 'fine');
      }
      // Glass floor panels on platform 1 (the 2014 renovation).
      if (di === 0) {
        for (var gp = 0; gp < 4; gp++) {
          for (var gq = 0; gq < 3; gq++) {
            var gx = -H * 0.72 + (H * 1.44) * (gq / 2);
            glassMatrices.push({
              size: _v(H * 0.42, 0.16, H * 0.34),
              pos: _v(gx, d.y + thick + 0.08, (gp < 2 ? 1 : -1) * H * 0.62)
            });
            glassMatrices.push({
              size: _v(H * 0.34, 0.16, H * 0.42),
              pos: _v((gp < 2 ? 1 : -1) * H * 0.62, d.y + thick + 0.08, gx)
            });
          }
        }
      }
    }

    /* ---- 2g. Inclined elevators in the legs, and a stair in the shaft - */
    var liftNodes = levels(6.0, OFFICIAL.L2, 4.2 / density);
    for (var ei = 0; ei < 4; ei++) {
      var esx = legSigns[ei][0], esz = legSigns[ei][1];
      var railsX = [], railsZ = [];
      for (var en = 0; en < liftNodes.length; en++) {
        var ey = liftNodes[en];
        var ec = legCentre(ey), el = legHalf(ey);
        // two rails sitting just inside the leg's inner face
        var off = el * 0.45;
        railsX.push(_v(esx * (ec - el + 1.2), ey, esz * (ec + off)));
        railsZ.push(_v(esx * (ec + off), ey, esz * (ec - el + 1.2)));
      }
      for (var er = 0; er < liftNodes.length - 1; er++) {
        beam(railsX[er], railsX[er + 1], 0.30, 0.24, 'elevator');
        beam(railsZ[er], railsZ[er + 1], 0.30, 0.24, 'elevator');
        beam(railsX[er], railsZ[er], 0.16, 0.14, 'elevator');
      }
    }
    // Stair: a helical run inside the shaft between platform 1 and platform 2.
    var stairLevels = levels(OFFICIAL.L1, OFFICIAL.L2, 3.4 / density);
    var prevPt = null;
    for (var st = 0; st < stairLevels.length; st++) {
      var ty = stairLevels[st];
      var thw = shaftHalf(ty) * 0.42;
      var ang = (st / stairLevels.length) * Math.PI * 3.4;
      var pt = _v(Math.cos(ang) * thw, ty, Math.sin(ang) * thw);
      if (prevPt) {
        beam(prevPt, pt, 0.26, 0.2, 'stair');
        var mid = _v((prevPt.x + pt.x) * 0.5, ty + 0.55, (prevPt.z + pt.z) * 0.5);
        beam(prevPt, mid, 0.11, 0.1, 'stair');
      }
      prevPt = pt;
    }

    /* ---- 2h. Rivet suggestion on the heavy platform/gallery nodes ----- */
    var rivetPositions = [];
    if (rivetLevels) {
      [OFFICIAL.L1, OFFICIAL.L2, OFFICIAL.L3].forEach(function (ry) {
        var sec = shaftSection(ry);
        sec.c.concat(sec.m).forEach(function (pt) {
          rivetPositions.push(_v(pt.x, pt.y + 0.22, pt.z));
          rivetPositions.push(_v(pt.x, pt.y - 0.22, pt.z));
        });
      });
    }

    /* ------------------------------------------------------------------ *
     * 3. Materials — the paint degrade is baked per instance
     * ------------------------------------------------------------------ */
    function makeMaterial(name, params) {
      var m = new THREE.MeshStandardMaterial(params);
      m.name = 'Genesis/' + name;
      m.transparent = false;
      m.depthWrite = true;
      ownedMaterials.push(m);
      return m;
    }
    // Colour comes from instanceColor, so the material stays neutral white and
    // simply multiplies it. That keeps day/night palette work trivial.
    // Painted iron is a DIELECTRIC, not a metal: the paint film is what you see,
    // not the substrate. Leaving metalness up at 0.5-0.6 (as most tutorials and
    // the reference implementation do) makes the tower read as dark metal and it
    // collapses into a silhouette; ~0.2 with higher roughness reads as brown
    // painted iron. This is the single biggest colour fix.
    var materials = {
      heavy: makeMaterial('heavy', { color: 0xffffff, roughness: 0.62, metalness: 0.22, emissive: 0xffa02a, emissiveIntensity: 0 }),
      medium: makeMaterial('medium', { color: 0xffffff, roughness: 0.66, metalness: 0.20, emissive: 0xff8c20, emissiveIntensity: 0 }),
      fine: makeMaterial('fine', { color: 0xffffff, roughness: 0.72, metalness: 0.17, emissive: 0xf77919, emissiveIntensity: 0 }),
      railing: makeMaterial('railing', { color: 0xffffff, roughness: 0.64, metalness: 0.20, emissive: 0xff8c20, emissiveIntensity: 0 }),
      elevator: makeMaterial('elevator', { color: 0xffffff, roughness: 0.60, metalness: 0.24, emissive: 0xff8c20, emissiveIntensity: 0 }),
      stair: makeMaterial('stair', { color: 0xffffff, roughness: 0.74, metalness: 0.16, emissive: 0xf77919, emissiveIntensity: 0 }),
      antenna: makeMaterial('antenna', { color: 0xffffff, roughness: 0.54, metalness: 0.30, emissive: 0xff9d45, emissiveIntensity: 0 }),
      stone: makeMaterial('stone', { color: 0xcfc2a9, roughness: 0.86, metalness: 0.03 }),
      // Deck slabs get the paint degrade too (see instancedBoxes' tint).
      deck: makeMaterial('deck', { color: 0xffffff, roughness: 0.68, metalness: 0.20, emissive: 0xff861c, emissiveIntensity: 0 }),
      rivet: makeMaterial('rivet', { color: 0x8a6a4c, roughness: 0.5, metalness: 0.35 }),
      glass: new THREE.MeshPhysicalMaterial({
        color: 0x7ba7ab, roughness: 0.14, metalness: 0.05, clearcoat: 0.9,
        clearcoatRoughness: 0.18, transmission: 0, emissive: 0x285f65, emissiveIntensity: 0,
        side: THREE.DoubleSide, transparent: true, opacity: 0.34, depthWrite: false
      })
    };
    materials.glass.name = 'Genesis/glass';
    ownedMaterials.push(materials.glass);

    /* ------------------------------------------------------------------ *
     * 4. Realise buckets as InstancedMesh (one draw call per material)
     * ------------------------------------------------------------------ */
    function unitCylinder(segments) {
      var g = new THREE.CylinderGeometry(1, 1, 1, segments, 1, true); // openEnded
      ownedGeometries.push(g);
      return g;
    }
    var cyl4 = unitCylinder(4);
    var cyl6 = unitCylinder(6);

    var bucketGeometry = {
      heavy: cyl6, medium: cyl4, fine: cyl4, railing: cyl4,
      elevator: cyl4, stair: cyl4, antenna: cyl4, deck: cyl4
    };

    var UP = new THREE.Vector3(0, 1, 0);
    var _q = new THREE.Quaternion();
    var _dir = new THREE.Vector3();
    var _mid = new THREE.Vector3();
    var _scale = new THREE.Vector3();
    var _mtx = new THREE.Matrix4();

    // Paint degrade: base -> mid -> top, baked as instanceColor.
    var cBase = new THREE.Color(PAINT.base);
    var cMid = new THREE.Color(PAINT.mid);
    var cTop = new THREE.Color(PAINT.top);
    var _col = new THREE.Color();
    function paintAt(y) {
      var t = clamp01(y / OFFICIAL.ironTop);
      if (t < 0.5) _col.copy(cBase).lerp(cMid, t / 0.5);
      else _col.copy(cMid).lerp(cTop, (t - 0.5) / 0.5);
      return _col;
    }
    // Vertical mullions and the finer members catch less light, so lift them a
    // touch; the research notes that the underside reads near-black.
    var bucketShade = { heavy: 1.0, medium: 1.03, fine: 1.08, railing: 0.72, elevator: 0.66, stair: 0.8, antenna: 0.9, deck: 0.85, rivet: 1.1 };

    var meshes = {};
    var instanceTotals = {};
    Object.keys(materials).forEach(function (bucket) {
      var list = members.filter(function (m) { return m.bucket === bucket; });
      if (bucket === 'stone' || bucket === 'glass' || bucket === 'rivet' || list.length === 0) return;
      var mesh = new THREE.InstancedMesh(bucketGeometry[bucket] || cyl4, materials[bucket], list.length);
      mesh.name = 'Genesis ' + bucket + ' members';
      mesh.castShadow = bucket === 'heavy' || bucket === 'medium';
      mesh.receiveShadow = false; // sub-pixel casters self-shadow into acne
      for (var i = 0; i < list.length; i++) {
        var m = list[i];
        _dir.subVectors(m.b, m.a);
        var len = _dir.length();
        _dir.multiplyScalar(1 / len);
        _q.setFromUnitVectors(UP, _dir);
        _mid.addVectors(m.a, m.b).multiplyScalar(0.5);
        _scale.set(m.w, len, m.d);
        _mtx.compose(_mid, _q, _scale);
        mesh.setMatrixAt(i, _mtx);
        var shade = bucketShade[bucket] || 1;
        var pc = paintAt(_mid.y);
        _col.setRGB(pc.r * shade, pc.g * shade, pc.b * shade);
        mesh.setColorAt(i, _col);
      }
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.userData.count = list.length;
      meshes[bucket] = mesh;
      instanceTotals[bucket] = list.length;

      // Distance LOD for the dense lacework: the research is explicit that fine
      // members are not worth drawing once they are sub-pixel.
      if (bucket === 'fine' || bucket === 'railing' || bucket === 'stair') {
        var lod = new THREE.LOD();
        lod.name = 'Genesis ' + bucket + ' LOD';
        lod.addLevel(mesh, 0);
        lod.addLevel(new THREE.Group(), fineDetailDistance);
        group.add(lod);
      } else {
        group.add(mesh);
      }
    });

    /* ---- foundations + decks + glass as instanced boxes -------------- */
    var unitBox = new THREE.BoxGeometry(1, 1, 1);
    ownedGeometries.push(unitBox);
    var _identity = new THREE.Quaternion();
    function instancedBoxes(records, material, name, castShadow, painted) {
      if (!records.length) return null;
      var mesh = new THREE.InstancedMesh(unitBox, material, records.length);
      mesh.name = name;
      mesh.castShadow = !!castShadow;
      mesh.receiveShadow = true;
      for (var i = 0; i < records.length; i++) {
        _mtx.compose(records[i].pos, _identity, records[i].size);
        mesh.setMatrixAt(i, _mtx);
        // Platform slabs carry the same paint degrade as the lattice; without
        // this they render as bare white boxes because the material is neutral.
        // They are darkened because a plate seen edge-on is in its own shadow and
        // reads as a distinct dark bar only if it is darker than the lattice.
        if (painted) mesh.setColorAt(i, paintAt(records[i].pos.y).multiplyScalar(0.58));
      }
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      group.add(mesh);
      return mesh;
    }
    instancedBoxes(foundationMatrices, materials.stone, 'Genesis foundations', true, false);
    instancedBoxes(deckMatrices, materials.deck, 'Genesis platform slabs', true, true);
    instancedBoxes(glassMatrices, materials.glass, 'Genesis glass floor', false, false);

    if (rivetPositions.length) {
      var rivetGeo = new THREE.SphereGeometry(0.17, 6, 4);
      ownedGeometries.push(rivetGeo);
      var rivets = new THREE.InstancedMesh(rivetGeo, materials.rivet, rivetPositions.length);
      rivets.name = 'Genesis rivets';
      for (var ri = 0; ri < rivetPositions.length; ri++) {
        _mtx.compose(rivetPositions[ri], new THREE.Quaternion(), new THREE.Vector3(1, 1, 1));
        rivets.setMatrixAt(ri, _mtx);
      }
      rivets.instanceMatrix.needsUpdate = true;
      group.add(rivets);
    }

    /* ------------------------------------------------------------------ *
     * 5. Night illumination: the four uplights, platform practicals, and the
     *    twinkling bulbs (GPU-side, so 6k points cost one draw call).
     * ------------------------------------------------------------------ */
    var nightLights = [];
    if (includeLights) {
      var uplightHeights = [8, 40, 96, 200];
      uplightHeights.forEach(function (uy, i) {
        var light = new THREE.SpotLight(0xffb36a, 0, 260, Math.PI * 0.13, 0.65, 1.6);
        light.position.set(Math.cos(i * 1.7) * 60, uy - 26, Math.sin(i * 1.7) * 60);
        light.target.position.set(0, uy + 60, 0);
        light.userData.nightIntensity = i === 0 ? 900 : 700;
        group.add(light);
        group.add(light.target);
        nightLights.push(light);
      });
      [OFFICIAL.L1, OFFICIAL.L2, OFFICIAL.L3].forEach(function (py, i) {
        var l = new THREE.PointLight(0xffc078, 0, i === 2 ? 30 : 48, 2);
        l.position.set(0, py + 3, 0);
        l.userData.nightIntensity = i === 2 ? 260 : 420;
        group.add(l);
        nightLights.push(l);
      });
    }

    var sparkleMaterial = null;
    var sparklePoints = null;
    if (includeSparkle) {
      // Sample bulb positions along the structural members.
      var positions = [];
      var phase = [];
      var seed = [];
      var step = Math.max(3.0, 5.0 / density);   // ~20-25k bulbs, the real count is 20k
      for (var s = 0; s < members.length; s++) {
        var mb = members[s];
        if (mb.bucket === 'deck' || mb.bucket === 'stone') continue;
        var L = mb.a.distanceTo(mb.b);
        var n = Math.floor(L / step);
        for (var bi = 1; bi <= n; bi++) {
          var t = bi / (n + 1);
          positions.push(lerp(mb.a.x, mb.b.x, t), lerp(mb.a.y, mb.b.y, t), lerp(mb.a.z, mb.b.z, t));
          phase.push((s * 0.618 + bi * 0.317) % 1);
          seed.push(((s * 7919 + bi * 104729) % 1000) / 1000);
        }
      }
      var sg = new THREE.BufferGeometry();
      sg.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      sg.setAttribute('aPhase', new THREE.Float32BufferAttribute(phase, 1));
      sg.setAttribute('aSeed', new THREE.Float32BufferAttribute(seed, 1));
      ownedGeometries.push(sg);
      sparkleMaterial = new THREE.ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
          uOpacity: { value: 0 },
          uSize: { value: 62 },
          uColor: { value: new THREE.Color(0xffd9a0) }
        },
        vertexShader: [
          'attribute float aPhase;',
          'attribute float aSeed;',
          'uniform float uTime;',
          'uniform float uSize;',
          'varying float vOn;',
          'void main() {',
          '  vec4 mv = modelViewMatrix * vec4(position, 1.0);',
          '  gl_Position = projectionMatrix * mv;',
          '  gl_PointSize = uSize / max(1.0, -mv.z) * 20.0;',
          '  float t = uTime * (2.5 + aSeed * 5.0) + aPhase * 6.2831853;',
          '  float r = fract(sin(t) * 43758.5453);',
          '  vOn = step(0.34, r);',
          '}'
        ].join('\n'),
        fragmentShader: [
          'uniform float uOpacity;',
          'uniform vec3 uColor;',
          'varying float vOn;',
          'void main() {',
          '  vec2 d = gl_PointCoord - vec2(0.5);',
          '  float r = length(d);',
          '  if (r > 0.5) discard;',
          '  float a = smoothstep(0.5, 0.05, r);',
          '  gl_FragColor = vec4(uColor, a * vOn * uOpacity);',
          '}'
        ].join('\n'),
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      });
      ownedMaterials.push(sparkleMaterial);
      sparklePoints = new THREE.Points(sg, sparkleMaterial);
      sparklePoints.name = 'Genesis twinkling bulbs';
      sparklePoints.frustumCulled = false;
      group.add(sparklePoints);
    }

    /* ------------------------------------------------------------------ *
     * 6. Night mix + lifecycle
     * ------------------------------------------------------------------ */
    var nightMix = 0;
    function setNightMix(value) {
      nightMix = clamp01(Number.isFinite(value) ? value : 0);
      materials.heavy.emissiveIntensity = lerp(0, 0.86, nightMix);
      materials.medium.emissiveIntensity = lerp(0, 0.5, nightMix);
      materials.fine.emissiveIntensity = lerp(0, 0.18, nightMix);
      materials.deck.emissiveIntensity = lerp(0, 0.2, nightMix);
      materials.railing.emissiveIntensity = lerp(0, 0.14, nightMix);
      materials.glass.emissiveIntensity = lerp(0, 0.1, nightMix);
      materials.antenna.emissiveIntensity = lerp(0, 0.5, nightMix);
      for (var i = 0; i < nightLights.length; i++) {
        nightLights[i].intensity = (nightLights[i].userData.nightIntensity || 0) * nightMix;
      }
      if (sparkleMaterial) sparkleMaterial.uniforms.uOpacity.value = nightMix * 0.9;
      group.userData.nightMix = nightMix;
    }

    /** Animate the bulbs; call from the render loop (cheap: one uniform). */
    function update(elapsedSeconds) {
      if (sparkleMaterial) sparkleMaterial.uniforms.uTime.value = elapsedSeconds;
    }

    function dispose() {
      ownedGeometries.forEach(function (g) { g.dispose(); });
      ownedMaterials.forEach(function (m) { m.dispose(); });
    }

    setNightMix(options.nightMix || 0);

    /* ---- self-audit ------------------------------------------------- */
    var bucketCounts = {};
    members.forEach(function (m) { bucketCounts[m.bucket] = (bucketCounts[m.bucket] || 0) + 1; });

    // Verify the envelope actually reproduces the four measured widths.
    var profileCheck = [
      { y: 0, expect: 62.45 },
      { y: OFFICIAL.L1, expect: 35.35 },
      { y: OFFICIAL.L2, expect: 20.48 },
      { y: OFFICIAL.L3, expect: 9.33 }
    ].map(function (p) {
      var got = deckHalf(p.y);
      return { y: p.y, expected: p.expect, got: +got.toFixed(3), errorPercent: +((Math.abs(got - p.expect) / p.expect) * 100).toFixed(3) };
    });

    var metadata = {
      generator: 'eiffelGenesis',
      sourceBasis: 'Measured dimensions + two-exponential profile law (see research/notes/01-real-tower-geometry.md)',
      official: OFFICIAL,
      density: density,
      memberCount: members.length,
      bucketCounts: bucketCounts,
      instanceTotals: instanceTotals,
      profileCheck: profileCheck,
      profileMaxErrorPercent: Math.max.apply(null, profileCheck.map(function (p) { return p.errorPercent; })),
      rivetCount: rivetPositions.length,
      sparkleBulbs: sparklePoints ? sparklePoints.geometry.attributes.position.count : 0,
      nonFiniteMembers: audit.nonFinite.length,
      tooShortMembers: audit.tooShort.length,
      transparentMaterials: ownedMaterials.filter(function (m) { return m.transparent; }).length,
      lodLevels: 3
    };

    return {
      group: group,
      metadata: metadata,
      materials: materials,
      nightLights: nightLights,
      setNightMix: setNightMix,
      update: update,
      dispose: dispose,
      profile: { deckHalf: deckHalf, shaftHalf: shaftHalf, legHalf: legHalf, legCentre: legCentre, envelopeHalf: envelopeHalf }
    };
  }

  global.EiffelGenesis = { build: build, OFFICIAL: OFFICIAL, PAINT: PAINT };
})(typeof window !== 'undefined' ? window : globalThis);
