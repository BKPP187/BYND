    async function fileData(file) {
        if (!file || !/^image\/(png|jpeg|webp)$/i.test(file.type)) throw new Error('请选择 PNG、JPG 或 WebP 图片');
        return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error('图片读取失败')); reader.readAsDataURL(file); });
    }
    async function durableImage(source) {
        if (/^data:image\/(png|jpeg|webp);base64,/i.test(source)) return source;
        if (!/^https?:\/\//i.test(source)) throw new Error('图片地址无效');
        const response = await fetch(source);
        if (!response.ok) throw new Error(`图片下载失败 (${response.status})`);
        const blob = await response.blob();
        if (!/^image\/(png|jpeg|webp)$/i.test(blob.type)) throw new Error('生图服务返回了不支持的图片格式');
        return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error('图片转存失败')); reader.readAsDataURL(blob); });
    }
    async function storeImage(source) { const key = id('img'); await put('images', { id: key, data: await durableImage(source) }); return key; }
    async function image(key) { return key ? (await get('images', key))?.data || '' : ''; }
    async function save(book) { book.updatedAt = Date.now(); await put('series', book); }
    async function run(fn) {
        if (state.busy) { say('上一个操作还没完成，请稍等'); return; }
        state.busy = true;
        try { await fn(); } catch (error) { console.error('漫画操作失败', error); say(error.message || '操作失败', true); } finally { state.busy = false; }
    }
    async function fillImages(scope = root()) {
        for (const box of scope?.querySelectorAll('[data-image]') || []) {
            const key = box.dataset.image;
            if (!key || box.dataset.loaded === key) continue;
            const src = await image(key);
            if (!src) continue;
            box.dataset.loaded = key;
            const img = box.querySelector('img.ct-img') || document.createElement('img');
            img.className = 'ct-img';
            img.alt = box.dataset.alt || '漫画图片';
            img.src = src;
            if (!img.parentNode) box.prepend(img);
            box.classList.add('has-image');
        }
    }
    // Appearance tags are saved per character / persona and provider (NovelAI tags
    // differ from natural-language descriptions) so later works draw the same people.
    const castKey = (who, key, provider) => `${who}:${key || 'default'}:${provider === 'novelai' ? 'novelai' : 'api'}`;
    async function castProfile(who, key, provider) { return (await get('profiles', castKey(who, key, provider)))?.text || ''; }
    async function saveCastProfile(who, key, provider, text) {
        const clean = String(text || '').trim().slice(0, 1200);
        if (!clean) return;
        await put('profiles', { id: castKey(who, key, provider), who, key: String(key || 'default'), provider: provider === 'novelai' ? 'novelai' : 'api', text: clean, updatedAt: Date.now() });
    }
