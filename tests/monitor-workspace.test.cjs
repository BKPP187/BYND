const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { root, sourceSection, memoryStorage, deferred } = require('./helpers/harness.cjs');

function harness() {
    const storage = memoryStorage({ bynd_monitor_pet_bound_char_v1: 'a' });
    const notices = [], writes = [], timers = [];
    const chars = [{ id: 'a', name: 'A', chatConfig: { monitorEnabled: true, monitorMode: 'persona' }, history: [] }, { id: 'b', name: 'B', chatConfig: {}, history: [] }];
    const context = vm.createContext({
        localStorage: storage, myCharacters: chars, console, URL, Date, Math,
        navigator: {}, document: { getElementById: () => null, querySelector: () => null },
        setTimeout(fn) { timers.push(fn); return timers.length; }, clearTimeout() {},
        requestAnimationFrame() {}, addEventListener() {},
        showWechatToast: message => notices.push(message),
        saveCharactersToStorage: async () => { writes.push(JSON.parse(JSON.stringify(chars))); return true; },
        musicEscapeHtml: text => String(text).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c])),
        musicEscapeAttr: text => String(text).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]))
    });
    context.window = context;
    vm.runInContext(sourceSection('script.js', '// --- BYND Monitor / 内部监控剧情入口 ---', '// --- BYND Outing / 一起出门 ---'), context);
    return { context, storage, notices, writes, chars, timers, read: code => vm.runInContext(code, context) };
}

test('failed role save restores only the changed field and never moves the pet binding', async () => {
    const h = harness();
    h.context.saveCharactersToStorage = async () => { h.chars[1].history.push({ content: 'arrived during save' }); h.chars[1].chatConfig.nickname = 'new nickname'; return false; };
    assert.equal(await h.context.toggleMonitorWatcher('b'), false);
    assert.equal(Object.hasOwn(h.chars[1].chatConfig, 'monitorEnabled'), false);
    assert.equal(h.chars[1].chatConfig.nickname, 'new nickname');
    assert.equal(h.chars[1].history.length, 1);
    assert.equal(h.storage.getItem('bynd_monitor_pet_bound_char_v1'), 'a');
    assert.deepEqual(h.notices, ['设置未能保存，请重试。']);
});

test('rejected speed saves roll back and pending saves cannot interleave monitor settings', async () => {
    const h = harness(), gate = deferred();
    h.context.saveCharactersToStorage = () => gate.promise;
    const first = h.context.setMonitorWatcherSpeed('a', '1.4');
    assert.equal(await h.context.setMonitorWatcherMode('a', 'observer'), false);
    assert.equal(h.chars[0].chatConfig.monitorMode, 'persona');
    gate.reject(new Error('disk full'));
    assert.equal(await first, false);
    assert.equal(Object.hasOwn(h.chars[0].chatConfig, 'monitorBarrageSpeed'), false);
    assert.deepEqual(h.notices, ['disk full']);
    h.context.saveCharactersToStorage = async () => true;
    assert.equal(await h.context.setMonitorWatcherMode('a', 'observer'), true);
    assert.equal(h.chars[0].chatConfig.monitorMode, 'observer');
});

test('role toggles keep existing monitor errors and bind only after successful persistence', async () => {
    const h = harness();
    h.chars[1].chatConfig.monitorState = { lastError: 'provider unavailable' };
    const gate = deferred(); h.context.saveCharactersToStorage = () => gate.promise;
    const pending = h.context.toggleMonitorWatcher('b');
    assert.equal(h.storage.getItem('bynd_monitor_pet_bound_char_v1'), 'a');
    gate.resolve(true);
    assert.equal(await pending, true);
    assert.equal(h.storage.getItem('bynd_monitor_pet_bound_char_v1'), 'b');
    assert.equal(h.chars[1].chatConfig.monitorState.lastError, 'provider unavailable');
    assert.equal(h.notices.at(-1), 'B 已开启陪伴');
});

