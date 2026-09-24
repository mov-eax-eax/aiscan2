"use strict";
/* retrieve.js - ONE-SHOT retrieval. Governed by a single constraint:
 * DO NOT GET THROTTLED.
 *
 * Therefore: EXACTLY ONE HTTP REQUEST PER INVOCATION. No retry, no loop, no bisect,
 * no backoff schedule. If the response is not 200, we stop and report - because a
 * retry is what turns one request into a storm, and a storm is what got us blocked.
 *
 * Topics are passed as argv. Only pass names ALREADY CONFIRMED READABLE (not reserved):
 * a reserved name would 403 the whole batch, wasting the one request we allow.
 */
const fs = require("fs");
const path = require("path");
const topics = process.argv.slice(2);
if (!topics.length) { console.log("usage: node src/retrieve.js <topic> [topic...]"); process.exit(1); }

const ARCH = path.join(__dirname, "..", "data", "archive");
const url = "https://ntfy.sh/" + topics.join(",") + "/json?poll=1";
console.log("ONE request -> " + topics.length + " topic(s): " + topics.join(", "));

(async function () {
  const ctrl = new AbortController();
  const timer = setTimeout(function () { ctrl.abort(); }, 45000);
  let status = 0, text = "", err = "";
  try {
    const res = await fetch(url, { headers: { "user-agent": "ntfy-retrieve/1.0 (one-shot)" }, signal: ctrl.signal });
    clearTimeout(timer);
    status = res.status;
    text = await res.text();
  } catch (e) { clearTimeout(timer); err = String(e.message); }

  if (status === 0) {
    console.log("RESULT: NO RESPONSE (" + err + ")");
    console.log("This is the blackhole signature (status 0, timeout, no HTTP code).");
    console.log("NOT retrying. Exiting after one request, as designed.");
    process.exit(0);
  }
  if (status !== 200) {
    console.log("RESULT: HTTP " + status);
    console.log(text.slice(0, 300));
    console.log("NOT retrying. Exiting after one request, as designed.");
    process.exit(0);
  }

  const by = {};
  const seen = {};
  for (const line of text.split(/\r?\n/)) {
    const s = line.trim(); if (!s) continue;
    let m; try { m = JSON.parse(s); } catch (e) { continue; }
    if (!m.topic || m.event !== "message") continue;
    (by[m.topic] = by[m.topic] || []).push(m);
  }
  console.log("");
  let added = 0, total = 0;
  for (const t of topics) {
    const msgs = by[t] || [];
    total += msgs.length;
    if (!msgs.length) { console.log("  " + t.padEnd(24) + "0 messages"); continue; }
    const f = path.join(ARCH, t + ".jsonl");
    const old = fs.existsSync(f) ? fs.readFileSync(f, "utf8").split(/\r?\n/).filter(function (l) { return l.trim(); }) : [];
    for (const l of old) { try { seen[JSON.parse(l).id] = 1; } catch (e) {} }
    const fresh = [];
    for (const m of msgs) { if (seen[m.id]) continue; seen[m.id] = 1; fresh.push(JSON.stringify(m)); }
    const merged = old.concat(fresh);
    fs.writeFileSync(f + ".tmp", merged.join("\n") + "\n");
    fs.renameSync(f + ".tmp", f);
    added += fresh.length;
    console.log("  " + t.padEnd(24) + msgs.length + " messages, " + fresh.length + " new, " + merged.length + " archived");
  }
  console.log("");
  console.log("RESULT: HTTP 200 - " + total + " messages returned, " + added + " newly archived");
  console.log("ONE request used. Done.");
})();
