"use strict";
const fs = require("fs");
function load(t) {
  return fs.readFileSync("data/archive/" + t + ".jsonl", "utf8").split("\n").filter(function (l) { return l.trim(); })
    .map(function (l) { return JSON.parse(l); }).sort(function (a, b) { return a.time - b.time; });
}
function ts(t) { return new Date(t * 1000).toISOString().replace("T", " ").slice(0, 19); }
function show(list, full) {
  list.forEach(function (m, i) {
    var bits = ["[" + (i + 1) + "]", ts(m.time), "prio=" + (m.priority == null ? "-" : m.priority)];
    if (m.title) bits.push("title=" + JSON.stringify(m.title));
    if (m.tags && m.tags.length) bits.push("tags=" + JSON.stringify(m.tags));
    if (m.click) bits.push("click=" + m.click);
    if (m.actions) bits.push("ACTIONS=" + JSON.stringify(m.actions).slice(0, 120));
    if (m.attachment) bits.push("ATTACH=" + JSON.stringify(m.attachment).slice(0, 120));
    console.log("  " + bits.join("  "));
    console.log("      " + String(m.message || "").replace(/\n/g, " | ").slice(0, full ? 500 : 180));
  });
}

console.log("############ alerts (10 msgs) ############");
show(load("alerts"), true);
console.log("");
console.log("############ ai (4 msgs) ############");
show(load("ai"), true);
console.log("");
console.log("############ notify (3 msgs) ############");
show(load("notify"), true);
console.log("");
console.log("############ system (12 msgs) ############");
show(load("system"), true);
console.log("");
console.log("############ vps (1 msg) ############");
show(load("vps"), true);

console.log("");
console.log("############ test : agent-signal inventory ############");
var t = load("test");
var byTitle = {};
t.forEach(function (m) {
  var k = m.title || "(no title)";
  if (!byTitle[k]) byTitle[k] = { n: 0, first: m.time, last: m.time };
  byTitle[k].n++;
  byTitle[k].last = m.time;
});
Object.keys(byTitle).sort(function (a, b) { return byTitle[b].n - byTitle[a].n; }).forEach(function (k) {
  var v = byTitle[k];
  console.log("  " + String(v.n).padStart(3) + "x  " + k.slice(0, 46).padEnd(48) + " " + ts(v.first).slice(11) + " -> " + ts(v.last).slice(11));
});
console.log("");
console.log("  deep-links / schemes seen across ALL archives:");
var all = [];
["ai","alerts","chat","fleet","llm","mcp","notify","prompt","system","test","vps"].forEach(function (x) { all = all.concat(load(x)); });
var schemes = {};
var paths = {};
all.forEach(function (m) {
  var hay = String(m.click || "") + " " + String(m.message || "");
  var sm = /([a-z][a-z0-9+.-]*):\/\//gi, mm;
  while ((mm = sm.exec(hay))) schemes[mm[1]] = (schemes[mm[1]] || 0) + 1;
  var pm = /(?:cwd=|\/Users\/|\/home\/|C:\\Users\\)([A-Za-z0-9_.-]*)/g, pm2;
  while ((pm2 = pm.exec(hay))) paths[pm2[0]] = (paths[pm2[0]] || 0) + 1;
});
console.log("    schemes: " + JSON.stringify(schemes));
console.log("    paths  : " + JSON.stringify(paths));
