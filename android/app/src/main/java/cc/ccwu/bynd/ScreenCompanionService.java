package cc.ccwu.bynd;

import android.animation.ValueAnimator;
import android.app.KeyguardManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.app.usage.UsageEvents;
import android.app.usage.UsageStatsManager;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.content.pm.ServiceInfo;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Color;
import android.graphics.ImageDecoder;
import android.graphics.PixelFormat;
import android.graphics.drawable.AnimatedImageDrawable;
import android.graphics.drawable.BitmapDrawable;
import android.graphics.drawable.Drawable;
import android.graphics.drawable.GradientDrawable;
import android.graphics.drawable.Icon;
import android.hardware.display.DisplayManager;
import android.hardware.display.VirtualDisplay;
import android.media.Image;
import android.media.ImageReader;
import android.media.projection.MediaProjection;
import android.media.projection.MediaProjectionManager;
import android.os.Build;
import android.os.Handler;
import android.os.HandlerThread;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;
import android.provider.Settings;
import android.util.Base64;
import android.util.DisplayMetrics;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.View;
import android.view.ViewConfiguration;
import android.view.WindowManager;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.TextView;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.nio.ByteBuffer;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * 后台陪伴: a foreground service hosting a small floating pet over other apps.
 * The overlay window only covers the pet's own bounds (not focusable, not touch-modal), so every
 * touch outside it reaches the app underneath. Knowing the foreground app needs usage access;
 * screen frames need a MediaProjection consent that lives only as long as this service.
 */
public class ScreenCompanionService extends Service {
    static final String PREFS = "bynd_companion";
    static final String ACTION_SYNC = "cc.ccwu.bynd.companion.SYNC";
    static final String ACTION_PAUSE = "cc.ccwu.bynd.companion.PAUSE";
    static final String ACTION_SHOW = "cc.ccwu.bynd.companion.SHOW";
    static final String ACTION_CLOSE = "cc.ccwu.bynd.companion.CLOSE";
    static final String ACTION_PROJECTION = "cc.ccwu.bynd.companion.PROJECTION";
    static final String EXTRA_RESULT_CODE = "resultCode";
    static final String EXTRA_RESULT_DATA = "resultData";
    private static final String CHANNEL = "bynd_companion";
    private static final int NOTIFICATION_ID = 7401;
    private static final long POLL_MS = 5000;
    private static final long SETTLE_MS = 6000;
    private static final int CAPTURE_LONG_SIDE = 480;
    private static final int JPEG_QUALITY = 60;
    private static final int HASH_CHANGE_BITS = 6;

    /** Delivers native events to the WebView; set by MainActivity while it exists. Main thread only. */
    interface Bridge {
        void onContext(String json);
        void onState(String json);
    }

    static volatile ScreenCompanionService instance;
    static Bridge bridge;
    static boolean appForeground = false;
    private static String lastExternalPackage = "";
    private static String lastExternalLabel = "";

    private final Handler main = new Handler(Looper.getMainLooper());
    private HandlerThread worker;
    private Handler workerHandler;
    private WindowManager windowManager;
    private WindowManager.LayoutParams layoutParams;
    private LinearLayout root;
    private TextView bubble;
    private ImageView pet;
    private ImageView tab;
    private LinearLayout menu;
    private TextView pauseItem;
    private boolean attached;
    private boolean collapsed;
    private boolean paused;
    private boolean hiddenByUser;
    private boolean dragging;
    private boolean rightSide = true;
    private final Map<String, Drawable> frames = new HashMap<>();

    private boolean enabled;
    private boolean watchScreen;
    private long intervalMs = 3 * 60 * 1000L;
    private final List<String> exclusions = new ArrayList<>();
    private Set<String> launchers;
    private String charName = "";

    private UsageStatsManager usageStats;
    private long lastEventQuery;
    private String currentPackage;
    private long currentSince;
    private long lastDispatchAt;
    private boolean polling;

    private MediaProjection projection;
    private MediaProjection.Callback projectionCallback;
    private VirtualDisplay virtualDisplay;
    private ImageReader reader;
    private int readerWidth;
    private int readerHeight;
    private boolean capturing;
    private long lastSentHash;
    private boolean hasSentHash;

    // ---- Static entry points used by MainActivity (main thread) ----

