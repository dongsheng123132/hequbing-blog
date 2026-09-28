"""混音：音乐 / 音效 / 旁白三轨 → 主混音。

- 旁白优先：有旁白时音乐按旁白包络自动压低（侧链式闪避）。
- 响度目标约 -16 LUFS（积分），真峰值不高于 -1 dBTP（4 倍过采样测量）。
- 不用限幅“压出”响度：只在真峰值超标时用前视限幅器处理少量孤立峰值，并在报告中写明增益衰减量。
"""
import json
import os

import numpy as np
import pyloudnorm as pyln
import soundfile as sf
from scipy.signal import fftconvolve, resample_poly, sosfilt, butter

from .. import timeline as T
from ..paths import OUTPUT, ROOT, WORK, load_config
from . import score, sfx, synth, voice

SR = T.SAMPLE_RATE


def _smooth_env(x, attack=0.02, release=0.35):
    a = np.exp(-1 / (attack * SR))
    r = np.exp(-1 / (release * SR))
    env = np.zeros_like(x)
    # 分块近似：先取 10 ms 窗口的 RMS，再做一阶平滑（避免逐采样 Python 循环）
    hop = int(0.01 * SR)
    n = len(x) // hop + 1
    pad = np.zeros(n * hop)
    pad[:len(x)] = x
    rms = np.sqrt(np.mean(pad.reshape(n, hop) ** 2, axis=1))
    sm = np.zeros(n)
    ka = np.exp(-hop / (attack * SR))
    kr = np.exp(-hop / (release * SR))
    prev = 0.0
    for i, v in enumerate(rms):
        k = ka if v > prev else kr
        prev = k * prev + (1 - k) * v
        sm[i] = prev
    return np.repeat(sm, hop)[:len(x)]


def compress(x, thr_db=-24.0, ratio=3.0, attack=0.008, release=0.15):
    """旁白用的温和压缩（前馈、RMS 检测），减小 TTS 的峰值与响度差。"""
    env = _smooth_env(x, attack, release)
    lvl = 20 * np.log10(env + 1e-9)
    over = np.maximum(0.0, lvl - thr_db)
    g = 10 ** (-(over - over / ratio) / 20)
    return x * g


def true_peak_db(x):
    up = resample_poly(x, 4, 1, axis=0)
    return 20 * np.log10(np.max(np.abs(up)) + 1e-12)


def lookahead_limit(x, ceiling_db=-1.5, look=0.005, release=0.08):
    """前视峰值限幅（仅在超标时启用）。返回 (处理后信号, 最大增益衰减 dB)。"""
    c = 10 ** (ceiling_db / 20)
    peak = np.max(np.abs(x), axis=1)
    need = np.minimum(1.0, c / np.maximum(peak, 1e-12))
    L = int(look * SR)
    # 前视：取未来 L 个采样内的最小增益
    from scipy.ndimage import minimum_filter1d
    g = minimum_filter1d(need, size=2 * L + 1, origin=0)
    # 释放平滑
    hop = 48
    n = len(g) // hop + 1
    gp = np.ones(n * hop)
    gp[:len(g)] = g
    blocks = gp.reshape(n, hop).min(axis=1)
    kr = np.exp(-hop / (release * SR))
    out = np.zeros(n)
    prev = 1.0
    for i, v in enumerate(blocks):
        prev = v if v < prev else kr * prev + (1 - kr) * v
        out[i] = prev
    gain = np.repeat(out, hop)[:len(g)]
    gr_db = -20 * np.log10(gain)
    stats = dict(max_db=float(gr_db.max()), seconds_over_0_5db=float(np.sum(gr_db > 0.5) / SR),
                 seconds_over_1db=float(np.sum(gr_db > 1.0) / SR), percent_time_limited=float(np.mean(gr_db > 0.1) * 100))
    return x * gain[:, None], stats


