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
        seedWechatCharacterGreeting: char => { char.history.push({ type: 'text', isMe: false, content: char.first_mes }); return true; }
    });
    context.window.openChat = id => { opened.push(id); };
    context.window.getWechatGroupContacts = () => context.window.myCharacters.filter(char => !char.isGroupChat);
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
