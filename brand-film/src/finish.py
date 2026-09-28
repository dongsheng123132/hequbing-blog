"""Encode + mux, export the poster and the rhythm contact sheet.

  python finish.py
"""
import os
import subprocess
import sys

from PIL import Image, ImageDraw, ImageFont

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from timeline import FPS, FRAMES, BEAT, W, H  # noqa: E402

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
FR = os.path.join(ROOT, 'build', 'frames')
OUT = os.path.join(ROOT, 'out')
MP4 = os.path.join(OUT, 'hequbing_yixianpoju_15s_1080p60.mp4')
WAV = os.path.join(OUT, 'score.wav')
POSTER = os.path.join(OUT, 'poster_last_frame.png')
SHEET = os.path.join(OUT, 'contact_sheet.png')


def encode():
    cmd = [
        'ffmpeg', '-y', '-hide_banner', '-loglevel', 'error',
        '-framerate', str(FPS), '-start_number', '0', '-i', os.path.join(FR, '%04d.png'),
        '-i', WAV,
        '-map', '0:v:0', '-map', '1:a:0',
        '-vf', 'scale=in_range=full:out_range=tv:out_color_matrix=bt709,format=yuv420p',
        '-c:v', 'libx264', '-preset', 'slow', '-crf', '14', '-tune', 'film',
        '-profile:v', 'high', '-level:v', '4.2', '-g', '120', '-bf', '3',
        '-r', str(FPS), '-fps_mode', 'cfr',
        '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv',
        '-c:a', 'aac', '-b:a', '320k', '-ar', '48000', '-ac', '2',
        '-movflags', '+faststart', '-metadata', 'title=贺去病商业咨询 · 一线破局',
        MP4,
    ]
    subprocess.run(cmd, check=True)
    print('wrote', MP4)


def poster():
    im = Image.open(os.path.join(FR, f'{FRAMES - 1:04d}.png')).convert('RGB')
    im.save(POSTER, optimize=True)
    print('wrote', POSTER)


def contact_sheet():
    """Every beat (24 frames), labelled with time, frame, bar.beat; bar downbeats outlined."""
    cols, tw = 6, 400
    th = int(tw * H / W)
    beats = list(range(0, 24)) + [None]
    idx = [int(round(bn * BEAT * FPS)) if bn is not None else FRAMES - 1 for bn in beats]
    rows = (len(idx) + cols - 1) // cols
    pad, lab = 10, 22
    S = Image.new('RGB', (cols * (tw + pad) + pad, rows * (th + lab + pad) + pad + 40), (28, 28, 30))
    d = ImageDraw.Draw(S)
    try:
        font = ImageFont.truetype('/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc', 15, index=2)
        big = ImageFont.truetype('/usr/share/fonts/opentype/noto/NotoSansCJK-Medium.ttc', 18, index=2)
    except OSError:
        font = big = ImageFont.load_default()
    d.text((pad, 10), '贺去病商业咨询《一线破局》· 节奏联系表  96 BPM · 4/4 · 60 fps · 每格 = 1 拍 (24 帧)；红框 = 小节线',
           fill=(235, 230, 222), font=big)
    for k, (bn, fi) in enumerate(zip(beats, idx)):
        r, c = divmod(k, cols)
        x, y = pad + c * (tw + pad), 40 + pad + r * (th + lab + pad)
        im = Image.open(os.path.join(FR, f'{fi:04d}.png')).convert('RGB').resize((tw, th), Image.LANCZOS)
        S.paste(im, (x, y + lab))
        t = fi / FPS
        if bn is None:
            label = f'{t:6.3f}s  f{fi}  (末帧)'
        else:
            label = f'{t:6.3f}s  f{fi}  {bn // 4 + 1}.{bn % 4 + 1}'
        down = bn is not None and bn % 4 == 0
        d.text((x, y + 2), label, fill=(185, 45, 39) if down else (200, 196, 188), font=font)
        if down:
            d.rectangle([x - 2, y + lab - 2, x + tw + 1, y + lab + th + 1], outline=(185, 45, 39), width=2)
    S.save(SHEET, optimize=True)
    print('wrote', SHEET)


if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    encode()
    poster()
    contact_sheet()
