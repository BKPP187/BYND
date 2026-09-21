// 内置角色库：把随包发布的原创角色一键加入联系人；添加后与导入的角色卡完全一致。
(() => {
    const PROMPTED_KEY = 'bynd_builtin_library_prompted_v1';
    const escape = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
    const library = () => (window.ByndBuiltinCharacters && Array.isArray(window.ByndBuiltinCharacters.characters)) ? window.ByndBuiltinCharacters.characters : [];
    const roster = () => Array.isArray(window.myCharacters) ? window.myCharacters : [];
    const monogram = (name, accent) => 'data:image/svg+xml,' + encodeURIComponent(
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><rect width="200" height="200" rx="100" fill="${accent || '#2b2b2b'}"/><text x="100" y="120" text-anchor="middle" font-family="serif" font-size="88" font-weight="700" fill="#fff">${escape(Array.from(String(name || '')).slice(0, 1).join(''))}</text></svg>`
    );
    function list() {
        return library().map(item => {
            const char = findAdded(item.id);
            const status = char ? artwork(item, char) : null;
            return { ...item, added: !!char, status, complete: status ? complete(status) : false };
        });
    }
    // Characters added before builtinId was persisted are recognised by name plus a signature phrase of the card,
    // so an edited description still matches while a user's own character of the same name does not.
    function matches(item, char) {
        if (!char || !item || char.isGroupChat) return false;
        if (char.builtinId) return char.builtinId === item.id;
        if (char.name !== item.name) return false;
        const text = String(char.description || '');
        return text.startsWith('【角色描述】') || (Array.isArray(item.signature) && item.signature.some(phrase => phrase && text.includes(phrase)));
    }
    const inline = value => /^data:image\//i.test(String(value || ''));
    // What is still missing for an added character; drives the picker status and the repair.
    function artwork(item, char) {
        const gallery = Array.isArray(char?.avatarGallery) ? char.avatarGallery : [];
        const wanted = 1 + (Array.isArray(item.avatars) ? item.avatars.length : 0);
        return {
            gallery: gallery.filter(inline).length,
            galleryWanted: wanted,
            cover: inline(char?.coverImage),
            coverWanted: !!item.cover,
            reference: inline(char?.chatConfig?.imageReference),
            referenceWanted: !!item.reference,
            background: inline(char?.chatConfig?.chatBgImage),
            backgrounds: (Array.isArray(char?.chatConfig?.chatBgGallery) ? char.chatConfig.chatBgGallery : []).filter(inline).length,
            backgroundsWanted: Array.isArray(item.backgrounds) ? item.backgrounds.length : 0
        };
    }
    function complete(status) {
        return status.gallery >= status.galleryWanted && (!status.coverWanted || status.cover) && (!status.referenceWanted || status.reference)
            && status.backgrounds >= status.backgroundsWanted && (!(status.coverWanted || status.backgroundsWanted) || status.background);
    }
    // The user-side persona that pairs with a shipped character lives in the user persona library, not in the card.
    const USER_PERSONA_KEY = 'wechat_user_persona_library_v1';
    function personaId(item) { return 'persona_builtin_' + item.id; }
    function readPersonas() {
        try { const parsed = JSON.parse(localStorage.getItem(USER_PERSONA_KEY) || '[]'); return Array.isArray(parsed) ? parsed : []; }
        catch (_) { return []; }
    }
    function ensureUserPersona(item) {
        if (!item.userPersona || typeof localStorage === 'undefined') return false;
        const personas = readPersonas();
        if (personas.some(entry => entry && entry.id === personaId(item))) return false;
        personas.push({ id: personaId(item), builtinId: item.id, name: '', title: item.userPersona.title || item.name, bio: item.userPersona.bio || '', signature: item.userPersona.signature || '', updatedAt: Date.now() });
        try { localStorage.setItem(USER_PERSONA_KEY, JSON.stringify(personas.slice(0, 30))); } catch (_) { return false; }
        return true;
    }
    // Apply the shipped persona to this chat only while the user has not written their own bio or signature.
    function applyUserPersona(item, char) {
        if (!item.userPersona) return false;
        const current = char.chatConfig?.userProfile || {};
        if (current.bio || current.signature || current.personaId) return false;
        char.chatConfig = { ...(char.chatConfig || {}), userProfile: { ...current, bio: item.userPersona.bio || '', signature: item.userPersona.signature || '', personaId: personaId(item) } };
        return true;
    }
    // Text that used to live in the shipped cards and has since been removed from the library; stripped from added copies too.
    const RETIRED_CARD_TEXT = [
        /\r?\n?关于用户本人的身份、外貌与经历，以聊天设置里用户自己填写的资料为准，不要替用户设定。/g,
        /(?:\r?\n)*\r?\n【对话样例】\r?\n<START>[\s\S]*?(?=\r?\n【|$)/g
    ];
    function cleanDescription(text) {
        let out = String(text || '');
        RETIRED_CARD_TEXT.forEach(pattern => { out = out.replace(pattern, ''); });
        return out.replace(/\s+$/, '');
    }
    function findAdded(id) {
        const item = library().find(entry => entry.id === id);
        return item ? roster().find(char => matches(item, char)) || null : null;
    }
    function isAdded(id) {
        return !!findAdded(id);
    }
    function ready() {
        const state = window._wechatCharactersStorageState;
        return !state || state.status === 'ready';
    }
    // Inside the Android app the page is a file:// document; fetch cannot read packaged files there but XHR can.
    function readBlobViaXhr(url) {
        return new Promise((resolve, reject) => {
            if (typeof XMLHttpRequest !== 'function') { reject(new Error('no XMLHttpRequest')); return; }
            const request = new XMLHttpRequest();
            request.open('GET', url);
            request.responseType = 'blob';
            request.timeout = 15000;
            request.onload = () => (request.status === 200 || request.status === 0) && request.response && request.response.size ? resolve(request.response) : reject(new Error('HTTP ' + request.status));
            request.onerror = request.ontimeout = () => reject(new Error('本地文件读取失败'));
            request.send();
        });
    }
    async function readDataUrl(url) {
        // A classic-script bundle avoids file:// CORS restrictions in desktop browsers.
        const bundled = window.ByndBuiltinArtwork?.[url];
        if (inline(bundled)) return bundled;
        let blob;
        try {
            blob = await readBlobViaXhr(url);
        } catch (_) {
            const response = await fetch(url, { cache: 'force-cache' });
            if (!response.ok) throw new Error('HTTP ' + response.status);
            blob = await response.blob();
        }
        if (!blob || !blob.size) throw new Error('empty file');
        const type = /^image\//i.test(blob.type || '') ? blob.type : (/\.png(\?|$)/i.test(url) ? 'image/png' : 'image/jpeg');
        if (blob.type !== type) blob = new Blob([blob], { type });
        return await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result || ''));
            reader.onerror = () => reject(reader.error);
            reader.readAsDataURL(blob);
        });
    }
    // Alternate avatars ship inline too; the character settings gallery lets the user switch between them.
    async function readGallery(item) {
        const list = Array.isArray(item.avatars) ? item.avatars : [];
        const out = [];
        for (const url of list) {
            try { out.push(await readDataUrl(url)); }
            catch (error) { console.warn('内置角色备用头像未能读取', url, error); }
        }
        return out;
    }
    async function readAvatar(item) {
        // Prefer an inline copy so the avatar survives backups and offline packaging changes.
        try {
            return await readDataUrl(item.avatar);
        } catch (_) {
            return await new Promise(resolve => {
                if (typeof Image !== 'function') { resolve(''); return; }
                const image = new Image();
                image.onload = () => resolve(item.avatar);
                image.onerror = () => resolve('');
                image.src = item.avatar;
            });
        }
    }
    function build(item, avatar, gallery = [], extras = {}) {
        const main = avatar || monogram(item.name, item.accent);
        return {
            id: 'char_' + Date.now() + '_' + Math.random().toString(16).slice(2, 8),
            builtinId: item.id,
            name: item.name,
            description: item.description || '',
            avatar: main,
            avatarGallery: [main, ...gallery].filter((url, index, all) => url && all.indexOf(url) === index),
            coverImage: extras.cover || '',
            lastMsg: '',
            worldBook: Array.isArray(item.worldBook) ? item.worldBook.map(entry => ({ ...entry })) : [],
            regex: [],
            alternates: Array.isArray(item.alternates) ? item.alternates.slice() : [],
            first_mes_original: item.first_mes || '',
            currentGreetingIndex: 0,
            first_mes: item.first_mes || '',
            chatConfig: {
                ...(extras.reference ? { imageReference: extras.reference } : {}),
                ...(extras.backgrounds?.length ? { chatBgGallery: extras.backgrounds.slice() } : {}),
                ...(extras.backgrounds?.[0] || extras.cover ? { chatBgImage: extras.backgrounds?.[0] || extras.cover } : {})
            },
            history: []
        };
    }
    // Optional artwork: the 9:16 world-book cover and the image-generation reference. Missing files are skipped.
    async function readExtras(item) {
        const extras = {};
        for (const [key, url] of [['cover', item.cover], ['reference', item.reference]]) {
            if (!url) continue;
            try { extras[key] = await readDataUrl(url); }
            catch (error) { console.warn('内置角色附图未能读取', url, error); }
        }
        extras.backgrounds = [];
        for (const url of item.backgrounds || []) {
            try { extras.backgrounds.push(await readDataUrl(url)); }
            catch (error) { console.warn('内置角色聊天背景未能读取', url, error); }
        }
        return extras;
    }
    async function add(id) {
        const item = library().find(entry => entry.id === id);
        if (!item) throw new Error('没有这个内置角色。');
        if (!ready()) throw new Error('角色数据还在加载，请稍后再试。');
        const existing = findAdded(id);
        if (existing) return existing;
        const avatar = await readAvatar(item);
        const gallery = await readGallery(item);
        const extras = await readExtras(item);
        const char = build(item, avatar, gallery, extras);
        ensureUserPersona(item);
        applyUserPersona(item, char);
        roster().push(char);
        let saved = true;
        try {
            saved = typeof saveCharactersToStorage === 'function' ? await saveCharactersToStorage() : true;
        } catch (error) {
            saved = false;
        }
        if (saved === false) {
            const index = roster().indexOf(char);
            if (index >= 0) roster().splice(index, 1);
            throw new Error('角色没有保存成功，请检查存储空间后重试。');
        }
        if (typeof renderChatList === 'function') renderChatList();
        return char;
    }
    // Fill artwork that an earlier add could not read (file:// fetch, offline); never touch what the user changed.
    const repairErrors = new Map();
    async function repairOne(item, char) {
        let changed = false;
        const errors = [];
        const attempt = async (label, url, apply) => {
            try { apply(await readDataUrl(url)); changed = true; }
            catch (error) { errors.push(`${label}：${error && error.message ? error.message : error}`); }
        };
        if (!char.builtinId) { char.builtinId = item.id; changed = true; }
        const cleaned = cleanDescription(char.description);
        if (cleaned !== String(char.description || '')) { char.description = cleaned; changed = true; }
        const paths = [item.avatar, ...(Array.isArray(item.avatars) ? item.avatars : [])].filter(Boolean);
        const gallery = (Array.isArray(char.avatarGallery) ? char.avatarGallery : []).filter(entry => !paths.includes(entry));
        if (gallery.length !== (Array.isArray(char.avatarGallery) ? char.avatarGallery.length : 0)) changed = true;
        if (!inline(char.avatar)) await attempt('主头像', item.avatar, data => { char.avatar = data; });
        if (inline(char.avatar) && !gallery.includes(char.avatar)) { gallery.unshift(char.avatar); changed = true; }
        const status = artwork(item, char);
        for (const url of item.avatars || []) {
            const bundled = window.ByndBuiltinArtwork?.[url];
            if (bundled && gallery.includes(bundled)) continue;
            if (!bundled && status.gallery >= status.galleryWanted) continue;
            try {
                const data = await readDataUrl(url);
                if (!gallery.includes(data)) { gallery.push(data); changed = true; }
            } catch (error) { errors.push(`备用头像：${error.message || error}`); }
        }
        char.avatarGallery = gallery;
        if (status.coverWanted && !status.cover) await attempt('世界书封面', item.cover, data => { char.coverImage = data; });
        char.chatConfig = char.chatConfig || {};
        if (status.referenceWanted && !status.reference) await attempt('自画像参考图', item.reference, data => { char.chatConfig.imageReference = data; });
        // Shipped chat backgrounds: fill the gallery, then default the background to the first one. A background the user picked is kept;
        // the cover that an earlier release used as a stand-in is replaced.
        const bgGallery = Array.isArray(char.chatConfig.chatBgGallery) ? char.chatConfig.chatBgGallery.slice() : [];
        for (const url of item.backgrounds || []) {
            const bundled = window.ByndBuiltinArtwork?.[url];
            if (bundled && bgGallery.includes(bundled)) continue;
            if (!bundled && status.backgrounds >= status.backgroundsWanted) continue;
            try { const data = await readDataUrl(url); if (!bgGallery.includes(data)) { bgGallery.push(data); changed = true; } }
            catch (error) { errors.push(`聊天背景：${error.message || error}`); }
        }
        if (bgGallery.length) char.chatConfig.chatBgGallery = bgGallery;
        const current = char.chatConfig.chatBgImage;
        const standIn = !inline(current) || (inline(char.coverImage) && current === char.coverImage);
        if (standIn && bgGallery[0]) { char.chatConfig.chatBgImage = bgGallery[0]; changed = true; }
        else if (!inline(current) && inline(char.coverImage)) { char.chatConfig.chatBgImage = char.coverImage; changed = true; }
        if (ensureUserPersona(item)) changed = true;
        if (applyUserPersona(item, char)) changed = true;
        if (errors.length) repairErrors.set(item.id, errors.join('；')); else repairErrors.delete(item.id);
        return { changed, errors };
    }
    async function runRepair(onlyId = '') {
        if (!ready()) return { repaired: [], errors: {} };
        const repaired = [];
        const errors = {};
        const snapshots = [];
        for (const item of library()) {
            if (onlyId && item.id !== onlyId) continue;
            const char = findAdded(item.id);
            if (!char) continue;
            const keys = ['builtinId', 'avatar', 'avatarGallery', 'coverImage', 'chatConfig', 'description'];
            snapshots.push({ char, values: Object.fromEntries(keys.map(key => [key, char[key]])) });
            char.chatConfig = { ...(char.chatConfig || {}) };
            const result = await repairOne(item, char);
            if (result.changed) repaired.push(char.name);
            if (result.errors.length) errors[item.id] = result.errors;
        }
        let saved = true;
        if (repaired.length) {
            try { saved = typeof saveCharactersToStorage === 'function' ? await saveCharactersToStorage() : true; } catch (_) { saved = false; }
            if (saved === false) {
                snapshots.forEach(({ char, values }) => Object.entries(values).forEach(([key, value]) => {
                    if (value === undefined) delete char[key]; else char[key] = value;
                }));
                repaired.length = 0;
                console.warn('内置角色素材未能保存，已恢复原数据');
            }
        }
        console.info('内置角色素材检查', { repaired, errors, saved });
        return { repaired, errors, saved };
    }
    let repairQueue = Promise.resolve();
    function repair(onlyId = '') {
        const pending = repairQueue.then(() => runRepair(onlyId));
        repairQueue = pending.catch(() => {});
        return pending;
    }
    function avatarOptions(char) {
        const item = library().find(entry => matches(entry, char));
        const paths = item ? [item.avatar, ...(item.avatars || [])] : [];
        return (char.avatarGallery || []).map((src, index) => {
            const position = paths.findIndex(url => src === url || src === window.ByndBuiltinArtwork?.[url]);
            return `${index + 1}：${position >= 0 ? item.avatarLabels?.[position] || '备用头像' : '自定义头像'}${src === char.avatar ? '（当前）' : ''}`;
        });
    }
    function backgroundOptions(char) {
        const item = library().find(entry => matches(entry, char));
        const paths = item ? (item.backgrounds || []) : [];
        const current = char.chatConfig?.chatBgImage;
        return (char.chatConfig?.chatBgGallery || []).map((src, index) => {
            const position = paths.findIndex(url => src === url || src === window.ByndBuiltinArtwork?.[url]);
            return `${index + 1}：${position >= 0 ? item.backgroundLabels?.[position] || '内置背景' : '自定义背景'}${src === current ? '（当前）' : ''}`;
        });
    }
    function lastError(id) {
        return repairErrors.get(id) || '';
    }
    function open() {
        if (typeof document === 'undefined') return;
        close();
        const root = document.getElementById('app-wechat-window') || document.body;
        const overlay = document.createElement('div');
        overlay.id = 'bynd-builtin-library';
        overlay.className = 'wc-modal-overlay bynd-builtin-overlay';
        overlay.addEventListener('click', event => { if (event.target === overlay) close(); });
        root.appendChild(overlay);
        render();
        try { localStorage.setItem(PROMPTED_KEY, '1'); } catch (_) {}
        if (roster().length && !repairing) { repairing = true; repair().then(() => { repairing = false; render(); }, () => { repairing = false; render(); }); }
    }
    function close() {
        document.getElementById('bynd-builtin-library')?.remove();
    }
    function render(status = '') {
        const overlay = document.getElementById('bynd-builtin-library');
        if (!overlay) return;
        const items = list();
        overlay.innerHTML = `
            <div class="wc-char-card bynd-builtin-card" role="dialog" aria-modal="true" aria-labelledby="bynd-builtin-title">
                <div class="wc-card-header"><span id="bynd-builtin-title">内置角色</span><i class="ri-close-line" onclick="ByndBuiltinLibrary.close()" role="button" aria-label="关闭"></i></div>
                <div class="bynd-builtin-body">
                    <p class="bynd-builtin-intro">这些是随 BYND 一起提供的原创角色，添加后可以像导入的角色卡一样修改、删除或重新添加。</p>
                    ${items.map(item => `
                        <article class="bynd-builtin-item${item.added ? ' is-added' : ''}">
                            <img src="${escape(item.avatar)}" alt="" data-fallback="${escape(monogram(item.name, item.accent))}" onerror="this.onerror=null;this.src=this.dataset.fallback">
                            <div>
                                <strong>${escape(item.name)}</strong>
                                <p>${escape(item.tagline)}</p>
                                <div class="bynd-builtin-tags">${(item.tags || []).map(tag => `<span>${escape(tag)}</span>`).join('')}</div>
                            </div>
                            ${item.added ? `<button type="button" class="is-repair" ${item.complete ? 'disabled' : ''} onclick="ByndBuiltinLibrary.fix('${escape(item.id)}')">${item.complete ? '已添加' : '补齐素材'}</button>` : `<button type="button" onclick="ByndBuiltinLibrary.pick('${escape(item.id)}')">添加</button>`}
                            ${item.added ? `<p class="bynd-builtin-state${item.complete ? ' is-ok' : ''}">头像 ${item.status.gallery}/${item.status.galleryWanted} · 封面 ${item.status.cover ? '✓' : '缺'} · 参考图 ${item.status.reference ? '✓' : '缺'}${item.status.backgroundsWanted ? ` · 背景 ${item.status.backgrounds}/${item.status.backgroundsWanted}` : ''}${lastError(item.id) ? `<br>${escape(lastError(item.id))}` : ''}</p>` : ''}
                        </article>`).join('')}
                    ${items.length ? '' : '<p class="bynd-builtin-empty">内置角色文件没有加载，请刷新后重试。</p>'}
                    <p class="bynd-builtin-status" role="status">${escape(status)}</p>
                </div>
                <div class="wc-card-footer bynd-builtin-footer">
                    <button type="button" class="btn-confirm" ${items.length && items.some(item => !item.added) ? '' : 'disabled'} onclick="ByndBuiltinLibrary.pickAll()">全部添加</button>
                </div>
            </div>`;
    }
    let busy = false;
    let repairing = false;
    async function pick(id) {
        if (busy) return;
        busy = true;
        render('正在添加…');
        try {
            const char = await add(id);
            render(`已添加「${char.name}」。`);
            if (typeof showWechatToast === 'function') showWechatToast(`已添加 ${char.name}`);
        } catch (error) {
            render(error.message || '添加失败，请重试。');
        } finally {
            busy = false;
        }
    }
    async function fix(id) {
        if (busy) return;
        busy = true;
        render('正在补齐素材…');
        try {
            const result = await repair(id);
            const failed = result.errors[id];
            render(result.saved === false ? '素材没有保存成功，已恢复原数据，请重试。' : failed ? `有素材没能读取：${failed.join('；')}` : (result.repaired.length ? '素材已补齐。' : '素材本来就是完整的。'));
        } finally {
            busy = false;
        }
    }
    async function pickAll() {
        if (busy) return;
        busy = true;
        const pending = list().filter(item => !item.added);
        const added = [];
        let failure = '';
        for (const item of pending) {
            render(`正在添加 ${item.name}…`);
            try { added.push((await add(item.id)).name); }
            catch (error) { failure = error.message || '添加失败'; break; }
        }
        busy = false;
        render(failure ? `${added.length ? '已添加 ' + added.join('、') + '；' : ''}${failure}` : (added.length ? `已添加 ${added.join('、')}。` : '没有需要添加的角色。'));
        if (added.length && typeof showWechatToast === 'function') showWechatToast(`已添加 ${added.join('、')}`);
    }
    // First launch with an empty roster: offer the library once so the app is usable out of the box.
    function maybePrompt() {
        if (!ready() || roster().length || !library().length) return false;
        try { if (localStorage.getItem(PROMPTED_KEY)) return false; } catch (_) { return false; }
        open();
        return true;
    }
    window.ByndBuiltinLibrary = { list, isAdded, add, open, close, pick, pickAll, fix, maybePrompt, repair, artwork, monogram, avatarOptions, backgroundOptions };
})();
