
import os
from PIL import Image, ImageDraw
tmp = r"undefined\temp\dsrefs"
im = Image.open(os.path.join(tmp,"front.jpg")).convert("RGB")
crops = {
 "E_leftstick": (1250, 850, 1650, 1250),
 "F_rightstick": (2350, 850, 2750, 1250),
}
for name, box in crops.items():
    c = im.crop(box).copy(); d = ImageDraw.Draw(c)
    x0,y0,x1,y1 = box
    for x in range(x0 - x0%25, x1, 25):
        if x < x0: continue
        major = x%100==0
        d.line([(x-x0,0),(x-x0,c.size[1])], fill=(255,0,0) if major else (255,170,170), width=2 if major else 1)
        if major: d.text((x-x0+2, 2), str(x), fill=(255,0,0))
    for y in range(y0 - y0%25, y1, 25):
        if y < y0: continue
        major = y%100==0
        d.line([(0,y-y0),(c.size[0],y-y0)], fill=(0,90,255) if major else (170,200,255), width=2 if major else 1)
        if major: d.text((2, y-y0+2), str(y), fill=(0,90,255))
    c = c.resize((c.size[0]*2, c.size[1]*2), Image.LANCZOS)
    c.save(os.path.join(tmp, name+".png"))
