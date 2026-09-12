const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { root, sourceSection, deferred } = require('./helpers/harness.cjs');

const png = 'data:image/png;base64,aGVsbG8=';
function assetDatabase(data, state) {
    return { close() {}, transaction() {
        const tx = {};
        let ended = false, scheduled = false;
        const deletes = [];
        const finish = () => {
            if (scheduled) return;
            scheduled = true;
            setImmediate(() => {
                if (ended) return;
                ended = true;
                if (deletes.length && state.failDelete) { tx.error = new Error('delete transaction aborted'); tx.onabort?.(); return; }
                deletes.forEach(key => data.delete(key));
                tx.oncomplete?.();
            });
        };
        tx.abort = () => { ended = true; queueMicrotask(() => tx.onabort?.()); };
        tx.objectStore = () => ({
            get(key) {
                const request = {};
                queueMicrotask(() => { request.result = data.get(key); request.onsuccess?.(); finish(); });
                return request;
            },
            delete(key) { deletes.push(key); finish(); return {}; },
            openCursor(range) {
                const request = {};
                const keys = [...data.keys()].filter(key => key >= range.lower && key <= range.upper).sort();
                let index = 0;
                const next = () => queueMicrotask(() => {
                    if (state.failRead) { tx.error = request.error = new Error('read transaction aborted'); request.onerror?.(); tx.onabort?.(); return; }
                    const key = keys[index++];
                    request.result = key == null ? null : { key, value: data.get(key), continue: next };
                    request.onsuccess?.();
                    if (key == null) finish();
                });
                next(); return request;
            }
        });
        return tx;
    } };
}
function harness() {
    const char = { id: 'pet-a', name: '沈清', description: '成年研究员，冷静克制，不喜欢被当成小孩。', worldBook: [{ content: '与用户是刚认识的同事。' }], history: [{ isMe: true, content: '今天辛苦了。', timestamp: 1 }], chatConfig: { characterPet: { active: true, autoReact: true, revision: 'initial', referenceKey: 'reference', baseKey: 'base', rules: '高兴也只轻微微笑。', boundaries: '禁止幼儿化和无依据亲昵。', relationship: '初识同事', states: [{ id: 'quiet_smile', label: '浅笑', emotion: '克制的愉悦', description: '仅嘴角轻微上扬，保持站姿。', when: '受到真诚的感谢且态度愉悦时', enabled: true, assetKey: 'smile', draftKey: '' }] } } };
    const other = { id: 'pet-b', name: '乔乐', description: '活泼直率。', history: [], chatConfig: {} };
    const data = new Map([['reference', { url: png }], ['base', { url: png, transparent: true }], ['smile', { url: png, transparent: true, baseKey: 'base' }]]);
    const timers = new Map();
    const state = { now: 1800000000000, api: { baseUrl: 'https://pet.test/v1', model: 'test', apiKey: 'test-only' }, sharedUntil: 0, enabled: true, bound: char, saves: [], failSave: false, failAsset: false, calls: [], answer: { ok: true, content: '{"allow":true,"note":"符合克制的表现。"}' } };
    class Clock extends Date { static now() { return state.now; } }
    let timerId = 0;
    const context = vm.createContext({
        console: { warn() {}, log() {} }, Blob, FormData, Response, URL, AbortSignal, Date: Clock,
        IDBKeyRange: { bound: (lower, upper) => ({ lower, upper }) },
        getChatApiRateLimitScope: () => JSON.stringify([state.api.baseUrl.replace(/\/+$/, ''), state.api.model, state.api.apiKey]),
        getChatApiRateLimitPauseRemainingMs: () => Math.max(0, state.sharedUntil - state.now),
        window: { myCharacters: [char, other], dispatchEvent() {}, addEventListener() {} },
        document: { hidden: false, getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], addEventListener() {} },
        CustomEvent: class { constructor(type, init) { this.type = type; this.detail = init.detail; } },
        setTimeout: (fn, delay) => { const id = ++timerId; timers.set(id, { fn, delay }); return id; }, clearTimeout: id => timers.delete(id),
        isMonitorPetEnabled: () => state.enabled, getMonitorPetBoundChar: () => state.bound, getMonitorCharName: c => c.name,
        getMonitorPetCurrentSceneText: () => '用户在 BYND 桌面。', syncMonitorPetFloating() {},
        saveCharactersToStorage: async () => { if (state.failSave) return false; state.saves.push(JSON.parse(JSON.stringify(context.window.myCharacters))); return true; },
        saveMonitorPetAsset: async (key, value) => { if (state.failAsset) throw new Error('database full'); data.set(key, value); },
        openMonitorPetDb: async () => assetDatabase(data, state),
        callChatApi: async (messages, options) => { state.calls.push({ messages, options }); return typeof state.answer === 'function' ? state.answer(messages) : state.answer; },
        stripWechatPromptText: (value, limit) => String(value || '').replace(/<[^>]*>/g, '').trim().slice(0, limit),
        getWechatPromptWorldBookSelection: c => c.chatConfig?.promptWorldBookIds || null,
        getWechatWorldBookEntryId: (entry, index) => String(entry.id || index),
        wcEscapeHtml: value => String(value).replace(/[<>&"]/g, char => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[char]))
    });
    vm.runInContext(sourceSection('wechat.js', 'function buildWechatWorldBookPrompt(', 'function getWechatVoicePromptContent('), context);
    vm.runInContext(fs.readFileSync(path.join(root, 'modules/monitor/character-pet.js'), 'utf8'), context);
    vm.runInContext(fs.readFileSync(path.join(root, 'modules/monitor/pet-studio.js'), 'utf8'), context);
    return { context, C: context.window.ByndCharacterPet, studio: context.window.ByndPetStudio, char, other, data, state, timers };
}

const petReply = { ok: true, content: '{"state":"quiet_smile","confidence":0.9,"text":"谢谢。"}' };
const reviewReply = { ok: true, content: '{"allow":true,"note":"符合人设"}' };
const answerPet = messages => messages[0].content.includes('审校器') ? reviewReply : petReply;

test('pose and motif preferences persist per character and preserve the old settings on save failure', async () => {
    const { C, char, other, studio, state } = harness();
    await studio.select(char.id);
    studio.field('pose', '坐在贝壳上，安静倾听');
    studio.field('motifs', '贝壳是已确认的座椅，不是背景');
    studio.formMode('symbol');
    state.failSave = true;
    await assert.rejects(studio.saveForm(char), /保存/);
    assert.equal(C.profile(char).pose, '');
    state.failSave = false; await studio.saveForm(char);
    assert.equal(C.profile(char).pose, '坐在贝壳上，安静倾听');
    assert.equal(C.profile(char).formMode, 'symbol');
    assert.match(C.profile(char).motifs, /贝壳/);
    assert.equal(C.profile(other).motifs, '');
});

test('image prompts support sitting, resting, role motifs and explicit symbolic forms without inventing associations', async () => {
    const { C, char, other, studio, context } = harness();
    Object.assign(char.chatConfig.characterPet, { pose: '坐着和机械乌鸦互动', motifs: '用户确认：机械乌鸦是这个角色的代表元素' });
    const person = C.imagePrompt(char);
    assert.match(person, /坐着和机械乌鸦互动/);
    assert.match(person, /人物模式.*不能擅自变成/);
    assert.doesNotMatch(C.imagePrompt(other), /机械乌鸦/);
    char.chatConfig.characterPet.formMode = 'symbol';
    const symbol = C.imagePrompt(char);
    assert.match(symbol, /只绘制该代表形态/);
    assert.doesNotMatch(symbol, /约 1.8 至 2 头身/);
    assert.match(C.imagePrompt(char, C.profile(char).states[0]), /不把人物母版变成动物/);
    assert.match(C.imagePrompt(char, null, true), /保留图中已有的角色代表物.*正坐着或倚靠/);
    char.chatConfig.characterPet.motifs = '';
    let calls = 0; context.callWechatImageGenerationApi = async () => { calls++; };
    await assert.rejects(studio.generateImage(char), /代表元素/);
    assert.equal(calls, 0);
});

test('animation uses the same image provider and approved identity while failed requests keep existing expressions', async () => {
    const { C, char, studio, context } = harness();
    const before = JSON.stringify(C.profile(char)); const calls = [];
    context.callWechatImageGenerationApi = async (prompt, options) => { calls.push({ prompt, options }); return { ok: false, error: 'rate limit exceeded' }; };
    await assert.rejects(studio.generateImage(char, 'quiet_smile', false, true), /rate limit/);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].options.referenceImage, png);
    assert.match(calls[0].prompt, /2×2.*4 帧/);
    assert.match(calls[0].prompt, /不能复制四张相同静帧/);
    assert.match(calls[0].prompt, /禁止幼儿化/);
    assert.equal(JSON.stringify(C.profile(char)), before);
});

