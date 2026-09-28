"""获取第三方资产（不随仓库分发字体与模型文件）。

  python -m src.fetch_assets

- Ma Shan Zheng 字体（SIL OFL 1.1）: google/fonts 仓库
- Make Me a Hanzi graphics.txt（Arphic Public License）：仅抽取本片用到的字，保存笔画轮廓与中线
- MeloTTS 中文模型（MIT）：k2-fsa/sherpa-onnx 转换版 vits-melo-tts-zh_en
- Noto Serif/Sans CJK SC（SIL OFL 1.1）：系统包 fonts-noto-cjk / fonts-noto-cjk-extra
"""
import json
import os
import subprocess
import sys
import tarfile
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSETS = os.path.join(ROOT, "assets")

STROKE_CHARS = "问谋商管略联行成贺去病"

URLS = {
    "mashanzheng": "https://raw.githubusercontent.com/google/fonts/main/ofl/mashanzheng/MaShanZheng-Regular.ttf",
    "mashanzheng_license": "https://raw.githubusercontent.com/google/fonts/main/ofl/mashanzheng/OFL.txt",
    "hanzi_graphics": "https://raw.githubusercontent.com/skishore/makemeahanzi/master/graphics.txt",
    "hanzi_copying": "https://raw.githubusercontent.com/skishore/makemeahanzi/master/COPYING",
    "melo": "https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/vits-melo-tts-zh_en.tar.bz2",
}


def _get(url, dest):
    if os.path.exists(dest) and os.path.getsize(dest) > 0:
        return dest
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    print("download", url)
    tmp = dest + ".part"
    urllib.request.urlretrieve(url, tmp)
    os.replace(tmp, dest)
    return dest


def fetch_fonts():
    d = os.path.join(ASSETS, "fonts")
    _get(URLS["mashanzheng"], os.path.join(d, "MaShanZheng-Regular.ttf"))
    _get(URLS["mashanzheng_license"], os.path.join(d, "MaShanZheng-OFL.txt"))
    missing = [p for p in ("/usr/share/fonts/opentype/noto/NotoSerifCJK-Bold.ttc",
                           "/usr/share/fonts/opentype/noto/NotoSansCJK-Medium.ttc")
               if not os.path.exists(p)]
    if missing:
        print("缺少 Noto CJK 字体，请执行: apt-get install -y fonts-noto-cjk fonts-noto-cjk-extra")


def fetch_hanzi():
    d = os.path.join(ASSETS, "hanzi")
    out = os.path.join(d, "strokes_subset.json")
    cache = os.path.join(ROOT, ".cache", "graphics.txt")
    _get(URLS["hanzi_graphics"], cache)
    _get(URLS["hanzi_copying"], os.path.join(d, "MAKEMEAHANZI-COPYING.txt"))
    found = {}
    with open(cache, encoding="utf-8") as fh:
        for line in fh:
            rec = json.loads(line)
            if rec["character"] in STROKE_CHARS:
                found[rec["character"]] = rec
    missing = [c for c in STROKE_CHARS if c not in found]
    assert not missing, f"stroke data missing: {missing}"
    os.makedirs(d, exist_ok=True)
    with open(out, "w", encoding="utf-8") as fh:
        json.dump({c: found[c] for c in STROKE_CHARS}, fh, ensure_ascii=False)
    print("hanzi subset ->", out)


def fetch_tts():
    d = os.path.join(ASSETS, "tts")
    target = os.path.join(d, "vits-melo-tts-zh_en")
    if os.path.exists(os.path.join(target, "model.onnx")):
        return
    arc = os.path.join(ROOT, ".cache", "vits-melo-tts-zh_en.tar.bz2")
    _get(URLS["melo"], arc)
    os.makedirs(d, exist_ok=True)
    with tarfile.open(arc) as tf:
        tf.extractall(d)


if __name__ == "__main__":
    fetch_fonts()
    fetch_hanzi()
    if "--no-tts" not in sys.argv:
        fetch_tts()
