"""00 问 · 序章：一条白线从商路折成流水线，再变成现代经营流程。"""
import numpy as np

from ..visuals import motifs, props, sketch
from ..visuals.core import bezier, circle_pts, ease_in_out, ease_out, line_pts, prog
from ..visuals.text import draw_text
from .base import scene

ROAD = bezier((540, 560), (650, 660), (770, 430), (900, 520), 60)
CONVEYOR = line_pts(900, 520, 1300, 520, 20)
TO_B1 = line_pts(1300, 520, 1330, 520)
B1 = np.array([[1330, 520], [1330, 488], [1420, 488], [1420, 552], [1330, 552], [1330, 520]], float)
TO_B2 = line_pts(1420, 520, 1470, 520)
B2 = np.array([[1470, 520], [1470, 488], [1560, 488], [1560, 552], [1470, 552], [1470, 520]], float)
TO_NODE = line_pts(1560, 520, 1634, 520)
NODE = circle_pts(1650, 520, 16, 40, a0=180)
MAIN = [ROAD, CONVEYOR, TO_B1, B1, TO_B2, B2, TO_NODE, NODE]
NODE_XY = (1650, 520)

QUESTIONS = [("q1", "路怎么走", (720, 372)), ("q2", "人怎么组织", (1100, 392)),
             ("q3", "客户在哪里", (1445, 432)), ("q4", "下一步怎么选", (1650, 628))]


def _shift(ctx, dx):
    ctx.save()
    ctx.translate(dx, 0)


def draw_journey(s, main_t, detail_a=1.0, early_a=1.0, labels=True):
    st, ctx = s.st, s.ctx
    # 主线：一笔画出
    lens = [float(np.sum(np.hypot(*np.diff(p, axis=0).T))) for p in MAIN]
    total, l1 = sum(lens), sum(lens[:2])
    ta = min(1.0, main_t * total / l1)
    tb = max(0.0, (main_t * total - l1) / (total - l1))
    props.seq(ctx, MAIN[:2], ta, st.line, 3.2, early_a, key="journey-a", rough=1.0)
    props.seq(ctx, MAIN[2:], tb, st.line, 3.2, 1.0, key="journey-b", rough=0.8)
    # 细节：结构线经过后补足
    bc = s.bc
    a_m = detail_a * early_a * ease_out(prog(bc, 1.2, 2.8))
    for i, r in enumerate(props.ridges(560, 900, 505, 120, "ch00", layers=2)):
        sketch.stroke(ctx, r, prog(bc, 1.2 + i * 0.3, 2.8), st.dim, 1.8, a_m, rough=0.8, key=f"ridge{i}")
    a_c = detail_a * early_a * ease_out(prog(bc, 3.2, 4.6))
    if a_c > 0:
        sketch.stroke(ctx, line_pts(900, 562, 1300, 562), prog(bc, 3.2, 4.2), st.dim, 2.0, a_c, rough=0.5, key="rail")
        for k in range(9):
            sketch.ring(ctx, 925 + k * 45, 541, 12, st.dim, 1.5, a_c * 0.8)
        drift = (bc * 22) % 80
        for k in range(5):
            x = 915 + k * 80 + drift
            if 905 < x < 1270:
                sketch.box(ctx, x, 486, 30, 30, st.line, a_c, 1.8, r=3)
        for k, x in enumerate((1010, 1190)):
            props.figure(ctx, x, 470, 34, st.line, a_c, facing=1 if k == 0 else -1, pose="stand",
                         t=prog(bc, 3.6 + k * 0.3, 4.8), key=f"worker{k}", arm=0.3)
    a_f = detail_a * ease_out(prog(bc, 4.8, 6.0))
    if a_f > 0:
        draw_text(ctx, "客户", 1375, 520, 24, (*st.line[:3], a_f), key="sans", align="center", valign="middle")
        draw_text(ctx, "订单", 1515, 520, 24, (*st.line[:3], a_f), key="sans", align="center", valign="middle")
        sketch.arrowhead(ctx, 1470, 520, 0, 10, st.line, a_f)
    if labels:
        for name, text, (x, y) in QUESTIONS:
            b = s.shot.events.get(name, dict(q1=2.0, q2=3.75, q3=5.25, q4=6.75)[name])
            a = detail_a * ease_out(prog(bc, b, b + 0.6))
            if a <= 0:
                continue
            if name == "q1":
                a *= early_a
            col = st.red if name == "q4" else st.line
            draw_text(ctx, text, x, y, 40, (*col[:3], a), key="brush", align="center")
            ty = 520 if name != "q1" else 470
            sketch.stroke(ctx, line_pts(x, y + (14 if name != "q4" else -46), x, ty + (-26 if name != "q4" else 26)),
                          1, col, 1.2, a * 0.6, rough=0, dash=[4, 5])
    if bc >= 6.75:
        k = ease_out(prog(bc, 6.75, 7.4))
        sketch.ring(ctx, NODE_XY[0], NODE_XY[1], 16 + 10 * k, st.red, 3.0, detail_a * k)


