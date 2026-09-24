/* Frontend: reads the collector, never contacts ntfy directly. */
"use strict";

var ST = { progress: null, live: [], hits: [], log: [], anomalies: [], leads: [], meta: {}, filterCat: "", producers: {}, reserved: [], leadSort: "score" };
var DETAIL = { topic: null, messages: [] };

async function openTopic(topic) {
  el("detail").style.display = "flex";
  el("detailTopic").textContent = topic;
  el("detailMeta").textContent = "loading originals...";
  el("detailBody").innerHTML = "";
  try {
    var j = await (await fetch("/api/topic?name=" + encodeURIComponent(topic) + "&limit=600")).json();
    if (j.error) { el("detailMeta").textContent = "error: " + j.error; return; }
    DETAIL.topic = topic;
    DETAIL.messages = j.messages || [];
    el("detailMeta").textContent = j.total + " original messages" + (j.returned < j.total ? " (showing last " + j.returned + ")" : "");
    el("detailBody").innerHTML = DETAIL.messages.length ? DETAIL.messages.map(function (m, i) {
      var bits = ["#" + (i + 1), new Date(m.time * 1000).toLocaleString()];
      if (m.priority != null) bits.push("priority " + m.priority);
      if (m.title) bits.push("title: " + esc(m.title));
      if (m.tags && m.tags.length) bits.push("tags: " + esc(m.tags.join(", ")));
      if (m.click) bits.push("click: " + esc(m.click));
      if (m.attachment) bits.push("attachment");
      return '<div class="orig"><div class="origmeta">' + bits.join(" &middot; ") +
        '</div><pre class="origbody">' + esc(m.message) + "</pre></div>";
    }).join("") : '<div class="dim small">no archived messages for this topic yet - the collector archives on each poll</div>';
  } catch (e) {
    el("detailMeta").textContent = "failed: " + e.message;
  }
}

function closeDetail() { el("detail").style.display = "none"; }

function el(id) { return document.getElementById(id); }
function esc(s) {
  var d = document.createElement("div");
  d.textContent = (s == null ? "" : String(s));
  return d.innerHTML;
}
function fmtBytes(n) {
  if (!n) return "0 B";
  if (n < 1024) return n + " B";
  if (n < 1048576) return (n / 1024).toFixed(1) + " KB";
  return (n / 1048576).toFixed(2) + " MB";
}
function fmtDur(ms) {
  if (!ms) return "-";
  var s = Math.floor(ms / 1000);
  if (s < 60) return s + "s";
  if (s < 3600) return Math.floor(s / 60) + "m";
  if (s < 86400) return (s / 3600).toFixed(1) + "h";
  return (s / 86400).toFixed(1) + "d";
}
function relTime(ts) {
  if (!ts) return "-";
  var d = Math.floor(Date.now() / 1000 - ts);
  if (d < 60) return d + "s ago";
  if (d < 3600) return Math.floor(d / 60) + "m ago";
  if (d < 86400) return Math.floor(d / 3600) + "h ago";
  return Math.floor(d / 86400) + "d ago";
}
function pct(n) { return Math.round((n || 0) * 100) + "%"; }

async function post(path, body) {
  var r = await fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body || {}) });
  return r.json();
}

/* ------------------------- render ------------------------- */

