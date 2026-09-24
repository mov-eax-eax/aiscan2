"use strict";
/* EXPERIMENT E1: does a multi-topic poll cost ONE request token, or one per topic?
   Design assumption under test: server.go wraps handleSubscribeJSON in limitRequests,
   so a batch should cost 1 token. The 429 storm suggests otherwise.
   Method: existing topics only (zero creation cost), long quiet period first.     */
const fs = require("fs");
const EXISTING = ["ai","test","chat","prompt","mcp","fleet","alerts","notify","system",
                  "vps","laptop","camera","messages","hello","hey","yo","yes","new"];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rows = [];

async function hit(label, topics) {
  const url = "https://ntfy.sh/" + topics.join(",") + "/json?poll=1";
  const t0 = Date.now();
  try {
    const res = await fetch(url, { headers: { "user-agent": "ntfy-experiment/1.0" } });
    let len = 0; try { len = (await res.text()).length; } catch (e) {}
    const ms = Date.now() - t0;
    console.log(label.padEnd(26) + " n=" + String(topics.length).padStart(2) + "  status=" + res.status + "  bytes=" + String(len).padStart(7) + "  ms=" + ms);
    rows.push({ label: label, n: topics.length, status: res.status, bytes: len, ms: ms, at: new Date().toISOString() });
    return res.status;
  } catch (e) {
    console.log(label.padEnd(26) + " n=" + String(topics.length).padStart(2) + "  ERR " + e.message);
    rows.push({ label: label, n: topics.length, status: 0, error: String(e.message), at: new Date().toISOString() });
    return 0;
  }
}

(async function () {
  console.log("E1: batch-cost test. Quiet period first (collector paused, no probes).\n");
  console.log("cooldown 90s...");
  await sleep(90000);
  console.log("");
  await hit("A single existing", ["ai"]);
  await sleep(8000);
  await hit("B batch of 5", EXISTING.slice(0, 5));
  await sleep(8000);
  await hit("C batch of 18", EXISTING);
  await sleep(20000);
  await hit("D single again", ["test"]);
  await sleep(20000);
  await hit("E batch of 25 (18 real)", EXISTING.concat(["build","deploy","backup","sync","cache","queue","temp"]));

  console.log("\nVERDICT:");
  const a = rows.find(function (r) { return r.label.indexOf("A single") === 0; });
  const c = rows.find(function (r) { return r.label.indexOf("C batch") === 0; });
  if (a && a.status === 429) console.log("  IP is contended even after 90s idle -> shared-bucket exhaustion, not our volume.");
  else if (a && a.status === 200 && c && c.status === 429) console.log("  BATCHING IS COUNTERPRODUCTIVE: single ok, batch 429 -> cost scales with topic count.");
  else if (a && a.status === 200 && c && c.status === 200) console.log("  Batching is fine: batch costs ~1 token. Storm was volume/contention.");
  else console.log("  inconclusive: " + JSON.stringify(rows));

  fs.mkdirSync("experiments", { recursive: true });
  fs.writeFileSync("experiments/e1-batch-cost.json", JSON.stringify({ ranAt: new Date().toISOString(), rows: rows }, null, 2));
  console.log("\nwrote experiments/e1-batch-cost.json");
})();
