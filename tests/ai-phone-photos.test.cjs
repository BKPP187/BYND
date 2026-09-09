const assert = require('node:assert/strict');
const test = require('node:test');
const vm = require('node:vm');
const { sourceSection, deferred, clone } = require('./helpers/harness.cjs');

function harness() {
    const char = { id: 'photo-test', chatConfig: { aiPhoneHomeSettings: { avatar: 'data:image/jpeg;base64,avatar', wallpaper: 'data:image/jpeg;base64,wallpaper', photos: ['data:image/jpeg;base64,main', 'data:image/jpeg;base64,second', '', ''], icons: {} } } };
    const modal = { dataset: { charId: char.id } };
    const state = { writes: [], rendered: [], editorRenders: 0, notices: [], crops: [], save: async () => true, readImage: async () => { throw new Error('图片加载失败'); } };
    const context = vm.createContext({
        window: { myCharacters: [char], _wechatAiPhoneOpenCharId: char.id },
        document: { getElementById: () => modal, querySelector: () => ({ getBoundingClientRect: () => ({ width: 318, height: 672 }) }) },
        getWechatModalRoot: () => ({ clientWidth: 390, clientHeight: 844 }),
        saveCharactersToStorage: async () => {
            state.writes.push(clone(char.chatConfig.aiPhoneHomeSettings));
            return state.save();
        },
        showWechatToast: message => state.notices.push(message),
        renderWechatAiPhone: () => state.rendered.push(clone(char.chatConfig.aiPhoneHomeSettings)),
        renderWechatAiPhoneHomeEditor: () => { state.editorRenders += 1; },
        renderWechatAiPhoneIconEditor() {},
        compressWechatSettingsImage: (...args) => state.readImage(...args),
        openWechatAvatarCropper: (source, confirm, options) => state.crops.push({ source, confirm, options })
    });
    vm.runInContext(sourceSection('wechat.js', 'function getWechatAiPhoneAllApps(', 'function getWechatAiPhoneApps('), context);
    vm.runInContext(sourceSection('wechat.js', 'function getWechatAiPhoneHomeSettings(', 'function getWechatAiPhoneHomeAvatar('), context);
    vm.runInContext(sourceSection('wechat.js', 'async function uploadWechatAiPhoneAppIcon(', 'async function updateWechatAiPhoneHomeSettings('), context);
    vm.runInContext(sourceSection('wechat.js', 'async function updateWechatAiPhoneHomeSettings(', 'function uploadWechatAiPhoneHomeAvatar('), context);
    vm.runInContext(sourceSection('wechat.js', 'async function uploadWechatAiPhoneHomeWallpaper(', 'function clearWechatAiPhoneHomePhoto('), context);
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
    assert.equal(h.char.chatConfig.aiPhoneHomeSettings.wallpaper, before.wallpaper);
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

test('each photo waits for crop confirmation and saves only the selected crop', async () => {
    for (const index of [0, 1, 2, 3]) {
        const h = harness();
        const before = clone(h.char.chatConfig.aiPhoneHomeSettings);
        h.state.readImage = async () => 'data:image/jpeg;base64,uncropped';
        const input = { files: [{}], value: 'photo.jpg' };
        await h.context.uploadWechatAiPhoneHomePhoto(input, index);
        assert.equal(h.state.writes.length, 0, 'selecting a file must not save it before confirmation');
        assert.deepEqual(clone(h.char.chatConfig.aiPhoneHomeSettings), before);
        assert.equal(input.value, '');
        assert.equal(h.state.crops.length, 1);
        const crop = h.state.crops[0];
        const expectedAspect = index === 0 ? 11 / 5 : 1;
        assert.ok(Math.abs(crop.options.cropWidth / crop.options.cropHeight - expectedAspect) < 0.001);
        assert.ok(Math.abs(crop.options.outputWidth / crop.options.outputHeight - expectedAspect) < 0.001);
        assert.equal(await crop.confirm('data:image/jpeg;base64,cropped'), true);
        const expected = clone(before);
        expected.photos[index] = 'data:image/jpeg;base64,cropped';
        assert.deepEqual(clone(h.char.chatConfig.aiPhoneHomeSettings), expected);
        assert.equal(h.state.writes.length, 1);
    }
});

test('a failed confirmed crop restores the original image and wallpaper', async () => {
    const h = harness();
    const before = clone(h.char.chatConfig.aiPhoneHomeSettings);
    h.state.readImage = async () => 'data:image/jpeg;base64,uncropped';
    h.state.save = async () => false;
    await h.context.uploadWechatAiPhoneHomePhoto({ files: [{}], value: 'photo.jpg' }, 1);
    assert.equal(await h.state.crops[0].confirm('data:image/jpeg;base64,cropped'), false);
    assert.deepEqual(clone(h.char.chatConfig.aiPhoneHomeSettings), before);
    assert.equal(h.state.rendered.length, 0);
    assert.match(h.state.notices[0], /保存失败/);
});

test('wallpaper selection waits for cropping, survives photo edits, and resets independently', async () => {
    const h = harness();
    const before = clone(h.char.chatConfig.aiPhoneHomeSettings);
    const other = { id: 'other', chatConfig: { aiPhoneHomeSettings: clone(before) } };
    h.context.window.myCharacters.push(other);
    h.state.readImage = async () => 'data:image/jpeg;base64,uncropped-wallpaper';
    const input = { files: [{}], value: 'wallpaper.jpg' };
    await h.context.uploadWechatAiPhoneHomeWallpaper(input, h.char.id);
    assert.equal(h.state.writes.length, 0);
    assert.equal(input.value, '');
    const crop = h.state.crops[0];
    assert.ok(Math.abs(crop.options.cropWidth / crop.options.cropHeight - 318 / 672) < 0.001);
    assert.equal(await crop.confirm('data:image/jpeg;base64,new-wallpaper'), true);
    assert.deepEqual(clone(h.char.chatConfig.aiPhoneHomeSettings.photos), before.photos);
    assert.equal(h.char.chatConfig.aiPhoneHomeSettings.avatar, before.avatar);
    await h.update(current => ({ ...current, photos: ['', '', '', ''] }));
    assert.equal(h.char.chatConfig.aiPhoneHomeSettings.wallpaper, 'data:image/jpeg;base64,new-wallpaper');
    assert.equal(await h.context.resetWechatAiPhoneHomeWallpaper(h.char.id), true);
    assert.equal(h.char.chatConfig.aiPhoneHomeSettings.wallpaper, '');
    assert.deepEqual(clone(h.char.chatConfig.aiPhoneHomeSettings.photos), ['', '', '', '']);
    assert.deepEqual(clone(other.chatConfig.aiPhoneHomeSettings), before);
});

test('failed wallpaper saves and resets retain the previous wallpaper and report failure', async () => {
    for (const save of [async () => false, async () => { throw new Error('存储不可用'); }]) {
        const h = harness();
        const before = clone(h.char.chatConfig.aiPhoneHomeSettings);
        h.state.readImage = async () => 'data:image/jpeg;base64,new';
        h.state.save = save;
        await h.context.uploadWechatAiPhoneHomeWallpaper({ files: [{}], value: 'wallpaper.jpg' }, h.char.id);
        assert.equal(await h.state.crops[0].confirm('data:image/jpeg;base64,new-wallpaper'), false);
        assert.equal(await h.context.resetWechatAiPhoneHomeWallpaper(h.char.id), false);
        assert.deepEqual(clone(h.char.chatConfig.aiPhoneHomeSettings), before);
        assert.equal(h.state.rendered.length, 0);
        assert.equal(h.state.notices.length, 2);
    }
});

test('finishing image decoding after switching characters does not open a stale cropper', async () => {
    for (const kind of ['photo', 'wallpaper', 'icon']) {
        const h = harness();
        const pending = deferred();
        h.state.readImage = () => pending.promise;
        const input = { files: [{}], value: 'image.jpg' };
        const loading = kind === 'photo'
            ? h.context.uploadWechatAiPhoneHomePhoto(input, 0)
            : kind === 'wallpaper' ? h.context.uploadWechatAiPhoneHomeWallpaper(input, h.char.id)
                : h.context.uploadWechatAiPhoneAppIcon(input, 'memo');
        h.modal.dataset.charId = 'other';
        h.context.window._wechatAiPhoneOpenCharId = 'other';
        pending.resolve('data:image/jpeg;base64,late-image');
        await loading;
        assert.equal(h.state.crops.length, 0);
        assert.equal(h.state.writes.length, 0);
        assert.equal(input.value, '');
    }
});

test('a corrupt selected wallpaper leaves settings unchanged and can be selected again', async () => {
    const h = harness();
    const before = clone(h.char.chatConfig.aiPhoneHomeSettings);
    const input = { files: [{}], value: 'bad.png' };
    await h.context.uploadWechatAiPhoneHomeWallpaper(input, h.char.id);
    assert.equal(h.state.writes.length, 0);
    assert.equal(h.state.crops.length, 0);
    assert.equal(input.value, '');
    assert.deepEqual(clone(h.char.chatConfig.aiPhoneHomeSettings), before);
    assert.equal(h.state.notices[0], '图片加载失败');
});

test('only known apps and image sources are accepted as saved phone icons', () => {
    const h = harness();
    h.char.chatConfig.aiPhoneHomeSettings.icons = { memo: 'data:image/png;base64,memo', chat: 'https://example.com/chat.png', diary: 'javascript:alert(1)', unknown: 'data:image/png;base64,unknown' };
    const settings = h.context.getWechatAiPhoneHomeSettings(h.char);
    assert.deepEqual(clone(settings.icons), { memo: 'data:image/png;base64,memo', chat: 'https://example.com/chat.png' });
});

test('icon crops save only the chosen app and single/all resets preserve photos and wallpaper', async () => {
    const h = harness();
    h.char.chatConfig.aiPhoneHomeSettings.icons = { chat: 'data:image/png;base64,chat' };
    const before = clone(h.char.chatConfig.aiPhoneHomeSettings);
    h.state.readImage = async () => 'data:image/png;base64,source';
    const input = { files: [{}], value: 'icon.png' };
    await h.context.uploadWechatAiPhoneAppIcon(input, 'memo');
    assert.equal(input.value, '');
    assert.equal(h.state.writes.length, 0);
    assert.deepEqual(clone(h.char.chatConfig.aiPhoneHomeSettings), before);
    const crop = h.state.crops[0];
    assert.equal(crop.options.cropWidth, crop.options.cropHeight);
    assert.equal(crop.options.outputWidth, crop.options.outputHeight);
    assert.equal(await crop.confirm('data:image/jpeg;base64,cropped-icon'), true);
    assert.deepEqual(clone(h.char.chatConfig.aiPhoneHomeSettings), { ...before, icons: { ...before.icons, memo: 'data:image/jpeg;base64,cropped-icon' } });
    assert.equal(await h.context.resetWechatAiPhoneAppIcon('memo'), true);
    assert.deepEqual(clone(h.char.chatConfig.aiPhoneHomeSettings), before);
    assert.equal(await h.context.resetWechatAiPhoneAppIcon(), true);
    assert.deepEqual(clone(h.char.chatConfig.aiPhoneHomeSettings), { ...before, icons: {} });
});

test('failed icon saves and resets preserve the previous icon and report the storage error', async () => {
    for (const save of [async () => false, async () => { throw new Error('存储不可用'); }]) {
        const h = harness();
        h.char.chatConfig.aiPhoneHomeSettings.icons = { memo: 'data:image/png;base64,saved' };
        const before = clone(h.char.chatConfig.aiPhoneHomeSettings);
        h.state.readImage = async () => 'data:image/png;base64,source';
        h.state.save = save;
        await h.context.uploadWechatAiPhoneAppIcon({ files: [{}], value: 'icon.png' }, 'memo');
        assert.equal(await h.state.crops[0].confirm('data:image/jpeg;base64,new'), false);
        assert.equal(await h.context.resetWechatAiPhoneAppIcon('memo'), false);
        assert.deepEqual(clone(h.char.chatConfig.aiPhoneHomeSettings), before);
        assert.equal(h.state.rendered.length, 0);
        assert.equal(h.state.notices.length, 2);
    }
});

test('corrupt icons and unknown app keys never save or open a cropper', async () => {
    const h = harness();
    const before = clone(h.char.chatConfig.aiPhoneHomeSettings);
    const input = { files: [{}], value: 'bad.png' };
    await h.context.uploadWechatAiPhoneAppIcon(input, 'memo');
    assert.equal(input.value, '');
    assert.equal(h.state.notices[0], '图片加载失败');
    await h.context.uploadWechatAiPhoneAppIcon({ files: [{}], value: 'bad.png' }, 'unknown');
    assert.equal(h.context.resetWechatAiPhoneAppIcon('unknown'), false);
    assert.equal(h.state.writes.length, 0);
    assert.equal(h.state.crops.length, 0);
    assert.deepEqual(clone(h.char.chatConfig.aiPhoneHomeSettings), before);
});
