// Recover legacy square previews only when a baked checkerboard provides
// measurable evidence of unequal scaling. Character anatomy is never guessed.
(() => {
    function detect(data, width, height) {
        if (width !== height || width < 256) return null;
        const side = Math.round(width * .15), matches = [];
        const regions = [0, 1 / 3, 2 / 3, 1].flatMap(position => {
            const top = Math.round((height - side) * position);
            return [[0, top], [width - side, top]];
        });
        for (const [left, top] of regions) {
            const light = new Float32Array(side * side), valid = new Uint8Array(side * side);
            let count = 0;
            for (let y = 0; y < side; y++) for (let x = 0; x < side; x++) {
                const i = ((top + y) * width + left + x) * 4, j = y * side + x;
                const low = Math.min(data[i], data[i + 1], data[i + 2]), high = Math.max(data[i], data[i + 1], data[i + 2]);
                if (data[i + 3] >= 250 && low > 195 && high - low < 18) {
                    light[j] = (data[i] + data[i + 1] + data[i + 2]) / 3;
                    valid[j] = 1; count++;
                }
            }
            if (count < side * side * .72) continue;
            const cost = (dx, dy) => {
                let total = 0, samples = 0;
                // Alternate sample parity so one-pixel phase shifts do not
                // bias the measured tile period after an integer resize.
                for (let y = 0; y < side - dy; y++) for (let x = y % 2; x < side - dx; x += 2) {
                    const a = y * side + x, b = (y + dy) * side + x + dx;
                    if (valid[a] && valid[b]) { total += Math.abs(light[a] - light[b]); samples++; }
                }
                return samples > side * side * .07 ? total / samples : 100;
            };
            const period = axis => {
                const raw = Array.from({ length: Math.min(128, Math.floor(side / 2)) + 1 }, (_, k) => axis ? cost(0, k) : cost(k, 0));
                const costs = raw.map((value, k) => k > 0 && k < raw.length - 1 ? (raw[k - 1] + value + raw[k + 1]) / 3 : value);
                const candidates = [];
                for (let k = 8; k < costs.length - 2; k++) {
                    const half = costs[Math.round(k / 2)];
                    if (costs[k] <= costs[k - 1] && costs[k] < costs[k + 1] && half > 4 && costs[k] / half < .32) {
                        const denominator = 2 * (costs[k - 1] + costs[k + 1] - 2 * costs[k]);
                        candidates.push({ value: k + (costs[k - 1] - costs[k + 1]) / denominator, contrast: half, score: costs[k] / half });
                    }
                }
                const best = Math.min(...candidates.map(item => item.score));
                return candidates.find(item => item.score <= best + .01) || null;
            };
            const x = period(0), y = period(1);
            // A diagonal half-cycle must repeat the same tiles: stripes and
            // unrelated horizontal/vertical textures are not checkerboards.
            if (!x || !y || cost(Math.round(x.value / 2), Math.round(y.value / 2)) / Math.min(x.contrast, y.contrast) > .32) continue;
            matches.push({ ratio: y.value / x.value, x: x.value, y: y.value });
        }
        const groups = matches.map(item => matches.filter(other => Math.abs(Math.log(other.ratio / item.ratio)) < .035
            && Math.abs(Math.log(other.x / item.x)) < .08 && Math.abs(Math.log(other.y / item.y)) < .08));
        const group = groups.sort((a, b) => b.length - a.length)[0];
        if (!group || group.length < 2) return null;
        const ratio = group.reduce((sum, item) => sum + item.ratio, 0) / group.length;
        if (ratio < .45 || ratio > 2.2 || Math.abs(Math.log(ratio)) < .12) return null;
        const standard = [3 / 4, 2 / 3, 9 / 16, 4 / 3, 3 / 2, 16 / 9].find(value => Math.abs(Math.log(value / ratio)) < .025);
        // Leave uncertain measurements untouched; never guess a ratio from
        // the character's pose, a reference portrait, or a square file alone.
        if (!standard) return null;
        return { ratio: standard, measuredRatio: ratio, regions: group.length };
    }

    async function correct(url) {
        const image = await new Promise((resolve, reject) => {
            const node = new Image();
            node.onload = () => resolve(node);
            node.onerror = () => reject(new Error('旧预览无法读取，原图片已保留。'));
            node.src = url;
        });
        if (image.naturalWidth !== image.naturalHeight || image.naturalWidth < 256 || image.naturalWidth > 2048) return null;
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = Math.min(1024, image.naturalWidth);
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
        const repair = detect(ctx.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height);
        if (!repair) return null;
        canvas.width = repair.ratio > 1 ? Math.round(image.naturalHeight * repair.ratio) : image.naturalWidth;
        canvas.height = repair.ratio < 1 ? Math.round(image.naturalWidth / repair.ratio) : image.naturalHeight;
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
        return { url: canvas.toDataURL('image/png'), width: canvas.width, height: canvas.height, proportionRepair: repair };
    }
    window.ByndPetProportions = { detect, correct };
})();
