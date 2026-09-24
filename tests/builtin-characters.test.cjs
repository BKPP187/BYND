const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { root, memoryStorage } = require('./helpers/harness.cjs');

const librarySource = fs.readFileSync(path.join(root, 'assets/characters/builtin/library.js'), 'utf8');
const moduleSource = fs.readFileSync(path.join(root, 'modules/wechat/builtin-characters.js'), 'utf8');
const artworkSource = fs.readFileSync(path.join(root, 'assets/characters/builtin/artwork.js'), 'utf8');

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
        console: { warn() {}, log() {}, error() {}, info() {} },
        localStorage: storage,
        window: { myCharacters: characters, _wechatCharactersStorageState: { status: ready } },
        document: { getElementById: id => id === 'app-wechat-window' ? wechatWindow : nodes.get(id) || null, createElement: () => makeNode(), body: makeNode() },
        fetch: async url => fetchOk ? { ok: true, blob: async () => ({ size: 10, type: 'image/png' }) } : { ok: false, status: 404 },
        FileReader: class { readAsDataURL() { this.result = 'data:image/png;base64,QVZBVEFS'; this.onload?.(); } },
        Image: class { set src(value) { (fetchOk ? this.onload : this.onerror)?.(); } },
        saveCharactersToStorage: async () => { state.saves += 1; return saveResult; },
        renderChatList: () => { state.renders += 1; },
        showWechatToast: text => state.toasts.push(text),
        Blob: class { constructor(parts, options = {}) { this.parts = parts; this.size = 10; this.type = options.type || ''; } }
    });
    vm.runInContext(librarySource, context);
    vm.runInContext(moduleSource, context);
    return { context, L: context.window.ByndBuiltinLibrary, storage, state, nodes, characters };
}

test('bundled bytes survive blocked file requests, repair old contacts idempotently, and expose mood indices', async () => {
    const old = { id: 'old', builtinId: 'wenjinbei', name: '温今北', avatar: 'assets/characters/builtin/wenjinbei.jpg', avatarGallery: [], history: [{content:'保留聊天'}], description: '保留修改' };
    const h = harness({ characters: [old] });
    vm.runInContext(artworkSource, h.context);
    h.context.fetch = () => { throw new Error('file CORS'); };
    h.context.XMLHttpRequest = class { open() {} send() { this.onerror(); } };
    const assets = h.context.window.ByndBuiltinArtwork;
    for (const [name, data] of Object.entries(assets)) {
        assert.deepEqual(Buffer.from(data.split(',')[1], 'base64'), fs.readFileSync(path.join(root, name)), name);
    }
    await Promise.all([h.L.repair(), h.L.repair()]);
    assert.equal(h.state.saves, 1);
    assert.equal(old.avatarGallery.length, 6);
    assert.equal(old.history[0].content, '保留聊天');
    assert.equal(old.description, '保留修改');
    assert.ok(h.L.list()[0].complete);
    assert.match(h.L.avatarOptions(old).join(';'), /6：脸红期待/);
    old.avatarGallery.push('custom-angry.png');
    old.avatarMoods = { 'custom-angry.png': '生气' };
    assert.match(h.L.avatarOptions(old).join(';'), /7：生气/);
    const second = await h.L.add('shanghuan');
    assert.equal(second.avatarGallery.length, 5);
    assert.ok(h.L.list()[1].complete);
});

test('repair rolls back on a rejected save and can be retried without losing custom artwork', async () => {
    const old = { id: 'old', builtinId: 'shanghuan', name: '商桓', avatar: 'data:image/png;base64,CUSTOM', avatarGallery: ['data:image/png;base64,CUSTOM'], chatConfig: {nickname:'备注'} };
    const before = JSON.stringify(old);
    const h = harness({ characters: [old], saveResult: false });
    vm.runInContext(artworkSource, h.context);
    const result = await h.L.repair();
    assert.equal(result.saved, false);
    assert.equal(result.repaired.length, 0);
    assert.equal(JSON.stringify(old), before);
    h.context.saveCharactersToStorage = async () => true;
    await h.L.repair();
    assert.equal(old.avatar, 'data:image/png;base64,CUSTOM');
    assert.equal(old.chatConfig.nickname, '备注');
    assert.equal(old.avatarGallery.length, 5);
});

