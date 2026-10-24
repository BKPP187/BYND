const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { root, memoryStorage, deferred } = require('./helpers/harness.cjs');

const source = fs.readFileSync(path.join(root, 'apps/study/study-app.js'), 'utf8');
const KEYS = { cards: 'bynd_study_cards_v1', books: 'bynd_study_books_v1', languages: 'bynd_study_languages_v1', settings: 'bynd_study_settings_v1', chats: 'bynd_study_chats_v1', checkins: 'bynd_study_checkins_v1' };
const plain = value => JSON.parse(JSON.stringify(value));
const turn = (reply, extra = {}) => ({ ok: true, content: JSON.stringify({ reply, versions: {}, translation: '翻译：' + reply, correction: null, words: [], ...extra }) });

test('all selected languages drive the heading, composer and request; missing versions are visible', async () => {
    const h = harness();
    h.S.saveSettings({targetIds:['ja','th']});
    h.S.init();
    assert.match(h.elements.get('study-topbar-title').innerHTML, /日本語、ไทย/);
    assert.match(h.content(), /用 日本語、ไทย/);
    h.state.answer = turn('こんにちは', {versions:{th:'สวัสดี'}});
    await h.S.start();
    assert.match(h.state.calls[0].messages.map(m=>m.content).join('\n'), /"th" 为 ไทย/);
    assert.match(h.content(), /สวัสดี/);
    h.state.answer = turn('こんにちは');
    await h.S.send('继续');
    assert.match(h.content(), /缺少ไทย版本/);
    h.S.toggleTarget('ja');
    assert.match(h.elements.get('study-topbar-title').innerHTML, /温今北 · ไทย/);
    assert.doesNotMatch(h.elements.get('study-topbar-title').innerHTML, /日本語/);
});

function element(id) {
    const classes = new Set();
    const el = {
        id, innerHTML: '', textContent: '', value: '', dataset: {}, scrollTop: 0, scrollHeight: 0,
        classList: { add: n => classes.add(n), remove: n => classes.delete(n), contains: n => classes.has(n), toggle: (n, f) => { f ? classes.add(n) : classes.delete(n); } },
        querySelector: () => null, querySelectorAll: () => [], focus() {}, setSelectionRange() {}
    };
    return el;
}

