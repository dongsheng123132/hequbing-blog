"""06 行 · AI落地（流程演示，非客户案例）。

一张“策”（第一章的竹简）变成企业里真正运行的一条流程：
收到询盘 → 补齐需求 → 报价草稿 → 人工审批 → 销售跟进 → 记录复盘。
必须可见：资料来源、待确认字段、需要人工判断的节点、执行后的记录；
价格、交期与对外发送一律经人工审批；保留异常分支；不出现提效百分比或成交金额。
"""
import math

import numpy as np

from ..visuals import props, sketch
from ..visuals.core import bezier, ease_in_out, ease_out, lerp, line_pts, prog, rect_pts
from ..visuals.seal import draw_seal
from ..visuals.text import draw_text, draw_vertical
from .base import scene

PROC = ["收到询盘", "补齐需求", "报价草稿", "人工审批", "销售跟进", "记录复盘"]
NOTES = ["邮件·表单·电话", "AI整理·标缺失", "依据授权资料", "价格·交期·发送", "人负责沟通", "留下依据"]
APPROVAL = 3
DARK = (0.08, 0.13, 0.14)
CW, CH, GAP, X0, ROW_Y = 190, 110, 20, 500, 330


def card_x(i, x0=X0, w=CW, gap=GAP):
    return x0 + i * (w + gap)


def demo_tag(s, alpha=1.0, y=214):
    ctx, st = s.ctx, s.st
    w = 290
    sketch.box(ctx, 1740 - w, y, w, 44, st.dim, alpha, 1.6, r=22)
    draw_text(ctx, "流程演示 · 非客户案例", 1740 - w / 2, y + 22, 24, (*st.line[:3], alpha), key="sans",
              align="center", valign="middle")


def draw_row(s, y, w, h, gap, x0, size, alpha, active=(), done=(), notes=False, red_gate=True):
    ctx, st = s.ctx, s.st
    for i, lab in enumerate(PROC):
        x = x0 + i * (w + gap)
        col = st.red if (i == APPROVAL and red_gate) else st.line
        on = i in active
        fa = 0.95 if on else 0.8
        sketch.box(ctx, x, y, w, h, col, alpha * (1.0 if (on or i in done or not active) else 0.55),
                   2.6 if on else 1.8, fill_color=DARK, fill_alpha=fa, r=10)
        draw_text(ctx, lab, x + w / 2, y + h / 2, size, (*st.line[:3], alpha * (1.0 if (on or not active) else 0.6)),
                  key="sans_bold" if on else "sans", align="center", valign="middle")
        if i in done:
            sketch.check(ctx, x + w - 16, y + 14, 12, st.line, alpha, width=2.2)
        if i < 5:
            sketch.arrow(ctx, line_pts(x + w + 3, y + h / 2, x + w + gap - 3, y + h / 2), 1, st.line, 1.8, alpha * 0.8,
                         head=7, rough=0)
        if notes:
            draw_text(ctx, NOTES[i], x + w / 2, y + h + 34, 24, (*st.dim[:3], alpha), key="sans", align="center")


def mini_row(s, alpha, active=(), done=()):
    draw_row(s, 150, 150, 46, 16, 560, 24, alpha, active=active, done=done)


@scene("S06-1")
def s06_1(s):
    ctx, st = s.ctx, s.st
    bc = s.bc
    # 上一章卡住的询盘
    x, y = 1090, 650
    sketch.box(ctx, x - 110, y - 60, 220, 120, st.line, 1.0, 2.4, fill_color=DARK, fill_alpha=0.9, r=12)
    draw_text(ctx, "客户询盘", x, y - 10, 32, (*st.line[:3], 1.0), key="sans_bold", align="center", valign="middle")
    for j in range(2):
        sketch.stroke(ctx, line_pts(x - 80, y + 22 + j * 16, x + 80 - j * 50, y + 22 + j * 16), 1, st.dim, 1.4, 1.0,
                      rough=0)
    blink = 0.55 + 0.45 * (1 if int(bc * 2) % 2 == 0 else 0)
    fade_tag = 1 - ease_in_out(prog(bc, 6.0, 7.5))
    sketch.box(ctx, x - 70, y + 90, 140, 48, st.red, blink * fade_tag, 2.6, r=24)
    draw_text(ctx, "待处理", x, y + 114, 28, (*st.red[:3], blink * fade_tag), key="sans_bold", align="center",
              valign="middle")
    # 六枚竹简从左侧飞入（呼应第一章的简策）
    for i in range(6):
        b = s.ev("slips") - 1.0 + i * 0.35
        k = ease_out(prog(bc, b, b + 1.4))
        if k <= 0:
            continue
        tx = card_x(i) + CW / 2 - 24
        sx = lerp(tx - 260 + 40 * i, tx, k)
        sy = lerp(-420, 190, k)
        ang = (1 - k) * (-0.5 + 0.15 * i)
        ctx.save()
        ctx.translate(sx + 24, sy + 140)
        ctx.rotate(ang)
        props.slips(ctx, -24, -140, 1, 48, 280, 0, st.line, 1.0, t=1.0, words={0: PROC[i]}, text_color=st.line,
                    key=f"slip6{i}", word_size=36)
        ctx.restore()
    a = ease_out(prog(bc, 5.0, 6.0))
    draw_text(ctx, "一张策", 700, 560, 56, (*st.line[:3], a * (1 - ease_in_out(prog(bc, 7.2, 8.0)))), key="brush",
              align="center")


