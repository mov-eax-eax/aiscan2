import fs from 'node:fs';
const W=1600,H=1200;
const C={ sky:'#efdcb4', sky2:'#e3cfa2', blue:'#c9d6cf', far:'#8fa08a', green:'#6f8f5a', green2:'#8fae74', greenD:'#4a6440',
  water:'#2e4f7a', waterL:'#6d8fb4', marble:'#f3ead6', marbleD:'#d9cdb2', wall:'#c08a46', wallD:'#9a6a30',
  ink:'#3a2a1e', verm:'#b23a2a', saff:'#d9a23c', rose:'#c97a72', purple:'#6b4b7a', cream:'#f7f0df', brown:'#8a5a34' };
let seed=1606;
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

function persH(y){ return 44 + Math.max(0,y-520)*0.175; }
// ---------- figure primitives (Mughal: turban, jama, sash) ----------
function person(x,y,h,opt){
  opt=opt||{};
  const robe=opt.robe||C.cream, coat=opt.coat||C.rose, tur=opt.turban||C.cream, skin='#d9b58a';
  const hw=h*0.19, leg=h*0.46, head=h*0.13;
  let o='';
  // shadow
  o+=ell(x,y+2,h*0.28,h*0.07,'#3a2a1e','opacity="0.18"');
  // legs (pyjama)
  o+=P('M'+n(x-hw*0.55)+','+n(y)+' L'+n(x-hw*0.45)+','+n(y-leg*0.52)+' M'+n(x+hw*0.55)+','+n(y)+' L'+n(x+hw*0.45)+','+n(y-leg*0.52),'stroke="'+C.cream+'" stroke-width="'+n(h*0.075)+'"'+(opt.dark?'':'')+'');
  o+=P('M'+n(x-hw*0.55)+','+n(y)+' L'+n(x-hw*0.45)+','+n(y-leg*0.52)+' M'+n(x+hw*0.55)+','+n(y)+' L'+n(x+hw*0.45)+','+n(y-leg*0.52),'stroke="'+C.ink+'" stroke-width="1" fill="none" opacity="0.5"');
  // jama (flared coat)
  o+=poly([[x-hw*0.8,y-leg*0.5],[x-hw*0.5,y-leg*0.86],[x+hw*0.5,y-leg*0.86],[x+hw*0.9,y-leg*0.46],[x+hw*0.6,y-leg*0.42],[x-hw*0.55,y-leg*0.42]],coat,'stroke="'+C.ink+'" stroke-width="1.2"');
  o+=P('M'+n(x-hw*0.5)+','+n(y-leg*0.6)+' L'+n(x+hw*0.5)+','+n(y-leg*0.6),'stroke="'+C.saff+'" stroke-width="'+n(h*0.035)+'"');
  // arms
  const arm=opt.arm||'down';
  if(arm==='down'){ o+=P('M'+n(x-hw*0.7)+','+n(y-leg*0.8)+' L'+n(x-hw*0.85)+','+n(y-leg*0.45),'stroke="'+coat+'" stroke-width="'+n(h*0.07)+'"'); o+=P('M'+n(x+hw*0.7)+','+n(y-leg*0.8)+' L'+n(x+hw*0.85)+','+n(y-leg*0.45),'stroke="'+coat+'" stroke-width="'+n(h*0.07)+'"'); }
  if(arm==='up'){ o+=P('M'+n(x-hw*0.7)+','+n(y-leg*0.8)+' L'+n(x-hw*1.15)+','+n(y-leg*0.95),'stroke="'+coat+'" stroke-width="'+n(h*0.07)+'"'); o+=P('M'+n(x+hw*0.7)+','+n(y-leg*0.8)+' L'+n(x+hw*1.1)+','+n(y-leg*1.02),'stroke="'+coat+'" stroke-width="'+n(h*0.07)+'"'); }
  if(arm==='bow'){ o+=P('M'+n(x-hw*0.7)+','+n(y-leg*0.8)+' L'+n(x-hw*1.1)+','+n(y-leg*0.72),'stroke="'+coat+'" stroke-width="'+n(h*0.07)+'"'); o+=P('M'+n(x+hw*0.7)+','+n(y-leg*0.8)+' L'+n(x+hw*0.95)+','+n(y-leg*0.58),'stroke="'+coat+'" stroke-width="'+n(h*0.07)+'"'); }
  if(arm==='tray'){ o+=P('M'+n(x-hw*0.7)+','+n(y-leg*0.8)+' L'+n(x-hw*1.05)+','+n(y-leg*0.66),'stroke="'+coat+'" stroke-width="'+n(h*0.07)+'"'); o+=P('M'+n(x+hw*0.7)+','+n(y-leg*0.8)+' L'+n(x+hw*1.05)+','+n(y-leg*0.66),'stroke="'+coat+'" stroke-width="'+n(h*0.07)+'"'); o+=ell(x,y-leg*0.66,h*0.22,h*0.03,C.saff,'stroke="'+C.ink+'" stroke-width="1"'); }
  // head + turban
  o+=circ(x,y-leg*0.94,head*0.52,skin,'stroke="'+C.ink+'" stroke-width="1.1"');
  o+=P('M'+n(x-head*0.62)+','+n(y-leg*0.94-head*0.18)+' q'+n(head*0.62)+',-'+n(head*0.62)+' '+n(head*1.24)+',0 Z','fill="'+tur+'" stroke="'+C.ink+'" stroke-width="1.1"');
  if(opt.fan){ o+=P('M'+n(x+hw*1.1)+','+n(y-leg*0.9)+' l'+n(h*0.12)+',-'+n(h*0.22)+' M'+n(x+hw*1.1)+','+n(y-leg*0.9)+' l-'+n(h*0.06)+',-'+n(h*0.24),'stroke="'+C.cream+'" stroke-width="2.4"'); }
  return o;
}
function elephant(x,y,h,opt){
  opt=opt||{};
  let o='';
  o+=ell(x,y+3,h*0.42,h*0.08,'#3a2a1e','opacity="0.2"');
  o+=ell(x,y-h*0.42,h*0.36,h*0.30,'#9aa0a8','stroke="'+C.ink+'" stroke-width="1.6"');
  o+=ell(x-h*0.40,y-h*0.46,h*0.19,h*0.17,'#9aa0a8','stroke="'+C.ink+'" stroke-width="1.6"');
  o+=P('M'+n(x-h*0.50)+','+n(y-h*0.50)+' q-'+n(h*0.10)+','+n(h*0.22)+' '+n(h*0.02)+','+n(h*0.40),'stroke="#9aa0a8" stroke-width="'+n(h*0.08)+'" fill="none" stroke-linecap="round"');
  o+=ell(x-h*0.30,y-h*0.50,h*0.13,h*0.12,'#8b9199','stroke="'+C.ink+'" stroke-width="1.4"');
  o+=circ(x-h*0.46,y-h*0.52,h*0.025,C.ink);
  for(let i=0;i<4;i++){ const lx=x-h*0.26+i*h*0.17; o+=rect(lx-4,y-h*0.22,h*0.09,h*0.24,'#9aa0a8','stroke="'+C.ink+'" stroke-width="1.3"'); }
  o+=ell(x-h*0.12,y-h*0.20,h*0.09,h*0.05,C.verm,'stroke="'+C.ink+'" stroke-width="1.2"');
  o+=P('M'+n(x+h*0.32)+','+n(y-h*0.5)+' q'+n(h*0.08)+',-'+n(h*0.06)+' '+n(h*0.1)+',-'+n(h*0.16),'stroke="#9aa0a8" stroke-width="'+n(h*0.04)+'" fill="none"');
  if(opt.howdah){
    o+=rect(x-h*0.22,y-h*0.82,h*0.44,h*0.13,C.saff,'stroke="'+C.ink+'" stroke-width="1.6"');
    o+=P('M'+n(x-h*0.26)+','+n(y-h*0.84)+' q'+n(h*0.24)+',-'+n(h*0.13)+' '+n(h*0.52)+',0','fill="'+C.verm+'" stroke="'+C.ink+'" stroke-width="1.6"');
    o+=person(x+h*0.03,y-h*0.86,h*0.40,{coat:C.purple,turban:C.cream});
    o+=person(x-h*0.16,y-h*0.86,h*0.30,{coat:C.greenD,turban:C.saff});
  }
  // caparison
  o+=P('M'+n(x-h*0.28)+','+n(y-h*0.56)+' q'+n(h*0.28)+',-'+n(h*0.1)+' '+n(h*0.56)+',0','fill="'+C.verm+'" stroke="'+C.ink+'" stroke-width="1.4" opacity="0.9"');
  return o;
}
function cypress(x,y,h){
  return ell(x,y-h*0.5,h*0.11,h*0.5,C.greenD,'stroke="'+C.ink+'" stroke-width="1.1"')+rect(x-2,y-4,4,h*0.1,C.brown);
}
function drone(x,y,s){
  const o=[];
  o.push(ell(x,y,s*0.9,s*0.26,C.ink));
  o.push(P('M'+n(x-s*0.2)+','+n(y)+' q'+n(s*0.7)+',-'+n(s*0.9)+' '+n(s*1.5)+',-'+n(s*0.55),'stroke="'+C.ink+'" stroke-width="'+n(s*0.32)+'" fill="none" stroke-linecap="round"'));
  o.push(P('M'+n(x-s*0.2)+','+n(y)+' q'+n(s*0.7)+','+n(s*0.9)+' '+n(s*1.5)+','+n(s*0.55),'stroke="'+C.ink+'" stroke-width="'+n(s*0.32)+'" fill="none" stroke-linecap="round"'));
  o.push(P('M'+n(x+s*0.6)+','+n(y)+' l'+n(s*0.7)+','+n(-s*0.2),'stroke="'+C.ink+'" stroke-width="'+n(s*0.26)+'"'));
  o.push(circ(x-s*0.55,y-s*0.1,s*0.22,'none','stroke="'+C.ink+'" stroke-width="'+n(s*0.1)+'"'));
  o.push(circ(x-s*0.55,y+s*0.16,s*0.16,'none','stroke="'+C.ink+'" stroke-width="'+n(s*0.1)+'"'));
  return o.join('');
}

