"use strict";
/* derive-candidates.js - OFFLINE candidate generator for the derivation avenue.
 *
 * THE FINDING IT ENCODES (docs/FINDINGS.md, "THE DERIVATION GENERATOR"):
 * when the obvious topic name is already claimed, users do not fall back to something
 * random - they DERIVE, by appending a suffix or a digit. Measured examples:
 *     claude   RESERVED -> claude-code 214, claude-notifications 110
 *     codex    occupied -> codex1 89
 *     opencode RESERVED -> opencode-notifications 14
 *     home     RESERVED -> myhome, home-assistant
 *     me       RESERVED -> my-notes
 *
 * So the candidate space is mechanically enumerable: <base> x <template>.
 *
 * HONESTY CONSTRAINT, and it matters: the templates below were read off the SAME
 * observations we would be checking against, so the self-check is a COVERAGE test
 * (does the generator reproduce what we already found) and NOT an independent
 * predictive test. Only the next real probe tests it. Do not report it as validation.
 *
 * COST: an unknown name costs 1 creation token (100 burst, then 1/min). An existing
 * name is FREE in creation tokens - we cannot tell which is which without polling, so
 * the cost below is an UPPER BOUND. That is exactly why the list is RANKED: spend the
 * window top-down.
 */
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const YEAR = "2026";
const OUT = path.join(ROOT, "data", "derive-candidates.json");

/* Reserved = claimed by the service, so a user is FORCED to derive. Highest signal. */
const RESERVED = ["claude", "inbox", "opencode", "agents", "home", "me", "warp"];
/* Occupied by agents = also taken, also forces a derivation, slightly weaker because
   the user had a readable-but-taken name rather than a hard rejection. */
const OCCUPIED_AGENT = ["codex", "cursor", "hermes", "llm", "kiro"];

/* Bases we have already OBSERVED as occupied. Used only to learn additional base
   words - the coverage test found "my-notes" ungeneratable because "notes" was not a
   base. Closing that by hand-adding the word would be circular; instead we learn it by
   applying the INVERSE of our own templates and keeping any new root. Explicit and
   auditable. */
const OBSERVED_OCCUPIED = ["claude-code", "claude-notifications", "codex1", "opencode-notifications",
  "myhome", "home-assistant", "my-notes", "kiro", "hermes", "cursor", "codex", "llm"];

/* Function words that fall out of a strip ("my" from "my-notes") are noise, not bases. */
const STOP_ROOTS = new Set(["my", "the", "a", "and", "of", "to", "in", "on", "for", "new", "not"]);
function validRoot(r) { return /^[a-z][a-z0-9-]{1,}$/.test(r) && !STOP_ROOTS.has(r); }
function learnExtraBases() {
  const known = new Set(RESERVED.concat(OCCUPIED_AGENT));
  const extra = new Set();
  for (const n of OBSERVED_OCCUPIED) {
    /* ONLY the stripped roots are candidates. The observed name itself is not a base -
       seeding it produced absurd bases like "claude-notifications". */
    const roots = [];
    const a = n.match(/^(.+)-[a-z]+$/); if (a) roots.push(a[1]);
    const b = n.match(/^(.+?)\d+$/);    if (b) roots.push(b[1]);
    const c = n.match(/^(?:my|the|a)-(.+)$/i); if (c) roots.push(c[1]);
    const d = n.match(/^my([a-z].+)$/i);  if (d) roots.push(d[1]);
    for (const r of roots) if (r && !known.has(r) && validRoot(r)) extra.add(r);
  }
  return Array.from(extra);
}
const LEARNED = learnExtraBases();

/* Templates with a weight read off observed yield. "why" is the evidence, kept
   attached so the weighting is auditable rather than a vibe. */
const TEMPLATES = [
  { t: "{b}-notifications", w: 5, why: "claude-notifications 110, opencode-notifications 14 - the single best template" },
  { t: "{b}1",              w: 5, why: "codex1 89 - bare digit, no separator" },
  { t: "{b}-code",          w: 4, why: "claude-code 214" },
  { t: "my-{b}",            w: 3, why: "my-notes, my-inbox occupied" },
  { t: "my{b}",             w: 3, why: "myhome occupied" },
  { t: "{b}-cli",           w: 3, why: "copilot-cli, gemini-cli are shipped names" },
  { t: "{b}-agent",         w: 3, why: "agent-<x> naming is the framework default shape" },
  { t: "{b}-1",             w: 2, why: "digit with separator" },
  { t: "{b}-{year}",        w: 2, why: "hermes-<user>-<year> convention; home2026" },
  { t: "{b}{year}",         w: 2, why: "year glued on" },
  { t: "{b}-alerts",        w: 2, why: "private-alerts appears in README copy-paste" },
  { t: "{b}-notify",        w: 2, why: "notifier vocabulary" },
  { t: "{b}-events",        w: 2, why: "harness lifecycle vocabulary" },
  { t: "{b}-done",          w: 2, why: "completion vocabulary agents emit" },
  { t: "{b}-assistant",     w: 2, why: "home-assistant occupied; assistant framing" },
  { t: "{b}-home",          w: 1, why: "hermes-home appears in shipped probe lists" },
  { t: "{b}-bot",           w: 1, why: "persona framing" },
  { t: "{b}-2",             w: 1, why: "second digit - weaker than 1" },
];

