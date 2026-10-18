'use strict';
const assert = require('node:assert/strict'), path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.BYND_PLAYWRIGHT || 'C:/Users/l/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: true });
    try {
        const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
        await page.route('https://**/*', route => route.abort());
        await page.goto(pathToFileURL(path.resolve(__dirname, '../index.html')).href, { waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => window.__byndCoreReady && typeof renderApiList === 'function' && typeof renderWidget === 'function');
        const result = await page.evaluate(async () => {
            await window.__byndCoreReady; await byndStylesReady;
            localStorage.setItem('boundary-canary', 'fixture-only'); window.__boundaryReads = [];
            const attack = "window.__boundaryReads.push(localStorage.getItem('boundary-canary'))";
            const image = `broken" onerror="${attack}`;
            const markup = `"><img src="broken" onerror="${attack}">`;
            const id = `quoted'"\n&${markup}`;
            const api = { id, name: '测试接口', model: 'fixture-model', baseUrl: 'https://fixture.example/v1', _status: markup };
            const priorGet = getApiData, priorRoute = renderApiRoutePanel, priorOpen = openApiModal;
            let selected = null;
            try {
                getApiData = () => ({ apis: [api], defaultId: id }); renderApiRoutePanel = () => {}; openApiModal = value => { selected = value; };
                renderApiList();
                document.querySelector('.api-card-info').click();
            } finally { getApiData = priorGet; renderApiRoutePanel = priorRoute; openApiModal = priorOpen; }
            const route = document.createElement('div'); route.id = 'boundary-route';
            route.innerHTML = renderApiRoutePicker('chat', api, [api], id); document.body.appendChild(route);
            renderWidget(1, 'photo', { img: image });
            const shop = document.createElement('div'); shop.id = 'boundary-shop';
            shop.innerHTML = renderWechatShopTextCover({ name: '测试商品', gradient: `red${markup}` }); document.body.appendChild(shop);
            const priorPresets = getPresetData, priorExpand = togglePresetExpand, priorFonts = getFontStore;
            let selectedPreset = null;
            try {
                getPresetData = () => ({ presets: [{ id, name: '测试预设', temperature: markup, max_tokens: markup, top_p: markup, prompts: [{ name: '提示词', role: markup, content: '普通内容', enabled: true }] }], activeId: id });
                window._expandedPresetId = id; togglePresetExpand = value => { selectedPreset = value; };
                renderPresetList(); document.querySelector('.preset-card-header').click();
                getFontStore = () => ({ fonts: [{ id: `font-" onmouseover="${attack}`, name: '测试字体' }] });
                renderFontDropdown();
                document.querySelectorAll('#font-select [onmouseover]').forEach(el => el.dispatchEvent(new MouseEvent('mouseover')));
            } finally { getPresetData = priorPresets; togglePresetExpand = priorExpand; getFontStore = priorFonts; }
            initIconGrid(); localStorage.setItem('my_theme_data', JSON.stringify({ icons: [image] })); loadSavedSettings();
            await new Promise(resolve => setTimeout(resolve, 120));
            return { reads: __boundaryReads, selected, selectedPreset, id, apiCount: document.querySelectorAll('.api-card').length, escapedQuotes: escapeHtml('"\'&<>'), themeQuotes: themeEscapeHtml('"\'&<>') };
        });
        assert.deepEqual(result.reads, [], 'API/preset/font metadata, desktop images and product gradients must not inject host handlers');
        assert.equal(result.selected, result.id, 'quoted API identifiers are passed as data without evaluating them');
        assert.equal(result.selectedPreset, result.id, 'quoted preset identifiers are passed as data');
        assert.equal(result.apiCount, 1);
        assert.equal(result.escapedQuotes, '&quot;&#39;&amp;&lt;&gt;'); assert.equal(result.themeQuotes, result.escapedQuotes);
        console.log('API/preset/font metadata, desktop images and shop gradients cannot read the host canary; quoted identifiers still work.');
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
