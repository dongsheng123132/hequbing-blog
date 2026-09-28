"""Original score for 《一线破局》 — synthesised from scratch (no samples, no
third-party audio). 96 BPM, 4/4, 6 bars, D major pentatonic (D E F# A B).

Harmony:  | D5 (observe) | G add9 (the turn) | Bm7 (into business) |
          | A sus4 -> A (the loop, fullest) | D add9 (brand) ........ |
Three accents only: 3.125 s path opens (wood knock + first bell),
7.500 s loop closes, 10.000 s brand (sonic logo D-A-F#).

    python audio.py      -> build/score_raw.wav, out/score.wav (48 kHz, 24-bit, stereo)
"""
import os
import subprocess
import sys

import numpy as np
from scipy import signal

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from timeline import SR, DURATION, BEAT, T_KEY_SHIFT, T_LOOP, T_BRAND, T_BIZ, T_TURN  # noqa: E402

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
N = int(round(DURATION * SR))
RNG = np.random.default_rng(96)


def hz(m):
    return 440.0 * 2 ** ((m - 69) / 12.0)


D1, G1, A1, B1 = 26, 31, 33, 35
D2, E2, Fs2, G2, A2, B2 = 38, 40, 42, 43, 45, 47
Cs3, D3, E3, Fs3, A3, B3 = 49, 50, 52, 54, 57, 59
D4, E4, Fs4, A4, B4 = 62, 64, 66, 69, 71
D5, E5, Fs5, A5 = 74, 76, 78, 81


def b(n):
    return n * BEAT


