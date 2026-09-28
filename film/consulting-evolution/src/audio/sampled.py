"""采样乐器（FluidR3_GM 音色库，MIT 许可，系统包 fluid-soundfont-gm），经 fluidsynth 逐音渲染。

与 synth.py 同名同参数的函数，score / sfx 可以整体切换。每个音单独渲染（渲染前清空通道），
关闭 fluidsynth 自带混响与合唱（统一由 mix.py 的混响处理），结果逐次确定。
这些是真实乐器的采样录音（西洋管弦 + 日本筝、太鼓等 GM 标准音色），不是中国古乐器原声；
“笛 / 筝 / 钟 / 鼓”的东方感来自旋律与编配，片中说明如实标注。
"""
import functools
import math

import numpy as np

from . import synth as SYN

SR = 48000
SF2 = "/usr/share/sounds/sf2/FluidR3_GM.sf2"

# GM 音色号（0 起）
GM = dict(flute=73, bell=14, koto=107, harp=46, strings=48, strings_slow=49, horn=60, timpani=47, taiko=116,
          woodblock=115, contrabass=43)
DRUM_BANK = 128
KIT = dict(kick=36, clap=39, hat=42)

_FS = None
_SFID = None


def _synth():
    global _FS, _SFID
    if _FS is None:
        import fluidsynth
        _FS = fluidsynth.Synth(gain=0.6, samplerate=SR, **{"synth.reverb.active": 0, "synth.chorus.active": 0,
                                                            "synth.polyphony": 256, "synth.cpu-cores": 1})
        _SFID = _FS.sfload(SF2)
        if _SFID < 0:
            raise RuntimeError(f"无法加载音色库 {SF2}（apt-get install fluid-soundfont-gm）")
    return _FS


@functools.lru_cache(maxsize=4096)
def _render(program, key, vel127, hold_n, tail_n, bank=0):
    fs = _synth()
    ch = 9 if bank == DRUM_BANK else 0
    fs.program_select(ch, _SFID, bank, program)
    fs.all_sounds_off(ch)
    fs.get_samples(1024)                      # 冲掉残留
    fs.noteon(ch, int(key), int(vel127))
    a = fs.get_samples(max(1, hold_n))
    fs.noteoff(ch, int(key))
    b = fs.get_samples(max(1, tail_n))
    fs.all_sounds_off(ch)
    x = np.concatenate([a, b]).astype(np.float64).reshape(-1, 2).mean(axis=1) / 32768.0
    return x


def _v(vel):
    return int(np.clip(round(24 + vel * 100), 1, 127))


def _note(program, m, dur, vel, tail=1.2, bank=0):
    hold = int(max(0.05, dur) * SR)
    x = _render(program, int(round(m)), _v(vel), hold, int(tail * SR), bank)
    return x.copy()


# 校准：让每种采样乐器在参考音上的响度与原合成版一致，保持已审过的混音平衡
@functools.lru_cache(maxsize=None)
def _cal(name):
    ref = {"flute": lambda f: f(69, 1.0, 0.6), "bell": lambda f: f(74, 2.0, 0.6),
           "pluck": lambda f: f(62, 1.0, 0.6), "strings": lambda f: f(62, 2.0, 0.6),
           "pad": lambda f: f(50, 3.0, 0.5), "brass": lambda f: f(57, 1.5, 0.6),
           "timpani": lambda f: f(38, 0.7), "drum_low": lambda f: f(0.6),
           "wood": lambda f: f(0.5, 900), "sub_bass": lambda f: f(38, 1.5, 0.6),
           "kick": lambda f: f(0.6), "hat": lambda f: f(0.4), "clap": lambda f: f(0.5)}[name]

    def rms(x):
        x = x[: int(1.0 * SR)]
        return float(np.sqrt(np.mean(x ** 2)) + 1e-12)

    old, new = ref(getattr(SYN, name)), ref(globals()["_raw_" + name])
    by_loudness = rms(old) / rms(new)
    by_peak = float(np.max(np.abs(old))) / float(np.max(np.abs(new)) + 1e-12)
    # 按响度对齐，但峰值不超过原合成版（真实采样的起音更尖，否则会逼迫限幅器大量工作）
    return min(by_loudness, by_peak)


# ── 原始采样渲染 ──
def _raw_flute(m, dur, vel=0.8, seed=0):
    return _note(GM["flute"], m, dur, vel, tail=0.6)


def _raw_bell(m, dur=4.0, vel=0.8, seed=0):
    return _note(GM["bell"], m, min(dur, 1.0), vel, tail=max(1.0, dur))


def _raw_pluck(m, dur=1.5, vel=0.8, bright=0.6, seed=0):
    prog = GM["koto"] if m >= 50 else GM["harp"]
    return _note(prog, m, dur, min(1.0, vel * (0.8 + 0.4 * bright)), tail=0.8)


def _raw_strings(m, dur, vel=0.6, attack=0.35, release=0.6, seed=0, bright=3200):
    return _note(GM["strings"], m, dur, vel, tail=max(0.6, release))


def _raw_pad(m, dur, vel=0.5, seed=0):
    return _note(GM["strings_slow"], m, dur, vel, tail=1.4)


def _raw_brass(m, dur, vel=0.6, seed=0):
    return _note(GM["horn"], m, dur, vel, tail=0.6)


def _raw_timpani(m, vel=0.7, seed=0):
    return _note(GM["timpani"], m, 1.2, vel, tail=1.5)


def _raw_drum_low(vel=0.8, f0=110, f1=46, decay=0.9, seed=0):
    key = 38 if f1 < 60 else 45
    return _note(GM["taiko"], key, 0.4, vel, tail=max(0.8, decay * 1.5))


def _raw_wood(vel=0.5, f=900, seed=0):
    key = int(np.clip(60 + 12 * math.log2(max(200.0, f) / 900.0), 48, 96))
    return _note(GM["woodblock"], key, 0.08, vel, tail=0.25)


def _raw_sub_bass(m, dur, vel=0.6):
    return _note(GM["contrabass"], m + 12, dur, vel, tail=0.4)   # 低音提琴记谱高八度、实际发音低八度


def _raw_kick(vel=0.7):
    return _note(0, KIT["kick"], 0.2, vel, tail=0.4, bank=DRUM_BANK)


def _raw_hat(vel=0.4, decay=0.035, seed=0):
    return _note(0, KIT["hat"], 0.05, vel, tail=0.2, bank=DRUM_BANK)


def _raw_clap(vel=0.5, seed=0):
    return _note(0, KIT["clap"], 0.1, vel, tail=0.4, bank=DRUM_BANK)


def _wrap(name):
    raw = globals()["_raw_" + name]

    def f(*a, **k):
        return raw(*a, **k) * _cal(name)
    f.__name__ = name
    return f


flute = _wrap("flute")
bell = _wrap("bell")
pluck = _wrap("pluck")
strings = _wrap("strings")
pad = _wrap("pad")
brass = _wrap("brass")
timpani = _wrap("timpani")
drum_low = _wrap("drum_low")
wood = _wrap("wood")
sub_bass = _wrap("sub_bass")
kick = _wrap("kick")
hat = _wrap("hat")
clap = _wrap("clap")

# 数字化章节的电子脉冲、机械滴答、音效素材与混响仍用程序合成（有意为之的电子 / 抽象声音）
pulse = SYN.pulse
metal_tick = SYN.metal_tick
brush = SYN.brush
swoosh = SYN.swoosh
paper = SYN.paper
blip = SYN.blip
seal_impact = SYN.seal_impact
tension = SYN.tension
reverb_ir = SYN.reverb_ir
midi_hz = SYN.midi_hz
