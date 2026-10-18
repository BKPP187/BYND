const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { memoryStorage, deferred, sourceSection } = require('./helpers/harness.cjs');

function setup() {
    const storage = memoryStorage();
    const input = { value: '', focus() {} };
    const context = vm.createContext({ window: {}, console, localStorage: storage, Map, Set,
        document: { getElementById: id => id.endsWith('-review-input') ? input : null, querySelector: () => null },
        getCoReadBookTags: () => [], getCoReadBookIntro: () => '简介',
        getUserProfile: () => ({ name: '我' }),
        renderCoReadReader() {}, renderCoReadApp() {},
        musicEscapeHtml: value => String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;'),
        DEFAULT_AVATAR: 'avatar.png' });
    vm.runInContext(sourceSection('apps/wechat/chat/stickers.js', 'const WECHAT_INPUT_EMOJI_MAP = {', 'function getWechatBuiltinEmojiName('), context);
    for (const name of ['library', 'reviews']) vm.runInContext(fs.readFileSync(`apps/coreading/${name}.js`, 'utf8'), context);
    context.getCoReadBook = id => context.getCoReadLibrary().find(book => book.id === id);
    context.musicEscapeAttr = context.musicEscapeHtml;
    vm.runInContext("coreadActiveBookId='a';coreadActiveTab='detail';", context);
    const content = '相同的一句话。\n\n' + '长段落。'.repeat(180) + '\n相同的一句话。';
    context.saveCoReadLibrary([{ id: 'a', title: '书甲', content, page: 0, reviews: [] }, { id: 'b', title: '书乙', content: '另一段。', reviews: [] }]);
    return { context, storage, input, content, book: () => context.getCoReadBook('a'),
        status: () => vm.runInContext('[...coreadReviewStatuses.values()].join(" ")', context) };
}

test('whole-book comments, replies and reactions persist and failed writes preserve draft and cache', () => {
    const { context:c, storage, input, book, status } = setup();
    input.value = '  这本书很好看  '; c.addCoReadUserBookReview('a');
    const root = book().reviews[0]; assert.equal(root.text, '这本书很好看');
    c.replyCoReadBookReview('a', root.id); input.value = '接着讨论'; c.addCoReadUserBookReview('a');
    assert.equal(book().reviews[0].parentId, root.id);
    c.likeCoReadBookReview('a', root.id); assert.equal(book().reviews[1].likes, 1);
    c.likeCoReadBookReview('a', root.id); assert.equal(book().reviews[1].likes, 0);
    c.likeCoReadBookReview('a', root.id, 'dislike'); c.likeCoReadBookReview('a', root.id);
    assert.equal(book().reviews[1].liked, true); assert.equal(book().reviews[1].dislikes, 0);
    const before = storage.getItem('bynd_coread_library_v1');
    storage.setItem = () => { throw new Error('quota'); };
    input.value = '不能丢的草稿'; c.addCoReadUserBookReview('a');
    assert.match(status(), /发送失败.*quota/);
    assert.equal(storage.getItem('bynd_coread_library_v1'), before);
    assert.equal(book().reviews.length, 2);
    assert.equal(vm.runInContext('getCoReadReviewDraft("a").text', c), '不能丢的草稿');
    c.likeCoReadBookReview('a', root.id); assert.equal(book().reviews[1].liked, true);
    assert.match(status(), /操作未保存/);
    vm.runInContext('coreadLibraryCache=null', c);
    assert.equal(book().reviews[0].parentId, root.id);
});

test('paragraph anchors survive page splits and repeated text stays separate from book reviews', () => {
    const { context:c, input, book, content } = setup();
    const offset = content.lastIndexOf('相同的一句话。');
    const anchor = c.getCoReadParagraphAt(book(), offset);
    vm.runInContext(`coreadReviewAnchor=${JSON.stringify({ ...anchor, bookId:'a' })}`, c);
    input.value = '只评论最后一段'; c.addCoReadUserBookReview('a', true);
    assert.equal(c.getCoReadScopedReviews(book()).length, 0);
    assert.equal(c.getCoReadScopedReviews(book(), anchor).length, 1);
    assert.equal(c.getCoReadScopedReviews(book(), c.getCoReadParagraphAt(book(), 0)).length, 0);
    const first = c.renderCoReadParagraphText(book(), 480, 960);
    assert.ok(first.includes(`data-paragraph-offset="${content.indexOf('长段落。')}"`));
    const second = c.renderCoReadParagraphText(book(), offset, content.length);
    assert.match(second, /查看段评，1 条/);
    assert.equal(c.getCoReadParagraphAt(book(), 3), null);
    const changed = { ...book(), content: '已修改的正文' };
    c.saveCoReadLibrary([changed]); input.value = '旧段评'; c.addCoReadUserBookReview('a', true);
    assert.equal(book().reviews.length, 1);
});

