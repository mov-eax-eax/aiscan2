import fs from 'node:fs';
const W = 1000, H = 1500;
const C = {
  ground:'#101733', band:'#1a2344', field:'#243060',
  tealDD:'#0e2c35', tealD:'#173f4a', teal:'#2c6873', tealP:'#7fb3ae',
  stormDD:'#0a2530', stormD:'#12323e', storm:'#1e4d59', stormL:'#3f7f88',
  cream:'#f2e4c4', pale:'#d8e2cf',
  gold:'#d9a441', goldL:'#efcf87', goldD:'#9c6a17',
  red:'#b8342a', redD:'#7d211a', ink:'#0f0d18'
};
const S = [];
const add = (s) => S.push(s);
const n = (v) => Math.round(v*100)/100;
function circle(cx,cy,r,fill,extra){ return '<circle cx="'+n(cx)+'" cy="'+n(cy)+'" r="'+n(r)+'" fill="'+(fill||'none')+'"'+(extra?' '+extra:'')+'/>'; }
function rect(x,y,w,h,fill,extra){ return '<rect x="'+n(x)+'" y="'+n(y)+'" width="'+n(w)+'" height="'+n(h)+'" fill="'+(fill||'none')+'"'+(extra?' '+extra:'')+'/>'; }
function path(d,attrs){ return '<path d="'+d+'"'+(attrs?' '+attrs:'')+'/>'; }
function poly(pts,attrs){
  var d='M'+pts.map(function(p){return n(p[0])+','+n(p[1]);}).join(' L')+' Z';
  return '<path d="'+d+'"'+(attrs?' '+attrs:'')+'/>';
}
function line(x1,y1,x2,y2,attrs){ return '<line x1="'+n(x1)+'" y1="'+n(y1)+'" x2="'+n(x2)+'" y2="'+n(y2)+'"'+(attrs?' '+attrs:'')+'/>'; }
function polar(cx,cy,r,a){ return [cx+Math.cos(a)*r, cy+Math.sin(a)*r]; }

// ---------- scalloped repeating motif along a clockwise rect ----------
function scallops(x1,y1,x2,y2,step,bulge,attrs){
  var dx=x2-x1, dy=y2-y1, L=Math.hypot(dx,dy);
  var nSeg=Math.max(1,Math.round(L/step));
  var ux=dx/L, uy=dy/L;
  var nx=-uy, ny=ux;
  var d='';
  for(var i=0;i<nSeg;i++){
    var t0=i/nSeg, t1=(i+1)/nSeg;
    var ax=x1+dx*t0, ay=y1+dy*t0, bx=x1+dx*t1, by=y1+dy*t1;
    var mx=(ax+bx)/2 + nx*bulge, my=(ay+by)/2 + ny*bulge;
    d+='M'+n(ax)+','+n(ay)+' Q'+n(mx)+','+n(my)+' '+n(bx)+','+n(by)+' ';
  }
  return path(d,attrs);
}
function dotsAlong(x1,y1,x2,y2,step,off,r,fill){
  var dx=x2-x1, dy=y2-y1, L=Math.hypot(dx,dy);
  var nSeg=Math.max(1,Math.round(L/step));
  var ux=dx/L, uy=dy/L, nx=-uy, ny=ux;
  var out='';
  for(var i=0;i<nSeg;i++){
    var t=(i+0.5)/nSeg;
    out+=circle(x1+dx*t+nx*off, y1+dy*t+ny*off, r, fill);
  }
  return out;
}

// ---------- head ----------
add('<?xml version="1.0" encoding="UTF-8"?>');
add('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 '+W+' '+H+'" width="'+W+'" height="'+H+'">');
add('<defs>');
add('<filter id="grain" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">');
add('<feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="3" seed="11" stitchTiles="stitch"/>');
add('<feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0.32 0.32 0.32 0 0"/>');
add('</filter>');
add('<clipPath id="med"><circle cx="500" cy="690" r="316"/></clipPath>');
add('<clipPath id="vL"><circle cx="196" cy="1258" r="96"/></clipPath>');
add('<clipPath id="vR"><circle cx="804" cy="1258" r="96"/></clipPath>');
add('</defs>');

// ---------- ground / mounting bands ----------
add(rect(0,0,W,H,C.ground));
add(rect(36,36,928,1428,C.band));
add(rect(74,74,852,1352,C.field));

