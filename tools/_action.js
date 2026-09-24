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
function redact(s){ if(s.length<=10) return s.slice(0,3)+"*".repeat(Math.max(0,s.length-3)); return s.slice(0,6)+"..."+"["+s.length+" chars]"; }
var PATTERNS = [
  ["vendor-key",     /\b(sk-[A-Za-z0-9_-]{20,}|gh[pousr]_[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16}|xox[baprs]-[A-Za-z0-9-]{10,})\b/g],
  ["private-key",    /-----BEGIN [A-Z ]*PRIVATE KEY-----/g],
  ["webhook-url",    /https?:\/\/(?:hooks\.slack\.com|discord(?:app)?\.com\/api\/webhooks|outlook\.office\.com\/webhook|api\.telegram\.org\/bot)[^\s")\]}]{4,}/g],
  ["telegram-bot",   /bot[0-9]{6,}:[A-Za-z0-9_-]{30,}/g],
  ["cred-url",       /[a-z][a-z0-9+.-]*:\/\/[^\s:/@]{3,}:[^\s:/@]{3,}@[^\s")\]}]+/gi],
  ["token-param",    /[?&](?:token|access_token|api_key|apikey|key|secret|auth|password|pwd)=[^&\s")\]}]{6,}/gi],
  ["bearer",         /Bearer\s+[A-Za-z0-9\-._~+\/]{20,}/g],
  ["password-field", /"(?:password|passwd|secret|api_?key|access_token|refresh_token)"\s*:\s*"[^"]{6,}"/gi],
  ["ipv4-port",      /\b(?:10|192\.168|172\.(?:1[6-9]|2[0-9]|3[01]))\.[0-9]{1,3}\.[0-9]{1,3}(?::[0-9]{2,5})?\b/g],
  ["domain-port",    /\b[a-z0-9.-]+\.(?:es|cz|com|net|io|dev|app|local|internal)(?::[0-9]{2,5})\b/g]
];
var findings=[];
all.forEach(function(m){
  var hay = String(m.message||"") + " " + String(m.title||"") + " " + String(m.click||"");
  PATTERNS.forEach(function(p){
    var g=new RegExp(p[1].source,"gi"); var x;
    while((x=g.exec(hay))){ findings.push({ topic:m._t, kind:p[0], val:x[0], at:m.time }); }
  });
});
var byKind={};
findings.forEach(function(f){ if(!byKind[f.kind]) byKind[f.kind]=[]; byKind[f.kind].push(f); });
console.log("=== ACTIONABLE FINDINGS (values redacted on purpose) ===");
Object.keys(byKind).forEach(function(k){
  console.log("");
  console.log("## " + k + "  (" + byKind[k].length + ")");
  var seen={};
  byKind[k].forEach(function(f){
    var key=f.kind+"|"+f.val; if(seen[key]) return; seen[key]=1;
    console.log("   " + f.topic.padEnd(14) + redact(f.val));
  });
});
console.log("");
console.log("=== the alerts word-string (possible mnemonic) ===");
var alerts=all.filter(function(m){return m._t==="alerts" && /^[a-z]+( [a-z]+){7,}$/.test(String(m.message).trim());});
alerts.forEach(function(m){ var w=String(m.message).trim().split(/\s+/); console.log("   words=" + w.length + "  all lowercase-alpha=" + w.every(function(x){return /^[a-z]{3,9}$/.test(x);}) + "  first=" + w[0] + " last=" + w[w.length-1]); });