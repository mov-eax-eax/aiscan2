"use strict";
/* E8: RECOVERY TIME. We keep retrying every 8-36s, which spends tokens as fast as
   they refill, so we never observe recovery. Measure it instead of guessing.
   Silent throughout; one request per trial. */
const fs = require("fs");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const TRIALS = [2, 5, 10, 20];      // minutes of silence before a single probe
const EXISTING = "https://ntfy.sh/ai/json?poll=1";
const out = { startedAt: new Date().toISOString(), trials: [] };

(async function () {
  for (const mins of TRIALS) {
    console.log("waiting " + mins + " min of TOTAL silence...");
    await sleep(mins * 60000);
    const t0 = Date.now();
    try {
      const res = await fetch(EXISTING, { headers: { "user-agent": "ntfy-experiment/1.0" } });
      const body = await res.text();
      const rec = { silenceMin: mins, status: res.status, bytes: body.length, ms: Date.now() - t0, at: new Date().toISOString() };
      out.trials.push(rec);
      console.log("  -> after " + mins + " min silence: HTTP " + res.status + " (" + body.length + " bytes, " + rec.ms + "ms)");
      if (res.status === 200) { out.recoveredAfterMin = mins; break; }
    } catch (e) {
      out.trials.push({ silenceMin: mins, status: 0, error: String(e.message) });
      console.log("  -> after " + mins + " min silence: ERR " + e.message);
    }
  }
  fs.mkdirSync("experiments", { recursive: true });
  fs.writeFileSync("experiments/e8-recovery.json", JSON.stringify(out, null, 2));
  console.log("E8 DONE: " + JSON.stringify(out.trials));
})();