test('confirmed animated states follow the reviewed reply and use a still poster for reduced motion', async () => {
    const { C, char, state, data, context } = harness();
    const gif = 'data:image/gif;base64,R0lGODlh';
    data.set('smile', { url: gif, posterUrl: png, transparent: true, format: 'gif', baseKey: 'base' });
    await C.preload(char);
    state.answer = reviewReply;
    assert.equal(await C.applyChatReaction(char, { state: 'quiet_smile', confidence: 1 }, '谢谢。'), true);
    assert.equal(C.visual(char).image, gif);
    context.window.matchMedia = () => ({ matches: true });
    assert.equal(C.visual(char).image, png);
    state.answer = { ok: true, content: '{"allow":false,"note":"违背人设"}' };
    assert.equal(await C.applyChatReaction(char, { state: 'quiet_smile', confidence: 1 }, '撒娇'), false);
    assert.equal(C.visual(char).state, 'idle');
});

test('confirmed idle GIFs retain the mother and all existing reaction assets', async () => {
    const { C, studio, char, data, state } = harness();
    const gif = { url: 'data:image/gif;base64,R0lGODlh', posterUrl: png, format: 'gif', transparent: true, baseKey: 'base' };
    data.set('idle-gif', gif); char.chatConfig.characterPet.draftIdleKey = 'idle-gif';
    await studio.select(char.id);
    state.failSave = true;
    assert.equal(await studio.confirmIdle(), false);
    assert.equal(C.profile(char).idleKey, ''); assert.equal(C.profile(char).draftIdleKey, 'idle-gif');
    state.failSave = false;
    assert.equal(await studio.confirmIdle(), true);
    assert.equal(C.profile(char).baseKey, 'base');
    assert.equal(C.profile(char).states[0].assetKey, 'smile');
    assert.equal(C.visual(char).image, gif.url);
});

test('discarding a candidate preserves active assets and the history file, including save failures', async () => {
    const { C, studio, char, data, state } = harness();
    const key = 'character-pet:pet-a:draft'; data.set(key, { url: png }); char.chatConfig.characterPet.draftBaseKey = key;
    state.failSave = true;
    await assert.rejects(studio.discardPreview(char, 'idle'), /保存/);
    assert.equal(C.profile(char).draftBaseKey, key);
    state.failSave = false; await studio.discardPreview(char, 'idle');
    assert.equal(C.profile(char).draftBaseKey, ''); assert.equal(C.profile(char).baseKey, 'base');
    assert.equal(data.has(key), true);
    await C.deleteAsset(char, key); assert.equal(data.has(key), false);
});

