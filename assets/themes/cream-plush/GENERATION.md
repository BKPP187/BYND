# 银粉蕾丝 · 内置主题素材

2026-10-17 使用内置 `image_gen` 重新生成全部图片。用户参考图仅用于配色、材质和排布方向，没有截取参考图作为素材。

旧“奶绒小熊”已由这一套替换。保留 `cream-plush` 路径、存储 ID 和小组件标识，避免已有主题收藏、桌面布局及纪念日失效；这些标识不作为产品名称显示。

- `lock.webp`：重新生成的白蕾丝、缎带兔子和银色播放器锁屏。
- `fleece.webp`：重新生成的白色细波点蕾丝纸张桌面壁纸（兼容旧文件名）。
- `toy-1.webp` 至 `toy-16.webp`：重新生成的透明图标，依次为聊天气泡、相机、手账、齿轮、兔子、月亮、缎带、耳机、花、钱包、手柄、香水、电脑、信封、时钟、心形挂件。
- 全部资源随应用本地提供，无外部图片依赖。没有 Base64 副本。
- `scripts/prepare-plush-theme-assets.cjs` 仅做规则切片、尺寸调整、保留透明通道和 WebP 编码。

## 提示词与生成记录

工具：内置 `image_gen`，未使用 CLI。三个结果原件保存在本次会话的 Codex generated_images 目录，应用只包含最终 WebP。

### 锁屏

Use case: stylized-concept. Asset type: portrait mobile lock-screen wallpaper, no UI. Create an original refined coquette / nostalgic silver-and-blush still life, 1024x1536 portrait. Milk-white, very pale ballet pink, cool silver grey, tiny black details. Upper 45 percent is mostly empty soft white cotton fabric with gentle folds, lots of clean negative space for a live clock. Lower half: a small original white long-eared fabric bunny with bead eyes and a tiny powder-pink satin bow, sitting beside a brushed-silver retro pocket music player and pearl heart charm, on white lace and pink gingham cloth. A few delicate satin ribbons. Editorial close-up still-life photography with tactile textile, translucent plastic and metallic surfaces, airy daylight, subtle shadows. Elegantly restrained, soft but crisp, not yellow/beige, not 3D toy render, no bear, no brand characters, no text, numbers, logos, watermarks or phone frames. Keep entire bunny inside image with generous margins.

原件：`exec-38f8f5e0-03a3-4d93-bca0-c164f1921d00.png`

### 透明图集

Use case: stylized-concept. Asset type: production icon atlas for an original mobile theme called Silver Ribbon, single square 1536x1536 PNG with real transparent background. EXACTLY 16 distinct objects, precisely aligned in a four-column four-row regular grid. Each cell same size, object centered in its cell with generous transparent padding, no overlap, no text, no labels, no grid lines, no base tiles, no colored background. Beautiful delicate miniature product photography / tactile mixed-media sticker objects, milky white, pale ballet pink and brushed silver, crisp silhouette, subtle shadow only immediately under object. Row1: (1) two pale pink pearlescent chat bubbles with tiny silver heart; (2) silver compact digital camera with pink ribbon; (3) miniature ivory open diary with a pink page marker; (4) silver and white gear with pearl center. Row2: (5) original white long-eared bunny fabric doll with pink satin bow; (6) pink glass crescent moon with a tiny silver star; (7) pink satin ribbon bow with flowing tails; (8) silver over-ear headphones with pale pink earcups. Row3: (9) white daisy with silver stem; (10) miniature pink gingham wallet with pearl clasp; (11) silver game controller with pale pink buttons; (12) clear glass perfume bottle with pink bow. Row4: (13) silver miniature vintage CRT computer with blush screen; (14) white envelope sealed with pink heart; (15) silver alarm clock with milk-white face and pink hands; (16) silver winged heart pearl charm. Feminine coquette scrapbook aesthetic, airy bright light, fine materials. No bears, no logos, no watermark. Consistent scale across all 16 objects.

透明背景：true。原件：`exec-158025c5-729c-4164-9595-c8b536d8c13d.png`

### 桌面底纹

Use case: stylized-concept. Asset type: seamless repeatable square mobile HOME wallpaper texture, flat bitmap. Very clean milk-white fine stationery paper (#faf9fa) with evenly spaced tiny charcoal pin dots on a regular sparse 28 pixel grid relative to 1024px square canvas. Dots extremely small, 1.5px radius, grey-black, low visual density. At top and bottom edges only, extremely faint white embroidered scalloped lace, nearly invisible tone-on-tone. Mostly pure open white negative space. Cool neutral white with the faintest pink undertone, no yellow, no beige. No objects, dolls, bows, icons, UI, text, logos, watermark, shadows or large graphics. Perfectly flat evenly lit repeatable paper for delicate silver and pink app icons.

原件：`exec-f053b2b0-d531-42c3-9f32-c6c6a24a879e.png`
