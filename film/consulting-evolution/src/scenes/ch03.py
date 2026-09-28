"""03 管 · 工业管理：厂房与齿轮 → 工位、工序卡、计时器与工人改进 → 1911 书籍锚点 → 工序图变组织图变顾问工作桌。

先交代工业化与组织规模扩大，再出现 1911 锚点（H1）。工人画为有动作、会提出改进的人，而不是齿轮零件。
"""
import math

import numpy as np

from ..visuals import props, sketch
from ..visuals.core import bezier, circle_pts, ease_in_out, ease_out, lerp, line_pts, prog, rect_pts, resample
from ..visuals.text import draw_text
from .base import scene


@scene("S03-1")
def s03_1(s):
    ctx, st = s.ctx, s.st
    bc = s.bc
    ex = s.exit(0.6)
    props.factory(ctx, 540, 800, 820, 420, st.line, ex, t=prog(bc, 0.5, 3.5))
    for i, (x, y) in enumerate(((540 + 820 * 0.145, 800 - 420 * 1.15), (540 + 820 * 0.825, 800 - 420 * 1.05))):
        if bc > 3:
            props.smoke(ctx, x, y - 10, 1.4, (bc * 0.35 + i * 0.5) % 1.0, st.dim, ex * ease_out(prog(bc, 3.0, 4.0)))
    # 齿轮组：按拍转动（每拍转过固定角度，与机械节律同步）
    g = ease_out(prog(bc, s.ev("gears") - 1.0, s.ev("gears")))
    turn = max(0.0, bc - s.ev("gears")) * (math.pi / 8)
    props.gear(ctx, 1520, 430, 110, 14, turn, st.line, ex * g, 2.4, t=g)
    props.gear(ctx, 1520 + 110 + 72, 430 + 40, 70, 9, -turn * 14 / 9 + 0.2, st.acc, ex * g, 2.2, t=g)
    props.gear(ctx, 1520 - 40, 430 + 175, 62, 8, -turn * 14 / 8, st.acc, ex * g, 2.2, t=g)
    a = ex * ease_out(prog(bc, 4.5, 5.5))
    draw_text(ctx, "协作变复杂", 1560, 780, 50, (*st.line[:3], a), key="brush", align="center")


STATIONS = [620, 850, 1080, 1310, 1540]
STEPS = ["下料", "加工", "装配", "检验", "包装"]
PATH_Y = 700


def _path_before():
    # 往返折腾的工序路线：2 → 4 → 3 → 5
    xs = STATIONS
    return np.array([[xs[0], PATH_Y], [xs[1], PATH_Y], [xs[1] + 60, PATH_Y + 70], [xs[3], PATH_Y + 70],
                     [xs[3] + 40, PATH_Y], [xs[2], PATH_Y - 10], [xs[2] + 30, PATH_Y + 110], [xs[4], PATH_Y + 110],
                     [xs[4], PATH_Y]], float)


def _path_after():
    return np.array([[STATIONS[0], PATH_Y], [STATIONS[-1], PATH_Y]], float)


def _morph(a, b, k, n=120):
    ra, rb = resample(a, 1), resample(b, 1)
    ia = np.linspace(0, len(ra) - 1, n).astype(int)
    ib = np.linspace(0, len(rb) - 1, n).astype(int)
    return ra[ia] * (1 - k) + rb[ib] * k


