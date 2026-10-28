// E4 La Ola de Datos — generator v4
import {writeFileSync} from "node:fs";
const PAPER="#f2e8d3", KEY="#1b1a18";
const DEEP="#152f4d", MID="#20466c", LIT="#3f7098", PALE="#8aa9bb";
const FOAM="#f7efdb", SEAL="#b8432c", SEA="#2a5279", SKY1="#b6c8ce", SKY2="#cdd8d9";
const HORIZON=820;
function cr(pts){ let d="M"+pts[0][0].toFixed(1)+","+pts[0][1].toFixed(1);
  for(let i=0;i<pts.length-1;i++){ const p0=pts[i>0?i-1:0],p1=pts[i],p2=pts[i+1],p3=pts[i+2<pts.length?i+2:pts.length-1];
    const c1=[p1[0]+(p2[0]-p0[0])/6,p1[1]+(p2[1]-p0[1])/6], c2=[p2[0]-(p3[0]-p1[0])/6,p2[1]-(p3[1]-p1[1])/6];
    d+=" C"+c1[0].toFixed(1)+","+c1[1].toFixed(1)+" "+c2[0].toFixed(1)+","+c2[1].toFixed(1)+" "+p2[0].toFixed(1)+","+p2[1].toFixed(1); }
  return d; }
function poly(pts){ return "M"+pts.map(p=>p[0].toFixed(1)+","+p[1].toFixed(1)).join(" L")+" Z"; }
function offsetLine(pts,d){ return pts.map((p,i)=>{ const a=pts[Math.max(0,i-1)],b=pts[Math.min(pts.length-1,i+1)];
  const dx=b[0]-a[0],dy=b[1]-a[1],L=Math.hypot(dx,dy)||1; return [p[0]+(-dy/L)*d, p[1]+(dx/L)*d]; }); }
const OUT=[[-90,900],[30,760],[150,630],[290,510],[430,415],[560,350],[670,318],[780,330],[870,385],[925,460],[940,540],[915,610],[870,660],[812,688],[752,686]];
const UND=[[795,648],[825,598],[836,543],[820,490],[786,460],[740,453]];
const FACE=[[702,480],[672,543],[652,620],[632,710],[616,810],[600,910],[584,1010],[568,1110],[554,1200]];
const WAVE=[...OUT,...UND,...FACE];
const OUT_FULL=[...OUT,...UND];

