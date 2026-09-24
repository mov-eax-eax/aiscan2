#!/usr/bin/env node
/**
 * ntfy background collector.
 *
 * Owns ALL ntfy.sh traffic and persistence. The frontend never talks to ntfy directly;
 * it reads this service's state over HTTP and subscribes to its event stream.
 *
 *   node src/collector.js                # http://127.0.0.1:8787
 *   PORT=9000 NTFY_BASE=https://ntfy.internal node src/collector.js
 *
 * Two independent loops share one throttle gate:
 *   discovery  - walks the generated candidate list, one batch at a time
 *   refresh    - re-polls topics already known live, cheapest first, and records new messages
 *
 * Constraints enforced by ntfy.sh, learned from its server source:
 *   - request token per HTTP request (batch of <=25 = 1 token), 60 burst then 1 per 5s
 *   - <=30 topics per subscription, so batches stay at 25
 *   - polling an unknown topic CREATES it: 100 burst, then 1 new topic per MINUTE
 *   - replayed cache bytes are charged to a 500 MB/day pool shared with attachments
 */
"use strict";

const http = require("http");
const fs = require("fs");
const path = require("path");
const T = require("./topics.js");
const SIG = require("./signals.js");

const BASE = (process.env.NTFY_BASE || "https://ntfy.sh").replace(/\/+$/, "");
const PORT = parseInt(process.env.PORT || "8787", 10);
const HOST = process.env.HOST || "127.0.0.1";
const ROOT = path.join(__dirname, "..");   // repo root - data/ and share/ live here
const ASSETS = __dirname;                  // this dir - ui.*, topics.js, signals.js are served from here
const DATA = path.join(ROOT, "data");
const STATE_FILE = path.join(DATA, "state.json");
const HITS_FILE = path.join(DATA, "hits.jsonl");
const ARCHIVE_DIR = path.join(DATA, "archive");
const UA = "ntfy-collector/2.0 (read-only public cache poll)";
const ALL = T.generateTopics();

fs.mkdirSync(DATA, { recursive: true });
fs.mkdirSync(ARCHIVE_DIR, { recursive: true });

/* Full, untruncated originals. Samples elsewhere are deliberately clipped for the
   card view; this is the record of what was actually on the wire. Deduped by id so
   repeated polls do not grow the file. */
const archiveSeen = {};
const archiveCounts = {};

function loadSeenIds(topic) {
  const seen = {};
  try {
    const file = path.join(ARCHIVE_DIR, topic + ".jsonl");
    if (fs.existsSync(file)) {
      for (const l of fs.readFileSync(file, "utf8").split("\n")) {
        if (!l.trim()) continue;
        try { const m = JSON.parse(l); if (m.id) seen[m.id] = 1; } catch (e) {}
      }
    }
  } catch (e) {}
  return seen;
}

function archiveMessages(topic, msgs) {
  try {
    if (!archiveSeen[topic]) archiveSeen[topic] = loadSeenIds(topic);
    const seen = archiveSeen[topic];
    const fresh = [];
    for (const m of msgs) {
      if (!m.id || seen[m.id]) continue;
      seen[m.id] = 1;
      fresh.push(JSON.stringify({
        id: m.id, time: m.time, event: m.event, topic: topic,
        title: (m.title != null ? m.title : null),
        priority: (m.priority != null ? m.priority : null),
        tags: (m.tags || null),
        click: (m.click || null),
        actions: (m.actions || null),
        attachment: (m.attachment || null),
        message: String(m.message || "")
      }));
    }
    if (fresh.length) {
      fs.appendFile(path.join(ARCHIVE_DIR, topic + ".jsonl"), fresh.join("\n") + "\n", function () {});
      archiveCounts[topic] = (archiveCounts[topic] || Object.keys(seen).length - fresh.length) + fresh.length;
      if (!archiveCounts[topic]) archiveCounts[topic] = Object.keys(seen).length;
    }
    archiveCounts[topic] = Object.keys(seen).length;
    return fresh.length;
  } catch (e) {
    return 0;
  }
}

/* ------------------------------- config ------------------------------- */

const cfg = {
  // DISCOVERY=false boots a UI-only collector that makes NO ntfy requests. Needed
  // when a standalone prober must have the bucket alone: an in-flight probe inside
  // this process ignores discovery/refresh flags and its retries reset the bucket.
  discovery: process.env.DISCOVERY !== "false",
  batch: 25,
  maxTopics: parseInt(process.env.MAX_TOPICS || "300", 10),
  refreshMinutes: parseInt(process.env.REFRESH_MINUTES || "20", 10),
  maxRefreshPerHour: parseInt(process.env.MAX_REFRESH_PER_HOUR || "90", 10),
  dailyByteBudgetMB: parseFloat(process.env.DAILY_BUDGET_MB || "350"),
  coolOffAfter: parseInt(process.env.COOLOFF_AFTER || "8", 10),
  coolOffMinutes: parseInt(process.env.COOLOFF_MINUTES || "30", 10)
};

/* Bump this whenever a detector is added or changed. Entries carrying an older
   version are re-polled at full width on boot. Without it, every new detector
   silently fails on the existing corpus - which happened four times in a row
   (voice, density, structure, conversation) and showed up as blank fields in the UI. */
const ANALYSIS_VERSION = 8;

/* ------------------------------- state ------------------------------- */

let S = {
  version: 2,
  startedAt: Date.now(),
  cursor: 0,
  done: {},
  counters: { requests: 0, r429: 0, r403: 0, rCreate: 0, rBandwidth: 0, wire: 0, scanned: 0, liveFound: 0, refreshes: 0 },
  throttle: { until: 0, reason: "", kind: "" },
  batch: cfg.batch,
  consecutive429: 0,
  cooling: false,
  daily: null,
  creationPace: false,
  lastCreationLimitAt: 0,
  log: []
};

const BOOT_AT = Date.now();
if (fs.existsSync(STATE_FILE)) {
  try {
    S = Object.assign(S, JSON.parse(fs.readFileSync(STATE_FILE, "utf8")));
    // NEVER inherit startedAt. Loading it from disk made a freshly restarted
    // collector report hours of uptime, which hid the fact that an orphaned older
    // process was still bound to the port and still serving the OLD code. Several
    // "verified" fixes had never actually loaded because of this.
    S.startedAt = BOOT_AT;
    S.throttle = { until: 0, reason: "", kind: "" };
    S.batch = cfg.batch;
    // Downtime is free recovery time. Inheriting a deep backoff from disk made the
    // collector boot straight into a 220s gate, which is worse than useless.
    S.consecutive429 = 0;
    S.coolOffCount = 0;   // escalation is per-run; a restart is itself a quiet period
    S.cooling = false;
  } catch (e) { /* corrupt state: start fresh */ }
}

