const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path'), crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const javaHome = process.env.BYND_TEST_JAVA_HOME || 'D:/000000000000000/BYND_build_tools/jdk17/jdk-17.0.19+10';
test('Android production Java verifies streamed downloads and Worker RSA signatures offline', { skip: !fs.existsSync(path.join(javaHome, 'bin/javac.exe')) && !process.env.BYND_TEST_JAVA_HOME }, async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'bynd-native-test-'));
    try {
        const { signToken } = await import('../workers/license/worker.mjs');
        const signer = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
        const token = await signToken({ SIGNING_KEY_ID: 'native-test', SIGNING_PRIVATE_JWK: JSON.stringify(signer.privateKey.export({ format: 'jwk' })) }, 'BYND-LICENSE', { aud: 'cc.ccwu.bynd', entitlement: 'perpetual', device: 'test-device' });
        fs.writeFileSync(path.join(directory, 'token.txt'), token); fs.writeFileSync(path.join(directory, 'public.txt'), signer.publicKey.export({ type: 'spki', format: 'der' }).toString('base64url'));
        const source = 'android/app/src/main/java/cc/ccwu/bynd/';
        const compile = spawnSync(path.join(javaHome, 'bin/javac'), ['-encoding', 'UTF-8', '-d', directory, path.join(root, source, 'UpdateDownloadVerifier.java'), path.join(root, source, 'DistributionSignature.java'), path.join(root, 'tests/native/DistributionHarness.java')], { encoding: 'utf8' });
        assert.equal(compile.status, 0, compile.stderr);
        const run = spawnSync(path.join(javaHome, 'bin/java'), ['-cp', directory, 'cc.ccwu.bynd.DistributionHarness', directory, path.join(directory, 'token.txt'), path.join(directory, 'public.txt')], { encoding: 'utf8' });
        assert.equal(run.status, 0, run.stderr); assert.match(run.stdout, /Native distribution checks passed: 11/);
    } finally {
        // mkdtemp created this exact named directory; never delete a computed workspace path.
        if (path.dirname(directory) === path.resolve(os.tmpdir()) && path.basename(directory).startsWith('bynd-native-test-')) fs.rmSync(directory, { recursive: true, force: true });
    }
});
