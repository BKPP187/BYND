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
        return library().map(item => ({ ...item, added: isAdded(item.id) }));
    }
    function isAdded(id) {
        return roster().some(char => char && char.builtinId === id);
    }
    function ready() {
        const state = window._wechatCharactersStorageState;
        return !state || state.status === 'ready';
    }
    async function readAvatar(item) {
        // Prefer an inline copy so the avatar survives backups and offline packaging changes.
        try {
            const response = await fetch(item.avatar, { cache: 'force-cache' });
            if (!response.ok) throw new Error('HTTP ' + response.status);
            const blob = await response.blob();
            if (!blob.size || !/^image\//i.test(blob.type || '')) throw new Error('not an image');
            return await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(String(reader.result || ''));
                reader.onerror = () => reject(reader.error);
                reader.readAsDataURL(blob);
            });
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
    function build(item, avatar) {
        return {
            id: 'char_' + Date.now() + '_' + Math.random().toString(16).slice(2, 8),
            builtinId: item.id,
            name: item.name,
            description: item.description || '',
            avatar: avatar || monogram(item.name, item.accent),
            lastMsg: '',
            worldBook: Array.isArray(item.worldBook) ? item.worldBook.map(entry => ({ ...entry })) : [],
            regex: [],
            alternates: Array.isArray(item.alternates) ? item.alternates.slice() : [],
            first_mes_original: item.first_mes || '',
            currentGreetingIndex: 0,
            first_mes: item.first_mes || '',
            chatConfig: {},
            history: []
        };
    }
    async function add(id) {
        const item = library().find(entry => entry.id === id);
        if (!item) throw new Error('没有这个内置角色。');
        if (!ready()) throw new Error('角色数据还在加载，请稍后再试。');
        if (isAdded(id)) return roster().find(char => char.builtinId === id);
        const avatar = await readAvatar(item);
        const char = build(item, avatar);
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
                            <button type="button" ${item.added ? 'disabled' : ''} onclick="ByndBuiltinLibrary.pick('${escape(item.id)}')">${item.added ? '已添加' : '添加'}</button>
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
    window.ByndBuiltinLibrary = { list, isAdded, add, open, close, pick, pickAll, maybePrompt, monogram };
})();
