
import numpy as np, os, json
from PIL import Image
tmp = r"undefined\temp\dsrefs"
im = Image.open(os.path.join(tmp,"front.jpg")).convert("RGB")
a = np.asarray(im).astype(np.int16)
lum = a.mean(axis=2)
res = {}
for th in (120,150,170,190,210):
    fg = lum < th
    ys, xs = np.where(fg)
    res[str(th)] = dict(bbox=[int(xs.min()),int(xs.max()),int(ys.min()),int(ys.max())],
                        w=int(xs.max()-xs.min()+1), h=int(ys.max()-ys.min()+1), ratio=round(float((ys.max()-ys.min()+1)/(xs.max()-xs.min()+1)),4))
# row widths for th=170
fg = lum < 170
rows = []
for y in range(fg.shape[0]):
    xs = np.where(fg[y])[0]
    if xs.size: rows.append((y,int(xs.min()),int(xs.max()),int(xs.size)))
res["maxwidth_row"] = max(rows, key=lambda r: r[2]-r[1])
res["top_rows"] = rows[:3]
res["bottom_rows"] = rows[-3:]
res["rowW_at"] = {str(y): [mn,mx] for (y,mn,mx,n) in rows if y in (300,600,900,1200,1500,1800,2100,2400,2500)}
open(os.path.join(tmp,"out2.json"),"w").write(json.dumps(res,indent=1))