/* Migration: entries written before liveness/metadata/signature support carry no
   promise score. Force one refresh pass so they are re-analysed from the wire and
   archived in full, instead of showing up as empty leads. */
let staleAnalysis = false;
for (const t in S.done) {
  const d = S.done[t];
  if (d && d.status === "live") {
    d.nextDue = 0;
    if (d.analysisVersion !== ANALYSIS_VERSION) staleAnalysis = true;
  }
}

/* ---- budget guards ----
   ntfy meters four separate things; this tracks the two that actually bind:
   1. daily bandwidth (500 MB, shared with attachments, charged per replayed byte)
   2. new-topic creation (100 burst, then 1/min)
   Dead topics replay 0 bytes, so discovery is nearly free in bytes but expensive
   in creation tokens. Refresh is the opposite: it costs no creation tokens but
   replays whole caches, so it is what eats the byte pool. */
function today() { return new Date().toISOString().slice(0, 10); }

function rollDaily() {
  if (!S.daily || S.daily.date !== today()) {
    S.daily = { date: today(), bytes: 0, refreshes: 0, creations: 0 };
  }
  return S.daily;
}

function dailyBudgetBytes() { return Math.round(cfg.dailyByteBudgetMB * 1024 * 1024); }

function dailyRemaining() { rollDaily(); return dailyBudgetBytes() - S.daily.bytes; }

rollDaily();
if (S.creationPace && S.lastCreationLimitAt && (Date.now() - S.lastCreationLimitAt) > 3600000) {
  S.creationPace = false;
}

let shuttingDown = false;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let saveTimer = null;
function save() {
  if (saveTimer) return;
  saveTimer = setTimeout(function () { saveTimer = null; saveNow(); }, 1500);
}
function saveNow() {
  try {
    const tmp = STATE_FILE + ".tmp";
    fs.writeFileSync(tmp, JSON.stringify(S));
    fs.renameSync(tmp, STATE_FILE);
  } catch (e) { console.error("state save failed: " + e.message); }
}
setInterval(saveNow, 10000);
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log("\nshutting down: saving state...");
  saveNow();
  try { server.close(); } catch (e) {}
  setTimeout(function () { process.exit(0); }, 300);
}

/* ------------------------------- events ------------------------------- */

const clients = new Set();
const recentHits = [];

function emit(type, data) {
  const payload = "data: " + JSON.stringify({ type: type, at: Date.now(), data: data }) + "\n\n";
  for (const c of clients) { try { c.write(payload); } catch (e) {} }
}

function log(msg) {
  const line = "[" + new Date().toISOString().slice(11, 19) + "] " + msg;
  console.log(line);
  S.log.push(line);
  if (S.log.length > 500) S.log.shift();
  emit("log", { line: line });
}

/* ------------------------------- network ------------------------------- */

function parseNdjson(text) {
  const by = new Map();
  for (const line of text.split("\n")) {
    const s = line.trim();
    if (!s) continue;
    let m;
    try { m = JSON.parse(s); } catch (e) { continue; }
    if (m.event === "keepalive" || m.event === "open" || !m.topic) continue;
    if (!by.has(m.topic)) by.set(m.topic, []);
    by.get(m.topic).push(m);
  }
  return by;
}

function bodyInfo(text) {
  try {
    const j = JSON.parse(text);
    return { code: j.code || 0, message: j.message || "" };
  } catch (e) {
    return { code: 0, message: "" };
  }
}

function limitKind(info) {
  const m = (info.message || "").toLowerCase();
  if (m.indexOf("new topics") >= 0 || m.indexOf("topic creation") >= 0) return "creation";
  if (m.indexOf("active subscriptions") >= 0 || info.code === 42903) return "subscription";
  if (m.indexOf("bandwidth") >= 0 || info.code === 42905) return "bandwidth";
  if (m.indexOf("total number of topics") >= 0 || info.code === 42904) return "total";
  return "request";
}

/* One request in flight, globally. E8 restored service with a SINGLE request after
   silence, but discovery + refresh + probes all wake on the same gate expiry and
   fire together, so each 429 resets the others' quiet period and recovery never
   completes. This mutex serialises them into the burst-quiet-burst pattern. */
let netLock = Promise.resolve();
function withNet(fn) {
  const run = netLock.then(fn, fn);
  netLock = run.then(function () {}, function () {});
  return run;
}

async function pollBatch(batch) {
  const url = BASE + "/" + batch.join(",") + "/json?poll=1";
  const ctrl = new AbortController();
  const timer = setTimeout(function () { ctrl.abort(); }, 30000);
  try {
    const res = await fetch(url, { headers: { "user-agent": UA }, signal: ctrl.signal });
    clearTimeout(timer);
    let text = "";
    try { text = await res.text(); } catch (e) { text = ""; }
    return {
      status: res.status,
      text: text,
      bytes: res.status === 200 ? Buffer.byteLength(text) : 0,
      retryAfter: parseInt(res.headers.get("retry-after") || "0", 10)
    };
  } catch (e) {
    clearTimeout(timer);
    return { status: 0, text: "", bytes: 0, retryAfter: 0, error: String((e && e.message) || e) };
  }
}

function isForbidden(text) {
  try {
    const j = JSON.parse(text);
    return j.code === 40301 || j.http === 403;
  } catch (e) {
    return /forbidden/i.test(text || "");
  }
}

/**
 * Resolve a batch into per-topic results, splitting on 40301.
 * ntfy rejects the WHOLE multi-topic subscription if any one topic is reserved
 * (needs auth), so a single poison topic would otherwise stall the scan forever.
 * Halve recursively until the reserved topic is isolated, then mark it and move on.
 */
async function pollResolving(batch, out) {
  const r = await withNet(function () { return pollBatch(batch); });
  S.counters.requests++;

  if (r.status === 200) {
    if (S.cooling) { S.cooling = false; log("cool-off cleared - traffic resumed"); }
    S.counters.wire += r.bytes;
    rollDaily();
    S.daily.bytes += r.bytes;
    const by = parseNdjson(r.text);
    for (const t of batch) out.set(t, { msgs: by.get(t) || [] });
    return { done: true };
  }

  if (r.status === 403 && isForbidden(r.text)) {
    if (batch.length === 1) {
      out.set(batch[0], { forbidden: true, msgs: [] });
      return { done: true };
    }
    const mid = Math.ceil(batch.length / 2);
    const a = await pollResolving(batch.slice(0, mid), out);
    if (!a.done) return a;
    await sleep(300);
    const b = await pollResolving(batch.slice(mid), out);
    if (!b.done) return b;
    return { done: true };
  }

  return { done: false, status: r.status, text: r.text, retryAfter: r.retryAfter, error: r.error };
}

/* ------------------------------- throttle gate ------------------------------- */

