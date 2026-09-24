"use strict";
const fs = require("fs");
const path = require("path");
const dir = "data/archive";
function load(t) {
  const f = path.join(dir, t + ".jsonl");
  if (!fs.existsSync(f)) return [];
  return fs.readFileSync(f, "utf8").split("\n").filter(function (l) { return l.trim(); })
    .map(function (l) { try { return JSON.parse(l); } catch (e) { return null; } })
    .filter(Boolean).sort(function (a, b) { return a.time - b.time; });
}
function ts(t) { return new Date(t * 1000).toISOString().replace("T", " ").slice(5, 19); }

// read the greeting-named topics in FULL. This is the simple move.
["hello", "yo", "hey", "yes", "new", "chat"].forEach(function (t) {
  const msgs = load(t);
  if (!msgs.length) { console.log("== " + t + ": (no archive)"); return; }
  console.log("== " + t + "  (" + msgs.length + " messages)");
  msgs.forEach(function (m) {
    const meta = [];
    if (m.title) meta.push("title=" + JSON.stringify(m.title));
    if (m.tags && m.tags.length) meta.push("tags=" + JSON.stringify(m.tags));
    if (m.priority != null) meta.push("prio=" + m.priority);
    console.log("   " + ts(m.time) + "  " + (meta.length ? "[" + meta.join(" ") + "] " : "") + JSON.stringify(String(m.message).slice(0, 160)));
  });
  console.log("");
});

// every expressive message in the whole corpus, one list
console.log("== EVERY non-instrumental message in the corpus ==");
let all = [];
fs.readdirSync(dir).filter(function (f) { return f.slice(-6) === ".jsonl"; }).forEach(function (f) {
  fs.readFileSync(path.join(dir, f), "utf8").split("\n").filter(function (l) { return l.trim(); }).forEach(function (l) {
    try { all.push(JSON.parse(l)); } catch (e) {}
  });
});
all.sort(function (a, b) { return a.time - b.time; });
all.forEach(function (m) {
  const msg = String(m.message || "");
  const hasUrl = /https?:\/\//.test(msg) || /https?:\/\//.test(String(m.click || ""));
  if (hasUrl || m.title || /\d{4,}|\{|\b[A-Z]{2,}-\d+/.test(msg)) return;
  if (!msg.trim() || msg.length > 90) return;
  console.log("   " + String(m.topic).padEnd(9) + " " + ts(m.time) + "  " + JSON.stringify(msg));
});
