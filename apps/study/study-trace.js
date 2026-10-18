// Local tracing alignment. The same raster template is displayed and checked;
// this checks shape coverage and position, not handwriting recognition or stroke order.
(() => {
    function distances(mask, width, height) {
        const out = new Float32Array(mask.length); out.fill(width + height);
        for (let i = 0; i < mask.length; i++) if (mask[i]) out[i] = 0;
        for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
            const i = y * width + x;
            if (x) out[i] = Math.min(out[i], out[i - 1] + 1);
            if (y) out[i] = Math.min(out[i], out[i - width] + 1, x ? out[i - width - 1] + Math.SQRT2 : Infinity, x + 1 < width ? out[i - width + 1] + Math.SQRT2 : Infinity);
        }
        for (let y = height - 1; y >= 0; y--) for (let x = width - 1; x >= 0; x--) {
            const i = y * width + x;
            if (x + 1 < width) out[i] = Math.min(out[i], out[i + 1] + 1);
            if (y + 1 < height) out[i] = Math.min(out[i], out[i + width] + 1, x ? out[i + width - 1] + Math.SQRT2 : Infinity, x + 1 < width ? out[i + width + 1] + Math.SQRT2 : Infinity);
        }
        return out;
    }
    function compareMasks(template, ink, width, height) {
        if (!Number.isInteger(width) || !Number.isInteger(height) || width < 8 || height < 8 || width > 560 || height > 560 || template.length !== width * height || ink.length !== template.length) throw new Error('描写检查图像无效。');
        const total = template.reduce((n, v) => n + !!v, 0), drawn = ink.reduce((n, v) => n + !!v, 0);
        if (total < 3) throw new Error('示范字形未能加载，请刷新重试。');
        if (!drawn) return { accepted: false, precision: 0, coverage: 0, reason: 'empty' };
        const tolerance = Math.max(1, Math.min(width, height) * .021);
        const targetDistance = distances(template, width, height), inkDistance = distances(ink, width, height);
        let aligned = 0, covered = 0;
        for (let i = 0; i < template.length; i++) { if (ink[i] && targetDistance[i] <= tolerance) aligned++; if (template[i] && inkDistance[i] <= tolerance) covered++; }
        // Require every separate component (e.g. a dot or vowel mark), even
        // when it occupies little of the total ink. Ignore antialiasing specks.
        const seen = new Uint8Array(template.length), queue = new Int32Array(template.length);
        let missing = false;
        for (let start = 0; start < template.length; start++) {
            if (!template[start] || seen[start]) continue;
            let head = 0, tail = 1, componentCovered = 0; queue[0] = start; seen[start] = 1;
            while (head < tail) {
                const i = queue[head++], x = i % width, y = Math.floor(i / width);
                if (inkDistance[i] <= tolerance) componentCovered++;
                for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
                    const nx = x + dx, ny = y + dy, next = ny * width + nx;
                    if (nx >= 0 && nx < width && ny >= 0 && ny < height && template[next] && !seen[next]) { seen[next] = 1; queue[tail++] = next; }
                }
            }
            if (tail >= Math.max(3, total * .005) && componentCovered / tail < .5) missing = true;
        }
        const precision = aligned / drawn, coverage = covered / total;
        const accepted = precision >= .8 && coverage >= .76 && !missing;
        return { accepted, precision, coverage, reason: accepted ? 'aligned' : precision < .8 ? 'offshape' : 'incomplete' };
    }
    function createTemplate(glyph, size = 560, fontFamily = 'sans-serif') {
        const canvas = document.createElement('canvas'); canvas.width = canvas.height = size;
        const ctx = canvas.getContext('2d'); if (!ctx) throw new Error('描写画布无法读取。');
        let fontSize = size * .68;
        ctx.font = `${fontSize}px ${fontFamily}`;
        let metrics = ctx.measureText(glyph);
        const fit = Math.min(1, size * .78 / Math.max(1, metrics.width), size * .78 / Math.max(1, (metrics.actualBoundingBoxAscent || fontSize) + (metrics.actualBoundingBoxDescent || 0)));
        fontSize *= fit; ctx.font = `${fontSize}px ${fontFamily}`; metrics = ctx.measureText(glyph);
        const left = metrics.actualBoundingBoxLeft || 0, right = metrics.actualBoundingBoxRight ?? metrics.width;
        const ascent = metrics.actualBoundingBoxAscent ?? fontSize * .8, descent = metrics.actualBoundingBoxDescent || 0;
        ctx.fillStyle = '#000'; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
        ctx.fillText(glyph, size / 2 + (left - right) / 2, size / 2 + (ascent - descent) / 2);
        return { canvas, glyph, size };
    }
    function drawStrokes(ctx, strokes, size, color = '#1b1b1b') {
        ctx.strokeStyle = color; ctx.lineWidth = size * 13 / 560; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        for (const stroke of strokes) {
            if (!stroke.length) continue;
            ctx.beginPath();
            stroke.forEach((point, index) => { if (index) ctx.lineTo(point.x * size, point.y * size); else ctx.moveTo(point.x * size, point.y * size); });
            if (stroke.length === 1) ctx.lineTo(stroke[0].x * size + .1, stroke[0].y * size + .1);
            ctx.stroke();
        }
    }
    function maskOf(canvas, size) {
        const small = document.createElement('canvas'); small.width = small.height = size;
        const ctx = small.getContext('2d'); if (!ctx) throw new Error('描写检查无法读取图像。');
        ctx.drawImage(canvas, 0, 0, size, size);
        const pixels = ctx.getImageData(0, 0, size, size).data, mask = new Uint8Array(size * size);
        for (let i = 0; i < mask.length; i++) mask[i] = pixels[i * 4 + 3] > 64 ? 1 : 0;
        return mask;
    }
    function assess(template, strokes) {
        const ink = document.createElement('canvas'); ink.width = ink.height = template.size;
        const ctx = ink.getContext('2d'); if (!ctx) throw new Error('描写检查无法读取笔迹。');
        drawStrokes(ctx, strokes, template.size);
        return compareMasks(maskOf(template.canvas, 140), maskOf(ink, 140), 140, 140);
    }
    window.ByndStudyTrace = { createTemplate, drawStrokes, assess, compareMasks };
})();
