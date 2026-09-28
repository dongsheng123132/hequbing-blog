"""逐帧确定性渲染 → ffmpeg 分段编码 → 拼接 → 与音轨封装。

- 画面只由 frame_index 决定；不依赖实时播放、不录屏。
- 按 CHUNK 帧分段，多进程并行；已完成且帧数正确的分段自动跳过（中断后可续渲染）。
- 一次渲染同时输出“无字幕”与“带字幕”两个版本（字幕叠加在同一帧上，不重复计算画面）。
"""
import json
import os
import shutil
import subprocess
import sys
import time
from multiprocessing import Pool

import cairo

from . import timeline as T
from .paths import OUTPUT, WORK

CHUNK = 120
FFMPEG = shutil.which("ffmpeg") or "ffmpeg"
FFPROBE = shutil.which("ffprobe") or "ffprobe"

ENC = ["-c:v", "libx264", "-preset", "slow", "-tune", "animation", "-crf", "19", "-g", "60", "-bf", "2",
       "-pix_fmt", "yuv420p", "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709",
       "-color_range", "tv", "-threads", "2"]


def _ff_writer(path, w, h):
    cmd = [FFMPEG, "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "bgr0", "-s", f"{w}x{h}",
           "-r", str(T.FPS), "-i", "-", "-vf", "scale=out_color_matrix=bt709:out_range=tv,format=yuv420p",
           *ENC, "-r", str(T.FPS), "-an", path]
    return subprocess.Popen(cmd, stdin=subprocess.PIPE)


def count_frames(path):
    if not os.path.exists(path):
        return -1
    r = subprocess.run([FFPROBE, "-v", "error", "-select_streams", "v:0", "-count_frames", "-show_entries",
                        "stream=nb_read_frames", "-of", "csv=p=0", path], capture_output=True, text=True)
    try:
        return int(r.stdout.strip().split(",")[0])
    except ValueError:
        return -1


def _chunk_paths(tag, a):
    d = os.path.join(OUTPUT, "chunks", tag)
    os.makedirs(d, exist_ok=True)
    return os.path.join(d, f"clean_{a:05d}.mp4"), os.path.join(d, f"subs_{a:05d}.mp4")


def render_chunk(args):
    a, b, scale, tag, want_clean, want_subs = args
    from .compose import draw_subtitle, render_frame
    from .subtitles import load_cues
    p_clean, p_subs = _chunk_paths(tag, a)
    need_clean = want_clean and count_frames(p_clean) != b - a
    need_subs = want_subs and count_frames(p_subs) != b - a
    if not (need_clean or need_subs):
        return a, "skip", 0.0
    cues = load_cues()
    w, h = int(round(1920 * scale)), int(round(1080 * scale))
    wc = _ff_writer(p_clean + ".part.mp4", w, h) if need_clean else None
    ws = _ff_writer(p_subs + ".part.mp4", w, h) if need_subs else None
    t0 = time.time()
    for f in range(a, b):
        surf = render_frame(f, scale, None)
        if wc:
            wc.stdin.write(bytes(surf.get_data()))
        if ws:
            ctx = cairo.Context(surf)
            ctx.scale(scale, scale)
            draw_subtitle(ctx, f, cues)
            surf.flush()
            ws.stdin.write(bytes(surf.get_data()))
    for wr, p in ((wc, p_clean), (ws, p_subs)):
        if wr:
            wr.stdin.close()
            if wr.wait() != 0:
                raise RuntimeError(f"ffmpeg failed for {p}")
            os.replace(p + ".part.mp4", p)
    return a, "done", time.time() - t0


def render_range(start, end, scale=1.0, tag="1080p", clean=True, subs=True, workers=4):
    jobs = []
    a = (start // CHUNK) * CHUNK
    while a < end:
        b = min(a + CHUNK, T.TOTAL_FRAMES)
        jobs.append((a, b, scale, tag, clean, subs))
        a = b
    t0 = time.time()
    done = 0
    with Pool(workers) as pool:
        for a, status, dt in pool.imap_unordered(render_chunk, jobs):
            done += 1
            print(f"[{done}/{len(jobs)}] chunk {a:05d} {status} {dt:.1f}s  elapsed {time.time() - t0:.0f}s", flush=True)
    return jobs


def concat(tag, variant, out_path):
    d = os.path.join(OUTPUT, "chunks", tag)
    files = sorted(f for f in os.listdir(d) if f.startswith(variant + "_") and f.endswith(".mp4")
                   and ".part" not in f)
    lst = os.path.join(d, f"{variant}_list.txt")
    with open(lst, "w") as fh:
        for f in files:
            fh.write(f"file '{os.path.join(d, f)}'\n")
    subprocess.run([FFMPEG, "-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", lst, "-c", "copy",
                    out_path], check=True)
    return out_path


def mux(video, audio_wav, out_path, bitrate="256k"):
    cmd = [FFMPEG, "-y", "-loglevel", "error", "-i", video, "-i", audio_wav, "-map", "0:v:0", "-map", "1:a:0",
           "-c:v", "copy", "-c:a", "aac", "-b:a", bitrate, "-ar", str(T.SAMPLE_RATE), "-ac", "2",
           "-movflags", "+faststart", out_path]
    subprocess.run(cmd, check=True)
    return cmd


def build_full(scale=1.0, tag="1080p", workers=4, clean=True):
    render_range(0, T.TOTAL_FRAMES, scale, tag, clean=clean, subs=True, workers=workers)
    vdir = os.path.join(WORK, "video")
    os.makedirs(vdir, exist_ok=True)
    outs = {}
    for variant in (["subs", "clean"] if clean else ["subs"]):
        v = concat(tag, variant, os.path.join(vdir, f"{tag}_{variant}_video.mp4"))
        outs[variant] = v
    return outs


if __name__ == "__main__":
    a = int(sys.argv[1])
    b = int(sys.argv[2])
    render_range(a, b, float(sys.argv[3]) if len(sys.argv) > 3 else 0.5, tag="test", clean=False)
