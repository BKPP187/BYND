'use strict';
// APK-only policy: home models use script mirrors, background removal uses XHR.
// Web/file previews keep their source resources; never delete source assets.
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const { resources: backgroundResources } = require('./prepare-pet-background-file-resources.cjs');
const root = path.resolve(__dirname, '..');
const portraitBundles = [
    { script: 'initial-portraits.js', key: 'initialPortraits', user: 'default-user-v1.png', char: 'default-char-v1.png' },
    { script: 'initial-sleep-portraits.js', key: 'initialSleepPortraits', user: 'default-user-sleep-v1.png', char: 'default-char-sleep-v1.png' },
    { script: 'initial-model-previews.js', key: 'initialModelPortraits', user: 'model-user-preview-v1.png', char: 'model-char-preview-v1.png' }
];

function verifyPortraits(sourceRoot, stagedRoot) {
    const directory = 'assets/home3d/characters/';
    let omittedBytes = 0;
    for (const bundle of portraitBundles) {
        const script = fs.readFileSync(path.join(sourceRoot, directory, bundle.script));
        const H = {};
        vm.runInNewContext(script.toString('utf8'), { window: { ByndHome3D: H } }, { timeout: 2000 });
        for (const who of ['user', 'char']) {
            const relative = directory + bundle[who], source = fs.readFileSync(path.join(sourceRoot, relative));
            if (H[bundle.key]?.[who] !== 'data:image/png;base64,' + source.toString('base64')) throw Error('Stale portrait bundle: ' + relative);
            omittedBytes += source.length;
            if (stagedRoot && fs.existsSync(path.join(stagedRoot, relative))) throw Error('Duplicate APK portrait: ' + relative);
        }
        if (stagedRoot && !fs.readFileSync(path.join(stagedRoot, directory, bundle.script)).equals(script)) throw Error('Stale APK portrait bundle: ' + bundle.script);
    }
    return omittedBytes;
}

function files(directory) {
    return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
        const file = path.join(directory, entry.name);
        return entry.isDirectory() ? files(file) : entry.isFile() ? [file] : [];
    });
}

function decodeModelMirror(relative, source) {
    let bytes, calls = 0;
    const accept = encoded => {
        if (typeof encoded !== 'string') throw Error('Invalid model encoding: ' + relative);
        bytes = Buffer.from(encoded, 'base64'); calls++;
        if (bytes.toString('base64') !== encoded) throw Error('Invalid model encoding: ' + relative);
    };
    const context = { window: { ByndHome3D: {
        Furniture: { registerBuffer(model, encoded) {
            if (relative !== 'assets/home3d/furniture/' + model + '.js') throw Error('Wrong model registration: ' + relative);
            accept(encoded);
        } },
        CharacterModels: { registerBuffer(level, encoded, id = 'silver-red-v1') {
            if (relative !== 'assets/home3d/characters/' + id + '/' + level + '.glb.js') throw Error('Wrong model registration: ' + relative);
            accept(encoded);
        } }
    } } };
    vm.runInNewContext(source, context, { timeout: 2000, filename: relative });
    if (calls !== 1 || !bytes?.length) throw Error('Missing or duplicate model registration: ' + relative);
    return bytes;
}

function verify(sourceRoot = root, stagedRoot) {
    const models = files(path.join(sourceRoot, 'assets/home3d')).filter(file => file.endsWith('.glb'));
    if (!models.length) throw Error('No home models found; refusing to package incomplete assets.');
    let omittedBytes = 0;
    for (const file of models) {
        const relative = path.relative(sourceRoot, file).split(path.sep).join('/');
        const mirror = relative + '.js', source = fs.readFileSync(file);
        const script = fs.readFileSync(path.join(sourceRoot, mirror), 'utf8');
        if (!decodeModelMirror(mirror, script).equals(source)) throw Error('Stale model mirror: ' + mirror);
        omittedBytes += source.length;
        if (stagedRoot) {
            if (fs.existsSync(path.join(stagedRoot, relative))) throw Error('Duplicate APK model: ' + relative);
            if (!fs.readFileSync(path.join(stagedRoot, mirror)).equals(fs.readFileSync(path.join(sourceRoot, mirror)))) throw Error('Stale APK model: ' + mirror);
        }
    }
    for (const resource of backgroundResources) {
        const source = fs.readFileSync(path.join(sourceRoot, resource));
        omittedBytes += fs.statSync(path.join(sourceRoot, resource + '.js')).size;
        if (stagedRoot) {
            if (!fs.readFileSync(path.join(stagedRoot, resource)).equals(source)) throw Error('Stale APK background resource: ' + resource);
            if (fs.existsSync(path.join(stagedRoot, resource + '.js'))) throw Error('Duplicate APK background resource: ' + resource);
        }
    }
    if (stagedRoot) {
        for (const file of files(stagedRoot)) {
            if (/\.(glb|wasm|onnx|mjs)\.js$/.test(file) && fs.existsSync(file.slice(0, -3))) throw Error('Duplicate APK resource pair: ' + file);
        }
    }
    omittedBytes += verifyPortraits(sourceRoot, stagedRoot);
    return { modelsVerified: models.length, portraitsVerified: portraitBundles.length * 2, backgroundResourcesVerified: backgroundResources.length, omittedSourceBytes: omittedBytes };
}

if (require.main === module) {
    try { console.log(JSON.stringify(verify(root, process.argv[2]), null, 2)); }
    catch (error) { console.error(error.message); process.exitCode = 1; }
}
module.exports = { verify, decodeModelMirror, portraitBundles };