test('generation merges into latest book and anchors to the request paragraph despite navigation', async () => {
    const { context:c, book, input } = setup();
    const request = deferred(); let calls = 0;
    c.callChatApi = (_messages, options) => {
        calls++; assert.equal(options.skipEmptyLengthRetry, true); assert.equal(options.skipStatusValidationRetry, true);
        return request.promise;
    };
    vm.runInContext('coreadReviewAnchor={...getCoReadParagraphAt(getCoReadBook("a"),0),bookId:"a"}', c);
    const pending = c.generateCoReadBookReviews('a', true);
    await c.generateCoReadBookReviews('a', true); assert.equal(calls, 1);
    vm.runInContext('coreadReviewAnchor=null;coreadActiveBookId="b"', c);
    input.value = '请求期间的新书评'; c.addCoReadUserBookReview('a');
    c.saveCoReadReviewMutation('a', target => { target.page = 2; });
    request.resolve({ok:true,content:'[{"nickname":"读者","text":"这一句好温柔","likes":3}]'});
    await pending;
    assert.equal(book().page, 2); assert.equal(book().reviews.length, 2);
    assert.equal(book().reviews[0].anchor.offset, 0); assert.equal(book().reviews[1].text, '请求期间的新书评');
    assert.equal(c.getCoReadBook('b').reviews.length, 0);
});

test('API, malformed response, quota and deleted-book failures never fabricate saved reviews', async () => {
    const { context:c, book, storage, status } = setup();
    for (const response of [{ok:false,error:'offline'}, {ok:true,content:'不是 JSON'}]) {
        c.callChatApi = async () => response; await c.generateCoReadBookReviews('a');
        assert.match(status(), /评论未保存/); assert.equal(book().reviews.length, 0);
    }
    c.callChatApi = async () => { throw new Error('network'); }; await c.generateCoReadBookReviews('a');
    assert.match(status(), /network/);
    c.callChatApi = async () => ({ok:true,content:'[{"nickname":"甲","text":"评论"}]'});
    storage.setItem = () => { throw new Error('quota'); }; await c.generateCoReadBookReviews('a');
    assert.match(status(), /quota/); assert.equal(book().reviews.length, 0);
    const missing = setup(), request = deferred(); missing.context.callChatApi=()=>request.promise;
    const pending=missing.context.generateCoReadBookReviews('a'); missing.context.saveCoReadLibrary([]);
    request.resolve({ok:true,content:'[{"nickname":"甲","text":"评论"}]'}); await pending;
    assert.equal(missing.context.getCoReadLibrary().length,0); assert.match(missing.status(),/已被删除/);
});

test('sorting performs no API calls, preserves replies, and rendered text is escaped', () => {
    const {context:c, book} = setup();
    c.saveCoReadReviewMutation('a', target => { target.reviews = [
        {id:'old',nickname:'甲',text:'<img src=x onerror=alert(1)>',likes:9,createdAt:1},
        {id:'new',nickname:'乙',text:'新书评',likes:1,createdAt:2},
        {id:'reply',nickname:'我',text:'回复',parentId:'old',createdAt:3}
    ]; });
    c.callChatApi = () => { throw new Error('sorting must not generate'); };
    c.setCoReadReviewSort('hot'); let html=c.renderCoReadBookReviews(book());
    assert.ok(html.indexOf('data-review-id="old"') < html.indexOf('data-review-id="new"'));
    assert.match(html,/&lt;img/); assert.ok(!html.includes('<img src=x'));
    c.setCoReadReviewSort('latest'); html=c.renderCoReadBookReviews(book());
    assert.ok(html.indexOf('data-review-id="new"') < html.indexOf('data-review-id="old"'));
    assert.ok(html.indexOf('data-review-id="reply"') > html.indexOf('data-review-id="old"'));
    const items=c.normalizeCoReadBookReviewItems('[null,{"nickname":"甲","text":"文字","likes":"NaN"}]');
    assert.equal(items.length,1); assert.equal(items[0].likes,0);
    assert.ok(!html.includes('<img'), 'reviews contain no avatar elements');
    assert.doesNotMatch(html, /AI 模拟读者|模拟读者观点|我的评论/);
    assert.doesNotMatch(c.renderCoReadReviewPanel(book()), /AI 模拟读者|模拟读者观点|我的评论/);
});

