"""Motion strip from rendered frames: python strip.py out.png start end step [cols]"""
import os
import sys

from PIL import Image, ImageDraw

FR = os.path.join(os.path.dirname(__file__), '..', 'build', 'frames')


def strip(out, a, b, step, cols=6, w=320):
    idx = list(range(a, b + 1, step))
    h = int(w * 9 / 16)
    rows = (len(idx) + cols - 1) // cols
    S = Image.new('RGB', (cols * (w + 4) + 4, rows * (h + 18) + 4), (50, 50, 50))
    d = ImageDraw.Draw(S)
    for k, i in enumerate(idx):
        r, c = divmod(k, cols)
        x, y = 4 + c * (w + 4), 4 + r * (h + 18)
        S.paste(Image.open(os.path.join(FR, f'{i:04d}.png')).convert('RGB').resize((w, h), Image.LANCZOS), (x, y + 16))
        d.text((x, y + 2), f'f{i}  {i / 60:.3f}s', fill=(230, 230, 230))
    S.save(out)


if __name__ == '__main__':
    a = sys.argv
    strip(a[1], int(a[2]), int(a[3]), int(a[4]), int(a[5]) if len(a) > 5 else 6)
