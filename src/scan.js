#!/usr/bin/env node
/* One-shot CLI scanner. The long-running version is collector.js.
   Usage: node src/scan.js --top 200 --batch 25 --max-minutes 20 */
"use strict";
const fs = require("fs");
const path = require("path");
const T = require("./topics.js");
const SIG = require("./signals.js");

function flag(name, def) {
  const i = process.argv.indexOf(name);
  if (i === -1) return def;
  const v = process.argv[i + 1];
  return v && v.indexOf("--") !== 0 ? v : true;
}

const DRY = !!flag("--dry-run", false);
const TOP = parseInt(flag("--top", "14697"), 10);
const MAX_MIN = parseFloat(flag("--max-minutes", "20"));
const BATCH0 = Math.min(25, parseInt(flag("--batch", "25"), 10));
const BASE = flag("--base", "https://ntfy.sh").replace(/\/+$/, "");
const OUT = flag("--out", path.join(__dirname, "..", "data"));
const UA = "ntfy-collector/2.0 (read-only public cache poll)";

const ALL = T.generateTopics().slice(0, TOP);
if (DRY) {
  console.log("candidates: " + ALL.length);
  console.log("head: " + ALL.slice(0, 30).join(" "));
  process.exit(0);
}

const STATE_FILE = path.join(OUT, "scan-state.json");
const HITS_FILE = path.join(OUT, "hits.jsonl");

let state = { done: {}, requests: 0, r429: 0, r403: 0, rCreate: 0, batch: BATCH0 };
if (fs.existsSync(STATE_FILE)) { try { state = Object.assign(state, JSON.parse(fs.readFileSync(STATE_FILE, "utf8"))); } catch (e) {} }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function log(m) { const l = "[" + new Date().toISOString().slice(11, 19) + "] " + m; console.log(l); }

function parseNdjson(text) {
  const by = new Map();
  for (const line of text.split("\n")) {
    const s = line.trim(); if (!s) continue;
    let m; try { m = JSON.parse(s); } catch (e) { continue; }
    if (m.event === "keepalive" || m.event === "open" || !m.topic) continue;
    if (!by.has(m.topic)) by.set(m.topic, []);
    by.get(m.topic).push(m);
  }
  return by;
}

function reason(text) {
  try { const j = JSON.parse(text); return { code: j.code || 0, message: j.message || "" }; }
  catch (e) { return { code: 0, message: "" }; }
}

async function pollBatch(batch) {
  const url = BASE + "/" + batch.join(",") + "/json?poll=1";
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 30000);
  try {
    const res = await fetch(url, { headers: { "user-agent": UA }, signal: ctrl.signal });
    clearTimeout(timer);
    let text = ""; try { text = await res.text(); } catch (e) {}
    return { status: res.status, text, retryAfter: parseInt(res.headers.get("retry-after") || "0", 10) };
  } catch (e) {
    clearTimeout(timer);
    return { status: 0, text: "", error: String((e && e.message) || e) };
  }
}

async function main() {
  const todo = ALL.filter((t) => !state.done[t]);
  log("candidates=" + ALL.length + " todo=" + todo.length + " batch=" + state.batch);
  const deadline = Date.now() + MAX_MIN * 60000;
  let i = 0, batchSize = state.batch, consec = 0, scanned = 0;

  while (i < todo.length) {
    if (Date.now() > deadline) { log("budget exhausted"); break; }
    const batch = todo.slice(i, i + batchSize);
    const r = await pollBatch(batch);
    state.requests++;

    if (r.status === 403 && /forbidden|40301/.test(r.text)) {
      if (batch.length === 1) {
        state.done[batch[0]] = { status: "forbidden" };
        log("reserved topic, skipping: " + batch[0]);
        i += 1;
        continue;
      }
      batchSize = 1; state.batch = 1;
      log("403 forbidden in batch (reserved topic) -> isolating at batch=1");
      continue;
    }
    if (r.status === 429 || r.status === 403) {
      const rr = reason(r.text);
      const creation = /new topics|topic creation/i.test(rr.message);
      if (creation) { state.rCreate++; batchSize = 1; }
      else if (r.status === 429) state.r429++; else state.r403++;
      if (r.status === 403 && batchSize > 4) batchSize = Math.max(4, Math.floor(batchSize / 2));
      consec++;
      const wait = creation ? 62000 : (r.retryAfter > 0 ? r.retryAfter * 1000 : Math.min(15000, 5000 * Math.pow(1.25, Math.min(consec, 8))));
      log("HTTP " + r.status + " [" + (rr.message || "throttle") + "] gate " + (wait / 1000).toFixed(1) + "s batch=" + batchSize);
      state.batch = batchSize;
      fs.writeFileSync(STATE_FILE, JSON.stringify(state));
      await sleep(wait + Math.random() * 500);
      continue;
    }
    if (r.status === 0) { log("network error " + r.error); await sleep(5000); continue; }
    if (r.status !== 200) { i += batch.length; continue; }

    consec = 0;
    const by = parseNdjson(r.text);
    let live = 0;
    for (const topic of batch) {
      const msgs = by.get(topic) || [];
      if (msgs.length) {
        live++;
        const last = msgs[msgs.length - 1];
        const kind = SIG.classify(msgs);
        state.done[topic] = { status: "live", count: msgs.length, last: last.time, kind, sample: String(last.message || "").slice(0, 200) };
        fs.appendFileSync(HITS_FILE, JSON.stringify({ topic, count: msgs.length, last: last.time, kind }) + "\n");
      } else {
        state.done[topic] = { status: "dead" };
      }
    }
    i += batch.length; scanned += batch.length;
    if (batchSize < BATCH0 && (i / batchSize) % 12 === 0) { batchSize = Math.min(BATCH0, batchSize + 1); }
    log("progress " + i + "/" + todo.length + " live+" + live + " batch=" + batchSize);
    fs.writeFileSync(STATE_FILE, JSON.stringify(state));
    await sleep(400 + Math.random() * 200);
  }

  fs.writeFileSync(STATE_FILE, JSON.stringify(state));
  const live = Object.entries(state.done).filter((e) => e[1].status === "live");
  log("DONE scanned=" + scanned + " live=" + live.length + " requests=" + state.requests + " creationLimits=" + state.rCreate);
  live.sort((a, b) => (b[1].count || 0) - (a[1].count || 0));
  for (const e of live.slice(0, 50)) log("  LIVE " + String(e[0]).padEnd(24) + " " + String(e[1].kind).padEnd(9) + " " + String(e[1].sample || "").slice(0, 60).replace(/\s+/g, " "));
}

main().catch((e) => { log("FATAL " + ((e && e.stack) || e)); process.exit(1); });
