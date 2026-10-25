// --- PageMate 划线：user 和 char 都能在正文里划线、写读书笔记、围绕划线讨论；分别统计双方的阅读时间 ---
const COREAD_HIGHLIGHT_KEY = 'bynd_coread_highlights_v1';
const COREAD_CHAR_TIME_KEY = 'bynd_coread_char_time_v1';
const COREAD_HIGHLIGHT_MAX_QUOTE = 600;
// A character reading a page alone is credited at a steady ~480 Chinese characters a minute.
const COREAD_CHAR_READ_CHARS_PER_SECOND = 8;
let coreadHighlightOpenId = '';
let coreadHighlightBusy = '';
let coreadHighlightStatus = '';
let coreadHighlightSelection = null;

function readCoReadHighlightStore() {
    const raw = localStorage.getItem(COREAD_HIGHLIGHT_KEY);
    if (!raw) return { version: 1, books: {} };
    const value = JSON.parse(raw);
    if (value?.version !== 1 || !value.books || typeof value.books !== 'object' || Array.isArray(value.books)) {
        throw new Error('划线记录格式不正确，请先导出备份再检查');
    }
    return value;
}

function getCoReadHighlights(bookId) {
    try {
        const list = readCoReadHighlightStore().books[String(bookId || '')];
        return Array.isArray(list) ? list.filter(item => item && item.id && Number.isFinite(item.start) && item.end > item.start) : [];
    } catch (error) {
        console.warn('划线记录读取失败', error);
        return [];
    }
}

// Writes go through a fresh read so restored backups and other tabs are respected; failures throw.
function saveCoReadHighlightMutation(bookId, mutator) {
    const key = String(bookId || '');
    if (!key || key === '__proto__') throw new Error('缺少书籍');
    const store = readCoReadHighlightStore();
    const list = Array.isArray(store.books[key]) ? store.books[key] : [];
    const result = mutator(list);
    store.books[key] = list.sort((a, b) => a.start - b.start || a.end - b.end);
    if (!store.books[key].length) delete store.books[key];
    localStorage.setItem(COREAD_HIGHLIGHT_KEY, JSON.stringify(store));
    return result;
}

function normalizeCoReadHighlightRange(content, start, end) {
    const text = String(content || '');
    let from = Math.max(0, Math.min(text.length, Math.floor(Number(start) || 0)));
    let to = Math.max(0, Math.min(text.length, Math.floor(Number(end) || 0)));
    if (to < from) [from, to] = [to, from];
    while (from < to && /\s/.test(text[from])) from++;
    while (to > from && /\s/.test(text[to - 1])) to--;
    if (to <= from) return null;
    if (to - from > COREAD_HIGHLIGHT_MAX_QUOTE) to = from + COREAD_HIGHLIGHT_MAX_QUOTE;
    return { start: from, end: to, quote: text.slice(from, to) };
}

