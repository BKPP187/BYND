const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { test } = require('node:test');

const source = fs.readFileSync('script.js', 'utf8');
const moduleSource = source.slice(
    source.indexOf('// --- Dream Vault / 盗梦空间 ---'),
    source.indexOf('// --- BYND Monitor / 内部监控剧情入口 ---')
);
const writingKey = 'bynd_dream_writing_v1';
const recordsKey = 'bynd_dream_records_v1';
const plain = value => JSON.parse(JSON.stringify(value));
const payload = {
    title: '雨停之前', summary: '一次还没有说完的告别。',
    intent: '想问对方是否愿意多留一会儿。',
    openingScene: '窗缝里有细小的风声。\n\n我把那句话咽了回去。',
    charAction: '我把另一杯茶推过去。\n\n“雨还没停。”',
    choices: ['留在原地，听他说完', '告诉他今天要先走'],
    imagePrompt: 'a quiet room after rain, a window and two cups'
};

function setup() {
    const store = new Map();
    const notices = new Map(['dream-status', 'dream-preview-status', 'dream-session-status']
        .map(id => [id, { textContent: '', dataset: {} }]));
    notices.set('dream-preview-view', { classList: { contains: () => false } });
    const radios = [
        ['style', 'prose'], ['style', 'fiction'],
        ['viewpoint', 'character'], ['viewpoint', 'second'], ['viewpoint', 'forum']
    ].map(([key, value]) => ({ dataset: { dreamWriting: key }, value }));
    let failKey = '';
    const char = { id: 'writer', name: '林舟', description: '27 岁，克制，不轻易许诺。', avatar: 'data:image/png;base64,AAAA' };
    const context = vm.createContext({
        URL, console, confirm: () => true,
        document: {
            getElementById: id => notices.get(id) || null,
            querySelectorAll: selector => selector.includes('input[data-dream-writing]') ? radios : []
        },
        localStorage: {
            getItem: key => store.get(key) || null,
            setItem: (key, value) => {
                if (key === failKey) throw new Error('QA storage full');
                store.set(key, value);
            }
        },
        musicEscapeAttr: value => String(value || ''),
        musicEscapeHtml: value => String(value || ''),
        getWechatSortedChatCharacters: () => [char],
        getWechatChatUserProfile: () => ({ name: '许宁' }),
        buildWechatIdentityContextPrompt: () => 'IDENTITY_CONTEXT',
        getWechatCharacterPersonaText: () => 'PERSONA_AND_WORLD_BOOK',
        buildWechatMemoryPrompt: () => 'RELATIONSHIP_MEMORY',
        buildWechatRecentHistoryForPrompt: () => 'RECENT_CHAT',
        callChatApi: async () => ({ ok: true, content: JSON.stringify(payload) }),
        callWechatImageGenerationApi: async () => ({ ok: false, error: 'QA image unavailable' }),
        window: { location: { href: 'http://localhost/' }, myCharacters: [char] }
    });
    vm.runInContext(moduleSource, context);
    return { context, store, notices, radios, char, failOn: key => { failKey = key; } };
}

test('writing choices persist, reject unknown values, and recover from malformed storage', () => {
    const { context: c, store } = setup();
    assert.deepEqual(plain(c.getDreamWritingPreferences()), { style: 'prose', viewpoint: 'character' });
    assert.equal(c.setDreamWritingPreference('style', 'fiction'), true);
    assert.equal(c.setDreamWritingPreference('viewpoint', 'forum'), true);
    assert.deepEqual(JSON.parse(store.get(writingKey)), { style: 'fiction', viewpoint: 'forum' });
    assert.equal(c.setDreamWritingPreference('__proto__', 'anything'), false);
    assert.equal(c.setDreamWritingPreference('viewpoint', 'unknown'), false);
    assert.equal(c.getDreamWritingPreferences().viewpoint, 'forum');
    store.set(writingKey, JSON.stringify({ style: 'invalid', viewpoint: 'second' }));
    assert.deepEqual(plain(c.getDreamWritingPreferences()), { style: 'prose', viewpoint: 'second' });
    store.set(writingKey, '{broken');
    assert.deepEqual(plain(c.getDreamWritingPreferences()), { style: 'prose', viewpoint: 'character' });
    const backup = fs.readFileSync('settings.js', 'utf8').split('const ALL_DATA_KEYS = [')[1].split('];')[0];
    assert.ok(backup.includes("'" + writingKey + "'"), 'backups must retain dream preferences');
});

test('all six style/viewpoint combinations retain persona, relationship and meaningful user choices', () => {
    const { context: c, char } = setup();
    const styles = { prose: '【文风：散文】', fiction: '【文风：细腻情感小说】' };
    const views = {
        character: '【视角：角色第一人称】',
        second: '【视角：第二人称全景】',
        forum: '【视角：第三人称旁观者论坛体】'
    };
    for (const [style, styleLabel] of Object.entries(styles)) {
        for (const [viewpoint, viewpointLabel] of Object.entries(views)) {
            const prompt = c.buildDreamGenerationMessages(char, { style, viewpoint }).map(x => x.content).join('\n');
            for (const text of [styleLabel, viewpointLabel, 'IDENTITY_CONTEXT', 'PERSONA_AND_WORLD_BOOK',
                'RELATIONSHIP_MEMORY', 'RECENT_CHAT', '不代表现实中的用户已经动心', '梦中进展不等于现实关系升级',
                'choices 都描述用户本人的下一步反应', '不描写露骨性行为', '\\n\\n']) {
                assert.ok(prompt.includes(text), 'missing ' + text + ' for ' + style + '/' + viewpoint);
            }
            assert.equal(Object.values(styles).filter(label => prompt.includes(label)).length, 1);
            assert.equal(Object.values(views).filter(label => prompt.includes(label)).length, 1);
        }
    }
});