test('the bundled library ships two complete original characters', () => {
    const { context } = harness();
    const list = context.window.ByndBuiltinCharacters.characters;
    assert.deepEqual(JSON.parse(JSON.stringify(list.map(item => item.name))), ['温今北', '商桓']);
    for (const item of list) {
        assert.match(item.description, /【角色描述】/);
        assert.match(item.description, /【性格】/);
        assert.doesNotMatch(item.description, /【对话样例】|<START>/, `${item.name}: no scripted dialogue samples`);
        assert.ok(item.first_mes.length > 40, `${item.name} needs an opening`);
        assert.ok(item.alternates.length >= 1);
        assert.ok(item.worldBook.length >= 3 && item.worldBook.every(entry => entry.name && entry.content));
        assert.match(item.avatar, /^assets\/characters\/builtin\/.+\.(png|jpg)$/);
    }
    assert.match(list[0].description, /乖宝/);
    assert.match(list[1].description, /法医/);
    for (const item of list) {
        assert.doesNotMatch(item.description + JSON.stringify(item.worldBook), /演员|片场|毕业|十五岁|当红/, `${item.name}: user identity must stay out of the character card`);
        assert.doesNotMatch(item.description, /以聊天设置里用户自己填写的资料为准/, `${item.name}: the user-identity rule lives in the prompt, not the card`);
        assert.equal(item.cover, `assets/characters/builtin/${item.id}-cover.jpg`);
        assert.equal(item.reference, `assets/characters/builtin/${item.id}-reference.jpg`);
    }
    assert.deepEqual(JSON.parse(JSON.stringify(list[0].avatars)), ['wenjinbei-alt.jpg', 'wenjinbei-alt-02.jpg', 'wenjinbei-alt-03.jpg', 'wenjinbei-alt-04.jpg', 'wenjinbei-alt-05.jpg'].map(name => 'assets/characters/builtin/' + name));
    assert.deepEqual(JSON.parse(JSON.stringify(list[1].avatars)), ['shanghuan-alt.jpg', 'shanghuan-alt-02.jpg', 'shanghuan-alt-03.jpg', 'shanghuan-alt-04.jpg'].map(name => 'assets/characters/builtin/' + name));
});

test('bundled alternate avatars land in the character gallery and a missing file is skipped', async () => {
    const h = harness();
    let calls = 0;
    h.context.fetch = async url => { calls += 1; if (/alt\.jpg$/.test(url)) return { ok: true, blob: async () => ({ size: 10, type: 'image/jpeg' }) }; return { ok: true, blob: async () => ({ size: 10, type: 'image/png' }) }; };
    const char = await h.L.add('wenjinbei');
    assert.equal(calls, 10, 'main avatar, five alternates, cover, reference and two chat backgrounds are fetched');
    assert.equal(char.chatConfig.chatBgImage, 'data:image/png;base64,QVZBVEFS', 'the first shipped background is the default chat background');
    assert.equal(char.chatConfig.chatBgGallery.length, 1, 'identical inline results collapse to one gallery entry');
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
    assert.deepEqual(JSON.parse(JSON.stringify({ ...one.chatConfig, userProfile: undefined })), {}, 'no artwork keys are written when the files are missing');
    assert.deepEqual(JSON.parse(JSON.stringify(one.avatarGallery)), ['data:image/png;base64,MAIN'], 'a missing alternate never blocks adding');
    const plain = harness();
    let fetched = 0;
    plain.context.fetch = async () => { fetched += 1; return { ok: true, blob: async () => ({ size: 10, type: 'image/jpeg' }) }; };
    plain.context.FileReader = class { readAsDataURL() { this.result = 'data:image/jpeg;base64,IMG' + fetched; this.onload?.(); } };
    const second = await plain.L.add('shanghuan');
    assert.deepEqual(JSON.parse(JSON.stringify(second.avatarGallery)), [1, 2, 3, 4, 5].map(n => 'data:image/jpeg;base64,IMG' + n), 'both characters carry their alternate avatar');
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
    let reads = 0;
    h.context.FileReader = class { readAsDataURL() { reads += 1; this.result = 'data:image/jpeg;base64,IMG' + reads; this.onload?.(); } };
    h.L.open();
    const overlay = h.nodes.get('bynd-builtin-library');
    assert.match(overlay.innerHTML, /is-added[\s\S]*补齐素材/, 'an added character without artwork offers a repair');
    const adding = h.L.pickAll();
    await new Promise(resolve => setImmediate(resolve));
    await new Promise(resolve => setImmediate(resolve));
    await adding;
    for (let i = 0; i < 4; i++) await new Promise(resolve => setImmediate(resolve));
    const finalHtml = h.nodes.get('bynd-builtin-library').innerHTML;
    assert.doesNotMatch(finalHtml, /补齐素材/, 'the background repair completed and the add was not blocked by it');
    assert.equal((finalHtml.match(/头像 (?:6\/6|5\/5) · 封面 ✓ · 参考图 ✓/g) || []).length, 2);
    assert.equal(h.characters.length, 2);
    assert.equal(h.characters[1].builtinId, 'shanghuan');
    assert.deepEqual(JSON.parse(JSON.stringify(h.state.toasts)), ['已添加 商桓'], 'the add itself reported success; the later repair re-render replaced the status line');
    await h.L.pickAll();
    assert.match(h.nodes.get('bynd-builtin-library').innerHTML, /没有需要添加的角色/);
});

