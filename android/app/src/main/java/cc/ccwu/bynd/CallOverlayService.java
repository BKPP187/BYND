package cc.ccwu.bynd;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ServiceInfo;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Color;
import android.graphics.PixelFormat;
import android.graphics.drawable.GradientDrawable;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.SystemClock;
import android.util.Base64;
import android.util.DisplayMetrics;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.View;
import android.view.ViewConfiguration;
import android.view.WindowManager;
import android.widget.Chronometer;
import android.widget.ImageView;
import android.widget.LinearLayout;

import org.json.JSONObject;

import java.io.InputStream;

/**
 * Keeps an in-app voice/video call alive while BYND is in the background and, when the user leaves
 * the app, shows a small floating window (avatar + ticking call time) like WeChat's. Tapping it
 * returns to BYND. The ongoing notification carries the same timer when overlays are not allowed.
 */
public class CallOverlayService extends Service {
    static final String ACTION_START = "cc.ccwu.bynd.call.START";
    static final String ACTION_STOP = "cc.ccwu.bynd.call.STOP";
    static final String ACTION_HANGUP = "cc.ccwu.bynd.call.HANGUP";
    static final String EXTRA_JSON = "json";
    private static final String CHANNEL = "bynd-call";
    private static final int NOTIFICATION_ID = 4712;

    /** Lets the activity's page hear "hang up" from the notification. */
    interface Bridge { void onHangup(); }

    static volatile Bridge bridge;
    private static volatile boolean appForeground = true;
    private static CallOverlayService instance;

    private final Handler main = new Handler(Looper.getMainLooper());
    private WindowManager windowManager;
    private LinearLayout root;
    private WindowManager.LayoutParams layoutParams;
    private boolean attached;
    private String name = "通话";
    private String kind = "voice";
    private long acceptedAtWall;
    private Bitmap avatar;

