"""旁白合成与排布（可切换引擎）。

引擎（config.json → tts.engine）：
- "cosyvoice"：阿里云百炼 CosyVoice（商业云端配音，默认 cosyvoice-v3-plus）。需要环境变量 DASHSCOPE_API_KEY，
  且网络允许访问 dashscope.aliyuncs.com。支持风格指令（instruction）、发音纠正（pronunciation）、固定种子。
- "melo"：sherpa-onnx 运行的 MeloTTS 中文模型（MIT），离线合成，作为无网络时的后备。

共同流程：
- 每句单独合成；多条取优：离线 ASR 回听，按拼音音节错误率挑最准的一条（ASR 只是代理指标，仍需人工试听）。
- 选中的 take 锁定在 assets/voice_takes/<引擎标签>/（随工程提交），之后只在文本 / 引擎参数变化时重新合成。
- 起读位置 = 锚定拍的整数采样号；结束 = 起点 + 实测长度（不做时间拉伸）。
  云端引擎若某句会压到下一句或超出本章，自动把该句语速小幅提高后重合（最多 1.25 倍），并记录在 takes_log。
"""
import hashlib
import io
import json
import os

import numpy as np
import soundfile as sf
from scipy.signal import resample_poly

from .. import timeline as T
from ..narration import LINES
from ..paths import ROOT, WORK, load_config

SR = T.SAMPLE_RATE
MIN_GAP = 0.25          # 句与句之间至少留 0.25 秒


def _trim(x, thr_db=-45.0, pad=int(0.02 * SR)):
    env = np.abs(x)
    thr = np.max(env) * 10 ** (thr_db / 20)
    idx = np.where(env > thr)[0]
    if len(idx) == 0:
        return x
    a = max(0, idx[0] - pad)
    b = min(len(x), idx[-1] + pad)
    return x[a:b]


