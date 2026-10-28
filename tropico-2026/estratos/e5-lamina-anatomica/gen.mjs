import fs from 'node:fs';
const W=1200,H=1600;
const C={ pap:'#efe6d2', ink:'#2a2119', sep:'#a9834f', red:'#a83a2c', blu:'#35597f' };
let seed=1834;
function rnd(){ seed=(seed*1664525+1013904223)%4294967296; return seed/4294967296; }
function rr(a,b){ return a+(b-a)*rnd(); }
const n=(v)=>Math.round(v*100)/100;
const S=[]; const add=(s)=>S.push(s);
function P(d,a){ return '<path d="'+d+'"'+(a?' '+a:'')+'/>'; }
function rect(x,y,w,h,f,a){ return '<rect x="'+n(x)+'" y="'+n(y)+'" width="'+n(w)+'" height="'+n(h)+'" fill="'+(f||'none')+'"'+(a?' '+a:'')+'/>'; }
function circ(cx,cy,r,f,a){ return '<circle cx="'+n(cx)+'" cy="'+n(cy)+'" r="'+n(r)+'" fill="'+(f||'none')+'"'+(a?' '+a:'')+'/>'; }
function L(x1,y1,x2,y2,a){ return '<line x1="'+n(x1)+'" y1="'+n(y1)+'" x2="'+n(x2)+'" y2="'+n(y2)+'"'+(a?' '+a:'')+'/>'; }
function poly(pts,f,a){ return P('M'+pts.map(p=>n(p[0])+','+n(p[1])).join(' L')+' Z',(f?'fill="'+f+'" ':'')+(a||'')); }
const ST=(w)=>({stroke:C.ink,'stroke-width':w,fill:'none','stroke-linecap':'round','stroke-linejoin':'round'});
function sattr(o){ return Object.keys(o).map(k=>k+'="'+o[k]+'"').join(' '); }

// ---------- engraved numerals (seven-segment, drawn as paths) ----------
const SEG={a:[[4,0],[20,0]],b:[[22,2],[22,19]],c:[[22,21],[22,38]],d:[[4,40],[20,40]],e:[[2,21],[2,38]],f:[[2,2],[2,19]],g:[[4,20],[20,20]]};
const DIG={0:'abcdef',1:'bc',2:'abged',3:'abgcd',4:'fgbc',5:'afgcd',6:'afgecd',7:'abc',8:'abcdefg',9:'abcdfg'};
function num(x,y,s,numstr,col,w){
  let o='';
  for(let i=0;i<numstr.length;i++){
    const ch=numstr[i]; let d='';
    for(const seg of DIG[ch]){ const sg=SEG[seg]; d+='M'+n(sg[0][0]*s)+','+n(sg[0][1]*s)+' L'+n(sg[1][0]*s)+','+n(sg[1][1]*s)+' '; }
    o+=P('M'+n(x+i*24*s)+','+n(y)+' '+'','');
    o+= '<g transform="translate('+n(x+i*24*s)+','+n(y)+')">'+P(d,'stroke="'+col+'" stroke-width="'+n(2.6*s)+'" fill="none" stroke-linecap="square"')+'</g>';
  }
  return o;
}

add('<?xml version="1.0" encoding="UTF-8"?>');
add('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 '+W+' '+H+'" width="'+W+'" height="'+H+'">');
add('<defs>');
add('<filter id="grain" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">');
add('<feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="3" seed="12" stitchTiles="stitch"/>');
add('<feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0.26 0.26 0.26 0 0"/>');
add('</filter>');
add('</defs>');
add(rect(0,0,W,H,C.pap));

// ---------- plate border ----------
add(rect(36,36,1128,1528,'none','stroke="'+C.ink+'" stroke-width="4"'));
add(rect(46,46,1108,1508,'none','stroke="'+C.ink+'" stroke-width="1.4"'));
add(rect(54,54,1092,1492,'none','stroke="'+C.ink+'" stroke-width="0.9"'));
// title cartouche
add(rect(360,28,480,44,C.pap,'stroke="'+C.ink+'" stroke-width="2"'));
add(P('M372,50 h456','stroke="'+C.ink+'" stroke-width="1" opacity="0.6"'));
add(circ(600,50,9,'none','stroke="'+C.ink+'" stroke-width="1.6"'));
add(P('M600,41 v18 M591,50 h18','stroke="'+C.ink+'" stroke-width="1.2"'));