test('a pet interaction lease survives scene resets and role changes without queuing extra requests', async () => {
    const { C, char, other, state, context, timers } = harness();
    const pending = deferred(); state.answer = () => pending.promise;
    C.observeScene();
    const running = C.request(char, 'tap');
    assert.equal(state.calls.length, 1);
    context.getMonitorPetCurrentSceneText = () => '用户进入阅读页。';
    C.observeScene();
    state.now += 4000;
    [...timers.values()].find(timer => timer.delay === 2500).fn();
    C.reset(char);
    assert.equal(await C.request(char, 'tap'), false);
    assert.equal(await C.applyChatReaction(char, { state: 'quiet_smile', confidence: 1 }, '谢谢。'), false);
    await assert.rejects(C.testReaction(char, '谢谢'), /正在回应/);
    other.chatConfig.characterPet = JSON.parse(JSON.stringify(char.chatConfig.characterPet));
    state.bound = other;
    assert.equal(await C.request(other, 'tap'), false);
    assert.equal(state.calls.length, 1);
    pending.resolve(petReply);
    assert.equal(await running, false);
    assert.equal(C.runtime(char).busy, false);
    state.now += 3000; state.answer = answerPet;
    assert.equal(await C.request(other, 'tap'), true);
    assert.equal(state.calls.length, 3);
});

test('the lease covers the independent review and no review result survives a reset', async () => {
    const { C, char, state } = harness(); const pending = deferred();
    state.answer = messages => messages[0].content.includes('审校器') ? pending.promise : petReply;
    const running = C.request(char);
    while (state.calls.length < 2) await new Promise(resolve => setImmediate(resolve));
    C.beginReply(char); C.endReply(char); state.now += 4000;
    assert.equal(await C.request(char), false);
    assert.equal(state.calls.length, 2);
    pending.resolve(reviewReply); assert.equal(await running, false);
    assert.equal(C.runtime(char).bubble, '');
    assert.equal(C.runtime(char).busy, false);
    assert.ok(state.calls.every(call => call.options.skipLengthContinuation && call.options.skipStatusValidationRetry && call.options.skipEmptyLengthRetry));
});

for (const duringReview of [false, true]) test(`real 429 ${duringReview ? 'during review' : 'during generation'} pauses automatic reactions until a manual recovery`, async () => {
    const { C, char, state } = harness();
    state.answer = messages => duringReview && !messages[0].content.includes('审校器') ? petReply : { ok: false, httpStatus: 429, rateLimited: true, retryAfterMs: 0, error: 'rate limit exceeded' };
    assert.equal(await C.request(char), false);
    assert.match(C.runtime(char).note, /已暂停.*稍后轻点/);
    assert.doesNotMatch(C.runtime(char).note, /\d+\s*(秒|分钟)/);
    assert.equal(C.runtime(char).bubble, '');
    const calls = state.calls.length;
    state.now += 60000;
    assert.equal(await C.request(char, 'scene'), false);
    assert.equal(await C.applyChatReaction(char, { state: 'quiet_smile', confidence: 1 }, '谢谢'), false);
    assert.equal(state.calls.length, calls);
    state.answer = answerPet;
    assert.equal(await C.request(char), true);
    assert.equal(state.calls.length, calls + 2);
    assert.equal(await C.request(char, 'scene'), false);
    state.now += 30000;
    assert.equal(await C.request(char, 'scene'), true);
    assert.equal(state.calls.length, calls + 4);
});

test('provider Retry-After is honored without extending it on blocked interactions', async () => {
    const { C, char, state } = harness();
    state.answer = { ok: false, rateLimited: true, httpStatus: 429, retryAfterMs: 123000 };
    await C.request(char);
    state.now += 23000;
    await C.request(char);
    assert.match(C.runtime(char).note, /100 秒/);
    assert.equal(state.calls.length, 1);
    state.now += 99999;
    assert.equal(await C.request(char, 'scene'), false);
    state.now += 1; state.answer = answerPet;
    assert.equal(await C.request(char, 'scene'), true);
    assert.equal(state.calls.length, 3);
});

test('quota failures stay distinct from temporary limits and permit manual recovery', async () => {
    const { C, char, state } = harness();
    state.answer = { ok: false, httpStatus: 429, quotaExceeded: true, rateLimited: false, retryAfterMs: 0 };
    await C.request(char); assert.match(C.runtime(char).note, /额度不足/);
    state.now += 3600000;
    assert.equal(await C.request(char, 'scene'), false);
    assert.equal(state.calls.length, 1);
    state.answer = answerPet;
    assert.equal(await C.request(char), true);
    assert.equal(state.calls.length, 3);
});

test('an ordinary error mentioning 429 never creates a pet API pause', async () => {
    const { C, char, state } = harness();
    state.answer = { ok: false, httpStatus: 500, error: 'upstream detail: 429', rateLimited: false };
    await C.request(char);
    state.now += 30000; state.answer = answerPet;
    assert.equal(await C.request(char, 'scene'), true);
    assert.equal(state.calls.length, 3);
});

for (const key of ['baseUrl', 'model', 'apiKey']) test('pet automatic pause is isolated by ' + key, async () => {
    const { C, char, state } = harness();
    state.answer = { ok: false, httpStatus: 429, rateLimited: true, retryAfterMs: 0 };
    await C.request(char);
    const before = state.api[key]; state.api[key] += '-other'; state.answer = answerPet;
    assert.equal(await C.request(char), true);
    state.api[key] = before; state.now += 60000;
    assert.equal(await C.request(char, 'scene'), false);
    assert.equal(state.calls.length, 3);
});

test('a shared provider pause prevents pet generation and review without sending another request', async () => {
    const { C, char, state } = harness();
    state.sharedUntil = state.now + 20000;
    assert.equal(await C.request(char), false);
    assert.match(C.runtime(char).note, /20 秒/);
    await assert.rejects(C.testReaction(char, '谢谢'), /20 秒/);
    assert.equal(state.calls.length, 0);
    state.now += 20000; state.answer = answerPet;
    assert.equal(await C.request(char), true);
});

