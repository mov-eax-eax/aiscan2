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
function grab(topic, re, label){ var s={}; all.forEach(function(m){ if(m._t!==topic) return; var hay=String(m.message||"")+" "+String(m.title||"")+" "+String(m.click||""); var x; var g=new RegExp(re.source,"gi"); while((x=g.exec(hay))) s[x[0]]=1; }); var k=Object.keys(s); return k.length? k : null; }
var topics=Array.from(new Set(all.map(function(m){return m._t;}))).sort();
console.log("=== EXPOSURE INVENTORY (what is actually readable) ===");
topics.forEach(function(t){
  var paths=grab(t, /\/(?:Users|home)\/[A-Za-z0-9._-]+(?:\/[A-Za-z0-9._-]+)*/, "path");
  var priv=grab(t, /\b(?:10|192\.168|172\.(?:1[6-9]|2[0-9]|3[01]))\.[0-9]{1,3}\.[0-9]{1,3}\b/, "ip");
  var dom=grab(t, /\b[a-z0-9-]+\.(?:uned\.es|vercel\.app|google\.com|integrations?\.[a-z]+|internal)\b/, "dom");
  var ip=grab(t, /\b[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\b/, "ip");
  var user=grab(t, /\/(?:Users|home)\/([A-Za-z0-9._-]+)/, "user");
  var bits=[];
  if(paths) bits.push("PATHS: "+paths.slice(0,4).join(" | "));
  if(user) bits.push("USERS: "+user.map(function(u){return u.split("/").pop();}).join(","));
  if(priv) bits.push("PRIVATE-IP: "+priv.join(","));
  if(bits.length){ console.log(""); console.log("## "+t); bits.forEach(function(b){ console.log("   "+b); }); }
});