test('reply calls API once with the original reader and thread; navigation and double sends cannot misroute it', async () => {
    const { context:c, input, book } = setup();
    c.saveCoReadReviewMutation('a', target => { target.reviews = [{id:'root',nickname:'急死我了',text:'这句很温柔',source:'api',likes:3}]; });
    const gate=deferred(); let calls=0, messages;
    c.callChatApi=async (value, options)=> { calls++; messages=value; assert.equal(options.skipEmptyLengthRetry,true); return gate.promise; };
    c.replyCoReadBookReview('a','root'); input.value='我也这么觉得';
    const sending=c.addCoReadUserBookReview('a');
    const sent=book().reviews[0]; assert.equal(sent.replyState,'pending');
    input.value='重复点击不该发送'; await c.addCoReadUserBookReview('a');
    await c.requestCoReadReviewReply('a',sent.id); assert.equal(calls,1); assert.equal(book().reviews.length,2);
    const prompt=JSON.parse(messages[1].content); assert.equal(prompt.nickname,'急死我了'); assert.equal(prompt.userMessage,'我也这么觉得');
    assert.ok(prompt.thread.some(item=>item.text==='这句很温柔'));
    vm.runInContext('coreadActiveBookId="b"',c); c.saveCoReadReviewMutation('a',target=>{target.page=4;});
    gate.resolve({ok:true,content:'{"text":"对吧！他其实一直放在心上。"}'}); await sending;
    assert.equal(book().page,4); assert.equal(book().reviews.length,3);
    assert.equal(book().reviews[0].nickname,'急死我了'); assert.equal(book().reviews[0].parentId,'root');
    assert.equal(book().reviews[0].inReplyToUserId,sent.id); assert.equal(book().reviews.find(item=>item.id===sent.id).replyState,'complete');
    assert.equal(c.getCoReadBook('b').reviews.length,0);
    await c.requestCoReadReviewReply('a',sent.id); assert.equal(calls,1);
});

test('API reply failure is retryable without resending user text; reloaded pending replies can resume', async () => {
    const {context:c,input,book,status}=setup();
    c.saveCoReadReviewMutation('a',target=>{target.reviews=[{id:'root',nickname:'晚风',text:'好喜欢这句',source:'api'}];});
    c.callChatApi=async()=>({ok:false,error:'offline'});
    c.replyCoReadBookReview('a','root'); input.value='你也喜欢这里吗？'; await c.addCoReadUserBookReview('a');
    const sent=book().reviews[0]; assert.equal(sent.text,'你也喜欢这里吗？'); assert.equal(sent.replyState,'failed');
    assert.match(status(),/评论已保存.*offline/); assert.equal(book().reviews.length,2);
    c.callChatApi=async()=>({ok:true,content:'{"unknown":"bad"}'}); await c.requestCoReadReviewReply('a',sent.id);
    assert.equal(book().reviews.length,2); assert.equal(book().reviews[0].replyState,'failed');
    c.saveCoReadReviewMutation('a',target=>{target.reviews[0].replyState='pending';});
    vm.runInContext('coreadLibraryCache=null',c);
    c.callChatApi=async()=>({ok:true,content:'{"text":"是呀，这种不说破的关心最打动我。"}'});
    await c.requestCoReadReviewReply('a',sent.id); await c.requestCoReadReviewReply('a',sent.id);
    assert.equal(book().reviews.length,3); assert.equal(book().reviews.filter(item=>item.source==='user').length,1);
    assert.equal(book().reviews[0].nickname,'晚风');
});