// outer gold rule + vermillion hairline
add(rect(22,22,956,1456,'none','stroke="'+C.gold+'" stroke-width="7"'));
add(rect(30,30,940,1440,'none','stroke="'+C.goldD+'" stroke-width="2"'));
add(rect(36,36,928,1428,'none','stroke="'+C.red+'" stroke-width="2.5"'));

// repeating ornamental scallop band between frame and field
add(scallops(55,55,945,55,48,12,'fill="none" stroke="'+C.gold+'" stroke-width="2.4"'));
add(scallops(945,55,945,1445,48,12,'fill="none" stroke="'+C.gold+'" stroke-width="2.4"'));
add(scallops(945,1445,55,1445,48,12,'fill="none" stroke="'+C.gold+'" stroke-width="2.4"'));
add(scallops(55,1445,55,55,48,12,'fill="none" stroke="'+C.gold+'" stroke-width="2.4"'));
add(dotsAlong(55,55,945,55,48,14,3.2,C.gold));
add(dotsAlong(945,55,945,1445,48,14,3.2,C.gold));
add(dotsAlong(945,1445,55,1445,48,14,3.2,C.gold));
add(dotsAlong(55,1445,55,55,48,14,3.2,C.gold));
// corner knots
[[55,55],[945,55],[945,1445],[55,1445]].forEach(function(p){
  add(path('M'+n(p[0])+','+n(p[1]-13)+' L'+n(p[0]+13)+','+n(p[1])+' L'+n(p[0])+','+n(p[1]+13)+' L'+n(p[0]-13)+','+n(p[1])+' Z','fill="'+C.goldD+'"'));
  add(circle(p[0],p[1],5,C.goldL));
});

// field panel rules
add(rect(74,74,852,1352,'none','stroke="'+C.gold+'" stroke-width="3"'));
add(rect(86,86,828,1328,'none','stroke="'+C.goldD+'" stroke-width="1.4" opacity="0.75"'));

// ---------- sunburst behind medallion ----------
var rays='';
for(var i=0;i<41;i++){
  var a=(-130 + i*(80/40))*Math.PI/180;
  var r2=(i%2===0)?520:462;
  var w=(i%4===0)?4.4:2.2;
  var p1=polar(500,690,332,a-w/332), q1=polar(500,690,332,a+w/332), p2=polar(500,690,r2,a);
  rays+='M'+n(p1[0])+','+n(p1[1])+' L'+n(p2[0])+','+n(p2[1])+' L'+n(q1[0])+','+n(q1[1])+' Z ';
}
add(path(rays,'fill="'+C.gold+'" opacity="0.62"'));
var longr='';
for(var i=0;i<7;i++){
  var a=(-124 + i*(68/6))*Math.PI/180;
  var p1=polar(500,690,340,a), p2=polar(500,690,568,a);
  longr+=line(p1[0],p1[1],p2[0],p2[1],'stroke="'+C.goldL+'" stroke-width="2" opacity="0.45"');
}
add(longr);


// ---------- storm cloud band across the crest ----------
function cloudPath(x1,x2,yBase,r){
  var nB=Math.max(1,Math.round((x2-x1)/(2*r)));
  var step=(x2-x1)/nB;
  var d='M'+n(x1)+','+n(yBase);
  for(var i=0;i<nB;i++){
    d+=' A'+n(step/2)+','+n(step/2)+' 0 0 1 '+n(x1+step*(i+1))+','+n(yBase);
  }
  return d;
}
// cloud mass: scalloped top and bottom lobes
function cloudMass(x1,x2,yc,wt,wtb,fill,stroke,sw){
  function widths(wts,span){ var s=0; for(var i=0;i<wts.length;i++) s+=wts[i]; return wts.map(function(w){ return span*w/s; }); }
  var tw=widths(wt,x2-x1), bw=widths(wtb,x2-x1);
  var d='M'+n(x1)+','+n(yc); var x=x1;
  for(var i=0;i<tw.length;i++){ var w=tw[i]; d+=' A'+n(w/2)+','+n(w/2)+' 0 0 1 '+n(x+w)+','+n(yc); x+=w; }
  d+=' L'+n(x2)+','+n(yc);
  for(var j=0;j<bw.length;j++){ var w2=bw[j]; d+=' A'+n(w2/2)+','+n(w2/2)+' 0 0 1 '+n(x-w2)+','+n(yc); x-=w2; }
  d+=' Z';
  return path(d,'fill="'+fill+'" stroke="'+(stroke||'none')+'" stroke-width="'+(sw||0)+'" stroke-linejoin="round"');
}
add(cloudMass(118,404,352,[34,50,30,58,38],[30,40,26],C.band,C.goldD,2.5));
add(cloudMass(596,882,352,[38,58,30,50,34],[26,40,30],C.band,C.goldD,2.5));
add(cloudMass(96,432,392,[40,62,34,70,44],[36,48,30],C.tealD,C.gold,2.5));
add(cloudMass(568,904,392,[44,70,34,62,40],[30,48,36],C.tealD,C.gold,2.5));
add(cloudMass(92,446,424,[44,68,38,76,46],[34,50,30],C.teal,C.gold,3.5));
add(cloudMass(554,908,424,[46,76,38,68,44],[30,50,34],C.teal,C.gold,3.5));
add(cloudMass(400,600,414,[40,54,40],[30,30],C.tealD,C.goldD,2));

