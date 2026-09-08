const assert = require('node:assert/strict');
const test = require('node:test');
const vm = require('node:vm');
const { sourceSection, clone } = require('./helpers/harness.cjs');

function harness() {
    const char = { id: 'role', name: '原名', chatConfig: { nickname: '秦彻', userProfile: { name: '小林' } } };
    const state = { input: '坏蛋' };
    const context = vm.createContext({
        getWechatChatUserProfile: role => role?.chatConfig?.userProfile || { name: '全局名字' },
        getWechatDisplayUserName: () => '全局名字',
        getWechatCharDisplayName: role => role?.chatConfig?.nickname || role?.name || '对方',
        findWechatGroupMember: (group, id) => group.members.find(member => member.id === id),
        getWechatGroupMemberName: member => member.name,
        wcEscapeHtml: value => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'),
        document: { getElementById: () => ({ value: state.input }) },
        getCurrentChatChar: () => char,
        createMessageTimestamp: () => 123,
        syncWechatMessageDescription: message => message
    });
    vm.runInContext(sourceSection('wechat.js', 'function getWechatPokeSuffix(', 'function buildWechatSpecialBubble('), context);
    vm.runInContext(sourceSection('wechat.js', 'function buildWechatSpecialMessageFromComposer(', 'function submitWechatComposer('), context);
    return { char, state, context, text: message => context.getWechatPokeText(message, char) };
}

test('pokes display the scoped user and character names in both directions', () => {
    const h = harness();
    assert.equal(h.text({ type: 'poke', isMe: true, content: '坏蛋' }), '小林拍了拍“秦彻”的坏蛋');
    assert.equal(h.text({ type: 'poke', isMe: false, content: '肩膀' }), '秦彻拍了拍“小林”的肩膀');
    assert.equal(h.text({ type: 'poke', isMe: true, content: '小手说拍一拍' }), '小林拍了拍“秦彻”的小手说拍一拍');
});

test('legacy complete poke sentences do not duplicate names, action words, or possessives', () => {
    const h = harness();
    const cases = [
        [{ isMe: true, content: '你拍了拍对方的肩膀' }, '小林拍了拍“秦彻”的肩膀'],
        [{ isMe: true, note: '小林拍了拍秦彻的肩膀' }, '小林拍了拍“秦彻”的肩膀'],
        [{ isMe: false, content: '秦彻拍了拍“小林”的肩膀' }, '秦彻拍了拍“小林”的肩膀'],
        [{ isMe: false, content: '[微信拍一拍] 拍了拍你' }, '秦彻拍了拍“小林”'],
        [{ isMe: true, content: '你拍了拍对方' }, '小林拍了拍“秦彻”']
    ];
    for (const [message, expected] of cases) {
        const before = clone(message);
        assert.equal(h.text(message), expected);
        assert.deepEqual(message, before, 'formatting must not rewrite existing history');
    }
});

test('explicit custom suffixes preserve literal action phrases and escape markup', () => {
    const h = harness();
    const message = { isMe: true, pokeSuffix: '的肩膀说“拍一拍”<img src=x onerror=alert(1)>' };
    assert.equal(h.text(message), '小林拍了拍“秦彻”的肩膀说“拍一拍”<img src=x onerror=alert(1)>');
    const html = h.context.renderWechatPokeNotice(message, h.char);
    assert.doesNotMatch(html, /<img/);
    assert.match(html, /&lt;img/);
});

test('incoming group pokes use the actual member name', () => {
    const h = harness();
    h.char.isGroupChat = true;
    h.char.members = [{ id: 'member', name: '夏以昼' }];
    assert.equal(h.text({ isMe: false, senderId: 'member', content: '脑袋' }), '夏以昼拍了拍“小林”的脑袋');
});

test('the composer saves a full readable sentence and keeps the editable suffix separately', () => {
    const h = harness();
    const message = h.context.buildWechatSpecialMessageFromComposer('poke');
    assert.equal(message.pokeSuffix, '坏蛋');
    assert.equal(message.content, '小林拍了拍“秦彻”的坏蛋');
    assert.equal(message.note, message.content);
    h.state.input = '肩膀说“拍一拍”';
    const edited = h.context.buildWechatSpecialMessageFromComposer('poke', message);
    assert.equal(edited.timestamp, message.timestamp);
    assert.equal(h.text(edited), '小林拍了拍“秦彻”的肩膀说“拍一拍”');
});
