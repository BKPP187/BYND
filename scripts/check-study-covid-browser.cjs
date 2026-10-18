// Regression for the user's image-only bilingual vocabulary PDF.
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const {chromium} = require(process.env.BYND_PLAYWRIGHT || 'C:/Users/l/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = path.resolve(__dirname,'..');
const output = path.join(root,'artifacts/study-import/covid');
fs.mkdirSync(output,{recursive:true});
(async()=>{
    const file = process.argv[2];
    if(!file) throw new Error('Usage: node scripts/check-study-covid-browser.cjs <PDF>');
    const browser = await chromium.launch({channel:'msedge',headless:true});
    try {
        const page = await browser.newPage({viewport:{width:375,height:844}});
        await page.goto(pathToFileURL(path.join(root,'index.html')).href,{waitUntil:'domcontentloaded'});
        await page.waitForFunction(()=>window.ByndStudyPdf&&window.ByndStudy);
        await page.evaluate(async()=>{
            await byndStylesReady;unlockPhone();document.documentElement.classList.add('mobile-runtime');
            localStorage.setItem('bynd_study_languages_v1',JSON.stringify([{id:'cn',label:'中文'},{id:'th',label:'ไทย'}]));
            openApp('study');ByndStudy.setTab('words');ByndStudy.openPdfImport();ByndStudy.setPdfOption('targetId','th');
        });
        await page.locator('#study-import-file').setInputFiles(file);
        await page.getByRole('button',{name:'识别并预览',exact:true}).click();
        await page.waitForFunction(()=>!document.querySelector('.study-status[data-tone="busy"]'),{},{timeout:900000});
        const status = await page.locator('.study-status').innerText();
        const count = await page.locator('.study-import-row').count();
        await page.screenshot({path:path.join(output,'result.png'),animations:'disabled'});
        console.log(JSON.stringify({file:path.basename(file),status,count}));
        assert.ok(count>0,'actual PDF must produce a vocabulary preview: '+status);
        const preview=await page.evaluate(()=>Array.from(document.querySelectorAll('.study-import-row')).map(row=>({term:row.querySelector('[data-import-term]').value,meaning:row.querySelectorAll('input[type="text"]')[1].value})));
        assert.ok(preview.some(word=>word.term==='ไข้หวัดใหญ่'&&word.meaning==='流感'),'real OCR must pair influenza with its Thai term');
        fs.writeFileSync(path.join(output,'preview.json'),JSON.stringify(preview,null,2));
        await page.locator('.study-import').screenshot({path:path.join(output,'preview.png'),animations:'disabled'});
        const before=await page.evaluate(()=>getStudyCards().length);
        const saved=await page.evaluate(()=>ByndStudy.savePdfImport());
        assert.equal(saved,true);
        const added=await page.evaluate(()=>getStudyCards().filter(card=>card.source==='pdf').length);
        assert.ok(added>0);
        assert.ok(await page.evaluate(()=>getStudyCards().length)>before);
        assert.match(await page.locator('.study-status').innerText(),/已导入/);
        await page.screenshot({path:path.join(output,'saved.png'),animations:'disabled'});
        console.log(JSON.stringify({saved:true,added,status:await page.locator('.study-status').innerText()}));
    } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
