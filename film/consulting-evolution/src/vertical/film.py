"""竖版短片（1080×1920）：同一视觉系统，按竖屏重新组织信息与节拍，不裁切横版。

结构：问（钩子）→ 编年（谋 商 管 略 联，各一个关键画面）→ 行（策变流程：需求、审批、记录）→ 成（品牌落版）。
重要信息保持在 x 80–940、y 200–1560 之内，避开短视频平台右侧按钮与底部文案区。
"""
import math
import os
from dataclasses import dataclass, field

import cairo
import numpy as np

from . import timeline as V
from ..paths import load_config
from ..visuals import hanzi, motifs, paper, props, sketch
from ..visuals.core import (bezier, circle_pts, clamp, ease_in, ease_in_out, ease_out, lerp, line_pts, prog,
                            rect_pts)
from ..visuals.seal import draw_seal
from ..visuals.style import style_for
from ..visuals.text import draw_text, draw_vertical, text_width

W, H = V.W, V.H
STYLE_OF = {0: 0, 1: 1, 2: 6, 3: 7}      # 借用横版章节配色
MONTAGE_STYLE = {"谋": 1, "商": 2, "管": 3, "略": 4, "联": 5}


@dataclass
class VShot:
    id: str
    chapter: int
    b0: int
    b1: int
    keyword: str
    subject: str
    action: str
    sound: str
    events: dict = field(default_factory=dict)
    kw_write: tuple = None    # 章内拍：书写区间（None 表示直接完整显示）

    @property
    def f0(self):
        return V.beat_frame(self.chapter, self.b0)

    @property
    def f1(self):
        return V.beat_frame(self.chapter, self.b1)


SHOTS = [
    VShot("V0-1", 0, 0, 8, "问", "一条白线自上而下：商路 → 流水线 → 流程", "白线一笔画下，沿线标出经营问题",
          "笔触、低鼓、笛声", {"q1": 2.0, "q2": 4.0, "q3": 6.0}, (0.5, 3.5)),
    VShot("V0-2", 0, 8, 16, "问", "分岔与片名", "三条路径展开，一条被朱红确认；片名出现，第 15 拍停顿",
          "朱红确认一声钟；停顿", {"choose": 10.0, "title": 11.0}),
    VShot("V1-1", 1, 0, 8, "谋", "竹简三判断 + 筹策两种排法", "简策展开写出辨形势、权利害、定进退；筹策重排出另一条路",
          "印章冲击；竹简与筹策木声", {"w": 1.0, "rods": 4.5}, (0.5, 2.5)),
    VShot("V1-2", 1, 8, 16, "商", "算盘与“消息先行”", "算盘珠逐拍拨动；朱红消息线先于货物抵达货栈",
          "算盘珠与节拍咬合", {"bead": 9.0, "msg": 11.0}, (8.25, 10.0)),
    VShot("V1-3", 1, 16, 24, "管", "齿轮与 1911 年的书", "齿轮按拍转动，工序卡合成一本书，时间标出 1911",
          "机械节律、弦乐", {"book": 18.5}, (16.25, 18.0)),
    VShot("V1-4", 1, 24, 32, "略", "增长份额矩阵", "坐标轴与四象限依次画出，抽象气泡落位",
          "象限落位短音", {"axes": 25.0, "quads": 26.5}, (24.25, 26.0)),
    VShot("V1-5", 1, 32, 44, "联", "系统连上了，询盘仍卡住", "五个系统连通，一条询盘卡在资料查找与报价准备之间",
          "数据触发声；悬置和弦", {"connect": 33.5, "stuck": 39.0}, (32.25, 34.0)),
    VShot("V2-1", 2, 0, 12, "行", "竹简变流程（竖排六个节点）", "六枚竹简落下并逐枚翻为流程卡，审批节点朱红",
          "六声拨弦组成主题", {"flip0": 3.0}, (0.5, 3.0)),
    VShot("V2-2", 2, 12, 24, "行", "补齐需求：字段、待确认、资料来源", "字段逐项抽出，交期与认证标为待确认，连到授权资料",
          "数据触发声", {"extract": 13.0, "pending": 17.0, "sources": 19.0}),
    VShot("V2-3", 2, 24, 36, "行", "人工审批门与异常分支", "价格、交期、对外发送须人工确认；缺认证资料退回；审批印章落下",
          "审批印章与钟声同步", {"exception": 27.0, "approve": 30.0}),
    VShot("V2-4", 2, 36, 48, "行", "记录与复盘；有判断 · 能执行 · 可检验", "记录逐行写入，回路带回需求环节；三组词落下",
          "轻打字声；三记重拍", {"log": 36.5, "p1": 42.0, "p2": 44.0, "p3": 46.0}),
    VShot("V3-1", 3, 0, 12, "成", "母题收拢为闭环与印记", "筹策、账册、工序、矩阵、数据路径收拢成环，印记落定，品牌名出现",
          "舒展长音；印章", {"seal": 8.0, "brand": 3.0}, (0.75, 4.0)),
    VShot("V3-2", 3, 12, 24, "成", "四项服务", "经营诊断、增长战略、AI落地、陪伴复盘依次展开",
          "弦乐长音", {"v1": 12.5, "v2": 14.5, "v3": 16.5, "v4": 18.5}),
    VShot("V3-3", 3, 24, 44, "成", "品牌落版", "印记第 25 拍落定，第 26 拍起静止可读至片尾（7.2 秒）",
          "笛与钟回到开头", {"seal": 25.0, "hold": 26.0}),
]

