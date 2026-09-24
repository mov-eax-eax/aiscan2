"use strict";
/* structure.js - the STRUCTURAL detector (AGENTS.md section 8), built offline.
 *
 * Thesis being tested: if an agent conceals, the payload is in STRUCTURE, not text -
 * response length, invocation ordering, inter-arrival timing, presence/absence of
 * optional fields (Whispering Agents, arXiv 2508.02188). A content classifier is blind
 * to that by construction, which is why our whole detector stack has been blind to it.
 *
 * This reads data/archive/*.jsonl (full untruncated originals) and computes, per topic:
 *   timing   inter-arrival deltas -> CV, modal period, mode share, largest gap
 *   length   message length distribution -> CV, distinct lengths, templating
 *   fields   presence of title/tags/priority/click/actions/attachment, and CHANGES
 *   json     is the payload JSON, and is the key set stable
 *   uuid7    UUIDv7 ids encode a millisecond timestamp -> recovers per-turn durations
 *            and publish latency WITHOUT reading any content
 *
 * Output: data/structure.json + a ranked report. No network.
 */
const fs = require("fs");
const path = require("path");
const ARCH = path.join(__dirname, "..", "data", "archive");
const OUT = path.join(__dirname, "..", "data", "structure.json");

function median(a) { if (!a.length) return null; const s = a.slice().sort(function (x, y) { return x - y; }); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; }
function mean(a) { return a.length ? a.reduce(function (x, y) { return x + y; }, 0) / a.length : null; }
function stdev(a) { if (a.length < 2) return 0; const m = mean(a); return Math.sqrt(a.reduce(function (s, x) { return s + (x - m) * (x - m); }, 0) / (a.length - 1)); }
function cv(a) { const m = mean(a); if (!m || a.length < 2) return null; return stdev(a) / m; }
function round(x, d) { return x == null ? null : Number(x.toFixed(d == null ? 2 : d)); }
function frac(n, d) { return d ? Number((n / d).toFixed(3)) : 0; }

/* Modal period: bin deltas into 5% buckets of the median and report the fattest. */
function modalPeriod(deltas) {
  if (deltas.length < 4) return { periodS: null, share: null };
  const med = median(deltas);
  if (!med || med <= 0) return { periodS: null, share: null };   // msgs in the same second
  const bins = {};
  for (const d of deltas) { const k = Math.round(d / (med * 0.05)); bins[k] = (bins[k] || 0) + 1; }
  let best = null, bestN = 0;
  for (const k of Object.keys(bins)) if (bins[k] > bestN) { bestN = bins[k]; best = Number(k); }
  return { periodS: round(best * med * 0.05, 1), share: frac(bestN, deltas.length) };
}

const UUID7 = /\b([0-9a-f]{8})-([0-9a-f]{4})-7([0-9a-f]{3})-([0-9a-f]{4})-([0-9a-f]{12})\b/gi;
function uuid7Times(text) {
  const out = [];
  let m;
  UUID7.lastIndex = 0;
  while ((m = UUID7.exec(text)) !== null) {
    const hex = (m[1] + m[2] + "7" + m[3] + m[4] + m[5]).toLowerCase().replace(/-/g, "");
    const ms = parseInt(hex.slice(0, 12), 16);
    if (ms > 1600000000000 && ms < 3000000000000) out.push(ms);
  }
  return out;
}

const files = fs.readdirSync(ARCH).filter(function (f) { return /\.jsonl$/.test(f); });
const report = {};
const rows = [];

