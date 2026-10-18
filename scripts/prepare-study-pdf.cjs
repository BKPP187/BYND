// Usage: node scripts/prepare-study-pdf.cjs <extracted pdfjs-dist package> <esbuild module>
// Classic scripts support both hosted pages and Android's file:// asset origin.
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
async function main() {
    const source = path.resolve(process.argv[2]);
    const { build } = require(path.resolve(process.argv[3]));
    const version = JSON.parse(fs.readFileSync(path.join(source, 'package.json'))).version;
    const dest = path.resolve(__dirname, '../assets/vendor/pdfjs');
    fs.mkdirSync(dest, { recursive: true });
    for (const [input, output, globalName] of [['pdf.mjs', 'pdf.js', 'pdfjsLib'], ['pdf.worker.mjs', 'pdf.worker.js', 'pdfjsWorker']]) {
        await build({ entryPoints: [path.join(source, 'legacy/build', input)], outfile: path.join(dest, output),
            bundle: true, minify: true, format: 'iife', globalName, target: ['chrome100', 'safari16'],
            define: { 'import.meta.url': '""' }, external: ['node:*'], legalComments: 'eof' });
    }
    fs.copyFileSync(path.join(source, 'LICENSE'), path.join(dest, 'LICENSE'));
    for (const dir of ['cmaps', 'standard_fonts', 'wasm']) fs.cpSync(path.join(source, dir), path.join(dest, dir), { recursive: true });
    const hashes = {};
    function visit(dir) {
        for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
            const file = path.join(dir, item.name);
            if (item.isDirectory()) visit(file);
            else if (item.name !== 'manifest.json') hashes[path.relative(dest, file).replace(/\\/g, '/')] = createHash('sha256').update(fs.readFileSync(file)).digest('hex');
        }
    }
    visit(dest);
    fs.writeFileSync(path.join(dest, 'manifest.json'), JSON.stringify({ version, source: `https://registry.npmjs.org/pdfjs-dist/-/pdfjs-dist-${version}.tgz`, hashes }, null, 2) + '\n');
    console.log(`Prepared PDF.js ${version}: ${Object.keys(hashes).length} offline assets`);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
