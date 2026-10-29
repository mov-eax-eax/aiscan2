
import numpy as np, os, json, sys
from PIL import Image, ImageDraw
tmp = r"undefined\temp\dsrefs"
res = {}
im = Image.open(os.path.join(tmp,"front.jpg")).convert("RGB")
a = np.asarray(im).astype(np.int16)
res["size"] = im.size
lum = a.mean(axis=2); sat = a.max(axis=2)-a.min(axis=2)
fg = (lum < 235) | (sat > 25)
ys, xs = np.where(fg)
res["bbox"] = [int(xs.min()), int(xs.max()), int(ys.min()), int(ys.max())]
res["wh"] = [int(xs.max()-xs.min()+1), int(ys.max()-ys.min()+1)]
g = im.copy(); d = ImageDraw.Draw(g)
for x in range(0, im.size[0], 100):
    d.line([(x,0),(x,im.size[1])], fill=(255,0,0), width=3)
    d.text((x+4, 6), str(x), fill=(255,0,0))
for y in range(0, im.size[1], 100):
    d.line([(0,y),(im.size[0],y)], fill=(0,120,255), width=3)
    d.text((4, y+3), str(y), fill=(0,120,255))
g.save(os.path.join(tmp,"front_grid.png"))
open(os.path.join(tmp,"out1.json"),"w").write(json.dumps(res))
