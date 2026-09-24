"use strict";
const fs=require("fs");
const FIRST = ["windsurf","windsurf-notifications","copilot","copilot-cli","continue","zed","aider","aider-notifications","cline","goose","gemini-cli","roo-code","kilo-code","amp","devin","replit","codeium","warp","augment","tabnine","sourcegraph","cody","bolt","lovable"];
async function poll(topics){
  const url="https://ntfy.sh/"+topics.join(",")+"/json?poll=1";
  const ctrl=new AbortController(); const timer=setTimeout(function(){ctrl.abort();},30000);
  try{ const res=await fetch(url,{headers:{"user-agent":"ntfy-probe/1.4"},signal:ctrl.signal}); clearTimeout(timer);
    let body=""; try{ body=await res.text(); }catch(e){} return {status:res.status,body:body};
  }catch(e){ clearTimeout(timer); return {status:0,error:String(e.message),body:""}; }
}
function parse(text){ const by={}; text.split("\n").forEach(function(l){ const s=l.trim(); if(!s) return; let m; try{m=JSON.parse(s);}catch(e){return;} if(!m.topic) return; (by[m.topic]=by[m.topic]||[]).push(m); }); return by; }
const found={}; const occ={};
async function resolve(batch, depth){
  const r=await poll(batch);
  if(r.status===200){ const by=parse(r.body); batch.forEach(function(t){ const ms=by[t]||[]; found[t]=ms.length; }); return; }
  let code=""; try{ code=JSON.parse(r.body).code; }catch(e){}
  const line="  ".repeat(depth)+"["+r.status+(code?"/"+code:"")+"] n="+batch.length+" "+(batch.length<=4?batch.join(","):"");
  console.log(line);
  if(batch.length===1){ found[batch[0]]="RESERVED"; return; }
  const mid=Math.ceil(batch.length/2);
  await resolve(batch.slice(0,mid),depth+1);
  await new Promise(function(z){setTimeout(z,700);});
  await resolve(batch.slice(mid),depth+1);
}
(async function(){
  console.log("bisecting harness-expand for the poison topic...");
  await resolve(FIRST,0);
  console.log("");
  console.log("=== RESULT ===");
  Object.keys(found).sort().forEach(function(t){
    const v=found[t];
    const tag = (v==="RESERVED") ? "*** RESERVED ***" : (v>0 ? "OCCUPIED n="+v : "free");
    console.log("  "+t.padEnd(24)+tag);
  });
  const out=JSON.parse(fs.existsSync("data/probe-results.json")?fs.readFileSync("data/probe-results.json","utf8"):"{}");
  out["harness-expand-A"]=out["harness-expand-A"]||{};
  Object.keys(found).forEach(function(t){ if(found[t]==="RESERVED") out["harness-expand-A"][t]={reserved:true}; else out["harness-expand-A"][t]={count:found[t]}; });
  fs.writeFileSync("data/probe-results.json", JSON.stringify(out,null,2));
})();