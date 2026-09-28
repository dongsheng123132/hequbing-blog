"""背景：染色宣纸（A 风格）与漆黑金粉底（B 风格），全部由代码生成，固定随机种子。"""
import functools
import os

import cairo
import numpy as np
from scipy.ndimage import gaussian_filter, zoom

from ..paths import CACHE
from .core import rgb, seeded

_KEEP = []


def _to_surface(img):
    """img: HxWx3 float 0..1 → cairo RGB24 surface。"""
    h, w, _ = img.shape
    a = np.clip(img * 255 + 0.5, 0, 255).astype(np.uint8)
    buf = np.zeros((h, w, 4), dtype=np.uint8)
    buf[..., 0] = a[..., 2]
    buf[..., 1] = a[..., 1]
    buf[..., 2] = a[..., 0]
    buf[..., 3] = 255
    stride = cairo.ImageSurface.format_stride_for_width(cairo.FORMAT_RGB24, w)
    assert stride == w * 4
    surf = cairo.ImageSurface.create_for_data(buf, cairo.FORMAT_RGB24, w, h, stride)
    _KEEP.append(buf)
    return surf


def _lowfreq(rng, h, w, cells, sigma):
    g = rng.standard_normal((cells[1], cells[0]))
    up = zoom(g, (h / cells[1], w / cells[0]), order=3)[:h, :w]
    up = gaussian_filter(up, sigma)
    return up / (np.abs(up).max() + 1e-9)


def _paper(token, w, h):
    rng = seeded("paper", token, w, h)
    base = np.array(rgb(token))
    mott = 0.035 * _lowfreq(rng, h, w, (9, 5), 20 * w / 1920) + 0.02 * _lowfreq(rng, h, w, (36, 20), 6 * w / 1920)
    grain = 0.012 * rng.standard_normal((h, w))
    img = base[None, None, :] * (1 + mott + grain)[..., None]
    # 纤维：细长半透明曲线
    surf = _to_surface(np.clip(img, 0, 1))
    ctx = cairo.Context(surf)
    s = w / 1920
    n = int(1400 * (w * h) / (1920 * 1080)) + 50
    light = np.minimum(1, base * 1.25 + 0.05)
    dark = base * 0.8
    for i in range(n):
        x, y = rng.uniform(0, w), rng.uniform(0, h)
        L = rng.uniform(20, 90) * s
        a = rng.uniform(0, np.pi)
        bend = rng.uniform(-0.6, 0.6)
        c = light if rng.random() < 0.65 else dark
        ctx.set_source_rgba(*c, rng.uniform(0.05, 0.13))
        ctx.set_line_width(rng.uniform(0.5, 1.3) * s)
        x1, y1 = x + L * np.cos(a), y + L * np.sin(a)
        mx, my = (x + x1) / 2 + bend * L * np.sin(a) * 0.3, (y + y1) / 2 - bend * L * np.cos(a) * 0.3
        ctx.move_to(x, y)
        ctx.curve_to(mx, my, mx, my, x1, y1)
        ctx.stroke()
    surf.flush()
    arr = np.frombuffer(surf.get_data(), dtype=np.uint8).reshape(h, w, 4)[..., :3][..., ::-1] / 255.0
    # 墨晕：几处极淡的深色晕染
    blot = np.zeros((h, w))
    for i in range(6):
        cx, cy = rng.uniform(0, w), rng.uniform(0, h)
        r = rng.uniform(120, 380) * s
        yy, xx = np.ogrid[:h, :w]
        blot += np.exp(-(((xx - cx) ** 2 + (yy - cy) ** 2) / (2 * r * r))) * rng.uniform(0.02, 0.05)
    yy, xx = np.mgrid[:h, :w]
    vig = 1 - 0.16 * (((xx - w / 2) / (w / 2)) ** 2 + ((yy - h / 2) / (h / 2)) ** 2) ** 1.2
    out = arr * (1 - blot)[..., None] * vig[..., None]
    return np.clip(out, 0, 1)


def _lacquer(token, w, h):
    rng = seeded("lacquer", token, w, h)
    base = np.array(rgb(token))
    mott = 0.25 * _lowfreq(rng, h, w, (7, 4), 30 * w / 1920)
    grain = 0.05 * rng.standard_normal((h, w))
    img = base[None, None, :] * (1 + mott + grain)[..., None]
    yy, xx = np.mgrid[:h, :w]
    vig = 1 - 0.35 * (((xx - w / 2) / (w / 2)) ** 2 + ((yy - h / 2) / (h / 2)) ** 2)
    img = img * np.clip(vig, 0.4, 1)[..., None]
    # 金粉：稀疏细点
    gold = np.array(rgb("gold"))
    n = int(900 * (w * h) / (1920 * 1080))
    ys = rng.integers(0, h, n)
    xs = rng.integers(0, w, n)
    amt = rng.uniform(0.04, 0.22, n)
    img[ys, xs] = img[ys, xs] * (1 - amt[:, None]) + gold * amt[:, None]
    return np.clip(img, 0, 1)


@functools.lru_cache(maxsize=16)
def background(token, w, h):
    os.makedirs(CACHE, exist_ok=True)
    path = os.path.join(CACHE, f"bg_{token}_{w}x{h}_v2.npy")
    if os.path.exists(path):
        img = np.load(path)
    else:
        img = _lacquer(token, w, h) if token == "ink_black" else _paper(token, w, h)
        img = img.astype(np.float32)
        np.save(path, img)
    return _to_surface(img)
