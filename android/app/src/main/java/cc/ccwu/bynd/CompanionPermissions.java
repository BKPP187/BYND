package cc.ccwu.bynd;

import android.app.Activity;
import android.app.AppOpsManager;
import android.app.NotificationManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
import android.os.Process;
import android.provider.Settings;

import org.json.JSONObject;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/** Permission state and best-effort settings pages for 后台陪伴, including OEM-specific screens. */
final class CompanionPermissions {
    private CompanionPermissions() {}

    static boolean overlay(Context context) {
        return Build.VERSION.SDK_INT < Build.VERSION_CODES.M || Settings.canDrawOverlays(context);
    }

    static boolean notifications(Context context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.N) return true;
        NotificationManager manager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        return manager == null || manager.areNotificationsEnabled();
    }

    static boolean battery(Context context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) return true;
        PowerManager power = (PowerManager) context.getSystemService(Context.POWER_SERVICE);
        return power != null && power.isIgnoringBatteryOptimizations(context.getPackageName());
    }

    @SuppressWarnings("deprecation")
    static boolean usage(Context context) {
        try {
            AppOpsManager ops = (AppOpsManager) context.getSystemService(Context.APP_OPS_SERVICE);
            int mode = ops.checkOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), context.getPackageName());
            if (mode == AppOpsManager.MODE_DEFAULT) {
                return context.checkCallingOrSelfPermission("android.permission.PACKAGE_USAGE_STATS") == android.content.pm.PackageManager.PERMISSION_GRANTED;
            }
            return mode == AppOpsManager.MODE_ALLOWED;
        } catch (Exception error) {
            return false;
        }
    }

    static String oem() {
        String value = (Build.MANUFACTURER + " " + Build.BRAND).toLowerCase(Locale.ROOT);
        if (value.contains("xiaomi") || value.contains("redmi") || value.contains("poco")) return "xiaomi";
        if (value.contains("honor")) return "honor";
        if (value.contains("huawei")) return "huawei";
        if (value.contains("oppo") || value.contains("realme") || value.contains("oneplus")) return "oppo";
        if (value.contains("vivo") || value.contains("iqoo")) return "vivo";
        return "other";
    }

    static JSONObject status(Context context) {
        JSONObject result = ScreenCompanionService.runtimeStatus();
        try {
            result.put("available", true);
            result.put("overlay", overlay(context));
            result.put("notifications", notifications(context));
            result.put("battery", battery(context));
            result.put("usage", usage(context));
            result.put("oem", oem());
            result.put("sdk", Build.VERSION.SDK_INT);
            result.put("enabled", ScreenCompanionService.prefs(context).getBoolean("enabled", false));
        } catch (Exception ignored) {}
        return result;
    }

    private static Intent component(String pkg, String cls) {
        return new Intent().setComponent(new ComponentName(pkg, cls)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
    }

    private static Intent launch(Context context, String pkg) {
        Intent intent = context.getPackageManager().getLaunchIntentForPackage(pkg);
        return intent == null ? null : intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
    }

    /** Opens the best matching settings page; returns "opened", "fallback" (app details) or "failed". */
    static String open(Activity activity, String kind) {
        String pkg = activity.getPackageName();
        Uri uri = Uri.parse("package:" + pkg);
        String oem = oem();
        List<Intent> candidates = new ArrayList<>();
        switch (kind == null ? "" : kind) {
            case "overlay":
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) candidates.add(new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, uri));
                if ("xiaomi".equals(oem)) candidates.add(new Intent("miui.intent.action.APP_PERM_EDITOR").setPackage("com.miui.securitycenter").putExtra("extra_pkgname", pkg));
                break;
            case "notifications":
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) candidates.add(new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, pkg));
                break;
            case "battery":
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    candidates.add(new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, uri));
                    candidates.add(new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS));
                }
                break;
            case "usage":
                candidates.add(new Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS, uri));
                candidates.add(new Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS));
                break;
            case "autostart":
                if ("xiaomi".equals(oem)) candidates.add(component("com.miui.securitycenter", "com.miui.permcenter.autostart.AutoStartManagementActivity"));
                if ("huawei".equals(oem) || "honor".equals(oem)) {
                    candidates.add(component("com.hihonor.systemmanager", "com.hihonor.systemmanager.startupmgr.ui.StartupNormalAppListActivity"));
                    candidates.add(component("com.huawei.systemmanager", "com.huawei.systemmanager.startupmgr.ui.StartupNormalAppListActivity"));
                    candidates.add(component("com.huawei.systemmanager", "com.huawei.systemmanager.appcontrol.activity.StartupAppControlActivity"));
                }
                if ("oppo".equals(oem)) {
                    candidates.add(component("com.coloros.safecenter", "com.coloros.safecenter.permission.startup.StartupAppListActivity"));
                    candidates.add(component("com.coloros.safecenter", "com.coloros.safecenter.startupapp.StartupAppListActivity"));
                    candidates.add(component("com.oplus.safecenter", "com.oplus.safecenter.permission.startup.StartupAppListActivity"));
                }
                if ("vivo".equals(oem)) {
                    candidates.add(component("com.vivo.permissionmanager", "com.vivo.permissionmanager.activity.BgStartUpManagerActivity"));
                    candidates.add(component("com.iqoo.secure", "com.iqoo.secure.ui.phoneoptimize.BgStartUpManager"));
                }
                break;
            case "popup":
                if ("xiaomi".equals(oem)) {
                    candidates.add(new Intent("miui.intent.action.APP_PERM_EDITOR").setPackage("com.miui.securitycenter").putExtra("extra_pkgname", pkg));
                    candidates.add(component("com.miui.securitycenter", "com.miui.permcenter.permissions.PermissionsEditorActivity").putExtra("extra_pkgname", pkg));
                }
                if ("vivo".equals(oem)) candidates.add(component("com.vivo.permissionmanager", "com.vivo.permissionmanager.activity.SoftPermissionDetailActivity").putExtra("packagename", pkg));
                if ("oppo".equals(oem)) candidates.add(component("com.coloros.safecenter", "com.coloros.safecenter.sysfloatwindow.FloatWindowListActivity"));
                if ("huawei".equals(oem)) candidates.add(component("com.huawei.systemmanager", "com.huawei.systemmanager.addviewmonitor.AddViewMonitorActivity"));
                break;
            case "power":
                if ("xiaomi".equals(oem)) candidates.add(component("com.miui.powerkeeper", "com.miui.powerkeeper.ui.HiddenAppsConfigActivity").putExtra("package_name", pkg).putExtra("package_label", "BYND"));
                if ("huawei".equals(oem)) candidates.add(component("com.huawei.systemmanager", "com.huawei.systemmanager.power.ui.HwPowerManagerActivity"));
                if ("oppo".equals(oem)) candidates.add(component("com.coloros.oppoguardelf", "com.coloros.powermanager.fuelgaue.PowerUsageModelActivity"));
                if ("vivo".equals(oem)) candidates.add(component("com.iqoo.powersaving", "com.iqoo.powersaving.PowerSavingManagerActivity"));
                break;
            case "game":
                if ("xiaomi".equals(oem)) candidates.add(component("com.miui.securitycenter", "com.miui.gamebooster.ui.GameBoosterMainActivity"));
                for (String game : new String[] { "com.huawei.gameassistant", "com.hihonor.gameassistant", "com.oplus.games", "com.coloros.gamespace", "com.vivo.gamecube", "com.vivo.gamewatch" }) {
                    Intent intent = launch(activity, game);
                    if (intent != null) candidates.add(intent);
                }
                break;
            default:
                break;
        }
        for (Intent intent : candidates) {
            try {
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                activity.startActivity(intent);
                return "opened";
            } catch (Exception ignored) {}
        }
        try {
            activity.startActivity(new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, uri).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
            return "fallback";
        } catch (Exception error) {
            return "failed";
        }
    }
}
