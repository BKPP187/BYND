package cc.ccwu.bynd;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Color;
import android.os.Bundle;
import android.view.View;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;

/** A native gate, before the app WebView or background companion is loaded. */
public final class LicenseActivity extends Activity {
    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        if (LicenseManager.canEnter(this)) { enter(); return; }
        getWindow().setStatusBarColor(Color.rgb(250, 249, 245)); getWindow().setNavigationBarColor(Color.rgb(250, 249, 245));
        getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR);
        ScrollView scroll = new ScrollView(this); scroll.setFillViewport(true);
        LinearLayout layout = new LinearLayout(this); layout.setOrientation(LinearLayout.VERTICAL);
        int pad = Math.round(28 * getResources().getDisplayMetrics().density);
        layout.setPadding(pad, pad * 2, pad, pad); layout.setBackgroundColor(Color.rgb(250, 249, 245));
        TextView title = new TextView(this); title.setText("Welcome to BYND"); title.setTextSize(28); title.setTextColor(Color.rgb(38, 40, 37)); layout.addView(title);
        TextView subtitle = new TextView(this); subtitle.setText("让 TA 触碰屏幕之外的世界。\n\n激活后，本机可离线使用。"); subtitle.setTextSize(16); subtitle.setPadding(0, pad, 0, pad); layout.addView(subtitle);
        EditText input = new EditText(this); input.setHint("BYND-… 永久激活码"); input.setSingleLine(true);
        input.setInputType(android.text.InputType.TYPE_CLASS_TEXT | android.text.InputType.TYPE_TEXT_FLAG_CAP_CHARACTERS | android.text.InputType.TYPE_TEXT_FLAG_NO_SUGGESTIONS);
        input.setImportantForAutofill(View.IMPORTANT_FOR_AUTOFILL_NO_EXCLUDE_DESCENDANTS); layout.addView(input);
        Button button = new Button(this); button.setText("激活 BYND"); layout.addView(button);
        TextView status = new TextView(this); status.setTextSize(15); status.setAccessibilityLiveRegion(View.ACCESSIBILITY_LIVE_REGION_POLITE); layout.addView(status);
        TextView help = new TextView(this); help.setText("换机或重新安装后，可能需要重新激活。\n激活遇到问题时，你的数据会保留。"); help.setTextSize(14); help.setPadding(0, pad, 0, 0); layout.addView(help);
        button.setOnClickListener(view -> {
            String code = input.getText().toString().trim();
            if (code.isEmpty()) { status.setText("请先输入激活码。"); return; }
            button.setEnabled(false); input.setEnabled(false); status.setText("正在验证设备与激活码…");
            new Thread(() -> {
                try {
                    LicenseManager.activate(getApplicationContext(), code);
                    runOnUiThread(() -> { if (!isFinishing() && !isDestroyed()) enter(); });
                } catch (Exception error) {
                    runOnUiThread(() -> { if (!isFinishing() && !isDestroyed()) { status.setText(error.getMessage() == null ? "激活失败，请检查网络后重试。" : error.getMessage()); button.setEnabled(true); input.setEnabled(true); } });
                }
            }, "bynd-activation").start();
        });
        scroll.addView(layout); setContentView(scroll);
    }
    private void enter() {
        Intent next = new Intent(this, MainActivity.class); next.setData(getIntent().getData()); startActivity(next); finish();
    }
}