    static SharedPreferences prefs(Context context) {
        return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    /** Starts the service when the user enabled 后台陪伴 and granted the overlay; stops it otherwise. */
    static void sync(Context context) {
        boolean wanted = prefs(context).getBoolean("enabled", false) && CompanionPermissions.overlay(context);
        if (wanted) {
            Intent intent = new Intent(context, ScreenCompanionService.class).setAction(ACTION_SYNC);
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) context.startForegroundService(intent);
                else context.startService(intent);
            } catch (Exception ignored) {}
        } else if (instance != null) {
            instance.shutdown();
        }
    }

    static void setAppForeground(Context context, boolean foreground) {
        appForeground = foreground;
        ScreenCompanionService service = instance;
        if (service != null) {
            if (foreground) service.hiddenByUser = false;
            service.refreshOverlay();
            service.updateNotification();
        } else if (foreground) {
            sync(context);
        }
    }

    static void startProjection(Context context, int resultCode, Intent data) {
        Intent intent = new Intent(context, ScreenCompanionService.class).setAction(ACTION_PROJECTION)
                .putExtra(EXTRA_RESULT_CODE, resultCode).putExtra(EXTRA_RESULT_DATA, data);
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) context.startForegroundService(intent);
            else context.startService(intent);
        } catch (Exception ignored) {}
    }

    static void stopProjectionNow() {
        ScreenCompanionService service = instance;
        if (service != null) service.releaseProjection(true);
    }

    static void showBubble(String text, String key) {
        ScreenCompanionService service = instance;
        if (service != null) service.displayBubble(text, key);
    }

    static File frameDir(Context context) {
        File dir = new File(context.getFilesDir(), "companion-frames");
        if (!dir.exists()) dir.mkdirs();
        return dir;
    }

    static boolean validKey(String key) {
        return key != null && key.matches("[a-zA-Z0-9_-]{1,40}");
    }

    static void clearFrames(Context context) {
        File[] files = frameDir(context).listFiles();
        if (files != null) for (File file : files) file.delete();
        ScreenCompanionService service = instance;
        if (service != null) { service.frames.clear(); service.applyIdleFrame(); }
    }

    static boolean saveFrame(Context context, String key, byte[] bytes) {
        if (!validKey(key) || bytes == null || bytes.length == 0 || bytes.length > 3 * 1024 * 1024) return false;
        File[] existing = frameDir(context).listFiles();
        if (existing != null && existing.length >= 16 && !new File(frameDir(context), key + ".img").exists()) return false;
        try (FileOutputStream out = new FileOutputStream(new File(frameDir(context), key + ".img"))) {
            out.write(bytes);
        } catch (Exception error) {
            return false;
        }
        ScreenCompanionService service = instance;
        if (service != null) {
            service.frames.remove(key);
            if ("idle".equals(key)) service.applyIdleFrame();
        }
        return true;
    }

    static JSONObject runtimeStatus() {
        JSONObject result = new JSONObject();
        ScreenCompanionService service = instance;
        try {
            result.put("running", service != null);
            result.put("overlayVisible", service != null && service.attached);
            result.put("paused", service != null && service.paused);
            result.put("hidden", service != null && service.hiddenByUser);
            result.put("collapsed", service != null && service.collapsed);
            result.put("projection", service != null && service.projection != null);
            result.put("lastPackage", lastExternalPackage);
            result.put("lastLabel", lastExternalLabel);
        } catch (Exception ignored) {}
        return result;
    }

    // ---- Service lifecycle ----

    @Override
    public void onCreate() {
        super.onCreate();
        instance = this;
        windowManager = (WindowManager) getSystemService(WINDOW_SERVICE);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP_MR1) usageStats = (UsageStatsManager) getSystemService(Context.USAGE_STATS_SERVICE);
        worker = new HandlerThread("BYND-companion");
        worker.start();
        workerHandler = new Handler(worker.getLooper());
        loadConfig();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        String action = intent != null ? intent.getAction() : ACTION_SYNC;
        boolean wantsProjection = ACTION_PROJECTION.equals(action);
        // Android 14+: the mediaProjection type must be active before getMediaProjection().
        ensureForeground(wantsProjection || projection != null);
        loadConfig();
        if (ACTION_CLOSE.equals(action)) {
            prefs(this).edit().putBoolean("enabled", false).apply();
            enabled = false;
            notifyState("closed");
            shutdown();
            return START_NOT_STICKY;
        }
        if (!enabled || !CompanionPermissions.overlay(this)) {
            shutdown();
            return START_NOT_STICKY;
        }
        if (ACTION_PAUSE.equals(action)) {
            paused = !paused;
            prefs(this).edit().putBoolean("paused", paused).apply();
            notifyState("paused");
        } else if (ACTION_SHOW.equals(action)) {
            hiddenByUser = false;
        } else if (wantsProjection && intent != null) {
            beginProjection(intent.getIntExtra(EXTRA_RESULT_CODE, 0), intent.getParcelableExtra(EXTRA_RESULT_DATA));
        }
        if (!watchScreen && projection != null) releaseProjection(true);
        refreshOverlay();
        updateNotification();
        return START_STICKY;
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public void onDestroy() {
        stopPolling();
        releaseProjection(false);
        detachOverlay();
        if (worker != null) worker.quitSafely();
        if (instance == this) instance = null;
        notifyState("stopped");
        super.onDestroy();
    }

    private void shutdown() {
        stopPolling();
        releaseProjection(false);
        detachOverlay();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) stopForeground(STOP_FOREGROUND_REMOVE);
        else stopForeground(true);
        stopSelf();
    }

    private void loadConfig() {
        SharedPreferences prefs = prefs(this);
        enabled = prefs.getBoolean("enabled", false);
        watchScreen = prefs.getBoolean("watchScreen", false);
        intervalMs = Math.max(1, Math.min(60, prefs.getInt("intervalMin", 3))) * 60 * 1000L;
        paused = prefs.getBoolean("paused", false);
        collapsed = prefs.getBoolean("collapsed", false);
        rightSide = prefs.getBoolean("rightSide", true);
        charName = prefs.getString("charName", "");
        exclusions.clear();
        try {
            JSONArray list = new JSONArray(prefs.getString("exclusions", "[]"));
            for (int i = 0; i < list.length() && i < 400; i++) {
                String value = list.optString(i, "").trim();
                if (!value.isEmpty()) exclusions.add(value);
            }
        } catch (Exception ignored) {}
    }

    // ---- Notification ----

    private Notification buildNotification() {
        NotificationManager manager = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        Notification.Builder builder;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            if (manager.getNotificationChannel(CHANNEL) == null) {
                NotificationChannel channel = new NotificationChannel(CHANNEL, "后台陪伴", NotificationManager.IMPORTANCE_LOW);
                channel.setDescription("桌宠在其他应用上层陪伴时的常驻通知");
                channel.setShowBadge(false);
                manager.createNotificationChannel(channel);
            }
            builder = new Notification.Builder(this, CHANNEL);
        } else {
            builder = new Notification.Builder(this).setPriority(Notification.PRIORITY_LOW);
        }
        String who = charName == null || charName.isEmpty() ? "桌宠" : charName;
        String text = paused ? "已暂停陪看，不读取应用与屏幕"
                : hiddenByUser ? "桌宠已隐藏，轻点「显示」回到屏幕边"
                : projection != null ? "正在陪你看屏幕 · 截图只发给你配置的模型，不保存"
                : "正在陪伴 · 只读取当前应用名称";
        Intent open = getPackageManager().getLaunchIntentForPackage(getPackageName());
        if (open == null) open = new Intent(this, MainActivity.class);
        open.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_RESET_TASK_IF_NEEDED);
        builder.setSmallIcon(R.drawable.ic_stat_companion)
                .setContentTitle(who + " 在陪你")
                .setContentText(text)
                .setOngoing(true)
                .setShowWhen(false)
                .setContentIntent(PendingIntent.getActivity(this, 1, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE));
        Icon icon = Icon.createWithResource(this, R.drawable.ic_stat_companion);
        builder.addAction(new Notification.Action.Builder(icon, paused ? "继续" : "暂停", servicePending(ACTION_PAUSE, 2)).build());
        if (hiddenByUser) builder.addAction(new Notification.Action.Builder(icon, "显示", servicePending(ACTION_SHOW, 3)).build());
        builder.addAction(new Notification.Action.Builder(icon, "关闭", servicePending(ACTION_CLOSE, 4)).build());
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) builder.setForegroundServiceBehavior(Notification.FOREGROUND_SERVICE_IMMEDIATE);
        return builder.build();
    }

    private PendingIntent servicePending(String action, int requestCode) {
        Intent intent = new Intent(this, ScreenCompanionService.class).setAction(action);
        return PendingIntent.getService(this, requestCode, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    private void ensureForeground(boolean projecting) {
        Notification notification = buildNotification();
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                int types = 0;
                if (Build.VERSION.SDK_INT >= 34) types |= ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE;
                if (projecting) types |= ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PROJECTION;
                startForeground(NOTIFICATION_ID, notification, types);
            } else {
                startForeground(NOTIFICATION_ID, notification);
            }
        } catch (Exception error) {
            try { startForeground(NOTIFICATION_ID, notification); } catch (Exception ignored) {}
        }
    }

    private void updateNotification() {
        if (instance != this) return;
        try {
            ((NotificationManager) getSystemService(NOTIFICATION_SERVICE)).notify(NOTIFICATION_ID, buildNotification());
        } catch (Exception ignored) {}
    }

    private void notifyState(String event) {
        Bridge target = bridge;
        if (target == null) return;
        JSONObject state = runtimeStatus();
        try {
            state.put("event", event);
            if ("stopped".equals(event) || "closed".equals(event)) state.put("running", false);
        } catch (Exception ignored) {}
        main.post(() -> { Bridge current = bridge; if (current != null) current.onState(state.toString()); });
    }

    // ---- Overlay ----

    private int dp(float value) {
        return Math.round(TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, value, getResources().getDisplayMetrics()));
    }

    private DisplayMetrics screen() {
        DisplayMetrics metrics = new DisplayMetrics();
        windowManager.getDefaultDisplay().getRealMetrics(metrics);
        return metrics;
    }

    private void refreshOverlay() {
        boolean wanted = enabled && !appForeground && !hiddenByUser && CompanionPermissions.overlay(this);
        if (wanted && !attached) attachOverlay();
        if (!wanted && attached) detachOverlay();
        if (wanted && !paused) startPolling(); else stopPolling();
        if (pet != null) pet.setAlpha(paused ? 0.55f : 1f);
        if (pauseItem != null) pauseItem.setText(paused ? "继续陪看" : "暂停陪看");
    }

    private GradientDrawable rounded(int color, float radiusDp) {
        GradientDrawable drawable = new GradientDrawable();
        drawable.setColor(color);
        drawable.setCornerRadius(dp(radiusDp));
        drawable.setStroke(dp(1), Color.argb(40, 40, 51, 73));
        return drawable;
    }

    private TextView menuItem(String label, View.OnClickListener listener) {
        TextView item = new TextView(this);
        item.setText(label);
        item.setTextSize(TypedValue.COMPLEX_UNIT_SP, 13);
        item.setTextColor(Color.rgb(40, 51, 73));
        item.setPadding(dp(14), dp(9), dp(14), dp(9));
        item.setOnClickListener(listener);
        return item;
    }

    private void attachOverlay() {
        if (root == null) buildOverlay();
        DisplayMetrics metrics = screen();
        SharedPreferences prefs = prefs(this);
        int type = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                ? WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
                : WindowManager.LayoutParams.TYPE_PHONE;
        layoutParams = new WindowManager.LayoutParams(
                WindowManager.LayoutParams.WRAP_CONTENT,
                WindowManager.LayoutParams.WRAP_CONTENT,
                type,
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE
                        | WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL
                        | WindowManager.LayoutParams.FLAG_WATCH_OUTSIDE_TOUCH,
                PixelFormat.TRANSLUCENT);
        layoutParams.gravity = Gravity.TOP | Gravity.START;
        layoutParams.x = rightSide ? metrics.widthPixels - dp(84) : 0;
        layoutParams.y = Math.max(0, Math.min(metrics.heightPixels - dp(120), prefs.getInt("y", Math.round(metrics.heightPixels * 0.35f))));
        applyCollapsed();
        try {
            windowManager.addView(root, layoutParams);
            attached = true;
        } catch (Exception error) {
            attached = false;
        }
    }

    private void detachOverlay() {
        main.removeCallbacks(hideBubble);
        if (attached && root != null) {
            try { windowManager.removeViewImmediate(root); } catch (Exception ignored) {}
        }
        attached = false;
        if (menu != null) menu.setVisibility(View.GONE);
        if (bubble != null) bubble.setVisibility(View.GONE);
    }

    private void buildOverlay() {
        root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setPadding(dp(4), dp(4), dp(4), dp(4));
        bubble = new TextView(this);
        bubble.setTextSize(TypedValue.COMPLEX_UNIT_SP, 13);
        bubble.setTextColor(Color.rgb(40, 51, 73));
        bubble.setMaxWidth(dp(210));
        bubble.setPadding(dp(11), dp(7), dp(11), dp(7));
        bubble.setBackground(rounded(Color.argb(245, 255, 255, 255), 14));
        bubble.setVisibility(View.GONE);
        pet = new ImageView(this);
        pet.setScaleType(ImageView.ScaleType.FIT_CENTER);
        pet.setContentDescription("桌宠");
        tab = new ImageView(this);
        tab.setScaleType(ImageView.ScaleType.CENTER_CROP);
        tab.setBackground(rounded(Color.argb(150, 61, 99, 205), 12));
        tab.setPadding(dp(3), dp(6), dp(3), dp(6));
        tab.setAlpha(0.8f);
        tab.setContentDescription("展开桌宠");
        menu = new LinearLayout(this);
        menu.setOrientation(LinearLayout.VERTICAL);
        menu.setBackground(rounded(Color.WHITE, 14));
        menu.setVisibility(View.GONE);
        menu.addView(menuItem("回到 BYND", view -> openApp()));
        pauseItem = menuItem(paused ? "继续陪看" : "暂停陪看", view -> {
            paused = !paused;
            prefs(this).edit().putBoolean("paused", paused).apply();
            menu.setVisibility(View.GONE);
            refreshOverlay();
            updateNotification();
            notifyState("paused");
        });
        menu.addView(pauseItem);
        menu.addView(menuItem("隐藏", view -> {
            hiddenByUser = true;
            refreshOverlay();
            updateNotification();
            notifyState("hidden");
        }));
        root.addView(bubble, new LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT));
        root.addView(pet, new LinearLayout.LayoutParams(dp(76), dp(76)));
        root.addView(tab, new LinearLayout.LayoutParams(dp(24), dp(52)));
        LinearLayout.LayoutParams menuParams = new LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        menuParams.topMargin = dp(4);
        root.addView(menu, menuParams);
        View.OnTouchListener touch = new DragTouch();
        pet.setOnTouchListener(touch);
        tab.setOnTouchListener(touch);
        root.setOnTouchListener((view, event) -> {
            if (event.getActionMasked() == MotionEvent.ACTION_OUTSIDE && menu.getVisibility() == View.VISIBLE) menu.setVisibility(View.GONE);
            return false;
        });
        // Right-edge pets grow leftwards when the bubble or menu widens the window.
        root.addOnLayoutChangeListener((view, left, top, right, bottom, oldLeft, oldTop, oldRight, oldBottom) -> {
            if (!attached || dragging || !rightSide || layoutParams == null) return;
            int x = Math.max(0, screen().widthPixels - root.getWidth());
            if (layoutParams.x != x) {
                layoutParams.x = x;
                try { windowManager.updateViewLayout(root, layoutParams); } catch (Exception ignored) {}
            }
        });
        applyIdleFrame();
    }

    private void applyCollapsed() {
        if (root == null) return;
        root.setGravity(rightSide ? Gravity.END : Gravity.START);
        pet.setVisibility(collapsed ? View.GONE : View.VISIBLE);
        tab.setVisibility(collapsed ? View.VISIBLE : View.GONE);
        if (collapsed) { bubble.setVisibility(View.GONE); menu.setVisibility(View.GONE); }
        pet.setAlpha(paused ? 0.55f : 1f);
    }

    private void setCollapsed(boolean value) {
        collapsed = value;
        prefs(this).edit().putBoolean("collapsed", collapsed).apply();
        applyCollapsed();
        snapToEdge(false);
    }

    private void openApp() {
        if (menu != null) menu.setVisibility(View.GONE);
        Intent open = getPackageManager().getLaunchIntentForPackage(getPackageName());
        if (open == null) open = new Intent(this, MainActivity.class);
        open.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_RESET_TASK_IF_NEEDED);
        try { startActivity(open); } catch (Exception ignored) {}
    }

    private void snapToEdge(boolean animate) {
        if (!attached || layoutParams == null) return;
        DisplayMetrics metrics = screen();
        int width = Math.max(1, root.getWidth());
        int height = Math.max(1, root.getHeight());
        rightSide = layoutParams.x + width / 2 >= metrics.widthPixels / 2;
        root.setGravity(rightSide ? Gravity.END : Gravity.START);
        int targetX = rightSide ? Math.max(0, metrics.widthPixels - width) : 0;
        layoutParams.y = Math.max(0, Math.min(metrics.heightPixels - height, layoutParams.y));
        prefs(this).edit().putBoolean("rightSide", rightSide).putInt("y", layoutParams.y).apply();
        if (!animate) {
            layoutParams.x = targetX;
            try { windowManager.updateViewLayout(root, layoutParams); } catch (Exception ignored) {}
            return;
        }
        ValueAnimator animator = ValueAnimator.ofInt(layoutParams.x, targetX);
        animator.setDuration(180);
        animator.addUpdateListener(animation -> {
            if (!attached) return;
            layoutParams.x = (int) animation.getAnimatedValue();
            try { windowManager.updateViewLayout(root, layoutParams); } catch (Exception ignored) {}
        });
        animator.start();
    }

    private class DragTouch implements View.OnTouchListener {
        private float downX, downY;
        private int startX, startY;
        private boolean longPressed;
        private final int slop = ViewConfiguration.get(ScreenCompanionService.this).getScaledTouchSlop();
        private final Runnable longPress = () -> {
            longPressed = true;
            // Long press folds the pet into a slim edge tab so it never covers a game.
            if (!collapsed) setCollapsed(true);
        };

        @Override
        public boolean onTouch(View view, MotionEvent event) {
            if (layoutParams == null) return false;
            switch (event.getActionMasked()) {
                case MotionEvent.ACTION_DOWN:
                    downX = event.getRawX(); downY = event.getRawY();
                    startX = layoutParams.x; startY = layoutParams.y;
                    dragging = false; longPressed = false;
                    main.postDelayed(longPress, ViewConfiguration.getLongPressTimeout() + 150);
                    return true;
                case MotionEvent.ACTION_MOVE: {
                    float dx = event.getRawX() - downX, dy = event.getRawY() - downY;
                    if (!dragging && Math.hypot(dx, dy) > slop) { dragging = true; main.removeCallbacks(longPress); }
                    if (dragging) {
                        layoutParams.x = startX + Math.round(dx);
                        layoutParams.y = startY + Math.round(dy);
                        try { windowManager.updateViewLayout(root, layoutParams); } catch (Exception ignored) {}
                    }
                    return true;
                }
                case MotionEvent.ACTION_UP:
                    main.removeCallbacks(longPress);
                    if (dragging) { dragging = false; snapToEdge(true); return true; }
                    if (longPressed) return true;
                    if (collapsed) setCollapsed(false);
                    else {
                        bubble.setVisibility(View.GONE);
                        menu.setVisibility(menu.getVisibility() == View.VISIBLE ? View.GONE : View.VISIBLE);
                    }
                    view.performClick();
                    return true;
                case MotionEvent.ACTION_CANCEL:
                    main.removeCallbacks(longPress);
                    if (dragging) { dragging = false; snapToEdge(true); }
                    return true;
                default:
                    return false;
            }
        }
    }

    private Drawable frame(String key) {
        if (!validKey(key)) return null;
        if (frames.containsKey(key)) return frames.get(key);
        File file = new File(frameDir(this), key + ".img");
        Drawable drawable = null;
        if (file.exists()) {
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                    drawable = ImageDecoder.decodeDrawable(ImageDecoder.createSource(file), (decoder, info, source) -> {
                        int side = Math.max(info.getSize().getWidth(), info.getSize().getHeight());
                        if (side > 360) {
                            float scale = 360f / side;
                            decoder.setTargetSize(Math.max(1, Math.round(info.getSize().getWidth() * scale)), Math.max(1, Math.round(info.getSize().getHeight() * scale)));
                        }
                    });
                    if (drawable instanceof AnimatedImageDrawable) ((AnimatedImageDrawable) drawable).start();
                } else {
                    BitmapFactory.Options options = new BitmapFactory.Options();
                    options.inJustDecodeBounds = true;
                    BitmapFactory.decodeFile(file.getPath(), options);
                    int sample = 1;
                    while (Math.max(options.outWidth, options.outHeight) / sample > 720) sample *= 2;
                    options = new BitmapFactory.Options();
                    options.inSampleSize = sample;
                    Bitmap bitmap = BitmapFactory.decodeFile(file.getPath(), options);
                    if (bitmap != null) drawable = new BitmapDrawable(getResources(), bitmap);
                }
            } catch (Exception ignored) {}
        }
        frames.put(key, drawable);
        return drawable;
    }

    private void applyIdleFrame() {
        if (pet == null) return;
        Drawable idle = frame("idle");
        if (idle == null) idle = getApplicationInfo().loadIcon(getPackageManager());
        pet.setImageDrawable(idle);
        tab.setImageDrawable(idle);
    }

    private final Runnable hideBubble = () -> {
        if (bubble != null) bubble.setVisibility(View.GONE);
        applyIdleFrame();
    };

    private void displayBubble(String text, String key) {
        String content = text == null ? "" : text.trim();
        if (content.isEmpty() || !attached || collapsed || bubble == null) return;
        if (content.length() > 60) content = content.substring(0, 60);
        menu.setVisibility(View.GONE);
        bubble.setText(content);
        bubble.setVisibility(View.VISIBLE);
        Drawable mood = frame(key);
        if (mood != null) pet.setImageDrawable(mood);
        main.removeCallbacks(hideBubble);
        main.postDelayed(hideBubble, Math.min(12000, Math.max(5000, content.length() * 320L)));
    }

    // ---- Foreground app ----

    private void startPolling() {
        if (polling) return;
        polling = true;
        main.post(poll);
    }

    private void stopPolling() {
        polling = false;
        main.removeCallbacks(poll);
        main.removeCallbacks(settle);
    }

    private final Runnable poll = new Runnable() {
        @Override
        public void run() {
            if (!polling) return;
            try { pollForeground(); } catch (Exception ignored) {}
            main.postDelayed(this, POLL_MS);
        }
    };

    private final Runnable settle = () -> {
        if (currentPackage != null && !excluded(currentPackage)) dispatch("switch");
    };

    private boolean screenInUse() {
        PowerManager power = (PowerManager) getSystemService(POWER_SERVICE);
        KeyguardManager keyguard = (KeyguardManager) getSystemService(KEYGUARD_SERVICE);
        boolean interactive = power == null || (Build.VERSION.SDK_INT >= Build.VERSION_CODES.KITKAT_WATCH ? power.isInteractive() : power.isScreenOn());
        return interactive && (keyguard == null || !keyguard.isKeyguardLocked());
    }

    private void pollForeground() {
        if (paused || usageStats == null || !screenInUse()) return;
        String foreground = queryForeground();
        if (foreground == null) return;
        long now = System.currentTimeMillis();
        if (!foreground.equals(currentPackage)) {
            currentPackage = foreground;
            currentSince = now;
            main.removeCallbacks(settle);
            if (!excluded(foreground)) {
                lastExternalPackage = foreground;
                lastExternalLabel = label(foreground);
                // Let the new app settle so quick app hopping never triggers a request.
                main.postDelayed(settle, SETTLE_MS);
            }
            return;
        }
        // Without screen frames a long stay says little, so app-name-only looks are four times rarer.
        long period = watchScreen && projection != null ? intervalMs : intervalMs * 4;
        if (!excluded(foreground) && now - Math.max(lastDispatchAt, currentSince) >= period) dispatch("periodic");
    }

    private String queryForeground() {
        long now = System.currentTimeMillis();
        long from = lastEventQuery == 0 ? now - 10 * 60 * 1000L : lastEventQuery - 2000;
        UsageEvents events = usageStats.queryEvents(from, now);
        lastEventQuery = now;
        if (events == null) return currentPackage;
        UsageEvents.Event event = new UsageEvents.Event();
        String found = null;
        long foundAt = 0;
        while (events.hasNextEvent()) {
            events.getNextEvent(event);
            if (event.getEventType() == UsageEvents.Event.MOVE_TO_FOREGROUND && event.getTimeStamp() >= foundAt) {
                foundAt = event.getTimeStamp();
                found = event.getPackageName();
            }
        }
        return found != null ? found : currentPackage;
    }

    private String label(String packageName) {
        try {
            PackageManager manager = getPackageManager();
            return String.valueOf(manager.getApplicationLabel(manager.getApplicationInfo(packageName, 0)));
        } catch (Exception error) {
            return packageName;
        }
    }

    boolean excluded(String packageName) {
        if (packageName == null || packageName.isEmpty()) return true;
        if (packageName.equals(getPackageName()) || packageName.equals("android") || packageName.equals("com.android.systemui")) return true;
        if (launchers == null) {
            launchers = new HashSet<>();
            try {
                Intent home = new Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_HOME);
                for (ResolveInfo info : getPackageManager().queryIntentActivities(home, 0)) {
                    if (info.activityInfo != null) launchers.add(info.activityInfo.packageName);
                }
            } catch (Exception ignored) {}
        }
        if (launchers.contains(packageName)) return true;
        for (String prefix : exclusions) {
            if (packageName.startsWith(prefix)) return true;
        }
        return false;
    }

    private void dispatch(String reason) {
        final String packageName = currentPackage;
        if (bridge == null || packageName == null || excluded(packageName)) return;
        lastDispatchAt = System.currentTimeMillis();
        if (watchScreen && projection != null && virtualDisplay != null) {
            captureFrame(result -> deliver(reason, packageName, result));
        } else {
            deliver(reason, packageName, null);
        }
    }

    private void deliver(String reason, String packageName, Frame frame) {
        if (!packageName.equals(currentPackage) || paused) return;
        String image = null;
        boolean secure = false;
        if (frame != null) {
            if (frame.black) {
                secure = true;
            } else {
                // A periodic look only speaks when the screen changed meaningfully.
                if ("periodic".equals(reason) && hasSentHash && Long.bitCount(frame.hash ^ lastSentHash) < HASH_CHANGE_BITS) return;
                image = frame.dataUrl;
                lastSentHash = frame.hash;
                hasSentHash = true;
            }
        }
        JSONObject context = new JSONObject();
        try {
            context.put("package", packageName);
            context.put("label", label(packageName));
            context.put("imageDataUrl", image == null ? JSONObject.NULL : image);
            context.put("at", System.currentTimeMillis());
            context.put("reason", reason);
            context.put("secure", secure);
            context.put("watchScreen", watchScreen);
            context.put("projection", projection != null);
            context.put("dwellMs", Math.max(0, System.currentTimeMillis() - currentSince));
        } catch (Exception ignored) {}
        Bridge target = bridge;
        if (target != null) target.onContext(context.toString());
    }

    // ---- Screen frames ----

    private static class Frame {
        String dataUrl;
        long hash;
        boolean black;
    }

    private interface FrameCallback {
        void done(Frame frame);
    }

    private void beginProjection(int resultCode, Intent data) {
        releaseProjection(false);
        MediaProjectionManager manager = (MediaProjectionManager) getSystemService(Context.MEDIA_PROJECTION_SERVICE);
        try {
            if (manager == null || data == null) throw new IllegalStateException("No consent");
            projection = manager.getMediaProjection(resultCode, data);
            if (projection == null) throw new IllegalStateException("No projection");
            projectionCallback = new MediaProjection.Callback() {
                @Override
                public void onStop() {
                    main.post(() -> releaseProjection(true));
                }
            };
            projection.registerCallback(projectionCallback, main);
            int[] size = captureSize();
            reader = ImageReader.newInstance(size[0], size[1], PixelFormat.RGBA_8888, 2);
            readerWidth = size[0];
            readerHeight = size[1];
            // One virtual display per consent (Android 14); its surface stays detached between looks.
            virtualDisplay = projection.createVirtualDisplay("BYND_COMPANION", size[0], size[1], size[2],
                    DisplayManager.VIRTUAL_DISPLAY_FLAG_AUTO_MIRROR, null, null, main);
            hasSentHash = false;
            notifyState("projection");
        } catch (Exception error) {
            releaseProjection(false);
            notifyState("projection-failed");
        }
    }

    private int[] captureSize() {
        DisplayMetrics metrics = screen();
        int width = Math.max(1, metrics.widthPixels), height = Math.max(1, metrics.heightPixels);
        float scale = Math.min(1f, (float) CAPTURE_LONG_SIDE / Math.max(width, height));
        return new int[] { Math.max(2, Math.round(width * scale)), Math.max(2, Math.round(height * scale)), Math.max(72, Math.round(metrics.densityDpi * scale)) };
    }

    private void releaseProjection(boolean notify) {
        boolean had = projection != null;
        capturing = false;
        if (virtualDisplay != null) { try { virtualDisplay.release(); } catch (Exception ignored) {} virtualDisplay = null; }
        if (reader != null) { try { reader.close(); } catch (Exception ignored) {} reader = null; }
        if (projection != null) {
            try { if (projectionCallback != null) projection.unregisterCallback(projectionCallback); } catch (Exception ignored) {}
            try { projection.stop(); } catch (Exception ignored) {}
            projection = null;
        }
        projectionCallback = null;
        if (had && instance == this) {
            ensureForeground(false);
            if (notify) notifyState("projection-ended");
        }
    }

    private void captureFrame(FrameCallback callback) {
        if (capturing || virtualDisplay == null) { callback.done(null); return; }
        capturing = true;
        int[] size = captureSize();
        if (size[0] != readerWidth || size[1] != readerHeight) {
            try {
                if (reader != null) reader.close();
                reader = ImageReader.newInstance(size[0], size[1], PixelFormat.RGBA_8888, 2);
                readerWidth = size[0];
                readerHeight = size[1];
                virtualDisplay.resize(size[0], size[1], size[2]);
            } catch (Exception error) {
                capturing = false;
                callback.done(null);
                return;
            }
        }
        // Hide the pet for the look so the model never comments on its own overlay.
        if (root != null) root.setVisibility(View.INVISIBLE);
        final ImageReader current = reader;
        try { virtualDisplay.setSurface(current.getSurface()); } catch (Exception ignored) {}
        main.postDelayed(() -> {
            Image image = null;
            try { image = current.acquireLatestImage(); } catch (Exception ignored) {}
            try { if (virtualDisplay != null) virtualDisplay.setSurface(null); } catch (Exception ignored) {}
            if (root != null) root.setVisibility(View.VISIBLE);
            final Image acquired = image;
            if (acquired == null) { capturing = false; callback.done(null); return; }
            workerHandler.post(() -> {
                Frame frame = encode(acquired);
                main.post(() -> { capturing = false; callback.done(frame); });
            });
        }, 450);
    }

    private Frame encode(Image image) {
        Bitmap padded = null, cropped = null, tiny = null, hash = null;
        try {
            Image.Plane plane = image.getPlanes()[0];
            ByteBuffer buffer = plane.getBuffer();
            int pixelStride = plane.getPixelStride();
            int rowPadding = Math.max(0, plane.getRowStride() - pixelStride * image.getWidth());
            padded = Bitmap.createBitmap(image.getWidth() + rowPadding / Math.max(1, pixelStride), image.getHeight(), Bitmap.Config.ARGB_8888);
            padded.copyPixelsFromBuffer(buffer);
            cropped = Bitmap.createBitmap(padded, 0, 0, image.getWidth(), image.getHeight());
            Frame frame = new Frame();
            // FLAG_SECURE windows and DRM video come back black: drop the image, keep the app name.
            tiny = Bitmap.createScaledBitmap(cropped, 32, 32, true);
            int[] pixels = new int[32 * 32];
            tiny.getPixels(pixels, 0, 32, 0, 0, 32, 32);
            long sum = 0;
            int max = 0;
            for (int pixel : pixels) {
                int luma = (Color.red(pixel) * 299 + Color.green(pixel) * 587 + Color.blue(pixel) * 114) / 1000;
                sum += luma;
                max = Math.max(max, luma);
            }
            frame.black = sum / pixels.length < 8 && max < 28;
            if (frame.black) return frame;
            hash = Bitmap.createScaledBitmap(cropped, 9, 8, true);
            int[] cells = new int[72];
            hash.getPixels(cells, 0, 9, 0, 0, 9, 8);
            long bits = 0;
            for (int y = 0; y < 8; y++) for (int x = 0; x < 8; x++) {
                int a = cells[y * 9 + x], b = cells[y * 9 + x + 1];
                int left = Color.red(a) + Color.green(a) + Color.blue(a);
                int right = Color.red(b) + Color.green(b) + Color.blue(b);
                bits = (bits << 1) | (left > right ? 1 : 0);
            }
            frame.hash = bits;
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            cropped.compress(Bitmap.CompressFormat.JPEG, JPEG_QUALITY, out);
            // The frame only ever lives in memory; nothing is written to disk.
            frame.dataUrl = "data:image/jpeg;base64," + Base64.encodeToString(out.toByteArray(), Base64.NO_WRAP);
            return frame;
        } catch (Exception error) {
            return null;
        } finally {
            try { image.close(); } catch (Exception ignored) {}
            if (padded != null) padded.recycle();
            if (cropped != null) cropped.recycle();
            if (tiny != null) tiny.recycle();
            if (hash != null) hash.recycle();
        }
    }
}
