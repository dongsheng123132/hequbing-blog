"""旁白合成与排布。

- 引擎：sherpa-onnx 运行的 MeloTTS 中文模型（MIT 许可），离线合成，不克隆任何真人声音。
- 每句单独合成、缓存（按文本+语速+模型哈希），重采样到 48 kHz，裁掉首尾静音。
- 起读位置 = 该句锚定拍的整数采样号；结束 = 起点 + 实测长度（不做时间拉伸）。
"""
import hashlib
import json
import os

import numpy as np
import soundfile as sf
from scipy.signal import resample_poly

from .. import timeline as T
from ..narration import LINES
from ..paths import ROOT, WORK, load_config

SR = T.SAMPLE_RATE


def _model_dir(cfg):
    return os.path.join(ROOT, cfg["tts"]["model_dir"])


_TTS = None


def _engine(cfg):
    global _TTS
    if _TTS is None:
        import sherpa_onnx
        d = _model_dir(cfg) + "/"
        conf = sherpa_onnx.OfflineTtsConfig(
            model=sherpa_onnx.OfflineTtsModelConfig(
                vits=sherpa_onnx.OfflineTtsVitsModelConfig(
                    model=d + "model.onnx", lexicon=d + "lexicon.txt",
                    tokens=d + "tokens.txt", dict_dir=d + "dict"),
                num_threads=4),
            rule_fsts=",".join(d + f for f in ("date.fst", "phone.fst", "number.fst", "new_heteronym.fst")),
        )
        _TTS = sherpa_onnx.OfflineTts(conf)
    return _TTS


def _trim(x, thr_db=-45.0, pad=int(0.02 * SR)):
    env = np.abs(x)
    thr = np.max(env) * 10 ** (thr_db / 20)
    idx = np.where(env > thr)[0]
    if len(idx) == 0:
        return x
    a = max(0, idx[0] - pad)
    b = min(len(x), idx[-1] + pad)
    return x[a:b]