# 竖版旁白：直接复用横版锁定的配音 take（不重新合成）
NARRATION = [("N00a", 0, 1), ("N00b", 0, 8), ("N01d", 1, 1), ("N02c", 1, 9), ("N03c", 1, 16), ("N04a", 1, 25),
             ("N05b", 1, 33), ("N06a", 2, 1), ("N06c", 2, 13), ("N06d", 2, 25), ("N06e", 2, 37), ("N07a", 3, 2),
             ("N07c", 3, 13), ("N07d", 3, 27)]


def seal_events():
    return [(1, 0, "chapter1", 0.6), (2, 0, "chapter2", 0.8), (3, 0, "chapter3", 0.9), (2, 30.0, "approve", 0.85),
            (3, 8.0, "brand_ring", 0.6), (3, 25.0, "brand_final", 0.8)]


def shot_at(frame):
    for s in SHOTS:
        if s.f0 <= frame < s.f1:
            return s
    return SHOTS[-1]


class VS:
    def __init__(self, ctx, st, shot, frame):
        self.ctx, self.st, self.shot, self.f = ctx, st, shot, frame
        self.ch = shot.chapter
        self.bc = (frame - V.chapter_start_frame(self.ch)) / V.CHAPTERS[self.ch].frames_per_beat

    def p(self, a, b):
        return prog(self.bc, a, b)

    def ev(self, k):
        return self.shot.events[k]

    def exit(self, beats=0.5):
        return 1 - ease_in_out(prog(self.bc, self.shot.b1 - beats, self.shot.b1))


def _style(shot):
    if shot.chapter == 1:
        return style_for(MONTAGE_STYLE[shot.keyword])
    return style_for(STYLE_OF[shot.chapter])


DARK = (0.08, 0.12, 0.13)


# ───────────── V0 问 ─────────────
VPATH = [bezier((540, 560), (380, 640), (720, 720), (540, 820), 50), line_pts(540, 820, 540, 1060, 20),
         np.array([[540, 1060], [480, 1060], [480, 1120], [600, 1120], [600, 1060], [540, 1060]], float),
         line_pts(540, 1120, 540, 1180),
         np.array([[540, 1180], [480, 1180], [480, 1240], [600, 1240], [600, 1180], [540, 1180]], float),
         line_pts(540, 1240, 540, 1300), circle_pts(540, 1316, 16, 40, a0=-90)]


def v0_1(s):
    ctx, st = s.ctx, s.st
    t = 0.1 * ease_out(s.p(0, 0.6)) + 0.9 * ease_in_out(s.p(0.3, 7.0))
    props.seq(ctx, VPATH, t, st.line, 3.4, 1.0, key="vpath", rough=0.8)
    for i, r in enumerate(props.ridges(380, 720, 700, 100, "v0", layers=2)):
        sketch.stroke(ctx, r, s.p(1.0 + 0.3 * i, 2.5), st.dim, 1.8, 1.0, rough=0.8, key=f"vr{i}")
    a = ease_out(s.p(3.0, 4.2))
    for k in range(5):
        sketch.ring(ctx, 520, 860 + k * 44, 11, st.dim, 1.5, a)
        sketch.box(ctx, 556, 846 + k * 44, 26, 26, st.line, a, 1.6, r=3)
    b = ease_out(s.p(5.0, 6.0))
    draw_text(ctx, "客户", 540, 1090, 26, (*st.line[:3], b), key="sans", align="center", valign="middle")
    draw_text(ctx, "订单", 540, 1210, 26, (*st.line[:3], b), key="sans", align="center", valign="middle")
    for name, text, (x, y) in (("q1", "路怎么走", (820, 700)), ("q2", "人怎么组织", (820, 940)),
                               ("q3", "客户在哪里", (820, 1150))):
        k = ease_out(s.p(s.ev(name), s.ev(name) + 0.6))
        draw_text(ctx, text, x, y, 44, (*st.line[:3], k), key="brush", align="center")
    k = ease_out(s.p(6.8, 7.5))
    sketch.ring(ctx, 540, 1316, 26, st.red, 3, k)
    draw_text(ctx, "下一步怎么选", 820, 1330, 44, (*st.red[:3], k), key="brush", align="center")


def v0_2(s):
    ctx, st = s.ctx, s.st
    up = 700 * ease_in_out(s.p(8.0, 9.0))
    ctx.save()
    ctx.translate(0, -up * 0.55)
    early = 1 - ease_in_out(s.p(8.0, 8.8))
    props.seq(ctx, VPATH, 1.0, st.line, 3.4, early, key="vpath", rough=0.8)
    ctx.restore()
    node = (540, 1316 - up * 0.55)
    ends = [(300, 1260), (540, 1300), (780, 1260)]
    ch = ease_out(s.p(s.ev("choose"), s.ev("choose") + 0.8))
    fade = 1 - ease_in_out(s.p(11.0, 11.8))
    for i, e in enumerate(ends):
        p = bezier(node, (node[0], node[1] + 200), (e[0], e[1] - 200), e, 40)
        a = (0.35 if (ch > 0 and i != 2) else 1.0) * fade
        sketch.stroke(ctx, p, s.p(8.5 + 0.2 * i, 9.6 + 0.2 * i), st.line, 2.4, a, rough=0, dash=[10, 8])
        if i == 2 and ch > 0:
            sketch.arrow(ctx, p, ch, st.red, 4.0, fade, head=16)
    u = ease_in_out(s.p(11.0, 11.8))
    sketch.stroke(ctx, line_pts(540 - 400 * u, 1010, 540 + 400 * u, 1010), 1, st.red, 3, u, rough=0)
    size = 76
    title = "《商业咨询进化史》"
    w = text_width(title, size, "serif_black")
    x = 540 - w / 2
    for i, c in enumerate(title):
        b = s.ev("title") + i * 0.18
        a = ease_out(s.p(b, b + 0.5))
        cw = text_width(c, size, "serif_black")
        draw_text(ctx, c, x, 980 + 12 * (1 - a), size, (*st.line[:3], a), key="serif_black")
        x += cw
    a = ease_out(s.p(12.8, 13.6))
    draw_text(ctx, "从谋士到 AI", 540, 1090, 40, (*st.line[:3], a), key="serif", align="center")
    draw_text(ctx, "从看清局势到做出结果", 540, 1150, 40, (*st.line[:3], a), key="serif", align="center")
    motifs.draw_band(ctx, "painted", 340, 1230, 340 + 400 * ease_in_out(s.p(12.0, 14.0)), 34, st.dim, 0.85, 1.8)