add('<?xml version="1.0" encoding="UTF-8"?>');
add('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 '+W+' '+H+'" width="'+W+'" height="'+H+'">');
add('<defs>');
add('<filter id="grain" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">');
add('<feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="3" seed="31" stitchTiles="stitch"/>');
add('<feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0.28 0.28 0.28 0 0"/>');
add('</filter>');
add('<pattern id="parterre" width="54" height="54" patternUnits="userSpaceOnUse">');
add(rect(0,0,54,54,C.green2));
add(circ(13,13,3.2,C.cream)); add(circ(40,27,2.6,C.rose)); add(circ(16,40,2.6,C.saff)); add(P('M30,44 l3,5 l-3,5 l-3,-5 Z','fill="'+C.cream+'" opacity="0.8"'));
add(P('M0,54 L54,0','stroke="'+C.greenD+'" stroke-width="1" opacity="0.35"'));
add('</pattern>');
add('</defs>');

// ---------- 1. sky ----------
add(rect(0,0,W,540,C.sky));
add(rect(0,0,W,180,C.blue));
add(rect(0,180,W,90,C.sky2));
add(rect(0,270,W,60,C.sky,'opacity="0.7"'));
for(let i=0;i<16;i++){ const x=rr(0,W), y=rr(30,300); add(ell(x,y,rr(60,150),rr(8,16),C.cream,'opacity="0.5"')); }
// ---------- 2. background: trees, wall, distant dome ----------
for(let i=0;i<30;i++){ const x=rr(-40,1660), y=rr(420,540), r=rr(46,104); add(ell(x,y, r*1.5, r*0.8, i%2?'#6f8a66':'#5d7a58','opacity="0.98"')); }
add(rect(0,500,W,40,'#4f6a4a','opacity="0.35"'));
add(rect(0,486,W,52,'#a8712f'));
add(rect(0,486,W,8,C.wallD));
for(let i=0;i<40;i++){ add(rect(i*41+6,470,20,18,C.wall,'stroke="'+C.wallD+'" stroke-width="1"')); }
add(rect(700,420,200,70,C.marble,'stroke="'+C.wallD+'" stroke-width="2"'));
add(ell(800,420,100,54,C.marble,'stroke="'+C.wallD+'" stroke-width="2"'));
add(rect(792,336,16,50,C.marbleD)); add(circ(800,332,10,C.saff));
add(rect(660,300,14,120,C.marbleD)); add(circ(667,294,9,C.saff)); add(rect(926,300,14,120,C.marbleD)); add(circ(933,294,9,C.saff));
// ---------- 3. the garden ground: four quadrants ----------
add(poly([[0,530],[1600,530],[1600,1200],[0,1200]],C.green));
// quadrants: Q1 lower-left, Q2 upper-left, Q3 upper-right, Q4 lower-right
const chW=54, chY=860;
add(poly([[70,548],[1530,548],[1530,808],[70,808]],'url(#parterre)'));
add(poly([[70,912],[700,912],[700,1180],[70,1180]],'url(#parterre)'));
add(poly([[900,912],[1530,912],[1530,1180],[900,1180]],'url(#parterre)'));
// the empty fourth quadrant: bare earth, one flower bed
add(poly([[900,912],[1530,912],[1530,1180],[900,1180]],'#a89a6a'));
add(poly([[1100,990],[1290,990],[1290,1110],[1100,1110]],'#b5a674','stroke="'+C.brown+'" stroke-width="2"'));
for(let i=0;i<9;i++){ add(circ(1120+i*20,1020+((i%3)*40),5,C.rose)); }
// the fourth quadrant holds exactly one person
add(person(1214,1130,persH(1130),{coat:C.cream,turban:C.verm,arm:'bow'}));
add(ell(1190,1132,22,8,C.wallD,'opacity="0.35"'));
// channels
add(rect(700,530,200,670,C.water));
add(rect(70,808,1530,104,C.water));
add(rect(700,530,200,670,'none','stroke="'+C.marbleD+'" stroke-width="6"'));
add(rect(70,808,1530,104,'none','stroke="'+C.marbleD+'" stroke-width="6"'));
for(let i=0;i<22;i++){ add(P('M'+n(710+rr(0,170))+','+n(560+i*30)+' h'+n(rr(20,60)),'stroke="'+C.waterL+'" stroke-width="3" opacity="0.55"')); }
for(let i=0;i<16;i++){ add(P('M'+n(90+i*95)+','+n(825+rr(0,70))+' h'+n(rr(30,60)),'stroke="'+C.waterL+'" stroke-width="3" opacity="0.5"')); }
// central fountain
add(circ(800,860,64,C.marbleD,'stroke="'+C.ink+'" stroke-width="2"'));
add(circ(800,860,50,C.water,'stroke="'+C.marble+'" stroke-width="2"'));
for(let i=0;i<4;i++){ const a=Math.PI*0.25+i*Math.PI*0.5; add(P('M800,856 q'+n(Math.cos(a)*16)+',-34 '+n(Math.cos(a)*26)+',-52','stroke="'+C.waterL+'" stroke-width="3.5" fill="none"')); }
for(let i=0;i<14;i++){ const a=rr(0,6.28), r=rr(18,54); add(circ(800+Math.cos(a)*r,842+Math.sin(a)*r*0.5,2.2,C.waterL)); }
add(circ(800,860,16,C.marbleD)); add(circ(800,848,7,C.waterL));
// cypresses along the channels
for(let i=0;i<5;i++){ add(cypress(120+i*130,806,110)); add(cypress(1480-i*120,806,110)); }
for(let i=0;i<4;i++){ add(cypress(660,600+i*70,90)); add(cypress(940,600+i*70,90)); }