// curved cable finger
function finger(x0,y0,x1,y1,bend,w0,w1,strands){
  const dx=x1-x0, dy=y1-y0, L=Math.hypot(dx,dy)||1, nx=-dy/L, ny=dx/L;
  const cx=(x0+x1)/2+nx*bend, cy=(y0+y1)/2+ny*bend;
  const at=(t)=>{ const it=1-t; return [it*it*x0+2*it*t*cx+t*t*x1, it*it*y0+2*it*t*cy+t*t*y1]; };
  const N=18, left=[], right=[];
  for(let i=0;i<=N;i++){ const t=i/N, c=at(t), c2=at(Math.min(1,t+0.001));
    const tx=c2[0]-c[0], ty=c2[1]-c[1], tl=Math.hypot(tx,ty)||1;
    const nx2=-ty/tl, ny2=tx/tl, w=(w0+(w1-w0)*t)/2;
    left.push([c[0]+nx2*w, c[1]+ny2*w]); right.push([c[0]-nx2*w, c[1]-ny2*w]); }
  let g='<path d="'+poly([...left,...right.slice().reverse()])+'" fill="'+FOAM+'" stroke="'+KEY+'" stroke-width="2.8" stroke-linejoin="round"/>';
  const ns=strands||4;
  for(let s=0;s<ns;s++){
    const o=((s/(ns-1))-0.5)*w0*0.66, pts=[];
    for(let i=0;i<=8;i++){ const t=i/8, c=at(t), c2=at(Math.min(1,t+0.001));
      const tx=c2[0]-c[0], ty=c2[1]-c[1], tl=Math.hypot(tx,ty)||1, nX=-ty/tl, nY=tx/tl;
      const oo=o*(0.3+0.7*(1-t)); pts.push([c[0]+nX*oo, c[1]+nY*oo]); }
    g+='<path d="'+cr(pts)+'" fill="none" stroke="'+DEEP+'" stroke-width="1.9" opacity="0.8"/>';
  }
  const a=at(1), b=at(0.94), tang=[a[0]-b[0],a[1]-b[1]], ang=Math.atan2(tang[1],tang[0])*180/Math.PI;
  g+='<g transform="translate('+a[0].toFixed(1)+','+a[1].toFixed(1)+') rotate('+ang.toFixed(1)+')">';
  g+='<ellipse rx="'+(w1*0.32)+'" ry="'+(w1*0.72)+'" fill="'+FOAM+'" stroke="'+KEY+'" stroke-width="2.4"/>';
  g+='<ellipse rx="'+(w1*0.2)+'" ry="'+(w1*0.52)+'" fill="'+DEEP+'"/>';
  for(let k=0;k<6;k++){ const a2=k/6*Math.PI*2; g+='<circle cx="'+(Math.cos(a2)*w1*0.09).toFixed(1)+'" cy="'+(Math.sin(a2)*w1*0.32).toFixed(1)+'" r="'+(w1*0.055).toFixed(1)+'" fill="'+FOAM+'"/>'; }
  g+='</g>'; return g;
}
function fingerAt(x,y,len,ang,bend,w0,w1,strands){
  const a=ang*Math.PI/180; return finger(x,y,x+Math.cos(a)*len,y+Math.sin(a)*len,bend,w0,w1,strands);
}
function tally(x,y,count,scale,rot,color){
  let s='<g transform="translate('+x+','+y+') rotate('+rot+') scale('+scale+')" stroke="'+(color||DEEP)+'" stroke-width="2.5" stroke-linecap="square">';
  for(let i=0;i<Math.min(count,5);i++) s+='<path d="M'+(i*7)+',0 L'+(i*7)+',18"/>';
  if(count>=5) s+='<path d="M-3,13 L31,-1"/>';
  if(count>5) for(let i=5;i<count;i++) s+='<path d="M'+(i*7)+',0 L'+(i*7)+',18"/>';
  return s+'</g>';
}
const E=[];
const defs='<defs><clipPath id="waveclip"><path d="'+poly(WAVE)+'"/></clipPath>'+
'<filter id="grain" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB"><feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="3" seed="9" stitchTiles="stitch"/><feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0.28 0.28 0.28 0 0"/></filter>'+
'<filter id="paper" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="4" seed="3"/><feColorMatrix type="matrix" values="0 0 0 0 0.95  0 0 0 0 0.90  0 0 0 0 0.82  0.10 0.10 0.10 0 0"/></filter></defs>';
E.push('<rect width="1600" height="1200" fill="'+PAPER+'"/>');
E.push('<rect width="1600" height="380" fill="'+SKY1+'"/>');
E.push('<rect y="380" width="1600" height="260" fill="'+SKY2+'"/>');
E.push('<circle cx="1010" cy="262" r="84" fill="'+PAPER+'" opacity="0.9" stroke="'+PALE+'" stroke-width="2"/>');
E.push('<rect y="'+HORIZON+'" width="1600" height="'+(1200-HORIZON)+'" fill="'+SEA+'"/>');
// mountain rack (bigger)
E.push('<path d="M1070,'+HORIZON+' C1114,772 1180,686 1248,616 L1300,616 C1368,686 1434,772 1478,'+HORIZON+' Z" fill="#3e5165" stroke="'+KEY+'" stroke-width="3.5"/>');
E.push('<path d="M1248,616 L1300,616 C1330,636 1358,662 1382,692 L1330,674 L1344,708 L1300,680 L1284,714 L1266,678 L1236,706 L1242,670 L1204,690 C1218,662 1232,636 1248,616 Z" fill="#d2dcd8" stroke="'+KEY+'" stroke-width="2.2"/>');
E.push('<path d="M1196,664 L1368,664 L1392,724 L1172,724 Z" fill="#173252" stroke="'+KEY+'" stroke-width="2.4"/>');
for(let r=0;r<5;r++){ E.push('<path d="M'+(1188+r*2)+','+(672+r*10)+' L'+(1376-r*2)+','+(672+r*10)+'" stroke="#8aa9bb" stroke-width="2"/>');
  for(let c=0;c<8;c++) E.push('<circle cx="'+(1202+c*21)+'" cy="'+(669+r*10)+'" r="2.2" fill="'+(c%4===0?'#b8432c':'#7ea3b8')+'"/>'); }