def _flip(s, i, t_flip):
    """竹简翻转为流程卡。t_flip: 0..1。"""
    ctx, st = s.ctx, s.st
    cx = card_x(i) + CW / 2
    if t_flip < 0.5:
        k = 1 - t_flip * 2
        ctx.save()
        ctx.translate(cx, 190 + 140)
        ctx.scale(max(0.02, k), 1)
        props.slips(ctx, -24, -140, 1, 48, 280, 0, st.line, 1.0, t=1.0, words={0: PROC[i]}, text_color=st.line,
                    key=f"slip6{i}", word_size=36)
        ctx.restore()
    else:
        k = (t_flip - 0.5) * 2
        ctx.save()
        ctx.translate(cx, ROW_Y + CH / 2)
        ctx.scale(max(0.02, k), 1)
        col = st.red if i == APPROVAL else st.line
        sketch.box(ctx, -CW / 2, -CH / 2, CW, CH, col, 1.0, 2.4 if i == APPROVAL else 1.9, fill_color=DARK,
                   fill_alpha=0.9, r=10)
        draw_text(ctx, PROC[i], 0, 0, 32, (*st.line[:3], 1.0), key="sans", align="center", valign="middle")
        ctx.restore()


@scene("S06-2")
def s06_2(s):
    ctx, st = s.ctx, s.st
    bc = s.bc
    ex = s.exit(0.6)
    ctx.push_group()
    all_done = True
    for i in range(6):
        b = s.ev("flip0") + i * 1.5
        t = prog(bc, b, b + 0.8)
        if t < 1:
            all_done = False
        _flip(s, i, t)
        if t >= 1:
            a = ease_out(prog(bc, b + 0.8, b + 1.4))
            if i < 5:
                x = card_x(i)
                sketch.arrow(ctx, line_pts(x + CW + 3, ROW_Y + CH / 2, x + CW + GAP - 3, ROW_Y + CH / 2), a, st.line,
                             1.8, 1.0, head=7, rough=0)
            draw_text(ctx, NOTES[i], card_x(i) + CW / 2, ROW_Y + CH + 34, 24, (*st.dim[:3], a), key="sans",
                      align="center")
    # 询盘进入第一个节点
    m = ease_in_out(prog(bc, 18.0, 19.2))
    x = lerp(1090, card_x(0) + CW / 2, m)
    y = lerp(650, ROW_Y + CH / 2, m)
    sc = lerp(1.0, 0.3, m)
    if m < 1:
        sketch.box(ctx, x - 110 * sc, y - 60 * sc, 220 * sc, 120 * sc, st.line, 1 - m * 0.6, 2.4, fill_color=DARK,
                   fill_alpha=0.9, r=12 * sc)
        draw_text(ctx, "客户询盘", x, y - 10 * sc, 32 * sc, (*st.line[:3], 1 - m), key="sans_bold", align="center",
                  valign="middle")
    else:
        sketch.ring(ctx, card_x(0) + CW / 2, ROW_Y + CH / 2, 70, st.red, 2.4, ease_out(prog(bc, 19.2, 19.8)))
    if s.ev("flip0") + 3 * 1.5 + 0.8 <= bc:
        k = ease_out(prog(bc, s.ev("flip0") + 3 * 1.5 + 0.8, s.ev("flip0") + 3 * 1.5 + 1.6))
        draw_text(ctx, "须人工判断", card_x(APPROVAL) + CW / 2, ROW_Y - 22, 24, (*st.red[:3], k), key="sans_bold",
                  align="center")
    demo_tag(s, ease_out(prog(bc, 10.0, 11.0)), y=560)
    ctx.pop_group_to_source()
    ctx.paint_with_alpha(ex)
    a = ex * ease_out(prog(bc, 13.0, 14.0))
    draw_text(ctx, "策 → 流程", 1120, 820, 56, (*st.line[:3], a), key="brush", align="center")


