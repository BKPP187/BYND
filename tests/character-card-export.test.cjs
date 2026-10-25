const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const zlib = require('node:zlib');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const clone = value => JSON.parse(JSON.stringify(value));

function pngChunk(type, data) {
    const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
    const out = Buffer.alloc(12 + data.length);
    out.writeUInt32BE(data.length, 0);
    body.copy(out, 4);
    out.writeUInt32BE(zlib.crc32(body), 8 + data.length);
    return out;
}
function tinyPng() {
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(1, 0); ihdr.writeUInt32BE(1, 4); ihdr[8] = 8; ihdr[9] = 6;
    return new Uint8Array(Buffer.concat([Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]), pngChunk('IHDR', ihdr), pngChunk('IDAT', zlib.deflateSync(Buffer.from([0, 200, 100, 50, 255]))), pngChunk('IEND', Buffer.alloc(0))]));
}

function harness(chars = []) {
    const toasts = [];
    const state = { saveResult: true, saves: 0 };
    const context = vm.createContext({
        window: { myCharacters: chars }, console: { log() {}, warn() {}, error() {} },
        TextEncoder, TextDecoder, atob, btoa, Uint8Array, Uint32Array, DataView, JSON, Math, Date, Promise, Blob, setTimeout, clearTimeout,
        document: { querySelectorAll: () => [], getElementById: () => null },
        DEFAULT_AVATAR: 'default-avatar', WECHAT_QQ_GROUP_USER_ID: '__user__',
        showWechatToast: message => toasts.push(message),
        saveCharactersToStorage: async () => { state.saves++; return state.saveResult; },
        buildWechatGroupAvatar: () => 'group-avatar',
        seedWechatCharacterGreeting: char => { if (char.first_mes) char.history.push({ type: 'text', isMe: false, content: char.first_mes, timestamp: 1 }); return true; }
    });
    vm.runInContext(read('core/character/card-parser.js') + '\nwindow.CharacterCardParser = CharacterCardParser;', context);
    vm.runInContext(read('apps/wechat/character/chat-windows.js'), context);
    vm.runInContext(read('apps/wechat/character/card-export.js'), context);
    context.renderByndCardPortrait = async () => { throw new Error('no canvas in tests'); };
    return { context, toasts, state };
}

const SAMPLE = () => ({
    id: 'char_a', name: '温今北', description: '【角色描述】\n温柔、慢热的图书管理员。',
    first_mes_original: '你来啦，{{user}}。', first_mes: '你来啦，{{user}}。',
    alternates: ['今天想读什么？'],
    worldBook: [{ keys: ['图书馆'], content: '城东的老图书馆，晚上九点闭馆。', comment: '地点' }, { key: '', content: '' }],
    regex: [{ name: '去括号', regex: '\\(.*?\\)', replace: '' }],
    chatConfig: { nickname: '北北', signature: '慢慢来', aiStatusSnapshot: { mood: 'x' } },
    history: [{ type: 'text', isMe: true, content: '私密聊天' }]
});

test('a single character exports as a PNG card that the importer reads back', () => {
    const h = harness();
    const card = h.context.buildByndCharacterCardV2(SAMPLE());
    assert.equal(card.spec, 'chara_card_v2');
    assert.equal(card.data.character_book.entries.length, 1, 'empty world book entries are dropped');
    assert.doesNotMatch(JSON.stringify(card), /私密聊天|aiStatusSnapshot/, 'chat history and private state never leave the device');
    const png = h.context.embedByndCardInPng(tinyPng(), card);
    const parsed = h.context.window.CharacterCardParser.parse(png.buffer.slice(png.byteOffset, png.byteOffset + png.byteLength));
    assert.equal(parsed.name, '温今北');
    assert.equal(parsed.description, SAMPLE().description, 'BYND description restored verbatim, not re-wrapped');
    assert.equal(parsed.first_mes, '你来啦，{{user}}。');
    assert.deepEqual(clone(parsed.alternates), ['今天想读什么？']);
    assert.equal(parsed.worldBook[0].content, '城东的老图书馆，晚上九点闭馆。');
    assert.deepEqual(clone(parsed.regex.map(item => [item.name, item.regex])), [['去括号', '\\(.*?\\)']]);
    assert.deepEqual(clone(parsed.chatConfig), { nickname: '北北', signature: '慢慢来' });
});

