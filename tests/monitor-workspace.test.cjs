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

test('role toggles keep existing monitor errors without changing the independent pet binding', async () => {
    const h = harness();
    h.chars[1].chatConfig.monitorState = { lastError: 'provider unavailable' };
    const gate = deferred(); h.context.saveCharactersToStorage = () => gate.promise;
    const pending = h.context.toggleMonitorWatcher('b');
    assert.equal(h.storage.getItem('bynd_monitor_pet_bound_char_v1'), 'a');
    gate.resolve(true);
    assert.equal(await pending, true);
    assert.equal(h.storage.getItem('bynd_monitor_pet_bound_char_v1'), 'a');
    assert.equal(h.chars[1].chatConfig.monitorState.lastError, 'provider unavailable');
    assert.equal(h.notices.at(-1), 'B 已接入监控');
    assert.equal(await h.context.toggleMonitorWatcher('a'), true);
    assert.equal(h.storage.getItem('bynd_monitor_pet_bound_char_v1'), 'a');
    assert.equal(h.context.getMonitorPetBoundChar(), h.chars[0]);
    assert.equal(h.context.isMonitorPetEnabled(), true);
});

test('pets bind any existing role without requiring monitoring and never fall back to a watcher', () => {
    const h = harness();
    h.context.setMonitorPetBoundChar('b');
    assert.equal(h.context.getMonitorPetBoundChar(), h.chars[1]);
    assert.equal(h.chars[1].chatConfig.monitorEnabled, undefined);
    h.context.setMonitorPetBoundChar('');
    assert.equal(h.context.getMonitorPetBoundChar(), null);
    assert.equal(h.chars[0].chatConfig.monitorEnabled, true);
    h.context.setMonitorPetBoundChar('deleted-role');
    assert.equal(h.context.getMonitorPetBoundChar(), null);
});

test('closing and reopening a desktop pet leaves watcher configuration unchanged', () => {
    const h = harness(), before = JSON.stringify(h.chars);
    assert.equal(h.context.setMonitorPetEnabled(false), true);
    assert.equal(h.context.isMonitorPetEnabled(), false);
    assert.equal(JSON.stringify(h.chars), before);
    assert.equal(h.storage.getItem('bynd_monitor_pet_bound_char_v1'), 'a');
    assert.equal(h.context.setMonitorPetEnabled(true), true);
    assert.equal(JSON.stringify(h.chars), before);
    assert.equal(h.writes.length, 0);
});

