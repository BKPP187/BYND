'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.BYND_PLAYWRIGHT || 'C:/Users/l/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = path.resolve(__dirname, '..');
const output = path.join(root, '.qa-screenshots/forum-news');
fs.mkdirSync(output, { recursive:true });
const news = { id:'news_proof', title:'News photos and source references', source:'Test publisher', url:'https://news-proof.example/story', provider:'GDELT', publishedAt:Date.now(), content:'[Open accessibility guide](https://news-proof.example/accessibility)\n[Skip to content](https://news-proof.example/story#content)', description:'A publisher summary while the article is loading.' };
const article = '[Skip to content](https://news-proof.example/story#content)\n'.repeat(50) + '# ' + news.title + '\n\nThe article excerpt should start here, after the publisher navigation.\n\n![正文配图](https://news-proof.example/photo.png)\n\nRead the [source report](https://news-proof.example/report).\n\n![无法加载的图片](https://news-proof.example/missing.png)\n\nA long reference should wrap on a narrow screen: [https://news-proof.example/' + 'reference'.repeat(20) + '](https://news-proof.example/report).';
(async () => {
    const browser = await chromium.launch({ channel:'msedge', headless:true });
    const page = await browser.newPage({ viewport:{ width:375, height:844 }, isMobile:true, hasTouch:true });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('https://**/*', async route => {
        const url = route.request().url();
        if (url.startsWith('https://r.jina.ai/')) return route.fulfill({ json:{ data:{ content:article } } });
        if (url === 'https://news-proof.example/photo.png') return route.fulfill({ contentType:'image/png', body:fs.readFileSync(path.join(root,'assets/website/bynd-companion.png')) });
        if (url === 'https://news-proof.example/missing.png') return route.fulfill({ status:404, body:'' });
        return route.abort();
    });
    try {
        await page.addInitScript(news => {
            localStorage.setItem('bynd_builtin_library_seen_v1','1');
            localStorage.setItem('bynd_living_world_v1',JSON.stringify({ newsItems:[news], newsFetchedAt:Date.now(), migration:{ apiGenerated:true } }));
        }, news);
        await page.goto(pathToFileURL(path.join(root,'index.html')).href, { waitUntil:'domcontentloaded' });
        await page.waitForFunction(() => window.__byndCoreReady && window.LivingWorld);
        await page.evaluate(async () => {
            await window.__byndCoreReady; await window.byndStylesReady;
            unlockPhone(); window.ByndBuiltinLibrary?.close();
            document.documentElement.classList.add('mobile-runtime');
            openApp('living-world'); await window._byndForumOpenPromise;
            LivingWorld.openNews('news_proof');
        });
        await page.locator('.lw-news-inline-media img').first().waitFor();
        await page.waitForFunction(() => document.querySelector('.lw-news-inline-media img')?.naturalWidth > 0);
        await page.addStyleTag({ content:'.app-window { transition:none !important; }' });
        assert.doesNotMatch(await page.locator('.lw-news-article').innerText(), /Skip to content|Open accessibility guide|!\[/);
        assert.equal(await page.locator('.lw-news-article a').first().getAttribute('href'),'https://news-proof.example/report');
        await page.waitForFunction(() => document.querySelectorAll('.lw-news-inline-media')[1]?.hidden);
        const measurements = [];
        for (const width of [320,375,430]) for (const safe of [47,59]) for (const parentReserved of [false,true]) {
            await page.setViewportSize({ width, height:844 });
            await page.evaluate(({ safe,parentReserved }) => {
                document.body.style.paddingTop = parentReserved ? `${safe}px` : '0px';
                const phone = document.querySelector('.phone-container');
                phone.style.height = `${844 - (parentReserved ? safe : 0)}px`;
                phone.style.setProperty('--bynd-header-safe-top',parentReserved ? '0px' : `${safe}px`);
                document.querySelector('.lw-main').scrollTop = 0;
            }, { safe,parentReserved });
            const measured = await page.locator('.lw-shell').evaluate(shell => {
                const header = shell.querySelector('.lw-topbar'), article = shell.querySelector('.lw-news-article');
                const image = article.querySelector('img').getBoundingClientRect(), articleBox = article.getBoundingClientRect();
                return { controlTop:header.querySelector('button').getBoundingClientRect().top,
                    overflow:shell.scrollWidth - shell.clientWidth, articleOverflow:article.scrollWidth - article.clientWidth,
                    imageLeft:image.left, imageRight:image.right, articleLeft:articleBox.left, articleRight:articleBox.right };
            });
            assert.ok(measured.controlTop >= safe && measured.controlTop < safe + 25,JSON.stringify({ width,safe,parentReserved,measured }));
            assert.ok(measured.overflow <= 1 && measured.articleOverflow <= 1,JSON.stringify(measured));
            assert.ok(measured.imageLeft >= measured.articleLeft && measured.imageRight <= measured.articleRight + 1);
            measurements.push({ width,safe,parentReserved,...measured });
            if (safe === 59 && !parentReserved) await page.screenshot({ path:path.join(output,`news-${width}.png`), animations:'disabled' });
        }
        assert.deepEqual(errors,[]);
        fs.writeFileSync(path.join(output,'geometry.json'),JSON.stringify(measurements,null,2));
        console.log('News Markdown, cache repair, loaded/broken images and link wrapping passed; 12 narrow-screen safe-area cases passed. Screenshots: ' + output);
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
