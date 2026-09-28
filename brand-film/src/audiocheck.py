"""Visual + numeric audio QA: spectrogram, loudness envelope, onsets vs. the beat grid."""
import os
import sys
import wave

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import numpy as np
from scipy import signal

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from timeline import SR, BEAT, DURATION  # noqa: E402


def read(path):
    with wave.open(path) as w:
        n, ch, sw = w.getnframes(), w.getnchannels(), w.getsampwidth()
        raw = np.frombuffer(w.readframes(n), np.uint8)
    if sw == 3:
        a = raw.reshape(-1, 3)
        v = (a[:, 0].astype(np.int32) | (a[:, 1].astype(np.int32) << 8) | (a[:, 2].astype(np.int32) << 16))
        v = np.where(v >= 2 ** 23, v - 2 ** 24, v)
        x = v.reshape(-1, ch).T / 2 ** 23
    else:
        x = np.frombuffer(raw.tobytes(), '<i2').reshape(-1, ch).T / 32768
    return x


def main(path, out):
    x = read(path)
    m = x.mean(0)
    fig, ax = plt.subplots(3, 1, figsize=(16, 10), sharex=True)
    f, t, S = signal.spectrogram(m, SR, nperseg=2048, noverlap=1536)
    ax[0].pcolormesh(t, f, 10 * np.log10(S + 1e-12), shading='auto', vmin=-120, vmax=-30, cmap='magma')
    ax[0].set_ylim(20, 8000)
    ax[0].set_yscale('log')
    hop = 480
    rms = np.sqrt(np.convolve(m ** 2, np.ones(hop) / hop, 'same'))[::hop]
    tr = np.arange(len(rms)) * hop / SR
    ax[1].plot(tr, 20 * np.log10(rms + 1e-9))
    ax[1].set_ylim(-70, 0)
    ax[1].set_ylabel('RMS dBFS')
    # onset strength (spectral flux)
    f2, t2, Z = signal.stft(m, SR, nperseg=1024, noverlap=768)
    mag = np.abs(Z)
    flux = np.maximum(0, np.diff(mag, axis=1)).sum(0)
    ax[2].plot(t2[1:], flux / flux.max())
    for a in ax:
        for k in range(25):
            a.axvline(k * BEAT, color='w' if a is ax[0] else '0.8', lw=0.5 if k % 4 else 1.4, alpha=0.6)
    ax[2].set_xlim(0, DURATION)
    plt.tight_layout()
    plt.savefig(out, dpi=70)
    pk = np.max(np.abs(x))
    print(f'peak {20*np.log10(pk):.2f} dBFS; last 50 ms max {20*np.log10(np.max(np.abs(x[:, -2400:]))+1e-12):.1f} dBFS;'
          f' first 10 ms max {20*np.log10(np.max(np.abs(x[:, :480]))+1e-12):.1f} dBFS')
    # onsets near key times
    peaks, _ = signal.find_peaks(flux / flux.max(), height=0.18, distance=8)
    print('onsets (s):', ' '.join(f'{t2[1:][p]:.3f}' for p in peaks))


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
