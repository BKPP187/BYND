function openWechatStickerStore() {
    const data = getStickerPacks();
    data.packs = Array.isArray(data.packs) ? data.packs : [];
    const totalStickers = data.packs.reduce((sum, pack) => sum + ((pack.stickers || []).length), 0);
    const editablePacks = getEditableStickerPacks(data);
    const activePackId = window._wechatStickerImportPackId || editablePacks[0]?.id || '';
    const packOptions = editablePacks.length
        ? editablePacks.map(pack => `<option value="${wcEscapeHtml(pack.id)}" ${pack.id === activePackId ? 'selected' : ''}>${wcEscapeHtml(pack.name)}（${(pack.stickers || []).length}）</option>`).join('')
        : '<option value="">先创建一个贴纸包</option>';
    openWechatFeatureScreen('表情', `
        <div class="wc-sticker-store-page">
            <div class="wc-sticker-store-hero wc-sticker-soft-hero">
                <div class="wc-sticker-hero-icon"><i class="ri-emotion-happy-line"></i></div>
                <div>
                    <strong>我的表情</strong>
                    <span>${data.packs.length} 个分组 · ${totalStickers} 张贴纸</span>
                </div>
            </div>
            <div class="wc-sticker-quick-row">
                <button onclick="openStickerPackCreateModal()"><i class="ri-folder-add-line"></i><span>新建分组</span></button>
                <label><i class="ri-image-add-line"></i><span>本地图片</span><input type="file" accept="image/*" multiple onchange="importWechatStickerLocalFiles(this)"></label>
                <button onclick="openStickerManager()"><i class="ri-settings-3-line"></i><span>管理</span></button>
            </div>
            <div class="wc-sticker-import-card">
                <div class="wc-sticker-import-title">
                    <i class="ri-link-m"></i>
                    <div><strong>从图床导入</strong><span>选择分组，粘贴链接或输入新分组名</span></div>
                </div>
                <div class="wc-sticker-boltp-ready">
                    <div>
                        <strong>这狗</strong>
                        <span>已内置 Boltp 分享包，当前默认包会自动补到 176 张。</span>
                    </div>
                    <button onclick="importBoltpStickerShare()"><i class="ri-refresh-line"></i> 同步</button>
                </div>
                <div class="wc-sticker-import-target">
                    <select id="wc-sticker-import-pack" onchange="window._wechatStickerImportPackId=this.value">${packOptions}</select>
                    <input id="wc-sticker-new-pack-name" maxlength="24" placeholder="新贴纸包名">
                </div>
                <textarea id="wc-sticker-url-import" class="wc-sticker-import-text" placeholder="每行一个图床链接，支持：&#10;开心：https://example.com/happy.png&#10;https://example.com/sticker.webp"></textarea>
                <div class="wc-sticker-import-actions">
                    <button onclick="importWechatStickerUrls()"><i class="ri-link"></i><span>导入 URL</span></button>
                    <label><i class="ri-image-add-line"></i><span>本地图片</span><input type="file" accept="image/*" multiple onchange="importWechatStickerLocalFiles(this)"></label>
                </div>
                <div class="wc-sticker-share-import">
                    <input id="wc-sticker-share-url" value="https://www.boltp.com/shares/26c3884813ed4f4999b78e49d448f2e6" placeholder="粘贴 Boltp 分享链接">
                    <button onclick="importBoltpStickerShare()"><i class="ri-cloud-line"></i><span>导入图床分享</span></button>
                </div>
            </div>
            <div class="wc-sticker-pack-summary">
                <div class="wc-sticker-summary-head">
                    <strong>我的贴纸包</strong>
                    <button onclick="openStickerManager()">编辑</button>
                </div>
                ${data.packs.length ? data.packs.map(pack => `
                    <div class="wc-sticker-pack-row" onclick="openStickerManager()">
                        <div class="wc-sticker-pack-preview">
                            ${(pack.stickers || []).slice(0, 4).map(sticker => `<img src="${wcEscapeHtml(sticker.url)}" alt="${wcEscapeHtml(sticker.name || '')}" onerror="this.style.opacity='0.35'">`).join('') || '<span>空</span>'}
                        </div>
                        <div class="wc-sticker-pack-meta">
                            <strong>${wcEscapeHtml(pack.name || '未命名贴纸包')}</strong>
                            <span>${(pack.stickers || []).length} 张贴纸</span>
                        </div>
                        <i class="ri-arrow-right-s-line"></i>
                    </div>
                `).join('') : '<div class="wc-discover-empty">还没有贴纸包，先在上面创建一个</div>'}
            </div>
        </div>
    `);
}

function ensureWechatStickerImportPack() {
    const data = getStickerPacks();
    data.packs = Array.isArray(data.packs) ? data.packs : [];
    const nameInput = document.getElementById('wc-sticker-new-pack-name');
    const select = document.getElementById('wc-sticker-import-pack');
    const newName = (nameInput?.value || '').trim();

    if (newName) {
        const pack = { id: 'pack_' + Date.now(), name: newName.slice(0, 24), stickers: [] };
        data.packs.push(pack);
        saveStickerPacks(data);
        window._wechatStickerImportPackId = pack.id;
        return pack;
    }

    const editablePacks = getEditableStickerPacks(data);
    const packId = select?.value || window._wechatStickerImportPackId || editablePacks[0]?.id || '';
    const pack = editablePacks.find(item => item.id === packId);
    if (pack) {
        window._wechatStickerImportPackId = pack.id;
        return pack;
    }

    const fallbackPack = { id: 'pack_' + Date.now(), name: '我的贴纸', stickers: [] };
    data.packs.push(fallbackPack);
    saveStickerPacks(data);
    window._wechatStickerImportPackId = fallbackPack.id;
    return fallbackPack;
}

