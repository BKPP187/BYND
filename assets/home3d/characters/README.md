# 小屋初始 Q 版立绘

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