# ------------------------------------------------------------------ buses
class Bus:
    def __init__(self):
        self.x = np.zeros((2, N), np.float64)

    def add(self, sig, t0, gain=1.0, pan=0.0, tail=True):
        """sig: mono (n,) or stereo (2, n). pan -1..1 equal-power.
        tail: damp the last 80 ms so no note is ever cut off (no clicks)."""
        i0 = int(round(t0 * SR))
        if tail:
            sig = np.array(sig, dtype=np.float64, copy=True)
            nf = min(int(0.08 * SR), sig.shape[-1] // 4)
            if nf > 1:
                sig[..., -nf:] *= np.cos(np.linspace(0, np.pi / 2, nf)) ** 2
        if sig.ndim == 1:
            a = (pan + 1) * np.pi / 4
            sig = np.stack([sig * np.cos(a), sig * np.sin(a)]) * np.sqrt(2)
        if i0 < 0:
            sig = sig[:, -i0:]
            i0 = 0
        n = min(sig.shape[1], N - i0)
        if n > 0:
            self.x[:, i0:i0 + n] += sig[:, :n] * gain


def tt(dur):
    return np.arange(int(dur * SR)) / SR


def env_ad(n, a, d_tau, sus=0.0):
    t = np.arange(n) / SR
    e = np.minimum(1.0, t / max(a, 1e-4)) ** 1.5
    return e * (sus + (1 - sus) * np.exp(-np.maximum(t - a, 0) / d_tau))


def env_asr(n, a, r, curve=2.0):
    t = np.arange(n) / SR
    dur = n / SR
    up = np.clip(t / a, 0, 1) ** curve
    down = np.clip((dur - t) / r, 0, 1) ** 1.3
    return up * down


def lp(x, fc, order=2):
    sos = signal.butter(order, min(fc, SR * 0.45), 'low', fs=SR, output='sos')
    return signal.sosfilt(sos, x, axis=-1)


def hp(x, fc, order=2):
    sos = signal.butter(order, fc, 'high', fs=SR, output='sos')
    return signal.sosfilt(sos, x, axis=-1)


def bp(x, f1, f2, order=2):
    sos = signal.butter(order, [f1, min(f2, SR * 0.45)], 'band', fs=SR, output='sos')
    return signal.sosfilt(sos, x, axis=-1)


def tv_lp(x, cut, block=256):
    """Time-varying 2-pole lowpass; cut: array of cutoffs per sample."""
    y = np.zeros_like(x)
    zi = None
    for i in range(0, len(x), block):
        fc = float(np.clip(cut[min(i + block // 2, len(cut) - 1)], 20, SR * 0.45))
        sos = signal.butter(2, fc, 'low', fs=SR, output='sos')
        if zi is None:
            zi = np.zeros((sos.shape[0], 2))
        y[i:i + block], zi = signal.sosfilt(sos, x[i:i + block], zi=zi)
    return y


def polyblep_saw(freq, n, phase0=0.0):
    f = np.broadcast_to(np.asarray(freq, float), (n,))
    dt = f / SR
    ph = (phase0 + np.cumsum(dt)) % 1.0
    s = 2 * ph - 1
    # polyBLEP correction
    m1 = ph < dt
    t1 = ph[m1] / dt[m1]
    s[m1] -= t1 + t1 - t1 * t1 - 1
    m2 = ph > 1 - dt
    t2 = (ph[m2] - 1) / dt[m2]
    s[m2] -= t2 * t2 + t2 + t2 + 1
    return s


# ------------------------------------------------------------------ instruments
def fm_bell(m, dur=5.5, bright=1.0, decay=None):
    """Warm FM bell: 1:3.5 bell pair + 1:1 body pair."""
    f = hz(m)
    n = int(dur * SR)
    t = np.arange(n) / SR
    dec = decay if decay else (2.4 if f < 700 else 1.7)
    idx = 2.1 * bright * np.exp(-t / 0.22) + 0.25
    out = []
    for det in (-1.6, 1.6):
        fc = f * 2 ** (det / 1200)
        mod = np.sin(2 * np.pi * fc * 3.5 * t) * idx
        a = np.sin(2 * np.pi * fc * t + mod)
        body = np.sin(2 * np.pi * fc * t + 0.8 * np.exp(-t / 0.5) * np.sin(2 * np.pi * fc * t))
        s = 0.62 * a + 0.38 * body
        s *= np.minimum(1, t / 0.002) * np.exp(-t / dec)
        out.append(s)
    return lp(np.array(out), 7500)


def mallet(m, dur=1.6):
    """Soft wooden mallet (modal): module connections in bar 3."""
    f = hz(m)
    t = tt(dur)
    parts = [(1.0, 1.0, 0.85), (3.93, 0.22, 0.20), (9.2, 0.06, 0.06)]
    s = sum(a * np.sin(2 * np.pi * f * r * t) * np.exp(-t / d) for r, a, d in parts)
    s *= np.minimum(1, t / 0.003)
    click = lp(RNG.standard_normal(len(t)), 3500) * np.exp(-t / 0.004) * 0.08
    return lp(s + click, 6500)


def felt_piano(m, dur=6.0, vel=0.7):
    f0 = hz(m)
    t = tt(dur)
    B = 0.00035
    out = []
    for det in (-0.7, 0.7):
        s = np.zeros(len(t))
        for k in range(1, 18):
            fk = k * f0 * np.sqrt(1 + B * k * k) * 2 ** (det / 1200)
            if fk > 9000:
                break
            amp = (1 / k ** 1.25) * np.exp(-k * (0.30 - 0.12 * vel))
            tau = (3.4 if f0 < 200 else 2.4) / (1 + 0.45 * (k - 1))
            s += amp * np.sin(2 * np.pi * fk * t + RNG.uniform(0, 6.28)) * np.exp(-t / tau)
        s *= np.minimum(1, t / 0.007)
        out.append(s)
    out = np.array(out)
    thump = lp(RNG.standard_normal(len(t)), 900) * np.exp(-t / 0.018) * 0.05
    return lp(out + thump, 2600 + 2500 * vel)


def ensemble(notes, dur, cut, attack=0.6, release=0.8, width=0.8, voices=5, spread_c=9.0):
    """Detuned saw ensemble through a moving lowpass: the low strings / pad."""
    n = int(dur * SR)
    L = np.zeros(n)
    R = np.zeros(n)
    for j, m in enumerate(notes):
        for v in range(voices):
            c = spread_c * (v / (voices - 1) * 2 - 1)
            vib = 1 + 0.0009 * np.sin(2 * np.pi * (4.6 + 0.37 * v) * np.arange(n) / SR + v)
            s = polyblep_saw(hz(m) * 2 ** (c / 1200) * vib, n, RNG.uniform())
            pan = width * (v / (voices - 1) * 2 - 1) * (1 if j % 2 else -1) * 0.8
            a = (pan + 1) * np.pi / 4
            L += s * np.cos(a)
            R += s * np.sin(a)
    cutv = np.broadcast_to(cut, (n,)) if np.ndim(cut) == 0 else cut
    L = tv_lp(L, cutv)
    R = tv_lp(R, cutv)
    e = env_asr(n, attack, release)
    return np.array([L, R]) * e / (len(notes) * voices) * 2.2


def bass_pluck(m, dur=0.30, bright=1.0):
    n = int(dur * SR)
    t = np.arange(n) / SR
    s = polyblep_saw(hz(m), n) * 0.6 + np.sin(2 * np.pi * hz(m) * t) * 0.8
    cut = 110 + 560 * bright * np.exp(-t / 0.05)
    s = tv_lp(s, cut, block=64)
    return s * env_ad(n, 0.004, 0.13)


def sub(m, dur, a=0.05, r=0.4):
    n = int(dur * SR)
    t = np.arange(n) / SR
    return np.sin(2 * np.pi * hz(m) * t) * env_asr(n, a, r)


def kick(level=1.0):
    t = tt(0.5)
    f = 46 + 70 * np.exp(-t / 0.035)
    ph = 2 * np.pi * np.cumsum(f) / SR
    s = np.sin(ph) * np.exp(-t / 0.16)
    click = bp(RNG.standard_normal(len(t)), 1200, 4000) * np.exp(-t / 0.003) * 0.12
    return (s + click) * level


def tick():
    t = tt(0.06)
    s = hp(RNG.standard_normal(len(t)), 6500) * np.exp(-t / 0.012)
    return bp(s, 6000, 12000)


def arp_pluck(m):
    t = tt(0.35)
    s = polyblep_saw(hz(m), len(t)) * 0.5 + np.sin(2 * np.pi * hz(m) * t) * 0.5
    s = tv_lp(s, 900 + 2600 * np.exp(-t / 0.03), block=64)
    return s * env_ad(len(t), 0.002, 0.09)


def knock():
    """The path opens: a clean, textured knock — wood on stone."""
    t = tt(1.2)
    f = 540.0
    modes = [(1.0, 1.0, 0.11), (2.61, 0.55, 0.06), (4.38, 0.30, 0.035), (6.9, 0.14, 0.02)]
    s = sum(a * np.sin(2 * np.pi * f * r * t + r) * np.exp(-t / d) for r, a, d in modes)
    body = np.sin(2 * np.pi * 98 * t) * np.exp(-t / 0.09) * 0.7
    click = bp(RNG.standard_normal(len(t)), 2000, 9000) * np.exp(-t / 0.0025) * 0.35
    s = (s + body + click) * np.minimum(1, t / 0.0006)
    return s


def impact():
    """Opening: short, deep, weighty. Not an explosion."""
    t = tt(3.0)
    f = hz(D1) + 34 * np.exp(-t / 0.09)
    ph = 2 * np.pi * np.cumsum(f) / SR
    s = np.sin(ph) * np.exp(-t / 0.75) * np.minimum(1, t / 0.004)
    thump = lp(RNG.standard_normal(len(t)), 140, 4) * np.exp(-t / 0.05) * 1.2
    air = bp(RNG.standard_normal(len(t)), 300, 1800) * np.exp(-t / 0.12) * 0.05
    return s + thump + air


def noise_riser(dur, f0, f1, curve=2.2):
    n = int(dur * SR)
    x = RNG.standard_normal((2, n))
    k = np.linspace(0, 1, n) ** curve
    out = np.zeros_like(x)
    blk = 512
    zi = [None, None]
    for i in range(0, n, blk):
        fc = f0 * (f1 / f0) ** k[min(i + blk // 2, n - 1)]
        sos = signal.butter(2, [fc * 0.7, min(fc * 1.4, SR * 0.45)], 'band', fs=SR, output='sos')
        for c in range(2):
            if zi[c] is None:
                zi[c] = np.zeros((sos.shape[0], 2))
            out[c, i:i + blk], zi[c] = signal.sosfilt(sos, x[c, i:i + blk], zi=zi[c])
    return out * k


# ------------------------------------------------------------------ reverb
def make_ir(rt60=2.6, pre=0.022, dur=3.2, bright=0.5, seed=5):
    rng = np.random.default_rng(seed)
    n = int(dur * SR)
    t = np.arange(n) / SR
    ir = np.zeros((2, n))
    for c in range(2):
        x = rng.standard_normal(n)
        lo = lp(x, 700) * np.exp(-t * 6.91 / rt60)
        mid = bp(x, 700, 3500) * np.exp(-t * 6.91 / (rt60 * 0.75))
        hi = hp(x, 3500) * np.exp(-t * 6.91 / (rt60 * 0.4)) * bright
        ir[c] = lo + mid * 0.8 + hi * 0.5
        # a few early reflections
        for d, g in ((0.011, 0.5), (0.019, 0.35), (0.027, 0.3), (0.041, 0.2)):
            k = int((d + 0.002 * c) * SR)
            ir[c, k] += g
    k = int(pre * SR)
    ir = np.concatenate([np.zeros((2, k)), ir[:, :n - k]], axis=1)
    return ir / np.sqrt((ir ** 2).sum(axis=1, keepdims=True))


def reverb(x, ir, wet):
    y = np.stack([signal.fftconvolve(x[0], ir[0])[:N], signal.fftconvolve(x[1], ir[1])[:N]])
    return y * wet


# ------------------------------------------------------------------ score
def compose():
    dry = Bus()      # direct
    hall = Bus()     # send to the long hall
    room = Bus()     # send to the short room
    low = Bus()      # sub-frequency layer (mono, no reverb)

    # ---------------- bar 1: observe (D5) ---------------------------------
    imp = impact()
    low.add(imp, 0.0, 0.95)
    hall.add(lp(imp, 300), 0.0, 0.25)
    # a low piano + string hit under the impact
    pn = felt_piano(D2, 6.0, 0.55) + felt_piano(D3, 6.0, 0.45) * 0.6
    dry.add(pn, 0.0, 0.30)
    hall.add(pn, 0.0, 0.16)
    # pad D5: slow bloom, stays dark
    cut = np.interp(tt(3.1), [0, 3.1], [380, 820])
    pad1 = ensemble([D2, A2, D3], 3.1, cut, attack=1.1, release=0.7)
    dry.add(pad1, 0.02, 0.34)
    hall.add(pad1, 0.02, 0.22)
    # bass pulse: restrained eighths from beat 2; the dot stops (beat 3), tries again (beat 4)
    for k in range(2, 8):
        tk = b(k / 2)
        vel = [0, 0, 0.55, 0.6, 0.85, 0.55, 0.9, 0.62][k]
        bl = bass_pluck(D2, 0.3, bright=0.6 + 0.5 * vel)
        dry.add(bl, tk, 0.78 * vel)
        dry.add(bass_pluck(D3, 0.22, bright=0.5), tk, 0.16 * vel)      # presence on small speakers
        low.add(sub(D1, 0.22, 0.004, 0.15), tk, 0.34 * vel)
    # reverse swell into the turn
    rv = fm_bell(D5, 1.4, bright=0.6)
    rv_w = reverb(np.pad(rv, ((0, 0), (0, N - rv.shape[1]))), make_ir(3.0, seed=2), 1.0)[:, :int(0.62 * SR)]
    dry.add(rv_w[:, ::-1] * np.linspace(0, 1, rv_w.shape[1]) ** 2, T_TURN - 0.62, 0.55, tail=False)

    # ---------------- bar 2: the turn (G add9) ------------------------------
    low.add(sub(G1, 2.6, 0.02, 0.5), T_TURN, 0.42)
    cut = np.interp(tt(2.9), [0, 0.6, 2.9], [520, 900, 1300])
    pad2 = ensemble([G2, D3, A3, B3], 2.9, cut, attack=0.35, release=0.8)
    dry.add(pad2, T_TURN - 0.05, 0.32)
    hall.add(pad2, T_TURN - 0.05, 0.24)
    for k in range(0, 8):
        tk = T_TURN + b(k / 2)
        vel = 0.62 if k % 2 == 0 else 0.45
        if k == 1:
            vel = 0.3        # breathe before the knock
        dry.add(bass_pluck(G2 - 12, 0.3, bright=0.7), tk, 0.5 * vel)
    piano_turn = felt_piano(G2, 5.0, 0.5) * 0.7 + felt_piano(D3, 5.0, 0.45) * 0.5
    dry.add(piano_turn, T_TURN, 0.22)
    hall.add(piano_turn, T_TURN, 0.12)
    # ACCENT 1 (3.125): the path opens — knock + first bright timbre
    kn = knock()
    dry.add(kn, T_KEY_SHIFT, 0.62, pan=0.05)
    room.add(kn, T_KEY_SHIFT, 0.35)
    hall.add(kn, T_KEY_SHIFT, 0.16)
    for tn, m, g, pan in ((T_KEY_SHIFT, D5, 0.30, -0.15), (T_KEY_SHIFT + b(0.5), A5, 0.20, 0.2),
                          (T_KEY_SHIFT + b(1.0), E5, 0.24, 0.0)):
        bl = fm_bell(m)
        dry.add(bl, tn, g, pan=pan)
        hall.add(bl, tn, g * 0.9)
    # the dive: a tuned air swell (not a whoosh), opening into the ivory
    rs = noise_riser(1.05, 350, 3800)
    dry.add(rs, 3.75, 0.050)
    hall.add(rs, 3.75, 0.040)
    rel = noise_riser(0.7, 4200, 900, curve=0.5) * np.linspace(1, 0, int(0.7 * SR)) ** 2
    hall.add(rel, 4.58, 0.035)

    # ---------------- bar 3: into business (Bm7) ------------------------------
    low.add(sub(B1, 2.55, 0.01, 0.2), T_BIZ, 0.45)
    cut = np.interp(tt(2.7), [0, 2.7], [900, 1600])
    pad3 = ensemble([B2, D3, Fs3, A3], 2.7, cut, attack=0.12, release=0.5)
    dry.add(pad3, T_BIZ - 0.01, 0.30)
    hall.add(pad3, T_BIZ - 0.01, 0.18)
    # low strings ostinato (spiccato eighths) — the working rhythm
    pattern3 = [B1, B1, B2, B1, B1, B2, B1, Fs2]
    for k, m in enumerate(pattern3):
        s = ensemble([m + 12], 0.24, 1100, attack=0.008, release=0.16, voices=4, spread_c=7)
        dry.add(s, T_BIZ + b(k / 2), 0.62 if k % 2 == 0 else 0.46)
        room.add(s, T_BIZ + b(k / 2), 0.2)
    # module connections: the chord climbs as each station wakes
    for k, m in enumerate((B4, D5, Fs5, A5)):
        ml = mallet(m, 2.4)
        dry.add(ml, T_BIZ + b(k), 0.30, pan=[-0.35, -0.1, 0.1, 0.35][k])
        hall.add(ml, T_BIZ + b(k), 0.22)
    # restrained electronic pulse
    for k in range(16):
        tk = T_BIZ + b(k / 4)
        room.add(tick(), tk, 0.05 if k % 2 else 0.085)
        dry.add(tick(), tk, 0.035 if k % 2 else 0.06, pan=0.3 if k % 4 == 1 else -0.2)
    for k in (0, 2, 3.5):
        dry.add(kick(), T_BIZ + b(k), 0.44)
    arp3 = [B3, Fs4, A4, D5]
    for k in range(16):
        dry.add(arp_pluck(arp3[k % 4]), T_BIZ + b(k / 4), 0.085 if k % 4 else 0.11,
                pan=-0.45 if k % 2 else 0.45)
        room.add(arp_pluck(arp3[k % 4]), T_BIZ + b(k / 4), 0.05)

    # ---------------- bar 4: the loop closes (A sus4 -> A) ----------------------
    # ACCENT 2 (7.5): fullest moment
    low.add(sub(A1, 2.5, 0.005, 0.8), T_LOOP, 0.55)
    dry.add(kick(1.1), T_LOOP, 0.72)
    hall.add(lp(kick(), 400), T_LOOP, 0.2)
    for m, g, pan in ((A4, 0.20, -0.25), (E5, 0.22, 0.25), (A5, 0.16, 0.0)):
        bl = fm_bell(m, bright=0.9)
        dry.add(bl, T_LOOP, g, pan=pan)
        hall.add(bl, T_LOOP, g)
    cut = np.interp(tt(2.8), [0, 1.2, 2.8], [1500, 1900, 700])
    pad4 = ensemble([A2, D3, E3, A3, D4], 1.3, cut[:int(1.3 * SR)], attack=0.05, release=0.3)
    dry.add(pad4, T_LOOP, 0.30)
    hall.add(pad4, T_LOOP, 0.24)
    pad4b = ensemble([A2, Cs3, E3, A3], 1.55, cut[int(1.25 * SR):], attack=0.2, release=0.9)
    dry.add(pad4b, T_LOOP + b(2), 0.24)
    hall.add(pad4b, T_LOOP + b(2), 0.22)
    pattern4 = [A1, A1, A2, A1]
    for k, m in enumerate(pattern4):
        s = ensemble([m + 12], 0.24, 1250, attack=0.008, release=0.16, voices=4, spread_c=7)
        dry.add(s, T_LOOP + b(k / 2), 0.64 if k % 2 == 0 else 0.48)
        room.add(s, T_LOOP + b(k / 2), 0.2)
    arp4 = [A3, E4, A4, D5]
    for k in range(8):
        dry.add(arp_pluck(arp4[k % 4]), T_LOOP + b(k / 4), (0.1 if k % 4 else 0.12) * (1 - k / 10),
                pan=-0.45 if k % 2 else 0.45)
    for k in range(8):
        dry.add(tick(), T_LOOP + b(k / 4), 0.05 if k % 2 else 0.08)
    dry.add(kick(0.8), T_LOOP + b(1), 0.45)
    # layers leave on beat 3; the collapse is carried by strings alone
    # reverse sonic-logo swell into the brand
    rv = fm_bell(D5, 1.6, bright=0.7) + fm_bell(A4, 1.6, bright=0.5) * 0.6
    rv_w = reverb(np.pad(rv, ((0, 0), (0, N - rv.shape[1]))), make_ir(3.2, seed=9), 1.0)[:, :int(0.95 * SR)]
    dry.add(rv_w[:, ::-1] * np.linspace(0, 1, rv_w.shape[1]) ** 2.2, T_BRAND - 0.95, 0.55, tail=False)

    # ---------------- bars 5-6: brand (D add9) ----------------------------------
    # ACCENT 3 (10.0): sonic logo D - A - F#, warm and certain
    low.add(sub(D1, 3.6, 0.02, 2.4) * np.exp(-tt(3.6) / 1.6), T_BRAND, 0.55)
    low.add(sub(D2, 3.0, 0.02, 2.0) * np.exp(-tt(3.0) / 1.4), T_BRAND, 0.18)
    logo = [(T_BRAND, D5, 0.36, -0.12), (T_BRAND + b(0.5), A5, 0.26, 0.12), (T_BRAND + b(1.0), Fs5, 0.34, 0.0)]
    for tn, m, g, pan in logo:
        bl = fm_bell(m, 5.6, bright=0.85, decay=2.2)
        dry.add(bl, tn, g * 1.35, pan=pan)
        hall.add(bl, tn, g * 1.0)
        pp = felt_piano(m - 12, 5.6, 0.6)
        dry.add(pp, tn, 0.22, pan=pan)
        hall.add(pp, tn, 0.10)
    chord = felt_piano(D2, 5.2, 0.5) * 0.8 + felt_piano(A2, 5.2, 0.45) * 0.55 + felt_piano(Fs3, 5.2, 0.45) * 0.4
    dry.add(chord, T_BRAND, 0.26)
    hall.add(chord, T_BRAND, 0.16)
    cut = np.interp(tt(5.0), [0, 1.0, 5.0], [1300, 1000, 500])
    pad5 = ensemble([D2, A2, E3, Fs3, A3], 5.0, cut, attack=0.25, release=3.6)
    dry.add(pad5, T_BRAND - 0.02, 0.27)
    hall.add(pad5, T_BRAND - 0.02, 0.25)
    # a last, quiet echo of the logo's final note as the image settles
    ec = fm_bell(Fs5 + 12, 2.5, bright=0.4, decay=1.2)
    hall.add(ec, 12.5, 0.05)
    dry.add(ec, 12.5, 0.025, pan=0.3)

    # ---------------- mix -----------------------------------------------------
    ir_hall = make_ir(2.8, pre=0.028, dur=3.4, bright=0.45, seed=5)
    ir_room = make_ir(0.8, pre=0.008, dur=1.0, bright=0.7, seed=6)
    mix = dry.x + reverb(hall.x, ir_hall, 0.55) + reverb(room.x, ir_room, 0.35)
    mix = hp(mix, 32, 2)
    lowm = lp(low.x, 180, 2)
    mix = mix + lowm
    mix = hp(mix, 22, 2)
    return mix


def soft_limit(x, ceiling):
    """Look-ahead peak limiter with smooth gain (no hard clipping)."""
    peak = np.max(np.abs(x), axis=0)
    look = int(0.004 * SR)
    # moving max over look-ahead window
    from scipy.ndimage import maximum_filter1d, uniform_filter1d
    pk = maximum_filter1d(peak, size=2 * look + 1)
    g = np.minimum(1.0, ceiling / np.maximum(pk, 1e-9))
    # attack instant (handled by look-ahead), release smoothed
    g = uniform_filter1d(g, size=look)
    rel = np.exp(-1.0 / (0.08 * SR))
    out = g.copy()
    for i in range(1, len(out)):
        if out[i] > out[i - 1]:
            out[i] = out[i - 1] * rel + out[i] * (1 - rel)
    return x * out


def loudness(path):
    r = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', path, '-af',
                        'ebur128=peak=true', '-f', 'null', '-'], capture_output=True, text=True)
    txt = r.stderr
    import re
    I = float(re.findall(r'I:\s+(-?[\d.]+) LUFS', txt)[-1])
    tp = float(re.findall(r'Peak:\s+(-?[\d.]+) dBFS', txt)[-1])
    lra = float(re.findall(r'LRA:\s+(-?[\d.]+) LU', txt)[-1])
    return I, tp, lra


def write_wav(path, x, bits=24):
    import wave
    x = np.clip(x, -1, 1)
    if bits == 24:
        v = np.round(x.T * (2 ** 23 - 1)).astype(np.int32)
        raw = np.zeros((v.shape[0], 2, 3), np.uint8)
        for c in range(2):
            b_ = v[:, c].astype('<i4').view(np.uint8).reshape(-1, 4)
            raw[:, c, :] = b_[:, :3]
        data = raw.tobytes()
        sw = 3
    else:
        data = np.round(x.T * 32767).astype('<i2').tobytes()
        sw = 2
    with wave.open(path, 'wb') as w:
        w.setnchannels(2)
        w.setsampwidth(sw)
        w.setframerate(SR)
        w.writeframes(data)


def main(target_lufs=-16.0, ceiling_db=-1.5):
    os.makedirs(os.path.join(ROOT, 'build'), exist_ok=True)
    os.makedirs(os.path.join(ROOT, 'out'), exist_ok=True)
    mix = compose()
    # gentle end: the tail is already quiet; make the last 0.35 s land on true silence
    fade = np.ones(N)
    nf = int(0.35 * SR)
    fade[-nf:] = np.cos(np.linspace(0, np.pi / 2, nf)) ** 2
    mix = mix * fade
    mix = mix / np.max(np.abs(mix)) * 0.5
    raw = os.path.join(ROOT, 'build', 'score_raw.wav')
    write_wav(raw, mix)
    I, tp, lra = loudness(raw)
    gain = 10 ** ((target_lufs - I) / 20)
    mix = mix * gain
    ceiling = 10 ** ((ceiling_db - 0.3) / 20)
    mix = soft_limit(mix, ceiling)
    out = os.path.join(ROOT, 'out', 'score.wav')
    write_wav(out, mix)
    I2, tp2, lra2 = loudness(out)
    print(f'score.wav: {N} samples ({N / SR:.3f} s) @ {SR} Hz stereo 24-bit | '
          f'I={I2:.1f} LUFS  TP={tp2:.1f} dBTP  LRA={lra2:.1f} LU')


if __name__ == '__main__':
    main()