test('quota failures never call API before saving user text, and never fabricate a saved AI response', async () => {
    const {context:c,input,book,storage,status}=setup(); const write=storage.setItem;
    c.saveCoReadReviewMutation('a',target=>{target.reviews=[{id:'root',nickname:'晚风',text:'真好',source:'api'}];});
    let calls=0; c.callChatApi=async()=>{calls++;return {ok:true,content:'{"text":"回话"}'};};
    c.replyCoReadBookReview('a','root'); input.value='草稿不能丢';
    storage.setItem=()=>{throw new Error('quota');}; await c.addCoReadUserBookReview('a');
    assert.equal(calls,0); assert.equal(book().reviews.length,1); assert.match(status(),/草稿已保留/);
    storage.setItem=write; const gate=deferred(); c.callChatApi=()=>gate.promise;
    const pending=c.addCoReadUserBookReview('a'); const sent=book().reviews[0];
    storage.setItem=()=>{throw new Error('quota');}; gate.resolve({ok:true,content:'{"text":"尚未保存的回话"}'}); await pending;
    assert.equal(book().reviews.length,2); assert.equal(book().reviews[0].id,sent.id); assert.match(status(),/对方回复失败.*quota/);
    storage.setItem=write; c.callChatApi=async()=>({ok:true,content:'{"text":"重试的回话"}'});
    await c.requestCoReadReviewReply('a',sent.id); assert.equal(book().reviews.length,3);
});

test('author gifts are separate from reader replies and preserve the draft and paragraph anchor', async () => {
    const {context:c,input,book,content}=setup();
    const anchor=c.getCoReadParagraphAt(book(),0);
    vm.runInContext(`coreadReviewAnchor=${JSON.stringify({...anchor,bookId:'a'})}`,c);
    c.saveCoReadReviewMutation('a',target=>{target.reviews=[{id:'root',nickname:'人间观察员',text:'好温柔',source:'api',anchor}];});
    let prompt;
    c.saveCoReadReviewMutation('a',target=>{target.author='一勺苏打';});
    c.callChatApi=async messages=>{
        assert.match(messages[0].content,/以作者身份/);prompt=JSON.parse(messages[1].content);
        return {ok:true,content:'{"text":"谢谢糖果和支持！"}'};
    };
    c.replyCoReadBookReview('a','root',true); input.value='给读者的回复草稿'; c.setCoReadReviewDraft('a',input,true);
    await c.sendCoReadAuthorGift('a','candy',true);
    assert.equal(prompt.giftRecipient,'author'); assert.match(prompt.gift,/一勺苏打.*糖果/);
    assert.equal(prompt.nickname,'一勺苏打'); assert.equal(prompt.original,undefined);
    assert.ok(prompt.thread.every(item=>item.nickname!=='人间观察员'));
    assert.equal(c.getCoReadScopedReviews(book()).length,0); assert.equal(c.getCoReadScopedReviews(book(),anchor).length,3);
    const receipt=book().reviews.find(item=>item.kind==='author-gift');
    assert.equal(receipt.giftRecipient,'author'); assert.equal(receipt.giftAuthor,'一勺苏打'); assert.equal(receipt.parentId,undefined);
    assert.equal(book().reviews[0].nickname,'一勺苏打'); assert.equal(book().reviews[0].parentId,receipt.id);
    assert.equal(book().reviews[0].personaRole,'author'); assert.equal(book().reviews[0].receivedGift,'candy');
    assert.equal(book().reviews[0].anchor.offset,0);
    assert.equal(book().reviews[0].anchor.quote,anchor.quote);
    const draft=vm.runInContext('getCoReadReviewDraft("a",coreadReviewAnchor)',c);
    assert.equal(draft.replyId,'root'); assert.equal(draft.text,'给读者的回复草稿');
    const gate=deferred(); c.callChatApi=()=>gate.promise;
    c.replyCoReadBookReview('a',book().reviews[0].id,true); input.value='再聊一句'; const pending=c.addCoReadUserBookReview('a',true);
    c.saveCoReadReviewMutation('a',target=>{target.content='原文已经改变\n'+content;});
    gate.resolve({ok:true,content:'{"text":"旧原文回话"}'}); await pending;
    assert.equal(book().reviews.filter(item=>item.text==='旧原文回话').length,0);
});

