import fs from 'node:fs';
const W=1400,H=1400;
const C={ stone:'#b9b0a0', stone2:'#cfc7b8', stone3:'#a49a8a', lead:'#1d1d1f', light:'#f2ead2',
  black:'#1a1a1a', brown:'#7a4a24', red:'#b4232a', orange:'#d9651f', yellow:'#e8c72c',
  green:'#2f7a45', blue:'#2b4f9e', violet:'#5a2f7a', grey:'#8d8a84', white:'#eae4d6' };
let seed=3141;
function rnd(){ seed=(seed*1664525+1013904223)%4294967296; return seed/4294967296; }
function rr(a,b){ return a+(b-a)*rnd(); }
const n=(v)=>Math.round(v*100)/100;
const S=[]; const add=(s)=>S.push(s);
function P(d,a){ return '<path d="'+d+'"'+(a?' '+a:'')+'/>'; }
function rect(x,y,w,h,f,a){ return '<rect x="'+n(x)+'" y="'+n(y)+'" width="'+n(w)+'" height="'+n(h)+'" fill="'+(f||'none')+'"'+(a?' '+a:'')+'/>'; }
function circ(cx,cy,r,f,a){ return '<circle cx="'+n(cx)+'" cy="'+n(cy)+'" r="'+n(r)+'" fill="'+(f||'none')+'"'+(a?' '+a:'')+'/>'; }
function L(x1,y1,x2,y2,a){ return '<line x1="'+n(x1)+'" y1="'+n(y1)+'" x2="'+n(x2)+'" y2="'+n(y2)+'"'+(a?' '+a:'')+'/>'; }
function polar(cx,cy,r,a){ return [cx+Math.cos(a)*r, cy+Math.sin(a)*r]; }

// resistor code of pi's first twelve digits
const PI='314159265358';
const CODE={'0':C.black,'1':C.brown,'2':C.red,'3':C.orange,'4':C.yellow,'5':C.green,'6':C.blue,'7':C.violet,'8':C.grey,'9':C.white};
const CX=700, CY=700;

add('<?xml version="1.0" encoding="UTF-8"?>');
add('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 '+W+' '+H+'" width="'+W+'" height="'+H+'">');
add('<defs>');
add('<filter id="grain" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">');
add('<feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="3" seed="21" stitchTiles="stitch"/>');
add('<feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0.26 0.26 0.26 0 0"/>');
add('</filter>');
add('<clipPath id="glass"><circle cx="700" cy="700" r="596"/></clipPath>');
add('<clipPath id="win"><circle cx="700" cy="700" r="626"/></clipPath>');
add('</defs>');

