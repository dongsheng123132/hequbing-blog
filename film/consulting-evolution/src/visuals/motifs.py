"""章节纹样母题（艺术化演变，不作纹样断代）。

每种纹样定义为一个“单元”：u∈[0,1] 沿纹带方向，v∈[-0.5,0.5] 横跨纹带。
可以铺成直线纹带，也可以绕成圆环（章节冲击转场）。
"""
import math

import numpy as np

from . import sketch


def _spiral_square(u0, u1, turns=3):
    """方折回旋（雷纹 / 回纹）的一个单元。"""
    w = u1 - u0
    pts = []
    x0, x1, y0, y1 = u0, u1, -0.5, 0.5
    for k in range(turns):
        pts += [(x0, y1), (x0, y0), (x1, y0), (x1, y1 - 0.0)]
        d = w * 0.16
        x0 += d
        y0 += 0.16
        x1 -= d
        y1 -= 0.16
        pts += [(x0 + 0.0, y1)]
    return [np.array(pts)]


def tile(kind, i):
    """返回单元内的折线列表（u∈[0,1], v∈[-0.5,0.5]）。"""
    if kind == "painted":          # 彩陶式：折线三角 + 圆点
        z = np.array([(0, 0.4), (0.25, -0.4), (0.5, 0.4), (0.75, -0.4), (1.0, 0.4)])
        c = np.array([(0.5 + 0.08 * math.cos(a), 0.08 * math.sin(a)) for a in np.linspace(0, 2 * math.pi, 16)])
        return [z, c]
    if kind == "bronze":           # 青铜几何：雷纹回旋
        return _spiral_square(0.05, 0.95, turns=2)
    if kind == "cloud":            # 云纹 / 卷草
        t = np.linspace(0, 1, 40)
        s = np.stack([t, 0.35 * np.sin(t * 2 * math.pi)], axis=1)
        a = np.linspace(0, 2.6 * math.pi, 30)
        r = np.linspace(0.18, 0.02, 30)
        curl = np.stack([0.25 + r * np.cos(a), -0.12 + r * np.sin(a)], axis=1)
        curl2 = np.stack([0.75 - r * np.cos(a), 0.12 - r * np.sin(a)], axis=1)
        return [s, curl, curl2]
    if kind == "meander":          # 回纹 → 刻度
        pts = np.array([(0, -0.4), (0, 0.4), (0.6, 0.4), (0.6, -0.15), (0.3, -0.15), (0.3, 0.15)])
        tick = np.array([(0.8, -0.5), (0.8, -0.2)])
        return [pts, tick]
    if kind == "grid":             # 经纬格
        return [np.array([(0, -0.5), (0, 0.5)]), np.array([(0, 0), (1, 0)]),
                np.array([(0.5, -0.25), (0.5, 0.25)])]
    if kind == "circuit":          # 电路路径
        return [np.array([(0, 0.3), (0.35, 0.3), (0.5, -0.2), (1.0, -0.2)]),
                np.array([(0.2, -0.4), (0.2, 0.0)])]
    if kind == "vine":             # 缠枝 → 节点
        t = np.linspace(0, 1, 40)
        s = np.stack([t, 0.3 * np.sin(t * 2 * math.pi + i)], axis=1)
        leaf = np.array([(0.25, 0.3), (0.32, 0.45), (0.4, 0.28)])
        return [s, leaf]
    if kind == "seal":
        return [np.array([(0, 0), (1, 0)])]
    return []


CHAPTER_MOTIF = {0: "painted", 1: "bronze", 2: "cloud", 3: "meander", 4: "grid", 5: "circuit", 6: "vine", 7: "seal"}


def draw_band(ctx, kind, x0, y, x1, h, color, alpha=1.0, width=1.6, t=1.0, n=None):
    L = x1 - x0
    if L < h:
        return
    n = n or max(1, int(L / (h * 2.4)))
    tw = L / n
    for i in range(n):
        if (i + 0.5) / n > t:
            break
        for p in tile(kind, i):
            q = np.stack([x0 + (i + p[:, 0]) * tw, y + p[:, 1] * h], axis=1)
            sketch.stroke(ctx, q, 1.0, color, width, alpha, rough=0, double=False)


def draw_ring(ctx, kind, cx, cy, R, band, color, alpha=1.0, width=1.8, n=None, phase=0.0):
    if alpha <= 0.003 or R <= 1:
        return
    n = n or max(8, int(2 * math.pi * R / (band * 1.5)))
    for i in range(n):
        for p in tile(kind, i):
            ang = 2 * math.pi * (i + p[:, 0]) / n + phase
            rad = R + p[:, 1] * band
            q = np.stack([cx + rad * np.cos(ang), cy + rad * np.sin(ang)], axis=1)
            sketch.stroke(ctx, q, 1.0, color, width, alpha, rough=0, double=False)
