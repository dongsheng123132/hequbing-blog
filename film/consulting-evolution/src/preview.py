"""关键帧预览：python -m src.preview 帧号[,帧号...] [--scale 0.5] [--subs] [--sheet 名称]"""
import argparse
import os

import cairo

from .compose import render_frame
from .paths import WORK


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("frames")
    ap.add_argument("--scale", type=float, default=0.5)
    ap.add_argument("--subs", action="store_true")
    ap.add_argument("--sheet", default=None)
    ap.add_argument("--cols", type=int, default=2)
    a = ap.parse_args()
    frames = [int(x) for x in a.frames.split(",")]
    cues = None
    if a.subs:
        from .subtitles import load_cues
        cues = load_cues()
    out = os.path.join(WORK, "keyframes")
    os.makedirs(out, exist_ok=True)
    surfs = [render_frame(f, a.scale, cues) for f in frames]
    if a.sheet:
        w, h = surfs[0].get_width(), surfs[0].get_height()
        cols = min(a.cols, len(surfs))
        rows = (len(surfs) + cols - 1) // cols
        sheet = cairo.ImageSurface(cairo.FORMAT_RGB24, cols * w + (cols - 1) * 6, rows * h + (rows - 1) * 6)
        ctx = cairo.Context(sheet)
        ctx.set_source_rgb(1, 1, 1)
        ctx.paint()
        for i, s in enumerate(surfs):
            ctx.set_source_surface(s, (i % cols) * (w + 6), (i // cols) * (h + 6))
            ctx.paint()
        p = os.path.join(out, a.sheet + ".png")
        sheet.write_to_png(p)
        print(p)
    else:
        for f, s in zip(frames, surfs):
            p = os.path.join(out, f"f{f:05d}.png")
            s.write_to_png(p)
            print(p)


if __name__ == "__main__":
    main()
