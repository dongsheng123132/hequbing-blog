"""竖版声音：按竖版节拍网格重新编排同一主题（不是把横版音乐剪短），复用锁定旁白，同一混音链。"""
import json
import os

import numpy as np
import pyloudnorm as pyln
import soundfile as sf
from scipy.signal import butter, fftconvolve, sosfilt

from . import film as F
from . import timeline as V
from ..audio import score as SC
from ..audio.score import S
from ..audio.mix import compress, lookahead_limit, true_peak_db, _smooth_env
from ..paths import OUTPUT, ROOT, WORK, load_config
from ..visuals import hanzi

SR = 48000
N = V.TOTAL_SAMPLES


def compose():
    sc = SC.Score(posf=V.pos, secf=V.secs)
    secs = V.secs
    Q, A, Q_END, CH = SC.Q, SC.A, SC.Q_END, SC.CHORDS
    # V0 问（120 BPM）
    sc.add(0, 0, lambda: S.pad(38, secs(0, 14), 0.5), 0.8, 0, 0.5, "drone")
    sc.add(0, 0, lambda: S.drum_low(0.35, decay=1.2), 0.9, 0, 0.5, "drum")
    sc.melody(S.flute, 0, 4, Q, gain=0.75, pan=-0.1, send=0.45)
    sc.add(0, 11, lambda: S.bell(74, 3.0, 0.5), 0.8, -0.2, 0.5, "bell")
    sc.mute(0, 14.5, 15.0, 1.0, 0.0)
    sc.mute(0, 15.0, 0, 0.0, 0.0, ch1=1)
    sc.mute(1, 0, 0.001, 0.0, 1.0)
    # V1 编年（150 BPM）：每段换一种音色
    sc.add(1, 0, lambda: S.timpani(38, 0.7), 0.9, 0, 0.3, "timp")
    for bar in range(11):
        name = SC.CYCLE[bar % 4]
        sc.chord(S.pad, 1, bar * 4, name, 4, gain=0.4, send=0.5)
    sc.melody(S.flute, 1, 0, Q, gain=0.8, pan=-0.1)                                     # 谋
    for b in (0, 4):
        sc.add(1, b, lambda b=b: S.bell(74 - b, 2.0, 0.3, seed=b), 0.7, 0.2, 0.5, "bell")
    sc.melody(S.pluck, 1, 8, A, gain=0.9, pan=0.15)                                     # 商
    for k in range(16):
        sc.add(1, 8 + k * 0.5, lambda k=k: S.wood(0.25, 1100 if k % 2 else 760, seed=k), 0.6, 0.3, 0.15, "wood")
    for q in range(32):                                                                 # 管
        sc.add(1, 16 + q * 0.25, lambda q=q: S.metal_tick(0.2 if q % 4 else 0.3, seed=q % 7), 0.8, 0.2, 0.1, "tick")
    sc.melody(S.strings, 1, 16, Q, transpose=12, gain=1.2)
    sc.chord(S.brass, 1, 24, "I", 7.5, gain=0.35)                                       # 略
    sc.melody(S.strings, 1, 24, A, transpose=12, gain=1.2)
    for bar in range(8, 11):                                                            # 联
        for k in range(8):
            notes = CH[SC.CYCLE[bar % 4]]["notes"]
            sc.add(1, bar * 4 + k * 0.5, lambda m=notes[k % len(notes)] + 12, k=k: S.pulse(m, 0.2, 0.3, seed=k),
                   0.6, -0.3 + 0.08 * k, 0.2, "arp")
        sc.add(1, bar * 4, lambda: S.kick(0.5), 0.8, 0, 0.05, "kick")
    sc.mute(1, 42.5, 44.0, 1.0, 0.4)
    sc.mute(2, 0, 0.001, 0.4, 1.0)
    # V2 行（150 BPM，四组各 12 拍）
    sc.add(2, 0, lambda: S.timpani(38, 0.9), 1.0, 0, 0.3, "timp")
    for bar in range(12):
        name = SC.CYCLE[bar % 4]
        g = bar // 3
        sc.chord(S.strings if g else S.pad, 2, bar * 4, name, 4, gain=0.4 + 0.08 * g, send=0.45)
        sc.add(2, bar * 4, lambda: S.kick(0.6), 0.8, 0, 0.05, "kick")
        for k in range(1, 8, 2):
            sc.add(2, bar * 4 + k * 0.5, lambda k=k: S.hat(0.3, seed=k), 0.7, 0.3, 0.05, "hat")
        if g >= 1:
            sc.bass(S.sub_bass, 2, bar * 4, name, 3.8, gain=0.7)
            sc.add(2, bar * 4 + 2, lambda: S.kick(0.5), 0.8, 0, 0.05, "kick")
        if g >= 2:
            sc.chord(S.brass, 2, bar * 4, name, 3.8, gain=0.3, send=0.4)
    for i, m in enumerate([59, 62, 64, 66, 69, 66]):
        sc.add(2, 3.0 + i * 1.2 + 0.35, lambda m=m: S.pluck(m + 12, 0.8, 0.8, bright=0.7), 1.0, -0.5 + 0.2 * i, 0.3,
               "flip-note")
    sc.melody(S.strings, 2, 12, A, transpose=12, gain=1.2)
    sc.add(2, 30, lambda: S.bell(74, 3.0, 0.6), 0.9, -0.2, 0.5, "bell")
    sc.melody(S.brass, 2, 36, Q, gain=1.1)
    sc.melody(S.strings, 2, 36, Q, transpose=12, gain=1.2)
    for b in (42, 44, 46):
        sc.add(2, b, lambda: S.timpani(38, 1.0), 1.0, 0, 0.35, "hit")
        sc.add(2, b, lambda b=b: S.drum_low(0.7, decay=0.8, seed=b), 0.9, 0, 0.35, "hit")
    # V3 成（150 BPM）
    sc.add(3, 0, lambda: S.timpani(38, 1.0), 1.0, 0, 0.35, "timp")
    for b, name, n in ((0, "I", 8), (8, "VI", 8), (16, "II", 8), (24, "I", 20)):
        sc.chord(S.strings, 3, b, name, n, gain=0.6, send=0.5)
        sc.bass(S.sub_bass, 3, b, name, n - 0.2, gain=0.5)
    sc.melody(S.flute, 3, 4, A, scale=2.0, gain=0.8, pan=-0.1)
    sc.add(3, 25, lambda: S.bell(74, 4.0, 0.55), 0.9, -0.2, 0.55, "bell")
    sc.melody(S.flute, 3, 30, Q_END, gain=0.7, pan=-0.1, send=0.5)
    sc.add(3, 38, lambda: S.bell(74, 4.0, 0.5, seed=5), 0.9, -0.15, 0.6, "bell")
    sc.mute(3, 40.0, 44.0, 1.0, 0.0)
    return sc