INQUIRY = ["您好，我们需要不锈钢法兰", "DN50，数量 2000 件，", "送货到宁波。", "请尽快报价。"]
ROWS = [("产品型号", "不锈钢法兰 DN50", True), ("数量", "2000 件", True), ("交货地", "宁波", True),
        ("交期", "—", False), ("认证要求", "—", False)]
SOURCES = ["产品手册 · 第12页", "历史报价记录", "库存表"]
LINKS = [(0, 0), (0, 1), (1, 2)]   # 字段行 → 资料


@scene("S06-3")
def s06_3(s):
    ctx, st = s.ctx, s.st
    bc = s.bc
    ex = s.exit(0.6)
    ctx.push_group()
    mini_row(s, ease_out(prog(bc, 20.0, 21.0)), active=(0, 1), done=(0,))
    demo_tag(s)
    # 询盘原文
    ap = ease_out(prog(bc, 20.3, 21.3))
    sketch.box(ctx, 480, 270, 420, 330, st.line, ap, 2.0, fill_color=DARK, fill_alpha=0.9, r=10)
    draw_text(ctx, "询盘原文", 500, 312, 26, (*st.dim[:3], ap), key="sans_bold")
    for j, ln in enumerate(INQUIRY):
        draw_text(ctx, ln, 500, 372 + j * 50, 28, (*st.line[:3], ap), key="sans")
    ext = s.ev("extract")
    for j, (x0_, x1_, row) in enumerate(((500, 818, 0), (500, 650, 0), (650, 800, 1), (500, 640, 2))):
        k = ease_out(prog(bc, ext + j * 0.8, ext + j * 0.8 + 0.6))
        yy = 382 + row * 50 if j < 3 else 382 + 2 * 50
        if j == 1:
            yy = 382 + 1 * 50
        sketch.stroke(ctx, line_pts(x0_, yy, lerp(x0_, x1_, k), yy), 1, st.red, 2.2, ap * 0.9, rough=0)
    # AI 整理箭头
    ak = ease_out(prog(bc, 21.2, 22.0))
    sketch.arrow(ctx, line_pts(912, 430, 952, 430), ak, st.line, 2.2, ap, head=10, rough=0)
    draw_text(ctx, "AI 整理", 932, 256, 24, (*st.line[:3], ak), key="sans_bold", align="center")
    # 字段表
    tx, ty, tw = 964, 270, 470
    sketch.box(ctx, tx, ty, tw, 330, st.line, ap, 2.0, fill_color=DARK, fill_alpha=0.9, r=10)
    draw_text(ctx, "需求字段", tx + 20, ty + 42, 26, (*st.dim[:3], ap), key="sans_bold")
    pend = ease_out(prog(bc, s.ev("pending"), s.ev("pending") + 0.8))
    for i, (lab, val, ok) in enumerate(ROWS):
        k = ease_out(prog(bc, ext + i * 0.8, ext + i * 0.8 + 0.6))
        yy = ty + 92 + i * 50
        draw_text(ctx, lab, tx + 20, yy, 26, (*st.line[:3], k), key="sans")
        draw_text(ctx, val, tx + 150, yy, 26, (*st.line[:3], k), key="sans")
        if ok:
            sketch.check(ctx, tx + tw - 36, yy - 9, 16, st.line, k, t=k, width=2.4)
        elif k > 0:
            col = st.red if pend > 0 else st.line
            aa = k * (0.6 + 0.4 * pend)
            sketch.box(ctx, tx + tw - 116, yy - 28, 100, 38, col, aa, 2.2, r=19)
            draw_text(ctx, "待确认", tx + tw - 66, yy - 9, 22, (*col[:3], aa), key="sans_bold", align="center",
                      valign="middle")
    # 授权资料面板
    sx, sy = 1470, 270
    sk = ease_out(prog(bc, s.ev("sources") - 1.0, s.ev("sources")))
    sketch.box(ctx, sx, sy, 270, 250, st.line, sk, 2.0, fill_color=DARK, fill_alpha=0.9, r=10)
    draw_text(ctx, "授权资料", sx + 20, sy + 40, 26, (*st.dim[:3], sk), key="sans_bold")
    for j, src in enumerate(SOURCES):
        yy = sy + 92 + j * 54
        sketch.box(ctx, sx + 18, yy - 22, 22, 28, st.line, sk, 1.6, r=2)
        draw_text(ctx, src, sx + 46, yy, 24, (*st.line[:3], sk), key="sans")
    lk = prog(bc, s.ev("sources"), s.ev("sources") + 1.5)
    for r_, src in LINKS:
        y0 = ty + 83 + r_ * 50
        y1 = sy + 83 + src * 54
        sketch.stroke(ctx, bezier((tx + tw - 50, y0), (tx + tw + 20, y0), (sx - 20, y1), (sx + 12, y1), 30), lk,
                      st.acc, 2.0, 1.0, rough=0, dash=[6, 5])
    draw_text(ctx, "只调用经过授权的资料", sx + 135, sy + 290, 24, (*st.dim[:3], sk), key="sans", align="center")
    # 形成草稿
    dk = ease_out(prog(bc, 32.5, 33.5))
    sketch.arrow(ctx, line_pts(1200, 612, 1200, 700), dk, st.line, 2.2, 1.0, head=10, rough=0)
    sketch.box(ctx, 1080, 712, 240, 66, st.line, dk, 2.2, fill_color=DARK, fill_alpha=0.95, r=10)
    draw_text(ctx, "报价草稿", 1200, 745, 30, (*st.line[:3], dk), key="sans_bold", align="center", valign="middle")
    ctx.pop_group_to_source()
    ctx.paint_with_alpha(ex)


