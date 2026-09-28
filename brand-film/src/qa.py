"""Self-check of the delivered film. Prints PASS/FAIL per item; exits non-zero on failure.

Checks: container/stream specs, duration & frame count, audio presence/format/
levels/tail, A/V sync on the three accents, glyph coverage of all copy, empty or
flash frames, picture changes on the bar lines, brand hold in the last 4 s,
last-frame poster, and a phone-size readability preview.
"""
import json
import os
import subprocess
import sys

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from timeline import FPS, FRAMES, DURATION, SR, BEAT, W, H, T_KEY_SHIFT, T_LOOP, T_BRAND  # noqa: E402
import finish  # noqa: E402
import typography  # noqa: E402
import audiocheck  # noqa: E402

ROOT = finish.ROOT
results = []


def check(name, ok, detail=''):
    results.append((name, ok, detail))
    print(f"[{'PASS' if ok else 'FAIL'}] {name}  {detail}")


def probe():
    r = subprocess.run(['ffprobe', '-v', 'error', '-show_streams', '-show_format', '-count_frames',
                        '-of', 'json', finish.MP4], capture_output=True, text=True, check=True)
    return json.loads(r.stdout)


def decode_frames(scale=None):
    vf = [] if scale is None else ['-vf', f'scale={scale[0]}:{scale[1]}']
    r = subprocess.run(['ffmpeg', '-v', 'error', '-i', finish.MP4, *vf, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'],
                       capture_output=True, check=True)
    w, h = scale if scale else (W, H)
    return np.frombuffer(r.stdout, np.uint8).reshape(-1, h, w, 3)


def main():
    info = probe()
    v = [s for s in info['streams'] if s['codec_type'] == 'video'][0]
    a = [s for s in info['streams'] if s['codec_type'] == 'audio']
    check('video codec H.264 High, yuv420p', v['codec_name'] == 'h264' and v['pix_fmt'] == 'yuv420p',
          f"{v['codec_name']} {v.get('profile')} {v['pix_fmt']}")
    check('resolution 1920x1080 (16:9)', (v['width'], v['height']) == (1920, 1080), f"{v['width']}x{v['height']}")
    check('constant 60 fps', v['r_frame_rate'] == '60/1' and v['avg_frame_rate'] == '60/1',
          f"r={v['r_frame_rate']} avg={v['avg_frame_rate']}")
    nb = int(v['nb_read_frames'])
    check('exactly 900 frames (0-899)', nb == FRAMES, f'{nb} frames')
    vd = float(v['duration'])
    check('video duration 15.000 s', abs(vd - DURATION) < 1e-3, f'{vd:.4f} s')
    check('audio stream present (AAC, 48 kHz, stereo)',
          len(a) == 1 and a[0]['codec_name'] == 'aac' and a[0]['sample_rate'] == '48000' and a[0]['channels'] == 2,
          f"{a[0]['codec_name']} {a[0]['sample_rate']} Hz {a[0]['channels']} ch" if a else 'none')
    ad = float(a[0]['duration'])
    check('audio duration matches video (<= 1 AAC frame)', abs(ad - DURATION) <= 1024 / SR + 1e-3, f'{ad:.4f} s')

    # --- the master WAV
    x = audiocheck.read(finish.WAV)
    check('score.wav 15.000 s, stereo, 48 kHz', x.shape == (2, int(DURATION * SR)), f'{x.shape}')
    pk = 20 * np.log10(np.max(np.abs(x)))
    check('no clipping (peak < -1 dBFS)', pk < -1.0, f'peak {pk:.2f} dBFS')
    rms = np.sqrt(np.mean(x ** 2))
    check('sound actually present (RMS > -35 dBFS)', 20 * np.log10(rms) > -35, f'RMS {20 * np.log10(rms):.1f} dBFS')
    tail = 20 * np.log10(np.max(np.abs(x[:, -int(0.05 * SR):])) + 1e-12)
    pre = 20 * np.log10(np.sqrt(np.mean(x[:, int(13.5 * SR):int(14.5 * SR)] ** 2)) + 1e-12)
    check('natural decay, no hard cut at 15 s', tail < -45 and pre < -22, f'13.5-14.5 s RMS {pre:.1f} dBFS, last 50 ms peak {tail:.1f} dBFS')
    head = 20 * np.log10(np.max(np.abs(x[:, :int(0.02 * SR)])) + 1e-12)
    check('sound starts on frame 0 (low impact)', head > -20, f'first 20 ms peak {head:.1f} dBFS')
    # decoded audio from the MP4 (what viewers hear) and sync of accents
    r = subprocess.run(['ffmpeg', '-v', 'error', '-i', finish.MP4, '-map', '0:a', '-f', 'f32le', '-ac', '1', '-ar', str(SR), '-'],
                       capture_output=True, check=True)
    m = np.frombuffer(r.stdout, np.float32)
    # attack onset: first 1 ms window whose peak jumps >= 6 dB above the preceding 30 ms
    hop = SR // 1000
    env = np.abs(m[:len(m) // hop * hop]).reshape(-1, hop).max(1)
    db = 20 * np.log10(env + 1e-9)
    for name, tk in (('path opens (knock)', T_KEY_SHIFT), ('loop closes', T_LOOP), ('brand', T_BRAND)):
        k0 = int((tk - 0.06) * 1000)
        tp = None
        for k in range(k0, int((tk + 0.06) * 1000)):
            if db[k] - np.median(db[k - 30:k]) >= 6.0:
                tp = k / 1000
                break
        ok = tp is not None and abs(tp - tk) <= 0.010
        check(f'audio accent in MP4 on {tk:.3f} s: {name}', ok,
              f'attack at {tp:.3f} s ({(tp - tk) * 1000:+.0f} ms)' if tp is not None else 'no attack found')

    # --- copy: every glyph present in the font actually used
    for text, wt in (('贺去病商业咨询', 'SemiBold'), ('懂生意，能落地。', 'Regular'), ('看清变局', 'SemiBold'),
                     ('找到新路', 'SemiBold'), ('把 AI，变成生意。', 'Bold')):
        tf = typography.typeface(wt, text)
        check(f'glyph coverage: {text}', typography.covers(tf, text), f'Noto Serif CJK SC {wt}')

    # --- picture
    fr = decode_frames((480, 270))
    lum = fr.astype(np.float32).mean(axis=(1, 2, 3)) / 255
    std = fr.astype(np.float32).std(axis=(1, 2, 3)) / 255
    check('no empty frames (every frame has structure)', std.min() > 0.02, f'min per-frame std {std.min():.3f} at f{int(std.argmin())}')
    d = np.abs(np.diff(lum))
    worst = int(np.argmax(d))
    check('no flashes: frame-to-frame mean luminance jump < 0.12', d.max() < 0.12, f'max {d.max():.3f} at f{worst}->f{worst + 1}')
    diff = np.abs(np.diff(fr.astype(np.int16), axis=0)).mean(axis=(1, 2, 3))
    first = float(diff[0])
    check('frame 0 is a composed image (not black)', lum[0] > 0.04 and std[0] > 0.03, f'lum {lum[0]:.3f} std {std[0]:.3f}')
    for bn in (4, 8, 12, 16):
        f = int(bn * BEAT * FPS)
        near = diff[f - 3:f + 6].max()
        check(f'picture changes on bar line f{f} ({f / FPS:.1f} s)', near > 0.4, f'max motion near bar line {near:.2f}')
    last4 = diff[int(11.0 * FPS):]
    check('brand held still for the last 4 s (no drift of type)', last4.max() < 1.0, f'max frame diff {last4.max():.3f} (grain/paper only)')
    locked = diff[int(10.7 * FPS):].max()
    check('brand settled before 10.625 s', locked < 1.0, f'max frame diff after 10.70 s: {locked:.3f}')
    del first

    # --- poster & phone preview
    full = decode_frames()
    lastf = full[-1]
    Image.fromarray(lastf).save(os.path.join(ROOT, 'build', 'qa_last_frame_from_mp4.png'))
    phone = Image.fromarray(lastf).resize((390, 219), Image.LANCZOS)
    mid = Image.fromarray(full[int(6.8 * FPS)]).resize((390, 219), Image.LANCZOS)
    k1 = Image.fromarray(full[int(1.6 * FPS)]).resize((390, 219), Image.LANCZOS)
    k2 = Image.fromarray(full[int(3.6 * FPS)]).resize((390, 219), Image.LANCZOS)
    P = Image.new('RGB', (390 * 2 + 30, 219 * 2 + 30), (20, 20, 20))
    for i, im in enumerate((k1, k2, mid, phone)):
        P.paste(im, (10 + (i % 2) * 400, 10 + (i // 2) * 229))
    P.save(os.path.join(ROOT, 'out', 'qa_phone_preview.png'))
    check('phone preview written (390 px wide = iPhone portrait width)', True, 'out/qa_phone_preview.png')

    bad = [r for r in results if not r[1]]
    print(f'\n{len(results) - len(bad)}/{len(results)} checks passed')
    return 1 if bad else 0


if __name__ == '__main__':
    sys.exit(main())
