const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { root, sourceSection } = require('./helpers/harness.cjs');

const themeSource = fs.readFileSync(path.join(root, 'modules/wechat/ui-theme.js'), 'utf8');
const themes = [...themeSource.matchAll(/^        id: '([^']+)'/gm)].map(match => match[1]);
assert.equal(themes.length, 10);

function render(theme, content, isMe = false) {
    const rows = [];
    const escapeHtml = value => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const noop = () => {};
    const context = vm.createContext({
        window: {}, console,
        document: { createElement: () => ({ dataset: {}, classList: { add: noop }, querySelector: () => null }) },
        wcEscapeHtml: escapeHtml,
        cleanWechatVisibleContent: value => String(value || ''),
        fillWechatRegexTemplate: value => value,
        looksLikeWechatRegexPayloadSource: () => false,
        looksLikeWechatPipeStatusPayloadSource: () => false,
        getWechatChatUserProfile: () => ({}), DEFAULT_AVATAR: 'avatar',
        getWechatFirstRealAvatarSource: () => 'avatar', getWechatCharAvatarSource: () => 'avatar',
        isWechatCoupleTheme: () => theme === 'couple',
        shouldRenderWechatExternalQuote: () => false,
        renderWechatMessageQuote: () => '', isWechatImageStackMessage: () => false,
        renderWechatMessageAvatarHtml: () => '<img class="msg-avatar">',
        isWechatSpecialMessage: () => false,
        getWechatTextMessageVisibleText: message => message.content,
        buildMessageMeta: () => '<span class="msg-meta">12:00</span>',
        renderWechatBuiltinEmojiMarkersHtml: value => value,
        hasWechatBuiltinEmojiMarker: () => false,
        getWechatUiThemeId: () => theme,
        isWechatQqNumericLinkText: () => false,
        highlightWechatRednoteMentions: value => value,
        executeScriptsInElement: noop, bindWechatMusicCardPlayback: noop,
        bindWechatImageStacks: noop, applyWechatBubbleMetaContrast: noop,
        bindWechatAiAvatarInteractions: noop, bindWechatMessageRowActions: noop
    });
    vm.runInContext(sourceSection('wechat.js', 'function isRichMessageContent(', 'function cleanWechatVisibleContent('), context);
    vm.runInContext(sourceSection('wechat.js', 'function renderWechatMarkdownLite(', '// 微信聊天窗口'), context);
    vm.runInContext(sourceSection('wechat.js', 'function renderMessageBubble(', 'function bindWechatMessageRowActions('), context);
    context.renderMessageBubble({ appendChild: row => rows.push(row) }, { type: 'text', isMe, content }, 'avatar', { id: 'role', regex: [] }, 0);
    assert.equal(rows.length, 1);
    return rows[0].innerHTML;
}

for (const theme of themes) {
    test(`${theme}: authored div cards render without an outer speech bubble`, () => {
        for (const isMe of [false, true]) {
            const html = render(theme, '<div class="role-card"><button>展开角色卡</button></div>', isMe);
            assert.match(html, /class="msg-rich-card/);
            assert.match(html, /class="role-card"/);
            assert.doesNotMatch(html, /class="msg-bubble(?:\s|")/);
            assert.doesNotMatch(html, /class="msg-bubble-shell/);
        }
    });
    test(`${theme}: multiline text and Markdown keep their normal speech bubble`, () => {
        const html = render(theme, '**你好**\n第二行和 *斜体* `code`');
        assert.match(html, /class="msg-bubble(?:\s|")/);
        assert.match(html, /<strong>你好<\/strong><br>/);
        assert.match(html, /<em>斜体<\/em>/);
        assert.doesNotMatch(html, /msg-rich-card/);
    });
}
