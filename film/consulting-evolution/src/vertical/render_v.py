"""竖版渲染：python -m src.vertical.render_v [--scale 1.0]

与横版相同的确定性分段渲染 / 续渲染 / 封装流程；输出带字幕竖版 MP4。
"""
import argparse
import json
import os
import time
from multiprocessing import Pool

import cairo

from . import timeline as V
from ..paths import OUTPUT, WORK
from ..render import _ff_writer, concat, count_frames, mux

CHUNK = 120


def _chunk(args):
    a, b, scale, tag = args
    from .film import draw_subtitle, render_frame
    with open(os.path.join(WORK, "vertical_cues.json"), encoding="utf-8") as fh:
        cues = json.load(fh)
    d = os.path.join(OUTPUT, "chunks", tag)
    os.makedirs(d, exist_ok=True)
    p = os.path.join(d, f"subs_{a:05d}.mp4")
    if count_frames(p) == b - a:
        return a, "skip"
    w, h = int(round(V.W * scale)), int(round(V.H * scale))
    wr = _ff_writer(p + ".part.mp4", w, h)
    for f in range(a, b):
        surf = render_frame(f, scale, cues)
        wr.stdin.write(bytes(surf.get_data()))
    wr.stdin.close()
    if wr.wait() != 0:
        raise RuntimeError(p)
    os.replace(p + ".part.mp4", p)
    return a, "done"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--scale", type=float, default=1.0)
    ap.add_argument("--workers", type=int, default=4)
    a = ap.parse_args()
    tag = f"vertical_{a.scale}"
    jobs = [(x, min(x + CHUNK, V.TOTAL_FRAMES), a.scale, tag) for x in range(0, V.TOTAL_FRAMES, CHUNK)]
    t0 = time.time()
    with Pool(a.workers) as pool:
        for i, (x, stt) in enumerate(pool.imap_unordered(_chunk, jobs)):
            print(f"[{i + 1}/{len(jobs)}] {x} {stt} {time.time() - t0:.0f}s", flush=True)
    video = concat(tag, "subs", os.path.join(WORK, f"{tag}_video.mp4"))
    out = os.path.join(OUTPUT, "final", "商业咨询进化史_竖版_1080x1920_字幕版.mp4")
    os.makedirs(os.path.dirname(out), exist_ok=True)
    mux(video, os.path.join(OUTPUT, "audio", "vertical_mix_48k.wav"), out)
    print(out)


if __name__ == "__main__":
    main()
