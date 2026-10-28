
import fs from 'node:fs';
const OUT='F:/repo-aiscan2/tropico-2026/iterations/03-pabellon-ministerio/pabellon-ministerio.svg';
const f=n=>Math.round(n*10)/10;
const C={
  skyUp:'#B6D4D2', skyLow:'#F7F0DA',
  sea:'#5E9BA4', seaHi:'#BFD6CE', seaDeep:'#4E8A96',
  sand:'#CBB886', sandFar:'#D8C79A',
  shPav:'#5F6444', shPavDeep:'#4B5036', shPavLit:'#87895F',
  conc:'#F2E7C6', concLit:'#FCF6E2', concSh:'#DCD1AF', recess:'#E1D4AB',
  band:'#6C7149',
  sun:'#FFFDF2',
  coral:'#D8462E', coralDk:'#9C331F', coralHi:'#ED6A48',
  dark:'#1E2E28', palm:'#14231A', palm2:'#1A2C20',
  plinth:'#8C8161', panel:'#39474E', plastic:'#F1EAD2', plasticSh:'#D5CBAC', fig:'#182519',
  dish:'#43565a', dishIn:'#2c3c40'
};
const P=[],S=(...a)=>P.push(...a);
function bez(p0,p1,p2,p3,t){const mt=1-t;
  return [mt*mt*mt*p0[0]+3*mt*mt*t*p1[0]+3*mt*t*t*p2[0]+t*t*t*p3[0],
          mt*mt*mt*p0[1]+3*mt*mt*t*p1[1]+3*mt*t*t*p2[1]+t*t*t*p3[1]];}
function frond(bx,by,ang,len,bend,maxW,nb){
  const a=ang*Math.PI/180,b=(ang+bend)*Math.PI/180;
  const p1=[bx+Math.cos(a)*len*0.30,by+Math.sin(a)*len*0.30];
  const p3=[bx+Math.cos(b)*len,by+Math.sin(b)*len];
  const p2=[p3[0]-Math.cos(b)*len*0.36,p3[1]-Math.sin(b)*len*0.36];
  const N=nb*2,pts=[];
  for(let i=0;i<=N;i++)pts.push(bez([bx,by],p1,p2,p3,i/N));
  const prof=t=>maxW*(0.12+0.88*Math.sin(Math.PI*Math.pow(t,0.78)))*(1-0.45*t);
  const side=(i,dir)=>{
    const p=pts[i],q=pts[Math.min(N,i+1)];
    let ux=q[0]-p[0],uy=q[1]-p[1];const ul=Math.hypot(ux,uy)||1;ux/=ul;uy/=ul;
    let w=prof(i/N); if(i%2===1)w*=0.62;
    return [p[0]-uy*dir*w,p[1]+ux*dir*w];};
  let d='';
  for(let i=0;i<=N;i++){const s=side(i,1);d+=(i?'L':'M')+f(s[0])+' '+f(s[1]);}
  for(let i=N;i>=0;i--){const s=side(i,-1);d+='L'+f(s[0])+' '+f(s[1]);}
  return d+'Z';
}
const ANGS=[-131,-107,-82,-58,-33,-8,17,42,68,94,121,147,171,-148,166,58];
const LENS=[0.86,0.96,1.02,1.04,1.00,0.94,0.92,0.96,1.02,1.04,0.98,0.88,0.90,0.74,0.66,0.52];
function crown(cx,cy,sc,fill,seed=1){
  let d='';
  for(let i=0;i<ANGS.length;i++){
    const a=ANGS[i]+((i*7+seed*3)%5-2)*2.2;
    let delta=((90-a+540)%360)-180;
    const bend=delta*(0.40+0.14*((i*5+seed)%3));
    const L=LENS[i]*sc*200*(0.94+0.12*((i*3+seed)%3));
    d+=frond(cx,cy,a,L,bend,(13+3*((i*5+seed)%3))*sc,30);
  }
  for(const [a,l] of [[-162,0.5],[-142,0.44],[178,0.42],[154,0.38],[124,0.32],[96,0.28]])
    d+=frond(cx,cy,a,124*l*sc,-20,6.5*sc,26);
  return '<path d="'+d+'" fill="'+fill+'"/>';
}
function trunk(x0,y0,x1,y1,cx,cy,w0,w1,fill){
  const pts=[];
  for(let i=0;i<=22;i++){
    const t=i/22,mt=1-t;
    const x=mt*mt*x0+2*mt*t*cx+t*t*x1,y=mt*mt*y0+2*mt*t*cy+t*t*y1;
    const dx=2*mt*(cx-x0)+2*t*(x1-cx),dy=2*mt*(cy-y0)+2*t*(y1-cy);
    const l=Math.hypot(dx,dy)||1,nx=-dy/l,ny=dx/l;
    let w=w1+(w0-w1)*Math.pow(1-t,0.8);
    if(t>0.93)w*=(1-t)/0.07*0.5+0.34;
    pts.push([x+nx*w/2,y+ny*w/2,x-nx*w/2,y-ny*w/2]);}
  let d='M'+f(pts[0][0])+' '+f(pts[0][1]);
  for(const p of pts)d+='L'+f(p[0])+' '+f(p[1]);
  for(let i=pts.length-1;i>=0;i--)d+='L'+f(pts[i][2])+' '+f(pts[i][3]);
  return '<path d="'+d+'Z" fill="'+fill+'"/>';
}
// clean tapered frond shadow on the ground
function leafShadow(x0,y0,ang,len,w){
  const a=ang*Math.PI/180,dx=Math.cos(a),dy=Math.sin(a);
  const px=-dy*w, py=dx*w;
  const mx=x0+dx*len*0.5, my=y0+dy*len*0.5;
  return '<path d="M'+f(x0+px)+' '+f(y0+py)+' Q'+f(mx+px*1.5)+' '+f(my+py*1.5)+' '+f(x0+dx*len)+' '+f(y0+dy*len)+' Q'+f(mx-px*0.7)+' '+f(my-py*0.7)+' '+f(x0-px)+' '+f(y0-py)+' Z"/>';
}
const HZ=492, SEA_BOT=574, BASE=830;
const TALL_L=-140, TALL_R=700, LOW_L=700, LOW_R=1060, LOW_ROOF=190;
const CORAL_L=542, CORAL_R=714;
const VPx=1750, SH=(1200-BASE)/(BASE-HZ), pavX=bx=>f(bx+(bx-VPx)*SH);

