'use strict';
const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'apps/games/acting.js'), 'utf8');
const key = 'acting-test';
const script = () => ({
    title: '雨夜电台', genre: '悬疑', premise: '一封信让两人走进旧电台。',
    userRole: { name: '听众' }, charRole: { name: '播音员' },
    scenes: [{ title: '来信', narration: '雨敲着窗。', charLine: '你也收到那封信了？', userCue: '回答他。' }]
});
const escape = value => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function harness(realApi = false) {
    const store = new Map([[key, JSON.stringify({ phase: 'select', selectedCharId: 'cast-1' })]]);
    const char = { id: 'cast-1', name: '江闻远', description: '克制温和的播音员', history: [] };
    const state = { requests: [], notices: [], writes: [], failWrite: () => false, respond: () => ({ ok: true, content: JSON.stringify(script()) }) };
    const content = { innerHTML: '' };
    const input = { value: '', focus() {} };
    const status = { textContent: '', setAttribute() {} };
    const context = vm.createContext({
        window: {}, console: { warn() {}, error() {}, log() {} },
        ACTING_GAME_STATE_KEY: key, Response, AbortSignal,
        localStorage: {
            getItem: name => store.get(name) || null,
            setItem(name, value) {
                if (state.failWrite(JSON.parse(value))) throw new Error('模拟写入失败');
                state.writes.push(JSON.parse(value)); store.set(name, value);
            },
            removeItem: name => store.delete(name)
        },
        document: { getElementById: name => name === 'game-content' ? content : name === 'acting-user-line' ? input : name === 'acting-line-status' ? status : null },
        getWolfchaCharacters: () => [char], getMusicCharName: value => value.name,
        getUserProfile: () => ({ name: '用户' }), musicEscapeHtml: escape, musicEscapeAttr: escape,
        showWechatToast: text => state.notices.push(text),
        renderGameApp: () => context.renderActingGame(content),
        callChatApi: async (messages, options) => {
            state.requests.push({ messages, options });
            return state.respond();
        },
        getDefaultApi: () => ({ baseUrl: 'https://example.invalid/v1', model: 'test' }),
        getActivePreset: () => ({ temperature: 1.8, max_tokens: 64, frequency_penalty: 1.5 }),
        fetch: async (_url, options) => {
            state.requests.push(JSON.parse(options.body));
            const result = state.respond();
            return new Response(JSON.stringify({ choices: [{ message: { content: result.content }, finish_reason: result.finishReason || 'stop' }] }), { status: 200 });
        }
    });
    if (realApi) vm.runInContext(fs.readFileSync(path.join(root, 'core/api/chat-api.js'), 'utf8'), context);
    vm.runInContext(source, context);
    return { context, state, content, store, input, status };
}

test('script parser accepts prose, fences, literal string newlines and trailing commas without altering quoted punctuation', () => {
    const { context } = harness();
    const raw = '说明 {不是 JSON}\n```json\n{"title":"雨夜", "scenes":[{"narration":"第一行\n第二行，}，", "charLine":"他说：\\"{你好}\\"",},],}\n```\n结束。';
    const data = context.extractActingJsonPayload(raw);
    assert.equal(data.title, '雨夜');
    assert.equal(data.scenes[0].narration, '第一行\n第二行，}，');
    assert.equal(data.scenes[0].charLine, '他说："{你好}"');
    assert.equal(context.extractActingJsonPayload('{"scenes":[{"narration":"半句'), null);
    assert.equal(context.extractActingJsonPayload('普通台词，没有对象'), null);
    assert.equal(context.extractActingJsonPayload('{"question":"你喜欢什么？"}').question, '你喜欢什么？');
});

test('valid complete script is saved with a game-specific output budget independent of chat presets', async () => {
    const { context, state } = harness(true);
    await context.generateActingScript();
    assert.equal(context.getActingGameState().phase, 'roleFile');
    assert.equal(state.requests.length, 1);
    assert.equal(state.requests[0].max_tokens, 6000);
    assert.equal(state.requests[0].temperature, 0.7);
    assert.equal(state.requests[0].frequency_penalty, undefined);
});