// ---------- 4. marble terrace + chhatri at the back centre ----------
add(rect(520,478,560,80,C.marble,'stroke="'+C.marbleD+'" stroke-width="3"'));
add(rect(520,540,560,14,C.marbleD));
for(let i=0;i<11;i++){ add(rect(526+i*50,552,38,16,C.marble,'stroke="'+C.marbleD+'" stroke-width="1.2"')); }
add(rect(700,556,200,12,C.marble,'stroke="'+C.marbleD+'" stroke-width="1.5"'));
add(rect(716,568,168,12,C.marble,'stroke="'+C.marbleD+'" stroke-width="1.5"'));
add(rect(732,580,136,12,C.marble,'stroke="'+C.marbleD+'" stroke-width="1.5"'));
// balustrade posts
for(let i=0;i<12;i++){ const bx=528+i*50; add(rect(bx,462,8,18,C.marbleD)); }
// chhatri: plinth, four pillars, cornice, dome, finial
add(rect(646,470,308,14,C.marbleD));
for(let i=0;i<4;i++){ const px=664+i*88; add(rect(px,352,16,118,C.marble,'stroke="'+C.marbleD+'" stroke-width="2"')); add(rect(px-5,352,26,9,C.marbleD)); add(rect(px-5,462,26,9,C.marbleD)); }
add(rect(652,330,296,24,C.marble,'stroke="'+C.marbleD+'" stroke-width="2"'));
add(rect(676,314,248,18,C.marbleD));
add(P('M676,314 Q800,226 924,314 Z','fill="'+C.marbleD+'" stroke="'+C.marble+'" stroke-width="2"'));
add(P('M700,314 Q800,250 900,314','fill="none" stroke="'+C.marble+'" stroke-width="2" opacity="0.8"'));
add(P('M676,314 Q800,226 924,314','fill="none" stroke="'+C.saff+'" stroke-width="2.5" opacity="0.8"'));
add(rect(794,236,12,22,C.saff)); add(circ(800,232,7,C.verm)); add(P('M800,214 v-10','stroke="'+C.saff+'" stroke-width="2"'));
// ruler on the terrace
add(person(800,548,150,{coat:C.purple,turban:C.saff,robe:C.cream}));
add(person(742,548,120,{coat:C.verm,turban:C.cream,arm:'up',fan:true}));
add(person(858,548,120,{coat:C.verm,turban:C.cream,arm:'up',fan:true}));
add(person(660,548,108,{coat:C.greenD,turban:C.cream}));
add(person(940,548,108,{coat:C.greenD,turban:C.cream}));