@scene("S03-2")
def s03_2(s):
    ctx, st = s.ctx, s.st
    bc = s.bc
    ex = s.exit(0.6)
    imp = ease_in_out(prog(bc, s.ev("improve") + 0.8, s.ev("improve") + 2.2))
    path = _morph(_path_before(), _path_after(), imp)
    sketch.stroke(ctx, path, prog(bc, 8.2, 9.5), st.dim if imp < 1 else st.acc, 2.4, ex, rough=0)
    for i, x in enumerate(STATIONS):
        a = ex * ease_out(prog(bc, 8.0 + i * 0.2, 8.8 + i * 0.2))
        sketch.stroke(ctx, line_pts(x - 60, 640, x + 60, 640), 1, st.line, 2.4, a, rough=0)
        for dx in (-50, 50):
            sketch.stroke(ctx, line_pts(x + dx, 640, x + dx, 690), 1, st.line, 2.0, a, rough=0)
        arm = 0.2
        if i == 2:
            arm = 0.2 + 0.8 * ease_in_out(prog(bc, s.ev("improve") - 0.5, s.ev("improve") + 0.3))
        props.figure(ctx, x - 20, 632, 58, st.line, a, facing=1, pose="stand", t=1.0 if a > 0.99 else a,
                     key=f"w3{i}", arm=arm)
        # 工序卡落到工位上方
        cb = s.ev("cards") + i * 0.5
        k = ease_out(prog(bc, cb, cb + 0.7))
        if k > 0:
            y = lerp(250, 360, k)
            props.card(ctx, x - 70, y, 140, 86, STEPS[i], st.line, ex * k, fill=(0.05, 0.05, 0.05, 0.6),
                       title_size=30, font_key="serif")
            if i == 2:
                ik = ease_out(prog(bc, s.ev("improve"), s.ev("improve") + 0.8))
                sketch.stroke(ctx, np.array([[x - 50, y + 72], [x - 10, y + 62], [x + 40, y + 74]]), ik, st.red, 3.2,
                              ex, rough=0)
                sketch.ring(ctx, x + 56, y + 8, 14, st.red, 2.6, ex * ik)
                if ik > 0:
                    draw_text(ctx, "改进", x + 56, y - 22, 26, (*st.red[:3], ex * ik), key="serif", align="center")
    # 计时器：每拍走一格
    sw = ease_out(prog(bc, 9.5, 10.5))
    props.stopwatch(ctx, 1640, 250, 64, (math.floor(bc) + ease_out(bc % 1.0 * 4)) * math.pi / 6, st.line, st.red,
                    ex * sw, t=sw)
    a = ex * ease_out(prog(bc, 16.8, 17.6))
    draw_text(ctx, "工序重排后：一条顺路", 1080, 880, 28, (*st.acc[:3], a), key="serif", align="center")


@scene("S03-3")
def s03_3(s):
    ctx, st = s.ctx, s.st
    bc = s.bc
    ex = s.exit(0.6)
    # 工序卡叠起合拢成书
    k = ease_in_out(prog(bc, 20.0, s.ev("book")))
    for i, x in enumerate(STATIONS):
        cx = lerp(x - 70, 760 + i * 4, k)
        cy = lerp(360, 300 + i * 4, k)
        props.card(ctx, cx, cy, lerp(140, 380, k), lerp(86, 500, k), STEPS[i] if k < 0.3 else "", st.dim,
                   ex * (1 - k) * 0.9 + 0.1 * (1 - k))
    b = prog(bc, s.ev("book"), s.ev("book") + 1.2)
    props.book(ctx, 760, 300, 380, 500, st.line, ex, t=b)
    if b >= 1:
        a = ex * ease_out(prog(bc, s.ev("book") + 1.0, s.ev("book") + 1.8))
        for j, line in enumerate(("THE PRINCIPLES", "OF SCIENTIFIC", "MANAGEMENT")):
            draw_text(ctx, line, 960, 420 + j * 52, 36, (*st.line[:3], a), key="serif", align="center")
        draw_text(ctx, "FREDERICK WINSLOW TAYLOR", 960, 640, 17, (*st.dim[:3], a), key="serif", align="center",
                  tracking=0.04)
        sketch.stroke(ctx, line_pts(860, 560, 1060, 560), a, st.line, 1.4, a, rough=0)
    an = ease_out(prog(bc, s.ev("anchor"), s.ev("anchor") + 0.8))
    draw_text(ctx, "1911", 1420, 520, 150, (*st.line[:3], ex * an), key="serif_bold", align="center")
    draw_text(ctx, "《科学管理原理》出版", 1420, 600, 40, (*st.line[:3], ex * an), key="serif", align="center")
    draw_text(ctx, "管理知识开始被系统讨论", 1420, 660, 26, (*st.dim[:3], ex * ease_out(prog(bc, 24.0, 25.0))),
              key="serif", align="center")
    sketch.stroke(ctx, line_pts(1260, 548, 1580, 548), an, st.red, 3.0, ex, rough=0)


