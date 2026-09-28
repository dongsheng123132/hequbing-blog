"""线描道具库。所有道具支持 t（0..1 逐步画出）与 alpha。

人物一律为无面容剪影；器物按史实表的时代适配使用。
"""
import math

import numpy as np

from . import sketch
from .core import (bezier, circle_pts, clamp, ease_in_out, ease_out, lerp, line_pts, poly, polyline_lengths,
                   prog, rect_pts, seeded)
from .text import draw_text, draw_vertical, text_width


def seq(ctx, paths, t, color, width=2.2, alpha=1.0, key=None, rough=1.0, tip=True, double=True):
    """按总弧长把多条路径依次画出（先结构后细节时分组调用）。"""
    if t <= 0 or alpha <= 0.003:
        return
    lens = [max(1.0, polyline_lengths(np.asarray(p, dtype=float))[-1]) for p in paths]
    total = sum(lens)
    acc = 0.0
    for i, (p, L) in enumerate(zip(paths, lens)):
        a0 = acc / total
        a1 = (acc + L) / total
        acc += L
        if t <= a0:
            break
        lt = clamp((t - a0) / (a1 - a0))
        sketch.stroke(ctx, p, lt, color, width, alpha, rough=rough, key=(f"{key}:{i}" if key else None),
                      tip=tip and lt < 1, double=double)


# ---------- 山川 ----------

def ridges(x0, x1, base, height, seed, layers=3):
    rng = seeded("ridge", seed)
    out = []
    for l in range(layers):
        n = 7 + l * 2
        xs = np.linspace(x0, x1, n)
        ys = base - height * (0.35 + 0.65 * rng.random(n)) * (1 - 0.25 * l)
        ys[0] = ys[-1] = base - height * 0.1
        xx = np.linspace(x0, x1, 120)
        yy = np.interp(xx, xs, ys)
        # 平滑
        k = np.ones(9) / 9
        yy = np.convolve(np.pad(yy, 4, mode="edge"), k, mode="valid")
        out.append(np.stack([xx, yy + l * height * 0.18], axis=1))
    return out


def river(x0, y0, x1, y1, seed, amp=40):
    rng = seeded("river", seed)
    c1 = (lerp(x0, x1, 0.33), lerp(y0, y1, 0.33) + rng.uniform(-amp, amp))
    c2 = (lerp(x0, x1, 0.66), lerp(y0, y1, 0.66) + rng.uniform(-amp, amp))
    return bezier((x0, y0), c1, c2, (x1, y1), 60)


# ---------- 人物（无面容） ----------

_KNEEL = poly((0.02, -0.86), (0.17, -0.78), (0.24, -0.52), (0.55, -0.14), (0.62, 0.0), (-0.26, 0.0),
              (-0.30, -0.14), (-0.20, -0.50), (-0.10, -0.80), (0.02, -0.86))
_STAND = poly((0.0, -1.62), (0.16, -1.52), (0.22, -1.1), (0.26, -0.55), (0.30, 0.0), (-0.30, 0.0),
              (-0.26, -0.55), (-0.22, -1.1), (-0.16, -1.52), (0.0, -1.62))


def figure(ctx, cx, cy, s, color, alpha=1.0, facing=1, pose="kneel", fill_alpha=0.18, t=1.0, key=None,
           arm=None):
    body = _KNEEL if pose == "kneel" else _STAND
    head_y = -1.0 if pose == "kneel" else -1.78
    b = np.stack([cx + facing * body[:, 0] * s, cy + body[:, 1] * s], axis=1)
    head = circle_pts(cx + facing * 0.03 * s, cy + head_y * s, 0.14 * s, 40)
    if t >= 1 and fill_alpha > 0:
        sketch.fill(ctx, b, color, alpha * fill_alpha)
        sketch.fill(ctx, head, color, alpha * fill_alpha)
    paths = [head, b]
    if arm is not None:
        # arm: 0..1 抬手程度（指点 / 书写）
        sh = (cx + facing * 0.1 * s, cy + (head_y + 0.22) * s)
        hand = (cx + facing * lerp(0.35, 0.75, arm) * s, cy + lerp(head_y + 0.65, head_y + 0.05, arm) * s)
        el = (lerp(sh[0], hand[0], 0.5) + facing * 0.05 * s, lerp(sh[1], hand[1], 0.5) + 0.12 * s)
        paths.append(np.array([sh, el, hand]))
    seq(ctx, paths, t, color, 2.2, alpha, key=key, rough=0.6)


