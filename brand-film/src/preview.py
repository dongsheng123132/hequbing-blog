"""Render individual stills for design review: python preview.py 0 1.25 2.5 ..."""
import os
import sys

import numpy as np
import skia
from PIL import Image

sys.path.insert(0, os.path.dirname(__file__))
from timeline import W, H  # noqa: E402
import scene  # noqa: E402

OUT = os.path.join(os.path.dirname(__file__), '..', 'build', 'preview')


def still(t, scale=0.5):
    surf = skia.Surface(W, H)
    with surf as c:
        scene.render(c, t)
    arr = np.array(surf.makeImageSnapshot().toarray(colorType=skia.kRGBA_8888_ColorType))
    im = Image.fromarray(arr[:, :, :3])
    if scale != 1:
        im = im.resize((int(W * scale), int(H * scale)), Image.LANCZOS)
    return im


if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    scale = float(os.environ.get('SCALE', '0.5'))
    for a in sys.argv[1:]:
        t = float(a)
        im = still(t, scale)
        fn = os.path.join(OUT, f't{t:06.3f}.png')
        im.save(fn)
        print(fn)