function addCoReadHighlight(book, options = {}) {
    if (!book?.id || !book.content) throw new Error('这本书还没有正文，不能划线');
    const range = normalizeCoReadHighlightRange(book.content, options.start, options.end);
    if (!range) throw new Error('先选中一段正文');
    const by = options.by === 'char' ? 'char' : 'user';
    const charId = by === 'char' ? String(options.charId || '') : '';
    if (by === 'char' && !charId) throw new Error('缺少划线的角色');
    return saveCoReadHighlightMutation(book.id, list => {
        const existing = list.find(item => item.by === by && item.charId === charId && item.start === range.start && item.end === range.end);
        if (existing) {
            if (options.note && !existing.note) existing.note = String(options.note).slice(0, 1000);
            existing.updatedAt = Date.now();
            return existing;
        }
        const item = {
            id: `hl_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
            by, charId, charName: String(options.charName || '').slice(0, 40),
            start: range.start, end: range.end, quote: range.quote,
            page: Math.floor(range.start / COREAD_PAGE_SIZE),
            note: String(options.note || '').slice(0, 1000),
            discussion: [], createdAt: Date.now(), updatedAt: Date.now()
        };
        list.push(item);
        return item;
    });
}

function deleteCoReadHighlight(bookId, id) {
    return saveCoReadHighlightMutation(bookId, list => {
        const index = list.findIndex(item => item.id === id);
        if (index < 0) return null;
        return list.splice(index, 1)[0];
    });
}

function updateCoReadHighlight(bookId, id, mutator) {
    return saveCoReadHighlightMutation(bookId, list => {
        const item = list.find(row => row.id === id);
        if (!item) throw new Error('这条划线已被删除');
        mutator(item);
        item.updatedAt = Date.now();
        return item;
    });
}

// Splits a rendered stretch of text (which starts at absolute offset textStart) at highlight edges.
function splitCoReadTextByHighlights(text, textStart, highlights) {
    const source = String(text || '');
    const from = Number(textStart) || 0, to = from + source.length;
    const rows = (Array.isArray(highlights) ? highlights : []).filter(item => item.end > from && item.start < to);
    if (!rows.length) return [{ text: source, ids: [], owners: [] }];
    const cuts = new Set([from, to]);
    rows.forEach(item => { cuts.add(Math.max(from, item.start)); cuts.add(Math.min(to, item.end)); });
    const points = [...cuts].sort((a, b) => a - b);
    const segments = [];
    for (let i = 0; i < points.length - 1; i++) {
        const a = points[i], b = points[i + 1];
        if (b <= a) continue;
        const covering = rows.filter(item => item.start <= a && item.end >= b);
        const owners = [...new Set(covering.map(item => item.by))];
        const last = segments[segments.length - 1];
        const ids = covering.map(item => item.id);
        if (last && last.ids.join() === ids.join()) last.text += source.slice(a - from, b - from);
        else segments.push({ text: source.slice(a - from, b - from), ids, owners });
    }
    return segments;
}

function renderCoReadHighlightedText(book, textStart, text) {
    return splitCoReadTextByHighlights(text, textStart, getCoReadHighlights(book?.id)).map(segment => {
        if (!segment.ids.length) return musicEscapeHtml(segment.text);
        const kind = segment.owners.length > 1 ? 'is-both' : segment.owners[0] === 'char' ? 'is-char' : 'is-user';
        return `<mark class="coread-hl ${kind}" data-hl-ids="${musicEscapeAttr(segment.ids.join(' '))}">${musicEscapeHtml(segment.text)}</mark>`;
    }).join('');
}

// Maps the DOM selection back to absolute offsets through each paragraph span's data-coread-offset.
function getCoReadSelectionOffsets(selection = window.getSelection?.()) {
    if (!selection || selection.isCollapsed || !selection.rangeCount) return null;
    const range = selection.getRangeAt(0);
    const locate = (container, offset, edge) => {
        const node = container.nodeType === 1 ? container : container.parentElement;
        let span = node?.closest?.('[data-coread-offset]');
        if (!span) {
            // An end point on the paragraph's own chrome snaps to its text edge.
            span = node?.closest?.('.coread-reader-paragraph')?.querySelector('[data-coread-offset]');
            if (!span) return null;
            return Number(span.dataset.coreadOffset) + (edge === 'start' ? 0 : span.textContent.length);
        }
        const measure = document.createRange();
        measure.setStart(span, 0);
        measure.setEnd(container, offset);
        return Number(span.dataset.coreadOffset) + measure.toString().length;
    };
    const start = locate(range.startContainer, range.startOffset, 'start');
    const end = locate(range.endContainer, range.endOffset, 'end');
    if (start == null || end == null || end <= start) return null;
    return { start, end };
}

function getCoReadHighlightChar() {
    return getCoReadCharacters().find(item => item.id === coreadActiveCharId) || null;
}

function showCoReadHighlightToast(text) {
    if (typeof showCoReadShelfToast === 'function') showCoReadShelfToast(text);
    else window.showWechatToast?.(text);
}

function refreshCoReadHighlightViews() {
    if (typeof renderCoReadReader === 'function' && coreadActiveTab === 'reader') renderCoReadReader();
    else if (typeof renderCoReadReaderOverview === 'function') renderCoReadReaderOverview();
    renderCoReadHighlightSheet();
}

// --- 选中文字后的浮动工具条 ---
function updateCoReadSelectionToolbar() {
    const body = document.getElementById('coread-reader-body');
    let bar = document.getElementById('coread-hl-toolbar');
    const selection = window.getSelection?.();
    const book = typeof getCoReadBook === 'function' ? getCoReadBook(coreadActiveBookId) : null;
    const inside = body && selection && selection.rangeCount && body.contains(selection.getRangeAt(0).commonAncestorContainer);
    const offsets = inside && book?.content ? getCoReadSelectionOffsets(selection) : null;
    if (!offsets) {
        coreadHighlightSelection = null;
        bar?.remove();
        return;
    }
    coreadHighlightSelection = { bookId: book.id, ...offsets };
    const host = body.parentElement;
    if (!bar) {
        bar = document.createElement('div');
        bar.id = 'coread-hl-toolbar';
        bar.className = 'coread-hl-toolbar';
        bar.setAttribute('role', 'toolbar');
        bar.setAttribute('aria-label', '划线');
        bar.innerHTML = `
            <button type="button" data-hl-action="mark"><i class="ri-mark-pen-line"></i><span>划线</span></button>
            <button type="button" data-hl-action="note"><i class="ri-sticky-note-line"></i><span>笔记</span></button>
            <button type="button" data-hl-action="discuss"><i class="ri-chat-smile-2-line"></i><span>聊聊</span></button>`;
        // pointerdown keeps the selection alive on touch devices; the action runs on click.
        bar.addEventListener('pointerdown', event => event.preventDefault());
        bar.addEventListener('click', event => {
            const action = event.target.closest('[data-hl-action]')?.dataset.hlAction;
            if (action) createCoReadHighlightFromSelection(action);
        });
        host.appendChild(bar);
    }
    const rect = selection.getRangeAt(0).getBoundingClientRect();
    const hostRect = host.getBoundingClientRect();
    const width = bar.offsetWidth || 196;
    const left = Math.max(8, Math.min(hostRect.width - width - 8, rect.left - hostRect.left + rect.width / 2 - width / 2));
    const above = rect.top - hostRect.top - 50;
    bar.style.left = `${left}px`;
    bar.style.top = `${above > 6 ? above : rect.bottom - hostRect.top + 8}px`;
}

function createCoReadHighlightFromSelection(action = 'mark') {
    const draft = coreadHighlightSelection;
    const book = draft ? getCoReadBook(draft.bookId) : null;
    if (!draft || !book) return null;
    let item = null;
    try {
        item = addCoReadHighlight(book, { by: 'user', start: draft.start, end: draft.end });
    } catch (error) {
        showCoReadHighlightToast(`划线未保存：${error.message || error}`);
        return null;
    }
    window.getSelection?.()?.removeAllRanges();
    document.getElementById('coread-hl-toolbar')?.remove();
    coreadHighlightSelection = null;
    if (action === 'note' || action === 'discuss') openCoReadHighlight(item.id, action);
    else { refreshCoReadHighlightViews(); showCoReadHighlightToast('已划线'); }
    return item;
}
window.createCoReadHighlightFromSelection = createCoReadHighlightFromSelection;

function bindCoReadHighlightEvents() {
    if (window.__coreadHighlightBound) return;
    window.__coreadHighlightBound = true;
    let timer = 0;
    document.addEventListener('selectionchange', () => {
        clearTimeout(timer);
        timer = setTimeout(updateCoReadSelectionToolbar, 120);
    });
    document.addEventListener('click', event => {
        const mark = event.target?.closest?.('#coread-reader-body .coread-hl');
        if (!mark || String(window.getSelection?.() || '').trim()) return;
        event.preventDefault();
        event.stopPropagation();
        const ids = String(mark.dataset.hlIds || '').split(' ').filter(Boolean);
        if (ids.length) openCoReadHighlight(ids[ids.length - 1]);
    }, true);
}

// --- 划线详情：笔记、讨论、删除 ---
function openCoReadHighlight(id, focus = '') {
    coreadHighlightOpenId = String(id || '');
    coreadHighlightStatus = '';
    renderCoReadHighlightSheet();
    const target = focus === 'note' ? '#coread-hl-note' : focus === 'discuss' ? '#coread-hl-reply' : '.coread-review-close';
    document.querySelector(`#coread-highlight-sheet ${target}`)?.focus({ preventScroll: true });
}
window.openCoReadHighlight = openCoReadHighlight;

function closeCoReadHighlight() {
    coreadHighlightOpenId = '';
    coreadHighlightStatus = '';
    renderCoReadHighlightSheet();
}
window.closeCoReadHighlight = closeCoReadHighlight;

function getOpenCoReadHighlight() {
    const book = getCoReadBook(coreadActiveBookId);
    const item = book ? getCoReadHighlights(book.id).find(row => row.id === coreadHighlightOpenId) : null;
    return { book, item };
}

function getCoReadHighlightOwnerName(item) {
    if (item.by !== 'char') return '你';
    const char = typeof getCoReadCharacterById === 'function' ? getCoReadCharacterById(item.charId) : null;
    return (char && getCoReadCharName(char)) || item.charName || 'char';
}

function renderCoReadHighlightSheet() {
    const host = document.getElementById('coread-highlight-sheet');
    if (!host) return;
    const { book, item } = getOpenCoReadHighlight();
    if (!coreadHighlightOpenId || !item) {
        host.hidden = true;
        host.innerHTML = '';
        if (coreadHighlightOpenId && !item) coreadHighlightOpenId = '';
        return;
    }
    const char = item.by === 'char' ? (getCoReadCharacterById(item.charId) || getCoReadHighlightChar()) : getCoReadHighlightChar();
    const charName = char ? getCoReadCharName(char) : 'char';
    const busy = coreadHighlightBusy === item.id;
    const draftNote = document.getElementById('coread-hl-note');
    const draftReply = document.getElementById('coread-hl-reply');
    const keepNote = draftNote && draftNote.dataset.hlId === item.id ? draftNote.value : null;
    const keepReply = draftReply && draftReply.dataset.hlId === item.id ? draftReply.value : '';
    const discussion = Array.isArray(item.discussion) ? item.discussion : [];
    const lastFailed = discussion.length && discussion[discussion.length - 1].role === 'user' && !busy;
    host.hidden = false;
    host.innerHTML = `<button type="button" class="coread-review-backdrop" aria-label="关闭划线" onclick="closeCoReadHighlight()"></button>
        <section class="coread-review-sheet coread-hl-sheet" role="dialog" aria-modal="true" aria-label="划线笔记">
            <div class="coread-review-sheet-head"><strong>划线 · 第 ${Math.floor(item.start / COREAD_PAGE_SIZE) + 1} 页</strong><button type="button" class="coread-review-close" aria-label="关闭划线" onclick="closeCoReadHighlight()">×</button></div>
            <div class="coread-hl-sheet-body">
                <blockquote class="coread-hl-quote ${item.by === 'char' ? 'is-char' : 'is-user'}"><span class="coread-hl-owner">${musicEscapeHtml(getCoReadHighlightOwnerName(item))}划的线</span>${musicEscapeHtml(item.quote)}</blockquote>
                <label class="coread-hl-note-field"><span>${item.by === 'char' ? `${musicEscapeHtml(charName)}的笔记` : '我的读书笔记'}</span>
                    <textarea id="coread-hl-note" data-hl-id="${musicEscapeAttr(item.id)}" rows="3" maxlength="1000" placeholder="${item.by === 'char' ? '角色没有写笔记' : '写下这句话让你想到的…'}" ${item.by === 'char' ? 'readonly' : ''}>${musicEscapeHtml(keepNote ?? item.note ?? '')}</textarea>
                </label>
                ${item.by === 'char' ? '' : `<button type="button" class="coread-hl-save-note" onclick="saveCoReadHighlightNote()">保存笔记</button>`}
                <div class="coread-hl-thread" aria-live="polite">
                    <h4>和 ${musicEscapeHtml(charName)} 聊这句</h4>
                    ${discussion.map(row => `<div class="${row.role === 'user' ? 'user' : 'char'}"><span>${row.role === 'user' ? '你' : musicEscapeHtml(charName)}</span><p>${musicEscapeHtml(row.text || '')}</p></div>`).join('') || `<p class="coread-hl-empty">还没有讨论。说说你为什么划这句，或者问问 ${musicEscapeHtml(charName)} 的想法。</p>`}
                    ${busy ? `<p class="coread-hl-thinking">${musicEscapeHtml(charName)} 正在想…</p>` : ''}
                    ${coreadHighlightStatus ? `<p class="coread-hl-status" role="alert">${musicEscapeHtml(coreadHighlightStatus)}${lastFailed ? ' <button type="button" onclick="retryCoReadHighlightDiscussion()">重试</button>' : ''}</p>` : ''}
                </div>
            </div>
            <label class="coread-comment-reply coread-hl-reply">
                <textarea id="coread-hl-reply" data-hl-id="${musicEscapeAttr(item.id)}" rows="2" placeholder="${char ? `和 ${musicEscapeAttr(charName)} 聊聊这句…` : '先在共读伙伴里选一个 char'}" ${!char || busy ? 'disabled' : ''}>${musicEscapeHtml(keepReply)}</textarea>
                <button type="button" onclick="sendCoReadHighlightDiscussion()" ${!char || busy ? 'disabled' : ''} aria-label="发送"><i class="ri-send-plane-2-fill"></i></button>
            </label>
            <div class="coread-hl-sheet-actions"><button type="button" class="danger" onclick="removeCoReadHighlight('${musicEscapeAttr(item.id)}')"><i class="ri-delete-bin-line"></i>删除划线</button></div>
        </section>`;
    host.querySelector('.coread-hl-thread')?.lastElementChild?.scrollIntoView?.({ block: 'nearest' });
}
window.renderCoReadHighlightSheet = renderCoReadHighlightSheet;

function saveCoReadHighlightNote() {
    const { book, item } = getOpenCoReadHighlight();
    const input = document.getElementById('coread-hl-note');
    if (!book || !item || !input || item.by === 'char') return false;
    try {
        updateCoReadHighlight(book.id, item.id, row => { row.note = String(input.value || '').trim().slice(0, 1000); });
        coreadHighlightStatus = '';
        showCoReadHighlightToast('笔记已保存');
        renderCoReadHighlightSheet();
        renderCoReadReaderOverview?.();
        return true;
    } catch (error) {
        coreadHighlightStatus = `笔记未保存：${error.message || error}`;
        renderCoReadHighlightSheet();
        return false;
    }
}
window.saveCoReadHighlightNote = saveCoReadHighlightNote;

function removeCoReadHighlight(id) {
    const book = getCoReadBook(coreadActiveBookId);
    if (!book) return false;
    let removed = null;
    try { removed = deleteCoReadHighlight(book.id, id); }
    catch (error) {
        coreadHighlightStatus = `删除失败：${error.message || error}`;
        renderCoReadHighlightSheet();
        showCoReadHighlightToast(coreadHighlightStatus);
        return false;
    }
    if (coreadHighlightOpenId === id) coreadHighlightOpenId = '';
    refreshCoReadHighlightViews();
    if (removed) window.ByndUndo?.offer?.({ label: '已删除划线', undo: () => {
        try { saveCoReadHighlightMutation(book.id, list => { if (!list.some(row => row.id === removed.id)) list.push(removed); }); refreshCoReadHighlightViews(); return true; }
        catch (_) { return false; }
    } });
    return !!removed;
}
window.removeCoReadHighlight = removeCoReadHighlight;

function buildCoReadHighlightThreadText(item, charName) {
    const rows = [`划线原文（${item.by === 'char' ? `${charName}划的` : '用户划的'}）：${item.quote}`];
    if (item.note) rows.push(`${item.by === 'char' ? charName : '用户'}的笔记：${item.note}`);
    (Array.isArray(item.discussion) ? item.discussion : []).forEach(row => rows.push(`${row.role === 'user' ? '用户' : charName}：${row.text}`));
    return rows.join('\n').slice(-2200);
}

async function requestCoReadHighlightReply(book, item, char, replyText) {
    const charName = getCoReadCharName(char);
    const content = String(book.content || '');
    const context = content.slice(Math.max(0, item.start - 260), Math.min(content.length, item.end + 260));
    const result = await requestCoReadAiComment(char, book, {
        pageText: `${context}\n\n（以上是划线所在的上下文，划线句子是：「${item.quote}」）`,
        threadText: buildCoReadHighlightThreadText(item, charName),
        replyText
    }, { max_tokens: COREAD_AI_REPLY_MAX_TOKENS, temperature: 0.82 });
    if (!result?.ok || !result.text) throw new Error(result?.error || 'AI 没有回应');
    return result.text;
}

async function runCoReadHighlightDiscussion(retryOnly = false) {
    const { book, item } = getOpenCoReadHighlight();
    const char = book && item ? (item.by === 'char' ? (getCoReadCharacterById(item.charId) || getCoReadHighlightChar()) : getCoReadHighlightChar()) : null;
    const input = document.getElementById('coread-hl-reply');
    if (!book || !item || !char || coreadHighlightBusy) return false;
    let replyText = String(input?.value || '').trim();
    const history = Array.isArray(item.discussion) ? item.discussion : [];
    if (retryOnly) {
        const last = history[history.length - 1];
        if (!last || last.role !== 'user') return false;
        replyText = last.text;
    } else {
        if (!replyText) return false;
        try { updateCoReadHighlight(book.id, item.id, row => { row.discussion = [...(row.discussion || []), { role: 'user', text: replyText.slice(0, 1000), createdAt: Date.now() }]; }); }
        catch (error) { coreadHighlightStatus = `消息未保存：${error.message || error}`; renderCoReadHighlightSheet(); return false; }
        if (input) input.value = '';
    }
    coreadHighlightBusy = item.id;
    coreadHighlightStatus = '';
    renderCoReadHighlightSheet();
    try {
        const latest = getCoReadHighlights(book.id).find(row => row.id === item.id) || item;
        const text = await requestCoReadHighlightReply(book, { ...latest, discussion: (latest.discussion || []).slice(0, -1) }, char, replyText);
        updateCoReadHighlight(book.id, item.id, row => { row.discussion = [...(row.discussion || []), { role: 'char', charId: char.id, text, createdAt: Date.now() }]; });
        addCoReadCharReadingSeconds(char.id, book.id, Math.round(item.quote.length / COREAD_CHAR_READ_CHARS_PER_SECOND) + 20, 'discuss');
        return true;
    } catch (error) {
        coreadHighlightStatus = `${getCoReadCharName(char)}没有回复：${error.message || error}`;
        return false;
    } finally {
        coreadHighlightBusy = '';
        renderCoReadHighlightSheet();
    }
}
window.sendCoReadHighlightDiscussion = () => runCoReadHighlightDiscussion(false);
window.retryCoReadHighlightDiscussion = () => runCoReadHighlightDiscussion(true);

// --- char 自己划线 ---
function parseCoReadCharHighlightReply(content) {
    const text = String(content || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/```$/i, '').trim();
    const start = text.indexOf('{'), end = text.lastIndexOf('}');
    if (start < 0 || end <= start) throw new Error('char 没有给出划线');
    const parsed = JSON.parse(text.slice(start, end + 1));
    const rows = Array.isArray(parsed.highlights) ? parsed.highlights : [];
    return rows.map(row => ({ quote: String(row?.quote || '').trim(), note: String(row?.note || '').trim() })).filter(row => row.quote.length >= 2).slice(0, 3);
}

// Finds a quote inside [from, to) of the book; tolerant of whitespace and quote-mark differences.
function locateCoReadQuote(content, quote, from = 0, to = content.length) {
    const text = String(content || '');
    const scope = text.slice(from, to);
    const exact = scope.indexOf(quote);
    if (exact >= 0) return { start: from + exact, end: from + exact + quote.length };
    const clean = String(quote).replace(/[\s“”"'‘’「」『』]/g, '');
    if (clean.length < 2) return null;
    const map = [];
    let flat = '';
    for (let i = 0; i < scope.length; i++) if (!/[\s“”"'‘’「」『』]/.test(scope[i])) { map.push(i); flat += scope[i]; }
    const at = flat.indexOf(clean);
    if (at < 0) return null;
    return { start: from + map[at], end: from + map[at + clean.length - 1] + 1 };
}

async function askCoReadCharHighlight() {
    const book = getCoReadBook(coreadActiveBookId);
    const char = getCoReadHighlightChar();
    if (!book?.content || !char) { showCoReadHighlightToast('先选择一本书和一个共读伙伴'); return false; }
    if (coreadHighlightBusy) return false;
    const page = Math.max(0, Math.floor(Number(book.page) || 0));
    const from = page * COREAD_PAGE_SIZE, to = Math.min(book.content.length, from + COREAD_PAGE_SIZE);
    const pageText = book.content.slice(from, to);
    coreadHighlightBusy = 'char';
    coreadHighlightStatus = '';
    renderCoReadReaderOverview?.();
    try {
        const messages = buildCoReadCommentMessages(char, book, { pageText });
        messages[0].content = '你是 BYND 共读里的角色本人，正和用户读同一本书。你会像读书人一样在打动你、刺痛你或让你想起用户的句子下划线。只返回严格 JSON，不要解释。';
        messages[1].content += `\n\n现在请从【当前页】原文里挑 1-2 句你最想划线的句子，quote 必须逐字照抄原文（不超过 80 字），note 是你写在旁边的读书笔记（不超过 60 字，用你的口吻，可以带一点对用户的心思）。返回：{"highlights":[{"quote":"原文","note":"笔记"}]}`;
        const result = await callChatApi(messages, { max_tokens: 500, temperature: 0.7, usageFeature: 'read', usageChar: char, skipEmptyLengthRetry: true, skipStatusValidationRetry: true });
        if (!result?.ok) throw new Error(result?.error || 'AI 没有回应');
        const picks = parseCoReadCharHighlightReply(result.content);
        let added = 0;
        for (const pick of picks) {
            const at = locateCoReadQuote(book.content, pick.quote, from, to);
            if (!at) continue;
            addCoReadHighlight(book, { by: 'char', charId: char.id, charName: getCoReadCharName(char), start: at.start, end: at.end, note: pick.note });
            added++;
        }
        if (!added) throw new Error('char 选的句子不在这一页原文里');
        addCoReadCharReadingSeconds(char.id, book.id, Math.round(pageText.length / COREAD_CHAR_READ_CHARS_PER_SECOND), 'solo');
        showCoReadHighlightToast(`${getCoReadCharName(char)} 划了 ${added} 句`);
        return true;
    } catch (error) {
        coreadHighlightStatus = `${getCoReadCharName(char)}没能划线：${error.message || error}`;
        showCoReadHighlightToast(coreadHighlightStatus);
        return false;
    } finally {
        coreadHighlightBusy = '';
        refreshCoReadHighlightViews();
    }
}
window.askCoReadCharHighlight = askCoReadCharHighlight;

// --- 阅读时间：user 来自阅读记录；char 的时间 = 和 user 一起读的时间 + 自己读页、划线、讨论的时间 ---
function readCoReadCharTimeStore() {
    const raw = localStorage.getItem(COREAD_CHAR_TIME_KEY);
    if (!raw) return { version: 1, chars: {} };
    const value = JSON.parse(raw);
    if (value?.version !== 1 || !value.chars || typeof value.chars !== 'object') throw new Error('角色阅读时间格式不正确');
    return value;
}

function addCoReadCharReadingSeconds(charId, bookId, seconds, kind = 'with_user') {
    const id = String(charId || ''), book = String(bookId || '');
    const value = Math.max(0, Number(seconds) || 0);
    if (!id || !book || !value || id === '__proto__' || book === '__proto__') return false;
    try {
        const store = readCoReadCharTimeStore();
        const books = store.chars[id] && typeof store.chars[id] === 'object' ? store.chars[id] : (store.chars[id] = {});
        const row = books[book] && typeof books[book] === 'object' ? books[book] : (books[book] = { withUser: 0, solo: 0 });
        if (kind === 'with_user') row.withUser = (Number(row.withUser) || 0) + value;
        else row.solo = (Number(row.solo) || 0) + value;
        row.lastAt = Date.now();
        localStorage.setItem(COREAD_CHAR_TIME_KEY, JSON.stringify(store));
        return true;
    } catch (error) {
        console.warn('角色阅读时间未保存', error);
        return false;
    }
}
window.addCoReadCharReadingSeconds = addCoReadCharReadingSeconds;

// Called by CoReadJournal after the user's own reading time is durably written.
function creditCoReadCompanionReading(book, seconds) {
    if (!book?.id || !(seconds > 0) || !coreadActiveCharId) return false;
    if (!getCoReadCharacters().some(char => char.id === coreadActiveCharId)) return false;
    return addCoReadCharReadingSeconds(coreadActiveCharId, book.id, seconds, 'with_user');
}
window.creditCoReadCompanionReading = creditCoReadCompanionReading;

function getCoReadReadingTimeSummary(bookId) {
    let userSeconds = 0;
    try {
        const days = window.CoReadJournal ? CoReadJournal.read().days : [];
        days.forEach(day => day.books.forEach(entry => { if (!bookId || entry.id === bookId) userSeconds += Number(entry.seconds) || 0; }));
    } catch (_) {}
    let chars = [];
    try {
        const store = readCoReadCharTimeStore();
        chars = Object.entries(store.chars).map(([charId, books]) => {
            const rows = Object.entries(books || {}).filter(([id]) => !bookId || id === bookId).map(([, row]) => row || {});
            const withUser = rows.reduce((sum, row) => sum + (Number(row.withUser) || 0), 0);
            const solo = rows.reduce((sum, row) => sum + (Number(row.solo) || 0), 0);
            return { charId, withUser, solo, seconds: withUser + solo };
        }).filter(row => row.seconds > 0).sort((a, b) => b.seconds - a.seconds);
    } catch (_) {}
    return { userSeconds, chars };
}
window.getCoReadReadingTimeSummary = getCoReadReadingTimeSummary;

function formatCoReadSeconds(seconds) {
    const minutes = Math.floor((Number(seconds) || 0) / 60);
    if (minutes < 1) return (Number(seconds) || 0) > 0 ? '不到 1 分钟' : '0 分钟';
    const hours = Math.floor(minutes / 60), rest = minutes % 60;
    return hours ? `${hours} 小时${rest ? ` ${rest} 分钟` : ''}` : `${rest} 分钟`;
}

function renderCoReadHighlightRows(book) {
    const summary = getCoReadReadingTimeSummary(book.id);
    const charRows = summary.chars.map(row => {
        const char = getCoReadCharacterById(row.charId);
        return `<li><img src="${musicEscapeAttr(char?.avatar || DEFAULT_AVATAR)}" onerror="this.src='${musicEscapeAttr(DEFAULT_AVATAR)}'" alt=""><span>${musicEscapeHtml(char ? getCoReadCharName(char) : '已删除角色')}</span><strong>${formatCoReadSeconds(row.seconds)}</strong><em>陪你 ${formatCoReadSeconds(row.withUser)} · 自己 ${formatCoReadSeconds(row.solo)}</em></li>`;
    }).join('');
    const highlights = getCoReadHighlights(book.id);
    const char = getCoReadHighlightChar();
    const busy = coreadHighlightBusy === 'char';
    return `
        <section class="coread-hl-time" aria-label="阅读时间">
            <ul>
                <li class="is-user"><i class="ri-user-3-line" aria-hidden="true"></i><span>你</span><strong>${formatCoReadSeconds(summary.userSeconds)}</strong><em>本书阅读时间</em></li>
                ${charRows || '<li class="is-empty"><span>char 还没有阅读时间。选一个共读伙伴一起读，或让 TA 划线。</span></li>'}
            </ul>
        </section>
        <div class="coread-hl-panel-actions">
            <button type="button" onclick="askCoReadCharHighlight()" ${!char || busy ? 'disabled' : ''}><i class="ri-mark-pen-line"></i>${busy ? '正在读这一页…' : `让 ${musicEscapeHtml(char ? getCoReadCharName(char) : 'char')} 划线`}</button>
            <span>选中正文即可划线</span>
        </div>
        ${coreadHighlightStatus && !coreadHighlightOpenId ? `<p class="coread-hl-status" role="alert">${musicEscapeHtml(coreadHighlightStatus)}</p>` : ''}
        ${highlights.map(item => `
            <article class="coread-hl-row ${item.by === 'char' ? 'is-char' : 'is-user'}">
                <button type="button" class="coread-hl-row-main" onclick="openCoReadHighlight('${musicEscapeAttr(item.id)}')">
                    <span>${musicEscapeHtml(getCoReadHighlightOwnerName(item))} · 第 ${Math.floor(item.start / COREAD_PAGE_SIZE) + 1} 页${item.discussion?.length ? ` · ${item.discussion.length} 条讨论` : ''}</span>
                    <q>${musicEscapeHtml(item.quote)}</q>
                    ${item.note ? `<p>${musicEscapeHtml(item.note)}</p>` : ''}
                </button>
                <button type="button" class="coread-hl-row-jump" onclick="jumpCoReadBookmark(${Math.floor(item.start / COREAD_PAGE_SIZE)})" aria-label="跳到这一页"><i class="ri-arrow-right-up-line"></i></button>
                <button type="button" class="coread-hl-row-delete" onclick="removeCoReadHighlight('${musicEscapeAttr(item.id)}')" aria-label="删除划线"><i class="ri-delete-bin-line"></i></button>
            </article>
        `).join('') || '<div class="coread-reader-panel-empty"><span>还没有划线。长按选中正文，就能划线、写笔记或和 char 聊这句。</span></div>'}
    `;
}

bindCoReadHighlightEvents();
