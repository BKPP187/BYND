'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.BYND_PLAYWRIGHT || 'C:/Users/l/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = path.resolve(__dirname, '..');
const output = path.join(root, '.qa-screenshots/requested-ui');
fs.mkdirSync(output, { recursive: true });
(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: true });
    const page = await browser.newPage({ viewport: { width: 375, height: 844 }, isMobile: true, hasTouch: true });
    page.setDefaultTimeout(15000);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    try {
        await page.addInitScript(() => localStorage.setItem('bynd_builtin_library_seen_v1', '1'));
        await page.goto(pathToFileURL(path.join(root, 'index.html')).href, { waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => window.__byndCoreReady && typeof openChat === 'function');
        await page.evaluate(async () => {
            await window.__byndCoreReady; await window.byndStylesReady;
            unlockPhone(); ByndBuiltinLibrary?.close();
            document.documentElement.classList.add('mobile-runtime');
            window.myCharacters = [{ id: 'ui-proof', name: '测试', avatar: document.getElementById('wcs-user-avatar').src, chatConfig: {}, history: [] }];
            window.saveCharactersToStorage = async () => true;
        });
        await page.addStyleTag({ content: '.app-window { transition: none !important; }' });
        for (const width of [320, 375, 430]) {
            await page.setViewportSize({ width, height: 844 });
            for (const safe of [47, 59]) {
                for (const parentReserved of [false, true]) {
                    await page.evaluate(({ safe, parentReserved }) => {
                        document.body.style.paddingTop = parentReserved ? `${safe}px` : '0px';
                        const phone = document.querySelector('.phone-container');
                        phone.style.height = `${844 - (parentReserved ? safe : 0)}px`;
                        phone.style.setProperty('--bynd-header-safe-top', parentReserved ? '0px' : `${safe}px`);
                    }, { safe, parentReserved });
                    for (const app of ['money', 'moon']) {
                        await page.evaluate(app => { document.querySelectorAll('.app-window.active').forEach(win => win.classList.remove('active')); openApp(app); }, app);
                        await page.waitForFunction(id => document.getElementById(id).classList.contains('active'), `app-${app}-window`);
                        const measured = await page.locator(`#app-${app}-window`).evaluate((host, app) => {
                            const header = host.querySelector(app === 'money' ? '.money-topbar' : '.moon-header');
                            const title = header.children[1].getBoundingClientRect();
                            const button = header.querySelector('button').getBoundingClientRect();
                            const svg = header.querySelector('.moon-back-icon')?.getBoundingClientRect();
                            const cx = box => box.x + box.width / 2;
                            const cy = box => box.y + box.height / 2;
                            return { titleCenter: cx(title), top: Math.min(title.top, button.top), overflow: host.scrollWidth - host.clientWidth,
                                glyphX: svg ? cx(svg) - cx(button) : 0, glyphY: svg ? cy(svg) - cy(button) : 0 };
                        }, app);
                        assert.ok(Math.abs(measured.titleCenter - width / 2) < 1, JSON.stringify({ width, safe, app, measured }));
                        assert.ok(measured.top >= safe, JSON.stringify({ width, safe, app, measured }));
                        assert.ok(measured.overflow <= 1);
                        assert.ok(Math.abs(measured.glyphX) < 1 && Math.abs(measured.glyphY) < 1, 'Moon SVG must share the button center');
                        if (!parentReserved && safe === 47) await page.screenshot({ path: path.join(output, `${app}-${width}.png`), animations: 'disabled' });
                    }
                }
            }
        }
        await page.evaluate(() => {
            document.body.style.paddingTop = '0px';
            document.querySelector('.phone-container').style.height = '844px';
            document.querySelector('.phone-container').style.setProperty('--bynd-header-safe-top', '32px');
            const history = [];
            for (const type of ['transfer', 'redpacket']) for (const isMe of [false, true]) {
                for (const state of ['pending', 'received', 'returned']) history.push({ type, isMe, amount: '1.00',
                    content: '', title: '恭喜发财，大吉大利', timestamp: Date.now(), receipt: state === 'received', returned: state === 'returned' });
            }
            myCharacters[0].history = history;
            document.querySelectorAll('.app-window.active').forEach(win => win.classList.remove('active'));
            openApp('wechat'); selectWechatUiTheme('pixel'); openChat('ui-proof');
        });
        await page.locator('#wechat-chat-room.active').waitFor();
        assert.equal(await page.locator('#wc-msg-input').getAttribute('placeholder'), 'BEYOND THE SCREEN');
        for (const width of [320, 375, 430]) {
            await page.setViewportSize({ width, height: 844 });
            const styles = await page.locator('#chat-room-content .msg-pay-bubble').evaluateAll(elements => elements.map(el => {
                const style = getComputedStyle(el), icon = getComputedStyle(el.querySelector('.msg-pay-icon'));
                return { background: style.backgroundColor, gradient: style.backgroundImage, radius: style.borderRadius,
                    color: getComputedStyle(el.querySelector('.msg-pay-title')).color, icon: icon.backgroundImage,
                    footer: getComputedStyle(el.querySelector('.msg-card-footer')).backgroundColor, overflow: el.scrollWidth - el.clientWidth };
            }));
            assert.equal(styles.length, 12);
            for (const style of styles) {
                assert.equal(style.background, 'rgb(214, 214, 217)'); assert.equal(style.gradient, 'none');
                assert.equal(style.radius, '0px'); assert.equal(style.color, 'rgb(41, 38, 84)');
                assert.match(style.icon, /pixel-chat\/(transfer|redpacket)\.svg/); assert.equal(style.footer, 'rgb(195, 195, 197)');
                assert.ok(style.overflow <= 1);
            }
            await page.evaluate(() => { myCharacters[0].history = myCharacters[0].history.filter(msg => !msg.receipt && !msg.returned); openChat('ui-proof'); });
            await page.screenshot({ path: path.join(output, `pixel-payments-${width}.png`), animations: 'disabled' });
            await page.evaluate(() => {
                const base = myCharacters[0].history;
                myCharacters[0].history = base.flatMap(msg => [msg, { ...msg, receipt: true }, { ...msg, returned: true }]); openChat('ui-proof');
            });
        }
        await page.evaluate(() => selectWechatUiTheme('wechat'));
        assert.notEqual(await page.locator('#wc-msg-input').getAttribute('placeholder'), 'BEYOND THE SCREEN');
        // The native camera Activity is verified separately; desktop headless capture has no OS camera.
        const cameraInput = page.locator('#bynd-system-camera-input');
        assert.equal(await cameraInput.getAttribute('capture'), 'environment');
        assert.equal(await cameraInput.getAttribute('accept'), 'image/*');
        await cameraInput.setInputFiles([]);
        assert.equal(await page.locator('#bynd-camera-recipient-modal').count(), 0, 'Canceled photo selection never opens a send dialog');
        assert.deepEqual(errors, []);
        console.log('Money/Moon centering passed 24 safe-area cases; 12 payment states match pixel grey at three widths; theme switching and canceled camera selection passed.');
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
