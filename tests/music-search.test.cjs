const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { memoryStorage, deferred, sourceSection } = require('./helpers/harness.cjs');

const ppSong = { id: 1492362609, name: '如何 (From "แปลรักฉันด้วยใจเธอ")', ar: [{ name: 'PP Krit' }], al: { name: '如何', picUrl: 'https://example.org/cover.jpg' }, dt: 200000 };
const workerSource = fs.readFileSync('workers/bynd-netease-audio-worker.js', 'utf8');
const workerModule = import('data:text/javascript;base64,' + Buffer.from(workerSource).toString('base64'));

test('NetEase worker searches song metadata with bounded parameters and keeps unrelated paths blocked', async () => {
    const { default: worker } = await workerModule;
    const original = global.fetch;
    const calls = [];
    global.fetch = async target => {
        calls.push(new URL(target));
        return Response.json({ code: 200, result: { songs: [ppSong], songCount: 1 } });
    };
    try {
        for (const path of ['search', 'cloudsearch']) {
            const response = await worker.fetch(new Request(`https://bynd.ccwu.cc/netease/api/${path}?keywords=${encodeURIComponent('如何 PP Krit')}&limit=500&offset=-5`), {});
            assert.equal(response.status, 200);
            assert.equal(response.headers.get('access-control-allow-origin'), '*');
            assert.equal((await response.json()).result.songs[0].id, ppSong.id);
            const target = calls.at(-1);
            assert.equal(target.origin, 'https://music.163.com');
            assert.equal(target.pathname, '/api/search/get/web');
            assert.equal(target.searchParams.get('s'), '如何 PP Krit');
            assert.equal(target.searchParams.get('limit'), '50');
            assert.equal(target.searchParams.get('offset'), '0');
        }
        assert.equal((await (await worker.fetch(new Request('https://bynd.ccwu.cc/netease/api/search?keywords='), {})).json()).code, 400);
        assert.equal(calls.length, 2, 'invalid keywords never reach upstream');
        assert.equal((await worker.fetch(new Request('https://bynd.ccwu.cc/netease/api/arbitrary'), {})).status, 403);
        global.fetch = async () => Response.json({ code: 200 });
        assert.equal((await (await worker.fetch(new Request('https://bynd.ccwu.cc/netease/api/search?keywords=pp'), {})).json()).code, 502);
    } finally { global.fetch = original; }
});

function setup() {
    const nodes = {
        'wc-compose-music-query': { value: '如何' },
        'wc-compose-music-status': { textContent: '' },
        'wc-compose-music-results': { innerHTML: '' },
        'wc-composer-modal': { dataset: {} }
    };
    const context = vm.createContext({ window: {}, localStorage: memoryStorage(), document: { getElementById: id => nodes[id] || null },
        location: { protocol: 'file:', hostname: '', origin: 'null' }, URL, URLSearchParams, AbortController, setTimeout, clearTimeout,
        console, normalizeWechatUrl: value => /^https?:\/\//.test(value || '') ? value : '', wcEscapeHtml: value => String(value || ''),
        createMessageTimestamp: () => 1, syncWechatMessageDescription: msg => msg, fetch: async () => { throw new Error('offline'); }
    });
    for (const file of ['music', 'netease', 'wechat-music']) vm.runInContext(fs.readFileSync(`apps/music/${file}.js`, 'utf8'), context);
    vm.runInContext(sourceSection('systems/memory/wechat-memory.js', 'function buildWechatSpecialMessageFromComposer(', 'function submitWechatComposer('), context);
    return { context, window: context.window, nodes };
}

const jsonResponse = data => ({ ok: true, text: async () => JSON.stringify(data), json: async () => data });