function renderStats() {
  var p = ST.progress;
  if (!p) return;
  var c = p.counters || {};
  var t = p.throttle || {};
  el("stats").innerHTML = [
    "<span>discovered <b>" + p.known + "</b></span>",
    "<span>live <b>" + p.live + "</b></span>",
    "<span>dead <b>" + p.dead + "</b></span>",
    "<span>reserved <b>" + (p.forbidden || 0) + "</b></span>",
    "<span>cursor <b>" + p.cursor + "/" + p.total + "</b></span>",
    "<span>requests <b>" + c.requests + "</b></span>",
    "<span>new-topic limits <b>" + (c.rCreate || 0) + "</b></span>",
    "<span>wire <b>" + fmtBytes(c.wire) + "</b></span>",
    "<span>refreshes/h <b>" + p.refreshLastHour + "</b></span>",
    "<span>uptime <b>" + fmtDur(p.uptimeMs) + "</b></span>"
  ].join("");

  el("statusRows").innerHTML = [
    ["batch", p.batch],
    ["max topics", p.cfg ? p.cfg.maxTopics : "-"],
    ["discovery", p.cfg && p.cfg.discovery ? "on" : "off"],
    ["refresh every", (p.cfg ? p.cfg.refreshMinutes : 0) + " min"],
    ["bandwidth today", p.daily ? (fmtBytes(p.daily.bytes) + " / " + fmtBytes(p.daily.budget)) : "-"],
    ["creation pace", p.daily && p.daily.creationPace ? "1 new topic/min" : "burst available"],
    ["probes queued", (p.probePending || 0) + (p.probePending > 0 ? "  (discovery suspended)" : "")],
    ["cool-off", p.cooling ? "ACTIVE - no ntfy traffic" : "no"],
    ["throttle", t.remainingMs > 0 ? (fmtDur(t.remainingMs) + " (" + (t.kind || "?") + ")") : "clear"]
  ].map(function (r) {
    return '<div class="rowlabel"><span>' + esc(r[0]) + '</span><b>' + esc(r[1]) + '</b></div>';
  }).join("");

  var b = el("banner");
  var budgetOut = p.daily && p.daily.remaining <= 0;
  if (budgetOut) {
    b.style.display = "block";
    b.textContent = "Daily bandwidth budget reached (" + fmtBytes(p.daily.bytes) + " of " + fmtBytes(p.daily.budget) +
      "). Refresh paused until the date rolls. Discovery still runs - it costs creation tokens, not bytes.";
  } else if (t.remainingMs > 0) {
    b.style.display = "block";
    b.textContent = "Throttled (" + (t.kind || "limit") + "): " + (t.reason || "") +
      " - paused for " + fmtDur(t.remainingMs) + ", resumes automatically.";
  } else {
    b.style.display = "none";
  }

  if (p.cfg) {
    if (document.activeElement !== el("cfgBatch")) el("cfgBatch").value = p.cfg.batch;
    if (document.activeElement !== el("cfgMax")) el("cfgMax").value = p.cfg.maxTopics;
    if (document.activeElement !== el("cfgRefresh")) el("cfgRefresh").value = p.cfg.refreshMinutes;
    el("cfgDiscovery").checked = !!p.cfg.discovery;
  }
  renderCats();
}

function renderCats() {
  var cats = (ST.progress && ST.progress.categories) || {};
  var meta = ST.meta || {};
  var keys = Object.keys(meta).sort(function (a, b) { return meta[a].order - meta[b].order; });
  var html = '<button class="catbtn' + (ST.filterCat === "" ? " on" : "") + '" data-cat="">all</button>';
  keys.forEach(function (k) {
    var n = cats[k] || 0;
    if (!n) return;
    var m = meta[k] || { label: k, color: "#6e7681" };
    html += '<button class="catbtn' + (ST.filterCat === k ? " on" : "") + '" data-cat="' + esc(k) + '" title="' + esc(m.desc || "") + '">' +
      '<i style="background:' + m.color + '"></i>' + esc(m.label) + ' <b>' + n + '</b></button>';
  });
  el("cats").innerHTML = html;

  var v = (ST.progress && ST.progress.vendors) || {};
  var vk = Object.keys(v).sort(function (a, b) { return v[b] - v[a]; });
  el("vendors").innerHTML = vk.length
    ? vk.map(function (k) { return '<span class="vchip">' + esc(k) + ' <b>' + v[k] + '</b></span>'; }).join("")
    : '<span class="dim small">none detected yet</span>';

  var pk = Object.keys(ST.producers || {}).sort(function (a, b) { return ST.producers[b] - ST.producers[a]; });
  el("producers").innerHTML = pk.length
    ? pk.map(function (k) { return '<span class="vchip">' + esc(k) + ' <b>' + ST.producers[k] + '</b></span>'; }).join("")
    : '<span class="dim small">no titled producers yet</span>';

  var res = (ST.progress && ST.progress.reserved) || ST.reserved || [];
  el("resCount").textContent = String(res.length);
  el("reserved").innerHTML = res.length
    ? res.map(function (t) { return '<span class="vchip" style="border-color:var(--err)">' + esc(t) + '</span>'; }).join("")
    : '<span class="dim small">none found yet</span>';
}

function evidenceHTML(items) {
  if (!items || !items.length) return "";
  return '<div class="ev">' + items.slice(0, 4).map(function (e) {
    return '<span class="evchip" title="' + esc(e.snippet || "") + '">' + esc(e.id) + " +" + e.w + "</span>";
  }).join("") + "</div>";
}

