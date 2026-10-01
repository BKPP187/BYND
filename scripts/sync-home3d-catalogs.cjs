'use strict';
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const catalogs = Object.fromEntries(['furniture-catalog', 'room-catalog', 'material-presets'].map(name => [name.replace(/-([a-z])/g, (_, c) => c.toUpperCase()), JSON.parse(fs.readFileSync(path.join(root, 'apps/home3d/data', name + '.json'), 'utf8'))]));
fs.writeFileSync(path.join(root, 'apps/home3d/data/catalogs.js'), 'window.ByndHome3D.catalogs = ' + JSON.stringify(catalogs) + ';\n');
console.log('Home catalogs synchronized.');
