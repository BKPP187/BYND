// Usage: node scripts/prepare-study-word.cjs <tools directory with node_modules> <esbuild module>
// tools: word-extractor@1.0.4 mammoth@1.13.0 buffer@6.0.3 stream-browserify@3.0.0 process@0.11.10 events@3.3.0
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
async function main() {
    const tools = path.resolve(process.argv[2]);
    const { build } = require(path.resolve(process.argv[3]));
    const dest = path.resolve(__dirname, '../assets/vendor/study-word');
    fs.mkdirSync(dest, { recursive: true });
    const inject = path.join(tools, 'bynd-browser-globals.mjs');
    fs.writeFileSync(inject, "export { Buffer } from 'buffer/'; export { default as process } from 'process/browser';");
    await build({ stdin: { contents: `
        import WordOleExtractor from 'word-extractor/lib/word-ole-extractor';
        import BufferReader from 'word-extractor/lib/buffer-reader';
        import mammoth from 'mammoth';
        export async function extractDoc(arrayBuffer) {
            const reader = new BufferReader(Buffer.from(arrayBuffer));
            const doc = await new WordOleExtractor().extract(reader);
            return doc.getBody({filterUnicode:false}) + '\\n' + doc.getTextboxes({filterUnicode:false});
        }
        export async function extractDocx(arrayBuffer) {
            const result = await mammoth.convertToHtml({arrayBuffer}, {externalFileAccess:false, convertImage:mammoth.images.imgElement(() => Promise.resolve({src:''}))});
            if (result.messages.some(message => message.type === 'error')) throw new Error('Word 文档解析不完整。');
            return result.value;
        }`, resolveDir: tools }, outfile: path.join(dest, 'word.js'), bundle: true, minify: true,
        format: 'iife', globalName: 'ByndStudyWord', target: ['chrome100', 'safari16'], inject: [inject],
        define: { global: 'globalThis' }, alias: { stream: path.join(tools, 'node_modules/stream-browserify/index.js'), buffer: path.join(tools, 'node_modules/buffer/index.js') }, legalComments: 'eof' });
    const licenses = path.join(dest, 'licenses');
    fs.mkdirSync(licenses, {recursive:true});
    for (const entry of fs.readdirSync(path.join(tools,'node_modules'),{withFileTypes:true}).filter(entry=>entry.isDirectory()&&!entry.name.startsWith('.'))) {
        const packages = entry.name.startsWith('@') ? fs.readdirSync(path.join(tools,'node_modules',entry.name)).map(name=>entry.name+'/'+name) : [entry.name];
        for(const pkg of packages) for(const name of fs.readdirSync(path.join(tools,'node_modules',pkg)).filter(name=>/^(?:licen[cs]e|notice|copyright)(?:\.|$)/i.test(name))) {
            const file = path.join(tools,'node_modules',pkg,name);
            if(fs.statSync(file).isFile()) fs.copyFileSync(file,path.join(licenses,pkg.replace(/[@/]/g,'_')+'-'+name));
        }
    }
    fs.writeFileSync(path.join(dest, 'manifest.json'), JSON.stringify({
        versions: Object.fromEntries(['word-extractor', 'mammoth', 'buffer', 'stream-browserify', 'process', 'events'].map(name => [name, require(path.join(tools, 'node_modules', name, 'package.json')).version])),
        sha256: createHash('sha256').update(fs.readFileSync(path.join(dest, 'word.js'))).digest('hex')
    }, null, 2) + '\n');
    console.log('Prepared offline DOC/DOCX reader');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
