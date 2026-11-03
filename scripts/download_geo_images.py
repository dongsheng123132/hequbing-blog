# -*- coding: utf-8 -*-
"""Download GEO serialization illustrations (A03-D04) into public/images/geo/<slug>/.
Mapping comes from REFERENCED_IMAGES aka links, one image per illustration slot.
"""
import os
import urllib.request

BASE = r"C:\Users\ZhuanZ\DoubaoWork\chats\2026-09-30\new-chat-5\hequbing-blog-deploy"
IMG_ROOT = os.path.join(BASE, "public", "images", "geo")

# slug -> {file: aka url}
PLAN = {
    "geo-a03": {
        "cover.jpg": "https://aka.doubaocdn.com/s/dj3MAXmkSF",
        "img-1.jpg": "https://aka.doubaocdn.com/s/ZKDAhvbqqC",
        "img-2.jpg": "https://aka.doubaocdn.com/s/NuUXahMM6l",
        "img-3.jpg": "https://aka.doubaocdn.com/s/EILTwcGQTX",
    },
    "geo-a04": {
        "img-1.jpg": "https://aka.doubaocdn.com/s/IeQKHpz0oV",
        "img-2.jpg": "https://aka.doubaocdn.com/s/Smr7SJmC9X",
        "img-3.jpg": "https://aka.doubaocdn.com/s/w1rWgN9Gqe",
    },
    "geo-a05": {
        "img-1.jpg": "https://aka.doubaocdn.com/s/q0yS8bmB4U",
        "img-2.jpg": "https://aka.doubaocdn.com/s/cEiV2TKFCP",
        "img-3.jpg": "https://aka.doubaocdn.com/s/5dryUvoVLM",
    },
    "geo-a06": {
        "img-1.jpg": "https://aka.doubaocdn.com/s/RPI0ifNEZe",
        "img-2.jpg": "https://aka.doubaocdn.com/s/XaLCZDc672",
        "img-3.jpg": "https://aka.doubaocdn.com/s/Nr63bvju52",
    },
    "geo-a07": {
        "img-1.jpg": "https://aka.doubaocdn.com/s/NYxU7Tfihr",
        "img-2.jpg": "https://aka.doubaocdn.com/s/DjQSTFj70h",
        "img-3.jpg": "https://aka.doubaocdn.com/s/pfHxxi9o5W",
    },
    "geo-a08": {
        "img-1.jpg": "https://aka.doubaocdn.com/s/7HVOQBz1iT",
        "img-2.jpg": "https://aka.doubaocdn.com/s/68IUROUxIb",
        "img-3.jpg": "https://aka.doubaocdn.com/s/kQNhMc1sur",
    },
    "geo-b01": {
        "img-1.jpg": "https://aka.doubaocdn.com/s/LWm9mWgI2U",
        "img-2.jpg": "https://aka.doubaocdn.com/s/zdENPsUheC",
        "img-3.jpg": "https://aka.doubaocdn.com/s/SLYqEQzpqb",
    },
    "geo-b02": {
        "img-1.jpg": "https://aka.doubaocdn.com/s/7c5ZbjDcHj",
        "img-2.jpg": "https://aka.doubaocdn.com/s/ybtWBlvUIV",
        "img-3.jpg": "https://aka.doubaocdn.com/s/q1ER325UUy",
    },
    "geo-b03": {
        "img-1.jpg": "https://aka.doubaocdn.com/s/IQJL4PEnd6",
        "img-2.jpg": "https://aka.doubaocdn.com/s/viucXrXNRq",
        "img-3.jpg": "https://aka.doubaocdn.com/s/5JNEDwQeYb",
    },
    "geo-b04": {
        "img-1.jpg": "https://aka.doubaocdn.com/s/89mfuApVx9",
        "img-2.jpg": "https://aka.doubaocdn.com/s/ejUz7E6pSC",
        "img-3.jpg": "https://aka.doubaocdn.com/s/jHqXPa2ewQ",
    },
    "geo-b05": {
        "img-1.jpg": "https://aka.doubaocdn.com/s/NJuP2xfUHh",
        "img-2.jpg": "https://aka.doubaocdn.com/s/cBZ4Fk994E",
        "img-3.jpg": "https://aka.doubaocdn.com/s/yFGQmUjpjm",
    },
    "geo-b06": {
        "img-1.jpg": "https://aka.doubaocdn.com/s/TsWoCUG9uV",
        "img-2.jpg": "https://aka.doubaocdn.com/s/9ChMcPmw6C",
        "img-3.jpg": "https://aka.doubaocdn.com/s/ductVJxWMU",
    },
    "geo-b07": {
        "img-1.jpg": "https://aka.doubaocdn.com/s/nEbK2qVqqp",
        "img-2.jpg": "https://aka.doubaocdn.com/s/U7vm2zSoof",
        "img-3.jpg": "https://aka.doubaocdn.com/s/3SxDTziHdg",
    },
    "geo-c01": {
        "img-1.jpg": "https://aka.doubaocdn.com/s/VootvtGmnj",
        "img-2.jpg": "https://aka.doubaocdn.com/s/2QUCDeUgdx",
        "img-3.jpg": "https://aka.doubaocdn.com/s/pb0hInaNg2",
    },
    "geo-c02": {
        "img-1.jpg": "https://aka.doubaocdn.com/s/1GaBxoY4Y6",
        "img-2.jpg": "https://aka.doubaocdn.com/s/E7lAUXdUBU",
        "img-3.jpg": "https://aka.doubaocdn.com/s/MtXHnvESuq",
    },
    "geo-c03": {
        "img-1.jpg": "https://aka.doubaocdn.com/s/ZEhFUGyvkT",
        "img-2.jpg": "https://aka.doubaocdn.com/s/CVUlsEithT",
        "img-3.jpg": "https://aka.doubaocdn.com/s/Mx1bVqw65o",
    },
    "geo-c04": {
        "img-1.jpg": "https://aka.doubaocdn.com/s/BhaL6RQcnA",
        "img-2.jpg": "https://aka.doubaocdn.com/s/vsqsU7yROv",
        "img-3.jpg": "https://aka.doubaocdn.com/s/otjHIxiL3u",
    },
    "geo-c05": {
        "img-1.jpg": "https://aka.doubaocdn.com/s/f2LxRG7feg",
        "img-2.jpg": "https://aka.doubaocdn.com/s/Uq7EswZJnI",
        "img-3.jpg": "https://aka.doubaocdn.com/s/UKMoqXzsdF",
    },
    "geo-c06": {
        "img-1.jpg": "https://aka.doubaocdn.com/s/AiZSgntbyW",
        "img-2.jpg": "https://aka.doubaocdn.com/s/Fy2LUlZ3TJ",
        "img-3.jpg": "https://aka.doubaocdn.com/s/fUU2VyY5VV",
    },
    "geo-c07": {
        "img-1.jpg": "https://aka.doubaocdn.com/s/hLgzywJ4E2",
        "img-2.jpg": "https://aka.doubaocdn.com/s/ze7R6D4f3J",
        "img-3.jpg": "https://aka.doubaocdn.com/s/qIkv2Am2KU",
    },
    "geo-d01": {
        "img-1.jpg": "https://aka.doubaocdn.com/s/puuAYK70HH",
        "img-2.jpg": "https://aka.doubaocdn.com/s/5rKAe2kdY7",
        "img-3.jpg": "https://aka.doubaocdn.com/s/Xsn7AUql7n",
    },
    "geo-d02": {
        "img-1.jpg": "https://aka.doubaocdn.com/s/VDgFWsSkDY",
        "img-2.jpg": "https://aka.doubaocdn.com/s/iW3fz4BaEo",
        "img-3.jpg": "https://aka.doubaocdn.com/s/jULFz0whQV",
    },
    "geo-d03": {
        "img-1.jpg": "https://aka.doubaocdn.com/s/LR4nvVIzng",
        "img-2.jpg": "https://aka.doubaocdn.com/s/QXbqxZ4cDc",
        "img-3.jpg": "https://aka.doubaocdn.com/s/xnE5sigriq",
    },
    "geo-d04": {
        "img-1.jpg": "https://aka.doubaocdn.com/s/0u5eKo1vdc",
        "img-2.jpg": "https://aka.doubaocdn.com/s/oafRfquLxJ",
        "img-3.jpg": "https://aka.doubaocdn.com/s/UUnpDFnEiF",
    },
}


def download(url, dest):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=60) as resp:
        data = resp.read()
    if len(data) < 5000:
        raise RuntimeError(f"too small ({len(data)}B) for {url}")
    with open(dest, "wb") as f:
        f.write(data)
    return len(data)


def main():
    total = 0
    failed = []
    for slug, files in PLAN.items():
        folder = os.path.join(IMG_ROOT, slug)
        os.makedirs(folder, exist_ok=True)
        for name, url in files.items():
            dest = os.path.join(folder, name)
            if os.path.exists(dest) and os.path.getsize(dest) > 5000:
                continue
            try:
                size = download(url, dest)
                total += 1
                print(f"OK {slug}/{name} {size}B")
            except Exception as exc:  # noqa: BLE001
                failed.append((url, str(exc)))
                print(f"FAIL {slug}/{name} {exc}")
    print(f"downloaded {total} new files, {len(failed)} failed")
    for url, err in failed:
        print("  failed:", url, err)


if __name__ == "__main__":
    main()
