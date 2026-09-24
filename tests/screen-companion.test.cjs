const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { root, memoryStorage } = require('./helpers/harness.cjs');

const frame = 'data:image/jpeg;base64,' + 'A'.repeat(64);
function harness({ web = false, settings = { enabled: true } } = {}) {
    const char = { id: 'pet-a', name: '沈清', description: '成年研究员，冷静克制。', worldBook: [{ content: '与用户是同事。' }], history: [{ isMe: true, content: '我去刷会儿视频。', timestamp: 1 }], chatConfig: {} };
    const storage = memoryStorage({ bynd_screen_companion_v1: JSON.stringify(settings) });
    const state = {
        now: 1800000000000, sharedUntil: 0, calls: [], bubbles: [], configs: [], toasts: [], watch: 0,
        status: { overlay: true, usage: true, notifications: true, battery: false, oem: 'xiaomi', running: true, lastPackage: 'com.ss.android.ugc.aweme', lastLabel: '抖音' },
        answer: { ok: true, content: '{"speak":true,"text":"这个视频你已经看第三遍了。","state":"idle","confidence":0.9,"allow":true,"note":"符合人设。"}' }
    };
    class Clock extends Date { static now() { return state.now; } }
    const android = web ? undefined : {
        companionStatus: () => JSON.stringify(state.status),
        setCompanionConfig: json => state.configs.push(JSON.parse(json)),
        showCompanionBubble: (text, key) => state.bubbles.push([text, key]),
        clearCompanionPetFrames() {}, setCompanionPetFrame: () => true,
        openCompanionSetting: () => 'opened',
        startCompanionScreenWatch: () => { state.watch += 1; }, stopCompanionScreenWatch() {}
    };
    const window = { myCharacters: [char], ByndAndroid: android, addEventListener() {}, dispatchEvent() {} };
    const context = vm.createContext({
        console: { warn() {}, log() {} }, Date: Clock, localStorage: storage, window, JSON, Promise,
        document: { hidden: true, addEventListener() {}, getElementById: () => null, querySelector: () => null, querySelectorAll: () => [] },
        CustomEvent: class { constructor(type, init) { this.type = type; this.detail = init?.detail; } },
        setTimeout: () => 0, clearTimeout() {},
        getChatApiRateLimitScope: () => 'relay|model', getChatApiRateLimitPauseRemainingMs: () => Math.max(0, state.sharedUntil - state.now),
        isMonitorPetEnabled: () => true, getMonitorPetBoundChar: () => char, getMonitorCharName: c => c.name,
        getDefaultApi: () => ({ baseUrl: 'https://relay.test/v1', model: 'text-only' }),
        saveCharactersToStorage: async () => true, showWechatToast: text => state.toasts.push(text), syncMonitorPetFloating() {},
        callChatApi: async (messages, options) => { state.calls.push({ messages, options }); return typeof state.answer === 'function' ? state.answer(messages) : state.answer; }
    });
    vm.runInContext(fs.readFileSync(path.join(root, 'modules/monitor/character-pet.js'), 'utf8'), context);
    vm.runInContext(fs.readFileSync(path.join(root, 'modules/monitor/screen-companion.js'), 'utf8'), context);
    const companion = window.ByndScreenCompanion;
    const context_ = (patch = {}) => ({ package: 'com.ss.android.ugc.aweme', label: '抖音', imageDataUrl: null, at: state.now, reason: 'switch', secure: false, dwellMs: 0, ...patch });
    return { char, state, storage, companion, ctx: context_, advance: ms => { state.now += ms; } };
}
const userText = call => { const content = call.messages[1].content; return typeof content === 'string' ? content : content[0].text; };