# ───────────── V1 编年 ─────────────
def v1_1(s):
    ctx, st = s.ctx, s.st
    ex = s.exit()
    words = {5: "辨形势", 3: "权利害", 1: "定进退"}
    wt = {5: s.p(1.0, 1.8), 3: s.p(2.2, 3.0), 1: s.p(3.4, 4.2)}
    props.slips(ctx, 250, 600, 7, 64, 380, 12, st.line, ex, t=ease_out(s.p(0.3, 1.2)), words=words, word_t=wt,
                text_color=st.line, word_size=56, highlight={1: ease_out(s.p(4.4, 5.0))}, red=st.red)
    k = ease_in_out(s.p(s.ev("rods") + 1.2, s.ev("rods") + 2.2))
    for i in range(7):
        ap = ease_out(s.p(s.ev("rods") + i * 0.12, s.ev("rods") + i * 0.12 + 0.4))
        ang_a = -0.6 if i % 2 == 0 else -0.2
        ang_b = 0.12 if i % 2 == 0 else -0.08
        xa = 220 + sum(math.cos(-0.6 if j % 2 == 0 else -0.2) * 80 for j in range(i))
        ya = 1400 + sum(math.sin(-0.6 if j % 2 == 0 else -0.2) * 80 for j in range(i))
        xb = 220 + sum(math.cos(0.12 if j % 2 == 0 else -0.08) * 80 for j in range(i))
        yb = 1400 + sum(math.sin(0.12 if j % 2 == 0 else -0.08) * 80 for j in range(i))
        ang = lerp(ang_a, ang_b, k)
        x, y = lerp(xa, xb, k), lerp(ya, yb, k)
        props.rod(ctx, x + math.cos(ang) * 36, y + math.sin(ang) * 36, 70, ang, st.acc, ex * ap, 5)
    a = ex * ease_out(s.p(6.2, 6.9))
    draw_text(ctx, "同样的资源，不同的选择", 540, 1520, 34, (*st.dim[:3], a), key="serif", align="center")


def v1_2(s):
    ctx, st = s.ctx, s.st
    ex = s.exit()
    step = int(clamp(s.bc - s.ev("bead") + 1, 0, 4))
    from ..scenes.ch02 import BEAD_STATES
    props.abacus(ctx, 190, 590, 700, 380, st.line, ex, t=s.p(8.0, 9.0), state=BEAD_STATES[step], bead_color=st.red)
    y0 = 1260
    sketch.stroke(ctx, line_pts(200, y0, 880, y0), s.p(8.5, 9.3), st.dim, 1.4, ex, rough=0)
    props.warehouse(ctx, 200, y0 + 40, 120, 90, st.line, ex, t=s.p(8.5, 9.5), key="vwa")
    props.warehouse(ctx, 880, y0 + 40, 120, 90, st.line, ex, t=s.p(8.7, 9.7), key="vwb")
    gt = 0.4 * ease_in_out(s.p(9.5, 15.5))
    gx = lerp(260, 820, gt)
    sketch.stroke(ctx, line_pts(260, y0 + 20, gx, y0 + 20), 1, st.line, 3, ex, rough=0)
    mt = ease_in_out(s.p(s.ev("msg"), s.ev("msg") + 2.5))
    if mt > 0:
        mx = lerp(260, 820, mt)
        sketch.stroke(ctx, line_pts(260, y0 - 44, mx, y0 - 44), 1, st.red, 3, ex, rough=0, dash=[12, 8])
        props.letter(ctx, mx + 10, y0 - 66, 0.55, st.red, ex)
    a = ex * ease_out(s.p(9.5, 10.3))
    draw_text(ctx, "消息", 300, y0 - 62, 30, (*st.red[:3], a), key="serif")
    draw_text(ctx, "货物", 300, y0 + 70, 30, (*st.line[:3], a), key="serif")


def v1_3(s):
    ctx, st = s.ctx, s.st
    ex = s.exit()
    turn = max(0.0, s.bc - 16.5) * math.pi / 8
    g = ease_out(s.p(16.0, 17.0))
    props.gear(ctx, 330, 780, 130, 14, turn, st.line, ex * g, 2.4, t=g)
    props.gear(ctx, 330 + 130 + 80, 780 + 40, 80, 9, -turn * 14 / 9 + 0.2, st.acc, ex * g, 2.2, t=g)
    b = s.p(s.ev("book"), s.ev("book") + 1.0)
    props.book(ctx, 250, 1010, 300, 400, st.line, ex, t=b)
    if b >= 1:
        a = ex * ease_out(s.p(s.ev("book") + 0.8, s.ev("book") + 1.5))
        for j, ln in enumerate(("THE PRINCIPLES", "OF SCIENTIFIC", "MANAGEMENT")):
            draw_text(ctx, ln, 400, 1110 + j * 44, 28, (*st.line[:3], a), key="serif", align="center")
    an = ease_out(s.p(19.5, 20.3))
    draw_text(ctx, "1911", 760, 1200, 120, (*st.line[:3], ex * an), key="serif_bold", align="center")
    sketch.stroke(ctx, line_pts(640, 1228, 880, 1228), an, st.red, 3, ex, rough=0)
    draw_text(ctx, "《科学管理原理》", 760, 1290, 36, (*st.line[:3], ex * an), key="serif", align="center")
    draw_text(ctx, "出版", 760, 1344, 36, (*st.line[:3], ex * an), key="serif", align="center")


