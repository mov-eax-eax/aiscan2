
import numpy as np, os, json, math
from PIL import Image
from collections import deque
tmp = r"undefined\temp\dsrefs"
im = Image.open(os.path.join(tmp,"front.jpg")).convert("L")
g = np.asarray(im).astype(np.float64)
# local std via box filter
k=7
from numpy.lib.stride_tricks import sliding_window_view
sw = sliding_window_view(g, (k,k))
std = sw.std(axis=(2,3))
std = np.pad(std, ((k//2,k//2),(k//2,k//2)), mode="edge")
def comps_mask(m, minarea=1000):
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
                                    bbox=[int(xs.min()),int(xs.max()),int(ys.min()),int(ys.max())], wh=[int(xs.max()-xs.min()+1),int(ys.max()-ys.min()+1)]))
    out.sort(key=lambda d:-d["area"]); return out[:5]
res={}
tex = std>16
res["left_stick"] = comps_mask(tex[850:1250,1250:1700], 3000)
res["right_stick"] = comps_mask(tex[850:1250,2300:2750], 3000)
open(os.path.join(tmp,"out9.json"),"w").write(json.dumps(res,indent=1))
