'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.BYND_PLAYWRIGHT || 'C:/Users/l/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'artifacts/pet-studio-ui');
fs.mkdirSync(output, { recursive: true });

(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: true });
    const page = await browser.newPage({ viewport: { width: 375, height: 844 }, isMobile: true, hasTouch: true });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    try {
        await page.addInitScript(() => localStorage.setItem('bynd_builtin_library_seen_v1', '1'));
        await page.goto(pathToFileURL(path.join(root, 'index.html')).href, { waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => window.__byndCoreReady && window.ByndPetStudio);
        await page.waitForFunction(() => !document.documentElement.classList.contains('bynd-web-loading'));
        await page.evaluate(async imageUrl => {
            await window.__byndCoreReady; await window.byndStylesReady;
            unlockPhone(); ByndBuiltinLibrary?.close();
            window.myCharacters = [
                { id: 'studio-cloud', name: '奶油团子', description: '安静温柔，喜欢坐着看书。', chatConfig: {}, history: [] },
                { id: 'studio-friend', name: '小小云朵', description: '喜欢花草和散步。', chatConfig: {}, history: [] }
            ];
            const image = new Image();
            image.src = imageUrl;
            await image.decode();
            const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 768;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#bce2f4'; ctx.fillRect(0, 0, 512, 768);
            const height = 460 * image.naturalHeight / image.naturalWidth;
            ctx.drawImage(image, 26, (768 - height) / 2, 460, height);
            const char = myCharacters[0], C = ByndCharacterPet;
            const referenceKey = await C.storeAsset(char, { url: canvas.toDataURL('image/png'), width: 512, height: 768, kind: 'reference', transparent: false, label: '角色参考' });
            const baseKey = await C.storeAsset(char, { url: image.src, width: image.naturalWidth, height: image.naturalHeight, transparent: true, label: '基础形象' });
            char.chatConfig.characterPet = { referenceKey, baseKey, appearance: '奶油色，圆圆的脸颊。', states: [{ id: 'happy', label: '开心', description: '轻轻微笑', emotion: '愉悦', when: '受到真诚夸奖时', enabled: true, assetKey: baseKey }] };
            await openMonitorPetStudio(char.id);
        }, 'data:image/png;base64,' + fs.readFileSync(path.join(root, 'assets/ui/pet-room/cream-cloud.png')).toString('base64'));
        await page.evaluate(() => document.fonts.ready);
        const studio = page.locator('#bynd-pet-studio');
        for (const scenario of [
            { width: 375, height: 844, safe: 47, parent: false },
            { width: 375, height: 844, safe: 59, parent: false },
            { width: 320, height: 568, safe: 47, parent: false },
            { width: 320, height: 568, safe: 59, parent: false },
            { width: 320, height: 568, safe: 47, parent: true },
            { width: 320, height: 568, safe: 59, parent: true }
        ]) {
            await page.setViewportSize({ width: scenario.width, height: scenario.height });
            await page.evaluate(({ safe, parent }) => {
                const phone = document.querySelector('.phone-container'), host = document.querySelector('#bynd-pet-studio');
                // Parent-reserved iPhone layout: the app begins below the native status bar.
                document.documentElement.classList.add('mobile-runtime');
                document.body.style.paddingTop = parent ? `${safe}px` : '0';
                phone.style.height = parent ? `calc(100dvh - ${safe}px)` : '100dvh';
                host.style.setProperty('--bynd-header-safe-top', `${parent ? 0 : safe}px`);
            }, scenario);
            for (const tab of ['look', 'persona', 'reactions', 'test']) {
                await page.evaluate(tab => ByndPetStudio.tab(tab), tab);
                const bounds = await studio.evaluate(host => {
                    const button = host.querySelector('.bynd-agent-header > button').getBoundingClientRect();
                    const main = host.querySelector('main'), nav = host.querySelector('.pet-tabs');
                    return { background: getComputedStyle(host).backgroundColor, buttonTop: button.top,
                        mainOverflow: main.scrollWidth - main.clientWidth, hostOverflow: host.scrollWidth - host.clientWidth,
                        navWidths: [...nav.querySelectorAll('button')].map(el => el.getBoundingClientRect().width),
                        navOverflow: nav.scrollWidth - nav.clientWidth };
                });
                assert.equal(bounds.background, 'rgb(255, 246, 201)', 'studio must use the current pet palette');
                assert.ok(bounds.mainOverflow <= 1 && bounds.hostOverflow <= 1 && bounds.navOverflow <= 1, JSON.stringify({ scenario, tab, bounds }));
                assert.ok(bounds.buttonTop >= scenario.safe && bounds.buttonTop < scenario.safe + 18, JSON.stringify({ message: 'reserve the top safe area exactly once', scenario, tab, bounds }));
                assert.ok(bounds.navWidths.every(width => width >= 64), 'four tabs must remain touchable');
                if (tab === 'look') {
                    const ratio = await studio.locator('.pet-reference-layout img').evaluate(img => img.clientWidth / img.clientHeight);
                    assert.ok(Math.abs(ratio - 2 / 3) < .015, 'portrait reference must preserve its original ratio');
                }
                if (scenario.width === 375 && scenario.safe === 47 || scenario.width === 320 && scenario.safe === 59)
                    await studio.screenshot({ animations: 'disabled', path: path.join(output, `${tab}-${scenario.width}-${scenario.parent ? 'parent' : 'header'}.png`) });
            }
        }
        await page.setViewportSize({ width: 375, height: 844 });
        await page.evaluate(() => {
            const phone = document.querySelector('.phone-container'); document.body.style.paddingTop = '0'; phone.style.height = '100dvh';
            document.querySelector('#bynd-pet-studio').style.setProperty('--bynd-header-safe-top', '47px');
            ByndPetStudio.tab('look');
        });
        await studio.locator('.pet-pose-extra > summary').click();
        await studio.locator('[data-pet-field="pose"]').fill('坐着看书');
        await studio.locator('.pet-text-button').filter({ hasText: '保存外观与设定' }).click();
        await page.waitForFunction(() => myCharacters[0].chatConfig.characterPet.pose === '坐着看书');
        assert.equal(await studio.locator('.pet-pose-extra').evaluate(el => el.open), true, 'expanded settings remain open after saving');
        await studio.locator('[data-pet-role-trigger="top"]').click();
        await page.locator('.pet-role-search input').fill('小小');
        assert.equal(await page.locator('.pet-role-option').count(), 1);
        await studio.screenshot({ animations: 'disabled', path: path.join(output, 'roles.png') });
        await page.locator('.pet-role-option').click();
        assert.equal(await studio.locator('[data-pet-role-trigger="top"] strong').textContent(), '小小云朵');
        await page.evaluate(() => ByndPetStudio.select('studio-cloud'));
        await studio.locator('.pet-history-entry').click();
        await page.waitForFunction(() => document.querySelectorAll('.pet-history-card').length === 1);
        await page.waitForFunction(() => [...document.querySelectorAll('[data-history-thumb]')].every(img => img.complete && img.naturalWidth));
        for (const scenario of [
            { width: 375, height: 844, safe: 47, parent: false },
            { width: 375, height: 844, safe: 59, parent: false },
            { width: 320, height: 568, safe: 47, parent: false },
            { width: 320, height: 568, safe: 59, parent: false },
            { width: 320, height: 568, safe: 47, parent: true },
            { width: 320, height: 568, safe: 59, parent: true }
        ]) {
            await page.setViewportSize({ width: scenario.width, height: scenario.height });
            await page.evaluate(({ safe, parent }) => {
                document.body.style.paddingTop = parent ? `${safe}px` : '0';
                document.querySelector('.phone-container').style.height = parent ? `calc(100dvh - ${safe}px)` : '100dvh';
                document.querySelector('#bynd-pet-studio').style.setProperty('--bynd-header-safe-top', `${parent ? 0 : safe}px`);
            }, scenario);
            const centers = await page.locator('#pet-history .bynd-agent-header > button').evaluateAll(buttons => buttons.map(button => {
                const box = button.getBoundingClientRect(), icon = button.querySelector('svg').getBoundingClientRect();
                return { top: box.top, width: box.width, height: box.height, iconWidth: icon.width, iconHeight: icon.height,
                    dx: icon.left + icon.width / 2 - box.left - box.width / 2,
                    dy: icon.top + icon.height / 2 - box.top - box.height / 2 };
            }));
            assert.equal(centers.length, 2);
            for (const center of centers) {
                assert.ok(Math.abs(center.dx) < .5 && Math.abs(center.dy) < .5, 'history header icons must be centered inside their buttons');
                assert.deepEqual([center.width, center.height, center.iconWidth, center.iconHeight], [40, 40, 24, 24]);
                assert.ok(center.top >= scenario.safe && center.top < scenario.safe + 18, 'history header must reserve the top safe area exactly once');
            }
            await studio.screenshot({ animations: 'disabled', path: path.join(output, `history-${scenario.width}-${scenario.safe}-${scenario.parent ? 'parent' : 'header'}.png`) });
        }
        await page.setViewportSize({ width: 375, height: 844 });
        await page.evaluate(() => {
            document.body.style.paddingTop = '0';
            document.querySelector('.phone-container').style.height = '100dvh';
            document.querySelector('#bynd-pet-studio').style.setProperty('--bynd-header-safe-top', '47px');
        });
        await studio.screenshot({ animations: 'disabled', path: path.join(output, 'history.png') });
        await page.locator('.pet-history-view').first().click();
        await page.waitForFunction(() => document.querySelector('.pet-history-detail img')?.complete);
        await studio.screenshot({ animations: 'disabled', path: path.join(output, 'history-detail.png') });
        await page.getByRole('button', { name: '返回图片历史', exact: true }).click();
        assert.equal(await page.locator('.pet-history-card').count(), 1);
        await page.getByRole('button', { name: '关闭图片历史', exact: true }).click();
        assert.equal(await page.locator('#pet-history').count(), 0);
        // Exercise the UI error path with a failed persistent write.
        await page.evaluate(() => { window.__studioUpdate = ByndCharacterPet.update; ByndCharacterPet.update = async () => { throw new Error('测试：存储不可用'); }; });
        await studio.locator('[data-pet-field="appearance"]').fill('尚未保存的外观');
        await studio.locator('.pet-text-button').filter({ hasText: '保存外观与设定' }).click();
        await page.waitForFunction(() => document.querySelector('#bynd-pet-studio .pet-error')?.textContent.includes('存储不可用'));
        assert.equal(await page.evaluate(() => myCharacters[0].chatConfig.characterPet.appearance), '奶油色，圆圆的脸颊。');
        await page.evaluate(() => { ByndCharacterPet.update = window.__studioUpdate; ByndPetStudio.close(); });
        assert.equal(await studio.count(), 0);
        assert.deepEqual(errors, []);
        console.log('Studio UI passed: all four tabs across 6 narrow-screen/safe-area scenarios, portrait ratio, save, role picker, history and failed-save feedback.');
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
