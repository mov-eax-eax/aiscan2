"use strict";
const fs = require("fs"), path = require("path");
const S = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "data", "state.json"), "utf8"));
console.log("top-level keys: " + Object.keys(S).join(", "));
const done = S.done || {};
const by = {};
const forbidden = [], live = [];
for (const t of Object.keys(done)) {
  const e = done[t] || {};
  by[e.status] = (by[e.status] || 0) + 1;
  if (e.status === "forbidden") forbidden.push(t);
  if (e.status === "live") live.push(t + "(" + (e.count || 0) + ")");
}
console.log("done entries: " + Object.keys(done).length);
console.log("by status: " + JSON.stringify(by));
console.log("RESERVED (forbidden): " + (forbidden.sort().join(", ") || "(none)"));
console.log("live: " + (live.sort().join(", ") || "(none)"));
console.log("counters: " + JSON.stringify(S.counters || {}));
console.log("daily: " + JSON.stringify(S.daily || {}));
console.log("cursor: " + S.cursor + "/" + (S.all || S.total || "?"));
console.log("cfg: " + JSON.stringify(S.cfg || {}));
if (S.analysisVersion || S.analysis) console.log("analysisVersion: " + (S.analysisVersion || S.analysis));
