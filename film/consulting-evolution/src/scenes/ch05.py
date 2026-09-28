"""05 联 · 数字化：纸质订单变成数据对象 → 系统连通但经营未必变好 → 四个责任空隙 → 一条卡住的询盘。

不表现为“以前的咨询不做实施”；矛盾是：系统可以连接，但目标、流程、权限与人员责任仍需配合。
"""
import math

import numpy as np

from ..visuals import props, sketch
from ..visuals.core import bezier, circle_pts, ease_in_out, ease_out, lerp, line_pts, prog, rect_pts
from ..visuals.text import draw_text
from .base import scene

FIELDS = ["客户", "品名", "数量", "交期"]
DARK = (0.06, 0.055, 0.045)


def order_card(s, x, y, dig, alpha):
    """dig: 0 纸质手写 → 1 结构化字段。"""
    ctx, st = s.ctx, s.st
    w, h = 320, 380
    col = tuple(lerp(a, b, dig) for a, b in zip(st.line[:3], st.acc[:3]))
    sketch.box(ctx, x, y, w, h, col, alpha, 2.2, fill_color=DARK, fill_alpha=0.92, r=6 + 8 * dig)
    draw_text(ctx, "订单", x + w / 2, y + 50, 34, (*col[:3], alpha), key="serif_bold", align="center")
    for i, f in enumerate(FIELDS):
        yy = y + 110 + i * 64
        draw_text(ctx, f, x + 26, yy + 8, 26, (*st.line[:3], alpha), key="serif")
        # 手写波浪线 → 字段框
        xs = np.linspace(x + 110, x + w - 30, 40)
        hand = np.stack([xs, yy + 4 * np.sin(xs / 7 + i)], axis=1)
        box = rect_pts(x + 104, yy - 20, w - 128, 38, 6)
        if dig < 1:
            sketch.stroke(ctx, hand, 1, st.dim, 1.8, alpha * (1 - dig), rough=0)
        if dig > 0:
            sketch.stroke(ctx, box, dig, st.acc, 1.8, alpha, rough=0)
            sketch.dot(ctx, x + w - 42, yy, 5, st.acc, alpha * dig)


@scene("S05-1")
def s05_1(s):
    ctx, st = s.ctx, s.st
    bc = s.bc
    ex = s.exit(0.6)
    mv = ease_in_out(prog(bc, s.ev("move"), s.ev("digitize")))
    dig = ease_in_out(prog(bc, s.ev("digitize"), s.ev("digitize") + 2.0))
    x = lerp(560, 1000, mv)
    sketch.stroke(ctx, line_pts(560, 820, 1760, 820), prog(bc, 0.5, 2.0), st.dim, 1.6, ex, rough=0, dash=[3, 7])
    order_card(s, x, 330, dig, ex * ease_out(prog(bc, 0.5, 1.5)))
    # 结构化后：字段伸出连线，指向将要连接的系统
    if dig > 0.6:
        k = ease_out(prog(bc, 9.0, 10.5))
        for i, lab in enumerate(("客户", "库存", "生产", "交付")):
            y0 = 330 + 110 + i * 64
            y1 = 260 + i * 150
            sketch.stroke(ctx, np.array([[x + 320, y0], [x + 420, y0], [x + 420, y1], [1560, y1]]), k, st.acc, 1.8,
                          ex, rough=0)
            if k > 0.9:
                sketch.box(ctx, 1560, y1 - 30, 150, 60, st.line, ex, 2.0, fill_color=DARK, fill_alpha=0.9, r=8)
                draw_text(ctx, lab, 1635, y1, 28, (*st.line[:3], ex), key="sans", align="center", valign="middle")
    a = ex * ease_out(prog(bc, 3.0, 4.0))
    draw_text(ctx, "纸质订单", 720, 790, 26, (*st.dim[:3], a * (1 - dig)), key="serif", align="center")
    draw_text(ctx, "数据对象", 1160, 790, 26, (*st.acc[:3], ex * dig), key="serif", align="center")


