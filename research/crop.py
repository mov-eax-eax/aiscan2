
from PIL import Image
im = Image.open('continual-learning-china-2025-26.png')
im.crop((0,2700,1800,4150)).save('research/qc_radar.png')
print(im.size)
