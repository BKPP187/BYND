const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync('core/worldbook/worldbook.js', 'utf8');

test('creating a reference worldbook does not create a chat contact', async () => {
    const stored = new Map();
    const contacts = [{ id: 'reader', name: '读者', worldBook: [] }];
    const context = vm.createContext({
        window: { myCharacters: contacts },
        localStorage: { getItem: key => stored.get(key) || null, setItem: (key, value) => stored.set(key, value) },
        document: { getElementById: id => id === 'wb-book-name' ? { value: '表情包链接' } : { classList: { add() {} } } },
        saveCharactersToStorage: async () => true,
        alert: message => assert.fail(message),
    });
    vm.runInContext(source, context);
    vm.runInContext('initWorldBook = () => {}', context);
    await context.confirmCreateBook();
    assert.equal(contacts.length, 1, 'worldbook creation must not add a contact');
    assert.equal(context.getStandaloneWorldBooks()[0].name, '表情包链接');
});

function standaloneContext() {
    const stored = new Map();
    const alerts = [];
    const chars = [{ id: 'a', name: '甲', worldBook: [{ keys: ['私有'], content: '甲的背景' }] }, { id: 'b', name: '乙', worldBook: [] }];
    let failStorage = false;
    const nodes = new Map();
    const context = vm.createContext({
        window: { myCharacters: chars },
        localStorage: {
            getItem: key => stored.get(key) || null,
            setItem: (key, value) => { if (failStorage) throw Error('存储空间不足'); stored.set(key, value); },
        },
        document: { getElementById: id => { if (!nodes.has(id)) nodes.set(id, { value: '', classList: { add() {}, remove() {} } }); return nodes.get(id); } },
        alert: message => alerts.push(message),
        saveCharactersToStorage: async () => assert.fail('Independent books must not save contacts'),
    });
    vm.runInContext(source, context);
    vm.runInContext('renderBookDetail = book => { currentReadingChar = book; }; initWorldBook = () => {};', context);
    nodes.set('wb-book-name', { value: '表情包链接' });
    context.confirmCreateBook();
    const book = context.getStandaloneWorldBooks()[0];
    context.renderBookDetail(book);
    return { context, chars, book, alerts, stored, nodes, fail: () => { failStorage = true; } };
}

test('standalone imports persist independently and shared sticker entries require explicit character binding', async () => {
    const { context, chars, book, alerts } = standaloneContext();
    const content = '开心：https://i.postimg.cc/abc123/happy.png';
    await context.importWorldBookFile({ files: [{ text: async () => JSON.stringify({ entries: [{ keys: ['表情'], content }] }) }], value: 'stickers.json' });
    assert.equal(context.getStandaloneWorldBooks()[0].worldBook[0].content, content);
    assert.equal(chars.length, 2);
    assert.equal(context.getCharacterWorldBookEntries(chars[0]).length, 1);
    assert.equal(context.getCharacterWorldBookEntries(chars[1]).length, 0);
    await context.toggleWorldBookCharacter({ checked: true, dataset: { wbCharacterId: 'a' } });
    await context.toggleWorldBookCharacter({ checked: true, dataset: { wbCharacterId: 'b' } });
    chars[0].chatConfig = { promptWorldBookIds: [] }; // Old private-entry choices must not disable a newly linked book.
    assert.equal(context.getCharacterWorldBookEntries(chars[0])[0].content, content);
    const shared = context.getCharacterWorldBookEntries(chars[1])[0];
    chars[1].chatConfig = { disabledSharedWorldBookEntryIds: [shared.id] };
    assert.equal(context.getCharacterWorldBookEntries(chars[1]).length, 0);
    assert.equal(context.getAvailableCharacterWorldBookEntries(chars[1]).length, 1);
    await context.toggleWorldBookCharacter({ checked: false, dataset: { wbCharacterId: 'a' } });
    assert.equal(context.getCharacterWorldBookEntries(chars[0]).length, 0);
    assert.equal(book.worldBook.length, 1);
    assert.deepEqual(alerts, ['已导入 1 条世界书设定。']);
});

