const assert = require('node:assert/strict');
const test = require('node:test');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const { root, clone, memoryStorage, storageHarness, addBackupModule } = require('./helpers/harness.cjs');

const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const escapeHtml = value => String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const localDate = (offsetDays = 0) => { const d = new Date(Date.now() + offsetDays * 86400000); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const flush = () => new Promise(resolve => setTimeout(resolve, 15));

const FORECAST = () => ({
    current: { temperature_2m: 24.3, apparent_temperature: 28.8, weather_code: 0, wind_speed_10m: 2 },
    daily: { time: [localDate(0), localDate(1), localDate(2)], weather_code: [53, 61, 3], temperature_2m_max: [34.7, 24.2, 26], temperature_2m_min: [23.2, 18.1, 19], precipitation_probability_max: [59, 86, 10], uv_index_max: [7, 4.3, 5], wind_speed_10m_max: [4.7, 17.8, 9] }
});

function harness({ prefs = { allowTools: true }, gate = async () => ({ allow: true, route: 'agent' }), routes = {} } = {}) {
    const char = { id: 'role-a', name: '林舟', chatConfig: { agentPreferences: { ...prefs } }, history: [{ type: 'text', isMe: true, content: '明天要出门', timestamp: 101 }] };
    const state = { requests: [], gateCalls: [], chatCalls: [], appended: [], saves: 0 };
    const sandbox = {
        myCharacters: [char], currentChatCharId: 'someone-else',
        localStorage: memoryStorage(), console: { log() {}, warn() {}, error() {} },
        URL, URLSearchParams, Response, AbortController, setTimeout, clearTimeout,
        document: { getElementById: () => null, createElement: () => ({ dataset: {}, addEventListener() {} }) },
        wcEscapeHtml: escapeHtml, refreshChatView() {}, renderChatList() {}, showWechatToast() {}, showWechatDesktopMessageIsland() {},
        createMessageTimestamp: () => Date.now(),
        saveCharactersToStorage: async () => { state.saves += 1; return true; },
        ByndDecider: { replyInstructions: () => '', extractReplyDecisions: raw => ({ content: String(raw || ''), decisions: null }), gate: async (...args) => { state.gateCalls.push(args); return gate(...args); } },
        fetch: async (url, options = {}) => {
            state.requests.push({ url: String(url), options });
            const route = Object.keys(routes).find(prefix => String(url).startsWith(prefix));
            if (!route) throw new TypeError('Failed to fetch');
            return routes[route](String(url), options);
        },
        buildMessages: () => [{ role: 'system', content: 'persona' }],
        callChatApi: async (messages, options) => { state.chatCalls.push({ messages, options }); return { ok: true, content: '带把伞吧|||别淋着' }; },
        splitWechatAiResponseSegments: content => String(content).split('|||'),
        isWechatAiMetaLeakContent: () => false,
        appendWechatAiMessageParts: (target, el, text) => { state.appended.push(text); target.history.push({ type: 'text', isMe: false, content: text }); return 1; }
    };
    sandbox.window = sandbox;
    const context = vm.createContext(sandbox);
    vm.runInContext(read('systems/agent-runtime/agent-tools.js'), context);
    vm.runInContext(read('apps/wechat/character/character-tools.js'), context);
    return { context, tools: context.ByndCharacterTools, char, state };
}

const weatherRoutes = {
    'https://geocoding-api.open-meteo.com/': () => json({ results: [{ name: '杭州', latitude: 30.29, longitude: 120.16, admin1: '浙江' }] }),
    'https://api.open-meteo.com/': () => json(FORECAST())
};

test('the tool list only offers tools that are configured and allowed for this character', () => {
    const h = harness();
    let text = h.context.buildWechatAgentInstructions(h.char);
    assert.match(text, /weather\.get/);
    assert.match(text, /shop\.search/);
    assert.doesNotMatch(text, /places\.search|movies\.|mcp\.call/, 'keyed tools stay off until a key is filled');
    assert.match(text, /人设/);
    h.tools.writeKeys({ amapKey: 'amap-key', tmdbToken: 'eyJtoken' });
    text = h.tools.instructions(h.char);
    assert.match(text, /places\.search/);
    assert.match(text, /movies\.nowPlaying/);
    h.char.chatConfig.agentPreferences.toolWeather = false;
    h.tools.writeConfig({ shopMode: 'off' });
    text = h.tools.instructions(h.char);
    assert.doesNotMatch(text, /weather\.get|shop\.search/);
    h.char.chatConfig.agentPreferences.allowTools = false;
    assert.equal(h.tools.instructions(h.char), '');
    assert.equal(h.tools.instructions({ ...h.char, isGroupChat: true, chatConfig: { agentPreferences: { allowTools: true } } }), '');
    assert.equal(h.context.getWechatAgentPreferences({}).allowTools, false, 'tools are opt-in per character');
});

test('an out-of-character verdict blocks the call before any network request', async () => {
    const h = harness({ gate: async () => ({ allow: false, route: 'jev' }), routes: weatherRoutes });
    const consumed = await h.context.consumeWechatAgentResponse(h.char, '我帮你看看<bynd_tool>{"name":"weather.get","city":"杭州"}</bynd_tool>');
    assert.equal(h.state.requests.length, 0);
    assert.equal(h.state.gateCalls.length, 1);
    assert.match(h.state.gateCalls[0][1], /杭州.*天气/);
    assert.equal(consumed.content, '我帮你看看', 'the character keeps its own words');
    assert.equal(consumed.afterAppend, undefined);
    const activity = h.char.chatConfig.agentActivity.at(-1);
    assert.equal(activity.state, 'error');
    assert.equal(activity.result, '未执行：不符合人设');
});

test('calls without permission never reach the gate or the network', async () => {
    const h = harness({ prefs: { allowTools: false }, routes: weatherRoutes });
    const consumed = await h.context.consumeWechatAgentResponse(h.char, '好<bynd_tool>{"name":"weather.get"}</bynd_tool>');
    assert.equal(h.state.gateCalls.length + h.state.requests.length, 0);
    assert.equal(consumed.content, '好');
    assert.match(h.char.chatConfig.agentActivity.at(-1).result, /允许使用工具/);
});

test('weather parses Open-Meteo and the prompt anchor reads only the cache', async () => {
    const h = harness({ routes: weatherRoutes });
    const parsed = h.tools.parseWeather({ name: '杭州', admin: '浙江' }, FORECAST(), Date.now());
    assert.equal(parsed.days[1].text, '小雨');
    assert.equal(parsed.days[1].pop, 86);
    assert.equal(parsed.current.text, '晴');
    assert.equal(h.tools.weatherAnchor(h.char), '', 'no city, no anchor');
    h.tools.writeConfig({ city: '杭州' });
    h.context.localStorage.setItem(h.tools.weatherCacheKey, JSON.stringify({ '杭州': { place: { name: '杭州', lat: 30.29, lon: 120.16 }, weather: parsed } }));
    const anchor = h.tools.weatherAnchor(h.char);
    assert.match(anchor, /杭州/);
    assert.match(anchor, /明天小雨，18~24℃，降水概率86%/);
    assert.match(anchor, /古代/);
    assert.equal(h.state.requests.length, 0, 'fresh cache: no network');
    h.char.chatConfig.agentPreferences.toolWeather = false;
    assert.equal(h.tools.weatherAnchor(h.char), '');
    h.char.chatConfig.agentPreferences.toolWeather = true;
    const stale = { ...parsed, fetchedAt: Date.now() - 4 * 3600 * 1000 };
    h.context.localStorage.setItem(h.tools.weatherCacheKey, JSON.stringify({ '杭州': { place: { name: '杭州', lat: 30.29, lon: 120.16 }, weather: stale } }));
    assert.match(h.tools.weatherAnchor(h.char), /杭州/, 'a slightly stale cache still answers synchronously');
    await flush();
    assert.ok(h.state.requests.some(request => request.url.startsWith('https://api.open-meteo.com/')), 'and refreshes in the background');
    assert.match(read('core/api/chat-api.js'), /window\.ByndCharacterTools\?\.weatherAnchor\?\.\(char\)/);
});

test('a weather call delivers a saved card and one background follow-up billed as tool', async () => {
    const h = harness({ routes: weatherRoutes });
    const consumed = await h.context.consumeWechatAgentResponse(h.char, '我看看<bynd_tool>{"name":"weather.get","city":"杭州"}</bynd_tool>');
    assert.equal(consumed.toolCount, 1);
    assert.equal(await consumed.afterAppend({ background: true }), 1);
    const card = h.char.history.find(msg => msg.type === 'tool_result');
    assert.equal(card.tool, 'weather');
    assert.match(card.summary, /^\[工具结果\] 杭州天气：今天/);
    assert.equal(card.content, card.summary, 'the model only sees the short summary');
    assert.equal(card.toolData.days.length, 2);
    await flush();
    assert.equal(h.state.chatCalls.length, 1);
    const { options, messages } = h.state.chatCalls[0];
    assert.equal(options.background, true);
    assert.equal(options.usageFeature, 'tool');
    assert.equal(options.usageChar, h.char);
    assert.match(messages.at(-1).content, /小雨/);
    assert.deepEqual(h.state.appended, ['带把伞吧', '别淋着']);
    assert.match(h.tools.renderCard(card), /bynd-tool-card--weather[\s\S]*明天/);
    assert.match(read('core/api/chat-api.js'), /msg\.type === 'tool_result' \? 'system'/);
    assert.ok(/key: 'tool', label: '角色工具'/.test(read('systems/usage/ledger.js')));
});

test('follow-ups respect the setting, react:false and a newer user message', async () => {
    const h = harness({ routes: weatherRoutes });
    h.tools.writeConfig({ followUp: false });
    let consumed = await h.context.consumeWechatAgentResponse(h.char, '<bynd_tool>{"name":"weather.get","city":"杭州"}</bynd_tool>');
    await consumed.afterAppend();
    h.tools.writeConfig({ followUp: true });
    consumed = await h.context.consumeWechatAgentResponse(h.char, '<bynd_tool>{"name":"weather.get","city":"杭州","react":false}</bynd_tool>');
    await consumed.afterAppend();
    await flush();
    assert.equal(h.state.chatCalls.length, 0);
    h.context.callChatApi = async (messages, options) => { h.state.chatCalls.push({ options }); h.char.history.push({ type: 'text', isMe: true, content: '算了' }); return { ok: true, content: '晚了' }; };
    assert.equal(await h.tools.followUp(h.char, ['杭州天气：小雨']), 0);
    assert.equal(h.state.appended.length, 0, 'a reaction never lands after the user moved on');
});

test('places search builds POI cards with AMap links', async () => {
    const around = [];
    const h = harness({ routes: {
        'https://restapi.amap.com/v3/geocode/geo': url => json({ status: '1', geocodes: [{ location: '120.1,30.2' }] }),
        'https://restapi.amap.com/v5/place/around': url => { around.push(new URL(url)); return json({ status: '1', pois: [{ name: '老码头火锅', location: '120.12,30.25', adname: '西湖区', address: '文三路1号', type: '餐饮服务;中餐厅;火锅店', distance: '850', business: { rating: '4.6', cost: '98', tel: [] } }] }); },
        'https://restapi.amap.com/v5/place/text': () => json({ status: '0', info: 'INVALID_USER_KEY' })
    } });
    h.tools.writeKeys({ amapKey: 'amap-key' });
    const found = await h.tools.searchPlaces({ keyword: '火锅', near: '西湖', city: '杭州' });
    assert.equal(around[0].searchParams.get('location'), '120.1,30.2');
    assert.equal(around[0].searchParams.get('key'), 'amap-key');
    assert.deepEqual(clone(found.pois[0]), { name: '老码头火锅', address: '西湖区 文三路1号', type: '火锅店', rating: 4.6, cost: 98, distance: 850, tel: '', url: 'https://uri.amap.com/marker?position=120.12,30.25&name=%E8%80%81%E7%A0%81%E5%A4%B4%E7%81%AB%E9%94%85&src=bynd&coordinate=gaode&callnative=1' });
    const outcome = await h.tools.execute(h.char, { name: 'places.search', keyword: '火锅', near: '西湖' }, {});
    assert.match(outcome.card.summary, /老码头火锅（4\.6分·人均¥98·850m）/);
    assert.match(h.tools.renderCard(outcome.card), /data-tool-url="https:\/\/uri\.amap\.com\/marker/);
    await assert.rejects(h.tools.searchPlaces({ keyword: '咖啡', city: '杭州' }), /「Web服务」/);
});

test('movies use the TMDB read token and render poster cards', async () => {
    const seen = [];
    const h = harness({ routes: { 'https://api.themoviedb.org/3/movie/now_playing': (url, options) => { seen.push({ url, auth: options.headers.Authorization }); return json({ results: [{ id: 7, title: '长安的荔枝', release_date: '2025-07-18', vote_average: 7.36, vote_count: 12, overview: '小吏送荔枝的故事', poster_path: '/p.jpg' }] }); } } });
    assert.equal(h.tools.availability('movies').ok, false);
    h.tools.writeKeys({ tmdbToken: 'eyJread-token' });
    const found = await h.tools.movies('nowPlaying');
    assert.equal(seen[0].auth, 'Bearer eyJread-token');
    assert.match(seen[0].url, /language=zh-CN/);
    assert.match(seen[0].url, /region=CN/);
    assert.deepEqual(clone(found.movies[0]), { id: 7, title: '长安的荔枝', year: '2025', rating: 7.4, overview: '小吏送荔枝的故事', poster: 'https://image.tmdb.org/t/p/w342/p.jpg', url: 'https://www.themoviedb.org/movie/7?language=zh-CN' });
    const outcome = await h.tools.execute(h.char, { name: 'movies.nowPlaying' }, {});
    assert.match(h.tools.renderCard(outcome.card), /<img src="https:\/\/image\.tmdb\.org\/t\/p\/w342\/p\.jpg"/);
});

test('the no-key Taobao card deep-links without any request, and desktop results become product cards', async () => {
    const h = harness();
    const outcome = await h.tools.execute(h.char, { name: 'shop.search', query: '保温杯 <b>', reason: '你说杯子漏水' }, {});
    assert.equal(h.state.requests.length, 0);
    assert.equal(outcome.react, '', 'a search card has nothing for the character to react to');
    assert.equal(outcome.card.toolData.url, 'https://s.taobao.com/search?q=%E4%BF%9D%E6%B8%A9%E6%9D%AF');
    assert.equal(outcome.card.toolData.appUrl, 'taobao://s.taobao.com/search?q=%E4%BF%9D%E6%B8%A9%E6%9D%AF');
    assert.match(h.tools.renderCard(outcome.card), /data-tool-app-url="taobao:\/\/s\.taobao\.com/);
    const products = h.tools.extractProducts({ content: [{ type: 'text', text: JSON.stringify({ data: { items: [{ title: '316 保温杯', price: '59.00', shopName: '某某旗舰店', pic: '//img.alicdn.com/a.jpg', itemId: '601542707852' }] } }) }] });
    assert.deepEqual(clone(products[0]), { title: '316 保温杯', price: '59.00', shop: '某某旗舰店', image: 'https://img.alicdn.com/a.jpg', url: 'https://item.taobao.com/item.htm?id=601542707852', itemId: '601542707852' });
    assert.deepEqual(clone(h.tools.taobaoCharacterTools), ['search_products', 'get_product_skus']);
    h.tools.writeConfig({ shopMode: 'card' });
    assert.match((await h.tools.execute(h.char, { name: 'shop.skus', itemId: '1' }, {})).message, /淘宝桌面版/);
});

test('MCP tools: destructive or private tools are blocked, only picked read tools run', async () => {
    const h = harness();
    const classify = (name, extra = {}, catalog = { key: 'endpoint:https://mcp.example/mcp', name: 'Docs' }) => h.tools.classifyMcpTool({ name, ...extra }, catalog).blocked;
    assert.equal(classify('delete_file'), true);
    assert.equal(classify('createIssue'), true);
    assert.equal(classify('add_to_cart'), true);
    assert.equal(classify('list_issues'), false);
    assert.equal(classify('search_docs', { annotations: { destructiveHint: true } }), true);
    const taobao = { key: 'endpoint:http://127.0.0.1:3654/mcp', name: 'taobao-native' };
    assert.equal(classify('search_products', {}, taobao), false);
    assert.equal(classify('read_page_content', {}, taobao), true);
    assert.equal(classify('get_browse_history', {}, taobao), true);

    const calls = [];
    h.context.ByndMcpBridge = {
        status: () => ({ connected: true, key: 'endpoint:https://mcp.example/mcp', name: 'Docs', tools: [{ name: 'search_docs', description: '搜索文档' }, { name: 'delete_doc', description: '删除' }, { name: 'get_page' }] }),
        ensureConnected: async () => true,
        call: async (name, args) => { calls.push([name, args]); return '找到 2 篇'; }
    };
    h.char.chatConfig.agentMcpTools = { 'endpoint:https://mcp.example/mcp': ['search_docs', 'delete_doc'] };
    assert.deepEqual(h.tools.allowedMcpTools(h.char).map(tool => tool.name), ['search_docs']);
    assert.match(h.tools.instructions(h.char), /mcp\.call[\s\S]*search_docs/);
    assert.doesNotMatch(h.tools.instructions(h.char), /delete_doc|get_page/);
    const ok = await h.tools.execute(h.char, { name: 'mcp.call', server: 'Docs', tool: 'search_docs', arguments: { q: 'x' } }, {});
    assert.equal(ok.ok, true);
    assert.deepEqual(clone(calls), [['search_docs', { q: 'x' }]]);
    await assert.rejects(h.tools.execute(h.char, { name: 'mcp.call', tool: 'delete_doc' }, {}), /没有对当前角色开放/);
    await assert.rejects(h.tools.execute(h.char, { name: 'mcp.call', tool: 'get_page' }, {}), /没有对当前角色开放/);
    assert.equal(calls.length, 1);
    assert.match(read('script.js'), /window\.ByndMcpBridge = \{/);
});

test('tool keys stay on the device: excluded from backup export and import', async () => {
    const h = addBackupModule(storageHarness({ local: [], entries: {
        bynd_tool_keys_v1: JSON.stringify({ amapKey: 'secret-amap', tmdbToken: 'secret-tmdb' }),
        bynd_tool_config_v1: JSON.stringify({ city: '杭州' })
    } }));
    await h.context.loadCharactersFromStorage();
    const backup = await h.context.buildByndBackupData();
    assert.equal(Object.prototype.hasOwnProperty.call(backup, 'bynd_tool_keys_v1'), false);
    assert.doesNotMatch(JSON.stringify(backup), /secret-amap|secret-tmdb/);
    assert.deepEqual(clone(backup.bynd_tool_config_v1), { city: '杭州' });
    assert.match(read('apps/settings/settings.js'), /key !== \(window\.ByndCharacterTools\?\.secretStorageKey \|\| 'bynd_tool_keys_v1'\)/);
    assert.doesNotMatch(read('apps/wechat/character/character-tools.js'), /console\.\w+\([^)]*(?:amapKey|tmdbToken|readKeys)/, 'keys are never logged');
});
