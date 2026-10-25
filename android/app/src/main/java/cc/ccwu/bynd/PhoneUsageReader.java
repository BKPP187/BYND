package cc.ccwu.bynd;

import android.app.usage.UsageEvents;
import android.app.usage.UsageStatsManager;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.os.Build;

import org.json.JSONArray;
import org.json.JSONObject;

import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Calendar;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * 手机使用情况: daily per-app foreground time and opens from the system usage events.
 * Needs the user-granted usage access (Settings.ACTION_USAGE_ACCESS_SETTINGS). Nothing leaves the
 * device here; the page keeps up to 30 days and decides per character what may be shared.
 * The system itself keeps detailed events for only about a week, so this reads at most 10 days.
 */
final class PhoneUsageReader {
    private PhoneUsageReader() {}

    static final int MAX_DAYS = 10;
    private static final int MAX_APPS_PER_DAY = 40;
    private static final long MIN_FOREGROUND_MS = 1000;
    private static final long LATE_NIGHT_MS = 5L * 60 * 60 * 1000;

    private static final class Day {
        final String date;
        final long start;
        final long end;
        final Map<String, long[]> apps = new HashMap<>(); // package -> [foreground ms, opens]
        long first = -1;
        long last = -1;
        long lateNight = -1; // last use before 05:00 that day: "还在用到凌晨几点"
        Day(String date, long start, long end) { this.date = date; this.start = start; this.end = end; }
    }

