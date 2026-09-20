const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { root, memoryStorage } = require('./helpers/harness.cjs');

const librarySource = fs.readFileSync(path.join(root, 'assets/characters/builtin/library.js'), 'utf8');
const moduleSource = fs.readFileSync(path.join(root, 'modules/wechat/builtin-characters.js'), 'utf8');

function harness({ characters = [], ready = 'ready', fetchOk = true, saveResult = true, prompted = false } = {}) {
    const storage = memoryStorage(prompted ? { bynd_builtin_library_prompted_v1: '1' } : {});
    const nodes = new Map();
    const state = { saves: 0, renders: 0, toasts: [] };
    const makeNode = () => {
        const node = { id: '', className: '', innerHTML: '', children: [], listeners: {}, remove() { nodes.delete(node.id); }, appendChild(child) { node.children.push(child); nodes.set(child.id, child); }, addEventListener(type, fn) { node.listeners[type] = fn; }, querySelector: () => null };
        return node;
    };
    const wechatWindow = makeNode();
    const context = vm.createContext({
        console: { warn() {}, log() {}, error() {} },
        localStorage: storage,
        window: { myCharacters: characters, _wechatCharactersStorageState: { status: ready } },
        document: { getElementById: id => id === 'app-wechat-window' ? wechatWindow : nodes.get(id) || null, createElement: () => makeNode(), body: makeNode() },
        fetch: async url => fetchOk ? { ok: true, blob: async () => ({ size: 10, type: 'image/png' }) } : { ok: false, status: 404 },
        FileReader: class { readAsDataURL() { this.result = 'data:image/png;base64,QVZBVEFS'; this.onload?.(); } },
        Image: class { set src(value) { (fetchOk ? this.onload : this.onerror)?.(); } },
        saveCharactersToStorage: async () => { state.saves += 1; return saveResult; },
        renderChatList: () => { state.renders += 1; },
        showWechatToast: text => state.toasts.push(text)
    });
    vm.runInContext(librarySource, context);
    vm.runInContext(moduleSource, context);
    return { context, L: context.window.ByndBuiltinLibrary, storage, state, nodes, characters };
}

test('the bundled library ships two complete original characters', () => {
    const { context } = harness();
    const list = context.window.ByndBuiltinCharacters.characters;
    assert.deepEqual(JSON.parse(JSON.stringify(list.map(item => item.name))), ['温今北', '商桓']);
    for (const item of list) {
        assert.match(item.description, /【角色描述】/);
        assert.match(item.description, /【性格】/);
        assert.match(item.description, /【对话样例】/);
        assert.ok(item.first_mes.length > 40, `${item.name} needs an opening`);
        assert.ok(item.alternates.length >= 1);
        assert.ok(item.worldBook.length >= 3 && item.worldBook.every(entry => entry.name && entry.content));
        assert.match(item.avatar, /^assets\/characters\/builtin\/.+\.(png|jpg)$/);
    }
    assert.match(list[0].description, /乖宝/);
    assert.match(list[1].description, /法医/);
    for (const item of list) {
        assert.doesNotMatch(item.description + JSON.stringify(item.worldBook), /演员|片场|毕业|十五岁|当红/, `${item.name}: user identity must stay out of the character card`);
        assert.match(item.description, /以聊天设置里用户自己填写的资料为准/);
        assert.equal(item.cover, `assets/characters/builtin/${item.id}-cover.jpg`);
        assert.equal(item.reference, `assets/characters/builtin/${item.id}-reference.jpg`);
    }
    assert.deepEqual(JSON.parse(JSON.stringify(list[0].avatars)), ['assets/characters/builtin/wenjinbei-alt.jpg']);
    assert.deepEqual(JSON.parse(JSON.stringify(list[1].avatars)), ['assets/characters/builtin/shanghuan-alt.jpg']);
});

