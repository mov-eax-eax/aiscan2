
import fs from 'node:fs';
const OUT='F:/repo-aiscan2/tropico-2026/iterations/06-jardin-de-datos/jardin-de-datos.svg';
const f=n=>Math.round(n*10)/10;
const TAU=Math.PI*2;
const C={
  cream:'#F3E8CA', creamDk:'#E8DAB6', soil:'#E4D3AC',
  ink:'#17140F', greenDeep:'#153728', green:'#2C5F44', greenMid:'#4A7B54', sage:'#A6BC8C',
  coral:'#DE5B39', coralLt:'#EE8A66',
  gold:'#C6933C', goldLt:'#E2BE74'
};
const P=[],S=(...a)=>P.push(...a);

// ---------- curve helpers ----------
function crPoint(pts,t){
  // catmull-rom, t in [0, n-1]
  const n=pts.length;
  const i=Math.min(Math.floor(t),n-2);
  const u=t-i;
  const p0=pts[Math.max(0,i-1)],p1=pts[i],p2=pts[i+1],p3=pts[Math.min(n-1,i+2)];
  const u2=u*u,u3=u2*u;
  return [0.5*((2*p1[0])+(-p0[0]+p2[0])*u+(2*p0[0]-5*p1[0]+4*p2[0]-p3[0])*u2+(-p0[0]+3*p1[0]-3*p2[0]+p3[0])*u3),
          0.5*((2*p1[1])+(-p0[1]+p2[1])*u+(2*p0[1]-5*p1[1]+4*p2[1]-p3[1])*u2+(-p0[1]+3*p1[1]-3*p2[1]+p3[1])*u3)];
}
function sampleCurve(pts,steps=60){
  const out=[]; const n=pts.length-1;
  for(let i=0;i<=steps;i++) out.push(crPoint(pts,(i/steps)*n));
  return out;
}
function pathCurve(pts,steps=48){
  const sm=sampleCurve(pts,steps);
  let d='M'+f(sm[0][0])+' '+f(sm[0][1]);
  for(let i=1;i<sm.length;i++) d+='L'+f(sm[i][0])+' '+f(sm[i][1]);
  return d;
}
// tube with varying width along a catmull-rom
function tube(pts,w0,w1,steps=44){
  const sm=sampleCurve(pts,steps), L=[],R=[];
  for(let i=0;i<sm.length;i++){
    const t=i/(sm.length-1);
    const a=sm[Math.max(0,i-1)],b=sm[Math.min(sm.length-1,i+1)];
    let dx=b[0]-a[0],dy=b[1]-a[1]; const dl=Math.hypot(dx,dy)||1; dx/=dl;dy/=dl;
    const nx=-dy,ny=dx;
    const w=(w0+(w1-w0)*(t*t*(3-2*t)))/2;
    L.push([sm[i][0]+nx*w,sm[i][1]+ny*w]);
    R.push([sm[i][0]-nx*w,sm[i][1]-ny*w]);
  }
  let d='M'+f(L[0][0])+' '+f(L[0][1]);
  for(let i=1;i<L.length;i++)d+='L'+f(L[i][0])+' '+f(L[i][1]);
  for(let i=R.length-1;i>=0;i--)d+='L'+f(R[i][0])+' '+f(R[i][1]);
  return d+'Z';
}
// art nouveau leaf, base at origin pointing +x
function leafPath(len,w,curl=0.0){
  const tipX=len, midA=[len*0.30,-w], midB=[len*0.72,-w*0.72];
  const mC=[len*0.30,w], mD=[len*0.72,w*0.72];
  return 'M0 0 C'+f(midA[0])+' '+f(midA[1])+' '+f(midB[0])+' '+f(midB[1])+' '+f(tipX)+' '+f(curl)+
         ' C'+f(mD[0])+' '+f(mD[1])+' '+f(mC[0])+' '+f(mC[1])+' 0 0 Z';
}
function rot(x,y,ang){ // returns a transform string
  return 'translate('+f(x)+','+f(y)+') rotate('+f(ang)+')';
}
let clipN=0;
function solarLeaf(x0,y0,ang,len,w,fill,vein){
  const id='lc'+(clipN++);
  const d=leafPath(len,w);
  S('<clipPath id="'+id+'"><path d="'+d+'"/></clipPath>');
  S('<g transform="'+rot(x0,y0,ang)+'">');
  S('<path d="'+d+'" fill="'+fill+'" stroke="'+C.ink+'" stroke-width="2.1"/>');
  S('<g clip-path="url(#'+id+')" stroke="'+C.ink+'" stroke-width="0.8" opacity="0.75">');
  for(let i=1;i<5;i++){ const yy=-w*0.66+i*(w*1.32/5); S('<path d="M-4 '+f(yy)+' L'+f(len*0.99)+' '+f(yy*0.42)+'"/>'); }
  for(let i=1;i<6;i++){ const xx=len*i/6; S('<path d="M'+f(xx)+' '+f(-w*1.2)+' L'+f(xx+len*0.05)+' '+f(w*1.2)+'"/>'); }
  S('</g>');
  S('<path d="M2 0 Q'+f(len*0.42)+' '+f(-w*0.20)+' '+f(len*0.96)+' 0" fill="none" stroke="'+(vein||C.gold)+'" stroke-width="2.1"/>');
  S('<path d="M'+f(len*0.99)+' 0 l'+f(w*0.30)+' '+f(-w*0.16)+'" stroke="'+C.ink+'" stroke-width="1.4"/>');
  S('</g>');
  return id;
}
function spiral(x0,y0,ang,len,r0,r1,turns,dir,stroke=1.5){
  const pts=[]; const N=90;
  for(let i=0;i<=N;i++){
    const t=i/N;
    const th=dir*turns*TAU*t;
    const r=(r0+(r1-r0)*t);
    const lx=len*t+Math.cos(th)*r, ly=Math.sin(th)*r;
    const a=ang*Math.PI/180;
    pts.push([x0+Math.cos(a)*lx-Math.sin(a)*ly, y0+Math.sin(a)*lx+Math.cos(a)*ly]);
  }
  let d='M'+f(pts[0][0])+' '+f(pts[0][1]);
  for(let i=1;i<pts.length;i++)d+='L'+f(pts[i][0])+' '+f(pts[i][1]);
  return '<path d="'+d+'" fill="none" stroke="'+C.ink+'" stroke-width="'+stroke+'"/>';
}
function optic(x,y,r=5){
  S('<circle cx="'+f(x)+'" cy="'+f(y)+'" r="'+r+'" fill="'+C.cream+'" stroke="'+C.ink+'" stroke-width="1.3"/>');
  S('<circle cx="'+f(x)+'" cy="'+f(y)+'" r="'+(r*0.42)+'" fill="'+C.coral+'"/>');
}
// fern frond: rachis + pinnules
function fern(x0,y0,ang,len,n,sc){
  const a=ang*Math.PI/180;
  const sm=[];
  for(let i=0;i<=n;i++){
    const t=i/n;
    const curl=Math.sin(t*1.1)*len*0.10;
    const lx=len*t, ly=curl- len*0.10*t*t;
    sm.push([x0+Math.cos(a)*lx-Math.sin(a)*ly, y0+Math.sin(a)*lx+Math.cos(a)*ly, t]);
  }
  // rachis
  let d='M'+f(sm[0][0])+' '+f(sm[0][1]);
  for(const p of sm)d+='L'+f(p[0])+' '+f(p[1]);
  S('<path d="'+d+'" fill="none" stroke="'+C.ink+'" stroke-width="1.7"/>');
  for(let i=1;i<n;i++){
    const p=sm[i];
    const sgn=(i%2===0)?1:-1;
    const pl=len*(0.24-0.16*p[2]);
    const pa=ang+sgn*68;
    S('<g transform="'+rot(p[0],p[1],pa)+'">');
    S('<path d="'+leafPath(pl,pl*0.30)+'" fill="'+C.greenMid+'" stroke="'+C.ink+'" stroke-width="1.3"/>');
    S('<path d="M0 0 L'+f(pl*0.86)+' 0" stroke="'+C.ink+'" stroke-width="0.8"/>');
    S('</g>');
  }
}
// dish flower head
function dishFlower(cx,cy,r){
  // outer ring of long narrow petals
  for(let i=0;i<12;i++){
    const a=-180+i*(360/12)+7.5;
    const pl=r*(i%2?1.52:1.30);
    S('<g transform="'+rot(cx,cy,a)+'">');
    S('<path d="'+leafPath(pl,r*(i%2?0.17:0.13))+'" fill="'+(i%3===0?C.coralLt:C.coral)+'" stroke="'+C.ink+'" stroke-width="1.9"/>');
    S('<path d="M'+f(pl*0.26)+' 0 Q'+f(pl*0.66)+' '+f(-r*0.07)+' '+f(pl*0.90)+' 0" fill="none" stroke="'+C.ink+'" stroke-width="0.8"/>');
    S('</g>');
  }
  // inner ring of short petals
  for(let i=0;i<10;i++){
    const a=-180+i*36+18;
    S('<g transform="'+rot(cx,cy,a)+'">');
    S('<path d="'+leafPath(r*0.62,r*0.12)+'" fill="'+C.coralLt+'" stroke="'+C.ink+'" stroke-width="1.5"/>');
    S('</g>');
  }
  // dish bowl
  S('<ellipse cx="'+cx+'" cy="'+cy+'" rx="'+r+'" ry="'+(r*0.42)+'" fill="'+C.gold+'" stroke="'+C.ink+'" stroke-width="2.2"/>');
  S('<ellipse cx="'+cx+'" cy="'+(cy-r*0.10)+'" rx="'+(r*0.86)+'" ry="'+(r*0.32)+'" fill="'+C.goldLt+'" stroke="'+C.ink+'" stroke-width="1.2"/>');
  // rim segments
  S('<g stroke="'+C.ink+'" stroke-width="1.1" fill="none">');
  for(let i=1;i<8;i++){
    const a=Math.PI*i/8;
    S('<path d="M'+f(cx-Math.cos(a)*r)+' '+f(cy-Math.sin(a)*r*0.42)+' L'+f(cx-Math.cos(a)*r*0.84)+' '+f(cy-Math.sin(a)*r*0.34)+'"/>');
    S('<path d="M'+f(cx+Math.cos(a)*r)+' '+f(cy+Math.sin(a)*r*0.42)+' L'+f(cx+Math.cos(a)*r*0.84)+' '+f(cy+Math.sin(a)*r*0.34)+'"/>');
  }
  S('</g>');
  // paraboloid rings
  S('<g stroke="'+C.ink+'" stroke-width="1.1" fill="none" opacity="0.8">');
  S('<ellipse cx="'+cx+'" cy="'+(cy-r*0.10)+'" rx="'+(r*0.58)+'" ry="'+(r*0.20)+'"/>');
  S('<ellipse cx="'+cx+'" cy="'+(cy-r*0.10)+'" rx="'+(r*0.30)+'" ry="'+(r*0.105)+'"/>');
  S('</g>');
  // LNB on its tripod, standing out of the dish
  S('<g stroke="'+C.ink+'" stroke-width="2" fill="none">');
  S('<path d="M'+f(cx-r*0.60)+' '+f(cy-r*0.16)+' L'+cx+' '+f(cy-r*0.92)+' L'+f(cx+r*0.60)+' '+f(cy-r*0.16)+'"/>');
  S('</g>');
  S('<rect x="'+f(cx-8)+'" y="'+f(cy-r*0.92-14)+'" width="16" height="20" rx="3" fill="'+C.coral+'" stroke="'+C.ink+'" stroke-width="1.8"/>');
  S('<circle cx="'+cx+'" cy="'+f(cy-r*0.92-4)+'" r="3" fill="'+C.cream+'"/>');
}
// router pod
function pod(cx,cy,r){
  S('<ellipse cx="'+cx+'" cy="'+cy+'" rx="'+(r*0.72)+'" ry="'+r+'" fill="'+C.greenDeep+'" stroke="'+C.ink+'" stroke-width="2.1"/>');
  S('<path d="M'+f(cx-r*0.14)+' '+f(cy-r)+' q'+f(r*0.30)+' '+f(-r*0.9)+' '+f(r*0.42)+' '+f(-r*0.1)+'" fill="none" stroke="'+C.ink+'" stroke-width="1.6"/>');
  S('<path d="M'+f(cx+r*0.16)+' '+f(cy-r)+' q'+f(r*0.40)+' '+f(-r*1.0)+' '+f(r*0.50)+' '+f(-r*0.16)+'" fill="none" stroke="'+C.ink+'" stroke-width="1.6"/>');
  S('<g stroke="'+C.ink+'" stroke-width="1" fill="none" opacity="0.9">');
  for(let i=1;i<=3;i++) S('<path d="M'+f(cx-r*0.42)+' '+f(cy-r*1.0-i*7)+' q'+f(r*0.42)+' '+f(-8)+' '+f(r*0.84)+' 0"/>');
  S('</g>');
}
// drip emitter
function emitter(x,y,ang){
  S('<g transform="'+rot(x,y,ang)+'">');
  S('<path d="M0 0 q8 6 0 14 q-8 -8 0 -14" fill="'+C.gold+'" stroke="'+C.ink+'" stroke-width="1.3"/>');
  S('<circle cx="0" cy="17" r="2" fill="'+C.coral+'"/>');
  S('</g>');
}

