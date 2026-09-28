"""文字渲染：fontTools 读取字形轮廓 → cairo 路径。

按文件路径加载字体（不依赖系统字体匹配），结果逐帧确定。
TTC 字体集按 family 名选择简体中文（SC）字面，避免误用日文字形。
"""
import functools
import os

from fontTools.pens.basePen import BasePen
from fontTools.ttLib import TTCollection, TTFont

from ..paths import asset, load_config


class _RecPen(BasePen):
    def __init__(self, glyphset):
        super().__init__(glyphset)
        self.ops = []

    def _moveTo(self, p):
        self.ops.append(("M", p))

    def _lineTo(self, p):
        self.ops.append(("L", p))

    def _curveToOne(self, p1, p2, p3):
        self.ops.append(("C", p1, p2, p3))

    def _qCurveToOne(self, p1, p2):
        p0 = self._getCurrentPoint()
        c1 = (p0[0] + 2 / 3 * (p1[0] - p0[0]), p0[1] + 2 / 3 * (p1[1] - p0[1]))
        c2 = (p2[0] + 2 / 3 * (p1[0] - p2[0]), p2[1] + 2 / 3 * (p1[1] - p2[1]))
        self.ops.append(("C", c1, c2, p2))

    def _closePath(self):
        self.ops.append(("Z",))

    def _endPath(self):
        pass


class Font:
    def __init__(self, path, family=None):
        if path.lower().endswith(".ttc"):
            coll = TTCollection(path, lazy=True)
            chosen = None
            for f in coll.fonts:
                name = f["name"].getDebugName(1) or ""
                if family and name.startswith(family):
                    chosen = f
                    break
            if chosen is None:
                raise ValueError(f"{path}: 找不到字面 {family}")
            self.tt = chosen
        else:
            self.tt = TTFont(path, lazy=True)
        self.upm = self.tt["head"].unitsPerEm
        self.cmap = self.tt.getBestCmap()
        self.gs = self.tt.getGlyphSet()
        self.hmtx = self.tt["hmtx"]
        os2 = self.tt["OS/2"]
        self.ascent = getattr(os2, "sTypoAscender", self.upm * 0.88)
        self.descent = getattr(os2, "sTypoDescender", -self.upm * 0.12)
        self._cache = {}
        self.fallback = None
        self.name = os.path.basename(path)

    def has(self, ch):
        return ord(ch) in self.cmap

    def glyph(self, ch):
        if ch in self._cache:
            return self._cache[ch]
        gname = self.cmap.get(ord(ch))
        if gname is None:
            if self.fallback is not None and self.fallback.has(ch):
                ops, adv = self.fallback.glyph(ch)
                k = self.upm / self.fallback.upm
                ops = [tuple([op[0]] + [(p[0] * k, p[1] * k) for p in op[1:]]) for op in ops]
                FALLBACK_USED.add((self.name, ch))
                self._cache[ch] = (ops, adv * k)
                return self._cache[ch]
            raise KeyError(f"字体缺字：{ch!r}")
        pen = _RecPen(self.gs)
        self.gs[gname].draw(pen)
        adv = self.hmtx[gname][0]
        self._cache[ch] = (pen.ops, adv)
        return self._cache[ch]

    def advance(self, ch, size):
        return self.glyph(ch)[1] * size / self.upm

    def width(self, text, size, tracking=0.0):
        if not text:
            return 0.0
        return sum(self.advance(c, size) for c in text) + tracking * size * (len(text) - 1)


FALLBACK_USED = set()
TEXT_LOG = {}          # 验收用：记录画面上出现过的全部文字 -> (字体, 最小字号)
LOG_TEXT = False


def _log(text, key, size):
    if LOG_TEXT and text:
        prev = TEXT_LOG.get(text)
        TEXT_LOG[text] = (key, min(size, prev[1]) if prev else size)


@functools.lru_cache(maxsize=None)
def font(key):
    cfg = load_config()["fonts"][key]
    f = Font(asset(cfg["file"]), cfg.get("family"))
    if key == "brush":
        f.fallback = font("serif")   # 书法字体缺少箭头等符号时，用宋体补字（不产生缺字方框）
    return f


def _emit(ctx, ops, x, y, s):
    for op in ops:
        k = op[0]
        if k == "M":
            ctx.move_to(x + op[1][0] * s, y - op[1][1] * s)
        elif k == "L":
            ctx.line_to(x + op[1][0] * s, y - op[1][1] * s)
        elif k == "C":
            (a, b), (c, d), (e, f) = op[1], op[2], op[3]
            ctx.curve_to(x + a * s, y - b * s, x + c * s, y - d * s, x + e * s, y - f * s)
        else:
            ctx.close_path()


def text_path(ctx, fnt, text, x, y, size, tracking=0.0):
    """在 (x, 基线 y) 处追加文字路径；返回宽度。"""
    s = size / fnt.upm
    cx = x
    for ch in text:
        ops, adv = fnt.glyph(ch)
        _emit(ctx, ops, cx, y, s)
        cx += adv * s + tracking * size
    return cx - x - (tracking * size if text else 0)


def draw_text(ctx, text, x, y, size, rgba, key="sans", align="left", valign="baseline",
              tracking=0.0, stroke=None):
    """绘制一行文字。align: left/center/right；valign: baseline/middle/top。
    stroke=(rgba, width) 时先描边（用于字幕描边）。"""
    fnt = font(key)
    _log(text, key, size)
    w = fnt.width(text, size, tracking)
    if align == "center":
        x -= w / 2
    elif align == "right":
        x -= w
    if valign == "middle":
        y += size * 0.36
    elif valign == "top":
        y += size * 0.88
    ctx.new_path()
    text_path(ctx, fnt, text, x, y, size, tracking)
    if stroke:
        ctx.set_source_rgba(*stroke[0])
        ctx.set_line_width(stroke[1])
        ctx.set_line_join(1)
        ctx.stroke_preserve()
    ctx.set_source_rgba(*rgba)
    ctx.fill()
    ctx.new_path()
    return w


def draw_vertical(ctx, text, x, y, size, rgba, key="serif", spacing=1.08):
    """竖排：字中心沿 x，自 y（首字顶）向下排列。"""
    fnt = font(key)
    _log(text, key + ":vertical", size)
    cy = y
    for ch in text:
        w = fnt.advance(ch, size)
        ctx.new_path()
        text_path(ctx, fnt, ch, x - w / 2, cy + size * 0.88, size)
        ctx.set_source_rgba(*rgba)
        ctx.fill()
        cy += size * spacing
    ctx.new_path()
    return cy - y


def text_width(text, size, key="sans", tracking=0.0):
    return font(key).width(text, size, tracking)