test('legacy pet requests share the rate gate and preserve the old bubble when saving fails', async () => {
    const { C, char, state, context } = harness();
    char.chatConfig.characterPet.active = false;
    const bubble = { bubbleText: '原来的气泡', bubbleAt: 123 };
    const statuses = [];
    Object.assign(context, {
        monitorPetAiBusy: false, monitorPetLastReactionAt: 0, monitorPetFloatMessage: '',
        ensureMonitorPetState: () => bubble, updateMonitorPetStatus: text => statuses.push(text),
        isMonitorScreenSharingActive: () => false, buildMonitorPetReactionMessages: () => [], normalizeMonitorPetReactionText: text => text
    });
    vm.runInContext(sourceSection('script.js', 'async function requestMonitorPetReaction(', 'window.requestMonitorPetReaction'), context);
    state.answer = { ok: false, rateLimited: true, httpStatus: 429, retryAfterMs: 0 };
    await context.requestMonitorPetReaction();
    state.now += 60000;
    await context.requestMonitorPetReaction('observe');
    assert.equal(state.calls.length, 1);
    assert.equal(bubble.bubbleText, '原来的气泡');
    state.answer = { ok: true, content: '新的气泡' }; state.failSave = true;
    await context.requestMonitorPetReaction();
    assert.equal(bubble.bubbleText, '原来的气泡'); assert.equal(bubble.bubbleAt, 123);
    assert.match(statuses.at(-1), /未能保存/);
    assert.equal(context.monitorPetAiBusy, false);
    state.now += 3000; state.failSave = false;
    await context.requestMonitorPetReaction();
    assert.equal(bubble.bubbleText, '新的气泡');
    assert.ok(state.calls.every(call => call.options.skipEmptyLengthRetry));
});

test('old PNG history remains visible, role-scoped and newest first without retaining full images', async () => {
    const { C, char, other, data, state } = harness();
    data.set('character-pet:pet-a:old', { url: png, kind: 'candidate', createdAt: 10, width: 1024, height: 1024, transparent: false, prompt: 'old prompt' });
    data.set('character-pet:pet-a:new', { url: png, kind: 'candidate', createdAt: 20, transparent: true });
    data.set('character-pet:pet-a:ref', { url: png, kind: 'reference' });
    data.set('character-pet:pet-a:zip', { blob: 'zip' });
    data.set('character-pet:pet-b:other', { url: png, createdAt: 30 });
    data.set('character-pet:pet-a%3Ax:foreign', { url: png, createdAt: 40 });
    const rows = await C.listAssets(char);
    assert.equal(rows.length, 2);
    assert.match(rows[0].key, /:new$/);
    assert.equal(rows[1].width, 1024);
    assert.equal(rows[1].bytes, 5);
    assert.equal(rows[1].source, 'generated');
    assert.equal(rows.some(row => row.url || row.prompt), false);
    assert.equal((await C.listAssets(other)).length, 1);
    assert.equal(state.saves.length, 0);
    state.failRead = true;
    await assert.rejects(C.listAssets(char), /read transaction aborted/);
});

test('PNG deletion changes storage and cache only after the transaction commits; aborts remain retryable', async () => {
    const { C, char, data, state } = harness();
    const key = 'character-pet:pet-a:unused'; data.set(key, { url: png, kind: 'candidate' });
    await C.readAsset(key);
    state.failDelete = true;
    await assert.rejects(C.deleteAsset(char, key), /delete transaction aborted/);
    assert.ok(data.has(key)); assert.equal(C.cached(key).url, png);
    assert.equal((await C.listAssets(char)).length, 1);
    state.failDelete = false;
    await C.deleteAsset(char, key);
    assert.equal(data.has(key), false);
    assert.equal(C.cached(key), null);
    assert.equal(await C.readAsset(key), null);
    assert.equal((await C.listAssets(char)).length, 0);
});

test('current mother, draft, expressions, other role usage and references cannot be deleted as history', async () => {
    const { C, char, other, data } = harness();
    const key = 'character-pet:pet-a:protected'; data.set(key, { url: png, kind: 'candidate' });
    for (const field of ['baseKey', 'draftBaseKey']) {
        const before = char.chatConfig.characterPet[field]; char.chatConfig.characterPet[field] = key;
        await assert.rejects(C.deleteAsset(char, key), /仍用于/);
        char.chatConfig.characterPet[field] = before;
    }
    char.chatConfig.characterPet.states[0].assetKey = key;
    await assert.rejects(C.deleteAsset(char, key), /表情/);
    char.chatConfig.characterPet.states[0].assetKey = 'smile';
    other.chatConfig.characterPet = { baseKey: key };
    await assert.rejects(C.deleteAsset(char, key), /乔乐/);
    other.chatConfig.characterPet = {};
    await assert.rejects(C.deleteAsset(other, key), /当前角色/);
    data.set(key, { url: png, kind: 'reference' });
    await assert.rejects(C.deleteAsset(char, key), /不是.*可删除/);
    assert.ok(data.has(key));
});

test('PNG deletion rechecks usage after an earlier queued configuration write completes', async () => {
    const { C, char, data } = harness();
    const key = 'character-pet:pet-a:becoming-active'; data.set(key, { url: png, kind: 'candidate' });
    const pending = deferred();
    const update = C.update(char, async next => { await pending.promise; next.baseKey = key; });
    const deletion = C.deleteAsset(char, key);
    pending.resolve(); await update;
    await assert.rejects(deletion, /仍用于/);
    assert.ok(data.has(key));
});

test('pet state choices are limited to enabled, confirmed assets with sufficient confidence', () => {
    const { C, char } = harness();
    assert.equal(C.normalizeReaction(char, { state: 'quiet_smile', confidence: 0.9 }).state, 'quiet_smile');
    assert.equal(C.normalizeReaction(char, { state: 'invented_heart', confidence: 1 }).state, 'idle');
    assert.equal(C.normalizeReaction(char, { state: 'quiet_smile', confidence: 0.5 }).state, 'idle');
    char.chatConfig.characterPet.states[0].enabled = false;
    assert.equal(C.normalizeReaction(char, { state: 'quiet_smile', confidence: 1 }).state, 'idle');
    char.chatConfig.characterPet.states[0].enabled = true;
    char.chatConfig.characterPet.states[0].assetKey = '';
    char.chatConfig.characterPet.states[0].draftKey = 'unconfirmed';
    assert.equal(C.normalizeReaction(char, { state: 'quiet_smile', confidence: 1 }).state, 'idle');
});

