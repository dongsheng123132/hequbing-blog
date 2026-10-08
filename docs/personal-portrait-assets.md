# 贺去病演讲照片清晰度增强

- 日期：2026-10-08。
- 执行方式：内置 image_gen edit，原图先通过 view_image 检视，单次生成后对照检查。
- 原图：`public/images/hequbing-speaking-original.jpg`，940 × 939，69,011 字节，直接复制且保留原始文件哈希。
- 增强图：`public/images/hequbing-speaking-enhanced.png`，1254 × 1254，2,244,598 字节。
- 检视：五官整体、发型、目光、说话表情、体态、手与话筒、灰夹克和背景均保留，未见明显身份漂移。发丝、面部、夹克与话筒的细节变清晰；生成式增强会重建细小纹理，不能当作原始摄影细节的证据。
- 尺寸边界：提示词请求尽可能至少 1536 方图，工具实际返回 1254 方图；较原图像素数约增加 1.78 倍。原图近方形比例为 940:939，输出为 1:1，未见构图偏移。

## 最终提示词

Use case: identity-preserve
Asset type: restored source photograph for the subject's personal website hero.
Edit target: the attached original photograph of a man speaking into a handheld microphone while his other arm extends beyond the right edge.
Primary request: conservatively enhance the clarity and resolution of THIS EXACT PHOTOGRAPH. Output a high resolution square image at least 1536 by 1536 if possible. This is photo restoration and upscaling, not a new portrait.
Change only: gently reduce JPEG compression artifacts and faint noise, recover subtle existing edges and natural detail in hair, eyes, jacket fabric and microphone. Keep sharpening restrained, with no halos and no invented texture.
Strict identity invariants: preserve the subject's exact facial shape, head proportions, hairstyle and hairline, eye shape and gaze direction, eyebrows, nose, lips, open speaking mouth and teeth, ears, skin tone, apparent age, natural asymmetry, and facial expression. Do not beautify, smooth or reshape the face. Do not make the subject younger.
Strict scene invariants: preserve the exact body posture and proportions, both arms and hand positions, hand holding the same silver microphone with black foam and orange ring, same gray fleece jacket and sleeve patch, same dark shirt, same light wall on the left and slate wall on the right, same shadows and illumination. Preserve the original framing, crop, relative dimensions, camera perspective and near-square aspect ratio. Do not extend, recompose, mirror, recolor or relight the image.
Constraints: no new elements, no text, no watermark, no stylization, no background replacement, no cutout, no beauty retouch, no skin plasticity. Where detail is ambiguous, keep it soft instead of inventing features. The final should look like the original photograph with only modest technical restoration.


## 网页交付

- 页面使用 `public/images/hequbing-speaking-enhanced.webp`，由增强母版按 quality 92 转码为 WebP，保留 1254 × 1254 尺寸；仅做网页编码，不再修图。
- 原始照片与增强 PNG 母版均保留。真人照片用于首页及分享卡片；主页模板仍为 `lib/personal-pages.js`。