// ---------- masonry ----------
add(rect(0,0,W,H,C.stone));
let ma='';
for(let r=0;r<13;r++){ const y=r*110; ma+=L(0,y,W,y,'stroke="'+C.stone3+'" stroke-width="3"');
  const off=(r%2)*80;
  for(let c=-1;c<11;c++){ ma+=L(c*160+off,y,c*160+off,y+110,'stroke="'+C.stone3+'" stroke-width="3"'); }
  for(let c=0;c<10;c++){ const x=c*160+off+8; ma+=P('M'+n(x)+','+n(y+8)+' q 60,26 140,6','fill="none" stroke="'+C.stone2+'" stroke-width="1.2" opacity="0.6"'); }
}
add(ma);
// ---------- the window ----------
add(circ(CX,CY,652,C.stone2));
add(circ(CX,CY,652,'none','stroke="'+C.stone3+'" stroke-width="6"'));
add(circ(CX,CY,640,'none','stroke="'+C.lead+'" stroke-width="10"'));
add(circ(CX,CY,630,C.lead));
add(circ(CX,CY,622,C.light));
add('<g clip-path="url(#glass)">');
// glass ground: pale quarries behind the tracery
add(circ(CX,CY,596,'#2b4f9e'));
add(circ(CX,CY,596,'none','stroke="'+C.lead+'" stroke-width="4"'));
for(let i=0;i<36;i++){ const a=i*Math.PI/18; const p1=polar(CX,CY,120,a), p2=polar(CX,CY,590,a); }
// ---------- twelve petals ----------
function petal(i,inv){
  const a0=i*Math.PI/6, a1=(i+1)*Math.PI/6;
  const r0=140, r2=556;
  const ctrl=polar(CX,CY,r2*0.62,(a0+a1)/2);
  const A=polar(CX,CY,r0,a0), B=polar(CX,CY,r2,a0), Cc=polar(CX,CY,r2,a1), D=polar(CX,CY,r0,a1);
  const apex=polar(CX,CY,r2+22,(a0+a1)/2);
  let o=P('M'+n(A[0])+','+n(A[1])+' L'+n(B[0])+','+n(B[1])+' L'+n(apex[0])+','+n(apex[1])+' L'+n(Cc[0])+','+n(Cc[1])+' L'+n(D[0])+','+n(D[1])+' Q'+n(ctrl[0])+','+n(ctrl[1])+' '+n(A[0])+','+n(A[1])+' Z','fill="'+C.blue+'" stroke="'+C.lead+'" stroke-width="7"');
  const seg=(ra,rb,f)=>{ const p1=polar(CX,CY,ra,a0+0.048), p2=polar(CX,CY,rb,a0+0.048), p3=polar(CX,CY,rb,a1-0.048), p4=polar(CX,CY,ra,a1-0.048); return P('M'+n(p1[0])+','+n(p1[1])+' L'+n(p2[0])+','+n(p2[1])+' A'+rb+','+rb+' 0 0 1 '+n(p3[0])+','+n(p3[1])+' L'+n(p4[0])+','+n(p4[1])+' A'+ra+','+ra+' 0 0 0 '+n(p1[0])+','+n(p1[1])+' Z','fill="'+f+'" stroke="'+C.lead+'" stroke-width="5"'); };
  let bands=[CODE[PI[i]],CODE[PI[(i+1)%12]],CODE[PI[(i+2)%12]],CODE[PI[(i+3)%12]]];
  let rs=[[150,228],[236,306],[314,384],[392,548]];
  if(inv){ bands=bands.slice().reverse(); rs=rs.map(function(q){ return [704-q[1],704-q[0]]; }).reverse(); }
  for(let b=0;b<4;b++){ o+=seg(rs[b][0],rs[b][1],bands[b]); }
  // quarries: radial and arch lead lines subdividing each band
  for(let b=0;b<4;b++){
    const ra=rs[b][0], rb=rs[b][1];
    const cnt=(b===3)?3:2;
    for(let q=1;q<=cnt;q++){
      const aa=a0+(a1-a0)*q/(cnt+1);
      const p1=polar(CX,CY,ra+4,aa), p2=polar(CX,CY,rb-4,aa);
      o+=L(p1[0],p1[1],p2[0],p2[1],'stroke="'+C.lead+'" stroke-width="3"');
    }
    const mid=(ra+rb)/2;
    const q1=polar(CX,CY,mid,a0+0.048), q2=polar(CX,CY,mid,a1-0.048);
    o+=P('M'+n(q1[0])+','+n(q1[1])+' A'+mid+','+mid+' 0 0 1 '+n(q2[0])+','+n(q2[1]),'fill="none" stroke="'+C.lead+'" stroke-width="2.6"');
  }
  return o;
}
for(let i=0;i<12;i++){
  add(petal(i, i===6));
}
// ---------- ring of roundels ----------
for(let i=0;i<24;i++){
  const a=(i+0.5)*Math.PI/12; const p=polar(CX,CY,580,a);
  add(circ(p[0],p[1],26,C.light,'stroke="'+C.lead+'" stroke-width="5"'));
  add(circ(p[0],p[1],18, i%2? '#dfe4d8':'#e6e0c8','stroke="'+C.lead+'" stroke-width="3"'));
  add(circ(p[0],p[1],9, CODE[PI[i%12]]));
}
// ---------- leading + circuit traces ----------
for(let i=0;i<12;i++){
  const a=i*Math.PI/6; const p1=polar(CX,CY,128,a), p2=polar(CX,CY,596,a);
  add(L(p1[0],p1[1],p2[0],p2[1],'stroke="'+C.lead+'" stroke-width="6"'));
  const t1=polar(CX,CY,232,a+0.02), t2=polar(CX,CY,544,a+0.02);
  add(L(t1[0],t1[1],t2[0],t2[1],'stroke="'+C.yellow+'" stroke-width="2" opacity="0.85"'));
  const j1=polar(CX,CY,258,a+0.02), j2=polar(CX,CY,516,a+0.02);
  add(circ(j1[0],j1[1],5,C.lead)); add(circ(j2[0],j2[1],5,C.lead));
}
// outer circuit ring joining the petals
add(circ(CX,CY,540,'none','stroke="'+C.lead+'" stroke-width="2" opacity="0.9"'));
add(circ(CX,CY,268,'none','stroke="'+C.lead+'" stroke-width="2" opacity="0.9"'));
for(let i=0;i<12;i++){ const a=(i+0.5)*Math.PI/6; const p=polar(CX,CY,540,a); add(circ(p[0],p[1],7,C.lead)); }
// ---------- central chip ----------
add(circ(CX,CY,124,C.lead));
add(circ(CX,CY,116,C.light));
add(rect(CX-58,CY-58,116,116,C.stone3,'stroke="'+C.lead+'" stroke-width="6" rx="8"'));
for(let i=0;i<12;i++){ const a=i*Math.PI/6; const p1=polar(CX,CY,58,a), p2=polar(CX,CY,104,a); add(L(p1[0],p1[1],p2[0],p2[1],'stroke="'+C.lead+'" stroke-width="5"')); add(circ(p2[0],p2[1],6,C.lead)); }
add(rect(CX-26,CY-26,52,52,'none','stroke="'+C.lead+'" stroke-width="3"'));
add(circ(CX,CY,9,C.red));
add('</g>');

