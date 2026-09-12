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
    async function fromSpriteSheet(source) {
        const url = await window.ByndPetStudio.sourceData(source);
        const image = await new Promise((resolve, reject) => { const img = new Image(); img.onload = () => resolve(img); img.onerror = () => reject(new Error('动画序列图无法读取。')); img.src = url; });
        const side = image.naturalWidth;
        if (side !== image.naturalHeight || side < 512 || side > 3072 || side % 2) throw new Error('动画需要一张正方形的 2×2 序列图，生图接口返回的尺寸不符合要求。');
        const cell = side / 2;
        const frames = [];
        const union = { left: cell, top: cell, right: -1, bottom: -1 };
        for (let index = 0; index < 4; index++) {
            const canvas = document.createElement('canvas'); canvas.width = canvas.height = cell;
            const context = canvas.getContext('2d', { willReadFrequently: true });
            context.drawImage(image, (index % 2) * cell, Math.floor(index / 2) * cell, cell, cell, 0, 0, cell, cell);
            const alpha = C.analyzeAlpha(context.getImageData(0, 0, cell, cell).data, cell, cell);
            if (!alpha.transparent) throw new Error(`生图返回的第 ${index + 1} 格没有完整主体和透明留白，暂不能制成 GIF。请重试或上传透明 GIF；当前素材已保留。`);
            for (const key of ['left', 'top']) union[key] = Math.min(union[key], alpha.bounds[key]);
            for (const key of ['right', 'bottom']) union[key] = Math.max(union[key], alpha.bounds[key]);
            frames.push(canvas);
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
        const bytes = encodeFrames(pixels, 512, 512);
        return inspectGif(new Blob([bytes], { type: 'image/gif' }));
    }
    window.ByndPetAnimation = { decodeGif, encodeFrames, inspectGif, fromSpriteSheet };
})();