test('continuation and old-record reconstruction use the record settings, independent of global choices', () => {
    const { context: c, char } = setup();
    c.saveDreamWritingPreferences({ style: 'prose', viewpoint: 'character' });
    const record = { ...payload, writing: { style: 'fiction', viewpoint: 'forum' } };
    for (const bootstrap of [false, true]) {
        const messages = c.buildDreamInteractionMessages(char, record, null, '告诉他今天要先走', bootstrap);
        assert.match(messages[0].content, /【文风：细腻情感小说】/);
        assert.match(messages[0].content, /【视角：第三人称旁观者论坛体】/);
        assert.doesNotMatch(messages[0].content, /【视角：角色第一人称】/);
        assert.ok(messages[0].content.includes('不要把拒绝当作同意'));
        if (!bootstrap) assert.ok(messages[1].content.includes('告诉他今天要先走'));
    }
    const legacy = c.buildDreamInteractionMessages(char, payload, null, '', true)[0].content;
    assert.match(legacy, /【视角：第二人称全景】/);
    assert.match(legacy, /【文风：细腻情感小说】/);
});

test('an in-flight generation keeps its original writing settings and natural paragraphs', async () => {
    const { context: c, store, radios } = setup();
    let finish;
    let request;
    c.callChatApi = messages => {
        request = messages;
        return new Promise(resolve => { finish = resolve; });
    };
    const pending = c.generateDreamRecord();
    assert.ok(radios.every(input => input.disabled));
    assert.equal(c.setDreamWritingPreference('style', 'fiction'), false);
    store.set(writingKey, JSON.stringify({ style: 'fiction', viewpoint: 'forum' }));
    finish({ ok: true, content: JSON.stringify(payload) });
    await pending;
    const record = c.getDreamRecords()[0];
    assert.deepEqual(plain(record.writing), { style: 'prose', viewpoint: 'character' });
    assert.match(request[0].content, /【视角：角色第一人称】/);
    assert.equal(record.openingScene, payload.openingScene);
    assert.ok(record.imageError, 'text remains saved when image generation fails');
    assert.ok(radios.every(input => !input.disabled));
    assert.equal(c.getDreamWritingPreferences().viewpoint, 'forum');
});

test('failed preference saves restore the selected radio and keep the saved value', () => {
    const { context: c, store, notices, radios, failOn } = setup();
    c.saveDreamWritingPreferences({ style: 'fiction', viewpoint: 'second' });
    const previous = store.get(writingKey);
    failOn(writingKey);
    assert.equal(c.setDreamWritingPreference('viewpoint', 'forum'), false);
    assert.equal(store.get(writingKey), previous);
    assert.equal(radios.find(input => input.value === 'second').checked, true);
    assert.equal(radios.find(input => input.value === 'forum').checked, false);
    assert.equal(notices.get('dream-status').dataset.tone, 'error');
    assert.match(notices.get('dream-status').textContent, /未保存/);
});

test('failed record writes do not open a successful preview or overwrite an existing session', async () => {
    const { context: c, store, notices, failOn } = setup();
    failOn(recordsKey);
    await c.generateDreamRecord();
    assert.equal(c.getDreamRecords().length, 0);
    assert.equal(vm.runInContext('dreamPreviewRecordId', c), '');
    assert.equal(vm.runInContext('dreamGenerating', c), false);
    assert.equal(notices.get('dream-status').dataset.tone, 'error');
    store.set(recordsKey, JSON.stringify([{ ...payload, id: 'saved', charId: 'writer', session: null }]));
    await c.enterDreamRecord('saved');
    assert.equal(c.getDreamRecordById('saved').session, null);
    assert.match(notices.get('dream-preview-status').textContent, /入梦未保存/);
    failOn('');
    await c.enterDreamRecord('saved');
    const previous = store.get(recordsKey);
    failOn(recordsKey);
    c.callChatApi = async () => ({
        ok: true, content: JSON.stringify({
            scene: '雨停了。\n\n他把伞收起来。', charAction: '“路上小心。”',
            choices: ['告别', '停一会儿'], isEnding: false, endingTitle: ''
        })
    });
    await c.advanceDreamSession(0);
    assert.equal(store.get(recordsKey), previous);
    assert.equal(notices.get('dream-session-status').dataset.tone, 'error');
});

test('regeneration restores the original record settings and stops on a preference save failure', () => {
    const { context: c, store, notices, failOn } = setup();
    store.set(recordsKey, JSON.stringify([{
        ...payload, id: 'saved', charId: 'writer', writing: { style: 'fiction', viewpoint: 'forum' }
    }]));
    assert.equal(c.prepareDreamRegeneration('saved'), true);
    assert.deepEqual(plain(c.getDreamWritingPreferences()), { style: 'fiction', viewpoint: 'forum' });
    c.saveDreamWritingPreferences({ style: 'prose', viewpoint: 'second' });
    failOn(writingKey);
    assert.equal(c.prepareDreamRegeneration('saved', true), false);
    assert.equal(c.getDreamWritingPreferences().viewpoint, 'second');
    assert.equal(notices.get('dream-preview-status').dataset.tone, 'error');
    assert.equal(vm.runInContext('dreamGenerating', c), false);
});
