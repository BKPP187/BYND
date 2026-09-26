// Real GIF frames, using locally bundled codecs; no API calls during playback.
(() => {
    const C = window.ByndCharacterPet;
    const E = window.ByndGifEncoder;
    const R = window.ByndGifReader;
    const pause = () => new Promise(resolve => setTimeout(resolve, 0));
    const dataUrl = blob => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(reader.error || new Error('动画读取失败。'));
        reader.readAsDataURL(blob);
    });
    function decodeGif(bytes) {
        if (!bytes?.length || bytes.length > 20 * 1024 * 1024) throw new Error('请使用 20 MB 以内的 GIF。');
        const reader = new R.GifReader(bytes);
        const width = reader.width, height = reader.height, frames = reader.numFrames();
        if (width < 1 || height < 1 || width > 2048 || height > 2048 || frames < 2 || frames > 120 || width * height * frames > 64e6) throw new Error('GIF 需有 2–120 帧，边长不超过 2048，且总像素不超过 6400 万。');
        if (reader.frameInfo(0).transparent_index == null) throw new Error('GIF 首帧没有透明背景，请上传透明 GIF。');
        let rgba = new Uint8ClampedArray(width * height * 4), first = null, durationMs = 0;
        for (let index = 0; index < frames; index++) {
            const info = reader.frameInfo(index);
            if (info.x + info.width > width || info.y + info.height > height) throw new Error('GIF 动画帧超出画布，无法使用。');
            const previous = info.disposal === 3 ? rgba.slice() : null;
            reader.decodeAndBlitFrameRGBA(index, rgba);
            const alpha = C.analyzeAlpha(rgba, width, height);
            if (!alpha.transparent) throw new Error(`GIF 第 ${index + 1} 帧没有完整的透明留白或角色主体，请换一份透明动画。`);
            if (!first) first = rgba.slice();
            durationMs += info.delay > 1 ? info.delay * 10 : 100;
            if (info.disposal === 2) for (let y = info.y; y < info.y + info.height; y++) rgba.fill(0, (y * width + info.x) * 4, (y * width + info.x + info.width) * 4);
            else if (previous) rgba = previous;
        }
        return { width, height, frames, durationMs, first };
    }
    function encodeFrames(frames, width, height, delay = 240) {
        if (frames.length < 2 || frames.length > 12 || width < 1 || height < 1 || width > 1024 || height > 1024 || width * height * frames.length > 16e6) throw new Error('动画帧数量或尺寸不可用。');
        const normalized = frames.map(frame => {
            if (frame.length !== width * height * 4 || !C.analyzeAlpha(frame, width, height).transparent) throw new Error('每一帧都需要完整主体和透明背景。');
            const result = new Uint8Array(frame);
            // GIF supports binary alpha; quantize all frames together to avoid palette flicker.
            for (let at = 0; at < result.length; at += 4) {
                if (result[at + 3] < 128) result.fill(0, at, at + 4);
                else result[at + 3] = 255;
            }
            return result;
        });
        if (!normalized.slice(1).some(frame => frame.some((value, index) => value !== normalized[0][index]))) throw new Error('生图返回的动画帧完全相同，未生成动作。原素材已保留，请重试或上传 GIF。');
        const combined = new Uint8Array(normalized.length * width * height * 4);
        normalized.forEach((frame, index) => combined.set(frame, index * frame.length));
        const palette = E.quantize(combined, 256, { format: 'rgba4444', oneBitAlpha: true, clearAlpha: true });
        const transparentIndex = palette.findIndex(color => color[3] === 0);
        if (transparentIndex < 0) throw new Error('动画透明通道转换失败。');
        palette.unshift(palette.splice(transparentIndex, 1)[0]);
        const gif = E.GIFEncoder();
        normalized.forEach(frame => gif.writeFrame(E.applyPalette(frame, palette, 'rgba4444'), width, height, { palette, transparent: true, transparentIndex: 0, delay, repeat: 0, dispose: 2 }));
        gif.finish();
        return gif.bytes();
    }
    function poster(decoded) {
        const canvas = document.createElement('canvas'); canvas.width = decoded.width; canvas.height = decoded.height;
        const context = canvas.getContext('2d');
        const pixels = context.createImageData(decoded.width, decoded.height); pixels.data.set(decoded.first); context.putImageData(pixels, 0, 0);
        return canvas.toDataURL('image/png');
    }
    async function inspectGif(file) {
        if (file.size > 20 * 1024 * 1024) throw new Error('请使用 20 MB 以内的 GIF。');
        const bytes = new Uint8Array(await file.arrayBuffer());
        const decoded = decodeGif(bytes);
        return { url: await dataUrl(new Blob([bytes], { type: 'image/gif' })), posterUrl: poster(decoded), width: decoded.width, height: decoded.height, frames: decoded.frames, durationMs: decoded.durationMs, format: 'gif', transparent: true, kind: 'candidate' };
    }
    const distance = (pixels, at, color) => Math.max(Math.abs(pixels[at] - color[0]), Math.abs(pixels[at + 1] - color[1]), Math.abs(pixels[at + 2] - color[2]));
    function chooseMatte(data) {
        // Avoid colors already present in the approved character, including hair and props.
        const choices = [[0, 255, 0], [255, 0, 255], [0, 255, 255], [255, 255, 0], [0, 0, 255], [255, 0, 0]];
        const ranked = choices.map(color => {
            let nearby = 0, nearest = 255;
            for (let at = 0; at < data.length; at += 4) {
                if (data[at + 3] < 128) continue;
                const delta = distance(data, at, color);
                nearest = Math.min(nearest, delta);
                if (delta < 96) nearby++;
            }
            return { color, nearby, nearest };
        }).sort((a, b) => a.nearby - b.nearby || b.nearest - a.nearest);
        return ranked[0].nearby === 0 ? ranked[0].color : null;
    }
    function clearMatte(data, width, height, color) {
        const pixels = new Uint8ClampedArray(data);
        if (!Array.isArray(color) || color.length !== 3 || color.some(value => !Number.isInteger(value) || value < 0 || value > 255)) return pixels;
        const count = width * height, mask = new Uint8Array(count), queue = new Int32Array(count);
        let start = 0, end = 0, border = 0, matching = 0;
        const matches = index => pixels[index * 4 + 3] <= 8 || distance(pixels, index * 4, color) <= 48;
        const add = index => { if (!mask[index] && matches(index)) { mask[index] = 1; queue[end++] = index; } };
        for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
            if (x && y && x !== width - 1 && y !== height - 1) continue;
            border++; if (matches(y * width + x)) matching++;
        }
        // Never guess a background from the character's own colors or a painted checkerboard.
        if (matching / border < 0.9) return pixels;
        for (let x = 0; x < width; x++) { add(x); add((height - 1) * width + x); }
        for (let y = 1; y < height - 1; y++) { add(y * width); add(y * width + width - 1); }
        // The matte is selected from colors absent from the reference. Include enclosed gaps
        // (between a hand and its prop, for example), which cannot be reached from the border.
        for (let index = 0; index < count; index++) if (distance(pixels, index * 4, color) <= 16) add(index);
        while (start < end) {
            const at = queue[start++], x = at % width, y = Math.floor(at / width);
            if (x) add(at - 1); if (x < width - 1) add(at + 1);
            if (y) add(at - width); if (y < height - 1) add(at + width);
        }
        for (let index = 0; index < count; index++) {
            const at = index * 4;
            if (mask[index]) { pixels.fill(0, at, at + 4); continue; }
            const x = index % width, y = Math.floor(index / width);
            let nearBackground = false;
            for (let dy = -2; dy <= 2 && !nearBackground; dy++) for (let dx = -2; dx <= 2; dx++) {
                if (x + dx >= 0 && x + dx < width && y + dy >= 0 && y + dy < height && mask[(y + dy) * width + x + dx]) { nearBackground = true; break; }
            }
            if (!nearBackground) continue;
            const delta = distance(data, at, color);
            let best = null;
            // Estimate an edge only if a nearby opaque foreground color explains it as a
            // mixture with the matte. Gray hair/clothes alone are not evidence of transparency.
            for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
                if ((!dx && !dy) || x + dx < 0 || x + dx >= width || y + dy < 0 || y + dy >= height) continue;
                const neighbor = (y + dy) * width + x + dx, offset = neighbor * 4;
                if (mask[neighbor] || data[offset + 3] < 248 || distance(data, offset, color) < delta + 8) continue;
                let dot = 0, length = 0;
                for (let channel = 0; channel < 3; channel++) {
                    const direction = data[offset + channel] - color[channel];
                    dot += (data[at + channel] - color[channel]) * direction; length += direction * direction;
                }
                const alpha = dot / length;
                if (alpha < 0.2 || alpha > 0.99) continue;
                let residual = 0;
                for (let channel = 0; channel < 3; channel++) residual = Math.max(residual, Math.abs(data[at + channel] - (alpha * data[offset + channel] + (1 - alpha) * color[channel])));
                const proximity = dx * dx + dy * dy;
                const foregroundDistance = distance(data, offset, color);
                if (residual <= 6 && (!best || foregroundDistance > best.foregroundDistance || foregroundDistance === best.foregroundDistance && proximity < best.proximity)) best = { alpha, proximity, foregroundDistance };
            }
            if (!best) continue;
            for (let channel = 0; channel < 3; channel++) pixels[at + channel] = Math.max(0, Math.min(255, (data[at + channel] - color[channel] * (1 - best.alpha)) / best.alpha));
            pixels[at + 3] = Math.round(data[at + 3] * best.alpha);
        }
        return pixels;
    }
    function sheetError(code, message) {
        const error = new Error(message); error.animationCode = code; return error;
    }
    async function loadImage(source) {
        const url = await window.ByndPetStudio.sourceData(source);
        const image = await new Promise((resolve, reject) => { const img = new Image(); img.onload = () => resolve(img); img.onerror = () => reject(new Error('动画序列图无法读取。')); img.src = url; });
        if (!image.naturalWidth || !image.naturalHeight || image.naturalWidth * image.naturalHeight > 16e6) throw new Error('动画图片尺寸过大或内容为空。');
        return image;
    }
    async function inspectSheet(source) {
        const image = await loadImage(source);
        const canvas = document.createElement('canvas'); canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
        const context = canvas.getContext('2d', { willReadFrequently: true }); context.drawImage(image, 0, 0);
        const alpha = C.analyzeAlpha(context.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height);
        return { url: canvas.toDataURL('image/png'), width: canvas.width, height: canvas.height, transparent: alpha.transparent, format: 'png', kind: 'animation-source' };
    }
    async function prepareReference(source) {
        const image = await loadImage(source);
        const input = document.createElement('canvas'); input.width = image.naturalWidth; input.height = image.naturalHeight;
        const context = input.getContext('2d', { willReadFrequently: true }); context.drawImage(image, 0, 0);
        const pixels = context.getImageData(0, 0, input.width, input.height).data;
        const alpha = C.analyzeAlpha(pixels, input.width, input.height);
        if (!alpha.transparent) throw new Error('已确认的角色图没有可用的透明主体，请先检查基础形象。');
        const matteColor = chooseMatte(pixels);
        const color = matteColor ? '#' + matteColor.map(value => value.toString(16).padStart(2, '0')).join('') : '';
        const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1024;
        const target = canvas.getContext('2d');
        if (color) { target.fillStyle = color; target.fillRect(0, 0, 1024, 1024); }
        const { left, top, right, bottom } = alpha.bounds, width = right - left + 1, height = bottom - top + 1;
        const scale = Math.min(400 / width, 410 / height);
        for (let index = 0; index < 4; index++) target.drawImage(input, left, top, width, height,
            index % 2 * 512 + (512 - width * scale) / 2, Math.floor(index / 2) * 512 + 454 - height * scale, width * scale, height * scale);
        return { url: canvas.toDataURL('image/png'), color, matteColor };
    }
    function framePixels(data, width, height, color, index) {
        let pixels = new Uint8ClampedArray(data);
        if (!C.analyzeAlpha(pixels, width, height).transparent) pixels = clearMatte(pixels, width, height, color);
        for (let at = 3; at < pixels.length; at += 4) if (pixels[at] <= 8) pixels[at] = 0;
        const alpha = C.analyzeAlpha(pixels, width, height);
        if (alpha.empty) throw sheetError('empty', `动作原图的第 ${index + 1} 格没有可用主体。`);
        if (!alpha.transparent) throw sheetError('background', `动作原图的第 ${index + 1} 格背景未能分离，请查看本次原图。`);
        let edge = 0;
        for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
            if ((!x || !y || x === width - 1 || y === height - 1) && pixels[(y * width + x) * 4 + 3] >= 96) edge++;
        }
        if (edge > 2) throw sheetError('layout', `动作原图的第 ${index + 1} 格主体跨过边界，不能直接裁成动画。`);
        return { pixels, alpha };
    }
    async function fromSpriteSheet(source, options = {}) {
        const image = await loadImage(source);
        const cellWidth = image.naturalWidth / 2, cellHeight = image.naturalHeight / 2;
        if (cellWidth < 256 || cellHeight < 256 || cellWidth > 1536 || cellHeight > 1536 || !Number.isInteger(cellWidth) || !Number.isInteger(cellHeight)) throw sheetError('layout', '动画需要 2×2 四格序列图，本次返回的尺寸无法分帧。');
        const frames = [];
        const union = { left: cellWidth, top: cellHeight, right: -1, bottom: -1 };
        for (let index = 0; index < 4; index++) {
            const canvas = document.createElement('canvas'); canvas.width = cellWidth; canvas.height = cellHeight;
            const context = canvas.getContext('2d', { willReadFrequently: true });
            context.drawImage(image, (index % 2) * cellWidth, Math.floor(index / 2) * cellHeight, cellWidth, cellHeight, 0, 0, cellWidth, cellHeight);
            const frame = context.getImageData(0, 0, cellWidth, cellHeight);
            const { pixels, alpha } = framePixels(frame.data, cellWidth, cellHeight, options.matteColor, index);
            frame.data.set(pixels); context.putImageData(frame, 0, 0);
            for (const key of ['left', 'top']) union[key] = Math.min(union[key], alpha.bounds[key]);
            for (const key of ['right', 'bottom']) union[key] = Math.max(union[key], alpha.bounds[key]);
            frames.push(canvas);
            await pause();
        }
        const width = union.right - union.left + 1, height = union.bottom - union.top + 1;
        const scale = Math.min(410 / width, 420 / height);
        const pixels = [];
        for (const frame of frames) {
            const canvas = document.createElement('canvas'); canvas.width = canvas.height = 512;
            const context = canvas.getContext('2d', { willReadFrequently: true });
            // One shared crop and transform preserves motion instead of re-centering every frame.
            context.drawImage(frame, union.left, union.top, width, height, (512 - width * scale) / 2, 461 - height * scale, width * scale, height * scale);
            pixels.push(context.getImageData(0, 0, 512, 512).data);
            await pause();
        }
        let bytes;
        try { bytes = encodeFrames(pixels, 512, 512); }
        catch (error) { if (error.message.includes('完全相同')) error.animationCode = 'static'; throw error; }
        return inspectGif(new Blob([bytes], { type: 'image/gif' }));
    }
    window.ByndPetAnimation = { decodeGif, encodeFrames, inspectGif, prepareReference, inspectSheet, chooseMatte, clearMatte, framePixels, fromSpriteSheet };
})();