# ---------- 古代器物 ----------

def low_table(ctx, cx, cy, w, color, alpha=1.0, t=1.0, key=None):
    h = w * 0.16
    paths = [line_pts(cx - w / 2, cy - h, cx + w / 2, cy - h), line_pts(cx - w / 2 + 12, cy - h, cx - w / 2 + 12, cy),
             line_pts(cx + w / 2 - 12, cy - h, cx + w / 2 - 12, cy), line_pts(cx - w / 2 - 6, cy - h - 6, cx + w / 2 + 6, cy - h - 6)]
    seq(ctx, paths, t, color, 2.0, alpha, key=key)


def mat(ctx, cx, cy, w, color, alpha=1.0, t=1.0, key=None):
    paths = [line_pts(cx - w / 2, cy, cx + w / 2, cy), line_pts(cx - w / 2 + 10, cy + 8, cx + w / 2 - 10, cy + 8)]
    seq(ctx, paths, t, color, 1.8, alpha, key=key)
    if t >= 1:
        for i in range(int(w / 14)):
            x = cx - w / 2 + 8 + i * 14
            sketch.stroke(ctx, line_pts(x, cy + 1, x + 5, cy + 7), 1, color, 1.0, alpha * 0.45, rough=0)


def slips(ctx, x, y, n, w, h, gap, color, alpha=1.0, t=1.0, words=None, word_t=None, text_color=None,
          key="slips", open_from="right", highlight=None, red=None, word_size=None):
    """竹木简策：n 枚竖简，两道编绳；t 控制展开（从一侧依次铺开）。"""
    total_w = n * w + (n - 1) * gap
    shown = []
    for i in range(n):
        idx = (n - 1 - i) if open_from == "right" else i
        ti = clamp(t * n - i)
        if ti <= 0:
            continue
        sx = x + idx * (w + gap)
        a = alpha * ease_out(ti)
        sketch.stroke(ctx, rect_pts(sx, y, w, h, w * 0.25), 1, color, 2.0, a, rough=0.5, key=f"{key}{idx}",
                      double=False)
        sketch.stroke(ctx, line_pts(sx + w * 0.5, y + 8, sx + w * 0.5, y + h - 8), 1, color, 0.8, a * 0.25, rough=0)
        if highlight is not None and idx in highlight and red is not None:
            sketch.stroke(ctx, rect_pts(sx - 4, y - 4, w + 8, h + 8, w * 0.3), highlight[idx], red, 2.6, alpha,
                          rough=0)
        shown.append(sx)
    if shown:
        lo, hi = min(shown), max(shown) + w
        for fy in (0.22, 0.78):
            yy = y + h * fy
            xs = np.linspace(lo - 6, hi + 6, 60)
            ys = yy + 2.5 * np.sin(xs / 9.0)
            sketch.stroke(ctx, np.stack([xs, ys], axis=1), 1, color, 1.4, alpha * 0.8, rough=0)
    if words:
        for idx, word in words.items():
            wt = 1.0 if word_t is None else word_t.get(idx, 0)
            if wt <= 0:
                continue
            sx = x + idx * (w + gap) + w / 2
            size = word_size or min(w * 0.72, (h * 0.72) / max(1, len(word)))
            k = max(1, math.ceil(len(word) * wt))
            yy = y + (h - len(word) * size * 1.08) / 2
            draw_vertical(ctx, word[:k], sx, yy, size, (*(text_color or color)[:3], alpha * min(1, wt * 3)),
                          key="brush", spacing=1.08)
    return total_w


