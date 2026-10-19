#!/usr/bin/env node
'use strict';
const fs = require('node:fs'), path = require('node:path');
const root = path.resolve(__dirname, '..'), directory = path.join(root, '.bynd-distribution-web');
// Drop old client locations when reusing a preview directory.
for (const name of ['payment.js', 'afdian.js', 'checkout.js', 'admin.js', 'shop.js', 'payment.css', 'bynd-qq-contact-ca44cdaaaaa9.png', 'bynd-payment-frame-e4a9f7ba69a0.webp']) {
    fs.rmSync(path.join(directory, 'assets/website', name), { force: true });
}
for (const name of ['shop.html', 'account.html', 'checkout.html', 'license-admin.html', 'license-receipt.html']) fs.copyFileSync(path.join(root, name), path.join(directory, name));
for (const group of ['website', 'contact']) {
    fs.mkdirSync(path.join(directory, 'assets', group), { recursive: true });
    for (const name of fs.readdirSync(path.join(root, 'assets', group))) {
        if (/^[a-z0-9-]+\.(css|js|png|webp)$/.test(name)) fs.copyFileSync(path.join(root, 'assets', group, name), path.join(directory, 'assets', group, name));
    }
}
console.log('Prepared website-only distribution assets: ' + directory + ' (not deployed)');
