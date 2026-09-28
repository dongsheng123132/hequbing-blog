"""02 商 · 商贸经营：商路与货栈 → 货钱人信用信息 → 算盘账册与“消息先行” → 账册格线化为工厂布局。

器物组合按“约 明清”表达（A1）：算盘（上二下五）、竖行账册、货栈、契约、方孔钱。商路为示意。
"""
import math

import numpy as np

from ..visuals import props, sketch
from ..visuals.core import bezier, circle_pts, ease_in_out, ease_out, lerp, line_pts, point_at, prog, rect_pts
from ..visuals.text import draw_text
from .base import scene

ROUTE = np.vstack([bezier((520, 690), (700, 600), (820, 700), (1000, 640), 30),
                   bezier((1000, 640), (1180, 580), (1300, 560), (1460, 520), 30),
                   bezier((1460, 520), (1600, 480), (1680, 420), (1760, 380), 30)])
RIVER = bezier((520, 820), (900, 760), (1300, 860), (1760, 780), 80)


@scene("S02-1")
def s02_1(s):
    ctx, st = s.ctx, s.st
    bc = s.bc
    ex = s.exit(0.6)
    for i, r in enumerate(props.ridges(900, 1760, 360, 150, "ch02", layers=2)):
        sketch.stroke(ctx, r, prog(bc, 0.6 + 0.3 * i, 2.4), st.faint, 1.6, ex, rough=0.8, key=f"r2{i}")
    sketch.stroke(ctx, ROUTE, prog(bc, 0.5, 2.5), st.line, 3.0, ex, rough=1.0, key="route2", tip=True)
    sketch.stroke(ctx, RIVER, prog(bc, 1.0, 3.0), st.dim, 2.2, ex, rough=1.0, key="river2")
    for i, t in enumerate((0.0, 0.5, 1.0)):
        x, y = point_at(ROUTE, t)
        sketch.dot(ctx, x, y, 7, st.line, ex * ease_out(prog(bc, 1.5 + i * 0.4, 2.0 + i * 0.4)))
    props.warehouse(ctx, 1000, 626, 170, 130, st.line, ex, t=prog(bc, s.ev("warehouse"), s.ev("warehouse") + 2.0))
    props.warehouse(ctx, 1640, 420, 120, 92, st.line, ex, t=prog(bc, 3.2, 4.8), key="wh2")
    # 车沿商路、船沿河道
    ct = 0.05 + 0.35 * ease_in_out(prog(bc, 2.0, 8.0))
    cx, cy = point_at(ROUTE, ct)
    props.cart(ctx, cx, cy - 4, 0.6, st.line, ex * ease_out(prog(bc, 2.0, 2.8)), wheel_ang=bc * 2.0)
    bt = 0.15 + 0.5 * ease_in_out(prog(bc, 2.5, 8.0))
    bx, by = point_at(RIVER, bt)
    props.boat(ctx, bx, by, 0.75, st.line, ex * ease_out(prog(bc, 2.5, 3.3)))
    a = ex * ease_out(prog(bc, 1.0, 2.0))
    draw_text(ctx, "商路 · 示意", 1740, 880, 24, (*st.dim[:3], a), key="sans", align="right")
    k = ex * ease_out(prog(bc, 5.5, 6.5))
    draw_text(ctx, "货通四方", 700, 290, 56, (*st.line[:3], k), key="brush", align="center")


ELEMS = [("货", "goods", props.bale), ("钱", "money", props.cash_string), ("人", "people", None),
         ("信用", "trust", None), ("信息", "info", props.letter)]
CENTER = (1150, 540)
RAD = 270


def elem_pos(i):
    ang = math.radians(180 + i * 45)
    return CENTER[0] + RAD * 1.25 * math.cos(ang), CENTER[1] + RAD * 0.95 * math.sin(ang) + 60