test('packaged files are read through XHR first so the Android file bundle works, with fetch as the fallback', async () => {
    const h = harness();
    const requested = [];
    let fetched = 0;
    h.context.fetch = async () => { fetched += 1; return { ok: true, blob: async () => ({ size: 10, type: 'image/png' }) }; };
    h.context.XMLHttpRequest = class {
        open(method, url) { this.url = url; requested.push(url); }
        send() { this.status = 0; this.response = { size: 10, type: '' }; this.onload?.(); }
    };
    h.context.FileReader = class { readAsDataURL(blob) { this.result = 'data:' + blob.type + ';base64,X'; this.onload?.(); } };
    const char = await h.L.add('wenjinbei');
    assert.equal(fetched, 0, 'XHR served every file');
    assert.deepEqual(JSON.parse(JSON.stringify(requested)), ['wenjinbei.jpg', 'wenjinbei-alt.jpg', 'wenjinbei-alt-02.jpg', 'wenjinbei-alt-03.jpg', 'wenjinbei-alt-04.jpg', 'wenjinbei-alt-05.jpg', 'wenjinbei-cover.jpg', 'wenjinbei-reference.jpg', 'wenjinbei-bg-01.jpg', 'wenjinbei-bg-02.jpg'].map(name => 'assets/characters/builtin/' + name));
    assert.equal(char.avatar, 'data:image/jpeg;base64,X', 'a typeless file:// blob is typed from its extension');
    assert.equal(char.avatarGallery.length, 1, 'identical inline results collapse to one entry');
    assert.equal(char.coverImage, 'data:image/jpeg;base64,X');
    assert.equal(char.chatConfig.imageReference, 'data:image/jpeg;base64,X');
    const broken = harness();
    broken.context.XMLHttpRequest = class { open() {} send() { this.onerror?.(); } };
    const viaFetch = await broken.L.add('shanghuan');
    assert.equal(viaFetch.avatar, 'data:image/png;base64,QVZBVEFS', 'fetch still works when XHR is blocked');
});

