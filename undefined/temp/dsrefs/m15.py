
import os
from PIL import Image, ImageDraw
tmp = r"undefined\temp\dsrefs"
im = Image.open(os.path.join(tmp,"rear.jpg")).convert("RGB")
print(im.size)
# label area guess: center of rear image
box=(700,600,1700,1050)
c=im.crop(box).copy()
c=c.resize((c.size[0]*3,c.size[1]*3), Image.LANCZOS)
c.save(os.path.join(tmp,"H_label.png"))
# reset pinhole area near SONY logo (center bottom)
box2=(1100,900,1450,1150)
c2=im.crop(box2).resize(((box2[2]-box2[0])*4,(box2[3]-box2[1])*4), Image.LANCZOS)
c2.save(os.path.join(tmp,"I_reset.png"))
