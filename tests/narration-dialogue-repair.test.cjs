const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { root, sourceSection } = require('./helpers/harness.cjs');

// Dialogue that echoed the 【消息时间：…】 history label used to be saved as offline narration.
function harness() {
    const context = vm.createContext({ window: {}, console: { log() {}, warn() {}, error() {} } });
    vm.runInContext(fs.readFileSync(path.join(root, 'core/api/chat-api.js'), 'utf8'), context);
    context.cleanWechatVisibleContent = value => context.cleanChatApiVisibleContent(String(value || ''));
    context.stripWechatUserAgencyFromNarration = value => value;
    context.hasWechatRichTag = () => false;
    context.normalizeWechatMergedRichContent = parts => parts.join('\n');
    context.isWechatRichFragmentComplete = () => true;
    vm.runInContext(sourceSection('wechat.js', 'function normalizeWechatOfflineNarrationText(', 'function stripWechatUserAgencyFromNarration('), context);
    vm.runInContext(sourceSection('wechat.js', 'function repairWechatAllNarrationReplies(', 'function splitWechatSentenceChunks('), context);
    vm.runInContext(sourceSection('wechat.js', 'function isWechatOfflineNarrationSentence(', 'function splitWechatOfflinePlainText('), context);
    return context;
}

test('a trailing bracket no longer turns dialogue into narration', () => {
    const c = harness();
    assert.equal(c.isWechatOfflineNarrationSentence('好吧（笑）'), false);
    assert.equal(c.isWechatOfflineNarrationSentence('至于蘑菇，希望他至少有常识让它彻底煮熟了。【消息时间：2026年9月23日 星期三 23:22】'), false);
    assert.equal(c.isWechatOfflineNarrationSentence('（他低头看了眼手机）'), true);
});

test('saved narration that still carries an echoed time label is restored as dialogue', () => {
    const c = harness();
    const char = { history: [
        { isMe: false, type: 'offline_narration', content: '至于蘑菇，希望他至少有常识让它彻底煮熟了。【消息时间：2026年9月23日 星期三 23:22】', timestamp: 1 },
        { isMe: false, type: 'offline_narration', content: '他抬眼看向窗外，雨声很轻。', timestamp: 2 }
    ] };
    assert.equal(c.migrateWechatNarrationHistory(char), true);
    assert.equal(char.history[0].type, 'text');
    assert.equal(char.history[0].content, '至于蘑菇，希望他至少有常识让它彻底煮熟了。');
    assert.equal(char.history[1].type, 'offline_narration');
});

test('narration bubbles offer a manual convert-to-message action', () => {
    const source = fs.readFileSync(path.join(root, 'wechat.js'), 'utf8');
    assert.match(source, /if \(isNarration\) html \+= `<div class="msg-action-item" onclick="convertWechatNarrationToText\(\$\{msgIdx\}\)"/);
    assert.match(source, /function convertWechatNarrationToText\(msgIdx\) \{[\s\S]*?type: 'text'[\s\S]*?saveCharactersToStorage\(\)/);
});

test('a reply saved entirely as narration after its labels were scrubbed is restored, real narration stays', () => {
    const c = harness();
    const n = (content, timestamp) => ({ isMe: false, type: 'offline_narration', content, description: '', timestamp });
    const char = { history: [
        { isMe: true, type: 'text', content: '蘑菇可好吃了', timestamp: 1 },
        n('顾野？挺好。', 2),
        n('至于蘑菇，希望他至少有常识让它彻底煮熟了。', 3),
        { isMe: false, type: 'sticker', content: 'a.gif', timestamp: 4 },
        { isMe: true, type: 'text', content: '哼', timestamp: 5 },
        n('侧过头看着坐在旁边的上官落，忍不住轻笑出声。', 6),
        { isMe: false, type: 'text', content: '行，听你的。', timestamp: 7 }
    ] };
    assert.equal(c.migrateWechatNarrationHistory(char), true);
    assert.deepEqual(Array.from(char.history, msg => msg.type), ['text', 'text', 'text', 'sticker', 'text', 'offline_narration', 'text']);
    assert.equal(char.history[1].content, '顾野？挺好。');
});