test('standalone create, import, edit, toggle and binding failures preserve saved data and report failure', async () => {
    const { context, book, alerts, stored, nodes, fail } = standaloneContext();
    await context.updateWorldBookEntries(book, [{ content: '原始资料', keys: ['原始'], enabled: true }]);
    const before = stored.get('bynd_worldbooks_v1');
    fail();
    context.confirmCreateBook();
    await context.importWorldBookFile({ files: [{ text: async () => '[{"content":"新资料"}]' }], value: 'book.json' });
    nodes.get('wb-book-name').value = '不会创建';
    nodes.set('wb-new-key', { value: '新条目' }); nodes.set('wb-new-content', { value: '新资料' });
    await context.saveNewWBEntry();
    await context.toggleWBEntry(0, false);
    vm.runInContext('currentEntryIndex = 0', context);
    nodes.set('wb-detail-key', { value: '修改' }); nodes.set('wb-detail-content', { value: '修改资料' });
    await context.saveEntryDetail();
    await context.toggleWorldBookCharacter({ checked: true, dataset: { wbCharacterId: 'a' } });
    assert.equal(book.worldBook.length, 1);
    assert.equal(book.worldBook[0].content, '原始资料');
    assert.equal(book.worldBook[0].enabled, true);
    assert.equal(book.characterIds.length, 0);
    assert.equal(stored.get('bynd_worldbooks_v1'), before);
    assert.equal(alerts.length, 6);
    assert.ok(alerts.every(message => /失败.*存储空间不足/.test(message)));
});

test('filtered legacy entries retain their original index IDs', () => {
    const { context, chars } = standaloneContext();
    chars[0].worldBook = [{ content: '关闭', enabled: false }, { content: '选中' }];
    chars[0].chatConfig = { promptWorldBookIds: ['wb-1'] };
    const entries = context.getCharacterWorldBookEntries(chars[0]);
    assert.equal(entries.length, 1);
    assert.equal(entries[0].id, 'wb-1');
    assert.equal(entries[0].content, '选中');
});

test('malformed standalone storage is not overwritten by a new book', () => {
    const { context, stored, alerts } = standaloneContext();
    stored.set('bynd_worldbooks_v1', '{broken');
    context.confirmCreateBook();
    assert.equal(stored.get('bynd_worldbooks_v1'), '{broken');
    assert.match(alerts[0], /新建世界书失败/);
});

function createContext(saveResult = true) {
    const alerts = [];
    const char = { name: '测试角色', worldBook: [{ keys: ['原有'], content: '原设定', enabled: true }] };
    const context = vm.createContext({
        char,
        alert: message => alerts.push(message),
        saveCharactersToStorage: async () => saveResult,
        document: { getElementById: () => ({ classList: { add() {} } }), querySelector: () => null },
        renderBookDetail() {},
    });
    vm.runInContext(source, context);
    vm.runInContext('currentReadingChar = char', context);
    return { context, char, alerts };
}

test('worldbook JSON import appends entries only after successful save', async () => {
    const { context, char, alerts } = createContext();
    const input = { files: [{ text: async () => JSON.stringify({ entries: [{ keys: '城市, 夜晚', content: '新设定', enabled: false }] }) }], value: 'book.json' };
    await context.importWorldBookFile(input);
    assert.equal(char.worldBook.length, 2);
    assert.deepEqual(Array.from(char.worldBook[1].keys), ['城市', '夜晚']);
    assert.equal(char.worldBook[1].enabled, false);
    assert.equal(input.value, '');
    assert.match(alerts[0], /已导入 1 条/);
});

test('failed worldbook save rolls back imported entries and reports failure', async () => {
    const { context, char, alerts } = createContext(false);
    const original = char.worldBook;
    const input = { files: [{ text: async () => JSON.stringify([{ content: '不能保存' }]) }], value: 'book.json' };
    await context.importWorldBookFile(input);
    assert.equal(char.worldBook, original);
    assert.equal(input.value, '');
    assert.match(alerts[0], /导入世界书失败.*保存失败/);
    assert.ok(!alerts.some(message => message.startsWith('已导入')));
});

test('invalid worldbook JSON and export failure are reported', async () => {
    const { context, char, alerts } = createContext();
    await context.importWorldBookFile({ files: [{ text: async () => '{bad' }], value: 'book.json' });
    assert.equal(char.worldBook.length, 1);
    assert.match(alerts[0], /导入世界书失败/);
    context.Blob = Blob;
    context.URL = { createObjectURL: () => { throw new Error('磁盘不可用'); } };
    context.exportWorldBook();
    assert.match(alerts[1], /导出世界书失败：磁盘不可用/);
});

test('worldbook export writes the current character entries as JSON', async () => {
    const { context, char, alerts } = createContext();
    let exportedBlob;
    let clicked = false;
    let filename = '';
    context.Blob = Blob;
    context.URL = { createObjectURL: blob => { exportedBlob = blob; return 'blob:book'; }, revokeObjectURL() {} };
    context.setTimeout = () => {};
    context.document = {
        getElementById: () => ({ classList: { add() {} } }),
        createElement: () => ({
            set download(value) { filename = value; },
            click() { clicked = true; },
            remove() {},
        }),
        body: { appendChild() {} },
    };
    context.exportWorldBook();
    assert.equal(clicked, true);
    assert.equal(filename, '测试角色-世界书.json');
    const payload = JSON.parse(await exportedBlob.text());
    assert.equal(payload.character, char.name);
    assert.equal(payload.entries[0].content, '原设定');
    assert.deepEqual(alerts, []);
});
