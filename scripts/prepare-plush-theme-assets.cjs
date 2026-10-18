'use strict';
// Asset preparation only: slice the generated atlas and encode local WebP files.
const fs = require('node:fs');
const path = require('node:path');
const sharp = require(process.env.BYND_SHARP || 'C:/Users/l/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const source = process.argv[2];
if (!source) throw new Error('Pass the directory containing the three generated originals.');
const output = path.resolve(__dirname, '../assets/themes/cream-plush');
fs.mkdirSync(output, { recursive: true });
(async () => {
    await sharp(path.join(source, 'exec-38f8f5e0-03a3-4d93-bca0-c164f1921d00.png')).resize({ width: 960 }).webp({ quality: 90 }).toFile(path.join(output, 'lock.webp'));
    await sharp(path.join(source, 'exec-f053b2b0-d531-42c3-9f32-c6c6a24a879e.png')).resize(720, 720).webp({ quality: 90 }).toFile(path.join(output, 'fleece.webp'));
    const atlas = path.join(source, 'exec-158025c5-729c-4164-9595-c8b536d8c13d.png');
    const { width, height } = await sharp(atlas).metadata();
    for (let index = 0; index < 16; index++) {
        const x = index % 4, y = Math.floor(index / 4);
        const left = Math.round(x * width / 4), top = Math.round(y * height / 4);
        await sharp(atlas).extract({ left, top, width: Math.round((x + 1) * width / 4) - left, height: Math.round((y + 1) * height / 4) - top })
            .resize(256, 256).webp({ quality: 91 }).toFile(path.join(output, `toy-${index + 1}.webp`));
    }
    console.log('Prepared Silver Ribbon wallpaper, dotted lace paper and 16 transparent icons. Legacy filenames keep saved themes compatible.');
})().catch(error => { console.error(error); process.exitCode = 1; });
