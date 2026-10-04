'use strict';
// Render the actual packaged character meshes; never substitute generated concept art.
const fs = require('node:fs'), path = require('node:path');
const { createServer } = require('./check-home3d-renderer-browser.cjs');
const root = path.resolve(__dirname, '..'), output = path.join(root, 'assets/home3d/characters');
async function main() {
    const { chromium } = require(process.env.BYND_PLAYWRIGHT || 'C:/Users/l/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
    const server = createServer(); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] });
    try {
        const page = await browser.newPage();
        await page.goto('http://127.0.0.1:' + server.address().port + '/room');
        await page.waitForFunction(() => ByndHome3D.runtime?.stats().actors.length === 2 && !document.querySelector('.home3d-scene.is-loading'));
        const images = {};
        for (const [who, id] of [['user', 'bunny-blue-v1'], ['char', 'silver-red-v1']]) {
            images[who] = await page.evaluate(async ({ who, id }) => {
                const T = ByndHomeEngine, H = ByndHome3D;
                H.close();
                const bytes = await fetch('/assets/home3d/characters/' + id + '/near.glb').then(r => { if (!r.ok) throw Error('Model unavailable'); return r.arrayBuffer(); });
                const gltf = await new T.GLTFLoader().parseAsync(bytes, '');
                const actor = { who, modelId: id, root: new T.Group(), visual: 'model3d' };
                Object.assign(actor, H.CharacterModels.rig(gltf, actor)); actor.root.add(actor.modelRoot);
                H.CharacterModels.pose(actor, 'Idle');
                const scene = new T.Scene(); scene.add(actor.root);
                scene.add(new T.HemisphereLight('#fff8f0', '#bbc2cc', 2));
                const key = new T.DirectionalLight('#ffffff', 2.5); key.position.set(-3, 6, 5); scene.add(key);
                const renderer = new T.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
                renderer.setSize(512, 768); renderer.setPixelRatio(1); renderer.setClearColor(0, 0);
                renderer.outputColorSpace = T.SRGBColorSpace; renderer.toneMapping = T.ACESFilmicToneMapping;
                const camera = new T.OrthographicCamera(-.62, .62, .93, -.93, .01, 30);
                camera.position.set(.85, 1.03, 5); camera.lookAt(0, .81, 0); camera.updateProjectionMatrix();
                renderer.render(scene, camera);
                const result = renderer.domElement.toDataURL('image/png');
                H.Shapes.disposeGeometry(actor.root); renderer.dispose(); return result;
            }, { who, id });
            fs.writeFileSync(path.join(output, 'model-' + who + '-preview-v1.png'), Buffer.from(images[who].split(',')[1], 'base64'));
        }
        fs.writeFileSync(path.join(output, 'initial-model-previews.js'), '(function (H) {\n    \'use strict\';\n    H.initialModelPortraits = ' + JSON.stringify(images) + ';\n})(window.ByndHome3D);\n');
        console.log('Rendered matching transparent previews from both near-LOD 3D models.');
    } finally { await browser.close(); server.close(); }
}
if (require.main === module) main().catch(error => { console.error(error.stack); process.exitCode = 1; });
