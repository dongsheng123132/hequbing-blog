"""朱红印章：白文（字为留白），带印泥颗粒与边缘磨损，确定性生成并缓存。"""
import functools
import math

import cairo
import numpy as np

from .core import rgb, seeded
from .text import font, text_path

_KEEP = []


@functools.lru_cache(maxsize=32)
def seal_surface(text, px=256, key_font="serif_black", layout="auto"):
    """返回 px×px 的 ARGB 印章图。text 1 字居中；3 字按“右一列两字 + 左一列一字”的传统读序排为两列。"""
    surf = cairo.ImageSurface(cairo.FORMAT_ARGB32, px, px)
    ctx = cairo.Context(surf)
    red = rgb("vermilion")
    m = px * 0.04
    r = px * 0.08
    ctx.new_path()
    ctx.arc(px - m - r, m + r, r, -math.pi / 2, 0)
    ctx.arc(px - m - r, px - m - r, r, 0, math.pi / 2)
    ctx.arc(m + r, px - m - r, r, math.pi / 2, math.pi)
    ctx.arc(m + r, m + r, r, math.pi, 1.5 * math.pi)
    ctx.close_path()
    ctx.set_source_rgb(*red)
    ctx.fill()
    fnt = font(key_font)
    ctx.set_operator(cairo.OPERATOR_CLEAR)
    if len(text) == 1:
        size = px * 0.66
        w = fnt.advance(text, size)
        ctx.new_path()
        text_path(ctx, fnt, text, (px - w) / 2, px / 2 + size * 0.36, size)
        ctx.fill()
    elif len(text) == 2:
        size = px * 0.42
        for i, ch in enumerate(text):
            w = fnt.advance(ch, size)
            ctx.new_path()
            text_path(ctx, fnt, ch, (px - w) / 2, px * (0.30 + 0.43 * i) + size * 0.36, size)
            ctx.fill()
    elif len(text) == 4:
        # 四字：右列上下（第 1、2 字），左列上下（第 3、4 字），按传统印文自右向左读
        size = px * 0.38
        for col, cx in ((0, px * 0.715), (1, px * 0.285)):
            for row in range(2):
                ch = text[col * 2 + row]
                w = fnt.advance(ch, size)
                ctx.new_path()
                text_path(ctx, fnt, ch, cx - w / 2, px * (0.285 + 0.43 * row) + size * 0.36, size)
                ctx.fill()
    else:
        # 三字：右列上下两字（第 1、2 字），左列一字拉长（第 3 字）
        size = px * 0.38
        cols = [(px * 0.70, [text[0], text[1]]), (px * 0.30, [text[2]])]
        for cx, chars in cols:
            if len(chars) == 2:
                for i, ch in enumerate(chars):
                    w = fnt.advance(ch, size)
                    ctx.new_path()
                    text_path(ctx, fnt, ch, cx - w / 2, px * (0.30 + 0.42 * i) + size * 0.36, size)
                    ctx.fill()
            else:
                ch = chars[0]
                big = size * 1.0
                w = fnt.advance(ch, big)
                ctx.save()
                ctx.translate(cx, px * 0.5)
                ctx.scale(1.0, 2.0)
                ctx.new_path()
                text_path(ctx, fnt, ch, -w / 2, big * 0.36, big)
                ctx.fill()
                ctx.restore()
    ctx.set_operator(cairo.OPERATOR_OVER)
    surf.flush()
    # 印泥颗粒与边缘磨损
    rng = seeded("seal", text, px)
    arr = np.frombuffer(surf.get_data(), dtype=np.uint8).reshape(px, px, 4).copy()
    a = arr[..., 3].astype(np.float32) / 255
    speck = rng.random((px, px))
    a *= np.where(speck > 0.985, 0.25, 1.0)
    a *= np.clip(0.88 + 0.12 * rng.standard_normal((px, px)) * 0.5, 0.6, 1.0)
    yy, xx = np.mgrid[:px, :px]
    edge = np.minimum.reduce([xx, yy, px - 1 - xx, px - 1 - yy]).astype(np.float32)
    wear = rng.random((px, px)) * px * 0.06
    a *= np.clip((edge - m * 0.4 - wear * 0.35) / (px * 0.012), 0, 1)
    out = np.zeros_like(arr)
    for c, v in enumerate((red[2], red[1], red[0])):  # BGRA 预乘
        out[..., c] = np.clip(v * 255 * a, 0, 255).astype(np.uint8)
    out[..., 3] = np.clip(a * 255, 0, 255).astype(np.uint8)
    stride = cairo.ImageSurface.format_stride_for_width(cairo.FORMAT_ARGB32, px)
    s2 = cairo.ImageSurface.create_for_data(out, cairo.FORMAT_ARGB32, px, px, stride)
    _KEEP.append(out)
    return s2


def draw_seal(ctx, text, cx, cy, size, alpha=1.0, rot=0.0, px=256):
    if alpha <= 0.003 or size <= 1:
        return
    s = seal_surface(text, px)
    ctx.save()
    ctx.translate(cx, cy)
    ctx.rotate(rot)
    sc = size / px
    ctx.scale(sc, sc)
    ctx.set_source_surface(s, -px / 2, -px / 2)
    ctx.get_source().set_filter(cairo.FILTER_GOOD)
    ctx.paint_with_alpha(alpha)
    ctx.restore()
