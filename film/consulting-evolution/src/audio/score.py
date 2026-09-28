"""原创配乐：D 宫五声音阶（D E F# A B）。

主题（原创短动机，两小节）：
  问句 Q：6̣ 1 2 3 — | 5 3 2 2 —    （停在 2，未解决）
  答句 A：3 5 6 5 3 | 2 1 6̣ 1 —    （回到 1）
同一条动机在不同章节由不同音色接力：骨笛感 → 笛与钟 → 弹拨 → 机械与弦乐 → 弦乐与铜管 → 电子脉冲 → 管弦全奏 + 电子节律 → 半拍感舒展，最后回到笛与钟。
所有音符位置取自 timeline 的整数采样网格（本片每拍采样数均可被 4 整除）。
"""
from dataclasses import dataclass, field
from fractions import Fraction

import numpy as np

from .. import timeline as T
from . import synth as S

# 动机：(MIDI, 拍)
Q = [(59, 1), (62, .5), (64, .5), (66, 2), (69, 1), (66, .5), (64, .5), (64, 2)]
A = [(66, 1), (69, .5), (71, .5), (69, 1), (66, 1), (64, 1), (62, .5), (59, .5), (62, 2)]
Q_END = [(59, 1), (62, .5), (64, .5), (66, 2), (64, 1), (62, .5), (59, .5), (62, 4)]

CHORDS = {
    "VI": dict(root=35, notes=[47, 54, 59, 62]),       # Bm
    "II": dict(root=40, notes=[52, 59, 64, 66]),       # E sus2（E B E F#）
    "I": dict(root=38, notes=[50, 57, 62, 66]),        # D
    "V": dict(root=33, notes=[45, 52, 57, 59, 64]),    # A sus2（A E A B E）
}
CYCLE = ["VI", "II", "I", "V"]


def spb(ch):
    return T.CHAPTERS[ch].samples_per_beat


def pos(ch, beat):
    """章内拍 → 全片采样（1/4 拍及以上为精确整数；更细的装饰音四舍五入）。"""
    return T.CH_START_FRAME[ch] * T.SAMPLES_PER_FRAME + int(round(float(beat) * spb(ch)))


def secs(ch, beats):
    return beats * spb(ch) / S.SR


@dataclass
class Ev:
    start: int
    make: object          # () -> np.ndarray
    gain: float = 1.0
    pan: float = 0.0
    send: float = 0.3
    tag: str = ""


@dataclass
class Score:
    events: list = field(default_factory=list)
    mutes: list = field(default_factory=list)   # (起采样, 止采样, 起增益, 止增益)
    posf: object = None                          # 其他节拍网格（竖版）可替换位置与时长换算
    secf: object = None

    def _pos(self, ch, beat):
        return (self.posf or pos)(ch, beat)

    def _secs(self, ch, beats):
        return (self.secf or secs)(ch, beats)

    def add(self, ch, beat, make, gain=1.0, pan=0.0, send=0.3, tag=""):
        self.events.append(Ev(self._pos(ch, beat), make, gain, pan, send, tag))

    def melody(self, fn, ch, beat, motif, scale=1.0, transpose=0, gain=1.0, pan=0.0, send=0.35, legato=0.96,
               tag="melody", **kw):
        b = beat
        for i, (m, d) in enumerate(motif):
            dur = self._secs(ch, d * scale) * legato
            mm = m + transpose
            self.add(ch, b, (lambda mm=mm, dur=dur, i=i: fn(mm, dur, seed=i, **kw)), gain, pan, send, tag)
            b += d * scale

    def chord(self, fn, ch, beat, name, beats, gain=1.0, send=0.4, spread=0.5, octave=0, tag="chord", **kw):
        notes = CHORDS[name]["notes"]
        for i, m in enumerate(notes):
            p = -spread + 2 * spread * i / max(1, len(notes) - 1)
            self.add(ch, beat, (lambda m=m + octave, i=i, d=self._secs(ch, beats): fn(m, d, seed=i, **kw)), gain, p,
                     send, tag)

    def bass(self, fn, ch, beat, name, beats, gain=1.0, **kw):
        r = CHORDS[name]["root"]
        d = self._secs(ch, beats)
        self.add(ch, beat, lambda: fn(r, d, **kw), gain, 0.0, 0.1, "bass")

    def mute(self, ch, b0, b1, g0, g1, ch1=None):
        self.mutes.append((self._pos(ch, b0), self._pos(ch if ch1 is None else ch1, b1), g0, g1))