S('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 1200" width="1600" height="1200">');
S('<defs>');
S('<filter id="grain" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB"><feTurbulence type="fractalNoise" baseFrequency="0.82" numOctaves="3" seed="11" stitchTiles="stitch"/><feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0.30 0.30 0.30 0 0"/></filter>');
S('<filter id="b16" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="16"/></filter>');
S('<pattern id="formwork" width="9" height="9" patternUnits="userSpaceOnUse"><rect width="9" height="9" fill="none"/><path d="M0 8.4 H9" stroke="#6b6249" stroke-width="1.1" opacity="0.5"/></pattern>');
S('<pattern id="fwV" width="11" height="11" patternUnits="userSpaceOnUse" patternTransform="translate(3,7)"><rect width="11" height="11" fill="none"/><path d="M10 0 V11" stroke="#6b6249" stroke-width="1.1" opacity="0.5"/></pattern>');
S('<pattern id="fwD" width="14" height="14" patternUnits="userSpaceOnUse" patternTransform="translate(2,5)"><rect width="14" height="14" fill="none"/><path d="M0 0 L14 14" stroke="#6b6249" stroke-width="1.1" opacity="0.45"/></pattern>');
S('<pattern id="fwH2" width="13" height="13" patternUnits="userSpaceOnUse" patternTransform="translate(1,4)"><rect width="13" height="13" fill="none"/><path d="M0 12 H13" stroke="#5d5540" stroke-width="1.2" opacity="0.5"/></pattern>');
S('<filter id="b6" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="6"/></filter>');
S('<filter id="b3" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3"/></filter>');
S('<clipPath id="bld"><rect x="'+TALL_L+'" y="-40" width="'+(TALL_R-TALL_L)+'" height="'+(BASE+40)+'"/><rect x="'+LOW_L+'" y="'+LOW_ROOF+'" width="'+(LOW_R-LOW_L)+'" height="'+(BASE-LOW_ROOF)+'"/></clipPath>');
S('<clipPath id="pavclip"><rect x="0" y="'+SEA_BOT+'" width="1600" height="'+(1200-SEA_BOT)+'"/></clipPath>');
S('</defs>');

