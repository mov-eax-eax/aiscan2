"use strict";
/* voice-rank.js - OFFLINE verification of the voiceDensity re-rank (AGENTS.md section 7).
   The known flaw was: voice scored PRESENCE, not PROPORTION, so 270 messages containing
   one meme ranked the same as a channel that is entirely voice. The fix is density =
   expressive/total, weighted by sample confidence. This proves the fix actually reorders
   the corpus, rather than just asserting the field exists. No network. */
const fs = require("fs");
const path = require("path");
const ARCH = path.join(__dirname, "..", "data", "archive");

let SIG;
try { SIG = require("./signals.js"); } catch (e) { SIG = null; }
if (!SIG || typeof SIG.voice !== "function") {
  const src = fs.readFileSync(path.join(__dirname, "signals.js"), "utf8");
  const mod = { exports: {} };
  new Function("module", "exports", "window", "document", src + "\n;return module.exports;")(mod, mod.exports, {}, {});
  SIG = mod.exports;
}
if (typeof SIG.voice !== "function") { console.log("could not load signals.js voice()"); process.exit(1); }

const rows = [];
for (const f of fs.readdirSync(ARCH).filter(function (x) { return /\.jsonl$/.test(x); })) {
  const msgs = fs.readFileSync(path.join(ARCH, f), "utf8").split(/\r?\n/).filter(function (l) { return l.trim(); })
    .map(function (l) { try { return JSON.parse(l); } catch (e) { return null; } }).filter(Boolean);
  if (!msgs.length) continue;
  const v = SIG.voice(msgs);
  const conf = Math.min(1, (v.messages || 1) / 4);
  rows.push({
    topic: f.replace(/\.jsonl$/, ""), n: msgs.length,
    expressive: v.expressive || 0, density: v.density || 0,
    voiceScore: v.score || 0, conf: conf,
    ranked: Math.round((v.density || 0) * conf * 40) + Math.round((v.score || 0) * 10),
  });
}

console.log("voiceDensity re-rank over " + rows.length + " archived topics (offline)");
console.log("");
console.log("If the fix works, the two orderings below must DIFFER - that difference is the");
console.log("whole point. Ranking by raw voice score rewards SIZE; ranking by the collector's");
console.log("weighted score rewards PROPORTION.");
console.log("");
const byScore = rows.slice().sort(function (a, b) { return b.voiceScore - a.voiceScore; });
const byDensity = rows.slice().sort(function (a, b) { return b.ranked - a.ranked; });

console.log("rank  BY RAW VOICE SCORE (the flawed metric)          BY WEIGHTED density (the fix)");
for (let i = 0; i < Math.min(12, rows.length); i++) {
  const a = byScore[i] || {}, b = byDensity[i] || {};
  console.log("  " + String(i + 1).padStart(2) + "  " +
    (a.topic || "").padEnd(22) + "score " + String(a.voiceScore).padEnd(5) + "n=" + String(a.n).padEnd(4) +
    "  " + (b.topic || "").padEnd(22) + "dens " + String(b.density).padEnd(5) + "exp " + b.expressive + "/" + b.n);
}

const moved = rows.filter(function (r) {
  const iScore = byScore.indexOf(r), iDens = byDensity.indexOf(r);
  return iScore < 5 && iDens > iScore + 2;
});
console.log("");
console.log("Topics that the raw metric over-ranked (fat but not expressive):");
if (!moved.length) console.log("  (none in the top 5 - the corpus may not exercise the flaw)");
for (const m of moved) {
  console.log("  " + m.topic.padEnd(22) + "n=" + String(m.n).padStart(4) +
    "  voiceScore " + String(m.voiceScore).padStart(5) + "  but density only " + m.density +
    "  (" + m.expressive + "/" + m.n + " expressive)");
}
console.log("");
console.log("Most expressive channels by proportion (the metric working as intended):");
for (const r of byDensity.slice(0, 8)) {
  console.log("  " + r.topic.padEnd(22) + "density " + String(r.density).padEnd(5) +
    "(" + r.expressive + "/" + r.n + ")" + "  weighted " + r.ranked);
}
