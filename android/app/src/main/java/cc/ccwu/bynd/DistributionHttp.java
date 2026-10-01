package cc.ccwu.bynd;

import org.json.JSONObject;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

final class DistributionHttp {
    static JSONObject request(String path, JSONObject body) throws Exception {
        URL url = new URL(BuildConfig.BYND_SERVICE_URL + path);
        if (!"https".equals(url.getProtocol()) || url.getUserInfo() != null) throw new Exception("服务地址无效。");
        HttpURLConnection connection = (HttpURLConnection) url.openConnection();
        connection.setConnectTimeout(12000); connection.setReadTimeout(15000);
        connection.setInstanceFollowRedirects(false);
        try {
            if (body != null) {
                byte[] bytes = body.toString().getBytes(StandardCharsets.UTF_8);
                connection.setRequestMethod("POST"); connection.setDoOutput(true);
                connection.setRequestProperty("Content-Type", "application/json");
                connection.setFixedLengthStreamingMode(bytes.length);
                try (java.io.OutputStream output = connection.getOutputStream()) { output.write(bytes); }
            }
            int status = connection.getResponseCode();
            if (status == 204) return null;
            if (status >= 300 && status < 400) throw new Exception("服务返回了意外跳转。");
            try (InputStream stream = status >= 400 ? connection.getErrorStream() : connection.getInputStream()) {
                if (stream == null) throw new Exception("服务器未返回有效结果。");
                JSONObject data = new JSONObject(new String(read(stream, 65536), StandardCharsets.UTF_8));
                if (status < 200 || status >= 300) throw new Exception(data.optString("message", "服务暂时不可用，请重试。"));
                return data;
            }
        } finally { connection.disconnect(); }
    }
    static byte[] read(InputStream stream, int max) throws Exception {
        ByteArrayOutputStream result = new ByteArrayOutputStream(); byte[] buffer = new byte[4096]; int count;
        while ((count = stream.read(buffer)) != -1) {
            if (result.size() + count > max) throw new Exception("服务响应过大。");
            result.write(buffer, 0, count);
        }
        return result.toByteArray();
    }
}