def sfx_cues():
    from ..audio.sfx import Cue
    cues = []
    for sh in F.SHOTS:
        if sh.kw_write:
            w0, w1 = sh.kw_write
            for i, (a, b) in enumerate(hanzi.schedule(sh.keyword)):
                b0 = w0 + a * (w1 - w0)
                b1 = w0 + b * (w1 - w0)
                d = (V.bframe(sh.chapter, b1) - V.bframe(sh.chapter, b0)) / 30
                cues.append(Cue(V.bframe(sh.chapter, b0) * 1600,
                                (lambda d=d, i=i, k=sh.id: S.brush(max(0.06, d), 0.55, seed=f"{k}:{i}")), 1.0,
                                -0.3, 0.1, "brush"))
    for ch, beat, name, w in F.seal_events():
        cues.append(Cue(V.bframe(ch, beat) * 1600, (lambda w=w, n=name: S.seal_impact(w, seed=n)), 0.5, 0, 0.25,
                        f"seal:{name}"))
    for sh in F.SHOTS[2:7]:            # 编年段落切换：一声木
        cues.append(Cue(sh.f0 * 1600, lambda: S.wood(0.4, 820), 0.8, 0.2, 0.2, "segment"))
    return cues


def build():
    cfg = load_config()
    lay = F.narration_layout()
    vbuf = np.zeros(N)
    for it in lay:
        x, _ = sf.read(it["path"], dtype="float64")
        x = sosfilt(butter(2, 80 / (SR / 2), btype="high", output="sos"), x)
        rms = np.sqrt(np.mean(x[np.abs(x) > 0.02 * np.max(np.abs(x))] ** 2))
        x = compress(x * (0.1 / rms))
        s0 = it["start_sample"]
        vbuf[s0:s0 + len(x)] += x[:N - s0]
    v_ir = S.reverb_ir(0.9, seed=3, predelay=0.012)
    voice_st = np.stack([vbuf, vbuf], 1) * 0.92 + np.stack([fftconvolve(vbuf, v_ir[:, c])[:N] for c in range(2)], 1) * 0.1
    sc = compose()
    dry, send = SC.render(sc, N)
    ir = S.reverb_ir(2.6, seed=1)
    music = (dry + np.stack([fftconvolve(send[:, c], ir[:, c])[:N] for c in range(2)], 1) * 0.9) * \
        SC.automation(sc, N)[:, None]
    from ..audio.sfx import render as sfx_render
    cues = sfx_cues()
    sdry, ssend = sfx_render(cues, N)
    ir2 = S.reverb_ir(1.6, seed=2)
    effects = sdry + np.stack([fftconvolve(ssend[:, c], ir2[:, c])[:N] for c in range(2)], 1) * 0.8
    k = np.clip(_smooth_env(vbuf, 0.03, 0.45) / 0.02, 0, 1)
    mix = music * (1 - 0.5 * k)[:, None] * 0.62 + effects * (1 - 0.2 * k)[:, None] * 0.5 + voice_st * 1.25
    meter = pyln.Meter(SR)
    l0 = meter.integrated_loudness(mix)
    mix *= 10 ** ((cfg["audio"]["target_lufs"] - l0) / 20)
    tp0 = true_peak_db(mix)
    gr = dict(max_db=0.0)
    if tp0 > cfg["audio"]["true_peak_max_dbtp"]:
        mix, gr = lookahead_limit(mix, cfg["audio"]["true_peak_max_dbtp"] - 0.6)
    rep = dict(lufs=meter.integrated_loudness(mix), true_peak_dbtp=true_peak_db(mix), true_peak_before_limit=tp0,
               limiter=gr, samples=len(mix))
    out = os.path.join(OUTPUT, "audio")
    os.makedirs(out, exist_ok=True)
    sf.write(os.path.join(out, "vertical_mix_48k.wav"), mix.astype(np.float32), SR, subtype="PCM_24")
    sfx_only = effects * (1 - 0.2 * k)[:, None] * 0.5
    sf.write(os.path.join(WORK, "vertical_stem_sfx.wav"), sfx_only.astype(np.float32), SR, subtype="PCM_24")
    cues_sub = F.build_cues(lay)
    with open(os.path.join(WORK, "vertical_cues.json"), "w", encoding="utf-8") as fh:
        json.dump(cues_sub, fh, ensure_ascii=False, indent=1)
    with open(os.path.join(WORK, "vertical_audio_report.json"), "w") as fh:
        json.dump(rep, fh, indent=1, default=float)
    return rep, cues_sub, lay


if __name__ == "__main__":
    rep, cues, lay = build()
    print(json.dumps(rep, indent=1, default=float))
    for it in lay:
        print(it["id"], it["chapter"], it["beat"], V.timecode(it["start_frame"]), V.timecode(it["end_frame"]))
