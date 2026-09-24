/* Character toolbox: real-world tools a character may use in chat without breaking character.
 * Every call passes: per-character permission -> ByndDecider.gate (Jev when configured, else the
 * chat model already chose it in character) -> execution -> a saved rich card -> one background follow-up. */
(() => {
    'use strict';

    const SECRET_KEY = 'bynd_tool_keys_v1';
    const CONFIG_KEY = 'bynd_tool_config_v1';
    const WEATHER_CACHE_KEY = 'bynd_tool_weather_cache_v1';
    const MCP_CATALOG_KEY = 'bynd_tool_mcp_catalog_v1';
    const WEATHER_REFRESH_MS = 3 * 60 * 60 * 1000;
    const WEATHER_STALE_MS = 18 * 60 * 60 * 1000;
    const WEATHER_RETRY_MS = 10 * 60 * 1000;
    const TAOBAO_ENDPOINT = 'http://127.0.0.1:3654/mcp';
    // The only Taobao desktop tools a character may ever reach: no cart, orders, addresses, chats or history.
    const TAOBAO_CHARACTER_TOOLS = ['search_products', 'get_product_skus'];
    const PREF_BY_KIND = { weather: 'toolWeather', places: 'toolPlaces', movies: 'toolMovies', shop: 'toolShop', mcp: 'toolMcp' };
    const KIND_BY_NAME = { 'weather.get': 'weather', 'places.search': 'places', 'movies.nowPlaying': 'movies', 'movies.search': 'movies', 'shop.search': 'shop', 'shop.skus': 'shop', 'mcp.call': 'mcp' };
    const KIND_LABELS = { weather: '查天气', places: '找店和地点', movies: '查电影', shop: '淘宝搜索', mcp: 'MCP 工具' };
    const WEATHER_TEXT = { 0: '晴', 1: '晴间多云', 2: '多云', 3: '阴', 45: '雾', 48: '雾凇', 51: '小毛毛雨', 53: '毛毛雨', 55: '大毛毛雨', 56: '冻毛毛雨', 57: '冻毛毛雨', 61: '小雨', 63: '中雨', 65: '大雨', 66: '冻雨', 67: '冻雨', 71: '小雪', 73: '中雪', 75: '大雪', 77: '米雪', 80: '阵雨', 81: '中阵雨', 82: '强阵雨', 85: '阵雪', 86: '强阵雪', 95: '雷阵雨', 96: '雷阵雨伴冰雹', 99: '强雷阵雨伴冰雹' };
    // Tool names whose words suggest writing, spending, messaging or navigating are never offered to characters.
    const BLOCKED_WORDS = new Set('create update delete remove write push merge send post put patch add set edit move rename close reopen fork publish deploy run exec execute trigger cancel approve dismiss assign unassign lock unlock upload install uninstall transfer pay order orders buy cart checkout purchase comment reply invite star unstar follow unfollow archive drop truncate insert kill stop start restart shutdown reboot revoke grant reset clear mark submit rerun enable disable dispatch resolve block unblock mute share save modify change apply commit tag release destroy erase wipe login logout click input navigate type open chat message messages address addresses history'.split(' '));

    const clip = (value, limit = 200) => String(value ?? '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim().slice(0, limit);
    const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
    const plain = value => Array.isArray(value) ? '' : String(value ?? '').trim();
    const numberOrNull = value => { const n = Number(value); return value === '' || value == null || !Number.isFinite(n) ? null : n; };
    const displayName = char => (typeof window.getWechatCharDisplayName === 'function' ? window.getWechatCharDisplayName(char) : '') || char?.name || '角色';
    const readJson = (key, fallback) => { try { const value = JSON.parse(localStorage.getItem(key) || 'null'); return value && typeof value === 'object' ? value : fallback; } catch (_) { return fallback; } };
    const httpsUrl = value => {
        try {
            const url = new URL(String(value || '').trim().replace(/^\/\//, 'https://'));
            return url.protocol === 'https:' ? url.toString() : '';
        } catch (_) { return ''; }
    };
    const pad = n => String(n).padStart(2, '0');
    const localDate = now => { const d = new Date(now); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
    const notify = text => typeof window.showWechatToast === 'function' && window.showWechatToast(text);

    // --- storage -------------------------------------------------------------------------
    function readKeys() {
        const saved = readJson(SECRET_KEY, {});
        return { amapKey: String(saved.amapKey || '').trim(), tmdbToken: String(saved.tmdbToken || '').trim() };
    }
    function writeKeys(keys) {
        const next = { amapKey: String(keys.amapKey || '').trim(), tmdbToken: String(keys.tmdbToken || '').trim() };
        if (!next.amapKey && !next.tmdbToken) localStorage.removeItem(SECRET_KEY);
        else localStorage.setItem(SECRET_KEY, JSON.stringify(next));
        return next;
    }
    function readConfig() {
        const saved = readJson(CONFIG_KEY, {});
        return {
            city: clip(saved.city, 30),
            weatherAnchor: saved.weatherAnchor !== false,
            shopMode: ['card', 'desktop', 'off'].includes(saved.shopMode) ? saved.shopMode : 'card',
            taobaoEndpoint: String(saved.taobaoEndpoint || TAOBAO_ENDPOINT),
            followUp: saved.followUp !== false
        };
    }
    function writeConfig(config) {
        const next = { ...readConfig(), ...config };
        localStorage.setItem(CONFIG_KEY, JSON.stringify(next));
        return readConfig();
    }

    // --- network -------------------------------------------------------------------------
    async function fetchWithTimeout(url, options = {}, timeoutMs = 12000) {
        const controller = typeof AbortController === 'function' ? new AbortController() : null;
        const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
        try { return await fetch(url, { ...options, signal: controller?.signal }); }
        finally { if (timer) clearTimeout(timer); }
    }
    async function fetchJson(url, options = {}, timeoutMs = 12000) {
        let response;
        try { response = await fetchWithTimeout(url, options, timeoutMs); }
        catch (error) {
            const wrapped = new Error(error?.name === 'AbortError' ? '请求超时' : '网络连接失败');
            wrapped.network = true;
            throw wrapped;
        }
        let data = null;
        try { data = await response.json(); } catch (_) {}
        if (!response.ok) {
            const error = new Error(data?.status_message || data?.info || `HTTP ${response.status}`);
            error.status = response.status;
            throw error;
        }
        return data;
    }

    // --- weather (Open-Meteo, no key) ---------------------------------------------------
    const cityKey = city => clip(city, 30).toLowerCase();
    const weatherText = code => WEATHER_TEXT[Number(code)] || '天气多变';
    function readWeatherCache() { return readJson(WEATHER_CACHE_KEY, {}); }
    function writeWeatherCache(key, entry) {
        const cache = readWeatherCache();
        cache[key] = entry;
        const keep = Object.entries(cache).sort((a, b) => (b[1]?.weather?.fetchedAt || 0) - (a[1]?.weather?.fetchedAt || 0)).slice(0, 4);
        try { localStorage.setItem(WEATHER_CACHE_KEY, JSON.stringify(Object.fromEntries(keep))); } catch (_) {}
    }

    function parseWeather(place, raw, now = Date.now()) {
        const daily = raw?.daily;
        if (!Array.isArray(daily?.time) || !daily.time.length) throw new Error('天气数据不完整');
        const at = (list, index) => numberOrNull(Array.isArray(list) ? list[index] : null);
        const days = daily.time.map((date, index) => ({
            date: String(date),
            code: at(daily.weather_code, index),
            text: weatherText(at(daily.weather_code, index)),
            max: at(daily.temperature_2m_max, index),
            min: at(daily.temperature_2m_min, index),
            pop: at(daily.precipitation_probability_max, index),
            uv: at(daily.uv_index_max, index),
            wind: at(daily.wind_speed_10m_max, index)
        }));
        const current = raw.current ? {
            temp: numberOrNull(raw.current.temperature_2m),
            feels: numberOrNull(raw.current.apparent_temperature),
            code: numberOrNull(raw.current.weather_code),
            text: weatherText(raw.current.weather_code),
            wind: numberOrNull(raw.current.wind_speed_10m)
        } : null;
        return { city: clip(place.name, 30), region: clip(place.admin, 30), current, days, fetchedAt: now };
    }

    function upcomingDays(weather, now = Date.now()) {
        const today = localDate(now);
        return (weather?.days || []).filter(day => day.date >= today).slice(0, 2).map((day, index) => ({ ...day, label: day.date === today && index === 0 ? '今天' : '明天' }));
    }

    const round = value => value == null ? '?' : Math.round(value);
    const dayLine = day => `${day.label}${day.text}，${round(day.min)}~${round(day.max)}℃${day.pop != null ? `，降水概率${round(day.pop)}%` : ''}${day.uv != null && day.uv >= 6 ? `，紫外线强（${Math.round(day.uv)}）` : ''}${day.wind != null && day.wind >= 38 ? '，风大' : ''}`;

    async function getWeather(city, options = {}) {
        const name = clip(city, 30);
        if (!name) throw new Error('没有说是哪个城市');
        const key = cityKey(name);
        const cached = readWeatherCache()[key];
        const now = Date.now();
        if (!options.force && cached?.weather && now - cached.weather.fetchedAt < WEATHER_REFRESH_MS) return cached.weather;
        let place = cached?.place;
        if (!place) {
            const geo = await fetchJson(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=1&language=zh&format=json`);
            const hit = geo?.results?.[0];
            if (!hit || !Number.isFinite(Number(hit.latitude))) throw new Error(`没找到「${name}」这个城市`);
            place = { name: hit.name || name, admin: hit.admin1 || '', lat: Number(hit.latitude), lon: Number(hit.longitude) };
        }
        const params = new URLSearchParams({
            latitude: place.lat.toFixed(4), longitude: place.lon.toFixed(4),
            current: 'temperature_2m,apparent_temperature,weather_code,wind_speed_10m',
            daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,uv_index_max,wind_speed_10m_max',
            timezone: 'auto', forecast_days: '3'
        });
        const weather = parseWeather(place, await fetchJson(`https://api.open-meteo.com/v1/forecast?${params}`), now);
        writeWeatherCache(key, { place, weather });
        return weather;
    }

    const weatherRefresh = { city: '', running: false, failedAt: 0 };
    function scheduleWeatherRefresh(city) {
        if (typeof fetch !== 'function' || weatherRefresh.running || (weatherRefresh.city === city && Date.now() - weatherRefresh.failedAt < WEATHER_RETRY_MS)) return;
        weatherRefresh.running = true;
        weatherRefresh.city = city;
        getWeather(city, { force: true })
            .then(() => { weatherRefresh.failedAt = 0; })
            .catch(() => { weatherRefresh.failedAt = Date.now(); })
            .finally(() => { weatherRefresh.running = false; });
    }

    // Sync by design: the prompt only reads the cache; a stale cache schedules a refresh for a later turn.
    function weatherAnchor(char, now = Date.now()) {
        const config = readConfig();
        if (!config.city || !config.weatherAnchor || !char || char.isGroupChat) return '';
        if (window.getWechatAgentPreferences?.(char)?.toolWeather === false) return '';
        const cached = readWeatherCache()[cityKey(config.city)];
        const age = cached?.weather ? now - cached.weather.fetchedAt : Infinity;
        if (age > WEATHER_REFRESH_MS) scheduleWeatherRefresh(config.city);
        if (age > WEATHER_STALE_MS) return '';
        const days = upcomingDays(cached.weather, now);
        if (!days.length) return '';
        return `【现实天气参考】用户所在的${cached.weather.city}：${days.map(dayLine).join('；')}。只有当「${displayName(char)}」的人设和世界观里自然能知道这些（现代生活、同城、或聊到出门）时，才像平常关心人那样顺口提一句（带伞、防晒、加衣），不要播报天气，也不要每轮都提；古代、仙侠、异世界等没有天气预报的设定里不要提。`;
    }

    // --- places (AMap Web Service, user key) ---------------------------------------------
    const AMAP_ERRORS = {
        INVALID_USER_KEY: '高德 Key 无效，请确认复制完整、服务平台选的是「Web服务」',
        USERKEY_PLAT_NOMATCH: '这个高德 Key 的服务平台不是「Web服务」，请重新添加 Key',
        DAILY_QUERY_OVER_LIMIT: '高德今天的免费调用次数用完了',
        ACCESS_TOO_FREQUENT: '高德请求太频繁，请稍后再试',
        INVALID_USER_IP: '高德 Key 设置了 IP 白名单，请在控制台去掉白名单',
        INVALID_USER_SIGNATURE: '高德 Key 开启了数字签名，请在控制台关闭'
    };
    async function amap(path, params) {
        const key = readKeys().amapKey;
        if (!key) throw new Error('还没有填写高德 Key');
        const data = await fetchJson(`https://restapi.amap.com${path}?${new URLSearchParams({ ...params, key })}`);
        if (String(data?.status) !== '1') throw new Error(AMAP_ERRORS[data?.info] || `高德返回：${clip(data?.info, 60) || '未知错误'}`);
        return data;
    }
    function mapPoi(poi) {
        const [lng, lat] = plain(poi.location).split(',').map(Number);
        const business = poi.business && typeof poi.business === 'object' ? poi.business : {};
        const name = clip(poi.name, 60);
        return {
            name,
            address: clip([plain(poi.adname), plain(poi.address)].filter(Boolean).join(' '), 80),
            type: clip(plain(poi.type).split(';').pop(), 20),
            rating: numberOrNull(plain(business.rating)),
            cost: numberOrNull(plain(business.cost)),
            distance: numberOrNull(plain(poi.distance)),
            tel: clip(plain(business.tel), 40),
            url: Number.isFinite(lng) && Number.isFinite(lat) ? `https://uri.amap.com/marker?position=${lng},${lat}&name=${encodeURIComponent(name)}&src=bynd&coordinate=gaode&callnative=1` : ''
        };
    }
    async function searchPlaces(args = {}) {
        const keyword = clip(args.keyword || args.query, 40);
        if (!keyword) throw new Error('没有说要找什么');
        const city = clip(args.city, 20) || readConfig().city;
        const near = clip(args.near, 40);
        const common = { keywords: keyword, show_fields: 'business', page_size: '5', page_num: '1' };
        let data;
        if (near) {
            const geo = await amap('/v3/geocode/geo', { address: near, ...(city ? { city } : {}) });
            const location = plain(geo.geocodes?.[0]?.location);
            if (!location) throw new Error(`高德没找到「${near}」`);
            data = await amap('/v5/place/around', { ...common, location, radius: '3000', sortrule: 'distance' });
        } else {
            data = await amap('/v5/place/text', { ...common, ...(city ? { region: city, city_limit: 'true' } : {}) });
        }
        return { keyword, city, near, pois: (Array.isArray(data.pois) ? data.pois : []).slice(0, 5).map(mapPoi).filter(poi => poi.name) };
    }
    const distanceText = meters => meters == null ? '' : meters >= 1000 ? `${(meters / 1000).toFixed(1)}km` : `${Math.round(meters)}m`;
    const poiMeta = poi => [poi.rating != null ? `${poi.rating}分` : '', poi.cost != null ? `人均¥${Math.round(poi.cost)}` : '', distanceText(poi.distance)].filter(Boolean).join('·');

    // --- movies (TMDB, user token) -------------------------------------------------------
    async function tmdb(path, params = {}) {
        const token = readKeys().tmdbToken;
        if (!token) throw new Error('还没有填写 TMDB 令牌');
        const query = new URLSearchParams({ language: 'zh-CN', ...params });
        const headers = { Accept: 'application/json' };
        if (/^[a-f0-9]{32}$/i.test(token)) query.set('api_key', token);
        else headers.Authorization = `Bearer ${token}`;
        try { return await fetchJson(`https://api.themoviedb.org/3${path}?${query}`, { headers }); }
        catch (error) {
            if (error.status === 401) throw new Error('TMDB 令牌无效，请复制「API 读访问令牌」');
            if (error.network) throw new Error('连不上 TMDB（部分网络需要代理）');
            throw error;
        }
    }
    function mapMovie(movie) {
        return {
            id: movie.id,
            title: clip(movie.title || movie.original_title, 60),
            year: String(movie.release_date || '').slice(0, 4),
            rating: Number(movie.vote_count) > 0 && Number.isFinite(Number(movie.vote_average)) ? Math.round(Number(movie.vote_average) * 10) / 10 : null,
            overview: clip(movie.overview, 140),
            poster: movie.poster_path ? `https://image.tmdb.org/t/p/w342${movie.poster_path}` : '',
            url: movie.id ? `https://www.themoviedb.org/movie/${encodeURIComponent(movie.id)}?language=zh-CN` : ''
        };
    }
    async function movies(mode, args = {}) {
        if (mode === 'search') {
            const query = clip(args.query || args.title, 60);
            if (!query) throw new Error('没有说要查哪部电影');
            const data = await tmdb('/search/movie', { query, include_adult: 'false', page: '1' });
            return { mode, query, movies: (data?.results || []).slice(0, 5).map(mapMovie).filter(movie => movie.title) };
        }
        const region = /^[A-Z]{2}$/.test(String(args.region || '')) ? args.region : 'CN';
        let data = await tmdb('/movie/now_playing', { region, page: '1' });
        if (!data?.results?.length) data = await tmdb('/movie/now_playing', { page: '1' });
        return { mode: 'nowPlaying', query: '', movies: (data?.results || []).slice(0, 5).map(mapMovie).filter(movie => movie.title) };
    }

    // --- shopping ------------------------------------------------------------------------
    function shopSearchCard(query, reason) {
        const q = clip(query, 40);
        if (!q) throw new Error('没有说要搜什么商品');
        return { query: q, reason: clip(reason, 60), url: `https://s.taobao.com/search?q=${encodeURIComponent(q)}`, appUrl: `taobao://s.taobao.com/search?q=${encodeURIComponent(q)}` };
    }

    const taobaoSession = { endpoint: '', sessionId: '', nextId: 1, ready: '' };
    function taobaoEndpoint(value = readConfig().taobaoEndpoint) {
        let url;
        try { url = new URL(String(value || TAOBAO_ENDPOINT).trim()); } catch (_) { throw new Error('淘宝桌面版 MCP 地址格式不对'); }
        if (!/^https?:$/.test(url.protocol) || !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)) throw new Error('淘宝桌面版 MCP 地址只能是本机 127.0.0.1 或 localhost');
        return url.toString();
    }
    function taobaoNetworkHint() {
        const hosted = typeof location !== 'undefined' && location.protocol === 'https:';
        return hosted
            ? '连不上本机淘宝桌面版：请确认桌面版已打开并开启 MCP 服务；网页版还要浏览器允许访问本地网络、且淘宝桌面版允许跨域访问，连不上请改用「淘宝搜索卡片」'
            : '连不上本机淘宝桌面版：请确认桌面版 2.5 以上已打开并在设置里开启 MCP 服务、端口正确';
    }
    async function readRpcMessage(response, id) {
        const type = String(response.headers?.get?.('content-type') || '').toLowerCase();
        const text = await response.text();
        if (!text.trim()) return null;
        if (type.includes('text/event-stream')) {
            for (const block of text.split(/\r?\n\r?\n/)) {
                const data = block.split(/\r?\n/).filter(line => line.startsWith('data:')).map(line => line.slice(5).trim()).join('\n');
                if (!data) continue;
                try { const message = JSON.parse(data); if (message.id === id || message.error) return message; } catch (_) {}
            }
            return null;
        }
        try { return JSON.parse(text); } catch (_) { throw new Error('淘宝桌面版返回了无法识别的内容'); }
    }
    async function taobaoRpc(method, params = {}, notification = false) {
        const endpoint = taobaoEndpoint();
        const headers = { Accept: 'application/json, text/event-stream', 'Content-Type': 'application/json' };
        if (taobaoSession.sessionId && taobaoSession.endpoint === endpoint) headers['Mcp-Session-Id'] = taobaoSession.sessionId;
        const id = notification ? undefined : taobaoSession.nextId++;
        let response;
        try {
            response = await fetchWithTimeout(endpoint, { method: 'POST', headers, body: JSON.stringify(notification ? { jsonrpc: '2.0', method, params } : { jsonrpc: '2.0', id, method, params }) }, 30000);
        } catch (_) { throw new Error(taobaoNetworkHint()); }
        const session = response.headers?.get?.('Mcp-Session-Id');
        if (session) { taobaoSession.sessionId = session; taobaoSession.endpoint = endpoint; }
        if (response.status === 404 && taobaoSession.sessionId) { taobaoSession.sessionId = ''; taobaoSession.ready = ''; }
        if (!response.ok) throw new Error(`淘宝桌面版返回 HTTP ${response.status}`);
        if (notification) return null;
        const message = await readRpcMessage(response, id);
        if (message?.error) throw new Error(clip(message.error.message, 120) || '淘宝桌面版返回错误');
        return message?.result;
    }
    async function taobaoReady() {
        const endpoint = taobaoEndpoint();
        if (taobaoSession.ready === endpoint) return;
        if (taobaoSession.endpoint !== endpoint) taobaoSession.sessionId = '';
        await taobaoRpc('initialize', { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'BYND Character Tools', version: '1' } });
        await taobaoRpc('notifications/initialized', {}, true).catch(() => {});
        taobaoSession.ready = endpoint;
    }
    async function taobaoCall(tool, args) {
        if (!TAOBAO_CHARACTER_TOOLS.includes(tool)) throw new Error('这个淘宝工具不对角色开放');
        await taobaoReady();
        try { return await taobaoRpc('tools/call', { name: tool, arguments: args }); }
        catch (error) {
            if (taobaoSession.ready) throw error;
            await taobaoReady();
            return taobaoRpc('tools/call', { name: tool, arguments: args });
        }
    }
    function mcpResultText(result) {
        const parts = (Array.isArray(result?.content) ? result.content : []).map(item => item?.type === 'text' ? item.text : '').filter(Boolean);
        if (!parts.length && result?.structuredContent !== undefined) parts.push(JSON.stringify(result.structuredContent));
        return parts.join('\n');
    }
    function normalizeProduct(value) {
        const itemId = String(value.itemId || value.item_id || value.nid || value.id || '').replace(/\D/g, '');
        const price = value.price ?? value.priceText ?? value.salePrice ?? value.finalPrice ?? value.promotionPrice ?? value.reservePrice;
        return {
            title: clip(value.title || value.itemTitle || value.productName || value.name, 60),
            price: clip(price, 20),
            shop: clip(value.shopName || value.shop_name || value.shop || value.nick || value.sellerNick || '', 30),
            image: httpsUrl(value.pic || value.picUrl || value.pic_path || value.image || value.imageUrl || value.mainPic || ''),
            url: httpsUrl(value.url || value.itemUrl || value.link || value.detailUrl || value.auctionURL || '') || (itemId ? `https://item.taobao.com/item.htm?id=${itemId}` : ''),
            itemId
        };
    }
    function extractProducts(result) {
        const roots = [];
        if (result?.structuredContent) roots.push(result.structuredContent);
        for (const item of Array.isArray(result?.content) ? result.content : []) {
            if (item?.type === 'text') { try { roots.push(JSON.parse(item.text)); } catch (_) {} }
        }
        const found = [];
        const visit = (value, depth) => {
            if (!value || depth > 6 || found.length >= 5 || typeof value !== 'object') return;
            if (Array.isArray(value)) { value.forEach(item => visit(item, depth + 1)); return; }
            const title = value.title || value.itemTitle || value.productName || value.name;
            const price = value.price ?? value.priceText ?? value.salePrice ?? value.finalPrice ?? value.promotionPrice ?? value.reservePrice;
            if (typeof title === 'string' && title.trim() && price != null && typeof price !== 'object') { found.push(normalizeProduct(value)); return; }
            Object.values(value).forEach(item => visit(item, depth + 1));
        };
        roots.forEach(root => visit(root, 0));
        return found.filter(product => product.title);
    }

    // --- MCP servers from the MCP app ----------------------------------------------------
    function isTaobaoServer(catalog) {
        return /taobao|淘宝/i.test(`${catalog?.name || ''} ${catalog?.key || ''}`) || /:3654\//.test(String(catalog?.key || ''));
    }
    function classifyMcpTool(tool, catalog) {
        const name = String(tool?.name || '');
        if (isTaobaoServer(catalog)) return TAOBAO_CHARACTER_TOOLS.includes(name) ? { blocked: false, reason: '' } : { blocked: true, reason: '淘宝只开放搜索商品和查看规格' };
        const annotations = tool?.annotations && typeof tool.annotations === 'object' ? tool.annotations : {};
        if (annotations.destructiveHint === true || annotations.readOnlyHint === false) return { blocked: true, reason: '服务标注为会修改数据' };
        const words = name.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
        if (words.some(word => BLOCKED_WORDS.has(word))) return { blocked: true, reason: '名称像是会修改数据或涉及隐私' };
        return { blocked: false, reason: '' };
    }
    function mcpCatalog() {
        const live = window.ByndMcpBridge?.status?.();
        if (live?.connected && live.key) {
            const catalog = { key: live.key, name: clip(live.name, 40) || 'MCP Server', tools: [] };
            catalog.tools = (Array.isArray(live.tools) ? live.tools : []).slice(0, 80).map(tool => ({
                name: clip(tool.name, 80),
                description: clip(tool.description, 90),
                required: Array.isArray(tool.inputSchema?.required) ? tool.inputSchema.required.slice(0, 6).map(item => clip(item, 30)) : [],
                blocked: classifyMcpTool(tool, catalog).blocked
            })).filter(tool => tool.name);
            try { localStorage.setItem(MCP_CATALOG_KEY, JSON.stringify(catalog)); } catch (_) {}
            return catalog;
        }
        const cached = readJson(MCP_CATALOG_KEY, null);
        return cached?.key && Array.isArray(cached.tools) ? cached : null;
    }
    function allowedMcpTools(char, catalog = mcpCatalog()) {
        if (!catalog) return [];
        const picked = char?.chatConfig?.agentMcpTools?.[catalog.key];
        return Array.isArray(picked) ? catalog.tools.filter(tool => !tool.blocked && picked.includes(tool.name)) : [];
    }
    async function runMcp(char, call) {
        const bridge = window.ByndMcpBridge;
        if (!bridge?.ensureConnected || !bridge.call) throw new Error('MCP 应用还没准备好');
        const catalog = mcpCatalog();
        const toolName = clip(call.tool, 80);
        if (!allowedMcpTools(char, catalog).some(tool => tool.name === toolName)) throw new Error('这个 MCP 工具没有对当前角色开放');
        await bridge.ensureConnected();
        const live = bridge.status();
        if (!live?.connected || live.key !== catalog.key) throw new Error('MCP 服务已切换，请重新为角色选择工具');
        const liveTool = (live.tools || []).find(tool => tool.name === toolName);
        if (!liveTool || classifyMcpTool(liveTool, catalog).blocked) throw new Error('这个 MCP 工具已被拦截');
        const args = call.arguments && typeof call.arguments === 'object' && !Array.isArray(call.arguments) ? call.arguments : {};
        return { server: catalog.name, tool: toolName, text: String(await bridge.call(toolName, args) || '').slice(0, 1500) };
    }

    // --- permissions & prompt ------------------------------------------------------------
    function availability(kind) {
        const config = readConfig();
        const keys = readKeys();
        if (kind === 'weather') return { ok: true, hint: config.city ? `免 Key · 默认城市：${config.city}` : '免 Key · 可在「设置 → 工具」填写你所在的城市' };
        if (kind === 'places') return keys.amapKey ? { ok: true, hint: '高德地图 · Key 已填写' } : { ok: false, reason: '需要先在「设置 → 工具」填写高德 Key' };
        if (kind === 'movies') return keys.tmdbToken ? { ok: true, hint: 'TMDB · 令牌已填写' } : { ok: false, reason: '需要先在「设置 → 工具」填写 TMDB 令牌' };
        if (kind === 'shop') {
            if (config.shopMode === 'off') return { ok: false, reason: '购物工具已在「设置 → 工具」关闭' };
            return { ok: true, hint: config.shopMode === 'desktop' ? '淘宝桌面版 MCP · 仅限电脑' : '免 Key · 发淘宝搜索卡片' };
        }
        if (kind === 'mcp') {
            const catalog = mcpCatalog();
            return catalog ? { ok: true, hint: `${catalog.name} · 在下方勾选角色可用的工具` } : { ok: false, reason: '先在「MCP」应用里连接一个服务' };
        }
        return { ok: false, reason: '不支持这个工具' };
    }
    function enabledKinds(char) {
        if (!char || char.isGroupChat) return [];
        const prefs = window.getWechatAgentPreferences?.(char);
        if (!prefs?.allowTools) return [];
        return Object.keys(PREF_BY_KIND).filter(kind => prefs[PREF_BY_KIND[kind]] !== false && availability(kind).ok && (kind !== 'mcp' || allowedMcpTools(char).length));
    }
    function instructions(char) {
        const kinds = enabledKinds(char);
        if (!kinds.length) return '';
        const config = readConfig();
        const name = displayName(char);
        const lines = [];
        if (kinds.includes('weather')) lines.push(`{"name":"weather.get","city":"城市，可省略${config.city ? `，默认${config.city}` : ''}"}：看今明两天的天气`);
        if (kinds.includes('places')) lines.push('{"name":"places.search","keyword":"要找的店或地方","city":"可选","near":"可选，某个地标附近"}：在地图上找店、找地方');
        if (kinds.includes('movies')) lines.push('{"name":"movies.nowPlaying"}：看最近在上映的电影；{"name":"movies.search","query":"片名"}：查某部电影');
        if (kinds.includes('shop')) lines.push(config.shopMode === 'desktop'
            ? '{"name":"shop.search","query":"商品关键词","reason":"为什么想给用户看"}：在淘宝上搜商品；{"name":"shop.skus","itemId":"商品ID"}：看某件商品的规格和价格'
            : '{"name":"shop.search","query":"商品关键词","reason":"为什么想给用户看"}：给用户发一张淘宝搜索卡片（你看不到具体商品）');
        if (kinds.includes('mcp')) {
            const catalog = mcpCatalog();
            const tools = allowedMcpTools(char, catalog).slice(0, 12).map(tool => `${tool.name}${tool.required.length ? `(${tool.required.join(',')})` : ''}${tool.description ? `：${tool.description}` : ''}`);
            lines.push(`{"name":"mcp.call","server":"${catalog.name}","tool":"工具名","arguments":{}}：可用工具 —— ${tools.join('；')}`);
        }
        return `【角色工具箱】你可以真的去用下面这些现实工具，但只能在「${name}」按人设、世界观和此刻处境会自然去做的时候用：没有手机和网络的世界观（古代、仙侠、异世界等）不要用；与人设气质明显不符的事（比如冷淡毒舌的人给别人挑粉色蝴蝶结）不要做；用户没提、情境也不需要时不要用。`
            + `要用时，正文先用角色自己的口吻自然带一句（比如“我帮你看看”），再在正文之后附上 <bynd_tool>{JSON}</bynd_tool>，本轮所有工具合计最多 3 个；结果会以卡片发给用户，之后你会看到结果再接着聊。如果正文已经说完、不需要看结果再回应，可在 JSON 里加 "react":false。`
            + `绝不要提到工具、API、插件、系统或 AI，也不要编造还没查到的结果。\n可用：\n- ${lines.join('\n- ')}`;
    }
    function permission(char, kind, call) {
        if (!char || char.isGroupChat) return { ok: false, reason: '群聊里暂不支持角色工具' };
        const prefs = window.getWechatAgentPreferences?.(char) || {};
        if (!prefs.allowTools) return { ok: false, reason: '当前角色未开启「允许使用工具」' };
        if (prefs[PREF_BY_KIND[kind]] === false) return { ok: false, reason: `当前角色未开启「${KIND_LABELS[kind]}」` };
        const available = availability(kind);
        if (!available.ok) return { ok: false, reason: available.reason };
        if (call.name === 'shop.skus' && readConfig().shopMode !== 'desktop') return { ok: false, reason: '只有淘宝桌面版模式能查看商品规格' };
        return { ok: true };
    }
    // A human description for the in-character gate and the activity card.
    function describe(call) {
        const city = clip(call.city, 20) || readConfig().city;
        switch (call.name) {
            case 'weather.get': return { title: '查天气', text: `查看${city || '当地'}今明两天的天气预报`, input: city || '未指定城市' };
            case 'places.search': {
                const keyword = clip(call.keyword || call.query, 40);
                const near = clip(call.near, 40);
                return { title: '找店和地点', text: `在地图上搜索${near ? `${near}附近` : city ? `${city}` : ''}的「${keyword}」`, input: [keyword, near || city].filter(Boolean).join(' · ') };
            }
            case 'movies.nowPlaying': return { title: '查电影', text: '看看最近在上映的电影', input: '正在上映' };
            case 'movies.search': return { title: '查电影', text: `查一下电影《${clip(call.query || call.title, 60)}》`, input: clip(call.query || call.title, 60) };
            case 'shop.search': return { title: '淘宝搜索', text: `在淘宝上搜索「${clip(call.query, 40)}」给用户看${call.reason ? `（${clip(call.reason, 60)}）` : ''}`, input: clip(call.query, 40) };
            case 'shop.skus': return { title: '查看商品规格', text: `查看淘宝商品 ${clip(call.itemId, 30)} 的规格和价格`, input: clip(call.itemId, 30) };
            case 'mcp.call': return { title: `MCP · ${clip(call.tool, 40)}`, text: `通过 ${clip(call.server, 40) || 'MCP 服务'} 使用工具 ${clip(call.tool, 60)}`, input: clip(JSON.stringify(call.arguments || {}), 300) };
            default: return { title: '角色工具', text: clip(call.name, 60), input: '' };
        }
    }

    const cardMessage = (tool, title, summary, data) => ({
        type: 'tool_result', isMe: false, tool, title: clip(title, 60),
        summary: `[工具结果] ${clip(summary, 220)}`, content: `[工具结果] ${clip(summary, 220)}`, description: `[工具结果] ${clip(summary, 220)}`,
        toolData: data
    });

    async function execute(char, call, event = {}) {
        const kind = KIND_BY_NAME[call?.name];
        if (!kind) return { ok: false, message: '不支持这个工具，未执行操作' };
        const action = describe(call);
        event.title = clip(action.title, 60);
        event.input = clip(action.input, 500);
        const access = permission(char, kind, call);
        if (!access.ok) return { ok: false, message: access.reason };
        let verdict = { allow: true };
        try { verdict = (await window.ByndDecider?.gate?.(char, action.text, { details: { tool: call.name, ...call } })) || verdict; }
        catch (error) { console.warn('工具人设判断失败，沿用角色自己的决定', error?.message || error); }
        if (verdict.allow === false) return { ok: false, blocked: true, message: '未执行：不符合人设' };
        const react = call.react !== false;

        if (call.name === 'weather.get') {
            const city = clip(call.city, 30) || readConfig().city;
            if (!city) throw new Error('没有说是哪个城市，也没有设置「我所在的城市」');
            const weather = await getWeather(city);
            const days = upcomingDays(weather);
            const summary = `${weather.city}天气：${days.map(dayLine).join('；') || '暂无预报'}`;
            const now = weather.current ? `现在${round(weather.current.temp)}℃（体感${round(weather.current.feels)}℃）${weather.current.text}；` : '';
            return { ok: true, message: summary, card: cardMessage('weather', `${weather.city}天气`, summary, { city: weather.city, region: weather.region, current: weather.current, days }), react: react ? `${weather.city}天气：${now}${days.map(dayLine).join('；')}` : '' };
        }
        if (call.name === 'places.search') {
            const found = await searchPlaces(call);
            if (!found.pois.length) return { ok: true, message: `没找到「${found.keyword}」`, react: react ? `地图上没找到「${found.keyword}」` : '' };
            const list = found.pois.map(poi => `${poi.name}${poiMeta(poi) ? `（${poiMeta(poi)}）` : ''}`).join('、');
            return { ok: true, message: `找到 ${found.pois.length} 个：${list}`, card: cardMessage('places', `${found.near || found.city || ''}「${found.keyword}」`, `地图搜索「${found.keyword}」：${list}`, found), react: react ? `地图搜索「${found.keyword}」${found.near ? `（${found.near}附近）` : found.city ? `（${found.city}）` : ''}：\n${found.pois.map(poi => `${poi.name}｜${poiMeta(poi) || '暂无评分'}｜${poi.address}`).join('\n')}` : '' };
        }
        if (call.name === 'movies.nowPlaying' || call.name === 'movies.search') {
            const found = await movies(call.name === 'movies.search' ? 'search' : 'nowPlaying', call);
            const label = found.mode === 'search' ? `电影《${found.query}》` : '正在上映';
            if (!found.movies.length) return { ok: true, message: `${label}：没有结果`, react: react ? `${label}：没有找到` : '' };
            const list = found.movies.map(movie => `${movie.title}${movie.rating != null ? `（${movie.rating}）` : ''}`).join('、');
            return { ok: true, message: `${label}：${list}`, card: cardMessage('movies', label, `${label}：${list}`, found), react: react ? `${label}：\n${found.movies.map(movie => `${movie.title}${movie.year ? ` ${movie.year}` : ''}｜评分${movie.rating ?? '暂无'}｜${movie.overview || '暂无简介'}`).join('\n')}` : '' };
        }
        if (call.name === 'shop.search') {
            const card = shopSearchCard(call.query, call.reason);
            if (readConfig().shopMode !== 'desktop') {
                return { ok: true, message: `已发淘宝搜索卡片：${card.query}`, card: cardMessage('shop', card.query, `淘宝搜索卡片「${card.query}」${card.reason ? `：${card.reason}` : ''}`, card), react: '' };
            }
            const result = await taobaoCall('search_products', { keyword: card.query });
            if (result?.isError) throw new Error(clip(mcpResultText(result), 120) || '淘宝桌面版没有返回结果');
            const products = extractProducts(result);
            if (!products.length) {
                const text = clip(mcpResultText(result), 600);
                return { ok: true, message: text || '淘宝桌面版没有返回商品', card: cardMessage('shop', card.query, `淘宝搜索卡片「${card.query}」`, card), react: react && text ? `淘宝搜索「${card.query}」：${text}` : '' };
            }
            const list = products.map(product => `${product.title}（¥${product.price}）`).join('、');
            return { ok: true, message: `淘宝搜索「${card.query}」：${list}`, card: cardMessage('shop', card.query, `淘宝搜索「${card.query}」：${list}`, { ...card, products }), react: react ? `淘宝搜索「${card.query}」：\n${products.map(product => `${product.title}｜¥${product.price}｜${product.shop || '店铺未知'}`).join('\n')}` : '' };
        }
        if (call.name === 'shop.skus') {
            const itemId = String(call.itemId || '').replace(/\D/g, '');
            if (!itemId) throw new Error('没有商品 ID');
            const result = await taobaoCall('get_product_skus', { itemId });
            const text = clip(mcpResultText(result), 800);
            if (result?.isError) throw new Error(text || '淘宝桌面版没有返回规格');
            return { ok: true, message: text || '没有规格信息', react: react && text ? `商品 ${itemId} 的规格：${text}` : '' };
        }
        const output = await runMcp(char, call);
        return { ok: true, message: output.text || '工具没有返回内容', react: react && output.text ? `${output.server} 的 ${output.tool} 返回：\n${output.text}` : '' };
    }

    // --- delivery & in-character follow-up -----------------------------------------------
    async function deliver(char, cards = [], reacts = [], options = {}) {
        if (!char || !Array.isArray(char.history)) return 0;
        const stamp = typeof window.createMessageTimestamp === 'function' ? window.createMessageTimestamp : () => Date.now();
        cards.forEach(card => char.history.push({ ...card, timestamp: stamp() }));
        if (cards.length && !options.background && window.currentChatCharId === char.id && typeof window.refreshChatView === 'function') window.refreshChatView(char);
        if (reacts.length && readConfig().followUp) void followUp(char, reacts).catch(error => console.warn('角色工具的后续回应失败', error?.message || error));
        return cards.length;
    }

    async function followUp(char, reacts) {
        if (typeof window.callChatApi !== 'function' || typeof window.buildMessages !== 'function') return 0;
        const history = char.history;
        const anchor = history.length;
        const name = displayName(char);
        const messages = window.buildMessages(char, history);
        messages.push({
            role: 'system',
            content: `【工具结果·只有你知道细节】你（「${name}」）刚才顺手查到：\n${reacts.join('\n\n').slice(0, 2400)}\n用户已经在聊天里看到了结果卡片。现在用「${name}」自己的口吻，接着发 1-3 条简短的微信消息，自然地回应这些结果：挑重点、给态度或建议（比如带伞、哪家看着不错、这部片你怎么看），不要逐条复述，不要提到工具、接口、系统或 AI，不要输出任何 <bynd_...> 标签或方括号指令。按人设此刻没什么想补充的，就只回一条很短的话。`
        });
        const result = await window.callChatApi(messages, { background: true, stream: false, usageFeature: 'tool', usageChar: char });
        if (!result?.ok || !(window.myCharacters || []).includes(char) || char.history !== history) return 0;
        if (history.slice(anchor).some(msg => msg?.isMe)) return 0;
        const content = String(result.content || '')
            .replace(/<bynd_(summary|tool|decide|pet)\b[^>]*>[\s\S]*?<\/bynd_\1>/gi, '')
            .replace(/<bynd_[a-z]+\b[^>]*>[\s\S]*$/gi, '')
            .replace(/<\/?bynd_[a-z]+\b[^>]*>/gi, '');
        const split = typeof window.splitWechatAiResponseSegments === 'function' ? window.splitWechatAiResponseSegments(content, char) : content.split('|||');
        const parts = split.map(part => String(part || '').trim()).filter(part => part && !(typeof window.isWechatAiMetaLeakContent === 'function' && window.isWechatAiMetaLeakContent(part))).slice(0, 3);
        if (!parts.length || typeof window.appendWechatAiMessageParts !== 'function') return 0;
        const viewing = window.currentChatCharId === char.id;
        const contentEl = viewing ? document.getElementById?.('chat-room-content') : null;
        let count = 0;
        for (const part of parts) count += window.appendWechatAiMessageParts(char, contentEl, part, { background: !viewing, textOnly: true }) || 0;
        if (!count) return 0;
        await window.saveCharactersToStorage?.();
        window.renderChatList?.();
        if (!viewing) window.showWechatDesktopMessageIsland?.(char);
        return count;
    }

    // --- cards in chat -------------------------------------------------------------------
    const ICONS = { weather: 'ri-sun-cloudy-line', places: 'ri-map-pin-2-line', movies: 'ri-film-line', shop: 'ri-shopping-bag-3-line' };
    const FOOTERS = { weather: 'Open-Meteo 天气', places: '高德地图', movies: 'TMDB 电影', shop: '淘宝' };
    function renderCardBody(msg) {
        const data = msg.toolData && typeof msg.toolData === 'object' ? msg.toolData : {};
        if (msg.tool === 'weather') {
            const current = data.current;
            const days = Array.isArray(data.days) ? data.days : [];
            return `${current ? `<div class="bynd-tool-weather-now"><b>${escape(round(current.temp))}°</b><span>${escape(current.text)}<small>体感 ${escape(round(current.feels))}°</small></span></div>` : ''}<div class="bynd-tool-weather-days">${days.map(day => `<div><strong>${escape(day.label)}</strong><span>${escape(day.text)}</span><em>${escape(round(day.min))}~${escape(round(day.max))}℃</em><small>${day.pop != null ? `降水 ${escape(round(day.pop))}%` : ''}${day.uv != null ? ` · UV ${escape(Math.round(day.uv))}` : ''}</small></div>`).join('')}</div>`;
        }
        if (msg.tool === 'places') {
            return `<div class="bynd-tool-list">${(data.pois || []).map(poi => `<button type="button" class="bynd-tool-row" ${httpsUrl(poi.url) ? `data-tool-url="${escape(httpsUrl(poi.url))}"` : 'disabled'}><span><strong>${escape(poi.name)}</strong><small>${escape(poiMeta(poi) || poi.type || '')}</small><em>${escape(poi.address)}</em></span><i class="ri-arrow-right-s-line"></i></button>`).join('')}</div>`;
        }
        if (msg.tool === 'movies') {
            return `<div class="bynd-tool-list">${(data.movies || []).map(movie => `<button type="button" class="bynd-tool-row bynd-tool-row--media" ${httpsUrl(movie.url) ? `data-tool-url="${escape(httpsUrl(movie.url))}"` : 'disabled'}>${httpsUrl(movie.poster) ? `<img src="${escape(httpsUrl(movie.poster))}" alt="" loading="lazy" onerror="this.remove()">` : '<i class="ri-film-line bynd-tool-thumb"></i>'}<span><strong>${escape(movie.title)}${movie.year ? ` <small>${escape(movie.year)}</small>` : ''}</strong><small>${movie.rating != null ? `评分 ${escape(movie.rating)}` : '暂无评分'}</small><em>${escape(movie.overview)}</em></span></button>`).join('')}</div>`;
        }
        if (msg.tool === 'shop') {
            const products = Array.isArray(data.products) ? data.products : [];
            const list = products.length ? `<div class="bynd-tool-list">${products.map(product => `<button type="button" class="bynd-tool-row bynd-tool-row--media" ${httpsUrl(product.url) ? `data-tool-url="${escape(httpsUrl(product.url))}"` : 'disabled'}>${httpsUrl(product.image) ? `<img src="${escape(httpsUrl(product.image))}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">` : '<i class="ri-shopping-bag-3-line bynd-tool-thumb"></i>'}<span><strong>${escape(product.title)}</strong><small>¥${escape(product.price)}</small><em>${escape(product.shop)}</em></span></button>`).join('')}</div>` : '';
            return `${data.reason ? `<p class="bynd-tool-note">${escape(data.reason)}</p>` : ''}${list}<button type="button" class="bynd-tool-action" data-tool-url="${escape(httpsUrl(data.url))}" data-tool-app-url="${escape(String(data.appUrl || '').startsWith('taobao://') ? data.appUrl : '')}"><i class="ri-search-line"></i>去淘宝搜「${escape(data.query)}」</button>`;
        }
        return `<p class="bynd-tool-note">${escape(msg.summary || msg.content)}</p>`;
    }
    function renderCard(msg, quoteHtml = '', metaHtml = '') {
        const tool = ICONS[msg?.tool] ? msg.tool : 'other';
        return `<div class="msg-bubble bynd-tool-card bynd-tool-card--${tool}" onclick="event.stopPropagation();ByndCharacterTools.openFromCard(event)">${quoteHtml}<div class="bynd-tool-card__head"><i class="${ICONS[tool] || 'ri-tools-line'}"></i><strong>${escape(msg.title || KIND_LABELS[tool] || '工具结果')}</strong></div>${renderCardBody(msg)}<div class="msg-card-footer"><span>${escape(FOOTERS[tool] || '角色工具')}</span>${metaHtml}</div></div>`;
    }
    function openFromCard(event) {
        const node = event?.target?.closest?.('[data-tool-url]');
        if (!node) return false;
        const url = httpsUrl(node.dataset.toolUrl);
        const appUrl = String(node.dataset.toolAppUrl || '');
        if (appUrl.startsWith('taobao://') && typeof window.ByndAndroid?.openExternalUrl === 'function') {
            try { if (window.ByndAndroid.openExternalUrl(appUrl) !== false) return true; } catch (_) {}
        }
        if (url) window.open(url, '_blank', 'noopener,noreferrer');
        return !!url;
    }

    // --- per-character settings --------------------------------------------------------
    function renderAgentToolRows(char, row) {
        const hint = kind => { const state = availability(kind); return escape(state.ok ? state.hint : state.reason); };
        const rows = [
            row('toolWeather', '查天气', hint('weather')),
            row('toolPlaces', '找店和地点', hint('places')),
            row('toolMovies', '查电影', hint('movies')),
            row('toolShop', '淘宝搜索', hint('shop')),
            row('toolMcp', 'MCP 工具', hint('mcp'))
        ].join('');
        const catalog = mcpCatalog();
        if (!catalog?.tools?.length) return rows;
        const picked = char?.chatConfig?.agentMcpTools?.[catalog.key] || [];
        return rows + `<div class="bynd-tool-mcp-picker"><p class="bynd-agent-note">${escape(catalog.name)}：勾选这个角色可以使用的工具。会修改数据或涉及隐私的工具已拦截。</p>${catalog.tools.map(tool => `<label class="bynd-agent-toggle${tool.blocked ? ' is-blocked' : ''}"><span><strong>${escape(tool.name)}</strong><small>${tool.blocked ? '已拦截：可能修改数据或涉及隐私' : escape(tool.description || '只读工具')}</small></span><input type="checkbox" data-mcp-tool="${escape(tool.name)}" ${!tool.blocked && picked.includes(tool.name) ? 'checked' : ''} ${tool.blocked ? 'disabled' : ''} onchange="ByndCharacterTools.setCharacterMcpTool(this)"></label>`).join('')}</div>`;
    }
    async function setCharacterMcpTool(input) {
        const char = (window.myCharacters || []).find(item => item.id === document.getElementById('wcs-agent-features')?.dataset.charId);
        const catalog = mcpCatalog();
        const name = input?.dataset?.mcpTool;
        const tool = catalog?.tools.find(item => item.name === name);
        if (!char || !tool || tool.blocked) { if (input) input.checked = false; return false; }
        char.chatConfig = char.chatConfig || {};
        const before = char.chatConfig.agentMcpTools;
        const current = Array.isArray(before?.[catalog.key]) ? before[catalog.key] : [];
        const next = input.checked ? [...new Set([...current, name])] : current.filter(item => item !== name);
        char.chatConfig.agentMcpTools = { ...(before || {}), [catalog.key]: next };
        input.disabled = true;
        try {
            if (await window.saveCharactersToStorage?.() === false) throw new Error('保存失败，请重试');
            return true;
        } catch (error) {
            if (before === undefined) delete char.chatConfig.agentMcpTools; else char.chatConfig.agentMcpTools = before;
            input.checked = !input.checked;
            notify(error.message);
            return false;
        } finally { input.disabled = false; }
    }

    // --- settings tab ----------------------------------------------------------------------
    function renderSettings() {
        const root = document.getElementById('bynd-tools-settings');
        if (!root) return;
        const config = readConfig();
        const keys = readKeys();
        root.innerHTML = `<section class="bynd-jev-card bynd-tools-card" aria-label="角色工具">
            <div class="bynd-jev-heading"><span class="bynd-jev-mark"><i class="ri-tools-line"></i></span><div><strong>角色工具箱</strong><small>让角色在不出戏的前提下用真实工具</small></div></div>
            <p class="bynd-jev-intro">角色只会在符合人设和世界观时才用这些工具，比如提醒你明天带伞、帮你找附近的店、聊最近的电影。每个角色还要在「聊天设置 → 角色工具箱」里单独打开。配置了 Jev 时由 Jev 先判断是否符合人设（智能决策 → 工具人设把关），没有 Jev 时由聊天模型按人设自己判断。</p>
            <label class="bynd-jev-key-label" for="bynd-tools-city">我所在的城市</label>
            <input class="bynd-jev-key" id="bynd-tools-city" maxlength="30" placeholder="例如：杭州" autocomplete="off">
            <label class="bynd-jev-enable bynd-tools-toggle"><span><strong>让角色知道天气</strong><small>每隔几小时更新一次天气（Open-Meteo，免 Key），角色会像平常一样顺口提醒带伞、防晒</small></span><input type="checkbox" id="bynd-tools-weather-anchor"></label>
            <div class="bynd-tools-group">找店和地点 · 高德地图</div>
            <label class="bynd-jev-key-label" for="bynd-tools-amap">高德 Web服务 Key（可选）</label>
            <input class="bynd-jev-key" id="bynd-tools-amap" type="password" placeholder="不填则角色不会找店" autocomplete="off" spellcheck="false">
            <details class="bynd-jev-guide"><summary><i class="ri-question-line"></i>怎么获取高德 Key？</summary><ol>
                <li>打开 <b>lbs.amap.com</b>，用高德 / 支付宝 / 淘宝账号登录，按提示完成开发者认证（个人即可）。</li>
                <li>进入 <b>控制台 → 应用管理 → 我的应用</b>，点 <b>创建新应用</b>，名称随便填。</li>
                <li>在应用里点 <b>添加 Key</b>，服务平台选 <b>「Web服务」</b>（不要选「Web端(JS API)」），提交。</li>
                <li>复制生成的 Key 粘贴到这里，保存后点「测试」。个人认证每天有免费额度，聊天足够用。</li>
            </ol></details>
            <div class="bynd-tools-group">电影 · TMDB</div>
            <label class="bynd-jev-key-label" for="bynd-tools-tmdb">TMDB API 读访问令牌（可选）</label>
            <input class="bynd-jev-key" id="bynd-tools-tmdb" type="password" placeholder="不填则角色不会查电影" autocomplete="off" spellcheck="false">
            <details class="bynd-jev-guide"><summary><i class="ri-question-line"></i>怎么获取 TMDB 令牌？</summary><ol>
                <li>打开 <b>themoviedb.org</b> 注册账号并验证邮箱。</li>
                <li>点右上角头像 → <b>设置 → API</b>，点「申请 API 密钥」，类型选 <b>Developer</b>，用途写个人聊天应用即可。</li>
                <li>通过后在同一页面复制 <b>「API 读访问令牌」</b>（很长、以 <code>eyJ</code> 开头），粘贴到这里。</li>
            </ol><p>免费。部分网络访问 TMDB 较慢或需要代理，连不上时角色就不会查电影。</p></details>
            <div class="bynd-tools-group">购物 · 淘宝</div>
            <label class="bynd-jev-key-label" for="bynd-tools-shop-mode">购物方式</label>
            <select class="bynd-jev-key" id="bynd-tools-shop-mode"><option value="card">淘宝搜索卡片（免 Key，推荐）</option><option value="desktop">淘宝桌面版 MCP（电脑）</option><option value="off">关闭</option></select>
            <label class="bynd-jev-key-label" for="bynd-tools-taobao">淘宝桌面版 MCP 地址</label>
            <input class="bynd-jev-key" id="bynd-tools-taobao" placeholder="${TAOBAO_ENDPOINT}" autocomplete="off" spellcheck="false">
            <details class="bynd-jev-guide"><summary><i class="ri-question-line"></i>淘宝桌面版 MCP 在哪里能用？</summary><ol>
                <li>在电脑上安装淘宝桌面版 2.5 以上（<b>pc.taobao.com</b>），登录后在桌面版设置里开启 <b>MCP 服务</b>。默认地址 <code>${TAOBAO_ENDPOINT}</code>，端口以桌面版显示为准。</li>
                <li>角色只能用「搜索商品」和「查看商品规格」，不会加购物车、下单，也读不到订单、地址和旺旺聊天。</li>
            </ol><p>能不能连上取决于环境：手机和安卓 APK 连不到电脑里的淘宝；网页版需要浏览器允许访问本地网络，并且淘宝桌面版要允许浏览器跨域访问，淘宝目前没有公开说明是否支持。点「测试」连不上时，请改用「淘宝搜索卡片」。</p></details>
            <label class="bynd-jev-enable bynd-tools-toggle"><span><strong>查到结果后让角色接着说</strong><small>结果卡片出来后，再用一次后台请求让角色用自己的口吻回应 1-3 句；会多用一次聊天接口</small></span><input type="checkbox" id="bynd-tools-follow-up"></label>
            <p class="bynd-jev-privacy">Key 和令牌只保存在当前设备，不写入安装包，不包含在 BYND 的 JSON 导出里，也不会写进日志。查询直接从你的设备发往 Open-Meteo、高德、TMDB 或本机淘宝桌面版。</p>
            <div class="bynd-jev-actions"><button type="button" id="bynd-tools-test" onclick="ByndCharacterTools.testSettings()">保存并测试</button><button type="button" onclick="ByndCharacterTools.saveSettings()">保存设置</button></div>
            <p class="bynd-jev-status" id="bynd-tools-status" role="status" aria-live="polite"></p>
        </section>`;
        const field = id => root.querySelector(`#${id}`);
        field('bynd-tools-city').value = config.city;
        field('bynd-tools-weather-anchor').checked = config.weatherAnchor;
        field('bynd-tools-amap').value = keys.amapKey;
        field('bynd-tools-tmdb').value = keys.tmdbToken;
        field('bynd-tools-shop-mode').value = config.shopMode;
        field('bynd-tools-taobao').value = config.taobaoEndpoint;
        field('bynd-tools-follow-up').checked = config.followUp;
    }
    function saveSettings(options = {}) {
        const root = document.getElementById('bynd-tools-settings');
        if (!root) return false;
        const field = id => root.querySelector(`#${id}`);
        const status = field('bynd-tools-status');
        try {
            const endpoint = taobaoEndpoint(field('bynd-tools-taobao').value || TAOBAO_ENDPOINT);
            const before = readConfig();
            const config = writeConfig({
                city: clip(field('bynd-tools-city').value, 30),
                weatherAnchor: !!field('bynd-tools-weather-anchor').checked,
                shopMode: field('bynd-tools-shop-mode').value,
                taobaoEndpoint: endpoint,
                followUp: !!field('bynd-tools-follow-up').checked
            });
            writeKeys({ amapKey: field('bynd-tools-amap').value, tmdbToken: field('bynd-tools-tmdb').value });
            if (config.city && config.city !== before.city) scheduleWeatherRefresh(config.city);
            if (endpoint !== before.taobaoEndpoint) { taobaoSession.ready = ''; taobaoSession.sessionId = ''; }
            if (status && !options.silent) status.textContent = '已保存。记得在角色的聊天设置里打开「允许使用工具」。';
            return true;
        } catch (error) {
            if (status) status.textContent = `未保存：${error.message}`;
            return false;
        }
    }
    async function testSettings() {
        const root = document.getElementById('bynd-tools-settings');
        if (!root || !saveSettings({ silent: true })) return;
        const status = root.querySelector('#bynd-tools-status');
        const button = root.querySelector('#bynd-tools-test');
        const config = readConfig();
        const keys = readKeys();
        const lines = [];
        const report = () => { if (status) status.textContent = lines.join('\n'); };
        const check = async (label, run) => {
            lines.push(`${label}：测试中…`); report();
            try { lines[lines.length - 1] = `${label}：${await run()}`; }
            catch (error) { lines[lines.length - 1] = `${label}：${error.message || '失败'}`; }
            report();
        };
        if (button) button.disabled = true;
        try {
            if (config.city) await check('天气', async () => { const weather = await getWeather(config.city, { force: true }); return `可用 · ${weather.city} ${upcomingDays(weather).map(dayLine).join('；')}`; });
            else lines.push('天气：免 Key，可用；填写城市后角色会知道你那边的天气');
            if (keys.amapKey) await check('高德', async () => `可用 · 找到 ${(await searchPlaces({ keyword: '咖啡', city: config.city || '北京' })).pois.length} 家咖啡店`);
            if (keys.tmdbToken) await check('TMDB', async () => `可用 · 正在上映 ${(await movies('nowPlaying')).movies.length} 部`);
            if (config.shopMode === 'desktop') await check('淘宝桌面版', async () => { taobaoSession.ready = ''; await taobaoReady(); return '已连接'; });
            else lines.push(config.shopMode === 'card' ? '淘宝：搜索卡片模式，免 Key' : '淘宝：已关闭');
            report();
        } finally { if (button) button.disabled = false; }
    }

    window.ByndCharacterTools = {
        secretStorageKey: SECRET_KEY, configStorageKey: CONFIG_KEY, weatherCacheKey: WEATHER_CACHE_KEY,
        taobaoCharacterTools: TAOBAO_CHARACTER_TOOLS.slice(),
        handles: name => Object.prototype.hasOwnProperty.call(KIND_BY_NAME, String(name || '')),
        readConfig, writeConfig, readKeys, writeKeys, availability, enabledKinds, instructions, execute, deliver, followUp,
        weatherAnchor, parseWeather, getWeather, searchPlaces, movies, shopSearchCard, extractProducts, classifyMcpTool, mcpCatalog, allowedMcpTools,
        renderCard, openFromCard, renderAgentToolRows, setCharacterMcpTool, renderSettings, saveSettings, testSettings
    };
})();
