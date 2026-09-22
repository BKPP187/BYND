package cc.ccwu.bynd;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.Color;
import android.graphics.PixelFormat;
import android.hardware.display.DisplayManager;
import android.hardware.display.VirtualDisplay;
import android.media.Image;
import android.media.ImageReader;
import android.media.projection.MediaProjection;
import android.media.projection.MediaProjectionManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.speech.tts.TextToSpeech;
import android.speech.tts.Voice;
import android.util.Base64;
import android.util.DisplayMetrics;
import android.view.View;
import android.view.Window;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import java.io.ByteArrayOutputStream;
import java.io.OutputStream;
import java.nio.ByteBuffer;
import java.util.Locale;
import java.util.Set;
import org.json.JSONObject;

public class MainActivity extends Activity {
    private static final int SCREEN_CAPTURE_REQUEST = 7311;
    private static final int FILE_CHOOSER_REQUEST = 7312;
    private static final int PNG_EXPORT_REQUEST = 7313;
    private static final int BACKUP_EXPORT_REQUEST = 7314;
    private static final int MAX_CAPTURE_SIDE = 768;

    private WebView webView;
    private ValueCallback<Uri[]> fileChooserCallback;
    private byte[] pendingPngBytes;
    private String pendingPngId;
    private String pendingBackupId;
    private String activeBackupId;
    private OutputStream activeBackupStream;
    private long activeBackupBytes;
    private MediaProjectionManager projectionManager;
    private MediaProjection mediaProjection;
    private VirtualDisplay virtualDisplay;
    private ImageReader imageReader;
    private int captureWidth;
    private int captureHeight;
    private int captureDensity;
    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private TextToSpeech systemTts;
    private volatile boolean systemTtsReady;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        requestWindowFeature(Window.FEATURE_NO_TITLE);
        configureSystemBars();

