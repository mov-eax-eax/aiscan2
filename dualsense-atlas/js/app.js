// ============================================================================
// DualSense Ontology Atlas - application shell, explorer, inspector, graph
// ============================================================================
(function () {
  "use strict";
  const O = window.ONTOLOGY, G = window.DSA_GEOM, SC = window.DSA_SCENE;
  const byId = new Map(O.entities.map(function (e) { return [e.id, e]; }));
  const classById = new Map(O.classes.map(function (c) { return [c.id, c]; }));
  const sources = new Map(O.sources.map(function (s) { return [s.id, s]; }));
  const childrenMap = new Map();
  for (const e of O.entities) {
    if (!e.parent) continue;
    if (!childrenMap.has(e.parent)) childrenMap.set(e.parent, []);
    childrenMap.get(e.parent).push(e.id);
  }
  const faceCount = new Map();
  for (const f of G.faces) if (f.part) faceCount.set(f.part, (faceCount.get(f.part) || 0) + 1);

  const state = {
    mode: "sheet",
    selectedId: null,
    highlight: new Set(),
    selectedLabel: "",
    colorway: "white",
    lightbar: true,
    dimensions: true,
    xray: false,
    exploded: 0,
    autoRotate: false,
    orbit: { yaw: -24, tilt: 34, zoom: 1 },
    search: "",
    filter: "all",
    hovered: null,
  };

  const CLASS_COLOR = {
    product: "#ffd166", system: "#6ee7ff", assembly: "#8ab4ff", part: "#d7e2ee",
    control: "#ff9f68", feature: "#c792ff", sensor: "#7dffc0", actuator: "#ff7d9c",
    interface: "#5ad1ff", geometry: "#57c7ff", curve: "#4ea8de", material: "#b8a98a",
    finish: "#9c8f78", color: "#d8b4fe", dimension: "#ffcf5c", state: "#9aa7b8",
    interaction: "#f59e0b", process: "#94a3b8", standard: "#7dd3fc",
  };
  function layerColor(e) { return (classById.get(e.cls) && classById.get(e.cls).color) || CLASS_COLOR[e.layer] || "#8b98a8"; }
  function esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  function classLabel(e) { const c = classById.get(e.cls); return c ? c.label : e.layer; }

  function childrenOf(id) { return childrenMap.get(id) || []; }
  function addSubtree(id, set) {
    if (!byId.has(id) || set.has(id)) return;
    set.add(id);
    for (const c of childrenOf(id)) addSubtree(c, set);
  }
  function computeHighlight(id) {
    const set = new Set();
    const e = byId.get(id);
    if (!e) return set;
    if (e.layer === "product" || e.layer === "system" || e.layer === "assembly" || e.layer === "part") {
      addSubtree(id, set);
      return set;
    }
    if (e.layer === "feature") {
      for (const p of O.entities) if ((p.links || []).some(function (l) { return l.p === "realizes" && l.o === id; })) addSubtree(p.id, set);
      return set;
    }
    if (e.layer === "material" || e.layer === "finish" || e.layer === "color") {
      const pred = e.layer === "material" ? "hasMaterial" : e.layer === "finish" ? "hasFinish" : "hasColor";
      for (const p of O.entities) if ((p.links || []).some(function (l) { return l.p === pred && l.o === id; })) addSubtree(p.id, set);
      return set;
    }
    if (e.layer === "geometry" || e.layer === "curve") {
      for (const p of O.entities) if ((p.links || []).some(function (l) { return l.p === "hasGeometry" && l.o === id; })) addSubtree(p.id, set);
      return set;
    }
    if (e.layer === "interface" || e.layer === "sensor" || e.layer === "actuator" || e.layer === "state") {
      for (const p of O.entities) if ((p.links || []).some(function (l) { return l.o === id && ["connectsTo", "senses", "actuates", "indicates"].indexOf(l.p) >= 0; })) addSubtree(p.id, set);
      return set;
    }
    if (e.layer === "control") {
      for (const l of (e.links || [])) if (l.p === "partOf" && byId.has(l.o)) addSubtree(l.o, set);
      return set;
    }
    return set;
  }

  function edgesOf(id) {
    const e = byId.get(id);
    if (!e) return { out: [], inc: [] };
    const out = [];
    for (const l of (e.links || [])) if (byId.has(l.o)) out.push({ p: l.p, o: l.o });
    if (e.parent && byId.has(e.parent)) out.push({ p: "partOf", o: e.parent });
    const inc = [];
    for (const other of O.entities) {
      if (other.id === id) continue;
      for (const l of (other.links || [])) if (l.o === id) inc.push({ p: l.p, o: other.id });
    }
    for (const c of childrenOf(id)) inc.push({ p: "hasPart", o: c });
    return { out: out, inc: inc };
  }

  function predLabel(p) { const x = O.predicates.find(function (q) { return q.id === p; }); return x ? x.label : p; }

  // ---------------------------------------------------------------- state / render
  let stage, tree, inspector, toolbar, tooltip;
  let raf = null, lastFrame = 0, dragging = false, dragX = 0, dragY = 0, hoverPart = null;

  const MODES = {
    sheet: { eyebrow: "ORTHOGRAPHIC PROJECTION", title: "Technical sheet", hint: "CLICK A PART TO TRACE ITS ONTOLOGY" },
    orbit: { eyebrow: "PROJECTED 3D", title: "Object orbit", hint: "DRAG TO ORBIT · SCROLL TO ZOOM · DOUBLE-CLICK TO RESET" },
    graph: { eyebrow: "RELATION GRAPH", title: "Ontology ego graph", hint: "CLICK A NODE TO RECENTER" },
    matrix: { eyebrow: "COMPARATIVE VIEW", title: "Part matrix", hint: "CLICK A ROW TO SELECT THE ENTITY" },
  };

  function setSelected(id) {
    state.selectedId = id || null;
    const e = state.selectedId ? byId.get(state.selectedId) : null;
    state.highlight = e ? computeHighlight(e.id) : new Set();
    state.selectedLabel = e ? e.label : "";
    renderInspector();
    renderTree();
    renderStage();
    updateStatus();
  }

  function setMode(mode) {
    state.mode = mode;
    if (mode !== "orbit") stopAuto();
    document.querySelectorAll(".tab").forEach(function (b) { b.classList.toggle("active", b.getAttribute("data-mode") === mode); });
    const eyebrow = document.getElementById("mode-eyebrow"), title = document.getElementById("mode-title");
    if (eyebrow) eyebrow.textContent = MODES[mode].eyebrow;
    if (title) title.textContent = MODES[mode].title;
    renderToolbar();
    renderStage();
    updateStatus();
  }

  function renderStage() {
    if (!stage) return;
    if (state.mode === "sheet" || state.mode === "orbit") {
      stage.innerHTML = state.mode === "sheet" ? SC.renderSheet(state) : SC.renderOrbit(state);
      stage.className = "stage drawing-stage";
    } else if (state.mode === "graph") {
      stage.innerHTML = renderGraph();
      stage.className = "stage graph-stage";
    } else {
      stage.innerHTML = renderMatrix();
      stage.className = "stage matrix-stage";
    }
  }

  function scheduleStage() {
    if (raf) return;
    raf = requestAnimationFrame(function () { raf = null; renderStage(); });
  }

  // ---------------------------------------------------------------- toolbar
  function swatchHTML() {
    const cw = SC.COLORWAYS;
    return Object.keys(cw).map(function (k) {
      return '<button class="swatch' + (state.colorway === k ? " active" : "") + '" data-color="' + k + '" title="' + esc(cw[k].label) + '" aria-label="' + esc(cw[k].label) + '"><i style="background:' + cw[k].shell + '"></i></button>';
    }).join("");
  }
  function toggleHTML(action, label, on) {
    return '<button class="tool' + (on ? " on" : "") + '" data-action="' + action + '" aria-pressed="' + (on ? "true" : "false") + '"><i></i>' + label + '</button>';
  }
  function renderToolbar() {
    if (!toolbar) return;
    const m = state.mode;
    let h = '<div class="tool-group"><span class="tool-label">FINISH</span><div class="swatches">' + swatchHTML() + '</div></div>';
    if (m === "sheet") {
      h += '<div class="tool-group"><span class="tool-label">OVERLAYS</span>' + toggleHTML("dimensions", "DIMENSIONS", state.dimensions) + toggleHTML("xray", "X-RAY", state.xray) + '</div>';
    } else if (m === "orbit") {
      h += '<div class="tool-group"><span class="tool-label">VIEW</span><button class="tool" data-action="orbit-face">FACE</button><button class="tool" data-action="orbit-iso">ISO</button><button class="tool" data-action="orbit-rear">REAR</button></div>';
      h += '<div class="tool-group"><span class="tool-label">OVERLAYS</span>' + toggleHTML("xray", "X-RAY", state.xray) + toggleHTML("lightbar", "LIGHT BAR", state.lightbar) + toggleHTML("autorotate", "AUTO-ROTATE", state.autoRotate) + '</div>';
      h += '<div class="tool-group slider-group"><span class="tool-label">EXPLODED</span><input id="explode" type="range" min="0" max="100" value="' + Math.round(state.exploded * 100) + '"><button class="tool ghost" data-action="reset-orbit">RESET</button></div>';
    } else if (m === "graph") {
      h += '<div class="tool-group"><span class="tool-label">FOCUS</span><button class="tool" data-action="focus-product">PRODUCT</button><button class="tool" data-action="focus-shell">SHELL</button><button class="tool" data-action="focus-input">INPUT</button><button class="tool" data-action="focus-haptics">HAPTICS</button></div>';
    } else {
      h += '<div class="tool-group"><span class="tool-label">ROWS</span><span class="tool-readout">' + O.entities.filter(function (e) { return e.layer === "part"; }).length + ' PARTS · ' + O.entities.filter(function (e) { return e.layer === "assembly"; }).length + ' ASSEMBLIES</span></div>';
    }
    toolbar.innerHTML = h;
  }

  // ---------------------------------------------------------------- tree
  function matchesFilter(e) {
    const f = state.filter;
    if (f === "all") return true;
    if (f === "physical") return ["product", "system", "assembly", "part", "control"].indexOf(e.layer) >= 0;
    if (f === "function") return ["feature", "state", "interaction"].indexOf(e.layer) >= 0;
    if (f === "geometry") return ["geometry", "curve", "dimension"].indexOf(e.layer) >= 0;
    if (f === "spec") return ["interface", "standard", "process"].indexOf(e.layer) >= 0;
    if (f === "materials") return ["material", "finish", "color"].indexOf(e.layer) >= 0;
    return true;
  }
  function nodeRow(id, depth, hasChildren) {
    const e = byId.get(id);
    if (!e || !matchesFilter(e)) return "";
    const active = state.selectedId === id ? " active" : "";
    const pad = 8 + depth * 12;
    return '<div class="tree-row' + active + '" data-node="' + esc(id) + '" style="padding-left:' + pad + 'px" title="' + esc(e.id) + '">' +
      '<i class="dot" style="background:' + layerColor(e) + '"></i>' +
      '<span class="t-label">' + esc(e.label) + '</span>' +
      (hasChildren ? '<span class="t-count">' + childrenOf(id).length + '</span>' : "") +
      '</div>';
  }
  function subtreeHTML(id, depth) {
    const kids = childrenOf(id).filter(function (k) { return matchesFilter(byId.get(k)); });
    let h = nodeRow(id, depth, kids.length > 0);
    if (kids.length) {
      h += '<div class="tree-children">' + kids.map(function (k) { return subtreeHTML(k, depth + 1); }).join("") + '</div>';
    }
    return h;
  }
  function renderTree() {
    if (!tree) return;
    const keepScroll = tree.scrollTop;
    if (state.search.trim()) {
      const q = state.search.trim().toLowerCase();
      const hits = O.entities.filter(function (e) {
        return (e.label + " " + e.id + " " + (e.summary || "")).toLowerCase().indexOf(q) >= 0;
      }).slice(0, 80);
      tree.innerHTML = '<div class="tree-section">' + hits.length + ' MATCHES</div>' + hits.map(function (e) {
        return '<div class="tree-row flat' + (state.selectedId === e.id ? " active" : "") + '" data-node="' + esc(e.id) + '" style="padding-left:8px"><i class="dot" style="background:' + layerColor(e) + '"></i><span class="t-label">' + esc(e.label) + '</span><span class="t-type">' + esc(classLabel(e)) + '</span></div>';
      }).join("");
      tree.scrollTop = 0;
      return;
    }
    let h = '<div class="tree-section">PRODUCT TREE</div>';
    h += subtreeHTML("product.dualsense", 0);
    const groups = [
      ["function", "FEATURES & BEHAVIOUR", ["feature", "state", "interaction"]],
      ["geometry", "GEOMETRY & DIMENSIONS", ["geometry", "curve", "dimension"]],
      ["materials", "MATERIALS & FINISHES", ["material", "finish", "color"]],
      ["spec", "INTERFACES & STANDARDS", ["interface", "standard", "process"]],
    ];
    for (const g of groups) {
      const items = O.entities.filter(function (e) { return g[2].indexOf(e.layer) >= 0 && matchesFilter(e); });
      if (!items.length) continue;
      h += '<details class="tree-group" open><summary>' + g[1] + '<span>' + items.length + '</span></summary>' + items.map(function (e) {
        return '<div class="tree-row flat' + (state.selectedId === e.id ? " active" : "") + '" data-node="' + esc(e.id) + '" style="padding-left:8px"><i class="dot" style="background:' + layerColor(e) + '"></i><span class="t-label">' + esc(e.label) + '</span><span class="t-type">' + esc(classLabel(e)) + '</span></div>';
      }).join("") + '</details>';
    }
    tree.innerHTML = h;
    tree.scrollTop = keepScroll;
  }

  // ---------------------------------------------------------------- inspector
  function confCounts(e) {
    const c = { V: 0, E: 0, U: 0 };
    for (const p of (e.props || [])) c[p.c] = (c[p.c] || 0) + 1;
    return c;
  }
  function chip(c) { return '<span class="conf conf-' + c + '" title="' + (c === "V" ? "Verified" : c === "E" ? "Estimated" : "Unknown") + '">' + c + '</span>'; }
  function sourceLink(s) {
    const src = sources.get(s);
    if (!src) return '<span class="src">' + esc(s) + '</span>';
    return '<a class="src" href="' + esc(src.url) + '" target="_blank" rel="noopener" title="' + esc(src.label) + '">' + esc(s) + '</a>';
  }
  function renderOverview() {
    const counts = {};
    for (const e of O.entities) counts[e.layer] = (counts[e.layer] || 0) + 1;
    const rel = O.entities.reduce(function (n, e) { return n + (e.links ? e.links.length : 0) + (e.parent ? 1 : 0); }, 0);
    const props = O.entities.reduce(function (n, e) { return n + (e.props ? e.props.length : 0); }, 0);
    let h = '<div class="insp-head"><span class="eyebrow">ONTOLOGY / OVERVIEW</span><h2>What this is</h2></div>';
    h += '<p class="summary">A research-grounded, machine-readable model of the PlayStation 5 DualSense (CFI-ZCT1W), rendered entirely as <b>SVG projections</b>. Every drawn part traces back to an ontology entity with dimensions, materials, geometry, sources and confidence.</p>';
    h += '<div class="overview-stats">';
    const stats = [["ENTITIES", O.entities.length], ["RELATIONS", rel], ["ASSERTIONS", props], ["SOURCES", O.sources.length]];
    for (const s of stats) h += '<div class="ostat"><b>' + s[1] + '</b><span>' + s[0] + '</span></div>';
    h += '</div>';
    h += '<div class="insp-section"><h3>ENVELOPE</h3><div class="kv-grid">' +
      '<div><span>WIDTH</span><b>160 mm</b></div><div><span>THICKNESS</span><b>66 mm</b></div><div><span>FRONT HEIGHT</span><b>106 mm</b></div><div><span>MASS</span><b>280 g</b></div>' +
      '</div><p class="note">Sony labels the 66 mm axis “height” and the 106 mm axis “depth”; this atlas resolves them geometrically as thickness and face-on height.</p></div>';
    h += '<div class="insp-section"><h3>LAYERS</h3><div class="layer-grid">';
    const order = [["product", "Product"], ["system", "Subsystems"], ["assembly", "Assemblies"], ["part", "Parts"], ["control", "Controls"], ["feature", "Features"], ["geometry", "Geometry"], ["material", "Materials"], ["spec", "Spec"]];
    const specLayers = ["interface", "standard", "process", "state", "interaction"];
    const specCount = specLayers.reduce(function (n, l) { return n + (counts[l] || 0); }, 0);
    for (const o of order) {
      let n = counts[o[0]];
      if (o[0] === "spec") n = specCount;
      h += '<div class="lrow"><i style="background:' + (CLASS_COLOR[o[0]] || "#8b98a8") + '"></i><span>' + o[1] + '</span><b>' + (n || 0) + '</b></div>';
    }
    h += '</div></div>';
    h += '<div class="insp-section"><h3>HOW TO EXPLORE</h3><ol class="howto"><li>Click any part in the drawing — or a node in the tree.</li><li>Read its dimensions, material, geometry and sources.</li><li>Switch to <b>Orbit</b>, toggle <b>X-ray</b> and drag the exploded slider.</li><li>Use <b>Graph</b> to walk the relations; <b>Matrix</b> to compare parts.</li></ol></div>';
    h += '<div class="insp-section"><h3>SOURCES</h3><div class="source-list">' + O.sources.map(function (s) {
      return '<a href="' + esc(s.url) + '" target="_blank" rel="noopener" class="source-item"><b>' + esc(s.id) + '</b><span>' + esc(s.label) + '</span></a>';
    }).join("") + '</div></div>';
    return h;
  }
  function renderInspector() {
    if (!inspector) return;
    const e = state.selectedId ? byId.get(state.selectedId) : null;
    if (!e) { inspector.innerHTML = renderOverview(); return; }
    const conf = confCounts(e);
    const totalC = conf.V + conf.E + conf.U || 1;
    const edges = edgesOf(e.id);
    const fc = faceCount.get(e.id) || 0;
    let h = '<div class="insp-head"><div class="insp-top"><span class="eyebrow">SELECTED / ' + esc(classLabel(e).toUpperCase()) + '</span><button class="close" data-clear aria-label="Clear selection">✕</button></div>';
    h += '<h2>' + esc(e.label) + '</h2><code class="eid">' + esc(e.id) + '</code></div>';
    h += '<p class="summary">' + esc(e.summary || "") + '</p>';
    h += '<div class="confbar" title="Attribute confidence">' +
      '<i class="cV" style="width:' + (conf.V / totalC * 100) + '%"></i><i class="cE" style="width:' + (conf.E / totalC * 100) + '%"></i><i class="cU" style="width:' + (conf.U / totalC * 100) + '%"></i></div>';
    h += '<div class="conflegend"><span>' + conf.V + ' verified</span><span>' + conf.E + ' estimated</span><span>' + conf.U + ' unknown</span>' + (fc ? '<span class="faces">' + fc + ' faces</span>' : "") + '</div>';
    if (e.props && e.props.length) {
      h += '<div class="insp-section"><h3>ATTRIBUTES</h3><table class="props"><tbody>';
      for (const p of e.props) {
        const v = p.v == null ? "—" : String(p.v);
        h += '<tr><th>' + esc(p.k) + '</th><td><b>' + esc(v) + (p.u ? ' <em>' + esc(p.u) + '</em>' : "") + '</b>' + (p.note ? '<small>' + esc(p.note) + '</small>' : "") + '</td><td class="c">' + chip(p.c) + sourceLink(p.s) + '</td></tr>';
      }
      h += '</tbody></table></div>';
    }
    if (e.geom && e.geom.length) {
      h += '<div class="insp-section"><h3>GEOMETRY</h3><div class="geom-list">';
      const seen = {};
      for (const g of e.geom) {
        const key = g.kind + "|" + (g.mat || "");
        if (seen[key]) continue; seen[key] = 1;
        h += '<div class="geom-row"><b>' + esc(g.kind) + '</b><span>' + esc((G.materials.get(g.mat) || {}).label || g.mat || "—") + '</span>' + (g.hidden ? '<i class="ghost-tag">X-RAY</i>' : "") + '</div>';
      }
      h += '</div></div>';
    }
    if (edges.out.length || edges.inc.length) {
      h += '<div class="insp-section"><h3>RELATIONS <em>' + (edges.out.length + edges.inc.length) + '</em></h3><div class="relations">';
      const show = function (list, dir) {
        return list.slice(0, 40).map(function (r) {
          const target = byId.get(r.o);
          if (!target) return "";
          return '<button class="rel" data-node="' + esc(r.o) + '"><span class="rel-p">' + (dir === "in" ? "← " : "") + esc(predLabel(r.p)) + (dir === "out" ? " →" : "") + '</span><span class="rel-o"><i style="background:' + layerColor(target) + '"></i>' + esc(target.label) + '</span></button>';
        }).join("");
      };
      h += show(edges.out, "out") + show(edges.inc, "in");
      h += '</div></div>';
    }
    const srcs = [];
    for (const p of (e.props || [])) if (p.s && srcs.indexOf(p.s) < 0) srcs.push(p.s);
    if (srcs.length) {
      h += '<div class="insp-section"><h3>EVIDENCE</h3><div class="source-list">' + srcs.map(function (s) {
        const src = sources.get(s); if (!src) return "";
        return '<a href="' + esc(src.url) + '" target="_blank" rel="noopener" class="source-item"><b>' + esc(s) + '</b><span>' + esc(src.label) + '</span></a>';
      }).join("") + '</div></div>';
    }
    inspector.innerHTML = h;
  }

  // ---------------------------------------------------------------- graph
  function neighborIds(id) {
    const map = new Map();
    const add = function (nid, pred, dir) { if (!byId.has(nid) || nid === id) return; if (!map.has(nid)) map.set(nid, { id: nid, pred: pred, dir: dir }); };
    const e = byId.get(id);
    if (!e) return [];
    if (e.parent) add(e.parent, "partOf", "out");
    for (const c of childrenOf(id)) add(c, "hasPart", "in");
    for (const l of (e.links || [])) add(l.o, l.p, "out");
    for (const other of O.entities) {
      if (other.id === id) continue;
      for (const l of (other.links || [])) if (l.o === id) add(other.id, l.p, "in");
    }
    const arr = Array.from(map.values());
    const prio = { system: 1, assembly: 2, part: 3, feature: 4, control: 5, sensor: 6, actuator: 6, interface: 7, geometry: 8, dimension: 9 };
    arr.sort(function (a, b) {
      const ea = byId.get(a.id), eb = byId.get(b.id);
      return (prio[ea.layer] || 20) - (prio[eb.layer] || 20);
    });
    return arr;
  }
  function renderGraph() {
    const centerId = state.selectedId && byId.get(state.selectedId) ? state.selectedId : "product.dualsense";
    const center = byId.get(centerId);
    const neigh = neighborIds(centerId).slice(0, 34);
    const W = 1600, H = 1000, cx = 800, cy = 500;
    const inner = neigh.slice(0, 14), outer = neigh.slice(14);
    const nodes = [{ id: centerId, x: cx, y: cy, r: 1 }];
    inner.forEach(function (n, i) {
      const a = -Math.PI / 2 + i * Math.PI * 2 / inner.length;
      nodes.push({ id: n.id, x: cx + Math.cos(a) * 245, y: cy + Math.sin(a) * 245, r: 0, pred: n.pred, dir: n.dir });
    });
    outer.forEach(function (n, i) {
      const a = -Math.PI / 2 + i * Math.PI * 2 / outer.length + 0.2;
      nodes.push({ id: n.id, x: cx + Math.cos(a) * 440, y: cy + Math.sin(a) * 390, r: 0, pred: n.pred, dir: n.dir });
    });
    const out = [];
    out.push('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + ' ' + H + '" class="drawing-svg graph-svg" role="img" aria-label="Ontology relationship graph">');
    out.push('<defs><pattern id="ggrid" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M40 0H0V40" fill="none" stroke="#14212c" stroke-width="0.6"/></pattern><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10Z" fill="#3d5b70"/></marker></defs>');
    out.push('<rect width="' + W + '" height="' + H + '" fill="#050a0f"/><rect width="' + W + '" height="' + H + '" fill="url(#ggrid)" opacity="0.7"/>');
    out.push('<text x="54" y="64" class="view-label">EGO GRAPH / ' + esc(center.label.toUpperCase()) + '</text>');
    out.push('<text x="1546" y="64" class="view-scale" text-anchor="end">' + neigh.length + ' DIRECT NEIGHBOURS  ·  CLICK TO RECENTER</text>');
    // edges
    for (const n of nodes.slice(1)) {
      const isOut = n.dir === "out";
      out.push('<path d="M' + cx + ' ' + cy + 'L' + n.x.toFixed(1) + ' ' + n.y.toFixed(1) + '" stroke="' + (isOut ? "#2e6d84" : "#6b4f2c") + '" stroke-width="0.9" marker-end="url(#arrow)"/>');
      if (nodes.length <= 22) {
        const mx = (cx + n.x) / 2, my = (cy + n.y) / 2;
        out.push('<text x="' + mx.toFixed(1) + '" y="' + (my - 4).toFixed(1) + '" class="edge-label" text-anchor="middle">' + esc(predLabel(n.pred)) + '</text>');
      }
    }
    // nodes
    for (const n of nodes) {
      const e = byId.get(n.id);
      const isCenter = n.id === centerId;
      const w = isCenter ? 240 : 190, h = isCenter ? 58 : 34;
      const x = n.x - w / 2, y = n.y - h / 2;
      const col = layerColor(e);
      out.push('<g class="gnode' + (isCenter ? " center" : "") + (state.selectedId === n.id ? " active" : "") + '" data-node="' + esc(n.id) + '">');
      out.push('<rect x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + w + '" height="' + h + '" rx="3" fill="' + (isCenter ? "#0b1a24" : "#081119") + '" stroke="' + (isCenter ? "#6ee7ff" : "#203440") + '" stroke-width="' + (isCenter ? 1.2 : 0.8) + '"/>');
      out.push('<rect x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" width="4" height="' + h + '" fill="' + col + '"/>');
      out.push('<text x="' + (x + 14).toFixed(1) + '" y="' + (y + (isCenter ? 24 : 15)).toFixed(1) + '" class="g-label">' + esc(e.label.length > 28 ? e.label.slice(0, 27) + "…" : e.label) + '</text>');
      out.push('<text x="' + (x + 14).toFixed(1) + '" y="' + (y + (isCenter ? 42 : 27)).toFixed(1) + '" class="g-type">' + esc(classLabel(e)) + '</text>');
      out.push('<title>' + esc(e.label + " — " + (e.summary || "")) + '</title>');
      out.push('</g>');
    }
    out.push('<text x="54" y="946" class="footer">' + O.entities.length + ' ENTITIES  ·  ' + O.entities.reduce(function (n, e) { return n + (e.links ? e.links.length : 0) + (e.parent ? 1 : 0); }, 0) + ' RELATIONS  ·  RADIAL EGO LAYOUT</text>');
    out.push('<text x="1546" y="946" class="footer" text-anchor="end">CYAN = OUTGOING  ·  AMBER = INCOMING</text>');
    out.push('</svg>');
    return out.join("");
  }

  // ---------------------------------------------------------------- matrix
  function physicalRows() {
    const rows = [];
    const walk = function (id, depth) {
      const e = byId.get(id); if (!e) return;
      rows.push({ id: id, depth: depth, e: e });
      for (const c of childrenOf(id)) walk(c, depth + 1);
    };
    walk("product.dualsense", 0);
    return rows;
  }
  function renderMatrix() {
    const rows = physicalRows();
    const out = [];
    out.push('<div class="matrix-wrap"><div class="matrix-head"><span class="eyebrow">PART MATRIX</span><h2>' + rows.length + ' physical entities, compared</h2><p>Material, geometry archetype, face count and evidence confidence for every physical node in the ontology. Click a row to select it.</p></div>');
    out.push('<table class="matrix"><thead><tr><th>ENTITY</th><th>TYPE</th><th>MATERIAL</th><th>GEOMETRY</th><th>FACES</th><th>FACTS</th></tr></thead><tbody>');
    for (const r of rows) {
      const e = r.e;
      const mats = new Set();
      for (const g of (e.geom || [])) if (g.mat) mats.add((G.materials.get(g.mat) || {}).label || g.mat);
      for (const l of (e.links || [])) if (l.p === "hasMaterial" && byId.has(l.o)) mats.add(byId.get(l.o).label);
      const geoms = new Set(); for (const g of (e.geom || [])) geoms.add(g.kind);
      const conf = confCounts(e);
      out.push('<tr data-node="' + esc(e.id) + '"' + (state.selectedId === e.id ? ' class="active"' : '') + '><td><i class="dot" style="background:' + layerColor(e) + '"></i><span style="padding-left:' + (r.depth * 14) + 'px">' + esc(e.label) + '</span></td><td class="mtype">' + esc(classLabel(e)) + '</td><td>' + esc(Array.from(mats).slice(0, 2).join(", ") || "—") + '</td><td>' + esc(Array.from(geoms).join(", ") || "—") + '</td><td class="num">' + (faceCount.get(e.id) || 0) + '</td><td class="mconf"><span class="conf conf-V">' + conf.V + '</span><span class="conf conf-E">' + conf.E + '</span><span class="conf conf-U">' + conf.U + '</span></td></tr>');
    }
    out.push('</tbody></table></div>');
    return out.join("");
  }

  // ---------------------------------------------------------------- status / tooltip
  function updateStatus() {
    const el = document.getElementById("status-text");
    if (!el) return;
    const e = state.selectedId ? byId.get(state.selectedId) : null;
    el.innerHTML = '<span class="st-mode">' + state.mode.toUpperCase() + '</span><i></i><span>' + (e ? esc(e.label) : "NO SELECTION") + '</span><i></i><span>' + MODES[state.mode].hint + '</span>';
  }
  function showTooltip(x, y, id) {
    if (!tooltip) return;
    const e = byId.get(id);
    if (!e) { tooltip.classList.remove("show"); return; }
    const conf = confCounts(e);
    tooltip.innerHTML = '<b>' + esc(e.label) + '</b><span>' + esc(classLabel(e)) + ' · ' + e.layer + '</span><div class="tt-conf">' + conf.V + 'V / ' + conf.E + 'E / ' + conf.U + 'U</div>';
    tooltip.style.left = (x + 16) + "px";
    tooltip.style.top = (y + 16) + "px";
    tooltip.classList.add("show");
  }
  function hideTooltip() { if (tooltip) tooltip.classList.remove("show"); }

  // ---------------------------------------------------------------- interactions
  function bind() {
    stage = document.getElementById("stage");
    tree = document.getElementById("tree");
    inspector = document.getElementById("inspector");
    toolbar = document.getElementById("toolbar");
    tooltip = document.getElementById("tooltip");

    document.getElementById("tabs").addEventListener("click", function (ev) {
      const b = ev.target.closest("[data-mode]"); if (!b) return; setMode(b.getAttribute("data-mode"));
    });
    toolbar.addEventListener("click", function (ev) {
      const sw = ev.target.closest("[data-color]");
      if (sw) { state.colorway = sw.getAttribute("data-color"); renderToolbar(); renderStage(); return; }
      const b = ev.target.closest("[data-action]");
      if (!b) return;
      const a = b.getAttribute("data-action");
      if (a === "dimensions") state.dimensions = !state.dimensions;
      else if (a === "xray") state.xray = !state.xray;
      else if (a === "lightbar") state.lightbar = !state.lightbar;
      else if (a === "autorotate") { state.autoRotate = !state.autoRotate; if (state.autoRotate) startAuto(); else stopAuto(); }
      else if (a === "reset-orbit") { state.orbit = { yaw: -24, tilt: 34, zoom: 1 }; }
      else if (a === "orbit-face") { state.orbit = { yaw: 0, tilt: 0, zoom: 1.08 }; }
      else if (a === "orbit-iso") { state.orbit = { yaw: -24, tilt: 34, zoom: 1 }; }
      else if (a === "orbit-rear") { state.orbit = { yaw: 180, tilt: 140, zoom: 1.02 }; }
      else if (a === "focus-product") setSelected("product.dualsense");
      else if (a === "focus-shell") setSelected("sys.shell");
      else if (a === "focus-input") setSelected("sys.input");
      else if (a === "focus-haptics") setSelected("sys.haptics");
      renderToolbar(); renderStage();
    });
    toolbar.addEventListener("input", function (ev) {
      if (ev.target.id === "explode") { state.exploded = Number(ev.target.value) / 100; renderStage(); }
    });
    const searchEl = document.getElementById("search");
    if (searchEl) searchEl.placeholder = "Search " + O.entities.length + " entities…";
    searchEl.addEventListener("input", function (ev) { state.search = ev.target.value; renderTree(); });
    document.getElementById("layerFilter").addEventListener("change", function (ev) { state.filter = ev.target.value; renderTree(); });
    tree.addEventListener("click", function (ev) {
      const row = ev.target.closest("[data-node]"); if (!row) return;
      setSelected(row.getAttribute("data-node"));
    });
    inspector.addEventListener("click", function (ev) {
      if (ev.target.closest("[data-clear]")) { setSelected(null); return; }
      const n = ev.target.closest("[data-node]"); if (!n) return;
      setSelected(n.getAttribute("data-node"));
    });

    stage.addEventListener("click", function (ev) {
      if (state.mode === "graph") { const n = ev.target.closest("[data-node]"); if (n) { setSelected(n.getAttribute("data-node")); } return; }
      if (state.mode === "matrix") { const r = ev.target.closest("tr[data-node]"); if (r) setSelected(r.getAttribute("data-node")); return; }
      const p = ev.target.closest("[data-part]");
      if (p) setSelected(p.getAttribute("data-part"));
      else setSelected(null);
    });
    stage.addEventListener("pointermove", function (ev) {
      const rect = stage.getBoundingClientRect();
      const x = ev.clientX - rect.left, y = ev.clientY - rect.top;
      if (dragging && state.mode === "orbit") {
        state.orbit.yaw = (state.orbit.yaw + (ev.clientX - dragX) * 0.35) % 360;
        state.orbit.tilt = Math.max(-70, Math.min(160, state.orbit.tilt - (ev.clientY - dragY) * 0.3));
        dragX = ev.clientX; dragY = ev.clientY;
        scheduleStage();
        return;
      }
      const el = ev.target.closest("[data-node],[data-part]");
      if (!el) { hideTooltip(); clearHover(); return; }
      const id = el.getAttribute("data-node") || el.getAttribute("data-part");
      showTooltip(x, y, id);
      setHover(id);
    });
    stage.addEventListener("pointerleave", function () { hideTooltip(); clearHover(); });
    stage.addEventListener("pointerdown", function (ev) {
      if (state.mode !== "orbit") return;
      dragging = true; dragX = ev.clientX; dragY = ev.clientY;
      stage.setPointerCapture && stage.setPointerCapture(ev.pointerId);
      stage.classList.add("dragging");
    });
    stage.addEventListener("pointerup", function (ev) { dragging = false; stage.classList.remove("dragging"); try { stage.releasePointerCapture(ev.pointerId); } catch (e) {} });
    stage.addEventListener("pointercancel", function () { dragging = false; stage.classList.remove("dragging"); });
    stage.addEventListener("wheel", function (ev) {
      if (state.mode !== "orbit") return;
      ev.preventDefault();
      state.orbit.zoom = Math.max(0.62, Math.min(1.9, state.orbit.zoom * (ev.deltaY > 0 ? 0.94 : 1.06)));
      scheduleStage();
    }, { passive: false });
    stage.addEventListener("dblclick", function () { if (state.mode === "orbit") { state.orbit = { yaw: -24, tilt: 34, zoom: 1 }; renderStage(); } });
    document.addEventListener("keydown", function (ev) {
      if (ev.target.tagName === "INPUT" || ev.target.tagName === "SELECT" || ev.target.tagName === "TEXTAREA") return;
      if (ev.key === "1") setMode("sheet");
      else if (ev.key === "2") setMode("orbit");
      else if (ev.key === "3") setMode("graph");
      else if (ev.key === "4") setMode("matrix");
      else if (ev.key === "d" || ev.key === "D") { state.dimensions = !state.dimensions; renderToolbar(); renderStage(); }
      else if (ev.key === "x" || ev.key === "X") { state.xray = !state.xray; renderToolbar(); renderStage(); }
      else if (ev.key === "l" || ev.key === "L") { state.lightbar = !state.lightbar; renderToolbar(); renderStage(); }
      else if (ev.key === "r" || ev.key === "R") { state.orbit = { yaw: -24, tilt: 34, zoom: 1 }; renderStage(); }
      else if (ev.key === "Escape") setSelected(null);
    });
  }

  function setHover(id) {
    if (hoverPart === id) return;
    clearHover();
    hoverPart = id;
    const nodes = stage.querySelectorAll('[data-part="' + id + '"], [data-node="' + id + '"]');
    for (const n of nodes) n.classList.add("is-hover");
  }
  function clearHover() {
    if (!hoverPart) return;
    const nodes = stage.querySelectorAll(".is-hover");
    for (const n of nodes) n.classList.remove("is-hover");
    hoverPart = null;
  }

  function startAuto() {
    if (raf) return;
    lastFrame = 0;
    const tick = function (t) {
      if (!state.autoRotate || state.mode !== "orbit") { raf = null; return; }
      if (t - lastFrame > 40) {
        state.orbit.yaw = (state.orbit.yaw + 0.5) % 360;
        renderStage();
        lastFrame = t;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
  }
  function stopAuto() { state.autoRotate = false; if (raf) { cancelAnimationFrame(raf); raf = null; } }

  // ---------------------------------------------------------------- init
  function init() {
    bind();
    renderToolbar();
    renderTree();
    renderInspector();
    renderStage();
    updateStatus();
    document.getElementById("header-stats").innerHTML = '<b>' + O.entities.length + '</b> ENTITIES <i></i><b>' + O.entities.reduce(function (n, e) { return n + (e.links ? e.links.length : 0) + (e.parent ? 1 : 0); }, 0) + '</b> RELATIONS <i></i><b>' + O.sources.length + '</b> SOURCES';
    document.getElementById("layerFilter").value = state.filter;
    setMode("sheet");
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
  window.DSA_APP = { state: state, setMode: setMode, setSelected: setSelected, renderStage: renderStage, renderGraph: renderGraph, renderMatrix: renderMatrix };
})();
