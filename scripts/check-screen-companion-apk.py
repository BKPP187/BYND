"""Reject an APK that ships stale companion sources or omits the native tap bridge."""
import hashlib
import json
import pathlib
import re
import sys
import zipfile

root = pathlib.Path(__file__).resolve().parent.parent
apk = pathlib.Path(sys.argv[1]).resolve()
sources = [
    'index.html', 'core/storage/backup.js', 'core/api/chat-api.js',
    'apps/monitor/screen-companion.js', 'apps/monitor/character-pet.js',
    'apps/monitor/character-pet.css', 'apps/monitor/workspace.js',
]
with zipfile.ZipFile(apk) as package:
    assert package.testzip() is None, 'Corrupt APK ZIP entry'
    for source in sources:
        assert package.read('assets/www/' + source) == (root / source).read_bytes(), 'Stale packaged source: ' + source
    dex = b''.join(package.read(name) for name in package.namelist() if re.fullmatch(r'classes\d*\.dex', name))
    for marker in ['requestInteraction', '轻点互动，长按菜单', '互动尚未就绪', 'restricted', 'samsung']:
        assert marker.encode() in dex, 'Missing native interaction marker: ' + marker
version = re.search(r"APP_VERSION = 'v([\d.]+)'", (root / 'core/storage/backup.js').read_text(encoding='utf-8')).group(1)
print(json.dumps({'version': version, 'webSourcesVerified': len(sources), 'nativeTapBridgeVerified': True,
                  'sha256': hashlib.sha256(apk.read_bytes()).hexdigest()}, ensure_ascii=False))