// ================= PAGE =================
S('<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1200" viewBox="0 0 1600 1200">');
S('<defs>');
S('<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">');
S('<stop offset="0" stop-color="#F8F2DE"/><stop offset="0.55" stop-color="#F1E7C8"/><stop offset="1" stop-color="#EDE1BE"/>');
S('</linearGradient>');
S('<filter id="grain" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB"><feTurbulence type="fractalNoise" baseFrequency="0.86" numOctaves="3" seed="5" stitchTiles="stitch"/><feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0.36 0.36 0.36 0 0"/></filter>');
// border motif module
S('<g id="bmotif">');
S('<path d="M2 12 C14 50 34 50 46 12" fill="none" stroke="'+C.ink+'" stroke-width="1.6"/>');
S('<path d="M6 12 C16 42 32 42 42 12" fill="none" stroke="'+C.gold+'" stroke-width="2.4"/>');
S('<g transform="translate(24,50) rotate(-90)"><path d="'+leafPath(15,4.4)+'" fill="'+C.green+'" stroke="'+C.ink+'" stroke-width="1"/></g>');
S('<circle cx="24" cy="10" r="3.2" fill="'+C.coral+'" stroke="'+C.ink+'" stroke-width="0.9"/>');
S('</g>');
S('<g id="rosette">');
S('<g stroke="'+C.ink+'" stroke-width="1.4" fill="none">');
for(let i=0;i<8;i++){const a=i*45; S('<path d="M0 0 Q'+f(Math.cos(a*Math.PI/180)*9)+' '+f(Math.sin(a*Math.PI/180)*9)+' '+f(Math.cos(a*Math.PI/180)*17)+' '+f(Math.sin(a*Math.PI/180)*17)+'"/>');}
S('</g>');
S('<circle cx="0" cy="0" r="4" fill="'+C.gold+'" stroke="'+C.ink+'" stroke-width="1.1"/>');
S('</g>');
S('</defs>');