function gateMs() { return Math.max(0, S.throttle.until - Date.now()); }

async function gateWait() {
  while (gateMs() > 0 && !shuttingDown) {
    await sleep(Math.min(1000, gateMs()));
  }
}

function handleThrottle(r) {
  const info = bodyInfo(r.text);
  const kind = limitKind(info);
  if (r.status === 429) S.counters.r429++; else S.counters.r403++;
  S.consecutive429++;

  // E1 proved batching costs ~1 token and that sustained 429s are contention, not
  // our batch size. So on repeated failure back off much further than the old ~29s
  // cap: retrying every 29s forever both wastes budget and adds to the contention.
  let wait = r.retryAfter > 0 ? r.retryAfter * 1000 : Math.min(300000, 6000 * Math.pow(1.35, Math.min(S.consecutive429, 12)));

  // E8 RESULT: two minutes of TOTAL silence restored service (HTTP 200, 341ms).
  // Our 8-36s retry loop was itself the thing keeping the bucket drained: it spent
  // tokens as fast as they refilled, so recovery never completed. Floor every wait
  // at the measured recovery time. Policy becomes: burst, go fully quiet, burst.
  wait = Math.max(wait, 120000);

  if (kind === "creation") {
    S.counters.rCreate++;
    rollDaily();
    S.daily.creations++;
    S.creationPace = true;
    S.lastCreationLimitAt = Date.now();
    wait = 62000;
    S.batch = 1;
  } else if (kind === "subscription") {
    S.batch = Math.max(3, Math.floor(S.batch / 2));
    wait = 1500;
  } else if (kind === "bandwidth") {
    S.counters.rBandwidth++;
    wait = 15 * 60 * 1000;
  } else if (kind === "total") {
    wait = 60 * 60 * 1000;
    cfg.discovery = false;
    log("server reports its total topic limit is reached - discovery disabled");
  }

  // Evidence: retries at 49s/66s/89s/121s ALL failed while we were issuing ~1
  // request per minute, a twelfth of the documented refill. A short backoff is not
  // yielding, so the only sensible response is to stop poking entirely.
  // A long quiet period is the one thing that has ever worked against this prefix.
  if (S.consecutive429 >= cfg.coolOffAfter) {
    if (!S.cooling) {
      S.cooling = true;
      S.coolOffCount = (S.coolOffCount || 0) + 1;
      // PROGRESSIVE. E1 showed ~90s of quiet often suffices, so opening at the full
      // 30 min blocked three queued probes for half an hour over a storm we had
      // caused ourselves. Start short; escalate only when a short pause fails.
      const mins = Math.min(cfg.coolOffMinutes, 2 * Math.pow(2, S.coolOffCount - 1));
      S.coolOffMins = mins;
      log("COOL-OFF #" + S.coolOffCount + ": " + S.consecutive429 + " consecutive 429s - no ntfy traffic for " + mins + " min");
      emit("throttle", { kind: "cooloff", code: 0, message: "cool-off " + mins + " min", until: Date.now() + mins * 60000, batch: S.batch });
    }
    wait = Math.max(wait, (S.coolOffMins || 3) * 60000);
  }

  S.throttle.until = Math.max(S.throttle.until, Date.now() + Math.min(wait, 30 * 60 * 1000));
  S.throttle.reason = info.message || ("HTTP " + r.status);
  S.throttle.kind = kind;
  emit("throttle", { kind: kind, code: info.code, message: S.throttle.reason, until: S.throttle.until, batch: S.batch });
  log("throttled [" + kind + "] " + S.throttle.reason + " -> gate " + Math.round(gateMs() / 1000) + "s, batch " + S.batch);
  save();
}

/* ------------------------------- records ------------------------------- */

function refreshIntervalMs(entry) {
  const base = cfg.refreshMinutes * 60000;
  if (!base) return Infinity;
  const sizeFactor = 1 + (entry.bytes || 0) / 5000;
  const kindFactor = entry.kind === "ai-relay" ? 1 : 2;
  return Math.min(6 * 60 * 60000, Math.round(base * sizeFactor * kindFactor));
}

function uniq(a) { return Array.from(new Set(a)); }

/* ntfy messages carry publisher SELF-DESCRIPTIONS we were ignoring: title, tags,
   priority, click, actions, attachment. An app that sets title "Wazuh Alert" has
   told us exactly what it is. */
function extractMeta(msgs) {
  const titles = [], tags = [], priorities = [], clicks = [];
  let actions = 0, attachments = 0;
  for (const m of msgs) {
    if (m.title) titles.push(String(m.title));
    if (m.tags && m.tags.length) for (const t of m.tags) tags.push(String(t));
    if (m.priority != null) priorities.push(Number(m.priority));
    if (m.click) clicks.push(String(m.click));
    if (m.actions && m.actions.length) actions++;
    if (m.attachment) attachments++;
  }
  return {
    titles: uniq(titles).slice(0, 3),
    tags: uniq(tags).slice(0, 8),
    priority: priorities.length ? Math.max.apply(null, priorities) : null,
    click: clicks[0] || null,
    actions: actions,
    attachments: attachments
  };
}

/* A counter that advances is the difference between a fossil and a live process. */
function extractCounters(msgs) {
  let maxNumericId = null;
  const methods = [];
  for (const m of msgs) {
    const s = String(m.message || "");
    const idm = /"(?:id|request_id|req_id|seq|sequence|msg_id|offset|nonce)"\s*:\s*(\d{2,})/.exec(s);
    if (idm) { const v = parseInt(idm[1], 10); if (maxNumericId === null || v > maxNumericId) maxNumericId = v; }
    const pm = /\b(?:id|seq|request|nonce)\s*[=:]\s*(\d{4,})\b/i.exec(s);
    if (pm) { const v = parseInt(pm[1], 10); if (maxNumericId === null || v > maxNumericId) maxNumericId = v; }
    const mm = /"method"\s*:\s*"([^"]+)"/.exec(s);
    if (mm) methods.push(mm[1]);
  }
  return { maxNumericId: maxNumericId, methods: uniq(methods).slice(0, 5) };
}

const SIGNATURES = [
  ["census-scanner", /internet-census|census-scanner|mcp-scanner/i],
  ["mcp-client",     /clientInfo|"protocolVersion"/i],
  ["json-rpc",       /"jsonrpc"/i],
  ["agent-gateway",  /gateway shutting down|task will be interrupted|gateway (started|online)/i],
  ["siem",           /wazuh|siem|soc alert/i],
  ["heartbeat",      /heartbeat|keepalive|still alive|watchdog/i],
  ["credential",     /secret|api[_-]?key|token=|password/i]
];