DRAFT = [("产品", "不锈钢法兰 DN50", None), ("数量", "2000 件", None), ("单价", "待审批", "red"),
         ("交期", "待确认", "red"), ("依据", "产品手册 p.12 · 历史报价", "dim")]
GATE = (1140, 800, 300)


def draft_card(s, x, y, alpha, approved=0.0):
    ctx, st = s.ctx, s.st
    w, h = 400, 360
    sketch.box(ctx, x, y, w, h, st.line, alpha, 2.2, fill_color=DARK, fill_alpha=0.95, r=12)
    draw_text(ctx, "报价草稿", x + 22, y + 46, 32, (*st.line[:3], alpha), key="sans_bold")
    for i, (lab, val, tone) in enumerate(DRAFT):
        yy = y + 106 + i * 50
        col = st.red if tone == "red" and approved < 0.5 else (st.dim if tone == "dim" else st.line)
        v = val
        if tone == "red" and approved >= 0.5:
            v = "已人工确认"
        draw_text(ctx, lab, x + 22, yy, 25, (*st.dim[:3], alpha), key="sans")
        draw_text(ctx, v, x + 90, yy, 25 if tone != "dim" else 24, (*col[:3], alpha), key="sans")
    return w, h


@scene("S06-4")
def s06_4(s):
    ctx, st = s.ctx, s.st
    bc = s.bc
    ex = s.exit(0.6)
    ctx.push_group()
    mini_row(s, 1.0, active=(2, 3), done=(0, 1))
    demo_tag(s)
    appr = s.ev("approve")
    ok = ease_out(prog(bc, appr, appr + 0.4))
    mv = ease_in_out(prog(bc, 36.0, s.ev("arrive")))
    dx = lerp(470, 520, mv)
    draft_card(s, dx, 290, ease_out(prog(bc, 36.0, 36.8)), approved=ok)
    gx, gy, gh = GATE
    sketch.arrow(ctx, line_pts(dx + 410, 470, gx - 110, 470), prog(bc, 37.0, 38.0), st.line, 2.2, 1.0, head=12, rough=0)
    props.gate(ctx, gx, gy, gh, ease_in_out(prog(bc, appr + 0.5, appr + 1.5)), st.line, st.red, 1.0,
               t=prog(bc, 36.5, 38.0))
    draw_text(ctx, "人工审批", gx, gy - gh - 40, 30, (*st.red[:3], ease_out(prog(bc, 37.5, 38.3))), key="sans_bold",
              align="center")
    # 须人工确认清单
    ck = ease_out(prog(bc, s.ev("arrive"), s.ev("arrive") + 1.0))
    cx0, cy0 = 1330, 290
    sketch.box(ctx, cx0, cy0, 400, 250, st.red, ck, 2.2, fill_color=DARK, fill_alpha=0.95, r=12)
    draw_text(ctx, "须人工确认", cx0 + 22, cy0 + 46, 30, (*st.red[:3], ck), key="sans_bold")
    for i, it in enumerate(("价格", "交期", "对外发送")):
        yy = cy0 + 106 + i * 50
        sketch.box(ctx, cx0 + 24, yy - 22, 26, 26, st.line, ck, 2.0, r=3)
        draw_text(ctx, it, cx0 + 66, yy, 27, (*st.line[:3], ck), key="sans")
        c = ease_out(prog(bc, appr + 0.2 + i * 0.3, appr + 0.6 + i * 0.3))
        if c > 0:
            sketch.check(ctx, cx0 + 37, yy - 9, 16, st.red, ck, t=c, width=3)
    draw_text(ctx, "AI 不自动承诺价格、付款或交期", cx0 + 200, cy0 + 290, 26, (*st.dim[:3], ck), key="sans",
              align="center")
    # 审核人
    props.figure(ctx, 1460, 800, 70, st.line, ease_out(prog(bc, 38.0, 39.0)), facing=-1, pose="stand", key="rev",
                 arm=0.2 + 0.8 * ease_in_out(prog(bc, appr - 0.6, appr)), t=prog(bc, 38.0, 39.5))
    # 异常分支：缺认证资料 → 退回补充
    exk = prog(bc, s.ev("exception"), s.ev("exception") + 1.5)
    path = np.array([[gx - 60, gy - 30], [gx - 60, 860], [700, 860], [700, 690]], float)
    sketch.arrow(ctx, path, exk, st.red, 2.4, 1.0, head=12, rough=0, dash=[10, 7])
    ea = ease_out(prog(bc, s.ev("exception") + 1.0, s.ev("exception") + 1.8))
    draw_text(ctx, "异常分支：缺认证资料 → 退回补齐需求", 920, 848, 24, (*st.red[:3], ea), key="sans", align="center")
    # 审批印章
    sk = prog(bc, appr - 0.5, appr)       # 接触帧 = 审批事件拍
    if sk > 0:
        sc = 1.0 + 0.6 * (1 - sk ** 2)
        draw_seal(ctx, "确认", dx + 330, 590, 96 * sc, alpha=min(1.0, sk * 3))
    ctx.pop_group_to_source()
    ctx.paint_with_alpha(ex)


