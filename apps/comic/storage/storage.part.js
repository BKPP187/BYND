/* BYND comics: webtoon-style studio. Work types, storyboards and typesetting live here; image providers are chosen in Settings. */
(() => {
    'use strict';
    const DB = 'bynd_comics_v1';
    const DB_VERSION = 2;
    const root = () => document.getElementById('comic-root');
    const state = {
        view: 'home', tab: 'home', typeFilter: 'all', charFilter: '', shelfSort: 'updated',
        seriesId: '', chapterId: '', busy: false, source: null, selectedHistory: new Set(), status: '', statusError: false,
        draft: null, job: null, barsHidden: false, episodeOrder: 'desc'
    };
    const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
    const id = prefix => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const chars = () => (window.myCharacters || []).filter(char => char && char.id);
    const charById = charId => chars().find(char => String(char.id) === String(charId));
    const nameOf = char => typeof getWechatCharDisplayName === 'function' ? getWechatCharDisplayName(char) : (char?.name || '角色');
    const avatarOf = char => String(char?.avatar || '').trim();
    const date = time => time ? new Date(time).toLocaleDateString('zh-CN', { year: '2-digit', month: '2-digit', day: '2-digit' }).replace(/\//g, '.') : '—';
    const isRecent = time => Date.now() - Number(time || 0) < 3 * 86400000;
    const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
    const say = (message, error = false) => {
        state.status = message;
        state.statusError = error;
        const el = root()?.querySelector('.ct-status');
        if (el) {
            el.textContent = message;
            el.classList.toggle('error', error);
            el.classList.toggle('hidden', !message);
        }
        if (message && (!root() || !document.getElementById('app-comic-window')?.classList.contains('active')) && typeof showWechatToast === 'function') showWechatToast(message, 2600);
    };
    function db() {
        return new Promise((resolve, reject) => {
            if (!window.indexedDB) return reject(new Error('当前环境无法保存漫画：IndexedDB 不可用'));
            const request = indexedDB.open(DB, DB_VERSION);
            request.onupgradeneeded = () => {
                const database = request.result;
                for (const store of ['series', 'images', 'materials', 'profiles']) {
                    if (!database.objectStoreNames.contains(store)) database.createObjectStore(store, { keyPath: 'id' });
                }
            };
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error || new Error('漫画数据库打开失败'));
            request.onblocked = () => reject(new Error('漫画数据库正在被另一个页面占用，请关闭其他 BYND 页面后重试'));
        });
    }
    async function query(store, mode, action) {
        const database = await db();
        return new Promise((resolve, reject) => {
            let result;
            const tx = database.transaction(store, mode);
            const req = action(tx.objectStore(store));
            if (req) { req.onsuccess = () => { result = req.result; }; req.onerror = () => reject(req.error || new Error('数据库读写失败')); }
            tx.oncomplete = () => { database.close(); resolve(result); };
            tx.onerror = () => { database.close(); reject(tx.error || new Error('漫画保存失败')); };
            tx.onabort = () => { database.close(); reject(tx.error || new Error('漫画保存已中断')); };
        });
    }
    const all = store => query(store, 'readonly', object => object.getAll());
    const get = (store, key) => query(store, 'readonly', object => object.get(key));
    const put = (store, value) => query(store, 'readwrite', object => object.put(value));
    const remove = (store, key) => query(store, 'readwrite', object => object.delete(key));
    const series = async () => (await all('series')).map(upgradeBook).sort((a, b) => b.updatedAt - a.updatedAt);
    const current = async () => upgradeBook(await get('series', state.seriesId));
    const chapter = book => book?.chapters?.find(item => item.id === state.chapterId);
    const profile = char => typeof getWechatChatUserProfile === 'function' ? getWechatChatUserProfile(char) : (typeof getUserProfile === 'function' ? getUserProfile() : {});
    const charReference = char => typeof getWechatImageReferenceForChar === 'function' ? getWechatImageReferenceForChar(char) : (char?.chatConfig?.imageReference || char?.avatar || '');
    // Version 1 books were always vertical strips with one dialogue line per panel.
    function upgradeBook(book) {
        if (!book || typeof book !== 'object') return book;
        book.type = book.type || 'webtoon';
        book.cast = book.cast && typeof book.cast === 'object' ? book.cast : { char: '', user: '' };
        book.chapters = Array.isArray(book.chapters) ? book.chapters : [];
        for (const part of book.chapters) {
            part.panels = Array.isArray(part.panels) ? part.panels : [];
            part.comments = Array.isArray(part.comments) ? part.comments : [];
            for (const panel of part.panels) {
                panel.beat = panel.beat || panel.description || '';
                panel.shot = panel.shot || 'tall';
                panel.gutter = panel.gutter || 'normal';
                panel.tone = panel.tone === 'dark' ? 'dark' : 'light';
                panel.chars = Array.isArray(panel.chars) ? panel.chars : [];
                if (!Array.isArray(panel.bubbles)) {
                    panel.bubbles = panel.dialogue ? [{ id: id('bubble'), who: 'narration', kind: 'caption', text: String(panel.dialogue) }] : [];
                }
            }
        }
        return book;
    }
