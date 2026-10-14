'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), http = require('node:http');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.BYND_PLAYWRIGHT || 'C:/Users/l/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = path.resolve(__dirname, '..');
const edit = JSON.parse(fs.readFileSync(path.join(root, 'assets/characters/builtin/shanghuan-debut-edit.json'), 'utf8'));
assert.equal(edit.shots[0].file, 'mmexport1791374622370.mp4');
assert.deepEqual(edit.subtitles, []);
assert.deepEqual(edit.sections.map(section => section.phase), ['op', 'pv']);
const pen = edit.shots.find(shot => shot.cue === 'pen');
const glasses = edit.shots.find(shot => shot.cue === 'glasses');
assert.equal(pen.phase, 'op');
assert.equal(glasses.phase, 'op');
assert.ok(pen.frames >= 24 && glasses.frames >= 48, 'both requested actions remain visible');
assert.equal(Math.round(pen.start * 24), 36, 'the pen insert excludes the two lab portrait frames');
assert.equal(Math.round(glasses.start * 24), 65, 'glasses removal excludes the preceding suit portrait');
const ending = edit.shots.at(-1);
assert.equal(ending.cue, 'ending');
assert.equal(ending.file, 'mmexport1791552185053.mp4');
assert.equal(ending.start, 0);
assert.equal(ending.frames, edit.replacement.fullSourceFrames, 'retain the complete washing, drying and leaning sequence');
assert.ok(ending.frames / edit.fps >= 9.7, 'the final stay-and-eat line finishes before the clip ends');
assert.equal(edit.replacement.continuous, true);
assert.equal(edit.shots.filter(shot => shot.file === ending.file).length, 1, 'do not split or repeat the regenerated ending');
assert.ok(!edit.shots.some(shot => ['mmexport1791293487185.mp4', 'mmexport1791293533927.mp4'].includes(shot.file)), 'the old flashed handoff and inconsistent ending are replaced');
assert.ok(edit.audio.kitchenPrelap > 0, 'kitchen sound precedes the kitchen image');
assert.ok(edit.transitions.some(transition => transition.type === 'pendant-dissolve' && transition.duration > 0));
const originalOpShots = edit.shots.filter(shot => shot.file === 'mmexport1791374622370.mp4');
assert.equal(originalOpShots.reduce((sum, shot) => sum + shot.frames, 0), 215, 'retain original OP apart from the unwanted desk/lab transition');
for (const shot of originalOpShots) {
    const start = Math.round(shot.start * 24), end = start + shot.frames;
    assert.ok(end <= 36 || start >= 62, 'the ink-bottle flash frames must not be used');
}
const pvStart = edit.sections[1].start;
assert.equal(edit.audio.originalOpMusicRemoved, true);
assert.equal(edit.audio.music.continuous, true);
assert.equal(edit.audio.music.loops, 0);
assert.equal(edit.audio.music.dialogueDucking, true);
const output = path.join(root, '.qa-screenshots/character-debut');
fs.mkdirSync(output, { recursive: true });
const server = http.createServer((req, res) => {
    const file = path.resolve(root, '.' + new URL(req.url, 'http://localhost').pathname);
    if (!file.startsWith(root + path.sep)) return res.writeHead(403).end();
    if (!fs.existsSync(file)) return res.writeHead(404).end();
    const size = fs.statSync(file).size;
    const type = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.mp4': 'video/mp4', '.jpg': 'image/jpeg' }[path.extname(file)] || 'application/octet-stream';
    const range = req.headers.range?.match(/^bytes=(\d+)-(\d*)$/);
    const start = range ? Number(range[1]) : 0;
    const end = range && range[2] ? Math.min(Number(range[2]), size - 1) : size - 1;
    res.writeHead(range ? 206 : 200, { 'Content-Type': type, 'Content-Length': end - start + 1, 'Accept-Ranges': 'bytes', ...(range ? { 'Content-Range': `bytes ${start}-${end}/${size}` } : {}) });
    fs.createReadStream(file, { start, end }).pipe(res);
});
(async () => {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const browser = await chromium.launch({ channel: 'msedge', headless: true });
    const report = { layouts: [], checks: [], errors: [] };
    try {
        const page = await browser.newPage({ viewport: { width: 375, height: 844 }, isMobile: true, hasTouch: true });
        await page.route('https://**/*', route => route.abort());
        page.on('pageerror', error => report.errors.push(error.message));
        await page.addInitScript(version => {
            localStorage.setItem('bynd_lastSeenVersion', version);
            localStorage.setItem('bynd_builtin_library_prompted_v1', '1');
        }, require('./bump-version.cjs').currentVersion());
        async function boot(url) {
            await page.goto(url, { waitUntil: 'domcontentloaded' });
            await page.waitForFunction(() => window.__byndCoreReady && window.ByndCharacterDebut);
            await page.evaluate(async () => {
                await window.__byndCoreReady; await byndStylesReady;
                unlockPhone(); openApp('wechat'); ByndBuiltinLibrary.close();
            });
        }
        async function fresh() {
            await page.evaluate(async () => {
                ByndCharacterDebut.close(); closeChat(); ByndBuiltinLibrary.close();
                window.myCharacters = []; window.currentChatCharId = null;
                localStorage.removeItem('bynd_character_debut_shanghuan_v1');
                await saveCharactersToStorage();
                openApp('wechat'); ByndBuiltinLibrary.open();
            });
        }
        async function pick() {
            await page.locator('button[onclick="ByndBuiltinLibrary.pick(\'shanghuan\')"]').click();
        }
        await boot(`http://127.0.0.1:${server.address().port}/index.html`);
        await fresh();
        await pick();
        await page.waitForSelector('#bynd-character-debut');
        await page.waitForFunction(() => document.querySelector('#bynd-character-debut video').currentTime > 0.3);
        assert.equal(await page.evaluate(() => window.currentChatCharId), null);
        await page.screenshot({ path: path.join(output, 'op-first-375.png') });
        await page.waitForFunction(time => document.querySelector('#bynd-character-debut video')?.currentTime > time, pen.timelineStart + 0.45);
        assert.equal(await page.evaluate(() => window.currentChatCharId), null, 'pen action is part of OP before chat navigation');
        await page.screenshot({ path: path.join(output, 'portrait-pen-375.png') });
        await page.waitForFunction(time => document.querySelector('#bynd-character-debut video')?.currentTime > time, glasses.timelineStart + 1);
        await page.screenshot({ path: path.join(output, 'portrait-glasses-375.png') });
        await page.waitForFunction(pvStart => document.querySelector('#bynd-character-debut video')?.currentTime > pvStart + 2, pvStart);
        assert.equal(await page.evaluate(() => window.currentChatCharId), null, 'OP bridges into kitchen PV before chat navigation');
        await page.screenshot({ path: path.join(output, 'pv-after-op-375.png') });
        // Let the actual packaged H.264/AAC clip end; an ended event must open the newly saved chat.
        await page.waitForFunction(() => !document.getElementById('bynd-character-debut') && !!window.currentChatCharId, null, { timeout: 45000 });
        assert.equal(await page.locator('#chat-room-title').innerText(), '商桓');
        assert.equal(await page.evaluate(() => myCharacters[0].builtinDebutSeen), true);
        await page.waitForTimeout(500);
        await page.screenshot({ path: path.join(output, 'chat-after-debut-375.png') });
        await page.reload({ waitUntil: 'domcontentloaded' });
        await page.evaluate(async () => { await __byndCoreReady; unlockPhone(); openApp('wechat'); openChat(myCharacters[0].id); });
        assert.equal(await page.evaluate(() => myCharacters[0].builtinDebutSeen), true, 'the debut marker survives actual serialization and reload');
        assert.equal(await page.locator('#bynd-character-debut').count(), 0);
        report.checks.push('actual first add → OP with pen/glasses → bridged kitchen PV → real video end → chat; reload and reopen never replay');

        for (const width of [320, 375, 430]) for (const safe of [47, 59]) for (const owner of ['parent', 'header']) {
            await page.setViewportSize({ width, height: 844 });
            await page.evaluate(({ safe, owner }) => {
                document.documentElement.classList.add('mobile-runtime');
                document.body.style.paddingTop = owner === 'parent' ? `${safe}px` : '0px';
                const phone = document.querySelector('.phone-container');
                phone.style.setProperty('--bynd-header-safe-top', owner === 'header' ? `${safe}px` : '0px');
                phone.style.height = owner === 'parent' ? `${844 - safe}px` : '844px';
                window._preview = ByndCharacterDebut.play(myCharacters[0]);
            }, { safe, owner });
            await page.waitForFunction(() => document.querySelector('#bynd-character-debut video').readyState >= 2);
            await page.evaluate(pvStart => { const v = document.querySelector('#bynd-character-debut video'); v.pause(); v.currentTime = pvStart + 8; }, pvStart);
            await page.waitForTimeout(1000);
            const bounds = await page.locator('.bynd-debut-controls').evaluate(layer => [...layer.querySelectorAll('button')].map(button => {
                const r = button.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, height: r.height };
            }));
            assert.ok(bounds.every(r => r.top >= safe + 10 && r.top < safe + 20 && r.left >= 0 && r.right <= width && r.height >= 44), JSON.stringify({ width, safe, owner, bounds }));
            report.layouts.push({ width, safe, owner, bounds });
            if (width === 375 && safe === 59) await page.screenshot({ path: path.join(output, `debut-375-${owner}.png`) });
            await page.locator('.bynd-debut-skip').click();
        }
        report.checks.push('12 safe-area layouts, no double top spacing; skip cleans up player');

        await fresh();
        await page.evaluate(() => { window._originalSave = saveCharactersToStorage; saveCharactersToStorage = async () => false; });
        await pick();
        await page.waitForFunction(() => document.querySelector('.bynd-builtin-status').textContent.includes('没有保存成功'));
        assert.equal(await page.locator('#bynd-character-debut').count(), 0);
        assert.equal(await page.evaluate(() => myCharacters.length), 0);
        assert.equal(await page.evaluate(() => localStorage.getItem('bynd_character_debut_shanghuan_v1')), null);
        await page.evaluate(() => { saveCharactersToStorage = window._originalSave; });
        await pick();
        await page.waitForSelector('#bynd-character-debut');
        await page.locator('.bynd-debut-skip').click();
        await page.waitForFunction(() => !!currentChatCharId);
        report.checks.push('failed save rolls back and retains debut eligibility on retry');

        await fresh();
        await page.route('**/shanghuan-debut.mp4*', route => route.abort());
        await pick();
        await page.waitForFunction(() => !!currentChatCharId);
        assert.equal(await page.locator('#bynd-character-debut').count(), 0);
        await page.unroute('**/shanghuan-debut.mp4*');
        report.checks.push('missing media reports failure and still opens saved chat');

        await fresh();
        await page.evaluate(() => {
            window._originalPlay = HTMLMediaElement.prototype.play;
            window._playCalls = 0;
            HTMLMediaElement.prototype.play = function() {
                window._playCalls++;
                if (!this.muted) return Promise.reject(new DOMException('test autoplay restriction', 'NotAllowedError'));
                return window._originalPlay.call(this);
            };
        });
        await pick();
        await page.waitForFunction(() => document.querySelector('#bynd-character-debut video')?.currentTime > 0.2);
        assert.equal(await page.locator('.bynd-debut-sound').innerText(), '开启声音');
        assert.ok(await page.evaluate(() => _playCalls >= 2));
        await page.locator('.bynd-debut-skip').click();
        await page.evaluate(() => { HTMLMediaElement.prototype.play = _originalPlay; });
        report.checks.push('audio autoplay restriction falls back to muted inline playback');

        await fresh();
        await page.evaluate(() => { HTMLMediaElement.prototype.play = () => Promise.reject(new DOMException('blocked', 'NotAllowedError')); });
        await pick();
        await page.waitForSelector('.bynd-debut-resume:not([hidden])');
        await page.locator('.bynd-debut-resume').click();
        await page.waitForSelector('.bynd-debut-resume:not([hidden])');
        await page.keyboard.press('Escape');
        await page.waitForFunction(() => !!currentChatCharId);
        await page.evaluate(() => { HTMLMediaElement.prototype.play = _originalPlay; });
        report.checks.push('fully blocked autoplay offers tap-to-play and Escape/skip');

        await fresh();
        await pick();
        await page.waitForSelector('#bynd-character-debut');
        await page.evaluate(() => closeApp('wechat'));
        await page.waitForTimeout(400);
        assert.equal(await page.locator('#bynd-character-debut').count(), 0);
        assert.equal(await page.evaluate(() => currentChatCharId), null);
        report.checks.push('closing WeChat cancels video and navigation');

        await boot(pathToFileURL(path.join(root, 'index.html')).href);
        await fresh(); await pick();
        await page.waitForFunction(() => document.querySelector('#bynd-character-debut video')?.currentTime > 0.3);
        await page.locator('.bynd-debut-skip').click();
        await page.waitForFunction(() => !!currentChatCharId);
        report.checks.push('file:// package plays and routes successfully');
        assert.deepEqual(report.errors, []);
        fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
        console.log(JSON.stringify(report, null, 2));
    } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error); process.exitCode = 1; });
