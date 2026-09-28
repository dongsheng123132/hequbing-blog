"""镜头上下文与注册表。场景代码一律用“章内拍”描述时间，与分镜事件一致。"""
from .. import timeline as T
from ..visuals.core import clamp, ease_in_out, ease_out, prog

REGISTRY = {}


def scene(shot_id):
    def deco(fn):
        REGISTRY[shot_id] = fn
        return fn
    return deco


def bframe(ch_id, beat):
    """章内（可为小数）拍位置 → 全片帧号（四舍五入到帧）。画面与音效都用它，保证同帧。"""
    return T.chapter_start_frame(ch_id) + round(float(beat) * T.CHAPTERS[ch_id].frames_per_beat)


class S:
    def __init__(self, ctx, st, shot, frame, layout="h"):
        self.ctx = ctx
        self.st = st
        self.shot = shot
        self.f = frame
        self.ch = shot.chapter
        fpb = T.CHAPTERS[self.ch].frames_per_beat
        self.bc = (frame - T.chapter_start_frame(self.ch)) / fpb   # 章内拍（浮点，仅用于插值）
        self.b = self.bc - shot.b0
        self.layout = layout

    def p(self, b0, b1, ease=None):
        v = prog(self.bc, b0, b1)
        return ease(v) if ease else v

    def pe(self, b0, b1):
        return ease_in_out(prog(self.bc, b0, b1))

    def po(self, b0, b1):
        return ease_out(prog(self.bc, b0, b1))

    def ev(self, name):
        return self.shot.events[name]

    def since(self, b):
        return self.bc - b

    def exit(self, beats=0.75):
        """镜头最后若干拍的退出系数 1→0。"""
        return 1.0 - ease_in_out(prog(self.bc, self.shot.b1 - beats, self.shot.b1))

    def enter(self, beats=0.5):
        return ease_out(prog(self.bc, self.shot.b0, self.shot.b0 + beats))
