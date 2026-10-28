// Regenerate data/ontology.json from the runtime data files.
// Run: node export-json.mjs
import fs from "node:fs";
import vm from "node:vm";

const root = new URL(".", import.meta.url);
const ctx = { window: {}, console };
vm.createContext(ctx);
for (const f of ["data/ontology.js", "data/parts.js", "data/domain.js"]) {
  vm.runInContext(fs.readFileSync(new URL(f, root), "utf8"), ctx, { filename: f });
}
const O = ctx.window.ONTOLOGY;
fs.writeFileSync(new URL("data/ontology.json", root), JSON.stringify(O, null, 2) + "\n");
const assertions = O.entities.reduce((n, e) => n + (e.props || []).length, 0);
const relations = O.entities.reduce((n, e) => n + (e.links || []).length + (e.parent ? 1 : 0), 0);
console.log("wrote data/ontology.json — " + O.entities.length + " entities / " + relations + " relations / " + assertions + " assertions");
