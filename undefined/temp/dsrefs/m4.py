
import numpy as np, os, json
from PIL import Image
tmp = r"undefined\temp\dsrefs"
im = Image.open(os.path.join(tmp,"front.jpg")).convert("RGB")
a = np.asarray(im).astype(np.int16)
pts = {
 "touchpad_center": (2000, 450),
 "shell_left": (800, 1500),
 "shell_right": (3200, 1500),
 "lightbar_left": (1248, 400),
 "lightbar_bottom": (2000, 780),
 "button_triangle_center": (3050, 300),
 "cap_left_ring": (1398, 1000),
}
res = {k: [int(x) for x in a[y, x]] for k,(x,y) in pts.items()}
# grey plate component: grey-ish (low sat) mid luminance
r,g,b = a[:,:,0],a[:,:,1],a[:,:,2]
gray = (abs(r-g)<18)&(abs(g-b)<18)&(lum:=a.mean(axis=2)).__gt__(75)&(lum<185)
# limit to top area of body between x 1200..2800 and y 150..900
mask = np.zeros_like(gray); mask[150:900,1150:2850] = True
sel = gray & mask
ys,xs = np.where(sel)
res["touchpad_bbox"] = [int(xs.min()),int(xs.max()),int(ys.min()),int(ys.max())]
res["touchpad_wpx"] = int(xs.max()-xs.min()+1); res["touchpad_hpx"] = int(ys.max()-ys.min()+1)
# blue-ish light bar
blue = (b>120)&(b-r>40)&(b-g>20)
ys,xs = np.where(blue)
res["blue_count"]=int(blue.sum())
if blue.sum():
    res["blue_bbox"]=[int(xs.min()),int(xs.max()),int(ys.min()),int(ys.max())]
    # split columns to find left/right strips extents
open(os.path.join(tmp,"out3.json"),"w").write(json.dumps(res,indent=1))
