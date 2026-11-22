# Combines cover + interior into one PDF for reading/sharing:
# front cover, interior pages, back cover (all 8.5 x 11 in).
# Usage: python3 kdp/build-combined.py   (after building interior and cover)
import copy, os
from pypdf import PdfReader, PdfWriter
from pypdf.generic import RectangleObject

import json
D = os.path.abspath(os.environ.get('BOOK') or os.path.dirname(os.path.abspath(__file__)))
CFG = json.load(open(os.path.join(D, 'book.json')))
cover = PdfReader(os.path.join(D, f"{CFG['slug']}-cover.pdf")).pages[0]
interior = PdfReader(os.path.join(D, f"{CFG['slug']}-interior.pdf"))

pt = 72
bleed, tw, th = 0.125 * pt, 8.5 * pt, 11 * pt
W = float(cover.mediabox.width)

def crop(x0):
    p = copy.copy(cover)
    box = RectangleObject([x0, bleed, x0 + tw, bleed + th])
    p.mediabox = box; p.cropbox = box; p.trimbox = box
    return p

out = PdfWriter()
out.add_page(crop(W - bleed - tw))   # front cover
for p in interior.pages:
    out.add_page(p)
out.add_page(crop(bleed))            # back cover
out.add_metadata({'/Title': f"{CFG['title']}: {CFG['subtitle']}", '/Author': 'RoxoSky Books Co.'})
path = os.path.join(D, f"{CFG['slug']}-complete.pdf")
with open(path, 'wb') as f:
    out.write(f)
print('wrote', path, len(out.pages), 'pages')
