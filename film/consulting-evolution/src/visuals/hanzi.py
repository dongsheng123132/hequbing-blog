"""书法关键词：按规范笔顺逐笔显现。

数据：Make Me a Hanzi graphics.txt（Arphic Public License，源自文鼎 AR PL 楷体）。
每一笔有“轮廓”（SVG path）与“中线”（medians，按书写方向）。
显现方法：以该笔轮廓为裁剪区，沿中线从起笔到收笔推进一支圆头“毛笔”，
笔画完成后才开始下一笔。不是整字擦除，也不是描外轮廓。
坐标：1024 方框，数据 y 轴向上，显示时 y' = 900 - y。
"""
import functools
import json
import math
import re

import cairo
import numpy as np

from ..paths import asset, load_config
from .core import clamp, polyline_lengths, partial, seeded

_TOK = re.compile(r"[MLQCZ]|-?\d+(?:\.\d+)?")

BRUSH_W = 150.0   # 1024 单位下的笔宽（覆盖最粗的笔画）
PAUSE = 0.35      # 笔画间停顿（相对平均笔画时长）


@functools.lru_cache(maxsize=None)
def _data():
    with open(asset(load_config()["hanzi_data"]), encoding="utf-8") as fh:
        return json.load(fh)


def _parse(d):
    toks = _TOK.findall(d)
    ops = []
    i = 0
    cur = None
    while i < len(toks):
        t = toks[i]
        if t in "MLQCZ":
            cur = t
            i += 1
            if t == "Z":
                ops.append(("Z",))
            continue
        n = {"M": 2, "L": 2, "Q": 4, "C": 6}[cur]
        vals = [float(v) for v in toks[i:i + n]]
        i += n
        pts = [(vals[k], 900 - vals[k + 1]) for k in range(0, n, 2)]
        ops.append((cur, pts))
        if cur == "M":
            cur = "L"
    return ops


@functools.lru_cache(maxsize=None)
def char_data(ch):
    rec = _data()[ch]
    outlines = [_parse(s) for s in rec["strokes"]]
    medians = [np.array([[x, 900 - y] for x, y in m], dtype=float) for m in rec["medians"]]
    return outlines, medians


def stroke_count(ch):
    return len(char_data(ch)[1])


@functools.lru_cache(maxsize=None)
def schedule(ch):
    """每一笔在整字进度 0..1 上的 (起, 止)。时长与中线长度相关，笔间留停顿。"""
    _, medians = char_data(ch)
    lens = np.array([max(60.0, polyline_lengths(m)[-1]) for m in medians])
    durs = 0.45 + 0.55 * lens / lens.mean()
    pause = PAUSE * durs.mean()
    total = durs.sum() + pause * (len(durs) - 1)
    out = []
    t = 0.0
    for d in durs:
        out.append((t / total, (t + d) / total))
        t += d + pause
    return tuple(out)


def _outline_path(ctx, ops, s, ox, oy):
    x0 = y0 = None
    for op in ops:
        if op[0] == "M":
            (x, y), = op[1]
            ctx.move_to(ox + x * s, oy + y * s)
            x0, y0 = x, y
        elif op[0] == "L":
            (x, y), = op[1]
            ctx.line_to(ox + x * s, oy + y * s)
            x0, y0 = x, y
        elif op[0] == "Q":
            (x1, y1), (x2, y2) = op[1]
            cx1 = x0 + 2 / 3 * (x1 - x0)
            cy1 = y0 + 2 / 3 * (y1 - y0)
            cx2 = x2 + 2 / 3 * (x1 - x2)
            cy2 = y2 + 2 / 3 * (y1 - y2)
            ctx.curve_to(ox + cx1 * s, oy + cy1 * s, ox + cx2 * s, oy + cy2 * s, ox + x2 * s, oy + y2 * s)
            x0, y0 = x2, y2
        elif op[0] == "C":
            (x1, y1), (x2, y2), (x3, y3) = op[1]
            ctx.curve_to(ox + x1 * s, oy + y1 * s, ox + x2 * s, oy + y2 * s, ox + x3 * s, oy + y3 * s)
            x0, y0 = x3, y3
        else:
            ctx.close_path()