S('<rect x="0" y="0" width="1600" height="290" fill="'+C.skyUp+'"/>');
S('<rect x="0" y="290" width="1600" height="'+(HZ-290)+'" fill="'+C.skyLow+'"/>');
S('<rect x="0" y="'+HZ+'" width="1600" height="'+(SEA_BOT-HZ)+'" fill="'+C.sea+'"/>');
S('<rect x="0" y="'+(HZ+38)+'" width="1600" height="'+(SEA_BOT-HZ-38)+'" fill="'+C.seaDeep+'"/>');
S('<rect x="0" y="'+HZ+'" width="1600" height="4" fill="'+C.seaHi+'" opacity="0.9"/>');
S('<rect x="1150" y="'+(HZ+16)+'" width="330" height="3" fill="'+C.seaHi+'" opacity="0.32"/>');
S('<g fill="#4A6D76">');
S('<rect x="1286" y="477" width="112" height="16"/>');
S('<rect x="1290" y="466" width="13" height="12"/><rect x="1308" y="461" width="11" height="17"/>');
S('<rect x="1325" y="468" width="12" height="10"/><rect x="1342" y="463" width="11" height="15"/>');
S('<rect x="1358" y="469" width="13" height="9"/><rect x="1375" y="465" width="10" height="13"/>');
S('</g>');
// shore + far palms (a line of palms along the shore)
S('<rect x="0" y="'+SEA_BOT+'" width="1600" height="5" fill="#86976f"/>');
S('<g stroke="#2f412d" fill="none" stroke-width="2" stroke-linecap="round">');
for(const [px,ph,ln] of [[1082,18,-2],[1108,12,1],[1146,22,-3],[1174,11,0],[1202,16,2],[1232,13,-1],[1258,9,1],[1348,18,2],[1394,12,-2],[1436,15,0],[1478,10,-1]]){
  const cx=px+ln*2, cy=SEA_BOT-ph;
  S('<path d="M'+px+' '+(SEA_BOT+2)+' Q'+(px+ln)+' '+(SEA_BOT-ph*0.55)+' '+cx+' '+cy+'" stroke-width="1.8"/>');
  S('<path d="M'+(cx-13)+' '+(cy+3)+' l-4 -5 M'+(cx-4)+' '+(cy+1)+' l-2 -6 M'+(cx+4)+' '+(cy+1)+' l2 -6 M'+(cx+12)+' '+(cy+3)+' l4 -5" stroke-width="1.5"/>');
}
S('</g>');
S('<rect x="0" y="'+SEA_BOT+'" width="1600" height="'+(1200-SEA_BOT)+'" fill="'+C.sand+'"/>');
S('<rect x="0" y="'+SEA_BOT+'" width="1600" height="46" fill="'+C.sandFar+'"/>');

