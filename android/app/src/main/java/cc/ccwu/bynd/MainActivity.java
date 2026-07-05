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
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.util.Base64;
import android.util.DisplayMetrics;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import java.io.ByteArrayOutputStream;
import java.nio.ByteBuffer;

public class MainActivity extends Activity {
    private static final int SCREEN_CAPTURE_REQUEST = 7311;
    private static final int MAX_CAPTURE_SIDE = 768;

    private WebView webView;
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
        window.clearFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN);
        window.clearFlags(WindowManager.LayoutParams.FLAG_TRANSLUCENT_STATUS | WindowManager.LayoutParams.FLAG_TRANSLUCENT_NAVIGATION);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            window.addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
            window.setStatusBarColor(Color.rgb(247, 248, 250));
            window.setNavigationBarColor(Color.WHITE);
        }
        int flags = View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            flags |= View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
        }
        window.getDecorView().setSystemUiVisibility(flags);
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
        view.setWebViewClient(new WebViewClient());
        view.setWebChromeClient(new WebChromeClient());
    }

    private void requestScreenCapture() {
        if (projectionManager == null) return;
        startActivityForResult(projectionManager.createScreenCaptureIntent(), SCREEN_CAPTURE_REQUEST);
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
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
        if (webView != null) {
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }

    public class ByndAndroidBridge {
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