LOG = ["① 询盘原文与需求字段", "② 资料依据：产品手册 p.12 · 历史报价", "③ 审批：价格、交期已人工确认",
       "④ 发送：审批后由销售发出", "⑤ 客户反馈与后续结果"]


@scene("S06-5")
def s06_5(s):
    ctx, st = s.ctx, s.st
    bc = s.bc
    ex = s.exit(0.6)
    ctx.push_group()
    mini_row(s, 1.0, active=(4, 5), done=(0, 1, 2, 3))
    demo_tag(s)
    fk = ease_out(prog(bc, s.ev("follow") - 1.0, s.ev("follow")))
    sketch.box(ctx, 480, 290, 400, 250, st.line, fk, 2.2, fill_color=DARK, fill_alpha=0.95, r=12)
    draw_text(ctx, "销售跟进", 502, 336, 30, (*st.line[:3], fk), key="sans_bold")
    draw_text(ctx, "审批后由销售发出报价", 502, 396, 24, (*st.line[:3], fk), key="sans")
    draw_text(ctx, "客户问题由人回复", 502, 440, 24, (*st.line[:3], fk), key="sans")
    props.figure(ctx, 800, 520, 42, st.line, fk, pose="stand", key="sales", arm=0.5)
    sketch.arrow(ctx, line_pts(892, 415, 952, 415), prog(bc, 54.0, 55.0), st.line, 2.2, 1.0, head=10, rough=0)
    lx, ly, lw, lh = 964, 290, 770, 360
    lg = ease_out(prog(bc, s.ev("log") - 1.0, s.ev("log")))
    sketch.box(ctx, lx, ly, lw, lh, st.line, lg, 2.2, fill_color=DARK, fill_alpha=0.95, r=12)
    draw_text(ctx, "记录", lx + 22, ly + 46, 30, (*st.line[:3], lg), key="sans_bold")
    for i, ln in enumerate(LOG):
        k = ease_out(prog(bc, s.ev("log") + i * 1.0, s.ev("log") + i * 1.0 + 0.5))
        n = max(0, int(len(ln) * prog(bc, s.ev("log") + i * 1.0, s.ev("log") + i * 1.0 + 0.8) + 0.999))
        draw_text(ctx, ln[:n], lx + 30, ly + 106 + i * 52, 26, (*st.line[:3], k), key="sans")
    # 复盘回路：带回“补齐需求”
    lp = prog(bc, s.ev("loop"), s.ev("loop") + 2.0)
    mx = 560 + 166 + 75
    loop = np.array([[lx + lw / 2, ly + lh + 4], [lx + lw / 2, 800], [440, 800], [440, 250], [mx, 250], [mx, 200]],
                    float)
    sketch.arrow(ctx, loop, lp, st.red, 2.6, 1.0, head=14, rough=0)
    la = ease_out(prog(bc, s.ev("loop") + 1.2, s.ev("loop") + 2.0))
    draw_text(ctx, "复盘：高频缺失字段 → 更新询盘模板", 1000, 780, 26, (*st.red[:3], la), key="sans_bold",
              align="center")
    ctx.pop_group_to_source()
    ctx.paint_with_alpha(ex)