def _to48k(x, sr):
    if sr == SR:
        return x
    from math import gcd
    g = gcd(SR, sr)
    return resample_poly(x, SR // g, sr // g)


# ───────────────────────── 引擎 ─────────────────────────
class MeloEngine:
    """离线后备。缓存键与此前版本保持一致，已锁定的 take 可直接复用。"""
    supports_rate = False

    def __init__(self, cfg):
        self.c = cfg["tts"]["melo"]
        self.tag = "melo"
        self._tts = None

    def text(self, line):
        return line.tts

    def key(self, line, rate=None):
        c = self.c
        return hashlib.sha1(f"{line.tts}|{c['speed']}|{c['engine_name']}|{c['speaker_id']}".encode()).hexdigest()[:12]

    def _engine(self):
        if self._tts is None:
            import sherpa_onnx
            d = os.path.join(ROOT, self.c["model_dir"]) + "/"
            conf = sherpa_onnx.OfflineTtsConfig(
                model=sherpa_onnx.OfflineTtsModelConfig(
                    vits=sherpa_onnx.OfflineTtsVitsModelConfig(
                        model=d + "model.onnx", lexicon=d + "lexicon.txt", tokens=d + "tokens.txt",
                        dict_dir=d + "dict"),
                    num_threads=4),
                rule_fsts=",".join(d + f for f in ("date.fst", "phone.fst", "number.fst", "new_heteronym.fst")))
            self._tts = sherpa_onnx.OfflineTts(conf)
        return self._tts

    def takes(self):
        return [("", 0), ("……", 1)] * 4          # 一半 take 在句首加停顿引导

    def generate(self, text, variant, rate=None):
        prefix, _ = variant
        a = self._engine().generate(prefix + text, sid=self.c["speaker_id"], speed=self.c["speed"])
        return _trim(_to48k(np.asarray(a.samples, dtype=np.float64), a.sample_rate))


class CosyVoiceEngine:
    """阿里云百炼 CosyVoice（dashscope SDK：dashscope.audio.tts_v2.SpeechSynthesizer）。"""
    supports_rate = True

    def __init__(self, cfg):
        self.c = cfg["tts"]["cosyvoice"]
        self.tag = f"cosyvoice/{self.c['model']}_{self.c['voice']}"

    def text(self, line):
        # 云端模型直接读展示文本（能正确读出 “AI”，不需要为 MeloTTS 做的拆写与停顿）；年份按汉语习惯逐位读
        return line.display.replace("1911年", "一九一一年").replace("《", "").replace("》", "")

    def key(self, line, rate=None):
        c = self.c
        rate = rate or c["speech_rate"]
        sig = json.dumps([self.text(line), c["model"], c["voice"], c.get("instruction"), rate, c["seed"],
                          c.get("pronunciation")], ensure_ascii=False, sort_keys=True)
        return hashlib.sha1(sig.encode()).hexdigest()[:12]

    def takes(self):
        n = int(self.c.get("takes", 4))
        return [("", k) for k in range(n)]

    def generate(self, text, variant, rate=None):
        from dashscope.audio.tts_v2 import AudioFormat, SpeechSynthesizer
        if not os.environ.get("DASHSCOPE_API_KEY"):
            raise RuntimeError("缺少环境变量 DASHSCOPE_API_KEY（在云环境设置中添加后新开会话）")
        c = self.c
        _, k = variant
        kw = dict(model=c["model"], voice=c["voice"], format=AudioFormat.WAV_48000HZ_MONO_16BIT,
                  speech_rate=rate or c["speech_rate"], seed=(int(c["seed"]) + k) % 65536)
        if c.get("instruction"):
            kw["instruction"] = c["instruction"]
        if c.get("pronunciation"):
            kw["hot_fix"] = {"pronunciation": c["pronunciation"]}
        try:
            audio = SpeechSynthesizer(**kw).call(text)
        except Exception:
            if "hot_fix" not in kw and "instruction" not in kw:
                raise
            # 个别模型 / 音色不支持发音纠正或风格指令：去掉后重试一次，并在日志里可见
            kw.pop("hot_fix", None)
            kw.pop("instruction", None)
            audio = SpeechSynthesizer(**kw).call(text)
        if not audio:
            raise RuntimeError(f"CosyVoice 未返回音频：{c['model']} / {c['voice']}")
        x, sr = sf.read(io.BytesIO(audio), dtype="float64")
        if x.ndim > 1:
            x = x.mean(axis=1)
        return _trim(_to48k(x, sr))


def get_engine(cfg):
    name = cfg["tts"]["engine"]
    return {"melo": MeloEngine, "cosyvoice": CosyVoiceEngine}[name](cfg)


# ───────────────────────── 取优与锁定 ─────────────────────────
def _takes_dir(eng):
    d = os.path.join(ROOT, "assets", "voice_takes", eng.tag)
    os.makedirs(d, exist_ok=True)
    return d


def _log_take(eng, line_id, record):
    p = os.path.join(_takes_dir(eng), "takes_log.json")
    log = {}
    if os.path.exists(p):
        with open(p, encoding="utf-8") as fh:
            log = json.load(fh)
    log[line_id] = record
    with open(p, "w", encoding="utf-8") as fh:
        json.dump(log, fh, ensure_ascii=False, indent=1, sort_keys=True)


def synth_line(line, cfg, rate=None, max_rounds=3, eng=None):
    eng = eng or get_engine(cfg)
    d = _takes_dir(eng)
    key = eng.key(line, rate)
    path = os.path.join(d, f"{line.id}_{key}.flac")
    if not os.path.exists(path):
        from . import asr_check
        text = eng.text(line)
        cands = []
        rounds = max_rounds if asr_check.available() else 1
        for rnd in range(rounds):
            for variant in eng.takes():
                if rnd:
                    variant = (variant[0], variant[1] + 100 * rnd)
                x = eng.generate(text, variant, rate)
                hyp = asr_check.transcribe(x) if asr_check.available() else ""
                per = asr_check.per_of(line.display, hyp) if hyp else float("nan")
                cands.append(dict(x=x, per=per, hyp=hyp, variant=variant, n=len(x)))
                if not asr_check.available():
                    break
            if not (min(c["per"] for c in cands) > 0.05):     # 含 nan：无 ASR 时不筛选
                break
        med = float(np.median([c["n"] for c in cands]))
        cands.sort(key=lambda c: (c["per"] if c["per"] == c["per"] else 0.0, abs(c["n"] - med)))
        best = cands[0]
        for old in os.listdir(d):
            if old.startswith(line.id + "_") and old.endswith(".flac") and old != os.path.basename(path):
                os.remove(os.path.join(d, old))
        sf.write(path, best["x"].astype(np.float32), SR, subtype="PCM_24")
        _log_take(eng, line.id, dict(file=os.path.basename(path), text=text, engine=eng.tag, rate=rate,
                                     n_candidates=len(cands), chosen_per=best["per"], chosen_asr=best["hyp"],
                                     variant=list(best["variant"]), all_per=[round(c["per"], 3) for c in cands]))
    x, _ = sf.read(path, dtype="float64")
    return x, path


def _limit_sample(i):
    """第 i 句必须在此采样之前结束：下一句起读前 MIN_GAP 秒，且不超出本章。"""
    ln = LINES[i]
    ch_end = T.chapter_end_frame(ln.chapter) * T.SAMPLES_PER_FRAME
    if i + 1 < len(LINES):
        nx = LINES[i + 1]
        return min(ch_end, T.beat_sample(nx.chapter, nx.beat) - int(MIN_GAP * SR))
    return ch_end


def layout(cfg=None):
    """返回每句的排布：起止采样/帧、文件路径。云端引擎会自动微调超时句子的语速。"""
    cfg = cfg or load_config()
    eng = get_engine(cfg)
    out = []
    for i, ln in enumerate(LINES):
        s0 = T.beat_sample(ln.chapter, ln.beat)
        rate = None
        x, path = synth_line(ln, cfg, eng=eng)
        if eng.supports_rate:
            base = eng.c["speech_rate"]
            rate = base
            while s0 + len(x) > _limit_sample(i) and rate < 1.25 * base - 1e-9:
                rate = round(min(1.25 * base, rate * 1.06), 3)
                x, path = synth_line(ln, cfg, rate=rate, eng=eng)
        f0 = T.beat_frame(ln.chapter, ln.beat)
        n = len(x)
        f1 = f0 + -(-n // T.SAMPLES_PER_FRAME)  # 向上取整到帧
        out.append(dict(id=ln.id, chapter=ln.chapter, beat=ln.beat, start_sample=s0,
                        n_samples=n, end_sample=s0 + n, start_frame=f0, end_frame=f1,
                        path=os.path.relpath(path, ROOT), display=ln.display, tts=eng.text(ln),
                        subs=ln.subs, engine=eng.tag, rate=rate))
    return out


def check_layout(items):
    problems = []
    for a, b in zip(items, items[1:]):
        gap = b["start_sample"] - a["end_sample"]
        if gap < int(MIN_GAP * SR):
            problems.append(f"{a['id']} 结束距 {b['id']} 起读仅 {gap / SR:.2f}s")
    for it in items:
        ch_end = T.chapter_end_frame(it["chapter"]) * T.SAMPLES_PER_FRAME
        if it["end_sample"] > ch_end:
            problems.append(f"{it['id']} 超出本章结尾 {(it['end_sample'] - ch_end) / SR:.2f}s")
    return problems


def save_layout(items):
    os.makedirs(WORK, exist_ok=True)
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
              f"= {beats:5.2f} beats  end_beat {it['beat'] + beats:5.2f}/{ch.beats}  rate {it['rate']}  {it['display']}")
    for p in check_layout(items):
        print("!!", p)
