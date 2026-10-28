// ============================================================================
// DualSense Ontology Atlas - SVG projection renderer
// Orthographic sheet (face / top edge / side) + interactive object-orbit view.
// ============================================================================
(function () {
  "use strict";
  const G = window.DSA_GEOM, O = window.ONTOLOGY;
  const byId = G.byId;

  const SHEET = {
    face: { x: 60, y: 112, w: 860, h: 800, cx: 0, cy: 53, uw: 190, uh: 134, label: "A / FACE - PLAN" },
    edge: { x: 980, y: 112, w: 640, h: 300, cx: 0, cy: 21, uw: 180, uh: 100, label: "B / TOP EDGE" },
    side: { x: 980, y: 452, w: 640, h: 420, cx: 53, cy: 21, uw: 132, uh: 100, label: "C / SIDE" },
  };
  const VIEW_BASIS = {
    face: { R: [1, 0, 0], V: [0, 1, 0], D: [0, 0, 1], cz: 0 },
    edge: { R: [1, 0, 0], V: [0, 0, -1], D: [0, -1, 0], cz: -21 },
    side: { R: [0, 1, 0], V: [0, 0, -1], D: [1, 0, 0], cz: -21 },
    rear: { R: [-1, 0, 0], V: [0, 1, 0], D: [0, 0, -1], cz: 0 },
  };

  const COLORWAYS = {
    white: { label: "Arctic White", shell: "#e9ecf0", touch: "#f1f2f4", edge: "#b9c1cc" },
    midnight: { label: "Midnight Black", shell: "#1b1d21", touch: "#14161a", edge: "#4a515c" },
    cosmic: { label: "Cosmic Red", shell: "#a51f39", touch: "#a51f39", edge: "#5b1524" },
    cobalt: { label: "Cobalt Blue", shell: "#20539c", touch: "#20539c", edge: "#112e58" },
  };

  function colorway(state) { return COLORWAYS[state.colorway] || COLORWAYS.white; }
  function colorFor(matId, state) {
    const cw = colorway(state);
    if (matId === "mat.shell-white") return cw.shell;
    if (matId === "mat.touchpad") return cw.touch;
    if (matId === "mat.lightbar" && !state.lightbar) return "#cdd8de";
    const m = G.materials.get(matId);
    return (m && m.color) || "#8b98a8";
  }

  function shade(hex, f) {
    hex = hex.replace("#", "");
    if (hex.length === 3) hex = hex.split("").map(function (c) { return c + c; }).join("");
    const r = parseInt(hex.slice(0, 2), 16), g = parseInt(hex.slice(2, 4), 16), b = parseInt(hex.slice(4, 6), 16);
    const k = Math.max(0.16, Math.min(1.25, f));
    const mix = function (v) { return Math.max(0, Math.min(255, Math.round(v * k))); };
    return "rgb(" + mix(r) + "," + mix(g) + "," + mix(b) + ")";
  }
  function lum(hex) {
    hex = hex.replace("#", ""); if (hex.length === 3) hex = hex.split("").map(function (c) { return c + c; }).join("");
    return (0.2126 * parseInt(hex.slice(0, 2), 16) + 0.7152 * parseInt(hex.slice(2, 4), 16) + 0.0722 * parseInt(hex.slice(4, 6), 16)) / 255;
  }

  function basis(view) { return VIEW_BASIS[view]; }
  function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
  function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
  function normalOf(v) {
    const a = [v[1][0] - v[0][0], v[1][1] - v[0][1], v[1][2] - v[0][2]];
    const b = [v[2][0] - v[0][0], v[2][1] - v[0][1], v[2][2] - v[0][2]];
    const n = cross(a, b); const l = Math.hypot(n[0], n[1], n[2]) || 1;
    return [n[0] / l, n[1] / l, n[2] / l];
  }
  const LIGHT = (function () { const v = [-0.42, -0.55, 0.72]; const l = Math.hypot(v[0], v[1], v[2]); return [v[0] / l, v[1] / l, v[2] / l]; })();

  function project(p, view, rect, scale) {
    const b = basis(view);
    return [
      rect.x + rect.w / 2 + scale * (dot(p, b.R) - rect.cx),
      rect.y + rect.h / 2 + scale * (dot(p, b.V) - rect.cy),
      dot(p, b.D),
    ];
  }

  function orbitTransform(p, yaw, tilt) {
    const cy = Math.cos(yaw * Math.PI / 180), sy = Math.sin(yaw * Math.PI / 180);
    const ct = Math.cos(tilt * Math.PI / 180), st = Math.sin(tilt * Math.PI / 180);
    const x1 = p[0] * cy - p[1] * sy;
    const y1 = p[0] * sy + p[1] * cy;
    const z1 = p[2];
    return [x1, y1 * ct - z1 * st, y1 * st + z1 * ct];
  }

  function explodeVec(part) {
    if (!part) return [0, 0, 0];
    if (part.indexOf("shell") >= 0) return [0, 0, 0];
    if (part.indexOf("trigger") >= 0 || part.indexOf("bumper") >= 0) {
      const s = part.indexOf("right") >= 0 || part.indexOf("r1") >= 0 || part.indexOf("r2") >= 0 ? 1 : -1;
      return [s * 26, -8, -10];
    }
    if (part.indexOf("label") >= 0 || part.indexOf("screw") >= 0 || part.indexOf("reset") >= 0) return [0, 0, -18];
    return [0, 0, 16];
  }

  function partVisible(f, state) {
    if (f.ghost) return !!state.xray;
    if (f.hidden) return !!state.xray;
    return true;
  }

  function shapeFill(f, view, state, orbitNormal) {
    const mat = f.mat;
    const base = colorFor(mat, state);
    if (f.emissive && mat === "mat.lightbar" && state.lightbar) return base;
    if (f.emissive && mat === "mat.lightbar" && !state.lightbar) return "#cdd8de";
    let n = orbitNormal || normalOf(f.v);
    const D = view === "orbit" ? [0, 0, 1] : basis(view).D;
    if (dot(n, D) < 0) n = [-n[0], -n[1], -n[2]];
    const l = Math.max(0, dot(n, LIGHT));
    let fct;
    if (view === "orbit") fct = 0.42 + 0.55 * l + 0.14 * Math.abs(dot(n, [0, 0, 1]));
    else fct = 0.80 + 0.24 * l;
    if (mat === "mat.lightbar" && state.lightbar) fct = 1;
    return shade(base, fct);
  }

  function esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }

  // ------------------------------------------------------------ shared defs
  function defs() {
    return [
      '<defs>',
      '<pattern id="smallGrid" width="16" height="16" patternUnits="userSpaceOnUse"><path d="M16 0H0V16" fill="none" stroke="#16232e" stroke-width="0.5"/></pattern>',
      '<pattern id="grid" width="80" height="80" patternUnits="userSpaceOnUse"><rect width="80" height="80" fill="url(#smallGrid)"/><path d="M80 0H0V80" fill="none" stroke="#20313d" stroke-width="0.8"/></pattern>',
      '<radialGradient id="vign" cx="50%" cy="45%" r="70%"><stop offset="0%" stop-color="#0a1119"/><stop offset="100%" stop-color="#04070b"/></radialGradient>',
      '<filter id="glow" x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation="2.4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>',
      '<filter id="softGlow" x="-120%" y="-120%" width="340%" height="340%"><feGaussianBlur stdDeviation="6" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>',
      '<linearGradient id="paper" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#070d14"/><stop offset="1" stop-color="#04080d"/></linearGradient>',
      "<style>\n  .sh-title{fill:#dcebf5;font:16px ui-monospace,Consolas,monospace;letter-spacing:.18em}\n  .sh-title .sh-dim{fill:#4f7b90;font-size:10px;letter-spacing:.24em}\n  .sh-meta{fill:#5b7f92;font:7px ui-monospace,Consolas,monospace;letter-spacing:.16em}\n  .sh-meta.dim{fill:#3d5d6e}\n  .view-label{fill:#6fa4ba;font:9px ui-monospace,Consolas,monospace;letter-spacing:.22em}\n  .view-scale{fill:#4b6d80;font:7px ui-monospace,Consolas,monospace;letter-spacing:.1em}\n  .dim-text{fill:#ffcf5c;font:10px ui-monospace,Consolas,monospace;letter-spacing:.08em}\n  .scale-label{fill:#9fdce9;font:7.5px ui-monospace,Consolas,monospace;letter-spacing:.12em}\n  .footer{fill:#46687a;font:7px ui-monospace,Consolas,monospace;letter-spacing:.14em}\n  .tb-title{fill:#e4f1f9;font:13px ui-monospace,Consolas,monospace;letter-spacing:.17em}\n  .tb-meta{fill:#6d8ea0;font:7px ui-monospace,Consolas,monospace;letter-spacing:.13em}\n  .tb-key{fill:#537a8d;font:6.5px ui-monospace,Consolas,monospace;letter-spacing:.13em}\n  .tb-val{fill:#b4ccda;font:8px ui-monospace,Consolas,monospace;letter-spacing:.06em}\n  .glyph{font-family:'Segoe UI',system-ui,sans-serif;font-weight:400;pointer-events:all;cursor:pointer}\n  .glyph-ps{font-family:ui-monospace,Consolas,monospace;font-weight:600;letter-spacing:-.06em}\n  .axis-label{font:9px ui-monospace,Consolas,monospace}\n  .sel-label{fill:#c9f6ff;font:8px ui-monospace,Consolas,monospace;letter-spacing:.12em}\n  .edge-label{fill:#54788a;font:6.5px ui-monospace,Consolas,monospace;letter-spacing:.04em}\n  .g-label{fill:#d8e8f2;font:10px ui-monospace,Consolas,monospace;letter-spacing:.01em}\n  .g-type{fill:#62889c;font:6.5px ui-monospace,Consolas,monospace;letter-spacing:.12em;text-transform:uppercase}\n</style>",
      '</defs>',
    ].join("");
  }

  // ------------------------------------------------------------ sheet
  function renderSheet(state) {
    const scaleFace = Math.min(SHEET.face.w / SHEET.face.uw, SHEET.face.h / SHEET.face.uh);
    const scales = {
      face: scaleFace,
      edge: Math.min(SHEET.edge.w / SHEET.edge.uw, SHEET.edge.h / SHEET.edge.uh),
      side: Math.min(SHEET.side.w / SHEET.side.uw, SHEET.side.h / SHEET.side.uh),
    };
    const out = [];
    out.push('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1680 1060" class="drawing-svg sheet-svg" role="img" aria-label="Orthographic SVG projections of the DualSense controller">');
    out.push(defs());
    out.push('<rect x="0" y="0" width="1680" height="1060" fill="url(#paper)"/>');
    out.push('<rect x="0" y="0" width="1680" height="1060" fill="url(#grid)" opacity="0.55"/>');
    // frame + header
    out.push('<g class="sheet-frame">');
    out.push('<rect x="24" y="24" width="1632" height="1012" fill="none" stroke="#2b3d4b" stroke-width="1"/>');
    out.push('<rect x="34" y="34" width="1612" height="992" fill="none" stroke="#172530" stroke-width="0.7"/>');
    out.push('<path d="M24 70H1656" stroke="#2b3d4b" stroke-width="0.8"/>');
    out.push('<text x="44" y="55" class="sh-title">DUALSENSE <tspan class="sh-dim">/ ONTOLOGY ATLAS</tspan></text>');
    out.push('<text x="1220" y="47" class="sh-meta">CFI-ZCT1W  ·  SVG ORTHOGRAPHIC PROJECTIONS  ·  UNITS MM  ·  SHEET 01</text>');
    out.push('<text x="1220" y="62" class="sh-meta dim">' + esc(O.meta.version) + '  ·  ' + esc(colorway(state).label) + '</text>');
    out.push('</g>');
    out.push('<path d="M950 96V930" stroke="#22323e" stroke-width="0.7" stroke-dasharray="3 5"/>');

    for (const name of ["face", "edge", "side"]) {
      const rect = SHEET[name], sc = scales[name];
      out.push('<g class="view view-' + name + '">');
      out.push('<text x="' + rect.x + '" y="' + (rect.y - 20) + '" class="view-label">' + esc(rect.label) + '</text>');
      out.push('<text x="' + (rect.x + rect.w) + '" y="' + (rect.y - 20) + '" class="view-scale" text-anchor="end">' + sc.toFixed(2) + ' px/mm</text>');
      drawFaces(out, name, rect, sc, state);
      out.push('</g>');
    }

    // dimensions
    if (state.dimensions) {
      out.push('<g class="dimensions">');
      for (const name of ["face", "edge", "side"]) {
        const rect = SHEET[name], sc = scales[name];
        for (const d of G.dims) {
          if (!d.annot || d.annot.view !== name) continue;
          drawDimension(out, d, name, rect, sc);
        }
      }
      out.push('</g>');
    }

    // decorations (face only)
    out.push('<g class="decorations">');
    drawDecorations(out, "face", SHEET.face, scales.face, state);
    out.push('</g>');

    // selection box
    if (state.highlight && state.highlight.size) drawSelection(out, "face", SHEET.face, scales.face, state);

    // face centreline + scale bar
    out.push('<g class="annotations">');
    out.push('<path d="M' + (SHEET.face.x + SHEET.face.w / 2) + ' 180V830" stroke="#2b4b5e" stroke-width="0.6" stroke-dasharray="2 6" opacity="0.55"/>');
    out.push('<path d="M80 880H307" stroke="#6ee7ff" stroke-width="1.2"/>');
    out.push('<path d="M80 875V885M307 875V885" stroke="#6ee7ff" stroke-width="1.2"/>');
    out.push('<text x="193" y="870" class="scale-label" text-anchor="middle">50 mm</text>');
    out.push('<text x="44" y="1030" class="footer">PROJECTION = ORTHOGRAPHIC  ·  Z-AXIS DEPTH  ·  MODEL IS PARAMETRIC / ATLAS-GRADE, NOT CAD</text>');
    out.push('<text x="1636" y="1030" class="footer" text-anchor="end">CONFIDENCE: V VERIFIED · E ESTIMATED · U UNKNOWN</text>');
    out.push('</g>');

    drawTitleBlock(out, state);
    out.push('</svg>');
    return out.join("");
  }

  function drawFaces(out, view, rect, scale, state) {
    const b = basis(view);
    const list = [];
    const cw = colorway(state);
    for (const f of G.faces) {
      if (!partVisible(f, state)) continue;
      if (f.part && state.xray === false && f.part.indexOf("shell") < 0 && f.hidden) continue;
      const off = state.exploded ? explodeVec(f.part).map(function (x) { return x * state.exploded; }) : [0, 0, 0];
      const proj = [];
      let depth = 0;
      for (const v0 of f.v) {
        const v = [v0[0] + off[0], v0[1] + off[1], v0[2] + off[2]];
        const p = project(v, view, rect, scale);
        proj.push(p); depth += p[2];
      }
      depth /= proj.length;
      list.push({ f: f, p: proj, d: depth });
    }
    list.sort(function (a, b) { return (a.f.surface ? 1 : 0) - (b.f.surface ? 1 : 0) || a.d - b.d; });
    const hl = state.highlight;
    for (const item of list) {
      const f = item.f;
      const fill = shapeFill(f, view, state);
      let op = 1;
      if (state.xray) op = f.ghost ? 0.88 : (f.part && f.part.indexOf("shell") >= 0 ? 0.16 : 0.45);
      if (hl && hl.size && f.part && !hl.has(f.part)) op *= 0.30;
      const d = pathData(item.p);
      let attrs = 'd="' + d + '" fill="' + fill + '"';
      if (op < 1) attrs += ' fill-opacity="' + op.toFixed(3) + '"';
      if (f.emissive && state.lightbar) attrs += ' filter="url(#glow)"';
      if (state.xray && f.ghost) attrs += ' stroke="#8fe8ff" stroke-width="0.5" stroke-opacity="0.65"';
      else if (item.p.length > 12) attrs += ' stroke="none"';
      else if (f.seamless) attrs += ' stroke="none"';
      else if (f.part === "part.player-led" || f.part === "part.speaker-grille") attrs += ' stroke="#4a5a66" stroke-width="0.3"';
      else attrs += ' stroke="rgba(2,5,9,0.34)" stroke-width="0.4" stroke-linejoin="round"';
      attrs += ' data-part="' + esc(f.part || "") + '"';
      out.push('<path ' + attrs + '/>');
    }
  }

  function pathData(points) {
    let d = "";
    for (let i = 0; i < points.length; i++) d += (i ? "L" : "M") + points[i][0].toFixed(2) + " " + points[i][1].toFixed(2);
    return d + "Z";
  }

  // ------------------------------------------------------------ decorations
  function glyphColor(g, state) {
    const shell = colorway(state).shell;
    const light = lum(shell) > 0.55;
    if (g.glyph === "create" || g.glyph === "options") return light ? "#20242b" : "#e9edf2";
    return "#f4f8fc";
  }
  function drawDecorations(out, view, rect, scale, state) {
    const hl = state.highlight;
    for (const dec of G.decorations) {
      if (dec.part && !state.xray && (dec.part === "part.player-led-leds")) continue;
      if (dec.type === "dot") continue; // drawn separately on the LED strip
      if ((dec.at[2] || 0) < 0.2) continue; // rear-side details belong to rear / orbit only
      if (hl && hl.size && dec.part && !hl.has(dec.part)) continue;
      const p = project(dec.at, view, rect, scale);
      const x = p[0], y = p[1], s = scale;
      const c = glyphColor(dec, state);
      if (dec.type === "glyph") {
        if (dec.glyph === "triangle" || dec.glyph === "circle" || dec.glyph === "cross" || dec.glyph === "square") {
          const ch = dec.glyph === "triangle" ? "△" : dec.glyph === "circle" ? "○" : dec.glyph === "cross" ? "✕" : "□";
          out.push('<text x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" class="glyph" font-size="' + (6.7 * s).toFixed(1) + '" fill="' + c + '" text-anchor="middle" dominant-baseline="central" data-part="' + esc(dec.part) + '">' + ch + '</text>');
        } else if (dec.glyph === "ps") {
          out.push('<text x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" class="glyph glyph-ps" font-size="' + (5.4 * s).toFixed(1) + '" fill="' + c + '" text-anchor="middle" dominant-baseline="central" data-part="' + esc(dec.part) + '">PS</text>');
        } else if (dec.glyph === "mute") {
          const w = 3.4 * s, h = 2.2 * s;
          out.push('<g data-part="' + esc(dec.part) + '" transform="translate(' + x.toFixed(1) + ' ' + y.toFixed(1) + ')" fill="none" stroke="' + c + '" stroke-width="' + (0.45 * s).toFixed(2) + '" stroke-linecap="round">');
          out.push('<rect x="' + (-w / 2).toFixed(1) + '" y="' + (-h / 2).toFixed(1) + '" width="' + w.toFixed(1) + '" height="' + h.toFixed(1) + '" rx="' + (h / 2).toFixed(1) + '"/>');
          out.push('<path d="M' + (-w * 0.18).toFixed(1) + ' ' + (h * 0.55).toFixed(1) + 'v' + (h * 0.55).toFixed(1) + 'M' + (w * 0.18).toFixed(1) + ' ' + (h * 0.55).toFixed(1) + 'v' + (h * 0.55).toFixed(1) + 'M' + (-w * 0.26).toFixed(1) + ' ' + (h * 1.1).toFixed(1) + 'h' + (w * 0.52).toFixed(1) + '"/>');
          out.push('</g>');
        } else if (dec.glyph === "create" || dec.glyph === "options") {
          const w = 4.4 * s;
          out.push('<g data-part="' + esc(dec.part) + '" stroke="' + c + '" stroke-width="' + (0.4 * s).toFixed(2) + '" stroke-linecap="round">');
          out.push('<path d="M' + (x - w / 2).toFixed(1) + ' ' + (y - 1.1 * s).toFixed(1) + 'h' + w.toFixed(1) + 'M' + (x - w / 2).toFixed(1) + ' ' + y.toFixed(1) + 'h' + w.toFixed(1) + 'M' + (x - w / 2).toFixed(1) + ' ' + (y + 1.1 * s).toFixed(1) + 'h' + w.toFixed(1) + '"/>');
          out.push('</g>');
        }
      } else if (dec.type === "arrow") {
        const sz = (dec.size || 4.2) * s;
        const dir = dec.dir;
        let pts = "";
        if (dir === "up") pts = "0," + (-sz * 0.5) + " " + (-sz * 0.55) + "," + (sz * 0.45) + " " + (sz * 0.55) + "," + (sz * 0.45);
        if (dir === "down") pts = "0," + (sz * 0.5) + " " + (-sz * 0.55) + "," + (-sz * 0.45) + " " + (sz * 0.55) + "," + (-sz * 0.45);
        if (dir === "left") pts = (-sz * 0.5) + ",0 " + (sz * 0.45) + "," + (-sz * 0.55) + " " + (sz * 0.45) + "," + (sz * 0.55);
        if (dir === "right") pts = (sz * 0.5) + ",0 " + (-sz * 0.45) + "," + (-sz * 0.55) + " " + (-sz * 0.45) + "," + (sz * 0.55);
        out.push('<polygon points="' + pts + '" transform="translate(' + x.toFixed(1) + ' ' + y.toFixed(1) + ')" fill="#f4f8fc" data-part="' + esc(dec.part) + '"/>');
      } else if (dec.type === "cross") {
        const sz = dec.size * s * 0.8;
        out.push('<g stroke="#1b2027" stroke-width="' + (0.3 * s).toFixed(2) + '" data-part="' + esc(dec.part) + '"><path d="M' + (x - sz).toFixed(1) + ' ' + (y - sz).toFixed(1) + 'l' + (2 * sz).toFixed(1) + ' ' + (2 * sz).toFixed(1) + 'M' + (x + sz).toFixed(1) + ' ' + (y - sz).toFixed(1) + 'l' + (-2 * sz).toFixed(1) + ' ' + (2 * sz).toFixed(1) + '"/></g>');
      }
    }
    // player LEDs
    const ledStrip = byId.get("part.player-led");
    const showLed = !(hl && hl.size) || hl.has("part.player-led");
    if (ledStrip && showLed) {
      for (let i = 0; i < 5; i++) {
        const p = project([-20 + i * 5, 30.2, 1.62], view, rect, scale);
        out.push('<circle cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r="' + (0.6 * scale).toFixed(1) + '" fill="#dff4ff" opacity="0.92" data-part="part.player-led"/>');
      }
    }
    const mute = byId.get("part.mute-led");
    if (mute && (!(hl && hl.size) || hl.has("part.mute-led"))) {
      const p = project([-4.4, 53.6, 2.9], view, rect, scale);
      out.push('<circle cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r="' + (0.7 * scale).toFixed(1) + '" fill="#ffb454" filter="url(#glow)" data-part="part.mute-led"/>');
    }
  }

  // ------------------------------------------------------------ dimensions
  function drawDimension(out, d, view, rect, scale) {
    const a = d.annot.a, b = d.annot.b;
    const pa = view === "face" ? [a[0], a[1], 0] : view === "edge" ? [a[0], 0, a[1]] : [0, a[0], a[1]];
    const pb = view === "face" ? [b[0], b[1], 0] : view === "edge" ? [b[0], 0, b[1]] : [0, b[0], b[1]];
    const p1 = project(pa, view, rect, scale), p2 = project(pb, view, rect, scale);
    const x1 = p1[0], y1 = p1[1], x2 = p2[0], y2 = p2[1];
    const horizontal = Math.abs(x2 - x1) >= Math.abs(y2 - y1);
    const col = "#6ee7ff";
    out.push('<g class="dim" data-label="' + esc(d.label) + '">');
    out.push('<path d="M' + x1.toFixed(1) + ' ' + y1.toFixed(1) + 'L' + x2.toFixed(1) + ' ' + y2.toFixed(1) + '" stroke="' + col + '" stroke-width="0.9"/>');
    // end ticks
    if (horizontal) {
      out.push('<path d="M' + x1.toFixed(1) + ' ' + (y1 - 4).toFixed(1) + 'v8M' + x2.toFixed(1) + ' ' + (y2 - 4).toFixed(1) + 'v8" stroke="' + col + '" stroke-width="0.9"/>');
      out.push('<path d="M' + (x1 + 6).toFixed(1) + ' ' + (y1 - 2.2).toFixed(1) + 'l-6 2.2 6 2.2M' + (x2 - 6).toFixed(1) + ' ' + (y2 - 2.2).toFixed(1) + 'l6 2.2-6 2.2" fill="none" stroke="' + col + '" stroke-width="0.9"/>');
      out.push('<text x="' + ((x1 + x2) / 2).toFixed(1) + '" y="' + (y1 - 7).toFixed(1) + '" class="dim-text" text-anchor="middle">' + esc(d.annot.label) + '</text>');
    } else {
      out.push('<path d="M' + (x1 - 4).toFixed(1) + ' ' + y1.toFixed(1) + 'h8M' + (x2 - 4).toFixed(1) + ' ' + y2.toFixed(1) + 'h8" stroke="' + col + '" stroke-width="0.9"/>');
      out.push('<path d="M' + (x1 - 2.2).toFixed(1) + ' ' + (y1 + 6).toFixed(1) + 'l2.2 -6 2.2 6M' + (x2 - 2.2).toFixed(1) + ' ' + (y2 - 6).toFixed(1) + 'l2.2 6 2.2 -6" fill="none" stroke="' + col + '" stroke-width="0.9"/>');
      out.push('<text x="' + (x2 + 12).toFixed(1) + '" y="' + ((y1 + y2) / 2).toFixed(1) + '" class="dim-text">' + esc(d.annot.label) + '</text>');
    }
    out.push('</g>');
  }

  function drawSelection(out, view, rect, scale, state) {
    const b = basis(view);
    let mnx = 1e9, mny = 1e9, mxx = -1e9, mxy = -1e9, any = false;
    for (const f of G.faces) {
      if (!f.part || !state.highlight.has(f.part)) continue;
      if (!partVisible(f, state)) continue;
      const off = state.exploded ? explodeVec(f.part).map(function (x) { return x * state.exploded; }) : [0, 0, 0];
      for (const v0 of f.v) {
        const p = project([v0[0] + off[0], v0[1] + off[1], v0[2] + off[2]], view, rect, scale);
        if (p[0] < mnx) mnx = p[0]; if (p[0] > mxx) mxx = p[0];
        if (p[1] < mny) mny = p[1]; if (p[1] > mxy) mxy = p[1];
        any = true;
      }
    }
    if (!any) return;
    const pad = 7;
    mnx -= pad; mny -= pad; mxx += pad; mxy += pad;
    out.push('<g class="selection">');
    out.push('<rect x="' + mnx.toFixed(1) + '" y="' + mny.toFixed(1) + '" width="' + (mxx - mnx).toFixed(1) + '" height="' + (mxy - mny).toFixed(1) + '" fill="none" stroke="#6ee7ff" stroke-width="1" stroke-dasharray="5 4"/>');
    out.push('<path d="M' + mnx.toFixed(1) + ' ' + (mny + 10).toFixed(1) + 'V' + mny.toFixed(1) + 'H' + (mnx + 10).toFixed(1) + 'M' + (mxx - 10).toFixed(1) + ' ' + mny.toFixed(1) + 'H' + mxx.toFixed(1) + 'V' + (mny + 10).toFixed(1) + '" stroke="#6ee7ff" stroke-width="2"/>');
    const label = state.selectedLabel || "SELECTION";
    const w = Math.max(80, label.length * 6.4 + 14);
    out.push('<rect x="' + mnx.toFixed(1) + '" y="' + (mny - 22).toFixed(1) + '" width="' + w.toFixed(1) + '" height="16" fill="#061019" stroke="#6ee7ff" stroke-width="0.7"/>');
    out.push('<text x="' + (mnx + 7).toFixed(1) + '" y="' + (mny - 10).toFixed(1) + '" class="sel-label">' + esc(label) + '</text>');
    out.push('</g>');
  }

  function drawTitleBlock(out, state) {
    const x = 980, y = 884, w = 640, h = 120;
    out.push('<g class="titleblock">');
    out.push('<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" fill="#060c12" stroke="#2b3d4b" stroke-width="0.8"/>');
    out.push('<path d="M' + x + ' ' + (y + 34) + 'H' + (x + w) + 'M' + x + ' ' + (y + 66) + 'H' + (x + w) + 'M' + (x + 232) + ' ' + (y + 34) + 'V' + (y + h) + 'M' + (x + 430) + ' ' + (y + 34) + 'V' + (y + h) + '" stroke="#22323e" stroke-width="0.6"/>');
    out.push('<text x="' + (x + 12) + '" y="' + (y + 22) + '" class="tb-title">DUALSENSE</text>');
    out.push('<text x="' + (x + w - 12) + '" y="' + (y + 22) + '" class="tb-meta" text-anchor="end">' + esc(colorway(state).label.toUpperCase()) + '</text>');
    const cells = [
      [x + 12, y + 52, "SUBJECT", "CFI-ZCT1W  /  PS5"],
      [x + 12, y + 84, "ENVELOPE", "160 x 66 x 106 mm"],
      [x + 12, y + 114, "MASS", "280 g"],
      [x + 244, y + 52, "MODEL", "PARAMETRIC"],
      [x + 244, y + 84, "ENTITIES", String(O.entities.length)],
      [x + 244, y + 114, "RELATIONS", String(O.entities.reduce(function (n, e) { return n + (e.links ? e.links.length : 0) + (e.parent ? 1 : 0); }, 0))],
      [x + 442, y + 52, "PROJECTION", "ORTHO"],
      [x + 442, y + 84, "DATUM", "TOP / FACE"],
      [x + 442, y + 114, "SHEET", "01 / 01"],
    ];
    for (const c of cells) {
      out.push('<text x="' + c[0] + '" y="' + c[1] + '" class="tb-key">' + c[2] + '</text>');
      out.push('<text x="' + (c[0] + 96) + '" y="' + c[1] + '" class="tb-val">' + esc(c[3]) + '</text>');
    }
    out.push('</g>');
  }

  // ------------------------------------------------------------ orbit
  function renderOrbit(state) {
    const W = 1600, H = 1000;
    const yaw = state.orbit.yaw, tilt = state.orbit.tilt;
    const ct = Math.cos(tilt * Math.PI / 180);
    const baseScale = Math.min((W - 160) / 215, (H - 140) / 175) * (state.orbit.zoom || 1);
    const centerWorld = orbitTransform([0, 53, -24], yaw, tilt);
    const cx = W / 2, cy = H / 2 + 8;
    const projectOrbit = function (p) {
      const t = orbitTransform(p, yaw, tilt);
      return [cx + baseScale * (t[0] - centerWorld[0]), cy + baseScale * (t[1] - centerWorld[1]), t[2]];
    };
    const out = [];
    out.push('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + ' ' + H + '" class="drawing-svg orbit-svg" role="img" aria-label="Interactive projected 3D DualSense model">');
    out.push(defs());
    out.push('<rect width="' + W + '" height="' + H + '" fill="url(#paper)"/>');
    out.push('<rect width="' + W + '" height="' + H + '" fill="url(#grid)" opacity="0.45"/>');
    out.push('<g class="orbit-frame">');
    out.push('<path d="M40 40H1560V960H40Z" fill="none" stroke="#22323e" stroke-width="0.8"/>');
    out.push('<text x="60" y="72" class="view-label">D / PERSPECTIVE PROJECTION</text>');
    out.push('<text x="1540" y="72" class="view-scale" text-anchor="end">YAW ' + yaw.toFixed(0) + '°  ·  TILT ' + tilt.toFixed(0) + '°  ·  ' + (state.xray ? 'X-RAY' : 'SOLID') + '  ·  ' + (state.exploded ? 'EXPLODED' : 'ASSEMBLED') + '</text>');
    out.push('</g>');

    const list = [];
    for (const f of G.faces) {
      if (!partVisible(f, state)) continue;
      const off = state.exploded ? explodeVec(f.part).map(function (x) { return x * state.exploded; }) : [0, 0, 0];
      const proj = [];
      let depth = 0;
      for (const v0 of f.v) {
        const p = projectOrbit([v0[0] + off[0], v0[1] + off[1], v0[2] + off[2]]);
        proj.push(p); depth += p[2];
      }
      depth /= proj.length;
      list.push({ f: f, p: proj, d: depth });
    }
    const frontFacing = Math.cos(tilt * Math.PI / 180) > 0;
    list.sort(function (a, b) {
      if (frontFacing) return (a.f.surface ? 1 : 0) - (b.f.surface ? 1 : 0) || a.d - b.d;
      return (b.f.surface ? 1 : 0) - (a.f.surface ? 1 : 0) || a.d - b.d;
    });
    const hl = state.highlight;
    for (const item of list) {
      const f = item.f;
      let n = normalOf(f.v);
      const tn = orbitTransform(n, yaw, tilt);
      const fill = shapeFill(f, "orbit", state, [tn[0], tn[1], tn[2]]);
      let op = 1;
      if (state.xray) op = f.ghost ? 0.85 : (f.part && f.part.indexOf("shell") >= 0 ? 0.18 : 0.42);
      if (hl && hl.size && f.part && !hl.has(f.part)) op *= 0.28;
      let attrs = 'd="' + pathData(item.p) + '" fill="' + fill + '"';
      if (op < 1) attrs += ' fill-opacity="' + op.toFixed(3) + '"';
      if (f.emissive && state.lightbar) attrs += ' filter="url(#glow)"';
      if (state.xray && f.ghost) attrs += ' stroke="#8fe8ff" stroke-width="0.55" stroke-opacity="0.7"';
      else if (f.seamless) attrs += ' stroke="none"';
      else if (f.part === "part.player-led" || f.part === "part.speaker-grille") attrs += ' stroke="#4a5a66" stroke-width="0.3"';
      else attrs += ' stroke="rgba(2,5,9,0.30)" stroke-width="0.35" stroke-linejoin="round"';
      attrs += ' data-part="' + esc(f.part || "") + '"';
      out.push('<path ' + attrs + '/>');
    }

    // decorations only while the face is toward the viewer
    if (ct > 0.12) {
      out.push('<g class="decorations">');
      drawOrbitDecorations(out, projectOrbit, baseScale, state, ct);
      out.push('</g>');
    }

    if (state.highlight && state.highlight.size) {
      drawOrbitSelection(out, projectOrbit, state);
    }

    // axes triad
    out.push('<g class="axes" transform="translate(90 880)">');
    const axes = [
      [orbitTransform([1, 0, 0], yaw, tilt), "#ff8f6b", "X"],
      [orbitTransform([0, 1, 0], yaw, tilt), "#6ee7ff", "Y"],
      [orbitTransform([0, 0, 1], yaw, tilt), "#c792ff", "Z"],
    ];
    for (const a of axes) {
      const dx = a[0][0] * 46, dy = a[0][1] * 46;
      out.push('<path d="M0 0L' + dx.toFixed(1) + ' ' + dy.toFixed(1) + '" stroke="' + a[1] + '" stroke-width="1.4"/>');
      out.push('<text x="' + (dx * 1.18).toFixed(1) + '" y="' + (dy * 1.18).toFixed(1) + '" fill="' + a[1] + '" class="axis-label">' + a[2] + '</text>');
    }
    out.push('</g>');
    // scale bar
    out.push('<g class="scalebar" transform="translate(1290 900)">');
    out.push('<path d="M0 0H100" stroke="#dce8f2" stroke-width="1.2"/><path d="M0 -4V4M50 -3V3M100 -4V4" stroke="#dce8f2" stroke-width="1.2"/>');
    out.push('<text x="50" y="-8" class="scale-label" text-anchor="middle">' + (100 / baseScale).toFixed(0) + ' mm</text>');
    out.push('</g>');
    out.push('<text x="60" y="950" class="footer">DRAG TO ORBIT  ·  WHEEL TO ZOOM  ·  DOUBLE-CLICK TO RESET</text>');
    out.push('<text x="1540" y="950" class="footer" text-anchor="end">OBJECT ROTATION PROJECTION  ·  PARAMETRIC MESH  ·  ' + G.faces.length + ' FACES</text>');
    out.push('</svg>');
    return out.join("");
  }

  function drawOrbitDecorations(out, projectOrbit, scale, state, ct) {
    const hl = state.highlight;
    for (const dec of G.decorations) {
      if (dec.type === "dot") continue;
      if (hl && hl.size && dec.part && !hl.has(dec.part)) continue;
      const p = projectOrbit(dec.at);
      const x = p[0], y = p[1], s = scale;
      const c = glyphColor(dec, state);
      if (dec.type === "glyph") {
        if (dec.glyph === "triangle" || dec.glyph === "circle" || dec.glyph === "cross" || dec.glyph === "square") {
          const ch = dec.glyph === "triangle" ? "△" : dec.glyph === "circle" ? "○" : dec.glyph === "cross" ? "✕" : "□";
          out.push('<text x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" class="glyph" font-size="' + (6.7 * s).toFixed(1) + '" fill="' + c + '" text-anchor="middle" dominant-baseline="central" data-part="' + esc(dec.part) + '">' + ch + '</text>');
        } else if (dec.glyph === "ps") {
          out.push('<text x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" class="glyph glyph-ps" font-size="' + (5.4 * s).toFixed(1) + '" fill="' + c + '" text-anchor="middle" dominant-baseline="central" data-part="' + esc(dec.part) + '">PS</text>');
        } else if (dec.glyph === "mute") {
          out.push('<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="' + (1.1 * s).toFixed(1) + '" fill="none" stroke="' + c + '" stroke-width="' + (0.4 * s).toFixed(2) + '" data-part="' + esc(dec.part) + '"/>');
          out.push('<path d="M' + (x - 0.5 * s).toFixed(1) + ' ' + (y + 0.6 * s).toFixed(1) + 'l' + (1.2 * s).toFixed(1) + ' 0" stroke="' + c + '" stroke-width="' + (0.35 * s).toFixed(2) + '" data-part="' + esc(dec.part) + '"/>');
        } else if (dec.glyph === "create" || dec.glyph === "options") {
          const w = 4.4 * s;
          out.push('<g data-part="' + esc(dec.part) + '" stroke="' + c + '" stroke-width="' + (0.4 * s).toFixed(2) + '" stroke-linecap="round">');
          out.push('<path d="M' + (x - w / 2).toFixed(1) + ' ' + (y - 1.1 * s).toFixed(1) + 'h' + w.toFixed(1) + 'M' + (x - w / 2).toFixed(1) + ' ' + y.toFixed(1) + 'h' + w.toFixed(1) + 'M' + (x - w / 2).toFixed(1) + ' ' + (y + 1.1 * s).toFixed(1) + 'h' + w.toFixed(1) + '"/>');
          out.push('</g>');
        }
      } else if (dec.type === "arrow") {
        const sz = (dec.size || 4.2) * s;
        let pts = "";
        if (dec.dir === "up") pts = "0," + (-sz * 0.5) + " " + (-sz * 0.55) + "," + (sz * 0.45) + " " + (sz * 0.55) + "," + (sz * 0.45);
        if (dec.dir === "down") pts = "0," + (sz * 0.5) + " " + (-sz * 0.55) + "," + (-sz * 0.45) + " " + (sz * 0.55) + "," + (-sz * 0.45);
        if (dec.dir === "left") pts = (-sz * 0.5) + ",0 " + (sz * 0.45) + "," + (-sz * 0.55) + " " + (sz * 0.45) + "," + (sz * 0.55);
        if (dec.dir === "right") pts = (sz * 0.5) + ",0 " + (-sz * 0.45) + "," + (-sz * 0.55) + " " + (-sz * 0.45) + "," + (sz * 0.55);
        out.push('<polygon points="' + pts + '" transform="translate(' + x.toFixed(1) + ' ' + y.toFixed(1) + ')" fill="#f4f8fc" data-part="' + esc(dec.part) + '"/>');
      } else if (dec.type === "cross") {
        const sz = dec.size * s * 0.8;
        out.push('<path d="M' + (x - sz).toFixed(1) + ' ' + (y - sz).toFixed(1) + 'l' + (2 * sz).toFixed(1) + ' ' + (2 * sz).toFixed(1) + 'M' + (x + sz).toFixed(1) + ' ' + (y - sz).toFixed(1) + 'l' + (-2 * sz).toFixed(1) + ' ' + (2 * sz).toFixed(1) + '" stroke="#1b2027" stroke-width="' + (0.3 * s).toFixed(2) + '" data-part="' + esc(dec.part) + '"/>');
      }
    }
    // player LEDs
    const showLed = !(hl && hl.size) || hl.has("part.player-led");
    if (showLed) for (let i = 0; i < 5; i++) {
      const p = projectOrbit([-20 + i * 5, 30.2, 1.62]);
      out.push('<circle cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r="' + (0.6 * scale).toFixed(1) + '" fill="#dff4ff" opacity="0.92" data-part="part.player-led"/>');
    }
    if (!(hl && hl.size) || hl.has("part.mute-led")) {
      const mute = projectOrbit([-4.4, 53.6, 2.9]);
      out.push('<circle cx="' + mute[0].toFixed(1) + '" cy="' + mute[1].toFixed(1) + '" r="' + (0.7 * scale).toFixed(1) + '" fill="#ffb454" filter="url(#glow)" data-part="part.mute-led"/>');
    }
  }

  function drawOrbitSelection(out, projectOrbit, state) {
    let mnx = 1e9, mny = 1e9, mxx = -1e9, mxy = -1e9, any = false;
    for (const f of G.faces) {
      if (!f.part || !state.highlight.has(f.part) || !partVisible(f, state)) continue;
      const off = state.exploded ? explodeVec(f.part).map(function (x) { return x * state.exploded; }) : [0, 0, 0];
      for (const v0 of f.v) {
        const p = projectOrbit([v0[0] + off[0], v0[1] + off[1], v0[2] + off[2]]);
        if (p[0] < mnx) mnx = p[0]; if (p[0] > mxx) mxx = p[0];
        if (p[1] < mny) mny = p[1]; if (p[1] > mxy) mxy = p[1];
        any = true;
      }
    }
    if (!any) return;
    const pad = 10;
    mnx -= pad; mny -= pad; mxx += pad; mxy += pad;
    out.push('<g class="selection">');
    out.push('<rect x="' + mnx.toFixed(1) + '" y="' + mny.toFixed(1) + '" width="' + (mxx - mnx).toFixed(1) + '" height="' + (mxy - mny).toFixed(1) + '" fill="none" stroke="#6ee7ff" stroke-width="1" stroke-dasharray="6 5"/>');
    const label = state.selectedLabel || "SELECTION";
    out.push('<rect x="' + mnx.toFixed(1) + '" y="' + (mny - 24).toFixed(1) + '" width="' + Math.max(90, label.length * 6.6 + 16).toFixed(1) + '" height="17" fill="#061019" stroke="#6ee7ff" stroke-width="0.7"/>');
    out.push('<text x="' + (mnx + 8).toFixed(1) + '" y="' + (mny - 11).toFixed(1) + '" class="sel-label">' + esc(label) + '</text>');
    out.push('</g>');
  }

  window.DSA_SCENE = { renderSheet: renderSheet, renderOrbit: renderOrbit, SHEET: SHEET, COLORWAYS: COLORWAYS };
})();
