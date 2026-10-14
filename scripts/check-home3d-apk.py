"""Check packaged home resources against the reviewed workspace before replacing the latest APK."""
import hashlib
import base64
import json
import pathlib
import re
import sys
import zipfile

root = pathlib.Path(__file__).resolve().parent.parent
apk = pathlib.Path(sys.argv[1]).resolve()
manifest = json.loads((root / 'assets/home3d/asset-manifest.json').read_text(encoding='utf-8'))
portraits = {
    'default-user-v1.png': 'initial-portraits.js', 'default-char-v1.png': 'initial-portraits.js',
    'default-user-sleep-v1.png': 'initial-sleep-portraits.js', 'default-char-sleep-v1.png': 'initial-sleep-portraits.js',
    'model-user-preview-v1.png': 'initial-model-previews.js', 'model-char-preview-v1.png': 'initial-model-previews.js'
}
with zipfile.ZipFile(apk) as package:
    prefix = 'assets/www/'
    checked = 0
    names = set(package.namelist())
    for name in names:
        if re.search(r'\.(glb|wasm|onnx|mjs)\.js$', name) and name[:-3] in names:
            raise RuntimeError('Duplicate packaged resource: ' + name)
    paths = [root / 'index.html', root / 'core/navigation/router.js', root / 'core/api/chat-api.js', root / 'core/storage/backup.js', root / 'systems/living-world/living-world.js', root / 'assets/vendor/home3d/engine.js']
    paths += [p for p in (root / 'apps/home3d').rglob('*') if p.is_file()]
    paths += [p for p in (root / 'assets/home3d').rglob('*') if p.is_file()]
    for file in paths:
        relative = file.relative_to(root).as_posix()
        if relative.startswith('assets/home3d/characters/') and file.name in portraits:
            if prefix + relative in names:
                raise RuntimeError('Duplicate raw portrait: ' + relative)
            script = package.read(prefix + 'assets/home3d/characters/' + portraits[file.name])
            if base64.b64encode(file.read_bytes()) not in script:
                raise RuntimeError('Packaged portrait differs: ' + relative)
            checked += 1
            continue
        if relative.endswith('.glb'):
            if prefix + relative in names:
                raise RuntimeError('Duplicate raw home model: ' + relative)
            script = package.read(prefix + relative + '.js').decode('utf-8')
            encoded = re.findall(r'''["']([A-Za-z0-9+/]{100,}={0,2})["']''', script)
            if len(encoded) != 1 or base64.b64decode(encoded[0], validate=True) != file.read_bytes():
                raise RuntimeError('Packaged model mirror differs: ' + relative)
            checked += 1
            continue
        actual = package.read(prefix + relative)
        if actual != file.read_bytes():
            raise RuntimeError(f'Packaged source is stale: {relative}')
        checked += 1
    for asset in manifest['assets']:
        script = package.read(prefix + 'assets/home3d/furniture/' + asset['file'] + '.js').decode('utf-8')
        binary = base64.b64decode(re.findall(r'''["']([A-Za-z0-9+/]{100,}={0,2})["']''', script)[0], validate=True)
        if len(binary) != asset['bytes'] or hashlib.sha256(binary).hexdigest() != asset['sha256']:
            raise RuntimeError('Reviewed model checksum mismatch: ' + asset['file'])
    version = re.search(r"const APP_VERSION = 'v([\d.]+)'", (root / 'core/storage/backup.js').read_text(encoding='utf-8')).group(1)
    if ('home3d/home3d.js?v=' + version).encode() not in package.read(prefix + 'index.html'):
        raise RuntimeError('App entry version is stale')
    background = ['apps/monitor/pet-background-worker.js'] + ['assets/vendor/pet-background/' + name for name in ['ort.wasm.bundle.min.mjs', 'ort-wasm-simd-threaded.wasm', 'u2netp.onnx']]
    for relative in background:
        if prefix + relative + '.js' in names:
            raise RuntimeError('Duplicate background script mirror: ' + relative)
        if package.read(prefix + relative) != (root / relative).read_bytes():
            raise RuntimeError('Packaged background source is stale: ' + relative)
print(json.dumps({'apk': str(apk), 'filesVerified': checked, 'modelsVerified': len(manifest['assets']), 'sha256': hashlib.sha256(apk.read_bytes()).hexdigest()}, ensure_ascii=False, indent=2))
