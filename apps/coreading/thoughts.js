function getCoReadCharacterById(charId) {
    return getCoReadCharacters().find(char => char && char.id === charId) || null;
}

function getCoReadThoughts(limit = 120) {
    return getCoReadLibrary()
        .flatMap(book => Array.isArray(book.thoughts)
            ? book.thoughts.map(item => {
                const char = getCoReadCharacterById(item.charId);
                return {
                    ...item,
                    bookId: book.id,
                    bookTitle: book.title || '未命名书籍',
                    bookAuthor: book.author || '',
                    charName: item.charName || getCoReadCharName(char) || 'char',
                    charAvatar: item.charAvatar || (char && char.avatar) || DEFAULT_AVATAR,
                    replies: Array.isArray(item.replies) ? item.replies : []
                };
            })
            : [])
        .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
        .slice(0, Math.max(1, Number(limit || 120)));
}

function getCoReadThoughtStatsForChar(charId) {
    const thoughts = getCoReadThoughts(600).filter(item => item.charId === charId);
    const books = new Set(thoughts.map(item => item.bookId || item.bookTitle).filter(Boolean));
    return { thoughtCount: thoughts.length, bookCount: books.size };
}

function getCoReadCategoryShelfGroups(library = getCoReadLibrary()) {
    const meta = getCoReadShelfMeta();
    const groups = new Map();
    Object.keys(meta.categories || {}).forEach(name => {
        groups.set(name, {
            name,
            coverUrl: meta.categories[name]?.coverUrl || '',
            books: []
        });
    });
    (Array.isArray(library) ? library : []).forEach(book => {
        const name = getCoReadShelfCategoryName(book);
        if (!name) return;
        if (!groups.has(name)) groups.set(name, { name, coverUrl: '', books: [] });
        groups.get(name).books.push(book);
    });
    return Array.from(groups.values())
        .filter(group => group.name)
        .sort((a, b) => String(a.name).localeCompare(String(b.name), 'zh-CN'));
}

function renderCoReadCategoryShelves(library = getCoReadLibrary()) {
    const groups = getCoReadCategoryShelfGroups(library);
    if (!groups.length || coreadShelfCategory !== 'all') return '';
    return `
        <section class="coread-category-shelves" aria-label="分类书架">
            <div class="coread-category-shelves-head">
                <strong>分类书架</strong>
                <span>点击展开</span>
            </div>
            <div class="coread-category-shelf-rail">
                ${groups.map(group => {
                    const books = group.books.slice(0, 7);
                    return `
                        <button type="button" class="coread-category-stack" onclick="setCoReadShelfCategory(${musicEscapeAttr(JSON.stringify(`cat:${group.name}`))})">
                            <div class="coread-category-stack-books">
                                ${books.slice(0, 5).map((book, index) => `
                                    <span class="coread-category-mini-book b${index + 1}">
                                        ${book.coverUrl ? `<img src="${musicEscapeAttr(book.coverUrl)}" onerror="this.remove()">` : `<em>${musicEscapeHtml(String(book.title || group.name).slice(0, 1))}</em>`}
                                    </span>
                                `).join('') || '<span class="coread-category-mini-book b1"><em>空</em></span>'}
                            </div>
                            <i></i>
                            <strong>${musicEscapeHtml(group.name)}</strong>
                            <small>${group.books.length} 本</small>
                        </button>
                    `;
                }).join('')}
            </div>
        </section>
    `;
}

function getCoReadBookTags(book) {
    const tags = [];
    const push = value => {
        const text = String(value || '').trim();
        if (text && !tags.includes(text)) tags.push(text.slice(0, 12));
    };
    (Array.isArray(book && book.tags) ? book.tags : []).forEach(push);
    push(book && (book.category || book.categoryId));
    push(book && book.sourceData && book.sourceData.kind);
    if (book && book.source) push(book.source === 'search' ? '在线' : book.source);
    return tags.slice(0, 5);
}

