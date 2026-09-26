    // ---- home / shelf / materials ----
    function heroSlide(book) {
        const part = latestChapter(book);
        const series = typeOf(book.type).series;
        return `<button type="button" class="ct-hero-slide" data-action="open-book" data-id="${esc(book.id)}"><div class="ct-hero-art" data-image="${esc(book.coverKey)}" data-alt="${esc(book.title)}"></div><div class="ct-hero-text">${typeBadge(book.type)}<strong>${esc(book.title)}</strong>${book.logline ? `<em>${esc(book.logline)}</em>` : ''}<small>${esc(book.charName)} × ${esc(book.userName)}${series && part ? ` · ${esc(part.title)}` : ''}</small></div></button>`;
    }
    function charRow() {
        const list = chars();
        if (!list.length) return '';
        const item = (key, label, avatar) => `<button type="button" data-action="char-filter" data-id="${esc(key)}" class="${state.charFilter === key ? 'active' : ''}"><span class="ct-avatar">${avatar ? `<img src="${esc(avatar)}" alt="" onerror="this.remove()">` : ''}<i>${esc(label.slice(0, 1))}</i></span><em>${esc(label)}</em></button>`;
        return `<div class="ct-char-row">${item('', '全部', '')}${list.map(char => item(String(char.id), nameOf(char), avatarOf(char))).join('')}</div>`;
    }
    function typeTabs() {
        return `<div class="ct-type-tabs">${['all', ...TYPE_ORDER].map(key => `<button type="button" data-action="type-filter" data-id="${key}" class="${state.typeFilter === key ? 'active' : ''}">${key === 'all' ? '全部' : esc(typeOf(key).short)}</button>`).join('')}</div>`;
    }
    const importInput = '<input id="ct-import-file" type="file" accept="application/json,.json" hidden>';
    async function home() {
        state.view = 'home'; state.tab = 'home';
        const books = await series();
        const filtered = books.filter(book => (state.typeFilter === 'all' || book.type === state.typeFilter) && (!state.charFilter || String(book.charId) === state.charFilter));
        const featured = books.filter(book => book.coverKey).slice(0, 5);
        const hero = featured.length
            ? `<section class="ct-hero"><div class="ct-hero-track">${featured.map(heroSlide).join('')}</div><span class="ct-hero-count">1 / ${featured.length}</span></section>`
            : `<section class="ct-intro"><span>BYND ORIGINAL</span><h1>把你们的故事<br>画成连载</h1><p>选角色和作品类型，Char 写分镜，生图后自动排版进书架。</p><button type="button" data-action="create">开始创作</button></section>`;
        const empty = `<div class="ct-empty"><i class="ri-book-open-line"></i><strong>${books.length ? '这个分类还没有作品' : '书架还是空的'}</strong><p>${books.length ? '换个分类看看，或者画一部新的。' : '从一段聊天、一个设定，或者让 Char 自己来想。'}</p><button type="button" data-action="create">新作品</button></div>`;
        frame({
            brand: true,
            tabs: true,
            right: '<button type="button" class="ct-icon" data-action="import-project" aria-label="导入漫画项目"><i class="ri-folder-download-line"></i></button>',
            body: `${hero}${charRow()}${typeTabs()}<div class="ct-grid">${filtered.map(posterCard).join('') || empty}</div><button type="button" class="ct-fab" data-action="create"><i class="ri-quill-pen-fill"></i><span>创作</span></button>${importInput}`
        });
        const track = root().querySelector('.ct-hero-track');
        if (track) track.onscroll = () => {
            const index = Math.round(track.scrollLeft / Math.max(1, track.clientWidth));
            const counter = root().querySelector('.ct-hero-count');
            if (counter) counter.textContent = `${index + 1} / ${featured.length}`;
        };
        await fillImages();
    }
    async function shelf() {
        state.view = 'shelf'; state.tab = 'shelf';
        const books = await series();
        if (state.shelfSort === 'created') books.sort((a, b) => b.createdAt - a.createdAt);
        const row = book => {
            const read = book.chapters.find(part => part.id === book.lastReadId);
            return `<button type="button" class="ct-shelf-row" data-action="open-book" data-id="${esc(book.id)}"><div class="ct-shelf-thumb" data-image="${esc(book.coverKey || '')}"><i class="${typeOf(book.type).icon}"></i></div><div class="ct-shelf-info"><strong>${esc(book.title)}</strong><span>${typeBadge(book.type)}${esc(book.charName)} × ${esc(book.userName)}</span><small>${read ? `读到 ${esc(read.title)} · ` : ''}更新于 ${esc(date(book.updatedAt))}</small></div>${isRecent(book.updatedAt) ? '<em class="ct-up">UP</em>' : ''}</button>`;
        };
        frame({
            brand: true,
            tabs: true,
            right: '<button type="button" class="ct-icon" data-action="import-project" aria-label="导入漫画项目"><i class="ri-folder-download-line"></i></button>',
            body: `<div class="ct-shelf-tools"><strong>全部作品 <b>${books.length}</b></strong><div>${[['updated', '最近更新'], ['created', '最近创作']].map(([key, label]) => `<button type="button" data-action="shelf-sort" data-id="${key}" class="${state.shelfSort === key ? 'active' : ''}">${label}</button>`).join('')}</div></div><div class="ct-shelf-list">${books.map(row).join('') || '<div class="ct-empty"><i class="ri-bookmark-line"></i><strong>书架还是空的</strong><p>创作完成的作品会自动放进这里。</p></div>'}</div>${importInput}`
        });
        await fillImages();
    }
    async function materials() {
        state.view = 'materials'; state.tab = 'materials';
        const [items, profiles] = await Promise.all([all('materials'), all('profiles')]);
        const who = item => item.who === 'char' ? (nameOf(charById(item.key)) || '角色') : (item.key === 'default' ? '当前 User 人设' : ((typeof getWechatUserPersonaLibrary === 'function' ? getWechatUserPersonaLibrary() : []).find(persona => persona.id === item.key)?.title || 'User 人设'));
        frame({
            brand: true,
            tabs: true,
            body: `<section class="ct-section"><div class="ct-section-head"><strong>外观档案</strong><span>第一次画某个角色时自动记下，以后每部作品沿用，保证长相一致。</span></div>${profiles.map(item => `<div class="ct-profile-card"><div><b>${esc(who(item))}</b><em>${item.provider === 'novelai' ? 'NovelAI 标签' : '中转站描述'}</em></div><textarea data-profile="${esc(item.id)}" rows="3">${esc(item.text)}</textarea><button type="button" data-action="delete-profile" data-id="${esc(item.id)}">删除</button></div>`).join('') || '<p class="ct-muted">还没有档案，画完第一部作品就会出现。</p>'}</section><section class="ct-section"><div class="ct-section-head"><strong>参考素材</strong><span>中转站生图会用到的角色、服装、场景参考图。</span></div><form id="ct-material-form" class="ct-material-form"><input name="title" required maxlength="30" placeholder="素材名称"><select name="kind"><option value="char">Char 参考图</option><option value="user">User 参考图</option><option value="clothing">服装</option><option value="scene">场景</option><option value="style">画风</option></select><label class="ct-file"><i class="ri-image-add-line"></i><span>选择图片</span><input name="file" type="file" accept="image/png,image/jpeg,image/webp" required></label><button type="submit">保存素材</button></form><div class="ct-material-grid">${items.map(item => `<article><div data-image="${esc(item.imageKey)}"></div><strong>${esc(item.title)}</strong><small>${esc({ char: 'Char', user: 'User', clothing: '服装', scene: '场景', style: '画风' }[item.kind] || item.kind)}</small><button type="button" data-action="delete-material" data-id="${esc(item.id)}">删除</button></article>`).join('')}</div></section>`
        });
        await fillImages();
    }
