"""Fixed-seed material textures (computed once, cached to disk)."""
import os

import numpy as np
from scipy.ndimage import gaussian_filter

from timeline import W, H

HERE = os.path.dirname(os.path.abspath(__file__))
CACHE = os.path.join(HERE, '..', 'build', 'cache')
SEED = 20260928


def paper(seed=SEED):
    """Signed luminance field in roughly [-1, 1]: soft cloudiness + fine fibres.
    Only perceptible when you look for it."""
    os.makedirs(CACHE, exist_ok=True)
    fn = os.path.join(CACHE, f'paper_{seed}.npy')
    if os.path.exists(fn):
        return np.load(fn)
    rng = np.random.default_rng(seed)
    # soft cloud (formation of the sheet)
    cloud = gaussian_filter(rng.standard_normal((H, W)), 38) * 1.0
    cloud += gaussian_filter(rng.standard_normal((H, W)), 9) * 0.5
    cloud /= np.abs(cloud).max() + 1e-9
    # fibres: many short, slightly curved strokes, mostly horizontal
    fib = np.zeros((H, W), np.float32)
    n = 5200
    xs = rng.uniform(0, W, n)
    ys = rng.uniform(0, H, n)
    ang = rng.normal(0.0, 0.55, n)
    ln = rng.uniform(10, 46, n)
    curv = rng.normal(0, 0.02, n)
    amp = rng.uniform(0.35, 1.0, n) * rng.choice([-1, 1], n, p=[0.35, 0.65])
    for i in range(n):
        steps = int(ln[i])
        a = ang[i]
        x, y = xs[i], ys[i]
        for s in range(steps):
            xi, yi = int(x), int(y)
            if 0 <= xi < W and 0 <= yi < H:
                fib[yi, xi] += amp[i]
            a += curv[i]
            x += np.cos(a)
            y += np.sin(a)
    fib = gaussian_filter(fib, 0.7)
    fib /= np.abs(fib).max() + 1e-9
    grain = gaussian_filter(rng.standard_normal((H, W)), 0.6)
    grain /= np.abs(grain).max() + 1e-9
    tex = (0.55 * cloud + 0.8 * fib + 0.25 * grain).astype(np.float32)
    tex /= np.abs(tex).max() + 1e-9
    np.save(fn, tex)
    return tex


def grain(frame_index, amp=1.0):
    """Per-frame dither grain, seeded by frame index (deterministic)."""
    rng = np.random.default_rng(SEED + 7919 * frame_index)
    g = rng.standard_normal((H, W)).astype(np.float32)
    return g * amp