def draw_elem(s, i, t, alpha):
    ctx, st = s.ctx, s.st
    name, key, fn = ELEMS[i]
    x, y = elem_pos(i)
    if fn is props.bale:
        props.bale(ctx, x, y, 1.1, st.line, alpha, t=t)
    elif fn is props.cash_string:
        props.cash_string(ctx, x, y, 0.9, st.line, alpha, t=t)
    elif fn is props.letter:
        props.letter(ctx, x, y, 1.0, st.line, alpha, t=t)
    elif key == "people":
        props.figure(ctx, x, y + 44, 60, st.line, alpha, pose="stand", t=t, key="p02")
    elif key == "trust":
        props.contract(ctx, x, y, 0.95, st.line, st.red, alpha, t=t, seal_t=prog(s.bc, 12.4, 13.0))
    if t > 0.5:
        draw_text(ctx, name, x, y + 86, 34, (*st.line[:3], alpha * ease_out(prog(t, 0.5, 1))), key="serif",
                  align="center")


@scene("S02-2")
def s02_2(s):
    ctx, st = s.ctx, s.st
    bc = s.bc
    ex = s.exit(0.6)
    for i in range(5):
        draw_elem(s, i, prog(bc, 8.2 + i * 0.35, 9.4 + i * 0.35), ex)
    for key, idx in (("goods", 0), ("money", 1), ("trust", 3)):
        k = ease_out(prog(bc, s.ev(key), s.ev(key) + 0.5))
        if k > 0:
            x, y = elem_pos(idx)
            sketch.ring(ctx, x, y + 10, 70 + 8 * (1 - k), st.red, 3.0, ex * k)
    lk = prog(bc, s.ev("links"), s.ev("links") + 1.5)
    if lk > 0:
        pts = [elem_pos(i) for i in range(5)]
        for i in range(5):
            for j in range(i + 1, 5):
                a, b = pts[i], pts[j]
                sketch.stroke(ctx, line_pts(a[0], a[1] + 10, b[0], b[1] + 10), lk, st.dim, 1.3, ex * 0.8,
                              rough=0, dash=[5, 7])
        draw_text(ctx, "经营", CENTER[0], CENTER[1] + 90, 44, (*st.line[:3], ex * ease_out(lk)), key="brush",
                  align="center")


BEAD_STATES = [
    [(0, 0)] * 9,
    [(0, 0)] * 5 + [(1, 0)] + [(0, 0)] * 3,
    [(0, 0)] * 5 + [(1, 2)] + [(0, 0)] * 3,
    [(0, 0)] * 4 + [(0, 3)] + [(1, 2)] + [(0, 0)] * 3,
    [(0, 0)] * 4 + [(0, 3)] + [(1, 2)] + [(0, 4)] + [(0, 0)] * 2,
]


@scene("S02-3")
def s02_3(s):
    ctx, st = s.ctx, s.st
    bc = s.bc
    ex = s.exit(0.6)
    step = 0
    for k, name in enumerate(("bead1", "bead2", "bead3", "bead4")):
        if bc >= s.ev(name) + 0.05:
            step = k + 1
    props.abacus(ctx, 470, 190, 400, 250, st.line, ex, t=prog(bc, 16.0, 16.9), state=BEAD_STATES[step],
                 bead_color=st.red)
    props.ledger(ctx, 960, 200, 700, 240, st.line, ex, t=prog(bc, 16.3, 17.6), marks=[(0, 2), (1, 5)] if bc > 20 else None,
                 red=st.red)
    # 商路两条线：货物（实线，慢）与消息（朱红虚线，快）
    y0 = 700
    sketch.stroke(ctx, line_pts(560, y0, 1640, y0), prog(bc, 16.5, 17.5), st.dim, 1.4, ex, rough=0)
    props.warehouse(ctx, 560, y0 + 40, 110, 86, st.line, ex, t=prog(bc, 16.5, 17.5), key="whA")
    props.warehouse(ctx, 1640, y0 + 40, 110, 86, st.line, ex, t=prog(bc, 16.7, 17.7), key="whB")
    gt = 0.45 * ease_in_out(prog(bc, 17.5, 23.5))
    gx = lerp(620, 1580, gt)
    sketch.stroke(ctx, line_pts(620, y0 + 20, gx, y0 + 20), 1, st.line, 3.0, ex, rough=0)
    props.bale(ctx, gx + 10, y0 - 8, 0.55, st.line, ex)
    mt = ease_in_out(prog(bc, s.ev("msg"), s.ev("arrive")))
    if mt > 0:
        mx = lerp(620, 1580, mt)
        sketch.stroke(ctx, line_pts(620, y0 - 40, mx, y0 - 40), 1, st.red, 3.0, ex, rough=0, dash=[12, 8])
        props.letter(ctx, mx + 20, y0 - 60, 0.5, st.red, ex)
    if bc >= s.ev("arrive"):
        k = ease_out(prog(bc, s.ev("arrive"), s.ev("arrive") + 0.6))
        sketch.ring(ctx, 1640, y0 - 20, 70, st.red, 2.6, ex * k)
    a = ex * ease_out(prog(bc, 17.0, 18.0))
    draw_text(ctx, "消息", 700, y0 - 56, 26, (*st.red[:3], a), key="serif")
    draw_text(ctx, "货物", 700, y0 + 60, 26, (*st.line[:3], a), key="serif")


