"use strict";
const fs=require("fs");
function load(t){var f="data/archive/"+t+".jsonl";if(!fs.existsSync(f))return [];return fs.readFileSync(f,"utf8").split("\n").filter(function(l){return l.trim();}).map(function(l){return JSON.parse(l);}).sort(function(a,b){return a.time-b.time;});}
function iso(ms){return new Date(ms).toISOString().replace("T"," ").slice(5,19);}
function u7(u){return parseInt(u.replace(/-/g,"").slice(0,12),16);}
console.log("=== CODEX: agent duration vs human think-time, per thread ===");
var cx=load("codex"); var th={};
cx.forEach(function(m){
  var t=/Thread:\s*([0-9a-f-]+)/.exec(m.message); var u=/Turn:\s*([0-9a-f-]+)/.exec(m.message);
  if(!t) return; var k=t[1];
  if(!th[k]) th[k]={ turns:[], project:"?" };
  var pr=/Proje:\s*(\S+)/.exec(m.message); if(pr) th[k].project=pr[1];
  if(u) th[k].turns.push({ start:u7(u[1]), done:m.time*1000 });
});
Object.keys(th).forEach(function(k){
  var v=th[k]; if(v.turns.length<2) return;
  v.turns.sort(function(a,b){return a.start-b.start;});
  var agent=0, human=0;
  for(var i=0;i<v.turns.length;i++){
    agent += (v.turns[i].done - v.turns[i].start);
    if(i>0) human += (v.turns[i].start - v.turns[i-1].done);
  }
  var n=v.turns.length;
  console.log("  " + v.project.padEnd(7) + " turns=" + n + "  agent_total=" + Math.round(agent/1000) + "s  human_total=" + Math.round(human/1000) + "s  ratio=" + (human/Math.max(1,agent)).toFixed(1) + "x");
  var durs = v.turns.map(function(t){return Math.round((t.done-t.start)/1000);});
  console.log("        turn durations(s): " + durs.join(", "));
});
console.log("");
console.log("=== CLAUDE-CODE: attention timeline (asks resolved per hour) ===");
var cc=load("claude-code");
function kind(m){var t=String(m.title||"");if(/Needs Input|Wants Permission|Command Request|Edit Request/i.test(t))return "ASK";if(/Done|完了|Task Complete/i.test(t))return "DONE";return "OTHER";}
var asks=[]; cc.forEach(function(m){ if(kind(m)==="ASK") asks.push(m); });
var byHour={}; var rts=[];
asks.forEach(function(a){
  var nxt=null; for(var j=cc.indexOf(a)+1;j<cc.length;j++){ if(kind(cc[j])==="DONE"){ nxt=cc[j]; break; } }
  if(!nxt) return;
  var rt=nxt.time-a.time; rts.push(rt);
  var h=new Date(a.time*1000).toISOString().slice(11,13);
  if(!byHour[h]) byHour[h]=[]; byHour[h].push(rt);
});
rts.sort(function(a,b){return a-b;});
console.log("  asks=" + asks.length + "  response times median=" + rts[Math.floor(rts.length/2)] + "s  min=" + rts[0] + "s  max=" + rts[rts.length-1] + "s");
Object.keys(byHour).sort().forEach(function(h){
  var a=byHour[h].sort(function(x,y){return x-y;});
  console.log("    " + h + ":00Z  asks=" + String(a.length).padStart(2) + "  median_rt=" + String(a[Math.floor(a.length/2)]).padStart(5) + "s");
});
console.log("");
console.log("=== CURSOR: session boundaries from the heartbeat ===");
var cu=load("cursor"); var gaps=[];
for(var i=1;i<cu.length;i++) gaps.push({ g:cu[i].time-cu[i-1].time, at:cu[i-1].time });
console.log("  heartbeats=" + cu.length + "  span " + iso(cu[0].time*1000) + " -> " + iso(cu[cu.length-1].time*1000));
var breaks = gaps.filter(function(x){return x.g>=1800;});
console.log("  gaps >= 30min (sessions): " + breaks.length);
breaks.forEach(function(b){ console.log("    " + iso(b.at*1000) + " -> break of " + Math.round(b.g/60) + " min"); });