test('bundled alternate avatars land in the character gallery and a missing file is skipped', async () => {
    const h = harness();
    let calls = 0;
    h.context.fetch = async url => { calls += 1; if (/alt\.jpg$/.test(url)) return { ok: true, blob: async () => ({ size: 10, type: 'image/jpeg' }) }; return { ok: true, blob: async () => ({ size: 10, type: 'image/png' }) }; };
    const char = await h.L.add('wenjinbei');
    assert.equal(calls, 4, 'main avatar, one alternate, cover and reference are fetched');
    assert.equal(char.coverImage, 'data:image/png;base64,QVZBVEFS');
    assert.equal(char.chatConfig.imageReference, 'data:image/png;base64,QVZBVEFS');
    assert.deepEqual(JSON.parse(JSON.stringify(char.avatarGallery)), ['data:image/png;base64,QVZBVEFS'], 'identical inline data is not duplicated');
    const partial = harness();
    let n = 0;
    partial.context.fetch = async () => { n += 1; return n === 1 ? { ok: true, blob: async () => ({ size: 10, type: 'image/png' }) } : { ok: false, status: 404 }; };
    partial.context.FileReader = class { readAsDataURL() { this.result = 'data:image/png;base64,' + (n === 1 ? 'MAIN' : 'ALT'); this.onload?.(); } };
    const one = await partial.L.add('wenjinbei');
    assert.equal(one.avatar, 'data:image/png;base64,MAIN');
    assert.equal(one.coverImage, '', 'a missing cover leaves the field empty');
    assert.deepEqual(JSON.parse(JSON.stringify(one.chatConfig)), {});
    assert.deepEqual(JSON.parse(JSON.stringify(one.avatarGallery)), ['data:image/png;base64,MAIN'], 'a missing alternate never blocks adding');
    const plain = harness();
    let fetched = 0;
    plain.context.fetch = async () => { fetched += 1; return { ok: true, blob: async () => ({ size: 10, type: 'image/jpeg' }) }; };
    plain.context.FileReader = class { readAsDataURL() { this.result = 'data:image/jpeg;base64,IMG' + fetched; this.onload?.(); } };
    const second = await plain.L.add('shanghuan');
    assert.deepEqual(JSON.parse(JSON.stringify(second.avatarGallery)), ['data:image/jpeg;base64,IMG1', 'data:image/jpeg;base64,IMG2'], 'both characters carry their alternate avatar');
});

test('adding a built-in character produces a normal roster entry with an inline avatar and persists it', async () => {
    const h = harness();
    const char = await h.L.add('shanghuan');
    assert.equal(h.characters.length, 1);
    assert.equal(char.builtinId, 'shanghuan');
    assert.equal(char.name, '商桓');
    assert.equal(char.avatar, 'data:image/png;base64,QVZBVEFS');
    assert.match(char.description, /前男友/);
    assert.equal(char.first_mes, char.first_mes_original);
    assert.ok(Array.isArray(char.worldBook) && char.worldBook.length >= 3);
    assert.deepEqual(JSON.parse(JSON.stringify(char.history)), []);
    assert.equal(h.state.saves, 1);
    assert.equal(h.state.renders, 1);
    assert.equal(h.L.isAdded('shanghuan'), true);
    const again = await h.L.add('shanghuan');
    assert.equal(again, char, 'adding twice returns the existing character');
    assert.equal(h.characters.length, 1);
});

test('a missing avatar file falls back to a monogram and a failed save removes the character again', async () => {
    const h = harness({ fetchOk: false, saveResult: false });
    await assert.rejects(h.L.add('wenjinbei'), /没有保存成功/);
    assert.equal(h.characters.length, 0);
    const ok = harness({ fetchOk: false });
    const char = await ok.L.add('wenjinbei');
    assert.match(char.avatar, /^data:image\/svg\+xml,/);
    assert.match(decodeURIComponent(char.avatar), />温</);
    assert.deepEqual(JSON.parse(JSON.stringify(char.avatarGallery)), [char.avatar]);
});

test('the library refuses to add while character storage is still loading', async () => {
    const h = harness({ ready: 'loading' });
    await assert.rejects(h.L.add('wenjinbei'), /还在加载/);
    assert.equal(h.L.maybePrompt(), false);
});

test('the first launch prompt opens once for an empty roster and never for existing users', () => {
    const fresh = harness();
    assert.equal(fresh.L.maybePrompt(), true);
    assert.ok(fresh.nodes.get('bynd-builtin-library'));
    assert.match(fresh.nodes.get('bynd-builtin-library').innerHTML, /温今北[\s\S]*商桓/);
    assert.equal(fresh.storage.getItem('bynd_builtin_library_prompted_v1'), '1');
    fresh.L.close();
    assert.equal(fresh.L.maybePrompt(), false, 'only prompted once');
    const existing = harness({ characters: [{ id: 'x', name: '已有角色' }] });
    assert.equal(existing.L.maybePrompt(), false);
    const remembered = harness({ prompted: true });
    assert.equal(remembered.L.maybePrompt(), false);
});

test('the picker marks added characters and adds the rest in one go', async () => {
    const h = harness({ characters: [{ id: 'x', name: '温今北', builtinId: 'wenjinbei' }] });
    h.L.open();
    const overlay = h.nodes.get('bynd-builtin-library');
    assert.match(overlay.innerHTML, /is-added[\s\S]*已添加/);
    await h.L.pickAll();
    assert.equal(h.characters.length, 2);
    assert.equal(h.characters[1].builtinId, 'shanghuan');
    assert.match(h.nodes.get('bynd-builtin-library').innerHTML, /已添加 商桓/);
    assert.deepEqual(h.state.toasts, ['已添加 商桓']);
    await h.L.pickAll();
    assert.match(h.nodes.get('bynd-builtin-library').innerHTML, /没有需要添加的角色/);
});