function getCoReadBookIntro(book, limit = 92) {
    const source = String(book && (book.description || book.content || '') || '')
        .replace(/\s+/g, ' ')
        .replace(/^书名[:：][^。！？\n]{0,120}/, '')
        .trim();
    if (!source) return '这本书还没有简介。';
    return source.slice(0, limit);
}

function renderCoReadShelfRail(library = getCoReadLibrary()) {
    const books = (Array.isArray(library) ? library : []).slice(0, 18);
    if (!books.length) return '';
    return `
        <section class="coread-total-shelf" aria-label="总书架">
            <div class="coread-total-shelf-rail">
                ${books.map((book, index) => `
                    <button type="button" class="coread-total-book b${index % 5}" onclick="openCoReadBookDetail('${musicEscapeAttr(book.id)}')" aria-label="${musicEscapeAttr(book.title || '未命名书籍')}">
                        ${book.coverUrl ? `<img src="${musicEscapeAttr(book.coverUrl)}" onerror="this.remove()">` : `<span>${musicEscapeHtml(String(book.title || '书').slice(0, 1))}</span>`}
                    </button>
                `).join('')}
            </div>
        </section>
    `;
}

function getCurrentCoReadThought() {
    const book = getCoReadBook(coreadActiveBookId);
    if (!book || !Array.isArray(book.thoughts)) return null;
    const charId = coreadActiveCharId || '';
    const page = Math.max(0, Number(book.page || 0));
    const item = book.thoughts.find(thought => thought
        && (!charId || thought.charId === charId)
        && Math.max(0, Number(thought.page || 0)) === page);
    if (!item) return null;
    const char = getCoReadCharacterById(item.charId);
    return {
        ...item,
        bookId: book.id,
        bookTitle: book.title || '未命名书籍',
        charName: item.charName || getCoReadCharName(char) || 'char',
        charAvatar: item.charAvatar || (char && char.avatar) || DEFAULT_AVATAR,
        replies: Array.isArray(item.replies) ? item.replies : []
    };
}

function saveCoReadThoughtMutation(bookId, thoughtId, mutator) {
    const library = getCoReadLibrary();
    const record = library.find(book => book && book.id === bookId);
    if (!record) return null;
    record.thoughts = Array.isArray(record.thoughts) ? record.thoughts : [];
    const thought = record.thoughts.find(item => item && item.id === thoughtId);
    if (!thought) return null;
    mutator(thought, record);
    saveCoReadLibrary(library);
    return thought;
}

