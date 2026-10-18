// Solar-term dates: Hong Kong Observatory Gregorian/lunar conversion tables (UTC+8).
// https://www.hko.gov.hk/tc/gts/time/conversion.htm
const CoReadAlmanac = (() => {
    const terms = '小寒 大寒 立春 雨水 惊蛰 春分 清明 谷雨 立夏 小满 芒种 夏至 小暑 大暑 立秋 处暑 白露 秋分 寒露 霜降 立冬 小雪 大雪 冬至'.split(' ');
    // Each row stores the 24 day numbers, two terms per Gregorian month (2020–2040).
    const termDays = {
        2020: '062004190520041905200521062207220722082307220721',
        2021: '052003180520042005210521072207230723082307220721',
        2022: '052004190520052005210621072307230723082307220722',
        2023: '052004190621052006210621072308230823082408220722',
        2024: '062004190520041905200521062207220722082307220621',
        2025: '052003180520042005210521072207230723082307220721',
        2026: '052004180520052005210521072307230723082307220722',
        2027: '052004190621052006210621072308230823082307220722',
        2028: '062004190520041905200521062207220722082307220621',
        2029: '052003180520042005210521072207230723082307220721',
        2030: '052004180520052005210521072307230723082307220722',
        2031: '052004190621052006210621072308230823082307220722',
        2032: '062004190520041905200521062207220722082307220621',
        2033: '052003180520042005210521072207230723082307220721',
        2034: '052004180520052005210521072307230723082307220722',
        2035: '052004190621052005210621072307230823082307220722',
        2036: '062004190520041905200521062207220722082307220621',
        2037: '052003180520042005210521072207230723082307220721',
        2038: '052004180520052005210521072307230723082307220722',
        2039: '052004190621052005210621072307230823082307220722',
        2040: '062004190520041905200521062207220722082307220621'
    };
    const historyKey = 'bynd_coread_history_v2';
    let termPending = null, historyPending = null, historyCache = null;
    let historyStatus = '', historyStatusDate = '';
    const today = () => CoReadJournal.dateKey(Date.now());
    const repaint = () => { if (typeof renderCoReadDaily === 'function') renderCoReadDaily(); };
    const lunar = date => typeof getChatApiLunarDateParts === 'function' ? getChatApiLunarDateParts(date) : null;
    function lunarDay(day) {
        if (!Number.isInteger(day) || day < 1 || day > 30) return '';
        if (day === 10) return '初十';
        if (day === 20) return '二十';
        if (day === 30) return '三十';
        return ['初', '十', '廿'][Math.floor(day / 10)] + '一二三四五六七八九'[(day - 1) % 10];
    }
    function lunarLabel(parts) {
        if (!parts) return '';
        return `${parts.isLeap ? '闰' : ''}${['正','二','三','四','五','六','七','八','九','十','冬','腊'][parts.month - 1]}月${lunarDay(parts.day)}`;
    }
    function solarTerm(date = new Date()) {
        const days = termDays[date.getFullYear()];
        if (!days) return '';
        const start = date.getMonth() * 2;
        const index = [start, start + 1].find(i => Number(days.slice(i * 2, i * 2 + 2)) === date.getDate());
        return index === undefined ? '' : terms[index];
    }
    function model(date = new Date()) {
        const festival = CoReadLiterature.occasion(date), term = solarTerm(date), parts = lunar(date);
        return { title: festival?.title || term || lunarDay(parts?.day) || `${date.getMonth() + 1}月${date.getDate()}日`,
            kind: festival ? 'festival' : term ? 'term' : 'lunar',
            subtitle: [lunarLabel(parts), term && festival ? term : ''].filter(Boolean).join(' · '),
            date: CoReadJournal.dateKey(date) };
    }
    async function request(url, format = 'json') {
        const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 9000);
        try {
            const response = await fetch(url, { signal: controller.signal, credentials: 'omit' });
            if (!response.ok) throw new Error(`资料服务 ${response.status}`);
            return await response[format]();
        } finally { clearTimeout(timeout); }
    }
    async function refreshTerms() {
        const year = new Date().getFullYear();
        if (termDays[year] || termPending?.year === year) return termPending?.promise;
        const promise = (async () => {
            try {
                const text = await request(`https://www.hko.gov.hk/tc/gts/time/calendar/text/files/T${year}c.txt`, 'text');
                const rows = Array.from(text.matchAll(/(\d{4})年(\d+)月(\d+)日\s+\S+\s+星期\S[^\S\r\n]+(\S+)/g)).filter(row => row[4].length === 2);
                if (rows.length !== 24 || rows.some((row, index) => Number(row[1]) !== year || Number(row[2]) !== Math.floor(index / 2) + 1 || Number(row[3]) < 1 || Number(row[3]) > 31)) throw new Error('节气日期无效');
                termDays[year] = rows.map(row => row[3].padStart(2, '0')).join('');
                repaint();
            } catch (_) { /* Without a verified table, use the actual lunar date instead of guessing a term. */ }
            finally { if (termPending?.year === year) termPending = null; }
        })();
        termPending = { year, promise };
        return promise;
    }
    function historySource(date = new Date(), provider = 'HistorIQly') {
        if (provider === '小小API') return 'https://xxapi.cn/doc/history';
        if (provider === '维基百科') return `https://zh.wikipedia.org/wiki/${encodeURIComponent(`${date.getMonth() + 1}月${date.getDate()}日`)}`;
        const months = 'january february march april may june july august september october november december'.split(' ');
        return `https://today.historiqly.com/zh/${months[date.getMonth()]}/${date.getDate()}/`;
    }
    function validHistory(value, date) {
        return value?.date === date && ['小小API', 'HistorIQly', '维基百科'].includes(value.provider)
            && Array.isArray(value.events) && value.events.length > 0 && value.events.length <= 64
            && value.events.every(event => typeof event.year === 'string' && /^前?\d{1,4}$/.test(event.year)
                && typeof event.text === 'string' && event.text.length >= 4 && event.text.length <= 600 && !/[<>]/.test(event.text)
                && (event.title === undefined || typeof event.title === 'string' && event.title.length <= 160 && !/[<>]/.test(event.title))
                && (event.anchor === undefined || /^(featured|event-\d+)$/.test(event.anchor)));
    }
    function history(date = today()) {
        if (validHistory(historyCache, date)) return historyCache;
        try {
            const saved = JSON.parse(localStorage.getItem(historyKey) || 'null');
            if (validHistory(saved, date)) return (historyCache = saved);
        } catch (_) { /* The next open can refetch a corrupt or inaccessible cache. */ }
        return null;
    }
    function parseHistory(data, date = new Date()) {
        const title = `${date.getMonth() + 1}月${date.getDate()}日`;
        if (data?.parse?.title !== title || typeof data.parse.text?.['*'] !== 'string') throw new Error('历史日期不匹配');
        const parsed = new DOMParser().parseFromString(data.parse.text['*'], 'text/html');
        if (!/大事[记記紀纪]/.test(parsed.querySelector('h2')?.textContent || '')) throw new Error('历史章节无效');
        const events = Array.from(parsed.querySelectorAll('li')).flatMap(item => {
            if (item.querySelector('li')) return [];
            item.querySelectorAll('sup, .reference, script, style').forEach(node => node.remove());
            const match = item.textContent.trim().match(/^(前?\d{1,4})年[：:—–－\s]+(.+)$/s);
            if (!match || (!match[1].startsWith('前') && Number(match[1]) >= date.getFullYear())) return [];
            const text = match[2].replace(/\s+/g, ' ').trim();
            return text.length >= 4 && text.length <= 600 && !/[<>]/.test(text) ? [{ year: match[1], text }] : [];
        });
        if (!events.length) throw new Error('暂无历史事件');
        const offset = (date.getFullYear() + date.getMonth() * 31 + date.getDate()) % events.length;
        return Array.from({ length: Math.min(3, events.length) }, (_, i) => events[(offset + i * Math.max(1, Math.floor(events.length / 3))) % events.length]);
    }
    function parseXXHistory(data, date = new Date()) {
        if (Number(data?.code) !== 200 || !Array.isArray(data.data)) throw new Error('历史接口返回失败');
        const events = [];
        for (const row of data.data) {
            if (typeof row !== 'string') continue;
            const match = row.trim().match(/^(前?\d{1,4})年(\d{1,2})月(\d{1,2})日\s+(.+)$/s);
            if (!match) continue;
            if (Number(match[2]) !== date.getMonth() + 1 || Number(match[3]) !== date.getDate()) throw new Error('历史日期不匹配');
            const event = {year: match[1], text: match[4].replace(/\s+/g, ' ').trim()};
            if (!event.year.startsWith('前') && Number(event.year) >= date.getFullYear()) continue;
            if (validHistory({date: CoReadJournal.dateKey(date), provider: '小小API', events: [event]}, CoReadJournal.dateKey(date))
                && !events.some(item => item.year === event.year && item.text === event.text)) events.push(event);
        }
        if (!events.length) throw new Error('暂无历史事件');
        return events.slice(0, 64);
    }
    function parseHistorIQly(html, date = new Date()) {
        if (typeof html !== 'string') throw new Error('历史资料无效');
        const parsed = new DOMParser().parseFromString(html, 'text/html');
        if (parsed.querySelector('link[rel="canonical"]')?.getAttribute('href') !== historySource(date)) throw new Error('历史日期不匹配');
        const candidates = [];
        const read = (node, yearSelector, titleSelector, textSelector, anchor) => {
            if (!node) return;
            const year = (node.querySelector(yearSelector)?.textContent || '').trim().replace(/^公元/, '').replace(/年$/, '');
            const title = (node.querySelector(titleSelector)?.textContent || '').replace(/\s+/g, ' ').trim();
            const text = (node.querySelector(textSelector)?.textContent || '').replace(/\s+/g, ' ').trim();
            const event = {year, title, text, anchor};
            if ((!year.startsWith('前') && Number(year) >= date.getFullYear()) || !title) return;
            if (validHistory({date: CoReadJournal.dateKey(date), provider: 'HistorIQly', events: [event]}, CoReadJournal.dateKey(date))) candidates.push(event);
        };
        read(parsed.querySelector('#featured'), '.featured-year-badge', '.featured-title', '.featured-description', 'featured');
        parsed.querySelectorAll('#events article.timeline-item').forEach((node, index) => {
            read(node, '.tl-year', '.tl-title', '.tl-desc', /^event-\d+$/.test(node.id) ? node.id : `event-${index}`);
        });
        const events = candidates.filter((event, index) => candidates.findIndex(item => item.year === event.year && item.title === event.title) === index).slice(0, 24);
        if (!events.length) throw new Error('暂无历史事件');
        return events;
    }
    async function refreshHistory(force = false) {
        const date = today(), now = new Date();
        if (historyPending?.date === date) return historyPending.promise;
        if (!force && history(date)) return history(date);
        historyStatusDate = date; historyStatus = '正在翻阅历史…';
        const promise = (async () => {
            try {
                let value;
                const page = encodeURIComponent(`${now.getMonth() + 1}月${now.getDate()}日`);
                const sources = [
                    ['小小API', async () => parseXXHistory(await request('https://v2.xxapi.cn/api/history'), now)],
                    ['HistorIQly', async () => parseHistorIQly(await request(historySource(now), 'text'), now)],
                    ['维基百科', async () => parseHistory(await request(`https://zh.wikipedia.org/w/api.php?action=parse&page=${page}&prop=text&section=1&format=json&variant=zh-cn&origin=*`), now)]
                ];
                for (const [provider, load] of sources) {
                    try { value = {date, provider, events: await load()}; break; }
                    catch (_) { if (today() !== date) return null; }
                }
                if (!value) throw new Error('历史资料暂时无法获取');
                if (today() !== date) return null;
                historyCache = value; historyStatus = '';
                try { localStorage.setItem(historyKey, JSON.stringify(value)); }
                catch (_) { historyStatus = '本次内容未能缓存'; }
                return value;
            } catch (_) {
                if (today() === date) historyStatus = '暂时无法获取，点此重试';
                return null;
            } finally {
                if (historyPending?.date === date) historyPending = null;
                repaint();
            }
        })();
        historyPending = { date, promise };
        repaint();
        return promise;
    }
    return { model, solarTerm, lunarDay, refreshTerms, history, refreshHistory, parseHistory, parseXXHistory, parseHistorIQly, historySource,
        get historyStatus() { return historyStatusDate === today() ? historyStatus : ''; }, historyKey };
})();
window.CoReadAlmanac = CoReadAlmanac;