// ---------- ground hatching ----------
let hat='';
for(let i=0;i<150;i++){ const y=70+i*9.6; hat+=L(70,y,1130,y,'stroke="'+C.sep+'" stroke-width="0.8" opacity="0.30"'); }
add(hat);
// nervous grid behind everything
let grid='';
for(let gx=0;gx<18;gx++){ const x=270+gx*40; grid+=L(x,240,x,1090,'stroke="'+C.ink+'" stroke-width="0.9" opacity="0.22"'); }
for(let gy=0;gy<22;gy++){ const y=250+gy*40; grid+=L(260,y,950,y,'stroke="'+C.ink+'" stroke-width="0.9" opacity="0.22"'); }
for(let gx=0;gx<18;gx++){ for(let gy=0;gy<22;gy++){ if((gx+gy)%3===0) grid+=rect(270+gx*40-2.4,250+gy*40-2.4,4.8,4.8,C.ink,'opacity="0.35"'); } }
add(grid);

// ---------- the forty stations on a standing body, and their leaders ----------
// 40 terminals on a body that is never drawn
const anchors=[[600,236],[560,244],[522,268],[506,304],[524,330],[560,344],[600,348],[640,344],[676,330],[694,304],[678,268],[640,244],[556,362],[644,362],[506,392],[694,392],[482,432],[718,432],[470,492],[730,492],[462,552],[738,552],[458,612],[742,612],[470,640],[730,640],[540,400],[660,400],[528,478],[672,478],[532,566],[668,566],[522,668],[678,668],[528,748],[672,748],[544,860],[656,860],[540,980],[660,980]];
const spiral=[];
for(let i=1;i<=40;i++){ const th=0.62*i+0.4, r=262+6.0*i; spiral.push([600+Math.cos(th)*r, 620+Math.sin(th)*r]); }
let lead='';
for(let i=0;i<40;i++){ lead+=P('M'+n(spiral[i][0])+','+n(spiral[i][1])+' L'+n(anchors[i][0])+','+n(anchors[i][1]),'stroke="'+C.ink+'" stroke-width="0.7" opacity="0.28"'); }
add(lead);
// ---------- exploded machine ----------
add('<g transform="translate(600,620) scale(0.92) translate(-600,-620)">');
const cx=600;
// boiler-cranium
add(P('M'+n(cx-92)+',330 A92,92 0 0 1 '+n(cx+92)+',330 L'+n(cx+92)+',352 L'+n(cx-92)+',352 Z','fill="'+C.pap+'" stroke="'+C.ink+'" stroke-width="2.4"'));
for(let i=0;i<12;i++){ const a=Math.PI+ i*Math.PI/11; add(circ(cx+Math.cos(a)*78, 330+Math.sin(a)*78, 3.4, C.ink)); }
add(rect(cx-104,352,208,16,C.ink));
add(rect(cx-16,238,32,34,'none','stroke="'+C.ink+'" stroke-width="2"'));
add(circ(cx,236,10,'none','stroke="'+C.ink+'" stroke-width="2.2"'));
add(P('M'+n(cx-10)+',236 h20 M'+n(cx)+',226 v20','stroke="'+C.ink+'" stroke-width="1.4"'));
add(circ(cx-58,300,18,'none','stroke="'+C.ink+'" stroke-width="1.8"'));
add(P('M'+n(cx-58)+',300 l10,-9','stroke="'+C.red+'" stroke-width="2"'));
for(let i=0;i<12;i++){ const a=i*Math.PI/6; add(L(cx-58+Math.cos(a)*14,300+Math.sin(a)*14,cx-58+Math.cos(a)*18,300+Math.sin(a)*18,'stroke="'+C.ink+'" stroke-width="1"')); }
// spine
for(let i=0;i<8;i++){ const y=372+i*38; add(rect(cx-13,y,26,30,'none','stroke="'+C.ink+'" stroke-width="1.8"')); add(P('M'+n(cx-20)+','+n(y+34)+' h40','stroke="'+C.ink+'" stroke-width="1.2"')); }
// rib struts
for(let i=0;i<6;i++){ const y=430+i*38; add(P('M'+n(cx-20)+','+n(y)+' q -70,'+n(8+i*6)+' -128,'+n(30+i*12),'fill="none" stroke="'+C.ink+'" stroke-width="3.4"')); add(P('M'+n(cx-20)+','+n(y+6)+' q -66,'+n(8+i*6)+' -120,'+n(28+i*12),'fill="none" stroke="'+C.ink+'" stroke-width="1" opacity="0.55"')); add(P('M'+n(cx+20)+','+n(y)+' q 70,'+n(8+i*6)+' 128,'+n(30+i*12),'fill="none" stroke="'+C.ink+'" stroke-width="3.4"')); add(P('M'+n(cx+20)+','+n(y+6)+' q 66,'+n(8+i*6)+' 120,'+n(28+i*12),'fill="none" stroke="'+C.ink+'" stroke-width="1" opacity="0.55"')); }
// lungs / filter drums
[[470,470],[730,470]].forEach(function(f){
  add(rect(f[0]-58,f[1]-64,116,128,C.pap,'stroke="'+C.ink+'" stroke-width="2.2" rx="18"'));
  for(let i=0;i<7;i++){ add(P('M'+n(f[0]-48+i*16)+','+n(f[1]-50)+' v100','stroke="'+C.ink+'" stroke-width="1.1" opacity="0.8"')); }
  for(let i=0;i<14;i++){ add(P('M'+n(f[0]-54+i*8)+','+n(f[1]+58)+' l'+n(6)+','+n(-26-((i%4)*6)),'stroke="'+C.ink+'" stroke-width="0.55" opacity="0.45"')); }
  for(let i=0;i<5;i++){ add(P('M'+n(f[0]-48)+','+n(f[1]-46+i*24)+' h96','stroke="'+C.ink+'" stroke-width="0.9" opacity="0.7"')); }
  add(circ(f[0],f[1]-64,12,'none','stroke="'+C.ink+'" stroke-width="2"'));
  add(P('M'+n(f[0]-58)+','+n(f[1]+20)+' q -30,10 -44,34','fill="none" stroke="'+C.ink+'" stroke-width="2"'));
  add(P('M'+n(f[0])+','+n(f[1]-76)+' q 0,-24 -18,-34','fill="none" stroke="'+C.ink+'" stroke-width="2.2"'));
  add(circ(f[0]-20,f[1]-112,7,'none','stroke="'+C.red+'" stroke-width="1.8"'));
  for(let i=0;i<5;i++){ add(P('M'+n(f[0]-46+i*2)+','+n(f[1]+44+i*7)+' q 46,-10 92,0','fill="none" stroke="'+C.ink+'" stroke-width="1.6"')); }
});
// heart pump
add(P('M'+n(cx)+',724 C'+n(cx-82)+',706 '+n(cx-100)+',616 '+n(cx-58)+',578 C'+n(cx-26)+',550 '+n(cx-6)+',566 '+n(cx)+',594 C'+n(cx+6)+',566 '+n(cx+26)+',550 '+n(cx+58)+',578 C'+n(cx+100)+',616 '+n(cx+82)+',706 '+n(cx)+',724 Z','fill="'+C.pap+'" stroke="'+C.ink+'" stroke-width="2.6"'));
add(P('M'+n(cx-40)+',600 q 26,30 16,70','fill="none" stroke="'+C.red+'" stroke-width="2.4" opacity="0.8"'));
for(let i=0;i<9;i++){ add(P('M'+n(cx-60+i*8)+',700 l'+n(10+i)+','+n(-120+i*4),'stroke="'+C.ink+'" stroke-width="0.8" opacity="0.45"')); }
add(circ(cx-22,600,13,'none','stroke="'+C.ink+'" stroke-width="2"')); add(circ(cx+22,586,13,'none','stroke="'+C.ink+'" stroke-width="2"'));
add(P('M'+n(cx-22)+',600 l9,-7 l-9,-7 M'+n(cx+22)+',586 l-9,-7 l9,-7','fill="none" stroke="'+C.ink+'" stroke-width="1.6"'));
add(P('M'+n(cx-14)+',556 V500 M'+n(cx+14)+',556 V500','stroke="'+C.ink+'" stroke-width="2.4"'));
add(rect(cx-24,492,48,10,C.ink));
add(P('M'+n(cx-24)+',492 q -44,-10 -62,-40 M'+n(cx+24)+',492 q 44,-10 62,-40','fill="none" stroke="'+C.ink+'" stroke-width="2"'));
// gauge
add(circ(cx+96,640,26,C.pap,'stroke="'+C.ink+'" stroke-width="2.2"'));
for(let i=0;i<12;i++){ const a=i*Math.PI/6; add(L(cx+96+Math.cos(a)*18,640+Math.sin(a)*18,cx+96+Math.cos(a)*23,640+Math.sin(a)*23,'stroke="'+C.ink+'" stroke-width="1.2"')); }
add(P('M'+n(cx+96)+',640 l14,-11','stroke="'+C.red+'" stroke-width="2"'));
add(P('M'+n(cx+70)+',640 h-14','stroke="'+C.ink+'" stroke-width="2"'));
// bellows
for(let i=0;i<5;i++){ add(P('M'+n(cx-34+i*2)+','+n(722+i*18)+' q 34,-12 68,0','fill="none" stroke="'+C.ink+'" stroke-width="2.2"')); }
add(rect(cx-38,812,76,16,C.ink));
// pelvis yoke
add(P('M'+n(cx-86)+',828 q 86,44 172,0','fill="none" stroke="'+C.ink+'" stroke-width="3"'));
add(P('M'+n(cx-86)+',828 v22 M'+n(cx+86)+',828 v22','stroke="'+C.ink+'" stroke-width="2"'));
// legs
[[-52,0],[52,0]].forEach(function(o){
  const x=cx+o[0];
  add(rect(x-22,850,44,66,C.pap,'stroke="'+C.ink+'" stroke-width="2"'));
  add(circ(x,940,16,'none','stroke="'+C.ink+'" stroke-width="2"'));
  add(rect(x-20,960,40,84,C.pap,'stroke="'+C.ink+'" stroke-width="2"'));
  add(rect(x-20,1044,40,26,'none','stroke="'+C.ink+'" stroke-width="2"'));
  add(P('M'+n(x-20)+',1070 h-14 v14 h34 v-14 h-6','fill="none" stroke="'+C.ink+'" stroke-width="2"'));
  add(P('M'+n(x-20)+',900 h40','stroke="'+C.ink+'" stroke-width="1.2"'));
});
// arms
[[-1,0],[1,0]].forEach(function(o){
  const s=o[0];
  add(rect(cx+s*96-16,398,32,70,C.pap,'stroke="'+C.ink+'" stroke-width="2"'));
  add(circ(cx+s*104,486,14,'none','stroke="'+C.ink+'" stroke-width="2"'));
  add(rect(cx+s*108-14,500,28,72,C.pap,'stroke="'+C.ink+'" stroke-width="2"'));
  add(P('M'+n(cx+s*108-14)+','+n(572)+' l-8,18 h30 l-8,-18','fill="none" stroke="'+C.ink+'" stroke-width="2"'));
  add(P('M'+n(cx+s*80)+',404 q '+n(s*26)+',20 '+n(s*30)+',40','fill="none" stroke="'+C.ink+'" stroke-width="1.6" opacity="0.7"'));
});
// plinth
add(rect(cx-140,1112,280,26,C.ink));
add(rect(cx-124,1138,248,12,C.pap,'stroke="'+C.ink+'" stroke-width="1.6"'));
for(let i=0;i<6;i++){ add(circ(cx-100+i*40,1125,4,C.pap)); }
// exploded axes
add(P('M'+n(cx)+',210 v910','stroke="'+C.blu+'" stroke-width="1" stroke-dasharray="10 5 2 5" opacity="0.55"'));
add(P('M'+n(cx-150)+',560 h300','stroke="'+C.blu+'" stroke-width="1" stroke-dasharray="10 5 2 5" opacity="0.45"'));
// engraved shadow: cross-hatch under the machine
let shadow='';
for(let i=0;i<26;i++){ const y=880+i*12; shadow+=L(360+((i%3)*6),y,840-((i%4)*8),y,'stroke="'+C.ink+'" stroke-width="0.7" opacity="0.30"'); }
for(let i=0;i<16;i++){ const x=380+i*28; shadow+=L(x,1000,x+22,1120,'stroke="'+C.ink+'" stroke-width="0.6" opacity="0.24"'); }
add(shadow);
add('</g>');

