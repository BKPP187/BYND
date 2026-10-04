'use strict';
// Offline packaging only. No API calls, credentials or paid generation.
const fs = require('node:fs'), path = require('node:path'), { createHash } = require('node:crypto');
const root = path.resolve(__dirname, '..');
async function main(args = process.argv.slice(2)) {
    const id = args[0] || 'silver-red-v1';
    if (!['silver-red-v1', 'bunny-blue-v1'].includes(id)) throw Error('Unknown reviewed character.');
    const femaleLod = args[1] || 'rig-v1/lod-v1';
    if (!/^rig-v\d+\/lod-v\d+$/.test(femaleLod)) throw Error('Invalid female rig review directory.');
    const { NodeIO } = require(path.join(root, 'artifacts/home3d-tools/node_modules/@gltf-transform/core'));
    const sharp = require(process.env.BYND_SHARP || 'C:/Users/l/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
    const { inspect } = require('./check-home3d-character-model.cjs');
    const input = path.join(root, 'artifacts/home3d-models', id, id === 'silver-red-v1' ? 'hd-texture-v1/review-lods-v3' : femaleLod);
    const output = path.join(root, 'assets/home3d/characters', id);
    const source = JSON.parse(fs.readFileSync(path.join(input, 'lod-manifest.json'))), io = new NodeIO(), levels = [];
    fs.mkdirSync(output, { recursive: true });
    for (const name of ['far', 'middle', 'near']) {
        const bytes = fs.readFileSync(path.join(input, name + '.glb')), expected = source.levels.find(l => l.name === name);
        if (createHash('sha256').update(bytes).digest('hex') !== expected.sha256) throw Error('Reviewed source changed: ' + name);
        const doc = await io.readBinary(bytes), material = doc.getRoot().listMaterials()[0], colorSize = { far: 1024, middle: 2048, near: id === 'silver-red-v1' ? 4096 : 2048 }[name];
        for (const [texture, size] of [[material.getBaseColorTexture(), colorSize], [material.getNormalTexture(), name === 'far' ? 512 : 1024], [material.getMetallicRoughnessTexture(), 512]]) {
            if (!texture) continue;
            const isColor = texture === material.getBaseColorTexture(), pipeline = sharp(Buffer.from(texture.getImage())).resize({ width: size, height: size, fit: 'inside', withoutEnlargement: true });
            const image = await (isColor ? pipeline.jpeg({ quality: 95, chromaSubsampling: '4:4:4' }) : pipeline.png()).toBuffer();
            texture.setImage(image).setMimeType(isColor ? 'image/jpeg' : 'image/png');
        }
        const packed = Buffer.from(await io.writeBinary(doc)), intake = await inspect(packed);
        if (!intake.ok || (id === 'bunny-blue-v1' && intake.model.joints !== 23)) throw Error('Runtime GLB failed validation or female skin contract: ' + name);
        const file = path.join(output, name + '.glb');
        if (fs.existsSync(file) && !fs.readFileSync(file).equals(packed)) throw Error('Runtime output already differs; use a new asset version.');
        fs.writeFileSync(file, packed);
        fs.writeFileSync(file + '.js', "window.ByndHome3D.CharacterModels.registerBuffer('" + name + "','" + packed.toString('base64') + "'" + (id === 'silver-red-v1' ? '' : ",'" + id + "'") + ");\n");
        levels.push({ name, bytes: packed.length, sha256: intake.sha256, triangles: expected.triangles, colorSize });
    }
    fs.writeFileSync(path.join(output, 'manifest.json'), JSON.stringify({ version: 1, id, sourceHash: source.sourceHash, source: 'User-authorized Tripo generation' + (id === 'silver-red-v1' ? ' and HD texturing' : ' and 23-joint Mixamo skin binding'), forward: '+X', height: id === 'silver-red-v1' ? 1.55 : 1.62, rig: id === 'silver-red-v1' ? 'Model-specific runtime starter skeleton; deformation requires visual review' : 'Tripo weights retained; measured rest joints converted to game axes; action deformation still requires review', levels }, null, 2));
    console.log(JSON.stringify(levels));
}
module.exports = { main };
if (require.main === module) main().catch(e => { console.error(e.message); process.exitCode = 1; });
