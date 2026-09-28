"""线描绘制：手绘抖动、按弧长逐步画出、笔尖、箭头、虚线。"""
import math

import cairo
import numpy as np

from .core import partial, point_at, tangent_at, wobble

_WCACHE = {}


def _wob(pts, amp, key):
    if not key or amp <= 0:
        return np.asarray(pts, dtype=float)
    pts = np.asarray(pts, dtype=float)
    k = (key, amp, pts.shape, hash(pts.tobytes()))
    v = _WCACHE.get(k)
    if v is None:
        if len(_WCACHE) > 20000:
            _WCACHE.clear()
        v = wobble(pts, amp, key)
        _WCACHE[k] = v
    return v


def _path(ctx, pts):
    ctx.move_to(*pts[0])
    for x, y in pts[1:]:
        ctx.line_to(x, y)


def stroke(ctx, pts, t=1.0, color=(1, 1, 1), width=2.5, alpha=1.0, rough=1.0, key=None,
           double=True, tip=False, dash=None, t0=0.0):
    """画出路径的 [t0, t] 部分。rough>0 且给出 key 时加入确定性手绘抖动。"""
    if alpha <= 0.003 or t <= t0:
        return
    p = _wob(pts, rough, key)
    p = partial(p, t0, min(1.0, t)) if (t < 1.0 or t0 > 0) else p
    if len(p) < 2:
        return
    ctx.save()
    ctx.set_line_cap(cairo.LINE_CAP_ROUND)
    ctx.set_line_join(cairo.LINE_JOIN_ROUND)
    if dash:
        ctx.set_dash(dash)
    ctx.set_source_rgba(*color[:3], alpha)
    ctx.set_line_width(width)
    ctx.new_path()
    _path(ctx, p)
    ctx.stroke()
    if double and key and rough > 0:
        q = _wob(pts, rough * 1.6, key + "#2")
        q = partial(q, t0, min(1.0, t)) if (t < 1.0 or t0 > 0) else q
        if len(q) >= 2:
            ctx.set_source_rgba(*color[:3], alpha * 0.28)
            ctx.set_line_width(max(0.8, width * 0.55))
            ctx.new_path()
            _path(ctx, q)
            ctx.stroke()
    if tip and t < 1.0:
        x, y = p[-1]
        ctx.set_source_rgba(*color[:3], alpha * 0.9)
        ctx.arc(x, y, width * 1.6, 0, math.tau)
        ctx.fill()
    ctx.restore()


def fill(ctx, pts, color, alpha=1.0):
    if alpha <= 0.003:
        return
    ctx.save()
    ctx.new_path()
    _path(ctx, np.asarray(pts, dtype=float))
    ctx.close_path()
    ctx.set_source_rgba(*color[:3], alpha)
    ctx.fill()
    ctx.restore()


def dot(ctx, x, y, r, color, alpha=1.0):
    if alpha <= 0.003 or r <= 0:
        return
    ctx.save()
    ctx.new_path()
    ctx.arc(x, y, r, 0, math.tau)
    ctx.set_source_rgba(*color[:3], alpha)
    ctx.fill()
    ctx.restore()


def ring(ctx, x, y, r, color, width=2.0, alpha=1.0, t=1.0, a0=-90.0):
    if alpha <= 0.003 or t <= 0:
        return
    ctx.save()
    ctx.new_path()
    ctx.arc(x, y, r, math.radians(a0), math.radians(a0 + 360 * min(1.0, t)))
    ctx.set_line_width(width)
    ctx.set_line_cap(cairo.LINE_CAP_ROUND)
    ctx.set_source_rgba(*color[:3], alpha)
    ctx.stroke()
    ctx.restore()


def arrowhead(ctx, x, y, ang, size, color, alpha=1.0, width=2.5):
    if alpha <= 0.003:
        return
    ctx.save()
    ctx.set_line_cap(cairo.LINE_CAP_ROUND)
    ctx.set_line_join(cairo.LINE_JOIN_ROUND)
    ctx.set_source_rgba(*color[:3], alpha)
    ctx.set_line_width(width)
    for s in (1, -1):
        a = ang + math.pi - s * 0.45
        ctx.move_to(x, y)
        ctx.line_to(x + size * math.cos(a), y + size * math.sin(a))
    ctx.stroke()
    ctx.restore()


def arrow(ctx, pts, t=1.0, color=(1, 1, 1), width=2.5, alpha=1.0, head=14, key=None, rough=0.8, dash=None):
    stroke(ctx, pts, t, color, width, alpha, rough=rough, key=key, dash=dash)
    if t > 0.02:
        x, y = point_at(pts, min(1, t))
        ang = tangent_at(pts, min(1, t))
        arrowhead(ctx, x, y, ang, head, color, alpha, width)


def rounded_rect(ctx, x, y, w, h, r):
    ctx.new_path()
    ctx.arc(x + w - r, y + r, r, -math.pi / 2, 0)
    ctx.arc(x + w - r, y + h - r, r, 0, math.pi / 2)
    ctx.arc(x + r, y + h - r, r, math.pi / 2, math.pi)
    ctx.arc(x + r, y + r, r, math.pi, 1.5 * math.pi)
    ctx.close_path()


def box(ctx, x, y, w, h, color, alpha=1.0, width=2.0, fill_color=None, fill_alpha=0.0, r=8.0, t=1.0, key=None):
    """卡片框：t<1 时沿周长逐步画出。"""
    from .core import rect_pts
    if fill_color is not None and fill_alpha > 0 and t >= 1.0:
        ctx.save()
        rounded_rect(ctx, x, y, w, h, r)
        ctx.set_source_rgba(*fill_color[:3], fill_alpha * alpha)
        ctx.fill()
        ctx.restore()
    stroke(ctx, rect_pts(x, y, w, h, r), t, color, width, alpha, rough=0.6 if key else 0, key=key, double=False)


def check(ctx, x, y, s, color, alpha=1.0, t=1.0, width=3.0):
    pts = np.array([[x - s * 0.5, y], [x - s * 0.12, y + s * 0.4], [x + s * 0.55, y - s * 0.45]])
    stroke(ctx, pts, t, color, width, alpha, rough=0)


def cross(ctx, x, y, s, color, alpha=1.0, t=1.0, width=3.0):
    stroke(ctx, np.array([[x - s, y - s], [x + s, y + s]]), min(1, t * 2), color, width, alpha, rough=0)
    stroke(ctx, np.array([[x + s, y - s], [x - s, y + s]]), max(0, t * 2 - 1), color, width, alpha, rough=0)