def rod(ctx, cx, cy, L, ang, color, alpha=1.0, width=4.0, t=1.0):
    dx, dy = math.cos(ang) * L / 2, math.sin(ang) * L / 2
    sketch.stroke(ctx, np.array([[cx - dx, cy - dy], [cx + dx, cy + dy]]), t, color, width, alpha, rough=0)


def boat(ctx, x, y, s, color, alpha=1.0, t=1.0, key="boat"):
    hull = bezier((x - 60 * s, y - 14 * s), (x - 40 * s, y + 18 * s), (x + 40 * s, y + 18 * s), (x + 64 * s, y - 16 * s), 30)
    deck = line_pts(x - 60 * s, y - 14 * s, x + 64 * s, y - 16 * s)
    mast = line_pts(x, y - 14 * s, x, y - 96 * s)
    sail = np.array([[x + 3 * s, y - 92 * s], [x + 44 * s, y - 60 * s], [x + 40 * s, y - 24 * s], [x + 3 * s, y - 24 * s]])
    battens = [line_pts(x + 3 * s, y - k * s, x + (44 - (92 - k) * 0.08) * s, y - k * s) for k in (40, 56, 72)]
    seq(ctx, [hull, deck, mast, sail] + battens, t, color, 2.0, alpha, key=key)


def cart(ctx, x, y, s, color, alpha=1.0, t=1.0, wheel_ang=0.0, key="cart"):
    body = rect_pts(x - 50 * s, y - 60 * s, 100 * s, 36 * s, 4)
    load = bezier((x - 44 * s, y - 60 * s), (x - 30 * s, y - 92 * s), (x + 30 * s, y - 92 * s), (x + 44 * s, y - 60 * s), 24)
    shaft = line_pts(x + 50 * s, y - 40 * s, x + 110 * s, y - 34 * s)
    wheel = circle_pts(x - 10 * s, y - 16 * s, 22 * s, 36)
    paths = [body, load, shaft, wheel]
    seq(ctx, paths, t, color, 2.0, alpha, key=key)
    if t >= 1:
        for k in range(4):
            a = wheel_ang + k * math.pi / 4
            sketch.stroke(ctx, np.array([[x - 10 * s - 20 * s * math.cos(a), y - 16 * s - 20 * s * math.sin(a)],
                                         [x - 10 * s + 20 * s * math.cos(a), y - 16 * s + 20 * s * math.sin(a)]]),
                          1, color, 1.2, alpha * 0.7, rough=0)


def warehouse(ctx, x, y, w, h, color, alpha=1.0, t=1.0, key="wh"):
    """货栈：台基、柱、门、檐口起翘的屋顶。(x, y) 为地面中心。"""
    base = rect_pts(x - w / 2, y - h * 0.08, w, h * 0.08)
    body = rect_pts(x - w * 0.42, y - h * 0.62, w * 0.84, h * 0.54)
    roof = bezier((x - w * 0.62, y - h * 0.6), (x - w * 0.4, y - h * 0.66), (x - w * 0.25, y - h * 0.98), (x, y - h))
    roof2 = bezier((x, y - h), (x + w * 0.25, y - h * 0.98), (x + w * 0.4, y - h * 0.66), (x + w * 0.62, y - h * 0.6))
    eave = line_pts(x - w * 0.56, y - h * 0.63, x + w * 0.56, y - h * 0.63)
    door = rect_pts(x - w * 0.12, y - h * 0.44, w * 0.24, h * 0.36)
    cols = [line_pts(x + k * w * 0.28, y - h * 0.62, x + k * w * 0.28, y - h * 0.08) for k in (-1, 1)]
    seq(ctx, [base, body, roof, roof2, eave] + cols + [door], t, color, 2.1, alpha, key=key)


