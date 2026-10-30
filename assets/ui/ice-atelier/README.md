# BYND editorial visual assets

This is the shared visual foundation for Settings and Personalization, their detail pages, settings editors, picker sheets and theme-save feedback. It follows the user's latest references: oversized high-contrast serif type, an original figurative composition, glass stairs, botanical collage, fine geometric orbits and reflected typography. Artwork and controls have separate layers; decoration never receives pointer events.

The live design tokens and motion rules are in `ui/theme/ice-atelier.css`. Light mode uses porcelain white, graphite and silver-blue; dark mode uses ink blue and pale silver. User-facing functional labels remain Chinese. The editorial cover on Personalization is the wallpaper button itself.

Motion includes 280 ms entrance transitions, staggered groups, an 8-second subtle figure float, rotating orbital linework, breathing stars and press feedback. Infinite decoration only runs on an active app window. The reduced-motion preference disables it.

## Files and provenance

- `silver-muse.png`: original character, glass staircase and flowers generated with the built-in ImageGen tool; transparent PNG. This is the central cover artwork.
- `hydrangea-swallow.png`: original glass swallows and hydrangea vignette generated with the built-in ImageGen tool; transparent PNG. Used as a secondary edge decoration.
- `celestial-lines.svg`: original vector geometry authored in code.
- Icon font: the existing Remix Icon 3.5.0 dependency is now stored under `assets/vendor/remixicon/` with its Apache 2.0 license. Header and primary navigation icons also use inline SVG.

No external image URL is required for these assets. The prompts below were sent to the built-in tool; no CLI fallback was used. The user's supplied reference images were design references, not edit targets or copied assets.

## Final central-art prompt

Create an original exquisite anime fashion editorial collage cutout, transparent background, tall vertical composition. A clearly adult ethereal woman with very long flowing pale silver hair is sitting elegantly on an impossible spiraling staircase made of translucent frosted glass and sculpted white porcelain, legs gracefully together angled to the right, body in three-quarter profile, contemplative face facing left. She wears an elaborate layered ivory silk dress with sheer ribbons and subtle icy cyan blue fabric edges, a sophisticated modest editorial fashion gown. Porcelain skin, elegant beautiful anime face, delicately painted detailed hair, not a real person. Several crystalline wing-like botanical branches and pale blue hydrangea blooms grow around the lower staircase and trail on both sides, silver leaves and translucent ribbons drifting. Composition evokes avant-garde Japanese music album cover art, monochrome white and graphite ink with subtle pale ice blue accents, fine art anime illustration with mixed media paper and photographic transparent glass, exquisitely detailed and luxurious. Strong graceful silhouette, full figure and full staircase visible, no cropping, no text, no logo, no watermark, no border, NO geometric ring backdrop (will be made with code), NO background rectangle, actual transparent background. The character is the focal point in a mobile magazine-inspired app UI, will be placed in front of oversized black serif typography. Render with noticeable graphite line detail for contrast on a white page, not washed out. One unified cutout with woman plus sculptural staircase and floral branches, 2:3 portrait.

## Secondary-art prompt

Create a premium decorative transparent PNG cutout asset for a mobile interface with an icy blue, silver, porcelain-white aesthetic. A single beautifully composed botanical and celestial vignette: a delicate sprig of pale ice-blue hydrangea flowers and translucent silver-blue leaves, two small graceful translucent glass swallows in flight sweeping upward, and one fine silver orbital ring encircling a little pearlescent glass sphere. Artistic style high-end Japanese album packaging, elegant botanical watercolor blended with exquisitely rendered frosted glass and silver metallic details, refined ethereal and luminous, soft white and cool sky blue with deeper muted blue fine outlines. Composition is compact, vertically flowing with negative space and delicate fern-like botanical silhouette. Object fills image thoughtfully, visible blue details, clean realistic transparent background, no rectangle, no paper behind objects, no backdrop, no text, no letters, no watermark, no human, no UI. The asset will be displayed as a decorative illustration about 170px high in the top right of a functional mobile settings page so create readable silhouettes, no tiny noisy details.