def build(save=True):
    cfg = load_config()
    os.makedirs(WORK, exist_ok=True)
    N = T.TOTAL_SAMPLES

    # 旁白
    items = voice.layout(cfg)
    voice.save_layout(items)
    vbuf = np.zeros(N)
    for it in items:
        x, _ = sf.read(os.path.join(ROOT, it["path"]), dtype="float64")
        x = sosfilt(butter(2, 80 / (SR / 2), btype="high", output="sos"), x)
        rms = np.sqrt(np.mean(x[np.abs(x) > 0.02 * np.max(np.abs(x))] ** 2))
        x = x * (10 ** (-20 / 20) / rms)
        x = compress(x)
        s0 = it["start_sample"]
        vbuf[s0:s0 + len(x)] += x[: N - s0]
    v_ir = synth.reverb_ir(0.9, seed=3, predelay=0.012)
    v_wet = np.stack([fftconvolve(vbuf, v_ir[:, c])[:N] for c in range(2)], axis=1)
    voice_st = np.stack([vbuf, vbuf], axis=1) * 0.92 + v_wet * 0.10

    # 音乐
    sc = score.compose()
    m_dry, m_send = score.render(sc)
    ir = synth.reverb_ir(2.6, seed=1)
    m_wet = np.stack([fftconvolve(m_send[:, c], ir[:, c])[:N] for c in range(2)], axis=1)
    music = (m_dry + m_wet * 0.9) * score.automation(sc)[:, None]

    # 音效
    cues = sfx.all_cues()
    s_dry, s_send = sfx.render(cues)
    ir2 = synth.reverb_ir(1.6, seed=2)
    s_wet = np.stack([fftconvolve(s_send[:, c], ir2[:, c])[:N] for c in range(2)], axis=1)
    effects = s_dry + s_wet * 0.8

    # 侧链闪避：旁白出现时音乐 -6 dB、音效 -2 dB
    env = _smooth_env(vbuf, 0.03, 0.45)
    thr = 0.02
    k = np.clip(env / thr, 0, 1)
    duck_m = 1 - 0.5 * k
    duck_s = 1 - 0.2 * k

    g_music, g_sfx, g_voice = 0.62, 0.5, 1.25
    mix = music * duck_m[:, None] * g_music + effects * duck_s[:, None] * g_sfx + voice_st * g_voice

    meter = pyln.Meter(SR)
    lufs0 = meter.integrated_loudness(mix)
    target = cfg["audio"]["target_lufs"]
    gain = 10 ** ((target - lufs0) / 20)
    mix *= gain
    tp0 = true_peak_db(mix)
    gr = dict(max_db=0.0)
    if tp0 > cfg["audio"]["true_peak_max_dbtp"]:
        mix, gr = lookahead_limit(mix, ceiling_db=cfg["audio"]["true_peak_max_dbtp"] - 0.6)
    tp1 = true_peak_db(mix)
    lufs1 = meter.integrated_loudness(mix)

    stems = dict(music=music * duck_m[:, None] * g_music * gain, sfx=effects * duck_s[:, None] * g_sfx * gain,
                 voice=voice_st * g_voice * gain)
    report = dict(lufs_before=lufs0, lufs=lufs1, true_peak_before_limit_dbtp=tp0, true_peak_dbtp=tp1,
                  limiter=gr, samples=len(mix), seconds=len(mix) / SR,
                  voice_lufs=meter.integrated_loudness(stems["voice"]),
                  n_music_events=len(sc.events), n_sfx_cues=len(cues))
    if save:
        out = os.path.join(OUTPUT, "audio")
        os.makedirs(out, exist_ok=True)
        sf.write(os.path.join(out, "mix_48k.wav"), mix.astype(np.float32), SR, subtype="PCM_24")
        for k2, v in stems.items():
            sf.write(os.path.join(WORK, f"stem_{k2}.wav"), v.astype(np.float32), SR, subtype="PCM_24")
        with open(os.path.join(WORK, "audio_report.json"), "w") as fh:
            json.dump(report, fh, indent=1)
        with open(os.path.join(WORK, "sfx_cues.json"), "w") as fh:
            json.dump([dict(sample=c.sample, tag=c.tag) for c in cues], fh)
    return mix, stems, report


if __name__ == "__main__":
    import time
    t = time.time()
    _, _, rep = build()
    print(json.dumps(rep, indent=1), time.time() - t)
