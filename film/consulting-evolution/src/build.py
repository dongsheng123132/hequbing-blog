"""工程总入口。

  python -m src.build grid          生成 beat_grid.csv（并自检时间基准）
  python -m src.build storyboard    生成 storyboard.csv（并校验镜头结构）
  python -m src.build voice         合成/锁定旁白 → narration.txt、subtitles.srt、字幕帧表
  python -m src.build audio         配乐 + 音效 + 旁白混音 → output/audio/
  python -m src.build frame 1234 [--scale 1]            单帧 PNG
  python -m src.build chapter 6 [--scale 0.5]           指定章节预览 MP4（带字幕与音轨）
  python -m src.build preview                          全片低清预览 960×540
  python -m src.build render [--workers 4]             1080p 正式渲染（可中断续渲）+ 封装两版
  python -m src.build validate                          自动验收 → output/work/validation.json
  python -m src.build all                              以上全部（不含单帧/章节）
"""
import argparse
import os
import subprocess
import sys

from . import timeline as T
from .paths import OUTPUT, ROOT, WORK

FINAL = os.path.join(OUTPUT, "final")


def step_grid():
    rows = T.write_beat_grid_csv(os.path.join(ROOT, "beat_grid.csv"))
    print("beat_grid.csv", len(rows), "beats; self_check", T.self_check())


def step_storyboard():
    from .storyboard import validate_structure, write_storyboard_csv
    errs = validate_structure()
    if errs:
        raise SystemExit("\n".join(errs))
    rows = write_storyboard_csv(os.path.join(ROOT, "storyboard.csv"))
    print("storyboard.csv", len(rows), "shots")


def step_voice():
    from . import subtitles
    from .audio import voice
    items = voice.layout()
    voice.save_layout(items)
    probs = voice.check_layout(items)
    for p in probs:
        print("!!", p)
    cues = subtitles.build_cues(items)
    subtitles.save_cues(cues)
    subtitles.write_srt(cues, os.path.join(ROOT, "subtitles.srt"))
    with open(os.path.join(ROOT, "narration.txt"), "w", encoding="utf-8") as fh:
        fh.write("《商业咨询进化史》旁白脚本\n")
        fh.write("配音：MeloTTS（MIT 许可）离线合成的锁定 take，女声；可整体替换为真人配音（见 README）。\n")
        fh.write("时间码为 分:秒:帧（30 fps）。起读点落在整拍上；结束点为实测配音长度。\n\n")
        cur = None
        for it in items:
            ch = T.CHAPTERS[it["chapter"]]
            if ch.id != cur:
                fh.write(f"\n【{ch.id:02d}｜{ch.name}】\n")
                cur = ch.id
            fh.write(f"{T.timecode(it['start_frame'])} — {T.timecode(it['end_frame'])}  "
                     f"(第 {it['beat']} 拍)  {it['display']}\n")
            if it["tts"] != it["display"]:
                fh.write(f"    TTS 读法：{it['tts']}\n")
    print("narration.txt / subtitles.srt,", len(cues), "cues")


def step_audio():
    from .audio import mix
    _, _, rep = mix.build()
    print(rep)


def _mux_chapter(video, ch, out):
    a = T.chapter_start_frame(ch) * T.SAMPLES_PER_FRAME / T.SAMPLE_RATE
    d = T.CHAPTERS[ch].frames / T.FPS
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", video, "-ss", f"{a:.6f}", "-t", f"{d:.6f}", "-i",
                    os.path.join(OUTPUT, "audio", "mix_48k.wav"), "-map", "0:v", "-map", "1:a", "-c:v", "copy",
                    "-c:a", "aac", "-b:a", "192k", out], check=True)


def step_chapter(ch, scale):
    from .render import render_range, concat
    import shutil
    tag = f"ch{ch}_{scale}"
    a, b = T.chapter_start_frame(ch), T.chapter_end_frame(ch)
    # 章节按 CHUNK 对齐渲染后裁切到章节范围
    render_range(a, b, scale, tag=tag, clean=False, subs=True)
    v = concat(tag, "subs", os.path.join(WORK, f"{tag}_all.mp4"))
    start = a - (a // 120) * 120
    cut = os.path.join(WORK, f"{tag}.mp4")
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", v, "-vf",
                    f"trim=start_frame={start}:end_frame={start + b - a},setpts=PTS-STARTPTS",
                    "-c:v", "libx264", "-crf", "20", "-pix_fmt", "yuv420p", cut], check=True)
    out = os.path.join(OUTPUT, "preview", f"chapter{ch:02d}_preview.mp4")
    os.makedirs(os.path.dirname(out), exist_ok=True)
    _mux_chapter(cut, ch, out)
    print(out)


def step_preview(workers):
    from .render import build_full, mux
    outs = build_full(scale=0.5, tag="540p", workers=workers, clean=False)
    out = os.path.join(OUTPUT, "preview", "商业咨询进化史_低清预览_960x540.mp4")
    os.makedirs(os.path.dirname(out), exist_ok=True)
    mux(outs["subs"], os.path.join(OUTPUT, "audio", "mix_48k.wav"), out, bitrate="160k")
    print(out)
    return out


def step_render(workers):
    from .render import build_full, mux
    outs = build_full(scale=1.0, tag="1080p", workers=workers, clean=True)
    os.makedirs(FINAL, exist_ok=True)
    audio = os.path.join(OUTPUT, "audio", "mix_48k.wav")
    subs = os.path.join(FINAL, "商业咨询进化史_1080p_字幕版.mp4")
    clean = os.path.join(FINAL, "商业咨询进化史_1080p_无字幕版.mp4")
    cmds = [mux(outs["subs"], audio, subs), mux(outs["clean"], audio, clean)]
    with open(os.path.join(WORK, "ffmpeg_commands.txt"), "w") as fh:
        for c in cmds:
            fh.write(" ".join(c) + "\n")
    print(subs, clean)
    return subs, clean


def step_validate():
    from . import validate
    subs = os.path.join(FINAL, "商业咨询进化史_1080p_字幕版.mp4")
    clean = os.path.join(FINAL, "商业咨询进化史_1080p_无字幕版.mp4")
    out = validate.run_all(subs, clean)
    print({k: (v.get("ok") if isinstance(v, dict) else None) for k, v in out.items()})


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("step")
    ap.add_argument("arg", nargs="?")
    ap.add_argument("--scale", type=float, default=0.5)
    ap.add_argument("--workers", type=int, default=4)
    a = ap.parse_args()
    if a.step == "grid":
        step_grid()
    elif a.step == "storyboard":
        step_storyboard()
    elif a.step == "voice":
        step_voice()
    elif a.step == "audio":
        step_audio()
    elif a.step == "frame":
        from .compose import render_frame
        from .subtitles import load_cues
        f = int(a.arg)
        s = render_frame(f, a.scale, load_cues())
        p = os.path.join(WORK, "keyframes", f"frame_{f:05d}.png")
        os.makedirs(os.path.dirname(p), exist_ok=True)
        s.write_to_png(p)
        print(p)
    elif a.step == "chapter":
        step_chapter(int(a.arg), a.scale)
    elif a.step == "preview":
        step_preview(a.workers)
    elif a.step == "render":
        step_render(a.workers)
    elif a.step == "validate":
        step_validate()
    elif a.step == "all":
        step_grid()
        step_storyboard()
        step_voice()
        step_audio()
        step_preview(a.workers)
        step_render(a.workers)
        step_validate()
    else:
        raise SystemExit(__doc__)


if __name__ == "__main__":
    main()