S('<rect width="1600" height="1200" fill="'+C.cream+'"/>');

// ---------- BORDER ----------
const B0=34, B1=90;               // outer rule / inner rule
S('<rect x="'+B0+'" y="'+B0+'" width="'+(1600-2*B0)+'" height="'+(1200-2*B0)+'" fill="none" stroke="'+C.ink+'" stroke-width="2.6"/>');
S('<rect x="'+B1+'" y="'+B1+'" width="'+(1600-2*B1)+'" height="'+(1200-2*B1)+'" fill="none" stroke="'+C.ink+'" stroke-width="1.8"/>');
S('<rect x="'+(B1+4)+'" y="'+(B1+4)+'" width="'+(1600-2*B1-8)+'" height="'+(1200-2*B1-8)+'" fill="none" stroke="'+C.ink+'" stroke-width="0.9"/>');
// top / bottom bands
const MOD=48;
for(let x=B1;x<1500;x+=MOD){
  S('<use xlink:href="#bmotif" transform="translate('+x+','+(B0+2)+')"/>');
  S('<use xlink:href="#bmotif" transform="translate('+x+','+(1200-B0-2)+') scale(1,-1)"/>');
}
for(let y=B1;y<1110;y+=MOD){
  S('<use xlink:href="#bmotif" transform="translate('+(B0+2)+','+(y+48)+') rotate(-90)"/>');
  S('<use xlink:href="#bmotif" transform="translate('+(1600-B0-2)+','+y+') rotate(90)"/>');
}
for(const [cx,cy] of [[B0,B0],[1600-B0,B0],[B0,1200-B0],[1600-B0,1200-B0],[B1+20,B1+20],[1600-B1-20,B1+20],[B1+20,1200-B1-20],[1600-B1-20,1200-B1-20]])
  S('<use xlink:href="#rosette" transform="translate('+cx+','+cy+')"/>');

