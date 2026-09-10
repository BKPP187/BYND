const assert = require('node:assert/strict');
const test = require('node:test');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const { root, clone, sourceSection, memoryStorage, deferred } = require('./helpers/harness.cjs');

const escapeHtml = value => String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const card = (name = '林舟') => ({ name, description: '温柔慢热的书店老板，是用户的旧友。', firstMessage: '好久不见，进来坐。', worldBook: [{ keys: ['书店'], comment: '旧书店', content: '店在河边，每周二休息。' }] });
function harness() {
    const char = { id: 'role-a', name: '林舟', chatConfig: {}, history: [{ type: 'text', isMe: true, content: '你好', timestamp: 101 }] };
    const state = { saves: 0, saved: null, saveResult: () => true, notices: [], requests: [], renders: 0 };
    const nodes = new Map();
    const settings = { dataset: { charId: char.id }, querySelectorAll: () => [] };
    nodes.set('wcs-agent-features', settings);
    const sandbox = {
        myCharacters: [char], currentChatCharId: char.id,
        localStorage: memoryStorage(), sessionStorage: memoryStorage(),
        console: { log() {}, warn() {}, error() {} }, URL, Blob, Response, AbortController, setTimeout, clearTimeout,
        document: {
            getElementById: id => nodes.get(id) || null,
            createElement: tag => ({ tagName: tag, dataset: {}, innerHTML: '', addEventListener() {} })
        },
        wcEscapeHtml: escapeHtml, DEFAULT_AVATAR: 'avatar',
        refreshChatView: () => { state.renders++; },
        renderChatList() {}, createMessageTimestamp: () => Date.now(),
        showWechatToast: message => state.notices.push(message),
        saveCharactersToStorage: async () => {
            const value = await state.saveResult(++state.saves);
            if (value !== false) state.saved = clone(sandbox.myCharacters);
            return value;
        },
        fetch: async (url, options) => { state.requests.push({ url, options }); return new Response(JSON.stringify({ data: [{ id: 'openclaw/bynd-role-a' }] }), { status: 200 }); }
    };
    sandbox.window = sandbox;
    const context = vm.createContext(sandbox);
    for (const module of ['agent-tools', 'character-generator', 'openclaw-settings']) vm.runInContext(fs.readFileSync(path.join(root, 'modules/wechat/' + module + '.js'), 'utf8'), context);
    context.renderWechatAgentSettings = () => {};
    function connectionForm(values = {}) {
        const fields = Object.fromEntries(Object.entries({ endpoint: '', agentId: 'bynd-role-a', accountId: '', token: '', ...values }).map(([key, value]) => [key, { value, disabled: false }]));
        const status = { textContent: '', dataset: {} };
        const form = {
            isConnected: true, dataset: { charId: char.id },
            querySelector: selector => selector === '.bynd-openclaw-status' ? status : fields[selector.match(/name="(\w+)"/)?.[1]] || null,
            querySelectorAll: () => Object.values(fields)
        };
        nodes.set('bynd-openclaw-settings', form);
        return { fields, form, status };
    }
    return { context, state, char, nodes, settings, connectionForm };
}

test('agent permissions are role-scoped and failed writes restore the toggle', async () => {
    const h = harness();
    const other = { id: 'other', chatConfig: {} };
    h.context.myCharacters.push(other);
    const input = { checked: true, disabled: false };
    assert.equal(h.context.getWechatAgentPreferences(h.char).allowTodos, false);
    assert.equal(await h.context.setWechatAgentPreference('allowTodos', true, input), true);
    assert.equal(h.context.getWechatAgentPreferences(h.char).allowTodos, true);
    assert.equal(h.context.getWechatAgentPreferences(other).allowTodos, false);
    h.state.saveResult = () => false;
    input.checked = false;
    assert.equal(await h.context.setWechatAgentPreference('allowTodos', false, input), false);
    assert.equal(input.checked, true);
    assert.equal(input.disabled, false);
    assert.equal(h.context.getWechatAgentPreferences(h.char).allowTodos, true);
    assert.match(h.state.notices.at(-1), /保存失败/);
});

