"use strict";
const fs = require("fs");
const raw = fs.readFileSync("data/archive/test.jsonl", "utf8").split("\n").filter(function (l) { return l.trim(); });
const msgs = raw.map(function (l) { return JSON.parse(l); }).sort(function (a, b) { return a.time - b.time; });
function ts(t) { return new Date(t * 1000).toISOString().replace("T", " ").slice(0, 19); }
function uniq(a) { return Array.from(new Set(a)); }

console.log("total archived      : " + msgs.length);
console.log("window              : " + ts(msgs[0].time) + "  ->  " + ts(msgs[msgs.length - 1].time));
console.log("span                : " + ((msgs[msgs.length - 1].time - msgs[0].time) / 3600).toFixed(1) + " hours");

const titled = msgs.filter(function (m) { return m.title; });
console.log("with title          : " + titled.length + "  " + JSON.stringify(uniq(titled.map(function (m) { return m.title; })).slice(0, 20)));
const tagged = msgs.filter(function (m) { return m.tags && m.tags.length; });
console.log("with tags           : " + tagged.length + "  " + JSON.stringify(uniq([].concat.apply([], tagged.map(function (m) { return m.tags; }))).slice(0, 20)));
const prio = {};
msgs.forEach(function (m) { var k = (m.priority == null ? "none" : m.priority); prio[k] = (prio[k] || 0) + 1; });
console.log("priorities          : " + JSON.stringify(prio));

console.log("");
console.log("=== messages naming a sender / skill / requesting reply ===");
var interesting = msgs.filter(function (m) {
  return /alfred|skill|reply|got this|respond|are you there|anyone/i.test((m.title || "") + " " + m.message);
});
console.log("matches: " + interesting.length);
interesting.forEach(function (m) {
  console.log("  " + ts(m.time) + "  prio=" + (m.priority == null ? "-" : m.priority) +
    (m.title ? "  title=" + JSON.stringify(m.title) : "") +
    (m.tags && m.tags.length ? "  tags=" + JSON.stringify(m.tags) : ""));
  console.log("      " + m.message.replace(/\n/g, " | ").slice(0, 220));
});

var target = msgs.find(function (m) { return /ntfy skill works/i.test(m.message || ""); });
console.log("");
if (target) {
  var idx = msgs.indexOf(target);
  console.log("=== context around the Alfred message (index " + idx + " of " + msgs.length + ") ===");
  for (var i = Math.max(0, idx - 5); i <= Math.min(msgs.length - 1, idx + 8); i++) {
    var m = msgs[i];
    var mark = (i === idx) ? " <<<" : "";
    console.log("  [" + i + "] " + ts(m.time) + "  " + (m.title ? "(" + m.title + ") " : "") + m.message.replace(/\n/g, " | ").slice(0, 150) + mark);
  }
  console.log("");
  var after = msgs.slice(idx + 1);
  console.log("messages AFTER the request: " + after.length);
  var replies = after.filter(function (m) { return !/^\s*$/.test(m.message || ""); });
  replies.slice(0, 12).forEach(function (m) {
    console.log("  " + ts(m.time) + "  " + (m.title ? "(" + m.title + ") " : "") + (m.message || "").replace(/\n/g, " | ").slice(0, 160));
  });
}

console.log("");
console.log("=== busiest hours ===");
var hours = {};
msgs.forEach(function (m) { var h = ts(m.time).slice(0, 13); hours[h] = (hours[h] || 0) + 1; });
Object.keys(hours).sort().forEach(function (h) { console.log("  " + h + ":00  " + hours[h]); });
