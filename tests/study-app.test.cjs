const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { root, memoryStorage, deferred } = require('./helpers/harness.cjs');

const source = fs.readFileSync(path.join(root, 'modules/study/study-app.js'), 'utf8');
const KEYS = { cards: 'bynd_study_cards_v1', languages: 'bynd_study_languages_v1', settings: 'bynd_study_settings_v1', chats: 'bynd_study_chats_v1', checkins: 'bynd_study_checkins_v1' };
const plain = value => JSON.parse(JSON.stringify(value));
const turn = (reply, extra = {}) => ({ ok: true, content: JSON.stringify({ reply, versions: {}, translation: '翻译：' + reply, correction: null, words: [], ...extra }) });

function element(id) {
    const classes = new Set();
    const el = {
        id, innerHTML: '', textContent: '', value: '', dataset: {}, scrollTop: 0, scrollHeight: 0,
        classList: { add: n => classes.add(n), remove: n => classes.delete(n), contains: n => classes.has(n), toggle: (n, f) => { f ? classes.add(n) : classes.delete(n); } },
        querySelector: () => null, querySelectorAll: () => [], focus() {}, setSelectionRange() {}
    };
    return el;
}

function harness({ characters, entries = {}, storageFailKey = '' } = {}) {
    const storage = memoryStorage(entries);
    const rawSet = storage.setItem.bind(storage);
    storage.setItem = (key, value) => { if (key === storageFailKey) { const error = new Error('QuotaExceededError'); error.name = 'QuotaExceededError'; throw error; } rawSet(key, value); };
    const chars = characters || [
        { id: 'a', name: '温今北', description: '温柔的哥哥。', avatar: 'data:image/png;base64,AAAA', history: [{ isMe: true, content: '今天拍戏好累。', timestamp: 1 }] },
        { id: 'b', name: '商桓', description: '毒舌法医。', avatar: 'data:image/png;base64,BBBB', history: [] },
        { id: 'g', name: '群', isGroupChat: true }
    ];
    const elements = new Map(['study-shell', 'study-content', 'study-tabbar', 'study-topbar-title', 'study-input', 'study-chat-list', 'study-quiz-input', 'study-check-progress-input', 'study-check-note', 'study-progress-value', 'study-card-note'].map(id => [id, element(id)]));
    const state = { calls: [], answer: turn('こんにちは。'), toasts: [], prompts: [], promptAnswer: '', confirmAnswer: true, spoken: [] };
    const inputs = [];
    const context = vm.createContext({
        console: { warn() {}, log() {}, error() {} },
        localStorage: storage,
        document: {
            getElementById: id => elements.get(id) || null,
            querySelectorAll: selector => selector.includes('[data-study-lang]') ? inputs : []
        },
        window: { myCharacters: chars },
        prompt: message => { state.prompts.push(message); return state.promptAnswer; },
        confirm: () => state.confirmAnswer,
        speechSynthesis: { cancel() {}, speak: utterance => state.spoken.push(utterance), getVoices: () => [{ lang: 'ja-JP' }] },
        SpeechSynthesisUtterance: class { constructor(text) { this.text = text; } },
        getWechatSortedChatCharacters: () => chars,
        getWechatCharDisplayName: char => char.chatConfig?.nickname || char.name,
        getWechatCharAvatarSource: char => char.avatar || '',
        getWechatCharacterPersonaText: char => `【角色描述】\n${char.description}`,
        buildWechatIdentityContextPrompt: () => '【身份】用户叫许宁',
        buildWechatMemoryPrompt: () => '【长期记忆】用户下个月去东京拍戏',
        buildWechatRecentHistoryForPrompt: char => (char.history || []).map(m => (m.isMe ? '许宁' : char.name) + ': ' + m.content).join('\n'),
        parseWechatJsonObject: text => { try { return JSON.parse(text); } catch (_) { return null; } },
        showWechatToast: text => state.toasts.push(text),
        callChatApi: async (messages, options) => { state.calls.push({ messages, options }); return typeof state.answer === 'function' ? state.answer(messages) : state.answer; },
        musicEscapeHtml: value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch])),
        musicEscapeAttr: value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]))
    });
    vm.runInContext(source, context);
    ['getStudyCards', 'saveStudyCards', 'getStudyLanguages', 'initStudyApp'].forEach(name => { context[name] = context.window[name]; });
    return { context, S: context.window.ByndStudy, storage, elements, chars, state, inputs, content: () => elements.get('study-content').innerHTML };
}