test('repair fills missing gallery, cover and reference for characters added earlier and never overwrites user data', async () => {
    const legacy = { id: 'old', name: '商桓', description: '【角色描述】\n商桓，男，28 岁……', avatar: 'assets/characters/builtin/shanghuan.jpg', avatarGallery: ['assets/characters/builtin/shanghuan.jpg'], chatConfig: {}, history: [{ isMe: true, content: '嗨' }] };
    const custom = { id: 'mine', name: '商桓', description: '我自己写的商桓', avatar: 'data:image/png;base64,MINE', avatarGallery: ['data:image/png;base64,MINE'], chatConfig: { imageReference: 'data:image/png;base64,REF' } };
    const h = harness({ characters: [legacy, custom] });
    let n = 0;
    h.context.FileReader = class { readAsDataURL() { n += 1; this.result = 'data:image/jpeg;base64,FILE' + n; this.onload?.(); } };
    assert.equal(h.L.isAdded('shanghuan'), true, 'a legacy add without builtinId is still recognised by its card header');
    legacy.description = '我改过的描述：他是法医，也是我的前男友。';
    assert.equal(h.L.isAdded('shanghuan'), true, 'an edited description still matches through the signature phrase');
    legacy.description = '完全无关的描述';
    assert.equal(h.L.isAdded('shanghuan'), false, 'without name and signature the character is not claimed');
    legacy.description = '【角色描述】\n商桓，男，28 岁……';
    assert.equal(h.L.isAdded('wenjinbei'), false);
    const result = await h.L.repair();
    assert.deepEqual(JSON.parse(JSON.stringify(result.repaired)), ['商桓']);
    assert.equal(legacy.builtinId, 'shanghuan');
    assert.match(legacy.avatar, /^data:image\/jpeg;base64,FILE/, 'a path avatar is inlined');
    assert.equal(legacy.avatarGallery.length, 5, 'main plus four chibi alternates');
    assert.match(legacy.coverImage, /^data:image\/jpeg;base64,FILE/);
    assert.match(legacy.chatConfig.imageReference, /^data:image\/jpeg;base64,FILE/);
    assert.equal(legacy.history.length, 1, 'chat history untouched');
    assert.equal(custom.builtinId, undefined, 'a user-made character with the same name is not treated as built-in');
    assert.equal(custom.chatConfig.imageReference, 'data:image/png;base64,REF');
    assert.equal(h.state.saves, 1);
    const again = await h.L.repair();
    assert.deepEqual(JSON.parse(JSON.stringify(again.repaired)), [], 'a complete character is left alone');
    assert.equal(h.state.saves, 1);
    const existing = await h.L.add('shanghuan');
    assert.equal(existing, legacy, 'adding again returns the repaired legacy character instead of a duplicate');
});

test('the picker reports missing artwork per character and a manual repair surfaces the read error', async () => {
    const legacy = { id: 'old', name: '温今北', description: '【角色描述】\n温今北', avatar: 'data:image/png;base64,MAIN', avatarGallery: ['data:image/png;base64,MAIN'], chatConfig: {}, history: [] };
    const h = harness({ characters: [legacy] });
    vm.runInContext(fs.readFileSync(path.join(root, 'assets/characters/builtin/artwork.js'), 'utf8'), h.context);
    h.L.open();
    await new Promise(resolve => setImmediate(resolve));
    await new Promise(resolve => setImmediate(resolve));
    const overlay = () => h.nodes.get('bynd-builtin-library').innerHTML;
    assert.match(overlay(), /头像 6\/6 · 封面 ✓ · 参考图 ✓/, 'opening the picker repairs a reachable character first');
    assert.equal(legacy.avatarGallery.length, 6);
    const broken = harness({ characters: [{ id: 'old2', name: '商桓', description: '【角色描述】\n商桓', avatar: 'data:image/png;base64,MAIN', avatarGallery: ['data:image/png;base64,MAIN'], chatConfig: {}, history: [] }] });
    broken.context.fetch = async () => ({ ok: false, status: 404 });
    broken.context.XMLHttpRequest = class { open() {} send() { this.status = 404; this.onload?.(); } };
    broken.L.open();
    await new Promise(resolve => setImmediate(resolve));
    await new Promise(resolve => setImmediate(resolve));
    const html = broken.nodes.get('bynd-builtin-library').innerHTML;
    assert.match(html, /头像 1\/5 · 封面 缺 · 参考图 缺/);
    assert.match(html, /备用头像：HTTP 404/);
    assert.match(html, /补齐素材/);
    await broken.L.fix('shanghuan');
    assert.match(broken.nodes.get('bynd-builtin-library').innerHTML, /有素材没能读取：备用头像：HTTP 404/);
    assert.equal(broken.state.saves, 1, 'builtinId was still written once');
});

