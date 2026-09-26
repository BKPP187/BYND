const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'apps/comic/comic.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const route = fs.readFileSync(path.join(root, 'script.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'apps/comic/ui/comic.css'), 'utf8');

function setup(fetch, extra = {}) {
    const context = vm.createContext({ window: { myCharacters: [] }, document: {}, TextEncoder, Uint8Array, DataView, Blob, console, fetch, ...extra });
    vm.runInContext(source, context);
    return context.window.ByndComic;
}

test('comic is reachable from desktop and chat settings with its own app window', () => {
    assert.match(html, /data-app-id="comic"[^>]*openApp\('comic'\)/);
    assert.match(html, /id="app-comic-window"/);
    assert.match(html, /ByndComic\.fromChat\(getCurrentChatChar\(\)\?\.id\)/);
    assert.match(route, /else if \(appName === 'comic'\)/);
    assert.match(route, /openDreamRecordInComic/);
    assert.match(fs.readFileSync(path.join(root, 'systems/living-world/living-world.js'), 'utf8'), /comicCurrentPost/);
});

test('every work type has its own canvas, panel range, layout and planner rule', () => {
    const { TYPES, SHOTS, planSystemPrompt } = setup()._test;
    assert.deepEqual(Object.keys(TYPES), ['webtoon', 'yonkoma', 'illust', 'photo', 'couple', 'wallpaper', 'poster', 'special']);
    for (const [key, type] of Object.entries(TYPES)) {
        assert.ok(type.panels[0] >= 1 && type.panels[1] >= type.panels[0], key);
        if (type.fixedShot) assert.ok(SHOTS[type.fixedShot], key);
        const prompt = planSystemPrompt(key, type.defaultPanels, 'novelai');
        assert.match(prompt, new RegExp(`作品类型：${type.label}`));
    }
    assert.equal(TYPES.yonkoma.panels.join('-'), '4-4');
    assert.equal(TYPES.wallpaper.fixedShot, 'phone');
    assert.match(planSystemPrompt('yonkoma', 4, 'api'), /起、承、转、合/);
    // Every canvas fits NovelAI's free Opus tier (<= 1024x1024 pixels, multiples of 64).
    for (const shot of Object.values(SHOTS)) {
        assert.ok(shot.nai[0] * shot.nai[1] <= 1024 * 1024);
        assert.equal(shot.nai[0] % 64, 0);
        assert.equal(shot.nai[1] % 64, 0);
    }
});