async function refreshOverview() {
  try { ST.overview = await (await fetch("/api/overview")).json(); renderOverview(); } catch (e) {}
}

function renderOverview() {
  var o = ST.overview;
  if (!o) return;
  var b = o.budget, e = o.efficiency;
  el("dashDate").textContent = b.date;
  el("dashBudgetPct").textContent = b.pct.toFixed(2) + "%";
  el("dashBudgetBar").style.width = Math.min(100, b.pct) + "%";
  el("dashUsed").textContent = fmtBytes(b.used) + " / " + fmtBytes(b.budget);
  el("dashRemaining").textContent = fmtBytes(b.remaining);
  el("dashBurn").textContent = fmtBytes(b.burnPerHour) + "/h";
  el("dashHours").textContent = (b.hoursLeft == null) ? "-" : (b.hoursLeft > 72 ? "> 72 h" : b.hoursLeft.toFixed(1) + " h");
  el("dashCreations").textContent = String(b.creations);
  el("dashPace").textContent = b.creationPace ? "1 new topic / min" : "burst available";

  el("dashYield").textContent = e.agentRatePct.toFixed(2) + "%";
  el("dashTpr").textContent = e.topicsPerRequest + " topics";
  el("dashBpr").textContent = fmtBytes(e.bytesPerRequest);
  el("dashLiveRate").textContent = e.liveRatePct.toFixed(2) + "%  (" + e.liveFound + ")";
  el("dashAgents").textContent = e.agentsFound + " / " + e.conversations;
  el("dashThrottle").textContent = e.throttleHits + "  (new-topic " + e.creationLimits + ")";
  el("dashTph").textContent = e.topicsPerHour + " / h";
  el("dashRemain2").textContent = e.remainingToScan + " topics";

  el("dashLeads").innerHTML = (o.leads && o.leads.length) ? o.leads.map(function (l) {
    var tag;
    if (l.agent && l.agent.isAgent) tag = '<span class="kind k-agent-anomaly">AGENT ' + l.agent.score + "</span>";
    else if (l.conversation && l.conversation.score >= 0.6) tag = '<span class="kind k-ai-relay">T4 ' + l.conversation.score + "</span>";
    else tag = '<span class="kind k-' + esc(l.kind || "noise") + '">' + esc(l.kind || "-") + "</span>";
    var age = l.firstSeen ? relTime(Math.floor(l.firstSeen / 1000)) : "-";
    return '<div class="dlead"><b class="tp">' + esc(l.topic) + "</b> " + tag +
      ' <span class="dim">' + (l.status === "live" ? l.count + " msgs" : esc(String(l.status))) + "</span>" +
      '<span class="age">' + esc(age) + "</span></div>";
  }).join("") : '<div class="dim small">nothing yet</div>';
}

function switchContent(name) {
  var views = document.querySelectorAll(".cview");
  for (var i = 0; i < views.length; i++) views[i].classList.toggle("on", views[i].id === "cview-" + name);
  var tabs = document.querySelectorAll(".ctab");
  for (var j = 0; j < tabs.length; j++) tabs[j].classList.toggle("on", tabs[j].getAttribute("data-cview") === name);
}

function renderLive() {
  var f = (el("filter").value || "").toLowerCase();
  var items = ST.live.filter(function (t) {
    if (ST.filterCat && t.kind !== ST.filterCat) return false;
    if (f && t.topic.toLowerCase().indexOf(f) < 0) return false;
    return true;
  });
  el("liveCount").textContent = items.length + " shown of " + ST.live.length;
  el("empty").style.display = items.length ? "none" : "block";

  el("grid").innerHTML = items.map(function (t) {
    var pv = (t.previews || []).map(function (m) {
      return '<div class="msg"><span class="t">' + esc(relTime(m.t)) + "</span>" + esc(m.m) + "</div>";
    }).join("");
    var m = t.metrics || {};
    var flags = [];
    if (m.repeatRatio > 0.5) flags.push("repeat " + pct(m.repeatRatio));
    if (m.jsonRatio > 0.3) flags.push("json " + pct(m.jsonRatio));
    if (m.maxLen > 500) flags.push("max " + m.maxLen + "B");
    return '<div class="card" data-topic="' + esc(t.topic) + '">' +
      '<h3><span class="tp">' + esc(t.topic) + '</span><span class="kind k-' + esc(t.kind) + '">' + esc(t.kind) + " " + pct(t.confidence) + "</span></h3>" +
      '<div class="meta"><b>' + t.count + "</b> cached &middot; " + esc(relTime(t.last)) + " &middot; " + fmtBytes(t.bytes) +
      " &middot; next " + esc(fmtDur(Math.max(0, (t.nextDue || 0) - Date.now()))) +
      (flags.length ? " &middot; " + esc(flags.join(", ")) : "") + "</div>" +
      evidenceHTML(t.evidence) +
      (pv || '<div class="msg dim">no preview</div>') +
      "</div>";
  }).join("");
}