// lightning from the cloud
function bolt(x1,y1,x2,y2,amp){
  var N=7, pts=[];
  var dx=x2-x1, dy=y2-y1, L=Math.hypot(dx,dy);
  var nx=-dy/L, ny=dx/L;
  for(var i=0;i<=N;i++){
    var t=i/N;
    var off=(i===0||i===N)?0:((i%2===0)?amp:-amp)*(1-t*0.35);
    pts.push([x1+dx*t+nx*off, y1+dy*t+ny*off]);
  }
  var d='M'+pts.map(function(p){return n(p[0])+','+n(p[1]);}).join(' L');
  return path(d,'fill="none" stroke="'+C.goldD+'" stroke-width="16" stroke-linejoin="miter" opacity="0.4"')+
         path(d,'fill="none" stroke="'+C.gold+'" stroke-width="10" stroke-linejoin="miter" stroke-linecap="round"')+
         path(d,'fill="none" stroke="'+C.cream+'" stroke-width="3.4" stroke-linejoin="miter" stroke-linecap="round"');
}


// ---------- crest emblem ----------
add(circle(500,150,58,C.band,'stroke="'+C.gold+'" stroke-width="6"'));
add(circle(500,150,47,'none','stroke="'+C.goldD+'" stroke-width="2"'));
for(var i=0;i<16;i++){ var a=i*Math.PI/8; var q1=polar(500,150,60,a), q2=polar(500,150,70,a); add(line(q1[0],q1[1],q2[0],q2[1],'stroke="'+C.goldD+'" stroke-width="2.5"')); }
// hurricane glyph: three arms
for(var k=0;k<3;k++){
  var d='';
  for(var t=0;t<=22;t++){
    var u=t/22;
    var ang=k*2.094 + u*2.6;
    var rr=8+u*30;
    var px=500+Math.cos(ang)*rr, py=150+Math.sin(ang)*rr;
    d+=(t===0?'M':' L')+n(px)+','+n(py);
  }
  add(path(d,'fill="none" stroke="'+C.goldL+'" stroke-width="4" stroke-linecap="round"'));
}
// flanking rules + whiplash sprigs
add(line(120,150,418,150,'stroke="'+C.goldD+'" stroke-width="2"'));
add(line(582,150,880,150,'stroke="'+C.goldD+'" stroke-width="2"'));
add(circle(418,150,4.5,C.gold)); add(circle(582,150,4.5,C.gold));
add(circle(204,150,4.5,C.gold)); add(circle(796,150,4.5,C.gold));
add(path('M204,150 L212,142 L220,150 L212,158 Z','fill="'+C.gold+'"'));
add(path('M780,150 L788,142 L796,150 L788,158 Z','fill="'+C.gold+'"'));

