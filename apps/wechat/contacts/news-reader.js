// Public news article retrieval. Google News links are redirects, not article bodies.
(() => {
    function safeUrl(value) {
        try {
            const url = new URL(String(value || ''));
            if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password
                || /^(?:localhost|127\.|10\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.|\[|0\.)/i.test(url.hostname)) return '';
            return url.href;
        } catch (_) { return ''; }
    }

    async function request(url, options = {}, parse = response => response.text()) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 12000);
        try {
            const response = await fetch(url, { ...options, signal: controller.signal, cache: 'no-store' });
            if (!response.ok) throw new Error(`读取服务 HTTP ${response.status}`);
            return await parse(response);
        } finally { clearTimeout(timer); }
    }

    function decodeGoogleResponse(text) {
        for (const line of String(text).split('\n')) {
            if (!line.startsWith('[')) continue;
            try {
                const rows = JSON.parse(line);
                for (const row of rows) {
                    if (row[0] !== 'wrb.fr' || row[1] !== 'Fbv4je') continue;
                    const payload = JSON.parse(row[2]);
                    if (payload[0] === 'garturlres') {
                        const url = safeUrl(payload[1]);
                        if (url && new URL(url).hostname !== 'news.google.com') return url;
                    }
                }
            } catch (_) { /* Other RPC frames contain timing metadata. */ }
        }
        throw new Error('没有解析到新闻原文地址');
    }

    async function resolveUrl(value) {
        const url = safeUrl(value);
        if (!url) throw new Error('新闻来源地址无效');
        if (new URL(url).hostname !== 'news.google.com') return url;
        const id = new URL(url).pathname.match(/\/articles\/([\w-]+)/)?.[1];
        if (!id) throw new Error('新闻中转地址无效');
        const page = await request(url, {}, async response => ({ url: response.url, html: await response.text() }));
        const redirected = safeUrl(page.url);
        if (redirected && new URL(redirected).hostname !== 'news.google.com') return redirected;
        const signature = page.html.match(/data-n-a-sg="([\w-]+)"/)?.[1];
        const timestamp = Number(page.html.match(/data-n-a-ts="(\d+)"/)?.[1]);
        if (!signature || !Number.isFinite(timestamp)) throw new Error('新闻中转页未提供原文地址');
        // Google News' garturl RPC, also used by GoogleNewsDecoder:
        // https://github.com/dbernheisel/google_news_decoder
        const payload = ['garturlreq', [['X', 'X', ['X', 'X'], null, null, 1, 1, 'US:en', null, 1, null, null, null, null, null, 0, 1], 'X', 'X', 1, [1, 1, 1], 1, 1, null, 0, 0, null, 0], id, timestamp, signature];
        const body = new URLSearchParams({ 'f.req': JSON.stringify([[['Fbv4je', JSON.stringify(payload), null, 'generic']]]) });
        return decodeGoogleResponse(await request('https://news.google.com/_/DotsSplashUi/data/batchexecute?rpcids=Fbv4je', {
            method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' }, body: body.toString()
        }));
    }

    function articleText(html) {
        const doc = new DOMParser().parseFromString(String(html), 'text/html');
        doc.querySelectorAll('script,style,nav,header,footer,form,aside').forEach(element => element.remove());
        const candidates = Array.from(doc.querySelectorAll('article,main,#TRS_Editor,.TRS_Editor,.article-content,.article-text'));
        return candidates.map(element => {
            const paragraphs = Array.from(element.querySelectorAll('p')).map(p => p.textContent.trim()).filter(Boolean);
            return paragraphs.length ? paragraphs.join('\n\n') : element.textContent.trim();
        }).sort((a, b) => b.length - a.length)[0] || '';
    }

    async function read(value, onResolved = () => {}) {
        const url = await resolveUrl(value);
        onResolved(url);
        const attempts = [
            () => request(`https://r.jina.ai/${url}`, { headers: { Accept: 'application/json' } }, async response => {
                const data = await response.json();
                return String(data.data?.content || data.content || '');
            }),
            () => request(`https://freenewsapi.ai/v1/article?url=${encodeURIComponent(url)}`, {}, async response => {
                const data = await response.json();
                return String(data.text || data.article?.text || '');
            }),
            () => request(url, {}, async response => articleText(await response.text()))
        ];
        let failure;
        for (const attempt of attempts) {
            try {
                const body = await attempt();
                if (body.trim().length < 80) throw new Error('来源暂未提供可读取的正文');
                return { url, body };
            } catch (error) { failure = error; }
        }
        throw failure || new Error('新闻正文暂不可用');
    }
    window.ByndNewsReader = { safeUrl, resolveUrl, decodeGoogleResponse, articleText, read };
})();
