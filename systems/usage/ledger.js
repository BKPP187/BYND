// Global API usage ledger: one entry per real API request, kept on this device.
// Entries never store API keys or image data. Receipt details (the API ticket)
// live in a side store so listing months of history stays light.
(() => {
    'use strict';
    if (typeof window === 'undefined' || window.ByndUsageLedger) return;

    const DB_NAME = 'bynd_usage_ledger_v1';
    const STORE = 'requests';
    const TICKET_STORE = 'tickets';
    const PRICE_KEY = 'bynd_usage_prices_v1';
    const BACKFILL_KEY = 'bynd_usage_backfill_v1';
    const RETENTION_MS = 400 * 24 * 60 * 60 * 1000;
    const MAX_ENTRIES = 150000;
    const TICKET_BUDGET = 11000;
    const PRUNE_EVERY = 250;

    const FEATURES = [
        { key: 'chat', label: '聊天', icon: 'ri-chat-3-line' },
        { key: 'status', label: '心声', icon: 'ri-heart-pulse-line' },
        { key: 'moment', label: '朋友圈', icon: 'ri-camera-lens-line' },
        { key: 'forum', label: '论坛', icon: 'ri-discuss-line' },
        { key: 'world', label: '世界轨迹', icon: 'ri-earth-line' },
        { key: 'comic', label: '漫画导演', icon: 'ri-book-open-line' },
        { key: 'imagePrompt', label: '图片提示词', icon: 'ri-quill-pen-line' },
        { key: 'image', label: '生图', icon: 'ri-image-ai-line' },
        { key: 'voice', label: '语音', icon: 'ri-mic-line' },
        { key: 'charPhone', label: 'Char 手机', icon: 'ri-smartphone-line' },
        { key: 'relation', label: '关系网络', icon: 'ri-share-circle-line' },
        { key: 'memory', label: '总结记忆', icon: 'ri-brain-line' },
        { key: 'agent', label: 'Agent 行为', icon: 'ri-robot-2-line' },
        { key: 'pet', label: '桌宠', icon: 'ri-ghost-smile-line' },
        { key: 'study', label: '学习', icon: 'ri-graduation-cap-line' },
        { key: 'game', label: '游戏', icon: 'ri-gamepad-line' },
        { key: 'jev', label: 'Jev 决策', icon: 'ri-git-branch-line' },
        { key: 'tool', label: '角色工具', icon: 'ri-tools-line' },
        { key: 'discover', label: '发现页', icon: 'ri-compass-3-line' },
        { key: 'dream', label: '梦境', icon: 'ri-moon-clear-line' },
        { key: 'read', label: '共读', icon: 'ri-book-2-line' },
        { key: 'music', label: '一起听', icon: 'ri-music-2-line' },
        { key: 'other', label: '其他', icon: 'ri-more-line' }
    ];
    const FEATURE_KEYS = new Set(FEATURES.map(item => item.key));

    const listeners = new Set();
    let dbPromise = null;
    let memory = null;
    let writeChain = Promise.resolve();
    let seq = 0;
    let writesSincePrune = PRUNE_EVERY;
    let facetCache = null;

    const num = value => {
        const n = Number(value);
        return Number.isFinite(n) ? n : null;
    };
    const count = value => Math.max(0, Math.round(num(value) || 0));
    const text = (value, max = 200) => String(value ?? '').slice(0, max);
    const scrub = value => String(value ?? '')
        .replace(/data:[a-z]+\/[^\s"'<>)]+/gi, '[数据]')
        .replace(/\b(sk|ak|key|pk)-[A-Za-z0-9_\-]{12,}/g, '[已隐藏]')
        .replace(/Bearer\s+[A-Za-z0-9._\-]{12,}/gi, 'Bearer [已隐藏]');

    // BYND's own relay hosts never appear in the bill: an entry shows the service it reached.
    const RELAY_HOST = /(?:^|\.)workers\.dev$|^bynd\.ccwu\.cc$/i;
    function publicProvider(entry) {
        const host = String(entry?.provider || '');
        if (!RELAY_HOST.test(host)) return host;
        return entry?.feature === 'jev' ? 'api.typesafe.ai' : 'BYND 转发';
    }
    function withPublicProvider(entry) {
        return entry && RELAY_HOST.test(String(entry.provider || '')) ? { ...entry, provider: publicProvider(entry) } : entry;
    }

    function providerOf(value) {
        const raw = String(value || '').trim();
        if (!raw) return '';
        try { return new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`).hostname.toLowerCase(); }
        catch (_) { return raw.replace(/^[a-z]+:\/\//i, '').split(/[/?#:]/)[0].toLowerCase(); }
    }

    // `input` is the full prompt size (cache reads/writes included, OpenAI convention);
    // cacheRead/cacheWrite are the cached parts of it. total = input + output.
    function parseUsage(raw) {
        if (!raw || typeof raw !== 'object') return null;
        const prompt = num(raw.prompt_tokens);
        const inputTokens = num(raw.input_tokens);
        const output = num(raw.completion_tokens ?? raw.output_tokens);
        const rawTotal = num(raw.total_tokens);
        if (prompt == null && inputTokens == null && output == null && rawTotal == null) return null;
        const detailsCached = num(raw.prompt_tokens_details?.cached_tokens ?? raw.input_tokens_details?.cached_tokens);
        const anthropicRead = num(raw.cache_read_input_tokens);
        const cacheRead = count(detailsCached ?? anthropicRead);
        const cacheWrite = count(raw.cache_creation_input_tokens ?? raw.prompt_tokens_details?.cache_creation_tokens);
        let input = null;
        // Some relays report prompt_tokens without the cache part; never let the cached share exceed the input.
        if (prompt != null) input = prompt >= cacheRead + cacheWrite ? prompt : prompt + cacheRead + cacheWrite;
        else if (inputTokens != null) {
            // OpenAI Responses counts cached tokens inside input_tokens; Anthropic reports them separately.
            input = raw.input_tokens_details?.cached_tokens != null ? inputTokens : inputTokens + cacheRead + cacheWrite;
        }
        return {
            input,
            output,
            cacheRead,
            cacheWrite,
            total: rawTotal != null ? rawTotal : (input != null && output != null ? input + output : null)
        };
    }

    function trimTicket(ticket) {
        if (!ticket || typeof ticket !== 'object') return null;
        let copy;
        try { copy = JSON.parse(scrub(JSON.stringify(ticket))); } catch (_) { return null; }
        if (!copy || typeof copy !== 'object') return null;
        delete copy.char;
        const rows = Array.isArray(copy.rows) ? copy.rows : [];
        const book = Array.isArray(copy.worldbook) ? copy.worldbook.slice(0, 40) : [];
        copy.worldbook = book;
        const levels = [[1200, 240, 80], [700, 120, 60], [400, 60, 0], [240, 0, 0], [0, 0, 0]];
        const size = () => JSON.stringify(copy).length;
        for (const [head, body, bookPreview] of levels) {
            let keptRows = rows;
            if (head <= 400 && rows.length > 62) {
                keptRows = rows.slice(0, 2).concat(rows.slice(-60));
                copy.rowsOmitted = rows.length - keptRows.length;
            }
            copy.rows = keptRows.map((row, index) => ({ ...row, preview: text(row?.preview, index < 2 ? head : body) }));
            copy.worldbook = book.map(item => ({ ...item, preview: text(item?.preview, bookPreview) }));
            if (size() <= TICKET_BUDGET) break;
        }
        if (size() > TICKET_BUDGET) {
            copy.rowsOmitted = (copy.rowsOmitted || 0) + Math.max(0, copy.rows.length - 20);
            copy.rows = copy.rows.slice(0, 2).concat(copy.rows.slice(-18));
            copy.worldbook = copy.worldbook.slice(0, 10);
        }
        return copy;
    }

    function normalize(entry = {}) {
        const parsed = parseUsage(entry.usage);
        let input = count(entry.input);
        let output = count(entry.output);
        let cacheRead = count(entry.cacheRead);
        let cacheWrite = count(entry.cacheWrite);
        let estimated = entry.estimated != null ? !!entry.estimated : entry.usage !== undefined;
        let total = num(entry.total);
        if (parsed) {
            estimated = parsed.input == null || parsed.output == null;
            input = parsed.input ?? input;
            output = parsed.output ?? output;
            cacheRead = parsed.cacheRead;
            cacheWrite = parsed.cacheWrite;
            total = parsed.input != null && parsed.output != null ? parsed.total : null;
        }
        if (total == null) total = input + output;
        const source = entry.source && entry.source.charId != null
            ? { charId: String(entry.source.charId), msgIndex: Number(entry.source.msgIndex) }
            : null;
        const result = {
            id: text(entry.id, 80) || `u_${Date.now().toString(36)}_${(++seq).toString(36)}${Math.random().toString(36).slice(2, 6)}`,
            at: num(entry.at) || Date.now(),
            feature: FEATURE_KEYS.has(entry.feature) ? entry.feature : 'other',
            provider: providerOf(entry.provider),
            apiName: text(entry.apiName, 80),
            model: text(entry.model, 120),
            charId: entry.charId == null || entry.charId === '' ? '' : text(entry.charId, 120),
            charName: text(entry.charName, 80),
            input, output, cacheRead, cacheWrite,
            total: count(total),
            estimated,
            ok: entry.ok !== false,
            error: scrub(text(entry.error, 300)),
            durationMs: num(entry.durationMs) == null ? null : Math.max(0, Math.round(num(entry.durationMs))),
            source
        };
        if (entry.backfilled) result.backfilled = true;
        return { entry: result, ticket: trimTicket(entry.ticket) };
    }

    // ---- storage ----------------------------------------------------------

    function memoryStore() {
        if (!memory) memory = { requests: new Map(), tickets: new Map() };
        const sorted = () => Array.from(memory.requests.values()).sort((a, b) => a.at - b.at || (a.id < b.id ? -1 : 1));
        return {
            async put(entry, ticket) {
                memory.requests.set(entry.id, entry);
                if (ticket !== undefined) memory.tickets.set(entry.id, ticket);
            },
            async getEntry(id) { return memory.requests.get(id) || null; },
            async getTicket(id) { return memory.tickets.get(id) || null; },
            async range(from, to) { return sorted().filter(item => (from == null || item.at >= from) && (to == null || item.at < to)); },
            async count() { return memory.requests.size; },
            async oldest(limit) { return sorted().slice(0, limit); },
            async remove(ids) { ids.forEach(id => { memory.requests.delete(id); memory.tickets.delete(id); }); }
        };
    }

    const done = request => new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
    const finished = tx => new Promise((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
    });

    function openDb() {
        if (dbPromise) return dbPromise;
        dbPromise = new Promise(resolve => {
            if (typeof indexedDB === 'undefined' || !indexedDB?.open) { resolve(null); return; }
            let request;
            try { request = indexedDB.open(DB_NAME, 1); } catch (_) { resolve(null); return; }
            request.onupgradeneeded = () => {
                const db = request.result;
                if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' }).createIndex('at', 'at');
                if (!db.objectStoreNames.contains(TICKET_STORE)) db.createObjectStore(TICKET_STORE);
            };
            request.onsuccess = () => {
                const db = request.result;
                db.onversionchange = () => { try { db.close(); } catch (_) {} dbPromise = null; };
                resolve(db);
            };
            request.onerror = () => resolve(null);
            request.onblocked = () => resolve(null);
        });
        return dbPromise;
    }

    function idbStore(db) {
        const range = (from, to) => {
            if (from != null && to != null) return IDBKeyRange.bound(from, to, false, true);
            if (from != null) return IDBKeyRange.lowerBound(from);
            if (to != null) return IDBKeyRange.upperBound(to, true);
            return undefined;
        };
        return {
            async put(entry, ticket) {
                const tx = db.transaction([STORE, TICKET_STORE], 'readwrite');
                tx.objectStore(STORE).put(entry);
                if (ticket !== undefined) tx.objectStore(TICKET_STORE).put(ticket, entry.id);
                await finished(tx);
            },
            async getEntry(id) { return (await done(db.transaction(STORE).objectStore(STORE).get(id))) || null; },
            async getTicket(id) { return (await done(db.transaction(TICKET_STORE).objectStore(TICKET_STORE).get(id))) || null; },
            async range(from, to) { return (await done(db.transaction(STORE).objectStore(STORE).index('at').getAll(range(from, to)))) || []; },
            async count() { return done(db.transaction(STORE).objectStore(STORE).count()); },
            async oldest(limit) { return (await done(db.transaction(STORE).objectStore(STORE).index('at').getAll(undefined, limit))) || []; },
            async remove(ids) {
                if (!ids.length) return;
                const tx = db.transaction([STORE, TICKET_STORE], 'readwrite');
                ids.forEach(id => { tx.objectStore(STORE).delete(id); tx.objectStore(TICKET_STORE).delete(id); });
                await finished(tx);
            }
        };
    }

    async function store() {
        const db = await openDb();
        if (!db) return memoryStore();
        try { return idbStore(db); } catch (_) { return memoryStore(); }
    }

    function queue(task) {
        const run = writeChain.then(task);
        writeChain = run.catch(() => {});
        return run;
    }

    function notify(event) {
        listeners.forEach(fn => { try { fn(event); } catch (error) { console.warn('账单订阅回调出错', error); } });
    }

    function addFacet(entry) {
        if (!facetCache || !entry) return;
        if (entry.provider) facetCache.providers.add(publicProvider(entry));
        if (entry.model) facetCache.models.add(entry.model);
        if (entry.feature) facetCache.features.add(entry.feature);
        if (entry.charId) facetCache.chars.set(entry.charId, entry.charName || facetCache.chars.get(entry.charId) || entry.charId);
    }

    async function prune() {
        const target = await store();
        const cutoff = Date.now() - RETENTION_MS;
        const expired = await target.range(null, cutoff);
        await target.remove(expired.map(item => item.id));
        const extra = (await target.count()) - MAX_ENTRIES;
        if (extra > 0) await target.remove((await target.oldest(extra)).map(item => item.id));
        if (expired.length || extra > 0) facetCache = null;
    }

    function maybePrune() {
        writesSincePrune += 1;
        if (writesSincePrune < PRUNE_EVERY) return;
        writesSincePrune = 0;
        queue(prune).catch(error => console.warn('账单清理失败', error));
    }

    // ---- public API -------------------------------------------------------

    function record(raw) {
        let normalized;
        try { normalized = normalize(raw || {}); } catch (error) { console.warn('账单记录无效', error); return Promise.resolve(null); }
        const { entry, ticket } = normalized;
        return queue(async () => {
            const target = await store();
            await target.put(entry, ticket);
        }).then(() => {
            addFacet(entry);
            maybePrune();
            notify({ type: 'record', id: entry.id, entry });
            return entry.id;
        }, error => {
            console.warn('账单写入失败', error);
            return entry.id;
        });
    }

    function update(id, patch = {}) {
        const key = String(id || '');
        if (!key || !patch || typeof patch !== 'object') return Promise.resolve(null);
        return queue(async () => {
            const target = await store();
            const current = await target.getEntry(key);
            if (!current) return null;
            const { entry, ticket } = normalize({ ...current, ...patch, id: key, usage: patch.usage, ticket: patch.ticket });
            if (!('estimated' in patch) && patch.usage === undefined) entry.estimated = current.estimated;
            if (current.backfilled) entry.backfilled = true;
            await target.put(entry, patch.ticket !== undefined ? ticket : undefined);
            return entry;
        }).then(entry => {
            if (entry) {
                addFacet(entry);
                notify({ type: 'update', id: key, entry });
            }
            return entry;
        }, error => {
            console.warn('账单更新失败', error);
            return null;
        });
    }

    async function get(id) {
        try {
            await writeChain;
            const target = await store();
            const entry = await target.getEntry(String(id || ''));
            if (!entry) return null;
            return { ...withPublicProvider(entry), ticket: await target.getTicket(entry.id) };
        } catch (error) {
            console.warn('账单读取失败', error);
            return null;
        }
    }

    // Returns entries without receipt details (ticket: null); use get(id) for one receipt.
    // With `limit`, the most recent matching entries are kept, still sorted by `at` ascending.
    async function list(filters = {}) {
        try {
            await writeChain;
            const target = await store();
            const from = num(filters.from);
            const to = num(filters.to);
            let items = await target.range(from, to);
            const match = (key, value) => value == null || value === '' || String(value) === '*' ? () => true : item => String(item[key] ?? '') === String(value);
            const tests = [match('provider', filters.provider), match('model', filters.model), match('feature', filters.feature), match('charId', filters.charId)];
            items = items.map(withPublicProvider).filter(item => tests.every(fn => fn(item)))
                .sort((a, b) => a.at - b.at || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
                .map(item => ({ ...item, ticket: null }));
            const limit = Math.floor(num(filters.limit) || 0);
            return limit > 0 && items.length > limit ? items.slice(-limit) : items;
        } catch (error) {
            console.warn('账单列表读取失败', error);
            return [];
        }
    }

    async function facets() {
        if (!facetCache) {
            facetCache = { providers: new Set(), models: new Set(), features: new Set(), chars: new Map() };
            const all = await list();
            all.forEach(addFacet);
        }
        const order = FEATURES.map(item => item.key);
        return {
            providers: Array.from(facetCache.providers).sort(),
            models: Array.from(facetCache.models).sort(),
            features: Array.from(facetCache.features).sort((a, b) => order.indexOf(a) - order.indexOf(b)),
            chars: Array.from(facetCache.chars, ([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'))
        };
    }

    function subscribe(fn) {
        if (typeof fn !== 'function') return () => {};
        listeners.add(fn);
        return () => listeners.delete(fn);
    }

    // costOf runs over whole ledgers, so prices are parsed once and cached until they change.
    let priceCache = null;
    function readPrices() {
        if (priceCache) return priceCache;
        let saved = {};
        try { saved = JSON.parse((typeof localStorage !== 'undefined' && localStorage.getItem(PRICE_KEY)) || '{}'); } catch (_) {}
        const prices = saved && typeof saved === 'object' && !Array.isArray(saved) ? saved : {};
        const lower = new Map(Object.entries(prices).map(([model, price]) => [model.toLowerCase(), price]));
        priceCache = { prices, lower };
        return priceCache;
    }
    if (typeof window.addEventListener === 'function') {
        window.addEventListener('storage', event => {
            if (!event || event.key === PRICE_KEY || event.key === null) priceCache = null;
            if (!event || event.key === AUTO_PRICE_KEY || event.key === null) autoPriceCache = null;
            resolvedPrices.clear();
        });
    }

    function getPrices() {
        return JSON.parse(JSON.stringify(readPrices().prices));
    }

    // Automatic prices: OpenRouter's public model list (no key, CORS open), refreshed at most once a day.
    // Manual prices still win, so a relay that charges differently can be corrected per model.
    const AUTO_PRICE_KEY = 'bynd_usage_auto_prices_v1';
    const AUTO_PRICE_URL = 'https://openrouter.ai/api/v1/models';
    const AUTO_PRICE_MAX_AGE_MS = 24 * 60 * 60 * 1000;
    const BUILTIN_PRICES = { 'jev-latest': { input: 0.042, output: 0, id: 'TypeSafe Jev' } };
    let autoPriceCache = null;
    let autoPriceRefresh = null;
    const resolvedPrices = new Map();

    function normalizeModelName(name) {
        return String(name || '').toLowerCase().trim()
            .replace(/^\[[^\]]*\]\s*/, '')
            .split('/').pop()
            .replace(/:.*$/, '')
            .replace(/[._\s]+/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '');
    }

    function modelNameCandidates(name) {
        const base = normalizeModelName(name);
        const withoutDate = base.replace(/-(?:\d{8}|\d{4}-\d{2}-\d{2}|\d{4})$/, '');
        const withoutLatest = withoutDate.replace(/-latest$/, '');
        return Array.from(new Set([base, withoutDate, withoutLatest].filter(Boolean)));
    }

    function readAutoPrices() {
        if (autoPriceCache) return autoPriceCache;
        let saved = null;
        try { saved = JSON.parse((typeof localStorage !== 'undefined' && localStorage.getItem(AUTO_PRICE_KEY)) || 'null'); } catch (_) {}
        autoPriceCache = saved && typeof saved === 'object' && saved.map && typeof saved.map === 'object' ? saved : { fetchedAt: 0, map: {} };
        return autoPriceCache;
    }

    function parseOpenRouterPrices(models) {
        const map = {};
        const perMillion = value => {
            const number = Number(value);
            return Number.isFinite(number) && number >= 0 ? Math.round(number * 1e6 * 1e6) / 1e6 : null;
        };
        // Base ids first, so ":batch" / ":free" variants never replace the regular price.
        const sorted = (Array.isArray(models) ? models : []).filter(model => model?.id && model.pricing)
            .sort((a, b) => Number(String(a.id).includes(':')) - Number(String(b.id).includes(':')));
        for (const model of sorted) {
            const key = normalizeModelName(model.id);
            if (!key || map[key]) continue;
            const price = {
                input: perMillion(model.pricing.prompt),
                output: perMillion(model.pricing.completion),
                cacheRead: perMillion(model.pricing.input_cache_read),
                cacheWrite: perMillion(model.pricing.input_cache_write),
                id: String(model.id)
            };
            if (price.input == null && price.output == null) continue;
            Object.keys(price).forEach(field => { if (price[field] == null) delete price[field]; });
            map[key] = price;
        }
        return map;
    }

    async function refreshAutoPrices(options = {}) {
        const current = readAutoPrices();
        if (!options.force && Date.now() - Number(current.fetchedAt || 0) < AUTO_PRICE_MAX_AGE_MS && Object.keys(current.map).length) return current;
        if (autoPriceRefresh) return autoPriceRefresh;
        if (typeof fetch !== 'function') return current;
        autoPriceRefresh = (async () => {
            try {
                const response = await fetch(AUTO_PRICE_URL, { credentials: 'omit' });
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                const map = parseOpenRouterPrices((await response.json())?.data);
                if (!Object.keys(map).length) throw new Error('价目表为空');
                const next = { fetchedAt: Date.now(), source: 'openrouter', map };
                try { if (typeof localStorage !== 'undefined') localStorage.setItem(AUTO_PRICE_KEY, JSON.stringify(next)); } catch (error) { console.warn('自动价格未保存', error); }
                autoPriceCache = next;
                resolvedPrices.clear();
                notify({ type: 'prices' });
                return next;
            } catch (error) {
                console.warn('自动价格获取失败，沿用上次的价格：', error?.message || error);
                return current;
            } finally {
                autoPriceRefresh = null;
            }
        })();
        return autoPriceRefresh;
    }

    // { price, source: 'manual' | 'openrouter' | 'builtin', matchedId } or null when no price is known.
    function resolvePrice(model) {
        const name = String(model || '').trim();
        if (!name) return null;
        if (resolvedPrices.has(name)) return resolvedPrices.get(name);
        const { prices, lower } = readPrices();
        let resolved = null;
        const manual = prices[name] || lower.get(name.toLowerCase());
        if (manual && (num(manual.input) != null || num(manual.output) != null)) {
            resolved = { price: manual, source: 'manual', matchedId: name };
        } else {
            const auto = readAutoPrices().map;
            for (const candidate of modelNameCandidates(name)) {
                if (BUILTIN_PRICES[candidate]) { resolved = { price: BUILTIN_PRICES[candidate], source: 'builtin', matchedId: BUILTIN_PRICES[candidate].id }; break; }
                if (auto[candidate]) { resolved = { price: auto[candidate], source: 'openrouter', matchedId: auto[candidate].id }; break; }
            }
        }
        resolvedPrices.set(name, resolved);
        return resolved;
    }

    function autoPriceInfo() {
        const current = readAutoPrices();
        return { fetchedAt: Number(current.fetchedAt) || 0, count: Object.keys(current.map).length, source: 'OpenRouter' };
    }

    function setPrice(model, price) {
        const key = String(model || '').trim();
        if (!key) return getPrices();
        const prices = getPrices();
        const clean = {};
        ['input', 'output', 'cacheRead', 'cacheWrite'].forEach(field => {
            const value = num(price?.[field]);
            if (value != null && value >= 0) clean[field] = value;
        });
        if (Object.keys(clean).length) prices[key] = clean;
        else delete prices[key];
        try { if (typeof localStorage !== 'undefined') localStorage.setItem(PRICE_KEY, JSON.stringify(prices)); } catch (error) { console.warn('价格保存失败', error); }
        priceCache = null;
        resolvedPrices.clear();
        return getPrices();
    }

    function costOf(entry) {
        if (!entry?.model) return null;
        const price = resolvePrice(entry.model)?.price;
        if (!price) return null;
        const inputPrice = num(price.input);
        const outputPrice = num(price.output);
        if (inputPrice == null && outputPrice == null) return null;
        const pi = inputPrice || 0;
        const readPrice = num(price.cacheRead) ?? pi;
        const writePrice = num(price.cacheWrite) ?? pi;
        const cacheRead = count(entry.cacheRead);
        const cacheWrite = count(entry.cacheWrite);
        const uncached = Math.max(0, count(entry.input) - cacheRead - cacheWrite);
        return (uncached * pi + count(entry.output) * (outputPrice || 0) + cacheRead * readPrice + cacheWrite * writePrice) / 1e6;
    }

    // ---- backfill of per-message API tickets --------------------------------

    function readFlag() {
        try { return typeof localStorage !== 'undefined' && !!localStorage.getItem(BACKFILL_KEY); } catch (_) { return false; }
    }

    async function backfill(characters = window.myCharacters) {
        if (readFlag()) return 0;
        let added = 0;
        const chars = Array.isArray(characters) ? characters : [];
        for (const char of chars) {
            const history = Array.isArray(char?.history) ? char.history : [];
            for (let msgIndex = 0; msgIndex < history.length; msgIndex++) {
                const records = history[msgIndex]?.apiUsageRecords;
                if (!Array.isArray(records)) continue;
                for (let i = 0; i < records.length; i++) {
                    const ticket = records[i];
                    if (!ticket || typeof ticket !== 'object') continue;
                    const usage = ticket.usage;
                    const cached = count(usage?.cached);
                    const hasUsage = usage && usage.input != null && usage.output != null;
                    await record({
                        id: `bf_${char.id}_${msgIndex}_${i}`,
                        at: num(ticket.at) || num(history[msgIndex]?.timestamp) || Date.now(),
                        feature: 'chat',
                        model: ticket.model,
                        charId: char.id,
                        charName: char.chatConfig?.nickname || char.name || '',
                        input: hasUsage ? count(usage.input) : count(ticket.inputEstimate),
                        output: hasUsage ? count(usage.output) : count(ticket.outputEstimate),
                        cacheRead: hasUsage ? cached : 0,
                        total: hasUsage && usage.total != null ? usage.total : undefined,
                        estimated: !hasUsage,
                        ok: ticket.status !== '失败',
                        error: ticket.error || '',
                        ticket,
                        source: { charId: char.id, msgIndex },
                        backfilled: true
                    });
                    added += 1;
                }
            }
        }
        try { if (typeof localStorage !== 'undefined') localStorage.setItem(BACKFILL_KEY, String(Date.now())); } catch (_) {}
        return added;
    }

    function scheduleBackfill() {
        if (readFlag() || typeof setTimeout !== 'function') return;
        // Background polling must not keep a non-browser runtime (node tests) alive.
        const later = (fn, ms) => { const timer = setTimeout(fn, ms); timer?.unref?.(); };
        let attempts = 0;
        const tick = () => {
            attempts += 1;
            const state = window._wechatCharactersStorageState?.status;
            if (state === 'error' || attempts > 60) return;
            if (state !== 'ready' || !window._wechatCharactersLoadPromise) { later(tick, 2000); return; }
            Promise.resolve(window._wechatCharactersLoadPromise)
                .then(() => new Promise(resolve => later(resolve, 3000)))
                .then(() => backfill())
                .catch(error => console.warn('账单历史导入失败', error));
        };
        later(tick, 2000);
    }

    // ---- backup helpers (receipt details are not included) ----------------

    async function exportForBackup() {
        return (await list()).map(({ ticket, ...entry }) => entry);
    }

    async function importFromBackup(entries) {
        if (!Array.isArray(entries)) return 0;
        let added = 0;
        const known = new Set((await list()).map(item => item.id));
        for (const item of entries) {
            if (!item || typeof item !== 'object' || !item.id || known.has(String(item.id))) continue;
            known.add(String(item.id));
            await record({ ...item, ticket: null });
            added += 1;
        }
        return added;
    }

    window.ByndUsageLedger = {
        FEATURES, record, update, get, list, facets, subscribe, getPrices, setPrice, costOf,
        resolvePrice, refreshAutoPrices, autoPriceInfo, normalizeModelName, parseOpenRouterPrices,
        parseUsage, providerOf, backfill, exportForBackup, importFromBackup
    };
    scheduleBackfill();
    // Fetch the price list shortly after startup (at most daily) so costs are ready before the bill is opened.
    if (typeof window.addEventListener === 'function' && typeof setTimeout === 'function') {
        const timer = setTimeout(() => { void refreshAutoPrices(); }, 8000);
        if (timer && typeof timer.unref === 'function') timer.unref();
    }
})();
