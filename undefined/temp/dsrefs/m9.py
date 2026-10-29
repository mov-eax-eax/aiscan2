
import numpy as np, os, json, math
from PIL import Image
from collections import deque
tmp = r"undefined\temp\dsrefs"
im = Image.open(os.path.join(tmp,"front.jpg")).convert("RGB")
a = np.asarray(im).astype(np.int16); lum=a.mean(axis=2)
def largest_dark(roi, th=30):
    x0,y0,x1,y1 = roi
    m = lum[y0:y1, x0:x1] < th
    h,w=m.shape; seen=np.zeros_like(m,bool); best=None
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
                if best is None or len(pts)>len(best): best=pts
    ys=np.array([p[0] for p in best])+y0; xs=np.array([p[1] for p in best])+x0
    return dict(cx=float(xs.mean()), cy=float(ys.mean()), bbox=[int(xs.min()),int(xs.max()),int(ys.min()),int(ys.max())], area=int(len(xs)))
def radial_to_dark(cx, cy, rstart=30, rend=200, th=35):
    rs=[]
    for deg in range(0,360,5):
        t=math.radians(deg)
        for r in range(rstart, rend):
            x=int(cx+r*math.cos(t)); y=int(cy+r*math.sin(t))
            if lum[y,x] < th:
                rs.append(r); break
    rs=np.array(rs)
    return dict(mean_r=float(rs.mean()), median_r=float(np.median(rs)), std=float(rs.std()), n=int(rs.size))
res={}
for name, roi in {"left":(1250,850,1650,1250), "right":(2350,850,2800,1250)}.items():
    d = largest_dark(roi, 32)
    d["radial"] = radial_to_dark(d["cx"], d["cy"], 60, 220, 30)
    res["well_"+name]=d
open(os.path.join(tmp,"out7.json"),"w").write(json.dumps(res,indent=1))