def compose():
    sc = Score()

    # ── 00 问（60 BPM，16 拍）：骨笛感气息、远处低鼓、留白 ──
    sc.add(0, 0, lambda: S.pad(38, secs(0, 13.5), 0.5), 0.8, 0, 0.5, "drone")
    sc.add(0, 0, lambda: S.pad(45, secs(0, 13.5), 0.4, seed=1), 0.6, 0.2, 0.5, "drone")
    sc.add(0, 0.0, lambda: S.drum_low(0.35, decay=1.2), 0.9, 0, 0.5, "drum")
    sc.add(0, 8.0, lambda: S.drum_low(0.3, decay=1.2, seed=1), 0.9, 0, 0.5, "drum")
    sc.melody(S.flute, 0, 4, Q, gain=0.75, pan=-0.1, send=0.45)
    sc.add(0, 12, lambda: S.bell(74, 3.0, 0.5), 0.8, -0.2, 0.5, "bell")
    sc.add(0, 12, lambda: S.bell(81, 3.0, 0.35, seed=1), 0.7, 0.2, 0.5, "bell")
    sc.mute(0, 14.5, 15.0, 1.0, 0.0)          # 第 15 拍：一拍停顿（音乐静止）
    sc.mute(0, 15.0, 0, 0.0, 0.0, ch1=1)
    sc.mute(1, 0, 0.001, 0.0, 1.0)

    # ── 01 谋（72 BPM，24 拍）：笛、编钟感金属共鸣、稀疏低鼓 ──
    for bar, name in enumerate(["VI", "II", "I", "V", "VI", "V"]):
        sc.chord(S.pad, 1, bar * 4, name, 4, gain=0.55, send=0.5)
        sc.add(1, bar * 4, lambda b=bar: S.drum_low(0.3 if b else 0.6, decay=1.0, seed=b), 0.9, 0, 0.4, "drum")
        if 1 <= bar <= 4:
            sc.add(1, bar * 4 + 2.5, lambda b=bar: S.drum_low(0.15, decay=0.6, seed=b + 10), 0.8, 0.1, 0.4, "drum")
    sc.add(1, 0, lambda: S.bell(62, 4.0, 0.6), 0.8, -0.1, 0.5, "bell")
    sc.melody(S.flute, 1, 4, Q, gain=0.8, pan=-0.1)
    sc.melody(S.flute, 1, 12, A, gain=0.8, pan=-0.1)
    for b, m in ((4, 71), (8, 69), (12, 66), (16, 64)):
        sc.add(1, b, lambda m=m: S.bell(m + 12, 2.5, 0.25, seed=m), 0.7, 0.25, 0.6, "bell")
    sc.add(1, 20, lambda: S.flute(69, secs(1, 3.5), 0.6, seed=9), 0.7, -0.1, 0.45, "melody")

    # ── 02 商（90 BPM，32 拍）：拨弦、木质敲击 ──
    sc.add(2, 0, lambda: S.drum_low(0.55, decay=0.9), 0.9, 0, 0.4, "drum")
    for i, m in enumerate(CHORDS["I"]["notes"]):
        sc.add(2, i * 0.08, lambda m=m, i=i: S.pluck(m, 2.0, 0.5, seed=i), 0.8, -0.3 + 0.2 * i, 0.3, "pluck")
    for bar in range(8):
        name = CYCLE[(bar + 2) % 4]
        sc.chord(S.pad, 2, bar * 4, name, 4, gain=0.35, send=0.5)
        for b in (0, 2):
            sc.add(2, bar * 4 + b, lambda n=name, b=b: S.pluck(CHORDS[n]["root"] + 12, 0.5, 0.6, bright=0.3, seed=b),
                   0.9, 0.0, 0.1, "bass")
        for k in range(4):
            sc.add(2, bar * 4 + k + 0.5, lambda k=k: S.wood(0.25, 1100, seed=k), 0.6, 0.35, 0.15, "wood")
            if k in (1, 3):
                sc.add(2, bar * 4 + k, lambda k=k: S.wood(0.35, 760, seed=k + 5), 0.6, -0.35, 0.15, "wood")
    sc.melody(S.pluck, 2, 0, Q, gain=0.9, pan=0.15, send=0.3)
    sc.melody(S.pluck, 2, 8, A, gain=0.9, pan=0.15, send=0.3)
    sc.melody(S.pluck, 2, 16, Q, transpose=12, gain=0.7, pan=0.15, send=0.3)
    sc.melody(S.flute, 2, 16, Q, gain=0.5, pan=-0.2, send=0.4)
    sc.melody(S.pluck, 2, 24, A, gain=0.9, pan=0.15, send=0.3)
    sc.add(2, 24, lambda: S.flute(66, secs(2, 7.5), 0.45, seed=3), 0.6, -0.2, 0.45, "melody")

    # ── 03 管（100 BPM，40 拍）：规整机械节律，弦乐进入 ──
    sc.add(3, 0, lambda: S.timpani(38, 0.8), 0.9, 0, 0.3, "timp")
    for q in range(40 * 4):
        b = q / 4
        acc = 1.0 if q % 4 == 0 else 0.55
        sc.add(3, b, lambda q=q, acc=acc: S.metal_tick(0.22 * acc, seed=q % 7), 0.8, 0.3 if q % 2 else -0.3, 0.1,
               "tick")
    ost = [59, 62, 64, 66, 64, 62]
    for e in range(80):
        sc.add(3, e * 0.5, lambda e=e: S.pluck(ost[e % 6], 0.25, 0.4, bright=0.8, seed=e % 6), 0.55, -0.2, 0.15,
               "ostinato")
    for bar in range(2, 10):
        name = CYCLE[bar % 4]
        sc.chord(S.strings, 3, bar * 4, name, 4, gain=0.35 + 0.05 * bar, send=0.45)
        sc.add(3, bar * 4, lambda: S.timpani(38, 0.35), 0.7, 0, 0.3, "timp")
        sc.bass(S.sub_bass, 3, bar * 4, name, 3.8, gain=0.5)
    sc.melody(S.strings, 3, 20, Q, transpose=12, gain=1.3, pan=0.1, send=0.45, tag="melody")
    sc.melody(S.strings, 3, 28, A, transpose=12, gain=1.3, pan=0.1, send=0.45, tag="melody")

    # ── 04 略（112.5 BPM，40 拍）：弦乐层次扩大，克制铜管 ──
    sc.add(4, 0, lambda: S.timpani(38, 0.8), 0.9, 0, 0.3, "timp")
    for bar in range(10):
        name = CYCLE[(bar + 2) % 4]
        sc.chord(S.strings, 4, bar * 4, name, 4, gain=0.55, send=0.45)
        sc.bass(S.sub_bass, 4, bar * 4, name, 3.8, gain=0.55)
        if bar >= 4:
            sc.chord(S.brass, 4, bar * 4, name, 3.6, gain=0.35, send=0.4, octave=0)
            sc.add(4, bar * 4, lambda b=bar: S.timpani(CHORDS[CYCLE[(b + 2) % 4]]["root"] + 12, 0.4), 0.7, 0, 0.3,
                   "timp")
    sc.melody(S.strings, 4, 4, A, transpose=12, gain=1.3, pan=0.1)
    sc.melody(S.strings, 4, 12, Q, transpose=12, gain=1.3, pan=0.1)
    sc.melody(S.brass, 4, 24, A, gain=1.0, pan=-0.15, send=0.35)
    for e in range(16):
        sc.add(4, 32 + e * 0.5, lambda e=e: S.pulse(38 + (12 if e % 4 == 3 else 0), 0.2, 0.25 + 0.02 * e), 0.8, 0, 0.1,
               "pulse")

    # ── 05 联（120 BPM，48 拍）：低频脉冲与短音型；末段悬置 ──
    sc.add(5, 0, lambda: S.kick(0.8), 0.9, 0, 0.1, "kick")
    for bar in range(12):
        name = CYCLE[bar % 4] if bar < 9 else "II"
        stuck = bar >= 9
        sc.chord(S.pad, 5, bar * 4, name, 4, gain=0.35 if not stuck else 0.45, send=0.5)
        if not stuck:
            sc.bass(S.sub_bass, 5, bar * 4, name, 1.8, gain=0.7)
            sc.bass(S.sub_bass, 5, bar * 4 + 2, name, 1.8, gain=0.6)
            for b in (0, 2):
                sc.add(5, bar * 4 + b, lambda: S.kick(0.55), 0.8, 0, 0.05, "kick")
            for k in range(8):
                if k % 2 == 1:
                    sc.add(5, bar * 4 + k * 0.5, lambda k=k: S.hat(0.35, seed=k), 0.7, 0.3, 0.05, "hat")
                notes = CHORDS[name]["notes"]
                sc.add(5, bar * 4 + k * 0.5, lambda m=notes[k % len(notes)] + 12, k=k: S.pulse(m, 0.2, 0.35, seed=k),
                       0.6, -0.3 + 0.08 * k, 0.2, "arp")
        else:
            for b in range(4):
                sc.add(5, bar * 4 + b, lambda b=b: S.metal_tick(0.18, seed=b), 0.7, 0.2, 0.2, "tick")
    sc.melody(S.pulse, 5, 8, Q, transpose=12, gain=1.1, pan=0.1, send=0.3, decay=0.35)
    sc.melody(S.pulse, 5, 16, A, transpose=12, gain=1.1, pan=0.1, send=0.3, decay=0.35)
    sc.mute(5, 46.0, 47.5, 1.0, 0.35)
    sc.mute(5, 47.5, 48.0, 0.35, 0.35)
    sc.mute(6, 0, 0.001, 0.35, 1.0)

    # ── 06 行（150 BPM，80 拍，四组各 20 拍）：主题由管弦展开，叠加精确电子节律 ──
    sc.add(6, 0, lambda: S.timpani(38, 0.9), 1.0, 0, 0.3, "timp")
    sc.add(6, 0, lambda: S.bell(74, 3.0, 0.5), 0.8, 0.2, 0.5, "bell")
    for bar in range(20):
        name = CYCLE[bar % 4] if bar < 19 else "V"
        g = bar // 5
        sc.chord(S.strings if g >= 1 else S.pad, 6, bar * 4, name, 4, gain=0.4 + 0.08 * g, send=0.45)
        sc.add(6, bar * 4, lambda: S.kick(0.6), 0.8, 0, 0.05, "kick")
        for k in range(8):
            if k % 2 == 1 or g >= 2:
                sc.add(6, bar * 4 + k * 0.5, lambda k=k: S.hat(0.3 if k % 2 else 0.18, seed=k), 0.7, 0.3, 0.05, "hat")
        if g >= 1:
            sc.add(6, bar * 4 + 2, lambda: S.kick(0.5), 0.8, 0, 0.05, "kick")
            for b in (1, 3):
                sc.add(6, bar * 4 + b, lambda b=b: S.clap(0.4, seed=b), 0.6, -0.1, 0.25, "clap")
            sc.bass(S.sub_bass, 6, bar * 4, name, 1.9, gain=0.7)
            sc.bass(S.sub_bass, 6, bar * 4 + 2, name, 1.9, gain=0.6)
            notes = CHORDS[name]["notes"]
            for k in range(8):
                sc.add(6, bar * 4 + k * 0.5, lambda m=notes[k % len(notes)] + 12, k=k: S.pulse(m, 0.15, 0.3, seed=k),
                       0.5, 0.3 - 0.08 * k, 0.2, "arp")
        if g >= 2:
            sc.chord(S.brass, 6, bar * 4, name, 3.8, gain=0.25 + 0.1 * (g - 2), send=0.4)
        if g == 3:
            sc.add(6, bar * 4, lambda b=bar: S.timpani(CHORDS[CYCLE[b % 4]]["root"] + 12, 0.5), 0.8, 0, 0.3, "timp")
    sc.melody(S.flute, 6, 4, Q, gain=0.85, pan=-0.1)
    sc.melody(S.flute, 6, 12, A, gain=0.85, pan=-0.1)
    sc.melody(S.strings, 6, 20, A, transpose=12, gain=1.3, pan=0.1)
    sc.melody(S.strings, 6, 28, Q, transpose=12, gain=1.3, pan=0.1)
    sc.add(6, 48, lambda: S.bell(74, 3.0, 0.6), 0.9, -0.2, 0.5, "bell")
    sc.add(6, 48, lambda: S.bell(81, 3.0, 0.4, seed=2), 0.8, 0.2, 0.5, "bell")
    sc.add(6, 48, lambda: S.timpani(38, 0.8), 0.9, 0, 0.3, "timp")
    sc.melody(S.brass, 6, 60, Q, gain=1.1, pan=-0.1)
    sc.melody(S.strings, 6, 60, Q, transpose=12, gain=1.2, pan=0.15)
    sc.melody(S.brass, 6, 68, A, gain=1.1, pan=-0.1)
    sc.melody(S.strings, 6, 68, A, transpose=12, gain=1.2, pan=0.15)
    for b in (70, 72, 74):          # 三组词：三记重拍
        sc.add(6, b, lambda: S.timpani(38, 1.0), 1.0, 0, 0.35, "hit")
        sc.add(6, b, lambda b=b: S.drum_low(0.7, decay=0.8, seed=b), 0.9, 0, 0.35, "hit")
        sc.chord(S.brass, 6, b, "I", 0.8, gain=0.35, send=0.4, tag="hit")
    for q in range(16):             # 76–80：推向下一章
        sc.add(6, 76 + q * 0.25, lambda q=q: S.hat(0.2 + 0.03 * q, seed=q), 0.8, 0, 0.1, "hat")

    # ── 07 成（150 BPM，60 拍）：维持 150 BPM，以半拍感、长音与减少打击形成舒展 ──
    sc.add(7, 0, lambda: S.timpani(38, 1.0), 1.0, 0, 0.35, "timp")
    sc.add(7, 0, lambda: S.bell(74, 4.0, 0.6), 0.9, 0.2, 0.55, "bell")
    plan = [(0, "I", 8), (8, "VI", 8), (16, "II", 8), (24, "V", 8), (32, "I", 28)]
    for b, name, n in plan:
        sc.chord(S.strings, 7, b, name, n, gain=0.6, send=0.5)
        sc.bass(S.sub_bass, 7, b, name, n - 0.2, gain=0.5)
        if b < 32:
            sc.chord(S.brass, 7, b, name, n - 0.5, gain=0.25, send=0.45)
            sc.add(7, b, lambda: S.drum_low(0.45, decay=1.2), 0.8, 0, 0.4, "drum")
    sc.melody(S.flute, 7, 4, A, scale=2.0, gain=0.8, pan=-0.1)
    sc.melody(S.strings, 7, 20, Q, scale=1.0, transpose=12, gain=1.0, pan=0.1)
    sc.add(7, 37, lambda: S.bell(74, 4.0, 0.55), 0.9, -0.2, 0.55, "bell")
    sc.melody(S.flute, 7, 42, Q_END, gain=0.75, pan=-0.1, send=0.5)
    sc.add(7, 53, lambda: S.bell(74, 4.0, 0.55, seed=5), 0.9, -0.15, 0.6, "bell")
    sc.add(7, 53, lambda: S.bell(86, 4.0, 0.25, seed=6), 0.7, 0.2, 0.6, "bell")
    sc.add(7, 53, lambda: S.flute(62, secs(7, 5.0), 0.5, seed=11), 0.7, -0.1, 0.6, "melody")
    sc.mute(7, 56.0, 60.0, 1.0, 0.0)
    return sc


