package cc.ccwu.bynd;

import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageInstaller;

final class UpdateInstallState {
    private static volatile Intent confirmation;
    private static SharedPreferences prefs(Context context) { return context.getSharedPreferences("bynd_update_install", Context.MODE_PRIVATE); }
    static void pending(Context context, int session, long version) throws Exception {
        confirmation = null;
        if (!prefs(context).edit().putInt("session", session).putLong("target_version", version).putString("message", "等待系统安装确认。").commit()) throw new Exception("无法保存安装状态，请重试。");
    }
    static boolean matches(Context context, int session) { return session >= 0 && prefs(context).getInt("session", -1) == session; }
    static void result(Context context, String message, boolean complete) {
        SharedPreferences.Editor edit = prefs(context).edit().putString("message", message);
        if (complete) { edit.remove("session"); confirmation = null; }
        edit.commit();
    }
    static String message(Context context) {
        SharedPreferences saved = prefs(context); int id = saved.getInt("session", -1);
        if (id >= 0 && context.getPackageManager().getPackageInstaller().getSessionInfo(id) == null) {
            String message = BuildConfig.VERSION_CODE >= saved.getLong("target_version", Long.MAX_VALUE) ? "BYND 更新已安装。" : "上次安装未完成，原版本与数据保留，可重新下载。";
            result(context, message, true); return message;
        }
        return saved.getString("message", "");
    }
    static boolean isPending(Context context) { message(context); return prefs(context).getInt("session", -1) >= 0; }
    static void confirmation(Intent value) { confirmation = value == null ? null : new Intent(value); }
    static Intent confirmation() { return confirmation == null ? null : new Intent(confirmation); }
    static void abandon(Context context) throws Exception {
        int id = prefs(context).getInt("session", -1);
        if (id >= 0) context.getPackageManager().getPackageInstaller().abandonSession(id);
        result(context, "已取消上次安装，可以重新下载。原版本与数据保留。", true);
    }
}
