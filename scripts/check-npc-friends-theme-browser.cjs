'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.BYND_PLAYWRIGHT || 'C:/Users/l/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = path.resolve(__dirname, '..');
const phase = process.env.BYND_NPC_THEME_PHASE === 'before' ? 'before' : 'after';
const output = path.join(root, 'artifacts/npc-theme-audit', phase);
fs.mkdirSync(output, { recursive: true });
(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: true });
    const page = await browser.newPage({ viewport: { width: 375, height: 844 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const checks = [];
    try {
        await page.goto(pathToFileURL(path.join(root, 'index.html')).href);
        await page.waitForFunction(() => !!window.ByndNpcFriends);
        // Tap animations are transient decoration; keep review captures unobscured.
        await page.addStyleTag({ content: '.tapfx-layer { visibility: hidden !important; }' });
        await page.evaluate(async () => {
            await byndStylesReady; await window._wechatCharactersLoadPromise;
            localStorage.setItem('bynd_builtin_library_seen_v1', '1'); unlockPhone();
            window.myCharacters = [];
            openApp('wechat'); ByndBuiltinLibrary?.close();
            switchWcTab('contacts'); renderContacts();
            const phone = document.querySelector('.phone-container');
            phone.style.cssText += ';position:absolute!important;inset:0!important;width:100vw!important;max-width:none!important;height:100dvh!important;max-height:none!important;transform:none!important;border:0!important;border-radius:0!important;margin:0!important;--bynd-header-safe-top:47px;';
        });
        await page.waitForFunction(() => {
            const icon = document.querySelector('.wc-npc-entry i');
            const glyph = icon && getComputedStyle(icon, '::before').content;
            return glyph && glyph !== 'none' && glyph !== 'normal';
        });
        await page.evaluate(async () => { await document.fonts.load('24px remixicon'); await document.fonts.ready; });
        const themes = await page.evaluate(() => WECHAT_UI_THEMES.map(theme => theme.id));
        for (const width of [375, 320]) {
            await page.setViewportSize({ width, height: 844 });
            for (const theme of themes) {
                await page.evaluate(theme => {
                    document.getElementById('bynd-npc-friends')?.remove();
                    window.myCharacters = [];
                    localStorage.setItem(WECHAT_UI_THEME_STORAGE_KEY, theme);
                    applyWechatUiTheme(theme); switchWcTab('contacts'); renderContacts();
                }, theme);
                const appearance = await page.locator('.wc-npc-entry').evaluate(node => {
                    const css = getComputedStyle(node), bounds = node.getBoundingClientRect(), parent = node.parentElement.getBoundingClientRect();
                    return { width: bounds.width, inset: bounds.x - parent.x, height: bounds.height, radius: css.borderRadius, background: css.backgroundColor, shadow: css.boxShadow, blur: css.backdropFilter, color: css.color, overflow: document.getElementById('wc-contacts-list').scrollWidth > document.getElementById('wc-contacts-list').clientWidth };
                });
                assert.equal(appearance.overflow, false, theme + ': contacts fit narrow screen');
                if (phase === 'after' && theme === 'telegram') assert.equal(await page.locator('.wc-telegram-contacts-page > .wc-npc-entry').count(), 1, 'Telegram shortcut is part of its contacts page');
                await page.screenshot({ path: path.join(output, `contacts-empty-${theme}-${width}.png`) });
                if (phase === 'after' && theme === 'couple') {
                    await page.evaluate(() => switchWcTab('discover'));
                    const reference = await page.locator('.wc-discover-item').first().evaluate(node => { const css = getComputedStyle(node); return { radius: css.borderRadius, background: css.backgroundColor, shadow: css.boxShadow, blur: css.backdropFilter }; });
                    assert.ok(appearance.inset >= 12, 'couple entry floats away from the screen edges');
                    for (const field of ['radius', 'background', 'shadow', 'blur']) assert.equal(appearance[field], reference[field], 'couple entry shares discovery glass ' + field);
                    await page.screenshot({ path: path.join(output, `discovery-couple-${width}.png`) });
                    await page.evaluate(() => switchWcTab('contacts'));
                }
                await page.evaluate(() => {
                    window.myCharacters = [{ id: 'theme-source', name: '江闻远', avatar: ByndNpcFriends.defaultAvatars[0], history: [], chatConfig: { worldNpcFriends: { requests: [{ id: 'theme-invitation', status: 'pending', avatar: ByndNpcFriends.defaultAvatars[3], avatarState: 'default', createdAt: Date.now(), card: { name: '谢昭南', description: '江闻远的发小', firstMessage: '你好！', worldBook: [] }, reason: '你好，我是谢昭南，江闻远把你的微信推给我了，来跟你对接一下。', relationship: '江闻远的发小' }] } } }];
                    renderContacts();
                });
                await page.screenshot({ path: path.join(output, `contacts-pending-${theme}-${width}.png`) });
                assert.equal(await page.locator('.wc-npc-entry').count(), 1, 'refresh keeps exactly one shortcut');
                assert.equal(await page.locator('.wc-npc-entry > b').textContent(), '1');
                await page.locator('.wc-npc-entry').click();
                await page.locator('.wc-npc-avatar').evaluate(img => img.decode());
                await page.screenshot({ path: path.join(output, `inbox-${theme}-${width}.png`) });
                await page.locator('[data-npc-action="detail"]').click();
                await page.screenshot({ path: path.join(output, `detail-${theme}-${width}.png`) });
                assert.equal(await page.locator('#bynd-npc-friends').evaluate(node => node.scrollWidth > node.clientWidth), false);
                checks.push({ theme, viewport: width, ...appearance });
            }
        }
        fs.writeFileSync(path.join(output, 'appearance.json'), JSON.stringify(checks, null, 2));
        assert.deepEqual(errors, []);
        console.log(`NPC theme ${phase} audit passed: ${themes.length} themes, 320/375px, empty/pending contacts, inbox and detail.`);
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
