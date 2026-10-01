#!/usr/bin/env node
'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const files = new Map([
    ['/', ['shop.html', 'text/html; charset=utf-8']],
    ['/shop.html', ['shop.html', 'text/html; charset=utf-8']],
    ['/assets/website/shop.css', ['assets/website/shop.css', 'text/css; charset=utf-8']],
    ['/assets/website/bynd-companion.png', ['assets/website/bynd-companion.png', 'image/png']]
]);
const port = Number(process.env.BYND_SHOP_PREVIEW_PORT || 8992);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Invalid preview port');
const server = http.createServer((request, response) => {
    const route = new URL(request.url, 'http://localhost').pathname;
    if (route === '/index.html') { response.writeHead(302, { Location: 'https://bynd.ccwu.cc' }); response.end(); return; }
    const entry = files.get(route);
    if (!entry || !['GET', 'HEAD'].includes(request.method)) { response.writeHead(404); response.end(); return; }
    response.writeHead(200, { 'Content-Type': entry[1], 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    if (request.method === 'HEAD') { response.end(); return; }
    const stream = fs.createReadStream(path.join(__dirname, '..', entry[0]));
    stream.on('error', () => response.destroy()); stream.pipe(response);
});
server.on('error', error => { console.error(error.message); process.exitCode = 1; });
server.listen(port, '127.0.0.1', () => console.log('BYND shop preview: http://127.0.0.1:' + port + '/shop.html'));
