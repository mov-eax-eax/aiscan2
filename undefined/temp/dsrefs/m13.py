
import numpy as np, os, json
from PIL import Image
from collections import deque
tmp = r"undefined\temp\dsrefs"
a = np.asarray(Image.open(os.path.join(tmp,"front.jpg")).convert("RGB")).astype(np.int16)
r,g,b = a[:,:,0],a[:,:,1],a[:,:,2]
lum = a.mean(axis=2)
blue = (b>140)&(b-r>55)&(b-g>25)
def comps(m, minarea=200, maxn=6):
    h,w=m.shape; seen=np.zeros_like(m,bool); out=[]
    for yy in range(h):
        for xx in range(w):
            if m[yy,xx] and not seen[yy,xx]:
                q=deque([(yy,xx)]); seen[yy,xx]=True; pts=[]
                while q:
                    cy,cx=q.popleft(); pts.append((cy,cx))
                    for dy in(-1,0,1):
                        for dx in(-1,0,1):
                            ny,nx=cy+dy,cx+dx
                            if 0<=ny<h and 0<=nx<w and m[ny,nx] and not seen[ny,nx]:
                                seen[ny,nx]=True; q.append((ny,nx))
                if len(pts)>=minarea:
                    ys=np.array([p[0] for p in pts]); xs=np.array([p[1] for p in pts])
                    out.append(dict(area=int(len(pts)), cx=round(float(xs.mean()),1), cy=round(float(ys.mean()),1),
                                    bbox=[int(xs.min()),int(xs.max()),int(ys.min()),int(ys.max())],
                                    wh=[int(xs.max()-xs.min()+1),int(ys.max()-ys.min()+1)]))
    out.sort(key=lambda d:-d["area"]); return out[:maxn]
res={}
res["blue_all"] = comps(blue, 500, 6)
# speaker holes: dark circles in ROI
roi=(1750,820,2300,1050)
x0,y0,x1,y1=roi
dark = lum[y0:y1,x0:x1] < 60
res["speaker"] = comps(dark, 200, 12)
for c in res["speaker"]:
    c["bbox"]=[c["bbox"][0]+x0,c["bbox"][1]+x0,c["bbox"][2]+y0,c["bbox"][3]+y0]
    c["cx"]+=x0; c["cy"]+=y0
# player LED strip: bright-ish or dark thin line below touchpad; sample rows
res["row_prof"] = [[int(y), round(float(lum[y,2000]),0)] for y in range(800,900,4)]
open(os.path.join(tmp,"out11.json"),"w").write(json.dumps(res,indent=1))
