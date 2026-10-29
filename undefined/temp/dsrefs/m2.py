
import os, json
from PIL import Image, ImageDraw
tmp = r"undefined\temp\dsrefs"
im = Image.open(os.path.join(tmp,"front.jpg")).convert("RGB")
crops = {
 "A_touchpad": (1200, 80, 2800, 820),
 "B_left":     (300, 150, 1500, 1250),
 "C_right":    (2400, 150, 3720, 1250),
 "D_center":   (1400, 700, 2400, 1700),
}
for name, box in crops.items():
    c = im.crop(box).copy()
    d = ImageDraw.Draw(c)
    x0,y0,x1,y1 = box
    for x in range(x0 - x0%50, x1, 50):
        if x < x0: continue
        col = (255,0,0) if x%200==0 else (255,150,150)
        d.line([(x-x0,0),(x-x0,c.size[1])], fill=col, width=2 if x%200==0 else 1)
        if x%200==0: d.text((x-x0+3, 4), str(x), fill=(255,0,0))
    for y in range(y0 - y0%50, y1, 50):
        if y < y0: continue
        col = (0,90,255) if y%200==0 else (150,190,255)
        d.line([(0,y-y0),(c.size[0],y-y0)], fill=col, width=2 if y%200==0 else 1)
        if y%200==0: d.text((4, y-y0+3), str(y), fill=(0,90,255))
    c.save(os.path.join(tmp, name+".png"))
    print(name, c.size)
