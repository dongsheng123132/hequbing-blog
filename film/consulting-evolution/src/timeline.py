"""统一节拍网格：画面、音乐、音效、旁白、字幕共用这一份时间表。

所有时间以整数帧 / 整数采样表示；BPM 用有理数，禁止累加浮点秒数。
  每拍帧数   = 30 * 60 / BPM   （本片各章均为整数）
  每帧采样数 = 48000 / 30 = 1600
"""
from dataclasses import dataclass
from fractions import Fraction
import csv
import os

FPS = 30
SAMPLE_RATE = 48000
SAMPLES_PER_FRAME = SAMPLE_RATE // FPS  # 1600
BEATS_PER_BAR = 4


@dataclass(frozen=True)
class Chapter:
    id: int
    key: str          # 主字
    name: str         # 章节名
    era: str          # 右侧竖排阶段名
    numeral: str      # 印章编号
    bpm: Fraction
    beats: int
    style: str        # "A" 染色宣纸白线 / "B" 黑底金绘
    paper: str        # 背景色 token

    @property
    def frames_per_beat(self) -> int:
        fpb = Fraction(FPS * 60) / self.bpm
        assert fpb.denominator == 1, f"chapter {self.id}: 每拍帧数非整数 {fpb}"
        return int(fpb)

    @property
    def samples_per_beat(self) -> int:
        return self.frames_per_beat * SAMPLES_PER_FRAME

    @property
    def bars(self) -> int:
        assert self.beats % BEATS_PER_BAR == 0
        return self.beats // BEATS_PER_BAR

    @property
    def frames(self) -> int:
        return self.beats * self.frames_per_beat


CHAPTERS = [
    Chapter(0, "问", "问·序章", "序章", "序", Fraction(60), 16, "A", "paper_mocyan"),
    Chapter(1, "谋", "谋·古代谋略", "古代谋略", "壹", Fraction(72), 24, "B", "ink_black"),
    Chapter(2, "商", "商·商贸经营", "商贸经营", "贰", Fraction(90), 32, "A", "paper_ochre"),
    Chapter(3, "管", "管·工业管理", "工业管理", "叁", Fraction(100), 40, "B", "ink_black"),
    Chapter(4, "略", "略·现代咨询", "现代咨询", "肆", Fraction(225, 2), 40, "A", "paper_smoke"),
    Chapter(5, "联", "联·数字化", "数字时代", "伍", Fraction(120), 48, "B", "ink_black"),
    Chapter(6, "行", "行·AI落地", "AI时代", "陆", Fraction(150), 80, "A", "paper_mocyan_deep"),
    Chapter(7, "成", "成·品牌收束", "品牌", "柒", Fraction(150), 60, "B", "ink_black"),
]


def _build():
    ch_start_frame = []
    ch_start_beat = []
    f = 0
    b = 0
    for ch in CHAPTERS:
        ch_start_frame.append(f)
        ch_start_beat.append(b)
        f += ch.frames
        b += ch.beats
    return ch_start_frame, ch_start_beat, f, b


CH_START_FRAME, CH_START_BEAT, TOTAL_FRAMES, TOTAL_BEATS = _build()
TOTAL_SAMPLES = TOTAL_FRAMES * SAMPLES_PER_FRAME


def chapter_start_frame(ch_id: int) -> int:
    return CH_START_FRAME[ch_id]


def chapter_end_frame(ch_id: int) -> int:
    """排他边界。"""
    return CH_START_FRAME[ch_id] + CHAPTERS[ch_id].frames


def beat_frame(ch_id: int, beat) -> int:
    """章内第 beat 拍（可为 Fraction，但必须落在整数帧上）对应的全片帧号。"""
    ch = CHAPTERS[ch_id]
    fr = Fraction(beat) * ch.frames_per_beat
    assert fr.denominator == 1, f"beat {beat} of ch{ch_id} 不在整数帧上"
    return CH_START_FRAME[ch_id] + int(fr)


