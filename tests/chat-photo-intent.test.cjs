const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const { root } = require('./helpers/harness.cjs');

function harness(request, prompt = request) {
    const msg = { type: 'image', isMe: false, imagePending: true, imagePrompt: prompt, description: '照片', timestamp: 10 };
    const char = { id: 'photo', name: '林间', avatar: 'https://images.example/identity.png', description: '银发、灰色眼睛的年轻男子，乙女游戏人物。', chatConfig: {}, history: [{ type: 'text', isMe: true, content: request }, msg] };
    const requests = [], state = { saves: 0, albums: 0 };
    const context = vm.createContext({
        window: { myCharacters: [char] }, Response, URL, AbortSignal, Blob, FormData,
        cleanWechatVisibleContent: value => String(value || ''), getWechatCharDisplayName: item => item.name,
        DEFAULT_AVATAR: 'default', createMessageTimestamp: () => 10,
        hasWechatAiDirectiveSource: () => false, looksLikeWechatRichOrRegexSource: () => false,
        getDefaultImageApi: () => ({ baseUrl: 'https://image-api.example/v1', imageModel: 'custom-image' }),
        fetch: async (url, options) => { requests.push({ url, body: JSON.parse(options.body) }); return new Response(JSON.stringify({ data: [{ url: 'https://images.example/result.png' }] })); },
        saveCharactersToStorage: async () => { state.saves++; return true; },
        recordWechatGeneratedImageToAlbum: async () => { state.albums++; },
        renderChatList() {}, showWechatToast() {}
    });
    for (const file of ['core/api/image-generation.js', 'apps/wechat/chat/media-directives.js']) {
        vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context);
    }
    context.window.recordWechatGeneratedImageToAlbum = context.recordWechatGeneratedImageToAlbum;
    return { context, requests, char, msg, state };
}

for (const subject of ['超市货架', '购物篮里的零食', '今天做的晚饭', '窗外的风景']) {
    test(`${subject}: the requested scene uses natural photography without an identity edit or character styling`, async () => {
        const h = harness(`拍一下${subject}给我看看`, '角色本人在超市举手机自拍，乙女游戏半写实 3D CG');
        await h.context.resolveWechatAiGeneratedImage(h.char, h.msg);
        assert.equal(h.requests[0].url, 'https://image-api.example/v1/images/generations');
        assert.match(h.requests[0].body.prompt, new RegExp(subject));
        assert.match(h.requests[0].body.prompt, /手机.*(?:随手拍|后置)|第一人称/);
        assert.doesNotMatch(h.requests[0].body.prompt, /角色卡外观重点|角色卡\/人设原文|otome game|默认画风：乙女/);
        assert.equal(h.requests[0].body.images, undefined);
        assert.equal(h.requests[0].body.size, '1024x1536');
        assert.equal(h.msg.imageError, '');
        assert.equal(h.state.albums, 1);
    });
}

test('character selfies still preserve identity and their default CG style', async () => {
    const h = harness('给我拍张你现在的自拍');
    await h.context.resolveWechatAiGeneratedImage(h.char, h.msg);
    assert.equal(h.requests[0].url, 'https://image-api.example/v1/images/edits');
    assert.equal(h.requests[0].body.images[0].image_url, h.char.avatar);
    assert.match(h.requests[0].body.prompt, /银发/);
    assert.match(h.requests[0].body.prompt, /默认画风：乙女/);
});

test('clearly adult characters get mature body proportions without changing minor character designs', async () => {
    const adult = harness('给我拍张你现在的自拍');
    adult.char.description = '成年男性，年轻男子，银发、灰色眼睛，乙女游戏人物。';
    await adult.context.resolveWechatAiGeneratedImage(adult.char, adult.msg);
    assert.match(adult.requests[0].body.prompt, /成年体态.*成人骨架比例.*避免儿童化或小学生体型/);

    const minor = harness('给我拍张你现在的自拍');
    minor.char.description = '高中生男孩，银发、灰色眼睛，乙女游戏人物。';
    await minor.context.resolveWechatAiGeneratedImage(minor.char, minor.msg);
    assert.doesNotMatch(minor.requests[0].body.prompt, /成年体态/);
});

test('a request for a more realistic selfie overrides an AI-authored CG description while keeping the same identity', async () => {
    const h = harness('你的自拍真实一点，像手机原相机直出，不要CG', '角色本人的乙女游戏半写实 3D CG 自拍');
    await h.context.resolveWechatAiGeneratedImage(h.char, h.msg);
    assert.equal(h.requests[0].body.images[0].image_url, h.char.avatar);
    assert.match(h.requests[0].body.prompt, /原相机|真实摄影/);
    assert.doesNotMatch(h.requests[0].body.prompt, /默认画风：乙女|避免.*普通真人摄影/);
});