// building
S('<rect x="'+TALL_L+'" y="-40" width="'+(TALL_R-TALL_L)+'" height="'+(BASE+40)+'" fill="'+C.recess+'"/>');
S('<rect x="'+LOW_L+'" y="'+LOW_ROOF+'" width="'+(LOW_R-LOW_L)+'" height="'+(BASE-LOW_ROOF)+'" fill="'+C.conc+'"/>');
S('<rect x="'+(LOW_L-12)+'" y="'+(LOW_ROOF-30)+'" width="'+(LOW_R-LOW_L+12)+'" height="30" fill="'+C.concLit+'"/>');
S('<rect x="'+(LOW_L-12)+'" y="'+(LOW_ROOF-4)+'" width="'+(LOW_R-LOW_L+12)+'" height="8" fill="'+C.concSh+'"/>');
S('<rect x="'+TALL_L+'" y="-40" width="'+(TALL_R-TALL_L)+'" height="'+(BASE+40)+'" fill="url(#formwork)" opacity="0.14"/>');
S('<rect x="'+LOW_L+'" y="'+LOW_ROOF+'" width="'+(LOW_R-LOW_L)+'" height="'+(BASE-LOW_ROOF)+'" fill="url(#fwV)" opacity="0.13"/>');
S('<g clip-path="url(#bld)">');
const BW=[46,26,54,34,22,48,30,58,26,40,32], PER=92;
for(let i=-3;i<15;i++){
  const x0=-160+i*PER, w=BW[((i+3)%BW.length+BW.length)%BW.length];
  const yb=BASE+40, shear=-((yb+40)+0.22*(x0-240));
  S('<path d="M'+x0+' -40 h'+w+' l'+f(shear)+' '+yb+' h'+(-w)+' Z" fill="'+C.band+'"/>');
}

// THE EVENT: a missing fin lets one hard blade of full sun fall across the striped wall
const BX=474, BW2=94, BSH=-((BASE+40)+0.22*(BX-240));
S('<path d="M'+BX+' -40 h'+BW2+' l'+f(BSH)+' '+(BASE+40)+' h'+(-BW2)+' Z" fill="#FFFFFF"/>');
// the fin that would have cut it is gone: its stump hangs off the plate edge
S('<g transform="translate('+(BX+BW2+10)+',0)">');
S('<rect x="0" y="-10" width="22" height="168" fill="'+C.concLit+'"/>');
S('<rect x="0" y="-10" width="5" height="178" fill="#6b6249" opacity="0.30"/>');
S('<path d="M0 158 h22 l-4 13 l-5 -6 l-4 8 l-4 -7 l-5 5 Z" fill="'+C.concLit+'"/>');
S('<path d="M6 174 l6 9" stroke="#5F6444" stroke-width="2" opacity="0.7"/>');
S('</g>');
S('<path d="M'+(BX-30)+' -40 h26 l'+f(BSH+3)+' '+(BASE+40)+' h-26 Z" fill="'+C.band+'"/>');
S('</g>');

