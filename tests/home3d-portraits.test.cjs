'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const { memoryStorage } = require('./helpers/harness.cjs');
function harness(extra = {}) {
    const localStorage = memoryStorage(), window = { ByndHome3D: {}, myCharacters: [{ id: 'a', chatConfig: { imageReference: 'data:image/png;base64,YQ==' } }, { id: 'b', chatConfig: {} }] };
    const context = vm.createContext({ window, localStorage, Date, performance, console, setTimeout, clearTimeout, ...extra });
    for (const name of ['characters', 'state', 'bridge', 'portraits']) vm.runInContext(fs.readFileSync('apps/home3d/' + name + '.js', 'utf8'), context);
    const H = window.ByndHome3D; H.State.bind('a', { reference: 'data:image/png;base64,Yg==' });
    return { H, window, localStorage };
}
test('portrait confirmation is explicit, reference-bound, character-bound and atomic on save failure', () => {
    const { H, localStorage } = harness();
    const draft = { url: 'data:image/png;base64,Yw==', transparent: true, width: 100, height: 160, referenceKey: H.Bridge.referenceKey(H.State.load().user.reference) };
    H.State.update(data => { data.user.portraitDraft = draft; });
    assert.equal(H.State.load().user.portrait, undefined);
    const before = localStorage.getItem(H.State.key), set = localStorage.setItem;
    localStorage.setItem = () => { throw new Error('quota'); };
    assert.throws(() => H.Portraits.confirm('user'), /没有保存成功/);
    assert.equal(localStorage.getItem(H.State.key), before); localStorage.setItem = set;
    H.Portraits.confirm('user'); assert.equal(H.State.load().user.portrait.url, draft.url);
    H.State.update(data => { data.user.portraitDraft = draft; data.user.reference = 'changed'; });
    assert.throws(() => H.Portraits.confirm('user'), /参考图已更换/);
    assert.equal(H.State.load().user.portrait.url, draft.url);
    H.State.withHome(home => { home.portrait = draft; }); H.State.bind('b');
    assert.equal(H.State.home().portrait, undefined); H.State.bind('a');
    assert.equal(H.State.home().portrait.url, draft.url);
});
test('portrait generation rejects 429 with a shared image lock/cooldown and preserves the old save', async () => {
    let calls = 0;
    const { H, localStorage } = harness({ callWechatImageGenerationApi: async () => { calls++; return { ok: false, status: 429, error: 'rate limit exceeded' }; } });
    const before = localStorage.getItem(H.State.key);
    await assert.rejects(H.Portraits.generate('char', 'reference'), /rate limit/);
    await assert.rejects(H.Portraits.generate('user', 'reference'), /冷却/);
    assert.equal(calls, 1); assert.equal(localStorage.getItem(H.State.key), before);
    assert.equal(H.Portraits.busy(), false);
});
test('portrait alpha inspection distinguishes isolated art from opaque/empty output', () => {
    const { H } = harness(), pixels = new Uint8ClampedArray(8 * 8 * 4);
    for (let y = 2; y < 6; y++) for (let x = 3; x < 5; x++) pixels[(y * 8 + x) * 4 + 3] = 255;
    const box = H.Portraits.bounds(pixels, 8, 8);
    assert.equal(box.transparent, true); assert.equal(box.width, 2); assert.equal(box.height, 4);
    assert.throws(() => H.Portraits.bounds(new Uint8ClampedArray(8 * 8 * 4), 8, 8), /没有可见人物/);
    for (let i = 3; i < pixels.length; i += 4) pixels[i] = 255;
    assert.equal(H.Portraits.bounds(pixels, 8, 8).transparent, false);
});

function imageEnvironment(opaque = false) {
    const pixels = new Uint8ClampedArray(8 * 8 * 4);
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) if (opaque || (x >= 2 && x < 6 && y >= 2 && y < 6)) pixels[(y * 8 + x) * 4 + 3] = 255;
    return {
        Image: class { naturalWidth = 8; naturalHeight = 8; set src(value) { if (value) queueMicrotask(() => this.onload()); } },
        document: { createElement: () => ({ getContext: () => ({ drawImage() {}, getImageData: () => ({ data: pixels }) }), toDataURL: () => 'data:image/png;base64,Yw==' }) }
    };
}

test('successful generation creates only a transparent preview and propagates save failures', async () => {
    let options;
    const { H, localStorage } = harness({ ...imageEnvironment(), callWechatImageGenerationApi: async (_, input) => { options = input; return { ok: true, url: 'data:image/png;base64,Yw==' }; } });
    await H.Portraits.generate('user', 'reference');
    assert.equal(options.requireReference, true); assert.equal(options.editOnly, true); assert.equal(options.background, 'transparent');
    assert.equal(H.State.load().user.portrait, undefined); assert.equal(H.State.load().user.portraitDraft.transparent, true);
    H.Portraits.confirm('user');
    const before = localStorage.getItem(H.State.key);
    localStorage.setItem = () => { throw new Error('quota'); };
    await assert.rejects(H.Portraits.generate('user', 'reference'), /没有保存成功/);
    assert.equal(localStorage.getItem(H.State.key), before); assert.equal(H.Portraits.busy(), false);
});

test('delayed image results cannot be applied after a character or reference change', async () => {
    let resolveImage;
    const { H, localStorage } = harness({ ...imageEnvironment(), callWechatImageGenerationApi: () => new Promise(resolve => { resolveImage = resolve; }) });
    const pending = H.Portraits.generate('char', 'reference');
    await assert.rejects(H.Portraits.generate('user', 'reference'), /正在生成/);
    H.State.bind('b'); const before = localStorage.getItem(H.State.key);
    resolveImage({ ok: true, url: 'data:image/png;base64,Yw==' });
    await assert.rejects(pending, /同住角色已更换/);
    assert.equal(localStorage.getItem(H.State.key), before); assert.equal(H.Portraits.busy(), false);
});

test('opaque output and thrown rate-limit errors preserve the existing portrait', async () => {
    const { H, localStorage } = harness({ ...imageEnvironment(true), callWechatImageGenerationApi: async () => ({ ok: true, url: 'data:image/png;base64,Yw==' }) });
    const before = localStorage.getItem(H.State.key);
    await assert.rejects(H.Portraits.generate('user', 'reference'), /背景还不透明/);
    assert.equal(localStorage.getItem(H.State.key), before);
    const rateLimited = harness({ callWechatImageGenerationApi: async () => { throw new Error('API 429 rate limit exceeded'); } });
    await assert.rejects(rateLimited.H.Portraits.generate('user', 'reference'), /429/);
    assert.ok(rateLimited.H.Portraits.cooldownRemaining() > 0); assert.equal(rateLimited.H.Portraits.busy(), false);
});