// sea
for(let i=0;i<6;i++){ const y=HORIZON+24+i*46;
  E.push('<path d="'+cr([[-40,y+12],[300,y-10],[640,y+8],[980,y-8],[1320,y+10],[1640,y-6]])+'" stroke="'+PALE+'" stroke-width="'+(i<2?3:6)+'" fill="none" opacity="0.5"/>'); }
for(let i=0;i<34;i++){ const x=20+i*48, y=HORIZON+10+((i*37)%70); E.push('<path d="M'+x+','+y+' q12,-7 24,0" stroke="'+FOAM+'" stroke-width="2" fill="none" opacity="0.55"/>'); }
E.push('<path d="M0,'+HORIZON+' L1600,'+HORIZON+'" stroke="'+KEY+'" stroke-width="3" opacity="0.6"/>');
// wave mass
const wavePath=poly(WAVE);
E.push('<path d="'+wavePath+'" fill="'+MID+'" stroke="'+KEY+'" stroke-width="5"/>');
E.push('<path d="M-90,1200 L-90,860 C60,900 260,940 470,960 C520,1060 540,1130 554,1200 Z" fill="'+DEEP+'" opacity="0.7"/>');
// bundle ridges (clipped)
let ridge='<g clip-path="url(#waveclip)">';
for(let b=0;b<11;b++){ const pts=offsetLine(OUT_FULL,24+b*21);
  ridge+='<path d="'+cr(pts)+'" stroke="'+(b%2?LIT:PALE)+'" stroke-width="'+(b%3===0?5:3)+'" fill="none" opacity="0.72"/>'; }
for(let b=0;b<11;b++){ const pts=offsetLine(OUT_FULL,24+b*21); const p=pts[Math.floor(0.35*pts.length)];
  ridge+='<path d="M'+(p[0]-8)+','+(p[1]-7)+' q8,9 16,2" stroke="'+KEY+'" stroke-width="2.6" fill="none" opacity="0.7"/>'; }
ridge+='</g>'; E.push(ridge);
// foam mass (thick, bumpy)
const fOut=offsetLine(OUT,64).map((p,i)=>[p[0]+(Math.sin(i*2.1)*9), p[1]+(Math.sin(i*1.7)*8)]);
const fIn=offsetLine(OUT,-30).map((p,i)=>[p[0]+(Math.sin(i*2.3)*10), p[1]+(Math.sin(i*1.3)*9)]);
E.push('<path d="'+poly([...fOut,...fIn.slice().reverse()])+'" fill="'+FOAM+'" stroke="'+KEY+'" stroke-width="3" stroke-linejoin="round"/>');
// scallop bumps
// outer foam lobes beyond the band
for(let i=1;i<fIn.length-1;i+=1){ const a=fIn[i]; const r=10+((i*5)%9);
  E.push('<circle cx="'+a[0]+'" cy="'+(a[1]-2)+'" r="'+r+'" fill="'+FOAM+'" stroke="'+KEY+'" stroke-width="2"/>'); }
