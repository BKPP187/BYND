package cc.ccwu.bynd;

import android.util.Base64;
import org.json.JSONObject;
import java.nio.charset.StandardCharsets;
import java.security.KeyFactory;
import java.security.MessageDigest;
import java.security.PublicKey;
import java.security.Signature;
import java.security.spec.X509EncodedKeySpec;

/** Shared signature format: RS256 compact JWS, pinned public keys only. */
final class DistributionCrypto {
    static final String PRODUCT = "cc.ccwu.bynd";
    static byte[] decode(String value) { return Base64.decode(value, Base64.URL_SAFE | Base64.NO_WRAP | Base64.NO_PADDING); }
    static String encode(byte[] value) { return Base64.encodeToString(value, Base64.URL_SAFE | Base64.NO_WRAP | Base64.NO_PADDING); }
    static String fingerprint(byte[] value) throws Exception { return encode(MessageDigest.getInstance("SHA-256").digest(value)); }
    static JSONObject verify(String token, String type) throws Exception {
        if (token == null || token.length() > 32768) throw new Exception("凭证格式无效。");
        String[] parts = token.split("\\.", -1);
        if (parts.length != 3) throw new Exception("凭证格式无效。");
        for (String part : parts) if (!part.matches("[A-Za-z0-9_-]+")) throw new Exception("凭证编码无效。");
        JSONObject header = new JSONObject(new String(decode(parts[0]), StandardCharsets.UTF_8));
        if (!"RS256".equals(header.optString("alg")) || !type.equals(header.optString("typ"))) throw new Exception("凭证类型无效。");
        JSONObject keys = new JSONObject(BuildConfig.BYND_PUBLIC_KEYS);
        String spki = keys.optString(header.optString("kid"), "");
        if (spki.isEmpty()) throw new Exception("签名密钥未知，请联系支持。");
        PublicKey key = KeyFactory.getInstance("RSA").generatePublic(new X509EncodedKeySpec(decode(spki)));
        Signature signature = Signature.getInstance("SHA256withRSA");
        signature.initVerify(key);
        signature.update((parts[0] + "." + parts[1]).getBytes(StandardCharsets.US_ASCII));
        if (!signature.verify(decode(parts[2]))) throw new Exception("凭证签名无效。");
        JSONObject claims = new JSONObject(new String(decode(parts[1]), StandardCharsets.UTF_8));
        if (!PRODUCT.equals(claims.optString("aud"))) throw new Exception("凭证不属于 BYND。");
        return claims;
    }
}
