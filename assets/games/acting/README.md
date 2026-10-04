# 演技派档案纸纹

`archive-paper-v1.webp` 是「谁是演技派」纸质档案、拍立得边框和演出手记使用的纹理。正文、头像、印章和按钮由网页渲染，不包含在纹理中。素材加载失败时保留淡米色底色。

2026-10-01 使用内置 `image_gen.imagegen` 生成，参考用户提供的旧档案纸材质。生成原图保留于 Codex 的 generated_images 目录；项目资源转换为 WebP（quality 85），未改变构图或尺寸。不得在这张纹理上预先烘焙正文或控件。

完整生成提示词：

> Use case: stylized-concept. Asset type: production background TEXTURE for a readable mobile game archive-paper UI. The supplied image is a material reference ONLY. Generate exactly one square 1024x1024 FULL-BLEED flat vintage archive PAPER MATERIAL TEXTURE, evenly illuminated top-down, completely filling image. Warm ivory cream matte paper fibers, soft pale warm-gray flecks and very subtle coffee patina, slight worn fiber grain and extremely faint old fold marks. Understated realistic material like the reference's aged document, but much lighter and less stained to support reading dark body text. Center and entire 90% of area essentially uniform light cream; only subtle darkening at very outer edges, no large stains. NO TEXT, letters, numbers, writing, stamps, lines, images, photos, clips, folders, pens, shadow, objects or borders. No ragged outline: all pixels opaque, edge to edge continuous seamless paper material. No rendered UI or composition, this is a reusable neutral texture swatch. Refined restrained archival cream, natural and believable, not bright yellow, orange or grungy brown.