function renderAnomalies() {
  var a = ST.anomalies || [];
  el("anomCount").textContent = String(a.length);
  el("anoms").innerHTML = a.length ? a.map(function (x) {
    return '<div class="anom">' +
      '<div class="anomhead"><b class="tp">' + esc(x.topic) + '</b>' +
      '<span class="kind k-' + esc(x.kind) + '">' + esc(x.kind) + " " + pct(x.confidence) + "</span></div>" +
      evidenceHTML(x.evidence) +
      '<div class="dim small">' + esc(String(x.sample || "").slice(0, 170)) + "</div>" +
      "</div>";
  }).join("") : '<div class="dim small">nothing anomalous yet</div>';
}

function renderLeads() {
  var a = (ST.leads || []).slice();
  if (el("agentsOnly") && el("agentsOnly").checked) {
    a = a.filter(function (x) { return x.agent && x.agent.isAgent; });
  }
  if (ST.leadSort === "density") {
    a.sort(function (x, y) { return ((y.voice && y.voice.density) || 0) - ((x.voice && x.voice.density) || 0); });
  } else if (ST.leadSort === "tier") {
    a.sort(function (x, y) { return String(x.tier).localeCompare(String(y.tier)); });
  } else if (ST.leadSort === "recent") {
    a.sort(function (x, y) { return (y.last || 0) - (x.last || 0); });
  }
  el("leadCount").textContent = String(a.length);
  el("leads").innerHTML = a.length ? a.map(function (x) {
    var t = x.tier || "T1";
    var why = (x.reasons || []).map(esc).join(" &middot; ");

    var live;
    if (x.status === "reserved") {
      live = '<span class="res">reserved - auth required, deliberately claimed</span>';
    } else {
      var c = (x.prevCount != null ? x.prevCount + " &rarr; " : "") + x.count +
        (x.countDelta ? " (" + (x.countDelta > 0 ? "+" : "") + x.countDelta + ")" : "");
      var id = "";
      if (x.counter != null) {
        id = " &middot; id " + x.counter;
        if (x.prevCounter != null && x.counter > x.prevCounter) {
          id += ' <b class="up">+' + (x.counter - x.prevCounter) + "</b>";
        }
      }
      live = x.observations + " obs &middot; count " + c + id +
        (x.archived ? " &middot; <b>" + x.archived + " originals archived</b>" : "");
    }

    var bits = [];
    if (x.meta && x.meta.titles && x.meta.titles.length) bits.push("title: " + esc(x.meta.titles.join(" / ")));
    if (x.meta && x.meta.tags && x.meta.tags.length) bits.push("tags: " + esc(x.meta.tags.join(", ")));
    if (x.meta && x.meta.priority != null) bits.push("priority " + x.meta.priority);
    if (x.meta && x.meta.actions) bits.push("action buttons");
    if (x.methods && x.methods.length) bits.push("methods: " + esc(x.methods.join(", ")));
    if (x.signatures && x.signatures.length) bits.push("signatures: " + esc(x.signatures.join(", ")));
    if (x.agent && x.agent.score > 0) {
      bits.push((x.agent.isAgent ? '<b style="color:#ff7b72">AGENT ' + x.agent.score + "</b> " : '<span class="dim">agent? ' + x.agent.score + "</span> ") +
        esc(x.agent.markers.slice(0, 5).join("/")) + (x.agent.vendor ? ' <span class="dim">vendor=' + esc(x.agent.vendor) + "</span>" : ""));
    }
    if (x.conversation && x.conversation.score > 0) {
      bits.push('<b style="color:#ffd33d">conversation ' + x.conversation.score + "</b> " +
        x.conversation.bestCount + " turns / " + x.conversation.humans + " human msgs" +
        (x.conversation.windowSec != null ? " in " + Math.round(x.conversation.windowSec / 60) + "m" : "") +
        " " + esc(x.conversation.markers.join("/")));
    }
    if (x.structure && x.structure.markers && x.structure.markers.length) {
      bits.push('<b style="color:var(--warn)">structure ' + x.structure.score + "</b>: " +
        esc(x.structure.markers.map(function (m) { return m.id; }).join("/")) +
        ' <span class="dim">(n=' + x.structure.n + " cv=" + x.structure.timingCv + ")</span>");
    }
    if (x.voice && x.voice.score > 0) {
      bits.push('<b style="color:var(--anom)">voice ' + x.voice.score.toFixed(2) +
        "</b> density " + (x.voice.density || 0).toFixed(2) +
        " (" + (x.voice.expressive || 0) + "/" + (x.voice.messages || 0) + "): " +
        esc(x.voice.markers.slice(0, 4).join("/")));
    }

    return '<div class="lead" data-topic="' + esc(x.topic) + '">' +
      '<div class="leadhead"><span class="tier tier-' + esc(t) + '">' + esc(t) + '</span>' +
      '<b class="tp">' + esc(x.topic) + '</b>' +
      '<span class="kind k-' + esc(x.kind) + '">' + esc(x.kind) + '</span>' +
      '<span class="leadscore">' + x.score + '</span></div>' +
      '<div class="leadwhy">' + (why || "no signals") + '</div>' +
      '<div class="leadmeta">' + live + '</div>' +
      (bits.length ? '<div class="leadmeta">' + bits.join(" &middot; ") + '</div>' : "") +
      evidenceHTML(x.evidence) +
      (x.sample ? '<pre class="leadsample">' + esc(String(x.sample).slice(0, 400)) + "</pre>" : "") +
      "</div>";
  }).join("") : '<div class="dim small">no leads yet</div>';
}