// ---------- art nouveau side vines ----------
function vine(cx,dir){
  var out='';
  var d='M'+n(cx)+',382 C'+n(cx-30*dir)+',540 '+n(cx+34*dir)+',700 '+n(cx-8*dir)+',880 S'+n(cx+18*dir)+',1000 '+n(cx)+',1042';
  out+=path(d,'fill="none" stroke="'+C.gold+'" stroke-width="3.8" stroke-linecap="round"');
  out+=path(d,'fill="none" stroke="'+C.goldD+'" stroke-width="1.2" stroke-linecap="round" opacity="0.8"');
  var ys=[452,552,652,752,852,952];
  for(var i=0;i<ys.length;i++){
    var y=ys[i], sd=(i%2===0)?1:-1;
    var ang=(sd>0? -52: 232)*dir;
    out+='<g transform="translate('+n(cx)+','+n(y)+') rotate('+n(ang)+') scale('+n(dir)+',1)">';
    out+=path('M0,0 C10,-8 20,-14 32,-14','fill="none" stroke="'+C.gold+'" stroke-width="2.4" stroke-linecap="round"');
    out+=path('M0,0 C4,-16 -10,-26 -24,-20 C-8,-18 -2,-8 0,0 Z','fill="'+C.goldD+'" stroke="'+C.goldL+'" stroke-width="1"');
    out+=path('M0,0 C12,-6 26,-10 40,-6 C28,2 14,4 0,0 Z','fill="'+C.goldD+'" stroke="'+C.goldL+'" stroke-width="1"');
    out+=circle(-26,-21,3,C.goldL);
    out+='</g>';
  }
  out+=path('M'+n(cx)+',1042 q -14,22 -2,38 q 14,14 6,32','fill="none" stroke="'+C.gold+'" stroke-width="2.6"');
  out+=circle(cx-4,1118,4.2,C.goldL);
  return out;
}
add(vine(134,1));
add(vine(866,-1));

// ---------- medallion ----------
add('<g clip-path="url(#med)">');
add(circle(500,690,317,'#0d2833'));
add(circle(500,690,317,'none','stroke="'+C.stormDD+'" stroke-width="9"'));
// three tapered spiral rain-bands
function spiralArm(a0,turns,r0,r1,w0,w1,fill,stroke,sw){
  var N=86, left=[], right=[];
  for(var i=0;i<=N;i++){
    var t=i/N, a=a0+turns*Math.PI*2*t, r=r0+(r1-r0)*t, w=w0+(w1-w0)*t;
    var px=500+Math.cos(a)*r, py=690+Math.sin(a)*r;
    var nx=-Math.sin(a), ny=Math.cos(a);
    left.push([px+nx*w, py+ny*w]); right.push([px-nx*w, py-ny*w]);
  }
  var pts=left.concat(right.reverse());
  return poly(pts,'fill="'+fill+'" stroke="'+stroke+'" stroke-width="'+sw+'" opacity="0.97"');
}
function spiralLine(a0,turns,r0,r1,sw,op,dash){
  var d='', N=70;
  for(var i=0;i<=N;i++){ var t=i/N, a=a0+turns*Math.PI*2*t, r=r0+(r1-r0)*t; d+=(i===0?'M':' L')+n(500+Math.cos(a)*r)+','+n(690+Math.sin(a)*r); }
  return path(d,'fill="none" stroke="'+C.cream+'" stroke-width="'+sw+'" opacity="'+op+'"'+(dash?' stroke-dasharray="'+dash+'"':'')+' stroke-linecap="round"');
}
add(spiralArm(-0.10, 0.34, 332, 226, 33, 12, C.pale, C.goldD, 1.8));
add(spiralArm(1.99, 0.34, 332, 226, 33, 12, C.pale, C.goldD, 1.8));
add(spiralArm(4.09, 0.34, 332, 226, 33, 12, C.pale, C.goldD, 1.8));
add(spiralLine(-0.10+0.115, 0.30, 324, 242, 2.4, 0.6, '8 11'));
add(spiralLine(1.99+0.115, 0.30, 324, 242, 2.4, 0.6, '8 11'));
add(spiralLine(4.09+0.115, 0.30, 324, 242, 2.4, 0.6, '8 11'));
add(spiralLine(-0.10-0.115, 0.30, 322, 244, 1.4, 0.3, '4 13'));
add(spiralLine(1.99-0.115, 0.30, 322, 244, 1.4, 0.3, '4 13'));
add(spiralLine(4.09-0.115, 0.30, 322, 244, 1.4, 0.3, '4 13'));
// rain ticks in the outer ring
var rt='';
for(var i2=0;i2<60;i2++){
  var ang2=(i2/60)*Math.PI*2;
  var rr1=300, rr2=rr1+13;
  var a1=polar(500,690,rr1,ang2), a2=polar(500,690,rr2,ang2);
  rt+=line(a1[0],a1[1],a2[0],a2[1],'stroke="'+C.cream+'" stroke-width="1.8" opacity="0.22"');
}
add(rt);
// eye wall: cloud puffs, then the gold halo laid over their inner half
// eye wall: a scalloped cloud edge hugging the halo
var ew='';
for(var i3=0;i3<30;i3++){
  var aa=(i3/30)*Math.PI*2, ab=((i3+1)/30)*Math.PI*2;
  var s1=polar(500,664,186,aa), s2=polar(500,664,186,ab), sm=polar(500,664,214,(aa+ab)/2);
  ew+='M'+n(s1[0])+','+n(s1[1])+' Q'+n(sm[0])+','+n(sm[1])+' '+n(s2[0])+','+n(s2[1])+' ';
}
add(path(ew,'fill="none" stroke="'+C.storm+'" stroke-width="13" stroke-linecap="round"'));
add(path(ew,'fill="none" stroke="'+C.cream+'" stroke-width="4" stroke-linecap="round" opacity="0.85"'));
add(circle(500,664,182,C.gold));
add(circle(500,664,182,'none','stroke="'+C.goldD+'" stroke-width="5"'));
add(circle(500,664,148,'none','stroke="'+C.goldL+'" stroke-width="2" opacity="0.4"'));
add(circle(500,664,116,'none','stroke="'+C.goldL+'" stroke-width="2" opacity="0.3"'));

