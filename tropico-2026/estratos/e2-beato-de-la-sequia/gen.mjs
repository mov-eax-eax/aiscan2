import fs from 'node:fs';
const W=1200,H=1600;
const C={ vel:'#ead9b4', vel2:'#f4e8c8', och:'#c8862f', ochD:'#8f5c1c', verm:'#b03a20', lap:'#24418c', lapL:'#3f63b5', gold:'#d9a53c', ink:'#3a2a1a' };
let seed=1977;
function rnd(){ seed=(seed*1664525+1013904223)%4294967296; return seed/4294967296; }
function rr(a,b){ return a+(b-a)*rnd(); }
const n=(v)=>Math.round(v*100)/100;
const S=[]; const add=(s)=>S.push(s);
function P(d,a){ return '<path d="'+d+'"'+(a?' '+a:'')+'/>'; }
function rect(x,y,w,h,f,a){ return '<rect x="'+n(x)+'" y="'+n(y)+'" width="'+n(w)+'" height="'+n(h)+'" fill="'+(f||'none')+'"'+(a?' '+a:'')+'/>'; }
function circ(cx,cy,r,f,a){ return '<circle cx="'+n(cx)+'" cy="'+n(cy)+'" r="'+n(r)+'" fill="'+(f||'none')+'"'+(a?' '+a:'')+'/>'; }
function ell(cx,cy,rx,ry,f,a,rot){ return '<ellipse cx="'+n(cx)+'" cy="'+n(cy)+'" rx="'+n(rx)+'" ry="'+n(ry)+'" fill="'+(f||'none')+'"'+(rot?' transform="rotate('+n(rot)+' '+n(cx)+' '+n(cy)+')"':'')+(a?' '+a:'')+'/>'; }
function L(x1,y1,x2,y2,a){ return '<line x1="'+n(x1)+'" y1="'+n(y1)+'" x2="'+n(x2)+'" y2="'+n(y2)+'"'+(a?' '+a:'')+'/>'; }
function poly(pts,a){ return P('M'+pts.map(p=>n(p[0])+','+n(p[1])).join(' L')+' Z',a); }
const INK='stroke="'+C.ink+'" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"';

