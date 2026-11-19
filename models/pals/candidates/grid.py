import sys
from PIL import Image
out, cols, *S = sys.argv[1:]; cols = int(cols); ims = [Image.open(s) for s in S]; w, h = ims[0].size; rows = (len(ims) + cols - 1) // cols
o = Image.new('RGB', (w * cols, h * rows), 'white')
for i, im in enumerate(ims): o.paste(im, ((i % cols) * w, (i // cols) * h))
o.save(out)