// ---------- FIELD ----------
const F0=96,F1=1504,G0=96,G1=1104;
S('<rect x="'+F0+'" y="'+G0+'" width="'+(F1-F0)+'" height="'+(G1-G0)+'" fill="url(#sky)"/>');
// faint ornamental fibre field
S('<g stroke="'+C.sage+'" stroke-width="1.4" fill="none" opacity="0.5">');
for(let i=0;i<7;i++){
  const y=200+i*112;
  S('<path d="M'+F0+' '+y+' C'+(F0+280)+' '+(y-46)+' '+(F0+620)+' '+(y+54)+' '+(F1)+' '+(y-8)+'"/>');
}
S('</g>');

// ---------- SOIL + ROOTS ----------
S('<path d="M'+F0+' 980 H'+F1+' V'+G1+' H'+F0+' Z" fill="'+C.soil+'"/>');
S('<path d="M'+F0+' 980 H'+F1+'" stroke="'+C.ink+'" stroke-width="2.4"/>');
// soil hatch
S('<g stroke="'+C.ink+'" stroke-width="0.7" opacity="0.30">');
for(let i=0;i<40;i++){const x=F0+8+i*36; S('<path d="M'+x+' 986 l14 16"/>');}
for(let i=0;i<26;i++){const x=F0+30+i*56; S('<path d="M'+x+' 1030 l-12 14"/>');}
S('</g>');
// roots as a cable mat: strands drop from the stem, then run and knot
S('<g fill="none" stroke="'+C.ink+'" stroke-width="1.5" opacity="0.9">');
for(let i=0;i<17;i++){
  const x=470+i*30;
  S('<path d="M'+x+' 980 C'+(x-26)+' 1006 '+(x+30)+' 1024 '+(x-8)+' 1052 C'+(x-40)+' 1076 '+(x+16)+' 1086 '+(x+2)+' 1102"/>');
}
S('<g opacity="0.85">');
S('<path d="M112 1058 C300 1044 470 1078 700 1060 C900 1044 1120 1080 1470 1062"/>');
S('<path d="M150 1088 C340 1072 520 1102 760 1086 C980 1072 1200 1102 1460 1090"/>');
S('<path d="M460 1022 C620 1010 760 1040 900 1024"/>');
S('</g>');
S('</g>');
for(let i=0;i<9;i++) S('<circle cx="'+(470+i*60-10)+'" cy="'+(1064+((i*17)%22))+'" r="3.6" fill="'+C.gold+'" stroke="'+C.ink+'" stroke-width="0.9"/>');
for(let i=0;i<7;i++) S('<path d="M'+(160+i*190)+' '+(1010+((i*29)%30))+' l14 8 l-3 10 l-14 -6 Z" fill="'+C.creamDk+'" stroke="'+C.ink+'" stroke-width="1"/>');