// ---------- letterforms (drawn as paths) ----------
function glyph(k, x, y, s, col){
  const w=8*s, h=14*s; let d='';
  switch(k){
    case 0: d='M'+n(x)+','+n(y+h)+' V'+n(y+2*s); break;                                  // i stem
    case 1: d='M'+n(x)+','+n(y+h)+' V'+n(y+4*s)+' Q'+n(x+2*s)+','+n(y-1*s)+' '+n(x+5*s)+','+n(y+2*s)+' V'+n(y+h); break; // n
    case 2: d='M'+n(x)+','+n(y+h)+' V'+n(y+4*s)+' Q'+n(x)+','+n(y+1*s)+' '+n(x+3.5*s)+','+n(y+1*s)+' Q'+n(x+7*s)+','+n(y+1*s)+' '+n(x+7*s)+','+n(y+4*s)+' V'+n(y+h); break; // u
    case 3: d='M'+n(x)+','+n(y+h)+' V'+n(y+4*s)+' Q'+n(x+2*s)+','+n(y-1*s)+' '+n(x+4*s)+','+n(y+3*s)+' V'+n(y+h)+' M'+n(x+4*s)+','+n(y+3*s)+' Q'+n(x+6*s)+','+n(y-1*s)+' '+n(x+8*s)+','+n(y+3*s)+' V'+n(y+h); break; // m
    case 4: d='M'+n(x+7*s)+','+n(y+h)+' H'+n(x+2*s)+' Q'+n(x)+','+n(y+h)+' '+n(x)+','+n(y+6*s)+' Q'+n(x)+','+n(y+1*s)+' '+n(x+4*s)+','+n(y+1*s)+' Q'+n(x+7*s)+','+n(y+1*s)+' '+n(x+7*s)+','+n(y+5*s)+' H'+n(x+2*s); break; // e
    case 5: d='M'+n(x+7*s)+','+n(y+3*s)+' Q'+n(x+5*s)+','+n(y+0.5*s)+' '+n(x+3*s)+','+n(y+1.5*s)+' Q'+n(x)+','+n(y+3*s)+' '+n(x)+','+n(y+8*s)+' Q'+n(x)+','+n(y+h)+' '+n(x+4*s)+','+n(y+h)+' Q'+n(x+6*s)+','+n(y+h)+' '+n(x+7*s)+','+n(y+11*s); break; // c
    case 6: d='M'+n(x+6*s)+','+n(y+1.5*s)+' Q'+n(x+2*s)+','+n(y-0.5*s)+' '+n(x+1*s)+','+n(y+3*s)+' Q'+n(x+0.5*s)+','+n(y+6*s)+' '+n(x+3.5*s)+','+n(y+6*s)+' Q'+n(x+7*s)+','+n(y+6*s)+' '+n(x+6.5*s)+','+n(y+9.5*s)+' Q'+n(x+6*s)+','+n(y+13*s)+' '+n(x+2.5*s)+','+n(y+12.5*s); break; // s
    case 7: d='M'+n(x)+','+n(y+3*s)+' H'+n(x+6*s)+' M'+n(x+3*s)+','+n(y+0.5*s)+' V'+n(y+11*s)+' Q'+n(x+3.5*s)+','+n(y+h)+' '+n(x+6*s)+','+n(y+h); break; // t
    case 8: d='M'+n(x)+','+n(y)+' V'+n(y+h)+' M'+n(x)+','+n(y+4*s)+' H'+n(x+5*s)+' M'+n(x+5*s)+','+n(y+4*s)+' V'+n(y+h); break; // h
    case 9: d='M'+n(x)+','+n(y+h)+' V'+n(y+1*s)+' H'+n(x+6*s); break; // l
  }
  const out=P(d, 'stroke="'+col+'" stroke-width="'+n(1.9*s)+'" fill="none" stroke-linecap="round" stroke-linejoin="round"');
  return out;
}

add('<?xml version="1.0" encoding="UTF-8"?>');
add('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 '+W+' '+H+'" width="'+W+'" height="'+H+'">');
add('<defs>');
add('<filter id="grain" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">');
add('<feTurbulence type="fractalNoise" baseFrequency="0.78" numOctaves="3" seed="4" stitchTiles="stitch"/>');
add('<feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0.28 0.28 0.28 0 0"/>');
add('</filter>');
add('<pattern id="goldDiaper" width="26" height="26" patternUnits="userSpaceOnUse">');
add(circ(13,13,4.4,'none','stroke="'+C.gold+'" stroke-width="1.6"'));
add(P('M13,3 L16,13 L13,23 L10,13 Z','fill="'+C.gold+'" opacity="0.55"'));
add('</pattern>');
add('<clipPath id="min"><rect x="98" y="96" width="1004" height="522"/></clipPath>');
add('<clipPath id="maze"><rect x="90" y="1268" width="1020" height="232"/></clipPath>');
add('</defs>');
add(rect(0,0,W,H,C.vel));

