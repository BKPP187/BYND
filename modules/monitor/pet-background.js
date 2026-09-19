// Preserve the original canvas/RGB pixels; infer only the missing alpha channel.
(() => {
    const assetRoot = 'assets/vendor/pet-background/';
    // A preview host or <base> can change document.baseURI. Resources belong to
    // this script's application directory, not to the document embedding it.
    const scriptSource = document.currentScript?.src;
    const appRoot = scriptSource && /^(https?|file):/i.test(scriptSource)
        ? new URL('../../', scriptSource) : new URL('./', document.baseURI);
    const publishedRoot = 'https://bynd.ccwu.cc/';
    const resourceNames = {
        'modules/monitor/pet-background-worker.js': '处理程序',
        [assetRoot + 'ort.wasm.bundle.min.mjs']: '运行组件',
        [assetRoot + 'ort-wasm-simd-threaded.wasm']: '运算组件',
        [assetRoot + 'u2netp.onnx']: '人物识别模型'
    };
    let pending = Promise.resolve();
    function readFile(url) {
        return new Promise((resolve, reject) => {
            const request = new XMLHttpRequest();
            request.open('GET', url.href); request.responseType = 'arraybuffer'; request.timeout = 5000;
            request.onload = () => request.response?.byteLength && (request.status === 0 || request.status === 200)
                ? resolve(request.response) : reject(new Error('本地文件未能读取'));
            request.onerror = request.ontimeout = () => reject(new Error('本地文件读取被阻止或超时'));
            request.send();
        });
    }
    async function readWeb(url, path) {
        url.searchParams.set('v', path.startsWith(assetRoot) ? '1.29.0-u2netp-v1' : '1.1.625');
        const response = await fetch(url.href, { credentials: 'omit', signal: AbortSignal.timeout(45000) });
        if (!response.ok) throw new Error('HTTP ' + response.status);
        const bytes = await response.arrayBuffer();
        if (!bytes.byteLength) throw new Error('文件为空');
        return bytes;
    }
    async function readResource(path) {
        if (!Object.hasOwn(resourceNames, path)) throw new Error('未知的去背景资源。');
        const url = new URL(path, appRoot), fallback = new URL(path, publishedRoot);
        try {
            if (url.protocol === 'file:') {
                // Normal desktop browsers block file XHR even when the app's
                // scripts load. APKs can use their packaged assets offline.
                if (window.ByndAndroid) {
                    try { return await readFile(url); }
                    catch (error) { console.warn('桌宠本地资源读取失败，将获取官网工具文件', path, error); }
                }
                return await readWeb(fallback, path);
            }
            try { return await readWeb(url, path); }
            catch (error) {
                if (url.origin === fallback.origin && url.pathname === fallback.pathname) throw error;
                console.warn('桌宠资源地址不可用，将获取官网工具文件', path, error);
                return await readWeb(fallback, path);
            }
        } catch (error) {
            console.warn('桌宠去背景资源加载失败', { resource: path, source: appRoot.href, error: String(error) });
            const reason = /^HTTP \d+$/.test(error?.message || '') ? '，' + error.message : /timeout|超时/i.test(error?.name + ' ' + error?.message) ? '，下载超时' : '';
            throw new Error('去背景资源加载失败（' + resourceNames[path] + reason + '），请检查网络后重试。');
        }
    }
    function inputPixels(pixels) {
        const count = 320 * 320, values = new Float32Array(count * 3);
        const mean = [.485, .456, .406], deviation = [.229, .224, .225];
        let maximum = 1;
        for (let i = 0; i < count; i++) for (let channel = 0; channel < 3; channel++) maximum = Math.max(maximum, pixels[i * 4 + channel]);
        for (let i = 0; i < count; i++) for (let channel = 0; channel < 3; channel++) values[channel * count + i] = (pixels[i * 4 + channel] / maximum - mean[channel]) / deviation[channel];
        return values;
    }
    function alphaPixels(mask) {
        if (mask.length !== 320 * 320) throw new Error('背景识别结果不完整，请重试。');
        let low = Infinity, high = -Infinity;
        for (const value of mask) {
            if (!Number.isFinite(value)) throw new Error('背景识别结果无效，请重试。');
            low = Math.min(low, value); high = Math.max(high, value);
        }
        if (high - low < .01) throw new Error('没有识别出清晰的角色轮廓，原图已保留。');
        const rgba = new Uint8ClampedArray(mask.length * 4);
        for (let i = 0; i < mask.length; i++) {
            const value = Math.round(Math.max(0, Math.min(1, ((mask[i] - low) / (high - low) - .03) / .94)) * 255);
            rgba[i * 4] = rgba[i * 4 + 1] = rgba[i * 4 + 2] = value; rgba[i * 4 + 3] = 255;
        }
        return rgba;
    }
    async function infer(input, progress) {
        progress('正在准备去背景工具…');
        const [program, runtime, wasm, model] = await Promise.all([
            readResource('modules/monitor/pet-background-worker.js'), readResource(assetRoot + 'ort.wasm.bundle.min.mjs'),
            readResource(assetRoot + 'ort-wasm-simd-threaded.wasm'), readResource(assetRoot + 'u2netp.onnx')
        ]);
        const workerUrl = URL.createObjectURL(new Blob([program], { type: 'text/javascript' }));
        let worker;
        try {
            worker = new Worker(workerUrl);
            return await new Promise((resolve, reject) => {
                const timer = setTimeout(() => reject(new Error('去背景处理超时，原图已保留，请重试。')), 90000);
                const finish = (action, value) => { clearTimeout(timer); action(value); };
                worker.onmessage = ({ data }) => {
                    if (data.progress) progress(data.progress);
                    else if (data.mask) finish(resolve, new Float32Array(data.mask));
                    else if (data.error) {
                        console.warn('桌宠去背景失败', data.error);
                        finish(reject, new Error('去背景工具未能完成处理，原图已保留。请稍后重试。'));
                    }
                };
                worker.onerror = () => finish(reject, new Error('去背景工具未能运行，原图已保留。请重新打开应用后重试。'));
                try { worker.postMessage({ runtime, wasm, model, input: input.buffer }, [runtime, wasm, model, input.buffer]); }
                catch (error) { finish(reject, error); }
            });
        } finally { worker?.terminate(); URL.revokeObjectURL(workerUrl); }
    }
    async function process(source, progress) {
        const url = await window.ByndPetStudio.sourceData(source);
        const image = await new Promise((resolve, reject) => {
            const node = new Image(); node.onload = () => resolve(node);
            node.onerror = () => reject(new Error('图片无法读取，原图已保留。')); node.src = url;
        });
        const width = image.naturalWidth, height = image.naturalHeight;
        if (!width || !height || width * height > 32e6) throw new Error('图片尺寸过大或内容为空，原图已保留。');
        const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext('2d', { willReadFrequently: true }); ctx.drawImage(image, 0, 0);
        const original = ctx.getImageData(0, 0, width, height);
        const alpha = window.ByndCharacterPet.analyzeAlpha(original.data, width, height);
        if (alpha.transparent) return { url, width, height, transparent: true, coverage: alpha.coverage, kind: 'candidate' };
        const small = document.createElement('canvas'); small.width = small.height = 320;
        const sc = small.getContext('2d', { willReadFrequently: true }); sc.drawImage(image, 0, 0, 320, 320);
        const mask = await infer(inputPixels(sc.getImageData(0, 0, 320, 320).data), progress);
        progress('正在检查透明背景并保存原始比例…');
        const maskImage = sc.createImageData(320, 320); maskImage.data.set(alphaPixels(mask)); sc.putImageData(maskImage, 0, 0);
        ctx.clearRect(0, 0, width, height); ctx.drawImage(small, 0, 0, width, height);
        const scaled = ctx.getImageData(0, 0, width, height).data;
        for (let i = 0; i < scaled.length; i += 4) original.data[i + 3] = Math.round(original.data[i + 3] * scaled[i] / 255);
        const checked = window.ByndCharacterPet.analyzeAlpha(original.data, width, height);
        if (!checked.transparent) throw new Error('背景还未完全分离，原图已保留，可以重新处理。');
        ctx.putImageData(original, 0, 0);
        return { url: canvas.toDataURL('image/png'), width, height, transparent: true, coverage: checked.coverage, kind: 'candidate', backgroundRemoval: 'u2netp-local-v1' };
    }
    function remove(source, progress = () => {}) {
        const operation = pending.catch(() => {}).then(() => process(source, progress));
        pending = operation;
        return operation;
    }
    window.ByndPetBackground = { remove, inputPixels, alphaPixels, readResource };
})();
