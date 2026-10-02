package cc.ccwu.bynd;

import android.content.Context;
import android.os.Build;
import android.view.DisplayCutout;
import android.view.WindowInsets;
import android.widget.FrameLayout;

/** Keep the WebView edge-to-edge; report the camera clearance for toolbar content only. */
final class ByndSafeAreaLayout extends FrameLayout {
    interface Listener { void onSafeTopChanged(int safeTop); }
    private final Listener listener;
    private volatile int safeTop;

    ByndSafeAreaLayout(Context context, Listener listener) {
        super(context);
        this.listener = listener;
    }

    int getSafeTop() { return safeTop; }

    @Override
    public WindowInsets onApplyWindowInsets(WindowInsets insets) {
        int top = insets.getSystemWindowInsetTop();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            top = insets.getInsets(WindowInsets.Type.displayCutout() | WindowInsets.Type.statusBars()).top;
        } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            DisplayCutout cutout = insets.getDisplayCutout();
            if (cutout != null) top = Math.max(top, cutout.getSafeInsetTop());
        }
        int cssTop = (int) Math.ceil(top / getResources().getDisplayMetrics().density);
        if (cssTop != safeTop) {
            safeTop = cssTop;
            listener.onSafeTopChanged(cssTop);
        }
        // No padding or consumption: fullscreen backgrounds and WebView IME updates stay intact.
        return insets;
    }
}
