    // ---- viewer (뷰어) ----
    function commentAvatar(book, who) {
        const char = charById(book.charId);
        const src = who === 'char' ? avatarOf(char) : (profile(char).avatar || '');
        const name = who === 'char' ? book.charName : book.userName;
        return `<span class="ct-avatar small">${src ? `<img src="${esc(src)}" alt="" onerror="this.remove()">` : ''}<i>${esc(String(name || '?').slice(0, 1))}</i></span>`;
    }
    function commentsHtml(book, part) {
        const list = part.comments || [];
        return `<section class="ct-comments"><div class="ct-comments-head"><strong>评论</strong><span>${list.length}</span></div>${list.map(item => `<div class="ct-comment ${item.who === 'char' ? 'author' : ''}${item.replyTo ? ' reply' : ''}">${commentAvatar(book, item.who)}<div><b>${esc(item.who === 'char' ? book.charName : book.userName)}${item.who === 'char' ? '<em>作者</em>' : ''}</b><p>${esc(item.text)}</p><small>${esc(date(item.at))}</small></div></div>`).join('') || '<p class="ct-muted">还没有评论。</p>'}<form id="ct-comment-form" class="ct-comment-form"><input name="text" maxlength="200" placeholder="写下你的评论，${esc(book.charName)} 会看到" autocomplete="off"><button type="submit">发布</button></form></section>`;
    }
    async function viewer() {
        const book = await current();
        if (!book) return home();
        const part = chapter(book) || book.chapters[0];
        if (!part) return openBook(book.id);
        state.view = 'viewer';
        state.chapterId = part.id;
        const type = typeOf(book.type);
        const index = book.chapters.indexOf(part);
        const prev = book.chapters.slice(0, index).reverse().find(item => item.panels.length);
        const next = book.chapters.slice(index + 1).find(item => item.panels.length);
        const missing = part.panels.filter(panel => !panel.imageKey).length;
        const unit = type.series ? '话' : '幅';
        const actions = [
            type.series ? (next ? `<button type="button" class="ct-primary" data-action="read" data-id="${esc(next.id)}">下一话 · ${esc(next.title)}</button>` : `<button type="button" class="ct-primary" data-action="next-chapter">生成下一话</button>`) : '',
            `<button type="button" class="ct-secondary" data-action="save-piece"><i class="ri-download-2-line"></i>保存成品图</button>`,
            type.layout === 'wallpaper' ? `<button type="button" class="ct-secondary" data-action="wallpaper" data-id="home"><i class="ri-smartphone-line"></i>设为桌面壁纸</button><button type="button" class="ct-secondary" data-action="wallpaper" data-id="lock"><i class="ri-lock-line"></i>设为锁屏壁纸</button>` : '',
            `<button type="button" class="ct-secondary" data-action="edit-chapter" data-id="${esc(part.id)}"><i class="ri-edit-2-line"></i>编辑分镜和台词</button>`
        ].join('');
        frame({
            title: type.series ? part.title : book.title,
            back: type.series ? 'series' : 'home',
            className: `ct-reading layout-${type.layout}`,
            right: `<button type="button" class="ct-icon${part.liked ? ' liked' : ''}" data-action="like" aria-label="喜欢"><i class="${part.liked ? 'ri-heart-3-fill' : 'ri-heart-3-line'}"></i></button>`,
            body: `<div class="ct-viewer" data-action="toggle-bars">${pieceHtml(book, part)}</div>${missing ? `<div class="ct-notice"><i class="ri-error-warning-line"></i><span>还有 ${missing} 格没有图片</span><button type="button" data-action="edit-chapter" data-id="${esc(part.id)}">去生成</button></div>` : ''}<section class="ct-episode-end">${type.series ? `<div class="ct-end-mark"><span>${esc(part.title)}</span><b>本话完</b></div>` : ''}${part.authorNote ? `<div class="ct-author-note">${commentAvatar(book, 'char')}<div><b>作者的话</b><p>${esc(part.authorNote)}</p><small>— ${esc(book.charName)}</small></div></div>` : ''}<div class="ct-rate"><span>给这${unit}打分</span><div>${[1, 2, 3, 4, 5].map(score => `<button type="button" data-action="rate" data-id="${score}" class="${Number(part.rating || 0) >= score ? 'on' : ''}" aria-label="${score} 星">★</button>`).join('')}</div></div><div class="ct-end-actions">${actions}<details class="ct-more-export"><summary>更多导出</summary><div><button type="button" data-action="export-zip">逐格原图 ZIP</button><button type="button" data-action="export-pdf">PDF</button><button type="button" data-action="export-project">项目备份</button></div></details></div>${commentsHtml(book, part)}</section>${type.series ? `<nav class="ct-viewer-bar"><button type="button" data-action="read" data-id="${esc(prev?.id || '')}" ${prev ? '' : 'disabled'}><i class="ri-arrow-left-s-line"></i>上一话</button><button type="button" data-action="back" data-view="series"><i class="ri-list-unordered"></i>目录</button><button type="button" data-action="read" data-id="${esc(next?.id || '')}" ${next ? '' : 'disabled'}>下一话<i class="ri-arrow-right-s-line"></i></button></nav>` : ''}`
        });
        fitBubbles();
        await fillImages();
        const main = root().querySelector('.ct-main');
        const shell = root().querySelector('.ct-shell');
        const panels = [...main.querySelectorAll('[data-panel]')];
        const startAt = book.lastReadId === part.id ? Math.min(part.progress || 0, panels.length - 1) : 0;
        if (startAt > 0 && panels[startAt]) requestAnimationFrame(() => panels[startAt].scrollIntoView({ block: 'start' }));
        let lastTop = 0;
        main.onscroll = () => {
            const top = main.scrollTop;
            if (Math.abs(top - lastTop) > 8) shell.classList.toggle('bars-hidden', top > lastTop && top > 80);
            lastTop = top;
            let visible = 0;
            const limit = main.getBoundingClientRect().top + 90;
            panels.forEach((node, at) => { if (node.getBoundingClientRect().top < limit) visible = at; });
            if (visible !== part.progress || book.lastReadId !== part.id) {
                part.progress = visible;
                clearTimeout(state.progressTimer);
                state.progressTimer = setTimeout(() => mutateChapter(book.id, part.id, (item, target) => { item.progress = visible; target.lastReadId = part.id; }).catch(error => say(`阅读位置保存失败：${error.message}`, true)), 700);
            }
        };
        if (book.lastReadId !== part.id) mutateChapter(book.id, part.id, (item, target) => { target.lastReadId = part.id; }).catch(console.warn);
    }
    async function replyToComment(bookId, chapterId, comment) {
        const book = upgradeBook(await get('series', bookId));
        const part = book?.chapters.find(item => item.id === chapterId);
        const char = charById(book?.charId);
        if (!part || !char || typeof callChatApi !== 'function') return;
        const persona = typeof getWechatCharacterPersonaText === 'function' ? getWechatCharacterPersonaText(char, 3000) : (char.description || '');
        const result = await callChatApi([
            { role: 'system', content: `你是 ${book.charName}，也是漫画《${book.title}》的作者。${book.userName} 在这${typeOf(book.type).series ? '一话' : '幅作品'}下面留了评论。用你的人设和口吻回一句评论（不超过 40 字），只输出回复内容。\n\n${persona}` },
            { role: 'user', content: `作品内容：${part.panels.map(panel => panel.beat).join(' / ').slice(0, 800)}\n${book.userName} 的评论：${comment.text}` }
        ], { max_tokens: 300, temperature: 0.9, background: true, usageFeature: 'comic', usageChar: char });
        const text = cut(String(result?.content || '').replace(/^["“]|["”]$/g, ''), 120);
        if (!result?.ok || !text) return;
        await mutateChapter(bookId, chapterId, item => { item.comments.push({ id: id('comment'), who: 'char', text, replyTo: comment.id, at: Date.now() }); });
        if (state.view === 'viewer' && watching(bookId, chapterId)) {
            const section = root()?.querySelector('.ct-comments');
            const latest = upgradeBook(await get('series', bookId));
            const latestPart = latest?.chapters.find(item => item.id === chapterId);
            if (section && latestPart) section.outerHTML = commentsHtml(latest, latestPart);
        }
    }
