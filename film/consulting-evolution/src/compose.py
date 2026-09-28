"""单帧合成：frame_index → 画面。完全由帧号决定，不依赖实时播放。

图层：背景（章节冲击时圆形揭示）→ 镜头内容 → 书法关键词 → HUD → 印章转场 → 字幕（可选）。
"""
import math

import cairo

from . import timeline as T
from .scenes import REGISTRY, load_all
from .scenes.base import S, bframe
from .storyboard import KW_WRITE, SHOTS, shot_at
from .visuals import hanzi, hud, motifs, paper
from .visuals.core import clamp, ease_in, ease_in_out, ease_out, lerp, prog, rgba
from .visuals.seal import draw_seal
from .visuals.style import style_for
from .visuals.text import draw_text

W, H = 1920, 1080
PRE = 6                     # 印章落下前的下降帧数
CENTER = (960, 500)


def seal_contact_frames():
    """每章首拍 = 印章接触帧（第 1–7 章）。音效用同一列表。"""
    return [T.chapter_start_frame(c.id) for c in T.CHAPTERS[1:]]


def _transition_state(frame):
    """返回 (新章 id, 相对接触帧的帧差, 该章每拍帧数)；不在转场窗口内返回 None。"""
    for c in T.CHAPTERS[1:]:
        f0 = T.chapter_start_frame(c.id)
        d = frame - f0
        if -PRE <= d < c.frames_per_beat * 2:
            return c.id, d, c.frames_per_beat
    return None


def _ring_radius(d, fpb):
    t = clamp(d / (fpb * 1.1))
    return lerp(90, 1250, ease_out(t)), t


def draw_background(ctx, frame, ch_id):
    ctx.set_source_surface(paper.background(style_for(ch_id).bg, W, H), 0, 0)
    ctx.paint()
    tr = _transition_state(frame)
    if tr and tr[1] >= 0 and tr[0] == ch_id:
        new, d, fpb = tr
        R, t = _ring_radius(d, fpb)
        if t < 1:
            # 圆外仍是上一章背景
            ctx.save()
            ctx.rectangle(0, 0, W, H)
            ctx.arc_negative(CENTER[0], CENTER[1], R, 2 * math.pi, 0)
            ctx.set_fill_rule(cairo.FILL_RULE_EVEN_ODD)
            ctx.clip()
            ctx.set_source_surface(paper.background(style_for(new - 1).bg, W, H), 0, 0)
            ctx.paint()
            ctx.restore()


def _kw_state(shot, bc):
    """关键词位置、大小、书写进度。"""
    ch = shot.chapter
    first = [s for s in SHOTS if s.chapter == ch][0]
    w0, w1 = KW_WRITE[ch]
    progress = clamp((bc - w0) / (w1 - w0))
    x, y, size = shot.kw
    if shot is not first:
        idx = SHOTS.index(shot)
        prev = SHOTS[idx - 1]
        if prev.chapter == ch and prev.kw != shot.kw:
            k = ease_in_out(prog(bc, shot.b0, shot.b0 + 1.0))
            x = lerp(prev.kw[0], x, k)
            y = lerp(prev.kw[1], y, k)
            size = lerp(prev.kw[2], size, k)
    return x, y, size, progress


def chapter_exit(ch_id, bc):
    """章末半拍内容收束。第 0 章的片名保留到最后一拍中段。"""
    beats = T.CHAPTERS[ch_id].beats
    if ch_id == 7:
        return 1.0
    return 1.0 - ease_in(prog(bc, beats - 0.5, beats - 0.05))


def draw_transition(ctx, frame):
    tr = _transition_state(frame)
    if not tr:
        return False
    new, d, fpb = tr
    numeral = T.CHAPTERS[new].numeral
    st = style_for(new)
    hx, hy, hs = hud.seal_home()
    big = 230 if new < 7 else 260
    if d < 0:
        k = (d + PRE) / PRE                      # 0 → 1 下降
        sc = lerp(1.7, 1.0, ease_in(k))
        ctx.save()
        draw_seal(ctx, numeral, CENTER[0] + 10 * (1 - k), CENTER[1] + 14 * (1 - k), big * sc * 1.02,
                  alpha=0.25 * k, rot=0.0)  # 投影
        draw_seal(ctx, numeral, CENTER[0], CENTER[1], big * sc, alpha=ease_out(k))
        ctx.restore()
        return True
    R, t = _ring_radius(d, fpb)
    # 冲击纹样环（新章母题）
    kind = motifs.CHAPTER_MOTIF[new]
    a = (1 - t) ** 1.3
    motifs.draw_ring(ctx, kind, CENTER[0], CENTER[1], R, 56 + 40 * t, st.line, alpha=a, width=3.0)
    motifs.draw_ring(ctx, kind, CENTER[0], CENTER[1], R * 0.62, 34, st.acc if new != 6 else st.red, alpha=0.8 * a,
                     width=2.2, phase=0.3)
    # 印章：接触帧轻微压扁回弹，停留约 0.75 拍后飞回左上角
    squash = 1.0 - 0.06 * math.exp(-d / 2.0) * (1 if d < 6 else 0)
    fly = ease_in_out(prog(d, fpb * 0.75, fpb * 1.6))
    x = lerp(CENTER[0], hx, fly)
    y = lerp(CENTER[1], hy, fly)
    size = lerp(big * squash, hs, fly)
    if fly < 1:
        draw_seal(ctx, numeral, x, y, size, alpha=1.0)
    return fly < 1


def render_frame(frame, scale=1.0, subtitles=None, layout="h"):
    load_all()
    w, h = int(round(W * scale)), int(round(H * scale))
    surf = cairo.ImageSurface(cairo.FORMAT_RGB24, w, h)
    ctx = cairo.Context(surf)
    ctx.scale(scale, scale)
    shot = shot_at(frame)
    ch_id = shot.chapter
    st = style_for(ch_id)
    s = S(ctx, st, shot, frame, layout)
    draw_background(ctx, frame, ch_id)
    ex = chapter_exit(ch_id, s.bc)
    # 镜头内容
    ctx.push_group()
    REGISTRY[shot.id](s)
    # 书法关键词
    x, y, size, progress = _kw_state(shot, s.bc)
    hanzi.draw_char(ctx, shot.keyword, x, y, size, progress, st.kw, 1.0, texture_key=st.kind)
    ctx.pop_group_to_source()
    ctx.paint_with_alpha(ex)
    # HUD
    tr = _transition_state(frame)
    in_flight = tr is not None and tr[0] == ch_id and tr[1] >= 0 and tr[1] < tr[2] * 1.6
    draw_hud(ctx, ch_id, s.bc, st, seal_visible=not in_flight)
    # 印章转场
    draw_transition(ctx, frame)
    if subtitles is not None:
        draw_subtitle(ctx, frame, subtitles)
    surf.flush()
    return surf


def draw_hud(ctx, ch_id, bc, st, seal_visible):
    hud.draw_hud(ctx, ch_id, bc, st, seal_visible=seal_visible)


SUB_Y = 966
SUB_SIZE = 48


def draw_subtitle(ctx, frame, cues):
    from .subtitles import cue_at
    c = cue_at(cues, frame)
    if not c:
        return
    a = clamp((frame - c["start_frame"]) / 3.0) * clamp((c["end_frame"] - frame) / 3.0)
    draw_text(ctx, c["text"], 960, SUB_Y, SUB_SIZE, (*rgba("rice_white")[:3], a), key="sans", align="center",
              stroke=((0.04, 0.04, 0.04, 0.72 * a), 7.0))