// ---------- border ----------
add(rect(18,18,1164,1564,C.verm));
add(rect(30,30,1140,1540,C.vel,'stroke="'+C.gold+'" stroke-width="5"'));
add(rect(18,18,1164,1564,'none','stroke="'+C.gold+'" stroke-width="4"'));
add(rect(58,58,1084,1484,'none','stroke="'+C.ochD+'" stroke-width="3"'));
add(rect(66,66,1068,1468,'none','stroke="'+C.gold+'" stroke-width="2"'));
// 52 gold diamonds (weeks) around the border band
for(let i=0;i<52;i++){
  const t=i/52*4, side=Math.floor(t), u=t-side;
  let x,y;
  if(side===0){ x=18+u*1164; y=24; } else if(side===1){ x=1176; y=18+u*1564; } else if(side===2){ x=1176-u*1164; y=1576; } else { x=24; y=1576-u*1564; }
  add(P('M'+n(x)+','+n(y-4)+' L'+n(x+4)+','+n(y)+' L'+n(x)+','+n(y+4)+' L'+n(x-4)+','+n(y)+' Z','fill="'+C.gold+'"'));
}
for(let i=0;i<34;i++){ add(P('M'+n(40+i*33)+',18 q8,14 0,28','fill="none" stroke="'+C.gold+'" stroke-width="2" opacity="0.8"')); add(P('M'+n(40+i*33)+',1582 q8,-14 0,-28','fill="none" stroke="'+C.gold+'" stroke-width="2" opacity="0.8"')); }
for(let i=0;i<46;i++){ add(P('M18,'+n(44+i*33)+' q14,8 28,0','fill="none" stroke="'+C.gold+'" stroke-width="2" opacity="0.8"')); add(P('M1182,'+n(44+i*33)+' q-14,8 -28,0','fill="none" stroke="'+C.gold+'" stroke-width="2" opacity="0.8"')); }
// 12 month ticks on the inner frame top
for(let i=0;i<12;i++){ add(rect(150+i*76,58,3,14,C.verm)); }
// corner squares
[[58,58],[1142,58],[58,1552],[1142,1552]].forEach(function(p){ add(rect(p[0]-11,p[1]-11,22,22,C.gold)); add(rect(p[0]-6,p[1]-6,12,12,C.verm)); });