SYS = {"客户": (760, 300), "订单": (1060, 230), "库存": (1360, 300), "生产": (1260, 560), "交付": (860, 560)}
EDGES = [("客户", "订单"), ("订单", "库存"), ("库存", "生产"), ("生产", "交付"), ("交付", "客户"), ("订单", "生产")]
GAPS = {"谁来判断": ("客户", "订单"), "谁来执行": ("库存", "生产"), "怎样协同": ("订单", "生产"), "怎样检验": ("生产", "交付")}


def draw_systems(s, alpha, lit=1.0, knot=0.0, gaps=None):
    ctx, st = s.ctx, s.st
    for a_, b_ in EDGES:
        (x0, y0), (x1, y1) = SYS[a_], SYS[b_]
        broken = gaps and (a_, b_) in gaps.values()
        if broken:
            mx, my = (x0 + x1) / 2, (y0 + y1) / 2
            sketch.stroke(ctx, line_pts(x0, y0, lerp(x0, mx, 0.8), lerp(y0, my, 0.8)), lit, st.acc, 2.2, alpha, rough=0)
            sketch.stroke(ctx, line_pts(x1, y1, lerp(x1, mx, 0.8), lerp(y1, my, 0.8)), lit, st.acc, 2.2, alpha, rough=0)
        else:
            sketch.stroke(ctx, line_pts(x0, y0, x1, y1), lit, st.acc, 2.2, alpha, rough=0)
    if knot > 0:
        (x0, y0), (x1, y1) = SYS["库存"], SYS["生产"]
        mx, my = (x0 + x1) / 2, (y0 + y1) / 2
        t = np.linspace(0, 2 * math.pi * 2, 80)
        loop = np.stack([mx + 22 * np.cos(t) + t * 1.5 - 18, my + 18 * np.sin(t * 1.5)], axis=1)
        sketch.stroke(ctx, loop, knot, st.red, 3.0, alpha, rough=0)
    for name, (x, y) in SYS.items():
        sketch.box(ctx, x - 80, y - 36, 160, 72, st.line, alpha, 2.2, fill_color=DARK, fill_alpha=0.95, r=10)
        draw_text(ctx, name, x, y, 32, (*st.line[:3], alpha), key="sans_bold", align="center", valign="middle")


def draw_dashboard(s, alpha, flat=1.0):
    ctx, st = s.ctx, s.st
    x, y, w, h = 1450, 520, 300, 230
    sketch.box(ctx, x, y, w, h, st.line, alpha, 2.0, fill_color=DARK, fill_alpha=0.95, r=8)
    draw_text(ctx, "经营看板", x + 16, y + 36, 24, (*st.line[:3], alpha), key="sans")
    for i, v in enumerate((0.35, 0.5, 0.42, 0.6, 0.55)):
        sketch.box(ctx, x + 24 + i * 52, y + h - 24 - 110 * v, 30, 110 * v, st.dim, alpha, 1.6, r=2)
    xs = np.linspace(x + 20, x + w - 20, 30)
    ys = y + 120 - 6 * np.sin(xs / 25) * 0.3
    sketch.stroke(ctx, np.stack([xs, ys], axis=1), flat, st.acc, 2.4, alpha, rough=0)
    if flat >= 1:
        draw_text(ctx, "？", x + w - 30, y + 100, 36, (*st.red[:3], alpha), key="sans_bold", align="center")


@scene("S05-2")
def s05_2(s):
    ctx, st = s.ctx, s.st
    bc = s.bc
    ex = s.exit(0.6)
    lit = prog(bc, s.ev("connect"), s.ev("connect") + 1.5)
    # 连通时沿线跑动的数据点
    draw_systems(s, ex * ease_out(prog(bc, 12.0, 12.8)), lit=lit,
                 knot=prog(bc, s.ev("knot"), s.ev("knot") + 1.2))
    if lit >= 1:
        for i, (a_, b_) in enumerate(EDGES):
            (x0, y0), (x1, y1) = SYS[a_], SYS[b_]
            u = (bc * 0.8 + i * 0.17) % 1.0
            sketch.dot(ctx, lerp(x0, x1, u), lerp(y0, y1, u), 5, st.line, ex)
    draw_dashboard(s, ex * ease_out(prog(bc, 15.0, 16.0)), flat=prog(bc, s.ev("flat"), s.ev("flat") + 1.5))
    a = ex * ease_out(prog(bc, s.ev("knot") + 0.6, s.ev("knot") + 1.4))
    draw_text(ctx, "连上 ≠ 变好", 1060, 760, 44, (*st.line[:3], a), key="serif_bold", align="center")