test('pet metadata and truncated tags never become visible dialogue', () => {
    const { C } = harness();
    const complete = C.extract('谢谢。<bynd_pet>{"state":"quiet_smile","confidence":0.9}</bynd_pet>|||先休息吧。');
    assert.equal(complete.content, '谢谢。|||先休息吧。');
    assert.equal(complete.reaction.state, 'quiet_smile');
    assert.equal(C.extract('谢谢。<bynd_pet>{"state":').content, '谢谢。');
    assert.equal(C.extract('谢谢。<BYND_PET>{oops}</BYND_PET>').content, '谢谢。');
    assert.equal(C.extract('谢谢。<bynd_pet>{"state":').reaction, null);
});

test('character-specific persona, boundaries and relationship reach both generation and independent review', async () => {
    const { C, char, state } = harness();
    const instructions = C.chatInstructions(char);
    assert.match(instructions, /初识同事/);
    assert.match(instructions, /禁止幼儿化/);
    assert.match(instructions, /quiet_smile/);
    await C.applyChatReaction(char, { state: 'quiet_smile', confidence: 0.9 }, '谢谢你的关心。');
    assert.equal(state.calls.length, 1);
    const request = JSON.stringify(state.calls[0].messages);
    assert.match(request, /成年研究员/);
    assert.match(request, /刚认识的同事/);
    assert.match(request, /谢谢你的关心/);
    assert.match(request, /审校器/);
    assert.equal(C.runtime(char).state, 'quiet_smile');
});

test('OOC rejection and failed review keep the pet idle without manufacturing speech', async () => {
    const { C, char, state } = harness();
    state.answer = { ok: true, content: '{"allow":false,"note":"不符合当前关系。"}' };
    assert.equal(await C.applyChatReaction(char, { state: 'quiet_smile', confidence: 1 }, '宝贝抱抱'), false);
    assert.equal(C.runtime(char).state, 'idle');
    assert.equal(C.runtime(char).bubble, '');
    state.answer = { ok: false, error: 'timeout' };
    assert.equal(await C.applyChatReaction(char, { state: 'quiet_smile', confidence: 1 }, '谢谢'), false);
    assert.equal(C.runtime(char).state, 'idle');
});

for (const [label, change] of [
    ['new interaction', h => h.char.history.push({ isMe: true, content: '别这么说。', timestamp: 2 })],
    ['role switch', h => { h.state.bound = h.other; }],
    ['global off', h => { h.state.enabled = false; }],
    ['automatic reactions off', h => { h.char.chatConfig.characterPet.autoReact = false; }],
    ['changed personality', h => { h.char.description = '性格已修改，不会微笑。'; }],
    ['changed imported persona', h => { h.char.system_prompt = '不能用微笑回应感谢。'; }],
    ['removed character', h => { h.context.window.myCharacters = [h.other]; }]
]) test('an outstanding pet review is discarded after ' + label, async () => {
    const h = harness(); const gate = deferred(); h.state.answer = () => gate.promise;
    const request = h.C.applyChatReaction(h.char, { state: 'quiet_smile', confidence: 0.9 }, '谢谢。');
    change(h); gate.resolve({ ok: true, content: '{"allow":true}' });
    assert.equal(await request, false);
    assert.equal(h.C.runtime(h.char).state, 'idle');
});

test('confirmed emotions expire without another API request and opening/rendering a scene does not query AI', async () => {
    const { C, char, state, timers, context } = harness();
    C.observeScene(); C.observeScene(); C.material(char);
    assert.equal(state.calls.length, 0);
    await C.applyChatReaction(char, { state: 'quiet_smile', confidence: 1, durationSeconds: 1 }, '谢谢。');
    const timer = [...timers.values()].find(item => item.delay === 15000);
    context.getMonitorPetCurrentSceneText = () => '用户切换到了共读页。';
    C.observeScene();
    assert.ok(timer); timer.fn();
    assert.equal(C.runtime(char).state, 'idle');
    assert.equal(state.calls.length, 1);
});

test('saved pet changes roll back on persistence failure, serialize writes and retain other roles', async () => {
    const { C, char, other, state } = harness();
    const before = JSON.stringify(other);
    state.failSave = true;
    await assert.rejects(C.update(char, next => { next.boundaries = 'changed'; }), /保存/);
    assert.equal(C.profile(char).boundaries, '禁止幼儿化和无依据亲昵。');
    state.failSave = false;
    await Promise.all([C.update(char, next => { next.rules = '只点头'; }), C.update(char, next => { next.relationship = '同事'; })]);
    assert.equal(C.profile(char).rules, '只点头');
    assert.equal(C.profile(char).relationship, '同事');
    assert.equal(JSON.stringify(other), before);
});

test('a display failure after persistence does not undo a saved pet configuration', async () => {
    const { C, char, context } = harness();
    context.syncMonitorPetFloating = () => { throw new Error('view failed'); };
    await C.update(char, next => { next.rules = '保持克制'; });
    assert.equal(C.profile(char).rules, '保持克制');
});

test('PNG validation rejects opaque, checkerboard, nearly opaque and empty files', () => {
    const { C } = harness();
    const pixels = new Uint8ClampedArray(40 * 40 * 4);
    for (let i = 3; i < pixels.length; i += 4) pixels[i] = 255;
    assert.equal(C.analyzeAlpha(pixels, 40, 40).transparent, false);
    pixels[3] = 0;
    assert.equal(C.analyzeAlpha(pixels, 40, 40).transparent, false);
    pixels.fill(0);
    assert.equal(C.analyzeAlpha(pixels, 40, 40).empty, true);
    for (let y = 5; y < 35; y++) for (let x = 10; x < 30; x++) pixels[(y * 40 + x) * 4 + 3] = 255;
    assert.equal(C.analyzeAlpha(pixels, 40, 40).transparent, true);
});