def _generate(text, cfg, speed):
    tts = _engine(cfg)
    a = tts.generate(text, sid=cfg["tts"]["speaker_id"], speed=speed)
    x = np.asarray(a.samples, dtype=np.float64)
    sr = a.sample_rate
    if sr != SR:
        from math import gcd
        g = gcd(SR, sr)
        x = resample_poly(x, SR // g, sr // g)
    return _trim(x)


TAKES_LOG = os.path.join(ROOT, "assets", "voice_takes", "takes_log.json")


def _log_take(line_id, record):
    log = {}
    if os.path.exists(TAKES_LOG):
        with open(TAKES_LOG, encoding="utf-8") as fh:
            log = json.load(fh)
    log[line_id] = record
    with open(TAKES_LOG, "w", encoding="utf-8") as fh:
        json.dump(log, fh, ensure_ascii=False, indent=1, sort_keys=True)


def synth_line(line, cfg, speed=None, n_takes=8, max_rounds=3):
    """多条取优并锁定。

    TTS 带随机时长预测，同一文本每次生成略有不同，句首音节偶有含糊。
    每句生成若干 take（部分在句首加停顿引导），用离线 ASR 回听，按拼音音节错误率挑最准的一条；
    选中的 take 保存在 assets/voice_takes/（随工程提交），之后只在文本/语速变化时重新合成。
    ASR 只是代理指标，最终仍需人工试听。
    """
    speed = speed or cfg["tts"]["speed"]
    key = hashlib.sha1(f"{line.tts}|{speed}|{cfg['tts']['engine']}|{cfg['tts']['speaker_id']}".encode()).hexdigest()[:12]
    d = os.path.join(ROOT, "assets", "voice_takes")
    os.makedirs(d, exist_ok=True)
    path = os.path.join(d, f"{line.id}_{key}.flac")
    if not os.path.exists(path):
        from . import asr_check
        for old in os.listdir(d):
            if old.startswith(line.id + "_") and old.endswith(".flac"):
                os.remove(os.path.join(d, old))
        cands = []
        for rnd in range(max_rounds):
            for k in range(n_takes):
                prefix = "……" if k % 2 else ""
                x = _generate(prefix + line.tts, cfg, speed)
                hyp = asr_check.transcribe(x) if asr_check.available() else ""
                per = asr_check.per_of(line.display, hyp) if hyp else float("nan")
                cands.append(dict(x=x, per=per, hyp=hyp, prefix=prefix, n=len(x)))
            best_per = min(c["per"] for c in cands)
            if not (best_per > 0.05):  # 包括 nan（无 ASR 时不做筛选）
                break
        med = float(np.median([c["n"] for c in cands]))
        cands.sort(key=lambda c: (c["per"] if c["per"] == c["per"] else 0.0, abs(c["n"] - med)))
        best = cands[0]
        sf.write(path, best["x"].astype(np.float32), SR, subtype="PCM_24")
        _log_take(line.id, dict(file=os.path.basename(path), text=line.tts, speed=speed,
                                n_candidates=len(cands), chosen_per=best["per"], chosen_asr=best["hyp"],
                                lead_in_pause=bool(best["prefix"]),
                                all_per=[round(c["per"], 3) for c in cands]))
    x, _ = sf.read(path, dtype="float64")
    return x, path


def layout(cfg=None, speed=None):
    """返回每句的排布：起止采样/帧、文件路径。"""
    cfg = cfg or load_config()
    out = []
    for ln in LINES:
        x, path = synth_line(ln, cfg, speed)
        s0 = T.beat_sample(ln.chapter, ln.beat)
        f0 = T.beat_frame(ln.chapter, ln.beat)
        n = len(x)
        f1 = f0 + -(-n // T.SAMPLES_PER_FRAME)  # 向上取整到帧
        out.append(dict(id=ln.id, chapter=ln.chapter, beat=ln.beat, start_sample=s0,
                        n_samples=n, end_sample=s0 + n, start_frame=f0, end_frame=f1,
                        path=os.path.relpath(path, ROOT), display=ln.display, tts=ln.tts,
                        subs=ln.subs))
    return out


def check_layout(items):
    problems = []
    for a, b in zip(items, items[1:]):
        gap = b["start_sample"] - a["end_sample"]
        if gap < int(0.25 * SR):
            problems.append(f"{a['id']} 结束距 {b['id']} 起读仅 {gap / SR:.2f}s")
    for it in items:
        ch_end = T.chapter_end_frame(it["chapter"]) * T.SAMPLES_PER_FRAME
        if it["end_sample"] > ch_end:
            problems.append(f"{it['id']} 超出本章结尾 {(it['end_sample'] - ch_end) / SR:.2f}s")
    return problems


def render_voice_track(items):
    buf = np.zeros(T.TOTAL_SAMPLES)
    for it in items:
        x, _ = sf.read(os.path.join(ROOT, it["path"]), dtype="float64")
        s0 = it["start_sample"]
        buf[s0:s0 + len(x)] += x[: T.TOTAL_SAMPLES - s0]
    return buf


def save_layout(items):
    p = os.path.join(WORK, "voice_layout.json")
    with open(p, "w", encoding="utf-8") as fh:
        json.dump(items, fh, ensure_ascii=False, indent=1)
    return p


def load_layout():
    with open(os.path.join(WORK, "voice_layout.json"), encoding="utf-8") as fh:
        return json.load(fh)


if __name__ == "__main__":
    items = layout()
    save_layout(items)
    for it in items:
        ch = T.CHAPTERS[it["chapter"]]
        beats = it["n_samples"] / ch.samples_per_beat
        print(f"{it['id']} ch{it['chapter']} beat {it['beat']:>2} dur {it['n_samples'] / SR:5.2f}s "
              f"= {beats:5.2f} beats  end_beat {it['beat'] + beats:5.2f}/{ch.beats}  {it['display']}")
    for p in check_layout(items):
        print("!!", p)