// spray dots
for(let i=0;i<18;i++){ const p=offsetLine(OUT,-30)[i+2]||[100,300]; E.push('<circle cx="'+(p[0]+((i*17)%44)-22)+'" cy="'+(p[1]-((i*11)%30)-10)+'" r="'+(3+((i*7)%5))+'" fill="'+FOAM+'" stroke="'+KEY+'" stroke-width="1.4"/>'); }
// foam spikes along the inner edge
for(let i=2;i<fIn.length-2;i+=2){ const a=fIn[i], b=fIn[i+2]; const dx=b[0]-a[0], dy=b[1]-a[1], L=Math.hypot(dx,dy)||1;
  const nx=dy/L, ny=-dx/L; const h=14+((i*11)%18);
  E.push('<path d="M'+a[0]+','+a[1]+' L'+(a[0]+dx*0.35)+','+(a[1]+dy*0.35)+' L'+(a[0]+nx*h)+','+(a[1]+ny*h)+' Z" fill="'+FOAM+'" stroke="'+KEY+'" stroke-width="1.8"/>'); }
// foam hatching
for(let i=0;i<54;i++){ const t=i/54; const pts=offsetLine(OUT,-10-((i*7)%18)); const p=pts[Math.floor(t*(pts.length-1))];
  E.push('<path d="M'+p[0]+','+p[1]+' q11,7 20,2" stroke="'+DEEP+'" stroke-width="2" fill="none" opacity="0.8"/>'); }
for(let i=0;i<34;i++){ const t=i/34; const pts=offsetLine(OUT,-6-((i*11)%22)); const p=pts[Math.floor(t*(pts.length-1))];
  E.push('<circle cx="'+(p[0]+((i*13)%18)-9)+'" cy="'+(p[1]+((i*7)%14)-7)+'" r="'+(2+((i*5)%5))+'" fill="none" stroke="'+MID+'" stroke-width="1.4" opacity="0.7"/>'); }
// foam on the lip underside
{
  const uOut=offsetLine(UND,-6), uIn=offsetLine(UND,-40);
  E.push('<path d="'+poly([...uOut,...uIn.slice().reverse()])+'" fill="'+FOAM+'" stroke="'+KEY+'" stroke-width="2.6"/>');
  for(let i=1;i<UND.length-1;i++){ const p=UND[i]; E.push(fingerAt(p[0]-6,p[1]-10,34+((i*23)%26),92+((i*37)%40),14,16,8,3)); }
}
// lip fingers (scale 1)
const lip=[[936,520],[928,592],[898,652],[852,694],[800,706]];
lip.forEach((p,i)=>{ const ang=78+((i*23)%17)-8; E.push(fingerAt(p[0],p[1],150+i*18,ang, 40+((i*31)%22), 46, 24, 5)); });
// crest fingers (scale 0.6)
const spray=offsetLine(OUT,18);
for(let i=1;i<spray.length-2;i+=1){ const p=spray[i]; const ang=-64+((i*31)%56); E.push(fingerAt(p[0],p[1],62+((i*37)%52),ang, -20-((i*13)%18), 24, 12, 4)); }
for(let i=2;i<spray.length-2;i+=2){ const p=spray[i]; const ang=-48+((i*41)%44); E.push(fingerAt(p[0]-8,p[1]+16,40+((i*17)%30),ang, 6+((i*11)%14), 16, 8, 3)); }
// sea foam patches (scale 0.35) + fingers
for(let i=0;i<6;i++){ const xs=[760,858,1352,1440,1290,690]; const x=xs[i], y=HORIZON+104+((i*23)%36), w=48+((i*17)%20), h=14;
  E.push('<path d="M'+(x-w)+','+y+' q'+w+',-'+h*2.4+' '+(2*w)+',0 q-'+(w*0.5)+','+(h*1.2)+' -'+w+',0 q-'+(w*0.5)+','+(-h*1.2)+' -'+w+',0 Z" fill="'+FOAM+'" stroke="'+KEY+'" stroke-width="2.4"/>');
  E.push(fingerAt(x-12,y-8,42,60+((i*31)%50), 12, 15, 8, 3));
  E.push(fingerAt(x+14,y-10,38,20+((i*43)%80), -8, 13, 7, 3)); }
