const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { root, sourceSection, deferred } = require('./helpers/harness.cjs');

function harness() {
    const state = { day: 1, phase: 'night', turnMode: 'night_intro', log: [], players: [
        { id: 'user', isUser: true, name: '我', number: 1, role: '狼人', alive: true },
        { id: 'wolf', name: '狼队友', number: 2, role: '狼人', alive: true },
        { id: 'seer', name: '预言家角色', number: 3, role: '预言家', alive: true },
        { id: 'guard', name: '守卫角色', number: 4, role: '守卫', alive: true },
        { id: 'witch', name: '女巫角色', number: 5, role: '女巫', alive: true },
        { id: 'villager', name: '村民角色', number: 6, role: '村民', alive: true }
    ] };
    const calls = [];
    const context = vm.createContext({
        window: { myCharacters: [{ id: 'seer', name: '预言家角色' }] },
        musicEscapeHtml: value => String(value).replace(/</g, '&lt;'),
        normalizeWolfchaLogEntry: entry => entry,
        getUserProfile: () => ({ name: '我' }), getGameState: () => state,
        updateWolfchaState: fn => { fn(state); return true; },
        pushWolfchaLog: (next, entry) => next.log.push(entry),
        buildMessages: () => [{ role: 'system', content: '保留角色人设。' }],
        callChatApi: async (messages, options) => { calls.push({ messages, options }); return { ok: true, content: '我先听大家的逻辑。' }; },
        showWechatToast() {}, setTimeout, console
    });
    vm.runInContext(fs.readFileSync(path.join(root, 'apps/games/wolfcha-rules.js'), 'utf8'), context);
    vm.runInContext(sourceSection('apps/games/hub-wolfcha.js', 'function getWolfchaUserPlayer(', 'function getWolfchaPlayerRoleLabel('), context);
    vm.runInContext(sourceSection('apps/games/hub-wolfcha.js', 'function getWolfchaPublicLogText(', 'function getGameHubFilter('), context);
    vm.runInContext(sourceSection('apps/games/board-games.js', 'function compactWolfchaPromptText(', 'function getWolfchaAlivePlayers('), context);
    vm.runInContext(sourceSection('apps/games/board-games.js', 'function getWolfchaPendingSpeechIndex(', 'function startWolfchaNight('), context);
    return { context, state, calls };
}

test('every supported table has both factions and never exceeds its player count', () => {
    const { context } = harness();
    for (let count = 2; count <= 10; count++) {
        const pool = context.getWolfchaRolePool(count);
        assert.equal(pool.length, count);
        assert.ok(pool.includes('狼人'));
        assert.ok(pool.includes('村民'));
        assert.ok(pool.filter(role => role === '狼人').length < count / 2 || count === 2);
        assert.equal(pool.includes('白狼王'), false);
    }
});

test('help and actual agent messages share rules, supported-mode limits and public counts', async () => {
    const { context, state, calls } = harness();
    const help = context.renderWolfchaRules(state);
    assert.match(help, /守卫 → 狼人 → 女巫 → 预言家/);
    assert.match(help, /被毒不能开枪/);
    assert.match(help, /同夜不能同时使用/);
    assert.match(help, /尚未结算/);
    assert.match(help, /langrensha.ijinshan.com/);
    assert.doesNotMatch(context.getWolfchaConfigurationText(state), /狼队友|预言家角色|user/);
    state.currentSpeakerId = 'seer'; state.aiSpeechBusyId = 'seer';
    state.log.push({ type: 'speech', name: '预言家角色', playerId: 'seer', status: 'pending', text: '等待' });
    await context.runWolfchaAiSpeech('seer');
    const system = calls[0].messages.filter(message => message.role === 'system').map(message => message.content).join('\n');
    assert.match(system, /保留角色人设/);
    assert.match(system, /PK|屠边/);
    assert.match(system, /玩家不得代替裁判/);
    assert.match(system, /尚未结算/);
    assert.match(calls[0].messages.at(-1).content, /游戏身份：预言家/);
    assert.equal(calls[0].options.usageChar.id, 'seer');
});

test('agent history uses that player perspective rather than the user wolf perspective', () => {
    const { context, state } = harness();
    state.log = [
        { type: 'narrator', playerId: 'wolf', name: '旁白', text: '身份是 狼人。' },
        { type: 'narrator', playerId: 'seer', name: '旁白', text: '身份是 预言家。' },
        { type: 'speech', playerId: 'wolf', name: '狼队友', text: '我觉得四号是预言家。我的身份是预言家。' }
    ];
    const seerPrompt = context.buildWolfchaAiSpeechPrompt(state, state.players[2], {});
    assert.doesNotMatch(seerPrompt, /身份是 狼人/);
    assert.match(seerPrompt, /身份是 预言家/);
    assert.match(seerPrompt, /我觉得四号是预言家/); // Claims are not rewritten as facts.
    assert.match(seerPrompt, /我的身份是预言家/);
    const wolfPrompt = context.buildWolfchaAiSpeechPrompt(state, state.players[1], {});
    assert.match(wolfPrompt, /身份是 狼人/);
    assert.doesNotMatch(wolfPrompt, /身份是 预言家/); // Only the judge's private reveal is hidden.
    assert.match(wolfPrompt, /你的狼人队友/);
});

test('late AI successes and errors cannot be written into a restarted game', async () => {
    for (const fails of [false, true]) {
        const { context, state } = harness();
        state.sessionId = 'old'; state.currentSpeakerId = 'seer'; state.aiSpeechBusyId = 'seer';
        const request = deferred();
        context.callChatApi = () => request.promise;
        const pending = context.runWolfchaAiSpeech('seer');
        const restarted = { ...state, sessionId: 'new', log: [], turnMode: 'day_intro' };
        context.getGameState = () => restarted;
        context.updateWolfchaState = fn => { fn(restarted); return true; };
        if (fails) request.reject(new Error('old failure'));
        else request.resolve({ ok: true, content: 'old reply' });
        await pending;
        assert.deepEqual(restarted.log, []);
        assert.equal(restarted.turnMode, 'day_intro');
    }
});

test('narrator follows reference order, skips absent/dead roles and reaches dawn without inventing results', () => {
    const { context, state } = harness();
    state.players.find(player => player.role === '女巫').alive = false;
    assert.deepEqual(Array.from(context.getWolfchaNightSteps(state), step => step.role), ['守卫', '狼人', '预言家']);
    context.wolfchaNarratorStep();
    assert.match(state.log.at(-1).text, /守卫请睁眼/);
    context.wolfchaNarratorStep();
    assert.match(state.log.at(-1).text, /狼人请睁眼/);
    context.wolfchaNarratorStep();
    assert.match(state.log.at(-1).text, /预言家请睁眼/);
    context.wolfchaNarratorStep();
    assert.equal(state.phase, 'day');
    assert.equal(state.day, 2);
    assert.ok(state.players.filter(player => player.alive).length === 5);
    state.players.forEach(player => { player.alive = false; });
    state.turnMode = 'night_intro';
    context.wolfchaNarratorStep();
    assert.match(state.log.at(-1).text, /没有需要引导/);
    context.wolfchaNarratorStep();
    assert.equal(state.turnMode, 'day_intro');
});
