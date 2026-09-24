"use strict";
/* The window is open NOW (a single request just returned 200). Spend it. */
const fs=require("fs");
const LIST = ["windsurf","windsurf-notifications","copilot","copilot-cli","continue","zed","aider","aider-notifications","cline","goose","gemini-cli","roo-code","kilo-code","amp","devin","replit","codeium","warp","augment","tabnine","sourcegraph","cody","bolt","lovable"];
async function poll(topics){
  const url="https://ntfy.sh/"+topics.join(",")+"/json?poll=1";
  const ctrl=new AbortController(); const timer=setTimeout(function(){ctrl.abort();},30000);
  try{ const res=await fetch(url,{headers:{"user-agent":"ntfy-probe/1.3"},signal:ctrl.signal}); clearTimeout(timer);
    const text=res.status===200?await res.text():""; return {status:res.status,text:text};
  }catch(e){ clearTimeout(timer); return {status:0,error:String(e.message),text:""}; }
}
(async function(){
  const r=await poll(LIST);
  console.log("harness-expand batch A -> HTTP "+r.status+(r.error?" "+r.error:""));
  if(r.status!==200) return;
  const by={};
  r.text.split("\n").forEach(function(l){ const s=l.trim(); if(!s) return; let m; try{m=JSON.parse(s);}catch(e){return;} if(!m.topic) return; (by[m.topic]=by[m.topic]||[]).push(m); });
  const occ=Object.keys(by);
  console.log("occupied: "+(occ.length?occ.join(","):"NONE"));
  Object.keys(by).forEach(function(t){ const m=by[t][by[t].length-1];
    console.log("  ## "+t+"  n="+by[t].length);
    console.log("     "+String(m.message).replace(/\n/g," | ").slice(0,240));
    if(m.title) console.log("     title="+m.title);
    if(m.tags) console.log("     tags="+(m.tags.join(",")));
  });
  const out=JSON.parse(fs.existsSync("data/probe-results.json")?fs.readFileSync("data/probe-results.json","utf8"):"{}");
  out["harness-expand-A"]=out["harness-expand-A"]||{};
  LIST.forEach(function(t){ const ms=by[t]||[]; out["harness-expand-A"][t]= ms.length? {count:ms.length, sample:String(ms[ms.length-1].message||"").slice(0,260)} : {count:0}; });
  fs.writeFileSync("data/probe-results.json", JSON.stringify(out,null,2));
  console.log("saved to probe-results.json");
})();