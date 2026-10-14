package cc.ccwu.bynd;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.security.MessageDigest;
import java.util.Locale;

/** Pure Java stream verification, shared by Android and the host JVM failure tests. */
final class UpdateDownloadVerifier {
    interface Progress { void show(String message); boolean cancelled(); }
    static void save(InputStream input, File file, long expectedSize, String expectedSha, Progress progress) throws Exception {
        if (expectedSize <= 0 || expectedSize > 2L * 1024 * 1024 * 1024 || !expectedSha.matches("[a-f0-9]{64}")) throw new Exception("APK 清单无效。");
        MessageDigest digest = MessageDigest.getInstance("SHA-256"); long received = 0; int last = -1; boolean verified = false;
        try {
            try (FileOutputStream output = new FileOutputStream(file)) {
                byte[] buffer = new byte[65536]; int count;
                while ((count = input.read(buffer)) != -1) {
                    if (progress.cancelled()) throw new Exception("下载已取消，原版本与数据保留。");
                    received += count;
                    if (received > expectedSize) throw new Exception("APK 大小与清单不符，已取消安装。");
                    output.write(buffer, 0, count); digest.update(buffer, 0, count);
                    int percent = (int) (received * 100 / expectedSize);
                    if (percent != last) { last = percent; progress.show("正在下载 " + percent + "%"); }
                }
                output.getFD().sync();
            }
            if (progress.cancelled()) throw new Exception("下载已取消，原版本与数据保留。");
            StringBuilder hash = new StringBuilder(); for (byte value : digest.digest()) hash.append(String.format(Locale.ROOT, "%02x", value & 255));
            if (received != expectedSize || !expectedSha.equals(hash.toString())) throw new Exception("APK 校验失败，已取消安装，请重新下载。");
            verified = true;
        } finally { if (!verified && file.exists() && !file.delete()) file.deleteOnExit(); }
    }
}