function createCoReadThoughtRecord(book, char, text, anchor = null) {
    const library = getCoReadLibrary();
    const record = library.find(item => item.id === book.id);
    if (!record) return null;
    record.thoughts = Array.isArray(record.thoughts) ? record.thoughts : [];
    // The comment belongs to the page it was asked about, not wherever the reader turned while waiting.
    const hasAnchor = anchor && Number.isFinite(Number(anchor.page));
    const thought = {
        id: `thought_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        charId: char.id,
        charName: getCoReadCharName(char),
        charAvatar: char.avatar || DEFAULT_AVATAR,
        text,
        page: hasAnchor ? Number(anchor.page) : Number(record.page || 0),
        pageText: hasAnchor ? String(anchor.pageText || '') : getCoReadRecentPageContextText(record),
        replies: [],
        createdAt: Date.now()
    };
    record.thoughts.unshift(thought);
    record.thoughts = record.thoughts.slice(0, 120);
    saveCoReadLibrary(library);
    return { ...thought, bookId: record.id, bookTitle: record.title || '未命名书籍' };
}

function getCoReadRecentDiscussionContext(charId, currentBookId = '') {
    const rows = getCoReadThoughts(80)
        .filter(item => item.charId === charId)
        .slice(0, 6)
        .map(item => {
            const replies = (Array.isArray(item.replies) ? item.replies : [])
                .slice(-4)
                .map(reply => `${reply.role === 'user' ? '用户' : item.charName || 'char'}：${String(reply.text || '').slice(0, 160)}`)
                .join('\n');
            return [
                `《${item.bookTitle || '共读'}》${item.bookId === currentBookId ? '（当前书）' : ''}`,
                `${item.charName || 'char'}：${String(item.text || '').slice(0, 260)}`,
                replies
            ].filter(Boolean).join('\n');
        });
    return rows.join('\n\n') || '暂无共读对话。';
}

function buildCoReadCommentMessages(char, book, extra = {}) {
    const userProfile = typeof getWechatChatUserProfile === 'function' ? getWechatChatUserProfile(char) : (typeof getUserProfile === 'function' ? getUserProfile() : {});
    const identity = typeof buildWechatIdentityContextPrompt === 'function' ? buildWechatIdentityContextPrompt(char, userProfile) : '';
    const safeRetry = !!extra.safeRetry;
    const rawWorldBook = getCoReadWorldBookText(char);
    const worldBook = safeRetry ? sanitizeCoReadPromptText(rawWorldBook).slice(0, 1600) : rawWorldBook;
    const memory = safeRetry ? '' : (typeof buildWechatMemoryPrompt === 'function' ? buildWechatMemoryPrompt(char) : '');
    const persona = String(char.description || '').slice(0, safeRetry ? 2200 : 4200);
    const rawPageText = extra.pageText || getCoReadRecentPageContextText(book);
    const pageText = safeRetry ? sanitizeCoReadPromptText(rawPageText).slice(0, 1100) : rawPageText;
    const instruction = extra.replyText
        ? '用户刚回复了你的共读言论。请仍然按角色身份接话，像聊天一样回复用户，短一点，有态度，优先回应当前页，必要时参考上一页的承接。'
        : '请用角色会对用户说出口的语气，写 1-3 段短评论。可以感悟、吐槽、代入剧情，但必须优先贴着当前页说，必要时参考上一页的承接。不要复述整段原文。';
    return [
        {
            role: 'system',
            content: '你是 BYND 共读小说功能里的角色即时共读伙伴。必须让角色按自己的人设、世界书、当前关系、最近聊天和共读记录发言。输出必须是可直接显示在气泡里的中文自然语言，禁止空内容，禁止 JSON，禁止系统口吻，禁止通用书评，禁止替用户总结。'
        },
        {
            role: 'user',
            content: [
                identity,
                persona ? `【角色卡/人设】\n${persona}` : '',
                worldBook ? `【世界书】\n${worldBook}` : '',
                memory ? `【角色记忆】\n${memory}` : '',
                `【最近聊天】\n${getCoReadRecentContext(char)}`,
                `【最近共读对话】\n${getCoReadRecentDiscussionContext(char.id, book.id)}`,
                `【正在共读的书】\n标题：${book.title}\n作者：${book.author || '未知'}\n来源：${book.url || book.source || '本地'}`,
                safeRetry
                    ? `【最近页文本（上一页 + 当前页，已安全转述，仍来自用户正在读的附近页）】\n${pageText}`
                    : `【最近页文本（上一页 + 当前页）】\n${pageText}`,
                extra.threadText ? `【本条共读对话】\n${extra.threadText}` : '',
                extra.replyText ? `【用户刚刚回复】\n${extra.replyText}` : '',
                extra.retryForEmpty ? '【重要】上一次返回为空。现在必须补写一条能直接显示的角色发言，至少 18 个中文字符，贴着当前页文本和用户关系说。' : '',
                safeRetry ? '【安全生成要求】只评论人物关系、情绪张力和角色心态，不扩写露骨内容，不输出敏感词，不输出空白。' : '',
                instruction
            ].filter(Boolean).join('\n\n')
        }
    ];
}

function normalizeCoReadAiCommentText(value) {
    let source = value;
    if (source && typeof source === 'object') {
        source = source.content || source.text || source.message || source.response || source.answer || '';
    }
    let text = String(source || '')
        .replace(/^```(?:json|text|markdown)?/i, '')
        .replace(/```$/i, '')
        .replace(/^\s*(?:角色发言|评论|旁注|回复)\s*[：:]\s*/i, '')
        .trim();
    if (/^[{[]/.test(text)) {
        try {
            const parsed = JSON.parse(text);
            const candidate = parsed && (parsed.content || parsed.text || parsed.message || parsed.response || parsed.answer || parsed.reply || parsed.comment);
            if (candidate) text = String(candidate).trim();
        } catch (_) {}
    }
    if (!text || text.length < 2) return '';
    if (/^(?:null|undefined|none|无|空|没有|AI 返回了空内容)$/i.test(text)) return '';
    return text;
}

async function requestCoReadAiComment(char, book, extra = {}, options = {}) {
    const minTokens = extra && extra.replyText ? COREAD_AI_REPLY_MAX_TOKENS : COREAD_AI_COMMENT_MAX_TOKENS;
    const requestedTokens = Number(options.max_tokens);
    const apiOptions = {
        max_tokens: Math.max(minTokens, Number.isFinite(requestedTokens) ? requestedTokens : 0),
        temperature: options.temperature ?? 0.84,
        usageFeature: 'read',
        usageChar: char,
        // Our own single retry below replaces callChatApi's back-to-back empty/status retries.
        skipEmptyLengthRetry: true,
        skipStatusValidationRetry: true
    };
    const first = await callChatApi(buildCoReadCommentMessages(char, book, extra), apiOptions);
    const firstText = normalizeCoReadAiCommentText(first && first.ok ? first.content : '');
    if (firstText) return { ok: true, text: firstText };
    // A throttled relay answers every back-to-back retry with another 429: stop here.
    if (first && (first.rateLimited || first.quotaExceeded || first.deferred || first.cancelled)) return { ok: false, error: first.error || '接口请求太频繁，请稍后再试', rateLimited: !!first.rateLimited };
    if (first && (first.ok || /空内容|empty/i.test(String(first.error || '')))) {
        // One retry at most, and only after the relay's quiet gap.
        if (typeof waitForChatApiQuietGap === 'function') await waitForChatApiQuietGap();
        const retry = await callChatApi(
            buildCoReadCommentMessages(char, book, { ...extra, retryForEmpty: true, safeRetry: true }),
            { ...apiOptions, temperature: 0.72, max_tokens: Math.max(minTokens, Number(apiOptions.max_tokens || minTokens)) }
        );
        const retryText = normalizeCoReadAiCommentText(retry && retry.ok ? retry.content : '');
        if (retryText) return { ok: true, text: retryText };
        return { ok: false, error: (retry && retry.error) || 'AI 返回了空内容', rateLimited: !!(retry && retry.rateLimited) };
    }
    return { ok: false, error: (first && first.error) || 'AI 没有回应' };
}

function groupCoReadThoughtsByCharAndBook(thoughts) {
    const groups = [];
    const byChar = new Map();
    thoughts.forEach(item => {
        const charKey = item.charId || item.charName || 'char';
        if (!byChar.has(charKey)) {
            const group = {
                charId: item.charId || '',
                charName: item.charName || 'char',
                charAvatar: item.charAvatar || DEFAULT_AVATAR,
                count: 0,
                books: new Map()
            };
            byChar.set(charKey, group);
            groups.push(group);
        }
        const group = byChar.get(charKey);
        group.count += 1;
        const bookKey = item.bookId || item.bookTitle || 'book';
        if (!group.books.has(bookKey)) {
            group.books.set(bookKey, {
                bookId: item.bookId || '',
                bookTitle: item.bookTitle || '未命名书籍',
                bookAuthor: item.bookAuthor || '',
                items: []
            });
        }
        group.books.get(bookKey).items.push(item);
    });
    return groups;
}

function renderCoReadThoughts() {
    const list = document.getElementById('coread-thought-list');
    if (!list) return;
    const groups = groupCoReadThoughtsByCharAndBook(getCoReadThoughts(240));
    list.innerHTML = groups.map(group => `
        <details class="coread-thought-group">
            <summary class="coread-thought-summary">
                <img src="${musicEscapeAttr(group.charAvatar || DEFAULT_AVATAR)}" alt="" onerror="this.src='${musicEscapeAttr(DEFAULT_AVATAR)}'">
                <div>
                    <strong>${musicEscapeHtml(group.charName || 'char')}</strong>
                    <span>读过 ${group.books.size} 本书 · ${group.count} 条想法</span>
                </div>
                <i class="ri-arrow-down-s-line" aria-hidden="true"></i>
            </summary>
            <div class="coread-thought-body">
                ${Array.from(group.books.values()).map(bookGroup => `
                    <section class="coread-thought-book">
                        <h4>
                            <span>${musicEscapeHtml(bookGroup.bookTitle || '未命名书籍')}</span>
                            <em>${bookGroup.items.length} 条</em>
                        </h4>
                        ${bookGroup.items.map(item => {
                            const replies = Array.isArray(item.replies) ? item.replies : [];
                            const userReplyCount = replies.filter(reply => reply.role === 'user').length;
                            return `
                                <div class="coread-thought-card">
                                    <p>${musicEscapeHtml(item.text || '')}</p>
                                    <em>第 ${Math.max(1, Number(item.page || 0) + 1)} 页${userReplyCount ? ` · 你回复 ${userReplyCount} 条` : ''}</em>
                                </div>
                            `;
                        }).join('')}
                    </section>
                `).join('')}
            </div>
        </details>
    `).join('') || `
        <div class="coread-empty coread-thought-empty">
            还没有共读想法。进入书架，选一本书和一个 char，让 char 写第一条旁注。
        </div>
    `;
}

function renderCoReadMePanel() {
    const list = document.getElementById('coread-me-char-list');
    if (!list) return;
    const chars = getCoReadCharacters();
    const selectedChar = chars.find(char => char.id === coreadActiveCharId) || chars[0] || null;
    const selectedStats = selectedChar ? getCoReadThoughtStatsForChar(selectedChar.id) : { bookCount: 0, thoughtCount: 0 };
    list.innerHTML = chars.length ? `
        <div class="coread-mate-dropdown ${coreadMateDropdownOpen ? 'open' : ''}">
            <button type="button" class="coread-mate-trigger" onclick="toggleCoReadMateDropdown()">
                <img src="${musicEscapeAttr((selectedChar && selectedChar.avatar) || DEFAULT_AVATAR)}" onerror="this.src='${musicEscapeAttr(DEFAULT_AVATAR)}'">
                <span>
                    <b>选择共读对象</b>
                    <strong>${musicEscapeHtml(selectedChar ? getCoReadCharName(selectedChar) : '未选择')}</strong>
                    <em>一起读过 ${selectedStats.bookCount} 本 · ${selectedStats.thoughtCount} 条旁注</em>
                </span>
                <small>${chars.length} 个角色</small>
                <i class="ri-arrow-down-s-line" aria-hidden="true"></i>
            </button>
            <div class="coread-mate-list">
            ${chars.map(char => {
        const active = selectedChar && char.id === selectedChar.id ? 'active' : '';
        const stats = getCoReadThoughtStatsForChar(char.id);
        return `
            <button type="button" class="${active}" onclick="selectCoReadChar('${musicEscapeAttr(char.id)}')">
                <img src="${musicEscapeAttr(char.avatar || DEFAULT_AVATAR)}" onerror="this.src='${musicEscapeAttr(DEFAULT_AVATAR)}'">
                <span>
                    <strong>${musicEscapeHtml(getCoReadCharName(char))}</strong>
                    <em>一起读过 ${stats.bookCount} 本 · ${stats.thoughtCount} 条旁注</em>
                </span>
                <small>${active ? '已选择' : '选择'}</small>
            </button>
        `;
    }).join('')}
            </div>
        </div>
    ` : '<div class="coread-empty">先导入角色卡</div>';
}

function toggleCoReadMateDropdown(open) {
    coreadMateDropdownOpen = typeof open === 'boolean' ? open : !coreadMateDropdownOpen;
    renderCoReadMePanel();
}
window.toggleCoReadMateDropdown = toggleCoReadMateDropdown;

function toggleCoReadCommentPanel(open) {
    coreadCommentPanelOpen = typeof open === 'boolean' ? open : !coreadCommentPanelOpen;
    if (coreadCommentPanelOpen) {
        syncCoReadPageFromScrollPosition();
        coreadTocOpen = false;
        coreadSettingsOpen = false;
        syncCoReadTocDrawerState();
        syncCoReadSettingsDrawerState();
    }
    renderCoReadCommentPanel();
}
window.toggleCoReadCommentPanel = toggleCoReadCommentPanel;

function syncCoReadPageFromScrollPosition() {
    const settings = getCoReadReaderSettings();
    if (settings.pageMode !== 'scroll' || coreadActiveTab !== 'reader') return;
    const book = getCoReadBook(coreadActiveBookId);
    const body = document.getElementById('coread-reader-body');
    if (!book || !body) return;
    const page = getCoReadPageFromScrollPosition(body, book);
    if (page !== Number(book.page || 0)) {
        book.page = page;
        saveCoReadBookPage(book.id, page);
    }
}

function openCoReadCommentPanel() {
    toggleCoReadCommentPanel(true);
    const thought = getCurrentCoReadThought();
    if (thought && coreadCommentStatusText) {
        coreadCommentStatusText = '';
        renderCoReadCommentPanel();
    }
    if (!thought && !coreadBusy) askCoReadComment();
}
window.openCoReadCommentPanel = openCoReadCommentPanel;

function buildCoReadThreadText(thought) {
    if (!thought) return '';
    const rows = [`${thought.charName || 'char'}：${thought.text || ''}`];
    (Array.isArray(thought.replies) ? thought.replies : []).forEach(reply => {
        rows.push(`${reply.role === 'user' ? '用户' : thought.charName || 'char'}：${reply.text || ''}`);
    });
    return rows.join('\n').slice(0, 1800);
}

function renderCoReadCommentPanel() {
    const panel = document.getElementById('coread-comment-popover');
    if (!panel) return;
    const book = getCoReadBook(coreadActiveBookId);
    const char = getCoReadCharacters().find(item => item.id === coreadActiveCharId);
    const thought = getCurrentCoReadThought();
    panel.classList.toggle('open', !!coreadCommentPanelOpen);
    panel.setAttribute('aria-hidden', coreadCommentPanelOpen ? 'false' : 'true');
    if (!coreadCommentPanelOpen) {
        panel.innerHTML = '';
        return;
    }
    const charName = char ? getCoReadCharName(char) : (thought && thought.charName) || 'char';
    const avatar = (char && char.avatar) || (thought && thought.charAvatar) || DEFAULT_AVATAR;
    const replies = thought && Array.isArray(thought.replies) ? thought.replies : [];
    const missing = !book || !char;
    const body = missing
        ? '先选择一本书和一个 char，再让 char 读这一段。'
        : coreadCommentStatusText
            ? coreadCommentStatusText
            : coreadBusy && !thought
                ? '正在读这一段...'
            : thought && thought.text
                ? thought.text
                : '还没有当前页言论，点“让 char 读”生成。';
    panel.innerHTML = `
        <section class="coread-comment-bubble">
            <header>
                <img src="${musicEscapeAttr(avatar)}" onerror="this.src='${musicEscapeAttr(DEFAULT_AVATAR)}'">
                <div>
                    <span>${musicEscapeHtml(book ? (book.title || '共读') : '共读')}</span>
                    <strong>${musicEscapeHtml(charName)}</strong>
                </div>
                <button type="button" onclick="toggleCoReadCommentPanel(false)" aria-label="关闭"><i class="ri-close-line"></i></button>
            </header>
            <div class="coread-comment-body ${coreadBusy ? 'thinking' : ''}">
                <p>${musicEscapeHtml(body)}</p>
            </div>
            ${replies.length ? `
                <div class="coread-comment-thread">
                    ${replies.slice(-8).map(reply => `
                        <div class="${reply.role === 'user' ? 'user' : 'char'}">
                            <span>${reply.role === 'user' ? '你' : musicEscapeHtml(charName)}</span>
                            <p>${musicEscapeHtml(reply.text || '')}</p>
                        </div>
                    `).join('')}
                </div>
            ` : ''}
            <div class="coread-comment-actions">
                <button type="button" onclick="askCoReadComment()" ${missing || coreadBusy ? 'disabled' : ''}><i class="ri-sparkling-2-line"></i><span>${thought ? '重读这段' : '让 char 读'}</span></button>
            </div>
            <label class="coread-comment-reply">
                <textarea id="coread-comment-reply-input" rows="2" placeholder="回复 ${musicEscapeAttr(charName)}..." ${!thought || coreadBusy ? 'disabled' : ''}></textarea>
                <button type="button" onclick="sendCoReadCommentReply()" ${!thought || coreadBusy ? 'disabled' : ''} aria-label="发送回复"><i class="ri-send-plane-2-fill"></i></button>
            </label>
        </section>
    `;
}

async function sendCoReadCommentReply() {
    const book = getCoReadBook(coreadActiveBookId);
    const char = getCoReadCharacters().find(item => item.id === coreadActiveCharId);
    const thought = getCurrentCoReadThought();
    const input = document.getElementById('coread-comment-reply-input');
    const replyText = String(input && input.value || '').trim();
    if (!book || !char || !thought || !replyText || coreadBusy) return;
    coreadCommentStatusText = '';
    if (input) input.value = '';
    saveCoReadThoughtMutation(book.id, thought.id, item => {
        item.replies = Array.isArray(item.replies) ? item.replies : [];
        item.replies.push({ role: 'user', text: replyText, createdAt: Date.now() });
        item.updatedAt = Date.now();
    });
    coreadBusy = true;
    renderCoReadCommentPanel();
    try {
        const latest = getCurrentCoReadThought();
        const result = await requestCoReadAiComment(char, book, {
            pageText: (latest && latest.pageText) || getCoReadRecentPageContextText(book),
            threadText: buildCoReadThreadText(latest),
            replyText
        }, { max_tokens: COREAD_AI_REPLY_MAX_TOKENS, temperature: 0.82 });
        const text = result && result.ok ? result.text : '';
        if (text) {
            saveCoReadThoughtMutation(book.id, thought.id, item => {
                item.replies = Array.isArray(item.replies) ? item.replies : [];
                item.replies.push({ role: 'char', text, createdAt: Date.now() });
                item.updatedAt = Date.now();
            });
            coreadCommentStatusText = '';
        } else {
            coreadCommentStatusText = (result && result.error) || 'AI 返回了空内容';
        }
    } catch (_) {
        coreadCommentStatusText = '生成失败，稍后再试。';
    } finally {
        coreadBusy = false;
        renderCoReadCommentPanel();
        if (coreadActiveTab === 'thoughts') renderCoReadThoughts();
        if (coreadActiveTab === 'me') renderCoReadMePanel();
    }
}
window.sendCoReadCommentReply = sendCoReadCommentReply;