def beat_sample(ch_id: int, beat) -> int:
    """章内拍位置对应的全片采样号。允许 1/4 拍等细分（各章每拍采样数均可被 4 整除）。"""
    ch = CHAPTERS[ch_id]
    s = Fraction(beat) * ch.samples_per_beat
    assert s.denominator == 1, f"beat {beat} of ch{ch_id} 不在整数采样上"
    return CH_START_FRAME[ch_id] * SAMPLES_PER_FRAME + int(s)


def frame_to_sample(frame: int) -> int:
    return frame * SAMPLES_PER_FRAME


def locate(frame: int):
    """帧号 → (chapter, 章内拍位置 Fraction)。"""
    for ch in CHAPTERS:
        s = CH_START_FRAME[ch.id]
        if s <= frame < s + ch.frames:
            return ch, Fraction(frame - s, ch.frames_per_beat)
    if frame == TOTAL_FRAMES:
        ch = CHAPTERS[-1]
        return ch, Fraction(ch.beats)
    raise ValueError(f"frame {frame} 超出 0..{TOTAL_FRAMES}")


def timecode(frame: int) -> str:
    """分:秒:帧（每秒 30 帧）。"""
    m, rem = divmod(frame, FPS * 60)
    s, fr = divmod(rem, FPS)
    return f"{m:02d}:{s:02d}:{fr:02d}"


def srt_time(frame: int) -> str:
    ms_total = Fraction(frame * 1000, FPS)
    ms = int(ms_total)  # 向下取整到毫秒
    h, ms = divmod(ms, 3600_000)
    m, ms = divmod(ms, 60_000)
    s, ms = divmod(ms, 1000)
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"


def iter_beats():
    """逐拍迭代：chapter_id, bar_id(全片), beat_id(全片), beat_in_chapter, beat_in_bar, frame_index, sample_index。"""
    gb = 0
    gbar = 0
    for ch in CHAPTERS:
        for i in range(ch.beats):
            if i % BEATS_PER_BAR == 0 and i > 0:
                gbar += 1
            fr = beat_frame(ch.id, i)
            yield dict(
                chapter_id=ch.id, bar_id=gbar, beat_id=gb, beat_in_chapter=i,
                bar_in_chapter=i // BEATS_PER_BAR, beat_in_bar=i % BEATS_PER_BAR,
                bpm=str(float(ch.bpm)), frames_per_beat=ch.frames_per_beat,
                frame_index=fr, sample_index=fr * SAMPLES_PER_FRAME, timecode=timecode(fr),
                downbeat=int(i % BEATS_PER_BAR == 0), chapter_start=int(i == 0),
            )
            gb += 1
        gbar += 1


def write_beat_grid_csv(path: str):
    rows = list(iter_beats())
    with open(path, "w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=list(rows[0].keys()))
        w.writeheader()
        w.writerows(rows)
    return rows


def self_check():
    assert SAMPLES_PER_FRAME * FPS == SAMPLE_RATE
    assert TOTAL_FRAMES == 5480, TOTAL_FRAMES
    assert TOTAL_SAMPLES == 8_768_000, TOTAL_SAMPLES
    assert TOTAL_BEATS == 340
    expected_tc = ["00:00:00", "00:16:00", "00:36:00", "00:57:10", "01:21:10",
                   "01:42:20", "02:06:20", "02:38:20"]
    for ch, tc in zip(CHAPTERS, expected_tc):
        assert timecode(CH_START_FRAME[ch.id]) == tc, (ch.id, timecode(CH_START_FRAME[ch.id]), tc)
        assert ch.samples_per_beat % 4 == 0
    assert timecode(TOTAL_FRAMES) == "03:02:20"
    return True


if __name__ == "__main__":
    self_check()
    for ch in CHAPTERS:
        print(ch.id, ch.key, float(ch.bpm), ch.beats, ch.frames_per_beat,
              timecode(chapter_start_frame(ch.id)), "—", timecode(chapter_end_frame(ch.id)))
    print("total", TOTAL_FRAMES, TOTAL_SAMPLES)
