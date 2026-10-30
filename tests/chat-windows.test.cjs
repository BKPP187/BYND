const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

function harness() {
    const base = {
        id: 'char_a', name: '温今北', description: '图书管理员', avatar: 'a.png', worldBook: [{ content: '图书馆' }],
        first_mes_original: '你来啦。', first_mes: '你来啦。',
        chatConfig: { nickname: '北北', bubbleCss: '.x{}', aiStatusSnapshot: { mood: '想你' }, monitorState: { on: true }, memorySummary: '上次聊到雨' },
        history: [{ type: 'text', isMe: true, content: '主窗口的秘密' }, { type: 'text', isMe: false, content: '我记得' }]
    };
    const other = { id: 'char_b', name: '商桓', chatConfig: {}, history: [] };
    const group = { id: 'group_1', isGroupChat: true, groupMembers: ['char_a'], chatConfig: {}, history: [] };
    const toasts = [], opened = [], state = { saveResult: true, saves: 0 };
    const context = vm.createContext({
        window: { myCharacters: [base, other, group] }, console: { warn() {} }, JSON, Math, Date, Promise,
        document: { querySelectorAll: () => [], getElementById: () => null },
        showWechatToast: message => toasts.push(message),
        saveCharactersToStorage: async () => { state.saves++; return state.saveResult; },
        cleanWechatVisibleContent: value => String(value || '').trim(),
        isWechatAiMetaLeakContent: () => false,
        isRichMessageContent: value => /<\w|```/.test(value),
        isWechatRegexScriptEnabled: script => !script.disabled,
        getUserProfile: () => ({ name: '小薇' })
    });
    context.window.openChat = id => { opened.push(id); };
    context.window.getWechatGroupContacts = () => context.window.myCharacters.filter(char => !char.isGroupChat);
    vm.runInContext(read('apps/wechat/chat/reply-parser.js'), context);
    vm.runInContext(read('core/character/card-parser.js'), context);
    vm.runInContext(read('apps/wechat/character/chat-windows.js'), context);
    return { context, base, other, group, toasts, opened, state };
}

test('a new window starts clean: own id, greeting only, no private state from other windows', async () => {
    const h = harness();
    const win = await h.context.createWechatChatWindow('char_a');
    assert.ok(win && win.id !== 'char_a');
    assert.equal(win.chatConfig.windowOf, 'char_a');
    assert.equal(win.chatConfig.windowLabel, '窗口 2');
    assert.deepEqual([...win.history.map(msg => msg.content)], ['你来啦。']);
    assert.doesNotMatch(JSON.stringify(win), /主窗口的秘密|想你|上次聊到雨|"on":true/);
    assert.equal(win.chatConfig.bubbleCss, '.x{}', 'appearance settings carry over');
    assert.equal(win.description, '图书管理员');
    assert.equal(h.state.saves, 1);
    assert.equal(h.context.window.myCharacters[1], win, 'listed right after the main contact');
    const third = await h.context.createWechatChatWindow(win.id);
    assert.equal(third.chatConfig.windowOf, 'char_a', 'windows of windows still belong to the main contact');
    assert.equal(third.chatConfig.windowLabel, '窗口 3');
    assert.deepEqual([...h.context.getWechatChatWindowFamily(third).map(char => char.id)], ['char_a', win.id, third.id]);
    assert.equal(h.context.getWechatChatWindowLabel(h.base), '主窗口');
});

const longGreeting = '（{{char}}穿着一件白大褂，戴着口罩和手套，拿着刀解剖鸡。那只鸡被他解剖得各个细节都有，而且还非常整齐地归类在桌子上。内脏、肌肉、骨骼分得清清楚楚，摆放得整整齐齐：肝脏颜色鲜艳、纹理清晰；肌肉丝丝分明、富有弹性；骨骼洁白光滑，没有一点瑕疵。这手法，这技术，简直像一场艺术表演。看到{{user}}拖着行李进来，他停下手中的动作，慢悠悠地放下刀，用他那一贯优雅的语调说）好久不见。';

test('window two seeds a long card greeting as separate bubbles, with dialogue on its own', async () => {
    const h = harness();
    h.base.first_mes_original = longGreeting;
    const win = await h.context.createWechatChatWindow('char_a');
    assert.ok(win.history.length >= 3, 'the scene must not become one giant bubble');
    assert.equal(win.history.at(-1).content, '好久不见。');
    assert.equal(win.history.map(msg => msg.content).join(''), longGreeting.replace('{{char}}', h.base.name).replace('{{user}}', '小薇'));
    assert.ok(win.history.slice(0, -1).every(msg => msg.type === 'offline_narration'), 'scene descriptions use narration bubbles');
    assert.equal(win.history.at(-1).type, 'text', 'only spoken dialogue uses a speech bubble');
    assert.ok(win.history.every(msg => !msg.isMe && msg.timestamp));
    assert.deepEqual(h.base.history.map(msg => msg.content), ['主窗口的秘密', '我记得']);
});

test('greeting paragraphs and explicit separators become bubbles without executing card text', async () => {
    for (const separator of ['|||', '\n', '\n\n']) {
        const h = harness();
        h.base.first_mes_original = ['你来啦', '等你好久了', '坐这里。'].join(separator);
        const win = await h.context.createWechatChatWindow('char_a');
        assert.deepEqual(Array.from(win.history, msg => msg.content), ['你来啦', '等你好久了', '坐这里。']);
    }
});

test('rich greeting cards retain their layout and embedded separators', async () => {
    const h = harness();
    const card = '<div>卡片第一行。\n卡片第二行|||原样保留。</div>';
    h.base.first_mes_original = card;
    const win = await h.context.createWechatChatWindow('char_a');
    assert.deepEqual(Array.from(win.history, msg => msg.content), [card]);
});

function legacyOpening(h) {
    h.base.first_mes_original = longGreeting;
    const win = h.context.buildWechatChatWindow(h.base);
    win.history = [{ type: 'text', isMe: false, content: h.context.getWechatCharacterGreetingContent(win), timestamp: 123 }];
    h.context.window.myCharacters.push(win);
    return win;
}

test('opening an untouched legacy window repairs its greeting once and preserves the timestamp', async () => {
    const h = harness();
    const win = legacyOpening(h);
    h.context.window.openChat(win.id);
    assert.ok(win.history.length >= 3, 'the actual open-window hook splits the old opening');
    assert.ok(win.history.every(msg => msg.timestamp === 123));
    const after = JSON.stringify(win.history);
    assert.equal(await h.context.repairWechatChatWindowGreeting(win), false);
    assert.equal(JSON.stringify(win.history), after);
    assert.equal(h.state.saves, 1);
});

test('previously split greeting scenes become narration when reopening window two', async () => {
    const h = harness();
    h.base.first_mes_original = longGreeting;
    const win = h.context.buildWechatChatWindow(h.base);
    win.history.forEach(msg => { msg.type = 'text'; msg.timestamp = 123; });
    h.context.window.myCharacters.push(win);
    h.context.window.openChat(win.id);
    assert.deepEqual(Array.from(win.history, msg => msg.type), ['offline_narration', 'offline_narration', 'text']);
    assert.equal(win.history.at(-1).content, '好久不见。');
    assert.ok(win.history.every(msg => msg.timestamp === 123));
    assert.equal(await h.context.repairWechatChatWindowGreeting(win), false, 'repair is idempotent');
});

test('narration classification spans newlines, separators, and nested parentheses without claiming dialogue asides', () => {
    const h = harness();
    for (const separator of ['\n', '|||']) {
        const char = { name: '商桓', first_mes: `（他整理好手套（动作很慢）。${separator}然后抬起眼睛。）好久不见（笑）。`, history: [] };
        h.context.seedWechatCharacterGreeting(char);
        assert.deepEqual(Array.from(char.history, msg => msg.type), ['offline_narration', 'offline_narration', 'text']);
        assert.equal(char.history.at(-1).content, '好久不见（笑）。');
    }
});

test('legacy repair leaves edited greetings, ongoing chats and main windows alone', async () => {
    for (const kind of ['edited', 'ongoing', 'main']) {
        const h = harness();
        const win = legacyOpening(h);
        if (kind === 'edited') win.history[0].content += '（手动修改）';
        if (kind === 'ongoing') win.history.push({ type: 'text', isMe: true, content: '我来了' });
        if (kind === 'main') delete win.chatConfig.windowOf;
        const before = JSON.stringify(win.history);
        assert.equal(await h.context.repairWechatChatWindowGreeting(win), false);
        assert.equal(JSON.stringify(win.history), before);
        assert.equal(h.state.saves, 0);
    }
});

test('failed legacy repair rolls back its bubbles, retains concurrent messages, and can retry', async () => {
    for (const throws of [false, true]) {
        const h = harness();
        const win = legacyOpening(h);
        const original = win.history[0];
        const userMessage = { type: 'text', isMe: true, content: '新到的消息', timestamp: 456 };
        h.context.saveCharactersToStorage = async () => {
            win.history.push(userMessage);
            if (throws) throw new Error('disk full');
            return false;
        };
        assert.equal(await h.context.repairWechatChatWindowGreeting(win), false);
        assert.deepEqual(win.history, [original, userMessage]);
        assert.deepEqual(h.toasts, ['开场白分段没有保存成功，请重新打开窗口重试']);
        win.history.pop();
        h.context.saveCharactersToStorage = async () => true;
        assert.equal(await h.context.repairWechatChatWindowGreeting(win), true);
        assert.ok(win.history.length >= 3);
    }
});

test('a failed narration upgrade restores every prior speech bubble and retains a new user message', async () => {
    const h = harness();
    h.base.first_mes_original = longGreeting;
    const win = h.context.buildWechatChatWindow(h.base);
    win.history.forEach(msg => { msg.type = 'text'; });
    const original = win.history.slice();
    const userMessage = { type: 'text', isMe: true, content: '我来了' };
    h.context.saveCharactersToStorage = async () => {
        // The real refresh pass clones narration messages before the save settles.
        win.history = win.history.map(msg => msg.type === 'offline_narration' ? { ...msg } : msg);
        win.history.push(userMessage);
        return false;
    };
    assert.equal(await h.context.repairWechatChatWindowGreeting(win), false);
    assert.deepEqual(Array.from(win.history), [...original, userMessage]);
    assert.match(h.toasts[0], /没有保存成功/);
});

test('a failed save removes the half-created window and shows no success', async () => {
    const h = harness();
    h.state.saveResult = false;
    assert.equal(await h.context.createWechatChatWindow('char_a'), null);
    assert.equal(h.context.window.myCharacters.length, 3);
    assert.deepEqual(h.toasts, ['新窗口没有保存成功，请重试']);
    assert.equal(await h.context.createWechatChatWindow('group_1'), null);
    assert.match(h.toasts.at(-1), /群聊不能新建窗口/);
});

test('windows share the persona but keep their own conversation', async () => {
    const h = harness();
    const win = await h.context.createWechatChatWindow('char_a');
    win.history.push({ type: 'text', isMe: true, content: '窗口二的剧情' });
    h.base.description = '图书管理员，最近在学做饭';
    h.base.worldBook.push({ content: '新开的面馆' });
    h.context.window.openChat(win.id);
    assert.equal(win.description, '图书管理员，最近在学做饭');
    assert.equal(win.worldBook.length, 2);
    assert.ok(!h.base.history.some(msg => msg.content === '窗口二的剧情'), 'nothing flows back into the main window');
    assert.deepEqual(h.opened, [win.id]);
    win.worldBook.push({ content: '窗口里的修改' });
    assert.equal(h.base.worldBook.length, 2, 'persona copies are independent objects');
});

test('contacts, moments and the forum see one person; monitoring sees every window', async () => {
    const h = harness();
    const win = await h.context.createWechatChatWindow('char_a');
    assert.deepEqual([...h.context.window.getWechatGroupContacts().map(char => char.id)], ['char_a', 'char_b']);
    assert.ok(h.context.window.getWechatGroupContacts({ includeWindows: true }).includes(win));
    const monitor = read('apps/monitor/monitor.js');
    assert.match(monitor, /return Array\.isArray\(window\.myCharacters\)\s*\?\s*window\.myCharacters\.filter\(char => char && char\.id && !char\.isGroupChat\)/, 'monitor list keeps windows');
    assert.match(monitor, /getWechatChatWindowLabel\(char\)/);
    assert.match(read('apps/wechat/moments/moments.js'), /isWechatChatWindow\(char\)\)\)\.slice\(0, 6\)/);
    assert.equal((read('apps/wechat/contacts/tabs.js').match(/isWechatChatWindow\(char\)/g) || []).length, 2);
    assert.match(read('apps/coreading/library.js'), /isWechatChatWindow\(char\)/);
});
