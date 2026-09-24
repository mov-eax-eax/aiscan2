"use strict";
/* producers.js - the producer-prefix index. OFFLINE, no network.
 *
 * The question it answers: are the 25 exposed topics a POPULATION OF ONE-OFF MISTAKES,
 * or do they share publishers? 25 separate leaks is a nuisance. "One operator running
 * four services on public topics" is an attributable finding.
 *
 * Method: every message carries a PUBLISHER FINGERPRINT it did not know it was
 * revealing - title, title prefix, tag set, priority, click host, action labels,
 * attachment presence, and the normalized message TEMPLATE. When the same fingerprint
 * appears on two topics, those topics share a publisher or a product.
 *
 * METHODOLOGICAL CAVEAT, LEARNED BY GETTING IT WRONG TWICE:
 *   (1) Fanout alone is not enough. A single narrow fingerprint is usually a shared
 *       PRODUCT DEFAULT - ntfy's own test template, Claude Code's white_check_mark tag -
 *       and it joins unrelated people.
 *   (2) Requiring two fingerprint KINDS is ALSO not enough, because one product sets
 *       title, template and prefix TOGETHER. Correlated fields from a single publisher
 *       are not independent evidence. ntfy's onboarding passed the two-kind test.
 *   Prefer SPECIFIC fingerprints (a product tag, a full distinctive sentence) over
 *   GENERIC ones (a bare priority, a one-word template), and treat anything a vendor
 *   SHIPS as boilerplate no matter how well it "matches".
 *
 * THE KEY ANALYTIC DISTINCTION IS FANOUT.
 *   fanout 2-4   a fingerprint on a few topics -> a shared operator or a niche product
 *   fanout high  a fingerprint on many topics -> a library DEFAULT, not an identity
 * A tag like "white_check_mark" is Claude Code's default; it links topics spuriously.
 * So we report fanout and let it separate identity from boilerplate.
 */
const fs = require("fs");
const path = require("path");
const ARCH = path.join(__dirname, "..", "data", "archive");
const OUT = path.join(__dirname, "..", "data", "producers.json");

function norm(s) {
  return String(s == null ? "" : s)
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, "<UUID>")
    .replace(/\b[0-9a-f]{16,}\b/gi, "<HEX>")
    .replace(/\b\d{4}-\d{2}-\d{2}T[\d:.+\-Z]+/g, "<TS>")
    .replace(/\b\d{4}-\d{2}-\d{2}\b/g, "<DATE>")
    .replace(/\b\d+\b/g, "<N>")
    .replace(/\s+/g, " ")
    .trim();
}
/* Title prefix: the publisher's own label convention, e.g. "Claude Code Done", "Codex -" */
function prefix(t) {
  if (!t) return null;
  const m = String(t).split(/\s*[\u2014\u2013:\-\u2022]\s+|\s{2,}/)[0];
  const p = (m || String(t)).trim();
  return p.length >= 3 ? p.slice(0, 48) : null;
}

const files = fs.readdirSync(ARCH).filter(function (f) { return /\.jsonl$/.test(f); });
const msgs = [];
const perTopic = {};
for (const f of files) {
  const topic = f.replace(/\.jsonl$/, "");
  const recs = fs.readFileSync(path.join(ARCH, f), "utf8").split(/\r?\n/).filter(function (l) { return l.trim(); })
    .map(function (l) { try { return JSON.parse(l); } catch (e) { return null; } }).filter(Boolean);
  perTopic[topic] = { n: recs.length, fps: {} };
  for (const r of recs) {
    const tags = Array.isArray(r.tags) ? r.tags.slice().sort() : [];
    let clickHost = null;
    try { if (r.click) clickHost = new URL(r.click).host; } catch (e) { clickHost = String(r.click).slice(0, 40); }
    let actionsKey = null;
    if (Array.isArray(r.actions) && r.actions.length) {
      actionsKey = r.actions.map(function (a) { return String((a && (a.label || a.action)) || "?"); }).join("|");
    }
    const fp = {
      topic: topic, time: r.time,
      title: r.title || null,
      titlePrefix: prefix(r.title),
      tags: tags.join(",") || null,
      priority: r.priority == null ? null : String(r.priority),
      clickHost: clickHost,
      actionsKey: actionsKey,
      attachment: r.attachment ? "yes" : null,
      template: norm(r.message).slice(0, 160) || null,
    };
    msgs.push(fp);
    perTopic[topic].fps[fp.template] = (perTopic[topic].fps[fp.template] || 0) + 1;
  }
}

/* Build fingerprint -> set of topics, for each kind, and compute FANOUT. */
const KINDS = ["title", "titlePrefix", "tags", "priority", "clickHost", "actionsKey", "attachment", "template"];
const index = {};
for (const k of KINDS) index[k] = {};
for (const m of msgs) {
  for (const k of KINDS) {
    const v = m[k];
    if (v == null || v === "") continue;
    const key = String(v);
    if (!index[k][key]) index[k][key] = {};
    index[k][key][m.topic] = (index[k][key][m.topic] || 0) + 1;
  }
}

/* Links: a fingerprint value spanning 2+ topics. Fanout = number of topics. */
const links = [];
for (const k of KINDS) {
  for (const key of Object.keys(index[k])) {
    const topics = Object.keys(index[k][key]);
    if (topics.length < 2) continue;
    links.push({ kind: k, value: key, fanout: topics.length, topics: topics,
      counts: index[k][key] });
  }
}
links.sort(function (a, b) { return a.fanout - b.fanout || a.kind.localeCompare(b.kind); });

