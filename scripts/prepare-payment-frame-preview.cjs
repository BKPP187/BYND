'use strict';
// Local design artifact only. A personal collection QR must never be used as proof of payment.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const sharp = require(process.env.BYND_SHARP || 'sharp');
const jsQR = require(process.env.BYND_JSQR || 'jsqr');
const root = path.resolve(__dirname, '..'), directory = path.join(root, 'artifacts/payments');
async function decode(image) {
    const { data, info } = await sharp(image).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    return jsQR(new Uint8ClampedArray(data), info.width, info.height);
}
async function main() {
    const original = path.join(directory, 'alipay-original.jpg'), frame = path.join(directory, 'bynd-payment-frame-source.png');
    const before = await decode(original); assert.ok(before, 'Original collection QR must decode');
    // Preserve the supplied QR and its avatar; only extract and scale using nearest-neighbour.
    // Four-module white margins remain outside the code on every side.
    const padded = await sharp(original).extract({ left: 263, top: 757, width: 824, height: 824 })
        .extend({ top: 82, bottom: 82, left: 82, right: 82, background: '#ffffff' })
        .png().toBuffer();
    // Materialize the margins first: sharp applies extend after resize in a single pipeline.
    const qr = await sharp(padded).resize(628, 628, { kernel: 'nearest' }).png().toBuffer();
    const destination = path.join(directory, 'bynd-alipay-framed-preview.png');
    await sharp(frame).composite([{ input: qr, left: 247, top: 343 }]).png().toFile(destination);
    const after = await decode(destination); assert.ok(after, 'Framed QR must decode');
    assert.equal(after.data, before.data, 'Framed QR must point to the exact original destination');
    fs.writeFileSync(path.join(directory, 'qr-check.json'), JSON.stringify({ originalDecoded: true, framedDecoded: true, sameDestination: true, previewOnly: true }, null, 2));
    console.log('Verified original and framed QR have identical contents. Preview only: ' + destination);
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
