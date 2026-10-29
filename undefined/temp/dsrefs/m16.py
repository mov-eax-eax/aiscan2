
import os
from PIL import Image
tmp = r"undefined\temp\dsrefs"
im = Image.open(os.path.join(tmp,"rear.jpg")).convert("RGB")
w,h = im.size
box=(int(w*0.30), int(h*0.36), int(w*0.72), int(h*0.52))
c=im.crop(box)
c=c.resize((c.size[0]*4,c.size[1]*4), Image.LANCZOS)
c.save(os.path.join(tmp,"H_label.png"))
print("size", w, h, "box", box, "out", c.size)
