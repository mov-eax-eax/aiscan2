
import numpy as np, os, json
from PIL import Image
tmp = r"undefined\temp\dsrefs"
im = Image.open(os.path.join(tmp,"front.jpg")).convert("RGB")
a = np.asarray(im).astype(np.int16); lum=a.mean(axis=2)
res={}
def gradline(vals, idx):
    g = np.abs(np.diff(vals.astype(float)))
    top = np.argsort(g)[-6:][::-1]
    return [[int(idx[i]), round(float(g[i]),1)] for i in top]
# left edge at y=400 (x 1180..1380)
res["left_y400"] = gradline(lum[400,1180:1380], np.arange(1180,1380))
res["right_y400"] = gradline(lum[400,2580:2820], np.arange(2580,2820))
res["top_x2000"] = gradline(lum[120:280,2000], np.arange(120,280))
res["bottom_x2000"] = gradline(lum[700:920,2000], np.arange(700,920))
res["left_y600"] = gradline(lum[600,1180:1400], np.arange(1180,1400))
res["right_y600"] = gradline(lum[600,2560:2820], np.arange(2560,2820))
res["top_x1600"] = gradline(lum[120:280,1600], np.arange(120,280))
res["top_x2400"] = gradline(lum[120:280,2400], np.arange(120,280))
# print raw samples across left edge
res["sample_left_y400"] = [[int(x), round(float(lum[400,x]),0)] for x in range(1240,1340,5)]
res["sample_bottom_x2000"] = [[int(y), round(float(lum[y,2000]),0)] for y in range(720,850,5)]
open(os.path.join(tmp,"out5.json"),"w").write(json.dumps(res,indent=0))
