"use strict";
const fs = require("fs"), path = require("path");
function load(t){ var f = path.join("data/archive", t + ".jsonl"); if(!fs.existsSync(f)) return []; return fs.readFileSync(f,"utf8").split("\n").filter(function(l){return l.trim();}).map(function(l){ try{return JSON.parse(l);}catch(e){return null;} }).filter(Boolean).sort(function(a,b){return a.time-b.time;}); }
function ts(t){ return new Date(t*1000).toISOString().replace("T"," ").slice(5,19); }
var cx = load("codex");
var threads = {}; var turnSet = {};
cx.forEach(function(m){
  var th = /Thread:\s*([0-9a-f-]+)/.exec(m.message);
  var tu = /Turn:\s*([0-9a-f-]+)/.exec(m.message);
  var pr = /Proje:\s*(\S+)/.exec(m.message);
  if(th){ var k = th[1]; if(!threads[k]) threads[k] = { n:0, first:m.time, last:m.time, project: pr?pr[1]:"?" }; threads[k].n++; threads[k].last = m.time; }
  if(tu) turnSet[tu[1]] = 1;
});
console.log("=== CODEX sessions ===");
console.log("  messages=" + cx.length + "  distinct threads=" + Object.keys(threads).length + "  distinct turns=" + Object.keys(turnSet).length);
console.log("  span " + ts(cx[0].time) + " -> " + ts(cx[cx.length-1].time));
Object.keys(threads).forEach(function(k){ var v = threads[k]; var mins = Math.round((v.last - v.first)/60); console.log("    thread " + k.slice(0,18) + "  project=" + v.project + "  turns=" + v.n + "  session=" + mins + "min"); });
console.log("");
console.log("=== CLAUDE-CODE contributors ===");
var cc = load("claude-code");
var titles = {};
cc.forEach(function(m){ var k = m.title || "(no title)"; titles[k] = (titles[k]||0) + 1; });
Object.keys(titles).sort(function(a,b){ return titles[b]-titles[a]; }).forEach(function(k){ console.log("  " + String(titles[k]).padStart(4) + "x  " + k.slice(0,60)); });
var paths = {}; cc.forEach(function(m){ var p = /\/Users\/[A-Za-z0-9._-]+/.exec(m.message); if(p) paths[p[0]] = 1; });
console.log("  usernames leaked: " + JSON.stringify(Object.keys(paths)));
console.log("  span " + ts(cc[0].time) + " -> " + ts(cc[cc.length-1].time));
var gaps = []; for(var i=1;i<cc.length;i++) gaps.push(cc[i].time - cc[i-1].time);
gaps.sort(function(a,b){return a-b;});
console.log("  median gap between completions: " + gaps[Math.floor(gaps.length/2)] + "s");
console.log("");
console.log("=== CURSOR ===");
var cu = load("cursor");
var distinct = {}; cu.forEach(function(m){ distinct[m.message] = 1; });
console.log("  messages=" + cu.length + " distinct=" + Object.keys(distinct).length + "  span " + ts(cu[0].time) + " -> " + ts(cu[cu.length-1].time));