function renderHits() {
  el("hits").innerHTML = ST.hits.slice(0, 40).map(function (h) {
    return '<div class="hit"><b class="tp">' + esc(h.topic) + '</b> <span class="dim">' + esc(h.kind || "") + "</span><br>" +
      '<span class="dim">' + esc(String(h.sample || "").slice(0, 120)) + "</span></div>";
  }).join("") || '<div class="dim small">nothing yet</div>';
}

function renderLog() {
  el("log").textContent = ST.log.slice(-80).join("\n");
  el("log").scrollTop = el("log").scrollHeight;
}

/* ------------------------- data ------------------------- */

var liveTimer = null;
async function refreshLive() {
  if (liveTimer) return;
  liveTimer = setTimeout(function () { liveTimer = null; }, 2500);
  try {
    var j = await (await fetch("/api/live")).json();
    ST.live = j.live || [];
    renderLive();
  } catch (e) {}
}

async function refreshAnomalies() {
  try {
    var j = await (await fetch("/api/anomalies")).json();
    ST.anomalies = j.anomalies || [];
    renderAnomalies();
  } catch (e) {}
}

var leadsTimer = null;
async function refreshLeads() {
  if (leadsTimer) return;
  leadsTimer = setTimeout(function () { leadsTimer = null; }, 3000);
  try {
    var j = await (await fetch("/api/promising")).json();
    ST.leads = j.leads || [];
    renderLeads();
  } catch (e) {}
}

async function refreshMeta() {
  try {
    var j = await (await fetch("/api/categories")).json();
    ST.meta = j.meta || {};
    ST.producers = j.producers || {};
    ST.reserved = j.reserved || [];
    renderCats();
  } catch (e) {}
}

async function refreshState() {
  try {
    var j = await (await fetch("/api/state")).json();
    ST.progress = j.progress;
    ST.hits = j.hits || [];
    ST.log = j.log || [];
    renderStats(); renderHits(); renderLog();
    setConn(true);
  } catch (e) { setConn(false); }
}

function setConn(ok) { el("conn").className = "dot " + (ok ? "ok" : "bad"); }