test('the study app boots with tabs, keeps legacy languages and cards, and exposes globals for the flip-card game', () => {
    const h = harness({ entries: { [KEYS.languages]: JSON.stringify([{ id: 'cn', label: '中文', short: '中' }, { id: 'ja', label: '日本語', short: '日' }]), [KEYS.cards]: JSON.stringify([{ id: 'old', cn: '你好', ja: 'こんにちは', note: '' }]) } });
    h.S.init();
    assert.equal(h.elements.get('study-shell').dataset.tab, 'chat');
    assert.match(h.elements.get('study-tabbar').innerHTML, /对话.*词本.*复习.*我/s);
    assert.match(h.elements.get('study-topbar-title').innerHTML, /温今北 · 日本語/);
    const settings = h.S.getSettings();
    assert.equal(settings.nativeId, 'cn');
    assert.deepEqual(plain(settings.targetIds), ['ja']);
    assert.equal(h.context.getStudyCards()[0].lines.ja, 'こんにちは', 'legacy cn/ja/th fields are lifted into lines');
    assert.deepEqual(plain(h.context.getStudyLanguages().map(lang => lang.id)), ['cn', 'ja']);
    assert.equal(h.S.language('ja').code, 'ja-JP', 'presets gain a speech code');
});

test('a turn sends persona first, study rules second, and stores reply, translation, correction and words from one request', async () => {
    const h = harness();
    h.S.init();
    h.state.answer = turn('お疲れ様。今日は何を撮った？', { correction: { original: '今日疲れるだ', better: '今日は疲れた', note: '形容词过去式不用だ。' }, words: [{ term: 'お疲れ様', reading: 'おつかれさま', meaning: '辛苦了' }] });
    h.elements.get('study-input').value = '今日疲れるだ';
    h.S.submit();
    await new Promise(resolve => setImmediate(resolve));
    while (h.state.calls.length && h.S.getChat('a').messages.length < 2) await new Promise(resolve => setImmediate(resolve));
    assert.equal(h.state.calls.length, 1, 'exactly one request per turn');
    const messages = h.state.calls[0].messages;
    assert.equal(messages[0].role, 'system');
    assert.match(messages[0].content, /^【角色描述】\n温柔的哥哥。/, 'persona comes first');
    assert.match(messages[0].content, /许宁/);
    assert.match(messages[0].content, /东京拍戏/);
    assert.match(messages[1].content, /你就是温今北本人，不是语言老师/);
    assert.match(messages[1].content, /母语是中文/);
    assert.match(messages[1].content, /正在学：日本語、ไทย/);
    assert.match(messages[1].content, /versions 里再给出同一段话的其它学习语言版本.*"th" 为 ไทย/);
    assert.match(messages[1].content, /【读音标注】.*日语汉字.*\{漢字\|かんじ\}/);
    assert.match(messages[1].content, /"versions":\{\}/);
    assert.equal(messages.at(-1).content, '今日疲れるだ');
    assert.equal(h.state.calls[0].options.skipLengthContinuation, true);
    const chat = h.S.getChat('a');
    assert.equal(chat.messages.length, 2);
    assert.equal(chat.messages[0].role, 'user');
    assert.equal(chat.messages[0].corrected, true);
    assert.equal(chat.messages[1].text, 'お疲れ様。今日は何を撮った？');
    assert.equal(chat.messages[1].translation, '翻译：お疲れ様。今日は何を撮った？');
    assert.equal(chat.messages[1].correction.better, '今日は疲れた');
    assert.equal(chat.messages[1].words[0].reading, 'おつかれさま');
    assert.match(h.content(), /纠正/);
    assert.match(h.content(), /今日は疲れた/);
    assert.match(h.content(), /翻译：お疲れ様/);
    assert.equal(h.state.spoken.length, 1, 'auto voice reads the reply');
    assert.equal(h.state.spoken[0].lang, 'ja-JP');
});

