import fs from 'node:fs';
const W=1600,H=1200;
const C={ field:'#1e3b35', field2:'#24453d', cream:'#e8dcc0', white:'#f2ecd8', rose:'#c46a6a', gold:'#c9a03c', russet:'#8a4a2a', verd:'#4e7a63', sky:'#cfd8c8', sky2:'#b9c8b6', ink:'#241d18', water:'#3d6a72' };
let seed=1500;
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
// ---------- figures for a millefleurs tapestry ----------
function person(x,y,h,o){
  o=o||{};
  const coat=o.coat||C.russet, hose=o.hose||C.cream, hat=o.hat||C.rose;
  const hw=h*0.16, leg=h*0.44, head=h*0.12; let s='';
  s+=P('M'+n(x-hw*0.5)+','+n(y)+' L'+n(x-hw*0.35)+','+n(y-leg*0.5)+' M'+n(x+hw*0.5)+','+n(y)+' L'+n(x+hw*0.35)+','+n(y-leg*0.5),'stroke="'+hose+'" stroke-width="'+n(h*0.085)+'"');
  s+=poly([[x-hw*1.05,y-leg*0.48],[x-hw*0.62,y-leg*0.95],[x+hw*0.62,y-leg*0.95],[x+hw*1.15,y-leg*0.44],[x+hw*0.5,y-leg*0.38],[x-hw*0.6,y-leg*0.38]],coat,'stroke="'+C.ink+'" stroke-width="1.3"');
  const arm=o.arm||'down';
  if(arm==='down'){ s+=P('M'+n(x-hw*0.9)+','+n(y-leg*0.85)+' L'+n(x-hw*1.05)+','+n(y-leg*0.42)+' M'+n(x+hw*0.9)+','+n(y-leg*0.85)+' L'+n(x+hw*1.05)+','+n(y-leg*0.42),'stroke="'+coat+'" stroke-width="'+n(h*0.075)+'"'); }
  if(arm==='up'){ s+=P('M'+n(x-hw*0.9)+','+n(y-leg*0.85)+' L'+n(x-hw*1.5)+','+n(y-leg*0.95)+' M'+n(x+hw*0.9)+','+n(y-leg*0.85)+' L'+n(x+hw*1.35)+','+n(y-leg*1.1),'stroke="'+coat+'" stroke-width="'+n(h*0.075)+'"'); }
  if(arm==='spear'){ s+=P('M'+n(x+hw*1.3)+','+n(y-leg*1.9)+' L'+n(x+hw*0.9)+','+n(y-leg*0.2),'stroke="'+C.russet+'" stroke-width="'+n(h*0.035)+'"'); s+=P('M'+n(x-hw*0.9)+','+n(y-leg*0.85)+' L'+n(x-hw*1.2)+','+n(y-leg*0.5),'stroke="'+coat+'" stroke-width="'+n(h*0.075)+'"'); s+=P('M'+n(x+hw*0.9)+','+n(y-leg*0.85)+' L'+n(x+hw*1.2)+','+n(y-leg*0.62),'stroke="'+coat+'" stroke-width="'+n(h*0.075)+'"'); }
  if(arm==='bow'){ s+=P('M'+n(x+hw*1.1)+','+n(y-leg*1.05)+' L'+n(x+hw*1.1)+','+n(y-leg*0.45),'stroke="'+C.russet+'" stroke-width="2"'); s+=P('M'+n(x+hw*1.1)+','+n(y-leg*1.05)+' q'+n(h*0.14)+','+n(h*0.1)+' 0,'+n(h*0.5),'fill="none" stroke="'+C.russet+'" stroke-width="2.4"'); }
  s+=circ(x,y-leg*0.99,head*0.5,'#d8b48c','stroke="'+C.ink+'" stroke-width="1.1"');
  s+=P('M'+n(x-head*0.7)+','+n(y-leg*0.99-head*0.2)+' q'+n(head*0.7)+',-'+n(head*0.8)+' '+n(head*1.4)+',0 Z','fill="'+hat+'" stroke="'+C.ink+'" stroke-width="1.2"');
  return s;
}
function horse(x,y,h,o){
  o=o||{}; const col=o.col||C.russet; let s='';
  for(let i=0;i<4;i++){ const lx=x+(i<2?-0.2:0.16)*h, off=(i%2)?0.03*h:0; s+=P('M'+n(lx)+','+n(y-h*0.4)+' l'+n(off)+','+n(h*0.4),'stroke="'+col+'" stroke-width="'+n(h*0.06)+'" stroke-linecap="round"'); }
  s+=ell(x-h*0.02,y-h*0.5,h*0.3,h*0.16,col,'stroke="'+C.ink+'" stroke-width="1.5"');
  s+=P('M'+n(x+h*0.14)+','+n(y-h*0.58)+' Q'+n(x+h*0.24)+','+n(y-h*0.72)+' '+n(x+h*0.28)+','+n(y-h*0.8),'stroke="'+col+'" stroke-width="'+n(h*0.12)+'" fill="none" stroke-linecap="round"');
  s+=ell(x+h*0.34,y-h*0.84,h*0.1,h*0.055,col,'stroke="'+C.ink+'" stroke-width="1.3"');
  s+=P('M'+n(x+h*0.42)+','+n(y-h*0.84)+' l'+n(h*0.06)+',-'+n(h*0.01),'stroke="'+C.ink+'" stroke-width="1.6"');
  s+=P('M'+n(x+h*0.12)+','+n(y-h*0.66)+' Q'+n(x+h*0.2)+','+n(y-h*0.76)+' '+n(x+h*0.26)+','+n(y-h*0.82),'stroke="'+C.ink+'" stroke-width="'+n(h*0.035)+'" fill="none"');
  s+=P('M'+n(x-h*0.3)+','+n(y-h*0.54)+' q-'+n(h*0.07)+','+n(h*0.1)+' -'+n(h*0.02)+','+n(h*0.22),'stroke="'+col+'" stroke-width="'+n(h*0.05)+'" fill="none"');
  if(o.rider){ s+=person(x-h*0.04,y-h*0.58,h*0.6,o.rider); }
  return s;
}
function hound(x,y,s){
  for(let i=0;i<4;i++){ const lx=x+(i<2?-0.2:0.16)*s; var legs=P('M'+n(lx)+','+n(y-s*0.3)+' l'+n(rr(-3,3))+','+n(s*0.3),'stroke="'+C.cream+'" stroke-width="'+n(s*0.045)+'"'); }
  let o=(typeof legs!=='undefined'?legs:'');
  o+=ell(x,y-s*0.4,s*0.3,s*0.13,C.cream,'stroke="'+C.ink+'" stroke-width="1.2"');
  o+=circ(x+s*0.32,y-s*0.5,s*0.1,C.cream,'stroke="'+C.ink+'" stroke-width="1.2"');
  o+=P('M'+n(x+s*0.38)+','+n(y-s*0.58)+' l'+n(s*0.08)+',-'+n(s*0.1)+' l'+n(s*0.02)+','+n(s*0.1),'fill="'+C.russet+'"');
  o+=P('M'+n(x-s*0.3)+','+n(y-s*0.44)+' q-'+n(s*0.14)+',-'+n(s*0.16)+' -'+n(s*0.02)+',-'+n(s*0.26),'stroke="'+C.cream+'" stroke-width="'+n(s*0.04)+'" fill="none"');
  o+=P('M'+n(x+s*0.44)+','+n(y-s*0.46)+' l'+n(s*0.1)+',-'+n(s*0.02),'stroke="'+C.ink+'" stroke-width="2"');
  return o;
}
function stag(x,y,s,turn){
  let o='';
  for(let i=0;i<4;i++){ const lx=x+(i<2?-0.22:0.18)*s; o+=P('M'+n(lx)+','+n(y-s*0.34)+' l'+n(turn?rr(-10,10):rr(-4,4))+','+n(s*0.34),'stroke="'+C.cream+'" stroke-width="'+n(s*0.055)+'" stroke-linecap="round"'); }
  o+=ell(x,y-s*0.46,s*0.3,s*0.16,C.cream,'stroke="'+C.ink+'" stroke-width="1.6"');
  o+=P('M'+n(x+s*0.18)+','+n(y-s*0.54)+' Q'+n(x+s*0.3)+','+n(y-s*0.66)+' '+n(x+s*0.42)+','+n(y-s*0.72),'stroke="'+C.cream+'" stroke-width="'+n(s*0.085)+'" fill="none" stroke-linecap="round"');
  o+=poly([[x+s*0.42,y-s*0.78],[x+s*0.58,y-s*0.72],[x+s*0.56,y-s*0.66],[x+s*0.4,y-s*0.66]],C.cream,'stroke="'+C.ink+'" stroke-width="1.3"');
  o+=P('M'+n(x+s*0.56)+','+n(y-s*0.7)+' l'+n(s*0.05)+',-'+n(s*0.01),'stroke="'+C.ink+'" stroke-width="1.6"');
  o+=circ(x+s*0.5,y-s*0.74,s*0.016,C.ink);
  // antlers
  for(let i=0;i<4;i++){ const a=-2.5+i*0.34; const bx=x+s*0.44, by=y-s*0.8;
    o+=P('M'+n(bx)+','+n(by)+' q'+n(Math.cos(a)*s*0.1)+','+n(Math.sin(a)*s*0.14)+' '+n(Math.cos(a)*s*0.14)+','+n(Math.sin(a)*s*0.22),'stroke="'+C.gold+'" stroke-width="'+n(s*0.028)+'" fill="none" stroke-linecap="round"');
    o+=P('M'+n(bx+Math.cos(a)*s*0.08)+','+n(by+Math.sin(a)*s*0.12)+' q'+n(Math.cos(a+0.8)*s*0.07)+','+n(Math.sin(a+0.8)*s*0.08)+' '+n(Math.cos(a+0.8)*s*0.12)+','+n(Math.sin(a+0.8)*s*0.12),'stroke="'+C.gold+'" stroke-width="'+n(s*0.024)+'" fill="none" stroke-linecap="round"');
  }
  // tail
  o+=P('M'+n(x-s*0.3)+','+n(y-s*0.5)+' q-'+n(s*0.1)+',-'+n(s*0.08)+' -'+n(s*0.04)+',-'+n(s*0.22),'stroke="'+C.cream+'" stroke-width="'+n(s*0.04)+'" fill="none"');
  return o;
}
function hare(x,y,s,pose){
  const e=pose%4, bodyA=(pose%2)?18:-8;
  let o='';
  o+=ell(x,y,s*0.5,s*0.26,C.white,'stroke="'+C.ink+'" stroke-width="1.1"');
  o+=circ(x+s*0.4,y-s*0.2,s*0.16,C.white,'stroke="'+C.ink+'" stroke-width="1.1"');
  if(e===3){ o+=ell(x+s*0.4,y-s*0.34,s*0.2,s*0.06,C.white,'stroke="'+C.ink+'" stroke-width="1"'); }
  else { o+=P('M'+n(x+s*0.42)+','+n(y-s*0.3)+' q'+n(s*0.06)+',-'+n(s*0.34)+' -'+n(s*0.02)+',-'+n(s*0.4)+' M'+n(x+s*0.5)+','+n(y-s*0.3)+' q'+n(s*0.1)+',-'+n(s*0.3)+' '+n(s*0.12)+',-'+n(s*0.36),'stroke="'+C.white+'" stroke-width="'+n(s*0.07)+'" fill="none"'); }
  if(pose%3===0){ o+=ell(x+s*0.2,y-s*0.5,s*0.2,s*0.1,C.white,'stroke="'+C.ink+'" stroke-width="1"'); }
  o+=P('M'+n(x-s*0.4)+','+n(y)+' q-'+n(s*0.2)+','+n(s*0.1)+' -'+n(s*0.1)+','+n(s*0.24),'stroke="'+C.white+'" stroke-width="'+n(s*0.07)+'" fill="none"');
  return o;
}
function flower(x,y,r,col){
  let o='';
  for(let i=0;i<5;i++){ const a=i*1.2566; o+=circ(x+Math.cos(a)*r*0.6,y+Math.sin(a)*r*0.6,r*0.5,col); }
  o+=circ(x,y,r*0.32,C.gold);
  return o;
}
add('<?xml version="1.0" encoding="UTF-8"?>');
add('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 '+W+' '+H+'" width="'+W+'" height="'+H+'">');
add('<defs>');
add('<filter id="grain" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">');
add('<feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="3" seed="41" stitchTiles="stitch"/>');
add('<feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0.30 0.30 0.30 0 0"/>');
add('</filter>');
add('<pattern id="mille" width="64" height="64" patternUnits="userSpaceOnUse">');
add(rect(0,0,64,64,C.field2));
add(flower(16,16,7,C.cream)+flower(46,30,6,C.rose)+flower(26,50,5,C.gold));
add(P('M40,56 q8,-14 2,-24','fill="none" stroke="'+C.verd+'" stroke-width="2"'));
add(P('M8,44 q-6,10 4,18','fill="none" stroke="'+C.verd+'" stroke-width="2"'));
add('</pattern>');
add('</defs>');
add(rect(0,0,W,H,C.field));
add(rect(0,0,W,H,'url(#mille)'));
// ---------- background: sky, hill, castle, river, mill ----------
add(rect(0,0,W,150,C.sky));
add(rect(0,90,W,64,C.sky2));
add(P('M0,150 Q300,60 640,120 Q980,180 1300,96 Q1470,60 1600,110 L1600,170 L0,170 Z','fill="'+C.field2+'"'));
// castle on the hill (upper right)
add(P('M1180,132 L1180,60 L1210,60 L1210,40 L1240,40 L1240,60 L1270,60 L1270,132 Z','fill="'+C.cream+'" stroke="'+C.ink+'" stroke-width="1.6"'));
add(rect(1194,20,16,24,C.rose)); add(rect(1246,16,16,28,C.rose));
add(P('M1168,132 h150','stroke="'+C.ink+'" stroke-width="2"'));
for(let i=0;i<7;i++){ add(rect(1172+i*20,132-i*2,12,10,C.cream,'stroke="'+C.ink+'" stroke-width="1"')); }
// river
add(P('M0,660 C260,640 420,700 640,676 C860,652 1060,700 1280,676 C1420,662 1520,678 1600,668 L1600,760 C1500,772 1400,752 1280,764 C1060,788 860,742 640,766 C420,790 260,730 0,750 Z','fill="'+C.water+'" stroke="'+C.ink+'" stroke-width="2"'));
for(let i=0;i<26;i++){ add(P('M'+n(rr(40,1560))+','+n(rr(680,745))+' h'+n(rr(20,60)),'stroke="'+C.cream+'" stroke-width="2" opacity="0.45"')); }
// mill (left, on the river)
add(rect(150,560,110,96,C.cream,'stroke="'+C.ink+'" stroke-width="1.6"'));
add(P('M144,560 L205,510 L266,560 Z','fill="'+C.russet+'" stroke="'+C.ink+'" stroke-width="1.6"'));
add(circ(150,566,34,'none','stroke="'+C.russet+'" stroke-width="5"'));
for(let i=0;i<6;i++){ const a=i*1.047; add(P('M150,566 l'+n(Math.cos(a)*30)+','+n(Math.sin(a)*30),'stroke="'+C.russet+'" stroke-width="3"')); }
add(rect(196,610,26,46,C.ink,'opacity="0.6"'));
add(person(238,656,66,{coat:C.verd,hat:C.cream}));
// ---------- the hunt: three depth bands ----------
// band 3 (far)
add(horse(420,300,70,{col:C.russet,rider:{coat:C.rose,hat:C.cream,arm:'up'}}));
add(horse(980,290,66,{col:C.russet,rider:{coat:C.verd,hat:C.gold,arm:'spear'}}));
add(hound(500,330,40)); add(hound(560,344,40)); add(hound(900,330,40));
add(person(700,320,64,{coat:C.rose,hat:C.cream})); add(person(760,330,64,{coat:C.verd,hat:C.rose}));
add(person(1320,310,62,{coat:C.russet,hat:C.cream}));
// band 2 (middle)
add(horse(360,560,120,{col:C.russet,rider:{coat:C.rose,hat:C.gold,arm:'spear'}}));
add(horse(1180,540,116,{col:C.verd,rider:{coat:C.cream,hat:C.rose,arm:'bow'}}));
// falconer at the middle left with a bird leaving the fist
add(person(600,600,120,{coat:C.verd,hat:C.gold,arm:'up'}));
add(P('M660,510 q30,-30 54,-16 q-26,4 -40,22 q-10,10 -14,-6 Z','fill="'+C.cream+'" stroke="'+C.ink+'" stroke-width="1.2"'));
add(P('M700,470 q20,-8 34,4','stroke="'+C.ink+'" stroke-width="1.6" fill="none"'));
add(P('M470,712 l26,-34 l18,10 l-24,34 Z','fill="'+C.cream+'" stroke="'+C.ink+'" stroke-width="1.2"'));
for(let i=0;i<4;i++){ add(hound(760+i*70,720,64)); }
add(person(880,700,110,{coat:C.rose,hat:C.cream,arm:'up'}));
add(person(950,710,110,{coat:C.gold,hat:C.rose}));
// band 1 (foreground, large)
add(stag(520,1050,340,true));
add(hound(360,1090,120)); add(hound(430,1130,120)); add(hound(690,1100,120)); add(hound(760,1150,124));
add(person(880,1150,300,{coat:C.russet,hat:C.gold,arm:'spear'}));
add(person(990,1170,290,{coat:C.rose,hat:C.cream,arm:'bow'}));
// picnic at the lower left
add(poly([[80,1060],[330,1040],[350,1120],[60,1140]],C.cream,'stroke="'+C.ink+'" stroke-width="1.6"'));
add(person(150,1040,170,{coat:C.verd,hat:C.gold,arm:'up'}));
add(person(240,1052,166,{coat:C.rose,hat:C.cream}));
add(person(320,1070,160,{coat:C.gold,hat:C.rose}));
add(ell(220,1090,36,14,C.russet,'stroke="'+C.ink+'" stroke-width="1.2"'));
add(hound(360,1130,70));
// a second stag far right, cropping
add(stag(1420,1010,240,false));
// ---------- hidden animals in the flowers ----------
for(let i=0;i<14;i++){ const x=rr(80,1520), y=rr(200,1160); add(ell(x,y,rr(8,14),rr(5,9), i%3?C.russet:C.cream,'stroke="'+C.ink+'" stroke-width="1"')); add(circ(x+rr(8,14),y-rr(4,8),rr(4,6),i%3?C.russet:C.cream)); }
// ---------- find-it: ten white hares ----------
const hares=[[250,960,54,0],[700,900,44,1],[1080,860,42,2],[1360,700,38,3],[820,470,34,4],[1180,400,30,5],[520,380,30,6],[980,1060,58,7],[1430,600,40,8],[430,640,44,9]];
for(let i=0;i<10;i++){ if(i%2===0){ add(flower(hares[i][0]-14,hares[i][1]+6,20,C.rose)); add(flower(hares[i][0]+16,hares[i][1]-4,16,C.cream)); } add(hare(hares[i][0],hares[i][1],hares[i][2],hares[i][3])); }
// weave + light
add(rect(0,0,W,H,'none','stroke="'+C.ink+'" stroke-width="28"'));
add(rect(28,28,W-56,H-56,'none','stroke="'+C.gold+'" stroke-width="3"'));
add(rect(0,0,W,H,C.gold,'opacity="0.05"'));
add(rect(0,0,W,H,'#000','filter="url(#grain)" opacity="0.13"'));
add('</svg>');
fs.writeFileSync(process.argv[2]||'la-caza.svg',S.join('\n'));
console.log('wrote',(S.join('\n').length/1024).toFixed(1)+'KB',S.length+' elems');