/* Clustering needs a STRONGER test than "shares a narrow fingerprint". A single
   narrow fingerprint is often a shared PRODUCT DEFAULT - ntfy's own test-notification
   template, Claude Code's white_check_mark tag, a bare priority value - and those join
   unrelated people. A link is only asserted when TWO INDEPENDENT fingerprint KINDS
   agree on the same pair. That is the difference between "same app" and "same operator". */
const AGREEMENT_MIN = 2;
const NARROW_MAX = 4;
const parent = {};
for (const t of Object.keys(perTopic)) parent[t] = t;
function find(x) { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; }
function union(a, b) { const ra = find(a), rb = find(b); if (ra !== rb) parent[ra] = rb; }
const narrow = links.filter(function (l) { return l.fanout <= NARROW_MAX; });

/* Pairwise multi-kind agreement. Only pairs meeting AGREEMENT_MIN are linked. */
const pairs = {};
for (const l of narrow) {
  for (let i = 0; i < l.topics.length; i++) {
    for (let j = i + 1; j < l.topics.length; j++) {
      const key = [l.topics[i], l.topics[j]].sort().join(" + ");
      if (!pairs[key]) pairs[key] = {};
      pairs[key][l.kind] = l.value;
    }
  }
}
const agreed = Object.keys(pairs).map(function (k) {
  return { pair: k, kinds: Object.keys(pairs[k]).sort(), evidence: pairs[k] };
}).filter(function (p) { return p.kinds.length >= AGREEMENT_MIN; })
  .sort(function (a, b) { return b.kinds.length - a.kinds.length; });
const single = Object.keys(pairs).map(function (k) {
  return { pair: k, kinds: Object.keys(pairs[k]).sort(), evidence: pairs[k] };
}).filter(function (p) { return p.kinds.length < AGREEMENT_MIN; });

for (const p of agreed) { const t = p.pair.split(" + "); union(t[0], t[1]); }
const clusters = {};
for (const t of Object.keys(perTopic)) { const r = find(t); (clusters[r] = clusters[r] || []).push(t); }
const clusterList = Object.keys(clusters).map(function (r) { return clusters[r].sort(); })
  .sort(function (a, b) { return b.length - a.length; });

const linkedTopics = new Set();
for (const l of narrow) l.topics.forEach(function (t) { linkedTopics.add(t); });
const total = Object.keys(perTopic).length;

const payload = {
  generatedAt: new Date().toISOString(),
  note: "Producer-prefix index over data/archive. Fingerprints are publisher metadata the sender did not know it was revealing. Fanout separates identity from boilerplate.",
  topics: total, messages: msgs.length,
  linkedTopicCount: linkedTopics.size,
  clusters: clusterList,
  strongPairs: agreed,
  singleFingerprintPairs: single,
  narrowLinks: narrow,
  wideLinks: links.filter(function (l) { return l.fanout > NARROW_MAX; }),
  perTopicTemplates: Object.keys(perTopic).map(function (t) {
    return { topic: t, n: perTopic[t].n, distinctTemplates: Object.keys(perTopic[t].fps).length };
  }).sort(function (a, b) { return b.n - a.n; }),
};
fs.writeFileSync(OUT, JSON.stringify(payload, null, 2));

console.log("PRODUCER INDEX: " + total + " topics, " + msgs.length + " messages");
console.log("");
console.log("STRONG LINKS (>= " + AGREEMENT_MIN + " independent fingerprint kinds agree on the pair):");
if (!agreed.length) console.log("  (none)");
for (const p of agreed) {
  console.log("  " + p.pair.padEnd(30) + "kinds=" + p.kinds.join("+"));
  for (const k of p.kinds) console.log("        [" + k + "] " + JSON.stringify(p.evidence[k]).slice(0, 80));
}
console.log("");
console.log("Single-fingerprint pairs: " + single.length + " - NOT asserted as links (product");
console.log("defaults and artefacts live here). Top by kind overlap: not shown, see producers.json");
console.log("");
console.log("LINKAGE: " + linkedTopics.size + " of " + total + " topics share a NARROW fingerprint (fanout 2-" + NARROW_MAX + ") with another topic");
console.log("");
console.log("CLUSTERS (topics joined by shared narrow fingerprints):");
for (const c of clusterList) {
  console.log("  size " + String(c.length).padStart(2) + "  " + (c.join(", ") || "(isolated)"));
}
console.log("");
console.log("NARROW LINKS - a fingerprint on 2-" + NARROW_MAX + " topics. These are the candidates for");
console.log("a shared operator or product, NOT boilerplate:");
for (const l of narrow.slice(0, 30)) {
  console.log("  [" + l.kind.padEnd(12) + "] fanout=" + String(l.fanout).padStart(2) + "  " +
    JSON.stringify(l.value).slice(0, 46).padEnd(48) + "  " + l.topics.join(", "));
}
console.log("");
console.log("WIDE LINKS - high fanout. Read as SHARED TOOL DEFAULTS, not identity:");
for (const l of links.filter(function (x) { return x.fanout > NARROW_MAX; }).slice(0, 12)) {
  console.log("  [" + l.kind.padEnd(12) + "] fanout=" + String(l.fanout).padStart(2) + "  " +
    JSON.stringify(l.value).slice(0, 46).padEnd(48) + "  " + l.topics.join(", "));
}
console.log("");
console.log("-> data/producers.json");
