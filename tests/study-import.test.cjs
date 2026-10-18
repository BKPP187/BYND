const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'apps/study/study-pdf.js'), 'utf8');
const file = (name = 'words.pdf', size = 100) => ({ name, size, arrayBuffer: async () => new ArrayBuffer(10) });
function harness(pages = ['hello\t你好'], api = { ok: true, content: '{"words":[{"term":"สวัสดี","meaning":"你好"}]}' }) {
    const calls = [], settings = [], life = { destroyed: 0, cleaned: 0, rendered: 0, ocrOpened: 0, ocrClosed: 0 };
    const doc = { numPages: pages.length, getPage: async index => ({
        getTextContent: async () => ({ items: [{ str: pages[index - 1] }] }),
        getViewport: () => ({ width: 600, height: 800 }),
        render: () => { life.rendered++; return { promise: Promise.resolve() }; },
        cleanup: () => { life.cleaned++; }
    }) };
    const context = vm.createContext({
        window: { pdfjsWorker: {}, pdfjsLib: { getDocument: options => { settings.push(options); return { promise: Promise.resolve(doc), destroy: async () => { life.destroyed++; } }; } } },
        document: { createElement: () => ({ getContext: () => ({}), toDataURL: () => 'data:image/jpeg;base64,AA==' }) },
        callChatApi: async (messages, options) => { calls.push({ messages, options }); return typeof api === 'function' ? api() : api; }
    });
    vm.runInContext(source, context);
    context.window.ByndStudyOcr = {create:async()=>{
        life.ocrOpened++;
        return {recognize:async()=>({text:'',items:[]}),close:()=>{life.ocrClosed++;}};
    }};
    return { S: context.window.ByndStudyPdf, context, calls, settings, life };
}
test('local Thai import pairs native-first rows, skips Chinese headings and strips dialogue labels', async () => {
    const h = harness(['第一课  打招呼\n句子\n1. สวัสดีค่ะ/ครับ    你好/再见\nA: ฉันชื่อหลินค่ะ    我叫小林。\n13\t【大】\tdà\tค.\tใหญ่\t这个苹果很～。']);
    const result = await h.S.read(file(), { targetId: 'th', nativeId: 'cn' });
    assert.equal(result.words.length, 3);
    assert.equal(result.words[0].term, 'สวัสดีค่ะ/ครับ');
    assert.equal(result.words[0].meaning, '你好/再见');
    assert.equal(result.words[1].term, 'ฉันชื่อหลินค่ะ');
    assert.equal(result.words[2].term, 'ใหญ่');
    assert.equal(result.words[2].meaning, '大');
    assert.equal(h.calls.length, 0, 'local extraction never sends document content');
    assert.equal(h.settings[0].isEvalSupported, false);
    assert.equal(h.life.destroyed, 1);
});
test('PDF visual rows join independently emitted table cells and preserve wide column gaps', () => {
    const h = harness();
    const text = h.S.pageText([
        { str: '【大】', transform: [1,0,0,12,10,500], width: 25, hasEOL: true },
        { str: 'ใหญ่', transform: [1,0,0,12,100,501], width: 25, hasEOL: true },
        { str: '你好', transform: [1,0,0,12,10,480], width: 25, hasEOL: true }
    ]);
    assert.equal(text, '【大】\tใหญ่\n你好');
});
test('merged Chinese cells pair each Thai translation with the headword rather than example sentences', () => {
    const h = harness();
    const item = (str,x,y,width=25) => ({str,transform:[1,0,0,12,x,y],width});
    const words = h.S.tableWords([
        item('【爱】',100,490), item('รัก',330,500), item('ชอบ',330,480), item('妈妈，我～你。',550,500),
        item('【八】',100,450), item('เลข.',295,450), item('แปด',330,450), item('他儿子今年～岁了。',550,450)
    ], {nativeId:'cn',targetId:'th'});
    assert.equal(words.length,3);
    assert.equal(words[0].meaning,'爱');
    assert.equal(words[1].meaning,'爱');
    assert.equal(words[2].term,'แปด');
    assert.equal(words[2].meaning,'八');
});
test('OCR pairs multiline Thai and Chinese cells by table row and omits a section heading',()=>{
    const h=harness();
    const item=(str,x0,x1,y0,y1)=>({str,bbox:{x0,x1,y0,y1},confidence:90});
    const words=h.S.ocrWords({rows:[{top:0,bottom:50},{top:50,bottom:100}],items:[
        item('18. 流感',20,80,10,30),item('ไข้หวัดใหญ่',100,220,8,32),
        item('二、传播相关词汇',20,130,60,80),item('หมวดศัพท์',150,250,60,80)
    ]},{targetId:'th',nativeId:'cn'});
    assert.equal(words.length,1);
    assert.equal(words[0].term,'ไข้หวัดใหญ่');
    assert.equal(words[0].meaning,'流感');
});
test('page bounds, unsupported/empty/oversize files fail before parser dispatch', async () => {
    const h = harness();
    for (const [f, opts, pattern] of [[file('x.png'), {}, /PDF、DOC/], [file('x.pdf', 0), {}, /为空/], [file('x.pdf', 81*1024*1024), {}, /80MB/], [file(), { from: 0, to: 1 }, /有效范围/], [file(), { from: 1, to: 31 }, /30/], [file(), { from: 1.5 }, /有效范围/]]) {
        await assert.rejects(h.S.read(f, opts), pattern);
    }
    assert.equal(h.settings.length, 0);
});
test('blank scans fail after OCR and partial results disclose unreadable pages', async () => {
    const blank = harness(['']);
    await assert.rejects(blank.S.read(file()), /没有识别到所选语言/);
    assert.equal(blank.life.ocrOpened,1);
    assert.equal(blank.life.ocrClosed,1);
    assert.equal(blank.life.destroyed, 1);
    const mixed = harness(['', 'hello\t你好']);
    const result = await mixed.S.read(file(), { to: 20 });
    assert.deepEqual(Array.from(result.blankPages), [1]);
    assert.equal(result.to, 2);
    await assert.rejects(mixed.S.read(file(), { from: 3, to: 3 }), /只有 2 页/);
});
test('image-only pages automatically use local OCR without a paid API request',async()=>{
    const h=harness(['','']);let reads=0;
    h.context.window.ByndStudyOcr.create=async()=>{
        h.life.ocrOpened++;
        return {recognize:async()=>{reads++;return {text:'สวัสดี    你好',items:[]};},close:()=>{h.life.ocrClosed++;}};
    };
    const result=await h.S.read(file(),{targetId:'th',nativeId:'cn'});
    assert.equal(result.words.length,2);
    assert.equal(result.words[0].meaning,'你好');
    assert.deepEqual(Array.from(result.ocrPages),[1,2]);
    assert.equal(h.calls.length,0);
    assert.equal(h.life.ocrOpened,1);
    assert.equal(h.life.ocrClosed,1);
    assert.equal(reads,2);
});
test('local OCR failure never reports a successful partial import and always releases the worker',async()=>{
    const h=harness(['สวัสดี    你好','']);
    h.context.window.ByndStudyOcr.create=async()=>({recognize:async()=>{throw new Error('识别组件失败');},close:()=>{h.life.ocrClosed++;}});
    await assert.rejects(h.S.read(file(),{targetId:'th',nativeId:'cn'}),/识别组件失败/);
    assert.equal(h.life.ocrClosed,1);
    assert.equal(h.life.destroyed,1);
});
test('corrupt and password-protected PDFs surface actionable errors and release their loading task', async () => {
    for(const [name,message] of [['PasswordException',/密码保护/],['InvalidPDFException',/损坏或格式无效/]]) {
        const h = harness();
        h.context.window.pdfjsLib.getDocument = () => ({promise:Promise.reject(Object.assign(new Error('parser error'),{name})),destroy:async()=>{h.life.destroyed++;}});
        await assert.rejects(h.S.read(file()),message);
        assert.equal(h.life.destroyed,1);
    }
});
test('AI recognition renders the page even when a scan has a text heading and never uses a persona preset', async () => {
    const h = harness(['scan title']);
    const result = await h.S.read(file(), { ai: true, targetLabel: 'ไทย', nativeLabel: '中文' });
    assert.equal(result.words[0].term, 'สวัสดี');
    assert.equal(h.life.rendered, 1);
    assert.equal(h.calls[0].messages[0].content[1].type, 'image_url');
    assert.equal(h.calls[0].options.presetOverride, null);
});
test('AI errors and malformed or truncated lists never turn into successful imports', async () => {
    for (const reply of [{ ok: false, error: '额度不足' }, { ok: true, content: '{"words":[' }, { ok: true, content: '{"words":[{}]}' }]) {
        const h = harness([''], reply);
        await assert.rejects(h.S.read(file(), { ai: true }), /额度不足|不完整|有效/);
        assert.equal(h.life.destroyed, 1);
    }
});
test('cancelled reads never return a stale result or dispatch another request', async () => {
    const controller = new AbortController();
    const h = harness([''], () => { controller.abort(); return { ok: true, content: '{"words":[]}' }; });
    await assert.rejects(h.S.read(file(), { ai: true, signal: controller.signal }), /已取消/);
    await assert.rejects(h.S.read(file(), { signal: controller.signal }), /已取消/);
    assert.equal(h.calls.length, 1);
});
test('legacy DOC import uses the offline reader and reports corrupt documents clearly', async () => {
    const h = harness();
    h.context.window.ByndStudyWord = { extractDoc: async () => 'สวัสดี    你好' };
    const result = await h.S.read(file('words.doc'), { targetId: 'th', nativeId: 'cn' });
    assert.equal(result.words[0].meaning, '你好');
    h.context.window.ByndStudyWord.extractDoc = async () => { throw new Error('bad FIB'); };
    await assert.rejects(h.S.read(file('bad.doc')), /损坏、加密/);
});
test('vendored offline readers and auxiliary resources match their recorded hashes', () => {
    const { createHash } = require('node:crypto');
    const dir = path.join(root, 'assets/vendor/pdfjs');
    const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json')));
    for (const [name, hash] of Object.entries(manifest.hashes)) assert.equal(createHash('sha256').update(fs.readFileSync(path.join(dir, name))).digest('hex'), hash, name);
    const word = path.join(root, 'assets/vendor/study-word');
    assert.equal(createHash('sha256').update(fs.readFileSync(path.join(word, 'word.js'))).digest('hex'), JSON.parse(fs.readFileSync(path.join(word, 'manifest.json'))).sha256);
});
