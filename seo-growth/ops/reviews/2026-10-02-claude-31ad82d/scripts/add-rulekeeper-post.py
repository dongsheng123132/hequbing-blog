# -*- coding: utf-8 -*-
"""组装《规则怪谈·无限层》首发博客文章 entry 写入 posts.json。"""
import json, os, html

BASE = r"C:/Users/ZhuanZ/hequbing-blog"
RK = r"D:/uking编程/本象协议/adapters/story/rk/pkg.origin/narrative/chapters"

with open(os.path.join(BASE, "data/posts.json"), encoding="utf-8") as f:
    posts = json.load(f)

def para(text):
    return "".join("<p>%s</p>" % html.escape(line.strip()) for line in text.splitlines() if line.strip())

ch1 = open(os.path.join(RK, "ch01.txt"), encoding="utf-8").read()
ch2 = open(os.path.join(RK, "ch02.txt"), encoding="utf-8").read()
ch3 = open(os.path.join(RK, "ch03.txt"), encoding="utf-8").read()

content = f"""
<h3>这是一部什么样的小说</h3>
<p>2030 年前后，地球上开始随机降临一种异常空间，被官方称作「层」。每个层都有一套规则：遵守规则，活；违反规则，被抹除——不是死亡，而是连存在过的痕迹一起消失，认识你的人不再记得你。</p>
<p>主角林柯是「管理局」第 7 期守规人，专职进入层内救援被困者。这部小说每天自动续写一章，全部由 AI 生成，但有一个其他小说都没有的特点：<strong>层里的规则是机器可验证的</strong>——AI 写作时一旦违反规则，会被门禁直接拒稿，一个字都写不进去。</p>
<p>首发三章已写完：层01·午夜便利店。以下是完整正文，欢迎抓虫。</p>
<h3>世界观</h3>
<ul>
<li><strong>层</strong>：随机降临的异常空间，入口出现有 3 分钟预警。每层一套规则，3-7 条。</li>
<li><strong>规则</strong>：分明规则（入口可读，如「只收现金」）与暗规则（藏在行为里，不遵守才会发现）。违反明规则 = 抹除。</li>
<li><strong>抹除</strong>：比死亡更重的代价——存在痕迹一起消失。</li>
<li><strong>守规人</strong>：被管理局招募、有资格进层的职业。主角是第 7 期。</li>
<li><strong>管理局</strong>：管理层的半官方机构，局长从未露面。</li>
<li><strong>大秘密</strong>：所有层的规则里，藏着同一个词。</li>
</ul>
<h3>规则大典（层01·午夜便利店）——可验证清单</h3>
<p>以下规则已由写作引擎作为约束强制校验，正文出现违反即被机器拒绝：</p>
<ul>
<li>明规则一：只收现金，不提供非现金结算（违禁词：扫码支付/刷卡/手机支付/微信支付/支付宝…）</li>
<li>明规则二：凌晨三点后，店门关闭，灯光熄灭</li>
<li>明规则三：不要数关东煮锅里的东西</li>
<li>暗规则（未写出的）：正文不得出现主角注视特定方向——写作时曾因此被门禁拒稿 2 次</li>
</ul>
<p><strong>主角当前状态（机器可查）</strong>：林柯 SAN=76，已知规则 4 条，持有黑色硬币一枚（背面刻「第七」），规则手册已记录 3 页。伏笔 3 条埋设中。</p>
<h3>第一章 · 午夜便利店（上）</h3>
{para(ch1)}
<h3>第二章 · 不要确认看不见的声音</h3>
{para(ch2)}
<h3>第三章 · 规则讲交易</h3>
{para(ch3)}
<h3>怎么参与共创（五个入口）</h3>
<ul>
<li><strong>留言</strong>：这层的规则你猜对了几条？如果你是守规人，会怎么破？暗规则你发现了吗？</li>
<li><strong>投票</strong>：每周 GitHub Discussions 票选「下周写哪一层」——3 个候选层（深夜食堂/废弃游乐场/旧影院），你的一票决定剧情。</li>
<li><strong>提名</strong>：开 Issue 一句话提名「我想看一个 XX 场景的层」。</li>
<li><strong>创作</strong>：按模板提交完整层设定（层名+3-7 条规则+怪物/物品），合入后下一章可能写你的设计，正文永久署名「层设计者：@你的GitHub」。</li>
<li><strong>抓虫</strong>：检查正文有没有违反规则——抓到 bug 开 Issue 报「规则虫」，进贡献榜。别的小说没法抓虫，这部可以。</li>
</ul>
<p>共创仓库：github.com/dongsheng123132/rulekeeper（参与指南 + Issue 模板 + 讨论区已就绪）</p>
<h3>IP 与边界声明</h3>
<ul>
<li>IP 权属：贺去病。正文、世界观、角色、层设定 canon 版权归作者；共创者贡献按贡献授权条款进入 canon，保留署名权。</li>
<li>技术边界：正文由 AI（deepseek-v4-flash）经本象协议（OriginWriter 引擎）门禁生成，人工策展世界观与规则；规则校验当前为词表级，句子级语义校验在迭代计划中。</li>
<li>叙事技术：这就是「本象协议」——AI 时代的持久对象层。每章是一个语义事务，世界状态公开可查，克隆仓库即可验证。</li>
</ul>
<h3>下一章预告</h3>
<p>层02·电梯公寓即将开始。凌晨 3:00 之后，管理局驻点的电话又响了……（候选层投票已开：深夜食堂 / 废弃游乐场 / 旧影院）</p>
"""

entry = {
    "id": max(p["id"] for p in posts) + 1,
    "slug": "rulekeeper",
    "title": "《规则怪谈·无限层》：一部规则可以被机器验证的 AI 连载小说",
    "date": "2026-08-06",
    "summary": "近未来世界随机降临异常空间「层」，每层一套规则，违反即被抹除。AI 每天续写一章，规则由机器门禁强制校验——违反规则就拒稿。首发三章 + 世界观 + 共创入口。",
    "tags": ["AI小说", "规则怪谈", "本象协议", "无限连载", "共创"],
    "content": content.strip(),
}

# 去重：同 slug 已存在则替换
posts = [p for p in posts if p.get("slug") != entry["slug"]]
posts.append(entry)
posts.sort(key=lambda p: p["id"])

with open(os.path.join(BASE, "data/posts.json"), "w", encoding="utf-8") as f:
    json.dump(posts, f, ensure_ascii=False, indent=2)

print("OK: id=%d slug=rulekeeper content_chars=%d posts=%d" % (entry["id"], len(content), len(posts)))
