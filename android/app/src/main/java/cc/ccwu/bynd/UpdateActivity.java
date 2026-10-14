package cc.ccwu.bynd;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
import android.view.View;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import org.json.JSONArray;
import org.json.JSONObject;

public final class UpdateActivity extends Activity {
    private LinearLayout content;
    private TextView status;
    private Button action;
    private JSONObject release;
    private boolean busy;
    private int padding;
    private final java.util.concurrent.atomic.AtomicBoolean cancelled = new java.util.concurrent.atomic.AtomicBoolean();
    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        if (!LicenseManager.canEnter(this)) { finish(); return; }
        padding = Math.round(24 * getResources().getDisplayMetrics().density);
        getWindow().setStatusBarColor(Color.rgb(250, 249, 245)); getWindow().setNavigationBarColor(Color.rgb(250, 249, 245));
        getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR);
        ScrollView scroll = new ScrollView(this); content = new LinearLayout(this); content.setOrientation(LinearLayout.VERTICAL);
        content.setPadding(padding, padding, padding, padding); content.setBackgroundColor(Color.rgb(250, 249, 245));
        addText("BYND / A LITTLE MORE OF US", 12); addText("一封来自 BYND 的版本来信", 26);
        status = addText("", 15); action = new Button(this); action.setText("检查更新"); content.addView(action);
        action.setOnClickListener(v -> { if (UpdateInstallState.isPending(this)) resumeInstall(); else if (release == null) check(); else download(); });
        Button later = new Button(this); later.setText("稍后／取消下载"); later.setOnClickListener(v -> { cancelled.set(true); finish(); }); content.addView(later);
        scroll.addView(content); setContentView(scroll); check();
    }
    private TextView addText(String text, int size) {
        TextView view = new TextView(this); view.setText(text); view.setTextSize(size); view.setTextColor(Color.rgb(45, 48, 43)); view.setPadding(0, 0, 0, padding); content.addView(view); return view;
    }
    private void check() {
        if (busy) return;
        if (!BuildConfig.BYND_ENABLE_UPDATES) { status.setText("更新服务准备中。当前版本可照常使用。"); action.setEnabled(false); return; }
        busy = true; action.setEnabled(false); status.setText("正在检查更新…");
        new Thread(() -> {
            try {
                JSONObject found = UpdateManager.check();
                runOnUiThread(() -> {
                    if (isFinishing() || isDestroyed()) return;
                    busy = false; release = found; action.setEnabled(true);
                    if (found == null) { status.setText("当前没有可用的新版本。"); action.setText("重新检查"); return; }
                    status.setText("v" + found.optString("versionName")); action.setText(UpdateInstallState.isPending(this) ? "继续系统安装" : "下载更新");
                    JSONObject log = found.optJSONObject("changelog");
                    for (String kind : new String[]{"new", "improved", "fixed"}) {
                        JSONArray items = log == null ? null : log.optJSONArray(kind);
                        if (items == null || items.length() == 0) continue;
                        addText(kind.toUpperCase(java.util.Locale.ROOT), 13);
                        for (int i = 0; i < items.length(); i++) addText("· " + items.optString(i), 16);
                    }
                });
            } catch (Exception error) { runOnUiThread(() -> fail(error)); }
        }, "bynd-update-manual").start();
    }
    private void fail(Exception error) {
        if (isFinishing() || isDestroyed()) return;
        busy = false; status.setText(error.getMessage() == null ? "操作失败，请检查网络后重试。" : error.getMessage()); action.setEnabled(true);
    }
    private void download() {
        if (busy) return;
        if (Build.VERSION.SDK_INT >= 26 && !getPackageManager().canRequestPackageInstalls()) {
            status.setText("请先允许 BYND 安装应用，返回后再点「下载更新」。");
            try { startActivity(new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + getPackageName()))); }
            catch (Exception error) { status.setText("无法打开安装权限设置，请在系统设置中允许 BYND 安装应用。"); }
            return;
        }
        busy = true; cancelled.set(false); action.setEnabled(false);
        JSONObject selected = release;
        new Thread(() -> {
            try {
                UpdateManager.downloadAndInstall(getApplicationContext(), selected, new UpdateManager.Progress() {
                    @Override public void show(String message) { runOnUiThread(() -> { if (!isFinishing() && !isDestroyed()) status.setText(message); }); }
                    @Override public boolean cancelled() { return cancelled.get(); }
                });
                runOnUiThread(() -> { if (!isFinishing() && !isDestroyed()) { busy = false; action.setEnabled(true); } });
            } catch (Exception error) { runOnUiThread(() -> fail(error)); }
        }, "bynd-update-download").start();
    }
    private void resumeInstall() {
        Intent confirm = UpdateInstallState.confirmation();
        if (confirm != null) {
            try { startActivity(confirm); return; }
            catch (Exception error) { status.setText("无法继续系统安装，可以取消上次安装后重新下载。"); }
        }
        new android.app.AlertDialog.Builder(this).setTitle("重新准备安装")
            .setMessage("上次的安装确认已中断或还在准备。取消上次安装后重新下载？原版本与数据会保留。")
            .setPositiveButton("重新准备", (dialog, which) -> {
                try { UpdateInstallState.abandon(this); if (release == null) check(); else download(); }
                catch (Exception error) { fail(error); }
            }).setNegativeButton("稍后", null).show();
    }
    @Override protected void onResume() {
        super.onResume();
        String message = UpdateInstallState.message(this);
        if (status != null && !message.isEmpty()) status.setText(message);
        if (action != null && UpdateInstallState.isPending(this)) action.setText("继续系统安装");
    }
    @Override public void onBackPressed() { cancelled.set(true); super.onBackPressed(); }
    @Override protected void onDestroy() { if (isFinishing()) cancelled.set(true); super.onDestroy(); }
}
