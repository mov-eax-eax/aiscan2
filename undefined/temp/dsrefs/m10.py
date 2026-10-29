
import numpy as np, os, json, math
from PIL import Image
from collections import deque
tmp = r"undefined\temp\dsrefs"
im = Image.open(os.path.join(tmp,"front.jpg")).convert("RGB")
a = np.asarray(im).astype(np.int16); lum=a.mean(axis=2)
sat = a.max(axis=2)-a.min(axis=2)
white = (lum>225)&(sat<40)
def comps(roi, minarea=120, maxarea=200000):
    x0,y0,x1,y1 = roi
    m = white[y0:y1, x0:x1]; h,w=m.shape
    seen=np.zeros_like(m,bool); out=[]
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
                if minarea<=len(pts)<=maxarea:
                    ys=np.array([p[0] for p in pts])+y0; xs=np.array([p[1] for p in pts])+x0
                    out.append(dict(area=int(len(pts)), cx=round(float(xs.mean()),1), cy=round(float(ys.mean()),1),
                                    bbox=[int(xs.min()),int(xs.max()),int(ys.min()),int(ys.max())], wh=[int(xs.max()-xs.min()+1),int(ys.max()-ys.min()+1)]))
    out.sort(key=lambda d:-d["area"])
    return out
res={}
res["dpad"] = comps((550,200,1250,1050), 300)[:6]
res["face"] = comps((2650,150,3450,980), 500)[:6]
res["create"] = comps((1150,90,1450,330), 100)[:4]
res["options"] = comps((2700,90,3050,340), 100)[:4]
res["ps_mute"] = comps((1400,900,2100,1600), 100)[:6]
open(os.path.join(tmp,"out8.json"),"w").write(json.dumps(res,indent=1))