    static String read(Context context, int requestedDays) {
        JSONObject result = new JSONObject();
        try {
            result.put("version", 1);
            boolean granted = CompanionPermissions.usage(context);
            result.put("granted", granted);
            if (!granted) return result.put("ok", false).put("error", "usage-access-denied").toString();
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.LOLLIPOP_MR1) return result.put("ok", false).put("error", "unsupported").toString();
            UsageStatsManager manager = (UsageStatsManager) context.getSystemService(Context.USAGE_STATS_SERVICE);
            if (manager == null) return result.put("ok", false).put("error", "unavailable").toString();

            int days = Math.max(1, Math.min(MAX_DAYS, requestedDays));
            long now = System.currentTimeMillis();
            List<Day> range = dayRange(days, now);
            Set<String> ignored = ignoredPackages(context);

            UsageEvents events = manager.queryEvents(range.get(0).start, now);
            UsageEvents.Event event = new UsageEvents.Event();
            String current = null;
            long currentSince = 0;
            while (events != null && events.hasNextEvent()) {
                events.getNextEvent(event);
                int type = event.getEventType();
                String pkg = event.getPackageName();
                long at = event.getTimeStamp();
                if (pkg == null) continue;
                // MOVE_TO_FOREGROUND/BACKGROUND share their values with ACTIVITY_RESUMED/PAUSED on newer releases.
                if (type == UsageEvents.Event.MOVE_TO_FOREGROUND) {
                    if (current != null && !current.equals(pkg)) add(range, ignored, current, currentSince, at, false);
                    if (!pkg.equals(current)) {
                        if (!ignored.contains(pkg)) countOpen(range, pkg, at);
                        current = pkg;
                        currentSince = at;
                    }
                } else if (type == UsageEvents.Event.MOVE_TO_BACKGROUND && pkg.equals(current)) {
                    add(range, ignored, current, currentSince, at, false);
                    current = null;
                } else if (isScreenOff(type) && current != null) {
                    add(range, ignored, current, currentSince, at, false);
                    current = null;
                }
            }
            if (current != null) add(range, ignored, current, currentSince, now, true);

            PackageManager packages = context.getPackageManager();
            JSONArray out = new JSONArray();
            for (Day day : range) {
                // minSdk 23: no List.removeIf / List.sort.
                List<Map.Entry<String, long[]>> rows = new ArrayList<>();
                for (Map.Entry<String, long[]> row : day.apps.entrySet()) {
                    if (row.getValue()[0] >= MIN_FOREGROUND_MS || row.getValue()[1] > 0) rows.add(row);
                }
                Collections.sort(rows, new Comparator<Map.Entry<String, long[]>>() {
                    @Override public int compare(Map.Entry<String, long[]> a, Map.Entry<String, long[]> b) { return Long.compare(b.getValue()[0], a.getValue()[0]); }
                });
                long total = 0;
                JSONArray apps = new JSONArray();
                for (Map.Entry<String, long[]> row : rows) {
                    total += row.getValue()[0];
                    if (apps.length() >= MAX_APPS_PER_DAY) continue;
                    apps.put(new JSONObject()
                        .put("package", row.getKey())
                        .put("label", label(packages, row.getKey()))
                        .put("minutes", Math.round(row.getValue()[0] / 60000.0))
                        .put("opens", row.getValue()[1]));
                }
                JSONObject item = new JSONObject()
                    .put("date", day.date)
                    .put("totalMinutes", Math.round(total / 60000.0))
                    .put("apps", apps)
                    .put("partial", day.end > now);
                if (day.first >= 0) item.put("firstUseAt", day.first);
                if (day.last >= 0) item.put("lastUseAt", day.last);
                if (day.lateNight >= 0) item.put("lateNightUntil", day.lateNight);
                out.put(item);
            }
            return result.put("ok", true).put("observedAt", now).put("days", out).toString();
        } catch (Exception error) {
            try { return result.put("ok", false).put("error", "read-failed").put("message", String.valueOf(error.getMessage())).toString(); }
            catch (Exception ignored) { return "{\"version\":1,\"ok\":false,\"error\":\"read-failed\"}"; }
        }
    }

    private static boolean isScreenOff(int type) {
        // SCREEN_NON_INTERACTIVE (16) and KEYGUARD_SHOWN (17) exist from API 28.
        return Build.VERSION.SDK_INT >= Build.VERSION_CODES.P && (type == 16 || type == 17);
    }

    private static List<Day> dayRange(int days, long now) {
        SimpleDateFormat format = new SimpleDateFormat("yyyy-MM-dd", Locale.US);
        Calendar calendar = Calendar.getInstance();
        calendar.setTimeInMillis(now);
        calendar.set(Calendar.HOUR_OF_DAY, 0);
        calendar.set(Calendar.MINUTE, 0);
        calendar.set(Calendar.SECOND, 0);
        calendar.set(Calendar.MILLISECOND, 0);
        calendar.add(Calendar.DAY_OF_YEAR, -(days - 1));
        List<Day> range = new ArrayList<>();
        for (int i = 0; i < days; i++) {
            long start = calendar.getTimeInMillis();
            String date = format.format(calendar.getTime());
            calendar.add(Calendar.DAY_OF_YEAR, 1); // Calendar keeps local midnight across DST changes.
            range.add(new Day(date, start, calendar.getTimeInMillis()));
        }
        return range;
    }

    // Splits one foreground interval across local days.
    private static void add(List<Day> range, Set<String> ignored, String pkg, long from, long to, boolean open) {
        if (ignored.contains(pkg) || to <= from) return;
        for (Day day : range) {
            long start = Math.max(from, day.start);
            long end = Math.min(to, day.end);
            if (end <= start) continue;
            long[] row = day.apps.get(pkg);
            if (row == null) { row = new long[2]; day.apps.put(pkg, row); }
            row[0] += end - start;
            if (day.first < 0 || start < day.first) day.first = start;
            if (end > day.last) day.last = end;
            long lateEnd = Math.min(end, day.start + LATE_NIGHT_MS);
            if (lateEnd > start && lateEnd > day.lateNight) day.lateNight = lateEnd;
        }
    }

    private static void countOpen(List<Day> range, String pkg, long at) {
        for (Day day : range) {
            if (at < day.start || at >= day.end) continue;
            long[] row = day.apps.get(pkg);
            if (row == null) { row = new long[2]; day.apps.put(pkg, row); }
            row[1] += 1;
        }
    }

    // BYND itself, the system UI and home launchers are not "using the phone" for a character to see.
    private static Set<String> ignoredPackages(Context context) {
        Set<String> ignored = new HashSet<>();
        ignored.add(context.getPackageName());
        ignored.add("android");
        ignored.add("com.android.systemui");
        try {
            Intent home = new Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_HOME);
            for (ResolveInfo info : context.getPackageManager().queryIntentActivities(home, 0)) {
                if (info.activityInfo != null) ignored.add(info.activityInfo.packageName);
            }
        } catch (Exception ignoredError) {}
        return ignored;
    }

    private static String label(PackageManager packages, String pkg) {
        try {
            ApplicationInfo info = packages.getApplicationInfo(pkg, 0);
            CharSequence label = packages.getApplicationLabel(info);
            return label == null ? pkg : label.toString();
        } catch (Exception error) {
            return pkg;
        }
    }
}