test('opaque or failed candidate confirmation preserves the chosen mother image and expression set', async () => {
    const { studio, C, char, data, state } = harness();
    data.set('candidate', { url: png, transparent: false });
    char.chatConfig.characterPet.draftBaseKey = 'candidate';
    await assert.rejects(studio.confirmImage(char, 'idle'), /透明/);
    assert.equal(C.profile(char).baseKey, 'base');
    data.set('candidate2', { url: png, transparent: true });
    char.chatConfig.characterPet.draftBaseKey = 'candidate2';
    state.failSave = true;
    await assert.rejects(studio.confirmImage(char, 'idle'), /保存/);
    assert.equal(C.profile(char).baseKey, 'base');
    assert.equal(C.profile(char).states[0].assetKey, 'smile');
    state.failSave = false;
    await studio.confirmImage(char, 'idle');
    assert.equal(C.profile(char).baseKey, 'candidate2');
    assert.equal(C.profile(char).states[0].assetKey, '');
});

test('expression candidates from an older mother image cannot be confirmed', async () => {
    const { studio, char, data, C } = harness();
    data.set('stale', { url: png, transparent: true, baseKey: 'old-base' });
    char.chatConfig.characterPet.states[0].draftKey = 'stale';
    await assert.rejects(studio.confirmImage(char, 'quiet_smile'), /母版/);
    assert.equal(C.profile(char).states[0].assetKey, 'smile');
});

test('image storage failures do not produce usable asset keys', async () => {
    const { C, char, state, data } = harness();
    state.failAsset = true;
    const before = data.size;
    await assert.rejects(C.storeAsset(char, { url: png, transparent: true }), /database full/);
    assert.equal(data.size, before);
});

test('image prompts use only the user identity reference and keep variants anchored to the mother', () => {
    const { C, char } = harness();
    const initial = C.imagePrompt(char);
    assert.match(initial, /第一张图片锁定角色身份/);
    assert.match(initial, /唯一的图片参考/);
    assert.doesNotMatch(initial, /第二张|风格示例人物/);
    assert.match(initial, /Alpha/);
    assert.match(initial, /禁止幼儿化/);
    assert.doesNotMatch(initial, /必须保持同类画风/);
    const variant = C.imagePrompt(char, C.profile(char).states[0]);
    assert.match(variant, /已确认的角色母版/);
    assert.match(variant, /仅嘴角轻微上扬/);
    assert.doesNotMatch(variant, /第二张图片仅参考/);
});

for (const [label, id, removeBackground, sourceKey] of [
    ['base image', 'idle', false, 'reference'],
    ['background removal', 'idle', true, 'candidate'],
    ['explicit expression', 'quiet_smile', false, 'base']
]) test('a reference and appearance can reach image generation without a persona: ' + label, async () => {
    const { studio, C, char, context, data } = harness();
    delete char.description; char.worldBook = [];
    char.chatConfig.characterPet.appearance = '银灰短发，红色眼睛，保留参考图中的服装。';
    char.chatConfig.characterPet.draftBaseKey = 'candidate';
    data.set('candidate', { url: 'data:image/png;base64,Y2FuZGlkYXRl', transparent: false });
    const before = JSON.stringify(C.profile(char));
    const calls = [];
    context.callWechatImageGenerationApi = async (prompt, options) => {
        calls.push({ prompt, options });
        return { ok: false, error: 'test provider unavailable' };
    };
    await assert.rejects(studio.generateImage(char, id, removeBackground), /test provider unavailable/);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].options.referenceImage, data.get(sourceKey).url);
    assert.equal(calls[0].options.requireReference, true);
    assert.equal(calls[0].options.editOnly, true);
    assert.equal(calls[0].options.background, 'transparent');
    if (removeBackground) assert.match(calls[0].prompt, /只移除/);
    else {
        assert.match(calls[0].prompt, /银灰短发/);
        assert.match(calls[0].prompt, /不从外观推断性格/);
        assert.match(calls[0].prompt, id === 'idle' ? /中性.*自然待机/ : /仅嘴角轻微上扬/);
    }
    assert.equal(JSON.stringify(C.profile(char)), before);
});

test('appearance text alone never bypasses the required image reference', async () => {
    const { studio, other, context } = harness();
    other.chatConfig.characterPet = { appearance: '银灰短发，红色眼睛。' };
    let calls = 0;
    context.callWechatImageGenerationApi = async () => { calls++; };
    await assert.rejects(studio.generateImage(other), /上传角色参考图/);
    assert.equal(calls, 0);
});

test('persona checks and prompts use imported card fields, not appearance or role names', () => {
    const { C, other } = harness();
    delete other.description;
    other.chatConfig.characterPet = { appearance: '银灰短发，红色眼睛。' };
    assert.equal(C.hasPersona(other), false);
    for (const key of ['description', 'personality', 'prompt', 'setting', 'scenario', 'mes_example', 'mesExample', 'system_prompt', 'systemPrompt', 'post_history_instructions', 'postHistoryInstructions', 'creator_notes', 'creatorNotes', 'character_note', 'characterNote', 'first_mes', 'first_mes_original', 'alternates']) {
        other[key] = key === 'alternates' ? ['沉稳克制，不默认亲密。'] : '沉稳克制，不默认亲密。';
        assert.equal(C.hasPersona(other), true, key);
        assert.match(C.persona(other), /沉稳克制/);
        assert.match(C.imagePrompt(other), /沉稳克制/);
        delete other[key];
    }
    assert.equal(C.hasPersona(other), false);
});

test('enabled world book content is recognized as persona and disabled or empty entries are not', () => {
    const { C, other } = harness();
    delete other.description;
    for (const key of ['content', 'text', 'entry', 'value', 'description']) {
        other.worldBook = [{ name: '关系设定', [key]: '只是初识同事，表达感谢时也保持克制。', enabled: true }];
        assert.equal(C.hasPersona(other), true, key);
        assert.match(C.persona(other), /只是初识同事/);
        assert.match(C.imagePrompt(other), /只是初识同事/);
        other.worldBook[0].enabled = false;
        assert.equal(C.hasPersona(other), false, key + ' disabled');
    }
    other.worldBook = [{ name: '空的人设条目', content: '   ' }];
    assert.equal(C.hasPersona(other), false);
});

