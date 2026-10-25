const assert = require('node:assert/strict');
const test = require('node:test');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const { root, clone, memoryStorage } = require('./helpers/harness.cjs');

const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const FILES = [
    'apps/wechat/chat/message-core.js',
    'apps/wechat/ui/message-cards.js',
    'apps/wechat/contacts/group-directives.js',
    'apps/wechat/contacts/qq-group-features.js',
    'apps/wechat/chat/media-directives.js',
    'apps/wechat/chat/reply-parser.js',
    'apps/wechat/moments/reply-actions.js',
    'apps/wechat/ui/bubble-menu.js',
    'apps/wechat/chat/stickers.js',
    'apps/wechat/ui/render.js'
];
const USER = '__wechat_qq_group_user__';

function groupHarness({ theme = 'qq', history = [] } = {}) {
    const a = { id: 'qc', name: '秦彻', chatConfig: {}, history: [] };
    const b = { id: 'sy', name: '沈星回', chatConfig: {}, history: [] };
    const c = { id: 'lc', name: '黎深', chatConfig: {}, history: [] };
    const group = { id: 'g1', name: '周末小队', isGroupChat: true, groupMembers: ['qc', 'sy', 'lc'], chatConfig: { qqGroupSettings: { memberProfiles: { qc: { role: 'admin' } } } }, history };
    const state = { theme, vibrations: [], saves: 0, saveResult: () => true, toasts: [], refreshes: 0, sheet: '', inputs: {} };
    const noop = () => {};
    const sandbox = {
        console: { log() {}, warn() {}, error() {} }, URL, setTimeout, clearTimeout, Event: class { constructor(type) { this.type = type; } },
        localStorage: memoryStorage(),
        navigator: { vibrate: pattern => { state.vibrations.push(pattern); return true; } },
        document: {
            getElementById: id => state.inputs[id] || null,
            querySelector: () => null, querySelectorAll: () => [], addEventListener: noop
        },
        addEventListener: noop, requestAnimationFrame: noop,
        myCharacters: [a, b, c, group], currentChatCharId: 'g1',
        WECHAT_QQ_GROUP_USER_ID: USER, DEFAULT_AVATAR: 'default.png'
    };
    sandbox.window = sandbox;
    const context = vm.createContext(sandbox);
    vm.runInContext(`const WECHAT_QQ_GROUP_USER_ID = '${USER}';`, context);
    for (const file of FILES) vm.runInContext(read(file), context, { filename: file });
    Object.assign(context, {
        getWechatUiThemeId: () => state.theme,
        getWechatCharDisplayName: role => role?.chatConfig?.nickname || role?.name || '对方',
        getWechatChatUserProfile: () => ({ name: '小林', avatar: 'me.png' }),
        getCurrentChatChar: () => group,
        refreshChatView: () => { state.refreshes += 1; },
        renderChatList: noop, syncWechatQQGroupSettingsEntry: noop, openWechatQQGroupMemberPicker: noop,
        showWechatToast: message => state.toasts.push(message),
        showWechatActionSheet: html => { state.sheet = html; },
        hideActionSheet: () => { state.sheet = ''; },
        saveCharactersToStorage: async () => { state.saves += 1; return state.saveResult(); },
        queueWechatCharacterVoiceAudio: noop,
        isWechatIncomingCallMessage: () => false,
        isWechatRichInputEnabled: () => false
    });
    const append = text => context.appendWechatAiMessageParts(group, null, text, { background: true });
    return { context, group, state, append, members: { a, b, c } };
}

