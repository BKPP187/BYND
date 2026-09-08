const assert = require('node:assert/strict');
const test = require('node:test');
const vm = require('node:vm');
const { sourceSection, deferred, clone } = require('./helpers/harness.cjs');

function harness() {
    const char = { id: 'photo-test', chatConfig: { aiPhoneHomeSettings: { avatar: 'data:image/jpeg;base64,avatar', photos: ['data:image/jpeg;base64,main', 'data:image/jpeg;base64,second', '', ''] } } };
    const modal = { dataset: { charId: char.id } };
    const state = { writes: [], rendered: [], editorRenders: 0, notices: [], save: async () => true };
    const context = vm.createContext({
        window: { myCharacters: [char], _wechatAiPhoneOpenCharId: char.id },
        document: { getElementById: () => modal },
        saveCharactersToStorage: async () => {
            state.writes.push(clone(char.chatConfig.aiPhoneHomeSettings));
            return state.save();
        },
        showWechatToast: message => state.notices.push(message),
        renderWechatAiPhone: () => state.rendered.push(clone(char.chatConfig.aiPhoneHomeSettings)),
        renderWechatAiPhoneHomeEditor: () => { state.editorRenders += 1; },
        compressWechatSettingsImage: async () => { throw new Error('图片加载失败'); }
    });
    vm.runInContext(sourceSection('wechat.js', 'function getWechatAiPhoneHomeSettings(', 'function getWechatAiPhoneHomeAvatar('), context);
    vm.runInContext(sourceSection('wechat.js', 'async function updateWechatAiPhoneHomeSettings(', 'function uploadWechatAiPhoneHomeAvatar('), context);
    return { char, modal, state, context, update: updater => context.updateWechatAiPhoneHomeSettings(char, updater) };
}

test('photo edits render only after persistence and preserve other photos and the avatar', async () => {
    const h = harness();
    const pending = deferred();
    const before = clone(h.char.chatConfig.aiPhoneHomeSettings);
    h.state.save = () => pending.promise;
    const edited = h.update(current => ({ ...current, photos: ['data:image/jpeg;base64,new', ...current.photos.slice(1)] }));
    await Promise.resolve();
    assert.equal(h.state.writes.length, 1);
    assert.equal(h.state.rendered.length, 0);
    pending.resolve(true);
    assert.equal(await edited, true);
    assert.equal(h.char.chatConfig.aiPhoneHomeSettings.avatar, before.avatar);
    assert.deepEqual(clone(h.char.chatConfig.aiPhoneHomeSettings.photos.slice(1)), before.photos.slice(1));
    assert.equal(h.state.rendered.length, 1);
    assert.equal(h.state.editorRenders, 1);
});

test('false and rejected photo saves restore the original settings and report the failure', async () => {
    for (const save of [async () => false, async () => { throw new Error('存储不可用'); }]) {
        const h = harness();
        const before = clone(h.char.chatConfig.aiPhoneHomeSettings);
        h.state.save = save;
        assert.equal(await h.update(current => ({ ...current, photos: ['', '', '', ''] })), false);
        assert.deepEqual(clone(h.char.chatConfig.aiPhoneHomeSettings), before);
        assert.equal(h.state.rendered.length, 0);
        assert.equal(h.state.editorRenders, 0);
        assert.match(h.state.notices[0], /保存失败|存储不可用/);
        assert.equal(h.context.window._wechatAiPhoneHomeSaves.size, 0);
    }
});

test('a queued photo edit starts from the restored state when the preceding save fails', async () => {
    const h = harness();
    const pending = deferred();
    const before = clone(h.char.chatConfig.aiPhoneHomeSettings);
    h.state.save = () => h.state.writes.length === 1 ? pending.promise : true;
    const first = h.update(current => ({ ...current, avatar: 'data:image/jpeg;base64,failed' }));
    const second = h.update(current => { current.photos[1] = ''; return current; });
    await Promise.resolve();
    assert.equal(h.state.writes.length, 1);
    pending.resolve(false);
    assert.equal(await first, false);
    assert.equal(await second, true);
    assert.equal(h.state.writes[1].avatar, before.avatar);
    assert.equal(h.char.chatConfig.aiPhoneHomeSettings.photos[0], before.photos[0]);
    assert.equal(h.char.chatConfig.aiPhoneHomeSettings.photos[1], '');
    assert.equal(h.state.rendered.length, 1);
});

test('finishing a photo save cannot switch an editor opened for another character', async () => {
    const h = harness();
    const pending = deferred();
    h.state.save = () => pending.promise;
    const edited = h.update(current => ({ ...current, avatar: '' }));
    await Promise.resolve();
    h.modal.dataset.charId = 'another-character';
    h.context.window._wechatAiPhoneOpenCharId = 'another-character';
    pending.resolve(true);
    assert.equal(await edited, true);
    assert.equal(h.state.rendered.length, 0);
    assert.equal(h.state.editorRenders, 0);
});

test('a corrupt selected photo leaves settings unchanged and allows selecting the file again', async () => {
    const h = harness();
    const before = clone(h.char.chatConfig.aiPhoneHomeSettings);
    const input = { files: [{}], value: 'bad.png' };
    await h.context.uploadWechatAiPhoneHomePhoto(input, 0);
    assert.equal(h.state.writes.length, 0);
    assert.equal(input.value, '');
    assert.deepEqual(clone(h.char.chatConfig.aiPhoneHomeSettings), before);
    assert.equal(h.state.notices[0], '图片加载失败');
});
