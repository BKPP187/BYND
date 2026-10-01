"""Check packaged home resources against the reviewed workspace before replacing the latest APK."""
import hashlib
import json
import pathlib
import re
import sys
import zipfile

root = pathlib.Path(__file__).resolve().parent.parent
apk = pathlib.Path(sys.argv[1]).resolve()
manifest = json.loads((root / 'assets/home3d/asset-manifest.json').read_text(encoding='utf-8'))
with zipfile.ZipFile(apk) as package:
    prefix = 'assets/www/'
    checked = 0
    paths = [root / 'index.html', root / 'core/navigation/router.js', root / 'core/api/chat-api.js', root / 'core/storage/backup.js', root / 'systems/living-world/living-world.js', root / 'assets/vendor/home3d/engine.js']
    paths += [p for p in (root / 'apps/home3d').rglob('*') if p.is_file()]
    paths += [p for p in (root / 'assets/home3d').rglob('*') if p.is_file()]
    for file in paths:
        relative = file.relative_to(root).as_posix()
        actual = package.read(prefix + relative)
        if actual != file.read_bytes():
            raise RuntimeError(f'Packaged source is stale: {relative}')
        checked += 1
    for asset in manifest['assets']:
        binary = package.read(prefix + 'assets/home3d/furniture/' + asset['file'])
        if len(binary) != asset['bytes'] or hashlib.sha256(binary).hexdigest() != asset['sha256']:
            raise RuntimeError('Reviewed model checksum mismatch: ' + asset['file'])
    version = re.search(r"const APP_VERSION = 'v([\d.]+)'", (root / 'core/storage/backup.js').read_text(encoding='utf-8')).group(1)
    if ('home3d/home3d.js?v=' + version).encode() not in package.read(prefix + 'index.html'):
        raise RuntimeError('App entry version is stale')
print(json.dumps({'apk': str(apk), 'filesVerified': checked, 'modelsVerified': len(manifest['assets']), 'sha256': hashlib.sha256(apk.read_bytes()).hexdigest()}, ensure_ascii=False, indent=2))
