"""基础工具：颜色、缓动、确定性噪声、路径揭示。"""
import functools
import math

import numpy as np

from ..paths import load_config

TAU = math.tau


@functools.lru_cache(maxsize=None)
def _colors():
    return load_config()["colors"]


def rgb(token_or_hex):
    h = _colors().get(token_or_hex, token_or_hex)
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) / 255 for i in (0, 2, 4))


def rgba(token_or_hex, a=1.0):
    return (*rgb(token_or_hex), a)


def mix(c1, c2, t):
    return tuple(a + (b - a) * t for a, b in zip(c1, c2))


def clamp(x, a=0.0, b=1.0):
    return a if x < a else b if x > b else x


def lerp(a, b, t):
    return a + (b - a) * t


def ease_in_out(t):
    t = clamp(t)
    return t * t * (3 - 2 * t)


def ease_out(t):
    t = clamp(t)
    return 1 - (1 - t) ** 3


def ease_in(t):
    t = clamp(t)
    return t ** 3


def ease_out_back(t, s=1.4):
    t = clamp(t)
    t -= 1
    return t * t * ((s + 1) * t + s) + 1


def prog(x, a, b):
    """x 在 [a, b] 内的线性进度，夹到 0..1。"""
    if b == a:
        return 1.0 if x >= b else 0.0
    return clamp((x - a) / (b - a))


def seeded(*keys):
    """由任意键生成确定性随机数发生器。"""
    h = 2166136261
    for k in keys:
        for ch in str(k):
            h = ((h ^ ord(ch)) * 16777619) & 0xFFFFFFFF
    return np.random.default_rng(h)


def smooth_noise_1d(n, rng, octaves=3):
    """长度 n 的平滑噪声，范围约 -1..1。"""
    out = np.zeros(n)
    amp = 1.0
    for o in range(octaves):
        k = max(2, int(3 * 2 ** o))
        ctrl = rng.uniform(-1, 1, k + 1)
        xs = np.linspace(0, k, n)
        out += amp * np.interp(xs, np.arange(k + 1), ctrl)
        amp *= 0.5
    return out / 1.75


# ---------- 路径几何 ----------

def polyline_lengths(pts):
    d = np.diff(pts, axis=0)
    seg = np.hypot(d[:, 0], d[:, 1])
    return np.concatenate([[0.0], np.cumsum(seg)])


def partial(pts, t0, t1=None):
    """按弧长截取路径的 [t0, t1] 部分（t 为 0..1）；只给 t0 时视为 [0, t0]。"""
    if t1 is None:
        t0, t1 = 0.0, t0
    pts = np.asarray(pts, dtype=float)
    if len(pts) < 2 or t1 <= t0:
        return pts[:0]
    L = polyline_lengths(pts)
    total = L[-1]
    if total <= 0:
        return pts[:0]
    a, b = t0 * total, t1 * total
    xs = np.interp([a, b], L, pts[:, 0])
    ys = np.interp([a, b], L, pts[:, 1])
    inner = pts[(L > a) & (L < b)]
    return np.vstack([[xs[0], ys[0]], inner, [xs[1], ys[1]]])


def point_at(pts, t):
    pts = np.asarray(pts, dtype=float)
    L = polyline_lengths(pts)
    a = clamp(t) * L[-1]
    return float(np.interp(a, L, pts[:, 0])), float(np.interp(a, L, pts[:, 1]))


def tangent_at(pts, t, eps=0.01):
    x0, y0 = point_at(pts, max(0, t - eps))
    x1, y1 = point_at(pts, min(1, t + eps))
    return math.atan2(y1 - y0, x1 - x0)


def bezier(p0, p1, p2, p3, n=48):
    t = np.linspace(0, 1, n)[:, None]
    p0, p1, p2, p3 = (np.array(p, dtype=float) for p in (p0, p1, p2, p3))
    return ((1 - t) ** 3) * p0 + 3 * ((1 - t) ** 2) * t * p1 + 3 * (1 - t) * t * t * p2 + t ** 3 * p3


def quad(p0, p1, p2, n=40):
    t = np.linspace(0, 1, n)[:, None]
    p0, p1, p2 = (np.array(p, dtype=float) for p in (p0, p1, p2))
    return ((1 - t) ** 2) * p0 + 2 * (1 - t) * t * p1 + t * t * p2


def rect_pts(x, y, w, h, r=0.0):
    if r <= 0:
        return np.array([[x, y], [x + w, y], [x + w, y + h], [x, y + h], [x, y]], dtype=float)
    pts = []
    for cx, cy, a0 in ((x + w - r, y + r, -90), (x + w - r, y + h - r, 0), (x + r, y + h - r, 90), (x + r, y + r, 180)):
        for a in np.linspace(a0, a0 + 90, 6):
            pts.append([cx + r * math.cos(math.radians(a)), cy + r * math.sin(math.radians(a))])
    pts.append(pts[0])
    return np.array(pts, dtype=float)


def circle_pts(cx, cy, r, n=72, a0=-90.0, sweep=360.0):
    a = np.radians(np.linspace(a0, a0 + sweep, n))
    return np.stack([cx + r * np.cos(a), cy + r * np.sin(a)], axis=1)


def line_pts(x0, y0, x1, y1, n=2):
    return np.stack([np.linspace(x0, x1, n), np.linspace(y0, y1, n)], axis=1)


def poly(*pts):
    return np.array(pts, dtype=float)


def resample(pts, spacing=6.0):
    pts = np.asarray(pts, dtype=float)
    L = polyline_lengths(pts)
    n = max(2, int(L[-1] / spacing) + 1)
    s = np.linspace(0, L[-1], n)
    return np.stack([np.interp(s, L, pts[:, 0]), np.interp(s, L, pts[:, 1])], axis=1)


def wobble(pts, amp, key, spacing=8.0):
    """手绘抖动：沿法线方向加确定性的平滑偏移。"""
    if amp <= 0:
        return np.asarray(pts, dtype=float)
    p = resample(pts, spacing)
    if len(p) < 3:
        return p
    rng = seeded("wobble", key)
    off = smooth_noise_1d(len(p), rng) * amp
    d = np.gradient(p, axis=0)
    nrm = np.stack([-d[:, 1], d[:, 0]], axis=1)
    nrm /= np.maximum(1e-6, np.hypot(nrm[:, 0], nrm[:, 1]))[:, None]
    return p + nrm * off[:, None]
