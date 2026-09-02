package com.ineb.dguard_kms.security;

import java.security.GeneralSecurityException;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Arrays;
import java.util.Base64;

import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.PBEKeySpec;

import org.springframework.core.env.Environment;
import org.springframework.stereotype.Service;

import com.ineb.dguard_kms.domain.auth.entity.AdminUser;

@Service
public class PasswordService {

    public static final String ALGORITHM = "PBKDF2WithHmacSHA256";
    public static final int REQUIRED_ITERATIONS = 210_000;
    private static final int SALT_LENGTH_BYTES = 16;
    private static final int HASH_LENGTH_BITS = 256;

    private final SecureRandom secureRandom;
    private final int defaultIterations;

    public PasswordService(SecureRandom secureRandom, Environment environment) {
        this.secureRandom = secureRandom;
        this.defaultIterations = environment.getProperty(
                "kms.password.pbkdf2.iterations", Integer.class, REQUIRED_ITERATIONS
        );
        if (defaultIterations < REQUIRED_ITERATIONS) {
            throw new IllegalStateException(
                    "Password PBKDF2 iterations must be at least " + REQUIRED_ITERATIONS
            );
        }
    }

    public PasswordHash hash(char[] password) {
        // 계정마다 새 Salt를 사용해 같은 비밀번호도 서로 다른 해시가 저장되게 한다.
        byte[] salt = new byte[SALT_LENGTH_BYTES];
        secureRandom.nextBytes(salt);
        byte[] hash = derive(password, salt, defaultIterations, ALGORITHM);
        try {
            return new PasswordHash(
                    Base64.getEncoder().encodeToString(hash),
                    Base64.getEncoder().encodeToString(salt),
                    ALGORITHM,
                    defaultIterations
            );
        } finally {
            Arrays.fill(hash, (byte) 0);
            Arrays.fill(salt, (byte) 0);
        }
    }

    public boolean matches(char[] candidate, AdminUser user) {
        byte[] salt;
        byte[] expected;
        try {
            salt = Base64.getDecoder().decode(user.getPasswordSalt());
            expected = Base64.getDecoder().decode(user.getPasswordHash());
        } catch (IllegalArgumentException exception) {
            return false;
        }

        byte[] actual = null;
        try {
            actual = derive(candidate, salt, user.getPasswordIterations(), user.getPasswordAlgorithm());
            // 상수 시간 비교로 해시 비교 과정의 타이밍 정보 노출을 줄인다.
            return MessageDigest.isEqual(expected, actual);
        } finally {
            Arrays.fill(salt, (byte) 0);
            Arrays.fill(expected, (byte) 0);
            if (actual != null) Arrays.fill(actual, (byte) 0);
        }
    }

    private byte[] derive(char[] password, byte[] salt, int iterations, String algorithm) {
        PBEKeySpec spec = new PBEKeySpec(password, salt, iterations, HASH_LENGTH_BITS);
        try {
            return SecretKeyFactory.getInstance(algorithm).generateSecret(spec).getEncoded();
        } catch (GeneralSecurityException exception) {
            throw new IllegalStateException("Unable to hash password", exception);
        } finally {
            spec.clearPassword();
        }
    }

    public record PasswordHash(String hash, String salt, String algorithm, int iterations) {
    }
}