        projectionManager = (MediaProjectionManager) getSystemService(Context.MEDIA_PROJECTION_SERVICE);
        initializeSystemTts();
        webView = new WebView(this);
        setContentView(webView);
        configureWebView(webView);
        webView.addJavascriptInterface(new ByndAndroidBridge(), "ByndAndroid");
        webView.loadUrl("file:///android_asset/www/index.html");
    }

    private void configureSystemBars() {
        Window window = getWindow();
        window.setFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN, WindowManager.LayoutParams.FLAG_FULLSCREEN);
        window.clearFlags(WindowManager.LayoutParams.FLAG_TRANSLUCENT_STATUS | WindowManager.LayoutParams.FLAG_TRANSLUCENT_NAVIGATION);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            WindowManager.LayoutParams attrs = window.getAttributes();
            attrs.layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
            window.setAttributes(attrs);
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            window.setDecorFitsSystemWindows(false);
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            window.addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
            window.setStatusBarColor(Color.TRANSPARENT);
            window.setNavigationBarColor(Color.WHITE);
        }
        applyFullscreenSystemBars();
    }

    private void applyFullscreenSystemBars() {
        Window window = getWindow();
        int flags = View.SYSTEM_UI_FLAG_FULLSCREEN
                | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                | View.SYSTEM_UI_FLAG_LAYOUT_STABLE;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            flags |= View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
        }
        window.getDecorView().setSystemUiVisibility(flags);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            WindowInsetsController controller = window.getInsetsController();
            if (controller != null) {
                controller.hide(WindowInsets.Type.statusBars());
                controller.setSystemBarsBehavior(WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
            }
        }
    }

    @Override
    protected void onResume() {
        super.onResume();
        applyFullscreenSystemBars();
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) applyFullscreenSystemBars();
    }

    private void configureWebView(WebView view) {
        WebSettings settings = view.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setAllowFileAccessFromFileURLs(true);
        settings.setAllowUniversalAccessFromFileURLs(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        view.setBackgroundColor(Color.rgb(242, 244, 246));
        view.setWebViewClient(new WebViewClient());
        view.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView webView, ValueCallback<Uri[]> filePathCallback, WebChromeClient.FileChooserParams fileChooserParams) {
                if (fileChooserCallback != null) {
                    fileChooserCallback.onReceiveValue(null);
                }
                fileChooserCallback = filePathCallback;
                Intent intent;
                try {
                    intent = fileChooserParams.createIntent();
                } catch (Throwable ignored) {
                    intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
                    intent.addCategory(Intent.CATEGORY_OPENABLE);
                    intent.setType("*/*");
                }
                intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                try {
                    startActivityForResult(intent, FILE_CHOOSER_REQUEST);
                } catch (Throwable ignored) {
                    fileChooserCallback = null;
                    filePathCallback.onReceiveValue(null);
                    return false;
                }
                return true;
            }
        });
    }

    private void initializeSystemTts() {
        systemTts = new TextToSpeech(getApplicationContext(), status -> {
            systemTtsReady = status == TextToSpeech.SUCCESS;
        });
    }

    private String buildTtsResult(String status, String message) {
        JSONObject result = new JSONObject();
        try {
            result.put("status", status);
            result.put("message", message == null ? "" : message);
        } catch (Exception ignored) {}
        return result.toString();
    }

    private String requestSystemSpeech(String text, String languageTag, double requestedRate) {
        final TextToSpeech tts = systemTts;
        if (!systemTtsReady || tts == null) return buildTtsResult("not-ready", "TTS is initializing");
        final String content = text == null ? "" : text.trim();
        if (content.isEmpty()) return buildTtsResult("empty", "Text is empty");
        final Locale locale = languageTag == null || languageTag.trim().isEmpty()
                ? Locale.getDefault()
                : Locale.forLanguageTag(languageTag.trim());
        final int support = tts.isLanguageAvailable(locale);
        if (support == TextToSpeech.LANG_MISSING_DATA) {
            return buildTtsResult("missing-data", "Language voice data is not installed");
        }
        if (support == TextToSpeech.LANG_NOT_SUPPORTED || support == TextToSpeech.ERROR) {
            return buildTtsResult("not-supported", "Language is not supported by the installed TTS engine");
        }
        final float rate = (float) Math.max(0.5, Math.min(2.0, requestedRate));
        mainHandler.post(() -> {
            Voice selected = null;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                Set<Voice> voices = tts.getVoices();
                if (voices != null) {
                    for (Voice candidate : voices) {
                        Locale candidateLocale = candidate.getLocale();
                        if (candidateLocale == null || !candidateLocale.getLanguage().equalsIgnoreCase(locale.getLanguage())) continue;
                        if (!candidate.isNetworkConnectionRequired()) {
                            selected = candidate;
                            break;
                        }
                        if (selected == null) selected = candidate;
                    }
                }
            }
            if (selected != null) tts.setVoice(selected);
            else tts.setLanguage(locale);
            tts.setSpeechRate(rate);
            tts.speak(content, TextToSpeech.QUEUE_FLUSH, null, "bynd-study-" + System.currentTimeMillis());
        });
        return buildTtsResult("queued", "");
    }

    private void requestScreenCapture() {
        if (projectionManager == null) return;
        startActivityForResult(projectionManager.createScreenCaptureIntent(), SCREEN_CAPTURE_REQUEST);
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == PNG_EXPORT_REQUEST) {
            final byte[] bytes = pendingPngBytes;
            final String id = pendingPngId;
            pendingPngBytes = null;
            pendingPngId = null;
            if (id == null) return;
            if (resultCode != RESULT_OK || data == null || data.getData() == null) {
                notifyPngExport(id, false, "已取消保存图片");
            } else {
                final Uri destination = data.getData();
                new Thread(() -> {
                    try (OutputStream stream = getContentResolver().openOutputStream(destination, "w")) {
                        if (stream == null || bytes == null) throw new IllegalStateException("No output stream");
                        stream.write(bytes);
                        stream.flush();
                    } catch (Exception error) {
                        runOnUiThread(() -> notifyPngExport(id, false, "图片未能保存，请重新选择位置后重试"));
                        return;
                    }
                    runOnUiThread(() -> notifyPngExport(id, true, "图片已保存到所选位置"));
                }, "BYND-PNG-export").start();
            }
            applyFullscreenSystemBars();
            return;
        }
        if (requestCode == BACKUP_EXPORT_REQUEST) {
            final String id = pendingBackupId;
            pendingBackupId = null;
            if (id == null) return;
            if (resultCode != RESULT_OK || data == null || data.getData() == null) {
                notifyBackupExport(id, false, "已取消导出备份");
            } else {
                try {
                    clearActiveBackupExport();
                    activeBackupStream = getContentResolver().openOutputStream(data.getData(), "w");
                    if (activeBackupStream == null) throw new IllegalStateException("No output stream");
                    activeBackupId = id;
                    activeBackupBytes = 0;
                    notifyBackupReady(id, "已选择保存位置，正在写入备份");
                } catch (Exception error) {
                    clearActiveBackupExport();
                    notifyBackupExport(id, false, "无法写入所选位置，请重新选择文件夹后重试");
                }
            }
            applyFullscreenSystemBars();
            return;
        }
        if (requestCode == FILE_CHOOSER_REQUEST) {
            ValueCallback<Uri[]> callback = fileChooserCallback;
            fileChooserCallback = null;
            Uri[] result = null;
            if (resultCode == RESULT_OK && data != null) {
                result = WebChromeClient.FileChooserParams.parseResult(resultCode, data);
            }
            if (callback != null) callback.onReceiveValue(result);
            applyFullscreenSystemBars();
            return;
        }
        if (requestCode == SCREEN_CAPTURE_REQUEST && resultCode == RESULT_OK && data != null) {
            startProjection(data);
        }
    }

    private void startProjection(Intent data) {
        stopProjection();
        DisplayMetrics metrics = new DisplayMetrics();
        getWindowManager().getDefaultDisplay().getRealMetrics(metrics);
        captureWidth = Math.max(1, metrics.widthPixels);
        captureHeight = Math.max(1, metrics.heightPixels);
        captureDensity = metrics.densityDpi;
        mediaProjection = projectionManager.getMediaProjection(RESULT_OK, data);
        if (mediaProjection == null) return;
        imageReader = ImageReader.newInstance(captureWidth, captureHeight, PixelFormat.RGBA_8888, 2);
        virtualDisplay = mediaProjection.createVirtualDisplay(
                "BYND_SCREEN_CAPTURE",
                captureWidth,
                captureHeight,
                captureDensity,
                DisplayManager.VIRTUAL_DISPLAY_FLAG_AUTO_MIRROR,
                imageReader.getSurface(),
                null,
                mainHandler
        );
    }

    private void stopProjection() {
        if (virtualDisplay != null) {
            virtualDisplay.release();
            virtualDisplay = null;
        }
        if (imageReader != null) {
            imageReader.close();
            imageReader = null;
        }
        if (mediaProjection != null) {
            mediaProjection.stop();
            mediaProjection = null;
        }
    }

    private synchronized String captureFrameDataUrl() {
        if (imageReader == null || mediaProjection == null) return "";
        Image image = null;
        Bitmap padded = null;
        Bitmap cropped = null;
        Bitmap output = null;
        try {
            image = imageReader.acquireLatestImage();
            if (image == null) return "";
            Image.Plane[] planes = image.getPlanes();
            if (planes == null || planes.length == 0) return "";
            ByteBuffer buffer = planes[0].getBuffer();
            int pixelStride = planes[0].getPixelStride();
            int rowStride = planes[0].getRowStride();
            int rowPadding = Math.max(0, rowStride - pixelStride * image.getWidth());
            int paddedWidth = image.getWidth() + rowPadding / Math.max(1, pixelStride);
            padded = Bitmap.createBitmap(paddedWidth, image.getHeight(), Bitmap.Config.ARGB_8888);
            padded.copyPixelsFromBuffer(buffer);
            cropped = Bitmap.createBitmap(padded, 0, 0, image.getWidth(), image.getHeight());
            float scale = Math.min(1f, (float) MAX_CAPTURE_SIDE / Math.max(cropped.getWidth(), cropped.getHeight()));
            if (scale < 1f) {
                int width = Math.max(1, Math.round(cropped.getWidth() * scale));
                int height = Math.max(1, Math.round(cropped.getHeight() * scale));
                output = Bitmap.createScaledBitmap(cropped, width, height, true);
            } else {
                output = cropped;
            }
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            output.compress(Bitmap.CompressFormat.JPEG, 72, out);
            return "data:image/jpeg;base64," + Base64.encodeToString(out.toByteArray(), Base64.NO_WRAP);
        } catch (Throwable ignored) {
            return "";
        } finally {
            if (image != null) image.close();
            if (padded != null && padded != output) padded.recycle();
            if (cropped != null && cropped != output) cropped.recycle();
            if (output != null && output != cropped) output.recycle();
        }
    }

    @Override
    protected void onDestroy() {
        stopProjection();
        systemTtsReady = false;
        if (systemTts != null) {
            systemTts.stop();
            systemTts.shutdown();
            systemTts = null;
        }
        pendingPngBytes = null;
        pendingPngId = null;
        pendingBackupId = null;
        clearActiveBackupExport();
        if (webView != null) {
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }

    private void notifyPngExport(String id, boolean ok, String message) {
        if (webView == null) return;
        String script = "window.dispatchEvent(new CustomEvent('bynd:png-export',{detail:{id:"
                + JSONObject.quote(id) + ",ok:" + ok + ",message:" + JSONObject.quote(message) + "}}));";
        webView.evaluateJavascript(script, null);
    }

    private void notifyBackupExport(String id, boolean ok, String message) {
        if (webView == null) return;
        String script = "window.dispatchEvent(new CustomEvent('bynd:backup-export',{detail:{id:"
                + JSONObject.quote(id) + ",ok:" + ok + ",message:" + JSONObject.quote(message) + "}}));";
        webView.evaluateJavascript(script, null);
    }

    private void notifyBackupReady(String id, String message) {
        if (webView == null) return;
        String script = "window.dispatchEvent(new CustomEvent('bynd:backup-export-ready',{detail:{id:"
                + JSONObject.quote(id) + ",message:" + JSONObject.quote(message) + "}}));";
        webView.evaluateJavascript(script, null);
    }

    private void clearActiveBackupExport() {
        if (activeBackupStream != null) {
            try { activeBackupStream.close(); } catch (Exception ignored) {}
        }
        activeBackupStream = null;
        activeBackupId = null;
        activeBackupBytes = 0;
    }

    private void requestBackupExport(String id, String name) {
        if (webView == null || id == null || !id.matches("[a-zA-Z0-9_-]{1,80}")) return;
        String page = webView.getUrl();
        if (page == null || !page.startsWith("file:///android_asset/www/")) {
            notifyBackupExport(id, false, "请在 BYND 应用内导出备份");
            return;
        }
        if (pendingBackupId != null || activeBackupId != null) { notifyBackupExport(id, false, "请先完成当前备份导出"); return; }
        try {
            String filename = name == null ? "BYND-backup.json" : name.replaceAll("[\\\\/:*?\"<>|\\p{Cntrl}]", "_");
            if (filename.length() > 100) filename = filename.substring(0, 100);
            if (!filename.toLowerCase(java.util.Locale.ROOT).endsWith(".json")) filename += ".json";
            Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
            intent.addCategory(Intent.CATEGORY_OPENABLE);
            intent.setType("application/json");
            intent.putExtra(Intent.EXTRA_TITLE, filename);
            pendingBackupId = id;
            startActivityForResult(intent, BACKUP_EXPORT_REQUEST);
        } catch (Exception error) {
            pendingBackupId = null;
            notifyBackupExport(id, false, "无法打开系统保存位置，请检查存储权限后重试");
        }
    }

    private void appendBackupExportChunk(String id, String base64Chunk) {
        if (id == null || !id.equals(activeBackupId) || activeBackupStream == null) return;
        try {
            if (base64Chunk == null || base64Chunk.length() > 512 * 1024) throw new IllegalArgumentException();
            byte[] bytes = Base64.decode(base64Chunk, Base64.DEFAULT);
            if (bytes.length == 0 || activeBackupBytes + bytes.length > 256L * 1024L * 1024L) throw new IllegalArgumentException();
            activeBackupStream.write(bytes);
            activeBackupBytes += bytes.length;
        } catch (Exception error) {
            clearActiveBackupExport();
            notifyBackupExport(id, false, "备份写入中断，请重新导出并选择保存位置");
        }
    }

    private void finishBackupExport(String id) {
        if (id == null || !id.equals(activeBackupId) || activeBackupStream == null) return;
        try {
            if (activeBackupBytes < 2) throw new IllegalStateException("Empty backup");
            activeBackupStream.flush();
            activeBackupStream.close();
            activeBackupStream = null;
            activeBackupId = null;
            activeBackupBytes = 0;
            notifyBackupExport(id, true, "备份已保存到所选位置");
        } catch (Exception error) {
            clearActiveBackupExport();
            notifyBackupExport(id, false, "备份未能完成写入，请重新导出");
        }
    }

    private void requestPngExport(String id, String name, String dataUrl) {
        if (webView == null || id == null || !id.matches("[a-zA-Z0-9_-]{1,80}")) return;
        String page = webView.getUrl();
        if (page == null || !page.startsWith("file:///android_asset/www/")) {
            notifyPngExport(id, false, "请在 BYND 应用内导出图片");
            return;
        }
        if (pendingPngId != null) { notifyPngExport(id, false, "请先完成当前图片的保存"); return; }
        try {
            if (dataUrl == null || dataUrl.length() > 28 * 1024 * 1024) throw new IllegalArgumentException();
            boolean gif = dataUrl.startsWith("data:image/gif;base64,");
            String mime = gif ? "image/gif" : "image/png";
            String extension = gif ? ".gif" : ".png";
            String prefix = "data:" + mime + ";base64,";
            if (!dataUrl.startsWith(prefix)) throw new IllegalArgumentException();
            byte[] bytes = Base64.decode(dataUrl.substring(prefix.length()), Base64.DEFAULT);
            byte[] signature = gif ? new byte[] {71, 73, 70, 56} : new byte[] {(byte) 137, 80, 78, 71, 13, 10, 26, 10};
            if (bytes.length < signature.length) throw new IllegalArgumentException();
            for (int i = 0; i < signature.length; i++) if (bytes[i] != signature[i]) throw new IllegalArgumentException();
            if (gif && (bytes.length < 13 || (bytes[4] != 55 && bytes[4] != 57) || bytes[5] != 97)) throw new IllegalArgumentException();
            String filename = name == null ? "BYND-char-pet" + extension : name.replaceAll("[\\\\/:*?\"<>|\\p{Cntrl}]", "_");
            if (filename.length() > 100) filename = filename.substring(0, 100);
            if (!filename.toLowerCase(java.util.Locale.ROOT).endsWith(extension)) filename += extension;
            // Storage Access Framework grants access only to the user-selected document.
            Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
            intent.addCategory(Intent.CATEGORY_OPENABLE);
            intent.setType(mime);
            intent.putExtra(Intent.EXTRA_TITLE, filename);
            pendingPngBytes = bytes;
            pendingPngId = id;
            startActivityForResult(intent, PNG_EXPORT_REQUEST);
        } catch (Exception error) {
            pendingPngBytes = null;
            pendingPngId = null;
            notifyPngExport(id, false, "无法导出图片，请检查图片或系统文件管理器");
        }
    }

    public class ByndAndroidBridge {
        @JavascriptInterface
        public void exportPetImage(String id, String name, String dataUrl) {
            runOnUiThread(() -> requestPngExport(id, name, dataUrl));
        }

        @JavascriptInterface
        public void exportPng(String id, String name, String dataUrl) {
            runOnUiThread(() -> requestPngExport(id, name, dataUrl));
        }

        @JavascriptInterface
        public void beginBackupExport(String id, String name) {
            runOnUiThread(() -> requestBackupExport(id, name));
        }

        @JavascriptInterface
        public void appendBackupExportChunk(String id, String base64Chunk) {
            runOnUiThread(() -> appendBackupExportChunk(id, base64Chunk));
        }

        @JavascriptInterface
        public void finishBackupExport(String id) {
            runOnUiThread(() -> finishBackupExport(id));
        }

        @JavascriptInterface
        public void startScreenCapture() {
            runOnUiThread(() -> requestScreenCapture());
        }

        @JavascriptInterface
        public void stopScreenCapture() {
            runOnUiThread(() -> stopProjection());
        }

        @JavascriptInterface
        public String isScreenCaptureActive() {
            return mediaProjection != null && imageReader != null ? "true" : "false";
        }

        @JavascriptInterface
        public String captureScreenFrame() {
            return captureFrameDataUrl();
        }

        @JavascriptInterface
        public String speakText(String text, String languageTag, double rate) {
            return requestSystemSpeech(text, languageTag, rate);
        }

        @JavascriptInterface
        public void stopTts() {
            final TextToSpeech tts = systemTts;
            if (tts != null) mainHandler.post(tts::stop);
        }
    }
}
