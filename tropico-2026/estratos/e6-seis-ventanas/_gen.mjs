// E6 Seis Ventanas — generator (six-panel comic page, 1600x1200)
import {writeFileSync} from "node:fs";
const PAPER="#efe9db", KEY="#141312", INK="#1d1b19";
const HOURS=[["06:00",6],["09:00",9],["13:00",13],["17:00",17],["21:00",21],["05:00",5]];
// panel: x,y,w,h,border, floor, wall, sky, floorTone, hour, dishScale, dishState, viewType
const panels=[
 {x:40,y:40,w:760,h:360,b:16,floor:1,wall:"#d9c8a4",sky:"#e9c98d",floorTone:"#8a6b45",hour:6,dscale:0.30,state:"sil",view:"roof",wf:[0.12,0.20,0.40,0.48]},
 {x:824,y:40,w:736,h:360,b:13,floor:2,wall:"#e4d7b8",sky:"#cfe0e6",floorTone:"#9c8258",hour:9,dscale:0.55,state:"bird",view:"roof",wf:[0.40,0.10,0.42,0.58]},
 {x:40,y:424,w:496,h:360,b:10,floor:3,wall:"#efe6d0",sky:"#a9c9dc",floorTone:"#8f7a55",hour:13,dscale:0.85,state:"snow",view:"roof",wf:[0.10,0.12,0.36,0.55]},
 {x:560,y:424,w:560,h:360,b:7,floor:4,wall:"#c98f5e",sky:"#e2a15e",floorTone:"#6d4a2f",hour:17,dscale:1.10,state:"rust",view:"roof",wf:[0.30,0.10,0.46,0.56]},
 {x:1144,y:424,w:416,h:360,b:4,floor:5,wall:"#2c3a49",sky:"#16233a",floorTone:"#141d26",hour:21,dscale:1.30,state:"moon",view:"roof",wf:[0.08,0.16,0.44,0.5]},
 {x:-24,y:808,w:1652,h:420,b:0,floor:6,wall:"#3c4a57",sky:"#6b7f92",floorTone:"#26313a",hour:5,dscale:0,state:"none",view:"recursion",wf:[0.22,0.12,0.34,0.62]}
];
// page-wide crack (hidden system): continues through the gutters
const CRACK=[[-60,150],[90,196],[180,170],[300,236],[392,300],[500,268],[590,344],[690,388],[760,430],[850,452],[940,496],[1030,540],[1100,610],[1190,650],[1270,712],[1360,752],[1440,820],[1540,864],[1660,930]];
function crackPath(){ return "M"+CRACK.map(p=>p[0]+","+p[1]).join(" L"); }
// dish
function dish(cx,cy,s,rot,state,tone){
  const dark = tone||INK;
  let g='<g transform="translate('+cx+','+cy+') rotate('+rot+')">';
  // pole
  g+='<path d="M-3,40 L3,40 L3,74 L-3,74 Z" fill="#2a2622"/>';
  g+='<path d="M-14,74 L14,74 L10,80 L-10,80 Z" fill="#2a2622"/>';
  g+='<g transform="scale('+s+')">';
  // bowl
  g+='<ellipse rx="46" ry="34" cx="0" cy="0" fill="'+dark+'" stroke="'+KEY+'" stroke-width="2.5"/>';
  g+='<ellipse rx="34" ry="24" cx="2" cy="-2" fill="none" stroke="'+(state==="moon"?"#8fa3b5":"#5b5348")+'" stroke-width="2"/>';
  // feed arm + LNB
  g+='<path d="M0,0 L38,-34" stroke="'+dark+'" stroke-width="4"/><circle cx="42" cy="-38" r="6" fill="'+dark+'" stroke="'+KEY+'" stroke-width="2"/>';
  // mount
  g+='<path d="M-12,26 L12,26 L8,40 L-8,40 Z" fill="'+dark+'"/>';
  if(state==="rust"){
    for(let i=0;i<5;i++) g+='<path d="M'+(-30+i*14)+','+(-18+(i*7)%16)+' l12,20" stroke="#7a3d20" stroke-width="2"/>';
    g+='<path d="M20,10 C40,26 30,44 52,50" stroke="'+dark+'" stroke-width="2" fill="none"/>';
    g+='<path d="M-24,14 C-42,30 -30,48 -50,58" stroke="'+dark+'" stroke-width="2" fill="none"/>';
  }
  if(state==="bird"){ g+='<path d="M40,-44 q6,-10 12,0 q6,-6 10,4 q-10,6 -22,0 Z" fill="'+dark+'"/>'; }
  if(state==="moon"){ g+='<ellipse rx="46" ry="34" cx="0" cy="0" fill="#0b1118"/>'; g+='<path d="M-30,-16 q30,-18 58,2" stroke="#8fa3b5" stroke-width="1.6" fill="none"/>'; }
  if(state==="snow"){ g+='<path d="M-40,-10 q20,-24 50,-10 q16,8 30,2 l-6,14 q-30,8 -70,0 Z" fill="#e8eef0"/>'; }
  g+='</g></g>';
  return g;
}
function clock(cx,cy,r,hour,reversed){
  let g='<g transform="translate('+cx+','+cy+')">';
  g+='<circle r="'+r+'" fill="#f2ecdd" stroke="'+KEY+'" stroke-width="2.4"/>';
  for(let i=0;i<12;i++){ const a=i*30*Math.PI/180; g+='<path d="M'+(Math.sin(a)*(r-3))+','+(-Math.cos(a)*(r-3))+' L'+(Math.sin(a)*(r-7))+','+(-Math.cos(a)*(r-7))+'" stroke="'+KEY+'" stroke-width="1.4"/>'; }
  const ha=(hour%12)*30*Math.PI/180, ma=0;
  const hx=Math.sin(ha)*(r*0.45), hy=-Math.cos(ha)*(r*0.45);
  const mx=Math.sin(ma)*(r*0.7), my=-Math.cos(ma)*(r*0.7);
  g+='<path d="M0,0 L'+hx+','+hy+'" stroke="'+KEY+'" stroke-width="3" stroke-linecap="round"/>';
  g+='<path d="M0,0 L'+mx+','+my+'" stroke="'+KEY+'" stroke-width="2" stroke-linecap="round"/>';
  if(reversed){ g+='<path d="M0,0 L'+(-hx*1.2)+','+(-hy*1.2)+'" stroke="#b8432c" stroke-width="2" stroke-linecap="round"/>'; }
  g+='<circle r="2.6" fill="'+KEY+'"/></g>';
  return g;
}
function furniture(kind,x,y,w,h,tone){
  let g='<g fill="'+tone+'">';
  if(kind==="chair"){ g+='<path d="M'+x+','+y+' h'+(w*0.7)+' v'+(h*0.12)+' h-'+(w*0.7)+' Z"/><path d="M'+x+','+y+' v'+(h*0.6)+' h'+(w*0.1)+' v-'+(h*0.5)+' h'+(w*0.5)+' v'+(h*0.5)+' h'+(w*0.1)+' v-'+(h*0.6)+' Z"/>'; }
  if(kind==="table"){ g+='<path d="M'+x+','+y+' h'+w+' v'+(h*0.14)+' h-'+w+' Z"/><path d="M'+(x+w*0.1)+','+y+' v'+h+' h'+(w*0.08)+' v-'+h+' Z"/><path d="M'+(x+w*0.82)+','+y+' v'+h+' h'+(w*0.08)+' v-'+h+' Z"/>'; }
  if(kind==="bed"){ g+='<path d="M'+x+','+y+' h'+w+' v'+(h*0.35)+' h-'+w+' Z"/><path d="M'+x+','+(y+h*0.35)+' h'+(w*0.2)+' v'+(h*0.4)+' h'+(w*0.6)+' v-'+(h*0.4)+' h'+(w*0.2)+' v'+(h*0.5)+' h-'+(w)+' Z"/>'; }
  if(kind==="shelf"){ g+='<path d="M'+x+','+y+' h'+w+' v'+(h*0.16)+' h-'+w+' Z"/><path d="M'+x+','+(y+h*0.5)+' h'+w+' v'+(h*0.16)+' h-'+w+' Z"/><path d="M'+x+','+y+' v'+h+' h'+(w*0.06)+' v-'+h+' Z"/><path d="M'+(x+w*0.94)+','+y+' v'+h+' h'+(w*0.06)+' v-'+h+' Z"/>'; }
  if(kind==="plant"){ g+='<path d="M'+(x+w*0.42)+','+y+' h'+(w*0.16)+' v'+(h*0.4)+' h-'+(w*0.16)+' Z"/><path d="M'+x+','+(y-h*0.25)+' q'+(w*0.5)+',-'+h*0.5+' '+w+',0 q-'+(w*0.2)+','+h*0.3+' -'+(w*0.5)+','+h*0.15+' q-'+(w*0.3)+','+h*0.1+' -'+(w*0.5)+',-'+h*0.15+' Z"/>'; }
  return g+'</g>';
}
const E=[];
const defs=[];
const clips=[];
E.push('<rect width="1600" height="1200" fill="'+PAPER+'"/>');
// page margin tint + page rule?
E.push('<rect x="16" y="16" width="1568" height="1168" fill="none" stroke="'+KEY+'" stroke-width="1.4" opacity="0.25"/>');
// page-wide crack drawn once per panel via clip
function panelSVG(p,idx){
  const id="clip"+idx;
  clips.push('<clipPath id="'+id+'"><rect x="'+p.x+'" y="'+p.y+'" width="'+p.w+'" height="'+p.h+'"/></clipPath>');
  const wx0=p.x+p.w*p.wf[0], wy0=p.y+p.h*p.wf[1], ww0=p.w*p.wf[2], wh0=p.h*p.wf[3];
  clips.push('<clipPath id="view'+idx+'"><rect x="'+wx0+'" y="'+wy0+'" width="'+ww0+'" height="'+wh0+'"/></clipPath>');
  clips.push('<clipPath id="wall'+idx+'"><path fill-rule="evenodd" d="M'+p.x+','+p.y+' H'+(p.x+p.w)+' V'+(p.y+p.h)+' H'+p.x+' Z M'+wx0+','+wy0+' H'+(wx0+ww0)+' V'+(wy0+wh0)+' H'+wx0+' Z"/></clipPath>');
  let g='<g clip-path="url(#'+id+')">';
  // wall
  g+='<rect x="'+p.x+'" y="'+p.y+'" width="'+p.w+'" height="'+p.h+'" fill="'+p.wall+'"/>';
  // wall texture: brick courses
  g+='<g stroke="'+p.floorTone+'" stroke-width="1" opacity="0.25">';
  for(let yy=p.y+18; yy<p.y+p.h; yy+=26){ g+='<path d="M'+p.x+','+yy+' H'+(p.x+p.w)+'"/>'; }
  for(let yy=p.y+18, r=0; yy<p.y+p.h; yy+=26, r++){ for(let xx=p.x+((r%2)?26:52); xx<p.x+p.w; xx+=52){ g+='<path d="M'+xx+','+yy+' V'+(yy+26)+'"/>'; } }
  g+='</g>';
  // floor
  g+='<rect x="'+p.x+'" y="'+(p.y+p.h*0.80)+'" width="'+p.w+'" height="'+(p.h*0.20)+'" fill="'+p.floorTone+'"/>';
  g+='<path d="M'+p.x+','+(p.y+p.h*0.80)+' H'+(p.x+p.w)+'" stroke="'+KEY+'" stroke-width="2"/>';
  // window
  const wx=p.x+p.w*p.wf[0], wy=p.y+p.h*p.wf[1], ww=p.w*p.wf[2], wh=p.h*p.wf[3];
  g+='<rect x="'+wx+'" y="'+wy+'" width="'+ww+'" height="'+wh+'" fill="'+p.sky+'"/>';
  g+='<g clip-path="url(#view'+idx+')">';
  if(p.view==="roof"){
    // distant roof + dish
    g+='<rect x="'+wx+'" y="'+(wy+wh*0.62)+'" width="'+ww+'" height="'+(wh*0.38)+'" fill="'+(p.hour>18||p.hour<6?"#101820":"#4a4438")+'"/>';
    g+='<path d="M'+(wx+ww*0.1)+','+(wy+wh*0.62)+' L'+(wx+ww*0.3)+','+(wy+wh*0.4)+' L'+(wx+ww*0.52)+','+(wy+wh*0.62)+' Z" fill="'+(p.hour>18||p.hour<6?"#0d141c":"#3a352c")+'"/>';
    if(p.state!=="none") g+=dish(wx+ww*0.62, wy+wh*0.34, p.dscale, -12, p.state, p.hour>18||p.hour<6?"#0b1118":INK);
    // sun / moon
    if(p.hour===6) g+='<circle cx="'+(wx+ww*0.25)+'" cy="'+(wy+wh*0.55)+'" r="'+(wh*0.09)+'" fill="#f6d08a"/>';
    if(p.hour===13) g+='<circle cx="'+(wx+ww*0.72)+'" cy="'+(wy+wh*0.18)+'" r="'+(wh*0.07)+'" fill="#f6ecd0"/>';
    if(p.hour===17) g+='<circle cx="'+(wx+ww*0.2)+'" cy="'+(wy+wh*0.5)+'" r="'+(wh*0.10)+'" fill="#f3a25c"/>';
    if(p.hour===21){ g+='<circle cx="'+(wx+ww*0.7)+'" cy="'+(wy+wh*0.2)+'" r="'+(wh*0.07)+'" fill="#e8ecdf"/>'; }
  } else {
    // recursion: the building's own facade with six windows
    g+='<rect x="'+(wx+ww*0.12)+'" y="'+(wy+wh*0.10)+'" width="'+(ww*0.76)+'" height="'+(wh*0.84)+'" fill="#3a4450" stroke="'+KEY+'" stroke-width="2"/>';
    for(let r=0;r<3;r++) for(let c=0;c<2;c++){
      const x2=wx+ww*0.2+c*ww*0.32, y2=wy+wh*0.18+r*wh*0.24;
      const tones=["#e9c98d","#cfe0e6","#a9c9dc","#e2a15e","#16233a","#6b7f92"];
      g+='<rect x="'+x2+'" y="'+y2+'" width="'+(ww*0.2)+'" height="'+(wh*0.16)+'" fill="'+tones[r*2+c]+'" stroke="'+KEY+'" stroke-width="1.4"/>';
      g+='<path d="M'+(x2+ww*0.1)+','+(y2+wh*0.16)+' v'+(wh*0.03)+'" stroke="'+KEY+'" stroke-width="1"/>';
      g+=dish(x2+ww*0.16, y2+wh*0.11, 0.16, -12, "sil", "#141312");
      if(r===1&&c===0){ g+='<path d="M'+(x2+ww*0.07)+','+(y2+wh*0.14)+' q3,-8 6,0 Z M'+(x2+ww*0.05)+','+(y2+wh*0.16)+' h10 v5 h-10 Z" fill="#141312"/>'; }
    }
  }
  g+='</g>'; // end view clip
  // window frame
  g+='<rect x="'+wx+'" y="'+wy+'" width="'+ww+'" height="'+wh+'" fill="none" stroke="'+KEY+'" stroke-width="8"/>';
  g+='<path d="M'+(wx+ww/2)+','+wy+' V'+(wy+wh)+' M'+wx+','+(wy+wh*0.5)+' H'+(wx+ww)+'" stroke="'+KEY+'" stroke-width="4"/>';
  // sill
  g+='<path d="M'+(wx-10)+','+(wy+wh)+' H'+(wx+ww+10)+' L'+(wx+ww+18)+','+(wy+wh+14)+' H'+(wx-18)+' Z" fill="'+p.floorTone+'" stroke="'+KEY+'" stroke-width="2"/>';
  // furniture
  if(idx===0) g+=furniture("chair", p.x+p.w*0.7, p.y+p.h*0.62, 62, 60, "#5a4630");
  if(idx===1) g+=furniture("table", p.x+p.w*0.1, p.y+p.h*0.66, 150, 46, "#4c3d2a");
  if(idx===2) g+=furniture("plant", p.x+p.w*0.72, p.y+p.h*0.72, 60, 40, "#4c3d2a");
  if(idx===3) g+=furniture("bed", p.x+p.w*0.05, p.y+p.h*0.70, 200, 60, "#3a2a1c");
  if(idx===4) g+=furniture("shelf", p.x+p.w*0.62, p.y+p.h*0.56, 120, 80, "#101820");
  if(idx===5) g+=furniture("plant", p.x+p.w*0.08, p.y+p.h*0.74, 90, 60, "#1c242c");
  // crack (page-wide, clipped to the wall; the window is punched out)
  g+='<g clip-path="url(#wall'+idx+')">';
  g+='<path d="'+crackPath()+'" fill="none" stroke="'+(p.hour>18?"#8f9aa2":"#f0e7d2")+'" stroke-width="2" transform="translate(2,2)"/>';
  g+='<path d="'+crackPath()+'" fill="none" stroke="'+KEY+'" stroke-width="6"/>';
  for(let b=0;b<9;b++){ const cp=CRACK[(idx*3+b)%CRACK.length]; g+='<path d="M'+cp[0]+','+cp[1]+' l'+(((b*7)%19)-9)+','+(((b*11)%23)-11)+'" stroke="'+KEY+'" stroke-width="2.4"/>'; }
  g+='</g>';
  // incident: lamp + framed picture
  {
    const lx=p.x+p.w*0.68, ly=p.y+p.h*0.10;
    g+='<path d="M'+lx+','+p.y+' V'+ly+'" stroke="'+KEY+'" stroke-width="2"/>';
    g+='<path d="M'+(lx-16)+','+ly+' h32 l-6,16 h-20 Z" fill="'+(p.hour>18?"#0e151c":"#2a2622")+'" stroke="'+KEY+'" stroke-width="2"/>';
    g+='<circle cx="'+lx+'" cy="'+(ly+20)+'" r="7" fill="'+(p.hour>18?"#e9d9a8":"#f2e4bd")+'" opacity="0.9"/>';
    const fx=(p.wf[0]>0.5? p.x+p.w*0.10 : p.x+p.w*(p.wf[0]+p.wf[2]+0.06)), fy=p.y+p.h*0.50;
    g+='<rect x="'+fx+'" y="'+fy+'" width="52" height="38" fill="none" stroke="'+KEY+'" stroke-width="3"/>';
    g+='<path d="M'+(fx+6)+','+(fy+32)+' l12,-16 l10,10 l8,-12 l10,18 Z" fill="'+(p.hour>18?"#131c24":"#5a4c36")+'"/>';
  }
  // rug
  g+='<path d="M'+(p.x+p.w*0.06)+','+(p.y+p.h*0.86)+' h'+(p.w*0.34)+' l-14,26 h-'+(p.w*0.28)+' Z" fill="'+(p.hour>18?"#1a232c":"#7a5c3a")+'" stroke="'+KEY+'" stroke-width="2" opacity="0.85"/>';
  // incident details
  if(idx===1){ g+='<path d="M'+(wx+ww*0.12)+','+(wy+wh-4)+' q4,-18 15,-18 q4,-9 9,-1 q10,2 12,19 Z" fill="'+KEY+'"/>'; }
  if(idx===4){ g+='<path d="M'+(p.x+p.w*0.30)+','+p.y+' V'+(p.y+p.h*0.30)+'" stroke="'+KEY+'" stroke-width="2"/><path d="M'+(p.x+p.w*0.30-14)+','+(p.y+p.h*0.34)+' q14,-22 28,0 Z" fill="#0d151d" stroke="'+KEY+'" stroke-width="2"/>'; }
  // cup on the sill
  g+='<path d="M'+(wx+ww*0.58)+','+(wy+wh+2)+' h16 v9 h-16 Z" fill="'+(p.hour>18?"#0e151c":"#e8dcc2")+'" stroke="'+KEY+'" stroke-width="1.6"/>';
  // clock
  const wRight=p.x+p.w*(p.wf[0]+p.wf[2]), wLeft=p.x+p.w*p.wf[0];
  const clockX = (p.x+p.w - wRight) > 90 ? wRight+54 : Math.max(p.x+40, wLeft-54);
  g+=clock(clockX, p.y+p.h*0.24, Math.max(18,p.h*0.07), p.hour, idx===5);

  g+='</g>';
  // inner shadow at the panel edge
  g+='<rect x="'+p.x+'" y="'+p.y+'" width="'+p.w+'" height="'+p.h+'" fill="none" stroke="#000" stroke-width="10" opacity="0.10"/>';
  // border (thickness encodes distance from the street)
  if(p.b>0) g+='<rect x="'+(p.x+p.b/2)+'" y="'+(p.y+p.b/2)+'" width="'+(p.w-p.b)+'" height="'+(p.h-p.b)+'" fill="none" stroke="'+KEY+'" stroke-width="'+p.b+'"/>';
  // floor notch counter on the left border: n ticks for floor n
  if(p.b>0){
    for(let i=0;i<p.floor;i++) g+='<path d="M'+(p.x+p.b)+','+(p.y+16+i*11)+' h-9" stroke="'+PAPER+'" stroke-width="3"/>';
  }
  return g;
}
panels.forEach((p,i)=>E.push(panelSVG(p,i)));
// six panel numbers as dots (register)
E.push('<g fill="'+KEY+'">');
for(let i=0;i<6;i++){ E.push('<circle cx="'+(44+i*22)+'" cy="1188" r="4"/>'); }
E.push('</g>');
// paper grain
defs.push('<filter id="grain" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB"><feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="3" seed="12" stitchTiles="stitch"/><feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0.26 0.26 0.26 0 0"/></filter>');
E.push('<rect width="1600" height="1200" filter="url(#grain)" opacity="0.10"/>');
const svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 1200" width="1600" height="1200"><defs>'+defs.join("")+clips.join("")+'</defs>'+E.join("\n")+'</svg>';
writeFileSync(process.argv[2]||"seis.svg", svg);
console.log("elements",E.length,"bytes",svg.length);