def bale(ctx, x, y, s, color, alpha=1.0, t=1.0, key="bale"):
    b = rect_pts(x - 34 * s, y - 26 * s, 68 * s, 52 * s, 14 * s)
    ropes = [line_pts(x - 34 * s, y, x + 34 * s, y), line_pts(x, y - 26 * s, x, y + 26 * s)]
    seq(ctx, [b] + ropes, t, color, 2.2, alpha, key=key)


def cash_string(ctx, x, y, s, color, alpha=1.0, t=1.0, key="cash"):
    """一串方孔钱（铜钱），不用金币造型。"""
    cord = bezier((x - 60 * s, y - 10 * s), (x - 20 * s, y + 20 * s), (x + 20 * s, y + 20 * s), (x + 60 * s, y - 10 * s), 30)
    paths = [cord]
    for k in range(5):
        px, py = x + (k - 2) * 26 * s, y + (8 - abs(k - 2) * 5) * s
        paths.append(circle_pts(px, py, 13 * s, 24))
        paths.append(rect_pts(px - 4 * s, py - 4 * s, 8 * s, 8 * s))
    seq(ctx, paths, t, color, 2.0, alpha, key=key)


def contract(ctx, x, y, s, color, red, alpha=1.0, t=1.0, seal_t=0.0, key="contract"):
    page = rect_pts(x - 36 * s, y - 46 * s, 72 * s, 92 * s, 3)
    cols = [line_pts(x + k * 14 * s, y - 36 * s, x + k * 14 * s, y + 28 * s) for k in (-1.5, -0.5, 0.5, 1.5)]
    seq(ctx, [page] + cols, t, color, 1.8, alpha, key=key)
    if seal_t > 0:
        sketch.fill(ctx, rect_pts(x + 8 * s, y + 18 * s, 20 * s, 20 * s), red, alpha * ease_out(seal_t))


def letter(ctx, x, y, s, color, alpha=1.0, t=1.0, key="letter"):
    env = rect_pts(x - 40 * s, y - 26 * s, 80 * s, 52 * s, 3)
    flap = np.array([[x - 40 * s, y - 26 * s], [x, y + 4 * s], [x + 40 * s, y - 26 * s]])
    speed = [line_pts(x - 70 * s, y + k * 12 * s, x - 50 * s, y + k * 12 * s) for k in (-1, 0, 1)]
    seq(ctx, [env, flap] + speed, t, color, 2.0, alpha, key=key)


def abacus(ctx, x, y, w, h, color, alpha=1.0, t=1.0, rods=9, state=None, bead_color=None, key="abacus"):
    """算盘（上二下五）。state: 每档 (上珠拨下数, 下珠拨上数)。"""
    frame = rect_pts(x, y, w, h, 6)
    beam_y = y + h * 0.32
    beam = line_pts(x, beam_y, x + w, beam_y)
    gap = w / (rods + 1)
    rod_paths = [line_pts(x + gap * (i + 1), y + 6, x + gap * (i + 1), y + h - 6) for i in range(rods)]
    seq(ctx, [frame, beam] + rod_paths, t, color, 2.2, alpha, key=key)
    if t < 0.6:
        return
    ba = alpha * ease_out(prog(t, 0.6, 1.0))
    bw, bh = gap * 0.78, h * 0.085
    for i in range(rods):
        cx = x + gap * (i + 1)
        up, lo = (0, 0) if state is None else state[i]
        # 上珠 2 颗：靠上框为未拨；拨下 up 颗贴梁
        for k in range(2):
            moved = k >= 2 - up
            cy = (beam_y - bh * (0.6 + (1 - k) * 1.05)) if moved else (y + 6 + bh * (0.6 + k * 1.05))
            _bead(ctx, cx, cy, bw, bh, bead_color if (moved and bead_color) else color, ba)
        for k in range(5):
            moved = k < lo
            cy = (beam_y + bh * (0.6 + k * 1.05)) if moved else (y + h - 6 - bh * (0.6 + (4 - k) * 1.05))
            _bead(ctx, cx, cy, bw, bh, bead_color if (moved and bead_color) else color, ba)