function appendWechatStickersToPack(packId, stickers) {
    if (!stickers.length) return false;
    const data = getStickerPacks();
    data.packs = Array.isArray(data.packs) ? data.packs : [];
    if (isWechatBuiltinStickerPackId(packId)) return false;
    const pack = getEditableStickerPacks(data).find(item => item.id === packId);
    if (!pack) return false;
    pack.stickers = Array.isArray(pack.stickers) ? pack.stickers : [];
    const existingUrls = new Set(pack.stickers.map(item => item.url));
    const fresh = stickers.filter(item => item && item.url && !existingUrls.has(item.url));
    if (!fresh.length) {
        window._wechatStickerImportPackId = pack.id;
        window._activeStickerPackId = pack.id;
        refreshStickerSurfaces();
        return false;
    }
    pack.stickers.push(...fresh);
    saveStickerPacks(data);
    window._wechatStickerImportPackId = pack.id;
    window._activeStickerPackId = pack.id;
    refreshStickerSurfaces();
    return true;
}

function ensureWechatNamedStickerPack(name) {
    const data = getStickerPacks();
    data.packs = Array.isArray(data.packs) ? data.packs : [];
    const packName = (name || '图床贴纸包').trim().slice(0, 24);
    let pack = data.packs.find(item => item.name === packName);
    if (!pack) {
        pack = { id: 'pack_' + Date.now(), name: packName, stickers: [] };
        data.packs.push(pack);
        saveStickerPacks(data);
    }
    window._wechatStickerImportPackId = pack.id;
    window._activeStickerPackId = pack.id;
    return pack;
}

function getBoltpShareSlug(url) {
    const text = String(url || '').trim();
    const match = text.match(/boltp\.com\/shares\/([^/?#]+)/i) || text.match(/^([a-f0-9]{24,64})$/i);
    return match ? match[1] : '';
}

async function importBoltpStickerShare() {
    const input = document.getElementById('wc-sticker-share-url');
    const rawUrl = input?.value || 'https://www.boltp.com/shares/26c3884813ed4f4999b78e49d448f2e6';
    const slug = getBoltpShareSlug(rawUrl);
    if (!slug) {
        showWechatToast('没有识别到 Boltp 分享链接');
        return;
    }
    showWechatToast('正在读取图床分享...');
    try {
        const detailRes = await fetch(`https://www.boltp.com/api/v2/shares/${encodeURIComponent(slug)}`, { credentials: 'omit' });
        const detail = await detailRes.json();
        const share = detail?.data || {};
        if (detail?.status === 'error' || share.is_valid === false) throw new Error(detail?.message || '分享不可访问');
        const packName = share.album?.name || share.content || '图床贴纸包';
        const stickers = [];
        let page = 1;
        let lastPage = 1;
        do {
            const res = await fetch(`https://www.boltp.com/api/v2/shares/${encodeURIComponent(slug)}/photos?page=${page}&per_page=100`, { credentials: 'omit' });
            const json = await res.json();
            if (json?.status === 'error') throw new Error(json?.message || '图片列表读取失败');
            const box = json?.data || {};
            const photos = Array.isArray(box.data) ? box.data : [];
            photos.forEach(photo => {
                const url = photo.public_url || photo.thumbnail_url;
                if (!url) return;
                stickers.push({
                    id: 'stk_boltp_' + photo.id,
                    name: photo.name || `贴纸${stickers.length + 1}`,
                    url
                });
            });
            lastPage = Number(box.meta?.last_page) || page;
            page += 1;
        } while (page <= lastPage && stickers.length < 500);
        if (!stickers.length) throw new Error('分享里没有可导入图片');
        const pack = ensureWechatNamedStickerPack(packName);
        const before = (pack.stickers || []).length;
        appendWechatStickersToPack(pack.id, stickers);
        const after = (getStickerPacks().packs.find(item => item.id === pack.id)?.stickers || []).length;
        showWechatToast(`已导入 ${Math.max(0, after - before)} 张到「${packName}」`);
        openWechatStickerStore();
    } catch (e) {
        showWechatToast(e.message || '图床分享导入失败');
    }
}
window.importBoltpStickerShare = importBoltpStickerShare;

function importWechatStickerUrls() {
    const textEl = document.getElementById('wc-sticker-url-import');
    const stickers = parseStickerBatchText(textEl?.value || '');
    if (!stickers.length) {
        showWechatToast('没有识别到图片 URL');
        return;
    }
    const pack = ensureWechatStickerImportPack();
    if (appendWechatStickersToPack(pack.id, stickers)) {
        showWechatToast(`已导入 ${stickers.length} 张`);
        openWechatStickerStore();
    }
}

function importWechatStickerLocalFiles(input) {
    const files = Array.from(input.files || []).filter(file => /^image\//i.test(file.type)).slice(0, 30);
    if (!files.length) return;
    const pack = ensureWechatStickerImportPack();
    let remaining = files.length;
    const stickers = [];
    files.forEach(file => {
        const reader = new FileReader();
        reader.onload = e => {
            stickers.push({
                id: 'stk_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
                name: file.name.replace(/\.[^.]+$/, '') || '本地贴纸',
                url: e.target.result
            });
            remaining -= 1;
            if (remaining === 0) {
                appendWechatStickersToPack(pack.id, stickers);
                input.value = '';
                showWechatToast(`已导入 ${stickers.length} 张`);
                openWechatStickerStore();
            }
        };
        reader.readAsDataURL(file);
    });
}

