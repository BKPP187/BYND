'use strict';
const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const vm = require('node:vm');
const { memoryStorage } = require('./helpers/harness.cjs');

function harness(presets = [], activeId = null) {
    const context = vm.createContext({
        window: {}, console, Date, Intl,
        localStorage: memoryStorage({ my_presets_data: JSON.stringify({ presets, activeId }) }),
        getUserProfile: () => ({ name: '小林' }),
        getWechatChatUserProfile: () => ({ name: '小林' }),
        stripWechatPromptText: (value, max) => String(value || '').slice(0, max),
        getWechatCharDisplayName: char => char.name,
        getWechatMessagePromptContent: msg => msg.content,
        isWechatSpecialMessage: () => false,
        getWechatAiStatusSnapshot: () => null,
        sanitizeWechatAiStatusFieldValue: value => String(value || ''),
        isWechatStatusPlaceholderValue: value => !value
    });
    vm.runInContext(fs.readFileSync('apps/settings/presets.js', 'utf8'), context);
    vm.runInContext(fs.readFileSync('core/api/chat-api.js', 'utf8'), context);
    const char = { id: 'default-proof', name: '林间', description: '寡言的摄影师，讲话直接。', worldBook: [{ key: '居所', content: '住在海边。' }], chatConfig: {}, history: [] };
    return { context, char };
}

test('a clean consumer profile sends the built-in roleplay prompt together with persona and chat protocol', async () => {
    const { context, char } = harness();
    let sent;
    context.callChatApi = async messages => { sent = messages; return { ok: true, content: '我在。' }; };
    const result = await context.chatWithCharacter(char, 'history', '我想你了');
    assert.equal(result.ok, true);
    const system = sent.filter(m => m.role === 'system').map(m => m.content).join('\n');
    assert.match(system, /【BYND 默认角色互动】/);
    assert.match(system, /寡言的摄影师/);
    assert.match(system, /住在海边/);
    assert.match(system, /\|\|\|/);
    assert.equal(sent.at(-1).role, 'user');
    assert.match(sent.at(-1).content, /我想你了/);
});

test('an enabled custom prompt takes the default slot and preserves template substitution', () => {
    const { context, char } = harness([{ id: 'custom', prompts: [{ enabled: true, content: '自定义：{{char}} 与 {{user}}。' }] }], 'custom');
    const prompt = context.buildSystemPrompt(char);
    assert.match(prompt, /自定义：林间 与 小林/);
    assert.doesNotMatch(prompt, /【BYND 默认角色互动】/);
});

test('disabled, blank, invalid and extension-only presets fall back to the authored defaults', () => {
    for (const prompts of [[], [{ enabled: false, content: 'Do not use' }], [{ enabled: true, content: '   ' }], [{ enabled: true, content: 123 }]]) {
        const { context, char } = harness([{ id: 'inactive', prompts, extensions: { SPreset: {} } }], 'inactive');
        assert.match(context.buildSystemPrompt(char), /【BYND 默认角色互动】/);
        assert.doesNotMatch(context.buildSystemPrompt(char), /Do not use/);
    }
});

test('long persona text does not truncate the built-in default and group messages retain their member protocol', () => {
    const { context, char } = harness();
    char.description = '角色设定'.repeat(6000);
    const prompt = context.buildSystemPrompt(char);
    assert.match(prompt, /【BYND 默认角色互动】/);
    assert.match(prompt, /输出可见的角色回复/);
    char.isGroupChat = true;
    assert.match(context.buildSystemPrompt(char), /\[群聊发言:成员名\|消息内容\]/);
    assert.match(context.buildSystemPrompt(char), /【BYND 默认角色互动】/);
});

test('request failures are returned unchanged rather than reported as a successful roleplay response', async () => {
    const { context, char } = harness();
    const failure = { ok: false, error: '测试上游拒绝请求' };
    context.callChatApi = async () => failure;
    assert.equal(await context.chatWithCharacter(char, 'history', '你好'), failure);
});
