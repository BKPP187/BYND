const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { memoryStorage, deferred } = require('./helpers/harness.cjs');
function setup() {
    let now = new Date(2026,9,2,12).getTime(), tick;
    class Clock extends Date { constructor(...args) { super(...(args.length ? args : [now])); } static now() { return now; } }
    const storage = memoryStorage(), events = {}, meta = {setAttribute(){}};
    const host = { classList:{ contains: () => true }, contains:() => true };
    const document = { visibilityState:'visible', getElementById:id => id === 'app-coread-window' ? host : meta,
        addEventListener:(name, fn) => { events[name] = fn; } };
    const window = { addEventListener(){} };
    const library = [{ id:'book-1', title:'测试书', author:'作者', content:'x'.repeat(2500), page:0, tags:['小说'], rating:4 }];
    const context = vm.createContext({ Date:Clock, console, localStorage:storage, window, document, AbortController,
        COREAD_PAGE_SIZE:1000, coreadActiveTab:'reader', coreadActiveBookId:'book-1', coreadReaderPanelOpen:false,
        coreadSettingsOpen:false, coreadTocOpen:false, coreadCommentPanelOpen:false,
        getCoReadBook:id => library.find(book=>book.id===id), getCoReadLibrary:()=>library,
        getCoReadBookTags:book => book.tags || [], setInterval:fn=> { tick=fn; return 1; },
        setTimeout, clearTimeout, renderCoReadDaily(){}, fetch:async()=>{ throw new Error('offline'); } });
    const lunarSource = fs.readFileSync('core/api/chat-api.js','utf8');
    vm.runInContext(lunarSource.slice(lunarSource.indexOf('function getChatApiLunarDateParts('), lunarSource.indexOf('function getChatApiFestivalName(')),context);
    for (const file of ['reading-journal','daily-literature','reading-insights']) vm.runInContext(fs.readFileSync(`apps/coreading/${file}.js`,'utf8'),context);
    return { context, journal:window.CoReadJournal, literature:window.CoReadLiterature, storage, library, events, document, meta,
        advance:ms=> { now+=ms; tick?.(); }, setNow:value => { now=value; } };
}
test('reading journal preserves daily books, unique pages, completion and deleted-book snapshots', () => {
    const { journal, library, context } = setup(); const book=library[0], start=Date.now();
    assert.equal(journal.entries().length,0); // Existing/imported library dates are never reading activity.
    journal.record(book,2,start,start+6000);
    assert.equal(journal.read().days[0].books[0].finishedAt,undefined); // A last-page jump is not completion.
    journal.record(book,0,start+6000,start+7000); journal.record(book,0,start+7000,start+8000);
    journal.record(book,1,start+8000,start+9000); journal.record(book,2,start+9000,start+15000);
    const item=journal.aggregate(journal.entries())[0];
    assert.equal(item.pages.size,3); assert.equal(item.chars,2500); assert.equal(item.seconds,15); assert.ok(item.finishedAt);
    library.length=0;
    assert.equal(journal.entries()[0].book.title,'测试书');
    const insight=vm.runInContext('buildCoReadReadingInsights(new Date())',context);
    assert.equal(insight.books.length,1); assert.equal(insight.groups[0][0],'小说'); assert.equal(insight.ratings[3],1);
});
test('reading time is split at local midnight and handles leap dates', () => {
    const { journal,library }=setup();
    const start=new Date(2024,1,28,23,59,58).getTime();
    journal.record(library[0],0,start,start+5000);
    const days=journal.read().days;
    assert.equal(days[0].date,'2024-02-28'); assert.equal(days[0].books[0].seconds,2);
    assert.equal(days[1].date,'2024-02-29'); assert.equal(days[1].books[0].seconds,3);
});
test('reading timer pauses for hidden pages, reader panels and two minutes of inactivity', () => {
    const {journal,library,advance,document,events,context}=setup();
    journal.init(); journal.sync(library[0]); advance(5000);
    assert.equal(journal.entries()[0].seconds,5);
    document.visibilityState='hidden'; events.visibilitychange(); advance(300000);
    assert.equal(journal.entries()[0].seconds,5);
    document.visibilityState='visible'; journal.sync(library[0]); advance(180000);
    assert.equal(journal.entries()[0].seconds,125);
    context.coreadReaderPanelOpen=true; advance(10000); assert.equal(journal.entries()[0].seconds,125);
});
test('quota and corrupt reading data preserve the saved value and surface failures', () => {
    const {journal,library,storage,meta}=setup(); const at=Date.now();
    journal.record(library[0],0,at,at); const before=storage.getItem(journal.key);
    storage.setItem=()=> { throw new Error('quota'); };
    assert.throws(()=>journal.record(library[0],1,at,at+5000),/quota/);
    assert.equal(storage.getItem(journal.key),before);
    journal.sync(library[0]); assert.match(meta.textContent,/未保存.*quota/);
    storage.values.set(journal.key,'{"version":1,"days":[{"date":"bad","books":[]}]}');
    assert.throws(()=>journal.record(library[0],0,at,at),/格式/); assert.match(storage.getItem(journal.key),/bad/);
});
test('calendar month and annual charts use reading entries, exclude added-only books and retain real ratings', () => {
    const {journal,library,context}=setup();
    for(const day of [30,31]) { const at=new Date(2026,0,day,12).getTime(); journal.record(library[0],0,at,at+3000); }
    for(const day of [1,2]) { const at=new Date(2026,1,day,12).getTime(); journal.record(library[0],1,at,at+6000); }
    library.push({id:'unread', title:'尚未阅读',createdAt:new Date(2026,1,2).getTime()});
    const model=vm.runInContext('buildCoReadReadingInsights(new Date(2026,1,1))',context);
    assert.equal(model.books.length,1); assert.equal(model.readDays,2); assert.equal(model.bestStreak,4);
    assert.equal(model.minutes,.2); assert.equal(model.ratings[3],1); assert.equal(model.authors[0][1],1);
});
test('holidays use actual lunar dates, National Day spans the week, no fixed Gregorian Dragon Boat window', () => {
    const {literature}=setup();
    assert.equal(literature.occasion(new Date(2026,9,2)).category,'shuqing/aiguo');
    assert.equal(literature.occasion(new Date(2026,9,7)).title,'国庆');
    assert.equal(literature.occasion(new Date(2026,9,8)),null);
    assert.equal(literature.occasion(new Date(2026,5,19)).title,'端午');
    assert.equal(literature.occasion(new Date(2026,8,25)).title,'中秋');
    assert.equal(literature.occasion(new Date(2026,4,30)),null);
});
test('daily literature deduplicates requests, uses holiday category and restores same-day cache', async () => {
    const {literature,context,storage}=setup(); const result=deferred(); let calls=0,url;
    context.fetch=async value=> { calls++; url=value; return result.promise; };
    const first=literature.refresh(), second=literature.refresh();
    result.resolve({ok:true,json:async()=>({content:'这是在线返回的测试诗句。',author:'测试作者',origin:'测试作品'})});
    await Promise.all([first,second]); assert.equal(calls,1); assert.match(url,/shuqing\/aiguo/);
    assert.equal(literature.get().holiday,'国庆'); assert.equal(literature.get().author,'测试作者');
    assert.ok(storage.getItem(literature.key)); await literature.refresh(); assert.equal(calls,1);
});
test('daily literature advances by date; an old in-flight request cannot overwrite the next day', async () => {
    const {literature,context,setNow}=setup(); const old=deferred(); let calls=0;
    context.fetch=async()=> { calls++; return calls===1 ? old.promise : {ok:true,json:async()=>({content:'下一日在线返回的文句。',author:'乙',origin:'作品乙'})}; };
    const pending=literature.refresh(); setNow(new Date(2026,9,3,12).getTime()); await literature.refresh();
    old.resolve({ok:true,json:async()=>({content:'昨日迟到的在线文句。',author:'甲',origin:'作品甲'})}); await pending;
    assert.equal(literature.get().date,'2026-10-03'); assert.match(literature.get().text,/下一日/);
});
test('literature failures offer retry without fake quotes; ordinary days fall back online and quota is visible', async () => {
    const {literature,context,storage,setNow}=setup();
    await literature.refresh(); assert.equal(literature.get(),null); assert.match(literature.status,/无法获取/);
    setNow(new Date(2026,9,8,12).getTime()); const urls=[];
    context.fetch=async url=> { urls.push(url); if(url.includes('hitokoto')) throw new Error('offline'); return {ok:true,json:async()=>({content:'在线诗词服务返回的文句。',author:'作者',origin:'作品'})}; };
    storage.setItem=()=> { throw new Error('quota'); }; await literature.refresh(true);
    assert.equal(urls.length,2); assert.match(urls[1],/all.json/); assert.equal(literature.get().provider,'今日诗词');
    assert.match(literature.status,/缓存未保存.*quota/); assert.equal(storage.getItem(literature.key),null);
    assert.throws(()=>literature.normalize({content:'<script>alert(1)</script>'},'今日诗词','2026-10-08',null),/无效/);
});
