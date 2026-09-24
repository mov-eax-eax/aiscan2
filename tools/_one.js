"use strict";
const t=process.argv[2];
(async function(){
  const res=await fetch("https://ntfy.sh/"+t+"/json?poll=1",{headers:{"user-agent":"ntfy-probe/1.4"}});
  const body=await res.text();
  console.log("status:",res.status);
  console.log("body:",body.slice(0,600));
})();