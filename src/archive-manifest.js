"use strict";
/* archive-manifest.js - one-shot: inventory everything we actually hold. Offline. */
const fs = require("fs"), path = require("path");
const DATA = path.join(__dirname, "..", "data"), ARCH = path.join(DATA, "archive");
const topics = []; let totalMsgs = 0, totalBytes = 0;
for (const f of fs.readdirSync(ARCH).filter(function (x) { return /\.jsonl$/.test(x); })) {
  const p = path.join(ARCH, f);
  const recs = fs.readFileSync(p, "utf8").split(/\r?\n/).filter(function (l) { return l.trim(); })
    .map(function (l) { try { return JSON.parse(l); } catch (e) { return null; } }).filter(Boolean);
  const times = recs.map(function (r) { return r.time; }).filter(Boolean).sort(function (a, b) { return a - b; });
  const bytes = fs.statSync(p).size;
  topics.push({ topic: f.replace(/\.jsonl$/, ""), messages: recs.length, bytes: bytes,
    first: times.length ? new Date(times[0] * 1000).toISOString() : null,
    last: times.length ? new Date(times[times.length - 1] * 1000).toISOString() : null });
  totalMsgs += recs.length; totalBytes += bytes;
}
topics.sort(function (a, b) { return b.messages - a.messages; });

const probe = { lists: 0, names: 0, reserved: [], occupied: [], free: 0 };
try {
  const pr = JSON.parse(fs.readFileSync(path.join(DATA, "probe-results.json"), "utf8"));
  for (const k of Object.keys(pr)) {
    probe.lists++;
    const ent = pr[k] || {};
    for (const n of Object.keys(ent)) {
      probe.names++;
      const v = ent[n];
      if (v && v.reserved) probe.reserved.push(n);
      else if (v && v.count > 0) probe.occupied.push(n + "(" + v.count + ")");
      else probe.free++;
    }
  }
} catch (e) {}

const files = [];
for (const f of fs.readdirSync(DATA)) {
  const p = path.join(DATA, f), st = fs.statSync(p);
  if (st.isFile()) files.push({ file: f, bytes: st.size });
  else files.push({ file: f + "/", dir: true });
}
const out = { generatedAt: new Date().toISOString(),
  archive: { topics: topics.length, messages: totalMsgs, bytes: totalBytes },
  probe: probe, perTopic: topics, files: files };
fs.writeFileSync(path.join(DATA, "ARCHIVE.json"), JSON.stringify(out, null, 2));

console.log("ARCHIVE: " + topics.length + " topics, " + totalMsgs + " messages, " + (totalBytes / 1024).toFixed(0) + " KB");
console.log("");
console.log("topic".padEnd(24) + "msgs".padStart(6) + "bytes".padStart(9) + "  window");
for (const t of topics) console.log(t.topic.padEnd(24) + String(t.messages).padStart(6) + String(t.bytes).padStart(9) + "  " + (t.first || "").slice(0, 10) + " -> " + (t.last || "").slice(0, 10));
console.log("");
console.log("PROBE LEDGER: " + probe.lists + " lists, " + probe.names + " names resolved");
console.log("  reserved : " + (probe.reserved.join(", ") || "(none)"));
console.log("  occupied : " + probe.occupied.join(", "));
console.log("  free     : " + probe.free);
console.log("");
console.log("data/ contents:");
for (const f of files) console.log("  " + f.file.padEnd(28) + (f.dir ? "(dir)" : (f.bytes / 1024).toFixed(1) + " KB"));