test('one background pet request per context, gated by the minimum gap', async () => {
    const h = harness();
    const first = await h.companion.onContext(h.ctx());
    assert.equal(first.spoke, true);
    assert.equal(h.state.calls.length, 1);
    const options = h.state.calls[0].options;
    assert.equal(options.background, true);
    assert.equal(options.usageFeature, 'pet');
    assert.equal(options.usageChar, h.char);
    assert.match(userText(h.state.calls[0]), /正在用「抖音」/);
    assert.deepEqual(h.state.bubbles, [['这个视频你已经看第三遍了。', '']]);
    assert.equal(h.char.chatConfig.characterPetLog.at(-1).text, '这个视频你已经看第三遍了。');

    h.advance(60 * 1000);
    assert.equal((await h.companion.onContext(h.ctx({ reason: 'periodic' }))).reason, 'gap');
    assert.equal(h.state.calls.length, 1, 'a context inside the gap never reaches the relay');
    h.advance(3 * 60 * 1000);
    assert.equal((await h.companion.onContext(h.ctx({ reason: 'periodic' }))).spoke, true);
    assert.equal(h.state.calls.length, 2);
});

test('disabled companion and missing pet binding send nothing', async () => {
    const h = harness({ settings: { enabled: false } });
    assert.equal((await h.companion.onContext(h.ctx())).reason, 'disabled');
    assert.equal(h.state.calls.length, 0);
});

test('respects the shared pet cooldown after a rate limit', async () => {
    const h = harness({ settings: { enabled: true, minGapMin: 1 } });
    h.state.answer = { ok: false, rateLimited: true, retryAfterMs: 10 * 60 * 1000, httpStatus: 429, error: 'API 错误 (429): too many requests' };
    assert.equal((await h.companion.onContext(h.ctx())).reason, 'error');
    h.advance(2 * 60 * 1000);
    h.state.answer = { ok: true, content: '{"speak":true,"text":"嗯","allow":true}' };
    assert.equal((await h.companion.onContext(h.ctx())).reason, 'cooldown');
    assert.equal(h.state.calls.length, 1);
    h.advance(9 * 60 * 1000);
    h.state.sharedUntil = h.state.now + 60000;
    assert.equal((await h.companion.onContext(h.ctx())).reason, 'cooldown', 'the relay-wide pause also holds the companion back');
    assert.equal(h.state.calls.length, 1);
});

test('silence, failed self-check and over-long remarks', async () => {
    const h = harness({ settings: { enabled: true, minGapMin: 1 } });
    h.state.answer = { ok: true, content: '{"speak":false,"text":"","allow":true,"note":"安静陪着。"}' };
    assert.equal((await h.companion.onContext(h.ctx())).reason, 'silent');
    h.advance(2 * 60 * 1000);
    h.state.answer = { ok: true, content: '{"speak":true,"text":"宝贝别刷了陪我","allow":false,"note":"过度亲昵。"}' };
    assert.equal((await h.companion.onContext(h.ctx())).reason, 'silent');
    h.advance(2 * 60 * 1000);
    h.state.answer = { ok: true, content: '不是 JSON' };
    assert.equal((await h.companion.onContext(h.ctx())).reason, 'silent');
    assert.equal(h.state.bubbles.length, 0);
    assert.equal(h.char.chatConfig.characterPetLog, undefined);
    h.advance(2 * 60 * 1000);
    h.state.answer = { ok: true, content: '```json\n{"speak":true,"text":"' + '字'.repeat(45) + '","allow":true}\n```' };
    const result = await h.companion.onContext(h.ctx());
    assert.equal(result.spoke, true);
    assert.equal(Array.from(result.text).length, 30);
});

test('black or protected frames fall back to the app name; images only when 看屏幕 is on', async () => {
    const h = harness({ settings: { enabled: true, watchScreen: true, minGapMin: 1 } });
    await h.companion.onContext(h.ctx({ imageDataUrl: null, secure: true }));
    assert.equal(typeof h.state.calls[0].messages[1].content, 'string');
    assert.match(userText(h.state.calls[0]), /受保护的黑屏/);
    h.advance(2 * 60 * 1000);
    await h.companion.onContext(h.ctx({ imageDataUrl: frame }));
    assert.equal(h.state.calls[1].messages[1].content[1].image_url.url, frame);
    h.companion.saveSettings({ watchScreen: false });
    h.advance(2 * 60 * 1000);
    await h.companion.onContext(h.ctx({ imageDataUrl: frame }));
    assert.equal(typeof h.state.calls[2].messages[1].content, 'string', 'a stray frame is dropped when 看屏幕 is off');
});