@scene("S06-6")
def s06_6(s):
    ctx, st = s.ctx, s.st
    bc = s.bc
    y = 380
    a0 = ease_out(prog(bc, 68.0, 68.8))
    draw_row(s, y, CW, CH, GAP, X0, 30, a0, notes=False)
    demo_tag(s, a0)
    # 异常分支与复盘回路仍然可见
    ax = card_x(APPROVAL) + CW / 2
    sketch.arrow(ctx, np.array([[ax, y + CH], [ax, y + CH + 70], [card_x(1) + CW / 2, y + CH + 70],
                                [card_x(1) + CW / 2, y + CH + 4]], float), a0, st.red, 2.2, a0 * 0.8, head=10,
                 rough=0, dash=[8, 6])
    draw_text(ctx, "异常退回", (ax + card_x(1) + CW / 2) / 2, y + CH + 100, 26, (*st.red[:3], a0 * 0.8), key="sans",
              align="center")
    lx = card_x(5) + CW / 2
    sketch.arrow(ctx, bezier((lx, y), (lx, y - 110), (card_x(1) + CW / 2, y - 110), (card_x(1) + CW / 2, y - 4), 50),
                 a0, st.line, 2.0, a0 * 0.7, head=10, rough=0, dash=[4, 6])
    draw_text(ctx, "复盘回路", (lx + card_x(1) + CW / 2) / 2, y - 96, 26, (*st.dim[:3], a0), key="sans",
              align="center")
    # 运行脉冲：每拍过一个节点，审批节点处停一拍并出现确认环
    run = s.ev("run")
    t = bc - run
    stops = []
    tt = 0.0
    for i in range(6):
        stops.append(tt)
        tt += 1.0 + (1.0 if i == APPROVAL else 0.0)
    pos = None
    for i in range(6):
        if t >= stops[i]:
            pos = i
    if pos is not None and t >= 0:
        seg_t = t - stops[pos]
        hold = 1.0 if pos == APPROVAL else 0.0
        if pos < 5 and seg_t > hold:
            u = ease_in_out(min(1.0, seg_t - hold))
            px = lerp(card_x(pos) + CW / 2, card_x(pos + 1) + CW / 2, u)
        else:
            px = card_x(pos) + CW / 2
        for j in range(pos + 1):
            sketch.box(ctx, card_x(j) - 4, y - 4, CW + 8, CH + 8, st.red if j == APPROVAL else st.line, 0.9, 2.6, r=12)
        sketch.dot(ctx, px, y + CH + 18, 9, st.red, 1.0)
        if pos == APPROVAL and seg_t <= 1.0:
            sketch.ring(ctx, card_x(APPROVAL) + CW / 2, y + CH / 2, 80 + 20 * seg_t, st.red, 3.0, 1 - seg_t * 0.5)
    # 三组词
    for name, word, x in (("p1", "有判断。", 700), ("p2", "能执行。", 1110), ("p3", "可检验。", 1520)):
        k = ease_out(prog(bc, s.ev(name), s.ev(name) + 0.6))
        draw_text(ctx, word, x, 790 + 16 * (1 - k), 78, (*st.line[:3], k), key="brush", align="center")
    # 业务线向右延伸，进入品牌章节
    e = ease_in_out(prog(bc, 77.0, 80.0))
    x6 = card_x(5) + CW
    sketch.stroke(ctx, line_pts(x6, y + CH / 2, x6 + (1920 - x6) * e, y + CH / 2), 1, st.red, 3.0, 1.0, rough=0)
