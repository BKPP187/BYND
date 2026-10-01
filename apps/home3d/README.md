# 小屋 · 两个人的日常

Desktop app ID: `home3d`. Only `home3d.js` loads at startup. It lazily loads the local Three.js r180 MIT bundle, classic-script catalogs and independent modules, so Android's `file:///android_asset` entry also works without import maps, a CDN or `fetch(file:)`.

The first visit lets the user set a reference and bind an existing one-to-one character. Subsequent visits open the original day/night house entrance; 回家 returns to that character's saved room. In-house settings can switch the character; each character keeps a separate home. User appearance is shared, while character appearance, photos, memories, furniture choices and activity are per home. The source of the character reference is `getWechatImageReferenceForChar`, including the chat settings reference before avatar fallback.

Rooms and furniture use real 3D geometry. Characters use transparent AI-generated Q-version illustrations on camera-facing sprites, as requested by the user. Two packaged initial portraits work offline; dedicated portraits use the existing image-generation API, with the user's reference set inside the home and the character's reference from chat settings. Generation starts only after an explicit button click, saves a preview, and replaces the current portrait only after confirmation. There is no automatic paid generation on entry. These are 2D illustrations in a 3D room, not reconstructed or rigged 3D models: walking and breathing move the illustration, seated views crop the lower legs, and lying views rotate it. Individual body-part animation requires a future pose sheet or rig.

## Living and construction

生活模式 advances a local activity every 90 seconds (sleep uses longer intervals), with the character walking around furniture and settling into usable positions. Decisions consider time, character personality/status, recent private context, known Living World events, available facilities and local energy. AI only supplies an explicit high-level plan when the user requests it. Offline catch-up is bounded to the last day and labels its journal entries as local simulation; no background network request is needed. Furniture retains last-use and plant-care traces.

装修 opens a bottom furniture catalog. Drag from the catalog, tap a room object to move it, rotate 90 degrees, fine-tune with arrows, then confirm. Keyboard arrows and R work as alternatives to dragging. A fixed tray height keeps floor projection stable during selection. Collision, room bounds and navigable access are checked before an atomic save. Cancel leaves the original layout intact; moving/removing a table or cabinet includes supported props. Existing v1 saves gain sparse per-room overrides without resetting portraits or memories.

Five complete series (cream, European, Japanese, modern and Chinese) include 55 original procedural furniture variants, alongside the existing licensed GLBs. Catalog type definitions supply shared interactions and positions; visual variants only provide style, dimensions and geometry. Six modular extensions (kitchen, bathroom, balcony, wardrobe, studio and collection) can be opened per character. Each room loads independently rather than rendering nine rooms simultaneously.

Private saved home context is available to character chat and the single-actor Living World agent even before the renderer loads. It is not included in the public multi-actor world-generation context. Local relationship settings do not silently rewrite the public relationship graph.

Entrance artwork lives under assets/home3d/entrance; prompts.json records the built-in ImageGen prompts. These are decorative illustrations; actual furnishings remain editable 3D objects. Character movement still uses camera-facing Q-version portraits with seated/lying transforms, rather than rigged skeletal animation.

## Modules

