# Turns the Canva bitmaps in kdp/art-src/ into frameless vector line art in kdp/art/.
# Usage: python3 kdp/tools/trace.py   (needs Pillow, numpy and potrace)
# The Canva pages come with a thin rectangle drawn around the picture; any
# straight line running along most of an edge (in the outer 10%) is erased.
import glob, os, subprocess
import numpy as np
from PIL import Image, ImageFilter

D = os.path.abspath(os.environ.get('BOOK') or os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SRC, OUT = os.path.join(D, 'art-src'), os.path.join(D, 'art')

def remove_frame(a):
    dark = a < 150
    h, w = dark.shape
    m = 0.10
    for x in list(range(int(w * m))) + list(range(int(w * (1 - m)), w)):
        if dark[:, x].mean() > 0.55: a[:, max(0, x - 2):x + 3] = 255
    for y in list(range(int(h * m))) + list(range(int(h * (1 - m)), h)):
        if dark[y, :].mean() > 0.55: a[max(0, y - 2):y + 3, :] = 255
    return a

for f in sorted(glob.glob(os.path.join(SRC, '*.png'))):
    name = os.path.splitext(os.path.basename(f))[0]
    a = remove_frame(np.array(Image.open(f).convert('L')))
    # trim the empty white margin around the drawing so it can fill the page
    ys, xs = np.nonzero(a < 150)
    pad = 6
    a = a[max(0, ys.min() - pad):ys.max() + pad + 1, max(0, xs.min() - pad):xs.max() + pad + 1]
    im = Image.fromarray(a)
    big = im.resize((im.width * 2, im.height * 2), Image.LANCZOS).filter(ImageFilter.GaussianBlur(1.2))
    pbm = os.path.join('/tmp', name + '.pbm')
    big.point(lambda v: 0 if v < 150 else 255, '1').save(pbm)
    subprocess.run(['potrace', '-s', '-t', '6', '-a', '1.0', '-O', '0.4', '-o', os.path.join(OUT, name + '.svg'), pbm], check=True)
    print('traced', name)
