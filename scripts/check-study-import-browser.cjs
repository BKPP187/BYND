'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.BYND_PLAYWRIGHT || 'C:/Users/l/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = path.resolve(__dirname, '..'), output = path.join(root, 'artifacts/study-import');
fs.mkdirSync(output, { recursive: true });
function pdfFixture() {
    const stream = 'BT /F1 18 Tf 40 750 Td (apple) Tj 150 0 Td (fruit) Tj -150 -30 Td (banana) Tj 150 0 Td (yellow) Tj ET';
    const objects = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>', '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 600 800] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>', '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>', `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`];
    let body = '%PDF-1.4\n', offsets = [0];
    objects.forEach((object, index) => { offsets.push(Buffer.byteLength(body)); body += `${index+1} 0 obj\n${object}\nendobj\n`; });
    const xref = Buffer.byteLength(body);
    body += `xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map(n => String(n).padStart(10, '0') + ' 00000 n \n').join('')}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
    return Buffer.from(body);
}
// Minimal stored ZIP for a synthetic Unicode DOCX table; no external fixture dependency.
function docxFixture() {
    const crc32 = data => { let c = -1; for (const b of data) { c ^= b; for (let i=0; i<8; i++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1)); } return (c ^ -1) >>> 0; };
    const entries = {
        '[Content_Types].xml': '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
        '_rels/.rels': '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
        'word/document.xml': '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:tbl>' + [['สวัสดี','你好'], ['ขอบคุณ','谢谢']].map(row => '<w:tr>' + row.map(text => '<w:tc><w:p><w:r><w:t>'+text+'</w:t></w:r></w:p></w:tc>').join('') + '</w:tr>').join('') + '</w:tbl></w:body></w:document>'
    };
    const local = [], central = []; let offset = 0;
    for (const [name, text] of Object.entries(entries)) {
        const nameBytes = Buffer.from(name), data = Buffer.from(text), crc = crc32(data), head = Buffer.alloc(30), dir = Buffer.alloc(46);
        head.writeUInt32LE(0x04034b50); head.writeUInt16LE(20,4); head.writeUInt32LE(crc,14); head.writeUInt32LE(data.length,18); head.writeUInt32LE(data.length,22); head.writeUInt16LE(nameBytes.length,26);
        dir.writeUInt32LE(0x02014b50); dir.writeUInt16LE(20,4); dir.writeUInt16LE(20,6); dir.writeUInt32LE(crc,16); dir.writeUInt32LE(data.length,20); dir.writeUInt32LE(data.length,24); dir.writeUInt16LE(nameBytes.length,28); dir.writeUInt32LE(offset,42);
        local.push(head,nameBytes,data); central.push(dir,nameBytes); offset += head.length+nameBytes.length+data.length;
    }
    const directory = Buffer.concat(central), end = Buffer.alloc(22);
    end.writeUInt32LE(0x06054b50); end.writeUInt16LE(central.length/2,8); end.writeUInt16LE(central.length/2,10); end.writeUInt32LE(directory.length,12); end.writeUInt32LE(offset,16);
    return Buffer.concat([...local,directory,end]);
}
(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: true });
    const page = await browser.newPage({ viewport: { width: 375, height: 844 }, deviceScaleFactor: 1 });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    try {
        await page.goto(pathToFileURL(path.join(root, 'index.html')).href, { waitUntil: 'domcontentloaded', timeout: 60000 });
        await page.waitForFunction(() => !!window.ByndStudyPdf && !!window.ByndStudy);
        await page.evaluate(async () => {
            await byndStylesReady; unlockPhone(); document.documentElement.classList.add('mobile-runtime');
            localStorage.setItem('bynd_study_languages_v1', JSON.stringify([{ id:'cn',label:'中文' },{ id:'th',label:'ไทย' },{ id:'en',label:'English' }]));
            openApp('study'); ByndStudy.setTab('words'); ByndStudy.openPdfImport(); ByndStudy.setPdfOption('targetId','en');
        });
        await page.locator('#study-import-file').setInputFiles({ name: 'words.pdf', mimeType: 'application/pdf', buffer: pdfFixture() });
        await page.getByRole('button', { name: '识别并预览', exact: true }).click();
        await page.locator('[data-import-term="0"]').waitFor();
        assert.equal(await page.locator('[data-import-term="0"]').inputValue(), 'apple');
        await page.getByRole('button', { name: '导入所选 2 条', exact: true }).click();
        assert.equal(await page.evaluate(() => getStudyCards().filter(card => card.source === 'pdf').length), 2);
        await page.evaluate(() => { ByndStudy.openPdfImport(); ByndStudy.setPdfOption('targetId','th'); });
        await page.locator('#study-import-file').setInputFiles({ name: '泰语词汇.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', buffer: docxFixture() });
        await page.getByRole('button', { name: '识别并预览', exact: true }).click();
        await page.locator('[data-import-term="0"]').waitFor();
        assert.equal(await page.locator('[data-import-term="0"]').inputValue(), 'สวัสดี');
        assert.equal(await page.locator('.study-import-row').first().locator('input[type="text"]').nth(1).inputValue(), '你好');
        for (const width of [320,375]) for (const safe of [47,59]) for (const parentReserves of [false,true]) {
            await page.setViewportSize({ width, height: 844 });
            const layout = await page.evaluate(({ safe, parentReserves }) => {
                const phone = document.querySelector('.phone-container');
                phone.style.setProperty('--bynd-header-safe-top', parentReserves ? '0px' : safe+'px');
                phone.style.setProperty('height', (844 - (parentReserves ? safe : 0))+'px', 'important');
                document.body.style.setProperty('padding-top', parentReserves ? safe+'px' : '0px', 'important');
                const app = document.getElementById('app-study-window'), header = app.querySelector('.study-topbar').getBoundingClientRect();
                const control = app.querySelector('.study-topbar button').getBoundingClientRect(), content = app.querySelector('.study-content').getBoundingClientRect();
                return { overflow: app.scrollWidth > app.clientWidth, controlTop: control.top, headerBottom:header.bottom, contentTop:content.top };
            }, { safe, parentReserves });
            assert.equal(layout.overflow, false);
            assert.ok(layout.controlTop >= safe, JSON.stringify(layout));
            assert.ok(layout.contentTop >= layout.headerBottom);
            await page.screenshot({ path: path.join(output, `preview-${width}-${safe}-${parentReserves?'parent':'header'}.png`), animations:'disabled' });
        }
        const before = await page.evaluate(() => getStudyCards().length);
        await page.evaluate(() => {
            const original = Storage.prototype.setItem;
            Storage.prototype.setItem = function(key,value) { if(key==='bynd_study_cards_v1')throw new Error('模拟磁盘已满');return original.call(this,key,value); };
            try { ByndStudy.savePdfImport(); } finally { Storage.prototype.setItem = original; }
        });
        assert.match(await page.locator('.study-status').innerText(), /导入没有保存.*模拟磁盘已满/);
        assert.equal(await page.evaluate(() => getStudyCards().length), before);
        assert.equal(await page.locator('.study-import-row').count(), 2);
        await page.getByRole('button', { name:'导入所选 2 条', exact:true }).click();
        assert.equal(await page.evaluate(() => getStudyCards().length), before+2);
        const report = [];
        // Optional real user files, read only; no samples are copied into the repository.
        for (const name of process.argv.slice(2)) {
            const bytes = fs.readFileSync(name);
            const result = await page.evaluate(async ({ bytes, name }) => {
                try { const result = await ByndStudyPdf.read(new File([Uint8Array.from(bytes)],name),{from:1,to:2,targetId:'th',nativeId:'cn'}); return { pages:result.pages, count:result.words.length, sample:result.words.slice(0,8) }; }
                catch(error) { return {error:error.message}; }
            }, { bytes:Array.from(bytes), name:path.basename(name) });
            if (result.error && /扫描版 PDF/.test(result.error)) {
                const scan = await page.evaluate(async ({bytes,name}) => {
                    const original = window.callChatApi;
                    let imageUrl = '', calls = 0;
                    window.callChatApi = async messages => {
                        calls++; imageUrl = messages[0].content.find(part=>part.type==='image_url')?.image_url?.url || '';
                        return {ok:true,content:'{"words":[{"term":"ทดสอบ","meaning":"测试占位"}]}'};
                    };
                    try {
                        const recognized = await ByndStudyPdf.read(new File([Uint8Array.from(bytes)],name),{from:1,to:1,ai:true,targetId:'th',nativeId:'cn',targetLabel:'ไทย',nativeLabel:'中文'});
                        return {imageUrl,calls,count:recognized.words.length};
                    } finally {window.callChatApi = original;}
                },{bytes:Array.from(bytes),name:path.basename(name)});
                assert.equal(scan.calls,1); assert.equal(scan.count,1); assert.ok(scan.imageUrl.length>5000,'real scan rendered and supplied to the mocked vision API');
                fs.writeFileSync(path.join(output,'real-scan-render.jpg'),Buffer.from(scan.imageUrl.split(',')[1],'base64'));
                result.scanPipeline = 'real page rendered; vision API mocked';
            }
            if (/HSK/i.test(path.basename(name))) assert.ok(result.sample.some(word=>word.term==='รัก'&&word.meaning==='爱'));
            report.push({file:path.basename(name),...result});
            if (/\.docx?$/i.test(name)) { assert.ok(result.count>0, JSON.stringify(result)); assert.ok(result.sample.some(word=>/\p{Script=Thai}/u.test(word.term))); }
        }
        fs.writeFileSync(path.join(output,'sample-report.json'),JSON.stringify(report,null,2));
        assert.deepEqual(errors,[]);
        console.log('Study import browser checks passed. '+JSON.stringify(report));
    } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