function signaturesOf(msgs) {
  let blob = "";
  for (const m of msgs) {
    blob += String(m.message || "") + " " + String(m.title || "") + " " + ((m.tags || []).join(" ")) + "\n";
  }
  const hits = [];
  for (const s of SIGNATURES) if (s[1].test(blob)) hits.push(s[0]);
  return hits;
}

const CATEGORY_WEIGHT = {
  "credential-leak": 40, "agent-anomaly": 35, "misconfig": 30, "probe": 20,
  "ai-relay": 18, "iot": 8, "ops": 6, "personal": 6, "news": 2, "noise": 0
};

function scorePromise(entry) {
  const reasons = [];
  let score = 0;
  const tierW = { T4: 60, T3: 40, T2: 25, T1: 8 }[entry.tier] || 0;
  if (tierW) { score += tierW; reasons.push(entry.tier + " liveness"); }
  const catW = CATEGORY_WEIGHT[entry.kind] || 0;
  if (catW) { score += Math.round(catW * (entry.confidence || 0.5)); reasons.push(entry.kind); }
  if (entry.meta && (entry.meta.titles.length || entry.meta.tags.length)) { score += 12; reasons.push("publisher metadata"); }
  if (entry.signatures && entry.signatures.length) { score += 20; reasons.push("signature: " + entry.signatures.join("/")); }
  if (entry.methods && entry.methods.length) { score += 10; reasons.push("rpc methods"); }
  if (entry.meta && entry.meta.actions) { score += 6; reasons.push("action buttons"); }
  if (entry.counter != null) { score += 8; reasons.push("stateful id"); }
  if (entry.voice && entry.voice.score > 0) {
    // Density is the dominant term: a channel that is MOSTLY voice beats a huge
    // channel containing one meme. Confidence scales with sample size so a single
    // message cannot claim full density.
    const dens = entry.voice.density || 0;
    const conf = Math.min(1, (entry.voice.messages || 1) / 4);
    score += Math.round(dens * conf * 40) + Math.round(entry.voice.score * 10);
    reasons.push("voice " + entry.voice.score.toFixed(2) +
      " density " + dens.toFixed(2) + " (" + (entry.voice.expressive || 0) + "/" + (entry.voice.messages || 0) + ")");
  }
  // The whole point of the project: an agent-generated channel outranks everything.
  if (entry.agent && entry.agent.isAgent) {
    score += Math.round(entry.agent.score * 40);
    reasons.push("AGENT " + entry.agent.score + ": " + entry.agent.markers.slice(0, 4).join("/"));
  }
  // Structural signals are speculative, so they get a modest, separate weight:
  // detection and ranking stay decoupled.
  if (entry.structure && entry.structure.score > 0) {
    score += Math.round(entry.structure.score * 18);
    reasons.push("structure " + entry.structure.score + ": " +
      entry.structure.markers.map(function (m) { return m.id; }).join("/"));
  }
  return { score: score, reasons: reasons };
}

function recordLive(topic, msgs) {
  const prev = S.done[topic];
  const last = msgs[msgs.length - 1];
  let bytes = 0;
  for (let i = 0; i < msgs.length; i++) bytes += (msgs[i].message ? msgs[i].message.length : 0);

  const archived = archiveMessages(topic, msgs);
  const analysis = SIG.analyze(msgs);
  const meta = extractMeta(msgs);
  const counters = extractCounters(msgs);
  const signatures = signaturesOf(msgs);
  const voice = SIG.voice(msgs);
  const structure = SIG.structure(msgs);
  const conversation = SIG.conversation(msgs);
  const agent = SIG.agent(msgs);

  const prevCount = (prev && prev.status === "live") ? (prev.count || 0) : null;
  const prevCounter = (prev && prev.counter != null) ? prev.counter : null;
  const prevLast = (prev && prev.status === "live") ? (prev.last || 0) : null;
  const countGrew = prevCount !== null && msgs.length > prevCount;
  // The 12h cache SLIDES. A steady publisher reaches equilibrium where new-in equals
  // old-out, so the count never grows and a perfectly live topic would stay T1
  // forever (camera: cv 0.01, a metronome, yet count only ever falls). Liveness must
  // be measured by the newest message timestamp ADVANCING, not by cache size.
  const lastAdvanced = prevLast !== null && last.time > prevLast;
  const counterAdvanced = prevCounter !== null && counters.maxNumericId !== null && counters.maxNumericId > prevCounter;
  const observations = ((prev && prev.observations) ? prev.observations : 0) + 1;

  // T4 = an actual exchange between people (or agents) on the channel.
  // T1 = seen once. T2 = it grew between observations. T3 = a stateful counter advanced.
  let tier = "T1";
  if (conversation.score >= 0.6) tier = "T4";
  else if (observations >= 2 && counterAdvanced) tier = "T3";
  else if (observations >= 2 && (lastAdvanced || countGrew)) tier = "T2";

  const entry = {
    status: "live",
    count: msgs.length,
    last: last.time,
    kind: analysis.primary,
    confidence: analysis.confidence,
    scores: analysis.scores,
    evidence: analysis.evidence,
    metrics: analysis.metrics,
    sample: String(last.message || "").slice(0, 400),
    previews: msgs.slice(-4).map(function (m) { return { t: m.time, m: String(m.message || "").slice(0, 240) }; }),
    firstSeen: prev && prev.firstSeen ? prev.firstSeen : Date.now(),
    lastPolled: Date.now(),
    bytes: bytes,
    meta: meta,
    methods: counters.methods,
    counter: counters.maxNumericId,
    prevCounter: prevCounter,
    signatures: signatures,
    voice: voice,
    structure: structure,
    conversation: conversation,
    agent: agent,
    analysisVersion: ANALYSIS_VERSION,
    observations: observations,
    prevCount: prevCount,
    countDelta: prevCount !== null ? (msgs.length - prevCount) : 0,
    lastAdvanced: lastAdvanced,
    tier: tier,
    archived: archiveCounts[topic] || 0,
    newArchived: archived
  };
  entry.promise = scorePromise(entry);
  entry.nextDue = Date.now() + refreshIntervalMs(entry);

  const isNew = !prev || prev.status !== "live";
  S.done[topic] = entry;

  if (isNew) {
    S.counters.liveFound++;
    const rec = { at: Date.now(), topic: topic, count: msgs.length, kind: entry.kind, sample: entry.sample };
    fs.appendFile(HITS_FILE, JSON.stringify(rec) + "\n", function () {});
    recentHits.unshift(rec);
    if (recentHits.length > 200) recentHits.pop();
    emit("live", rec);
    log("LIVE " + topic + " [" + entry.kind + " " + analysis.confidence + "] " + msgs.length + " msgs :: " + entry.sample.slice(0, 70).replace(/\s+/g, " "));

    if (SIG.ANOMALY_CATS[analysis.primary] && analysis.confidence >= 0.4) {
      const obs = {
        at: Date.now(), topic: topic, cat: analysis.primary, confidence: analysis.confidence,
        evidence: analysis.evidence.slice(0, 3), metrics: analysis.metrics, sample: entry.sample.slice(0, 300)
      };
      fs.appendFile(path.join(DATA, "observations.jsonl"), JSON.stringify(obs) + "\n", function () {});
      emit("anomaly", obs);
      log("ANOMALY [" + analysis.primary + " " + analysis.confidence + "] " + topic + " :: " + entry.sample.slice(0, 80).replace(/\s+/g, " "));
    }
    save();
  }
  return isNew;
}

