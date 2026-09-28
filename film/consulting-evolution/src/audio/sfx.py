"""音效：全部由分镜事件、书法笔顺表与印章事件生成——与画面引用同一份节拍网格。

印章接触音的瞬态起点 = 接触帧 × 1600（整数采样）。
"""
import numpy as np

from .. import timeline as T
from ..scenes.base import bframe
from ..storyboard import KW_WRITE, SHOTS, by_id, seal_events
from ..visuals import hanzi
from .score import S


def _sample_of_beat(ch, beat):
    """与画面一致：先量化到帧，再换算采样（保证音画同帧）。"""
    return bframe(ch, beat) * T.SAMPLES_PER_FRAME


class Cue:
    def __init__(self, sample, make, gain=1.0, pan=0.0, send=0.15, tag=""):
        self.sample, self.make, self.gain, self.pan, self.send, self.tag = sample, make, gain, pan, send, tag


def brush_cues():
    out = []
    for ch in T.CHAPTERS:
        w0, w1 = KW_WRITE[ch.id]
        for i, (a, b) in enumerate(hanzi.schedule(ch.key)):
            b0 = w0 + a * (w1 - w0)
            b1 = w0 + b * (w1 - w0)
            s0 = _sample_of_beat(ch.id, b0)
            dur = (bframe(ch.id, b1) - bframe(ch.id, b0)) / T.FPS
            out.append(Cue(s0, (lambda d=dur, i=i, c=ch.id: S.brush(max(0.08, d), 0.55, seed=c * 100 + i)), 1.0,
                           -0.35, 0.1, f"brush:{ch.key}{i}"))
    return out


def seal_cues():
    out = []
    for ch, beat, name, w in seal_events():
        s0 = _sample_of_beat(ch, beat)
        out.append(Cue(s0, (lambda w=w, n=name: S.seal_impact(w, seed=n)), 0.5, 0.0, 0.25, f"seal:{name}"))
    return out


def _ev(shot_id, name):
    sh = by_id()[shot_id]
    return sh.chapter, sh.events[name]


