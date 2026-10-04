package cc.ccwu.bynd;

import android.app.Activity;
import android.os.Bundle;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;

/** System permission sheet links here; no health data is read by this activity. */
public final class HealthPermissionActivity extends Activity {
    @Override protected void onCreate(Bundle state) {
        super.onCreate(state);
        LinearLayout layout = new LinearLayout(this);
        layout.setOrientation(LinearLayout.VERTICAL);
        int padding = (int) (24 * getResources().getDisplayMetrics().density);
        layout.setPadding(padding, padding * 2, padding, padding);
        TextView text = new TextView(this);
        text.setTextSize(17);
        text.setText("BYND 健康数据使用说明\n\n月伴仅在你连接后读取 Health Connect 中已有的经期日期，不写入或修改系统健康数据。读取范围为最近 30 天。数据保存在本机，不进入普通应用备份。\n\n读取权限不会自动授权角色。只有你在月伴中为某个角色单独授权后，选中的周期概况或日期才会随聊天请求发送给你配置的模型；启用 Jev 后也会发送给 Jev。已发送内容不能撤回。\n\n你可在 BYND 中断开连接并清除读取的样本，也可在系统 Health Connect 中撤销权限。手动记录不会因断开连接而删除。");
        layout.addView(text);
        Button close = new Button(this);
        close.setText("返回");
        close.setOnClickListener(view -> finish());
        layout.addView(close);
        setContentView(layout);
    }
}
