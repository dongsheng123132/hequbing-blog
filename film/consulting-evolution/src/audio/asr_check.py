"""用离线 ASR（SenseVoice-small int8，仅用于验收，不进入成片）回听每句配音，计算字错误率。

用于发现 TTS 读错字、吞字、读错年份或英文缩写。ASR 自身也有误差，CER 只作提示，
高于阈值的句子需要人工复核。
"""
import os
import re

import numpy as np
import soundfile as sf

from ..paths import CACHE, ROOT

MODEL = os.path.join(CACHE, "sherpa-onnx-sense-voice-zh-en-ja-ko-yue-2024-07-17")
MODEL_URL = ("https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/"
             "sherpa-onnx-sense-voice-zh-en-ja-ko-yue-2024-07-17.tar.bz2")

_PUNCT = re.compile(r"[，。、：；？！《》“”（）,.?!:;\s]")


def _norm(s):
    s = s.replace("1911", "一九一一").upper()
    s = s.replace("A I", "AI")
    return _PUNCT.sub("", s)


def _cer(ref, hyp):
    r, h = list(ref), list(hyp)
    d = np.zeros((len(r) + 1, len(h) + 1), dtype=int)
    d[:, 0] = range(len(r) + 1)
    d[0, :] = range(len(h) + 1)
    for i in range(1, len(r) + 1):
        for j in range(1, len(h) + 1):
            d[i, j] = min(d[i - 1, j] + 1, d[i, j - 1] + 1, d[i - 1, j - 1] + (r[i - 1] != h[j - 1]))
    return d[len(r), len(h)] / max(1, len(r))


def available():
    return os.path.exists(os.path.join(MODEL, "model.int8.onnx"))


_REC = None


def recognizer():
    global _REC
    if _REC is None:
        import sherpa_onnx
        _REC = sherpa_onnx.OfflineRecognizer.from_sense_voice(
            model=os.path.join(MODEL, "model.int8.onnx"),
            tokens=os.path.join(MODEL, "tokens.txt"), language="zh", use_itn=False, num_threads=4)
    return _REC


def transcribe(x48):
    """x48: 48 kHz 单声道 float。前后补 0.4 s 静音后识别。"""
    from scipy.signal import resample_poly
    x16 = resample_poly(np.asarray(x48, dtype=np.float64), 1, 3).astype(np.float32)
    z = np.zeros(6400, np.float32)
    st = recognizer().create_stream()
    st.accept_waveform(16000, np.concatenate([z, x16, z]))
    recognizer().decode_stream(st)
    return st.result.text


def cer_of(display, hyp):
    return _cer(_norm(display), _norm(hyp))


_LETTER = {"A": ["ei"], "I": ["ai"]}


def _pinyin_seq(s):
    """中文 → 无声调拼音音节序列；英文字母 A/I 按汉语习惯读音映射（AI → ei ai）。
    用音节比较可以避免把同音字（如 依据/一句、形势/形式）误判为读错。"""
    from pypinyin import lazy_pinyin
    out = []
    for tok in lazy_pinyin(_norm(s)):
        if tok.isascii() and tok.isalpha() and not any(c.islower() for c in tok):
            for ch in tok:
                out += _LETTER.get(ch, [ch.lower()])
        elif tok.isascii() and tok.isalpha() and len(tok) <= 2 and tok.lower() in ("a", "i", "ai"):
            out += {"a": ["ei"], "i": ["ai"], "ai": ["ai"]}[tok.lower()]
        else:
            out.append(tok.lower())
    return out


def per_of(display, hyp):
    """拼音音节错误率（忽略声调）。"""
    return _cer(_pinyin_seq(display), _pinyin_seq(hyp))


def run(items):
    rows = []
    for it in items:
        x, sr = sf.read(os.path.join(ROOT, it["path"]), dtype="float32")
        hyp = transcribe(x)
        ref = _norm(it["display"])
        cer = _cer(ref, _norm(hyp))
        rows.append(dict(id=it["id"], ref=it["display"], hyp=hyp, cer=cer, per=per_of(it["display"], hyp)))
    return rows


if __name__ == "__main__":
    from .voice import load_layout
    for r in run(load_layout()):
        flag = "  <-- 复核" if r["per"] > 0.1 else ""
        print(f"{r['id']} PER {r['per']:.2f} CER {r['cer']:.2f} | {r['ref']} | {r['hyp']}{flag}")
