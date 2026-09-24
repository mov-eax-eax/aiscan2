"use strict";
const fs = require("fs");
const dir = "data/archive";
let all = [];
fs.readdirSync(dir).filter(function (f) { return f.slice(-6) === ".jsonl"; }).forEach(function (f) {
  fs.readFileSync(dir + "/" + f, "utf8").split("\n").forEach(function (l) {
    if (!l.trim()) return;
    try { all.push(JSON.parse(l)); } catch (e) {}
  });
});
function ts(t) { return new Date(t * 1000).toISOString().replace("T", " ").slice(11, 19); }

// Instrumental = has a URL, or a machine-ish title, or structured payload
// Expressive   = short, no URL, no title, no digits/IDs -> someone just said something
var expressive = [];
var instrumental = 0;
all.forEach(function (m) {
  var msg = String(m.message || "");
  var hasUrl = /https?:\/\//.test(msg) || /https?:\/\//.test(String(m.click || ""));
  var hasTitle = !!m.title;
  var hasId = /\b[A-Z]{2,}-\d+|\d{4,}|@|\{|\[/.test(msg);
  if (!hasUrl && !hasTitle && !hasId && msg.trim().length > 0 && msg.length < 90) expressive.push(m);
  else instrumental++;
});
console.log("total=" + all.length + "  instrumental=" + instrumental + "  expressive=" + expressive.length);
console.log("");
console.log("=== EXPRESSIVE / NON-INSTRUMENTAL MESSAGES (verbatim) ===");
expressive.sort(function (a, b) { return a.time - b.time; }).forEach(function (m) {
  console.log("  " + String(m.topic).padEnd(9) + " " + ts(m.time) + "  prio=" + (m.priority == null ? "-" : m.priority) + "  " + JSON.stringify(String(m.message).slice(0, 80)));
});

console.log("");
console.log("=== top of topic : what a stranger sees first ===");
var t = all.filter(function (m) { return m.topic === "test"; }).sort(function (a, b) { return a.time - b.time; });
t.slice(0, 14).forEach(function (m) { console.log("  " + ts(m.time) + "  " + (m.title ? "(" + m.title + ") " : "") + String(m.message).replace(/\n/g, " | ").slice(0, 90)); });
