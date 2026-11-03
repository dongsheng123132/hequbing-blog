# -*- coding: utf-8 -*-
"""Download the 14 freshly generated images (A01/A02/A04/A05) into public/images/geo/<slug>/."""
import os
import urllib.request

BASE = r"C:\Users\ZhuanZ\DoubaoWork\chats\2026-09-30\new-chat-5\hequbing-blog-deploy"
IMG_ROOT = os.path.join(BASE, "public", "images", "geo")

PLAN = {
    "geo-a01": {
        "cover.jpg": "https://aka.doubaocdn.com/s/a0oUvApyHP",
        "img-1.jpg": "https://aka.doubaocdn.com/s/JQk3jM2ExY",
        "img-2.jpg": "https://aka.doubaocdn.com/s/O3XevIoy2P",
        "img-3.jpg": "https://aka.doubaocdn.com/s/vpuJObV0Ml",
    },
    "geo-a02": {
        "cover.jpg": "https://aka.doubaocdn.com/s/rl9xPasV7G",
        "img-1.jpg": "https://aka.doubaocdn.com/s/nNvMhS65rq",
        "img-2.jpg": "https://aka.doubaocdn.com/s/MQK8vvnViv",
        "img-3.jpg": "https://aka.doubaocdn.com/s/kb3l8lchBj",
    },
    "geo-a04": {
        "img-1.jpg": "https://aka.doubaocdn.com/s/f7gUS0fHop",
        "img-2.jpg": "https://aka.doubaocdn.com/s/5VwZxV8X3d",
        "img-3.jpg": "https://aka.doubaocdn.com/s/Ifx2PVpREI",
    },
    "geo-a05": {
        "img-1.jpg": "https://aka.doubaocdn.com/s/VJTuCr5U6Z",
        "img-2.jpg": "https://aka.doubaocdn.com/s/BEXKTFQrHH",
        "img-3.jpg": "https://aka.doubaocdn.com/s/YzMn5g4KlX",
    },
}


def download(url, dest):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=60) as resp:
        data = resp.read()
    if len(data) < 5000:
        raise RuntimeError(f"too small ({len(data)}B)")
    with open(dest, "wb") as f:
        f.write(data)
    return len(data)


def main():
    failed = []
    for slug, files in PLAN.items():
        folder = os.path.join(IMG_ROOT, slug)
        os.makedirs(folder, exist_ok=True)
        for name, url in files.items():
            dest = os.path.join(folder, name)
            try:
                size = download(url, dest)
                print(f"OK {slug}/{name} {size}B")
            except Exception as exc:  # noqa: BLE001
                failed.append((url, str(exc)))
                print(f"FAIL {slug}/{name} {exc}")
    print(f"{len(failed)} failed")
    for url, err in failed:
        print("  failed:", url, err)


if __name__ == "__main__":
    main()
