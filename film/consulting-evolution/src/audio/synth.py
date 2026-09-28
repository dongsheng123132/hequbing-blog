"""合成乐器（全部为程序合成的近似音色，不是骨笛、编钟、琵琶等真实乐器录音）。

所有函数返回单声道 float64 数组，采样率 48 kHz，含自然释音尾巴。
随机成分全部使用固定种子，渲染结果可复现。
"""
import functools
import math

import numpy as np
from scipy.signal import butter, lfilter, sosfilt

SR = 48000


def midi_hz(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def _rng(*k):
    h = 1469598103934665603
    for x in k:
        for ch in str(x):
            h = ((h ^ ord(ch)) * 1099511628211) & 0xFFFFFFFFFFFFFFFF
    return np.random.default_rng(h & 0xFFFFFFFF)


def env_adsr(n, a, d, s, r_n, sr=SR):
    """n: 持续段采样数；r_n: 释音采样数。返回长度 n + r_n。"""
    a_n = max(1, int(a * sr))
    d_n = max(1, int(d * sr))
    e = np.ones(n + r_n) * s
    e[:min(a_n, n)] = np.linspace(0, 1, a_n)[:min(a_n, n)]
    if a_n < n:
        seg = min(d_n, n - a_n)
        e[a_n:a_n + seg] = np.linspace(1, s, d_n)[:seg]
    held = e[n - 1] if n > 0 else 0
    e[n:] = held * np.exp(-np.linspace(0, 6.0, r_n)) if r_n > 0 else e[n:]
    return e


def _bp(x, lo, hi, order=2):
    sos = butter(order, [lo / (SR / 2), min(0.99, hi / (SR / 2))], btype="band", output="sos")
    return sosfilt(sos, x)


def _lp(x, f, order=2):
    sos = butter(order, min(0.99, f / (SR / 2)), btype="low", output="sos")
    return sosfilt(sos, x)


def _hp(x, f, order=2):
    sos = butter(order, f / (SR / 2), btype="high", output="sos")
    return sosfilt(sos, x)


@functools.lru_cache(maxsize=512)
def _table(kind, nharm):
    L = 4096
    ph = np.arange(L) / L * 2 * np.pi
    out = np.zeros(L)
    for k in range(1, nharm + 1):
        if kind == "saw":
            out += np.sin(k * ph) / k
        elif kind == "square" and k % 2 == 1:
            out += np.sin(k * ph) / k
    return out / np.max(np.abs(out))


def _wt(kind, f_inst):
    nharm = max(1, int(min(40, 15000 / max(f_inst.max(), 1))))
    tab = _table(kind, nharm)
    L = len(tab)
    phase = np.cumsum(f_inst) / SR
    idx = (phase % 1.0) * L
    i0 = idx.astype(np.int64) % L
    fr = idx - np.floor(idx)
    return tab[i0] * (1 - fr) + tab[(i0 + 1) % L] * fr


def _vib(n, f, rate=5.2, depth=0.004, delay=0.25, seed=0):
    t = np.arange(n) / SR
    ramp = np.clip((t - delay) / 0.4, 0, 1)
    r = _rng("vib", seed, f)
    return f * (1 + depth * ramp * np.sin(2 * np.pi * rate * t + r.uniform(0, 6.28)))


# ---------------- 旋律乐器 ----------------

def flute(m, dur, vel=0.8, seed=0):
    """笛类近似：正弦基音 + 弱谐波 + 气息噪声 + 起音气声，延迟颤音。"""
    f = midi_hz(m)
    n = int(dur * SR)
    r_n = int(0.22 * SR)
    N = n + r_n
    fi = _vib(N, f, depth=0.0045, seed=seed)
    ph = 2 * np.pi * np.cumsum(fi) / SR
    tone = np.sin(ph) + 0.16 * np.sin(2 * ph) + 0.07 * np.sin(3 * ph) + 0.025 * np.sin(5 * ph)
    rng = _rng("flute", m, dur, seed)
    noise = rng.standard_normal(N)
    breath = _bp(noise, f * 1.5, min(9000, f * 6)) * 0.22
    chiff = _bp(noise, 1500, 6000) * np.exp(-np.arange(N) / (0.035 * SR)) * 0.5
    e = env_adsr(n, 0.07, 0.15, 0.85, r_n)
    swell = 1 + 0.08 * np.sin(np.linspace(0, np.pi, N))
    return (tone * e * swell + breath * e + chiff) * vel * 0.5


def bell(m, dur=4.0, vel=0.8, seed=0):
    """钟磬近似：非谐分音，低分音长衰减、高分音短衰减，含击打瞬态。"""
    f = midi_hz(m)
    N = int(dur * SR)
    t = np.arange(N) / SR
    parts = [(0.5, 0.35, 3.5), (1.0, 1.0, 2.8), (1.183, 0.45, 2.2), (1.506, 0.3, 1.6), (2.0, 0.35, 1.2),
             (2.74, 0.22, 0.8), (3.76, 0.12, 0.5), (5.4, 0.08, 0.3)]
    out = np.zeros(N)
    rng = _rng("bell", m, seed)
    for ratio, amp, tau in parts:
        fr = f * ratio
        if fr > 18000:
            continue
        beat = 1 + 0.0015 * rng.uniform(-1, 1)
        p0 = rng.uniform(0, 2 * np.pi)
        out += amp * np.exp(-t / tau) * (np.sin(2 * np.pi * fr * t + p0) + 0.5 * np.sin(2 * np.pi * fr * beat * t + p0 + 1.0))
    strike = _bp(rng.standard_normal(N), 800, 7000) * np.exp(-t / 0.006) * 0.6
    att = np.clip(t / 0.002, 0, 1)
    return (out * att / 2.2 + strike * 0.6) * vel * 0.36


def pluck(m, dur=1.5, vel=0.8, bright=0.6, seed=0):
    """弹拨近似（琵琶/古筝感）：加法合成，高分音衰减更快，轻微非谐。"""
    f = midi_hz(m)
    N = int(max(dur, 0.3) * SR) + int(0.4 * SR)
    t = np.arange(N) / SR
    out = np.zeros(N)
    B = 0.0004
    phr = _rng("pluckphase", m, seed).uniform(0, 2 * np.pi, 28)
    for k in range(1, 28):
        fk = f * k * math.sqrt(1 + B * k * k)
        if fk > 16000:
            break
        amp = (1 / k) * (bright ** (0.35 * (k - 1))) * (1.0 if k % 5 else 0.6)
        tau = 1.6 / (1 + 0.35 * k) * (0.9 if f > 500 else 1.0)
        out += amp * np.exp(-t / tau) * np.sin(2 * np.pi * fk * t + phr[k])
    rng = _rng("pluck", m, seed)
    click = _hp(rng.standard_normal(N), 2000) * np.exp(-t / 0.003) * 0.25
    att = np.clip(t / 0.0015, 0, 1)
    damp = np.ones(N)
    stop = int(dur * SR)
    if stop < N:
        damp[stop:] = np.exp(-np.arange(N - stop) / (0.08 * SR))
    return (out * att * damp + click) * vel * 0.35


def strings(m, dur, vel=0.6, attack=0.35, release=0.6, seed=0, bright=3200):
    """弦乐群近似：三支微失谐锯齿波 + 延迟颤音 + 低通。"""
    f = midi_hz(m)
    n = int(dur * SR)
    r_n = int(release * SR)
    N = n + r_n
    out = np.zeros(N)
    for i, cents in enumerate((-7, 0, 6)):
        fi = _vib(N, f * 2 ** (cents / 1200), rate=5.0 + 0.4 * i, depth=0.0035, delay=0.3, seed=seed * 7 + i)
        out += _wt("saw", fi)
    out = _lp(out, min(bright, f * 8), order=2)
    e = env_adsr(n, attack, 0.3, 0.9, r_n)
    return out * e * vel * 0.12


def brass(m, dur, vel=0.6, seed=0):
    """铜管近似：锯齿波，起音时更亮，随后收暗；轻微音高下滑进入。"""
    f = midi_hz(m)
    n = int(dur * SR)
    r_n = int(0.35 * SR)
    N = n + r_n
    t = np.arange(N) / SR
    scoop = 1 - 0.012 * np.exp(-t / 0.05)
    fi = _vib(N, f, rate=4.8, depth=0.002, delay=0.4, seed=seed) * scoop
    raw = _wt("saw", fi)
    bright = _lp(raw, min(6000, f * 10))
    dark = _lp(raw, min(1600, f * 4))
    k = np.exp(-t / 0.18)
    out = bright * k + dark * (1 - k)
    e = env_adsr(n, 0.06, 0.2, 0.85, r_n)
    return out * e * vel * 0.18


def pulse(m, dur, vel=0.6, decay=0.18, seed=0):
    """数字化章节的短促脉冲音：方波 + 低通 + 快衰减。"""
    f = midi_hz(m)
    N = int(max(dur, decay * 3) * SR)
    t = np.arange(N) / SR
    raw = _wt("square", np.full(N, f))
    out = _lp(raw, min(5000, f * 6))
    return out * np.exp(-t / decay) * np.clip(t / 0.002, 0, 1) * vel * 0.16


def sub_bass(m, dur, vel=0.6):
    f = midi_hz(m)
    n = int(dur * SR)
    r_n = int(0.12 * SR)
    t = np.arange(n + r_n) / SR
    x = np.sin(2 * np.pi * f * t) + 0.18 * np.sin(4 * np.pi * f * t)
    return x * env_adsr(n, 0.01, 0.2, 0.8, r_n) * vel * 0.45


def pad(m, dur, vel=0.5, seed=0):
    """持续铺底（弦乐泛音的柔和版本）。"""
    return strings(m, dur, vel, attack=1.2, release=1.4, seed=seed, bright=1800)


# ---------------- 打击 ----------------

def drum_low(vel=0.8, f0=110, f1=46, decay=0.9, seed=0):
    """低鼓（堂鼓 / 大鼓感）。"""
    N = int((decay * 3) * SR)
    t = np.arange(N) / SR
    fi = f1 + (f0 - f1) * np.exp(-t / 0.05)
    ph = 2 * np.pi * np.cumsum(fi) / SR
    body = np.sin(ph) * np.exp(-t / decay)
    body += 0.3 * np.sin(1.6 * ph) * np.exp(-t / (decay * 0.4))
    rng = _rng("drum", seed, vel)
    skin = _lp(rng.standard_normal(N), 900) * np.exp(-t / 0.02) * 0.5
    return (body + skin) * np.clip(t / 0.0008, 0, 1) * vel * 0.8


def timpani(m, vel=0.7, seed=0):
    f = midi_hz(m)
    N = int(2.5 * SR)
    t = np.arange(N) / SR
    out = sum(a * np.sin(2 * np.pi * f * r * t) * np.exp(-t / d)
              for r, a, d in ((1.0, 1.0, 0.9), (1.5, 0.5, 0.6), (1.99, 0.3, 0.4), (2.44, 0.2, 0.3)))
    rng = _rng("timp", m, seed)
    out += _lp(rng.standard_normal(N), 1200) * np.exp(-t / 0.03) * 0.5
    return out * np.clip(t / 0.001, 0, 1) * vel * 0.4


def kick(vel=0.7):
    N = int(0.5 * SR)
    t = np.arange(N) / SR
    fi = 45 + 110 * np.exp(-t / 0.03)
    x = np.sin(2 * np.pi * np.cumsum(fi) / SR) * np.exp(-t / 0.22)
    x += _hp(_rng("kick").standard_normal(N), 3000) * np.exp(-t / 0.002) * 0.2
    return x * vel * 0.7


def hat(vel=0.4, decay=0.035, seed=0):
    N = int(0.25 * SR)
    t = np.arange(N) / SR
    x = _hp(_rng("hat", seed).standard_normal(N), 7000) * np.exp(-t / decay)
    return x * vel * 0.25


def clap(vel=0.5, seed=0):
    N = int(0.4 * SR)
    t = np.arange(N) / SR
    rng = _rng("clap", seed)
    x = _bp(rng.standard_normal(N), 900, 3500) * np.exp(-t / 0.09)
    x += np.sin(2 * np.pi * 190 * t) * np.exp(-t / 0.05) * 0.4
    return x * vel * 0.35


def metal_tick(vel=0.3, seed=0):
    N = int(0.12 * SR)
    t = np.arange(N) / SR
    x = sum(np.sin(2 * np.pi * f * t) * np.exp(-t / d) for f, d in ((2330, 0.03), (3710, 0.02), (5120, 0.012)))
    return x * np.clip(t / 0.0005, 0, 1) * vel * 0.2


def wood(vel=0.5, f=900, seed=0):
    N = int(0.2 * SR)
    t = np.arange(N) / SR
    x = np.sin(2 * np.pi * f * t) * np.exp(-t / 0.035) + 0.5 * np.sin(2 * np.pi * f * 2.71 * t) * np.exp(-t / 0.015)
    x += _hp(_rng("wood", seed, f).standard_normal(N), 2500) * np.exp(-t / 0.002) * 0.3
    return x * np.clip(t / 0.0005, 0, 1) * vel * 0.45


# ---------------- 音效素材 ----------------

def brush(dur, vel=0.4, seed=0):
    """毛笔笔触：带通噪声，起笔稍重、行笔摩擦、收笔轻提。"""
    N = max(int(dur * SR), 400)
    t = np.linspace(0, 1, N)
    rng = _rng("brush", seed)
    x = _bp(rng.standard_normal(N), 1800, 7500)
    grain = 1 + 0.4 * _lp(rng.standard_normal(N), 30) * 3
    e = (np.clip(t / 0.08, 0, 1) * (1 - 0.4 * t) * np.clip((1 - t) / 0.15, 0, 1)) * grain
    return x * np.clip(e, 0, 2) * vel * 0.12


def swoosh(dur=0.6, vel=0.4, up=True, seed=0):
    N = int(dur * SR)
    t = np.linspace(0, 1, N)
    rng = _rng("swoosh", seed)
    x = rng.standard_normal(N)
    lo = _bp(x, 400, 2500)
    hi = _bp(x, 2500, 9000)
    k = t if up else 1 - t
    e = np.sin(np.pi * t) ** 2
    return (lo * (1 - k) + hi * k) * e * vel * 0.18


def paper(dur=0.35, vel=0.4, seed=0):
    N = int(dur * SR)
    t = np.arange(N) / SR
    rng = _rng("paper", seed)
    x = _bp(rng.standard_normal(N), 1200, 9000)
    crackle = (rng.random(N) > 0.992) * rng.uniform(-1, 1, N) * 2
    e = np.exp(-t / (dur * 0.35)) * np.clip(t / 0.01, 0, 1)
    return (x + crackle) * e * vel * 0.22


def blip(f=1500, dur=0.07, vel=0.3):
    N = int(dur * SR)
    t = np.arange(N) / SR
    return np.sin(2 * np.pi * f * t) * np.exp(-t / (dur * 0.3)) * np.clip(t / 0.002, 0, 1) * vel * 0.3


def seal_impact(vel=0.7, seed=0):
    """印章落下：低频冲击 + 木质压印 + 纸面摩擦。瞬态峰值在第 0～3 ms 内。"""
    N = int(2.0 * SR)
    t = np.arange(N) / SR
    rng = _rng("seal", seed)
    thump = np.sin(2 * np.pi * np.cumsum(38 + 70 * np.exp(-t / 0.04)) / SR) * np.exp(-t / (0.35 + 0.5 * vel))
    knock = _bp(rng.standard_normal(N), 180, 1200) * np.exp(-t / 0.045)
    press = _bp(rng.standard_normal(N), 1500, 6000) * np.exp(-t / 0.018) * 0.6
    att = np.clip(t / 0.0006, 0, 1)
    return (thump * 1.0 + knock * 0.55 + press) * att * vel * 0.9


def tension(dur=1.2, vel=0.4):
    N = int(dur * SR)
    t = np.arange(N) / SR
    x = np.sin(2 * np.pi * 73.4 * t) + 0.6 * np.sin(2 * np.pi * 77.8 * t)
    return x * np.exp(-t / (dur * 0.5)) * np.clip(t / 0.01, 0, 1) * vel * 0.3


def reverb_ir(seconds=2.4, seed=0, damp=0.55, predelay=0.02):
    """合成立体声混响脉冲响应：早期反射 + 指数衰减、逐渐变暗的噪声尾。"""
    N = int(seconds * SR)
    t = np.arange(N) / SR
    out = []
    for ch in range(2):
        rng = _rng("ir", seed, ch)
        n = rng.standard_normal(N)
        bright = n * np.exp(-t * 6.9 / (seconds * damp))
        dark = _lp(n, 2500) * np.exp(-t * 6.9 / seconds)
        ir = bright * 0.4 + dark
        pre = int(predelay * SR)
        ir = np.concatenate([np.zeros(pre), ir])[:N]
        for k in range(6):
            d = int((0.011 + 0.017 * k + 0.004 * ch) * SR)
            ir[d] += 0.5 * (0.8 ** k) * (1 if (k + ch) % 2 else -1)
        out.append(ir / np.sqrt(np.sum(ir ** 2)))
    return np.stack(out, axis=1)
