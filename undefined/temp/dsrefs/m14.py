
import numpy as np, os, json, math
from PIL import Image, ImageDraw
tmp = r"undefined\temp\dsrefs"
im = Image.open(os.path.join(tmp,"front.jpg")).convert("RGB")
a = np.asarray(im).astype(np.int16); lum=a.mean(axis=2)
def radial(cx, cy, rstart=10, rend=200, th=32):
    rs=[]
    for deg in range(0,360,5):
        t=math.radians(deg)
        for r in range(rstart, rend):
            x=int(cx+r*math.cos(t)); y=int(cy+r*math.sin(t))
            if lum[y,x] < th:
                rs.append(r); break
    rs=np.array(rs); return dict(mean=float(rs.mean()), median=float(np.median(rs)), std=round(float(rs.std()),1), n=int(rs.size))
res={}
for name,(cx,cy) in {"tri":(3076,423),"sq":(2823,672),"cir":(3336,679),"cross":(3085,928)}.items():
    res[name]=radial(cx,cy,20,180,32)
# crop PS/mute region 2x with 25 grid
box=(1700,980,2400,1520)
c=im.crop(box).copy(); d=ImageDraw.Draw(c)
x0,y0,x1,y1=box
for x in range(x0-x0%25,x1,25):
    if x<x0: continue
    major=x%100==0
    d.line([(x-x0,0),(x-x0,c.size[1])], fill=(255,0,0) if major else (255,180,180), width=2 if major else 1)
    if major: d.text((x-x0+1,1), str(x), fill=(255,0,0))
for y in range(y0-y0%25,y1,25):
    if y<y0: continue
    major=y%100==0
    d.line([(0,y-y0),(c.size[0],y-y0)], fill=(0,90,255) if major else (180,205,255), width=2 if major else 1)
    if major: d.text((1,y-y0+1), str(y), fill=(0,90,255))
c=c.resize((c.size[0]*2,c.size[1]*2), Image.LANCZOS)
c.save(os.path.join(tmp,"G_psmute.png"))
open(os.path.join(tmp,"out12.json"),"w").write(json.dumps(res,indent=1))
