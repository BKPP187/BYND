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
import org.json.JSONObject;

public class MainActivity extends Activity {
    private static final int SCREEN_CAPTURE_REQUEST = 7311;
    private static final int FILE_CHOOSER_REQUEST = 7312;
    private static final int PNG_EXPORT_REQUEST = 7313;
    private static final int MAX_CAPTURE_SIDE = 768;

    private WebView webView;
    private ValueCallback<Uri[]> fileChooserCallback;
    private byte[] pendingPngBytes;
    private String pendingPngId;
    private MediaProjectionManager projectionManager;
    private MediaProjection mediaProjection;
    private VirtualDisplay virtualDisplay;
    private ImageReader imageReader;
    private int captureWidth;
    private int captureHeight;
    private int captureDensity;
    private final Handler mainHandler = new Handler(Looper.getMainLooper());

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        requestWindowFeature(Window.FEATURE_NO_TITLE);
        configureSystemBars();

        projectionManager = (MediaProjectionManager) getSystemService(Context.MEDIA_PROJECTION_SERVICE);
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
                notifyPngExport(id, false, "已取消保存 PNG");
            } else {
                final Uri destination = data.getData();
                new Thread(() -> {
                    try (OutputStream stream = getContentResolver().openOutputStream(destination, "w")) {
                        if (stream == null || bytes == null) throw new IllegalStateException("No output stream");
                        stream.write(bytes);
                        stream.flush();
                    } catch (Exception error) {
                        runOnUiThread(() -> notifyPngExport(id, false, "PNG 未能保存，请重新选择位置后重试"));
                        return;
                    }
                    runOnUiThread(() -> notifyPngExport(id, true, "PNG 已保存到所选位置"));
                }, "BYND-PNG-export").start();
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
        pendingPngBytes = null;
        pendingPngId = null;
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

    private void requestPngExport(String id, String name, String dataUrl) {
        if (webView == null || id == null || !id.matches("[a-zA-Z0-9_-]{1,80}")) return;
        String page = webView.getUrl();
        if (page == null || !page.startsWith("file:///android_asset/www/")) {
            notifyPngExport(id, false, "请在 BYND 应用内导出图片");
            return;
        }
        if (pendingPngId != null) { notifyPngExport(id, false, "请先完成当前图片的保存"); return; }
        try {
            if (dataUrl == null || dataUrl.length() > 28 * 1024 * 1024 || !dataUrl.startsWith("data:image/png;base64,")) throw new IllegalArgumentException();
            byte[] bytes = Base64.decode(dataUrl.substring("data:image/png;base64,".length()), Base64.DEFAULT);
            byte[] signature = new byte[] {(byte) 137, 80, 78, 71, 13, 10, 26, 10};
            if (bytes.length < signature.length) throw new IllegalArgumentException();
            for (int i = 0; i < signature.length; i++) if (bytes[i] != signature[i]) throw new IllegalArgumentException();
            String filename = name == null ? "BYND-char-pet.png" : name.replaceAll("[\\\\/:*?\"<>|\\p{Cntrl}]", "_");
            if (filename.length() > 100) filename = filename.substring(0, 100);
            if (!filename.toLowerCase(java.util.Locale.ROOT).endsWith(".png")) filename += ".png";
            // Storage Access Framework grants access only to the user-selected document.
            Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
            intent.addCategory(Intent.CATEGORY_OPENABLE);
            intent.setType("image/png");
            intent.putExtra(Intent.EXTRA_TITLE, filename);
            pendingPngBytes = bytes;
            pendingPngId = id;
            startActivityForResult(intent, PNG_EXPORT_REQUEST);
        } catch (Exception error) {
            pendingPngBytes = null;
            pendingPngId = null;
            notifyPngExport(id, false, "无法导出 PNG，请检查图片或系统文件管理器");
        }
    }

    public class ByndAndroidBridge {
        @JavascriptInterface
        public void exportPng(String id, String name, String dataUrl) {
            runOnUiThread(() -> requestPngExport(id, name, dataUrl));
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
    }
}