test('native search keeps PP Krit metadata without pretending a missing audio URL is playable', async () => {
    const { context, window, nodes } = setup();
    context.fetch = async url => {
        if (url.includes('/netease/api/search')) return jsonResponse({ code: 200, result: { songs: [ppSong], songCount: 1 } });
        if (url.includes('/song/url')) return jsonResponse({ code: 200, data: [{ id: ppSong.id, url: null }] });
        if (url.includes('advancedsearch')) return jsonResponse({ response: { docs: [] } });
        return jsonResponse([]);
    };
    await context.searchWechatMusicForComposer();
    assert.equal(window._wechatMusicComposeResults.length, 1);
    assert.equal(window._wechatMusicComposeResults[0].artist, 'PP Krit');
    assert.match(nodes['wc-compose-music-results'].innerHTML, /如何/);
    await context.selectWechatMusicComposeTrack(0);
    assert.equal(window._wechatMusicComposeSelected.audioUrl, '');
    assert.match(nodes['wc-compose-music-status'].textContent, /登录或受版权限制/);
    assert.equal(context.buildWechatSpecialMessageFromComposer('music_card'), null, 'unavailable audio cannot be sent');
    context.fetch = async url => jsonResponse({ code: 200, data: [{ id: ppSong.id, url: 'https://example.org/authorized.mp3' }] });
    await context.selectWechatMusicComposeTrack(0);
    assert.equal(context.buildWechatSpecialMessageFromComposer('music_card').music.audioUrl, 'https://example.org/authorized.mp3');
});

test('Archive search checks titles and artists rather than returning recordings with matching full text', async () => {
    const { context } = setup();
    assert.equal(context.matchesArchiveMusicQuery({ trackName: 'Reading 1 Volume 6', artistName: 'Lemoness' }, 'pp'), false);
    assert.equal(context.matchesArchiveMusicQuery({ trackName: 'Happy song', artistName: 'Apple' }, 'pp'), false);
    assert.equal(context.matchesArchiveMusicQuery({ trackName: '如何', artistName: 'PP Krit' }, 'pp'), true);
    assert.equal(context.matchesArchiveMusicQuery({ trackName: '如何', artistName: 'PP Krit' }, '如何 PP'), true);
    const queries = [];
    context.fetch = async value => {
        const url = new URL(value); queries.push(url);
        if (url.pathname.includes('advancedsearch')) return jsonResponse({ response: { docs: [{ identifier: 'unrelated', title: 'Reading' }] } });
        return jsonResponse({ metadata: { title: 'Reading', creator: 'Lemoness' }, files: [{ name: 'reading.mp3', format: 'MP3' }] });
    };
    assert.equal((await context.searchInternetArchiveMusic('pp')).length, 0);
    assert.equal(queries[0].searchParams.get('q'), '(title:"pp" OR creator:"pp") AND mediatype:audio');
});

test('composer keeps source errors visible and distinguishes an empty successful search', async () => {
    const { context, window, nodes } = setup();
    await context.searchWechatMusicForComposer();
    assert.equal(window._wechatMusicComposeResults.length, 0);
    assert.match(nodes['wc-compose-music-status'].textContent, /连接失败/);
    context.fetch = async url => url.includes('/netease/api/search')
        ? jsonResponse({ code: 200, result: { songs: [], songCount: 0 } })
        : url.includes('advancedsearch') ? jsonResponse({ response: { docs: [] } }) : jsonResponse([]);
    await context.searchWechatMusicForComposer();
    assert.match(nodes['wc-compose-music-status'].textContent, /没有搜到这首歌/);
    window.searchNeteaseMusic = async () => { throw new Error('403'); };
    vm.runInContext('searchMetingMusic = async () => [normalizeMusicTrack({trackName:"如何", artistName:"PP Krit", audioUrl:"https://example.org/song.mp3"})]', context);
    await context.searchWechatMusicForComposer();
    assert.equal(window._wechatMusicComposeResults.length, 1);
    assert.match(nodes['wc-compose-music-status'].textContent, /部分音乐源连接失败/);
});

test('a slower previous search cannot overwrite the newest query results', async () => {
    const { context, window, nodes } = setup();
    const old = deferred();
    window.searchAcrossMusicSources = query => query === '如何' ? old.promise : Promise.resolve([{ trackName: '新搜索', artistName: '歌手', audioUrl: 'https://example.org/new.mp3' }]);
    const first = context.searchWechatMusicForComposer();
    nodes['wc-compose-music-query'].value = '新搜索';
    await context.searchWechatMusicForComposer();
    old.resolve([{ trackName: '旧搜索', audioUrl: 'https://example.org/old.mp3' }]);
    await first;
    assert.equal(window._wechatMusicComposeResults[0].title, '新搜索');
});