test('expanded persona reading retains detailed original cards and world-book boundaries', () => {
    const { C, char } = harness();
    char.description = '角色经历。'.repeat(1800) + '重要边界：拒绝无依据亲昵。';
    char.worldBook = [{ content: '关系背景。'.repeat(200) + '关系不能自动升级。', enabled: true }];
    char.system_prompt = '对话保持简洁。';
    const persona = C.persona(char);
    assert.match(persona, /重要边界：拒绝无依据亲昵/);
    assert.match(persona, /关系不能自动升级/);
    assert.match(persona, /对话保持简洁/);
});

test('expression recommendations accept a world-book-only persona and reject appearance-only input', async () => {
    const { C, studio, other, state } = harness();
    delete other.description;
    other.chatConfig.characterPet = { appearance: '银灰短发，红色眼睛。' };
    await studio.select(other.id);
    assert.equal(await studio.plan(), false);
    assert.equal(state.calls.length, 0);
    other.worldBook = [{ content: '成年人，冷静克制，与用户是初识同事。', enabled: true }];
    state.answer = { ok: true, content: JSON.stringify({ states: [{ label: '倾听', emotion: '专注', description: '安静倾听，站姿不变。', when: '用户认真讲述事情时。' }] }) };
    assert.equal(await studio.plan(), true);
    assert.equal(state.calls.length, 1);
    assert.match(JSON.stringify(state.calls[0].messages), /初识同事/);
    assert.equal(C.profile(other).planDraft.length, 1);
});

test('a pet with only an image stays neutral until personality evidence is available', async () => {
    const { C, char, state } = harness();
    delete char.description; char.worldBook = [];
    char.chatConfig.characterPet.appearance = '银灰短发，红色眼睛。';
    assert.equal(await C.request(char, 'tap'), false);
    assert.equal(await C.applyChatReaction(char, { state: 'quiet_smile', confidence: 1 }, '谢谢。'), false);
    await assert.rejects(C.testReaction(char, '今天开心吗？'), /性格.*关系/);
    assert.equal(state.calls.length, 0);
    assert.equal(C.runtime(char).state, 'idle');
    assert.equal(C.runtime(char).bubble, '');
});

function imageApiHarness(config = {}) {
    const calls = [];
    let response = () => new Response('{"data":[{"b64_json":"aGVsbG8="}]}', { status: 200 });
    const context = vm.createContext({
        Blob, FormData, Response, URL, AbortSignal,
        getDefaultImageApi: () => ({ baseUrl: 'https://images.test/v1', imageModel: 'custom-image', apiKey: 'test-only', ...config }),
        parseWechatApiJsonResponseText: JSON.parse,
        fetch: async (url, options) => {
            if (url.startsWith('data:')) return new Response(new Blob(['test'], { type: 'image/png' }));
            calls.push({ url, options }); return response(calls.length);
        }
    });
    vm.runInContext(sourceSection('wechat.js', 'async function callWechatImageGenerationApi(', 'function getWechatImageReferenceForChar('), context);
    return { context, calls, respond: fn => { response = fn; } };
}

test('pet generation reuses the existing API route and sends identity plus style as multipart edits with transparency', async () => {
    const { context, calls } = imageApiHarness();
    const result = await context.callWechatImageGenerationApi('3D character', { referenceImage: png, additionalReferences: [png], requireReference: true, editOnly: true, referenceStyle: 'identity', background: 'transparent', outputFormat: 'png', size: '1024x1024' });
    assert.equal(result.ok, true);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, 'https://images.test/v1/images/edits');
    const form = calls[0].options.body;
    assert.equal(form.getAll('image[]').length, 2);
    assert.equal(form.get('model'), 'custom-image');
    assert.equal(form.get('background'), 'transparent');
    assert.equal(form.get('output_format'), 'png');
    assert.match(form.get('prompt'), /锁定角色身份/);
    assert.doesNotMatch(form.get('prompt'), /必须保持同类画风/);
    assert.equal(calls[0].options.headers['Content-Type'], undefined);
});

test('unsupported strict image editing never retries without the reference or silently changes endpoints', async () => {
    const { context, calls, respond } = imageApiHarness();
    respond(() => new Response('not supported', { status: 404 }));
    const result = await context.callWechatImageGenerationApi('3D character', { referenceImage: png, requireReference: true, editOnly: true });
    assert.equal(result.ok, false);
    assert.equal(calls.length, 1);
    const missing = await context.callWechatImageGenerationApi('3D character', { requireReference: true, editOnly: true });
    assert.equal(missing.ok, false);
    assert.equal(calls.length, 1);
});

test('ordinary chat image generation retains its prior style and compatibility path', async () => {
    const { context, calls } = imageApiHarness();
    assert.equal((await context.callWechatImageGenerationApi('角色照片', { referenceImage: png })).ok, true);
    assert.match(calls[0].url, /images\/generations$/);
    const body = JSON.parse(calls[0].options.body);
    assert.match(body.prompt, /必须保持同类画风/);
    assert.equal(body.background, undefined);
    assert.equal(body.reference_image, png);
});

const petImageOptions = { referenceImage: png, requireReference: true, editOnly: true, allowEditCompatibility: true, referenceStyle: 'identity', background: 'transparent', outputFormat: 'png', size: '1024x1024' };
const imageSuccess = () => new Response('{"data":[{"b64_json":"aGVsbG8="}]}', { status: 200 });
const imageFailure = (status, message, param = '', code = 'invalid_request_error') => new Response(JSON.stringify({ error: { message, param, code } }), { status, headers: { 'x-request-id': 'req-test-123' } });

test('GPT Image 2 keeps transparency when the configured provider accepts it', async () => {
    const { context, calls } = imageApiHarness({ imageModel: 'gpt-image-2' });
    assert.equal((await context.callWechatImageGenerationApi('character', petImageOptions)).ok, true);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].options.body.get('background'), 'transparent');
    assert.equal(calls[0].options.body.get('model'), 'gpt-image-2');
});