test('NovelAI storyboards ask for tags with interaction prefixes; relay storyboards ask for prose', () => {
    const { planSystemPrompt } = setup()._test;
    const nai = planSystemPrompt('couple', 1, 'novelai');
    assert.match(nai, /Danbooru/);
    assert.match(nai, /source# \/ target# \/ mutual#/);
    assert.match(nai, /不要自我审查/);
    assert.match(nai, /"scene":"English base tags"/);
    const api = planSystemPrompt('webtoon', 8, 'api');
    assert.match(api, /中文自然语言/);
    assert.match(api, /"prompt":"中文完整画面描述"/);
    assert.match(api, /"episodeTitle"/);
    assert.doesNotMatch(planSystemPrompt('poster', 1, 'api'), /"episodeTitle"/);
});

test('invalid storyboard cannot be accepted as a generated chapter', () => {
    const { validatePlan } = setup()._test;
    assert.throws(() => validatePlan({ panels: [] }, 'webtoon'), /6 到 10 格/);
    assert.throws(() => validatePlan({ panels: [{ beat: '门开了', prompt: 'x' }] }, 'webtoon', 'api'), /只给出了 1 格/);
    const four = validatePlan({ panels: Array.from({ length: 6 }, (_, i) => ({ beat: `格${i}`, shot: 'tall', prompt: '画面' })) }, 'yonkoma', 'api');
    assert.equal(four.panels.length, 4);
    assert.ok(four.panels.every(panel => panel.shot === 'wide'));
    // NovelAI panels without any tags are dropped instead of drawing an empty prompt.
    assert.throws(() => validatePlan({ panels: [{ beat: '只有剧情' }] }, 'illust', 'novelai'), /只给出了 0 格/);
    const single = validatePlan({ title: '雨夜', panels: [{ beat: '他撑伞', scene: '1boy, 1girl, rain, night', chars: [{ who: 'char', tags: 'source#holding umbrella', x: 2, y: -1 }], bubbles: [{ who: 'sfx', kind: 'speech', text: '哗' }, { who: 'char', text: '' }] }] }, 'illust', 'novelai');
    assert.equal(single.panels[0].chars[0].x, 0.9);
    assert.equal(single.panels[0].chars[0].y, 0.1);
    assert.equal(single.panels[0].bubbles.length, 1);
    assert.equal(single.panels[0].bubbles[0].kind, 'sfx');
    assert.equal(single.panels[0].imageKey, '');
    const prose = validatePlan({ panels: [{ beat: '拥抱' }] }, 'couple', 'api');
    assert.equal(prose.panels[0].prompt, '拥抱');
});

test('version 1 books upgrade in place: dialogue becomes a caption bubble', () => {
    const { upgradeBook } = setup()._test;
    const book = upgradeBook({ id: 's', chapters: [{ id: 'c', panels: [{ id: 'p', description: '门开了', dialogue: '你来了', prompt: 'door', imageKey: 'img' }] }] });
    assert.equal(book.type, 'webtoon');
    const panel = book.chapters[0].panels[0];
    assert.equal(panel.beat, '门开了');
    assert.equal(panel.shot, 'tall');
    assert.equal(panel.bubbles[0].kind, 'caption');
    assert.equal(panel.bubbles[0].text, '你来了');
    assert.equal(book.chapters[0].comments.length, 0);
});

test('NovelAI panel input carries fixed appearance, style tags and the type canvas', () => {
    const { naiInput } = setup()._test;
    const input = naiInput({ type: 'wallpaper', styleKey: 'film', cast: { char: 'boy, black hair, grey eyes', user: 'girl, long brown hair' } }, {
        shot: 'phone', scene: '1boy, 1girl, night, city lights', seed: 42,
        chars: [{ who: 'char', tags: 'source#hug, smile', x: 0.3, y: 0.5 }, { who: 'user', tags: 'target#hug', x: 0.7, y: 0.5 }]
    });
    assert.equal(input.width, 704);
    assert.equal(input.height, 1472);
    assert.equal(input.seed, 42);
    assert.match(input.prompt, /^1boy, 1girl, night, city lights, film grain/);
    assert.equal(input.characters[0].prompt, 'boy, black hair, grey eyes, source#hug, smile');
    assert.equal(input.characters[1].prompt, 'girl, long brown hair, target#hug');
    assert.deepEqual(JSON.parse(JSON.stringify(input.dropNegative)), ['negative space', 'film grain']);
});

test('relay prompts keep both appearances and forbid drawn text', () => {
    const { apiPrompt } = setup()._test;
    const text = apiPrompt({ type: 'photo', style: '水彩', charName: '温今北', userName: '我', cast: { char: '黑发灰眼', user: '棕色长发' } }, { prompt: '两人在海边自拍', beat: '' });
    assert.match(text, /温今北：黑发灰眼/);
    assert.match(text, /像真实拍下的合影照片/);
    assert.match(text, /不要文字、不要对话气泡/);
});

test('typeset HTML follows the layout of each work type', () => {
    const { pieceHtml, autoPlaceBubbles } = setup()._test;
    const panel = (id, extra = {}) => ({ id, beat: id, shot: 'tall', gutter: 'pause', tone: 'dark', imageKey: '', bubbles: [], chars: [], ...extra });
    const strip = pieceHtml({ type: 'webtoon', title: 'T', charName: 'A', userName: 'B' }, { panels: [panel('p1'), panel('p2')], createdAt: 0 });
    assert.equal((strip.match(/class="ct-gutter tone-dark" style="height:128px"/g) || []).length, 1, 'no gutter after the last panel');
    const poster = pieceHtml({ type: 'poster', title: '作品', charName: 'A', userName: 'B' }, { panels: [panel('p')], poster: { title: '夜航', tagline: '去见你' }, createdAt: 0 });
    assert.match(poster, /<strong>夜航<\/strong><em>去见你<\/em>/);
    const photo = pieceHtml({ type: 'photo', title: '合影', charName: 'A', userName: 'B' }, { panels: [panel('p', { shot: 'square' })], caption: '海边的第一天', createdAt: 0 });
    assert.match(photo, /ct-polaroid[\s\S]*海边的第一天/);
    const speaking = panel('talk', { chars: [{ who: 'char', x: 0.7 }], bubbles: [{ id: 'b1', who: 'narration', kind: 'narration', text: '那天' }, { id: 'b2', who: 'char', kind: 'speech', text: '过来' }] });
    autoPlaceBubbles(speaking);
    assert.deepEqual([speaking.bubbles[0].x, speaking.bubbles[0].y], [0.04, 0.03]);
    assert.equal(speaking.bubbles[1].x, 0.5, 'a speaker on the right gets a right-side bubble');
    const out = pieceHtml({ type: 'webtoon', title: 'T', charName: 'A', userName: 'B' }, { panels: [speaking], createdAt: 0 });
    assert.match(out, /ct-bubble kind-speech who-char tail-right" data-bubble="b2" style="left:50\.00%;top:5\.00%"/);
});

test('bubble CSS uses the same panel-relative sizes as the canvas export', () => {
    assert.match(source, /const BUBBLE = \{ font: 0\.0385, lineHeight: 1\.42, padX: 0\.034, padY: 0\.022, maxWidth: 0\.46, narrationWidth: 0\.62, sfxFont: 0\.085 \}/);
    assert.match(css, /max-width: 46cqw;\s*padding: 2\.2cqw 3\.4cqw;/);
    assert.match(css, /font-size: 3\.85cqw;\s*font-weight: 600;\s*line-height: 1\.42;/);
    assert.match(css, /\.ct-bubble\.kind-narration, \.ct-bubble\.kind-caption \{ max-width: 62cqw;/);
    assert.match(css, /\.ct-panel-art \{[^}]*container-type: inline-size;/);
});

test('comic persistence failure rejects without reporting a saved project', async () => {
    const comic = setup();
    await assert.rejects(comic.storage.put('series', { id: 'x' }), /IndexedDB 不可用/);
});

test('image adapter refuses an HTML success response before storing a panel', async () => {
    const comic = setup(async () => ({ ok: true, blob: async () => new Blob(['<html>not an image</html>'], { type: 'text/html' }) }));
    await assert.rejects(comic._test.durableImage('https://example.test/fake-image'), /不支持的图片格式/);
});

test('chapter ZIP contains full original files and valid directory offsets', async () => {
    const comic = setup();
    const files = [
        { name: '001.png', bytes: Uint8Array.from([137, 80, 78, 71, 1, 2]) },
        { name: '002.jpg', bytes: Uint8Array.from([255, 216, 8, 7, 255, 217]) }
    ];
    const bytes = Buffer.from(await comic._test.makeZip(files).arrayBuffer());
    for (const file of files) {
        const local = bytes.indexOf(Buffer.from(file.name));
        assert.ok(local > 0);
        assert.deepEqual(bytes.subarray(local + file.name.length, local + file.name.length + file.bytes.length), Buffer.from(file.bytes));
    }
    assert.equal(bytes.readUInt32LE(bytes.length - 22), 0x06054b50);
    assert.equal(bytes.readUInt16LE(bytes.length - 12), 2);
    const centralOffset = bytes.readUInt32LE(bytes.length - 6);
    assert.equal(bytes.readUInt32LE(centralOffset), 0x02014b50);
});

test('PDF exporter writes a complete page tree and trailer', async () => {
    const comic = setup();
    const bytes = Buffer.from(await comic._test.makePdf([{ width: 320, height: 480, bytes: Uint8Array.from([255, 216, 255, 217]) }]).arrayBuffer());
    const pdf = bytes.toString('latin1');
    assert.match(pdf, /^%PDF-1\.4/);
    assert.match(pdf, /\/Count 1/);
    assert.match(pdf, /\/MediaBox \[0 0 320 480\]/);
    assert.match(pdf, /\/Filter \/DCTDecode/);
    assert.match(pdf, /startxref\n\d+\n%%EOF$/);
});

test('long work runs as a background job and reloads the book before writing', () => {
    assert.match(source, /async function withJob\(kind, bookId, chapterId, fn\)/);
    assert.match(source, /case 'generate': if \(inJob\) return; launch\(\(\) => startGeneration\(state\.seriesId, state\.chapterId\)\); return editor\(\);/);
    // The plan reply is applied to a freshly loaded copy, not the one read before the chat call.
    assert.match(source, /if \(!result\?\.ok\) throw new Error\(result\?\.error \|\| '分镜生成失败'\);\n        const plan = validatePlan\(parseJson\(result\.content\), draftBook\.type, provider\);\n        plan\.panels\.forEach\(autoPlaceBubbles\);\n        const book = upgradeBook\(await get\('series', bookId\)\);/);
});
