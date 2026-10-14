# 奶绒小熊 · 原创内置主题素材

使用内置 `image_gen` 工具生成，参考图仅用于质感、配色与拼贴风格参考。没有裁切参考图作为产品图片。

- `lock.webp`：原创奶油毛绒玩偶拼贴锁屏壁纸。
- `fleece.webp`：原创象牙白羊羔绒桌面底纹。
- `toy-1.webp` 至 `toy-16.webp`：原创玩偶图标与组件照片，来自同一次生成的 4×4 图集。
- 图片共约 690 KiB，全部随应用内置，不依赖外部图片服务。
- `scripts/prepare-plush-theme-assets.cjs` 只负责图集切片、尺寸调整与 WebP 编码。

## 生成提示词

### 锁屏（参考图作为风格输入）

Create an ORIGINAL portrait phone LOCK SCREEN WALLPAPER bitmap, inspired by the supplied reference aesthetic, not a screenshot or UI mockup. A creamy ivory sherpa fleece background with photoreal tactile fibers. Top 30 percent has only subtle ivory fleece and generous EMPTY SPACE for real live clock UI. Lower 70 percent is a charming editorial flat-lay scrapbook collage of handmade plush toys: ivory sleepy bunny, chocolate brown shaggy round bear, tiny beige teddy wearing striped scarf, stitched linen stars with dark cross stitches, long soft ivory ribbon, small brown gingham washi tape, subtle white-bordered mini photo prints tucked near the corners. Cozy desaturated cream/taupe/cocoa palette, soft daylight, slightly vintage candid photography, visibly fluffy real textile fibers, gentle shadows. Avoid text, letters, numbers, icons, interface, phone frame, clock, watermarks, or brands. Full bleed portrait 9:19 composition suitable for a 390x844 phone. Reference is STYLE ONLY; generate entirely original toys and arrangement.

### 图集

Generate one square production ICON SPRITE SHEET ASSET. EXACTLY 4 columns x 4 rows equal square cells, tightly tiled edge to edge, NO gaps, no dividers. Sixteen original different monochrome creamy plush themed app tile images. EACH CELL contains a central softly photographed handmade plush object filling 70% of its cell, on warm ivory background with sparse tiny taupe polka dots. Each tile must stand alone when cut on precise quarter lines. Subjects in row order: 1 two tiny teddy bears cuddling, 2 stitched star, 3 open linen notebook with bunny charm, 4 teddy with wool scarf; row2 5 bunny with brown ribbon, 6 teddy holding book, 7 soft fabric purse, 8 teddy holding wooden game controller; row3 9 sleeping bunny on crescent cushion, 10 bear peeking, 11 teddy in miniature canvas bag, 12 little teddy leaning on book; row4 13 soft vintage camera, 14 brown plush bear with headphones, 15 ivory bunny with little flower, 16 fluffy chocolate shaggy round bear. Tactile realistic fuzzy fibers, ivory, oat, taupe, cocoa, very desaturated, gentle daylight with airy milky highlights. Consistent framing and SCALE in all 16 cells. Square outer image. No text or numbers, no letters, brands, symbols, UI labels, border, margins or phone. Cute collectible cozy nostalgic handmade toys.

### 桌面底纹

Create a single seamless photoreal texture bitmap for a phone HOME SCREEN WALLPAPER: creamy ivory sherpa fleece / teddy boucle fabric seen directly from above. Natural soft fluffy dense tiny wool loops and delicate fibers. Warm off-white (#edeade) with gentle light taupe shadows. Soft diffuse daylight, even lighting and contrast over entire image. Cozily tactile and realistic like the fluffy white background in a plush teddy scrapbook. Perfectly flat, uniform density, no folds, no objects, no borders, no graphics, no text. Full square image, repeatable texture. Not gray, not yellow, avoid overly big fiber knots.
