---
format: 1920x1080
duration: 50s
message: "中国发菲律宾，找菲邦专线：双清包税、门到门、价格透明"
arc: Pain → Brand → Route → Price → Process → Guarantees → CTA
audience: 需要从中国往菲律宾发货的中小企业主、跨境电商卖家和在菲华人
mode: autonomous
music: calm confident corporate pulse, 100 BPM, bright piano plucks over warm pads, light kick and hats; builds from the brand reveal, resolves on the end card
tempo: 100 BPM — one beat = 0.6s, one bar = 2.4s; every reveal lands on a beat (multiples of 0.6s from the frame start)
---

# 菲邦国际物流 · 品牌宣传片 v1

## Video direction

- **Palette** (from `frame.md`, never invented): cream canvas `bg #fdfae7` on every frame; cobalt `primary #1e2bfa` is the only accent — eyebrows, numerals, routes, icons, pills, the one solid CTA pill; headlines near-black `text #111111`; secondary copy `text-muted #6b6b6b`; footnotes `text-light #9a9a9a`. Cards are `card-tinted` (cobalt 4% fill, 1.5px cobalt-20% border, 14px radius, no shadow). The map's land mass is filled `accent-medium` (cobalt 15%) — no borders, no country highlighted.
- **Type**: Noto Sans SC only, loaded from `assets/fonts/` via the `@font-face` block in `frame.md` (weights 400/500/700/900). Headlines 700/900 at h1/h2 scale; numerals 700–900 cobalt; eyebrows 700 cobalt with the 60×4 accent line. Latin chrome (PHIBONG, MANILA, www.phibong.com) uses the same family.
- **Motion grammar**: long-tail eases (`power3.out` default, `back.out(1.4)` only for spring-pop pills/nodes); reveals are **beat-paced, not front-loaded** — there is no narration, so every piece lands on a 0.6s music beat, spreading reveals across each frame's full duration and its back half. A resolved frame **holds still** (no lazy breathing, no drift); the only continuous motion allowed during a hold is a vehicle finishing its path or a single pulsing location dot (finite repeat).
- **Rhythm / held frames**: F2 (brand) and F7 (end card) are the calm, held beats; F3 (route map) is the longest, busiest shot; F4–F6 alternate dense reveal → hub.
- **Negative list**: no stock photos, no fake logo (the wordmark is typeset text), no country borders or national colors on the map, no superlatives (最/第一/唯一), no gradients-as-decoration, no drop shadows, no emoji. Both motion failure modes are banned: slideshow (everything at t=0 then frozen) and screensaver (everything floating independently).
- **Assets**: all shared files live under `assets/` (fonts, `map/east-asia.svg` + `map/points.json`, `icons/*.svg` line icons drawn with `stroke="currentColor"`). Icons are inlined as SVG markup (copy the file's `<path>`/`<circle>` children into an inline `<svg viewBox="0 0 48 48">`) so they can take `color: var(primary)` and be animated.
- **Captions**: disabled (no narration). Keep all content above y = 900 anyway.

## Frame 1 — 痛点

- scene: 三句发货痛点逐一砸到屏幕中央，最后被一条钴蓝线划掉
- duration: 5.4s
- poster: 4.9s
- transition_in: cut
- status: animated
- src: compositions/frames/01-pain.html
- type: pain_point
- beat: frustration
- blueprint: kinetic-type-beats (Adapt — Problem variant `problem-kinetic-type-beats`)
- focal: the pain line currently on screen
- roles: text-only frame, no assets
- rules: kinetic-beat-slam, svg-path-draw
- asset_candidates: none (typography only)

Adapt: keep the signature — each pain statement lands ALONE, center screen, on its own beat, replacing the previous by hard cut; change the payoff from a spring-pop element to a strike-through that crosses out all three at once (sets up "菲邦 solves this").

Scene 1 (0.0–1.2s): cream field. Centered, ~40% of frame: small cobalt eyebrow `发货到菲律宾` with the 60×4 accent line above it, then on the next beat (0.6s) the h1 question `最怕什么？` slams in below it (kinetic-beat-slam: scale 1.15→1 + opacity, heavy ease). Two-line centered stack.
Scene 2 (1.2–2.4s): hard cut — the question clears; `清关卡住` slams in alone, dead center, display scale (~9cqw, weight 900, near-black). Holds.
Scene 3 (2.4–3.6s): hard cut — `价格说不清` replaces it, same slot, same slam.
Scene 4 (3.6–4.2s): hard cut — `时效没个准` replaces it, same slot, same slam.
Scene 5 (4.2–5.4s): the three statements re-appear together as a compact left-aligned stack (h2 scale, muted gray) in the center column; on the next beat a single cobalt stroke draws left→right through each line in turn (svg-path-draw, 3 strokes staggered one beat-third apart). Holds to the cut.

## Frame 2 — 菲邦登场

- scene: 字标“菲邦国际物流”逐字落位，下方 PHIBONG 与专线标签依次出现
- duration: 4.8s
- poster: 4.2s
- transition_in: blur-crossfade
- status: animated
- src: compositions/frames/02-brand.html
- type: product_intro
- beat: reveal
- blueprint: logo-assemble-lockup (Adapt)
- focal: the typeset wordmark 菲邦国际物流
- roles: wordmark = hero (typeset text, not an image) · atmosphere = background (cover atmosphere from frame.md: clipped diagonal cobalt-tint panel + 3×3 dot grid)
- rules: waterfall-entry, svg-path-draw, spring-pop-entrance
- asset_candidates: none (typeset wordmark)

Adapt: keep the signature — the brand mark COMES TO EXIST on screen built from parts (letters cascade in one by one) and resolves into a centered lockup that holds; there is no logo file, so the "parts" are the six characters of the wordmark.

Scene 1 (0.0–1.2s): cream field with the cover atmosphere fading up at the right edge (diagonal cobalt-tint panel, dot grid, both very subtle). A cobalt 60×4 accent line draws on above center, then the six characters `菲邦国际物流` cascade in left→right (waterfall-entry: each rises ~24px and fades in, staggered ~0.08s) — centered lockup, h1 scale ×1.4, weight 900, near-black.
Scene 2 (1.2–2.4s): on the beat, `PHIBONG` in wide-tracked (0.4em) cobalt capitals fades up beneath the wordmark (weight 700, eyebrow scale ×1.6).
Scene 3 (2.4–3.6s): a solid cobalt pill springs in under it (spring-pop-entrance) reading `中国 → 菲律宾 · 专线物流` in cream text.
Scene 4 (3.6–4.8s): held lockup — stillness is the payload.

## Frame 3 — 专线航线

- scene: 东亚地图上画出中国到马尼拉的海运与空运两条航线，右侧卡片给出时效
- duration: 9.6s
- poster: 9.0s
- transition_in: crossfade
- status: outline
- src: compositions/frames/03-route.html
- type: feature_showcase
- beat: capability
- blueprint: compose
- focal: assets/map/east-asia.svg
- roles: east-asia.svg = background (full-bleed land silhouette, fill accent-medium) · ship.svg / plane.svg = supporting (vehicles riding the routes) · info cards = foreground (right column)
- rules: svg-path-draw, spring-pop-entrance, counting-dynamic-scale, ambient-glow-bloom
- asset_candidates: assets/map/east-asia.svg, assets/map/points.json, assets/icons/ship.svg, assets/icons/plane.svg, assets/icons/pin.svg

Compose: the map IS the stage; one route at a time draws itself and a vehicle rides it, while the matching fact card lands in the right column on the same beat. Use the pixel coordinates in `assets/map/points.json` (same 1920×1080 space as the SVG viewBox): origin `china-origin` (714.4, 252.2), destination `manila` (1163.5, 778). Sea route = smooth curve origin → `hk-exit` (790.4, 340.8) → `scs-mid` (954.2, 619.9) → `manila-bay` (1138.3, 787) → manila, dashed cobalt stroke. Air route = a single high arc origin → manila bowing up and to the right (control point around (1080, 330)), solid thin cobalt stroke.

Scene 1 (0.0–1.2s): the land silhouette fades in full-bleed with a very slight scale settle (1.03→1); a cobalt origin dot pops at china-origin with a label chip `中国` above-left of it.
Scene 2 (1.2–2.4s): the destination dot pops at manila with a pulsing ring (finite repeat) and label chip `马尼拉 MANILA` to its right.
Scene 3 (2.4–5.4s): the sea route draws itself origin → Manila (svg-path-draw) while the ship icon rides the path to Manila; on the same beat, card 1 lands top-right (right column, x ≈ 1340–1840): ship icon · `海运` · big cobalt numeral counting up to `15` + `天` suffix (counting-dynamic-scale) · muted sub-line `约 15 天 · 马尼拉`.
Scene 4 (5.4–8.4s): the air arc draws itself above the sea route while the plane icon flies it nose-first (auto-rotate along the path); card 2 lands under card 1: plane icon · `空运` · numeral counting up to `3` + `天` · sub-line `约 3 天 · 马尼拉`.
Scene 5 (8.4–9.6s): a cobalt pill springs in under the two cards: `双清包税 · 送货到门`; Manila's ring gives one soft glow bloom as both vehicles have arrived. Hold.

## Frame 4 — 价格透明

- scene: 两张价格卡：海运每方 700 元起、空运每公斤 22.5 元起，数字滚动到位
- duration: 7.2s
- poster: 6.8s
- transition_in: push-slide LEFT
- status: animated
- src: compositions/frames/04-price.html
- type: feature_showcase
- beat: proof
- blueprint: dataviz-countup (Adapt)
- focal: the two count-up price numerals
- roles: ship.svg / plane.svg = supporting icons on the cards · price cards = foreground
- rules: counting-dynamic-scale, spring-pop-entrance, waterfall-entry
- asset_candidates: assets/icons/ship.svg, assets/icons/plane.svg

Adapt: keep the signature — numbers are the hero and count up to land a hero metric; change the camera push-through into two side-by-side metric cards (split-screen) because the argument is a comparison of two published prices, not one exploding statistic.

Scene 1 (0.0–1.2s): slide-header top-left: cobalt eyebrow `公开报价` with accent line; h2 `价格透明，按量计费` fades up on the next beat. Upper third.
Scene 2 (1.2–3.6s): left card (split-screen 50/50, card-tinted, ~40% of frame each) rises in: ship icon + `海运 · 马尼拉`; the metric numeral counts `¥0 → ¥700` (counting-dynamic-scale, tabular numerals) with unit `/立方米起` and tag `普货`; at 3.0s two quiet rows cascade in at the card's foot: `敏感货 ¥800/立方米` · `特货 ¥900/立方米`.
Scene 3 (3.6–6.0s): right card rises in: plane icon + `空运 · 马尼拉`; numeral counts `¥0 → ¥22.5` with unit `/公斤起`; foot row `约 3 天到达`.
Scene 4 (6.0–7.2s): footnote in text-light under the cards: `价格以官网实时报价为准`. Hold.

## Frame 5 — 一站式流程

- scene: 六个节点沿一条线依次点亮：下单、入仓、出口报关、运输、菲律宾清关、送货上门
- duration: 8.4s
- poster: 7.9s
- transition_in: push-slide LEFT
- status: outline
- src: compositions/frames/05-process.html
- type: benefit_highlight
- beat: ease
- blueprint: grid-card-assemble (Adapt)
- focal: the six-node process track
- roles: box / warehouse / doc / ship / check / truck icons = supporting (one per node)
- rules: svg-path-draw, spring-pop-entrance, waterfall-entry
- asset_candidates: assets/icons/box.svg, assets/icons/warehouse.svg, assets/icons/doc.svg, assets/icons/ship.svg, assets/icons/check.svg, assets/icons/truck.svg

Adapt: keep the signature — N items self-assemble in a staggered cascade into one array and hold; change the grid into a single horizontal track (full-width strip) whose connector line draws across and "lights" each node as it reaches it.

Scene 1 (0.0–1.2s): slide-header top-left: eyebrow `一站式服务`; h2 `下单到签收，一条线走完` on the next beat.
Scene 2 (1.2–6.0s): a thin cobalt track line draws left→right across the frame's middle band (full-width strip, y ≈ 0.52 × height); six step nodes spring-pop onto it one per 0.8s exactly as the line reaches them — each node = 96px cobalt step-circle holding a cream line icon, a small counter `01`–`06` above, and a label below: `下单` · `入仓` · `出口报关` · `海运 / 空运` · `菲律宾清关` · `送货上门`. Earlier nodes dim to the step-circle opacity ladder as later ones light (1.0 → 0.85 → 0.7 …), the newest always full cobalt.
Scene 3 (6.0–7.2s): two cobalt brackets draw above nodes 03 and 05 with a shared pill `双清包税` springing in between them; a second pill `全程可追踪` springs in under the whole track.
Scene 4 (7.2–8.4s): hold.

## Frame 6 — 放心交给菲邦

- scene: 中心“菲邦”圆环，四个保障节点依次弹出：99% 清关成功率、实时追踪、货物保险、自营专线
- duration: 7.2s
- poster: 6.8s
- transition_in: blur-crossfade
- status: animated
- src: compositions/frames/06-trust.html
- type: social_proof
- beat: reassurance
- blueprint: constellation-hub (Adapt)
- focal: the hub with 菲邦
- roles: check / pin / shield / route icons = supporting (one per node) · hub = hero
- rules: spring-pop-entrance, svg-path-draw, counting-dynamic-scale, multi-phase-camera
- asset_candidates: assets/icons/check.svg, assets/icons/pin.svg, assets/icons/shield.svg, assets/icons/route.svg

Adapt: keep the signature — iconned nodes spring into a ring around a center and the shot resolves on the core with a slow camera push-in; change the satellites into four guarantee cards (card-tinted) on the ring's diagonals, each tethered to the hub by a connector line.

Scene 1 (0.0–1.2s): centered: a solid cobalt hub circle (~220px) springs in holding `菲邦` in cream (weight 900); a thin orbit ring draws around it.
Scene 2 (1.2–4.8s): four guarantee cards spring-pop one per 0.9s, clockwise from top-left, each with its connector line drawing from the hub: (1) check icon · numeral counting up to `99%` · `清关成功率`; (2) pin icon · `实时追踪` · `货到哪一步随时查`; (3) shield icon · `货物保险` · `丢损有保障`; (4) route icon · `自营专线` · `不经中间商`. Cards sit on the ring's four diagonals (quadrants), text left-aligned inside each card.
Scene 3 (4.8–7.2s): slow camera push-in toward the hub (multi-phase-camera, ~1.00 → 1.04), then still. Hold.

## Frame 7 — 联系菲邦

- scene: 结尾卡：“中国发菲律宾，就找菲邦”，落到字标与官网网址
- duration: 7.2s
- poster: 6.6s
- transition_in: crossfade
- status: animated
- src: compositions/frames/07-cta.html
- type: cta
- beat: resolve
- blueprint: titlecard-reveal (Reproduce — card-chain variant)
- focal: the URL pill www.phibong.com
- roles: wordmark = hero · URL pill = CTA (the one solid cobalt element) · concentric closing rings = background atmosphere
- rules: spring-pop-entrance, gradient-text-sweep
- asset_candidates: none (typeset)

Scene 1 (0.0–2.4s): statement card — centered two-line title `中国发菲律宾` / `就找菲邦` (second line cobalt) revealed with one slide-up crossfade; holds.
Scene 2 (2.4–4.8s): hard cut to the end card — closing atmosphere (concentric cobalt rings, very faint) behind a centered lockup: `菲邦国际物流` (h1, weight 900) over `PHIBONG · 中国 → 菲律宾专线物流` (muted); on the next beat the solid cobalt URL pill `www.phibong.com` springs in beneath (spring-pop-entrance).
Scene 3 (4.8–7.2s): hold the end card to the final frame; as the final frame this may settle with a gentle fade of the rings only in the last 0.6s — the lockup and URL stay fully visible to the end.
