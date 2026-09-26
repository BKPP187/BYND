const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync('core/worldbook/worldbook.js', 'utf8');

function createContext(saveResult = true) {
    const alerts = [];
    const char = { name: '测试角色', worldBook: [{ keys: ['原有'], content: '原设定', enabled: true }] };
    const context = vm.createContext({
        char,
        alert: message => alerts.push(message),
        saveCharactersToStorage: async () => saveResult,
        document: { getElementById: () => ({ classList: { add() {} } }) },
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
