"""试音：用同一组代表性句子，对 config.json → tts.cosyvoice.audition_voices 中的每个音色各合成一版，供人耳挑选。

  python -m src.audio.audition                    # 试 audition_voices 列表
  python -m src.audio.audition longanyang xxx     # 指定音色（名称见百炼“CosyVoice 音色列表”，须与模型版本匹配）

输出 output/audition/<模型>_<音色>.wav（三句连读）与 output/audition/audition.md（ASR 回听结果）。
挑定后把 config.json → tts.cosyvoice.voice 改成该音色，再执行 python -m src.build revoice --engine cosyvoice。
"""
import copy
import os
import sys

import numpy as np
import soundfile as sf

from ..narration import by_id
from ..paths import OUTPUT, load_config
from . import asr_check
from .voice import SR, CosyVoiceEngine

SAMPLE_LINES = ["N00a", "N01b", "N06d", "N07a", "N07c"]


def main(voices=None):
    cfg = load_config()
    voices = voices or cfg["tts"]["cosyvoice"]["audition_voices"]
    out = os.path.join(OUTPUT, "audition")
    os.makedirs(out, exist_ok=True)
    lines = by_id()
    rows = []
    for v in voices:
        c = copy.deepcopy(cfg)
        c["tts"]["cosyvoice"]["voice"] = v
        eng = CosyVoiceEngine(c)
        parts = []
        try:
            for lid in SAMPLE_LINES:
                x = eng.generate(eng.text(lines[lid]), ("", 0))
                hyp = asr_check.transcribe(x) if asr_check.available() else ""
                per = asr_check.per_of(lines[lid].display, hyp) if hyp else float("nan")
                rows.append((v, lid, lines[lid].display, hyp, per, len(x) / SR))
                parts += [x, np.zeros(int(0.7 * SR))]
            path = os.path.join(out, f"{c['tts']['cosyvoice']['model']}_{v}.wav")
            sf.write(path, np.concatenate(parts).astype(np.float32), SR, subtype="PCM_24")
            print("ok", v, path)
        except Exception as e:  # 音色与模型不匹配等
            rows.append((v, "-", "", f"失败：{e}", float("nan"), 0))
            print("fail", v, e)
    with open(os.path.join(out, "audition.md"), "w", encoding="utf-8") as fh:
        fh.write("| 音色 | 句子 | 原文 | ASR 回听 | 拼音错误率 | 时长 s |\n|---|---|---|---|---|---|\n")
        for v, lid, ref, hyp, per, dur in rows:
            fh.write(f"| {v} | {lid} | {ref} | {hyp} | {per:.2f} | {dur:.2f} |\n")
    print(os.path.join(out, "audition.md"))


if __name__ == "__main__":
    main(sys.argv[1:] or None)
