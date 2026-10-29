import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const onto = JSON.parse(readFileSync(join(root, "ontology", "compound-bow.ontology.json"), "utf8"));
const dims = JSON.parse(readFileSync(join(root, "refs", "dimensions.json"), "utf8"));

let pass = 0, fail = 0;
const failed = [];
function check(name, ok, detail) {
  if (ok) { pass++; console.log("  ok   " + name + (detail ? "    " + detail : "")); }
  else { fail++; failed.push(name); console.log("  FAIL " + name + (detail ? "    " + detail : "")); }
}
const setOf = (arr) => new Set(arr.map((x) => x.id));
const classIds = setOf(onto.classes);
const materialIds = setOf(onto.materials);
const individualIds = setOf(onto.individuals);
const propIds = setOf(onto.objectProperties);
const dataIds = setOf(onto.datatypeProperties);
function dups(arr) { const s = new Set(), d = []; for (const x of arr) { if (s.has(x.id)) d.push(x.id); s.add(x.id); } return d; }

console.log("1. referential integrity");
check("class ids unique", dups(onto.classes).length === 0, dups(onto.classes).join(","));
check("individual ids unique", dups(onto.individuals).length === 0, dups(onto.individuals).join(","));
check("material ids unique", dups(onto.materials).length === 0, dups(onto.materials).join(","));
check("object property ids unique", dups(onto.objectProperties).length === 0, dups(onto.objectProperties).join(","));

const badParents = onto.classes.filter((c) => c.parent !== null && c.parent !== undefined && !classIds.has(c.parent)).map((c) => c.id + "->" + c.parent);
check("every class parent exists", badParents.length === 0, badParents.join(", "));
const badClass = onto.individuals.filter((i) => !classIds.has(i.class)).map((i) => i.id + ":" + i.class);
check("every individual class exists", badClass.length === 0, badClass.join(", "));
const badProp = onto.objectProperties.filter((p) => !classIds.has(p.domain) || !classIds.has(p.range)).map((p) => p.id);
check("object property domains and ranges exist", badProp.length === 0, badProp.join(", "));

const matRefs = [];
for (const c of onto.classes) for (const m of (c.typicalMaterials || [])) matRefs.push([c.id, m]);
for (const i of onto.individuals) if (i.material) matRefs.push([i.id, i.material]);
const badMat = matRefs.filter((r) => !materialIds.has(r[1])).map((r) => r[0] + ":" + r[1]);
check("every material reference resolves", badMat.length === 0, badMat.join(", "));
check("materials themselves are referenced", onto.materials.every((m) => matRefs.some((r) => r[1] === m.id)));

console.log("2. the class tree is a forest");
const parentOf = new Map(onto.classes.map((c) => [c.id, c.parent]));
let cyclic = null;
for (const c of onto.classes) {
  const seen = new Set(); let cur = c.id;
  while (cur !== null && cur !== undefined) {
    if (seen.has(cur)) { cyclic = c.id; break; }
    seen.add(cur); cur = parentOf.get(cur);
  }
  if (cyclic) break;
}
check("no parent cycle", cyclic === null, cyclic || "");
const roots = onto.classes.filter((c) => c.parent === null || c.parent === undefined);
check("multiple roots form a forest", roots.length >= 4, roots.length + " roots");

console.log("3. individuals reference real parts");
const partRefKeys = ["partOf", "holds", "dampens", "rotatablyCoupledTo", "wraps", "supports", "mountsOn", "anchoredTo", "spans", "synchronisesWith", "threadedInto", "bearsOn", "connectsTo"];
const unresolved = [];
for (const i of onto.individuals) {
  for (const k of partRefKeys) {
    if (!(k in i)) continue;
    for (const v of [].concat(i[k])) {
      if (!individualIds.has(v)) unresolved.push(i.id + "." + k + "->" + v);
    }
  }
}
check("all part references resolve", unresolved.length === 0, unresolved.join(", "));
const unknownKeys = [];
const knownProps = new Set(onto.objectProperties.map((p) => p.id).concat(["partOf", "interfaces", "sets", "biases", "limits", "note"]));
for (const i of onto.individuals) {
  for (const k of Object.keys(i)) {
    if (["id", "label", "class", "material", "qty"].includes(k)) continue;
    if (!knownProps.has(k)) unknownKeys.push(i.id + "." + k);
  }
}
check("individual keys are known relations", unknownKeys.length === 0, unknownKeys.join(", "));

console.log("4. every part belongs to a subsystem and a build phase");
const inSub = new Set(onto.subsystems.flatMap((s) => s.parts));
const badSub = onto.individuals.filter((i) => !inSub.has(i.id)).map((i) => i.id);
check("all individuals grouped into a subsystem", badSub.length === 0, badSub.join(", "));
const inBuild = new Set(onto.buildPhases.flatMap((b) => b.parts));
const badBuild = onto.individuals.filter((i) => !inBuild.has(i.id)).map((i) => i.id);
check("all individuals appear in a build phase", badBuild.length === 0, badBuild.join(", "));
const ghostSub = onto.subsystems.flatMap((s) => s.parts).filter((x) => !individualIds.has(x));
check("no ghost subsystem parts", ghostSub.length === 0, ghostSub.join(", "));
const ghostBuild = onto.buildPhases.flatMap((b) => b.parts).filter((x) => !individualIds.has(x));
check("no ghost build-phase parts", ghostBuild.length === 0, ghostBuild.join(", "));

