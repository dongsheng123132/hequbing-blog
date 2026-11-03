# -*- coding: utf-8 -*-
import json

REPO = r"C:\Users\ZhuanZ\DoubaoWork\chats\2026-09-30\new-chat-5\hequbing-blog-deploy"
posts_path = REPO + r"\data\posts.json"
new_path = REPO + r"\scripts\posts-new.json"

posts = json.load(open(posts_path, encoding="utf-8"))
new_posts = json.load(open(new_path, encoding="utf-8"))
new_by_slug = {p["slug"]: p["content"] for p in new_posts}

changed = 0
for p in posts:
    if p["slug"] in new_by_slug:
        if p["content"] != new_by_slug[p["slug"]]:
            p["content"] = new_by_slug[p["slug"]]
            changed += 1

with open(posts_path, "w", encoding="utf-8") as f:
    json.dump(posts, f, ensure_ascii=False, indent=2)

print("posts total:", len(posts), "| content changed:", changed)
