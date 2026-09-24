"use strict";
const fs=require("fs"),path=require("path");
const dir="data/archive";
var all=[];
fs.readdirSync(dir).filter(function(f){return f.slice(-6)===".jsonl";}).forEach(function(f){
  var t=f.slice(0,-6);
  fs.readFileSync(path.join(dir,f),"utf8").split("\n").filter(function(l){return l.trim();}).forEach(function(l){
    try{ var m=JSON.parse(l); m._t=t; all.push(m);}catch(e){}
  });
});
function looksMachine(msg){
  var s=String(msg).trim();
  if(!s) return false;
  if(/^[\[{]/.test(s)){ try{ JSON.parse(s); return "valid JSON"; }catch(e){ return "truncated JSON"; } }
  if(/^[A-Z_]+=[^\s]+(?:\s+[A-Z_]+=.*)*$/.test(s)) return "key=value frame";
  if(/^\d+\|/.test(s)) return "framed (n|payload)";
  if(/^(GET|POST|PUT|DELETE|HEAD) \S+ HTTP/.test(s)) return "HTTP request line";
  if(/^(SSH|220 |EHLO|HELO|USER |PASS )/.test(s)) return "protocol greeting";
  if(/^\{[\s\S]*\}$/.test(s)) return "braced payload";
  return false;
}
var hits=[];
all.forEach(function(m){ var k=looksMachine(m.message); if(k) hits.push({t:m._t, kind:k, at:m.time, title:m.title, body:String(m.message).slice(0,200)}); });
hits.sort(function(a,b){return a.at-b.at;});
console.log("=== messages addressed to a MACHINE, not a human (" + hits.length + ") ===");
hits.forEach(function(h){
  var ts=new Date(h.at*1000).toISOString().replace("T"," ").slice(5,19);
  console.log("  [" + ts + "] " + h.t.padEnd(14) + " " + h.kind.padEnd(18) + (h.title? "title="+h.title.slice(0,24)+" " : "") + JSON.stringify(h.body.slice(0,110)));
});
console.log("");
var byTopic={}; hits.forEach(function(h){ byTopic[h.t]=(byTopic[h.t]||0)+1; });
console.log('by topic: ' + JSON.stringify(byTopic));