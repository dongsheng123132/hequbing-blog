"""04 略 · 现代咨询：研究资料 → 会议桌上的取舍 → 增长份额矩阵 → 战略连线化为线路。

机构名称只在时间轴上作历史说明（H2/H3/H4），不出现 Logo。
增长份额矩阵按 BCG 1970 原文与经典画法：纵轴市场增长率，横轴相对市场份额（高在左）；
左上明星、右上问题、左下现金牛、右下瘦狗。气泡为抽象示意，无数据。
"""
import math

import numpy as np

from ..visuals import props, sketch
from ..visuals.core import bezier, circle_pts, ease_in_out, ease_out, lerp, line_pts, prog, rect_pts
from ..visuals.text import draw_text
from .base import scene


def _doc(ctx, st, cx, cy, ang, kind, a, t=1.0):
    ctx.save()
    ctx.translate(cx, cy)
    ctx.rotate(ang)
    w, h = 200, 260
    sketch.box(ctx, -w / 2, -h / 2, w, h, st.line, a, 2.0, fill_color=(0.2, 0.21, 0.22), fill_alpha=0.9, r=4, t=t)
    if t >= 1:
        if kind == "bars":
            for i, v in enumerate((0.3, 0.55, 0.45, 0.8)):
                sketch.box(ctx, -70 + i * 38, 80 - 140 * v, 26, 140 * v, st.acc, a, 1.8, r=2)
        elif kind == "line":
            pts = np.array([[-80, 60], [-40, 20], [0, 36], [40, -30], [80, -50]], float)
            sketch.stroke(ctx, pts, 1, st.acc, 2.4, a, rough=0)
            sketch.stroke(ctx, line_pts(-85, 80, 85, 80), 1, st.dim, 1.4, a, rough=0)
        elif kind == "table":
            for i in range(6):
                sketch.stroke(ctx, line_pts(-80, -80 + i * 32, 80, -80 + i * 32), 1, st.dim, 1.2, a, rough=0)
            for j in range(3):
                sketch.stroke(ctx, line_pts(-80 + j * 60, -80, -80 + j * 60, 80), 1, st.dim, 1.2, a, rough=0)
        elif kind == "notes":
            for i in range(8):
                sketch.stroke(ctx, line_pts(-80, -90 + i * 24, 80 - (i % 3) * 30, -90 + i * 24), 1, st.dim, 1.4, a,
                              rough=0)
        elif kind == "pie":
            sketch.ring(ctx, 0, 0, 70, st.acc, 2.2, a)
            for ang2 in (0.0, 2.1, 3.9):
                sketch.stroke(ctx, line_pts(0, 0, 70 * math.cos(ang2), 70 * math.sin(ang2)), 1, st.acc, 1.8, a, rough=0)
        elif kind == "map":
            for i in range(3):
                for j in range(3):
                    sketch.box(ctx, -80 + i * 56, -90 + j * 62, 46, 50, st.dim, a, 1.4, r=3)
    ctx.restore()


DOCS = [("notes", -0.30), ("table", -0.16), ("bars", -0.02), ("line", 0.12), ("pie", 0.26), ("map", 0.40)]


@scene("S04-1")
def s04_1(s):
    ctx, st = s.ctx, s.st
    bc = s.bc
    ex = s.exit(0.6)
    for i, (kind, ang) in enumerate(DOCS):
        b = s.ev("docs") + i * 0.45
        k = ease_out(prog(bc, b, b + 0.8))
        if k <= 0:
            continue
        # 从上方落下，落到扇形位置
        cx = 1120 + math.sin(ang) * 520
        cy = 820 - math.cos(ang) * 400
        cy = lerp(cy - 260, cy, k)
        _doc(ctx, st, cx, cy, ang * k, kind, ex * k)
    a = ex * ease_out(prog(bc, 5.5, 6.5))
    draw_text(ctx, "研究 · 访谈 · 数据", 1120, 870, 30, (*st.line[:3], a), key="serif", align="center")


OPTIONS = ["方向一", "方向二", "方向三", "方向四", "方向五"]