test('malformed script gets one repair with original context and then saves the real repaired script', async () => {
    const { context, state } = harness();
    state.respond = () => state.requests.length === 1
        ? { ok: true, content: '剧本：雨夜电台。角色收到一封来信。' }
        : { ok: true, content: JSON.stringify(script()) };
    await context.generateActingScript();
    assert.equal(state.requests.length, 2);
    assert.equal(context.getActingGameState().phase, 'roleFile');
    assert.equal(context.getActingGameState().script.title, '雨夜电台');
    assert.match(state.requests[1].messages[1].content, /克制温和的播音员/);
    assert.match(state.requests[1].messages.at(-1).content, /修复格式/);
});

test('truncated JSON uses a complete repair instead of generic prose continuation', async () => {
    const { context, state } = harness(true);
    state.respond = () => state.requests.length === 1
        ? { content: '{"title":"雨夜", "scenes":[', finishReason: 'length' }
        : { content: JSON.stringify(script()) };
    await context.generateActingScript();
    assert.equal(state.requests.length, 2);
    assert.match(state.requests[1].messages.at(-1).content, /重新输出整个 JSON/);
    assert.equal(context.getActingGameState().phase, 'roleFile');
});

test('still-invalid repaired output remains an error and never creates fallback scenes', async () => {
    const { context, state, content } = harness();
    state.respond = () => ({ ok: true, content: '{"title":"空剧本","scenes":[]}' });
    await context.generateActingScript();
    assert.equal(state.requests.length, 2);
    assert.equal(context.getActingGameState().phase, 'select');
    assert.equal(context.getActingGameState().script, undefined);
    assert.match(content.innerHTML, /一次格式修复后仍未/);
    assert.equal(state.writes.some(value => value.phase === 'roleFile'), false);
});

test('persistent truncation reports the output limit specifically', async () => {
    const { context, state } = harness();
    state.respond = () => ({ ok: true, content: '{"title":', finishReason: 'length' });
    await context.generateActingScript();
    assert.equal(state.requests.length, 2);
    assert.match(context.getActingGameState().error, /输出被截断/);
});

test('provider failure during repair retains the actual 429 error and never reports success', async () => {
    const { context, state } = harness();
    state.respond = () => state.requests.length === 1
        ? { ok: true, content: '不是 JSON' }
        : { ok: false, error: 'API 错误 (429): rate limit exceeded' };
    await context.generateActingScript();
    assert.equal(state.requests.length, 2);
    assert.match(context.getActingGameState().error, /格式修复失败.*429/);
    assert.equal(context.getActingGameState().phase, 'select');
});

test('initial API failure is surfaced directly without an unnecessary repair', async () => {
    const { context, state } = harness();
    state.respond = () => ({ ok: false, error: 'API 错误 (500): upstream unavailable' });
    await context.generateActingScript();
    assert.equal(state.requests.length, 1);
    assert.match(context.getActingGameState().error, /500/);
});

test('saving a completed script can fail without showing the success view', async () => {
    const { context, state, content } = harness();
    state.failWrite = value => value.phase === 'roleFile';
    await context.generateActingScript();
    assert.equal(context.getActingGameState().phase, 'select');
    assert.match(content.innerHTML, /模拟写入失败/);
    assert.equal(state.writes.some(value => value.phase === 'roleFile'), false);
});

test('complete storage failure shows an error directly and allows a retry after storage recovers', async () => {
    const { context, state, content } = harness();
    state.failWrite = () => true;
    await context.generateActingScript();
    assert.equal(state.requests.length, 0);
    assert.match(content.innerHTML, /状态未保存/);
    assert.match(state.notices[0], /生成失败/);
    state.failWrite = () => false;
    await context.generateActingScript();
    assert.equal(context.getActingGameState().phase, 'roleFile');
});

test('repeated taps while generating do not send duplicate requests', async () => {
    const { context, state } = harness();
    let resolve;
    state.respond = () => new Promise(done => { resolve = done; });
    const pending = context.generateActingScript();
    await context.generateActingScript();
    assert.equal(state.requests.length, 1);
    resolve({ ok: true, content: JSON.stringify(script()) });
    await pending;
    assert.equal(context.getActingGameState().phase, 'roleFile');
});

