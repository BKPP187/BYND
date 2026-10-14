package cc.ccwu.bynd;

import java.nio.charset.StandardCharsets;
import java.security.KeyFactory;
import java.security.Signature;
import java.security.spec.X509EncodedKeySpec;

final class DistributionSignature {
    static boolean verify(String signedData, byte[] signatureBytes, byte[] publicKeySpki) throws Exception {
        Signature signature = Signature.getInstance("SHA256withRSA");
        signature.initVerify(KeyFactory.getInstance("RSA").generatePublic(new X509EncodedKeySpec(publicKeySpki)));
        signature.update(signedData.getBytes(StandardCharsets.US_ASCII));
        return signature.verify(signatureBytes);
    }
}
