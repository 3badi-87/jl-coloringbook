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

import json
CFG = json.load(open(os.path.join(D, 'book.json'))) if os.path.exists(os.path.join(D, 'book.json')) else {}

def bordered(a):
    """Cut the picture at Canva's frame (or where the drawing meets the edge)
    and draw a clean rounded border there, so lines that ran into the edge end
    on the border instead of hanging in mid-air."""
    dark = a < 150
    h, w = dark.shape
    def lines(axis, idx):
        return [i for i in idx if (dark[:, i] if axis else dark[i, :]).mean() > 0.55]
    L = lines(1, range(int(w * .1))); R = lines(1, range(int(w * .9), w))
    T = lines(0, range(int(h * .1))); B = lines(0, range(int(h * .9), h))
    ys, xs = np.nonzero(dark)
    x0 = min(L) if L else max(0, xs.min() - 12); x1 = max(R) + 1 if R else min(w, xs.max() + 13)
    y0 = min(T) if T else max(0, ys.min() - 12); y1 = max(B) + 1 if B else min(h, ys.max() + 13)
    a = a[y0:y1, x0:x1].copy()
    # pad to the shape of the printable picture area (7.6 x 9.83 in) so every page gets the same box
    h, w = a.shape
    target = 7.6 / 9.83
    if w / h < target:
        nw = int(round(h * target)); pad = nw - w
        a = np.pad(a, ((0, 0), (pad // 2, pad - pad // 2)), constant_values=255)
    else:
        nh = int(round(w / target)); pad = nh - h
        a = np.pad(a, ((pad // 2, pad - pad // 2), (0, 0)), constant_values=255)
    h, w = a.shape
    t, r = 11, 46                      # border thickness and corner radius (px)
    yy, xx = np.mgrid[0:h, 0:w]
    cx = np.clip(xx, r, w - 1 - r); cy = np.clip(yy, r, h - 1 - r)
    d = np.hypot(xx - cx, yy - cy)     # distance past the straight part of the rounded rect
    inside = (d <= r) & (xx >= 0)
    edge_dist = np.minimum.reduce([xx, yy, w - 1 - xx, h - 1 - yy]).astype(float)
    ring = np.where((xx > r) & (xx < w - 1 - r) | (yy > r) & (yy < h - 1 - r), edge_dist, r - d)
    a[~inside] = 255
    a[inside & (ring < t)] = 0
    return a

for f in sorted(glob.glob(os.path.join(SRC, '*.png'))):
    name = os.path.splitext(os.path.basename(f))[0]
    a = np.array(Image.open(f).convert('L'))
    if not CFG.get('border'):
        a = remove_frame(a)
    # hollow out big solid black/gray fills (they can't be colored): keep a thick outline
    from scipy import ndimage
    ink = a < 170
    solid = ndimage.binary_opening(ink, structure=np.ones((3, 3)), iterations=9)
    lab, n = ndimage.label(solid)
    if n:
        sizes = ndimage.sum(solid, lab, range(1, n + 1))
        solid = np.isin(lab, 1 + np.nonzero(sizes > 15000)[0])
    if solid.any():
        inner = ndimage.binary_erosion(solid, iterations=5)
        a = a.copy(); a[inner] = 255
        print('  hollowed', int(inner.sum()), 'px of solid fill')
    if CFG.get('border'):
        a = bordered(a)
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