def v1_4(s):
    ctx, st = s.ctx, s.st
    ex = s.exit()
    mx, my, mw, mh = 200, 640, 700, 700
    ax = s.p(s.ev("axes"), s.ev("axes") + 1.0)
    sketch.arrow(ctx, np.array([[mx, my + mh], [mx, my - 20]]), ax, st.line, 2.6, ex, head=14, rough=0)
    sketch.stroke(ctx, np.array([[mx, my + mh], [mx + mw + 10, my + mh]]), ax, st.line, 2.6, ex, rough=0)
    a = ex * ease_out(s.p(s.ev("axes") + 0.6, s.ev("axes") + 1.2))
    ctx.save()
    ctx.translate(mx - 40, my + mh / 2)
    ctx.rotate(-math.pi / 2)
    draw_text(ctx, "市场增长率", 0, 0, 32, (*st.line[:3], a), key="serif", align="center", valign="middle")
    ctx.restore()
    draw_text(ctx, "高 ← 相对市场份额 → 低", mx + mw / 2, my + mh + 52, 32, (*st.line[:3], a), key="serif",
              align="center")
    q = s.p(s.ev("quads"), s.ev("quads") + 1.0)
    sketch.stroke(ctx, line_pts(mx + mw / 2, my, mx + mw / 2, my + mh), q, st.dim, 2, ex, rough=0, dash=[8, 6])
    sketch.stroke(ctx, line_pts(mx, my + mh / 2, mx + mw, my + mh / 2), q, st.dim, 2, ex, rough=0, dash=[8, 6])
    for i, (n, u, v) in enumerate((("明星", .25, .25), ("问题", .75, .25), ("现金牛", .25, .75), ("瘦狗", .75, .75))):
        k = ease_out(s.p(s.ev("quads") + 0.5 + i * 0.5, s.ev("quads") + 1.0 + i * 0.5))
        draw_text(ctx, n, mx + mw * u, my + mh * v - 60, 40, (*st.line[:3], ex * k), key="serif_bold", align="center")
    for i, (u, v, r) in enumerate(((0.2, 0.32, 36), (0.68, 0.3, 26), (0.22, 0.74, 46), (0.74, 0.8, 18))):
        k = ease_out(s.p(29.0 + i * 0.3, 29.6 + i * 0.3))
        sketch.ring(ctx, mx + mw * u, my + mh * v + 20, r * k, st.acc, 2.2, ex * k)
    a2 = ex * ease_out(s.p(25.5, 26.5))
    draw_text(ctx, "增长份额矩阵 · BCG 1968—1970 · 气泡为示意", 540, 590, 28, (*st.dim[:3], a2), key="sans",
              align="center")


VSYS = {"客户": (300, 640), "订单": (780, 640), "库存": (780, 900), "生产": (300, 900), "交付": (540, 1100)}


def v1_5(s):
    ctx, st = s.ctx, s.st
    ex = s.exit(0.3)
    lit = s.p(s.ev("connect"), s.ev("connect") + 1.2)
    fade = 1 - 0.6 * ease_in_out(s.p(38.0, 39.0))
    edges = [("客户", "订单"), ("订单", "库存"), ("库存", "生产"), ("生产", "客户"), ("生产", "交付"), ("交付", "库存")]
    for a_, b_ in edges:
        (x0, y0), (x1, y1) = VSYS[a_], VSYS[b_]
        sketch.stroke(ctx, line_pts(x0, y0, x1, y1), lit, st.acc, 2.2, ex * fade, rough=0)
    for n, (x, y) in VSYS.items():
        sketch.box(ctx, x - 90, y - 38, 180, 76, st.line, ex * fade * ease_out(s.p(32.0, 32.8)), 2.2,
                   fill_color=DARK, fill_alpha=0.95, r=10)
        draw_text(ctx, n, x, y, 34, (*st.line[:3], ex * fade), key="sans_bold", align="center", valign="middle")
    a = ex * ease_out(s.p(35.5, 36.3))
    draw_text(ctx, "连上 ≠ 变好", 540, 1250, 52, (*st.line[:3], a * fade), key="serif_bold", align="center")
    k = ease_out(s.p(s.ev("stuck") - 1.0, s.ev("stuck")))
    if k > 0:
        y = 1380
        for x, lab in ((140, "资料查找"), (700, "报价准备")):
            sketch.box(ctx, x, y - 50, 240, 100, st.line, ex * k, 2.2, fill_color=DARK, fill_alpha=0.95, r=12)
            draw_text(ctx, lab, x + 120, y, 34, (*st.line[:3], ex * k), key="sans_bold", align="center",
                      valign="middle")
        sketch.box(ctx, 430, y - 50, 220, 100, st.acc, ex * k, 2.4, fill_color=DARK, fill_alpha=0.95, r=12)
        draw_text(ctx, "客户询盘", 540, y, 32, (*st.line[:3], ex * k), key="sans_bold", align="center", valign="middle")
        blink = 0.55 + 0.45 * (1 if int(s.bc * 2) % 2 == 0 else 0)
        kk = ease_out(s.p(s.ev("stuck"), s.ev("stuck") + 0.5))
        sketch.box(ctx, 470, y + 64, 140, 48, st.red, ex * kk * blink, 2.6, r=24)
        draw_text(ctx, "待处理", 540, y + 88, 28, (*st.red[:3], ex * kk * blink), key="sans_bold", align="center",
                  valign="middle")


