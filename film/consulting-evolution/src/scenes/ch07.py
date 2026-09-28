"""07 成 · 品牌收束：历史母题收拢成经营闭环 → 诊断/试点/落地/复盘 → 四项服务 → 品牌落版。

此处才完整出现品牌名。不出现价格、二维码、联系方式（config 未提供真实信息时一律不画）。
"""
import math

import numpy as np

from ..paths import load_config
from ..visuals import props, sketch
from ..visuals.core import bezier, circle_pts, ease_in_out, ease_out, lerp, line_pts, prog, rect_pts
from ..visuals.seal import draw_seal
from ..visuals.text import draw_text, text_width
from .base import scene

RING = (1150, 470, 200)
SEAL = load_config()["brand"]["seal_text"]


def _motif(ctx, st, kind, x, y, a):
    if kind == "rods":
        for k in range(3):
            props.rod(ctx, x - 20 + k * 20, y, 60, -math.pi / 2 + 0.15 * (k - 1), st.line, a, 4)
    elif kind == "ledger":
        props.ledger(ctx, x - 50, y - 30, 100, 60, st.line, a, cols=4)
    elif kind == "card":
        sketch.box(ctx, x - 50, y - 26, 100, 52, st.line, a, 2.0, r=6)
        sketch.stroke(ctx, line_pts(x - 34, y, x + 34, y), 1, st.dim, 1.6, a, rough=0)
    elif kind == "matrix":
        sketch.box(ctx, x - 40, y - 40, 80, 80, st.line, a, 1.8, r=2)
        sketch.stroke(ctx, line_pts(x, y - 40, x, y + 40), 1, st.dim, 1.2, a, rough=0)
        sketch.stroke(ctx, line_pts(x - 40, y, x + 40, y), 1, st.dim, 1.2, a, rough=0)
        sketch.ring(ctx, x - 18, y + 18, 10, st.line, 1.6, a)
    elif kind == "data":
        sketch.stroke(ctx, np.array([[x - 50, y + 20], [x - 10, y + 20], [x - 10, y - 20], [x + 50, y - 20]]), 1,
                      st.line, 2.0, a, rough=0)
        for px, py in ((x - 10, y + 20), (x - 10, y - 20)):
            sketch.dot(ctx, px, py, 5, st.line, a)


MOTIFS = [("rods", "筹策", -90), ("ledger", "账册", -18), ("card", "工序", 54), ("matrix", "战略图", 126),
          ("data", "数据路径", 198)]
START = {"rods": (560, 200), "ledger": (560, 820), "card": (1760, 820), "matrix": (1760, 200), "data": (1160, 900)}


def draw_loop(s, alpha, stations=0.0, seal=1.0):
    ctx, st = s.ctx, s.st
    cx, cy, r = RING
    sketch.stroke(ctx, circle_pts(cx, cy, r, 120, a0=-90), stations if stations > 0 else 1, st.line, 2.4, alpha,
                  rough=0)
    if seal > 0:
        draw_seal(ctx, SEAL, cx, cy, 130, alpha=alpha * seal)


@scene("S07-1")
def s07_1(s):
    ctx, st = s.ctx, s.st
    bc = s.bc
    cx, cy, r = RING
    conv = s.ev("converge")
    for i, (kind, name, ang) in enumerate(MOTIFS):
        k = ease_in_out(prog(bc, conv - 1.0 + i * 0.4, conv + 2.0 + i * 0.4))
        tx = cx + r * math.cos(math.radians(ang))
        ty = cy + r * math.sin(math.radians(ang))
        x0, y0 = START[kind]
        x, y = lerp(x0, tx, k), lerp(y0, ty, k)
        a = ease_out(prog(bc, 0.2 + i * 0.3, 1.0 + i * 0.3)) * (1 - 0.5 * ease_in_out(prog(bc, 8.0, 10.0)))
        _motif(ctx, st, kind, x, y, a)
        if k < 0.6:
            draw_text(ctx, name, x, y + 64, 22, (*st.dim[:3], a * (1 - k / 0.6)), key="serif", align="center")
    # 首尾相接成闭环
    lt = prog(bc, conv + 3.0, conv + 5.0)
    sketch.stroke(ctx, circle_pts(cx, cy, r, 120, a0=-90), lt, st.red, 3.0, 1.0, rough=0)
    # 印记落定
    # 印章在事件拍（接触帧）恰好落定：此前 0.5 拍自 1.6 倍缩至 1.0
    sk = prog(bc, s.ev("seal") - 0.5, s.ev("seal"))
    if sk > 0:
        sc = 1.0 + 0.6 * (1 - sk ** 2)
        draw_seal(ctx, SEAL, cx, cy, 130 * sc, alpha=min(1.0, sk * 3))
    b = s.ev("brand")
    ba = ease_out(prog(bc, b, b + 1.0))
    draw_text(ctx, "贺去病AI商业咨询", cx, 790 + 12 * (1 - ba), 66, (*st.line[:3], ba), key="serif_black",
              align="center", tracking=0.06)


STATIONS = [("诊断", "找到真实经营问题", -90), ("试点", "小范围验证方案", 0), ("落地", "做进流程、责任与验收", 90),
            ("复盘", "看结果，再改进", 180)]