// coral portal
S('<rect x="'+(CORAL_L-20)+'" y="238" width="'+(CORAL_R-CORAL_L+40)+'" height="'+(BASE-238)+'" fill="'+C.dark+'"/>');
S('<rect x="'+CORAL_L+'" y="266" width="'+(CORAL_R-CORAL_L)+'" height="'+(BASE-266)+'" fill="'+C.coral+'"/>');
S('<rect x="'+CORAL_L+'" y="266" width="16" height="'+(BASE-266)+'" fill="'+C.coralDk+'"/>');
S('<rect x="'+(CORAL_R-12)+'" y="266" width="12" height="'+(BASE-266)+'" fill="'+C.coralHi+'"/>');
S('<rect x="'+CORAL_L+'" y="266" width="'+(CORAL_R-CORAL_L)+'" height="58" fill="'+C.coralDk+'" opacity="0.42"/>');
S('<rect x="'+(CORAL_L-20)+'" y="210" width="'+(CORAL_R-CORAL_L+40)+'" height="28" fill="'+C.concLit+'"/>');
S('<rect x="'+(CORAL_L-20)+'" y="238" width="'+(CORAL_R-CORAL_L+40)+'" height="10" fill="'+C.concSh+'"/>');
S('<rect x="'+(CORAL_L-20)+'" y="238" width="20" height="'+(BASE-238)+'" fill="'+C.concSh+'"/>');
S('<rect x="'+CORAL_R+'" y="238" width="20" height="'+(BASE-238)+'" fill="'+C.concLit+'"/>');
// doorway
S('<rect x="602" y="668" width="78" height="'+(BASE-668)+'" fill="#14221a"/>');
S('<rect x="676" y="668" width="4" height="'+(BASE-668)+'" fill="#6d4430"/>');
S('<rect x="630" y="690" width="7" height="7" fill="#8c7350"/>');
// broken canopy: hard shadow first, then slab with a stepped broken end
S('<rect x="500" y="626" width="212" height="50" fill="'+C.dark+'" opacity="0.30"/>');
S('<rect x="512" y="592" width="200" height="34" fill="'+C.concLit+'"/>');
S('<path d="M712 592 v34 h-14 l-4 -9 l-10 5 l-6 -8 l-14 2 v-24 Z" fill="'+C.concLit+'"/>');
S('<rect x="512" y="618" width="200" height="14" fill="'+C.concSh+'"/>');
// fins
for(const fx of [86,300,430]){
  S('<rect x="'+(fx-10)+'" y="0" width="10" height="'+BASE+'" fill="'+C.concSh+'"/>');
  S('<rect x="'+fx+'" y="0" width="28" height="'+BASE+'" fill="'+C.concLit+'"/>');
  for(let k=0;k<3;k++) S('<rect x="'+(fx+6+k*8+(fx%7)) +'" y="0" width="1.3" height="'+BASE+'" fill="#6b6249" opacity="0.16"/>');
  S('<rect x="'+(fx+25)+'" y="0" width="3" height="'+BASE+'" fill="#FFFFF4" opacity="0.95"/>');
}
// closed wing
S('<rect x="748" y="636" width="244" height="170" fill="'+C.panel+'"/>');
S('<rect x="748" y="636" width="244" height="11" fill="#1e2a26"/>');
for(let x=758;x<988;x+=17) S('<rect x="'+x+'" y="647" width="6" height="159" fill="#4a575c" opacity="0.5"/>');
S('<rect x="950" y="700" width="15" height="11" fill="#c0b18d"/>');
S('<rect x="760" y="608" width="220" height="14" fill="'+C.concSh+'"/>');
S('<path d="M768 615 h88" stroke="#d3dcc9" stroke-width="4"/>');
S('<path d="M862 615 h56" stroke="#d3dcc9" stroke-width="4"/>');
S('<path d="M924 615 h10 l5 6" stroke="#d3dcc9" stroke-width="2.4"/>');
// plinth + steps
S('<rect x="'+TALL_L+'" y="'+BASE+'" width="'+(LOW_R-TALL_L)+'" height="46" fill="'+C.plinth+'"/>');
S('<rect x="'+TALL_L+'" y="'+BASE+'" width="'+(LOW_R-TALL_L)+'" height="46" fill="url(#fwD)" opacity="0.16"/>');
S('<rect x="'+TALL_L+'" y="'+BASE+'" width="'+(LOW_R-TALL_L)+'" height="10" fill="'+C.dark+'" opacity="0.5"/>');
for(let k=0;k<3;k++){
  const y=BASE+46+k*17;
  S('<rect x="'+(546-k*10)+'" y="'+y+'" width="'+(200+k*20)+'" height="17" fill="'+(k%2?C.concSh:C.concLit)+'"/>');
  S('<rect x="'+(546-k*10)+'" y="'+y+'" width="'+(200+k*20)+'" height="4" fill="'+C.plinth+'" opacity="0.75"/>');
}
// solar
for(let i=0;i<5;i++){
  const x=722+i*58; if(i===3) continue;
  S('<path d="M'+x+' '+(LOW_ROOF-30)+' h42 l10 -46 h-42 Z" fill="'+C.panel+'"/>');
  S('<path d="M'+x+' '+(LOW_ROOF-30)+' h42 l10 -46 h-42 Z" fill="none" stroke="#5d6b70" stroke-width="1.3"/>');
  S('<path d="M'+(x+9)+' '+(LOW_ROOF-30)+' l10 -46" stroke="#5d6b70" stroke-width="1"/>');
}
S('<path d="M'+(722+2*58+7)+' '+(LOW_ROOF-30)+' l9 -19" stroke="#c8d2d0" stroke-width="1.7" opacity="0.85"/>');
// dish
S('<rect x="1046" y="116" width="7" height="80" fill="'+C.dark+'"/>');
S('<path d="M1046 190 l-14 8 h36 l-14 -8 Z" fill="'+C.dark+'"/>');
S('<g transform="rotate(-26 1053 110)">');
S('<ellipse cx="1053" cy="110" rx="62" ry="26" fill="'+C.dish+'"/>');
S('<ellipse cx="1053" cy="104" rx="56" ry="21" fill="'+C.dishIn+'"/>');
S('<ellipse cx="1053" cy="104" rx="56" ry="21" fill="none" stroke="#5d7276" stroke-width="1.6"/>');
S('<path d="M997 104 q56 -34 112 0" fill="none" stroke="#62787c" stroke-width="2"/>');
S('<circle cx="1053" cy="114" r="7" fill="'+C.dark+'"/>');
S('<rect x="1049" y="86" width="5" height="26" fill="'+C.dark+'"/>');
S('<circle cx="1051" cy="84" r="6" fill="'+C.dark+'"/>');
S('</g>');