test('a failed line write retains the draft and transcript and reports failure without success', async () => {
    const { context, state, input, status } = harness();
    context.saveActingGameState({ phase: 'stage', selectedCharId: 'cast-1', script: script(), userLines: [], sceneIndex: 0 });
    input.value = '我也收到了一封信。';
    state.failWrite = () => true;
    await context.submitActingUserLine();
    assert.equal(context.getActingGameState().userLines.length, 0);
    assert.equal(input.value, '我也收到了一封信。');
    assert.match(status.textContent, /台词没有保存/);
    assert.deepEqual(state.notices, ['台词没有保存：模拟写入失败']);
    state.failWrite = () => false;
    state.respond = () => ({ ok: true, content: JSON.stringify({ scene: script().scenes[0] }) });
    await context.submitActingUserLine();
    assert.equal(context.getActingGameState().userLines.length, 1);
    assert.equal(context.getActingGameState().draft, '');
    assert.equal(context.getActingGameState().sceneIndex, 1);
});

test('opening creates only the first act even if the provider sends an entire script', async () => {
    const { context, state, content } = harness();
    const full = script();
    full.scenes.push({ title: '预写的结局', narration: '提前结束', charLine: '再见' });
    state.respond = () => ({ ok: true, content: JSON.stringify(full) });
    await context.generateActingScript();
    assert.equal(context.getActingGameState().script.scenes.length, 1);
    assert.match(state.requests[0].messages[0].content, /不要预写后续场景/);
    assert.doesNotMatch(content.innerHTML, /共 1 幕/);
});

async function stageHarness() {
    const h = harness();
    await h.context.generateActingScript();
    h.context.enterActingStage();
    h.state.requests.length = 0;
    h.state.respond = () => ({ ok: true, content: JSON.stringify({ scene: { ...script().scenes[0], title: '你的选择改变了来信', charLine: '那么，我们把信烧掉。' } }) });
    return h;
}

test('each submitted line generates just one new act using the real performance history', async () => {
    const { context, state, input, content } = await stageHarness();
    input.value = '我不想拆信，我要把它烧掉。';
    await context.advanceActingScene();
    let saved = context.getActingGameState();
    assert.equal(saved.sceneIndex, 1);
    assert.equal(saved.script.scenes.length, 2);
    assert.equal(saved.userLines[0].text, input.value);
    assert.equal(saved.script.scenes[1].charLine, '那么，我们把信烧掉。');
    assert.match(state.requests[0].messages[1].content, /我要把它烧掉/);
    assert.equal(state.requests[0].options.max_tokens, 2000);
    assert.match(content.innerHTML, /第 2 幕 · 即兴进行中/);
    assert.doesNotMatch(content.innerHTML, /共 2 幕/);
    input.value = '烧完以后，带我去找寄信的人。';
    await context.submitActingUserLine();
    saved = context.getActingGameState();
    assert.equal(saved.phase, 'stage');
    assert.equal(saved.script.scenes.length, 3);
    assert.match(state.requests[1].messages[1].content, /我要把它烧掉/);
    assert.match(state.requests[1].messages[1].content, /那么，我们把信烧掉/);
    assert.match(state.requests[1].messages[1].content, /找寄信的人/);
});

test('next act requires an answer; ending is explicit and uses the final draft', async () => {
    const { context, state, input } = await stageHarness();
    await context.advanceActingScene();
    assert.equal(state.requests.length, 0);
    input.value = '我想留在这里陪你。';
    await context.finishActingPerformance();
    const saved = context.getActingGameState();
    assert.equal(saved.phase, 'ending');
    assert.equal(saved.script.scenes.length, 1);
    assert.equal(saved.userLines.length, 1);
    assert.equal(saved.closing.charLine, '那么，我们把信烧掉。');
    assert.match(state.requests[0].messages[0].content, /用户选择在此落幕/);
    assert.match(state.requests[0].messages[1].content, /留在这里陪你/);
});

