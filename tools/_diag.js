"use strict";
(async function () {
  const t0 = Date.now();
  try {
    const res = await fetch("https://ntfy.sh/ai/json?poll=1", { headers: { "user-agent": "ntfy-diag/1.0" } });
    const b = await res.text();
    console.log("direct request -> HTTP " + res.status + "  " + b.length + " bytes  " + (Date.now() - t0) + "ms");
    if (res.status === 429) { try { console.log("body: " + b.slice(0, 200)); } catch (e) {} }
  } catch (e) { console.log("direct request -> ERR " + e.message); }
})();
