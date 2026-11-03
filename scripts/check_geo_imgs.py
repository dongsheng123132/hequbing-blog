# -*- coding: utf-8 -*-
import json
import os
import re

posts = json.load(open(r"C:\Users\ZhuanZ\DoubaoWork\chats\2026-09-30\new-chat-5\hequbing-blog-deploy\scripts\posts-new.json", encoding="utf-8"))
base = r"C:\Users\ZhuanZ\DoubaoWork\chats\2026-09-30\new-chat-5\hequbing-blog-deploy\public"
bad = []
for p in posts:
    imgs = re.findall(r'<img src="(/images/geo/[^"]+)"', p["content"])
    n = len(imgs)
    missing = [s for s in imgs if not os.path.exists(base + s)]
    print(p["slug"], n, "imgs", ("MISSING:" + str(missing) if missing else ""))
    if n < 3 or missing:
        bad.append(p["slug"])
print("BAD:", bad)
