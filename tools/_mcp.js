"use strict";
(async function () {
  const t0 = Date.now();
  try {
    const res = await fetch("https://ntfy.sh/mcp/json?poll=1", { headers: { "user-agent": "ntfy-diag/1.0" } });
    const body = await res.text();
    console.log("HTTP " + res.status + "  " + body.length + " bytes  " + (Date.now() - t0) + "ms");
    if (res.status !== 200) { console.log("body: " + body.slice(0, 200)); return; }
    const lines = body.split("\n").filter(function (l) { return l.trim(); });
    console.log("messages in cache: " + lines.length);
    lines.forEach(function (l, i) {
      let m; try { m = JSON.parse(l); } catch (e) { return; }
      const ts = new Date(m.time * 1000).toISOString();
      let id = null, client = null, ver = null, method = null;
      try { const j = JSON.parse(m.message); id = j.id; method = j.method; ver = j.params && j.params.protocolVersion; client = j.params && j.params.clientInfo && j.params.clientInfo.name; } catch (e) {}
      console.log("  [" + i + "] " + ts + "  ntfy-id=" + m.id + "  " + (m.bytes || ""));
      console.log("        rpc.id=" + id + "  method=" + method + "  proto=" + ver + "  client=" + client);
      console.log("        raw: " + m.message.slice(0, 220));
    });
  } catch (e) { console.log("ERR " + e.message); }
})();