// ---------- miniature ----------
add(rect(88,86,1024,542,C.och));
add(rect(96,94,1008,526,C.vel2));
add('<g clip-path="url(#min)">');
add(rect(98,96,1004,204,C.lap));
add(rect(98,96,1004,204,'url(#goldDiaper)','opacity="0.3"'));
add(rect(98,300,1004,64,C.verm));
for(let i=0;i<26;i++){ add(poly([[110+i*38,306],[126+i*38,332],[110+i*38,358],[94+i*38,332]],'fill="none" stroke="'+C.gold+'" stroke-width="2.4" opacity="0.9"')); }
add(rect(98,364,1004,264,C.och));
add(rect(98,364,1004,264,'none','stroke="'+C.ochD+'" stroke-width="2"'));
// drought sun (twelve rays) and a pale moon
for(let i=0;i<12;i++){ const a=i*Math.PI/6; const x1=310+Math.cos(a)*52, y1=174+Math.sin(a)*52, x2=310+Math.cos(a)*80, y2=174+Math.sin(a)*80; add(P('M'+n(x1)+','+n(y1)+' L'+n(x2)+','+n(y2),'stroke="'+C.gold+'" stroke-width="5" stroke-linecap="round"')); }
add(circ(310,174,48,C.gold,'stroke="'+C.ochD+'" stroke-width="3"'));
add(circ(310,174,35,'none','stroke="'+C.och+'" stroke-width="2"'));
add(P('M278,154 L296,184 L287,193 L318,216','stroke="'+C.verm+'" stroke-width="4" fill="none"'));
add(circ(900,174,34,C.vel2,'stroke="'+C.ochD+'" stroke-width="3"'));
add(circ(900,174,24,'none','stroke="'+C.ochD+'" stroke-width="2"'));
add(P('M878,164 q 22,-16 40,0','stroke="'+C.och+'" stroke-width="2" fill="none"'));
for(let i=0;i<20;i++){ const x=280+rr(0,650), y=112+rr(0,170); add(circ(x,y,rr(1.6,3.2),C.gold)); }
// the vision: a rainbow, a throne, and a book with seven seals
const arc=(r,c,w)=>{ add(P('M'+n(600-r*0.94)+','+n(646)+' A'+r+','+r+' 0 0 1 '+n(600+r*0.94)+','+n(646),'fill="none" stroke="'+c+'" stroke-width="'+w+'" opacity="0.97"')); };
arc(524,C.verm,28); arc(490,C.och,26); arc(458,C.gold,26); arc(426,C.lap,32); arc(398,C.lapL,13);
// throne: lapis back, gold seat
add(poly([[542,362],[658,362],[682,506],[518,506]],'fill="'+C.lap+'" stroke="'+C.gold+'" stroke-width="5"'));
add(poly([[560,382],[640,382],[656,492],[544,492]],'fill="none" stroke="'+C.lapL+'" stroke-width="2.5"'));
add(P('M542,362 q 58,-54 116,0','fill="none" stroke="'+C.gold+'" stroke-width="6"'));
add(circ(600,410,16,'none','stroke="'+C.gold+'" stroke-width="3"'));
add(poly([[520,506],[680,506],[692,556],[508,556]],'fill="'+C.gold+'" stroke="'+C.ochD+'" stroke-width="4"'));
add(rect(524,552,20,70,C.ochD)); add(rect(656,552,20,70,C.ochD));
add(rect(516,500,168,22,C.verm,'stroke="'+C.gold+'" stroke-width="3"'));
// the sealed book
add(rect(556,436,88,60,C.vel2,'stroke="'+C.ochD+'" stroke-width="4"'));
add(rect(556,436,88,60,'none','stroke="'+C.gold+'" stroke-width="2"'));
add(rect(548,444,12,44,C.verm,'stroke="'+C.ochD+'" stroke-width="2"'));
for(let i=0;i<7;i++){ add(circ(600,448+i*7.6,3.4,i===3?C.lap:C.verm,'stroke="'+C.ochD+'" stroke-width="1"')); }
add(P('M570,446 h60 M570,458 h44 M570,470 h52','stroke="'+C.och+'" stroke-width="2" opacity="0.8"'));
// dry river
add(P('M98,470 C240,442 330,506 470,486 C610,466 700,516 840,494 C940,478 1010,498 1102,486 L1102,540 C1000,556 920,530 820,546 C700,566 610,516 470,536 C330,556 240,492 98,524 Z','fill="'+C.lap+'" stroke="'+C.ochD+'" stroke-width="2.5"'));
for(let i=0;i<34;i++){ const x=120+rr(0,950), y=486+rr(0,44); add(P('M'+n(x)+','+n(y)+' l'+n(rr(7,16))+',0','stroke="'+C.lapL+'" stroke-width="2" opacity="0.7"')); }
// fish skeletons in the dry bed
[[300,504],[560,516],[860,506]].forEach(function(f){ add(P('M'+n(f[0]-16)+','+n(f[1])+' L'+n(f[0]+13)+','+n(f[1]-6)+' M'+n(f[0]-16)+','+n(f[1])+' L'+n(f[0]+13)+','+n(f[1]+6)+' M'+n(f[0]+13)+','+n(f[1]-6)+' L'+n(f[0]+22)+','+n(f[1]-12)+' M'+n(f[0]+13)+','+n(f[1]+6)+' L'+n(f[0]+22)+','+n(f[1]+12),'stroke="'+C.lapL+'" stroke-width="1.8" fill="none" opacity="0.9"')); add(circ(f[0]-4,f[1],2,C.lapL)); });
// cracked earth: irregular plates
for(let i=0;i<9;i++){ const x=120+i*112+rr(-18,18), y=580+rr(-8,8); add(P('M'+n(x-54)+','+n(y-14)+' l'+n(rr(28,46))+','+n(rr(-6,10))+' l'+n(rr(30,44))+','+n(rr(8,18))+' l'+n(-rr(34,50))+','+n(rr(2,10))+' Z','fill="'+C.och+'" stroke="'+C.verm+'" stroke-width="2.2"')); }
// dead tree
add(P('M196,606 C196,560 188,520 168,486 M196,606 C196,566 204,528 224,496 M180,556 l-26,-16 M212,540 l26,-18 M190,520 l-14,-30 M204,518 l14,-26','stroke="'+C.ink+'" stroke-width="4" fill="none" stroke-linecap="round"'));
// the four living creatures at the corners
function beast4(cx,cy,k){
  let o=circ(cx,cy,44,C.vel2,'stroke="'+C.gold+'" stroke-width="5"');
  o+=circ(cx,cy,36,'none','stroke="'+C.ochD+'" stroke-width="2"');
  if(k===0){ o+=circ(cx,cy,20,C.och,'stroke="'+C.ochD+'" stroke-width="2"'); for(let i=0;i<14;i++){ const a=i*Math.PI/7; o+=P('M'+n(cx+Math.cos(a)*20)+','+n(cy+Math.sin(a)*20)+' l'+n(Math.cos(a)*12)+','+n(Math.sin(a)*12),'stroke="'+C.ochD+'" stroke-width="2.4"'); } o+=circ(cx-7,cy-4,2.4,C.ink); o+=circ(cx+7,cy-4,2.4,C.ink); }
  if(k===1){ o+=poly([[cx-24,cy+14],[cx-20,cy-12],[cx,cy-20],[cx+20,cy-12],[cx+24,cy+14]],'fill="'+C.och+'" stroke="'+C.ochD+'" stroke-width="2"'); o+=P('M'+n(cx-20)+','+n(cy-12)+' q-12,-16 -20,-6 M'+n(cx+20)+','+n(cy-12)+' q12,-16 20,-6','stroke="'+C.ochD+'" stroke-width="3" fill="none"'); o+=circ(cx-8,cy,2.4,C.ink); o+=circ(cx+8,cy,2.4,C.ink); }
  if(k===2){ o+=P('M'+n(cx-24)+','+n(cy+8)+' q6,-18 22,-22 q16,-4 22,8 l-8,4 l6,8 q-14,10 -26,6 q-10,-2 -16,-4 Z','fill="'+C.och+'" stroke="'+C.ochD+'" stroke-width="2"'); o+=P('M'+n(cx-24)+','+n(cy+8)+' q-8,2 -12,8','stroke="'+C.ochD+'" stroke-width="2.5" fill="none"'); o+=P('M'+n(cx+6)+','+n(cy-8)+' q10,-10 18,-4','stroke="'+C.gold+'" stroke-width="3" fill="none"'); o+=circ(cx+14,cy-12,2.2,C.ink); }
  if(k===3){ o+=circ(cx,cy-2,15,C.och,'stroke="'+C.ochD+'" stroke-width="2"'); o+=P('M'+n(cx-15)+','+n(cy-2)+' q15,-26 30,0','fill="none" stroke="'+C.gold+'" stroke-width="5"'); o+=circ(cx-5,cy-2,2.4,C.ink); o+=circ(cx+5,cy-2,2.4,C.ink); }
  return o;
}
[[150,150,0],[1050,150,1],[150,590,2],[1050,590,3]].forEach(function(w){ add(beast4(w[0],w[1],w[2])); });
add('</g>');
add(rect(96,94,1008,526,'none','stroke="'+C.ochD+'" stroke-width="4"'));
add(rect(104,102,992,510,'none','stroke="'+C.gold+'" stroke-width="2"'));

