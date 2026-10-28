// M9 El Mural — generator v1 (social-realist mural, three registers, find-it birds)
import {writeFileSync} from "node:fs";
const WALL="#b98a58", WALL2="#a97a4a", WALL3="#c99a68";
const INK="#241a12", RED="#a83422", RED2="#7d2418", OCHRE="#d3a35c", OCHRE2="#b9823c";
const TEAL="#3d5a55", BLUE="#435f74", CREAM="#e6d4b0", DARK="#2e241a", GREEN="#5c6238";
function rng(seed){ let a=seed>>>0; return function(){ a|=0; a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
const R=rng(9182);
const E=[];
const defs='<filter id="grain" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="3" seed="12" stitchTiles="stitch"/><feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0.30 0.30 0.30 0 0"/></filter>'+
'<filter id="plaster" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.02 0.04" numOctaves="4" seed="8"/><feColorMatrix type="matrix" values="0 0 0 0 0.35  0 0 0 0 0.26  0 0 0 0 0.16  0.25 0.25 0.25 0 0"/></filter>';
// ---------- monumental figure ----------
// face: "front" | "profile" | "back"; dir flips profile
function figure(x,y,h,o){
  o=o||{};
  const cloth=o.cloth||[RED,OCHRE2,TEAL,BLUE,GREEN,DARK][Math.floor(R()*6)];
  const skin=o.skin||"#c58a54";
  const face=o.face||"front", dir=o.dir||1;
  const hr=h*0.085, sh=y-h*0.72, hip=y-h*0.40, sw=h*0.16;
  let g='<g>';
  // torso: broad shoulders
  g+='<path d="M'+(x-sw)+','+(sh+h*0.06)+' Q'+x+','+(sh-h*0.02)+' '+(x+sw)+','+(sh+h*0.06)+' L'+(x+sw*0.9)+','+hip+' L'+(x-sw*0.9)+','+hip+' Z" fill="'+cloth+'" stroke="'+INK+'" stroke-width="'+(h*0.012)+'"/>';
  // arms
  const a1=o.arm1||0, a2=o.arm2||0;
  const e1=[x-sw*1.30+a1*0.55, sh+h*0.52+a1], e2=[x+sw*1.30+a2*0.55, sh+h*0.52+a2];
  g+='<path d="M'+(x-sw*0.85)+','+(sh+h*0.08)+' Q'+(x-sw*1.35)+','+(sh+h*0.26)+' '+e1[0]+','+e1[1]+'" stroke="'+cloth+'" stroke-width="'+(h*0.09)+'" fill="none" stroke-linecap="round"/>';
  g+='<path d="M'+(x+sw*0.85)+','+(sh+h*0.08)+' Q'+(x+sw*1.35)+','+(sh+h*0.26)+' '+e2[0]+','+e2[1]+'" stroke="'+cloth+'" stroke-width="'+(h*0.09)+'" fill="none" stroke-linecap="round"/>';
  // hands
  g+='<circle cx="'+e1[0]+'" cy="'+e1[1]+'" r="'+(h*0.045)+'" fill="'+skin+'" stroke="'+INK+'" stroke-width="2"/>';
  g+='<circle cx="'+e2[0]+'" cy="'+e2[1]+'" r="'+(h*0.045)+'" fill="'+skin+'" stroke="'+INK+'" stroke-width="2"/>';
  // head
  const hy=sh-h*0.04;
  g+='<ellipse cx="'+x+'" cy="'+hy+'" rx="'+hr*0.92+'" ry="'+hr+'" fill="'+skin+'" stroke="'+INK+'" stroke-width="'+(h*0.012)+'"/>';
  if(face==="front"){
    g+='<path d="M'+(x-hr*0.45)+','+(hy-hr*0.1)+' q'+(hr*0.2)+',-'+hr*0.15+' '+(hr*0.4)+',0" stroke="'+INK+'" stroke-width="2" fill="none"/>';
    g+='<path d="M'+(x+hr*0.05)+','+(hy-hr*0.1)+' q'+(hr*0.2)+',-'+hr*0.15+' '+(hr*0.4)+',0" stroke="'+INK+'" stroke-width="2" fill="none"/>';
    g+='<path d="M'+(x-hr*0.15)+','+(hy+hr*0.5)+' q'+(hr*0.3)+','+(hr*0.22)+' '+(hr*0.6)+',0" stroke="'+INK+'" stroke-width="2.2" fill="none"/>';
    g+='<path d="M'+(x-hr*0.1)+','+(hy+hr*0.05)+' l'+(hr*0.12)+','+(hr*0.28)+' l'+(hr*0.16)+',0" fill="'+INK+'" opacity="0.7"/>';
  } else if(face==="profile"){
    const d=dir;
    g+='<path d="M'+(x+d*hr*0.9)+','+(hy-hr*0.1)+' q'+(d*hr*0.5)+',-'+hr*0.05+' '+(d*hr*0.55)+','+hr*0.35+' l'+(d*hr*0.1)+','+hr*0.4+' l-'+(d*hr*0.55)+',0" fill="'+skin+'" stroke="'+INK+'" stroke-width="2"/>';
    g+='<circle cx="'+(x+d*hr*0.55)+'" cy="'+(hy-hr*0.1)+'" r="2.2" fill="'+INK+'"/>';
    g+='<path d="M'+(x-hr*0.6)+','+(hy-hr*0.6)+' q'+(d*hr*0.9)+',-'+hr*0.5+' '+(d*hr*1.8)+',0" fill="'+INK+'"/>';
  } else {
    g+='<ellipse cx="'+x+'" cy="'+(hy-hr*0.1)+'" rx="'+(hr*0.98)+'" ry="'+(hr*1.05)+'" fill="'+(o.hair||"#2a1d12")+'" stroke="'+INK+'" stroke-width="'+(h*0.01)+'"/>';
  }
  // hat
  if(o.hat==="sombrero") g+='<ellipse cx="'+x+'" cy="'+(hy-hr*0.55)+'" rx="'+(hr*2.3)+'" ry="'+(hr*0.45)+'" fill="'+OCHRE2+'" stroke="'+INK+'" stroke-width="2"/><path d="M'+(x-hr*0.8)+','+(hy-hr*0.6)+' q'+(hr*0.8)+',-'+hr*1.1+' '+(hr*1.6)+',0 Z" fill="'+OCHRE2+'" stroke="'+INK+'" stroke-width="2"/>';
  if(o.hat==="helmet") g+='<path d="M'+(x-hr)+','+(hy-hr*0.3)+' q'+hr+',-'+hr*1.4+' '+(hr*2)+',0 Z" fill="'+OCHRE+'" stroke="'+INK+'" stroke-width="2"/>';
  if(o.hat==="scarf") g+='<path d="M'+(x-hr*0.95)+','+(hy+hr*0.1)+' q'+hr*0.95+',-'+hr*1.5+' '+(hr*1.9)+',0 q-'+hr*0.2+','+hr*0.4+' -'+hr*0.5+','+hr*0.35+' q-'+hr*0.5+','+hr*0.2+' -'+hr*0.9+',-'+hr*0.35+' Z" fill="'+RED+'"/>';
  // tool
  if(o.tool==="hammer") g+='<path d="M'+(e2[0])+','+(e2[1])+' l'+(h*0.13)+',-'+(h*0.26)+'" stroke="'+OCHRE2+'" stroke-width="'+(h*0.035)+'"/><rect x="'+(e2[0]+h*0.10)+'" y="'+(e2[1]-h*0.32)+'" width="'+(h*0.11)+'" height="'+(h*0.06)+'" fill="'+DARK+'" transform="rotate(-38 '+(e2[0]+h*0.12)+' '+(e2[1]-h*0.30)+')"/>';
  if(o.tool==="drill") g+='<rect x="'+(e2[0]-h*0.02)+'" y="'+(e2[1]-h*0.05)+'" width="'+(h*0.20)+'" height="'+(h*0.07)+'" fill="'+DARK+'"/><path d="M'+(e2[0]+h*0.18)+','+(e2[1])+' l'+(h*0.14)+',0" stroke="'+INK+'" stroke-width="'+(h*0.022)+'"/>';
  if(o.flag) g+='<path d="M'+(x+sw*1.2)+','+(sh-h*0.3)+' v'+(h*0.9)+'" stroke="'+DARK+'" stroke-width="'+(h*0.02)+'"/><path d="M'+(x+sw*1.2)+','+(sh-h*0.3)+' h'+(h*0.34)+' l-'+(h*0.06)+','+(h*0.10)+' l'+(h*0.06)+','+(h*0.10)+' h-'+(h*0.34)+' Z" fill="'+RED+'"/>';
  g+='</g>'; return g;
}
// ---------- naturalistic bird (find-it) ----------
function bird(x,y,s,dir){
  const d=dir||1;
  let g='<g transform="translate('+x+','+y+') scale('+d*s+','+s+')">';
  g+='<ellipse cx="0" cy="0" rx="13" ry="8" fill="#8d8a80" stroke="#3a352c" stroke-width="1"/>';
  g+='<path d="M-4,-5 q6,-6 11,-1 q-5,3 -11,1 Z" fill="#6f6b60"/>';
  g+='<circle cx="14" cy="-5" r="5.5" fill="#7c786d" stroke="#3a352c" stroke-width="1"/>';
  g+='<path d="M19,-6 l6,2 l-6,2 Z" fill="#c9a24a"/>';
  g+='<path d="M-12,1 l-11,4 l11,3 Z" fill="#5f5b52" stroke="#3a352c" stroke-width="1"/>';
  g+='<path d="M-2,8 l-2,10 M4,8 l2,10" stroke="#3a352c" stroke-width="1.6"/>';
  g+='<circle cx="15.5" cy="-6" r="1.1" fill="#151210"/>';
  return g+'</g>';
}
function gear(cx,cy,r,teeth,fill){
  let g='<g>';
  for(let i=0;i<teeth;i++){ const a=i*Math.PI*2/teeth; g+='<rect x="'+(cx-r*1.18)+'" y="'+(cy-3)+'" width="'+(r*0.28)+'" height="6" fill="'+fill+'" transform="rotate('+(a*180/Math.PI)+' '+cx+' '+cy+')"/>'; }
  g+='<circle cx="'+cx+'" cy="'+cy+'" r="'+r+'" fill="'+fill+'" stroke="'+INK+'" stroke-width="2"/>';
  g+='<circle cx="'+cx+'" cy="'+cy+'" r="'+(r*0.35)+'" fill="'+WALL+'"/>';
  return g+'</g>';
}
// ---------- wall ----------
E.push('<rect width="1600" height="1200" fill="'+WALL+'"/>');
E.push('<rect width="1600" height="1200" filter="url(#plaster)" opacity="0.45"/>');
// fresco patches
for(let i=0;i<14;i++){ const x=R()*1600, y=R()*1200, w=120+R()*260, h=80+R()*180;
  E.push('<ellipse cx="'+x+'" cy="'+y+'" rx="'+w+'" ry="'+h+'" fill="'+(i%2?WALL2:WALL3)+'" opacity="0.10"/>'); }
// cracks
for(let i=0;i<9;i++){ let x=80+R()*1440, y=80+R()*1040; let d="M"+x+","+y;
  for(let k=0;k<5;k++){ x+=(R()-0.5)*80; y+=R()*60; d+=" L"+x+","+y; }
  E.push('<path d="'+d+'" stroke="#5c4226" stroke-width="1.6" fill="none" opacity="0.35"/>'); }
// ---------- TOP REGISTER: sky and machines (y 80-440) ----------
E.push('<rect x="60" y="70" width="1480" height="370" fill="#c9a066" opacity="0.55"/>');
E.push('<circle cx="520" cy="250" r="92" fill="'+RED+'" stroke="'+RED2+'" stroke-width="6"/>');
for(let i=0;i<12;i++){ const a=i*Math.PI/6; E.push('<path d="M'+(520+Math.cos(a)*110)+','+(250+Math.sin(a)*110)+' l'+(Math.cos(a)*36)+','+(Math.sin(a)*36)+'" stroke="'+RED2+'" stroke-width="8"/>'); }
// clouds
E.push('<path d="M760,150 q40,-30 90,-14 q50,-24 96,6 q40,26 -6,40 h-170 q-40,-14 -10,-32 Z" fill="'+CREAM+'" opacity="0.75"/>');
E.push('<path d="M1200,120 q34,-24 74,-10 q40,-18 76,4 q32,20 -8,32 h-132 q-30,-12 -10,-26 Z" fill="'+CREAM+'" opacity="0.6"/>');
// machines: gears and a crane
E.push(gear(1080,300,66,12,DARK));
E.push(gear(1210,250,44,10,OCHRE2));
E.push(gear(1300,350,34,9,DARK));
E.push('<path d="M1400,430 v-210 l-160,30 M1400,220 l60,30" stroke="'+DARK+'" stroke-width="7" fill="none"/>');
E.push('<path d="M1400,420 l-24,20 M1400,360 l-20,16" stroke="'+DARK+'" stroke-width="3"/>');
// a distant factory silhouette on the top-left
E.push('<path d="M90,360 h60 v-70 h20 v70 h50 v-90 h20 v90 h70 v70 h-220 Z" fill="'+DARK+'" opacity="0.75"/>');
E.push('<path d="M120,290 v-50 M180,280 v-40 M240,270 v-40" stroke="'+DARK+'" stroke-width="6"/>');
// birds in the top register (2 of 8)
E.push(bird(700,180,1.6,1));
E.push(bird(980,120,1.3,-1));
// ---------- MIDDLE REGISTER: history (y 440-860) ----------
// central crowd facing the viewer
const fronts=[[340,870,215],[440,880,235],[540,872,245],[640,885,258],[740,878,252],[840,870,240],[930,878,232],[1010,872,222]];
fronts.forEach(function(p,i){ E.push(figure(p[0],p[1],p[2],{face:i%4===1?"profile":"front",cloth:[RED,OCHRE2,TEAL,BLUE,CREAM,RED2][i],arm1:i%2?-14:8,arm2:i%3?-10:14,hat:i===3?"scarf":"none"})); });
// mother and child
E.push(figure(560,880,250,{face:"front",cloth:BLUE,hat:"scarf",arm1:-20,arm2:24}));
E.push(figure(600,900,110,{face:"front",cloth:OCHRE,arm1:-10,arm2:10}));
// back row (depth) behind the central crowd
for(let i=0;i<8;i++){ E.push(figure(380+i*82,830+((i%2)*8),180+((i*13)%30),{face:i%3===0?"profile":"front",cloth:[TEAL,BLUE,OCHRE2,GREEN,RED2][i%5],dir:i%2?1:-1})); }
// raised fist worker at the centre
E.push(figure(700,880,270,{face:"front",cloth:RED,arm1:-92,arm2:-30,tool:"hammer"}));
E.push(figure(760,872,255,{face:"front",cloth:OCHRE2,arm1:-80,arm2:10}));
// red flag above the centre
E.push('<path d="M862,540 v-180" stroke="'+DARK+'" stroke-width="7"/><path d="M862,360 h150 l-26,34 l26,34 h-150 Z" fill="'+RED+'"/>');
// the march at the left, turning away
for(let i=0;i<7;i++){ E.push(figure(240+i*38,860+i*4,190-i*8,{face:"back",cloth:[OCHRE2,RED2,TEAL][i%3],arm1:-8,arm2:8,flag:i===2})); }
// faces behind (back of heads) at the edges
for(let i=0;i<6;i++){ E.push(figure(120+i*46,830+i*5,160-i*6,{face:"back",cloth:[BLUE,GREEN,OCHRE2][i%3]})); }
for(let i=0;i<6;i++){ E.push(figure(1280+i*46,830+i*5,160-i*6,{face:"back",cloth:[BLUE,GREEN,OCHRE2][i%3]})); }
// skeleton in a sombrero at the right
E.push('<g transform="translate(1180,860)">');
E.push('<path d="M-26,0 q-8,-120 8,-150 q-16,-30 18,-34 q34,4 18,34 q16,30 8,150 Z" fill="#ded3b0" stroke="'+INK+'" stroke-width="3"/>');
for(let i=0;i<4;i++){ E.push('<path d="M-20,'+(-150-i*22)+' q20,10 40,0 M-20,'+(-144-i*22)+' q20,8 40,0" stroke="'+INK+'" stroke-width="2.4" fill="none"/>'); }
E.push('<path d="M-24,-140 q-40,40 -30,80 M24,-140 q40,40 30,80" stroke="#ded3b0" stroke-width="13" fill="none"/><circle cx="-56" cy="-58" r="9" fill="#ded3b0" stroke="'+INK+'" stroke-width="2"/><circle cx="56" cy="-58" r="9" fill="#ded3b0" stroke="'+INK+'" stroke-width="2"/>');
E.push('<ellipse cx="0" cy="-215" rx="42" ry="46" fill="#e8dfc0" stroke="'+INK+'" stroke-width="3"/>');
E.push('<circle cx="-15" cy="-222" r="9" fill="'+INK+'"/><circle cx="15" cy="-222" r="9" fill="'+INK+'"/>');
E.push('<path d="M-14,-200 h28 M-8,-190 v10 M0,-190 v10 M8,-190 v10" stroke="'+INK+'" stroke-width="3"/>');
E.push('<ellipse cx="0" cy="-262" rx="76" ry="16" fill="'+OCHRE2+'" stroke="'+INK+'" stroke-width="3"/><path d="M-26,-262 q26,-38 52,0 Z" fill="'+OCHRE2+'" stroke="'+INK+'" stroke-width="3"/>');
// a guitar? no - the skeleton holds a flower
E.push('<path d="M30,-120 q20,-30 10,-60" stroke="'+GREEN+'" stroke-width="4" fill="none"/><circle cx="40" cy="-182" r="8" fill="'+RED+'"/>');
E.push('</g>');
// bird on the skeleton's sombrero (3 of 8)
E.push(bird(1196,592,1.9,-1));
// ---------- BOTTOM REGISTER: labour (y 860-1140) ----------
E.push('<rect x="60" y="860" width="1480" height="280" fill="#a9743f" opacity="0.35"/>');
// tractor
E.push('<g transform="translate(200,1100)">');
E.push('<rect x="0" y="-70" width="150" height="60" fill="'+TEAL+'" stroke="'+INK+'" stroke-width="3"/><rect x="40" y="-108" width="70" height="40" fill="'+TEAL+'" stroke="'+INK+'" stroke-width="3"/>');
E.push('<circle cx="34" cy="-6" r="34" fill="'+DARK+'"/><circle cx="34" cy="-6" r="14" fill="'+OCHRE+'"/>');
E.push('<circle cx="124" cy="-4" r="22" fill="'+DARK+'"/><circle cx="124" cy="-4" r="9" fill="'+OCHRE+'"/>');
E.push('</g>');
// workers with tools
const workers=[[400,1140,240,"drill"],[520,1150,250,"hammer"],[660,1140,245,"hammer"],[820,1150,250,"drill"],[980,1140,240,"hammer"],[1120,1150,235,"drill"]];
workers.forEach(function(w,i){ E.push(figure(w[0],w[1],w[2],{face:"front",cloth:[RED,TEAL,OCHRE2,BLUE,GREEN,RED2][i],arm1:-18,arm2:16,tool:w[3],hat:i%2?"helmet":"none"})); });
// a river of people at the bottom edge (backs and heads)
for(let i=0;i<16;i++){ E.push(figure(80+i*96,1208,120+((i*13)%30),{face:"back",cloth:[OCHRE2,RED2,TEAL,BLUE][i%4]})); }
// hands raised at the left
E.push('<path d="M80,980 q30,-60 40,-10 q20,-50 34,-6 q18,-40 30,4 l-10,60 q-50,20 -94,-10 Z" fill="#c58a54" stroke="'+INK+'" stroke-width="3"/>');
// birds in the bottom register (4 of 8)
E.push(bird(312,1012,1.5,1));
E.push(bird(560,960,1.4,-1));
E.push(bird(900,1085,1.6,1));
E.push(bird(1090,930,1.2,-1));
// two birds in the middle register (6,7)
E.push(bird(470,780,1.3,1));
E.push(bird(980,700,1.2,-1));
// eighth bird in the top right (8)
E.push(bird(1355,210,1.4,1));
// ---------- mural frame + age ----------
E.push('<rect x="24" y="24" width="1552" height="1152" fill="none" stroke="'+INK+'" stroke-width="10"/>');
E.push('<rect x="40" y="40" width="1520" height="1120" fill="none" stroke="'+INK+'" stroke-width="3"/>');
E.push('<rect width="1600" height="1200" filter="url(#grain)" opacity="0.13"/>');
const svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 1200" width="1600" height="1200"><defs>'+defs+'</defs>'+E.join("\n")+'</svg>';
writeFileSync(process.argv[2]||"mural.svg", svg);
console.log("elements",E.length,"bytes",svg.length);
