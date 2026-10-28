// M1 La Feria — generator v1 (Bruegelian village panorama, 1600x1200)
import {writeFileSync} from "node:fs";
const SKY="#c9d3d1", SKY2="#e2ddd0", PAPER="#efe7d2";
const DARK="#211f1a", INK="#2b2720";
const RED="#a03a24", RED2="#7d2a1a", CREAM="#e8dcc0", OCHRE="#b98a4e", OCHRE2="#9a6f3c";
const GREEN="#5b6b3a", GREEN2="#43502c", BROWN="#5a4632", BROWN2="#3e3022", BLUE="#7f95a0", GREY="#8b8778";
const HORIZON=430;
function rng(seed){ let a=seed>>>0; return function(){ a|=0; a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
const R=rng(20311);
const E=[];
const defs='<filter id="grain" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB"><feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="3" seed="7" stitchTiles="stitch"/><feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0.28 0.28 0.28 0 0"/></filter>';
// ---------- figure ----------
function head(x,y,r,col){ return '<circle cx="'+x+'" cy="'+y+'" r="'+r+'" fill="'+col+'"/>'; }
function person(x,y,h,o){
  o=o||{};
  const pal=o.pal||[BROWN,OCHRE2,BLUE,GREEN2,RED2,GREY];
  const cloth=o.cloth||pal[Math.floor(R()*pal.length)];
  const hose=o.hose||(R()<0.5?BROWN2:"#4a4034");
  const skin=o.skin||"#c99a6c";
  const lean=o.lean||0;
  const woman=o.woman||false, child=o.child||false;
  const hr=(child?0.105:0.072)*h, sh=y-h*0.74, hip=y-h*0.44, hw=h*0.085, sw=(woman?0.115:0.135)*h;
  const stride=o.stride===undefined?h*0.045:o.stride;
  const dx=lean*h*0.02;
  let g='<g>';
  if(woman){
    // skirt
    g+='<path d="M'+(x-sw*0.55)+','+hip+' L'+(x+sw*0.55+dx)+','+hip+' L'+(x+h*0.17+dx)+','+y+' L'+(x-h*0.17)+','+y+' Z" fill="'+cloth+'"/>';
    g+='<path d="M'+(x-0.7*hw)+','+y+' h'+(1.4*hw)+'" stroke="'+hose+'" stroke-width="'+(h*0.04)+'"/>';
  } else {
    g+='<path d="M'+(x-0.8*hw)+','+hip+' L'+(x-0.1*hw)+','+hip+' L'+(x-0.1*hw-stride)+','+y+' L'+(x-1.5*hw-stride)+','+y+' Z" fill="'+hose+'"/>';
    g+='<path d="M'+(x+0.1*hw)+','+hip+' L'+(x+0.9*hw)+','+hip+' L'+(x+1.0*hw+stride)+','+y+' L'+(x+0.1*hw+stride)+','+y+' Z" fill="'+hose+'"/>';
  }
  // body
  g+='<path d="M'+(x-sw+dx)+','+(sh+h*0.05)+' L'+(x+sw+dx)+','+(sh+h*0.05)+' L'+(x+0.95*hw+dx*1.4)+','+hip+' L'+(x-0.95*hw+dx*1.4)+','+hip+' Z" fill="'+cloth+'"/>';
  // arms
  const a1=o.arm1===undefined?0:o.arm1, a2=o.arm2===undefined?0:o.arm2;
  g+='<path d="M'+(x-sw+dx)+','+(sh+h*0.07)+' L'+(x-sw*0.8+a1*0.6+dx)+','+(sh+h*0.26+a1)+'" stroke="'+cloth+'" stroke-width="'+(h*0.052)+'" stroke-linecap="round"/>';
  g+='<path d="M'+(x+sw+dx)+','+(sh+h*0.07)+' L'+(x+sw*0.8-a2*0.6+dx)+','+(sh+h*0.26+a2)+'" stroke="'+cloth+'" stroke-width="'+(h*0.052)+'" stroke-linecap="round"/>';
  const hy=sh-h*0.02;
  g+=head(x+dx, hy, hr, skin);
  const hat=o.hat||"none";
  if(hat==="cap") g+='<path d="M'+(x-hr*1.2+dx)+','+(hy-hr*0.05)+' q'+(hr*1.2)+',-'+hr*1.35+' '+(hr*2.4)+',0 Z" fill="'+(o.hatCol||BROWN2)+'"/>';
  if(hat==="hood") g+='<path d="M'+(x-hr*1.3)+','+(hy+hr*0.4)+' q0,'+(-hr*2.2)+' '+(hr*1.3)+','+(-hr*2.2)+' q'+(hr*1.3)+',0 '+(hr*1.3)+','+(hr*2.2)+' q'+(-hr*0.9)+','+(hr*0.5)+' '+(-hr*2.6)+',0 Z" fill="'+cloth+'"/>';
  if(hat==="wide") g+='<ellipse cx="'+(x+dx)+'" cy="'+(hy-hr*0.35)+'" rx="'+(hr*1.9)+'" ry="'+(hr*0.5)+'" fill="'+(o.hatCol||BROWN2)+'"/><path d="M'+(x-hr*0.9+dx)+','+(hy-hr*0.4)+' q'+(hr*0.9)+',-'+hr*0.8+' '+(hr*1.8)+',0 Z" fill="'+(o.hatCol||BROWN2)+'"/>';
  if(hat==="straw") g+='<ellipse cx="'+(x+dx)+'" cy="'+(hy-hr*0.3)+'" rx="'+(hr*2.0)+'" ry="'+(hr*0.45)+'" fill="'+OCHRE+'"/><path d="M'+(x-hr+dx)+','+(hy-hr*0.35)+' q'+hr+',-'+hr*0.78+' '+(hr*2)+',0 Z" fill="'+OCHRE2+'"/>';
  // prop
  if(o.prop==="basket") g+='<ellipse cx="'+(x+sw*1.15)+'" cy="'+(sh+h*0.30)+'" rx="'+(h*0.06)+'" ry="'+(h*0.045)+'" fill="'+OCHRE2+'"/>';
  if(o.prop==="staff") g+='<path d="M'+(x+sw*0.9)+','+(hy)+' L'+(x+sw*0.9)+','+y+'" stroke="'+BROWN2+'" stroke-width="'+(h*0.022)+'"/>';
  if(o.prop==="bundle") g+='<path d="M'+(x-0.1*h)+','+(sh-h*0.04)+' q'+(h*0.1)+',-'+h*0.12+' '+(h*0.2)+',0 l0,'+(h*0.1)+' q-'+(h*0.1)+','+h*0.05+' -'+(h*0.2)+',0 Z" fill="'+RED2+'"/>';
  g+='<ellipse cx="'+x+'" cy="'+(y+2)+'" rx="'+(h*0.12)+'" ry="'+(h*0.025)+'" fill="#2a2418" opacity="0.22"/>';
  g+='</g>';
  return g;
}
function dog(x,y,s,col){ col=col||BROWN2; return '<g fill="'+col+'"><ellipse cx="'+x+'" cy="'+(y-s*0.35)+'" rx="'+(s*0.5)+'" ry="'+(s*0.22)+'"/><circle cx="'+(x+s*0.5)+'" cy="'+(y-s*0.52)+'" r="'+(s*0.15)+'"/><path d="M'+(x-s*0.3)+','+(y-s*0.2)+' L'+(x-s*0.38)+','+y+'" stroke="'+col+'" stroke-width="'+(s*0.07)+'"/><path d="M'+(x+s*0.25)+','+(y-s*0.2)+' L'+(x+s*0.34)+','+y+'" stroke="'+col+'" stroke-width="'+(s*0.07)+'"/><path d="M'+(x-s*0.45)+','+(y-s*0.5)+' q-'+(s*0.2)+',-'+(s*0.14)+' -'+(s*0.1)+',-'+(s*0.3)+'" stroke="'+col+'" stroke-width="'+(s*0.06)+'" fill="none"/></g>'; }
// ---------- architecture ----------
function house(x,y,w,h,roof){ // y baseline
  let g='<g>';
  g+='<rect x="'+x+'" y="'+(y-h)+'" width="'+w+'" height="'+h+'" fill="'+(roof?OCHRE2:GREY)+'"/>';
  g+='<path d="M'+(x-6)+','+(y-h)+' L'+(x+w/2)+','+(y-h-w*0.42)+' L'+(x+w+6)+','+(y-h)+' Z" fill="'+BROWN2+'"/>';
  g+='<path d="M'+(x+w*0.06)+','+(y-h*0.9)+' L'+(x+w*0.94)+','+(y-h*0.2)+' M'+(x+w*0.94)+','+(y-h*0.9)+' L'+(x+w*0.06)+','+(y-h*0.2)+'" stroke="'+BROWN2+'" stroke-width="3" opacity="0.55"/>';
  g+='<rect x="'+(x+w*0.68)+'" y="'+(y-h-w*0.46)+'" width="'+(w*0.12)+'" height="'+(w*0.22)+'" fill="'+BROWN2+'"/>';
  for(let i=0;i<2;i++) for(let j=0;j<2;j++){ g+='<rect x="'+(x+w*0.18+i*w*0.4)+'" y="'+(y-h*0.7+j*h*0.3)+'" width="'+(w*0.16)+'" height="'+(h*0.16)+'" fill="'+(R()<0.4?CREAM:"#6b5c44")+'"/>'; }
  g+='</g>'; return g;
}
function church(cx,base){
  let g='<g>';
  g+='<rect x="'+(cx-52)+'" y="'+(base-350)+'" width="104" height="350" fill="'+OCHRE2+'"/>';
  g+='<path d="M'+(cx-64)+','+(base-350)+' L'+cx+','+(base-452)+' L'+(cx+64)+','+(base-350)+' Z" fill="'+BROWN2+'"/>';
  g+='<path d="M'+cx+','+(base-452)+' v-18" stroke="'+BROWN2+'" stroke-width="4"/>';
  g+='<rect x="'+(cx-16)+'" y="'+(base-420)+'" width="32" height="26" fill="'+INK+'"/>';
  g+='<circle cx="'+cx+'" cy="'+(base-310)+'" r="17" fill="'+CREAM+'"/><circle cx="'+cx+'" cy="'+(base-310)+'" r="11" fill="'+INK+'"/>';
  g+='<rect x="'+(cx-170)+'" y="'+(base-200)+'" width="340" height="200" fill="'+OCHRE2+'"/>';
  g+='<path d="M'+(cx-182)+','+(base-200)+' L'+cx+','+(base-276)+' L'+(cx+182)+','+(base-200)+' Z" fill="'+BROWN2+'"/>';
  // buttresses
  for(const bx of [cx-150,cx-96,cx+96,cx+150]) g+='<rect x="'+(bx-9)+'" y="'+(base-150)+'" width="18" height="150" fill="'+OCHRE2+'" stroke="'+BROWN2+'" stroke-width="2"/>';
  // portal with archivolt
  g+='<path d="M'+(cx-46)+','+base+' v-92 q46,-46 92,0 v92 Z" fill="'+BROWN2+'"/>';
  g+='<path d="M'+(cx-34)+','+base+' v-80 q34,-34 68,0 v80 Z" fill="'+INK+'"/>';
  g+='<path d="M'+(cx-52)+','+(base-96)+' q52,-58 104,0" fill="none" stroke="'+CREAM+'" stroke-width="4"/>';
  // rose window
  g+='<circle cx="'+cx+'" cy="'+(base-138)+'" r="26" fill="'+CREAM+'"/><circle cx="'+cx+'" cy="'+(base-138)+'" r="20" fill="'+RED2+'"/>';
  for(let i=0;i<8;i++){ const a=i*Math.PI/4; g+='<path d="M'+cx+','+(base-138)+' L'+(cx+Math.cos(a)*20)+','+(base-138+Math.sin(a)*20)+'" stroke="'+INK+'" stroke-width="2"/>'; }
  return g+'</g>';
}
function windmill(x,y,s){
  let g='<g>';
  g+='<path d="M'+(x-14*s)+','+y+' L'+(x-8*s)+','+(y-90*s)+' L'+(x+8*s)+','+(y-90*s)+' L'+(x+14*s)+','+y+' Z" fill="'+BROWN2+'"/>';
  g+='<path d="M'+(x-10*s)+','+(y-90*s)+' L'+(x+10*s)+','+(y-90*s)+' L'+(x)+','+(y-104*s)+' Z" fill="'+INK+'"/>';
  const cx=x, cy=y-88*s;
  for(let i=0;i<4;i++){ const a=i*Math.PI/2+0.4;
    g+='<path d="M'+cx+','+cy+' L'+(cx+Math.cos(a)*34*s)+','+(cy+Math.sin(a)*34*s)+'" stroke="'+BROWN2+'" stroke-width="'+(2.5*s)+'"/>';
    g+='<rect x="'+(cx+Math.cos(a)*20*s-4*s)+'" y="'+(cy+Math.sin(a)*20*s-2*s)+'" width="'+(20*s)+'" height="'+(7*s)+'" fill="'+CREAM+'" transform="rotate('+(a*180/Math.PI)+' '+(cx+Math.cos(a)*20*s)+' '+(cy+Math.sin(a)*20*s)+')"/>'; }
  g+='</g>'; return g;
}
function gallows(x,y,s){
  let g='<g stroke="'+BROWN2+'" fill="none" stroke-width="'+(3*s)+'">';
  g+='<path d="M'+x+','+y+' v-70 L'+(x+52*s)+','+(y-70)+' M'+(x+52*s)+','+(y-70)+' v14"/>';
  g+='<path d="M'+(x-10*s)+','+y+' h'+(20*s)+'"/>';
  g+='</g>';
  g+='<circle cx="'+x+'" cy="'+y+'" r="'+(4*s)+'" fill="'+BROWN2+'"/>';
  return g;
}
// ---------- ground ----------
E.push('<rect width="1600" height="1200" fill="'+SKY+'"/>');
E.push('<rect y="0" width="1600" height="200" fill="#aebfc2"/>');
E.push('<rect y="200" width="1600" height="230" fill="'+SKY2+'" opacity="0.75"/>');
E.push('<rect y="330" width="1600" height="100" fill="#efe8d4" opacity="0.55"/>');
// distant hills
E.push('<path d="M0,430 L0,330 Q160,250 330,320 Q480,370 620,318 Q760,268 940,330 Q1120,380 1300,320 Q1450,278 1600,330 L1600,430 Z" fill="#9aa08c" opacity="0.55"/>');
// town wall right + gate
E.push('<path d="M1180,430 L1180,330 L1600,300 L1600,430 Z" fill="'+GREY+'" opacity="0.9"/>');
E.push('<path d="M1180,330 L1600,300" stroke="'+BROWN2+'" stroke-width="4"/>');
for(let i=0;i<9;i++){ const x=1200+i*46; E.push('<path d="M'+x+','+(330-i*3.2)+' v-14 h20 v14" fill="'+GREY+'" stroke="'+BROWN2+'" stroke-width="2"/>'); }
// gate tower
E.push('<rect x="1236" y="276" width="64" height="154" fill="'+GREY+'"/><path d="M1230,276 L1268,240 L1306,276 Z" fill="'+BROWN2+'"/><path d="M1252,430 v-52 q16,-18 32,0 v52 Z" fill="'+INK+'"/>');
// gallows outside the wall
E.push(gallows(1358,306,1.9));
// hillside windmill left
E.push('<path d="M0,430 L0,300 Q120,236 280,300 Q400,348 520,314 L520,430 Z" fill="#8f957f" opacity="0.75"/>');
E.push(windmill(150,306,1.7));
// background houses
E.push(house(300,430,130,120,1));
E.push(house(430,430,110,100,1));
E.push(house(1080,430,120,110,1));
E.push(house(960,430,100,90,1));
// church
E.push(church(760,430));
E.push('<rect x="0" y="300" width="1600" height="140" fill="#e6dfcb" opacity="0.16"/>');
// plaza ground
E.push('<path d="M0,430 L1600,430 L1600,1200 L0,1200 Z" fill="#c9b98f"/>');
E.push('<path d="M0,430 L1600,430 L1600,470 Q800,510 0,470 Z" fill="#b3a175"/>');
E.push('<path d="M0,930 L1600,930 L1600,1200 L0,1200 Z" fill="#9c7c4e" opacity="0.65"/>');
E.push('<path d="M0,1080 L1600,1080 L1600,1200 L0,1200 Z" fill="#6f5533" opacity="0.55"/>');
E.push('<ellipse cx="620" cy="760" rx="620" ry="300" fill="#f2e6c2" opacity="0.16"/>');
// cobbles: perspective rows
for(let r=0;r<16;r++){
  const t=r/15, y=470+(1200-470)*t*t;
  const n=8+Math.floor(t*40);
  E.push('<path d="M'+(-100+t*160)+','+y+' Q800,'+(y+8+t*18)+' '+(1700-t*160)+','+y+'" stroke="#a9976a" stroke-width="'+(1+t*2)+'" fill="none" opacity="0.7"/>');
}
// washing lines between houses
for(let i=0;i<3;i++){ const y=330+i*28;
  E.push('<path d="M300,'+y+' Q500,'+(y+30)+' 700,'+y+'" stroke="'+INK+'" stroke-width="1.4" fill="none"/>');
  for(let k=0;k<5;k++){ const t=(k+0.6)/5.6; const x=300+(700-300)*t, yy=y+Math.sin(t*Math.PI)*30;
    E.push('<path d="M'+x+','+yy+' h10 v'+(16+R()*14)+' h-10 Z" fill="'+(R()<0.5?CREAM:RED2)+'" opacity="0.9"/>'); }
}
// ---------- stalls ----------
function stall(x,y,w,h,a1,a2){
  const top=y-h, bot=y-h*0.34;
  let g='<g>';
  g+='<rect x="'+(x-w*0.46)+'" y="'+(top+8)+'" width="'+(w*0.92)+'" height="'+(h*0.48)+'" fill="'+BROWN2+'"/>';
  g+='<rect x="'+(x-w*0.30)+'" y="'+(top+h*0.16)+'" width="'+(w*0.2)+'" height="'+(h*0.12)+'" fill="'+RED2+'"/>';
  g+='<rect x="'+(x+w*0.06)+'" y="'+(top+h*0.14)+'" width="'+(w*0.18)+'" height="'+(h*0.14)+'" fill="'+OCHRE2+'"/>';
  g+='<rect x="'+(x-w*0.44)+'" y="'+(top+2)+'" width="7" height="'+(y-top)+'" fill="'+BROWN+'"/>';
  g+='<rect x="'+(x+w*0.40)+'" y="'+(top+2)+'" width="7" height="'+(y-top)+'" fill="'+BROWN+'"/>';
  g+='<rect x="'+(x-w*0.5)+'" y="'+bot+'" width="'+w+'" height="'+(h*0.13)+'" fill="'+BROWN+'"/>';
  g+='<rect x="'+(x-w*0.5)+'" y="'+bot+'" width="'+w+'" height="3.5" fill="#3a2c1e"/>';
  for(let i=0;i<6;i++){ const x1=x-w*0.56+i*w*0.187, x2=x1+w*0.187;
    g+='<path d="M'+x1+','+(top+2)+' L'+x2+','+(top+2)+' L'+(x2+9)+','+(top+h*0.24)+' L'+(x1+9)+','+(top+h*0.24)+' Z" fill="'+((i%2)?a1:a2)+'"/>'; }
  g+='<path d="M'+(x-w*0.56)+','+(top+h*0.24)+' L'+(x+w*0.5)+','+(top+h*0.24)+'" stroke="'+BROWN2+'" stroke-width="3"/>';
  for(let i=0;i<5;i++) g+='<ellipse cx="'+(x-w*0.32+i*w*0.16)+'" cy="'+(bot-5)+'" rx="'+(w*0.05)+'" ry="'+(h*0.025)+'" fill="'+(i%2?OCHRE:RED2)+'"/>';
  return g+'</g>';
}
const stallXs=[[150,860,260,0.0],[420,845,250,0.0],[690,830,240,0.0],[950,815,225,0.0]];
stallXs.forEach(function(s,i){ E.push(stall(s[0],s[1],s[2],s[2]*0.78, i%2?RED:CREAM, i%2?CREAM:RED2)); });
// awnings offset after crowd for depth: drawn again lightly in front

// ---------- crowd ----------
// density: thick toward the church door (760,440), thin toward the gallows (1352,300)
function density(x,y){
  const dc=Math.hypot((x-780)/300,(y-500)/190);   // church door
  const dm=Math.hypot((x-520)/460,(y-800)/260);   // market
  const dg=Math.hypot((x-1400)/380,(y-360)/300);  // gallows
  let d=1.9*Math.exp(-dc*dc*1.6)+0.85*Math.exp(-dm*dm*1.2)-1.35*Math.exp(-dg*dg*1.5);
  return Math.max(0.02,Math.min(1,d));
}
// crowd: jittered points, density rule, clearings for stalls/incidents
function clear(x,y){
  if(y>690&&y<870&&x>20&&x<1060) return true;          // stall row
  if(x>1180&&y>600&&y<780) return true;                 // fight
  if(x>150&&x<430&&y>740&&y<880) return true;           // dog chase
  if(x>330&&x<620&&y>930&&y<1120) return true;          // cart
  return false;
}
const crowd=[];
for(let i=0;i<1700;i++){
  const x=30+R()*1540, y=450+R()*600;
  const t=(y-450)/600;
  const h=(30+t*t*95)*(0.85+R()*0.3);
  if(clear(x,y)) continue;
  if(R()>density(x,y)*0.55) continue;
  crowd.push([x,y,h]);
}
for(let k=0;k<18;k++){ const cx=140+R()*1180, cy=560+R()*40, hh=44+R()*22;
  const n=2+Math.floor(R()*3);
  for(let j=0;j<n;j++){ const xx=cx+(R()-0.5)*80, yy=cy+(R()-0.5)*18; if(!clear(xx,yy)) crowd.push([xx,yy,hh*(0.85+R()*0.3)]); } }
crowd.sort(function(a,b){return a[1]-b[1];});
const hatCols=[BROWN2,GREY,BLUE,"#4a4034",OCHRE2];
crowd.forEach(function(p){
  const hat=R()<0.20?"cap":(R()<0.12?"wide":(R()<0.10?"straw":"none"));
  E.push(person(p[0],p[1],p[2],{dir:R()<0.5?1:-1,hat:hat,hatCol:hatCols[Math.floor(R()*hatCols.length)],
    arm1:(R()-0.5)*12,arm2:(R()-0.5)*12,woman:R()<0.42,prop:R()<0.16?"basket":"none",stride:R()<0.4?p[2]*0.06:0}));
});
// ---------- incidents ----------
// 1. fight at the right edge
E.push(person(1300,690,120,{dir:1,pal:[RED2],arm1:-34,arm2:26,lean:10,stride:6,hat:"none"}));
E.push(person(1352,700,124,{dir:-1,pal:[GREY],arm1:30,arm2:-24,lean:-8,stride:8,hat:"wide"}));
E.push(person(1240,710,112,{dir:1,pal:[BROWN],arm1:20,arm2:10,hat:"cap",hatCol:RED}));
E.push(person(1408,712,110,{dir:-1,pal:[GREEN2],arm1:12,arm2:16,hat:"none"}));
// 2. children chasing a dog (left)
E.push(dog(300,800,26));
E.push(person(232,806,74,{dir:1,pal:[OCHRE2],arm1:-16,arm2:-10,stride:8,hat:"cap",hatCol:RED}));
E.push(person(190,812,66,{dir:1,pal:[BLUE],arm1:-14,arm2:-8,stride:9,hat:"none"}));
E.push(person(340,802,70,{dir:-1,pal:[RED2],arm1:-12,arm2:-14,stride:7,hat:"none"}));
// 3. procession crossing behind the market
for(let i=0;i<14;i++){ const x=250+i*66, y=600+((i%2)*3);
  E.push(person(x,y,78,{dir:1,cloth:i===0?CREAM:[CREAM,RED2,OCHRE2,BLUE][i%4],hat:i===0?"hood":"none",arm1:i===0?-30:0,arm2:0,woman:i%3===0})); }
// cross and banner
E.push('<path d="M430,540 v-64 M414,494 h32" stroke="'+BROWN2+'" stroke-width="6"/>');
E.push('<path d="M806,540 v-58 M806,482 h44 v20 h-44 Z" fill="'+RED2+'"/>');
E.push('<g transform="translate(600,556)"><path d="M-40,0 h80 v-34 h-80 Z" fill="'+RED2+'"/><path d="M-44,-34 h88 l-8,-10 h-72 Z" fill="'+CREAM+'"/><path d="M-46,0 v-10 h4 V0 Z M42,0 v-10 h4 V0 Z" fill="'+BROWN2+'"/></g>');
E.push('<path d="M470,556 v-70 M470,486 h40 v22 h-40 Z" fill="'+BLUE+'"/>');
// 4. overturned cart (foreground centre-left)
E.push('<g transform="translate(470,1010) rotate(-14)">');
E.push('<path d="M-90,0 h180 v34 h-180 Z" fill="'+BROWN+'"/>');
E.push('<circle cx="-58" cy="48" r="26" fill="none" stroke="'+BROWN2+'" stroke-width="6"/><circle cx="62" cy="48" r="26" fill="none" stroke="'+BROWN2+'" stroke-width="6"/>');
E.push('</g>');
for(let i=0;i<7;i++) E.push('<ellipse cx="'+(330+i*36)+'" cy="'+(1058+((i*13)%22))+'" rx="19" ry="14" fill="'+(i%2?OCHRE2:RED2)+'"/>');
E.push(person(320,1080,150,{dir:-1,pal:[BROWN],arm1:-30,arm2:20,hat:"cap",hatCol:RED}));
// 5. the dog chase helper? extra children near stalls
E.push(person(700,980,120,{dir:1,pal:[GREEN2],arm1:-14,arm2:8,hat:"straw"}));
// church-door crowd (densest point of the crowd rule)
for(let i=0;i<34;i++){ const x=650+R()*270, y=452+R()*90; const h=36+R()*14;
  E.push(person(x,y,h,{dir:R()<0.5?1:-1,hat:R()<0.3?"cap":"none",hatCol:hatCols?hatCols[Math.floor(R()*5)]:BROWN2,woman:R()<0.45,arm1:(R()-0.5)*8,arm2:(R()-0.5)*8})); }
// atmospheric wash over the far plane
E.push('<rect x="0" y="440" width="1600" height="120" fill="#d8cdb2" opacity="0.10"/>');
// ---------- find-it: nine red caps, nine jobs ----------
const redCaps=[
  [252,858,96,"woman",-6],        // market woman behind stall 1
  [700,486,52,"porter",30],       // porter at the church door crowd
  [268,822,64,"child",-18],       // one of the dog-chasing children
  [398,1082,150,"carter",-24],    // the carter by the overturned cart
  [1012,812,84,"merchant",8],     // merchant at stall 4
  [166,300,20,"miller",0],        // miller at the windmill (tiny)
  [1372,352,24,"watcher",0],      // figure at the gallows
  [856,596,62,"banner",-12],      // banner carrier in the procession
  [1210,1148,210,"porter",-14]    // foreground cropped carrier
];
redCaps.forEach(function(rc){
  E.push(person(rc[0],rc[1],rc[2],{dir:1,hat:"cap",hatCol:RED,woman:rc[3]==="woman",child:rc[3]==="child",
    arm1:rc[4]/2,arm2:-rc[4]/2,prop:rc[3]==="porter"?"bundle":"none",stride:rc[3]==="child"?rc[2]*0.09:0}));
});
// foreground cropped figures (large, dark-ish)
E.push(person(250,1230,285,{dir:1,woman:true,cloth:BROWN,arm1:-8,arm2:16,hat:"wide"}));
E.push(person(560,1240,300,{dir:-1,cloth:BROWN2,arm1:20,arm2:-14,hat:"straw",prop:"basket"}));
E.push(person(880,1230,240,{dir:1,cloth:GREY,arm1:-16,arm2:10,hat:"cap"}));
E.push(person(1040,1230,220,{dir:1,child:true,cloth:RED2,arm1:-10,arm2:8}));
// dog larger + fight larger, in the remaining clearings
E.push(dog(300,880,34));
E.push(person(1300,730,150,{dir:1,cloth:RED2,arm1:-40,arm2:34,lean:12,stride:8,hat:"none"}));
E.push(person(1360,742,156,{dir:-1,cloth:GREY,arm1:36,arm2:-30,lean:-10,stride:10,hat:"wide"}));
E.push(person(1246,752,140,{dir:1,cloth:BROWN,arm1:22,arm2:12,hat:"cap"}));
E.push(person(1420,754,138,{dir:-1,cloth:GREEN2,arm1:14,arm2:18,hat:"none"}));
// keyblock/border
E.push('<rect x="0" y="0" width="1600" height="1200" fill="none" stroke="'+INK+'" stroke-width="8"/>');
E.push('<rect width="1600" height="1200" filter="url(#grain)" opacity="0.16"/>');
E.push('<rect x="8" y="8" width="1584" height="1184" fill="none" stroke="#2b2720" stroke-width="3" opacity="0.7"/>');
const svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 1200" width="1600" height="1200"><defs>'+defs+'</defs>'+E.join("\n")+'</svg>';
writeFileSync(process.argv[2]||"feria.svg", svg);
console.log("elements",E.length,"bytes",svg.length);
