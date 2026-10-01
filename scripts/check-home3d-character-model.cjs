'use strict';
// Read-only intake report. This does not approve appearance, rig quality or furniture contact.
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');

function loadValidator() {
    try { return require(path.resolve(__dirname, '../artifacts/home3d-tools/node_modules/gltf-validator')); }
    catch (error) {
        if (error.code !== 'MODULE_NOT_FOUND') throw error;
        throw new Error('Install the offline validator: npm install --prefix artifacts/home3d-tools gltf-validator@2.0.0-dev.3.10');
    }
}

function readDocument(bytes) {
    if (bytes.length < 20 || bytes.readUInt32LE(0) !== 0x46546c67 || bytes.readUInt32LE(4) !== 2)
        throw new Error('Expected a binary glTF 2.0 (.glb), not a picture or glTF JSON.');
    if (bytes.readUInt32LE(8) !== bytes.length) throw new Error('GLB length does not match the file; it may be truncated.');
    const length = bytes.readUInt32LE(12);
    if (bytes.readUInt32LE(16) !== 0x4e4f534a || length % 4 || length > bytes.length - 20)
        throw new Error('Missing or truncated GLB JSON chunk.');
    const document = JSON.parse(bytes.subarray(20, 20 + length).toString('utf8'));
    for (const resource of [...(document.buffers || []), ...(document.images || [])]) {
        if (resource.uri !== undefined && (typeof resource.uri !== 'string' || !resource.uri.startsWith('data:')))
            throw new Error('Export a self-contained GLB with embedded textures and buffers; external resources are not loaded.');
    }
    return document;
}

function summarize(document) {
    const nodes = document.nodes || [], meshes = document.meshes || [], skins = document.skins || [];
    const reachable = new Set();
    function visit(index) {
        if (reachable.has(index)) return;
        reachable.add(index);
        for (const child of nodes[index]?.children || []) visit(child);
    }
    for (const index of document.scenes?.[document.scene ?? 0]?.nodes || []) visit(index);
    const meshNodes = [...reachable].map(index => nodes[index]).filter(node => node?.mesh !== undefined);
    const usedSkins = new Set(meshNodes.filter(node => node.skin !== undefined).map(node => node.skin));
    const joints = new Set([...usedSkins].flatMap(index => skins[index]?.joints || []));
    const primitives = meshNodes.flatMap(node => meshes[node.mesh]?.primitives || []);
    const boneClips = (document.animations || []).filter(clip => clip.channels?.some(channel => joints.has(channel.target?.node)));
    return {
        meshInstances: meshNodes.length,
        primitiveInstances: primitives.length,
        vertexInstances: primitives.reduce((sum, primitive) => sum + (document.accessors?.[primitive.attributes?.POSITION]?.count || 0), 0),
        skins: usedSkins.size,
        joints: joints.size,
        animations: (document.animations || []).map((clip, index) => ({ name: clip.name || `animation_${index}`, channels: clip.channels?.length || 0 })),
        boneAnimationCount: boneClips.length,
        embeddedImages: document.images?.length || 0,
        requiredExtensions: document.extensionsRequired || []
    };
}

async function inspect(bytes, { requireRig = false, requireAnimations = false } = {}) {
    const document = readDocument(bytes);
    const validator = loadValidator();
    const validation = await validator.validateBytes(new Uint8Array(bytes), {
        format: 'glb', writeTimestamp: false, maxIssues: 0,
        externalResourceFunction: () => Promise.reject(new Error('External resources are not loaded.'))
    });
    const errors = [];
    if (validation.issues.numErrors) errors.push(`glTF validation found ${validation.issues.numErrors} errors.`);
    const model = validation.issues.numErrors ? null : summarize(document);
    if (model) {
        if (!model.meshInstances || !model.vertexInstances) errors.push('The active scene contains no mesh geometry.');
        if ((requireRig || requireAnimations) && !model.joints) errors.push('No skin-bound skeleton in the active scene; rigging is still needed.');
        if (requireAnimations && !model.boneAnimationCount) errors.push('No embedded animation channels target the skin joints; actions are still needed.');
    }
    return {
        ok: errors.length === 0,
        stage: errors.length ? 'failed-intake' : model.joints ? (model.boneAnimationCount ? 'animated-rig-for-review' : 'rig-for-review') : 'static-mesh-for-review',
        bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex'),
        model, errors, validation,
        reviewRequired: ['Identity and appearance from every side', 'Actual volumetric geometry and mobile resource budget', 'Humanoid bone mapping and deformation', 'Idle, walk, sit and sleep clip mapping', 'Scale, foot pivot, sofa seats and pillow orientation in the room']
    };
}

async function main() {
    const args = process.argv.slice(2), flags = new Set(args.filter(arg => arg.startsWith('--')));
    const files = args.filter(arg => !arg.startsWith('--'));
    if (files.length !== 1 || [...flags].some(flag => !['--require-rig', '--require-animations'].includes(flag)))
        throw new Error('Usage: node scripts/check-home3d-character-model.cjs <model.glb> [--require-rig] [--require-animations]');
    const file = path.resolve(files[0]);
    const report = await inspect(fs.readFileSync(file), { requireRig: flags.has('--require-rig'), requireAnimations: flags.has('--require-animations') });
    process.stdout.write(JSON.stringify({ file, ...report }, null, 2) + '\n');
    if (!report.ok) process.exitCode = 1;
}

module.exports = { readDocument, summarize, inspect };
if (require.main === module) main().catch(error => {
    process.stderr.write(`Model intake failed: ${error.message}\n`);
    process.exitCode = 1;
});