function countStatus(s) {
  let n = 0;
  for (const t in S.done) if (S.done[t].status === s) n++;
  return n;
}

function categoryCounts() {
  const c = {};
  for (const t in S.done) {
    const d = S.done[t];
    if (d.status !== "live") continue;
    c[d.kind] = (c[d.kind] || 0) + 1;
  }
  return c;
}

function vendorCounts() {
  const c = {};
  for (const t in S.done) {
    const d = S.done[t];
    if (d.status !== "live") continue;
    let hay = t + " " + (d.sample || "");
    if (d.evidence) for (const e of d.evidence) hay += " " + (e.snippet || "");
    const hits = SIG.vendorHits(hay);
    for (const v of hits) c[v] = (c[v] || 0) + 1;
  }
  return c;
}

/* Census of PRODUCERS, read from the full archive rather than the 3-title sample
   kept per topic. Title prefixes are the cheapest fingerprint of what wrote a
   message: [Sifio], opencode -, ●project:, Collector empty:, Airthings Alert:, Codex -. */
function producerPrefix(title) {
  if (!title) return null;
  const m = /^\[[^\]]+\]/.exec(title) ||
    /^●[^:]{0,20}:/.exec(title) ||
    /^[A-Za-z0-9_.-]{2,20}\s+[-\u2013]/.exec(title) ||
    /^(WARNING|Task|Collector empty|Sentinel Alert|Airthings Alert|GlitchTip Alert|opencode|Codex|Back In Stock|Price Drop|Upgrade Available|New Patient|DutyPusher|Cerberus)/i.exec(title);
  return m ? m[0].trim() : null;
}

let producerCache = { at: 0, data: {} };
function producerCounts() {
  if (Date.now() - producerCache.at < 30000) return producerCache.data;
  const c = {};
  let files = [];
  try { files = fs.readdirSync(ARCHIVE_DIR).filter(function (f) { return f.slice(-6) === ".jsonl"; }); } catch (e) {}
  for (const f of files) {
    try {
      for (const l of fs.readFileSync(path.join(ARCHIVE_DIR, f), "utf8").split("\n")) {
        if (!l.trim()) continue;
        let m; try { m = JSON.parse(l); } catch (e) { continue; }
        const p = producerPrefix(m.title);
        if (p) c[p] = (c[p] || 0) + 1;
      }
    } catch (e) {}
  }
  producerCache = { at: Date.now(), data: c };
  return c;
}

function agentCount() {
  let n = 0;
  for (const t in S.done) {
    const d = S.done[t];
    if (d.status === "live" && d.agent && d.agent.isAgent) n++;
  }
  return n;
}

function structureFlagged() {
  let n = 0;
  for (const t in S.done) {
    const d = S.done[t];
    if (d.status === "live" && d.structure && d.structure.score > 0) n++;
  }
  return n;
}

function reservedList() {
  const out = [];
  for (const t in S.done) if (S.done[t].status === "forbidden") out.push(t);
  return out.sort();
}

function overviewPayload() {
  rollDaily();
  const c = S.counters;
  const now = Date.now();
  const uptimeH = Math.max(0.001, (now - S.startedAt) / 3600000);

  const leads = [];
  for (const t in S.done) {
    const d = S.done[t];
    leads.push({
      topic: t, status: d.status, kind: d.kind || null, tier: d.tier || null,
      firstSeen: d.firstSeen || null, last: d.last || null, count: d.count || 0,
      agent: d.agent || null, conversation: d.conversation || null,
      voice: d.voice || null, archived: d.archived || 0
    });
  }
  leads.sort(function (a, b) { return (b.firstSeen || 0) - (a.firstSeen || 0); });

  const live = leads.filter(function (l) { return l.status === "live"; });
  const agents = live.filter(function (l) { return l.agent && l.agent.isAgent; });
  const convos = live.filter(function (l) { return l.conversation && l.conversation.score > 0; });

  const budget = dailyBudgetBytes();
  const used = S.daily.bytes;
  const midnight = new Date(S.daily.date + "T00:00:00Z").getTime();
  const elapsedH = Math.max(0.01, (now - midnight) / 3600000);
  const burn = used / elapsedH;
  const hoursLeft = burn > 0 ? (budget - used) / burn : null;
  const scanned = c.scanned || 0;

  return {
    budget: {
      date: S.daily.date, used: used, budget: budget, remaining: Math.max(0, budget - used),
      pct: budget ? Math.round((used / budget) * 10000) / 100 : 0,
      burnPerHour: Math.round(burn),
      hoursLeft: hoursLeft,
      refreshes: S.daily.refreshes, creations: S.daily.creations,
      creationPace: !!S.creationPace
    },
    efficiency: {
      requests: c.requests, scanned: scanned, wireBytes: c.wire || 0,
      topicsPerRequest: c.requests ? Math.round((scanned / c.requests) * 10) / 10 : 0,
      bytesPerRequest: c.requests ? Math.round((c.wire || 0) / c.requests) : 0,
      liveFound: c.liveFound || 0,
      agentsFound: agents.length, conversations: convos.length,
      agentRatePct: scanned ? Math.round((agents.length / scanned) * 10000) / 100 : 0,
      liveRatePct: scanned ? Math.round(((c.liveFound || 0) / scanned) * 10000) / 100 : 0,
      throttleHits: (c.r429 || 0) + (c.r403 || 0),
      creationLimits: c.rCreate || 0, bandwidthLimits: c.rBandwidth || 0,
      uptimeMs: now - S.startedAt,
      topicsPerHour: Math.round(scanned / uptimeH),
      remainingToScan: Math.max(0, Math.min(cfg.maxTopics, ALL.length) - S.cursor)
    },
    leads: leads.slice(0, 50),
    targets: agents.map(function (a) {
      return { topic: a.topic, score: a.agent.score, markers: a.agent.markers, last: a.last };
    })
  };
}