// ---------- PLANT ----------
// main stem
const stem=[[690,982],[664,876],[700,776],[664,668],[706,556],[746,442],[736,336],[742,286]];
S('<path d="'+tube(stem,30,8)+'" fill="'+C.greenDeep+'" stroke="'+C.ink+'" stroke-width="2.4"/>');
// cable strands inside the stem
S('<g fill="none" stroke="'+C.greenMid+'" stroke-width="1.5" opacity="0.9">');
S('<path d="'+pathCurve(stem.map(p=>[p[0]-5,p[1]]))+'"/>');
S('<path d="'+pathCurve(stem.map(p=>[p[0]+6,p[1]+3]))+'"/>');
S('</g>');
// left branch
const bl=[[682,700],[610,624],[520,556],[432,486],[356,420],[318,376]];
S('<path d="'+tube(bl,16,4)+'" fill="'+C.greenDeep+'" stroke="'+C.ink+'" stroke-width="2.1"/>');
// right branch
const br=[[706,556],[790,498],[866,436],[944,376],[1010,336],[1042,300]];
S('<path d="'+tube(br,14,4)+'" fill="'+C.greenDeep+'" stroke="'+C.ink+'" stroke-width="2.1"/>');
// lower left twig
const bt=[[678,838],[606,812],[548,776]];
S('<path d="'+tube(bt,10,4)+'" fill="'+C.greenDeep+'" stroke="'+C.ink+'" stroke-width="1.8"/>');

// solar leaves along branches
const leavesL=[[640,662,-64,120,26],[560,596,-52,132,28],[472,530,-40,118,25],[396,460,-30,104,22],[336,404,-18,86,19],[606,772,-118,96,21]];
for(const [x,y,a,l,w] of leavesL) solarLeaf(x,y,a,l,w,C.green);
const leavesR=[[760,516,-34,118,25],[840,470,-26,128,27],[920,410,-18,112,24],[990,356,-12,96,21],[716,470,-96,86,19]];
for(const [x,y,a,l,w] of leavesR) solarLeaf(x,y,a,l,w,C.greenMid);
const leavesM=[[700,900,-150,104,23],[680,790,150,92,20],[712,700,-100,84,18]];
for(const [x,y,a,l,w] of leavesM) solarLeaf(x,y,a,l,w,C.sage);

