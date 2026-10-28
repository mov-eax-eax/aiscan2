import fs from 'node:fs';
const W=1600,H=1200;
const C={ B:'#efe6cc', K:'#1c1108', P:'#ff2a6d', G:'#a8c40c' };
let seed=4211;
function rnd(){ seed=(seed*1664525+1013904223)%4294967296; return seed/4294967296; }
function rr(a,b){ return a+(b-a)*rnd(); }
const n=(v)=>Math.round(v*100)/100;
const S=[]; const add=(s)=>S.push(s);
function path(d,a){ return '<path d="'+d+'"'+(a?' '+a:'')+'/>'; }
function rect(x,y,w,h,f,a){ return '<rect x="'+n(x)+'" y="'+n(y)+'" width="'+n(w)+'" height="'+n(h)+'" fill="'+(f||'none')+'"'+(a?' '+a:'')+'/>'; }
function poly(pts,a){ return path('M'+pts.map(p=>n(p[0])+','+n(p[1])).join(' L')+' Z',a); }
function seg(x1,y1,x2,y2,a){ return '<line x1="'+n(x1)+'" y1="'+n(y1)+'" x2="'+n(x2)+'" y2="'+n(y2)+'"'+(a?' '+a:'')+'/>'; }
function wob(x1,y1,x2,y2,amp,segs,a){
  const dx=x2-x1, dy=y2-y1, L=Math.hypot(dx,dy)||1; const nx=-dy/L, ny=dx/L; let d='';
  for(let i=0;i<=segs;i++){ const t=i/segs; const o=(i===0||i===segs)?rr(-amp*0.3,amp*0.3):rr(-amp,amp); d+=(i===0?'M':' L')+n(x1+dx*t+nx*o)+','+n(y1+dy*t+ny*o); }
  return path(d,a);
}

// ---------- canopy ----------
function leafD(len,wid){ return 'M0,0 C'+n(-wid)+','+n(-len*0.20)+' '+n(-wid*0.85)+','+n(-len*0.70)+' 0,'+n(-len)+' C'+n(wid*0.85)+','+n(-len*0.70)+' '+n(wid)+','+n(-len*0.20)+' 0,0 Z'; }
const leaves=[];
for(let c=0;c<40;c++){
  const cxp=rr(-90,1700), cyp=rr(-90,1290);
  const k=2+Math.floor(rr(0,3));
  for(let i=0;i<k;i++){ const len=rr(105,250), wid=len*rr(0.26,0.44);
    leaves.push({ x:cxp+rr(-120,120), y:cyp+rr(-100,100), len, wid, rot:-26+rr(-20,20), tone:rnd() }); }
}
function leafSVG(l, mode){
  const o='<g transform="translate('+n(l.x)+','+n(l.y)+') rotate('+n(l.rot)+')">';
  const fillC = C.G;
  let inner='<g transform="translate(-5,4)">'+path(leafD(l.len,l.wid),'fill="'+fillC+'"')+'</g>';
  inner+=path(leafD(l.len,l.wid),'fill="none" stroke="'+C.K+'" stroke-width="5"');
  inner+=seg(0,0,0,-l.len*0.9,'stroke="'+C.K+'" stroke-width="3"');
  for(let i=1;i<=3;i++){ const tt=i/4.2, y=-l.len*tt, sx=l.wid*Math.sin(Math.PI*tt)*0.74;
    inner+=seg(0,y,-sx,y-l.len*0.08,'stroke="'+C.K+'" stroke-width="2.6"');
    inner+=seg(0,y,sx,y-l.len*0.08,'stroke="'+C.K+'" stroke-width="2.6"'); }
  return o+inner+'</g>';
}

