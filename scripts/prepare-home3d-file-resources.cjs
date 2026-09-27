'use strict';
// Repackage reviewed GLB bytes as per-model classic scripts for ordinary file://
// browsers. HTTP keeps loading GLBs; no geometry or licensing is changed.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
function prepare(directory = path.join(root, 'assets/home3d/furniture')) {
    const models = fs.readdirSync(directory).filter(file => file.endsWith('.glb'));
    for (const model of models) {
        const encoded = fs.readFileSync(path.join(directory, model)).toString('base64');
        fs.writeFileSync(path.join(directory, model + '.js'), 'window.ByndHome3D.Furniture.registerBuffer(' + JSON.stringify(model) + ',' + JSON.stringify(encoded) + ');\n');
    }
    return models.length;
}
if (require.main === module) console.log('Prepared ' + prepare() + ' lazy local furniture resources.');
module.exports = { prepare };
