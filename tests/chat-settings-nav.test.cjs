const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const { root, sourceSection, deferred } = require('./helpers/harness.cjs');

function harness(save = async () => true) {
    const pages = ['home', 'profile', 'appearance'].map(name => ({
        dataset: { chatSettingsPage: name }, hidden: name !== 'home',
        querySelector: () => name === 'home' ? null : { textContent: name, focus() {} }
    }));
    const body = { scrollTop: 0 };
    const panel = {
        dataset: { settingsPage: 'home' },
        querySelectorAll: () => pages,
        querySelector: selector => selector === '.wcs-body' ? body : { focus() {} }
    };
    const title = {}, back = { setAttribute() {} };
    const nodes = { 'wc-chat-settings-panel': panel, 'wcs-page-title': title, 'wcs-back-btn': back };
    const toasts = [], closed = [];
    const context = vm.createContext({
        document: { getElementById: id => nodes[id] || null }, console: { error() {} },
        closeChatSettings: () => closed.push(true), closeBubblePresetPicker() {},
        saveChatSettings: save, showWechatToast: text => toasts.push(text)
    });
    vm.runInContext(sourceSection('apps/wechat/ui/chat-settings.js', 'const wechatChatSettingsScroll', 'function openChatSettings()'), context);
    return { context, pages, body, panel, toasts, closed, nodes };
}

test('category back preserves page scroll, returns home first and resets for a new chat', () => {
    const h = harness();
    h.body.scrollTop = 90;
    h.context.openWechatChatSettingsPage('profile');
    assert.equal(h.body.scrollTop, 0);
    h.body.scrollTop = 240;
    h.context.backWechatChatSettings();
    assert.equal(h.panel.dataset.settingsPage, 'home');
    assert.equal(h.body.scrollTop, 90);
    assert.equal(h.closed.length, 0);
    h.context.openWechatChatSettingsPage('profile');
    assert.equal(h.body.scrollTop, 240);
    h.context.openWechatChatSettingsPage('home', { reset: true });
    assert.equal(h.body.scrollTop, 0);
    assert.equal(h.context.openWechatChatSettingsPage('invalid-category'), 'home');
    assert.equal(h.pages.filter(page => !page.hidden).length, 1);
    h.context.backWechatChatSettings();
    assert.equal(h.closed.length, 1);
});

test('saving is single-flight and a thrown storage failure leaves retry available', async () => {
    const saving = deferred();
    const h = harness(() => saving.promise);
    const button = { disabled: false, textContent: '保存设置' };
    const first = h.context.submitWechatChatSettings(button);
    assert.equal(button.disabled, true);
    assert.equal(await h.context.submitWechatChatSettings(button), false);
    saving.reject(new Error('quota exceeded'));
    assert.equal(await first, false);
    assert.equal(button.disabled, false);
    assert.equal(button.textContent, '保存设置');
    assert.match(h.toasts[0], /保存失败/);
    assert.equal(h.closed.length, 0);
    h.context.saveChatSettings = async () => true;
    assert.equal(await h.context.submitWechatChatSettings(button), true);
});

test('QQ resource back dismisses one layer at a time', () => {
    const h = harness();
    h.nodes['wcs-qq-group-resource-page'] = {};
    h.nodes['wcs-qq-group-settings-page'] = { classList: { contains: () => true } };
    h.context.closeWechatQQGroupResource = () => { delete h.nodes['wcs-qq-group-resource-page']; };
    h.context.closeWechatQQGroupSettings = () => { delete h.nodes['wcs-qq-group-settings-page']; };
    h.context.backWechatChatSettings();
    assert.ok(h.nodes['wcs-qq-group-settings-page']);
    h.context.backWechatChatSettings();
    assert.equal(h.nodes['wcs-qq-group-settings-page'], undefined);
    assert.equal(h.closed.length, 0);
});

test('related controls live in their category and existing control ids remain unique', () => {
    const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
    const category = name => html.match(new RegExp(`<section id="wcs-page-${name}"[\\s\\S]*?</section>`))?.[0] || '';
    const controls = {
        profile: ['wcs-user-name', 'wcs-char-desc', 'wcs-avatar-gallery'],
        appearance: ['wcs-font-size', 'wcs-custom-css', 'wcs-bg-gallery'],
        interaction: ['wcs-user-title', 'wcs-monitor-enabled', 'wcs-virtual-time'],
        memory: ['wcs-prompt-worldbook-list', 'wcs-memory-segment'],
        voice: ['wcs-char-voice-provider', 'wcs-video-real-camera'],
        abilities: ['wcs-agent-features'], moments: ['wcs-moment-cover-list', 'wcs-char-signature']
    };
    for (const [name, ids] of Object.entries(controls)) for (const id of ids) {
        assert.ok(category(name).includes(`id="${id}"`), `${id} belongs to ${name}`);
        assert.equal(html.split(`id="${id}"`).length, 2, `${id} is unique`);
    }
    assert.doesNotMatch(category('home'), /<textarea|type="range"/);
    assert.doesNotMatch(category('interaction'), /id="wcs-memory|id="wcs-video/);
});
