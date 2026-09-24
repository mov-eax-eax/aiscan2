"use strict";
const fs = require("fs");
const path = require("path");
const S = require("../src/signals.js");
const dir = "data/archive";
const rows = [];
fs.readdirSync(dir).filter(function (f) { return f.slice(-6) === ".jsonl"; }).forEach(function (f) {
  const msgs = fs.readFileSync(path.join(dir, f), "utf8").split("\n")
    .filter(function (l) { return l.trim(); })
    .map(function (l) { try { return JSON.parse(l); } catch (e) { return null; } })
    .filter(Boolean);
  const st = S.structure(msgs);
  rows.push({ topic: f.slice(0, -6), n: msgs.length, st: st });
});
rows.sort(function (a, b) { return b.st.score - a.st.score; });

console.log("STRUCTURAL ANALYSIS over the real corpus (no network used)\n");
console.log("  topic        n     score  markers                          diagnostics");
console.log("  " + "-".repeat(100));
rows.forEach(function (r) {
  const mk = r.st.markers.map(function (m) { return m.id; }).join(",") || "-";
  const diag = "altRatio=" + r.st.altRatio + " titleAlt=" + r.st.titleAltRatio + " ac1=" + r.st.autocorr1 + " cv=" + r.st.timingCv + " distinctLen=" + r.st.distinctLengths;
  console.log("  " + r.topic.padEnd(12) + String(r.n).padStart(4) + "   " + String(r.st.score).padEnd(6) + " " + mk.padEnd(32) + " " + diag);
});

console.log("\nDETAIL for anything scoring above zero:");
rows.filter(function (r) { return r.st.score > 0; }).forEach(function (r) {
  console.log("\n  [" + r.topic + "] score=" + r.st.score);
  r.st.markers.forEach(function (m) { console.log("      " + m.id + " (w" + m.w + "): " + m.note); });
  r.st.notes.forEach(function (n) { console.log("      note: " + n); });
});

console.log("\nAutomation notes only (no structural markers):");
rows.filter(function (r) { return r.st.score === 0; }).forEach(function (r) {
  console.log("  " + r.topic.padEnd(12) + " " + r.st.notes.join("; "));
});
