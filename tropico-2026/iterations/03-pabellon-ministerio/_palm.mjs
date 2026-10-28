
import fs from 'node:fs';
const f=n=>Math.round(n*10)/10;
function bez(p0,p1,p2,p3,t){const mt=1-t;
  return [mt*mt*mt*p0[0]+3*mt*mt*t*p1[0]+3*mt*t*t*p2[0]+t*t*t*p3[0],
          mt*mt*mt*p0[1]+3*mt*mt*t*p1[1]+3*mt*t*t*p2[1]+t*t*t*p3[1]];}
function frond(bx,by,ang,len,bend,maxW,nb){
  const a=ang*Math.PI/180,b=(ang+bend)*Math.PI/180;
  const p0=[bx,by];
  const p1=[bx+Math.cos(a)*len*0.30, by+Math.sin(a)*len*0.30];
  const p3=[bx+Math.cos(b)*len, by+Math.sin(b)*len];
  const p2=[p3[0]-Math.cos(b)*len*0.38, p3[1]-Math.sin(b)*len*0.38];
  const N=nb*2,pts=[];
  for(let i=0;i<=N;i++)pts.push(bez(p0,p1,p2,p3,i/N));
  const prof=t=>{
    let base=maxW*(0.30+0.70*Math.sin(Math.PI*Math.pow(t,0.78)))*(1-0.45*t);
    if(t<0.05)base*=0.35+0.65*(t/0.05);
    return base;};
  let d='';
  const side=(i,dir)=>{
    const p=pts[i],q=pts[Math.min(N,i+1)];
    let ux=q[0]-p[0],uy=q[1]-p[1];const ul=Math.hypot(ux,uy)||1;ux/=ul;uy/=ul;
    let w=prof(i/N); if(i%2===1)w*=0.55;
    return [p[0]-uy*dir*w,p[1]+ux*dir*w];};
  for(let i=0;i<=N;i++){const s=side(i,1);d+=(i?'L':'M')+f(s[0])+' '+f(s[1]);}
  for(let i=N;i>=0;i--){const s=side(i,-1);d+='L'+f(s[0])+' '+f(s[1]);}
  return d+'Z';
}
function crown(cx,cy,sc,fill,seed=1){
  const base=[[-98,1.00,-58],[-76,1.06,-62],[-56,1.04,-64],[-36,0.97,-58],[-16,1.00,-44],
    [4,0.98,-24],[24,0.95,-2],[46,0.92,22],[70,0.86,48],[96,0.76,70],
    [-122,0.90,-40],[-148,0.84,-14],[-174,0.74,16],[156,0.62,50],[132,0.66,60]];
  const w=[24,25,25,24,23,22,23,24,25,24,23,22,20,18,18];
  let d='';
  for(let i=0;i<base.length;i++){
    const [a,l,bend]=base[i];
    d+=frond(cx,cy,a+((i*11+seed*5)%5-2)*1.5, 210*l*sc+((i*7+seed)%3-1)*14*sc, bend, w[i]*sc, 30);
  }
  // dead skirt
  for(const [a,l] of [[-160,0.5],[-140,0.45],[178,0.42],[118,0.4],[88,0.36]])
    d+=frond(cx,cy,a,110*l*sc,-34,9*sc,26);
  return '<path d="'+d+'" fill="'+fill+'"/>';
}
function trunk(x0,y0,x1,y1,cx,cy,w0,w1,fill){
  const pts=[];
  for(let i=0;i<=24;i++){
    const t=i/24,mt=1-t;
    const x=mt*mt*x0+2*mt*t*cx+t*t*x1,y=mt*mt*y0+2*mt*t*cy+t*t*y1;
    const dx=2*mt*(cx-x0)+2*t*(x1-cx),dy=2*mt*(cy-y0)+2*t*(y1-cy);
    const l=Math.hypot(dx,dy)||1,nx=-dy/l,ny=dx/l;
    let w=w1+(w0-w1)*Math.pow(1-t,0.8);
    if(t>0.93)w*=(1-t)/0.07*0.5+0.32;
    pts.push([x+nx*w/2,y+ny*w/2,x-nx*w/2,y-ny*w/2]);}
  let d='M'+f(pts[0][0])+' '+f(pts[0][1]);
  for(const p of pts)d+='L'+f(p[0])+' '+f(p[1]);
  for(let i=pts.length-1;i>=0;i--)d+='L'+f(pts[i][2])+' '+f(pts[i][3]);
  return '<path d="'+d+'Z" fill="'+fill+'"/>';
}
function palm(x0,y0,cx,cy,x1,y1,w0,w1,sc,fill,seed){
  return trunk(x0,y0,x1,y1,cx,cy,w0,w1,fill)
    +'<ellipse cx="'+x1+'" cy="'+y1+'" rx="'+(10*sc)+'" ry="'+(14*sc)+'" fill="'+fill+'"/>'
    +crown(x1,y1,sc,fill,seed);
}
const S=[];
S.push('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 1200" width="1600" height="1200">');
S.push('<rect width="1600" height="1200" fill="#9aa390"/>');
S.push(palm(1470,1200,1452,970,1330,700,30,14,1.0,'#122318',1));
S.push(palm(830,1180,842,1050,782,900,18,9,0.55,'#122318',2));
S.push(palm(300,1200,318,940,252,620,40,18,1.25,'#122318',3));
S.push('</svg>');
fs.writeFileSync('F:/repo-aiscan2/tropico-2026/iterations/03-pabellon-ministerio/_palmstudy.svg',S.join('\n'),'utf8');
console.log('ok');