// spray flecks (scale 0.15)
for(let i=0;i<30;i++){ const x=260+i*46, y=HORIZON+96+((i*37)%120);
  E.push('<path d="M'+x+','+y+' q6,-9 13,0 q-6,9 -13,0 Z" fill="'+FOAM+'"/>'); }
// tally register inside the crest foam (follows the band, left to right)
const counts=[2,3,4,5,5,6,7,8,3];
const fpts=offsetLine(OUT,-22);
for(let i=0;i<counts.length;i++){
  const t=(i+1)/11; const idx=Math.floor(t*(fpts.length-1)); const p=fpts[idx];
  const q=fpts[Math.min(fpts.length-1,idx+1)]; const ang=Math.atan2(q[1]-p[1],q[0]-p[0])*180/Math.PI;
  E.push(tally(p[0]-7,p[1]+4,counts[i],1.25,ang+90,DEEP));
}
// second register: connector pins along the sea foam shelf (right)
E.push('<path d="M1290,890 C1340,878 1390,900 1440,888 C1490,876 1540,896 1580,890 L1576,916 C1540,922 1500,906 1450,916 C1400,926 1350,904 1300,914 Z" fill="'+FOAM+'" stroke="'+KEY+'" stroke-width="2.6"/>');
E.push('<path d="M862,900 C894,890 926,906 958,898 L956,920 C926,928 896,914 864,922 Z" fill="'+FOAM+'" stroke="'+KEY+'" stroke-width="2.4"/>');
for(let i=0;i<5;i++){ const x=1316+i*56, y=896+((i%2)*8);
  E.push('<g transform="translate('+x+','+y+')" stroke="'+DEEP+'" stroke-width="2.4"><path d="M0,0 v16"/><path d="M8,0 v16"/><path d="M4,0 v16"/><path d="M-4,3 h16"/></g>'); }
