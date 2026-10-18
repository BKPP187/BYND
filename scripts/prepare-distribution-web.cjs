#!/usr/bin/env node
'use strict';
const fs = require('node:fs'), path = require('node:path');
const root = path.resolve(__dirname, '..'), directory = path.join(root, '.bynd-distribution-web');
fs.mkdirSync(path.join(directory, 'assets/website'), { recursive: true });
for (const name of ['shop.html', 'account.html', 'checkout.html', 'license-admin.html', 'license-receipt.html']) fs.copyFileSync(path.join(root, name), path.join(directory, name));
for (const name of fs.readdirSync(path.join(root, 'assets/website'))) {
    if (/^[a-z0-9-]+\.(css|js|png|webp)$/.test(name)) fs.copyFileSync(path.join(root, 'assets/website', name), path.join(directory, 'assets/website', name));
}
console.log('Prepared website-only distribution assets: ' + directory + ' (not deployed)');
