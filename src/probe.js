"use strict";
/* Harness-name prober v1.5 - adds the ranked derivation list (derive-candidates.js).
   v1.4
   v1.3 fixed the 403/429 conflation. v1.4 fixes the OTHER way a batch gets lost:
   a genuine throttle rejects the ENTIRE multi-topic request, so a batch of 24 that
   contains one not-yet-created name discarded all 23 results that were free to read.
   Now: on a throttle, BISECT, bank whatever resolves, and only ever rest when a
   round makes ZERO progress. Work is a queue of unresolved names, not a cursor. */
const fs = require("fs");
const path = require("path");
const LISTS = {
  "harness-expand": ["windsurf","windsurf-notifications","copilot","copilot-cli","continue","zed","aider","aider-notifications","cline","goose","gemini-cli","roo-code","kilo-code","amp","devin","replit","codeium","warp","augment","tabnine","sourcegraph","cody","bolt","lovable","v0","qwen-code","grok-cli","claude-code-notifications","codex-notifications","cursor-notifications","antigravity","kiro","trae","claude","gemini","copilot-notifications"],
  "harness-events": ["agent-done","needs-input","needs-approval","permission-request","approval","task-complete","turn-complete","session-complete","agent-events","agent-status","notifier","ai-notifier","ai-notifications"],
  "reserved-derivations": ["claude-1","claude1","claude-ai","claude-notifications","claude-code-1","claude-code1","my-claude","opencode-1","opencode1","my-opencode","opencode-bot","home-1","home-assistant","homeassistant","my-home","me-1","my-notes","inbox-1","my-inbox","agents-1","agents-notifications","agent-events","myhome-1","my-home-1"],
  "suffix-twists": ["codex-1","codex1","codex-2026","codex2026","my-codex","cursor-1","cursor1","cursor-2026","my-cursor","hermes-1","hermes1","test1234","test-123","agent123","ai123","llm1","llm-1","notify1","notify-1","home2026","home-2026"],
  "override-names": ["my-topic","mytopic","topic","default","personal","misc","stuff","done","needs_input","task-done","build-done","my-agent","my-ai","ai-done","ai-needs-input","codex-done"],
  "agent-names": ["alice","bob","carol","dave","eve","frank","grace","heidi","code-reviewer","test-runner","debugger","researcher","planner","architect","builder","tester","explorer","agent-2","worker-1","session-1","task-1","alpha","omega","falcon","raven"],
  "persona-names": ["alfred","jarvis","friday","samantha","cortana","athena","oracle","edith","karen","writer","critic","analyst","manager","coder","optimizer","assistant","my-assistant","ai-assistant"]
};
const OUT = path.join(__dirname, "..", "data", "probe-results.json");
const sleep = (ms) => new Promise(function (r) { setTimeout(r, ms); });
function log(m) { console.log("[" + new Date().toISOString().slice(11, 19) + "] " + m); }
let results = {};
try { if (fs.existsSync(OUT)) results = JSON.parse(fs.readFileSync(OUT, "utf8")); } catch (e) { results = {}; }
function save() { try { fs.writeFileSync(OUT + ".tmp", JSON.stringify(results, null, 2)); fs.renameSync(OUT + ".tmp", OUT); } catch (e) {} }

async function pollBatch(topics) {
  const url = "https://ntfy.sh/" + topics.join(",") + "/json?poll=1";
  const ctrl = new AbortController();
  const timer = setTimeout(function () { ctrl.abort(); }, 30000);
  try {
    const res = await fetch(url, { headers: { "user-agent": "ntfy-probe/1.5" }, signal: ctrl.signal });
    clearTimeout(timer);
    let text = ""; try { text = await res.text(); } catch (e) {}
    return { status: res.status, text: text };
  } catch (e) { clearTimeout(timer); return { status: 0, error: String(e.message), text: "" }; }
}
function parseNdjson(text) {
  const by = {};
  for (const line of text.split("\n")) {
    const s = line.trim(); if (!s) continue;
    let m; try { m = JSON.parse(s); } catch (e) { continue; }
    if (m.event === "keepalive" || m.event === "open" || !m.topic) continue;
    (by[m.topic] = by[m.topic] || []).push(m);
  }
  return by;
}
function classify(status, text) {
  try {
    const j = JSON.parse(text);
    if (j.code === 40301 || j.http === 403) return "forbidden";
    if (j.code === 42901 || j.code === 42903 || j.code === 42904 || j.code === 42905 || j.http === 429) return "throttle";
  } catch (e) {}
  if (status === 429) return "throttle";
  if (status === 403) return "forbidden";
  return "other";
}
const RESTS = [90, 120, 180, 300, 600, 900];
const START_DELAY = Number(process.env.RUNWAY || 60);
const MAX_ZERO_ROUNDS = 5;