// pavement shadow
S('<g clip-path="url(#pavclip)">');
S('<path d="M'+TALL_L+' '+BASE+' H'+LOW_R+' L'+pavX(LOW_R)+' 1200 L'+pavX(TALL_L)+' 1200 Z" fill="'+C.shPav+'"/>');
S('<path d="M'+TALL_L+' '+BASE+' H'+LOW_R+' L'+pavX(LOW_R)+' '+(BASE+70)+' L'+(TALL_L-300)+' '+(BASE+70)+' Z" fill="'+C.shPavDeep+'"/>');
for(const [bx0,bw] of [[848,68],[714,42]]){
  S('<path d="M'+bx0+' '+BASE+' H'+(bx0+bw)+' L'+pavX(bx0+bw)+' 1200 L'+pavX(bx0)+' 1200 Z" fill="'+C.shPavLit+'"/>');
}
S('</g>');

// figure
const FX=712, FY=874;
S('<path d="M'+(FX+3)+' '+(FY-52)+' q-8 -2 -9 7 q-1 9 7 10 q8 1 9 -7 q1 -9 -7 -10 Z" fill="'+C.fig+'"/>');
S('<path d="M'+(FX-8)+' '+(FY-44)+' q9 -4 17 0 l4 19 l-6 2 l-3 -8 l-2 11 l-4 0 l-1 11 l7 3 l3 5 l-4 6 l-6 -3 l-4 3 l-7 0 l-1 -21 Z" fill="'+C.fig+'"/>');
S('<path d="M'+(FX+11)+' '+(FY-41)+' l6 15" stroke="'+C.fig+'" stroke-width="4.6"/>');
S('<path d="M'+(FX-9)+' '+(FY-41)+' l-5 16" stroke="'+C.fig+'" stroke-width="4.6"/>');
S('<path d="M'+(FX-16)+' '+(FY-24)+' h12 v17 h-12 Z" fill="'+C.fig+'"/>');
S('<path d="M'+(FX-13)+' '+(FY-25)+' q4 -5 9 0" fill="none" stroke="'+C.fig+'" stroke-width="2.2"/>');
S('<path d="M'+FX+' '+FY+' l-48 20 h32 Z" fill="'+C.shPavDeep+'" opacity="0.9"/>');

// palms
S(trunk(1216,900,1140,614,1236,764,22,11,C.palm2));
S(crown(1140,614,0.74,C.palm2,2));
// back palm shadow: a few clean fronds
S('<g opacity="0.30" fill="'+C.shPavDeep+'">');
for(let i=0;i<4;i++) S(leafShadow(1146, 872+i*7, 197+i*8, 150+((i*41)%60), 8));
S('</g>');
// palm shade pooling in the near foreground
S('<g opacity="0.26" fill="'+C.shPavDeep+'">');
for(let i=0;i<5;i++) S(leafShadow(1470-i*26, 1190, 200+i*12, 160+((i*61)%90), 14));
S('</g>');
S(trunk(1660,1260,1540,700,1690,1000,46,20,C.palm));
S(crown(1540,700,1.2,C.palm,1));