def _bead(ctx, cx, cy, bw, bh, color, alpha):
    p = np.array([[cx - bw / 2, cy], [cx - bw / 4, cy - bh / 2], [cx + bw / 4, cy - bh / 2], [cx + bw / 2, cy],
                  [cx + bw / 4, cy + bh / 2], [cx - bw / 4, cy + bh / 2], [cx - bw / 2, cy]])
    sketch.fill(ctx, p, color, alpha * 0.35)
    sketch.stroke(ctx, p, 1, color, 1.6, alpha, rough=0)


def ledger(ctx, x, y, w, h, color, alpha=1.0, t=1.0, cols=10, key="ledger", marks=None, red=None):
    """摊开的账册：两页，竖行格线（不写伪文字）。marks: 朱红勾记的 (页, 列)。"""
    left = rect_pts(x, y, w / 2, h, 2)
    right = rect_pts(x + w / 2, y, w / 2, h, 2)
    spine = line_pts(x + w / 2, y - 6, x + w / 2, y + h + 6)
    paths = [left, right, spine]
    for pg in range(2):
        for c in range(cols):
            xx = x + pg * w / 2 + (c + 1) * (w / 2) / (cols + 1)
            paths.append(line_pts(xx, y + 16, xx, y + h - 16))
    seq(ctx, paths, t, color, 1.6, alpha, key=key, rough=0.4, tip=False)
    if marks and red is not None and t >= 1:
        for pg, c in marks:
            xx = x + pg * w / 2 + (c + 1) * (w / 2) / (cols + 1)
            sketch.check(ctx, xx, y + h * 0.3, 16, red, alpha)


def gear(ctx, cx, cy, r, teeth, ang, color, alpha=1.0, width=2.0, t=1.0, key=None):
    pts = []
    n = teeth * 4
    for i in range(n + 1):
        a = ang + 2 * math.pi * i / n
        rr = r * (1.12 if (i % 4) in (1, 2) else 0.92)
        pts.append((cx + rr * math.cos(a), cy + rr * math.sin(a)))
    sketch.stroke(ctx, np.array(pts), t, color, width, alpha, rough=0)
    sketch.ring(ctx, cx, cy, r * 0.28, color, width, alpha, t=t)
    if t >= 1:
        for k in range(3):
            a = ang + k * 2 * math.pi / 3
            sketch.stroke(ctx, np.array([[cx + r * 0.28 * math.cos(a), cy + r * 0.28 * math.sin(a)],
                                         [cx + r * 0.8 * math.cos(a), cy + r * 0.8 * math.sin(a)]]), 1, color,
                          width * 0.8, alpha * 0.8, rough=0)


def stopwatch(ctx, cx, cy, r, ang, color, red, alpha=1.0, t=1.0):
    sketch.ring(ctx, cx, cy, r, color, 2.4, alpha, t=t)
    sketch.stroke(ctx, rect_pts(cx - 8, cy - r - 20, 16, 14, 3), t, color, 2, alpha, rough=0)
    if t >= 1:
        for k in range(12):
            a = k * math.pi / 6
            sketch.stroke(ctx, np.array([[cx + r * 0.82 * math.cos(a), cy + r * 0.82 * math.sin(a)],
                                         [cx + r * 0.94 * math.cos(a), cy + r * 0.94 * math.sin(a)]]), 1, color, 1.6,
                          alpha, rough=0)
        sketch.stroke(ctx, np.array([[cx, cy], [cx + r * 0.78 * math.cos(ang - math.pi / 2),
                                                  cy + r * 0.78 * math.sin(ang - math.pi / 2)]]), 1, red, 2.6, alpha,
                      rough=0)
        sketch.dot(ctx, cx, cy, 4, red, alpha)


