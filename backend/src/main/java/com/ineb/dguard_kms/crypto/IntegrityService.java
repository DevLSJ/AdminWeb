package com.ineb.dguard_kms.crypto;

import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.MessageDigest;
import java.util.Arrays;
import java.util.Base64;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

import org.springframework.core.env.Environment;
import org.springframework.stereotype.Service;

import jakarta.annotation.PreDestroy;

@Service
public class IntegrityService {

    private static final String ALGORITHM = "HmacSHA256";

    private byte[] hmacKey;

    public IntegrityService(Environment environment) {
        String configuredKey = environment.getRequiredProperty("kms.integrity.hmac-key");
        this.hmacKey = configuredKey.getBytes(StandardCharsets.UTF_8);
        configuredKey = null;
        if (hmacKey.length < 16) {
            throw new IllegalStateException("Integrity HMAC key must contain at least 16 bytes");
        }
    }

    public String sign(String... values) {
        byte[] keyCopy = currentKey();
        try {
            Mac mac = Mac.getInstance(ALGORITHM);
            mac.init(new SecretKeySpec(keyCopy, ALGORITHM));
            for (String value : values) {
                // 길이를 먼저 포함해 ["ab", "c"]와 ["a", "bc"]가 같은 입력이 되는 것을 막는다.
                if (value == null) {
                    mac.update(ByteBuffer.allocate(Integer.BYTES).putInt(-1).array());
                    continue;
                }
                byte[] encoded = value.getBytes(StandardCharsets.UTF_8);
                mac.update(ByteBuffer.allocate(Integer.BYTES).putInt(encoded.length).array());
                mac.update(encoded);
                Arrays.fill(encoded, (byte) 0);
            }
            return Base64.getEncoder().encodeToString(mac.doFinal());
        } catch (GeneralSecurityException exception) {
            throw new CryptoOperationException("Integrity calculation failed", exception);
        } finally {
            Arrays.fill(keyCopy, (byte) 0);
        }
    }

    public boolean verify(String expectedBase64, String... values) {
        if (expectedBase64 == null || expectedBase64.isBlank()) return false;
        byte[] expected;
        try {
            expected = Base64.getDecoder().decode(expectedBase64);
        } catch (IllegalArgumentException exception) {
            return false;
        }
        byte[] actual = Base64.getDecoder().decode(sign(values));
        try {
            // HMAC도 상수 시간 비교를 사용해 타이밍 기반 추측을 줄인다.
            return MessageDigest.isEqual(expected, actual);
        } finally {
            Arrays.fill(expected, (byte) 0);
            Arrays.fill(actual, (byte) 0);
        }
    }

    private byte[] currentKey() {
        byte[] current = hmacKey;
        if (current == null) throw new IllegalStateException("Integrity HMAC key is not initialized");
        return current.clone();
    }

    @PreDestroy
    void destroy() {
        byte[] current = hmacKey;
        hmacKey = null;
        if (current != null) Arrays.fill(current, (byte) 0);
    }
}
