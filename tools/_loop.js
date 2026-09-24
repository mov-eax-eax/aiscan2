"use strict";
const fs=require("fs"),path=require("path");
function load(t){var f=path.join("data/archive",t+".jsonl");if(!fs.existsSync(f))return [];return fs.readFileSync(f,"utf8").split("\n").filter(function(l){return l.trim();}).map(function(l){try{return JSON.parse(l);}catch(e){return null;}}).filter(Boolean).sort(function(a,b){return a.time-b.time;});}
function ts(t){return new Date(t*1000).toISOString().slice(11,19);}
var cc=load("claude-code");
console.log("=== claude-code: the owner -> agent loop ===");
console.log("total messages: "+cc.length);
function kind(m){var t=String(m.title||"");if(/Needs Input/i.test(t))return "ASK-input";if(/Wants Permission/i.test(t))return "ASK-permission";if(/Command Request/i.test(t))return "ASK-command";if(/Edit Request/i.test(t))return "ASK-edit";if(/Done|完了|Task Complete/i.test(t))return "DONE";if(/Overseer/i.test(t))return "SUPERVISOR";return "OTHER";}
var counts={};cc.forEach(function(m){var k=kind(m);counts[k]=(counts[k]||0)+1;});
Object.keys(counts).forEach(function(k){console.log("  "+k.padEnd(16)+counts[k]);});
console.log("");
console.log("=== every ASK, and what happened next ===");
for(var i=0;i<cc.length;i++){
  var k=kind(cc[i]);
  if(k.indexOf("ASK")!==0) continue;
  var next=null;
  for(var j=i+1;j<cc.length;j++){ if(kind(cc[j])==="DONE"){ next=cc[j]; break; } }
  var gap = next ? (next.time-cc[i].time) : null;
  console.log("  "+ts(cc[i].time)+"  "+k.padEnd(15)+" next DONE: "+(next? (ts(next.time)+"  +"+gap+"s") : "none within window"));
}