test('public summaries are opt-in, separated from visible content, and truncated control blocks never execute', async () => {
    const h = harness();
    const raw = '<bynd_summary>先回应近况，再确认约定。</bynd_summary>我们周末去吧。';
    assert.deepEqual(clone(await h.context.consumeWechatAgentResponse(h.char, raw)), { content: '我们周末去吧。', summary: '', toolCount: 0 });
    h.char.chatConfig.agentPreferences = { showThinking: true, allowTodos: true };
    const visible = await h.context.consumeWechatAgentResponse(h.char, raw);
    assert.equal(visible.summary, '先回应近况，再确认约定。');
    const broken = await h.context.consumeWechatAgentResponse(h.char, '收到。<bynd_tool>{"name":"todo.add","title":"不执行"}');
    assert.equal(broken.content, '收到。');
    assert.equal(broken.toolCount, 0);
    assert.equal(h.char.chatConfig.agentTodos, undefined);
    assert.match(h.context.buildWechatAgentInstructions(h.char), /可公开/);
    assert.match(h.context.buildWechatAgentInstructions(h.char), /不会自动向系统推送提醒/);
});

test('todo tools perform actual role-scoped operations, deduplicate retries and show real list data', async () => {
    const h = harness();
    h.char.chatConfig.agentPreferences = { allowTodos: true };
    const raw = '<bynd_tool>{"name":"todo.add","title":"周二还书","note":"带上借书卡"}</bynd_tool>记下了。';
    const first = await h.context.consumeWechatAgentResponse(h.char, raw);
    await h.context.consumeWechatAgentResponse(h.char, raw);
    assert.equal(first.content, '记下了。');
    assert.equal(h.char.chatConfig.agentTodos.length, 1);
    assert.equal(h.char.chatConfig.agentTodos[0].title, '周二还书');
    assert.equal(h.char.chatConfig.agentActivity.length, 2);
    assert.equal(h.char.history.length, 1, 'tool records never alter chat turn counts');
    const list = await h.context.consumeWechatAgentResponse(h.char, '<bynd_tool>{"name":"todo.list"}</bynd_tool>模型可能猜了其他待办');
    assert.equal(list.content, '周二还书');
    assert.ok(h.char.chatConfig.agentActivity.every(event => event.state === 'success' && event.anchorTimestamp === 101));
    assert.equal(h.state.saved[0].chatConfig.agentTodos.length, 1);
});

test('denied, unknown and invalid tools cannot mutate todos or report success', async () => {
    for (const [allowed, command] of [[false, { name: 'todo.add', title: '关闭权限' }], [true, { name: 'files.delete', path: '/anything' }], [true, { name: 'todo.add', title: '' }], [true, null]]) {
        const h = harness();
        h.char.chatConfig.agentPreferences = { allowTodos: allowed };
        const result = await h.context.consumeWechatAgentResponse(h.char, '<bynd_tool>' + JSON.stringify(command) + '</bynd_tool>已经完成了。');
        assert.equal(h.char.chatConfig.agentTodos, undefined);
        assert.equal(h.char.chatConfig.agentActivity.at(-1).state, 'error');
        assert.doesNotMatch(result.content, /已经完成/);
        assert.equal(result.toolCount, 1);
    }
});

test('failed todo persistence removes only the new item and a tool-only failure stays visible', async () => {
    const h = harness();
    h.char.chatConfig.agentPreferences = { allowTodos: true, showTools: false };
    h.state.saveResult = count => {
        if (count === 1) h.char.chatConfig.agentTodos.push({ id: 'later', title: '另一个操作' });
        return false;
    };
    const result = await h.context.consumeWechatAgentResponse(h.char, '<bynd_tool>{"name":"todo.add","title":"失败项目"}</bynd_tool>');
    assert.deepEqual(clone(h.char.chatConfig.agentTodos).map(todo => todo.id), ['later']);
    assert.match(result.content, /保存失败/);
    assert.equal(h.char.chatConfig.agentActivity[0].state, 'error');
    assert.equal(h.char.chatConfig.agentActivity[0].unsaved, true);
});

test('clearing completed todos frees capacity without removing pending tasks or swallowing save failures', async () => {
    const h = harness();
    h.char.chatConfig.agentTodos = [{ id: 'done', title: '已完成', done: true }, { id: 'pending', title: '待完成', done: false }];
    h.state.saveResult = () => false;
    assert.equal(await h.context.clearCompletedWechatAgentTodos(), false);
    assert.deepEqual(clone(h.char.chatConfig.agentTodos).map(todo => todo.id), ['done', 'pending']);
    h.state.saveResult = () => true;
    assert.equal(await h.context.clearCompletedWechatAgentTodos(), true);
    assert.deepEqual(clone(h.char.chatConfig.agentTodos).map(todo => todo.id), ['pending']);
});