test('chat monitoring still schedules watchers and presents barrage while the desktop pet is off', () => {
    const h = harness(), requests = [], shown = [];
    h.context.setMonitorPetEnabled(false);
    Object.assign(h.context, {
        WECHAT_MONITOR_MAX_WATCHERS: 3,
        getWechatMonitorMode: char => char.chatConfig?.monitorMode || 'persona',
        isWechatMonitorableUserMessage: () => true,
        getWechatMonitorEventId: () => 'message-1',
        requestWechatMonitorReaction: async (watcher, target) => requests.push([watcher.id,target.id]),
        showWechatMonitorIsland: () => shown.push('island'),
        showWechatMonitorWarning: () => shown.push('warning'),
        showWechatMonitorBarrage: (_, phrases) => shown.push(phrases),
        buildWechatMonitorBarrageBurst: phrases => phrases
    });
    vm.runInContext(sourceSection('wechat.js','function getWechatMonitorWatchers(', 'function buildWechatMonitorMessages('), h.context);
    vm.runInContext(sourceSection('wechat.js','function presentWechatMonitorReaction(', 'function showWechatMonitorIsland('), h.context);
    h.context.notifyWechatMonitors(h.chars[1], {type:'text',content:'今天一起看电影'});
    h.timers.forEach(run => run());
    assert.deepEqual(requests,[['a','b']]);
    const phrases = ['观众甲：这个转折有意思'];
    h.context.presentWechatMonitorReaction(h.chars[0],h.chars[1],{island:'新的监控反应',barrage:phrases},'barrage');
    assert.deepEqual(shown,['island',phrases]);
    assert.equal(h.context.isMonitorPetEnabled(),false);
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

test('monitor records and desktop-pet records are separate and keep their original timestamps', () => {
    const h = harness();
    vm.runInContext(fs.readFileSync(path.join(root, 'modules/monitor/workspace.js'), 'utf8'), h.context);
    assert.equal(h.context.ByndMonitor.activity().length, 0);
    h.chars[0].history.push({ content: 'ordinary chat', timestamp: 900 });
    h.chars[0].history.push({ monitorEvent: true, content: '【旁观吐槽：你和B】hello', timestamp: 100, monitorLevel: 'island' });
    h.chars[1].chatConfig.monitorState = { lastAt: 200, lastBarrage: ['one', 'two'] };
    h.chars[0].chatConfig.monitorPetState = { bubbleText: 'pet', bubbleAt: 300, pending: true };
    const records = h.context.ByndMonitor.activity();
    assert.deepEqual(Array.from(records, item => [item.text, item.kind, item.at]), [['one\ntwo','barrage',200],['hello','island',100]]);
    assert.deepEqual(Array.from(h.context.ByndPetWorkspace.activity(), item => [item.text, item.kind, item.at]), [['pet','pet',300]]);
    h.context.refreshMonitorApp();
    assert.equal(h.context.ByndMonitor.activity().length, 2);
});

test('workspace image sources reject executable schemes and keep supported local images', () => {
    const h = harness();
    vm.runInContext(fs.readFileSync(path.join(root, 'modules/monitor/workspace.js'), 'utf8'), h.context);
    const source = h.context.ByndMonitor.imageSource;
    for (const value of ['javascript:alert(1)', 'vbscript:test', 'data:text/html,<script>', '//untrusted.example/a']) assert.equal(source(value), '');
    for (const value of ['data:image/png;base64,AA==', 'blob:https://bynd.ccwu.cc/1', 'assets/avatar.png', 'https://example.test/a.png']) assert.equal(source(value), value);
});

test('monitor and pet navigation persist separate tabs and do not affect either role binding', () => {
    const h = harness();
    vm.runInContext(fs.readFileSync(path.join(root, 'modules/monitor/workspace.js'), 'utf8'), h.context);
    h.context.ByndPetWorkspace.navigate('phone');
    h.context.ByndMonitor.navigate('island');
    assert.equal(h.storage.getItem('bynd_pet_active_tool_v1'), 'phone');
    assert.equal(h.storage.getItem('bynd_monitor_active_tool_v1'), 'island');
    assert.equal(h.storage.getItem('bynd_monitor_pet_bound_char_v1'), 'a');
    assert.equal(h.writes.length, 0);
});

function desktopHarness(saved, { fail = false, folder = false } = {}) {
    const storage = memoryStorage({ desktop_layout_v2: JSON.stringify(saved) });
    const nodes = [], writes = [];
    const context = vm.createContext({ localStorage: storage, DESKTOP_LAYOUT_KEY: 'desktop_layout_v2',
        DESKTOP_APPS: [{id:'pet'}], _desktopLayoutNeedsVisiblePersist: false,
        window: { _folders: folder ? [{apps:[{id:'pet'}]}] : [] },
        document: { querySelectorAll: () => nodes },
        collectDesktopDockLayout: () => saved.dock || [],
        getDesktopAppIdFromElement: node => node.id,
        ensureDesktopPage: () => ({ querySelector: () => ({classList:{contains:() => true}}) }),
        hasDesktopMeasurableLayoutCanvas: () => true,
        addDesktopAppAfterFolderPage: app => { nodes.push(app); return app; },
        persistDesktopLayoutRepair: previous => {
            if (fail) return false;
            const next = {...previous, items:[...(previous.items || []), ...nodes.map(node=>({id:'app-'+node.id}))]};
            storage.setItem('desktop_layout_v2',JSON.stringify(next)); writes.push(JSON.parse(JSON.stringify(next))); return true;
        }
    });
    vm.runInContext(sourceSection('script.js','function migrateDesktopPetApp()', 'function cleanupRemovedWatchTogetherData()'), context);
    return { context, storage, nodes, writes };
}

test('adding the pet desktop entry preserves the saved layout and does not re-add a removed icon', () => {
    const existing = {id:'app-monitor',page:2,x:58,y:120};
    const h = desktopHarness({items:[existing],dock:['wechat'],custom:'keep'});
    assert.equal(h.context.migrateDesktopPetApp(), true);
    assert.deepEqual(h.writes[0].items[0],existing);
    assert.equal(h.writes[0].custom,'keep');
    assert.deepEqual(h.writes[0].dock,['wechat']);
    h.nodes.length = 0;
    h.storage.setItem('desktop_layout_v2',JSON.stringify({items:[existing],dock:['wechat']}));
    assert.equal(h.context.migrateDesktopPetApp(), false);
    assert.equal(h.nodes.length,0);
});

test('pet entry migration recognizes folders and retains retry state after a failed layout save', () => {
    const folder = desktopHarness({items:[]}, {folder:true});
    assert.equal(folder.context.migrateDesktopPetApp(), false);
    assert.equal(folder.nodes.length,0);
    const failed = desktopHarness({items:[{id:'app-monitor'}]}, {fail:true});
    assert.equal(failed.context.migrateDesktopPetApp(), true);
    assert.equal(failed.storage.getItem('bynd_desktop_pet_entry_v1'),null);
    assert.equal(failed.context._desktopLayoutNeedsVisiblePersist,true);
    assert.equal(failed.context.migrateDesktopPetApp(), false);
    assert.equal(failed.storage.getItem('bynd_desktop_pet_entry_v1'),null);
    assert.equal(failed.nodes.length,1);
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