test('refresh and view navigation do not clear errors, save characters, search online or call a model', () => {
    const h = harness(); let searches = 0, requests = 0;
    h.chars[0].chatConfig.monitorState = { lastError: '429', lastAt: 123 };
    h.context.searchMonitorPets = () => searches++;
    h.context.callChatApi = () => requests++;
    for (const view of ['internal', 'pet', 'phone', 'island', 'pet']) h.context.handleMonitorTool(view);
    h.context.initMonitorApp(); h.context.refreshMonitorApp(); h.context.refreshMonitorWatcher('a');
    assert.equal(h.chars[0].chatConfig.monitorState.lastError, '429');
    assert.equal(h.chars[0].chatConfig.monitorState.lastAt, 123);
    assert.equal(h.writes.length, 0); assert.equal(searches, 0); assert.equal(requests, 0);
});

test('storage failures leave pet and observation switches unchanged without success messages', () => {
    const h = harness();
    h.storage.setItem('bynd_monitor_pet_enabled_v1', '1');
    h.storage.setItem('bynd_monitor_pet_observe_interval_v1', '120');
    h.storage.setItem = () => { throw new Error('quota exceeded'); };
    h.context.setMonitorPetEnabled(false);
    assert.equal(h.context.setMonitorPetObserveInterval('0'), false);
    assert.equal(h.context.isMonitorPetEnabled(), true);
    assert.equal(h.context.getMonitorPetAutoObserveIntervalMs(), 120000);
    assert.deepEqual(h.notices, ['桌宠开关未能保存，请重试。', '观察频率未能保存，请重试。']);
});

test('all observation frequencies persist without starting screen capture or a background timer', () => {
    const h = harness();
    for (const value of [0, 60, 120, 300, 600]) {
        assert.equal(h.context.setMonitorPetObserveInterval(value), true);
        assert.equal(h.context.getMonitorPetAutoObserveIntervalMs(), value * 1000);
    }
    assert.equal(h.timers.length, 0);
    assert.equal(h.context.isMonitorScreenSharingActive(), false);
    assert.match(h.read('monitorScreenStatus'), /共享开启后/);
});

test('screen start reports denial and unsupported browsers without claiming to share', async () => {
    const h = harness();
    h.context.ByndAndroid = { startScreenCapture() { throw new Error('cancelled'); }, captureScreenFrame() { return ''; }, isScreenCaptureActive() { return 'false'; } };
    await h.context.startMonitorScreenShare();
    assert.match(h.read('monitorScreenStatus'), /授权失败.*cancelled/);
    assert.equal(h.context.isMonitorScreenSharingActive(), false);
    delete h.context.ByndAndroid;
    await h.context.startMonitorScreenShare();
    assert.match(h.read('monitorScreenStatus'), /暂不支持共享屏幕/);
    assert.doesNotMatch(h.read('monitorScreenStatus'), /MediaProjection/);
});

test('failed screen stop retains active state and frame instead of showing a false stopped state', () => {
    const h = harness();
    h.context.ByndAndroid = { stopScreenCapture() { throw new Error('native failure'); }, captureScreenFrame() {}, isScreenCaptureActive() { return 'true'; } };
    h.read("monitorScreenFrameDataUrl = 'data:image/png;base64,AAAA'; monitorScreenLastCaptureAt = 17;");
    h.context.stopMonitorScreenShare();
    assert.equal(h.context.isMonitorScreenSharingActive(), true);
    assert.equal(h.read('monitorScreenFrameDataUrl'), 'data:image/png;base64,AAAA');
    assert.match(h.read('monitorScreenStatus'), /未能停止共享.*native failure/);
    assert.doesNotMatch(h.read('monitorScreenStatus'), /已停止/);
});

