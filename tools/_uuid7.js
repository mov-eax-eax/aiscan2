"use strict";
const fs=require("fs");
const msgs = fs.readFileSync("data/archive/codex.jsonl","utf8").split("\n").filter(function(l){return l.trim();}).map(function(l){return JSON.parse(l);}).sort(function(a,b){return a.time-b.time;});
function uuid7time(u){ var hex = u.replace(/-/g,"").slice(0,12); return parseInt(hex,16); }
function iso(ms){ return new Date(ms).toISOString().replace("T"," ").slice(5,19); }
function local(sec){ var d = new Date(sec*1000); var t = d.getTime() + 3*3600*1000; return new Date(t).toISOString().replace("T"," ").slice(5,19); }
console.log("=== UUIDv7 decode: does the ID timestamp match the reported time? ===");
var seen = {};
msgs.slice(0,8).forEach(function(m){
  var th = /Thread:\s*([0-9a-f-]+)/.exec(m.message);
  var tu = /Turn:\s*([0-9a-f-]+)/.exec(m.message);
  if(!th) return;
  var thms = uuid7time(th[1]);
  var tums = tu ? uuid7time(tu[1]) : 0;
  var lag = (m.time*1000) - thms;
  console.log("  thread created  " + iso(thms) + "Z");
  console.log("  turn   created  " + iso(tums) + "Z");
  console.log("  msg published   " + iso(m.time*1000) + "Z   (turn->publish lag " + Math.round(lag/1000) + "s)");
  console.log("  reported local  " + local(m.time) + " (+03:00)");
});
console.log("");
console.log("=== all 6 threads: exact creation + last turn ===");
var th = {};
msgs.forEach(function(m){
  var t = /Thread:\s*([0-9a-f-]+)/.exec(m.message); if(!t) return;
  var u = /Turn:\s*([0-9a-f-]+)/.exec(m.message);
  var k = t[1]; if(!th[k]) th[k] = { created: uuid7time(k), n:0, lastTurn:0, project:"?" };
  var pr = /Proje:\s*(\S+)/.exec(m.message); if(pr) th[k].project = pr[1];
  th[k].n++; if(u) th[k].lastTurn = Math.max(th[k].lastTurn, uuid7time(u[1]));
});
Object.keys(th).forEach(function(k){ var v = th[k];
  console.log("  " + v.project.padEnd(7) + " created " + iso(v.created) + "Z  last turn " + iso(v.lastTurn) + "Z  span " + Math.round((v.lastTurn-v.created)/60000) + "min  turns=" + v.n);
});