test('tool logs escape content, retain collapse state, and interrupted records never pretend to be running', () => {
    const h = harness();
    h.char.chatConfig.agentPreferences = { showThinking: true };
    h.char.chatConfig.agentActivity = [{ id: 'restored', title: '<img onerror=evil>', input: '<script>bad</script>', state: 'running', anchorTimestamp: 101 }];
    const rows = [];
    const container = { appendChild: node => rows.push(node) };
    h.context.rememberWechatAgentDetails('role-a:thought:101', true);
    h.context.renderWechatAgentExtras(container, h.char, { timestamp: 101, thinkingSummary: '<b>回应摘要</b>' });
    assert.equal(rows.length, 2);
    assert.equal(rows[0].open, true);
    assert.equal(rows[1].open, false);
    assert.match(rows[1].innerHTML, /已中断/);
    assert.doesNotMatch(rows[1].innerHTML, /<img|<script>/);
    assert.match(rows[1].innerHTML, /&lt;img/);
});

test('character normalization accepts valid world books and drops privileged model fields', () => {
    const h = harness();
    const value = card();
    value.worldBook.push(null, 7, []);
    value.chatConfig = { agentPreferences: { allowTodos: true }, apiKey: 'do-not-copy' };
    value.regex = [{ script: 'dangerous' }];
    const result = h.context.normalizeWechatGeneratedCharacterCard(value);
    assert.equal(result.worldBook.length, 1);
    assert.equal(result.chatConfig, undefined);
    assert.equal(result.regex, undefined);
    for (const bad of [null, [], { ...card(), name: '' }, { ...card(), description: '' }, { ...card(), worldBook: [null] }]) assert.throws(() => h.context.normalizeWechatGeneratedCharacterCard(bad));
});

test('character creation merges duplicate save clicks and later edits keep the same contact and history', async () => {
    const h = harness();
    const gate = deferred();
    h.state.saveResult = () => gate.promise;
    const draft = { id: 'draft-a' };
    const first = h.context.saveWechatGeneratedCharacterCard(card(), draft);
    const second = h.context.saveWechatGeneratedCharacterCard(card(), draft);
    assert.equal(first, second);
    await new Promise(setImmediate);
    assert.equal(draft.createdContactId, undefined, 'pending writes are not reported as saved');
    gate.resolve(true);
    const result = await first;
    assert.equal(result.created, true);
    assert.equal(h.context.myCharacters.length, 2);
    assert.equal(h.state.saves, 1);
    assert.equal(result.char.worldBook[0].content, card().worldBook[0].content);
    assert.equal(result.char.history[0].content, card().firstMessage);
    const history = result.char.history;
    h.state.saveResult = () => true;
    const update = await h.context.saveWechatGeneratedCharacterCard(card('林洲'), draft);
    assert.equal(update.created, false);
    assert.equal(update.char.id, result.char.id);
    assert.equal(update.char.history, history);
    assert.equal(h.context.myCharacters.length, 2);
    assert.equal(update.char.name, '林洲');
});

test('character save failure rolls back its contact, allows retry and preserves existing data on an edit failure', async () => {
    const h = harness();
    const draft = { id: 'draft-failure' };
    h.state.saveResult = () => false;
    await assert.rejects(h.context.saveWechatGeneratedCharacterCard(card(), draft), /未能保存/);
    assert.equal(h.context.myCharacters.length, 1);
    assert.equal(draft.createdContactId, undefined);
    h.state.saveResult = () => true;
    const { char } = await h.context.saveWechatGeneratedCharacterCard(card(), draft);
    char.history.push({ content: '已有互动', timestamp: 102 });
    h.state.saveResult = () => false;
    await assert.rejects(h.context.saveWechatGeneratedCharacterCard(card('新名字'), draft));
    assert.equal(char.name, '林舟');
    assert.equal(char.history.at(-1).content, '已有互动');
    assert.equal(h.context.myCharacters.length, 2);
});

test('a post-save character list failure cannot turn a saved contact into a failed creation', async () => {
    const h = harness();
    h.context.renderChatList = () => { throw new Error('view failed'); };
    const draft = { id: 'saved-contact' };
    const result = await h.context.saveWechatGeneratedCharacterCard(card(), draft);
    assert.equal(draft.createdContactId, result.char.id);
    assert.equal(h.state.saved.length, 2);
});

