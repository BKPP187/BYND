'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.BYND_PLAYWRIGHT || 'C:/Users/l/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'artifacts/pet-cute-ui');
fs.mkdirSync(output, { recursive: true });
const mascot = 'data:image/png;base64,' + fs.readFileSync(path.join(root, 'assets/ui/pet-room/cream-cloud.png')).toString('base64');

(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: true });
    const context = await browser.newContext({ viewport: { width: 375, height: 844 }, isMobile: true, hasTouch: true });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('https://**/*', route => /codex-pets|api\//.test(route.request().url()) ? route.abort() : route.continue());
    try {
        await page.addInitScript(() => localStorage.setItem('bynd_builtin_library_seen_v1', '1'));
        await page.goto(pathToFileURL(path.join(root, 'index.html')).href, { waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => window.__byndCoreReady && window.ByndPetWorkspace);
        await page.waitForFunction(() => !document.documentElement.classList.contains('bynd-web-loading'));
        await page.evaluate(async imageUrl => {
            await window.__byndCoreReady;
            await window.byndStylesReady;
            unlockPhone(); ByndBuiltinLibrary?.close();
            window.myCharacters = [{ id: 'cute-ui-character', name: '奶油团子', description: '安静温柔，喜欢坐着看书。', chatConfig: {}, history: [] }];
            // The UI fixture must not make delayed scene requests to a real chat API.
            ByndCharacterPet.observeScene = () => {};
            const image = new Image(); image.src = imageUrl;
            await image.decode();
            const canvas = document.createElement('canvas'); canvas.width = 96 * 8; canvas.height = 104;
            const ctx = canvas.getContext('2d');
            const frameHeight = 90 * image.naturalHeight / image.naturalWidth;
            for (let frame = 0; frame < 8; frame++) ctx.drawImage(image, frame * 96 + (frame % 3) * 3, (104 - frameHeight) / 2, 90, frameHeight);
            const strip = canvas.toDataURL('image/webp');
            const pet = normalizeMonitorPet({ id: 'cute-ui-cloud', displayName: '奶油团子', ownerName: 'UI 测试素材', posterDataUrl: strip, tags: ['可爱', '日常'], description: '浏览器验证用素材', viewCount: 23, likeCount: 8 });
            saveMonitorPetLibrary([pet]);
            const key = await ByndCharacterPet.storeAsset(myCharacters[0], { url: image.src, width: image.naturalWidth, height: image.naturalHeight, transparent: true });
            myCharacters[0].chatConfig.characterPet = { active: true, baseKey: key, states: [] };
            setMonitorPetBoundChar('cute-ui-character');
            localStorage.setItem('bynd_monitor_active_pet_v1', pet.id);
            localStorage.setItem('bynd_monitor_pet_enabled_v1', '1');
            monitorPetResults = [pet, normalizeMonitorPet({ ...pet, id: 'cute-ui-cloud-2', displayName: '小小云朵' })];
            monitorPetLoading = false; monitorPetStatus = '找到 2 个测试素材，当前第 1 / 1 页。';
            openApp('pet'); ByndPetWorkspace.navigate('pet');
            window.requestMonitorPetReaction = async () => {
                ByndCharacterPet.reset(myCharacters[0]);
                myCharacters[0].chatConfig.monitorPetState = { bubbleText: '这是测试回应。', bubbleAt: Date.now() };
            };
        }, mascot);
        await page.evaluate(() => document.fonts.ready);
        await page.waitForFunction(() => {
            const host = document.querySelector('#app-pet-window');
            const shell = host.querySelector('.mh-shell');
            const transform = getComputedStyle(host).transform;
            return getComputedStyle(host).position === 'absolute' && shell.getBoundingClientRect().height > 500 && (transform === 'none' || new DOMMatrixReadOnly(transform).m42 === 0);
        });
        assert.equal(await page.locator('#pet-toolbar .mh-pet-nav-icon').count(), 4);
        await page.waitForFunction(() => [...document.querySelectorAll('#pet-toolbar .mh-pet-nav-icon')].every(img => img.complete && img.naturalWidth > 0));
        assert.deepEqual(await page.locator('#pet-toolbar .mh-pet-nav-icon').evaluateAll(images => images.map(img => Math.round(img.getBoundingClientRect().width))), [36, 36, 36, 36]);
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
                const host = document.querySelector('#app-pet-window');
                host.style.boxSizing = 'border-box';
                host.style.setProperty('--bynd-header-safe-top', `${parent ? 0 : safe}px`);
                host.style.paddingTop = parent ? `${safe}px` : '0px';
                ByndPetWorkspace.navigate('pet');
            }, scenario);
            const measurements = await page.evaluate(() => {
                const host = document.querySelector('#app-pet-window');
                const top = host.querySelector('.mh-topbar').getBoundingClientRect();
                const back = host.querySelector('[data-mh-action="back"]').getBoundingClientRect();
                const nav = host.querySelector('.mh-nav').getBoundingClientRect();
                const scene = host.querySelector('.mh-room-scene').getBoundingClientRect();
                const action = host.querySelector('.mh-room-actions').getBoundingClientRect();
                const character = host.querySelector('.mh-room-character').getBoundingClientRect();
                return { height: host.getBoundingClientRect().height, overflow: host.scrollWidth - host.clientWidth, hostTop: host.getBoundingClientRect().top, backTop: back.top, topBottom: top.bottom, navTop: nav.top, navBottom: nav.bottom, bottom: host.getBoundingClientRect().bottom, sceneTop: scene.top, actionBottom: action.bottom, characterHeight: character.height };
            });
            assert.ok(measurements.overflow <= 2, JSON.stringify({ scenario, measurements }));
            assert.ok(measurements.height > 500, JSON.stringify({ scenario, measurements }));
            assert.ok(measurements.backTop >= measurements.hostTop + scenario.safe, JSON.stringify({ scenario, measurements }));
            assert.ok(measurements.backTop < measurements.hostTop + scenario.safe + 20, 'safe area must be reserved only once');
            assert.ok(measurements.sceneTop >= measurements.topBottom, 'scene must start below the header');
            assert.ok(measurements.navBottom <= measurements.bottom + 2, 'navigation must stay inside the app');
            assert.ok(measurements.navBottom - measurements.navTop <= 72, 'navigation should use the compact height');
            assert.ok(measurements.actionBottom <= measurements.navTop + 2, JSON.stringify({ scenario, measurements }));
            assert.ok(measurements.characterHeight >= 75, 'character needs visible space on short screens');
            const iconSizes = await page.locator('#pet-toolbar .mh-pet-nav-icon').evaluateAll(images => images.map(img => { const rect = img.getBoundingClientRect(); return [Math.round(rect.width), Math.round(rect.height)]; }));
            assert.deepEqual(iconSizes, [[36, 36], [36, 36], [36, 36], [36, 36]], 'navigation icons must retain square proportions on narrow screens');
            assert.equal(await page.locator('.mh-room-dialogue p').count(), 0, 'idle display should not show a prompt or empty dialogue box');
            await page.locator('#app-pet-window').screenshot({ animations: 'disabled', path: path.join(output, `home-${scenario.width}-${scenario.safe}-${scenario.parent ? 'parent' : 'header'}.png`) });
            if (scenario.width === 375 && scenario.safe === 47 && !scenario.parent) await page.locator('#pet-toolbar').screenshot({ animations: 'disabled', path: path.join(output, 'navigation-actual.png') });
            await page.evaluate(() => ByndPetWorkspace.navigate('library'));
            assert.equal(await page.locator('#app-pet-window .mh-pet-scrapbook').count(), 2);
            await page.waitForFunction(() => document.querySelectorAll('.mh-photo-small .monitor-pet-media.is-ready').length === 8);
            const samples = await page.locator('.mh-pet-scrapbook').first().locator('.mh-photo-small svg image').evaluateAll(images => images.map(img => img.getAttribute('x')));
            assert.deepEqual(samples, ['0', '-192', '-384', '-672']);
            assert.equal(await page.evaluate(() => document.querySelector('#app-pet-window').scrollWidth - document.querySelector('#app-pet-window').clientWidth), 0);
            await page.locator('#app-pet-window').screenshot({ animations: 'disabled', path: path.join(output, `library-${scenario.width}-${scenario.safe}-${scenario.parent ? 'parent' : 'header'}.png`) });
        }
        await page.setViewportSize({ width: 375, height: 844 });
        await page.evaluate(() => { const host = document.querySelector('#app-pet-window'); host.style.paddingTop = '0'; host.style.setProperty('--bynd-header-safe-top', '47px'); ByndPetWorkspace.navigate('pet'); });
        await page.locator('.mh-room-actions [data-mh-action="pet-interact"]').click();
        assert.equal(await page.locator('.mh-room-dialogue p').textContent(), '这是测试回应。');
        await page.locator('#pet-companion-settings > summary').click();
        assert.equal(await page.locator('#pet-companion-settings').evaluate(el => el.open), true);
        await page.locator('#mh-pet-history').click();
        await page.waitForFunction(() => document.querySelectorAll('#pet-history .pet-history-card').length === 1);
        const headerCenters = await page.locator('#pet-history .bynd-agent-header > button').evaluateAll(buttons => buttons.map(button => {
            const box = button.getBoundingClientRect(), icon = button.querySelector('svg').getBoundingClientRect();
            return [Math.round(box.width), Math.round(box.height), icon.left + icon.width / 2 - box.left - box.width / 2, icon.top + icon.height / 2 - box.top - box.height / 2];
        }));
        assert.equal(headerCenters.length, 2);
        headerCenters.forEach(([width, height, dx, dy]) => {
            assert.deepEqual([width, height], [40, 40]);
            assert.ok(Math.abs(dx) < .5 && Math.abs(dy) < .5, 'history header icons must also be centered when opened from the pet home');
        });
        await page.locator('#pet-history .bynd-agent-header').screenshot({ animations: 'disabled', path: path.join(output, 'history-header-actual.png') });
        await page.getByRole('button', { name: '返回我的桌宠', exact: true }).click();
        assert.equal(await page.locator('#pet-history').count(), 0);
        await page.locator('[aria-label="显示当前桌宠"]').click();
        assert.equal(await page.locator('#pet-companion-settings').evaluate(el => el.open), true, 'settings must stay open after a saved change');
        assert.equal(await page.locator('[aria-label="显示当前桌宠"]').getAttribute('aria-checked'), 'false');
        assert.equal(await page.evaluate(() => isMonitorPetEnabled()), false);
        await page.evaluate(() => ByndPetWorkspace.navigate('library'));
        await page.locator('.mh-pet-scrapbook [data-monitor-pet-operation="preview"]').first().click();
        assert.equal(await page.locator('#pet-layer-host [role="dialog"]').count(), 1);
        await page.locator('#pet-sheet-close').click();
        await page.evaluate(() => {
            saveMonitorPetLibrary([]); localStorage.removeItem('bynd_monitor_active_pet_v1');
            myCharacters[0].chatConfig.characterPet = {};
            ByndPetWorkspace.navigate('pet');
        });
        assert.equal(await page.locator('.mh-empty-pet-art').count(), 1);
        await page.waitForFunction(() => document.querySelector('.mh-empty-pet-art img')?.naturalWidth === 1327);
        assert.ok((await page.locator('.mh-empty-pet-art img').getAttribute('src')).includes('cream-cloud.png'));
        await page.locator('#app-pet-window').screenshot({ animations: 'disabled', path: path.join(output, 'regenerated-cloud-in-app.png') });
        await page.locator('.mh-room-actions [data-mh-action="pet-interact"]').click();
        assert.equal(await page.locator('#pet-tool-panel').getAttribute('data-tool'), 'library');
        assert.deepEqual(errors, []);
        console.log('Pet UI: 6 narrow-screen/safe-area scenarios, real strip samples, preview, interaction, display switch and empty-state routing passed.');
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