# ───────────── V2 行 ─────────────
PROC = ["收到询盘", "补齐需求", "报价草稿", "人工审批", "销售跟进", "记录复盘"]
APPROVAL = 3


def proc_y(i):
    return 610 + i * 138


def v2_1(s):
    ctx, st = s.ctx, s.st
    ex = s.exit()
    for i in range(6):
        land = 0.6 + i * 0.3
        k = ease_out(s.p(land - 1.0, land))
        fl = s.p(s.ev("flip0") + i * 1.2, s.ev("flip0") + i * 1.2 + 0.7)
        y = proc_y(i)
        if fl < 0.5:
            sc = 1 - fl * 2
            ctx.save()
            ctx.translate(540, lerp(-300, y + 50, k))
            ctx.rotate(math.pi / 2 * (1 - 0) - math.pi / 2 + (1 - k) * 0.4)
            ctx.scale(1, max(0.02, sc))
            # 横躺的竹简：宽 520、高 60
            sketch.box(ctx, -260, -30, 520, 60, st.line, ex * k, 2.0, r=14)
            for fx in (-0.6, 0.6):
                sketch.stroke(ctx, line_pts(260 * fx, -34, 260 * fx, 34), 1, st.line, 1.4, ex * k * 0.8, rough=0)
            draw_text(ctx, PROC[i], 0, 0, 36, (*st.line[:3], ex * k), key="brush", align="center", valign="middle")
            ctx.restore()
        else:
            sc = (fl - 0.5) * 2
            ctx.save()
            ctx.translate(540, y + 50)
            ctx.scale(1, max(0.02, sc))
            col = st.red if i == APPROVAL else st.line
            sketch.box(ctx, -300, -50, 600, 100, col, ex, 2.6 if i == APPROVAL else 2.0, fill_color=DARK,
                       fill_alpha=0.92, r=12)
            draw_text(ctx, PROC[i], 0, 0, 40, (*st.line[:3], ex), key="sans_bold", align="center", valign="middle")
            ctx.restore()
            if i < 5 and fl >= 1:
                sketch.arrow(ctx, line_pts(540, y + 104, 540, y + 134), 1, st.line, 2, ex, head=8, rough=0)
    a = ex * ease_out(s.p(8.5, 9.3))
    draw_text(ctx, "须人工判断", 880, proc_y(APPROVAL) + 60, 28, (*st.red[:3], a), key="sans_bold", align="center")
    draw_text(ctx, "流程演示 · 非客户案例", 540, 1480, 28, (*st.dim[:3], a), key="sans", align="center")


FIELDS = [("产品型号", "不锈钢法兰 DN50", True), ("数量", "2000 件", True), ("交货地", "宁波", True),
          ("交期", "—", False), ("认证要求", "—", False)]


def v2_2(s):
    ctx, st = s.ctx, s.st
    ex = s.exit()
    a = ex * ease_out(s.p(12.0, 12.8))
    sketch.box(ctx, 110, 580, 860, 190, st.line, a, 2.0, fill_color=DARK, fill_alpha=0.9, r=12)
    draw_text(ctx, "询盘原文", 140, 628, 28, (*st.dim[:3], a), key="sans_bold")
    draw_text(ctx, "您好，我们需要不锈钢法兰 DN50，", 140, 684, 32, (*st.line[:3], a), key="sans")
    draw_text(ctx, "数量 2000 件，送货到宁波。请尽快报价。", 140, 734, 32, (*st.line[:3], a), key="sans")
    draw_text(ctx, "AI 整理 ↓", 540, 818, 28, (*st.line[:3], ex * ease_out(s.p(12.6, 13.2))), key="sans_bold",
              align="center")
    sketch.box(ctx, 110, 850, 860, 330, st.line, a, 2.0, fill_color=DARK, fill_alpha=0.9, r=12)
    pend = ease_out(s.p(s.ev("pending"), s.ev("pending") + 0.6))
    for i, (lab, val, ok) in enumerate(FIELDS):
        k = ex * ease_out(s.p(s.ev("extract") + i * 0.6, s.ev("extract") + i * 0.6 + 0.5))
        y = 910 + i * 60
        draw_text(ctx, lab, 140, y, 32, (*st.line[:3], k), key="sans")
        draw_text(ctx, val, 330, y, 32, (*st.line[:3], k), key="sans")
        if ok:
            sketch.check(ctx, 920, y - 10, 18, st.line, k, width=2.6)
        elif k > 0:
            col = st.red if pend > 0 else st.line
            sketch.box(ctx, 800, y - 32, 140, 44, col, k, 2.2, r=22)
            draw_text(ctx, "待确认", 870, y - 10, 26, (*col[:3], k), key="sans_bold", align="center", valign="middle")
    sk = ex * ease_out(s.p(s.ev("sources") - 0.5, s.ev("sources") + 0.3))
    sketch.box(ctx, 110, 1220, 860, 230, st.line, sk, 2.0, fill_color=DARK, fill_alpha=0.9, r=12)
    draw_text(ctx, "授权资料（只调用经过授权的资料）", 140, 1268, 28, (*st.dim[:3], sk), key="sans_bold")
    for j, src in enumerate(("产品手册 · 第12页", "历史报价记录", "库存表")):
        draw_text(ctx, src, 160, 1330 + j * 46, 30, (*st.line[:3], sk), key="sans")
    lk = s.p(s.ev("sources"), s.ev("sources") + 1.2)
    for r_, src in ((0, 0), (0, 1), (1, 2)):
        y0 = 900 + r_ * 60
        y1 = 1320 + src * 46
        sketch.stroke(ctx, bezier((770, y0), (1010, y0), (1010, y1), (560, y1), 30), lk, st.acc, 2.0, ex, rough=0,
                      dash=[6, 5])


