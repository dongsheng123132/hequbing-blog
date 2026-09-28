"""全片 HUD：左上朱红章节印、右侧竖排阶段名、底部卷轴时间轴。

时间轴只显示已核验锚点；古代用时代名 + “约”；跨度被压缩处画断轴符号。
品牌章节中时间轴转为：诊断 → 试点 → 落地 → 复盘。
"""
import math

import numpy as np

from .. import timeline as T
from .core import clamp, ease_in_out, ease_out, lerp, prog, rgba
from . import sketch
from .seal import draw_seal
from .text import draw_text, draw_vertical, text_width

TL_Y = 1036
TL_X0, TL_X1 = 196, 1724

# (标签, 章, 点亮拍, 与前一节点之间是否断轴)
NODES = [
    ("序章", 0, 0.0, False),
    ("约 战国—秦汉", 1, 1.0, True),
    ("约 明清", 2, 1.0, True),
    ("19世纪工业化", 3, 1.0, True),
    ("1911", 3, 22.0, False),
    ("1926", 4, 1.0, True),
    ("1963", 4, 8.0, True),
    ("1968—1970", 4, 20.0, False),
    ("数字时代", 5, 1.0, True),
    ("今天", 6, 1.0, False),
]
STAGES = ["诊断", "试点", "落地", "复盘"]
STAGE_BEATS = [12.5, 15.0, 18.0, 21.0]   # 与 S07-2 事件一致


def node_x(i):
    return TL_X0 + (TL_X1 - TL_X0) * i / (len(NODES) - 1)


def _node_on(i, ch_id, bc):
    lab, c, b, _ = NODES[i]
    return (ch_id, bc) >= (c, b)


def _active_index(ch_id, bc):
    idx = 0
    for i in range(len(NODES)):
        if _node_on(i, ch_id, bc):
            idx = i
    return idx


def _activation_time(i, ch_id, bc):
    """节点点亮后经过的拍数（仅同章内有效，用于动画）。"""
    lab, c, b, _ = NODES[i]
    if c == ch_id and bc >= b:
        return bc - b
    return 99.0 if (ch_id, bc) >= (c, b) else -1.0


def draw_timeline(ctx, ch_id, bc, st, alpha=1.0):
    y = TL_Y
    col = st.line
    red = st.red
    brand = ch_id == 7
    morph = ease_in_out(prog(bc, 10.0, 12.5)) if brand else 0.0
    hist_a = alpha * (1 - morph)
    # 卷轴：两端轴头 + 纸带
    ctx.save()
    for x in (TL_X0 - 44, TL_X1 + 44):
        sketch.box(ctx, x - 5, y - 20, 10, 40, col, alpha * 0.8, 1.6, r=4)
    sketch.stroke(ctx, np.array([[TL_X0 - 38, y], [TL_X1 + 38, y]]), 1, col, 1.4, alpha * 0.45, rough=0)
    if hist_a > 0.01:
        act = _active_index(ch_id, bc)
        for i, (lab, c, b, brk) in enumerate(NODES):
            x = node_x(i)
            on = _node_on(i, ch_id, bc)
            if i > 0 and brk:
                xm = (node_x(i - 1) + x) / 2
                for dx in (-5, 5):
                    sketch.stroke(ctx, np.array([[xm + dx - 5, y + 9], [xm + dx + 5, y - 9]]), 1, col,
                                  1.6, hist_a * 0.75, rough=0)
            if i == act:
                continue
            a = hist_a * (0.85 if on else 0.32)
            sketch.dot(ctx, x, y, 4.2 if on else 3.0, col, a)
            draw_text(ctx, lab, x, y - 16, 24, (*col[:3], a), key="sans", align="center")
        # 当前节点：朱红菱形，从上一节点滑入
        x_prev = node_x(max(0, act - 1))
        t_in = _activation_time(act, ch_id, bc)
        k = ease_in_out(clamp(t_in / 1.0)) if 0 <= t_in < 1.0 else 1.0
        xa = lerp(x_prev, node_x(act), k)
        s = 9
        sketch.fill(ctx, np.array([[xa, y - s], [xa + s, y], [xa, y + s], [xa - s, y]]), red, hist_a)
        lab = NODES[act][0]
        pulse = 1 + 0.12 * math.exp(-max(0, t_in) * 3) if t_in >= 0 else 1
        draw_text(ctx, lab, node_x(act), y - 17, 30 * pulse, (*red[:3], hist_a), key="sans_bold", align="center")
    if morph > 0.01:
        xs = [TL_X0 + (TL_X1 - TL_X0) * (0.14 + 0.24 * i) for i in range(4)]
        for i, lab in enumerate(STAGES):
            on_t = bc - STAGE_BEATS[i]
            a = alpha * morph * (1.0 if on_t >= 0 else 0.35)
            colr = red if 0 <= on_t and (i == 3 or bc < STAGE_BEATS[min(3, i + 1)]) else col
            sketch.dot(ctx, xs[i], y, 5, colr, a)
            draw_text(ctx, lab, xs[i], y - 16, 30 if on_t >= 0 else 26, (*colr[:3], a), key="sans_bold", align="center")
            if i < 3:
                sketch.arrow(ctx, np.array([[xs[i] + 40, y], [xs[i + 1] - 40, y]]), 1.0, col, 1.6,
                             alpha * morph * 0.6, head=9, rough=0)
    ctx.restore()


def draw_hud(ctx, ch_id, bc, st, seal_visible=True, alpha=1.0):
    ch = T.CHAPTERS[ch_id]
    # 左上：章节印 + 章名
    if seal_visible:
        draw_seal(ctx, ch.numeral, 104, 90, 88, alpha)
    draw_text(ctx, ch.name.split("·")[0] + " · " + ch.name.split("·")[1], 166, 104, 28,
              (*st.line[:3], 0.85 * alpha), key="serif")
    # 右侧：竖排阶段名
    draw_vertical(ctx, ch.era, 1836, 132, 40, (*st.line[:3], 0.9 * alpha), key="serif")
    h = len(ch.era) * 40 * 1.08
    sketch.stroke(ctx, np.array([[1872, 132], [1872, 132 + h]]), 1, st.line, 1.2, 0.5 * alpha, rough=0)
    draw_timeline(ctx, ch_id, bc, st, alpha)


def seal_home():
    return 104, 90, 88
