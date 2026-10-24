const assert = require('node:assert/strict');
const test = require('node:test');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const { root, clone, memoryStorage } = require('./helpers/harness.cjs');

const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const WECHAT_FILES = [
    'apps/wechat/chat/message-core.js',
    'apps/wechat/ui/message-cards.js',
    'apps/wechat/contacts/group-directives.js',
    'apps/wechat/chat/media-directives.js',
    'apps/wechat/chat/reply-parser.js',
    'apps/wechat/moments/reply-actions.js',
    'apps/wechat/ui/bubble-menu.js',
    'apps/wechat/chat/stickers.js',
    'apps/wechat/ui/render.js'
];

function chatHarness(history = []) {
    const char = { id: 'role-a', name: '秦彻', chatConfig: {}, history };
    const state = { vibrations: [], saves: 0, saveResult: () => true, toasts: [], refreshes: 0 };
    const noop = () => {};
    const sandbox = {
        console: { log() {}, warn() {}, error() {} }, URL, setTimeout, clearTimeout,
        localStorage: memoryStorage(),
        navigator: { vibrate: pattern => { state.vibrations.push(pattern); return true; } },
        document: { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], addEventListener: noop },
        addEventListener: noop, requestAnimationFrame: noop,
        myCharacters: [char], currentChatCharId: 'someone-else'
    };
    sandbox.window = sandbox;
    const context = vm.createContext(sandbox);
    for (const file of WECHAT_FILES) vm.runInContext(read(file), context, { filename: file });
    Object.assign(context, {
        getWechatCharDisplayName: role => role?.chatConfig?.nickname || role?.name || '对方',
        getWechatChatUserProfile: () => ({ name: '小林' }),
        getCurrentChatChar: () => char,
        refreshChatView: () => { state.refreshes += 1; },
        renderChatList: noop,
        showWechatToast: message => state.toasts.push(message),
        saveCharactersToStorage: async () => { state.saves += 1; return state.saveResult(); },
        queueWechatCharacterVoiceAudio: noop,
        getWechatUiThemeId: () => 'wechat',
        isWechatIncomingCallMessage: () => false
    });
    const append = text => context.appendWechatAiMessageParts(char, null, text, { background: true });
    return { context, char, state, append };
}

test('a character keeps a sticker the user sent and can send it back later', () => {
    const now = Date.now();
    const h = chatHarness([
        { type: 'sticker', isMe: true, content: '表情包/cat.jpg', stickerName: '开始划水', timestamp: now - 1000 },
        { type: 'text', isMe: true, content: '你看这个', timestamp: now - 500 }
    ]);
    const prompt = h.context.buildWechatStickerPrompt(h.char);
    assert.match(prompt, /用户最近发过表情「开始划水」，还没被你收藏/);
    assert.match(prompt, /\[微信收藏表情:你给它起的名字\]/);

    assert.equal(h.append('[微信收藏表情:划水猫]'), 1);
    const notice = h.char.history.at(-1);
    assert.equal(notice.type, 'system_notice');
    assert.match(notice.content, /秦彻把你发的表情存进了自己的表情包「划水猫」/);
    assert.deepEqual(clone(h.char.chatConfig.savedStickers.map(item => [item.name, item.url, item.aliases])), [['划水猫', '表情包/cat.jpg', ['开始划水']]]);

    const available = h.context.getWechatAvailableStickers(h.char);
    assert.equal(available[0].source, 'charSaved', 'the character\'s own library is offered first');
    assert.match(h.context.buildWechatStickerPrompt(h.char), /划水猫 \/ 开始划水（自己收藏的表情）/);
    assert.doesNotMatch(h.context.buildWechatStickerPrompt(h.char), /还没被你收藏/);

    assert.equal(h.append('[微信表情:划水猫]'), 1);
    const sent = h.char.history.at(-1);
    assert.equal(sent.type, 'sticker');
    assert.equal(sent.isMe, false);
    assert.equal(sent.content, '表情包/cat.jpg');
    assert.equal(sent.stickerName, '划水猫');

    // Saving the same sticker again under the same name is a no-op; a new name renames it.
    const before = h.char.history.length;
    assert.equal(h.append('[微信收藏表情:划水猫]'), 0);
    assert.equal(h.char.history.length, before, 'an unchanged save neither notifies nor leaks the raw directive');
    h.append('[微信收藏表情:摸鱼喵]');
    assert.equal(h.char.chatConfig.savedStickers.length, 1);
    assert.equal(h.char.chatConfig.savedStickers[0].name, '摸鱼喵');
    assert.ok(h.char.chatConfig.savedStickers[0].aliases.includes('划水猫'));
});

