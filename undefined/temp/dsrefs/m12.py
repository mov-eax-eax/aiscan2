
import numpy as np, os, json
from PIL import Image
from collections import deque
from numpy.lib.stride_tricks import sliding_window_view
tmp = r"undefined\temp\dsrefs"
g = np.asarray(Image.open(os.path.join(tmp,"front.jpg")).convert("L")).astype(np.float64)
k=7
std = np.pad(sliding_window_view(g,(k,k)).std(axis=(2,3)),((3,3),(3,3)),mode="edge")
def comps_mask(m, minarea=3000):
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
    out.sort(key=lambda d:-d["area"]); return out[:3]
res={}
tex = std>16
for name,(x0,y0,x1,y1) in {"L":(1100,780,1900,1450),"R":(2150,780,2950,1450)}.items():
    comps = comps_mask(tex[y0:y1,x0:x1],3000)
    for c in comps:
        c["bbox"] = [c["bbox"][0]+x0, c["bbox"][1]+x0, c["bbox"][2]+y0, c["bbox"][3]+y0]
        c["cx"] += x0; c["cy"] += y0
    res[name]=comps
open(os.path.join(tmp,"out10.json"),"w").write(json.dumps(res,indent=1))
