const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { sourceSection } = require('./helpers/harness.cjs');

function classList() {
    const values = new Set();
    return {
        values,
        add: name => values.add(name),
        remove: name => values.delete(name),
        contains: name => values.has(name),
        toggle(name, force) { if (force) values.add(name); else values.delete(name); }
    };
}

function element(id = '') {
    return { id, innerHTML: '', textContent: '', src: '', disabled: false, className: '', classList: classList() };
}

function harness(saveResult = true) {
    const char = { id: 'role', avatar: 'A', avatarGallery: ['A', 'B', 'C'] };
    const elements = new Map([
        'wcs-avatar-gallery', 'wcs-avatar-add-btn', 'wcs-avatar-manage-btn', 'wcs-avatar-cancel-btn',
        'wcs-avatar-delete-selected-btn', 'wcs-char-avatar'
    ].map(id => [id, element(id)]));
    const host = { appendChild(node) { elements.set(node.id, node); } };
    const state = { saves: 0, refreshes: 0, renders: 0, toasts: [] };
    const context = vm.createContext({
        window: { myCharacters: [char], currentChatCharId: char.id },
        document: {
            getElementById: id => elements.get(id) || null,
            createElement: () => element()
        },
        console: { error() {} },
        DEFAULT_AVATAR: 'fallback',
        wcEscapeAttr: value => String(value),
        getCurrentChatChar: () => char,
        getWechatModalRoot: () => host,
        saveCharactersToStorage: async () => { state.saves++; return saveResult; },
        refreshChatView: () => { state.refreshes++; },
        renderChatList: () => { state.renders++; },
        showWechatToast: text => state.toasts.push(text)
    });
    vm.runInContext(sourceSection('wechat.js', 'function getWechatAvatarManagementState', 'function addCharAvatarToGallery'), context);
    return { context, char, elements, state };
}

test('avatar management enters a clean selection mode and atomically deletes selected avatars', async () => {
    const h = harness(true);
    h.context.renderAvatarGallery(h.char);
    assert.doesNotMatch(h.elements.get('wcs-avatar-gallery').innerHTML, /wcs-avatar-gallery-delete/);
    h.context.beginWechatAvatarManagement();
    assert.equal(h.elements.get('wcs-avatar-delete-selected-btn').disabled, true);
    h.context.handleWechatAvatarGalleryTap(0);
    h.context.handleWechatAvatarGalleryTap(1);
    assert.equal(h.elements.get('wcs-avatar-delete-selected-btn').textContent, '删除 (2)');
    await h.context.confirmDeleteSelectedWechatAvatars();
    assert.deepEqual(Array.from(h.char.avatarGallery), ['C']);
    assert.equal(h.char.avatar, 'C');
    assert.equal(h.state.saves, 1);
    assert.equal(h.state.refreshes, 1);
    assert.match(h.state.toasts[0], /2 张/);
});

test('a failed avatar deletion restores the gallery and current avatar without claiming success', async () => {
    const h = harness(false);
    h.context.renderAvatarGallery(h.char);
    h.context.beginWechatAvatarManagement();
    h.context.handleWechatAvatarGalleryTap(0);
    await h.context.confirmDeleteSelectedWechatAvatars();
    assert.deepEqual(Array.from(h.char.avatarGallery), ['A', 'B', 'C']);
    assert.equal(h.char.avatar, 'A');
    assert.equal(h.state.refreshes, 0);
    assert.equal(h.state.toasts.length, 0);
    assert.ok(h.context.window._wechatAvatarManageState, 'selection remains so the user can retry or cancel');
});

test('contact subtitles never expose the character card before AI profile generation', () => {
    const context = vm.createContext({ getWechatAiContactProfile: () => null });
    vm.runInContext(sourceSection('wechat.js', 'function getWechatProfileBio', 'function getWechatCharMoments'), context);
    const char = { name: '温今北', description: '【角色描述】私密人设原文', chatConfig: {} };
    assert.equal(context.getWechatProfileBio(char), '微信资料待 AI 生成');
    context.getWechatAiContactProfile = () => ({ bio: '由 AI 生成的公开资料' });
    assert.equal(context.getWechatProfileBio(char), '由 AI 生成的公开资料');
});