@scene("S07-2")
def s07_2(s):
    ctx, st = s.ctx, s.st
    bc = s.bc
    cx, cy, r = RING
    ex = s.exit(0.6)
    sketch.stroke(ctx, circle_pts(cx, cy, r, 120, a0=-90), 1, st.dim, 2.4, ex, rough=0)
    draw_seal(ctx, SEAL, cx, cy, 130, alpha=ex)
    evs = [s.ev(k) for k in ("s1", "s2", "s3", "s4")]
    for i, (name, desc, ang) in enumerate(STATIONS):
        k = ease_out(prog(bc, evs[i], evs[i] + 0.6))
        x = cx + r * math.cos(math.radians(ang))
        y = cy + r * math.sin(math.radians(ang))
        # 走过的弧段点亮为朱红
        if k > 0:
            sketch.stroke(ctx, circle_pts(cx, cy, r, 40, a0=ang, sweep=90), k if i < 3 or True else 1, st.red, 3.2,
                          ex, rough=0)
            sketch.arrowhead(ctx, *[(cx + r * math.cos(math.radians(ang + 90 * k)),
                                     cy + r * math.sin(math.radians(ang + 90 * k)))][0],
                             math.radians(ang + 90 * k) + math.pi / 2, 14, st.red, ex * k, 3.0)
        sketch.dot(ctx, x, y, 14, st.red if k > 0 else st.line, ex * max(0.4, k))
        ox = {0: 0, 1: 1, 2: 0, 3: -1}[i]
        oy = {0: -1, 1: 0, 2: 1, 3: 0}[i]
        tx = x + ox * 70
        ty = y + oy * 62
        al = "center" if ox == 0 else ("left" if ox > 0 else "right")
        draw_text(ctx, name, tx, ty + (0 if oy <= 0 else 30), 44, (*st.line[:3], ex * max(0.35, k)),
                  key="serif_bold", align=al, valign="middle")
        draw_text(ctx, desc, tx, ty + (40 if oy <= 0 else 72) if oy != -1 else ty - 44, 24,
                  (*st.dim[:3], ex * k), key="sans", align=al, valign="middle")


SERVICES = [("经营诊断", "客户如何发现你", "销售如何跟进"), ("增长战略", "产品价值如何表达", "资源投向哪里"),
            ("AI落地", "报价与交付如何协同", "流程、责任与验收标准"), ("陪伴复盘", "重复问题是否真正改善", "有效方法留在企业")]


@scene("S07-3")
def s07_3(s):
    ctx, st = s.ctx, s.st
    bc = s.bc
    ex = s.exit(0.6)
    cw, gap, x0 = 290, 20, 520
    fo = 1 - ease_in_out(prog(bc, 24.0, 25.0))
    if fo > 0:
        cx, cy, r = RING
        sketch.stroke(ctx, circle_pts(cx, cy, r * (1 + 0.3 * (1 - fo)), 120, a0=-90), 1, st.red, 3.0, fo, rough=0)
        draw_seal(ctx, SEAL, cx, cy, 130, alpha=fo)
    evs = [s.ev(k) for k in ("v1", "v2", "v3", "v4")]
    for i, (title, l1, l2) in enumerate(SERVICES):
        k = ease_out(prog(bc, evs[i], evs[i] + 0.8))
        x = x0 + i * (cw + gap)
        sketch.stroke(ctx, line_pts(x, 300, x, 300 + 360 * k), 1, st.dim, 1.4, ex * k, rough=0)
        draw_text(ctx, title, x + cw / 2, 390 + 10 * (1 - k), 50, (*st.line[:3], ex * k), key="serif_black",
                  align="center")
        sketch.stroke(ctx, line_pts(x + cw / 2 - 40 * k, 426, x + cw / 2 + 40 * k, 426), 1, st.red, 3.0, ex * k,
                      rough=0)
        draw_text(ctx, l1, x + cw / 2, 490, 27, (*st.text[:3], ex * k), key="sans", align="center")
        draw_text(ctx, l2, x + cw / 2, 540, 27, (*st.text[:3], ex * k), key="sans", align="center")
    a = ex * ease_out(prog(bc, 31.0, 32.0))
    draw_text(ctx, "用商业实战定义问题 · 用技术把方案做出来 · 用经营结果检验价值", 1140, 700, 28,
              (*st.dim[:3], a), key="serif", align="center")


@scene("S07-4")
def s07_4(s):
    ctx, st = s.ctx, s.st
    bc = s.bc
    cfg = load_config()["brand"]
    cx = 1140
    sk = prog(bc, s.ev("seal") - 0.5, s.ev("seal"))
    if sk > 0:
        sc = 1.0 + 0.5 * (1 - sk ** 2)
        draw_seal(ctx, cfg["seal_text"], cx, 300, 150 * sc, alpha=min(1.0, sk * 3))
    k1 = ease_out(prog(bc, 37.75, 38.75))
    draw_text(ctx, cfg["name"], cx, 500 + 10 * (1 - k1), 84, (*st.line[:3], k1), key="serif_black", align="center",
              tracking=0.06)
    k2 = ease_out(prog(bc, 39.25, 40.25))
    draw_text(ctx, cfg["slogan"], cx, 584, 46, (*st.text[:3], k2), key="serif", align="center")
    k3 = ease_out(prog(bc, 40.25, 41.25))
    draw_text(ctx, "｜".join(cfg["services"]), cx, 654, 32, (*st.dim[:3], k3), key="sans", align="center",
              tracking=0.08)
    k4 = ease_out(prog(bc, 41.0, 42.0))
    sketch.stroke(ctx, line_pts(cx - 60 * k4, 700, cx + 60 * k4, 700), 1, st.red, 3.0, k4, rough=0)
    draw_text(ctx, cfg["cta"], cx, 752, 36, (*st.text[:3], k4), key="serif", align="center")
    # 联系方式 / 二维码：只有在 config 中提供真实信息时才绘制
    if cfg.get("contact"):
        draw_text(ctx, cfg["contact"], cx, 820, 28, (*st.dim[:3], k4), key="sans", align="center")