@scene("S04-2")
def s04_2(s):
    ctx, st = s.ctx, s.st
    bc = s.bc
    ex = s.exit(0.6)
    t = prog(bc, 8.0, 9.5)
    sketch.stroke(ctx, rect_pts(700, 300, 800, 420, 120), t, st.line, 2.6, ex, rough=0.6, key="table4")
    for i, (x, y) in enumerate(((820, 250), (1100, 240), (1380, 250), (820, 770), (1100, 780), (1380, 770))):
        sketch.ring(ctx, x, y, 30, st.dim, 2.0, ex * ease_out(prog(bc, 8.5 + i * 0.15, 9.3 + i * 0.15)))
    # 中央问题卡：翻面
    fl = prog(bc, s.ev("flip"), s.ev("flip") + 0.8)
    sx = abs(math.cos(fl * math.pi))
    text = "怎样做得更快？" if fl < 0.5 else "应该做什么？"
    ctx.save()
    ctx.translate(1100, 420)
    ctx.scale(max(0.02, sx), 1.0)
    a = ex * ease_out(prog(bc, 9.0, 9.8))
    sketch.box(ctx, -190, -48, 380, 96, st.acc if fl >= 0.5 else st.line, a, 2.4, fill_color=(0.2, 0.21, 0.22),
               fill_alpha=0.95, r=10)
    draw_text(ctx, text, 0, 0, 40, (*st.line[:3], a), key="serif_bold", align="center", valign="middle")
    ctx.restore()
    # 五张选项卡：保留两张，划去一张
    keep = ease_out(prog(bc, s.ev("keep"), s.ev("keep") + 0.8))
    drop = prog(bc, s.ev("drop"), s.ev("drop") + 0.7)
    for i, lab in enumerate(OPTIONS):
        k = ease_out(prog(bc, 10.5 + i * 0.3, 11.2 + i * 0.3))
        if k <= 0:
            continue
        x = 760 + i * 140
        y = 560
        col = st.line
        if i in (1, 3):
            y -= 26 * keep
            col = st.acc if keep > 0.5 else st.line
        a = ex * k
        if i == 4 and drop >= 1:
            a *= 1 - ease_in_out(prog(bc, s.ev("drop") + 1.0, s.ev("drop") + 2.0))
            x += 120 * ease_in_out(prog(bc, s.ev("drop") + 1.0, s.ev("drop") + 2.0))
        sketch.box(ctx, x, y, 120, 70, col, a, 2.0, fill_color=(0.2, 0.21, 0.22), fill_alpha=0.9, r=8)
        draw_text(ctx, lab, x + 60, y + 35, 26, (*col[:3], a), key="serif", align="center", valign="middle")
        if i == 4 and drop > 0:
            sketch.stroke(ctx, line_pts(x - 8, y + 58, x + 128, y + 12), drop, st.red, 4.0, a, rough=0)
            draw_text(ctx, "放弃", x + 60, y + 108, 28, (*st.red[:3], a * ease_out(drop)), key="serif", align="center")
    a = ex * ease_out(prog(bc, 15.2, 16.0))
    for i in (1, 3):
        draw_text(ctx, "保留", 760 + i * 140 + 60, 560 - 26 * keep + 100, 24, (*st.acc[:3], a), key="serif",
                  align="center")


MX, MY, MW, MH = 820, 230, 680, 560
from ..storyboard import by_id as _by_id
_S043 = _by_id()["S04-3"]


@scene("S04-3")
def s04_3(s):
    draw_matrix(s, s.exit(0.3))