test('the opening turn is generated by the character without a user message and failures never fake a reply', async () => {
    const h = harness();
    h.S.init();
    h.state.answer = turn('やあ、許寧。今日は何を撮ったの？');
    await h.S.start();
    const chat = h.S.getChat('a');
    assert.equal(chat.messages.length, 1);
    assert.equal(chat.messages[0].role, 'char');
    assert.match(h.state.calls[0].messages.at(-1).content, /刚打开和你的语言练习对话/);
    h.state.answer = { ok: false, httpStatus: 429, rateLimited: true, retryAfterMs: 0, error: 'API 错误 (429): rate limit exceeded' };
    await h.S.send('こんにちは', 'chat');
    assert.equal(h.S.getChat('a').messages.length, 2, 'the user message is kept, no fake reply');
    assert.match(h.content(), /请求过于频繁/);
    h.state.answer = { ok: true, content: '好的，我来回答你：こんにちは！' };
    await h.S.send('また', 'chat');
    assert.match(h.content(), /不是要求的格式/);
    assert.equal(h.S.getChat('a').messages.filter(m => m.role === 'char').length, 1);
});

test('translation, sentence, word and correction saving flow into the word book with the right languages', async () => {
    const h = harness();
    h.S.init();
    h.state.answer = turn('（笑）大丈夫だよ。', { correction: { original: '大丈夫です？', better: '大丈夫？', note: '朋友之间不用です。' }, words: [{ term: '大丈夫', reading: 'だいじょうぶ', meaning: '没关系' }] });
    await h.S.send('大丈夫です？', 'chat');
    const reply = h.S.getChat('a').messages[1];
    h.S.toggleTranslation(reply.id);
    assert.doesNotMatch(h.content(), /翻译：（笑）/);
    h.S.toggleTranslation(reply.id);
    assert.match(h.content(), /翻译：（笑）/);
    h.S.saveSentence(reply.id);
    h.S.saveWord(reply.id, 0);
    h.S.saveCorrection(reply.id);
    const cards = h.context.getStudyCards();
    assert.equal(cards.length, 3 + 2, 'three saved plus two seeds');
    assert.equal(cards[2].lines.ja, '大丈夫だよ。', 'stage directions are stripped from saved sentences');
    assert.equal(cards[2].lines.cn, '翻译：（笑）大丈夫だよ。');
    assert.equal(cards[2].source, 'chat');
    assert.equal(cards[1].lines.ja, '大丈夫');
    assert.equal(cards[1].lines.cn, '没关系');
    assert.match(cards[1].note, /読音|读音：だいじょうぶ/);
    assert.equal(cards[0].lines.ja, '大丈夫？');
    assert.equal(cards[0].lines.cn, '改错：大丈夫です？', 'the prompt side of a correction card is the sentence to fix');
    assert.equal(cards[0].note, '朋友之间不用です。');
    assert.equal(cards[0].source, 'correction');
    const saved = h.S.getChat('a').messages[1];
    assert.ok(saved.savedCardId && saved.savedWords[0] && saved.savedCorrectionId);
    assert.deepEqual(h.state.toasts, ['已存入词本', '已收藏「大丈夫」', '已把纠正存入词本']);
    h.S.setTab('words');
    assert.match(h.content(), /词本 · 5/);
    h.S.searchWords('大丈夫？');
    assert.match(h.content(), /来自纠正/);
    assert.doesNotMatch(h.content(), /来自对话/);
});

test('switching partner keeps separate transcripts and clearing only removes that character', async () => {
    const h = harness();
    h.S.init();
    h.state.answer = turn('こんにちは');
    await h.S.send('やあ', 'chat');
    h.S.setTutor('b');
    assert.equal(h.S.tutor().id, 'b');
    assert.equal(h.S.getChat('b').messages.length, 0);
    h.state.answer = turn('Évidemment.');
    await h.S.send('salut', 'chat');
    assert.match(h.state.calls[1].messages[0].content, /毒舌法医/);
    assert.equal(h.S.getChat('a').messages.length, 2);
    h.S.clearChat();
    assert.equal(h.S.getChat('b').messages.length, 0);
    assert.equal(h.S.getChat('a').messages.length, 2);
    h.S.setTutor('g');
    assert.equal(h.S.tutor().id, 'b', 'group chats are never partners');
});

