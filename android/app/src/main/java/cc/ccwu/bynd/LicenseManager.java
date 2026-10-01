package cc.ccwu.bynd;

import android.content.Context;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.AtomicFile;
import org.json.JSONObject;
import java.io.File;
import java.io.FileOutputStream;
import java.nio.charset.StandardCharsets;
import java.security.KeyPairGenerator;
import java.security.KeyStore;
import java.security.PrivateKey;
import java.security.Signature;
import java.security.SecureRandom;

final class LicenseManager {
    private static final String ALIAS = "bynd.license.device.v1";
    private static AtomicFile credential(Context context) {
        return new AtomicFile(new File(context.getNoBackupFilesDir(), "bynd-license-v1.jws"));
    }
    private static KeyStore keys(boolean create) throws Exception {
        KeyStore store = KeyStore.getInstance("AndroidKeyStore"); store.load(null);
        if (!store.containsAlias(ALIAS) && create) {
            KeyPairGenerator generator = KeyPairGenerator.getInstance(KeyProperties.KEY_ALGORITHM_RSA, "AndroidKeyStore");
            generator.initialize(new KeyGenParameterSpec.Builder(ALIAS, KeyProperties.PURPOSE_SIGN | KeyProperties.PURPOSE_VERIFY)
                .setKeySize(2048).setDigests(KeyProperties.DIGEST_SHA256).setSignaturePaddings(KeyProperties.SIGNATURE_PADDING_RSA_PKCS1).build());
            generator.generateKeyPair();
        }
        return store;
    }
    static boolean canEnter(Context context) {
        if (!BuildConfig.BYND_REQUIRE_LICENSE) return true;
        try {
            byte[] bytes;
            try (java.io.InputStream stream = credential(context).openRead()) { bytes = DistributionHttp.read(stream, 32768); }
            verify(new String(bytes, StandardCharsets.UTF_8), keys(false));
            return true;
        } catch (Exception ignored) { return false; }
    }
    private static void verify(String token, KeyStore store) throws Exception {
        if (!store.containsAlias(ALIAS)) throw new Exception("设备身份已丢失，请重新激活。");
        JSONObject claims = DistributionCrypto.verify(token, "BYND-LICENSE");
        byte[] publicKey = store.getCertificate(ALIAS).getPublicKey().getEncoded();
        if (!"bynd-license".equals(claims.optString("iss")) || !"perpetual".equals(claims.optString("entitlement"))
            || !claims.optString("licenseId").matches("[0-9a-f-]{36}") || !DistributionCrypto.fingerprint(publicKey).equals(claims.optString("device"))) throw new Exception("激活凭证与本机不匹配。");
        // A copied public key or token alone cannot satisfy local possession.
        byte[] nonce = new byte[32]; new SecureRandom().nextBytes(nonce);
        Signature proof = Signature.getInstance("SHA256withRSA");
        proof.initSign((PrivateKey) store.getKey(ALIAS, null)); proof.update(nonce); byte[] signature = proof.sign();
        proof.initVerify(store.getCertificate(ALIAS).getPublicKey()); proof.update(nonce);
        if (!proof.verify(signature)) throw new Exception("设备身份验证失败。");
    }
    static synchronized void activate(Context context, String code) throws Exception {
        if (!BuildConfig.BYND_REQUIRE_LICENSE) throw new Exception("当前开发版本无需激活。");
        KeyStore store = keys(true);
        String publicKey = DistributionCrypto.encode(store.getCertificate(ALIAS).getPublicKey().getEncoded());
        JSONObject request = new JSONObject().put("licenseKey", code).put("publicKey", publicKey);
        JSONObject challenge = DistributionHttp.request("/license/v1/challenge", request);
        if (challenge == null) throw new Exception("未能获取激活请求。");
        Signature proof = Signature.getInstance("SHA256withRSA"); proof.initSign((PrivateKey) store.getKey(ALIAS, null));
        proof.update(challenge.getString("challenge").getBytes(StandardCharsets.UTF_8));
        request.put("challengeId", challenge.getString("challengeId")).put("proof", DistributionCrypto.encode(proof.sign()));
        JSONObject response = DistributionHttp.request("/license/v1/activate", request);
        if (response == null) throw new Exception("未能获取激活凭证。");
        String token = response.getString("token"); verify(token, store);
        AtomicFile file = credential(context); FileOutputStream output = null;
        try {
            output = file.startWrite(); output.write(token.getBytes(StandardCharsets.UTF_8)); file.finishWrite(output); output = null;
        } catch (Exception error) { if (output != null) file.failWrite(output); throw new Exception("无法保存激活凭证，请重试。", error); }
        if (!canEnter(context)) throw new Exception("激活凭证保存验证失败，请重试。");
    }
}
