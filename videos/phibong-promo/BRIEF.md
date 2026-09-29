---
workflow: product-launch-video
flow: automation
storyboard: no
message: "中国发菲律宾，找菲邦专线：双清包税、门到门、价格透明"
destination: website
aspect: 1920x1080
language: zh
audience: 需要从中国往菲律宾发货的中小企业主、跨境电商卖家和在菲华人
length: 50s
angle: problem-solution
narration: no
capture: no
---

## Intent

菲邦国际物流（www.phibong.com）的第一版品牌宣传片，放在官网首页和 B 站。用户原话：“用 HyperFrames 先做一版菲邦宣传片”——先出一版看效果，不停下来问问题（autonomous）。

基调：可靠、干净、专业，像一份咨询公司的简报，而不是喧闹的促销片。先点出往菲律宾发货的痛点，再给出菲邦的答案：专线直达、海运/空运两种时效、公开价格、双清包税、全程可追踪。

## Assets

- assets/fonts/NotoSansSC-*.woff2 — Noto Sans SC 子集（GB2312 一级字库 + ASCII），全片中文字体（OFL 许可，见 OFL-NotoSansSC.txt）。
- assets/map/east-asia.svg — 预投影的东亚陆地轮廓（world-atlas 50m，合并陆地、不画国界），航线镜头的底图。
- assets/icons/*.svg — 自绘线性图标（船、飞机、包裹、仓库、报关单、卡车、定位、盾牌），航线与流程镜头使用。

## Customizations

- 航线镜头：中国 → 马尼拉，海运航线沿海面绘制 + 船沿线移动（约 15 天），空运弧线 + 飞机沿弧线飞行（约 3 天）。
- 价格镜头：数字 count-up。
- 结尾：品牌字标收束 + 官网网址 pill。

## Notes

- 官网 phibong.com 在本会话网络策略下无法访问（403），走 no-capture 路径；事实全部来自搜索引擎对官网的摘要，**发布前需菲邦确认**：
  - 海运马尼拉：普货 700 元/方起，敏感货 800 元/方，特货 900 元/方，全程约 15 天，双清包税到门。
  - 空运马尼拉：22.5 元/公斤起，约 3 天。
  - 清关成功率 99%；实时物流追踪；一站式清关；门到门；货物保险；自营专线、不经中间商。
- 没有官方 logo 文件和品牌色：字标用文字排版（“菲邦国际物流 / PHIBONG”），不伪造 logo；配色沿用 blue-professional 预设。
- 地图只画合并后的陆地，不画国界、不高亮任何国家（避免领土表述问题）。
- 没有 TTS / HeyGen（网络不可达）：无旁白；配乐为本地合成的轻节奏 BGM。
- 《广告法》：不用“最”“第一”“唯一”等极限词；价格注明“起”，并加“以官网实时报价为准”。