- `state.js`: durable, atomic localStorage writes; separate character homes; visits, moments and memory keepsakes. Save errors propagate to the UI. `bynd_home3d_v1` participates in BYND's existing backup/import system, including small saved reference and photo images.
- `bridge.js`: existing characters, chat reference, recent history, character phone, visible Living World events, granted reality-life summaries, Memory, album and application navigation. It never reads reality-life records directly or bypasses a character's grant.
- `living.js`: deterministic, time-aware offline activity; optional explicit AI decisions restricted to catalog furniture, open rooms, actions and valid placement slots. The current schedule persists while the user is away, and is recomputed when expired on entry. API errors retain the old plan. No background API spend is required.
- `build.js` / `build-ui.js`: layout validation, sparse saved overrides, support-aware movement, pointer dragging, catalog filters, cancellation, rotation and modular room expansion.
- `furniture-visuals.js`: original procedural geometry for the five complete style series, independent of shared functional type definitions.
- `rooms.js`: independently loaded rooms, shells, placement slots and interaction anchors. Room definitions list nine room modules; living room, bedroom and game room are open initially and the other six can be expanded per home. Add future rooms through this catalog rather than extending a monolithic house scene.
- `furniture.js`: self-contained GLB, material normalization, a 3MB LRU byte cache, procedural rounded upholstery/props and photo frames. The file origin uses XHR for local binary assets.
- `materials.js`: reusable fabric, wood, plastic, metal, glass and ceramic presets, with tiny procedural bump maps. Four themes change the palette, lighting and background while retaining geometry.
- `portraits.js`: reference-based image generation, shared pending lock and provider cooldown, transparent-background validation/removal, bounded cropped PNG storage, preview/confirmation and stale-reference/character checks. Errors preserve the current portrait and propagate to the UI. Packaged portrait preparation caches only CPU data; GPU textures belong to each active scene.
- `characters.js` / `animation.js`: camera-facing portrait sprites with seated/lying placement and walking/breathing motion. Activity types and furniture occupancy still govern interactions, phones, games, sleep and hugs; navigation uses a grid around furniture. The old parameter profile parser remains compatible with existing saves.
- `scene.js`: room lifecycle, bounded concurrent model decoding, orthographic camera, picking, shadows, 30fps cap, 1.5 pixel-ratio cap, reduced motion and WebGL error recovery. Leaving the app cancels animation, releases room geometry/textures/materials/shadow targets and loses the old GL context. Only bounded CPU GLB bytes remain cached.
- `icons.js` / `ui.js` / `home3d.css`: offline controls, onboarding, settings, room selection, interaction sheets, memory journal and native safe-area handling.

## Asset provenance and rebuilding

All packaged geometry is inventoried in `assets/home3d/asset-manifest.json` with original filename, author, official source, license, commercial/modification permissions, attribution requirements and SHA-256. The supplied FBX subset is recorded as user-provided Quaternius; Kenney's original included license is preserved. Source evidence lives in `assets/home3d/licenses`. Tiny room decorations and avatar meshes are BYND's own procedural geometry.

Initial portrait sources and exact generation prompts are recorded in `assets/home3d/characters/README.md`. The original transparent PNGs are unchanged. `initial-portraits.js` mirrors their bytes as data URLs so ordinary `file://` browsers can upload them to WebGL without opaque-origin image restrictions; it loads only when entering the home.

Preparation uses Three.js `0.180.0` and esbuild `0.25.10` in an external tool directory:

```
npm install --prefix artifacts/home3d-tools --no-audit --no-fund --save-exact three@0.180.0 esbuild@0.25.10
node scripts/prepare-home3d-assets.cjs [tool-directory] [download-directory]
```

Canonical data lives in the three `data/*.json` catalogs. The preparation script generates `data/catalogs.js` as their Android-compatible classic-script mirror; tests enforce equality. When editing a catalog, regenerate this mirror. Do not hand-edit the bundled Three.js engine or exported GLB files.

## Verification

`node tests/run.cjs` covers save failure, invalid imported data, per-character separation, local schedules, AI failures and invalid plans, delayed decisions after switching character, reference parsing, pathfinding, catalog consistency and packaged model licensing/structure.

`node scripts/check-home3d-browser.cjs` exercises actual WebGL rooms, initial portrait sprites, room switches, memory keepsakes, sleep and themes, native 47px top inset at 320/375/430px, explicit generation previews/confirmation, 429 preservation/cooldown, close/reopen locks, and disposal on HTTP and file origins. Image API responses are test stubs; no real user API or user data is used. Screenshots and the report are saved under `artifacts/home3d`.

`node scripts/check-home3d-background-browser.cjs` runs real U2NETP/ONNX inference on an opaque illustration with the public resource mirror blocked. It checks file and HTTP origins, transparent output, retained opaque subject colors, removal of temporary script nodes, and the home preview/confirmation workflow. API output is simulated; local background inference uses the actual packaged model and runtime. Its report is under `artifacts/home3d-background`.

Personalized image generation requires the user's configured provider to support image references. Transparent outputs are preferred; opaque outputs use the existing BYND background-removal module and must pass alpha validation before saving. Android hardware performance is not inferred from desktop screenshots; run a device check before raising quality caps. This first release uses material/geometry assets small enough to avoid needing Draco/KTX2 or LOD; only add those when measurements justify them.

`node scripts/check-home3d-build-browser.cjs` verifies pointer dragging, rotation, cancellation, storage failure, deletion, modular expansion, autonomous walking to a piano, day/night entrance, reload persistence, disposal and native top insets at 320/375/390/430px. Evidence is saved under artifacts/home3d-build.
