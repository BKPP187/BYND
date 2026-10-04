'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

test('system camera handles selection, cancellation, empty output and private-file boundaries', t => {
    const bundled = 'D:/000000000000000/BYND_build_tools/jdk17/jdk-17.0.19+10/bin';
    const javac = process.platform === 'win32' && fs.existsSync(path.join(bundled, 'javac.exe')) ? path.join(bundled, 'javac.exe') : 'javac';
    const java = javac === 'javac' ? 'java' : path.join(bundled, 'java.exe');
    if (spawnSync(javac, ['-version']).status !== 0) { t.skip('JDK is unavailable for native camera policy verification'); return; }
    const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'bynd-system-camera-'));
    try {
        const harness = path.join(temporary, 'SystemCameraCheck.java');
        fs.writeFileSync(harness, `package cc.ccwu.bynd;
import java.io.*;
import java.nio.file.Files;
public class SystemCameraCheck {
    static void check(boolean result, String label) { if (!result) throw new AssertionError(label); }
    public static void main(String[] args) throws Exception {
        check(SystemCameraPolicy.shouldCaptureImage(true, new String[]{"image/*"}), "Rear camera capture request");
        check(SystemCameraPolicy.shouldCaptureImage(true, new String[]{"image/jpeg,image/png"}), "Image MIME list");
        check(!SystemCameraPolicy.shouldCaptureImage(false, new String[]{"image/*"}), "Gallery remains a gallery");
        check(!SystemCameraPolicy.shouldCaptureImage(true, new String[]{"video/*"}), "Video is not image capture");
        check(!SystemCameraPolicy.shouldCaptureImage(true, new String[]{"image/*", "audio/*"}), "Mixed media remains chooser");
        check(!SystemCameraPolicy.shouldCaptureImage(true, null), "Missing accept types");
        check(!SystemCameraPolicy.shouldCaptureImage(true, new String[]{""}), "Unknown capture type");
        File directory = new File(args[0]);
        File file = new File(directory, "bynd-camera-test.jpg");
        check(!SystemCameraPolicy.hasCapturedPhoto(true, file), "Missing output is failure");
        file.createNewFile();
        check(!SystemCameraPolicy.hasCapturedPhoto(true, file), "Empty output is failure");
        Files.write(file.toPath(), new byte[]{(byte)255, (byte)216, (byte)255});
        check(SystemCameraPolicy.hasCapturedPhoto(true, file), "Camera output works without a result Intent");
        check(!SystemCameraPolicy.hasCapturedPhoto(false, file), "Cancel never sends a leftover photo");
        check(!SystemCameraPolicy.hasCapturedPhoto(true, directory), "A directory is not a photo");
        check(!SystemCameraPolicy.hasCapturedPhoto(true, null), "Null output is failure");
        check(SystemCameraPolicy.resolvePhoto(directory, file.getName()).equals(file.getCanonicalFile()), "Only camera cache files");
        for (String name : new String[]{"../private.jpg", "bynd-camera-../../private.jpg", "secrets.txt", "photo.jpg"}) {
            try { SystemCameraPolicy.resolvePhoto(directory, name); throw new AssertionError("Unsafe filename accepted: " + name); }
            catch (IOException expected) {}
        }
        System.out.println("System camera cancellation, output validation and cache boundaries passed.");
    }
}`);
        const source = path.resolve('android/app/src/main/java/cc/ccwu/bynd/SystemCameraPolicy.java');
        const compiled = spawnSync(javac, ['-encoding', 'UTF-8', '-d', temporary, source, harness], { encoding: 'utf8' });
        assert.equal(compiled.status, 0, compiled.stderr || compiled.stdout);
        const executed = spawnSync(java, ['-cp', temporary, 'cc.ccwu.bynd.SystemCameraCheck', temporary], { encoding: 'utf8' });
        assert.equal(executed.status, 0, executed.stderr || executed.stdout);
    } finally {
        assert.ok(temporary.startsWith(path.join(os.tmpdir(), 'bynd-system-camera-')));
        fs.rmSync(temporary, { recursive: true, force: true });
    }
});