def v2_3(s):
    ctx, st = s.ctx, s.st
    ex = s.exit()
    appr = s.ev("approve")
    ok = s.bc >= appr
    a = ex * ease_out(s.p(24.0, 24.8))
    sketch.box(ctx, 110, 580, 520, 330, st.line, a, 2.2, fill_color=DARK, fill_alpha=0.95, r=12)
    draw_text(ctx, "报价草稿", 140, 632, 36, (*st.line[:3], a), key="sans_bold")
    rows = [("单价", "已人工确认" if ok else "待审批", not ok), ("交期", "已人工确认" if ok else "待确认", not ok),
            ("依据", "产品手册 p.12", False)]
    for i, (lab, val, red) in enumerate(rows):
        col = st.red if red else st.line
        draw_text(ctx, lab, 140, 700 + i * 60, 30, (*st.dim[:3], a), key="sans")
        draw_text(ctx, val, 230, 700 + i * 60, 30, (*col[:3], a), key="sans")
    props.gate(ctx, 820, 1000, 300, ease_in_out(s.p(appr + 0.5, appr + 1.5)), st.line, st.red, ex,
               t=s.p(24.5, 25.8))
    draw_text(ctx, "人工审批", 820, 660, 36, (*st.red[:3], ex * ease_out(s.p(25.0, 25.8))), key="sans_bold",
              align="center")
    ck = ex * ease_out(s.p(25.5, 26.3))
    sketch.box(ctx, 110, 1060, 860, 250, st.red, ck, 2.2, fill_color=DARK, fill_alpha=0.95, r=12)
    draw_text(ctx, "须人工确认", 140, 1112, 34, (*st.red[:3], ck), key="sans_bold")
    for i, it in enumerate(("价格", "交期", "对外发送")):
        x = 150 + i * 270
        sketch.box(ctx, x, 1160, 30, 30, st.line, ck, 2.0, r=3)
        draw_text(ctx, it, x + 44, 1186, 32, (*st.line[:3], ck), key="sans")
        c = ease_out(s.p(appr + 0.2 + i * 0.3, appr + 0.6 + i * 0.3))
        if c > 0:
            sketch.check(ctx, x + 15, 1175, 18, st.red, ck, t=c, width=3)
    draw_text(ctx, "AI 不自动承诺价格、付款或交期", 540, 1270, 28, (*st.dim[:3], ck), key="sans", align="center")
    exk = s.p(s.ev("exception"), s.ev("exception") + 1.2)
    path = np.array([[760, 1000], [760, 1400], [370, 1400], [370, 1330]], float)
    sketch.arrow(ctx, path, exk, st.red, 2.4, ex, head=12, rough=0, dash=[10, 7])
    draw_text(ctx, "异常：缺认证资料 → 退回补齐需求", 540, 1460, 30, (*st.red[:3], ex * ease_out(s.p(28.0, 28.8))),
              key="sans", align="center")
    sk = prog(s.bc, appr - 0.5, appr)
    if sk > 0:
        draw_seal(ctx, "确认", 530, 850, 110 * (1 + 0.6 * (1 - sk ** 2)), alpha=ex * min(1.0, sk * 3))


def v2_4(s):
    ctx, st = s.ctx, s.st
    lg = ease_out(s.p(36.0, 36.8))
    sketch.box(ctx, 110, 580, 860, 420, st.line, lg, 2.2, fill_color=DARK, fill_alpha=0.95, r=12)
    draw_text(ctx, "记录", 140, 632, 36, (*st.line[:3], lg), key="sans_bold")
    for i, ln in enumerate(("① 询盘原文与需求字段", "② 资料依据：产品手册 p.12", "③ 审批：价格、交期已人工确认",
                            "④ 发送：审批后由销售发出", "⑤ 客户反馈与后续结果")):
        k = ease_out(s.p(s.ev("log") + i * 0.7, s.ev("log") + i * 0.7 + 0.4))
        draw_text(ctx, ln, 150, 700 + i * 58, 32, (*st.line[:3], k), key="sans")
    lp = s.p(39.5, 41.0)
    sketch.arrow(ctx, np.array([[900, 1000], [900, 1060], [180, 1060], [180, 1000]], float), lp, st.red, 2.6, 1.0,
                 head=12, rough=0)
    draw_text(ctx, "复盘：高频缺失字段 → 更新询盘模板", 540, 1110, 30, (*st.red[:3], ease_out(s.p(40.5, 41.2))),
              key="sans_bold", align="center")
    for name, word, y in (("p1", "有判断。", 1230), ("p2", "能执行。", 1340), ("p3", "可检验。", 1450)):
        k = ease_out(s.p(s.ev(name), s.ev(name) + 0.6))
        draw_text(ctx, word, 540, y + 14 * (1 - k), 88, (*st.line[:3], k), key="brush", align="center")


