const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'modules/comic/comic.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const route = fs.readFileSync(path.join(root, 'script.js'), 'utf8');

function setup(fetch) {
    const context = vm.createContext({ window: {}, document: {}, TextEncoder, Uint8Array, DataView, Blob, console, fetch });
    vm.runInContext(source, context);
    return context.window.ByndComic;
}

test('comic is reachable from desktop and chat settings with its own app window', () => {
    assert.match(html, /data-app-id="comic"[^>]*openApp\('comic'\)/);
    assert.match(html, /id="app-comic-window"/);
    assert.match(html, /ByndComic\.fromChat\(getCurrentChatChar\(\)\?\.id\)/);
    assert.match(route, /else if \(appName === 'comic'\)/);
    assert.match(route, /openDreamRecordInComic/);
    assert.match(fs.readFileSync(path.join(root, 'modules/living-world/living-world.js'), 'utf8'), /comicCurrentPost/);
});

test('invalid storyboard cannot be accepted as a generated chapter', () => {
    const comic = setup();
    assert.throws(() => comic._test.validatePlan({ panels: [] }), /1 到 16/);
    const plan = comic._test.validatePlan({ sceneState: { charAppearance: 'black hair' }, panels: [{ description: 'door opens', prompt: 'comic frame' }, { description: '', prompt: '' }] });
    assert.equal(plan.panels.length, 1);
    assert.equal(plan.scene.charAppearance, 'black hair');
    assert.equal(plan.scene.clothing, '');
    assert.equal(plan.panels[0].imageKey, '');
});

test('comic persistence failure rejects without reporting a saved project', async () => {
    const comic = setup();
    await assert.rejects(comic.storage.put('series', { id: 'x' }), /IndexedDB 不可用/);
});

test('image adapter refuses an HTML success response before storing a panel', async () => {
    const comic = setup(async () => ({ ok: true, blob: async () => new Blob(['<html>not an image</html>'], { type: 'text/html' }) }));
    await assert.rejects(comic._test.durableImage('https://example.test/fake-image'), /不支持的图片格式/);
});

test('chapter ZIP contains full original files and valid directory offsets', async () => {
    const comic = setup();
    const files = [
        { name: '001.png', bytes: Uint8Array.from([137, 80, 78, 71, 1, 2]) },
        { name: '002.jpg', bytes: Uint8Array.from([255, 216, 8, 7, 255, 217]) }
    ];
    const bytes = Buffer.from(await comic._test.makeZip(files).arrayBuffer());
    for (const file of files) {
        const local = bytes.indexOf(Buffer.from(file.name));
        assert.ok(local > 0);
        assert.deepEqual(bytes.subarray(local + file.name.length, local + file.name.length + file.bytes.length), Buffer.from(file.bytes));
    }
    assert.equal(bytes.readUInt32LE(bytes.length - 22), 0x06054b50);
    assert.equal(bytes.readUInt16LE(bytes.length - 12), 2);
    const centralOffset = bytes.readUInt32LE(bytes.length - 6);
    assert.equal(bytes.readUInt32LE(centralOffset), 0x02014b50);
});

test('PDF exporter writes a complete page tree and trailer', async () => {
    const comic = setup();
    const bytes = Buffer.from(await comic._test.makePdf([{ width: 320, height: 480, bytes: Uint8Array.from([255, 216, 255, 217]) }]).arrayBuffer());
    const pdf = bytes.toString('latin1');
    assert.match(pdf, /^%PDF-1\.4/);
    assert.match(pdf, /\/Count 1/);
    assert.match(pdf, /\/MediaBox \[0 0 320 480\]/);
    assert.match(pdf, /\/Filter \/DCTDecode/);
    assert.match(pdf, /startxref\n\d+\n%%EOF$/);
});