test('explicit art styles and requests against live action are respected', async () => {
    const drawing = harness('给我一张水彩画风的超市货架');
    await drawing.context.resolveWechatAiGeneratedImage(drawing.char, drawing.msg);
    assert.equal(drawing.requests[0].url, 'https://image-api.example/v1/images/generations');
    assert.match(drawing.requests[0].body.prompt, /水彩/);
    assert.doesNotMatch(drawing.requests[0].body.prompt, /默认画风：.*真实摄影/);
    const portrait = harness('拍张自拍，不要真人化，保持二次元人物');
    await portrait.context.resolveWechatAiGeneratedImage(portrait.char, portrait.msg);
    assert.match(portrait.requests[0].body.prompt, /默认画风：乙女|二次元/);
    assert.doesNotMatch(portrait.requests[0].body.prompt, /默认画风：真实摄影/);
});

test('horizontal, square and explicit larger dimensions reach the actual generation request', async () => {
    for (const [request, size] of [['拍张横版超市货架照片', '1536x1024'], ['正方形的购物篮照片', '1024x1024'], ['拍货架，尺寸2048×3072', '2048x3072']]) {
        const h = harness(request);
        await h.context.resolveWechatAiGeneratedImage(h.char, h.msg);
        assert.equal(h.requests[0].body.size, size);
    }
    const h = harness('给我货架照片');
    h.msg.imageSize = '2048x2048';
    await h.context.resolveWechatAiGeneratedImage(h.char, h.msg);
    assert.equal(h.requests[0].body.size, '2048x2048');
});

test('the latest photo request determines the subject and older object photos do not override a new selfie', async () => {
    const h = harness('现在拍张你拿着购物篮的自拍');
    h.char.history.unshift({ type: 'text', isMe: true, content: '拍下超市货架' });
    await h.context.resolveWechatAiGeneratedImage(h.char, h.msg);
    assert.equal(h.requests[0].url, 'https://image-api.example/v1/images/edits');
});

test('direct requests to photograph the character and negative person requests keep their intended subjects', async () => {
    for (const [request, path] of [['拍一下你', '/images/edits'], ['不要拍你，拍房间', '/images/generations']]) {
        const h = harness(request);
        await h.context.resolveWechatAiGeneratedImage(h.char, h.msg);
        assert.ok(h.requests[0].url.endsWith(path));
    }
    const h = harness('拍张半写实CG风格的自拍');
    await h.context.resolveWechatAiGeneratedImage(h.char, h.msg);
    assert.match(h.requests[0].body.prompt, /默认画风：乙女/);
    assert.doesNotMatch(h.requests[0].body.prompt, /默认画风：真实摄影/);
});

test('automatic image messages carry the requested object instead of adding a generic CG selfie', () => {
    const h = harness('拍下超市货架给我看');
    const msg = h.context.buildWechatAutoImageMessageFromText('给你看看', h.char);
    assert.match(msg.imagePrompt, /超市货架/);
    assert.doesNotMatch(msg.imagePrompt, /采用乙女游戏半写实|手机自拍或/);
});

test('short retry or style requests retain the object described in the actual image directive', async () => {
    for (const request of ['再发张图', '真实一点，原相机直出']) {
        const h = harness(request, '第一人称俯拍购物篮中的零食');
        await h.context.resolveWechatAiGeneratedImage(h.char, h.msg);
        assert.equal(h.requests[0].url, 'https://image-api.example/v1/images/generations');
        assert.match(h.requests[0].body.prompt, /购物篮/);
        assert.match(h.requests[0].body.prompt, /真实摄影/);
    }
});

test('a completed older photo bounds the context of a later proactive selfie', async () => {
    const h = harness('我有点想你了', '角色本人在窗边自拍');
    h.char.history.unshift(
        { type: 'text', isMe: true, content: '拍下超市货架' },
        { type: 'image', isMe: false, imageUrl: 'https://images.example/old.png', imagePending: false }
    );
    await h.context.resolveWechatAiGeneratedImage(h.char, h.msg);
    assert.equal(h.requests[0].url, 'https://image-api.example/v1/images/edits');
});