# ───────────── V3 成 ─────────────
def v3_1(s):
    ctx, st = s.ctx, s.st
    cx, cy, r = 540, 1000, 220
    from ..scenes.ch07 import MOTIFS, _motif
    starts = [(120, 620), (960, 620), (960, 1440), (120, 1440), (540, 1500)]
    for i, (kind, name, ang) in enumerate(MOTIFS):
        k = ease_in_out(s.p(1.0 + i * 0.4, 4.0 + i * 0.4))
        tx, ty = cx + r * math.cos(math.radians(ang)), cy + r * math.sin(math.radians(ang))
        x0, y0 = starts[i]
        _motif(ctx, st, kind, lerp(x0, tx, k), lerp(y0, ty, k), ease_out(s.p(0.2 + 0.3 * i, 1.0 + 0.3 * i)))
    sketch.stroke(ctx, circle_pts(cx, cy, r, 120, a0=-90), s.p(5.0, 7.0), st.red, 3.0, 1.0, rough=0)
    sk = s.p(s.ev("seal") - 0.5, s.ev("seal"))
    if sk > 0:
        draw_seal(ctx, load_config()["brand"]["seal_text"], cx, cy, 150 * (1 + 0.6 * (1 - sk ** 2)),
                  alpha=min(1.0, sk * 3))
    ba = ease_out(s.p(s.ev("brand"), s.ev("brand") + 1.0))
    draw_text(ctx, "贺去病AI商业咨询", 540, 1370, 70, (*st.line[:3], ba), key="serif_black", align="center")


SERV = [("经营诊断", "客户如何发现你", "销售如何跟进"), ("增长战略", "产品价值如何表达", "资源投向哪里"),
        ("AI落地", "报价与交付如何协同", "流程、责任与验收标准"), ("陪伴复盘", "重复问题是否真正改善", "有效方法留在企业")]