// ---------- forty fittings on the hidden body ----------
function fitting(x,y,k,inv){
  let o='';
  const r=11;
  if(k===0){ o+=circ(x,y,r,'none','stroke="'+C.ink+'" stroke-width="1.8"')+P('M'+n(x-r)+','+n(y)+' h'+n(2*r)+' M'+n(x)+','+n(y-r)+' v'+n(2*r),'stroke="'+C.ink+'" stroke-width="1.5"'); }
  if(k===1){ o+=poly([[x,y-r],[x+r*0.87,y-r/2],[x+r*0.87,y+r/2],[x,y+r],[x-r*0.87,y+r/2],[x-r*0.87,y-r/2]],'none','stroke="'+C.ink+'" stroke-width="1.8"')+circ(x,y,3.4,C.ink); }
  if(k===2){ o+=circ(x,y,r,'none','stroke="'+C.ink+'" stroke-width="1.8"')+P('M'+n(x)+','+n(y)+' l'+n(r*0.6)+','+n(-r*0.5),'stroke="'+C.red+'" stroke-width="1.6"'); }
  if(k===3){ let d='M'+n(x-r)+','+n(y)+' l4,-7 l5,14 l5,-14 l5,14 l4,-7'; o+=P(d,'fill="none" stroke="'+C.ink+'" stroke-width="1.6"'); }
  if(k===4){ o+=rect(x-6,y-6,12,12,'none','stroke="'+C.ink+'" stroke-width="1.8"')+P('M'+n(x-10)+','+n(y)+' h4 M'+n(x+6)+','+n(y)+' h4 M'+n(x)+','+n(y-10)+' v4 M'+n(x)+','+n(y+6)+' v4','stroke="'+C.ink+'" stroke-width="1.4"'); }
  if(k===5){ o+=circ(x,y,r,'none','stroke="'+C.ink+'" stroke-width="1.8"')+circ(x,y,r*0.55,'none','stroke="'+C.ink+'" stroke-width="1.2"'); }
  if(inv){ o='<g transform="rotate(180 '+n(x)+' '+n(y)+')">'+o+'</g><circle cx="'+n(x)+'" cy="'+n(y)+'" r="15" fill="none" stroke="'+C.red+'" stroke-width="1.4" stroke-dasharray="3 3"/>'; }
  return o;
}