/* The generator MUST reproduce these, or it is broken. Coverage only. */
const KNOWN = ["claude-code", "claude-notifications", "codex1", "opencode-notifications", "myhome", "home-assistant", "my-notes"];

function valid(t) { return /^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(t) && t.length <= 64; }

let probed = new Set();
try {
  const r = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "probe-results.json"), "utf8"));
  for (const list of Object.keys(r)) for (const k of Object.keys(r[list] || {})) probed.add(k);
} catch (e) {}

const byName = new Map();
for (const b of RESERVED.concat(OCCUPIED_AGENT).concat(LEARNED)) {
  const isRes = RESERVED.indexOf(b) >= 0;
  for (const tpl of TEMPLATES) {
    const name = tpl.t.replace("{b}", b).replace("{year}", YEAR);
    if (!valid(name)) continue;
    const cand = {
      name: name, base: b, baseState: isRes ? "reserved" : "occupied",
      template: tpl.t, templateWhy: tpl.why,
      score: (isRes ? 3 : 1) + tpl.w,
      alreadyProbed: probed.has(name),
      knownOccupied: KNOWN.indexOf(name) >= 0,
    };
    const prev = byName.get(name);
    if (!prev || cand.score > prev.score) byName.set(name, cand);
  }
}
const all = Array.from(byName.values()).sort(function (a, b) {
  return b.score - a.score || a.name.localeCompare(b.name);
});
const probeReady = all.filter(function (c) { return !c.alreadyProbed && !c.knownOccupied; });

const coverage = KNOWN.map(function (k) {
  const hit = all.filter(function (c) { return c.name === k; })[0];
  return { name: k, generated: !!hit, score: hit ? hit.score : null };
});

const payload = {
  generatedAt: new Date().toISOString(),
  note: "Offline candidates for the derivation avenue. Ranked. Coverage test below is NOT an independent validation - templates were read off the same observations.",
  bases: { reserved: RESERVED, occupiedAgent: OCCUPIED_AGENT, learnedFromObservedOccupied: LEARNED },
  templates: TEMPLATES,
  totalGenerated: all.length,
  probeReadyCount: probeReady.length,
  alreadyProbedCount: all.filter(function (c) { return c.alreadyProbed || c.knownOccupied; }).length,
  coverage: coverage,
  probeReady: probeReady,
};
fs.writeFileSync(OUT, JSON.stringify(payload, null, 2));

console.log("derive-candidates: " + all.length + " names from " +
  (RESERVED.length + OCCUPIED_AGENT.length) + " seeded + " + LEARNED.length + " learned bases (" +
  LEARNED.join(", ") + ") x " + TEMPLATES.length + " templates");
console.log("  already probed / known : " + payload.alreadyProbedCount);
console.log("  PROBE-READY            : " + probeReady.length + "   <- upper bound of " + probeReady.length + " creation tokens");
console.log("");
console.log("COVERAGE (not validation - these templates were derived from these very names):");
for (const c of coverage) console.log("   " + (c.generated ? "OK  " : "MISS") + "  " + c.name.padEnd(24) + " score " + c.score);
const miss = coverage.filter(function (c) { return !c.generated; });
console.log("   " + (coverage.length - miss.length) + "/" + coverage.length + " reproduced");
console.log("");
console.log("PROBE-READY, ranked (top 40):");
console.log("  score  name                          base       state");
for (const c of probeReady.slice(0, 40)) {
  console.log("  " + String(c.score).padStart(5) + "  " + c.name.padEnd(30) + c.base.padEnd(11) + c.baseState);
}
console.log("");
console.log("By base:");
const perBase = {};
for (const c of probeReady) perBase[c.base] = (perBase[c.base] || 0) + 1;
for (const b of Object.keys(perBase).sort(function (x, y) { return perBase[y] - perBase[x]; })) {
  console.log("   " + b.padEnd(12) + perBase[b] + " candidates");
}
console.log("");
console.log("-> data/derive-candidates.json");