test('larger image failures never silently downgrade size, rerun generation, or mark an image saved', async () => {
    const h = harness('拍货架，尺寸2048x3072');
    h.context.fetch = async (url, options) => { h.requests.push({ url, body: JSON.parse(options.body) }); return new Response('{"error":{"message":"unsupported size"}}', { status: 400 }); };
    await h.context.resolveWechatAiGeneratedImage(h.char, h.msg);
    assert.equal(h.requests.length, 1);
    assert.equal(h.requests[0].body.size, '2048x3072');
    assert.ok(h.msg.imageError);
    assert.equal(h.state.albums, 0);
});

test('self-portrait chibi stickers follow the reference style and preserve the current character identity', async () => {
    const h = harness('发张你的Q版自画像表情包，委屈巴巴捧花', '角色本人自拍，乙女游戏CG');
    await h.context.resolveWechatAiGeneratedImage(h.char, h.msg);
    const request = h.requests[0];
    assert.equal(request.url, 'https://image-api.example/v1/images/edits');
    assert.equal(request.body.images[0].image_url, h.char.avatar);
    assert.equal(request.body.size, '1024x1024');
    assert.equal(h.msg.imageKind, 'character-sticker');
    assert.match(request.body.prompt, /黑白极简手绘线稿/);
    assert.match(request.body.prompt, /超大黑亮眼睛.*白色高光/);
    assert.match(request.body.prompt, /淡粉色腮红/);
    assert.match(request.body.prompt, /银发、灰色眼睛/);
    assert.doesNotMatch(request.body.prompt, /默认画风：乙女|本次情绪与动作：角色本人自拍/);
    assert.equal(h.state.albums, 1);
});

test('proactive chibi directives use the same image generation pipeline without changing normal photos or library stickers', async () => {
    const h = harness('今天心情真好');
    const msg = h.context.buildWechatGeneratedImageMessage('角色本人Q版自画像表情包，开心捧花', '开心', h.char);
    assert.equal(msg.type, 'image');
    assert.equal(msg.imageKind, 'character-sticker');
    h.char.history.push(msg);
    await h.context.resolveWechatAiGeneratedImage(h.char, msg);
    assert.equal(msg.imagePending, false);
    assert.equal(msg.imageError, '');
    assert.equal(h.context.buildWechatGeneratedImageMessage('手机拍摄超市货架', '照片', h.char).imageKind, undefined);
    assert.equal(h.context.isWechatCharacterStickerImage('Q版猫猫贴纸', '可爱'), false);
});

test('a failed chibi generation retains a real failure instead of producing an empty successful sticker', async () => {
    const h = harness('发张你的Q版自画像表情包');
    h.context.fetch = async (url, options) => { h.requests.push({ url, body: JSON.parse(options.body) }); return new Response('{"error":{"message":"upstream unavailable"}}', { status: 503 }); };
    await h.context.resolveWechatAiGeneratedImage(h.char, h.msg);
    assert.equal(h.msg.imageKind, 'character-sticker');
    assert.ok(h.msg.imageError);
    assert.equal(h.msg.content, undefined);
    assert.equal(h.state.albums, 0);
    assert.equal(h.requests.length, 1);
});

test('normal portrait requests use a compact BJD-style prompt rather than repeating the full character card', async () => {
    const h = harness('拍张你今天穿搭的自拍');
    await h.context.resolveWechatAiGeneratedImage(h.char, h.msg);
    assert.match(h.requests[0].body.prompt, /BJD.*娃娃感/);
    assert.match(h.requests[0].body.prompt, /精细发丝|精细.*织物/);
    assert.ok(h.requests[0].body.prompt.length < 650, `actual prompt: ${h.requests[0].body.prompt.length} chars`);
    assert.doesNotMatch(h.requests[0].body.prompt, /角色卡\/人设原文|身份优先级|风格不等于外貌/);
});

test('large biographies are summarized without inflating the image prompt', async () => {
    const h = harness('拍张自拍');
    h.char.description = '银发、灰色眼睛。' + '喜欢读书，在海边的小城生活。'.repeat(250);
    await h.context.resolveWechatAiGeneratedImage(h.char, h.msg);
    assert.match(h.requests[0].body.prompt, /银发/);
    assert.ok(h.requests[0].body.prompt.length < 850);
});

test('an explicit request against chibi pictures keeps a normal photo and its normal rendering', async () => {
    const h = harness('不要Q版表情包，发普通自拍', '角色本人Q版自画像表情包');
    h.msg.imageKind = 'character-sticker';
    await h.context.resolveWechatAiGeneratedImage(h.char, h.msg);
    assert.equal(h.msg.imageKind, undefined);
    assert.match(h.requests[0].body.prompt, /默认画风：乙女/);
});
