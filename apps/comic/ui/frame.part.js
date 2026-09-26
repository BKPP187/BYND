    // ---- shell ----
    function frame({ body, title = '', back = 'home', right = '', tabs = false, className = '', brand = false }) {
        const host = root();
        if (!host) return;
        const head = brand
            ? `<header class="ct-header brand"><button type="button" class="ct-icon" data-action="close" aria-label="关闭"><i class="ri-arrow-left-s-line"></i></button><div class="ct-wordmark"><b>BYND</b><span>COMICS</span></div><div class="ct-header-right">${right}</div></header>`
            : `<header class="ct-header"><button type="button" class="ct-icon" data-action="back" data-view="${esc(back)}" aria-label="返回"><i class="ri-arrow-left-s-line"></i></button><strong class="ct-header-title">${esc(title)}</strong><div class="ct-header-right">${right}</div></header>`;
        const nav = tabs ? `<nav class="ct-tabs">${[['home', '首页'], ['shelf', '书架'], ['materials', '素材']].map(([key, label]) => `<button type="button" data-action="tab" data-id="${key}" class="${state.tab === key ? 'active' : ''}">${label}</button>`).join('')}</nav>` : '';
        host.innerHTML = `<div class="ct-shell ${esc(className)}">${head}${nav}<div class="ct-status${state.status ? '' : ' hidden'}${state.statusError ? ' error' : ''}">${esc(state.status)}</div><div class="ct-job-slot"></div><main class="ct-main">${body}</main></div>`;
        renderJob();
    }
    function renderJob() {
        const slot = root()?.querySelector('.ct-job-slot');
        if (!slot) return;
        const job = state.job;
        if (!job) { slot.innerHTML = ''; return; }
        if (job.kind === 'plan') {
            slot.innerHTML = '<div class="ct-job planning"><div class="ct-job-text"><i class="ri-quill-pen-line"></i><span>正在写分镜和台词…</span></div><div class="ct-job-bar indeterminate"><i></i></div></div>';
            return;
        }
        const percent = job.total ? Math.round(job.done / job.total * 100) : 0;
        slot.innerHTML = `<div class="ct-job"><div class="ct-job-text"><i class="ri-brush-3-line"></i><span>正在画第 ${Math.min(job.done + 1, job.total)} / ${job.total} 张</span></div><button type="button" data-action="stop-job">停止</button><div class="ct-job-bar"><i style="width:${percent}%"></i></div></div>`;
    }
    function typeBadge(key) {
        const type = typeOf(key);
        return `<span class="ct-type-badge type-${esc(key)}">${esc(type.short)}</span>`;
    }
    function coverHtml(book, className = 'ct-cover') {
        return `<div class="${className}" data-image="${esc(book.coverKey || '')}" data-alt="${esc(book.title)}"><div class="ct-cover-fallback type-${esc(book.type)}"><i class="${typeOf(book.type).icon}"></i><span>${esc(book.title)}</span></div></div>`;
    }
    const latestChapter = book => book.chapters.at(-1);
    const doneChapters = book => book.chapters.filter(part => part.panels.length && part.panels.every(panel => panel.imageKey));
    function posterCard(book) {
        const series = typeOf(book.type).series;
        const count = doneChapters(book).length;
        return `<button type="button" class="ct-poster-card" data-action="open-book" data-id="${esc(book.id)}">${coverHtml(book)}<div class="ct-poster-badges">${isRecent(book.updatedAt) ? '<em class="ct-up">UP</em>' : ''}${book.status === 'draft' ? '<em class="ct-draft">草稿</em>' : ''}</div><strong>${esc(book.title)}</strong><span>${esc(book.charName)} × ${esc(book.userName)}</span><small>${typeBadge(book.type)}${series ? `${count} 话` : esc(date(book.updatedAt))}</small></button>`;
    }