function harness({ characters, entries = {}, storageFailKey = '', readings = false, classroom = false } = {}) {
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
        localStorage: storage, AbortController,
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
    vm.runInContext(fs.readFileSync(path.join(root,'apps/study/study-language-guides.js'),'utf8'),context);
    if(readings) for(const file of ['assets/vendor/study-thai/readings.js','apps/study/study-reading.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context);
    if(classroom) for(const file of ['apps/study/study-thai-rules.js','apps/study/study-thai-classroom.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context);
    vm.runInContext(source, context);
    ['getStudyCards', 'saveStudyCards', 'getStudyLanguages', 'initStudyApp'].forEach(name => { context[name] = context.window[name]; });
    return { context, S: context.window.ByndStudy, storage, elements, chars, state, inputs, content: () => elements.get('study-content').innerHTML };
}

test('Thai classroom integrates books, cards and the existing guide without changing other languages',()=>{
 const h=harness({readings:true,classroom:true,entries:{[KEYS.cards]:JSON.stringify([{id:'miss',lines:{th:'คิดถึง',ja:'会いたい',cn:'想念'}}])}});h.S.init();h.S.openBook('collection');
 assert.match(h.content(),/ByndStudy.toggleThaiWord/);assert.match(h.content(),/逐字课堂/);assert.match(h.content(),/低辅音.*短元音.*第 4 调/);
 h.S.setLearningView('thai');assert.match(h.content(),/study-thai-word-input/);assert.match(h.content(),/自己判断拼读/);
 h.S.setFoundationLang('ja');h.S.setLearningView('guide');assert.doesNotMatch(h.content(),/data-thai-classroom/);assert.match(h.content(),/あ/);
 h.S.setFoundationLang('th');h.S.setLearningView('cards');assert.match(h.content(),/study-thai-term/);assert.match(h.content(),/详细课堂模式/);
 h.S.saveSettings({targetIds:['th']});let prompt=h.S.buildTurnMessages(h.chars[0],h.S.getSettings(),{messages:[]},'解释拼读').map(x=>x.content).join('\n');assert.match(prompt,/起始辅音名称.*活死音节/);assert.match(prompt,/模型输出不作为规则引擎/);
 h.S.saveSettings({targetIds:['ja']});prompt=h.S.buildTurnMessages(h.chars[0],h.S.getSettings(),{messages:[]},'こんにちは').map(x=>x.content).join('\n');assert.doesNotMatch(prompt,/【泰语课堂】/);
});
test('Thai lesson audio preserves Thai originals and supplies a slower native rate, with explicit missing-voice failure',()=>{
 const h=harness(),calls=[];h.S.init();h.context.window.ByndAndroid={stopTts(){},speakText:(text,code,rate)=>{calls.push({text,code,rate});return{status:'queued'};}};
 assert.equal(h.S.speakThaiLesson('คิดถึง'),true);assert.equal(h.S.speakThaiLesson('คิด',true),true);assert.deepEqual(calls,[{text:'คิดถึง',code:'th-TH',rate:.92},{text:'คิด',code:'th-TH',rate:.65}]);
 h.context.window.ByndAndroid.speakText=()=>({status:'missing-data'});assert.equal(h.S.speakThaiLesson('คิดถึง'),false);assert.match(h.content(),/还没有安装.*语音/);
 delete h.context.window.ByndAndroid;h.context.speechSynthesis.getVoices=()=>[];assert.equal(h.S.speakThaiLesson('คิดถึง'),false);assert.match(h.content(),/没有.*系统语音/);assert.equal(h.state.spoken.length,0,'empty voice enumeration must not fall back to another language in a Thai lesson');
});

async function importPreview(h, fileName = '泰语资料.doc') {
    h.S.init(); h.S.openPdfImport(); h.S.setPdfOption('targetId', 'th');
    h.context.window.ByndStudyPdf = { read: async () => ({
        words: [{ term: 'สวัสดี', meaning: '你好', reading: 'sa wat di', note: '', page: 1 }, { term: 'สวัสดี', meaning: '你好', page: 1 }, { term: 'ขอบคุณ', meaning: '谢谢', page: 2 }],
        pages: 3, from: 1, to: 3, blankPages: []
    }) };
    h.S.selectPdfFile({ files: [{ name: fileName, size: 100 }] });
    assert.equal(await h.S.readPdfImport(), true);
}

function proofreadingHarness(options={}) {
 const cards=[{id:'ocr',bookId:'collection',lines:{th:'โรคติตต่ออันตราย',cn:'危险传染病'},source:'pdf',sourceFile:'资料.pdf',sourcePage:1,stats:{asked:3,correct:2},reading:{th:{known:true}},note:'原笔记'},
 {id:'ambiguous',lines:{th:'เชือ',cn:'病毒'},source:'pdf'}, {id:'other',bookId:'other',lines:{th:'ขอบคุณ',cn:'谢谢'}}];
 const h=harness({readings:true,entries:{[KEYS.cards]:JSON.stringify(cards)},...options});h.S.init();h.S.openBook('collection');return h;
}
test('missing Thai readings show candidate-specific sounds inline and can apply one correction without a manual form',()=>{
 const h=proofreadingHarness(),before=h.storage.getItem(KEYS.cards);
 assert.match(h.content(),/study-thai-candidate-reading/);assert.match(h.content(),/采用此词并补齐读音/);
 assert.equal(h.storage.getItem(KEYS.cards),before,'showing candidates never changes saved words');
 assert.equal(h.S.applyThaiSuggestion('ocr','stale original','โรคติดต่ออันตราย'),false);
 assert.equal(h.storage.getItem(KEYS.cards),before);
 assert.equal(h.S.applyThaiSuggestion('ocr','โรคติตต่ออันตราย','โรคติดต่ออันตราย'),true);
 const card=h.context.getStudyCards().find(c=>c.id==='ocr');assert.equal(card.lines.th,'โรคติดต่ออันตราย');assert.equal(card.stats.correct,2);assert.equal(card.note,'原笔记');
 assert.match(h.content(),/rôok dtìt dtɔ̀ɔ/);
});
test('inline correction cannot silently change an ambiguous word or report success after a failed save',()=>{
 const h=proofreadingHarness(),before=h.storage.getItem(KEYS.cards);
 assert.equal(h.S.applyThaiSuggestion('ambiguous','เชือ','not a candidate'),false);assert.equal(h.storage.getItem(KEYS.cards),before);
 const set=h.storage.setItem.bind(h.storage);h.storage.setItem=(key,value)=>{if(key===KEYS.cards)throw new Error('QuotaExceededError');set(key,value);};
 assert.equal(h.S.applyThaiSuggestion('ocr','โรคติตต่ออันตราย','โรคติดต่ออันตราย'),false);
 assert.equal(h.storage.getItem(KEYS.cards),before);assert.match(h.content(),/校对没有保存/);
});
test('missing reading resources are reported as a loading problem instead of missing dictionary entries',()=>{
 const h=proofreadingHarness();delete h.context.window.ByndThaiLexicon;h.S.render();
 assert.match(h.content(),/读音资源未就绪/);assert.doesNotMatch(h.content(),/本词拼读待补充/);
 assert.equal(h.S.openThaiProofreading(),false);assert.match(h.content(),/请刷新重试/);
});
test('book proofreading previews OCR alternatives and saves only explicitly chosen corrections',()=>{
 const h=proofreadingHarness(),before=h.storage.getItem(KEYS.cards);
 h.S.openThaiProofreading();assert.equal(h.storage.getItem(KEYS.cards),before);
 assert.match(h.content(),/โรคติดต่ออันตราย/);assert.match(h.content(),/词库候选/);
 assert.equal(h.S.saveThaiProofreading(),false,'no default replacement for ambiguous or single suggestions');
 h.S.setThaiProofreading(0,0);assert.equal(h.S.saveThaiProofreading(),true);
 const cards=h.context.getStudyCards(),saved=cards.find(c=>c.id==='ocr');
 assert.equal(saved.lines.th,'โรคติดต่ออันตราย');assert.equal(saved.th,saved.lines.th);
 assert.equal(saved.note,'原笔记');assert.equal(saved.stats.correct,2);assert.equal(saved.reading.th.known,true);
 assert.equal(saved.sourcePage,1);assert.equal(saved.textCorrections[0].from,'โรคติตต่ออันตราย');
 assert.equal(cards.find(c=>c.id==='ambiguous').lines.th,'เชือ');assert.equal(cards.length,3);
 assert.match(h.content(),/已校对 1 条/);
});
test('proofreading save is atomic on storage failure, stale words, or corrupt data',()=>{
 for(const mode of ['quota','stale','corrupt']){
  const h=proofreadingHarness();h.S.openThaiProofreading();h.S.setThaiProofreading(0,0);
  if(mode==='quota'){const set=h.storage.setItem.bind(h.storage);h.storage.setItem=(key,value)=>{if(key===KEYS.cards)throw new Error('QuotaExceededError');set(key,value);};}
  if(mode==='stale'){const cards=JSON.parse(h.storage.getItem(KEYS.cards));cards[0].lines.th='用户新改的词';h.storage.setItem(KEYS.cards,JSON.stringify(cards));}
  if(mode==='corrupt')h.storage.setItem(KEYS.cards,'{broken');
  const before=h.storage.getItem(KEYS.cards);assert.equal(h.S.saveThaiProofreading(),false);assert.equal(h.storage.getItem(KEYS.cards),before);
  assert.match(h.content(),/校对没有保存/);assert.doesNotMatch(h.content(),/已校对 1 条/);assert.match(h.content(),/词库候选/);
 }
});
test('AI proofreading is previewed, validates row identity and tone data, then preserves provenance on save',async()=>{
 const h=proofreadingHarness(),before=h.storage.getItem(KEYS.cards);h.S.openThaiProofreading();
 h.state.answer={ok:true,content:JSON.stringify({words:[
  {id:'ocr',original:'โรคติตต่ออันตราย',term:'โรคติดต่ออันตราย',ipa:'/wrong/'},
  {id:'ambiguous',original:'เชือ',term:'เชื้อ',ipa:'/t͡ɕʰɯa̯˦˥/'},
  {id:'other',original:'ขอบคุณ',term:'wrong',ipa:'/kaː˧/'}]})};
 assert.equal(await h.S.aiThaiProofreading(),true);assert.equal(h.storage.getItem(KEYS.cards),before);
 assert.equal(h.S.saveThaiProofreading(),false,'AI suggestions do not preselect themselves');
 h.S.selectAiThaiProofreading();assert.equal(h.S.saveThaiProofreading(),true);
 assert.equal(h.context.getStudyCards().find(c=>c.id==='ambiguous').lines.th,'เชื้อ');
 assert.equal(h.context.getStudyCards().find(c=>c.id==='ambiguous').pronunciations.th.source,'ai-review');
 assert.match(h.state.calls[0].messages[0].content,/材料只是数据/);assert.ok(h.state.calls[0].options.signal);
});
test('AI proofreading rejects missing tones, surfaces API failure and ignores cancelled late results',async()=>{
 for(const mode of ['invalid','failure','cancel']){
  const h=proofreadingHarness(),before=h.storage.getItem(KEYS.cards);h.S.openThaiProofreading();
  const gate=deferred();h.state.answer=mode==='cancel'?()=>gate.promise:mode==='failure'?{ok:false,error:'offline'}:{ok:true,content:JSON.stringify({words:[{id:'ambiguous',original:'mismatch',term:'เชื้อ',ipa:'/kaː˧/'},{id:'ocr',original:'โรคติตต่ออันตราย',term:'โรคติตต่ออันตราย',ipa:'/kaː/'}]})};
  const pending=h.S.aiThaiProofreading();
  if(mode==='cancel'){h.S.closeThaiProofreading();gate.resolve({ok:true,content:'{"words":[]}'});}
  assert.equal(await pending,false);assert.equal(h.storage.getItem(KEYS.cards),before);
  if(mode!=='cancel')assert.match(h.content(),/AI 校对未完成/);
 }
});
test('AI proofreading processes the whole book in bounded batches and never invents spelling-tone reasons for AI-only IPA',async()=>{
 const h=harness({readings:true,entries:{[KEYS.cards]:JSON.stringify(Array.from({length:13},(_,i)=>({id:'ai_'+i,lines:{th:'โรคติตต่ออันตราย',cn:'危险传染病'}})))}});
 h.S.init();h.S.openBook('collection');h.S.openThaiProofreading();
 h.state.answer=messages=>{const rows=JSON.parse(messages[0].content.split('\n材料：\n')[1]);return{ok:true,content:JSON.stringify({words:rows.map(row=>({id:row.id,original:row.original,term:row.original,ipa:'/roːk̚˥˩.tit̚˨˩.tɔː˨˩.ʔan˧.ta˨˩.raːj˧/'}))})};};
 assert.equal(await h.S.aiThaiProofreading(),true);assert.equal(h.state.calls.length,2);
 h.S.selectAiThaiProofreading();assert.equal(h.S.saveThaiProofreading(),true);
 assert.equal(h.context.getStudyCards()[0].pronunciations.th.ipa,'/roːk̚˥˩.tit̚˨˩.tɔː˨˩.ʔan˧.ta˨˩.raːj˧/');
 assert.match(h.content(),/AI 参考音/);assert.doesNotMatch(h.content(),/study-thai-tone-reason/,'AI IPA never fabricates a rationale for an unverified spelling');
});
test('document import previews and edits before an atomic deduplicated save', async () => {
    const h = harness();
    await importPreview(h);
    assert.equal(h.context.getStudyCards().length, 2, 'preview does not save');
    h.S.editPdfWord(2, 'meaning', '谢谢你');
    assert.equal(h.S.savePdfImport(), true);
    const added = h.context.getStudyCards().filter(card => card.source === 'word');
    assert.equal(added.length, 2);
    assert.equal(added[1].lines.th, 'ขอบคุณ');
    assert.equal(added[1].lines.cn, '谢谢你');
    assert.equal(added[1].sourceFile, '泰语资料.doc');
    assert.equal(added[0].pronunciations.th.text, 'sa wat di');
    assert.equal(added[0].note, '', 'AI reading has its own field instead of creating another remark');
    assert.match(h.content(), /跳过 1 条重复/);
    await importPreview(h);
    assert.equal(h.S.savePdfImport(), false, 'reimport does not duplicate saved words');
    assert.equal(h.context.getStudyCards().length, 4);
});
test('editing an import preview term discards its old generated reading',async()=>{
    const h=harness();await importPreview(h);h.S.editPdfWord(0,'term','สวัสดีค่ะ');assert.equal(h.S.savePdfImport(),true);
    const card=h.context.getStudyCards().find(card=>card.lines.th==='สวัสดีค่ะ');assert.equal(card.pronunciations.th,undefined);
});
test('failed document save retains every preview row for retry and never reports successful import', async () => {
    const h = harness({ storageFailKey: KEYS.cards });
    await importPreview(h, 'words.pdf');
    assert.equal(h.S.savePdfImport(), false);
    assert.equal(h.context.getStudyCards().length, 0);
    assert.match(h.content(), /导入没有保存.*QuotaExceededError/);
    assert.match(h.content(), /导入所选 3 条/);
    assert.doesNotMatch(h.content(), /已导入 \d/);
});
test('document import never overwrites an unreadable or corrupt existing word book', async () => {
    const h = harness();
    await importPreview(h);
    h.storage.setItem(KEYS.cards, '{broken');
    assert.equal(h.S.savePdfImport(), false);
    assert.equal(h.storage.getItem(KEYS.cards), '{broken');
    assert.match(h.content(), /无法读取原词本/);
    assert.match(h.content(), /导入所选 3 条/);
});
test('closing a running document import prevents late results from reopening the preview', async () => {
    const h = harness(), gate = deferred();
    h.S.init(); h.S.openPdfImport();
    h.context.window.ByndStudyPdf = { read: () => gate.promise };
    h.S.selectPdfFile({ files: [{ name: 'words.pdf', size: 100 }] });
    const pending = h.S.readPdfImport();
    h.S.closePdfImport();
    gate.resolve({ words: [{ term: 'stale', meaning: '', page: 1 }], pages: 1, from: 1, to: 1, blankPages: [] });
    assert.equal(await pending, false);
    assert.doesNotMatch(h.content(), /data-import-term/);
});
test('empty selected words block saving and deselected rows are omitted', async () => {
    const h = harness();
    await importPreview(h);
    h.S.editPdfWord(0, 'term', '');
    assert.equal(h.S.savePdfImport(), false);
    assert.match(h.content(), /词条不能为空/);
    h.S.editPdfWord(0, 'selected', false);
    h.S.editPdfWord(1, 'selected', false);
    assert.equal(h.S.savePdfImport(), true);
    assert.equal(h.context.getStudyCards().filter(card => card.source === 'word').length, 1);
});
test('existing imported cards become separate notebooks without changing durable words or progress',()=>{
    const original=JSON.stringify([
        {id:'a',source:'pdf',sourceFile:'基础泰语.pdf',lines:{th:'ก',cn:'甲'},stats:{asked:3,correct:2},sourcePage:2},
        {id:'b',source:'pdf',sourceFile:'基础泰语.pdf',lines:{th:'ข',cn:'乙'},sourcePage:1},
        {id:'c',source:'word',sourceFile:'会话.doc',lines:{th:'สวัสดี',cn:'你好'}},
        {id:'d',source:'chat',lines:{ja:'こんにちは',cn:'你好'}}
    ]);
    const h=harness({entries:{[KEYS.cards]:original}}),books=h.S.getStudyBooks();
    assert.equal(books.length,3);
    const thai=books.find(book=>book.title==='基础泰语');
    assert.equal(thai.count,2);assert.equal(thai.cards[0].id,'b');
    assert.equal(thai.cards[1].stats.asked,3);
    assert.equal(h.storage.getItem(KEYS.cards),original,'grouping is a read-only migration');
    assert.equal(h.storage.getItem(KEYS.books),null);
    h.S.setTab('words');assert.match(h.content(),/study-books-grid/);assert.doesNotMatch(h.content(),/data-book-card/);
});
test('identical words in different source books are preserved while same-book reimports are deduplicated',async()=>{
    const h=harness();
    await importPreview(h,'入门.pdf');assert.equal(h.S.savePdfImport(),true);
    await importPreview(h,'会话.doc');assert.equal(h.S.savePdfImport(),true);
    const imported=h.context.getStudyCards().filter(card=>card.sourceFile);
    assert.equal(imported.length,4);
    assert.equal(new Set(imported.map(card=>card.bookId)).size,2);
    await importPreview(h,'入门.pdf');assert.equal(h.S.savePdfImport(),false);
    assert.equal(h.context.getStudyCards().filter(card=>card.sourceFile).length,4);
});
test('empty notebooks, custom covers and renamed titles persist independently of card progress',()=>{
    const h=harness();h.S.init();h.S.editNotebook();h.S.updateNotebookDraft('title','日语·第一册');h.S.updateNotebookDraft('tone','sage');
    const id=h.S.saveNotebook();assert.ok(id);
    const book=h.S.getStudyBooks().find(book=>book.id===id);
    assert.equal(book.count,0);assert.equal(book.tone,'sage');
    assert.match(h.content(),/从第一页开始/);
    h.S.editNotebook(id);h.S.updateNotebookDraft('title','我的日语');assert.equal(h.S.saveNotebook(),id);
    const reopened=harness({entries:Object.fromEntries([KEYS.cards,KEYS.books].map(key=>[key,h.storage.getItem(key)]))});
    assert.equal(reopened.S.getStudyBooks().find(book=>book.id===id).title,'我的日语');
});
test('failed notebook creation and rename leave saved metadata untouched',()=>{
    const original=JSON.stringify([{id:'one',title:'原词本',tone:'sand'}]);
    const h=harness({entries:{[KEYS.books]:original},storageFailKey:KEYS.books});
    h.S.editNotebook('one');h.S.updateNotebookDraft('title','没有保存的新名字');
    assert.equal(h.S.saveNotebook(),false);
    assert.equal(h.storage.getItem(KEYS.books),original);assert.match(h.content(),/词本没有保存/);
});
test('a notebook displays eight entries per page and its practice uses only its own cards',()=>{
    const cards=Array.from({length:19},(_,i)=>({id:'page_'+i,sourceFile:'泰语.pdf',lines:{th:'คำ'+i,cn:'词'+i},sourcePage:i+1}));
    cards.push({id:'other',sourceFile:'另一本.pdf',lines:{th:'ไม่เกี่ยว',cn:'另一本'}});
    const h=harness({entries:{[KEYS.cards]:JSON.stringify(cards)}});
    h.S.init();h.S.openBook(h.S.fileBookId('泰语.pdf'));
    assert.equal((h.content().match(/data-book-card=/g)||[]).length,8);
    assert.doesNotMatch(h.content(),/ไม่เกี่ยว/);
    h.S.turnBookPage(1);assert.match(h.content(),/第 2 \/ 3 页/);
    h.S.turnBookPage(1);assert.equal((h.content().match(/data-book-card=/g)||[]).length,3);
    h.S.setLearningView('cards');assert.equal(h.S.drillCards().length,19);
});
test('import can append to a selected empty notebook and failed card saves never create a ghost book',async()=>{
    const h=harness();h.S.init();h.S.editNotebook();h.S.updateNotebookDraft('title','综合词本');const id=h.S.saveNotebook();
    await importPreview(h,'第1课.doc');h.S.setImportBook(id);assert.equal(h.S.savePdfImport(),true);
    assert.equal(h.S.getStudyBooks().find(book=>book.id===id).count,2);
    const failed=harness({storageFailKey:KEYS.cards});await importPreview(failed,'失败.pdf');
    assert.equal(failed.S.savePdfImport(),false);assert.equal(failed.S.getStudyBooks().length,0);
});

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

test('study voice prefers the selected character binding and falls back to system speech only there', async () => {
    const h = harness({ characters: [{
        id: 'a', name: '温今北', description: '温柔的哥哥。', avatar: '', history: [],
        chatConfig: { voiceBinding: { provider: 'openai', voiceModel: 'gpt-4o-mini-tts', voiceId: 'coral' } }
    }] });
    const paidCalls = [];
    const played = [];
    h.context.getCharacterVoiceBinding = char => char.chatConfig.voiceBinding;
    h.context.requestCharacterVoiceAudio = async (text, char) => {
        paidCalls.push({ text, char });
        return { audioUrl: 'data:audio/mp3;base64,QQ==', duration: 1 };
    };
    h.context.Audio = class {
        constructor(url) { this.url = url; }
        async play() { played.push(this.url); }
        pause() {}
    };
    assert.equal(await h.S.speak('สวัสดี', 'th-TH'), true);
    assert.equal(paidCalls.length, 1);
    assert.deepEqual(played, ['data:audio/mp3;base64,QQ==']);
    assert.equal(h.state.spoken.length, 0, 'paid character voice must win over system speech');

    h.context.requestCharacterVoiceAudio = async () => { throw new Error('provider offline'); };
    assert.equal(await h.S.speak('こんにちは', 'ja-JP'), true);
    assert.equal(h.state.spoken.length, 1, 'study alone may fall back to the system voice');
});

test('study uses the Android native language bridge when it is available', async () => {
    const h = harness();
    const nativeCalls = [];
    h.context.window.ByndAndroid = {
        stopTts() {},
        speakText(text, languageCode, rate) {
            nativeCalls.push({ text, languageCode, rate });
            return JSON.stringify({ status: 'queued' });
        }
    };
    assert.equal(await h.S.speak('วันนี้เรียนแค่สิบนาทีก็พอ', 'th-TH'), true);
    assert.equal(nativeCalls.length, 1);
    assert.equal(nativeCalls[0].languageCode, 'th-TH');
    assert.equal(h.state.spoken.length, 0);
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
    assert.match(h.content(), /1 本 · 5 条词句/);
    h.S.openBook('collection');
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

test('the word book editor creates and updates cards and deletion can be undone without losing later cards', () => {
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
    let action;
    h.context.window.ByndUndo = { offer: value => { action = value; } };
    h.S.deleteCard(cards[0].id);
    assert.equal(h.context.getStudyCards().length, 2);
    const later = { id: 'later', lines: { ja: 'またね' }, note: '', createdAt: Date.now() };
    h.context.saveStudyCards([...h.context.getStudyCards(), later]);
    assert.equal(action.undo(), true);
    assert.equal(h.context.getStudyCards().length, 4);
    assert.ok(h.context.getStudyCards().some(item => item.id === later.id));
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

test('learning cards use saved vocabulary, persist reading marks, and undo the last mark', () => {
    const h = harness();
    h.S.init();
    h.S.setTab('words');
    h.S.setLearningView('cards');
    assert.match(h.content(), /学习卡片/);
    assert.match(h.content(), /少しずつ安定した自分になりたい/);
    const card = h.S.drillCards()[0];
    h.S.markRead(false);
    assert.equal(h.context.getStudyCards().find(item => item.id === card.id).reading.ja.needsReview, true);
    h.S.undoRead();
    assert.equal(h.context.getStudyCards().find(item => item.id === card.id).reading?.ja, undefined);
});

test('unlearned cards replay in place, learned cards advance, and undo returns to the marked card', async () => {
    const h = harness(); h.S.init(); h.S.setTab('words'); h.S.setLearningView('cards');
    const first = h.S.drillCards()[0];
    await h.S.markRead(false);
    assert.match(h.content(), /日本語 · 1 \/ /);
    assert.equal(h.state.spoken.at(-1).text, first.lines.ja);
    h.S.undoRead(); assert.match(h.content(), /日本語 · 1 \/ /);
    await h.S.markRead(true); assert.match(h.content(), /日本語 · 2 \/ /);
    h.S.undoRead(); assert.match(h.content(), /日本語 · 1 \/ /);
});

test('each multilingual line has a speaker bound to exactly its own text and locale', async () => {
    const h = harness({ entries: { [KEYS.cards]: JSON.stringify([{id:'multi',lines:{ja:'こんにちは',th:'สวัสดีค่ะ',cn:'你好'},note:'扫描识别，请核对文字'}]) } });
    h.S.init(); h.S.setTab('words'); h.S.openBook('collection');
    assert.doesNotMatch(h.content(), /扫描识别，请核对文字|<summary>备注/);
    for(const id of ['ja','th','cn']) assert.match(h.content(), new RegExp(`speakCardLine\\('multi','${id}'\\)`));
    const calls=[]; h.context.window.ByndAndroid={speakText:(text,code)=>{calls.push({text,code});return {status:'queued'};}};
    for(const id of ['ja','th','cn']) assert.equal(await h.S.speakCardLine('multi',id),true);
    assert.deepEqual(calls,[{text:'こんにちは',code:'ja-JP'},{text:'สวัสดีค่ะ',code:'th-TH'},{text:'你好',code:'zh-CN'}]);
    assert.equal(await h.S.speakCardLine('multi','en'),false);
});

test('deleting notebooks removes only their cards and metadata, and cancellation keeps everything', () => {
    const entries={ [KEYS.cards]:JSON.stringify([{id:'a',bookId:'one',lines:{th:'สวัสดี'}},{id:'b',bookId:'two',lines:{ja:'こんにちは'}}]),[KEYS.books]:JSON.stringify([{id:'one',title:'一'},{id:'two',title:'二'},{id:'empty',title:'空本'}]) };
    const h=harness({entries}); h.S.init(); h.S.setTab('words');h.S.openBook('one');
    h.state.confirmAnswer=false;assert.equal(h.S.deleteNotebook('one'),false);assert.equal(h.context.getStudyCards().length,2);
    h.state.confirmAnswer=true;assert.equal(h.S.deleteNotebook('one'),true);
    assert.deepEqual(plain(h.context.getStudyCards().map(card=>card.id)),['b']);
    assert.equal(h.S.getStudyBooks().some(book=>book.id==='one'),false);
    assert.equal(h.S.deleteNotebook('empty'),true);
    assert.deepEqual(plain(h.S.getStudyBooks().map(book=>book.id)),['two']);
});

test('failed notebook deletion preserves both the original metadata and all words', () => {
    for(const key of [KEYS.cards,KEYS.books,'bynd_study_book_delete_v1']){
        const entries={ [KEYS.cards]:JSON.stringify([{id:'a',bookId:'one',lines:{th:'สวัสดี'}}]),[KEYS.books]:JSON.stringify([{id:'one',title:'一',tone:'rose'}]) };
        const h=harness({entries,storageFailKey:key});h.S.init();h.S.setTab('words');h.S.openBook('one');
        assert.equal(h.S.deleteNotebook('one'),false);assert.equal(h.context.getStudyCards().length,1);
        assert.equal(h.S.getStudyBooks()[0].title,'一');assert.match(h.content(),/词本没有删除/);
    }
});

test('deleting the last notebook never resurrects example cards on reopening',()=>{
    const h=harness({entries:{[KEYS.cards]:JSON.stringify([{id:'a',lines:{ja:'こんにちは'}}])}});h.S.init();h.S.deleteNotebook('collection');h.S.init();
    assert.equal(h.context.getStudyCards().length,0);assert.equal(h.S.getStudyBooks().length,0);
});

test('interrupted notebook deletion reads the original snapshot and recovers before another write',()=>{
    const cards=JSON.stringify([{id:'a',bookId:'one',lines:{th:'สวัสดี'}}]),books=JSON.stringify([{id:'one',title:'原词本'}]);
    const h=harness({entries:{[KEYS.cards]:'[]',[KEYS.books]:'[]',bynd_study_book_delete_v1:JSON.stringify({[KEYS.cards]:cards,[KEYS.books]:books})}});
    assert.equal(h.context.getStudyCards().length,1);assert.equal(h.S.getStudyBooks()[0].title,'原词本');
    h.context.saveStudyCards(h.context.getStudyCards());assert.equal(h.storage.getItem('bynd_study_book_delete_v1'),null);assert.equal(h.storage.getItem(KEYS.books),books);
});

test('missing and failed speech reports the selected line language instead of the primary target',async()=>{
    const h=harness();h.S.init();h.S.setTab('words');
    h.context.window.ByndAndroid={speakText:()=>({status:'missing-data'})};
    assert.equal(await h.S.speak('สวัสดี','th-TH'),false);assert.match(h.content(),/没有安装 ไทย 语音/);
    delete h.context.window.ByndAndroid;
    assert.equal(await h.S.speak('Hello','en-US'),false);assert.equal(h.state.spoken.length,0);assert.match(h.content(),/English/);
    assert.equal(await h.S.speak('こんにちは','ja-JP'),true);h.state.spoken.at(-1).onerror({error:'synthesis-failed'});assert.match(h.content(),/日本語 朗读失败.*synthesis-failed/);
});

test('all eight preset language voices retain their own text and code through the Android bridge',async()=>{
    const h=harness(),calls=[];h.context.window.ByndAndroid={speakText:(text,code)=>{calls.push({text,code});return {status:'queued'};}};
    for(const lang of h.S.PRESET_LANGUAGES){assert.equal(await h.S.speak(lang.placeholder,lang.code),true);assert.equal(calls.at(-1).code,lang.code);assert.equal(calls.at(-1).text,lang.placeholder);}
});

test('existing custom common languages gain the correct speech locale without rewriting saved data',()=>{
    const h=harness({entries:{[KEYS.languages]:JSON.stringify([{id:'cn',label:'中文'},{id:'russian',label:'俄语'},{id:'portuguese',label:'Português'},{id:'arabic',label:'العربية'},{id:'vietnamese',label:'越南语'},{id:'hindi',label:'हिन्दी'},{id:'indonesian',label:'印尼语'},{id:'cantonese',label:'粤语'}])}});
    assert.deepEqual(plain(h.S.allLanguages().map(lang=>lang.code)),['zh-CN','ru-RU','pt-BR','ar-SA','vi-VN','hi-IN','id-ID','zh-HK']);
    assert.equal(h.storage.writes.length,0);
});

test('late paid voice responses never override a more recently selected language',async()=>{
    const h=harness(),pending=deferred(),played=[];let request=0;
    h.context.getCharacterVoiceBinding=()=>({provider:'test'});h.context.requestCharacterVoiceAudio=()=>++request===1?pending.promise:Promise.resolve({audioUrl:'latest'});
    h.context.Audio=class{constructor(url){this.url=url;}async play(){played.push(this.url);}pause(){}};
    const first=h.S.speak('こんにちは','ja-JP');assert.equal(await h.S.speak('สวัสดี','th-TH'),true);pending.resolve({audioUrl:'stale'});assert.equal(await first,false);assert.deepEqual(played,['latest']);
});

test('Thai cards retain tone and length, upgrade old automatic hints, and preserve user corrections',()=>{
    const h=harness({readings:true,entries:{[KEYS.cards]:JSON.stringify([{id:'thai',lines:{th:'โรคติดต่อ',cn:'传染病'},pronunciations:{th:{text:'rok tit to',forText:'โรคติดต่อ'}}}])}});
    const raw=h.storage.getItem(KEYS.cards);h.S.init();h.S.setTab('words');h.S.openBook('collection');
    assert.match(h.content(),/rôok dtìt dtɔ̀ɔ/);assert.match(h.content(),/3降 \/ 2低 \/ 2低/);assert.match(h.content(),/标二读三/);assert.match(h.content(),/roːk̚˥˩\.tit̚˨˩\.tɔː˨˩/);
    assert.equal(h.storage.getItem(KEYS.cards),raw,'display upgrades never rewrite original words or progress');
    h.context.saveStudyCards([{id:'thai',lines:{th:'โรคติดต่อ',cn:'传染病'},pronunciations:{th:{text:'我的老师标注',forText:'โรคติดต่อ'}}}]);h.S.render();assert.match(h.content(),/我的老师标注/);
    h.S.setLearningView('cards');h.S.setFoundationLang('th');assert.match(h.content(),/3降 \/ 2低 \/ 2低/);
});
test('Thai word panels are vocabulary-specific and share general help only once per page',()=>{
 const h=harness({readings:true,entries:{[KEYS.cards]:JSON.stringify([{id:'illness',lines:{th:'โรคติดต่อ',cn:'传染病'}},{id:'thanks',lines:{th:'ขอบคุณ',cn:'谢谢'}},{id:'unknown',lines:{th:'โรคติตต่ออันตราย',cn:'待校对'}}])}});
 h.S.init();h.S.setTab('words');h.S.openBook('collection');
 const html=h.content(),panels=html.match(/<details class="study-thai-pronunciation"[\s\S]*?<\/details>/g);
 assert.equal(panels.length,3);for(const panel of panels)assert.doesNotMatch(panel,/แม่|ม้า|标二读三/);
 assert.equal((html.match(/class="study-thai-reference"/g)||[]).length,1);
 assert.match(panels[0],/โรคติดต่อ/);assert.match(panels[0],/长元音/);
 assert.match(panels[2],/โรคติตต่ออันตราย/);assert.match(panels[2],/暂缺.*完整读音/);assert.doesNotMatch(panels[2],/IPA|长元音|低辅音/);
});

test('language-specific checks follow selected locales and never mix English, Korean and Italian rules',()=>{
    const h=harness();h.S.init();
    const cases=[['en',/第三人称单数|does/,/ship|英语字母名/],['ko',/敬语|助词/,/鼻音化|连音/],['it',/性数配合/,/双辅音|词重音/],['fr',/性数配合/,/连音|鼻化/],['de',/第二位/,/长短元音/],['es',/性数配合/,/重音|r\/rr/]];
    for(const [id,grammar,pronunciation]of cases){
        const settings={...h.S.getSettings(),targetIds:[id]};const rules=h.S.buildTurnMessages(h.S.tutor(),settings,{messages:[]},'test','chat')[1].content;
        assert.match(rules,grammar);assert.match(rules,pronunciation);assert.match(rules,/不确定的读音留空/);
        if(id!=='ko')assert.doesNotMatch(rules,/【韩语专项核对】/);
        if(id!=='it')assert.doesNotMatch(rules,/【意大利语专项核对】/);
    }
});

test('English, Korean and Italian guide playback uses real sample words and their locales, never IPA',async()=>{
    const h=harness(),calls=[];h.S.init();h.S.setTab('words');h.S.setLearningView('guide');
    h.context.window.ByndAndroid={speakText:(text,code)=>{calls.push({text,code});return {status:'queued'};}};
    for(const [id,text,code]of [['en','ship. sheep.','en-US'],['ko','같이','ko-KR'],['it','cibo. chilo. gelato. spaghetti.','it-IT']]){
        h.S.setFoundationLang(id);assert.match(h.content(),/发音与语法要点/);await h.S.speakGuideExample(0);assert.deepEqual(calls.at(-1),{text,code});
    }
    h.S.setLearningView('cards');h.S.setCardKind('sentence');assert.match(h.content(),/Sto imparando l&#39;italiano/);
});

test('legacy custom Italian language ids can use the curriculum without moving saved words',()=>{
    const h=harness({entries:{[KEYS.languages]:JSON.stringify([{id:'cn',label:'中文'},{id:'old_it',label:'意大利语'}])}});h.S.init();h.S.setTab('words');h.S.setLearningView('guide');h.S.setFoundationLang('old_it');assert.match(h.content(),/基本字母 · 21/);h.S.setFoundationGroup(1);assert.match(h.content(),/tʃi/);
    h.S.setLearningView('cards');h.S.setCardKind('sentence');assert.match(h.content(),/Sto imparando/);assert.ok(h.S.drillCards()[0].lines.old_it);
});

test('a failed reading mark leaves the original card untouched and shows the write error', () => {
    const h = harness({
        entries: { [KEYS.cards]: JSON.stringify([{ id: 'one', cn: '你好', ja: 'こんにちは', source: 'manual' }]) },
        storageFailKey: KEYS.cards
    });
    h.S.init();
    h.S.setTab('words');
    h.S.setLearningView('cards');
    h.S.markRead(true);
    assert.equal(h.context.getStudyCards()[0].reading, undefined);
    assert.match(h.content(), /学习进度没有保存/);
});

test('built-in starter cards make glyphs, vocabulary and sentences available without adding them to the word book', () => {
    const h = harness();
    h.S.init();
    h.S.setTab('words');
    h.S.setLearningView('cards');
    h.S.setCardKind('glyph');
    assert.match(h.content(), /あ/);
    assert.equal(h.context.getStudyCards().length, 2, 'starter lessons stay separate from user cards');
    h.S.markRead(true);
    const marks = JSON.parse(h.storage.getItem('bynd_study_lesson_marks_v1'));
    assert.equal(marks.study_lesson_ja_glyph_0.can, 1);
    h.S.undoRead();
    assert.equal(JSON.parse(h.storage.getItem('bynd_study_lesson_marks_v1')).study_lesson_ja_glyph_0, undefined);
    h.S.setCardKind('word');
    assert.match(h.content(), /こんにちは/);
    h.S.setFoundationLang('ko');
    assert.match(h.content(), /안녕하세요/);
    h.S.setCardKind('sentence');
    assert.match(h.content(), /한국어를 공부/);
});

test('a failed starter-card mark is visible and does not fabricate saved progress', () => {
    const h = harness({ storageFailKey: 'bynd_study_lesson_marks_v1' });
    h.S.init();
    h.S.setTab('words');
    h.S.setLearningView('cards');
    h.S.setCardKind('glyph');
    h.S.markRead(true);
    assert.equal(h.storage.getItem('bynd_study_lesson_marks_v1'), null);
    assert.match(h.content(), /学习进度没有保存/);
});

test('foundation charts switch across Japanese, Korean and Thai, and handwriting requires a stroke before saving', () => {
    const h = harness({ entries: { [KEYS.languages]: JSON.stringify([
        { id: 'cn', label: '中文' }, { id: 'ja', label: '日本語' }, { id: 'ko', label: '한국어' }, { id: 'th', label: 'ไทย' }
    ]) } });
    h.S.init();
    h.S.setTab('words');
    h.S.setLearningView('guide');
    h.S.setFoundationLang('ko');
    assert.match(h.content(), /基本辅音/);
    assert.match(h.content(), /ㄱ/);
    h.S.setFoundationLang('th');
    assert.match(h.content(), /常用辅音/);
    h.S.setFoundationLang('ja');
    h.S.setFoundationGroup(1);
    assert.match(h.content(), /片假名/);
    h.S.setLearningView('trace');
    h.S.finishTrace();
    assert.match(h.content(), /先描写至少一笔/);
    assert.equal(h.storage.getItem('bynd_study_trace_v1'), null);
});

function traceHarness(options={}) {
 const h=harness(options),ctx={clearRect(){},save(){},restore(){},drawImage(){}},canvas=element('study-trace-canvas');
 canvas.width=canvas.height=560;canvas.getContext=()=>ctx;canvas.getBoundingClientRect=()=>({left:0,top:0,width:280,height:280});
 canvas.parentElement=element('trace-paper');canvas.setAttribute=(key,value)=>{canvas[key]=value;};
 h.elements.set('study-trace-canvas',canvas);h.elements.set('study-trace-feedback',element('study-trace-feedback'));h.elements.set('study-trace-finish',element('study-trace-finish'));
 h.state.traceAccepted=true;h.state.traceColors=[];h.state.traceVoices=[];
 h.context.window.ByndStudyTrace={createTemplate:()=>({canvas:{}}),drawStrokes:(ctx,strokes,size,color)=>h.state.traceColors.push(color),assess:(template,strokes)=>{h.state.traceStrokeCount=strokes.length;return{accepted:h.state.traceAccepted,reason:'offshape'};}};
 h.context.window.ByndAndroid={stopTts(){},speakText:(text,code)=>{h.state.traceVoices.push({text,code});return{status:'queued'};}};
 h.S.init();h.S.setTab('words');h.S.setFoundationLang('th');h.S.setLearningView('trace');
 h.draw=()=>{const e={pointerId:1,clientX:100,clientY:100,preventDefault(){}};canvas.onpointerdown(e);canvas.onpointermove({...e,clientX:130});canvas.onpointerup(e);};
 h.autoClock=()=>{let next=0;const jobs=new Map();h.context.setTimeout=(fn)=>{jobs.set(++next,fn);return next;};h.context.clearTimeout=id=>jobs.delete(id);h.runIdle=async()=>{const batch=[...jobs.values()];jobs.clear();for(const fn of batch)await fn();};};
 return h;
}
test('lifting the pen shows immediate feedback and resting automatically reads without requiring the completion button',async()=>{
 const h=traceHarness();h.autoClock();h.state.traceAccepted=false;h.draw();
 assert.equal(h.elements.get('study-trace-canvas')['aria-invalid'],'true');assert.equal(h.state.traceVoices.length,0);
 await h.runIdle();assert.deepEqual(h.state.traceVoices,[{text:'ก',code:'th-TH'}]);assert.equal(h.storage.getItem('bynd_study_trace_v1'),null);
});
test('automatic checks preserve multi-stroke writing and manual completion records once without replaying the same result',async()=>{
 const h=traceHarness();h.autoClock();h.draw();await h.runIdle();assert.equal(h.state.traceVoices.length,1);assert.equal(h.storage.getItem('bynd_study_trace_v1'),null);
 h.draw();assert.equal(h.state.traceStrokeCount,2,'automatic success does not erase the previous strokes');await h.runIdle();assert.equal(h.state.traceVoices.length,2);
 await h.S.finishTrace();assert.equal(h.state.traceVoices.length,2);assert.equal(JSON.parse(h.storage.getItem('bynd_study_trace_v1')).th['ก'],1);
 await h.runIdle();assert.equal(h.state.traceVoices.length,2);
});
test('pending automatic checks are cancelled by another stroke, clearing, navigation, and hidden documents',async()=>{
 for(const mode of ['clear','glyph','tab','hidden','inactive']){
  const h=traceHarness();h.autoClock();h.draw();
  if(mode==='clear')h.S.clearTrace();if(mode==='glyph')h.S.selectFoundationGlyph(1);if(mode==='tab')h.S.setTab('chat');if(mode==='hidden')h.context.document.hidden=true;if(mode==='inactive')h.elements.set('app-study-window',element('app-study-window'));
  await h.runIdle();assert.equal(h.state.traceVoices.length,0,mode);assert.equal(h.storage.getItem('bynd_study_trace_v1'),null);
 }
 const h=traceHarness();h.autoClock();h.draw();await h.S.finishTrace();await h.runIdle();assert.equal(h.state.traceVoices.length,1,'manual completion cancels the pending automatic replay');
});
test('manual completion does not request a second bound voice while automatic speech is still loading',async()=>{
 const h=traceHarness(),pending=deferred();h.autoClock();let calls=0;
 h.context.getCharacterVoiceBinding=()=>({provider:'fixture'});h.context.requestCharacterVoiceAudio=()=>{calls++;return pending.promise;};
 h.draw();const automatic=h.runIdle(),manual=h.S.finishTrace();
 const count=calls;pending.resolve({audioUrl:''});await Promise.all([automatic,manual]);
 assert.equal(count,1,'one writing revision has only one pending synthesis request');
});
test('finishing tracing reads the selected glyph, preserves successful ink and records it once',async()=>{
 const h=traceHarness();h.draw();await h.S.finishTrace();
 assert.deepEqual(h.state.traceVoices,[{text:'ก',code:'th-TH'}]);assert.equal(JSON.parse(h.storage.getItem('bynd_study_trace_v1')).th['ก'],1);
 assert.match(h.elements.get('study-trace-feedback').textContent,/本次描写已记录/);
 assert.equal(h.elements.get('study-trace-finish').textContent,'再练一次');
 await h.S.finishTrace();assert.equal(JSON.parse(h.storage.getItem('bynd_study_trace_v1')).th['ก'],1);assert.equal(h.state.traceVoices.length,1);
 await h.S.finishTrace();assert.match(h.content(),/先描写至少一笔/);
});
test('incorrect tracing turns red, reads the target, keeps the attempt and clears feedback on undo',async()=>{
 const h=traceHarness();h.state.traceAccepted=false;h.draw();await h.S.finishTrace();
 assert.equal(h.storage.getItem('bynd_study_trace_v1'),null);assert.equal(h.state.traceColors.at(-1),'#d83b3b');
 assert.equal(h.elements.get('study-trace-canvas')['aria-invalid'],'true');assert.equal(h.state.traceVoices.length,1);
 h.S.undoTrace();assert.equal(h.state.traceColors.at(-1),'#1b1b1b');assert.equal(h.elements.get('study-trace-canvas')['aria-invalid'],'false');
 await h.S.finishTrace();assert.equal(h.state.traceVoices.length,1);
});
test('tracing save failures and corrupt history retain ink and never fabricate a saved completion',async()=>{
 for(const mode of ['quota','corrupt','invalid-language','invalid-count']){
  const h=traceHarness(mode==='quota'?{storageFailKey:'bynd_study_trace_v1'}:{});h.draw();
  if(mode==='corrupt')h.storage.setItem('bynd_study_trace_v1','{broken');
  if(mode==='invalid-language')h.storage.setItem('bynd_study_trace_v1','{"th":false}');
  if(mode==='invalid-count')h.storage.setItem('bynd_study_trace_v1','{"th":{"ก":false}}');
  const before=h.storage.getItem('bynd_study_trace_v1');await h.S.finishTrace();assert.equal(h.storage.getItem('bynd_study_trace_v1'),before);
  assert.match(h.content(),/描写记录没有保存/);assert.equal(h.elements.get('study-trace-finish').textContent,'重试保存');assert.equal(h.state.traceVoices.length,1);
 }
 const h=traceHarness();h.context.window.ByndExperience={checkpoint(){throw Error('hook');}};h.draw();await h.S.finishTrace();assert.equal(JSON.parse(h.storage.getItem('bynd_study_trace_v1')).th['ก'],1);assert.doesNotMatch(h.content(),/描写记录没有保存/);
});
test('cancelled and secondary pointers do not become completed strokes, and changing glyph resets the result',async()=>{
 const h=traceHarness(),c=h.elements.get('study-trace-canvas'),e={pointerId:1,clientX:100,clientY:100,preventDefault(){}};
 c.onpointerdown(e);c.onpointerdown({...e,pointerId:2,isPrimary:false});c.onpointercancel(e);await h.S.finishTrace();assert.equal(h.state.traceVoices.length,0);
 h.draw();await h.S.finishTrace();h.S.selectFoundationGlyph(1);await h.S.finishTrace();assert.equal(h.state.traceVoices.length,1);
});

test('focus counts foreground seconds, keeps them by day, and reports storage failure instead of success', () => {
    const h = harness();
    h.S.init();
    h.S.setTab('review');
    h.S.saveFocusDuration('focus', 1);
    h.S.startFocus();
    h.S.tickFocus(Date.now() + 5000);
    assert.equal(Object.values(h.S.getFocusData().days)[0].seconds, 5);
    assert.match(h.content(), /每日学习时长/);
    h.S.pauseFocus();
    h.S.resetFocus();
    h.S.startFocus();
    const base = Date.now();
    for (let step = 1; step <= 12; step += 1) h.S.tickFocus(base + step * 5000);
    assert.equal(Object.values(h.S.getFocusData().days)[0].sessions, 1, 'only a completed focus round increments sessions');
    assert.equal(Object.values(h.S.getFocusData().days)[0].seconds, 65);
    const hidden = harness();
    hidden.S.init();
    hidden.S.setTab('review');
    hidden.S.startFocus();
    hidden.context.document.hidden = true;
    hidden.S.tickFocus(Date.now() + 5000);
    assert.equal(Object.keys(hidden.S.getFocusData().days).length, 0, 'background time is not counted');
    const failed = harness({ storageFailKey: 'bynd_study_focus_v1' });
    failed.S.init();
    failed.S.setTab('review');
    failed.S.startFocus();
    failed.S.tickFocus(Date.now() + 5000);
    assert.match(failed.content(), /专注时长没有保存/);
    assert.equal(failed.storage.getItem('bynd_study_focus_v1'), null);
});