for(let i=0;i<40;i++){ add(fitting(anchors[i][0],anchors[i][1],i%6,(i===20))); add(circ(anchors[i][0],anchors[i][1],3,C.ink)); }
// numbers on the spiral
// faint dotted spiral through the stations
add(P('M'+spiral.map(p=>n(p[0])+','+n(p[1])).join(' L'),'fill="none" stroke="'+C.ink+'" stroke-width="0.8" stroke-dasharray="2 7" opacity="0.5"'));
for(let i=0;i<40;i++){
  const px=spiral[i][0], py=spiral[i][1];
  add(circ(px,py,21,C.pap,'stroke="'+C.ink+'" stroke-width="1.5"'));
  const s=(i+1)<10?0.62:0.46;
  const w=(i+1)<10?24*0.62:48*0.46;
  add(num(px-w/2, py-20*s*1.05, s, String(i+1), C.ink, 1));
}

// ---------- the key: forty cells on a rectangular spiral ----------
add(L(80,1168,1120,1168,'stroke="'+C.ink+'" stroke-width="1.6"'));
add(L(80,1180,1120,1180,'stroke="'+C.ink+'" stroke-width="0.8"'));
const COLS=10, ROWS=4, cw=100, ch=72, kx=96, ky=1212;
let cells=[];
let top=0,bot=ROWS-1,left=0,right=COLS-1;
while(top<=bot && left<=right){
  for(let c=left;c<=right;c++) cells.push([c,top]);
  top++;
  for(let r=top;r<=bot;r++) cells.push([right,r]);
  right--;
  if(top<=bot){ for(let c=right;c>=left;c--) cells.push([c,bot]); bot--; }
  if(left<=right){ for(let r=bot;r>=top;r--) cells.push([left,r]); left++; }
}
cells=cells.slice(0,40);
let keyPath='';
for(let i=0;i<cells.length;i++){
  const x=kx+cells[i][0]*cw+30, y=ky+cells[i][1]*ch+28;
  keyPath+=(i===0?'M':' L')+n(x)+','+n(y);
  add(circ(x,y,21,C.pap,'stroke="'+C.ink+'" stroke-width="1.3"'));
  const s=(i+1)<10?0.66:0.50, w=(i+1)<10?24*0.66:48*0.50;
  add(num(x-w/2,y-10*s*1.05,s,String(i+1),C.ink,0.9));
  add(circ(x+34,y,6,'none','stroke="'+C.ink+'" stroke-width="1.3"'));
}
add(P(keyPath,'fill="none" stroke="'+C.ink+'" stroke-width="0.8" opacity="0.45" stroke-dasharray="4 4"'));
add(L(80,1500,1120,1500,'stroke="'+C.ink+'" stroke-width="0.8"'));

add(rect(0,0,W,H,'#000','filter="url(#grain)" opacity="0.12"'));
add('</svg>');
fs.writeFileSync(process.argv[2]||'lamina-anatomica.svg',S.join('\n'));
console.log('wrote',(S.join('\n').length/1024).toFixed(1)+'KB',S.length+' elems');