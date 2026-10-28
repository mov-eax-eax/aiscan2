// E9 Mosaico — generator v2 (Soviet mosaic, hidden star, diagonal thread)
import {writeFileSync} from "node:fs";
const X0=64,Y0=64,X1=1536,Y1=1136, COLS=34, ROWS=24;
const CW=(X1-X0)/COLS, CH=(Y1-Y0)/ROWS;
const GROUT="#7e7568";
const P={o1:"#b5763f",o2:"#c98d4f",o3:"#a86a3a",gold:"#e3c98e",gold2:"#d9bd82",red:"#b8382a",red2:"#8f2a20",
  cream:"#ede1c6",blue:"#2c4a6e",dark:"#20232a",green:"#5e6b3a",skin:"#e0b48a",brown:"#6e3a24",grey:"#55565a"};
function h1(i){ const x=Math.sin(i*127.1+311.7)*43758.5453; return x-Math.floor(x); }
function shade(hex,amt){ const n=parseInt(hex.slice(1),16); let r=(n>>16)&255,g=(n>>8)&255,b=n&255;
  r=Math.max(0,Math.min(255,Math.round(r+amt*255))); g=Math.max(0,Math.min(255,Math.round(g+amt*255))); b=Math.max(0,Math.min(255,Math.round(b+amt*255)));
  return "#"+((1<<24)+(r<<16)+(g<<8)+b).toString(16).slice(1); }
function blend(a,b,t){ const na=parseInt(a.slice(1),16), nb=parseInt(b.slice(1),16);
  const ar=(na>>16)&255,ag=(na>>8)&255,ab=na&255, br=(nb>>16)&255,bg=(nb>>8)&255,bb=nb&255;
  const r=Math.round(ar+(br-ar)*t),g=Math.round(ag+(bg-ag)*t),bl=Math.round(ab+(bb-ab)*t);
  return "#"+((1<<24)+(r<<16)+(g<<8)+bl).toString(16).slice(1); }
function inPoly(px,py,poly){ let c=false; for(let i=0,j=poly.length-1;i<poly.length;j=i++){
  const xi=poly[i][0],yi=poly[i][1],xj=poly[j][0],yj=poly[j][1];
  if(((yi>py)!==(yj>py)) && (px < (xj-xi)*(py-yi)/(yj-yi)+xi)) c=!c; } return c; }
