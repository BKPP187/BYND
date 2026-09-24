const assert = require('node:assert/strict');
const test = require('node:test');
const vm = require('node:vm');
const { sourceSection } = require('./helpers/harness.cjs');

// Exercises the live streaming preview with a DOM stand-in: segments are
// derived from the raw stream, directives and control blocks stay hidden, and
// the final pipeline replaces the preview.
function element(tag) {
    const node = {
        tagName: tag, className: '', innerHTML: '', style: {}, dataset: {}, children: [], attributes: {}, isConnected: false, parent: null,
        classList: {
            toggle(name, force) { const on = force === undefined ? !node.className.includes(name) : !!force; node.className = node.className.split(' ').filter(item => item && item !== name).concat(on ? [name] : []).join(' '); },
            contains(name) { return node.className.split(' ').includes(name); }
        },
        setAttribute(name, value) { node.attributes[name] = String(value); },
        appendChild(child) { child.parent = node; child.isConnected = node.isConnected; node.children.push(child); return child; },
        remove() { if (node.parent) node.parent.children = node.parent.children.filter(child => child !== node); node.parent = null; node.isConnected = false; },
        querySelector(selector) {
            const wanted = selector.replace('.', '');
            const find = current => {
                for (const child of current.children) {
                    if (child.className.split(' ').includes(wanted)) return child;
                    const nested = find(child);
                    if (nested) return nested;
                }
                return null;
            };
            return find(node);
        },
        get scrollHeight() { return 1000; }, scrollTop: 900, clientHeight: 100
    };
    return node;
}

function harness() {
    const char = { id: 'role', name: '林舟', chatConfig: { fontSize: 16 }, history: [] };
    const container = element('div');
    container.isConnected = true;
    const frames = [];
    const context = vm.createContext({
        window: { currentChatCharId: char.id },
        document: { createElement: element, getElementById: id => id === 'chat-room-content' ? container : null },
        requestAnimationFrame: callback => { frames.push(callback); return frames.length; },
        setTimeout, DEFAULT_AVATAR: 'avatar',
        getWechatFirstRealAvatarSource: value => value, getWechatCharAvatarSource: () => 'avatar.png',
        renderWechatMessageAvatarHtml: () => '<img class="msg-avatar">',
        createMessageTimestamp: () => 1,
        wcEscapeHtml: value => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'),
        renderWechatBuiltinEmojiMarkersHtml: html => html.replace(/\[\[WECHAT_EMOJI:([^\]]+)\]\]/g, '<img class="wc-inline-wechat-emoji" alt="$1">'),
        hasWechatBuiltinEmojiMarker: text => /\[\[WECHAT_EMOJI:[^\]]+\]\]/.test(text)
    });
    vm.runInContext(sourceSection('wechat.js', 'function cleanWechatVisibleContent(', 'function isWechatAiMetaLeakContent('), context);
    vm.runInContext(sourceSection('wechat.js', 'function isWechatAiMetaLeakContent(', 'function wcEscapeHtml('), context);
    vm.runInContext(sourceSection('wechat.js', 'const WECHAT_AI_DIRECTIVE_COMMANDS = [', 'function readWechatAiDirectiveAt('), context);
    vm.runInContext(sourceSection('wechat.js', 'function readWechatAiDirectiveAt(', 'function hasWechatUnclosedDirectiveTail('), context);
    vm.runInContext(sourceSection('wechat.js', '// --- 流式回复：边生成边显示 ---', 'async function triggerAiAfterMessage('), context);
    const flush = () => { while (frames.length) frames.shift()(); };
    return { context, char, container, flush };
}

test('stream preview segments hide control blocks, unfinished directives and meta leaks', () => {
    const h = harness();
    // Arrays cross the vm boundary with a foreign prototype; copy them before deep-equal.
    const segments = value => Array.from(h.context.getWechatStreamPreviewSegments(value));
    assert.deepEqual(segments('<bynd_summary>先安抚</bynd_summary>你来啦'), ['你来啦']);
    assert.deepEqual(segments('<bynd_summary>还在写摘要'), []);
    assert.deepEqual(segments('<thinking>私有推理</thinking>今天好吗||我在泡茶'), ['今天好吗', '我在泡茶']);
    assert.deepEqual(segments('<think>半截推理'), []);
    assert.deepEqual(segments('看这张 [微信图片:窗边的猫'), ['看这张']);
    assert.deepEqual(segments('看这张 [微信图片:窗边的猫|说明] 好看吧'), ['看这张  好看吧']);
    assert.deepEqual(segments('<bynd_tool>{"name":"todo.add"'), []);
    assert.deepEqual(segments('笑一个 [[WECHAT_EMOJI:微'), ['笑一个']);
    assert.deepEqual(segments('笑一个 [[WECHAT_EMOJI:微笑]]'), ['笑一个 [[WECHAT_EMOJI:微笑]]']);
    assert.deepEqual(segments('[状态栏]：开心'), []);
    assert.deepEqual(segments('|||'), []);
});

test('the preview paints one bubble per segment, updates in place, and disappears once the reply is appended', () => {
    const h = harness();
    const preview = h.context.createWechatStreamPreview(h.char, h.container);
    preview.update('<bynd_summary>先接住</bynd_summary>你来');
    preview.update('<bynd_summary>先接住</bynd_summary>你来啦～');
    assert.equal(h.container.children.length, 0, 'painting waits for the animation frame');
    h.flush();
    assert.equal(h.container.children.length, 1);
    const row = h.container.children[0];
    assert.match(row.className, /msg-row left msg-stream-preview/);
    const shell = row.querySelector('.msg-bubble-shell');
    assert.equal(shell.children.length, 1);
    assert.equal(shell.children[0].style.fontSize, '16px');
    assert.match(shell.children[0].querySelector('.msg-text').innerHTML, /^你来啦～<span class="msg-stream-cursor"/);
    assert.equal(row.attributes['aria-live'], 'polite');

    preview.update('<bynd_summary>先接住</bynd_summary>你来啦～||我在泡茶 [[WECHAT_EMOJI:微笑]]');
    h.flush();
    assert.equal(shell.children.length, 2);
    assert.doesNotMatch(shell.children[0].querySelector('.msg-text').innerHTML, /msg-stream-cursor/, 'only the last bubble carries the cursor');
    assert.match(shell.children[1].querySelector('.msg-text').innerHTML, /wc-inline-wechat-emoji/);
    assert.equal(shell.children[1].classList.contains('wechat-emoji-text'), true);
    assert.equal(h.container.scrollTop, 1000, 'the view follows the stream when the reader is near the bottom');

    preview.clear();
    assert.equal(h.container.children.length, 0);
    preview.update('重试后的新内容');
    h.flush();
    assert.equal(h.container.children.length, 1, 'a retry can stream again after clear');
    preview.remove();
    assert.equal(h.container.children.length, 0);
    preview.update('晚到的数据');
    h.flush();
    assert.equal(h.container.children.length, 0, 'nothing is painted after remove');
});

test('the preview never renders for another chat', () => {
    const h = harness();
    h.context.window.currentChatCharId = 'someone-else';
    const preview = h.context.createWechatStreamPreview(h.char, h.container);
    preview.update('你来啦');
    h.flush();
    assert.equal(h.container.children.length, 0);
});
