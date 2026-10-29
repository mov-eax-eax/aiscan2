
import numpy as np, os, json
from PIL import Image
from collections import deque
tmp = r"undefined\temp\dsrefs"
im = Image.open(os.path.join(tmp,"front.jpg")).convert("RGB")
a = np.asarray(im).astype(np.int16); lum=a.mean(axis=2)
sat = a.max(axis=2)-a.min(axis=2)
mask = (lum>105)&(lum<240)&(sat<40)
def comps(roi, minarea=300):
    x0,y0,x1,y1 = roi
    m = mask[y0:y1, x0:x1]
    h,w = m.shape
    seen = np.zeros_like(m, dtype=bool)
    out=[]
    for yy in range(h):
        for xx in range(w):
            if m[yy,xx] and not seen[yy,xx]:
                q=deque([(yy,xx)]); seen[yy,xx]=True
                pts=[]
                while q:
                    cy,cx=q.popleft(); pts.append((cy,cx))
                    for dy in (-1,0,1):
                        for dx in (-1,0,1):
                            ny,nx=cy+dy,cx+dx
                            if 0<=ny<h and 0<=nx<w and m[ny,nx] and not seen[ny,nx]:
                                seen[ny,nx]=True; q.append((ny,nx))
                if len(pts)>=minarea:
                    ys=[p[0] for p in pts]; xs=[p[1] for p in pts]
                    out.append(dict(area=len(pts), bbox=[x0+min(xs),x0+max(xs),y0+min(ys),y0+max(ys)],
                                    wh=[max(xs)-min(xs)+1, max(ys)-min(ys)+1]))
    out.sort(key=lambda d:-d["area"])
    return out[:8]
res={}
res["face"] = comps((2650,150,3450,980))
res["dpad"] = comps((600,180,1200,1050))
res["pill"] = comps((1100,80,1450,320), 150)
res["pill2"] = comps((2700,80,3000,340), 150)
open(os.path.join(tmp,"out6.json"),"w").write(json.dumps(res,indent=1))
