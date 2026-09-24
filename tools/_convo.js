"use strict";
const fs = require("fs"), path = require("path");
const dir = "data/archive";
function load(t) {
  const f = path.join(dir, t + ".jsonl");
  if (!fs.existsSync(f)) return [];
  return fs.readFileSync(f, "utf8").split("\n").filter(function (l) { return l.trim(); })
    .map(function (l) { try { return JSON.parse(l); } catch (e) { return null; } }).filter(Boolean);
}
function t(ts) { return new Date(ts * 1000).toISOString().slice(11, 19); }
let all = [];
fs.readdirSync(dir).filter(function (f) { return f.slice(-6) === ".jsonl"; })
  .forEach(function (f) { load(f.slice(0, -6)).forEach(function (m) { m._topic = f.slice(0, -6); all.push(m); }); });
all.sort(function (a, b) { return a.time - b.time; });

console.log("=== A. merged timeline: hello + chat ===");
let prev = null;
all.filter(function (m) { return m._topic === "hello" || m._topic === "chat"; }).forEach(function (m) {
  const d = prev ? (m.time - prev) : 0;
  prev = m.time;
  const meta = [];
  if (m.title) meta.push("T=" + m.title.slice(0, 46));
  if (m.tags) meta.push("tags=" + m.tags.join(","));
  if (m.priority != null) meta.push("p" + m.priority);
  console.log("  " + t(m.time) + "  +" + String(d).padStart(4) + "s  " + m._topic.padEnd(6) + " " + (meta.join(" ") || "(none)"));
  console.log("        " + JSON.stringify(String(m.message).replace(/\n/g, " | ")));
});

console.log("\n=== B. EVERY topic active 13:30-13:40 (who else was there?) ===");
const lo = Date.UTC(2026, 8, 15, 13, 30, 0) / 1000, hi = Date.UTC(2026, 8, 15, 13, 40, 0) / 1000;
all.filter(function (m) { return m.time >= lo && m.time <= hi; }).forEach(function (m) {
  console.log("  " + t(m.time) + "  " + m._topic.padEnd(10) + " " + (m.title ? "[" + m.title.slice(0, 30) + "] " : "") + JSON.stringify(String(m.message).replace(/\n/g, " ").slice(0, 70)));
});

console.log("\n=== C. device / locale fingerprints across the corpus ===");
const andIos = all.filter(function (m) { return /ntfy (Android|iOS) app/i.test(String(m.message)); });
console.log("  app test-notification messages: " + andIos.length);
const byApp = {};
andIos.forEach(function (m) { const k = /Android/i.test(m.message) ? "Android" : "iOS"; byApp[k] = (byApp[k] || 0) + 1; });
console.log("  by app: " + JSON.stringify(byApp));
const tags = {};
all.forEach(function (m) { (m.tags || []).forEach(function (x) { tags[x] = (tags[x] || 0) + 1; }); });
console.log("  all tags: " + JSON.stringify(tags));

console.log("\n=== D. the parody vs the template it mocks ===");
const ios = all.filter(function (m) { return /ntfy iOS app/i.test(String(m.message)); }).slice(0, 1)[0];
const parody = all.filter(function (m) { return /Miauuuuuu|meow if you like/i.test(String(m.message)); })[0];
if (ios) console.log("  TEMPLATE: " + ios.message.replace(/\n/g, " "));
if (parody) console.log("  PARODY  : " + parody.message.replace(/\n/g, " "));

console.log("\n=== E. languages present across the whole corpus ===");
[["Turkish","sohbet|tamamland|Zaman|Proje"],["Japanese","タスク|完了|福島|NHK"],["German","fertig|Test:|Du kannst|überschritten|Grenze"],["Spanish","Venta|agua pura|Total"],["Korean","정산|코드|변경"],["Chinese","执行|批次|测试"]]
  .forEach(function (p) {
    const re = new RegExp(p[1]);
    const n = all.filter(function (m) { return re.test(String(m.message) + String(m.title || "")); }).length;
    const topics = Array.from(new Set(all.filter(function (m) { return re.test(String(m.message) + String(m.title || "")); }).map(function (m) { return m._topic; })));
    if (n) console.log("  " + p[0].padEnd(9) + " " + String(n).padStart(4) + " msgs  topics: " + topics.join(","));
  });
