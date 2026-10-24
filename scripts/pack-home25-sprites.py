#!/usr/bin/env python3
"""Crop the rendered pose sprites, save them as WebP and write apps/home3d/illustrated/sprites.js.
Usage: python3 scripts/pack-home25-sprites.py <render-output-dir>"""
import json, os, sys
from PIL import Image
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
SRC = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, 'artifacts/home25-sprites')
DST = os.path.join(ROOT, 'assets/home3d/illustrated/models')
SCALE = 0.62
os.makedirs(DST, exist_ok=True)
raw = json.load(open(os.path.join(SRC, 'raw-meta.json')))
k = raw['W'] / raw['span']
sprites = {}
for name, info in sorted(raw['meta'].items()):
    im = Image.open(os.path.join(SRC, name + '.png')).convert('RGBA')
    bb = im.split()[3].point(lambda v: 255 if v > 8 else 0).getbbox()
    if not bb: continue
    bb = (max(0, bb[0] - 2), max(0, bb[1] - 2), min(im.width, bb[2] + 2), min(im.height, bb[3] + 2))
    c = im.crop(bb); w, h = round(c.width * SCALE), round(c.height * SCALE)
    c.resize((w, h), Image.LANCZOS).save(os.path.join(DST, name + '.webp'), 'WEBP', quality=86, method=4)
    a = info['anchor']
    sprites[name] = [w, h, round((info['origin'][0] - bb[0]) * SCALE, 1), round((info['origin'][1] - bb[1]) * SCALE, 1), round(a['x'], 3), round(a['y'], 3), round(a['z'], 3)]
units = round(122.47 / (k * SCALE), 5)  # iso units (100 per meter along an axis) per sprite pixel
js = """/* Pose sprites rendered from the packaged 3D characters (bunny-blue-v1 for you, silver-red-v1 for Ta).
   Each entry: [width, height, originX, originY, anchorX, anchorY, anchorZ] in sprite pixels / meters.
   The origin pixel is world (0, 0, 0) of the render; the anchor is where the model root stood.
   Rebuild with scripts/render-home25-sprites.cjs and scripts/pack-home25-sprites.py. */
(function (H) {
    'use strict';
    H.Sprites25 = { base: 'assets/home3d/illustrated/models/', unitsPerPx: %s, sprites: %s };
})(window.ByndHome3D);
""" % (units, json.dumps(sprites, separators=(',', ':')))
open(os.path.join(ROOT, 'apps/home3d/illustrated/sprites.js'), 'w').write(js)
print(len(sprites), 'sprites')