function inCircle(px,py,cx,cy,r){ return (px-cx)*(px-cx)+(py-cy)*(py-cy)<=r*r; }
function star(cx,cy,R,r,rot){ const pts=[]; for(let i=0;i<10;i++){ const a=rot+i*Math.PI/5, rad=i%2?r:R; pts.push([cx+Math.cos(a)*rad, cy+Math.sin(a)*rad]); } return pts; }
const HIDDEN=star(800,600,560,225,-Math.PI/2);
// ---------- main image shapes ----------
const worker={
  head:[600,600,52],
  hair:[[548,566],[600,540],[652,566],[652,600],[548,600]],
  torso:[[534,650],[666,650],[666,860],[534,860]],
  legs:[[[542,860],[594,860],[594,1010],[542,1010]],[[606,860],[658,860],[658,1010],[606,1010]]],
  boots:[[[532,1006],[602,1006],[602,1032],[532,1032]],[[598,1006],[668,1006],[668,1032],[598,1032]]],
  armUp:[[656,660],[706,606],[748,650],[706,704]],
  hammerHead:[[726,556],[812,584],[810,632],[722,604]],
  hammerHandle:[[696,596],[720,582],[760,662],[736,676]],
  armDown:[[500,660],[528,660],[528,820],[500,820]]
};
const woman={
  head:[1090,600,48],
  scarf:[[1036,578],[1090,548],[1144,578],[1132,610],[1048,610]],
  dress:[[1014,650],[1166,650],[1206,1010],[974,1010]],
  apron:[[1042,780],[1138,780],[1152,1010],[1028,1010]],
  armL:[[990,680],[1014,680],[986,820],[962,820]],
  armR:[[1170,660],[1196,660],[1238,760],[1214,770]],
  sheaf:[[1216,700],[1300,730],[1330,1010],[1230,1010]]
};
function baseColour(px,py){
  if(inCircle(px,py,worker.head[0],worker.head[1],worker.head[2])) return P.skin;
  if(inPoly(px,py,worker.hair)) return P.dark;
  if(inPoly(px,py,worker.hammerHead)) return P.grey;
  if(inPoly(px,py,worker.hammerHandle)) return P.brown;
  if(inPoly(px,py,worker.armUp)) return P.skin;
  if(inPoly(px,py,worker.armDown)) return P.skin;
  if(inPoly(px,py,worker.torso)) return P.cream;
  if(inPoly(px,py,worker.legs[0])||inPoly(px,py,worker.legs[1])) return P.blue;
  if(inPoly(px,py,[[534,650],[666,650],[666,700],[534,700]])) return P.red;
  if(inPoly(px,py,worker.boots[0])||inPoly(px,py,worker.boots[1])) return P.dark;
  if(inCircle(px,py,woman.head[0],woman.head[1],woman.head[2])) return P.skin;
  if(inPoly(px,py,woman.scarf)) return P.cream;
  if(inPoly(px,py,woman.armL)||inPoly(px,py,woman.armR)) return P.skin;
  if(inPoly(px,py,woman.sheaf)) return P.gold;
  if(inPoly(px,py,woman.dress)) return P.red2;
  if(inPoly(px,py,woman.apron)) return P.cream;
  // ground
  if(py>1040) return P.brown;
  if(py>1020) return P.green;
  // sun (small, cream, high behind the two heads)
  const ds=Math.hypot(px-845,py-360);
  if(ds<96) return P.gold;
  if(ds<112) return P.red;
  // field + hidden star bias
  let c = [P.o1,P.o2,P.o3][Math.floor(h1(Math.floor(px/44)*37+Math.floor(py/44))*3)];
  if(inPoly(px,py,HIDDEN)) c = blend(c, '#5a1511', 0.70);
  return c;
}
const E=[];
const defs='<filter id="gr" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB"><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="3" seed="21" stitchTiles="stitch"/><feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0.28 0.28 0.28 0 0"/></filter>'+
'<filter id="paper" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.03" numOctaves="4" seed="5"/><feColorMatrix type="matrix" values="0 0 0 0 0.9  0 0 0 0 0.86  0 0 0 0 0.78  0.14 0.14 0.14 0 0"/></filter>';
E.push('<rect width="1600" height="1200" fill="#b9ae9b"/>');
E.push('<rect x="24" y="24" width="1552" height="1152" fill="#9a8f7c"/>');
E.push('<rect x="40" y="40" width="1520" height="1120" fill="'+GROUT+'"/>');
E.push('<rect x="'+X0+'" y="'+Y0+'" width="'+(X1-X0)+'" height="'+(Y1-Y0)+'" fill="'+GROUT+'"/>');
let idx=0,count=0;
for(let r=0;r<ROWS;r++){
  for(let c=0;c<COLS;c++){
    const cx=X0+(c+0.5)*CW, cy=Y0+(r+0.5)*CH;
    let col;
    const border=(r<2||r>=ROWS-2||c<2||c>=COLS-2);
    if(border){
      const ring=Math.min(r,c,ROWS-1-r,COLS-1-c);
      if(ring===1){ col=((c%3===0)&&(r%3===0))?P.cream:P.red; }
      else { col=((c+r)%2)?P.red2:P.red; }
      if(ring===0) col=P.dark;
      if(ring===2 && ((c+r)%4===0)) col=P.gold;
      if((r<4||r>=ROWS-4)&&(c<4||c>=COLS-4)) col=((c+r)%2)?P.gold:P.red;
    } else {
      col=baseColour(cx,cy);
      col=shade(col,(h1(idx*7+3)-0.5)*0.09);
      if(idx%97===96) col=shade(col,-0.18);
    }
    const tw=CW*0.93, th=CH*0.93;
    const px=cx+(h1(idx)-0.5)*2.0, py=cy+(h1(idx+11)-0.5)*2.0;
    let rot=(h1(idx*3+1)-0.5)*3.0, ox=0, oy=0;
    if(idx%97===96){ ox=7; oy=-7; rot+=9; }
    E.push('<rect x="'+(px-tw/2+ox).toFixed(1)+'" y="'+(py-th/2+oy).toFixed(1)+'" width="'+tw.toFixed(1)+'" height="'+th.toFixed(1)+'" fill="'+col+'" transform="rotate('+rot.toFixed(2)+' '+px.toFixed(1)+' '+py.toFixed(1)+')"/>');
    count++; idx++;
  }
}
// missing tesserae (grout shows) + patina
for(let k=0;k<7;k++){ const cc=3+Math.floor(h1(k*19+1)*(COLS-6)), rr=3+Math.floor(h1(k*23+7)*(ROWS-6));
  E.push('<rect x="'+(X0+cc*CW+3).toFixed(1)+'" y="'+(Y0+rr*CH+3).toFixed(1)+'" width="'+(CW-6).toFixed(1)+'" height="'+(CH-6).toFixed(1)+'" fill="'+GROUT+'"/>'); }
// patina tesserae
for(let k=0;k<48;k++){ const cc=2+Math.floor(h1(k*29+3)*(COLS-4)), rr=2+Math.floor(h1(k*31+9)*(ROWS-4));
  const x=X0+cc*CW+CW*0.05, y=Y0+rr*CH+CH*0.05;
  E.push('<rect x="'+x.toFixed(1)+'" y="'+y.toFixed(1)+'" width="'+(CW*0.9).toFixed(1)+'" height="'+(CH*0.9).toFixed(1)+'" fill="#2e2620" opacity="0.10"/>'); }
// aged patches
for(let k=0;k<10;k++){ const px=X0+h1(k*13+2)*(X1-X0), py=Y0+h1(k*17+5)*(Y1-Y0);
  E.push('<ellipse cx="'+px.toFixed(0)+'" cy="'+py.toFixed(0)+'" rx="'+(50+h1(k)*60)+'" ry="'+(24+h1(k+9)*34)+'" fill="#3a3226" opacity="0.05"/>'); }
E.push('<rect x="'+X0+'" y="'+Y0+'" width="'+(X1-X0)+'" height="'+(Y1-Y0)+'" fill="none" stroke="#2a2520" stroke-width="10" opacity="0.35"/>');
E.push('<rect x="24" y="24" width="1552" height="1152" fill="none" stroke="#3b342b" stroke-width="8"/>');
E.push('<rect width="1600" height="1200" filter="url(#paper)" opacity="0.5"/>');
E.push('<rect width="1600" height="1200" filter="url(#gr)" opacity="0.10"/>');
const svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 1200" width="1600" height="1200"><defs>'+defs+'</defs>'+E.join("\n")+'</svg>';
writeFileSync(process.argv[2]||"mosaico.svg", svg);
console.log("tesserae",count,"elements",E.length,"bytes",svg.length);