_KEEP = []


@functools.lru_cache(maxsize=8)
def _texture(key, n=384):
    """干笔纹理（alpha）：沿横向拉长的纤维噪声 + 稀疏飞白。"""
    rng = seeded("brush", key)
    a = rng.random((n, n))
    k = 17
    ker = np.ones(k) / k
    a = np.apply_along_axis(lambda r: np.convolve(r, ker, mode="same"), 1, a)
    a = (a - a.min()) / (a.max() - a.min())
    alpha = 0.80 + 0.20 * a
    holes = rng.random((n, n)) > 0.9985
    alpha[holes] = 0.35
    buf = (np.clip(alpha, 0, 1) * 255).astype(np.uint8)
    stride = cairo.ImageSurface.format_stride_for_width(cairo.FORMAT_A8, n)
    arr = np.zeros((n, stride), dtype=np.uint8)
    arr[:, :n] = buf
    surf = cairo.ImageSurface.create_for_data(arr, cairo.FORMAT_A8, n, n, stride)
    _KEEP.append(arr)  # cairo 不持有 numpy 缓冲区的引用
    return surf


def draw_char(ctx, ch, cx, cy, size, progress, color, alpha=1.0, texture_key="default",
              bleed=True, stroke_progress=None):
    """在以 (cx, cy) 为中心、边长 size 的方框中书写 ch。progress: 整字进度 0..1。"""
    if alpha <= 0.003 or progress <= 0:
        return
    outlines, medians = char_data(ch)
    sched = schedule(ch)
    s = size / 1024.0
    ox, oy = cx - size / 2, cy - size / 2
    ctx.save()
    ctx.push_group()
    ctx.set_source_rgba(*color[:3], 1.0)
    for i, (a, b) in enumerate(sched):
        p = 1.0 if stroke_progress is None else None
        p = clamp((progress - a) / (b - a)) if stroke_progress is None else stroke_progress[i]
        if p <= 0:
            break
        ctx.new_path()
        _outline_path(ctx, outlines[i], s, ox, oy)
        if p >= 1.0:
            if bleed:
                ctx.save()
                ctx.set_source_rgba(*color[:3], 0.35)
                ctx.set_line_width(max(1.0, 7 * s))
                ctx.set_line_join(cairo.LINE_JOIN_ROUND)
                ctx.stroke_preserve()
                ctx.restore()
            ctx.fill()
        else:
            ctx.save()
            ctx.clip()
            m = medians[i]
            # 起笔前段加一点延伸，保证笔头覆盖起笔处
            seg = partial(m, 0.0, p)
            ctx.new_path()
            ctx.set_line_width(BRUSH_W * s)
            ctx.set_line_cap(cairo.LINE_CAP_ROUND)
            ctx.set_line_join(cairo.LINE_JOIN_ROUND)
            ctx.move_to(ox + seg[0][0] * s, oy + seg[0][1] * s)
            for x, y in seg[1:]:
                ctx.line_to(ox + x * s, oy + y * s)
            if len(seg) == 1:
                ctx.line_to(ox + seg[0][0] * s + 0.01, oy + seg[0][1] * s)
            ctx.stroke()
            ctx.restore()
    pat = ctx.pop_group()
    tex = _texture(texture_key)
    ctx.set_source(pat)
    m = cairo.SurfacePattern(tex)
    sc = tex.get_width() / max(1.0, size)
    mat = cairo.Matrix(xx=sc, yy=sc, x0=-ox * sc, y0=-oy * sc)
    m.set_matrix(mat)
    m.set_extend(cairo.EXTEND_REPEAT)
    if alpha < 1.0:
        ctx.push_group()
        ctx.set_source(pat)
        ctx.mask(m)
        ctx.pop_group_to_source()
        ctx.paint_with_alpha(alpha)
    else:
        ctx.mask(m)
    ctx.restore()


def stroke_events(ch, start_frame, n_frames):
    """供音效使用：每笔起止帧（与画面同一计算）。"""
    out = []
    for a, b in schedule(ch):
        out.append((start_frame + a * n_frames, start_frame + b * n_frames))
    return out
