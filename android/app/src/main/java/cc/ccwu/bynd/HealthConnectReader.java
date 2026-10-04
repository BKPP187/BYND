package cc.ccwu.bynd;

import android.app.Activity;
import android.content.Context;
import android.content.pm.PackageManager;
import android.health.connect.HealthConnectException;
import android.health.connect.HealthConnectManager;
import android.health.connect.ReadRecordsRequestUsingFilters;
import android.health.connect.ReadRecordsResponse;
import android.health.connect.TimeInstantRangeFilter;
import android.health.connect.datatypes.MenstruationFlowRecord;
import android.health.connect.datatypes.MenstruationPeriodRecord;
import android.health.connect.datatypes.Record;
import android.os.Handler;
import android.os.Looper;
import android.os.OutcomeReceiver;
import org.json.JSONArray;
import org.json.JSONObject;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.TreeSet;
import java.util.function.Consumer;

/** API 34+ only. Read-only, foreground, cycle-only: no other health permission is requested. */
final class HealthConnectReader {
    static final int PERMISSION_REQUEST = 7316;
    private static final String READ_PERMISSION = "android.permission.health.READ_MENSTRUATION";
    private final Activity activity;
    private final Consumer<JSONObject> reply;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private String activeId;
    private String permissionId;
    private Runnable deadline;

    HealthConnectReader(Activity activity, Consumer<JSONObject> reply) {
        this.activity = activity;
        this.reply = reply;
    }

    static boolean available(Context context) {
        return context.getSystemService(HealthConnectManager.class) != null;
    }

    void request(String payload) {
        String id = "";
        try {
            if (payload == null || payload.length() > 2048) throw new IllegalArgumentException("健康请求格式无效");
            JSONObject request = new JSONObject(payload);
            id = request.getString("id");
            if (!id.matches("[a-zA-Z0-9_-]{1,128}")) return;
            JSONArray types = request.getJSONArray("types");
            if (types.length() != 1 || !"cycle".equals(types.getString(0))) throw new IllegalArgumentException("Android 当前仅支持读取经期日期");
            String action = request.getString("action");
            if (!"authorize".equals(action) && !"read".equals(action)) throw new IllegalArgumentException("健康操作无效");
            if (activeId != null || permissionId != null) throw new IllegalStateException("健康读取正在进行，请稍后重试");
            if (!available(activity)) throw new IllegalStateException("请启用或更新系统 Health Connect");
            activeId = id;
            final String requestId = id;
            deadline = () -> finish(requestId, null, "健康读取超时，请重试");
            handler.postDelayed(deadline, 55000);
            if ("authorize".equals(action)) {
                if (granted()) finish(id, new JSONObject(), null);
                else { permissionId = id; activity.requestPermissions(new String[] { READ_PERMISSION }, PERMISSION_REQUEST); }
            } else {
                if (!granted()) throw new SecurityException("经期读取权限未授权或已撤销，请重新连接");
                read(id);
            }
        } catch (Exception error) {
            if (id.equals(activeId)) finish(id, null, error.getMessage());
            else send(id, null, error.getMessage());
        }
    }

    private boolean granted() { return activity.checkSelfPermission(READ_PERMISSION) == PackageManager.PERMISSION_GRANTED; }

    void onPermissionsResult(int requestCode) {
        if (requestCode != PERMISSION_REQUEST || permissionId == null) return;
        String id = permissionId; permissionId = null;
        finish(id, granted() ? new JSONObject() : null, granted() ? null : "经期读取权限未授权，未读取健康数据");
    }

    private void read(String id) {
        Instant end = Instant.now(), start = end.minus(30, ChronoUnit.DAYS);
        TreeSet<String> days = new TreeSet<>();
        readPages(id, MenstruationFlowRecord.class, start, end, -1, 0, record -> {
            ZoneId zone = record.getZoneOffset() == null ? ZoneId.systemDefault() : record.getZoneOffset();
            addDay(days, record.getTime().atZone(zone).toLocalDate());
        }, () -> readPages(id, MenstruationPeriodRecord.class, start, end, -1, 0, record -> {
            ZoneOffset offset = record.getStartZoneOffset();
            ZoneId zone = offset == null ? ZoneId.systemDefault() : offset;
            LocalDate first = record.getStartTime().atZone(zone).toLocalDate();
            LocalDate last = record.getEndTime().minusNanos(1).atZone(zone).toLocalDate();
            LocalDate lower = start.atZone(zone).toLocalDate();
            if (first.isBefore(lower)) first = lower;
            LocalDate upper = LocalDate.now();
            if (last.isAfter(upper)) last = upper;
            for (LocalDate day = first; !day.isAfter(last); day = day.plusDays(1)) addDay(days, day);
        }, () -> {
            try {
                if (!granted()) throw new SecurityException("经期读取权限已撤销");
                JSONObject data = new JSONObject().put("version", 1).put("records", new JSONArray()).put("flowDays", new JSONArray(days));
                finish(id, data, null);
            } catch (Exception error) { finish(id, null, error.getMessage()); }
        }));
    }

    private void addDay(TreeSet<String> days, LocalDate date) {
        if (!date.isAfter(LocalDate.now())) days.add(date.toString());
    }

    private <T extends Record> void readPages(String id, Class<T> type, Instant start, Instant end, long token, int count, Consumer<T> accept, Runnable complete) {
        if (!id.equals(activeId)) return;
        try {
            if (!granted()) throw new SecurityException("经期读取权限已撤销");
            ReadRecordsRequestUsingFilters.Builder<T> builder = new ReadRecordsRequestUsingFilters.Builder<>(type)
                .setTimeRangeFilter(new TimeInstantRangeFilter.Builder().setStartTime(start).setEndTime(end).build())
                .setPageSize(1000).setAscending(true);
            if (token != -1) builder.setPageToken(token);
            activity.getSystemService(HealthConnectManager.class).readRecords(builder.build(), activity.getMainExecutor(),
                new OutcomeReceiver<ReadRecordsResponse<T>, HealthConnectException>() {
                    @Override public void onResult(ReadRecordsResponse<T> result) {
                        if (!id.equals(activeId)) return;
                        try {
                            int total = count + result.getRecords().size();
                            if (total > 10000) throw new IllegalStateException("健康样本过多，未保存部分读取结果");
                            for (T record : result.getRecords()) accept.accept(record);
                            long next = result.getNextPageToken();
                            if (next == -1) complete.run();
                            else if (next == token || result.getRecords().isEmpty()) throw new IllegalStateException("健康分页无效，未保存读取结果");
                            else readPages(id, type, start, end, next, total, accept, complete);
                        } catch (Exception error) { finish(id, null, error.getMessage()); }
                    }
                    @Override public void onError(HealthConnectException error) { finish(id, null, "Health Connect 读取失败：" + error.getMessage()); }
                });
        } catch (Exception error) { finish(id, null, error.getMessage()); }
    }

    private void finish(String id, JSONObject data, String error) {
        if (!id.equals(activeId)) return;
        cancel();
        send(id, data, error);
    }

    private void send(String id, JSONObject data, String error) {
        if (id == null || !id.matches("[a-zA-Z0-9_-]{1,128}")) return;
        try { reply.accept(new JSONObject().put("id", id).put("ok", error == null).put("data", data).put("error", error == null ? "" : error)); }
        catch (org.json.JSONException errorBuildingReply) { throw new IllegalStateException(errorBuildingReply); }
    }

    void cancel() {
        activeId = null;
        if (deadline != null) handler.removeCallbacks(deadline);
        deadline = null;
    }
}
