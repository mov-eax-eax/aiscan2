"use strict";
const fs=require("fs"), path=require("path");
const S=require("../src/signals.js");
const dir="data/archive";
const rows=[];
fs.readdirSync(dir).filter(function(f){return f.slice(-6)===".jsonl";}).forEach(function(f){
  const msgs=fs.readFileSync(path.join(dir,f),"utf8").split("\n").filter(function(l){return l.trim();})
    .map(function(l){try{return JSON.parse(l);}catch(e){return null;}}).filter(Boolean);
  rows.push({topic:f.slice(0,-6), a:S.agent(msgs)});
});
rows.sort(function(a,b){return b.a.score-a.a.score;});
console.log("\nAGENT SCORE across the real corpus:");
console.log("  topic        score  isAgent  markers");
console.log("  " + "-".repeat(88));
rows.forEach(function(r){
  console.log("  "+r.topic.padEnd(12)+String(r.a.score).padEnd(7)+String(r.a.isAgent).padEnd(9)+r.a.markers.join(","));
});
