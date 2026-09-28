"""Compose a shot by constraints: find camera (pos, yaw, pitch, f) so that
world points land on chosen screen positions. Used to author camera keys."""

import numpy as np
from scipy.optimize import least_squares

from engine3d import Camera


def solve(pairs, init, fix_f=None, weights=None, bounds_f=(1200, 4200), priors=()):
    """pairs: [(world_xyz, (sx, sy)), ...]; init: (x, y, z, yaw, pitch, f)."""
    wts = np.ones(len(pairs)) if weights is None else np.asarray(weights, float)

    def resid(v):
        x, y, z, yaw, pitch = v[:5]
        f = fix_f if fix_f else v[5]
        cam = Camera((x, y, z), yaw, pitch, f)
        r = []
        for (P, (sx, sy)), w in zip(pairs, wts):
            pc = cam.to_cam(np.array([P]))
            if pc[0, 2] < 1:
                r += [1e4, 1e4]
                continue
            s = cam.proj(pc)[0]
            r += [(s[0] - sx) * w, (s[1] - sy) * w]
        for idx, val, w in priors:   # soft preferences, e.g. (4, pitch, 400)
            r.append((v[idx] - val) * w)
        return np.array(r)

    v0 = np.array(init if not fix_f else init[:5], float)
    if not fix_f:
        lo = [-np.inf] * 5 + [bounds_f[0]]
        hi = [np.inf] * 5 + [bounds_f[1]]
        res = least_squares(resid, v0, bounds=(lo, hi))
    else:
        res = least_squares(resid, v0)
    v = list(res.x)
    if fix_f:
        v.append(fix_f)
    return v, float(np.sqrt(np.mean(res.fun ** 2)))


def report(v, pts):
    cam = Camera(v[:3], v[3], v[4], v[5])
    out = []
    for P in pts:
        pc = cam.to_cam(np.array([P]))
        out.append(tuple(np.round(cam.proj(pc)[0], 1)))
    return out