test('a model without vision is remembered and later contexts go by app name only', async () => {
    const h = harness({ settings: { enabled: true, watchScreen: true, minGapMin: 1 } });
    h.state.answer = { ok: false, httpStatus: 400, error: 'API 错误 (400): image_url is not supported。当前聊天模型可能不支持图片识别' };
    assert.equal((await h.companion.onContext(h.ctx({ imageDataUrl: frame }))).reason, 'error');
    assert.equal(h.state.calls.length, 1, 'no second request inside the same context');
    h.advance(2 * 60 * 1000);
    h.state.answer = { ok: true, content: '{"speak":false,"allow":true}' };
    await h.companion.onContext(h.ctx({ imageDataUrl: frame }));
    assert.equal(typeof h.state.calls[1].messages[1].content, 'string');
    assert.match(userText(h.state.calls[1]), /不支持看图/);
});

test('exclusion list covers BYND, system UI, launchers, payment apps and user additions', async () => {
    const h = harness();
    const { isExcluded } = h.companion;
    for (const pkg of ['cc.ccwu.bynd', 'com.android.systemui', 'com.miui.home', 'com.eg.android.AlipayGphone', 'com.icbc.mobile', 'com.x8bit.bitwarden', '']) assert.equal(isExcluded(pkg), true, pkg);
    for (const pkg of ['com.ss.android.ugc.aweme', 'com.xingin.xhs', 'com.tencent.tmgp.sgame', 'com.tencent.mm']) assert.equal(isExcluded(pkg), false, pkg);
    assert.deepEqual([...h.companion.parseExclusions('com.tencent.mm\n  not a package!  ，org.example.bank')], ['com.tencent.mm', 'org.example.bank']);
    h.companion.saveSettings({ exclusions: ['com.tencent.mm'] });
    assert.equal(isExcluded('com.tencent.mm'), true);
    assert.equal((await h.companion.onContext(h.ctx({ package: 'com.tencent.mm', label: '微信' }))).reason, 'excluded');
    assert.equal((await h.companion.onContext(h.ctx({ package: 'com.eg.android.AlipayGphone', label: '支付宝', imageDataUrl: frame }))).reason, 'excluded');
    assert.equal(h.state.calls.length, 0);
    assert.equal(h.companion.syncNative(), true);
    const sent = h.state.configs.at(-1);
    assert.ok(sent.exclusions.includes('com.tencent.mm') && sent.exclusions.includes('com.eg.android.AlipayGphone'));
    assert.equal(sent.charName, '沈清');
});

test('native projection end turns 看屏幕 off; notification close disables the companion', () => {
    const h = harness({ settings: { enabled: true, watchScreen: true } });
    h.companion.onNativeState({ event: 'projection-ended', projection: false });
    assert.equal(h.companion.settings().watchScreen, false);
    assert.equal(h.state.configs.at(-1).watchScreen, false);
    h.companion.onNativeState({ event: 'closed', running: false });
    assert.equal(h.companion.settings().enabled, false);
});

test('test button speaks for the last seen app even when auto mode is off', async () => {
    const h = harness({ settings: { enabled: false } });
    const result = await h.companion.test();
    assert.equal(result.spoke, true);
    assert.match(userText(h.state.calls[0]), /抖音/);
    assert.match(h.state.toasts.at(-1), /沈清：/);
});

test('web build has no bridge: Android-only notice and no native calls', async () => {
    const h = harness({ web: true });
    assert.match(h.companion.renderSection(), /安卓 App/);
    assert.doesNotMatch(h.companion.renderSection(), /data-sc-action="toggle-enabled"/);
    assert.equal(h.companion.syncNative(), false);
    assert.equal(h.companion.status().available, false);
    assert.equal((await h.companion.test()).reason, 'web');
    assert.equal(h.state.calls.length, 0);
});

test('Android section renders permission checklist with live states and OEM guidance', () => {
    const h = harness();
    const html = h.companion.renderSection();
    for (const kind of ['overlay', 'usage', 'notifications', 'battery', 'autostart', 'popup', 'power', 'game']) assert.match(html, new RegExp(`data-sc-open="${kind}"`));
    assert.match(html, /截图只发送给你自己配置的模型 API，不保存/);
    assert.match(html, /小米/);
    assert.match(html, /忽略电池优化<\/strong><small>[^<]*<\/small><\/span><span class="sc-state">未开启/);
});
