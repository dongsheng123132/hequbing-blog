"""Easing + keyframe helpers. Everything is a pure function of time."""
import math

import numpy as np
from scipy.interpolate import PchipInterpolator


def clamp(x, a=0.0, b=1.0):
    return a if x < a else b if x > b else x


def lerp(a, b, t):
    return a + (b - a) * t


def remap(t, t0, t1):
    """Normalised progress of t inside [t0, t1], clamped."""
    if t1 <= t0:
        return 1.0 if t >= t1 else 0.0
    return clamp((t - t0) / (t1 - t0))


def cubic_bezier(x1, y1, x2, y2):
    """CSS-style cubic-bezier easing. Returns f(t)->y."""
    def bx(s):
        return 3 * x1 * s * (1 - s) ** 2 + 3 * x2 * s * s * (1 - s) + s ** 3

    def by(s):
        return 3 * y1 * s * (1 - s) ** 2 + 3 * y2 * s * s * (1 - s) + s ** 3

    def dbx(s):
        return 3 * x1 * (1 - s) ** 2 + 6 * (x2 - x1) * s * (1 - s) + 3 * (1 - x2) * s * s

    def f(t):
        t = clamp(t)
        if t in (0.0, 1.0):
            return t
        s = t
        for _ in range(8):
            d = dbx(s)
            if abs(d) < 1e-6:
                break
            s -= (bx(s) - t) / d
            s = clamp(s)
        lo, hi = 0.0, 1.0
        for _ in range(30):
            if abs(bx(s) - t) < 1e-7:
                break
            if bx(s) < t:
                lo = s
            else:
                hi = s
            s = (lo + hi) / 2
        return by(s)
    return f


# A small, deliberate vocabulary of motion. No bounce, no overshoot.
standard = cubic_bezier(0.45, 0.0, 0.2, 1.0)     # purposeful move
heavy = cubic_bezier(0.7, 0.0, 0.12, 1.0)        # weight: slow start, long settle
settle = cubic_bezier(0.0, 0.0, 0.15, 1.0)       # arrives and stops
launch = cubic_bezier(0.55, 0.0, 1.0, 0.45)      # gathers speed
gentle = cubic_bezier(0.37, 0.0, 0.63, 1.0)      # sine-like
precise = cubic_bezier(0.6, 0.0, 0.05, 1.0)      # mechanical, exact landing


def expo_out(t):
    t = clamp(t)
    return 1.0 if t >= 1 else 1 - 2 ** (-10 * t)


def smoothstep(t):
    t = clamp(t)
    return t * t * (3 - 2 * t)


class Track:
    """Monotone-cubic (PCHIP) keyframe track, C1 continuous, no overshoot.
    keys: list of (time, value-or-sequence)."""

    def __init__(self, keys):
        ts = np.array([k[0] for k in keys], dtype=float)
        vs = np.array([np.atleast_1d(k[1]) for k in keys], dtype=float)
        self.scalar = np.ndim(keys[0][1]) == 0
        self.t0, self.t1 = ts[0], ts[-1]
        self.v0, self.v1 = vs[0], vs[-1]
        self.f = PchipInterpolator(ts, vs, axis=0) if len(ts) > 1 else None

    def __call__(self, t):
        if self.f is None or t <= self.t0:
            v = self.v0
        elif t >= self.t1:
            v = self.v1
        else:
            v = self.f(t)
        return float(v[0]) if self.scalar else np.array(v, dtype=float)


def seg(t, spans, default=0.0):
    """Piecewise eased segments: spans = [(t0, t1, v0, v1, ease), ...] sorted."""
    val = default
    for (a, b, v0, v1, ez) in spans:
        if t < a:
            return val if val is not None else v0
        val = lerp(v0, v1, ez(remap(t, a, b)))
    return val


def angle_lerp(a, b, t):
    d = (b - a + math.pi) % (2 * math.pi) - math.pi
    return a + d * t
