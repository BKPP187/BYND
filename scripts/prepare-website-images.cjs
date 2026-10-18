'use strict';
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const sharp = require(process.env.BYND_SHARP || 'sharp');
const root = path.resolve(__dirname, '..'), directory = path.join(root, 'assets/website');
async function main() {
    const source = path.join(directory, 'bynd-companion.png');
    for (const [file, size] of [['account.html', 256], ['license-receipt.html', 480], ['shop.html', 840]]) {
        const bytes = await sharp(source).resize({ width: size, withoutEnlargement: true }).webp({ quality: 84, alphaQuality: 100, effort: 6 }).toBuffer();
        const hash = crypto.createHash('sha256').update(bytes).digest('hex').slice(0, 12), name = `bynd-companion-${size}-${hash}.webp`;
        fs.writeFileSync(path.join(directory, name), bytes);
        const sourceFile = path.join(root, file), html = fs.readFileSync(sourceFile, 'utf8');
        const image = /<img\b[^>]*src="assets\/website\/bynd-companion(?:-\d+-[a-f0-9]{12})?\.(?:png|webp)"[^>]*>/;
        if (!image.test(html)) throw Error('Companion image is missing in ' + file);
        const updated = html.replace(image, tag => {
            let result = tag.replace(/src="[^"]+"/, `src="assets/website/${name}"`).replace(/width="\d+" height="\d+"/, `width="${size}" height="${size}"`);
            if (!result.includes('decoding=')) result = result.replace('<img', '<img decoding="async"');
            return result;
        });
        fs.writeFileSync(sourceFile, updated);
        console.log(file + ': ' + name + ' (' + bytes.length + ' bytes)');
    }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