test('a manual screen preview only reads one frame and a successful stop clears it', async () => {
    const h = harness(); let active = true, captures = 0, requests = 0;
    h.context.callChatApi = () => requests++;
    h.context.ByndAndroid = { stopScreenCapture() { active = false; }, captureScreenFrame() { captures++; return 'data:image/png;base64,AAAA'; }, isScreenCaptureActive() { return String(active); } };
    assert.equal(await h.context.captureMonitorScreenFrame(), 'data:image/png;base64,AAAA');
    assert.equal(captures, 1); assert.equal(requests, 0);
    h.context.stopMonitorScreenShare();
    assert.equal(h.context.isMonitorScreenSharingActive(), false);
    assert.equal(h.read('monitorScreenFrameDataUrl'), '');
    assert.equal(h.read('monitorScreenLastCaptureAt'), 0);
    assert.equal(h.read('monitorScreenStatus'), '屏幕共享已停止');
});

test('activity shows actual monitor and pet records in time order without inventing idle messages', () => {
    const h = harness();
    vm.runInContext(fs.readFileSync(path.join(root, 'modules/monitor/workspace.js'), 'utf8'), h.context);
    assert.equal(h.context.ByndMonitor.activity().length, 0);
    h.chars[0].history.push({ content: 'ordinary chat', timestamp: 900 });
    h.chars[0].history.push({ monitorEvent: true, content: '【旁观吐槽：你和B】hello', timestamp: 100, monitorLevel: 'island' });
    h.chars[1].chatConfig.monitorState = { lastAt: 200, lastBarrage: ['one', 'two'] };
    h.chars[0].chatConfig.monitorPetState = { bubbleText: 'pet', bubbleAt: 300, pending: true };
    const records = h.context.ByndMonitor.activity();
    assert.deepEqual(Array.from(records, item => [item.text, item.kind, item.at]), [['pet','pet',300],['one\ntwo','barrage',200],['hello','island',100]]);
    h.context.refreshMonitorApp();
    assert.equal(h.context.ByndMonitor.activity().length, 3);
});

test('workspace image sources reject executable schemes and keep supported local images', () => {
    const h = harness();
    vm.runInContext(fs.readFileSync(path.join(root, 'modules/monitor/workspace.js'), 'utf8'), h.context);
    const source = h.context.ByndMonitor.imageSource;
    for (const value of ['javascript:alert(1)', 'vbscript:test', 'data:text/html,<script>', '//untrusted.example/a']) assert.equal(source(value), '');
    for (const value of ['data:image/png;base64,AA==', 'blob:https://bynd.ccwu.cc/1', 'assets/avatar.png', 'https://example.test/a.png']) assert.equal(source(value), value);
});

test('switching to a library pet restores selection when the character profile cannot be saved', async () => {
    const h = harness();
    h.storage.setItem('bynd_monitor_pet_library_v1', JSON.stringify([{id:'new-pet',displayName:'New'}]));
    h.storage.setItem('bynd_monitor_active_pet_v1', 'old-pet');
    h.storage.setItem('bynd_monitor_pet_enabled_v1', '0');
    h.context.ByndCharacterPet = { profile: () => ({active:true}), update: async () => { throw new Error('character save failed'); } };
    await h.context.applyMonitorPet('new-pet');
    assert.equal(h.storage.getItem('bynd_monitor_active_pet_v1'), 'old-pet');
    assert.equal(h.storage.getItem('bynd_monitor_pet_enabled_v1'), '0');
    assert.match(h.read('monitorPetStatus'), /切换未能保存.*character save failed/);
    assert.equal(h.timers.length, 0);
    assert.equal(h.notices.length, 0);
});

test('a failed library preference write cannot deactivate a confirmed character pet', async () => {
    const h = harness(); let profileWrites = 0;
    h.storage.setItem('bynd_monitor_pet_library_v1', JSON.stringify([{id:'new-pet',displayName:'New'}]));
    h.context.ByndCharacterPet = { profile: () => ({active:true}), update: async () => { profileWrites++; } };
    const set = h.storage.setItem;
    h.storage.setItem = (key,value) => { if(key === 'bynd_monitor_active_pet_v1') throw new Error('quota'); set(key,value); };
    await h.context.applyMonitorPet('new-pet');
    assert.equal(profileWrites, 0);
    assert.equal(h.storage.getItem('bynd_monitor_active_pet_v1'), null);
    assert.equal(h.timers.length, 0);
    assert.match(h.read('monitorPetStatus'), /切换未能保存/);
});
