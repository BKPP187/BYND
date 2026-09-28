// Local search: real app routes/settings labels plus module-owned content providers.
(function () {
    'use strict';
    const providers = new Map();
    const normalize = value => String(value || '').normalize('NFKC').toLocaleLowerCase().replace(/\s+/g, ' ').trim();
    function matches(item, query) { return normalize(`${item.title} ${item.detail || ''} ${item.keywords || ''}`).includes(normalize(query)); }
    function builtins() {
        const items = (typeof getDesktopAllAppDefinitions === 'function' ? getDesktopAllAppDefinitions() : []).map(app => ({ title: app.name, detail: '应用', run: () => openApp(app.id) }));
        document.querySelectorAll('[data-settings-tab]').forEach(tab => {
            const name = tab.dataset.settingsTab;
            items.push({ title: tab.textContent.trim(), detail: '设置', keywords: name === 'usage' ? 'Token 用量 API 费用' : name === 'about' ? '版本 来信 更新记录' : '', run: () => { openApp('settings'); window.openSettingsTab?.(name); } });
        });
        (window.myCharacters || []).filter(char => char?.id).forEach(char => {
            items.push({ title: char.chatConfig?.nickname || char.name, detail: '角色 · 聊天', run: () => { openApp('wechat'); openChat(char.id); } });
            (char.worldBook || []).forEach((entry, index) => {
                items.push({ title: entry.comment || entry.name || `世界书条目 ${index + 1}`, detail: `世界书 · ${char.name}`, keywords: entry.content || entry.entry || '', run: () => { openApp('worldbook'); renderBookDetail(char); openEntryDetail(index); } });
            });
            if (!char.isGroupChat) document.querySelectorAll('[data-chat-settings-page]:not([data-chat-settings-page="home"])').forEach(page => {
                const name = page.dataset.chatSettingsPage;
                items.push({ title: `${page.querySelector('h2')?.textContent || name} · ${char.name}`, detail: '聊天设置', keywords: page.textContent, run: () => { openApp('wechat'); openChat(char.id); openChatSettings(); openWechatChatSettingsPage(name); } });
            });
        });
        return items;
    }
    async function search(query) {
        if (!normalize(query)) return [];
        const items = builtins().filter(item => matches(item, query));
        const failures = [];
        const collect = async (name, provider) => { try { items.push(...await provider(query)); } catch (error) { failures.push(name); console.warn(`搜索读取失败：${name}`, error); } };
        for (const [name, provider] of providers) await collect(name, provider);
        await collect('论坛', () => (window.LivingWorld?.searchVisible?.(query) || []).map(post => ({ title: post.title, detail: '论坛 · 当前视角可见帖子', run: async () => { openApp('living-world'); await window._byndForumOpenPromise; window.LivingWorld.openPost(post.id); } })));
        if (window.ByndComic?.storage) await collect('漫画', async () => (await window.ByndComic.storage.all('series')).filter(book => matches({ title: book.title, detail: book.logline }, query)).map(book => ({ title: book.title, detail: `漫画 · ${book.charName || ''}`, run: async () => { openApp('comic'); await window._byndComicOpenPromise; await window.ByndComic.openBook(book.id); } })));
        if (typeof getWechatFavoritesStore === 'function') for (const item of getWechatFavoritesStore().items) {
            if (matches({ title: item.title, detail: item.text }, query)) items.push({ title: item.title || item.text?.slice(0, 50) || '收藏', detail: '微信 · 收藏', run: () => { openApp('wechat'); openWechatFavorites(); if (item.type === 'note') openWechatFavoriteNoteEditor(item.id); else renderWechatFavoriteList(query); } });
        }
        if (typeof getStudyCards === 'function') for (const card of getStudyCards()) {
            if (matches({ title: Object.values(card.lines || {}).join(' '), detail: card.note }, query)) items.push({ title: Object.values(card.lines || {}).join(' · ').slice(0, 70), detail: '学习 · 词本', run: () => { openApp('study'); window.ByndStudy.setTab('words'); window.ByndStudy.searchWords(query); } });
        }
        for (const char of window.myCharacters || []) (char.history || []).forEach((msg, index) => {
            const text = typeof msg.content === 'string' ? msg.content : '';
            if (text && normalize(text).includes(normalize(query))) items.push({ title: text.slice(0, 70), detail: `聊天记录 · ${char.name}`, run: () => { openApp('wechat'); openChat(char.id); openWechatSearchResult(index); } });
        });
        const found = items.slice(0, 60);
        found.partialErrors = failures;
        return found;
    }
    function open(initial = '') {
        if (document.getElementById('bynd-global-search')) return;
        const phone = document.querySelector('.phone-container');
        if (!phone) return;
        const previous = document.activeElement;
        const panel = document.createElement('section'); panel.id = 'bynd-global-search'; panel.className = 'bynd-search-panel'; panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-modal', 'true'); panel.setAttribute('aria-label', '全局搜索');
        const sheet = document.createElement('div'); sheet.className = 'bynd-search-sheet';
        const head = document.createElement('div'); head.className = 'bynd-search-head';
        const field = document.createElement('label'); field.className = 'bynd-search-field';
        const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); icon.setAttribute('class', 'bynd-search-leading'); icon.setAttribute('viewBox', '0 0 24 24'); icon.setAttribute('aria-hidden', 'true');
        icon.innerHTML = '<circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 5 5"/>';
        const input = document.createElement('input'); input.type = 'search'; input.placeholder = '应用、气泡、Token、世界书…'; input.setAttribute('aria-label', '搜索全部应用、设置和内容'); input.value = initial;
        const cancel = document.createElement('button'); cancel.type = 'button'; cancel.textContent = '取消';
        const results = document.createElement('div'); results.className = 'bynd-search-results'; results.setAttribute('aria-live', 'polite');
        field.append(icon, input); head.append(field, cancel); sheet.append(head, results); panel.append(sheet); phone.appendChild(panel);
        let generation = 0, debounce;
        const close = () => { generation++; clearTimeout(debounce); panel.remove(); if (previous?.isConnected) previous.focus({ preventScroll: true }); };
        const note = text => { results.replaceChildren(); const p = document.createElement('p'); p.textContent = text; results.appendChild(p); };
        const render = async () => {
            const own = ++generation, query = input.value.trim();
            if (!query) { note('想找什么？试试「气泡」「Token」「世界书」，也可以搜你们聊过的话。'); return; }
            note('正在找…');
            try {
                const items = await search(query);
                if (own !== generation || !panel.isConnected) return;
                if (!items.length) { note(items.partialErrors?.length ? `${items.partialErrors.join('、')}暂时无法读取，请稍后重试。` : '还没找到这件东西，换个词试试。'); return; }
                results.replaceChildren();
                const summary = document.createElement('div'); summary.className = 'bynd-search-summary'; summary.textContent = `搜索结果 · ${items.length}`; results.appendChild(summary);
                if (items.partialErrors?.length) { const warning = document.createElement('p'); warning.textContent = `${items.partialErrors.join('、')}暂时无法读取，其余结果仍可打开。`; results.appendChild(warning); }
                items.forEach(item => {
                    const button = document.createElement('button'); button.type = 'button'; button.className = 'bynd-search-result';
                    const title = document.createElement('strong'); title.textContent = item.title;
                    const detail = document.createElement('small'); detail.textContent = item.detail || '';
                    const arrow = document.createElement('span'); arrow.className = 'bynd-search-arrow'; arrow.textContent = '↗'; arrow.setAttribute('aria-hidden', 'true');
                    button.append(title, detail, arrow); results.appendChild(button);
                    button.addEventListener('click', async () => { close(); try { await item.run(); } catch (error) { console.warn('搜索跳转失败', error); window.showWechatToast?.('打开失败，请稍后重试'); } });
                });
            } catch (error) { if (own === generation) note('有些内容暂时读不到，请稍后重试。'); console.warn('全局搜索读取失败', error); }
        };
        input.addEventListener('input', () => { generation++; clearTimeout(debounce); debounce = setTimeout(render, 120); });
        cancel.addEventListener('click', close);
        panel.addEventListener('click', event => { if (event.target === panel) close(); });
        panel.addEventListener('keydown', event => {
            if (event.key === 'Escape') { event.preventDefault(); close(); }
            if (event.key === 'Tab') {
                const targets = [input, cancel, ...results.querySelectorAll('button')], index = targets.indexOf(document.activeElement);
                if (event.shiftKey && index <= 0) { event.preventDefault(); targets.at(-1).focus(); }
                else if (!event.shiftKey && index === targets.length - 1) { event.preventDefault(); input.focus(); }
            }
        });
        input.focus(); void render();
    }
    window.ByndSearch = { open, search, matches, register: (name, provider) => providers.set(name, provider) };
})();