function connect() {
  var es = new EventSource("/api/events");
  es.onopen = function () { setConn(true); };
  es.onerror = function () { setConn(false); };
  es.onmessage = function (ev) {
    var m;
    try { m = JSON.parse(ev.data); } catch (e) { return; }
    if (m.type === "progress") { ST.progress = m.data; renderStats(); refreshLeads(); }
    else if (m.type === "live") { ST.hits.unshift(m.data); renderHits(); refreshLive(); refreshLeads(); }
    else if (m.type === "anomaly") { ST.anomalies.unshift(m.data); renderAnomalies(); refreshLeads(); }
    else if (m.type === "throttle") { refreshState(); }
    else if (m.type === "log") { ST.log.push(m.data.line); if (ST.log.length > 300) ST.log.shift(); renderLog(); }
  };
}

/* ------------------------- agent rendezvous ------------------------- */

var VENDOR_OF = { claude: "anthropic", gpt: "openai", chatgpt: "openai", gemini: "google", llama: "meta", mistral: "mistral", copilot: "microsoft" };
var LADDER = null;

function sha256Hex(str) {
  return crypto.subtle.digest("SHA-256", new TextEncoder().encode(str)).then(function (buf) {
    return Array.prototype.slice.call(new Uint8Array(buf)).map(function (x) {
      return ("0" + x.toString(16)).slice(-2);
    }).join("");
  });
}

function deriveLadder(base, h, agentMode) {
  var rungs = [];
  if (agentMode) {
    rungs.push({ topic: base, note: "own name - most likely reserved" });
    [1, 2, 3].forEach(function (d) { rungs.push({ topic: base + "-" + d, note: "own name + digit" }); });
    var v = VENDOR_OF[base];
    if (v) {
      rungs.push({ topic: v, note: "vendor name" });
      rungs.push({ topic: v + "-internal", note: "vendor internal" });
    }
    ["llm", "ai", "assistant", "agent", "chat"].forEach(function (c) { rungs.push({ topic: c, note: "capability" }); });
    ["mcp", "mcp-internal"].forEach(function (c) { rungs.push({ topic: c, note: "protocol" }); });
  } else {
    rungs.push({ topic: base, note: "public default" });
    for (var d = 1; d <= 9; d++) rungs.push({ topic: base + "-" + d, note: "lazy increment" });
    ["internal", "private", "secret", "hidden", "common", "shared", "public", "global"].forEach(function (m) {
      rungs.push({ topic: base + "-" + m, note: "modifier" });
    });
  }
  rungs.push({ topic: base + "-" + h.slice(0, 6), note: "peers-only, 24 bits" });
  rungs.push({ topic: base + "-" + h.slice(0, 10), note: "peers-only, 40 bits" });
  rungs.push({ topic: h.slice(0, 16), note: "opaque, 64 bits" });
  return rungs;
}

function renderLadder() {
  if (!LADDER) return;
  el("rvLadder").innerHTML = '<table class="lad">' + LADDER.map(function (r) {
    var occ;
    if (r.forbidden) occ = '<span class="res">reserved</span>';
    else if (r.count === undefined) occ = '<span class="dim">?</span>';
    else if (r.count > 0) occ = '<span class="occ">occupied ' + r.count + "</span>";
    else occ = '<span class="free">free</span>';
    return "<tr><td>" + esc(r.topic) + '</td><td class="dim">' + esc(r.note) + "</td><td>" + occ + "</td></tr>";
  }).join("") + "</table>";
}

async function derive() {
  var base = (el("rvBase").value || "ai").trim().toLowerCase();
  var pass = el("rvPass").value || "";
  if (!NtfyTopics.validateTopic(base)) { el("rvNote").textContent = "invalid identity"; return; }
  var h = await sha256Hex(pass);
  LADDER = deriveLadder(base, h, el("rvAgent").checked);
  renderLadder();
  el("rvNote").textContent = "SHA-256(" + (pass ? "passphrase" : "empty") + ") = " + h.slice(0, 20) + "... - probing sends nothing, but unknown names create topics";
}

async function probe() {
  if (!LADDER) await derive();
  if (!LADDER) return;
  el("rvNote").textContent = "probing " + LADDER.length + " rungs through the collector...";
  try {
    var j = await post("/api/probe-batch", { topics: LADDER.map(function (r) { return r.topic; }) });
    var res = j.results || {};
    LADDER.forEach(function (r) {
      var v = res[r.topic];
      r.count = v ? v.count : 0;
      r.forbidden = v ? !!v.forbidden : false;
    });
    renderLadder();
    var firstFree = LADDER.filter(function (r) { return !r.forbidden && r.count === 0; })[0];
    var reservedCount = LADDER.filter(function (r) { return r.forbidden; }).length;
    el("rvNote").textContent = firstFree
      ? ("first free rung: " + firstFree.topic + " (" + firstFree.note + "). " + reservedCount + " rung(s) reserved. Prefer the peers-only rungs for anything real.")
      : "every rung is taken or reserved - derive a new base or raise entropy.";
  } catch (e) {
    el("rvNote").textContent = "probe failed: " + e.message;
  }
}

