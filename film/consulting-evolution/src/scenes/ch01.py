"""01 谋 · 古代谋略：议事席位与局势图 → 简策上的判断 → 筹策排布成商路节点。

器物时代适配见 historical_facts.md（A2–A5）：跪坐于席、低案、竹木简牍、算筹；不出现椅子与高桌。
人物为无面容剪影，不具名；局势图为抽象示意，不画真实地形。
"""
import math

import numpy as np

from ..visuals import props, sketch
from ..visuals.core import bezier, circle_pts, ease_in_out, ease_out, lerp, line_pts, prog, rect_pts
from ..visuals.text import draw_text
from .base import scene

MAP = (760, 190, 760, 330)   # x, y, w, h


def _routes():
    x, y, w, h = MAP
    start = (x + 70, y + h * 0.62)
    return start, [
        bezier(start, (x + 250, y + 60), (x + 420, y + 80), (x + w - 80, y + 70), 50),
        bezier(start, (x + 260, y + h * 0.55), (x + 480, y + h * 0.7), (x + w - 70, y + h * 0.5), 50),
        bezier(start, (x + 200, y + h - 20), (x + 470, y + h - 10), (x + w - 90, y + h - 60), 50),
    ]


def draw_map(s, alpha=1.0):
    ctx, st = s.ctx, s.st
    x, y, w, h = MAP
    bc = s.bc
    sketch.stroke(ctx, rect_pts(x, y, w, h, 6), prog(bc, 0.5, 2.0), st.line, 2.2, alpha, rough=0.6, key="map")
    for i, r in enumerate(props.ridges(x + 40, x + w - 40, y + h * 0.55, 110, "ch01map", layers=2)):
        sketch.stroke(ctx, r, prog(bc, 2.0 + 0.4 * i, 3.6), st.dim, 1.6, alpha, rough=0.8, key=f"mr{i}")
    rv = props.river(x + 30, y + h - 40, x + w - 30, y + h - 90, "ch01", 30)
    sketch.stroke(ctx, rv, prog(bc, 2.6, 4.0), st.acc, 2.0, alpha * 0.9, rough=0.8, key="river")
    start, routes = _routes()
    for i, r in enumerate(routes):
        sketch.arrow(ctx, r, prog(bc, 3.5 + 0.4 * i, 5.2 + 0.4 * i), st.acc, 2.4, alpha, head=12, rough=0.4,
                     key=f"route{i}")
    sketch.dot(ctx, start[0], start[1], 7, st.line, alpha * ease_out(prog(bc, 3.3, 3.8)))
    k = ease_out(prog(bc, 6.0, 6.8))
    if k > 0:
        px, py = routes[1][30]
        sketch.ring(ctx, px, py, 16, st.red, 3.0, alpha * k)
    a = alpha * ease_out(prog(bc, 1.5, 2.5))
    draw_text(ctx, "局势图 · 示意", x + w - 12, y + h + 30, 24, (*st.dim[:3], a), key="sans", align="right")


def draw_council(s, alpha=1.0):
    ctx, st = s.ctx, s.st
    bc = s.bc
    props.mat(ctx, 930, 720, 230, st.dim, alpha, t=prog(bc, 1.0, 2.2), key="mat1")
    props.mat(ctx, 1350, 720, 230, st.dim, alpha, t=prog(bc, 1.2, 2.4), key="mat2")
    props.low_table(ctx, 1140, 720, 230, st.line, alpha, t=prog(bc, 1.6, 2.8), key="table")
    props.figure(ctx, 930, 716, 150, st.line, alpha, facing=1, t=prog(bc, 1.4, 3.2), key="fig1",
                 arm=0.25 + 0.35 * ease_in_out(prog(bc, 5.5, 6.5)))
    props.figure(ctx, 1350, 716, 150, st.line, alpha, facing=-1, t=prog(bc, 1.8, 3.6), key="fig2", arm=0.1)
    # 案上：一卷简策与几根筹策
    if bc > 3.0:
        a = alpha * ease_out(prog(bc, 3.0, 4.0))
        for k in range(4):
            sketch.box(ctx, 1080 + k * 12, 664, 9, 20, st.line, a, 1.4, r=2)
        for k in range(3):
            props.rod(ctx, 1180, 668 + k * 7, 60, 0.0, st.acc, a, 3.0)


@scene("S01-1")
def s01_1(s):
    a = s.exit(0.75)
    draw_map(s, a)
    draw_council(s, a)


SLIPS = dict(x=880, y=168, n=9, w=46, h=300, gap=9)
WORDS = {6: "辨形势", 4: "权利害", 2: "定进退"}

# 七根筹策的两种排法（同一组资源，不同选择）
ROD_L = 70


def _layout_a():
    pts = []
    x, y = 700, 780
    for i in range(7):
        ang = -0.55 if i % 2 == 0 else -0.15
        cx, cy = x + math.cos(ang) * ROD_L / 2, y + math.sin(ang) * ROD_L / 2
        pts.append((cx, cy, ang))
        x, y = x + math.cos(ang) * ROD_L, y + math.sin(ang) * ROD_L
    return pts, (x, y)


def _layout_b():
    pts = []
    x, y = 700, 780
    for i in range(7):
        ang = 0.12 if i % 2 == 0 else -0.08
        cx, cy = x + math.cos(ang) * ROD_L / 2, y + math.sin(ang) * ROD_L / 2
        pts.append((cx, cy, ang))
        x, y = x + math.cos(ang) * ROD_L, y + math.sin(ang) * ROD_L
    return pts, (x, y)