// ---------- 5. crowd masses ----------
// Q2 (upper left): courtiers
for(let i=0;i<12;i++){ const x=150+(i%4)*130+rr(-14,14), y=660+Math.floor(i/4)*58; add(person(x,y,persH(y),{coat:i%3===0?C.rose:C.cream,turban:i%2?C.saff:C.cream,arm:i%4===0?'bow':'down',fan:i%3===0})); }
for(let i=0;i<3;i++){ const y=700+i*54; add(person(110,y,persH(y),{coat:C.greenD,turban:C.verm})); }
// Q3 (upper right): musicians on a carpet + dancers
add(poly([[960,760],[1420,760],[1440,800],[940,800]],C.verm,'stroke="'+C.ink+'" stroke-width="1.5"'));
for(let i=0;i<4;i++){ add(person(1010+i*70,762,persH(762),{coat:C.saff,turban:C.cream,arm:'up'})); }
add(person(1330,762,persH(762),{coat:C.purple,turban:C.rose,arm:'up'}));
add(person(1390,762,persH(762),{coat:C.purple,turban:C.rose,arm:'up'}));
add(person(1240,752,persH(752),{coat:C.rose,turban:C.verm,arm:'up'}));
// Q1 (lower left): servants + trays, one dropping a tray
for(let i=0;i<5;i++){ const y=1100+i*14; add(person(190+i*100,y,persH(y),{coat:C.cream,turban:C.saff,arm:'tray'})); }
add(person(660,1080,persH(1080),{coat:C.cream,turban:C.verm,arm:'up'}));
add(ell(700,1052,90,14,C.saff,'stroke="'+C.ink+'" stroke-width="1.4"'));
add(ell(742,1092,26,10,C.saff,'stroke="'+C.ink+'" stroke-width="1.2"'));
add(circ(736,1090,5,C.cream)); add(circ(752,1094,5,C.cream));
add(person(560,1040,persH(1040),{coat:C.rose,turban:C.cream}));
add(person(500,1010,persH(1010),{coat:C.purple,turban:C.cream}));
// elephants near the wall at the left
add(elephant(300,980,persH(980)*2.1,{howdah:true}));
add(elephant(1120,930,persH(930)*2.1,{howdah:true}));
// guards along the wall
for(let i=0;i<6;i++){ add(person(180+i*230,566,persH(566),{coat:C.verm,turban:C.saff,arm:'up'})); }
// children
for(let i=0;i<4;i++){ const y=880+i*10; add(person(400+i*70,y,persH(y)*0.55,{coat:C.cream,turban:C.rose})); }