@scene("S00-1")
def s00_1(s):
    # 开场第一秒内即有明确动作：前半拍先快速画出一段商路，再匀速推进
    t = 0.08 * ease_out(prog(s.bc, 0.0, 0.6)) + 0.92 * ease_in_out(prog(s.bc, 0.3, 7.0))
    draw_journey(s, t)


BRANCHES = {
    "up": bezier((1066, 520), (1210, 520), (1250, 380), (1420, 352), 50),
    "mid": bezier((1066, 520), (1250, 520), (1320, 520), (1480, 520), 50),
    "down": bezier((1066, 520), (1210, 520), (1250, 660), (1420, 688), 50),
}


def draw_branches(s, alpha=1.0, chosen_t=None):
    st, ctx = s.st, s.ctx
    for i, (k, p) in enumerate(BRANCHES.items()):
        t = prog(s.bc, 8.4 + i * 0.25, 9.6 + i * 0.25)
        a = alpha * (0.35 if (chosen_t and chosen_t > 0 and k != "up") else 1.0)
        sketch.stroke(ctx, p, t, st.line, 2.4, a, rough=0, dash=[10, 9])
        if t >= 1:
            sketch.ring(ctx, p[-1][0], p[-1][1], 10, st.line, 2.0, a)
    if chosen_t and chosen_t > 0:
        sketch.arrow(ctx, BRANCHES["up"], chosen_t, st.red, 4.0, alpha, head=16)


@scene("S00-2")
def s00_2(s):
    ctx, st = s.ctx, s.st
    dx = -600 * ease_in_out(prog(s.bc, 8.0, 9.0))
    early = 1.0 - ease_in_out(prog(s.bc, 8.0, 8.8))
    ctx.save()
    ctx.translate(dx, 0)
    draw_journey(s, 1.0, detail_a=early, early_a=early, labels=True)
    ctx.restore()
    chosen = ease_out(prog(s.bc, s.ev("choose"), s.ev("choose") + 0.8))
    draw_branches(s, alpha=1.0, chosen_t=chosen)
    a = ease_out(prog(s.bc, 10.2, 10.9))
    draw_text(ctx, "看清下一步", 1520, 318, 48, (*st.line[:3], a), key="brush", align="center")


@scene("S00-3")
def s00_3(s):
    ctx, st = s.ctx, s.st
    # 上一镜头的所选路径收拢为片名下的朱红线
    fade = 1.0 - ease_in_out(prog(s.bc, 12.0, 12.6))
    if fade > 0:
        ctx.save()
        ctx.translate(0, 0)
        draw_branches(s, alpha=fade, chosen_t=1.0)
        ctx.restore()
    u = ease_in_out(prog(s.bc, 12.1, 12.9))
    sketch.stroke(ctx, line_pts(1080 - 380 * u, 530, 1080 + 380 * u, 530), 1, st.red, 3.0, u, rough=0)
    title = "《商业咨询进化史》"
    size = 92
    from ..visuals.text import text_width
    w = text_width(title, size, "serif_black", tracking=0.04)
    x = 1080 - w / 2
    for i, ch in enumerate(title):
        b = 12.25 + i * 0.16
        a = ease_out(prog(s.bc, b, b + 0.5))
        dy = 14 * (1 - a)
        cw = text_width(ch, size, "serif_black")
        draw_text(ctx, ch, x, 492 + dy, size, (*st.line[:3], a), key="serif_black")
        x += cw + 0.04 * size
    a = ease_out(prog(s.bc, 13.5, 14.2))
    draw_text(ctx, "从谋士到 AI，从看清局势到做出结果", 1080, 596, 38, (*st.line[:3], 0.92 * a), key="serif",
              align="center")
    motifs.draw_band(ctx, "painted", 800, 672, 800 + 560 * ease_in_out(prog(s.bc, 12.6, 14.4)), 34, st.dim,
                     alpha=0.85, width=1.8, n=None)