test('sticker saving picks older stickers or photos by name and refuses emoji, groups and missing sources', () => {
    const now = Date.now();
    const photo = 'data:image/jpeg;base64,' + 'A'.repeat(64);
    const h = chatHarness([
        { type: 'sticker', isMe: true, content: 'https://i.postimg.cc/x/happy.gif', stickerName: '开心', timestamp: now - 3000 },
        { type: 'image', isMe: true, content: photo, imageUrl: photo, description: '[用户发送了一张图片]', timestamp: now - 2000 },
        { type: 'sticker', isMe: true, content: 'https://cdn.jsdelivr.net/gh/airinghost/wechat-emoji@main/web.wechat.com/compressed-tinypng/smile.png', stickerName: '微笑', emoji: true, timestamp: now - 1000 },
        { type: 'sticker', isMe: false, content: '表情包/mine.jpg', stickerName: '我自己的', timestamp: now - 500 }
    ]);
    // The newest savable one is the photo: built-in emoji and the character's own stickers are skipped.
    h.append('[微信收藏表情:你的猫猫照]');
    assert.equal(h.char.chatConfig.savedStickers[0].url, photo);
    assert.match(h.char.history.at(-1).content, /图片/);
    h.append('[微信收藏表情:嘿嘿|开心]');
    assert.deepEqual(clone(h.char.chatConfig.savedStickers.map(item => item.url)), [photo, 'https://i.postimg.cc/x/happy.gif']);
    const count = h.char.history.length;
    h.append('[微信收藏表情:不存在|没发过这个]');
    assert.equal(h.char.history.length, count, 'an unknown source saves nothing and shows nothing');

    const group = chatHarness([{ type: 'sticker', isMe: true, content: '表情包/cat.jpg', stickerName: '猫', timestamp: now }]);
    group.char.isGroupChat = true;
    assert.equal(group.context.applyWechatCharStickerSaveDirective('猫', group.char), null);
    assert.equal(group.context.buildWechatCharStickerCollectPrompt(group.char), '');

    const huge = chatHarness([{ type: 'image', isMe: true, content: 'data:image/png;base64,' + 'A'.repeat(1600000), timestamp: now }]);
    assert.equal(huge.context.applyWechatCharStickerSaveDirective('太大', huge.char), null);
});

test('the sticker library is capped and entries can be removed', () => {
    const h = chatHarness([]);
    h.char.chatConfig.savedStickers = Array.from({ length: 80 }, (_, i) => ({ id: `s${i}`, name: `旧${i}`, url: `表情包/${i}.jpg` }));
    h.char.history.push({ type: 'sticker', isMe: true, content: '表情包/new.jpg', stickerName: '新', timestamp: Date.now() });
    h.context.applyWechatCharStickerSaveDirective('新的', h.char);
    assert.equal(h.char.chatConfig.savedStickers.length, 80);
    assert.equal(h.char.chatConfig.savedStickers[0].id, 's1');
    assert.equal(h.char.chatConfig.savedStickers.at(-1).url, '表情包/new.jpg');
    assert.equal(h.context.removeWechatCharSavedSticker(h.char, 's5'), true);
    assert.equal(h.context.removeWechatCharSavedSticker(h.char, 's5'), false);
    assert.equal(h.char.chatConfig.savedStickers.length, 79);
});

test('a character can recall its own recent message, never the user\'s or an old one', () => {
    const now = Date.now();
    const h = chatHarness([
        { type: 'text', isMe: false, content: '很久以前的话', timestamp: now - 10 * 60 * 1000 },
        { type: 'text', isMe: true, content: '在吗', timestamp: now - 5000 }
    ]);
    assert.equal(h.append('[微信撤回]'), 0, 'nothing recent of the character to recall');
    assert.equal(h.char.history[0].recalled, undefined);

    h.append('其实我有点想你');
    h.append('算了');
    assert.equal(h.append('[微信撤回:想你]'), 1);
    const recalled = h.char.history.find(msg => msg.content === '其实我有点想你');
    assert.equal(recalled.recalled, true);
    assert.equal(h.char.history.find(msg => msg.content === '算了').recalled, undefined);
    assert.equal(h.char.history.some(msg => msg.type === 'wechat_recall_action'), false, 'the action itself is never stored');
    assert.equal(h.char.history.find(msg => msg.content === '在吗').recalled, undefined);

    assert.equal(h.append('[撤回]'), 1, 'the bare form recalls the latest one');
    assert.equal(h.char.history.find(msg => msg.content === '算了').recalled, true);

    assert.equal(h.context.getWechatMessageSummary(recalled), '对方撤回了一条消息');
    assert.equal(h.context.getWechatRecallNoticeText(recalled, h.char), '“秦彻”撤回了一条消息');
    const html = h.context.renderWechatRecallNotice(recalled, h.char, 2);
    assert.match(html, /msg-poke-notice msg-recall-notice/, 'recall lines reuse the themed notice styling');
    assert.doesNotMatch(html, /重新编辑/);
});

