// Actual, local reading activity. Importing a book never creates an entry.
const CoReadJournal = (() => {
    const key = 'bynd_coread_reading_journal_v1';
    let session = null;
    let timer = null;
    let error = '';
    const dateKey = value => {
        const date = new Date(value);
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    };
    function read() {
        const raw = localStorage.getItem(key);
        if (!raw) return { version: 1, days: [] };
        const value = JSON.parse(raw);
        if (value?.version !== 1 || !Array.isArray(value.days) || value.days.some(day =>
            !/^\d{4}-\d{2}-\d{2}$/.test(day.date) || !Array.isArray(day.books) || day.books.some(book =>
                !book.id || !Array.isArray(book.pages) || book.pages.some(page => !Number.isInteger(page) || page < 0) || !Number.isFinite(book.seconds) || book.seconds < 0))) {
            throw new Error('阅读记录格式不正确，请先导出备份再检查');
        }
        return value;
    }
    function snapshot(book) {
        return { id: String(book.id), title: String(book.title || '未命名书籍'), author: String(book.author || '未知作者'),
            coverUrl: String(book.coverUrl || ''), tags: Array.isArray(book.tags) ? book.tags.map(String) : [],
            rating: Math.max(0, Math.min(5, Number(book.rating) || 0)), length: String(book.content || '').length };
    }
    function record(book, page, from, to) {
        if (!book?.id || !book.content || book.resolving) return;
        if (!Number.isFinite(from) || !Number.isFinite(to) || to < from) throw new Error('阅读记录时间不正确');
        const data = read(); // Fresh read also respects restored backups and other tabs.
        const info = snapshot(book);
        const index = Math.max(0, Math.min(Math.ceil(info.length / COREAD_PAGE_SIZE) - 1, Math.floor(Number(page) || 0)));
        let cursor = from;
        do {
            const date = dateKey(cursor);
            const local = new Date(cursor);
            const midnight = new Date(local.getFullYear(), local.getMonth(), local.getDate() + 1).getTime();
            const stop = Math.min(to, midnight);
            let day = data.days.find(item => item.date === date);
            if (!day) { day = { date, books: [] }; data.days.push(day); }
            let entry = day.books.find(item => item.id === info.id);
            if (!entry) { entry = { ...info, seconds: 0, pages: [], firstAt: cursor, lastAt: stop }; day.books.push(entry); }
            Object.assign(entry, info);
            entry.seconds += Math.max(0, (stop - cursor) / 1000);
            entry.lastAt = stop;
            if (!entry.pages.includes(index)) entry.pages.push(index);
            // A last-page jump alone is not a completed book: all pages must have been seen.
            if (index === Math.ceil(info.length / COREAD_PAGE_SIZE) - 1) entry.lastPageSeconds = (Number(entry.lastPageSeconds) || 0) + Math.max(0, (stop - cursor) / 1000);
            const all = data.days.flatMap(item => item.books.filter(item => item.id === info.id));
            const seen = new Set(all.flatMap(item => item.pages).filter(page => page < Math.ceil(info.length / COREAD_PAGE_SIZE)));
            if (index === Math.ceil(info.length / COREAD_PAGE_SIZE) - 1 && all.reduce((sum,item) => sum + (Number(item.lastPageSeconds) || 0),0) >= 5 && seen.size >= Math.ceil(info.length / COREAD_PAGE_SIZE) && !all.some(item => item.finishedAt)) entry.finishedAt = Math.max(cursor, stop - 1);
            cursor = stop;
        } while (cursor < to);
        data.days.sort((a, b) => a.date.localeCompare(b.date));
        localStorage.setItem(key, JSON.stringify(data)); // No in-memory success before this write.
    }
    function report(exception) {
        error = `阅读记录未保存：${exception.message || exception}`;
        const meta = document.getElementById('coread-reader-meta');
        if (meta) { meta.textContent = error; meta.setAttribute('role', 'status'); }
    }
    function active() {
        return document.visibilityState !== 'hidden' && document.getElementById('app-coread-window')?.classList.contains('active')
            && coreadActiveTab === 'reader' && !coreadReaderPanelOpen && !coreadSettingsOpen && !coreadTocOpen && !coreadCommentPanelOpen;
    }
    function flush(now = Date.now()) {
        if (!session) return;
        const end = Math.min(now, session.lastInput + 120000);
        if (end > session.tick) {
            try { record(session.book, session.page, session.tick, end); error = ''; }
            catch (exception) { report(exception); }
        }
        // A failed write is surfaced; don't fabricate or duplicate elapsed time on retry.
        session.tick = now;
    }
    function stop() { flush(); session = null; }
    function sync(book, now = Date.now()) {
        if (!active() || !book?.content || book.resolving) { stop(); return; }
        const page = Math.max(0, Number(book.page) || 0);
        if (session?.book.id === book.id && session.page === page) {
            if (error) report(new Error(error.replace(/^阅读记录未保存：/, '')));
            return;
        }
        flush(now);
        session = { book: { ...book }, page, tick: now, lastInput: now };
        try { record(book, page, now, now); error = ''; } catch (exception) { report(exception); }
    }
    function init() {
        if (timer) return;
        timer = setInterval(() => {
            if (!active()) { stop(); return; }
            sync(getCoReadBook(coreadActiveBookId));
            flush();
        }, 5000);
        document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') stop(); });
        window.addEventListener('pagehide', stop);
        const host = document.getElementById('app-coread-window');
        if (host && typeof MutationObserver !== 'undefined') new MutationObserver(() => {
            if (!active()) stop(); else sync(getCoReadBook(coreadActiveBookId));
        }).observe(host, { attributes:true, attributeFilter:['class'] });
        for (const event of ['pointerdown', 'keydown', 'scroll']) document.addEventListener(event, event => {
            if (!active() || !document.getElementById('app-coread-window')?.contains(event.target)) return;
            if (session) session.lastInput = Date.now();
        }, { capture: true, passive: true });
    }
    function entries(start = 0, end = Infinity, library = getCoReadLibrary()) {
        return read().days.filter(day => {
            const time = new Date(day.date + 'T00:00:00').getTime();
            return time >= start && time < end;
        }).flatMap(day => day.books.map(entry => ({ ...entry, date: day.date, book: library.find(book => book.id === entry.id) || entry })));
    }
    function aggregate(rows) {
        const books = new Map();
        for (const row of rows) {
            let item = books.get(row.id);
            if (!item) { item = { book: row.book, seconds: 0, chars: 0, days: new Set(), pages: new Set(), finishedAt: 0 }; books.set(row.id, item); }
            item.seconds += row.seconds;
            item.days.add(row.date);
            item.finishedAt ||= Number(row.finishedAt) || 0;
            row.pages.forEach(page => item.pages.add(page));
            item.chars = [...item.pages].reduce((sum, page) => sum + Math.max(0, Math.min(COREAD_PAGE_SIZE, (row.length || 0) - page * COREAD_PAGE_SIZE)), 0);
        }
        return [...books.values()];
    }
    return { key, dateKey, read, record, entries, aggregate, sync, stop, init, get error() { return error; } };
})();
window.CoReadJournal = CoReadJournal;
