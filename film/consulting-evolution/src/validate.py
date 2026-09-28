"""验收：自动检查 + 生成 validation_report.md 所需数据。

能自动测的就测（帧数、采样、节拍、印章接触帧与瞬态、响度、文字扫描……）；
测不了的（听感、审美）明确标为“需人工”。
"""
import json
import os
import re
import subprocess

import numpy as np
import soundfile as sf

from . import timeline as T
from .paths import OUTPUT, ROOT, WORK
from .render import FFMPEG, FFPROBE, count_frames

EXPECTED_STROKES = {"问": 6, "谋": 11, "商": 11, "管": 14, "略": 11, "联": 12, "行": 6, "成": 6}


def check_grid():
    from .storyboard import SHOTS, validate_structure
    T.self_check()
    grid_frames = {r["frame_index"] for r in T.iter_beats()} | {T.TOTAL_FRAMES}
    bar_frames = {r["frame_index"] for r in T.iter_beats() if r["downbeat"]}
    rows = []
    errs = list(validate_structure())
    for s in SHOTS:
        on_beat = s.f0 in grid_frames and s.f1 in grid_frames
        first = s.b0 == 0
        rows.append(dict(id=s.id, f0=s.f0, f1=s.f1, beats=s.beats, on_beat=on_beat,
                         chapter_cut_on_downbeat=(s.f0 in bar_frames) if first else None,
                         preferred_len=s.beats in (4, 8, 12, 16)))
        if not on_beat:
            errs.append(f"{s.id} 剪辑点不在节拍网格上")
        if first and s.f0 not in bar_frames:
            errs.append(f"{s.id} 章节切换不在小节首拍")
    return dict(ok=not errs, errors=errs, shots=rows, n_shots=len(SHOTS))


