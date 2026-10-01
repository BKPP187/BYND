package cc.ccwu.bynd;

import android.app.Activity;
import android.app.AlertDialog;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageInstaller;
import android.content.pm.PackageManager;
import android.content.pm.Signature;
import android.os.Build;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.security.MessageDigest;
import java.util.HashSet;
import java.util.Set;
import java.util.concurrent.atomic.AtomicBoolean;

final class UpdateManager {
    private static final AtomicBoolean checking = new AtomicBoolean();
    private static final AtomicBoolean downloading = new AtomicBoolean();
    static JSONObject check() throws Exception {
        if (!BuildConfig.BYND_ENABLE_UPDATES) return null;
        JSONObject response = DistributionHttp.request("/updates/v1/android/stable", null);
        if (response == null) return null;
        JSONObject release = DistributionCrypto.verify(response.getString("token"), "BYND-UPDATE");
        validate(release);
        return release.getLong("versionCode") > BuildConfig.VERSION_CODE ? release : null;
    }
    static void validate(JSONObject release) throws Exception {
        long code = release.getLong("versionCode"), size = release.getLong("size");
        if (code <= 0 || code > Integer.MAX_VALUE || size <= 0 || size > 2L * 1024 * 1024 * 1024
            || !release.getString("versionName").matches("\\d+\\.\\d+\\.\\d+") || !release.getString("sha256").matches("[a-f0-9]{64}")) throw new Exception("更新清单无效。");
        trustedUrl(release.getString("apkUrl"));
        JSONObject log = release.getJSONObject("changelog");
        for (String kind : new String[]{"new", "improved", "fixed"}) {
            JSONArray items = log.getJSONArray(kind);
            if (items.length() > 30) throw new Exception("更新记录过长。");
            for (int i = 0; i < items.length(); i++) if (!(items.get(i) instanceof String) || items.getString(i).length() > 500) throw new Exception("更新记录无效。");
        }
    }
    private static URL trustedUrl(String address) throws Exception {
        URL url = new URL(address);
        Set<String> hosts = new HashSet<>();
        for (String host : BuildConfig.BYND_APK_HOSTS.split(",")) hosts.add(host.trim());
        if (!"https".equals(url.getProtocol()) || url.getUserInfo() != null || url.getRef() != null
            || (url.getPort() != -1 && url.getPort() != 443) || !hosts.contains(url.getHost()) || !url.getPath().endsWith(".apk")) throw new Exception("下载地址不受信任。");
        return url;
    }
    static void autoCheck(Activity activity) {
        if (!BuildConfig.BYND_ENABLE_UPDATES || !checking.compareAndSet(false, true)) return;
        Context context = activity.getApplicationContext();
        long last = context.getSharedPreferences("bynd_updates", Context.MODE_PRIVATE).getLong("last_success", 0);
        long now = System.currentTimeMillis();
        if (now >= last && now - last < 24L * 60 * 60 * 1000) { checking.set(false); return; }
        new Thread(() -> {
            try {
                JSONObject release = check();
                context.getSharedPreferences("bynd_updates", Context.MODE_PRIVATE).edit().putLong("last_success", System.currentTimeMillis()).apply();
                if (release != null) activity.runOnUiThread(() -> {
                    if (!activity.isFinishing() && !activity.isDestroyed()) new AlertDialog.Builder(activity)
                        .setTitle("一封来自 BYND 的版本来信")
                        .setMessage("v" + release.optString("versionName") + " 已准备好，去看看这次的新变化吧。")
                        .setPositiveButton("查看来信", (dialog, which) -> activity.startActivity(new Intent(activity, UpdateActivity.class)))
                        .setNegativeButton("稍后", null).show();
                });
            } catch (Exception ignored) {
                // Optional background checks never block the app. Explicit checks show errors.
            } finally { checking.set(false); }
        }, "bynd-update-check").start();
    }
    interface Progress { void show(String value); }
    static void downloadAndInstall(Context context, JSONObject release, Progress progress) throws Exception {
        if (!BuildConfig.BYND_ENABLE_UPDATES) throw new Exception("更新服务尚未开放。");
        if (!LicenseManager.canEnter(context)) throw new Exception("请先激活 BYND。");
        validate(release);
        if (release.getLong("versionCode") <= BuildConfig.VERSION_CODE) throw new Exception("这是旧版本，已取消安装。");
        if (!downloading.compareAndSet(false, true)) throw new Exception("另一项更新正在下载，请稍后重试。");
        File file = null; HttpURLConnection connection = null;
        try {
            File directory = new File(context.getCacheDir(), "bynd-updates");
            if (!directory.exists() && !directory.mkdirs()) throw new Exception("无法创建下载目录。");
            long size = release.getLong("size");
            if (directory.getUsableSpace() < size * 2 + 16 * 1024 * 1024) throw new Exception("存储空间不足，请释放空间后重试。");
            file = new File(directory, "update.apk.part");
            connection = (HttpURLConnection) trustedUrl(release.getString("apkUrl")).openConnection();
            connection.setInstanceFollowRedirects(false); connection.setConnectTimeout(15000); connection.setReadTimeout(15000);
            connection.setRequestProperty("Accept-Encoding", "identity");
            if (connection.getResponseCode() != 200) throw new Exception("APK 下载失败，请稍后重试。");
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            long received = 0; int lastPercent = -1;
            try (InputStream input = connection.getInputStream(); FileOutputStream output = new FileOutputStream(file)) {
                byte[] buffer = new byte[65536]; int count;
                while ((count = input.read(buffer)) != -1) {
                    received += count; if (received > size) throw new Exception("APK 大小与清单不符，已取消安装。");
                    output.write(buffer, 0, count); digest.update(buffer, 0, count);
                    int percent = (int) (received * 100 / size);
                    if (percent != lastPercent) { lastPercent = percent; progress.show("正在下载 " + percent + "%"); }
                }
                output.getFD().sync();
            }
            StringBuilder hash = new StringBuilder(); for (byte b : digest.digest()) hash.append(String.format(java.util.Locale.ROOT, "%02x", b & 255));
            if (received != size || !release.getString("sha256").equals(hash.toString())) throw new Exception("APK 校验失败，已取消安装，请重新下载。");
            progress.show("正在核对版本与签名…");
            verifyArchive(context, file, release);
            install(context, file, progress);
        } finally {
            if (connection != null) connection.disconnect();
            if (file != null && file.exists() && !file.delete()) file.deleteOnExit();
            downloading.set(false);
        }
    }
    private static void verifyArchive(Context context, File file, JSONObject release) throws Exception {
        PackageManager manager = context.getPackageManager();
        int flags = Build.VERSION.SDK_INT >= 28 ? PackageManager.GET_SIGNING_CERTIFICATES : PackageManager.GET_SIGNATURES;
        PackageInfo archive = manager.getPackageArchiveInfo(file.getAbsolutePath(), flags);
        PackageInfo installed = manager.getPackageInfo(context.getPackageName(), flags);
        if (archive == null || !context.getPackageName().equals(archive.packageName)
            || version(archive) != release.getLong("versionCode") || version(archive) <= version(installed)
            || !release.getString("versionName").equals(archive.versionName) || !certificates(archive).equals(certificates(installed)) || certificates(archive).isEmpty()) throw new Exception("安装包的包名、版本或签名不匹配，已取消安装。");
    }
    private static long version(PackageInfo info) { return Build.VERSION.SDK_INT >= 28 ? info.getLongVersionCode() : info.versionCode; }
    private static Set<String> certificates(PackageInfo info) throws Exception {
        Signature[] values = Build.VERSION.SDK_INT >= 28 && info.signingInfo != null ? info.signingInfo.getApkContentsSigners() : info.signatures;
        Set<String> result = new HashSet<>();
        if (values != null) for (Signature value : values) result.add(DistributionCrypto.fingerprint(value.toByteArray()));
        return result;
    }
    private static void install(Context context, File file, Progress progress) throws Exception {
        PackageInstaller installer = context.getPackageManager().getPackageInstaller();
        PackageInstaller.SessionParams params = new PackageInstaller.SessionParams(PackageInstaller.SessionParams.MODE_FULL_INSTALL);
        params.setAppPackageName(context.getPackageName()); params.setSize(file.length());
        if (Build.VERSION.SDK_INT >= 31) params.setRequireUserAction(PackageInstaller.SessionParams.USER_ACTION_REQUIRED);
        int id = installer.createSession(params); boolean committed = false;
        try (PackageInstaller.Session session = installer.openSession(id)) {
            try (InputStream input = new java.io.FileInputStream(file); OutputStream output = session.openWrite("base.apk", 0, file.length())) {
                byte[] buffer = new byte[65536]; int count; while ((count = input.read(buffer)) != -1) output.write(buffer, 0, count);
                session.fsync(output);
            }
            Intent callback = new Intent(context, UpdateInstallReceiver.class);
            int flags = PendingIntent.FLAG_UPDATE_CURRENT;
            if (Build.VERSION.SDK_INT >= 31) flags |= PendingIntent.FLAG_MUTABLE;
            PendingIntent result = PendingIntent.getBroadcast(context, id, callback, flags);
            session.commit(result.getIntentSender()); committed = true;
            progress.show("已交给系统安装，请在系统界面确认。取消安装后可重新下载。");
        } finally { if (!committed) installer.abandonSession(id); }
    }
}