// ---------- the shelter: a roof left standing, tilted ----------
add('<g transform="rotate(-7 500 640)">');
add(rect(364,620,14,182,C.redD));
add(rect(622,620,14,182,C.redD));
add(path('M622,700 l 14,10 l -14,9','fill="none" stroke="'+C.redD+'" stroke-width="4"'));
add(poly([[500,472],[656,594],[656,616],[344,616],[344,594]],'fill="'+C.red+'" stroke="'+C.gold+'" stroke-width="5" stroke-linejoin="round"'));
add(path('M500,502 L572,586 M500,502 L428,586','stroke="'+C.goldD+'" stroke-width="2.2" opacity="0.65" fill="none"'));
add(circle(500,576,12,C.ink,'stroke="'+C.gold+'" stroke-width="3.5"'));
add(circle(500,576,4.6,C.goldL));
add('</g>');
// family
function figure(cx,headY,hr,bodyW,bodyH,fill){
  var out='';
  out+=circle(cx,headY,hr,fill);
  out+=path('M'+n(cx-bodyW/2)+','+n(headY+hr+bodyH)+' L'+n(cx-bodyW*0.46)+','+n(headY+hr*1.6)+' Q'+n(cx)+','+n(headY+hr*0.9)+' '+n(cx+bodyW*0.46)+','+n(headY+hr*1.6)+' L'+n(cx+bodyW/2)+','+n(headY+hr+bodyH)+' Z','fill="'+fill+'"');
  return out;
}
add(circle(462,700,30,'none','stroke="'+C.cream+'" stroke-width="5"'));
add(circle(540,688,27,'none','stroke="'+C.cream+'" stroke-width="5"'));
add(circle(500,752,18,'none','stroke="'+C.cream+'" stroke-width="4"'));
add(figure(500,752,12,34,48,C.ink));
add(figure(540,688,18,56,112,C.ink));
add(figure(462,700,20,60,96,C.ink));
add(path('M436,722 q -20,16 -16,40','stroke="'+C.ink+'" stroke-width="11" stroke-linecap="round" fill="none"'));
add(path('M564,714 q 20,18 14,40','stroke="'+C.ink+'" stroke-width="10" stroke-linecap="round" fill="none"'));

// ---------- the surge ----------
function curl(cx,cy,r,dir){
  var d='M'+n(cx)+','+n(cy)+' a'+n(r)+','+n(r)+' 0 1 '+dir+' '+n(r*1.7)+','+n(-r*0.3);
  return path(d,'fill="none" stroke="'+C.cream+'" stroke-width="3.4" stroke-linecap="round" opacity="0.92"');
}
add(path('M170,838 C230,812 280,772 330,790 C380,808 430,800 470,812 C530,828 590,806 650,814 C710,822 780,812 830,818 L830,1014 L170,1014 Z','fill="'+C.tealD+'"'));
add(path('M170,838 C230,812 280,772 330,790 C380,808 430,800 470,812 C530,828 590,806 650,814 C710,822 780,812 830,818','fill="none" stroke="'+C.cream+'" stroke-width="4.5" opacity="0.92"'));
add(path('M190,872 C270,852 330,880 410,862 C490,844 550,872 630,856 C690,844 770,864 816,854','fill="none" stroke="'+C.cream+'" stroke-width="2.4" opacity="0.45"'));
add(path('M210,908 C290,890 350,916 430,900 C510,884 570,910 650,894 C710,882 776,900 806,890','fill="none" stroke="'+C.cream+'" stroke-width="2" opacity="0.26"'));
add(path('M230,946 C310,930 370,954 450,938 C530,922 590,946 670,932 C730,920 780,934 800,926','fill="none" stroke="'+C.cream+'" stroke-width="1.8" opacity="0.15"'));
add(curl(300,788,17,1));
add(curl(452,810,14,1));
add(curl(668,812,16,1));
add(circle(370,846,3.2,C.cream)); add(circle(560,850,3,C.cream)); add(circle(744,844,2.6,C.cream));
add('</g>');