// ferns at branch tips
fern(322,382,-150,150,15,1);
fern(316,372,-118,120,13,1);
fern(320,392,-176,104,11,1);
fern(1046,306,-46,146,15,1);
fern(1050,318,-76,112,13,1);
fern(1034,296,-18,96,11,1);

// dish flower (hero)
dishFlower(742,258,92);

// router pod on the right branch mid
pod(900,414,26);
// drip line coiling the stem
S('<g fill="none" stroke="'+C.gold+'" stroke-width="2.6">');
S('<path d="M690 972 C640 920 742 882 686 828 C630 776 748 740 692 690 C640 644 742 606 700 560"/>');
S('</g>');

emitter(646,928,150); emitter(700,846,20); emitter(640,752,160); emitter(706,664,15); emitter(664,574,150);

// tendrils with fibre-optic tips
const tendrils=[[690,940,-120,90,8,26,-1.6,1],[700,820,60,70,6,20,-1.4,1],[612,704,-160,60,6,18,-1.5,1],
  [776,486,40,58,6,17,-1.4,1],[352,404,-90,54,5,16,-1.5,1],[1004,344,-40,50,5,15,-1.4,1],[744,470,120,46,5,14,-1.3,1]];
for(const [x,y,a,l,r0,r1,t,d] of tendrils){
  S(spiral(x,y,a,l,r0,r1,t,d,1.7));
  const aa=a*Math.PI/180;
  optic(x+Math.cos(aa)*(l+r1*0.2), y+Math.sin(aa)*(l+r1*0.2), 5);
}

// ---------- GARDENER: crouched under the hat, half-swallowed by the planting ----------
S('<g id="gardener" transform="translate(516,930) scale(0.93) translate(-540,-920)">');
// back leg (knee down, boot on the soil)
S('<path d="M548 902 C534 936 512 950 486 956 L448 968 C440 972 440 982 450 984 L500 982 C524 978 540 966 556 940 Z" fill="'+C.greenDeep+'" stroke="'+C.ink+'" stroke-width="2.2"/>');
S('<path d="M448 982 C436 980 430 986 432 992 L470 994 C476 990 474 982 468 980 Z" fill="'+C.ink+'"/>');
// front leg bent, foot forward
S('<path d="M556 906 C572 928 584 948 590 966 L600 976 C606 982 600 990 590 988 L566 974 C554 958 548 930 546 912 Z" fill="'+C.greenDeep+'" stroke="'+C.ink+'" stroke-width="2.2"/>');
S('<path d="M590 980 C602 976 612 982 610 990 L584 996 C578 992 582 982 590 980 Z" fill="'+C.ink+'"/>');
// torso + forward arm
S('<path d="M540 872 C566 880 576 900 570 914 L552 908 L544 922 L526 918 C520 898 524 880 540 872 Z" fill="'+C.goldLt+'" stroke="'+C.ink+'" stroke-width="2.2"/>');
S('<path d="M566 890 C592 896 612 906 628 918" fill="none" stroke="'+C.goldLt+'" stroke-width="13" stroke-linecap="round"/>');
S('<path d="M566 890 C592 896 612 906 628 918" fill="none" stroke="'+C.ink+'" stroke-width="1.6" stroke-linecap="round" opacity="0.85"/>');
S('<circle cx="634" cy="921" r="9" fill="'+C.goldLt+'" stroke="'+C.ink+'" stroke-width="1.8"/>');
// clippers in the hand
S('<g transform="translate(636,922) rotate(-34)" stroke="'+C.ink+'" stroke-width="3.4" fill="none">');
S('<path d="M0 0 L34 -8"/><path d="M0 0 L36 6"/>');
S('</g>');
S('<circle cx="638" cy="922" r="3.2" fill="'+C.coral+'"/>');
// reaching hand resting on the soil
S('<path d="M520 918 C506 934 496 950 492 962" fill="none" stroke="'+C.goldLt+'" stroke-width="12" stroke-linecap="round"/>');
S('<path d="M488 962 q10 -4 14 4 q2 8 -8 8 q-10 0 -12 -6 q0 -5 6 -6" fill="'+C.goldLt+'" stroke="'+C.ink+'" stroke-width="1.6"/>');
// hat over the head
S('<g transform="translate(556,858) rotate(-16)">');
S('<ellipse cx="0" cy="6" rx="64" ry="18" fill="'+C.gold+'" stroke="'+C.ink+'" stroke-width="2.2"/>');
S('<path d="M-28 -2 Q-24 -40 2 -42 Q28 -40 30 -2 Z" fill="'+C.goldLt+'" stroke="'+C.ink+'" stroke-width="2.2"/>');
S('<g stroke="'+C.ink+'" stroke-width="0.9" opacity="0.85">');
for(let i=-2;i<=2;i++) S('<path d="M'+(i*10)+' -6 L'+(i*12)+' 14"/>');
S('</g>');
S('<path d="M-26 2 Q0 16 28 2" fill="none" stroke="'+C.ink+'" stroke-width="1.6"/>');
S('</g>');
S('</g>');
// big leaf and fern partly covering him
solarLeaf(430,932,-18,138,32,C.greenDeep,'#7C9A58');
fern(596,846,196,120,11,1);
fern(520,986,232,96,9,1);