for (const f of files) {
  const topic = f.replace(/\.jsonl$/, "");
  const lines = fs.readFileSync(path.join(ARCH, f), "utf8").split(/\r?\n/).filter(function (l) { return l.trim(); });
  const recs = [];
  for (const l of lines) { try { recs.push(JSON.parse(l)); } catch (e) {} }
  if (!recs.length) continue;
  recs.sort(function (a, b) { return a.time - b.time; });

  const times = recs.map(function (r) { return r.time * 1000; });
  const deltas = [];
  for (let i = 1; i < times.length; i++) deltas.push((times[i] - times[i - 1]) / 1000);

  const lens = recs.map(function (r) { return String(r.message == null ? "" : r.message).length; });
  const distinct = {}; lens.forEach(function (L) { distinct[L] = 1; });

  const fld = { title: 0, tags: 0, priority: 0, click: 0, actions: 0, attachment: 0 };
  recs.forEach(function (r) {
    for (const k of Object.keys(fld)) {
      const v = r[k];
      if (v != null && !(Array.isArray(v) && !v.length)) fld[k]++;
    }
  });

  let isJson = 0, keySig = {};
  recs.forEach(function (r) {
    try {
      const o = JSON.parse(r.message);
      if (o && typeof o === "object" && !Array.isArray(o)) {
        isJson++;
        const sig = Object.keys(o).sort().join(",");
        keySig[sig] = (keySig[sig] || 0) + 1;
      }
    } catch (e) {}
  });
  const keySigs = Object.keys(keySig).length;

  /* A message carries BOTH a Thread id (constant across a conversation) and a Turn id
     (new per turn). Taking the first match measured the thread's creation time, which
     is why it produced zero and negative "durations". Instead: collect every UUIDv7 in
     the topic, dedupe, sort, and difference. Repeated Thread ids collapse, unique Turn
     ids survive, and every delta is a real turn-to-turn gap. */
  const uuAll = [], uuPerMsg = [];
  recs.forEach(function (r) {
    const t = uuid7Times(String(r.message || "") + " " + String(r.title || ""));
    if (t.length) { const mx = Math.max.apply(null, t); uuPerMsg.push(mx); t.forEach(function (x) { uuAll.push(x); }); }
    else uuPerMsg.push(null);
  });
  const uuUniq = Array.from(new Set(uuAll)).sort(function (a, b) { return a - b; });
  const uuTurns = [];
  for (let i = 1; i < uuUniq.length; i++) uuTurns.push((uuUniq[i] - uuUniq[i - 1]) / 1000);

  /* Prefer the EXPLICITLY LABELLED turn ids when the payload names them (codex writes
     "Thread: <uuid>\nTurn: <uuid>"). Thread ids repeat across a conversation and would
     otherwise inflate the gap set with thread-creation events. This is still purely
     structural - it reads the SHAPE of an identifier, never the prose. */
  const turnTimes = [];
  const reTurn = /Turn:\s*([0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[0-9a-f]{4}-[0-9a-f]{12})/gi;
  recs.forEach(function (r) {
    let m; reTurn.lastIndex = 0;
    while ((m = reTurn.exec(String(r.message || ""))) !== null) {
      const ms = parseInt(m[1].replace(/-/g, "").slice(0, 12), 16);
      if (ms > 1600000000000 && ms < 3000000000000) turnTimes.push(ms);
    }
  });
  const turnUniq = Array.from(new Set(turnTimes)).sort(function (a, b) { return a - b; });
  const preciseTurns = [];
  for (let i = 1; i < turnUniq.length; i++) preciseTurns.push((turnUniq[i] - turnUniq[i - 1]) / 1000);
  const T = preciseTurns.length ? preciseTurns : uuTurns;
  const uuLat = [];
  for (let i = 0; i < recs.length; i++) if (uuPerMsg[i] != null) uuLat.push((times[i] - uuPerMsg[i]) / 1000);

  const mc = modalPeriod(deltas);
  const timingCv = cv(deltas);
  const lengthCv = cv(lens.filter(function (L) { return L > 0; }));

  /* Regularity: how machine-like is this stream? Deliberately rewards a FIXED PERIOD
     and a FIXED LENGTH, which is exactly what a covert channel needs and exactly what
     a human conversation never has. Requires enough samples to mean anything. */
  let reg = 0;
  if (deltas.length >= 5) {
    if (timingCv != null) reg += Math.max(0, 1 - timingCv) * 0.5;
    if (mc.share != null) reg += mc.share * 0.3;
    if (lengthCv != null) reg += Math.max(0, 1 - lengthCv) * 0.2;
  }

  const t = {
    topic: topic, n: recs.length,
    firstISO: new Date(times[0]).toISOString(), lastISO: new Date(times[times.length - 1]).toISOString(),
    spanH: round((times[times.length - 1] - times[0]) / 3600000, 2),
    timing: {
      medianS: round(median(deltas), 1), meanS: round(mean(deltas), 1), cv: round(timingCv, 3),
      modalPeriodS: mc.periodS, modalShare: mc.share,
      maxGapS: deltas.length ? round(Math.max.apply(null, deltas), 1) : null,
    },
    length: {
      min: Math.min.apply(null, lens), median: median(lens), max: Math.max.apply(null, lens),
      cv: round(lengthCv, 3), distinct: Object.keys(distinct).length,
      distinctRatio: frac(Object.keys(distinct).length, recs.length),
    },
    fields: { title: frac(fld.title, recs.length), tags: frac(fld.tags, recs.length), priority: frac(fld.priority, recs.length), click: frac(fld.click, recs.length), actions: frac(fld.actions, recs.length), attachment: frac(fld.attachment, recs.length) },
    json: { share: frac(isJson, recs.length), keySigs: keySigs, keysStable: isJson ? frac(keySig[Object.keys(keySig).sort(function (a, b) { return keySig[b] - keySig[a]; })[0]], isJson) : null },
    uuid7: { count: uuUniq.length, latencyMedianS: round(median(uuLat), 1), turnCount: T.length, turnMedianS: round(median(T), 1), turnMinS: T.length ? round(Math.min.apply(null, T), 1) : null, turnMaxS: T.length ? round(Math.max.apply(null, T), 1) : null },
    regularity: round(reg, 3),
  };
  report[topic] = t;
  rows.push(t);
}

rows.sort(function (a, b) { return b.regularity - a.regularity; });
fs.writeFileSync(OUT, JSON.stringify({ generatedAt: new Date().toISOString(), topics: report }, null, 2));

console.log("structural analysis of " + files.length + " archived topics -> data/structure.json");
console.log("");
console.log("REGULARITY = how machine-like the stream is (fixed period + fixed length).");
console.log("A high score with stable field presence is the covert-channel SHAPE: it says");
console.log("nothing about content, which is the whole point.");
console.log("");
console.log("topic".padEnd(24) + "n".padStart(4) + "reg".padStart(7) + "per(s)".padStart(9) + "modeSh".padStart(7) + "timCV".padStart(7) + "lenCV".padStart(7) + "uniqLen".padStart(8) + "json".padStart(6) + "uuid7".padStart(6) + "turnMed".padStart(8));
for (const t of rows) {
  console.log(
    t.topic.padEnd(24) + String(t.n).padStart(4) + String(t.regularity).padStart(7) +
    String(t.timing.modalPeriodS == null ? "-" : t.timing.modalPeriodS).padStart(9) +
    String(t.timing.modalShare == null ? "-" : t.timing.modalShare).padStart(7) +
    String(t.timing.cv == null ? "-" : t.timing.cv).padStart(7) +
    String(t.length.cv == null ? "-" : t.length.cv).padStart(7) +
    String(t.length.distinct).padStart(8) +
    String(t.json.share).padStart(6) +
    String(t.uuid7.count).padStart(6) +
    String(t.uuid7.turnMedianS == null ? "-" : t.uuid7.turnMedianS).padStart(8)
  );
}
console.log("");
console.log("UUIDv7 recovered turn timing (agent think-time, derived from ID structure ONLY):");
for (const t of rows.filter(function (r) { return r.uuid7.count >= 3; })) {
  console.log("  " + t.topic.padEnd(16) + "n=" + String(t.uuid7.count).padStart(3) +
    "  median turn " + String(t.uuid7.turnMedianS).padStart(8) + "s   range " +
    t.uuid7.turnMinS + "s .. " + t.uuid7.turnMaxS + "s   publish latency ~" + t.uuid7.latencyMedianS + "s");
}
