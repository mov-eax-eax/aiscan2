#!/usr/bin/env node
/**
 * Reserved-topic scanner.
 *
 * Finds names ntfy.sh refuses to serve (HTTP 403, code 40301 "forbidden", needs auth),
 * then maps the alternate-channel tree for each one.
 *
 * Why splitting is mandatory: a multi-topic subscription fails as a whole if ANY one
 * topic is reserved. So a batch that 403s must be halved recursively until the reserved
 * name is isolated. Without that, one reserved topic hides every other result in the batch.
 *
 *   node src/reserved-scan.js --budget-minutes 25
 */
"use strict";
const fs = require("fs");
const path = require("path");

const BASE = (process.env.NTFY_BASE || "https://ntfy.sh").replace(/\/+$/, "");
const DATA = path.join(__dirname, "..", "data");
const OUT = path.join(DATA, "reserved.json");
const STATE = path.join(DATA, "reserved-state.json");
const UA = "ntfy-collector/2.1 (read-only reserved-name probe)";
fs.mkdirSync(DATA, { recursive: true });

function flag(name, def) {
  const i = process.argv.indexOf(name);
  if (i === -1) return def;
  const v = process.argv[i + 1];
  return v && v.indexOf("--") !== 0 ? v : true;
}
const BUDGET_MIN = parseFloat(flag("--budget-minutes", "25"));

/* Names most likely to be claimed or reserved: vendor brands, infra roles, generic nouns. */
const CANDIDATES = [
  // AI vendors and brands
  "claude","openai","anthropic","gpt","chatgpt","gemini","google","microsoft","apple",
  "amazon","aws","meta","facebook","whatsapp","telegram","discord","slack","zoom","github",
  "gitlab","docker","kubernetes","nginx","apache","redis","postgres","mysql","mongodb",
  "grafana","prometheus","terraform","ansible","jenkins","cloudflare","stripe","paypal",
  "coinbase","binance","netflix","spotify","tesla","spacex","nasa","linux","ubuntu",
  "android","windows","macos","copilot","ollama","langchain","huggingface","perplexity",
  "mistral","llama","deepseek","qwen","grok","grok","character","replika",
  // infra roles
  "admin","root","api","www","mail","smtp","imap","dns","vpn","proxy","gateway","router",
  "firewall","system","server","host","node","cluster","database","db","cache","queue",
  "worker","scheduler","cron","backup","restore","deploy","release","staging","production",
  "prod","dev","tests","qa","debug","trace","logs","log","metrics","monitoring","monitor",
  "alert","alerts","notification","notifications","webhook","callback","hook","health",
  "status","uptime","ping","pong","heartbeat","dashboard","console","portal","control",
  // generic nouns
  "home","work","office","family","friends","team","group","chat","message","messages",
  "inbox","outbox","sent","draft","notes","task","tasks","todo","calendar","event","events",
  "reminder","news","info","support","help","contact","sales","billing","invoice","payment",
  "security","auth","login","logout","token","key","keys","secret","secrets","password",
  "private","public","personal","main","general","random","misc","default","temp","archive",
  "trash","spam","important","urgent","emergency","broadcast","announce","updates","feed"
];

const ALT_SUFFIX = ["-1", "-2", "-3", "-internal", "-bot", "-main", "-alt", "-notify", "2"];
const CAPABILITY = ["llm", "ai", "agent", "assistant", "chat", "mcp", "bot"];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function log(m) { console.log("[" + new Date().toISOString().slice(11, 19) + "] " + m); }

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
  try { const j = JSON.parse(text); return { code: j.code || 0, message: j.message || "" }; }
  catch (e) { return { code: 0, message: "" }; }
}
function isCreation(text) { return /new topics|topic creation/i.test(text || ""); }
function isForbidden(text) { const i = bodyInfo(text); return i.code === 40301 || /forbidden/i.test(text || ""); }

const stats = { requests: 0, r429: 0, r403: 0, rCreate: 0, probed: 0, bytes: 0 };
let gateUntil = 0;

async function pollBatch(batch) {
  const url = BASE + "/" + batch.join(",") + "/json?poll=1";
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 30000);
  try {
    const res = await fetch(url, { headers: { "user-agent": UA }, signal: ctrl.signal });
    clearTimeout(timer);
    let text = "";
    try { text = await res.text(); } catch (e) { text = ""; }
    return { status: res.status, text, retryAfter: parseInt(res.headers.get("retry-after") || "0", 10) };
  } catch (e) {
    clearTimeout(timer);
    return { status: 0, text: "", error: String((e && e.message) || e) };
  }
}

async function gate() {
  while (Date.now() < gateUntil) await sleep(Math.min(1000, gateUntil - Date.now()));
}