function topicsArchivePayload() {
  const out = [];
  let files = [];
  try {
    files = fs.readdirSync(ARCHIVE_DIR).filter(function (f) { return f.slice(-6) === ".jsonl"; });
  } catch (e) {}
  for (const f of files) {
    const topic = f.slice(0, -6);
    const d = S.done[topic] || {};
    let archived = archiveCounts[topic];
    if (archived == null) {
      try {
        archived = fs.readFileSync(path.join(ARCHIVE_DIR, f), "utf8").split("\n").filter(function (l) { return l.trim() !== ""; }).length;
      } catch (e) { archived = 0; }
    }
    out.push({
      topic: topic, archived: archived, live: d.status === "live",
      kind: d.kind || null, tier: d.tier || null, last: d.last || null,
      signatures: d.signatures || []
    });
  }
  out.sort(function (a, b) { return b.archived - a.archived; });
  return { topics: out, total: out.length };
}

function topicArchivePayload(name, limit) {
  if (!T.validateTopic(name)) return { error: "invalid topic" };
  const file = path.join(ARCHIVE_DIR, name + ".jsonl");
  if (path.dirname(file) !== ARCHIVE_DIR) return { error: "invalid path" };
  const messages = [];
  try {
    if (fs.existsSync(file)) {
      for (const l of fs.readFileSync(file, "utf8").split("\n")) {
        if (!l.trim()) continue;
        try { messages.push(JSON.parse(l)); } catch (e) {}
      }
    }
  } catch (e) { return { error: String(e.message || e) }; }
  const total = messages.length;
  let slice = messages;
  if (limit > 0) slice = messages.slice(-limit);
  return { topic: name, total: total, returned: slice.length, messages: slice };
}

/* Ranked leads. Reserved names are T0: the only intentional acts we observe. */
function promisingPayload() {
  const leads = [];
  for (const t in S.done) {
    const d = S.done[t];
    if (d.status === "forbidden") {
      leads.push({
        topic: t, tier: "T0", score: 30, status: "reserved", kind: "reserved", confidence: 1,
        reasons: ["name deliberately claimed (40301, auth required)"], evidence: [], sample: ""
      });
      continue;
    }
    if (d.status !== "live") continue;
    const p = d.promise || { score: 0, reasons: [] };
    leads.push({
      topic: t, tier: d.tier || "T1", score: p.score, reasons: p.reasons,
      kind: d.kind, confidence: d.confidence, count: d.count, last: d.last, bytes: d.bytes,
      observations: d.observations || 1, prevCount: (d.prevCount != null ? d.prevCount : null), countDelta: d.countDelta || 0,
      counter: (d.counter != null ? d.counter : null), prevCounter: (d.prevCounter != null ? d.prevCounter : null),
      meta: d.meta || {}, methods: d.methods || [], signatures: d.signatures || [], voice: d.voice || null,
      structure: d.structure || null, conversation: d.conversation || null, agent: d.agent || null,
      evidence: d.evidence || [], sample: d.sample || "", previews: d.previews || [], nextDue: d.nextDue,
      archived: d.archived || 0,
      newArchived: d.newArchived || 0
    });
  }
  leads.sort(function (a, b) { return b.score - a.score; });
  return { leads: leads, total: leads.length };
}

function anomaliesPayload() {
  const out = [];
  for (const t in S.done) {
    const d = S.done[t];
    if (d.status !== "live" || !SIG.ANOMALY_CATS[d.kind]) continue;
    out.push({
      topic: t, kind: d.kind, confidence: d.confidence, count: d.count, last: d.last,
      evidence: d.evidence || [], metrics: d.metrics || {}, sample: d.sample || ""
    });
  }
  out.sort(function (a, b) { return (b.confidence || 0) - (a.confidence || 0); });
  return { anomalies: out, total: out.length };
}

/* ------------------------------- loops ------------------------------- */

let consecutiveOk = 0;

async function discoveryLoop() {
  while (!shuttingDown) {
    if (!cfg.discovery) { await sleep(2000); continue; }
    if (probePending > 0 || probeActive) { await sleep(1200); continue; }
    const limit = Math.min(cfg.maxTopics, ALL.length);
    if (S.cursor >= limit) { await sleep(5000); continue; }

    await gateWait();
    if (shuttingDown) return;

    const span = S.creationPace ? 1 : S.batch;
    const batch = ALL.slice(S.cursor, Math.min(S.cursor + span, limit));
    const out = new Map();
    const res = await pollResolving(batch, out);

    if (!res.done) {
      if (res.status === 429 || res.status === 403) { handleThrottle(res); continue; }
      if (res.status === 0) { log("discovery network error: " + res.error); await sleep(5000); continue; }
      log("discovery HTTP " + res.status + ", skipping " + batch.length);
      S.cursor += batch.length;
      continue;
    }

    S.consecutive429 = 0;
    consecutiveOk++;

    let found = 0;
    for (const t of batch) {
      const e = out.get(t);
      if (!e) { S.done[t] = { status: "error", checkedAt: Date.now() }; continue; }
      if (e.forbidden) {
        if (!S.done[t] || S.done[t].status !== "forbidden") log("reserved topic (auth required), skipping: " + t);
        S.done[t] = { status: "forbidden", checkedAt: Date.now() };
        continue;
      }
      if (e.msgs.length) { if (recordLive(t, e.msgs)) found++; }
      else if (!S.done[t]) S.done[t] = { status: "dead", checkedAt: Date.now() };
    }
    S.cursor += batch.length;
    S.counters.scanned += batch.length;

    if (consecutiveOk % 15 === 0 && S.batch < cfg.batch) {
      S.batch = Math.min(cfg.batch, S.batch + 1);
      log("ramping batch back up to " + S.batch);
    }

    emit("progress", progressPayload());
    save();
    // once new-topic tokens are exhausted the sustainable rate is 1/min, so stop
    // pretending and pace deliberately rather than collecting 429s
    await sleep(S.creationPace ? 62000 : (400 + Math.random() * 300));
  }
}

let refreshStamps = [];
let budgetWarned = false;
function markRefresh() { refreshStamps.push(Date.now()); }
function refreshLastHour() {
  const cut = Date.now() - 3600000;
  refreshStamps = refreshStamps.filter(function (x) { return x > cut; });
  return refreshStamps.length;
}