def factory(ctx, x, y, w, h, color, alpha=1.0, t=1.0, key="factory"):
    """19世纪式厂房：锯齿屋顶、烟囱、窗格。(x, y) 左下角。"""
    n = 5
    tw = w / n
    roof = [(x, y - h * 0.55)]
    for i in range(n):
        roof += [(x + i * tw, y - h * 0.8), (x + (i + 1) * tw, y - h * 0.55)]
    walls = np.array([(x, y - h * 0.55), (x, y), (x + w, y), (x + w, y - h * 0.55)])
    chim = [rect_pts(x + w * 0.12, y - h * 1.15, w * 0.05, h * 0.4), rect_pts(x + w * 0.8, y - h * 1.05, w * 0.05, h * 0.3)]
    wins = []
    for i in range(8):
        wx = x + w * 0.06 + i * w * 0.115
        wins.append(rect_pts(wx, y - h * 0.4, w * 0.07, h * 0.2))
    seq(ctx, [walls, np.array(roof)] + chim + wins, t, color, 2.0, alpha, key=key)


def smoke(ctx, x, y, s, phase, color, alpha=1.0):
    for k in range(3):
        a = alpha * (0.5 - 0.14 * k)
        pts = circle_pts(x + (k * 22 + phase * 20) * s, y - (k * 30 + phase * 26) * s, (12 + k * 6) * s, 30)
        sketch.stroke(ctx, pts, 1, color, 1.4, a, rough=0)


def card(ctx, x, y, w, h, title, color, alpha=1.0, t=1.0, fill=None, title_size=26, key=None, font_key="sans",
         lines=0, border_color=None, width=2.0, title_color=None):
    sketch.box(ctx, x, y, w, h, border_color or color, alpha, width, fill_color=fill, fill_alpha=1.0 if fill else 0,
               r=10, t=t, key=key)
    if t >= 0.6 and title:
        a = alpha * ease_out(prog(t, 0.6, 1.0))
        draw_text(ctx, title, x + w / 2, y + h / 2 if not lines else y + title_size + 12, title_size,
                  (*(title_color or color)[:3], a), key=font_key, align="center",
                  valign="middle" if not lines else "baseline")
    if lines and t >= 1:
        for k in range(lines):
            yy = y + title_size + 30 + k * 18
            if yy > y + h - 10:
                break
            sketch.stroke(ctx, line_pts(x + 18, yy, x + w - 18 - (k % 2) * w * 0.25, yy), 1, color, 1.4, alpha * 0.5,
                          rough=0)


def book(ctx, x, y, w, h, color, alpha=1.0, t=1.0, key="book"):
    cover = rect_pts(x, y, w, h, 4)
    spine = line_pts(x + 18, y, x + 18, y + h)
    pages = [line_pts(x + w, y + 6 + k * 5, x + w + 10, y + 12 + k * 5) for k in range(3)]
    seq(ctx, [cover, spine] + pages, t, color, 2.2, alpha, key=key)


def gate(ctx, x, y, h, open_t, color, red, alpha=1.0, t=1.0):
    """审批门：两根门柱 + 可抬起的横杆（朱红）。(x, y) 为门中心底部。"""
    w = h * 0.55
    posts = [rect_pts(x - w / 2 - 10, y - h, 20, h, 4), rect_pts(x + w / 2 - 10, y - h, 20, h, 4)]
    lintel = line_pts(x - w / 2 - 22, y - h - 8, x + w / 2 + 22, y - h - 8)
    seq(ctx, posts + [lintel], t, color, 2.2, alpha, key="gate")
    if t >= 1:
        ang = -open_t * math.pi * 0.45
        px, py = x - w / 2 + 10, y - h * 0.45
        L = w - 20
        sketch.stroke(ctx, np.array([[px, py], [px + L * math.cos(ang), py + L * math.sin(ang)]]), 1, red, 6, alpha,
                      rough=0)
        sketch.dot(ctx, px, py, 7, red, alpha)
