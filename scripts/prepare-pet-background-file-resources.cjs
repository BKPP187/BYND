'use strict';
// Classic-script mirrors let ordinary file:// previews use the reviewed local
// worker/runtime/model bytes without fetch(file:) or a published web mirror.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const resources = [
    'apps/monitor/pet-background-worker.js',
    'assets/vendor/pet-background/ort.wasm.bundle.min.mjs',
    'assets/vendor/pet-background/ort-wasm-simd-threaded.wasm',
    'assets/vendor/pet-background/u2netp.onnx'
];
function prepare() {
    for (const name of resources) {
        const bytes = fs.readFileSync(path.join(root, name));
        fs.writeFileSync(path.join(root, name + '.js'), 'window.ByndPetBackground.registerResource(' + JSON.stringify(name) + ',' + JSON.stringify(bytes.toString('base64')) + ');\n');
    }
    return resources.length;
}
if (require.main === module) console.log('Prepared ' + prepare() + ' lazy local background-removal resources.');
module.exports = { prepare, resources };
