// qa.mjs — objective pixel QA of a rendered screenshot.
// usage: node qa.mjs <png> [label]
import { PNG } from 'pngjs';
import { readFileSync } from 'node:fs';

const file = process.argv[2];
const label = process.argv[3] || file;
const png = PNG.sync.read(readFileSync(file));
const { width: W, height: H, data } = png;

const lum = (x,y) => { const o=(y*W+x)*4; return (data[o]*0.2126+data[o+1]*0.7152+data[o+2]*0.0722)/255; };
const rgb = (x,y) => { const o=(y*W+x)*4; return [data[o],data[o+1],data[o+2]]; };

// mean colour of bands: top sky, middle, bottom ground
function bandStats(y0,y1,labelB){
  let r=0,g=0,b=0,n=0;
  for(let y=Math.floor(y0);y<y1;y+=3) for(let x=0;x<W;x+=6){ const c=rgb(x,y); r+=c[0];g+=c[1];b+=c[2];n++; }
  if(!n) return null;
  return { band:labelB, rgb:[Math.round(r/n),Math.round(g/n),Math.round(b/n)] };
}
// tower silhouette scan: in the central band, per row-bucket find first/last
// "dark structural" pixel; dark = luminance below 0.60 and not sky blue
function silhouette(){
  const rows=[];
  const x0=Math.round(W*0.18), x1=Math.round(W*0.82);
  for(let y=Math.round(H*0.06); y<Math.round(H*0.9); y+=Math.max(1,Math.round(H/90))){
    let first=-1, last=-1, count=0;
    for(let x=x0;x<x1;x+=2){
      const c=rgb(x,y);
      const L=(c[0]*0.2126+c[1]*0.7152+c[2]*0.0722)/255;
      // darkish structure against brighter sky/ground
      if(L<0.58 && (c[2] < c[0]+10 || c[1] < c[0]+30)){
        if(first<0) first=x;
        last=x; count++;
      }
    }
    if(first>=0) rows.push({ y, first, last, w:last-first, count });
  }
  return rows;
}
// find big flat color regions (possible black/white screen)
function extremeCheck(){
  let pureBlack=0, pureWhite=0, magenta=0;
  for(let y=0;y<H;y+=5) for(let x=0;x<W;x+=5){
    const c=rgb(x,y);
    if(c[0]<8&&c[1]<8&&c[2]<8) pureBlack++;
    if(c[0]>245&&c[1]>245&&c[2]>245) pureWhite++;
    if(c[0]>200&&c[1]<80&&c[2]>200) magenta++;
  }
  const total=(H/5)*(W/5);
  return { pureBlackPct:+(100*pureBlack/total).toFixed(1), pureWhitePct:+(100*pureWhite/total).toFixed(1), magentaPct:+(100*magenta/total).toFixed(1) };
}
const bands=[bandStats(0,H*0.12,'top-sky'), bandStats(H*0.35,H*0.55,'middle'), bandStats(H*0.85,H*1.0,'bottom-ground')];
const sil=silhouette();
// normalize silhouette widths vs maximum
const maxW=Math.max(...sil.map(r=>r.w),1);
const taper=sil.filter(r=>r.w>maxW*0.05).map(r=>({ y:+((r.y/H)*100).toFixed(1), wPct:+((100*r.w/maxW)).toFixed(1) }));
console.log('QA['+label+'] '+W+'x'+H);
console.log(' bands: '+JSON.stringify(bands));
console.log(' extremes: '+JSON.stringify(extremeCheck()));
// report coarse silhouette every ~7th sample
const step=Math.max(1,Math.floor(taper.length/14));
for(let i=0;i<taper.length;i+=step) console.log('  sil y%='+taper[i].y+' w%='+taper[i].wPct);
// simple heuristics
const issues=[];
if(bands[0] && bands[0].rgb[2]<bands[0].rgb[0]) issues.push('top band not blue-ish (r>b) — possible black/bad sky');
if(extremeCheck().pureBlackPct>40) issues.push('screen mostly black');
if(extremeCheck().pureWhitePct>40) issues.push('screen mostly white');
if(sil.length<10) issues.push('no tower silhouette detected in center band');
console.log(' issues: '+ (issues.length? issues.join(' | ') : 'none obvious'));