test('language settings enforce a native language, at least one target, custom languages and prompt wording', () => {
    const h = harness();
    h.S.init();
    h.S.setTab('me');
    h.S.toggleTarget('th');
    assert.deepEqual(plain(h.S.getSettings().targetIds), ['ja']);
    h.S.toggleTarget('ja');
    assert.deepEqual(plain(h.S.getSettings().targetIds), ['ja'], 'the last target cannot be removed');
    assert.match(h.content(), /至少保留一种/);
    h.S.setNative('ja');
    assert.equal(h.S.getSettings().nativeId, 'ja');
    assert.ok(h.S.getSettings().targetIds.length >= 1 && !h.S.getSettings().targetIds.includes('ja'));
    h.S.setNative('cn');
    h.state.promptAnswer = 'English';
    h.S.addLanguage();
    assert.ok(h.S.getSettings().targetIds.includes('en'), 'a preset name maps to the preset');
    h.state.promptAnswer = '粤语';
    h.S.addLanguage();
    const custom = h.S.allLanguages().find(lang => lang.label === '粤语');
    assert.ok(custom && h.S.getSettings().targetIds.includes(custom.id));
    h.S.setLevel('fluent');
    h.S.setStrictness('strict');
    h.S.setAutoTranslate(false);
    const rules = h.S.buildTurnMessages(h.S.tutor(), h.S.getSettings(), { messages: [] }, 'hi', 'chat')[1].content;
    assert.match(rules, /流利/);
    assert.match(rules, /严格/);
    assert.match(rules, /粤语/);
    h.S.removeLanguage(custom.id);
    assert.equal(h.S.allLanguages().some(lang => lang.id === custom.id), false);
    assert.equal(h.S.getSettings().targetIds.includes(custom.id), false);
    h.S.removeLanguage('cn');
    assert.ok(h.S.allLanguages().some(lang => lang.id === 'cn'), 'presets cannot be removed');
});

test('the quiz prefers weak and recent cards, grades in character with one request, and records stats', async () => {
    const h = harness();
    h.S.init();
    h.context.saveStudyCards([
        { id: 'weak', lines: { cn: '晚安', ja: 'おやすみ' }, stats: { asked: 3, correct: 0, lastAsked: Date.now() - 5 * 86400000 }, createdAt: Date.now() - 10 * 86400000 },
        { id: 'strong', lines: { cn: '早上好', ja: 'おはよう' }, stats: { asked: 3, correct: 3, lastAsked: Date.now() }, createdAt: Date.now() - 10 * 86400000 },
        { id: 'single', lines: { cn: '只有一行' }, createdAt: Date.now() }
    ]);
    h.S.setTab('review');
    h.S.startQuiz();
    assert.match(h.content(), /晚安/, 'the weak card is asked first');
    h.elements.get('study-quiz-input').value = 'おやすみなさい';
    h.state.answer = { ok: true, content: '{"correct":true,"feedback":"乖宝，记住了就早点睡。","better":"おやすみ"}' };
    await h.S.gradeQuiz();
    assert.equal(h.state.calls.length, 1);
    assert.match(h.state.calls[0].messages[1].content, /温今北本人/);
    assert.match(h.state.calls[0].messages[2].content, /我的答案：おやすみなさい/);
    assert.match(h.content(), /乖宝，记住了就早点睡/);
    h.S.markQuiz(true);
    const weak = h.context.getStudyCards().find(card => card.id === 'weak');
    assert.equal(weak.stats.asked, 4);
    assert.equal(weak.stats.correct, 1);
    h.S.startQuiz();
    h.S.revealQuiz();
    assert.match(h.content(), /参考/);
    h.S.markQuiz(false);
    assert.equal(h.context.getStudyCards().find(card => card.id === 'strong').stats.asked + h.context.getStudyCards().find(card => card.id === 'weak').stats.asked, 8);
});

test('check-ins persist mood, progress and notes and a failed card save reports instead of pretending', () => {
    const h = harness({ storageFailKey: KEYS.cards });
    h.S.init();
    h.S.setTab('review');
    h.S.setMood('focus');
    h.elements.get('study-check-progress-input').value = '65';
    h.elements.get('study-check-note').value = '背了十个词';
    h.S.saveCheckin();
    const checkins = JSON.parse(h.storage.getItem(KEYS.checkins));
    const today = Object.values(checkins)[0];
    assert.equal(today.mood, 'focus');
    assert.equal(today.progress, 65);
    assert.equal(today.note, '背了十个词');
    assert.match(h.content(), /今日已打卡/);
    h.S.setTab('words');
    h.S.editCard('');
    h.inputs.push({ dataset: { studyLang: 'ja' }, value: 'ありがとう' });
    h.S.saveCardForm();
    assert.match(h.content(), /没有保存：QuotaExceededError/);
    assert.equal(h.context.getStudyCards().length, 0, 'nothing was written');
});