def action_cues():
    """每个镜头的主要动作音（事件名 → 声音）。"""
    c = []

    def at(shot, name, make, gain=1.0, pan=0.0, send=0.15, offset=0.0):
        ch, b = _ev(shot, name)
        c.append(Cue(_sample_of_beat(ch, b + offset), make, gain, pan, send, f"{shot}:{name}"))

    def atb(ch, beat, make, gain=1.0, pan=0.0, send=0.15, tag=""):
        c.append(Cue(_sample_of_beat(ch, beat), make, gain, pan, send, tag))

    # 00
    for i, q in enumerate(("q1", "q2", "q3", "q4")):
        at("S00-1", q, lambda i=i: S.wood(0.3, 1200 + 150 * i, seed=i), 0.8, -0.3 + 0.2 * i)
    atb(0, 0.0, lambda: S.swoosh(1.2, 0.35), 0.8, -0.4, 0.2, "line-start")
    at("S00-2", "choose", lambda: S.bell(86, 1.5, 0.35), 0.8, 0.3, 0.3)
    at("S00-3", "title", lambda: S.swoosh(0.8, 0.3, up=False), 0.7, 0, 0.3)
    # 01
    at("S01-1", "map", lambda: S.paper(0.8, 0.45), 0.9, 0.2)
    atb(1, 8.0, lambda: S.swoosh(0.5, 0.3), 0.8, 0.2, 0.2, "slips-open")
    for k in range(9):
        atb(1, 8.0 + k * 0.13, lambda k=k: S.wood(0.25, 700 + 30 * k, seed=k), 0.7, 0.4 - 0.08 * k, 0.15, "slip")
    for w in ("w1", "w2", "w3"):
        at("S01-2", w, lambda w=w: S.brush(0.7, 0.5, seed=w), 1.0, 0.2)
    for k in range(7):
        at("S01-2", "rods_a", lambda k=k: S.wood(0.35, 1500, seed=20 + k), 0.8, -0.3 + 0.1 * k, 0.15, offset=k * 0.18)
    at("S01-2", "rods_b", lambda: S.swoosh(0.9, 0.3), 0.8, 0.2)
    for k in range(3):
        at("S01-3", "nodes", lambda k=k: S.wood(0.4, 820, seed=40 + k), 0.9, -0.2 + 0.2 * k, offset=k * 0.5)
    at("S01-3", "confirm", lambda: S.bell(76, 2.0, 0.4), 0.9, 0.2, 0.35)
    # 02
    at("S02-1", "warehouse", lambda: S.wood(0.4, 520, seed=3), 1.0, 0.1)
    for n in ("goods", "money", "trust"):
        at("S02-2", n, lambda n=n: S.wood(0.5, 980, seed=len(n)), 1.0, 0.0)
    at("S02-2", "links", lambda: S.swoosh(0.8, 0.3), 0.8)
    for i, n in enumerate(("bead1", "bead2", "bead3", "bead4")):
        at("S02-3", n, lambda i=i: S.wood(0.55, 2200, seed=60 + i), 1.0, -0.3)
        at("S02-3", n, lambda i=i: S.wood(0.35, 2600, seed=70 + i), 0.8, -0.3, offset=0.12)
    at("S02-3", "msg", lambda: S.swoosh(1.2, 0.3), 0.8, 0.2)
    at("S02-3", "arrive", lambda: S.bell(81, 1.5, 0.3), 0.8, 0.4, 0.3)
    at("S02-4", "grid", lambda: S.paper(0.5, 0.5, seed=2), 1.0)
    at("S02-4", "machine", lambda: S.metal_tick(0.8, seed=3), 1.0)
    # 03
    at("S03-1", "gears", lambda: S.drum_low(0.3, f0=180, f1=90, decay=0.25, seed=5), 1.0)
    for i in range(5):
        at("S03-2", "cards", lambda i=i: S.paper(0.18, 0.4, seed=30 + i), 0.9, -0.4 + 0.2 * i, offset=i * 0.5)
    at("S03-2", "improve", lambda: S.pluck(74, 0.4, 0.7, bright=0.9), 1.0, 0.1, 0.25)
    at("S03-3", "book", lambda: S.drum_low(0.25, f0=160, f1=80, decay=0.2, seed=6), 1.0)
    at("S03-3", "anchor", lambda: S.bell(74, 2.0, 0.4), 0.9, 0.3, 0.35)
    at("S03-4", "org", lambda: S.swoosh(0.6, 0.3), 0.8)
    at("S03-4", "desk", lambda: S.paper(0.6, 0.4, seed=8), 0.9)
    # 04
    at("S04-1", "anchor", lambda: S.bell(74, 2.0, 0.35), 0.8, 0.3, 0.35)
    for i in range(6):
        at("S04-1", "docs", lambda i=i: S.paper(0.25, 0.4, seed=50 + i), 0.9, -0.3 + 0.12 * i, offset=i * 0.45)
    at("S04-2", "anchor", lambda: S.bell(76, 2.0, 0.35), 0.8, 0.3, 0.35)
    at("S04-2", "flip", lambda: S.paper(0.3, 0.5, seed=9), 1.0)
    at("S04-2", "keep", lambda: S.blip(1320, 0.12, 0.5), 0.8)
    at("S04-2", "drop", lambda: S.pluck(38, 0.6, 0.8, bright=0.4), 1.0)
    at("S04-3", "anchor", lambda: S.bell(78, 2.0, 0.35), 0.8, 0.3, 0.35)
    for i in range(4):
        at("S04-3", "quads", lambda i=i: S.pluck((62, 66, 69, 71)[i], 0.3, 0.5), 0.8, -0.3 + 0.2 * i, 0.2,
           offset=0.6 + i * 0.6)
    for i in range(8):
        at("S04-3", "bubbles", lambda i=i: S.blip(900 + 90 * i, 0.08, 0.35), 0.7, -0.4 + 0.1 * i, offset=i * 0.2)
    at("S04-4", "circuit", lambda: S.swoosh(1.0, 0.35), 0.9, 0.0, 0.2)
    # 05
    at("S05-1", "move", lambda: S.swoosh(1.5, 0.25), 0.8)
    for i in range(4):
        at("S05-1", "digitize", lambda i=i: S.blip(1400 + 200 * i, 0.06, 0.4), 0.8, -0.2 + 0.15 * i, offset=i * 0.5)
    for i in range(6):
        at("S05-2", "connect", lambda i=i: S.blip(1800 + 120 * i, 0.05, 0.35), 0.7, -0.4 + 0.15 * i, offset=i * 0.25)
    at("S05-2", "knot", lambda: S.tension(1.2, 0.5), 1.0)
    for i in range(4):
        at("S05-3", f"r{i + 1}", lambda i=i: S.wood(0.45, 1300, seed=80 + i), 1.0, -0.2 + 0.13 * i)
    at("S05-4", "stuck", lambda: S.tension(1.5, 0.45), 1.0)
    # 06
    for i in range(6):
        atb(6, 3.0 - 1.0 + i * 0.35 + 1.4, lambda i=i: S.wood(0.4, 780 + 40 * i, seed=90 + i), 0.9,
            -0.5 + 0.2 * i, 0.15, "slip-land")
    for i, m in enumerate([59, 62, 64, 66, 69, 66]):   # 六枚竹简翻转：六声组成主题
        ch, b = _ev("S06-2", "flip0")
        atb(6, b + i * 1.5 + 0.4, lambda m=m: S.pluck(m + 12, 0.8, 0.8, bright=0.7), 1.0, -0.5 + 0.2 * i, 0.3,
            "flip-note")
    for i in range(5):
        at("S06-3", "extract", lambda i=i: S.blip(1500 + 150 * i, 0.06, 0.45), 0.9, 0.2, offset=i * 0.8)
    at("S06-3", "pending", lambda: S.blip(660, 0.18, 0.5), 0.9)
    for i in range(3):
        at("S06-3", "sources", lambda i=i: S.blip(2400, 0.05, 0.35), 0.8, 0.4, offset=i * 0.5)
    at("S06-4", "arrive", lambda: S.paper(0.25, 0.5, seed=12), 0.9)
    at("S06-4", "exception", lambda: S.tension(0.9, 0.45), 0.9, -0.2)
    at("S06-5", "follow", lambda: S.swoosh(0.7, 0.3), 0.8)
    for i in range(5):
        for k in range(6):
            at("S06-5", "log", lambda i=i, k=k: S.metal_tick(0.25, seed=i * 6 + k), 0.6, 0.3,
               offset=i * 1.0 + k * 0.12)
    at("S06-5", "loop", lambda: S.swoosh(1.2, 0.35, up=False), 0.9)
    for i in range(7):
        at("S06-6", "run", lambda i=i: S.blip(1200 + 100 * i, 0.05, 0.4), 0.8, -0.4 + 0.13 * i,
           offset=i * 1.0 + (1.0 if i > 3 else 0.0))
    # 07
    at("S07-1", "converge", lambda: S.swoosh(2.0, 0.3, up=False), 0.8, 0, 0.3)
    for i, n in enumerate(("s1", "s2", "s3", "s4")):
        at("S07-2", n, lambda i=i: S.bell((74, 76, 78, 81)[i], 2.0, 0.35), 0.8, -0.3 + 0.2 * i, 0.4)
    for i, n in enumerate(("v1", "v2", "v3", "v4")):
        at("S07-3", n, lambda i=i: S.pluck((62, 66, 69, 74)[i], 1.0, 0.5, bright=0.5), 0.8, -0.3 + 0.2 * i, 0.3)
    return c


def all_cues():
    return brush_cues() + seal_cues() + action_cues()


def render(cues, n_total=T.TOTAL_SAMPLES):
    from .score import pan_gains
    dry = np.zeros((n_total, 2))
    send = np.zeros((n_total, 2))
    for cu in cues:
        x = cu.make() * cu.gain
        s0 = cu.sample
        x = x[: n_total - s0]
        gl, gr = pan_gains(cu.pan)
        dry[s0:s0 + len(x), 0] += x * gl
        dry[s0:s0 + len(x), 1] += x * gr
        send[s0:s0 + len(x), 0] += x * gl * cu.send
        send[s0:s0 + len(x), 1] += x * gr * cu.send
    return dry, send