// ---------- 6. incidents ----------
// a courtier bowing before the terrace steps
add(person(1080,820,persH(820),{coat:C.cream,turban:C.saff,arm:'bow'}));
// peacocks
[[1420,1140],[880,1150]].forEach(function(p){ add(ell(p[0],p[1]-24,30,18,'#2f6b8a','stroke="'+C.ink+'" stroke-width="1.4"')); add(circ(p[0]+24,p[1]-38,9,'#2f6b8a','stroke="'+C.ink+'" stroke-width="1.4"')); add(P('M'+n(p[0]+30)+','+n(p[1]-42)+' l6,-4','stroke="'+C.saff+'" stroke-width="2"')); add(P('M'+n(p[0]-14)+','+n(p[1]-8)+' q-30,10 -40,30','stroke="'+C.saff+'" stroke-width="1.6" fill="none"')); });
// monkeys on the wall
for(let i=0;i<3;i++){ const x=520+i*260; add(ell(x,470,10,7,C.brown)); add(circ(x+9,464,5,C.brown)); add(P('M'+n(x-8)+','+n(470)+' q-10,6 -4,12','stroke="'+C.brown+'" stroke-width="2" fill="none"')); }
// a horse at the gate
add(ell(660,530,46,24,C.brown,'stroke="'+C.ink+'" stroke-width="1.4"')); add(circ(700,514,12,C.brown,'stroke="'+C.ink+'" stroke-width="1.4"'));
add(P('M636,548 v26 M676,548 v26 M660,548 v26 M690,548 v26','stroke="'+C.brown+'" stroke-width="5"'));