test('the word book editor creates and updates cards and deletion asks first', () => {
    const h = harness();
    h.S.init();
    h.S.setTab('words');
    h.S.editCard('');
    h.inputs.push({ dataset: { studyLang: 'ja' }, value: 'ありがとう' }, { dataset: { studyLang: 'cn' }, value: '谢谢' });
    h.elements.get('study-card-note').value = '随口就能说';
    h.S.saveCardForm();
    let cards = h.context.getStudyCards();
    assert.equal(cards[0].lines.ja, 'ありがとう');
    assert.equal(cards[0].note, '随口就能说');
    assert.equal(cards[0].source, 'manual');
    h.S.editCard(cards[0].id);
    h.inputs.length = 0;
    h.inputs.push({ dataset: { studyLang: 'ja' }, value: 'ありがとうございます' });
    h.S.saveCardForm();
    cards = h.context.getStudyCards();
    assert.equal(cards[0].lines.ja, 'ありがとうございます');
    assert.equal(cards.length, 3);
    h.state.confirmAnswer = false;
    h.S.deleteCard(cards[0].id);
    assert.equal(h.context.getStudyCards().length, 3);
    h.state.confirmAnswer = true;
    h.S.deleteCard(cards[0].id);
    assert.equal(h.context.getStudyCards().length, 2);
});

test('without any character the chat explains what to do and never calls the API', async () => {
    const h = harness({ characters: [] });
    h.S.init();
    assert.match(h.content(), /还没有角色/);
    assert.equal(await h.S.send('hi', 'chat'), false);
    assert.equal(h.state.calls.length, 0);
});

test('readings render as ruby, every selected language appears, and storage and speech drop the markup', async () => {
    const h = harness();
    h.S.init();
    assert.equal(h.S.rubyHtml('{今日|きょう}は{疲|つか}れた。<b>'), '<ruby>今日<rt>きょう</rt></ruby>は<ruby>疲<rt>つか</rt></ruby>れた。&lt;b&gt;');
    assert.equal(h.S.plainText('{今日|きょう}は{疲|つか}れた。'), '今日は疲れた。');
    assert.equal(h.S.rubyHtml('普通の文 {未闭合'), '普通の文 {未闭合', 'unbalanced braces stay literal');
    h.state.answer = turn('{乖宝|guāi bǎo}、{泣|な}かないで。', { versions: { th: 'อย่าร้องไห้นะ', zz: 'ignored' }, words: [{ term: '{泣|な}く', reading: 'なく', meaning: '哭' }], correction: { original: '泣かないだ', better: '{泣|な}かないで', note: '否定的て形。' } });
    await h.S.send('泣かないだ', 'chat');
    const reply = h.S.getChat('a').messages[1];
    assert.deepEqual(plain(reply.versions), { th: 'อย่าร้องไห้นะ' }, 'only selected extra languages are kept');
    const html = h.content();
    assert.match(html, /<ruby>泣<rt>な<\/rt><\/ruby>かないで。/);
    assert.match(html, /study-version"><b>泰<\/b><p>อย่าร้องไห้นะ<\/p>/);
    assert.match(html, /is-better"><ruby>泣<rt>な<\/rt><\/ruby>かないで/);
    assert.match(html, /<b><ruby>泣<rt>な<\/rt><\/ruby>く<\/b><i>なく<\/i>/);
    assert.equal(h.state.spoken[0].text, '乖宝、泣かないで。');
    h.S.saveSentence(reply.id);
    h.S.saveWord(reply.id, 0);
    h.S.saveCorrection(reply.id);
    const cards = h.context.getStudyCards();
    assert.equal(cards[2].lines.ja, '乖宝、泣かないで。');
    assert.equal(cards[2].lines.th, 'อย่าร้องไห้นะ', 'the Thai version is saved on the same card');
    assert.equal(cards[1].lines.ja, '泣く');
    assert.equal(cards[0].lines.ja, '泣かないで');
    assert.equal(cards[0].lines.cn, '改错：泣かないだ');
    const replay = h.S.buildTurnMessages(h.S.tutor(), h.S.getSettings(), h.S.getChat('a'), 'next', 'chat');
    assert.match(replay.at(-2).content, /"versions":\{"th":"อย่าร้องไห้นะ"\}/, 'history replay keeps the extra languages');
    h.S.toggleTarget('th');
    const rules = h.S.buildTurnMessages(h.S.tutor(), h.S.getSettings(), { messages: [] }, 'hi', 'chat')[1].content;
    assert.match(rules, /versions 留空对象/);
    assert.doesNotMatch(rules, /缺一不可/);
});