test('continuation failure retains draft and act; retry commits the answer exactly once', async () => {
    const { context, state, input, content } = await stageHarness();
    input.value = '我先去窗边看看。';
    state.respond = () => ({ ok: false, error: 'API 错误 (503)' });
    await context.submitActingUserLine();
    let saved = context.getActingGameState();
    assert.equal(saved.sceneIndex, 0);
    assert.equal(saved.script.scenes.length, 1);
    assert.equal(saved.userLines.length, 0);
    assert.equal(saved.draft, input.value);
    assert.match(content.innerHTML, /503/);
    assert.match(content.innerHTML, /我先去窗边看看/);
    assert.equal(state.requests.length, 1);
    state.respond = () => ({ ok: true, content: JSON.stringify({ scene: script().scenes[0] }) });
    await context.submitActingUserLine();
    saved = context.getActingGameState();
    assert.equal(saved.userLines.length, 1);
    assert.equal(saved.sceneIndex, 1);
    assert.equal(saved.draft, '');
});

test('continuation repairs malformed JSON once and reports invalid repair without inventing acts', async () => {
    const { context, state, input } = await stageHarness();
    input.value = '把来信交给我。';
    state.respond = () => ({ ok: true, content: '{"scene":{}}' });
    await context.submitActingUserLine();
    assert.equal(state.requests.length, 2);
    assert.equal(context.getActingGameState().sceneIndex, 0);
    assert.equal(context.getActingGameState().userLines.length, 0);
    assert.match(context.getActingGameState().error, /一次格式修复/);
    state.requests.length = 0;
    state.respond = () => state.requests.length === 1 ? { ok: true, content: '回应没有 JSON' }
        : { ok: true, content: JSON.stringify({ scene: script().scenes[0] }) };
    await context.submitActingUserLine();
    assert.equal(state.requests.length, 2);
    assert.equal(context.getActingGameState().sceneIndex, 1);
});

test('failure to save the generated act leaves both draft and performance uncommitted', async () => {
    const { context, state, input, content } = await stageHarness();
    input.value = '我现在就拆开。';
    state.failWrite = value => value.sceneIndex === 1;
    await context.submitActingUserLine();
    assert.equal(context.getActingGameState().sceneIndex, 0);
    assert.equal(context.getActingGameState().userLines.length, 0);
    assert.equal(context.getActingGameState().draft, input.value);
    assert.match(content.innerHTML, /模拟写入失败/);
    assert.deepEqual(state.notices, []);
});

test('old saves discard unread prewritten acts without removing the performed transcript', async () => {
    const { context, state, input } = await stageHarness();
    const saved = context.getActingGameState();
    saved.script.scenes.push({ title: '提前写好的结局', narration: '剧透', charLine: '结束' });
    saved.userLines = [{ sceneIndex: 0, text: '已经说过的台词' }];
    context.saveActingGameState(saved);
    input.value = '我要一个不同的方向。';
    await context.submitActingUserLine();
    assert.doesNotMatch(state.requests[0].messages[1].content, /提前写好的结局/);
    assert.match(state.requests[0].messages[1].content, /已经说过的台词/);
    assert.equal(context.getActingGameState().userLines.length, 2);
    assert.equal(context.getActingGameState().script.scenes.length, 2);
});

test('pending continuation ignores duplicate taps and a late reply cannot resurrect a reset game', async () => {
    const { context, state, input, content } = await stageHarness();
    input.value = '我要离开。';
    let resolve;
    state.respond = () => new Promise(done => { resolve = done; });
    const pending = context.submitActingUserLine();
    assert.match(content.innerHTML, /正在接戏/);
    await context.advanceActingScene();
    await context.finishActingPerformance();
    assert.equal(state.requests.length, 1);
    context.resetActingGame();
    resolve({ ok: true, content: JSON.stringify({ scene: script().scenes[0] }) });
    await pending;
    assert.equal(context.getActingGameState(), null);
    assert.match(content.innerHTML, /下一场戏/);
});
