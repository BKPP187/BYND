'use strict';
// Captures the game hub and each mini game on a narrow phone viewport.
// Usage: node scripts/capture-games-browser.cjs <label>   (writes artifacts/games-redesign/<label>/)
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.BYND_PLAYWRIGHT || 'C:/Users/l/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');

const root = path.resolve(__dirname, '..');
const label = process.argv[2] || 'current';
const output = path.join(root, 'artifacts/games-redesign', label);
fs.mkdirSync(output, { recursive: true });
const screens = ['hub', 'catpot', 'chicken', 'jump', 'watersort', '2048', 'gomoku', 'sync', 'cardmatch'];

(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: true });
    const page = await browser.newPage({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 2 });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    try {
        await page.goto(pathToFileURL(path.join(root, 'index.html')).href, { waitUntil: 'domcontentloaded', timeout: 60000 });
        await page.waitForFunction(() => typeof renderGameApp === 'function');
        await page.evaluate(async () => {
            await byndStylesReady;
            localStorage.setItem('bynd_onboarding_v1', JSON.stringify({ status: 'skipped', at: Date.now() }));
            window.ByndOnboarding?.close?.();
            unlockPhone();
            document.documentElement.classList.add('mobile-runtime');
            window.myCharacters = [
                { id: 'g1', name: '温今北', avatar: 'assets/characters/builtin/wenjinbei.jpg' },
                { id: 'g2', name: '商桓', avatar: 'assets/characters/builtin/shanghuan.jpg' }
            ];
            openApp('game');
        });
        await page.locator('#app-game-window.active').waitFor();
        for (const id of screens) {
            await page.evaluate(id => {
                if (id === 'hub') openGameHub();
                else openMiniGame(id);
            }, id);
            await page.waitForTimeout(900);
            await page.screenshot({ path: path.join(output, `${id}.png`) });
            if (id === 'hub') {
                await page.evaluate(() => document.querySelector('#game-content')?.scrollTo?.(0, 640));
                await page.evaluate(() => { const s = document.querySelector('.game-content'); if (s) s.scrollTop = 640; });
                await page.waitForTimeout(300);
                await page.screenshot({ path: path.join(output, 'hub-scrolled.png') });
            }
        }
        await page.evaluate(() => { stopChickenGame?.(false); openGameHub(); });
    } finally {
        await browser.close();
    }
    if (errors.length) console.log('page errors:', errors);
    console.log('saved to', output);
})().catch(error => { console.error(error); process.exit(1); });