/** Resolve a batch to per-topic results, splitting to expose reserved names. */
async function resolve(batch, out) {
  await gate();
  const r = await pollBatch(batch);
  stats.requests++;

  if (r.status === 200) {
    stats.bytes += Buffer.byteLength(r.text);
    const by = parseNdjson(r.text);
    for (const t of batch) {
      const msgs = by.get(t) || [];
      out.set(t, msgs.length ? { state: "occupied", count: msgs.length } : { state: "free", count: 0 });
    }
    return true;
  }

  if (r.status === 403 && isForbidden(r.text)) {
    if (batch.length === 1) { out.set(batch[0], { state: "reserved", count: 0 }); return true; }
    const mid = Math.ceil(batch.length / 2);
    await sleep(250);
    if (!(await resolve(batch.slice(0, mid), out))) return false;
    await sleep(250);
    return await resolve(batch.slice(mid), out);
  }

  if (r.status === 429 || r.status === 403) {
    stats.r429++;
    let wait = r.retryAfter > 0 ? r.retryAfter * 1000 : 8000;
    if (isCreation(r.text)) { stats.rCreate++; wait = 62000; }
    gateUntil = Date.now() + Math.min(wait, 120000);
    log("throttled" + (isCreation(r.text) ? " [new topics, 1/min]" : "") + " -> gate " + Math.round(wait / 1000) + "s");
    return false;
  }
  if (r.status === 0) { log("network error: " + r.error); await sleep(5000); return false; }
  for (const t of batch) out.set(t, { state: "error", code: r.status, count: 0 });
  return true;
}

let phaseLabel = "phase1";

/* Written after EVERY batch. A 30-minute scan that is interrupted before main()
   finishes must not lose everything - that is exactly what happened once already. */
function checkpoint(map, total) {
  try {
    const obj = { phase: phaseLabel, at: new Date().toISOString(), stats: stats, probed: map.size, total: total, topics: {} };
    for (const [t, v] of map) obj.topics[t] = v;
    const tmp = path.join(DATA, "reserved-partial.json.tmp");
    fs.writeFileSync(tmp, JSON.stringify(obj, null, 2));
    fs.renameSync(tmp, path.join(DATA, "reserved-partial.json"));
  } catch (e) { /* never let a checkpoint kill the scan */ }
}

async function probeList(list) {
  const out = new Map();
  const B = 25;
  for (let i = 0; i < list.length;) {
    const batch = list.slice(i, i + B);
    const ok = await resolve(batch, out);
    if (!ok) continue;
    i += batch.length;
    stats.probed += batch.length;
    checkpoint(out, list.length);
    if (stats.probed % 25 < B) log("probed " + stats.probed + " requests=" + stats.requests + " creationLimits=" + stats.rCreate);
    await sleep(350 + Math.random() * 250);
  }
  return out;
}

async function main() {
  const deadline = Date.now() + BUDGET_MIN * 60000;
  log("scanning " + CANDIDATES.length + " candidate names against " + BASE);

  const uniq = Array.from(new Set(CANDIDATES));
  const primary = await probeList(uniq);

  const reserved = [];
  const occupied = [];
  const free = [];
  for (const [t, v] of primary) {
    if (v.state === "reserved") reserved.push(t);
    else if (v.state === "occupied") occupied.push(t);
    else if (v.state === "free") free.push(t);
  }
  log("phase 1 done: reserved=" + reserved.length + " occupied=" + occupied.length + " free=" + free.length);

  // phase 2: alternate tree for every reserved name
  const trees = {};
  const altSet = new Set();
  for (const name of reserved) {
    const alts = ALT_SUFFIX.map((s) => name + s).concat(CAPABILITY.slice(0, 4));
    trees[name] = { alternates: alts, results: {} };
    alts.forEach((a) => altSet.add(a));
  }
  const altList = Array.from(altSet);
  phaseLabel = "phase2";
  log("phase 2: probing " + altList.length + " alternates across " + reserved.length + " reserved names");

  if (altList.length && Date.now() < deadline) {
    const altRes = await probeList(altList);
    for (const name of reserved) {
      for (const a of trees[name].alternates) {
        const v = altRes.get(a) || { state: "unknown", count: 0 };
        trees[name].results[a] = v;
      }
      const pick = trees[name].alternates.find((a) => trees[name].results[a].state === "free")
        || trees[name].alternates.find((a) => trees[name].results[a].state === "occupied");
      trees[name].suggested = pick || null;
    }
  }

  const report = {
    generatedAt: new Date().toISOString(),
    base: BASE,
    stats,
    counts: { reserved: reserved.length, occupied: occupied.length, free: free.length },
    reserved: reserved.sort(),
    occupied: occupied.sort(),
    free: free.sort().slice(0, 200),
    trees
  };
  fs.writeFileSync(OUT, JSON.stringify(report, null, 2));
  fs.writeFileSync(STATE, JSON.stringify({ done: true, at: Date.now() }));

  log("=== RESERVED (" + reserved.length + ") ===");
  reserved.forEach((t) => {
    const tr = trees[t];
    const altTxt = tr ? Object.keys(tr.results).map((k) => k + ":" + tr.results[k].state).join("  ") : "";
    log("  " + t.padEnd(18) + " -> " + (tr && tr.suggested ? "suggest " + tr.suggested : "no free alternate"));
    if (altTxt) log("      " + altTxt);
  });
  log("=== OCCUPIED sample ===");
  occupied.slice(0, 30).forEach((t) => log("  " + t));
  log("wrote " + OUT);
}

main().catch((e) => { log("FATAL " + ((e && e.stack) || e)); process.exit(1); });