// ---------- MEDALLIONS ----------
function ring(cx,cy,r){
  S('<circle cx="'+cx+'" cy="'+cy+'" r="'+r+'" fill="'+C.cream+'" stroke="'+C.ink+'" stroke-width="2.4"/>');
  S('<circle cx="'+cx+'" cy="'+cy+'" r="'+(r-7)+'" fill="none" stroke="'+C.ink+'" stroke-width="0.9"/>');
  S('<g stroke="'+C.gold+'" stroke-width="2" fill="none">');
  for(let i=0;i<36;i++){
    const a=i*10*Math.PI/180;
    S('<path d="M'+f(cx+Math.cos(a)*(r-5))+','+f(cy+Math.sin(a)*(r-5))+' L'+f(cx+Math.cos(a)*(r+5))+','+f(cy+Math.sin(a)*(r+5))+'"/>');
  }
  S('</g>');
}
// I. flower head in plan
ring(1350,286,92);
S('<g transform="translate(1350,286) scale(0.92)">');
dishFlower(0,0,58);
S('</g>');
// II. the fruit: a router-pod, still a bud
ring(1244,614,88);
pod(1244,626,40);
S('<g stroke="'+C.ink+'" stroke-width="1.1" fill="none" opacity="0.85">');
S('<path d="M1192 574 q54 -42 106 0"/><path d="M1184 554 q62 -52 122 0"/>');
S('</g>');
// III. the seed: a cut cable end whose strands splay like roots
ring(1352,936,92);
S('<g transform="translate(1352,912)">');
// sheath: a cable jacket, cut on the diagonal
S('<path d="M-72 -16 L18 -16 L18 12 L-72 12 Z" fill="'+C.greenDeep+'" stroke="'+C.ink+'" stroke-width="2.2"/>');
S('<path d="M18 -16 L38 -4 L18 12 Z" fill="'+C.greenMid+'" stroke="'+C.ink+'" stroke-width="1.8"/>');
S('<path d="M-72 -16 L-84 -22 M-72 12 L-84 18" stroke="'+C.ink+'" stroke-width="1.6"/>');
// ferrule + inscription lines on the sheath
S('<rect x="-44" y="-19" width="16" height="34" fill="'+C.gold+'" stroke="'+C.ink+'" stroke-width="1.6"/>');
S('<path d="M-36 -8 v16" stroke="'+C.ink+'" stroke-width="1"/>');
// strands splay out of the cut end like roots
const strs=[[44,-46],[56,-28],[62,-6],[58,16],[46,34],[30,46],[14,50]];
for(const [ex,ey] of strs){
  S('<path d="M20 -2 C'+(ex*0.55)+' '+(ey*0.4)+' '+ex+' '+(ey*0.78)+' '+ex+' '+ey+'" fill="none" stroke="'+C.ink+'" stroke-width="1.8"/>');
  S('<circle cx="'+ex+'" cy="'+ey+'" r="3.2" fill="'+C.coral+'" stroke="'+C.ink+'" stroke-width="0.9"/>');
}
S('<ellipse cx="20" cy="-2" rx="7" ry="15" fill="'+C.goldLt+'" stroke="'+C.ink+'" stroke-width="1.6"/>');
S('</g>');
// plate ticks (not text)
for(const [y,n] of [[286,1],[614,2],[936,3]]){
  for(let i=0;i<n;i++) S('<rect x="'+(1352-6+i*16)+'" y="'+(y+108)+'" width="8" height="8" fill="'+C.ink+'"/>');
}
// small blooms on the branches, to carry the coral into the paper
function bloom(x,y,r){
  S('<g transform="translate('+x+','+y+')">');
  for(let i=0;i<5;i++){
    const a=-90+i*72;
    S('<g transform="rotate('+a+')"><path d="'+leafPath(r*1.5,r*0.42)+'" fill="'+C.coralLt+'" stroke="'+C.ink+'" stroke-width="1.4"/>'
      +'<path d="M'+f(r*0.4)+' 0 Q'+f(r*0.9)+' '+f(-r*0.12)+' '+f(r*1.3)+' 0" fill="none" stroke="'+C.ink+'" stroke-width="0.7"/></g>');
  }
  S('<circle cx="0" cy="0" r="'+(r*0.42)+'" fill="'+C.gold+'" stroke="'+C.ink+'" stroke-width="1.4"/>');
  S('<circle cx="0" cy="0" r="'+(r*0.16)+'" fill="'+C.ink+'"/>');
  S('</g>');
}
bloom(556,566,17); bloom(606,516,12); bloom(866,404,15); bloom(930,384,11);
S('<path d="M700 660 C672 664 650 672 636 686" fill="none" stroke="'+C.greenDeep+'" stroke-width="4"/>');
bloom(636,690,11);