test('OpenClaw settings validate endpoints and IDs without accepting embedded credentials', () => {
    const h = harness();
    const normalize = h.context.normalizeWechatOpenClawBinding;
    assert.equal(normalize({ endpoint: 'https://private.example/v1/chat/completions/', agentId: 'role' }).endpoint, 'https://private.example');
    assert.equal(normalize({ endpoint: 'http://127.0.0.1:18789', agentId: 'role' }).endpoint, 'http://127.0.0.1:18789');
    assert.equal(normalize({ agentId: 'role' }).endpoint, '');
    for (const endpoint of ['javascript:alert(1)', 'http://public.example', 'https://name:password@example.test', 'https://example.test?token=secret', 'https://example.test/#hash']) assert.throws(() => normalize({ endpoint, agentId: 'role' }));
    for (const agentId of ['', '../role', 'Role', '<x>', 'a'.repeat(65)]) assert.throws(() => normalize({ agentId }));
});

test('OpenClaw saves only local binding data, isolates session credentials and rolls back failed changes', async () => {
    const h = harness();
    const { fields, status } = h.connectionForm({ token: 'SESSION-SECRET' });
    assert.equal(await h.context.saveWechatOpenClawBinding(), true);
    assert.match(status.textContent, /等待部署/);
    assert.equal(h.char.chatConfig.openClawBinding.agentId, 'bynd-role-a');
    assert.doesNotMatch(JSON.stringify(h.state.saved), /SESSION-SECRET|token|connected/);
    assert.equal(h.context.localStorage.length, 0);
    assert.match(h.context.sessionStorage.getItem('bynd_openclaw_session_v1:role-a'), /SESSION-SECRET/);
    h.state.saveResult = () => false;
    fields.agentId.value = 'changed';
    fields.token.value = 'NEW-SECRET';
    assert.equal(await h.context.saveWechatOpenClawBinding(), false);
    assert.equal(h.char.chatConfig.openClawBinding.agentId, 'bynd-role-a');
    assert.doesNotMatch(h.context.sessionStorage.getItem('bynd_openclaw_session_v1:role-a'), /NEW-SECRET/);
    assert.match(status.textContent, /未能保存/);
    assert.equal(await h.context.removeWechatOpenClawBinding(), false);
    assert.ok(h.char.chatConfig.openClawBinding);
    h.state.saveResult = () => true;
    assert.equal(await h.context.removeWechatOpenClawBinding(), true);
    assert.equal(h.char.chatConfig.openClawBinding, undefined);
    assert.equal(h.context.sessionStorage.length, 0);
});

test('OpenClaw connection tests read models, verify the target agent, and never send a chat or claim WeChat login', async () => {
    const h = harness();
    const { status } = h.connectionForm({ endpoint: 'https://private.example', token: 'SESSION-SECRET' });
    assert.equal(await h.context.testWechatOpenClawConnection(), true);
    assert.equal(h.state.requests.length, 1);
    assert.equal(h.state.requests[0].url, 'https://private.example/v1/models');
    assert.equal(h.state.requests[0].options.method, 'GET');
    assert.equal(h.state.requests[0].options.credentials, 'omit');
    assert.equal(h.state.requests[0].options.redirect, 'error');
    assert.match(status.textContent, /仍需在网关确认/);
    assert.equal(h.state.saves, 0);
    h.context.fetch = async () => new Response(JSON.stringify({ data: [{ id: 'openclaw/someone-else' }] }), { status: 200 });
    assert.equal(await h.context.testWechatOpenClawConnection(), false);
    assert.match(status.textContent, /未找到/);
    h.context.fetch = async () => new Response('error echoes SESSION-SECRET', { status: 401 });
    assert.equal(await h.context.testWechatOpenClawConnection(), false);
    assert.match(status.textContent, /鉴权/);
    assert.doesNotMatch(status.textContent, /SESSION-SECRET/);
    h.context.fetch = async () => { throw new Error('failed SESSION-SECRET'); };
    assert.equal(await h.context.testWechatOpenClawConnection(), false);
    assert.doesNotMatch(status.textContent, /SESSION-SECRET/);
});

