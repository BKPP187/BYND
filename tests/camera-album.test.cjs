const assert = require('node:assert/strict');
const test = require('node:test');
const vm = require('node:vm');
const { clone, sourceSection, memoryStorage, deferred } = require('./helpers/harness.cjs');

function cameraHarness() {
    const localStorage = memoryStorage();
    const events = { saved: 0, notified: 0, toasts: [] };
    const context = vm.createContext({
        window: { myCharacters: [{ id: 'a', name: 'A', history: [] }, { id: 'b', name: 'B', history: [] }] },
        document: { getElementById: () => null }, localStorage, URL,
        console: { warn() {} },
        compressWechatImageFile: async () => 'data:image/png;base64,PHOTO',
        saveCharactersToStorage: async () => { events.saved++; return true; },
        notifyWechatMonitors: () => { events.notified++; },
        showWechatToast: message => events.toasts.push(message),
        getCoReadCharName: char => char.name,
        DEFAULT_AVATAR: 'avatar', renderAlbumApp() {}
    });
    vm.runInContext(sourceSection('script.js', 'function openSystemCamera()', 'function closeApp('), context);
    vm.runInContext(sourceSection('script.js', 'const CHAT_ALBUM_KEY =', 'function renderAlbumApp()'), context);
    return { context, localStorage, events };
}

test('camera offers every personal character and excludes groups and group NPCs', () => {
    const h = cameraHarness();
    h.context.window.myCharacters = Array.from({ length: 90 }, (_, id) => ({ id }));
    h.context.window.myCharacters.push({ id: 'group', isGroupChat: true }, { id: 'npc', isGroupNpc: true }, { id: 'legacy-npc', groupNpc: true });
    assert.equal(h.context.getByndCameraRecipients().length, 90);
});

test('double-clicking a camera recipient produces one saved message', async () => {
    const h = cameraHarness();
    const gate = deferred();
    h.context.compressWechatImageFile = () => gate.promise;
    const first = h.context.sendByndCameraFileToCharacter({}, 'b');
    const second = h.context.sendByndCameraFileToCharacter({}, 'b');
    assert.equal(first, second);
    gate.resolve('data:image/png;base64,PHOTO');
    assert.equal(await first, true);
    assert.equal(h.events.saved, 1);
    assert.equal(h.events.notified, 1);
    assert.equal(h.context.window.myCharacters[0].history.length, 0);
    assert.equal(h.context.window.myCharacters[1].history.length, 1);
    assert.equal(h.context.window.myCharacters[1].history[0].isMe, true);
    assert.equal(h.localStorage.getItem('bynd_chat_album_v1'), null);
});

test('failed camera persistence rolls back the message and permits a clean retry', async () => {
    const h = cameraHarness();
    let canSave = false;
    h.context.saveCharactersToStorage = async () => canSave;
    assert.equal(await h.context.sendByndCameraFileToCharacter({}, 'a'), false);
    assert.equal(h.context.window.myCharacters[0].history.length, 0);
    assert.equal(h.events.notified, 0);
    assert.ok(!h.events.toasts.some(message => message.startsWith('照片已发给')));
    assert.equal(h.context.window._byndCameraSendPromise, null);
    canSave = true;
    assert.equal(await h.context.sendByndCameraFileToCharacter({}, 'a'), true);
    assert.equal(h.context.window.myCharacters[0].history.length, 1);
    assert.equal(h.events.notified, 1);
});

test('a character removed during photo decoding receives no message', async () => {
    const h = cameraHarness();
    const gate = deferred();
    h.context.compressWechatImageFile = () => gate.promise;
    const pending = h.context.sendByndCameraFileToCharacter({}, 'a');
    h.context.window.myCharacters = h.context.window.myCharacters.filter(char => char.id !== 'a');
    gate.resolve('data:image/png;base64,PHOTO');
    assert.equal(await pending, false);
    assert.equal(h.events.saved, 0);
});

test('photo decode failure does not append or save a message', async () => {
    const h = cameraHarness();
    h.context.compressWechatImageFile = async () => { throw new Error('decode failed'); };
    assert.equal(await h.context.sendByndCameraFileToCharacter({}, 'a'), false);
    assert.deepEqual(clone(h.context.window.myCharacters[0].history), []);
    assert.equal(h.events.saved, 0);
});

test('a post-save UI error does not turn a delivered photo into a failed send', async () => {
    const h = cameraHarness();
    h.context.notifyWechatMonitors = () => { throw new Error('view failed'); };
    assert.equal(await h.context.sendByndCameraFileToCharacter({}, 'a'), true);
    assert.equal(h.context.window.myCharacters[0].history.length, 1);
    assert.ok(h.events.toasts.some(message => message.startsWith('照片已发给')));
});

test('album accepts generated incoming images, excludes camera photos, and deduplicates per character', () => {
    const h = cameraHarness();
    const [a, b] = h.context.window.myCharacters;
    const incoming = { type: 'image', isMe: false, content: 'https://example.test/generated.png', imagePrompt: 'a garden' };
    assert.equal(h.context.recordWechatGeneratedImageToAlbum(a, { ...incoming, isMe: true }), false);
    assert.equal(h.context.recordWechatGeneratedImageToAlbum(a, { ...incoming, imagePending: true }), false);
    assert.equal(h.context.recordWechatGeneratedImageToAlbum(a, incoming), true);
    assert.equal(h.context.recordWechatGeneratedImageToAlbum(a, incoming), false);
    assert.equal(h.context.recordWechatGeneratedImageToAlbum(b, incoming), true);
    const rows = JSON.parse(h.localStorage.getItem('bynd_chat_album_v1'));
    assert.equal(rows.length, 2);
    assert.deepEqual(rows.map(row => row.charId).sort(), ['a', 'b']);
});
