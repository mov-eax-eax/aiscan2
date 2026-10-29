import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
const CHROME='C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe';
const b64 = fs.readFileSync('F:/repotest2/refs/dimensions_render.png').toString('base64');
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args:['--no-sandbox'] });
const page = await browser.newPage();
await page.goto('about:blank');
const out = await page.evaluate(async (dataUrl) => {
  const img = new Image(); img.src = dataUrl; await img.decode();
  const W = img.naturalWidth, H = img.naturalHeight;
  const cv = document.createElement('canvas'); cv.width=W; cv.height=H;
  const cx = cv.getContext('2d', { willReadFrequently:true });
  cx.drawImage(img,0,0);
  const d = cx.getImageData(0,0,W,H).data;
  const mask = new Uint8Array(W*H);
  for (let i=0,p=0;i<d.length;i+=4,p++){
    const r=d[i],g=d[i+1],b=d[i+2];
    const brownish = (r>g && g>=b && (r-g)<70 && (r-b)>18 && r<235);
    if (brownish) mask[p]=1;
  }
  const comp = new Int32Array(W*H).fill(-1);
  const stack = new Int32Array(W*H);
  let best=-1, bestArea=0, bestBox=null, id=0;
  for (let p0=0;p0<W*H;p0++){
    if (!mask[p0] || comp[p0]!==-1) continue;
    let sp=0; stack[sp++]=p0; comp[p0]=id;
    let area=0, minx=W,maxx=0,miny=H,maxy=0;
    while(sp>0){
      const p=stack[--sp]; area++;
      const y=(p/W)|0, x=p-y*W;
      if(x<minx)minx=x; if(x>maxx)maxx=x; if(y<miny)miny=y; if(y>maxy)maxy=y;
      if(x>0   && mask[p-1] && comp[p-1]===-1){comp[p-1]=id; stack[sp++]=p-1;}
      if(x<W-1 && mask[p+1] && comp[p+1]===-1){comp[p+1]=id; stack[sp++]=p+1;}
      if(y>0   && mask[p-W] && comp[p-W]===-1){comp[p-W]=id; stack[sp++]=p-W;}
      if(y<H-1 && mask[p+W] && comp[p+W]===-1){comp[p+W]=id; stack[sp++]=p+W;}
    }
    if (area>bestArea){ bestArea=area; best=id; bestBox={minx,maxx,miny,maxy}; }
    id++;
  }
  const rows=[];
  for (let y=0;y<H;y++){
    let mn=-1,mx=-1; const runs=[]; let inRun=false,start=0;
    for (let x=0;x<W;x++){
      const t = comp[y*W+x]===best;
      if (t && !inRun){inRun=true;start=x;}
      else if(!t && inRun){inRun=false;runs.push([start,x-1]);}
      if(t){ if(mn<0)mn=x; mx=x; }
    }
    if(inRun) runs.push([start,W-1]);
    rows.push({y,mn,mx,runs});
  }
  return {W,H,bestArea,bestBox,rows};
}, 'data:image/png;base64,'+b64);

const {W,H,bestBox,rows,bestArea}=out;
console.log('area',bestArea,'bbox',JSON.stringify(bestBox));
const ground=bestBox.maxy, top=bestBox.miny;
// widest row
let maxW=0,maxRow=-1;
for(const r of rows){ if(r.mn>=0){const w=r.mx-r.mn+1; if(w>maxW){maxW=w;maxRow=r.y;}} }
console.log('ground',ground,'top',top,'pxH',ground-top,'maxWpx',maxW,'at',maxRow);
const sH = 330/(ground-top);
const sW = 124.90/maxW;
console.log('m/px  H:',sH.toFixed(5),'  W:',sW.toFixed(5),'  ratio', (sH/sW).toFixed(3));
const cx=(bestBox.minx+bestBox.maxx)/2;
console.log('centerX',cx);
const pick=(h)=>{ let bestr=null; for(const r of rows){ if(r.mn<0) continue; const hh=(ground-r.y)*sH; if(!bestr||Math.abs(hh-h)<Math.abs(bestr.h-h)) bestr={h:hh,r}; } return bestr; };
const fmt=(h)=>{ const b=pick(h); const r=b.r; const outer=Math.max(Math.abs(r.mn-cx),Math.abs(r.mx-cx))*sW;
  const segs=r.runs.filter(s=>s[1]-s[0]>3).map(s=>[(+(((s[0]-cx)*sW).toFixed(2))),(+(((s[1]-cx)*sW).toFixed(2)))]);
  return 'h='+h.toFixed(1).padStart(6)+' (px row '+r.y+')  half='+outer.toFixed(2).padStart(6)+'  segs='+JSON.stringify(segs); };
for(const h of [0,1,2,3,5,8,12,20,30,39,45,50,55,57.6,60,70,80,90,100,110,115.7,120,140,160,180,200,220,240,260,276.1,280,285,290,295,300,305,310,315,320,324,328,330]) console.log(fmt(h));
// save profile every row
const prof=[];
for(let y=top;y<=ground;y++){ const r=rows[y]; if(!r||r.mn<0) continue;
  prof.push([+((ground-y)*sH).toFixed(2), +(((r.mn-cx)*sW)).toFixed(2), +(((r.mx-cx)*sW)).toFixed(2),
    r.runs.filter(s=>s[1]-s[0]>3).map(s=>[+((s[0]-cx)*sW).toFixed(2),+((s[1]-cx)*sW).toFixed(2)])]);
}
fs.writeFileSync('F:/repotest2/refs/_profile.json', JSON.stringify({sW,sH,cx,ground,top,prof}));
console.log('saved rows',prof.length);
await browser.close();