test('a saved OpenClaw binding is not rolled back when settings rendering fails', async () => {
    const h = harness();
    h.connectionForm();
    h.context.renderWechatAgentSettings = () => { throw new Error('view failed'); };
    assert.equal(await h.context.saveWechatOpenClawBinding(), true);
    assert.equal(h.char.chatConfig.openClawBinding.agentId, 'bynd-role-a');
    assert.equal(h.state.saved[0].chatConfig.openClawBinding.agentId, 'bynd-role-a');
    assert.equal(await h.context.removeWechatOpenClawBinding(), true);
    assert.equal(h.char.chatConfig.openClawBinding, undefined);
});

test('OpenClaw deployment export whitelists data, excludes chat and secrets, and uses the official agent routing shape', () => {
    const h = harness();
    Object.assign(h.char, card());
    h.char.chatConfig.secret = 'PRIVATE';
    h.context.sessionStorage.setItem('bynd_openclaw_session_v1:role-a', 'SESSION-SECRET');
    const exported = h.context.buildWechatOpenClawSetup(h.char, { endpoint: 'https://private.example', agentId: 'bynd-role-a', accountId: 'wx_account' });
    assert.equal(exported.configPatch.agents.entries['bynd-role-a'].workspace, '~/.openclaw/workspace-bynd-role-a');
    assert.equal(exported.configPatch.bindings[0].match.channel, 'openclaw-weixin');
    assert.equal(exported.configPatch.bindings[0].agentId, 'bynd-role-a');
    assert.equal(exported.character.worldBook.length, 1);
    assert.doesNotMatch(JSON.stringify(exported), /PRIVATE|SESSION-SECRET|"history"|"token"/);
    assert.match(exported.status, /no remote binding/);
});

test('generated images reach the gallery after persistence; permission and storage failures finish without false success', async () => {
    for (const mode of ['ok', 'denied', 'save-failed', 'album-failed', 'api-failed']) {
        const h = harness();
        const msg = { type: 'image', isMe: false, imagePending: true, imagePrompt: '河边书店', timestamp: 102 };
        h.char.history.push(msg);
        let requests = 0;
        let album = 0;
        h.char.chatConfig.agentPreferences = { allowImages: mode !== 'denied' };
        h.context.getWechatImageReferenceForChar = () => '';
        h.context.buildWechatCharacterImagePrompt = () => 'picture';
        h.context.callWechatImageGenerationApi = async () => { requests++; return mode === 'api-failed' ? { ok: false, error: 'API 失败' } : { ok: true, url: 'https://example.test/generated.jpg' }; };
        h.context.recordWechatGeneratedImageToAlbum = async () => { album++; if (mode === 'album-failed') throw new Error('相册保存失败'); return true; };
        if (mode === 'save-failed') h.state.saveResult = () => false;
        vm.runInContext(sourceSection('wechat.js', 'async function resolveWechatAiGeneratedImage(', 'function selectWechatShopPayer('), h.context);
        await h.context.resolveWechatAiGeneratedImage(h.char, msg);
        assert.equal(requests, mode === 'denied' ? 0 : 1);
        assert.equal(album, ['ok', 'album-failed'].includes(mode) ? 1 : 0);
        assert.equal(msg.imagePending, false);
        assert.equal(msg.imageResolving, undefined);
        assert.equal(h.char.chatConfig.agentActivity.at(-1).state, mode === 'ok' ? 'success' : 'error');
        if (mode.endsWith('failed')) assert.ok(h.state.notices.length);
    }
});

test('memory permission stops automatic extraction before any API or scheduling while explicit manual use remains available', async () => {
    const h = harness();
    h.char.chatConfig.agentPreferences = { allowMemory: false };
    let accessedStore = 0;
    h.context.callChatApi = async () => ({ ok: true });
    h.context.isWechatBackgroundApiPaused = () => false;
    h.context.getWechatMemoryStore = () => { accessedStore++; return {}; };
    h.context.getWechatMemoryBucket = () => ({ meta: {} });
    h.context.getWechatMemoryConfig = () => ({ extractEvery: 5 });
    h.context.buildWechatMemoryExtractionTranscript = () => [];
    vm.runInContext(sourceSection('wechat.js', 'function scheduleWechatMemoryExtraction(', 'function maybeCaptureWechatMemoryCommand('), h.context);
    h.context.scheduleWechatMemoryExtraction(h.char);
    assert.equal(await h.context.requestWechatMemoryExtraction(h.char, 'after_reply'), null);
    assert.equal(accessedStore, 0);
    await h.context.requestWechatMemoryExtraction(h.char, 'manual');
    assert.equal(accessedStore, 1);
});