// ---------- stone tracery over the glass ----------
add(circ(CX,CY,596,'none','stroke="'+C.lead+'" stroke-width="12"'));
add(circ(CX,CY,566,'none','stroke="'+C.lead+'" stroke-width="5"'));
for(let i=0;i<12;i++){
  const a=i*Math.PI/6;
  add(L(...polar(CX,CY,120,a),...polar(CX,CY,600,a),'stroke="'+C.lead+'" stroke-width="22"'));
  add(L(...polar(CX,CY,120,a),...polar(CX,CY,600,a),'stroke="'+C.stone2+'" stroke-width="15"'));
  add(L(...polar(CX,CY,120,a),...polar(CX,CY,600,a),'stroke="'+C.stone3+'" stroke-width="1.2" opacity="0.6"'));
  add(L(...polar(CX,CY,210,a+0.004),...polar(CX,CY,200,a+0.004),'stroke="'+C.lead+'" stroke-width="2"'));
  const c=polar(CX,CY,520,i*Math.PI/6+Math.PI/12);
  add(circ(c[0],c[1],13,C.stone2,'stroke="'+C.lead+'" stroke-width="3"'));
}
add(circ(CX,CY,600,'none','stroke="'+C.stone3+'" stroke-width="14" opacity="0.35"'));

// ---------- the light: stone shadows on the glass, and the dove ----------
let sh='';
for(let i=0;i<12;i++){
  const a=i*Math.PI/6;
  const p1=polar(CX,CY,132,a), p2=polar(CX,CY,596,a);
  sh+=P('M'+n(p1[0])+','+n(p1[1])+' L'+n(p2[0])+','+n(p2[1])+' L'+n(p2[0]+19)+','+n(p2[1]+12)+' L'+n(p1[0]+19)+','+n(p1[1]+12)+' Z','fill="'+C.black+'" opacity="0.30"');
}
// shadow ring of the inner cusps
for(let i=0;i<12;i++){ const a=(i+0.5)*Math.PI/6; const c=polar(CX,CY,520,a); sh+=circ(c[0]+19,c[1]+12,15,C.black,'opacity="0.20"'); }
// the hidden dove: shadow masses offset from the centre
add('<g opacity="0.46" clip-path="url(#glass)" transform="translate(700,700) scale(1.30) translate(-700,-700)">');
add(P('M700,470 C640,430 520,420 430,470 C500,500 560,520 620,540 C560,570 500,600 470,650 C560,640 640,610 690,590 Z','fill="'+C.black+'"'));
add(P('M700,470 C760,430 880,420 970,470 C900,500 840,520 780,540 C840,570 900,600 930,650 C840,640 760,610 710,590 Z','fill="'+C.black+'"'));
add(P('M700,540 C660,540 640,600 650,660 C660,720 680,760 700,790 C720,760 740,720 750,660 C760,600 740,540 700,540 Z','fill="'+C.black+'"'));
add(P('M700,790 L660,860 L700,850 L740,860 Z','fill="'+C.black+'"'));
add(P('M700,470 C680,440 690,410 706,396 C726,404 730,440 712,466 Z','fill="'+C.black+'"'));
add(P('M706,404 l44,10 l-44,14 Z','fill="'+C.black+'"'));
add('</g>');
add(sh);

add(rect(0,0,W,H,'#000','filter="url(#grain)" opacity="0.11"'));
add('</svg>');
fs.writeFileSync(process.argv[2]||'roseton.svg',S.join('\n'));
console.log('wrote',(S.join('\n').length/1024).toFixed(1)+'KB',S.length+' elems');