@scene("S05-3")
def s05_3(s):
    ctx, st = s.ctx, s.st
    bc = s.bc
    ex = s.exit(0.6)
    draw_systems(s, ex, lit=1.0, gaps=GAPS)
    draw_dashboard(s, ex * 0.6, flat=1.0)
    for i, (lab, (a_, b_)) in enumerate(GAPS.items()):
        b = s.ev(f"r{i + 1}")
        k = ease_out(prog(bc, b, b + 0.8))
        if k <= 0:
            continue
        (x0, y0), (x1, y1) = SYS[a_], SYS[b_]
        mx, my = (x0 + x1) / 2, (y0 + y1) / 2
        yy = lerp(my - 80, my, k)
        w = 150
        sketch.box(ctx, mx - w / 2, yy - 26, w, 52, st.red, ex * k, 2.4, fill_color=DARK, fill_alpha=0.95, r=26)
        draw_text(ctx, lab, mx, yy, 28, (*st.line[:3], ex * k), key="sans_bold", align="center", valign="middle")


@scene("S05-4")
def s05_4(s):
    ctx, st = s.ctx, s.st
    bc = s.bc
    # 两个环节与夹在中间的询盘
    a = ease_out(prog(bc, 36.0, 37.0))
    for x, lab in ((620, "资料查找"), (1300, "报价准备")):
        sketch.box(ctx, x, 440, 260, 110, st.line, a, 2.4, fill_color=DARK, fill_alpha=0.95, r=12)
        draw_text(ctx, lab, x + 130, 495, 34, (*st.line[:3], a), key="sans_bold", align="center", valign="middle")
    sketch.stroke(ctx, line_pts(880, 495, 1300, 495), a, st.dim, 2.0, a, rough=0, dash=[8, 8])
    # 询盘卡片来回试探后停在中间
    wob = 0.0
    if bc < s.ev("stuck"):
        wob = math.sin((bc - 37.0) * math.pi) * 120 * (1 - prog(bc, 37.0, s.ev("stuck")))
    x = 1090 + wob
    k = ease_out(prog(bc, 36.5, 37.5))
    sketch.box(ctx, x - 110, 590, 220, 120, st.acc, k, 2.4, fill_color=DARK, fill_alpha=0.95, r=12)
    draw_text(ctx, "客户询盘", x, 640, 32, (*st.line[:3], k), key="sans_bold", align="center", valign="middle")
    for j in range(2):
        sketch.stroke(ctx, line_pts(x - 80, 672 + j * 16, x + 80 - j * 50, 672 + j * 16), 1, st.dim, 1.4, k, rough=0)
    if bc >= s.ev("stuck"):
        blink = 0.55 + 0.45 * (1 if int((bc - s.ev("stuck")) * 2) % 2 == 0 else 0)
        kk = ease_out(prog(bc, s.ev("stuck"), s.ev("stuck") + 0.6))
        sketch.box(ctx, x - 70, 740, 140, 48, st.red, kk * blink, 2.6, r=24)
        draw_text(ctx, "待处理", x, 764, 28, (*st.red[:3], kk * blink), key="sans_bold", align="center",
                  valign="middle")
        props.stopwatch(ctx, x + 180, 650, 34, (bc - s.ev("stuck")) * math.pi / 6, st.dim, st.red, kk)
    a2 = ease_out(prog(bc, 41.0, 42.0))
    draw_text(ctx, "卡在资料查找与报价准备之间", 1090, 340, 36, (*st.line[:3], a2), key="serif", align="center")