test('author gift quota and API failures preserve records correctly and author retries never duplicate the gift', async () => {
    const {context:c,storage,book,status}=setup(); const write=storage.setItem; let calls=0;
    c.callChatApi=async()=>{calls++;return {ok:false,error:'offline'};};
    storage.setItem=()=>{throw new Error('quota');}; await c.sendCoReadAuthorGift('a','giftbox');
    assert.equal(calls,0); assert.equal(book().reviews.length,0); assert.match(status(),/打赏未保存.*quota/);
    storage.setItem=write; await c.sendCoReadAuthorGift('a','giftbox');
    assert.equal(book().reviews.length,1); const receipt=book().reviews[0];
    assert.equal(receipt.giftRecipient,'author'); assert.equal(receipt.replyState,'failed');
    assert.match(status(),/打赏已记录.*作者回复失败.*offline/);
    c.callChatApi=async()=>({ok:true,content:'{"text":"感谢支持！"}'});
    await c.requestCoReadReviewReply('a',receipt.id); await c.requestCoReadReviewReply('a',receipt.id);
    assert.equal(book().reviews.length,2); assert.equal(book().reviews.filter(item=>item.kind==='author-gift').length,1);
    assert.equal(book().reviews[0].personaRole,'author');
});

test('feeding modal preserves its own draft, validates empty text and sends the message to the author once', async () => {
    const {context:c,book,input}=setup(); let calls=0, prompt; const gate=deferred();
    c.callChatApi=messages=>{calls++;prompt=JSON.parse(messages[1].content);return gate.promise;};
    input.value='普通书评草稿'; c.setCoReadReviewDraft('a',input);
    c.openCoReadAuthorSupport('a','feed'); await c.submitCoReadAuthorSupport();
    assert.equal(calls,0); assert.match(vm.runInContext('coreadAuthorSupport.error',c),/写下/);
    c.setCoReadAuthorSupportMessage({value:'喜欢你写的日常，再投喂一点鼓励！'});
    c.closeCoReadAuthorSupport(); c.openCoReadAuthorSupport('a','feed');
    assert.match(vm.runInContext('coreadAuthorSupportDrafts.get(coreadAuthorSupport.key).message',c),/鼓励/);
    const sending=c.submitCoReadAuthorSupport(); await c.submitCoReadAuthorSupport();
    assert.equal(calls,1); assert.equal(book().reviews[0].gift,'feed');
    assert.match(book().reviews[0].text,/投喂作者.*鼓励/); assert.match(prompt.giftMessage,/鼓励/);
    c.closeCoReadAuthorSupport(); vm.runInContext('coreadActiveBookId="b"',c); c.openCoReadAuthorSupport('b','feed');
    c.setCoReadAuthorSupportMessage({value:'另一部书的投喂草稿'});
    gate.resolve({ok:true,content:'{"text":"谢谢你的鼓励！"}'}); await sending;
    assert.equal(book().reviews.length,2); assert.equal(c.getCoReadBook('b').reviews.length,0);
    assert.equal(vm.runInContext('coreadAuthorSupport.bookId',c),'b');
    assert.match(vm.runInContext('coreadAuthorSupportDrafts.get(coreadAuthorSupport.key).message',c),/另一部/);
    assert.equal(vm.runInContext('getCoReadReviewDraft("a").text',c),'普通书评草稿');
});

test('support modal retains the feeding draft after quota failure; charging and monthly cards go to the author', async () => {
    const {context:c,storage,book}=setup(); const write=storage.setItem; let calls=0;
    c.callChatApi=async()=>{calls++;return {ok:true,content:'{"text":"谢谢支持！"}'};};
    c.openCoReadAuthorSupport('a','feed'); c.setCoReadAuthorSupportMessage({value:'保存失败也不要丢'});
    storage.setItem=()=>{throw new Error('quota');}; await c.submitCoReadAuthorSupport();
    assert.equal(calls,0); assert.match(vm.runInContext('coreadAuthorSupport.error',c),/quota/);
    assert.match(vm.runInContext('coreadAuthorSupportDrafts.get(coreadAuthorSupport.key).message',c),/不要丢/);
    storage.setItem=write; await c.submitCoReadAuthorSupport(); assert.equal(book().reviews.length,2);
    assert.equal(vm.runInContext('coreadAuthorSupport',c),null);
    for (const type of ['charge','monthly']) { c.openCoReadAuthorSupport('a',type); await c.submitCoReadAuthorSupport(); }
    assert.equal(book().reviews.filter(item=>item.giftRecipient==='author').length,3);
    assert.ok(book().reviews.some(item=>item.text.includes('送出一张月卡')));
    assert.ok(book().reviews.some(item=>item.text.includes('充电')));
    assert.equal(book().reviews.filter(item=>item.personaRole==='author').length,3);
    const html=c.renderCoReadReviewPanel(book());
    assert.doesNotMatch(html,/AI 生成讨论|糖果|冰淇淋|巧克力|礼盒/);
    for(const name of ['讨论','充电','月卡','投喂']) assert.ok(html.includes(name));
});