test('A: activity levels grow with speech, can be pinned manually, and lead the QQ sender label', () => {
    const now = Date.now();
    const h = groupHarness({ history: Array.from({ length: 24 }, (_, i) => ({ type: 'text', isMe: false, senderId: 'qc', content: `第${i}句`, timestamp: now + i })) });
    assert.equal(h.context.getWechatQQGroupMemberLevel(h.group, 'qc'), 13);
    assert.equal(h.context.getWechatQQGroupMemberLevel(h.group, 'sy'), 1);
    h.group.history.push({ type: 'text', isMe: false, senderId: 'qc', content: '再说一句', timestamp: now + 99 });
    assert.equal(h.context.getWechatQQGroupMemberLevel(h.group, 'qc'), 13, 'cache refreshes with history');
    h.group.chatConfig.qqGroupSettings.memberProfiles.sy = { level: 88, title: '摸鱼王' };
    assert.equal(h.context.getWechatQQGroupMemberLevel(h.group, 'sy'), 88);

    const label = h.context.renderWechatQQGroupMessageSenderLabel(h.group, h.members.b);
    assert.match(label, /qq-group-sender/);
    assert.match(label, /wcs-qq-level-badge tier-4">LV88<\/em><em class="wcs-qq-member-badge title">摸鱼王<\/em><b>沈星回<\/b>/);
    assert.match(h.context.renderWechatQQGroupMessageSenderLabel(h.group, h.members.a), /LV\d+<\/em><em class="wcs-qq-member-badge admin">管理员/);
    h.state.theme = 'wechat';
    assert.doesNotMatch(h.context.renderWechatQQGroupMessageSenderLabel(h.group, h.members.b), /LV/, 'levels are a QQ-theme detail');
});

test('B: @ mentions are highlighted only for real members and drive the 有人@我 chip', async () => {
    const now = Date.now();
    const h = groupHarness({ history: [
        { type: 'text', isMe: true, content: '@秦彻 你来', timestamp: now - 3000 },
        { type: 'text', isMe: false, senderId: 'sy', senderName: '沈星回', content: '@小林 等我一下', timestamp: now - 2000 },
        { type: 'text', isMe: false, senderId: 'lc', content: '@路人 你好', timestamp: now - 1000 }
    ] });
    const html = h.context.highlightWechatQQGroupMentions('@小林 和 @秦彻 还有 @路人 以及 @全体成员', h.group);
    assert.match(html, /<span class="msg-qq-mention is-me">@小林<\/span>/);
    assert.match(html, /<span class="msg-qq-mention">@秦彻<\/span>/);
    assert.match(html, /<span class="msg-qq-mention is-me">@全体成员<\/span>/);
    assert.match(html, / @路人 /, 'unknown names stay plain');

    assert.equal(h.context.findWechatQQGroupUnreadMentionIndex(h.group), 1);
    h.state.saveResult = () => false;
    assert.equal(await h.context.openWechatQQGroupUnreadMention(), true);
    assert.equal(h.context.findWechatQQGroupUnreadMentionIndex(h.group), 1, 'a failed save keeps the chip');
    assert.deepEqual(h.state.toasts, ['保存失败，请重试']);
    h.state.saveResult = () => true;
    await h.context.openWechatQQGroupUnreadMention();
    assert.equal(h.context.findWechatQQGroupUnreadMentionIndex(h.group), -1);
    h.group.history.push({ type: 'text', isMe: false, senderId: 'qc', content: '@全体成员 集合', timestamp: now + 5000 });
    assert.equal(h.context.findWechatQQGroupUnreadMentionIndex(h.group), 3);
    h.group.history.push({ type: 'text', isMe: true, content: '来了', timestamp: now + 6000 });
    assert.equal(h.context.findWechatQQGroupUnreadMentionIndex(h.group), -1, 'replying in the group reads the mention');
});

test('B: typing @ in a QQ group opens the member picker and inserts the chosen name at the caret', () => {
    const h = groupHarness();
    const input = { id: 'wc-msg-input', value: '你好@后面', selectionStart: 3, setSelectionRange() {}, focus() {}, dispatchEvent() {} };
    h.state.inputs['wc-msg-input'] = input;
    h.context.handleWechatQQGroupMentionInput({ target: input, inputType: 'insertText', data: '@' });
    assert.match(h.state.sheet, /全体成员/);
    assert.match(h.state.sheet, /沈星回/);
    assert.doesNotMatch(h.state.sheet, /小林/, 'you cannot @ yourself');
    h.context.pickWechatQQGroupMention('沈星回');
    assert.equal(input.value, '你好@沈星回 后面');
    assert.equal(h.state.sheet, '');

    h.state.sheet = '';
    h.context.handleWechatQQGroupMentionInput({ target: input, inputType: 'insertText', data: 'a' });
    h.state.theme = 'wechat';
    h.context.handleWechatQQGroupMentionInput({ target: input, inputType: 'insertText', data: '@' });
    assert.equal(h.state.sheet, '', 'other themes and other characters keep the plain input');

    h.state.theme = 'qq';
    h.group.history.push({ type: 'text', isMe: false, senderId: 'lc', content: '嗯', timestamp: Date.now() });
    input.value = '';
    assert.equal(h.context.mentionWechatQQGroupMemberFromMessage(h.group.history.length - 1), true);
    assert.equal(input.value, '@黎深 ');
});

test('C: admins publish announcement cards, members cannot, and the bar can be dismissed', async () => {
    const h = groupHarness({ history: [{ type: 'text', isMe: true, content: '周末干嘛', timestamp: Date.now() - 1000 }] });
    h.append('[群聊发言:秦彻|我来安排]');
    assert.equal(h.append('[群公告:秦彻|周五晚上七点聚餐]'), 1);
    assert.equal(h.group.history.at(-1).senderId, 'qc', 'an admin who already spoke this round keeps authorship of the card');
    h.append('[群聊发言:沈星回|收到]');
    assert.equal(h.group.history.at(-1).senderId, 'sy');
    const card = h.group.history.find(msg => msg.type === 'group_announcement');
    assert.equal(card.type, 'group_announcement');
    assert.equal(card.senderId, 'qc');
    assert.equal(h.group.chatConfig.qqGroupSettings.announcement, '周五晚上七点聚餐');
    assert.match(h.context.renderWechatQQGroupAnnouncementCard(card, h.group), /群公告[\s\S]*秦彻[\s\S]*周五晚上七点聚餐/);
    assert.equal(h.context.getWechatMessageSummary(card), '[群公告] 周五晚上七点聚餐');

    h.append('[群公告:沈星回|我来发公告]');
    assert.match(h.group.history.at(-1).content, /沈星回 尝试发布群公告，但没有群管理权限/);
    assert.equal(h.group.chatConfig.qqGroupSettings.announcement, '周五晚上七点聚餐');
    const count = h.group.history.length;
    assert.equal(h.append('[群公告:秦彻|周五晚上七点聚餐]'), 0, 'the same text is not republished');
    assert.equal(h.group.history.length, count);

    assert.equal(h.context.isWechatQQGroupAnnouncementBarVisible(h.group), true);
    h.state.saveResult = () => false;
    assert.equal(await h.context.dismissWechatQQGroupAnnouncementBar(), false);
    assert.equal(h.context.isWechatQQGroupAnnouncementBarVisible(h.group), true);
    h.state.saveResult = () => true;
    assert.equal(await h.context.dismissWechatQQGroupAnnouncementBar(), true);
    assert.equal(h.context.isWechatQQGroupAnnouncementBarVisible(h.group), false);
    h.append('[群公告:秦彻|改到周六]');
    assert.equal(h.context.isWechatQQGroupAnnouncementBarVisible(h.group), true, 'a new announcement shows again');
    assert.match(h.context.buildWechatQQGroupPromptExtras(h.group), /当前群公告：改到周六/);
});

test('C: the owner\'s announcement edit posts a card and rolls back when saving fails', async () => {
    const h = groupHarness();
    Object.assign(h.context, { closeWechatQQGroupResource() {}, openWechatQQGroupSettings() {} });
    h.state.inputs['wcs-qq-edit-value'] = { value: '新学期快乐' };
    h.state.saveResult = () => false;
    await h.context.saveWechatQQGroupEditField('announcement');
    assert.equal(h.group.history.length, 0);
    assert.equal(h.group.chatConfig.qqGroupSettings.announcement, undefined);
    h.state.saveResult = () => true;
    await h.context.saveWechatQQGroupEditField('announcement');
    assert.equal(h.group.history.at(-1).type, 'group_announcement');
    assert.equal(h.group.history.at(-1).isMe, true);
    assert.equal(h.group.chatConfig.qqGroupSettings.announcementBy, USER);
});

test('D: owner/admin mutes with QQ rules; muted members cannot speak', () => {
    const h = groupHarness();
    assert.equal(h.context.parseWechatQQMuteMinutes('10分钟'), 10);
    assert.equal(h.context.parseWechatQQMuteMinutes('2小时'), 120);
    assert.equal(h.context.parseWechatQQMuteMinutes('1天'), 1440);
    assert.equal(h.context.parseWechatQQMuteMinutes('解除'), 0);
    assert.equal(h.context.parseWechatQQMuteMinutes('999天'), 43200);
    assert.equal(h.context.parseWechatQQMuteMinutes('随便'), null);

    h.append('[群禁言:沈星回|黎深|10分钟]');
    assert.match(h.group.history.at(-1).content, /沈星回 尝试禁言 黎深，但没有群管理权限/);
    h.append('[群禁言:秦彻|小林|1天]');
    assert.match(h.group.history.at(-1).content, /秦彻 没有权限禁言 小林/);
    h.append('[群禁言:秦彻|黎深|10分钟|刷屏]');
    assert.equal(h.group.history.at(-1).content, '黎深 被 秦彻 禁言10分钟：刷屏');
    assert.equal(h.context.isWechatQQGroupMemberMuted(h.group, 'lc'), true);
    assert.match(h.context.buildWechatQQGroupPromptExtras(h.group), /正在禁言的成员：黎深（禁言至/);

    const before = h.group.history.length;
    h.append('[群聊发言:黎深|我还能说话吗]');
    assert.equal(h.group.history.length, before, 'a muted member\'s speech is dropped');
    h.append('[群聊发言:沈星回|他被禁言了]');
    assert.equal(h.group.history.at(-1).senderId, 'sy');
    for (const line of ['[群聊发言:秦彻|我再说一句]', '[群聊发言:沈星回|我也是]']) {
        h.append(line);
        assert.notEqual(h.group.history.at(-1).senderId, 'lc', 'extra lines are never re-routed to the muted member and lost');
    }
    assert.equal(h.group.history.at(-1).content, '我也是');
    assert.deepEqual(clone(h.context.getWechatGroupMissingReplyMembers(h.group, 0).map(member => member.id)), [], 'a muted member is not owed a reply');

    h.group.chatConfig.qqGroupSettings.memberProfiles.sy = { role: 'admin' };
    h.append('[群禁言:秦彻|沈星回|1小时]');
    assert.match(h.group.history.at(-1).content, /没有权限禁言 沈星回/, 'admins cannot mute admins');
    h.append('[群禁言:秦彻|黎深|解除]');
    assert.equal(h.group.history.at(-1).content, '秦彻 解除了 黎深 的禁言');
    assert.equal(h.context.isWechatQQGroupMemberMuted(h.group, 'lc'), false);
});

test('D: member settings write QQ grey notices for admin, title and mute, and roll back on save failure', async () => {
    const h = groupHarness();
    const fields = { 'wcs-qq-member-remark': { value: '' }, 'wcs-qq-member-title': { value: '大厨' }, 'wcs-qq-member-role': { value: 'admin' }, 'wcs-qq-member-level': { value: '42' }, 'wcs-qq-member-mute': { value: '60' } };
    Object.assign(h.state.inputs, fields);
    h.state.saveResult = () => false;
    await h.context.saveWechatQQGroupMemberSettings('lc');
    assert.equal(h.group.history.length, 0);
    assert.equal(h.context.getWechatQQGroupMemberRole(h.group, 'lc'), 'member');
    assert.equal(h.context.isWechatQQGroupMemberMuted(h.group, 'lc'), false);
    h.state.saveResult = () => true;
    await h.context.saveWechatQQGroupMemberSettings('lc');
    assert.deepEqual(clone(h.group.history.map(msg => msg.content)), ['你已将 黎深 设为管理员', '你为 黎深 设置了专属头衔「大厨」', '黎深 被 你 禁言1小时']);
    assert.equal(h.context.getWechatQQGroupMemberLevel(h.group, 'lc'), 42);
    assert.equal(h.context.isWechatQQGroupMemberMuted(h.group, 'lc'), true);
});

test('E: group pokes name the real target, buzz only when the user is poked, and the user can poke a member', async () => {
    const h = groupHarness();
    assert.equal(h.append('[群拍一拍:秦彻|沈星回|脑袋]'), 1);
    const poke = h.group.history.at(-1);
    assert.equal(poke.pokeTargetId, 'sy');
    assert.equal(h.context.getWechatPokeText(poke, h.group), '秦彻戳了戳“沈星回”的脑袋');
    assert.equal(h.state.vibrations.length, 0, 'a poke between members does not buzz the phone');
    h.append('[群戳一戳:黎深|小林]');
    assert.equal(h.group.history.at(-1).pokeTargetId, USER);
    assert.equal(h.context.getWechatPokeText(h.group.history.at(-1), h.group), '黎深戳了戳“小林”');
    assert.equal(h.state.vibrations.length, 1);
    h.state.theme = 'wechat';
    assert.equal(h.context.getWechatPokeText(poke, h.group), '秦彻拍了拍“沈星回”的脑袋');

    h.state.saveResult = () => false;
    const count = h.group.history.length;
    assert.equal(await h.context.pokeWechatQQGroupMember('sy'), false);
    assert.equal(h.group.history.length, count);
    h.state.saveResult = () => true;
    assert.equal(await h.context.pokeWechatQQGroupMember('sy'), true);
    assert.equal(h.context.getWechatPokeText(h.group.history.at(-1), h.group), '小林拍了拍“沈星回”');
});

test('the group prompt and history carry the new QQ group rules', () => {
    const source = read('core/api/chat-api.js');
    assert.match(source, /buildWechatQQGroupPromptExtras\(group\)/);
    assert.match(source, /msg\.type === 'group_announcement' \|\| msg\.type === 'tool_result' \? 'system'/);
    const h = groupHarness();
    const extras = h.context.buildWechatQQGroupPromptExtras(h.group);
    assert.match(extras, /被 @ 的成员必须第一个回复/);
    assert.match(extras, /\[群公告:发布人\|公告内容\]/);
    assert.match(extras, /\[群禁言:操作人\|成员名\|时长\|原因\]/);
    assert.match(extras, /\[群拍一拍:成员名\|小林\|脑袋\]/);
    assert.match(read('index.html'), /contacts\/qq-group-features\.js\?v=/);
    assert.match(read('scripts/source-layout.cjs'), /contacts\/qq-group-features\.js/);
});
