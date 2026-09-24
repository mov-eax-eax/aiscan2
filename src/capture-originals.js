"use strict";
/* Capture full, untruncated originals for known-live topics into data/archive/
   and a human-readable data/originals.md. Existing topics only: no creation cost. */
const fs = require("fs");
const path = require("path");

const DATA = path.join(__dirname, "..", "data");
const ARCH = path.join(DATA, "archive");
fs.mkdirSync(ARCH, { recursive: true });
const FENCE = String.fromCharCode(96).repeat(3);

let live = ["prompt", "mcp", "llm", "ai", "chat", "fleet"];
try {
  const st = JSON.parse(fs.readFileSync(path.join(DATA, "state.json"), "utf8"));
  const found = Object.keys(st.done || {}).filter(function (t) { return st.done[t].status === "live"; });
  live = Array.from(new Set(live.concat(found)));
} catch (e) {}

function norm(topic, m) {
  return {
    id: m.id, time: m.time, event: m.event, topic: topic,
    title: (m.title != null ? m.title : null),
    priority: (m.priority != null ? m.priority : null),
    tags: (m.tags || null),
    click: (m.click || null),
    actions: (m.actions || null),
    attachment: (m.attachment || null),
    message: String(m.message || "")
  };
}

function stamp(t) {
  return new Date(t * 1000).toISOString().replace("T", " ").slice(0, 19);
}

(async function () {
  const md = [];
  md.push("# Original messages");
  md.push("");
  md.push("Full, untruncated wire content. Nothing here is clipped or summarised.");
  md.push("Captured " + new Date().toISOString() + " from the ntfy 12h cache.");
  md.push("");

  const index = [];
  for (const topic of live) {
    let text = "";
    try {
      const res = await fetch("https://ntfy.sh/" + topic + "/json?poll=1", { headers: { "user-agent": "ntfy-collector/2.2 (originals capture)" } });
      text = await res.text();
      if (res.status !== 200) { console.log(topic + " -> HTTP " + res.status); continue; }
    } catch (e) { console.log(topic + " -> ERR " + e.message); continue; }

    const byId = new Map();
    for (const line of text.split("\n")) {
      const s = line.trim();
      if (!s) continue;
      let m;
      try { m = JSON.parse(s); } catch (e) { continue; }
      if (m.event === "keepalive" || m.event === "open" || !m.topic) continue;
      if (!byId.has(m.id)) byId.set(m.id, norm(topic, m));
    }
    const msgs = Array.from(byId.values()).sort(function (a, b) { return a.time - b.time; });
    fs.writeFileSync(path.join(ARCH, topic + ".jsonl"), msgs.map(function (m) { return JSON.stringify(m); }).join("\n") + (msgs.length ? "\n" : ""));

    index.push({ topic: topic, n: msgs.length });
    md.push("## " + topic + "  (" + msgs.length + " messages)");
    md.push("");
    for (let i = 0; i < msgs.length; i++) {
      const m = msgs[i];
      const bits = ["id=" + m.id, stamp(m.time)];
      if (m.priority != null) bits.push("priority=" + m.priority);
      if (m.title) bits.push("title=" + JSON.stringify(m.title));
      if (m.tags) bits.push("tags=" + JSON.stringify(m.tags));
      if (m.click) bits.push("click=" + m.click);
      if (m.attachment) bits.push("attachment=" + JSON.stringify(m.attachment));
      md.push("### " + topic + " #" + (i + 1) + "  " + bits.join("  "));
      md.push("");
      md.push(FENCE);
      md.push(m.message);
      md.push(FENCE);
      md.push("");
    }
    console.log(topic + " -> " + msgs.length + " originals archived");
    await new Promise(function (r) { setTimeout(r, 1200); });
  }

  fs.writeFileSync(path.join(DATA, "originals.md"), md.join("\n"));
  fs.writeFileSync(path.join(DATA, "archive-index.json"), JSON.stringify({ at: new Date().toISOString(), topics: index }, null, 2));
  console.log("");
  console.log("wrote data/originals.md and " + index.length + " archive files");
})();