async function refreshLoop() {
  while (!shuttingDown) {
    if (!cfg.refreshMinutes) { await sleep(5000); continue; }
    if (probePending > 0 || probeActive) { await sleep(1200); continue; }
    if (gateMs() > 0) { await gateWait(); continue; }

    const now = Date.now();
    const due = [];
    for (const t in S.done) {
      const d = S.done[t];
      if (d.status === "live" && (d.nextDue || 0) <= now) due.push(t);
    }
    if (!due.length) { await sleep(5000); continue; }
    if (refreshLastHour() >= cfg.maxRefreshPerHour) { await sleep(60000); continue; }

    if (dailyRemaining() <= 0) {
      if (!budgetWarned) {
        log("daily bandwidth budget exhausted (" + Math.round(dailyBudgetBytes() / 1048576) + " MB) - refresh paused until the date rolls");
        budgetWarned = true;
      }
      await sleep(60000);
      continue;
    }

    due.sort(function (a, b) { return (S.done[a].bytes || 0) - (S.done[b].bytes || 0); });
    // A backlog of entries missing the newest analysis fields is re-polled at full
    // width once; otherwise cheapest-first ordering leaves the big, interesting
    // topics (test, prompt) carrying stale scores for a long time.
    const batch = due.slice(0, staleAnalysis ? 25 : Math.min(S.batch, 10));

    // estimate replay cost from what each cache held last time (wire overhead ~1.8x)
    let est = 0;
    for (const t of batch) est += Math.round((S.done[t].bytes || 0) * 1.8) + 400;
    if (est > dailyRemaining()) {
      log("skipping " + batch.length + " refresh(es): replay ~" + Math.round(est / 1024) + " KB, only " + Math.round(dailyRemaining() / 1024) + " KB left today");
      for (const t of batch) S.done[t].nextDue = Date.now() + 3600000;
      await sleep(30000);
      continue;
    }
    const out = new Map();
    const res = await pollResolving(batch, out);

    if (!res.done) {
      if (res.status === 429 || res.status === 403) { handleThrottle(res); continue; }
      await sleep(4000);
      continue;
    }

    S.consecutive429 = 0;
    S.counters.refreshes++;
    rollDaily();
    S.daily.refreshes++;

    for (const t of batch) {
      const e = out.get(t);
      if (!e || e.forbidden) { S.done[t].nextDue = Date.now() + 3600000; markRefresh(); continue; }
      if (e.msgs.length) recordLive(t, e.msgs);
      else {
        S.done[t].lastPolled = Date.now();
        S.done[t].nextDue = Date.now() + refreshIntervalMs(S.done[t]) * 2;
      }
      markRefresh();
    }

    if (staleAnalysis) {
      let still = false;
      for (const t in S.done) {
        const d = S.done[t];
        if (d.status === "live" && d.analysisVersion !== ANALYSIS_VERSION) { still = true; break; }
      }
      if (!still) { staleAnalysis = false; log("analysis backlog cleared"); }
    }

    emit("progress", progressPayload());
    await sleep(600);
  }
}

/* ------------------------------- payloads ------------------------------- */

function progressPayload() {
  return {
    cursor: S.cursor,
    total: Math.min(cfg.maxTopics, ALL.length),
    generated: ALL.length,
    known: Object.keys(S.done).length,
    live: countStatus("live"),
    dead: countStatus("dead"),
    forbidden: countStatus("forbidden"),
    reserved: reservedList(),
    structural: structureFlagged(),
    probePending: probePending,
    cooling: !!S.cooling,
    coolOffMins: S.coolOffMins || null,
    agents: agentCount(),
    categories: categoryCounts(),
    vendors: vendorCounts(),
    counters: S.counters,
    batch: S.batch,
    throttle: { remainingMs: gateMs(), reason: S.throttle.reason, kind: S.throttle.kind },
    uptimeMs: Date.now() - S.startedAt,
    refreshLastHour: refreshLastHour(),
    daily: {
      date: rollDaily().date, bytes: S.daily.bytes, budget: dailyBudgetBytes(),
      remaining: dailyRemaining(), refreshes: S.daily.refreshes,
      creations: S.daily.creations, creationPace: !!S.creationPace
    },
    cfg: cfg
  };
}

function statePayload() {
  return { progress: progressPayload(), hits: recentHits.slice(0, 60), log: S.log.slice(-120), base: BASE };
}

function livePayload(kind, q) {
  const out = [];
  for (const t in S.done) {
    const d = S.done[t];
    if (d.status !== "live") continue;
    if (kind && d.kind !== kind) continue;
    if (q && t.indexOf(q) < 0) continue;
    out.push({
      topic: t, count: d.count, last: d.last, kind: d.kind, bytes: d.bytes, sample: d.sample,
      previews: d.previews, nextDue: d.nextDue,
      confidence: d.confidence || 0, evidence: d.evidence || [], metrics: d.metrics || {}, scores: d.scores || {},
      archived: d.archived || 0, tier: d.tier || "T1", signatures: d.signatures || [], meta: d.meta || {},
      voice: d.voice || null, structure: d.structure || null, conversation: d.conversation || null, agent: d.agent || null
    });
  }
  out.sort(function (a, b) { return (b.last || 0) - (a.last || 0); });
  return { live: out, total: out.length };
}

function exportPayload() {
  return {
    exportedAt: new Date().toISOString(),
    base: BASE,
    progress: progressPayload(),
    live: livePayload().live
  };
}

/* ------------------------------- extra operations ------------------------------- */

async function probeTopics(list) {
  const out = {};
  const bs = Math.min(25, Math.max(1, S.batch));
  for (let i = 0; i < list.length;) {
    await gateWait();
    if (shuttingDown) break;
    const batch = list.slice(i, i + bs);
    const resolved = new Map();
    const res = await pollResolving(batch, resolved);
    if (!res.done) {
      if (res.status === 429 || res.status === 403) { handleThrottle(res); continue; }
      for (const t of batch) out[t] = { status: res.status || 0, count: 0 };
      i += batch.length;
      continue;
    }
    for (const t of batch) {
      const e = resolved.get(t);
      if (!e) { out[t] = { status: 0, count: 0 }; continue; }
      if (e.forbidden) { out[t] = { status: 403, count: 0, forbidden: true }; continue; }
      if (e.msgs.length) {
        recordLive(t, e.msgs);
        out[t] = { status: 200, count: e.msgs.length, kind: S.done[t].kind, sample: S.done[t].sample };
      } else {
        if (!S.done[t]) S.done[t] = { status: "dead", checkedAt: Date.now() };
        out[t] = { status: 200, count: 0 };
      }
    }
    i += batch.length;
    await sleep(400);
  }
  save();
  return out;
}

/* Only one probe may run at a time, and the loops stand down while it does.
   Without this, discovery + refresh + two probe calls all hammer the same visitor
   bucket at once and produce a 429 storm where nobody makes progress. */
let probeActive = false;
let probePending = 0;          // queued AND executing
let probeChain = Promise.resolve();

/* PROBE PRIORITY. When request tokens are the scarce resource (they usually are,
   see E1), spending them on bulk discovery of novel names is the worst use: those
   are mostly dead and cost a creation token each. A targeted probe is where the
   findings come from (hermes, opencode-notifications). So while anything is
   queued, both loops stand down completely and the probe gets the next token. */
function queueProbe(list) {
  probePending++;
  const run = probeChain.then(function () {
    probePending--;
    probeActive = true;
    return probeTopics(list);
  }).then(function (r) {
    probeActive = false;
    return r;
  }, function (e) {
    probeActive = false;
    throw e;
  });
  probeChain = run.then(function () {}, function () {});
  return run;
}

