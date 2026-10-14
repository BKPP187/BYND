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
    await sharp(path.join(source, 'exec-dabe7152-0fcd-41be-bfb2-8a655bf2f964.png')).resize({ width: 960 }).webp({ quality: 90 }).toFile(path.join(output, 'lock.webp'));
    await sharp(path.join(source, 'exec-8c6b562d-2718-4461-b81b-66414811ebfb.png')).resize(720, 720).webp({ quality: 87 }).toFile(path.join(output, 'fleece.webp'));
    const atlas = path.join(source, 'exec-0c22243f-4b70-4545-8b6f-74108a04e565.png');
    const { width, height } = await sharp(atlas).metadata();
    for (let index = 0; index < 16; index++) {
        const x = index % 4, y = Math.floor(index / 4);
        const left = Math.round(x * width / 4), top = Math.round(y * height / 4);
        await sharp(atlas).extract({ left, top, width: Math.round((x + 1) * width / 4) - left, height: Math.round((y + 1) * height / 4) - top })
            .resize(256, 256).webp({ quality: 91 }).toFile(path.join(output, `toy-${index + 1}.webp`));
    }
    console.log('Prepared lock wallpaper, fleece texture and 16 plush tiles.');
})().catch(error => { console.error(error); process.exitCode = 1; });