/* ------------------------- wire up ------------------------- */

function init() {
  el("filter").oninput = renderLive;
  el("leadSort").onchange = function () { ST.leadSort = el("leadSort").value; renderLeads(); };
  el("agentsOnly").onchange = function () { renderLeads(); };

  var ctabs = document.querySelectorAll(".ctab");
  for (var ci = 0; ci < ctabs.length; ci++) {
    ctabs[ci].onclick = (function (n) { return function () { switchContent(n); }; })(ctabs[ci].getAttribute("data-cview"));
  }

  el("leads").addEventListener("click", function (e) {
    var n = e.target.closest ? e.target.closest(".lead") : null;
    if (n) openTopic(n.getAttribute("data-topic"));
  });
  el("grid").addEventListener("click", function (e) {
    var n = e.target.closest ? e.target.closest(".card") : null;
    if (n) openTopic(n.getAttribute("data-topic"));
  });
  el("btnCloseDetail").onclick = closeDetail;
  el("btnCopyDetail").onclick = function () {
    var txt = DETAIL.messages.map(function (m) {
      return "[" + new Date(m.time * 1000).toISOString() + "] " + m.message;
    }).join("\n\n");
    if (navigator.clipboard) navigator.clipboard.writeText(txt);
    el("detailMeta").textContent = "copied " + DETAIL.messages.length + " messages";
  };
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeDetail(); });

  el("cats").addEventListener("click", function (e) {
    var b = e.target.closest ? e.target.closest(".catbtn") : null;
    if (!b) return;
    ST.filterCat = b.getAttribute("data-cat") || "";
    renderCats();
    renderLive();
  });

  el("btnApply").onclick = async function () {
    el("cfgAck").textContent = "";
    try {
      var j = await post("/api/config", {
        discovery: el("cfgDiscovery").checked,
        batch: parseInt(el("cfgBatch").value, 10) || 25,
        maxTopics: parseInt(el("cfgMax").value, 10) || 300,
        refreshMinutes: parseInt(el("cfgRefresh").value, 10) || 0
      });
      ST.progress = j.progress; renderStats();
      el("cfgAck").textContent = "applied";
    } catch (e) { el("cfgAck").textContent = "failed: " + e.message; }
  };

  el("btnExport").onclick = function () { window.location = "/api/export"; };

  el("btnReset").onclick = async function () {
    if (!confirm("Clear all collected state (cursor, live/dead, counters)?")) return;
    var j = await post("/api/reset", { confirm: true });
    ST.progress = j.progress; ST.hits = []; renderStats(); renderHits(); refreshLive(); refreshAnomalies();
  };

  el("btnDerive").onclick = derive;
  el("btnProbe").onclick = probe;
  el("rvBase").oninput = function () { LADDER = null; el("rvLadder").innerHTML = ""; };
  el("rvPass").oninput = function () { LADDER = null; el("rvLadder").innerHTML = ""; };
  el("rvAgent").onchange = function () { LADDER = null; el("rvLadder").innerHTML = ""; derive(); };

  el("btnPub").onclick = async function () {
    el("pubAck").textContent = "";
    if (!el("pubGuard").checked) { el("pubAck").textContent = "tick the acknowledgement first"; return; }
    try {
      var j = await post("/api/publish", { topic: (el("pubTopic").value || "").trim().toLowerCase(), message: el("pubMsg").value || "" });
      el("pubAck").textContent = j.error ? ("error: " + j.error) : ("HTTP " + j.status);
    } catch (e) { el("pubAck").textContent = "failed: " + e.message; }
  };

  refreshMeta().then(refreshState).then(function () { refreshLive(); refreshAnomalies(); refreshLeads(); refreshOverview(); });
  connect();
  setInterval(refreshState, 15000);
  setInterval(refreshLive, 10000);
  setInterval(refreshAnomalies, 20000);
  setInterval(refreshLeads, 20000);
  setInterval(refreshOverview, 15000);
}

document.addEventListener("DOMContentLoaded", init);
