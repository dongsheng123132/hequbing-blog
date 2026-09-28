"""Render all 900 frames (deterministic, time-driven) and post-process them.

  python render.py                # all frames -> build/frames/%04d.png
  python render.py 0 150          # a range [start, end)
"""
import os
import sys
import time
from multiprocessing import Pool

import numpy as np
import skia
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from timeline import W, H, FPS, FRAMES  # noqa: E402
import textures  # noqa: E402

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
FRAMES_DIR = os.path.join(ROOT, 'build', 'frames')

# Temporal supersampling (motion blur, 180-degree shutter) only where geometry
# moves fast: the key plate's slide and the dive through the slit.
BLUR_SPANS = [
    (2.88, 3.14, 5),     # K and the panel slide into place
    (3.78, 4.95, 7),     # the dive through the slit
    (4.95, 5.12, 3),
]
SHUTTER = 0.5 / FPS

_scene = None
_paper = None
_vig = None


def _init():
    global _scene, _paper, _vig
    import scene
    _scene = scene
    _paper = textures.paper()
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    r2 = ((xx - W / 2) / (W / 2)) ** 2 * 0.8 + ((yy - H / 2) / (H / 2)) ** 2 * 1.0
    _vig = np.clip(r2, 0, 2).astype(np.float32)


def samples_for(t):
    for a, b, n in BLUR_SPANS:
        if a <= t < b:
            return n
    return 1


_INFO = skia.ImageInfo.Make(W, H, skia.ColorType.kRGBA_F16_ColorType, skia.AlphaType.kPremul_AlphaType)


def draw(t):
    # half-float canvas: large quiet gradients (paper, light pools) stay smooth;
    # the only 8-bit quantisation happens once, after dither grain, in post()
    surf = skia.Surface.MakeRaster(_INFO)
    _scene.render(surf.getCanvas(), t)
    arr = surf.makeImageSnapshot().toarray(colorType=skia.ColorType.kRGBA_F32_ColorType)
    return np.clip(arr[:, :, :3], 0.0, 1.0)


def render_frame(i):
    t = i / FPS
    n = samples_for(t)
    if n == 1:
        img = draw(t)
    else:
        acc = np.zeros((H, W, 3), np.float32)
        for k in range(n):
            tk = t + SHUTTER * ((k + 0.5) / n - 0.5)
            acc += draw(tk)
        img = acc / n
    return post(img, i, t)


def post(img, i, t):
    lum = img @ np.array([0.2126, 0.7152, 0.0722], np.float32)
    # paper fibre: modulates luminance, a little more on the ivory than the graphite
    amp = 0.007 + 0.017 * lum
    img = img * (1.0 + (amp * _paper)[:, :, None])
    # vignette: gentle, stronger in the dark hall
    v = 0.075 - 0.045 * lum
    img = img * (1.0 - (v * _vig)[:, :, None])
    # last 2.5 s: a barely-there drift of light across the paper (the breath)
    if t > 12.0:
        k = min(1.0, (t - 12.0) / 1.5)
        x = np.linspace(-1, 1, W, dtype=np.float32)
        cx = -0.35 + 0.25 * (t - 12.0) / 3.0
        band = np.exp(-((x - cx) ** 2) / 0.9) * 0.012 * k
        img = img * (1.0 + band[None, :, None])
    # dither grain (seeded per frame) to keep gradients clean after encoding
    img = img * 255.0 + textures.grain(i, 0.85)[:, :, None]
    return np.clip(img + 0.5, 0, 255).astype(np.uint8)


def work(i):
    fn = os.path.join(FRAMES_DIR, f'{i:04d}.png')
    if os.path.exists(fn) and os.environ.get('FORCE') != '1':
        return i
    out = render_frame(i)
    Image.fromarray(out).save(fn, compress_level=1)
    return i


def main():
    a = int(sys.argv[1]) if len(sys.argv) > 1 else 0
    b = int(sys.argv[2]) if len(sys.argv) > 2 else FRAMES
    os.makedirs(FRAMES_DIR, exist_ok=True)
    textures.paper()   # build cache once
    t0 = time.time()
    procs = int(os.environ.get('PROCS', os.cpu_count() or 4))
    with Pool(procs, initializer=_init) as p:
        done = 0
        for _ in p.imap_unordered(work, range(a, b), chunksize=4):
            done += 1
            if done % 60 == 0:
                print(f'  {done}/{b - a} frames  {time.time() - t0:.0f}s', flush=True)
    print(f'rendered {b - a} frames in {time.time() - t0:.0f}s')


if __name__ == '__main__':
    main()