// monobloc chair, near, readable, standing at the edge of the shade
const chx=1330, chy=1172, cs=1.52;
S('<path d="M'+(chx-62)+' '+(chy-4)+' l104 -18 l8 10 l-110 20 Z" fill="'+C.shPavDeep+'" opacity="0.5"/>');
S('<g transform="translate('+chx+','+chy+') scale('+cs+')">');
S('<path d="M-30,-96 Q-33,-105 -20,-107 L6,-111 Q18,-112 19,-102 L22,-52 L-24,-45 Z" fill="'+C.plastic+'"/>');
S('<path d="M-30,-96 Q-33,-105 -20,-107 L6,-111 Q18,-112 19,-102 L19,-88 L-27,-81 Z" fill="'+C.plasticSh+'"/>');
S('<path d="M-24,-45 L24,-52 L36,-39 L-14,-31 Z" fill="'+C.plastic+'"/>');
S('<path d="M-24,-45 L24,-52 L25,-46 L-23,-39 Z" fill="'+C.plasticSh+'"/>');
S('<g stroke="'+C.plastic+'" stroke-width="6.5" fill="none" stroke-linecap="round">');
S('<path d="M-22,-34 L-32,-1"/><path d="M-6,-32 L-12,0"/><path d="M20,-42 L17,-2"/><path d="M30,-38 L41,-2"/>');
S('</g>');
S('<g stroke="'+C.plastic+'" stroke-width="5" fill="none" stroke-linecap="round"><path d="M-30,-63 L-16,-41"/><path d="M-32,-65 L-11,-65"/></g>');
S('</g>');

// cables
S('<g fill="none" stroke="'+C.dark+'" stroke-width="2.4" opacity="0.9">');
S('<path d="M700 232 q-96 44 -178 32 q-124 -14 -238 32"/>');
S('<path d="M700 220 q-104 54 -192 42 q-114 -12 -222 42" stroke-width="1.5" opacity="0.65"/>');
S('<path d="M1040 192 q-46 34 -76 44 q-30 10 -38 62"/>');
S('<path d="M672 -20 q34 122 14 262 q-8 74 -42 126"/>');
S('</g>');
// stains
S('<g filter="url(#b16)" opacity="0.07" fill="#6b6249">');
S('<ellipse cx="250" cy="640" rx="110" ry="200"/><ellipse cx="600" cy="330" rx="54" ry="130"/>');
S('<ellipse cx="1230" cy="1050" rx="200" ry="60"/><ellipse cx="1470" cy="820" rx="150" ry="60"/>');
S('</g>');
// a water bleed from the roof, running across the plinth joint
S('<path d="M176 -20 C168 180 196 360 182 520 C172 650 192 760 186 902 L216 902 C218 760 202 650 212 520 C224 360 198 180 206 -20 Z" fill="#5d5540" opacity="0.20" filter="url(#b6)"/>');
// a rust run from the dish bolt
S('<path d="M1044 196 C1040 250 1050 300 1046 356 L1058 358 C1060 302 1050 250 1054 198 Z" fill="#8A5236" opacity="0.42" filter="url(#b3)"/>');
S('<ellipse cx="1051" cy="360" rx="9" ry="6" fill="#8A5236" opacity="0.30" filter="url(#b3)"/>');
// salt bloom where the bleed ends, at the plinth
S('<g clip-path="url(#bld)">');
S('<path d="M150 812 q120 -12 230 4 q90 10 170 -2 l0 22 q-90 12 -180 0 q-120 -14 -220 -2 Z" fill="#FFFDF0" opacity="0.55" filter="url(#b6)"/>');
S('</g>');
S('<g filter="url(#b16)" opacity="0.11" fill="#fff8dc">');
S('<ellipse cx="310" cy="480" rx="120" ry="150"/><ellipse cx="880" cy="300" rx="90" ry="90"/>');
S('</g>');
S('<rect width="1600" height="1200" filter="url(#grain)" opacity="0.12"/>');
S('</svg>');
fs.writeFileSync(OUT,P.join('\n'),'utf8');
console.log('bytes',P.join('\n').length);