test('explicit transparent-parameter rejection retries with the same reference and model', async () => {
    const { context, calls, respond } = imageApiHarness({ imageModel: 'gpt-image-2' });
    const progress = [];
    respond(count => count === 1 ? imageFailure(400, 'gpt-image-2 does not support background=transparent', 'background') : imageSuccess());
    const result = await context.callWechatImageGenerationApi('character on transparent background', { ...petImageOptions, onProgress: text => progress.push(text) });
    assert.equal(result.ok, true);
    assert.equal(calls.length, 2);
    assert.ok(calls.every(call => call.url.endsWith('/images/edits') && call.options.body.get('image') instanceof Blob));
    assert.equal(calls[1].options.body.get('model'), 'gpt-image-2');
    assert.equal(calls[1].options.body.get('background'), null);
    assert.equal(calls[1].options.body.get('output_format'), 'png');
    assert.match(calls[1].options.body.get('prompt'), /transparent background/);
    assert.equal(calls[0].options.signal, calls[1].options.signal);
    assert.match(progress[0], /透明背景参数/);
});

test('multipart rejection can use the official JSON edits schema with every reference intact', async () => {
    const { context, calls, respond } = imageApiHarness();
    const other = 'data:image/png;base64,dHdv';
    respond(count => count === 1 ? imageFailure(415, 'Content-Type must be application/json') : imageSuccess());
    assert.equal((await context.callWechatImageGenerationApi('character', { ...petImageOptions, additionalReferences: [other] })).ok, true);
    assert.equal(calls.length, 2);
    assert.equal(calls[1].url, calls[0].url);
    assert.equal(calls[1].options.headers['Content-Type'], 'application/json');
    const body = JSON.parse(calls[1].options.body);
    assert.deepEqual(body.images, [{ image_url: png }, { image_url: other }]);
    assert.equal(body.model, 'custom-image');
    assert.equal(body.background, 'transparent');
    assert.equal(body.output_format, 'png');
    assert.equal(body.response_format, undefined);
});

test('compatibility attempts are bounded and preserve a single total timeout', async () => {
    const { context, calls, respond } = imageApiHarness();
    respond(count => count === 1 ? imageFailure(400, 'Unsupported background', 'background')
        : count === 2 ? imageFailure(422, 'Unknown output_format', 'output_format')
        : imageFailure(415, 'Use application/json'));
    assert.equal((await context.callWechatImageGenerationApi('character', petImageOptions)).ok, false);
    assert.equal(calls.length, 4);
    assert.ok(calls.every(call => call.options.signal === calls[0].options.signal && call.url.endsWith('/images/edits')));
    const last = JSON.parse(calls[3].options.body);
    assert.equal(last.images[0].image_url, png);
    assert.equal(last.background, undefined);
    assert.equal(last.output_format, undefined);
});

test('JSON validation arrays preserve missing-image details for compatible edit requests', async () => {
    const { context, calls, respond } = imageApiHarness();
    respond(count => count === 1 ? new Response(JSON.stringify({ detail: [{ loc: ['body', 'images'], msg: 'Field required', type: 'missing' }] }), { status: 422 }) : imageSuccess());
    const result = await context.callWechatImageGenerationApi('character', petImageOptions);
    assert.equal(result.ok, true);
    assert.equal(calls.length, 2);
    assert.equal(JSON.parse(calls[1].options.body).images[0].image_url, png);
});

for (const status of [401, 403, 404, 429, 500, 503]) {
    test(`HTTP ${status} never starts another possibly billable pet image request`, async () => {
        const { context, calls, respond } = imageApiHarness();
        respond(() => imageFailure(status, 'background unsupported; multipart image request failed'));
        const result = await context.callWechatImageGenerationApi('character', petImageOptions);
        assert.equal(result.ok, false);
        assert.equal(calls.length, 1);
        assert.equal(result.details.status, status);
        assert.equal(result.details.path, '/images/edits');
        assert.equal(result.details.requestId, 'req-test-123');
    });
}

test('network failures, refusals and empty successful responses never trigger compatibility retries', async () => {
    for (const reply of [() => { throw new Error('Failed to fetch'); }, () => imageFailure(400, 'Image background blocked by safety policy', '', 'content_policy_violation'), () => new Response('{}', { status: 200 })]) {
        const { context, calls, respond } = imageApiHarness();
        respond(reply);
        assert.equal((await context.callWechatImageGenerationApi('character', petImageOptions)).ok, false);
        assert.equal(calls.length, 1);
    }
});

test('provider diagnostics keep the real reason while removing credentials', async () => {
    const secret = 'private-test-credential-123';
    const { context, calls, respond } = imageApiHarness({ apiKey: secret });
    respond(() => imageFailure(400, 'Unsupported background for account ' + secret, 'background'));
    const result = await context.callWechatImageGenerationApi('character', { ...petImageOptions, allowEditCompatibility: false });
    assert.equal(calls.length, 1);
    assert.match(result.error, /输出设置/);
    assert.match(result.details.message, /Unsupported background/);
    assert.equal(result.details.param, 'background');
    assert.equal(JSON.stringify(result).includes(secret), false);
    assert.doesNotMatch(result.error, /请重新上传/);
});

test('image results normalize raw base64, existing data URLs and output MIME correctly', async () => {
    for (const [body, expected] of [
        [{ output: [{ type: 'image_generation_call', result: 'aGVsbG8=' }] }, png],
        [{ data: [{ b64_json: png }] }, png],
        [{ output_format: 'webp', b64_json: 'aGVsbG8=' }, 'data:image/webp;base64,aGVsbG8=']
    ]) {
        const { context, respond } = imageApiHarness();
        respond(() => new Response(JSON.stringify(body), { status: 200 }));
        assert.equal((await context.callWechatImageGenerationApi('character', petImageOptions)).url, expected);
    }
});
