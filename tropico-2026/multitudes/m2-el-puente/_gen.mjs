// M2 El Puente — generator v1 (ukiyo-e crowd print, rain, bridge, herons)
import {writeFileSync} from "node:fs";
const PAPER="#ece4d2", INK="#1c1a18", KEY="#23211d";
const SKY="#c6cdcc", SKY2="#dcd9cb", WATER="#2b4a6b", WATER2="#3d6084", WAVE="#8aa6bb";
const WOOD="#8a6438", WOOD2="#5d4326", CREAM="#e8dfc8", RED="#b33a2a", INDIGO="#2b4f7a", GREY="#9aa3a2";
function rng(seed){ let a=seed>>>0; return function(){ a|=0; a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
const R=rng(7717);
const E=[];
const defs='<filter id="grain" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB"><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="3" seed="4" stitchTiles="stitch"/><feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0.26 0.26 0.26 0 0"/></filter>';
// ---------- figure ----------
function figure(x,y,h,o){
  o=o||{};
  const robe=o.robe||[INDIGO,WOOD2,GREY,"#4a5a66"][Math.floor(R()*4)];
  const skin=o.skin||"#d8b48a";
  const hr=h*0.07, sh=y-h*0.74, hip=y-h*0.42, sw=h*0.11;
  const dir=o.dir||1, lean=o.lean||0;
  let g='<g>';
  // legs / geta
  g+='<path d="M'+(x-h*0.035)+','+hip+' L'+(x+h*0.005)+','+hip+' L'+(x-h*0.005+lean)+','+y+' L'+(x-h*0.06+lean)+','+y+' Z" fill="'+skin+'"/>';
  g+='<path d="M'+(x+h*0.02)+','+hip+' L'+(x+h*0.06)+','+hip+' L'+(x+h*0.06+lean)+','+y+' L'+(x+h*0.005+lean)+','+y+' Z" fill="'+skin+'"/>';
  // robe
  g+='<path d="M'+(x-sw)+','+(sh+h*0.05)+' L'+(x+sw)+','+(sh+h*0.05)+' L'+(x+sw*1.35)+','+(hip+h*0.06)+' L'+(x-sw*1.35)+','+(hip+h*0.06)+' Z" fill="'+robe+'"/>';
  g+='<path d="M'+(x-sw*0.4)+','+(sh+h*0.06)+' L'+(x+sw*0.1)+','+(sh+h*0.06)+' L'+(x+sw*0.4)+','+(hip+h*0.06)+'" stroke="'+INK+'" stroke-width="'+(h*0.012)+'" fill="none" opacity="0.6"/>';
  // arms
  const a1=o.arm1||0, a2=o.arm2||0;
  g+='<path d="M'+(x-sw*0.9)+','+(sh+h*0.08)+' L'+(x-sw*0.9+a1)+','+(sh+h*0.30)+'" stroke="'+robe+'" stroke-width="'+(h*0.055)+'" stroke-linecap="round"/>';
  g+='<path d="M'+(x+sw*0.9)+','+(sh+h*0.08)+' L'+(x+sw*0.9+a2)+','+(sh+h*0.30)+'" stroke="'+robe+'" stroke-width="'+(h*0.055)+'" stroke-linecap="round"/>';
  // head, hair
  const hy=sh-h*0.01;
  g+='<circle cx="'+(x+lean*0.5)+'" cy="'+hy+'" r="'+hr+'" fill="'+skin+'"/>';
  g+='<path d="M'+(x-hr*1.05+lean*0.5)+','+(hy-hr*0.1)+' q'+(hr*1.05)+',-'+hr*1.2+' '+(hr*2.1)+',0 q-'+hr*0.3+',-'+hr*0.3+' -'+hr*0.6+',-'+hr*0.2+' q-'+hr*0.6+','+hr*0.1+' -'+hr*1.5+','+hr*0.2+' Z" fill="'+INK+'"/>';
  if(o.hat==="kasa") g+='<path d="M'+(x-hr*2.6)+','+(hy-hr*0.2)+' q'+(hr*2.6)+',-'+hr*1.8+' '+(hr*5.2)+',0 Z" fill="'+WOOD+'"/><path d="M'+(x-hr*2.6)+','+(hy-hr*0.2)+' h'+(hr*5.2)+'" stroke="'+INK+'" stroke-width="2"/>';
  if(o.hat==="hood") g+='<path d="M'+(x-hr*1.4)+','+(hy+hr*0.5)+' q0,'+(-hr*2.4)+' '+(hr*1.4)+','+(-hr*2.4)+' q'+(hr*1.4)+',0 '+(hr*1.4)+','+(hr*2.4)+' Z" fill="'+robe+'"/>';
  if(o.monk) g+='<circle cx="'+(x+lean*0.5)+'" cy="'+hy+'" r="'+hr+'" fill="'+skin+'"/>';
  // umbrella
  if(o.umb){
    const uc=o.umb, uw=h*0.62, uy=sh-h*0.04;
    g+='<path d="M'+(x-uw)+','+uy+' Q'+x+','+(uy-uw*0.55)+' '+(x+uw)+','+uy+' Q'+x+','+(uy+uw*0.10)+' '+(x-uw)+','+uy+' Z" fill="'+uc+'" stroke="'+INK+'" stroke-width="2"/>';
    g+='<path d="M'+x+','+(uy+uw*0.05)+' L'+x+','+uy+'" stroke="'+INK+'" stroke-width="2.4"/>';
    g+='<path d="M'+(x-uw*0.55)+','+(uy-uw*0.30)+' Q'+x+','+(uy-uw*0.40)+' '+(x+uw*0.55)+','+(uy-uw*0.30)+'" stroke="'+INK+'" stroke-width="1.4" fill="none" opacity="0.6"/>';
    g+='<path d="M'+(x-uw*0.9)+','+(uy-uw*0.02)+' Q'+x+','+(uy-uw*0.35)+' '+(x+uw*0.9)+','+(uy-uw*0.02)+'" stroke="'+INK+'" stroke-width="1.2" fill="none" opacity="0.5"/>';
  }
  if(o.porter){
    g+='<path d="M'+(x-sw*1.4)+','+(sh-h*0.02)+' L'+(x+sw*1.4)+','+(sh-h*0.06)+'" stroke="'+WOOD2+'" stroke-width="'+(h*0.025)+'"/>';
    g+='<path d="M'+(x-sw*1.4)+','+(sh-h*0.02)+' v'+(h*0.16)+' h'+(h*0.10)+' v-'+(h*0.16)+' Z" fill="'+WOOD+'"/>';
    g+='<path d="M'+(x+sw*1.4)+','+(sh-h*0.06)+' v'+(h*0.16)+' h'+(h*0.10)+' v-'+(h*0.16)+' Z" fill="'+WOOD+'"/>';
  }
  if(o.samurai){
    g+='<path d="M'+(x-sw*1.6)+','+(sh+h*0.22)+' L'+(x-sw*1.9)+','+(sh+h*0.30)+' L'+(x-sw*0.9)+','+(sh+h*0.16)+' Z" fill="'+INK+'"/>';
    g+='<path d="M'+(x+sw*0.4)+','+(hip+h*0.02)+' L'+(x+sw*1.6)+','+(hip-h*0.02)+' L'+(x+sw*1.6)+','+(hip+h*0.02)+' L'+(x+sw*0.4)+','+(hip+h*0.06)+' Z" fill="'+INK+'"/>';
  }
  if(o.staff) g+='<path d="M'+(x+sw*1.5)+','+(sh-h*0.16)+' L'+(x+sw*1.5)+','+y+'" stroke="'+WOOD2+'" stroke-width="'+(h*0.022)+'"/>';
  if(o.bundle) g+='<path d="M'+(x-sw*1.0)+','+(sh+h*0.02)+' q'+(h*0.06)+',-'+h*0.1+' '+(h*0.12)+',0 l0,'+(h*0.12)+' q-'+(h*0.06)+','+h*0.04+' -'+(h*0.12)+',0 Z" fill="'+RED+'"/>';
  g+='</g>'; return g;
}
function dog(x,y,s){ return '<g fill="'+WOOD2+'"><ellipse cx="'+x+'" cy="'+(y-s*0.3)+'" rx="'+(s*0.55)+'" ry="'+(s*0.22)+'"/><circle cx="'+(x+s*0.55)+'" cy="'+(y-s*0.5)+'" r="'+(s*0.14)+'"/><path d="M'+(x-s*0.3)+','+(y-s*0.2)+' v'+(s*0.2)+' M'+(x+s*0.25)+','+(y-s*0.2)+' v'+(s*0.2)+'" stroke="'+WOOD2+'" stroke-width="'+(s*0.08)+'"/><path d="M'+(x-s*0.5)+','+(y-s*0.5)+' q-'+(s*0.2)+',-'+(s*0.2)+' -'+(s*0.15)+',-'+(s*0.3)+'" stroke="'+WOOD2+'" stroke-width="'+(s*0.06)+'" fill="none"/></g>'; }
function heron(x,y,s,flip,pose){
  let g='<g transform="translate('+x+','+y+') scale('+(flip?-s:s)+','+s+')">';
  g+='<ellipse cx="0" cy="0" rx="16" ry="9" fill="'+PAPER+'" stroke="'+INK+'" stroke-width="1.4"/>';
  g+='<path d="M10,-4 Q22,-16 26,-2" fill="none" stroke="'+PAPER+'" stroke-width="5"/>';
  g+='<circle cx="27" cy="-2" r="4.5" fill="'+PAPER+'" stroke="'+INK+'" stroke-width="1.2"/>';
  g+='<path d="M31,-2 L40,0 L31,2 Z" fill="'+INK+'"/>';
  if(pose==="fly"){
    g+='<path d="M-6,-6 Q-22,-26 -34,-18 Q-24,-8 -8,0 Z" fill="'+PAPER+'" stroke="'+INK+'" stroke-width="1.2"/>';
    g+='<path d="M-6,4 Q-22,20 -34,16 Q-24,6 -8,-1 Z" fill="'+PAPER+'" stroke="'+INK+'" stroke-width="1.2"/>';
  } else {
    g+='<path d="M-2,8 L-4,30 M4,8 L2,30" stroke="'+INK+'" stroke-width="2"/>';
  }
  return g+'</g>';
}
// ---------- sky ----------
E.push('<rect width="1600" height="1200" fill="'+SKY+'"/>');
E.push('<rect y="0" width="1600" height="300" fill="'+SKY2+'" opacity="0.6"/>');
// far bank + festival (top right)
E.push('<path d="M900,430 Q960,360 1000,320 Q1200,264 1600,272 L1600,430 Z" fill="#7f8a72"/>');
E.push('<path d="M900,430 Q960,360 1000,320 Q1200,264 1600,272" stroke="'+INK+'" stroke-width="3" fill="none"/>');
// village rooflines on the far bank
E.push('<path d="M1000,300 l30,-26 l30,26 Z M1090,300 l26,-22 l26,22 Z M1180,296 l24,-20 l24,20 Z M1420,292 l26,-22 l26,22 Z" fill="'+WOOD2+'"/>');
E.push('<rect x="1000" y="300" width="60" height="30" fill="'+WOOD+'"/><rect x="1090" y="300" width="52" height="30" fill="'+WOOD+'"/><rect x="1420" y="292" width="52" height="38" fill="'+WOOD+'"/>');
// pavilion
E.push('<path d="M1240,270 q60,-60 120,0 Z" fill="'+WOOD2+'"/><rect x="1250" y="270" width="100" height="34" fill="'+WOOD+'"/>');
// lantern strings
E.push('<path d="M990,300 Q1250,340 1600,300" stroke="'+INK+'" stroke-width="1.4" fill="none"/>');
E.push('<path d="M1000,316 Q1260,356 1600,316" stroke="'+INK+'" stroke-width="1.2" fill="none"/>');
// festival crowd + lanterns
for(let i=0;i<26;i++){ const x=1000+i*23, y=330+((i*17)%60); E.push(figure(x,y,26+((i*7)%10),{robe:[RED,INDIGO,CREAM,WOOD2][i%4],dir:i%2?1:-1})); }
for(let i=0;i<12;i++){ const x=1010+i*50, y=300+((i*23)%40); E.push('<circle cx="'+x+'" cy="'+y+'" r="7" fill="'+RED+'" stroke="'+INK+'" stroke-width="1.2"/><path d="M'+x+','+(y-7)+' v-8" stroke="'+INK+'" stroke-width="1"/>'); }
// ---------- water ----------
E.push('<path d="M0,430 L1600,430 L1600,1200 L0,1200 Z" fill="'+WATER+'"/>');
for(let i=0;i<22;i++){ const y=450+i*36; E.push('<path d="M0,'+y+' Q400,'+(y-10)+' 800,'+y+' T1600,'+y+'" stroke="'+WAVE+'" stroke-width="2" fill="none" opacity="0.5"/>'); }
// boats + fisherman
E.push('<g transform="translate(1120,980) rotate(-4)"><path d="M-100,0 Q0,30 100,0 L78,24 Q0,44 -78,24 Z" fill="'+WOOD2+'" stroke="'+INK+'" stroke-width="2"/><path d="M0,-4 v-50" stroke="'+INK+'" stroke-width="3"/><circle cx="0" cy="-58" r="7" fill="'+RED+'" stroke="'+INK+'" stroke-width="1.4"/></g>');
E.push('<g transform="translate(660,1085) rotate(4)"><path d="M-86,0 Q0,26 86,0 L66,22 Q0,40 -66,22 Z" fill="'+WOOD2+'" stroke="'+INK+'" stroke-width="2"/><path d="M-20,-2 v-38" stroke="'+INK+'" stroke-width="3"/></g>');
// fisherman in the boat, hauling a net
E.push(figure(660,1045,96,{robe:INDIGO,hat:"kasa",staff:true,dir:-1}));
E.push('<path d="M630,1020 L520,1100 L600,1140 L710,1070" stroke="'+INK+'" stroke-width="1.6" fill="none" opacity="0.8"/>');
for(let i=0;i<6;i++) E.push('<path d="M'+(540+i*24)+','+(1094+i*7)+' l10,-16" stroke="'+INK+'" stroke-width="1.2" opacity="0.7"/>');
E.push('<path d="M650,1030 Q610,1000 560,1010" stroke="'+INK+'" stroke-width="2" fill="none"/>');
// reeds bottom-left
for(let i=0;i<24;i++){ const x=30+i*17, y=1200; E.push('<path d="M'+x+','+y+' q'+((i%3)-1)*8+',-'+(120+(i*13)%90)+' '+((i%2)?-10:12)+',-'+(170+(i*17)%110)+'" stroke="'+(i%2?"#6b6b3a":"#4d5a30")+'" stroke-width="3" fill="none"/>'); }
// lantern reflections
for(let i=0;i<9;i++){ const x=1020+i*54; E.push('<path d="M'+x+',440 l4,18" stroke="'+RED+'" stroke-width="3" opacity="0.5"/><path d="M'+(x-4)+',470 l3,12" stroke="'+RED+'" stroke-width="2" opacity="0.3"/>'); }
// ---------- bridge ----------
const nl=[-300,1200], nr=[300,1200], fl=[1130,430], fr=[1230,430];
const deck='M'+nl+' L'+nr+' L'+fr+' L'+fl+' Z';
E.push('<path d="'+deck+'" fill="'+WOOD+'"/>');
// planks
for(let i=0;i<26;i++){ const t=i/26; const a=[nl[0]+(fl[0]-nl[0])*t, nl[1]+(fl[1]-nl[1])*t], b=[nr[0]+(fr[0]-nr[0])*t, nr[1]+(fr[1]-nr[1])*t];
  E.push('<path d="M'+a[0]+','+a[1]+' L'+b[0]+','+b[1]+'" stroke="'+WOOD2+'" stroke-width="'+(1+t*2)+'" opacity="0.7"/>'); }
// railings + bay posts
function railing(A,B,side){
  for(let i=0;i<=8;i++){ const t=i/8; const x=A[0]+(B[0]-A[0])*t, y=A[1]+(B[1]-A[1])*t;
    const h=(1-t)*62+t*18;
    E.push('<path d="M'+x+','+y+' v-'+h+'" stroke="'+WOOD2+'" stroke-width="'+(5-t*3)+'"/>');
    E.push('<circle cx="'+x+'" cy="'+(y-h)+'" r="'+(3.5-t*2)+'" fill="'+INK+'"/>'); }
}
// near railing (left edge) and far railing (right edge)
E.push('<path d="M'+nl[0]+','+(nl[1]-62)+' L'+fl[0]+','+(fl[1]-18)+'" stroke="'+INK+'" stroke-width="11"/>');
E.push('<path d="M'+nr[0]+','+(nr[1]-62)+' L'+fr[0]+','+(fr[1]-18)+'" stroke="'+INK+'" stroke-width="11"/>');
railing(nl,fl); railing(nr,fr);
// ---------- crowd on the bridge ----------
const umbSeq=[RED,INDIGO,CREAM];
let ui=0;
const people=[];
// 8 bays of 5
for(let bay=0;bay<8;bay++){
  for(let j=0;j<5;j++){
    const t=(bay+(j+0.5)/5)/8;
    const lx=nl[0]+(fl[0]-nl[0])*t, rx=nr[0]+(fr[0]-nr[0])*t;
    const cx=lx+(rx-lx)*(0.18+0.64*((j*0.37+bay*0.21)%1));
    const h=(1-t)*175+t*52;
    const y=1200+(430-1200)*t;
    const dir=(bay+j)%2?1:-1;
    const kind=(bay*5+j)%13;
    const o={dir:dir,robe:[INDIGO,WOOD2,GREY,"#4a5a66",CREAM][(bay+j)%5]};
    if(kind===0) o.hat="kasa";
    if(kind===1) o.porter=true;
    if(kind===2) o.hat="hood";
    if(kind===3) o.monk=true;
    if(kind===4) o.samurai=true;
    if(kind===5) o.staff=true;
    if(kind===6) o.bundle=true;
    if(kind===7) o.child=true;
    // umbrella sequence
    if((bay+j)%2===0){ o.umb=umbSeq[ui%3]; ui++; }
    people.push([cx,y,h,o]);
  }
}
// the named figures
people.push([-20,1180,210,{dir:1,robe:INDIGO,umb:RED,samurai:true,hat:"kasa"}]);
people.push([120,1150,200,{dir:-1,robe:WOOD2,porter:true}]);
people.push([600,880,130,{dir:1,robe:CREAM,monk:true,staff:true}]);
people.push([760,800,118,{dir:-1,robe:INDIGO,umb:CREAM,hat:"kasa"}]);
people.push([520,930,145,{dir:1,robe:RED,bundle:true,child:true}]);
people.sort(function(a,b){return a[1]-b[1];});
people.forEach(function(p){ E.push(figure(p[0],p[1],p[2],p[3])); });
E.push(dog(430,1010,30));
// bridge reflection under the deck
E.push('<path d="M-20,1210 L200,1210 L1180,470 L1080,470 Z" fill="#152c44" opacity="0.35"/>');
// mist near the far bank
E.push('<rect x="0" y="380" width="1600" height="120" fill="#dfe3dc" opacity="0.35"/>');
// ---------- rain ----------
for(let i=0;i<240;i++){ const x=R()*1900-150, y=R()*1250-25, L=40+R()*110;
  E.push('<path d="M'+x+','+y+' l'+(L*0.32)+','+L+'" stroke="'+(R()<0.5?"#dfe4df":"#aeb9ba")+'" stroke-width="'+(1+R()*1.4)+'" opacity="'+(0.28+R()*0.3)+'"/>'); }
// ---------- herons (find-it: 7, always at the edge) ----------
E.push(heron(34,240,1.15,false,"fly"));
E.push(heron(70,1010,1.35,true,"stand"));
E.push(heron(1548,332,1.0,true,"fly"));
E.push(heron(1512,1080,1.1,true,"stand"));
E.push(heron(806,36,0.85,false,"fly"));
E.push(heron(1580,700,0.7,true,"fly"));
E.push(heron(24,610,0.9,false,"fly"));
// foreground anchor (cropped)
E.push(figure(170,1258,290,{dir:1,robe:WOOD2,porter:true,hat:"kasa"}));
// ---------- frame + grain ----------
E.push('<rect x="0" y="0" width="1600" height="1200" fill="none" stroke="'+INK+'" stroke-width="7"/>');
E.push('<rect width="1600" height="1200" filter="url(#grain)" opacity="0.15"/>');
const svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 1200" width="1600" height="1200"><defs>'+defs+'</defs>'+E.join("\n")+'</svg>';
writeFileSync(process.argv[2]||"puente.svg", svg);
console.log("elements",E.length,"people",people.length,"bytes",svg.length);
