    // ---- create ----
    function freshDraft(prefill = {}) {
        const source = state.source;
        const sourceChar = source && charById(source.charId);
        // A forum NPC post or user post has no character: ask instead of silently picking the first one.
        const needsChar = !!source && !sourceChar && !prefill.charId;
        const charId = needsChar ? '' : String(prefill.charId || sourceChar?.id || chars()[0]?.id || '');
        return {
            type: prefill.type || 'webtoon',
            charId,
            personaId: '',
            origin: source ? (source.kind === 'chat' ? 'chat' : source.kind) : 'chat',
            plot: prefill.plot || (source && source.kind !== 'chat' ? source.text || '' : ''),
            panels: typeOf(prefill.type || 'webtoon').defaultPanels,
            option: '',
            optionCustom: '',
            styleKey: 'manhwa',
            styleCustom: '',
            title: prefill.title || '',
            needsChar
        };
    }
    function typeCardArt(key) {
        const art = {
            webtoon: '<i></i><i></i><i></i>',
            yonkoma: '<i></i><i></i><i></i><i></i>',
            illust: '<i></i><b></b>',
            photo: '<i></i>',
            couple: '<i class="ri-hearts-fill"></i>',
            wallpaper: '<i></i><b>12:30</b>',
            poster: '<i></i><b></b><b></b>',
            special: '<i class="ri-sparkling-2-fill"></i><i></i>'
        }[key];
        return `<span class="ct-type-art art-${key}">${art}</span>`;
    }
    function createBody(draft) {
        const type = typeOf(draft.type);
        const char = charById(draft.charId);
        const personas = typeof getWechatUserPersonaLibrary === 'function' ? getWechatUserPersonaLibrary() : [];
        const user = profile(char);
        const route = imageRoute();
        const options = TYPE_OPTIONS[draft.type];
        const rows = draft.origin === 'chat' ? historyRows(char) : [];
        const origins = [['chat', '聊天选段'], ['custom', '自己写'], ['char', `交给 ${char ? nameOf(char) : 'Char'}`]];
        if (state.source && !['chat'].includes(state.source.kind)) origins.unshift([state.source.kind, state.source.kind === 'dream' ? '梦境记录' : '论坛帖子']);
        return `
            <section class="ct-form-section"><h3>作品类型</h3><div class="ct-type-grid">${TYPE_ORDER.map(key => `<button type="button" data-action="draft-type" data-id="${key}" class="${draft.type === key ? 'active' : ''}">${typeCardArt(key)}<strong>${esc(typeOf(key).label)}</strong><small>${esc(typeOf(key).desc)}</small></button>`).join('')}</div></section>
            <section class="ct-form-section"><h3>主角</h3>${chars().length ? `<div class="ct-pick-row">${chars().map(item => `<button type="button" data-action="draft-char" data-id="${esc(item.id)}" class="${String(item.id) === draft.charId ? 'active' : ''}"><span class="ct-avatar">${avatarOf(item) ? `<img src="${esc(avatarOf(item))}" alt="" onerror="this.remove()">` : ''}<i>${esc(nameOf(item).slice(0, 1))}</i></span><em>${esc(nameOf(item))}</em></button>`).join('')}</div>` : '<p class="ct-muted">请先在微信里创建角色。</p>'}${draft.needsChar ? '<p class="ct-warn">这段内容来自论坛或梦境，请选择要画的角色。</p>' : ''}
                <label class="ct-field"><span>User 人设</span><select data-draft="personaId"><option value="">当前人设 · ${esc(user.name || '我')}</option>${personas.map(item => `<option value="${esc(item.id)}" ${item.id === draft.personaId ? 'selected' : ''}>${esc(item.title || item.name || '人设')}</option>`).join('')}</select></label></section>
            <section class="ct-form-section"><h3>剧情</h3><div class="ct-segment">${origins.map(([key, label]) => `<button type="button" data-action="draft-origin" data-id="${esc(key)}" class="${draft.origin === key ? 'active' : ''}">${esc(label)}</button>`).join('')}</div>
                ${draft.origin === 'chat' ? `<div class="ct-history"><div class="ct-history-head"><strong>选择要改编的聊天</strong><small>不选则用最近 12 条</small></div><div class="ct-history-list">${rows.map(row => `<label><input type="checkbox" data-history="${esc(row.key)}" ${state.selectedHistory.has(row.key) ? 'checked' : ''}><span><b>${esc(row.speaker)}</b>${esc(row.text.slice(0, 120))}</span></label>`).join('') || '<p class="ct-muted">和这个角色还没有聊天记录，换成“自己写”试试。</p>'}</div></div>` : ''}
                <label class="ct-field"><span>${draft.origin === 'custom' ? '想看的剧情' : draft.origin === 'char' ? '给 Char 的提示（可选）' : ['dream', 'forum'].includes(draft.origin) ? '原文' : '补充要求（可选）'}</span><textarea data-draft="plot" rows="${draft.origin === 'custom' || ['dream', 'forum'].includes(draft.origin) ? 5 : 2}" placeholder="${draft.origin === 'custom' ? '比如：下雨的晚上，他来接我下班……' : '比如：结局甜一点、他吃醋、换成古风背景'}">${esc(draft.plot)}</textarea></label></section>
            ${options ? `<section class="ct-form-section"><h3>${esc(options.label)}</h3><div class="ct-chips">${options.chips.map(chip => `<button type="button" data-action="draft-option" data-id="${esc(chip)}" class="${draft.option === chip ? 'active' : ''}">${esc(chip)}</button>`).join('')}</div><input class="ct-input" data-draft="optionCustom" maxlength="60" placeholder="或者自己写" value="${esc(draft.optionCustom)}"></section>` : ''}
            ${type.panels[0] !== type.panels[1] ? `<section class="ct-form-section"><h3>格数 <b data-panel-count>${draft.panels}</b></h3><input class="ct-range" type="range" data-draft="panels" min="${type.panels[0]}" max="${type.panels[1]}" value="${draft.panels}"></section>` : ''}
            <section class="ct-form-section"><h3>画风</h3><div class="ct-chips">${STYLE_PRESETS.map(style => `<button type="button" data-action="draft-style" data-id="${style.key}" class="${draft.styleKey === style.key ? 'active' : ''}">${esc(style.label)}</button>`).join('')}<button type="button" data-action="draft-style" data-id="custom" class="${draft.styleKey === 'custom' ? 'active' : ''}">自定义</button></div>${draft.styleKey === 'custom' ? `<input class="ct-input" data-draft="styleCustom" maxlength="200" placeholder="${route.provider === 'novelai' ? '英文画风标签，例如 watercolor, pastel colors' : '描述你想要的画风'}" value="${esc(draft.styleCustom)}">` : ''}</section>
            ${type.series ? `<section class="ct-form-section"><h3>作品名（可选）</h3><input class="ct-input" data-draft="title" maxlength="30" placeholder="留空由 Char 起名" value="${esc(draft.title)}"></section>` : ''}
            <section class="ct-form-section ct-route"><div><span>生图服务</span><strong class="${route.provider ? '' : 'missing'}">${esc(route.provider ? route.label : '未配置生图服务')}</strong></div><button type="button" data-action="open-settings">设置</button></section>
            ${route.provider === 'api' ? `<section class="ct-form-section"><h3>参考图（可选）</h3><div class="ct-ref-grid"><label class="ct-file"><i class="ri-user-smile-line"></i><span>Char 参考图</span><input type="file" data-ref="charRef" accept="image/png,image/jpeg,image/webp"></label><label class="ct-file"><i class="ri-user-heart-line"></i><span>User 参考图</span><input type="file" data-ref="userRef" accept="image/png,image/jpeg,image/webp"></label></div><p class="ct-muted">不上传时使用角色头像和 User 人设头像。</p></section>` : ''}
            <div class="ct-cta"><button type="button" class="ct-primary" data-action="create-submit"${chars().length ? '' : ' disabled'}>生成分镜</button></div>`;
    }
    function createView() {
        state.view = 'create';
        if (!state.draft) state.draft = freshDraft();
        frame({ title: '新作品', back: 'home', body: createBody(state.draft), className: 'ct-create' });
    }
    function refreshCreate() {
        const main = root()?.querySelector('.ct-main');
        if (!main || state.view !== 'create') return;
        const top = main.scrollTop;
        main.innerHTML = createBody(state.draft);
        main.scrollTop = top;
    }
    async function createSubmit() {
        const draft = state.draft;
        const char = charById(draft.charId);
        if (!char) throw new Error('请先选择角色');
        const route = imageRoute();
        if (!route.provider) throw new Error('还没有可用的生图服务：设置 → API → 生图服务');
        if (draft.origin === 'custom' && !draft.plot.trim()) throw new Error('写一句想看的剧情吧');
        const persona = (typeof getWechatUserPersonaLibrary === 'function' ? getWechatUserPersonaLibrary() : []).find(item => item.id === draft.personaId);
        const user = persona || profile(char);
        const style = styleOf(draft.styleKey);
        const type = typeOf(draft.type);
        const history = draft.origin === 'chat' || draft.origin === 'char' ? transcript(char) : '';
        if (draft.origin === 'chat' && !history) throw new Error('这个角色还没有聊天记录，换成“自己写”或“交给 Char”吧');
        const now = Date.now();
        const book = upgradeBook({
            id: id('series'), type: draft.type, title: draft.title.trim() || '', titleLocked: !!draft.title.trim(), logline: '',
            charId: char.id, charName: nameOf(char), personaId: user.id || user.personaId || '', userName: user.name || 'User', userBio: user.bio || '',
            status: 'draft', source: draft.origin, styleKey: draft.styleKey,
            style: draft.styleKey === 'custom' ? draft.styleCustom.trim() : style?.text || '',
            styleTags: draft.styleKey === 'custom' ? (route.provider === 'novelai' ? draft.styleCustom.trim() : '') : style?.tags || '',
            option: [draft.option, draft.optionCustom.trim()].filter(Boolean).join('；'),
            charRef: draft.charRef || charReference(char), userRef: draft.userRef || user.avatar || profile(char).avatar || '',
            createdAt: now, updatedAt: now, coverKey: '', chapters: []
        });
        if (!book.title) book.title = `${book.charName}的${type.short}`;
        const part = { id: id('chapter'), title: type.series ? '第1话' : book.title, source: draft.origin, plot: draft.plot.trim(), transcript: history, panelTarget: draft.panels, createdAt: now, updatedAt: now, panels: [], comments: [], progress: 0, state: 'planning' };
        book.chapters.push(part);
        await save(book);
        state.seriesId = book.id; state.chapterId = part.id; state.source = null; state.draft = null; state.selectedHistory.clear();
        await editor();
        launch(() => planChapter(book.id, part.id, { panels: draft.panels }));
    }
