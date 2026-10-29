
import numpy as np, os, json
from PIL import Image
tmp = r"undefined\temp\dsrefs"
im = Image.open(os.path.join(tmp,"front.jpg")).convert("RGB")
a = np.asarray(im).astype(np.int16)
lum = a.mean(axis=2)
res = {}
def runs(vals, idx, th, above=True):
    m = vals > th if above else vals < th
    out=[]; start=None
    for i,v in enumerate(m):
        if v and start is None: start=i
        if not v and start is not None:
            out.append((int(idx[start]),int(idx[i-1]))); start=None
    if start is not None: out.append((int(idx[start]),int(idx[-1])))
    return out
# column scans
for x in (1600, 2000, 2400):
    col = lum[:, x]
    idx = np.arange(col.size)
    r = runs(col[130:950], idx[130:950], 70)
    res[f"col{x}"] = r
# row scans
for y in (250, 450, 650, 780):
    row = lum[y, :]
    idx = np.arange(row.size)
    r = runs(row[1000:3000], idx[1000:3000], 70)
    res[f"row{y}"] = r
open(os.path.join(tmp,"out4.json"),"w").write(json.dumps(res,indent=0))
