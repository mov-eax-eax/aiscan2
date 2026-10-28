// DualSense Ontology Atlas - consistency validator
// Run: node validate.mjs
import fs from "node:fs";
import vm from "node:vm";

const root = new URL(".", import.meta.url);
const ctx = { window: {}, console };
vm.createContext(ctx);
for (const f of ["data/ontology.js", "data/parts.js", "data/domain.js"]) {
  vm.runInContext(fs.readFileSync(new URL(f, root), "utf8"), ctx, { filename: f });
}
const O = ctx.window.ONTOLOGY;
const ids = new Set(O.entities.map((e) => e.id));
const sources = new Set(O.sources.map((s) => s.id));
const classes = new Set(O.classes.map((c) => c.id));
const predicates = new Set(O.predicates.map((p) => p.id));
const errors = [];
const check = (id, why) => { if (id && !ids.has(id)) errors.push(why + " -> " + id); };
for (const e of O.entities) {
  if (!e.id || !e.label || !e.cls) errors.push("incomplete entity " + e.id);
  if (e.parent) check(e.parent, e.id + " parent");
  if (!classes.has(e.cls)) errors.push(e.id + " class " + e.cls);
  for (const l of (e.links || [])) {
    check(l.o, e.id + " link " + l.p);
    if (!predicates.has(l.p)) errors.push(e.id + " predicate " + l.p);
  }
  for (const p of (e.props || [])) {
    if (p.s && !sources.has(p.s)) errors.push(e.id + " source " + p.s);
    if (!["V", "E", "U"].includes(p.c)) errors.push(e.id + " confidence " + p.c);
  }
  for (const g of (e.geom || [])) {
    for (const k of ["mat", "topMat", "sideMat", "bottomMat", "outline", "rearPart"]) if (g[k]) check(g[k], e.id + " geometry " + k);
  }
}
for (const d of O.entities.filter((e) => e.layer === "dimension")) {
  if (!d.annot && d.layer === "dimension" && d.id !== "dim.weight") { /* non-annotated dims are fine */ }
}
if (errors.length) {
  console.error("FAILED with " + errors.length + " error(s):");
  for (const e of errors.slice(0, 40)) console.error("  " + e);
  process.exit(1);
}
const assertions = O.entities.reduce((n, e) => n + (e.props || []).length, 0);
const relations = O.entities.reduce((n, e) => n + (e.links || []).length + (e.parent ? 1 : 0), 0);
console.log("OK  " + O.entities.length + " entities / " + relations + " relations / " + assertions + " assertions / " + O.sources.length + " sources");