// ---------- text block ----------
const colX=[130,652];
for(let c=0;c<2;c++){
  for(let ln=0;ln<17;ln++){
    const y=676+ln*24;
    const rubric=(ln===0||ln===6||ln===12);
    let x=colX[c];
    const colr=rubric?C.verm:C.ink;
    while(x<colX[c]+400){
      const k=Math.floor(rr(0,10));
      const adv=rr(11,15);
      if(rr(0,1)<0.11){ x+=rr(9,15); continue; }
      add(glyph(k,x,y,1,colr));
      x+=adv;
    }
  }
}
// initial capital
add(rect(126,664,58,58,C.lap,'stroke="'+C.gold+'" stroke-width="4"'));
add(P('M136,714 V676 M136,676 H178 M136,694 H168 M168,694 V714 M150,676 L136,714','stroke="'+C.gold+'" stroke-width="5" fill="none"'));
add(P('M186,676 C196,690 196,706 186,718','stroke="'+C.verm+'" stroke-width="3" fill="none"'));
// column divider
add(rect(596,668,8,412,C.och));
add(rect(598,668,4,412,C.gold));
for(let i=0;i<9;i++){ add(circ(600,690+i*46,3.4,C.verm)); }

// rubric above the frieze
add(rect(90,1092,1020,7,C.verm)); add(rect(90,1104,1020,2,C.ochD));
add(rect(90,1252,1020,2,C.ochD)); add(rect(90,1256,1020,6,C.verm));
// ---------- calendar frieze: 12 beasts, wrong weather ----------
const glyphs=['snow','rain','wind','sun','storm','sun','sun','storm','wind','rain','fog','snow'];
const normal=['snow','rain','wind','rain','sun','sun','sun','storm','wind','rain','fog','snow'];
function weather(x,y,s,kind){
  if(kind==='sun'){ return circ(x,y,6*s,C.gold,'stroke="'+C.ochD+'" stroke-width="1.6"')+P('M'+n(x-9*s)+','+n(y)+' H'+n(x+9*s)+' M'+n(x)+','+n(y-9*s)+' V'+n(y+9*s)+' M'+n(x-6*s)+','+n(y-6*s)+' L'+n(x+6*s)+','+n(y+6*s)+' M'+n(x+6*s)+','+n(y-6*s)+' L'+n(x-6*s)+','+n(y+6*s),'stroke="'+C.ochD+'" stroke-width="1.4"'); }
  if(kind==='rain'){ let o=''; for(let i=0;i<4;i++){ o+=P('M'+n(x-7*s+i*5*s)+','+n(y-4*s)+' v'+n(7*s),'stroke="'+C.lap+'" stroke-width="1.8"'); } return o+P('M'+n(x-10*s)+','+n(y-5*s)+' q'+n(4*s)+',-4 '+n(8*s)+',0 q'+n(4*s)+',-4 '+n(8*s)+',0','stroke="'+C.ink+'" stroke-width="1.4" fill="none"'); }
  if(kind==='snow'){ let o=''; for(let i=0;i<3;i++){ const a=i*1.047; o+=P('M'+n(x-7*s*Math.cos(a))+','+n(y-7*s*Math.sin(a))+' L'+n(x+7*s*Math.cos(a))+','+n(y+7*s*Math.sin(a)),'stroke="'+C.lap+'" stroke-width="1.6"'); } return o; }
  if(kind==='wind'){ return P('M'+n(x-9*s)+','+n(y-3*s)+' q'+n(6*s)+',-5 '+n(9*s)+',0 q'+n(4*s)+',5 '+n(-2*s)+',5 M'+n(x-8*s)+','+n(y+3*s)+' q'+n(8*s)+',4 '+n(12*s)+',-1','stroke="'+C.ink+'" stroke-width="1.6" fill="none"'); }
  if(kind==='storm'){ return P('M'+n(x-8*s)+','+n(y-4*s)+' q'+n(4*s)+',-5 '+n(8*s)+',0 q'+n(4*s)+',-5 '+n(8*s)+',0 M'+n(x+1*s)+','+n(y)+' l'+n(-4*s)+','+n(5*s)+' l'+n(3*s)+',0 l'+n(-4*s)+','+n(6*s),'stroke="'+C.ink+'" stroke-width="1.6" fill="none"'); }
  if(kind==='fog'){ return P('M'+n(x-9*s)+','+n(y-3*s)+' H'+n(x+9*s)+' M'+n(x-7*s)+','+n(y)+' H'+n(x+7*s)+' M'+n(x-9*s)+','+n(y+3*s)+' H'+n(x+9*s),'stroke="'+C.lap+'" stroke-width="1.6"'); }
  return '';
}
for(let i=0;i<12;i++){
  const cx=90+45+i*90, cy=1196;
  add(rect(cx-40,1148,80,100,(i%2?C.vel2:C.vel),'stroke="'+C.ochD+'" stroke-width="1.6"'));
  // roman numeral
  const romans=['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII'][i];
  let rx=cx-romans.length*2.6;
  for(let q=0;q<romans.length;q++){ const ch=romans[q]; if(ch==='I'){ add(rect(rx,1152,2.4,9,C.gold)); rx+=4.4; } else { add(P('M'+n(rx-2)+',1152 L'+n(rx+1.6)+',1157 L'+n(rx+5)+',1152','stroke="'+C.gold+'" stroke-width="2" fill="none"')); rx+=7; } }
  // beast (each month a different creature: head, horns, tail)
  const kind=i%4;
  add(circ(cx-2,1182,9,C.och,'stroke="'+C.ochD+'" stroke-width="1.8"'));
  add(poly([[cx-6,1190],[cx+18,1186],[cx+22,1200],[cx-2,1204]],'fill="'+C.och+'" stroke="'+C.ink+'" stroke-width="1.6"'));
  add(P('M'+n(cx+20)+',1192 q'+n(11)+','+n(rr(-8,8))+' '+n(13)+','+n(rr(0,12)),'stroke="'+C.ink+'" stroke-width="1.8" fill="none"'));
  add(P('M'+n(cx-6)+',1200 l-5,9 M'+n(cx+1)+',1202 l2,8 M'+n(cx+13)+',1202 l2,8','stroke="'+C.ink+'" stroke-width="1.8"'));
  if(kind===0){ add(P('M'+n(cx-6)+',1176 l-5,-9 M'+n(cx+2)+',1174 l3,-9','stroke="'+C.ink+'" stroke-width="2"')); }
  if(kind===1){ add(P('M'+n(cx-6)+',1176 q-8,-10 -14,-4 M'+n(cx+2)+',1174 q8,-10 14,-4','stroke="'+C.verm+'" stroke-width="2" fill="none"')); }
  if(kind===2){ add(circ(cx+1,1170,3,C.verm)); }
  if(kind===3){ add(P('M'+n(cx-4)+',1176 l-2,-10 l6,4 l-2,-8','stroke="'+C.ink+'" stroke-width="2" fill="none"')); }
  // weather glyph, wrong month
  const g=(i===3)?normal[3]:normal[(i+1)%12];
  add(weather(cx+22,1226,1.5,g));
  // the month's own weather, hidden tiny in the belly
  add(weather(cx+2,1188,0.28,normal[i]));
}

