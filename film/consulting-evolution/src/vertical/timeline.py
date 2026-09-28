"""竖版（1080×1920）独立节拍网格。与横版同样使用整数帧 / 整数采样 / 有理数 BPM。

  V0 问   120 BPM  16 拍  每拍 15 帧   00:00:00—00:08:00
  V1 史   150 BPM  44 拍  每拍 12 帧   00:08:00—00:25:18   （谋 商 管 略 各 8 拍，联 12 拍）
  V2 行   150 BPM  48 拍  每拍 12 帧   00:25:18—00:44:24
  V3 成   150 BPM  44 拍  每拍 12 帧   00:44:24—01:02:12
"""
from dataclasses import dataclass
from fractions import Fraction

FPS = 30
SAMPLE_RATE = 48000
SAMPLES_PER_FRAME = 1600
W, H = 1080, 1920


@dataclass(frozen=True)
class VChapter:
    id: int
    key: str
    name: str
    numeral: str
    bpm: Fraction
    beats: int
    style: str
    paper: str

    @property
    def frames_per_beat(self):
        f = Fraction(FPS * 60) / self.bpm
        assert f.denominator == 1
        return int(f)

    @property
    def samples_per_beat(self):
        return self.frames_per_beat * SAMPLES_PER_FRAME

    @property
    def frames(self):
        return self.beats * self.frames_per_beat


CHAPTERS = [
    VChapter(0, "问", "问 · 序", "序", Fraction(120), 16, "A", "paper_mocyan"),
    VChapter(1, "谋", "编年 · 从谋到联", "史", Fraction(150), 44, "B", "ink_black"),
    VChapter(2, "行", "行 · AI落地", "行", Fraction(150), 48, "A", "paper_mocyan_deep"),
    VChapter(3, "成", "成 · 贺去病AI商业咨询", "成", Fraction(150), 44, "B", "ink_black"),
]

# 编年段落：（主字, 起拍, 止拍, 时代标签）
MONTAGE = [("谋", 0, 8, "约 战国—秦汉"), ("商", 8, 16, "约 明清"), ("管", 16, 24, "1911"),
           ("略", 24, 32, "1926 · 1963"), ("联", 32, 44, "数字时代")]

CH_START_FRAME = []
_f = 0
for _c in CHAPTERS:
    CH_START_FRAME.append(_f)
    _f += _c.frames
TOTAL_FRAMES = _f
TOTAL_SAMPLES = TOTAL_FRAMES * SAMPLES_PER_FRAME


def chapter_start_frame(c):
    return CH_START_FRAME[c]


def chapter_end_frame(c):
    return CH_START_FRAME[c] + CHAPTERS[c].frames


def beat_frame(c, beat):
    fr = Fraction(beat) * CHAPTERS[c].frames_per_beat
    assert fr.denominator == 1
    return CH_START_FRAME[c] + int(fr)


def bframe(c, beat):
    return CH_START_FRAME[c] + round(float(beat) * CHAPTERS[c].frames_per_beat)


def pos(c, beat):
    return CH_START_FRAME[c] * SAMPLES_PER_FRAME + int(round(float(beat) * CHAPTERS[c].samples_per_beat))


def secs(c, beats):
    return beats * CHAPTERS[c].samples_per_beat / SAMPLE_RATE


def locate(frame):
    for c in CHAPTERS:
        s = CH_START_FRAME[c.id]
        if s <= frame < s + c.frames:
            return c, (frame - s) / c.frames_per_beat
    c = CHAPTERS[-1]
    return c, float(c.beats)


def timecode(frame):
    m, r = divmod(frame, FPS * 60)
    s, f = divmod(r, FPS)
    return f"{m:02d}:{s:02d}:{f:02d}"


def rows():
    out = []
    gb = gbar = 0
    for c in CHAPTERS:
        for i in range(c.beats):
            if i and i % 4 == 0:
                gbar += 1
            fr = beat_frame(c.id, i)
            out.append(dict(chapter_id=c.id, bar_id=gbar, beat_id=gb, beat_in_chapter=i, bpm=str(float(c.bpm)),
                            frames_per_beat=c.frames_per_beat, frame_index=fr, sample_index=fr * SAMPLES_PER_FRAME,
                            timecode=timecode(fr), downbeat=int(i % 4 == 0)))
            gb += 1
        gbar += 1
    return out


def self_check():
    assert all(c.beats % 4 == 0 for c in CHAPTERS)
    assert TOTAL_FRAMES == 1872, TOTAL_FRAMES
    assert TOTAL_SAMPLES == TOTAL_FRAMES * 1600
    return True
