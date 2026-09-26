    // ---- boot ----
    function bind() {
        const host = root();
        if (!host || host.dataset.bound) return;
        host.dataset.bound = '1';
        host.addEventListener('click', event => {
            const button = event.target.closest('[data-action]');
            if (!button || button.disabled) return;
            if (button.dataset.action === 'toggle-bars' && event.target.closest('button, a, input, textarea, select, .ct-bubble')) return;
            event.preventDefault();
            run(() => action(button));
        });
        host.addEventListener('submit', event => {
            event.preventDefault();
            const form = event.target;
            run(async () => {
                if (form.id === 'ct-material-form') {
                    const data = new FormData(form);
                    const imageKey = await storeImage(await fileData(data.get('file')));
                    await put('materials', { id: id('material'), title: String(data.get('title')).trim(), kind: String(data.get('kind')), imageKey, createdAt: Date.now() });
                    await materials();
                    say('素材已保存');
                }
                if (form.id === 'ct-comment-form') {
                    const text = String(new FormData(form).get('text') || '').trim();
                    if (!text) return;
                    const comment = { id: id('comment'), who: 'user', text: text.slice(0, 200), at: Date.now() };
                    const bookId = state.seriesId, chapterId = state.chapterId;
                    await mutateChapter(bookId, chapterId, part => { part.comments.push(comment); });
                    const book = await current();
                    const section = root().querySelector('.ct-comments');
                    if (section) section.outerHTML = commentsHtml(book, chapter(book));
                    replyToComment(bookId, chapterId, comment).catch(error => console.warn('作者回复失败', error));
                }
            });
        });
        host.addEventListener('input', event => {
            const target = event.target;
            if (target.dataset.draft && state.draft) {
                state.draft[target.dataset.draft] = target.type === 'range' ? Number(target.value) : target.value;
                if (target.type === 'range') { const label = root().querySelector('[data-panel-count]'); if (label) label.textContent = target.value; }
            }
        });
        host.addEventListener('change', event => {
            const target = event.target;
            if (target.dataset.draft) return;
            run(async () => {
                if (target.dataset.history) {
                    if (target.checked) state.selectedHistory.add(target.dataset.history);
                    else state.selectedHistory.delete(target.dataset.history);
                    return;
                }
                if (target.dataset.ref && target.files[0] && state.draft) {
                    state.draft[target.dataset.ref] = await fileData(target.files[0]);
                    target.closest('.ct-file')?.classList.add('picked');
                    return;
                }
                if (target.id === 'ct-import-file' && target.files[0]) {
                    const book = await importProject(target.files[0]);
                    target.value = '';
                    state.seriesId = book.id;
                    say('漫画项目已导入');
                    await openBook(book.id);
                    return;
                }
                if (target.dataset.upload && target.files[0]) {
                    const panelId = target.dataset.upload;
                    const imageKey = await storeImage(await fileData(target.files[0]));
                    const oldKey = await mutatePanel(state.seriesId, state.chapterId, panelId, (book, part, panel) => {
                        const previous = panel.imageKey;
                        panel.imageKey = imageKey; panel.error = '';
                        if (!book.coverKey || book.coverKey === previous) book.coverKey = part.panels[0]?.imageKey || imageKey;
                        return previous;
                    });
                    if (oldKey) await remove('images', oldKey).catch(console.warn);
                    await refreshPanel(panelId);
                    return;
                }
                if (target.dataset.profile) {
                    const item = await get('profiles', target.dataset.profile);
                    if (item) { item.text = target.value.trim(); item.updatedAt = Date.now(); await put('profiles', item); say('外观档案已保存'); }
                    return;
                }
                if (target.dataset.bookStatus !== undefined || target.dataset.bookTitle !== undefined) {
                    const book = await current();
                    if (target.dataset.bookStatus !== undefined) book.status = target.value;
                    if (target.dataset.bookTitle !== undefined && target.value.trim()) { book.title = target.value.trim(); book.titleLocked = true; }
                    await save(book);
                    say('已保存');
                    return;
                }
                await applyEdit(target);
            });
        });
        bindBubbleDrag(host);
    }
    async function open(source = null) {
        bind();
        state.source = source;
        if (source) {
            state.selectedHistory.clear();
            state.draft = freshDraft();
            createView();
            return;
        }
        if (state.view === 'viewer' || state.view === 'editor' || state.view === 'series') {
            await run(() => state.view === 'viewer' ? viewer() : state.view === 'editor' ? editor() : seriesView());
        } else {
            await run(() => state.tab === 'shelf' ? shelf() : state.tab === 'materials' ? materials() : home());
        }
        maybeProactive().catch(error => say(error.message || '每周连载生成失败', true));
    }
    window.ByndComic = {
        open,
        fromChat(charId) { window._comicPendingSource = { kind: 'chat', charId }; openApp('comic'); },
        fromSource(kind, charId, text) { window._comicPendingSource = { kind, charId, text }; openApp('comic'); },
        storage: { all, get, put, remove },
        _test: { validatePlan, durableImage, makeZip, makePdf, upgradeBook, planSystemPrompt, planContext, naiInput, apiPrompt, pieceHtml, autoPlaceBubbles, TYPES, SHOTS, GUTTERS }
    };
})();
