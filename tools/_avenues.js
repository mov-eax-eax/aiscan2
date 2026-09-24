"use strict";
const fs = require("fs");
const dir = "data/archive";
const files = fs.readdirSync(dir).filter(function (f) { return f.slice(-6) === ".jsonl"; });
let all = [];
files.forEach(function (f) {
  fs.readFileSync(dir + "/" + f, "utf8").split("\n").forEach(function (l) {
    if (!l.trim()) return;
    try { all.push(JSON.parse(l)); } catch (e) {}
  });
});
console.log("messages analysed: " + all.length + " across " + files.length + " topics");

// A) ntfy topic names referenced INSIDE payloads -> existing topics, free to poll
var refs = {};
all.forEach(function (m) {
  var hay = String(m.click || "") + " " + String(m.message || "") + " " + JSON.stringify(m.actions || []);
  var re = /ntfy\.sh\/([a-z0-9][a-z0-9._-]{0,63})/gi, x;
  while ((x = re.exec(hay))) refs[x[1].toLowerCase()] = (refs[x[1].toLowerCase()] || 0) + 1;
});
console.log("\nA) ntfy topic names referenced in payloads: " + (Object.keys(refs).length ? JSON.stringify(refs) : "NONE"));

// B) custom URL schemes in click -> a directory of notifier apps
var sch = {};
all.forEach(function (m) {
  var s = /^([a-z][a-z0-9+.-]*):/i.exec(String(m.click || ""));
  if (s) sch[s[1]] = (sch[s[1]] || 0) + 1;
});
console.log("B) click schemes: " + JSON.stringify(sch));

// C) title prefixes -> a census of PRODUCERS, not topics
var pre = {};
all.forEach(function (m) {
  if (!m.title) return;
  var t = String(m.title);
  var p = /^\[[^\]]+\]/.exec(t) || /^●[^:]{0,20}:/.exec(t) || /^[A-Za-z0-9_.-]{2,20}\s+[-–]/.exec(t) || /^(WARNING|Task|Collector empty|Sentinel Alert|Airthings Alert|GlitchTip Alert|opencode|Codex|Back In Stock|Price Drop|Upgrade Available|D7)/i.exec(t);
  var k = p ? p[0].slice(0, 22).trim() : "(no prefix)";
  pre[k] = (pre[k] || 0) + 1;
});
console.log("C) title prefixes (producers):");
Object.keys(pre).sort(function (a, b) { return pre[b] - pre[a]; }).slice(0, 18).forEach(function (k) {
  console.log("     " + String(pre[k]).padStart(3) + "  " + k);
});

// D) action labels -> fingerprint of the tool that built the notification
var lab = {};
all.forEach(function (m) { (m.actions || []).forEach(function (a) { if (a && a.label) lab[a.label] = (lab[a.label] || 0) + 1; }); });
console.log("D) action labels: " + JSON.stringify(lab));

// E) outbound hosts -> directory of services people pipe into ntfy
var hosts = {};
all.forEach(function (m) {
  var hay = String(m.click || "") + " " + String(m.message || "");
  var re = /https?:\/\/([A-Za-z0-9.-]+)/g, x;
  while ((x = re.exec(hay))) hosts[x[1]] = (hosts[x[1]] || 0) + 1;
});
console.log("E) outbound hosts:");
Object.keys(hosts).sort(function (a, b) { return hosts[b] - hosts[a]; }).slice(0, 14).forEach(function (h) {
  console.log("     " + String(hosts[h]).padStart(3) + "  " + h);
});

// F) automation markers
var seq = all.filter(function (m) { return /"(sequence_id|seq|nonce|request_id)"/.test(m.message || ""); }).length;
var attach = all.filter(function (m) { return m.attachment; }).length;
console.log("F) automation markers: sequence/id fields=" + seq + "  attachments=" + attach);
