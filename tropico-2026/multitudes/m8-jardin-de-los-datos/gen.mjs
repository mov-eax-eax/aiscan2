import fs from 'node:fs';
const W=1600,H=1200;
const C={ sky:'#cdd8cc', sky2:'#e3e6cf', ground:'#c9c39a', ground2:'#b7b087', cream:'#ede2c6', pink:'#d8a8a0', green:'#a9c4b8', russet:'#9a5a3c', grey:'#8a8f88', grey2:'#6f756f', screen:'#7aa8c8', ink:'#3b2a20', flesh:'#e0c3a8' };
let seed=9021;
function rnd(){ seed=(seed*1664525+1013904223)%4294967296; return seed/4294967296; }
function rr(a,b){ return a+(b-a)*rnd(); }
const n=(v)=>Math.round(v*100)/100;
const S=[]; const add=(s)=>S.push(s);
function P(d,a){ return '<path d="'+d+'"'+(a?' '+a:'')+'/>'; }
function rect(x,y,w,h,f,a){ return '<rect x="'+n(x)+'" y="'+n(y)+'" width="'+n(w)+'" height="'+n(h)+'" fill="'+(f||'none')+'"'+(a?' '+a:'')+'/>'; }
function circ(cx,cy,r,f,a){ return '<circle cx="'+n(cx)+'" cy="'+n(cy)+'" r="'+n(r)+'" fill="'+(f||'none')+'"'+(a?' '+a:'')+'/>'; }
function ell(cx,cy,rx,ry,f,a,rot){ return '<ellipse cx="'+n(cx)+'" cy="'+n(cy)+'" rx="'+n(rx)+'" ry="'+n(ry)+'" fill="'+(f||'none')+'"'+(rot?' transform="rotate('+n(rot)+' '+n(cx)+' '+n(cy)+')"':'')+(a?' '+a:'')+'/>'; }
function L(x1,y1,x2,y2,a){ return '<line x1="'+n(x1)+'" y1="'+n(y1)+'" x2="'+n(x2)+'" y2="'+n(y2)+'"'+(a?' '+a:'')+'/>'; }
function poly(pts,f,a){ return P('M'+pts.map(p=>n(p[0])+','+n(p[1])).join(' L')+' Z',(f?'fill="'+f+'" ':'')+(a||'')); }
// ---------- people ----------
function person(x,y,h,o){
  o=o||{}; const coat=o.coat||C.russet, skin=C.flesh, head=h*0.11; let s='';
  s+=P('M'+n(x-h*0.1)+','+n(y)+' L'+n(x-h*0.06)+','+n(y-h*0.42)+' M'+n(x+h*0.1)+','+n(y)+' L'+n(x+h*0.06)+','+n(y-h*0.42),'stroke="'+C.grey2+'" stroke-width="'+n(h*0.07)+'"');
  s+=poly([[x-h*0.19,y-h*0.4],[x-h*0.13,y-h*0.78],[x+h*0.13,y-h*0.78],[x+h*0.2,y-h*0.36],[x+h*0.08,y-h*0.32],[x-h*0.1,y-h*0.32]],coat,'stroke="'+C.ink+'" stroke-width="1.3"');
  const arm=o.arm||'down';
  if(arm==='down'){ s+=P('M'+n(x-h*0.17)+','+n(y-h*0.7)+' L'+n(x-h*0.24)+','+n(y-h*0.42)+' M'+n(x+h*0.17)+','+n(y-h*0.7)+' L'+n(x+h*0.24)+','+n(y-h*0.42),'stroke="'+coat+'" stroke-width="'+n(h*0.06)+'"'); }
  if(arm==='up'){ s+=P('M'+n(x-h*0.17)+','+n(y-h*0.7)+' L'+n(x-h*0.3)+','+n(y-h*0.95)+' M'+n(x+h*0.17)+','+n(y-h*0.7)+' L'+n(x+h*0.3)+','+n(y-h*0.98),'stroke="'+coat+'" stroke-width="'+n(h*0.06)+'"'); }
  if(arm==='front'){ s+=P('M'+n(x-h*0.17)+','+n(y-h*0.7)+' L'+n(x-h*0.3)+','+n(y-h*0.55)+' M'+n(x+h*0.17)+','+n(y-h*0.7)+' L'+n(x+h*0.26)+','+n(y-h*0.52),'stroke="'+coat+'" stroke-width="'+n(h*0.06)+'"'); }
  s+=circ(x,y-h*0.86,head,skin,'stroke="'+C.ink+'" stroke-width="1.2"');
  s+=P('M'+n(x-head)+','+n(y-h*0.86-head*0.4)+' q'+n(head)+',-'+n(head*0.9)+' '+n(head*2)+',0 Z','fill="'+(o.hat||C.cream)+'" stroke="'+C.ink+'" stroke-width="1.1"');
  if(o.screen){ s+=rect(x+h*0.2,y-h*0.92,h*0.22,h*0.2,C.screen,'stroke="'+C.ink+'" stroke-width="1.2"'); }
  return s;
}
function naked(x,y,h,pose){
  let s='';
  s+=circ(x,y-h*0.85,h*0.12,C.flesh,'stroke="'+C.ink+'" stroke-width="1.1"');
  s+=ell(x,y-h*0.62,h*0.11,h*0.2,C.flesh,'stroke="'+C.ink+'" stroke-width="1.1"');
  if(pose===0){ s+=P('M'+n(x-h*0.1)+','+n(y-h*0.42)+' L'+n(x-h*0.22)+','+n(y-h*0.1)+' M'+n(x+h*0.1)+','+n(y-h*0.42)+' L'+n(x+h*0.24)+','+n(y-h*0.06),'stroke="'+C.flesh+'" stroke-width="'+n(h*0.07)+'"'); s+=P('M'+n(x-h*0.16)+','+n(y-h*0.72)+' L'+n(x-h*0.36)+','+n(y-h*0.86)+' M'+n(x+h*0.16)+','+n(y-h*0.72)+' L'+n(x+h*0.38)+','+n(y-h*0.9),'stroke="'+C.flesh+'" stroke-width="'+n(h*0.06)+'"'); }
  if(pose===1){ s+=P('M'+n(x-1)+','+n(y-h*0.42)+' L'+n(x-h*0.02)+','+n(y-h*0.1)+' M'+n(x+h*0.04)+','+n(y-h*0.42)+' L'+n(x+h*0.1)+','+n(y-h*0.06),'stroke="'+C.flesh+'" stroke-width="'+n(h*0.07)+'"'); s+=P('M'+n(x-h*0.14)+','+n(y-h*0.74)+' L'+n(x-h*0.05)+','+n(y-h*1.05)+' M'+n(x+h*0.14)+','+n(y-h*0.74)+' L'+n(x+h*0.24)+','+n(y-h*1.02),'stroke="'+C.flesh+'" stroke-width="'+n(h*0.06)+'"'); }
  if(pose===2){ s+=P('M'+n(x-h*0.12)+','+n(y-h*0.44)+' L'+n(x-h*0.3)+','+n(y-h*0.3)+' M'+n(x+h*0.12)+','+n(y-h*0.44)+' L'+n(x+h*0.3)+','+n(y-h*0.34),'stroke="'+C.flesh+'" stroke-width="'+n(h*0.065)+'"'); s+=P('M'+n(x-h*0.14)+','+n(y-h*0.72)+' L'+n(x-h*0.24)+','+n(y-h*0.98)+' M'+n(x+h*0.14)+','+n(y-h*0.72)+' L'+n(x+h*0.2)+','+n(y-h*1.0),'stroke="'+C.flesh+'" stroke-width="'+n(h*0.055)+'"'); }
  return s;
}
function rack(x,y,w,h,leafy){
  let s=rect(x,y-h,w,h,C.grey,'stroke="'+C.ink+'" stroke-width="1.5"');
  const rows=Math.max(3,Math.round(h/26));
  for(let r=0;r<rows;r++){ const yy=y-h+8+r*(h-12)/rows; s+=rect(x+6,yy,w-12,6,C.grey2); for(let c=0;c<3;c++){ s+=circ(x+10+c*((w-20)/2),yy+3,2.2, r%2? C.green:C.pink); } }
  if(leafy){ for(let i=0;i<5;i++){ const lx=x+rr(0,w); s+=ell(lx,y-h-4,6,10,C.green,'stroke="'+C.ink+'" stroke-width="1"'); } }
  return s;
}
function router(x,y,s,depth){
  let o=rect(x-14,y-8,28,10,C.grey,'stroke="'+C.ink+'" stroke-width="1.3"');
  for(let i=0;i<3;i++){ o+=circ(x-8+i*8,y-3,1.8,C.green); }
  o+=P('M'+n(x)+','+n(y-8)+' L'+n(x)+','+n(y-8-s*0.5),'stroke="'+C.ink+'" stroke-width="1.4"');
  return o;
}
function tree(x,y,h){
  let s=P('M'+n(x)+','+n(y)+' q'+n(-4)+',-'+n(h*0.4)+' 0,-'+n(h*0.62)+' M'+n(x)+','+n(y-h*0.3)+' q'+n(h*0.1)+',-'+n(h*0.1)+' '+n(h*0.16)+',-'+n(h*0.14),'stroke="'+C.ink+'" stroke-width="'+n(h*0.05)+'" fill="none"');
  s+=ell(x,y-h*0.74,h*0.34,h*0.24,C.green,'stroke="'+C.ink+'" stroke-width="1.4"');
  s+=ell(x-h*0.2,y-h*0.62,h*0.18,h*0.13,C.green,'stroke="'+C.ink+'" stroke-width="1.2"');
  s+=ell(x+h*0.22,y-h*0.66,h*0.16,h*0.12,C.green,'stroke="'+C.ink+'" stroke-width="1.2"');
  return s;
}
add('<?xml version="1.0" encoding="UTF-8"?>');
add('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 '+W+' '+H+'" width="'+W+'" height="'+H+'">');
add('<defs>');
add('<filter id="grain" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">');
add('<feTurbulence type="fractalNoise" baseFrequency="0.82" numOctaves="3" seed="51" stitchTiles="stitch"/>');
add('<feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0.28 0.28 0.28 0 0"/>');
add('</filter>');
add('</defs>');
add(rect(0,0,W,H,C.sky));
add(rect(0,0,W,120,C.sky2));
for(let i=0;i<10;i++){ add(ell(rr(0,W),rr(20,150),rr(70,160),rr(14,22),C.cream,'opacity="0.6"')); }
add(P('M0,246 Q260,150 560,206 Q900,276 1200,176 Q1400,120 1600,186 L1600,300 L0,300 Z','fill="'+C.green+'" opacity="0.85"'));
for(let i=0;i<9;i++){ const x=60+i*180, w=rr(60,120), h=rr(40,86); add(rect(x,240-h,w,h,C.grey2,'opacity="0.55"')); add(rect(x+w*0.3,240-h-14,w*0.4,14,C.grey2,'opacity="0.55"')); }
for(let i=0;i<26;i++){ const x=rr(0,1600); add(circ(x,rr(250,290),rr(18,34),i%2?C.green:'#8fae86','opacity="0.9"')); }
add(P('M0,300 Q260,190 560,250 Q900,320 1200,220 Q1400,160 1600,230 L1600,340 L0,340 Z','fill="'+C.green+'" opacity="0.75"'));
add(P('M0,340 Q400,300 800,330 Q1200,360 1600,320 L1600,420 L0,420 Z','fill="'+C.ground2+'"'));
add(rect(0,400,W,800,C.ground));
// beds: 3 x 2 grid of beds with paths
const beds=[[80,470,420,300],[520,470,420,300],[960,470,560,300],[80,810,420,320],[520,810,420,320],[960,810,560,320]];
for(let i=0;i<6;i++){ const b=beds[i];
  add(rect(b[0],b[1],b[2],b[3],'#b9b184','stroke="'+C.ink+'" stroke-width="1.6"'));
  for(let r=0;r<Math.floor(b[3]/26);r++){ add(L(b[0]+10,b[1]+18+r*26,b[0]+b[2]-10,b[1]+18+r*26,'stroke="'+C.russet+'" stroke-width="1" opacity="0.28"')); }
  for(let g=0;g<14;g++){ const gx=b[0]+rr(14,b[2]-14), gy=b[1]+rr(14,b[3]-14); add(circ(gx,gy,rr(1.6,3.2),g%3?C.green:C.pink,'opacity="0.85"')); }
  add(rect(b[0]+6,b[1]+6,b[2]-12,b[3]-12,'none','stroke="'+C.green+'" stroke-width="6" opacity="0.55"'));
  add(rect(b[0],b[1],b[2],b[3],'none','stroke="'+C.ink+'" stroke-width="1.6"'));
}
// bed 1: rack hedge
for(let i=0;i<4;i++){ add(rack(110+i*100,760,70,150,true)); }
add(person(180,770,90,{coat:C.russet,arm:'front',hat:C.cream}));
add(person(390,770,86,{coat:C.green,arm:'up',hat:C.pink}));
add(person(300,772,84,{coat:C.pink,arm:'down',hat:C.cream}));
// watering can + stream
add(rect(392,748,22,14,C.grey2,'stroke="'+C.ink+'" stroke-width="1.2"')); add(P('M414,752 q16,-6 22,10','stroke="'+C.screen+'" stroke-width="3" fill="none"'));
// bed 2: root machines
add(rect(560,720,90,80,C.grey,'stroke="'+C.ink+'" stroke-width="1.6"'));
for(let i=0;i<5;i++){ add(P('M'+n(570+i*18)+','+n(800)+' q'+n(rr(-16,16))+',40 '+n(rr(-24,24))+',70','stroke="'+C.russet+'" stroke-width="5" fill="none"')); }
add(rect(586,700,38,20,C.grey2)); add(circ(605,700,7,C.pink));
add(person(700,800,90,{coat:C.russet,arm:'up'}));
add(person(760,800,88,{coat:C.grey,arm:'front'}));
// bed 3: cable fountain
add(ell(740,1120,120,26,C.grey2,'stroke="'+C.ink+'" stroke-width="1.4"'));
add(rect(724,1000,32,120,C.grey,'stroke="'+C.ink+'" stroke-width="1.4"'));
for(let i=0;i<9;i++){ const a=-2.6+i*0.32; add(P('M740,1000 q'+n(Math.cos(a)*90)+',-'+n(60+Math.abs(Math.sin(i))*70)+' '+n(Math.cos(a)*150)+','+n(rr(40,90)),'stroke="'+(i%2?C.screen:C.pink)+'" stroke-width="4" fill="none"')); }
add(person(650,1030,88,{coat:C.pink,arm:'up'})); add(person(830,1030,86,{coat:C.green,arm:'up'}));
// bed 4: monitor pavilion
add(rect(1000,1000,420,16,C.cream,'stroke="'+C.ink+'" stroke-width="1.4"'));
for(let i=0;i<4;i++){ const x=1020+i*100; add(rect(x,760,16,240,C.cream,'stroke="'+C.ink+'" stroke-width="1.4"')); }
add(rect(1000,740,420,22,C.russet,'stroke="'+C.ink+'" stroke-width="1.4"'));
for(let i=0;i<5;i++){ add(rect(1020+i*78,780,62,46,C.screen,'stroke="'+C.ink+'" stroke-width="1.3"')); add(rect(1026+i*78,786,50,32,C.grey2)); }
for(let i=0;i<5;i++){ add(person(1040+i*80,1000,90,{coat:i%2?C.green:C.pink,arm:i%2?'up':'front'})); }
// bed 5: router tree
add(tree(700,780,300));
for(let i=0;i<6;i++){ const a=rr(0,6.28), r=rr(30,100); add(router(700+Math.cos(a)*r,560+Math.sin(a)*r*0.6,60)); }
add(person(620,780,92,{coat:C.russet,arm:'up'})); add(person(800,780,88,{coat:C.grey,arm:'up'}));
// bed 6: antenna animals
for(let i=0;i<4;i++){ const x=1080+i*90, y=1120; add(ell(x,y-30,44,24,C.cream,'stroke="'+C.ink+'" stroke-width="1.4"')); add(circ(x+40,y-46,14,C.cream,'stroke="'+C.ink+'" stroke-width="1.3"')); add(P('M'+n(x+40)+','+n(y-60)+' v-24','stroke="'+C.ink+'" stroke-width="2"')); add(circ(x+40,y-86,5,C.pink)); for(let k=0;k<4;k++){ add(P('M'+n(x-24+k*18)+','+n(y-10)+' v30','stroke="'+C.cream+'" stroke-width="4"')); } }
add(person(1010,1120,92,{coat:C.pink,arm:'up'}));
// ---------- the procession (crosses all beds) ----------
for(let i=0;i<10;i++){ const x=240+i*110, y=920+Math.sin(i*0.9)*14; add(person(x,y,96,{coat:i%2?C.cream:C.pink,arm:'up',hat:C.russet})); add(rect(x-26,y-146,52,36,C.screen,'stroke="'+C.ink+'" stroke-width="1.3"')); add(rect(x-20,y-140,40,24,C.grey2)); add(P('M'+n(x)+','+n(y-110)+' L'+n(x)+','+n(y-92),'stroke="'+C.russet+'" stroke-width="3"')); }
add(person(1460,930,100,{coat:C.russet,arm:'up'}));
// ---------- the tug: two men pulling one cable ----------
add(person(560,1160,150,{coat:C.green,arm:'front'})); add(person(680,1160,150,{coat:C.pink,arm:'front'}));
add(P('M580,1100 q50,-24 90,0','stroke="'+C.screen+'" stroke-width="6" fill="none"'));
add(person(620,1120,120,{coat:C.grey,arm:'up'}));
// ---------- find-it: nine naked figures ----------
const nakedSpots=[[320,700,74,0],[240,660,64,1],[760,600,70,2],[920,560,64,0],[1210,700,72,1],[1390,1120,74,2],[1010,880,66,0],[470,1120,68,1],[1450,600,70,2]];
for(let i=0;i<9;i++){ add(naked(nakedSpots[i][0],nakedSpots[i][1],nakedSpots[i][2],nakedSpots[i][3])); }
// ---------- light + frame ----------
add(rect(0,0,W,H,'none','stroke="'+C.ink+'" stroke-width="26"'));
add(rect(26,26,W-52,H-52,'none','stroke="'+C.russet+'" stroke-width="3"'));
add(ell(1210,1040,260,40,C.ink,'opacity="0.16"'));
add(ell(740,1140,140,30,C.ink,'opacity="0.18"'));
add(rect(0,0,W,H,C.russet,'opacity="0.04"'));
add(ell(800,300,700,260,C.cream,'opacity="0.12"'));
add(rect(0,0,W,H,'#000','filter="url(#grain)" opacity="0.12"'));
add('</svg>');
fs.writeFileSync(process.argv[2]||'jardin-de-los-datos.svg',S.join('\n'));
console.log('wrote',(S.join('\n').length/1024).toFixed(1)+'KB',S.length+' elems');