@scene("S02-4")
def s02_4(s):
    ctx, st = s.ctx, s.st
    bc = s.bc
    ex = s.exit(0.6)
    g = ease_in_out(prog(bc, s.ev("grid"), s.ev("grid") + 2.0))
    # 账册：两页竖格线向外延展，并加入横线，成为厂房平面网格
    x0, y0, w, h = lerp(960, 560, g), lerp(200, 230, g), lerp(700, 1140, g), lerp(240, 560, g)
    cols = 20
    for c in range(cols + 1):
        xx = x0 + c * w / cols
        sketch.stroke(ctx, line_pts(xx, y0, xx, y0 + h), 1, st.dim if c % 5 else st.line, 1.3, ex * (0.6 + 0.4 * (c % 5 == 0)),
                      rough=0)
    rows = int(8 * g)
    for r in range(rows + 1):
        yy = y0 + r * h / 8
        sketch.stroke(ctx, line_pts(x0, yy, x0 + w, yy), g, st.dim, 1.2, ex * 0.7, rough=0)
    if g < 1:
        sketch.stroke(ctx, line_pts(x0 + w / 2, y0 - 6, x0 + w / 2, y0 + h + 6), 1, st.line, 2.4, ex * (1 - g), rough=0)
    sketch.stroke(ctx, rect_pts(x0, y0, w, h, 2), 1, st.line, 2.2, ex, rough=0.5, key="lg4")
    # 厂房布局：工位矩形
    if g > 0.6:
        a = ex * ease_out(prog(bc, s.ev("grid") + 1.2, s.ev("grid") + 2.4))
        cw, ch = w / cols, h / 8
        for (c, r, cwn, chn) in ((1, 1, 4, 2), (6, 1, 4, 2), (11, 1, 4, 2), (16, 1, 3, 2), (1, 5, 7, 2), (10, 5, 9, 2)):
            sketch.box(ctx, x0 + c * cw, y0 + r * ch, cwn * cw, chn * ch, st.line, a, 2.0, r=3)
        sketch.arrow(ctx, np.array([[x0 + cw * 0.5, y0 + ch * 4], [x0 + w - cw * 0.5, y0 + ch * 4]]), a, st.red, 2.6,
                     a, head=14, rough=0)
    # 算盘珠 → 机械节点
    m = ease_in_out(prog(bc, s.ev("machine"), s.ev("machine") + 1.5))
    if bc > 24:
        pts = [(x0 + (c + 0.5) * w / cols * 4 + w / cols, y0 + h * 0.66) for c in range(5)]
        for i, (px, py) in enumerate(pts):
            a = ex * ease_out(prog(bc, 24.5 + 0.2 * i, 25.5 + 0.2 * i))
            if m < 1:
                props._bead(ctx, px, py, 40, 18, st.red, a * (1 - m))
            if m > 0:
                props.gear(ctx, px, py, 22, 8, bc * 0.8 + i, st.line, a * m, 1.8)
    k = ex * ease_out(prog(bc, 27.0, 28.0))
    draw_text(ctx, "账册格线 → 厂房布局", 1130, 860, 30, (*st.line[:3], k), key="serif", align="center")
