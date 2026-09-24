"use strict";
const fs=require("fs"), path=require("path");
const S=require("../src/signals.js");
const dir="data/archive";
const rows=[];
fs.readdirSync(dir).filter(function(f){return f.slice(-6)===".jsonl";}).forEach(function(f){
  const msgs=fs.readFileSync(path.join(dir,f),"utf8").split("\n").filter(function(l){return l.trim();})
    .map(function(l){try{return JSON.parse(l);}catch(e){return null;}}).filter(Boolean);
  rows.push({topic:f.slice(0,-6), n:msgs.length, c:S.conversation(msgs)});
});
rows.sort(function(a,b){return b.c.score-a.c.score;});
console.log("topic        n    humans  turns  window   score  markers");
console.log("-".repeat(92));
rows.forEach(function(r){
  const w = r.c.windowSec==null?"-":(r.c.windowSec>=60?(Math.round(r.c.windowSec/60)+"m"):(r.c.windowSec+"s"));
  console.log("  "+r.topic.padEnd(11)+String(r.n).padStart(4)+String(r.c.humans).padStart(8)+String(r.c.bestCount).padStart(7)+String(w).padStart(8)+String(r.c.score).padStart(7)+"  "+r.c.markers.join(","));
});
console.log("\nCONVERSATIONS (score >= 0.5):");
rows.filter(function(r){return r.c.score>=0.5;}).forEach(function(r){
  console.log("\n  ["+r.topic+"] score="+r.c.score);
  r.c.samples.forEach(function(s){ console.log("      "+JSON.stringify(s)); });
});