console.log("5. mechanics");
const tops = new Set(onto.mechanics.eccentricTopologies.map((t) => t.id));
check("reference topology exists", tops.has(onto.mechanics.referenceEccentricSystem.topology), onto.mechanics.referenceEccentricSystem.topology);
const phases = onto.mechanics.drawCycle.phases.map((p) => p.id);
check("draw cycle has brace, peak-ward and wall phases", phases.includes("brace") && phases.length >= 5, phases.length + " phases");
check("cam rotation matches the annotated reference", onto.mechanics.drawCycle.totalCamRotation_deg === 210);
const ex = onto.mechanics.letOff.examples;
check("let-off examples are consistent", ex.every((e) => Math.abs(e.holding_lb - e.peak_lb * (1 - e.letOff_pct / 100)) < 1e-9), ex.map((e) => e.holding_lb).join(", "));

console.log("6. dimensions");
const provCodes = new Set(Object.keys(dims.meta.provenance));
const usedProv = [];
for (const r of dims.bowLevel) usedProv.push([r.id, r.provenance]);
for (const r of dims.derived) usedProv.push([r.id, r.provenance]);
for (const r of dims.componentTypical.riser) usedProv.push([r.id, r.provenance || "classTypical"]);
for (const r of dims.componentTypical.limbs) usedProv.push([r.id, r.provenance || "classTypical"]);
for (const r of dims.componentTypical.eccentrics) usedProv.push([r.id, r.provenance || "classTypical"]);
for (const r of dims.componentTypical.cables) usedProv.push([r.id, r.provenance || "classTypical"]);
for (const r of dims.componentTypical.arrow) usedProv.push([r.id, r.provenance || "classTypical"]);
const badProv = usedProv.filter((r) => !provCodes.has(r[1])).map((r) => r[0] + ":" + r[1]);
check("all provenance codes are declared", badProv.length === 0, badProv.join(", "));

const ref = onto.meta.reference.publishedSpecs;
const byId = new Map(dims.bowLevel.map((r) => [r.id, r.value]));
check("ATA matches the reference bow", byId.get("axleToAxle") === ref.axleToAxle_in);
check("brace height matches the reference bow", byId.get("braceHeight") === ref.braceHeight_in);
check("IBO speed matches the reference bow", byId.get("iboSpeed") === ref.iboSpeed_fps);
check("mass matches the reference bow", byId.get("massWeight") === ref.massWeight_lb);
check("draw-length range matches", byId.get("drawLengthMin") === ref.drawLengthRange_in[0] && byId.get("drawLengthMax") === ref.drawLengthRange_in[1]);
check("peak-weight range matches", byId.get("peakWeightMin") === ref.peakDrawWeight_lb[0] && byId.get("peakWeightMax") === ref.peakDrawWeight_lb[1]);

const D = new Map(dims.derived.map((r) => [r.id, r]));
function close(a, b, tol) { return Math.abs(a - b) <= (tol || 0.05); }
check("power stroke at 29 in draw recomputes", close(D.get("nockTravel").values.atDL29, 29 - 1.75 - 6.5));
check("85% holding weight recomputes", close(D.get("holdingWeight85").values.at70, 70 * 0.15));
check("minimum arrow mass recomputes", D.get("minArrowMass").values.at70 === 350);
check("draw-length position count recomputes", D.get("drawLengthPositions").value === 12);
check("weight-module count recomputes", D.get("weightModuleCount").value === 8);
const ke = 0.5 * (350 / 7000) * 343 * 343 / 32.174;
check("IBO arrow energy recomputes", close(D.get("arrowKE").value, ke, 0.1), ke.toFixed(2) + " ft.lb");
check("implied stored energy recomputes", close(D.get("storedEnergyAt80").value, ke / 0.8, 0.2));
check("stored/peak ratio recomputes", close(D.get("storedToPeak").value, (ke / 0.8) / 70, 0.02));
check("stored/peak flags itself as out of band", D.get("storedToPeak").confidence === "low");

const fdc = dims.forceDrawCurve.points_by_letOff;
check("both let-off curves present", !!fdc["85"] && !!fdc["80"]);
for (const key of ["85", "80"]) {
  const pts = fdc[key];
  const expectedHold = 1 - Number(key) / 100;
  check("curve " + key + "% ends at its holding weight", close(pts[pts.length - 1].forceFraction, expectedHold, 1e-9));
  check("curve " + key + "% reaches full peak", close(Math.max(...pts.map((p) => p.forceFraction)), 1, 1e-9));
  check("curve " + key + "% draw fractions are 0..1", pts.every((p) => p.drawFraction >= 0 && p.drawFraction <= 1));
  check("curve " + key + "% forces are 0..1", pts.every((p) => p.forceFraction >= 0 && p.forceFraction <= 1));
}

console.log("");
console.log(pass + " passed, " + fail + " failed");
if (fail) { console.log("failed: " + failed.join("; ")); process.exit(1); }
