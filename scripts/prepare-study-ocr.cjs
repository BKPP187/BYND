// Usage: node scripts/prepare-study-ocr.cjs <tools folder with tesseract.js@6.0.1, tesseract.js-core@6.1.2>
// Models: official tessdata_fast. Only classic-script resources are retained, so
// file:// WebViews can load them without duplicating binary/Base64 resources.
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const {createHash} = require('node:crypto');
const {gzipSync} = require('node:zlib');
async function main() {
    const source = path.resolve(process.argv[2], 'node_modules');
    const dest = path.resolve(__dirname,'../assets/vendor/study-ocr');
    fs.mkdirSync(dest,{recursive:true});
    const writeSource = (file,key,code) => fs.writeFileSync(path.join(dest,file),`window.ByndStudyOcrAssets=window.ByndStudyOcrAssets||{};window.ByndStudyOcrAssets[${JSON.stringify(key)}]=${JSON.stringify(code)};\n`);
    writeSource('worker-source.js','worker',fs.readFileSync(path.join(source,'tesseract.js/dist/worker.min.js'),'utf8'));
    for(const [file,key] of [['tesseract-core-lstm.wasm.js','core-basic'],['tesseract-core-simd-lstm.wasm.js','core-simd']]) {
        writeSource(key+'.js',key,fs.readFileSync(path.join(source,'tesseract.js-core',file),'utf8'));
    }
    // Resolve and record a real upstream revision, instead of using an unpinned model URL.
    const info = await fetch('https://api.github.com/repos/tesseract-ocr/tessdata_fast/commits/main').then(r=>{if(!r.ok)throw new Error('Cannot resolve model revision');return r.json();});
    const revision = info.sha;
    if(!/^[a-f0-9]{40}$/.test(revision)) throw new Error('Invalid upstream model revision');
    for(const lang of ['tha','chi_sim','eng','jpn']) {
        const url = `https://raw.githubusercontent.com/tesseract-ocr/tessdata_fast/${revision}/${lang}.traineddata`;
        const response = await fetch(url); if(!response.ok)throw new Error(`Cannot download ${lang}`);
        const data = gzipSync(Buffer.from(await response.arrayBuffer()),{level:9});
        writeSource(lang+'.js',lang,data.toString('base64'));
    }
    for(const pkg of ['tesseract.js','tesseract.js-core']) {
        const license = fs.readdirSync(path.join(source,pkg)).find(name=>/^LICENSE(?:\.md|\.txt)?$/i.test(name));
        if(!license)throw new Error('Missing license: '+pkg);
        fs.copyFileSync(path.join(source,pkg,license),path.join(dest,pkg+'-LICENSE.txt'));
    }
    fs.rmSync(path.join(dest,'tesseract.js'),{force:true});
    const license = await fetch(`https://raw.githubusercontent.com/tesseract-ocr/tessdata_fast/${revision}/LICENSE`).then(r=>r.text());
    fs.writeFileSync(path.join(dest,'tessdata-LICENSE.txt'),license);
    const hashes = {};
    for(const name of fs.readdirSync(dest).filter(name=>name!=='manifest.json')) hashes[name]=createHash('sha256').update(fs.readFileSync(path.join(dest,name))).digest('hex');
    fs.writeFileSync(path.join(dest,'manifest.json'),JSON.stringify({versions:{'tesseract.js':'6.0.1','tesseract.js-core':'6.1.2'},modelSource:'https://github.com/tesseract-ocr/tessdata_fast',modelRevision:revision,hashes},null,2)+'\n');
    console.log(`Prepared ${Object.keys(hashes).length} offline OCR assets`);
}
main().catch(error=>{console.error(error);process.exitCode=1;});
