package cc.ccwu.bynd;

import java.io.*;
import java.nio.file.*;
import java.security.*;
import java.util.*;

public final class DistributionHarness {
    private static int checks;
    private static void expect(boolean value) { if (!value) throw new AssertionError("Native distribution verification failed"); checks++; }
    private static String hash(byte[] value) throws Exception { StringBuilder text = new StringBuilder(); for (byte b : MessageDigest.getInstance("SHA-256").digest(value)) text.append(String.format(Locale.ROOT, "%02x", b & 255)); return text.toString(); }
    private static UpdateDownloadVerifier.Progress progress(boolean cancel) { return new UpdateDownloadVerifier.Progress() { public void show(String value) { } public boolean cancelled() { return cancel; } }; }
    private static void fails(InputStream input, File file, long size, String digest, boolean cancel) throws Exception {
        try { UpdateDownloadVerifier.save(input, file, size, digest, progress(cancel)); throw new AssertionError("Expected failure"); }
        catch (AssertionError error) { throw error; }
        catch (Exception expected) { expect(!file.exists()); }
    }
    public static void main(String[] args) throws Exception {
        File directory = new File(args[0]);
        byte[] data = "BYND streamed APK fixture".getBytes("UTF-8"); String digest = hash(data);
        File good = new File(directory, "good.apk");
        UpdateDownloadVerifier.save(new ByteArrayInputStream(data), good, data.length, digest, progress(false)); expect(Arrays.equals(data, Files.readAllBytes(good.toPath())));
        fails(new ByteArrayInputStream(data), new File(directory, "short.apk"), data.length + 1, digest, false);
        fails(new ByteArrayInputStream(data), new File(directory, "oversize.apk"), data.length - 1, digest, false);
        fails(new ByteArrayInputStream(data), new File(directory, "bad-hash.apk"), data.length, "a".repeat(64), false);
        fails(new ByteArrayInputStream(data), new File(directory, "cancelled.apk"), data.length, digest, true);
        fails(new InputStream() { public int read() throws IOException { throw new IOException("network disconnected"); } }, new File(directory, "network.apk"), data.length, digest, false);
        File missing = new File(directory, "missing-parent/output.apk"); fails(new ByteArrayInputStream(data), missing, data.length, digest, false);
        String token = Files.readString(Path.of(args[1])); String[] parts = token.split("\\.");
        byte[] spki = Base64.getUrlDecoder().decode(Files.readString(Path.of(args[2])));
        byte[] signature = Base64.getUrlDecoder().decode(parts[2]);
        expect(DistributionSignature.verify(parts[0] + "." + parts[1], signature, spki));
        expect(!DistributionSignature.verify(parts[0] + "." + parts[1] + "a", signature, spki));
        KeyPairGenerator generator = KeyPairGenerator.getInstance("RSA"); generator.initialize(2048);
        expect(!DistributionSignature.verify(parts[0] + "." + parts[1], signature, generator.generateKeyPair().getPublic().getEncoded()));
        signature[0] ^= 1; expect(!DistributionSignature.verify(parts[0] + "." + parts[1], signature, spki));
        System.out.println("Native distribution checks passed: " + checks);
    }
}