// boat
E.push('<g transform="translate(985,915) rotate(-8)">');
E.push('<path d="M-20,30 C40,-4 190,-10 262,-2 L312,30 L296,68 L6,76 Z" fill="#22303b" stroke="'+KEY+'" stroke-width="3.2"/>');
E.push('<path d="M56,0 L140,-8 L146,20 L60,28 Z" fill="'+FOAM+'" stroke="'+KEY+'" stroke-width="2.6"/>');
E.push('<path d="M64,6 L132,0 L136,16 L68,22 Z" fill="'+DEEP+'"/>');
for(let i=0;i<4;i++) E.push('<circle cx="'+(76+i*14)+'" cy="11" r="2.4" fill="'+(i%2?'#b8432c':'#cfd9d6')+'"/>');
E.push('<path d="M210,-6 L210,-70 M190,-70 L236,-56" stroke="#22303b" stroke-width="5" fill="none"/>');
E.push('<circle cx="210" cy="-74" r="8" fill="'+DEEP+'" stroke="'+KEY+'" stroke-width="2"/>');
// crew figure
E.push('<g transform="translate(168,20)"><circle cx="0" cy="-12" r="7" fill="'+DEEP+'"/><path d="M-6,-4 L6,-4 L8,22 L-8,22 Z" fill="'+DEEP+'"/></g>');
// net
E.push('<path d="M-14,70 C60,124 214,144 336,112" stroke="#22303b" stroke-width="2.6" fill="none"/>');
for(let i=0;i<11;i++) E.push('<path d="M'+(0+i*31)+','+(74+i*5)+' l8,25" stroke="#22303b" stroke-width="1.8" opacity="0.7"/>');
E.push('</g>');
// break strand: unwinding loop at the crest then out
const strand='M676,318 C740,270 820,286 830,330 C840,372 782,392 752,360 C722,328 782,300 860,318 C980,345 1100,430 1230,520 C1360,610 1500,640 1660,650';
E.push('<path d="'+strand+'" stroke="'+KEY+'" stroke-width="17" fill="none" stroke-linecap="round"/>');
E.push('<path d="'+strand+'" stroke="'+FOAM+'" stroke-width="9" fill="none" stroke-linecap="round"/>');
E.push('<ellipse cx="1602" cy="649" rx="10" ry="20" fill="'+FOAM+'" stroke="'+KEY+'" stroke-width="3"/><ellipse cx="1602" cy="649" rx="5" ry="13" fill="'+DEEP+'"/>');
for(let i=0;i<5;i++){ const x=920+i*140, y=360+i*70; E.push('<path d="M'+(x-7)+','+(y-2)+' l14,9" stroke="'+KEY+'" stroke-width="3"/>'); }
// kento registration mark (hidden counter, bottom-right)
E.push('<g transform="translate(1470,1076)">');
E.push('<path d="M0,0 h34 v12 h-22 v34 h-12 Z" fill="'+PAPER+'" stroke="'+KEY+'" stroke-width="3"/>');
for(let i=0;i<5;i++) E.push('<path d="M'+(6+i*5)+',6 v-4" stroke="'+KEY+'" stroke-width="2"/>');
E.push('</g>');
// seal
E.push('<g transform="translate(1358,66)">');
E.push('<rect width="168" height="236" fill="'+SEAL+'" stroke="'+KEY+'" stroke-width="4"/>');
E.push('<rect x="9" y="9" width="150" height="218" fill="none" stroke="'+FOAM+'" stroke-width="3"/>');
for(let i=0;i<17;i++){ const y=18+i*12; E.push('<path d="M9,'+y+' h'+(i%5===0?13:6)+'" stroke="'+FOAM+'" stroke-width="2.2"/>'); E.push('<path d="M159,'+y+' h-'+(i%5===0?13:6)+'" stroke="'+FOAM+'" stroke-width="2.2"/>'); }
E.push('<rect x="30" y="26" width="104" height="16" fill="'+FOAM+'"/><rect x="30" y="52" width="62" height="16" fill="'+FOAM+'"/><rect x="100" y="52" width="34" height="16" fill="'+FOAM+'"/>');
E.push('<rect x="30" y="78" width="104" height="8" fill="'+FOAM+'"/><rect x="30" y="96" width="42" height="10" fill="'+FOAM+'"/><rect x="80" y="96" width="54" height="10" fill="'+FOAM+'"/>');
E.push('<rect x="30" y="116" width="104" height="6" fill="'+FOAM+'"/><rect x="30" y="132" width="70" height="18" fill="'+FOAM+'"/><rect x="30" y="160" width="104" height="4" fill="'+FOAM+'"/>');
for(let i=0;i<5;i++) E.push('<rect x="'+(30+i*22)+'" y="172" width="'+(6+i*3)+'" height="'+(20-i*3)+'" fill="'+FOAM+'"/>');
E.push('<rect x="30" y="200" width="104" height="10" fill="'+FOAM+'"/></g>');
E.push('<rect y="1080" width="1600" height="120" fill="'+DEEP+'" opacity="0.30"/>');
E.push('<rect x="0" y="0" width="1600" height="1200" fill="none" stroke="'+KEY+'" stroke-width="10"/>');
E.push('<rect width="1600" height="1200" filter="url(#paper)" opacity="0.45"/>');
E.push('<rect width="1600" height="1200" filter="url(#grain)" opacity="0.10"/>');
const svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 1200" width="1600" height="1200">'+defs+E.join("\n")+'</svg>';
writeFileSync(process.argv[2]||"ola.svg", svg);
console.log("elements",E.length,"bytes",svg.length);
