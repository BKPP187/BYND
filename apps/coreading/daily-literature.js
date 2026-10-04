// Text is fetched from public literature services, never selected from bundled quotes.
const CoReadLiterature = (() => {
    const key = 'bynd_coread_literature_v1';
    let pending = null;
    let current = null;
    let status = '';
    let attempted = '';
    let midnightTimer = null;
    const today = date => CoReadJournal.dateKey(date || Date.now());
    function occasion(date = new Date()) {
        const month = date.getMonth() + 1, day = date.getDate();
        if (month === 10 && day <= 7) return { title: '国庆', category: 'shuqing/aiguo' };
        const fixed = { '1-1': ['元旦','jieri/chunjie'], '5-1': ['劳动节','shenghuo/tianyuan'], '6-1': ['儿童节','renwu/ertong'] }[`${month}-${day}`];
        const lunar = typeof getChatApiLunarDateParts === 'function' ? getChatApiLunarDateParts(date) : null;
        const festival = lunar && !lunar.isLeap ? {
            '1-1': ['春节','jieri/chunjie'], '1-15': ['元宵','jieri/yuanxiaojie'], '5-5': ['端午','jieri/duanwujie'],
            '7-7': ['七夕','jieri/qixijie'], '8-15': ['中秋','jieri/zhongqiujie'], '9-9': ['重阳','jieri/chongyangjie']
        }[`${lunar.month}-${lunar.day}`] : null;
        const value = festival || fixed;
        return value ? { title: value[0], category: value[1] } : null;
    }
    function valid(entry, date) {
        return entry && entry.date === date && typeof entry.text === 'string' && entry.text.trim().length >= 4 && entry.text.length <= 160
            && typeof entry.author === 'string' && typeof entry.work === 'string'
            && ['今日诗词', '一言'].includes(entry.provider);
    }
    function get(date = today()) {
        if (valid(current, date)) return current;
        try { const saved = JSON.parse(localStorage.getItem(key) || 'null'); if (valid(saved, date)) return (current = saved); }
        catch (_) { /* A bad quote cache can be refetched without touching reading records. */ }
        return null;
    }
    async function request(url) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 9000);
        try {
            const response = await fetch(url, { signal: controller.signal, credentials: 'omit', cache: 'no-store' });
            if (!response.ok) throw new Error(`文句服务 ${response.status}`);
            return await response.json();
        } finally { clearTimeout(timeout); }
    }
    function normalize(data, provider, date, holiday) {
        const text = String(provider === '一言' ? data.hitokoto || '' : data.content || '').trim();
        if (text.length < 4 || text.length > 160 || /[<>]/.test(text)) throw new Error('文句服务返回了无效内容');
        return { date, text, author: String(provider === '一言' ? data.from_who || '' : data.author || '').slice(0, 80),
            work: String(provider === '一言' ? data.from || '' : data.origin || '').slice(0, 100), provider,
            holiday: holiday?.title || '', uuid: provider === '一言' && /^[a-z0-9-]{1,80}$/i.test(data.uuid || '') ? data.uuid : '' };
    }
    function repaint() { if (typeof renderCoReadDaily === 'function') renderCoReadDaily(); }
    async function refresh(force = false) {
        const date = today();
        if (pending?.date === date) return pending.promise;
        if (!force && (get(date) || attempted === date)) { repaint(); return get(date); }
        attempted = date;
        status = '正在获取今日文句…'; repaint();
        const holiday = occasion();
        const promise = (async () => {
            try {
                let next;
                if (!holiday) {
                    try { next = normalize(await request('https://v1.hitokoto.cn/?c=d&c=i&min_length=8&max_length=100'), '一言', date, null); }
                    catch (_) { /* Poetry is an online fallback when the literature service is unavailable. */ }
                }
                if (!next) next = normalize(await request(`https://v1.jinrishici.com/${holiday?.category || 'all'}.json`), '今日诗词', date, holiday);
                if (today() !== date) return null; // Never cache an old request under a new day's date.
                current = next;
                try { localStorage.setItem(key, JSON.stringify(next)); status = ''; }
                catch (exception) { status = `文句已获取，缓存未保存：${exception.message || exception}`; }
                return next;
            } catch (exception) {
                if (today() === date) status = get(date) ? '更新失败，保留今日已获取的文句，点击重试' : '今日文句暂时无法获取，点击重试';
                return null;
            } finally {
                if (pending?.date === date) pending = null;
                repaint();
            }
        })();
        pending = { date, promise };
        return promise;
    }
    function schedule() {
        if (midnightTimer) clearTimeout(midnightTimer);
        const now = new Date();
        midnightTimer = setTimeout(() => {
            refresh(); schedule();
        }, new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime() - now.getTime() + 50);
    }
    function init() {
        schedule(); refresh();
        if (!init.bound) {
            init.bound = true;
            window.addEventListener('online', () => { if (!get()) refresh(true); });
            document.addEventListener('visibilitychange', () => { if (document.visibilityState !== 'hidden') { refresh(); schedule(); } });
        }
    }
    function source(entry) {
        return entry?.provider === '一言' ? `https://hitokoto.cn/${entry.uuid ? `?uuid=${encodeURIComponent(entry.uuid)}` : ''}` : 'https://www.jinrishici.com/';
    }
    return { key, today, occasion, normalize, get, refresh, init, source, get status() { return status; } };
})();
window.CoReadLiterature = CoReadLiterature;