ORG = [(1080, 300), (820, 470), (1340, 470), (700, 640), (940, 640), (1220, 640), (1460, 640)]
ORG_EDGES = [(0, 1), (0, 2), (1, 3), (1, 4), (2, 5), (2, 6)]


@scene("S03-4")
def s03_4(s):
    ctx, st = s.ctx, s.st
    bc = s.bc
    ex = s.exit(0.6)
    k = ease_in_out(prog(bc, s.ev("org") - 1.5, s.ev("org")))
    d = ease_in_out(prog(bc, s.ev("desk"), s.ev("desk") + 1.5))
    # 工序节点（一行）→ 组织树
    line_nodes = [(560 + i * 180, 700) for i in range(7)]
    nodes = [(lerp(a[0], b[0], k), lerp(a[1], b[1], k)) for a, b in zip(line_nodes, ORG)]
    # 组织树缩小到桌面上的一张纸
    paper_c = (1180, 520)
    sc = lerp(1.0, 0.34, d)
    nodes = [(paper_c[0] + (x - 1080) * sc + (0 if d == 0 else 0), paper_c[1] + (y - 470) * sc) if d > 0 else (x, y)
             for x, y in nodes]
    if k < 1:
        for i in range(6):
            sketch.stroke(ctx, line_pts(*nodes[i], *nodes[i + 1]), prog(bc, 28.0, 29.0), st.dim, 2.0, ex * (1 - k),
                          rough=0)
    if k > 0:
        for a_, b_ in ORG_EDGES:
            (x0, y0), (x1, y1) = nodes[a_], nodes[b_]
            ym = (y0 + y1) / 2
            sketch.stroke(ctx, np.array([[x0, y0], [x0, ym], [x1, ym], [x1, y1]]), k, st.line, 2.0 * lerp(1, 0.6, d),
                          ex, rough=0)
    for i, (x, y) in enumerate(nodes):
        w, h = 150 * sc, 58 * sc
        sketch.box(ctx, x - w / 2, y - h / 2, w, h, st.line if i else st.red, ex * ease_out(prog(bc, 28.0, 28.8)),
                   2.0 * lerp(1, 0.6, d), fill_color=(0.05, 0.05, 0.05), fill_alpha=0.85, r=6 * sc)
    # 顾问工作桌（俯视）
    if d > 0:
        a = ex * d
        sketch.stroke(ctx, rect_pts(620, 250, 1120, 560, 18), d, st.line, 2.4, ex, rough=0.6, key="desk")
        sketch.stroke(ctx, rect_pts(paper_c[0] - 220, paper_c[1] - 150, 440, 300, 3), d, st.line, 1.8, a, rough=0)
        for j in range(3):  # 笔记本与资料
            ox, oy = 700 + j * 26, 320 + j * 18
            sketch.stroke(ctx, rect_pts(ox, oy, 230, 300, 3), d, st.dim, 1.6, a, rough=0)
        for j in range(6):
            sketch.stroke(ctx, line_pts(760, 420 + j * 26, 900, 420 + j * 26), d, st.dim, 1.2, a * 0.8, rough=0)
        sketch.ring(ctx, 1580, 360, 56, st.dim, 1.8, a)          # 茶盏
        sketch.ring(ctx, 1580, 360, 40, st.dim, 1.2, a * 0.6)
        sketch.stroke(ctx, line_pts(1480, 640, 1640, 560), d, st.acc, 3.0, a, rough=0)   # 笔
        a2 = ex * ease_out(prog(bc, 36.5, 37.5))
        draw_text(ctx, "顾问工作桌", 1180, 870, 30, (*st.dim[:3], a2), key="serif", align="center")
