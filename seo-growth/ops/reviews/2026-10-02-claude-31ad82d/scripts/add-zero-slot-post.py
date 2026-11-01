# -*- coding: utf-8 -*-
"""海外版《The Zero Slot》启动公告。"""
import json, os, html

BASE = r"C:/Users/ZhuanZ/hequbing-blog"
with open(os.path.join(BASE, "data/posts.json"), encoding="utf-8") as f:
    posts = json.load(f)

content = """
<h3>海外版启动：The Zero Slot</h3>
<p>继中文版《规则怪谈·无限层》之后，第二部「规则/数值可以被机器验证」的 AI 连载小说正式启动——这次是英文，面向全球读者（RoyalRoad / Webnovel 受众）。</p>
<p>2037 年，面板降临。地球上每个人眼前都出现游戏界面：等级、属性、技能、任务。世界变成了游戏，人类开始升级。只有外卖骑手 Kael 的面板上，比别人多出一个空白槽位——<strong>第 0 槽位</strong>。任何鉴定术都读不出它的内容。而每当系统发布版本更新，槽位里就会浮现一个词。</p>
<h3>数值机器可验证：网文「数值崩了」的根治</h3>
<p>LitRPG 读者最恨的一件事：作者把数值写崩了——主角 3 级就能单挑 30 级怪。这部小说从根上解决：<strong>每章的数值账本由机器门禁校验</strong>（str+agi+int+vit+wis+stat_points 必须等于 30+(等级-1)×5），属性点凭空多出来、少掉、等级回退，全部拒稿。已实测：第 2 章主角升级加点后账本精确持平（sum=35=35）。</p>
<p>三章已发布：The Panel Arrives / First Rift / "VERSION"（第 0 槽位浮现第一个词）。</p>
<h3>共创：全球读者都能参与</h3>
<ul>
<li>投票：每周选 Kael 下一站去哪个裂隙/学什么技能</li>
<li>创作：提交技能/装备/裂隙设计（Issue 模板），合入后正文署名 Designer: @你的GitHub</li>
<li>抓虫：查账本——发现哪章数字对不上，报 Ledger Bug，进贡献榜</li>
</ul>
<p>仓库：github.com/dongsheng123132/the-zero-slot（英文 CONTRIBUTING + Issue 模板 + 讨论区）</p>
<h3>两部作品，一个引擎</h3>
<p>中文规则怪谈（约束型恐怖）+ 英文 LitRPG（数值成长）——同一个本象协议引擎跑出两部完全不同的长篇，状态都公开可查。这是「AI 时代的持久对象层」最直接的证明：不是某个题材的专用工具，是通用状态层。</p>
"""

entry = {
    "id": max(p["id"] for p in posts) + 1,
    "slug": "the-zero-slot",
    "title": "The Zero Slot：第二部机器可验证的 AI 连载小说（英文/LitRPG）",
    "date": "2026-08-06",
    "summary": "海外版启动：英文 LitRPG《The Zero Slot》，面板降临全球，主角拥有一个空白的神秘槽位。数值账本由机器门禁逐章校验——网文数值崩了的根治。三章已发，全球共创中。",
    "tags": ["AI小说", "LitRPG", "本象协议", "无限连载", "共创"],
    "content": content.strip(),
}

posts = [p for p in posts if p.get("slug") != entry["slug"]]
posts.append(entry)
posts.sort(key=lambda p: p["id"])
with open(os.path.join(BASE, "data/posts.json"), "w", encoding="utf-8") as f:
    json.dump(posts, f, ensure_ascii=False, indent=2)
print("OK: id=%d slug=the-zero-slot chars=%d" % (entry["id"], len(content)))