async function publish(topic, message, title, tags) {
  const q = [];
  if (title) q.push("title=" + encodeURIComponent(title));
  if (tags) q.push("tags=" + encodeURIComponent(tags));
  const url = BASE + "/" + encodeURIComponent(topic) + (q.length ? "?" + q.join("&") : "");
  const res = await fetch(url, { method: "POST", body: message, headers: { "user-agent": UA } });
  return { status: res.status };
}

/* ------------------------------- http ------------------------------- */

const MIME = { ".html": "text/html; charset=utf-8", ".js": "application/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8" };

function sendJson(res, obj, code) {
  const body = JSON.stringify(obj);
  res.writeHead(code || 200, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  res.end(body);
}

function sendFile(res, file) {
  fs.readFile(file, function (err, buf) {
    if (err) { res.writeHead(404); res.end("not found"); return; }
    res.writeHead(200, { "content-type": MIME[path.extname(file)] || "application/octet-stream", "cache-control": "no-store" });
    res.end(buf);
  });
}

function readJson(req, cb) {
  let body = "";
  req.on("data", function (c) { body += c; if (body.length > 1e6) req.destroy(); });
  req.on("end", function () {
    let obj = {};
    try { obj = body ? JSON.parse(body) : {}; } catch (e) { obj = {}; }
    cb(obj);
  });
}

function applyConfig(b) {
  if (typeof b.discovery === "boolean") cfg.discovery = b.discovery;
  if (typeof b.batch === "number") cfg.batch = Math.max(1, Math.min(25, Math.floor(b.batch)));
  if (typeof b.maxTopics === "number") cfg.maxTopics = Math.max(1, Math.min(ALL.length, Math.floor(b.maxTopics)));
  if (typeof b.refreshMinutes === "number") cfg.refreshMinutes = Math.max(0, Math.floor(b.refreshMinutes));
  if (typeof b.maxRefreshPerHour === "number") cfg.maxRefreshPerHour = Math.max(0, Math.floor(b.maxRefreshPerHour));
  if (typeof b.dailyByteBudgetMB === "number") cfg.dailyByteBudgetMB = Math.max(10, Math.min(500, b.dailyByteBudgetMB));
  if (typeof b.resetCursor === "boolean" && b.resetCursor) S.cursor = 0;
  log("config updated: " + JSON.stringify(cfg));
  emit("progress", progressPayload());
  save();
}

const server = http.createServer(function (req, res) {
  const u = new URL(req.url, "http://" + (req.headers.host || "localhost"));
  const p = u.pathname;

  if (req.method === "GET") {
    if (p === "/" || p === "/index.html") return sendFile(res, path.join(ASSETS, "ui.html"));
    if (p === "/ui.js") return sendFile(res, path.join(ASSETS, "ui.js"));
    if (p === "/ui.css") return sendFile(res, path.join(ASSETS, "ui.css"));
    if (p === "/topics.js") return sendFile(res, path.join(ASSETS, "topics.js"));
    if (p === "/api/state") return sendJson(res, statePayload());
    if (p === "/api/live") return sendJson(res, livePayload(u.searchParams.get("kind"), u.searchParams.get("q")));
    if (p === "/api/categories") return sendJson(res, { categories: categoryCounts(), vendors: vendorCounts(), producers: producerCounts(), reserved: reservedList(), structural: structureFlagged(), agents: agentCount(), meta: SIG.CATEGORY_META });
    if (p === "/api/anomalies") return sendJson(res, anomaliesPayload());
    if (p === "/api/promising") return sendJson(res, promisingPayload());
    if (p === "/api/overview") return sendJson(res, overviewPayload());
    if (p === "/api/topics") return sendJson(res, topicsArchivePayload());
    if (p === "/api/topic") return sendJson(res, topicArchivePayload(u.searchParams.get("name") || "", parseInt(u.searchParams.get("limit") || "300", 10)));
    if (p === "/signals.js") return sendFile(res, path.join(ASSETS, "signals.js"));
    if (p === "/api/export") return sendJson(res, exportPayload());
    if (p === "/api/log") return sendJson(res, { log: S.log.slice(-200) });

    if (p === "/api/events") {
      res.writeHead(200, {
        "content-type": "text/event-stream; charset=utf-8",
        "cache-control": "no-store",
        "connection": "keep-alive"
      });
      res.write("retry: 3000\n\n");
      clients.add(res);
      const hb = setInterval(function () { try { res.write(": ping\n\n"); } catch (e) {} }, 25000);
      req.on("close", function () { clearInterval(hb); clients.delete(res); });
      return;
    }
    res.writeHead(404); return res.end("not found");
  }

  if (req.method === "POST") {
    if (p === "/api/config") return readJson(req, function (b) { applyConfig(b); sendJson(res, statePayload()); });
    if (p === "/api/probe-batch") {
      return readJson(req, async function (b) {
        const list = (b.topics || []).filter(T.validateTopic).slice(0, 200);
        if (!list.length) return sendJson(res, { error: "no valid topics" }, 400);
        const out = await queueProbe(list);
        sendJson(res, { results: out });
      });
    }
    if (p === "/api/publish") {
      return readJson(req, async function (b) {
        if (!T.validateTopic(b.topic || "")) return sendJson(res, { error: "invalid topic" }, 400);
        if (!b.message) return sendJson(res, { error: "empty message" }, 400);
        try {
          const r = await publish(b.topic, b.message, b.title, b.tags);
          log("published to " + b.topic + " -> HTTP " + r.status);
          sendJson(res, r);
        } catch (e) { sendJson(res, { error: String(e.message || e) }, 500); }
      });
    }
    if (p === "/api/reset") {
      return readJson(req, function (b) {
        if (!b.confirm) return sendJson(res, { error: "confirm required" }, 400);
        S.done = {}; S.cursor = 0;
        S.counters = { requests: 0, r429: 0, r403: 0, rCreate: 0, rBandwidth: 0, wire: 0, scanned: 0, liveFound: 0, refreshes: 0 };
        recentHits.length = 0;
        saveNow();
        log("state reset");
        sendJson(res, statePayload());
      });
    }
    res.writeHead(404); return res.end("not found");
  }

  res.writeHead(405); res.end("method not allowed");
});

server.listen(PORT, HOST, function () {
  log("collector listening on http://" + HOST + ":" + PORT);
  log("target=" + BASE + " candidates=" + ALL.length + " batch=" + cfg.batch + " maxTopics=" + cfg.maxTopics);
  log("discovery=" + cfg.discovery + " refreshMinutes=" + cfg.refreshMinutes);
  discoveryLoop();
  refreshLoop();
});