/* THE DERIVATION AVENUE, loaded first so it spends the creation burst.
   data/derive-candidates.json is produced OFFLINE by derive-candidates.js and is already
   ranked by expected yield and filtered against everything previously probed. */
let ORDER = Object.keys(LISTS);
try {
  const dc = JSON.parse(fs.readFileSync("data/derive-candidates.json", "utf8"));
  const LIMIT = Number(process.env.DERIVE_LIMIT || 40);
  const top = (dc.probeReady || []).slice(0, LIMIT).map(function (c) { return c.name; });
  if (top.length) {
    LISTS["derivation-top"] = top;
    ORDER = ["derivation-top"].concat(ORDER);
    log("loaded " + top.length + " ranked derivation candidates (DERIVE_LIMIT=" + LIMIT + ")");
  }
} catch (e) { log("no derive-candidates.json - skipping the derivation list"); }

(async function () {
  let ok = 0, throttled = 0, reservedTotal = 0, occTotal = 0, zeroRounds = 0;
  log("runway " + START_DELAY + "s; queue-based, banks partial results, rests only on zero progress");
  await sleep(START_DELAY * 1000);

  /* Record whatever a 200 gives us. */
  function take(batch, store, text) {
    const by = parseNdjson(text);
    for (const t of batch) {
      const msgs = by[t] || [];
      store[t] = msgs.length
        ? { count: msgs.length, sample: String(msgs[msgs.length - 1].message || "").slice(0, 260) }
        : { count: 0 };
    }
  }
  /* Returns "ok" | "forbidden" | "throttle" | "other" | "neterr".
     On throttle with >1 topic it splits and recurses, banking any half that survives. */
  async function resolve(batch, store) {
    const r = await pollBatch(batch);
    if (r.status === 200) { take(batch, store, r.text); return "ok"; }
    const kind = classify(r.status, r.text);
    if (kind === "forbidden") {
      if (batch.length === 1) { store[batch[0]] = { reserved: true, count: 0 }; return "ok"; }
      const mid = Math.ceil(batch.length / 2);
      await sleep(700);
      await resolve(batch.slice(0, mid), store);
      await sleep(700);
      await resolve(batch.slice(mid), store);
      return "ok";
    }
    if (r.status === 0) return "neterr";
    if (kind === "throttle") {
      if (batch.length === 1) return "throttle";
      const mid = Math.ceil(batch.length / 2);
      await sleep(1000);
      await resolve(batch.slice(0, mid), store);
      await sleep(1000);
      await resolve(batch.slice(mid), store);
      return "split";
    }
    return "other";
  }

  for (const name of ORDER) {
    results[name] = results[name] || {};
    let pending = LISTS[name].filter(function (t) { return !(t in results[name]); });
    if (!pending.length) { log(name + " already complete"); continue; }
    log("=== " + name + " (" + LISTS[name].length + ", " + pending.length + " to go) ===");
    let zero = 0;
    while (pending.length) {
      const batch = pending.slice(0, 24);
      const store = {};
      const outcome = await resolve(batch, store);
      const got = Object.keys(store).length;
      Object.keys(store).forEach(function (t) { results[name][t] = store[t]; });
      pending = pending.filter(function (t) { return !(t in results[name]); });
      if (got > 0) {
        save();
        const res = Object.keys(store).filter(function (t) { return store[t].reserved; });
        const occ = Object.keys(store).filter(function (t) { return store[t].count; });
        ok++; zero = 0; zeroRounds = 0;
        reservedTotal += res.length; occTotal += occ.length;
        log("  banked " + got + " (" + (LISTS[name].length - pending.length) + "/" + LISTS[name].length + ")"
          + (res.length ? "  RESERVED: " + res.join(",") : "")
          + (occ.length ? "  OCCUPIED: " + occ.map(function (t) { return t + "(" + store[t].count + ")"; }).join(",") : ""));
        await sleep(700);
      } else {
        throttled++; zero++; zeroRounds++;
        if (zero >= MAX_ZERO_ROUNDS) {
          log("  " + pending.length + " names unresolved after " + zero + " zero-progress rounds - DEFERRING: " + pending.join(","));
          break;
        }
        const restS = RESTS[Math.min(zeroRounds - 1, RESTS.length - 1)];
        log("  no progress (" + outcome + ") zeroRound=" + zeroRounds + " -> resting " + restS + "s, " + pending.length + " still pending");
        await sleep(restS * 1000);
      }
    }
    save();
  }
  log("ALL DONE ok=" + ok + " throttled=" + throttled + " reserved=" + reservedTotal + " occupied=" + occTotal);
})();
