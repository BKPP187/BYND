package cc.ccwu.bynd;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageInstaller;
import android.widget.Toast;

public final class UpdateInstallReceiver extends BroadcastReceiver {
    @Override public void onReceive(Context context, Intent intent) {
        if (!UpdateInstallState.matches(context, intent.getIntExtra(PackageInstaller.EXTRA_SESSION_ID, -1))) return;
        int status = intent.getIntExtra(PackageInstaller.EXTRA_STATUS, PackageInstaller.STATUS_FAILURE);
        if (status == PackageInstaller.STATUS_PENDING_USER_ACTION) {
            UpdateInstallState.result(context, "等待系统安装确认。", false);
            Intent confirm = intent.getParcelableExtra(Intent.EXTRA_INTENT);
            UpdateInstallState.confirmation(confirm);
            if (confirm != null) {
                try { confirm.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK); context.startActivity(confirm); return; }
                catch (Exception ignored) { }
            }
            Toast.makeText(context, "无法打开系统安装界面，请稍后重试。", Toast.LENGTH_LONG).show();
            try { context.getPackageManager().getPackageInstaller().abandonSession(intent.getIntExtra(PackageInstaller.EXTRA_SESSION_ID, -1)); } catch (Exception ignored) { }
            UpdateInstallState.result(context, "无法打开系统安装界面，请重新下载。", true);
        } else if (status == PackageInstaller.STATUS_SUCCESS) {
            UpdateInstallState.result(context, "BYND 更新已安装。", true);
            Toast.makeText(context, "BYND 更新已安装。", Toast.LENGTH_LONG).show();
        } else {
            String message = status == PackageInstaller.STATUS_FAILURE_ABORTED ? "安装已取消，原版本与数据保留。" : "安装失败，原版本与数据保留，请重试。";
            UpdateInstallState.result(context, message, true);
            Toast.makeText(context, message, Toast.LENGTH_LONG).show();
        }
    }
}