def rods_state(bc, ev_a, ev_b):
    la, end_a = _layout_a()
    lb, end_b = _layout_b()
    k = ease_in_out(prog(bc, ev_b, ev_b + 1.0))
    out = []
    for i, ((xa, ya, aa), (xb, yb, ab)) in enumerate(zip(la, lb)):
        appear = ease_out(prog(bc, ev_a + i * 0.18, ev_a + i * 0.18 + 0.5))
        out.append((lerp(xa, xb, k), lerp(ya, yb, k), lerp(aa, ab, k), appear))
    return out, end_a, end_b, k


@scene("S01-2")
def s01_2(s):
    ctx, st = s.ctx, s.st
    bc = s.bc
    ex = s.exit(0.6)
    wt = {6: prog(bc, s.ev("w1"), s.ev("w1") + 0.9), 4: prog(bc, s.ev("w2"), s.ev("w2") + 0.9),
          2: prog(bc, s.ev("w3"), s.ev("w3") + 0.9)}
    hl = {2: ease_out(prog(bc, s.ev("w3") + 1.0, s.ev("w3") + 1.8))}
    props.slips(ctx, **SLIPS, color=st.line, alpha=ex, t=ease_out(prog(bc, 8.0, 9.2)), words=WORDS, word_t=wt,
                text_color=st.line, highlight=hl, red=st.red, word_size=46)
    # 筹策：同样资源，两种排法
    rods, end_a, end_b, k = rods_state(bc, s.ev("rods_a"), s.ev("rods_b"))
    for (x, y, ang, ap) in rods:
        props.rod(ctx, x, y, ROD_L - 8, ang, st.acc, ex * ap, 4.5)
    if bc >= s.ev("rods_a") + 1.2:
        a = ex * ease_out(prog(bc, s.ev("rods_a") + 1.2, s.ev("rods_a") + 1.8))
        sketch.ring(ctx, end_a[0] + 20, end_a[1] - 14, 14, st.line, 2.2, a * (1 - 0.6 * k))
        draw_text(ctx, "路径一", end_a[0] + 44, end_a[1] - 10, 26, (*st.line[:3], a * (1 - 0.6 * k)), key="serif")
    if k > 0:
        a = ex * k
        sketch.ring(ctx, end_b[0] + 22, end_b[1], 14, st.red, 2.6, a)
        draw_text(ctx, "路径二", end_b[0] + 46, end_b[1] + 9, 26, (*st.red[:3], a), key="serif")
        la, _ = _layout_a()
        ghost = np.array([[700, 780]] + [[x + math.cos(g) * ROD_L / 2, y + math.sin(g) * ROD_L / 2] for x, y, g in la])
        sketch.stroke(ctx, ghost, 1, st.dim, 1.6, a * 0.6, rough=0, dash=[6, 8])
    a = ex * ease_out(prog(bc, s.ev("rods_b") + 0.8, s.ev("rods_b") + 1.4))
    draw_text(ctx, "同样的资源，不同的选择", 1480, 868, 28, (*st.dim[:3], a), key="serif", align="center")


def route_nodes():
    return [(560, 700), (760, 610), (960, 650), (1160, 540), (1360, 580), (1560, 470), (1760, 430)]


@scene("S01-3")
def s01_3(s):
    ctx, st = s.ctx, s.st
    bc = s.bc
    rods, end_a, end_b, _ = rods_state(bc, -99, -99)
    nodes = route_nodes()
    k = ease_in_out(prog(bc, 16.0, 18.0))
    for i, ((x, y, ang, ap), (nx, ny)) in enumerate(zip(rods, nodes)):
        # 筹策立起并移到节点位置，化为节点
        cx, cy = lerp(x, nx, k), lerp(y, ny - 30, k)
        props.rod(ctx, cx, cy, lerp(ROD_L - 8, 46, k), lerp(ang, -math.pi / 2, k), st.acc, 1.0 - 0.7 * k, 4.5)
        sketch.ring(ctx, nx, ny, 12, st.line, 2.2, ease_out(prog(bc, 17.0 + i * 0.1, 18.0 + i * 0.1)))
    t = prog(bc, s.ev("nodes"), s.ev("nodes") + 2.0)
    path = np.array(nodes, float)
    smooth = np.vstack([bezier(path[i], path[i] + (70, 0), path[i + 1] - (70, 0), path[i + 1], 16)
                        for i in range(len(path) - 1)])
    sketch.stroke(ctx, smooth, t, st.line, 2.6, 1.0, rough=0.6, key="route3", tip=True)
    alt = np.vstack([bezier((960, 650), (1060, 760), (1260, 780), (1360, 700), 20),
                     bezier((1360, 700), (1460, 640), (1560, 700), (1700, 720), 20)])
    sketch.stroke(ctx, alt, prog(bc, 19.0, 20.5), st.dim, 2.0, 0.8, rough=0, dash=[8, 8])
    c = ease_out(prog(bc, s.ev("confirm"), s.ev("confirm") + 1.2))
    if c > 0:
        sketch.stroke(ctx, smooth, c, st.red, 4.0, 1.0, rough=0)
        for (nx, ny) in nodes[:max(1, int(c * len(nodes) + 0.5))]:
            sketch.dot(ctx, nx, ny, 6, st.red, 1.0)
    a = ease_out(prog(bc, 19.0, 19.8))
    draw_text(ctx, "看清选择", 1300, 300, 64, (*st.line[:3], a), key="brush", align="center")
    draw_text(ctx, "筹策 → 节点", 1300, 356, 24, (*st.dim[:3], a), key="serif", align="center")
