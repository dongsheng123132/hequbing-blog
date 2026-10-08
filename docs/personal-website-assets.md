# 贺去病个人官网视觉素材

- 生成方式：内置 image_gen，2026-10-08。
- 用途：首版首页的装饰性概念视觉；真人照片上线后保留为素材存档。真人照片与清晰度增强见 `personal-portrait-assets.md`。
- 最终资产：`public/images/hequbing-ai-studio-hero.png`
- 尺寸：1536 × 1024 像素。
- 原始资产：`C:/Users/ZhuanZ/.codex/generated_images/01a11aba-119b-7c21-9736-4ed937af03e5/exec-1011258b-891f-4efd-82ef-3d5b7a2582a9.png`

## 最终提示词

Use case: stylized-concept
Asset type: homepage hero art for a premium independent AI product creator and consultant's personal portfolio.
Primary request: a refined, memorable sculptural still life that suggests ideas becoming usable systems.
Scene/backdrop: seamless warm off-white #f6f5f1 ground and background, calm architectural studio.
Subject: an elegant modular sculpture made from interlocking open rectangular frames and geometric bridge-like elements, translucent deep emerald green glass alternating with brushed titanium metal. One small warm copper sphere nestled at a precise junction. A few elements, one coherent sculptural composition, sophisticated and physically plausible.
Style/medium: premium editorial product photography of a 3D art object, photorealistic material rendering, subtle glass refraction, fine brushed metal texture, beautiful bevels, museum-quality design.
Composition/framing: wide landscape 3:2 image, sculpture centered, three-quarter slightly elevated view, moderate generous negative space around the subject, full object in frame with comfortable margins, composition with depth and diagonal balance.
Lighting/mood: soft natural side light from the upper left, realistic quiet shadows, restrained architectural elegance.
Color palette: warm white, deep emerald, soft titanium silver, one small warm copper accent.
Constraints: decorative concept art, no text, no lettering, no logo, no watermark, no people, no UI, no fake product screens, no brain imagery, no circuits, no neon, no excessive decoration.

## 微信二维码

- 用户于 2026-10-08 提供并明确要求展示的本人微信名片，逐字节保留原图，不裁切或重绘。
- 站内资产：`public/images/hequbing-wechat-original.jpg`，888 × 1131 像素。
- SHA-256：`2f4dc8cbb2261936742c3da67224d6b22bed52acd7e95fdf8c81b84b91bcef8d`。
- 首页、关于页及全站联系组件共用此文件；点击放大与下载均指向同一原图。

## 模板与构建

- `lib/personal-pages.js` 是中英文首页与关于页的唯一模板源，勿手改四份生成页面。
- `scripts/contact-block.js` 生成所有联系卡片；`public/site.js` 处理复制、图片查看及菜单。
- 修改模板后运行 `npm run build`，并逐个运行 `node tests/site.test.cjs`、`node tests/contact.test.cjs`。

## 新增作品封面

- U-Claw：`public/images/uclaw-project-concept.webp`，来源 https://raw.githubusercontent.com/dongsheng123132/u-claw/main/assets/readme/hero-image2.png 。公开仓库既有项目概念图，1672 × 941，网页按 quality 90 编码为 WebP，不作为实物照片。
- OpenCodex：`public/images/opencodex-workspace-example.png`，来源 https://raw.githubusercontent.com/dongsheng123132/opencodex/main/docs/screenshot-main.png 。保留 2880 × 1700 原图，图内 v0.3.5，仅作为仓库界面示例，不声称是最新版。
- 文案以两个公开仓库 2026-10-08 的 README 为依据；U-Claw 描述便携 U 盘工作空间，OpenCodex 标注早期版本，不搬用旧官网的功能数量、体积或离线能力承诺。
