# 菲邦国际物流 · 宣传片 v1（HyperFrames）

49.8 秒、1920×1080、中文、无旁白、本地合成配乐。用 [HyperFrames](https://github.com/heygen-com/hyperframes) 的 `product-launch-video` 工作流制作，全部离线可渲染（GSAP、字体、地图、配乐都在 `assets/` 里，不访问网络）。

| # | 镜头 | 时长 | 文件 |
|---|---|---|---|
| 1 | 痛点：清关卡住 / 价格说不清 / 时效没个准 | 5.4s | `compositions/frames/01-pain.html` |
| 2 | 字标登场：菲邦国际物流 · PHIBONG | 4.8s | `02-brand.html` |
| 3 | 航线地图：海运约 15 天、空运约 3 天 | 9.6s | `03-route.html` |
| 4 | 价格：海运 ¥700/立方米起、空运 ¥22.5/公斤起 | 7.2s | `04-price.html` |
| 5 | 流程：下单 → 入仓 → 出口报关 → 运输 → 菲律宾清关 → 送货上门 | 8.4s | `05-process.html` |
| 6 | 保障：99% 清关成功率、实时追踪、货物保险、自营专线 | 7.2s | `06-trust.html` |
| 7 | 结尾：中国发菲律宾，就找菲邦 · www.phibong.com | 7.2s | `07-cta.html` |

## 发布前必须确认

片中的价格、时效、99% 清关成功率、“自营专线、不经中间商”，都来自搜索引擎对 phibong.com 的摘要（制作环境打不开官网），**需要菲邦书面确认后再发布**。没有用官方 logo（手上没有文件），字标是文字排版。

## 重新渲染

```bash
cd videos/phibong-promo
npx hyperframes@0.8.91 check                                   # lint + 运行时 + 版式 + 对比度
npx hyperframes@0.8.91 snapshot --at 1.8,7,17.5,24,32,40,46    # 抽帧检查
npx hyperframes@0.8.91 render --quality high --output renders/phibong-promo-v1.mp4
```

- 改文案：直接改对应镜头 HTML 里的文字。字体是 GB2312 一级字库子集（3755 个常用字），生僻字需要重新子集化 Noto Sans SC。
- 改配乐：`python3 scripts/make-bgm.py /tmp/track.wav`，再用 ffmpeg 转成 `assets/bgm/track.m4a`（100 BPM，段落对齐镜头边界）。
- 改结构：改 `STORYBOARD.md` 后按 product-launch-video 工作流重新组装：`assemble-index.mjs` → 把 `index.html` 里的 GSAP 改回 `assets/vendor/gsap.min.js` → `transitions.mjs inject`。

## 素材与许可

- 字体：Noto Sans SC（SIL OFL 1.1，见 `assets/fonts/OFL-NotoSansSC.txt`）
- 地图：world-atlas（Natural Earth，公有领域）预投影，只画合并陆地、不画国界
- 动画：GSAP 3.14（免费商用）；图标、配乐为本项目自制
