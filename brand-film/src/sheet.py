"""Tile preview stills into one image for quick review: python sheet.py out.png t1 t2 ..."""
import os
import sys

from PIL import Image, ImageDraw

PREV = os.path.join(os.path.dirname(__file__), '..', 'build', 'preview')


def sheet(out, times, cols=3, w=640):
    ims = [Image.open(os.path.join(PREV, f't{float(t):06.3f}.png')).convert('RGB') for t in times]
    h = int(ims[0].height * w / ims[0].width)
    rows = (len(ims) + cols - 1) // cols
    S = Image.new('RGB', (cols * w + (cols + 1) * 6, rows * (h + 22) + 6), (60, 60, 60))
    d = ImageDraw.Draw(S)
    for i, (t, im) in enumerate(zip(times, ims)):
        r, c = divmod(i, cols)
        x, y = 6 + c * (w + 6), 6 + r * (h + 22)
        S.paste(im.resize((w, h), Image.LANCZOS), (x, y + 18))
        d.text((x, y + 2), f'{float(t):.3f}s  f{round(float(t) * 60)}', fill=(230, 230, 230))
    S.save(out)


if __name__ == '__main__':
    sheet(sys.argv[1], sys.argv[2:])