test('exported PNG chunks have valid CRCs and re-export replaces the old card', () => {
    const h = harness();
    const first = h.context.embedByndCardInPng(tinyPng(), h.context.buildByndCharacterCardV2(SAMPLE()));
    const second = h.context.embedByndCardInPng(first, h.context.buildByndCharacterCardV2({ ...SAMPLE(), name: '商桓' }));
    const buf = Buffer.from(second);
    let offset = 8, charaChunks = 0;
    while (offset < buf.length) {
        const length = buf.readUInt32BE(offset), type = buf.toString('latin1', offset + 4, offset + 8);
        assert.equal(buf.readUInt32BE(offset + 8 + length), zlib.crc32(buf.subarray(offset + 4, offset + 8 + length)), `${type} CRC`);
        if (type === 'tEXt' && buf.toString('latin1', offset + 8, offset + 14) === 'chara\0') charaChunks++;
        offset += 12 + length;
    }
    assert.equal(charaChunks, 1);
    assert.equal(h.context.window.CharacterCardParser.parse(second.buffer.slice(second.byteOffset, second.byteOffset + second.byteLength)).name, '商桓');
    assert.throws(() => h.context.embedByndCardInPng(new Uint8Array([1, 2, 3]), {}), /PNG/);
});

test('plain SillyTavern JSON cards import through the confirm dialog path', async () => {
    const h = harness();
    const result = await h.context.importByndCardJsonText(JSON.stringify({ spec: 'chara_card_v2', data: { name: 'Seraphina', description: 'A guardian.', personality: 'kind', first_mes: 'Hello' } }));
    assert.equal(result.type, 'single');
    assert.equal(result.data.name, 'Seraphina');
    assert.match(result.data.description, /A guardian\.[\s\S]*kind/);
    await assert.rejects(h.context.importByndCardJsonText('{not json'), /不是有效的 JSON/);
    await assert.rejects(h.context.importByndCardJsonText('{"hello":1}'), /无法识别/);
});

test('group cards bundle every member and import as one group with reused contacts', async () => {
    const memberA = SAMPLE();
    const memberB = { ...SAMPLE(), id: 'char_b', name: '商桓', description: '冷面律师。' };
    const group = { id: 'group_1', name: '读书会', description: '周五见', isGroupChat: true, groupMembers: ['char_a', 'char_b'], history: [] };
    const exporter = harness([memberA, memberB, group]);
    const bundle = clone(await exporter.context.buildByndGroupCardBundle(group));
    assert.equal(bundle.spec, 'bynd_group_card');
    assert.equal(bundle.members.length, 2);
    assert.doesNotMatch(JSON.stringify(bundle), /私密聊天/);

    const existing = { ...SAMPLE(), id: 'already_here', history: [] };
    const h = harness([existing]);
    const result = await h.context.importByndCardJsonText(JSON.stringify(bundle));
    assert.equal(result.type, 'group');
    const chars = h.context.window.myCharacters;
    const imported = chars.find(char => char.isGroupChat);
    assert.equal(imported.name, '读书会');
    assert.equal(imported.groupMembers.length, 2);
    assert.equal(imported.groupMembers[0], 'already_here', 'an identical contact is reused, not duplicated');
    const newMember = chars.find(char => char.id === imported.groupMembers[1]);
    assert.equal(newMember.name, '商桓');
    assert.equal(newMember.history[0].content, '你来啦，我。', 'new members start from their greeting');
    assert.equal(chars.length, 3);
    assert.equal(h.state.saves, 1);
});

test('a failed group import rolls back every added contact and reports the failure', async () => {
    const group = { id: 'g', name: '读书会', isGroupChat: true, groupMembers: ['char_a'] };
    const exporter = harness([SAMPLE(), group]);
    const bundle = clone(await exporter.context.buildByndGroupCardBundle(group));
    const h = harness([]);
    h.state.saveResult = false;
    await assert.rejects(h.context.importByndCardJsonText(JSON.stringify(bundle)), /没有保存成功/);
    assert.equal(h.context.window.myCharacters.length, 0);
    assert.equal(h.toasts.length, 0, 'no success toast after a failed save');
});

test('exporting the current chat reports failures instead of success', async () => {
    const h = harness([{ id: 'g', name: '空群', isGroupChat: true, groupMembers: [] }]);
    assert.equal(await h.context.exportCurrentWechatCharacterCard('g'), false);
    assert.match(h.toasts.at(-1), /导出失败：群里还没有可导出的角色/);
});

test('import wiring accepts JSON files and keeps the imported chat profile', () => {
    const importer = read('apps/wechat/character/import.js');
    assert.match(importer, /accept="image\/png,\.png,\.json,application\/json"/);
    assert.match(importer, /importByndCardJsonText\(text\)/);
    assert.match(importer, /chatConfig: importedConfig/);
    const html = read('index.html');
    assert.match(html, /onclick="exportCurrentWechatCharacterCard\(\)"/);
    assert.match(html, /<div id="wcs-chat-windows"><\/div>/);
    const layout = require('../scripts/source-layout.cjs');
    assert.ok(layout.wechatParts.includes('apps/wechat/character/card-export.js'));
    assert.ok(layout.wechatParts.includes('apps/wechat/character/chat-windows.js'));
});