def v3_2(s):
    ctx, st = s.ctx, s.st
    ex = s.exit()
    for i, (t, l1, l2) in enumerate(SERV):
        k = ex * ease_out(s.p(s.ev(f"v{i + 1}"), s.ev(f"v{i + 1}") + 0.8))
        x = 290 + (i % 2) * 500
        y = 700 + (i // 2) * 380
        draw_text(ctx, t, x, y + 10 * (1 - k), 56, (*st.line[:3], k), key="serif_black", align="center")
        sketch.stroke(ctx, line_pts(x - 40 * k, y + 40, x + 40 * k, y + 40), 1, st.red, 3, k, rough=0)
        draw_text(ctx, l1, x, y + 110, 30, (*st.text[:3], k), key="sans", align="center")
        draw_text(ctx, l2, x, y + 160, 30, (*st.text[:3], k), key="sans", align="center")
    a = ex * ease_out(s.p(20.0, 21.0))
    draw_text(ctx, "诊断 → 试点 → 落地 → 复盘", 540, 1480, 36, (*st.dim[:3], a), key="serif", align="center")


def v3_3(s):
    ctx, st = s.ctx, s.st
    cfg = load_config()["brand"]
    sk = s.p(s.ev("seal") - 0.5, s.ev("seal"))
    if sk > 0:
        draw_seal(ctx, cfg["seal_text"], 540, 760, 190 * (1 + 0.5 * (1 - sk ** 2)), alpha=min(1.0, sk * 3))
    k1 = ease_out(s.p(25.0, 25.6))
    draw_text(ctx, cfg["name"], 540, 1000, 80, (*st.line[:3], k1), key="serif_black", align="center")
    k2 = ease_out(s.p(25.3, 25.9))
    draw_text(ctx, "用 AI，把生意做大，", 540, 1100, 50, (*st.text[:3], k2), key="serif", align="center")
    draw_text(ctx, "把利润做实。", 540, 1168, 50, (*st.text[:3], k2), key="serif", align="center")
    k3 = ease_out(s.p(25.5, 26.0))
    draw_text(ctx, "经营诊断｜增长战略", 540, 1250, 34, (*st.dim[:3], k3), key="sans", align="center")
    draw_text(ctx, "AI落地｜陪伴复盘", 540, 1300, 34, (*st.dim[:3], k3), key="sans", align="center")
    sketch.stroke(ctx, line_pts(480, 1346, 600, 1346), 1, st.red, 3, k3, rough=0)
    draw_text(ctx, cfg["cta"], 540, 1410, 40, (*st.text[:3], k3), key="serif", align="center")


SCENES = {"V0-1": v0_1, "V0-2": v0_2, "V1-1": v1_1, "V1-2": v1_2, "V1-3": v1_3, "V1-4": v1_4, "V1-5": v1_5,
          "V2-1": v2_1, "V2-2": v2_2, "V2-3": v2_3, "V2-4": v2_4, "V3-1": v3_1, "V3-2": v3_2, "V3-3": v3_3}

KW_POS = (540, 330, 300)


def _kw(s, shot):
    x, y, size = KW_POS
    if shot.kw_write:
        w0, w1 = shot.kw_write
        p = clamp((s.bc - w0) / (w1 - w0))
    else:
        p = 1.0
    return x, y, size, p


def _hud(ctx, s, shot, st):
    ch = V.CHAPTERS[shot.chapter]
    seal_hidden = shot.chapter >= 1 and s.bc < 1.6 and shot.b0 == 0
    if not seal_hidden:
        draw_seal(ctx, ch.numeral if shot.chapter != 1 else "史", 110, 110, 96)
    title = ch.name if shot.chapter != 1 else f"{shot.keyword} · 编年"
    draw_text(ctx, title, 180, 126, 34, (*st.line[:3], 0.9), key="serif")
    # 底部时间轴（竖版简化）：编年段 5 个节点；行 = 今天；成 = 四阶段
    y = 1700
    if shot.chapter <= 1:
        labels = [m[3] for m in V.MONTAGE]
        act = next((i for i, m in enumerate(V.MONTAGE) if m[0] == shot.keyword), -1) if shot.chapter == 1 else -1
    elif shot.chapter == 2:
        labels, act = ["今天 · AI时代"], 0
    else:
        labels, act = ["诊断", "试点", "落地", "复盘"], min(3, max(0, int((s.bc - 12) / 3))) if s.bc >= 12 else -1
    n = len(labels)
    xs = [540] if n == 1 else [140 + (800) * i / (n - 1) for i in range(n)]
    sketch.stroke(ctx, line_pts(100, y, 980, y), 1, st.line, 1.4, 0.45, rough=0)
    for i, (x, lab) in enumerate(zip(xs, labels)):
        on = i == act
        col = st.red if on else st.line
        sketch.dot(ctx, x, y, 7 if on else 4, col, 1.0 if on or i < act else 0.5)
        draw_text(ctx, lab, x, y - 20, 30 if on else 26, (*col[:3], 1.0 if on else 0.6), key="sans_bold" if on else "sans",
                  align="center")


PRE = 6


def _transition(ctx, frame):
    for c in V.CHAPTERS[1:]:
        f0 = V.chapter_start_frame(c.id)
        d = frame - f0
        fpb = c.frames_per_beat
        if -PRE <= d < fpb * 2:
            st = style_for(STYLE_OF[c.id] if c.id != 1 else 1)
            text = c.numeral
            cx, cy = 540, 980
            if d < 0:
                k = (d + PRE) / PRE
                draw_seal(ctx, text, cx, cy, 260 * lerp(1.7, 1.0, ease_in(k)), alpha=ease_out(k))
                return
            t = clamp(d / (fpb * 1.1))
            R = lerp(90, 1200, ease_out(t))
            motifs.draw_ring(ctx, motifs.CHAPTER_MOTIF[{1: 1, 2: 6, 3: 7}[c.id]], cx, cy, R, 60, st.line,
                             alpha=(1 - t) ** 1.3, width=3.0)
            fly = ease_in_out(prog(d, fpb * 0.75, fpb * 1.6))
            if fly < 1:
                draw_seal(ctx, text, lerp(cx, 110, fly), lerp(cy, 110, fly), lerp(260, 96, fly))
            return


def _chapter_exit(shot, bc):
    ch = V.CHAPTERS[shot.chapter]
    if shot.chapter == 3:
        return 1.0
    return 1.0 - ease_in(prog(bc, ch.beats - 0.5, ch.beats - 0.05))


def render_frame(frame, scale=1.0, cues=None):
    w, h = int(round(W * scale)), int(round(H * scale))
    surf = cairo.ImageSurface(cairo.FORMAT_RGB24, w, h)
    ctx = cairo.Context(surf)
    ctx.scale(scale, scale)
    shot = shot_at(frame)
    st = _style(shot)
    s = VS(ctx, st, shot, frame)
    ctx.set_source_surface(paper.background(st.bg, W, H), 0, 0)
    ctx.paint()
    ctx.push_group()
    SCENES[shot.id](s)
    x, y, size, p = _kw(s, shot)
    hanzi.draw_char(ctx, shot.keyword, x, y, size, p, st.kw, 1.0, texture_key=st.kind)
    ctx.pop_group_to_source()
    ctx.paint_with_alpha(_chapter_exit(shot, s.bc))
    _hud(ctx, s, shot, st)
    _transition(ctx, frame)
    if cues is not None:
        draw_subtitle(ctx, frame, cues)
    surf.flush()
    return surf


def draw_subtitle(ctx, frame, cues):
    for c in cues:
        if c["start_frame"] <= frame < c["end_frame"]:
            a = clamp((frame - c["start_frame"]) / 3.0) * clamp((c["end_frame"] - frame) / 3.0)
            draw_text(ctx, c["text"], 540, 1590, 52, (*style_for(0).line[:3], a), key="sans", align="center",
                      stroke=((0.04, 0.04, 0.04, 0.72 * a), 8.0))
            return


# ───────────── 旁白与字幕 ─────────────
def narration_layout():
    """直接复用横版已选定的 take（同一引擎、同一语速），不重新合成。"""
    import soundfile as sf
    from ..audio import voice
    from ..narration import by_id
    from ..paths import ROOT
    lines = by_id()
    main = {it["id"]: it for it in voice.load_layout()}
    out = []
    for lid, ch, beat in NARRATION:
        path = os.path.join(ROOT, main[lid]["path"])
        x, _ = sf.read(path, dtype="float64")
        f0 = V.beat_frame(ch, beat)
        n = len(x)
        out.append(dict(id=lid, chapter=ch, beat=beat, start_frame=f0, start_sample=f0 * V.SAMPLES_PER_FRAME,
                        n_samples=n, end_sample=f0 * V.SAMPLES_PER_FRAME + n, end_frame=f0 + -(-n // 1600),
                        path=path, display=lines[lid].display, subs=_vsubs(lines[lid])))
    return out


def _vsubs(line):
    """竖屏每屏最多约 15 字：按逗号再拆分。"""
    out = []
    for sub in line.subs:
        if len(sub) <= 15:
            out.append(sub)
            continue
        parts = [p for p in sub.replace("，", "，|").split("|") if p]
        cur = ""
        for p in parts:
            if len(cur) + len(p) <= 15:
                cur += p
            else:
                if cur:
                    out.append(cur)
                cur = p
        if cur:
            out.append(cur)
    return out


def build_cues(layout):
    cues = []
    for i, it in enumerate(layout):
        f0, f1 = it["start_frame"], it["end_frame"]
        nxt = layout[i + 1]["start_frame"] if i + 1 < len(layout) else V.TOTAL_FRAMES
        f1 = min(f1 + 8, nxt - 2)
        w = [max(1, len(x)) for x in it["subs"]]
        acc = f0
        for k, (sub, wt) in enumerate(zip(it["subs"], w)):
            end = f1 if k == len(w) - 1 else acc + round((f1 - f0) * wt / sum(w))
            cues.append(dict(line=it["id"], start_frame=acc, end_frame=end, text=sub))
            acc = end
    return cues
