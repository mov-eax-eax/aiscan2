"use strict";
const fs=require("fs"),path=require("path");
const S=require("../src/signals.js");
const dir="data/archive";
var rows=[];
fs.readdirSync(dir).filter(function(f){return f.slice(-6)===".jsonl";}).forEach(function(f){
  var msgs=fs.readFileSync(path.join(dir,f),"utf8").split("\n").filter(function(l){return l.trim();}).map(function(l){try{return JSON.parse(l);}catch(e){return null;}}).filter(Boolean);
  rows.push({ topic:f.slice(0,-6), n:msgs.length, a:S.agent(msgs) });
});
rows.sort(function(a,b){return (b.a.work-a.a.work) || (b.a.score-a.a.score);});
console.log("topic".padEnd(24)+" n   score  work  isAgent  work-markers              presence-only");
console.log("-".repeat(112));
rows.forEach(function(r){
  var wm=r.a.workMarkers.join(",");
  var pm=r.a.markers.filter(function(m){return r.a.workMarkers.indexOf(m)<0;}).join(",");
  console.log("  "+r.topic.padEnd(22)+String(r.n).padStart(4)+String(r.a.score).padStart(7)+String(r.a.work).padStart(6)+String(r.a.isAgent).padStart(9)+"  "+wm.padEnd(25)+pm);
});
console.log("");
console.log("DEMOTED (was flagged before, no WORK evidence now):");
rows.filter(function(r){return !r.a.isAgent && r.a.score>0;}).forEach(function(r){ console.log("  "+r.topic.padEnd(16)+" score="+r.a.score+"  only: "+r.a.markers.join(",")); });