// lightning crosses the rim from the cloud banks
add(bolt(238,372,332,556,20));
add(bolt(762,372,668,556,20));
// medallion rim
add(circle(500,690,318,'none','stroke="'+C.goldD+'" stroke-width="15"'));
add(circle(500,690,318,'none','stroke="'+C.gold+'" stroke-width="9"'));
add(circle(500,690,305,'none','stroke="'+C.goldL+'" stroke-width="2.5" opacity="0.8"'));
// coin ticks + pearl chain outside the medallion
for(var i4=0;i4<48;i4++){
  var a4=(i4/48)*Math.PI*2;
  var p3=polar(500,690,328,a4), p4=polar(500,690,(i4%2===0)?344:336,a4);
  add(line(p3[0],p3[1],p4[0],p4[1],'stroke="'+C.gold+'" stroke-width="'+(i4%2===0?3:1.8)+'" opacity="0.85"'));
}
for(var i5=0;i5<32;i5++){
  var a5=(i5/32)*Math.PI*2;
  var p5=polar(500,690,356,a5);
  add(circle(p5[0],p5[1],4.2,C.goldD));
}
add(circle(500,690,356,'none','stroke="'+C.goldD+'" stroke-width="1.6" opacity="0.7"'));
// cloud scrolls at the sides of the crest
add(path('M212,410 q 26,-30 52,-4 q 24,24 -8,30 q -26,4 -22,-18','fill="none" stroke="'+C.goldL+'" stroke-width="2.6" opacity="0.7"'));
add(path('M788,410 q -26,-30 -52,-4 q -24,24 8,30 q 26,4 22,-18','fill="none" stroke="'+C.goldL+'" stroke-width="2.6" opacity="0.7"'));


// ---------- divider + bottom register ----------
add(line(150,1078,392,1078,'stroke="'+C.goldD+'" stroke-width="2"'));
add(line(608,1078,850,1078,'stroke="'+C.goldD+'" stroke-width="2"'));
add(path('M500,1062 L514,1078 L500,1094 L486,1078 Z','fill="'+C.gold+'"'));
add(line(500,1094,500,1116,'stroke="'+C.goldD+'" stroke-width="2"'));
[[470,1078],[530,1078],[440,1078],[560,1078]].forEach(function(p){ add(circle(p[0],p[1],3.4,C.gold)); });

// cartouche between the two small scenes
add(rect(330,1160,340,180,'none','stroke="'+C.gold+'" stroke-width="3" rx="20"'));
add(rect(340,1170,320,160,'none','stroke="'+C.goldD+'" stroke-width="1.6" rx="14" opacity="0.8"'));
add(path('M392,1196 q 24,-14 48,0 t 48,0 t 48,0','fill="none" stroke="'+C.gold+'" stroke-width="2.2" opacity="0.55"'));
for(var i=0;i<20;i++){ var a=(i/20)*Math.PI*2; var q1=polar(500,1256,44,a), q2=polar(500,1256,(i%2===0)?56:50,a); add(line(q1[0],q1[1],q2[0],q2[1],'stroke="'+C.gold+'" stroke-width="2"')); }
add(path('M500,1292 C460,1258 470,1222 500,1245 C530,1222 540,1258 500,1292 Z','fill="'+C.gold+'" stroke="'+C.goldD+'" stroke-width="2.5"'));
add(path('M432,1320 q 26,-12 52,0 t 52,0','fill="none" stroke="'+C.goldD+'" stroke-width="1.8" opacity="0.5"'));

