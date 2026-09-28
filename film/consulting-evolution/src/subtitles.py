"""字幕：由锁定配音的实测时长生成，与画面共用整数帧。输出 SRT 与帧级字幕表。"""
import json
import os

from . import timeline as T
from .paths import ROOT, WORK

MIN_FRAMES = 30          # 每屏至少 1 秒
HOLD = 8                 # 句尾多停留帧数（不压到下一句）


def build_cues(layout):
    cues = []
    for i, it in enumerate(layout):
        f0, f1 = it["start_frame"], it["end_frame"]
        nxt = layout[i + 1]["start_frame"] if i + 1 < len(layout) else T.TOTAL_FRAMES
        ch_end = T.chapter_end_frame(it["chapter"])
        f1 = min(f1 + HOLD, nxt - 2, ch_end - 4) if it["chapter"] < 7 else min(f1 + HOLD, nxt - 2)
        subs = it["subs"]
        weights = [max(1, len(s.replace("，", "").replace("。", ""))) for s in subs]
        tot = sum(weights)
        span = f1 - f0
        acc = f0
        for k, (s, w) in enumerate(zip(subs, weights)):
            end = f1 if k == len(subs) - 1 else acc + round(span * w / tot)
            cues.append(dict(line=it["id"], start_frame=acc, end_frame=end, text=s))
            acc = end
    for c in cues:
        assert c["end_frame"] - c["start_frame"] >= MIN_FRAMES * 0.6, c
    return cues


def write_srt(cues, path):
    with open(path, "w", encoding="utf-8") as fh:
        for i, c in enumerate(cues, 1):
            fh.write(f"{i}\n{T.srt_time(c['start_frame'])} --> {T.srt_time(c['end_frame'])}\n{c['text']}\n\n")


def save_cues(cues):
    os.makedirs(WORK, exist_ok=True)
    with open(os.path.join(WORK, "cues.json"), "w", encoding="utf-8") as fh:
        json.dump(cues, fh, ensure_ascii=False, indent=1)


def load_cues():
    with open(os.path.join(WORK, "cues.json"), encoding="utf-8") as fh:
        return json.load(fh)


def cue_at(cues, frame):
    for c in cues:
        if c["start_frame"] <= frame < c["end_frame"]:
            return c
    return None
