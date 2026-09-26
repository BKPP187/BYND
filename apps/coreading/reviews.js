function getCoReadBookReviews(book) {
    return Array.isArray(book && book.reviews) ? book.reviews.filter(item => item && item.text) : [];
}

function normalizeCoReadBookReviewItems(value) {
    let source = value;
    if (source && typeof source === 'object') source = source.content || source.text || source.message || source.answer || source.response || '';
    let text = String(source || '').trim()
        .replace(/^```(?:json)?/i, '')
        .replace(/```$/i, '')
        .trim();
    if (!text) return [];
    let parsed = null;
    try {
        parsed = JSON.parse(text);
    } catch (_) {
        const match = text.match(/\[[\s\S]*\]/);
        if (match) {
            try { parsed = JSON.parse(match[0]); } catch (__) {}
        }
    }
    const rows = Array.isArray(parsed) ? parsed : (parsed && Array.isArray(parsed.comments) ? parsed.comments : []);
    return rows.map(item => ({
        id: `review_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        nickname: String(item && (item.nickname || item.name) || '').trim().slice(0, 18),
        text: String(item && (item.text || item.comment || item.content) || '').trim().slice(0, 220),
        replyTo: String(item && (item.replyTo || item.to || '') || '').trim().slice(0, 18),
        likes: Math.max(0, Math.floor(Number(item && item.likes || 0))),
        createdAt: Date.now(),
        source: 'api'
    })).filter(item => item.nickname && item.text).slice(0, 18);
}

function buildCoReadBookReviewMessages(book) {
    const tags = getCoReadBookTags(book).join('、') || '未标注';
    const intro = getCoReadBookIntro(book, 420);
    const sample = String(book && book.content || '').slice(0, 1200);
    return [
        {
            role: 'system',
            content: '你是中文网文读者评论生成器。只输出 JSON，不要 Markdown，不要解释。评论必须像真实读者区，带昵称、吐槽、网络热梗、互相引用和轻微楼中楼互动。禁止空内容，禁止营销书评，禁止系统口吻。'
        },
        {
            role: 'user',
            content: [
                `书名：${book.title || '未命名书籍'}`,
                `作者：${book.author || '未知作者'}`,
                `属性/标签：${tags}`,
                `简介：${intro}`,
                sample ? `正文片段：${sample}` : '',
                '请生成 10-15 条中文读者评论。每条包含 nickname、text、likes，可选 replyTo。',
                'nickname 要搞笑、中二、抽象或像网络平台真实昵称。text 要有吐槽、网络热梗、小红书/抖音语感、短句、疯言疯语、错字、表情符号、@互动、楼中楼引用。必须贴合这本书，不要泛泛而谈。',
                '输出格式示例：[{"nickname":"...","text":"...","likes":7,"replyTo":"..."}]'
            ].filter(Boolean).join('\n\n')
        }
    ];
}

async function generateCoReadBookReviews(bookId) {
    const id = String(bookId || coreadActiveBookId || '');
    const library = getCoReadLibrary();
    const book = library.find(item => item && item.id === id);
    if (!book || coreadBookReviewBusyId || typeof callChatApi !== 'function') return;
    coreadBookReviewBusyId = id;
    renderCoReadBookDetail();
    // The request takes a while; write into the library as it is now, not the snapshot from before it.
    const saveReviewChange = change => {
        const latest = getCoReadLibrary();
        const target = latest.find(item => item && item.id === id);
        if (!target) return;
        change(target);
        saveCoReadLibrary(latest);
    };
    try {
        const result = await callChatApi(buildCoReadBookReviewMessages(book), { max_tokens: 1800, temperature: 0.9, usageFeature: 'read' });
        const items = normalizeCoReadBookReviewItems(result && result.ok ? result.content : '');
        saveReviewChange(target => {
            if (items.length) target.reviews = [...items, ...getCoReadBookReviews(target)].slice(0, 80);
            else target.reviewError = (result && result.error) || 'AI 没有返回可用书评。';
            target.updatedAt = Date.now();
        });
    } catch (_) {
        saveReviewChange(target => { target.reviewError = '书评生成失败，稍后再试。'; });
    } finally {
        coreadBookReviewBusyId = '';
        renderCoReadBookDetail();
    }
}
window.generateCoReadBookReviews = generateCoReadBookReviews;

function likeCoReadBookReview(bookId, reviewId) {
    const library = getCoReadLibrary();
    const book = library.find(item => item && item.id === bookId);
    const review = book && getCoReadBookReviews(book).find(item => item.id === reviewId);
    if (!book || !review) return;
    review.likes = Math.max(0, Number(review.likes || 0)) + 1;
    saveCoReadLibrary(library);
    renderCoReadBookDetail();
}
window.likeCoReadBookReview = likeCoReadBookReview;

function addCoReadUserBookReview(bookId) {
    const input = document.getElementById('coread-book-review-input');
    const text = String(input && input.value || '').trim();
    if (!text) return;
    const library = getCoReadLibrary();
    const book = library.find(item => item && item.id === bookId);
    if (!book) return;
    book.reviews = [{
        id: `review_user_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        nickname: '我',
        text: text.slice(0, 220),
        likes: 0,
        createdAt: Date.now(),
        source: 'user'
    }, ...getCoReadBookReviews(book)].slice(0, 80);
    book.updatedAt = Date.now();
    saveCoReadLibrary(library);
    if (input) input.value = '';
    renderCoReadBookDetail();
}
window.addCoReadUserBookReview = addCoReadUserBookReview;

function openCoReadBookDetail(bookId) {
    if (coreadShelfSelectionMode) {
        toggleCoReadShelfBookSelected(bookId);
        return;
    }
    coreadActiveBookId = String(bookId || '');
    coreadActiveTab = 'detail';
    renderCoReadApp();
}
window.openCoReadBookDetail = openCoReadBookDetail;

function startCoReadBook(bookId) {
    coreadActiveBookId = String(bookId || coreadActiveBookId || '');
    coreadActiveTab = 'reader';
    coreadReaderPanelOpen = false;
    renderCoReadApp();
}
window.startCoReadBook = startCoReadBook;

function renderCoReadBookReviews(book) {
    const reviews = getCoReadBookReviews(book);
    const userProfile = typeof getUserProfile === 'function' ? (getUserProfile() || {}) : {};
    if (!reviews.length) {
        return `
            <div class="coread-book-review-empty">
                <span>${book.reviewError ? musicEscapeHtml(book.reviewError) : '还没有书评。调用 API 生成一组真实读者风格评论。'}</span>
                <button type="button" onclick="generateCoReadBookReviews('${musicEscapeAttr(book.id)}')">${coreadBookReviewBusyId === book.id ? '生成中...' : '生成书评'}</button>
            </div>
        `;
    }
    return reviews.map(item => `
        <article class="coread-book-review">
            <img src="${musicEscapeAttr(item.source === 'user' ? (userProfile.avatar || DEFAULT_AVATAR) : DEFAULT_AVATAR)}" onerror="this.src='${musicEscapeAttr(DEFAULT_AVATAR)}'">
            <div>
                <header>
                    <strong>${musicEscapeHtml(item.nickname || '读者')}</strong>
                    ${item.replyTo ? `<em>@${musicEscapeHtml(item.replyTo)}</em>` : ''}
                </header>
                <p>${musicEscapeHtml(item.text || '')}</p>
                <footer>
                    <button type="button" onclick="likeCoReadBookReview('${musicEscapeAttr(book.id)}','${musicEscapeAttr(item.id)}')"><i class="ri-heart-3-line"></i>${Number(item.likes || 0) || '赞'}</button>
                    <button type="button" onclick="document.getElementById('coread-book-review-input')?.focus()">回复</button>
                </footer>
            </div>
        </article>
    `).join('');
}

function renderCoReadBookDetail() {
    const box = document.getElementById('coread-book-detail');
    if (!box) return;
    const book = getCoReadBook(coreadActiveBookId);
    if (!book) {
        box.innerHTML = '<div class="coread-empty">先选择一本书。</div>';
        return;
    }
    const tags = getCoReadBookTags(book);
    const pct = getCoReadBookProgress(book);
    box.innerHTML = `
        <article class="coread-book-hero-card">
            <div class="coread-book-hero-cover">${book.coverUrl ? `<img src="${musicEscapeAttr(book.coverUrl)}" onerror="this.remove()">` : `<span>${musicEscapeHtml(String(book.title || '书').slice(0, 1))}</span>`}</div>
            <div class="coread-book-hero-copy">
                <strong>${musicEscapeHtml(book.title || '未命名书籍')}</strong>
                <em>${musicEscapeHtml(book.author || '未知作者')}</em>
                <div class="coread-book-tags">${tags.map(tag => `<span>${musicEscapeHtml(tag)}</span>`).join('') || '<span>未标注</span>'}</div>
                <p>${musicEscapeHtml(getCoReadBookIntro(book, 180))}</p>
                <small>${musicEscapeHtml([book.source || '本地', formatCoReadByteSize(getCoReadBookByteSize(book)), `${pct}%`].filter(Boolean).join(' · '))}</small>
            </div>
        </article>
        <div class="coread-book-actions">
            <button type="button" onclick="startCoReadBook('${musicEscapeAttr(book.id)}')"><i class="ri-book-open-line"></i>开始阅读</button>
            ${book.url && book.resolveFailedAt && !book.resolving ? `<button type="button" onclick="retryCoReadBookContent('${musicEscapeAttr(book.id)}')"><i class="ri-refresh-line"></i>重新解析</button>` : ''}
            <button type="button" onclick="generateCoReadBookReviews('${musicEscapeAttr(book.id)}')" ${coreadBookReviewBusyId === book.id ? 'disabled' : ''}><i class="ri-chat-smile-3-line"></i>${coreadBookReviewBusyId === book.id ? '生成中' : 'AI 书评'}</button>
        </div>
        <section class="coread-book-review-panel">
            <header>
                <strong>全部评论 <em>${getCoReadBookReviews(book).length}</em></strong>
                <button type="button" onclick="generateCoReadBookReviews('${musicEscapeAttr(book.id)}')" ${coreadBookReviewBusyId === book.id ? 'disabled' : ''}>最热</button>
            </header>
            <div class="coread-book-review-list">${renderCoReadBookReviews(book)}</div>
            <div class="coread-book-review-input">
                <input id="coread-book-review-input" type="text" maxlength="220" placeholder="说点好听的">
                <button type="button" onclick="addCoReadUserBookReview('${musicEscapeAttr(book.id)}')">发送</button>
            </div>
        </section>
    `;
}

function renderCoReadDashboard() {
    const current = document.getElementById('coread-current-reads');
    const library = getCoReadLibrary();
    const shelfBooks = getCoReadShelfBooks(library);
    const shelfSettings = getCoReadShelfSettings();
    if (current) {
        current.dataset.view = shelfSettings.viewMode;
        current.classList.toggle('compact', !!shelfSettings.compact);
        current.classList.toggle('divider', !!shelfSettings.divider);
        current.classList.toggle('flat', !shelfSettings.cardMode);
        current.style.setProperty('--coread-shelf-top-steps', `${shelfSettings.topSteps}px`);
        const categoryShelvesHtml = renderCoReadCategoryShelves(library);
        const totalShelfHtml = renderCoReadShelfRail(library);
        const bookCardsHtml = shelfBooks.slice(0, 24).map(book => {
            const pct = getCoReadBookProgress(book);
            const stars = Math.max(0, Math.min(5, Number(book.rating || 0)));
            const selected = coreadShelfSelectedIds.has(book.id);
            const tags = getCoReadBookTags(book);
            return `
                <article class="coread-read-card coread-read-detail-card ${book.id === coreadActiveBookId ? 'active' : ''} ${selected ? 'selected' : ''}" onclick="selectCoReadBook('${musicEscapeAttr(book.id)}')">
                    ${coreadShelfSelectionMode ? `<button type="button" class="coread-read-check" onclick="event.stopPropagation(); toggleCoReadShelfBookSelected('${musicEscapeAttr(book.id)}')" aria-label="${selected ? '取消选择' : '选择'}《${musicEscapeAttr(book.title || '未命名书籍')}》" aria-pressed="${selected ? 'true' : 'false'}"><i class="${selected ? 'ri-checkbox-circle-fill' : 'ri-checkbox-blank-circle-line'}"></i></button>` : ''}
                    <button type="button" class="coread-read-main">
                        <div class="coread-read-cover">
                            ${book.coverUrl ? `<img src="${musicEscapeAttr(book.coverUrl)}" onerror="this.remove()">` : `<span>${book.coverResolving ? '...' : musicEscapeHtml(String(book.title || '书').slice(0, 2))}</span>`}
                        </div>
                        <div class="coread-read-copy">
                            <strong>${musicEscapeHtml(book.title || '未命名书籍')}</strong>
                            <div class="coread-card-stars">${'★'.repeat(stars)}${'☆'.repeat(5 - stars)}</div>
                            <div class="coread-read-tags">${tags.map(tag => `<span>${musicEscapeHtml(tag)}</span>`).join('') || '<span>未标注</span>'}</div>
                            <em>${musicEscapeHtml(book.author || '未知作者')}</em>
                            <p>${musicEscapeHtml(getCoReadBookIntro(book, 118))}</p>
                            <small>${musicEscapeHtml([book.source || '本地', formatCoReadByteSize(getCoReadBookByteSize(book)), `${pct}%`].join(' · '))}</small>
                        </div>
                    </button>
                    ${coreadShelfSelectionMode ? '' : `<button type="button" class="coread-read-delete" onclick="event.stopPropagation(); deleteCoReadBook('${musicEscapeAttr(book.id)}')" aria-label="删除书籍">
                        <i class="ri-close-line"></i>
                    </button>`}
                </article>
            `;
        }).join('');
        current.innerHTML = totalShelfHtml + categoryShelvesHtml + (bookCardsHtml || `<div class="coread-empty">${library.length ? '这个分类下暂时没有书。' : '书架还空着。先从书源搜索或导入一本书。'}</div>`);
        library.filter(book => book && !book.coverUrl && !book.coverResolving && book.title && !isCoReadUrlTitle(book.title)).slice(0, 4).forEach(book => {
            ensureCoReadBookCover(book.id);
        });
    }
    renderCoReadStatsMount(library);
}

function renderCoReadCalendarStats() {
    const stats = document.getElementById('coread-me-stats');
    const calendar = document.getElementById('coread-reading-calendar');
    const library = getCoReadLibrary();
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const monthBooks = library.filter(book => {
        const ts = Number(book.createdAt || 0);
        return ts >= monthStart.getTime();
    });
    const avg = library.length ? Math.round(library.reduce((sum, book) => sum + getCoReadBookProgress(book), 0) / library.length) : 0;
    if (stats) {
        stats.innerHTML = `
            <div><strong>${monthBooks.length}</strong><span>本月加入</span></div>
            <div><strong>${avg}%</strong><span>平均进度</span></div>
            <div><strong>${getCoReadThoughts().length}</strong><span>共读旁注</span></div>
        `;
    }
    if (calendar) {
        const activeDays = new Set(monthBooks.map(book => new Date(book.createdAt || Date.now()).getDate()));
        calendar.innerHTML = `
            <div class="coread-calendar-head"><strong>${now.getFullYear()} / ${now.getMonth() + 1}</strong><span>本月阅读记录</span></div>
            <div class="coread-calendar-grid">
                ${Array.from({ length: daysInMonth }, (_, i) => {
                    const day = i + 1;
                    return `<span class="${activeDays.has(day) ? 'active' : ''}">${day}</span>`;
                }).join('')}
            </div>
        `;
    }
}