test('repair strips retired card text and installs the shipped chat background', async () => {
    const description = '【角色描述】\n温今北，男。\n关于用户本人的身份、外貌与经历，以聊天设置里用户自己填写的资料为准，不要替用户设定。\n\n【场景】\n都市。\n\n【对话样例】\n<START>\n{{user}}：你好\n{{char}}：嗯。';
    const old = { id: 'old', builtinId: 'wenjinbei', name: '温今北', description, avatar: 'data:image/png;base64,A', avatarGallery: ['data:image/png;base64,A'], coverImage: 'data:image/jpeg;base64,COVER', chatConfig: { imageReference: 'data:image/png;base64,R' } };
    const h = harness({ characters: [old] });
    vm.runInContext(artworkSource, h.context);
    const result = await h.L.repair();
    assert.deepEqual(JSON.parse(JSON.stringify(result.repaired)), ['温今北']);
    assert.equal(old.description, '【角色描述】\n温今北，男。\n\n【场景】\n都市。');
    assert.equal(old.chatConfig.chatBgGallery.length, 2, 'the shipped backgrounds are back-filled');
    assert.equal(old.chatConfig.chatBgImage, old.chatConfig.chatBgGallery[0], 'the shipped background replaces the cover stand-in');
    assert.notEqual(old.chatConfig.chatBgImage, 'data:image/jpeg;base64,COVER');
    const kept = { id: 'kept', builtinId: 'wenjinbei', name: '温今北', description: '【角色描述】\n温今北，男。', avatar: 'data:image/png;base64,A', avatarGallery: ['data:image/png;base64,A'], coverImage: 'data:image/jpeg;base64,COVER', chatConfig: { imageReference: 'data:image/png;base64,R', chatBgImage: 'data:image/png;base64,MINE' } };
    const k = harness({ characters: [kept] });
    vm.runInContext(artworkSource, k.context);
    await k.L.repair();
    assert.equal(kept.chatConfig.chatBgImage, 'data:image/png;base64,MINE', 'a background the user picked is never replaced');
});

test('adding a built-in character seeds its user persona once and applies it only to an untouched chat', async () => {
    const h = harness();
    const char = await h.L.add('wenjinbei');
    const personas = JSON.parse(h.context.localStorage.getItem('wechat_user_persona_library_v1'));
    assert.equal(personas.length, 1);
    assert.equal(personas[0].id, 'persona_builtin_wenjinbei');
    assert.equal(personas[0].builtinId, 'wenjinbei');
    assert.match(personas[0].bio, /演员/);
    assert.equal(personas[0].name, '', 'the user keeps their own name');
    assert.equal(char.chatConfig.userProfile.personaId, 'persona_builtin_wenjinbei');
    assert.match(char.chatConfig.userProfile.bio, /温今北名义上的妹妹/);
    await h.L.add('shanghuan');
    const again = JSON.parse(h.context.localStorage.getItem('wechat_user_persona_library_v1'));
    assert.deepEqual(JSON.parse(JSON.stringify(again.map(p => p.id))), ['persona_builtin_wenjinbei', 'persona_builtin_shanghuan']);
    const mine = { id: 'mine', builtinId: 'shanghuan', name: '商桓', description: '【角色描述】商桓', avatar: 'data:image/png;base64,A', avatarGallery: ['data:image/png;base64,A'], coverImage: 'data:image/jpeg;base64,COVER', chatConfig: { imageReference: 'data:image/png;base64,R', userProfile: { name: '上官落', bio: '猎人' } } };
    const k = harness({ characters: [mine] });
    vm.runInContext(artworkSource, k.context);
    await k.L.repair();
    assert.equal(mine.chatConfig.userProfile.bio, '猎人', 'a bio the user wrote is never overwritten');
    assert.equal(mine.chatConfig.userProfile.personaId, undefined);
    assert.equal(JSON.parse(k.context.localStorage.getItem('wechat_user_persona_library_v1')).length, 1, 'the persona is still offered in the library');
    assert.equal(mine.chatConfig.chatBgGallery.length, 3, '商桓 ships three chat backgrounds');
    assert.match(k.L.backgroundOptions(mine).join(';'), /1：正装商桓（当前）;2：居家商桓;3：商桓肖像/);
});
