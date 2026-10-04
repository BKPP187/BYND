# 小屋初始 Q 版立绘

## 与 3D 人物一致的设置预览（2026-10-03）

`model-user-preview-v1.png` 为兔耳蓝裙女生，`model-char-preview-v1.png` 为银发男生。两张透明预览直接由已打包的 `bunny-blue-v1/near.glb` 和 `silver-red-v1/near.glb` 渲染，保留实际模型的比例、服装和材质。可通过 `node scripts/render-home3d-model-previews.cjs` 重建；不调用生图或模型生成服务。

`initial-model-previews.js` 镜像原 PNG 字节，供 Android/file-origin 加载。小屋设置在选择 3D 人物、且没有用户保存的立绘或待确认草稿时，使用这些预览。用户保存的立绘和草稿优先显示；选择 2D 立绘时仍显示相应的 2D 资产。下面的 v1 立绘仅是独立的 2D 备选形象，不代表当前 3D 模型。

Created on 2026-09-27 with Codex's built-in `image_gen` tool, using `transparent_background: true`. No CLI fallback was used. These are generic initial game portraits, not personalized images of the user or any bound character. Their original transparent PNG bytes are preserved unchanged.

- `default-user-v1.png`: initial user illustration, peach cardigan and cream skirt.
- `default-char-v1.png`: initial character illustration, sage sweater and cream trousers.
- `initial-portraits.js`: exact PNG bytes encoded as classic-script data URLs, lazy-loaded by the home. This supports WebGL image uploads on ordinary `file://` browser origins. When deliberately replacing a versioned initial PNG, regenerate this mirror from the selected PNGs.

These illustrations are generated project assets, not downloaded third-party geometry or CC0 furniture. No external author attribution was supplied by the generation tool. Personalized images are generated only on request through BYND's configured image provider; the user's own reference must be selected inside the home, and the character reference comes from chat settings.

## Exact prompt: default-user-v1.png

```text
A single adorable full-body chibi young woman game character, approximately 2.5 heads tall, large beautifully painted honey-brown eyes with sparkling highlights, soft round rosy cheeks, tiny mouth, cream and peach knitted cardigan, cream pleated skirt, tiny rounded cream shoes, soft chestnut shoulder-length hair with a small peach ribbon. Neutral gentle standing pose, arms relaxed slightly separated from body, front-facing with a tiny three-quarter turn. High quality polished soft 3D-style illustration for a warm cozy miniature dollhouse life simulator; refined cute collectible art toy, soft pastel colors, warm diffuse light. Silhouette and facial details must be crisp and charming even at 90 pixels tall. The entire character including feet visible, small transparent margin. Isolated transparent background, no floor, no cast shadow, no text, no frame, no other objects or people. This is a generic initial avatar, not a portrait of a real person.
```

## Exact prompt: default-char-v1.png

```text
A single adorable full-body chibi young man game character, approximately 2.5 heads tall, large beautifully painted warm hazel eyes with sparkling highlights, soft round rosy cheeks, tiny gentle smile, cream and sage-green oversized knitted sweater with a tiny ivory heart stitched onto the chest, warm cream trousers, tiny rounded cream shoes, fluffy dark chestnut hair with naturally flowing bangs. Neutral gentle standing pose, arms relaxed slightly separated from body, front-facing with a tiny three-quarter turn. High quality polished soft 3D-style illustration for a warm cozy miniature dollhouse life simulator; refined cute collectible art toy, soft pastel colors, warm diffuse light. Silhouette and facial details must be crisp and charming even at 90 pixels tall. The entire character including feet visible, small transparent margin. Isolated transparent background, no floor, no cast shadow, no text, no frame, no other objects or people. This is a generic initial avatar, not a portrait of a real person.
```

The live personalized prompt is `ByndHome3D.Portraits.prompt` in `apps/home3d/portraits.js`. It preserves the reference identity and asks for a single full-body, transparent, rounded 2.5-head-height illustration. Runtime alpha-bound cropping prepares a small saved portrait; it does not modify the packaged original PNGs.

## Closed-eye sleep variants (2026-10-01)

`default-char-sleep-v1.png` and `default-user-sleep-v1.png` were edited with the built-in `image_gen` tool, preserving transparent PNG bytes. `initial-sleep-portraits.js` mirrors those bytes for file-origin loading. Only generic initial characters use these variants; personalized portraits are never replaced by a generic sleeping face.

Exact edit prompt for both, each with its corresponding standing portrait as the edit target:

```text
Use case: identity-preserve. Edit target: the referenced full-body chibi character on transparent background. This is a game texture variant for sleeping in a cozy dollhouse. Make the eyes gently and peacefully CLOSED with delicate curved eyelids, a relaxed sleepy expression, keeping the face identity and mouth. Preserve EVERYTHING ELSE: same character, same hairstyle, hair color, skin, exact same knitted outfit and accessories, same full-body front facing pose, hands and feet, same size, proportions, placement and silhouette, same lighting and rendering style. The head stays at the top and feet at the bottom of the image. Do not rotate the character, do not add furniture, bed, pillow, blankets, shadows, scene, text or watermark. Genuine transparent background; preserve transparency. Make only the eyes change.
```

## 实时 3D 光脚与睡眠（2026-10-04）

`silver-red-v1/barefeet.glb` 从用户授权生成的光脚模型提取，不替换已核对的脸、服装和骨架。源任务 `04bf2fc6-5536-4974-9593-48eb445c5c30`，源 GLB SHA256 `a01229b3deb5ea8f92e32b34393493d941e3822e3862fdac887875451dfafd3e`；原始生成消耗 30 积分。`node scripts/prepare-home3d-barefeet.cjs` 可从本地源文件重建，无 API 调用；输出清单记录尺寸、面数、纹理及校验值，classic-script 镜像保留 GLB 原字节。运行时两个人物均去除源模型裤脚，脚踝按当前 LOD 去掉鞋后留下的真实切口对齐；上缘延入原腿部 25mm，不能只按骨骼原点摆放。脚趾、足弓和脚跟保留真实几何。

`expressions.js` 在已核对的两个人物上使用跟随蒙皮的局部闭眼材质，睡眠去掉原虹膜纹理和眼球高光，醒来恢复原材质；不改立绘、不新增付费任务，也不是任意上传模型的通用表情系统。