def _red_area(surf, box):
    import cairo  # noqa
    w, h = surf.get_width(), surf.get_height()
    arr = np.frombuffer(surf.get_data(), dtype=np.uint8).reshape(h, surf.get_stride() // 4, 4)[:, :w]
    x0, y0, x1, y1 = box
    reg = arr[y0:y1, x0:x1].astype(int)
    b, g, r = reg[..., 0], reg[..., 1], reg[..., 2]
    red = (r > 150) & (g < 95) & (b < 85)
    # 以朱红像素的外接宽度衡量印章尺寸（不受印泥颗粒、下层纹样透出的影响）
    cols = np.nonzero(red.sum(axis=0) >= 3)[0]
    return int(cols.max() - cols.min() + 1) if len(cols) else 0


SEAL_BOX = {"approve": (850, 590, 110), "brand_ring": (1150, 470, 140), "brand_final": (1140, 300, 150)}


def check_seal_sync(scale=1.0):
    """画面：印章面积最先达到最小值的帧 = 接触帧；声音：音效轨中该处瞬态起点。"""
    from .compose import render_frame
    from .scenes.base import bframe
    from .storyboard import seal_events
    sfx_stem, _ = sf.read(os.path.join(WORK, "stem_sfx.wav"), dtype="float64")
    mono = np.abs(sfx_stem).max(axis=1)
    rows = []
    for ch, beat, name, w in seal_events():
        f = bframe(ch, beat)
        cx, cy, r = SEAL_BOX.get(name, (960, 500, 190))
        box = [int(v * scale) for v in (cx - r, cy - r, cx + r, cy + r)]
        areas = {}
        for d in range(-3, 4):
            areas[f + d] = _red_area(render_frame(f + d, scale), box)
        amin = min(v for v in areas.values() if v > 0)
        vis = min(k for k, v in areas.items() if 0 < v <= amin + 1)
        s = f * T.SAMPLES_PER_FRAME
        win = mono[s - 4800:s + 4800]
        thr = 0.3 * win.max()
        onset = s - 4800 + int(np.argmax(win > thr))
        rows.append(dict(name=name, expected_frame=f, visual_contact_frame=vis, visual_ok=vis == f,
                         expected_sample=s, audio_onset_sample=onset, audio_offset_ms=(onset - s) / 48,
                         audio_ok=abs(onset - s) <= T.SAMPLES_PER_FRAME // 4, areas=list(areas.values())))
    ok = all(r["visual_ok"] and r["audio_ok"] for r in rows)
    return dict(ok=ok, rows=rows)


def probe(path):
    r = subprocess.run([FFPROBE, "-v", "error", "-show_entries",
                        "stream=index,codec_type,codec_name,profile,width,height,pix_fmt,r_frame_rate,sample_rate,"
                        "channels,duration,nb_frames,start_time,color_space,color_primaries,color_transfer,color_range:"
                        "format=duration,size,bit_rate", "-of", "json", path], capture_output=True, text=True)
    return json.loads(r.stdout)


def decode_audio(path):
    r = subprocess.run([FFMPEG, "-v", "error", "-i", path, "-vn", "-f", "f32le", "-ac", "2", "-ar", "48000", "-"],
                       capture_output=True)
    return np.frombuffer(r.stdout, dtype=np.float32).reshape(-1, 2)


def check_media(mp4, ref_wav):
    info = probe(mp4)
    frames = count_frames(mp4)
    dec = decode_audio(mp4)
    ref, _ = sf.read(ref_wav, dtype="float32")
    # 用互相关测封装后的整体音频偏移（AAC 编码延迟应由 MP4 编辑表补偿为 0）
    a = ref[:48000 * 30, 0]
    b = dec[:48000 * 30, 0]
    n = len(a) + len(b)
    nfft = 1 << (n - 1).bit_length()
    xc = np.fft.irfft(np.fft.rfft(b, nfft) * np.conj(np.fft.rfft(a, nfft)), nfft)
    lag = int(np.argmax(xc))
    if lag > nfft // 2:
        lag -= nfft
    full_decode = subprocess.run([FFMPEG, "-v", "error", "-i", mp4, "-f", "null", "-"], capture_output=True,
                                 text=True)
    v = [s for s in info["streams"] if s["codec_type"] == "video"][0]
    au = [s for s in info["streams"] if s["codec_type"] == "audio"]
    return dict(file=os.path.relpath(mp4, ROOT), frames=frames, frames_ok=frames == T.TOTAL_FRAMES,
                video=v, audio=au[0] if au else None, format=info["format"],
                decoded_audio_samples=int(len(dec)), audio_samples_ok=abs(len(dec) - T.TOTAL_SAMPLES) <= 1024,
                aac_offset_samples=lag, aac_offset_ok=abs(lag) <= 48,
                decode_errors=full_decode.stderr.strip()[:500], decodes_clean=full_decode.returncode == 0
                and not full_decode.stderr.strip())


def check_loudness_ffmpeg(path):
    r = subprocess.run([FFMPEG, "-nostats", "-i", path, "-vn", "-af", "ebur128=peak=true:framelog=quiet", "-f",
                        "null", "-"], capture_output=True, text=True)
    txt = r.stderr
    i = re.findall(r"I:\s+(-?[\d.]+) LUFS", txt)
    tp = re.findall(r"Peak:\s+(-?[\d.]+) dBFS", txt)
    lra = re.findall(r"LRA:\s+(-?[\d.]+) LU", txt)
    return dict(integrated_lufs=float(i[-1]) if i else None, true_peak_dbtp=float(tp[-1]) if tp else None,
                lra=float(lra[-1]) if lra else None)


def check_calligraphy():
    from .visuals import hanzi
    rows = []
    for ch, n in EXPECTED_STROKES.items():
        got = hanzi.stroke_count(ch)
        sched = hanzi.schedule(ch)
        sequential = all(sched[i][1] <= sched[i + 1][0] for i in range(len(sched) - 1))
        rows.append(dict(char=ch, expected=n, data=got, ok=got == n, strokes_sequential=sequential))
    return dict(ok=all(r["ok"] and r["strokes_sequential"] for r in rows), rows=rows,
                method="每笔以轮廓为裁剪区、沿中线（medians）推进圆头笔刷；前一笔写完才开始下一笔")


def check_timeline():
    from .visuals.hud import NODES
    labels = [n[0] for n in NODES]
    years = [int(y) for lab in labels for y in re.findall(r"\b(1\d{3})\b", lab)]
    ancient = [lab for lab in labels if any(k in lab for k in ("战国", "秦汉", "明清"))]
    return dict(labels=labels, years=years, years_sorted=years == sorted(years),
                ancient_use_approx=all(lab.startswith("约") for lab in ancient),
                rolling_counter=False, ok=years == sorted(years) and all(lab.startswith("约") for lab in ancient))


FORBIDDEN = [r"\d+\s*%", r"保证", r"必然", r"第一", r"唯一", r"万元", r"扫码", r"微信", r"http", r"www\.", r"@",
             r"二维码", r"客户案例：", r"成交额", r"提效\d", r"省\d+"]


def check_text(step=6, scale=0.25):
    from .compose import render_frame
    from .visuals import text as TX
    TX.LOG_TEXT = True
    TX.TEXT_LOG.clear()
    from .subtitles import load_cues
    cues = load_cues()
    for f in range(0, T.TOTAL_FRAMES, step):
        render_frame(f, scale, cues)
    TX.LOG_TEXT = False
    items = sorted(TX.TEXT_LOG.items())
    hits = []
    for t, (k, sz) in items:
        for pat in FORBIDDEN:
            if re.search(pat, t):
                hits.append((t, pat))
    small = [(t, sz) for t, (k, sz) in items if sz < 24 and not k.endswith(":vertical")]
    return dict(n_strings=len(items), strings=[dict(text=t, font=k, min_px=round(sz, 1)) for t, (k, sz) in items],
                forbidden_hits=hits, small_text=small, fallback_glyphs=sorted(TX.FALLBACK_USED),
                ok=not hits)


def check_music():
    from .audio import score
    sc = score.compose()
    rows = {}
    for ev in sc.events:
        f = ev.start // T.SAMPLES_PER_FRAME
        ch, _ = T.locate(min(f, T.TOTAL_FRAMES - 1))
        rows.setdefault(ch.id, {}).setdefault(ev.tag, 0)
        rows[ch.id][ev.tag] += 1
    return rows


def check_shots_have_actions():
    from .scenes import REGISTRY, load_all
    from .storyboard import SHOTS
    load_all()
    rows = []
    for s in SHOTS:
        rows.append(dict(id=s.id, keyword=s.keyword, n_events=len(s.events), has_scene=s.id in REGISTRY,
                         sound=s.sound))
    return dict(ok=all(r["n_events"] >= 1 and r["has_scene"] for r in rows), rows=rows)


def check_ai_flow():
    src = open(os.path.join(ROOT, "src", "scenes", "ch06.py"), encoding="utf-8").read()
    need = {"人工审批": "人工审批" in src, "资料来源（授权资料）": "授权资料" in src, "待确认字段": "待确认" in src,
            "执行后的记录": "记录" in src, "复盘回路": "复盘" in src, "异常分支": "异常" in src,
            "流程演示标注": "流程演示" in src, "不自动承诺价格/付款/交期": "不自动承诺" in src}
    return dict(ok=all(need.values()), items=need)


def run_all(final_subs=None, final_clean=None, text_step=6):
    out = {}
    out["grid"] = check_grid()
    out["calligraphy"] = check_calligraphy()
    out["timeline"] = check_timeline()
    out["shots"] = check_shots_have_actions()
    out["ai_flow"] = check_ai_flow()
    out["music"] = check_music()
    out["seal_sync"] = check_seal_sync()
    out["text"] = check_text(step=text_step)
    rep_path = os.path.join(WORK, "audio_report.json")
    out["audio_report"] = json.load(open(rep_path)) if os.path.exists(rep_path) else None
    from .audio import voice
    items = voice.load_layout()
    out["narration_layout_problems"] = voice.check_layout(items)
    try:
        from .audio import asr_check
        if asr_check.available():
            out["asr"] = asr_check.run(items)
    except Exception as e:  # noqa
        out["asr_error"] = str(e)
    ref = os.path.join(OUTPUT, "audio", "mix_48k.wav")
    for key, p in (("final_subs", final_subs), ("final_clean", final_clean)):
        if p and os.path.exists(p):
            out[key] = check_media(p, ref)
            out[key + "_loudness"] = check_loudness_ffmpeg(p)
    with open(os.path.join(WORK, "validation.json"), "w", encoding="utf-8") as fh:
        json.dump(out, fh, ensure_ascii=False, indent=1, default=str)
    return out
