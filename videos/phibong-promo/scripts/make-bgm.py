#!/usr/bin/env python3
"""Synthesize the Phibong promo BGM offline (no samples, no network).

100 BPM (beat = 0.6s, bar = 2.4s), locked to the STORYBOARD.md frame grid:
  F1 0.0–5.4   pain     A-minor pad, low hits on each slam beat, ticking hats
  F2 5.4–10.2  brand    swell into C major, FM-piano arpeggio enters
  F3–F6 10.2–42.6       groove: kick / hats / bass, C–G–Am–F one chord per bar
  F7 42.6–49.8 CTA      resolve on C, drums drop at 45.0, ring out + fade

Usage: python3 scripts/make-bgm.py [out.wav]   (default assets/bgm/track.wav)
Requires numpy. Deterministic: fixed RNG seed.
"""
import sys
import wave

import numpy as np

SR = 44100
BEAT = 0.6
TOTAL = 49.8
rng = np.random.default_rng(20260929)
N = int(SR * (TOTAL + 0.2))
L = np.zeros(N)
R = np.zeros(N)


def midi(n):
    return 440.0 * 2 ** ((n - 69) / 12)


def place(sig, t, pan=0.0, gain=1.0):
    i = int(t * SR)
    if i >= N:
        return
    sig = sig[: N - i] * gain
    L[i : i + len(sig)] += sig * np.cos((pan + 1) * np.pi / 4)
    R[i : i + len(sig)] += sig * np.sin((pan + 1) * np.pi / 4)


def env_adsr(n, a, d, s, r, sustain_len):
    total = int((a + d + sustain_len + r) * SR)
    e = np.zeros(total)
    ia, id_, isus = int(a * SR), int(d * SR), int(sustain_len * SR)
    e[:ia] = np.linspace(0, 1, ia, endpoint=False)
    e[ia : ia + id_] = np.linspace(1, s, id_, endpoint=False)
    e[ia + id_ : ia + id_ + isus] = s
    e[ia + id_ + isus :] = np.linspace(s, 0, total - ia - id_ - isus)
    return e


def pad(notes, t, dur, gain=0.05):
    """Warm detuned additive pad with slow attack/release."""
    e = env_adsr(None, 0.9, 0.3, 0.8, 1.2, max(dur - 1.2, 0.1))
    tt = np.arange(len(e)) / SR
    for k, n in enumerate(notes):
        f = midi(n)
        for det, pan in ((-0.0035, -0.6), (0.0035, 0.6)):
            ff = f * (1 + det)
            s = np.zeros_like(tt)
            for h in range(1, 7):  # soft, rolled-off saw
                s += np.sin(2 * np.pi * ff * h * tt + k + h) / (h ** 1.6)
            place(s * e, t, pan=pan, gain=gain)


def fm_piano(n, t, vel=1.0, dur=1.6, pan=0.0):
    """Two-operator FM electric-piano pluck."""
    f = midi(n)
    tt = np.arange(int(dur * SR)) / SR
    idx = 2.2 * np.exp(-tt * 9)
    mod = idx * np.sin(2 * np.pi * f * tt)
    car = np.sin(2 * np.pi * f * tt + mod)
    car += 0.25 * np.sin(2 * np.pi * 2 * f * tt) * np.exp(-tt * 6)
    e = np.exp(-tt * 3.2) * np.minimum(1, tt / 0.004)
    place(car * e, t, pan=pan, gain=0.09 * vel)


def kick(t, gain=0.55):
    tt = np.arange(int(0.42 * SR)) / SR
    f = 45 + 85 * np.exp(-tt * 28)
    ph = 2 * np.pi * np.cumsum(f) / SR
    s = np.sin(ph) * np.exp(-tt * 7.5)
    s[: int(0.003 * SR)] += rng.normal(0, 0.3, int(0.003 * SR))
    place(np.tanh(s * 1.6), t, gain=gain)


def low_hit(t, gain=0.5):
    """Soft cinematic thump for the pain slams."""
    tt = np.arange(int(0.9 * SR)) / SR
    f = 38 + 50 * np.exp(-tt * 14)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt * 4.5)
    nz = rng.normal(0, 1, len(tt)) * np.exp(-tt * 30) * 0.08
    place(np.tanh((s + nz) * 1.3), t, gain=gain)


def hat(t, gain=0.05, decay=45, pan=0.25):
    n = int(0.12 * SR)
    tt = np.arange(n) / SR
    nz = rng.normal(0, 1, n)
    nz = np.diff(nz, prepend=0)  # crude high-pass
    place(nz * np.exp(-tt * decay), t, pan=pan, gain=gain)


def bass(n, t, dur, gain=0.16):
    f = midi(n)
    tt = np.arange(int(dur * SR)) / SR
    s = np.sin(2 * np.pi * f * tt) + 0.3 * np.sin(4 * np.pi * f * tt)
    e = np.minimum(1, tt / 0.01) * np.exp(-tt * 1.8)
    place(np.tanh(s * e * 1.4), t, gain=gain)