test('author acknowledgements use author identity and the reader message without novel-title or character context', async () => {
    const {context:c,book}=setup(); let prompt, system;
    c.saveCoReadReviewMutation('a',target=>{
        target.title='垂耳兔热事'; target.author='';
        target.description='垂耳兔角色甩甩耳朵，给你比心。';
    });
    c.callChatApi=async messages=>{system=messages[0].content;prompt=JSON.parse(messages[1].content);return {ok:true,content:'{"text":"谢谢你的喜欢和支持，我会继续认真写下去！"}'};};
    await c.sendCoReadAuthorGift('a','feed',false,'谢谢作者写了这么好的故事');
    assert.equal(prompt.book,undefined,'A gift acknowledgement should not receive the novel title as persona material');
    assert.equal(prompt.original,undefined,'Story/character prose must not enter author acknowledgements');
    assert.ok(!JSON.stringify(prompt).includes('垂耳兔热事'));
    assert.equal(prompt.nickname,'作者'); assert.equal(prompt.giftMessage,'谢谢作者写了这么好的故事');
    assert.match(system,/第一人称.*我/); assert.match(system,/书名.*不是.*姓名/);
    assert.equal(book().reviews[0].nickname,'作者'); assert.equal(book().reviews[0].personaRole,'author');
});

test('author replies that echo a novel title fail visibly and retry without duplicating the support record', async () => {
    const {context:c,book,status}=setup();
    c.saveCoReadReviewMutation('a',target=>{target.title='《垂耳兔热事》';target.author='未知作者';});
    c.callChatApi=async()=>({ok:true,content:'{"text":"垂耳兔热事甩甩耳朵给你比个大大的心心！"}'});
    await c.sendCoReadAuthorGift('a','feed',false,'谢谢作者');
    assert.equal(book().reviews.length,1,'A wrong-identity API response must never become a displayed author reply');
    assert.match(status(),/作者回复失败/); assert.equal(book().reviews[0].replyState,'failed');
    assert.equal(book().reviews[0].replyPersona.nickname,'作者');
    const sentId=book().reviews[0].id;
    c.callChatApi=async()=>({ok:true,content:'{"text":"谢谢支持，我会继续努力写好后面的故事！"}'});
    await c.requestCoReadReviewReply('a',sentId);
    assert.equal(book().reviews.length,2); assert.equal(book().reviews[0].nickname,'作者');
    assert.equal(book().reviews.filter(item=>item.kind==='author-gift').length,1);
});

test('saved comments and nested replies show emoji labels as native emoji without changing stored text or ordinary brackets', () => {
    const {context:c,book}=setup();
    const original='我泪点[流泪]真的只想看兔兔开心[捂脸]，还在读[第1章]。<img src=x onerror=alert(1)>';
    c.saveCoReadReviewMutation('a',target=>{target.reviews=[
        {id:'emoji-root',nickname:'读者',text:original,source:'api'},
        {id:'emoji-reply',parentId:'emoji-root',nickname:'我',text:'[爱心]【流泪】［强］ [constructor] [[流泪]]',source:'user'},
        {id:'emoji-author',parentId:'emoji-root',nickname:'作者',text:'谢谢[鼓掌]😊',source:'api',personaRole:'author'}
    ];});
    const html=c.renderCoReadBookReviews(book());
    assert.ok(html.includes('我泪点😢真的只想看兔兔开心🤦'));
    assert.ok(html.includes('❤️😢👍 [constructor] [[流泪]]')); assert.ok(html.includes('谢谢👏😊'));
    assert.ok(html.includes('[第1章]')); assert.ok(html.includes('&lt;img')); assert.ok(!html.includes('<img src=x'));
    assert.equal(book().reviews[0].text,original);
    vm.runInContext('coreadLibraryCache=null',c);
    assert.ok(c.renderCoReadBookReviews(book()).includes('我泪点😢'));
});