def pan_gains(p):
    a = (p + 1) * np.pi / 4
    return np.cos(a), np.sin(a)


def render(sc, n_total=T.TOTAL_SAMPLES):
    dry = np.zeros((n_total, 2))
    send = np.zeros((n_total, 2))
    for ev in sc.events:
        x = ev.make() * ev.gain
        s0 = ev.start
        if s0 >= n_total:
            continue
        x = x[: n_total - s0]
        gl, gr = pan_gains(ev.pan)
        dry[s0:s0 + len(x), 0] += x * gl
        dry[s0:s0 + len(x), 1] += x * gr
        send[s0:s0 + len(x), 0] += x * gl * ev.send
        send[s0:s0 + len(x), 1] += x * gr * ev.send
    return dry, send


def automation(sc, n_total=T.TOTAL_SAMPLES):
    """音乐总线增益自动化：由 (起, 止, 起增益, 止增益) 段落生成断点，断点之间线性插值，首个断点之前为 1。"""
    pts = []
    for a, b, g0, g1 in sc.mutes:
        pts += [(a, g0), (b, g1)]
    pts.sort()
    xs = np.array([p[0] for p in pts], dtype=float)
    ys = np.array([p[1] for p in pts], dtype=float)
    return np.interp(np.arange(n_total, dtype=float), xs, ys, left=1.0, right=ys[-1])