// ---------- left vignette: before ----------
function vignette(cx,cy,clip,inner){
  var o='';
  o+=circle(cx,cy,104,C.band,'stroke="'+C.gold+'" stroke-width="7"');
  o+=circle(cx,cy,112,'none','stroke="'+C.goldD+'" stroke-width="2"');
  for(var i=0;i<24;i++){
    var a=(i/24)*Math.PI*2;
    var q1=polar(cx,cy,112,a), q2=polar(cx,cy,(i%2===0)?119:115,a);
    o+=line(q1[0],q1[1],q2[0],q2[1],'stroke="'+C.gold+'" stroke-width="2"');
  }
  o+='<g clip-path="url(#'+clip+')">'+inner+'</g>';
  o+=circle(cx,cy,96,'none','stroke="'+C.goldD+'" stroke-width="2"');
  return o;
}
var before='';
before+=rect(100,1154,208,208,C.cream);
before+=circle(150,1204,16,C.gold);
for(var i=0;i<10;i++){ var a=i*Math.PI/5; var q1=polar(150,1204,20,a), q2=polar(150,1204,27,a); before+=line(q1[0],q1[1],q2[0],q2[1],'stroke="'+C.gold+'" stroke-width="2"'); }
before+=rect(100,1282,208,90,C.tealD);
before+=path('M100,1282 q 24,-10 48,0 t 48,0 t 48,0 t 48,0 L292,1154 L100,1154 Z','fill="'+C.tealD+'"');
// house
before+=rect(154,1228,54,48,'#e6d2a6','stroke="'+C.redD+'" stroke-width="2.5"');
before+=poly([[146,1230],[181,1194],[216,1230]],'fill="'+C.red+'" stroke="'+C.redD+'" stroke-width="2.5"');
before+=rect(172,1252,18,24,C.redD);
before+=rect(192,1240,12,12,C.gold);
// palm
before+=path('M228,1282 C226,1262 232,1244 244,1230','fill="none" stroke="#3a2a20" stroke-width="5" stroke-linecap="round"');
for(var i=0;i<5;i++){ var a=-2.9+i*0.42; var e=polar(244,1230,26,a); before+=path('M244,1230 Q'+n(244+Math.cos(a)*14)+','+n(1230+Math.sin(a)*14-6)+' '+n(e[0])+','+n(e[1]),'fill="none" stroke="'+C.tealD+'" stroke-width="4" stroke-linecap="round"'); }
add(vignette(196,1258,'vL',before));

// ---------- right vignette: after ----------
var after='';
after+=rect(700,1154,208,208,'#132038');
for(var i=0;i<14;i++){ var x=708+((i*41)%186), y=1160+((i*57)%112); after+=line(x,y,x-9,y+26,'stroke="'+C.gold+'" stroke-width="1.8" opacity="0.45"'); }
after+=rect(700,1316,208,74,'#2c6873');
after+=path('M700,1316 q 26,-12 52,0 t 52,0 t 52,0 t 52,0','fill="none" stroke="'+C.cream+'" stroke-width="3" opacity="0.8"');
after+=path('M700,1344 q 26,-12 52,0 t 52,0 t 52,0 t 52,0','fill="none" stroke="'+C.cream+'" stroke-width="2.2" opacity="0.45"');
// toppled house
after+='<g transform="rotate(17 780 1266)">';
after+=rect(740,1234,80,68,'#d8c9a4','stroke="'+C.redD+'" stroke-width="3"');
after+=poly([[730,1236],[781,1194],[832,1236]],'fill="'+C.red+'" stroke="'+C.redD+'" stroke-width="3"');
after+=rect(762,1262,22,26,'#132038');
after+='</g>';
after+=poly([[792,1320],[844,1306],[854,1328],[802,1342]],'fill="'+C.red+'" stroke="'+C.redD+'" stroke-width="2.5"');
add(vignette(804,1258,'vR',after));

// bottom corner ticks on the field
add(line(116,1396,884,1396,'stroke="'+C.goldD+'" stroke-width="1.6" opacity="0.5"'));
add(path('M500,1382 L508,1396 L500,1410 L492,1396 Z','fill="'+C.goldD+'" opacity="0.8"'));

// ---------- grain last ----------
add(rect(0,0,W,H,'#000','filter="url(#grain)" opacity="0.13"'));
add('</svg>');
fs.writeFileSync(process.argv[2] || 'la-tormenta.svg', S.join('\n'));
console.log('wrote', (S.join('\n').length/1024).toFixed(1)+'KB', S.length+' elements');