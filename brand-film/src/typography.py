"""Chinese typesetting with explicit tracking and optical centring.

Fonts: Noto Serif CJK SC (SIL OFL 1.1). The repo ships subsets covering the
film's copy; if you change the copy, the full system font is used instead
(apt: fonts-noto-cjk fonts-noto-cjk-extra). Missing glyphs abort the render.
"""
import os

import skia

HERE = os.path.dirname(os.path.abspath(__file__))
FONT_DIR = os.path.join(HERE, '..', 'fonts')
SYSTEM = '/usr/share/fonts/opentype/noto/NotoSerifCJK-{w}.ttc'
SC_INDEX = 2  # JP, KR, SC, TC, HK

_cache = {}


def typeface(weight='SemiBold', text=None):
    key = (weight, text is None)
    tf = None
    sub = os.path.join(FONT_DIR, f'NotoSerifSC-{weight}-subset.otf')
    if os.path.exists(sub):
        tf = skia.Typeface.MakeFromFile(sub)
        if text is not None and not covers(tf, text):
            tf = None
    if tf is None:
        path = SYSTEM.format(w=weight)
        if not os.path.exists(path):
            raise SystemExit(f'Font not found: {path} (apt install fonts-noto-cjk-extra)')
        tf = skia.Typeface.MakeFromFile(path, SC_INDEX)
    if text is not None and not covers(tf, text):
        raise SystemExit(f'Missing glyphs for: {text!r}')
    _cache[key] = tf
    return tf


def covers(tf, text):
    f = skia.Font(tf, 10)
    glyphs = f.textToGlyphs(text.replace(' ', ''))
    return all(g != 0 for g in glyphs)


PUNCT = set('，。、；：！？')
HALF_PUNCT = set('，。、')   # 标点挤压: these sit in the left half of the em box (SC)


class Line:
    """A single line of text laid out with tracking (em units)."""

    def __init__(self, text, weight, size, tracking=0.0, space_em=0.3):
        self.text = text
        self.tf = typeface(weight, text)
        self.font = skia.Font(self.tf, size)
        self.font.setEdging(skia.Font.Edging.kAntiAlias)
        self.font.setSubpixel(True)
        self.font.setHinting(skia.FontHinting.kNone)
        self.size = size
        self.glyphs = []   # (char, glyph_id, x)
        x = 0.0
        track = tracking * size
        chars = list(text)
        for i, ch in enumerate(chars):
            if ch == ' ':
                x += space_em * size
                continue
            gid = self.font.textToGlyphs(ch)[0]
            w = self.font.getWidths([gid])[0]
            if ch in HALF_PUNCT:
                w *= 0.5
            self.glyphs.append((ch, gid, x, w))
            x += w
            if i < len(chars) - 1 and chars[i + 1] != ' ':
                x += track
        self.advance = x
        # ink bounds of the whole line, ignoring trailing punctuation for centring
        ink = [self._ink(g) for g in self.glyphs]
        self.ink_left = min(b.left() for b in ink)
        self.ink_right = max(b.right() for b in ink)
        core = [b for (g, b) in zip(self.glyphs, ink) if g[0] not in PUNCT] or ink
        self.core_left = min(b.left() for b in core)
        self.core_right = max(b.right() for b in core)
        m = self.font.getMetrics()
        self.ink_top = min(b.top() for b in ink)
        self.ink_bottom = max(b.bottom() for b in ink)
        self.ascent, self.descent = m.fAscent, m.fDescent

    def _ink(self, g):
        ch, gid, x, w = g
        b = self.font.getBounds([gid])[0]
        return skia.Rect.MakeLTRB(b.left() + x, b.top(), b.right() + x, b.bottom())

    def optical_width(self):
        return self.core_right - self.core_left

    def origin_for_center(self, cx, cy):
        """Baseline origin so that the core ink (sans trailing punctuation) is
        centred horizontally on cx and the CJK body is centred vertically on cy."""
        ox = cx - (self.core_left + self.core_right) / 2
        # CJK ideographic body: centre between ink top/bottom of ideographs
        oy = cy - (self.ink_top + self.ink_bottom) / 2
        return ox, oy

    def draw(self, canvas, ox, oy, pnt, per_glyph=None):
        """per_glyph(i, ch) -> (dx, dy, alpha_mul) or None."""
        for i, (ch, gid, x, w) in enumerate(self.glyphs):
            dx = dy = 0.0
            p = pnt
            if per_glyph is not None:
                r = per_glyph(i, ch)
                if r is None:
                    continue
                dx, dy, am = r
                if am <= 0:
                    continue
                if am < 1:
                    p = skia.Paint(pnt)
                    p.setAlphaf(pnt.getAlphaf() * am)
            canvas.drawSimpleText(ch, ox + x + dx, oy + dy, self.font, p)

    def glyph_rects(self, ox, oy):
        return [skia.Rect.MakeLTRB(ox + b.left(), oy + b.top(), ox + b.right(), oy + b.bottom())
                for b in (self._ink(g) for g in self.glyphs)]