// ---------- city ----------
const blds=[]; let bx=-120;
while(bx<1760){ const w=rr(48,108); blds.push({x:bx,w,win:rnd()<0.7}); bx+=w+rr(16,44); }
function cityBars(ink, winInk, offFn, ang, sw){
  let o='';
  blds.forEach(function(b){
    const d=offFn(b.x), bw=b.w*sw;
    o+='<g transform="translate('+n(d[0])+','+n(d[1])+') rotate('+ang+' '+n(b.x+b.w/2)+' 600)">';
    o+=rect(b.x,-260,bw,1720,ink);
    const cols=Math.max(1,Math.floor(bw/40));
    for(let x2=0;x2<cols;x2++){
      for(let y=-250;y<1440;y+=56){
        if(rnd()<0.62) o+=rect(b.x+11+x2*(bw/cols), y, Math.max(8,bw/cols*0.42), 28, winInk);
      }
    }
    o+='</g>';
  });
  return o;
}
function cityMulls(ink, offFn, ang, w){
  let o='';
  blds.forEach(function(b){
    const d=offFn(b.x);
    o+='<g transform="translate('+n(d[0])+','+n(d[1])+') rotate('+ang+' '+n(b.x+b.w/2)+' 600)">';
    o+=rect(b.x-7,-260,w,1720,ink);
    o+='</g>';
  });
  return o;
}
const offP=(x)=>[6+4*Math.sin(x*0.0042+1),5+3*Math.cos(x*0.0031)];
const offK=()=>[0,0];

// ---------- the mask: animal / tower ----------
const M='M176,708 Q176,672 216,660 Q252,646 282,632 L296,628 L306,548 L350,632 L364,640 L374,636 L394,572 L430,642 Q464,648 488,660 L488,598 L562,598 L562,558 L662,558 L662,518 L782,518 L782,484 L902,484 L902,456 L1600,456 L1600,962 L1400,962 L1400,880 L1290,880 L1290,962 L1040,962 L1040,880 L930,880 L930,962 L680,962 L680,880 L570,880 L570,962 L300,962 L300,872 Q236,858 208,788 L176,758 Z';

add('<?xml version="1.0" encoding="UTF-8"?>');
add('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 '+W+' '+H+'" width="'+W+'" height="'+H+'">');
add('<defs>');
add('<filter id="grain" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">');
add('<feTurbulence type="fractalNoise" baseFrequency="0.82" numOctaves="3" seed="17" stitchTiles="stitch"/>');
add('<feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0.30 0.30 0.30 0 0"/>');
add('</filter>');
add('<clipPath id="mask"><path d="'+M+'"/></clipPath>');
add('<clipPath id="low"><rect x="0" y="792" width="1600" height="700"/></clipPath>');
add('<clipPath id="body"><rect x="472" y="0" width="1200" height="1200"/></clipPath>');
add('</defs>');
add(rect(0,0,W,H,C.B));

// 1. city plate (pink), pulled across the sheet
add(cityBars(C.P, C.B, offP, 9.5, 1));
add(cityMulls(C.K, offK, 9.5, 9));
// 2. jungle plate over the city
leaves.forEach(function(l,i){ add(leafSVG(l,'pos')); });
for(let i=0;i<10;i++){ const x=rr(-40,1640), y=rr(-40,1240); let d='M'+n(x)+','+n(y); let px=x,py=y;
  for(let k=0;k<3;k++){ px+=rr(-20,150); py+=rr(-120,120); d+=' Q'+n(px+rr(-60,60))+','+n(py+rr(-60,60))+' '+n(px)+','+n(py); }
  add(path(d,'fill="none" stroke="'+C.K+'" stroke-width="4" opacity="0.9" stroke-linecap="round"')); }
// 3. mask: black mass, then the two images again INSIDE it in the other phase
add('<g transform="translate(13,10)"><path d="'+M+'" fill="'+C.P+'"/></g>');
add('<g clip-path="url(#mask)">');
add(rect(0,0,W,H,C.K));
// jungle inside: solid green masses, body only - the head stays a black mass
add('<g clip-path="url(#body)"><g transform="translate(24,-14)">');
leaves.forEach(function(l,i){ if(i%2===0) add(leafSVG(l,'neg')); });
add('</g></g>');
// the beast's belly is the city in negative, the head and back stay black
add('<g clip-path="url(#low)">');
add('<g transform="translate(-52,26) rotate(4 800 600)">');
add(cityBars(C.B, C.K, (x)=>[0,0], 9.5, 0.30));
add('</g>');
add('<g transform="translate(10,-7)">');
add(cityMulls(C.P, (x)=>[0,0], 9.5, 5));
add('</g>');
add('</g>');
add('</g>');

add(rect(0,0,W,H,'#000','filter="url(#grain)" opacity="0.13"'));
add('</svg>');
fs.writeFileSync(process.argv[2]||'ciudad-selva.svg',S.join('\n'));
console.log('wrote',(S.join('\n').length/1024).toFixed(1)+'KB');