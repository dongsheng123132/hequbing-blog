"""章节风格：A 染色宣纸白线 / B 黑底金绘。朱红为全片唯一不变的标识色。"""
from dataclasses import dataclass

from .. import timeline as T
from .core import rgba

ACCENT = {0: "rice_white", 1: "bronze_green", 2: "rice_white", 3: "steel_grey",
          4: "deep_blue", 5: "cold_cyan", 6: "vermilion", 7: "gold"}


@dataclass
class Style:
    kind: str
    bg: str
    line: tuple
    dim: tuple
    faint: tuple
    acc: tuple
    red: tuple
    text: tuple
    kw: tuple          # 书法关键词颜色
    fill: tuple        # 卡片底色（半透明）


def style_for(ch_id):
    ch = T.CHAPTERS[ch_id]
    red = rgba("vermilion")
    if ch.style == "A":
        w = rgba("rice_white")
        return Style("A", ch.paper, w, (*w[:3], 0.55), (*w[:3], 0.22), rgba(ACCENT[ch_id]), red,
                     w, rgba("rice_white"), (0, 0, 0, 0.16))
    g = rgba("gold")
    return Style("B", ch.paper, g, rgba("gold_dim"), (*rgba("gold_dim")[:3], 0.4), rgba(ACCENT[ch_id]), red,
                 rgba("rice_white"), g, (0.05, 0.045, 0.035, 0.7))
