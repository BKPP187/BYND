const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { sourceSection } = require('./helpers/harness.cjs');

function harness() {
    const context = vm.createContext({
        window: {},
        stripWechatPromptText: (value, limit) => String(value || '').trim().slice(0, limit),
        normalizeWechatMonitorLevel: value => value || 'barrage',
        getWechatMonitorMode: () => 'observer',
        repairWechatObserverBarrageSpeakers: async reaction => reaction
    });
    for (const [from, to] of [
        ['function getWechatMonitorBarrageStyle(', 'function getWechatMonitorModePrompt('],
        ['function normalizeWechatBarrageItemText(', 'function extractWechatBarrageRepairLines('],
        ['async function ensureWechatObserverReactionVisible(', 'function escalateWechatMonitorLevel('],
        ['function buildWechatMonitorScrollItems(', 'function showWechatMonitorScrollingBarrage(']
    ]) vm.runInContext(sourceSection('apps/wechat/chat/calls.js', from, to), context);
    return context;
}

test('old/imported chats keep cards; scrolling prompts request contextual short chatter and occasional chants', () => {
    const h = harness();
    for (const value of [undefined, null, 'unknown', 'cards']) assert.equal(h.getWechatMonitorBarrageStyle({chatConfig:{monitorBarrageStyle:value}}), 'cards');
    assert.equal(h.getWechatMonitorBarrageStyle({chatConfig:{monitorBarrageStyle:'scroll'}}), 'scroll');
    const prompt = h.getWechatMonitorBarrageStylePrompt({chatConfig:{monitorBarrageStyle:'scroll'}});
    assert.match(prompt, /2-18 字/);
    assert.match(prompt, /本轮话题/);
    assert.match(prompt, /少量自然跑题/);
    assert.match(prompt, /不得每轮都刷屏/);
    assert.match(h.getWechatMonitorBarrageStylePrompt({}), /chorus 留空/);
});

test('ordinary batches stay sparse; short model-selected reactions create a bounded repeated wave', () => {
    const h = harness(), phrases = ['路人甲：俺也一样', '路人乙：这瓜保熟吗', '路人丙：突然对上脑电波'];
    assert.equal(h.buildWechatMonitorScrollItems(phrases, '').length, 3);
    const chorus = h.buildWechatMonitorScrollItems(phrases, phrases[0]);
    assert.equal(chorus.length, 21);
    assert.equal(chorus.filter(item => item.repeat).length, 18);
    assert.ok(chorus.filter(item => item.repeat).every(item => item.text === phrases[0]));
    assert.equal(h.buildWechatMonitorScrollItems(phrases, '不在当轮里的固定梗').length, 3);
    assert.equal(h.buildWechatMonitorScrollItems(['路人甲：'+'很长的评论'.repeat(8)], '路人甲：'+'很长的评论'.repeat(8)).length, 1);
    assert.equal(h.buildWechatMonitorScrollItems([], '俺也一样').length, 0);
});

test('chorus validation survives observer sanitization and rejects invented or invalid speaker text', async () => {
    const h = harness();
    const raw = {level:'barrage', barrage:['路人甲：俺也一样', '路人乙：笑出声了'], chorus:'路人甲：俺也一样'};
    const reaction = h.normalizeWechatMonitorReaction(raw);
    const clean = await h.ensureWechatObserverReactionVisible({}, {}, {}, reaction);
    assert.equal(clean.chorus, '路人甲：俺也一样');
    assert.equal(clean.deleteContact, null);
    assert.equal(h.normalizeWechatMonitorReaction({...raw,chorus:'路人丙：另一个梗'}).chorus, '');
    const invalid = h.normalizeWechatMonitorReaction({...raw,barrage:['用户：别复制聊天台词','路人乙：笑出声了'],chorus:'用户：别复制聊天台词'});
    assert.equal((await h.ensureWechatObserverReactionVisible({}, {}, {}, invalid)).chorus, '');
});

test('the visible chat owns display style even when a different character is watching', () => {
    const h = harness(), calls = [];
    h.window.myCharacters = [{id:'target',chatConfig:{monitorBarrageStyle:'scroll'}}];
    h.window.currentChatCharId = 'target';
    h.showWechatMonitorScrollingBarrage = (...args) => calls.push(args);
    vm.runInContext(sourceSection('apps/wechat/chat/calls.js', 'function showWechatMonitorBarrage(', 'function buildWechatMonitorScrollItems('), h);
    const watcher = {id:'watcher',chatConfig:{monitorBarrageStyle:'cards'}};
    h.showWechatMonitorBarrage(watcher, ['短评']);
    assert.equal(calls[0][2].targetChar.id, 'target');
    assert.equal(calls[0][0].id, 'watcher');
    h.window.currentChatCharId = 'elsewhere';
    h.showWechatMonitorBarrage(watcher, ['迟到的短评'], {targetChar:h.window.myCharacters[0]});
    assert.equal(calls.length, 1, 'a late response does not drift over another chat');
});

test('the actual reaction request includes the observed chat style, not the watcher style', () => {
    const h = harness();
    const target = {id:'target',name:'南风',chatConfig:{monitorBarrageStyle:'scroll'}}, watcher = {name:'林间',chatConfig:{monitorBarrageStyle:'cards'}};
    Object.assign(h, {
        WECHAT_MONITOR_MODE_LABELS:{observer:'第三方视角',persona:'角色本人'},
        getWechatCharDisplayName:char=>char.name,
        getWechatMessagePromptContent:msg=>msg.content,
        buildWechatRecentHistoryForPrompt:()=>'', buildWechatWorldBookPrompt:()=>''
    });
    vm.runInContext(sourceSection('apps/wechat/chat/calls.js','function getWechatMonitorModePrompt(','function getWechatMonitorWatchers('),h);
    vm.runInContext(sourceSection('apps/wechat/chat/calls.js','function buildWechatMonitorMessages(','function normalizeWechatMonitorLevel('),h);
    const content = h.buildWechatMonitorMessages(watcher,target,{content:'一起吃瓜呀'}).map(message=>message.content).join('\n');
    assert.match(content,/看剧式慢速飘屏/);
    assert.match(content,/只有本轮出现爆笑、反转/);
    assert.match(content,/barrage, chorus, deleteContact/);
});

test('the last generated comment can lead a chorus even when the normal burst caps at nine', () => {
    const h = harness(), shown = [];
    Object.assign(h, {navigator:{}, showWechatMonitorIsland(){}, showWechatMonitorBarrage:(_,phrases,options)=>shown.push({phrases,options}), buildWechatMonitorBarrageBurst:phrases=>phrases.slice(0,9)});
    vm.runInContext(sourceSection('apps/wechat/chat/calls.js','function presentWechatMonitorReaction(','function showWechatMonitorIsland('),h);
    const barrage = Array.from({length:10},(_,index)=>`观众${index}：接梗${index}`);
    h.presentWechatMonitorReaction({}, {}, {island:'接梗',barrage,chorus:barrage[9]},'barrage');
    assert.ok(shown[0].phrases.includes(barrage[9]));
    assert.equal(shown[0].options.chorus,barrage[9]);
    assert.equal(h.buildWechatMonitorScrollItems(shown[0].phrases,shown[0].options.chorus).filter(item=>item.repeat).length,18);
});