def draw_matrix(s, ex, force=False):
    ctx, st = s.ctx, s.st
    bc = s.bc if not force else 99.0
    EV = _S043.events.__getitem__
    ax = prog(bc, EV("axes"), EV("axes") + 1.2)
    sketch.arrow(ctx, np.array([[MX, MY + MH], [MX, MY - 20]]), ax, st.line, 2.6, ex, head=14, rough=0)
    sketch.stroke(ctx, np.array([[MX, MY + MH], [MX + MW + 20, MY + MH]]), ax, st.line, 2.6, ex, rough=0)
    a = ex * ease_out(prog(bc, EV("axes") + 0.8, EV("axes") + 1.6))
    # 纵轴：市场增长率（上高下低）
    ctx.save()
    ctx.translate(MX - 46, MY + MH / 2)
    ctx.rotate(-math.pi / 2)
    draw_text(ctx, "市场增长率", 0, 0, 30, (*st.line[:3], a), key="serif", align="center", valign="middle")
    ctx.restore()
    draw_text(ctx, "高", MX - 20, MY + 16, 24, (*st.dim[:3], a), key="sans", align="right")
    draw_text(ctx, "低", MX - 20, MY + MH - 4, 24, (*st.dim[:3], a), key="sans", align="right")
    # 横轴：相对市场份额（经典画法：高在左）
    draw_text(ctx, "高  ←  相对市场份额  →  低", MX + MW / 2, MY + MH + 46, 30, (*st.line[:3], a), key="serif",
              align="center")
    # 象限
    q = prog(bc, EV("quads"), EV("quads") + 1.2)
    sketch.stroke(ctx, line_pts(MX + MW / 2, MY, MX + MW / 2, MY + MH), q, st.dim, 2.0, ex, rough=0, dash=[8, 6])
    sketch.stroke(ctx, line_pts(MX, MY + MH / 2, MX + MW, MY + MH / 2), q, st.dim, 2.0, ex, rough=0, dash=[8, 6])
    names = [("明星", MX + MW * 0.25, MY + MH * 0.25), ("问题", MX + MW * 0.75, MY + MH * 0.25),
             ("现金牛", MX + MW * 0.25, MY + MH * 0.75), ("瘦狗", MX + MW * 0.75, MY + MH * 0.75)]
    for i, (n, x, y) in enumerate(names):
        k = ease_out(prog(bc, EV("quads") + 0.6 + i * 0.6, EV("quads") + 1.2 + i * 0.6))
        draw_text(ctx, n, x, y - 70, 36, (*st.line[:3], ex * k), key="serif_bold", align="center")
    # 抽象业务气泡（示意）
    bubbles = [(0.2, 0.3, 34), (0.35, 0.18, 22), (0.68, 0.3, 26), (0.82, 0.22, 16), (0.22, 0.72, 44),
               (0.38, 0.66, 20), (0.7, 0.78, 18), (0.86, 0.68, 14)]
    for i, (u, v, r) in enumerate(bubbles):
        k = ease_out(prog(bc, EV("bubbles") + i * 0.2, EV("bubbles") + 0.6 + i * 0.2))
        sketch.ring(ctx, MX + MW * u, MY + MH * v + 20, r * k, st.acc, 2.2, ex * k)
    k = ease_out(prog(bc, EV("bubbles") + 2.0, EV("bubbles") + 3.0))
    if k > 0:
        src = (MX + MW * 0.22, MY + MH * 0.72 + 20)
        dst = (MX + MW * 0.68, MY + MH * 0.30 + 20)
        sketch.arrow(ctx, bezier(src, (src[0] + 120, src[1] - 40), (dst[0] - 160, dst[1] + 140), dst, 40), k, st.red,
                     2.6, ex, head=12, rough=0, dash=[10, 6])
        draw_text(ctx, "资金投向", MX + MW * 0.5 + 20, MY + MH * 0.5 + 60, 24, (*st.red[:3], ex * k), key="serif",
                  align="center")
    a2 = ex * ease_out(prog(bc, 21.5, 22.5))
    draw_text(ctx, "增长份额矩阵", 1640, 300, 34, (*st.line[:3], a2), key="serif_bold", align="center")
    draw_text(ctx, "BCG · 1968—1970", 1640, 344, 24, (*st.dim[:3], a2), key="sans", align="center")
    draw_text(ctx, "气泡为示意，无数据", 1640, 800, 24, (*st.dim[:3], a2), key="sans", align="center")


@scene("S04-4")
def s04_4(s):
    ctx, st = s.ctx, s.st
    bc = s.bc
    ex = s.exit(0.5)
    k = ease_in_out(prog(bc, 32.0, s.ev("circuit")))
    # 矩阵框线淡出，连线被拉直、折成直角
    a0 = 1 - k
    draw_matrix(s, ex * a0, force=True)
    rng = np.random.default_rng(7)
    for i in range(9):
        y = 260 + i * 66
        x0 = 560
        xs = [x0, 760 + rng.integers(0, 200), 1100 + rng.integers(0, 200), 1440 + rng.integers(0, 160), 1760]
        dy = rng.choice([-33, 33])
        curved = bezier((x0, y), (900, y + dy * 3), (1300, y - dy * 3), (1760, y), 40)
        straight = np.array([[xs[0], y], [xs[1], y], [xs[1], y + dy], [xs[2], y + dy], [xs[2], y], [xs[3], y],
                             [xs[3], y + dy], [xs[4], y + dy]], float)
        from .ch03 import _morph
        p = _morph(curved, straight, k, 160)
        t = prog(bc, 32.0 + i * 0.12, 34.5 + i * 0.12)
        sketch.stroke(ctx, p, t, st.acc if i % 3 == 0 else st.line, 2.0, ex, rough=0)
        if k > 0.7:
            for x in xs[1:4]:
                sketch.dot(ctx, x, y, 5, st.line, ex * ease_out(prog(k, 0.7, 1.0)))
    a = ex * ease_out(prog(bc, 35.0, 36.0))
    draw_text(ctx, "连线 → 线路", 1160, 880, 30, (*st.line[:3], a), key="serif", align="center")