test('the user can recall and re-edit a message; a failed save restores it', async () => {
    const h = chatHarness([{ type: 'text', isMe: true, content: '我说错了', timestamp: Date.now() }]);
    assert.equal(await h.context.recallWechatUserMessage(0), true);
    assert.equal(h.char.history[0].recalled, true);
    assert.match(h.context.renderWechatRecallNotice(h.char.history[0], h.char, 0), /你撤回了一条消息 <button[^>]*reeditWechatRecalledMessage\(0\)[^>]*>重新编辑/);

    const failing = chatHarness([{ type: 'text', isMe: true, content: '再说一次', timestamp: Date.now() }]);
    failing.state.saveResult = () => false;
    assert.equal(await failing.context.recallWechatUserMessage(0), false);
    assert.equal(failing.char.history[0].recalled, undefined);
    assert.deepEqual(failing.state.toasts, ['撤回失败，请重试']);

    const throwing = chatHarness([{ type: 'text', isMe: true, content: '第三次', timestamp: Date.now() }]);
    throwing.state.saveResult = () => { throw new Error('disk full'); };
    assert.equal(await throwing.context.recallWechatUserMessage(0), false);
    assert.equal(throwing.char.history[0].recalled, undefined);
});

test('recalled messages reach the model as context, and the user\'s stays private', () => {
    const source = read('core/api/chat-api.js');
    assert.match(source, /\[用户撤回了一条消息，你看不到内容\]/);
    assert.match(source, /你撤回了自己的一条消息，用户只看到“已撤回”。原内容/);
    assert.match(source, /msg\.isMe && !msg\.recalled && !isChatApiInternalHistoryMessage/, 'a recalled message is never the latest user turn');
    assert.match(source, /\[微信撤回\] 或 \[微信撤回:那句话里的关键词\]/);
    assert.match(read('apps/wechat/ui/bubble-menu.js'), /recallWechatUserMessage\(\$\{msgIdx\}\)/);
});

test('a poke from the character vibrates the phone, the bare form works, the user\'s own does not buzz', () => {
    const h = chatHarness([{ type: 'text', isMe: true, content: '嗯', timestamp: Date.now() }]);
    assert.equal(h.append('[微信拍一拍:脑袋]'), 1);
    assert.equal(h.char.history.at(-1).type, 'poke');
    assert.equal(h.state.vibrations.length, 1);
    assert.equal(h.append('[拍一拍]'), 1);
    assert.equal(h.char.history.at(-1).type, 'poke');
    assert.equal(h.state.vibrations.length, 2);
    assert.equal(h.context.getWechatPokeText(h.char.history.at(-1), h.char), '秦彻拍了拍“小林”');

    h.context.navigator.vibrate = undefined;
    assert.equal(h.context.vibrateWechatPoke(), false, 'no vibration API (iOS) is not an error');
    assert.match(read('android/app/src/main/AndroidManifest.xml'), /android\.permission\.VIBRATE/);
});

function toolHarness() {
    const char = { id: 'role-a', name: '林舟', chatConfig: { agentPreferences: { allowTools: true } }, history: [{ type: 'text', isMe: true, content: '我今天玩手机多久了', timestamp: 101 }] };
    const state = { saves: 0, saveResult: () => true };
    const nodes = [];
    const sandbox = {
        myCharacters: [char], currentChatCharId: 'someone-else',
        localStorage: memoryStorage(), console: { log() {}, warn() {}, error() {} },
        URL, URLSearchParams, Response, AbortController, setTimeout, clearTimeout,
        document: { getElementById: () => null, createElement: tag => { const node = { tagName: tag, dataset: {}, innerHTML: '', className: '', addEventListener() {} }; nodes.push(node); return node; } },
        wcEscapeHtml: value => String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'),
        refreshChatView() {}, renderChatList() {}, showWechatToast() {}, createMessageTimestamp: () => Date.now(),
        saveCharactersToStorage: async () => { state.saves += 1; return state.saveResult(); },
        ByndDecider: { replyInstructions: () => '', extractReplyDecisions: raw => ({ content: String(raw || ''), decisions: null }), gate: async () => ({ allow: true }) },
        ByndMcpBridge: {
            status: () => ({ connected: true, key: 'endpoint:https://mcp.example/mcp', name: 'Phone', tools: [{ name: 'get-app-usage', description: '读取应用使用时长' }] }),
            ensureConnected: async () => true,
            call: async () => '微信 2 小时'
        }
    };
    sandbox.window = sandbox;
    const context = vm.createContext(sandbox);
    vm.runInContext(read('systems/agent-runtime/agent-tools.js'), context);
    vm.runInContext(read('apps/wechat/character/character-tools.js'), context);
    char.chatConfig.agentMcpTools = { 'endpoint:https://mcp.example/mcp': ['get-app-usage'] };
    const render = msg => {
        const rows = [];
        context.renderWechatAgentExtras({ appendChild: node => rows.push(node) }, char, msg);
        return rows;
    };
    return { context, char, state, render };
}