def swell(t_end, length=1.6, gain=0.07):
    """Reversed-noise riser that lands on a frame boundary."""
    n = int(length * SR)
    tt = np.arange(n) / SR
    nz = rng.normal(0, 1, n)
    nz = np.convolve(nz, np.ones(6) / 6, mode="same")
    e = (tt / length) ** 2.4
    place(nz * e, t_end - length, gain=gain)


# ── F1: pain (0–5.4) ────────────────────────────────────────────────────────
pad([45, 52, 57, 60, 64], 0.0, 4.4, gain=0.035)          # A minor
pad([41, 53, 57, 60, 65], 4.2, 1.8, gain=0.03)            # F (lean into C)
for t in (0.6, 1.2, 2.4, 3.6):                            # the four slams
    low_hit(t, gain=0.42 if t > 0.6 else 0.3)
for b in range(0, 9):
    hat(b * BEAT + 0.3, gain=0.025, decay=70, pan=0.4)
for k, t in enumerate((4.2, 4.4, 4.6)):                   # strike-through ticks
    fm_piano(76 + k * 2, t, vel=0.5, dur=0.6, pan=0.3)
swell(5.4, 1.4, gain=0.06)

# ── F2: brand (5.4–10.2) ────────────────────────────────────────────────────
pad([48, 55, 60, 64, 67], 5.4, 4.8, gain=0.045)           # C major bloom
kick(5.4, gain=0.35)
arp = [60, 64, 67, 72, 67, 64, 60, 67]
for i in range(8):
    fm_piano(arp[i], 5.4 + i * BEAT, vel=0.7 + 0.3 * (i == 0), pan=-0.2 + 0.1 * (i % 4))
fm_piano(79, 7.8, vel=0.6, dur=2.0, pan=0.3)              # PHIBONG / pill sparkle
swell(10.2, 1.8, gain=0.06)

# ── F3–F6: groove (10.2–42.6) ────────────────────────────────────────────────
prog = [  # (bass, pad voicing, arp)
    (36, [48, 55, 60, 64], [60, 64, 67, 72]),   # C
    (43, [47, 55, 59, 62], [59, 62, 67, 71]),   # G
    (45, [48, 57, 60, 64], [57, 60, 64, 69]),   # Am
    (41, [48, 53, 57, 60], [57, 60, 65, 69]),   # F
]
t = 10.2
bar = 0
while t < 42.6 - 1e-6:
    b, voicing, a = prog[bar % 4]
    pad(voicing, t, 2.4, gain=0.03)
    for beat in range(4):
        bt = t + beat * BEAT
        if beat in (0, 2):
            kick(bt, gain=0.42)
        hat(bt + BEAT / 2, gain=0.04, pan=0.3)
        hat(bt, gain=0.018, decay=80, pan=-0.3)
        fm_piano(a[beat], bt, vel=0.55, dur=1.0, pan=-0.25 + 0.15 * beat)
    bass(b, t, 1.0)
    bass(b, t + 1.5 * BEAT, 0.8, gain=0.12)
    bass(b + 12 if bar % 2 else b, t + 3 * BEAT, 0.5, gain=0.1)
    t += 2.4
    bar += 1
for boundary in (19.8, 27.0, 35.4):                       # frame boundaries F3→F4→F5→F6
    swell(boundary, 1.2, gain=0.04)
swell(42.6, 1.8, gain=0.06)

# ── F7: CTA resolve (42.6–49.8) ──────────────────────────────────────────────
pad([36, 48, 55, 60, 64, 67], 42.6, 6.6, gain=0.05)      # long C
kick(42.6, gain=0.45)
for i, n in enumerate([60, 64, 67, 72]):
    fm_piano(n, 42.6 + i * BEAT, vel=0.7, dur=1.6, pan=-0.3 + 0.2 * i)
kick(43.8, gain=0.3)
bass(36, 42.6, 2.4, gain=0.16)
fm_piano(84, 45.0, vel=0.55, dur=3.0, pan=0.2)            # URL pill sparkle
fm_piano(72, 45.0, vel=0.6, dur=3.0, pan=-0.2)
fm_piano(76, 45.6, vel=0.4, dur=3.0, pan=0.1)

# ── master ──────────────────────────────────────────────────────────────────
mix = np.stack([L, R], axis=1)[: int(SR * TOTAL)]
n = len(mix)
fade_in = np.minimum(1, np.arange(n) / (0.05 * SR))
fade_out = np.clip((TOTAL - np.arange(n) / SR) / 2.2, 0, 1) ** 1.5
mix *= (fade_in * fade_out)[:, None]
rms = np.sqrt(np.mean(mix[int(10.2 * SR) : int(42.6 * SR)] ** 2))
mix *= 10 ** (-17 / 20) / rms                              # groove section ≈ -17 dBFS RMS
mix = np.tanh(mix * 1.1) / np.tanh(1.1)                   # soft limiter
peak = np.max(np.abs(mix))
if peak > 0.89:
    mix *= 0.89 / peak                                    # ≤ -1 dBFS

out = sys.argv[1] if len(sys.argv) > 1 else "assets/bgm/track.wav"
with wave.open(out, "wb") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes((mix * 32767).astype("<i2").tobytes())
print(f"wrote {out}: {TOTAL}s, peak {20*np.log10(np.max(np.abs(mix))):.1f} dBFS")
