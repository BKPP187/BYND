    // ---- series home (작품홈) ----
    async function openBook(bookId) {
        state.seriesId = bookId;
        const book = await current();
        if (!book) return home();
        if (typeOf(book.type).series) return seriesView();
        state.chapterId = book.chapters[0]?.id || '';
        const part = book.chapters[0];
        if (part && part.panels.length && part.panels.every(panel => panel.imageKey)) return viewer();
        return editor();
    }
    async function seriesView() {
        state.view = 'series';
        const book = await current();
        if (!book) return home();
        const done = doneChapters(book);
        const chapters = book.chapters.map((part, index) => ({ part, index }));
        if (state.episodeOrder === 'desc') chapters.reverse();
        const resume = book.chapters.find(part => part.id === book.lastReadId) || done[0];
        const thumb = part => part.panels.find(panel => panel.imageKey)?.imageKey || '';
        const episode = ({ part }) => {
            const ready = part.panels.length && part.panels.every(panel => panel.imageKey);
            return `<div class="ct-episode"><button type="button" class="ct-episode-main" data-action="${ready ? 'read' : 'edit-chapter'}" data-id="${esc(part.id)}"><div class="ct-episode-thumb" data-image="${esc(thumb(part))}"><i class="ri-image-line"></i></div><div class="ct-episode-info"><strong>${esc(part.title)}</strong><small>${part.rating ? `<b>★ ${part.rating}.0</b>` : ''}${esc(date(part.createdAt))}${ready ? '' : ' · <em>未完成</em>'}</small></div>${isRecent(part.updatedAt) && ready ? '<span class="ct-up">UP</span>' : ''}</button><button type="button" class="ct-icon" data-action="edit-chapter" data-id="${esc(part.id)}" aria-label="编辑这一话"><i class="ri-edit-2-line"></i></button></div>`;
        };
        frame({
            title: book.title,
            back: 'home',
            className: 'ct-series-page',
            right: `<button type="button" class="ct-icon" data-action="book-menu" aria-label="更多"><i class="ri-more-2-fill"></i></button>`,
            body: `<section class="ct-series-hero"><div class="ct-series-bg" data-image="${esc(book.coverKey || '')}"></div><div class="ct-series-head">${coverHtml(book, 'ct-series-cover')}<div class="ct-series-meta"><div>${typeBadge(book.type)}<span class="ct-status-chip">${esc({ ongoing: '连载中', complete: '完结', draft: '草稿', private: '私密' }[book.status] || '连载中')}</span></div><h1>${esc(book.title)}</h1><p>${esc(book.charName)} × ${esc(book.userName)}</p><small>共 ${done.length} 话 · ${esc(date(book.updatedAt))} 更新</small></div></div></section>${book.logline ? `<p class="ct-series-desc">${esc(book.logline)}</p>` : ''}<div class="ct-series-actions">${done.length ? `<button type="button" class="ct-primary" data-action="read" data-id="${esc(done[0].id)}">第一话</button>${resume && resume.id !== done[0].id ? `<button type="button" class="ct-secondary" data-action="read" data-id="${esc(resume.id)}">继续看 · ${esc(resume.title)}</button>` : ''}` : `<button type="button" class="ct-primary" data-action="edit-chapter" data-id="${esc(book.chapters[0]?.id || '')}">继续创作第一话</button>`}</div><div class="ct-series-tools"><button type="button" data-action="next-chapter"><i class="ri-add-line"></i>生成下一话</button><button type="button" data-action="char-led"><i class="ri-quill-pen-line"></i>让 ${esc(book.charName)} 画一话</button><button type="button" data-action="toggle-auto" class="${book.autoCreate ? 'on' : ''}"><i class="ri-calendar-event-line"></i>每周连载${book.autoCreate ? '·开' : ''}</button></div><div class="ct-episode-head"><strong>共 ${book.chapters.length} 话</strong><button type="button" data-action="episode-order">${state.episodeOrder === 'desc' ? '最新一话在前' : '第一话在前'} <i class="ri-arrow-up-down-line"></i></button></div><div class="ct-episode-list">${chapters.map(episode).join('')}</div>${importInput}`
        });
        await fillImages();
    }
    async function bookMenu() {
        const book = await current();
        if (!book) return;
        const sheet = document.createElement('div');
        sheet.className = 'ct-sheet';
        sheet.innerHTML = `<div class="ct-sheet-panel"><strong>${esc(book.title)}</strong><label class="ct-field"><span>作品状态</span><select data-book-status>${[['ongoing', '连载中'], ['complete', '完结'], ['draft', '草稿'], ['private', '私密']].map(([key, label]) => `<option value="${key}" ${book.status === key ? 'selected' : ''}>${label}</option>`).join('')}</select></label><label class="ct-field"><span>作品名</span><input data-book-title maxlength="30" value="${esc(book.title)}"></label><button type="button" data-action="export-project">导出项目备份</button><button type="button" data-action="delete-book" class="danger">删除作品</button><button type="button" data-action="close-sheet">完成</button></div>`;
        root().querySelector('.ct-shell').appendChild(sheet);
    }
    async function nextChapter(extra = {}) {
        const book = await current();
        if (!book) return;
        const char = charById(book.charId);
        if (!char) throw new Error('这个作品的角色已被删除');
        const plot = extra.plot ?? prompt(`「第${book.chapters.length + 1}话」想看什么？留空就按最近的聊天续写。`, '');
        if (plot === null) return;
        const history = transcript(char);
        const part = { id: id('chapter'), title: `第${book.chapters.length + 1}话`, source: extra.source || (plot.trim() ? 'custom' : 'chat'), plot: String(plot || '').trim(), transcript: history, createdAt: Date.now(), updatedAt: Date.now(), panels: [], comments: [], progress: 0, state: 'planning' };
        if (part.source === 'chat' && !history) part.source = 'char';
        book.chapters.push(part);
        await save(book);
        state.chapterId = part.id;
        await editor();
        launch(() => planChapter(book.id, part.id));
    }
    async function charLed(book, auto = false) {
        const char = charById(book.charId);
        if (!char) throw new Error('这个作品的角色已被删除');
        const history = transcript(char);
        if (!history && auto) return;
        const part = { id: id('chapter'), title: `第${book.chapters.length + 1}话`, source: 'char', plot: '', transcript: history, createdAt: Date.now(), updatedAt: Date.now(), panels: [], comments: [], progress: 0, state: 'planning' };
        book.chapters.push(part);
        book.lastProactiveAt = Date.now();
        await save(book);
        if (!auto) { state.seriesId = book.id; state.chapterId = part.id; await editor(); }
        launch(async () => {
            await planChapter(book.id, part.id);
            await startGeneration(book.id, part.id);
        });
    }
    async function maybeProactive() {
        const due = (await series()).find(book => book.autoCreate && typeOf(book.type).series && book.status !== 'complete' && Date.now() - (book.lastProactiveAt || book.createdAt) >= 7 * 86400000 && (charById(book.charId)?.history || []).some(row => Number(row.timestamp || 0) > (book.lastProactiveAt || book.createdAt)));
        if (!due || state.job) return;
        say(`${due.charName} 想画新的一话，正在准备…`);
        await charLed(due, true);
    }