    static void start(Context context, String json) {
        Intent intent = new Intent(context, CallOverlayService.class).setAction(ACTION_START).putExtra(EXTRA_JSON, json);
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) context.startForegroundService(intent);
            else context.startService(intent);
        } catch (Exception ignored) {}
    }

    static void stop(Context context) {
        CallOverlayService service = instance;
        if (service != null) service.shutdown();
    }

    static void setAppForeground(boolean foreground) {
        appForeground = foreground;
        CallOverlayService service = instance;
        if (service != null) service.main.post(service::refreshOverlay);
    }

    @Override
    public IBinder onBind(Intent intent) { return null; }

    @Override
    public void onCreate() {
        super.onCreate();
        instance = this;
        windowManager = (WindowManager) getSystemService(WINDOW_SERVICE);
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        String action = intent != null ? intent.getAction() : null;
        if (ACTION_STOP.equals(action)) { shutdown(); return START_NOT_STICKY; }
        if (ACTION_HANGUP.equals(action)) {
            Bridge target = bridge;
            if (target != null) target.onHangup();
            shutdown();
            return START_NOT_STICKY;
        }
        if (intent != null && intent.hasExtra(EXTRA_JSON)) readConfig(intent.getStringExtra(EXTRA_JSON));
        ensureForeground();
        refreshOverlay();
        // A killed process cannot resume the page's call; do not come back on our own.
        return START_NOT_STICKY;
    }

    private void readConfig(String json) {
        try {
            JSONObject config = new JSONObject(json == null ? "{}" : json);
            String value = config.optString("name", "").trim();
            name = value.isEmpty() ? "通话" : value;
            kind = "video".equals(config.optString("kind")) ? "video" : "voice";
            acceptedAtWall = config.optLong("acceptedAt", System.currentTimeMillis());
            avatar = decodeAvatar(config.optString("avatar", ""));
            if (root != null) bindViews();
        } catch (Exception ignored) {}
    }

    private Bitmap decodeAvatar(String source) {
        try {
            if (source == null || source.isEmpty()) return null;
            if (source.startsWith("data:image/")) {
                int comma = source.indexOf(',');
                if (comma < 0) return null;
                byte[] bytes = Base64.decode(source.substring(comma + 1), Base64.DEFAULT);
                return scaled(BitmapFactory.decodeByteArray(bytes, 0, bytes.length));
            }
            if (source.contains("..") || source.startsWith("/")) return null;
            try (InputStream input = getAssets().open("www/" + source.replaceAll("[?#].*$", ""))) {
                return scaled(BitmapFactory.decodeStream(input));
            }
        } catch (Throwable ignored) {
            return null;
        }
    }

    private Bitmap scaled(Bitmap source) {
        if (source == null) return null;
        int size = dp(52);
        return Bitmap.createScaledBitmap(source, size, size, true);
    }

    // ---- Notification / foreground ----

    private Notification buildNotification() {
        NotificationManager manager = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        Notification.Builder builder;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            if (manager.getNotificationChannel(CHANNEL) == null) {
                NotificationChannel channel = new NotificationChannel(CHANNEL, "通话中", NotificationManager.IMPORTANCE_LOW);
                channel.setDescription("和角色语音或视频通话时的常驻通知");
                channel.setShowBadge(false);
                manager.createNotificationChannel(channel);
            }
            builder = new Notification.Builder(this, CHANNEL);
        } else {
            builder = new Notification.Builder(this).setPriority(Notification.PRIORITY_LOW);
        }
        builder.setSmallIcon(R.drawable.ic_stat_companion)
                .setContentTitle("与 " + name + ("video".equals(kind) ? " 视频通话中" : " 语音通话中"))
                .setContentText("轻点回到通话")
                .setOngoing(true)
                .setShowWhen(true)
                .setWhen(acceptedAtWall > 0 ? acceptedAtWall : System.currentTimeMillis())
                .setUsesChronometer(true)
                .setContentIntent(openAppPending())
                .addAction(new Notification.Action.Builder(
                        android.graphics.drawable.Icon.createWithResource(this, R.drawable.ic_stat_companion), "挂断",
                        PendingIntent.getService(this, 2, new Intent(this, CallOverlayService.class).setAction(ACTION_HANGUP),
                                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE)).build());
        if (avatar != null) builder.setLargeIcon(avatar);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) builder.setForegroundServiceBehavior(Notification.FOREGROUND_SERVICE_IMMEDIATE);
        return builder.build();
    }

    private PendingIntent openAppPending() {
        return PendingIntent.getActivity(this, 1, openAppIntent(), PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    private Intent openAppIntent() {
        Intent open = new Intent(this, MainActivity.class);
        open.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_REORDER_TO_FRONT | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        return open;
    }

    private void ensureForeground() {
        Notification notification = buildNotification();
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                int types = 0;
                // The microphone type keeps listening allowed in the background; it needs RECORD_AUDIO.
                boolean mic = checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED;
                if (mic && Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) types |= ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE;
                if (Build.VERSION.SDK_INT >= 34) types |= ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE;
                if (types == 0) startForeground(NOTIFICATION_ID, notification);
                else startForeground(NOTIFICATION_ID, notification, types);
            } else {
                startForeground(NOTIFICATION_ID, notification);
            }
        } catch (Exception error) {
            try { startForeground(NOTIFICATION_ID, notification); } catch (Exception ignored) {}
        }
    }

    // ---- Floating window ----

    private void refreshOverlay() {
        boolean wanted = instance == this && !appForeground && CompanionPermissions.overlay(this);
        if (wanted && !attached) attachOverlay();
        else if (!wanted && attached) detachOverlay();
    }

    private void buildOverlay() {
        root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setGravity(Gravity.CENTER_HORIZONTAL);
        root.setPadding(dp(8), dp(8), dp(8), dp(7));
        GradientDrawable background = new GradientDrawable();
        background.setColor(Color.argb(214, 28, 28, 30));
        background.setCornerRadius(dp(18));
        root.setBackground(background);
        root.setElevation(dp(8));

        ImageView image = new ImageView(this);
        image.setId(View.generateViewId());
        image.setScaleType(ImageView.ScaleType.CENTER_CROP);
        image.setClipToOutline(true);
        GradientDrawable clip = new GradientDrawable();
        clip.setCornerRadius(dp(13));
        clip.setColor(Color.argb(40, 255, 255, 255));
        image.setBackground(clip);
        root.addView(image, new LinearLayout.LayoutParams(dp(52), dp(52)));

        Chronometer timer = new Chronometer(this);
        timer.setTextColor(Color.WHITE);
        timer.setTextSize(TypedValue.COMPLEX_UNIT_SP, 12);
        timer.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams timerParams = new LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        timerParams.topMargin = dp(5);
        root.addView(timer, timerParams);
        root.setContentDescription("回到与 " + name + " 的通话");
        root.setOnTouchListener(new DragListener());
        bindViews();
    }

    private void bindViews() {
        if (root == null) return;
        ImageView image = (ImageView) root.getChildAt(0);
        Chronometer timer = (Chronometer) root.getChildAt(1);
        if (avatar != null) image.setImageBitmap(avatar);
        else image.setImageResource(R.drawable.ic_stat_companion);
        long elapsed = Math.max(0, System.currentTimeMillis() - (acceptedAtWall > 0 ? acceptedAtWall : System.currentTimeMillis()));
        timer.setBase(SystemClock.elapsedRealtime() - elapsed);
        timer.start();
        root.setContentDescription("回到与 " + name + " 的通话");
    }

    private void attachOverlay() {
        if (root == null) buildOverlay();
        bindViews();
        DisplayMetrics metrics = getResources().getDisplayMetrics();
        int type = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                ? WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
                : WindowManager.LayoutParams.TYPE_PHONE;
        layoutParams = new WindowManager.LayoutParams(
                WindowManager.LayoutParams.WRAP_CONTENT,
                WindowManager.LayoutParams.WRAP_CONTENT,
                type,
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE | WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL,
                PixelFormat.TRANSLUCENT);
        layoutParams.gravity = Gravity.TOP | Gravity.START;
        layoutParams.x = metrics.widthPixels - dp(84);
        layoutParams.y = Math.round(metrics.heightPixels * 0.18f);
        try {
            windowManager.addView(root, layoutParams);
            attached = true;
        } catch (Exception error) {
            attached = false;
        }
    }

    private void detachOverlay() {
        if (root != null && attached) {
            try { ((Chronometer) root.getChildAt(1)).stop(); } catch (Exception ignored) {}
            try { windowManager.removeView(root); } catch (Exception ignored) {}
        }
        attached = false;
    }

    private void openApp() {
        try { startActivity(openAppIntent()); } catch (Exception ignored) {
            try { openAppPending().send(); } catch (Exception ignoredToo) {}
        }
    }

    private final class DragListener implements View.OnTouchListener {
        private float downX, downY;
        private int startX, startY;
        private boolean dragging;
        private final int slop = ViewConfiguration.get(CallOverlayService.this).getScaledTouchSlop();

        @Override
        public boolean onTouch(View view, MotionEvent event) {
            if (layoutParams == null) return false;
            switch (event.getActionMasked()) {
                case MotionEvent.ACTION_DOWN:
                    downX = event.getRawX(); downY = event.getRawY();
                    startX = layoutParams.x; startY = layoutParams.y;
                    dragging = false;
                    return true;
                case MotionEvent.ACTION_MOVE: {
                    float dx = event.getRawX() - downX, dy = event.getRawY() - downY;
                    if (!dragging && Math.hypot(dx, dy) > slop) dragging = true;
                    if (dragging) {
                        layoutParams.x = startX + Math.round(dx);
                        layoutParams.y = startY + Math.round(dy);
                        try { windowManager.updateViewLayout(root, layoutParams); } catch (Exception ignored) {}
                    }
                    return true;
                }
                case MotionEvent.ACTION_UP:
                    if (dragging) { dragging = false; snapToEdge(); return true; }
                    view.performClick();
                    openApp();
                    return true;
                case MotionEvent.ACTION_CANCEL:
                    if (dragging) { dragging = false; snapToEdge(); }
                    return true;
                default:
                    return false;
            }
        }
    }

    private void snapToEdge() {
        if (layoutParams == null || root == null) return;
        DisplayMetrics metrics = getResources().getDisplayMetrics();
        int width = root.getWidth() > 0 ? root.getWidth() : dp(72);
        layoutParams.x = layoutParams.x + width / 2 > metrics.widthPixels / 2 ? metrics.widthPixels - width - dp(10) : dp(10);
        layoutParams.y = Math.max(0, Math.min(metrics.heightPixels - dp(120), layoutParams.y));
        try { windowManager.updateViewLayout(root, layoutParams); } catch (Exception ignored) {}
    }

    private void shutdown() {
        detachOverlay();
        if (instance == this) instance = null;
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) stopForeground(STOP_FOREGROUND_REMOVE);
            else stopForeground(true);
        } catch (Exception ignored) {}
        stopSelf();
    }

    @Override
    public void onDestroy() {
        detachOverlay();
        if (instance == this) instance = null;
        super.onDestroy();
    }

    private int dp(int value) {
        return Math.round(TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, value, getResources().getDisplayMetrics()));
    }
}