test('a tool call shows "调用了 get-app-usage 工具" in the chat stream', async () => {
    const h = toolHarness();
    const result = await h.context.consumeWechatAgentResponse(h.char, '我帮你看看<bynd_tool>{"name":"mcp.call","server":"Phone","tool":"get-app-usage","arguments":{}}</bynd_tool>');
    assert.equal(result.content, '我帮你看看');
    assert.equal(result.toolCount, 1);
    const activity = h.char.chatConfig.agentActivity.at(-1);
    assert.equal(activity.tool, 'get-app-usage');
    assert.equal(activity.state, 'success');
    assert.equal(activity.anchorTimestamp, 101, 'the line sits under the message that triggered it');
    const rows = h.render({ timestamp: 101 });
    assert.equal(rows.length, 1);
    assert.match(rows[0].innerHTML, /<strong>调用了 get-app-usage 工具<\/strong><small>已完成/);
    assert.match(rows[0].innerHTML, /微信 2 小时/);
});

test('tool lines cover running, failed and built-in tools, and respect the visibility toggle', async () => {
    const h = toolHarness();
    const live = h.context.beginWechatToolActivity(h.char, 'tool', '角色工具');
    live.tool = 'get-app-usage';
    assert.match(h.render({ timestamp: 101 })[0].innerHTML, /正在调用 get-app-usage 工具<\/strong><small>执行中/);
    await h.context.finishWechatToolActivity(h.char, live, false, 'MCP 断开');
    assert.match(h.render({ timestamp: 101 })[0].innerHTML, /调用了 get-app-usage 工具<\/strong><small>未完成/);

    assert.equal(h.context.getWechatToolActivityHeadline({ title: '查天气', state: 'success' }), '调用了 查天气 工具');
    h.state.saveResult = () => false;
    const unsaved = h.context.beginWechatToolActivity(h.char, 'todo', '记录待办');
    await h.context.finishWechatToolActivity(h.char, unsaved, true, '已加入');
    assert.match(h.render({ timestamp: 101 }).at(-1).innerHTML, /本次记录尚未保存/, 'a failed save is shown, not hidden');

    h.char.chatConfig.agentPreferences.showTools = false;
    assert.equal(h.render({ timestamp: 101 }).length, 0);
});

test('the settings library lists saved stickers and a failed delete keeps the sticker', async () => {
    const h = chatHarness([]);
    h.char.chatConfig.savedStickers = [{ id: 's1', name: '划水<猫>', url: '表情包/cat.jpg' }, { id: 's2', name: '开心', url: '表情包/happy.jpg' }];
    const library = { innerHTML: '' };
    const classes = () => { const set = new Set(); return { set, toggle: (name, force) => { const on = force === undefined ? !set.has(name) : force; on ? set.add(name) : set.delete(name); } }; };
    const section = { classList: classes(), previousElementSibling: { classList: classes() } };
    h.context.document.getElementById = id => ({ 'wcs-char-sticker-library': library, 'wcs-char-sticker-section': section })[id] || null;
    h.context.confirm = () => true;
    h.context.renderWechatCharStickerLibrary(h.char);
    assert.ok(library.innerHTML.indexOf('开心') < library.innerHTML.indexOf('划水'), 'newest first');
    assert.match(library.innerHTML, /划水&lt;猫&gt;/);
    h.context.renderWechatCharStickerLibrary(h.char);
    assert.equal(section.classList.set.has('hidden'), false, 'repeat renders keep a one-to-one chat library visible');
    assert.equal(section.previousElementSibling.classList.set.has('hidden'), false);
    h.context.renderWechatCharStickerLibrary({ ...h.char, isGroupChat: true });
    assert.equal(section.classList.set.has('hidden'), true);
    h.context.renderWechatCharStickerLibrary(h.char);

    h.state.saveResult = () => false;
    assert.equal(await h.context.deleteWechatCharSavedSticker('s1'), false);
    assert.equal(h.char.chatConfig.savedStickers.length, 2);
    assert.deepEqual(h.state.toasts, ['删除失败，请重试']);
    h.state.saveResult = () => true;
    assert.equal(await h.context.deleteWechatCharSavedSticker('s1'), true);
    assert.deepEqual(clone(h.char.chatConfig.savedStickers.map(item => item.id)), ['s2']);
    h.context.renderWechatCharStickerLibrary({ ...h.char, chatConfig: {} });
    assert.match(library.innerHTML, /还没有收藏表情/);
});