// ---------- hanging cable-vine into the empty upper-left ----------
const vine=[[236,96],[214,150],[248,206],[222,266],[252,322],[236,378],[258,424]];
S('<path d="'+tube(vine,13,4)+'" fill="'+C.greenDeep+'" stroke="'+C.ink+'" stroke-width="2.2"/>');
for(const [x,y,a,l,w] of [[232,132,-150,64,15],[240,196,168,70,16],[228,262,-142,60,14],[248,330,160,62,14],[238,392,-150,52,12]])
  solarLeaf(x,y,a,l,w,C.green);
S(spiral(258,424,72,40,6,17,-1.5,1,1.7));
optic(258+Math.cos(72*Math.PI/180)*(40+4), 424+Math.sin(72*Math.PI/180)*(40+4), 5);
S(spiral(236,318,-140,34,5,14,-1.4,-1,1.5));
S(spiral(246,180,-70,30,5,13,-1.3,1,1.5));
// a second short vine from the top border, right of centre
const vine2=[[1150,96],[1120,146],[1152,196],[1128,246]];
S('<path d="'+tube(vine2,11,4)+'" fill="'+C.greenDeep+'" stroke="'+C.ink+'" stroke-width="2"/>');
for(const [x,y,a,l,w] of [[1132,124,-150,54,13],[1140,178,164,58,13],[1126,226,-146,48,11]])
  solarLeaf(x,y,a,l,w,C.greenMid);
S(spiral(1128,246,96,34,5,14,-1.4,1,1.6));
optic(1128+Math.cos(96*Math.PI/180)*38, 246+Math.sin(96*Math.PI/180)*38, 5);
// ---------- lower-right planting, to balance the gardener ----------
fern(1000,972,-64,150,14,1);
fern(1042,986,-46,124,12,1);
fern(966,986,-82,118,12,1);
solarLeaf(1004,930,-38,112,25,C.green);
solarLeaf(940,952,206,96,22,C.greenMid);
pod(1074,868,22);
// a cartouche in the border band, bottom centre (no legible text)
S('<rect x="706" y="34" width="188" height="52" fill="'+C.cream+'"/>');
S('<rect x="710" y="38" width="180" height="44" fill="none" stroke="'+C.ink+'" stroke-width="1.4"/>');
S('<use xlink:href="#rosette" transform="translate(800,60) scale(1.05)"/>');
S('<path d="M726 60 h56 M818 60 h56" stroke="'+C.gold+'" stroke-width="2.4"/>');
S('<rect x="706" y="34" width="188" height="52" fill="'+C.cream+'"/>');
S('<rect x="710" y="38" width="180" height="44" fill="none" stroke="'+C.ink+'" stroke-width="1.4"/>');
S('<use xlink:href="#rosette" transform="translate(800,60) scale(1.05)"/>');
S('<path d="M726 60 h52 M822 60 h52" stroke="'+C.gold+'" stroke-width="2.4"/>');

// grain
S('<rect width="1600" height="1200" filter="url(#grain)" opacity="0.10"/>');
S('</svg>');
fs.writeFileSync(OUT,P.join('\n'),'utf8');
console.log('bytes',P.join('\n').length);