// ---------- the maze: solution spells 2026 ----------
add(rect(90,1268,1020,7,C.verm)); add(rect(90,1277,1020,2,C.ochD));
add(rect(90,1268,1020,232,C.och));
add(rect(90,1268,1020,232,'none','stroke="'+C.ochD+'" stroke-width="3"'));
// corridor polyline through four digit cells
const cells=[[90,255],[345,255],[600,255],[855,255]];
function gp(cellX, col, row){ return [cellX+42+col*62, 1300+row*36]; }
let pathPt=[];
const seqs=[[[0,0],[2,0],[2,1],[0,2],[0,3],[2,4],[0,4]],[[0,1],[0,0],[2,0],[2,4],[0,4],[0,1]],[[0,0],[2,0],[2,1],[0,2],[0,3],[2,4],[0,4]],[[2,0],[0,0],[0,4],[2,4],[2,2],[0,2]]];
for(let c=0;c<4;c++){
  const pts=seqs[c].map(p=>gp(cells[c][0],p[0],p[1]));
  if(c>0){ const prev=pathPt[pathPt.length-1]; const feed=[prev,[prev[0],1322],[pts[0][0],1322],[pts[0][0],pts[0][1]]]; pathPt=pathPt.concat(feed); }
  pathPt=pathPt.concat(pts);
}
let dcorr='M'+pathPt.map(p=>n(p[0])+','+n(p[1])).join(' L');
add(P(dcorr,'fill="none" stroke="'+C.vel2+'" stroke-width="18" stroke-linejoin="round" stroke-linecap="round"'));
add(P(dcorr,'fill="none" stroke="'+C.ochD+'" stroke-width="2" stroke-linejoin="round" opacity="0.45"'));
// wall blocks: a grid, skipping cells near the corridor
function distSeg(px,py,ax,ay,bx,by){ const dx=bx-ax, dy=by-ay; const L2=dx*dx+dy*dy; let t=((px-ax)*dx+(py-ay)*dy)/L2; t=Math.max(0,Math.min(1,t)); const qx=ax+t*dx, qy=ay+t*dy; return Math.hypot(px-qx,py-qy); }
function nearCorr(px,py,r){ for(let i=0;i<pathPt.length-1;i++){ if(distSeg(px,py,pathPt[i][0],pathPt[i][1],pathPt[i+1][0],pathPt[i+1][1])<r) return true; } return false; }
let walls='';
for(let gy=0;gy<11;gy++){ for(let gx=0;gx<42;gx++){ const px=102+gx*24, py=1280+gy*20; if(!nearCorr(px,py,20)){ walls+=rect(px-9,py-7,18,14,C.ink,'opacity="0.55"'); if((gx+gy)%3===0) walls+=P('M'+n(px-7)+','+n(py+5)+' l12,-10','stroke="'+C.och+ '" stroke-width="1.2" opacity="0.5"'); } } }
add(walls);
// dead ends
for(let i=0;i<16;i++){ const t=pathPt[Math.floor(rr(0,pathPt.length-1))]; const dir=rr(0,1)<0.5?1:-1; const px=t[0]+dir*rr(34,60); add(P('M'+n(t[0])+','+n(t[1])+' H'+n(px),'fill="none" stroke="'+C.vel2+'" stroke-width="14" stroke-linecap="round"')); }
// hatch inside the corridor so it reads as a passage, not as lettering
let hatch='';
for(let i=0;i<pathPt.length-1;i++){
  const ax=pathPt[i][0], ay=pathPt[i][1], bx=pathPt[i+1][0], by=pathPt[i+1][1];
  const L=Math.hypot(bx-ax,by-ay), steps=Math.max(1,Math.round(L/16));
  for(let s2=0;s2<steps;s2++){
    const t=(s2+0.5)/steps, px=ax+(bx-ax)*t, py=ay+(by-ay)*t;
    hatch+=P('M'+n(px-7)+','+n(py+6)+' l14,-12','stroke="'+C.ochD+'" stroke-width="1.3" opacity="0.55"');
  }
}
add(hatch);
// entrance / exit dots
add(circ(pathPt[0][0],pathPt[0][1],8,C.gold,'stroke="'+C.ochD+'" stroke-width="2.5"'));
add(circ(pathPt[pathPt.length-1][0],pathPt[pathPt.length-1][1],8,C.gold,'stroke="'+C.ochD+'" stroke-width="2.5"'));
add(P('M'+n(pathPt[0][0]-20)+','+n(pathPt[0][1])+' h14 M'+n(pathPt[0][0]-13)+','+n(pathPt[0][1]-6)+' l7,6 l-7,6','stroke="'+C.gold+'" stroke-width="3" fill="none"'));

// ---------- grain ----------
add(rect(0,0,W,H,'#000','filter="url(#grain)" opacity="0.10"'));
add('</svg>');
fs.writeFileSync(process.argv[2]||'beato-de-la-sequia.svg',S.join('\n'));
console.log('wrote',(S.join('\n').length/1024).toFixed(1)+'KB',S.length+' elems');