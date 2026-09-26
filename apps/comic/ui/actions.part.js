    // ---- actions ----
    async function goBack(view) {
        if (view === 'series' && state.seriesId) return seriesView();
        state.seriesId = ''; state.chapterId = '';
        if (state.tab === 'shelf') return shelf();
        if (state.tab === 'materials') return materials();
        return home();
    }
    async function movePanel(key, type) {
        const book = await current(), part = chapter(book);
        const index = part?.panels.findIndex(item => item.id === key) ?? -1;
        if (index < 0) return;
        let removed = '';
        if (type === 'panel-delete') {
            if (!confirm('删除这一格？')) return;
            removed = part.panels[index].imageKey;
            part.panels.splice(index, 1);
            if (book.coverKey === removed) book.coverKey = part.panels.find(panel => panel.imageKey)?.imageKey || '';
        } else {
            const target = index + (type === 'panel-up' ? -1 : 1);
            if (target < 0 || target >= part.panels.length) return;
            [part.panels[index], part.panels[target]] = [part.panels[target], part.panels[index]];
        }
        part.updatedAt = Date.now();
        await save(book);
        if (removed && removed !== book.coverKey) await remove('images', removed).catch(console.warn);
        await editor();
    }
    async function action(button) {
        const type = button.dataset.action, key = button.dataset.id;
        const inJob = state.job && state.job.chapterId === state.chapterId;
        switch (type) {
            case 'close': closeApp('comic'); return;
            case 'back': return goBack(button.dataset.view);
            case 'tab': state.tab = key; state.seriesId = ''; return key === 'shelf' ? shelf() : key === 'materials' ? materials() : home();
            case 'type-filter': state.typeFilter = key; return home();
            case 'char-filter': state.charFilter = key; return home();
            case 'shelf-sort': state.shelfSort = key; return shelf();
            case 'create': state.source = null; state.draft = freshDraft(); state.selectedHistory.clear(); return createView();
            case 'open-book': return openBook(key);
            case 'import-project': root().querySelector('#ct-import-file')?.click(); return;
            case 'draft-type': state.draft.type = key; state.draft.panels = typeOf(key).defaultPanels; state.draft.option = ''; return refreshCreate();
            case 'draft-char': state.draft.charId = key; state.draft.needsChar = false; state.selectedHistory.clear(); return refreshCreate();
            case 'draft-origin': state.draft.origin = key; return refreshCreate();
            case 'draft-option': state.draft.option = state.draft.option === key ? '' : key; return refreshCreate();
            case 'draft-style': state.draft.styleKey = key; return refreshCreate();
            case 'create-submit': return createSubmit();
            case 'open-settings': openApp('settings'); window.openSettingsTab?.('api'); return;
            case 'read': if (!key) return; state.chapterId = key; return viewer();
            case 'edit-chapter': if (key) state.chapterId = key; return editor();
            case 'view': return viewer();
            case 'next-chapter': return nextChapter();
            case 'char-led': { const book = await current(); if (book) await charLed(book); return; }
            case 'toggle-auto': { const book = await current(); book.autoCreate = !book.autoCreate; await save(book); await seriesView(); say(book.autoCreate ? `已开启：有新聊天时，${book.charName} 每周会主动画一话` : '已关闭每周连载'); return; }
            case 'episode-order': state.episodeOrder = state.episodeOrder === 'desc' ? 'asc' : 'desc'; return seriesView();
            case 'book-menu': return bookMenu();
            case 'close-sheet': root().querySelector('.ct-sheet')?.remove(); return state.view === 'series' ? seriesView() : undefined;
            case 'delete-book': {
                const book = await current();
                if (!book || !confirm(`删除《${book.title}》和它的全部图片？此操作不能撤销。`)) return;
                if (state.job?.bookId === book.id) throw new Error('这部作品正在生成，先停止再删除');
                const keys = new Set([book.coverKey, ...book.chapters.flatMap(part => part.panels.map(panel => panel.imageKey))].filter(Boolean));
                await remove('series', book.id);
                for (const imageKey of keys) await remove('images', imageKey).catch(console.warn);
                say('作品已删除');
                return goBack('home');
            }
            case 'export-project': { const book = await current(); if (book) say(await exportProject(book) || '项目已导出'); return; }
            case 'save-piece': { const book = await current(); say(await savePiece(book, chapter(book)) || '成品图已保存'); return; }
            case 'export-zip': { const book = await current(); say(await exportZip(book, chapter(book)) || 'ZIP 已导出'); return; }
            case 'export-pdf': { const book = await current(); say(await exportPdf(book, chapter(book)) || 'PDF 已导出'); return; }
            case 'wallpaper': { const book = await current(); await setWallpaper(book, chapter(book), key); say(key === 'lock' ? '已设为锁屏壁纸' : '已设为桌面壁纸'); return; }
            case 'like': {
                const liked = await mutateChapter(state.seriesId, state.chapterId, part => (part.liked = !part.liked));
                button.classList.toggle('liked', !!liked);
                button.innerHTML = `<i class="${liked ? 'ri-heart-3-fill' : 'ri-heart-3-line'}"></i>`;
                return;
            }
            case 'rate': {
                const score = Number(key);
                await mutateChapter(state.seriesId, state.chapterId, part => { part.rating = score; });
                root().querySelectorAll('[data-action="rate"]').forEach(star => star.classList.toggle('on', Number(star.dataset.id) <= score));
                return;
            }
            case 'toggle-bars': root().querySelector('.ct-shell')?.classList.toggle('bars-hidden'); return;
            case 'stop-job': stopGeneration(); return;
            case 'generate': if (inJob) return; launch(() => startGeneration(state.seriesId, state.chapterId)); return editor();
            case 'generate-panel': if (inJob) return; launch(() => startGeneration(state.seriesId, state.chapterId, [key])); return;
            case 'upload-panel': root().querySelector(`[data-upload="${CSS.escape(key)}"]`)?.click(); return;
            case 'replan': {
                const part = chapter(await current());
                if (!part || inJob) return;
                if (part.panels.some(panel => panel.imageKey) && !confirm('重写分镜会替换现在的分镜和已生成的图片，继续吗？')) return;
                launch(() => planChapter(state.seriesId, state.chapterId));
                return;
            }
            case 'panel-add': {
                const book = await current(), part = chapter(book);
                const typeInfo = typeOf(book.type);
                if (part.panels.length >= typeInfo.panels[1]) throw new Error(`${typeInfo.label}最多 ${typeInfo.panels[1]} 格`);
                part.panels.push({ id: id('panel'), beat: '新的一格', shot: typeInfo.fixedShot || 'tall', gutter: 'normal', tone: 'light', scene: '', chars: [], prompt: '', bubbles: [], imageKey: '', seed: null, error: '' });
                await save(book);
                return editor();
            }
            case 'panel-up': case 'panel-down': case 'panel-delete': return movePanel(key, type);
            case 'char-add': {
                await mutatePanel(state.seriesId, state.chapterId, key, (_, __, panel) => { panel.chars.push({ who: button.dataset.who, tags: '', x: button.dataset.who === 'user' ? 0.65 : 0.35, y: 0.5 }); });
                return refreshPanel(key);
            }
            case 'char-remove': {
                await mutatePanel(state.seriesId, state.chapterId, key, (_, __, panel) => { panel.chars.splice(Number(button.dataset.index), 1); });
                return refreshPanel(key);
            }
            case 'bubble-add': {
                await mutatePanel(state.seriesId, state.chapterId, key, (_, __, panel) => { const bubble = { id: id('bubble'), who: 'char', kind: 'speech', text: '……' }; panel.bubbles.push(bubble); autoPlaceBubbles(panel); });
                return refreshPanel(key);
            }
            case 'bubble-remove': {
                const card = button.closest('[data-panel-card]');
                await mutatePanel(state.seriesId, state.chapterId, card.dataset.panelCard, (_, __, panel) => { panel.bubbles = panel.bubbles.filter(item => item.id !== key); });
                return refreshPanel(card.dataset.panelCard);
            }
            case 'save-cast': {
                const book = await current();
                const provider = book.cast?.provider || imageRoute().provider;
                await saveCastProfile('char', book.charId, provider, book.cast?.char);
                await saveCastProfile('user', book.personaId || 'default', provider, book.cast?.user);
                say('已保存：以后给这两人画的作品都会用这套外观');
                return;
            }
            case 'delete-profile': if (!confirm('删除这份外观档案？下次会重新生成。')) return; await remove('profiles', key); return materials();
            case 'delete-material': {
                const item = await get('materials', key);
                if (!item || !confirm('删除这个素材？')) return;
                await remove('materials', key); await remove('images', item.imageKey);
                return materials();
            }
            default:
        }
    }
    async function applyEdit(target) {
        if (target.dataset.edit) {
            const field = target.dataset.edit;
            const value = target.value;
            const book = await current(), part = chapter(book);
            if (!part) return;
            const series = typeOf(book.type).series;
            if (field === 'title') {
                const text = value.trim();
                if (!text) return;
                if (series) { part.title = text; part.titleLocked = true; } else { book.title = text; book.titleLocked = true; part.title = text; }
            } else if (field.startsWith('cast.')) {
                book.cast = { ...(book.cast || {}), provider: book.cast?.provider || imageRoute().provider, [field.slice(5)]: value.trim() };
            } else if (field.startsWith('poster.')) {
                part.poster = { ...(part.poster || {}), [field.slice(7)]: value.trim() };
            } else {
                part[field] = value;
            }
            part.updatedAt = Date.now();
            await save(book);
            return;
        }
        const card = target.closest('[data-panel-card]');
        if (card && (target.dataset.panelField || target.dataset.charField !== undefined || target.dataset.bubbleField)) {
            const panelId = card.dataset.panelCard;
            await mutatePanel(state.seriesId, state.chapterId, panelId, (_, __, panel) => {
                if (target.dataset.panelField) panel[target.dataset.panelField] = target.value;
                else if (target.dataset.charField !== undefined) { const person = panel.chars[Number(target.dataset.charField)]; if (person) person.tags = target.value.trim(); }
                else {
                    const bubble = panel.bubbles.find(item => item.id === target.closest('[data-bubble-row]')?.dataset.bubbleRow);
                    if (bubble) {
                        bubble[target.dataset.bubbleField] = target.dataset.bubbleField === 'text' ? target.value.trim() : target.value;
                        if (bubble.who === 'narration' && !['narration', 'caption'].includes(bubble.kind)) bubble.kind = 'narration';
                        if (bubble.who === 'sfx') bubble.kind = 'sfx';
                    }
                }
            });
            if (['shot', 'gutter', 'tone'].includes(target.dataset.panelField) || target.dataset.bubbleField) await refreshPanel(panelId);
        }
    }
