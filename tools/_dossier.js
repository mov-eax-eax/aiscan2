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
function uniq(a){var o={};a.forEach(function(x){o[x]=1;});return Object.keys(o);}
function hay(m){ return String(m.message||"")+" "+String(m.title||"")+" "+String(m.click||""); }
function profile(topic){
  var ms=all.filter(function(m){return m._t===topic;});
  if(!ms.length) return null;
  var users=uniq(ms.map(hay).map(function(h){var x=/\/Users\/([A-Za-z0-9._-]+)/.exec(h);return x?x[1]:null;}).filter(Boolean));
  var projects=uniq(ms.map(hay).map(function(h){var x=/\/(?:Users\/[A-Za-z0-9._-]+|home\/[A-Za-z0-9._-]+)(?:\/[A-Za-z0-9._-]+)*\/([A-Za-z0-9._-]+)/.exec(h);return x?x[1]:null;}).filter(Boolean));
  var hosts=uniq(ms.map(hay).map(function(h){var x=/\b([a-z0-9-]+\.(?:ts\.net|es|cz|com|net|io|dev|app))(?::[0-9]+)?/i.exec(h);return x?x[1].toLowerCase():null;}).filter(Boolean));
  var tools=uniq(ms.map(hay).map(function(h){var x=/(opencode|codex|claude code|cursor|hermes|glitchtip|wazuh|airthings|grafana|claude|launchd|crashplan)/i.exec(h);return x?x[1].toLowerCase():null;}).filter(Boolean));
  var hours={};
  ms.forEach(function(m){ var h=new Date(m.time*1000).getUTCHours(); hours[h]=(hours[h]||0)+1; });
  var peak=Object.keys(hours).sort(function(a,b){return hours[b]-hours[a];})[0];
  return { topic:topic, n:ms.length, users:users, projects:projects, hosts:hosts, tools:tools, peakHourZ:peak, span: new Date(ms[0].time*1000).toISOString().slice(5,16)+" -> "+new Date(ms[ms.length-1].time*1000).toISOString().slice(5,16) };
}
var focus=["claude-code","codex","ai","alerts","cursor","test","myhome","notify"];
console.log("=== COMPOSED PROFILES: fragments that each pass a secret scanner ===");
focus.forEach(function(t){
  var p=profile(t); if(!p) return;
  console.log("");
  console.log("## " + p.topic + "   (" + p.n + " msgs, " + p.span + ")");
  if(p.users.length) console.log("   identity   : " + p.users.join(", "));
  if(p.projects.length) console.log("   projects    : " + p.projects.slice(0,6).join(", "));
  if(p.hosts.length) console.log("   infra       : " + p.hosts.slice(0,6).join(", "));
  if(p.tools.length) console.log("   tooling     : " + p.tools.join(", "));
  console.log("   peak hour   : " + p.peakHourZ + ":00Z");
});