// ---------- 6b. foreground plane: large, cropped ----------
add(person(150,1330,300,{coat:'#3f5a3a',turban:C.cream,arm:'up'}));
add(person(1470,1340,310,{coat:C.verm,turban:C.saff,arm:'bow'}));
add(person(1560,1330,300,{coat:C.purple,turban:C.cream}));
add(person(860,1360,320,{coat:'#3f5a3a',turban:C.verm,arm:'tray'}));
add(cypress(60,1250,460));
add(cypress(1560,1240,440));
add(rect(0,1150,W,50,'#3a2a1e','opacity="0.12"'));
// ---------- 7. light and atmosphere ----------
add(rect(0,0,W,540,C.cream,'opacity="0.10"'));
add(rect(0,470,W,120,C.cream,'opacity="0.12"'));
add(ell(800,560,560,200,C.saff,'opacity="0.10"'));
add(rect(0,0,W,H,'none','stroke="'+C.ink+'" stroke-width="26"'));
add(rect(26,26,W-52,H-52,'none','stroke="'+C.saff+'" stroke-width="4"'));

// ---------- 8. find-it: eight drones disguised as birds ----------
const dronesX=[210,430,620,790,960,1130,1290,1460];
const dronesY=[128,86,150,70,196,110,250,168];
for(let i=0;i<8;i++){ add(drone(dronesX[i],dronesY[i],11+((i*3)%5))); }

add(rect(0,0,W,H,'#000','filter="url(#grain)" opacity="0.10"'));
add('</svg>');
fs.writeFileSync(process.argv[2]||'el-jardin.svg',S.join('\n'));
console.log('wrote',(S.join('\n').length/1024).toFixed(1)+'KB',S.length+' elems');